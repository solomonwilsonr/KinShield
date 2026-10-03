import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(HERE, "..", ".."))
os.environ.setdefault("AWS_REGION", "us-east-1")
sys.path.insert(0, HERE)
import handler
handler._SCENARIO_DIR = os.path.join(PROJECT, "benchmark", "scenarios")
handler._scenarios_cache = None
scen = handler._load_scenarios()["scam_001"]
text = handler.transcript_to_text(scen["turns"])
for i in range(3):
    r = handler.detect(text)
    sigs = sorted({e["signal"] for e in r["evidence"]})
    print(f"run {i}: level={r['risk_level']} score={r['risk_score']} impersonation={'impersonation' in sigs} sigs={sigs}")
