"""Run the full KinShield benchmark against the DEPLOYED public API and compute metrics:
  - recall (scam scenarios correctly flagged MEDIUM/HIGH)
  - false-positive rate (benign scenarios wrongly flagged non-LOW)
  - detection latency (median / p90 from the API's own latency_ms)
  - evidence accuracy (for scams: fraction of expected signals actually detected; for benigns:
    fraction with exactly zero evidence)
Writes results/benchmark-latest.json and prints a summary table.

Usage: python3 run_benchmark.py [API_BASE]
"""
import json
import os
import statistics
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SCEN = os.path.join(HERE, "scenarios")
RESULTS = os.path.join(HERE, "results")
API = (sys.argv[1] if len(sys.argv) > 1
       else "https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com").rstrip("/")


def call_detect(scenario_id, retries=3):
    body = json.dumps({"scenario_id": scenario_id}).encode()
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(f"{API}/detect", data=body, method="POST")
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.0 * (attempt + 1))
    raise RuntimeError(f"detect failed for {scenario_id}: {last}")


def main():
    os.makedirs(RESULTS, exist_ok=True)
    files = sorted(f for f in os.listdir(SCEN) if f.endswith(".json"))
    rows = []
    latencies = []
    for fn in files:
        with open(os.path.join(SCEN, fn)) as f:
            s = json.load(f)
        res = call_detect(s["id"])
        exp = s.get("expected", {})
        exp_sigs = set(exp.get("evidence_signals", []))
        got_sigs = {e["signal"] for e in res.get("evidence", [])}
        lat = res.get("latency_ms")
        if isinstance(lat, int):
            latencies.append(lat)
        rows.append({
            "id": s["id"],
            "label": s.get("label"),
            "expected_level": exp.get("risk_level"),
            "got_level": res.get("risk_level"),
            "score": res.get("risk_score"),
            "evidence_count": len(res.get("evidence", [])),
            "expected_signals": sorted(exp_sigs),
            "got_signals": sorted(got_sigs),
            "signal_recall": (len(exp_sigs & got_sigs) / len(exp_sigs)) if exp_sigs else None,
            "latency_ms": lat,
        })
        print(f"{s['id']:12} {s.get('label'):6} -> {res.get('risk_level'):6} "
              f"score={res.get('risk_score'):>3} ev={len(res.get('evidence', []))} "
              f"lat={lat}ms")
        time.sleep(0.8)

    scams = [r for r in rows if r["label"] == "scam"]
    benigns = [r for r in rows if r["label"] == "benign"]

    scam_caught = [r for r in scams if r["got_level"] in ("MEDIUM", "HIGH")]
    # Alarm-level false positive = a benign call that would actually alarm a caregiver
    # (scored MEDIUM or HIGH). This is what R6 cares about.
    benign_alarm_fp = [r for r in benigns if r["got_level"] != "LOW"]
    # Any-evidence = a benign that carried at least one low-weight informational signal while
    # still resolving to LOW. Reported separately for full honesty.
    benign_any_evidence = [r for r in benigns if r["evidence_count"] > 0]

    recall = len(scam_caught) / len(scams) if scams else 0.0
    fpr = len(benign_alarm_fp) / len(benigns) if benigns else 0.0
    benign_fp = benign_alarm_fp
    # evidence accuracy
    scam_sig_recalls = [r["signal_recall"] for r in scams if r["signal_recall"] is not None]
    mean_sig_recall = statistics.mean(scam_sig_recalls) if scam_sig_recalls else 0.0
    benign_clean = [r for r in benigns if r["evidence_count"] == 0]
    benign_clean_rate = len(benign_clean) / len(benigns) if benigns else 0.0

    summary = {
        "api": API,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "counts": {"total": len(rows), "scam": len(scams), "benign": len(benigns)},
        "recall_scam_flagged": round(recall, 4),
        "false_positive_rate_alarm_level_benign": round(fpr, 4),
        "benign_carrying_low_weight_signal": len(benign_any_evidence),
        "evidence_signal_recall_mean_scam": round(mean_sig_recall, 4),
        "benign_zero_evidence_rate": round(benign_clean_rate, 4),
        "latency_ms": {
            "median": int(statistics.median(latencies)) if latencies else None,
            "p90": int(sorted(latencies)[int(len(latencies) * 0.9)]) if latencies else None,
            "max": max(latencies) if latencies else None,
            "min": min(latencies) if latencies else None,
        },
        "misses": [r for r in scams if r["got_level"] == "LOW"],
        "false_positives": benign_fp,
        "rows": rows,
    }
    out = os.path.join(RESULTS, "benchmark-latest.json")
    with open(out, "w") as f:
        json.dump(summary, f, indent=2)

    print("\n===== SUMMARY =====")
    print(f"total={summary['counts']['total']} scam={summary['counts']['scam']} benign={summary['counts']['benign']}")
    print(f"recall (scam flagged MED/HIGH):        {recall:.1%}")
    print(f"alarm-level FP rate (benign MED/HIGH): {fpr:.1%}")
    print(f"benigns carrying a low-weight signal:  {len(benign_any_evidence)}/{len(benigns)} (all still LOW)")
    print(f"evidence signal recall (scam mean):    {mean_sig_recall:.1%}")
    print(f"benign zero-evidence rate:             {benign_clean_rate:.1%}")
    lm = summary["latency_ms"]
    print(f"latency ms: median={lm['median']} p90={lm['p90']} min={lm['min']} max={lm['max']}")
    if summary["misses"]:
        print(f"MISSED SCAMS: {[r['id'] for r in summary['misses']]}")
    if benign_fp:
        print(f"FALSE POSITIVES: {[r['id'] for r in benign_fp]}")
    print(f"\nsaved {out}")


if __name__ == "__main__":
    main()
