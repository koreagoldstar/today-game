/*
 * 제트스키 썬더 레이스 — 코스 밖 풍경 (섬 · 모래톱 · 배 · 등대 · 수상가옥 · 돌고래)
 * 그림 좌표: 1 = 10cm (풍경은 커서 dm 단위), (0,0) = 물 표면 가운데.
 */
import { TAU, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, smooth, fill, flat, stroke, gloss, shadow, dot } from "../../ocean-blaster/art/kit.js?v=3";
import { seeded } from "../js/view.js?v=2";

/** 야자수: 휘어진 줄기 + 잎 7장 + 코코넛 (h: 줄기 높이 dm) */
export function palm(ctx, x, y, h, lean = 0.2, seed = 1, scale = 1) {
  const r = seeded(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const tx = h * lean;
  const ty = -h;
  // 줄기 (마디)
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.quadraticCurveTo(tx * 0.2 - 3, -h * 0.55, tx - 2.4, ty);
  ctx.lineTo(tx + 2.4, ty);
  ctx.quadraticCurveTo(tx * 0.2 + 4, -h * 0.55, 4, 0);
  ctx.closePath();
  fill(ctx, "#a8784a", tx * 0.3, -h * 0.5, 6, h * 0.5, 1.4);
  for (let i = 1; i < 8; i++) {
    const u = i / 8;
    const px = tx * u * u * 0.9 + (tx * 0.2) * u * (1 - u) * 2;
    ctx.beginPath();
    ctx.moveTo(px - 3.6 + u * 1.2, -h * u);
    ctx.lineTo(px + 3.6 - u * 1.2, -h * u + 1);
    stroke(ctx, alpha("#5c3a18", 0.6), 0.9);
  }
  // 잎
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.95 + (i / (n - 1)) * Math.PI * 0.9 + (r() - 0.5) * 0.25;
    const len = h * (0.42 + r() * 0.16);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.55 + len * 0.28;
    const mx = tx + Math.cos(a) * len * 0.5;
    const my = ty + Math.sin(a) * len * 0.5 - len * 0.12;
    const c = i % 2 ? "#3fb15a" : "#2f9a4c";
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(mx, my - 6, ex, ey);
    ctx.quadraticCurveTo(mx, my + 4, tx, ty + 2);
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = "#1f6b35";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(mx, my - 2, ex, ey);
    stroke(ctx, alpha("#c9f5a8", 0.55), 0.8);
  }
  for (let i = 0; i < 3; i++) {
    circ(ctx, tx - 3 + i * 3, ty + 3 + (i % 2) * 2, 2.2);
    ctx.fillStyle = "#6b4420";
    ctx.fill();
  }
  ctx.restore();
}

/** 섬 공통: 모래사장 + 젖은 모래 + 물거품 테두리 */
function beach(ctx, w, h, sand = "#f4dc9b") {
  ctx.beginPath();
  ctx.moveTo(-w, 2);
  ctx.quadraticCurveTo(-w * 0.85, -h, -w * 0.4, -h * 1.15);
  ctx.lineTo(w * 0.4, -h * 1.15);
  ctx.quadraticCurveTo(w * 0.85, -h, w, 2);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `sand${w}|${h}|${sand}`, 0, -h * 1.15, 0, 2, [
    [0, lighten(sand, 0.2)],
    [0.7, sand],
    [1, darken(sand, 0.18)],
  ]);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-w, 2);
  ctx.quadraticCurveTo(0, -3, w, 2);
  stroke(ctx, alpha(darken(sand, 0.3), 0.6), 2);
  // 거품
  ctx.beginPath();
  ctx.moveTo(-w - 6, 2);
  for (let i = 0; i <= 20; i++) {
    const x = -w - 6 + (i / 20) * (w * 2 + 12);
    ctx.lineTo(x, 2 + (i % 2 ? 1.6 : -0.6));
  }
  stroke(ctx, "rgba(255,255,255,0.9)", 2.4);
}

/** 큰 섬: 초록 언덕 두 겹 + 야자수 숲 + 바위 */
export function isleBig(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.3) * 1000) + 3);
  const w = 260 + r() * 120;
  const hh = 70 + r() * 70;
  beach(ctx, w, 10, o.sand);
  // 뒤 언덕
  ctx.beginPath();
  ctx.moveTo(-w * 0.82, -8);
  ctx.bezierCurveTo(-w * 0.6, -hh * 1.1, -w * 0.15, -hh * 1.5, w * 0.12, -hh * 1.25);
  ctx.bezierCurveTo(w * 0.42, -hh * 1.05, w * 0.72, -hh * 0.6, w * 0.84, -8);
  ctx.closePath();
  fill(ctx, "#2e8f52", -w * 0.2, -hh, w * 0.7, hh, 2);
  // 앞 언덕 (밝은 초록)
  ctx.beginPath();
  ctx.moveTo(-w * 0.9, -8);
  ctx.bezierCurveTo(-w * 0.7, -hh * 0.55, -w * 0.4, -hh * 0.8, -w * 0.1, -hh * 0.6);
  ctx.bezierCurveTo(w * 0.2, -hh * 0.45, w * 0.55, -hh * 0.75, w * 0.9, -8);
  ctx.closePath();
  fill(ctx, "#45b465", -w * 0.3, -hh * 0.5, w * 0.7, hh * 0.5, 2);
  // 나무 덩어리 질감
  for (let i = 0; i < 12; i++) {
    const x = -w * 0.7 + r() * w * 1.4;
    const y = -hh * (0.2 + r() * 0.5);
    ell(ctx, x, y, 16 + r() * 14, 10 + r() * 8);
    ctx.fillStyle = alpha(i % 2 ? "#5fcf78" : "#2a7d47", 0.55);
    ctx.fill();
  }
  // 야자수
  const np = 4 + Math.floor(r() * 4);
  for (let i = 0; i < np; i++) {
    const x = -w * 0.8 + (i + r() * 0.6) * ((w * 1.6) / np);
    palm(ctx, x, -6, 60 + r() * 50, (r() - 0.5) * 0.7, i + 3);
  }
  // 바위
  for (let i = 0; i < 3; i++) {
    const x = (r() < 0.5 ? -1 : 1) * (w * 0.6 + r() * w * 0.35);
    ell(ctx, x, -4, 14 + r() * 10, 10 + r() * 6);
    fill(ctx, "#8d96a6", x - 4, -8, 14, 10, 1.6);
  }
}

/** 높은 바위섬 (절벽 + 꼭대기 야자수) */
export function isleTall(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.5) * 1000) + 7);
  const w = 150 + r() * 60;
  const hh = 180 + r() * 80;
  beach(ctx, w * 1.05, 6, o.sand);
  ctx.beginPath();
  ctx.moveTo(-w, -4);
  ctx.bezierCurveTo(-w * 1.05, -hh * 0.5, -w * 0.7, -hh * 0.95, -w * 0.3, -hh);
  ctx.lineTo(w * 0.25, -hh * 1.04);
  ctx.bezierCurveTo(w * 0.7, -hh * 0.9, w * 1.02, -hh * 0.45, w, -4);
  ctx.closePath();
  fill(ctx, "#8b7d6e", -w * 0.3, -hh * 0.6, w, hh * 0.6, 2.4);
  // 절벽 결
  for (let i = 0; i < 7; i++) {
    const x = -w * 0.8 + r() * w * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, -hh * (0.15 + r() * 0.3));
    ctx.lineTo(x + (r() - 0.5) * 20, -hh * (0.6 + r() * 0.3));
    stroke(ctx, alpha("#4d4339", 0.45), 2);
  }
  // 초록 꼭대기
  ctx.beginPath();
  ctx.moveTo(-w * 0.85, -hh * 0.72);
  ctx.bezierCurveTo(-w * 0.6, -hh * 1.12, w * 0.4, -hh * 1.16, w * 0.88, -hh * 0.72);
  ctx.bezierCurveTo(w * 0.4, -hh * 0.86, -w * 0.4, -hh * 0.82, -w * 0.85, -hh * 0.72);
  ctx.closePath();
  fill(ctx, "#3fa85e", 0, -hh, w * 0.8, hh * 0.2, 2);
  for (let i = 0; i < 3; i++) palm(ctx, -w * 0.5 + i * w * 0.45 + r() * 20, -hh * 0.92, 40 + r() * 30, (r() - 0.5) * 0.6, i + 11);
  // 물보라
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) ctx.lineTo(-w + (i / 16) * w * 2, -2 - (i % 2 ? 4 : 0));
  stroke(ctx, "rgba(255,255,255,0.85)", 3);
}

/** 작은 모래톱 + 야자수 + 파라솔 */
export function sandbar(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.2) * 1000) + 19);
  const w = 60 + r() * 40;
  beach(ctx, w, 8, o.sand);
  palm(ctx, -w * 0.2, -8, 50 + r() * 30, 0.25 + r() * 0.2, 5 + Math.floor(r() * 9));
  if (r() < 0.6) palm(ctx, w * 0.35, -8, 36 + r() * 20, -0.3, 9);
  if (r() < 0.7) {
    // 파라솔
    const px = w * (r() - 0.5) * 0.6;
    ctx.beginPath();
    ctx.moveTo(px, -8);
    ctx.lineTo(px + 2, -38);
    stroke(ctx, "#ffffff", 1.6);
    ctx.beginPath();
    ctx.moveTo(px - 18, -32);
    ctx.quadraticCurveTo(px + 2, -50, px + 22, -32);
    ctx.closePath();
    ctx.fillStyle = r() < 0.5 ? "#ff5a6e" : "#ffb02e";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#7a2030";
    ctx.stroke();
  }
}

/** 갈림길 섬 위: 작은 모래 언덕 + 야자수 두 그루 + 덤불 */
export function palmTuft(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.3) * 1000) + 41);
  ctx.beginPath();
  ctx.moveTo(-56, 2);
  ctx.quadraticCurveTo(-40, -14, 0, -16);
  ctx.quadraticCurveTo(40, -14, 56, 2);
  ctx.closePath();
  ctx.fillStyle = "#e9cf8a";
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const x = -34 + i * 22 + (r() - 0.5) * 8;
    ell(ctx, x, -12, 12 + r() * 6, 8 + r() * 4);
    ctx.fillStyle = i % 2 ? "#3f9f58" : "#2f8a4a";
    ctx.fill();
  }
  palm(ctx, -14, -12, 52 + r() * 24, 0.2 + r() * 0.2, 3 + Math.floor(r() * 9));
  if (r() < 0.75) palm(ctx, 18, -12, 38 + r() * 18, -0.3, 8);
}

/** 바위 무더기 */
export function rockIsle(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.4) * 1000) + 23);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 18 + (r() - 0.5) * 10;
    const h = 20 + r() * 26;
    const w = 14 + r() * 10;
    smooth(ctx, [x - w, 2, x - w * 0.8, -h * 0.6, x - w * 0.2, -h, x + w * 0.5, -h * 0.85, x + w, 2], true, 0.3);
    fill(ctx, i % 2 ? "#7f8899" : "#959fb0", x - 4, -h * 0.6, w, h * 0.7, 1.6);
  }
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) ctx.lineTo(-50 + i * 7.3, 1 - (i % 2) * 2);
  stroke(ctx, "rgba(255,255,255,0.85)", 2);
}

/** 돛단배 */
export function sailboat(ctx, o = {}) {
  const c = o.v > 0.5 ? "#ff5a6e" : "#2f86ea";
  ctx.beginPath();
  ctx.moveTo(-40, -10);
  ctx.lineTo(40, -10);
  ctx.lineTo(30, 2);
  ctx.lineTo(-32, 2);
  ctx.closePath();
  fill(ctx, "#ffffff", -10, -6, 40, 8, 1.6);
  ctx.beginPath();
  ctx.moveTo(-40, -6);
  ctx.lineTo(40, -6);
  stroke(ctx, c, 2.4);
  ctx.beginPath();
  ctx.moveTo(-2, -10);
  ctx.lineTo(-2, -96);
  stroke(ctx, "#6b5a4a", 2);
  ctx.beginPath();
  ctx.moveTo(0, -94);
  ctx.quadraticCurveTo(30, -50, 34, -14);
  ctx.lineTo(0, -14);
  ctx.closePath();
  fill(ctx, "#ffffff", 10, -60, 20, 40, 1.4);
  ctx.beginPath();
  ctx.moveTo(-4, -88);
  ctx.quadraticCurveTo(-26, -50, -28, -16);
  ctx.lineTo(-4, -16);
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = lineOf(c);
  ctx.stroke();
}

/** 하얀 요트 */
export function yacht(ctx) {
  ctx.beginPath();
  ctx.moveTo(-90, -18);
  ctx.lineTo(80, -18);
  ctx.quadraticCurveTo(96, -16, 100, -8);
  ctx.lineTo(70, 2);
  ctx.lineTo(-80, 2);
  ctx.closePath();
  fill(ctx, "#ffffff", -20, -12, 90, 12, 1.6);
  ctx.beginPath();
  ctx.moveTo(-90, -10);
  ctx.lineTo(96, -10);
  stroke(ctx, "#1d3a6a", 2.4);
  rrect(ctx, -50, -40, 90, 22, 6);
  fill(ctx, "#f2f6fb", -10, -30, 50, 10, 1.4);
  for (let i = 0; i < 5; i++) {
    rrect(ctx, -44 + i * 16, -34, 12, 8, 2);
    ctx.fillStyle = "#3d6a96";
    ctx.fill();
  }
  rrect(ctx, -30, -56, 50, 16, 5);
  fill(ctx, "#ffffff", -10, -48, 26, 8, 1.2);
  ctx.beginPath();
  ctx.moveTo(-6, -56);
  ctx.lineTo(-6, -80);
  stroke(ctx, "#9aa4b6", 1.6);
}

/** 등대 (바위 위 · 빨강 흰 줄) */
export function lighthouse(ctx) {
  rockIsle(ctx, { v: 0.7 });
  ctx.beginPath();
  ctx.moveTo(-18, -20);
  ctx.lineTo(-12, -170);
  ctx.lineTo(12, -170);
  ctx.lineTo(18, -20);
  ctx.closePath();
  fill(ctx, "#ffffff", -6, -100, 18, 80, 1.8);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#e8452f";
  for (const y of [-60, -110, -160]) ctx.fillRect(-30, y, 60, 24);
  ctx.restore();
  rrect(ctx, -16, -194, 32, 24, 4);
  ctx.fillStyle = "#ffe8a0";
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#5c4a2a";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-20, -194);
  ctx.lineTo(0, -214);
  ctx.lineTo(20, -194);
  ctx.closePath();
  fill(ctx, "#e8452f", 0, -204, 16, 10, 1.6);
  rrect(ctx, -22, -172, 44, 5, 2);
  ctx.fillStyle = "#1d2a44";
  ctx.fill();
}

/** 수상 가옥 + 나무 다리 */
export function hutPier(ctx) {
  // 다리 기둥
  for (let i = 0; i < 9; i++) {
    const x = -110 + i * 26;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x, -22);
    stroke(ctx, "#7a5228", 3);
  }
  rrect(ctx, -116, -28, 232, 7, 2);
  fill(ctx, "#b8844a", 0, -24, 110, 4, 1.4);
  for (const [x, s] of [
    [-60, 1],
    [50, 0.85],
  ]) {
    ctx.save();
    ctx.translate(x, -28);
    ctx.scale(s, s);
    rrect(ctx, -34, -40, 68, 40, 3);
    fill(ctx, "#d9a868", -10, -24, 34, 20, 1.6);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(-34 + i * 12, -40);
      ctx.lineTo(-34 + i * 12, 0);
      stroke(ctx, alpha("#8a5a2a", 0.5), 1.2);
    }
    rrect(ctx, -10, -26, 16, 26, 2);
    ctx.fillStyle = "#5c3a18";
    ctx.fill();
    // 초가 지붕
    ctx.beginPath();
    ctx.moveTo(-46, -36);
    ctx.lineTo(0, -78);
    ctx.lineTo(46, -36);
    ctx.closePath();
    fill(ctx, "#c9a24a", -6, -56, 40, 20, 1.6);
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(-42 + i * 11, -38);
      ctx.lineTo(-20 + i * 5.5, -60);
      stroke(ctx, alpha("#8a6a1a", 0.5), 1);
    }
    ctx.restore();
  }
}

/** 돌고래 한 마리 (실시간: 점프 위상 ph 0~1) */
export function dolphin(ctx, ph, s = 1) {
  if (ph < 0 || ph > 1) return;
  const a = -0.9 + ph * 1.8;
  const y = -Math.sin(ph * Math.PI) * 26;
  ctx.save();
  ctx.translate((ph - 0.5) * 60, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.quadraticCurveTo(-6, -10, 14, -4);
  ctx.quadraticCurveTo(24, -2, 26, 1);
  ctx.quadraticCurveTo(14, 4, -4, 6);
  ctx.quadraticCurveTo(-16, 6, -22, 0);
  ctx.closePath();
  fill(ctx, "#6f8fb5", 0, -2, 22, 8, 1.4);
  ctx.beginPath();
  ctx.moveTo(-2, -7);
  ctx.lineTo(-8, -15);
  ctx.lineTo(4, -7);
  ctx.closePath();
  ctx.fillStyle = "#5a7aa0";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.lineTo(-30, -6);
  ctx.lineTo(-28, 4);
  ctx.closePath();
  ctx.fill();
  dot(ctx, 15, -2, 1.2, "#1d2a44");
  ctx.restore();
}
