/*
 * 하늘섬 대탈출 · 코드로 그리는 텍스처 (이미지 파일 없음)
 *  풀밭 · 층층 바위 · 나무 판자 · 돌길 · 금 간 무늬 · 바람 줄무늬 · 폭포 · 둥근 빛 · 반짝이
 *  붓으로 칠한 듯한 부드러운 그림 느낌을 내려고 큰 얼룩 + 작은 붓자국을 겹친다.
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
export function fbm(noise, x, y, oct = 4, period = 8) {
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
export { makeNoise };

const cache = new Map();
function canvasTex(key, w, h, draw, { srgb = true, mips = true, wrap = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = mips;
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

/* ---------------- 풀밭 (밝은 연두 + 짙은 얼룩 + 햇빛 붓자국) ---------------- */
export function grassTex() {
  return canvasTex("grass", 256, 256, (ctx, w, h) => {
    const n1 = makeNoise(11);
    const n2 = makeNoise(29);
    const dark = [74, 150, 70];
    const mid = [118, 196, 88];
    const light = [176, 226, 112];
    pixels(ctx, w, h, (x, y) => {
      const a = fbm(n1, (x / w) * 4, (y / h) * 4, 4, 4);
      const b = fbm(n2, (x / w) * 16, (y / h) * 16, 2, 16);
      let c = a < 0.5 ? mixC(dark, mid, a * 2) : mixC(mid, light, (a - 0.5) * 2);
      c = mixC(c, [c[0] * 1.08, c[1] * 1.06, c[2] * 0.95], b);
      return c;
    });
    // 풀잎 붓자국
    const rnd = seeded(5);
    for (let i = 0; i < 900; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const l = 3 + rnd() * 5;
      const lt = rnd();
      ctx.strokeStyle = lt > 0.55 ? `rgba(214,244,140,${0.25 + rnd() * 0.3})` : `rgba(46,110,52,${0.18 + rnd() * 0.25})`;
      ctx.lineWidth = 1 + rnd();
      ctx.beginPath();
      for (const ox of [0, w, -w]) {
        for (const oy of [0, h, -h]) {
          ctx.moveTo(x + ox, y + oy);
          ctx.lineTo(x + ox + (rnd() - 0.5) * 2, y + oy - l);
        }
      }
      ctx.stroke();
    }
  });
}

/* ---------------- 층층 바위 (섬 아랫면 · 절벽): 가로 띠 + 금 + 빛 받은 윗부분 ---------------- */
export function rockTex() {
  return canvasTex("rock", 256, 256, (ctx, w, h) => {
    const n1 = makeNoise(41);
    const n2 = makeNoise(43);
    const bands = [
      [146, 112, 96],
      [122, 96, 98],
      [168, 132, 104],
      [110, 86, 92],
      [152, 118, 100],
      [132, 102, 104],
    ];
    pixels(ctx, w, h, (x, y) => {
      const warp = (fbm(n1, (x / w) * 4, (y / h) * 4, 3, 4) - 0.5) * 0.5;
      const t = (y / h + warp) * bands.length * 1.5;
      const i = Math.floor(t);
      const f = t - i;
      const c0 = bands[((i % bands.length) + bands.length) % bands.length];
      const c1 = bands[(((i + 1) % bands.length) + bands.length) % bands.length];
      let c = mixC(c0, c1, Math.min(1, Math.max(0, (f - 0.82) * 6)));
      const g = fbm(n2, (x / w) * 12, (y / h) * 12, 3, 12);
      c = c.map((v) => v * (0.82 + g * 0.32));
      // 띠 위쪽 밝은 테두리
      if (f < 0.07) c = c.map((v) => v * 1.18);
      return c;
    });
    const rnd = seeded(7);
    ctx.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      let x = rnd() * w;
      let y = rnd() * h;
      ctx.strokeStyle = `rgba(60,40,48,${0.25 + rnd() * 0.25})`;
      ctx.lineWidth = 1 + rnd() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (rnd() - 0.5) * 16;
        y += 6 + rnd() * 14;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

/* ---------------- 나무 판자 (다리 · 집) ---------------- */
export function plankTex() {
  return canvasTex("plank", 256, 256, (ctx, w, h) => {
    const rnd = seeded(13);
    const n = makeNoise(17);
    const rows = 4;
    pixels(ctx, w, h, (x, y) => {
      const r = Math.floor((y / h) * rows);
      const tone = 0.86 + ((r * 37) % 7) * 0.035;
      const grain = Math.sin((y / h) * rows * 40 + fbm(n, (x / w) * 6, (y / h) * 6, 3, 6) * 9) * 0.5 + 0.5;
      const base = [178, 124, 78];
      return base.map((v) => v * tone * (0.86 + grain * 0.16));
    });
    ctx.fillStyle = "rgba(70,40,24,0.75)";
    for (let r = 0; r <= rows; r++) ctx.fillRect(0, (r * h) / rows - 2, w, 4);
    // 못
    for (let r = 0; r < rows; r++) {
      for (const x of [14, w - 14]) {
        ctx.fillStyle = "rgba(60,50,48,0.8)";
        ctx.beginPath();
        ctx.arc(x + (rnd() - 0.5) * 4, (r + 0.5) * (h / rows), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/* ---------------- 둥근 돌길 (돌다리 · 광장) ---------------- */
export function cobbleTex() {
  return canvasTex("cobble", 256, 256, (ctx, w, h) => {
    const n = makeNoise(23);
    ctx.fillStyle = "#6f6474";
    ctx.fillRect(0, 0, w, h);
    const rnd = seeded(31);
    const cells = [];
    for (let i = 0; i < 26; i++) cells.push([rnd() * w, rnd() * h, 0.85 + rnd() * 0.3]);
    pixels(ctx, w, h, (x, y) => {
      let d1 = 1e9;
      let d2 = 1e9;
      let tone = 1;
      for (const [cx, cy, t] of cells) {
        for (const ox of [-w, 0, w]) {
          for (const oy of [-h, 0, h]) {
            const d = (x - cx - ox) ** 2 + (y - cy - oy) ** 2;
            if (d < d1) {
              d2 = d1;
              d1 = d;
              tone = t;
            } else if (d < d2) d2 = d;
          }
        }
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      const g = fbm(n, (x / w) * 10, (y / h) * 10, 3, 10);
      const base = [196, 182, 176].map((v) => v * tone * (0.82 + g * 0.28));
      if (edge < 3) return base.map((v) => v * 0.5);
      if (edge < 6) return base.map((v) => v * 0.8);
      return base;
    });
  });
}

/* ---------------- 금 간 무늬 (무너지는 발판 위에 얹는 투명 그림) ---------------- */
export function crackTex() {
  return canvasTex(
    "crack",
    256,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const rnd = seeded(77);
      ctx.strokeStyle = "rgba(40,24,20,0.85)";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const branch = (x, y, a, len, width, depth) => {
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 0; i < 5; i++) {
          a += (rnd() - 0.5) * 0.9;
          x += Math.cos(a) * len * 0.2;
          y += Math.sin(a) * len * 0.2;
          ctx.lineTo(x, y);
          if (depth < 2 && rnd() < 0.35) branch(x, y, a + (rnd() < 0.5 ? 1 : -1) * 0.9, len * 0.55, width * 0.6, depth + 1);
        }
        ctx.stroke();
      };
      for (let i = 0; i < 6; i++) branch(w / 2, h / 2, (i / 6) * Math.PI * 2 + rnd() * 0.5, 130, 4, 0);
    },
    { wrap: false }
  );
}

/* ---------------- 바람 줄무늬 (바람 장치 앞 투명 띠) ---------------- */
export function windTex() {
  return canvasTex("wind", 128, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const rnd = seeded(91);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const len = 30 + rnd() * 70;
      const g = ctx.createLinearGradient(x, y, x, y + len);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, `rgba(255,255,255,${0.35 + rnd() * 0.45})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5 + rnd() * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 6, y + len);
      ctx.stroke();
    }
  });
}

/* ---------------- 폭포 물줄기 ---------------- */
export function waterfallTex() {
  return canvasTex("falls", 64, 256, (ctx, w, h) => {
    const rnd = seeded(9);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(150,220,255,0.55)");
    g.addColorStop(0.5, "rgba(210,245,255,0.85)");
    g.addColorStop(1, "rgba(150,220,255,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const len = 20 + rnd() * 70;
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + rnd() * 0.6})`;
      ctx.lineWidth = 1 + rnd() * 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + len);
      ctx.moveTo(x, y - h);
      ctx.lineTo(x, y + len - h);
      ctx.stroke();
    }
  });
}

/* ---------------- 둥근 빛 · 반짝이 · 고리 ---------------- */
export function dotTex() {
  return canvasTex(
    "dot",
    64,
    64,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.3, "rgba(255,255,255,0.75)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { wrap: false }
  );
}
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
        const r = i % 2 ? 6 : 32;
        const a = (i / 8) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.fill();
    },
    { wrap: false }
  );
}
/** 체크포인트 · 점프대 바닥 고리 */
export function ringTex() {
  return canvasTex(
    "ring",
    128,
    128,
    (ctx, w, h) => {
      ctx.translate(64, 64);
      for (const [r, a, lw] of [
        [56, 0.9, 6],
        [44, 0.5, 3],
        [32, 0.3, 2],
      ]) {
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    { wrap: false }
  );
}
/** 부드러운 구름 한 점 (먼 구름 · 먼지) */
export function puffTex() {
  return canvasTex(
    "puff",
    128,
    128,
    (ctx, w, h) => {
      const n = makeNoise(3);
      pixels(ctx, w, h, (x, y) => {
        const dx = (x - 64) / 64;
        const dy = (y - 64) / 64;
        const r = Math.sqrt(dx * dx + dy * dy);
        const k = fbm(n, x / 16, y / 16, 3, 8);
        const a = Math.max(0, 1 - r * (1.1 - k * 0.35));
        return [255, 255, 255, Math.round(Math.pow(a, 1.6) * 255)];
      });
    },
    { wrap: false }
  );
}
/** 깃발 무늬 (구름 + 날개 문장) */
export function flagTex(color = "#ff7a6a") {
  return canvasTex(
    "flag" + color,
    128,
    96,
    (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(w * 0.42, h * 0.55, 16, 0, Math.PI * 2);
      ctx.arc(w * 0.58, h * 0.5, 20, 0, Math.PI * 2);
      ctx.arc(w * 0.72, h * 0.58, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(0, h - 10, w, 6);
      ctx.fillRect(0, 4, w, 6);
    },
    { wrap: false }
  );
}
/** 하늘 아래 구름 바다 바닥 (아주 멀리 있는 흰 바닥) */
export function cloudFloorTex() {
  return canvasTex("cloudfloor", 256, 256, (ctx, w, h) => {
    const n = makeNoise(57);
    pixels(ctx, w, h, (x, y) => {
      const a = fbm(n, (x / w) * 6, (y / h) * 6, 5, 6);
      const v = 200 + a * 55;
      return [v, v * 0.97, v * 0.99];
    });
  });
}

/* ================================================================
 * 스테이지별 땅 · 절벽 무늬 (색만 바꾸지 않고 무늬 자체를 다르게)
 *  sand  : 바람 협곡 붉은 모래 (바람 물결 + 마른 풀 + 자갈)
 *  quay  : 공중 항구 돌 포장 (네모 판석 + 줄눈 이끼)
 *  moss  : 수정 동굴 어두운 이끼 (빛나는 포자)
 *  slate : 폭풍의 성 젖은 판석 (불규칙한 큰 돌 + 물웅덩이 빛)
 *  basalt: 용의 성 현무암 (육각 판 + 붉게 빛나는 틈)
 * ============================================================== */
export function groundTex(kind) {
  return canvasTex("ground-" + kind, 256, 256, (ctx, w, h) => {
    const n1 = makeNoise(kind.length * 13 + 5);
    const n2 = makeNoise(kind.length * 7 + 61);
    const rnd = seeded(kind.length * 101 + 3);
    if (kind === "sand") {
      pixels(ctx, w, h, (x, y) => {
        const a = fbm(n1, (x / w) * 4, (y / h) * 4, 4, 4);
        const rip = Math.sin((y / h) * 44 + fbm(n2, (x / w) * 3, (y / h) * 3, 2, 3) * 10) * 0.5 + 0.5;
        const base = mixC([196, 120, 78], [236, 176, 116], a);
        return base.map((v) => v * (0.9 + rip * 0.12));
      });
      for (let i = 0; i < 260; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        ctx.fillStyle = `rgba(${120 + rnd() * 60},${80 + rnd() * 40},60,${0.35 + rnd() * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 1 + rnd() * 2.4, 0.8 + rnd() * 1.6, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 60; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        ctx.strokeStyle = `rgba(${200 + rnd() * 40},${190 + rnd() * 30},90,0.5)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + (rnd() - 0.5) * 7, y - 3 - rnd() * 5);
        }
        ctx.stroke();
      }
    } else if (kind === "quay") {
      const rows = 6;
      pixels(ctx, w, h, (x, y) => {
        const r = Math.floor((y / h) * rows);
        const off = r % 2 ? 0.5 : 0;
        const cx = ((x / w) * 4 + off) % 1;
        const cy = ((y / h) * rows) % 1;
        const id = Math.floor((x / w) * 4 + off) * 7 + r * 3;
        const tone = 0.86 + ((id * 37) % 11) * 0.025;
        const g = fbm(n1, (x / w) * 10, (y / h) * 10, 3, 10);
        let c = [206, 184, 160].map((v) => v * tone * (0.84 + g * 0.24));
        const e = Math.min(cx, 1 - cx, cy * 0.67, (1 - cy) * 0.67);
        if (e < 0.02) c = [92, 108, 74].map((v) => v * (0.8 + g * 0.4));
        else if (e < 0.045) c = c.map((v) => v * 0.82);
        return c;
      });
    } else if (kind === "moss") {
      pixels(ctx, w, h, (x, y) => {
        const a = fbm(n1, (x / w) * 4, (y / h) * 4, 4, 4);
        const b = fbm(n2, (x / w) * 14, (y / h) * 14, 2, 14);
        const c = mixC([40, 44, 92], [70, 96, 150], a);
        return c.map((v) => v * (0.86 + b * 0.25));
      });
      // 빛나는 포자: 몇 군데에 옹기종기 (온 바닥에 흩뿌리지 않게)
      for (let k = 0; k < 9; k++) {
        const cx = rnd() * w;
        const cy0 = rnd() * h;
        const cyan = rnd() < 0.6;
        for (let i = 0; i < 7; i++) {
          const x = cx + (rnd() - 0.5) * 26;
          const y = cy0 + (rnd() - 0.5) * 26;
          ctx.fillStyle = cyan ? `rgba(140,250,255,${0.55 + rnd() * 0.4})` : `rgba(255,150,230,${0.5 + rnd() * 0.4})`;
          ctx.beginPath();
          ctx.arc(x, y, 0.7 + rnd() * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (kind === "slate") {
      const cells = [];
      for (let i = 0; i < 18; i++) cells.push([rnd() * w, rnd() * h, 0.8 + rnd() * 0.35]);
      pixels(ctx, w, h, (x, y) => {
        let d1 = 1e9;
        let d2 = 1e9;
        let tone = 1;
        for (const [cx, cy, t] of cells) {
          for (const ox of [-w, 0, w]) {
            for (const oy of [-h, 0, h]) {
              const d = (x - cx - ox) ** 2 + (y - cy - oy) ** 2;
              if (d < d1) {
                d2 = d1;
                d1 = d;
                tone = t;
              } else if (d < d2) d2 = d;
            }
          }
        }
        const edge = Math.sqrt(d2) - Math.sqrt(d1);
        const g = fbm(n1, (x / w) * 8, (y / h) * 8, 3, 8);
        const wet = fbm(n2, (x / w) * 3, (y / h) * 3, 3, 3);
        let c = [120, 128, 150].map((v) => v * tone * (0.78 + g * 0.3));
        if (wet > 0.62) c = mixC(c, [168, 184, 214], (wet - 0.62) * 2.2);
        if (edge < 2.5) return c.map((v) => v * 0.42);
        if (edge < 5) return c.map((v) => v * 0.75);
        return c;
      });
    } else if (kind === "basalt") {
      // 현무암 판 (불규칙한 다각형) + 일부 틈만 붉게 빛남
      const cells = [];
      for (let i = 0; i < 20; i++) cells.push([rnd() * w, rnd() * h, 0.75 + rnd() * 0.4]);
      pixels(ctx, w, h, (x, y) => {
        let d1 = 1e9;
        let d2 = 1e9;
        let i1 = 0;
        let i2 = 0;
        for (let i = 0; i < cells.length; i++) {
          const [cx, cy] = cells[i];
          for (const ox of [-w, 0, w]) {
            for (const oy of [-h, 0, h]) {
              const d = (x - cx - ox) ** 2 + (y - cy - oy) ** 2;
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
        const g = fbm(n1, (x / w) * 9, (y / h) * 9, 3, 9);
        const tone = cells[i1][2];
        let c = [78, 62, 70].map((v) => v * tone * (0.78 + g * 0.4));
        const hot = (Math.min(i1, i2) * 7 + Math.max(i1, i2) * 13) % 5 < 2;
        if (edge < 2.2) c = hot ? [255, 118, 46] : c.map((v) => v * 0.35);
        else if (edge < 4.5) c = hot ? mixC([170, 54, 34], c, (edge - 2.2) / 2.3) : c.map((v) => v * 0.7);
        return c;
      });
    }
  });
}
/** 용의 성 바닥 틈 · 동굴 포자가 빛나는 부분만 (emissiveMap) */
export function glowTex(kind) {
  return canvasTex("glow-" + kind, 256, 256, (ctx, w, h) => {
    const src = groundTex(kind).image;
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = Math.max(d[i], d[i + 1], d[i + 2]);
      const hot = kind === "basalt" ? d[i] > 140 && d[i + 2] < 90 : lum > 150;
      if (!hot) d[i] = d[i + 1] = d[i + 2] = 0;
    }
    ctx.putImageData(img, 0, 0);
  });
}
const STRATA = {
  canyon: [
    [196, 104, 70],
    [214, 132, 90],
    [184, 92, 64],
    [226, 158, 112],
    [202, 116, 78],
  ],
  harbor: [
    [138, 126, 116],
    [124, 128, 108],
    [150, 136, 120],
    [112, 116, 100],
  ],
  cave: [
    [58, 48, 98],
    [72, 60, 122],
    [48, 40, 84],
    [80, 66, 132],
  ],
  storm: [
    [84, 90, 108],
    [72, 76, 94],
    [96, 102, 120],
    [66, 70, 86],
  ],
  dragon: [
    [58, 42, 50],
    [76, 46, 52],
    [48, 36, 44],
    [92, 52, 54],
  ],
};
const sstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function strataTex(kind) {
  const bands = STRATA[kind];
  return canvasTex("strata-" + kind, 256, 256, (ctx, w, h) => {
    const n1 = makeNoise(kind.length * 17 + 9);
    const n2 = makeNoise(kind.length * 5 + 33);
    const n3 = makeNoise(kind.length * 11 + 71);
    const W = kind === "canyon" ? 0.1 : 0.22;
    pixels(ctx, w, h, (x, y) => {
      const warp = (fbm(n1, (x / w) * 3, (y / h) * 3, 3, 3) - 0.5) * W;
      const t = (y / h + warp) * bands.length;
      const i = Math.floor(t);
      const f = t - i;
      const c0 = bands[((i % bands.length) + bands.length) % bands.length];
      const c1 = bands[(((i + 1) % bands.length) + bands.length) % bands.length];
      let c = mixC(c0, c1, sstep(0.62, 1.0, f));
      const g = fbm(n2, (x / w) * 10, (y / h) * 10, 3, 10);
      // 세로 풍화 줄 (빗물 자국)
      const st = fbm(n3, (x / w) * 24, (y / h) * 2, 2, 24);
      c = c.map((v) => v * (0.88 + g * 0.2) * (0.93 + st * 0.12));
      if (f < 0.05) c = c.map((v) => v * 1.07);
      // 용의 성: 세로 기둥 무늬 (주상절리)
      if (kind === "dragon" && Math.abs((((x / w) * 8 + warp * 2) % 1) - 0.5) > 0.465) c = c.map((v) => v * 0.6);
      // 폭풍의 성: 벽돌 줄눈
      if (kind === "storm") {
        const row = Math.floor((y / h) * 8);
        const bx = ((x / w) * 4 + (row % 2) * 0.5) % 1;
        if ((y / h) * 8 - row < 0.06 || bx < 0.022) c = c.map((v) => v * 0.6);
      }
      return c;
    });
    if (kind === "cave") {
      // 수정 줄기
      const rnd = seeded(91);
      for (let i = 0; i < 12; i++) {
        let x = rnd() * w;
        let y = rnd() * h;
        ctx.strokeStyle = rnd() < 0.5 ? "rgba(120,240,255,0.7)" : "rgba(220,140,255,0.65)";
        ctx.lineWidth = 1.2 + rnd() * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (rnd() - 0.5) * 30;
          y += (rnd() - 0.3) * 24;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  });
}
/** 컨베이어 띠 (줄무늬 · 화살표) */
export function beltTex() {
  return canvasTex("belt", 64, 128, (ctx, w, h) => {
    ctx.fillStyle = "#3a3438";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? "#4a4248" : "#2e2a2e";
      ctx.fillRect(0, (i * h) / 4, w, h / 4);
    }
    ctx.fillStyle = "#ffcf4a";
    for (let i = 0; i < 2; i++) {
      const y = i * (h / 2) + h / 8;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, y + 16);
      ctx.lineTo(w * 0.5, y);
      ctx.lineTo(w * 0.8, y + 16);
      ctx.lineTo(w * 0.68, y + 16);
      ctx.lineTo(w * 0.5, y + 7);
      ctx.lineTo(w * 0.32, y + 16);
      ctx.fill();
    }
  });
}
/** 경고 줄무늬 (노랑 · 검정) */
export function hazardTex() {
  return canvasTex("hazard", 64, 64, (ctx, w, h) => {
    ctx.fillStyle = "#ffcc33";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#2a2228";
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

/** 용암 (굳은 껍질 사이로 밝게 흐르는 줄기) */
export function lavaTex() {
  return canvasTex("lava", 256, 256, (ctx, w, h) => {
    const n1 = makeNoise(131);
    const n2 = makeNoise(137);
    const n3 = makeNoise(139);
    pixels(ctx, w, h, (x, y) => {
      const u = (x / w) * 3;
      const v = (y / h) * 3;
      const q = fbm(n1, u, v, 3, 3);
      const r = fbm(n2, u + q * 2, v + q * 2, 4, 3);
      const vein = Math.max(0, 1 - Math.abs(r - 0.5) / 0.07);
      const glow = Math.max(0, 1 - Math.abs(r - 0.5) / 0.2);
      const g = fbm(n3, (x / w) * 12, (y / h) * 12, 2, 12);
      let c = mixC([52, 26, 28], [150, 40, 24], glow * glow);
      c = c.map((k) => k * (0.85 + g * 0.3));
      if (vein > 0) c = mixC(c, vein > 0.6 ? [255, 236, 140] : [255, 120, 40], Math.min(1, vein * 1.6));
      return c;
    });
  });
}
