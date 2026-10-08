/*
 * 바다괴물 탐험대 — 5지역 괴물 (해파리 계곡) + 장식
 *  해파리괴물 · 전기뱀장어 · 쌍둥이해파리 / 떠다니는 해파리(장식 · 가짜) · 전기 말미잘(위험물)
 */
import { INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss, limb, blush } from "../../ocean-blaster/art/kit.js?v=3";
import { ART } from "./registry.js?v=1";
import { mEye } from "./monsters1.js?v=1";

const TAU = Math.PI * 2;
export const AMB = "#9ad8ff"; // 떠다니는 보통 해파리 빛깔
function glow(ctx, x, y, r, color, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, 0.75 * a));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** 해파리 몸 (공통) — 원점 = 갓 가운데. color · rim · 촉수 수 */
export function jellyBody(ctx, p, o) {
  const t = p.t || 0;
  const pulse = Math.min(1.6, Math.sin(t * (o.speed || 2.4)) * 0.5 + 0.5 + (p.pulse || 0) * 0.8);
  const w = (o.w || 34) * (1 + pulse * 0.08);
  const h = (o.h || 28) * (1 - pulse * 0.1);
  const col = o.color;
  // 촉수 (뒤)
  const n = o.n || 6;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const x0 = -w * 0.75 + u * w * 1.5;
    const len = (o.len || 60) * (0.75 + (i % 3) * 0.15) * (1 + (p.reach || 0) * 0.6);
    ctx.beginPath();
    ctx.moveTo(x0, 4);
    for (let k = 1; k <= 6; k++) {
      const v = k / 6;
      ctx.lineTo(x0 + Math.sin(t * 3 + i + v * 4) * 6 * v, 4 + v * len);
    }
    ctx.lineCap = "round";
    ctx.lineWidth = o.tw || 3;
    ctx.strokeStyle = alpha(o.tent || lighten(col, 0.3), 0.85);
    ctx.stroke();
  }
  // 갓
  const bell = () => {
    ctx.beginPath();
    ctx.moveTo(-w, 6);
    ctx.bezierCurveTo(-w * 1.05, -h * 1.2, w * 1.05, -h * 1.2, w, 6);
    for (let i = 0; i <= 6; i++) {
      const x = w - (i / 6) * w * 2;
      ctx.quadraticCurveTo(x + w / 6, 12, x, 6);
    }
    ctx.closePath();
  };
  bell();
  ctx.fillStyle = linear(ctx, `jb${col}`, 0, -h, 0, 10, [
    [0, alpha(lighten(col, 0.4), 0.92)],
    [1, alpha(col, 0.75)],
  ]);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = alpha(lighten(col, 0.6), 0.9);
  ctx.stroke();
  // 안쪽 무늬
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.3, w * 0.5, h * 0.45, 0, 0, TAU);
  ctx.strokeStyle = alpha("#ffffff", 0.35);
  ctx.lineWidth = 2;
  ctx.stroke();
  gloss(ctx, -w * 0.4, -h * 0.7, w * 0.35, h * 0.18, 0.7, -0.3);
  return bell;
}

/* ================================================================
 * 16 해파리괴물 — 빛나는 해파리 무리 속 진짜 괴물 (눈 · 이빨 · 붉은 기운)
 * ============================================================== */
function drawJellyMonster(ctx, p) {
  const s = p.s || 1;
  ctx.save();
  ctx.scale(s, s);
  const charge = p.wind || 0;
  // 숨은 동안엔 주변 해파리(하늘색)와 똑같다 · 들킬 땐 보랏빛이 번쩍
  const camo = Math.max(0, (p.camo || 0) - (p.flick || 0) * 0.8);
  const q = Math.round(camo * 8) / 8;
  const col = mix("#b58bff", AMB, q);
  glow(ctx, 0, -6, 80 + charge * 40, charge > 0.2 ? "#fff36a" : mix("#c58bff", AMB, q), 0.8);
  const bell = jellyBody(ctx, p, { color: col, tent: charge > 0.2 ? "#fff36a" : mix("#e0c8ff", "#d8f4ff", q), w: 36, h: 30, len: 70, n: 7, tw: 3.4, reach: charge });
  const open = Math.max(1 - (p.camo || 0), p.peek || 0);
  if (open > 0.05) {
    mEye(ctx, -11, -10, 6.5, p, { open, angry: charge > 0.2, color: "#5a2a8a" });
    mEye(ctx, 11, -10, 6.5, p, { open, angry: charge > 0.2, color: "#5a2a8a" });
  }
  if (open > 0.4) {
    ctx.beginPath();
    ctx.moveTo(-8, 4);
    ctx.quadraticCurveTo(0, 10, 8, 4);
    stroke(ctx, INK, 2);
    for (const x of [-4, 3]) {
      ctx.beginPath();
      ctx.moveTo(x, 5);
      ctx.lineTo(x + 1.5, 9);
      ctx.lineTo(x + 3, 5.6);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
  }
  if (charge > 0.2) {
    // 촉수 사이 찌릿
    ctx.strokeStyle = "#fffbe0";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const x = -20 + i * 20 + Math.sin((p.t || 0) * 40 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x + 6, 32);
      ctx.lineTo(x - 4, 40);
      ctx.lineTo(x + 4, 54);
      ctx.stroke();
    }
  }
  if (p.hit) {
    ctx.save();
    bell();
    ctx.fillStyle = `rgba(255,255,255,${0.7 * p.hit})`;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* ================================================================
 * 17 전기뱀장어 — 노란 번개 무늬 · 전기를 모으면 몸이 번쩍
 * ============================================================== */
const ZE = { body: "#2a5aa8", stripe: "#ffe14a", belly: "#bfe0ff" };
function drawZapEel(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const charge = p.wind || 0;
  const out = p.out == null ? 1 : p.out;
  ctx.save();
  ctx.scale(s, s);
  // 틈에 숨은 동안엔 어둠 속에 흐릿하게 (머리를 내밀 때만 또렷)
  if ((p.camo || 0) > 0.5) ctx.globalAlpha = 0.22 + (p.peek || 0) * 0.6;
  const n = 12;
  const len = 40 + out * 110;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([-len * 0.5 + u * len, Math.sin(u * 5 - t * 6) * 10 * (0.3 + out * 0.7) * (1 - charge * 0.6)]);
  }
  if (charge > 0.1) glow(ctx, 0, 0, 120 * charge + 40, "#fff36a", charge);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const line = (w, c) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = w;
    ctx.strokeStyle = c;
    ctx.stroke();
  };
  line(24, lineOf(ZE.body));
  line(19, charge > 0.5 && Math.floor(t * 20) % 2 ? "#fff6c0" : ZE.body);
  // 번개 무늬
  for (let i = 1; i < n; i += 2) {
    const [x, y] = pts[i];
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 6);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x - 2, y + 1);
    ctx.lineTo(x + 4, y + 7);
    stroke(ctx, ZE.stripe, 2.4);
  }
  // 머리
  const [hx, hy] = pts[n];
  ctx.save();
  ctx.translate(hx, hy);
  ctx.beginPath();
  ctx.ellipse(6, 0, 18, 13, 0, 0, TAU);
  fill(ctx, ZE.body, 2, -4, 18, 13, 2.6);
  ctx.beginPath();
  ctx.moveTo(10, 5);
  ctx.quadraticCurveTo(18, 9, 24, 3);
  stroke(ctx, INK, 2);
  mEye(ctx, 8, -4, 5.5, p, { angry: charge > 0.2, color: "#ffe14a", slit: true });
  ctx.restore();
  // 꼬리 지느러미
  const [tx, ty] = pts[0];
  ctx.beginPath();
  ctx.moveTo(tx, ty - 4);
  ctx.lineTo(tx - 16, ty - 12);
  ctx.lineTo(tx - 12, ty);
  ctx.lineTo(tx - 16, ty + 12);
  ctx.lineTo(tx, ty + 4);
  ctx.closePath();
  flat(ctx, ZE.stripe, 1.6, lineOf(ZE.stripe));
  if (charge > 0.3) {
    ctx.strokeStyle = "#fffbe0";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (t * 7 + i * 1.3) % TAU;
      const r0 = 20 + i * 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 0.6);
      ctx.lineTo(Math.cos(a + 0.2) * (r0 + 14), Math.sin(a + 0.4) * (r0 + 10) * 0.6);
      ctx.stroke();
    }
  }
  if (p.hit) {
    line(19, `rgba(255,255,255,${0.7 * p.hit})`);
  }
  ctx.restore();
}

/* ================================================================
 * 18 쌍둥이해파리 — 별 무늬 분홍 해파리. 분신은 조금 차가운 색 (warm=false)
 * ============================================================== */
function drawJellyTwins(ctx, p) {
  const s = p.s || 1;
  const warm = p.clone ? false : true;
  ctx.save();
  ctx.scale(s, s);
  const camo = Math.max(0, (p.camo || 0) - (p.flick || 0) * 0.7);
  const q = Math.round(camo * 8) / 8;
  const col = mix(warm ? "#ff8ac8" : "#c88aff", AMB, q);
  if (p.twin > 0.05) {
    // 겹쳐 보이는 또 하나 (몸짓)
    ctx.save();
    ctx.globalAlpha = 0.55 * p.twin;
    ctx.translate(p.twin * 46, -p.twin * 8);
    jellyBody(ctx, p, { color: col, w: 34, h: 30, len: 64, n: 6, speed: 2.8 });
    ctx.restore();
  }
  glow(ctx, 0, -6, 90, mix(warm ? "#ffb08a" : "#8a9aff", AMB, q), warm ? 0.85 : 0.6);
  const bell = jellyBody(ctx, p, { color: col, tent: mix(warm ? "#ffd0e8" : "#d8c8ff", "#d8f4ff", q), w: 34, h: 30, len: 64, n: 6, speed: 2.8, reach: p.wind || 0 });
  // 별 무늬 (숨은 동안엔 흐리게)
  ctx.fillStyle = alpha("#fffbe0", 1 - q * 0.85);
  for (const [x, y, r] of [
    [-14, -16, 4],
    [12, -20, 3],
    [2, -8, 2.6],
  ]) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = (i / 10) * TAU - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.fill();
  }
  const open = Math.max(1 - (p.camo || 0), p.peek || 0);
  if (open > 0.05) {
    mEye(ctx, -10, -6, 6, p, { open, angry: (p.wind || 0) > 0.2, color: warm ? "#b8306a" : "#6a4ab8" });
    mEye(ctx, 10, -6, 6, p, { open, angry: (p.wind || 0) > 0.2, color: warm ? "#b8306a" : "#6a4ab8" });
  }
  if (open > 0.4) {
    ctx.beginPath();
    ctx.moveTo(-5, 6);
    ctx.quadraticCurveTo(0, 11, 5, 6);
    stroke(ctx, INK, 2);
    blush(ctx, -18, 2, 4);
    blush(ctx, 18, 2, 4);
  }
  if (p.hit) {
    ctx.save();
    bell();
    ctx.fillStyle = `rgba(255,255,255,${0.7 * p.hit})`;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

ART.jellyMonster = drawJellyMonster;
ART.zapEel = drawZapEel;
ART.jellyTwins = drawJellyTwins;

/* ================================================================
 * 장식: 떠다니는 해파리 (괴물이 아닌 · 해파리괴물이 숨는 무리)
 * ============================================================== */
export function ambientJelly(ctx, p, color = AMB) {
  glow(ctx, 0, -6, 60, color, 0.55);
  jellyBody(ctx, p, { color, w: 26 * (p.size || 1), h: 22 * (p.size || 1), len: 48 * (p.size || 1), n: 5, tw: 2.4 });
}

/** 전기 말미잘 (위험물): charge 0~1 모으기 · zap 터짐 */
export function zapAnemone(ctx, t, charge, zap) {
  const base = "#8a5aff";
  const tip = charge > 0.6 ? "#fff36a" : "#d0b8ff";
  if (charge > 0.2 || zap) glow(ctx, 0, -30, 60 + charge * 50 + (zap ? 60 : 0), zap ? "#fff6c0" : "#b08aff", zap ? 1 : charge);
  rrect(ctx, -16, -18, 32, 20, 9);
  ctx.fillStyle = darken(base, 0.25);
  ctx.fill();
  for (let i = 0; i < 11; i++) {
    const u = i / 10;
    const a = -Math.PI / 2 + (u - 0.5) * 2;
    const sw = Math.sin(t * 2 + i) * 0.2 * (1 - charge);
    const len = 30 + Math.sin(i * 2.1) * 6 + charge * 8;
    const x2 = Math.cos(a + sw) * len;
    const y2 = -16 + Math.sin(a + sw) * len;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 10, -16);
    ctx.lineTo(x2, y2);
    ctx.lineCap = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = lineOf(base);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = base;
    ctx.stroke();
    circ(ctx, x2, y2, 3);
    ctx.fillStyle = tip;
    ctx.fill();
  }
}
