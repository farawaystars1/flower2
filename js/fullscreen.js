/**
 * Immersive fullscreen helpers for desktop + mobile.
 *
 * - Desktop / Android Chrome: Fullscreen API (must start inside a user gesture,
 *   before any await — otherwise the gesture token is lost).
 * - iOS Safari: native FS is unreliable; fall back to CSS immersive + hide chrome.
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

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** CSS / viewport immersive mode when native fullscreen is unavailable */
export function enterImmersiveFallback() {
  document.documentElement.classList.add("immersive");
  document.body.classList.add("immersive");
  // Nudge mobile browser chrome to collapse
  const y = Math.min(120, Math.max(1, window.scrollY || 1));
  window.scrollTo(0, y);
  requestAnimationFrame(() => {
    window.scrollTo(0, 1);
    setTimeout(() => window.scrollTo(0, 0), 50);
  });
  return true;
}

export function exitImmersiveFallback() {
  document.documentElement.classList.remove("immersive");
  document.body.classList.remove("immersive");
}

/**
 * Start fullscreen immediately (keep gesture alive).
 * Returns a Promise that settles after enter attempt.
 */
export function enterFullscreen(el = document.documentElement) {
  if (isFullscreen()) return Promise.resolve(true);

  // iOS: prefer immersive fallback — requestFullscreen is flaky / often missing
  if (isIOS() && !el.requestFullscreen && !el.webkitRequestFullscreen) {
    enterImmersiveFallback();
    return Promise.resolve(true);
  }

  let pending = null;
  try {
    if (el.requestFullscreen) {
      // Some mobile browsers reject navigationUI option — retry plain call
      pending = el.requestFullscreen({ navigationUI: "hide" }).catch(() =>
        el.requestFullscreen()
      );
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      pending = Promise.resolve();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
      pending = Promise.resolve();
    }
  } catch {
    pending = null;
  }

  if (!pending) {
    enterImmersiveFallback();
    return Promise.resolve(true);
  }

  return pending
    .then(() => {
      if (isFullscreen()) return true;
      // API resolved but not fullscreen (common on iOS) → fallback
      enterImmersiveFallback();
      return true;
    })
    .catch(() => {
      enterImmersiveFallback();
      return true;
    });
}

export function exitFullscreen() {
  if (document.documentElement.classList.contains("immersive")) {
    exitImmersiveFallback();
  }
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

export function toggleFullscreen(el = document.documentElement) {
  if (isImmersive()) {
    return exitFullscreen().then(() => false);
  }
  return enterFullscreen(el).then(() => true);
}

/** Mount a discreet fullscreen toggle button */
export function mountFullscreenButton(root, { target, onChange } = {}) {
  const el = target || document.documentElement;
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

  // Use pointerup so the gesture is still "fresh" on mobile
  const activate = (e) => {
    e.preventDefault();
    e.stopPropagation();
    void toggleFullscreen(el).then(sync);
  };
  btn.addEventListener("pointerup", activate);
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
  sync();

  root.appendChild(btn);
  return btn;
}
