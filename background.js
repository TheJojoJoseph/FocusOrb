const WIN_W = 400;
const WIN_H = 280;
const MARGIN = 16;

let orbWindowId = null;

/* ── Get top-right position on primary display ───── */
async function getTopRightPos() {
  return new Promise((resolve) => {
    chrome.system.display.getInfo((displays) => {
      const primary = displays.find((d) => d.isPrimary) || displays[0];
      const bounds = primary
        ? primary.workArea
        : { left: 0, top: 0, width: 1280, height: 800 };
      resolve({
        left: bounds.left + bounds.width - WIN_W - MARGIN,
        top: bounds.top + MARGIN,
      });
    });
  });
}

/* ── Open or focus the always-on-top timer window ─── */
async function openOrbWindow() {
  const { left, top } = await getTopRightPos();

  // If window still exists, snap it back to top-right and focus it
  if (orbWindowId !== null) {
    try {
      const win = await chrome.windows.get(orbWindowId);
      if (win) {
        await chrome.windows.update(orbWindowId, {
          focused: true,
          left,
          top,
          alwaysOnTop: true,
        });
        return;
      }
    } catch (_) {
      orbWindowId = null;
    }
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: WIN_W,
    height: WIN_H,
    left,
    top,
    focused: true,
  });

  orbWindowId = win.id;
  await chrome.windows.update(orbWindowId, { alwaysOnTop: true });
  startKeepAlive();
}

/* Clear stored window ID when user closes it ──────── */
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === orbWindowId) {
    orbWindowId = null;
    stopKeepAlive();
  }
});

/* ── Continuously re-assert alwaysOnTop ──────────── */
// macOS overrides the flag when a native app takes focus.
// Re-applying it every 500ms keeps the orb window floating above all apps.
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(async () => {
    if (orbWindowId === null) {
      stopKeepAlive();
      return;
    }
    try {
      await chrome.windows.update(orbWindowId, { alwaysOnTop: true });
    } catch (_) {
      orbWindowId = null;
      stopKeepAlive();
    }
  }, 500);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

/* ── Message router ──────────────────────────────── */
/* ── Toolbar icon click opens the window ────────── */
chrome.action.onClicked.addListener(() => openOrbWindow());

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "OPEN_ORB_WINDOW") {
    openOrbWindow();
  }

  if (msg.type === "NOTIFY_DONE") {
    chrome.notifications.create("focusOrb_done", {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "FocusOrb — Session Complete",
      message: "Great work! Take a short break.",
      silent: false,
    });
  }
});
