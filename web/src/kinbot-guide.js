"use strict";

// "Get started" guide for the KinBot chat (uses the shared guide.js). Steps tick themselves off by
// watching the chat for each kind of result, so kinbot-app.js doesn't need to know about the guide.
(function () {
  if (!window.KinGuide || /[?&]preview=/.test(location.search)) return;
  const $ = (s) => document.querySelector(s);
  const all = (s) => Array.from(document.querySelectorAll(s));
  const last = (s) => { const a = all(s); return a[a.length - 1] || null; };
  const svg = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
  const IC = {
    msg: svg('<path d="M4 5h16v11H9l-5 4z" />'),
    agent: svg('<circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" />'),
    ask: svg('<circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01" />'),
    shot: svg('<rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" />'),
    voice: svg('<rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />'),
    call: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />'),
  };
  const exampleCard = () => all("#kb-cards button, #kb-more button").find((b) => /grandson/i.test(b.textContent)) || $("#kb-cards button");
  const hasVerdict = () => !!$(".kb-ans");

  KinGuide.init({
    id: "kinbot",
    title: "Check anything suspicious",
    help: "Six quick things to try. Each one points at the real button.",
    blockers: ["#kb-auth"],
    mobileBottom: "96px",
    steps: [
      { k: "check", t: "Check a suspicious message", d: "Kip quotes the exact words that worry it.", icon: IC.msg,
        tip: "Try the “grandson in jail” text. Kip reads it on Amazon Bedrock and shows every warning sign in the sender’s own words.",
        target: () => exampleCard() || $("#kb-input"),
        action: { label: "Check the example", time: "5 s", run: () => { const b = exampleCard(); if (b) b.click(); else $("#kb-input").focus(); } } },
      { k: "investigate", t: "See Kip investigate", d: "An agent checks links, numbers and scam lists.", icon: IC.agent,
        locked: () => (hasVerdict() ? null : "Unlocks after your first check"),
        tip: "After every verdict, Kip’s agent looks up the website owner, phishing lists and phone numbers, then tells you the next step.",
        target: () => last(".kb-inv") || last(".kb-ans"), action: { label: "Got it" } },
      { k: "ask", t: "Ask a follow-up", d: "“What do I do if I already paid?”", icon: IC.ask,
        locked: () => (hasVerdict() ? null : "Unlocks after your first check"),
        tip: "Tap a suggested question, or switch to Ask and type your own. Answers come from FTC-based safety guidance.",
        target: () => (last(".kb-suggest button") || $("#tab-ask")),
        action: { label: "Ask it", run: () => { const b = last(".kb-suggest button"); if (b) b.click(); else { $("#tab-ask").click(); $("#kb-input").focus(); } } } },
      { k: "shot", t: "Check a screenshot", d: "Paste, drop or attach a picture of a text.", icon: IC.shot,
        tip: "Kip reads the words in the picture and looks for visual tricks like fake logos and QR codes. You can also paste with Ctrl/⌘+V.",
        target: () => $("#kb-add-shot"), action: { label: "Choose a screenshot", run: () => $("#kb-add-shot").click() } },
      { k: "voice", t: "Check a voicemail", d: "Record it, or attach the audio file.", icon: IC.voice,
        tip: "Kip writes down what the caller said, word for word, then checks it like any other message.",
        target: () => $("#kb-mic"), action: { label: "Attach a recording", run: () => $("#kb-add-file").click() } },
      { k: "kinvoice", t: "Watch a scam call", d: "KinVoice warns family while the call is live.", icon: IC.call,
        tip: "KinVoice scores a phone call turn by turn and alerts the caregiver before any money moves.",
        target: () => $('a.kb-nav[href="kinvoice-app.html"]'),
        action: { label: "Open KinVoice", run: () => { KinGuide.done("kinvoice"); location.href = "kinvoice-app.html"; } } },
    ],
  });

  // Tick steps off from what appears in the chat.
  const tick = () => {
    if ($(".kb-ans")) KinGuide.done("check");
    if (all(".kb-inv").some((c) => !c.classList.contains("kb-inv-busy"))) KinGuide.done("investigate");
    if ($(".kb-bot:not(.kb-dots) > p")) KinGuide.done("ask"); // an Ask answer, not the typing dots
    all(".kb-read:not(.kb-read-busy) .kb-read-tag").forEach((t) => {
      if (/screenshot/i.test(t.textContent)) KinGuide.done("shot");
      if (/voicemail/i.test(t.textContent)) KinGuide.done("voice");
    });
    KinGuide.refresh();
  };
  let pending = 0;
  new MutationObserver(() => { clearTimeout(pending); pending = setTimeout(tick, 200); })
    .observe($("#kb-log"), { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  document.addEventListener("click", (e) => { if (e.target.closest('a[href="kinvoice-app.html"]')) KinGuide.done("kinvoice"); });
})();
