/* 경기장 그리기: 땅 · 점프대 · 벽 · 하늘 · 테마 장식.
 * 모양은 Level 값만 읽는다. 물리에 영향을 주지 않는다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { MAT } from "./level.js";
import { mergeGeos } from "./truckmodel.js";
import { B, C, GEO, moved, tint } from "./props.js";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ---------- 테마 색 ---------- */
export const LOOKS = {
  scrap: {
    sky: ["#1f6fc4", "#6db4ea", "#d9ecf4"], fog: "#c7dde8", near: 110, far: 430, clouds: 1, cloud: "#ffffff",
    sun: "#fff0d4", sunI: 3.1, sunDir: [0.55, 0.78, 0.32], hemi: ["#d6e9ff", "#94734e", 1.15], env: 0.7,
    road: "#b18757", road2: "#9a7248", edge: "#8d6a45", outer: "#a38659", outer2: "#8b7150", ice: "#9fd8f5", detail: "dirt", exposure: 1.02,
    far0: "#b9c5c6", far1: "#9aa6a8",
  },
  city: {
    sky: ["#3e5f9e", "#d68f7a", "#fbd9a4"], fog: "#e7bb98", near: 110, far: 400, clouds: 1, cloud: "#ffe8d0",
    sun: "#ffd7a8", sunI: 2.9, sunDir: [-0.62, 0.55, 0.42], hemi: ["#ffdcc0", "#5a5560", 1.2], env: 0.8,
    road: "#5a5d66", road2: "#4c4f58", edge: "#3e4048", outer: "#8d8a86", outer2: "#76736f", ice: "#9fd8f5", detail: "asphalt", exposure: 1.02,
    far0: "#a98f96", far1: "#7c6a7c",
  },
  volcano: {
    sky: ["#1e0d16", "#6b2318", "#e0662b"], fog: "#8a3a22", near: 80, far: 320, clouds: 0.8, cloud: "#4a2a26",
    sun: "#ffc49c", sunI: 2.9, sunDir: [0.3, 0.74, -0.5], hemi: ["#ffb48c", "#5a2c20", 1.7], env: 0.8,
    road: "#7a615a", road2: "#67524c", edge: "#44332f", outer: "#4a3a38", outer2: "#332826", ice: "#9fd8f5", detail: "rock", exposure: 1.05,
    far0: "#5e2b22", far1: "#3a1a16",
  },
  frozen: {
    sky: ["#3f8ccf", "#9fd2f0", "#eef8fc"], fog: "#dcedf6", near: 80, far: 340, clouds: 1, cloud: "#ffffff",
    sun: "#fff6ea", sunI: 2.6, sunDir: [0.42, 0.66, 0.55], hemi: ["#d8ecff", "#a8c0d4", 1.1], env: 0.85,
    road: "#dfeaf3", road2: "#cedde9", edge: "#b6c9d9", outer: "#f1f7fb", outer2: "#dfeaf3", ice: "#8fd3f3", detail: "snow", exposure: 0.92,
    far0: "#c6d9e6", far1: "#a7c0d4",
  },
  stadium: {
    sky: ["#070c24", "#16224f", "#3a4a86"], fog: "#1f2b5a", near: 130, far: 480, clouds: 0, cloud: "#ffffff",
    sun: "#e6efff", sunI: 3.0, sunDir: [0.25, 0.9, 0.3], hemi: ["#b8c8ff", "#6a5238", 1.5], env: 0.75,
    road: "#a87a4c", road2: "#916840", edge: "#6f5233", outer: "#7a5f43", outer2: "#5f4a35", ice: "#9fd8f5", detail: "dirt", exposure: 1.08,
    far0: "#1b2650", far1: "#101a3c",
  },
};

/* ---------- 이어지는 잡음 무늬 ---------- */
function tileNoise(S, cells, seed) {
  const r = rng(seed);
  const lat = new Float32Array(cells * cells).map(() => r());
  const out = new Float32Array(S * S);
  for (let j = 0; j < S; j += 1) {
    for (let i = 0; i < S; i += 1) {
      const u = (i / S) * cells;
      const v = (j / S) * cells;
      const a = u | 0;
      const b = v | 0;
      const fu = u - a;
      const fv = v - b;
      const su = fu * fu * (3 - 2 * fu);
      const sv = fv * fv * (3 - 2 * fv);
      const A = lat[a % cells + (b % cells) * cells];
      const Bv = lat[(a + 1) % cells + (b % cells) * cells];
      const Cv = lat[a % cells + ((b + 1) % cells) * cells];
      const D = lat[(a + 1) % cells + ((b + 1) % cells) * cells];
      out[i + j * S] = A + (Bv - A) * su + (Cv - A) * sv + (A - Bv - Cv + D) * su * sv;
    }
  }
  return out;
}

const detailCache = new Map();
function detailTextures(kind) {
  if (detailCache.has(kind)) return detailCache.get(kind);
  const S = 256;
  const h = new Float32Array(S * S);
  const layers = {
    dirt: [[6, 0.42], [14, 0.3], [40, 0.2], [96, 0.14]],
    asphalt: [[10, 0.12], [64, 0.3], [128, 0.5]],
    rock: [[5, 0.6], [12, 0.4], [34, 0.24], [80, 0.1]],
    snow: [[5, 0.34], [18, 0.18], [64, 0.06]],
  }[kind];
  layers.forEach(([c, a], k) => {
    const n = tileNoise(S, c, 71 + k * 19 + kind.length * 7);
    for (let i = 0; i < h.length; i += 1) h[i] += n[i] * a;
  });
  const r = rng(kind.length * 991 + 3);
  if (kind === "dirt" || kind === "rock") {
    // 자갈
    const n = kind === "dirt" ? 70 : 34;
    for (let k = 0; k < n; k += 1) {
      const cx = r() * S;
      const cy = r() * S;
      const R = 1.5 + r() * (kind === "dirt" ? 3 : 6);
      for (let y = -R; y <= R; y += 1) {
        for (let x = -R; x <= R; x += 1) {
          const d = (x * x + y * y) / (R * R);
          if (d > 1) continue;
          const I = ((Math.round(cx + x) + S) % S) + ((Math.round(cy + y) + S) % S) * S;
          h[I] += (1 - d) * 0.4;
        }
      }
    }
  }
  if (kind === "asphalt") {
    // 금 간 자국
    for (let k = 0; k < 6; k += 1) {
      let x = r() * S;
      let y = r() * S;
      let a = r() * 6.28;
      for (let t = 0; t < 70; t += 1) {
        a += (r() - 0.5) * 0.7;
        x += Math.cos(a);
        y += Math.sin(a);
        h[((Math.round(x) + S * 4) % S) + ((Math.round(y) + S * 4) % S) * S] -= 0.5;
      }
    }
  }
  let lo = 1e9;
  let hi = -1e9;
  for (const v of h) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const span = hi - lo || 1;
  const cA = document.createElement("canvas");
  const cN = document.createElement("canvas");
  cA.width = cA.height = cN.width = cN.height = S;
  const xA = cA.getContext("2d");
  const xN = cN.getContext("2d");
  const iA = xA.createImageData(S, S);
  const iN = xN.createImageData(S, S);
  const contrast = { dirt: 0.5, asphalt: 0.35, rock: 0.6, snow: 0.14 }[kind];
  const strength = { dirt: 3.2, asphalt: 1.2, rock: 4.2, snow: 1.3 }[kind];
  for (let j = 0; j < S; j += 1) {
    for (let i = 0; i < S; i += 1) {
      const k = i + j * S;
      const v = (h[k] - lo) / span;
      const g = Math.round(255 * (1 - contrast + contrast * v * 1.2));
      iA.data[k * 4] = Math.min(255, g);
      iA.data[k * 4 + 1] = Math.min(255, g);
      iA.data[k * 4 + 2] = Math.min(255, g);
      iA.data[k * 4 + 3] = 255;
      const dx = (h[(i + 1) % S + j * S] - h[(i + S - 1) % S + j * S]) * strength;
      const dy = (h[i + ((j + 1) % S) * S] - h[i + ((j + S - 1) % S) * S]) * strength;
      const L = Math.hypot(dx, dy, 1);
      iN.data[k * 4] = Math.round(((-dx / L) * 0.5 + 0.5) * 255);
      iN.data[k * 4 + 1] = Math.round(((-dy / L) * 0.5 + 0.5) * 255);
      iN.data[k * 4 + 2] = Math.round(((1 / L) * 0.5 + 0.5) * 255);
      iN.data[k * 4 + 3] = 255;
    }
  }
  xA.putImageData(iA, 0, 0);
  xN.putImageData(iN, 0, 0);
  const map = new THREE.CanvasTexture(cA);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const normalMap = new THREE.CanvasTexture(cN);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.anisotropy = 4;
  const out = { map, normalMap };
  detailCache.set(kind, out);
  return out;
}

/* ---------- 하늘 ---------- */
const skyCache = new Map();
function skyTexture(id) {
  if (skyCache.has(id)) return skyCache.get(id);
  const look = LOOKS[id];
  const W = 1024;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, H / 2);
  g.addColorStop(0, look.sky[0]);
  g.addColorStop(0.62, look.sky[1]);
  g.addColorStop(1, look.sky[2]);
  x.fillStyle = g;
  x.fillRect(0, 0, W, H / 2);
  x.fillStyle = look.fog;
  x.fillRect(0, H / 2, W, H / 2);
  const r = rng(id.length * 137 + 5);
  if (id === "stadium") {
    for (let i = 0; i < 260; i += 1) {
      x.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7})`;
      const s = r() < 0.08 ? 2 : 1;
      x.fillRect(r() * W, r() * H * 0.42, s, s);
    }
  }
  if (look.clouds > 0) {
    const puff = (px, py, R, a) => {
      for (const dx of [-W, 0, W]) {
        const q = x.createRadialGradient(px + dx, py, 0, px + dx, py, R);
        q.addColorStop(0, look.cloud + Math.round(a * 255).toString(16).padStart(2, "0"));
        q.addColorStop(1, look.cloud + "00");
        x.fillStyle = q;
        x.fillRect(px + dx - R, py - R, R * 2, R * 2);
      }
    };
    for (let k = 0; k < 16; k += 1) {
      const cx = r() * W;
      const cy = 70 + r() * 150;
      const n = 8 + Math.floor(r() * 10);
      const spread = 40 + r() * 80;
      for (let i = 0; i < n; i += 1) {
        const a = r() * 6.28;
        const d = r() * spread;
        puff(cx + Math.cos(a) * d * 1.8, cy + Math.sin(a) * d * 0.28, 12 + r() * 26, 0.2 + r() * 0.36);
      }
    }
  }
  if (id !== "stadium" && id !== "volcano") {
    // 해
    const sx = W * (id === "city" ? 0.2 : 0.62);
    const sy = id === "city" ? 205 : 70;
    const q = x.createRadialGradient(sx, sy, 0, sx, sy, 120);
    q.addColorStop(0, "rgba(255,250,235,1)");
    q.addColorStop(0.12, "rgba(255,244,220,0.85)");
    q.addColorStop(1, "rgba(255,244,220,0)");
    x.fillStyle = q;
    x.fillRect(sx - 120, sy - 120, 240, 240);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  skyCache.set(id, t);
  return t;
}

const envCache = new Map();
/** 테마 하늘로 만든 반사 지도 */
export function themeEnv(renderer, id) {
  let env = envCache.get(id);
  if (!env) {
    const pm = new THREE.PMREMGenerator(renderer);
    env = pm.fromEquirectangular(skyTexture(id)).texture;
    pm.dispose();
    envCache.set(id, env);
  }
  return env;
}

/* ---------- 먼 풍경 (원통에 그린 실루엣) ---------- */
const farCache = new Map();
function farTexture(id) {
  if (farCache.has(id)) return farCache.get(id);
  const look = LOOKS[id];
  const W = 2048;
  const H = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  const r = rng(id.length * 811 + 1);
  const ridge = (color, base, amp, bumps, jag) => {
    const ph = Array.from({ length: bumps }, () => [r() * 6.28, 1 + Math.floor(r() * 7)]);
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(0, H);
    for (let i = 0; i <= W; i += 4) {
      let v = 0;
      for (const [p, f] of ph) v += Math.sin((i / W) * 6.2832 * f + p) / bumps;
      const j = jag ? Math.abs(Math.sin(i * 0.05 + ph[0][0]) * Math.sin(i * 0.017)) * jag : 0;
      x.lineTo(i, base - (v * 0.5 + 0.5) * amp - j);
    }
    x.lineTo(W, H);
    x.closePath();
    x.fill();
  };
  if (id === "city") {
    for (const [col, base, wMin, wMax, hMax] of [[look.far0, 200, 40, 90, 120], [look.far1, 228, 34, 76, 86]]) {
      let px = 0;
      while (px < W) {
        const w = wMin + r() * (wMax - wMin);
        const h = 30 + r() * hMax;
        x.fillStyle = col;
        x.fillRect(px, base - h, w, H);
        if (r() < 0.3) x.fillRect(px + w * 0.4, base - h - 16, 4, 16);
        x.fillStyle = "rgba(255,226,160,0.5)";
        for (let wy = base - h + 8; wy < base; wy += 12) {
          for (let wx = px + 5; wx < px + w - 5; wx += 11) {
            if (r() < 0.32) x.fillRect(wx, wy, 5, 6);
          }
        }
        px += w + r() * 5;
      }
    }
  } else if (id === "stadium") {
    // 경기장 윗층 관중석 + 조명
    x.fillStyle = look.far0;
    x.fillRect(0, 96, W, H);
    for (let row = 0; row < 7; row += 1) {
      for (let i = 0; i < W; i += 6) {
        const hue = ["#f25a4a", "#ffd34a", "#5ac8f5", "#ffffff", "#7be06a", "#f58ad0"][Math.floor(r() * 6)];
        x.fillStyle = r() < 0.72 ? hue : look.far1;
        x.globalAlpha = 0.34 + r() * 0.3;
        x.fillRect(i + (row % 2) * 3, 106 + row * 14, 4, 6);
      }
    }
    x.globalAlpha = 1;
    x.fillStyle = look.far1;
    x.fillRect(0, 86, W, 12);
    for (let i = 0; i < 12; i += 1) {
      const lx = (i / 12) * W + 40;
      const q = x.createRadialGradient(lx, 60, 0, lx, 60, 70);
      q.addColorStop(0, "rgba(255,255,240,1)");
      q.addColorStop(0.1, "rgba(235,245,255,0.75)");
      q.addColorStop(1, "rgba(200,220,255,0)");
      x.fillStyle = q;
      x.fillRect(lx - 70, 0, 140, 130);
      x.fillStyle = look.far1;
      x.fillRect(lx - 3, 60, 6, 40);
    }
  } else if (id === "volcano") {
    ridge(look.far0, 170, 90, 5, 22);
    // 불기둥을 뿜는 산
    for (const vx of [420, 1420]) {
      x.fillStyle = look.far1;
      x.beginPath();
      x.moveTo(vx - 240, 230);
      x.lineTo(vx - 40, 44);
      x.lineTo(vx + 40, 44);
      x.lineTo(vx + 240, 230);
      x.closePath();
      x.fill();
      const q = x.createRadialGradient(vx, 40, 0, vx, 40, 110);
      q.addColorStop(0, "rgba(255,190,90,0.95)");
      q.addColorStop(1, "rgba(255,90,20,0)");
      x.fillStyle = q;
      x.fillRect(vx - 110, 0, 220, 130);
      x.strokeStyle = "#ff7a22";
      x.lineWidth = 3;
      for (let s = 0; s < 4; s += 1) {
        x.beginPath();
        let lx = vx - 24 + s * 16;
        x.moveTo(lx, 46);
        for (let y = 56; y < 220; y += 16) {
          lx += (r() - 0.5) * 22 + (s - 1.5) * 5;
          x.lineTo(lx, y);
        }
        x.stroke();
      }
    }
    ridge(look.far1, 228, 44, 7, 14);
  } else {
    ridge(look.far0, 168, 100, 6, id === "frozen" ? 26 : 8);
    if (id === "frozen") {
      // 봉우리에 눈
      x.globalCompositeOperation = "source-atop";
      const q = x.createLinearGradient(0, 40, 0, 150);
      q.addColorStop(0, "#ffffff");
      q.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = q;
      x.fillRect(0, 0, W, 150);
      x.globalCompositeOperation = "source-over";
    }
    ridge(look.far1, 220, 60, 8, id === "frozen" ? 14 : 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  farCache.set(id, t);
  return t;
}

/* ---------- 그림판 ---------- */
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso || 4;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const rampTex = () =>
  canvasTex(256, 512, (x, W, H) => {
    x.fillStyle = "#6e747c";
    x.fillRect(0, 0, W, H);
    // 철판 무늬
    x.fillStyle = "rgba(255,255,255,0.07)";
    for (let j = 0; j < H; j += 16) {
      for (let i = (j / 16) % 2 ? 8 : 0; i < W; i += 16) x.fillRect(i, j, 8, 3);
    }
    x.strokeStyle = "rgba(0,0,0,0.3)";
    x.lineWidth = 2;
    for (let j = 0; j < H; j += 128) {
      x.beginPath();
      x.moveTo(0, j);
      x.lineTo(W, j);
      x.stroke();
    }
    // 빨간 화살표 (위쪽이 나아가는 쪽)
    x.fillStyle = "#e0301e";
    for (let j = -60; j < H; j += 128) {
      x.beginPath();
      x.moveTo(W * 0.5, j);
      x.lineTo(W * 0.88, j + 66);
      x.lineTo(W * 0.88, j + 112);
      x.lineTo(W * 0.5, j + 46);
      x.lineTo(W * 0.12, j + 112);
      x.lineTo(W * 0.12, j + 66);
      x.closePath();
      x.fill();
    }
    // 노랑 · 검정 가장자리
    for (let j = 0; j < H; j += 32) {
      x.fillStyle = (j / 32) % 2 ? "#141414" : "#ffc81e";
      x.fillRect(0, j, 16, 32);
      x.fillRect(W - 16, j, 16, 32);
    }
  });
const padTex = () =>
  canvasTex(128, 256, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    for (let j = 0; j < 2; j += 1) {
      const y = j * 128;
      x.fillStyle = j ? "#ffd21f" : "#ff7a18";
      x.beginPath();
      x.moveTo(W / 2, y + 8);
      x.lineTo(W - 8, y + 72);
      x.lineTo(W - 8, y + 118);
      x.lineTo(W / 2, y + 54);
      x.lineTo(8, y + 118);
      x.lineTo(8, y + 72);
      x.closePath();
      x.fill();
    }
  }, { repeat: true });
const fenceTex = () => {
  const t = canvasTex(128, 128, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    x.strokeStyle = "#c6ccd2";
    x.lineWidth = 3;
    for (let i = -H; i < W + H; i += 32) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + H, H);
      x.moveTo(i + H, 0);
      x.lineTo(i, H);
      x.stroke();
    }
  }, { repeat: true });
  t.repeat.set(1, 1);
  return t;
};
const checkerTex = () =>
  canvasTex(256, 64, (x, W, H) => {
    const s = 16;
    for (let j = 0; j < H; j += s) {
      for (let i = 0; i < W; i += s) {
        x.fillStyle = (i + j) / s % 2 ? "#111" : "#fff";
        x.fillRect(i, j, s, s);
      }
    }
  });
function ledTex(id) {
  const TEXT = { scrap: ["SMASH!", "SCRAP YARD"], city: ["JUNK CITY", "CRUSH!"], volcano: ["VOLCANO", "RUSH!"], frozen: ["FROZEN", "WASTELAND"], stadium: ["MEGA", "STADIUM"] }[id];
  return canvasTex(512, 256, (x, W, H) => {
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#14246e");
    g.addColorStop(1, "#7a1a7a");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(255,255,255,0.08)";
    for (let k = 0; k < 8; k += 1) {
      x.beginPath();
      x.moveTo(W / 2, H / 2);
      const a = (k / 8) * 6.283;
      x.lineTo(W / 2 + Math.cos(a) * 600, H / 2 + Math.sin(a) * 600);
      x.lineTo(W / 2 + Math.cos(a + 0.28) * 600, H / 2 + Math.sin(a + 0.28) * 600);
      x.closePath();
      x.fill();
    }
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.lineJoin = "round";
    x.font = "900 76px Arial Black, Impact, sans-serif";
    x.strokeStyle = "#1a0a20";
    x.lineWidth = 16;
    x.strokeText(TEXT[0], W / 2, H * 0.34);
    x.fillStyle = "#ffd21f";
    x.fillText(TEXT[0], W / 2, H * 0.34);
    x.font = "900 60px Arial Black, Impact, sans-serif";
    x.strokeText(TEXT[1], W / 2, H * 0.72);
    x.fillStyle = "#ff5a2a";
    x.fillText(TEXT[1], W / 2, H * 0.72);
    // LED 알갱이
    x.fillStyle = "rgba(0,0,0,0.2)";
    for (let j = 0; j < H; j += 4) x.fillRect(0, j, W, 1);
    for (let i = 0; i < W; i += 4) x.fillRect(i, 0, 1, H);
  });
}
const windowsTex = () =>
  canvasTex(256, 256, (x, W, H) => {
    x.fillStyle = "#ffffff";
    x.fillRect(0, 0, W, H);
    const r = rng(77);
    for (let j = 0; j < 8; j += 1) {
      for (let i = 0; i < 8; i += 1) {
        const lit = r() < 0.3;
        x.fillStyle = lit ? "#ffe9a8" : "#2c3550";
        x.fillRect(i * 32 + 6, j * 32 + 7, 20, 19);
        if (!lit) {
          x.fillStyle = "rgba(160,200,255,0.25)";
          x.fillRect(i * 32 + 6, j * 32 + 7, 8, 19);
        }
      }
    }
  }, { repeat: true });
const crowdTex = () =>
  canvasTex(512, 256, (x, W, H) => {
    x.fillStyle = "#23283c";
    x.fillRect(0, 0, W, H);
    const r = rng(9);
    const cols = ["#f25a4a", "#ffd34a", "#5ac8f5", "#ffffff", "#7be06a", "#f58ad0", "#ff9a3a", "#8d7bf5"];
    for (let j = 0; j < 12; j += 1) {
      for (let i = 0; i < 48; i += 1) {
        const px = i * 10.67 + (j % 2) * 5 + (r() - 0.5) * 3;
        const py = j * 21.3 + 8 + (r() - 0.5) * 3;
        x.fillStyle = cols[Math.floor(r() * cols.length)];
        x.fillRect(px - 3.6, py + 3, 7.2, 10);
        x.fillStyle = ["#f4cfa8", "#d9a37a", "#8f5f3e", "#f8dcc0"][Math.floor(r() * 4)];
        x.beginPath();
        x.arc(px, py, 3.2, 0, 6.3);
        x.fill();
      }
    }
  }, { repeat: true });
const treadTex = () =>
  canvasTex(64, 128, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    x.fillStyle = "rgba(40,28,18,0.75)";
    for (let j = 0; j < H; j += 16) {
      x.save();
      x.translate(W * 0.28, j + 8);
      x.rotate(0.5);
      x.fillRect(-13, -3.5, 26, 7);
      x.restore();
      x.save();
      x.translate(W * 0.72, j + 8);
      x.rotate(-0.5);
      x.fillRect(-13, -3.5, 26, 7);
      x.restore();
    }
  }, { repeat: true });

/* ---------- 장식 모델 ---------- */
function latticeTower() {
  const P = [];
  const H = 26;
  const R = "#d8341f";
  const W = "#f2f2f2";
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const bot = 3.4;
    const top = 0.9;
    const g = new THREE.CylinderGeometry(0.1, 0.16, H, 6);
    const len = Math.hypot(H, (bot - top) * Math.SQRT2);
    g.scale(1, len / H, 1);
    g.rotateZ(sx * Math.atan((bot - top) / H));
    g.rotateX(-sz * Math.atan((bot - top) / H));
    g.translate((sx * (bot + top)) / 2, H / 2, (sz * (bot + top)) / 2);
    P.push(tint(g, R));
  }
  const seg = 9;
  for (let i = 0; i < seg; i += 1) {
    const t0 = i / seg;
    const y = t0 * H;
    const hw = 3.4 + (0.9 - 3.4) * t0;
    const col = i % 2 ? W : R;
    for (const [dx, dz, ry] of [[0, hw, 0], [0, -hw, 0], [hw, 0, Math.PI / 2], [-hw, 0, Math.PI / 2]]) {
      P.push(B(hw * 2, 0.14, 0.14, col, dx, y, dz, 0, [0, ry, 0]));
      const dg = Math.hypot(hw * 2, H / seg);
      const ang = Math.atan2(H / seg, hw * 2);
      const b1 = new THREE.BoxGeometry(dg, 0.08, 0.08);
      b1.rotateZ(i % 2 ? ang : -ang);
      b1.rotateY(ry);
      b1.translate(dx, y + H / seg / 2, dz);
      P.push(tint(b1, col));
    }
  }
  P.push(B(3.2, 0.3, 3.2, "#3a3d44", 0, H, 0), C(0.08, 0.08, 4, "#ccc", 0, H + 2, 0, 6));
  P.push(moved(tint(new THREE.SphereGeometry(0.3, 8, 6), "#ff2a18"), 0, H + 4.1, 0));
  for (const [x, z] of [[-3.4, -3.4], [3.4, -3.4], [3.4, 3.4], [-3.4, 3.4]]) P.push(B(1, 0.5, 1, "#8c8982", x, 0.25, z));
  return mergeGeos(P);
}
function wreckPile() {
  const P = [];
  const car = GEO.wreck([1.0, 0.72, 2.15])[0];
  const cols = ["#b35a42", "#4f7ea8", "#c9a33c", "#5f8a54", "#8a8d94", "#7b5f9f"];
  const place = (x, y, z, ry, rz, c) => {
    const g = car.clone();
    const col = new THREE.Color(cols[c % cols.length]);
    const a = g.attributes.color;
    for (let i = 0; i < a.count; i += 1) a.setXYZ(i, a.getX(i) * col.r, a.getY(i) * col.g, a.getZ(i) * col.b);
    g.rotateZ(rz);
    g.rotateY(ry);
    g.translate(x, y, z);
    P.push(g);
  };
  place(-1.3, 0.8, 0, 0.2, 0, 0);
  place(1.3, 0.8, 0.3, -0.15, 0, 1);
  place(0, 0.75, -4.6, 1.4, 0, 2);
  place(-0.4, 2.2, 0.2, 0.5, 0.1, 3);
  place(0.9, 3.6, 0, -0.4, -0.15, 4);
  return mergeGeos(P);
}
function tireHeap() {
  const P = [];
  const r = rng(5);
  const ring = (x, y, z, rx, rz) => moved(tint(new THREE.TorusGeometry(0.72, 0.32, 7, 12).rotateX(Math.PI / 2), r() < 0.14 ? "#c6c6c6" : "#222327"), x, y, z, rx, 0, rz);
  for (let k = 0; k < 4; k += 1) P.push(ring(-1.1 + k * 0.1, 0.32 + k * 0.62, 0, 0.05, 0.04));
  for (let k = 0; k < 3; k += 1) P.push(ring(1.0, 0.32 + k * 0.62, 0.5, -0.04, 0.03));
  for (let k = 0; k < 2; k += 1) P.push(ring(0, 0.32 + k * 0.62, -1.3, 0.03, 0.05));
  P.push(ring(0.1, 2.1, -0.2, 0.3, 0.2));
  return mergeGeos(P);
}
function containerStack() {
  const P = [];
  const base = mergeGeos(GEO.container());
  const put = (x, y, z, ry, c) => {
    const g = base.clone();
    const col = new THREE.Color(c);
    const a = g.attributes.color;
    for (let i = 0; i < a.count; i += 1) a.setXYZ(i, a.getX(i) * col.r, a.getY(i) * col.g, a.getZ(i) * col.b);
    g.rotateY(ry);
    g.translate(x, y, z);
    P.push(g);
  };
  put(0, 1.35, 0, 0, "#c7402f");
  put(3, 1.35, 0.4, 0.05, "#2e6fb5");
  put(1.4, 4.05, 0.2, 0.1, "#e0a020");
  return mergeGeos(P);
}
function crane() {
  const P = [];
  const y = "#e8a81c";
  P.push(B(5, 1.6, 6.5, y, 0, 1.1, 0, 0.2), B(5.4, 1, 7.2, "#232327", 0, 0.5, 0));
  P.push(B(1.1, 18, 1.1, y, 0, 10, 0));
  const arm = new THREE.BoxGeometry(0.8, 0.8, 22);
  arm.rotateX(-0.28);
  arm.translate(0, 21.5, 7.5);
  P.push(tint(arm, y));
  P.push(C(0.05, 0.05, 11, "#333", 0, 19, 18, 6), B(1.6, 0.7, 1.6, "#5a5d66", 0, 13, 18));
  return mergeGeos(P);
}
function oilTank() {
  return mergeGeos([C(3.2, 3.2, 6, "#b9bec4", 0, 3, 0, 18), C(3.25, 3.25, 0.16, "#8d9298", 0, 1.8, 0, 18), C(3.25, 3.25, 0.16, "#8d9298", 0, 4.2, 0, 18), C(3.25, 1.2, 1, "#a7acb2", 0, 6.5, 0, 18), B(0.14, 6.6, 0.8, "#6d7077", 3.3, 3.3, 0)]);
}
function building() {
  // UV 는 창문 무늬. 인스턴스 색으로 벽 색을 바꾼다
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  const uv = g.attributes.uv;
  const n = g.attributes.normal;
  const p = g.attributes.position;
  for (let i = 0; i < uv.count; i += 1) {
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, 0.002, 0.002);
    else uv.setXY(i, (Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) + 0.5 : p.getX(i) + 0.5) * 2, p.getY(i) * 4);
  }
  return g;
}
function neonSign() {
  return mergeGeos([C(0.18, 0.2, 8, "#555a62", 0, 4, 0, 8), B(5, 2.4, 0.3, "#16162a", 0, 8.6, 0, 0.1), B(4.4, 0.34, 0.34, "#ff3ca8", 0, 9.3, 0.04), B(4.4, 0.34, 0.34, "#35e0ff", 0, 8.6, 0.04), B(3.4, 0.34, 0.34, "#ffe33c", 0, 7.9, 0.04)]);
}
function lamp() {
  return mergeGeos([C(0.09, 0.14, 7, "#4e525a", 0, 3.5, 0, 7), B(1.5, 0.1, 0.1, "#4e525a", 0.7, 7, 0), B(0.7, 0.14, 0.34, "#ffefb8", 1.4, 6.92, 0)]);
}
function spire() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  g.scale(3, 7, 3);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const noise = (x, y, z) => Math.sin(x * 1.3 + y * 0.7) * Math.cos(z * 1.4 + y * 0.4);
  for (let i = 0; i < p.count; i += 1) {
    const k = 1 + noise(p.getX(i), p.getY(i), p.getZ(i)) * 0.26;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * (p.getY(i) > 0 ? 1.15 : 1), p.getZ(i) * k);
    const hot = noise(p.getX(i) * 2, p.getY(i), p.getZ(i) * 2) > 0.55;
    col[i * 3] = hot ? 1 : 0.13;
    col[i * 3 + 1] = hot ? 0.38 : 0.1;
    col[i * 3 + 2] = hot ? 0.08 : 0.1;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const out = g.toNonIndexed();
  out.computeVertexNormals();
  out.translate(0, 5, 0);
  return out;
}
function deadTree() {
  const c = "#1d1614";
  const P = [C(0.16, 0.34, 5, c, 0, 2.5, 0, 6)];
  const branch = (x, y, z, l, rz, ry) => {
    const g = new THREE.CylinderGeometry(0.05, 0.13, l, 5);
    g.translate(0, l / 2, 0);
    g.rotateZ(rz);
    g.rotateY(ry);
    g.translate(x, y, z);
    P.push(tint(g, c));
  };
  branch(0, 3, 0, 2.4, 0.9, 0.3);
  branch(0, 3.6, 0, 2, -1, 1.2);
  branch(0, 4.5, 0, 1.6, 0.6, 2.4);
  branch(0, 2.2, 0, 1.6, -0.9, 3.6);
  return mergeGeos(P);
}
function pine() {
  const P = [C(0.32, 0.42, 2.6, "#5a4030", 0, 1.3, 0, 7)];
  [[0, 2.2, 3.1, 3.4], [0, 4.3, 2.4, 3], [0, 6.2, 1.7, 2.6]].forEach(([, y, r, h]) => {
    P.push(moved(tint(new THREE.ConeGeometry(r, h, 9), "#2f6a56"), 0, y + h / 2, 0));
    P.push(moved(tint(new THREE.ConeGeometry(r * 0.72, h * 0.55, 9), "#f4fbff"), 0, y + h * 0.74, 0));
  });
  return mergeGeos(P);
}
function crystal() {
  const P = [];
  const add = (x, z, h, r, rx, rz) => {
    const g = new THREE.OctahedronGeometry(1, 0);
    g.scale(r, h, r);
    g.rotateX(rx);
    g.rotateZ(rz);
    g.translate(x, h * 0.72, z);
    P.push(tint(g, "#a8e4ff"));
  };
  add(0, 0, 5, 1.2, 0.05, 0.08);
  add(1.5, 0.4, 3.2, 0.9, -0.1, -0.3);
  add(-1.2, -0.6, 2.8, 0.8, 0.2, 0.3);
  return mergeGeos(P);
}
function floodlight() {
  const P = [C(0.28, 0.5, 26, "#3e4250", 0, 13, 0, 8), B(7, 3.4, 0.5, "#2a2d36", 0, 27, 0)];
  for (let j = 0; j < 3; j += 1) for (let i = 0; i < 6; i += 1) P.push(moved(tint(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 10).rotateX(Math.PI / 2), "#fff8e0"), -2.75 + i * 1.1, 26 + j * 1, 0.32));
  return mergeGeos(P);
}
function flagPole() {
  const P = [C(0.07, 0.09, 9, "#d8dade", 0, 4.5, 0, 6)];
  const f = new THREE.PlaneGeometry(3, 1.7, 3, 1);
  const p = f.attributes.position;
  for (let i = 0; i < p.count; i += 1) p.setZ(i, Math.sin(p.getX(i) * 1.8) * 0.2);
  f.translate(1.55, 8, 0);
  const t = tint(f, "#ffffff");
  P.push(t);
  return mergeGeos(P);
}
/** 관중석 한 칸. UV 로 관중 무늬. 길이 L, 깊이 D, 높이 H */
function grandstand(L = 22, D = 12, H = 9, rows = 7) {
  const crowd = [];
  const frame = [];
  for (let i = 0; i < rows; i += 1) {
    const y = ((i + 0.5) / rows) * H;
    const z = ((i + 0.5) / rows) * D;
    const g = new THREE.BoxGeometry(L, H / rows, D / rows);
    g.translate(0, y, z);
    const uv = g.attributes.uv;
    const n = g.attributes.normal;
    for (let k = 0; k < uv.count; k += 1) {
      if (n.getZ(k) < -0.5) uv.setXY(k, uv.getX(k) * (L / 15), (i + uv.getY(k)) / 12);
      else uv.setXY(k, 0.002, 0.002);
    }
    crowd.push(g);
  }
  frame.push(B(L + 0.4, H * 1.4, 0.6, "#2c3040", 0, H * 0.7, D + 0.3));
  frame.push(B(L + 2, 0.5, D + 3, "#3a3f52", 0, H * 1.4 + 0.2, D * 0.62));
  for (const s of [-1, 1]) frame.push(C(0.2, 0.2, H * 1.4, "#555a68", s * L * 0.48, H * 0.7, 0.6, 7));
  return { crowd: mergeGeos(crowd), frame: mergeGeos(frame) };
}

/* ---------- 본체 ---------- */
export class WorldView {
  constructor(renderer, scene, level, { theme, quality = 1, stands = false, seed = 1, noFinish = false } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.level = level;
    this.themeId = theme || level.theme.id;
    this.look = LOOKS[this.themeId];
    this.quality = quality;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.disposables = [];
    this.anim = [];
    this.smokers = [];
    this.flames = [];
    this.rand = rng(seed * 7919 + level.samples.length * 13 + Math.round(level.length));
    this.setupSky();
    this.buildGround();
    this.buildTracks();
    this.buildRamps();
    this.buildWalls();
    this.buildMarks();
    if (!noFinish) this.buildGates();
    this.buildDecor(stands);
    this.buildWeather();
  }

  own(x) {
    this.disposables.push(x);
    return x;
  }

  add(obj) {
    this.root.add(obj);
    return obj;
  }

  batch(geo, list, mat, { shadow = false, colors = null } = {}) {
    if (!list.length) return null;
    this.own(geo);
    this.own(mat);
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const P = new THREE.Vector3();
    const S = new THREE.Vector3();
    const E = new THREE.Euler();
    list.forEach((q, i) => {
      E.set(q.rx || 0, q.th || 0, q.rz || 0);
      Q.setFromEuler(E);
      P.set(q.x, q.y, q.z);
      if (Array.isArray(q.s)) S.set(q.s[0], q.s[1], q.s[2]);
      else S.setScalar(q.s || 1);
      M.compose(P, Q, S);
      m.setMatrixAt(i, M);
      if (colors) m.setColorAt(i, new THREE.Color(colors(q, i)));
    });
    m.frustumCulled = false;
    m.castShadow = shadow && this.quality >= 1;
    m.receiveShadow = false;
    this.disposables.push({ dispose: () => m.dispose() });
    this.add(m);
    return m;
  }

  setupSky() {
    const { scene, look, themeId } = this;
    const sky = skyTexture(themeId);
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(760, 24, 14), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    this.skyMesh.renderOrder = -10;
    this.own(this.skyMesh.geometry);
    this.own(this.skyMesh.material);
    this.add(this.skyMesh);
    const far = new THREE.Mesh(new THREE.CylinderGeometry(600, 600, 150, 40, 1, true), new THREE.MeshBasicMaterial({ map: farTexture(themeId), side: THREE.BackSide, transparent: true, fog: false, depthWrite: false, toneMapped: false, alphaTest: 0.02 }));
    far.renderOrder = -9;
    this.farMesh = far;
    this.own(far.geometry);
    this.own(far.material);
    this.add(far);
    // 먼 땅
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshBasicMaterial({ color: look.outer2 }));
    plane.rotation.x = -Math.PI / 2;
    this.own(plane.geometry);
    this.own(plane.material);
    this.farPlane = plane;
    this.add(plane);
    scene.fog = new THREE.Fog(look.fog, look.near, look.far);
    scene.background = new THREE.Color(look.fog);
    // 반사
    scene.environment = themeEnv(this.renderer, themeId);
    scene.environmentIntensity = look.env;
    const hemi = new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]);
    this.add(hemi);
    const sun = new THREE.DirectionalLight(look.sun, look.sunI);
    const d = look.sunDir;
    this.sunDir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    sun.castShadow = this.quality > 0.4;
    const size = this.quality >= 1 ? 2048 : 1024;
    sun.shadow.mapSize.set(size, size);
    const R = 46;
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 260 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    this.sun = sun;
    this.add(sun);
    this.add(sun.target);
  }

  buildGround() {
    const { level, look, quality } = this;
    const step = quality >= 1 ? 2 : quality >= 0.6 ? 2 : 3;
    const { nx, nz, x0, z0, H, O, M } = level;
    const cols = Math.ceil((nx - 1) / step) + 1;
    const rows = Math.ceil((nz - 1) / step) + 1;
    const used = new Int32Array(cols * rows).fill(-1);
    const cell = (i, j) => Math.min(i * step, nx - 1) + Math.min(j * step, nz - 1) * nx;
    const quads = [];
    const iceQ = [];
    const lavaQ = [];
    let count = 0;
    const pos = [];
    const nor = [];
    const col = [];
    const uv = [];
    const c0 = new THREE.Color(look.road);
    const c1 = new THREE.Color(look.road2);
    const cE = new THREE.Color(look.edge);
    const cO = new THREE.Color(look.outer);
    const cO2 = new THREE.Color(look.outer2);
    const cI = new THREE.Color(look.ice);
    const cS = new THREE.Color("#eef6fb");
    const cA = new THREE.Color("#55585f");
    const cB = new THREE.Color("#0c0b0f");
    const cL = new THREE.Color("#ff5a18");
    const tmp = new THREE.Color();
    const tmp2 = new THREE.Color();
    const n1 = tileNoise(128, 8, 41);
    const n2 = tileNoise(128, 22, 53);
    const nS = (A, x, z, scale) => A[(Math.floor(x * scale) & 127) + (Math.floor(z * scale) & 127) * 128];
    const vert = (i, j) => {
      const k = i + j * cols;
      if (used[k] >= 0) return used[k];
      const id = cell(i, j);
      const x = x0 + Math.min(i * step, nx - 1);
      const z = z0 + Math.min(j * step, nz - 1);
      pos.push(x, H[id], z);
      const ix = id % nx;
      const jz = (id / nx) | 0;
      const hx = H[Math.min(nx - 1, ix + 1) + jz * nx] - H[Math.max(0, ix - 1) + jz * nx];
      const hz = H[ix + Math.min(nz - 1, jz + 1) * nx] - H[ix + Math.max(0, jz - 1) * nx];
      const L = Math.hypot(hx, 2, hz);
      nor.push(-hx / L, 2 / L, -hz / L);
      uv.push(x / 7, z / 7);
      const o = O[id];
      const m = M[id];
      const a = nS(n1, x, z, 0.6);
      const b = nS(n2, x, z, 1.4);
      tmp.copy(c0).lerp(c1, smooth((a * 0.7 + b * 0.3 - 0.3) * 2.4));
      if (m === MAT.SNOW && this.themeId !== "frozen") tmp.copy(cS);
      if (m === MAT.ASPHALT && this.themeId !== "city") tmp.copy(cA);
      if (m === MAT.ICE) tmp.copy(cI).lerp(cS, b * 0.34);
      // 벽 쪽은 어둡게, 바깥은 흙더미 색
      if (o > -3) tmp.lerp(cE, smooth((o + 3) / 3) * 0.6);
      if (o > 0) {
        tmp2.copy(cO).lerp(cO2, smooth((b - 0.3) * 2));
        tmp.lerp(tmp2, smooth(o / 3));
      }
      if (m === MAT.LAVA) tmp.copy(cL);
      if (m === MAT.VOID) tmp.copy(cB);
      // 파인 곳은 어둡게
      const slope = Math.hypot(hx, hz) * 0.5;
      if (slope > 0.5) tmp.multiplyScalar(1 - Math.min(0.28, (slope - 0.5) * 0.24));
      col.push(tmp.r, tmp.g, tmp.b);
      used[k] = count;
      count += 1;
      return used[k];
    };
    for (let j = 0; j < rows - 1; j += 1) {
      for (let i = 0; i < cols - 1; i += 1) {
        const a = cell(i, j);
        const b = cell(i + 1, j);
        const c = cell(i, j + 1);
        const d = cell(i + 1, j + 1);
        if (Math.min(O[a], O[b], O[c], O[d]) > 44) continue;
        const va = vert(i, j);
        const vb = vert(i + 1, j);
        const vc = vert(i, j + 1);
        const vd = vert(i + 1, j + 1);
        const ice = M[a] === MAT.ICE && M[d] === MAT.ICE;
        (ice ? iceQ : quads).push(va, vc, vb, vb, vc, vd);
        if (M[a] === MAT.LAVA || M[b] === MAT.LAVA || M[c] === MAT.LAVA || M[d] === MAT.LAVA) lavaQ.push(i, j);
      }
    }
    const attr = {
      position: new THREE.BufferAttribute(new Float32Array(pos), 3),
      normal: new THREE.BufferAttribute(new Float32Array(nor), 3),
      color: new THREE.BufferAttribute(new Float32Array(col), 3),
      uv: new THREE.BufferAttribute(new Float32Array(uv), 2),
    };
    const makeGeo = (list) => {
      const g = new THREE.BufferGeometry();
      for (const k of Object.keys(attr)) g.setAttribute(k, attr[k]);
      g.setIndex(list);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
      return this.own(g);
    };
    const tex = detailTextures(look.detail);
    const ground = new THREE.Mesh(makeGeo(quads), this.own(new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true, roughness: look.detail === "snow" ? 0.82 : look.detail === "asphalt" ? 0.8 : 0.96, metalness: 0, envMapIntensity: 0.4 })));
    ground.receiveShadow = true;
    ground.frustumCulled = false;
    this.ground = ground;
    this.add(ground);
    if (iceQ.length) {
      const iceT = detailTextures("snow");
      const ice = new THREE.Mesh(makeGeo(iceQ), this.own(new THREE.MeshStandardMaterial({ map: iceT.map, normalMap: iceT.normalMap, normalScale: new THREE.Vector2(0.25, 0.25), vertexColors: true, roughness: 0.08, metalness: 0.15, envMapIntensity: 1.6 })));
      ice.receiveShadow = true;
      ice.frustumCulled = false;
      this.add(ice);
    }
    // 먼 땅은 가장 낮은 곳보다 조금 아래
    let lo = 1e9;
    for (let k = 1; k < pos.length; k += 3) lo = Math.min(lo, pos[k]);
    this.farPlane.position.y = lo - 2.5;
    this.baseY = lo;
    if (lavaQ.length) this.buildLava(lavaQ, step, cell);
  }

  buildLava(cells, step, cell) {
    const { level } = this;
    const p = [];
    const uv = [];
    for (let k = 0; k < cells.length; k += 2) {
      const i = cells[k];
      const j = cells[k + 1];
      const a = cell(i, j);
      const b = cell(i + 1, j);
      const c = cell(i, j + 1);
      const d = cell(i + 1, j + 1);
      const y = Math.min(level.H[a], level.H[b], level.H[c], level.H[d]) + 1.1;
      const x0 = level.x0 + a % level.nx;
      const z0 = level.z0 + ((a / level.nx) | 0);
      const x1 = x0 + step;
      const z1 = z0 + step;
      p.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
      uv.push(x0, z0, x0, z1, x1, z0, x1, z0, x0, z1, x1, z1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
    const noise = new THREE.DataTexture((() => {
      const S = 128;
      const a = tileNoise(S, 7, 3);
      const b = tileNoise(S, 19, 8);
      const d = new Uint8Array(S * S * 4);
      for (let i = 0; i < S * S; i += 1) {
        const v = a[i] * 0.7 + b[i] * 0.3;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.round(v * 255);
        d[i * 4 + 3] = 255;
      }
      return d;
    })(), 128, 128);
    noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
    noise.minFilter = noise.magFilter = THREE.LinearFilter;
    noise.needsUpdate = true;
    this.own(noise);
    const u = { uT: { value: 0 }, uN: { value: noise } };
    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: "varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `uniform float uT;uniform sampler2D uN;varying vec2 v;
void main(){float a=texture2D(uN,v*.035+vec2(uT*.02,uT*.012)).r;float b=texture2D(uN,v*.09-vec2(uT*.03,-uT*.018)).r;float k=smoothstep(.34,.72,a*.6+b*.5);
vec3 c=mix(vec3(.22,.03,.01),vec3(1.5,.42,.05),k);c=mix(c,vec3(2.2,1.5,.5),smoothstep(.72,.95,a*.5+b*.6));gl_FragColor=vec4(c,1.);}`,
    });
    const m = new THREE.Mesh(this.own(g), this.own(mat));
    m.frustumCulled = false;
    this.add(m);
    this.anim.push((dt, t) => {
      u.uT.value = t;
    });
  }

  /* 땅의 바퀴 자국 */
  buildTracks() {
    const { level, themeId } = this;
    if (themeId === "city" && !level.shape) {
      this.buildLaneMarks();
      return;
    }
    const pos = [];
    const uv = [];
    const idx = [];
    const ribbon = (pts, w) => {
      let dist = 0;
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const L = Math.hypot(dx, dz) || 1;
        const nx = -dz / L;
        const nz = dx / L;
        const p = pts[i];
        if (i > 0) dist += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
        const lx = p[0] + nx * w * 0.5;
        const lz = p[1] + nz * w * 0.5;
        const rx = p[0] - nx * w * 0.5;
        const rz = p[1] - nz * w * 0.5;
        const base = pos.length / 3;
        pos.push(lx, level.height(lx, lz) + 0.12, lz, rx, level.height(rx, rz) + 0.12, rz);
        uv.push(0, dist / 1.4, 1, dist / 1.4);
        if (i > 0) idx.push(base - 2, base - 1, base, base, base - 1, base + 1);
      }
    };
    const r = this.rand;
    if (level.shape) {
      const { rx, rz } = level.shape;
      for (let k = 0; k < 9; k += 1) {
        const pts = [];
        const ax = rx * (0.25 + r() * 0.6);
        const az = rz * (0.25 + r() * 0.6);
        const cx = (r() - 0.5) * rx * 0.3;
        const cz = (r() - 0.5) * rz * 0.3;
        const ph = r() * 6.28;
        const span = 2 + r() * 3.5;
        for (let t = 0; t < span; t += 0.05) pts.push([cx + Math.cos(ph + t) * ax, cz + Math.sin(ph + t) * az]);
        ribbon(pts, 1.3);
      }
    } else {
      for (let k = 0; k < 5; k += 1) {
        const d0 = (k - 2) * 3.4 + (r() - 0.5) * 1.5;
        const f = 0.012 + r() * 0.02;
        const ph = r() * 6.28;
        const pts = [];
        for (let i = 0; i < level.samples.length; i += 3) {
          const q = level.samples[i];
          const d = d0 + Math.sin(q.s * f + ph) * 1.6;
          if (Math.abs(d) > q.w / 2 - 1.5) continue;
          if (level.mat(q.x, q.z) === MAT.LAVA || level.mat(q.x, q.z) === MAT.VOID) continue;
          pts.push([q.x - Math.cos(q.th) * d, q.z + Math.sin(q.th) * d]);
        }
        // 끊어진 곳이 멀면 나눈다
        let seg = [];
        for (const p of pts) {
          if (seg.length && Math.hypot(p[0] - seg[seg.length - 1][0], p[1] - seg[seg.length - 1][1]) > 8) {
            if (seg.length > 2) ribbon(seg, 1.3);
            seg = [];
          }
          seg.push(p);
        }
        if (seg.length > 2) ribbon(seg, 1.3);
      }
    }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const t = this.own(treadTex());
    const m = new THREE.Mesh(this.own(g), this.own(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: this.themeId === "frozen" ? 0.4 : 0.56, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
    m.frustumCulled = false;
    m.renderOrder = 1;
    this.add(m);
  }

  buildLaneMarks() {
    const { level } = this;
    const list = [];
    for (let i = 4; i < level.samples.length; i += 9) {
      const q = level.samples[i];
      const m = level.mat(q.x, q.z);
      if (m === MAT.LAVA || m === MAT.VOID) continue;
      list.push({ x: q.x, y: level.height(q.x, q.z) + 0.1, z: q.z, th: q.th });
    }
    const g = new THREE.PlaneGeometry(0.34, 4).rotateX(-Math.PI / 2);
    this.batch(g, list, new THREE.MeshBasicMaterial({ color: "#f2e9c8", transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  }

  buildRamps() {
    const { level } = this;
    if (!level.ramps.length) return;
    const pos = [];
    const uv = [];
    const idx = [];
    const steel = [];
    level.ramps.forEach((r) => {
      const fx = Math.sin(r.th);
      const fz = Math.cos(r.th);
      const rx = -fz;
      const rz = fx;
      const nL = Math.max(4, Math.round(r.l / 1));
      const nW = 3;
      const base = pos.length / 3;
      const hw = r.w / 2;
      for (let j = 0; j <= nL; j += 1) {
        const a = (j / nL) * r.l;
        for (let i = 0; i <= nW; i += 1) {
          const d = (i / nW - 0.5) * r.w;
          const x = r.x + fx * a + rx * d;
          const z = r.z + fz * a + rz * d;
          const inset = Math.max(Math.abs(d) - 0.2, 0);
          const sx = r.x + fx * a + rx * Math.sign(d) * Math.min(inset, hw - 0.2);
          const sz = r.z + fz * a + rz * Math.sign(d) * Math.min(inset, hw - 0.2);
          pos.push(x, level.height(sx, sz) + 0.16, z);
          uv.push(i / nW, (a / r.w) * 0.9);
        }
      }
      for (let j = 0; j < nL; j += 1) {
        for (let i = 0; i < nW; i += 1) {
          const k = base + i + j * (nW + 1);
          idx.push(k, k + 1, k + nW + 1, k + 1, k + nW + 2, k + nW + 1);
        }
      }
      // 끝판 · 옆 난간 · 다리
      const lx = r.x + fx * r.l;
      const lz = r.z + fz * r.l;
      const top = level.height(lx - fx * 0.5, lz - fz * 0.5) + 0.16;
      const floor = level.height(lx + fx * 2.2, lz + fz * 2.2);
      const drop = Math.max(0.6, top - floor);
      const lip = new THREE.BoxGeometry(r.w + 0.5, 0.26, 0.5);
      lip.rotateY(r.th);
      lip.translate(lx, top, lz);
      steel.push(tint(lip, "#ffc81e"));
      for (let i = -1; i <= 1; i += 1) {
        const lg = new THREE.CylinderGeometry(0.14, 0.18, drop + 0.6, 8);
        const px = lx + rx * i * hw * 0.85 + fx * 0.8;
        const pz = lz + rz * i * hw * 0.85 + fz * 0.8;
        lg.translate(px, top - (drop + 0.6) / 2, pz);
        steel.push(tint(lg, "#3a3d44"));
      }
      const brace = new THREE.BoxGeometry(r.w, 0.14, 0.14);
      brace.rotateY(r.th);
      brace.translate(lx + fx * 0.8, top - drop * 0.55, lz + fz * 0.8);
      steel.push(tint(brace, "#3a3d44"));
      for (const s of [-1, 1]) {
        for (let j = 0; j < 4; j += 1) {
          const a0 = (j / 4) * r.l;
          const a1 = ((j + 1) / 4) * r.l;
          const ex = r.x + rx * s * (hw + 0.1);
          const ez = r.z + rz * s * (hw + 0.1);
          const y0 = level.height(r.x + fx * a0 + rx * s * (hw - 0.3), r.z + fz * a0 + rz * s * (hw - 0.3)) + 0.34;
          const y1 = level.height(r.x + fx * a1 + rx * s * (hw - 0.3), r.z + fz * a1 + rz * s * (hw - 0.3)) + 0.34;
          const len = Math.hypot(a1 - a0, y1 - y0);
          const rail = new THREE.BoxGeometry(0.2, 0.34, len);
          rail.rotateX(-Math.atan2(y1 - y0, a1 - a0));
          rail.rotateY(r.th);
          rail.translate(ex + (fx * (a0 + a1)) / 2, (y0 + y1) / 2, ez + (fz * (a0 + a1)) / 2);
          steel.push(tint(rail, j % 2 ? "#ffc81e" : "#1b1b1f"));
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const tex = this.own(rampTex());
    tex.wrapT = THREE.RepeatWrapping;
    const deck = new THREE.Mesh(this.own(g), this.own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.46, metalness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
    deck.receiveShadow = true;
    deck.castShadow = true;
    deck.frustumCulled = false;
    this.add(deck);
    const st = new THREE.Mesh(this.own(mergeGeos(steel)), this.own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5 })));
    st.castShadow = true;
    st.frustumCulled = false;
    this.add(st);
  }

  /** 벽이 놓일 곳들: 길 가장자리를 따라 일정 간격 */
  edgeSpots(spacing, off = 1.1) {
    const { level } = this;
    const out = [];
    const accept = (x, z, th) => {
      if (level.off(x, z) < off * 0.3) return;
      out.push({ x, y: level.height(x, z), z, th });
    };
    if (level.shape) {
      const { rx, rz, r } = level.shape;
      const Rx = rx + off;
      const Rz = rz + off;
      const Rr = r + off;
      const pts = [];
      const hx = Rx - Rr;
      const hz = Rz - Rr;
      const lineTo = (x0, z0, x1, z1) => {
        const L = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(1, Math.round(L / spacing));
        for (let i = 0; i < n; i += 1) {
          const t = (i + 0.5) / n;
          pts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, Math.atan2(x1 - x0, z1 - z0)]);
        }
      };
      const arc = (cx, cz, a0) => {
        const L = (Math.PI / 2) * Rr;
        const n = Math.max(2, Math.round(L / spacing));
        for (let i = 0; i < n; i += 1) {
          const a = a0 + ((i + 0.5) / n) * (Math.PI / 2);
          pts.push([cx + Math.sin(a) * Rr, cz + Math.cos(a) * Rr, a + Math.PI / 2]);
        }
      };
      lineTo(-hx, Rz, hx, Rz);
      arc(hx, hz, 0);
      lineTo(Rx, hz, Rx, -hz);
      arc(hx, -hz, Math.PI / 2);
      lineTo(hx, -Rz, -hx, -Rz);
      arc(-hx, -hz, Math.PI);
      lineTo(-Rx, -hz, -Rx, hz);
      arc(-hx, hz, Math.PI * 1.5);
      for (const p of pts) accept(p[0], p[1], p[2]);
      return out;
    }
    const lists = [level.samples, ...this.extraLists()];
    for (const list of lists) {
      for (const side of [-1, 1]) {
        let last = null;
        for (let i = 0; i < list.length; i += 1) {
          const q = list[i];
          const hw = q.w / 2 + off;
          const x = q.x - Math.cos(q.th) * side * hw;
          const z = q.z + Math.sin(q.th) * side * hw;
          if (last && Math.hypot(x - last[0], z - last[1]) < spacing) continue;
          const dropped = Math.abs(level.height(x, z) - q.y) > 3.2;
          if (dropped) continue;
          last = [x, z];
          accept(x, z, q.th + Math.PI / 2 + (side > 0 ? 0 : Math.PI));
        }
      }
    }
    return out;
  }

  extraLists() {
    return this.level.extra || [];
  }

  buildWalls() {
    const { themeId } = this;
    const spots = this.edgeSpots(3.05, 0.9);
    const stoneMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02 });
    if (themeId === "volcano") {
      const g = new THREE.DodecahedronGeometry(1.5, 0);
      g.scale(1.2, 1, 1);
      const r = this.rand;
      const list = spots.map((q) => ({ ...q, y: q.y + 0.4, th: r() * 6.28, rx: r() * 0.5, s: 0.8 + r() * 0.65 }));
      const mesh = this.batch(tint(g.toNonIndexed(), "#2e2322"), list, stoneMat(), { shadow: true });
      void mesh;
      return;
    }
    if (themeId === "frozen") {
      const g = new THREE.SphereGeometry(1.9, 8, 6);
      g.scale(1.1, 0.62, 0.8);
      const r = this.rand;
      const list = spots.map((q) => ({ ...q, y: q.y + 0.2, s: 0.86 + r() * 0.3 }));
      this.batch(tint(g.toNonIndexed(), "#f4fbff"), list, stoneMat());
      const posts = spots.filter((_, i) => i % 3 === 0).map((q) => ({ ...q }));
      const pole = mergeGeos([C(0.07, 0.08, 2.5, "#3c86d8", 0, 1.25, 0, 6), C(0.08, 0.08, 0.4, "#ffffff", 0, 2.1, 0, 6), C(0.08, 0.08, 0.4, "#ffffff", 0, 1.2, 0, 6)]);
      this.batch(pole, posts, stoneMat());
      return;
    }
    // 콘크리트 방벽
    const prof = new THREE.Shape();
    const P = [[-0.48, 0], [-0.48, 0.2], [-0.2, 0.42], [-0.13, 1.08], [0.13, 1.08], [0.2, 0.42], [0.48, 0.2], [0.48, 0]];
    P.forEach((p, i) => (i ? prof.lineTo(p[0], p[1]) : prof.moveTo(p[0], p[1])));
    prof.closePath();
    const wall = new THREE.ExtrudeGeometry(prof, { depth: 3, bevelEnabled: false });
    wall.translate(0, 0, -1.5);
    wall.rotateY(Math.PI / 2);
    const concrete = tint(wall.toNonIndexed(), "#ffffff");
    const colorFn = {
      scrap: (q, i) => ["#b8b4aa", "#b8b4aa", "#d8b23e", "#b8b4aa", "#b8b4aa", "#c0503c"][i % 6],
      city: (q, i) => (i % 2 ? "#a8a6a0" : "#c9c7c0"),
      stadium: (q, i) => ["#e0342a", "#f4f4f4", "#2f62d6", "#f4f4f4", "#ffc81e", "#f4f4f4"][i % 6],
    }[themeId];
    this.batch(concrete, spots, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), { shadow: true, colors: colorFn });
    // 철망 + 기둥
    const fenceSpots = spots.filter((_, i) => (themeId === "city" ? i % 2 === 0 : true));
    const net = new THREE.PlaneGeometry(3.05, 2.5);
    net.translate(0, 2.35, 0);
    const uv = net.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * 4.4, uv.getY(i) * 3.6);
    const ft = this.own(fenceTex());
    this.batch(net, fenceSpots, new THREE.MeshStandardMaterial({ map: ft, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.6, depthWrite: false }));
    const post = mergeGeos([C(0.06, 0.06, 2.8, "#8c9198", -1.52, 2.3, 0, 6), B(3.05, 0.05, 0.05, "#8c9198", 0, 3.6, 0)]);
    this.batch(post, fenceSpots, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 }));
  }

  buildMarks() {
    const { level } = this;
    // 부스터 판
    if (level.pads.length) {
      const list = level.pads.map((p) => ({ x: p.x, y: level.height(p.x, p.z) + 0.14, z: p.z, th: p.th }));
      const g = new THREE.PlaneGeometry(6, 7.2).rotateX(-Math.PI / 2);
      g.rotateY(Math.PI);
      const tex = this.own(padTex());
      tex.repeat.set(1, 1.5);
      const base = new THREE.PlaneGeometry(6.6, 7.8).rotateX(-Math.PI / 2);
      this.batch(base, list.map((q) => ({ ...q, y: q.y - 0.02 })), new THREE.MeshBasicMaterial({ color: "#20130a", transparent: true, opacity: 0.74, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      this.batch(g, list, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false }));
      this.anim.push((dt, t) => {
        tex.offset.y = -t * 1.4;
      });
    }
    // 착지 목표
    if (level.zones.length) {
      for (const z of level.zones) {
        const ring = new THREE.Mesh(this.own(new THREE.RingGeometry(z.r - 0.9, z.r, 40).rotateX(-Math.PI / 2)), this.own(new THREE.MeshBasicMaterial({ color: "#ffd21f", transparent: true, opacity: 0.86, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, toneMapped: false })));
        const disc = new THREE.Mesh(this.own(new THREE.CircleGeometry(z.r, 40).rotateX(-Math.PI / 2)), this.own(new THREE.MeshBasicMaterial({ color: "#ffd21f", transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
        const y = level.height(z.x, z.z) + 0.2;
        ring.position.set(z.x, y, z.z);
        disc.position.set(z.x, y - 0.02, z.z);
        this.add(ring);
        this.add(disc);
        this.anim.push((dt, t) => {
          disc.material.opacity = 0.14 + Math.sin(t * 4) * 0.08;
          const s = 1 + Math.sin(t * 3) * 0.02;
          ring.scale.set(s, 1, s);
        });
      }
    }
    // 불기둥 구멍
    if (level.geysers.length) {
      const g = mergeGeos([C(1.5, 1.8, 0.5, "#2a2523", 0, 0.1, 0, 12), C(1.0, 1.0, 0.54, "#ff4a10", 0, 0.12, 0, 12)]);
      this.batch(g, level.geysers.map((q) => ({ x: q.x, y: level.height(q.x, q.z), z: q.z })), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, emissive: "#ff2a00", emissiveIntensity: 0.25 }));
    }
  }

  buildGates() {
    const { level } = this;
    if (level.shape) return;
    const gate = (x, z, y, th, w, label) => {
      const tall = 8.4;
      const P = [];
      const hw = w / 2 + 1.4;
      for (const s of [-1, 1]) {
        P.push(B(1.1, tall, 1.1, s > 0 ? "#e0301e" : "#1f62c8", s * hw, tall / 2, 0, 0.14));
        P.push(B(1.5, 0.6, 1.5, "#2a2d36", s * hw, 0.3, 0));
      }
      P.push(B(hw * 2 + 1, 0.3, 0.3, "#2a2d36", 0, tall - 0.1, 0.5), B(hw * 2 + 1, 0.3, 0.3, "#2a2d36", 0, tall - 2.7, 0.5));
      const frame = new THREE.Mesh(this.own(mergeGeos(P)), this.own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.25 })));
      frame.castShadow = true;
      frame.position.set(x, y, z);
      frame.rotation.y = th;
      this.add(frame);
      const tex = this.own(label === "start" ? canvasTex(1024, 128, (c, W, H) => {
        c.fillStyle = "#14141c";
        c.fillRect(0, 0, W, H);
        c.font = "900 84px Arial Black, Impact, sans-serif";
        c.fillStyle = "#ffd21f";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("MONSTER TRUCK MAYHEM", W / 2, H / 2 + 4);
      }) : checkerTex());
      if (label !== "start") {
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.set(4, 1);
      }
      const banner = new THREE.Mesh(this.own(new THREE.PlaneGeometry(hw * 2, 2.4)), this.own(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false })));
      banner.position.set(x + Math.sin(th) * 0.4, y + tall - 1.4, z + Math.cos(th) * 0.4);
      banner.rotation.y = th;
      this.add(banner);
    };
    const a = level.samples[0];
    gate(a.x + Math.sin(a.th) * 8, a.z + Math.cos(a.th) * 8, level.height(a.x, a.z), a.th, a.w, "start");
    if (level.finish) gate(level.finish.x, level.finish.z, level.finish.y, level.finish.th, level.finish.w, "finish");
  }

  /** 장식 자리: 길에서 떨어진 곳 */
  decorSpots(every, dMin, dMax) {
    const { level } = this;
    const r = this.rand;
    const out = [];
    if (level.shape) {
      const { rx, rz } = level.shape;
      const perim = (rx + rz) * 4;
      const n = Math.max(4, Math.round(perim / every));
      for (let i = 0; i < n; i += 1) {
        const a = ((i + r() * 0.4) / n) * Math.PI * 2;
        const d = dMin + r() * (dMax - dMin);
        const sq = Math.max(Math.abs(Math.cos(a)) / (rx + d), Math.abs(Math.sin(a)) / (rz + d));
        const x = Math.cos(a) / sq;
        const z = Math.sin(a) / sq;
        if (level.off(x, z) < dMin * 0.7) continue;
        out.push({ x, z, y: level.height(x, z), th: Math.atan2(-x, -z), dist: d });
      }
      return out;
    }
    for (let i = 8; i < level.samples.length; i += Math.max(1, Math.round(every * (0.8 + r() * 0.5)))) {
      const q = level.samples[i];
      const side = r() < 0.5 ? -1 : 1;
      const d = q.w / 2 + dMin + r() * (dMax - dMin);
      const x = q.x - Math.cos(q.th) * side * d;
      const z = q.z + Math.sin(q.th) * side * d;
      if (level.off(x, z) < dMin * 0.7) continue;
      out.push({ x, z, y: level.height(x, z), th: q.th + (side > 0 ? Math.PI / 2 : -Math.PI / 2), dist: d - q.w / 2 });
    }
    return out;
  }

  buildDecor(stands) {
    const r = this.rand;
    const std = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.12 });
    const id = this.themeId;
    const spin = (q) => ({ ...q, th: q.th + (r() - 0.5) * 1.2 });

    if (id === "scrap") {
      this.batch(wreckPile(), this.decorSpots(38, 7, 20).map(spin), std(), { shadow: true });
      this.batch(tireHeap(), this.decorSpots(28, 2.5, 8).map((q) => ({ ...spin(q), s: 1 + r() * 0.4 })), std(), { shadow: true });
      this.batch(containerStack(), this.decorSpots(90, 12, 26).map(spin), std(), { shadow: true });
      this.batch(latticeTower(), this.decorSpots(130, 16, 30), std(), { shadow: true });
      this.batch(crane(), this.decorSpots(170, 20, 30).map(spin), std());
      this.batch(oilTank(), this.decorSpots(120, 16, 30).map(spin), std());
      this.billboards(this.decorSpots(95, 5, 12));
      for (const q of this.decorSpots(70, 8, 18).slice(0, 8)) this.smokers.push({ x: q.x, y: q.y + 4, z: q.z });
    } else if (id === "city") {
      const blds = this.decorSpots(11, 7, 30).map((q) => {
        const w = 8 + r() * 12;
        const d = 8 + r() * 12;
        const h = 10 + r() * 34;
        return { x: q.x, y: q.y - 0.3, z: q.z, th: q.th + (r() - 0.5) * 0.16, s: [w, h, d] };
      });
      const wall = ["#d8735a", "#e0b35a", "#6f9ac2", "#b98ac0", "#7fb08a", "#d9d2c4", "#c7856a", "#8fa0b8"];
      const tex = this.own(windowsTex());
      this.batch(building(), blds, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.05, emissive: "#ffcc77", emissiveMap: tex, emissiveIntensity: 0.05 }), { shadow: true, colors: (q, i) => wall[i % wall.length] });
      const rubble = mergeGeos([B(3, 1.2, 2.4, "#8d8a86", 0, 0.6, 0, 0, [0.2, 0.4, 0.1]), B(2.2, 1, 2, "#a19c94", 1.8, 0.45, 1.1, 0, [0, 1, 0.3]), B(1.4, 0.8, 1.6, "#6d6a66", -1.5, 0.4, 1.2, 0, [0.3, 2, 0])]);
      this.batch(rubble, this.decorSpots(24, 2.4, 5).map(spin), std());
      this.batch(neonSign(), this.decorSpots(44, 2.4, 5), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: "#ffffff", emissiveIntensity: 0.12 }));
      this.batch(lamp(), this.decorSpots(22, 1.8, 3), std());
      this.billboards(this.decorSpots(120, 3, 6));
    } else if (id === "volcano") {
      this.batch(spire(), this.decorSpots(16, 5, 30).map((q) => ({ ...q, th: r() * 6.28, s: 0.7 + r() * 1.4 })), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, emissive: "#ff3a10", emissiveIntensity: 0.04 }), { shadow: true });
      this.batch(deadTree(), this.decorSpots(24, 3, 14).map((q) => ({ ...q, th: r() * 6.28, s: 0.9 + r() * 0.6 })), std());
      const pools = this.decorSpots(55, 6, 18);
      this.batch(new THREE.CircleGeometry(3.4, 18).rotateX(-Math.PI / 2), pools.map((q) => ({ ...q, y: q.y + 0.3, s: [1 + r(), 1, 1 + r()] })), new THREE.MeshBasicMaterial({ color: "#ff6a18", toneMapped: false }));
      this.batch(new THREE.RingGeometry(3.3, 4.1, 18).rotateX(-Math.PI / 2), pools.map((q) => ({ ...q, y: q.y + 0.28 })), new THREE.MeshBasicMaterial({ color: "#2a1210" }));
      for (const q of pools.slice(0, 10)) this.smokers.push({ x: q.x, y: q.y + 1, z: q.z, ember: true });
      this.billboards(this.decorSpots(160, 4, 8));
    } else if (id === "frozen") {
      const trees = this.decorSpots(9, 4, 34).map((q) => ({ ...q, th: r() * 6.28, s: 0.85 + r() * 0.85 }));
      this.batch(pine(), trees, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), { shadow: true });
      this.batch(crystal(), this.decorSpots(32, 3, 16).map((q) => ({ ...q, th: r() * 6.28, s: 0.8 + r() * 1 })), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.86, envMapIntensity: 2 }));
      const rock = new THREE.DodecahedronGeometry(2, 0);
      rock.scale(1.2, 0.8, 1);
      this.batch(tint(rock.toNonIndexed(), "#8a97a3"), this.decorSpots(40, 3, 18).map((q) => ({ ...q, th: r() * 6.28, s: 0.7 + r() })), std());
      this.billboards(this.decorSpots(160, 4, 8));
    } else if (id === "stadium") {
      stands = true;
      this.batch(floodlight(), this.decorSpots(64, 10, 13), std());
      this.batch(flagPole(), this.decorSpots(26, 2, 3.4), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), { colors: (q, i) => ["#e0342a", "#ffc81e", "#2f62d6", "#35c75a"][i % 4] });
      this.billboards(this.decorSpots(70, 4, 6));
      // 조명 기둥 빛
      const beams = this.decorSpots(120, 10, 13);
      const cone = new THREE.ConeGeometry(14, 30, 16, 1, true);
      cone.rotateX(Math.PI);
      cone.translate(0, 12, 0);
      this.batch(cone, beams, new THREE.MeshBasicMaterial({ color: "#c8d8ff", transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    }
    if (stands) this.buildStands();
    this.buildRings();
  }

  billboards(list) {
    if (!list.length) return;
    const tex = this.own(ledTex(this.themeId));
    const screen = new THREE.PlaneGeometry(12, 6);
    screen.translate(0, 9.2, 0.26);
    const frame = mergeGeos([C(0.3, 0.36, 6.4, "#3a3d44", -4, 3.2, 0, 8), C(0.3, 0.36, 6.4, "#3a3d44", 4, 3.2, 0, 8), B(12.8, 6.8, 0.4, "#20222a", 0, 9.2, 0), B(13, 0.22, 0.5, "#ffb91e", 0, 12.7, 0.06), B(13, 0.22, 0.5, "#ffb91e", 0, 5.7, 0.06), B(0.22, 7.2, 0.5, "#ffb91e", -6.5, 9.2, 0.06), B(0.22, 7.2, 0.5, "#ffb91e", 6.5, 9.2, 0.06)]);
    this.batch(frame, list, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3, emissive: "#3a2a00", emissiveIntensity: 0.4 }), { shadow: true });
    this.batch(screen, list, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: true }));
  }

  buildStands() {
    const { crowd, frame } = grandstand();
    const tex = this.own(crowdTex());
    const { level } = this;
    let list = [];
    if (level.shape) {
      const spots = this.edgeSpots(23.5, 5);
      list = spots.map((q) => ({ x: q.x, y: q.y - 0.2, z: q.z, th: q.th - Math.PI / 2 }));
      // 벽을 보는 쪽 확인
      list = list.map((q) => {
        const fx = Math.sin(q.th);
        const fz = Math.cos(q.th);
        return fx * q.x + fz * q.z > 0 ? q : { ...q, th: q.th + Math.PI };
      });
    } else {
      list = this.decorSpots(24, 5.5, 7).map((q) => ({ x: q.x, y: q.y - 0.2, z: q.z, th: q.th + Math.PI }));
    }
    this.batch(crowd, list, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.18 }));
    this.batch(frame, list, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 }));
  }

  /* 큰 점프대 앞의 불붙은 링 (참고 사진의 그것) */
  buildRings() {
    const { level } = this;
    if (this.themeId === "frozen") return;
    const big = level.ramps.filter((q) => q.h >= 3.2);
    const pick = big.filter((_, i) => i % 3 === 0).slice(0, 5);
    if (!pick.length) return;
    const list = [];
    pick.forEach((q) => {
      const fx = Math.sin(q.th);
      const fz = Math.cos(q.th);
      const x = q.x + fx * (q.l + 11);
      const z = q.z + fz * (q.l + 11);
      const y = level.height(q.x + fx * q.l, q.z + fz * q.l) + 5.2;
      list.push({ x, y, z, th: q.th });
      this.flames.push({ x, y, z, th: q.th, R: 4.6 });
    });
    const ring = new THREE.TorusGeometry(4.6, 0.34, 8, 28);
    this.batch(tint(ring.toNonIndexed(), "#3a2a22"), list, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6, emissive: "#ff5a10", emissiveIntensity: 0.7 }));
  }

  buildWeather() {
    const kind = { frozen: "snow", volcano: "ash", stadium: "confetti" }[this.themeId];
    if (!kind) return;
    const n = Math.round((kind === "snow" ? 700 : 340) * this.quality);
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const rd = new Float32Array(n);
    const r = rng(31);
    const cols = { snow: ["#ffffff"], ash: ["#ffb060", "#ff7a30", "#c8c0b8"], confetti: ["#ff4a4a", "#ffd21f", "#4ad8ff", "#7cf06a", "#ff7ae0"] }[kind];
    const C2 = new THREE.Color();
    for (let i = 0; i < n; i += 1) {
      pos[i * 3] = r() * 80;
      pos[i * 3 + 1] = r() * 40;
      pos[i * 3 + 2] = r() * 80;
      rd[i] = r();
      C2.set(cols[Math.floor(r() * cols.length)]);
      col[i * 3] = C2.r;
      col[i * 3 + 1] = C2.g;
      col[i * 3 + 2] = C2.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aCol", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aR", new THREE.BufferAttribute(rd, 1));
    const speed = { snow: [1.2, -4.2, 0.6], ash: [0.6, 1.3, -0.4], confetti: [0.5, -3.2, 0.4] }[kind];
    const size = { snow: 0.11, ash: 0.07, confetti: 0.13 }[kind];
    const u = { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uV: { value: new THREE.Vector3(...speed) }, uS: { value: size }, uK: { value: 500 } };
    const m = new THREE.ShaderMaterial({
      uniforms: u,
      transparent: true,
      depthWrite: false,
      vertexShader: `attribute vec3 aCol;attribute float aR;uniform float uT;uniform vec3 uC;uniform vec3 uV;uniform float uS;uniform float uK;varying vec3 vC;varying float vA;
void main(){vec3 b=vec3(80.,40.,80.);vec3 p=position+uV*uT*(.7+aR*.6);p.x+=sin(uT*.8+aR*20.)*1.2;p=mod(p-uC+b*.5,b)-b*.5+uC;vC=aCol;vec4 mv=modelViewMatrix*vec4(p,1.);vA=smoothstep(40.,18.,-mv.z)*smoothstep(1.5,5.,-mv.z);gl_PointSize=clamp(uS*uK/max(.5,-mv.z),1.5,7.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vC;varying float vA;void main(){vec2 p=gl_PointCoord*2.-1.;if(dot(p,p)>1.)discard;gl_FragColor=vec4(vC,vA*.9);}`,
    });
    const pts = new THREE.Points(this.own(g), this.own(m));
    pts.frustumCulled = false;
    this.add(pts);
    this.weather = u;
  }

  /** 매 프레임. focus = 트럭 위치 */
  update(dt, time, camera, focus, fx) {
    for (const fn of this.anim) fn(dt, time);
    this.skyMesh.position.copy(camera.position);
    this.farMesh.position.set(camera.position.x, this.baseY + 42, camera.position.z);
    this.farPlane.position.x = camera.position.x;
    this.farPlane.position.z = camera.position.z;
    if (this.sun) {
      const s = this.sun;
      s.target.position.set(focus.x, focus.y, focus.z);
      s.position.set(focus.x + this.sunDir.x * 110, focus.y + this.sunDir.y * 110, focus.z + this.sunDir.z * 110);
    }
    if (this.weather) {
      this.weather.uT.value = time;
      this.weather.uC.value.copy(camera.position);
      this.weather.uK.value = this.renderer.domElement.height * 0.9;
    }
    if (!fx) return;
    for (const q of this.smokers) {
      const d = Math.hypot(q.x - focus.x, q.z - focus.z);
      if (d > 110 || Math.random() > dt * 2.4) continue;
      if (q.ember) fx.ember(q.x + (Math.random() - 0.5) * 3, q.y, q.z + (Math.random() - 0.5) * 3);
      else fx.smoke(q.x, q.y, q.z, 1, 0.24, 4.4);
    }
    for (const q of this.flames) {
      const d = Math.hypot(q.x - focus.x, q.z - focus.z);
      if (d > 120) continue;
      const n = dt * 34 * fx.k;
      for (let k = 0; k < n; k += 1) {
        const a = Math.random() * 6.283;
        const dx = Math.cos(q.th) * Math.cos(a) * q.R;
        const dz = -Math.sin(q.th) * Math.cos(a) * q.R;
        fx.flame(q.x + dx, q.y + Math.sin(a) * q.R, q.z + dz, 2.6);
      }
    }
  }

  dispose() {
    this.scene.remove(this.root);
    for (const d of this.disposables) d.dispose && d.dispose();
    this.disposables.length = 0;
    this.scene.fog = null;
  }
}
