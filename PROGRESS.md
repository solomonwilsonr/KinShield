# KinShield — Progress Log

_Last updated: 2026-10-02 (§11–§17 cover Oct 1–2). Hackathon: AWS "Zero to Shipped". Deadline: 2026-10-02, 11:59pm PT._
_Category: `#daily-life-enhancement` · Lane: `#startup`._

This document is a complete record of everything built and decided so far, including the account
surprises we hit and how we worked around each one. Account IDs are redacted (`<ACCOUNT_ID>`).

---

## 1. What KinShield is

Delegated fraud-call protection: a caregiver configures it once, for a parent who does nothing. It
detects the *behavior* of a dangerous conversation (impersonation, manufactured emergency, secrecy,
payment escalation, authority pressure, urgency) rather than trying to detect a cloned voice — so it
works even against a perfect voice clone. Output is always cited evidence tied to a fixed 7-signal
taxonomy, never a bare probability.

---

## 2. Current live state (2026-10-02, all on AWS, publicly reachable, no login)

| Thing | Value |
|---|---|
| **Site (current UI)** | S3 static website `http://kinshield-site-<ACCOUNT_ID>.s3-website-us-east-1.amazonaws.com` (HTTP; hostname contains the account id) |
| Pages | `index.html` (hub), `kinvoice.html`, `kinbot.html`, `kinbot-chat.html`, `kinmodel.html` |
| **API (HTTPS)** | `https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com/` — `/health`, `/scenarios`, `/scenario`, `/detect`, `/chat`, `/kinbot` |
| Backend stack | `kinshield-backend` — UPDATE_COMPLETE (last update 2026-10-02, adds voicemail bucket + media permissions) |
| Frontend stack | `kinshield-frontend` — CREATE_COMPLETE |
| Separate experiment | `kinshield-tiny-ml` — UPDATE_COMPLETE (KinShield-Tiny v2, own API, not used by the site) |
| Region | `us-east-1` |
| Detector model | `openai.gpt-oss-20b` via **Bedrock Mantle**, temperature 0, `reasoning_effort: low` |
| Budgets / alarms | **None** (checked 2026-10-02). Cost Explorer shows ~$0 for Sept and Oct. |

Note: until 2026-10-01 the API Gateway origin also served the frontend and was the preferred HTTPS link
(see §8). It now serves only a stale copy of the old pages (the Lambda's `_STATIC` bundle was never
updated for the new pages), so the S3 site is the real one.

---

## 3. Day 0 — AWS connection + Bedrock verification (DONE)

- Confirmed the personal account `<ACCOUNT_ID>` is **standalone** (not in any AWS Organization —
  `organizations describe-organization` → `AWSOrganizationsNotInUseException`).
- **Discovery #1:** classic `bedrock-runtime` Converse/InvokeModel is **hard-blocked** on this
  account (`ValidationException: Operation not allowed`) for every model (Nova, Llama, Claude),
  both credential types (SigV4 IAM user `kiro` + Bedrock API bearer token), both bare and
  `us.`-prefixed inference-profile ids. Ruled out org SCP, model access (models ACTIVE), profile
  format, bearer scope, IAM perms, on-demand capability.
- **Root cause:** the account is provisioned on the **Amazon Bedrock "Mantle"** OpenAI-compatible
  endpoint. Working inference path (Day 0 gate PASSED):
  `POST https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions`,
  `Authorization: Bearer $AWS_BEARER_TOKEN_BEDROCK`.
- Anthropic Claude models on Mantle reject `/v1/chat/completions` and `/v1/responses`, so we use an
  OpenAI-compatible model (`openai.gpt-oss-*`).
- Proof: `docs/proof/day0-bedrock-verification.md`, `day0-capture.log`, plus probe scripts.

---

## 4. Day 1 — Tier 1 core intelligence + reachable demo (DONE)

### Evidence-detector Lambda (`lambda/evidence-detector/handler.py`)
- Calls Mantle with the normative system prompt from `prompt.md` (7-signal taxonomy, weight rubric
  5–30, thresholds LOW 0–24 / MEDIUM 25–59 / HIGH 60+), temperature 0.
- **Server-side hardening in `_normalise()`:** recomputes `risk_score` from evidence weights and
  re-derives `risk_level` from the fixed thresholds (never trusts the model's arithmetic); drops any
  invented signal name outside the fixed 7; **caps a single isolated signal at weight 10** so one
  lone signal can't push a benign call above LOW.
- Retry logic: up to 3 attempts covering malformed JSON *and* transient Mantle HTTP/timeout errors,
  with backoff; 16s per-call timeout so a hung call fails fast enough to retry inside the 40s budget.
- Reads the Bedrock key from **Secrets Manager** (`kinshield/bedrock-api-key`), never hardcoded.

### Infrastructure (`infra/backend.yaml`, deployed via `infra/deploy_backend.sh`)
- Lambda `kinshield-detector` (python3.12, 1024 MB, 40s), code = handler + bundled
  `benchmark/scenarios/*.json` + bundled `web/` frontend, uploaded via `update-function-code`.
- **API Gateway HTTP API** (`$default` route, AWS_PROXY, payload v2.0) — public, no auth.
- **DynamoDB** `kinshield-sessions` (session_id HASH, ts RANGE, PAY_PER_REQUEST) for risk-event log.
- IAM role scoped to `secretsmanager:GetSecretValue` on the key + `dynamodb:PutItem/Query`.
- Routes: `GET /health`, `GET /scenarios`, `GET /scenario?id=`, `POST /detect`
  ({scenario_id | turns | transcript, session_id?}), plus static `/`, `/app.js`, `/styles.css`,
  `/config.js`.

- **Discovery #2:** this account **blocks Lambda Function URLs** (403 at the URL layer for both
  `AuthType: NONE` and IAM-signed requests; request never reaches the function; zero logs; but a
  direct `lambda invoke` works). Fix: front the Lambda with **API Gateway** instead. Recorded in
  `design.md`.

### Frontend (`web/src/`)
- No-login public page: "Try Safe Call" / "Try Scam Call" buttons, scenario picker, live
  turn-by-turn transcript animation, accumulating **risk meter** with MED/HIGH thresholds, cited
  **evidence checklist** (quote + signal + weight + timestamp), a **7-signal taxonomy legend** that
  lights up fired signals, a "Perfect Clone Challenge" framing badge, and a protected-person status
  panel.
- **FamilyVerify** modal: the Tier-3 out-of-band verification flow (VERIFY CALLER / MARK SAFE),
  clearly labelled as simulated for the demo.
- Served same-origin over HTTPS via API Gateway; also mirrored on the S3 website.

---

## 5. Day 2 — benchmark, metrics, dashboard (DONE)

- Expanded benchmark from 6 seed scenarios to **41** (18 scam, 23 benign; now 47, see 9d) via
  `benchmark/generate_scenarios.py`, each individually authored and cited to an FTC/IC3 pattern
  (`benchmark/sources.md`), including deliberately **ambiguous** benign cases (a real $100 plumber
  loan, a "don't tell Dad" birthday-surprise secret, legitimate bank/insurance/Medicare-adjacent
  calls).
- `benchmark/run_benchmark.py` runs the full set against the **live deployed API** and computes
  recall, alarm-level false-positive rate, evidence signal recall, latency (median/p90), and benign
  zero-evidence rate. Results in `benchmark/RESULTS.md` + `benchmark/results/benchmark-latest.json`.

### Latest metrics (gpt-oss-20b, `reasoning_effort: low`)
| Metric | Value |
|---|---|
| Recall (scams flagged MEDIUM/HIGH) | **100%** (18/18) |
| Alarm-level false-positive rate (benign MED/HIGH) | **0%** (0/23) |
| Evidence signal recall (mean over scams) | ~83% |
| Benign scoring LOW | 100% (23/23) |
| Detection latency median / p90 / max | **~0.6s / ~2.1s / ~2.5s** |

---

## 6. Latency optimization (DONE)

- Started on `openai.gpt-oss-120b`: correct but slow (scam calls 8–23s), and long scenarios
  occasionally hit the read timeout even after retries.
- Switched to **`openai.gpt-oss-20b`**: same accuracy (100% recall, 0% alarm FP), more reliable.
- Added **`reasoning_effort: low`** to the Mantle call — gpt-oss spends most of its latency on a
  chain-of-thought trace we discard; minimizing it dropped median latency from ~3.2s to **~0.6s**
  and p90 from ~16s to **~2.1s**, with no loss of risk-verdict accuracy (signal-attribution detail
  dipped slightly, verdicts unchanged).
- Fixed a CloudFormation drift where the `MODEL_ID` env var didn't update on redeploy: the deploy
  script now passes `--parameter-overrides ModelId=...` explicitly.

---

## 7. Calibration / debugging stories (for the write-up)

1. **Benign greeting → impersonation false positive.** "Hi Grandma, it's me" was sometimes tagged
   impersonation. Fix: prompt guardrail that a casual self-identifying greeting alone is not a
   signal. An initial over-correction (forcing impersonation on greetings) caused benign FPs and was
   reverted.
2. **Benign secret → MEDIUM false positive.** "Don't tell Dad about his surprise party" scored 27
   (MEDIUM) because the rubric weights secrecy at 25–30. Fix: a prompt context rule (isolated signal
   = innocent) **plus** a deterministic server-side cap (a lone signal maxes at weight 10 and can't
   alone exceed LOW). Recall stayed 100%.
3. **Function URL 403 mystery** (Discovery #2 above) — diagnosed via direct invoke + log absence.
4. **Bedrock "Operation not allowed"** (Discovery #1) — diagnosed by ruling out every account-
   internal cause, then finding the Mantle endpoint.

---

## 8. Known limitations / honest notes

- **Benchmark is 41, not a literal 100.** Chose curation over padding with near-duplicates.
  Expanding to 50+50 is straightforward via the generator.
- **CloudFront is blocked** — "account must be verified" (Discovery #3). HTTPS is instead provided
  by serving the frontend through API Gateway. CloudFront template (`infra/frontend.yaml`) is ready
  to swap in once the account is verified (needs an AWS Support request from the account owner).
- **S3 website mirror is HTTP-only** and exposes the account id in the hostname — the API Gateway
  HTTPS origin is the preferred public link and hides the account id.
- **Signal-attribution recall ~83%** with fast reasoning (risk verdicts still 100% correct). Can be
  raised by using `reasoning_effort: medium` or gpt-oss-120b at the cost of latency.
- **Tier 2 (real phone / Chime SDK)** not started. **Tier 3 (FamilyVerify)** exists as a simulated
  UI flow, not a live telephony/WebSocket backend.

---

## 9. Files of record

- Spec: `.kiro/specs/kinshield/{requirements,design,tasks}.md` (design.md updated with all 3
  discoveries).
- Detector: `lambda/evidence-detector/handler.py`, `prompt.md`, `local_test.py`.
- Infra: `infra/backend.yaml`, `infra/frontend.yaml` (CloudFront, pending verification),
  `infra/frontend-s3.yaml` (live), `infra/deploy_backend.sh`, `infra/deploy_frontend_s3.sh`.
- Frontend: `web/src/{index.html,app.js,styles.css,config.js}`.
- Benchmark: `benchmark/{generate_scenarios.py,run_benchmark.py,run_deployed.sh,RESULTS.md,sources.md}`,
  `benchmark/scenarios/*.json` (41), `benchmark/results/benchmark-latest.json`.
- Proof: `docs/proof/` — Day 0/1/2 logs, verification docs, and the probe/capture scripts.

---

## 9b. Day 4 — demo-walkthrough UX fixes + brand (DONE, 2026-09-30)

Ran a functional walkthrough of the live demo and fixed the issues it surfaced. All changes are
frontend-only (`web/src/`), redeployed to both origins, and verified live.

- **"Analyzing" state.** While a run is in flight the evidence panel now shows a spinner +
  "Analyzing the conversation on Amazon Bedrock…" instead of the idle "No signals yet" copy, which
  previously looked identical to a *finished* safe call. (`showAnalyzing()` in `app.js`,
  `.evidence-analyzing`/`.ev-spinner` in `styles.css`.)
- **Faster transcript pacing.** Per-turn animation delay is now adaptive
  (`clamp(280ms…900ms)`, ~9s total cap) so long scenarios settle in seconds instead of 30–40s. The
  detector already ran in parallel with the animation; the wall-clock time was the animation, not
  the model.
- **Mid-run clicks.** The call buttons were already disabled during a run; added a `body.is-running`
  class + `cursor:progress` so an ignored click is legible rather than looking broken.
- **Dropdown clarity.** Relabeled the auto option to "Auto — press a button below to start" so it's
  obvious the picker selects and a button starts.
- **Risk score >100.** Left as intended (evidence-weighted; can exceed 100 when signals stack —
  e.g. scam_001 scores 112) and documented it with a tooltip on the score, rather than capping.
- **Logo/brand.** Replaced the header mark and favicon with the KinShield shield-with-two-figures
  logo (dark tile, cream + green figures) as inline SVG (no binary asset; crisp at any size).
- Bumped cache-busters to `?v=20260930-4` on `styles.css` and added a version to `app.js` (it had
  none, so JS updates had been cached).

**Redeploy + live verification (2026-09-30):**
- `deploy_backend.sh` — no template change; new Lambda code (frontend rebundled) uploaded; `/health`
  → 200.
- `deploy_frontend_s3.sh` — 4 files synced to the S3 mirror.
- Confirmed the served HTTPS origin carries `v=20260930-4`, the `ks-shield` logo, `showAnalyzing`,
  and the new CSS.
- Live `/detect` spot-check: scam_001 → HIGH/112 with 5 cited signals (3.6s); benign_001 → LOW/0
  (1.2s); benign_005 (birthday-surprise secret, ambiguous) → LOW/0, no false positive (1.3s).

## 9c. Day 4 (cont.) — advice-text fix + proof audit (2026-09-30)

- **Wrong advice on non-family scams (FIXED, deployed).** A retest found the lottery/gift-card scam
  (scam_011) told the user to "contact a family member on a saved number". `_normalise()` in
  `handler.py` now picks `recommended_action` deterministically from the fired signals: family-member
  advice for impersonation/emergency, "call the official number yourself" for authority pressure,
  generic "don't send money, talk to someone you trust" otherwise. Verified live: scam_011 -> HIGH/85
  with generic advice; scam_001 -> HIGH with family advice. `prompt.md` note updated to match.
  The full 41-scenario benchmark was NOT re-run after this change (scores/levels come from the same
  code path; re-run `benchmark/run_deployed.sh` to confirm).
- **Retest (live, post-`v20260930-4`):** bank scam HIGH (capped at 100 in that run), plumber loan LOW,
  birthday secret LOW, lottery HIGH, Reset OK; 8/8 API calls 200, no console errors. Sampled 4 of 41
  scenarios only; phone-width layout and accessibility still untested. The 30-40s lottery wait seen
  in the retest is unexplained: the API answers in a few seconds, so suspect animation/UI, re-time
  in a browser.
- **Coding-agent proof audit (HONEST STATUS).** CloudTrail sample (50 latest events for IAM user
  `kiro`): 32 from AWS CLI (`aws-cli/2.34.3`), 9 CloudFormation, 9 Lambda service calls. **No events
  via the AWS MCP Server yet.** `aws configure agent-toolkit` does not exist in CLI 2.34.3, and
  `/plugin` is unavailable in the VS Code extension. Proof must be generated via the MCP server
  (Kiro native MCP, or Claude Code with the AWS MCP proxy) and the real `userAgent` reported as-is.
  See `docs/proof/coding-agent-evidence.md`.
- **Agent attribution:** repo history shows Kiro (`.kiro/specs/`, IAM user `kiro`); Day 4 fixes and
  verification were done in Claude Code. The write-up must state which agent did what.

## 9d. Day 4 (cont.) — location check, Hinglish, Learn page (DONE, deployed 2026-09-30)

- **Benchmark grew 41 -> 47** (21 scam, 26 benign) via `benchmark/generate_extra.py`: 2 Hinglish scams
  (scam_019 family-emergency/UPI, scam_020 fake CBI officer), 2 Hinglish benign (benign_024 lunch,
  benign_025 surprise-party hard negative), and a location pair (scam_021 "stuck in London",
  benign_026 son really in London).
- **Re-run on the live API (47):** recall 100% (21/21), alarm-level FP 0% (0/26), benign zero-evidence
  100%, signal recall 82.1%, latency median 650 ms / p90 2376 ms / max 2886 ms. Honest misses: scam_020
  missed `financial_request`; scam_021 missed `impersonation` and `payment_anomaly` (wire) in one run;
  verdicts were still correct. New scenarios are hand-written by us and small in number (4 Hinglish), so
  treat multilingual results as a demonstration, not a measured multilingual benchmark.
- **Location-consistency card (SIMULATED).** Scenarios may carry `claimed_location` and a simulated
  opted-in `trusted_device`; `renderLocationCheck()` in `app.js` shows match / mismatch. It never locates
  the caller and is display-only: the 7-signal taxonomy and the detector are unchanged. The claimed
  location is scenario metadata, not extracted by the model.
- **Learn page** (`web/src/learn.html`, served at `/learn` and `/learn.html`, linked from the header):
  seven mini lessons mapped to the signal taxonomy and six scam patterns taken from sources already in the
  benchmark (FTC / IC3 PSA 231117). No statistics invented. "Blog" = this static page, not a CMS.
- Files touched: `web/src/{index.html,app.js,styles.css,learn.html}`, `lambda/evidence-detector/handler.py`
  (static routes), `infra/deploy_backend.sh` (bundle learn.html), cache-buster `v=20260930-5`.
- Verified live: `/`, `/learn`, `/learn.html` all 200; all 6 new scenarios scored as expected.
- NOT built (roadmap only): KinShield-Tiny trained model (42-step plan), WhatsApp/Instagram/Facebook
  monitoring, Apple Store mock-up, Hugging Face publishing, AI assistant, true multi-language UI.

## 10. What was next on 2026-09-30 (status as of 2026-10-02)

1. Proof of coding-agent connection via the AWS MCP Server — **still not done** (see §17).
2. Builder Center write-up — `docs/WRITEUP.md` updated 2026-10-02; `TODO-USER` items remain.
3. GitHub repo — not published yet.
4. Billing alarm — **still none**.
5. Benchmark re-run, phone-width check, demo video — phone widths checked with Playwright on every
   deploy (390/820/1440); benchmark not re-run since the set grew to 63; no video.

---

## 11. Oct 1 — UI iterations, popups, mascot, Ask Kip chatbot

Full design-by-design log is in `../CLAUDE.md` §17–§23; summary here.

- **Popups:** HIGH-risk intervention alert (top 3 signals with exact quotes, "Verify with family") and a
  one-time intro popup (`localStorage` key `kinshield_intro_seen`).
- **Redesigns:** several themes were tried (warm bento, clear sky, blue board). The shipped look is the
  Figma-first "clear sky" design recoloured to Kip green (`--brand #5EBE6A`, `--brand-deep #23863D`),
  Familjen Grotesk, white page, red only for risk, meadow-photo panels.
- **Kip mascot:** started as a felt plush, then a cartoon shield, a glossy soft-3D version, and finally
  felt again (§16). Cut out locally with PIL/rembg; filenames stayed stable so only cache-busters change.
- **Ask Kip support chatbot:** `POST /chat` in the same Lambda, grounded only in `kb.md` (each `##`
  heading is a citable source; invented sources are dropped). A regex `safety_route` sends "it's
  happening now" / "I already paid" messages to fixed safety cards with no model call. Messages are not
  logged or stored.
- Deploy bug fixed: `cp "$WEB"/*` skipped the new `img/` folder; now `cp -R "$WEB"/.`.

## 12. Oct 1–2 — Learn lessons (built, shipped, then removed)

- An interactive Learn page with 11 lessons (listen → spot the clues → choose → check, up to 3 stars) was
  designed, built and deployed (`../CLAUDE.md` §24).
- **Removed on 2026-10-02 at the user's request** (`../CLAUDE.md` §27). `/learn.html` now returns 404 on
  purpose; `kb.md` headings became "Warning signs" / "After a scam".
- Lesson learned: Playwright screenshots saved in `web/src/` were published by the deploy script. They
  were removed from S3; tests now run from the session scratchpad.

## 13. Oct 2 — KinBot: paste-a-message scam checker

- `POST /kinbot` `mode:"check"`: splits pasted text into sentences, runs the same detector, **drops any
  quote that is not really in the pasted text**, recomputes the score, picks a scam type, and returns
  headline, signs (label + exact quote), steps and the KinShield-Lite score. `mode:"ask"` answers
  follow-up safety questions with the last check as context.
- **KinShield-Lite live:** `lite.py` is a pure-Python port of the TF-IDF + logistic-regression model
  (`lite_model.json`, int8, 119 KB, no numpy). Parity with the sklearn model is within 1e-9 on 52 texts
  (`../kinshield-tiny/tests/test_lite_parity.py`).
- Pages: `kinbot.html` (information only) and `kinbot-chat.html` (the full-screen chat app, restyled from
  a "Qubi" assistant reference). `?example=N` runs an example on load. A welcome popup offers
  "Continue as guest"; **there are no accounts**, and the sign-in buttons only say accounts aren't open.
- Proof: `docs/proof/kinbot-ship-2026-10-02.md`.

## 14. Oct 2 — KinBot investigator agent

- After each verdict the page calls `mode:"investigate"`. `lambda/evidence-detector/agent.py` runs a
  function-calling loop on gpt-oss-20b (≤5 model turns, ≤7 tool calls, 22 s budget, tools in parallel).
- Tools (read-only, standard library): `inspect_link` (RDAP domain age, brand look-alikes, risky TLDs,
  shorteners, IDN), `check_threat_feeds` (OpenPhish community feed, cached 1 h), `visit_page` (a guarded
  static fetch: SSRF checks, ports 80/443, query strings stripped, 400 KB cap, returns features only,
  never page text), `check_phone` (one-ring area codes, 900, toll-free, international) and
  `lookup_guidance` (FTC-based playbook).
- Reliability: tool names leaked as `<|channel|>` are cleaned up; if the model skips a required check,
  a deterministic checklist runs it and the model gets one summary-only turn. Every finding shown
  comes from tool output.
- **Bedrock AgentCore Browser was not used.** This account's concurrent-browser-session quota is 0, and
  raising it needs AWS Support. Never call `visit_page` a browser.
- Eval harness: `eval/kinbot/` (46 synthetic messages, 29 scam / 17 legit). **Only a 2-item smoke run
  exists** (`REPORT.md`); there are no full-set numbers yet.
- Proof screenshot: `docs/proof/kinbot-agent-investigation-2026-10-02.png`.

## 15. Oct 2 — KinShield hub, KinVoice, KinModel; media modes

- KinShield became the umbrella brand. The old call demo moved to `kinvoice.html` (**KinVoice**); a new
  hub `index.html` introduces the three products (layout from a "Gilion" landing page; boards are white).
- **KinModel** (`kinmodel.html`): "Score a message, two ways" calls `/kinbot` check and shows the Lite
  probability next to the Bedrock verdict, plus whether they agree. The results table is copied from
  `../kinshield-tiny/RESULTS.md` along with its caveats.
- **Media modes** (`media.py`, backend deployed 2026-10-02): `ocr` (Textract), `speak` (Polly),
  `voicemail_start` / `voicemail_status` (Transcribe via a short-lived S3 bucket). These are deployed in
  the Lambda but **no page uses them yet**.
- Scenario set grew from 47 to **63** (31 scam, 32 benign; `scam_022`–`031` and `benign_027`–`032`
  added 2026-10-02). The KinVoice picker shows 64 options. **The benchmark has not been re-run on 63.**

## 16. Oct 2 — polish: Kip guide, headlines, logo, photos

- KinVoice demo pacing slowed down so each step can be read; the step guide became Kip with a speech
  bubble and a face per step (happy, thinking, surprised, sad, confused, …).
- The inline "( Kip )" headline treatment is used on the hub, KinVoice, KinBot and KinModel.
- New green arch logo (`img/logo-mark.svg`, also the favicon). The hub's centre card uses the
  "Kip on the train" photo. The felt Kip set replaced the glossy one.
- All checked with Playwright at 1440/820/390: no console errors, no broken images, no horizontal overflow.

## 17. Status on 2026-10-02 and what's left before the deadline (Oct 2, 11:59 pm PT)

**Done:** live site and API, five pages, three products, Ask Kip, investigator agent, Lite model live,
dev logs, proof logs for each deploy (`docs/proof/`).

**Still open (in priority order):**
1. **AWS MCP Server proof.** Every AWS action so far went through the AWS CLI as IAM user `kiro`
   (driven by Kiro, then Claude Code). CloudTrail has no `aws-mcp.amazonaws.com` events. The write-up
   must say exactly this unless MCP evidence is produced.
2. **Choose the public link.** The S3 site is HTTP and its hostname shows the account id. The API
   Gateway HTTPS URL is clean but serves stale pages. Options: update `_STATIC` + `deploy_backend.sh`
   to bundle the new pages, or accept the S3 link. CloudFront is still blocked.
3. **Billing alarm / budget** — none exists. KinBot now makes several Bedrock calls per check
   (detector + 2–5 agent turns), and there is still no rate limiting.
4. Builder Center: publish the write-up, add both tags, resolve `TODO-USER` items.
5. Optional: re-run the benchmark on 63 scenarios, run the full KinBot eval (~92 Bedrock calls), publish
   a GitHub repo (redact account ids in `docs/proof/_*.sh`), record a demo video.
