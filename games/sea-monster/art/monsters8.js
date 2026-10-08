/*
 * 바다괴물 탐험대 — 8지역 괴물 (심해 협곡) + 장식
 *  심해아귀 · 펠리컨장어 · 대왕갯강구 / 고래 뼈 · 가짜 빛 (유인등)
 */
import { INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss, limb, blush } from "../../ocean-blaster/art/kit.js?v=3";
import { ART } from "./registry.js?v=1";
import { mEye } from "./monsters1.js?v=1";

const TAU = Math.PI * 2;
export function glowBall(ctx, x, y, r, color, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, 0.85 * a));
  g.addColorStop(0.35, alpha(color, 0.35 * a));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  circ(ctx, x, y, r * 0.16);
  ctx.fillStyle = "#fffbe0";
  ctx.fill();
}
/** 유인등 끝 (아귀 · 가짜 빛 공통) */
export function lureBulb(ctx, x, y, t, color = "#bfffe0", a = 1) {
  const pul = 0.8 + Math.sin(t * 4) * 0.2;
  glowBall(ctx, x, y, 46 * pul, color, a);
  circ(ctx, x, y, 7);
  ctx.fillStyle = alpha("#ffffff", a);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha(color, a);
  ctx.stroke();
}

/* ================================================================
 * 25 심해아귀 — 어둠에 녹는 검보라 몸 · 바늘 이빨 · 유인등
 * ============================================================== */
const AG = { body: "#3a2a4a", dark: "#1a1226", belly: "#5a4a6a", teeth: "#f4f0e8", fin: "#4a3a5e" };
function drawAngler(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const camo = p.camo || 0;
  const wind = p.wind || 0;
  const bite = p.bite || 0;
  const mouth = Math.max(wind * 0.9, bite, p.roar || 0, 0.12);
  ctx.save();
  ctx.scale(s, s);
  // 숨은 동안: 몸은 어둠 속에 거의 안 보인다 (유인등만 또렷)
  const bodyA = camo > 0.5 ? 0.12 + (p.peek || 0) * 0.45 : 1;
  // 유인등 줄기
  const lx = 48 + Math.sin(t * 1.6) * 8 + (p.lureDx || 0);
  const ly = -70 + Math.cos(t * 2.1) * 6;
  ctx.save();
  ctx.globalAlpha = Math.max(bodyA, 0.5);
  ctx.beginPath();
  ctx.moveTo(10, -36);
  ctx.quadraticCurveTo(28, -80, lx, ly);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#5a4a6e";
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = bodyA;
  // 꼬리 · 지느러미
  ctx.beginPath();
  ctx.moveTo(-40, -4);
  ctx.lineTo(-74, -26 + Math.sin(t * 5) * 4);
  ctx.lineTo(-66, 2);
  ctx.lineTo(-74, 28 + Math.sin(t * 5) * 4);
  ctx.lineTo(-40, 8);
  ctx.closePath();
  flat(ctx, AG.fin, 2.4, AG.dark);
  ctx.beginPath();
  ctx.moveTo(-14, -36);
  ctx.quadraticCurveTo(-30, -56, -40, -30);
  ctx.closePath();
  flat(ctx, AG.fin, 2, AG.dark);
  // 아래턱 (벌어진다)
  ctx.save();
  ctx.translate(-4, 12);
  ctx.rotate(mouth * 0.5);
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.quadraticCurveTo(30, 30, 62, 6);
  ctx.quadraticCurveTo(40, 4, -6, -6);
  ctx.closePath();
  fill(ctx, AG.belly, 26, 10, 34, 14, 2.6);
  ctx.fillStyle = AG.teeth;
  for (let i = 0; i < 6; i++) {
    const x = 8 + i * 9;
    const y = 8 - i * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2.5, y - 12 - (i % 2) * 4);
    ctx.lineTo(x + 5, y);
    ctx.fill();
  }
  ctx.restore();
  // 입 안
  if (mouth > 0.15) {
    ctx.beginPath();
    ctx.moveTo(-4, 8);
    ctx.quadraticCurveTo(30, 14 + mouth * 30, 60, 12 + mouth * 22);
    ctx.lineTo(60, 4);
    ctx.quadraticCurveTo(30, 6, -4, 2);
    ctx.closePath();
    ctx.fillStyle = "#12060e";
    ctx.fill();
  }
  // 몸 (둥근 머리 큰 몸)
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-44, 4);
    ctx.bezierCurveTo(-44, -44, 30, -50, 58, -8);
    ctx.quadraticCurveTo(64, 6, 56, 10);
    ctx.quadraticCurveTo(10, 16, -6, 14);
    ctx.quadraticCurveTo(-36, 24, -44, 4);
    ctx.closePath();
  };
  body();
  fill(ctx, AG.body, 0, -18, 46, 30, 3);
  // 위 이빨
  ctx.fillStyle = AG.teeth;
  for (let i = 0; i < 6; i++) {
    const x = 6 + i * 9;
    ctx.beginPath();
    ctx.moveTo(x, 8 - i * 0.3);
    ctx.lineTo(x + 2.5, 22 + (i % 2) * 5);
    ctx.lineTo(x + 5, 8 - i * 0.3);
    ctx.fill();
  }
  // 점무늬 (희미한 빛점)
  for (const [x, y] of [
    [-20, -14],
    [0, -26],
    [-30, 0],
    [16, -30],
  ]) {
    circ(ctx, x, y, 2.4);
    ctx.fillStyle = alpha("#9fe8ff", 0.6);
    ctx.fill();
  }
  // 눈 (작고 동그랗게)
  mEye(ctx, 26, -16, 7, p, { open: camo > 0.5 ? (p.peek || 0) : 1, angry: wind > 0.2, color: "#8af0d0", white: "#e8fff6" });
  if (p.hit) {
    body();
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
  // 유인등 (늘 또렷 · 공격 준비 땐 붉게)
  lureBulb(ctx, lx, ly, t, wind > 0.3 ? "#ffb08a" : "#bfffe0");
  ctx.restore();
}

/* ================================================================
 * 26 펠리컨장어 — 몸보다 큰 주머니 입 · 가는 채찍 꼬리 끝 분홍 빛
 * ============================================================== */
const GU = { body: "#2a2236", pouch: "#4a3a5a", inner: "#16081a", tip: "#ff8ad8" };
function drawGulper(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const camo = p.camo || 0;
  const open = Math.max(p.open || 0, (p.wind || 0) * 0.5);
  const gulp = p.gulp || 0;
  ctx.save();
  ctx.scale(s, s);
  const bodyA = camo > 0.5 ? 0.15 + (p.peek || 0) * 0.5 : 1;
  // 채찍 꼬리 (왼쪽으로 길게) + 끝 빛
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    pts.push([-20 - u * 170, Math.sin(u * 6 - t * 4) * 16 * u]);
  }
  ctx.save();
  ctx.globalAlpha = bodyA;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineCap = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#140c1a";
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.strokeStyle = GU.body;
  ctx.stroke();
  ctx.restore();
  const [tx, ty] = pts[10];
  glowBall(ctx, tx, ty, 34, GU.tip, 0.9);
  ctx.save();
  ctx.globalAlpha = bodyA;
  // 아래 주머니 (벌어지면 크게)
  ctx.beginPath();
  ctx.moveTo(-14, 4);
  ctx.quadraticCurveTo(30, 30 + open * 70 + gulp * 20, 96 + open * 10, 10 + open * 56);
  ctx.quadraticCurveTo(70, 8, 10, -2);
  ctx.closePath();
  fill(ctx, GU.pouch, 40, 30, 50, 40, 3);
  if (open > 0.1) {
    // 입 안 (깜깜)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(40, 14 + open * 50, 94, 8 + open * 50);
    ctx.lineTo(96, -2 - open * 20);
    ctx.quadraticCurveTo(50, -6 - open * 8, 0, -4);
    ctx.closePath();
    ctx.fillStyle = GU.inner;
    ctx.fill();
    // 빨려 들어가는 물결
    ctx.strokeStyle = alpha("#9fe8ff", 0.5 * open);
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const k = (t * 2 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(96 - k * 60, 4 + open * 14, 10 + (1 - k) * 22 * open, -1, 1);
      ctx.stroke();
    }
  }
  // 위턱 (가늘고 길다)
  ctx.save();
  ctx.translate(0, -2);
  ctx.rotate(-open * 0.32);
  ctx.beginPath();
  ctx.moveTo(-10, -12);
  ctx.quadraticCurveTo(50, -18, 100, -4);
  ctx.quadraticCurveTo(60, 2, -6, 4);
  ctx.closePath();
  fill(ctx, GU.body, 40, -8, 50, 10, 2.8);
  ctx.restore();
  // 머리 (작다) + 눈
  ell(ctx, -16, -4, 22, 16);
  fill(ctx, GU.body, -18, -8, 22, 16, 2.8);
  mEye(ctx, -6, -10, 5.5, p, { open: camo > 0.5 ? (p.peek || 0) : 1, angry: (p.wind || 0) > 0.2, color: "#ff8ad8", white: "#f0e8ff" });
  if (p.hit) {
    ell(ctx, 30, 6, 60, 26);
    ctx.fillStyle = `rgba(255,255,255,${0.5 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

/* ================================================================
 * 27 대왕갯강구 — 마디 갑옷 · 큰 겹눈 · 몸을 말면 공 (curl 0~1) · 데굴데굴 (rot)
 * ============================================================== */
const IP = { shell: "#b8b0c8", dark: "#6a6280", leg: "#8a7ea0", eye: "#3a3a5a" };
function drawIsopod(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const curl = Math.max(p.curl || 0, (p.camo || 0) * 0.15);
  const walk = p.walk || 0;
  ctx.save();
  ctx.scale(s, s);
  if (curl > 0.6) {
    // 공 (굴러간다)
    ctx.rotate(p.rot || 0);
    ell(ctx, 0, 0, 34, 34);
    fill(ctx, IP.shell, -6, -8, 34, 34, 3.2);
    ctx.save();
    ell(ctx, 0, 0, 34, 34);
    ctx.clip();
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 11, 0, 6, 36, 0, -Math.PI / 2, Math.PI / 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = IP.dark;
      ctx.stroke();
    }
    ctx.restore();
    gloss(ctx, -12, -16, 12, 6, 0.6, -0.4);
    if (p.hit) {
      ell(ctx, 0, 0, 34, 34);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  const sq = curl / 0.6; // 말기 시작
  // 다리 (아래 촘촘히)
  for (let i = 0; i < 7; i++) {
    const x = -34 + i * 11;
    const ph = t * 14 * walk + i * 0.9;
    const lift = Math.max(0, Math.sin(ph)) * 4 * walk;
    limb(ctx, [x, 10, x + 4, 18 - lift, x + 8 + Math.cos(ph) * 3 * walk, 24 - lift], 4, IP.leg, { line: lineOf(IP.leg) });
  }
  // 더듬이
  for (const [a, L] of [
    [-0.5, 34],
    [-0.2, 28],
  ]) {
    const sw = Math.sin(t * 3 + L) * 0.12;
    ctx.beginPath();
    ctx.moveTo(40, -2);
    ctx.quadraticCurveTo(40 + Math.cos(a + sw) * L * 0.6, -2 + Math.sin(a + sw) * L * 0.8, 40 + Math.cos(a + sw) * L, -2 + Math.sin(a + sw) * L);
    stroke(ctx, IP.leg, 3);
  }
  // 몸 (마디 돔)
  ctx.save();
  ctx.scale(1 - sq * 0.25, 1 + sq * 0.2);
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-46, 12);
    ctx.bezierCurveTo(-48, -30, 40, -34, 46, 10);
    ctx.quadraticCurveTo(0, 18, -46, 12);
    ctx.closePath();
  };
  body();
  fill(ctx, IP.shell, -4, -10, 46, 24, 3);
  ctx.save();
  body();
  ctx.clip();
  for (let i = -3; i <= 3; i++) {
    const x = i * 12;
    ctx.beginPath();
    ctx.moveTo(x - 4, 16);
    ctx.quadraticCurveTo(x + 2, -10, x - 4, -32);
    ctx.lineWidth = 3;
    ctx.strokeStyle = IP.dark;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 1, 12);
    ctx.quadraticCurveTo(x + 5, -10, x - 1, -28);
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha("#ffffff", 0.35);
    ctx.stroke();
  }
  ctx.restore();
  // 꼬리 판
  ctx.beginPath();
  ctx.moveTo(-44, 6);
  ctx.lineTo(-56, 2);
  ctx.lineTo(-48, 14);
  ctx.closePath();
  flat(ctx, IP.dark, 2, "#3a3448");
  ctx.restore();
  // 겹눈 (크게 · 반짝이 여러 개)
  const open = Math.max(1 - (p.camo || 0), p.peek || 0);
  ell(ctx, 32, -6, 9, 10);
  ctx.fillStyle = IP.eye;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (open > 0.3) {
    for (const [x, y] of [
      [29, -10],
      [34, -7],
      [30, -3],
    ]) {
      circ(ctx, x, y, 1.8);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(25, -6);
    ctx.lineTo(39, -6);
    stroke(ctx, "#1a1a2a", 2);
  }
  if ((p.wind || 0) > 0.2) {
    ctx.beginPath();
    ctx.moveTo(24, -18);
    ctx.lineTo(40, -14);
    stroke(ctx, INK, 2.6);
  }
  if (p.hit) {
    body();
    ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
    ctx.fill();
  }
  ctx.restore();
}

ART.angler = (ctx, p) => drawAngler(ctx, p.card ? { ...p, camo: 0 } : p);
ART.gulper = (ctx, p) => {
  if (p.card) {
    ctx.save();
    ctx.translate(30, -4);
    ctx.scale(0.8, 0.8);
    drawGulper(ctx, { ...p, open: 0.5, camo: 0 });
    ctx.restore();
    return;
  }
  drawGulper(ctx, p);
};
ART.isopod = drawIsopod;

/* ================================================================
 * 장식: 고래 뼈 (바닥에 누운 갈비뼈 · 등뼈) — 원점 = 바닥 가운데
 * ============================================================== */
export function whaleBones(c, w, rnd) {
  const bone = "#e8e0cc";
  const line = "#8a7e64";
  // 등뼈
  c.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const x = -w / 2 + (i / 11) * w;
    const y = -8 - Math.sin((i / 11) * Math.PI) * 18;
    c.beginPath();
    c.ellipse(x, y, 9, 7, 0, 0, TAU);
    c.fillStyle = bone;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = line;
    c.stroke();
  }
  // 갈비뼈
  for (let i = 1; i < 10; i++) {
    const x = -w / 2 + (i / 10) * w;
    const h = 40 + Math.sin((i / 10) * Math.PI) * 50 + rnd() * 10;
    c.beginPath();
    c.moveTo(x, -10 - Math.sin((i / 10) * Math.PI) * 16);
    c.quadraticCurveTo(x + 26, -h * 0.9, x + 12 + rnd() * 6, -h);
    c.lineWidth = 9;
    c.strokeStyle = line;
    c.stroke();
    c.lineWidth = 6;
    c.strokeStyle = bone;
    c.stroke();
  }
  // 머리뼈 (한쪽 끝)
  c.beginPath();
  c.moveTo(w / 2 + 6, -4);
  c.quadraticCurveTo(w / 2 + 50, -30, w / 2 + 96, -8);
  c.quadraticCurveTo(w / 2 + 60, 2, w / 2 + 6, 4);
  c.closePath();
  c.fillStyle = bone;
  c.fill();
  c.lineWidth = 2.6;
  c.strokeStyle = line;
  c.stroke();
  c.beginPath();
  c.arc(w / 2 + 30, -12, 6, 0, TAU);
  c.fillStyle = "#2a2430";
  c.fill();
}
