/*
 * 바다괴물 탐험대 — 7지역 괴물 (얼음 바다) + 장식
 *  서리오징어 · 유리게 · 눈물범괴물 / 얼음 덩어리 · 얼음 판 · 얼음 구멍
 */
import { INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss, limb, blush } from "../../ocean-blaster/art/kit.js?v=3";
import { ART } from "./registry.js?v=1";
import { mEye } from "./monsters1.js?v=1";

const TAU = Math.PI * 2;
const q8 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 8) / 8;

/** 눈 결정 (작은 별) */
function flake(ctx, x, y, r, color = "#ffffff") {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, r * 0.28);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.stroke();
}

/* ================================================================
 * 22 서리오징어 — 하얀 몸 · 서리 무늬 지느러미 · 긴 촉수 둘 · 하얀 먹물
 * ============================================================== */
const FS = { body: "#e6eefa", fin: "#b8d4f4", spot: "#9fb8e8", arm: "#d8e4f8" };
function drawFrostSquid(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const camo = p.camo || 0;
  const peek = Math.max(1 - camo, p.peek || 0);
  const wind = p.wind || 0;
  const sq = p.squish || 0;
  ctx.save();
  ctx.scale(s, s);
  // 오징어는 옆으로 눕힌 몸: 머리(눈) 오른쪽 · 외투(뾰족) 왼쪽
  ctx.scale(1 + sq * 0.12, 1 - sq * 0.1);
  // 팔 (오른쪽으로)
  for (let i = 0; i < 6; i++) {
    const v = (i - 2.5) / 2.5;
    const sw = Math.sin(t * 5 + i) * 6 * (1 - wind * 0.6);
    const L = 36 + (1 - Math.abs(v)) * 10 - wind * 10;
    limb(ctx, [20, v * 8, 20 + L * 0.5, v * 14 + sw * 0.5, 20 + L, v * 22 + sw], 6, FS.arm, { line: lineOf(FS.arm) });
  }
  // 긴 촉수 둘 (공격 땐 쭉)
  for (const sd of [-1, 1]) {
    const L = 64 + wind * 30 + (p.snap ? 30 : 0);
    const sw = Math.sin(t * 4 + sd) * 10 * (1 - wind);
    limb(ctx, [22, sd * 4, 22 + L * 0.5, sd * 18 + sw, 22 + L, sd * 10 + sw], 4.5, FS.arm, { line: lineOf(FS.arm) });
    ell(ctx, 24 + L, sd * 10 + sw, 8, 5);
    fill(ctx, FS.fin, 96, sd * 10, 8, 5, 2);
  }
  // 외투 (몸통)
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(26, -16);
    ctx.quadraticCurveTo(-20, -24, -62, -4);
    ctx.quadraticCurveTo(-66, 0, -62, 4);
    ctx.quadraticCurveTo(-20, 24, 26, 16);
    ctx.quadraticCurveTo(34, 0, 26, -16);
    ctx.closePath();
  };
  // 지느러미 (꼬리 쪽 위아래)
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-34, sd * 10);
    ctx.quadraticCurveTo(-58, sd * (30 + Math.sin(t * 6) * 4), -66, sd * 4);
    ctx.closePath();
    fill(ctx, FS.fin, -54, sd * 14, 14, 12, 2.4);
  }
  body();
  fill(ctx, FS.body, -14, -6, 44, 22, 3);
  // 서리 무늬 (점 · 결정)
  for (const [x, y, r] of [
    [-40, -4, 4],
    [-24, 6, 3],
    [-8, -8, 3.4],
    [-50, 4, 2.4],
  ]) {
    circ(ctx, x, y, r);
    ctx.fillStyle = alpha(FS.spot, 0.8);
    ctx.fill();
  }
  flake(ctx, -30, -10, 5, "#ffffff");
  flake(ctx, -14, 8, 4, "#ffffff");
  gloss(ctx, -20, -12, 18, 4, 0.6, -0.1);
  // 눈 (크다)
  if (peek > 0.1) mEye(ctx, 14, -4, 9, p, { open: Math.min(1, peek * 1.3), angry: wind > 0.2, color: "#3a5aa8" });
  else {
    ctx.beginPath();
    ctx.moveTo(8, -4);
    ctx.quadraticCurveTo(14, 0, 20, -4);
    stroke(ctx, INK, 2);
  }
  if (!camo) blush(ctx, 18, 8, 4);
  if (p.hit) {
    ctx.save();
    body();
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* ================================================================
 * 23 유리게 — 얼음처럼 투명한 몸 · 가운데 빛나는 심장 · clear(0~1) 만큼 사라진다
 * ============================================================== */
const GC = { glass: "#bfeaff", edge: "#6ab8e8", heart: "#ff7aa8" };
function drawGlassCrab(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const clear = Math.max(p.clear || 0, (p.camo || 0) * 0.75);
  const peek = Math.max(1 - (p.camo || 0), p.peek || 0);
  const wind = p.wind || 0;
  const walk = p.walk || 0;
  ctx.save();
  ctx.scale(s, s);
  const A = 1 - clear * 0.88;
  ctx.globalAlpha = A;
  // 다리
  for (let i = 0; i < 3; i++) {
    for (const sd of [-1, 1]) {
      const ph = t * 12 * walk + i * 1.7 + (sd > 0 ? 0 : Math.PI);
      const lift = Math.max(0, Math.sin(ph)) * 6 * walk;
      const bx = sd * (12 + i * 9);
      limb(ctx, [bx, 8, bx + sd * 20, -2 - lift, bx + sd * 28, 22 - lift], 5, GC.glass, { line: GC.edge });
    }
  }
  // 집게 둘
  for (const sd of [-1, 1]) {
    const op = 0.2 + wind * 0.6 + (p.snap || 0) * 0.3;
    ctx.save();
    ctx.translate(sd * 34, -14 - wind * 10);
    ctx.scale(sd, 1);
    ctx.rotate(-0.5 - wind * 0.3);
    ell(ctx, 6, 0, 12, 9);
    ctx.fillStyle = alpha(GC.glass, 0.85);
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = GC.edge;
    ctx.stroke();
    for (const [a, len] of [
      [-op, 16],
      [op * 0.5, 14],
    ]) {
      ctx.save();
      ctx.translate(14, 0);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.quadraticCurveTo(len * 0.7, -6, len, 0);
      ctx.quadraticCurveTo(len * 0.6, 3, 0, 3);
      ctx.closePath();
      ctx.fillStyle = alpha(GC.glass, 0.9);
      ctx.fill();
      ctx.strokeStyle = GC.edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  // 몸 (다면체 유리)
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-36, 6);
    ctx.lineTo(-30, -16);
    ctx.lineTo(-12, -26);
    ctx.lineTo(12, -26);
    ctx.lineTo(30, -16);
    ctx.lineTo(36, 6);
    ctx.lineTo(20, 16);
    ctx.lineTo(-20, 16);
    ctx.closePath();
  };
  body();
  ctx.fillStyle = linear(ctx, "gcb", 0, -26, 0, 16, [
    [0, alpha("#ffffff", 0.75)],
    [0.5, alpha(GC.glass, 0.6)],
    [1, alpha("#7ac8f0", 0.65)],
  ]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = GC.edge;
  ctx.stroke();
  // 면 나눔 선
  ctx.beginPath();
  ctx.moveTo(-12, -26);
  ctx.lineTo(-6, 4);
  ctx.lineTo(-20, 16);
  ctx.moveTo(12, -26);
  ctx.lineTo(6, 4);
  ctx.lineTo(20, 16);
  ctx.moveTo(-6, 4);
  ctx.lineTo(6, 4);
  ctx.strokeStyle = alpha("#ffffff", 0.7);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // 심장 (투명할 때도 살짝 보인다 = 들키는 곳)
  ctx.globalAlpha = Math.max(A, 0.35);
  const hb = 1 + Math.sin(t * 7) * 0.12;
  ctx.save();
  ctx.translate(0, -6);
  ctx.scale(hb, hb);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-9, -2, -5, -10, 0, -5);
  ctx.bezierCurveTo(5, -10, 9, -2, 0, 5);
  ctx.fillStyle = GC.heart;
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = A;
  // 눈자루
  for (const ex of [-10, 10]) {
    limb(ctx, [ex, -24, ex, -34 - peek * 6], 4, GC.glass, { line: GC.edge });
    if (peek > 0.2) mEye(ctx, ex, -38 - peek * 4, 6, p, { open: Math.min(1, peek * 1.3), angry: wind > 0.2, color: "#2a6aa8" });
  }
  // 반짝
  ctx.globalAlpha = 1 - clear * 0.5;
  flake(ctx, -22, -14, 3.4, "#ffffff");
  flake(ctx, 24, -6, 2.6, "#ffffff");
  if (p.hit) {
    ctx.globalAlpha = 1;
    body();
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
}

/* ================================================================
 * 24 눈물범괴물 — 하얀 털 · 까만 큰 눈 · 수염 · 얼음 구멍에서 쏙 (원점 = 구멍 가운데, 오른쪽으로 나온다)
 * ============================================================== */
const SS = { fur: "#f4f6fa", shade: "#c8d4e4", nose: "#2a2a3a" };
function drawSnowSeal(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const out = p.out == null ? 1 : p.out;
  const wind = p.wind || 0;
  ctx.save();
  ctx.scale(s, s);
  const x0 = -30 + out * 64;
  ctx.globalAlpha = Math.min(1, out * 5);
  // 몸 (구멍 밖으로 나온 만큼)
  ctx.save();
  ctx.translate(x0, 0);
  // 앞발 (눈뭉치 던지기)
  const thr = p.throw || 0;
  ctx.save();
  ctx.translate(-6, 18);
  ctx.rotate(0.6 - wind * 1.4 + thr * 1.6);
  ell(ctx, 14, 0, 16, 7);
  fill(ctx, SS.shade, 14, 0, 16, 7, 2.4);
  if (wind > 0.3) {
    circ(ctx, 30, 0, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#9ab8d8";
    ctx.stroke();
  }
  ctx.restore();
  // 머리 + 목
  ell(ctx, -16, 6, 34, 26);
  fill(ctx, SS.fur, -16, 0, 34, 26, 3);
  ell(ctx, 10, -2, 30, 27);
  fill(ctx, SS.fur, 6, -8, 30, 27, 3);
  // 털 결 (점)
  for (const [x, y] of [
    [-24, -4],
    [-10, 14],
    [-28, 12],
  ]) {
    circ(ctx, x, y, 2.2);
    ctx.fillStyle = SS.shade;
    ctx.fill();
  }
  // 눈 (까맣고 크다)
  for (const ex of [6, 26]) {
    const look = p.look || { x: 0, y: 0 };
    ell(ctx, ex, -8, 7.5, 9 * (p.blink ? 0.15 : 1));
    ctx.fillStyle = "#14141e";
    ctx.fill();
    if (!p.blink) {
      circ(ctx, ex + 2 + look.x * 2, -11, 2.8);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    if (wind > 0.2 || p.angry) {
      ctx.beginPath();
      ctx.moveTo(ex - 8, -20 - (ex < 16 ? 0 : 3));
      ctx.lineTo(ex + 8, -20 - (ex < 16 ? 3 : 0));
      stroke(ctx, INK, 2.6);
    }
  }
  // 코 · 입 · 수염
  ell(ctx, 30, 4, 5.5, 4);
  ctx.fillStyle = SS.nose;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(24, 10);
  ctx.quadraticCurveTo(30, 15, 36, 10);
  stroke(ctx, INK, 2);
  ctx.strokeStyle = alpha("#6a7a8a", 0.8);
  ctx.lineWidth = 1.4;
  const wz = Math.sin(t * 10) * 2 * (p.twitch || 0);
  for (const dy of [-2, 3, 8]) {
    ctx.beginPath();
    ctx.moveTo(34, 6 + dy * 0.4);
    ctx.lineTo(52, 2 + dy + wz);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, 6 + dy * 0.4);
    ctx.lineTo(8, 4 + dy - wz);
    ctx.stroke();
  }
  blush(ctx, 14, 6, 5);
  gloss(ctx, -4, -24, 14, 5, 0.5, -0.2);
  if (p.hit) {
    ell(ctx, 0, 0, 44, 30);
    ctx.fillStyle = `rgba(255,255,255,${0.5 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

ART.frostSquid = drawFrostSquid;
ART.glassCrab = (ctx, p) => drawGlassCrab(ctx, p.card ? { ...p, clear: 0 } : p);
ART.snowSeal = (ctx, p) => {
  if (p.card) {
    ctx.save();
    ctx.translate(-28, 0);
    drawSnowSeal(ctx, { ...p, out: 1 });
    ctx.restore();
    return;
  }
  drawSnowSeal(ctx, p);
};

/* ================================================================
 * 장식: 얼음 덩어리 (원점 = 바닥 가운데) · 벽에 박힌 얼음 판 · 얼음 구멍
 * ============================================================== */
export function iceBlock(c, w, h, rnd) {
  const pts = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = -w / 2 + k * w;
    const y = -h * (0.55 + 0.45 * Math.sin(k * Math.PI)) * (0.8 + rnd() * 0.25);
    pts.push([x, y]);
  }
  c.beginPath();
  c.moveTo(-w / 2, 0);
  for (const [x, y] of pts) c.lineTo(x, y);
  c.lineTo(w / 2, 0);
  c.closePath();
  const g = c.createLinearGradient(-w / 2, -h, w / 2, 0);
  g.addColorStop(0, "rgba(240,252,255,0.92)");
  g.addColorStop(0.5, "rgba(170,225,250,0.78)");
  g.addColorStop(1, "rgba(110,180,230,0.85)");
  c.fillStyle = g;
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = "#5a9ac8";
  c.stroke();
  // 면 · 금
  c.strokeStyle = "rgba(255,255,255,0.75)";
  c.lineWidth = 2;
  for (let i = 1; i < n; i += 2) {
    c.beginPath();
    c.moveTo(pts[i][0], pts[i][1]);
    c.lineTo(pts[i][0] + (rnd() - 0.5) * 20, -h * 0.2);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(-w * 0.32, -h * 0.7);
  c.lineTo(-w * 0.18, -h * 0.4);
  c.strokeStyle = "rgba(255,255,255,0.95)";
  c.lineWidth = 4;
  c.stroke();
  // 눈 덮인 위
  c.beginPath();
  c.moveTo(pts[1][0], pts[1][1] + 2);
  for (let i = 1; i < n; i++) c.lineTo(pts[i][0], pts[i][1] - 3);
  c.lineTo(pts[n - 1][0], pts[n - 1][1] + 2);
  c.strokeStyle = "#ffffff";
  c.lineWidth = 6;
  c.lineCap = "round";
  c.stroke();
}
/** 벽에 박힌 투명 얼음 판 (가운데 = 원점) */
export function iceSlab(c, w, h, rnd) {
  c.beginPath();
  c.moveTo(-w / 2, -h / 2 + 10);
  c.lineTo(-w / 2 + 16, -h / 2);
  c.lineTo(w / 2 - 10, -h / 2 + 6);
  c.lineTo(w / 2, h / 2 - 12);
  c.lineTo(w / 2 - 20, h / 2);
  c.lineTo(-w / 2 + 6, h / 2 - 6);
  c.closePath();
  c.fillStyle = "rgba(190,236,255,0.62)";
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = "rgba(90,150,200,0.95)";
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.8)";
  c.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const x = -w * 0.3 + i * w * 0.22;
    c.beginPath();
    c.moveTo(x, -h * 0.35);
    c.lineTo(x + 12, -h * 0.1);
    c.stroke();
  }
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.arc((rnd() - 0.5) * w * 0.8, (rnd() - 0.5) * h * 0.8, 1.5 + rnd() * 2, 0, TAU);
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.fill();
  }
}
/** 얼음 벽 구멍 테 (가운데 = 원점) */
export function iceHoleRim(c, rnd) {
  c.beginPath();
  c.ellipse(0, 0, 46, 36, 0, 0, TAU);
  c.lineWidth = 14;
  c.strokeStyle = "#cfeaf8";
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = "#6aa0c8";
  c.stroke();
  c.beginPath();
  c.ellipse(0, -2, 52, 42, 0, Math.PI * 1.08, Math.PI * 1.9);
  c.lineWidth = 6;
  c.strokeStyle = "#ffffff";
  c.stroke();
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.15 + rnd() * 0.7);
    c.beginPath();
    c.moveTo(Math.cos(a) * 46, Math.sin(a) * 36);
    c.lineTo(Math.cos(a) * 46 + (rnd() - 0.5) * 4, Math.sin(a) * 36 + 10 + rnd() * 10);
    c.lineWidth = 4;
    c.strokeStyle = "#e8f8ff";
    c.stroke();
  }
}
