# KinShield: it doesn't ask if the caller sounds fake. It asks if the call has turned dangerous.

**Category:** `#daily-life-enhancement` · **Lane:** `#startup`

**Live app:** https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com (no login needed)

---

## The problem

Elder fraud is large and getting worse. FBI IC3's 2025 report counts more than 201,000 complaints from people over 60 and more than $7.7B lost, up 59%. The grandparent scam follows a documented pattern: a panicked "relative" claims an arrest or accident, asks for secrecy, then asks for payment by wire or gift cards.

Voice cloning makes the voice and caller ID look right. Google and Samsung ship on-device scam detection, but by Google's support documentation it is opt-in, off by default, and not used on calls with your contacts. That does little for a grandparent who will never open a settings menu, on a call that shows a trusted number.

KinShield asks a different question. Not "does this caller sound real?" but "is this conversation trying to make someone believe and do something dangerous?"

## What it does

One detector, three ways to use it. Everything sits on a fixed seven-signal taxonomy: impersonation, emergency, secrecy, financial_request, payment_anomaly, authority_pressure and unusual_urgency. Every signal comes with the exact quote, a timestamp and a weight. You never get a bare percentage.

- **KinVoice: watch a trusted call turn dangerous** (`kinvoice-app.html`). A scripted call plays while Amazon Bedrock re-scores it after each caller turn (at most 6 calls per call). A risk timeline plots every scored turn against the MEDIUM and HIGH lines, a toast fires mid-call the moment the score crosses the caregiver's alert level, and the end of the call brings an alert with the strongest quotes and a "Verify with family" step. **Test your own call** lets you type, dictate or paste a conversation. A **fraud report** (copy or .txt) lists the caller's claim, money asks with timestamps, every quoted sign, and the FTC, IC3 and DOJ Elder Fraud Hotline (1-833-372-8311) contacts. Family setup stores names, trusted contacts and an alert level in the browser. Polly can read the caller's lines aloud. There are 63 scenarios, including hard negatives.
- **KinBot: paste a text, email or script, or drop a screenshot or voicemail.** You get a verdict where every warning sign is quoted from *your* text. Screenshots are read by a vision model (Qwen3-VL 235B) and voicemails transcribed by an audio model (Voxtral), both on Bedrock Mantle, then checked the same way. The **Investigate** step runs an agent over the links and phone numbers: domain age, brand look-alikes, a phishing feed, a guarded page fetch and phone-number patterns. Its "overall take" can raise the verdict, never lower it. Ask mode answers follow-up safety questions.
- **KinModel: two opinions on one message.** KinShield-Lite is a 119 KB int8 model that runs inside the Lambda without calling Bedrock. It scores the message next to the Bedrock detector, and the page shows whether they agree.
- **Ask Kip:** a help widget on the info pages that answers only from a written knowledge base and cites its source. If someone says a scam is happening right now, or that they already paid, it skips the model and shows a fixed safety card.

Planned pricing is one plan, KinShield Family at $5–10 a month per protected person, covering KinVoice and KinBot. It is labelled "planned · not live" on the site; nobody pays today.

```json
{
  "risk_level": "HIGH",
  "evidence": [
    {"t": "00:04", "quote": "Grandma, it's me.", "signal": "impersonation", "weight": 20},
    {"t": "00:27", "quote": "I need $4,000.", "signal": "financial_request", "weight": 20},
    {"t": "00:34", "quote": "Buy gift cards.", "signal": "payment_anomaly", "weight": 30}
  ]
}
```

That example is abridged; the API also returns `risk_score` and `recommended_action`. Risk builds as evidence compounds. A greeting alone is nothing. A greeting plus a made-up emergency plus a gift-card request is HIGH. KinShield never inspects audio, so a perfect voice clone doesn't help the scammer.

## Try it

Open the live link. You don't need to sign up or make a phone call.
1. **KinVoice:** press **Try scam call** or **Try safe call**, or pick a scenario. A scam run takes about 30 seconds.
2. **KinBot:** open the chat and press an example (`kinbot-chat.html?example=0` runs the grandparent text), or paste your own message.
3. **KinModel:** score any message both ways.

FamilyVerify and the location card are simulated and labelled that way in the UI. The KinBot welcome popup's sign-in buttons are placeholders: there are no accounts, and "Continue as guest" is the real path.

## The finding: the verdict held, the evidence detail did not

There is no public corpus of real scam-call transcripts, so we wrote our own scenarios. Each is a synthetic script mapped to a cited FTC/IC3 pattern (`benchmark/sources.md`). The benign set includes hard negatives: a real $100 loan for a plumber, a "don't tell Dad" birthday-surprise secret, legitimate bank and insurance calls, and a pair where a son really is in London. Four are Hinglish, which is a demonstration, not a multilingual benchmark.

Measured run against the live deployed API, on the first 47 scenarios (21 scam, 26 benign):

| Metric | Result |
|---|---|
| Scams flagged MEDIUM/HIGH | 100% (21/21) |
| Benign calls raising a MEDIUM/HIGH alarm | 0% (0/26) |
| Benign calls with zero fabricated evidence | 100% |
| Mean evidence-signal recall on scams | 82.1% |
| Latency median / p90 / max | 650 ms / 2,376 ms / 2,886 ms |

Here is the honest version. Verdicts were right on every scenario, but the model missed individual signals. `scam_020` (a fake CBI officer) missed `financial_request`. `scam_021` missed `impersonation` and the wire `payment_anomaly` in one run. On `gpt-oss-120b` with full reasoning, signal recall was about 92%, but median latency was about 3.3 s and p90 about 19 s, with occasional timeouts. Switching to `gpt-oss-20b` with `reasoning_effort: low` cut median latency roughly 5x and left every verdict unchanged. One caveat: the set is small and we wrote it, so read 100%/0% as "no failures on this set", not as field accuracy. The set has since grown to 63 scenarios (31 scam, 32 benign), and we have **not** re-run the benchmark on the larger set.

## The KinBot agent: findings must come from tools

An LLM that "investigates a link" can easily invent a finding. We built the agent so it can't:

- **Quotes are checked against the text.** In check mode, the server drops any quote that isn't really in the pasted message, then recomputes the score.
- **Findings come only from tool output.** The model (gpt-oss-20b, OpenAI-style function calling on Bedrock Mantle) chooses which tools to run and writes the summary and the next step. Every finding line on screen comes from a tool result.
- **Pages are read for features, not text.** `visit_page` returns extracted features (forms, password fields, redirects, brand mentions), never page text, so a scam page can't inject instructions. It is a guarded static fetch, not a browser. It connects only to checked public IPs on ports 80/443, re-checks every redirect, strips query strings so tracking tokens don't fire, and caps downloads at 400 KB.
- **The checklist runs even if the model skips it.** If the model skips a required check, a deterministic checklist runs it (the trace shows "checklist"), and the model gets one summary-only turn. The loop is bounded at 5 model turns, 7 tool calls and 22 s, so it finishes before API Gateway's 30 s limit.

In local runs, a fake-Chase text came back as *danger* (impersonation, unregistered domain), and the grandparent text pointed to the gift-card guidance. A real pharmacy text came back *ok* ("real website, 31 years old") and was not called a scam. We built a 46-message eval set (`eval/kinbot/`) but have only run a 2-item smoke test, so we quote no rates for the agent.

## How we trained the models

The live detector is **stock gpt-oss-20b on Amazon Bedrock**. We did not fine-tune it. Everything below is either a small model running beside it or a research experiment. None of the training data comes from real calls: every transcript was written either by us or by an LLM.

| Model | What it is | Trained on | Where it runs |
|---|---|---|---|
| KinShield-Lite (shown as KinModel) | TF-IDF + logistic regression, int8 | 600 template texts | Inside the live Lambda |
| KinShield-Tiny v2 | MiniLM-L6 (22M), distilled from stock 20b | 1,565 LLM-written transcripts | Its own Lambda stack, not used by the site |
| kinshield-20b (LoRA) | QLoRA adapter on gpt-oss-20b | 1,201 filtered transcripts | DGX Spark only, not hosted |
| KinShield-Tiny v3 | MiniLM-L6, distilled from the LoRA 20b | Same 1,565 transcripts, relabelled | Its own Lambda stack, not used by the site |

**Test set for all of them:** hand-written benchmark calls that no model trained on. That's 47 calls for Lite and v2, and 63 calls (31 scams, 32 safe) once we added 16 more.

### 1. KinShield-Lite: a cheap second opinion

Every detector call is a live Bedrock invocation, so we wanted a check that costs nothing.

- **Data:** 600 synthetic texts (300 scam, 300 safe), built from phrase banks with a fixed seed.
- **Features:** word 1–2-grams plus character 3–5-grams (`char_wb`), both TF-IDF with sublinear term frequency.
- **Classifier:** logistic regression with balanced classes. We chose C=2 from a sweep of 0.5–8, then added sigmoid (Platt) calibration.
- **Export:** weights quantised to int8 (one scale factor, ±127) in a 119 KB JSON file. `lite.py` reimplements both analyzers in pure Python, needs no numpy, and matches sklearn within 1e-9 on 52 texts.
- **Result:** 46 of 47 benchmark calls right, with one false positive (`benign_019`). This number is **optimistic**: we wrote the phrase banks after reading the benchmark. KinModel shows Lite beside the LLM to flag disagreement, never to override it.

### 2. KinShield-Tiny v2: distilling the detector

- **Generate:** gpt-oss-20b on Bedrock wrote 1,568 calls of 2–14 turns in English and Hinglish: scams, ordinary calls, and "hard negatives" (for example "don't tell Dad, it's a surprise party").
- **Clean:** we removed 3 near-duplicates (char-n-gram cosine ≥ 0.6). We also checked that no transcript came within 0.45 cosine of a test call; the closest was 0.40.
- **Label:** the live detector prompt labelled every call (LOW 941, MEDIUM 319, HIGH 305).
- **Train:** `all-MiniLM-L6-v2` with 8 sigmoid heads (7 warning signs plus HIGH risk), mean pooling, 256 tokens, 15 epochs at learning rate 8e-5. Model and epoch selection used the validation split (15%) only.
- **A second round:** round 1 learned almost nothing about secrecy, because only 17 training rows had it. We generated a targeted batch of secrecy scams with matching secrecy hard negatives. Validation score went from 1.29 to 1.55. Because the test result prompted that round, treat v2's test numbers as slightly optimistic.
- **Ship:** exported to int8 ONNX (22.9 MB) on an arm64 Lambda. Warm calls take about 75 ms.
- **Result:** 44/47, precision 1.00, recall 0.86, with no safe call flagged. It missed a Hinglish UPI scam.

### 3. Fine-tuning gpt-oss-20b on a DGX Spark

- **Better labels:** gpt-oss-120b on Bedrock (reasoning medium) relabelled all 1,565 transcripts with the live detector prompt.
- **Intent filter:** we kept a label only if it agreed with what the call was written to be (scams MEDIUM or HIGH, safe calls LOW). It used the 120b label first and the 20b label as a fallback. We dropped the 151 calls where neither model agreed, leaving 1,201 for training and 213 for validation.
- **QLoRA:** `unsloth/gpt-oss-20b-unsloth-bnb-4bit` on an NVIDIA DGX Spark (GB10, about 19 GB used).
  - LoRA rank 16 on attention and all expert projections
  - 2 epochs, learning rate 2e-4, cosine schedule
  - loss on the answer only, written straight to the harmony `final` channel with no reasoning text

  It took 90 minutes, and validation loss went 0.049 → 0.035.
- **Distil again:** the fine-tuned 20b relabelled the transcripts, and we retrained MiniLM on those labels with v2's settings to get **Tiny v3**.

| Model (63 held-out calls) | Correct | Safe calls flagged |
|---|---|---|
| gpt-oss-20b, stock (live) | 61/63 | 0/32 |
| gpt-oss-120b, stock | 62/63 | 0/32 |
| **gpt-oss-20b + KinShield LoRA** | **62/63** | 0/32 |
| Tiny v2 | 57/63 | 0/32 |
| **Tiny v3** | **60/63** | 0/32 |

Distilling from the better teacher lifted the small model from 57 to 60.

**Why the app still uses stock 20b:**
- The LoRA model takes about 5 s per call on the Spark. Bedrock answers in under 1 s.
- This account has 0 GPU quota on EC2 and SageMaker, so the LoRA model can't be hosted on AWS.
- Tiny outputs scores, not quoted evidence, which breaks our "cite the exact words" rule.

**Limits:**
- The test set is small and was written by us. One call is about 1.6 points of accuracy, so a 1-call gap is suggestive, not proof.
- The labels come from LLMs, so the small models learn the teachers' mistakes too.

Method and raw outputs are in `kinshield-tiny/finetune/RESULTS.md` and `kinshield-tiny/distill/RESULTS.md`. The models are published as [kinshield-20b](https://huggingface.co/Solomonwilsonr/kinshield-20b) and [kinshield-tiny-v3](https://huggingface.co/Solomonwilsonr/kinshield-tiny-v3).

## Architecture and decisions

- **Detector and APIs:** one AWS Lambda (Python 3.12) behind an API Gateway HTTP API. Routes are `/detect`, `/chat` and `/kinbot` (check, ask, investigate), plus `/health` and the scenarios. The Lambda calls Amazon Bedrock through the **Mantle** OpenAI-compatible endpoint with `openai.gpt-oss-20b`, temperature 0. The API key lives in **AWS Secrets Manager**, and **DynamoDB** stores demo risk events.
- **Site:** five static pages on an **S3** website, deployed as two **CloudFormation** stacks (`kinshield-backend`, `kinshield-frontend`) by scripts in `infra/`.
- **Also deployed:** Textract, Polly and Transcribe helpers for screenshots, read-aloud and voicemail. They're in the Lambda but not yet used by any page, so we don't count them as features.
- **Not built:** real phone calls (Chime SDK PSTN), live call transcription, caregiver push and accounts. The ship gate needs a public URL that works without a phone, so the scripted web demo came first.

Three decisions:

1. **Signals over voice.** Voice-clone detection is an arms race. A behavioural taxonomy looks at what a scam script has to make the victim believe and do, which doesn't depend on how good the clone is.
2. **Evidence contract, never a bare score.** Quoting the line makes the warning actionable, and in KinBot the quotes are checked against the user's own text.
3. **Don't trust the model's arithmetic.** On the server, `_normalise()` recomputes `risk_score` from the evidence weights and re-derives the level from fixed thresholds (LOW 0–24, MEDIUM 25–59, HIGH 60+). It also drops any signal outside the seven and caps a lone signal at weight 10. The recommended action is chosen from the fired signals in code.

## How the coding agents shipped this

**Kiro** drove Day 0–2: the spec in `.kiro/specs/kinshield/`, the account discovery, the first deploys and the benchmark. **Claude Code** did everything from Day 4 on: UX fixes, KinBot and its agent, KinModel, the hub, every redeploy, and live verification with Playwright at three screen widths after each deploy. Both operated the account through the AWS CLI as IAM user `kiro`. They ran stack deploys, Lambda code updates, S3 syncs, CloudWatch reads, Service Quotas checks (the AgentCore quota) and a cleanup of files published by mistake.

The evidence is plain text in `docs/proof/`, with the account ID redacted:
- `day0-bedrock-verification.md`: identity and the Bedrock investigation
- `day1-backend-deploy.log`, `day1-frontend-live.log`
- `readonly-aws-evidence-2026-09-30.log`: `sts get-caller-identity`, stack statuses, Lambda config
- `day4-uxfixes-verify.log`
- `kinbot-ship-2026-10-02.md`: KinBot backend and frontend deploys, live Playwright results, Lite parity
- `kinbot-agent-investigation-2026-10-02.png`
- `../kinshield-tiny/distill/docs/proof/deploy-log.md`: a failed stack, its rollback and the fix

**What we can and cannot show.** CloudTrail shows these calls coming from `aws-cli`, and **none through the AWS MCP Server**. We therefore make no claim of MCP-based operation.

## Debugging stories

- **Bedrock said "Operation not allowed" for every model.** Converse and InvokeModel failed for Nova, Llama and Claude, with every combination of credentials and model ID. We ruled out an SCP, model access and IAM. The account turned out to be provisioned on Bedrock's Mantle endpoint (`bedrock-mantle.us-east-1.api.aws/v1/chat/completions`, with the API key as a bearer token). Mantle rejected Anthropic models, so we use `openai.gpt-oss-*`.
- **Lambda Function URL returned 403** with zero logs, while a direct invoke worked. We put API Gateway in front instead. **CloudFront was refused** ("account must be verified"), so the site runs on S3.
- **A birthday secret scored MEDIUM** (27, because secrecy weighs 25–30). The fix was a prompt rule plus a server-side cap on a lone signal. Recall stayed at 100%.
- **The account has only 10 concurrent Lambda executions, shared by everything.** The Tiny-v2 stack asked for 5 reserved and failed with `CREATE_FAILED … NotUpdatable`. The agent rolled it back and redeployed behind a throttled HTTP API (burst 3, 3 rps), so a flood on the experiment can't starve the live detector.
- **We planned to use AgentCore Browser, and the quota was 0.** This account's concurrent-browser-session quota is applied at 0, and Service Quotas rejects any increase request at or below the default, so raising it needs AWS Support. We built a guarded static fetch instead, and we describe it as exactly that.
- **gpt-oss leaked `<|channel|>` tokens into tool names.** The agent cleans the names up, and if the model skips a required tool, the checklist runs it.
- **Our own deploy published test screenshots.** The frontend sync uploads everything in `web/src/`, including five Playwright screenshots. The agent deleted them from S3, and tests now write to a scratch folder.

## Honest limits

- The scenarios are written by us, and the prompt was tuned on the same family of scripts. The measured benchmark covers 47 of the 63 scenarios.
- Evidence-signal recall is about 82%. Verdicts were right on the measured set, but individual signals are sometimes missed.
- KinBot and the agent have no measured accuracy yet: the eval set exists, but only a smoke run has been done.
- The Lite and Tiny-v2 numbers come from synthetic data and the same 47 scripts. Read them as smoke tests.
- Everything is text only. Nothing has been tested on real audio, accents or noisy calls, and there is no live telephony.
- The site is served over HTTP from S3, without a CDN. There is no rate limiting, and a KinBot check costs several Bedrock calls.
- No caregivers or parents have tested it yet.
- There is no AWS MCP Server evidence (see above).

## Why `#daily-life-enhancement` and `#startup`

KinShield makes an everyday thing safer: answering the phone, or reading a text. A caregiver sets it up once, and the parent changes nothing about their day. It's in the startup lane because it is aimed at a product, not at a group we belong to. KinShield is pre-launch, with no users and no revenue, and the site labels its pricing as planned. The claim is about a gap, not a market size. The big shipped detectors are opt-in and skip your contacts, and a caregiver acting for a parent is a different buyer from a device owner acting for themselves. We have not interviewed caregivers or run a pilot. The first-user plan is a small, consent-based pilot with caregivers of older adults, measuring false alarms, time-to-first-HIGH, and whether evidence quotes help families decide what to do.

## What's next

1. **Live calls:** a real number through the Amazon Chime SDK, with Amazon Transcribe feeding the same detector.
2. **Wire up the media modes already in the Lambda:** screenshot a text (Textract), hear the verdict read aloud (Polly), check a voicemail (Transcribe).
3. **Caregiver push and real family verification.** Today these are simulated in the UI.
4. **Measure:** the full benchmark on 63 scenarios, the KinBot eval, and time-to-first-HIGH per call.
5. **KinModel as a pre-filter or offline fallback**, but only after we validate it on data we didn't write.

---

Builder Center tags should be `#daily-life-enhancement` and `#startup` (the picker may show `startups`). Keep account IDs and ARNs redacted in attached evidence, and do not publish `docs/proof/_*.sh` because several contain the raw account ID.
