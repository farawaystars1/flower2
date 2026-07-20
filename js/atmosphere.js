import { rand, COLORS, rgba } from "./utils.js";

/**
 * Floating soft bokeh lights for romantic depth.
 */
export function createBokeh(count, w, h, sprite) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({
      x: rand(0, w),
      y: rand(0, h * 0.75),
      r: rand(12, 48),
      a: rand(0.08, 0.28),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.2, 0.55),
      sprite,
    });
  }
  return list;
}

export function updateBokeh(list, dt, w, h) {
  for (const b of list) {
    b.phase += dt * b.speed;
    b.x += Math.sin(b.phase * 0.7) * 6 * dt;
    b.y += Math.cos(b.phase * 0.5) * 4 * dt;
    if (b.x < -40) b.x = w + 40;
    if (b.x > w + 40) b.x = -40;
    if (b.y < -40) b.y = h * 0.7;
    if (b.y > h * 0.85) b.y = rand(0, h * 0.4);
  }
}

export function drawBokeh(ctx, list, time) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const b of list) {
    const pulse = 0.75 + Math.sin(time * 0.8 + b.phase) * 0.25;
    const s = b.r * 2 * pulse;
    ctx.globalAlpha = b.a * pulse;
    ctx.drawImage(b.sprite, b.x - s / 2, b.y - s / 2, s, s);
  }
  ctx.restore();
}

/**
 * Soft mist bands across the lower midground.
 */
export function drawMist(ctx, w, h, time) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 4; i++) {
    const y = h * (0.45 + i * 0.1) + Math.sin(time * 0.25 + i) * 12;
    const g = ctx.createLinearGradient(0, y - 40, 0, y + 50);
    g.addColorStop(0, "rgba(255,180,170,0)");
    g.addColorStop(0.5, `rgba(255,170,160,${0.04 + i * 0.01})`);
    g.addColorStop(1, "rgba(255,160,150,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 50, w, 100);
  }
  ctx.restore();
}

/**
 * Soft ground wash so petals feel grounded.
 */
export function drawGround(ctx, w, h) {
  const g = ctx.createLinearGradient(0, h * 0.72, 0, h);
  g.addColorStop(0, "rgba(10,4,6,0)");
  g.addColorStop(0.45, "rgba(14,6,8,0.35)");
  g.addColorStop(1, "rgba(8,3,5,0.75)");
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  // faint warm reflection
  const r = ctx.createRadialGradient(w * 0.5, h * 0.92, 0, w * 0.5, h * 0.95, w * 0.45);
  r.addColorStop(0, rgba(COLORS.rose, 0.06));
  r.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, h * 0.75, w, h * 0.25);
}
