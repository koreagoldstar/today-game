/*
 * 바다괴물 탐험대 — 보스 그림
 *  난파선 상어왕 (sharkKing) · …
 * 원점 = 몸 가운데, 오른쪽을 본다. p = 보스 상태 (boss.js 가 채운다)
 *  p.t · p.wind(돌진 준비) · p.charge(돌진 중) · p.stun(어질) · p.hit · p.rage(2단계) · p.roar(포효)
 */
import { INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss, blush } from "../../ocean-blaster/art/kit.js?v=3";
import { ART } from "./registry.js?v=1";

const TAU = Math.PI * 2;
export const BOSS_ART = {};

/* ================================================================
 * 난파선 상어왕 — 금관 · 흉터 · 금니 · 찢어진 지느러미
 * ============================================================== */
const SK = { body: "#5d7f9e", dark: "#3c5874", belly: "#eef3f6", fin: "#4f6f8e", crown: "#ffd23f", gem: "#ff4f6a" };
function sharkKing(ctx, p) {
  const t = p.t || 0;
  const wind = p.wind || 0;
  const sw = Math.sin(t * (wind > 0.1 ? 22 : p.charge ? 14 : 6)) * (0.18 + wind * 0.22);
  const mouth = Math.max(p.charge ? 1 : 0, (p.roar || 0) * 0.9, wind * 0.4);
  const body = p.rage ? mix(SK.body, "#7a5a9e", 0.35) : SK.body;
  ctx.save();
  // 꼬리 (큰 초승달)
  ctx.save();
  ctx.translate(-150, 0);
  ctx.rotate(sw);
  ctx.beginPath();
  ctx.moveTo(14, -10);
  ctx.quadraticCurveTo(-30, -30, -62, -92);
  ctx.quadraticCurveTo(-40, -20, -46, 4);
  ctx.quadraticCurveTo(-44, 30, -66, 74);
  ctx.quadraticCurveTo(-24, 20, 14, 12);
  ctx.closePath();
  fill(ctx, SK.fin, -30, -10, 40, 50, 3.4);
  // 찢어진 홈
  ctx.beginPath();
  ctx.moveTo(-50, -66);
  ctx.lineTo(-40, -58);
  ctx.lineTo(-52, -52);
  stroke(ctx, alpha(SK.dark, 0.9), 3);
  ctx.restore();
  // 뒤 가슴지느러미 (먼 쪽)
  ctx.save();
  ctx.translate(20, 30);
  ctx.rotate(0.6 + Math.sin(t * 4) * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-40, 30, -70, 40);
  ctx.quadraticCurveTo(-30, 10, -6, -6);
  ctx.closePath();
  fill(ctx, darken(SK.fin, 0.2), -30, 16, 30, 18, 2.6);
  ctx.restore();
  // 등지느러미 (찢어진 끝)
  ctx.beginPath();
  ctx.moveTo(-40, -50);
  ctx.quadraticCurveTo(-10, -120, 30, -128);
  ctx.lineTo(22, -112);
  ctx.lineTo(34, -104);
  ctx.quadraticCurveTo(16, -80, 26, -50);
  ctx.closePath();
  fill(ctx, SK.fin, 0, -90, 30, 40, 3);
  // 몸
  const bodyP = () => {
    ctx.beginPath();
    ctx.moveTo(-156, -6);
    ctx.bezierCurveTo(-110, -70, 80, -84, 150, -34);
    ctx.quadraticCurveTo(178, -12, 168, 12);
    ctx.bezierCurveTo(120, 64, -100, 66, -156, 8);
    ctx.closePath();
  };
  bodyP();
  fill(ctx, body, -20, -26, 160, 66, 3.6);
  ctx.save();
  bodyP();
  ctx.clip();
  // 하얀 배
  ctx.beginPath();
  ctx.moveTo(-150, 14);
  ctx.bezierCurveTo(-60, 20, 60, 10, 172, 2);
  ctx.lineTo(172, 80);
  ctx.lineTo(-150, 80);
  ctx.closePath();
  ctx.fillStyle = SK.belly;
  ctx.fill();
  // 등 줄무늬 · 흉터
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-110 + i * 40, -50);
    ctx.quadraticCurveTo(-104 + i * 40, -30, -114 + i * 40, -10);
    stroke(ctx, alpha(SK.dark, 0.45), 6);
  }
  ctx.beginPath();
  ctx.moveTo(40, -40);
  ctx.lineTo(70, -10);
  ctx.moveTo(46, -26);
  ctx.lineTo(60, -36);
  ctx.moveTo(56, -16);
  ctx.lineTo(70, -26);
  stroke(ctx, alpha("#e8d8d8", 0.8), 3);
  ctx.restore();
  // 아가미
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(70 + i * 9, -18);
    ctx.quadraticCurveTo(66 + i * 9, 0, 70 + i * 9, 16);
    stroke(ctx, alpha(SK.dark, 0.8), 3);
  }
  gloss(ctx, -20, -50, 70, 10, 0.5, -0.05);
  // 입 (금니 하나!)
  ctx.save();
  ctx.translate(150, 14);
  ctx.beginPath();
  ctx.moveTo(-50, -4);
  ctx.quadraticCurveTo(-10, 6 + mouth * 30, 22, -6 - mouth * 6);
  ctx.lineTo(22, 0);
  ctx.quadraticCurveTo(-10, 14 + mouth * 40, -50, 2);
  ctx.closePath();
  flat(ctx, "#5a1028", 2.4, INK);
  for (let i = 0; i < 8; i++) {
    const gx = -44 + i * 8;
    const gold = i === 3;
    ctx.beginPath();
    ctx.moveTo(gx, -1 + i * 0.2);
    ctx.lineTo(gx + 3, 9 + mouth * 4);
    ctx.lineTo(gx + 6, -1 + i * 0.2);
    flat(ctx, gold ? "#ffd23f" : "#ffffff", 1, gold ? "#8a5a00" : "#8a9aa0");
  }
  if (mouth > 0.3) {
    for (let i = 0; i < 6; i++) {
      const gx = -40 + i * 9;
      ctx.beginPath();
      ctx.moveTo(gx, 10 + mouth * 34);
      ctx.lineTo(gx + 3, 2 + mouth * 30);
      ctx.lineTo(gx + 6, 10 + mouth * 34);
      flat(ctx, "#ffffff", 1, "#8a9aa0");
    }
  }
  ctx.restore();
  // 눈 (흉터 · 화나면 빨갛게)
  const ex = 116;
  const ey = -22;
  if (p.stun) {
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = i * 0.8 + t * 10;
      const rr = (i / 18) * 13;
      ctx.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
    }
    circ(ctx, ex, ey, 14);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = i * 0.8 + t * 10;
      const rr = (i / 18) * 12;
      if (i === 0) ctx.moveTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
      else ctx.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
    }
    stroke(ctx, INK, 2.4);
  } else {
    circ(ctx, ex, ey, 14);
    ctx.fillStyle = "#fffbea";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const red = wind > 0.15 || p.rage;
    circ(ctx, ex + 4, ey + 1, 8);
    ctx.fillStyle = red ? "#ff3a3a" : "#2b3a5a";
    ctx.fill();
    circ(ctx, ex + 5, ey + 1, 3.5);
    ctx.fillStyle = "#0b0d1a";
    ctx.fill();
    circ(ctx, ex + 7, ey - 3, 2.6);
    ctx.fillStyle = "#fff";
    ctx.fill();
    // 무서운 눈썹 (흉터 겹침)
    ctx.beginPath();
    ctx.moveTo(ex - 18, ey - 20 + (red ? 4 : 0));
    ctx.lineTo(ex + 16, ey - 12);
    stroke(ctx, INK, 5);
    if (red) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(ex + 4, ey, 2, ex + 4, ey, 34);
      g.addColorStop(0, "rgba(255,80,80,0.8)");
      g.addColorStop(1, "rgba(255,80,80,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ex - 30, ey - 34, 68, 68);
      ctx.restore();
    }
  }
  // 흉터 (눈 위로 X)
  ctx.beginPath();
  ctx.moveTo(ex - 8, ey - 30);
  ctx.lineTo(ex + 10, ey - 6);
  stroke(ctx, alpha("#e8d8d8", 0.9), 3);
  // 앞 가슴지느러미
  ctx.save();
  ctx.translate(40, 34);
  ctx.rotate(0.5 + Math.sin(t * 4 + 1) * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-46, 36, -84, 46);
  ctx.quadraticCurveTo(-36, 10, -8, -8);
  ctx.closePath();
  fill(ctx, SK.fin, -36, 18, 36, 20, 3);
  ctx.restore();
  // 왕관 (머리 위에 비스듬히)
  ctx.save();
  ctx.translate(80, -70);
  ctx.rotate(0.22 + Math.sin(t * 3) * 0.04);
  ctx.beginPath();
  ctx.moveTo(-34, 10);
  ctx.lineTo(-38, -22);
  ctx.lineTo(-22, -6);
  ctx.lineTo(-10, -34);
  ctx.lineTo(2, -6);
  ctx.lineTo(18, -30);
  ctx.lineTo(24, -4);
  ctx.lineTo(38, -20);
  ctx.lineTo(34, 10);
  ctx.closePath();
  fill(ctx, SK.crown, 0, -10, 36, 22, 3);
  for (const [x, y, c] of [
    [-10, 2, SK.gem],
    [8, 2, "#3fd3ff"],
    [24, 2, "#7dff9a"],
  ]) {
    circ(ctx, x, y, 4.5);
    flat(ctx, c, 1.4, darken(c, 0.5));
  }
  gloss(ctx, -12, -6, 14, 4, 0.8, -0.3);
  if (p.rage) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5 + Math.sin(t * 10) * 0.2;
    const g = ctx.createRadialGradient(0, -8, 4, 0, -8, 60);
    g.addColorStop(0, "rgba(255,220,80,0.9)");
    g.addColorStop(1, "rgba(255,220,80,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-60, -70, 120, 120);
    ctx.restore();
  }
  ctx.restore();
  if (p.hit) {
    ctx.save();
    bodyP();
    ctx.fillStyle = `rgba(255,255,255,${0.5 * p.hit})`;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
BOSS_ART.sharkKing = sharkKing;
ART.sharkKing = (ctx, p) => {
  ctx.save();
  ctx.scale(0.36 * (p.s || 1) / 0.7, 0.36 * (p.s || 1) / 0.7);
  sharkKing(ctx, p);
  ctx.restore();
};
