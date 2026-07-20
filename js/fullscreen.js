/**
 * Immersive / fullscreen — desktop + mobile.
 *
 * Android: requestFullscreen() synchronously inside click (user activation).
 * iOS: no Fullscreen API — CSS fixed layout + viewport height sync hides chrome.
 */

const V = "20260720d";
let watcherBound = false;

function scheduleImmersiveResize(onResize) {
  const tick = () => {
    if (!isImmersive()) return;
    syncViewportHeight();
    onResize?.();
  };
  tick();
  for (const ms of [80, 200, 400, 800]) {
    setTimeout(tick, ms);
  }
}

function startImmersiveWatcher(onResize) {
  if (!watcherBound) {
    watcherBound = true;
    const tick = () => {
      if (!isImmersive()) return;
      syncViewportHeight();
      onResize?.();
    };
    window.addEventListener("resize", tick);
    window.addEventListener("orientationchange", tick);
    window.visualViewport?.addEventListener("resize", tick);
    window.visualViewport?.addEventListener("scroll", tick);
  }
  scheduleImmersiveResize(onResize);
}

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

export function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

/** Current layout size — stable on mobile during chrome show/hide */
export function getViewportSize() {
  const vv = window.visualViewport;
  const innerW = window.innerWidth || 0;
  const innerH = window.innerHeight || 0;
  const vvW = vv?.width || 0;
  const vvH = vv?.height || 0;

  if (isMobileDevice()) {
    return {
      w: Math.round(Math.max(vvW, innerW, 1)),
      h: Math.round(Math.max(vvH, innerH, 1)),
    };
  }

  return {
    w: Math.round(vvW > 0 ? vvW : innerW),
    h: Math.round(vvH > 0 ? vvH : innerH),
  };
}

export function syncViewportHeight() {
  const { w, h } = getViewportSize();
  const root = document.documentElement;
  root.style.setProperty("--app-h", `${h}px`);
  root.style.setProperty("--app-w", `${w}px`);
  return { w, h };
}

/** CSS immersive — must run synchronously inside user gesture */
export function enterImmersiveFallback() {
  const root = document.documentElement;
  const body = document.body;

  root.classList.add("immersive");
  body.classList.add("immersive");

  syncViewportHeight();

  // Collapse mobile browser chrome (Android + legacy iOS trick)
  try {
    window.scrollTo(0, 1);
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      syncViewportHeight();
    });
  } catch {
    /* ignore */
  }

  return true;
}

export function exitImmersiveFallback() {
  document.documentElement.classList.remove("immersive");
  document.body.classList.remove("immersive");
  document.documentElement.style.removeProperty("--app-h");
  document.documentElement.style.removeProperty("--app-w");
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
}

/**
 * Native fullscreen — MUST be invoked synchronously in click/tap handler.
 * Returns true if API call was made (not necessarily entered yet).
 */
export function tryNativeFullscreenSync(el) {
  const candidates = [
    el,
    document.documentElement,
    document.getElementById("app"),
    document.body,
  ].filter(Boolean);

  const seen = new Set();
  for (const target of candidates) {
    if (seen.has(target)) continue;
    seen.add(target);

    try {
      if (target.requestFullscreen) {
        const p = target.requestFullscreen({ navigationUI: "hide" });
        if (p?.catch) p.catch(() => {});
        return true;
      }
      if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
        return true;
      }
      if (target.webkitRequestFullScreen) {
        target.webkitRequestFullScreen();
        return true;
      }
      if (target.msRequestFullscreen) {
        target.msRequestFullscreen();
        return true;
      }
    } catch {
      /* try next candidate */
    }
  }
  return false;
}

/** Enter fullscreen / immersive from a user gesture handler */
export function enterFullscreen(el, { onResize } = {}) {
  const target = el || document.getElementById("app") || document.documentElement;
  const mobile = isMobileDevice();

  if (mobile || isIOS()) {
    enterImmersiveFallback();
    startImmersiveWatcher(onResize);
  }

  if (isFullscreen()) return Promise.resolve(true);

  tryNativeFullscreenSync(target);

  if (isFullscreen()) return Promise.resolve(true);

  if (!mobile) {
    enterImmersiveFallback();
    startImmersiveWatcher(onResize);
  }

  return Promise.resolve(true);
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

export function toggleFullscreen(el, opts) {
  if (isImmersive()) {
    return exitFullscreen().then(() => false);
  }
  return enterFullscreen(el, opts).then(() => true);
}

/**
 * Start gate — one `click` handler for all devices.
 * Mobile touch generates click; avoid touchstart+preventDefault (breaks FS on Android).
 */
export function mountStartGate(root, { onStart, onResize } = {}) {
  const mobile = isMobileDevice();
  const gate = document.createElement("button");
  gate.id = "start-gate";
  gate.type = "button";
  gate.setAttribute("aria-label", mobile ? "轻触进入全屏" : "点击进入全屏");
  gate.innerHTML = mobile
    ? '<span class="gate-title">花语</span><span class="gate-line">轻触进入全屏</span>'
    : '<span class="gate-title">花语</span><span class="gate-line">点击进入全屏</span>';

  if (isStandalone()) {
    gate.querySelector(".gate-line").textContent = mobile ? "轻触开始" : "点击开始";
  }

  let started = false;

  const finish = (e) => {
    if (started) return;
    started = true;

    e.stopPropagation();

    const target = document.getElementById("app") || document.documentElement;

    // All sync — before any await / timeout (preserves user activation on Android)
    enterImmersiveFallback();
    tryNativeFullscreenSync(target);
    startImmersiveWatcher(onResize);

    gate.classList.add("hide");
    setTimeout(() => {
      try {
        gate.remove();
      } catch {
        /* ignore */
      }
    }, 600);

    onStart?.();
  };

  // click only — reliable for requestFullscreen on mobile (touch → click)
  gate.addEventListener("click", finish, { once: true });

  // Mount on body so fixed overlay always covers viewport
  document.body.appendChild(gate);
  return gate;
}

export function mountFullscreenButton(root, { target, onChange, onResize } = {}) {
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
    if (isImmersive()) {
      void exitFullscreen().then(sync);
      return;
    }
    enterImmersiveFallback();
    tryNativeFullscreenSync(el);
    startImmersiveWatcher(onResize);
    sync();
  });

  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);

  const on = isImmersive();
  btn.classList.toggle("on", on);
  btn.textContent = on ? "窗" : "全";
  btn.title = on ? "退出全屏" : "全屏";
  btn.setAttribute("aria-label", on ? "退出全屏" : "全屏");

  root.appendChild(btn);
  return btn;
}

// cache-bust marker for imports
export const FULLSCREEN_VERSION = V;
