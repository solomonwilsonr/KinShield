"use strict";

// Page chrome for the redesigned homepage: run shortcuts, the demo view strip,
// and the sticky-nav divider. Demo logic itself lives in app.js.
(function () {
  const demo = document.getElementById("demo");

  function toDemo() {
    if (!demo) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    demo.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  // The hero buttons and intro CTA run in place; bring the dashboard into view.
  ["btn-scam", "btn-safe", "intro-scam"].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", toDemo);
  });

  // Nav / CTA links carry data-run="scam|safe": start that call, then scroll.
  document.querySelectorAll("[data-run]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const btn = document.getElementById(a.dataset.run === "safe" ? "btn-safe" : "btn-scam");
      if (!btn || btn.disabled) return; // a run is in progress: just follow the link
      e.preventDefault();
      btn.click();
    });
  });

  // Demo view strip: anchors into the dashboard. Mark the active one and flash its card.
  const tabs = Array.from(document.querySelectorAll(".demo-tab"));
  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const target = document.querySelector(tab.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle("is-active", on);
        if (on) t.setAttribute("aria-current", "true"); else t.removeAttribute("aria-current");
      });
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      target.classList.remove("flash");
      void target.offsetWidth; // restart the highlight
      target.classList.add("flash");
      setTimeout(() => target.classList.remove("flash"), 1400);
    });
  });

  // Hairline under the sticky nav once the page scrolls.
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => { nav.style.borderBottomColor = window.scrollY > 8 ? "var(--line)" : "transparent"; };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
