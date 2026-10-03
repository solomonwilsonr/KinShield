# Sources for KinShield-100 scenario construction

No public corpus of real scam-call transcripts or audio exists (checked: FTC, IC3, academic robocall
research groups). Every scenario below is a synthetic script, clearly labeled as such, constructed to
match a real, cited pattern description or statistic. Never presented as a real recording.

## Primary sources
- FBI IC3 2025 Elder Fraud data: 201,266 victims aged 60+, $7.7B in reported losses (+59% YoY),
  $352M+ specifically attributed to AI-related fraud (3,100+ complaints). https://www.ic3.gov
- IC3 PSA 2023/231117 "Scammers Targeting Senior Citizens in Grandparent Scams": describes the
  two-call pattern (grandchild claiming jail/accident, then a fake "attorney" requesting bond/legal
  fees), and payment via wire, mail, or courier. https://www.ic3.gov/PSA/2023/psa231117
- FTC Consumer Alert, March 2023, "Scammers use AI to enhance their family emergency schemes":
  example dialogue -- "You get a call. There's a panicked voice on the line. It's your grandson.
  He says he's in deep trouble -- he wrecked the car and landed in jail. But you can help by
  sending money." https://consumer.ftc.gov/consumer-alerts/2023/03/scammers-use-ai-enhance-their-family-emergency-schemes
- FTC Consumer Advice, "grandparent" scam pattern descriptions (secrecy request -- "don't tell Mom
  or Dad" -- is a documented, named element of the script). https://consumer.ftc.gov/search-terms/grandparent
- Google Phone Help, Scam Detection docs (Feb 2026): confirms the feature is off by default, opt-in,
  and "never used in calls with your contacts" -- the structural gap KinShield targets.
  https://support.google.com/phoneapp/answer/15654065

## Signal taxonomy -> source mapping
| Signal | Source pattern |
|---|---|
| impersonation | IC3 PSA 231117: caller claims to be a specific relative |
| emergency | IC3 PSA 231117 + FTC 2023 alert: "wrecked the car and landed in jail" |
| secrecy | FTC grandparent-scam pattern: "don't tell Mom/Dad" |
| financial_request | IC3 PSA 231117: bond/legal fees requested |
| payment_anomaly | IC3 PSA 231117: payment via wire, mail, courier, or (contemporary variant) gift cards/crypto |
| authority_pressure | IC3 elder fraud reporting: fake "attorney" or law-enforcement follow-up call |
| unusual_urgency | Common element across all IC3/FTC grandparent-scam descriptions |

## Scenario ID convention
`scam_NNN.json` / `benign_NNN.json` in `benchmark/scenarios/`. Each scenario cites which source
pattern(s) it draws from in a `sources` field. Target: 50 scam + 50 benign for the published
KinShield-100 set. This commit starts with a first batch to validate the format and detector.

## 2026 refresh (added 2026-10-02, `generate_2026.py`)
Ten scam scripts for patterns that appeared or grew in 2024-2026 alerts, plus six hard-negative benign
calls that share their surface features (a real bank fraud alert, a real new phone number, a real family
emergency with no money ask, a real police call, gift cards as actual gifts, a real Medicare rep).
- IC3 PSA 230929, "Phantom Hacker" scams: layered tech-support -> bank -> government impostors.
  https://www.ic3.gov/PSA/2023/PSA230929
- IC3 PSA 240129: couriers collect cash or gold/precious metals from seniors; a dollar-bill serial
  number used as a passcode. https://www.ic3.gov/PSA/2024/PSA240129
- IC3 PSA 260917 (17 Sep 2026): law-enforcement/government impersonation, ~61,000 complaints and
  $1.6B+ losses Jan 2025-Jul 2026; secrecy, arrest threats, medical-license threats; prepaid cards,
  couriers, wires, crypto, crypto kiosks. https://www.ic3.gov/PSA/2026/PSA260917
- FTC Data Spotlight, Aug 2025, "False alarm, real scam": "someone is using your accounts", "your SSN
  is linked to a crime"; Bitcoin ATMs in 33% of $10K+ older-adult losses, gold in 21% of $100K+ cases.
  https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2025/08/false-alarm-real-scam-how-scammers-are-stealing-older-adults-life-savings
- FTC Data Spotlight, Sep 2024, "Bitcoin ATMs: a payment portal for scammers".
  https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2024/09/bitcoin-atms-payment-portal-scammers
- FTC Consumer Alerts on fake FTC "agents" offering paid scam recovery (2025-05, 2026-06, 2026-08).
  https://consumer.ftc.gov/consumer-alerts/2026/08/have-you-lost-money-scam-watch-scammers-who-say-they-can-help
- FBI "Virtual Kidnapping" and FBI San Francisco's warning on AI voice cloning of family members.
  https://www.fbi.gov/news/stories/virtual-kidnapping

What the refresh found: before the refresh, the detector prompt listed "gift cards, wire, crypto,
courier, prepaid card" as unusual payments. On the gold-bar courier script (scam_024) it scored LOW,
HIGH, MEDIUM and HIGH across four runs. Adding "Bitcoin ATM, gold" to that list made it HIGH in 3/3
runs; a longer wording also fixed it but cut signal recall on the original 21 scams from ~0.83 to
~0.76, so the minimal wording shipped.
