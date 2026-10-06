/*
 * 제트스키 썬더 레이스 — 코스 05~08 풍경
 *  빅 웨이브: 파도 부딪히는 바위 기둥 · 구조대 망루
 *  스톰 코스트: 어두운 해안 절벽 · 등대(불빛은 실시간)
 *  볼케이노: 화산섬(용암 줄기) · 검은 용암 바위(장애물)
 *  문라이트: 불 켜진 밤섬 · 물 위 등불 · 경고등 바위(장애물)
 * 그림 좌표: 풍경 dm(1=10cm) · 장애물 cm, (0,0) = 물 표면 가운데.
 */
import { TAU, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, smooth, fill, flat, stroke, gloss, dot } from "../../ocean-blaster/art/kit.js?v=3";
import { seeded } from "../js/view.js?v=1";
import { palm } from "./scenery.js?v=1";

/* ================= 빅 웨이브 ================= */

/** 바다에 솟은 바위 기둥 + 부딪혀 부서지는 흰 파도 */
export function seaStack(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.4) * 1000) + 131);
  const w = 50 + r() * 30;
  const h = 120 + r() * 90;
  smooth(ctx, [-w, 2, -w * 0.9, -h * 0.4, -w * 0.6, -h * 0.9, -w * 0.1, -h, w * 0.4, -h * 0.85, w * 0.8, -h * 0.4, w, 2], true, 0.25);
  fill(ctx, "#6f7686", -w * 0.2, -h * 0.5, w, h * 0.6, 2);
  for (let i = 0; i < 6; i++) {
    const y = -h * (0.15 + i * 0.13);
    ctx.beginPath();
    ctx.moveTo(-w * 0.8, y);
    ctx.lineTo(w * 0.7, y + (r() - 0.5) * 10);
    stroke(ctx, alpha("#454b58", 0.4), 2);
  }
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -h * 0.94);
  ctx.quadraticCurveTo(0, -h * 1.06, w * 0.35, -h * 0.88);
  stroke(ctx, "#4caf6e", 6);
  // 부서지는 파도
  for (let i = 0; i < 9; i++) {
    const x = -w * 1.1 + i * w * 0.28;
    circ(ctx, x, -6 - Math.abs(Math.sin(i * 1.7)) * 26, 10 + (i % 3) * 5);
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.92)" : "rgba(220,245,255,0.85)";
    ctx.fill();
  }
}

/** 구조대 망루 (빨간 지붕 · 깃발) */
export function lifeguard(ctx) {
  for (const x of [-26, 26]) {
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x * 0.7, -70);
    stroke(ctx, "#f2f2f2", 4);
  }
  ctx.beginPath();
  ctx.moveTo(-26, -30);
  ctx.lineTo(26, -50);
  ctx.moveTo(26, -30);
  ctx.lineTo(-26, -50);
  stroke(ctx, "#d8dde6", 2);
  rrect(ctx, -28, -98, 56, 30, 3);
  fill(ctx, "#ffffff", -4, -84, 28, 15, 1.6);
  rrect(ctx, -20, -92, 40, 14, 2);
  ctx.fillStyle = "#3d6a96";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-36, -96);
  ctx.lineTo(0, -116);
  ctx.lineTo(36, -96);
  ctx.closePath();
  fill(ctx, "#e8452f", 0, -106, 36, 10, 1.6);
  ctx.beginPath();
  ctx.moveTo(30, -100);
  ctx.lineTo(30, -140);
  stroke(ctx, "#cfd8e6", 2);
  ctx.beginPath();
  ctx.moveTo(30, -140);
  ctx.lineTo(54, -132);
  ctx.lineTo(30, -124);
  ctx.closePath();
  ctx.fillStyle = "#ffd23f";
  ctx.fill();
  // 부표 받침
  for (const x of [-30, 30]) {
    ell(ctx, x, 0, 12, 5);
    ctx.fillStyle = "#ff7a1a";
    ctx.fill();
  }
}

/* ================= 스톰 코스트 ================= */

/** 어두운 해안 절벽 (부서지는 파도) */
export function stormCliff(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.4) * 1000) + 141);
  const w = 260 + r() * 80;
  const h = 150 + r() * 90;
  ctx.beginPath();
  ctx.moveTo(-w, 2);
  let x = -w;
  while (x < w) {
    const nx = x + 30 + r() * 50;
    ctx.lineTo(x + 10, -h * (0.55 + r() * 0.45));
    ctx.lineTo(nx, -h * (0.5 + r() * 0.5));
    x = nx;
  }
  ctx.lineTo(w, 2);
  ctx.closePath();
  fill(ctx, "#4a5260", -w * 0.2, -h * 0.5, w, h * 0.6, 2.4);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const xx = -w + r() * w * 2;
    ctx.moveTo(xx, -h * (0.2 + r() * 0.3));
    ctx.lineTo(xx + (r() - 0.5) * 30, -h * (0.5 + r() * 0.3));
  }
  stroke(ctx, alpha("#2c313b", 0.55), 2);
  // 초록 풀 (꼭대기)
  ctx.beginPath();
  ctx.moveTo(-w * 0.9, -h * 0.82);
  ctx.quadraticCurveTo(0, -h * 1.02, w * 0.9, -h * 0.82);
  stroke(ctx, "#3d6b4f", 8);
  // 부서지는 파도
  for (let i = 0; i < 16; i++) {
    const xx = -w + i * (w / 7.5);
    circ(ctx, xx, -4 - Math.abs(Math.sin(i * 2.1)) * 20, 10 + (i % 4) * 4);
    ctx.fillStyle = "rgba(240,248,255,0.85)";
    ctx.fill();
  }
}

/** 폭풍 등대 (빨강 흰 줄 · 불빛은 실시간으로 돈다) */
export function stormLighthouse(ctx) {
  smooth(ctx, [-80, 2, -70, -40, -30, -60, 40, -58, 76, -30, 84, 2], true, 0.3);
  fill(ctx, "#4a5260", 0, -30, 80, 32, 2);
  ctx.beginPath();
  ctx.moveTo(-22, -50);
  ctx.lineTo(-15, -230);
  ctx.lineTo(15, -230);
  ctx.lineTo(22, -50);
  ctx.closePath();
  fill(ctx, "#f2f2f2", -6, -140, 20, 90, 2);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#c8282f";
  for (const y of [-100, -160, -220]) ctx.fillRect(-30, y, 60, 30);
  ctx.restore();
  rrect(ctx, -19, -262, 38, 32, 5);
  ctx.fillStyle = "#fff4b0";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#3a3a44";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-24, -262);
  ctx.lineTo(0, -288);
  ctx.lineTo(24, -262);
  ctx.closePath();
  fill(ctx, "#2a2f3a", 0, -275, 20, 12, 1.6);
}

/* ================= 볼케이노 ================= */

/** 화산섬: 검은 바위 + 흘러내리는 용암 줄기 + 연기 */
export function volcanoIsle(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.4) * 1000) + 151);
  const w = 240 + r() * 80;
  const h = 150 + r() * 80;
  ctx.beginPath();
  ctx.moveTo(-w, 2);
  ctx.bezierCurveTo(-w * 0.6, -h * 0.5, -w * 0.25, -h, -w * 0.1, -h);
  ctx.lineTo(w * 0.12, -h * 0.98);
  ctx.bezierCurveTo(w * 0.3, -h * 0.9, w * 0.6, -h * 0.4, w, 2);
  ctx.closePath();
  fill(ctx, "#3a3036", -w * 0.2, -h * 0.5, w, h * 0.6, 2.4);
  // 용암 줄기 (빛나는 주황)
  for (let i = 0; i < 4; i++) {
    const sx = -w * 0.08 + (r() - 0.5) * w * 0.2;
    ctx.beginPath();
    ctx.moveTo(sx, -h * 0.96);
    let x = sx;
    for (let k = 1; k <= 6; k++) {
      x += (r() - 0.5) * 30 + (i - 1.5) * 10;
      ctx.lineTo(x, -h * (0.96 - k * 0.15));
    }
    stroke(ctx, "rgba(255,120,30,0.5)", 9);
    ctx.strokeStyle = "#ffcf5a";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // 분화구 빛
  ell(ctx, 0, -h * 0.98, w * 0.11, 8);
  ctx.fillStyle = "#ff8a2a";
  ctx.fill();
  // 연기
  for (let i = 0; i < 6; i++) {
    circ(ctx, (r() - 0.5) * 40 + i * 6, -h - 20 - i * 26, 24 + i * 8);
    ctx.fillStyle = `rgba(80,70,75,${0.55 - i * 0.07})`;
    ctx.fill();
  }
  // 검은 모래 해변
  ctx.beginPath();
  ctx.moveTo(-w, 2);
  ctx.quadraticCurveTo(0, -12, w, 2);
  ctx.closePath();
  ctx.fillStyle = "#2a2628";
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) ctx.lineTo(-w + (i / 20) * w * 2, 2 - (i % 2) * 2);
  stroke(ctx, "rgba(255,230,210,0.8)", 2);
}

/** 용암 바위 (코스 안 장애물 · cm): 갈라진 틈에서 빛 */
export function lavaRock(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.5) * 1000) + 161);
  const pts = [-108, 6, -100, -60, -56, -118, 4, -132, 60, -100, 98, -54, 108, 6];
  smooth(ctx, pts, true, 0.25);
  fill(ctx, "#3b3438", -24, -70, 100, 70, 3.2);
  ctx.save();
  smooth(ctx, pts, true, 0.25);
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    let x = -80 + r() * 160;
    let y = -20 - r() * 90;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (r() - 0.5) * 40;
      y += 12 + r() * 14;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255,110,30,0.55)";
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = "#ffcf5a";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
  gloss(ctx, -40, -100, 26, 10, 0.25);
  ell(ctx, 0, 4, 112, 14);
  stroke(ctx, "rgba(255,230,210,0.85)", 4);
}

/* ================= 문라이트 ================= */

/** 밤섬: 어두운 섬 + 불 켜진 창문 + 야자수 실루엣 */
export function nightIsle(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.4) * 1000) + 171);
  const w = 220 + r() * 100;
  const h = 70 + r() * 60;
  ctx.beginPath();
  ctx.moveTo(-w, 2);
  ctx.bezierCurveTo(-w * 0.7, -h, w * 0.5, -h * 1.2, w, 2);
  ctx.closePath();
  fill(ctx, "#24304a", 0, -h * 0.5, w, h * 0.6, 2);
  for (let i = 0; i < 4; i++) palm(ctx, -w * 0.6 + i * w * 0.4 + r() * 30, -h * 0.6 - r() * 20, 40 + r() * 30, (r() - 0.5) * 0.6, i + 51);
  // 집 + 불빛
  for (let i = 0; i < 4; i++) {
    const x = -w * 0.5 + r() * w;
    const y = -h * (0.25 + r() * 0.3);
    rrect(ctx, x - 12, y - 14, 24, 16, 2);
    ctx.fillStyle = "#3a4560";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 13);
    ctx.lineTo(x, y - 24);
    ctx.lineTo(x + 15, y - 13);
    ctx.closePath();
    ctx.fillStyle = "#2a3248";
    ctx.fill();
    for (const wx of [-6, 4]) {
      rrect(ctx, x + wx, y - 9, 5, 5, 1);
      ctx.fillStyle = "#ffd98a";
      ctx.fill();
    }
    circ(ctx, x, y - 6, 16);
    ctx.fillStyle = "rgba(255,210,120,0.12)";
    ctx.fill();
  }
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) ctx.lineTo(-w + (i / 20) * w * 2, 2 - (i % 2) * 2);
  stroke(ctx, "rgba(190,220,255,0.55)", 2);
}

/** 물 위 등불 (작은 종이 등 여러 개 · cm) */
export function lanterns(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.4) * 1000) + 181);
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 70 + (r() - 0.5) * 30;
    const s = 0.8 + r() * 0.4;
    const g = ctx.createRadialGradient(x, -30 * s, 4, x, -30 * s, 70 * s);
    g.addColorStop(0, "rgba(255,200,110,0.55)");
    g.addColorStop(1, "rgba(255,200,110,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, -30 * s, 70 * s, 0, TAU);
    ctx.fill();
    rrect(ctx, x - 16 * s, -54 * s, 32 * s, 46 * s, 10 * s);
    ctx.fillStyle = i % 2 ? "#ffb35a" : "#ff8a7a";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#8a3a1a";
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,220,0.8)";
    rrect(ctx, x - 8 * s, -44 * s, 16 * s, 26 * s, 6 * s);
    ctx.fill();
    ell(ctx, x, 2, 26 * s, 6 * s);
    ctx.fillStyle = "rgba(255,200,110,0.35)";
    ctx.fill();
  }
}

/** 경고등 바위 (밤 · 코스 안 장애물 · cm): 꼭대기 빨간 불이 깜빡 (불빛은 실시간) */
export function beaconRock(ctx, o = {}) {
  const pts = [-104, 6, -96, -56, -50, -110, 10, -124, 62, -92, 100, -48, 106, 6];
  smooth(ctx, pts, true, 0.25);
  fill(ctx, "#5c6478", -20, -70, 100, 70, 3.2);
  ctx.beginPath();
  ctx.moveTo(-60, -100);
  ctx.quadraticCurveTo(-20, -126, 30, -114);
  stroke(ctx, "rgba(200,220,255,0.55)", 5);
  ctx.beginPath();
  ctx.moveTo(10, -122);
  ctx.lineTo(10, -190);
  stroke(ctx, "#2a2f3a", 6);
  rrect(ctx, -2, -214, 24, 26, 5);
  ctx.fillStyle = "#2a2f3a";
  ctx.fill();
  ell(ctx, 0, 4, 110, 14);
  stroke(ctx, "rgba(200,225,255,0.7)", 4);
}

void lighten;
void darken;
void mix;
void lineOf;
void linear;
void radial;
void flat;
void dot;
