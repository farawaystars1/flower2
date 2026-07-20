export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export function easeOutBack(t) {
  const c1 = 1.45;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function easeInOutSoft(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function rand(min = 0, max = 1) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

/** Soft romantic palette stops */
export const COLORS = {
  wine: [110, 28, 48],
  crimson: [168, 48, 72],
  rose: [210, 100, 120],
  blush: [236, 170, 178],
  petal: [248, 210, 214],
  ivory: [255, 240, 232],
  gold: [220, 170, 120],
};

export function mixRGB(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

export function rgba(rgb, a) {
  return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
}

/** Pick a romantic petal tint */
export function petalTint(t = Math.random()) {
  if (t < 0.25) return mixRGB(COLORS.wine, COLORS.crimson, t / 0.25);
  if (t < 0.55) return mixRGB(COLORS.crimson, COLORS.rose, (t - 0.25) / 0.3);
  if (t < 0.8) return mixRGB(COLORS.rose, COLORS.blush, (t - 0.55) / 0.25);
  return mixRGB(COLORS.blush, COLORS.petal, (t - 0.8) / 0.2);
}

export function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function fbm(x, y) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 3; i++) {
    const xi = Math.floor(x * f);
    const yi = Math.floor(y * f);
    const xf = x * f - xi;
    const yf = y * f - yi;
    const u = xf * xf * (3 - 2 * xf);
    const vv = yf * yf * (3 - 2 * yf);
    const n =
      lerp(
        lerp(hash2(xi, yi), hash2(xi + 1, yi), u),
        lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u),
        vv
      );
    v += n * a;
    a *= 0.5;
    f *= 2;
  }
  return v;
}
