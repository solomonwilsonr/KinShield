"use strict";

// "Ask Kip" support chat: a floating launcher + panel on the info pages.
// Answers come from POST /chat (grounded in lambda/evidence-detector/kb.md). Messages live
// only in memory for this page view; nothing is saved in the browser.
(function () {
  const API = (window.KINSHIELD_API || "").replace(/\/$/, "");
  const MAX_CHARS = 500;
  const FACE = "img/mascot-face.png?v=20261002-20";
  const SUGGESTED = [
    "How does the risk score work?",
    "What data do you store?",
    "What will it cost?",
    "I think I'm being scammed",
  ];
  const GREETING =
    "Hi, I'm Kip. I can explain how KinShield works, what the risk score means, or what to do if a call feels off.";

  const ICON = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    out: '<path d="M8 16L16 8M9 8h7v7"/>',
    sub: '<path d="M6 4v8a3 3 0 0 0 3 3h9M14 11l4 4-4 4"/>',
    warn: '<path d="M12 3l10 18H2zM12 10v5M12 18v.5"/>',
  };
  const svg = (name, size = 18) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

  // Dotted flow lines behind the header (decorative).
  function dots() {
    let paths = "";
    for (let i = 0; i < 7; i++) {
      const x = 150 + i * 16;
      paths += `<path d="M${x} 0 C ${x + 10} 60, ${x - 60} 110, ${x - 150 + i * 6} 190"/>`;
    }
    return `<svg class="kip-flow" viewBox="0 0 280 190" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="0 6">${paths}</svg>`;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const num = (i) => String(i + 1).padStart(2, "0");

  // ---- DOM ---------------------------------------------------------------
  const launcher = el("button", "kip-launcher");
  launcher.type = "button";
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "kip-panel");
  launcher.innerHTML =
    `<span class="kip-launcher-face"><img src="${FACE}" alt="" width="34" height="34" /></span>` +
    '<span class="kip-launcher-label">Questions? <span>Ask Kip</span></span>' +
    `<span class="kip-launcher-go">${svg("out", 16)}</span>` +
    `<span class="kip-launcher-close">${svg("close", 16)} Close</span>`;

  const panel = el("section", "kip-panel");
  panel.id = "kip-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", "kip-title");
  panel.innerHTML = `
    <header class="kip-head">
      ${dots()}
      <h2 id="kip-title">Ask Kip anything <span>about KinShield</span></h2>
      <div class="kip-head-btns">
        <a class="kip-sq" href="kinbot-chat.html" aria-label="Check a message in KinBot" title="Check a message in KinBot">${svg("out", 16)}</a>
        <button type="button" class="kip-sq kip-close" aria-label="Close chat">${svg("close", 16)}</button>
      </div>
    </header>
    <div class="kip-log" role="log" aria-live="polite" aria-relevant="additions"></div>
    <form class="kip-composer">
      <label class="kip-label" for="kip-text">Your question</label>
      <div class="kip-input">
        <input id="kip-text" type="text" autocomplete="off" maxlength="${MAX_CHARS}" placeholder="Ask about KinShield…" />
        <button type="submit" aria-label="Send">${svg("send", 18)}</button>
      </div>
      <p class="kip-foot">Not stored. In an emergency, hang up and call someone you trust.</p>
    </form>`;

  document.body.append(panel, launcher);
  const log = panel.querySelector(".kip-log");
  const form = panel.querySelector(".kip-composer");
  const input = panel.querySelector("#kip-text");
  const sendBtn = form.querySelector('button[type="submit"]');

  // ---- state -------------------------------------------------------------
  const history = []; // [{role, content}] sent back so follow-ups have context
  let busy = false;
  let started = false;

  function scrollDown() {
    log.scrollTop = log.scrollHeight;
  }

  function bubble(text, who) {
    const row = el("div", `kip-row kip-${who}`);
    if (who === "bot") {
      const face = el("img", "kip-avatar");
      face.src = FACE;
      face.alt = "";
      row.append(face);
    }
    const b = el("div", "kip-bubble");
    b.append(el("p", null, text));
    row.append(b);
    log.append(row);
    scrollDown();
    return b;
  }

  // Ramp-style "field": small grey label over a boxed value with a ↳ sub-row marker.
  function sourceField(source) {
    const f = el("div", "kip-field");
    f.append(el("span", "kip-field-label", "Source"));
    const v = el("span", "kip-field-value");
    v.innerHTML = svg("sub", 14);
    v.append(document.createTextNode(source.replace(/:\s*/, " · ")));
    f.append(v);
    return f;
  }

  function safeHref(href) {
    return /^(https:\/\/|index\.html#|kinvoice\.html#)/.test(href) ? href : "#";
  }

  function sheet(cls, label) {
    const s = el("div", `kip-sheet ${cls || ""}`);
    const bar = el("div", "kip-sheet-bar");
    bar.innerHTML = "<i></i><i></i><i></i>";
    bar.append(el("span", null, label));
    s.append(bar);
    return s;
  }

  function safetyCard(card, source) {
    const s = sheet("kip-sheet-warn", "KinShield · Safety steps");
    const body = el("div", "kip-sheet-body");
    const h = el("p", "kip-sheet-title");
    h.innerHTML = svg("warn", 18);
    h.append(document.createTextNode(card.title));
    body.append(h);
    card.steps.forEach((step, i) => {
      const r = el("div", "kip-line");
      r.append(el("span", "kip-line-n", num(i)), el("span", "kip-line-box", step));
      body.append(r);
    });
    const acts = el("div", "kip-card-actions");
    card.actions.forEach((a) => {
      const link = el("a", a.primary ? "kip-btn kip-btn-primary" : "kip-btn", a.label);
      link.href = safeHref(a.href);
      if (link.href.startsWith("https://")) {
        link.target = "_blank";
        link.rel = "noopener";
      } else {
        link.addEventListener("click", () => close(false));
      }
      acts.append(link);
    });
    body.append(acts, el("p", "kip-card-note", card.note));
    if (source) body.append(sourceField(source));
    s.append(body);
    const row = el("div", "kip-row kip-bot kip-wide");
    row.append(s);
    log.append(row);
    scrollDown();
  }

  function typing(on) {
    const existing = log.querySelector(".kip-typing");
    if (!on) return existing && existing.remove();
    if (existing) return;
    const row = el("div", "kip-row kip-bot kip-typing");
    row.innerHTML = `<img class="kip-avatar" src="${FACE}" alt="" /><div class="kip-bubble kip-dots" aria-label="Kip is typing"><i></i><i></i><i></i></div>`;
    log.append(row);
    scrollDown();
  }

  function setBusy(on) {
    busy = on;
    sendBtn.disabled = on;
    log.querySelectorAll(".kip-q").forEach((c) => (c.disabled = on));
  }

  async function ask(text) {
    text = text.trim().slice(0, MAX_CHARS);
    if (!text || busy) return;
    const chips = log.querySelector(".kip-questions");
    if (chips) chips.remove();
    bubble(text, "me");
    setBusy(true);
    typing(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(-6) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.answer) throw new Error(data.error || `HTTP ${res.status}`);
      typing(false);
      const b = bubble(data.answer, "bot");
      if (data.card) {
        safetyCard(data.card, data.source);
      } else if (data.source) {
        b.append(sourceField(data.source));
        scrollDown();
      }
      history.push({ role: "user", content: text }, { role: "assistant", content: data.answer });
    } catch (err) {
      typing(false);
      bubble("Sorry, I couldn't reach KinShield just now. Please try again in a moment.", "bot");
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  function start() {
    if (started) return;
    started = true;
    bubble(GREETING, "bot");
    const s = sheet("kip-questions", "KinShield · Help");
    const body = el("div", "kip-sheet-body");
    body.append(el("p", "kip-sheet-title", "Common questions"));
    SUGGESTED.forEach((q, i) => {
      const b = el("button", /scammed/.test(q) ? "kip-q kip-q-urgent" : "kip-q");
      b.type = "button";
      b.innerHTML = `<span class="kip-line-n">${num(i)}</span><span class="kip-line-box"></span><span class="kip-q-go">${svg("out", 14)}</span>`;
      b.querySelector(".kip-line-box").textContent = q;
      b.addEventListener("click", () => ask(q));
      body.append(b);
    });
    s.append(body);
    const row = el("div", "kip-row kip-bot kip-wide");
    row.append(s);
    log.append(row);
  }

  // ---- open / close ------------------------------------------------------
  function open() {
    start();
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("kip-open");
    scrollDown();
    input.focus();
  }

  function close(returnFocus = true) {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("kip-open");
    if (returnFocus) launcher.focus();
  }

  launcher.addEventListener("click", () => (panel.hidden ? open() : close()));
  panel.querySelector(".kip-close").addEventListener("click", () => close());
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = "";
    ask(text);
  });
})();
