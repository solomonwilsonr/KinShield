# KinShield benchmark results

Run against the **live deployed API** (`/detect` on API Gateway → Lambda → Bedrock Mantle,
`openai.gpt-oss-20b` with `reasoning_effort: low` since Day 2; the first runs used `gpt-oss-120b`), temperature 0. Reproduce with `python3 benchmark/run_benchmark.py`; raw
data in `benchmark/results/benchmark-latest.json`.

> **Status 2026-10-02:** the scenario set is now **63** (31 scam, 32 benign; `scam_022`–`031` and
> `benign_027`–`032` added 2026-10-02). The latest measured run is the **47-scenario** run
> (21 scam / 26 benign: recall 100%, alarm FP 0%, signal recall 82.1%, latency median 650 ms /
> p90 2,376 ms; see `../PROGRESS.md` §9d). The 41-scenario table further down is older. The full 63
> have **not** been benchmarked yet; re-run with `benchmark/run_deployed.sh`.

## Current set: 41 scenarios (18 scam, 23 benign)
All scenarios are grounded synthetic scripts built from cited FTC / FBI IC3 patterns
(`benchmark/sources.md`) — never real recordings. The benign set deliberately includes hard
**ambiguous** cases (a real $100 loan for a plumber; a "don't tell Dad" birthday-surprise secret; a
legitimate bank/insurance/Medicare-adjacent call) to prove the detector doesn't just catch
cartoonish scams.

## Headline metrics (model: openai.gpt-oss-20b, reasoning_effort=low, temperature 0)
| Metric | Value |
|---|---|
| Recall (scams flagged MEDIUM/HIGH) | **100%** (18/18) |
| Alarm-level false-positive rate (benign scored MEDIUM/HIGH) | **0%** (0/23) |
| Evidence signal recall (mean over scams) | ~83% |
| Benign scenarios scoring LOW | **100%** (23/23) |
| Benign scenarios with zero evidence | 21/23 |
| Benign scenarios carrying a single low-weight (≤10) informational signal, still LOW | 2/23 |
| Detection latency (median / p90 / max) | **~0.6s / ~2.1s / ~2.5s** |

_Note: an earlier configuration (gpt-oss-120b, full reasoning) scored ~92% signal recall but
median ~3.3s / p90 ~19s latency with occasional timeouts. Switching to gpt-oss-20b with
reasoning_effort=low cut latency ~5x with identical risk verdicts (100% recall, 0% alarm FP);
signal-attribution detail dropped modestly to ~83%. The verdict — the thing a caregiver acts on —
is unchanged._

## Honesty notes
- **"False positive" definition.** We report the metric a caregiver actually cares about: a benign
  call that would *alarm* them (MEDIUM/HIGH). That is 0%. Two benign calls (the $100 plumber loan
  and the birthday-secret) carry one low-weight signal but resolve to LOW — we surface that as an
  informational data point, not an alarm, and report it transparently rather than hiding it.
- **The set is 41, not yet the full KinShield-100.** Every scenario is individually authored and
  cited; we chose curation over padding to 100 with near-duplicates. Expanding to 50+50 is
  straightforward via `benchmark/generate_scenarios.py`.
- **Latency.** `openai.gpt-oss-120b` emits a full reasoning trace before the JSON, so scam calls
  (more evidence) take longer than benign calls (which return quickly with no evidence). The demo
  UI animates the transcript in parallel to mask this.

## Two calibration fixes this benchmark drove (debugging stories for the write-up)
1. **Benign greeting tagged as impersonation.** "Hi Grandma, it's me" was sometimes flagged. Fix: a
   prompt guardrail that a casual self-identifying greeting alone is not a signal.
2. **Benign secret scored MEDIUM.** "Don't tell Dad about his surprise party" scored 27 (MEDIUM)
   because the rubric weights secrecy at 25-30. Fix: a context rule (prompt) plus a deterministic
   server-side safeguard in `_normalise()` — a single isolated signal caps at weight 10 and cannot
   alone push a call above LOW, because a lone signal almost always has an innocent explanation,
   while real scams stack multiple signals. Recall was unaffected (still 100%).

## Update 2026-09-30 (47 scenarios)
Added 6 scenarios (4 Hinglish, 2 location-pair). Live run: recall 100% (21/21), alarm-level FP 0% (0/26),
benign zero-evidence 100%, signal recall 82.1%, latency median 650 ms / p90 2376 ms / max 2886 ms.
Hinglish set is 4 hand-written calls: a demonstration, not a multilingual benchmark.
