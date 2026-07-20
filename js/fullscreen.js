/**
 * Immersive / fullscreen for desktop + mobile.
 *
 * Mobile browsers (esp. iOS / WeChat) often block Fullscreen API.
 * Strategy: always apply CSS immersive mode synchronously on gesture,
 * then also try native fullscreen where available.
 */

export function isFullscreen() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  );
}

export function isImmersive() {
  return isFullscreen() || document.documentElement.classList.contains("immersive");
}

export function isMobileDevice() {
  return (
    /Mobi|Android|iPhone|iPad|iPod|WebView|MicroMessenger|MQQBrowser/i.test(
      navigator.userAgent
    ) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Sync CSS immersive — works even when Fullscreen API is blocked */
export function enterImmersiveFallback() {
  const root = document.documentElement;
  const body = document.body;
  root.classList.add("immersive");
  body.classList.add("immersive");

  // Stretch to largest available viewport units
  const h = Math.max(
    window.innerHeight,
    window.visualViewport?.height || 0,
    document.documentElement.clientHeight
  );
  root.style.setProperty("--app-h", `${h}px`);
  body.style.height = `${h}px`;

  // Try to collapse mobile browser chrome
  try {
    window.scrollTo(0, 1);
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      const h2 = Math.max(window.innerHeight, window.visualViewport?.height || 0);
      root.style.setProperty("--app-h", `${h2}px`);
    });
  } catch {
    /* ignore */
  }

  // Android: lock landscape/portrait to current if allowed
  try {
    const o = screen.orientation;
    if (o?.lock) {
      const type = o.type?.startsWith("landscape") ? "landscape" : "portrait";
      o.lock(type).catch(() => {});
    }
  } catch {
    /* ignore */
  }

  return true;
}

export function exitImmersiveFallback() {
  document.documentElement.classList.remove("immersive");
  document.body.classList.remove("immersive");
  document.documentElement.style.removeProperty("--app-h");
  document.body.style.height = "";
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
}

function tryNativeFullscreen(el) {
  try {
    if (el.requestFullscreen) {
      return el
        .requestFullscreen({ navigationUI: "hide" })
        .catch(() => el.requestFullscreen())
        .catch(() => false);
    }
    if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      return Promise.resolve(true);
    }
    if (el.webkitRequestFullScreen) {
      el.webkitRequestFullScreen();
      return Promise.resolve(true);
    }
    if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
      return Promise.resolve(true);
    }
  } catch {
    /* ignore */
  }
  return Promise.resolve(false);
}

/**
 * Enter immersive experience. Safe to call from a click/touch handler.
 * Applies CSS immersive immediately (sync), then attempts native FS.
 */
export function enterFullscreen(el) {
  const target = el || document.getElementById("app") || document.documentElement;

  // 1) Always sync immersive on mobile — this is what actually "works"
  if (isMobileDevice() || isIOS()) {
    enterImmersiveFallback();
  }

  if (isFullscreen()) return Promise.resolve(true);

  // 2) Also try native FS (desktop / Android Chrome)
  return tryNativeFullscreen(target)
    .then((ok) => {
      if (!ok || !isFullscreen()) {
        // Ensure fallback even on desktop if FS denied
        enterImmersiveFallback();
      }
      return true;
    })
    .catch(() => {
      enterImmersiveFallback();
      return true;
    });
}

export function exitFullscreen() {
  exitImmersiveFallback();
  if (!isFullscreen()) return Promise.resolve();
  try {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
      return Promise.resolve();
    }
    if (document.msExitFullscreen) {
      document.msExitFullscreen();
      return Promise.resolve();
    }
  } catch {
    /* ignore */
  }
  return Promise.resolve();
}

export function toggleFullscreen(el) {
  if (isImmersive()) {
    return exitFullscreen().then(() => false);
  }
  return enterFullscreen(el).then(() => true);
}

/**
 * Full-screen start gate — most reliable mobile entry.
 * User must tap the big button; we enter immersive in that same click.
 */
export function mountStartGate(root, { onStart } = {}) {
  const gate = document.createElement("button");
  gate.id = "start-gate";
  gate.type = "button";
  gate.setAttribute("aria-label", "轻触开始");
  gate.innerHTML =
    '<span class="gate-title">花语</span><span class="gate-line">轻触开始</span>';

  const finish = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Sync immersive + native FS in the same user gesture
    enterImmersiveFallback();
    void enterFullscreen(document.getElementById("app") || document.documentElement);
    gate.classList.add("hide");
    setTimeout(() => gate.remove(), 700);
    onStart?.();
  };

  // click is the most trusted gesture across mobile browsers
  gate.addEventListener("click", finish, { once: true });
  gate.addEventListener(
    "touchend",
    (e) => {
      // Prevent ghost click issues; still run finish once
      if (gate.classList.contains("hide")) return;
      finish(e);
    },
    { once: true, passive: false }
  );

  root.appendChild(gate);
  return gate;
}

export function mountFullscreenButton(root, { target, onChange } = {}) {
  const el = target || document.getElementById("app") || document.documentElement;
  const btn = document.createElement("button");
  btn.id = "fs-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "全屏");
  btn.title = "全屏";
  btn.textContent = "全";

  const sync = () => {
    const on = isImmersive();
    btn.classList.toggle("on", on);
    btn.textContent = on ? "窗" : "全";
    btn.title = on ? "退出全屏" : "全屏";
    btn.setAttribute("aria-label", on ? "退出全屏" : "全屏");
    onChange?.(on);
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    void toggleFullscreen(el).then(sync);
  });

  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
  // Do NOT call onChange during initial sync — callers may not be ready yet
  const on = isImmersive();
  btn.classList.toggle("on", on);
  btn.textContent = on ? "窗" : "全";
  btn.title = on ? "退出全屏" : "全屏";
  btn.setAttribute("aria-label", on ? "退出全屏" : "全屏");

  root.appendChild(btn);
  return btn;
}
