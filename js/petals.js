import { COLORS, mixRGB, petalTint, rand, rgba } from "./utils.js";

/**
 * Pre-render soft watercolor-like petal sprites (no hard 3D meshes).
 * Multiple variants for visual richness without looking noisy.
 */
export function createPetalSprites() {
  const variants = [];
  const shapes = [
    { w: 64, h: 96, curve: 0.35, tip: 0.55 },
    { w: 72, h: 100, curve: 0.42, tip: 0.48 },
    { w: 56, h: 88, curve: 0.28, tip: 0.62 },
    { w: 80, h: 110, curve: 0.5, tip: 0.4 },
  ];

  for (let i = 0; i < shapes.length; i++) {
    const tint = petalTint(0.15 + i * 0.2);
    variants.push(renderPetalSprite(shapes[i], tint, 0.95));
    // lighter tip variant
    variants.push(renderPetalSprite(shapes[i], mixRGB(tint, COLORS.ivory, 0.35), 0.85));
  }

  // soft glow disc for bloom centers / light
  const glow = document.createElement("canvas");
  glow.width = 128;
  glow.height = 128;
  const gctx = glow.getContext("2d");
  const gg = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gg.addColorStop(0, "rgba(255,230,220,0.9)");
  gg.addColorStop(0.35, "rgba(255,170,160,0.35)");
  gg.addColorStop(1, "rgba(180,60,80,0)");
  gctx.fillStyle = gg;
  gctx.fillRect(0, 0, 128, 128);

  // bokeh orb
  const bokeh = document.createElement("canvas");
  bokeh.width = 96;
  bokeh.height = 96;
  const bctx = bokeh.getContext("2d");
  const bg = bctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  bg.addColorStop(0, "rgba(255,235,225,0.85)");
  bg.addColorStop(0.4, "rgba(255,190,180,0.28)");
  bg.addColorStop(1, "rgba(200,100,110,0)");
  bctx.fillStyle = bg;
  bctx.fillRect(0, 0, 96, 96);

  return { variants, glow, bokeh };
}

function renderPetalSprite({ w, h, curve, tip }, tint, alpha) {
  const pad = 16;
  const canvas = document.createElement("canvas");
  canvas.width = w + pad * 2;
  canvas.height = h + pad * 2;
  const ctx = canvas.getContext("2d");
  const cx = canvas.width / 2;
  const cy = pad + h * 0.92;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = alpha;

  // Soft petal path (heart-ish tapered leaf)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    -w * curve,
    -h * 0.25,
    -w * 0.55,
    -h * tip,
    0,
    -h
  );
  ctx.bezierCurveTo(
    w * 0.55,
    -h * tip,
    w * curve,
    -h * 0.25,
    0,
    0
  );
  ctx.closePath();

  // Base fill gradient root→tip
  const grad = ctx.createLinearGradient(0, 0, 0, -h);
  const deep = mixRGB(tint, COLORS.wine, 0.35);
  const mid = tint;
  const light = mixRGB(tint, COLORS.ivory, 0.45);
  grad.addColorStop(0, rgba(deep, 0.95));
  grad.addColorStop(0.45, rgba(mid, 0.88));
  grad.addColorStop(1, rgba(light, 0.55));
  ctx.fillStyle = grad;
  ctx.fill();

  // Soft edge veil (blurred feel via second translucent stroke)
  ctx.save();
  ctx.clip();
  const edge = ctx.createRadialGradient(0, -h * 0.35, h * 0.05, 0, -h * 0.3, h * 0.7);
  edge.addColorStop(0, rgba(COLORS.ivory, 0.35));
  edge.addColorStop(0.5, rgba(mid, 0.08));
  edge.addColorStop(1, rgba(deep, 0.25));
  ctx.fillStyle = edge;
  ctx.fillRect(-w, -h, w * 2, h);
  ctx.restore();

  // Vein hint (very soft)
  ctx.strokeStyle = rgba(COLORS.ivory, 0.18);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(w * 0.04, -h * 0.5, 0, -h * 0.92);
  ctx.stroke();

  // Outer glow bloom around petal
  ctx.globalCompositeOperation = "screen";
  ctx.filter = "blur(4px)";
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * curve, -h * 0.25, -w * 0.55, -h * tip, 0, -h);
  ctx.bezierCurveTo(w * 0.55, -h * tip, w * curve, -h * 0.25, 0, 0);
  ctx.fillStyle = rgba(mixRGB(tint, COLORS.blush, 0.4), 1);
  ctx.fill();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();
  return canvas;
}

/**
 * Soft falling / drifting petal particles.
 */
export class PetalField {
  constructor(sprites, { max = 420 } = {}) {
    this.sprites = sprites;
    this.max = max;
    this.list = [];
    this.pool = [];
    for (let i = 0; i < max; i++) this.pool.push(this._fresh());
  }

  _fresh() {
    return {
      alive: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rot: 0,
      vr: 0,
      scale: 1,
      life: 0,
      maxLife: 1,
      sprite: null,
      alpha: 1,
      sway: 0,
      swayAmp: 1,
      depth: 1,
    };
  }

  _alloc() {
    return this.pool.pop() || this._fresh();
  }

  _free(p) {
    p.alive = false;
    this.pool.push(p);
  }

  spawnAmbient(w, h, n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) break;
      const p = this._alloc();
      const depth = rand(0.35, 1.15);
      p.alive = true;
      p.x = rand(-40, w + 40);
      p.y = rand(-80, h * 0.55);
      p.vx = rand(-18, 18);
      p.vy = rand(18, 48) * depth;
      p.rot = rand(0, Math.PI * 2);
      p.vr = rand(-1.2, 1.2);
      p.scale = rand(0.28, 0.75) * depth;
      p.life = 0;
      p.maxLife = rand(7, 14);
      p.sprite = this.sprites.variants[(Math.random() * this.sprites.variants.length) | 0];
      p.alpha = rand(0.5, 0.95);
      p.sway = rand(0, Math.PI * 2);
      p.swayAmp = rand(18, 42);
      p.depth = depth;
      this.list.push(p);
    }
  }

  spawnBurst(x, y, n = 55) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) {
        // recycle oldest
        const old = this.list.shift();
        this._free(old);
      }
      const p = this._alloc();
      const ang = rand(-Math.PI * 0.15, Math.PI * 1.15);
      const speed = rand(80, 280);
      const depth = rand(0.6, 1.25);
      p.alive = true;
      p.x = x + rand(-8, 8);
      p.y = y + rand(-8, 8);
      p.vx = Math.cos(ang) * speed;
      p.vy = Math.sin(ang) * speed * 0.55 - rand(40, 160);
      p.rot = rand(0, Math.PI * 2);
      p.vr = rand(-2.5, 2.5);
      p.scale = rand(0.35, 0.95) * depth;
      p.life = 0;
      p.maxLife = rand(4.5, 9);
      p.sprite = this.sprites.variants[(Math.random() * this.sprites.variants.length) | 0];
      p.alpha = rand(0.55, 0.95);
      p.sway = rand(0, Math.PI * 2);
      p.swayAmp = rand(25, 60);
      p.depth = depth;
      this.list.push(p);
    }
  }

  update(dt, w, h, windX) {
    const g = 55;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      if (p.life >= p.maxLife || p.y > h + 80) {
        this.list.splice(i, 1);
        this._free(p);
        continue;
      }

      p.sway += dt * (1.1 + p.depth * 0.4);
      const sway = Math.sin(p.sway) * p.swayAmp;
      p.vx += (windX * 40 + sway * 0.15) * dt;
      p.vy += g * dt * 0.35;
      p.vx *= 0.992;
      p.vy *= 0.995;

      p.x += (p.vx + sway * 0.35) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      // soft settle near bottom
      if (p.y > h * 0.88) {
        p.vy *= 0.92;
        p.vx *= 0.96;
        p.alpha *= 0.995;
      }
    }
  }

  draw(ctx) {
    // draw far→near by depth
    const sorted = this.list;
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const lifeT = p.life / p.maxLife;
      let a = p.alpha;
      if (lifeT < 0.08) a *= lifeT / 0.08;
      if (lifeT > 0.72) a *= 1 - (lifeT - 0.72) / 0.28;

      const spr = p.sprite;
      const sw = spr.width * p.scale;
      const sh = spr.height * p.scale;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, a);
      ctx.drawImage(spr, -sw / 2, -sh / 2, sw, sh);
      ctx.restore();
    }
  }

  get count() {
    return this.list.length;
  }
}
