"""Extra scenarios added Day 4: Hinglish (Hindi-English code-mixed) calls and a location-consistency
pair. Hand-written, same schema as generate_scenarios.py. Optional fields:
  language            -- "hinglish" (default English)
  claimed_location    -- where the caller says they are (demo metadata, NOT produced by the detector)
  trusted_device      -- SIMULATED opted-in device location of the real person being impersonated
The 7-signal taxonomy and the detector are unchanged; location is a display-only consistency check.
Run: python3 generate_extra.py
"""
import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scenarios")

def T(rows):
    return [{"t": t, "speaker": s, "text": x} for (t, s, x) in rows]

SCENARIOS = [
    dict(id="scam_019", label="scam", language="hinglish",
         title="[Hinglish] Beta in trouble, UPI transfer",
         sources=["FTC/IC3 family-emergency pattern, code-mixed Hindi-English variant"],
         claimed_identity="Rohan",
         turns=T([
             ("00:00", "caller", "Nani, main Rohan bol raha hoon. Please suno, main badi problem mein hoon."),
             ("00:06", "caller", "Mera accident ho gaya hai aur police ne mujhe pakad liya hai."),
             ("00:12", "victim", "Hai Ram! Kya hua beta?"),
             ("00:15", "caller", "Mummy ko mat batana, woh ghabra jayegi. Abhi 50,000 rupaye UPI se bhejne padenge warna FIR ho jayegi."),
             ("00:24", "caller", "Jaldi karo, 10 minute mein bhejna hai. Main ek number de raha hoon, us par bhej do."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "emergency", "secrecy", "financial_request", "unusual_urgency"]}),
    dict(id="scam_020", label="scam", language="hinglish",
         title="[Hinglish] Fake customs/CBI officer, pay to avoid arrest",
         sources=["FTC/IC3 government-impersonation pattern, code-mixed Hindi-English variant"],
         turns=T([
             ("00:00", "caller", "Main CBI officer bol raha hoon. Aapke naam se ek parcel pakda gaya hai jisme illegal saman hai."),
             ("00:08", "victim", "Par maine toh koi parcel nahi bheja."),
             ("00:12", "caller", "Case darj ho chuka hai. Aapko abhi 75,000 rupaye jama karne honge, gift card ya crypto se, warna arrest."),
             ("00:21", "caller", "Yeh baat kisi ko mat batana aur phone mat katna, nahi toh case aur badh jayega."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["authority_pressure", "financial_request", "payment_anomaly", "secrecy", "unusual_urgency"]}),
    dict(id="benign_024", label="benign", language="hinglish",
         title="[Hinglish] Son confirming Sunday lunch",
         sources=["Ordinary family logistics, code-mixed Hindi-English"],
         turns=T([
             ("00:00", "caller", "Hello Mummy, main hoon. Sunday ko lunch pe aa raha hoon, theek hai?"),
             ("00:06", "victim", "Haan beta, zaroor aao. Kya khaoge?"),
             ("00:09", "caller", "Rajma chawal bana do, bahut din ho gaye. Main mithai le aaunga."),
         ]),
         expected={"risk_level": "LOW", "evidence_signals": []}),
    dict(id="benign_025", label="benign", language="hinglish",
         title="[Hinglish] Surprise party secret (hard negative)",
         sources=["Ambiguous benign: secrecy phrase with a wholesome reason, code-mixed Hindi-English"],
         turns=T([
             ("00:00", "caller", "Mummy, Papa ko mat batana, main unke 60th birthday pe surprise party kar raha hoon."),
             ("00:07", "victim", "Arre wah! Main kuch nahi bolungi."),
             ("00:10", "caller", "Saturday shaam ko unhe bahar le jaana, main tab tak ghar sajaa doonga."),
         ]),
         expected={"risk_level": "LOW", "evidence_signals": []}),
    dict(id="scam_021", label="scam",
         title="Son 'stuck in London' needs money (location mismatch)",
         sources=["FTC/IC3 family-emergency pattern; location claim checked against opted-in device (simulated)"],
         claimed_identity="Daniel",
         claimed_location="London, UK",
         trusted_device={"person": "Daniel", "location": "Chicago, US", "opted_in": True, "simulated": True},
         turns=T([
             ("00:00", "caller", "Mom, it's me, Daniel. I'm in London and my wallet was stolen, I'm stuck."),
             ("00:07", "victim", "Oh no, London? I thought you were at work."),
             ("00:11", "caller", "I'm here for a conference. I need $2,000 wired right now for a hotel and a flight home."),
             ("00:18", "caller", "Please don't tell Dad, I don't want him worrying. It has to go out in the next hour."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "emergency", "financial_request", "payment_anomaly", "secrecy", "unusual_urgency"]}),
    dict(id="benign_026", label="benign",
         title="Son really travelling, calls from London (location matches)",
         sources=["Ordinary call; claimed location matches opted-in device (simulated)"],
         claimed_location="London, UK",
         trusted_device={"person": "Daniel", "location": "London, UK", "opted_in": True, "simulated": True},
         turns=T([
             ("00:00", "caller", "Hi Mom, it's Daniel. Just landed in London for the conference, all good."),
             ("00:06", "victim", "Wonderful, how was the flight?"),
             ("00:09", "caller", "Smooth. I'll text you photos of the hotel. Talk Sunday?"),
         ]),
         expected={"risk_level": "LOW", "evidence_signals": []}),
]

for s in SCENARIOS:
    with open(os.path.join(OUT, s["id"] + ".json"), "w", encoding="utf-8") as f:
        json.dump(s, f, indent=2, ensure_ascii=False)
print("wrote", ", ".join(s["id"] for s in SCENARIOS))
