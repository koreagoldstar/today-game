/*
 * 바다괴물 탐험대 — 그림 캐시
 * 움직이지 않는 풍경(바위 · 산호 · 벽 · 모래)은 한 번만 그려서 화면 해상도에 맞는 캔버스로 들고 다닌다.
 */
const cache = new Map();
let pixel = 1;

/** 화면 실제 배율 (캔버스 픽셀 / 논리 픽셀) — 바뀌면 캐시를 비운다 */
export function setPixel(p) {
  const v = Math.max(0.5, Math.min(2.4, Math.round(p * 4) / 4));
  if (v !== pixel) {
    pixel = v;
    cache.clear();
  }
}

/**
 * key 로 캐시. draw(ctx) 는 (ax, ay) 를 원점으로 그린다. 그림 상자 = w x h (논리 픽셀)
 * 돌려주는 값: { c(canvas), w, h, ax, ay }
 */
export function sprite(key, w, h, ax, ay, draw) {
  let s = cache.get(key);
  if (s) return s;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w * pixel));
  c.height = Math.max(1, Math.ceil(h * pixel));
  const x = c.getContext("2d");
  x.scale(pixel, pixel);
  x.translate(ax, ay);
  draw(x);
  s = { c, w, h, ax, ay };
  cache.set(key, s);
  return s;
}

/** 캐시한 그림을 (x, y) 에 원점이 오도록 */
export function put(ctx, s, x, y, scale = 1) {
  ctx.drawImage(s.c, x - s.ax * scale, y - s.ay * scale, s.w * scale, s.h * scale);
}

export function clearSprites() {
  cache.clear();
}
