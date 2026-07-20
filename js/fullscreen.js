/**
 * Immersive / fullscreen for desktop + mobile.
 *
 * Desktop: native Fullscreen API on click.
 * Mobile: CSS immersive on touch (iOS blocks Fullscreen API); also try native on Android.
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

  const h = Math.max(
    window.innerHeight || 0,
    window.visualViewport?.height || 0,
    root.clientHeight || 0,
    1
  );
  root.style.setProperty("--app-h", `${h}px`);

  try {
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      const h2 = Math.max(
        window.innerHeight || 0,
        window.visualViewport?.height || 0,
        1
      );
      root.style.setProperty("--app-h", `${h2}px`);
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
        .then(() => true)
        .catch(() => el.requestFullscreen().then(() => true).catch(() => false));
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
 * Desktop prefers native FS; mobile applies CSS immersive first.
 */
export function enterFullscreen(el) {
  const target = el || document.getElementById("app") || document.documentElement;
  const mobile = isMobileDevice() || isIOS();

  if (mobile) {
    enterImmersiveFallback();
  }

  if (isFullscreen()) return Promise.resolve(true);

  return tryNativeFullscreen(target)
    .then((ok) => {
      if (!ok || !isFullscreen()) {
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
 * Start gate: desktop uses click → native fullscreen;
 * mobile uses touchstart → CSS immersive (+ native if available).
 */
export function mountStartGate(root, { onStart } = {}) {
  const mobile = isMobileDevice();
  const gate = document.createElement("button");
  gate.id = "start-gate";
  gate.type = "button";
  gate.setAttribute("aria-label", mobile ? "轻触全屏" : "点击全屏");
  gate.innerHTML = mobile
    ? '<span class="gate-title">花语</span><span class="gate-line">轻触全屏</span>'
    : '<span class="gate-title">花语</span><span class="gate-line">点击全屏</span>';

  let started = false;
  const finish = (e) => {
    if (started) return;
    started = true;
    e.preventDefault();
    e.stopPropagation();

    const target = document.getElementById("app") || document.documentElement;

    // Must run fullscreen / immersive in the same user gesture, before any await
    if (mobile) {
      enterImmersiveFallback();
      void tryNativeFullscreen(target).catch(() => {});
    } else {
      void enterFullscreen(target);
    }

    gate.classList.add("hide");
    setTimeout(() => {
      try {
        gate.remove();
      } catch {
        /* ignore */
      }
    }, 700);

    onStart?.();
  };

  if (mobile) {
    // touchstart keeps the gesture token on iOS/Android; click as fallback
    gate.addEventListener("touchstart", finish, { once: true, passive: false });
    gate.addEventListener("click", finish, { once: true });
  } else {
    gate.addEventListener("click", finish, { once: true });
  }

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
