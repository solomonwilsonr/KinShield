# KinShield -- Design

## CRITICAL: read this before touching AWS
The AWS CLI `default` profile on this machine belongs to a work-managed AWS Organization
(Sirius Cloud Services, Control Tower). Bedrock control-plane calls work on it, but ALL Bedrock
inference calls (Converse, InvokeModel) return `ValidationException: Operation not allowed` on
every model and every region tried, despite full AdministratorAccess IAM -- this is an
Organization-level Service Control Policy, not fixable from inside the account. DO NOT build
against the `default` profile. Confirm which AWS CLI profile points at the user's PERSONAL account
(ask the user if unclear -- do not assume) and use that profile for every AWS action, IaC deploy,
and the proof-of-connection evidence. Verify with a real `bedrock-runtime converse` call before
building anything further; if it fails the same way, stop and tell the user, don't work around it.

## UPDATE 2026-09-28: verified deviation -- account is on the Bedrock Mantle endpoint
Day 0 verification (see `docs/proof/day0-bedrock-verification.md`) proved the personal account is
standalone (no org, so no SCP) yet the classic `bedrock-runtime` Converse/InvokeModel path is
hard-blocked (`ValidationException: Operation not allowed`) for every model and both credential
types. Root cause: the account is provisioned on the **Amazon Bedrock Mantle** OpenAI-compatible
endpoint. The resolved, verified-working inference path is therefore:
- `POST https://bedrock-mantle.<region>.api.aws/v1/chat/completions`
- Auth: Amazon Bedrock API key as `Authorization: Bearer <token>` (stored in Secrets Manager for
  the Lambda; never committed, never hardcoded).
- Model: **`openai.gpt-oss-120b`** (open-weight, OpenAI Chat Completions compatible). Anthropic
  Claude models on Mantle rejected both `/v1/chat/completions` and `/v1/responses`, so an
  OpenAI-compatible model is used instead. Temperature 0 preserved for deterministic extraction.
- Note: `openai.gpt-oss-*` returns a `reasoning` field and consumes output tokens on it -- set a
  generous `max_tokens` so the JSON `content` isn't truncated.
The `prompt.md` system prompt is model-agnostic, so the detector contract (7-signal taxonomy,
weights, thresholds, strict JSON) is unchanged; only the transport and model differ from the
original Converse + `us.`-profile plan below.

Second verified deviation (2026-09-29): this account also **blocks Lambda Function URLs entirely**.
A public (`AuthType: NONE`) Function URL returned 403 with a correct-looking resource policy, and so
did an IAM-signed request to the same URL, while direct `lambda invoke` succeeded and the function
logged nothing -- i.e. the 403 happens at the Function URL layer before the request reaches the
function. Resolution: front the Lambda with an **API Gateway HTTP API** (`$default` route,
AWS_PROXY, payload format 2.0), which IS permitted and is publicly reachable with no auth. Live
public endpoint verified returning 200. See `docs/proof/day1-backend-deploy.log`.

## Architecture

```
                    ┌──────────────────────┐
Browser (no login)  │  S3 + CloudFront      │
"Try Safe/Scam Call" │  static frontend      │
                    └──────────┬────────────┘
                               │ HTTPS
                               ▼
                    ┌──────────────────────┐
                    │ API Gateway / Lambda  │
                    │ Function URL          │
                    └──────────┬────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                     ▼
  ┌───────────────┐   ┌────────────────┐   ┌──────────────────┐
  │ Scenario player│   │ Evidence       │   │ DynamoDB          │
  │ (scripted      │──▶│ detector       │──▶│ session/risk      │
  │  transcript)   │   │ Lambda+Bedrock │   │ event history      │
  └───────────────┘   └────────────────┘   └──────────────────┘
                               │
                               ▼ (Tier 3, stretch)
                    ┌──────────────────────┐
                    │ WebSocket push to     │
                    │ caregiver dashboard   │
                    └──────────────────────┘

Tier 2 (real phone, build after Tier 1 is solid):

Phone call ──▶ Amazon Chime SDK PSTN inbound (CreateMeeting/CreateAttendee
               on NEW_INBOUND_CALL) ──▶ Amazon Transcribe (streaming)
               ──▶ same evidence-detector Lambda ──▶ same dashboard
```

Reference implementations that already do most of this (use them, don't reinvent):
- `aws-samples/chime-voiceconnector-agent-assist` -- live Voice Connector + agent-assist ML.
- AWS's "Live Call Analytics with Agent Assist" sample -- Kinesis Video Streams + streaming
  Transcribe + Bedrock-powered assist. Closest match to Tier 2's needs.

## Components

### Evidence detector (core, build first)
- Bedrock, Claude, via the **Converse API**, using a **`us.`-prefixed cross-region inference
  profile** (bare model IDs are commonly rejected for on-demand invocation -- confirm the exact
  profile ID with `aws bedrock list-inference-profiles` in the target account before hardcoding it).
- System prompt: `lambda/evidence-detector/prompt.md` in this project, already written and
  specified in full, including the fixed 7-signal taxonomy, weighting rubric, risk-level
  thresholds, and strict JSON output schema. Implement the Lambda to call Bedrock with exactly
  this system prompt and validate the response against the schema before returning it.
- Temperature 0, since this needs to be a deterministic-as-possible evidence extractor.

### Scenario player (Tier 1)
- Serves the scripted transcripts from `benchmark/scenarios/*.json` turn-by-turn with realistic
  timing, so the frontend can animate the risk meter rising as evidence accumulates -- this is the
  demo's visual centerpiece per the requirements.
- "Safe call" and "scam call" buttons on the public landing page map to specific scenario IDs.

### Frontend
- Two views: the protected person's simple status screen, and the caregiver dashboard (transcript,
  risk meter, evidence checklist with quoted lines, VERIFY CALLER / MARK SAFE buttons).
- Static site (plain HTML/CSS/JS is fine -- no framework is required by the requirements).
- No login anywhere in the core demo flow.

### Data
- DynamoDB: one table for call sessions + risk events, keyed by session ID. Simple; this is a
  demo, not a production multi-tenant system (explicitly out of scope per requirements.md).

### Telephony (Tier 2)
- Amazon Chime SDK for PSTN inbound, bridging a real phone call into a Chime meeting.
- Amazon Transcribe streaming for the live audio.
- Same evidence-detector Lambda, invoked incrementally as transcript segments arrive.

### Out-of-band warning (Tier 3)
- WebSocket (API Gateway WebSocket API) push to a companion caregiver client. Explicitly NOT
  literal Chime per-attendee/per-leg audio routing -- see requirements.md R5 for why.

## Infrastructure as code
AWS SAM (or CDK if preferred -- pick one and be consistent). Deploy through this agent's connection
to AWS (Kiro via the AWS MCP Server / Agent Toolkit for AWS). Capture every deploy's evidence
(CloudFormation `UPDATE_COMPLETE`, the live URL, `sts get-caller-identity` output) into
`docs/proof/` immediately after each deploy, not at the end of the project.

## Category/lane tags for Builder Center
`#commercial-potential` + `#startup`. Do not use `#social-good` -- the hackathon's official Social
Good focus areas are limited to Education, Health, and Climate resilience; elder/family fraud
protection does not cleanly fit any of the three, and forcing it risks looking like tag-gaming to a
judge.
