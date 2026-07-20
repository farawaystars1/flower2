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

function varietyProfile(kind) {
  if (kind === "peony") {
    return {
      layers: 4,
      widthMul: 1.2,
      lengthMul: 0.92,
      openMul: 1.08,
      tipIvory: 0.5,
    };
  }
  if (kind === "sakura") {
    return {
      layers: 3,
      widthMul: 0.85,
      lengthMul: 1.12,
      openMul: 0.95,
      tipIvory: 0.55,
    };
  }
  return {
    layers: 4,
    widthMul: 1,
    lengthMul: 1,
    openMul: 1,
    tipIvory: 0.4,
  };
}

/**
 * Soft painted bloom — rose / peony / sakura micro-variants.
 */
export class SoftBloom {
  constructor(x, y, { scale = 1, petalCount = 14, variety = "rose", openDelay = 0 } = {}) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.variety = variety;
    this.open = 0;
    this.targetOpen = 1;
    this.openDelay = openDelay;
    this.age = 0;
    this.lifetime = 11;
    this.fadeStart = 7.5;
    this.alive = true;
    this.rot = rand(-0.2, 0.2);
    this.spin = rand(-0.08, 0.08);
    this.glow = 0;
    this.coreFlash = 0; // Wave2 golden heart flash
    this.petals = [];

    const profile = varietyProfile(variety);
    const layers = profile.layers;

    for (let layer = 0; layer < layers; layer++) {
      const count =
        layer === 0
          ? 5
          : layer === 1
            ? 7
            : layer === 2
              ? variety === "sakura"
                ? 6
                : 8
              : Math.max(5, petalCount - 12);
      const baseR = 6 + layer * 9;
      for (let i = 0; i < count; i++) {
        const tint = petalTint(0.08 + layer * 0.18 + rand(0, 0.2));
        this.petals.push({
          angle: (i / count) * Math.PI * 2 + layer * 0.42 + rand(-0.14, 0.14),
          delay: layer * 0.07 + i * 0.01,
          closedTilt: 0.12 + layer * 0.02,
          openTilt: (0.48 + layer * 0.26 + rand(0, 0.14)) * profile.openMul,
          length: (22 + layer * 13 + rand(-4, 6) + baseR * 0.15) * scale * profile.lengthMul,
          width: (14 + layer * 5.5 + rand(-2, 4)) * scale * profile.widthMul,
          tint,
          tip: mixRGB(tint, COLORS.ivory, profile.tipIvory + rand(0, 0.25)),
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

    if (this.age >= this.openDelay && this.open < this.targetOpen) {
      this.open = Math.min(this.targetOpen, this.open + dt * 1.55);
    }
    this.glow = easeOutCubic(clamp(this.open * 1.4, 0, 1));

    // Golden core flash peaks just after opening begins
    if (this.open > 0.15 && this.open < 0.85) {
      this.coreFlash = Math.min(1, this.coreFlash + dt * 2.2);
    } else {
      this.coreFlash = Math.max(0, this.coreFlash - dt * 1.1);
    }

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

    if (glowSprite) {
      const gs = 90 * this.scale * (0.5 + this.glow * 0.8);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = a * 0.45 * this.glow;
      ctx.drawImage(glowSprite, -gs / 2, -gs / 2, gs, gs);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = a;
    }

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

    // Center + golden flash
    const cr = 5 * this.scale * (0.4 + this.glow * 0.6);
    const flash = this.coreFlash;
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, cr * (2.2 + flash * 1.4));
    cg.addColorStop(0, rgba(COLORS.ivory, (0.95 + flash * 0.05) * a));
    cg.addColorStop(0.35, rgba(COLORS.gold, (0.55 + flash * 0.35) * a));
    cg.addColorStop(1, rgba(COLORS.wine, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, cr * (2.2 + flash * 1.4), 0, Math.PI * 2);
    ctx.fill();

    if (flash > 0.05) {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = a * flash * 0.55;
      ctx.fillStyle = rgba(COLORS.gold, 1);
      ctx.beginPath();
      ctx.arc(0, 0, cr * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.restore();
  }

  _drawPetal(ctx, p, tilt, stretch, e) {
    const len = p.length * stretch;
    const wid = p.width * (0.7 + e * 0.35);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-wid * 0.55, -len * 0.25 * tilt, -wid * 0.7, -len * 0.65, 0, -len);
    ctx.bezierCurveTo(wid * 0.7, -len * 0.65, wid * 0.55, -len * 0.25 * tilt, 0, 0);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, -len);
    grad.addColorStop(0, rgba(p.root, 0.92));
    grad.addColorStop(0.5, rgba(p.tint, 0.82));
    grad.addColorStop(1, rgba(p.tip, 0.55));
    ctx.fillStyle = grad;
    ctx.fill();

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

  pickVariety() {
    const r = Math.random();
    if (r < 0.62) return "rose";
    if (r < 0.82) return "peony";
    return "sakura";
  }

  tryBloom(x, y, quality = "high", { cluster = false } = {}) {
    if (this.cooldown > 0 && !cluster) return null;
    this.cooldown = cluster ? 0.28 : 0.16;

    const mainScale = quality === "low" ? rand(0.7, 1.0) : rand(0.85, 1.35);
    const petals = quality === "low" ? randInt(10, 13) : randInt(13, 18);
    const variety = this.pickVariety();
    const main = new SoftBloom(x, y, {
      scale: mainScale,
      petalCount: petals,
      variety,
      openDelay: 0,
    });
    this.blooms.push(main);

    // Staggered side blooms
    let extras = quality === "low" ? 0 : Math.random() > 0.35 ? randInt(1, 2) : 0;
    if (cluster) extras = quality === "low" ? 3 : randInt(4, 6);

    for (let i = 0; i < extras; i++) {
      const ang = rand(0, Math.PI * 2);
      const dist = cluster ? rand(40, 95) : rand(35, 70);
      const sub = new SoftBloom(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist * 0.75, {
        scale: cluster ? rand(0.35, 0.65) : rand(0.4, 0.7),
        petalCount: randInt(9, 13),
        variety: this.pickVariety(),
        openDelay: 0.08 + i * 0.1,
      });
      this.blooms.push(sub);
    }

    while (this.blooms.length > this.maxBlooms) {
      this.blooms.shift();
    }

    return { x, y, intensity: mainScale, variety };
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
 * Midground garden with breathing open amount + occasional soft self-bloom pulse.
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
        baseOpen: rand(0.55, 0.9),
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
      breathSpeed: rand(0.35, 0.7),
      pulse: 0,
      nextPulse: rand(8, 18),
    });
  }
  return list;
}

export function updateMidSilhouettes(list, dt, time) {
  for (const m of list) {
    m.nextPulse -= dt;
    if (m.nextPulse <= 0) {
      m.pulse = 1;
      m.nextPulse = rand(10, 22);
    }
    if (m.pulse > 0) m.pulse = Math.max(0, m.pulse - dt * 0.55);
  }
}

export function drawMidSilhouettes(ctx, list, time, parallax, windX = 0) {
  for (const m of list) {
    // Breathing open 5–12%
    const breathOpen = 1 + Math.sin(time * m.breathSpeed + m.phase) * 0.08;
    const pulseOpen = 1 + m.pulse * 0.18;
    const sway = Math.sin(time * 0.55 + m.phase) * 6 + windX * 4;
    const x = m.x + parallax * 0.3 + sway;
    const y = m.y + Math.sin(time * 0.4 + m.phase) * 4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(m.rot + sway * 0.012 + windX * 0.04);
    ctx.globalAlpha =
      m.alpha * (0.85 + Math.sin(time * 0.6 + m.phase) * 0.15) * (1 + m.pulse * 0.25);
    if (m.blur > 0.7) ctx.filter = "blur(1.2px)";

    for (const p of m.petals) {
      ctx.save();
      ctx.rotate(p.angle);
      const len = p.length * m.scale * p.baseOpen * breathOpen * pulseOpen;
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
    cg.addColorStop(0, rgba(COLORS.ivory, 0.35 + m.pulse * 0.25));
    cg.addColorStop(0.45, rgba(COLORS.blush, 0.12));
    cg.addColorStop(1, rgba(COLORS.gold, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, 14 * m.scale * (1 + m.pulse * 0.15), 0, Math.PI * 2);
    ctx.fill();

    ctx.filter = "none";
    ctx.restore();
  }
}
