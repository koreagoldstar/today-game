/*
 * 드래곤 석상 대작전 · 코드로 그리는 텍스처 (이미지 파일 없음)
 *  돌 · 바닥 돌판 · 풀 · 나무결 · 용암 금 · 하늘 · 먼 산 · 둥근 빛 · 별
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

/* ---------------- 시드 난수 · 값 노이즈 ---------------- */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
function makeNoise(seed, size = 64) {
  const rnd = seeded(seed);
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (x, y) => g[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
/** 타일링되는 fBm (0~1) */
function fbm(noise, x, y, oct = 4, period = 8) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  let tot = 0;
  for (let o = 0; o < oct; o++) {
    v += amp * noise((x * f) % (period * f), (y * f) % (period * f));
    tot += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / tot;
}

const cache = new Map();
function canvasTex(key, w, h, draw, { repeat = 1, srgb = true, mips = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = mips;
  cache.set(key, t);
  return t;
}
/** 픽셀 단위로 그리기 (fn(x,y) → [r,g,b]) */
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

/* ---------------- 돌 (석상 · 기둥) ---------------- */
/** 조각된 돌: 잔잔한 결 + 패인 점 + 밝은 반점. 색은 재질 color 와 정점 색이 곱해진다 */
export function stoneTex(seed = 1) {
  const S = 256;
  const n1 = makeNoise(seed * 7 + 1);
  const n2 = makeNoise(seed * 7 + 2);
  return canvasTex(`stone${seed}`, S, S, (ctx) =>
    pixels(ctx, S, S, (x, y) => {
      const u = (x / S) * 8;
      const v = (y / S) * 8;
      const base = fbm(n1, u, v, 5, 8);
      const fine = fbm(n2, u * 4, v * 4, 3, 32);
      let k = 0.72 + (base - 0.5) * 0.45 + (fine - 0.5) * 0.18;
      // 패인 곳 (어두운 점)
      const pit = n2(u * 9.3, v * 9.3);
      if (pit > 0.86) k -= (pit - 0.86) * 1.6;
      // 밝은 광물 반점
      if (fine > 0.8) k += (fine - 0.8) * 0.5;
      const c = Math.max(0, Math.min(1, k)) * 255;
      return [c, c * 0.985, c * 0.96];
    })
  );
}
/** 돌 요철 (bumpMap) */
export function stoneBump(seed = 1) {
  const S = 256;
  const n1 = makeNoise(seed * 11 + 3);
  const n2 = makeNoise(seed * 11 + 4);
  return canvasTex(
    `stoneBump${seed}`,
    S,
    S,
    (ctx) =>
      pixels(ctx, S, S, (x, y) => {
        const u = (x / S) * 8;
        const v = (y / S) * 8;
        let k = fbm(n1, u * 2, v * 2, 4, 16) * 0.7 + fbm(n2, u * 6, v * 6, 2, 48) * 0.3;
        const crack = Math.abs(n1(u * 3.1, v * 3.1) - 0.5);
        if (crack < 0.03) k -= (0.03 - crack) * 8;
        const c = Math.max(0, Math.min(1, k)) * 255;
        return [c, c, c];
      }),
    { srgb: false }
  );
}

/** 조각된 비늘 (석상 몸) — 색(map)과 요철(bump) 두 가지 */
export function scaleTex(kind = "bump", seed = 1) {
  const S = 256;
  const n1 = makeNoise(seed * 5 + 9);
  return canvasTex(
    `scale|${kind}|${seed}`,
    S,
    S,
    (ctx) => {
      const rows = 16;
      const cols = 14;
      const cw = S / cols;
      const rh = S / rows;
      // 바탕
      pixels(ctx, S, S, (x, y) => {
        const k = kind === "bump" ? 0.5 : 0.78 + (fbm(n1, (x / S) * 8, (y / S) * 8, 4, 8) - 0.5) * 0.4;
        const c = k * 255;
        return [c, c * 0.985, c * 0.96];
      });
      // 아래쪽부터 겹쳐 그린 반원 비늘 (위 줄이 아래 줄을 덮는다)
      for (let r = rows; r >= -1; r--) {
        for (let c = -1; c <= cols; c++) {
          const cx = c * cw + (r % 2 ? cw / 2 : 0);
          const cy = r * rh;
          const g = ctx.createRadialGradient(cx, cy - rh * 0.25, rh * 0.1, cx, cy, cw * 0.62);
          if (kind === "bump") {
            g.addColorStop(0, "rgb(200,200,200)");
            g.addColorStop(0.75, "rgb(160,160,160)");
            g.addColorStop(1, "rgb(95,95,95)");
          } else {
            g.addColorStop(0, "rgba(255,255,250,0.08)");
            g.addColorStop(0.8, "rgba(0,0,0,0)");
            g.addColorStop(1, "rgba(0,0,0,0.14)");
          }
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(cx, cy, cw * 0.58, rh * 0.95, 0, 0, Math.PI);
          ctx.closePath();
          ctx.fill();
        }
      }
    },
    { srgb: kind !== "bump" }
  );
}

/* ---------------- 바닥: 사원 돌판 ---------------- */
export function flagstoneTex(theme) {
  const S = 512;
  const key = `flag|${theme.id}`;
  const n1 = makeNoise(31);
  const n2 = makeNoise(32);
  return canvasTex(
    key,
    S,
    S,
    (ctx) => {
      const [r0, g0, b0] = hexRgb(theme.ground);
      const [rg, gg, bg] = hexRgb(theme.groundGap || "#3a3a30");
      const rnd = seeded(77);
      // 돌판 격자 (줄마다 어긋나게)
      const rows = 6;
      const rh = S / rows;
      const cells = [];
      for (let r = 0; r < rows; r++) {
        let x = r % 2 ? -rh * 0.5 : 0;
        while (x < S) {
          const w = rh * (0.8 + rnd() * 0.7);
          cells.push({ x, y: r * rh, w, h: rh, tint: 0.85 + rnd() * 0.25 });
          x += w;
        }
      }
      pixels(ctx, S, S, (x, y) => {
        const u = (x / S) * 8;
        const v = (y / S) * 8;
        const nz = fbm(n1, u, v, 4, 8);
        const fine = fbm(n2, u * 4, v * 4, 2, 32);
        return [r0 * (0.75 + nz * 0.4 + (fine - 0.5) * 0.15), g0 * (0.75 + nz * 0.4 + (fine - 0.5) * 0.15), b0 * (0.75 + nz * 0.4 + (fine - 0.5) * 0.15)];
      });
      // 판마다 밝기 · 줄눈 · 가장자리 빛
      for (const c of cells) {
        ctx.fillStyle = `rgba(${c.tint > 1 ? 255 : 0},${c.tint > 1 ? 250 : 0},${c.tint > 1 ? 230 : 0},${Math.abs(c.tint - 1) * 0.6})`;
        ctx.fillRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
        ctx.strokeStyle = `rgb(${rg},${gg},${bg})`;
        ctx.lineWidth = 6;
        ctx.strokeRect(c.x, c.y, c.w, c.h);
        ctx.strokeStyle = "rgba(255,255,240,0.18)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c.x + 4, c.y + c.h - 4);
        ctx.lineTo(c.x + 4, c.y + 4);
        ctx.lineTo(c.x + c.w - 4, c.y + 4);
        ctx.stroke();
        // 이끼 · 금
        if (theme.moss && rnd() < 0.45) {
          const mx = c.x + rnd() * c.w;
          const my = c.y + (rnd() < 0.5 ? 2 : c.h - 2);
          const gr = ctx.createRadialGradient(mx, my, 1, mx, my, 18 + rnd() * 22);
          gr.addColorStop(0, theme.moss + "cc");
          gr.addColorStop(1, theme.moss + "00");
          ctx.fillStyle = gr;
          ctx.fillRect(mx - 40, my - 40, 80, 80);
        }
        if (rnd() < 0.3) {
          ctx.strokeStyle = `rgba(${rg},${gg},${bg},0.7)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          let px = c.x + rnd() * c.w;
          let py = c.y + rnd() * c.h;
          ctx.moveTo(px, py);
          for (let k = 0; k < 4; k++) {
            px += (rnd() - 0.5) * 30;
            py += (rnd() - 0.5) * 30;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
    },
    { repeat: 1 }
  );
}

/* ---------------- 풀밭 ---------------- */
export function grassTex(theme) {
  const S = 256;
  const n1 = makeNoise(41);
  const n2 = makeNoise(42);
  const [r0, g0, b0] = hexRgb(theme.grass || "#5aa84a");
  return canvasTex(`grass|${theme.id}`, S, S, (ctx) => {
    pixels(ctx, S, S, (x, y) => {
      const u = (x / S) * 8;
      const v = (y / S) * 8;
      const k = 0.7 + fbm(n1, u, v, 4, 8) * 0.45 + (fbm(n2, u * 5, v * 5, 2, 40) - 0.5) * 0.25;
      return [r0 * k, g0 * k, b0 * k];
    });
    // 풀잎 결
    const rnd = seeded(5);
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      ctx.strokeStyle = rnd() < 0.5 ? "rgba(255,255,200,0.12)" : "rgba(0,40,0,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 5);
      ctx.stroke();
    }
  });
}

/* ---------------- 나무결 (방망이) ---------------- */
export function woodTex(tint = "#b07a42") {
  const S = 128;
  const n1 = makeNoise(51);
  const [r0, g0, b0] = hexRgb(tint);
  return canvasTex(`wood${tint}`, S, S, (ctx) =>
    pixels(ctx, S, S, (x, y) => {
      const u = (x / S) * 8;
      const v = (y / S) * 8;
      const ring = Math.sin(v * 9 + fbm(n1, u * 0.5, v * 2, 3, 8) * 7);
      const k = 0.82 + ring * 0.1 + (n1(u * 6, v * 1.5) - 0.5) * 0.12;
      return [r0 * k, g0 * k, b0 * k];
    })
  );
}

/* ---------------- 용암 금 (발광) ---------------- */
export function lavaCrackTex() {
  const S = 256;
  const n1 = makeNoise(61);
  return canvasTex(`lava`, S, S, (ctx) =>
    pixels(ctx, S, S, (x, y) => {
      const u = (x / S) * 8;
      const v = (y / S) * 8;
      const a = Math.abs(fbm(n1, u, v, 4, 8) - 0.5);
      const k = a < 0.04 ? 1 - a / 0.04 : 0;
      return [255 * k, 120 * k + 20 * k * k, 30 * k];
    })
  );
}

/* ---------------- 하늘 (세로 그라디언트 + 구름) ---------------- */
export function skyTex(theme) {
  return canvasTex(
    `sky|${theme.id}`,
    64,
    512,
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      theme.sky.forEach(([o, c]) => g.addColorStop(o, c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { repeat: 1, mips: false }
  );
}

/** 먼 산맥 · 숲 띠 (가로로 긴 실루엣, 위는 투명) */
export function ridgeTex(key, { color, top, peaks = 6, seed = 1, jag = 0.5, snow = null, trees = false, height = 0.7 }) {
  return canvasTex(
    `ridge|${key}`,
    1024,
    256,
    (ctx, w, h) => {
      const rnd = seeded(seed);
      ctx.clearRect(0, 0, w, h);
      const pts = [];
      const n = peaks * 6;
      const hs = [];
      for (let i = 0; i <= peaks; i++) hs.push(rnd());
      for (let i = 0; i <= n; i++) {
        const k = (i / n) * peaks;
        const a = hs[Math.floor(k)];
        const b = hs[Math.min(peaks, Math.floor(k) + 1)];
        const f = k - Math.floor(k);
        const sm = a + (b - a) * (0.5 - Math.cos(f * Math.PI) / 2);
        const y = h * (1 - height * (0.35 + sm * 0.65)) + (rnd() - 0.5) * h * 0.08 * jag;
        pts.push([(i / n) * w, y]);
      }
      // 양 끝이 이어지게
      pts[pts.length - 1][1] = pts[0][1];
      const g = ctx.createLinearGradient(0, h * (1 - height), 0, h);
      g.addColorStop(0, top || color);
      g.addColorStop(1, color);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      if (snow) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = snow;
        for (const [x, y] of pts) if (y < h * (1 - height * 0.8)) {
          ctx.beginPath();
          ctx.ellipse(x, y + 6, 26, 12, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (trees) {
        // 능선 위 작은 나무 실루엣
        ctx.fillStyle = color;
        for (let i = 0; i < 90; i++) {
          const x = rnd() * w;
          const k = Math.floor((x / w) * n);
          const y = pts[k][1] + (pts[k + 1] ? (pts[k + 1][1] - pts[k][1]) * ((x / w) * n - k) : 0);
          const r = 6 + rnd() * 10;
          ctx.beginPath();
          ctx.arc(x, y + 2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    { repeat: 1, mips: true }
  );
}

/** 부드러운 둥근 빛 (입자 · 반딧불) */
export function dotTex() {
  return canvasTex(
    "dot",
    64,
    64,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(255,255,255,0.8)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { repeat: 1, srgb: true }
  );
}
/** 반짝이 별 (네 갈래) */
export function starTex() {
  return canvasTex(
    "star4",
    64,
    64,
    (ctx) => {
      ctx.translate(32, 32);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 32);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.4, "rgba(255,255,255,0.35)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 7 : 32;
        const a = (i / 8) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.fill();
    },
    { repeat: 1 }
  );
}
/** 물줄기 (폭포) — 세로로 흐르는 줄무늬 */
export function waterfallTex() {
  return canvasTex(
    "falls",
    64,
    256,
    (ctx, w, h) => {
      const rnd = seeded(9);
      ctx.fillStyle = "rgba(200,240,255,0.55)";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const len = 20 + rnd() * 60;
        ctx.strokeStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
        ctx.lineWidth = 1 + rnd() * 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + len);
        ctx.stroke();
      }
    },
    { repeat: 1 }
  );
}

export function hexRgb(h) {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
