(() => {
  "use strict";

  /* ── Guard: only inject once ─────────────────────── */
  if (document.getElementById("focus-orb-root")) return;

  /* ── Constants ───────────────────────────────────── */
  const TOTAL_SECONDS = 25 * 60;
  const RADIUS = 28;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  /* ── State ───────────────────────────────────────── */
  let secondsLeft = TOTAL_SECONDS;
  let isRunning = false;
  let isExpanded = false;
  let intervalId = null;

  /* ── Build DOM ───────────────────────────────────── */
  const root = document.createElement("div");
  root.id = "focus-orb-root";

  /* Bubble */
  const bubble = document.createElement("div");
  bubble.id = "focus-orb-bubble";

  const timeLabel = document.createElement("span");
  timeLabel.id = "focus-orb-time";

  bubble.appendChild(timeLabel);

  /* Panel */
  const panel = document.createElement("div");
  panel.id = "focus-orb-panel";

  /* Panel: large time */
  const panelTime = document.createElement("div");
  panelTime.id = "focus-orb-panel-time";

  const panelLabel = document.createElement("div");
  panelLabel.id = "focus-orb-panel-label";
  panelLabel.textContent = "Focus Session";

  /* Progress ring */
  const svgWrap = document.createElement("div");
  svgWrap.id = "focus-orb-progress-wrap";

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.id = "focus-orb-progress-svg";
  svg.setAttribute("width", "72");
  svg.setAttribute("height", "72");
  svg.setAttribute("viewBox", "0 0 72 72");

  const track = document.createElementNS(svgNS, "circle");
  track.id = "focus-orb-progress-track";
  track.setAttribute("cx", "36");
  track.setAttribute("cy", "36");
  track.setAttribute("r", String(RADIUS));

  const fill = document.createElementNS(svgNS, "circle");
  fill.id = "focus-orb-progress-fill";
  fill.setAttribute("cx", "36");
  fill.setAttribute("cy", "36");
  fill.setAttribute("r", String(RADIUS));
  fill.setAttribute("stroke-dasharray", String(CIRCUMFERENCE));
  fill.setAttribute("stroke-dashoffset", "0");

  svg.appendChild(track);
  svg.appendChild(fill);
  svgWrap.appendChild(svg);

  /* Controls */
  const controls = document.createElement("div");
  controls.id = "focus-orb-controls";

  const btnStartPause = document.createElement("button");
  btnStartPause.className = "orb-btn orb-btn--primary";

  const btnReset = document.createElement("button");
  btnReset.className = "orb-btn orb-btn--secondary";
  btnReset.textContent = "Reset";

  controls.appendChild(btnStartPause);
  controls.appendChild(btnReset);

  /* Pop-out button */
  const btnPopOut = document.createElement("button");
  btnPopOut.className = "orb-btn orb-btn--popout";
  btnPopOut.title = "Open always-on-top window";
  btnPopOut.textContent = "⤢ Pop out";

  /* Drag hint */
  const dragHint = document.createElement("div");
  dragHint.id = "focus-orb-drag-hint";
  const dragBar = document.createElement("span");
  dragHint.appendChild(dragBar);

  panel.appendChild(panelTime);
  panel.appendChild(panelLabel);
  panel.appendChild(svgWrap);
  panel.appendChild(controls);
  panel.appendChild(btnPopOut);
  panel.appendChild(dragHint);

  root.appendChild(panel);
  root.appendChild(bubble);
  document.documentElement.appendChild(root);

  /* ── Helpers ─────────────────────────────────────── */

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function updateUI() {
    const label = formatTime(secondsLeft);
    timeLabel.textContent = label;
    panelTime.textContent = label;

    /* running tint */
    if (isRunning) {
      timeLabel.classList.add("time--running");
      panelTime.classList.add("time--running");
      bubble.classList.add("orb--running");
    } else {
      timeLabel.classList.remove("time--running");
      panelTime.classList.remove("time--running");
      bubble.classList.remove("orb--running");
    }

    /* progress ring */
    const progress = 1 - secondsLeft / TOTAL_SECONDS;
    const offset = CIRCUMFERENCE * (1 - progress);
    fill.setAttribute("stroke-dashoffset", String(offset));

    /* button label */
    btnStartPause.textContent = isRunning ? "Pause" : "Start";
  }

  /* ── Timer logic ─────────────────────────────────── */

  function startTimer() {
    if (isRunning) return;
    isRunning = true;
    intervalId = setInterval(() => {
      if (secondsLeft <= 0) {
        clearInterval(intervalId);
        intervalId = null;
        isRunning = false;
        onTimerEnd();
        updateUI();
        return;
      }
      secondsLeft--;
      updateUI();
      saveState();
    }, 1000);
    updateUI();
    saveState();
  }

  function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(intervalId);
    intervalId = null;
    updateUI();
    saveState();
  }

  function resetTimer() {
    pauseTimer();
    secondsLeft = TOTAL_SECONDS;
    bubble.classList.remove("orb--finished");
    updateUI();
    saveState();
  }

  function onTimerEnd() {
    bubble.classList.add("orb--finished");
    setTimeout(() => bubble.classList.remove("orb--finished"), 2000);
    playChime();
    sendNotification();
  }

  /* ── Chime (Web Audio API) ───────────────────────── */

  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);

        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
        gain.gain.linearRampToValueAtTime(
          0.18,
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
    } catch (_) {
      /* audio not available */
    }
  }

  /* ── Chrome notification ─────────────────────────── */

  function sendNotification() {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "NOTIFY_DONE" }).catch(() => {});
    }
  }

  /* ── Expand / Collapse ───────────────────────────── */

  function toggleExpand() {
    isExpanded = !isExpanded;
    if (isExpanded) {
      panel.classList.add("panel--open");
    } else {
      panel.classList.remove("panel--open");
    }
  }

  /* ── Drag logic ──────────────────────────────────── */

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragMoved = false;
  const DRAG_THRESHOLD = 5; // px

  bubble.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    dragMoved = false;
    dragOffsetX = e.clientX - root.getBoundingClientRect().left;
    dragOffsetY = e.clientY - root.getBoundingClientRect().top;
    bubble.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  bubble.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const dx = Math.abs(
      e.clientX - (root.getBoundingClientRect().left + dragOffsetX),
    );
    const dy = Math.abs(
      e.clientY - (root.getBoundingClientRect().top + dragOffsetY),
    );
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) dragMoved = true;

    if (dragMoved) {
      let newLeft = e.clientX - dragOffsetX;
      let newTop = e.clientY - dragOffsetY;

      /* Clamp within viewport */
      newLeft = Math.max(0, Math.min(window.innerWidth - 64, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - 64, newTop));

      root.style.left = `${newLeft}px`;
      root.style.top = `${newTop}px`;
      root.style.right = "auto";
      root.style.bottom = "auto";
    }
  });

  bubble.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    if (!dragMoved) toggleExpand();
    savePosition();
  });

  /* ── Button events ───────────────────────────────── */

  btnStartPause.addEventListener("click", (e) => {
    e.stopPropagation();
    isRunning ? pauseTimer() : startTimer();
  });

  btnReset.addEventListener("click", (e) => {
    e.stopPropagation();
    resetTimer();
  });

  btnPopOut.addEventListener("click", (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: "OPEN_ORB_WINDOW" }).catch(() => {});
  });

  /* Prevent panel clicks from propagating to bubble */
  panel.addEventListener("pointerdown", (e) => e.stopPropagation());

  /* ── Persist position ────────────────────────────── */

  function savePosition() {
    const pos = { left: root.style.left, top: root.style.top };
    chrome.storage.local.set({ focusOrb_pos: pos }).catch(() => {});
  }

  function saveState() {
    chrome.storage.local
      .set({
        focusOrb_state: {
          secondsLeft,
          isRunning: false,
        } /* never persist running */,
      })
      .catch(() => {});
  }

  function loadSaved() {
    chrome.storage.local.get(["focusOrb_pos", "focusOrb_state"], (result) => {
      if (result.focusOrb_pos) {
        const { left, top } = result.focusOrb_pos;
        if (left) {
          root.style.left = left;
          root.style.right = "auto";
        }
        if (top) {
          root.style.top = top;
          root.style.bottom = "auto";
        }
      }
      if (result.focusOrb_state) {
        secondsLeft = result.focusOrb_state.secondsLeft ?? TOTAL_SECONDS;
      }
      updateUI();
    });
  }

  /* ── Default position ────────────────────────────── */
  root.style.right = "24px";
  root.style.bottom = "24px";

  /* ── Init ────────────────────────────────────────── */
  updateUI();

  if (typeof chrome !== "undefined" && chrome.storage) {
    loadSaved();
  }
})();
