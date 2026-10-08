/*
 * 바다괴물 탐험대 — 6지역 괴물 (화산 해저) + 장식
 *  용암게 · 열수구벌레 · 마그마거북 / 열수 굴뚝 · 용암 바위
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
  g.addColorStop(0, alpha(color, 0.7 * a));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
/** 용암 금 (빛나는 갈라진 선) */
function cracks(ctx, lines, heat, w = 2.6) {
  if (heat <= 0.02) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [wd, col, a] of [
    [w * 2.6, "#ff5a1a", 0.35],
    [w, mix("#ff8a2a", "#fff0a0", q8(heat)), 1],
  ]) {
    ctx.beginPath();
    for (const ln of lines) {
      ctx.moveTo(ln[0], ln[1]);
      for (let i = 2; i < ln.length; i += 2) ctx.lineTo(ln[i], ln[i + 1]);
    }
    ctx.lineWidth = wd;
    ctx.strokeStyle = alpha(col, a * Math.min(1, heat * 1.3));
    ctx.stroke();
  }
}

/* ================================================================
 * 19 용암게 — 현무암 등딱지에 용암 금 · 커다란 집게 하나 · 뜨거울수록 빛난다
 * ============================================================== */
const LC = { shell: "#4a3f4a", leg: "#6a4a52", claw: "#7a4a4e", belly: "#c88a6a" };
/** 집게 (손바닥 + 고정 손가락 + 움직이는 손가락) */
function claw(ctx, x, y, sz, open, color, heat) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sz, sz);
  // 아래 손가락 (고정)
  ctx.beginPath();
  ctx.moveTo(6, 2);
  ctx.quadraticCurveTo(26, 4, 34, 12);
  ctx.quadraticCurveTo(22, 14, 6, 12);
  ctx.closePath();
  fill(ctx, darken(color, 0.1), 18, 8, 16, 7, 2.6);
  // 위 손가락 (벌어짐)
  ctx.save();
  ctx.translate(8, -2);
  ctx.rotate(-open * 0.7);
  ctx.beginPath();
  ctx.moveTo(-2, -6);
  ctx.quadraticCurveTo(22, -12, 30, 2);
  ctx.quadraticCurveTo(16, 2, -2, 4);
  ctx.closePath();
  fill(ctx, color, 12, -4, 16, 8, 2.6);
  ctx.restore();
  // 손바닥
  ell(ctx, -4, 2, 17, 13);
  fill(ctx, color, -6, -2, 17, 13, 2.8);
  // 오돌토돌
  for (const [px, py] of [
    [-10, -4],
    [-2, -8],
    [4, 2],
  ]) {
    circ(ctx, px, py, 2.2);
    ctx.fillStyle = alpha("#ffffff", 0.18);
    ctx.fill();
  }
  if (heat > 0.3) cracks(ctx, [[-14, 4, -6, -2, 4, 0]], heat, 2);
  ctx.restore();
}
function drawLavaCrab(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const heat = p.heat == null ? 0.6 : p.heat;
  const camo = p.camo || 0;
  const peek = Math.max(1 - camo, p.peek || 0);
  const wind = p.wind || 0;
  const walk = p.walk || 0;
  ctx.save();
  ctx.scale(s, s);
  if (heat > 0.3) glowAt(ctx, 0, -6, 76, "#ff6a2a", heat * 0.6);
  // 다리 (숨으면 접힌다)
  const legOut = 1 - camo * 0.85;
  for (let i = 0; i < 4; i++) {
    for (const sd of [-1, 1]) {
      if (sd > 0 && i > 1) continue;
      const ph = t * 12 * walk + i * 1.6 + (sd > 0 ? 0 : Math.PI);
      const lift = Math.max(0, Math.sin(ph)) * 7 * walk;
      const bx = -30 + i * 14 + (sd > 0 ? 10 : 0);
      const dir = sd < 0 ? -1 : 1;
      limb(ctx, [bx, 8, bx + dir * 14 * legOut, -2 - lift, bx + dir * 22 * legOut, 24 - lift], 6.5, LC.leg, { line: lineOf(LC.leg) });
    }
  }
  // 작은 집게 (뒤쪽)
  claw(ctx, 30 + legOut * 10, 14, 0.62, 0.15 + Math.sin(t * 2) * 0.1 * (1 - camo), darken(LC.claw, 0.12), heat);
  // 등딱지 (넓적한 현무암)
  const shell = () => {
    ctx.beginPath();
    ctx.moveTo(-50, 10);
    ctx.quadraticCurveTo(-58, -12, -40, -24);
    ctx.quadraticCurveTo(-20, -36, 0, -32);
    ctx.quadraticCurveTo(22, -38, 40, -24);
    ctx.quadraticCurveTo(58, -12, 50, 10);
    ctx.quadraticCurveTo(24, 20, 0, 18);
    ctx.quadraticCurveTo(-26, 20, -50, 10);
    ctx.closePath();
  };
  shell();
  ctx.fillStyle = linear(ctx, `lcs${q8(heat)}`, 0, -36, 0, 20, [
    [0, mix("#6a5a66", "#8a4a3a", q8(heat) * 0.5)],
    [1, mix("#2e262e", "#4a201a", q8(heat) * 0.5)],
  ]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#1a1418";
  ctx.stroke();
  // 가장자리 가시 (게 등딱지 테)
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = sd * (44 - i * 6);
      const y = -14 - i * 7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sd * 9, y - 3);
      ctx.lineTo(x - sd * 1, y - 6);
      ctx.closePath();
      flat(ctx, "#3a3036", 2, "#1a1418");
    }
  }
  for (const [x, y, r] of [
    [-24, -18, 6],
    [6, -24, 7],
    [28, -12, 5],
    [-6, -4, 4],
  ]) {
    circ(ctx, x, y, r);
    ctx.fillStyle = alpha("#000000", 0.25);
    ctx.fill();
    circ(ctx, x - 1, y - 1.5, r * 0.6);
    ctx.fillStyle = alpha("#ffffff", 0.08);
    ctx.fill();
  }
  ctx.save();
  shell();
  ctx.clip();
  cracks(ctx, [
    [-44, -2, -28, -10, -18, -2, -6, -16],
    [-6, -16, 8, -10, 18, -22, 36, -16],
    [8, -10, 12, 6],
    [-28, -10, -32, -24],
  ], heat);
  ctx.restore();
  gloss(ctx, -20, -24, 16, 5, 0.25, -0.2);
  // 눈자루 (쏙)
  const ey = -28 - peek * 20;
  for (const ex of [12, 28]) {
    limb(ctx, [ex, -26, ex + 1, ey + 7], 5.5, LC.leg, { line: lineOf(LC.leg) });
    if (peek > 0.15) mEye(ctx, ex + 1, ey, 8, p, { open: Math.min(1, peek * 1.3), angry: wind > 0.2, color: "#3a1a0a" });
    else {
      circ(ctx, ex + 1, ey + 4, 3);
      ctx.fillStyle = "#1a1418";
      ctx.fill();
    }
  }
  // 입
  if (peek > 0.5) {
    ctx.beginPath();
    ctx.moveTo(32, 2);
    ctx.quadraticCurveTo(38, 7, 44, 3);
    stroke(ctx, INK, 2);
  }
  // 큰 집게 (앞) — 준비하면 번쩍 들고 쩍 벌린다
  const op = 0.12 + wind * 0.75 + (p.snap || 0) * 0.3 + Math.sin(t * 2.5) * 0.06 * (1 - camo);
  claw(ctx, 46 + legOut * 16, -4 - wind * 16, 1, op, LC.claw, heat);
  if (p.hit) {
    ctx.save();
    shell();
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
    ctx.restore();
  }
  // 식었을 때: 파랗게 식은 등딱지
  if (heat < 0.25 && camo < 0.5) {
    ctx.save();
    shell();
    ctx.fillStyle = alpha("#8fd8ff", 0.2 * (1 - heat * 4));
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* ================================================================
 * 20 열수구벌레 — 하얀 관에서 빨간 깃털 왕관이 쑥 · 원점 = 굴뚝 입구
 * ============================================================== */
const VW = { tube: "#efe6d6", plume: "#ff3b4a", plume2: "#ff8a6a", face: "#ffd0c0" };
function drawVentWorm(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const out = p.out == null ? 1 : p.out;
  const wind = p.wind || 0;
  ctx.save();
  ctx.scale(s, s);
  const hgt = 16 + out * 100;
  const sway = Math.sin(t * 1.8) * 8 * out;
  // 관 (몸)
  ctx.beginPath();
  ctx.moveTo(-13, 20);
  ctx.quadraticCurveTo(-14 + sway * 0.4, -hgt * 0.5, -12 + sway, -hgt);
  ctx.lineTo(12 + sway, -hgt);
  ctx.quadraticCurveTo(14 + sway * 0.4, -hgt * 0.5, 13, 20);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, "vwt", -14, 0, 14, 0, [
    [0, "#c8bca8"],
    [0.4, VW.tube],
    [1, "#b0a490"],
  ]);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = "#6a5a48";
  ctx.stroke();
  // 마디 줄
  ctx.strokeStyle = alpha("#6a5a48", 0.5);
  ctx.lineWidth = 1.6;
  for (let i = 1; i < 6; i++) {
    const y = 16 - (i / 6) * (hgt + 16);
    if (y < -hgt + 6) break;
    const k = (16 - y) / (hgt + 16);
    ctx.beginPath();
    ctx.moveTo(-13 + sway * k * 0.6, y);
    ctx.quadraticCurveTo(sway * k * 0.6, y + 4, 13 + sway * k * 0.6, y);
    ctx.stroke();
  }
  // 얼굴 (관 꼭대기)
  const fx = sway;
  const fy = -hgt + 12;
  if (out > 0.25) {
    mEye(ctx, fx - 5, fy, 5, p, { open: Math.min(1, out * 1.5), angry: wind > 0.2, color: "#5a0a1a" });
    mEye(ctx, fx + 6, fy, 5, p, { open: Math.min(1, out * 1.5), angry: wind > 0.2, color: "#5a0a1a" });
    if (wind > 0.2 || p.bite) {
      ell(ctx, fx + 1, fy + 10, 5, 3 + wind * 4);
      ctx.fillStyle = "#5a0a1a";
      ctx.fill();
      if (wind > 0.3) glowAt(ctx, fx + 1, fy + 10, 26, "#ffb03a", wind);
    } else {
      ctx.beginPath();
      ctx.moveTo(fx - 3, fy + 9);
      ctx.quadraticCurveTo(fx + 1, fy + 12, fx + 5, fy + 9);
      stroke(ctx, INK, 1.8);
    }
  }
  // 깃털 왕관 (빨간 아가미 깃) — 활짝/움츠림
  const fan = 0.3 + out * 0.7 + wind * 0.25;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    const a = -Math.PI / 2 + u * 2.2 * fan + Math.sin(t * 3 + i) * 0.06;
    const L = (26 + Math.cos(u * 3) * 10) * (0.4 + out * 0.6) * (1 + wind * 0.2);
    const bx = fx;
    const by = -hgt - 2;
    const ex = bx + Math.cos(a) * L;
    const ey = by + Math.sin(a) * L;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + Math.cos(a - 0.3) * L * 0.6, by + Math.sin(a - 0.3) * L * 0.6, ex, ey);
    ctx.lineCap = "round";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#8a0a1a";
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = i % 2 ? VW.plume : VW.plume2;
    ctx.stroke();
    // 깃 잔털
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = alpha("#ffd0c0", 0.7);
    for (let k = 1; k <= 3; k++) {
      const v = k / 4;
      const px = bx + (ex - bx) * v;
      const py = by + (ey - by) * v;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a + 1.2) * 5, py + Math.sin(a + 1.2) * 5);
      ctx.stroke();
    }
  }
  if (p.hit) {
    ctx.beginPath();
    ctx.ellipse(fx, -hgt, 30, 30, 0, 0, TAU);
    ctx.fillStyle = `rgba(255,255,255,${0.5 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
}

/* ================================================================
 * 21 마그마거북 — 바위 같은 등껍질(용암 이음새 · 김) · 머리만 약하다
 * ============================================================== */
const MT = { shell: "#4a4040", plate: "#5c5050", skin: "#7ab07a", skinD: "#4a8a5a", belly: "#e8d8a8" };
function drawMagmaTurtle(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const camo = p.camo || 0;
  const peek = Math.max(1 - camo, p.peek || 0);
  const wind = p.wind || 0;
  const walk = p.walk || 0;
  const heat = 0.55 + Math.sin(t * 2) * 0.15 + wind * 0.3;
  ctx.save();
  ctx.scale(s, s);
  glowAt(ctx, 0, -10, 90, "#ff6a2a", 0.35 + wind * 0.4);
  // 다리 (지느러미발)
  const legOut = 1 - camo;
  for (const [x, ph] of legOut > 0.15 ? [
    [-34, 0],
    [30, Math.PI],
  ] : []) {
    const sw = Math.sin(t * 7 * walk + ph) * 6 * walk;
    ell(ctx, x + sw, 22 + legOut * 6, 16 * (0.5 + legOut * 0.5), 9);
    fill(ctx, MT.skin, x, 26, 16, 9, 2.4);
  }
  // 머리 (앞으로 쑥 · 준비할 땐 뒤로 움츠렸다가 입에 불빛)
  const hx = 50 + peek * 22 - wind * 12;
  const hy = 2 + Math.sin(t * 2) * 1.5;
  if (peek > 0.05) {
    limb(ctx, [26, 4, 40, 4, hx - 8, hy], 18, MT.skin, { line: lineOf(MT.skin) });
    ell(ctx, hx, hy, 20, 16);
    fill(ctx, MT.skin, 62, -4, 20, 16, 2.8); // 그라디언트 캐시 키 고정
    // 부리
    ctx.beginPath();
    ctx.moveTo(hx + 12, hy - 4);
    ctx.quadraticCurveTo(hx + 26, hy, hx + 14, hy + 8);
    ctx.closePath();
    flat(ctx, "#d8a84a", 2, "#6a4a1a");
    mEye(ctx, hx + 3, hy - 5, 6.5, p, { open: Math.min(1, peek * 1.4), angry: wind > 0.2, color: "#5a2a0a" });
    if (wind > 0.2) {
      ell(ctx, hx + 15, hy + 6, 5, 3 + wind * 3);
      ctx.fillStyle = "#ffd06a";
      ctx.fill();
      glowAt(ctx, hx + 18, hy + 6, 34, "#ffb03a", wind);
    }
    // 머리 무늬
    circ(ctx, hx - 10, hy - 8, 3);
    ctx.fillStyle = MT.skinD;
    ctx.fill();
    circ(ctx, hx - 6, hy + 6, 2.4);
    ctx.fill();
  }
  // 꼬리
  if (legOut > 0.15) limb(ctx, [-56, 6, -56 - 10 * legOut, 8, -56 - 16 * legOut, 14], 8, MT.skin, { line: lineOf(MT.skin) });
  // 등껍질 (둥근 바위 + 육각 판 + 용암 이음새)
  const shell = () => {
    ctx.beginPath();
    ctx.moveTo(-62, 14);
    ctx.bezierCurveTo(-66, -40, 62, -44, 60, 14);
    ctx.quadraticCurveTo(0, 26, -62, 14);
    ctx.closePath();
  };
  shell();
  ctx.fillStyle = linear(ctx, "mts", 0, -40, 0, 20, [
    [0, "#6a5c5a"],
    [0.6, MT.shell],
    [1, "#2a2224"],
  ]);
  ctx.fill();
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = "#1a1416";
  ctx.stroke();
  ctx.save();
  shell();
  ctx.clip();
  const plates = [
    [-30, -14, 17],
    [0, -24, 18],
    [30, -12, 17],
    [-14, 6, 14],
    [16, 6, 14],
    [-48, 4, 12],
    [46, 4, 12],
  ];
  for (const [x, y, r] of plates) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.52;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
    }
    ctx.closePath();
    ctx.fillStyle = MT.plate;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#2a2224";
    ctx.stroke();
    ell(ctx, x - r * 0.25, y - r * 0.3, r * 0.45, r * 0.22);
    ctx.fillStyle = alpha("#ffffff", 0.1);
    ctx.fill();
  }
  cracks(ctx, [
    [-46, -6, -30, 2, -16, -8, 0, -4, 16, -8, 30, 2, 46, -6],
    [-16, -8, -14, -30],
    [16, -8, 14, -32],
    [0, -4, 0, 16],
  ], heat, 2.4);
  ctx.restore();
  // 김 구멍 (등 위)
  circ(ctx, 6, -36, 4);
  ctx.fillStyle = "#ff8a3a";
  ctx.fill();
  if (p.hit) {
    ctx.save();
    shell();
    ctx.fillStyle = `rgba(255,255,255,${0.35 * p.hit})`;
    ctx.fill();
    ctx.restore();
    if (p.headHit) {
      ell(ctx, hx, hy, 22, 18);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
      ctx.fill();
    }
  }
  ctx.restore();
}

ART.lavaCrab = drawLavaCrab;
ART.ventWorm = (ctx, p) => {
  // 도감 · 카드: 굴뚝 위로 쭉 나온 모습 (가운데 맞춤)
  if (p.card) {
    ctx.save();
    ctx.translate(0, 50);
    drawVentWorm(ctx, { ...p, out: 1 });
    ctx.restore();
    return;
  }
  drawVentWorm(ctx, p);
};
ART.magmaTurtle = drawMagmaTurtle;

/* ================================================================
 * 장식: 열수 굴뚝 (원점 = 바닥 가운데 · h 높이) · 용암 바위 무더기
 * ============================================================== */
export function chimney(c, h, rnd, hot = "#ff7a2a") {
  const w0 = 70;
  const w1 = 22;
  c.beginPath();
  c.moveTo(-w0, 0);
  for (let i = 1; i <= 8; i++) {
    const k = i / 8;
    const w = w0 + (w1 - w0) * k;
    c.lineTo(-w - (i % 2 ? 8 : 0) - rnd() * 6, -h * k);
  }
  for (let i = 8; i >= 1; i--) {
    const k = i / 8;
    const w = w0 + (w1 - w0) * k;
    c.lineTo(w + (i % 2 ? 0 : 8) + rnd() * 6, -h * k);
  }
  c.lineTo(w0, 0);
  c.closePath();
  const g = c.createLinearGradient(-w0, 0, w0, 0);
  g.addColorStop(0, "#2a2226");
  g.addColorStop(0.45, "#5a4a4a");
  g.addColorStop(1, "#221a1e");
  c.fillStyle = g;
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = "#140e10";
  c.stroke();
  // 층 줄무늬 · 광물
  c.save();
  c.clip();
  for (let i = 1; i < 8; i++) {
    const y = -h * (i / 8);
    c.beginPath();
    c.moveTo(-w0, y + 4);
    c.quadraticCurveTo(0, y - 6, w0, y + 4);
    c.strokeStyle = alpha("#000000", 0.25);
    c.lineWidth = 3;
    c.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const y = -rnd() * h;
    const x = (rnd() - 0.5) * (w0 + (w1 - w0) * (-y / h)) * 1.6;
    c.beginPath();
    c.arc(x, y, 1.5 + rnd() * 3, 0, TAU);
    c.fillStyle = ["#e8d06a", "#c8b8a8", "#ff9a5a"][i % 3];
    c.fill();
  }
  c.restore();
  // 입구 (뜨거운 빛)
  c.beginPath();
  c.ellipse(0, -h, w1 + 2, 7, 0, 0, TAU);
  c.fillStyle = "#140a08";
  c.fill();
  const lg = c.createRadialGradient(0, -h, 1, 0, -h, w1);
  lg.addColorStop(0, alpha(hot, 0.9));
  lg.addColorStop(1, alpha(hot, 0));
  c.fillStyle = lg;
  c.fill();
}

export function lavaRocks(c, s, rnd) {
  // 바닥 현무암 무더기 + 빛나는 금
  for (let i = 0; i < 4; i++) {
    const x = (-40 + i * 26 + rnd() * 10) * s;
    const r = (20 + rnd() * 12) * s;
    c.beginPath();
    c.moveTo(x - r, 0);
    c.quadraticCurveTo(x - r * 1.1, -r * 1.2, x, -r * 1.25);
    c.quadraticCurveTo(x + r * 1.1, -r * 1.1, x + r, 0);
    c.closePath();
    c.fillStyle = ["#3e3438", "#4a3e42", "#352c30", "#443a3e"][i];
    c.fill();
    c.lineWidth = 2.6;
    c.strokeStyle = "#140e10";
    c.stroke();
    c.beginPath();
    c.moveTo(x - r * 0.5, -r * 0.3);
    c.lineTo(x - r * 0.1, -r * 0.6);
    c.lineTo(x + r * 0.3, -r * 0.4);
    c.strokeStyle = alpha("#ff8a3a", 0.85);
    c.lineWidth = 2;
    c.stroke();
  }
}
