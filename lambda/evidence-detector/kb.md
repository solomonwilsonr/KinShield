# KinShield support knowledge base
<!-- Grounding for POST /chat ("Ask Kip"). Every "## " heading is a citable source label;
     the handler rejects any source the model returns that is not one of these headings.
     Keep this in sync with web/src/index.html (FAQ, pricing, roadmap). -->

## About KinShield
KinShield protects older parents from phone scams that impersonate family. It listens for what a call is asking someone to believe and do (impersonation, secrecy, payment pressure) rather than judging whether the voice is real, so it works even when the voice is a perfect clone of a relative. An adult child (the caregiver) sets it up once; the protected parent has nothing to install, open, or configure. KinShield is pre-launch: this website is a live demo on AWS, not a product for sale.

## How it works
Five steps, one continuous flow. 1) Set up once: the caregiver installs it a single time; Mom has no app to open. 2) Listen: KinShield reads the call turn by turn on Amazon Bedrock. 3) Score: it tags 7 scam signals and quotes the exact line for each. 4) Alert: the caregiver gets a push alert the moment risk crosses HIGH. 5) Verify: FamilyVerify pings the real family member on a channel the caller can't touch.

## Risk score and signals
The detector looks for seven fixed signals: impersonation, emergency, secrecy, financial request, payment anomaly (gift cards, wire, crypto, courier), authority pressure (police, IRS, bank, lawyer), and unusual urgency. Each signal it finds gets a weight from 5 to 30 and must quote the exact transcript line that triggered it, so the score is never a bare percentage. Secrecy and unusual payment methods weigh most (25-30) because they rarely have an innocent explanation; urgency or authority alone weigh least (5-15). The weights add up to the risk score: 0-24 is LOW, 25-59 is MEDIUM, 60 and above is HIGH. A single signal on its own is capped at weight 10, so one innocent element (a surprise-party secret, a small family loan) can't make an ordinary call look dangerous. A friendly greeting like "Hi Grandma, it's me" is not a signal by itself.

## FamilyVerify
FamilyVerify is the out-of-band check. With one tap, the caregiver pings the real family member (for example, Danny's mom) on a channel the caller can't reach, asking whether that person is really the one calling. If the real Danny is safe at school, the call is a scam, however real his voice sounds. In the demo, answering "No" marks the caller as NOT VERIFIED.

## HIGH-risk alert
When a call reaches HIGH risk, KinShield shows the caregiver an alert with the recommended action and the top three signals, each with its quoted line, plus buttons to verify with family or dismiss. In a real deployment this would be a push notification to the caregiver's phone.

## Try the live demo
Open the KinVoice demo (kinvoice-app.html, linked from the KinVoice page) and press "Try scam call" to watch KinShield score a scam conversation turn by turn on Amazon Bedrock, or "Try safe call" to see it stay quiet on an ordinary chat. You can also pick any of the 63 scripted calls from the Calls list, or type your own call. No sign-up is needed.

## Scam patterns tested
The 63 demo calls are synthetic scripts written from public fraud patterns published by the FTC (Consumer Sentinel) and the FBI's IC3 (for example IC3 PSA 231117 on AI-enabled family-emergency scams). None is a recording of a real victim. They cover grandparent emergencies and bail, fake bank fraud departments, IRS/SSA and Medicare impersonation, tech-support refunds, bail-bond "attorneys", gift-card payments, prizes and fake charities, and newer 2024-2026 patterns: "Phantom Hacker" calls that pass you from fake tech support to a fake bank to a fake government agent, gold bars handed to a "federal courier", cash fed into a Bitcoin ATM, AI-cloned voices in fake kidnappings, fake FTC "agents" charging to recover lost money, and FBI or DEA impostors threatening arrest or a license, code-mixed Hindi-English (Hinglish) calls, and ordinary family chats that should stay LOW.

## Who it's for
Two people in every family. The caregiver (usually an adult child) sets KinShield up once, gets a push alert when risk hits HIGH, reads the cited evidence line by line, verifies with family out-of-band, and can mark a call safe. The protected parent keeps their phone exactly as it is: nothing to install or open, no settings, no new habit; calls from family ring through as before, and KinShield only speaks up when it matters.

## Why it's needed
Cloned voices fool the ear and spoofed caller ID fools the phone. On-device scam detection on today's phones is opt-in and does not run on calls from saved contacts, which are exactly the numbers a grandparent scam fakes. KinShield's idea is delegated protection: a trusted family member watches for the pattern so the parent doesn't have to.

## Planned pricing
Nothing is for sale yet and KinShield has no paying customers; everything on the website is free to try today. KinShield plans one plan for both services, called KinShield Family: about $5-10 per month per protected person. It includes KinVoice (calls scored live on Amazon Bedrock, caregiver alerts that quote the exact words, FamilyVerify with trusted contacts, and fraud reports ready for the FTC or IC3) and KinBot (checks of texts, screenshots and voicemails, the link investigator, scam-safety questions to Kip, and saved check history for people who sign in). Later: several protected people on one plan (price to be decided), and plans for senior living, credit unions, and benefit plans. The plan is shown on the KinShield homepage.

## Roadmap
Now (live): the scripted demo with behavioral detection on Bedrock, the caregiver dashboard, and cited evidence, reachable with no sign-up. Next: real calls through Amazon Chime SDK PSTN and Amazon Transcribe feeding the same detector, plus live caregiver push. Then: KinModel on-device, a small classifier for the same signals (lower latency, better privacy, no per-call cloud cost). Later: WhatsApp/SMS monitoring, multi-parent family plans, and broader bank, government, and tech-support scam coverage. Only the first stage is shipped.

## Built on AWS
The demo runs on Amazon Bedrock (OpenAI gpt-oss-20b for the detector and the investigator agent, Qwen3-VL for screenshots and Mistral Voxtral for voicemails, called through Bedrock's OpenAI-compatible endpoint), AWS Lambda, Amazon API Gateway, Amazon DynamoDB, Amazon S3, Amazon Polly, AWS Secrets Manager and, for optional sign-in, Amazon Cognito, and was built and deployed with a coding agent connected to the AWS account for the AWS "Zero to Shipped" hackathon. This support assistant, Kip, uses the same Bedrock model and answers only from this knowledge base.

## FAQ: Fake or cloned voices
Does KinShield detect fake or cloned voices? No, on purpose. Voice-clone detection is an arms race that gets harder as clones improve. KinShield reads what a call is asking someone to believe and do, so it works even against a perfect clone.

## FAQ: Paying customers
Do you have paying customers? No. KinShield is pre-launch. The demo is real and live on AWS, but the product is not for sale and it does not claim any users.

## FAQ: Location check
Is the location check real? It's simulated in this demo. It compares a caller's stated location against a device the real person chose to share. It never tracks the caller. It is illustrative, not a shipped feature.

## FAQ: Real phone calls
Does it work on real phone calls? Not yet. The public demo runs on scripted transcripts. Live-call handling (Amazon Chime SDK + Amazon Transcribe) is designed and on the roadmap, but it is not the shipped path today.

## FAQ: Data stored
What data do you store? Everything works without signing up. The call demo stores per-session risk events (risk level, score, and evidence count) in DynamoDB, with no phone number or contact list involved. Messages, screenshots and voicemails sent to KinBot or Kip are processed in memory and not stored. Signing in to KinBot is optional (email or Google, through Amazon Cognito); if you sign in, KinBot saves only each check's verdict, headline and date for 90 days so you can see your history, never the message itself, and you can delete that history at any time from your account.

## KinBot: Check a message
Can I check a text or email? Yes, with KinBot (kinbot.html), KinShield's free scam checker. Paste a text, an email, or what a caller said, up to 2,000 characters. The same evidence detector (gpt-oss-20b on Amazon Bedrock) looks for the seven warning signs, and KinBot shows the exact words that raised each one, a risk level, and what to do next. You can then ask follow-up questions. A small experimental model we trained, KinModel, gives a clearly labelled second opinion. After the verdict, an AI agent investigates: it looks up who registered any website, checks public phishing lists, opens the link safely from AWS (without running its code, and with tracking codes removed), checks phone numbers against Caribbean "one-ring" codes and companies' published numbers, checks email senders, and looks up crypto wallets on the public blockchain. You can also upload a screenshot (a vision model on Amazon Bedrock reads the words and looks at logos, links and QR codes) or a voicemail recording (a speech model on Bedrock writes down what was said). KinBot can be wrong, can't see your phone or accounts, and doesn't store what you paste. Signing in is optional and only keeps a history of verdicts.

## FAQ: Advice disclaimer
Is this medical, legal, or financial advice? No. KinShield is a fraud-signal tool and an educational demo. If you think you've been scammed, contact your bank and report it to the FTC (reportfraud.ftc.gov) or the FBI's IC3 (ic3.gov).

## Warning signs
KinShield teaches three habits: pause (don't act under pressure), check (call a number you already trust), and ask for support (talk with someone you trust). It explains the seven warning signs: "It's me" isn't proof; a crisis is the hook; "don't tell anyone" is a red flag when paired with money; a specific sum needed right now is a warning; gift cards, wires, crypto, and couriers are hard to reverse and real agencies don't demand them; genuine police, IRS, Medicare, or banks don't threaten arrest or ask for prepaid cards by phone; and "do it in the next ten minutes" is how scams beat good judgment.

## After a scam
If money or account details were already shared: contact the bank or payment provider promptly through its official app or the number on your card, and ask whether the payment can be stopped or reversed (recovery isn't guaranteed). Keep messages and receipts. Report it to the FTC at reportfraud.ftc.gov or the FBI's IC3 at ic3.gov. Be wary of anyone who asks for an upfront fee to recover money; that's often a second scam. If you're supporting someone, start with kindness: thank them for telling you, don't blame them, and work through the next steps together.
