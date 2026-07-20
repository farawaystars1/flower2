import {
  clamp,
  easeOutBack,
  easeOutCubic,
  lerp,
  mixRGB,
  petalTint,
  rand,
  randInt,
  rgba,
  COLORS,
} from "./utils.js";

/**
 * Soft painted rose bloom — layered translucent petals, not hard 3D mesh.
 */
export class SoftBloom {
  constructor(x, y, { scale = 1, petalCount = 14 } = {}) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.open = 0;
    this.targetOpen = 1;
    this.age = 0;
    this.lifetime = 11;
    this.fadeStart = 7.5;
    this.alive = true;
    this.rot = rand(-0.2, 0.2);
    this.spin = rand(-0.08, 0.08);
    this.glow = 0;
    this.petals = [];

    const layers = 4;
    for (let layer = 0; layer < layers; layer++) {
      const count = layer === 0 ? 5 : layer === 1 ? 7 : layer === 2 ? 8 : Math.max(5, petalCount - 12);
      const baseR = 6 + layer * 9;
      for (let i = 0; i < count; i++) {
        const tint = petalTint(0.08 + layer * 0.18 + rand(0, 0.2));
        this.petals.push({
          angle: (i / count) * Math.PI * 2 + layer * 0.42 + rand(-0.12, 0.12),
          delay: layer * 0.07 + i * 0.01,
          closedTilt: 0.12 + layer * 0.02,
          openTilt: 0.48 + layer * 0.26 + rand(0, 0.14),
          length: (22 + layer * 13 + rand(-4, 6) + baseR * 0.15) * scale,
          width: (14 + layer * 5.5 + rand(-2, 4)) * scale,
          tint,
          tip: mixRGB(tint, COLORS.ivory, 0.35 + rand(0, 0.3)),
          root: mixRGB(tint, COLORS.wine, 0.3 + rand(0, 0.2)),
          wobble: rand(0, Math.PI * 2),
          layer,
        });
      }
    }
  }

  update(dt) {
    if (!this.alive) return false;
    this.age += dt;
    this.rot += this.spin * dt;

    if (this.open < this.targetOpen) {
      this.open = Math.min(this.targetOpen, this.open + dt * 1.55);
    }
    this.glow = easeOutCubic(clamp(this.open * 1.4, 0, 1));

    if (this.age > this.fadeStart) {
      const fade = 1 - (this.age - this.fadeStart) / (this.lifetime - this.fadeStart);
      if (fade <= 0) {
        this.alive = false;
        return false;
      }
    }
    return true;
  }

  get alpha() {
    if (this.age <= this.fadeStart) return 1;
    return clamp(1 - (this.age - this.fadeStart) / (this.lifetime - this.fadeStart), 0, 1);
  }

  draw(ctx, glowSprite) {
    const a = this.alpha;
    if (a <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.globalAlpha = a;

    // Soft backlight glow
    if (glowSprite) {
      const gs = 90 * this.scale * (0.5 + this.glow * 0.8);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = a * 0.45 * this.glow;
      ctx.drawImage(glowSprite, -gs / 2, -gs / 2, gs, gs);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = a;
    }

    // Draw petals back-to-front (outer layers first visually by open order)
    for (const p of this.petals) {
      const local = clamp((this.open - p.delay) / 0.85, 0, 1);
      if (local <= 0) continue;
      const e = easeOutBack(local);
      const tilt = lerp(p.closedTilt, p.openTilt, e);
      const stretch = 0.35 + e * 0.65;
      p.wobble += 0.01;

      ctx.save();
      ctx.rotate(p.angle + Math.sin(p.wobble) * 0.03);
      this._drawPetal(ctx, p, tilt, stretch, e);
      ctx.restore();
    }

    // Center
    const cr = 5 * this.scale * (0.4 + this.glow * 0.6);
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, cr * 2.2);
    cg.addColorStop(0, rgba(COLORS.ivory, 0.95 * a));
    cg.addColorStop(0.4, rgba(COLORS.gold, 0.55 * a));
    cg.addColorStop(1, rgba(COLORS.wine, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, cr * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawPetal(ctx, p, tilt, stretch, e) {
    const len = p.length * stretch;
    const wid = p.width * (0.7 + e * 0.35);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(
      -wid * 0.55,
      -len * 0.25 * tilt,
      -wid * 0.7,
      -len * 0.65,
      0,
      -len
    );
    ctx.bezierCurveTo(
      wid * 0.7,
      -len * 0.65,
      wid * 0.55,
      -len * 0.25 * tilt,
      0,
      0
    );
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, -len);
    grad.addColorStop(0, rgba(p.root, 0.92));
    grad.addColorStop(0.5, rgba(p.tint, 0.82));
    grad.addColorStop(1, rgba(p.tip, 0.55));
    ctx.fillStyle = grad;
    ctx.fill();

    // Soft highlight along tip
    ctx.globalCompositeOperation = "screen";
    const hl = ctx.createRadialGradient(0, -len * 0.55, 0, 0, -len * 0.4, len * 0.55);
    hl.addColorStop(0, rgba(COLORS.ivory, 0.35 * e));
    hl.addColorStop(1, rgba(COLORS.ivory, 0));
    ctx.fillStyle = hl;
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
}

/**
 * Manage bloom instances + click cooldown.
 */
export class BloomGarden {
  constructor(glowSprite) {
    this.glowSprite = glowSprite;
    this.blooms = [];
    this.cooldown = 0;
    this.maxBlooms = 12;
  }

  tryBloom(x, y, quality = "high") {
    if (this.cooldown > 0) return null;
    this.cooldown = 0.16;

    const mainScale = quality === "low" ? rand(0.7, 1.0) : rand(0.85, 1.35);
    const petals = quality === "low" ? randInt(10, 13) : randInt(13, 18);
    const main = new SoftBloom(x, y, { scale: mainScale, petalCount: petals });
    this.blooms.push(main);

    const extras = quality === "low" ? 0 : Math.random() > 0.4 ? randInt(1, 2) : 0;
    for (let i = 0; i < extras; i++) {
      const sub = new SoftBloom(
        x + rand(-55, 55),
        y + rand(-35, 40),
        { scale: rand(0.4, 0.7), petalCount: randInt(9, 13) }
      );
      this.blooms.push(sub);
    }

    while (this.blooms.length > this.maxBlooms) {
      this.blooms.shift();
    }

    return { x, y, intensity: mainScale };
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    for (let i = this.blooms.length - 1; i >= 0; i--) {
      if (!this.blooms[i].update(dt)) this.blooms.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const b of this.blooms) b.draw(ctx, this.glowSprite);
  }
}

/**
 * Distant soft silhouette blooms for midground atmosphere.
 * Intentionally soft and irregular — avoid crisp icon look.
 */
export function createMidSilhouettes(w, h, count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const petalN = randInt(8, 14);
    const petals = [];
    const tint = petalTint(rand(0.15, 0.75));
    for (let p = 0; p < petalN; p++) {
      petals.push({
        angle: (p / petalN) * Math.PI * 2 + rand(-0.35, 0.35),
        length: rand(14, 42),
        width: rand(10, 26),
        open: rand(0.55, 1),
        tint: mixRGB(tint, COLORS.wine, rand(0, 0.3)),
        tip: mixRGB(tint, COLORS.ivory, 0.4 + rand(0, 0.25)),
      });
    }
    list.push({
      x: rand(w * 0.04, w * 0.96),
      y: rand(h * 0.3, h * 0.82),
      scale: rand(0.5, 1.2),
      alpha: rand(0.14, 0.3),
      phase: rand(0, Math.PI * 2),
      rot: rand(-0.4, 0.4),
      petals,
      blur: rand(0.4, 1),
    });
  }
  return list;
}

export function drawMidSilhouettes(ctx, list, time, parallax) {
  for (const m of list) {
    const sway = Math.sin(time * 0.55 + m.phase) * 6;
    const x = m.x + parallax * 0.3 + sway;
    const y = m.y + Math.sin(time * 0.4 + m.phase) * 4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(m.rot + sway * 0.01);
    ctx.globalAlpha = m.alpha * (0.85 + Math.sin(time * 0.6 + m.phase) * 0.15);
    if (m.blur > 0.7) ctx.filter = "blur(1.2px)";

    for (const p of m.petals) {
      ctx.save();
      ctx.rotate(p.angle);
      const len = p.length * m.scale * p.open;
      const wid = p.width * m.scale;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.bezierCurveTo(-wid * 0.55, -len * 0.22, -wid * 0.7, -len * 0.62, 0, -len);
      ctx.bezierCurveTo(wid * 0.7, -len * 0.62, wid * 0.55, -len * 0.22, 0, 2);
      const g = ctx.createLinearGradient(0, 0, 0, -len);
      g.addColorStop(0, rgba(p.tint, 0.75));
      g.addColorStop(0.55, rgba(p.tint, 0.45));
      g.addColorStop(1, rgba(p.tip, 0.2));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }

    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 14 * m.scale);
    cg.addColorStop(0, rgba(COLORS.ivory, 0.35));
    cg.addColorStop(0.45, rgba(COLORS.blush, 0.12));
    cg.addColorStop(1, rgba(COLORS.gold, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, 14 * m.scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.filter = "none";
    ctx.restore();
  }
}
