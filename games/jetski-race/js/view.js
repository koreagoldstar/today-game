/*
 * 제트스키 썬더 레이스 · 화면
 * 논리 너비 540 고정, 높이는 휴대폰 비율에 맞춰 960~1180 (세로 9:16 중심).
 * 바다(수평선)와 제트스키 위치는 높이에 비례해서 정한다 → 어떤 화면에서도 같은 구도.
 */
export const W = 540;
export let H = 960;
/** 수평선 높이 (화면 위에서) */
export let HZ = 340;
/** 내 제트스키가 물에 닿는 화면 높이 */
export let PY = 760;

export function setLogicalHeight(h) {
  H = Math.round(Math.max(960, Math.min(1180, h)));
  HZ = Math.round(H * 0.355);
  PY = Math.round(H * 0.8);
  return H;
}

/** 캔버스를 화면에 맞추고 선명하게 (DPR 최대 2) */
export function setupCanvas(canvas, host, onResize) {
  const ctx = canvas.getContext("2d");
  let scale = 1;
  let dpr = 1;
  function resize() {
    const box = host.getBoundingClientRect();
    const before = H;
    if (box.width > 0 && box.height > 0) setLogicalHeight((W * box.height) / box.width);
    const fit = Math.min(box.width / W, box.height / H);
    scale = fit;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = `${Math.round(W * fit)}px`;
    canvas.style.height = `${Math.round(H * fit)}px`;
    canvas.width = Math.round(W * fit * dpr);
    canvas.height = Math.round(H * fit * dpr);
    ctx.setTransform(fit * dpr, 0, 0, fit * dpr, 0, 0);
    if (onResize) onResize(H, before !== H);
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 200));
  return {
    ctx,
    resize,
    toLogical(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
    },
    get scale() {
      return scale;
    },
    get pixel() {
      return scale * dpr;
    },
    resetTransform() {
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    },
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  back: (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

/** 정해진 씨앗으로 같은 난수열 (코스 배경을 매번 똑같이) */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** 정수 두 개 → 0~1 (물결 무늬처럼 매 프레임 같은 자리에 같은 값) */
export function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}

/** 시간 표시 00:37.82 */
export function fmtTime(ms) {
  if (ms == null || !Number.isFinite(ms)) return "--:--.--";
  const t = Math.max(0, Math.round(ms / 10));
  const cs = t % 100;
  const s = Math.floor(t / 100) % 60;
  const m = Math.floor(t / 6000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
