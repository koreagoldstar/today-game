/*
 * 바다괴물 탐험대 — 4지역 괴물 (해저 동굴) + 동굴 장식
 *  동굴눈물고기 · 그늘가오리 · 돌얼굴 / 종유석 · 수정 · 빛버섯
 */
import { INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss, limb, blush } from "../../ocean-blaster/art/kit.js?v=3";
import { ART } from "./registry.js?v=1";
import { mEye } from "./monsters1.js?v=1";

const TAU = Math.PI * 2;
function hitFlash(ctx, p, path) {
  if (!p.hit) return;
  ctx.save();
  path();
  ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
  ctx.fill();
  ctx.restore();
}
/** 어둠 속에서도 보이는 빛나는 눈 */
function glowEyes(ctx, pts, r, color, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [x, y] of pts) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, alpha(color, 0.8 * a));
    g.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
  ctx.restore();
}

/* ================================================================
 * 14 동굴눈물고기 — 하얀 몸 · 커다란 빛나는 눈 (어둠 속에서는 눈만)
 * ============================================================== */
const CF = { body: "#e9e2f2", fin: "#c9b8e8", eye: "#7dffea" };
function drawCaveFish(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const wig = Math.sin(t * (p.fast ? 18 : 9)) * 0.3;
  ctx.save();
  ctx.scale(s, s);
  const vis = p.camo ? 0.15 : 1;
  ctx.globalAlpha = vis;
  // 꼬리
  ctx.save();
  ctx.translate(-26, 0);
  ctx.rotate(wig);
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(-20, -14);
  ctx.quadraticCurveTo(-14, 0, -20, 14);
  ctx.closePath();
  fill(ctx, CF.fin, -8, 0, 12, 10, 2.2);
  ctx.restore();
  const body = () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 18, 0, 0, TAU);
  };
  body();
  fill(ctx, CF.body, -4, -6, 30, 18, 2.6);
  // 비늘 줄
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-10 + i * 9, 0, 10, -0.9, 0.9);
    stroke(ctx, alpha("#b8a8d8", 0.6), 1.4);
  }
  // 등 · 배 지느러미 (반투명)
  ctx.beginPath();
  ctx.moveTo(-10, -16);
  ctx.quadraticCurveTo(0, -30, 12, -16);
  ctx.closePath();
  ctx.fillStyle = alpha(CF.fin, 0.8);
  ctx.fill();
  // 이빨 (아래로 삐죽)
  ctx.beginPath();
  ctx.moveTo(22, 6);
  ctx.lineTo(25, 13 + (p.wind || 0) * 4);
  ctx.lineTo(28, 6);
  flat(ctx, "#ffffff", 1, "#8a8a9a");
  ctx.globalAlpha = 1;
  // 큰 눈 (언제나 빛난다)
  const eyes = [
    [14, -5],
    [22, -4],
  ];
  glowEyes(ctx, eyes, 6, CF.eye, p.blink ? 0.2 : 1);
  if (!p.blink) {
    for (const [x, y] of eyes) {
      circ(ctx, x, y, 6);
      ctx.fillStyle = "#eafffb";
      ctx.fill();
      circ(ctx, x + 1, y, 3.2);
      ctx.fillStyle = (p.wind || 0) > 0.2 ? "#ff5a7a" : "#1aa89a";
      ctx.fill();
    }
  }
  hitFlash(ctx, p, body);
  ctx.restore();
}

/* ================================================================
 * 13 그늘가오리 — 빛을 싫어하는 커다란 가오리 (보라 · 테두리 빛)
 * ============================================================== */
const SR = { body: "#4a3a7a", belly: "#c8b8f0", rim: "#9a7aff" };
function drawShadeRay(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const flap = Math.sin(t * (p.fast ? 7 : 3.4)) * 0.45;
  const shy = p.shy || 0; // 빛을 받으면 몸을 움츠린다
  ctx.save();
  ctx.scale(s, s);
  // 꼬리 (채찍)
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.quadraticCurveTo(-70, Math.sin(t * 4) * 10, -110 - (p.wind || 0) * 20, Math.sin(t * 3) * 16);
  stroke(ctx, lineOf(SR.body), 6);
  stroke(ctx, SR.body, 3.5);
  // 위에서 비스듬히 본 마름모 몸 (날개 끝이 위아래로 펄럭)
  const tipY = 50 * (1 - shy * 0.35);
  const fu = flap;
  const bodyP = () => {
    ctx.beginPath();
    ctx.moveTo(44, 0);
    ctx.quadraticCurveTo(20, -tipY * 0.5, -6 + fu * 6, -tipY - fu * 18);
    ctx.quadraticCurveTo(-14, -tipY * 0.5, -34, 0);
    ctx.quadraticCurveTo(-14, tipY * 0.5, -6 - fu * 6, tipY - fu * 18);
    ctx.quadraticCurveTo(20, tipY * 0.5, 44, 0);
    ctx.closePath();
  };
  bodyP();
  ctx.fillStyle = linear(ctx, "rayBody", 0, -tipY, 0, tipY, [
    [0, lighten(SR.body, 0.18)],
    [0.5, SR.body],
    [1, darken(SR.body, 0.3)],
  ]);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = lineOf(SR.body);
  ctx.stroke();
  // 테두리 빛 (어둠 속 윤곽)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  bodyP();
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha(SR.rim, 0.6);
  ctx.stroke();
  ctx.restore();
  // 등 무늬 · 점
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(-26, 0);
  stroke(ctx, alpha(darken(SR.body, 0.3), 0.5), 3);
  for (const [x, y] of [
    [-6, -18],
    [-6, 18],
    [6, -30],
    [6, 30],
    [-16, -8],
  ]) {
    circ(ctx, x, y, 3);
    ctx.fillStyle = alpha(SR.belly, 0.45);
    ctx.fill();
  }
  // 머리 뿔 지느러미 · 두 눈
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(40, sd * 6);
    ctx.quadraticCurveTo(56, sd * 14, 54, sd * 2);
    stroke(ctx, lineOf(SR.body), 6);
    stroke(ctx, SR.body, 3.5);
  }
  const open = Math.max(1 - (p.camo || 0), p.peek || 0);
  for (const sd of [-1, 1]) mEye(ctx, 28, sd * 10, 5, p, { open, angry: (p.wind || 0) > 0.2, color: "#7a5aff", white: shy > 0.3 ? "#ffd0d0" : "#ffffff" });
  if (shy > 0.3) {
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(22, sd * 10 - 7);
      ctx.lineTo(34, sd * 10 - 4);
      stroke(ctx, INK, 2);
    }
  }
  hitFlash(ctx, p, bodyP);
  ctx.restore();
}

/* ================================================================
 * 15 돌얼굴 — 동굴 벽에 새겨진 얼굴. 입을 벌려 돌을 뱉는다. 원점 = 얼굴 가운데
 * ============================================================== */
const SF = { stone: "#7a7f94", dark: "#4a4e60", moss: "#6a9a6a", glow: "#ff6a4a" };
function drawStoneFace(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const open = Math.max(0, Math.min(1, p.open || 0));
  const awake = Math.max(1 - (p.camo || 0), p.peek || 0);
  ctx.save();
  ctx.scale(s, s);
  // 얼굴 판 (벽에서 살짝 튀어나온 둥근 돌)
  const face = () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, 54, 62, 0, 0, TAU);
  };
  face();
  fill(ctx, SF.stone, -12, -16, 54, 62, 3);
  ctx.save();
  face();
  ctx.clip();
  // 갈라진 틈 · 이끼
  ctx.beginPath();
  ctx.moveTo(-30, -50);
  ctx.lineTo(-20, -20);
  ctx.lineTo(-34, 4);
  ctx.moveTo(34, -40);
  ctx.lineTo(26, -10);
  stroke(ctx, alpha(SF.dark, 0.7), 2.4);
  for (const [x, y, r] of [
    [-30, -48, 10],
    [28, 46, 12],
    [40, -30, 7],
  ]) {
    ell(ctx, x, y, r, r * 0.5);
    ctx.fillStyle = alpha(SF.moss, 0.7);
    ctx.fill();
  }
  ctx.restore();
  // 눈썹 (돌 덩어리)
  for (const sd of [-1, 1]) {
    rrect(ctx, sd * 26 - 16, -34 - awake * 4 + ((p.wind || 0) > 0.2 ? sd * 3 : 0), 32, 10, 5);
    fill(ctx, darken(SF.stone, 0.15), sd * 26, -30, 16, 6, 2);
  }
  // 눈 (자면 홈만, 깨면 빨갛게 빛남)
  for (const sd of [-1, 1]) {
    const ex = sd * 24;
    const ey = -16;
    ell(ctx, ex, ey, 11, 7 * Math.max(0.15, awake));
    ctx.fillStyle = "#1a1c26";
    ctx.fill();
    if (awake > 0.3 && !p.blink) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 22);
      g.addColorStop(0, alpha(SF.glow, 0.9 * awake));
      g.addColorStop(1, alpha(SF.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(ex - 22, ey - 22, 44, 44);
      ctx.restore();
      circ(ctx, ex + (p.look ? p.look.x * 3 : 0), ey, 4 * awake);
      ctx.fillStyle = "#ffe0c0";
      ctx.fill();
    }
  }
  // 코
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(-8, 12);
  ctx.lineTo(8, 12);
  ctx.closePath();
  fill(ctx, lighten(SF.stone, 0.05), -2, 4, 8, 10, 2);
  // 입 (벌어지면 어두운 구멍 + 안쪽 돌멩이)
  const mh = 6 + open * 30;
  ell(ctx, 0, 34, 24, mh * 0.5);
  ctx.fillStyle = "#0e0f16";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = SF.dark;
  ctx.stroke();
  if (open > 0.5) {
    circ(ctx, 0, 34 + mh * 0.1, 7);
    fill(ctx, "#9a8a7a", -2, 32, 7, 7, 1.8);
  }
  gloss(ctx, -20, -40, 18, 6, 0.35, -0.3);
  hitFlash(ctx, p, face);
  ctx.restore();
}

ART.caveFish = drawCaveFish;
ART.shadeRay = drawShadeRay;
ART.stoneFace = drawStoneFace;

/* ================================================================
 * 동굴 장식
 * ============================================================== */
/** 종유석 (천장에서 매달림) — 원점 = 매달린 곳, 아래로 */
export function stalactites(ctx, w, rnd, color = "#6a6f84") {
  for (let i = 0; i < w / 22; i++) {
    const x = -w / 2 + rnd() * w;
    const h = 20 + rnd() * 60;
    const wd = 6 + rnd() * 10;
    ctx.beginPath();
    ctx.moveTo(x - wd, -4);
    ctx.quadraticCurveTo(x - wd * 0.4, h * 0.6, x, h);
    ctx.quadraticCurveTo(x + wd * 0.4, h * 0.6, x + wd, -4);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, `stal${color}`, 0, 0, 0, 80, [
      [0, darken(color, 0.25)],
      [1, lighten(color, 0.15)],
    ]);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = lineOf(color);
    ctx.stroke();
    circ(ctx, x, h - 2, 1.6);
    ctx.fillStyle = "rgba(200,240,255,0.7)";
    ctx.fill();
  }
}
/** 빛나는 수정 다발 — 원점 = 바닥 */
export function crystal(ctx, s, rnd, color = "#5ff0ff") {
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
    const len = (24 + rnd() * 36) * s;
    const w = (6 + rnd() * 5) * s;
    ctx.save();
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.lineTo(-w * 0.8, -len * 0.8);
    ctx.lineTo(0, -len);
    ctx.lineTo(w * 0.8, -len * 0.8);
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, `cry${color}`, -10, 0, 10, 0, [
      [0, lighten(color, 0.5)],
      [0.5, color],
      [1, darken(color, 0.3)],
    ]);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = darken(color, 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -len * 0.1);
    ctx.lineTo(-w * 0.2, -len * 0.75);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.stroke();
    ctx.restore();
  }
}
/** 빛버섯 — 원점 = 바닥 */
export function shroom(ctx, s, rnd, color = "#7dff9a") {
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 12 * s + (rnd() - 0.5) * 6;
    const h = (14 + rnd() * 16) * s;
    const r = (8 + rnd() * 6) * s;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, -h);
    ctx.strokeStyle = "#e9e2d0";
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, -h, r, r * 0.6, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = darken(color, 0.5);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      circ(ctx, x - r * 0.5 + k * r * 0.5, -h - r * 0.3, 1.4 * s);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fill();
    }
  }
}
