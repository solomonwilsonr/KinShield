# KinBot evaluation report

Generated 2026-10-03 11:01 · endpoint `https://kinshield.site/kinbot` · raw results `results-20261003-110036.jsonl`

Items: **46** (29 scam, 17 legit). Errors: check 0, investigate 0.

## 1. Detector only (`check`)

Scam = `risk_level` in {MEDIUM, HIGH}.

**Detector**

| | predicted scam | predicted legit |
|---|---|---|
| actual scam | TP 9 | FN 20 |
| actual legit | FP 0 | TN 17 |

Precision 100.0% · Recall 31.0% · False-positive rate on legit 0.0% · Accuracy 56.5%

## 2. Agent only (`investigate`)

**Agent: scam = danger only**

| | predicted scam | predicted legit |
|---|---|---|
| actual scam | TP 12 | FN 17 |
| actual legit | FP 1 | TN 16 |

Precision 92.3% · Recall 41.4% · False-positive rate on legit 5.9% · Accuracy 60.9%

**Agent: scam = danger or caution**

| | predicted scam | predicted legit |
|---|---|---|
| actual scam | TP 19 | FN 10 |
| actual legit | FP 4 | TN 13 |

Precision 82.6% · Recall 65.5% · False-positive rate on legit 23.5% · Accuracy 69.6%

## 3. Combined

Scam = detector MEDIUM/HIGH **or** agent danger.

**Combined**

| | predicted scam | predicted legit |
|---|---|---|
| actual scam | TP 20 | FN 9 |
| actual legit | FP 1 | TN 16 |

Precision 95.2% · Recall 69.0% · False-positive rate on legit 5.9% · Accuracy 78.3%

## 4. Where they disagree

- Agent-only catches (scam, detector LOW, agent danger): 11 — `s01-bank-chase-link`, `s03-usps-fee`, `s05-ups-customs`, `s08-irs-refund`, `s11-lottery-jamaica`, `s13-one-ring-473`, `s14-900-number`, `s16-tech-support-email`, `s22-paypal-email`, `s24-netflix-billing`, `s28-zelle-reply-yes`
- Agent false alarms (legit, agent danger): 1 — `l02-amazon-shipped`
- Detector false alarms (legit, detector MEDIUM/HIGH): 0 — none
- Scams missed by both: 9 — `s04-ezpass-toll`, `s07-family-new-number`, `s10-medicare-card`, `s15-tech-support-popup`, `s17-crypto-investment`, `s19-job-offer`, `s23-amazon-purchase-call`, `s27-geek-squad-email`, `s29-wrong-number`

## 5. Model reliability

| Metric | Value |
|---|---|
| Investigations returned | 46 / 46 |
| Investigations with any `auto:true` step (model skipped a required check) | 34.8% (16) |
| Auto steps / total steps | 27 / 122 (22.1%) |
| `fallback` true | 0.0% (0) |
| Mean `tool_calls` | 2.65 |
| Mean `model_turns` | 3.39 |
| Check latency p50 / p90 (client wall) | 1194 ms / 2114 ms |
| Investigate latency p50 / p90 (client wall) | 2200 ms / 4489 ms |
| Errors (check / investigate) | 0 / 0 |

Steps per tool (auto = run by the deterministic checklist):

| Tool | Steps | Auto |
|---|---|---|
| `lookup_guidance` | 46 | 8 |
| `check_threat_feeds` | 24 | 7 |
| `inspect_link` | 20 | 1 |
| `visit_page` | 16 | 11 |
| `check_phone` | 11 | 0 |
| `check_sender` | 5 | 0 |

## 6. Per item

| id | label | detector | agent | auto steps | check ms | investigate ms | error |
|---|---|---|---|---|---|---|---|
| `s01-bank-chase-link` | scam | LOW | danger | 1 | 2384 | 4026 |  |
| `s02-bank-fraud-code-nolink` | scam | MEDIUM | info | 0 | 2057 | 2229 |  |
| `s03-usps-fee` | scam | LOW | danger | 3 | 2090 | 1977 |  |
| `s04-ezpass-toll` | scam | LOW | caution | 1 | 1570 | 3214 |  |
| `s05-ups-customs` | scam | LOW | danger | 1 | 1248 | 3336 |  |
| `s06-grandparent-jail` | scam | HIGH | info | 0 | 1636 | 2172 |  |
| `s07-family-new-number` | scam | LOW | info | 0 | 1359 | 1808 |  |
| `s08-irs-refund` | scam | LOW | danger | 1 | 1181 | 2664 |  |
| `s09-ssa-suspended` | scam | MEDIUM | caution | 0 | 3733 | 2474 |  |
| `s10-medicare-card` | scam | LOW | caution | 0 | 1161 | 1824 |  |
| `s11-lottery-jamaica` | scam | LOW | danger | 0 | 1460 | 1635 |  |
| `s12-prize-809` | scam | MEDIUM | danger | 0 | 1303 | 4270 |  |
| `s13-one-ring-473` | scam | LOW | danger | 0 | 1496 | 1984 |  |
| `s14-900-number` | scam | LOW | danger | 0 | 998 | 2245 |  |
| `s15-tech-support-popup` | scam | LOW | caution | 0 | 1107 | 1726 |  |
| `s16-tech-support-email` | scam | LOW | danger | 2 | 1030 | 3384 |  |
| `s17-crypto-investment` | scam | LOW | caution | 0 | 4094 | 8363 |  |
| `s18-romance-giftcards` | scam | HIGH | info | 0 | 1210 | 1709 |  |
| `s19-job-offer` | scam | LOW | info | 0 | 1315 | 1506 |  |
| `s20-boss-giftcards` | scam | HIGH | info | 0 | 1307 | 1701 |  |
| `s21-utility-shutoff` | scam | MEDIUM | info | 0 | 2138 | 2046 |  |
| `s22-paypal-email` | scam | LOW | danger | 2 | 1045 | 3585 |  |
| `s23-amazon-purchase-call` | scam | LOW | caution | 1 | 1043 | 6399 |  |
| `s24-netflix-billing` | scam | LOW | danger | 1 | 868 | 4709 |  |
| `s25-student-loan` | scam | MEDIUM | info | 0 | 1505 | 1798 |  |
| `s26-jury-duty-nolink` | scam | HIGH | info | 0 | 1858 | 1660 |  |
| `s27-geek-squad-email` | scam | LOW | caution | 0 | 1264 | 2425 |  |
| `s28-zelle-reply-yes` | scam | LOW | danger | 2 | 1533 | 2846 |  |
| `s29-wrong-number` | scam | LOW | info | 1 | 1061 | 1556 |  |
| `l01-walgreens-pickup` | legit | LOW | info | 0 | 1048 | 1312 |  |
| `l02-amazon-shipped` | legit | LOW | danger | 4 | 1241 | 2573 |  |
| `l03-chase-fraud-reply` | legit | LOW | info | 0 | 1148 | 1703 |  |
| `l04-2fa-google` | legit | LOW | info | 0 | 875 | 1541 |  |
| `l05-dentist` | legit | LOW | info | 0 | 1141 | 6636 |  |
| `l06-family-no-money` | legit | LOW | info | 1 | 1120 | 1470 |  |
| `l07-usps-informed` | legit | LOW | ok | 0 | 1084 | 3187 |  |
| `l08-google-security` | legit | LOW | ok | 0 | 1118 | 6507 |  |
| `l09-ups-delivery` | legit | LOW | caution | 2 | 921 | 2582 |  |
| `l10-utility-bill` | legit | LOW | caution | 0 | 932 | 2453 |  |
| `l11-bank-low-balance` | legit | LOW | ok | 0 | 939 | 2172 |  |
| `l12-family-venmo-small` | legit | LOW | info | 0 | 6037 | 1399 |  |
| `l13-cvs-refill` | legit | LOW | ok | 0 | 910 | 1905 |  |
| `l14-apple-receipt` | legit | LOW | caution | 0 | 1005 | 2831 |  |
| `l15-school-closure` | legit | LOW | info | 1 | 1065 | 1546 |  |
| `l16-medicare-enrollment` | legit | LOW | ok | 0 | 915 | 2382 |  |
| `l17-delta-delay` | legit | LOW | ok | 3 | 1208 | 2156 |  |

## 7. Caveats

- **Synthetic, small, builder-written set.** 46 messages written by the KinShield builders from public FTC scam-pattern descriptions. It is not a random sample of real traffic, and the builders know how the detector works, so the set may be easier (or differently hard) than real messages. Treat every rate as a rough indication; one item moves a rate by 3.4% on the scam side and 5.9% on the legit side.
- **No held-out set.** If prompts or rules are tuned against these items, the numbers stop measuring generalisation.
- **Live, non-deterministic models.** The detector and agent call an LLM on Bedrock; re-runs can differ. Latencies are client wall-clock from wherever the runner ran.
- **Fictional phone numbers.** Scam numbers use the reserved 555-01xx range (with real area codes such as 876/809/473/900); a phone tool may treat that range specially.
- **Fake domains.** Scam links are made-up look-alike domains that should not resolve; the agent's link and page tools will see 'does not exist', which is itself a signal a real phishing link would not always give.
- Some items are deliberately ambiguous (e.g. `s29-wrong-number`, `l12-family-venmo-small`); see `notes` in messages.jsonl.
