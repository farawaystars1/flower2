import { clamp, lerp, rand } from "./utils.js?v=20260720d";

/**
 * Wave4 director: color shift, micro-camera, idle events, bloom-egg tracking.
 */
export class SceneDirector {
  constructor() {
    this.colorT = 0; // 0→1 over ~90s
    this.dustBoost = 0;
    this.vignette = 0.42;
    this.cam = { x: 0, y: 0, scale: 1 };
    this.nextEventAt = 14;
    this.eggPoints = [];
    this.eggCooldown = 0;
  }

  /** Progress rose-gold warmth over long dwell */
  updateColor(dt) {
    this.colorT = Math.min(1, this.colorT + dt / 90);
  }

  /** Warmth mix: wine → rose-gold (subtle canvas tint) */
  getWarmth() {
    // returns { r,g,b,a } overlay strength
    const t = this.colorT;
    return {
      r: lerp(255, 255, t),
      g: lerp(140, 175, t),
      b: lerp(130, 150, t),
      a: 0.018 + t * 0.022,
    };
  }

  updateCamera(time, dt) {
    // Micro handheld feel <0.4% scale
    this.cam.x = Math.sin(time * 0.11) * 3.2 + Math.sin(time * 0.27) * 1.2;
    this.cam.y = Math.cos(time * 0.09) * 2.4 + Math.sin(time * 0.19) * 1.0;
    this.cam.scale = 1 + Math.sin(time * 0.13) * 0.0035;
  }

  applyCamera(ctx, w, h, dpr = 1) {
    // Keep devicePixelRatio — resetting to identity caused a half-screen seam on HiDPI.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(w / 2 + this.cam.x, h / 2 + this.cam.y);
    ctx.scale(this.cam.scale, this.cam.scale);
    ctx.translate(-w / 2, -h / 2);
  }

  /** Reset to CSS-pixel space (with dpr) for full-screen overlays */
  resetView(ctx, dpr = 1) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  updateDustBoost(dt) {
    if (this.dustBoost > 0) this.dustBoost = Math.max(0, this.dustBoost - dt * 0.35);
  }

  getDustMul() {
    return 1 + this.dustBoost * 0.9;
  }

  /**
   * Schedule idle micro-events.
   * @returns {'selfBloom'|'petalSurge'|'dustBright'|null}
   */
  tickEvents(dt, introDone) {
    if (!introDone) return null;
    if (this.eggCooldown > 0) this.eggCooldown -= dt;

    this.nextEventAt -= dt;
    if (this.nextEventAt > 0) return null;

    this.nextEventAt = rand(12, 20);
    const r = Math.random();
    if (r < 0.4) return "selfBloom";
    if (r < 0.75) return "petalSurge";
    return "dustBright";
  }

  triggerDustBright() {
    this.dustBoost = 1;
  }

  /**
   * Track bloom points for easter egg (arc / loose heart).
   * @returns {boolean} true if egg should fire
   */
  registerBloom(x, y) {
    if (this.eggCooldown > 0) return false;
    this.eggPoints.push({ x, y, t: performance.now() });
    // keep recent 3 within 8s
    const now = performance.now();
    this.eggPoints = this.eggPoints.filter((p) => now - p.t < 8000).slice(-3);

    if (this.eggPoints.length < 3) return false;

    const [a, b, c] = this.eggPoints;
    if (this._isSoftArc(a, b, c) || this._isLooseHeart(a, b, c)) {
      this.eggPoints = [];
      this.eggCooldown = 25;
      return true;
    }
    return false;
  }

  _isSoftArc(a, b, c) {
    // Middle point sits above the chord — gentle smile / arc
    const midY = (a.y + c.y) / 2;
    const span = Math.hypot(c.x - a.x, c.y - a.y);
    if (span < 80 || span > 420) return false;
    const above = b.y < midY - 18;
    const betweenX = b.x > Math.min(a.x, c.x) - 20 && b.x < Math.max(a.x, c.x) + 20;
    return above && betweenX;
  }

  _isLooseHeart(a, b, c) {
    // Rough: two high points + one lower center-ish
    const pts = [a, b, c].sort((p, q) => p.y - q.y);
    const top1 = pts[0];
    const top2 = pts[1];
    const bottom = pts[2];
    const topDist = Math.hypot(top1.x - top2.x, top1.y - top2.y);
    const midX = (top1.x + top2.x) / 2;
    return (
      topDist > 40 &&
      topDist < 220 &&
      bottom.y > top1.y + 40 &&
      Math.abs(bottom.x - midX) < 90
    );
  }

  /** Adaptive vignette based on recent bloom activity */
  setActivity(level) {
    // level 0–1
    this.vignette = lerp(0.5, 0.32, clamp(level, 0, 1));
  }
}
