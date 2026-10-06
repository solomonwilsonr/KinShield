<p align="center">
  <img src="web/src/img/logo-mark.svg" width="96" alt="KinShield logo">
</p>
<h1 align="center">KinShield</h1>
<p align="center"><b>The voice can be perfect. The script still gives the scam away.</b><br>
Scam protection a caregiver sets up once, for a parent who does nothing.</p>
<p align="center">
  <a href="https://kinshield.site"><b>Live app: kinshield.site</b></a> ·
  <a href="docs/guides/kinvoice.md">KinVoice guide</a> ·
  <a href="docs/guides/kinbot.md">KinBot guide</a> ·
  <a href="docs/guides/kinmodel.md">KinModel guide</a> ·
  <a href="docs/guides/ask-kip.md">Ask Kip guide</a> ·
  <a href="#-our-models-on-hugging-face">🤗 Our models on Hugging Face</a> ·
  <a href="#architecture-and-decisions">Architecture diagrams</a>
</p>
<p align="center">
  <img alt="Live on AWS" src="https://img.shields.io/badge/live%20on-AWS-23863D">
  <img alt="Amazon Bedrock" src="https://img.shields.io/badge/Amazon%20Bedrock-gpt--oss--20b-23863D">
  <img alt="No login needed" src="https://img.shields.io/badge/login-not%20needed-5EBE6A">
  <img alt="Category" src="https://img.shields.io/badge/category-daily--life--enhancement-001123">
  <img alt="Lane" src="https://img.shields.io/badge/lane-startup-001123">
</p>
<p align="center">
  <a href="https://huggingface.co/Solomonwilsonr/kinshield-20b"><img alt="Hugging Face: kinshield-20b" src="https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-kinshield--20b-FFD21E"></a>
  <a href="https://huggingface.co/Solomonwilsonr/kinshield-tiny-v3"><img alt="Hugging Face: kinshield-tiny-v3" src="https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-kinshield--tiny--v3-FFD21E"></a>
</p>

![KinShield home page: One family. Two ways to keep watch.](docs/screenshots/hub-hero.jpg)

**Category:** `#daily-life-enhancement` · **Lane:** `#startup` · **Coding agents:** Kiro + Claude Code, both operating the AWS account through the AWS CLI

> Existing scam protection asks whether an unknown caller looks suspicious. KinShield asks whether a trusted conversation has become dangerous.

_Last updated 2026-10-06. Full history: [PROGRESS.md](PROGRESS.md). Long-form write-up: [docs/WRITEUP.md](docs/WRITEUP.md). Coding-agent evidence: [docs/evidence/](docs/evidence/)._

**Contents:** [The gap](#the-gap) · [The products](#the-products) · [Our models on Hugging Face](#-our-models-on-hugging-face) · [How to use KinShield](#how-to-use-kinshield) · [Results](#results-measured-on-the-live-api) · [Architecture](#architecture-and-decisions) · [Proof the coding agents operated AWS](#proof-the-coding-agents-operated-aws) · [Debugging stories](#debugging-stories) · [Who it's for](#who-its-for-and-the-business-model) · [Honest limits](#honest-limits) · [API](#api-kinshield-detector-lambda-behind-api-gateway-http-api) · [Layout and deploy](#layout)

### Quick tour
| If you want to see… | Go to |
|---|---|
| The app working, in 3 minutes | [Quick start](#quick-start-3-minutes) → https://kinshield.site |
| How it's built on AWS (diagrams) | [Architecture and decisions](#architecture-and-decisions) |
| The models we trained and published | [🤗 Our models on Hugging Face](#-our-models-on-hugging-face) |
| Measured results, including the weak ones | [Results](#results-measured-on-the-live-api) · [Honest limits](#honest-limits) |
| Proof the coding agents operated the AWS account | [Proof the coding agents operated AWS](#proof-the-coding-agents-operated-aws) · [docs/evidence/](docs/evidence/) |
| What broke and how we fixed it | [Debugging stories](#debugging-stories) |
| Who would pay, and what's next | [Who it's for and the business model](#who-its-for-and-the-business-model) |

<a href="#architecture-and-decisions"><img src="docs/architecture/architecture-overview.jpg" alt="KinShield architecture on AWS (click for details)"></a>

## The gap
Elder fraud is large and growing. FBI IC3's 2025 report counts more than 201,000 complaints from people over 60 and more than $7.7B lost, up 59%. The grandparent scam follows a known script: a panicked "relative" claims an arrest or accident, asks for secrecy, then asks for payment by wire or gift cards.

Voice cloning makes the voice and caller ID look right. Google and Samsung's on-device Scam Detection is real and shipped. By their own documentation it is opt-in, off by default, and not used on calls from your contacts. It protects the device owner from strangers. It does nothing for a grandparent whose phone shows a trusted number (or a cloned voice) and who will never enable a setting.

KinShield is delegated protection: a caregiver sets it up once, for a parent who does nothing. It detects the *behaviour* of a dangerous conversation (impersonation, manufactured emergency, secrecy, payment escalation, authority pressure, urgency), not the voice, so it works even against a perfect clone. It never gives a bare percentage: every warning quotes the exact words that triggered it.

## The products

KinShield is the umbrella brand. All products share the same seven warning signs and the same rule: **never a bare percentage, always the exact words.** Everything runs on AWS at **https://kinshield.site** with no login.

| | Product | What it does | Try it | Guide |
|---|---|---|---|---|
| 📞 | **KinVoice** | Plays a call turn by turn while Amazon Bedrock re-scores it after every caller line: risk timeline, quoted evidence, a mid-call alert, "Verify with family" and a fraud report. Test your own call too. 63 scripted calls. | [Open](https://kinshield.site/kinvoice-app.html?run=scam) | [KinVoice guide](docs/guides/kinvoice.md) |
| 💬 | **KinBot** | Checks a text, email, **screenshot** or **voicemail**, quotes the warning signs from *your* message, then an **investigator agent** checks every link and phone number. Ask follow-up questions. | [Open](https://kinshield.site/kinbot-chat.html?example=0) | [KinBot guide](docs/guides/kinbot.md) |
| ⚡ | **KinModel** | Our own 119 KB scam model, running inside the Lambda, scores a message next to the Bedrock detector so you can see when they agree. | [Open](https://kinshield.site/kinmodel.html) | [KinModel guide](docs/guides/kinmodel.md) |
| 🙋 | **Ask Kip** | A help widget on the info pages that answers only from a written knowledge base and cites its source. | [Open](https://kinshield.site/) | [Ask Kip guide](docs/guides/ask-kip.md) |
| 🤗 | **Our models** | A QLoRA fine-tune of gpt-oss-20b and a 22.9 MB distilled scam classifier, trained by us and published on Hugging Face. | [kinshield-20b](https://huggingface.co/Solomonwilsonr/kinshield-20b) · [kinshield-tiny-v3](https://huggingface.co/Solomonwilsonr/kinshield-tiny-v3) | [Below](#-our-models-on-hugging-face) |
| 📱 | **Android beta** | KinBot and the KinVoice demo as a native app (sideloaded APK, built after the hackathon deadline). | [Download](https://kinshield.site/#android) | [Below](#android-beta) |

**URLs**
- Site + API (HTTPS): **https://kinshield.site** (also `www.`). An API Gateway regional custom domain with an ACM certificate and Route 53 DNS. The Lambda serves the pages and the API from the same origin.
- Same app on the raw API URL: `https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com`. The older S3 static website (HTTP, account ID in the hostname) is still deployed but isn't linked.
- Separate experiment, not used by the site: KinShield-Tiny v3 (a distilled MiniLM-L6, int8 ONNX) on its own stack `kinshield-tiny-ml`. See `../kinshield-tiny/`.

---

## 🤗 Our models on Hugging Face

We trained two models for KinShield and published both, with model cards, results and usage code. They're research models: **the live app still uses stock gpt-oss-20b on Amazon Bedrock**, for the reasons below.

| Model | What it is | Size | Score on 63 held-out calls | Safe calls flagged |
|---|---|---|---|---|
| **[Solomonwilsonr/kinshield-20b](https://huggingface.co/Solomonwilsonr/kinshield-20b)** | QLoRA adapter on gpt-oss-20b, fine-tuned on an NVIDIA DGX Spark to answer with KinShield's evidence JSON | LoRA rank 16 adapter | **62/63** (stock 20b: 61/63, stock 120b: 62/63) | 0/32 |
| **[Solomonwilsonr/kinshield-tiny-v3](https://huggingface.co/Solomonwilsonr/kinshield-tiny-v3)** | MiniLM-L6 classifier distilled from kinshield-20b: a 0–1 score for each of the 7 warning signs plus High risk | 22M parameters, 22.9 MB int8 ONNX, CPU only | **60/63** (v2, taught by stock 20b: 57/63) | 0/32 |

**How they were made**

![Model pipeline: synthetic calls generated on Bedrock, relabelled by gpt-oss-120b, filtered to 1,201 train / 213 val, QLoRA fine-tune on an NVIDIA DGX Spark, distilled into MiniLM-L6, published to Hugging Face and deployed to the throttled kinshield-tiny-ml stack; results 61/63, 62/63 and 60/63 with 0/32 safe calls flagged](docs/architecture/pipeline-models.jpg)

1. **Data.** gpt-oss-20b on Amazon Bedrock wrote 1,565 synthetic calls: scams, ordinary calls and hard negatives such as "don't tell Dad, it's a surprise party". Near-duplicates of the test calls were removed.
2. **Better labels.** gpt-oss-120b relabelled every call with the live detector prompt. A label was kept only if it matched what the call was written to be (scams MEDIUM or HIGH, safe calls LOW), leaving 1,201 calls for training and 213 for validation.
3. **Fine-tune.** QLoRA on `unsloth/gpt-oss-20b-unsloth-bnb-4bit` (rank 16 on attention and all expert projections, 2 epochs, learning rate 2e-4), with the loss on the answer only.
4. **Distil.** The fine-tuned 20b relabelled the calls, and MiniLM-L6 was trained on those labels. A better teacher lifted the small model from 57/63 to 60/63.

**Try kinshield-tiny-v3 live.** It runs on its own AWS Lambda stack (`kinshield-tiny-ml`, throttled so it can't affect the main app) and answers in about 20 ms when warm:

```bash
curl -s -X POST https://1zuklu0if8.execute-api.us-east-1.amazonaws.com/predict \
  -H 'content-type: application/json' \
  -d '{"transcript":"caller: Grandma, it is me. I got arrested, please do not tell Mom.\ncaller: Buy $2,000 in gift cards and read me the codes."}'
# {"risk_level": "HIGH", "risk_score": 100, "signals": {"impersonation": 0.91, "emergency": 1.0, "secrecy": 0.99, ...}, "latency_ms": 19.85}
```

Or run it yourself (from the [model card](https://huggingface.co/Solomonwilsonr/kinshield-tiny-v3)):

```python
import numpy as np, onnxruntime as ort
from huggingface_hub import hf_hub_download
from tokenizers import Tokenizer

repo = "Solomonwilsonr/kinshield-tiny-v3"
sess = ort.InferenceSession(hf_hub_download(repo, "model.int8.onnx"), providers=["CPUExecutionProvider"])
tok = Tokenizer.from_file(hf_hub_download(repo, "tokenizer.json")); tok.enable_truncation(max_length=256); tok.no_padding()

e = tok.encode("caller: Grandma, it's me. I got arrested, please don't tell Mom.\ncaller: Buy $2,000 in gift cards.")
logits = sess.run(["logits"], {"input_ids": np.array([e.ids], dtype=np.int64),
                               "attention_mask": np.array([e.attention_mask], dtype=np.int64)})[0][0]
print("p_high", float(1 / (1 + np.exp(-logits[7]))))
```

**Why the live app doesn't use them yet**
- kinshield-20b takes about 5 s per call on the Spark, while Bedrock answers in under 1 s, and this AWS account has no GPU quota to host it.
- kinshield-tiny-v3 gives scores, not quoted evidence, and KinShield's rule is to always show the exact words.

**Read the numbers honestly.** The 63 test calls were written by us, and every training label came from an LLM, so the small models learn their teachers' mistakes too. One call is about 1.6 points, so a one-call gap is suggestive, not proof. Full method and raw outputs: `kinshield-tiny/finetune/RESULTS.md` and the two model cards. The in-app **KinModel** is a separate, even smaller model (119 KB TF-IDF + logistic regression) that isn't on Hugging Face.

## How to use KinShield

Everything works in a normal browser at **https://kinshield.site**, with no account, no install and no phone call, on desktop or phone. Below is the short version of each product; every guide has the full step-by-step with a screenshot for each step.

### Quick start (3 minutes)
1. **https://kinshield.site/kinvoice-app.html?run=scam**: a scam call starts straight away. About 30 seconds later the High-risk alert appears.
2. **https://kinshield.site/kinbot-chat.html?example=0**: KinBot checks a "grandson in jail" text, quotes four warning signs, then investigates it.
3. **https://kinshield.site/kinmodel.html**: press **Grandson in jail** and see the small model and the Bedrock detector agree.

### 📞 KinVoice: watch a trusted call turn dangerous
[Full KinVoice guide →](docs/guides/kinvoice.md)

1. **Pick a call** on the **Calls** tab (search, or filter **Scam / Safe / All**), or press **Random scam call**. Optionally press **Family setup** first to name the person you protect and your trusted contacts.
2. **Watch it play.** After each caller line, Bedrock scores the call so far. A greeting scores 0; the score climbs only as warning signs add up. When it crosses your alert level, a push alert appears mid-call, quoting the line that tipped it.

   ![Mid-call: the score jumps to 80 and the caregiver gets a push alert](docs/screenshots/kinvoice-live-toast.jpg)

3. **Read the alert.** At the end of the call you get the three strongest warning signs, each with the caller's exact words.

   ![End-of-call alert with three quoted warning signs](docs/screenshots/kinvoice-alert.jpg)

4. **Verify with family.** Swipe to ping the claimed family member on *their own* phone and answer "Was this you?" (simulated). "No" means hang up and send nothing.
5. **Make a fraud report**, ready to copy or download with links to the FTC, FBI IC3 and the DOJ Elder Fraud Hotline (1-833-372-8311).

   ![The fraud report](docs/screenshots/kinvoice-report.jpg)

6. **Test your own call** on the **Your call** tab: type, speak or paste a conversation, then press **Run through KinVoice**.

### 💬 KinBot: check a message, screenshot or voicemail
[Full KinBot guide →](docs/guides/kinbot.md)

1. **Open KinBot** and press **Continue as guest** (sign-in is optional and only saves a short history).
2. **Paste a message** and press send, or press **Grandson in jail**. You get a verdict with every warning sign quoted from *your* text, and what to do now.

   ![A High-risk verdict with four quoted warning signs](docs/screenshots/kinbot-verdict.jpg)

3. **Kip investigates.** The agent checks each link and phone number (domain age and owner, brand look-alikes, a phishing feed, a safe page fetch, phone-number patterns, FTC advice) and gives a next step.

   ![Kip looked into it: conclusion, next step and checks](docs/screenshots/kinbot-investigate.jpg)

4. **Check a screenshot** (attach, paste or drag an image) or **check a voicemail** (upload or record). A vision model reads the picture and an audio model transcribes the recording, then the same check runs. If the links or the picture fail Kip's checks, the **overall take** raises the verdict.

   ![Overall · High risk for a fake USPS text](docs/screenshots/kinbot-overall.jpg)

5. **Ask a follow-up** in **Ask mode**, for example "Should I reply to them?".

### ⚡ KinModel: a second opinion
[Full KinModel guide →](docs/guides/kinmodel.md)

1. Open **kinmodel.html** and scroll to **Score a message, two ways**.
2. Paste a message or press an example, then press **Score it**.
3. Compare KinModel's probability with the detector's level and quotes, and read whether they agree.

![KinModel 0.98 scam-like next to the detector's High, with quotes](docs/screenshots/kinmodel-score.jpg)

### 🙋 Ask Kip: questions about KinShield
[Full Ask Kip guide →](docs/guides/ask-kip.md)

Press **Questions? Ask Kip** at the bottom right of any info page, pick a common question or type your own, and read the answer with its **Source**. If you say a scam is happening now, or that you already paid, it shows fixed safety steps instead of an AI answer.

<p align="center"><img src="docs/screenshots/askkip-answer.jpg" width="720" alt="Ask Kip answering a pricing question with its source"></p>

### Android beta
The home page's **Android beta** section links a 2.3 MB APK (KinShield Beta 0.1.0) with KinBot, share-to-KinBot, offline KinModel and the KinVoice demo. It's sideloaded, so Play Protect may warn you. It was built after the hackathon deadline and isn't part of the submission.

![Android beta section on the home page](docs/screenshots/hub-android.jpg)

### What is real and what is simulated
| Real (live on AWS) | Simulated (labelled in the UI) |
|---|---|
| Bedrock scoring of every call turn and message | Phone calls: KinVoice plays scripted or typed transcripts, not live audio |
| Quotes checked against your text | "Verify with family" and the location check |
| The investigator agent's tool checks | Push alerts (shown in the page, not sent to a phone) |
| Screenshot reading, voicemail transcription, Polly voice | Pricing (planned, nobody pays) |
| Sign-in and saved history (Cognito + DynamoDB) | Google sign-in (configured but off) |

---

## Results (measured on the live API)

**Call detector, 63 scenarios** (31 scam, 32 safe), run against `https://kinshield.site` on 2026-10-03 05:30 UTC ([benchmark/RESULTS.md](benchmark/RESULTS.md)):

| Metric | Value |
|---|---|
| Scams flagged MEDIUM/HIGH | **93.5% (29/31)** |
| Safe calls raising an alarm | **0% (0/32)** |
| Safe calls with zero evidence | 96.9% (31/32) |
| Evidence-signal recall (mean over scams) | 75.6% |
| Latency median / p90 / max | 798 ms / 2,999 ms / 5,644 ms |

The two misses: `scam_010` scored 24, one point under the MEDIUM line, and `scam_024` scored 18.

**KinBot, 46 messages** (29 scam, 17 legit; [eval/kinbot/REPORT.md](eval/kinbot/REPORT.md)). This is the weaker result, and we show it:

| | Recall | False alarms on legit |
|---|---|---|
| Text check alone | 31% (9/29) | 0/17 |
| Check + agent (danger) | **69% (20/29)** | 1/17 |

The text check is tuned to the family-emergency call script, so it scores many delivery, toll and billing texts LOW. The agent catches 11 of those from their links and phone numbers. That is why KinBot always runs both, and why the overall take can only raise the verdict.

**Fine-tune research, 63 held-out calls** (details in [docs/WRITEUP.md](docs/WRITEUP.md#how-we-trained-the-models)):

| Model | Correct | Safe calls flagged |
|---|---|---|
| gpt-oss-20b, stock (live) | 61/63 | 0/32 |
| gpt-oss-120b, stock | 62/63 | 0/32 |
| gpt-oss-20b + our QLoRA (DGX Spark) | 62/63 | 0/32 |
| KinShield-Tiny v3 (MiniLM-L6, distilled) | 60/63 | 0/32 |

**Read these honestly.** The scenarios were written by us from cited FTC and FBI IC3 patterns (`benchmark/sources.md`), not recorded from real calls, and the prompt was tuned on the same family of scripts. One call is about 1.6 points. They show the system works as designed; they are not field accuracy. The live app still uses stock gpt-oss-20b: the LoRA model takes about 5 s per call, and this account has no GPU quota to host it on AWS.

## Detector output contract (never a bare percentage)
```json
{
  "risk_level": "HIGH",
  "evidence": [
    {"t": "00:04", "quote": "Grandma, it's me.", "signal": "impersonation", "weight": 20},
    {"t": "00:18", "quote": "Don't tell Mom.", "signal": "secrecy", "weight": 30},
    {"t": "00:34", "quote": "Buy gift cards.", "signal": "payment_anomaly", "weight": 30}
  ],
  "risk_score": 80,
  "recommended_action": "End the call. Independently contact the family member using a number you already have saved."
}
```
Signal taxonomy (fixed; each signal is cited to an FTC/IC3 pattern in `benchmark/sources.md`): impersonation, emergency, secrecy, financial_request, payment_anomaly, authority_pressure, unusual_urgency. The server recomputes the score from the weights, re-derives the level (LOW 0–24, MEDIUM 25–59, HIGH 60+), drops unknown signals, caps a lone signal at 10, and picks the recommended action in code.

## Architecture and decisions

### System overview
Everything a user touches runs in one AWS Region (us-east-1) behind **one HTTPS origin, kinshield.site**. Route 53 and ACM front an API Gateway HTTP API. A single Lambda, `kinshield-detector`, serves both the web pages and the API, so there's no CORS and no second hosting service to break. The Lambda calls three models on Amazon Bedrock, plus Polly, Secrets Manager, DynamoDB and CloudWatch, and runs KinModel-Lite in-process. Everything is deployed with CloudFormation by the coding agents through the AWS CLI.

![KinShield architecture on AWS: users, Route 53, ACM, API Gateway, the kinshield-detector Lambda, Bedrock, Secrets Manager, Polly, DynamoDB, CloudWatch, Cognito, the Tiny v3 experiment stack, the legacy S3 site, CloudFormation, Budgets, the read-only internet tools and the build and research tools](docs/architecture/architecture-overview.jpg)

| Layer | Service | Why it's there |
|---|---|---|
| Edge | Amazon Route 53, AWS Certificate Manager, Amazon API Gateway (regional custom domain) | One HTTPS address with no account ID in it. CloudFront was refused on this account ("must be verified"), so API Gateway serves the domain directly. |
| Compute | AWS Lambda `kinshield-detector` (Python 3.12) | Pages + API from one origin; detector, KinBot agent, Ask Kip and KinModel-Lite in one function |
| AI | Amazon Bedrock (Mantle endpoint): gpt-oss-20b, Qwen3-VL 235B, Voxtral Small 24B | Text detection and the agent; reading screenshots; transcribing voicemails |
| Voice | Amazon Polly (neural voice "Joanna") | Reads caller lines aloud in KinVoice |
| Data | Amazon DynamoDB `kinshield-sessions`, `kinshield-history` | Demo events; opt-in check history with a 90-day TTL |
| Identity | Amazon Cognito user pool + API Gateway JWT authorizer | Optional sign-in; only `/history` needs it |
| Secrets & ops | AWS Secrets Manager, Amazon CloudWatch Logs, AWS Budgets | Bedrock API key; logs; a $100/month budget |
| IaC | AWS CloudFormation: `kinshield-backend`, `kinshield-auth`, `kinshield-frontend`, `kinshield-tiny-ml` | Every resource is in a template under `infra/` |

### KinVoice: scoring a call turn by turn
After each caller line, the browser sends the whole call so far to `POST /detect` (at most 6 scores per call). Bedrock returns evidence; the Lambda's `_normalise()` recomputes the score and level in code, so the model's arithmetic is never trusted. When the score crosses the caregiver's alert level, the browser shows a push alert mid-call.

![KinVoice flow: the browser loads a scenario, posts each turn to /detect, the Lambda gets the key from Secrets Manager, calls gpt-oss-20b on Bedrock, normalises the evidence and returns it; a red alert path shows the mid-call push toast; Polly reads caller lines](docs/architecture/flow-kinvoice.jpg)

### KinBot: check, read, investigate
Screenshots go to Qwen3-VL and voicemails to Voxtral. Their text then goes through the same check as a pasted message. The Lambda drops any quote that isn't in the user's text. The investigator agent (gpt-oss-20b function calling, at most 5 turns, 7 tool calls and 22 s) calls five read-only tools, and a deterministic checklist runs any check the model skips. The browser then combines the text verdict, the picture and the agent's findings into **Kip's overall take**, which can raise the verdict but never lower it. Ask mode sends "it's happening now" or "I already paid" messages to fixed safety cards with no model call.

![KinBot flow: text, screenshot or voicemail input; Qwen3-VL and Voxtral on Bedrock; the check with quote verification and KinModel-Lite; the investigator agent with five read-only tools and a deterministic checklist; Kip's overall take; Ask mode with fixed safety cards](docs/architecture/flow-kinbot.jpg)

### Optional sign-in and saved history
Guests get every feature. Signing in uses the Cognito hosted UI (email + one-time code, OAuth code flow with PKCE). Only `GET/POST/DELETE /history` sit behind the JWT authorizer, and DynamoDB stores the level, type, headline, score and date of each check, **never the message**. Google sign-in is configured but turned off.

![Sign-in flow: the browser signs in through the Cognito hosted UI, then calls /history through API Gateway's JWT authorizer to the Lambda and DynamoDB kinshield-history; Google is configured but off](docs/architecture/flow-signin.jpg)

**AWS services used:** AWS Lambda, Amazon API Gateway (HTTP API, custom domain, JWT authorizer), Amazon Bedrock (Mantle endpoint: gpt-oss-20b, gpt-oss-120b for labelling, Qwen3-VL, Voxtral), Amazon Polly, Amazon Cognito, Amazon DynamoDB, AWS Secrets Manager, Amazon Route 53, AWS Certificate Manager, AWS CloudFormation, Amazon CloudWatch, AWS Budgets, and Amazon S3 (the older static site). Amazon Textract and Amazon Transcribe are **not** enabled on this account and aren't used.

**Four decisions:**
1. **Signals over voice.** Voice-clone detection is an arms race. A behavioural taxonomy looks at what a scam script has to make the victim believe and do, which doesn't depend on how good the clone is.
2. **Evidence, never a bare score.** Quoting the line makes a warning actionable. In KinBot the server drops any quote that isn't in the user's own text.
3. **Don't trust the model's arithmetic.** `_normalise()` recomputes the score from the evidence weights, re-derives the level from fixed thresholds, drops unknown signals and caps a lone signal. The recommended action is chosen in code.
4. **The agent may reason but not invent.** Every finding the investigator shows comes from tool output. `visit_page` returns extracted features (forms, password fields, redirects, brand mentions), never page text, so a scam page can't inject instructions. If the model skips a required check, a deterministic checklist runs it. The loop is capped at 5 model turns, 7 tool calls and 22 s, inside API Gateway's 30 s limit.

## Proof the coding agents operated AWS

**Kiro** drove Days 0–2 (Sep 28–30): the spec in [`.kiro/specs/kinshield/`](.kiro/specs/kinshield/) (requirements, design, tasks), account discovery, the first CloudFormation deploys and the first benchmark. **Claude Code** did everything from Sep 30 on: KinBot and its agent, screenshots and voicemail, KinModel, the hub, sign-in, the custom domain, every redeploy, and live checks with Playwright at three screen widths after each deploy. Both ran the AWS CLI as IAM user `kiro`. The full index is [docs/evidence/README.md](docs/evidence/README.md). Account IDs are redacted.

**1. Identity, checked by the agent** ([`readonly-aws-evidence-2026-09-30.log`](docs/evidence/readonly-aws-evidence-2026-09-30.log)):
```
## sts get-caller-identity
{
    "UserId": "<IAM_USER_ID>",
    "Account": "<ACCOUNT_ID>",
    "Arn": "arn:aws:iam::<ACCOUNT_ID>:user/kiro"
}
```

**2. Day 0: the agent found why Bedrock refused every model** ([`day0-capture.log`](docs/evidence/day0-capture.log)):
```
### bedrock-runtime Converse (BLOCKED path) ###
An error occurred (ValidationException) when calling the Converse operation: Operation not allowed

### Mantle /v1/chat/completions (WORKING path) ###
{"choices":[{"message":{"content":"KINSHIELD_OK", ...}}],"model":"openai.gpt-oss-120b", ...}
[http=200]
```

**3. Day 1: the agent deployed the backend stack and tested it live** ([`day1-backend-deploy.log`](docs/evidence/day1-backend-deploy.log)):
```
|  kinshield-backend|  UPDATE_COMPLETE  |  2026-09-29T10:20:08.864000+00:00  |
|  DetectorFunction   |  CREATE_COMPLETE  |  AWS::Lambda::Function           |
|  HttpApi            |  CREATE_COMPLETE  |  AWS::ApiGatewayV2::Api          |
|  SessionTable       |  CREATE_COMPLETE  |  AWS::DynamoDB::Table            |

### public API health ###
{"status": "ok", "service": "kinshield-detector", "model": "openai.gpt-oss-120b"}
[http=200]
### live detect: scam_001 (HIGH) ###
{"risk_level": "HIGH", "risk_score": 120, "evidence": [ ...6 quoted signals... ]}
### live detect: benign_001 (LOW, zero evidence) ###
{"risk_level": "LOW", "risk_score": 0, "evidence": []}
```

**4. CloudTrail: which client made the calls** (same log, 2026-09-30, latest 50 events for user `kiro`):
```
43 events userAgent aws-cli/2.34.3 (AWS CLI, run from the agent's shell)
 7 events userAgent lambda.amazonaws.com (service-initiated)
 0 events with userAgent/sourceIPAddress aws-mcp.amazonaws.com
```
We didn't use the AWS MCP Server and don't claim to.

**5. Day 4: the agent redeployed and checked the live files and API** ([`day4-uxfixes-verify.log`](docs/evidence/day4-uxfixes-verify.log)):
```
=== /detect scam_001 (expect HIGH, cited evidence) ===
[http=200 latency=4.441186s]
risk_level: HIGH score: 126 evidence: 6
=== /detect benign_005 (birthday-surprise secret; expect LOW, no false positive) ===
[http=200 latency=1.796040s]
risk_level: LOW score: 0 evidence: 0
```

**6. Oct 2: KinBot shipped** ([`kinbot-ship-2026-10-02.md`](docs/evidence/kinbot-ship-2026-10-02.md)): Lambda code update, S3 sync, smoke tests and Playwright checks of the live site. Below is the live investigator agent at that time:

![The live KinBot investigator agent checking a suspicious text](docs/evidence/kinbot-agent-investigation-2026-10-02.png)

## Debugging stories
- **Bedrock said "Operation not allowed" for every model.** Converse and InvokeModel failed for Nova, Llama and Claude with every credential type. The agent ruled out SCPs, model access and IAM, then found the account was provisioned on Bedrock's **Mantle** endpoint (OpenAI-compatible, API key as a bearer token). Mantle rejected Anthropic models, so we use `openai.gpt-oss-*`.
- **The Bedrock API key expired during the deadline day.** Every model call returned 401 while `/health` still said "ok". We rotated the key, made `/health` run a real model call, and made any 401/403 clear the cached key so a rotated secret is picked up without a redeploy.
- **The voicemail model translated instead of transcribing.** With a vague prompt, Voxtral turned an English voicemail into German, and a system message made it return HTTP errors. The working prompt sends the audio first, then "same language… do not translate".
- **A birthday secret scored MEDIUM** (secrecy weighs 25–30). The fix was a prompt rule plus a server-side cap on a lone signal. Scam recall didn't change.
- **gpt-oss leaked `<|channel|>` tokens into tool names.** The agent loop cleans the names, and the deterministic checklist covers any check the model skips.
- **AgentCore Browser was planned, and its quota was 0.** The account's browser-session quota is applied at 0 and Service Quotas rejects increases at or below the default, so it needs AWS Support. We built a guarded static fetch instead and describe it as exactly that.
- **Lambda Function URL returned 403 with zero logs, and CloudFront was refused** ("account must be verified"). We put API Gateway in front, and later gave it a custom domain with ACM, which also removed the account ID from the public URL.
- **The account allows only 10 concurrent Lambda executions in total.** The Tiny experiment's stack asked for reserved concurrency and failed. The agent rolled it back and redeployed it behind a throttled HTTP API, so traffic to the experiment can't starve the live detector.
- **Our own deploy once published test screenshots.** The frontend sync uploads everything in `web/src/`. The agent deleted them from S3, and test runs now write to a scratch folder.

## Who it's for and the business model
- **The user is the caregiver, not the parent.** An adult child sets KinShield up once for a parent who changes nothing about their day. That is a different buyer from a device owner protecting themselves, which is who the built-in phone features serve.
- **Planned price:** one plan, **KinShield Family, $5–10 a month per protected person**, covering KinVoice and KinBot. It is labelled "planned · not live" on the site ([kinshield.site/#pricing](https://kinshield.site/#pricing)). Later: a plan for several protected people, and plans for organisations that serve older adults.
- **Where it stands:** pre-launch. No users, no revenue, and no caregiver interviews yet. We make no market-size claim; the claim is the gap above.
- **First users:** a small, consent-based pilot with caregivers of older adults, measuring false alarms, time to the first HIGH alert, and whether the quoted evidence helps a family decide what to do.
- **Roadmap:**
  1. Live calls: a real number through the Amazon Chime SDK, with live transcription feeding the same detector.
  2. Real caregiver push alerts and real family verification (both simulated today).
  3. Better text-scam coverage, since KinBot's 69% recall is the weakest number above.
  4. Evaluation on data we didn't write.
  5. KinModel as an on-device pre-filter or offline fallback, once validated.

## Honest limits
- The test scenarios and KinBot messages were written by us, and the prompt was tuned on the same family of scripts.
- Evidence-signal recall is about 76%: verdicts are mostly right, but individual signals are sometimes missed.
- KinBot catches 69% of the scam texts in our set. Delivery, toll and job-offer scams are its weak spot.
- Everything is text, screenshots or recordings. There is no live telephony, and nothing has been tested on real calls, accents or noisy audio.
- The API has no rate limit, and the account allows 10 concurrent Lambda executions, so heavy simultaneous traffic could see errors.
- No caregivers or parents have tested it yet.
- There is no AWS MCP Server evidence (see above).

## API (`kinshield-detector` Lambda behind API Gateway HTTP API)
| Route | Purpose |
|---|---|
| `GET /health` | Service, model id, and a real model probe (`model_ok`; cached 5 min, 503 if it fails) |
| `GET /scenarios`, `GET /scenario?id=` | KinVoice demo scenarios |
| `POST /detect` | Score a scenario, turns or transcript |
| `POST /chat` | Ask Kip support bot (grounded in `kb.md`, deterministic safety routing) |
| `POST /kinbot` `mode:"check"` | Score pasted text (≤2,000 chars). Quotes not found in the text are dropped. Includes the Lite score. |
| `POST /kinbot` `mode:"ask"` | Follow-up safety question (≤500 chars) |
| `POST /kinbot` `mode:"investigate"` | Investigator agent: a gpt-oss-20b function-calling loop (≤5 turns, ≤7 tools, 22 s budget) over read-only tools `inspect_link`, `check_threat_feeds`, `visit_page` (guarded static fetch, not a browser), `check_phone` and `lookup_guidance` |
| `POST /kinbot` `mode:"screenshot"` | Reads a screenshot with `qwen.qwen3-vl-235b-a22b-instruct` on Bedrock Mantle: visible text, brand, QR code and visual warning signs |
| `POST /kinbot` `mode:"voicemail"` | Transcribes a WAV recording with `mistral.voxtral-small-24b-2507` on Bedrock Mantle |
| `POST /kinbot` `mode:"speak"` | Amazon Polly reads caller lines aloud in the KinVoice demo |
| `POST /kinbot` `mode:"ocr" / "voicemail_start" / "voicemail_status"` | Textract and Transcribe paths in `media.py`. Those services aren't enabled on this account, so no page uses them |
| `GET / POST / DELETE /history` | Saved check history for signed-in users (Cognito JWT authorizer) |

Messages, screenshots and voicemails aren't logged or stored; audio goes straight to the model. Sign-in is optional. Signed-in users get a saved summary of each check (risk level, type, headline, score and date, never the message) in DynamoDB `kinshield-history` for 90 days, and they can delete it from the account view.

## Not built
Real phone calls (Chime SDK PSTN), live audio transcription of calls, caregiver push notifications to a real phone, real family verification (FamilyVerify is simulated), Google sign-in (configured but off), and messaging-app monitoring.

## Layout
```
benchmark/        63 synthetic scenarios (31 scam / 32 benign), generators, runner, RESULTS.md, sources.md
lambda/evidence-detector/
  handler.py      routes, detector, /chat, /kinbot, safety routing, static file server
  agent.py        KinBot investigator agent + tools
  lite.py, lite_model.json   KinShield-Lite (pure-Python int8 scorer)
  media.py        Polly (used); Textract / Transcribe helpers (not enabled on this account)
  prompt.md, kb.md
infra/            CloudFormation templates (backend, frontend-s3, auth) + deploy scripts
web/src/          index, kinvoice, kinvoice-app, kinbot, kinbot-chat, kinmodel pages; kinvoice-app.js, kinbot-app.js, kinbot-guide.js, kinmodel.js, chat.js, guide.js, ui.js; styles
android/          KinShield Beta (Kotlin + Jetpack Compose), built after the deadline
eval/kinbot/      46-message KinBot eval set, runner and REPORT.md
docs/             WRITEUP.md, architecture/ (diagrams), guides/ (step-by-step guide per product), screenshots/, evidence/ (redacted agent + AWS evidence)
.kiro/specs/      Kiro requirements / design / tasks
```

## Deploy
```bash
infra/deploy_backend.sh        # Lambda code (bundles all of web/src/) + backend stack, smoke-tests /health
infra/deploy_frontend_s3.sh    # syncs ALL of web/src/ to the older S3 site (with --delete), smoke-tests index.html
```
Both scripts publish everything in `web/src/`. Keep test screenshots and scratch files out of that folder.
