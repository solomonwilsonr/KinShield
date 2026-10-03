#!/usr/bin/env python3
"""KinBot evaluation runner (stdlib only).

For each item in messages.jsonl:
  1. POST {"mode":"check", "message": ...}               -> detector verdict
  2. POST {"mode":"investigate", "message":..., "verdict": <detector level>} -> agent verdict

Raw results go to results-<timestamp>.jsonl; the summary goes to REPORT.md
(both next to this script) and is printed.

Usage:
  python3 run_eval.py                 # all items
  python3 run_eval.py --limit 2       # first 2 items
  python3 run_eval.py --ids s01-bank-chase-link,l04-2fa-google
  python3 run_eval.py --base https://.../kinbot
  python3 run_eval.py --report-only results-XXXX.jsonl   # re-score saved results
"""
import argparse
import datetime as dt
import json
import os
import random
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_BASE = "https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com/kinbot"
TIMEOUT = 45
CONCURRENCY = 3
RETRIES = 1
UA = "KinShield-eval/1.0 (builder eval; low volume)"

_print_lock = threading.Lock()


def log(*a):
    with _print_lock:
        print(*a, file=sys.stderr, flush=True)


def post(base, payload):
    """POST JSON with one retry. Returns (body_dict_or_None, wall_ms, error_str_or_None)."""
    data = json.dumps(payload).encode("utf-8")
    last_err = None
    for attempt in range(RETRIES + 1):
        req = urllib.request.Request(
            base, data=data, method="POST",
            headers={"Content-Type": "application/json", "User-Agent": UA},
        )
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                body = json.loads(r.read().decode("utf-8"))
            ms = int((time.time() - t0) * 1000)
            if isinstance(body, dict) and body.get("error"):
                last_err = "api error: %s" % body.get("error")
            else:
                return body, ms, None
        except urllib.error.HTTPError as e:
            try:
                detail = e.read().decode("utf-8")[:200]
            except Exception:
                detail = ""
            last_err = "HTTP %s %s" % (e.code, detail)
        except Exception as e:  # timeout, connection reset, bad JSON
            last_err = "%s: %s" % (type(e).__name__, e)
        if attempt < RETRIES:
            time.sleep(2 + random.random() * 2)  # polite backoff
    return None, None, last_err


def run_item(base, item):
    out = {"id": item["id"], "label": item["label"], "category": item["category"]}
    chk, chk_ms, chk_err = post(base, {"mode": "check", "message": item["message"]})
    out["check"] = chk
    out["check_wall_ms"] = chk_ms
    out["check_error"] = chk_err
    verdict = (chk or {}).get("risk_level") or "LOW"
    time.sleep(0.3)
    inv, inv_ms, inv_err = post(
        base, {"mode": "investigate", "message": item["message"], "verdict": verdict})
    out["investigate"] = inv
    out["investigate_wall_ms"] = inv_ms
    out["investigate_error"] = inv_err
    log("  %-28s det=%-6s agent=%-7s %s" % (
        item["id"], (chk or {}).get("risk_level", "ERR"),
        (inv or {}).get("level", "ERR"),
        "; ".join(e for e in (chk_err, inv_err) if e)))
    return out


# ---------------------------------------------------------------- scoring

def det_level(r):
    return ((r.get("check") or {}).get("risk_level")) or None


def agent_level(r):
    return ((r.get("investigate") or {}).get("level")) or None


def confusion(rows, pred):
    """rows: results with known label. pred(r) -> True/False/None (None = error, skipped)."""
    tp = fp = tn = fn = skipped = 0
    for r in rows:
        p = pred(r)
        if p is None:
            skipped += 1
            continue
        scam = r["label"] == "scam"
        if p and scam:
            tp += 1
        elif p and not scam:
            fp += 1
        elif not p and scam:
            fn += 1
        else:
            tn += 1
    prec = tp / (tp + fp) if tp + fp else None
    rec = tp / (tp + fn) if tp + fn else None
    fpr = fp / (fp + tn) if fp + tn else None
    acc = (tp + tn) / (tp + tn + fp + fn) if tp + tn + fp + fn else None
    return dict(tp=tp, fp=fp, tn=tn, fn=fn, skipped=skipped,
                precision=prec, recall=rec, fpr=fpr, accuracy=acc)


def pct(x):
    return "n/a" if x is None else "%.1f%%" % (100 * x)


def quantile(vals, q):
    vals = sorted(v for v in vals if v is not None)
    if not vals:
        return None
    k = (len(vals) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(vals) - 1)
    return vals[lo] + (vals[hi] - vals[lo]) * (k - lo)


def fmt_ms(v):
    return "n/a" if v is None else "%d ms" % v


def cm_table(name, c):
    return "\n".join([
        "**%s**" % name,
        "",
        "| | predicted scam | predicted legit |",
        "|---|---|---|",
        "| actual scam | TP %d | FN %d |" % (c["tp"], c["fn"]),
        "| actual legit | FP %d | TN %d |" % (c["fp"], c["tn"]),
        "",
        "Precision %s · Recall %s · False-positive rate on legit %s · Accuracy %s%s" % (
            pct(c["precision"]), pct(c["recall"]), pct(c["fpr"]), pct(c["accuracy"]),
            (" · skipped (errors) %d" % c["skipped"]) if c["skipped"] else ""),
        "",
    ])


def build_report(results, base, results_path):
    n = len(results)
    n_scam = sum(r["label"] == "scam" for r in results)
    n_legit = n - n_scam

    def det_pred(r):
        lv = det_level(r)
        return None if lv is None else lv in ("MEDIUM", "HIGH")

    def ag_danger(r):
        lv = agent_level(r)
        return None if lv is None else lv == "danger"

    def ag_dc(r):
        lv = agent_level(r)
        return None if lv is None else lv in ("danger", "caution")

    def combined(r):
        d, a = det_level(r), agent_level(r)
        if d is None and a is None:
            return None
        return (d in ("MEDIUM", "HIGH")) or (a == "danger")

    c_det = confusion(results, det_pred)
    c_ad = confusion(results, ag_danger)
    c_adc = confusion(results, ag_dc)
    c_comb = confusion(results, combined)

    agent_only = [r for r in results if r["label"] == "scam"
                  and det_level(r) == "LOW" and agent_level(r) == "danger"]
    agent_false = [r for r in results if r["label"] == "legit" and agent_level(r) == "danger"]
    det_false = [r for r in results if r["label"] == "legit"
                 and det_level(r) in ("MEDIUM", "HIGH")]
    missed_all = [r for r in results if r["label"] == "scam" and combined(r) is False]

    invs = [r["investigate"] for r in results if r.get("investigate")]
    n_inv = len(invs)
    any_auto = sum(any(s.get("auto") for s in (i.get("steps") or [])) for i in invs)
    tot_steps = sum(len(i.get("steps") or []) for i in invs)
    tot_auto = sum(sum(1 for s in (i.get("steps") or []) if s.get("auto")) for i in invs)
    n_fallback = sum(bool(i.get("fallback")) for i in invs)

    def mean(key):
        vals = [i.get(key) for i in invs if isinstance(i.get(key), (int, float))]
        return (sum(vals) / len(vals)) if vals else None

    tool_counts = {}
    for i in invs:
        for s in i.get("steps") or []:
            t = s.get("tool") or "?"
            d = tool_counts.setdefault(t, [0, 0])
            d[0] += 1
            d[1] += 1 if s.get("auto") else 0

    chk_lat = [r.get("check_wall_ms") for r in results]
    inv_lat = [r.get("investigate_wall_ms") for r in results]
    chk_errs = sum(1 for r in results if r.get("check_error"))
    inv_errs = sum(1 for r in results if r.get("investigate_error"))
    mtc, mmt = mean("tool_calls"), mean("model_turns")

    L = []
    L.append("# KinBot evaluation report")
    L.append("")
    L.append("Generated %s · endpoint `%s` · raw results `%s`" % (
        dt.datetime.now().strftime("%Y-%m-%d %H:%M"), base, os.path.basename(results_path)))
    L.append("")
    L.append("Items: **%d** (%d scam, %d legit). Errors: check %d, investigate %d." % (
        n, n_scam, n_legit, chk_errs, inv_errs))
    L.append("")
    L.append("## 1. Detector only (`check`)")
    L.append("")
    L.append("Scam = `risk_level` in {MEDIUM, HIGH}.")
    L.append("")
    L.append(cm_table("Detector", c_det))
    L.append("## 2. Agent only (`investigate`)")
    L.append("")
    L.append(cm_table("Agent: scam = danger only", c_ad))
    L.append(cm_table("Agent: scam = danger or caution", c_adc))
    L.append("## 3. Combined")
    L.append("")
    L.append("Scam = detector MEDIUM/HIGH **or** agent danger.")
    L.append("")
    L.append(cm_table("Combined", c_comb))
    L.append("## 4. Where they disagree")
    L.append("")

    def idlist(rs):
        return ", ".join("`%s`" % r["id"] for r in rs) if rs else "none"

    L.append("- Agent-only catches (scam, detector LOW, agent danger): %d — %s" % (
        len(agent_only), idlist(agent_only)))
    L.append("- Agent false alarms (legit, agent danger): %d — %s" % (
        len(agent_false), idlist(agent_false)))
    L.append("- Detector false alarms (legit, detector MEDIUM/HIGH): %d — %s" % (
        len(det_false), idlist(det_false)))
    L.append("- Scams missed by both: %d — %s" % (len(missed_all), idlist(missed_all)))
    L.append("")
    L.append("## 5. Model reliability")
    L.append("")
    L.append("| Metric | Value |")
    L.append("|---|---|")
    L.append("| Investigations returned | %d / %d |" % (n_inv, n))
    L.append("| Investigations with any `auto:true` step (model skipped a required check) | %s (%d) |" % (
        pct(any_auto / n_inv if n_inv else None), any_auto))
    L.append("| Auto steps / total steps | %d / %d (%s) |" % (
        tot_auto, tot_steps, pct(tot_auto / tot_steps if tot_steps else None)))
    L.append("| `fallback` true | %s (%d) |" % (pct(n_fallback / n_inv if n_inv else None), n_fallback))
    L.append("| Mean `tool_calls` | %s |" % ("n/a" if mtc is None else "%.2f" % mtc))
    L.append("| Mean `model_turns` | %s |" % ("n/a" if mmt is None else "%.2f" % mmt))
    L.append("| Check latency p50 / p90 (client wall) | %s / %s |" % (
        fmt_ms(quantile(chk_lat, .5)), fmt_ms(quantile(chk_lat, .9))))
    L.append("| Investigate latency p50 / p90 (client wall) | %s / %s |" % (
        fmt_ms(quantile(inv_lat, .5)), fmt_ms(quantile(inv_lat, .9))))
    L.append("| Errors (check / investigate) | %d / %d |" % (chk_errs, inv_errs))
    L.append("")
    if tool_counts:
        L.append("Steps per tool (auto = run by the deterministic checklist):")
        L.append("")
        L.append("| Tool | Steps | Auto |")
        L.append("|---|---|---|")
        for t, (cnt, au) in sorted(tool_counts.items(), key=lambda kv: -kv[1][0]):
            L.append("| `%s` | %d | %d |" % (t, cnt, au))
        L.append("")
    L.append("## 6. Per item")
    L.append("")
    L.append("| id | label | detector | agent | auto steps | check ms | investigate ms | error |")
    L.append("|---|---|---|---|---|---|---|---|")
    for r in results:
        inv = r.get("investigate") or {}
        nauto = sum(1 for s in (inv.get("steps") or []) if s.get("auto"))
        err = "; ".join(e for e in (r.get("check_error"), r.get("investigate_error")) if e)
        L.append("| `%s` | %s | %s | %s | %d | %s | %s | %s |" % (
            r["id"], r["label"], det_level(r) or "ERR", agent_level(r) or "ERR", nauto,
            r.get("check_wall_ms") if r.get("check_wall_ms") is not None else "-",
            r.get("investigate_wall_ms") if r.get("investigate_wall_ms") is not None else "-",
            err.replace("|", "/")[:80]))
    L.append("")
    L.append("## 7. Caveats")
    L.append("")
    L.append("- **Synthetic, small, builder-written set.** %d messages written by the KinShield builders "
             "from public FTC scam-pattern descriptions. It is not a random sample of real traffic, "
             "and the builders know how the detector works, so the set may be easier (or differently hard) "
             "than real messages. Treat every rate as a rough indication; one item moves a rate by "
             "%s on the scam side and %s on the legit side." % (
                 n, pct(1 / n_scam if n_scam else None), pct(1 / n_legit if n_legit else None)))
    L.append("- **No held-out set.** If prompts or rules are tuned against these items, the numbers stop "
             "measuring generalisation.")
    L.append("- **Live, non-deterministic models.** The detector and agent call an LLM on Bedrock; "
             "re-runs can differ. Latencies are client wall-clock from wherever the runner ran.")
    L.append("- **Fictional phone numbers.** Scam numbers use the reserved 555-01xx range "
             "(with real area codes such as 876/809/473/900); a phone tool may treat that range specially.")
    L.append("- **Fake domains.** Scam links are made-up look-alike domains that should not resolve; "
             "the agent's link and page tools will see 'does not exist', which is itself a signal a real "
             "phishing link would not always give.")
    L.append("- Some items are deliberately ambiguous (e.g. `s29-wrong-number`, `l12-family-venmo-small`); "
             "see `notes` in messages.jsonl.")
    L.append("")
    return "\n".join(L)


def load_items(path):
    with open(path) as f:
        return [json.loads(l) for l in f if l.strip()]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--ids", default=None, help="comma-separated item ids")
    ap.add_argument("--base", default=DEFAULT_BASE, help="full /kinbot endpoint URL")
    ap.add_argument("--messages", default=os.path.join(HERE, "messages.jsonl"))
    ap.add_argument("--report-only", default=None, metavar="RESULTS_JSONL",
                    help="skip API calls; re-score a saved results file")
    args = ap.parse_args()

    if args.report_only:
        results_path = args.report_only
        results = load_items(results_path)
    else:
        items = load_items(args.messages)
        if args.ids:
            want = [s.strip() for s in args.ids.split(",") if s.strip()]
            items = [it for it in items if it["id"] in want]
            missing = set(want) - {it["id"] for it in items}
            if missing:
                sys.exit("unknown ids: %s" % ", ".join(sorted(missing)))
        if args.limit is not None:
            items = items[: args.limit]
        if not items:
            sys.exit("no items selected")
        ts = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        results_path = os.path.join(HERE, "results-%s.jsonl" % ts)
        log("Running %d items against %s (concurrency %d) ..." % (len(items), args.base, CONCURRENCY))
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
            results = list(ex.map(lambda it: run_item(args.base, it), items))
        with open(results_path, "w") as f:
            for r in results:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        log("Saved raw results: %s" % results_path)

    report = build_report(results, args.base, results_path)
    with open(os.path.join(HERE, "REPORT.md"), "w") as f:
        f.write(report)
    print(report)


if __name__ == "__main__":
    main()
