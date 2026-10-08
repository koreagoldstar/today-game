/*
 * 바다괴물 탐험대 — 10 · 11 · 12 지역 괴물 + 장식
 *  알깍쟁이(둥지) · 소용돌이물고기 · 폭풍가오리(심해 폭풍) · 심연등불(어비스) / 알 무더기 · 둥지 · 소용돌이
 */
import { INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss, limb, blush } from "../../ocean-blaster/art/kit.js?v=3";
import { ART } from "./registry.js?v=1";
import { mEye } from "./monsters1.js?v=1";

const TAU = Math.PI * 2;
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

/** 알 하나 (원점 = 알 가운데). crack 0~1 금 · hue 무늬 색 */
export function egg(ctx, r, crack, color = "#f4e8ff", spot = "#c88aff") {
  ell(ctx, 0, 0, r * 0.82, r);
  fill(ctx, color, -r * 0.3, -r * 0.4, r * 0.82, r, 2.6);
  for (const [x, y, rr] of [
    [-r * 0.3, -r * 0.3, r * 0.16],
    [r * 0.28, r * 0.05, r * 0.2],
    [-r * 0.1, r * 0.45, r * 0.13],
  ]) {
    circ(ctx, x, y, rr);
    ctx.fillStyle = alpha(spot, 0.75);
    ctx.fill();
  }
  if (crack > 0) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.1);
    ctx.lineTo(-r * 0.4, -r * 0.25);
    ctx.lineTo(-r * 0.15, 0);
    ctx.lineTo(r * 0.1, -r * 0.3);
    ctx.lineTo(r * 0.4 * crack, -r * 0.05);
    ctx.lineTo(r * 0.7 * crack, -r * 0.2);
    stroke(ctx, "#5a3a6a", 2.4);
  }
  gloss(ctx, -r * 0.3, -r * 0.55, r * 0.22, r * 0.12, 0.7, -0.4);
}

/* ================================================================
 * 31 알깍쟁이 — 알 껍데기 모자를 쓴 아기 괴물 (camo = 알 속)
 * ============================================================== */
const EG = { body: "#7ad8a8", belly: "#e8fff0", shell: "#f4e8ff" };
function drawEggling(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const camo = p.camo || 0;
  const wind = p.wind || 0;
  ctx.save();
  ctx.scale(s, s);
  if (camo > 0.5) {
    // 알 (흔들흔들 · 금)
    ctx.rotate(Math.sin(t * 18) * 0.12 * (p.wobble || 0));
    egg(ctx, 30, p.crack || 0, EG.shell);
    if ((p.peek || 0) > 0.3) {
      // 금 틈으로 눈 하나
      mEye(ctx, -2, -6, 4.5, p, { open: 1, color: "#2a6a4a" });
    }
    ctx.restore();
    return;
  }
  const hop = Math.abs(Math.sin(t * 8)) * 6 * (p.walk || 0);
  ctx.translate(0, -hop);
  // 꼬리
  ctx.beginPath();
  ctx.moveTo(-18, 10);
  ctx.quadraticCurveTo(-34, 14 + Math.sin(t * 10) * 4, -32, 0);
  ctx.closePath();
  fill(ctx, EG.body, -26, 8, 10, 8, 2.4);
  // 몸 (동글)
  ell(ctx, 0, 6, 24, 20);
  fill(ctx, EG.body, -6, 0, 24, 20, 3);
  ell(ctx, 4, 12, 14, 10);
  ctx.fillStyle = EG.belly;
  ctx.fill();
  // 짧은 팔다리
  for (const [x, y] of [
    [-10, 22],
    [10, 22],
  ]) {
    ell(ctx, x, y + Math.sin(t * 10 + x) * 2, 6, 4);
    fill(ctx, darken(EG.body, 0.1), x, y, 6, 4, 2);
  }
  // 이빨 하나 · 눈
  mEye(ctx, 8, -2, 7, p, { open: 1, angry: wind > 0.2, color: "#2a6a4a" });
  mEye(ctx, -6, 0, 5.5, p, { open: 1, angry: wind > 0.2, color: "#2a6a4a" });
  ctx.beginPath();
  ctx.moveTo(4, 12);
  ctx.quadraticCurveTo(12, 17, 20, 11);
  stroke(ctx, INK, 2);
  ctx.beginPath();
  ctx.moveTo(10, 13);
  ctx.lineTo(12, 18);
  ctx.lineTo(14, 13);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  blush(ctx, 18, 6, 3.5);
  // 알 껍데기 모자 (지그재그)
  ctx.save();
  ctx.translate(0, -14);
  ctx.rotate(-0.2 + Math.sin(t * 6) * 0.05);
  ctx.beginPath();
  ctx.moveTo(-20, 2);
  ctx.quadraticCurveTo(-20, -24, 0, -26);
  ctx.quadraticCurveTo(20, -24, 20, 2);
  for (let i = 0; i <= 6; i++) ctx.lineTo(20 - i * (40 / 6), 2 + (i % 2 ? 6 : 0));
  ctx.closePath();
  fill(ctx, EG.shell, -4, -14, 20, 16, 2.6);
  circ(ctx, 8, -12, 3);
  ctx.fillStyle = alpha("#c88aff", 0.7);
  ctx.fill();
  ctx.restore();
  if (p.hit) {
    ell(ctx, 0, 6, 24, 20);
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
}

/* ================================================================
 * 32 소용돌이물고기 — 나선 무늬 동그란 물고기 · 소용돌이를 타고 휙 (spin)
 * ============================================================== */
const WF = { body: "#5ab8e8", stripe: "#1a5a9a", belly: "#e0f6ff", fin: "#8ae0ff" };
function drawWhirlFish(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const camo = p.camo || 0;
  const wind = p.wind || 0;
  const spin = p.spin || 0;
  ctx.save();
  ctx.scale(s, s);
  if (spin > 0.05) {
    // 소용돌이 고리
    ctx.save();
    ctx.globalAlpha = spin;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 40 + i * 12, t * 10 + i, t * 10 + i + 4);
      ctx.strokeStyle = alpha("#c8f4ff", 0.7 - i * 0.2);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
    ctx.rotate(t * 14 * spin);
  }
  ctx.globalAlpha = camo > 0.5 ? 0.3 + (p.peek || 0) * 0.6 : 1;
  // 꼬리 · 지느러미
  ctx.beginPath();
  ctx.moveTo(-28, 0);
  ctx.lineTo(-48, -18 + Math.sin(t * 9) * 4);
  ctx.quadraticCurveTo(-40, 0, -48, 18 + Math.sin(t * 9) * 4);
  ctx.closePath();
  fill(ctx, WF.fin, -40, 0, 12, 14, 2.4);
  ctx.beginPath();
  ctx.moveTo(-10, -26);
  ctx.quadraticCurveTo(4, -44, 18, -24);
  ctx.closePath();
  fill(ctx, WF.fin, 4, -32, 10, 8, 2.2);
  // 몸 (동그랗게)
  ell(ctx, 0, 0, 32, 28);
  fill(ctx, WF.body, -8, -8, 32, 28, 3);
  // 나선 무늬
  ctx.save();
  ell(ctx, 0, 0, 32, 28);
  ctx.clip();
  ctx.beginPath();
  for (let i = 0; i < 46; i++) {
    const a = i * 0.32 + t * 2;
    const r = 2 + i * 0.7;
    ctx.lineTo(-4 + Math.cos(a) * r, 2 + Math.sin(a) * r * 0.9);
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = alpha(WF.stripe, 0.7);
  ctx.stroke();
  ctx.restore();
  ell(ctx, 6, 12, 16, 9);
  ctx.fillStyle = alpha(WF.belly, 0.85);
  ctx.fill();
  mEye(ctx, 16, -8, 8, p, { open: camo > 0.5 ? (p.peek || 0) : 1, angry: wind > 0.2, color: "#1a3a6a" });
  ctx.beginPath();
  ctx.moveTo(26, 6);
  ctx.quadraticCurveTo(31, 10, 34, 4);
  stroke(ctx, INK, 2);
  gloss(ctx, -10, -16, 12, 5, 0.6, -0.3);
  if (p.hit) {
    ell(ctx, 0, 0, 32, 28);
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
}

/* ================================================================
 * 33 폭풍가오리 — 번개 무늬 큰 가오리 · 날갯짓으로 강한 물살 (flap)
 * ============================================================== */
const SR = { body: "#4a5a8a", dark: "#2a345a", belly: "#c8d4f0", bolt: "#ffe14a" };
function drawStormRay(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const camo = p.camo || 0;
  const wind = p.wind || 0;
  const flap = Math.sin(t * (4 + wind * 8)) * (0.6 + wind * 0.6);
  ctx.save();
  ctx.scale(s, s);
  if (camo > 0.5) {
    // 모래 속: 눈과 날개 끝만
    ctx.globalAlpha = 0.25 + (p.peek || 0) * 0.5;
  }
  if (wind > 0.2) glowAt(ctx, 0, 0, 120, "#fff36a", wind * 0.5);
  // 꼬리 (채찍 + 번개 끝)
  ctx.beginPath();
  ctx.moveTo(-40, 0);
  ctx.quadraticCurveTo(-90, Math.sin(t * 3) * 14, -130, Math.sin(t * 3 + 1) * 20);
  stroke(ctx, SR.dark, 4);
  ctx.beginPath();
  const tx = -130;
  const ty = Math.sin(t * 3 + 1) * 20;
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 10, ty - 8);
  ctx.lineTo(tx - 6, ty);
  ctx.lineTo(tx - 16, ty + 6);
  stroke(ctx, SR.bolt, 3);
  // 날개 (위아래로 펄럭: 옆모습이라 위 날개 · 아래 날개)
  for (const sd of [-1, 1]) {
    ctx.save();
    ctx.scale(1, sd);
    ctx.beginPath();
    ctx.moveTo(-40, -4);
    ctx.quadraticCurveTo(-10, -40 - flap * 24, 30, -70 - flap * 30);
    ctx.quadraticCurveTo(46, -30, 50, -4);
    ctx.closePath();
    fill(ctx, sd < 0 ? SR.body : darken(SR.body, 0.2), 10, -36, 40, 30, 3);
    // 번개 무늬
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(6, -30 - flap * 10);
    ctx.lineTo(0, -30 - flap * 10);
    ctx.lineTo(18, -50 - flap * 18);
    stroke(ctx, alpha(SR.bolt, 0.9), 3);
    ctx.restore();
  }
  // 몸 (가운데)
  ell(ctx, 6, 0, 46, 18);
  fill(ctx, SR.body, 0, -6, 46, 18, 3);
  ell(ctx, 10, 6, 34, 8);
  ctx.fillStyle = alpha(SR.belly, 0.8);
  ctx.fill();
  // 눈 (위쪽 둘이 겹쳐 보임)
  mEye(ctx, 34, -8, 6.5, p, { open: camo > 0.5 ? (p.peek || 0) : 1, angry: true, color: "#ffe14a", slit: true });
  ctx.beginPath();
  ctx.moveTo(42, 6);
  ctx.quadraticCurveTo(48, 8, 52, 4);
  stroke(ctx, INK, 2);
  if (p.hit) {
    ell(ctx, 6, 0, 46, 18);
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
}

/* ================================================================
 * 34 심연등불 — 떠 있는 등불 모양 신비한 괴물 · 길 잃은 탐험가를 깊은 곳으로
 * ============================================================== */
function drawAbyssLantern(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const camo = p.camo || 0;
  const wind = p.wind || 0;
  const fake = p.fake ? 1 : 0;
  ctx.save();
  ctx.scale(s, s);
  const pul = 0.85 + Math.sin(t * 3) * 0.15;
  glowAt(ctx, 0, 0, 120 * pul, fake ? "#9fd8ff" : "#ffd88a", 0.9);
  if (camo > 0.5) {
    // 그냥 떠 있는 빛
    circ(ctx, 0, 0, 12 * pul);
    ctx.fillStyle = "#fffbe0";
    ctx.fill();
    if ((p.peek || 0) > 0.3) {
      // 빛 속에 눈 하나가 깜빡
      mEye(ctx, 0, 0, 6, p, { open: 1, color: "#6a3a0a", slit: true });
    }
    ctx.restore();
    return;
  }
  // 덩굴 같은 촉수 (아래로)
  for (let i = 0; i < 5; i++) {
    const x0 = -16 + i * 8;
    ctx.beginPath();
    ctx.moveTo(x0, 24);
    for (let k = 1; k <= 6; k++) {
      const v = k / 6;
      ctx.lineTo(x0 + Math.sin(t * 2 + i + v * 4) * 8 * v, 24 + v * (44 + i % 2 * 10));
    }
    ctx.lineCap = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = alpha("#6a4a8a", 0.9);
    ctx.stroke();
    circ(ctx, x0 + Math.sin(t * 2 + i + 4) * 8, 24 + 44 + (i % 2) * 10, 3);
    ctx.fillStyle = "#ffd88a";
    ctx.fill();
  }
  // 등불 갓 (위)
  ctx.beginPath();
  ctx.moveTo(-30, -18);
  ctx.quadraticCurveTo(0, -48, 30, -18);
  ctx.closePath();
  fill(ctx, "#4a2a6a", 0, -30, 26, 14, 3);
  // 고리 (위에 매달린)
  ctx.beginPath();
  ctx.arc(0, -46, 7, 0, TAU);
  stroke(ctx, "#c8a84a", 3);
  // 유리 몸 (빛나는 등)
  ell(ctx, 0, 2, 26, 24);
  ctx.fillStyle = linear(ctx, `alg${fake}`, 0, -22, 0, 26, [
    [0, fake ? "#e8f8ff" : "#fff6d0"],
    [1, fake ? "#7ab8e8" : "#ffb03a"],
  ]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#4a2a6a";
  ctx.stroke();
  // 틀 (세로살)
  for (const x of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(x, -20);
    ctx.quadraticCurveTo(x * 1.3, 2, x, 24);
    stroke(ctx, alpha("#4a2a6a", 0.8), 2.4);
  }
  // 아래 받침
  ctx.beginPath();
  ctx.moveTo(-22, 20);
  ctx.quadraticCurveTo(0, 34, 22, 20);
  ctx.closePath();
  fill(ctx, "#4a2a6a", 0, 24, 20, 8, 2.4);
  // 큰 눈 하나 (등 속)
  mEye(ctx, 0, 2, 11, p, { open: 1, angry: wind > 0.2, color: fake ? "#2a5a9a" : "#a0400a", slit: true });
  if (wind > 0.2) glowAt(ctx, 0, 2, 70, "#ffe08a", wind);
  if (p.hit) {
    ell(ctx, 0, 2, 26, 24);
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
}

ART.eggling = (ctx, p) => drawEggling(ctx, p);
ART.whirlFish = drawWhirlFish;
ART.stormRay = (ctx, p) => {
  if (p.card) {
    ctx.save();
    ctx.translate(16, 0);
    ctx.scale(0.75, 0.75);
    drawStormRay(ctx, p);
    ctx.restore();
    return;
  }
  drawStormRay(ctx, p);
};
ART.abyssLantern = drawAbyssLantern;

/* ================================================================
 * 장식: 알 무더기 · 둥지 (원점 = 바닥 가운데)
 * ============================================================== */
export function eggNest(c, rnd, n = 5) {
  // 둥지 (엮인 해초 · 뼈)
  c.beginPath();
  c.ellipse(0, -6, 90, 26, 0, 0, Math.PI);
  c.fillStyle = "#5a3a4a";
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = "#2a1a24";
  c.stroke();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI;
    c.beginPath();
    c.moveTo(Math.cos(a) * 86, -6 + Math.sin(a) * 22);
    c.quadraticCurveTo(Math.cos(a + 0.3) * 60, -18, Math.cos(a + 0.5) * 92, -10 + Math.sin(a + 0.4) * 10);
    c.lineWidth = 3;
    c.strokeStyle = ["#7a5a4a", "#6a8a5a", "#8a6a5a"][i % 3];
    c.stroke();
  }
  // 알 (뒤쪽 줄)
  for (let i = 0; i < n; i++) {
    c.save();
    c.translate(-60 + i * (120 / (n - 1)) + (rnd() - 0.5) * 8, -24 - rnd() * 10);
    c.rotate((rnd() - 0.5) * 0.4);
    egg(c, 20 + rnd() * 6, rnd() < 0.3 ? 0.6 : 0, ["#f4e8ff", "#e8f8e0", "#fff0e0"][i % 3], ["#c88aff", "#7ad8a8", "#ffb08a"][i % 3]);
    c.restore();
  }
  // 앞 테두리
  c.beginPath();
  c.ellipse(0, -4, 92, 14, 0, 0, Math.PI);
  c.lineWidth = 8;
  c.strokeStyle = "#6a4a40";
  c.stroke();
}
