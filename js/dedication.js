/**
 * 寄语配置 — 语气自然、克制，像一起看一场花开
 */
export const DEDICATION = {
  to: "", // 可留空；若填写会显示在寄语上方
  line: "愿与你共赏这一季花开",
  date: "",
};

export function mountDedication(root) {
  const el = document.createElement("div");
  el.id = "dedication";
  el.setAttribute("aria-hidden", "true");

  if (DEDICATION.to) {
    const to = document.createElement("p");
    to.className = "ded-to";
    to.textContent = DEDICATION.to;
    el.appendChild(to);
  }

  const line = document.createElement("p");
  line.className = "ded-line";
  line.textContent = DEDICATION.line;
  el.appendChild(line);

  if (DEDICATION.date) {
    const date = document.createElement("p");
    date.className = "ded-date";
    date.textContent = DEDICATION.date;
    el.appendChild(date);
  }

  root.appendChild(el);
  return el;
}

/**
 * Soft show / hide of dedication overlay.
 */
export class DedicationController {
  constructor(el) {
    this.el = el;
    this.visible = false;
    this.shownOnce = false;
    this.cooldown = 0;
    this.hideTimer = 0;
  }

  show(duration = 5.5) {
    if (!this.el || this.cooldown > 0) return;
    this.el.classList.add("show");
    this.visible = true;
    this.shownOnce = true;
    this.hideTimer = duration;
    this.cooldown = 18;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.hideTimer > 0) {
      this.hideTimer -= dt;
      if (this.hideTimer <= 0) this.hide();
    }
  }

  hide() {
    if (!this.el) return;
    this.el.classList.remove("show");
    this.visible = false;
    this.hideTimer = 0;
  }
}
