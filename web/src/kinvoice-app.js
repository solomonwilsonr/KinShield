"use strict";

// KinVoice demo (kinvoice-app.html), inside the KinBot shell.
// - Scripted or user-written calls are scored turn by turn on the live detector (POST /detect with
//   the turns so far), so the risk timeline and the mid-call alert are real model output.
// - Voice: caller lines are read by Amazon Polly (POST /kinbot mode "speak"); the protected
//   person's lines use the browser's own speech voice.
// - Family setup lives in this browser only. FamilyVerify and the location check are simulated.
(function () {
  const API = (window.KINSHIELD_API || "").replace(/\/$/, "");
  const $ = (id) => document.getElementById(id);
  const V = "?v=20261002-20";
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MAX_POINTS = 6; // at most this many detector calls per played call (bounds Bedrock cost)

  const ICON = {
    warn: '<svg viewBox="0 0 24 24"><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" /></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>',
    quote: '<svg viewBox="0 0 24 24"><path d="M7 7h4v4c0 3-2 5-4 6M14 7h4v4c0 3-2 5-4 6" /></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 21h4" /></svg>',
    doc: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></svg>',
  };
  const SIG = {
    impersonation: ["Impersonation", "phone"], emergency: ["Manufactured emergency", "warn"],
    secrecy: ["Secrecy request", "lock"], financial_request: ["Financial request", "quote"],
    payment_anomaly: ["Unusual payment method", "warn"], authority_pressure: ["Authority pressure", "shield"],
    unusual_urgency: ["Unusual urgency", "warn"],
  };
  const sigLabel = (s) => (SIG[s] || [s])[0];
  const sigIcon = (s) => ICON[(SIG[s] || [0, "quote"])[1]];
  const RANK = { LOW: 1, MEDIUM: 2, HIGH: 3 };

  let scenarios = [];
  let type = "scam";
  let query = "";
  let feedFilter = "all";
  const history = []; // this tab only
  let unseen = 0;
  let runToken = 0;
  let current = null; // { scenario, result, points, alertPoint }
  let playing = false;

  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const readTime = (t) => Math.max(1800, Math.min(4200, 1200 + String(t || "").length * 28));
  const weightClass = (w) => (w >= 25 ? "w-high" : w <= 12 ? "w-low" : "");
  const status = (t) => { $("kv-status").textContent = t; };
  const tc = (t) => String(t || "?").replace(/[\[\]]/g, "");
  const secs = (t) => { const m = String(t || "").match(/(\d+):(\d+)/); return m ? +m[1] * 60 + +m[2] : null; };
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  // ---- family setup (this browser only) ----------------------------------------
  const SETUP_KEY = "kinvoice_setup_v1";
  const DEFAULTS = {
    done: false, me: "Sarah", name: "Mom", rel: "Mom",
    contacts: [{ name: "Daniel", rel: "Grandson" }, { name: "Leo", rel: "Grandson" }, { name: "Dad", rel: "Husband" }],
    alertAt: "HIGH", channels: ["push"], safeword: "",
  };
  let setup = Object.assign({}, DEFAULTS, store.get(SETUP_KEY) || {});
  const P = () => setup.name || "Mom";
  const Ps = () => `${P()}’s`;
  const alertRank = () => RANK[setup.alertAt] || 3;

  function applySetup() {
    $("kv-mom-av").textContent = P().charAt(0).toUpperCase();
    if (!document.querySelector(".kv-protect").classList.contains("is-warn")) setMom(false);
    $("o-sp-victim").textContent = P();
    const n = setup.contacts.filter((c) => c.name).length;
    $("kv-setup-card").classList.toggle("is-done", !!setup.done);
    $("kv-setup-t").textContent = setup.done ? `Protecting ${P()}` : "Protect someone in one minute";
    $("kv-setup-s").textContent = setup.done
      ? `${n} trusted contact${n === 1 ? "" : "s"} · alerts at ${setup.alertAt === "MEDIUM" ? "Medium and High" : "High"}${setup.safeword ? " · family safe word set" : ""}`
      : "Add who you’re protecting, who Kip should check with, and a family safe word.";
    $("kv-setup-go").textContent = setup.done ? "Edit" : "Set up";
  }

  // ---- views -----------------------------------------------------------------
  const views = { calls: $("v-calls"), own: $("v-own"), live: $("v-live"), alerts: $("v-alerts") };
  function show(name) {
    if (name === "alerts") { unseen = 0; renderCount(); renderFeed(); }
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
    document.querySelectorAll(".kb-tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.view === name)));
    closeMenu();
    if (name === "own") setTimeout(() => $("o-text").focus({ preventScroll: true }), 50);
  }
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));

  // KinBot's drawer sidebar on narrow screens
  const shell = document.querySelector(".kb-shell");
  function openMenu() { shell.classList.add("open"); $("kb-scrim").hidden = false; $("kb-menu").setAttribute("aria-expanded", "true"); $("kv-new").focus(); }
  function closeMenu() { if (!shell.classList.contains("open")) return; shell.classList.remove("open"); $("kb-scrim").hidden = true; $("kb-menu").setAttribute("aria-expanded", "false"); }
  $("kb-menu").addEventListener("click", openMenu);
  $("kb-side-close").addEventListener("click", () => { closeMenu(); $("kb-menu").focus(); });
  $("kb-scrim").addEventListener("click", closeMenu);

  // ---- calls -----------------------------------------------------------------
  async function loadScenarios() {
    try {
      const r = await fetch(`${API}/scenarios`);
      scenarios = (await r.json()).scenarios || [];
    } catch (e) {
      $("kv-list").innerHTML = '<p class="kv-empty">Couldn’t reach the KinShield API. Try again in a moment.</p>';
      return;
    }
    renderList();
    $("o-load").innerHTML = '<option value="">Blank call</option>' +
      scenarios.filter((s) => s.label === "scam").map((s) => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join("");
    const p = new URLSearchParams(location.search);
    const id = p.get("id"), run = p.get("run");
    if (id && scenarios.some((s) => s.id === id)) play(id);
    else if (run === "scam" || run === "safe") play(pick(run === "scam" ? "scam" : "benign"));
    else if (p.get("own")) show("own");
  }

  function renderList() {
    const q = query.trim().toLowerCase();
    const rows = scenarios.filter((s) =>
      (type === "all" || (type === "scam" ? s.label === "scam" : s.label !== "scam")) &&
      (!q || s.title.toLowerCase().includes(q)));
    $("kv-list-t").textContent = type === "scam" ? "Scam calls" : type === "benign" ? "Safe calls" : "All calls";
    $("kv-list-n").textContent = `${rows.length} call${rows.length === 1 ? "" : "s"}`;
    $("kv-list").innerHTML = rows.length
      ? rows.map((s) => {
          const scam = s.label === "scam";
          return `<button class="kv-row" type="button" data-id="${esc(s.id)}">` +
            `<span class="kv-row-ic${scam ? "" : " ok"}" aria-hidden="true">${scam ? ICON.warn : ICON.check}</span>` +
            `<span class="kv-row-t"><b>${esc(s.title)}</b><small>${scam ? "Scripted scam · FTC / IC3 pattern" : "Ordinary call · should stay quiet"}</small></span>` +
            `<span class="kv-play" aria-hidden="true">${ICON.play}Play</span></button>`;
        }).join("")
      : '<p class="kv-empty">No calls match that search. Try <b>Test your own call</b> instead.</p>';
    $("kv-list").querySelectorAll(".kv-row").forEach((b) => b.addEventListener("click", () => play(b.dataset.id)));
  }

  document.querySelectorAll(".kv-search .kv-seg button").forEach((b) => b.addEventListener("click", () => {
    type = b.dataset.type;
    document.querySelectorAll(".kv-search .kv-seg button").forEach((x) => x.classList.toggle("is-on", x === b));
    renderList();
  }));
  $("kv-q").addEventListener("input", (e) => { query = e.target.value; renderList(); });

  // Scam calls that reliably reach HIGH, so "Random scam call", ?run=scam and "Try scam call" always
  // show the alert. Chosen 2026-10-03 by scoring every scam scenario twice on the live detector
  // (POST /detect {scenario_id}) and keeping ids that scored >= 75 (HIGH) both times. Some scams land
  // MEDIUM, so no alert fires (e.g. scam_009 utility shutoff scored 65 MEDIUM twice). The Calls list
  // still shows every call; this only steers the random picks.
  const RELIABLE_HIGH = new Set([
    "scam_001", "scam_002", "scam_003", "scam_004", "scam_005", "scam_006", "scam_007",
    "scam_011", "scam_012", "scam_013", "scam_015", "scam_017", "scam_018", "scam_019",
    "scam_020", "scam_021", "scam_025", "scam_027", "scam_028", "scam_029", "scam_030",
  ]);
  function pick(label) {
    let pool = scenarios.filter((s) => (label === "scam" ? s.label === "scam" : s.label !== "scam"));
    if (label === "scam") {
      const reliable = pool.filter((s) => RELIABLE_HIGH.has(s.id));
      if (reliable.length) pool = reliable; // fall back to every scam if none match
    }
    return pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
  }
  document.querySelectorAll("#kv-cards .kb-card-btn:not([data-view])").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.id) return play(scenarios.some((s) => s.id === b.dataset.id) ? b.dataset.id : pick("scam"));
    if (b.dataset.find) {
      const match = (s) => s.label === "scam" && s.title.toLowerCase().includes(b.dataset.find);
      const hit = scenarios.find((s) => match(s) && RELIABLE_HIGH.has(s.id)) || scenarios.find(match);
      return play(hit ? hit.id : pick("scam"));
    }
    play(pick(b.dataset.pick));
  }));
  $("kv-side-scam").addEventListener("click", () => play(pick("scam")));
  $("kv-side-safe").addEventListener("click", () => play(pick("benign")));
  const newCall = () => { stopCall(); show("calls"); $("kv-q").focus(); };
  $("kv-new").addEventListener("click", newCall);
  $("kv-top-new").addEventListener("click", newCall);

  function setMom(warn, title, sub) {
    document.querySelector(".kv-protect").classList.toggle("is-warn", warn);
    $("kv-mom-t").textContent = title || `${P()} · Protected`;
    $("kv-mom-s").textContent = sub || `KinVoice is watching ${Ps()} calls`;
  }

  // ---- detector ----------------------------------------------------------------
  // Score the call as it stood after `n` turns. Scripted calls are cached for this tab so a
  // replay doesn't spend Bedrock calls again.
  function scoreUpTo(sc, n) {
    const key = sc.custom ? null : `kv1:${sc.id}:${n}`;
    if (key) { try { const hit = sessionStorage.getItem(key); if (hit) return Promise.resolve(JSON.parse(hit)); } catch (e) { /* ignore */ } }
    return fetch(`${API}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turns: sc.turns.slice(0, n), session_id: "voice-app-" + Date.now() }),
    }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !RANK[d.risk_level]) throw new Error(d.error || `HTTP ${r.status}`);
      if (key) { try { sessionStorage.setItem(key, JSON.stringify(d)); } catch (e) { /* full */ } }
      return d;
    });
  }

  // Which turns get a score: every caller turn (thinned to MAX_POINTS) plus the last turn,
  // whose score is the verdict for the whole call.
  function scorePlan(turns) {
    const callerIdx = turns.map((t, i) => (t.speaker === "victim" ? -1 : i)).filter((i) => i >= 0);
    let pickIdx = callerIdx;
    if (callerIdx.length > MAX_POINTS - 1) {
      pickIdx = [];
      for (let k = 1; k < MAX_POINTS; k++) pickIdx.push(callerIdx[Math.round((k * callerIdx.length) / MAX_POINTS) - 1]);
    }
    return new Set([...pickIdx, turns.length - 1]);
  }

  // ---- voice -------------------------------------------------------------------
  let voiceOn = store.get("kinvoice_voice") === true;
  let audioNow = null;
  const pollyCache = new Map();
  function renderVoiceBtn() {
    $("c-voice").setAttribute("aria-pressed", String(voiceOn));
    $("c-voice-t").textContent = voiceOn ? "Voice on" : "Voice off";
    $("c-voice").classList.toggle("is-on", voiceOn);
  }
  $("c-voice").addEventListener("click", () => {
    voiceOn = !voiceOn;
    store.set("kinvoice_voice", voiceOn);
    renderVoiceBtn();
    if (!voiceOn) stopVoice();
    else if (current && playing) prefetchVoices(current.scenario.turns);
  });
  function polly(text) {
    if (!pollyCache.has(text)) {
      pollyCache.set(text, fetch(`${API}/kinbot`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "speak", text }),
      }).then((r) => r.json()).then((d) => {
        if (!d.audio) throw new Error("no audio");
        const bin = atob(d.audio), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      }).catch((e) => { pollyCache.delete(text); throw e; }));
    }
    return pollyCache.get(text);
  }
  function prefetchVoices(turns) { turns.filter((t) => t.speaker !== "victim").slice(0, 8).forEach((t) => polly(t.text).catch(() => {})); }
  function browserSay(text) {
    return new Promise((res) => {
      if (!("speechSynthesis" in window)) return res();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      const v = speechSynthesis.getVoices().find((x) => /^en(-|_)/i.test(x.lang) && /female|samantha|victoria|karen|zira|aria|jenny/i.test(x.name));
      if (v) u.voice = v;
      u.onend = u.onerror = () => res();
      speechSynthesis.speak(u);
    });
  }
  async function speakTurn(turn) {
    const cap = sleep(Math.max(readTime(turn.text), 16000));
    if (turn.speaker === "victim") return Promise.race([browserSay(turn.text), cap]);
    try {
      const url = await polly(turn.text);
      const a = new Audio(url);
      audioNow = a;
      await Promise.race([new Promise((res) => { a.onended = a.onerror = res; a.play().catch(res); }), cap]);
    } catch (e) {
      await Promise.race([browserSay(turn.text), cap]);
    }
  }
  function stopVoice() {
    if (audioNow) { audioNow.pause(); audioNow = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  // ---- live call -------------------------------------------------------------
  function kip(face, text) { $("c-kip").src = `img/kip-${face}.png${V}`; $("c-say").textContent = text; }

  function setRisk(level, score) {
    const lv = String(level || "IDLE").toLowerCase();
    $("c-score").textContent = score;
    $("c-level").textContent = level;
    $("c-riskcard").className = "kv-card kv-risk" + (["low", "medium", "high"].includes(lv) ? " l-" + lv : "");
    views.live.classList.toggle("is-high", lv === "high");
  }

  function stopCall() { runToken++; playing = false; stopVoice(); hideToast(); }

  function resetCall() {
    stopCall();
    closeModal();
    $("c-chat").innerHTML = "";
    $("c-ev").innerHTML = '<p class="kv-empty">Evidence appears once Bedrock has read the whole call.</p>';
    $("c-evn").textContent = "";
    $("c-scored").textContent = "";
    $("c-loc").innerHTML = "";
    $("c-lead").hidden = true;
    $("c-rec").hidden = true;
    $("c-act").hidden = true;
    $("c-tl").innerHTML = "";
    document.querySelectorAll("#c-sigs span").forEach((s) => s.classList.remove("on"));
    setRisk("IDLE", 0);
  }

  function addMsg(cls, html) {
    const chat = $("c-chat");
    const m = document.createElement("div");
    m.className = "kv-msg " + cls;
    m.innerHTML = html;
    chat.appendChild(m);
    chat.scrollTo({ top: chat.scrollHeight, behavior: reduce() ? "auto" : "smooth" });
    return m;
  }

  // Risk over the call: one dot per scored turn, threshold lines at Medium (25) and High (60).
  function renderTimeline() {
    const c = current;
    if (!c) return;
    const turns = c.scenario.turns, N = turns.length;
    const W = 320, H = 118, L = 26, R = 10, T = 10, B = 22;
    const x = (i) => L + (N <= 1 ? 0 : (i / (N - 1)) * (W - L - R));
    const y = (s) => T + (1 - Math.min(s, 120) / 120) * (H - T - B);
    const pts = c.points.slice().sort((a, b) => a.i - b.i);
    const line = [`${x(0)},${y(0)}`].concat(pts.map((p) => `${x(p.i)},${y(p.r.risk_score)}`)).join(" ");
    const lvl = (p) => p.r.risk_level.toLowerCase();
    const ticks = turns.map((t, i) => `<line x1="${x(i)}" x2="${x(i)}" y1="${H - B}" y2="${H - B + 4}" class="tk${t.speaker === "victim" ? " v" : ""}" />`).join("");
    const labels = turns.map((t, i) => (i === 0 || i === N - 1 || (c.alertPoint && c.alertPoint.i === i))
      ? `<text x="${x(i)}" y="${H - 4}" text-anchor="${i === 0 ? "start" : i === N - 1 ? "end" : "middle"}">${esc(t.t || "")}</text>` : "").join("");
    const ap = c.alertPoint;
    const flag = ap ? `<line x1="${x(ap.i)}" x2="${x(ap.i)}" y1="${T}" y2="${H - B}" class="fl" /><text x="${Math.min(x(ap.i) + 4, W - 40)}" y="${T + 9}" class="fl-t">Alert</text>` : "";
    $("c-tl").innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(pts.map((p) => `after turn ${p.i + 1}: ${p.r.risk_score} ${p.r.risk_level}`).join("; ") || "No scores yet")}">` +
      `<line x1="${L}" x2="${W - R}" y1="${y(60)}" y2="${y(60)}" class="th h" /><text x="${L - 4}" y="${y(60) + 3}" text-anchor="end" class="th-t">High</text>` +
      `<line x1="${L}" x2="${W - R}" y1="${y(25)}" y2="${y(25)}" class="th m" /><text x="${L - 4}" y="${y(25) + 3}" text-anchor="end" class="th-t">Med</text>` +
      `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="ax" />${ticks}${labels}${flag}` +
      (pts.length ? `<polyline points="${line}" class="ln" />` : "") +
      pts.map((p) => `<circle cx="${x(p.i)}" cy="${y(p.r.risk_score)}" r="4.5" class="dt ${lvl(p)}" />`).join("") +
      `</svg>`;
  }

  async function play(src) {
    if (!src) return;
    resetCall();
    const my = runToken;
    show("live");
    $("c-live").className = "kv-live";
    $("c-live").innerHTML = "<i></i>Listening";
    $("c-title").textContent = "Loading call…";
    kip("happy", "Connecting the call…");

    let sc = src;
    if (typeof src === "string") {
      try {
        const r = await fetch(`${API}/scenario?id=${encodeURIComponent(src)}`);
        if (!r.ok) throw new Error(r.status);
        sc = await r.json();
      } catch (e) {
        if (my !== runToken) return;
        $("c-title").textContent = "Call unavailable";
        kip("sad", "Couldn’t load that call. Pick another one from Calls.");
        return;
      }
    }
    if (my !== runToken) return;
    playing = true;
    if (window.KinGuide) window.KinGuide.collapse(); // keep the call in view; the pill still shows progress
    const turns = sc.turns || [];
    current = { scenario: sc, result: null, points: [], alertPoint: null };
    const who = sc.claimed_identity || "Unknown caller";
    $("c-kind").textContent = sc.custom ? "Your call · live score" : "Live call · scripted";
    $("c-title").textContent = sc.title || "Call";
    $("c-name").textContent = who;
    $("c-av").textContent = who.replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase() || "?";
    setRisk("LISTENING", 0);
    renderTimeline();
    status(`Playing: ${sc.title}`);
    kip("happy", sc.claimed_identity
      ? `${who} is calling ${P()} from a saved number, and the voice is a perfect match. Let’s listen.`
      : `A call is coming in on ${Ps()} phone. Let’s listen.`);
    if (voiceOn) prefetchVoices(turns);

    const plan = scorePlan(turns);
    const pending = [];
    let shownI = -1;
    const onPoint = (i, r) => {
      if (my !== runToken) return;
      current.points.push({ i, r });
      if (i > shownI && playing) { // the meter follows the newest score while the call plays
        shownI = i;
        setRisk(r.risk_level, r.risk_score);
        $("c-scored").textContent = `· after turn ${i + 1} of ${turns.length}`;
      }
      if (!current.alertPoint && RANK[r.risk_level] >= alertRank()) {
        current.alertPoint = { i, r };
        if (playing) pushToast(i, r);
      }
      renderTimeline();
    };

    let finalP = null;
    for (let i = 0; i < turns.length; i++) {
      if (my !== runToken) return;
      if (i === Math.ceil(turns.length * 0.5) && !current.alertPoint) kip("thinking", `Bedrock isn’t checking the voice. After each line it re-reads the call so far: what is the caller asking ${P()} to believe and do?`);
      const t = turns[i];
      const side = t.speaker === "victim" ? "victim" : "caller";
      const typing = addMsg("typing " + side, "<span></span><span></span><span></span>");
      typing.setAttribute("aria-hidden", "true");
      await sleep(sc.custom ? 350 : 600);
      typing.remove();
      if (my !== runToken) return;
      addMsg(side, `<small>${esc(side === "victim" ? P() : who)} · ${esc(t.t || "")}</small>${esc(t.text)}`);
      if (plan.has(i)) {
        const p = scoreUpTo(sc, i + 1);
        p.then((r) => onPoint(i, r), () => {});
        pending.push(p);
        if (i === turns.length - 1) finalP = p;
      }
      if (voiceOn) await speakTurn(t); else await sleep(sc.custom ? Math.min(readTime(t.text), 2400) : readTime(t.text));
    }
    playing = false;
    hideToast();
    $("c-live").className = "kv-live is-off";
    $("c-live").innerHTML = "<i></i>Call ended";

    $("c-ev").innerHTML = '<div class="kv-analyzing"><span class="kv-spin"></span>Scoring the whole call on Amazon Bedrock…</div>';
    let res;
    try { res = await finalP; } catch (e) { res = null; }
    await Promise.allSettled(pending);
    if (my !== runToken) return;
    if (!res) return detectorFailed(sc);
    current.result = res;
    const risky = res.risk_level !== "LOW";
    $("c-scored").textContent = "· whole call";

    await countUp(+$("c-score").textContent || 0, res.risk_score || 0, res.risk_level, my);
    if (my !== runToken) return;
    renderTimeline();
    renderLead(sc, res);

    const ev = res.evidence || [];
    const fired = new Set(ev.map((e) => e.signal));
    document.querySelectorAll("#c-sigs span").forEach((s) => s.classList.toggle("on", fired.has(s.dataset.sig)));
    $("c-evn").textContent = ev.length ? `(${ev.length})` : "";
    $("c-ev").innerHTML = ev.length ? "" : '<p class="kv-empty">No signals detected. This looks like an ordinary conversation.</p>';
    if (ev.length) kip(risky ? "sad" : "wink", "Every flag quotes the exact words that set it off, so you can see why.");
    for (const e of ev) {
      if (my !== runToken) return;
      $("c-ev").appendChild(evRow(e));
      await sleep(350);
    }

    renderLoc(sc);
    const rec = $("c-rec");
    rec.hidden = false;
    rec.className = "kv-rec" + (risky ? "" : " low");
    rec.innerHTML = `<b>${risky ? "Recommended action" : "All clear"}</b>${esc(res.recommended_action || "")}`;
    showActions(risky);
    log(sc, res);
    status(`${res.risk_level} risk, score ${res.risk_score}`);

    if (RANK[res.risk_level] >= alertRank()) {
      setMom(true, `${P()} · Verify caller`, `KinVoice flagged a ${res.risk_level.toLowerCase()}-risk call`);
      kip("confused", sc.claimed_identity ? `Is it really ${who}? Check with family on their own phone before anything else.` : "Is this caller who they say? Check with family before anything else.");
      await sleep(900);
      if (my !== runToken) return;
      alertDialog(res);
    } else {
      kip(risky ? "thinking" : "excited", risky ? "Some pressure signals, but below your alert level. Worth a quick check with family." : `${Ps()} phone still says Protected. Now try a scam call to see the difference.`);
    }
  }

  function evRow(e) {
    const row = document.createElement("div");
    row.className = "kv-ev " + weightClass(e.weight);
    row.innerHTML = `<span class="kv-ev-ic" aria-hidden="true">${sigIcon(e.signal)}</span>` +
      `<div><b>${esc(sigLabel(e.signal))} <span>· weight ${esc(e.weight)} · ${esc(tc(e.t))}</span></b><q>${esc(e.quote)}</q></div>`;
    return row;
  }

  // "Alert at 00:18 (turn 4 of 6) · 12 s before the money ask"
  function renderLead(sc, res) {
    const turns = sc.turns, N = turns.length, ap = current.alertPoint, el = $("c-lead");
    el.hidden = false;
    if (!ap) {
      el.className = "kv-lead ok";
      el.innerHTML = `${ICON.check}<span>Never reached your alert level, so no one was disturbed.</span>`;
      return;
    }
    const tA = secs(turns[ap.i].t), tEnd = secs(turns[N - 1].t);
    const moneyTs = (res.evidence || []).filter((e) => e.signal === "financial_request" || e.signal === "payment_anomaly").map((e) => secs(e.t)).filter((s) => s != null);
    const tM = moneyTs.length ? Math.min(...moneyTs) : null;
    const parts = [`<b>Alert at ${esc(turns[ap.i].t || "turn " + (ap.i + 1))}</b> (turn ${ap.i + 1} of ${N})`];
    if (tA != null && tM != null) parts.push(tA < tM ? `${tM - tA} s before the money ask` : tA === tM ? "on the line that asked for money" : `${tA - tM} s after the money ask`);
    if (tA != null && tEnd != null && tEnd > tA) parts.push(`${tEnd - tA} s before the call ended`);
    el.className = "kv-lead";
    el.innerHTML = `${ICON.bell}<span>${parts.join(" · ")}</span>`;
  }

  async function countUp(from, target, level, my) {
    for (let i = 1; i <= 24; i++) {
      if (my !== runToken) return;
      const v = Math.round(from + ((target - from) * i) / 24);
      setRisk(i === 24 ? level : v >= 60 ? "HIGH" : v >= 25 ? "MEDIUM" : "LOW", v);
      await sleep(35);
    }
  }

  function detectorFailed(sc) {
    setRisk("UNAVAILABLE", 0);
    $("c-ev").innerHTML = '<p class="kv-empty">We couldn’t score this call right now, so it has no risk score. That isn’t the same as safe.</p>';
    const rec = $("c-rec");
    rec.hidden = false;
    rec.className = "kv-rec";
    rec.innerHTML = "<b>Treat it with caution</b>Any request for money or secrecy is worth checking on a number you already have.";
    kip("sad", "Bedrock didn’t answer in time. An unscored call is unknown, never safe.");
    showActions(true);
    log(sc, null);
  }

  function showActions(risky) {
    const act = $("c-act");
    act.hidden = false;
    act.innerHTML = risky
      ? `<button class="kv-btn" type="button" id="a-verify">${ICON.shield}Verify with family</button>` +
        `<button class="kv-btn ghost" type="button" id="a-report">${ICON.doc}Fraud report</button>` +
        `<button class="kv-btn grey kv-span" type="button" id="a-safe">Mark safe</button>`
      : `<button class="kv-btn grey" type="button" id="a-back">All calls</button><button class="kv-btn" type="button" id="a-scam">${ICON.play}Try a scam call</button>`;
    if (risky) {
      $("a-verify").addEventListener("click", verifyDialog);
      $("a-report").addEventListener("click", reportDialog);
      $("a-safe").addEventListener("click", (e) => {
        e.currentTarget.disabled = true;
        e.currentTarget.textContent = "Marked safe";
        setMom(false, `${P()} · Protected`, "You marked the last call safe");
        kip("happy", "Marked safe. The score and quotes stay on record for the audit trail.");
      });
    } else {
      $("a-back").addEventListener("click", () => show("calls"));
      $("a-scam").addEventListener("click", () => play(pick("scam")));
    }
  }
  $("c-replay").addEventListener("click", () => { if (current) play(current.scenario.custom ? current.scenario : current.scenario.id); });

  // Simulated: compares where the caller CLAIMS to be with the real person's opted-in device.
  function renderLoc(sc) {
    const dev = sc.trusted_device;
    if (!dev || !sc.claimed_location) { $("c-loc").innerHTML = ""; return; }
    const ok = String(dev.location).trim().toLowerCase() === String(sc.claimed_location).trim().toLowerCase();
    $("c-loc").innerHTML = `<div class="kv-loc${ok ? "" : " bad"}">${ICON.pin}<div>` +
      `<b>${ok ? "Location claim is consistent" : "Location claim doesn’t match"}</b>` +
      `Caller says <strong>${esc(sc.claimed_location)}</strong>. ${esc(dev.person)}’s shared device: <strong>${esc(dev.location)}</strong>.` +
      `<small>Simulated. KinVoice never tracks the caller.</small></div></div>`;
  }

  // ---- mid-call push notification ------------------------------------------------
  function topEvidence(res, n) {
    const seen = new Set();
    return ((res && res.evidence) || []).slice().sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .filter((e) => { const q = (e.quote || "").trim().toLowerCase(); if (!q || seen.has(q)) return false; seen.add(q); return true; })
      .slice(0, n);
  }
  function pushToast(i, r) {
    tourDone("alert");
    const t = $("kv-toast");
    const top = topEvidence(r, 1)[0];
    const turn = current.scenario.turns[i];
    t.className = "kv-toast" + (r.risk_level === "HIGH" ? "" : " med");
    t.innerHTML = `<span class="kv-toast-ic" aria-hidden="true">${ICON.bell}</span><div class="kv-toast-b">` +
      `<span class="kv-toast-k">KinVoice · now · to ${esc(setup.me || "you")}</span>` +
      `<b>${r.risk_level === "HIGH" ? "High" : "Medium"}-risk call on ${esc(Ps())} phone</b>` +
      `<span>Still in progress · turn ${i + 1}${turn && turn.t ? " · " + esc(turn.t) : ""} · score ${esc(r.risk_score)}</span>` +
      (top ? `<q>${esc(top.quote)}</q>` : "") +
      `<div class="kv-toast-btns"><button class="kv-btn" type="button" id="t-verify">Verify now</button><button class="kv-btn grey" type="button" id="t-hide">Keep listening</button></div></div>`;
    t.hidden = false;
    $("t-verify").addEventListener("click", () => { hideToast(); verifyDialog(); });
    $("t-hide").addEventListener("click", hideToast);
    kip("surprised", `Alert sent to ${setup.me || "the caregiver"} while the call is still going. ${top ? "The line that tipped it: “" + top.quote + "”" : ""}`);
    status(`Alert: ${r.risk_level} risk during the call`);
  }
  function hideToast() { $("kv-toast").hidden = true; }

  // ---- dialogs ---------------------------------------------------------------
  let lastFocus = null;
  function openModal(html, opts = {}) {
    if ($("kv-modal").hidden) lastFocus = document.activeElement;
    const d = $("kv-dialog");
    d.className = "kv-dialog" + (opts.red ? " red" : "") + (opts.wide ? " wide" : "");
    d.innerHTML = html;
    $("kv-modal").hidden = false;
    wireClose();
    const f = d.querySelector(".kv-d-body input, .kv-d-body button");
    if (f) f.focus({ preventScroll: true });
  }
  function wireClose() { $("kv-dialog").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal)); }
  function closeModal() {
    if ($("kv-modal").hidden) return;
    $("kv-modal").hidden = true;
    $("kv-dialog").innerHTML = "";
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  document.querySelector(".kv-modal-scrim").addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!$("kv-modal").hidden) closeModal(); else if (!$("kv-toast").hidden) hideToast(); else closeMenu(); }
    if (e.key === "Tab" && !$("kv-modal").hidden) { // keep focus inside the dialog
      const f = Array.from($("kv-dialog").querySelectorAll("button, input, select, textarea, a[href]")).filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  const head = (t) => `<div class="kv-d-head"><span id="kv-dialog-title">${esc(t)}</span><button class="kv-d-x" type="button" data-close aria-label="Close">${ICON.x}</button></div>`;

  function alertDialog(res) {
    openModal(head("Push alert · just now") +
      `<div class="kv-d-body"><div class="kv-d-ic red" aria-hidden="true">${ICON.warn}</div>` +
      `<h3 class="kv-d-t">${res.risk_level === "HIGH" ? "High" : "Medium"}-risk call on ${esc(Ps())} phone</h3>` +
      `<p class="kv-d-p">${esc(res.recommended_action || "End the call and call back on a number you already have.")}</p>` +
      `<div class="kv-d-list">${topEvidence(res, 3).map((e) => `<div>${sigIcon(e.signal)}<span><b>${esc(sigLabel(e.signal))}</b><q>${esc(e.quote)}</q></span></div>`).join("")}</div>` +
      `<div class="kv-d-btns"><button class="kv-btn ink" type="button" id="al-verify">Verify with family</button>` +
      `<button class="kv-btn ghost" type="button" id="al-report">${ICON.doc}Create a fraud report</button>` +
      `<button class="kv-btn grey" type="button" data-close>Dismiss</button></div>` +
      `<p class="kv-d-note">${esc(setup.me || "The caregiver")} gets this the moment risk crosses ${setup.alertAt === "MEDIUM" ? "Medium" : "High"}.</p></div>`, { red: true });
    $("al-verify").addEventListener("click", verifyDialog);
    $("al-report").addEventListener("click", reportDialog);
  }

  function askOf(res) {
    const hit = ((res && res.evidence) || []).find((e) => e.signal === "financial_request" || e.signal === "payment_anomaly");
    return hit ? hit.quote : "an urgent request for money";
  }

  // FamilyVerify: check with the person the caller claims to be, if they're a trusted contact;
  // otherwise let the caregiver choose who to ask.
  function verifyDialog() {
    const claimed = (current && current.scenario.claimed_identity) || "";
    const contacts = setup.contacts.filter((c) => c.name);
    const first = claimed.toLowerCase().split(/[\s,]+/)[0];
    const match = contacts.find((c) => first && (c.name.toLowerCase() === first || claimed.toLowerCase().includes(c.name.toLowerCase())));
    if (match || !contacts.length) return verifyStep(match || { name: claimed || "the family member", rel: "" }, claimed, !!match);
    openModal(head("FamilyVerify") +
      `<div class="kv-d-body"><div class="kv-d-ic" aria-hidden="true">${ICON.shield}</div>` +
      `<h3 class="kv-d-t">Who should Kip check with?</h3>` +
      `<p class="kv-d-p">${claimed ? `“${esc(claimed)}” isn’t one of your trusted contacts.` : "The caller didn’t say who they are."} Pick someone who would know if this call is real.</p>` +
      `<div class="kv-d-btns">${contacts.map((c, i) => `<button class="kv-btn ghost" type="button" data-ci="${i}">${esc(c.name)}${c.rel ? ` · ${esc(c.rel)}` : ""}</button>`).join("")}</div>` +
      `<p class="kv-d-note">Edit trusted contacts in Family setup.</p></div>`);
    $("kv-dialog").querySelectorAll("[data-ci]").forEach((b) => b.addEventListener("click", () => verifyStep(contacts[+b.dataset.ci], claimed, false)));
  }

  function verifyStep(target, claimed, isCaller) {
    openModal(head("FamilyVerify") +
      `<div class="kv-d-body"><div class="kv-d-ic" aria-hidden="true">${ICON.shield}</div>` +
      `<h3 class="kv-d-t">Ask ${esc(target.name)}?</h3>` +
      `<p class="kv-d-p">KinVoice pings ${esc(target.name)}’s own phone, not the number that called, and asks if this call is real.</p>` +
      `<div class="kv-swipe" id="kv-swipe"><span class="kv-swipe-t">Swipe to ping ${esc(target.name)}</span>` +
      `<button class="kv-swipe-k" type="button" id="kv-swipe-k" aria-label="Ping ${esc(target.name)} now">${ICON.chev}</button></div>` +
      (setup.safeword ? `<p class="kv-d-tip">${ICON.lock}<span>Or have ${esc(P())} ask for your family safe word, <b>“${esc(setup.safeword)}”</b>. A cloned voice can copy how someone sounds, not what only your family knows.</span></p>` : "") +
      `<p class="kv-d-note">Simulated in this demo. In production it’s a push notification on a channel the caller can’t touch.</p></div>`);
    swipe($("kv-swipe"), $("kv-swipe-k"), () => ping(target, claimed, isCaller));
  }

  // Drag the knob to the end, or press it (click / keyboard) to confirm.
  function swipe(track, knob, done) {
    let x0 = null, dx = 0, moved = false;
    const max = () => track.clientWidth - knob.offsetWidth - 10;
    const finish = () => { knob.disabled = true; done(); };
    knob.addEventListener("pointerdown", (e) => { x0 = e.clientX; moved = false; knob.setPointerCapture(e.pointerId); knob.style.transition = "none"; });
    knob.addEventListener("pointermove", (e) => {
      if (x0 === null) return;
      dx = Math.max(0, Math.min(max(), e.clientX - x0));
      if (dx > 4) moved = true;
      knob.style.transform = `translateX(${dx}px)`;
    });
    knob.addEventListener("pointerup", () => {
      if (x0 === null) return;
      x0 = null;
      knob.style.transition = "transform .2s";
      if (dx >= max() * 0.8) { knob.style.transform = `translateX(${max()}px)`; finish(); }
      else { knob.style.transform = ""; if (!moved) finish(); }
      dx = 0;
    });
    knob.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); } });
  }

  function ping(target, claimed, isCaller) {
    const body = $("kv-dialog").querySelector(".kv-d-body");
    const who = claimed || "someone";
    body.innerHTML = `<div class="kv-ping"><span class="kv-spin"></span>Pinging ${esc(target.name)}’s phone…</div>`;
    setTimeout(() => {
      if ($("kv-modal").hidden) return;
      body.innerHTML = `<div class="kv-d-ic" aria-hidden="true">${ICON.phone}</div>` +
        `<h3 class="kv-d-t">On ${esc(target.name)}’s phone</h3>` +
        `<p class="kv-d-p">${isCaller ? `Someone calling as <strong>you</strong>` : `Someone calling as <strong>${esc(who)}</strong>`} asked ${esc(P())} for <q>${esc(askOf(current && current.result))}</q>. ${isCaller ? "Was this you?" : "Is this real?"}</p>` +
        `<div class="kv-d-btns"><button class="kv-btn red" type="button" id="v-no">${isCaller ? "No, it wasn’t me" : "No, it’s not real"}</button><button class="kv-btn grey" type="button" id="v-yes">${isCaller ? "Yes, it was me" : "Yes, it’s real"}</button></div>` +
        `<p class="kv-d-note">You’re answering as ${esc(target.name)} for this demo.</p>`;
      $("v-no").focus({ preventScroll: true });
      $("v-no").addEventListener("click", () => verified(target, false));
      $("v-yes").addEventListener("click", () => verified(target, true));
    }, 1300);
  }

  function verified(target, yes) {
    tourDone("verify");
    const body = $("kv-dialog").querySelector(".kv-d-body");
    const n = esc(target.name);
    body.innerHTML = `<div class="kv-d-ic${yes ? "" : " red"}" aria-hidden="true">${yes ? ICON.check : ICON.x}</div>` +
      `<h3 class="kv-d-t">${yes ? `${n} says it’s real` : "Caller not verified"}</h3>` +
      `<p class="kv-d-p">${yes ? `${n} confirmed the call. ${esc(Ps())} phone is back to Protected.` : `${n} says it isn’t real. Tell ${esc(P())} to hang up and not send anything.`}</p>` +
      `<div class="kv-d-btns">${yes ? "" : `<button class="kv-btn ghost" type="button" id="v-report">${ICON.doc}Create a fraud report</button>`}<button class="kv-btn grey" type="button" data-close>${yes ? "Great!" : "Got it"}</button></div>`;
    wireClose();
    if (!yes) $("v-report").addEventListener("click", reportDialog);
    body.querySelector("button").focus({ preventScroll: true });
    if (yes) { setMom(false, `${P()} · Protected`, `${target.name} confirmed the last call`); kip("excited", `${target.name} confirmed it. ${Ps()} phone is Protected again.`); }
    else { setMom(true, `${P()} · Caller not verified`, `${target.name} says it isn’t real`); kip("sad", `${target.name} says it isn’t real. KinVoice was right to flag it.`); }
    const h = history[0];
    if (h) { h.verify = yes ? `Confirmed by ${target.name}` : `Not verified by ${target.name}`; renderHistory(); renderFeed(); }
  }

  // ---- fraud report ------------------------------------------------------------
  function scamType(ev) {
    const s = new Set(ev.map((e) => e.signal));
    if (s.has("emergency") || (s.has("impersonation") && !s.has("authority_pressure"))) return "Family-emergency impostor scam (\"grandparent scam\")";
    if (s.has("authority_pressure")) return "Impostor scam (government, bank or company)";
    return "Phone scam";
  }
  function buildReport() {
    const sc = current.scenario, res = current.result || { evidence: [] }, ev = res.evidence || [];
    const pay = ev.filter((e) => e.signal === "payment_anomaly" || e.signal === "financial_request");
    const L = [];
    L.push("SCAM CALL REPORT (prepared by KinVoice)");
    L.push(`Prepared: ${new Date().toLocaleString()}`);
    if (!sc.custom) L.push("NOTE: this is a scripted demo call. Practice only; don't file it.");
    L.push("");
    L.push(`Person called: ${P()}`);
    L.push(`Caller claimed to be: ${sc.claimed_identity || "not stated"}`);
    L.push(`Likely type: ${scamType(ev)}`);
    L.push(`KinVoice risk: ${res.risk_level || "unknown"} (score ${res.risk_score != null ? res.risk_score : "n/a"})`);
    if (current.alertPoint) L.push(`Caregiver alerted: turn ${current.alertPoint.i + 1}${sc.turns[current.alertPoint.i].t ? " at " + sc.turns[current.alertPoint.i].t : ""} of the call`);
    if (pay.length) { L.push(""); L.push("What they asked for:"); pay.forEach((e) => L.push(`  [${tc(e.t)}] "${e.quote}"`)); }
    L.push(""); L.push("Warning signs (exact words):");
    ev.forEach((e) => L.push(`  - ${sigLabel(e.signal)} [${tc(e.t)}]: "${e.quote}"`));
    if (!ev.length) L.push("  none detected");
    const h = history.find((x) => x.scenario === sc || x.id === sc.id);
    if (h && h.verify) { L.push(""); L.push(`FamilyVerify: ${h.verify}`); }
    L.push(""); L.push("Transcript:");
    sc.turns.forEach((t) => L.push(`  [${t.t || ""}] ${t.speaker === "victim" ? P() : sc.claimed_identity || "Caller"}: ${t.text}`));
    L.push(""); L.push("Where to report:");
    L.push("  - FTC: https://reportfraud.ftc.gov");
    L.push("  - FBI Internet Crime Complaint Center (IC3): https://www.ic3.gov");
    L.push("  - National Elder Fraud Hotline (US DOJ): 1-833-372-8311");
    L.push("If money or gift-card codes were already sent: call the bank or the gift-card company right away, and keep the receipts.");
    return L.join("\n");
  }
  function reportDialog() {
    if (!current) return;
    tourDone("report");
    const text = buildReport();
    openModal(head("Fraud report") +
      `<div class="kv-d-body kv-d-left"><h3 class="kv-d-t">Ready to file</h3>` +
      `<p class="kv-d-p">Everything a report form asks for: who called, what they asked for, the exact words, and when. Copy it into the FTC or IC3 form, or save it.</p>` +
      `<pre class="kv-report" tabindex="0" aria-label="Report text">${esc(text)}</pre>` +
      `<div class="kv-d-row"><button class="kv-btn" type="button" id="r-copy">Copy report</button><button class="kv-btn ghost" type="button" id="r-save">Download .txt</button></div>` +
      `<div class="kv-d-links"><a href="https://reportfraud.ftc.gov" target="_blank" rel="noopener">Report to the FTC ↗</a><a href="https://www.ic3.gov" target="_blank" rel="noopener">Report to IC3 ↗</a></div>` +
      (current.scenario.custom ? "" : `<p class="kv-d-note">This is a scripted demo call, so please don’t file it. With a real call, this is what you’d send.</p>`) + `</div>`, { wide: true });
    $("r-copy").addEventListener("click", async (e) => {
      const b = e.currentTarget;
      try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; }
      catch (err) { const pre = $("kv-dialog").querySelector(".kv-report"); const r = document.createRange(); r.selectNodeContents(pre); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = "Selected, press Ctrl/⌘+C"; }
    });
    $("r-save").addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      a.download = `kinvoice-report-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  }

  // ---- family setup wizard -----------------------------------------------------
  let draft = null;
  function openSetup(step = 1) {
    if (step === 1) draft = JSON.parse(JSON.stringify(setup));
    const bars = [1, 2, 3].map((n) => `<i class="${n <= step ? "on" : ""}"></i>`).join("");
    let body = "";
    if (step === 1) {
      body = `<h3 class="kv-d-t">Who are you protecting?</h3>` +
        `<label class="kv-field"><span>Their name, as you call them</span><input id="s-name" maxlength="24" value="${esc(draft.name)}" placeholder="Mom" /></label>` +
        `<div class="kv-field"><span>They are your</span><div class="kv-chips" role="radiogroup" aria-label="Relationship">${["Mom", "Dad", "Grandma", "Grandpa", "Other"].map((r) => `<button type="button" role="radio" aria-checked="${draft.rel === r}" data-rel="${r}">${r}</button>`).join("")}</div></div>` +
        `<label class="kv-field"><span>Your name (alerts come to you)</span><input id="s-me" maxlength="24" value="${esc(draft.me)}" placeholder="Sarah" /></label>`;
    } else if (step === 2) {
      body = `<h3 class="kv-d-t">Who should Kip check with?</h3>` +
        `<p class="kv-d-p">FamilyVerify asks these people, on their own phones, whether a call that claims to be them is real.</p>` +
        [0, 1, 2].map((i) => { const c = draft.contacts[i] || { name: "", rel: "" }; return `<div class="kv-d-pair"><label class="kv-field"><span>Name</span><input data-cn="${i}" maxlength="24" value="${esc(c.name)}" placeholder="${["Daniel", "Leo", "Dad"][i]}" /></label><label class="kv-field"><span>Relationship</span><input data-cr="${i}" maxlength="24" value="${esc(c.rel)}" placeholder="${["Grandson", "Grandson", "Husband"][i]}" /></label></div>`; }).join("");
    } else {
      body = `<h3 class="kv-d-t">How should Kip warn you?</h3>` +
        `<div class="kv-field"><span>Alert me when a call reaches</span><div class="kv-chips" role="radiogroup" aria-label="Alert level"><button type="button" role="radio" aria-checked="${draft.alertAt === "HIGH"}" data-at="HIGH">High risk only</button><button type="button" role="radio" aria-checked="${draft.alertAt === "MEDIUM"}" data-at="MEDIUM">Medium and High</button></div></div>` +
        `<div class="kv-field"><span>Send alerts by</span><div class="kv-checks">${[["push", "Push alert"], ["sms", "Text message"], ["email", "Email"]].map(([k, l]) => `<label><input type="checkbox" data-ch="${k}" ${draft.channels.includes(k) ? "checked" : ""} /> ${l}</label>`).join("")}</div><small>Push alerts appear in this demo. Text and email are planned.</small></div>` +
        `<label class="kv-field"><span>Family safe word (optional)</span><input id="s-word" maxlength="24" value="${esc(draft.safeword)}" placeholder="e.g. blue pancakes" /><small>A word only your family knows. A cloned voice can’t guess it.</small></label>`;
    }
    openModal(head("Family setup") +
      `<div class="kv-d-body kv-d-left"><div class="kv-steps" aria-hidden="true">${bars}</div><p class="kv-k">Answer a few questions · ${step} of 3</p>${body}` +
      `<div class="kv-d-row">${step > 1 ? `<button class="kv-btn grey" type="button" id="s-back">Back</button>` : `<button class="kv-btn grey" type="button" data-close>Cancel</button>`}` +
      `<button class="kv-btn" type="button" id="s-next">${step < 3 ? "Continue" : "Save setup"}</button></div>` +
      `<p class="kv-d-note">Saved only in this browser. KinShield has no accounts yet.</p></div>`);
    const d = $("kv-dialog");
    d.querySelectorAll("[data-rel]").forEach((b) => b.addEventListener("click", () => { draft.rel = b.dataset.rel; d.querySelectorAll("[data-rel]").forEach((x) => x.setAttribute("aria-checked", String(x === b))); const n = $("s-name"); if (n && (!n.value || ["Mom", "Dad", "Grandma", "Grandpa"].includes(n.value)) && b.dataset.rel !== "Other") n.value = b.dataset.rel; }));
    d.querySelectorAll("[data-at]").forEach((b) => b.addEventListener("click", () => { draft.alertAt = b.dataset.at; d.querySelectorAll("[data-at]").forEach((x) => x.setAttribute("aria-checked", String(x === b))); }));
    const collect = () => {
      if (step === 1) { draft.name = $("s-name").value.trim() || "Mom"; draft.me = $("s-me").value.trim() || "you"; }
      if (step === 2) draft.contacts = [0, 1, 2].map((i) => ({ name: d.querySelector(`[data-cn="${i}"]`).value.trim(), rel: d.querySelector(`[data-cr="${i}"]`).value.trim() }));
      if (step === 3) { draft.channels = Array.from(d.querySelectorAll("[data-ch]:checked")).map((x) => x.dataset.ch); draft.safeword = $("s-word").value.trim(); }
    };
    if ($("s-back")) $("s-back").addEventListener("click", () => { collect(); openSetup(step - 1); });
    $("s-next").addEventListener("click", () => {
      collect();
      if (step < 3) return openSetup(step + 1);
      setup = Object.assign({}, draft, { done: true });
      store.set(SETUP_KEY, setup);
      tourDone("setup");
      applySetup();
      closeModal();
      status(`Saved. KinVoice is protecting ${P()}.`);
    });
  }
  $("kv-setup-card").addEventListener("click", () => openSetup(1));
  $("kv-side-setup").addEventListener("click", () => { closeMenu(); openSetup(1); });
  $("kv-protect").addEventListener("click", () => openSetup(1));

  // ---- test your own call -------------------------------------------------------
  let own = [];
  let ownSpeaker = "caller";
  function renderOwn() {
    $("o-lines").innerHTML = own.length
      ? own.map((t, i) => `<div class="kv-own-line ${t.speaker === "victim" ? "victim" : "caller"}"><span class="kv-own-who">${esc(t.speaker === "victim" ? P() : $("o-who").value.trim() || "Caller")}</span><span class="kv-own-txt">${esc(t.text)}</span><button type="button" class="kv-own-x" data-del="${i}" aria-label="Remove line ${i + 1}">${ICON.trash}</button></div>`).join("")
      : `<p class="kv-empty">No lines yet. Start with what the caller says first.</p>`;
    $("o-lines").querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { own.splice(+b.dataset.del, 1); renderOwn(); }));
    $("o-run").disabled = !own.some((t) => t.speaker !== "victim");
  }
  function setSpeaker(sp) {
    ownSpeaker = sp;
    document.querySelectorAll(".kv-who button").forEach((b) => b.classList.toggle("is-on", b.dataset.sp === sp));
    $("o-text").placeholder = sp === "victim" ? `Type what ${P()} says, then press Enter` : "Type what the caller says, then press Enter";
  }
  document.querySelectorAll(".kv-who button").forEach((b) => b.addEventListener("click", () => { setSpeaker(b.dataset.sp); $("o-text").focus(); }));
  function addLine() {
    const text = $("o-text").value.trim();
    if (!text) return;
    if (own.length >= 30) { status("That’s the 30-line limit."); return; }
    own.push({ speaker: ownSpeaker, text });
    $("o-text").value = "";
    renderOwn();
    $("o-lines").lastElementChild.scrollIntoView({ block: "nearest" });
  }
  $("o-add").addEventListener("click", addLine);
  $("o-text").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addLine(); } });
  $("o-who").addEventListener("input", renderOwn);
  $("o-clear").addEventListener("click", () => { own = []; $("o-load").value = ""; renderOwn(); });
  $("o-load").addEventListener("change", async (e) => {
    const id = e.target.value;
    if (!id) return;
    try {
      const sc = await (await fetch(`${API}/scenario?id=${encodeURIComponent(id)}`)).json();
      own = (sc.turns || []).map((t) => ({ speaker: t.speaker === "victim" ? "victim" : "caller", text: t.text }));
      $("o-who").value = sc.claimed_identity || "";
      renderOwn();
      status("Loaded. Edit any line, then run it.");
    } catch (err) { status("Couldn’t load that call."); }
  });
  $("o-paste-go").addEventListener("click", () => {
    const victimRe = new RegExp(`^(mom|me|i|you|grandma|grandpa|dad|victim|protected|${P().replace(/[^\w ]/g, "")})$`, "i");
    let alt = "caller";
    const lines = $("o-paste").value.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 30);
    own = lines.map((l) => {
      const m = l.match(/^\s*([A-Za-z][\w .'-]{0,24})\s*[:\-–]\s*(.+)$/);
      if (m) { const sp = victimRe.test(m[1].trim()) ? "victim" : "caller"; alt = sp === "caller" ? "victim" : "caller"; return { speaker: sp, text: m[2].trim() }; }
      const sp = alt; alt = alt === "caller" ? "victim" : "caller"; return { speaker: sp, text: l };
    });
    renderOwn();
    status(`${own.length} lines added.`);
  });
  $("o-run").addEventListener("click", () => {
    const turns = [];
    let t = 0;
    own.forEach((l) => { turns.push({ t: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`, speaker: l.speaker, text: l.text }); t += Math.max(3, Math.round(l.text.length / 14)); });
    const firstCaller = (own.find((l) => l.speaker !== "victim") || own[0]).text;
    play({ id: "own-" + Date.now(), custom: true, title: `Your call: “${firstCaller.length > 48 ? firstCaller.slice(0, 46) + "…" : firstCaller}”`, claimed_identity: $("o-who").value.trim(), turns });
  });

  // Voice typing: the browser's own speech recognition (Chrome, Edge, Safari).
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  if (!SR) {
    $("o-mic").disabled = true;
    $("o-mic").title = "Voice typing needs Chrome, Edge or Safari";
  }
  $("o-mic").addEventListener("click", () => {
    if (!SR) return;
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    const base = $("o-text").value ? $("o-text").value + " " : "";
    rec.onresult = (e) => { $("o-text").value = base + Array.from(e.results).map((r) => r[0].transcript).join(""); };
    rec.onerror = (e) => { $("o-mic-note").hidden = false; $("o-mic-note").textContent = e.error === "not-allowed" ? "Microphone access was blocked. Allow it in the browser, or type instead." : "Couldn’t hear that. Try again, or type the line."; };
    rec.onend = () => { rec = null; $("o-mic").setAttribute("aria-pressed", "false"); $("o-mic").classList.remove("is-rec"); $("o-text").focus(); };
    $("o-mic-note").hidden = false;
    $("o-mic-note").textContent = "Listening… say one line, then press Enter to add it.";
    $("o-mic").setAttribute("aria-pressed", "true");
    $("o-mic").classList.add("is-rec");
    rec.start();
  });

  // ---- this visit: sidebar history + alerts ----------------------------------
  function log(sc, res) {
    if (sc.custom) tourDone("own"); else if (sc.label === "scam") tourDone("scam");
    history.unshift({ id: sc.id, scenario: sc.custom ? sc : null, title: sc.title, level: res ? res.risk_level : "ERR", score: res ? res.risk_score : null, at: new Date() });
    unseen++;
    renderCount();
    renderHistory();
    if (window.KinGuide) window.KinGuide.refresh(); // verify/report unlock once a call is scored
  }
  const replay = (h) => play(h.scenario || h.id);
  function renderCount() { $("kv-alert-n").hidden = unseen === 0; $("kv-alert-n").textContent = unseen; }
  function renderHistory() {
    $("kv-history-empty").hidden = history.length > 0;
    $("kv-history").querySelectorAll(".kb-hist").forEach((n) => n.remove());
    history.slice(0, 8).forEach((h) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kb-hist";
      b.setAttribute("role", "listitem");
      b.innerHTML = `<span class="kb-hist-t"><i class="${h.level}"></i><span>${esc(h.title)}</span></span>` +
        `<small>${h.level === "ERR" ? "Not scored" : `${esc(h.level)} · ${esc(h.score)}`}${h.verify ? " · " + esc(h.verify) : ""}</small>`;
      b.addEventListener("click", () => replay(h));
      $("kv-history").appendChild(b);
    });
  }
  function renderFeed() {
    const rows = history.filter((h) => feedFilter === "all" || h.level === feedFilter);
    $("kv-feed").innerHTML = rows.length
      ? rows.map((h) => `<button class="kv-row" type="button" data-hi="${history.indexOf(h)}"><span class="kv-fi-ic ${h.level}" aria-hidden="true">${h.level === "LOW" ? ICON.check : h.level === "ERR" ? ICON.info : ICON.warn}</span>` +
          `<span class="kv-row-t"><b>${h.level === "ERR" ? "Not scored" : `${esc(h.level)} risk · ${esc(h.score)}`}</b><small>${esc(h.title)}${h.verify ? " · " + esc(h.verify) : ""}</small></span>` +
          `<time>${h.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></button>`).join("")
      : `<div class="kv-feed-empty"><img src="img/kip-wink.png${V}" alt="" width="320" height="320" /><b>No alerts yet</b><span>Play a call and its result lands here.</span></div>`;
    $("kv-feed").querySelectorAll(".kv-row").forEach((b) => b.addEventListener("click", () => replay(history[+b.dataset.hi])));
  }
  document.querySelectorAll("[data-f]").forEach((c) => c.addEventListener("click", () => {
    feedFilter = c.dataset.f;
    document.querySelectorAll("[data-f]").forEach((x) => x.classList.toggle("is-on", x === c));
    renderFeed();
  }));



  // kinvoice-app.html?preview=1 is the frozen copy embedded on kinvoice.html. It draws a saved real
  // result (kinvoice-preview.json: scam_001 scored turn by turn on the live detector) with the same
  // render code as a played call, so the embed follows any UI change here. No API calls, no dialogs.
  function showPreview() {
    document.documentElement.classList.add("kv-preview");
    fetch("kinvoice-preview.json").then((r) => r.json()).then((p) => {
      const sc = p.scenario, turns = sc.turns || [], pts = p.points || [];
      const res = pts.length ? pts[pts.length - 1].r : null;
      if (!res) return;
      show("live");
      current = { scenario: sc, result: res, points: pts, alertPoint: pts.find((x) => RANK[x.r.risk_level] >= alertRank()) || null };
      const who = sc.claimed_identity || "Unknown caller";
      $("c-kind").textContent = "Live call · scripted";
      $("c-title").textContent = sc.title || "Call";
      $("c-name").textContent = who;
      $("c-av").textContent = who.replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase() || "?";
      $("c-live").className = "kv-live is-off";
      $("c-live").innerHTML = "<i></i>Call ended";
      $("c-chat").innerHTML = "";
      turns.forEach((t) => { const side = t.speaker === "victim" ? "victim" : "caller"; addMsg(side, `<small>${esc(side === "victim" ? P() : who)} · ${esc(t.t || "")}</small>${esc(t.text)}`); });
      $("c-chat").scrollTop = 0;
      setRisk(res.risk_level, res.risk_score);
      $("c-scored").textContent = "· whole call";
      renderTimeline();
      renderLead(sc, res);
      const ev = res.evidence || [], fired = new Set(ev.map((e) => e.signal));
      document.querySelectorAll("#c-sigs span").forEach((s) => s.classList.toggle("on", fired.has(s.dataset.sig)));
      $("c-evn").textContent = ev.length ? `(${ev.length})` : "";
      $("c-ev").innerHTML = "";
      ev.forEach((e) => $("c-ev").appendChild(evRow(e)));
      renderLoc(sc);
      const risky = res.risk_level !== "LOW";
      $("c-rec").hidden = false;
      $("c-rec").className = "kv-rec" + (risky ? "" : " low");
      $("c-rec").innerHTML = `<b>${risky ? "Recommended action" : "All clear"}</b>${esc(res.recommended_action || "")}`;
      showActions(risky);
      setMom(true, `${P()} · Verify caller`, `KinVoice flagged a ${res.risk_level.toLowerCase()}-risk call`);
      kip("confused", `Is it really ${who}? Check with family on their own phone before anything else.`);
      history.unshift({ id: sc.id, scenario: null, title: sc.title, level: res.risk_level, score: res.risk_score, at: new Date() });
      unseen = 1;
      renderCount();
      renderHistory();
    }).catch(() => { /* the empty Calls view is still a fine preview */ });
  }

  const PREVIEW = /[?&]preview=/.test(location.search);
  if (PREVIEW) setup = Object.assign({}, DEFAULTS); // stable names, whatever this browser saved
  // ---- "Get started" guide (shared guide.js: corner pill, checklist, coachmarks) ----------
  const GI = {
    phone: ICON.phone, bell: ICON.bell, shield: ICON.shield, doc: ICON.doc,
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3 3 0 0 1 0 6M21 20a5.5 5.5 0 0 0-4-5.3" /></svg>',
  };
  const scamPick = () => (scenarios.some((x) => x.id === "scam_001") ? "scam_001" : pick("scam"));
  const scored = () => current && current.result && current.result.risk_level !== "LOW";
  function tourDone(k) { if (window.KinGuide) window.KinGuide.done(k); }
  if (window.KinGuide) window.KinGuide.init({
    id: "kinvoice",
    title: "Protect a call in three minutes",
    help: "Six quick things to try. Each one points at the real button.",
    steps: [
      { k: "scam", t: "Play a scam call", d: "A “grandson” asks for bail in gift cards.", icon: GI.phone,
        tip: "This call sounds exactly like family, from a saved number. Watch KinVoice read what the caller asks for.",
        prep: () => show("calls"), target: () => document.querySelector('#kv-cards [data-id="scam_001"]'),
        action: { label: "Play the call", time: "40 s", run: () => play(scamPick()) } },
      { k: "alert", t: "Catch the alert mid-call", d: "The caregiver is warned before money moves.", icon: GI.bell,
        tip: "The risk is re-scored after every line. When it crosses High, a push alert goes out while the call is still going.",
        prep: () => { if (current) show("live"); else show("calls"); },
        target: () => (current ? $("c-tl") : document.querySelector('#kv-cards [data-id="scam_001"]')),
        action: { label: "Watch it happen", run: () => { if (!playing) play(scamPick()); } } },
      { k: "verify", t: "Check with family", d: "Ask the real person, on their own phone.", icon: GI.shield,
        locked: () => (scored() ? null : "Unlocks after a scam call is scored"),
        tip: "FamilyVerify pings the person the caller claims to be, on a channel the caller can’t touch.",
        prep: () => show("live"), target: () => $("a-verify"), action: { label: "Verify with family", run: () => verifyDialog() } },
      { k: "report", t: "Create a fraud report", d: "Every warning sign, in the caller’s words.", icon: GI.doc,
        locked: () => (scored() ? null : "Unlocks after a scam call is scored"),
        tip: "One tap builds a report with what was asked for, every quote and timestamp, ready for the FTC or IC3.",
        prep: () => show("live"), target: () => $("a-report"), action: { label: "Build the report", run: () => reportDialog() } },
      { k: "own", t: "Test your own call", d: "Type, say or paste any call.", icon: GI.mic,
        tip: "We added an example bank-fraud call. Edit any line, or run it as it is. The same live detector scores it.",
        prep: () => {
          show("own");
          if (!own.length) {
            $("o-who").value = "Your bank’s fraud team";
            own = [
              { speaker: "caller", text: "This is the fraud department at your bank. Someone is trying to empty your account right now." },
              { speaker: "victim", text: "Oh no. What should I do?" },
              { speaker: "caller", text: "Don’t hang up and don’t call the branch, they may be involved. Move your savings to a safe account I’ll give you." },
            ];
            renderOwn();
          }
        },
        target: () => $("o-run"), action: { label: "Run it", time: "20 s", run: () => $("o-run").click() } },
      { k: "setup", t: "Set up your family", d: "Who you protect, trusted contacts, a safe word.", icon: GI.users,
        tip: "Add who you’re protecting and who Kip should check with. It stays in this browser.",
        prep: () => show("calls"), target: () => $("kv-setup-card"), action: { label: "Open family setup", run: () => openSetup(1) } },
    ],
  });
  $("kv-side-guide").addEventListener("click", () => { closeMenu(); if (window.KinGuide) window.KinGuide.open(); });

  applySetup();
  renderVoiceBtn();
  renderOwn();
  renderFeed();
  if (PREVIEW) showPreview(); else loadScenarios();
})();
