"""KinBot media helpers: screenshot text (Amazon Textract), read-aloud (Amazon Polly) and voicemail
transcription (Amazon Transcribe). Called from handler.py for POST /kinbot modes "ocr", "speak",
"voicemail_start" and "voicemail_status".

Privacy: screenshots and speech are processed in memory and never written anywhere. A voicemail has
to sit in S3 while Transcribe reads it; the audio, the transcript and the Transcribe job are deleted
as soon as the text is returned, and the bucket's lifecycle rule removes anything left after 1 day.
"""

import base64
import json
import os
import re
import uuid

import boto3

REGION = os.environ.get("AWS_REGION", "us-east-1")
BUCKET = os.environ.get("VOICEMAIL_BUCKET", "")
IMAGE_MAX_BYTES = 4_500_000  # Textract's synchronous limit is 5 MB
AUDIO_MAX_BYTES = 4_000_000  # Lambda's request payload limit is 6 MB including base64 overhead
SPEAK_MAX_CHARS = 1500
AUDIO_FORMATS = {"mp3": "mp3", "mpeg": "mp3", "mp4": "mp4", "m4a": "mp4", "x-m4a": "mp4", "aac": "mp4", "wav": "wav",
                 "x-wav": "wav", "wave": "wav", "flac": "flac", "ogg": "ogg", "webm": "webm", "amr": "amr"}
_JOB_RE = re.compile(r"^kinbot-[0-9a-f]{32}$")

_clients = {}


def _client(name):
    if name not in _clients:
        _clients[name] = boto3.client(name, region_name=REGION)
    return _clients[name]


def _b64(data, limit):
    raw = base64.b64decode(str(data).split(",", 1)[-1], validate=False)
    if not raw:
        raise ValueError("empty file")
    if len(raw) > limit:
        raise ValueError(f"file is larger than {limit // 1_000_000} MB")
    return raw


def check_image(image_b64):
    """Decode and validate a screenshot upload. Returns the raw bytes."""
    raw = _b64(image_b64, IMAGE_MAX_BYTES)
    if not (raw[:3] == b"\xff\xd8\xff" or raw[:8] == b"\x89PNG\r\n\x1a\n"):
        raise ValueError("send a JPEG or PNG image")
    return raw


def ocr(image_b64):
    """Read the text in a screenshot. Returns {kind, text, lines}."""
    raw = check_image(image_b64)
    r = _client("textract").detect_document_text(Document={"Bytes": raw})
    lines = [b["Text"] for b in r.get("Blocks", []) if b.get("BlockType") == "LINE" and b.get("Text")]
    text = "\n".join(lines).strip()[:2000]
    return {"kind": "ocr", "text": text, "lines": len(lines)}


def speak(text):
    """Read text aloud with a neural voice. Returns {kind, audio (base64 mp3)}."""
    text = re.sub(r"\s+", " ", str(text)).strip()[:SPEAK_MAX_CHARS]
    if not text:
        raise ValueError("nothing to read")
    r = _client("polly").synthesize_speech(Text=text, OutputFormat="mp3", VoiceId="Joanna", Engine="neural")
    audio = r["AudioStream"].read()
    return {"kind": "speech", "audio": base64.b64encode(audio).decode("ascii"), "format": "mp3"}


def voicemail_start(audio_b64, mime):
    """Upload a voicemail and start a Transcribe job. Returns {kind, job}."""
    if not BUCKET:
        raise ValueError("voicemail checking isn't set up")
    sub = str(mime or "").lower().split(";")[0].split("/")[-1]
    fmt = AUDIO_FORMATS.get(sub)
    if not fmt:
        raise ValueError("send an MP3, M4A, WAV, OGG or WebM recording")
    raw = _b64(audio_b64, AUDIO_MAX_BYTES)
    job = "kinbot-" + uuid.uuid4().hex
    key = f"in/{job}.{fmt}"
    _client("s3").put_object(Bucket=BUCKET, Key=key, Body=raw, ServerSideEncryption="AES256")
    _client("transcribe").start_transcription_job(
        TranscriptionJobName=job, LanguageCode="en-US", MediaFormat=fmt,
        Media={"MediaFileUri": f"s3://{BUCKET}/{key}"},
        OutputBucketName=BUCKET, OutputKey=f"out/{job}.json",
    )
    return {"kind": "voicemail", "job": job, "status": "IN_PROGRESS"}


def _cleanup(job):
    s3 = _client("s3")
    for fmt in set(AUDIO_FORMATS.values()):
        try:
            s3.delete_object(Bucket=BUCKET, Key=f"in/{job}.{fmt}")
        except Exception:  # noqa: BLE001
            pass
    for call in (lambda: s3.delete_object(Bucket=BUCKET, Key=f"out/{job}.json"),
                 lambda: _client("transcribe").delete_transcription_job(TranscriptionJobName=job)):
        try:
            call()
        except Exception:  # noqa: BLE001
            pass


def voicemail_status(job):
    """Poll a job. When done, return the transcript and delete everything. Returns {kind, status, text?}."""
    job = str(job)
    if not _JOB_RE.match(job):
        raise ValueError("unknown job")
    j = _client("transcribe").get_transcription_job(TranscriptionJobName=job)["TranscriptionJob"]
    status = j["TranscriptionJobStatus"]
    if status == "COMPLETED":
        body = _client("s3").get_object(Bucket=BUCKET, Key=f"out/{job}.json")["Body"].read()
        d = json.loads(body)
        text = " ".join(t.get("transcript", "") for t in d.get("results", {}).get("transcripts", [])).strip()[:2000]
        _cleanup(job)
        return {"kind": "voicemail", "status": "COMPLETED", "text": text}
    if status == "FAILED":
        _cleanup(job)
        return {"kind": "voicemail", "status": "FAILED", "error": "Couldn't understand the recording."}
    return {"kind": "voicemail", "status": status}
