"""Local harness: run the detector over the 6 benchmark scenarios using the bearer token in the
environment (AWS_BEARER_TOKEN_BEDROCK). Validates prompt + parsing + normalisation + thresholds
before any infra is deployed."""
import json
import os
import sys

# make the benchmark scenarios visible to the handler's loader
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(HERE, "..", ".."))
SCEN_SRC = os.path.join(PROJECT, "benchmark", "scenarios")

# point the handler's scenario dir at the benchmark folder for local run
os.environ.setdefault("AWS_REGION", "us-east-1")
sys.path.insert(0, HERE)
import handler  # noqa: E402

handler._SCENARIO_DIR = SCEN_SRC
handler._scenarios_cache = None

scen = handler._load_scenarios()
print(f"loaded {len(scen)} scenarios from {SCEN_SRC}\n")

passed = 0
failed = 0
for sid in sorted(scen):
    s = scen[sid]
    text = handler.transcript_to_text(s["turns"])
    try:
        result = handler.detect(text)
    except Exception as e:  # noqa: BLE001
        print(f"[{sid}] ERROR: {e}")
        failed += 1
        continue
    exp = s.get("expected", {})
    exp_level = exp.get("risk_level")
    got_level = result["risk_level"]
    exp_sigs = set(exp.get("evidence_signals", []))
    got_sigs = {e["signal"] for e in result["evidence"]}

    level_ok = (exp_level == got_level)
    # benign scenarios: hard requirement of zero evidence
    if s.get("label") == "benign":
        # HARD requirement (R6): benign calls score LOW with zero fabricated evidence.
        integrity_ok = (len(result["evidence"]) == 0 and got_level == "LOW")
    else:
        # scam: the thing that matters for R6 is that it is CAUGHT (level MEDIUM/HIGH).
        # Exact per-signal attribution can vary (e.g. "the lawyer says" read as authority_pressure
        # vs impersonation, both defensible) and is reported separately as evidence-signal recall.
        integrity_ok = got_level in ("MEDIUM", "HIGH")

    # signal-recall is tracked but NOT a pass/fail gate for scams
    sig_recall = len(exp_sigs & got_sigs) / len(exp_sigs) if exp_sigs else None
    ok = level_ok and integrity_ok
    passed += ok
    failed += (not ok)
    recall_str = f" sig_recall={sig_recall:.0%}" if sig_recall is not None else ""
    print(f"[{sid}] label={s.get('label'):6} expect={exp_level:6} got={got_level:6} "
          f"score={result['risk_score']:3}{recall_str} sigs={sorted(got_sigs)} "
          f"{'OK' if ok else 'FAIL'}")
    if not ok:
        print(f"        expected_signals={sorted(exp_sigs)}")
        print(f"        evidence={json.dumps(result['evidence'])}")

print(f"\n{passed} passed, {failed} failed")
sys.exit(0 if failed == 0 else 1)
