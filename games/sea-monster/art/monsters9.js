/*
 * 바다괴물 탐험대 — 9지역 괴물 (잃어버린 도시) + 유적 장식
 *  석상수호자 · 고대앵무조개 · 거울물고기 / 기둥 · 아치 · 석상 받침 · 무너진 돌
 */
import { INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss, limb, blush } from "../../ocean-blaster/art/kit.js?v=3";
import { ART } from "./registry.js?v=1";
import { mEye } from "./monsters1.js?v=1";

const TAU = Math.PI * 2;
const q8 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 8) / 8;
function glowAt(ctx, x, y, r, color, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, 0.75 * a));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/* ================================================================
 * 28 석상수호자 — 물고기 기사 석상 · 삼지창 · 깨어나면 돌 틈이 청록빛으로
 * ============================================================== */
const SG = { stone: "#8a9496", dark: "#5a6466", moss: "#5a8a5a", glow: "#5ff0d0" };
function drawStatueGuard(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const alive = Math.max(1 - (p.camo || 0), p.peek || 0) * (p.stone ? 0.25 : 1);
  const wind = p.wind || 0;
  const thrust = p.thrust || 0;
  ctx.save();
  ctx.scale(s, s);
  if (alive > 0.3) glowAt(ctx, 0, -30, 90, SG.glow, alive * 0.5);
  const bob = alive * Math.sin(t * 3) * 3;
  ctx.translate(0, bob);
  // 꼬리 (아래, 지느러미)
  ctx.beginPath();
  ctx.moveTo(-14, 30);
  ctx.quadraticCurveTo(-20, 56, -34, 70 + Math.sin(t * 4) * 4 * alive);
  ctx.lineTo(-4, 62);
  ctx.lineTo(24, 74 - Math.sin(t * 4) * 4 * alive);
  ctx.quadraticCurveTo(14, 54, 14, 30);
  ctx.closePath();
  fill(ctx, SG.stone, 0, 50, 24, 24, 3);
  // 삼지창 (뒤 손)
  ctx.save();
  ctx.translate(26 + thrust * 30 - wind * 14, -10);
  ctx.rotate(-0.15 - wind * 0.3 + thrust * 0.15);
  ctx.beginPath();
  ctx.moveTo(-40, 0);
  ctx.lineTo(60, 0);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#4a5254";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = mix("#b8a878", "#ffe08a", q8(alive));
  ctx.stroke();
  for (const dy of [-10, 0, 10]) {
    ctx.beginPath();
    ctx.moveTo(56, dy * 0.6);
    ctx.lineTo(76, dy);
    ctx.lineTo(70, dy + (dy ? 0 : 0));
    ctx.lineWidth = 4;
    ctx.strokeStyle = mix("#b8a878", "#ffe08a", q8(alive));
    ctx.stroke();
  }
  ctx.restore();
  // 몸통 (갑옷 판)
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-26, 34);
    ctx.quadraticCurveTo(-34, -6, -22, -30);
    ctx.lineTo(22, -30);
    ctx.quadraticCurveTo(34, -6, 24, 34);
    ctx.closePath();
  };
  body();
  fill(ctx, SG.stone, -4, -6, 30, 34, 3);
  // 가슴 문양 (깨어나면 빛)
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(10, -4);
  ctx.lineTo(0, 10);
  ctx.lineTo(-10, -4);
  ctx.closePath();
  ctx.fillStyle = mix("#6a7476", SG.glow, q8(alive));
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = SG.dark;
  ctx.stroke();
  // 이끼
  for (const [x, y, r] of [
    [-20, 22, 6],
    [16, -22, 5],
    [-8, 28, 4],
  ]) {
    circ(ctx, x, y, r);
    ctx.fillStyle = alpha(SG.moss, 0.8);
    ctx.fill();
  }
  // 돌 금 (깨어나면 청록 빛)
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.lineTo(-12, 8);
  ctx.lineTo(-16, 20);
  ctx.moveTo(18, -12);
  ctx.lineTo(12, 2);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = alive > 0.2 ? alpha(SG.glow, 0.4 + alive * 0.6) : SG.dark;
  ctx.stroke();
  // 머리 (물고기 투구)
  ctx.save();
  ctx.translate(2, -48);
  ell(ctx, 0, 0, 24, 20);
  fill(ctx, SG.stone, -4, -6, 24, 20, 3);
  // 투구 지느러미 볏
  ctx.beginPath();
  ctx.moveTo(-18, -12);
  ctx.quadraticCurveTo(-6, -40, 14, -34);
  ctx.quadraticCurveTo(6, -22, 14, -14);
  ctx.closePath();
  fill(ctx, SG.dark, 0, -26, 14, 12, 2.6);
  // 눈 (석상 땐 빈 홈 · 깨어나면 빛나는 눈)
  for (const ex of [4, 16]) {
    if (alive > 0.25) {
      mEye(ctx, ex, -2, 5.5, p, { open: Math.min(1, alive * 1.4), angry: true, color: "#0a6a5a", white: "#d8fff4" });
    } else {
      ell(ctx, ex, -2, 5, 3);
      ctx.fillStyle = SG.dark;
      ctx.fill();
      if ((p.eyeGlow || 0) > 0) glowAt(ctx, ex, -2, 18, SG.glow, p.eyeGlow);
    }
  }
  // 입 (물고기 입)
  ctx.beginPath();
  ctx.moveTo(18, 10);
  ctx.quadraticCurveTo(24, 12, 26, 6);
  stroke(ctx, SG.dark, 2.4);
  ctx.restore();
  // 앞팔 (방패)
  ctx.save();
  ctx.translate(-18, -2);
  ell(ctx, -6, 6, 16, 22);
  fill(ctx, mix(SG.stone, "#a8a080", 0.3), -10, 0, 16, 22, 3);
  ctx.beginPath();
  ctx.arc(-6, 6, 8, 0, TAU);
  ctx.strokeStyle = mix(SG.dark, SG.glow, q8(alive * 0.7));
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.restore();
  if (p.hit) {
    body();
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
}

/* ================================================================
 * 29 고대앵무조개 — 줄무늬 나선 껍데기 · 촉수 다발 · 순간 이동 (warp 0~1)
 * ============================================================== */
const NT = { shell: "#f4e6cc", stripe: "#c06a3a", tent: "#e8b89a", eye: "#2a2a3a" };
function drawNautilus(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const warp = p.warp || 0;
  const peek = Math.max(1 - (p.camo || 0), p.peek || 0);
  const wind = p.wind || 0;
  ctx.save();
  ctx.scale(s * (1 - warp * 0.6), s * (1 + warp * 0.4));
  ctx.rotate(warp * 3);
  if (warp > 0.05) glowAt(ctx, 0, 0, 90, "#9fe8ff", warp);
  ctx.globalAlpha = 1 - warp * 0.8;
  // 촉수 (오른쪽 앞)
  for (let i = 0; i < 9; i++) {
    const v = (i - 4) / 4;
    const sw = Math.sin(t * 5 + i) * 5;
    const L = 22 + (1 - Math.abs(v)) * 10 + wind * 8;
    limb(ctx, [22, 6 + v * 10, 22 + L * 0.6, 8 + v * 16 + sw * 0.5, 22 + L, 10 + v * 20 + sw], 3.6, NT.tent, { line: lineOf(NT.tent) });
  }
  // 껍데기 (나선)
  ell(ctx, -6, 0, 36, 34);
  fill(ctx, NT.shell, -14, -10, 36, 34, 3);
  ctx.save();
  ell(ctx, -6, 0, 36, 34);
  ctx.clip();
  // 호랑이 줄무늬
  ctx.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.95 + i * 0.32;
    ctx.beginPath();
    ctx.moveTo(-6 + Math.cos(a) * 14, Math.sin(a) * 13);
    ctx.quadraticCurveTo(-6 + Math.cos(a + 0.2) * 28, Math.sin(a + 0.2) * 28, -6 + Math.cos(a + 0.12) * 40, Math.sin(a + 0.12) * 38);
    ctx.lineWidth = 6;
    ctx.strokeStyle = alpha(NT.stripe, 0.85);
    ctx.stroke();
  }
  ctx.restore();
  // 나선 선
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const a = i * 0.3 + Math.PI * 0.2;
    const r = 2 + i * 0.75;
    ctx.lineTo(-10 + Math.cos(a) * r * 0.9, 2 + Math.sin(a) * r * 0.85);
  }
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = darken(NT.stripe, 0.3);
  ctx.stroke();
  gloss(ctx, -18, -20, 14, 6, 0.6, -0.4);
  // 머리 덮개 · 눈
  ctx.beginPath();
  ctx.moveTo(20, -18);
  ctx.quadraticCurveTo(36, -12, 32, 6);
  ctx.quadraticCurveTo(22, 4, 16, -4);
  ctx.closePath();
  fill(ctx, darken(NT.stripe, 0.15), 26, -6, 10, 10, 2.4);
  if (peek > 0.15) mEye(ctx, 22, 2, 5.5, p, { open: Math.min(1, peek * 1.4), angry: wind > 0.2, color: NT.eye });
  if (p.hit) {
    ell(ctx, -6, 0, 36, 34);
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
}

/* ================================================================
 * 30 거울물고기 — 은빛 거울 비늘 · 무지개 반사 · 진짜는 바닥에 그림자 (shadow)
 * ============================================================== */
function drawMirrorFish(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const camo = p.camo || 0;
  const wind = p.wind || 0;
  ctx.save();
  ctx.scale(s, s);
  // 그림자 (진짜만 · 아래쪽에 어두운 타원)
  if (!p.clone && p.shadow !== 0 && camo < 0.5) {
    ctx.save();
    ell(ctx, 0, 62, 34, 9);
    ctx.fillStyle = "rgba(4,16,30,0.55)";
    ctx.fill();
    ctx.restore();
  }
  const A = camo > 0.5 ? 0.25 + (p.peek || 0) * 0.6 : 1;
  ctx.globalAlpha = A;
  const sw = Math.sin(t * 7) * 0.2;
  // 꼬리
  ctx.save();
  ctx.translate(-34, 0);
  ctx.rotate(sw);
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(-24, -20);
  ctx.quadraticCurveTo(-16, 0, -24, 20);
  ctx.closePath();
  fill(ctx, "#c8d4e4", -12, 0, 14, 16, 2.4);
  ctx.restore();
  // 몸 (다이아 모양 · 거울 비늘)
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-36, 0);
    ctx.quadraticCurveTo(-10, -32, 20, -22);
    ctx.quadraticCurveTo(40, -10, 42, 2);
    ctx.quadraticCurveTo(36, 18, 14, 24);
    ctx.quadraticCurveTo(-14, 28, -36, 0);
    ctx.closePath();
  };
  body();
  ctx.fillStyle = linear(ctx, `mfb${p.clone ? 1 : 0}`, -36, -26, 40, 24, [
    [0, p.clone ? "#d8e0ff" : "#ffffff"],
    [0.4, p.clone ? "#a8b8e8" : "#c8d8e8"],
    [0.7, p.clone ? "#c8c0f0" : "#e8f0f8"],
    [1, p.clone ? "#8898d0" : "#98a8c0"],
  ]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#5a6a88";
  ctx.stroke();
  // 거울 비늘 (반짝이 사각)
  ctx.save();
  body();
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      const x = -24 + i * 14;
      const y = -14 + j * 12 + (i % 2) * 6;
      const sh = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.3 + j * 2);
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 5);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fillStyle = `hsla(${(i * 60 + j * 40 + t * 40) % 360},90%,85%,${0.3 + sh * 0.5})`;
      ctx.fill();
    }
  }
  ctx.restore();
  // 지느러미
  ctx.beginPath();
  ctx.moveTo(-6, -24);
  ctx.quadraticCurveTo(4, -42, 16, -22);
  ctx.closePath();
  fill(ctx, "#c8d4e4", 4, -30, 10, 8, 2.2);
  // 눈
  mEye(ctx, 24, -6, 7, p, { open: camo > 0.5 ? (p.peek || 0) : 1, angry: wind > 0.2, color: p.clone ? "#5a4ab8" : "#2a6aa8" });
  ctx.beginPath();
  ctx.moveTo(36, 6);
  ctx.quadraticCurveTo(40, 9, 42, 5);
  stroke(ctx, INK, 2);
  gloss(ctx, -4, -16, 16, 5, 0.8, -0.3);
  if (p.hit) {
    body();
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
}

ART.statueGuard = (ctx, p) => drawStatueGuard(ctx, p.card ? { ...p, s: (p.s || 1) * 0.85 } : p);
ART.nautilus = drawNautilus;
ART.mirrorFish = (ctx, p) => drawMirrorFish(ctx, p.card ? { ...p, shadow: 0 } : p);

/* ================================================================
 * 유적 장식 (원점 = 바닥 가운데)
 * ============================================================== */
const RU = { stone: "#8a9a9c", light: "#b8c4c0", dark: "#4a5a5e", moss: "#4a8a6a" };
function stoneFill(c, x0, y0, x1, y1) {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, RU.light);
  g.addColorStop(0.5, RU.stone);
  g.addColorStop(1, RU.dark);
  return g;
}
/** 기둥 (h 높이 · broken: 위가 부러짐) */
export function column(c, h, broken, rnd) {
  const w = 34;
  // 받침
  rrect(c, -w - 10, -18, (w + 10) * 2, 18, 4);
  c.fillStyle = stoneFill(c, -w - 10, 0, w + 10, 0);
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = "#2a3436";
  c.stroke();
  const top = -h;
  c.beginPath();
  c.moveTo(-w, -18);
  c.lineTo(-w + 2, top + 16);
  if (broken) {
    c.lineTo(-w + 8, top + 4);
    c.lineTo(-6, top + 18);
    c.lineTo(6, top);
    c.lineTo(w - 4, top + 12);
  } else c.lineTo(w - 2, top + 16);
  c.lineTo(w, -18);
  c.closePath();
  c.fillStyle = stoneFill(c, -w, 0, w, 0);
  c.fill();
  c.stroke();
  // 세로 홈
  c.save();
  c.clip();
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    c.moveTo(i * 12, -20);
    c.lineTo(i * 12, top + 10);
    c.lineWidth = 3;
    c.strokeStyle = alpha("#2a3436", 0.35);
    c.stroke();
  }
  // 이끼 · 금
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.ellipse((rnd() - 0.5) * w * 1.4, -20 - rnd() * (h - 40), 8 + rnd() * 6, 5, 0, 0, TAU);
    c.fillStyle = alpha(RU.moss, 0.6);
    c.fill();
  }
  c.restore();
  if (!broken) {
    rrect(c, -w - 12, top, (w + 12) * 2, 18, 4);
    c.fillStyle = stoneFill(c, -w - 12, 0, w + 12, 0);
    c.fill();
    c.stroke();
    // 소용돌이 장식
    for (const sd of [-1, 1]) {
      c.beginPath();
      c.arc(sd * (w + 4), top + 9, 7, 0, TAU);
      c.lineWidth = 2.4;
      c.strokeStyle = "#2a3436";
      c.stroke();
    }
  }
}
/** 아치 (창문 · 문) — w 너비 · h 높이 */
export function archway(c, w, h, rnd) {
  const t = 30;
  c.beginPath();
  c.moveTo(-w / 2, 0);
  c.lineTo(-w / 2, -h + w / 2);
  c.arc(0, -h + w / 2, w / 2, Math.PI, 0);
  c.lineTo(w / 2, 0);
  c.lineTo(w / 2 - t, 0);
  c.lineTo(w / 2 - t, -h + w / 2);
  c.arc(0, -h + w / 2, w / 2 - t, 0, Math.PI, true);
  c.lineTo(-w / 2 + t, 0);
  c.closePath();
  c.fillStyle = stoneFill(c, -w / 2, 0, w / 2, 0);
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = "#2a3436";
  c.stroke();
  // 쐐기돌
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    c.beginPath();
    c.moveTo(Math.cos(a) * (w / 2 - t), -h + w / 2 + Math.sin(a) * (w / 2 - t));
    c.lineTo(Math.cos(a) * (w / 2), -h + w / 2 + Math.sin(a) * (w / 2));
    c.lineWidth = 2;
    c.strokeStyle = alpha("#2a3436", 0.6);
    c.stroke();
  }
  // 가운데 보석
  c.beginPath();
  c.moveTo(0, -h - 4);
  c.lineTo(8, -h + 8);
  c.lineTo(0, -h + 20);
  c.lineTo(-8, -h + 8);
  c.closePath();
  c.fillStyle = "#5ff0d0";
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = "#1a5a4a";
  c.stroke();
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.ellipse((rnd() - 0.5) * w * 0.9, -rnd() * h * 0.6, 8, 5, 0, 0, TAU);
    c.fillStyle = alpha(RU.moss, 0.6);
    c.fill();
  }
}
/** 석상 받침 (가짜 석상 · 진짜 석상수호자가 서는 곳) */
export function plinth(c) {
  rrect(c, -40, -26, 80, 26, 4);
  c.fillStyle = stoneFill(c, -40, 0, 40, 0);
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = "#2a3436";
  c.stroke();
  c.beginPath();
  c.moveTo(-34, -14);
  c.lineTo(34, -14);
  c.lineWidth = 2;
  c.strokeStyle = alpha("#2a3436", 0.5);
  c.stroke();
}
/** 무너진 돌덩이 무더기 */
export function rubble(c, s, rnd) {
  for (let i = 0; i < 5; i++) {
    const x = (-50 + i * 24 + rnd() * 10) * s;
    const w = (26 + rnd() * 18) * s;
    const h = (18 + rnd() * 16) * s;
    c.save();
    c.translate(x, -h / 2);
    c.rotate((rnd() - 0.5) * 0.5);
    rrect(c, -w / 2, -h / 2, w, h, 3);
    c.fillStyle = stoneFill(c, -w / 2, 0, w / 2, 0);
    c.fill();
    c.lineWidth = 2.4;
    c.strokeStyle = "#2a3436";
    c.stroke();
    c.restore();
  }
}
