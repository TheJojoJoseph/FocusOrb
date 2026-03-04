(() => {
  "use strict";

  const TOTAL_SECONDS = 25 * 60;

  /* ── Elements ────────────────────────────────────── */
  const app = document.getElementById("orb-app");
  const clock = document.getElementById("flip-clock");
  const colon = document.getElementById("flip-colon");
  const btnStart = document.getElementById("btn-start");
  const btnReset = document.getElementById("btn-reset");
  const btnClose = document.getElementById("btn-close");

  /* Digit units: [m0, m1, s0, s1] */
  const units = ["unit-m0", "unit-m1", "unit-s0", "unit-s1"].map((id) => {
    const el = document.getElementById(id);
    return {
      el,
      top: el.querySelector(".flip-card__top span"),
      bottom: el.querySelector(".flip-card__bottom span"),
      backTop: el.querySelector(".flip-card__back-top span"),
      backBottom: el.querySelector(".flip-card__back-bottom span"),
      current: null,
    };
  });

  /* ── State ───────────────────────────────────────── */
  let secondsLeft = TOTAL_SECONDS;
  let isRunning = false;
  let intervalId = null;
  let colonVisible = true;

  /* ── Flip engine ─────────────────────────────────── */

  function setDigit(unit, digit) {
    const d = String(digit);
    if (unit.current === d) return; // no change, no flip

    const prev = unit.current ?? d;
    unit.current = d;

    /* Pre-load back panels with: top=prev (folding away), bottom=next (revealing) */
    unit.backTop.textContent = prev;
    unit.backBottom.textContent = d;

    /* Update the static halves to the new digit immediately */
    unit.top.textContent = d;
    unit.bottom.textContent = d;

    /* Trigger flip by toggling class (force reflow first) */
    unit.el.classList.remove("flip-active");
    void unit.el.offsetWidth; // reflow
    unit.el.classList.add("flip-active");

    /* Clean up after animation */
    setTimeout(() => unit.el.classList.remove("flip-active"), 500);
  }

  function renderTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const digits = [Math.floor(m / 10), m % 10, Math.floor(sec / 10), sec % 10];
    digits.forEach((d, i) => setDigit(units[i], d));
  }

  /* ── Colon blink ─────────────────────────────────── */

  function blinkColon() {
    colonVisible = !colonVisible;
    colon.classList.toggle("blink", !colonVisible);
  }

  /* ── Button state ────────────────────────────────── */

  function updateButtons() {
    if (isRunning) {
      btnStart.innerHTML = "&#x23F8;";
      btnStart.classList.add("is-pause");
      btnStart.classList.remove("is-play");
    } else {
      btnStart.innerHTML = "&#x25B6;";
      btnStart.classList.add("is-play");
      btnStart.classList.remove("is-pause");
    }
    if (secondsLeft === 0) {
      app.classList.add("is-done");
    } else {
      app.classList.remove("is-done");
    }
  }

  /* ── Timer ───────────────────────────────────────── */

  function startTimer() {
    if (isRunning || secondsLeft === 0) return;
    isRunning = true;
    intervalId = setInterval(() => {
      blinkColon();
      if (secondsLeft <= 0) {
        clearInterval(intervalId);
        intervalId = null;
        isRunning = false;
        onTimerEnd();
        updateButtons();
        saveState();
        return;
      }
      secondsLeft--;
      renderTime(secondsLeft);
      updateButtons();
      saveState();
    }, 1000);
    updateButtons();
    saveState();
  }

  function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(intervalId);
    intervalId = null;
    colon.classList.remove("blink");
    colonVisible = true;
    updateButtons();
    saveState();
  }

  function resetTimer() {
    pauseTimer();
    secondsLeft = TOTAL_SECONDS;
    clock.classList.remove("finished");
    app.classList.remove("is-done");
    /* Reset all digit current values so next render re-flips */
    units.forEach((u) => {
      u.current = null;
    });
    renderTime(secondsLeft);
    updateButtons();
    saveState();
  }

  function onTimerEnd() {
    clock.classList.add("finished");
    setTimeout(() => clock.classList.remove("finished"), 2000);
    playChime();
    chrome.runtime.sendMessage({ type: "NOTIFY_DONE" }).catch(() => {});
  }

  /* ── Chime ───────────────────────────────────────── */

  function playChime() {
    try {
      const ctx = new AudioContext();
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
        gain.gain.linearRampToValueAtTime(
          0.2,
          ctx.currentTime + i * 0.18 + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + i * 0.18 + 0.6,
        );
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.65);
      });
      setTimeout(() => ctx.close(), 2500);
    } catch (_) {}
  }

  /* ── Persist state ───────────────────────────────── */

  function saveState() {
    chrome.storage.local
      .set({
        focusOrb_state: { secondsLeft, isRunning: false },
      })
      .catch(() => {});
  }

  function loadState() {
    chrome.storage.local.get("focusOrb_state", (result) => {
      if (result.focusOrb_state) {
        secondsLeft = result.focusOrb_state.secondsLeft ?? TOTAL_SECONDS;
      }
      renderTime(secondsLeft);
      updateButtons();
    });
  }

  /* ── Storage change listener (sync with bubble) ──── */

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.focusOrb_state && !isRunning) {
      const s = changes.focusOrb_state.newValue;
      if (s && !s.isRunning) {
        secondsLeft = s.secondsLeft ?? TOTAL_SECONDS;
        renderTime(secondsLeft);
        updateButtons();
      }
    }
  });

  /* ── Button events ───────────────────────────────── */

  btnStart.addEventListener("click", () =>
    isRunning ? pauseTimer() : startTimer(),
  );
  btnReset.addEventListener("click", resetTimer);
  btnClose.addEventListener("click", () => window.close());

  /* ── Init ────────────────────────────────────────── */

  loadState();
})();
