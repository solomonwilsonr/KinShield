// KinBot chat app (kinbot-chat.html). Three modes, picked with the top tabs or the composer menu:
//   Check       paste a message, add a screenshot or a voicemail -> cited verdict (POST /kinbot "check"),
//               then Kip's agent investigates the links and numbers ("investigate").
//   Ask         a scam-safety question, with the last check as context ("ask").
//   Investigate run only the agent on a message or link ("investigate").
// Screenshots are read by a vision model on Bedrock, Qwen3-VL, which reads the words and looks at the picture
// ("screenshot"). Voicemails are converted to 16 kHz WAV in the browser and transcribed by Voxtral on Bedrock
// ("voicemail").
// Messages live only in memory; nothing is stored. All user and model text goes in via textContent.
(function () {
  "use strict";

  const API = (window.KINSHIELD_API || "").replace(/\/$/, "");
  const CHECK_MAX = 2000;
  const ASK_MAX = 500;
  const MAX_HISTORY = 6;
  const IMG_MAX_SIDE = 1600; // screenshots are resized in the browser before upload
  const AUDIO_MAX_FILE = 25_000_000; // before conversion; the WAV we send is capped by AUDIO_MAX_S
  const AUDIO_MAX_S = 110; // 16 kHz mono WAV stays under the 4 MB VOICE_MAX_BYTES in handler.py
  const REC_MAX_S = 90;
  const V = "?v=20261002-20";

  const EXAMPLES = [
    {
      title: "“Grandma, it's me, I'm in jail”", short: "Grandson in jail",
      text: "Grandma it's me, I got in a car accident and I'm at the police station. Please don't tell Mom. I need $2,000 for bail today. Can you get Target gift cards and read me the numbers?",
    },
    {
      title: "Bank “fraud team” text", short: "Bank text",
      text: "Chase Fraud Dept: Unusual sign-in detected on your account. Your account will be locked in 30 minutes. Verify now at chase-secure-verify.co and do not share this alert with anyone.",
    },
    {
      title: "Gift-card “release fee”", short: "Prize fee",
      text: "Congratulations! You have won $850,000 in the National Sweepstakes. To release your prize you must pay a $250 processing fee today with Google Play gift cards. Reply with the card numbers within 24 hours or the prize goes to the next winner.",
    },
    {
      title: "Pharmacy refill reminder", short: "Pharmacy (real)", real: true,
      text: "Walgreens: Your prescription is ready for pickup at the Main St store. Pickup hours are 9am-9pm. Reply STOP to opt out of texts.",
    },
  ];
  const ICONS = {
    sms: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H10l-5 4z" /><path d="M9 10h6" /></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /><circle cx="16" cy="8.5" r="1.4" /></svg>',
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17h.01" /></svg>',
    money: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9v.01M18 15v.01" /></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>',
  };
  // Quick-start cards under the greeting.
  const CARDS = [
    { icon: "sms", title: "Check a message", desc: "Paste a text or email. Kip quotes the exact words that worry it.", go: "check" },
    { icon: "image", title: "Check a screenshot", desc: "Upload a screenshot. Kip reads the words, looks at the picture and checks every link.", go: "shot" },
    { icon: "alert", title: "Grandson in jail", desc: "“Grandma, it's me. I need bail in gift cards — don't tell Mom.”", go: "example", ex: 0, risk: true },
    { icon: "money", title: "Already sent money?", desc: "What to do in the next hour, and who to call first.", go: "say", text: "I already sent them money with gift cards. What do I do now?" },
  ];
  const CALLBACK_SCRIPT =
    "I'm going to hang up and call you back on the number I already have. If this is real, it can wait two minutes.";
  const MODE_COPY = {
    check: { label: "Message to check", send: "Check it", ph: "Paste a text, email or voicemail — or add a screenshot", max: CHECK_MAX },
    ask: { label: "Your question", send: "Ask", ph: "Ask Kip a scam-safety question…", max: ASK_MAX },
    investigate: { label: "Message or link to investigate", send: "Investigate", ph: "Paste a message or a link — Kip checks who's behind it", max: CHECK_MAX },
  };

  const $ = (id) => document.getElementById(id);
  const log = $("kb-log");
  const empty = $("kb-empty");
  const form = $("kb-form");
  const input = $("kb-input");
  const send = $("kb-send");
  const status = $("kb-status");
  const composer = $("kb-composer");
  const attachRow = $("kb-attach-row");
  const modeSelect = $("kb-mode-select");
  const shell = document.querySelector(".kb-shell");
  const isPhone = () => window.matchMedia("(max-width: 900px)").matches;

  let mode = "check";
  let busy = false;
  let history = []; // [{role, content}] text-only, for follow-up questions
  let context = null; // {risk_level, signals} of the last check
  let attachment = null; // {kind: "image", dataUrl, name} | {kind: "audio", b64, mime, name, seconds?}

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function announce(msg) { status.textContent = ""; setTimeout(() => { status.textContent = msg; }, 30); }
  function scrollDown() { log.scrollTop = log.scrollHeight; }
  function keepInView(row) {
    if (row.offsetHeight > log.clientHeight * 0.8) log.scrollTop = row.offsetTop - log.offsetTop - 12;
    else scrollDown();
  }

  // API Gateway cuts requests at 30 s, so anything slower than this has hung; stop waiting and say so.
  const REQUEST_TIMEOUT_MS = 40000;
  async function fetchKinbot(body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(`${API}/kinbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new Error(e.name === "AbortError" ? "Kip took too long to answer. Please try again." : "Kip couldn't be reached. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
    }
  }

  async function post(body) {
    const res = await fetchKinbot(body);
    const r = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(r.error || `HTTP ${res.status}`);
    return r;
  }

  // ---- Mode ----
  function setMode(m) {
    mode = m;
    const c = MODE_COPY[m];
    document.querySelectorAll(".kb-tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.mode === m)));
    modeSelect.value = m;
    input.maxLength = c.max;
    input.placeholder = m === "ask" && context ? "Ask a follow-up, like “should I reply?” or “what if I already clicked?”" : c.ph;
    $("kb-input-label").textContent = c.label;
    send.setAttribute("aria-label", c.send);
    updateCount();
  }

  function updateCount() {
    const n = input.value.length;
    const max = MODE_COPY[mode].max;
    send.disabled = busy || recording() || ((!input.value.trim() || n > max) && !attachment);
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 200) + "px";
  }

  function setBusy(b) {
    busy = b;
    document.querySelectorAll(".kb-card-btn, .kb-hist, .kb-more button, .kb-tool, .kb-suggest button").forEach((x) => { x.disabled = b; });
    updateCount();
  }

  // The composer sits under the greeting on the home screen and docks at the bottom once a chat starts.
  function placeDock() {
    const home = !log.querySelector(".kb-row");
    const slot = home ? $("kb-dock-home") : $("kb-dock-bottom");
    if (form.parentNode !== slot) slot.appendChild(form);
  }

  // ---- Rendering ----
  function addMe(text, opts) {
    opts = opts || {};
    empty.hidden = true;
    const row = el("div", "kb-row kb-row-me");
    const b = el("div", "kb-me");
    if (opts.image) {
      const im = el("img", "kb-me-img");
      im.src = opts.image;
      im.alt = "Your screenshot";
      b.appendChild(im);
    }
    if (opts.audio) {
      const a = el("div", "kb-me-audio");
      a.innerHTML = ICONS.mic;
      a.appendChild(el("span", null, opts.audio));
      b.appendChild(a);
    }
    if (opts.tag) b.appendChild(el("span", "kb-me-tag", opts.tag));
    if (text) b.appendChild(opts.image ? el("span", "kb-me-cap", text) : document.createTextNode(text));
    row.appendChild(b);
    log.appendChild(row);
    placeDock();
    scrollDown();
  }

  function botRow() {
    const row = el("div", "kb-row kb-row-bot");
    const av = el("img", "kb-av");
    av.src = "img/mascot-face.png" + V;
    av.alt = "";
    row.appendChild(av);
    log.appendChild(row);
    return row;
  }

  function addTyping(label) {
    const row = botRow();
    const d = el("div", "kb-bot kb-dots");
    d.setAttribute("aria-label", label || "Kip is checking");
    d.append(el("i"), el("i"), el("i"));
    row.appendChild(d);
    scrollDown();
    return row;
  }

  function addError(msg) {
    botRow().appendChild(el("div", "kb-bot kb-error", msg));
    announce(msg);
    scrollDown();
  }

  function action(label, opts) {
    const a = opts.href ? el("a", "kb-act", label) : el("button", "kb-act", label);
    if (opts.href) { a.href = opts.href; if (/^https?:/.test(opts.href)) a.rel = "noopener"; } else a.type = "button";
    if (opts.primary) a.classList.add("kb-act-primary");
    if (opts.onClick) a.addEventListener("click", opts.onClick);
    return a;
  }

  function copyScript(btn) {
    const done = () => { btn.textContent = "Copied ✓"; setTimeout(() => { btn.textContent = "Copy a call-back script"; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(CALLBACK_SCRIPT).then(done, () => { btn.textContent = CALLBACK_SCRIPT; });
    } else {
      btn.textContent = CALLBACK_SCRIPT;
    }
  }

  // One plain-language word per risk level, used on badges and in the "This visit" list.
  const LEVEL_TEXT = { HIGH: "High risk", MEDIUM: "Be careful", LOW: "Looks safe" };
  const LEVEL_ICON = {
    HIGH: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M12 8.5v4M12 15.5h.01" /></svg>',
    MEDIUM: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17h.01" /></svg>',
    LOW: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>',
  };

  function badge(level, text) {
    const b = el("span", `kb-badge kb-badge-${level}`);
    b.innerHTML = LEVEL_ICON[level] || LEVEL_ICON.MEDIUM;
    b.appendChild(el("span", null, text || LEVEL_TEXT[level]));
    return b;
  }

  // A small "How Kip checked" fold for the technical notes, so the answer itself stays short.
  function details(summaryText, nodes) {
    const d = el("details", "kb-more-info");
    d.appendChild(el("summary", null, summaryText));
    const inner = el("div", "kb-more-body");
    nodes.filter(Boolean).forEach((n) => inner.appendChild(typeof n === "string" ? el("p", null, n) : n));
    d.appendChild(inner);
    return d;
  }

  function stepList(steps, cls) {
    const ol = el("ol", cls || "kb-todo");
    steps.forEach((s) => ol.appendChild(el("li", null, s)));
    return ol;
  }

  function renderVerdict(row, r) {
    const level = r.risk_level;
    const card = el("article", `kb-ans kb-ans-${level}`);
    card.setAttribute("aria-label", `KinBot verdict: ${LEVEL_TEXT[level] || level}`);

    const head = el("div", "kb-ans-head");
    head.appendChild(badge(level));
    if (r.latency_ms != null) head.appendChild(el("span", "kb-ans-time", `${(r.latency_ms / 1000).toFixed(1)}s`));
    card.appendChild(head);
    card.appendChild(el("h3", "kb-ans-title", r.headline));
    // The summary ends with "These are the exact words that worry me:" when signs follow; drop that
    // lead-in, because the section heading says it.
    const sum = (r.summary || "").replace(/\s*These are the exact words[^.]*:\s*$/i, "").trim();
    if (sum) card.appendChild(el("p", "kb-ans-sum", sum));

    if (r.signs && r.signs.length) {
      const sec = el("section", "kb-sec-block");
      sec.appendChild(el("h4", null, `Why Kip is worried · ${r.signs.length} warning sign${r.signs.length === 1 ? "" : "s"}`));
      const ul = el("ul", "kb-why");
      r.signs.forEach((s) => {
        const li = el("li");
        li.appendChild(el("b", null, s.label));
        li.appendChild(el("q", null, s.quote));
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      card.appendChild(sec);
    }

    const todo = el("section", "kb-sec-block kb-sec-todo");
    todo.appendChild(el("h4", null, level === "LOW" ? "Good habits, even when it looks fine" : "What to do now"));
    todo.appendChild(stepList(r.steps || []));
    card.appendChild(todo);

    const acts = el("div", "kb-actions");
    if (level !== "LOW") acts.appendChild(action("Report it to the FTC", { href: "https://reportfraud.ftc.gov/", primary: true }));
    const copyBtn = action("Copy a call-back script", { onClick: () => copyScript(copyBtn) });
    acts.appendChild(copyBtn);
    card.appendChild(acts);

    card.appendChild(details("How Kip checked this", [
      "gpt-oss-20b on Amazon Bedrock read the message and quoted the exact words behind each warning sign. Quotes that aren't really in your message are thrown away.",
      r.lite ? `Second opinion from KinShield-Lite, a tiny keyword model: ${Math.round(r.lite.score * 100)}% scam-like. It's experimental and can be wrong; Kip's answer comes first.` : null,
      "Nothing you paste is stored.",
    ]));
    row.appendChild(card);
  }

  function renderAnswer(row, r) {
    const b = el("div", "kb-bot");
    b.appendChild(el("p", null, r.answer));
    if (r.source) b.appendChild(el("p", "kb-source", `Source: ${r.source}`));
    row.appendChild(b);
    if (!r.card) return;
    const c = r.card;
    const level = c.kind === "urgent" ? "HIGH" : "MEDIUM";
    const card = el("article", `kb-ans kb-ans-${level}`);
    const head = el("div", "kb-ans-head");
    head.appendChild(badge(level, c.kind === "urgent" ? "Act now" : "Next steps"));
    card.appendChild(head);
    card.appendChild(el("h3", "kb-ans-title", c.title));
    const todo = el("section", "kb-sec-block kb-sec-todo");
    todo.appendChild(stepList(c.steps));
    card.appendChild(todo);
    const acts = el("div", "kb-actions");
    (c.actions || []).forEach((a) => {
      // The shared safety card links the homepage demo; here the paste box is the better next step.
      if (a.href === "kinvoice.html#demo") acts.appendChild(action("Paste the message to check it", { primary: true, onClick: () => { setMode("check"); input.focus(); } }));
      else acts.appendChild(action(a.label, { href: a.href, primary: a.primary }));
    });
    card.appendChild(acts);
    if (c.note) card.appendChild(el("p", "kb-meta", c.note));
    botRow().appendChild(card);
  }

  // Follow-up chips under a verdict: the questions people actually ask next.
  const FOLLOW_UPS = {
    HIGH: ["What if I already clicked or paid?", "Should I reply to them?", "How do I report this?"],
    MEDIUM: ["How can I check if it's real?", "Should I reply to them?", "What if I already clicked?"],
    LOW: ["Is there anything I should still check?", "What do real scams look like?"],
  };
  function clearSuggestions() { log.querySelectorAll(".kb-suggest").forEach((n) => n.remove()); }
  function addSuggestions(level) {
    clearSuggestions();
    const qs = FOLLOW_UPS[level] || FOLLOW_UPS.MEDIUM;
    const wrap = el("div", "kb-suggest");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Suggested follow-up questions");
    qs.forEach((q) => {
      const b = el("button", null, q);
      b.type = "button";
      b.addEventListener("click", () => submit(q, "ask"));
      wrap.appendChild(b);
    });
    log.appendChild(wrap);
  }

  // ---- Agent investigation (POST /kinbot mode "investigate") ----
  const TOOL_ICON = {
    inspect_link: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></svg>',
    check_threat_feeds: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>',
    visit_page: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></svg>',
    check_phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" /></svg>',
    lookup_guidance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v12H5z" /><path d="M9 12h6M9 16h6M14 4v4h4" /></svg>',
  };
  const LEVEL_WORD = { danger: "Danger", caution: "Caution", ok: "Looks fine", info: "Note" };
  // The agent's level mapped onto the verdict badges.
  const INV_LEVEL = { danger: "HIGH", caution: "MEDIUM", ok: "LOW" };
  const INV_TITLE = { danger: "Kip found a problem", caution: "Kip found something odd", ok: "The links look real", info: "Kip looked into it" };
  // Shorter, friendlier names for each tool's step.
  const TOOL_NAME = {
    inspect_link: "Website owner",
    check_threat_feeds: "Phishing lists",
    visit_page: "Opened the link safely",
    check_phone: "Phone number",
    lookup_guidance: "Scam advice",
  };

  function renderInvestigationPending() {
    const row = botRow();
    const card = el("article", "kb-inv kb-inv-busy");
    card.setAttribute("aria-label", "Kip is investigating");
    const head = el("div", "kb-inv-head");
    head.appendChild(el("span", "kb-spin"));
    head.appendChild(el("h3", null, "Kip is double-checking the links and numbers…"));
    card.appendChild(head);
    const ul = el("ul", "kb-plan");
    ["Who owns the website", "Known phishing lists", "The phone number's area code"].forEach((t) => ul.appendChild(el("li", null, t)));
    card.appendChild(ul);
    row.appendChild(card);
    scrollDown();
    return { row, card };
  }

  function renderInvestigation(card, r) {
    const lv = INV_LEVEL[r.level];
    card.className = `kb-inv kb-inv-${r.level}`;
    card.setAttribute("aria-label", "Kip's investigation");
    card.textContent = "";

    const head = el("div", "kb-inv-head");
    const tag = el("span", "kb-inv-tag", "AGENT");
    head.appendChild(tag);
    head.appendChild(el("h3", null, INV_TITLE[r.level] || INV_TITLE.info));
    if (lv) head.appendChild(badge(lv, LEVEL_WORD[r.level]));
    card.appendChild(head);

    // The conclusion first, then the checks behind it.
    card.appendChild(el("p", "kb-inv-sum", r.summary));
    if (r.next_step) {
      const next = el("p", "kb-inv-next");
      next.appendChild(el("b", null, "Next step"));
      next.appendChild(el("span", null, r.next_step));
      card.appendChild(next);
    }

    const ol = el("ul", "kb-checks");
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    r.steps.forEach((s, i) => {
      const li = el("li", `kb-check kb-check-${s.level}`);
      const d = el("details");
      if (s.level === "danger") d.open = true;
      const sm = el("summary");
      const ic = el("span", "kb-check-ic");
      ic.innerHTML = TOOL_ICON[s.tool] || TOOL_ICON.lookup_guidance;
      sm.appendChild(ic);
      const t = el("span", "kb-check-t");
      t.appendChild(el("b", null, TOOL_NAME[s.tool] || s.label));
      if (s.target && s.tool !== "lookup_guidance") t.appendChild(el("small", null, s.target.replace(/^https?:\/\//, "")));
      sm.appendChild(t);
      sm.appendChild(el("span", `kb-check-pill kb-check-pill-${s.level}`, LEVEL_WORD[s.level] || "Note"));
      d.appendChild(sm);
      const ul = el("ul", "kb-check-f");
      s.findings.forEach((f) => {
        const fi = el("li", `kb-f kb-f-${f.level}`);
        fi.appendChild(el("span", "kb-sr", `${LEVEL_WORD[f.level] || "Note"}: `));
        fi.appendChild(document.createTextNode(f.text));
        ul.appendChild(fi);
      });
      d.appendChild(ul);
      li.appendChild(d);
      if (!reduce) li.style.animationDelay = `${i * 160}ms`;
      ol.appendChild(li);
    });
    const label = el("p", "kb-checks-label", `${r.steps.length} check${r.steps.length === 1 ? "" : "s"} · tap one to see what Kip found`);
    card.appendChild(label);
    card.appendChild(ol);

    card.appendChild(details("How the investigation works", [
      `gpt-oss-20b chose which checks to run; the tools ran on AWS Lambda in ${(r.total_ms / 1000).toFixed(1)}s. Pages are fetched without running their code, and tracking codes are removed first.`,
      r.fallback ? "Some checks ran from Kip's built-in checklist because the model skipped them." : null,
    ]));
  }

  async function investigate(text, level) {
    const pending = renderInvestigationPending();
    try {
      const res = await fetchKinbot({ mode: "investigate", message: text, verdict: level });
      const r = await res.json().catch(() => ({}));
      if (!res.ok || r.kind !== "investigation") throw new Error(r.error || `HTTP ${res.status}`);
      renderInvestigation(pending.card, r);
      history.push({ role: "assistant", content: `Investigation: ${r.summary}`.slice(0, 500) });
      history = history.slice(-MAX_HISTORY);
      announce(`Investigation done. ${r.summary}`);
      if (pending.row.offsetTop > log.scrollTop) log.scrollTop = pending.row.offsetTop - log.offsetTop - 12;
      return r;
    } catch (e) {
      pending.card.className = "kb-inv";
      pending.card.textContent = "";
      pending.card.appendChild(el("p", "kb-inv-sub", "Kip couldn't finish investigating the links just now. The verdict above still stands."));
    }
    if (pending.row.offsetTop > log.scrollTop) log.scrollTop = pending.row.offsetTop - log.offsetTop - 12;
  }

  // ---- "What Kip read" card for a screenshot or voicemail ----
  function renderReadPending(kind) {
    const row = botRow();
    const card = el("article", "kb-read kb-read-busy");
    const head = el("div", "kb-read-head");
    head.appendChild(el("span", "kb-read-tag", kind === "image" ? "SCREENSHOT" : "VOICEMAIL"));
    head.appendChild(el("h3", null, kind === "image" ? "Kip is reading your screenshot…" : "Kip is listening to the recording…"));
    card.appendChild(head);
    card.appendChild(el("p", "kb-inv-sub", kind === "image"
      ? "A vision model on Amazon Bedrock reads every word and looks at the picture: logos, web addresses, QR codes."
      : "A speech model on Amazon Bedrock writes down what was said. The audio isn't stored."));
    const d = el("div", "kb-dots");
    d.append(el("i"), el("i"), el("i"));
    card.appendChild(d);
    row.appendChild(card);
    scrollDown();
    return { row, card };
  }

  function renderRead(card, kind, r) {
    card.className = "kb-read";
    card.textContent = "";
    const head = el("div", "kb-read-head");
    head.appendChild(el("span", "kb-read-tag", kind === "image" ? "SCREENSHOT" : "VOICEMAIL"));
    head.appendChild(el("h3", null, kind === "image" ? "What Kip read" : "What Kip heard"));
    if (r.latency_ms != null) head.appendChild(el("span", "kb-read-meta", `${(r.latency_ms / 1000).toFixed(1)}s`));
    card.appendChild(head);

    const v = r.vision;
    if (v && v.what) {
      const p = el("p", "kb-read-sees");
      p.appendChild(el("b", null, "Kip sees: "));
      p.appendChild(document.createTextNode(v.what));
      if (v.brand) p.appendChild(document.createTextNode(` It claims to be from ${v.brand}.`));
      if (v.has_qr) p.appendChild(document.createTextNode(" There is a QR code — don't scan it to pay or sign in."));
      card.appendChild(p);
      if (v.signs && v.signs.length) {
        const ul = el("ul", "kb-read-vis");
        v.signs.forEach((s) => { const li = el("li"); li.appendChild(el("b", null, s.label)); li.appendChild(el("span", null, s.detail)); ul.appendChild(li); });
        card.appendChild(ul);
      }
    }
    if (r.text) {
      card.appendChild(el("p", "kb-read-text-label", kind === "image" ? `Words in the image (${r.lines || 0} lines)` : "Transcript"));
      card.appendChild(el("pre", "kb-read-text", r.text));
    } else {
      card.appendChild(el("p", "kb-inv-sub", kind === "image"
        ? "Kip couldn't find any words in this image, so there's nothing for the scam detector to check."
        : "Kip couldn't make out any words in this recording."));
    }
    const by = kind === "image"
      ? `${r.reader === "textract" ? "Words read by Amazon Textract. " : ""}${v ? `Read by ${v.model} on Amazon Bedrock. ` : ""}The image isn't stored.`
      : `Transcribed by ${r.model || "a speech model"} on Amazon Bedrock. The audio isn't stored.`;
    card.appendChild(el("p", "kb-meta", by));
  }

  // ---- Attachments ----
  function readAsDataURL(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  // Draw the screenshot onto a canvas, capped at IMG_MAX_SIDE, and send it as JPEG (well under Textract's 5 MB).
  async function prepImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("decode"));
        i.src = url;
      });
      const scale = Math.min(1, IMG_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.88);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function note(msg) {
    const n = el("p", "kb-note", msg);
    n.setAttribute("role", "status");
    form.insertBefore(n, form.firstChild);
    setTimeout(() => n.remove(), 6000);
  }

  async function attachFile(file) {
    if (!file || busy) return;
    if (/^image\//.test(file.type) || /\.(png|jpe?g|webp|heic|gif)$/i.test(file.name)) {
      try {
        const dataUrl = await prepImage(file);
        setAttachment({ kind: "image", dataUrl, name: file.name || "screenshot.jpg" });
      } catch (e) {
        note("Kip couldn't open that image. Try a PNG or JPEG screenshot.");
      }
      return;
    }
    if (/^audio\//.test(file.type) || /\.(m4a|mp3|wav|ogg|webm|amr|aac|flac)$/i.test(file.name)) {
      if (file.size > AUDIO_MAX_FILE) { note("That recording is too big. Try a shorter clip (under two minutes)."); return; }
      try {
        const w = await toWav(file);
        setAttachment({ kind: "audio", b64: w.b64, mime: "audio/wav", name: file.name || "voicemail", seconds: w.seconds, cut: w.cut });
      } catch (e) {
        note("Kip couldn't open that recording. Try an MP3, M4A or WAV file.");
      }
      return;
    }
    note("Kip can read screenshots (PNG, JPEG) and voicemails (MP3, M4A, WAV, OGG, WebM).");
  }

  // Decode any recording the browser can play, mix to mono, resample to 16 kHz and encode a WAV.
  async function toWav(blob) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    let buf;
    try { buf = await ctx.decodeAudioData(await blob.arrayBuffer()); } finally { if (ctx.close) ctx.close(); }
    const rate = 16000;
    const seconds = Math.min(buf.duration, AUDIO_MAX_S);
    const off = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination);
    src.start(0, 0, seconds);
    const pcm = (await off.startRendering()).getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const str = (o, t) => { for (let i = 0; i < t.length; i++) out.setUint8(o + i, t.charCodeAt(i)); };
    str(0, "RIFF"); out.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
    str(36, "data"); out.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
    const b64 = await readAsDataURL(new Blob([out], { type: "audio/wav" }));
    return { b64, seconds: Math.round(seconds), cut: buf.duration > AUDIO_MAX_S };
  }

  function setAttachment(a) {
    attachment = a;
    attachRow.textContent = "";
    attachRow.hidden = !a;
    if (a) {
      if (mode === "ask") setMode("check");
      const chip = el("div", "kb-chipfile");
      if (a.kind === "image") {
        const im = el("img");
        im.src = a.dataUrl;
        im.alt = "";
        chip.appendChild(im);
      } else {
        const ic = el("span", "kb-chipfile-ic");
        ic.innerHTML = ICONS.mic;
        chip.appendChild(ic);
      }
      const t = el("span", "kb-chipfile-txt");
      t.appendChild(el("b", null, a.name));
      t.appendChild(el("small", null, a.kind === "image" ? "Kip will read the words and look at the picture" : `Voicemail${a.seconds ? ` · ${a.seconds}s` : ""}${a.cut ? " (first 110s)" : ""} · Kip will write down what was said`));
      chip.appendChild(t);
      const x = el("button", "kb-chipfile-x");
      x.type = "button";
      x.setAttribute("aria-label", `Remove ${a.name}`);
      x.innerHTML = ICONS.x;
      x.addEventListener("click", () => { setAttachment(null); input.focus(); });
      chip.appendChild(x);
      attachRow.appendChild(chip);
      announce(a.kind === "image" ? "Screenshot added. Press send to check it." : "Voicemail added. Press send to check it.");
      input.placeholder = "Add a question if you like, then press send";
    } else {
      setMode(mode);
    }
    updateCount();
  }

  // ---- Recording (mic) ----
  let rec = null; // {mr, chunks, t0, timer, stream}
  function recording() { return !!rec; }
  async function toggleRecording() {
    if (rec) { rec.mr.stop(); return; }
    if (busy) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) { note("This browser can't record. Attach a voicemail file with the paperclip instead."); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { note("Kip needs microphone permission to record. You can attach a voicemail file instead."); return; }
    const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
    const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    rec = { mr, chunks: [], t0: Date.now(), stream };
    mr.ondataavailable = (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); };
    mr.onstop = async () => {
      const r = rec;
      rec = null;
      clearInterval(r.timer);
      r.stream.getTracks().forEach((t) => t.stop());
      $("kb-mic").setAttribute("aria-pressed", "false");
      $("kb-rec").hidden = true;
      const seconds = Math.round((Date.now() - r.t0) / 1000);
      const mime = (mr.mimeType || type || "audio/webm").split(";")[0];
      const blob = new Blob(r.chunks, { type: mime });
      if (seconds < 1 || blob.size < 1000) { note("That recording was too short."); updateCount(); return; }
      try {
        const w = await toWav(blob);
        setAttachment({ kind: "audio", b64: w.b64, mime: "audio/wav", name: "Recording", seconds: w.seconds });
      } catch (e) {
        note("Kip couldn't use that recording. Please try again.");
        updateCount();
      }
    };
    mr.start(500);
    $("kb-mic").setAttribute("aria-pressed", "true");
    $("kb-rec").hidden = false;
    $("kb-rec-time").textContent = "0:00";
    rec.timer = setInterval(() => {
      const s = Math.round((Date.now() - rec.t0) / 1000);
      $("kb-rec-time").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      if (s >= REC_MAX_S) rec.mr.stop();
    }, 250);
    announce("Recording. Hold the phone's speaker near the microphone, or say what the caller said. Tap the mic to stop.");
    updateCount();
  }

  // ---- Flows ----
  async function readScreenshot(a) {
    const pending = renderReadPending("image");
    try {
      const r = await post({ mode: "screenshot", image: a.dataUrl });
      renderRead(pending.card, "image", r);
      return r;
    } catch (e) {
      pending.row.remove();
      addError(/JPEG or PNG|larger/.test(e.message) ? `Kip couldn't read that image: ${e.message}.` : "Kip couldn't read that screenshot just now. Please try again, or paste the words instead.");
      return null;
    }
  }

  async function transcribe(a) {
    const pending = renderReadPending("audio");
    try {
      const r = await post({ mode: "voicemail", audio: a.b64, mime: a.mime });
      renderRead(pending.card, "audio", r);
      return r;
    } catch (e) {
      pending.row.remove();
      addError(/WAV|MP3|larger/.test(e.message) ? `Kip couldn't use that recording: ${e.message}.` : "Kip couldn't transcribe that recording just now. Please try again, or type what the caller said.");
      return null;
    }
  }

  // Detector verdict, then the agent investigation. Returns the verdict (or null on error).
  async function runCheck(text, label) {
    const typing = addTyping();
    let r;
    try {
      r = await post({ mode: "check", message: text });
    } catch (e) {
      typing.remove();
      addError("Sorry, Kip couldn't answer just now. Please try again in a moment. If money is involved, don't wait: call back on a number you already trust.");
      return null;
    }
    typing.remove();
    const row = botRow();
    renderVerdict(row, r);
    context = { risk_level: r.risk_level, signals: (r.signs || []).map((s) => s.signal) };
    history.push({ role: "user", content: `Please check this message: ${text.slice(0, 400)}` });
    history.push({ role: "assistant", content: `${r.risk_level} risk. ${r.headline} ${(r.signs || []).map((s) => `${s.label}: "${s.quote}"`).join("; ")}`.slice(0, 500) });
    history = history.slice(-MAX_HISTORY);
    announce(`${r.risk_level} risk. ${r.headline}`);
    addHistory(label || text, text, r);
    keepInView(row);
    const inv = await investigate(text, r.risk_level);
    return { r, inv };
  }

  // Kip's overall take: the text detector, the picture and the agent's link checks are separate opinions.
  // When the words alone look ordinary but the picture or the links don't, say so plainly instead of
  // leaving a LOW verdict as the last word. Only raises concern; it never talks a warning down.
  function overall(check, vision, inv) {
    if (!check) return;
    const r = check.r;
    const reasons = [];
    if (inv && inv.level === "danger") reasons.push("the links or numbers in it failed Kip's checks");
    const vis = (vision && vision.signs) || [];
    if (vis.length >= 2) reasons.push(`the picture shows ${vis.length} warning signs (${vis.slice(0, 2).map((s) => s.label.toLowerCase()).join(", ")})`);
    else if (vision && vision.has_qr) reasons.push("it shows a QR code");
    if (!reasons.length || r.risk_level === "HIGH") return;
    const level = reasons.length >= 2 || (inv && inv.level === "danger") ? "HIGH" : "MEDIUM";
    const row = botRow();
    const card = el("article", `kb-ans kb-ans-${level}`);
    card.setAttribute("aria-label", `Kip's overall take: ${LEVEL_TEXT[level]}`);
    const head = el("div", "kb-ans-head");
    head.appendChild(badge(level, `Overall · ${LEVEL_TEXT[level]}`));
    card.appendChild(head);
    card.appendChild(el("h3", "kb-ans-title", level === "HIGH" ? "Treat this as a likely scam." : "Be careful with this one."));
    card.appendChild(el("p", "kb-ans-sum", `The words alone looked ${LEVEL_TEXT[r.risk_level].toLowerCase()}, but ${reasons.join(", and ")}.`));
    const todo = el("section", "kb-sec-block kb-sec-todo");
    todo.appendChild(el("h4", null, "What to do now"));
    todo.appendChild(stepList(["Don't tap the link, scan a code or pay.", "Contact the company yourself, using its official app or website."]));
    card.appendChild(todo);
    card.appendChild(el("p", "kb-meta", "Kip's overall take combines the text check, the picture and the link checks."));
    row.appendChild(card);
    history.push({ role: "assistant", content: `Overall ${level}: ${reasons.join("; ")}`.slice(0, 500) });
    context = { risk_level: level, signals: context ? context.signals : [] };
    const last = $("kb-history").querySelector(".kb-hist");
    if (last) {
      last.querySelector("i").className = level;
      last.querySelector("small").textContent = `${level} overall · ${reasons[0].split(" (")[0]}`;
    }
    announce(`Overall: ${level} risk. ${reasons.join(", and ")}.`);
    keepInView(row);
  }

  async function runAsk(text) {
    const typing = addTyping("Kip is thinking");
    let r;
    try {
      r = await post({ mode: "ask", message: text, history: history.slice(-MAX_HISTORY), context });
    } catch (e) {
      typing.remove();
      addError("Sorry, Kip couldn't answer just now. Please try again in a moment.");
      return;
    }
    typing.remove();
    const row = botRow();
    renderAnswer(row, r);
    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: r.answer });
    history = history.slice(-MAX_HISTORY);
    announce(r.answer);
    keepInView(row);
  }

  async function submit(raw, m) {
    const text = (raw || "").trim();
    const a = attachment;
    if (busy || recording() || (!text && !a)) return;
    if (text.length > MODE_COPY[m].max) return;
    setMode(m);
    input.value = "";
    setAttachment(null);
    clearSuggestions();
    setBusy(true);
    try {
      if (a) {
        // Screenshot or voicemail: read it, check the words, then answer any question typed with it.
        addMe(text, a.kind === "image" ? { image: a.dataUrl } : { audio: a.seconds ? `Recording · ${a.seconds}s` : a.name });
        const r = a.kind === "image" ? await readScreenshot(a) : await transcribe(a);
        if (r && r.vision) {
          history.push({ role: "assistant", content: `Screenshot: ${r.vision.what} ${(r.vision.signs || []).map((s) => `${s.label}: ${s.detail}`).join("; ")}`.slice(0, 500) });
        }
        if (r && r.text) {
          const label = a.kind === "image" ? `Screenshot: ${r.text}` : `Voicemail: ${r.text}`;
          if (m === "investigate") await investigate(r.text, null);
          else { const c = await runCheck(r.text.slice(0, CHECK_MAX), label); overall(c, r.vision, c && c.inv); saveCheck(c, a.kind === "image" ? "screenshot" : "voicemail"); if (c && !text) addSuggestions(context.risk_level); }
        }
        if (r && text) await runAsk(text.slice(0, ASK_MAX));
        if (r && (r.text || r.vision)) setMode("ask"); // follow-ups are questions about this screenshot or call
      } else if (m === "check") {
        addMe(text, { tag: "Message to check" });
        const c = await runCheck(text);
        overall(c, null, c && c.inv);
        saveCheck(c, "text");
        if (c) { setMode("ask"); addSuggestions(context.risk_level); } // follow-ups are questions about this message
      } else if (m === "investigate") {
        addMe(text, { tag: "Investigate this" });
        await investigate(text, null);
      } else {
        addMe(text);
        await runAsk(text);
      }
    } finally {
      setBusy(false);
      if (!isPhone()) input.focus({ preventScroll: true });
    }
  }

  // "This visit" list in the sidebar: in memory only, gone when the tab closes.
  // Clicking one re-runs that check (a new detector call; nothing was stored).
  function addHistory(label, text, r) {
    $("kb-history-empty").hidden = true;
    const b = el("button", "kb-hist");
    b.type = "button";
    b.setAttribute("role", "listitem");
    b.setAttribute("aria-label", `Check again (${r.risk_level} risk): ${label.slice(0, 80)}`);
    const t = el("span", "kb-hist-t");
    t.appendChild(el("i", r.risk_level));
    t.appendChild(el("span", null, label.replace(/\s+/g, " ").slice(0, 60)));
    b.appendChild(t);
    const why = (r.signs || []).slice(0, 2).map((s) => s.label.toLowerCase()).join(", ");
    b.appendChild(el("small", null, `${r.risk_level}${why ? ` · ${why}` : r.risk_level === "LOW" ? " · no warning signs" : ""}`));
    b.addEventListener("click", () => { closeMenu(); if (busy) return; reset(true); submit(text, "check"); });
    const list = $("kb-history");
    list.insertBefore(b, list.querySelector(".kb-hist"));
    list.querySelectorAll(".kb-hist").forEach((h, i) => { if (i >= 8) h.remove(); });
  }

  // ---- Phone drawer ----
  function openMenu() { shell.classList.add("open"); $("kb-scrim").hidden = false; $("kb-menu").setAttribute("aria-expanded", "true"); $("kb-new").focus(); }
  function closeMenu() {
    if (!shell.classList.contains("open")) return;
    shell.classList.remove("open"); $("kb-scrim").hidden = true; $("kb-menu").setAttribute("aria-expanded", "false");
  }

  function reset(quiet) {
    if (busy) return;
    history = [];
    context = null;
    Array.from(log.children).forEach((c) => { if (c !== empty) c.remove(); });
    empty.hidden = false;
    input.value = "";
    setAttachment(null);
    placeDock();
    setMode("check");
    if (quiet === true) return;
    input.focus();
    announce("New check started.");
  }

  function runExample(i) {
    if (busy || !EXAMPLES[i]) return;
    if (log.querySelector(".kb-row")) reset(true);
    submit(EXAMPLES[i].text, "check");
  }

  function pickScreenshot() { closeMenu(); if (!busy) $("kb-file-img").click(); }

  // ---- Wire up ----
  CARDS.forEach((c) => {
    const b = el("button", "kb-card-btn" + (c.risk ? " risk" : ""));
    b.type = "button";
    const ic = el("span", "kb-card-ic");
    ic.innerHTML = ICONS[c.icon];
    const t = el("span", "kb-card-txt");
    t.append(el("b", null, c.title), el("small", null, c.desc));
    b.append(ic, t);
    b.addEventListener("click", () => {
      if (c.go === "example") runExample(c.ex);
      else if (c.go === "say") submit(c.text, "ask");
      else if (c.go === "shot") pickScreenshot();
      else { setMode(c.go); input.focus(); }
    });
    $("kb-cards").appendChild(b);
  });
  EXAMPLES.slice(1).forEach((ex, j) => {
    const b = el("button", ex.real ? "real" : null, ex.short);
    b.type = "button";
    b.setAttribute("aria-label", `Check example: ${ex.title}${ex.real ? " (a real message)" : ""}`);
    b.addEventListener("click", () => runExample(j + 1));
    $("kb-more").appendChild(b);
  });

  document.querySelectorAll(".kb-tab").forEach((t) => t.addEventListener("click", () => { setMode(t.dataset.mode); input.focus(); }));
  $("kb-mode-select").addEventListener("change", () => setMode(modeSelect.value));

  $("kb-add-shot").addEventListener("click", pickScreenshot);
  $("kb-add-file").addEventListener("click", () => { if (!busy) $("kb-file-any").click(); });
  ["kb-file-img", "kb-file-any"].forEach((id) => $(id).addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    attachFile(f);
  }));
  $("kb-add-link").addEventListener("click", () => {
    setMode("investigate");
    if (!input.value.trim()) input.value = "";
    input.placeholder = "Paste the link, like bit.ly/abc or chase-verify.co";
    input.focus();
  });
  $("kb-mic").addEventListener("click", toggleRecording);

  // Paste a screenshot straight into the box (Ctrl/Cmd+V), or drop a file on it.
  input.addEventListener("paste", (e) => {
    const item = Array.from((e.clipboardData && e.clipboardData.items) || []).find((i) => i.kind === "file" && /^image\//.test(i.type));
    if (item) { e.preventDefault(); attachFile(item.getAsFile()); }
  });
  let dragDepth = 0;
  composer.addEventListener("dragenter", (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) { e.preventDefault(); dragDepth++; composer.classList.add("dragging"); } });
  composer.addEventListener("dragover", (e) => { if (composer.classList.contains("dragging")) e.preventDefault(); });
  composer.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; composer.classList.remove("dragging"); } });
  composer.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    composer.classList.remove("dragging");
    attachFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  input.addEventListener("input", updateCount);
  input.addEventListener("keydown", (e) => {
    // Enter sends a question; pasted messages are often multi-line, so checks send on Ctrl/Cmd+Enter.
    if (e.key === "Enter" && !e.shiftKey && (mode === "ask" || attachment || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit(input.value, mode);
    }
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); submit(input.value, mode); });
  const newCheck = () => { closeMenu(); reset(); };
  $("kb-new").addEventListener("click", newCheck);
  $("kb-top-new").addEventListener("click", newCheck);
  $("kb-side-shot").addEventListener("click", () => { reset(true); pickScreenshot(); });
  $("kb-side-voice").addEventListener("click", () => { closeMenu(); reset(true); $("kb-file-any").click(); });
  $("kb-side-ask").addEventListener("click", () => { closeMenu(); setMode("ask"); input.focus(); });
  $("kb-menu").addEventListener("click", openMenu);
  $("kb-side-close").addEventListener("click", () => { closeMenu(); $("kb-menu").focus(); });
  $("kb-scrim").addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && shell.classList.contains("open")) { closeMenu(); $("kb-menu").focus(); } });

  setMode("check");
  placeDock();

  // ---- Optional sign-in: Amazon Cognito hosted login (authorization code + PKCE, no client secret) ----
  // Guests get every feature. Signing in only adds a saved history of each check's verdict and
  // headline (never the message), stored by POST /history behind API Gateway's JWT authorizer.
  // Cognito only returns to the HTTPS copy of this page, so other origins send people there to sign in.
  const AUTH = {
    domain: "https://kinshield-kip.auth.us-east-1.amazoncognito.com",
    clientId: "ggreebsoqml0u93vptcao571n",
    google: false,
    home: "https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com/kinbot-chat.html",
  };
  const AUTH_KEY = "kinbot_auth";
  const PKCE_KEY = "kinbot_pkce";
  const pageUrl = location.origin + location.pathname;
  const canSignInHere = pageUrl === AUTH.home || pageUrl === "http://localhost:8080/kinbot-chat.html";
  let tokens = null;
  try { tokens = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { tokens = null; }
  if (!canSignInHere) tokens = null;

  function b64url(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function randomString(n) { return b64url(crypto.getRandomValues(new Uint8Array(n))); }
  function saveTokens(t) {
    tokens = t;
    try { if (t) localStorage.setItem(AUTH_KEY, JSON.stringify(t)); else localStorage.removeItem(AUTH_KEY); } catch (e) { /* signed in for this tab only */ }
  }
  function account() {
    if (!tokens || !tokens.id) return null;
    try {
      const c = JSON.parse(decodeURIComponent(escape(atob(tokens.id.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))));
      return { email: c.email || "", name: c.name || c.given_name || (c.email || "").split("@")[0] };
    } catch (e) { return null; }
  }
  async function tokenRequest(fields) {
    const res = await fetch(`${AUTH.domain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: AUTH.clientId, ...fields }),
    });
    const t = await res.json().catch(() => ({}));
    if (!res.ok || !t.access_token) throw new Error(t.error || `HTTP ${res.status}`);
    return t;
  }
  async function startLogin(provider) {
    if (!canSignInHere) { location.href = `${AUTH.home}?signin=${provider}`; return; }
    const verifier = randomString(48);
    const state = randomString(16);
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    try { sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state })); } catch (e) { /* the token exchange will fail and say so */ }
    const q = new URLSearchParams({
      response_type: "code", client_id: AUTH.clientId, redirect_uri: pageUrl,
      scope: "openid email profile", state, code_challenge: challenge, code_challenge_method: "S256",
    });
    if (provider === "google" && AUTH.google) q.set("identity_provider", "Google");
    location.href = `${AUTH.domain}/oauth2/authorize?${q}`;
  }
  // Back from the hosted login page with ?code=…&state=…: swap the code for tokens, then clean the URL.
  async function finishLogin(params) {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) || "null"); sessionStorage.removeItem(PKCE_KEY); } catch (e) { saved = null; }
    window.history.replaceState(null, "", pageUrl);
    if (!saved || saved.state !== params.get("state")) { note("Sign-in didn't finish. Please try again."); return; }
    try {
      const t = await tokenRequest({ grant_type: "authorization_code", code: params.get("code"), redirect_uri: pageUrl, code_verifier: saved.verifier });
      saveTokens({ id: t.id_token, access: t.access_token, refresh: t.refresh_token, exp: Date.now() + t.expires_in * 1000 });
      announce("Signed in. Your checks will be saved to your history.");
    } catch (e) {
      note("Sign-in didn't finish. Please try again.");
    }
  }
  async function accessToken() {
    if (!tokens) return null;
    if (Date.now() < tokens.exp - 60000) return tokens.access;
    try {
      const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh });
      saveTokens({ ...tokens, id: t.id_token || tokens.id, access: t.access_token, exp: Date.now() + t.expires_in * 1000 });
      return tokens.access;
    } catch (e) {
      saveTokens(null);
      renderAccount();
      return null;
    }
  }
  function signOut() {
    saveTokens(null);
    location.href = `${AUTH.domain}/logout?${new URLSearchParams({ client_id: AUTH.clientId, logout_uri: pageUrl })}`;
  }
  async function historyApi(method, body) {
    const token = await accessToken();
    if (!token) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${API}/history`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      return res.ok ? await res.json() : null;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  // Saved after Kip's overall take, so a level the picture or link checks raised is the one kept.
  function saveCheck(c, kind) {
    if (!tokens || !c || !c.r) return;
    historyApi("POST", { level: (context && context.risk_level) || c.r.risk_level, kind, headline: c.r.headline || "Checked a message", score: c.r.risk_score });
  }
  function renderSaved(items) {
    const list = $("kb-history");
    list.querySelectorAll(".kb-hist-saved").forEach((n) => n.remove());
    if (!items || !items.length) return;
    $("kb-history-empty").hidden = true;
    const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
    const KIND = { text: "Message", screenshot: "Screenshot", voicemail: "Voicemail" };
    items.slice(0, 12).forEach((it) => {
      const d = el("div", "kb-hist kb-hist-saved");
      d.setAttribute("role", "listitem");
      const t = el("span", "kb-hist-t");
      t.appendChild(el("i", it.level));
      t.appendChild(el("span", null, it.headline.slice(0, 60)));
      d.appendChild(t);
      d.appendChild(el("small", null, `${it.level} · ${KIND[it.kind] || "Message"} · ${fmt.format(new Date(it.ts))}`));
      list.appendChild(d);
    });
  }
  async function loadSaved() {
    const r = await historyApi("GET");
    if (r) renderSaved(r.items);
  }
  function renderAccount() {
    const who = account();
    const signedIn = !!who;
    $("hist-label").textContent = signedIn ? "Your checks" : "This visit";
    $("kb-history-empty").textContent = signedIn ? "Your checks are saved here: the verdict and headline, never the message." : "Your checks show here until you close the tab.";
    $("kb-guest-name").textContent = signedIn ? (who.name || who.email) : "Guest";
    $("kb-guest-sub").textContent = signedIn ? "History saved · Account" : "Sign in to save history";
    if (signedIn) $("kb-guest-av").textContent = (who.name || who.email || "?").trim().charAt(0).toUpperCase();
    else $("kb-guest-av").innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></svg>';
    $("kb-guest-av").classList.toggle("is-user", signedIn);
    $("kb-auth-signin").hidden = signedIn;
    $("kb-auth-acct").hidden = !signedIn;
    if (signedIn) $("kb-acct-email").textContent = who.email || who.name;
    auth.querySelectorAll("[data-provider='google']").forEach((b) => { b.hidden = !AUTH.google; });
  }

  // ---- Welcome / sign-in popup ----
  // Shown once per browser to guests; skipped when arriving with ?example=N so that link runs straight away.
  const auth = $("kb-auth");
  const SEEN_KEY = "kinbot_welcome_seen";
  let authReturn = null;
  function authFocusables() { return Array.from(auth.querySelectorAll("button")).filter((b) => b.offsetParent); }
  function openAuth() {
    authReturn = document.activeElement;
    $("kb-auth-soon").textContent = "";
    renderAccount();
    auth.hidden = false;
    (account() ? $("kb-acct-close") : $("kb-auth-guest")).focus();
  }
  function closeAuth() {
    if (auth.hidden) return;
    auth.hidden = true;
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (e) { /* private mode: show again next visit */ }
    (authReturn && authReturn !== document.body ? authReturn : input).focus({ preventScroll: true });
  }
  auth.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeAuth));
  $("kb-auth-guest").addEventListener("click", closeAuth);
  auth.querySelectorAll("[data-provider]").forEach((b) => b.addEventListener("click", () => {
    $("kb-auth-soon").textContent = "Opening the secure sign-in page…";
    startLogin(b.dataset.provider);
  }));
  $("kb-acct-close").addEventListener("click", closeAuth);
  $("kb-acct-out").addEventListener("click", signOut);
  $("kb-acct-clear").addEventListener("click", async () => {
    const b = $("kb-acct-clear");
    b.disabled = true;
    const r = await historyApi("DELETE");
    b.disabled = false;
    $("kb-auth-soon").textContent = r ? `Deleted ${r.deleted} saved check${r.deleted === 1 ? "" : "s"}.` : "Couldn't delete just now. Please try again.";
    if (r) renderSaved([]);
  });
  $("kb-signin-open").addEventListener("click", openAuth);
  auth.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); closeAuth(); return; }
    if (e.key !== "Tab") return;
    const f = authFocusables();
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch (e) { /* ignore */ }

  // kinbot-chat.html?preview=1 is the frozen copy embedded on the KinBot info page. It draws a saved
  // result (kinbot-preview.json) with the same render code as a live check, so the embed follows any
  // UI change, but it makes no API calls and never opens the popup or takes focus.
  function showPreview() {
    document.documentElement.classList.add("kb-preview");
    fetch("kinbot-preview.json").then((res) => res.json()).then((p) => {
      addMe(p.text, { tag: "Message to check" });
      renderVerdict(botRow(), p.check);
      addHistory(p.text, p.text, p.check);
      renderInvestigation(renderInvestigationPending().card, p.investigation);
      setMode("ask");
      addSuggestions(p.check.risk_level);
      requestAnimationFrame(() => { log.scrollTop = 0; });
    }).catch(() => { /* the empty state is still a fine preview */ });
  }

  // kinbot-chat.html?example=N (linked from the KinBot info page) runs that example straight away.
  const params = new URLSearchParams(location.search);
  const ex = Number(params.get("example"));
  renderAccount();
  if (params.has("preview")) showPreview();
  else if (params.has("code") && params.has("state") && canSignInHere) {
    finishLogin(params).then(() => { renderAccount(); if (tokens) loadSaved(); input.focus({ preventScroll: true }); });
  } else if (params.has("signin") && canSignInHere && !tokens) {
    startLogin(params.get("signin") === "google" ? "google" : "email");
  } else if (params.has("example") && Number.isInteger(ex) && ex >= 0 && ex < EXAMPLES.length) {
    if (tokens) loadSaved();
    runExample(ex);
  } else {
    if (tokens) loadSaved();
    if (!isPhone()) input.focus({ preventScroll: true });
    if (!seen && !tokens) openAuth();
  }
})();
