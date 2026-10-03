# Detector local validation (pre-deploy)

Date: 2026-09-28. Model: `openai.gpt-oss-120b` via Bedrock Mantle
(`https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions`), temperature 0.

Ran the 6 seed benchmark scenarios through the real detector logic (`handler.detect`) against the
live Mantle endpoint, before any infra was deployed. Two consecutive full runs:

| Scenario | Label | Expected | Got | Score | Notes |
|---|---|---|---|---|---|
| benign_001 | benign | LOW | LOW | 0 | zero evidence (was a borderline "it's me" FP before guardrail) |
| benign_002 | benign | LOW | LOW | 0 | zero evidence |
| benign_003 | benign | LOW | LOW | 0 | zero evidence |
| scam_001 | scam | HIGH | HIGH | 91-110 | signal recall 80% |
| scam_002 | scam | HIGH | HIGH | 95-107 | signal recall 75-100% |
| scam_003 | scam | HIGH | HIGH | 101-120 | signal recall 100% |

Result: **6/6 pass on both runs.** Benign calls score LOW with zero fabricated evidence (R6 hard
requirement); scam calls are caught as HIGH.

## Prompt engineering note (honest debugging story for the write-up)
Initial runs sometimes tagged the benign greeting "Hi Grandma, it's me" as `impersonation`, a false
positive that R6 explicitly forbids. Adding an explicit "familiar-greeting is impersonation"
instruction *over*-corrected: it then flagged benign greetings AND mis-attributed the scam attorney
line. Resolution: a guardrail instruction that impersonation is only recorded when a claimed
identity is used to drive a request or is paired with another signal in the same call, and that
ordinary greetings/logistics must return zero evidence. This preserves scam recall (scams always
pair impersonation with money/secrecy/emergency) while eliminating benign false positives.

Server-side, `_normalise()` recomputes `risk_score` from the evidence weights and re-derives
`risk_level` from the fixed thresholds (0-24 LOW / 25-59 MEDIUM / 60+ HIGH), so the numbers are
always internally consistent regardless of the model's own arithmetic, and any invented signal name
outside the fixed 7-signal taxonomy is dropped.
