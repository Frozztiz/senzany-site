
(() => {
  "use strict";

  const OPENING_DATE = new Date("2026-08-21T18:00:00+02:00");
  const PREP_START = new Date("2026-08-20T00:00:00+02:00");
  const INTRO_DURATION = 18000;

  const cinematic = document.getElementById("cinematic");
  const countdownScreen = document.getElementById("countdownScreen");
  const skipIntro = document.getElementById("skipIntro");
  const introFlash = document.getElementById("introFlash");
  const opened = document.getElementById("opened");

  const els = {
    days: document.getElementById("days"),
    hours: document.getElementById("hours"),
    minutes: document.getElementById("minutes"),
    seconds: document.getElementById("seconds"),
    progressBar: document.getElementById("progressBar"),
    progressText: document.getElementById("progressText"),
    parisClock: document.getElementById("parisClock")
  };

  let introFinished = false;

  function finishIntro() {
    if (introFinished) return;
    introFinished = true;

    introFlash?.classList.add("flash");

    window.setTimeout(() => {
      cinematic?.classList.add("is-finished");
      countdownScreen?.classList.add("is-visible");
      if (skipIntro) skipIntro.hidden = true;
    }, 210);
  }

  skipIntro?.addEventListener("click", finishIntro);
  window.setTimeout(finishIntro, INTRO_DURATION);

  const embers = document.getElementById("embers");
  if (embers && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (let i = 0; i < 40; i += 1) {
      const ember = document.createElement("span");
      ember.className = "ember";
      ember.style.left = `${Math.random() * 100}%`;
      ember.style.animationDuration = `${9 + Math.random() * 14}s`;
      ember.style.animationDelay = `${Math.random() * 14}s`;
      ember.style.opacity = `${0.2 + Math.random() * 0.65}`;
      embers.appendChild(ember);
    }
  }

  const pad = (n) => String(Math.max(0, n)).padStart(2, "0");

  function setValue(el, value) {
    if (!el || el.textContent === value) return;
    el.textContent = value;
    const unit = el.closest(".unit");
    unit?.classList.remove("tick");
    void unit?.offsetWidth;
    unit?.classList.add("tick");
  }

  function updateParisClock() {
    if (!els.parisClock) return;

    const time = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date());

    els.parisClock.textContent = `PARIS // ${time}`;
  }

  function updateCountdown() {
    const now = Date.now();
    const diff = OPENING_DATE.getTime() - now;

    if (diff <= 0) {
      setValue(els.days, "00");
      setValue(els.hours, "00");
      setValue(els.minutes, "00");
      setValue(els.seconds, "00");
      els.progressBar.style.width = "100%";
      els.progressText.textContent = "100%";
      opened.hidden = false;
      document.title = "SENZANY — Portail ouvert";
      return;
    }

    setValue(els.days, pad(Math.floor(diff / 86400000)));
    setValue(els.hours, pad(Math.floor((diff % 86400000) / 3600000)));
    setValue(els.minutes, pad(Math.floor((diff % 3600000) / 60000)));
    setValue(els.seconds, pad(Math.floor((diff % 60000) / 1000)));

    const total = OPENING_DATE.getTime() - PREP_START.getTime();
    const elapsed = Math.max(0, Math.min(total, now - PREP_START.getTime()));
    const progress = total > 0 ? (elapsed / total) * 100 : 0;

    els.progressBar.style.width = `${progress.toFixed(2)}%`;
    els.progressText.textContent = `${Math.round(progress)}%`;
  }

  updateCountdown();
  updateParisClock();

  window.setInterval(updateCountdown, 1000);
  window.setInterval(updateParisClock, 1000);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finishIntro();
  }
})();
