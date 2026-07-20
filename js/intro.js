import { clamp, easeOutCubic } from "./utils.js?v=20260720d";

/**
 * Opening ceremony: warm fog → first bloom → petals → ready.
 * Skippable by pointer during intro.
 */
export class IntroCeremony {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.curtain
   * @param {HTMLElement} opts.hint
   * @param {Function} opts.onFirstBloom  (x, y) => void
   * @param {Function} opts.onComplete
   * @param {() => {w:number,h:number}} opts.getSize
   */
  constructor({ curtain, hint, onFirstBloom, onComplete, getSize }) {
    this.curtain = curtain;
    this.hint = hint;
    this.onFirstBloom = onFirstBloom;
    this.onComplete = onComplete;
    this.getSize = getSize;

    this.active = true;
    this.t = 0;
    this.bloomed = false;
    this.completed = false;

    // Phase timings (seconds)
    this.tFog = 1.2;
    this.tBloom = 2.0;
    this.tPetals = 3.2;
    this.tEnd = 5.0;

    if (this.hint) {
      this.hint.style.animation = "none";
      this.hint.style.opacity = "0";
    }
    if (this.curtain) {
      this.curtain.classList.add("active");
    }
  }

  skip() {
    if (this.completed) return;
    // Allow skip even if temporarily paused (e.g. mobile start-gate)
    this.active = true;
    this._finish(true);
  }

  update(dt) {
    if (!this.active || this.completed) return;
    this.t += dt;

    const { w, h } = this.getSize();

    // Curtain fade: opaque → transparent over first ~2.5s
    if (this.curtain) {
      const fade = clamp(1 - this.t / 2.6, 0, 1);
      this.curtain.style.opacity = String(easeOutCubic(fade));
    }

    if (!this.bloomed && this.t >= this.tBloom) {
      this.bloomed = true;
      this.onFirstBloom?.(w * 0.5, h * 0.42);
    }

    // Soft side blooms during intro
    if (this.t >= this.tPetals && this.t - dt < this.tPetals) {
      this.onFirstBloom?.(w * 0.38, h * 0.5);
    }

    if (this.t >= this.tEnd) {
      this._finish(false);
    }
  }

  _finish(skipped) {
    if (this.completed) return;
    this.completed = true;
    this.active = false;

    if (this.curtain) {
      this.curtain.style.opacity = "0";
      this.curtain.classList.remove("active");
      setTimeout(() => this.curtain?.remove(), 800);
    }

    if (this.hint) {
      this.hint.classList.add("reveal");
      setTimeout(() => this.hint?.classList.add("fade"), 4200);
    }

    if (skipped) {
      const { w, h } = this.getSize();
      if (!this.bloomed) this.onFirstBloom?.(w * 0.5, h * 0.42);
    }

    this.onComplete?.();
  }
}
