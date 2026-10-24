/*
 * 말랑콩떡! 젤리 공장 · 그림 (캔버스 2D · 그림 파일 없음)
 *  젤리 일꾼 6명은 색마다 모양 · 소품이 달라서 색을 잘 못 보는 사람도 구분할 수 있다.
 *  몸 + 소품은 칸 크기가 바뀔 때만 한 번 그려 두고(스프라이트), 얼굴은 표정 때문에 매번 그린다.
 */
import { BOLT_H, BOLT_V, STAR, FLUFFY, RAINBOW, CRATE1, CRATE2, isFrozen, colorOf, isJelly, WALL, STICKY, PAD, isPad, isPipe, PIPE } from "./engine.js?v=1";

const TAU = Math.PI * 2;

/** 젤리 일꾼들 */
export const JELLIES = [
  { key: "pink", name: "말랑이", c: ["#fff0f6", "#ff9cc8", "#e2508f"], line: "#9c2a5e", cheek: "#ff6f9e", desc: "공장의 막내. 분홍 리본을 매면 힘이 나요." },
  { key: "yellow", name: "콩콩이", c: ["#fffbe2", "#ffe066", "#e9b20e"], line: "#94680a", cheek: "#ff9f66", desc: "안전 제일! 노란 안전모를 절대 벗지 않아요." },
  { key: "sky", name: "퐁퐁이", c: ["#ecfaff", "#8fd8ff", "#3a9ee6"], line: "#1b5f99", cheek: "#ff9ac0", desc: "물방울에서 태어난 젤리. 머리끝이 뾰족해요." },
  { key: "green", name: "쫀득이", c: ["#f0fff0", "#8ee69a", "#33ad57"], line: "#1c6b34", cheek: "#ff9a9a", desc: "작은 뿔 두 개가 자랑이에요. 제일 쫀득쫀득!" },
  { key: "purple", name: "몽글이", c: ["#f6f0ff", "#c4a6ff", "#7d55e0"], line: "#46288f", cheek: "#ff9ad6", desc: "달 모양 더듬이로 밤하늘 소리를 들어요." },
  { key: "orange", name: "통통이", c: ["#fff4e8", "#ffbb73", "#f08130"], line: "#9a4a12", cheek: "#ff7f6e", desc: "곰 귀를 닮은 동그란 귀가 쫑긋. 힘이 제일 세요." },
];
export const SPECIALS = {
  bolt: { name: "번개 젤리", desc: "4개를 한 줄로 이으면 생겨요. 밀면 멈춘 자리의 줄(가로 또는 세로) 전체를 없애요." },
  star: { name: "별 젤리", desc: "4개를 T자로 이으면 생겨요. 밀면 멈춘 자리 둘레 3×3 을 없애요." },
  fluffy: { name: "폭신 젤리", desc: "4개를 ㄱ자 · S자로 이으면 생겨요. 밀면 둘레 5×5 의 상자와 얼음만 없애요." },
  rainbow: { name: "무지개 젤리", desc: "5개 이상 이으면 생겨요. 밀어서 부딪힌 젤리와 같은 색을 모두 없애요." },
};

const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function star5(ctx, x, y, r, inner = 0.48, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const q = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  ctx.closePath();
}

/* ---------------- 젤리 몸 (u = 몸 반지름) ---------------- */
function jellyPath(ctx, u, drop) {
  ctx.beginPath();
  if (drop) {
    ctx.moveTo(0, -1.42 * u);
    ctx.bezierCurveTo(0.4 * u, -1.0 * u, 1.0 * u, -0.6 * u, 1.0 * u, 0);
  } else {
    ctx.moveTo(-u, 0.05 * u);
    ctx.arc(0, 0.05 * u, u, Math.PI, 0, false);
  }
  // 아래는 바닥에 살짝 퍼진 말랑한 모양
  ctx.bezierCurveTo(1.02 * u, 0.42 * u, 0.98 * u, 0.86 * u, 0.62 * u, 0.9 * u);
  ctx.quadraticCurveTo(0, 0.98 * u, -0.62 * u, 0.9 * u);
  ctx.bezierCurveTo(-0.98 * u, 0.86 * u, -1.02 * u, 0.42 * u, -u, drop ? 0 : 0.05 * u);
  if (drop) ctx.bezierCurveTo(-1.0 * u, -0.6 * u, -0.4 * u, -1.0 * u, 0, -1.42 * u);
  ctx.closePath();
}
function jellyBody(ctx, J, u, drop = false) {
  const [c0, c1, c2] = J.c;
  // 바닥 그림자
  ctx.fillStyle = "rgba(60,30,80,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 0.92 * u, 0.85 * u, 0.16 * u, 0, 0, TAU);
  ctx.fill();
  const g = ctx.createRadialGradient(-0.28 * u, -0.38 * u, 0.05 * u, 0, 0.1 * u, 1.15 * u);
  g.addColorStop(0, c0);
  g.addColorStop(0.45, c1);
  g.addColorStop(1, c2);
  jellyPath(ctx, u, drop);
  ctx.fillStyle = g;
  ctx.globalAlpha = 0.95;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.save();
  jellyPath(ctx, u, drop);
  ctx.clip();
  const core = ctx.createRadialGradient(0.05 * u, 0.3 * u, 0.05 * u, 0.05 * u, 0.3 * u, 0.8 * u);
  core.addColorStop(0, "rgba(255,255,255,0.3)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(-2 * u, -2 * u, 4 * u, 4 * u);
  for (const [x, y, r] of [
    [0.55, 0.42, 0.07],
    [0.68, 0.2, 0.04],
  ]) {
    ctx.beginPath();
    ctx.arc(x * u, y * u, r * u, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, 0.02 * u);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0.05 * u, 0.86 * u, 0.12 * Math.PI, 0.42 * Math.PI);
  ctx.lineWidth = Math.max(1, 0.07 * u);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.stroke();
  ctx.restore();
  jellyPath(ctx, u, drop);
  ctx.lineWidth = Math.max(1.4, 0.08 * u);
  ctx.strokeStyle = hexA(J.line, 0.62);
  ctx.stroke();
  gloss(ctx, u);
}
function gloss(ctx, u) {
  ctx.save();
  ctx.translate(-0.4 * u, -0.45 * u);
  ctx.rotate(-0.55);
  const g = ctx.createLinearGradient(0, -0.15 * u, 0, 0.15 * u);
  g.addColorStop(0, "rgba(255,255,255,0.92)");
  g.addColorStop(1, "rgba(255,255,255,0.1)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.28 * u, 0.14 * u, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(-0.1 * u, -0.7 * u, 0.055 * u, 0, TAU);
  ctx.fill();
}

/** 색마다 소품 (몸 위) */
const PROP = [
  // 분홍: 리본
  (ctx, u) => {
    ctx.save();
    ctx.translate(0.42 * u, -0.78 * u);
    ctx.rotate(0.3);
    ctx.fillStyle = "#ff5f9e";
    ctx.strokeStyle = "#9c2a5e";
    ctx.lineWidth = Math.max(1, 0.05 * u);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 0.42 * u, -0.32 * u, s * 0.4 * u, 0.04 * u);
      ctx.quadraticCurveTo(s * 0.36 * u, 0.3 * u, 0, 0);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 0.1 * u, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },
  // 노랑: 안전모
  (ctx, u) => {
    ctx.save();
    ctx.translate(0, -0.62 * u);
    const g = ctx.createLinearGradient(0, -0.45 * u, 0, 0.1 * u);
    g.addColorStop(0, "#ffd84a");
    g.addColorStop(1, "#f5a50c");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#8a5a06";
    ctx.lineWidth = Math.max(1, 0.05 * u);
    ctx.beginPath();
    ctx.arc(0, 0.05 * u, 0.62 * u, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    rr(ctx, -0.82 * u, -0.02 * u, 1.64 * u, 0.16 * u, 0.08 * u);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff6c8";
    rr(ctx, -0.08 * u, -0.52 * u, 0.16 * u, 0.5 * u, 0.06 * u);
    ctx.fill();
    ctx.restore();
  },
  // 하늘: 물방울 머리 (몸 모양으로) + 반짝
  (ctx, u) => {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    star5(ctx, 0.5 * u, -0.6 * u, 0.12 * u, 0.45);
    ctx.fill();
  },
  // 초록: 작은 뿔 둘
  (ctx, u) => {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 0.22 * u, -0.86 * u);
      ctx.quadraticCurveTo(s * 0.34 * u, -1.3 * u, s * 0.5 * u, -1.22 * u);
      ctx.quadraticCurveTo(s * 0.5 * u, -0.98 * u, s * 0.5 * u, -0.74 * u);
      ctx.closePath();
      ctx.fillStyle = "#c8f5b0";
      ctx.fill();
      ctx.lineWidth = Math.max(1, 0.05 * u);
      ctx.strokeStyle = "#1c6b34";
      ctx.stroke();
    }
  },
  // 보라: 달 더듬이
  (ctx, u) => {
    ctx.strokeStyle = "#46288f";
    ctx.lineWidth = Math.max(1.2, 0.06 * u);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -0.92 * u);
    ctx.quadraticCurveTo(0.08 * u, -1.18 * u, 0.2 * u, -1.32 * u);
    ctx.stroke();
    ctx.save();
    ctx.translate(0.24 * u, -1.38 * u);
    ctx.beginPath();
    ctx.arc(0, 0, 0.2 * u, 0, TAU);
    ctx.arc(0.09 * u, -0.06 * u, 0.16 * u, 0, TAU, true);
    ctx.fillStyle = "#ffe066";
    ctx.fill("evenodd");
    ctx.lineWidth = Math.max(1, 0.04 * u);
    ctx.strokeStyle = "#b07a0a";
    ctx.stroke();
    ctx.restore();
  },
  // 주황: 곰 귀
  (ctx, u, J) => {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * 0.6 * u, -0.72 * u, 0.26 * u, 0, TAU);
      ctx.fillStyle = J.c[1];
      ctx.fill();
      ctx.lineWidth = Math.max(1.2, 0.06 * u);
      ctx.strokeStyle = hexA(J.line, 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s * 0.6 * u, -0.72 * u, 0.13 * u, 0, TAU);
      ctx.fillStyle = "#ffd9b8";
      ctx.fill();
    }
  },
];

/* ---------------- 특수 젤리 ---------------- */
function drawBolt(ctx, u, vertical) {
  // 번개 젤리: 일반 젤리와 모양부터 다르게 — 가로(세로)로 긴 알약 모양 + 양끝 화살표 + 번개 배지
  const glow = ctx.createRadialGradient(0, 0, 0.6 * u, 0, 0, 1.45 * u);
  glow.addColorStop(0, "rgba(255,236,110,0.6)");
  glow.addColorStop(1, "rgba(255,236,110,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 1.45 * u, 0, TAU);
  ctx.fill();
  const L = 1.08 * u; // 반 길이
  const R = 0.76 * u; // 반 두께
  const w = vertical ? R : L;
  const h = vertical ? L : R;
  ctx.fillStyle = "rgba(60,30,80,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, h + 0.06 * u, w * 0.85, 0.14 * u, 0, 0, TAU);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -h, 0, h);
  g.addColorStop(0, "#fffbd0");
  g.addColorStop(0.45, "#ffe24a");
  g.addColorStop(1, "#f5a30c");
  rr(ctx, -w, -h + 0.05 * u, w * 2, h * 2, Math.min(w, h));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1.6, 0.09 * u);
  ctx.strokeStyle = "#a86a00";
  ctx.stroke();
  // 흰 줄무늬 (전기가 흐르는 느낌)
  ctx.save();
  rr(ctx, -w, -h + 0.05 * u, w * 2, h * 2, Math.min(w, h));
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1.2, 0.08 * u);
  ctx.beginPath();
  for (let k = -3; k <= 3; k++) {
    const q = k * 0.42 * u;
    if (vertical) {
      ctx.moveTo(-w, q - 0.2 * u);
      ctx.lineTo(w, q + 0.2 * u);
    } else {
      ctx.moveTo(q - 0.2 * u, -h);
      ctx.lineTo(q + 0.2 * u, h);
    }
  }
  ctx.stroke();
  ctx.restore();
  // 양끝 화살표 (어느 줄을 없애는지)
  ctx.save();
  if (vertical) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#a86a00";
  ctx.lineWidth = Math.max(1, 0.06 * u);
  ctx.lineJoin = "round";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * (L + 0.36 * u), 0.05 * u);
    ctx.lineTo(s * (L + 0.04 * u), -0.22 * u);
    ctx.lineTo(s * (L + 0.04 * u), 0.32 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  // 번개 배지 (오른쪽 위)
  ctx.save();
  ctx.translate(w * 0.72, -h * 0.78);
  ctx.beginPath();
  ctx.arc(0, 0, 0.3 * u, 0, TAU);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = Math.max(1, 0.05 * u);
  ctx.strokeStyle = "#a86a00";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.05 * u, -0.22 * u);
  ctx.lineTo(-0.12 * u, 0.03 * u);
  ctx.lineTo(0.0, 0.03 * u);
  ctx.lineTo(-0.06 * u, 0.22 * u);
  ctx.lineTo(0.13 * u, -0.05 * u);
  ctx.lineTo(0.01 * u, -0.05 * u);
  ctx.closePath();
  ctx.fillStyle = "#ffb000";
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(-w * 0.35, -h * 0.35);
  gloss(ctx, u * 0.6);
  ctx.restore();
}
function drawStar(ctx, u) {
  const glow = ctx.createRadialGradient(0, 0, 0.5 * u, 0, 0, 1.4 * u);
  glow.addColorStop(0, "rgba(255,220,120,0.5)");
  glow.addColorStop(1, "rgba(255,220,120,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 1.4 * u, 0, TAU);
  ctx.fill();
  star5(ctx, 0, 0.05 * u, 1.12 * u, 0.56);
  const g = ctx.createRadialGradient(-0.25 * u, -0.3 * u, 0.05 * u, 0, 0, 1.2 * u);
  g.addColorStop(0, "#fffbe0");
  g.addColorStop(0.5, "#ffd54a");
  g.addColorStop(1, "#f0a00c");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.5, 0.08 * u);
  ctx.strokeStyle = "#a86a00";
  ctx.stroke();
  gloss(ctx, u * 0.8);
}
function drawFluffy(ctx, u) {
  ctx.fillStyle = "rgba(60,30,80,0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 0.9 * u, 0.85 * u, 0.15 * u, 0, 0, TAU);
  ctx.fill();
  const puffs = [
    [0, -0.42, 0.58],
    [-0.56, -0.08, 0.52],
    [0.56, -0.08, 0.52],
    [-0.36, 0.4, 0.54],
    [0.36, 0.4, 0.54],
    [0, 0.1, 0.6],
  ];
  // 바깥 테두리 먼저 (구름 모양 한 덩어리로 보이게)
  ctx.beginPath();
  for (const [x, y, r] of puffs) {
    ctx.moveTo(x * u + r * u, y * u);
    ctx.arc(x * u, y * u, r * u, 0, TAU);
  }
  ctx.lineWidth = Math.max(2.4, 0.16 * u);
  ctx.strokeStyle = "#8f5fbf";
  ctx.lineJoin = "round";
  ctx.stroke();
  const g = ctx.createRadialGradient(-0.2 * u, -0.45 * u, 0.1 * u, 0, 0, 1.25 * u);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.55, "#ffe3f3");
  g.addColorStop(1, "#d9b8f2");
  ctx.fillStyle = g;
  ctx.fill();
  // 파스텔 점
  for (const [x, y, c] of [
    [-0.45, 0.25, "#ffc4e0"],
    [0.4, 0.3, "#c8e8ff"],
    [0.05, -0.6, "#fff0b0"],
  ]) {
    ctx.beginPath();
    ctx.arc(x * u, y * u, 0.08 * u, 0, TAU);
    ctx.fillStyle = c;
    ctx.fill();
  }
}
function drawRainbow(ctx, u) {
  const cols = ["#ff7a8a", "#ffad5a", "#ffe066", "#7fe08a", "#6cc6ff", "#a88cff"];
  const glow = ctx.createRadialGradient(0, 0, 0.6 * u, 0, 0, 1.4 * u);
  glow.addColorStop(0, "rgba(255,255,255,0.6)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 1.4 * u, 0, TAU);
  ctx.fill();
  ctx.save();
  jellyPath(ctx, u, false);
  ctx.clip();
  // 소용돌이 무지개
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0.1 * u);
    ctx.arc(0, 0.1 * u, 1.3 * u, (i / 12) * TAU, ((i + 1) / 12) * TAU);
    ctx.closePath();
    ctx.fillStyle = cols[i % 6];
    ctx.fill();
  }
  const w = ctx.createRadialGradient(0, 0.1 * u, 0.05 * u, 0, 0.1 * u, 0.7 * u);
  w.addColorStop(0, "rgba(255,255,255,0.95)");
  w.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = w;
  ctx.fillRect(-2 * u, -2 * u, 4 * u, 4 * u);
  ctx.restore();
  jellyPath(ctx, u, false);
  ctx.lineWidth = Math.max(1.5, 0.08 * u);
  ctx.strokeStyle = "rgba(120,80,160,0.7)";
  ctx.stroke();
  gloss(ctx, u);
}

/* ---------------- 상자 · 얼음 ---------------- */
function drawCrate(ctx, u, hp) {
  const s = u * 2.15;
  ctx.fillStyle = "rgba(60,30,80,0.18)";
  rr(ctx, -s / 2 + u * 0.06, -s / 2 + u * 0.12, s, s, u * 0.22);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
  g.addColorStop(0, "#f2c58e");
  g.addColorStop(1, "#c98a4e");
  rr(ctx, -s / 2, -s / 2, s, s, u * 0.22);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, 0.08 * u);
  ctx.strokeStyle = "#7a4a1e";
  ctx.stroke();
  // 쿠키 그림
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.26, 0, TAU);
  ctx.fillStyle = "#e7b06a";
  ctx.fill();
  ctx.strokeStyle = "#8f5a26";
  ctx.lineWidth = Math.max(1, 0.05 * u);
  ctx.stroke();
  ctx.fillStyle = "#6b3e1a";
  for (const [x, y] of [
    [-0.08, -0.1],
    [0.1, -0.02],
    [-0.02, 0.12],
  ]) {
    ctx.beginPath();
    ctx.arc(x * s, y * s, s * 0.04, 0, TAU);
    ctx.fill();
  }
  if (hp >= 2) {
    // 단단한 상자: 쇠 띠
    ctx.fillStyle = "#b8c3d6";
    ctx.strokeStyle = "#5a6478";
    for (const yy of [-0.32, 0.22]) {
      rr(ctx, -s / 2, yy * s, s, s * 0.1, u * 0.04);
      ctx.fill();
      ctx.stroke();
    }
  }
}
function drawIce(ctx, u) {
  const s = u * 1.86;
  ctx.save();
  rr(ctx, -s / 2, -s / 2, s, s, u * 0.25);
  const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(235,250,255,0.42)");
  g.addColorStop(1, "rgba(150,210,255,0.3)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(2, 0.11 * u);
  ctx.strokeStyle = "rgba(96,165,230,1)";
  ctx.stroke();
  // 눈송이 표시 (꽁꽁 상태가 한눈에)
  ctx.save();
  ctx.translate(s * 0.34, -s * 0.34);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.15, 0, TAU);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = Math.max(1, 0.05 * u);
  ctx.strokeStyle = "#4f9be0";
  ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3;
    ctx.moveTo(Math.cos(a) * s * 0.1, Math.sin(a) * s * 0.1);
    ctx.lineTo(-Math.cos(a) * s * 0.1, -Math.sin(a) * s * 0.1);
  }
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1, 0.06 * u);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1, 0.06 * u);
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.18);
  ctx.lineTo(-s * 0.12, -s * 0.36);
  ctx.moveTo(s * 0.2, s * 0.32);
  ctx.lineTo(s * 0.36, s * 0.14);
  ctx.stroke();
  ctx.restore();
}

/** 놓인 것 하나의 스프라이트 (칸 크기 px) */
export function makePieceSprite(piece, cell) {
  const u = cell * 0.38;
  const size = Math.ceil(cell * 1.6);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  ctx.translate(size / 2, size / 2 + cell * 0.02);
  if (isJelly(piece)) {
    const ci = colorOf(piece);
    const J = JELLIES[ci];
    jellyBody(ctx, J, u, ci === 2);
    PROP[ci](ctx, u, J);
  } else if (piece === BOLT_H || piece === BOLT_V) drawBolt(ctx, u, piece === BOLT_V);
  else if (piece === STAR) drawStar(ctx, u);
  else if (piece === FLUFFY) drawFluffy(ctx, u);
  else if (piece === RAINBOW) drawRainbow(ctx, u);
  else if (piece === CRATE1 || piece === CRATE2) drawCrate(ctx, u, piece === CRATE2 ? 2 : 1);
  return { cv, half: size / 2, u };
}
export function makeIceSprite(cell) {
  const u = cell * 0.38;
  const size = Math.ceil(cell * 1.6);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  ctx.translate(size / 2, size / 2);
  drawIce(ctx, u);
  return { cv, half: size / 2, u };
}

/* ---------------- 얼굴 (매번) ---------------- */
const INK = "#2b2140";
export function drawFace(ctx, piece, u, expr = "idle", lx = 0, ly = 0) {
  if (!isJelly(piece) && piece !== FLUFFY && piece !== STAR && piece !== BOLT_H && piece !== BOLT_V && piece !== RAINBOW) return;
  const ci = isJelly(piece) ? colorOf(piece) : -1;
  const es = 0.15 * u;
  const ex = 0.32 * u;
  const ey = (ci === 2 ? 0.08 : 0.02) * u + (piece === STAR ? 0.1 * u : 0);
  const lw = Math.max(1.2, es * 0.34);
  // 볼
  const cheek = ci >= 0 ? JELLIES[ci].cheek : "#ff9ac0";
  ctx.fillStyle = hexA(cheek, 0.45);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 0.56 * u, ey + 0.22 * u, 0.14 * u, 0.08 * u, 0, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = lw;
  for (const s of [-1, 1]) {
    const x = s * ex;
    if (expr === "blink" || expr === "sleep") {
      ctx.beginPath();
      ctx.arc(x, ey - es * 0.2, es * 0.75, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    } else if (expr === "happy") {
      ctx.beginPath();
      ctx.arc(x, ey + es * 0.45, es * 0.75, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    } else if (expr === "squish") {
      ctx.beginPath();
      ctx.moveTo(x + s * es * 0.6, ey - es * 0.55);
      ctx.lineTo(x - s * es * 0.45, ey);
      ctx.lineTo(x + s * es * 0.6, ey + es * 0.55);
      ctx.stroke();
    } else {
      const k = expr === "surprise" ? 1.15 : 1;
      const px = x + lx * es * 0.3;
      const py = ey + ly * es * 0.25;
      ctx.beginPath();
      ctx.ellipse(px, py, es * 0.82 * k, es * 1.02 * k, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px - es * 0.3, py - es * 0.38, es * 0.34, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + es * 0.32, py + es * 0.36, es * 0.15, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
    }
  }
  const my = ey + 0.24 * u;
  const mw = Math.max(es * 0.95, 0.12 * u);
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  if (expr === "surprise") {
    ctx.ellipse(0, my + mw * 0.2, mw * 0.36, mw * 0.46, 0, 0, TAU);
    ctx.fillStyle = "#7a2a4a";
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (expr === "happy" || ci === 1 || ci === 5) {
    ctx.moveTo(-mw * 0.55, my);
    ctx.quadraticCurveTo(0, my + mw * 1.1, mw * 0.55, my);
    ctx.closePath();
    ctx.fillStyle = "#c2416a";
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (ci === 3 || ci === 0) {
    ctx.moveTo(-mw * 0.65, my - mw * 0.05);
    ctx.quadraticCurveTo(-mw * 0.32, my + mw * 0.5, 0, my);
    ctx.quadraticCurveTo(mw * 0.32, my + mw * 0.5, mw * 0.65, my - mw * 0.05);
  } else {
    ctx.moveTo(-mw * 0.5, my);
    ctx.quadraticCurveTo(0, my + mw * 0.6, mw * 0.5, my);
  }
  ctx.stroke();
}

/* ---------------- 보드 바닥 (보드가 바뀌거나 크기가 바뀔 때만) ---------------- */
export function drawFloor(ctx, board, cell, ox, oy) {
  const { w, h, tiles, pipeAt } = board;
  const W = w * cell;
  const H = h * cell;
  // 보드 판 (둥근 쟁반)
  ctx.save();
  ctx.fillStyle = "rgba(90,60,120,0.18)";
  rr(ctx, ox - cell * 0.18 + 4, oy - cell * 0.18 + 8, W + cell * 0.36, H + cell * 0.36, cell * 0.4);
  ctx.fill();
  const tray = ctx.createLinearGradient(0, oy, 0, oy + H);
  tray.addColorStop(0, "#fff7fb");
  tray.addColorStop(1, "#f3e6f7");
  rr(ctx, ox - cell * 0.18, oy - cell * 0.18, W + cell * 0.36, H + cell * 0.36, cell * 0.4);
  ctx.fillStyle = tray;
  ctx.fill();
  ctx.lineWidth = Math.max(2, cell * 0.06);
  ctx.strokeStyle = "#4a2f63";
  ctx.stroke();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const t = tiles[i];
      const px = ox + x * cell;
      const py = oy + y * cell;
      if (t === WALL) continue;
      // 바닥 타일 (연한 체크)
      ctx.fillStyle = (x + y) % 2 ? "#fde9f4" : "#f6ecfb";
      rr(ctx, px + cell * 0.04, py + cell * 0.04, cell * 0.92, cell * 0.92, cell * 0.16);
      ctx.fill();
      if (t === STICKY) {
        ctx.fillStyle = "rgba(245,190,90,0.85)";
        ctx.strokeStyle = "#b9771f";
        ctx.lineWidth = Math.max(1.5, cell * 0.04);
        ctx.beginPath();
        const cx = px + cell / 2;
        const cy = py + cell / 2;
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * TAU;
          const r = cell * (0.34 + (k % 2) * 0.06);
          k ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 꿀처럼 끈적한 거품
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(cx - cell * 0.12, cy - cell * 0.1, cell * 0.06, 0, TAU);
        ctx.arc(cx + cell * 0.1, cy + cell * 0.08, cell * 0.035, 0, TAU);
        ctx.fill();
      } else if (isPad(t)) {
        drawPad(ctx, px + cell / 2, py + cell / 2, cell, t - PAD);
      } else if (isPipe(t)) {
        drawPipe(ctx, px + cell / 2, py + cell / 2, cell, t - PIPE);
      }
    }
  // 벽 (기계 블록) 은 위에 (그림자 포함)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (tiles[y * w + x] !== WALL) continue;
      const px = ox + x * cell;
      const py = oy + y * cell;
      ctx.fillStyle = "rgba(60,30,80,0.22)";
      rr(ctx, px + cell * 0.06, py + cell * 0.12, cell * 0.92, cell * 0.92, cell * 0.18);
      ctx.fill();
      const g = ctx.createLinearGradient(0, py, 0, py + cell);
      g.addColorStop(0, "#d9cfee");
      g.addColorStop(1, "#a897cf");
      rr(ctx, px + cell * 0.04, py + cell * 0.02, cell * 0.92, cell * 0.9, cell * 0.18);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, cell * 0.05);
      ctx.strokeStyle = "#5e4a8a";
      ctx.stroke();
      ctx.fillStyle = "#f4efff";
      for (const [bx, by] of [
        [0.22, 0.2],
        [0.78, 0.2],
        [0.22, 0.74],
        [0.78, 0.74],
      ]) {
        ctx.beginPath();
        ctx.arc(px + bx * cell, py + by * cell, cell * 0.05, 0, TAU);
        ctx.fill();
      }
    }
  ctx.restore();
}
function drawPad(ctx, cx, cy, cell, dir) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, cell * 0.36, 0, TAU);
  ctx.fillStyle = "#d4f7e6";
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, cell * 0.05);
  ctx.strokeStyle = "#3aa878";
  ctx.stroke();
  // 스프링 무늬
  ctx.strokeStyle = "rgba(58,168,120,0.5)";
  ctx.beginPath();
  ctx.arc(0, 0, cell * 0.24, 0, TAU);
  ctx.stroke();
  ctx.rotate((dir * Math.PI) / 2);
  ctx.beginPath();
  ctx.moveTo(0, -cell * 0.3);
  ctx.lineTo(cell * 0.2, -cell * 0.02);
  ctx.lineTo(cell * 0.07, -cell * 0.02);
  ctx.lineTo(cell * 0.07, cell * 0.24);
  ctx.lineTo(-cell * 0.07, cell * 0.24);
  ctx.lineTo(-cell * 0.07, -cell * 0.02);
  ctx.lineTo(-cell * 0.2, -cell * 0.02);
  ctx.closePath();
  ctx.fillStyle = "#1f8a5b";
  ctx.fill();
  ctx.restore();
}
const PIPE_COL = ["#4aa8f0", "#f07ab4", "#f0a83a", "#8a6af0", "#3ab88a", "#e0603a", "#5ac8d8", "#c89a3a", "#9a9ab0"];
function drawPipe(ctx, cx, cy, cell, id) {
  const col = PIPE_COL[(id - 1) % PIPE_COL.length];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, cell * 0.38, 0, TAU);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, cell * 0.05);
  ctx.strokeStyle = "#3a2a50";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, cell * 0.26, 0, TAU);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 0.26);
  g.addColorStop(0, "#1e1430");
  g.addColorStop(1, "#4a3a66");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(cell * 0.24)}px Jua, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(id), 0, cell * 0.01);
  ctx.restore();
}
export { rr, star5, hexA };
