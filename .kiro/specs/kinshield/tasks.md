# KinShield -- Tasks

Work through these in order. Each day must end with the app deployable and publicly live -- the
hackathon ship gate is pass/fail with no partial credit, so never leave the stack in a broken state
overnight. Deadline: 2026-10-02, 11:59pm PT -- confirm today's date and adjust remaining days.

## Day 0 (do this before writing any code)
- [ ] Confirm which local AWS CLI profile is the user's PERSONAL account (not the `default`
      work/Sirius profile, which has Bedrock inference blocked by an Org SCP -- see design.md).
      Ask the user directly if it isn't obvious.
- [ ] Verify Bedrock works on that profile: `aws bedrock-runtime converse` against a real model
      via a `us.`-prefixed inference profile ID (list them first). If this fails, STOP and report
      it -- do not proceed on a broken account.
- [ ] Read `README.md`, `lambda/evidence-detector/prompt.md`, `benchmark/sources.md`, and the
      existing files in `benchmark/scenarios/` in this project -- they are normative, not drafts.
- [ ] Set up `docs/proof/` capture habit now: screenshot/log every AWS action this agent takes,
      starting with this profile-verification step.

## Day 1 -- Tier 1 (MUST work): core intelligence + reachable demo
- [ ] Deploy minimal AWS stack (SAM/CDK): Lambda + Function URL or API Gateway, S3 + CloudFront,
      DynamoDB table. Confirm the CloudFront URL is live and publicly reachable before continuing.
- [ ] Implement the evidence-detector Lambda exactly per `lambda/evidence-detector/prompt.md`'s
      system prompt and JSON schema. Validate output shape; reject/retry on malformed JSON.
- [ ] Implement the scenario player serving `benchmark/scenarios/*.json`.
- [ ] Build the public landing page: "Try Safe Call" / "Try Scam Call" buttons, live transcript,
      accumulating risk meter, evidence checklist with quoted lines.
- [x] FamilyVerify (simulated, R5a): VERIFY CALLER opens a modal that "pings" the person the
      caller claims to be (`claimed_identity` on the scenario), shows the specific ask, and lets
      the demo operator answer YES/NO as that person. NO flips the protected screen to "CALLER NOT
      VERIFIED -- do not send money." Labeled "Simulated for this demo" in the UI -- never imply a
      real notification was sent. Done in `web/src/app.js` + `index.html` + `styles.css`.
- [x] Perfect Clone Challenge badge (R5b): dashboard always shows "voice match 100% / caller ID
      trusted contact -- detection runs on conversation content alone," making explicit that the
      demo assumes the hardest case. No detector changes needed -- it never reads audio anyway.
- [ ] Run the 6 existing scenarios (scam_001-003, benign_001-003) through the real pipeline. Confirm
      benign scenarios score LOW with zero fabricated evidence -- this is a hard requirement
      (R6/benchmark integrity), not a nice-to-have.
- [ ] End of day: app must be live, both demo buttons must work end to end, zero login required.
      Capture proof: CloudFormation UPDATE_COMPLETE, live URL, agent's AWS calls.

## Day 2 -- polish the reachable demo + expand the benchmark
- [ ] Expand `benchmark/scenarios/` toward the full KinShield-100 (50 benign + 50 scam), each citing
      a real source per `benchmark/sources.md`'s convention. Include genuinely ambiguous cases
      (e.g. "I need $100 urgently for the plumber," "don't tell your sister about the birthday
      gift") so the benchmark isn't just cartoonishly obvious scams -- a detector that only catches
      the obvious ones isn't proving much.
- [ ] Build the caregiver dashboard view (richer than the plain landing page): full evidence
      breakdown, VERIFY CALLER / MARK SAFE buttons (wire up the UI even before Tier 3's backend
      logic exists).
- [ ] Run the full KinShield-100 through the real detector. Compute and record recall,
      false-positive rate, detection latency, evidence accuracy. Save results (this feeds the
      write-up's headline numbers).
- [ ] End of day: app still live, dashboard view working, benchmark results file committed.

## Day 3 -- Tier 2 (SHOULD work): real telephony
- [ ] Only start this after Day 1's demo is rock solid -- do not let telephony risk the reachable
      web demo.
- [ ] Provision a real phone number via Amazon Chime SDK PSTN / Amazon Connect.
- [ ] Wire inbound call -> Chime meeting -> Amazon Transcribe streaming -> evidence-detector Lambda
      -> dashboard, live.
- [ ] Test by actually calling the number and running through a scam scenario and a benign one out
      loud.
- [ ] End of day: web demo (Tier 1) still fully working regardless of Tier 2's outcome. If Tier 2
      isn't solid by end of day, it becomes a "documented but not guaranteed live" bonus in the
      write-up rather than something judges are told to rely on -- do not let it jeopardize the
      ship gate.

## Day 4 -- Tier 3 (stretch) + ship
- [ ] If time allows: WebSocket push warning to a companion client + family-verification firewall
      (VERIFY CALLER / NOT MY [RELATIVE]) per requirements.md R5. Skip cleanly if short on time --
      this tier is explicitly optional.
- [ ] Reliability pass: mobile UI check, re-run the full KinShield-100 one more time, fix any
      regressions.
- [ ] Finish `docs/proof/`: architecture diagram, screenshots (agent-aws.png, cloudformation.png,
      live-app.png, bedrock.png), CloudTrail export showing `aws-mcp.amazonaws.com`, demo transcripts.
- [ ] Write the Builder Center submission (6,000-10,000 characters): specific-claim title (e.g.
      "You don't have to detect a fake voice to stop a fake emergency"), the headline finding (real
      stats + benchmark results, framed as the Perfect Clone Challenge per R5b), what it does,
      try-it link, architecture and key decisions, how the coding agent shipped it (with the proof
      above), 1-2 honest debugging stories, FamilyVerify demo walkthrough (clearly labeled
      simulated), an optional short "commercialization path" sketch (free tier -> paid family tier
      -> B2B API for banks/carriers -- described, not built) for the startup lane, honest limits
      (constructed benchmark, not a real-scam corpus; Tier 2/3 status; FamilyVerify is simulated),
      category/lane at the top (`#commercial-potential` `#startup`).
- [ ] Record a short demo video if time allows (almost no other entries have one).
- [ ] Re-verify the live URL from an incognito window, and re-check both Builder Center tags are
      set, BEFORE 2026-10-02 11:59pm PT. Submit with buffer, not at the last minute.

## Non-negotiable throughout
- Never leave the deployed stack broken overnight -- redeploy the last known-good version if a
  change breaks it and there's no time to fix forward.
- Never fabricate benchmark results or claim Tier 2/3 works if it doesn't -- the write-up's
  credibility depends on being honest about exactly what's real vs. demoed vs. stretch, same as
  the hackathon's own strongest entries (Firsthand, PlateGap, Buyable) were rewarded for.
