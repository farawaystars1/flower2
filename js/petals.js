import { COLORS, mixRGB, petalTint, rand, rgba, clamp } from "./utils.js";

/**
 * Pre-render soft watercolor-like petal sprites.
 * Includes rose / peony / sakura silhouette variants.
 */
export function createPetalSprites() {
  const variants = [];
  const softMid = [];
  const softFar = [];
  const shapes = [
    { w: 64, h: 96, curve: 0.35, tip: 0.55, kind: "rose" },
    { w: 72, h: 100, curve: 0.42, tip: 0.48, kind: "rose" },
    { w: 56, h: 88, curve: 0.28, tip: 0.62, kind: "sakura" },
    { w: 80, h: 90, curve: 0.55, tip: 0.38, kind: "peony" },
    { w: 70, h: 110, curve: 0.32, tip: 0.7, kind: "sakura" },
  ];

  for (let i = 0; i < shapes.length; i++) {
    const tint = petalTint(0.12 + i * 0.16);
    const sharp = renderPetalSprite(shapes[i], tint, 0.95);
    const light = renderPetalSprite(shapes[i], mixRGB(tint, COLORS.ivory, 0.35), 0.85);
    variants.push(sharp, light);
    // Bake depth-of-field once (avoids per-frame ctx.filter cost)
    softMid.push(softenSprite(sharp, 0.55), softenSprite(light, 0.55));
    softFar.push(softenSprite(sharp, 1.15), softenSprite(light, 1.15));
  }

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

  return { variants, softMid, softFar, glow, bokeh };
}

/** Pre-blur a sprite into a new canvas (one-time cost). */
function softenSprite(src, blurPx) {
  const pad = Math.ceil(blurPx * 2) + 2;
  const canvas = document.createElement("canvas");
  canvas.width = src.width + pad * 2;
  canvas.height = src.height + pad * 2;
  const ctx = canvas.getContext("2d");
  ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(src, pad, pad);
  ctx.filter = "none";
  return canvas;
}

function renderPetalSprite({ w, h, curve, tip, kind }, tint, alpha) {
  const pad = 16;
  const canvas = document.createElement("canvas");
  canvas.width = w + pad * 2;
  canvas.height = h + pad * 2;
  const ctx = canvas.getContext("2d");
  const cx = canvas.width / 2;
  const cy = pad + h * 0.92;

  // Shape tweaks by kind
  let c = curve;
  let t = tip;
  if (kind === "peony") {
    c = curve * 1.15;
    t = tip * 0.85;
  } else if (kind === "sakura") {
    c = curve * 0.85;
    t = Math.min(0.78, tip * 1.15);
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = alpha;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * c, -h * 0.25, -w * 0.55, -h * t, 0, -h);
  ctx.bezierCurveTo(w * 0.55, -h * t, w * c, -h * 0.25, 0, 0);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, -h);
  const deep = mixRGB(tint, COLORS.wine, 0.35);
  const mid = tint;
  const light = mixRGB(tint, COLORS.ivory, 0.45);
  grad.addColorStop(0, rgba(deep, 0.95));
  grad.addColorStop(0.45, rgba(mid, 0.88));
  grad.addColorStop(1, rgba(light, 0.55));
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  ctx.clip();
  const edge = ctx.createRadialGradient(0, -h * 0.35, h * 0.05, 0, -h * 0.3, h * 0.7);
  edge.addColorStop(0, rgba(COLORS.ivory, 0.35));
  edge.addColorStop(0.5, rgba(mid, 0.08));
  edge.addColorStop(1, rgba(deep, 0.25));
  ctx.fillStyle = edge;
  ctx.fillRect(-w, -h, w * 2, h);
  ctx.restore();

  ctx.strokeStyle = rgba(COLORS.ivory, 0.18);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(w * 0.04, -h * 0.5, 0, -h * 0.92);
  ctx.stroke();

  ctx.globalCompositeOperation = "screen";
  ctx.filter = "blur(4px)";
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * c, -h * 0.25, -w * 0.55, -h * t, 0, -h);
  ctx.bezierCurveTo(w * 0.55, -h * t, w * c, -h * 0.25, 0, 0);
  ctx.fillStyle = rgba(mixRGB(tint, COLORS.blush, 0.4), 1);
  ctx.fill();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();
  return canvas;
}

/**
 * Soft falling / drifting petal particles with depth + pointer intimacy.
 */
export class PetalField {
  constructor(sprites, { max = 420, enableBlur = true } = {}) {
    this.sprites = sprites;
    this.max = max;
    this.enableBlur = enableBlur;
    this.list = [];
    this.pool = [];
    this.trailCooldown = 0;
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
      layer: 2,
    };
  }

  _alloc() {
    return this.pool.pop() || this._fresh();
  }

  _free(p) {
    p.alive = false;
    this.pool.push(p);
  }

  _pickSprite(depth) {
    const i = (Math.random() * this.sprites.variants.length) | 0;
    if (this.enableBlur && depth < 0.55 && this.sprites.softFar?.length) {
      return this.sprites.softFar[i];
    }
    if (this.enableBlur && depth < 0.75 && this.sprites.softMid?.length) {
      return this.sprites.softMid[i];
    }
    return this.sprites.variants[i];
  }

  _layerFor(depth) {
    if (depth < 0.55) return 0; // far
    if (depth < 0.85) return 1; // mid
    return 2; // near
  }

  spawnAmbient(w, h, n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) break;
      const p = this._alloc();
      const depth = rand(0.3, 1.2);
      p.alive = true;
      p.x = rand(-40, w + 40);
      p.y = rand(-80, h * 0.55);
      p.vx = rand(-18, 18);
      p.vy = rand(16, 46) * (0.55 + depth * 0.45);
      p.rot = rand(0, Math.PI * 2);
      p.vr = rand(-1.2, 1.2);
      p.scale = rand(0.25, 0.72) * (0.55 + depth * 0.55);
      p.life = 0;
      p.maxLife = rand(7, 14);
      p.sprite = this._pickSprite(depth);
      p.alpha = rand(0.4, 0.92) * (0.55 + depth * 0.45);
      p.sway = rand(0, Math.PI * 2);
      p.swayAmp = rand(16, 40);
      p.depth = depth;
      p.layer = this._layerFor(depth);
      this.list.push(p);
    }
  }

  /** Occasional petal drifting in from screen edge */
  spawnSideEntry(w, h) {
    if (this.list.length >= this.max) return;
    const p = this._alloc();
    const fromLeft = Math.random() < 0.5;
    const depth = rand(0.5, 1.1);
    p.alive = true;
    p.x = fromLeft ? -30 : w + 30;
    p.y = rand(h * 0.1, h * 0.55);
    p.vx = fromLeft ? rand(28, 70) : rand(-70, -28);
    p.vy = rand(8, 35);
    p.rot = rand(0, Math.PI * 2);
    p.vr = rand(-1.5, 1.5);
    p.scale = rand(0.35, 0.8) * depth;
    p.life = 0;
    p.maxLife = rand(6, 11);
    p.sprite = this._pickSprite(depth);
    p.alpha = rand(0.55, 0.9);
    p.sway = rand(0, Math.PI * 2);
    p.swayAmp = rand(20, 48);
    p.depth = depth;
    p.layer = this._layerFor(depth);
    this.list.push(p);
  }

  spawnBurst(x, y, n = 55) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) {
        const old = this.list.shift();
        this._free(old);
      }
      const p = this._alloc();
      const ang = rand(-Math.PI * 0.15, Math.PI * 1.15);
      const speed = rand(80, 280);
      const depth = rand(0.55, 1.25);
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
      p.sprite = this._pickSprite(depth);
      p.alpha = rand(0.55, 0.95);
      p.sway = rand(0, Math.PI * 2);
      p.swayAmp = rand(25, 60);
      p.depth = depth;
      p.layer = this._layerFor(depth);
      this.list.push(p);
    }
  }

  /** Soft trail petals while dragging */
  spawnTrail(x, y, maxPerCall = 2) {
    if (this.trailCooldown > 0) return;
    if (this.list.length > this.max * 0.85) return;
    this.trailCooldown = 0.045;
    for (let i = 0; i < maxPerCall; i++) {
      if (this.list.length >= this.max) break;
      const p = this._alloc();
      const depth = rand(0.7, 1.15);
      p.alive = true;
      p.x = x + rand(-10, 10);
      p.y = y + rand(-10, 10);
      p.vx = rand(-40, 40);
      p.vy = rand(-30, 20);
      p.rot = rand(0, Math.PI * 2);
      p.vr = rand(-2, 2);
      p.scale = rand(0.28, 0.55) * depth;
      p.life = 0;
      p.maxLife = rand(2.8, 5);
      p.sprite = this._pickSprite(depth);
      p.alpha = rand(0.45, 0.8);
      p.sway = rand(0, Math.PI * 2);
      p.swayAmp = rand(14, 30);
      p.depth = depth;
      p.layer = this._layerFor(depth);
      this.list.push(p);
    }
  }

  /**
   * @param {object} pointer - {x,y,active} for hover attraction
   */
  update(dt, w, h, windX, pointer = null) {
    if (this.trailCooldown > 0) this.trailCooldown -= dt;
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

      // Wave2: gentle pointer attraction / orbit
      if (pointer && pointer.active) {
        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 160) {
          const force = (1 - dist / 160) * 55 * p.depth;
          // attract inward but with tangential swirl
          p.vx += (dx / dist) * force * dt * 0.55;
          p.vy += (dy / dist) * force * dt * 0.4;
          p.vx += (-dy / dist) * force * dt * 0.35;
          p.vy += (dx / dist) * force * dt * 0.35;
        }
      }

      p.vx *= 0.992;
      p.vy *= 0.995;

      p.x += (p.vx + sway * 0.35) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      if (p.y > h * 0.88) {
        p.vy *= 0.92;
        p.vx *= 0.96;
        p.alpha *= 0.995;
      }
    }
  }

  draw(ctx) {
    // Draw far → mid → near without sorting every frame
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < this.list.length; i++) {
        const p = this.list[i];
        if (p.layer !== layer) continue;

        const lifeT = p.life / p.maxLife;
        let a = p.alpha;
        if (lifeT < 0.08) a *= lifeT / 0.08;
        if (lifeT > 0.72) a *= 1 - (lifeT - 0.72) / 0.28;

        const depthFade = clamp(0.45 + p.depth * 0.55, 0.35, 1);
        a *= depthFade;

        const spr = p.sprite;
        const scaleMul = 0.7 + p.depth * 0.35;
        const sw = spr.width * p.scale * scaleMul;
        const sh = spr.height * p.scale * scaleMul;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, a);
        ctx.drawImage(spr, -sw / 2, -sh / 2, sw, sh);
        ctx.restore();
      }
    }
  }

  get count() {
    return this.list.length;
  }
}
