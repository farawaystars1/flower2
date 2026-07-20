/**
 * 寄语已关闭（不再显示中间文案）
 */
export const DEDICATION = {
  to: "",
  line: "",
  date: "",
};

export function mountDedication(root) {
  const el = document.createElement("div");
  el.id = "dedication";
  el.setAttribute("aria-hidden", "true");
  el.style.display = "none";
  root.appendChild(el);
  return el;
}

export class DedicationController {
  constructor(el) {
    this.el = el;
    this.enabled = false;
    this.visible = false;
    this.shownOnce = true; // treat as already handled
    this.cooldown = 0;
    this.hideTimer = 0;
  }

  show() {
    /* disabled */
  }

  update() {
    /* disabled */
  }

  hide() {
    /* disabled */
  }
}
