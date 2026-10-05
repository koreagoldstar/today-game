/*
 * 물총 대작전 엔진 · 화면/원근
 * 논리 해상도 540x960 (9:16). 바다는 수평선(HORIZON)에서 앞쪽(NEAR_Y)으로 원근이 들어간다.
 * 월드 좌표: x(-1~1 좌우), z(0 수평선 ~ 1 보트 바로 앞), h(물 위 높이 px)
 */
export const W = 540;
// 세로로 긴 휴대폰에서는 화면을 꽉 채우도록 논리 높이를 960~1180 사이에서 늘린다 (ES 모듈 live binding)
export let H = 960;
export let HORIZON = 300;
export let NEAR_Y = 770;
export const BOAT = { x: W / 2, y: 850 };

export function setLogicalHeight(h) {
  H = Math.round(Math.max(960, Math.min(1180, h)));
  const extra = H - 960;
  HORIZON = 300 + Math.round(extra * 0.42);
  NEAR_Y = 770 + extra;
  BOAT.y = 850 + extra;
  return H;
}

/** 월드 → 화면 */
export function project(x, z, h = 0) {
  const zz = Math.max(-0.05, Math.min(1.15, z));
  const s = 0.4 + 0.82 * zz;
  const sy = HORIZON + 18 + (NEAR_Y - HORIZON - 18) * Math.pow(zz, 1.12);
  const spread = W * 0.44 * (0.55 + 0.45 * zz);
  return { sx: W / 2 + x * spread, sy: sy - h * s, s };
}

/** 화면 y → 깊이 z (조준점이 얼마나 멀리 있는지) */
export function depthAt(sy) {
  const t = (sy - HORIZON - 18) / (NEAR_Y - HORIZON - 18);
  return Math.max(0, Math.min(1.15, Math.pow(Math.max(0, t), 1 / 1.12)));
}

/** 캔버스를 화면에 9:16 으로 맞추고 선명하게 (DPR) */
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
    if (onResize && before !== H) onResize(H);
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 200));
  return {
    ctx,
    resize,
    /** 화면 좌표 → 논리 좌표 */
    toLogical(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
    },
    get scale() {
      return scale;
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
export const ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  elastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

/** 정해진 씨앗으로 같은 난수열 (스테이지 음악·배경을 매번 똑같이) */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
