# Day 0 — AWS connection + Bedrock inference verification

Date: 2026-09-28. Coding agent: Kiro. Account: `<ACCOUNT_ID>` (personal, standalone — confirmed
NOT in any AWS Organization via `organizations describe-organization` →
`AWSOrganizationsNotInUseException`). Account ID redacted in anything published per requirements.

## Summary
Classic `bedrock-runtime` inference (`Converse` / `InvokeModel`) is **hard-blocked** on this account
(`ValidationException: Operation not allowed`) for every model family (Amazon Nova, Meta Llama,
Anthropic Claude), for both credential types (SigV4 IAM user and Bedrock API bearer token), for both
bare model ids and `us.`-prefixed inference profiles. Root cause is not IAM, not model access
(models list ACTIVE), not an SCP (no org), and not credential type — it is a service-level routing:
**this account is provisioned on the Amazon Bedrock "Mantle" OpenAI-compatible endpoint.**

Inference **works** against the Mantle endpoint:
`POST https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions`
authenticated with the Amazon Bedrock API key as `Authorization: Bearer <token>`.

## Verified working call (Day 0 gate PASSED)
- Endpoint: `https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions`
- Model: `openai.gpt-oss-120b` (open-weight, OpenAI-compatible chat format)
- Result: HTTP 200, `message.content = "KINSHIELD_OK"`, `finish_reason = "stop"`.

## Caller identity (account ID to be redacted in published artifacts)
```
UserId: <IAM_USER_ID>
Account: <ACCOUNT_ID>   (redacted)
Arn: arn:aws:iam::<ACCOUNT_ID>:user/kiro   (redacted)
```

## What was ruled out (evidence trail)
| Hypothesis | Test | Result |
|---|---|---|
| Org SCP blocks Bedrock | `aws organizations describe-organization` | Not in an org — ruled out |
| Model access not granted | `aws bedrock list-foundation-models` | Models ACTIVE — ruled out |
| Wrong inference-profile format | bare id vs `us.` profile via Converse | both `Operation not allowed` |
| Bearer-key scope too narrow | SigV4 (IAM) vs bearer token via Converse | both `Operation not allowed` |
| IAM permission gap | error is `ValidationException` not `AccessDenied` | ruled out |
| Model not on-demand capable | `aws bedrock get-foundation-model` | supports ON_DEMAND — ruled out |
| **Account is on the Mantle endpoint** | `GET bedrock-mantle.../v1/models` + chat call | **CONFIRMED — inference works here** |

## Consequence for the build (deviation from design.md)
design.md assumed `bedrock-runtime` Converse + `us.` inference profiles. That path is unusable on
this account. The evidence-detector will instead call the **Mantle OpenAI-compatible Chat
Completions API** with model `openai.gpt-oss-120b`. Anthropic Claude models on Mantle rejected both
`/v1/chat/completions` and `/v1/responses` in testing, so an OpenAI-compatible model is the correct
choice here. Temperature 0 is preserved for deterministic evidence extraction.

## Proof scripts (kept locally, not published: they build resource names from the account ID)
- `_check_env.sh` — shell + token presence (no secret printed)
- `_bedrock_matrix.sh` / `_sigv4_vs_bearer.sh` / `_entitlement.sh` — the ruled-out Converse path
- `_mantle_models.sh` — `GET /v1/models` catalog on Mantle
- `_mantle_ok.sh` — the passing Day 0 inference call
