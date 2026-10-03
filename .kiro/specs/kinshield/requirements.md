# KinShield -- Requirements

## Context
Entry for the AWS Builder Center "Zero to Shipped" hackathon. Deadline 2026-10-02, 11:59pm PT.
Category: #commercial-potential. Lane: #startup. Full official rules: see ../../../../CLAUDE.md
in the hackathon repo root (one level above this project) if present, otherwise ask the user.

Hackathon hard constraints that shape every requirement below:
- Ship gate is pass/fail: the app must be live on AWS, publicly reachable, at time of evaluation
  (through roughly the week of Oct 19), with NO EXCEPTIONS.
- Must include documented proof of coding-agent connection to the AWS console.
- Core flow must work with NO LOGIN, so an AI scoring system and human judges can both reach it.
- Original app, not previously published. Document AWS services and the coding agent used.

## Problem
Google/Samsung ship live, on-device scam-call detection (Gemini Nano, 2025-2026). By their own
documentation (support.google.com/phoneapp/answer/15654065, Feb 2026) it is OFF BY DEFAULT,
opt-in, and "never used in calls with your contacts." It protects a device owner who has a modern
phone and actively turns the feature on. It does nothing for a grandparent with an old phone who
will never configure a setting, and nothing against a caller whose number (or cloned voice) looks
like a trusted contact.

FBI IC3 2025: 201,266 victims aged 60+, $7.7B in reported losses (+59% YoY), $352M+ specifically
attributed to AI-related fraud (3,100+ complaints).

## Solution requirement
Build KinShield: a DELEGATED fraud-protection system. A caregiver (adult child) configures
protection once, FOR a parent who does nothing themselves. The system detects the BEHAVIOR of a
dangerous conversation (impersonation, urgency, secrecy, payment escalation, authority pressure) --
not voice-clone detection, which is an unwinnable arms race. It must work even against a perfect
voice clone, because it reasons about what the conversation is asking the listener to believe and
do, not about whether the audio itself is synthetic.

## Functional requirements

### R1. Evidence-based detection (not a bare score)
The system SHALL analyze a call transcript and output structured, cited evidence -- never a bare
"87% scam" style probability. Full contract, fixed signal taxonomy (7 signals), and the tested
system prompt already exist at `lambda/evidence-detector/prompt.md` in this project. Read that file
before implementing; it is normative, not a suggestion.

### R2. Two interfaces
- Protected person's screen: extremely simple, shows only a "PROTECTED" status, no clutter.
- Caregiver dashboard: live transcript, an accumulating risk meter, an evidence checklist tied to
  the fixed signal taxonomy (each item quoting the transcript line that triggered it), and two
  action buttons: VERIFY CALLER and MARK SAFE.

### R3. Demo path that requires no phone call (Tier 1, MUST work)
A public web page with two buttons: "Try Safe Call" and "Try Scam Call." Pressing one plays/steps
through a scripted scenario (see `benchmark/scenarios/`), and the detector output populates the
dashboard live, evidence appearing as the (simulated) call progresses, risk meter rising. This is
the PRIMARY path the ship gate's "AI scoring system" will actually be able to exercise -- a scorer
almost certainly interacts over HTTP, not by placing a phone call. Do not treat this as optional or
secondary to telephony. It must be flawless before telephony work starts.

### R4. Real phone call path (Tier 2, SHOULD work)
A real, publicly dialable phone number. A live caller's audio streams through the same detection
pipeline in near-real-time and appears on the caregiver dashboard. Build after R3 is solid.

### R5. Family-verification firewall + out-of-band warning (Tier 3, STRETCH)
When risk is MEDIUM/HIGH, the caregiver dashboard offers VERIFY CALLER / NOT MY [RELATIVE]. If the
caregiver marks it unverified, push a warning to the protected person's device. IMPORTANT: do this
via a WebSocket push to a companion app/browser client, not by attempting to inject audio into only
one leg of a live PSTN call. That primitive was investigated and is NOT reliably supported by the
Chime SDK (the documented mechanism mixes attendee audio; there is no confirmed server-side
per-leg-only routing). Do not attempt it; it is a real risk to the ship gate if it fails under
demo conditions. The out-of-band-push design is the resolved, lower-risk approach -- build that.

### R5a. FamilyVerify (P1, build a simulated version now)
The security model KinShield sells is not "prove the voice is real" (unwinnable) but "let the real
family member confirm, out-of-band, whether they actually made this request." Implemented in the
web demo (`web/src/app.js`, `runFamilyVerify`/`resolveFamilyVerify`) as: clicking VERIFY CALLER
"pings" the person the caller claims to be (`claimed_identity` field on the scenario JSON), shows
the specific financial ask being verified, and the demo operator plays that person's role by
clicking YES/NO. A "NO" flips the protected person's screen to "CALLER NOT VERIFIED -- do not send
money"; a "YES" clears it. The modal is explicitly labeled "Simulated for this demo" -- never claim
a real push notification was sent, since none is. This is honest storytelling, not the finished
product; a real push-to-device implementation is the natural Tier 3 evolution of R5's WebSocket
design, not a separate feature.

### R5b. Perfect Clone Challenge framing
The detector already ignores audio/voice entirely (R1 operates on transcript text only), so the
"stress test" is a framing exercise, not new detector code: every demo run displays a small badge
("voice match 100%, caller ID trusted contact") making explicit that the scenario assumes the
attacker has already defeated voice-clone detection and caller ID, and KinShield still catches it
from conversation content alone. For the write-up, frame the existing KinShield-100 results (R6)
under this explicit assumption rather than building a separate benchmark subset -- the headline
claim is "we deliberately didn't check whether the voice was fake, and still caught it."

### R6. KinShield-100 benchmark
50 benign + 50 scam scenarios. No public corpus of real scam-call transcripts/audio exists --
already checked, confirmed absent. Every scenario must be a synthetic script, clearly labeled as
such, constructed from a real cited source (see `benchmark/sources.md`). Never present a scenario
as a real recording. Publish recall, false-positive rate, detection latency, and evidence accuracy
in the submission write-up. A false positive on a benign scenario (e.g. confirming dinner plans, a
pharmacy reminder) is a benchmark failure -- do not let the detector over-trigger on ordinary calls.

### R7. No login for the core flow
Anyone must be able to open the public URL and run R3 (Try Safe Call / Try Scam Call) with zero
sign-up. The caregiver dashboard for the demo can be the same public page (this is a demo, not a
production multi-tenant system).

## Non-functional requirements
- Keep the architecture minimal and reliable -- the ship gate has no partial credit.
- No AWS account IDs or ARNs in anything published (README, screenshots, write-up).
- Capture agent-connection proof (CloudTrail export, MCP config, `sts get-caller-identity` output,
  `UPDATE_COMPLETE` confirmation, screenshots) into `docs/proof/` AS YOU GO, not at the end.
- Stay live through roughly the week of 2026-10-19 (judging window) -- set a billing alarm, don't
  tear the stack down after submitting.

## Explicitly out of scope for this hackathon build
- Voice-clone / deepfake-audio detection. Do not build this. It is an arms race we cannot win in
  days, and the whole point of the design is that it works without needing it.
- Production-hardened PSTN reliability. Tier 2's real phone number needs to work for a live demo,
  not survive arbitrary call volume.
- Multi-tenant accounts, billing, or a real signup flow. This is a hackathon demo of the product.
