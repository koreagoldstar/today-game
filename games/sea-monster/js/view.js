/*
 * 바다괴물 탐험대 · 화면
 * 논리 너비 540 고정, 높이는 휴대폰 비율에 맞춰 960~1180 (세로 9:16 중심).
 * 바닷속 세계는 화면보다 크고, 카메라가 지혁을 따라간다 (화면 = world - cam).
 */
export const W = 540;
export let H = 960;

export function setLogicalHeight(h) {
  H = Math.round(Math.max(960, Math.min(1180, h)));
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

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
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
/** 각도 보간 (가까운 쪽으로 돈다) */
export function angLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * t;
}

/** 정해진 씨앗으로 같은 난수열 (스테이지 배경을 매번 똑같이) */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** 정수 두 개 → 0~1 (매 프레임 같은 자리에 같은 값) */
export function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}

/** 1:05 */
export function fmtSec(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 오늘 날짜 키 (기기 시간) 2026-10-08 */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
