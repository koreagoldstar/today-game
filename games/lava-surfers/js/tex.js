/*
 * 용암 서핑 · 코드로 그리는 텍스처 (이미지 파일 없음)
 *  화산재 덮인 검은 경사면 · 층층 화산암 절벽 · 흐르는 용암 · 빛 알갱이 · 연기 · 부스터 화살표
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
export function makeNoise(seed, size = 64) {
  const rnd = seeded(seed);
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const wrap = (v, P) => ((v % P) + P) % P;
  const at = (x, y) => g[(y % size) * size + (x % size)];
  const smooth = (t) => t * t * (3 - 2 * t);
  // P: 격자가 P 칸마다 되풀이 → 텍스처 가장자리가 이음매 없이 이어짐
  return (x, y, P = size) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const x0 = wrap(xi, P);
    const y0 = wrap(yi, P);
    const x1 = wrap(xi + 1, P);
    const y1 = wrap(yi + 1, P);
    const a = at(x0, y0);
    const b = at(x1, y0);
    const c = at(x0, y1);
    const d = at(x1, y1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
/** 타일링되는 fBm (0~1) */
export function fbm(noise, x, y, oct = 4, period = 8) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  let tot = 0;
  for (let o = 0; o < oct; o++) {
    v += amp * noise(x * f, y * f, period * f);
    tot += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / tot;
}
const cache = new Map();
function canvasTex(key, w, h, draw, { srgb = true, wrap = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
function pixels(ctx, w, h, fn) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x, y);
      const i = (y * w + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
}
const mix = (a, b, t) => a + (b - a) * t;
const mixC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** 경사면: 검은 화산암 + 회색 화산재 얼룩 + 가늘게 빛나는 틈 (glow=true 면 빛나는 부분만) */
function slopePixels(glowOnly) {
  return (ctx, w, h) => {
    const n1 = makeNoise(301);
    const n2 = makeNoise(307);
    const rnd = seeded(311);
    const cells = [];
    for (let i = 0; i < 26; i++) cells.push([rnd() * w, rnd() * h]);
    pixels(ctx, w, h, (x, y) => {
      let d1 = 1e9;
      let d2 = 1e9;
      let i1 = 0;
      let i2 = 0;
      for (let i = 0; i < cells.length; i++) {
        for (const ox of [-w, 0, w]) {
          for (const oy of [-h, 0, h]) {
            const d = (x - cells[i][0] - ox) ** 2 + (y - cells[i][1] - oy) ** 2;
            if (d < d1) {
              d2 = d1;
              i2 = i1;
              d1 = d;
              i1 = i;
            } else if (d < d2) {
              d2 = d;
              i2 = i;
            }
          }
        }
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      const hot = (Math.min(i1, i2) * 5 + Math.max(i1, i2) * 11) % 5 === 0;
      const a = fbm(n1, (x / w) * 5, (y / h) * 5, 4, 5);
      const g = fbm(n2, (x / w) * 16, (y / h) * 16, 2, 16);
      // 화산재 (밝은 회색) 얼룩
      let c = mixC([44, 38, 42], [128, 118, 116], Math.max(0, (a - 0.48) * 2.6));
      c = c.map((v) => v * (0.85 + g * 0.3));
      // 틈: 가운데는 밝고 바깥으로 부드럽게 (계단처럼 보이지 않게)
      let glow = 0;
      if (hot && edge < 3.2) glow = Math.pow(1 - edge / 3.2, 1.6);
      else if (edge < 1.4) c = c.map((v) => v * (0.55 + edge * 0.2));
      if (glowOnly) return glow ? [255 * glow, 110 * glow, 40 * glow] : [0, 0, 0];
      if (glow) c = mixC(c, [255, 120, 44], glow);
      return c;
    });
  };
}
export function slopeTex() {
  return canvasTex("slope", 256, 256, slopePixels(false));
}
export function slopeGlowTex() {
  return canvasTex("slope-glow", 256, 256, slopePixels(true));
}
/** 절벽: 층층 화산암 (어두운 띠 + 세로 풍화) */
export function cliffTex() {
  return canvasTex("cliff", 256, 256, (ctx, w, h) => {
    const bands = [
      [56, 44, 50],
      [74, 54, 56],
      [44, 36, 42],
      [92, 62, 58],
      [62, 48, 52],
    ];
    const n1 = makeNoise(321);
    const n2 = makeNoise(323);
    const n3 = makeNoise(327);
    pixels(ctx, w, h, (x, y) => {
      const warp = (fbm(n1, (x / w) * 3, (y / h) * 3, 3, 3) - 0.5) * 0.2;
      const t = (y / h + warp) * bands.length;
      const i = Math.floor(t);
      const f = t - i;
      const c0 = bands[((i % 5) + 5) % 5];
      const c1 = bands[(((i + 1) % 5) + 5) % 5];
      const k = Math.max(0, Math.min(1, (f - 0.7) / 0.3));
      let c = mixC(c0, c1, k * k * (3 - 2 * k));
      const g = fbm(n2, (x / w) * 10, (y / h) * 10, 3, 10);
      const st = fbm(n3, (x / w) * 24, (y / h) * 2, 2, 24);
      c = c.map((v) => v * (0.85 + g * 0.25) * (0.92 + st * 0.14));
      // 아래쪽 띠 끝이 용암 빛을 받아 살짝 붉게
      if (f > 0.9) c = mixC(c, [150, 60, 40], (f - 0.9) * 3);
      return c;
    });
  });
}
/** 용암: 굳은 껍질 사이로 흐르는 밝은 줄기 */
export function lavaTex() {
  return canvasTex("lava", 256, 256, (ctx, w, h) => {
    const n1 = makeNoise(331);
    const n2 = makeNoise(337);
    const n3 = makeNoise(339);
    pixels(ctx, w, h, (x, y) => {
      const u = (x / w) * 3;
      const v = (y / h) * 3;
      const q = fbm(n1, u, v, 3, 3);
      const r = fbm(n2, u + q * 2, v + q * 2, 4, 3);
      const vein = Math.max(0, 1 - Math.abs(r - 0.5) / 0.08);
      const glow = Math.max(0, 1 - Math.abs(r - 0.5) / 0.22);
      const g = fbm(n3, (x / w) * 12, (y / h) * 12, 2, 12);
      let c = mixC([70, 24, 20], [200, 56, 22], glow * glow);
      c = c.map((k) => k * (0.85 + g * 0.3));
      if (vein > 0) c = mixC(c, vein > 0.55 ? [255, 236, 150] : [255, 132, 40], Math.min(1, vein * 1.6));
      return c;
    });
  });
}
/** 둥근 빛 (스프라이트) */
export function dotTex() {
  return canvasTex(
    "dot",
    64,
    64,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.35, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { wrap: false }
  );
}
/** 뭉게 연기 (부드러운 덩어리) */
export function puffTex() {
  return canvasTex(
    "puff",
    128,
    128,
    (ctx, w, h) => {
      const rnd = seeded(41);
      for (let i = 0; i < 14; i++) {
        const x = w / 2 + (rnd() - 0.5) * w * 0.45;
        const y = h / 2 + (rnd() - 0.5) * h * 0.45;
        const r = w * (0.14 + rnd() * 0.18);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(255,255,255,0.5)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    },
    { wrap: false }
  );
}
/** 부스터 발판 (화살표 줄무늬) */
export function chevronTex() {
  return canvasTex("chevron", 64, 128, (ctx, w, h) => {
    ctx.fillStyle = "#2a1a1a";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) {
      const y = i * (h / 2) + 10;
      const g = ctx.createLinearGradient(0, y, 0, y + 40);
      g.addColorStop(0, "#fff2a0");
      g.addColorStop(1, "#ff8a2a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(w * 0.1, y + 34);
      ctx.lineTo(w * 0.5, y + 6);
      ctx.lineTo(w * 0.9, y + 34);
      ctx.lineTo(w * 0.72, y + 34);
      ctx.lineTo(w * 0.5, y + 18);
      ctx.lineTo(w * 0.28, y + 34);
      ctx.fill();
    }
  });
}
/** 바닥 경고 (붉은 고리) */
export function ringTex() {
  return canvasTex(
    "ring",
    128,
    128,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.7, "rgba(255,255,255,0.9)");
      g.addColorStop(0.85, "rgba(255,255,255,0.4)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { wrap: false }
  );
}
