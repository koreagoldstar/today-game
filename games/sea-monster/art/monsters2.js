/*
 * 바다괴물 탐험대 — 2지역 괴물 (해초 숲)
 *  해초상어 · 미역괴물 · 성게돌이 · 해마기사
 * 공통 규칙은 monsters1.js 와 같다 (원점 = 몸 가운데, 오른쪽을 본다).
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

/* ================================================================
 * 06 해초상어 — 해초 무늬 상어. 숨어 있으면 꼬리만 살랑
 * ============================================================== */
const SHK = { body: "#5f9a74", stripe: "#3d6e52", belly: "#e3edc9", fin: "#4f8a64" };
function drawKelpShark(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const sw = Math.sin(t * (p.fast ? 16 : 7)) * (p.fast ? 0.32 : 0.18);
  const bite = (p.wind || 0) * 0.5 + (p.bite || 0) * 0.6;
  ctx.save();
  ctx.scale(s, s);
  // 꼬리 (가장 뒤)
  ctx.save();
  ctx.translate(-44, 0);
  ctx.rotate(sw);
  ctx.beginPath();
  ctx.moveTo(6, -4);
  ctx.quadraticCurveTo(-14, -12, -26, -30);
  ctx.quadraticCurveTo(-18, -4, -22, 22);
  ctx.quadraticCurveTo(-10, 6, 6, 4);
  ctx.closePath();
  fill(ctx, SHK.fin, -10, -4, 14, 18, 2.6);
  // 꼬리에 붙은 해초 리본
  ctx.beginPath();
  ctx.moveTo(-18, -18);
  ctx.quadraticCurveTo(-30 + Math.sin(t * 5) * 6, -30, -40, -26 + Math.sin(t * 4) * 6);
  stroke(ctx, "#7fcf6a", 3);
  ctx.restore();
  // 등지느러미 · 배지느러미
  ctx.beginPath();
  ctx.moveTo(-8, -16);
  ctx.quadraticCurveTo(0, -40, 14, -38);
  ctx.quadraticCurveTo(8, -26, 12, -14);
  ctx.closePath();
  fill(ctx, SHK.fin, 4, -26, 10, 12, 2.4);
  ctx.save();
  ctx.translate(4, 12);
  ctx.rotate(0.5 + Math.sin(t * 8) * 0.2);
  ctx.beginPath();
  ctx.ellipse(-6, 6, 14, 6, 0.3, 0, TAU);
  fill(ctx, darken(SHK.fin, 0.1), -6, 6, 14, 6, 2);
  ctx.restore();
  // 몸
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-46, -2);
    ctx.bezierCurveTo(-30, -24, 26, -26, 46, -6);
    ctx.quadraticCurveTo(54, 2, 46, 8);
    ctx.bezierCurveTo(26, 22, -30, 20, -46, 2);
    ctx.closePath();
  };
  body();
  fill(ctx, SHK.body, -4, -8, 46, 22, 3);
  ctx.save();
  body();
  ctx.clip();
  ell(ctx, 6, 14, 42, 12);
  ctx.fillStyle = SHK.belly;
  ctx.fill();
  // 해초 줄무늬 (위장)
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-34 + i * 16, -20);
    ctx.quadraticCurveTo(-30 + i * 16 + Math.sin(i) * 4, -8, -36 + i * 16, 4);
    stroke(ctx, alpha(SHK.stripe, 0.75), 4);
  }
  ctx.restore();
  // 아가미
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(18 + i * 5, -6);
    ctx.quadraticCurveTo(16 + i * 5, 0, 18 + i * 5, 6);
    stroke(ctx, alpha(SHK.stripe, 0.8), 1.8);
  }
  gloss(ctx, -6, -16, 18, 4, 0.55, -0.05);
  // 입 (웃는 이빨)
  ctx.save();
  ctx.translate(40, 6);
  ctx.beginPath();
  ctx.moveTo(-14, -2);
  ctx.quadraticCurveTo(0, 4 + bite * 10, 10, -2 - bite * 2);
  ctx.lineTo(10, 0);
  ctx.quadraticCurveTo(0, 6 + bite * 14, -14, 0);
  ctx.closePath();
  flat(ctx, "#7a1f3a", 1.6, INK);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-11 + i * 5, -1);
    ctx.lineTo(-9 + i * 5, 3);
    ctx.lineTo(-7 + i * 5, -1);
    flat(ctx, "#ffffff", 0.8, "#8a9aa0");
  }
  ctx.restore();
  mEye(ctx, 30, -8, 6.5, p, { angry: (p.wind || 0) > 0.2, color: "#2b4a3a" });
  blush(ctx, 30, 4, 4);
  hitFlash(ctx, p, body);
  ctx.restore();
}

/* ================================================================
 * 07 미역괴물 — 미역처럼 흔들리다가 따라온다. 원점 = 몸 가운데(떠다닐 때) / 뿌리(숨었을 때 offY 로 맞춤)
 * ============================================================== */
const WEED = { body: "#4fae5e", dark: "#2f7a40", leaf: "#6fd06a" };
function drawWeedMonster(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const camo = p.camo || 0;
  const reach = p.wind || 0;
  // 숨었을 때: 물결과 '반대로' 흔들린다 (텔)
  const phase = camo > 0.5 ? (p.tell ? Math.PI : 0) : 0;
  ctx.save();
  ctx.scale(s, s);
  const n = 8;
  const H = 120;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const sway = Math.sin(t * 1.3 + u * 2.6 + phase) * 16 * u * u + (p.lean || 0) * u * 30;
    pts.push([sway, 60 - u * H]);
  }
  // 리본 몸
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const w = 16 * (1 - u * 0.82) * (1 + Math.sin(u * 8 + t * 2) * 0.1);
    if (i === 0) ctx.moveTo(pts[i][0] - w, pts[i][1]);
    else ctx.lineTo(pts[i][0] - w, pts[i][1]);
  }
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    const w = 16 * (1 - u * 0.82) * (1 + Math.sin(u * 8 + t * 2) * 0.1);
    ctx.lineTo(pts[i][0] + w, pts[i][1]);
  }
  ctx.closePath();
  const bodyPath = () => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const w = 16 * (1 - u * 0.82);
      if (i === 0) ctx.moveTo(pts[i][0] - w, pts[i][1]);
      else ctx.lineTo(pts[i][0] - w, pts[i][1]);
    }
    for (let i = n; i >= 0; i--) ctx.lineTo(pts[i][0] + 16 * (1 - (i / n) * 0.82), pts[i][1]);
    ctx.closePath();
  };
  ctx.fillStyle = linear(ctx, "weedBody", -16, 0, 16, 0, [
    [0, lighten(WEED.body, 0.15)],
    [0.5, WEED.body],
    [1, darken(WEED.body, 0.25)],
  ]);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = lineOf(WEED.body);
  ctx.stroke();
  // 잎맥
  ctx.beginPath();
  for (let i = 0; i <= n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  stroke(ctx, alpha(lighten(WEED.body, 0.4), 0.6), 2);
  // 잎 팔 (공격 준비면 앞으로 쭉)
  for (const [i, side] of [
    [3, 1],
    [4, -1],
    [5, 1],
  ]) {
    const [px, py] = pts[i];
    const fl = Math.sin(t * 2.2 + i) * 0.3;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(side * (1.1 + fl) - reach * side * 0.9 + (side > 0 ? -reach * 0.6 : 0));
    const len = 30 + reach * 30;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(12, -len * 0.4, 0, -len);
    ctx.quadraticCurveTo(-12, -len * 0.4, 0, 0);
    flat(ctx, WEED.leaf, 1.8, lineOf(WEED.leaf));
    ctx.restore();
  }
  // 얼굴 (위쪽)
  const [fx, fy] = pts[6];
  const open = Math.max(1 - camo, p.peek || 0);
  mEye(ctx, fx - 6, fy, 5, p, { open, angry: reach > 0.2 });
  mEye(ctx, fx + 6, fy - 1, 5, p, { open, angry: reach > 0.2 });
  if (open > 0.4) {
    ctx.beginPath();
    ctx.moveTo(fx - 5, fy + 9);
    ctx.quadraticCurveTo(fx, fy + 13 + reach * 6, fx + 5, fy + 9);
    stroke(ctx, INK, 2);
  }
  hitFlash(ctx, p, bodyPath);
  ctx.restore();
}

/* ================================================================
 * 08 성게돌이 — 가시 공이 데굴데굴. rot = 굴러간 각도
 * ============================================================== */
const URC = { body: "#5a3a8a", spine: "#7a5ab0", tip: "#d9c8ff" };
function drawUrchin(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const curl = p.curl || 0; // 맞으면 가시를 바짝 세운다
  ctx.save();
  ctx.scale(s, s);
  ctx.rotate(p.rot || 0);
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const len = 18 + (i % 2) * 7 + curl * 10 + Math.sin(t * 6 + i) * 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
    ctx.lineTo(Math.cos(a) * (22 + len), Math.sin(a) * (22 + len));
    stroke(ctx, lineOf(URC.spine), 5);
    stroke(ctx, URC.spine, 3);
    circ(ctx, Math.cos(a) * (22 + len), Math.sin(a) * (22 + len), 1.8);
    ctx.fillStyle = URC.tip;
    ctx.fill();
  }
  const body = () => circ(ctx, 0, 0, 24);
  body();
  fill(ctx, URC.body, -6, -6, 24, 24, 3);
  for (let i = 0; i < 6; i++) {
    circ(ctx, Math.cos(i) * 12, Math.sin(i * 1.7) * 12, 2.4);
    ctx.fillStyle = alpha(URC.tip, 0.5);
    ctx.fill();
  }
  ctx.restore();
  // 얼굴은 구르지 않는다
  ctx.save();
  ctx.scale(s, s);
  const open = Math.max(1 - (p.camo || 0), p.peek || 0);
  mEye(ctx, -8, -4, 6.5, p, { open, angry: (p.wind || 0) > 0.2 || curl > 0.3 });
  mEye(ctx, 9, -4, 6.5, p, { open, angry: (p.wind || 0) > 0.2 || curl > 0.3 });
  if (open > 0.4) {
    ctx.beginPath();
    ctx.moveTo(-4, 9);
    ctx.quadraticCurveTo(0, 12, 4, 9);
    stroke(ctx, "#f2e6ff", 2);
  }
  gloss(ctx, -10, -14, 7, 3, 0.55, -0.4);
  hitFlash(ctx, p, body);
  ctx.restore();
}

/* ================================================================
 * 09 해마기사 — 투구를 쓴 해마. 꼬리를 해초에 감고 숨는다. 창처럼 돌진
 * ============================================================== */
const SH = { body: "#e8c94a", belly: "#fff2b0", fin: "#9be0ff", helm: "#c9d3e6", plume: "#ff5a5a" };
function drawSeahorse(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const camo = p.camo || 0;
  const body = mix(SH.body, "#8fc96a", camo * 0.7);
  const rear = (p.wind || 0) * 0.35;
  ctx.save();
  ctx.scale(s, s);
  ctx.rotate(-rear + (p.charge ? 0.9 : 0));
  // 꼬리 (말려 있음)
  ctx.beginPath();
  ctx.moveTo(-4, 22);
  ctx.bezierCurveTo(-8, 44, 10, 54, 12, 40);
  ctx.bezierCurveTo(14, 30, 2, 30, 4, 38);
  stroke(ctx, lineOf(body), 11);
  stroke(ctx, body, 7);
  // 등지느러미 (파닥)
  ctx.save();
  ctx.translate(-12, 4);
  ctx.rotate(Math.sin(t * 18) * 0.35);
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.quadraticCurveTo(-16, -4, -14, 10);
  ctx.quadraticCurveTo(-6, 4, 0, 8);
  ctx.closePath();
  ctx.fillStyle = alpha(SH.fin, 0.85);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = lineOf(SH.fin);
  ctx.stroke();
  ctx.restore();
  // 몸 (S 자)
  const bodyP = () => {
    ctx.beginPath();
    ctx.moveTo(-6, 26);
    ctx.bezierCurveTo(-16, 10, -16, -14, -4, -26);
    ctx.quadraticCurveTo(10, -34, 14, -24);
    ctx.bezierCurveTo(8, -10, 14, 8, 6, 26);
    ctx.closePath();
  };
  bodyP();
  fill(ctx, body, -6, -6, 14, 26, 2.8);
  // 배 마디
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(2, -10 + i * 7);
    ctx.lineTo(10, -8 + i * 7);
    stroke(ctx, alpha(darken(body, 0.35), 0.5), 1.6);
  }
  // 머리 + 주둥이(창)
  ctx.save();
  ctx.translate(4, -28);
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 11, -0.2, 0, TAU);
  fill(ctx, body, -2, -2, 13, 11, 2.6);
  rrect(ctx, 8, -2, 22 + (p.wind || 0) * 6, 7, 3.5);
  fill(ctx, body, 18, 1, 12, 4, 2.2);
  // 투구 + 깃털
  ctx.beginPath();
  ctx.arc(-1, -2, 13, Math.PI * 1.05, Math.PI * 1.95);
  ctx.closePath();
  fill(ctx, SH.helm, -4, -8, 12, 6, 2.2);
  ctx.beginPath();
  ctx.moveTo(-4, -14);
  ctx.quadraticCurveTo(-12, -30 + Math.sin(t * 4) * 3, -24, -24);
  ctx.quadraticCurveTo(-14, -20, -6, -10);
  ctx.closePath();
  flat(ctx, SH.plume, 1.6, "#7a1a1a");
  mEye(ctx, 2, -1, 5.5, p, { open: Math.max(1 - camo, p.peek || 0), angry: (p.wind || 0) > 0.2 });
  ctx.restore();
  gloss(ctx, -8, -14, 5, 9, 0.5, 0.2);
  hitFlash(ctx, p, bodyP);
  ctx.restore();
}

ART.kelpShark = drawKelpShark;
ART.weedMonster = drawWeedMonster;
ART.urchin = drawUrchin;
ART.seahorse = drawSeahorse;
