"use strict";

// Shared "Get started" guide for the KinShield apps (KinVoice demo, KinBot chat).
// - A pill in the corner ("Get started | 33% complete") opens a checklist panel.
// - Each step's Start opens a dark coachmark pointing at the real control, with a picture,
//   a short description and one action button.
// - Pages tick steps with KinGuide.done(key). Progress is kept in this browser only.
// Usage: KinGuide.init({ id, title, help, steps: [{ k, t, d, icon, target, prep, action, locked }] })
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const I = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" /></svg>',
  };

  let cfg = null, state = null, root = null, coach = null, coachStep = null, coachTarget = null;

  function save() { store.set(cfg.key, state); }
  const isDone = (k) => state.done.includes(k);
  const pct = () => Math.round((100 * state.done.length) / cfg.steps.length);

  function init(c) {
    if (/[?&]preview=/.test(location.search)) return; // frozen embeds (kinbot.html) get no guide
    cfg = Object.assign({ key: `kinshield_guide_${c.id}`, title: "Get started", help: "", steps: [], blockers: [] }, c);
    state = Object.assign({ done: [], open: null, hidden: false }, store.get(cfg.key) || {});
    root = document.createElement("aside");
    root.className = "kg";
    root.setAttribute("aria-label", "Get started guide");
    if (cfg.mobileBottom) root.style.setProperty("--kg-mb", cfg.mobileBottom);
    document.body.appendChild(root);
    coach = document.createElement("div");
    coach.className = "kg-coach";
    coach.setAttribute("role", "dialog");
    coach.setAttribute("aria-modal", "false");
    coach.hidden = true;
    document.body.appendChild(coach);
    // First visit on a wide screen: open the checklist once nothing else (a welcome popup) is up.
    if (state.open === null) {
      state.open = false;
      if (!matchMedia("(max-width: 900px)").matches && !/[?&](id|run|example|preview)=/.test(location.search)) {
        const tryOpen = () => {
          const blocked = cfg.blockers.some((s) => { const b = document.querySelector(s); return b && !b.hidden; });
          if (blocked) return setTimeout(tryOpen, 600);
          setOpen(true);
        };
        setTimeout(tryOpen, 900);
      }
    }
    render();
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !coach.hidden) { closeCoach(); } });
    document.addEventListener("pointerdown", (e) => {
      if (coach.hidden || coach.contains(e.target) || root.contains(e.target)) return;
      // A click on the highlighted control is the user doing the step: let it through, then close.
      closeCoach();
    }, true);
  }

  function setOpen(v) { state.open = v; save(); render(); }

  function done(k) {
    if (!cfg || isDone(k) || !cfg.steps.some((s) => s.k === k)) return;
    state.done.push(k);
    save();
    if (coachStep && coachStep.k === k) closeCoach();
    render(true);
  }

  function ring(size) {
    const r = size / 2 - 4, c = 2 * Math.PI * r;
    return `<svg class="kg-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="bg" /><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="fg" style="stroke-dasharray:${(c * pct()) / 100} ${c}${pct() ? "" : ";opacity:0"}" /></svg>`;
  }

  function render(ticked) {
    if (!cfg) return;
    document.body.classList.toggle("kg-open", !!state.open && !state.hidden);
    if (state.hidden) { root.innerHTML = ""; root.hidden = true; return; }
    root.hidden = false;
    const n = state.done.length, N = cfg.steps.length, all = n >= N;
    const next = cfg.steps.find((s) => !isDone(s.k));
    const pill = `<button class="kg-pill${ticked ? " pop" : ""}" type="button" id="kg-pill" aria-expanded="${!!state.open}" aria-controls="kg-panel">` +
      `<img src="img/mascot-face.png?v=20261002-20" alt="" width="36" height="36" /><span class="kg-pill-t">${all ? "All set" : "Get started"}</span><span class="kg-pill-sep" aria-hidden="true"></span><span class="kg-pill-p">${pct()}% complete</span></button>`;
    const panel = !state.open ? "" :
      `<section class="kg-panel" id="kg-panel" aria-label="${esc(cfg.title)}">` +
      `<div class="kg-head"><div class="kg-head-bar"><span>Get started checklist</span><button class="kg-ib" type="button" id="kg-min" aria-label="Collapse checklist">${I.down}</button></div>` +
      `<div class="kg-head-main"><div><h2>${esc(all ? "You’re all set" : cfg.title)}</h2><p>${all ? "You’ve tried everything here. Thanks for taking the tour." : esc(cfg.help)}</p></div>` +
      `<div class="kg-dial">${ring(92)}<span class="kg-dial-c"><img src="img/kip-${all ? "excited" : "happy"}.png?v=20261002-20" alt="" width="320" height="320" /></span><span class="kg-dial-p">${pct()}% done</span></div></div></div>` +
      `<ol class="kg-list">${cfg.steps.map((s) => {
        const d = isDone(s.k), lk = !d && s.locked && s.locked();
        const isNext = next && next.k === s.k;
        return `<li class="${d ? "done" : ""}${isNext ? " next" : ""}">` +
          `<span class="kg-ic" aria-hidden="true">${s.icon || I.spark}</span>` +
          `<div class="kg-tx"><b>${esc(s.t)}</b><small>${esc(lk ? s.locked() : s.d)}</small></div>` +
          (d ? `<span class="kg-done"><i></i>Done</span>`
            : `<button class="kg-start${isNext ? " primary" : ""}" type="button" data-start="${s.k}"${lk ? " disabled" : ""}>Start</button>`) + `</li>`;
      }).join("")}</ol>` +
      `<div class="kg-foot"><button type="button" id="kg-reset">Start over</button><button type="button" id="kg-hide">Hide checklist</button></div></section>`;
    root.innerHTML = panel + pill;
    root.querySelector("#kg-pill").addEventListener("click", () => setOpen(!state.open));
    if (!state.open) return;
    root.querySelector("#kg-min").addEventListener("click", () => { setOpen(false); root.querySelector("#kg-pill").focus(); });
    root.querySelector("#kg-hide").addEventListener("click", () => { closeCoach(); state.hidden = true; save(); render(); });
    root.querySelector("#kg-reset").addEventListener("click", () => { state.done = []; save(); render(); });
    root.querySelectorAll("[data-start]").forEach((b) => b.addEventListener("click", () => start(b.dataset.start)));
  }

  // ---- coachmark ----------------------------------------------------------------
  function start(k) {
    const s = cfg.steps.find((x) => x.k === k);
    if (!s) return;
    if (s.prep) s.prep();
    setOpen(false); // fold to the pill so the coachmark and the page stay clear
    setTimeout(() => openCoach(s), s.prep ? 260 : 0);
  }

  function openCoach(s) {
    clearHi();
    coachStep = s;
    coachTarget = s.target ? s.target() : null;
    if (coachTarget) {
      coachTarget.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "center", inline: "nearest" });
      coachTarget.classList.add("kg-hi");
    }
    const a = s.action || {};
    coach.innerHTML =
      `<span class="kg-arrow" aria-hidden="true"></span>` +
      `<div class="kg-c-top"><b id="kg-c-title">${esc(s.t)}</b><button class="kg-ib" type="button" id="kg-c-x" aria-label="Close">${I.x}</button></div>` +
      `<div class="kg-art" aria-hidden="true"><i class="s1">${I.spark}</i><i class="s2">${I.spark}</i><i class="s3">${I.spark}</i><span class="kg-art-ic">${s.icon || I.spark}</span></div>` +
      `<p class="kg-c-d">${esc(s.tip || s.d)}</p>` +
      `<button class="kg-c-go" type="button" id="kg-c-go">${I.play}<span>${esc(a.label || "Got it")}</span>${a.time ? `<em>${esc(a.time)}</em>` : ""}</button>`;
    coach.setAttribute("aria-labelledby", "kg-c-title");
    coach.hidden = false;
    coach.classList.remove("kg-in"); void coach.offsetWidth; coach.classList.add("kg-in");
    place();
    setTimeout(place, 420); // after smooth scrolling settles
    coach.querySelector("#kg-c-x").addEventListener("click", closeCoach);
    coach.querySelector("#kg-c-go").addEventListener("click", () => { const run = a.run; closeCoach(); if (run) run(); });
    coach.querySelector("#kg-c-go").focus({ preventScroll: true });
  }

  function clearHi() { document.querySelectorAll(".kg-hi").forEach((e) => e.classList.remove("kg-hi")); }
  function closeCoach() { coach.hidden = true; coachStep = null; coachTarget = null; clearHi(); }

  // Place the card beside its target (right, left, below, above), arrow pointing at it.
  function place() {
    if (coach.hidden) return;
    const W = innerWidth, H = innerHeight, cw = coach.offsetWidth, ch = coach.offsetHeight, gap = 14;
    const t = coachTarget && document.contains(coachTarget) && coachTarget.offsetParent !== null ? coachTarget.getBoundingClientRect() : null;
    let x, y, side = "none";
    if (!t) { x = (W - cw) / 2; y = (H - ch) / 2; }
    else if (t.right + gap + cw < W - 8) { side = "left"; x = t.right + gap; y = t.top + t.height / 2 - ch / 2; }
    else if (t.left - gap - cw > 8) { side = "right"; x = t.left - gap - cw; y = t.top + t.height / 2 - ch / 2; }
    else if (t.bottom + gap + ch < H - 8) { side = "top"; y = t.bottom + gap; x = t.left + t.width / 2 - cw / 2; }
    else { side = "bottom"; y = Math.max(8, t.top - gap - ch); x = t.left + t.width / 2 - cw / 2; }
    x = Math.max(8, Math.min(W - cw - 8, x));
    y = Math.max(8, Math.min(H - ch - 8, y));
    coach.style.left = x + "px";
    coach.style.top = y + "px";
    coach.dataset.side = side;
    const arrow = coach.querySelector(".kg-arrow");
    if (t && arrow) {
      if (side === "left" || side === "right") arrow.style.cssText = `top:${Math.max(18, Math.min(ch - 18, t.top + t.height / 2 - y))}px`;
      else arrow.style.cssText = `left:${Math.max(18, Math.min(cw - 18, t.left + t.width / 2 - x))}px`;
    }
  }

  function open() { if (!cfg) return; state.hidden = false; setOpen(true); }
  function collapse() { if (cfg && state.open) setOpen(false); }
  window.KinGuide = { init, done, open, collapse, refresh: () => render() };
})();
