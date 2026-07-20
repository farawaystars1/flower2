import { clamp, fbm, rand } from "./utils.js?v=20260720d";
import { createPetalSprites, PetalField } from "./petals.js?v=20260720d";
import {
  BloomGarden,
  createMidSilhouettes,
  updateMidSilhouettes,
  drawMidSilhouettes,
} from "./flowers.js?v=20260720d";
import {
  createBokeh,
  updateBokeh,
  drawBokeh,
  createStars,
  drawStars,
  createDust,
  updateDust,
  drawDust,
  drawMist,
  drawGround,
  createFallenHints,
  RippleField,
  breathFactor,
} from "./atmosphere.js?v=20260720d";
import { IntroCeremony } from "./intro.js?v=20260720d";
import { mountDedication, DedicationController } from "./dedication.js?v=20260720d";
import { SoftAudio, mountMuteButton } from "./audio.js?v=20260720d";
import { SceneDirector } from "./director.js?v=20260720d";
import {
  enterFullscreen,
  mountFullscreenButton,
  mountStartGate,
  isImmersive,
  getViewportSize,
} from "./fullscreen.js?v=20260720d";

function detectQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile || cores <= 4) return "low";
  if (cores <= 6) return "medium";
  return "high";
}

const quality = detectQuality();
let enableBlur = quality !== "low";

const app = document.getElementById("app");
const canvas = document.getElementById("c");
const veil = document.getElementById("veil");
const sky = document.getElementById("sky");
const curtain = document.getElementById("curtain");
const hint = document.getElementById("hint");
const skipHint = document.getElementById("skip-hint");
const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });

let w = 0;
let h = 0;
let dpr = 1;

const sprites = createPetalSprites();
let maxPetals = quality === "low" ? 180 : quality === "medium" ? 300 : 420;
const petals = new PetalField(sprites, { max: maxPetals, enableBlur });
const garden = new BloomGarden(sprites.glow);
garden.maxBlooms = quality === "low" ? 8 : quality === "medium" ? 12 : 16;
const ripples = new RippleField();
const audio = new SoftAudio();
const director = new SceneDirector();

const dedicationEl = mountDedication(app);
const dedication = new DedicationController(dedicationEl);
dedication.enabled = false; // 不显示中间寄语

let fullscreenTried = false;
let experienceStarted = false; // both desktop & mobile: wait for start gate

let bokeh = [];
let stars = [];
let dust = [];
let mids = [];
let fallen = [];

const pointer = { x: 0, y: 0, active: false, down: false, downAt: 0, moved: false };
let time = 0;
let last = performance.now();
let running = true;
let ambientAcc = 0;
let sideAcc = 0;
let wind = 0;
let parallax = 0;
let frameSamples = [];
let adapted = false;
let trailActive = false;
let introDone = false;
let userInteracted = false;
let idleSinceInteract = 0;
let activity = 0;

function resize() {
  const { w: nextW, h: nextH } = getViewportSize();
  if (nextW < 2 || nextH < 2) return;

  w = nextW;
  h = nextH;
  const maxPR = quality === "low" ? 1.25 : quality === "medium" ? 1.5 : 2;
  dpr = Math.min(window.devicePixelRatio || 1, maxPR);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const bokehCount = quality === "low" ? 12 : quality === "medium" ? 18 : 26;
  bokeh = createBokeh(bokehCount, w, h, sprites.bokeh);
  stars = createStars(quality === "low" ? 18 : 36, w, h);
  dust = createDust(quality === "low" ? 28 : quality === "medium" ? 48 : 70, w, h);
  const midCount = quality === "low" ? 8 : quality === "medium" ? 12 : 16;
  mids = createMidSilhouettes(w, h, midCount);
  fallen = createFallenHints(quality === "low" ? 10 : 18, w, h);
}

resize();
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 120));
document.addEventListener("fullscreenchange", () => setTimeout(resize, 50));
document.addEventListener("webkitfullscreenchange", () => setTimeout(resize, 50));
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => resize());
}

mountMuteButton(app, audio);
mountFullscreenButton(app, {
  target: document.getElementById("app") || document.documentElement,
  onChange: () => resize(),
  onResize: () => resize(),
});

const intro = new IntroCeremony({
  curtain,
  hint,
  getSize: () => ({ w, h }),
  onFirstBloom: (x, y) => {
    burstAt(x, y, { silent: true, fromIntro: true });
    petals.spawnAmbient(w, h, quality === "low" ? 8 : 14);
  },
  onComplete: () => {
    introDone = true;
    veil.classList.add("ready");
    skipHint?.classList.add("hide");
  },
});

// Pause intro until start gate — all devices (reliable fullscreen / audio unlock)
experienceStarted = false;
intro.active = false;
if (curtain) {
  curtain.classList.add("active");
  curtain.style.opacity = "1";
}
if (hint) {
  hint.style.animation = "none";
  hint.style.opacity = "0";
}
if (skipHint) {
  skipHint.style.opacity = "0";
}

mountStartGate(app, {
  onResize: () => resize(),
  onStart: () => {
    experienceStarted = true;
    fullscreenTried = true;
    userInteracted = true;
    void audio.unlock();

    let begun = false;
    const kick = () => {
      resize();
      if (begun || w < 2 || h < 2) return;
      begun = true;
      intro.active = true;
      intro.t = 0;
      petals.spawnAmbient(w, h, quality === "low" ? 12 : 22);
    };
    kick();
    requestAnimationFrame(() => {
      resize();
      kick();
      for (const ms of [80, 200, 500]) {
        setTimeout(() => {
          resize();
          kick();
        }, ms);
      }
    });
  },
});

function triggerEgg() {
  // Soft full-screen gentle petal rain (restrained)
  const n = quality === "low" ? 35 : 60;
  for (let i = 0; i < n; i++) {
    petals.spawnAmbient(w, h, 1);
  }
  burstAt(w * 0.5, h * 0.35, { silent: false, fromIntro: true });
  setTimeout(() => burstAt(w * 0.32, h * 0.48, { silent: true, fromIntro: true }), 280);
  setTimeout(() => burstAt(w * 0.68, h * 0.46, { silent: true, fromIntro: true }), 480);
  audio.playBloom(1.2);
}

function burstAt(x, y, { cluster = false, silent = false, fromIntro = false } = {}) {
  const result = garden.tryBloom(x, y, quality, { cluster });
  if (!result) return;

  const n = cluster
    ? quality === "low"
      ? 40
      : 70
    : quality === "low"
      ? 28 + Math.floor(rand(0, 12))
      : quality === "medium"
        ? 42 + Math.floor(rand(0, 18))
        : 55 + Math.floor(rand(0, 25));
  petals.spawnBurst(x, y, n);
  ripples.spawn(x, y, cluster ? 1.25 : result.intensity);
  activity = Math.min(1, activity + (cluster ? 0.35 : 0.2));

  for (let i = 0; i < (quality === "low" ? 2 : 4); i++) {
    petals.spawnAmbient(w, h, 1);
  }

  if (!silent) audio.playBloom(cluster ? 1.1 : 0.85);

  if (!fromIntro && introDone) {
    const egg = director.registerBloom(x, y);
    if (egg) triggerEgg();
  }
}

function localPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function onUserGesture() {
  if (!fullscreenTried && !isImmersive()) {
    fullscreenTried = true;
    void enterFullscreen(document.documentElement, { onResize: () => resize() }).then(() => {
      resize();
    });
  }
  if (!userInteracted) {
    userInteracted = true;
    void audio.unlock();
  }
  idleSinceInteract = 0;
}

canvas.addEventListener("pointerdown", (e) => {
  // Wait for mobile start-gate before garden interaction
  if (!experienceStarted) return;

  onUserGesture();

  if (intro.active) {
    intro.skip();
    return;
  }

  const p = localPos(e);
  pointer.x = p.x;
  pointer.y = p.y;
  pointer.active = true;
  pointer.down = true;
  pointer.downAt = performance.now();
  pointer.moved = false;
  trailActive = false;
  canvas.setPointerCapture?.(e.pointerId);
});

canvas.addEventListener(
  "touchend",
  (e) => {
    if (!experienceStarted) return;
    onUserGesture();
    if (intro.active) {
      e.preventDefault();
      intro.skip();
    }
  },
  { passive: false }
);

canvas.addEventListener("pointermove", (e) => {
  const p = localPos(e);
  const dx = p.x - pointer.x;
  const dy = p.y - pointer.y;
  pointer.x = p.x;
  pointer.y = p.y;
  pointer.active = true;

  app.style.setProperty("--mx", `${e.clientX}px`);
  app.style.setProperty("--my", `${e.clientY}px`);
  parallax = ((e.clientX / w) - 0.5) * 24;

  if (pointer.down && introDone) {
    if (Math.hypot(dx, dy) > 4) {
      pointer.moved = true;
      trailActive = true;
    }
    if (trailActive) {
      petals.spawnTrail(p.x, p.y, quality === "low" ? 1 : 2);
    }
  }
});

canvas.addEventListener("pointerup", async (e) => {
  if (!introDone) {
    pointer.down = false;
    return;
  }

  const p = localPos(e);
  const held = (performance.now() - pointer.downAt) / 1000;

  if (pointer.down) {
    if (!pointer.moved && held < 0.55) {
      burstAt(p.x, p.y);
    } else if (held >= 0.6) {
      burstAt(p.x, p.y, { cluster: true });
    } else if (pointer.moved && held < 0.6) {
      burstAt(p.x, p.y);
    }
  }

  pointer.down = false;
  trailActive = false;
});

canvas.addEventListener("pointercancel", () => {
  pointer.down = false;
  trailActive = false;
});

window.addEventListener("pointermove", (e) => {
  if (!pointer.down) {
    app.style.setProperty("--mx", `${e.clientX}px`);
    app.style.setProperty("--my", `${e.clientY}px`);
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.active = true;
    parallax = ((e.clientX / w) - 0.5) * 24;
  }
});

window.addEventListener("pointerleave", () => {
  pointer.active = false;
});

document.addEventListener("visibilitychange", () => {
  running = !document.hidden;
  if (running) last = performance.now();
});

function maybeAdapt(dtMs) {
  if (adapted || time < 3) return;
  frameSamples.push(dtMs);
  if (frameSamples.length < 40) return;
  const avg = frameSamples.reduce((a, b) => a + b, 0) / frameSamples.length;
  frameSamples.length = 0;
  if (avg > 22) {
    petals.max = Math.max(120, Math.floor(petals.max * 0.65));
    maxPetals = petals.max;
    garden.maxBlooms = Math.max(5, garden.maxBlooms - 3);
    petals.enableBlur = false;
    enableBlur = false;
    // Trim dust for perf
    if (dust.length > 24) dust.length = 24;
    adapted = true;
  }
}

function runIdleEvent(kind) {
  if (kind === "selfBloom") {
    const m = mids[(Math.random() * mids.length) | 0];
    if (m) {
      burstAt(m.x, m.y, { silent: true, fromIntro: true });
      m.pulse = 1;
    } else {
      burstAt(rand(w * 0.25, w * 0.75), rand(h * 0.3, h * 0.6), {
        silent: true,
        fromIntro: true,
      });
    }
  } else if (kind === "petalSurge") {
    for (let i = 0; i < (quality === "low" ? 3 : 6); i++) {
      petals.spawnSideEntry(w, h);
    }
    petals.spawnAmbient(w, h, quality === "low" ? 4 : 8);
  } else if (kind === "dustBright") {
    director.triggerDustBright();
  }
}

function tick(now) {
  requestAnimationFrame(tick);
  if (!running) return;

  // Mobile: freeze sim until start gate is tapped
  if (!experienceStarted) {
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawStars(ctx, stars, time);
    drawBokeh(ctx, bokeh, time, 1);
    drawMist(ctx, w, h, time, 1);
    drawGround(ctx, w, h, fallen, 1);
    return;
  }

  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  time += dt;
  maybeAdapt(dt * 1000);

  intro.update(dt);
  dedication.update(dt);
  director.updateColor(dt);
  director.updateCamera(time, dt);
  director.updateDustBoost(dt);
  activity = Math.max(0, activity - dt * 0.08);
  director.setActivity(activity);

  // CSS warmth shift
  if (sky) {
    sky.style.setProperty("--breath", String(breathFactor(time)));
    sky.style.setProperty("--warm-shift", String(director.colorT));
  }

  wind = (fbm(time * 0.15, 0.3) - 0.5) * 2;
  const breath = breathFactor(time);

  if (introDone) {
    idleSinceInteract += dt;

    const ev = director.tickEvents(dt, introDone);
    if (ev) runIdleEvent(ev);

    if (pointer.down && !pointer.moved) {
      const held = (now - pointer.downAt) / 1000;
      if (held > 0.35 && held < 0.6) {
        petals.spawnTrail(pointer.x, pointer.y, 1);
      }
    }

    ambientAcc += dt;
    const interval = quality === "low" ? 0.55 : 0.3;
    if (ambientAcc > interval && petals.count < petals.max * 0.5) {
      ambientAcc = 0;
      petals.spawnAmbient(w, h, quality === "low" ? 1 : 2);
    }

    sideAcc += dt;
    if (sideAcc > (quality === "low" ? 4.5 : 2.8)) {
      sideAcc = 0;
      if (Math.random() < 0.7) petals.spawnSideEntry(w, h);
    }
  }

  petals.update(dt, w, h, wind, introDone ? pointer : null);
  garden.update(dt);
  ripples.update(dt);
  updateBokeh(bokeh, dt, w, h);
  updateDust(dust, dt, w, h, wind);
  updateMidSilhouettes(mids, dt, time);

  // Draw with micro-camera + dpr (camera must preserve dpr — avoids HiDPI seam)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  director.applyCamera(ctx, w, h, dpr);

  drawStars(ctx, stars, time);
  drawBokeh(ctx, bokeh, time, breath);
  drawMist(ctx, w, h, time, breath);
  drawMidSilhouettes(ctx, mids, time, parallax, wind);
  drawGround(ctx, w, h, fallen, breath);
  drawDust(ctx, dust, time, breath, director.getDustMul());

  ripples.draw(ctx);
  garden.draw(ctx);
  petals.draw(ctx);

  // Fullscreen overlays in un-camera'd space so they always cover the viewport
  director.resetView(ctx, dpr);

  const warm = director.getWarmth();
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = `rgba(${warm.r | 0},${warm.g | 0},${warm.b | 0},${warm.a})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const pulse = 0.012 + (breath - 1) * 0.08 + Math.sin(time * 0.35) * 0.006;
  const vg = ctx.createRadialGradient(
    w * 0.5,
    h * 0.4,
    w * 0.12,
    w * 0.5,
    h * 0.45,
    w * (0.72 + director.vignette * 0.1)
  );
  vg.addColorStop(0, `rgba(255,160,150,${Math.max(0, pulse)})`);
  vg.addColorStop(0.55, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(8,3,5,${0.12 + director.vignette * 0.25})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

requestAnimationFrame(tick);
