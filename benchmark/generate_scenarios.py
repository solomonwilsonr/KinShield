"""KinShield-100 scenario generator.

Emits individually-authored benign and scam scenarios as JSON into scenarios/, matching the
existing schema (id, label, title, sources, turns, expected). Every scenario is a curated,
hand-written script -- NOT a random template -- constructed to match a cited FTC/IC3 pattern
(scam) or an ordinary real-life call (benign). The benign set deliberately includes AMBIGUOUS
cases (a real small money request, a benign secret) that must still score LOW, to prove the
detector isn't just catching cartoonish scams.

Seed scenarios scam_001-003 / benign_001-003 already exist and are left untouched; this generator
writes scam_004+ and benign_004+.

Run: python3 generate_scenarios.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "scenarios")

# ---------------------------------------------------------------------------
# BENIGN scenarios (must score LOW, zero evidence). Includes ambiguous cases.
# Each: (title, sources[], turns[(t,speaker,text)])
# ---------------------------------------------------------------------------
BENIGN = [
    ("Grandson asks to borrow $100 for a real plumber",
     ["Ambiguous benign: small legitimate money request, no other signals"],
     [("00:00", "caller", "Hey Grandma, it's me. Quick thing -- the plumber's here fixing the kitchen sink and I'm $100 short until payday."),
      ("00:09", "victim", "Oh no, is it bad?"),
      ("00:12", "caller", "Just a leaky valve, nothing serious. Can I swing by tomorrow and grab it, or I can Venmo you back Friday?"),
      ("00:20", "victim", "Of course, come by tomorrow and we'll have lunch."),
      ("00:24", "caller", "Perfect, thanks. Love you.")]),
    ("Daughter keeps a birthday surprise secret",
     ["Ambiguous benign: a secrecy phrase with a wholesome reason, no money/urgency"],
     [("00:00", "caller", "Hi Mom, don't tell Dad, but I'm throwing him a surprise party for his 70th."),
      ("00:07", "victim", "Oh how fun! My lips are sealed."),
      ("00:10", "caller", "Can you keep him busy Saturday afternoon so I can set up?"),
      ("00:15", "victim", "I'll take him to the garden center, he loves that.")]),
    ("Pharmacy refill ready",
     ["Ordinary automated service call"],
     [("00:00", "caller", "Hello, this is Cedar Pharmacy. Your prescription is ready for pickup."),
      ("00:06", "victim", "Great, thank you. Until when are you open?"),
      ("00:09", "caller", "Until 8pm tonight, no rush.")]),
    ("Doctor's office appointment reminder",
     ["Ordinary healthcare reminder"],
     [("00:00", "caller", "Hi, this is Dr. Alvarez's office reminding you of your checkup on Thursday at 10."),
      ("00:07", "victim", "Thursday at 10, got it."),
      ("00:10", "caller", "If you need to reschedule just call us back. Have a good day.")]),
    ("Grandson confirming weekend visit",
     ["Ordinary family logistics"],
     [("00:00", "caller", "Grandma it's me, still good for me to come up Saturday?"),
      ("00:05", "victim", "Yes please! Will you stay for dinner?"),
      ("00:08", "caller", "Definitely. I'll bring the dog too if that's okay.")]),
    ("Bank fraud department genuine verification (inbound the user initiated)",
     ["Ambiguous benign: legitimate bank call about a charge, no payment demand"],
     [("00:00", "caller", "Hi, this is Meridian Bank returning your call about the charge you flagged."),
      ("00:06", "victim", "Yes, I didn't recognize a $60 charge from an online store."),
      ("00:11", "caller", "We've removed it and are reissuing your card. You don't need to do anything or pay anything."),
      ("00:18", "victim", "Wonderful, thank you.")]),
    ("Neighbor asking to water plants",
     ["Ordinary neighborly call"],
     [("00:00", "caller", "Hi, it's Dave from next door. We're away this week -- could you water the ferns?"),
      ("00:07", "victim", "Happy to. Spare key still under the mat?"),
      ("00:11", "caller", "Yep. Thanks so much, we'll bring you something back.")]),
    ("Son sharing news about a new job",
     ["Ordinary family call"],
     [("00:00", "caller", "Mom, I got the job! Starting the first of the month."),
      ("00:05", "victim", "That's wonderful, I'm so proud of you."),
      ("00:08", "caller", "Thanks. Let's celebrate this weekend, my treat.")]),
    ("Library book due reminder",
     ["Ordinary automated reminder"],
     [("00:00", "caller", "This is the county library. Two books are due back on Friday."),
      ("00:06", "victim", "Thanks, I'll drop them off tomorrow.")]),
    ("Church volunteer scheduling",
     ["Ordinary community call"],
     [("00:00", "caller", "Hi, it's Marge from the parish. Can you help with the bake sale Sunday?"),
      ("00:06", "victim", "Of course, what should I bring?"),
      ("00:09", "caller", "Your famous lemon bars would be perfect.")]),
    ("Insurance agent annual review, no payment",
     ["Ambiguous benign: financial-adjacent call, but no request for money or urgency"],
     [("00:00", "caller", "Hello, this is your State Mutual agent. It's time for your annual policy review."),
      ("00:07", "victim", "Sure, is my premium changing?"),
      ("00:10", "caller", "It's staying the same. No action needed, I just wanted to confirm your coverage still fits.")]),
    ("Grandchild venting about a rough day",
     ["Ordinary emotional-but-benign family call"],
     [("00:00", "caller", "Grandpa, I had the worst day, I bombed my exam."),
      ("00:06", "victim", "Oh sweetheart, one exam won't define you."),
      ("00:10", "caller", "Thanks for listening. I just needed to hear a friendly voice.")]),
    ("Dentist confirming cleaning",
     ["Ordinary reminder"],
     [("00:00", "caller", "Hi, Bright Smile Dental confirming your cleaning next Tuesday at 2."),
      ("00:06", "victim", "Tuesday at 2, thank you.")]),
    ("Utility scheduled-maintenance notice",
     ["Ordinary utility notice (matches the seed benign_003 pattern family)"],
     [("00:00", "caller", "Automated notice from Valley Water: hydrant flushing in your area Thursday morning."),
      ("00:08", "victim", "Alright, good to know."),
      ("00:11", "caller", "No action needed. Details at valleywater.example.gov.")]),
    ("Friend arranging a lunch",
     ["Ordinary social call"],
     [("00:00", "caller", "It's Helen! Want to do lunch at the diner Thursday?"),
      ("00:05", "victim", "I'd love that. Noon?"),
      ("00:08", "caller", "Noon it is.")]),
    ("Grandson asking for a recipe",
     ["Ordinary family call"],
     [("00:00", "caller", "Grandma, it's me -- how do you make your pot roast? I'm trying to impress someone."),
      ("00:07", "victim", "Ooh, who is she? Start with a good chuck roast..."),
      ("00:12", "caller", "You're the best, thank you.")]),
    ("Vet reminding about pet vaccination",
     ["Ordinary reminder"],
     [("00:00", "caller", "Hi, this is Parkside Vet. Bella is due for her rabies shot this month."),
      ("00:07", "victim", "Thanks, I'll book a time online.")]),
    ("Son asking to borrow the truck",
     ["Ambiguous benign: a request (not money), casual, no pressure"],
     [("00:00", "caller", "Hey Dad, could I borrow the truck Saturday to move a couch?"),
      ("00:06", "victim", "Sure, just fill the tank when you're done."),
      ("00:10", "caller", "Deal, thanks.")]),
    ("School letting a grandparent know about early dismissal",
     ["Ordinary institutional notice"],
     [("00:00", "caller", "Hello, this is Lincoln Elementary. Early dismissal Friday at 1pm for staff training."),
      ("00:08", "victim", "Thanks, I'll pick him up at 1.")]),
    ("Daughter confirming holiday travel",
     ["Ordinary family logistics"],
     [("00:00", "caller", "Mom, our flight lands at 6 on the 23rd. Can Dad grab us?"),
      ("00:07", "victim", "He'll be there with the big car for the luggage."),
      ("00:11", "caller", "Perfect, see you soon!")]),
]

# ---------------------------------------------------------------------------
# SCAM scenarios (must score MEDIUM/HIGH). Each cites an FTC/IC3 pattern.
# ---------------------------------------------------------------------------
SCAM = [
    ("Grandparent scam -- wire transfer for bail",
     ["IC3 PSA 231117", "FTC grandparent-scam pattern"],
     [("00:00", "caller", "Grandma, it's me, please don't be mad."),
      ("00:04", "caller", "I got in a car wreck and I'm in jail. Don't tell Dad, he'll kill me."),
      ("00:11", "victim", "Oh my goodness, what do you need?"),
      ("00:14", "caller", "My lawyer needs $3,500 wired to post bail in the next hour or I stay the weekend."),
      ("00:22", "caller", "Please, just wire it to this account and don't tell anyone, it's embarrassing.")],
     ["impersonation", "emergency", "secrecy", "financial_request", "payment_anomaly", "unusual_urgency"]),
    ("SSA impersonation -- suspended number, gift cards",
     ["IC3 government-impersonation pattern", "FTC SSA-impersonation alerts"],
     [("00:00", "caller", "This is the Social Security Administration. Your number has been suspended due to suspicious activity."),
      ("00:08", "victim", "Suspended? How is that possible?"),
      ("00:11", "caller", "To reactivate it and avoid arrest you must verify funds by purchasing $500 in gift cards today."),
      ("00:19", "caller", "Do not discuss this with anyone, it is a federal matter.")],
     ["authority_pressure", "payment_anomaly", "financial_request", "secrecy", "unusual_urgency"]),
    ("Tech support -- remote access and payment",
     ["FTC tech-support scam pattern"],
     [("00:00", "caller", "Ma'am, this is Microsoft Support. We detected a virus sending your banking data to hackers."),
      ("00:08", "victim", "Oh no, what do I do?"),
      ("00:11", "caller", "Let me connect to your computer remotely, and you'll need to pay a $299 fee to remove it."),
      ("00:18", "caller", "Please buy a prepaid card at the pharmacy and read me the number, quickly, before more data leaks.")],
     ["authority_pressure", "financial_request", "payment_anomaly", "unusual_urgency"]),
    ("Fake grandchild -- hospital, courier cash pickup",
     ["IC3 PSA 231117", "courier cash-pickup variant"],
     [("00:00", "caller", "Grandma? It's your grandson. I'm hurt, I'm in the hospital."),
      ("00:06", "caller", "Please don't tell Mom, I don't want her to worry."),
      ("00:10", "victim", "Are you okay?? What happened?"),
      ("00:13", "caller", "I need $2,000 for the treatment. A courier will come to your door to pick up the cash in an hour."),
      ("00:21", "caller", "Have it ready and don't mention this to anyone.")],
     ["impersonation", "emergency", "secrecy", "financial_request", "payment_anomaly", "unusual_urgency"]),
    ("IRS -- arrest warrant, crypto payment",
     ["IC3 government-impersonation pattern", "crypto-payment variant"],
     [("00:00", "caller", "This is the IRS Criminal Division. There is a warrant for your arrest over back taxes."),
      ("00:08", "victim", "A warrant? I always pay my taxes."),
      ("00:11", "caller", "You can settle immediately by depositing $4,200 into this Bitcoin address to cancel the warrant."),
      ("00:19", "caller", "Stay on the line. Do not hang up or contact anyone or officers will be dispatched.")],
     ["authority_pressure", "financial_request", "payment_anomaly", "unusual_urgency", "secrecy"]),
    ("Utility shutoff -- immediate prepaid card",
     ["FTC utility-scam pattern"],
     [("00:00", "caller", "This is City Power. Your bill is overdue and power will be shut off in 30 minutes."),
      ("00:07", "victim", "But I paid last week!"),
      ("00:10", "caller", "Our system shows otherwise. Pay $210 now with a prepaid card to avoid disconnection."),
      ("00:17", "caller", "Go to the store now and call me back with the card number, the truck is already en route.")],
     ["authority_pressure", "financial_request", "payment_anomaly", "unusual_urgency"]),
    ("Romance -- overseas emergency wire",
     ["FTC romance-scam pattern"],
     [("00:00", "caller", "Darling, it's David. My project overseas hit a snag and customs is holding my equipment."),
      ("00:08", "victim", "Oh dear, what can I do?"),
      ("00:11", "caller", "If you could wire $5,000 to release it I'll pay you back the moment I fly home to you."),
      ("00:19", "caller", "Please keep this between us, I don't want your kids thinking less of me.")],
     ["financial_request", "payment_anomaly", "secrecy", "emergency"]),
    ("Lottery -- pay fees to claim prize",
     ["FTC prize/lottery-scam pattern"],
     [("00:00", "caller", "Congratulations! You've won $50,000 in the state sweepstakes!"),
      ("00:06", "victim", "Really? I don't remember entering."),
      ("00:09", "caller", "To release the funds we just need a $600 processing fee in gift cards today."),
      ("00:16", "caller", "This offer expires at midnight, so act now and keep it confidential until you're paid.")],
     ["financial_request", "payment_anomaly", "unusual_urgency", "secrecy"]),
    ("Bank 'fraud dept' -- move money to safe account",
     ["FTC bank-impersonation / 'safe account' pattern"],
     [("00:00", "caller", "This is your bank's fraud team. Someone is draining your account right now."),
      ("00:07", "victim", "Oh no, what should I do?"),
      ("00:10", "caller", "To protect it, transfer your balance to this secure holding account immediately."),
      ("00:17", "caller", "Don't tell the branch staff, they may be involved. Act in the next few minutes.")],
     ["authority_pressure", "financial_request", "secrecy", "unusual_urgency"]),
    ("Arrest-for-missed-jury-duty -- courier",
     ["IC3 government-impersonation / jury-duty variant"],
     [("00:00", "caller", "This is Deputy Harris. You missed federal jury duty and a bench warrant was issued."),
      ("00:08", "victim", "I never got a summons!"),
      ("00:11", "caller", "You can clear it with a $1,500 fine. A courier will collect it, or buy gift cards to pay now."),
      ("00:19", "caller", "Do not discuss this with family; it could be seen as evading arrest.")],
     ["authority_pressure", "financial_request", "payment_anomaly", "secrecy", "unusual_urgency"]),
    ("Amazon 'unauthorized order' -- refund scam",
     ["FTC refund/account-scam pattern"],
     [("00:00", "caller", "This is Amazon security. A $1,200 order was placed on your account."),
      ("00:07", "victim", "I didn't order anything!"),
      ("00:10", "caller", "To reverse it we'll need remote access and a gift-card verification of your identity."),
      ("00:17", "caller", "Please stay on the line and don't hang up until it's resolved.")],
     ["authority_pressure", "payment_anomaly", "unusual_urgency"]),
    ("Grandchild -- DUI lawyer follow-up",
     ["IC3 PSA 231117 two-call attorney variant"],
     [("00:00", "caller", "Hello, I'm the attorney representing your granddaughter after her DUI arrest."),
      ("00:07", "victim", "She called crying earlier. Is she okay?"),
      ("00:10", "caller", "She's fine but bail is $7,000 by wire within the hour, or she's held over the weekend."),
      ("00:18", "caller", "The judge ordered a gag on the case, so please don't call the court or tell relatives.")],
     ["impersonation", "authority_pressure", "financial_request", "payment_anomaly", "secrecy", "unusual_urgency"]),
    ("Medicare -- new card, pay to activate",
     ["FTC Medicare-scam pattern"],
     [("00:00", "caller", "This is Medicare. Your benefits will lapse unless we issue a new card today."),
      ("00:07", "victim", "I didn't know it was expiring."),
      ("00:10", "caller", "There's a $150 activation fee -- a prepaid card works. We must process it in the next few minutes.")],
     ["authority_pressure", "financial_request", "payment_anomaly", "unusual_urgency"]),
    ("Charity -- disaster relief high-pressure",
     ["FTC fake-charity pattern"],
     [("00:00", "caller", "We're collecting for hurricane victims and your neighbors have all pledged $200."),
      ("00:07", "victim", "That's a lot for me right now."),
      ("00:10", "caller", "Every minute counts for these families -- can you give gift cards or a wire today?"),
      ("00:17", "caller", "Please don't mention the amount to others, we keep donors private.")],
     ["financial_request", "payment_anomaly", "unusual_urgency", "secrecy"]),
    ("Debt collector -- threat of arrest",
     ["FTC fake-debt-collector pattern"],
     [("00:00", "caller", "This is a legal collections office regarding a payday loan in default."),
      ("00:07", "victim", "I don't have any payday loans."),
      ("00:10", "caller", "Our records disagree. Pay $900 today by wire or we'll send officers to your home."),
      ("00:17", "caller", "Handle this now and quietly, before it goes on your permanent record.")],
     ["authority_pressure", "financial_request", "payment_anomaly", "unusual_urgency", "secrecy"]),
]


def _turns(rows):
    return [{"t": t, "speaker": s, "text": x} for (t, s, x) in rows]


def write():
    written = []
    # benign start at 004
    n = 4
    for (title, sources, rows) in BENIGN:
        sid = f"benign_{n:03d}"
        obj = {
            "id": sid, "label": "benign", "title": title, "sources": sources,
            "turns": _turns(rows),
            "expected": {"risk_level": "LOW", "evidence_signals": []},
        }
        with open(os.path.join(OUT, sid + ".json"), "w") as f:
            json.dump(obj, f, indent=2)
        written.append(sid)
        n += 1
    n = 4
    for (title, sources, rows, sigs) in SCAM:
        sid = f"scam_{n:03d}"
        obj = {
            "id": sid, "label": "scam", "title": title, "sources": sources,
            "turns": _turns(rows),
            "expected": {"risk_level": "HIGH", "evidence_signals": sigs},
        }
        with open(os.path.join(OUT, sid + ".json"), "w") as f:
            json.dump(obj, f, indent=2)
        written.append(sid)
        n += 1
    return written


if __name__ == "__main__":
    w = write()
    print(f"wrote {len(w)} scenarios: {', '.join(w)}")
