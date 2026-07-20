import { rand, COLORS, rgba, lerp } from "./utils.js?v=20260720c";

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

export function drawBokeh(ctx, list, time, breath = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const b of list) {
    const pulse = (0.75 + Math.sin(time * 0.8 + b.phase) * 0.25) * breath;
    const s = b.r * 2 * pulse;
    ctx.globalAlpha = b.a * pulse;
    ctx.drawImage(b.sprite, b.x - s / 2, b.y - s / 2, s, s);
  }
  ctx.restore();
}

/** Tiny almost-still stars in upper sky */
export function createStars(count, w, h) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({
      x: rand(0, w),
      y: rand(0, h * 0.42),
      r: rand(0.4, 1.4),
      a: rand(0.12, 0.4),
      phase: rand(0, Math.PI * 2),
      twinkle: rand(0.15, 0.45),
    });
  }
  return list;
}

export function drawStars(ctx, list, time) {
  ctx.save();
  for (const s of list) {
    const tw = 0.55 + Math.sin(time * s.twinkle + s.phase) * 0.45;
    ctx.globalAlpha = s.a * tw;
    ctx.fillStyle = "rgba(255,236,228,1)";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Soft gold dust motes */
export function createDust(count, w, h) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({
      x: rand(0, w),
      y: rand(0, h),
      r: rand(0.6, 1.8),
      a: rand(0.08, 0.22),
      vx: rand(-6, 6),
      vy: rand(-10, -2),
      phase: rand(0, Math.PI * 2),
    });
  }
  return list;
}

export function updateDust(list, dt, w, h, windX) {
  for (const d of list) {
    d.phase += dt * 0.8;
    d.x += (d.vx + windX * 8 + Math.sin(d.phase) * 4) * dt;
    d.y += d.vy * dt;
    if (d.y < -10) {
      d.y = h + 10;
      d.x = rand(0, w);
    }
    if (d.x < -10) d.x = w + 10;
    if (d.x > w + 10) d.x = -10;
  }
}

export function drawDust(ctx, list, time, breath = 1, mul = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const d of list) {
    const pulse = 0.7 + Math.sin(time * 1.2 + d.phase) * 0.3;
    ctx.globalAlpha = d.a * pulse * breath * mul;
    const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 3);
    g.addColorStop(0, rgba(COLORS.gold, 0.9));
    g.addColorStop(0.5, rgba(COLORS.blush, 0.25));
    g.addColorStop(1, rgba(COLORS.gold, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Soft mist bands — breathe with global pulse.
 */
export function drawMist(ctx, w, h, time, breath = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const lift = Math.sin(time * 0.22) * 10 * breath;
  for (let i = 0; i < 4; i++) {
    const y = h * (0.45 + i * 0.1) + Math.sin(time * 0.25 + i) * 12 + lift;
    const g = ctx.createLinearGradient(0, y - 40, 0, y + 50);
    const a = (0.035 + i * 0.01) * (0.85 + breath * 0.2);
    g.addColorStop(0, "rgba(255,180,170,0)");
    g.addColorStop(0.5, `rgba(255,170,160,${a})`);
    g.addColorStop(1, "rgba(255,160,150,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 50, w, 100);
  }
  ctx.restore();
}

/**
 * Soft ground wash + faint fallen-petal mottling.
 */
export function createFallenHints(count, w, h) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({
      x: rand(0, w),
      y: rand(h * 0.82, h * 0.98),
      rot: rand(0, Math.PI * 2),
      scale: rand(0.15, 0.4),
      a: rand(0.04, 0.12),
      tint: rand(0.2, 0.7),
    });
  }
  return list;
}

export function drawGround(ctx, w, h, fallen = [], breath = 1) {
  const g = ctx.createLinearGradient(0, h * 0.72, 0, h);
  g.addColorStop(0, "rgba(10,4,6,0)");
  g.addColorStop(0.45, "rgba(14,6,8,0.35)");
  g.addColorStop(1, "rgba(8,3,5,0.75)");
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  const r = ctx.createRadialGradient(w * 0.5, h * 0.92, 0, w * 0.5, h * 0.95, w * 0.45);
  r.addColorStop(0, rgba(COLORS.rose, 0.05 + 0.02 * breath));
  r.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, h * 0.75, w, h * 0.25);

  // faint fallen petal hints
  for (const f of fallen) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.globalAlpha = f.a;
    const len = 22 * f.scale;
    const wid = 12 * f.scale;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-wid * 0.5, -len * 0.3, -wid * 0.55, -len * 0.7, 0, -len);
    ctx.bezierCurveTo(wid * 0.55, -len * 0.7, wid * 0.5, -len * 0.3, 0, 0);
    ctx.fillStyle = rgba(
      f.tint < 0.5 ? COLORS.wine : COLORS.rose,
      1
    );
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Warm light ripples from bloom points.
 */
export class RippleField {
  constructor() {
    this.list = [];
  }

  spawn(x, y, intensity = 1) {
    this.list.push({
      x,
      y,
      life: 0,
      maxLife: 0.65,
      intensity,
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      this.list[i].life += dt;
      if (this.list[i].life >= this.list[i].maxLife) this.list.splice(i, 1);
    }
  }

  draw(ctx) {
    if (!this.list.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const r of this.list) {
      const t = r.life / r.maxLife;
      const radius = lerp(20, 160 * r.intensity, t);
      const a = (1 - t) * 0.35 * r.intensity;
      const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, radius);
      g.addColorStop(0, `rgba(255,220,200,${a})`);
      g.addColorStop(0.45, `rgba(255,160,150,${a * 0.45})`);
      g.addColorStop(1, "rgba(180,60,80,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Global breath factor ~0.85–1.15 over ~5s */
export function breathFactor(time) {
  return 1 + Math.sin(time * ((Math.PI * 2) / 5.2)) * 0.08;
}
