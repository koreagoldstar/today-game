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

/* ---------------- 바닥 (테마별) ----------------
 *  map 은 색, glow 는 스스로 빛나는 부분(빛나는 틈 · 이음매)만. 둘 다 이음매 없이 타일링.
 */
const GROUND = {
  basalt: { dark: [44, 38, 42], ash: [128, 118, 116], ashAmt: 2.6, hotMod: 5, glow: [255, 120, 44], cells: 26 },
  redrock: { dark: [92, 46, 34], ash: [168, 104, 72], ashAmt: 2.2, hotMod: 9, glow: [255, 140, 60], cells: 22 },
  ashfield: { dark: [64, 60, 62], ash: [156, 150, 144], ashAmt: 3.2, hotMod: 6, glow: [255, 110, 40], cells: 30 },
  obsidian: { dark: [28, 22, 34], ash: [86, 74, 92], ashAmt: 1.6, hotMod: 4, glow: [255, 96, 70], cells: 24 },
  scorched: { dark: [40, 26, 26], ash: [110, 70, 60], ashAmt: 2.0, hotMod: 3, glow: [255, 100, 36], cells: 28 },
  storm: { dark: [50, 50, 58], ash: [120, 122, 132], ashAmt: 2.4, hotMod: 7, glow: [255, 130, 70], cells: 26 },
};
function voronoiGround(P, glowOnly) {
  return (ctx, w, h) => {
    const n1 = makeNoise(301);
    const n2 = makeNoise(307);
    const rnd = seeded(311);
    const cells = [];
    for (let i = 0; i < P.cells; i++) cells.push([rnd() * w, rnd() * h]);
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
      const hot = (Math.min(i1, i2) * 5 + Math.max(i1, i2) * 11) % P.hotMod === 0;
      const a = fbm(n1, (x / w) * 5, (y / h) * 5, 4, 5);
      const g = fbm(n2, (x / w) * 16, (y / h) * 16, 2, 16);
      // 화산재 (밝은) 얼룩
      let c = mixC(P.dark, P.ash, Math.max(0, (a - 0.48) * P.ashAmt));
      c = c.map((v) => v * (0.85 + g * 0.3));
      // 틈: 가운데는 밝고 바깥으로 부드럽게 (계단처럼 보이지 않게)
      let glow = 0;
      if (hot && edge < 3.2) glow = Math.pow(1 - edge / 3.2, 1.6);
      else if (edge < 1.4) c = c.map((v) => v * (0.55 + edge * 0.2));
      const gc = P.glow;
      if (glowOnly) return glow ? [gc[0] * glow, gc[1] * glow * 0.9, gc[2] * glow * 0.9] : [0, 0, 0];
      if (glow) c = mixC(c, gc, glow);
      return c;
    });
  };
}
/** 돌다리: 엇갈린 돌판 + 이음매 틈으로 아래 용암 빛 */
function slabGround(glowOnly) {
  return (ctx, w, h) => {
    const n1 = makeNoise(341);
    const n2 = makeNoise(343);
    const rows = 4;
    const rh = h / rows;
    pixels(ctx, w, h, (x, y) => {
      const r = Math.floor(y / rh);
      const cw = w / 2;
      const off = r % 2 ? cw / 2 : 0;
      const cx = (((x + off) % cw) + cw) % cw;
      const cy = y - r * rh;
      const e = Math.min(cx, cw - cx, cy, rh - cy);
      const id = r * 7 + Math.floor((x + off) / cw);
      const tone = 0.82 + ((id * 37) % 11) / 40;
      const a = fbm(n1, (x / w) * 6, (y / h) * 6, 4, 6);
      const g = fbm(n2, (x / w) * 20, (y / h) * 20, 2, 20);
      const c = mixC([78, 70, 70], [126, 116, 110], a).map((v) => v * tone * (0.88 + g * 0.24));
      let glow = 0;
      let cc = c;
      if (e < 3) {
        const k = 1 - e / 3;
        cc = c.map((v) => v * (1 - k * 0.65));
        glow = k * k * 0.55;
      }
      if (glowOnly) return [255 * glow, 100 * glow, 34 * glow];
      return mixC(cc, [255, 120, 50], glow * 0.6);
    });
  };
}
/** 마그마 발전소 바닥: 쇠판 + 리벳 + 빛나는 이음매 */
function plateGround(glowOnly) {
  return (ctx, w, h) => {
    const n1 = makeNoise(351);
    const n2 = makeNoise(353);
    const pw = w / 2;
    pixels(ctx, w, h, (x, y) => {
      const cx = x % pw;
      const cy = y % pw;
      const e = Math.min(cx, pw - cx, cy, pw - cy);
      const a = fbm(n1, (x / w) * 4, (y / h) * 4, 4, 4);
      const g = fbm(n2, (x / w) * 24, (y / h) * 24, 2, 24);
      let c = mixC([60, 58, 62], [104, 98, 96], a).map((v) => v * (0.9 + g * 0.18));
      // 미끄럼 방지 줄무늬
      if (Math.floor((cx + cy) / 6) % 2 === 0 && e > 10) c = c.map((v) => v * 1.06);
      // 리벳
      for (const [rx, ry] of [
        [8, 8],
        [pw - 8, 8],
        [8, pw - 8],
        [pw - 8, pw - 8],
      ]) {
        const d = Math.hypot(cx - rx, cy - ry);
        if (d < 3.2) c = c.map((v) => v * (1.35 - d * 0.1));
      }
      let glow = 0;
      if (e < 2.4) {
        const k = 1 - e / 2.4;
        c = c.map((v) => v * (1 - k * 0.7));
        glow = k;
      }
      if (glowOnly) return [255 * glow, 150 * glow, 40 * glow];
      return mixC(c, [255, 160, 60], glow * 0.7);
    });
  };
}
/** 현무암 기둥 머리 (육각형) */
function hexGround(glowOnly) {
  return (ctx, w, h) => {
    const n1 = makeNoise(361);
    const R = w / 8;
    const hx = R * Math.sqrt(3) * 0.5; // 가로 간격의 반
    const gy = h / 8; // 세로 간격 (타일 8줄)
    const cols = Math.round(w / (hx * 2));
    const hx2 = w / cols / 2;
    pixels(ctx, w, h, (x, y) => {
      let best = 1e9;
      let second = 1e9;
      let bid = 0;
      const j0 = Math.round(y / gy);
      for (let dj = -1; dj <= 1; dj++) {
        const j = j0 + dj;
        const ox = j % 2 ? hx2 : 0;
        const i0 = Math.round((x - ox) / (hx2 * 2));
        for (let di = -1; di <= 1; di++) {
          const i = i0 + di;
          const cx = ox + i * hx2 * 2;
          const cy = j * gy;
          const d = Math.hypot(x - cx, (y - cy) * 1.1);
          if (d < best) {
            second = best;
            best = d;
            const ii = ((i % cols) + cols) % cols;
            const jj = ((j % 8) + 8) % 8;
            bid = ii * 13 + jj * 7;
          } else if (d < second) second = d;
        }
      }
      const e = second - best;
      const tone = 0.75 + ((bid * 31) % 17) / 40;
      const a = fbm(n1, (x / w) * 8, (y / h) * 8, 3, 8);
      let c = [56, 54, 64].map((v) => v * tone * (0.85 + a * 0.35));
      let glow = 0;
      if (e < 4) {
        c = c.map((v) => v * (0.45 + e * 0.13));
        if (bid % 7 === 0) glow = Math.pow(1 - e / 4, 2);
      }
      if (glowOnly) return [255 * glow, 110 * glow, 50 * glow];
      return mixC(c, [255, 120, 50], glow * 0.8);
    });
  };
}
/** 용의 둥지: 검붉은 바위 + 흩어진 뼛조각 + 반짝이는 보석 */
function boneGround(glowOnly) {
  return (ctx, w, h) => {
    const n1 = makeNoise(371);
    const n2 = makeNoise(373);
    const rnd = seeded(379);
    const bones = [];
    for (let i = 0; i < 9; i++) bones.push([rnd() * w, rnd() * h, rnd() * Math.PI, 10 + rnd() * 18]);
    const gems = [];
    for (let i = 0; i < 12; i++) gems.push([rnd() * w, rnd() * h, rnd()]);
    pixels(ctx, w, h, (x, y) => {
      const a = fbm(n1, (x / w) * 5, (y / h) * 5, 4, 5);
      const g = fbm(n2, (x / w) * 18, (y / h) * 18, 2, 18);
      let c = mixC([36, 20, 24], [78, 44, 42], a).map((v) => v * (0.85 + g * 0.3));
      let glow = 0;
      for (const [bx, by, ang, L] of bones) {
        let dx = x - bx;
        let dy = y - by;
        if (dx > w / 2) dx -= w;
        if (dx < -w / 2) dx += w;
        if (dy > h / 2) dy -= h;
        if (dy < -h / 2) dy += h;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const along = dx * ca + dy * sa;
        const across = -dx * sa + dy * ca;
        if (Math.abs(along) < L && Math.abs(across) < 2.4 + (Math.abs(along) > L - 3 ? 1.8 : 0)) c = mixC(c, [196, 182, 160], 0.55);
      }
      for (const [gx, gy, k] of gems) {
        let dx = Math.abs(x - gx);
        let dy = Math.abs(y - gy);
        dx = Math.min(dx, w - dx);
        dy = Math.min(dy, h - dy);
        if (dx + dy < 3.2) {
          const col = k < 0.5 ? [120, 230, 255] : [220, 120, 255];
          c = mixC(c, col, 0.9);
          glow = Math.max(glow, 1 - (dx + dy) / 3.2);
        }
      }
      if (glowOnly) return [150 * glow, 200 * glow, 255 * glow];
      return c;
    });
  };
}
const GROUND_FN = { slabs: slabGround, plates: plateGround, hex: hexGround, bone: boneGround };
/** 바닥 텍스처 한 벌 {map, glow} */
export function groundTex(kind = "basalt") {
  const fn = GROUND_FN[kind];
  const P = GROUND[kind] || GROUND.basalt;
  const mk = (glowOnly) => (fn ? fn(glowOnly) : voronoiGround(P, glowOnly));
  return { map: canvasTex("ground-" + kind, 256, 256, mk(false)), glow: canvasTex("ground-glow-" + kind, 256, 256, mk(true)) };
}
export function slopeTex() {
  return groundTex("basalt").map;
}
export function slopeGlowTex() {
  return groundTex("basalt").glow;
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

/** 표지판 (길 고르기 · 위험 알림): stop 막다른 길 · go 안전한 길 · short 지름길 · warn 주의 · jump 점프 · wind 돌풍 · drop 낭떠러지 */
export function signTex(kind) {
  return canvasTex(
    "sign-" + kind,
    128,
    128,
    (ctx, w, h) => {
      const C = {
        stop: ["#ff3a3a", "#7a0a10"],
        go: ["#4ae07a", "#0a4a20"],
        short: ["#ffd23a", "#7a4a00"],
        warn: ["#ffb02a", "#6a3000"],
        jump: ["#ff8a2a", "#6a2000"],
        wind: ["#7ad0ff", "#0a3a6a"],
        drop: ["#ff5a3a", "#5a0a00"],
      }[kind] || ["#ffffff", "#333333"];
      ctx.clearRect(0, 0, w, h);
      // 둥근 판 + 테두리
      ctx.beginPath();
      if (kind === "warn" || kind === "drop") {
        ctx.moveTo(w / 2, 8);
        ctx.lineTo(w - 8, h - 14);
        ctx.lineTo(8, h - 14);
        ctx.closePath();
      } else ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
      ctx.fillStyle = C[1];
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = C[0];
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#ffffff";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 14;
      const cx = w / 2;
      const cy = h / 2;
      if (kind === "stop") {
        ctx.beginPath();
        ctx.moveTo(cx - 26, cy - 26);
        ctx.lineTo(cx + 26, cy + 26);
        ctx.moveTo(cx + 26, cy - 26);
        ctx.lineTo(cx - 26, cy + 26);
        ctx.stroke();
      } else if (kind === "go" || kind === "jump") {
        ctx.beginPath();
        ctx.moveTo(cx, cy + 30);
        ctx.lineTo(cx, cy - 22);
        ctx.moveTo(cx - 24, cy - 2);
        ctx.lineTo(cx, cy - 28);
        ctx.lineTo(cx + 24, cy - 2);
        ctx.stroke();
        if (kind === "jump") {
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(cx - 34, cy + 34);
          ctx.lineTo(cx + 34, cy + 34);
          ctx.stroke();
        }
      } else if (kind === "short") {
        // 별 + 화살표 (구슬이 많은 지름길)
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 ? 13 : 30;
          ctx.lineTo(cx + Math.cos(a) * r, cy - 6 + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(cx - 22, cy + 34);
        ctx.lineTo(cx + 22, cy + 34);
        ctx.stroke();
      } else if (kind === "warn" || kind === "drop") {
        ctx.fillRect(cx - 7, cy - 26, 14, 40);
        ctx.beginPath();
        ctx.arc(cx, cy + 28, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "wind") {
        ctx.lineWidth = 9;
        for (const [y, l] of [
          [cy - 20, 40],
          [cy, 52],
          [cy + 20, 34],
        ]) {
          ctx.beginPath();
          ctx.moveTo(cx - l / 2 - 6, y);
          ctx.lineTo(cx + l / 2, y);
          ctx.arc(cx + l / 2, y - 8, 8, Math.PI / 2, -Math.PI, true);
          ctx.stroke();
        }
      }
    },
    { wrap: false }
  );
}
/** 노랑 · 검정 경고 줄무늬 */
export function stripeTex() {
  return canvasTex("stripe", 64, 64, (ctx, w, h) => {
    ctx.fillStyle = "#1a1416";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffc23a";
    for (let i = -2; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 32, 0);
      ctx.lineTo(i * 32 + 16, 0);
      ctx.lineTo(i * 32 + 16 + 64, h);
      ctx.lineTo(i * 32 + 64, h);
      ctx.fill();
    }
  });
}

/** 체크포인트 깃발 (글자) */
export function bannerTex() {
  return canvasTex(
    "cp-banner",
    256,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#3a1a22";
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("체크포인트", w / 2, h / 2 + 2);
      ctx.fillRect(6, 6, w - 12, 4);
      ctx.fillRect(6, h - 10, w - 12, 4);
    },
    { wrap: false }
  );
}
