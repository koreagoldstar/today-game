/*
 * 봉제인형 12종 그림 (코드로 그린다).
 *  물리 모양(data.js sph)과 같은 자리에 머리 · 몸을 그리고, 그 위에 귀 · 꼬리 · 장식을 얹는다.
 *  봉제 느낌: 말랑한 떡 모양 윤곽 + 부드러운 음영(위 빛 · 아래 그늘) + 천 결 + 바느질 + 반짝이는 큰 눈.
 */
import { dollById } from "./data.js?v=1";

const TAU = Math.PI * 2;

/* ---------- 천 결 무늬 (한 번만 만든다) ---------- */
let FABRIC = null;
function fabric(g) {
  if (FABRIC) return FABRIC;
  const c = document.createElement("canvas");
  c.width = c.height = 48;
  const x = c.getContext("2d");
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i += 1) {
    x.fillStyle = r() < 0.5 ? "rgba(255,255,255,.6)" : "rgba(70,40,30,.32)";
    x.fillRect(Math.floor(r() * 48), Math.floor(r() * 48), 1, 1);
  }
  FABRIC = g.createPattern(c, "repeat");
  return FABRIC;
}

/* ---------- 모양 ---------- */
function ell(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}
function circ(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, Math.max(0.01, r), 0, TAU);
}
/** 떡 모양: 위는 둥글고 아래는 살짝 넓고 평평 (봉제인형 머리) */
function mochi(g, x, y, rx, ry, flat = 0.16) {
  const top = y - ry;
  const bot = y + ry;
  g.beginPath();
  g.moveTo(x, top);
  g.bezierCurveTo(x + rx * 0.58, top, x + rx, y - ry * 0.52, x + rx, y + ry * 0.06);
  g.bezierCurveTo(x + rx, y + ry * (0.56 + flat), x + rx * 0.64, bot, x, bot);
  g.bezierCurveTo(x - rx * 0.64, bot, x - rx, y + ry * (0.56 + flat), x - rx, y + ry * 0.06);
  g.bezierCurveTo(x - rx, y - ry * 0.52, x - rx * 0.58, top, x, top);
  g.closePath();
}
/** 서양배 모양 몸: 위가 좁고 아래가 통통 */
function pear(g, x, y, rx, ry) {
  g.beginPath();
  g.moveTo(x, y - ry);
  g.bezierCurveTo(x + rx * 0.62, y - ry, x + rx * 0.84, y - ry * 0.48, x + rx * 0.96, y + ry * 0.12);
  g.bezierCurveTo(x + rx * 1.06, y + ry * 0.74, x + rx * 0.62, y + ry, x, y + ry);
  g.bezierCurveTo(x - rx * 0.62, y + ry, x - rx * 1.06, y + ry * 0.74, x - rx * 0.96, y + ry * 0.12);
  g.bezierCurveTo(x - rx * 0.84, y - ry * 0.48, x - rx * 0.62, y - ry, x, y - ry);
  g.closePath();
}

/* ---------- 칠하기 ---------- */
/** 볼록한 천: 위 왼쪽이 밝고 가장자리가 어둡다 */
function shade(g, x, y, r, c) {
  const gr = g.createRadialGradient(x - r * 0.34, y - r * 0.46, r * 0.06, x, y, r * 1.15);
  gr.addColorStop(0, c[1]);
  gr.addColorStop(0.5, c[0]);
  gr.addColorStop(1, c[2]);
  return gr;
}
/**
 * 지금 경로를 봉제 천으로 칠한다: 음영 → 천 결 → 아래 그늘 → 위 빛 → 윤곽선.
 * (x, y, r) 은 음영 기준 원, k 는 1cm 당 화면 점 수 (천 결 크기를 맞춘다)
 */
function cloth(g, x, y, r, c, line, lw, k, opt = {}) {
  g.fillStyle = shade(g, x, y, r, c);
  g.fill();
  g.save();
  g.clip();
  const pat = fabric(g);
  if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / k));
  g.globalAlpha = 0.11;
  g.fillStyle = pat;
  g.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  g.globalAlpha = 1;
  const lg = g.createLinearGradient(0, y + r * 0.15, 0, y + r * 1.05);
  lg.addColorStop(0, "rgba(0,0,0,0)");
  lg.addColorStop(1, opt.dark || "rgba(90,40,60,.2)");
  g.fillStyle = lg;
  g.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  if (!opt.noShine) {
    const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.58, 0, x - r * 0.3, y - r * 0.58, r * 0.62);
    rg.addColorStop(0, "rgba(255,255,255,.42)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  }
  g.restore();
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = line;
  g.lineWidth = lw;
  g.stroke();
}
/** 단색 천 조각 (배 · 주둥이 · 귀 안쪽): 은은한 그라데이션 */
function patch(g, x, y, r, col, alpha = 1) {
  const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.35, 0, x, y, r * 1.1);
  gr.addColorStop(0, "rgba(255,255,255,.55)");
  gr.addColorStop(0.45, col);
  gr.addColorStop(1, col);
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = gr;
  g.fill();
  g.restore();
}
/** 바느질 자국 */
function stitch(g, col, lw, fn) {
  g.save();
  g.setLineDash([lw * 1.5, lw * 1.2]);
  g.lineCap = "round";
  g.strokeStyle = col;
  g.lineWidth = lw * 0.5;
  g.globalAlpha = 0.75;
  g.beginPath();
  fn();
  g.stroke();
  g.restore();
}
/** 머리가 몸에 드리운 부드러운 그늘 */
function neckShadow(g, h, b) {
  const y = h.y + h.r * 0.86;
  const gr = g.createRadialGradient(h.x, y, 0, h.x, y, b.r * 0.95);
  gr.addColorStop(0, "rgba(80,30,50,.22)");
  gr.addColorStop(1, "rgba(80,30,50,0)");
  g.fillStyle = gr;
  ell(g, h.x, y, b.r * 0.95, b.r * 0.42);
  g.fill();
}

/* ---------- 얼굴 ---------- */
/** 반짝이는 큰 눈 (표정: open · wide · blink · shut · happy) */
function eyes(g, x, y, sep, s, P, col = "#26171d") {
  for (const k of [-1, 1]) {
    const ex = x + k * sep;
    g.lineCap = "round";
    g.lineJoin = "round";
    if (P.eye === "blink") {
      g.strokeStyle = col;
      g.lineWidth = s * 0.42;
      g.beginPath();
      g.arc(ex, y - s * 0.35, s * 0.85, 0.18 * Math.PI, 0.82 * Math.PI);
      g.stroke();
      continue;
    }
    if (P.eye === "shut") {
      g.strokeStyle = col;
      g.lineWidth = s * 0.42;
      g.beginPath();
      g.moveTo(ex - k * s * 0.8, y - s * 0.6);
      g.lineTo(ex + k * s * 0.35, y);
      g.lineTo(ex - k * s * 0.8, y + s * 0.6);
      g.stroke();
      continue;
    }
    if (P.eye === "happy") {
      g.strokeStyle = col;
      g.lineWidth = s * 0.46;
      g.beginPath();
      g.arc(ex, y + s * 0.45, s * 0.82, 1.12 * Math.PI, 1.88 * Math.PI);
      g.stroke();
      continue;
    }
    const big = P.eye === "wide" ? 1.24 : 1;
    const rx = s * 0.8 * big;
    const ry = s * 1.0 * big;
    const gr = g.createRadialGradient(ex, y + ry * 0.45, 0, ex, y, ry * 1.1);
    gr.addColorStop(0, "#7a4b5c");
    gr.addColorStop(0.55, col);
    gr.addColorStop(1, col);
    ell(g, ex, y, rx, ry);
    g.fillStyle = gr;
    g.fill();
    g.fillStyle = "#fff";
    ell(g, ex + rx * 0.3, y - ry * 0.38, rx * 0.42, ry * 0.36);
    g.fill();
    circ(g, ex - rx * 0.36, y + ry * 0.42, rx * 0.17);
    g.fill();
    if (P.eye === "wide") {
      g.strokeStyle = "rgba(255,255,255,.8)";
      g.lineWidth = s * 0.16;
      ell(g, ex, y, rx * 1.28, ry * 1.22);
      g.stroke();
    }
  }
}
/** 발그레한 볼 */
function blush(g, x, y, sep, r, col = "255,120,150") {
  for (const k of [-1, 1]) {
    const cx = x + k * sep;
    const gr = g.createRadialGradient(cx, y, 0, cx, y, r);
    gr.addColorStop(0, `rgba(${col},.55)`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    ell(g, cx, y, r, r * 0.66);
    g.fill();
  }
}
/** 입: ω 모양 웃음, 놀라면 작은 o */
function mouth(g, x, y, s, P, col = "#5a2833") {
  g.lineCap = "round";
  g.lineJoin = "round";
  if (P.mouth === "o") {
    ell(g, x, y + s * 0.45, s * 0.62, s * 0.78);
    g.fillStyle = "#6b2638";
    g.fill();
    ell(g, x, y + s * 0.85, s * 0.38, s * 0.26);
    g.fillStyle = "#ff8aa6";
    g.fill();
    return;
  }
  g.strokeStyle = col;
  g.lineWidth = s * 0.3;
  g.beginPath();
  g.moveTo(x - s * 1.05, y + s * 0.05);
  g.quadraticCurveTo(x - s * 0.52, y + s * 0.78, x, y + s * 0.08);
  g.quadraticCurveTo(x + s * 0.52, y + s * 0.78, x + s * 1.05, y + s * 0.05);
  g.stroke();
}
/** 작은 코 (둥근 역삼각형 + 빛) */
function nose(g, x, y, s, col) {
  g.beginPath();
  g.moveTo(x - s, y - s * 0.45);
  g.quadraticCurveTo(x, y - s * 0.85, x + s, y - s * 0.45);
  g.quadraticCurveTo(x + s * 0.35, y + s * 0.55, x, y + s * 0.62);
  g.quadraticCurveTo(x - s * 0.35, y + s * 0.55, x - s, y - s * 0.45);
  g.fillStyle = col;
  g.fill();
  g.fillStyle = "rgba(255,255,255,.6)";
  ell(g, x - s * 0.28, y - s * 0.32, s * 0.32, s * 0.15, -0.2);
  g.fill();
}
function star(g, x, y, R, col, line) {
  g.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const q = i % 2 ? R * 0.46 : R;
    g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  g.closePath();
  g.fillStyle = col;
  g.fill();
  if (line) {
    g.strokeStyle = line;
    g.lineWidth = R * 0.14;
    g.lineJoin = "round";
    g.stroke();
  }
}
function heart(g, x, y, s, col) {
  g.beginPath();
  g.moveTo(x, y + s * 0.85);
  g.bezierCurveTo(x - s * 1.3, y - s * 0.1, x - s * 0.55, y - s * 0.95, x, y - s * 0.3);
  g.bezierCurveTo(x + s * 0.55, y - s * 0.95, x + s * 1.3, y - s * 0.1, x, y + s * 0.85);
  g.closePath();
  g.fillStyle = col;
  g.fill();
}
/** 리본 (목 · 귀 장식) */
function bow(g, x, y, s, col, line, lw, k) {
  for (const i of [-1, 1]) {
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + i * s * 0.6, y - s * 0.9, x + i * s * 1.5, y - s * 0.7, x + i * s * 1.45, y);
    g.bezierCurveTo(x + i * s * 1.5, y + s * 0.7, x + i * s * 0.6, y + s * 0.9, x, y);
    g.closePath();
    cloth(g, x + i * s * 0.9, y, s, [col, "#ffe0ec", shadeOf(col)], line, lw * 0.85, k, { noShine: true });
  }
  circ(g, x, y, s * 0.42);
  cloth(g, x, y, s * 0.42, [col, "#ffe0ec", shadeOf(col)], line, lw * 0.85, k, { noShine: true });
}
const SHADES = { "#ff7fa6": "#e2557f", "#ff6f8e": "#d94a6b", "#8fd0ff": "#5aa8e0", "#ffcf4a": "#e3a51c" };
function shadeOf(c) {
  return SHADES[c] || c;
}

/* ---------- 팔 · 다리 ---------- */
/** 몸 옆 짧은 팔 + 앞으로 뻗은 발 (발바닥 볼록) */
function limbs(g, b, C, lw, k, opt = {}) {
  const arm = opt.arm || C.c;
  const foot = opt.foot || C.c;
  for (const s of [-1, 1]) {
    const ax = b.x + s * b.r * 0.86;
    const ay = b.y - b.r * 0.1;
    g.save();
    g.translate(ax, ay);
    g.rotate(s * 0.5);
    ell(g, 0, b.r * 0.14, b.r * 0.24, b.r * 0.38);
    cloth(g, 0, 0, b.r * 0.34, arm, C.line, lw, k, { noShine: true });
    g.restore();
  }
  for (const s of [-1, 1]) {
    const fx = b.x + s * b.r * 0.44;
    const fy = b.y + b.r * 0.82;
    mochi(g, fx, fy, b.r * 0.34, b.r * 0.25, 0.3);
    cloth(g, fx, fy, b.r * 0.34, foot, C.line, lw, k, { noShine: true });
    if (opt.pad) {
      ell(g, fx, fy + b.r * 0.03, b.r * 0.16, b.r * 0.12);
      g.fillStyle = opt.pad;
      g.fill();
      for (const t of [-1, 0, 1]) {
        circ(g, fx + t * b.r * 0.12, fy - b.r * 0.12, b.r * 0.045);
        g.fill();
      }
    }
  }
}

/* ---------- 색 ---------- */
const PAL = {
  bear: { c: ["#f3d5ab", "#fff4e0", "#d8ab76"], line: "#a2754a", muzzle: "#fff4e3", in: "#f7b9b6", ribbon: "#ff7fa6" },
  bunny: { c: ["#ffd5e4", "#fff4f8", "#f2a3bf"], line: "#cd7095", in: "#ffa8c6", belly: "#fff3f7" },
  pig: { c: ["#ffc8d5", "#ffecf2", "#f29ab0"], line: "#c96d87", snout: ["#ffa9bd", "#ffd3de", "#ef8aa3"] },
  duck: { c: ["#ffe066", "#fff8c8", "#f3bb2c"], line: "#c69018", beak: ["#ffa245", "#ffd19a", "#ec7b1e"], bline: "#c25d12" },
  panda: { c: ["#fbfaf7", "#ffffff", "#dcd8cf"], line: "#6b6570", dark: ["#3d3846", "#615a6e", "#26222c"] },
  cat: { c: ["#ffe7a6", "#fff8dc", "#f1c56a"], line: "#b07c3d", car: ["#b8682c", "#de9450", "#8a4a1c"], in: "#ffb7c5" },
  fox: { c: ["#ffa25a", "#ffd2a4", "#ea7a35"], line: "#b5591f", cream: ["#fff4e4", "#ffffff", "#f0dcc4"], dark: ["#6a3d2c", "#8f5a44", "#4a281c"] },
  penguin: { c: ["#82caf3", "#cbeeff", "#4fa5da"], line: "#3a7eae", belly: ["#fffdf6", "#ffffff", "#ece6d6"], beak: "#ffc23d", knit: ["#ff6f8e", "#ffb2c3", "#d94a6b"] },
  tiger: { c: ["#ffb048", "#ffdea0", "#f08c22"], line: "#b5611a", stripe: "#5e3417", white: ["#fff7ea", "#ffffff", "#f1dfc4"] },
  koala: { c: ["#bcc1cc", "#e8ebf1", "#9298a6"], line: "#5d6371", inner: ["#f9f5f6", "#ffffff", "#e3dadd"], nose: "#3b3542" },
  unicorn: { c: ["#fefbff", "#ffffff", "#e5dbf3"], line: "#9b87bc", in: "#ffc9e0", hoof: ["#cbb8f0", "#e8deff", "#a993d6"], horn: ["#ffe28a", "#fff7cf", "#e3b33b"] },
  dragon: { c: ["#90e4c7", "#d6fbed", "#5ec8a6"], line: "#33947a", belly: ["#fff3c9", "#fffbe8", "#f2dc9a"], horn: ["#fff0b8", "#fffbe6", "#e8cf7c"], wing: ["#ffc4d8", "#ffe6ef", "#f59fbd"] },
};
const MANE = ["#ff9ec4", "#ffc98a", "#fff08a", "#a5e8b6", "#94d2ff", "#cdaaff"];

/** S[i]: 물리 구를 그림 축으로 (y 아래로, 무게중심 기준) */
function parts(def, comX, comY) {
  return def.sph.map(([x, y, r]) => ({ x: x - comX, y: -(y - comY), r }));
}

/* ---------- 인형별 ---------- */
const DRAW = {
  bear(g, S, P, k, lw) {
    const [b, h, e1, e2] = S;
    const C = PAL.bear;
    for (const e of [e1, e2]) {
      circ(g, e.x, e.y, e.r * 1.05);
      cloth(g, e.x, e.y, e.r, C.c, C.line, lw, k);
      circ(g, e.x + (e.x > h.x ? -0.2 : 0.2), e.y + 0.25, e.r * 0.56);
      patch(g, e.x, e.y + 0.25, e.r * 0.56, C.in);
    }
    pear(g, b.x, b.y, b.r * 0.98, b.r);
    cloth(g, b.x, b.y, b.r, C.c, C.line, lw, k);
    ell(g, b.x, b.y + b.r * 0.2, b.r * 0.56, b.r * 0.58);
    patch(g, b.x, b.y + b.r * 0.2, b.r * 0.56, C.muzzle);
    stitch(g, C.line, lw, () => {
      g.moveTo(b.x, b.y - b.r * 0.3);
      g.lineTo(b.x, b.y + b.r * 0.72);
    });
    limbs(g, b, C, lw, k, { pad: C.in });
    neckShadow(g, h, b);
    mochi(g, h.x, h.y, h.r * 1.04, h.r * 0.95);
    cloth(g, h.x, h.y, h.r, C.c, C.line, lw, k);
    ell(g, h.x, h.y + h.r * 0.36, h.r * 0.4, h.r * 0.3);
    patch(g, h.x, h.y + h.r * 0.36, h.r * 0.4, C.muzzle);
    eyes(g, h.x, h.y + h.r * 0.08, h.r * 0.38, h.r * 0.13, P);
    nose(g, h.x, h.y + h.r * 0.27, h.r * 0.12, "#5b3426");
    mouth(g, h.x, h.y + h.r * 0.36, h.r * 0.1, P);
    blush(g, h.x, h.y + h.r * 0.3, h.r * 0.62, h.r * 0.2);
    bow(g, h.x, h.y + h.r * 0.98, h.r * 0.24, C.ribbon, "#c9476f", lw, k);
  },

  bunny(g, S, P, k, lw) {
    const [b, h, e1, e2] = S;
    const C = PAL.bunny;
    // 긴 귀 (살짝 벌어져 기울어짐)
    for (const [e, s] of [[e1, -1], [e2, 1]]) {
      g.save();
      g.translate(e.x, h.y - h.r * 0.5);
      g.rotate(s * 0.16);
      const L = h.y - h.r * 0.5 - (e.y - e.r * 1.5);
      ell(g, 0, -L * 0.52, e.r * 1.0, L * 0.6);
      cloth(g, 0, -L * 0.52, e.r * 1.6, C.c, C.line, lw, k);
      ell(g, 0, -L * 0.5, e.r * 0.5, L * 0.46);
      patch(g, 0, -L * 0.5, e.r * 0.6, C.in);
      g.restore();
    }
    pear(g, b.x, b.y, b.r * 0.98, b.r);
    cloth(g, b.x, b.y, b.r, C.c, C.line, lw, k);
    ell(g, b.x, b.y + b.r * 0.22, b.r * 0.55, b.r * 0.56);
    patch(g, b.x, b.y + b.r * 0.22, b.r * 0.55, C.belly);
    limbs(g, b, C, lw, k, { pad: C.in });
    neckShadow(g, h, b);
    mochi(g, h.x, h.y, h.r * 1.04, h.r * 0.94);
    cloth(g, h.x, h.y, h.r, C.c, C.line, lw, k);
    eyes(g, h.x, h.y + h.r * 0.08, h.r * 0.4, h.r * 0.13, P);
    nose(g, h.x, h.y + h.r * 0.28, h.r * 0.1, "#ff7da3");
    mouth(g, h.x, h.y + h.r * 0.36, h.r * 0.1, P);
    if (P.mouth !== "o") {
      // 작은 앞니
      g.fillStyle = "#fff";
      g.strokeStyle = C.line;
      g.lineWidth = lw * 0.5;
      g.beginPath();
      g.roundRect(h.x - h.r * 0.07, h.y + h.r * 0.42, h.r * 0.14, h.r * 0.12, h.r * 0.03);
      g.fill();
      g.stroke();
    }
    blush(g, h.x, h.y + h.r * 0.3, h.r * 0.62, h.r * 0.22);
    // 딸기 핀 (오른쪽 귀 아래)
    const sx = h.x + h.r * 0.56;
    const sy = h.y - h.r * 0.66;
    g.beginPath();
    g.moveTo(sx, sy + h.r * 0.28);
    g.bezierCurveTo(sx - h.r * 0.3, sy + h.r * 0.05, sx - h.r * 0.24, sy - h.r * 0.2, sx, sy - h.r * 0.16);
    g.bezierCurveTo(sx + h.r * 0.24, sy - h.r * 0.2, sx + h.r * 0.3, sy + h.r * 0.05, sx, sy + h.r * 0.28);
    cloth(g, sx, sy, h.r * 0.25, ["#ff4d6d", "#ff9fb0", "#d92c4e"], "#a81e3b", lw * 0.8, k, { noShine: true });
    g.fillStyle = "#fff4b0";
    for (const [dx, dy] of [[-0.08, -0.02], [0.08, 0], [0, 0.11], [-0.1, 0.12], [0.1, 0.12]]) {
      ell(g, sx + dx * h.r, sy + dy * h.r, h.r * 0.02, h.r * 0.03);
      g.fill();
    }
    g.fillStyle = "#4fbf6a";
    for (const s of [-1, 0, 1]) {
      ell(g, sx + s * h.r * 0.08, sy - h.r * 0.16, h.r * 0.07, h.r * 0.035, s * 0.6);
      g.fill();
    }
  },

  pig(g, S, P, k, lw) {
    const [b, h, sn] = S;
    const C = PAL.pig;
    // 꼬불 꼬리
    g.strokeStyle = C.line;
    g.lineWidth = lw * 2.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(b.x + b.r * 0.86, b.y + b.r * 0.2);
    g.bezierCurveTo(b.x + b.r * 1.3, b.y, b.x + b.r * 1.1, b.y - b.r * 0.5, b.x + b.r * 1.0, b.y - b.r * 0.2);
    g.bezierCurveTo(b.x + b.r * 0.92, b.y + b.r * 0.02, b.x + b.r * 1.28, b.y + b.r * 0.02, b.x + b.r * 1.32, b.y - b.r * 0.3);
    g.stroke();
    g.strokeStyle = C.c[0];
    g.lineWidth = lw * 1.2;
    g.stroke();
    ell(g, b.x, b.y, b.r * 1.02, b.r * 0.96);
    cloth(g, b.x, b.y, b.r, C.c, C.line, lw, k);
    limbs(g, b, C, lw, k, { foot: C.snout, arm: C.c });
    neckShadow(g, h, b);
    // 앞으로 접힌 귀
    for (const s of [-1, 1]) {
      g.beginPath();
      const ex = h.x + s * h.r * 0.62;
      const ey = h.y - h.r * 0.78;
      g.moveTo(ex - s * h.r * 0.34, ey + h.r * 0.18);
      g.quadraticCurveTo(ex + s * h.r * 0.1, ey - h.r * 0.42, ex + s * h.r * 0.46, ey - h.r * 0.1);
      g.quadraticCurveTo(ex + s * h.r * 0.34, ey + h.r * 0.28, ex + s * h.r * 0.06, ey + h.r * 0.34);
      g.closePath();
      cloth(g, ex, ey, h.r * 0.4, C.c, C.line, lw, k);
    }
    mochi(g, h.x, h.y, h.r * 1.06, h.r * 0.94, 0.22);
    cloth(g, h.x, h.y, h.r, C.c, C.line, lw, k);
    eyes(g, h.x, h.y - h.r * 0.12, h.r * 0.44, h.r * 0.12, P);
    // 튀어나온 코
    const nx = sn.x;
    const ny = sn.y;
    ell(g, nx, ny, sn.r * 1.15, sn.r * 0.82);
    cloth(g, nx, ny, sn.r * 1.1, C.snout, C.line, lw, k);
    g.fillStyle = "#b34b68";
    for (const s of [-1, 1]) {
      ell(g, nx + s * sn.r * 0.38, ny, sn.r * 0.17, sn.r * 0.3);
      g.fill();
    }
    mouth(g, h.x, ny + sn.r * 0.9, h.r * 0.09, P);
    blush(g, h.x, h.y + h.r * 0.2, h.r * 0.7, h.r * 0.2);
  },

  duck(g, S, P, k, lw) {
    const [b, h, bk] = S;
    const C = PAL.duck;
    // 날개
    for (const s of [-1, 1]) {
      g.save();
      g.translate(b.x + s * b.r * 0.88, b.y - b.r * 0.05);
      g.rotate(s * 0.35);
      g.beginPath();
      g.moveTo(0, -b.r * 0.4);
      g.quadraticCurveTo(s * b.r * 0.5, -b.r * 0.1, s * b.r * 0.32, b.r * 0.5);
      g.quadraticCurveTo(0, b.r * 0.42, -s * b.r * 0.1, b.r * 0.2);
      g.closePath();
      cloth(g, 0, 0, b.r * 0.45, C.c, C.line, lw, k, { noShine: true });
      g.restore();
    }
    pear(g, b.x, b.y, b.r * 1.0, b.r);
    cloth(g, b.x, b.y, b.r, C.c, C.line, lw, k);
    // 물갈퀴 발
    for (const s of [-1, 1]) {
      const fx = b.x + s * b.r * 0.42;
      const fy = b.y + b.r * 0.9;
      g.beginPath();
      g.moveTo(fx - b.r * 0.34, fy + b.r * 0.12);
      g.quadraticCurveTo(fx - b.r * 0.2, fy - b.r * 0.22, fx, fy - b.r * 0.12);
      g.quadraticCurveTo(fx + b.r * 0.2, fy - b.r * 0.22, fx + b.r * 0.34, fy + b.r * 0.12);
      g.quadraticCurveTo(fx, fy + b.r * 0.22, fx - b.r * 0.34, fy + b.r * 0.12);
      cloth(g, fx, fy, b.r * 0.34, C.beak, C.bline, lw, k, { noShine: true });
    }
    neckShadow(g, h, b);
    mochi(g, h.x, h.y, h.r * 1.0, h.r * 0.97);
    cloth(g, h.x, h.y, h.r, C.c, C.line, lw, k);
    // 머리 깃털 세 가닥
    g.strokeStyle = C.line;
    g.lineWidth = lw * 1.6;
    g.lineCap = "round";
    for (const s of [-1, 0, 1]) {
      g.beginPath();
      g.moveTo(h.x + s * h.r * 0.12, h.y - h.r * 0.9);
      g.quadraticCurveTo(h.x + s * h.r * 0.3, h.y - h.r * 1.25, h.x + s * h.r * 0.12 + h.r * 0.14, h.y - h.r * 1.32);
      g.stroke();
    }
    eyes(g, h.x, h.y - h.r * 0.26, h.r * 0.4, h.r * 0.12, P);
    blush(g, h.x, h.y + h.r * 0.08, h.r * 0.68, h.r * 0.2);
    // 넓은 부리 (윗부리 + 아랫부리)
    const bx = bk.x;
    const by = bk.y + bk.r * 0.42;
    const w = bk.r * 1.4;
    if (P.mouth === "o") {
      ell(g, bx, by + bk.r * 0.45, w * 0.55, bk.r * 0.6);
      g.fillStyle = "#c2452c";
      g.fill();
    }
    g.beginPath();
    g.moveTo(bx - w, by);
    g.bezierCurveTo(bx - w * 0.9, by - bk.r * 0.85, bx + w * 0.9, by - bk.r * 0.85, bx + w, by);
    g.bezierCurveTo(bx + w * 0.6, by + bk.r * 0.35, bx - w * 0.6, by + bk.r * 0.35, bx - w, by);
    cloth(g, bx, by - bk.r * 0.2, w * 0.8, C.beak, C.bline, lw, k);
    g.beginPath();
    g.moveTo(bx - w * 0.7, by + bk.r * 0.18 + (P.mouth === "o" ? bk.r * 0.5 : 0));
    g.quadraticCurveTo(bx, by + bk.r * 0.85 + (P.mouth === "o" ? bk.r * 0.6 : 0), bx + w * 0.7, by + bk.r * 0.18 + (P.mouth === "o" ? bk.r * 0.5 : 0));
    g.quadraticCurveTo(bx, by + bk.r * 0.35, bx - w * 0.7, by + bk.r * 0.18 + (P.mouth === "o" ? bk.r * 0.5 : 0));
    cloth(g, bx, by + bk.r * 0.4, w * 0.6, C.beak, C.bline, lw, k, { noShine: true });
    g.fillStyle = C.bline;
    for (const s of [-1, 1]) {
      ell(g, bx + s * w * 0.22, by - bk.r * 0.42, bk.r * 0.09, bk.r * 0.06);
      g.fill();
    }
  },

  panda(g, S, P, k, lw) {
    const [b, h, e1, e2] = S;
    const C = PAL.panda;
    for (const e of [e1, e2]) {
      circ(g, e.x, e.y, e.r * 1.1);
      cloth(g, e.x, e.y, e.r, C.dark, "#1c1922", lw, k);
    }
    pear(g, b.x, b.y, b.r * 0.98, b.r);
    cloth(g, b.x, b.y, b.r, C.c, C.line, lw, k);
    limbs(g, b, { c: C.dark, line: "#1c1922" }, lw, k, { pad: "#7a7186" });
    // 대나무 (왼손)
    const tx = b.x - b.r * 0.9;
    const ty = b.y - b.r * 0.1;
    g.save();
    g.translate(tx, ty);
    g.rotate(-0.35);
    g.fillStyle = "#7cc96a";
    g.strokeStyle = "#3f8a3c";
    g.lineWidth = lw * 0.7;
    g.beginPath();
    g.roundRect(-b.r * 0.08, -b.r * 0.95, b.r * 0.16, b.r * 1.25, b.r * 0.06);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-b.r * 0.08, -b.r * 0.45);
    g.lineTo(b.r * 0.08, -b.r * 0.45);
    g.stroke();
    for (const [ax, ay, rot] of [[0.05, -0.9, -0.5], [0.05, -0.75, 0.6], [-0.05, -0.55, -0.8]]) {
      g.save();
      g.translate(b.r * ax, b.r * ay);
      g.rotate(rot);
      ell(g, b.r * 0.18, 0, b.r * 0.22, b.r * 0.07);
      g.fillStyle = "#8fd77b";
      g.fill();
      g.stroke();
      g.restore();
    }
    g.restore();
    neckShadow(g, h, b);
    mochi(g, h.x, h.y, h.r * 1.06, h.r * 0.93);
    cloth(g, h.x, h.y, h.r, C.c, C.line, lw, k);
    // 눈 둘레 검은 무늬
    for (const s of [-1, 1]) {
      ell(g, h.x + s * h.r * 0.38, h.y + h.r * 0.1, h.r * 0.26, h.r * 0.32, s * -0.45);
      g.fillStyle = C.dark[0];
      g.fill();
    }
    eyes(g, h.x, h.y + h.r * 0.1, h.r * 0.38, h.r * 0.11, P, "#0f0c12");
    if (P.eye === "happy" || P.eye === "blink" || P.eye === "shut") eyes(g, h.x, h.y + h.r * 0.1, h.r * 0.38, h.r * 0.11, P, "#ffffff");
    nose(g, h.x, h.y + h.r * 0.38, h.r * 0.1, "#2a2530");
    mouth(g, h.x, h.y + h.r * 0.46, h.r * 0.09, P, "#2a2530");
    blush(g, h.x, h.y + h.r * 0.42, h.r * 0.66, h.r * 0.16);
  },

  cat(g, S, P, k, lw) {
    const [l, r, t, e1, e2] = S;
    const C = PAL.cat;
    // 귀
    for (const [e, s] of [[e1, -1], [e2, 1]]) {
      g.beginPath();
      g.moveTo(e.x - s * e.r * 1.3, e.y + e.r * 1.6);
      g.quadraticCurveTo(e.x - s * e.r * 0.2, e.y - e.r * 1.6, e.x + s * e.r * 0.3, e.y - e.r * 1.2);
      g.quadraticCurveTo(e.x + s * e.r * 1.0, e.y + e.r * 0.2, e.x + s * e.r * 1.1, e.y + e.r * 1.6);
      g.closePath();
      cloth(g, e.x, e.y, e.r * 1.4, C.c, C.line, lw, k);
      g.beginPath();
      g.moveTo(e.x - s * e.r * 0.5, e.y + e.r * 1.1);
      g.quadraticCurveTo(e.x, e.y - e.r * 0.7, e.x + s * e.r * 0.25, e.y - e.r * 0.5);
      g.quadraticCurveTo(e.x + s * e.r * 0.6, e.y + e.r * 0.4, e.x + s * e.r * 0.6, e.y + e.r * 1.1);
      g.closePath();
      patch(g, e.x, e.y + e.r * 0.3, e.r * 0.8, C.in);
    }
    // 푸딩 몸 (아래가 넓은 종 모양)
    const cx = (l.x + r.x) / 2;
    const top = t.y - t.r;
    const bot = l.y + l.r;
    const wB = r.x - l.x + l.r * 2;
    const wT = t.r * 1.85;
    g.beginPath();
    g.moveTo(cx - wT / 2, top + t.r * 0.55);
    g.quadraticCurveTo(cx - wT / 2, top, cx, top);
    g.quadraticCurveTo(cx + wT / 2, top, cx + wT / 2, top + t.r * 0.55);
    g.bezierCurveTo(cx + wT * 0.55, bot - l.r * 0.9, cx + wB / 2, bot - l.r * 0.7, cx + wB / 2 - l.r * 0.2, bot - l.r * 0.12);
    g.quadraticCurveTo(cx + wB / 2 - l.r * 0.3, bot, cx + wB / 2 - l.r * 0.8, bot);
    g.lineTo(cx - wB / 2 + l.r * 0.8, bot);
    g.quadraticCurveTo(cx - wB / 2 + l.r * 0.3, bot, cx - wB / 2 + l.r * 0.2, bot - l.r * 0.12);
    g.bezierCurveTo(cx - wB / 2, bot - l.r * 0.7, cx - wT * 0.55, bot - l.r * 0.9, cx - wT / 2, top + t.r * 0.55);
    g.closePath();
    const ch = (bot - top) / 2;
    cloth(g, cx, top + ch, ch * 1.05, C.c, C.line, lw, k);
    // 캐러멜 소스 (흘러내림)
    g.save();
    g.clip();
    g.beginPath();
    g.moveTo(cx - wB, top - 1);
    g.lineTo(cx + wB, top - 1);
    const drip = [0.5, 0.82, 0.42, 0.95, 0.5, 0.7, 0.45];
    for (let i = drip.length - 1; i >= 0; i -= 1) {
      const x = cx - wT * 0.62 + (i / (drip.length - 1)) * wT * 1.24;
      g.quadraticCurveTo(x + wT * 0.06, top + t.r * drip[i] * 1.1, x, top + t.r * drip[i]);
    }
    g.closePath();
    g.fillStyle = shade(g, cx, top + t.r * 0.3, t.r, C.car);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.35)";
    ell(g, cx - t.r * 0.35, top + t.r * 0.18, t.r * 0.32, t.r * 0.09, -0.2);
    g.fill();
    g.restore();
    // 휘핑크림 + 체리
    const ky = top - t.r * 0.05;
    for (const [dx, rr] of [[-0.18, 0.22], [0.18, 0.22], [0, 0.28]]) {
      circ(g, cx + dx * t.r, ky - (rr === 0.28 ? t.r * 0.1 : 0), t.r * rr);
      cloth(g, cx + dx * t.r, ky, t.r * rr, ["#fffaf2", "#ffffff", "#ece0cf"], "#c9b394", lw * 0.8, k, { noShine: true });
    }
    circ(g, cx + t.r * 0.06, ky - t.r * 0.38, t.r * 0.16);
    cloth(g, cx, ky - t.r * 0.38, t.r * 0.16, ["#ff3b5c", "#ff9aab", "#c81e3c"], "#9c1530", lw * 0.8, k);
    g.strokeStyle = "#5e8a3a";
    g.lineWidth = lw;
    g.beginPath();
    g.moveTo(cx + t.r * 0.08, ky - t.r * 0.52);
    g.quadraticCurveTo(cx + t.r * 0.18, ky - t.r * 0.72, cx + t.r * 0.3, ky - t.r * 0.74);
    g.stroke();
    // 얼굴
    const fy = top + t.r * 1.15;
    eyes(g, cx, fy, t.r * 0.42, t.r * 0.13, P);
    nose(g, cx, fy + t.r * 0.18, t.r * 0.08, "#ff8aa1");
    mouth(g, cx, fy + t.r * 0.27, t.r * 0.09, P);
    blush(g, cx, fy + t.r * 0.22, t.r * 0.66, t.r * 0.2);
    g.strokeStyle = "rgba(150,100,60,.6)";
    g.lineWidth = lw * 0.6;
    for (const s of [-1, 1]) {
      for (const dy of [-0.05, 0.08]) {
        g.beginPath();
        g.moveTo(cx + s * t.r * 0.78, fy + t.r * 0.2 + dy * t.r);
        g.lineTo(cx + s * t.r * 1.08, fy + t.r * 0.14 + dy * t.r * 1.6);
        g.stroke();
      }
    }
    // 앞발
    for (const s of [-1, 1]) {
      const px = cx + s * wB * 0.2;
      mochi(g, px, bot - l.r * 0.12, l.r * 0.34, l.r * 0.24, 0.3);
      cloth(g, px, bot - l.r * 0.12, l.r * 0.34, C.c, C.line, lw, k, { noShine: true });
      g.strokeStyle = C.line;
      g.lineWidth = lw * 0.5;
      for (const d of [-0.1, 0.1]) {
        g.beginPath();
        g.moveTo(px + d * l.r, bot - l.r * 0.2);
        g.lineTo(px + d * l.r, bot - l.r * 0.06);
        g.stroke();
      }
    }
  },

  fox(g, S, P, k, lw) {
    const [b, h, tl, e1, e2] = S;
    const C = PAL.fox;
    // 커다란 꼬리 (끝이 하얀)
    g.save();
    g.beginPath();
    g.moveTo(b.x - b.r * 0.6, b.y + b.r * 0.6);
    g.bezierCurveTo(tl.x - tl.r * 1.4, tl.y + tl.r * 0.9, tl.x - tl.r * 1.5, tl.y - tl.r * 1.4, tl.x - tl.r * 0.3, tl.y - tl.r * 1.5);
    g.bezierCurveTo(tl.x + tl.r * 0.6, tl.y - tl.r * 1.3, tl.x + tl.r * 0.7, tl.y - tl.r * 0.2, b.x - b.r * 0.5, b.y - b.r * 0.1);
    g.closePath();
    cloth(g, tl.x, tl.y, tl.r * 1.4, C.c, C.line, lw, k);
    g.clip();
    ell(g, tl.x - tl.r * 0.55, tl.y - tl.r * 1.25, tl.r * 0.95, tl.r * 0.6, -0.5);
    patch(g, tl.x - tl.r * 0.55, tl.y - tl.r * 1.25, tl.r * 0.9, C.cream[0]);
    g.restore();
    pear(g, b.x, b.y, b.r * 0.98, b.r);
    cloth(g, b.x, b.y, b.r, C.c, C.line, lw, k);
    ell(g, b.x, b.y + b.r * 0.22, b.r * 0.52, b.r * 0.56);
    patch(g, b.x, b.y + b.r * 0.22, b.r * 0.52, C.cream[0]);
    limbs(g, b, C, lw, k, { foot: C.dark, arm: C.dark, pad: "#a06a55" });
    neckShadow(g, h, b);
    // 뾰족 귀 (끝이 짙은)
    for (const [e, s] of [[e1, -1], [e2, 1]]) {
      g.beginPath();
      g.moveTo(e.x - s * e.r * 1.4, e.y + e.r * 1.5);
      g.quadraticCurveTo(e.x - s * e.r * 0.3, e.y - e.r * 1.4, e.x + s * e.r * 0.3, e.y - e.r * 1.8);
      g.quadraticCurveTo(e.x + s * e.r * 1.2, e.y + e.r * 0.1, e.x + s * e.r * 1.2, e.y + e.r * 1.6);
      g.closePath();
      cloth(g, e.x, e.y, e.r * 1.5, C.c, C.line, lw, k);
      g.save();
      g.clip();
      ell(g, e.x + s * e.r * 0.3, e.y - e.r * 1.6, e.r * 1.0, e.r * 0.8);
      g.fillStyle = C.dark[0];
      g.fill();
      g.restore();
      g.beginPath();
      g.moveTo(e.x - s * e.r * 0.5, e.y + e.r * 1.2);
      g.quadraticCurveTo(e.x, e.y - e.r * 0.6, e.x + s * e.r * 0.25, e.y - e.r * 0.6);
      g.quadraticCurveTo(e.x + s * e.r * 0.65, e.y + e.r * 0.4, e.x + s * e.r * 0.6, e.y + e.r * 1.2);
      g.closePath();
      patch(g, e.x, e.y + e.r * 0.3, e.r * 0.8, C.cream[0]);
    }
    mochi(g, h.x, h.y, h.r * 1.06, h.r * 0.92, 0.1);
    cloth(g, h.x, h.y, h.r, C.c, C.line, lw, k);
    // 하얀 볼털
    g.save();
    mochi(g, h.x, h.y, h.r * 1.06, h.r * 0.92, 0.1);
    g.clip();
    g.beginPath();
    g.moveTo(h.x - h.r * 1.1, h.y + h.r * 0.05);
    g.quadraticCurveTo(h.x - h.r * 0.5, h.y - h.r * 0.05, h.x, h.y + h.r * 0.28);
    g.quadraticCurveTo(h.x + h.r * 0.5, h.y - h.r * 0.05, h.x + h.r * 1.1, h.y + h.r * 0.05);
    g.lineTo(h.x + h.r * 1.1, h.y + h.r);
    g.lineTo(h.x - h.r * 1.1, h.y + h.r);
    g.closePath();
    patch(g, h.x, h.y + h.r * 0.5, h.r * 0.9, C.cream[0]);
    g.restore();
    eyes(g, h.x, h.y + h.r * 0.02, h.r * 0.42, h.r * 0.12, P);
    nose(g, h.x, h.y + h.r * 0.32, h.r * 0.11, "#3d2420");
    mouth(g, h.x, h.y + h.r * 0.4, h.r * 0.09, P);
    blush(g, h.x, h.y + h.r * 0.26, h.r * 0.66, h.r * 0.2);
  },

  penguin(g, S, P, k, lw) {
    const [b, h, f1, f2, kn] = S;
    const C = PAL.penguin;
    for (const [f, s] of [[f1, -1], [f2, 1]]) {
      g.save();
      g.translate(f.x, f.y);
      g.rotate(s * 0.55);
      ell(g, 0, f.r * 0.4, f.r * 0.85, f.r * 1.7);
      cloth(g, 0, 0, f.r * 1.4, C.c, C.line, lw, k, { noShine: true });
      g.restore();
    }
    ell(g, b.x, b.y, b.r * 1.0, b.r * 1.0);
    cloth(g, b.x, b.y, b.r, C.c, C.line, lw, k);
    ell(g, b.x, b.y + b.r * 0.12, b.r * 0.72, b.r * 0.8);
    patch(g, b.x, b.y + b.r * 0.12, b.r * 0.72, C.belly[0]);
    // 노란 발
    for (const s of [-1, 1]) {
      ell(g, b.x + s * b.r * 0.4, b.y + b.r * 0.95, b.r * 0.3, b.r * 0.14);
      cloth(g, b.x + s * b.r * 0.4, b.y + b.r * 0.95, b.r * 0.3, ["#ffc23d", "#ffe49a", "#e89a14"], "#b87411", lw, k, { noShine: true });
    }
    neckShadow(g, h, b);
    mochi(g, h.x, h.y, h.r * 1.04, h.r * 0.96);
    cloth(g, h.x, h.y, h.r, C.c, C.line, lw, k);
    // 하얀 얼굴 (하트 모양)
    g.beginPath();
    g.moveTo(h.x, h.y - h.r * 0.28);
    g.bezierCurveTo(h.x - h.r * 0.3, h.y - h.r * 0.62, h.x - h.r * 0.94, h.y - h.r * 0.3, h.x - h.r * 0.82, h.y + h.r * 0.3);
    g.bezierCurveTo(h.x - h.r * 0.7, h.y + h.r * 0.82, h.x + h.r * 0.7, h.y + h.r * 0.82, h.x + h.r * 0.82, h.y + h.r * 0.3);
    g.bezierCurveTo(h.x + h.r * 0.94, h.y - h.r * 0.3, h.x + h.r * 0.3, h.y - h.r * 0.62, h.x, h.y - h.r * 0.28);
    patch(g, h.x, h.y + h.r * 0.15, h.r * 0.8, C.belly[0]);
    eyes(g, h.x, h.y + h.r * 0.08, h.r * 0.36, h.r * 0.12, P);
    // 노란 부리
    g.beginPath();
    g.moveTo(h.x - h.r * 0.16, h.y + h.r * 0.28);
    g.quadraticCurveTo(h.x, h.y + h.r * 0.2, h.x + h.r * 0.16, h.y + h.r * 0.28);
    g.quadraticCurveTo(h.x, h.y + h.r * 0.5 + (P.mouth === "o" ? h.r * 0.1 : 0), h.x - h.r * 0.16, h.y + h.r * 0.28);
    cloth(g, h.x, h.y + h.r * 0.32, h.r * 0.16, ["#ffc23d", "#ffe49a", "#e89a14"], "#b87411", lw * 0.8, k, { noShine: true });
    blush(g, h.x, h.y + h.r * 0.3, h.r * 0.6, h.r * 0.18);
    // 방울 모자 (뜨개)
    g.beginPath();
    g.moveTo(h.x - h.r * 0.92, h.y - h.r * 0.42);
    g.bezierCurveTo(h.x - h.r * 0.9, h.y - h.r * 1.2, h.x + h.r * 0.9, h.y - h.r * 1.2, h.x + h.r * 0.92, h.y - h.r * 0.42);
    g.quadraticCurveTo(h.x, h.y - h.r * 0.56, h.x - h.r * 0.92, h.y - h.r * 0.42);
    cloth(g, h.x, h.y - h.r * 0.75, h.r * 0.9, C.knit, "#b23a58", lw, k);
    g.beginPath();
    g.moveTo(h.x - h.r * 0.98, h.y - h.r * 0.36);
    g.quadraticCurveTo(h.x, h.y - h.r * 0.58, h.x + h.r * 0.98, h.y - h.r * 0.36);
    g.lineTo(h.x + h.r * 0.94, h.y - h.r * 0.56);
    g.quadraticCurveTo(h.x, h.y - h.r * 0.76, h.x - h.r * 0.94, h.y - h.r * 0.56);
    g.closePath();
    cloth(g, h.x, h.y - h.r * 0.5, h.r * 0.6, ["#fff7fa", "#ffffff", "#f0d8e0"], "#b23a58", lw * 0.8, k, { noShine: true });
    circ(g, h.x, h.y - h.r * 1.12, h.r * 0.24);
    cloth(g, h.x, h.y - h.r * 1.12, h.r * 0.24, ["#fff7fa", "#ffffff", "#f0d8e0"], "#b23a58", lw * 0.8, k);
    // 목도리 + 매듭 (물리: 앞으로 튀어나온 구)
    g.beginPath();
    g.moveTo(h.x - h.r * 0.95, h.y + h.r * 0.7);
    g.quadraticCurveTo(h.x, h.y + h.r * 1.15, h.x + h.r * 0.95, h.y + h.r * 0.7);
    g.lineTo(h.x + h.r * 0.98, h.y + h.r * 0.98);
    g.quadraticCurveTo(h.x, h.y + h.r * 1.42, h.x - h.r * 0.98, h.y + h.r * 0.98);
    g.closePath();
    cloth(g, h.x, h.y + h.r * 1.05, h.r * 0.9, C.knit, "#b23a58", lw, k);
    g.save();
    g.translate(kn.x, kn.y);
    g.rotate(0.15);
    g.beginPath();
    g.roundRect(-kn.r * 0.55, -kn.r * 0.3, kn.r * 1.1, kn.r * 2.2, kn.r * 0.35);
    cloth(g, 0, kn.r * 0.8, kn.r * 1.1, C.knit, "#b23a58", lw, k, { noShine: true });
    g.strokeStyle = "#fff";
    g.lineWidth = lw * 0.6;
    for (const yy of [0.9, 1.5]) {
      g.beginPath();
      g.moveTo(-kn.r * 0.45, kn.r * yy);
      g.lineTo(kn.r * 0.45, kn.r * yy);
      g.stroke();
    }
    g.restore();
    circ(g, kn.x, kn.y - kn.r * 0.1, kn.r * 0.55);
    cloth(g, kn.x, kn.y, kn.r * 0.55, C.knit, "#b23a58", lw, k);
  },

  tiger(g, S, P, k, lw) {
    const [b, h, e1, e2] = S;
    const C = PAL.tiger;
    // 줄무늬 꼬리
    g.lineCap = "round";
    g.strokeStyle = C.line;
    g.lineWidth = b.r * 0.34;
    g.beginPath();
    g.moveTo(b.x + b.r * 0.7, b.y + b.r * 0.55);
    g.bezierCurveTo(b.x + b.r * 1.5, b.y + b.r * 0.6, b.x + b.r * 1.5, b.y - b.r * 0.4, b.x + b.r * 1.15, b.y - b.r * 0.75);
    g.stroke();
    g.strokeStyle = C.c[0];
    g.lineWidth = b.r * 0.24;
    g.stroke();
    g.setLineDash([b.r * 0.12, b.r * 0.22]);
    g.strokeStyle = C.stripe;
    g.stroke();
    g.setLineDash([]);
    pear(g, b.x, b.y, b.r * 0.98, b.r);
    cloth(g, b.x, b.y, b.r, C.c, C.line, lw, k);
    ell(g, b.x, b.y + b.r * 0.22, b.r * 0.52, b.r * 0.56);
    patch(g, b.x, b.y + b.r * 0.22, b.r * 0.52, C.white[0]);
    g.strokeStyle = C.stripe;
    g.lineWidth = lw * 1.4;
    for (const s of [-1, 1]) {
      for (const dy of [-0.2, 0.15]) {
        g.beginPath();
        g.moveTo(b.x + s * b.r * 0.98, b.y + dy * b.r);
        g.quadraticCurveTo(b.x + s * b.r * 0.8, b.y + (dy + 0.06) * b.r, b.x + s * b.r * 0.66, b.y + (dy + 0.02) * b.r);
        g.stroke();
      }
    }
    limbs(g, b, C, lw, k, { pad: "#ffd3c4" });
    neckShadow(g, h, b);
    for (const e of [e1, e2]) {
      circ(g, e.x, e.y, e.r * 1.1);
      cloth(g, e.x, e.y, e.r, C.c, C.line, lw, k);
      circ(g, e.x + (e.x > h.x ? -0.15 : 0.15), e.y + 0.3, e.r * 0.55);
      patch(g, e.x, e.y + 0.3, e.r * 0.55, C.white[0]);
    }
    mochi(g, h.x, h.y, h.r * 1.07, h.r * 0.92, 0.2);
    cloth(g, h.x, h.y, h.r, C.c, C.line, lw, k);
    // 이마 · 볼 줄무늬
    g.strokeStyle = C.stripe;
    g.lineWidth = lw * 1.6;
    g.lineCap = "round";
    for (const dx of [-0.2, 0, 0.2]) {
      g.beginPath();
      g.moveTo(h.x + dx * h.r, h.y - h.r * 0.88);
      g.lineTo(h.x + dx * h.r * 0.8, h.y - h.r * (dx === 0 ? 0.55 : 0.64));
      g.stroke();
    }
    for (const s of [-1, 1]) {
      for (const dy of [0.0, 0.2]) {
        g.beginPath();
        g.moveTo(h.x + s * h.r * 1.02, h.y + dy * h.r);
        g.quadraticCurveTo(h.x + s * h.r * 0.86, h.y + (dy + 0.04) * h.r, h.x + s * h.r * 0.74, h.y + (dy - 0.03) * h.r);
        g.stroke();
      }
    }
    ell(g, h.x, h.y + h.r * 0.38, h.r * 0.42, h.r * 0.3);
    patch(g, h.x, h.y + h.r * 0.38, h.r * 0.42, C.white[0]);
    eyes(g, h.x, h.y + h.r * 0.04, h.r * 0.4, h.r * 0.13, P);
    nose(g, h.x, h.y + h.r * 0.28, h.r * 0.12, "#ff7f96");
    mouth(g, h.x, h.y + h.r * 0.38, h.r * 0.1, P);
    blush(g, h.x, h.y + h.r * 0.32, h.r * 0.66, h.r * 0.18);
  },

  koala(g, S, P, k, lw) {
    const [b, h, e1, e2] = S;
    const C = PAL.koala;
    // 큰 귀 (복슬한 안쪽)
    for (const e of [e1, e2]) {
      circ(g, e.x, e.y, e.r * 1.05);
      cloth(g, e.x, e.y, e.r, C.c, C.line, lw, k);
      circ(g, e.x + (e.x > h.x ? -0.3 : 0.3), e.y + 0.2, e.r * 0.62);
      patch(g, e.x, e.y + 0.2, e.r * 0.62, C.inner[0]);
      g.strokeStyle = "rgba(255,255,255,.9)";
      g.lineWidth = lw * 0.6;
      for (let i = 0; i < 5; i += 1) {
        const a = -0.8 + i * 0.4 + (e.x > h.x ? 0 : Math.PI);
        g.beginPath();
        g.moveTo(e.x + Math.cos(a) * e.r * 0.45, e.y + Math.sin(a) * e.r * 0.45);
        g.lineTo(e.x + Math.cos(a) * e.r * 0.78, e.y + Math.sin(a) * e.r * 0.78);
        g.stroke();
      }
    }
    pear(g, b.x, b.y, b.r * 0.98, b.r);
    cloth(g, b.x, b.y, b.r, C.c, C.line, lw, k);
    ell(g, b.x, b.y + b.r * 0.22, b.r * 0.52, b.r * 0.56);
    patch(g, b.x, b.y + b.r * 0.22, b.r * 0.52, C.inner[0]);
    limbs(g, b, C, lw, k, { pad: "#e7dde2" });
    // 유칼립투스 잎
    g.save();
    g.translate(b.x + b.r * 0.7, b.y - b.r * 0.2);
    g.rotate(0.6);
    g.strokeStyle = "#4f8a5a";
    g.lineWidth = lw * 0.8;
    g.beginPath();
    g.moveTo(0, b.r * 0.2);
    g.lineTo(0, -b.r * 0.6);
    g.stroke();
    for (const [y, s] of [[-0.45, -1], [-0.25, 1], [-0.05, -1]]) {
      ell(g, s * b.r * 0.16, b.r * y, b.r * 0.17, b.r * 0.09, s * 0.5);
      g.fillStyle = "#8fcf9b";
      g.fill();
      g.stroke();
    }
    g.restore();
    neckShadow(g, h, b);
    mochi(g, h.x, h.y, h.r * 1.06, h.r * 0.92, 0.18);
    cloth(g, h.x, h.y, h.r, C.c, C.line, lw, k);
    eyes(g, h.x, h.y - h.r * 0.02, h.r * 0.44, h.r * 0.11, P);
    // 큰 코
    ell(g, h.x, h.y + h.r * 0.24, h.r * 0.2, h.r * 0.26);
    g.fillStyle = shade(g, h.x, h.y + h.r * 0.24, h.r * 0.26, [C.nose, "#6b6175", "#221e28"]);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.55)";
    ell(g, h.x - h.r * 0.06, h.y + h.r * 0.12, h.r * 0.06, h.r * 0.08, -0.3);
    g.fill();
    mouth(g, h.x, h.y + h.r * 0.52, h.r * 0.09, P);
    blush(g, h.x, h.y + h.r * 0.3, h.r * 0.66, h.r * 0.18);
  },

  unicorn(g, S, P, k, lw) {
    const [b, h, e1, e2, hn] = S;
    const C = PAL.unicorn;
    // 무지개 꼬리
    for (let i = 0; i < 5; i += 1) {
      g.strokeStyle = MANE[i];
      g.lineWidth = b.r * 0.2;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(b.x - b.r * 0.8, b.y + b.r * 0.4);
      g.bezierCurveTo(b.x - b.r * (1.5 + i * 0.06), b.y + b.r * 0.4, b.x - b.r * (1.6 - i * 0.08), b.y - b.r * (0.4 - i * 0.12), b.x - b.r * (1.15 + i * 0.05), b.y - b.r * (0.7 - i * 0.14));
      g.stroke();
    }
    pear(g, b.x, b.y, b.r * 0.98, b.r);
    cloth(g, b.x, b.y, b.r, C.c, C.line, lw, k);
    star(g, b.x, b.y + b.r * 0.22, b.r * 0.22, "#ffd84a", "#d9a21b");
    limbs(g, b, C, lw, k, { foot: C.hoof });
    neckShadow(g, h, b);
    // 뒤 갈기: 머리 왼쪽 뒤로 무지개 컬이 흘러내린다
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      circ(g, h.x - h.r * (0.72 + Math.sin(t * 2.6) * 0.28), h.y - h.r * 0.55 + t * h.r * 1.35, h.r * (0.32 - t * 0.08));
      g.fillStyle = MANE[i];
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.7)";
      g.lineWidth = lw * 0.5;
      g.stroke();
    }
    for (const e of [e1, e2]) {
      const s = e.x > h.x ? 1 : -1;
      g.beginPath();
      g.moveTo(e.x - s * e.r * 1.1, e.y + e.r * 1.3);
      g.quadraticCurveTo(e.x - s * e.r * 0.3, e.y - e.r * 1.2, e.x + s * e.r * 0.3, e.y - e.r * 1.4);
      g.quadraticCurveTo(e.x + s * e.r * 1.0, e.y, e.x + s * e.r * 1.0, e.y + e.r * 1.3);
      g.closePath();
      cloth(g, e.x, e.y, e.r * 1.3, C.c, C.line, lw, k);
      ell(g, e.x, e.y + e.r * 0.3, e.r * 0.4, e.r * 0.75);
      patch(g, e.x, e.y + e.r * 0.3, e.r * 0.5, C.in);
    }
    mochi(g, h.x, h.y, h.r * 1.04, h.r * 0.95);
    cloth(g, h.x, h.y, h.r, C.c, C.line, lw, k);
    // 금빛 뿔 (꼬인 줄)
    g.beginPath();
    g.moveTo(hn.x - hn.r * 1.0, h.y - h.r * 0.82);
    g.lineTo(hn.x, hn.y - hn.r * 1.9);
    g.lineTo(hn.x + hn.r * 1.0, h.y - h.r * 0.82);
    g.closePath();
    cloth(g, hn.x, hn.y, hn.r * 1.8, C.horn, "#c9952a", lw, k);
    g.strokeStyle = "rgba(201,149,42,.8)";
    g.lineWidth = lw * 0.6;
    for (let i = 1; i < 4; i += 1) {
      const t = i / 4;
      const yy = h.y - h.r * 0.82 + (hn.y - hn.r * 1.9 - (h.y - h.r * 0.82)) * t;
      const ww = hn.r * (1 - t);
      g.beginPath();
      g.moveTo(hn.x - ww, yy + hn.r * 0.25);
      g.lineTo(hn.x + ww, yy - hn.r * 0.25);
      g.stroke();
    }
    // 앞머리 (무지개 컬)
    for (let i = 0; i < 4; i += 1) {
      circ(g, h.x + h.r * (-0.42 + i * 0.22), h.y - h.r * (0.78 - Math.abs(i - 1.5) * 0.05), h.r * 0.2);
      g.fillStyle = MANE[i + 1];
      g.fill();
    }
    eyes(g, h.x, h.y + h.r * 0.1, h.r * 0.38, h.r * 0.13, P);
    ell(g, h.x, h.y + h.r * 0.48, h.r * 0.42, h.r * 0.24);
    patch(g, h.x, h.y + h.r * 0.48, h.r * 0.42, "#ffe1ee");
    g.fillStyle = "#e9a5c3";
    for (const s of [-1, 1]) {
      ell(g, h.x + s * h.r * 0.14, h.y + h.r * 0.46, h.r * 0.04, h.r * 0.06);
      g.fill();
    }
    mouth(g, h.x, h.y + h.r * 0.56, h.r * 0.08, P);
    blush(g, h.x, h.y + h.r * 0.34, h.r * 0.68, h.r * 0.2);
  },

  dragon(g, S, P, k, lw) {
    const [b, h, tl] = S;
    const C = PAL.dragon;
    // 날개 (몸 뒤)
    for (const s of [-1, 1]) {
      const wx = b.x + s * b.r * 0.7;
      const wy = b.y - b.r * 0.55;
      g.beginPath();
      g.moveTo(wx, wy + b.r * 0.3);
      g.quadraticCurveTo(wx + s * b.r * 0.6, wy - b.r * 0.9, wx + s * b.r * 1.25, wy - b.r * 0.5);
      g.quadraticCurveTo(wx + s * b.r * 1.0, wy - b.r * 0.15, wx + s * b.r * 1.15, wy + b.r * 0.05);
      g.quadraticCurveTo(wx + s * b.r * 0.8, wy + b.r * 0.05, wx + s * b.r * 0.85, wy + b.r * 0.32);
      g.quadraticCurveTo(wx + s * b.r * 0.4, wy + b.r * 0.2, wx, wy + b.r * 0.3);
      cloth(g, wx + s * b.r * 0.6, wy - b.r * 0.2, b.r * 0.7, C.wing, "#cf6f92", lw, k);
    }
    // 꼬리 (가시)
    g.beginPath();
    g.moveTo(b.x + b.r * 0.5, b.y + b.r * 0.85);
    g.bezierCurveTo(tl.x + tl.r * 0.2, tl.y + tl.r * 1.0, tl.x + tl.r * 1.3, tl.y + tl.r * 0.2, tl.x + tl.r * 1.4, tl.y - tl.r * 0.8);
    g.bezierCurveTo(tl.x + tl.r * 0.6, tl.y - tl.r * 0.2, tl.x - tl.r * 0.2, tl.y - tl.r * 0.3, b.x + b.r * 0.7, b.y + b.r * 0.2);
    g.closePath();
    cloth(g, tl.x, tl.y, tl.r * 1.2, C.c, C.line, lw, k);
    star(g, tl.x + tl.r * 1.45, tl.y - tl.r * 0.95, tl.r * 0.42, "#ffe066", "#d9a21b");
    pear(g, b.x, b.y, b.r * 0.98, b.r);
    cloth(g, b.x, b.y, b.r, C.c, C.line, lw, k);
    // 배 비늘
    ell(g, b.x, b.y + b.r * 0.2, b.r * 0.56, b.r * 0.62);
    patch(g, b.x, b.y + b.r * 0.2, b.r * 0.56, C.belly[0]);
    g.strokeStyle = "rgba(200,160,80,.7)";
    g.lineWidth = lw * 0.6;
    for (const dy of [-0.1, 0.18, 0.46]) {
      g.beginPath();
      g.moveTo(b.x - b.r * 0.44, b.y + b.r * dy);
      g.quadraticCurveTo(b.x, b.y + b.r * (dy + 0.1), b.x + b.r * 0.44, b.y + b.r * dy);
      g.stroke();
    }
    limbs(g, b, C, lw, k, { pad: "#c9f3e3" });
    neckShadow(g, h, b);
    // 뿔
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(h.x + s * h.r * 0.36, h.y - h.r * 0.8);
      g.quadraticCurveTo(h.x + s * h.r * 0.56, h.y - h.r * 1.3, h.x + s * h.r * 0.72, h.y - h.r * 1.32);
      g.quadraticCurveTo(h.x + s * h.r * 0.68, h.y - h.r * 1.0, h.x + s * h.r * 0.66, h.y - h.r * 0.7);
      g.closePath();
      cloth(g, h.x + s * h.r * 0.55, h.y - h.r, h.r * 0.3, C.horn, "#c9a548", lw, k, { noShine: true });
    }
    mochi(g, h.x, h.y, h.r * 1.06, h.r * 0.94);
    cloth(g, h.x, h.y, h.r, C.c, C.line, lw, k);
    // 머리 가시 (분홍)
    for (const dx of [-0.16, 0.16]) {
      g.beginPath();
      g.moveTo(h.x + dx * h.r - h.r * 0.1, h.y - h.r * 0.9);
      g.lineTo(h.x + dx * h.r, h.y - h.r * 1.14);
      g.lineTo(h.x + dx * h.r + h.r * 0.1, h.y - h.r * 0.9);
      g.closePath();
      g.fillStyle = C.wing[0];
      g.fill();
    }
    ell(g, h.x, h.y + h.r * 0.42, h.r * 0.46, h.r * 0.28);
    patch(g, h.x, h.y + h.r * 0.42, h.r * 0.46, C.belly[0]);
    eyes(g, h.x, h.y + h.r * 0.06, h.r * 0.4, h.r * 0.13, P);
    g.fillStyle = "#2f8c70";
    for (const s of [-1, 1]) {
      ell(g, h.x + s * h.r * 0.12, h.y + h.r * 0.36, h.r * 0.035, h.r * 0.05);
      g.fill();
    }
    mouth(g, h.x, h.y + h.r * 0.46, h.r * 0.1, P);
    if (P.mouth !== "o") {
      // 작은 송곳니
      g.fillStyle = "#fff";
      g.beginPath();
      g.moveTo(h.x + h.r * 0.06, h.y + h.r * 0.52);
      g.lineTo(h.x + h.r * 0.12, h.y + h.r * 0.62);
      g.lineTo(h.x + h.r * 0.15, h.y + h.r * 0.51);
      g.closePath();
      g.fill();
    }
    blush(g, h.x, h.y + h.r * 0.3, h.r * 0.68, h.r * 0.2);
  },
};

export function drawPlush(g, kind, x, y, s, a, P) {
  const def = dollById(kind);
  const S = parts(def, P.comX || 0, P.comY || 0);
  g.save();
  g.translate(x, y);
  g.rotate(-a);
  // 숨쉬기 · 떨어질 때 찌그러짐 (바닥 쪽을 기준으로)
  const sq = P.squash || 0;
  const breath = Math.sin(P.t * 2.4) * 0.015;
  const bottom = Math.max(...S.map((p) => p.y + p.r));
  g.translate(0, bottom * s);
  g.scale(s * (1 + sq * 0.28 - breath), s * (1 - sq * 0.3 + breath));
  g.translate(0, -bottom);
  DRAW[kind](g, S, P, s, 0.36);
  g.restore();
}

/** 도감 · 결과 화면용 작은 그림 (실루엣 가능) */
export function plushIcon(kind, size, opt = {}) {
  const c = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = `${size}px`;
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  const def = dollById(kind);
  // 그림 크기 맞추기: 물리 모양의 범위 + 귀 · 뿔 · 꼬리 여유
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y, r] of def.sph) {
    x0 = Math.min(x0, x - r);
    x1 = Math.max(x1, x + r);
    y0 = Math.min(y0, -y - r);
    y1 = Math.max(y1, -y + r);
  }
  x0 -= 2.5;
  x1 += 2.5;
  y0 -= 5;
  const w = x1 - x0 + 2;
  const h = y1 - y0 + 2;
  const s = Math.min(size / w, size / h);
  const P = { t: opt.t || 0.3, eye: opt.eye || "open", mouth: opt.mouth || "smile", ear: 0 };
  drawPlush(g, kind, size / 2 - ((x0 + x1) / 2) * s, size / 2 - ((y0 + y1) / 2) * s, s, 0, P);
  if (opt.silhouette) {
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = opt.silhouette;
    g.fillRect(0, 0, size, size);
  }
  return c;
}
