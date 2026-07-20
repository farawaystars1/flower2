/**
 * Immersive fullscreen helpers.
 * Browsers block fullscreen without a user gesture — call enter() from pointer/tap.
 */

export function isFullscreen() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  );
}

export function canFullscreen(el = document.documentElement) {
  return !!(
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.msRequestFullscreen
  );
}

export async function enterFullscreen(el = document.documentElement) {
  if (isFullscreen()) return true;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: "hide" });
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    } else {
      return false;
    }
    return true;
  } catch {
    // User denied or browser blocked — stay windowed
    return false;
  }
}

export async function exitFullscreen() {
  if (!isFullscreen()) return;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  } catch {
    /* ignore */
  }
}

export async function toggleFullscreen(el = document.documentElement) {
  if (isFullscreen()) {
    await exitFullscreen();
    return false;
  }
  return enterFullscreen(el);
}

/** Mount a discreet fullscreen toggle button */
export function mountFullscreenButton(root, { target } = {}) {
  const el = target || document.documentElement;
  const btn = document.createElement("button");
  btn.id = "fs-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "全屏");
  btn.title = "全屏";
  btn.textContent = "全";

  const sync = () => {
    const on = isFullscreen();
    btn.classList.toggle("on", on);
    btn.textContent = on ? "窗" : "全";
    btn.title = on ? "退出全屏" : "全屏";
    btn.setAttribute("aria-label", on ? "退出全屏" : "全屏");
  };

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await toggleFullscreen(el);
    sync();
  });

  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
  sync();

  root.appendChild(btn);
  return btn;
}
