// KinModel page: score one message with KinShield-Lite and the Bedrock evidence detector, side by side.
// Uses the existing POST /kinbot {mode:"check"}; its response carries both the verdict and `lite`.
(() => {
  const API = (window.KINSHIELD_API || "").replace(/\/$/, "");
  const MAX = 2000;
  const EXAMPLES = [
    "Grandma it's me, I got in a car accident and I'm at the police station. Please don't tell Mom. I need $2,000 for bail today. Can you get Target gift cards and read me the numbers?",
    "USPS: Your package is on hold because of an unpaid $1.99 delivery fee. Pay within 12 hours at usps-redelivery-fee.top or it will be returned to sender.",
    "This is Officer Daniels with the Social Security Administration. Your number has been suspended for suspicious activity. Do not hang up and do not tell anyone. Pay the $900 fine today in Bitcoin to avoid arrest.",
    "Walgreens: Your prescription is ready for pickup at the Main St store. Pickup hours are 9am-9pm. Reply STOP to opt out of texts.",
  ];

  const $ = (id) => document.getElementById(id);
  const form = $("km-form"), input = $("km-text"), go = $("km-go"), count = $("km-count"), status = $("km-status");
  const results = $("km-results"), prob = $("km-prob"), meter = $("km-meter"), level = $("km-level");
  const score = $("km-score"), quotes = $("km-quotes"), agree = $("km-agree");
  let busy = false;

  const setCount = () => { count.textContent = `${input.value.length.toLocaleString()} / 2,000`; };
  input.addEventListener("input", setCount);

  document.querySelectorAll(".km-ex").forEach((b) => b.addEventListener("click", () => {
    input.value = EXAMPLES[+b.dataset.ex];
    setCount();
    run();
  }));

  form.addEventListener("submit", (e) => { e.preventDefault(); run(); });

  function render(r) {
    const lite = r.lite;
    if (lite && typeof lite.score === "number") {
      const scam = lite.score >= 0.5;
      prob.innerHTML = `${lite.score.toFixed(2)}<small>${scam ? "scam-like" : "not scam-like"}</small>`;
      meter.classList.toggle("scam", scam);
      meter.firstElementChild.style.width = `${Math.round(lite.score * 100)}%`;
    } else {
      prob.innerHTML = `–<small>unavailable</small>`;
      meter.firstElementChild.style.width = "0";
    }

    const lvl = r.risk_level || "LOW";
    level.textContent = lvl;
    level.className = `risk-pill risk-${lvl.toLowerCase()}`;
    score.innerHTML = `${r.risk_score ?? 0}<small>risk score · ${(r.signs || []).length} cited sign${(r.signs || []).length === 1 ? "" : "s"}</small>`;
    quotes.replaceChildren();
    (r.signs || []).slice(0, 3).forEach((s) => {
      const item = document.createElement("div");
      item.className = `ev-item${s.weight >= 30 ? " w-high" : ""}`;
      const top = document.createElement("div");
      top.className = "ev-top";
      const sig = document.createElement("span");
      sig.className = "ev-signal";
      sig.textContent = s.label;
      const w = document.createElement("span");
      w.className = "ev-weight";
      w.textContent = `weight ${s.weight}`;
      top.append(sig, w);
      const q = document.createElement("div");
      q.className = "ev-quote";
      q.textContent = s.quote;
      item.append(top, q);
      quotes.appendChild(item);
    });
    if (!(r.signs || []).length) {
      const p = document.createElement("p");
      p.className = "km-note";
      p.textContent = "No warning signs quoted. That doesn't prove the message is safe.";
      quotes.appendChild(p);
    }

    results.hidden = false;
    if (lite && typeof lite.score === "number") {
      const liteScam = lite.score >= 0.5, llmScam = lvl !== "LOW";
      agree.textContent = liteScam === llmScam
        ? `They agree: both read this as ${llmScam ? "risky" : "low risk"}. Only the detector can show you why.`
        : `They disagree. Trust the detector's quoted evidence over KinModel's number, and check before you act.`;
      agree.hidden = false;
    } else {
      agree.hidden = true;
    }
  }

  async function run() {
    const message = input.value.trim();
    if (busy) return;
    if (!message) { status.className = "km-status err"; status.textContent = "Paste a message first, or pick an example."; input.focus(); return; }
    if (message.length > MAX) { status.className = "km-status err"; status.textContent = "That's longer than 2,000 characters."; return; }
    busy = true; go.disabled = true;
    status.className = "km-status";
    status.textContent = "Scoring on AWS… KinModel takes milliseconds; the Bedrock detector takes a second or two.";
    try {
      const res = await fetch(`${API}/kinbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "check", message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      render(data);
      status.textContent = data.latency_ms ? `Done in ${(data.latency_ms / 1000).toFixed(1)} s (both models).` : "Done.";
    } catch (err) {
      status.className = "km-status err";
      status.textContent = "Couldn't reach the model just now. Please try again in a moment.";
    } finally {
      busy = false; go.disabled = false;
    }
  }

  setCount();
})();
