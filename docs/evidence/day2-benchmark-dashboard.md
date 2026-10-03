# Day 2 — benchmark expansion, metrics, dashboard

Date: 2026-09-29.

## Benchmark
Expanded from 6 seed scenarios to **41** (18 scam, 23 benign) via `benchmark/generate_scenarios.py`,
each individually authored and cited to an FTC/IC3 pattern (`benchmark/sources.md`). The benign set
includes deliberately hard **ambiguous** cases (real $100 plumber loan, "don't tell Dad" birthday
secret, legitimate bank/insurance/Medicare-adjacent calls).

Ran the full set through the **live deployed API** (`benchmark/run_benchmark.py`):

| Metric | Value |
|---|---|
| Recall (scams flagged MEDIUM/HIGH) | 100% (18/18) |
| Alarm-level false-positive rate (benign MED/HIGH) | 0% (0/23) |
| Evidence signal recall (mean over scams) | ~92% |
| Benign scoring LOW | 100% (23/23) |
| Benign with zero evidence | 21/23 |
| Latency median / p90 | ~3.3s / ~19s |

Full results: `benchmark/RESULTS.md`, raw JSON `benchmark/results/benchmark-latest.json`.

## Calibration fixes driven by the benchmark (honest debugging stories)
1. Benign "it's me" greeting sometimes tagged impersonation -> prompt guardrail.
2. Benign birthday-secret scored MEDIUM (secrecy weight 27) -> prompt context rule PLUS a
   deterministic server-side safeguard in `_normalise()`: a single isolated signal caps at weight
   10 and can't alone exceed LOW. Recall stayed 100%.

## Dashboard
The public page's caregiver dashboard now includes: the live transcript, an accumulating risk meter
with MED/HIGH thresholds, the cited-evidence checklist (quote + signal + weight + timestamp), a
7-signal taxonomy legend that lights up the signals that fired, a "Perfect Clone Challenge" framing
badge, VERIFY CALLER / MARK SAFE actions, and a simulated FamilyVerify out-of-band flow (Tier-3
design, clearly labelled simulated). Verified all 20 JS-referenced DOM ids exist in the deployed
HTML and the API endpoint is injected into config.js.

## Live URLs
- Site (S3 website, public, no login): http://kinshield-site-<ACCOUNT_ID>.s3-website-us-east-1.amazonaws.com
- API (API Gateway): https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com
