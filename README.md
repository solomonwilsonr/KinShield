# KinShield

**Category:** `#daily-life-enhancement` · **Lane:** `#startup`

> Existing scam protection asks whether an unknown caller looks suspicious. KinShield asks whether a trusted conversation has become dangerous.

_Last updated 2026-10-03. Full history: [PROGRESS.md](PROGRESS.md). Submission draft: [docs/WRITEUP.md](docs/WRITEUP.md)._

## The gap
Google and Samsung's on-device Scam Detection is real and shipped. By their own documentation it is opt-in, off by default, and not used on calls from your contacts. It protects the device owner from strangers. It does nothing for a grandparent whose phone shows a trusted number (or a cloned voice) and who will never enable a setting.

KinShield is delegated protection: a caregiver sets it up once, for a parent who does nothing. It detects the *behaviour* of a dangerous conversation (impersonation, manufactured emergency, secrecy, payment escalation, authority pressure, urgency), not the voice, so it works even against a perfect clone.

## What is live (all on AWS, no login)

KinShield is the umbrella brand. The site has a hub page and three products, all built on the same seven-signal detector.

| Page | What it does |
|---|---|
| `index.html`: hub | Introduces the three products ("One family. Three ways to keep watch."). |
| `kinvoice.html`: **KinVoice** | Call demo. Plays a scripted call turn by turn. Bedrock scores it live, and the page shows a risk meter, cited evidence, a HIGH-risk alert and a simulated FamilyVerify step. Kip guides each step. 63 scenarios. |
| `kinbot.html` + `kinbot-chat.html`: **KinBot** | Paste a text, email or call script and get a verdict with every warning sign quoted from your own text. Then an **investigator agent** checks links, phone numbers and threat feeds. Ask mode answers follow-up safety questions. |
| `kinmodel.html`: **KinModel** | Scores the same message two ways: KinShield-Lite (a 119 KB int8 TF-IDF + logistic-regression model running inside the Lambda) next to the Bedrock detector, and shows whether they agree. |
| "Ask Kip" chat widget | Support chatbot on the hub/product pages. It answers only from `lambda/evidence-detector/kb.md` and cites its sources. Messages about a scam in progress go to fixed safety cards with no model call. |

**URLs**
- Site + API (HTTPS): **https://kinshield.site** (also `www.`). An API Gateway regional custom domain with an ACM certificate and Route 53 DNS; the Lambda serves the pages and the API from the same origin.
- Same app on the raw API URL: `https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com`. The older S3 static website (HTTP, account ID in the hostname) is still up, but don't link it.
- Separate experiment, not used by the site: KinShield-Tiny v2 (a distilled MiniLM-L6, int8 ONNX) at `https://1zuklu0if8.execute-api.us-east-1.amazonaws.com/predict`. See `../kinshield-tiny/distill/`.

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

## API (`kinshield-detector` Lambda behind API Gateway HTTP API)
| Route | Purpose |
|---|---|
| `GET /health` | Service and model id |
| `GET /scenarios`, `GET /scenario?id=` | KinVoice demo scenarios |
| `POST /detect` | Score a scenario, turns or transcript |
| `POST /chat` | Ask Kip support bot (grounded in `kb.md`, deterministic safety routing) |
| `POST /kinbot` `mode:"check"` | Score pasted text (≤2,000 chars). Quotes not found in the text are dropped. Includes the Lite score. |
| `POST /kinbot` `mode:"ask"` | Follow-up safety question (≤500 chars) |
| `POST /kinbot` `mode:"investigate"` | Investigator agent: a gpt-oss-20b function-calling loop (≤5 turns, ≤7 tools, 22 s budget) over read-only tools `inspect_link`, `check_threat_feeds`, `visit_page` (guarded static fetch, not a browser), `check_phone` and `lookup_guidance` |
| `POST /kinbot` `mode:"screenshot"` | Reads a screenshot with the vision model `qwen.qwen3-vl-235b-a22b-instruct` on Bedrock Mantle: visible text, brand, QR code and visual warning signs |
| `POST /kinbot` `mode:"voicemail"` | Transcribes a WAV/MP3 recording with `mistral.voxtral-small-24b-2507` on Bedrock Mantle |
| `POST /kinbot` `mode:"speak"` | Amazon Polly reads caller lines aloud in the KinVoice demo |
| `POST /kinbot` `mode:"ocr" / "voicemail_start" / "voicemail_status"` | Textract and Transcribe paths in `media.py`. Those services aren't enabled on this account, so no page uses them |
| `GET / POST / DELETE /history` | Saved check history for signed-in users (Cognito JWT authorizer) |

Messages, screenshots and voicemails aren't logged or stored; audio goes straight to the model. Sign-in is optional. Signed-in users get a saved summary of each check (risk level, type, headline, score and date, never the message) in DynamoDB `kinshield-history` for 90 days, and they can delete it from the account view.

## Stack (what is actually deployed)
- **Detection:** Amazon Bedrock via the **Mantle** OpenAI-compatible endpoint, model `openai.gpt-oss-20b`, temperature 0, `reasoning_effort: low`. The classic `bedrock-runtime` Converse API is blocked on this account (see PROGRESS §3). There is no fine-tuned LLM.
- **Models on Mantle:** `qwen.qwen3-vl-235b-a22b-instruct` (screenshots) and `mistral.voxtral-small-24b-2507` (voicemails). Amazon Textract and Amazon Transcribe aren't enabled on this account and aren't used.
- **Backend:** one Lambda (Python 3.12) + API Gateway HTTP API; DynamoDB `kinshield-sessions` and `kinshield-history`; Secrets Manager for the Bedrock API key; Amazon Polly for the demo voice; Amazon Cognito user pool for optional sign-in (email; Google is configured but off).
- **Frontend + domain:** the Lambda serves the pages and the API from one origin at https://kinshield.site (API Gateway regional custom domain, ACM certificate, Route 53). The older S3 static website (`kinshield-frontend` stack) is still deployed but isn't linked. CloudFront is blocked until the account is verified.
- **IaC:** CloudFormation (`infra/backend.yaml`, `infra/frontend-s3.yaml`, `infra/auth.yaml`), deployed with `infra/deploy_backend.sh` and `infra/deploy_frontend_s3.sh`.
- **Coding agents:** Kiro (spec in `.kiro/specs/kinshield/`, Day 0–2) and Claude Code (Day 4 onward), both running the AWS CLI as IAM user `kiro`. They didn't use the AWS MCP Server. Redacted deploy logs, live checks and a CloudTrail summary are in [`docs/evidence/`](docs/evidence/).

## Not built
Real phone calls (Chime SDK PSTN), live audio transcription of calls, caregiver push notifications, real family verification (FamilyVerify is simulated), Google sign-in (configured but off), and messaging-app monitoring.

## Layout
```
benchmark/        63 synthetic scenarios (31 scam / 32 benign), generators, runner, RESULTS.md, sources.md
lambda/evidence-detector/
  handler.py      routes, detector, /chat, /kinbot, safety routing
  agent.py        KinBot investigator agent + tools
  lite.py, lite_model.json   KinShield-Lite (pure-Python int8 scorer)
  media.py        Polly (used); Textract / Transcribe helpers (not enabled on this account)
  prompt.md, kb.md
infra/            CloudFormation templates + deploy scripts
web/src/          index, kinvoice, kinvoice-app, kinbot, kinbot-chat, kinmodel pages; kinvoice-app.js, kinbot-app.js, kinmodel.js, chat.js, guide.js, ui.js; styles
eval/kinbot/      46-message KinBot eval set + runner (only a 2-item smoke run so far)
docs/             WRITEUP.md, evidence/ (redacted agent + AWS evidence)
.kiro/specs/      Kiro requirements / design / tasks
```

## Deploy
```bash
infra/deploy_backend.sh        # Lambda code + backend stack, smoke-tests /health
infra/deploy_frontend_s3.sh    # syncs ALL of web/src/ to S3 (with --delete), smoke-tests index.html
```
`deploy_frontend_s3.sh` publishes everything in `web/src/`. Keep test screenshots and scratch files out of that folder.
