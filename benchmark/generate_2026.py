"""2026 refresh: scenarios for scam patterns from 2024-2026 FTC/IC3/FBI alerts that the original
set did not cover, plus hard-negative benign calls that share surface features with them.
Hand-written, same schema as generate_scenarios.py. Synthetic scripts, never real recordings.

Sources (see sources.md, "2026 refresh"):
  IC3 PSA 230929  "Phantom Hacker" scams (tech support -> bank -> government, layered personas)
  IC3 PSA 240129  couriers collecting cash / gold from seniors; dollar-bill serial as passcode
  IC3 PSA 260917  law-enforcement / government impersonation (Sep 2026): secrecy, arrest threats,
                  license threats against medical professionals; crypto kiosks, couriers, wires
  FTC Data Spotlight Aug 2025 "False alarm, real scam": "someone is using your accounts",
                  "your SSN is linked to a crime"; Bitcoin ATMs, gold, couriers to "protect" money
  FTC Data Spotlight Sep 2024 "Bitcoin ATMs: a payment portal for scammers"
  FTC Consumer Alerts 2025-05 / 2026-06 / 2026-08: fake FTC "agents" with badge numbers who
                  offer to recover money lost to scams for a fee
  FBI "Virtual Kidnapping" + FBI San Francisco AI voice-cloning warning

Run: python3 generate_2026.py
"""
import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scenarios")

IC3_PHANTOM = "IC3 PSA 230929: 'Phantom Hacker' layered tech-support/bank/government impostors"
IC3_COURIER = "IC3 PSA 240129: couriers collect cash or gold from seniors to 'protect' funds"
IC3_GOV26 = "IC3 PSA 260917 (Sep 2026): law-enforcement/government impersonation, secrecy, arrest threats"
FTC_SPOT25 = "FTC Data Spotlight Aug 2025: 'False alarm, real scam' -- accounts/SSN 'compromised'"
FTC_BTM = "FTC Data Spotlight Sep 2024: Bitcoin ATMs as a payment portal for scammers"
FTC_RECOVERY = "FTC Consumer Alerts 2025-05, 2026-06, 2026-08: fake FTC 'agents' offering paid scam recovery"
FBI_VK = "FBI 'Virtual Kidnapping' warnings + FBI SF warning on AI voice cloning of family members"


def T(rows):
    return [{"t": t, "speaker": s, "text": x} for (t, s, x) in rows]


SCAM = [
    dict(title="'Microsoft' says your bank was hacked, hands you to the 'bank' (Phantom Hacker)",
         sources=[IC3_PHANTOM],
         turns=T([
             ("00:00", "caller", "Hello, this is Kevin from Microsoft Security. Your computer sent us an alert that hackers are inside your online banking."),
             ("00:09", "victim", "Oh my goodness, what do I do?"),
             ("00:12", "caller", "I'm transferring you to the fraud team at your bank right now. Stay on the line and do not hang up."),
             ("00:19", "caller", "This is Linda, bank fraud department. The hackers are draining your savings. You need to move all of it today, before 5 p.m."),
             ("00:29", "caller", "Do not tell the teller why. If they ask, say it is for a home renovation. The hacker may be someone who works at the branch."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "authority_pressure", "unusual_urgency", "financial_request", "secrecy"]}),
    dict(title="'Federal Reserve' agent: move savings to a 'protected' account (Phantom Hacker, stage 3)",
         sources=[IC3_PHANTOM, FTC_SPOT25],
         turns=T([
             ("00:00", "caller", "Mrs. Allen, I'm Agent Torres with the Federal Reserve. Your bank already told you your accounts are compromised."),
             ("00:08", "caller", "The government will hold your money in a protected account until this is resolved. I'll give you the account number to wire it to."),
             ("00:17", "victim", "All of it? That's my retirement."),
             ("00:20", "caller", "All of it, today. This is a federal case, so you cannot discuss it with family. Anyone could be involved."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "authority_pressure", "financial_request", "payment_anomaly", "secrecy", "unusual_urgency"]}),
    dict(title="Buy gold bars, a 'federal courier' will collect them (dollar-bill passcode)",
         sources=[IC3_COURIER, FTC_SPOT25],
         turns=T([
             ("00:00", "caller", "This is Officer Reed, Treasury Department. To keep your savings safe from the identity thieves, you must convert it to gold."),
             ("00:09", "caller", "Withdraw the cash and buy gold bars at the dealer I name. A federal courier will come to your house tonight to secure them."),
             ("00:18", "victim", "Someone is coming to my house?"),
             ("00:21", "caller", "Yes. Give him the gold only after he reads you the serial number of the dollar bill I'm about to give you. Tell no one, not even your children."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "authority_pressure", "financial_request", "payment_anomaly", "secrecy", "unusual_urgency"]}),
    dict(title="'Your Social Security number is linked to drug smuggling' -- deposit cash in a Bitcoin ATM",
         sources=[FTC_SPOT25, FTC_BTM],
         turns=T([
             ("00:00", "caller", "This is the Social Security Administration. Your Social Security number was found in a car with drugs at the border."),
             ("00:08", "caller", "Your bank accounts will be frozen within the hour. To protect your money, you must withdraw it and deposit it in a Bitcoin ATM."),
             ("00:17", "victim", "I've never used one of those."),
             ("00:20", "caller", "I'll stay on the phone and walk you through it at the gas station. Don't hang up and don't speak to anyone in the store."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "authority_pressure", "unusual_urgency", "financial_request", "payment_anomaly", "secrecy"]}),
    dict(title="AI-cloned granddaughter crying, then a 'kidnapper' demands ransom (virtual kidnapping)",
         sources=[FBI_VK],
         claimed_identity="Emma",
         turns=T([
             ("00:00", "caller", "Grandma! Grandma, it's Emma, please help me, they took me, I'm so scared --"),
             ("00:06", "caller", "Listen carefully. We have your granddaughter. If you hang up or call the police, you will never see her again."),
             ("00:14", "victim", "Please don't hurt her! What do you want?"),
             ("00:17", "caller", "Eight thousand dollars, by wire, in the next thirty minutes. Stay on this line the whole time. I'll give you the account."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "emergency", "secrecy", "financial_request", "payment_anomaly", "unusual_urgency"]}),
    dict(title="Fake FTC 'agent' with a badge number offers to recover lost money -- for a fee",
         sources=[FTC_RECOVERY],
         turns=T([
             ("00:00", "caller", "Good afternoon, I'm Agent Miller with the Federal Trade Commission, badge number 4471. You lost money to an online scam last year, correct?"),
             ("00:10", "victim", "Yes, about six thousand dollars."),
             ("00:13", "caller", "We recovered your funds. To release them, you just pay a processing fee of $499 with gift cards today."),
             ("00:20", "caller", "The offer closes at the end of business. Please keep this confidential, it's an active investigation."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "authority_pressure", "financial_request", "payment_anomaly", "unusual_urgency", "secrecy"]}),
    dict(title="'FBI agent' collecting on a legal judgment, arrest unless you pay now",
         sources=[IC3_GOV26],
         turns=T([
             ("00:00", "caller", "This is Special Agent Hughes, FBI. A court entered a legal judgment against you, and there is a warrant for your arrest."),
             ("00:09", "victim", "A judgment? For what?"),
             ("00:11", "caller", "You can clear it today with a payment of $3,200. If you don't, officers will be at your door this evening."),
             ("00:19", "caller", "I can only speak with you, so do not put anyone else on the phone. We accept prepaid cards or cryptocurrency."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "authority_pressure", "financial_request", "payment_anomaly", "unusual_urgency", "secrecy"]}),
    dict(title="Retired nurse told her license is suspended, pay a 'bond' (medical-license impostor)",
         sources=[IC3_GOV26],
         turns=T([
             ("00:00", "caller", "This is Investigator Grant with the DEA. Prescriptions under your nursing license were linked to a trafficking case."),
             ("00:08", "victim", "I retired years ago, that can't be right."),
             ("00:11", "caller", "Your license will be revoked and you will be charged unless you post a $5,000 bond today."),
             ("00:18", "caller", "Send it by bank wire to the escrow account I give you. This case is sealed, so don't discuss it with anyone."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "authority_pressure", "financial_request", "payment_anomaly", "unusual_urgency", "secrecy"]}),
    dict(title="'New number, Grandpa' -- voice-clone grandson asks for a Zelle payment",
         sources=[FBI_VK, "FTC 2023 alert: scammers use AI to enhance family emergency schemes"],
         claimed_identity="Leo",
         turns=T([
             ("00:00", "caller", "Grandpa, it's Leo. I lost my phone, this is my new number, save it."),
             ("00:06", "victim", "Leo? You sound a little different."),
             ("00:09", "caller", "I've got a cold. Listen, I'm in trouble, I rear-ended someone and they want $1,800 cash or they call the police."),
             ("00:17", "caller", "Can you Zelle it to my friend's account right now? And please don't tell Mom, she'll kill me."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "emergency", "financial_request", "payment_anomaly", "secrecy", "unusual_urgency"]}),
    dict(title="'Amazon' says someone is using your account, refund via Bitcoin ATM",
         sources=[FTC_SPOT25, FTC_BTM],
         turns=T([
             ("00:00", "caller", "This is Amazon account security. Someone in another state just used your account to buy a $1,400 laptop."),
             ("00:08", "caller", "The hacker also has access to your bank. We need you to move your money into a secure wallet before they empty it."),
             ("00:16", "victim", "How do I do that?"),
             ("00:18", "caller", "Take out cash and feed it into the Bitcoin machine at the pharmacy. Do it now, and don't tell the bank, they may be compromised."),
         ]),
         expected={"risk_level": "HIGH", "evidence_signals": ["impersonation", "unusual_urgency", "financial_request", "payment_anomaly", "secrecy"]}),
]

BENIGN = [
    dict(title="Real bank fraud alert: 'call the number on the back of your card'",
         sources=["Hard negative for the Phantom Hacker scenarios: genuine automated fraud alert, no payment or secrecy"],
         turns=T([
             ("00:00", "caller", "This is an automated message from your bank's fraud department about a card purchase at an electronics store."),
             ("00:07", "caller", "If you made this purchase, press 1. If not, please hang up and call the number on the back of your card."),
             ("00:14", "caller", "We will never ask for your PIN or ask you to move money over the phone."),
         ]),
         expected={"risk_level": "LOW", "evidence_signals": []}),
    dict(title="Grandson really got a new number, no request",
         sources=["Hard negative for the 'new number' scam: same opener, no money, emergency, or secrecy"],
         claimed_identity="Leo",
         turns=T([
             ("00:00", "caller", "Hi Grandpa, it's Leo! New phone, new number, can you save this one?"),
             ("00:06", "victim", "Got it. How's school?"),
             ("00:09", "caller", "Good, finals are done. Still on for pancakes Sunday?"),
             ("00:13", "victim", "Wouldn't miss it."),
         ]),
         expected={"risk_level": "LOW", "evidence_signals": []}),
    dict(title="Daughter: Dad fell, we're at the hospital, come when you can",
         sources=["Hard negative: a real family emergency with no money, payment, or secrecy request"],
         turns=T([
             ("00:00", "caller", "Mom, it's Maya. Dad slipped on the porch steps, we're at St. Mary's. He's okay, they think it's just a sprained wrist."),
             ("00:09", "victim", "Oh no. Should I come now?"),
             ("00:11", "caller", "Come when you're ready, no rush. Bring his reading glasses, he keeps asking for them."),
         ]),
         expected={"risk_level": "LOW", "evidence_signals": []}),
    dict(title="Police non-emergency line: your wallet was turned in",
         sources=["Hard negative for law-enforcement impostors: a real officer, no threat, no payment"],
         turns=T([
             ("00:00", "caller", "Hello, this is Officer Diaz at the Maple Street station. Someone turned in a wallet with your ID in it."),
             ("00:07", "victim", "Oh, thank goodness, I've been looking everywhere."),
             ("00:10", "caller", "You can pick it up at the front desk any day this week. Just bring another form of ID."),
         ]),
         expected={"risk_level": "LOW", "evidence_signals": []}),
    dict(title="Son asks Mom to pick up gift cards for the grandkids' birthdays",
         sources=["Hard negative: 'gift cards' mentioned as actual gifts, no urgency, authority, or secrecy"],
         turns=T([
             ("00:00", "caller", "Hi Mom. The twins' birthday is next weekend. They'd love bookstore gift cards from you this year."),
             ("00:07", "victim", "That's easy. Twenty-five each?"),
             ("00:10", "caller", "Perfect. Bring them to the party Saturday, they can open them with the cake."),
         ]),
         expected={"risk_level": "LOW", "evidence_signals": []}),
    dict(title="Real Medicare plan rep returns her call about a dentist",
         sources=["Hard negative for Medicare impostors: a returned call, no payment or personal data request"],
         turns=T([
             ("00:00", "caller", "Hi, this is Dana from your Medicare Advantage plan, returning your call about dental coverage."),
             ("00:07", "victim", "Yes, I wanted to know if Dr. Patel is in network."),
             ("00:10", "caller", "She is. Your cleaning is covered twice a year with no copay. Anything else I can help with?"),
         ]),
         expected={"risk_level": "LOW", "evidence_signals": []}),
]


def main():
    existing = os.listdir(OUT)
    def next_id(prefix):
        nums = [int(f.split("_")[1].split(".")[0]) for f in existing if f.startswith(prefix + "_")]
        return max(nums)
    s, b = next_id("scam"), next_id("benign")
    written = []
    for label, items, start in (("scam", SCAM, s), ("benign", BENIGN, b)):
        for i, d in enumerate(items, start=start + 1):
            sid = f"{label}_{i:03d}"
            path = os.path.join(OUT, sid + ".json")
            # never overwrite an existing scenario
            if os.path.exists(path):
                raise SystemExit(f"{path} exists")
            obj = {"id": sid, "label": label, **d}
            with open(path, "w") as f:
                json.dump(obj, f, indent=2, ensure_ascii=False)
                f.write("\n")
            written.append(sid)
    print("wrote", len(written), ":", ", ".join(written))


if __name__ == "__main__":
    main()
