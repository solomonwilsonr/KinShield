# KinBot eval

A small labelled set and a runner for the live KinBot API (`POST /kinbot`).

## Files

- `messages.jsonl`: 46 synthetic messages (29 scam, 17 legit), one JSON object per line:
  `{"id","label":"scam"|"legit","category","message","notes"}`.
  The set covers bank/fraud-department impostors, USPS/UPS/E-ZPass fees, grandparent and "new number" family emergencies, IRS/SSA/Medicare/Education impostors, prizes, tech support, crypto, romance, jobs, gift cards, emails with `From:` lines, and callback numbers (876/809/473, 900, toll-free).
  - Hard cases: scams with no link or number (`s02`, `s06`, `s07`, `s18`, `s20`, `s26`, `s29`) and legit texts that mention money or urgency (`l03`, `l08`, `l10`, `l11`, `l12`, `l14`–`l17`).
  - Scam links use made-up look-alike domains (`*.top`, `*.info`, `chase-secure-verify.co`, …). Scam phone numbers use the reserved fictional 555-01xx range. Legit items use real official domains.
- `run_eval.py`: the runner. It uses only the Python 3 standard library.
- `results-<timestamp>.jsonl`: raw API responses, one line per item, written on each run.
- `REPORT.md`: the summary from the latest run. Each run overwrites it.

## Run

```bash
cd kinshield/eval/kinbot
python3 run_eval.py                       # full set (~46 checks + 46 investigations)
python3 run_eval.py --limit 2             # smoke test
python3 run_eval.py --ids s01-bank-chase-link,l03-chase-fraud-reply
python3 run_eval.py --base https://<api>/kinbot
python3 run_eval.py --report-only results-20261002-105219.jsonl   # re-score, no API calls
```

For each item the runner calls `mode:"check"` and then `mode:"investigate"` with the detector's `risk_level` as `verdict`. It runs 3 items at a time, with a 45 s timeout and 1 retry with a short backoff.

A full run makes about 92 Bedrock-backed requests, so mind the spend during the evaluation window.

## What's measured

1. **Detector only:** an item counts as scam when `risk_level` is MEDIUM or HIGH. Reports the confusion matrix, precision, recall, false-positive rate on legit items, and accuracy.
2. **Agent only:** an item counts as scam when the investigation `level` is `danger`. A second variant counts `danger` or `caution`.
3. **Combined:** an item counts as scam when the detector says MEDIUM/HIGH **or** the agent says `danger`.
4. **Disagreements:** agent-only catches (detector LOW, agent danger), agent false alarms, detector false alarms, and scams missed by both.
5. **Model reliability:**
   - the share of investigations with any `auto:true` step, meaning the model skipped a required check and the checklist ran it
   - auto steps as a share of all steps
   - the share with `fallback` set
   - mean `tool_calls` and mean `model_turns`
   - per-tool step and auto counts
   - check and investigate latency at p50 and p90 (client wall clock)
   - error counts
6. **Per-item table:** id, label, detector level, agent level, number of auto steps, and latencies.

## Caveats

The set is synthetic, small (n=46), and written by the people who built the detector. Treat the rates as rough indications, not benchmarks. `REPORT.md` repeats these caveats.
