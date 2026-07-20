import { clamp, fbm, rand } from "./utils.js";
import { createPetalSprites, PetalField } from "./petals.js";
import {
  BloomGarden,
  createMidSilhouettes,
  drawMidSilhouettes,
} from "./flowers.js";
import {
  createBokeh,
  updateBokeh,
  drawBokeh,
  drawMist,
  drawGround,
} from "./atmosphere.js";

function detectQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile || cores <= 4) return "low";
  if (cores <= 6) return "medium";
  return "high";
}

const quality = detectQuality();
const app = document.getElementById("app");
const canvas = document.getElementById("c");
const veil = document.getElementById("veil");
const ctx = canvas.getContext("2d", { alpha: true });

let w = 0;
let h = 0;
let dpr = 1;

const sprites = createPetalSprites();
const maxPetals = quality === "low" ? 180 : quality === "medium" ? 300 : 420;
const petals = new PetalField(sprites, { max: maxPetals });
const garden = new BloomGarden(sprites.glow);
garden.maxBlooms = quality === "low" ? 7 : quality === "medium" ? 10 : 14;

let bokeh = [];
let mids = [];
let pointer = { x: 0, y: 0 };
let time = 0;
let last = performance.now();
let running = true;
let ambientAcc = 0;
let wind = 0;
let parallax = 0;
let frameSamples = [];
let adapted = false;

function resize() {
  w = window.innerWidth;
  h = window.innerHeight;
  const maxPR = quality === "low" ? 1.25 : quality === "medium" ? 1.5 : 2;
  dpr = Math.min(window.devicePixelRatio || 1, maxPR);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const bokehCount = quality === "low" ? 12 : quality === "medium" ? 18 : 26;
  bokeh = createBokeh(bokehCount, w, h, sprites.bokeh);
  const midCount = quality === "low" ? 8 : quality === "medium" ? 12 : 16;
  mids = createMidSilhouettes(w, h, midCount);
}

resize();
window.addEventListener("resize", resize);

requestAnimationFrame(() => veil.classList.add("ready"));

// Intro drizzle — fill space gently so the garden feels alive immediately
petals.spawnAmbient(w, h, quality === "low" ? 16 : 28);

function burstAt(x, y) {
  const result = garden.tryBloom(x, y, quality);
  if (!result) return;
  const n =
    quality === "low"
      ? 28 + Math.floor(rand(0, 12))
      : quality === "medium"
        ? 42 + Math.floor(rand(0, 18))
        : 55 + Math.floor(rand(0, 25));
  petals.spawnBurst(x, y, n);

  // soft ripple of ambient petals around
  for (let i = 0; i < (quality === "low" ? 2 : 4); i++) {
    petals.spawnAmbient(w, h, 1);
  }
}

canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  burstAt(e.clientX - rect.left, e.clientY - rect.top);
});

window.addEventListener("pointermove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  app.style.setProperty("--mx", `${e.clientX}px`);
  app.style.setProperty("--my", `${e.clientY}px`);
  parallax = ((e.clientX / w) - 0.5) * 24;
});

document.addEventListener("visibilitychange", () => {
  running = !document.hidden;
  if (running) last = performance.now();
});

// Gentle auto blooms so the scene feels alive
setTimeout(() => burstAt(w * 0.48 + rand(-20, 20), h * 0.4), 900);
setTimeout(() => burstAt(w * 0.62, h * 0.52), 2000);
setTimeout(() => burstAt(w * 0.35, h * 0.48), 3200);

function maybeAdapt(dtMs) {
  if (adapted || time < 3) return;
  frameSamples.push(dtMs);
  if (frameSamples.length < 40) return;
  const avg = frameSamples.reduce((a, b) => a + b, 0) / frameSamples.length;
  frameSamples.length = 0;
  if (avg > 22) {
    // lower particle pressure
    petals.max = Math.max(120, Math.floor(petals.max * 0.65));
    garden.maxBlooms = Math.max(5, garden.maxBlooms - 3);
    adapted = true;
  }
}

function tick(now) {
  requestAnimationFrame(tick);
  if (!running) return;

  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  time += dt;
  maybeAdapt(dt * 1000);

  wind = (fbm(time * 0.15, 0.3) - 0.5) * 2;

  // Ambient petal rain (gentle)
  ambientAcc += dt;
  const interval = quality === "low" ? 0.55 : 0.3;
  if (ambientAcc > interval && petals.count < petals.max * 0.5) {
    ambientAcc = 0;
    petals.spawnAmbient(w, h, quality === "low" ? 1 : 2);
  }

  petals.update(dt, w, h, wind);
  garden.update(dt);
  updateBokeh(bokeh, dt, w, h);

  // Clear — sky is CSS behind canvas
  ctx.clearRect(0, 0, w, h);

  drawBokeh(ctx, bokeh, time);
  drawMist(ctx, w, h, time);
  drawMidSilhouettes(ctx, mids, time, parallax);
  drawGround(ctx, w, h);

  // Blooms under flying petals for depth, then petals, then a few near blooms on top
  garden.draw(ctx);
  petals.draw(ctx);

  // Soft screen-edge warmth pulse (very subtle)
  const pulse = 0.015 + Math.sin(time * 0.35) * 0.008;
  const vg = ctx.createRadialGradient(w * 0.5, h * 0.4, w * 0.15, w * 0.5, h * 0.45, w * 0.75);
  vg.addColorStop(0, `rgba(255,160,150,${pulse})`);
  vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

requestAnimationFrame(tick);
