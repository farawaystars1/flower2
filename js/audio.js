/**
 * Procedural soft audio via Web Audio API (no external files).
 * Unlocks on first user gesture.
 */
export class SoftAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.unlocked = false;
    this.windNodes = null;
    this.windGain = null;
  }

  async unlock() {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.ctx.destination);
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.unlocked = true;
      this._startWind();
    } catch {
      // Audio unavailable — silent fail
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.22, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _startWind() {
    if (!this.ctx || this.windNodes) return;

    // Soft noise buffer
    const len = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.6;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.045;

    src.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.master);
    src.start();
    this.windNodes = { src, filter };

    // Gentle wind swell LFO via gain automation loop
    const swell = () => {
      if (!this.windGain || !this.ctx) return;
      const t = this.ctx.currentTime;
      const target = 0.03 + Math.random() * 0.035;
      this.windGain.gain.linearRampToValueAtTime(target, t + 2.5 + Math.random() * 2);
      setTimeout(swell, 2800 + Math.random() * 2000);
    };
    swell();
  }

  /** Soft bloom chime */
  playBloom(intensity = 1) {
    if (!this.unlocked || !this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const freqs = [392, 523.25, 659.25]; // G4 C5 E5 soft triad hint

    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f * (0.98 + Math.random() * 0.04);
      g.gain.value = 0;
      osc.connect(g);
      g.connect(this.master);

      const start = t + i * 0.04;
      const peak = 0.035 * intensity * (1 - i * 0.2);
      g.gain.linearRampToValueAtTime(peak, start + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.55 + i * 0.08);
      osc.start(start);
      osc.stop(start + 0.7);
    });
  }
}

export function mountMuteButton(root, audio) {
  const btn = document.createElement("button");
  btn.id = "mute-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "静音");
  btn.textContent = "音";
  btn.title = "声音";

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await audio.unlock();
    const muted = audio.toggleMute();
    btn.classList.toggle("muted", muted);
    btn.textContent = muted ? "静" : "音";
  });

  root.appendChild(btn);
  return btn;
}
