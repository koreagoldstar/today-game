/*
 * 제트스키 썬더 레이스 — 코스 02~04 풍경
 *  코랄 러시: 환초 · 산호 바위 · 유리바닥 배 · 다이빙 플랫폼
 *  아일랜드 루프: 폭포 절벽 · 흔들다리 섬
 *  파이럿 채널: 해적선 · 나무 부두 · 보물섬 · 돌 요새 · 난파선 돛대(장애물)
 * 그림 좌표: 1 = 10cm (dm), (0,0) = 물 표면 가운데. 소품(cm) 은 따로 표시.
 */
import { TAU, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, smooth, fill, flat, stroke, gloss, shadow, dot, pirateHat } from "../../ocean-blaster/art/kit.js?v=3";
import { seeded } from "../js/view.js?v=1";
import { palm } from "./scenery.js?v=1";

/* ================= 코랄 러시 ================= */

/** 환초: 고리 모양 모래섬 + 안쪽 청록 석호 + 야자수 */
export function atoll(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.3) * 1000) + 61);
  const w = 220 + r() * 80;
  // 바깥 산호 테두리 (물 위로 살짝)
  ctx.beginPath();
  ctx.ellipse(0, 0, w + 14, 22, 0, Math.PI, TAU);
  ctx.fillStyle = "rgba(255,150,170,0.55)";
  ctx.fill();
  // 모래 고리
  ctx.beginPath();
  ctx.ellipse(0, 0, w, 20, 0, Math.PI, TAU);
  ctx.ellipse(0, 0, w * 0.72, 12, 0, TAU, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = "#f6e1a6";
  ctx.fill();
  // 석호
  ctx.beginPath();
  ctx.ellipse(0, -2, w * 0.7, 11, 0, Math.PI, TAU);
  ctx.fillStyle = "#7ff0e6";
  ctx.fill();
  // 앞쪽 모래 둑
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.quadraticCurveTo(0, -10, w, 0);
  ctx.lineTo(w, 3);
  ctx.quadraticCurveTo(0, -4, -w, 3);
  ctx.closePath();
  ctx.fillStyle = "#e9cf8a";
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const x = -w * 0.85 + r() * w * 1.7;
    palm(ctx, x, -6 - r() * 8, 34 + r() * 30, (r() - 0.5) * 0.7, i + 21);
  }
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) ctx.lineTo(-w - 10 + (i / 24) * (w * 2 + 20), 2 + (i % 2 ? 1.5 : -0.5));
  stroke(ctx, "rgba(255,255,255,0.9)", 2.2);
}

/** 산호 바위: 물 위로 솟은 바위 + 알록달록 산호 */
export function reefRock(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.5) * 1000) + 71);
  const w = 40 + r() * 30;
  const h = 26 + r() * 30;
  smooth(ctx, [-w, 2, -w * 0.85, -h * 0.5, -w * 0.3, -h, w * 0.3, -h * 0.85, w * 0.85, -h * 0.4, w, 2], true, 0.3);
  fill(ctx, "#8a8fa0", -w * 0.2, -h * 0.5, w, h * 0.6, 1.8);
  const cols = ["#ff7a9c", "#ffb347", "#b37aff", "#ff5a6e", "#5fd0c0"];
  for (let i = 0; i < 7; i++) {
    const x = -w * 0.8 + r() * w * 1.6;
    const y = -h * (0.15 + r() * 0.6);
    const c = cols[Math.floor(r() * cols.length)];
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (k - 1) * 6, y - 8, x + (k - 1) * 9, y - 12 - r() * 6);
      stroke(ctx, c, 3.2);
    }
  }
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) ctx.lineTo(-w - 6 + (i / 12) * (w * 2 + 12), 1 - (i % 2) * 2);
  stroke(ctx, "rgba(255,255,255,0.85)", 2);
}

/** 유리바닥 관광선 */
export function glassBoat(ctx) {
  ctx.beginPath();
  ctx.moveTo(-70, -16);
  ctx.lineTo(66, -16);
  ctx.quadraticCurveTo(80, -14, 82, -6);
  ctx.lineTo(60, 2);
  ctx.lineTo(-62, 2);
  ctx.closePath();
  fill(ctx, "#ffd23f", -10, -10, 70, 10, 1.6);
  ctx.beginPath();
  ctx.moveTo(-70, -8);
  ctx.lineTo(80, -8);
  stroke(ctx, "#1d5fa8", 2.4);
  // 차양 지붕
  for (const x of [-56, 52]) {
    ctx.beginPath();
    ctx.moveTo(x, -16);
    ctx.lineTo(x, -40);
    stroke(ctx, "#ffffff", 2);
  }
  rrect(ctx, -64, -46, 124, 8, 4);
  fill(ctx, "#ff5a6e", 0, -42, 60, 4, 1.4);
  for (let i = 0; i < 6; i++) {
    rrect(ctx, -60 + i * 20, -46, 10, 8, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  // 손님들
  for (let i = 0; i < 5; i++) {
    circ(ctx, -44 + i * 20, -22, 4);
    ctx.fillStyle = ["#ffd5b3", "#f0b48f", "#ffd9c0"][i % 3];
    ctx.fill();
    rrect(ctx, -48 + i * 20, -19, 8, 4, 2);
    ctx.fillStyle = ["#ff7a1a", "#2f86ea", "#13b5a8", "#ff5fa8"][i % 4];
    ctx.fill();
  }
}

/** 다이빙 플랫폼 (부표 위 나무판 + 깃발) */
export function divePlatform(ctx) {
  for (const x of [-30, 30]) {
    ell(ctx, x, -3, 12, 7);
    fill(ctx, "#ff7a1a", x, -4, 12, 7, 1.2);
  }
  rrect(ctx, -40, -14, 80, 8, 2);
  fill(ctx, "#c8924f", 0, -10, 40, 4, 1.4);
  ctx.beginPath();
  ctx.moveTo(26, -14);
  ctx.lineTo(26, -58);
  stroke(ctx, "#ffffff", 2);
  ctx.beginPath();
  ctx.moveTo(26, -58);
  ctx.lineTo(48, -52);
  ctx.lineTo(26, -46);
  ctx.closePath();
  ctx.fillStyle = "#ff3b4e";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(28, -55);
  ctx.lineTo(42, -50);
  stroke(ctx, "#ffffff", 2);
  // 사다리
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-34, -6 + i * 4);
    ctx.lineTo(-26, -6 + i * 4);
    stroke(ctx, "#cfd8e6", 1.2);
  }
}

/* ================= 아일랜드 루프 ================= */

/** 폭포 절벽 섬: 높은 절벽 + 하얀 폭포 + 물안개 + 무지개 */
export function waterfallCliff(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.4) * 1000) + 81);
  const w = 200 + r() * 60;
  const h = 260 + r() * 60;
  ctx.beginPath();
  ctx.moveTo(-w, 2);
  ctx.bezierCurveTo(-w * 1.05, -h * 0.5, -w * 0.75, -h, -w * 0.25, -h * 1.02);
  ctx.lineTo(w * 0.3, -h);
  ctx.bezierCurveTo(w * 0.75, -h * 0.92, w * 1.04, -h * 0.5, w, 2);
  ctx.closePath();
  fill(ctx, "#7d7466", -w * 0.2, -h * 0.6, w, h * 0.6, 2.4);
  for (let i = 0; i < 9; i++) {
    const x = -w * 0.85 + r() * w * 1.7;
    ctx.beginPath();
    ctx.moveTo(x, -h * (0.1 + r() * 0.3));
    ctx.lineTo(x + (r() - 0.5) * 24, -h * (0.55 + r() * 0.35));
    stroke(ctx, alpha("#4a4136", 0.45), 2);
  }
  // 초록 덮개 + 덩굴
  ctx.beginPath();
  ctx.moveTo(-w * 0.9, -h * 0.74);
  ctx.bezierCurveTo(-w * 0.6, -h * 1.14, w * 0.5, -h * 1.16, w * 0.92, -h * 0.74);
  ctx.bezierCurveTo(w * 0.4, -h * 0.84, -w * 0.4, -h * 0.82, -w * 0.9, -h * 0.74);
  ctx.closePath();
  fill(ctx, "#3fa85e", 0, -h, w * 0.8, h * 0.2, 2);
  for (let i = 0; i < 6; i++) {
    const x = -w * 0.8 + r() * w * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, -h * 0.8);
    ctx.quadraticCurveTo(x + 6, -h * 0.65, x - 2, -h * (0.45 + r() * 0.2));
    stroke(ctx, "#2f8a4a", 3);
  }
  for (let i = 0; i < 4; i++) palm(ctx, -w * 0.6 + i * w * 0.4 + r() * 20, -h * 0.93, 36 + r() * 30, (r() - 0.5) * 0.6, i + 31);
  // 폭포
  const fx = (r() - 0.5) * w * 0.4;
  const g = ctx.createLinearGradient(0, -h * 0.85, 0, 0);
  g.addColorStop(0, "#e6fbff");
  g.addColorStop(1, "#ffffff");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(fx - 16, -h * 0.85);
  ctx.quadraticCurveTo(fx - 22, -h * 0.4, fx - 30, 0);
  ctx.lineTo(fx + 30, 0);
  ctx.quadraticCurveTo(fx + 22, -h * 0.4, fx + 16, -h * 0.85);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(fx - 12 + i * 5, -h * 0.84);
    ctx.lineTo(fx - 22 + i * 9, -6);
    stroke(ctx, "rgba(150,220,255,0.6)", 1.6);
  }
  // 물안개 + 무지개
  for (let i = 0; i < 6; i++) {
    circ(ctx, fx + (i - 2.5) * 16, -8 - (i % 2) * 8, 16 + (i % 3) * 5);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fill();
  }
  const cols = ["#ff5a5a", "#ffb02e", "#ffe14a", "#5be37d", "#4fb6ff", "#8a6bff"];
  cols.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(fx + 40, 0, 80 - i * 6, Math.PI * 1.1, Math.PI * 1.55);
    stroke(ctx, alpha(c, 0.4), 5);
  });
}

/* ================= 파이럿 채널 ================= */

/** 해적선 (옆모습 3/4): 배 몸통 · 대포 구멍 · 돛대 3개 · 깃발 (해골 대신 물방울 문장) */
export function pirateShip(ctx, o = {}) {
  const red = o.v > 0.5;
  const hullC = red ? "#7a3b2a" : "#5c3a24";
  const trim = "#d9a640";
  const sail = red ? "#f2e2c0" : "#e9dcc0";
  const flagC = red ? "#b8282f" : "#1d2233";
  // 몸통
  ctx.beginPath();
  ctx.moveTo(-180, -60);
  ctx.lineTo(150, -60);
  ctx.quadraticCurveTo(190, -64, 200, -90);
  ctx.lineTo(214, -92);
  ctx.quadraticCurveTo(200, -40, 150, 2);
  ctx.lineTo(-150, 2);
  ctx.quadraticCurveTo(-190, -20, -196, -80);
  ctx.lineTo(-160, -84);
  ctx.closePath();
  fill(ctx, hullC, -20, -40, 190, 40, 2.6);
  // 장식 띠 · 대포 구멍
  for (const y of [-52, -24]) {
    ctx.beginPath();
    ctx.moveTo(-186, y);
    ctx.quadraticCurveTo(0, y + 6, 200, y - 6);
    stroke(ctx, trim, 3);
  }
  for (let i = 0; i < 8; i++) {
    rrect(ctx, -140 + i * 36, -44, 14, 12, 3);
    ctx.fillStyle = "#1d1410";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-133 + i * 36, -38);
    ctx.lineTo(-133 + i * 36, -30);
    stroke(ctx, "#3a3a44", 4);
  }
  // 선미 누각
  rrect(ctx, -196, -112, 70, 34, 4);
  fill(ctx, darken(hullC, 0.1), -160, -96, 35, 17, 2);
  for (let i = 0; i < 3; i++) {
    rrect(ctx, -188 + i * 22, -104, 14, 14, 2);
    ctx.fillStyle = "#ffd98a";
    ctx.fill();
  }
  // 돛대 · 돛
  for (const [x, h, w] of [
    [-90, 230, 90],
    [20, 270, 110],
    [120, 200, 80],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, -60);
    ctx.lineTo(x, -60 - h);
    stroke(ctx, "#4a2e1a", 6);
    for (let k = 0; k < 2; k++) {
      const top = -60 - h + 20 + k * h * 0.45;
      const sh = h * 0.38;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, top);
      ctx.quadraticCurveTo(x, top + 8, x + w / 2, top);
      ctx.quadraticCurveTo(x + w / 2 + 10, top + sh * 0.5, x + w / 2 - 4, top + sh);
      ctx.quadraticCurveTo(x, top + sh + 10, x - w / 2 + 4, top + sh);
      ctx.quadraticCurveTo(x - w / 2 - 10, top + sh * 0.5, x - w / 2, top);
      ctx.closePath();
      fill(ctx, sail, x - 10, top + sh * 0.4, w * 0.6, sh * 0.6, 1.8);
      // 천 덧댄 자국
      rrect(ctx, x + w * 0.12, top + sh * 0.3, 14, 12, 2);
      ctx.fillStyle = alpha(darken(sail, 0.2), 0.7);
      ctx.fill();
    }
    // 깃발
    ctx.beginPath();
    ctx.moveTo(x, -60 - h);
    ctx.quadraticCurveTo(x + 22, -60 - h + 4, x + 44, -60 - h - 2);
    ctx.lineTo(x + 40, -60 - h + 22);
    ctx.quadraticCurveTo(x + 20, -60 - h + 26, x, -60 - h + 24);
    ctx.closePath();
    ctx.fillStyle = flagC;
    ctx.fill();
    // 물방울 문장
    ctx.beginPath();
    ctx.moveTo(x + 20, -60 - h + 3);
    ctx.quadraticCurveTo(x + 26, -60 - h + 12, x + 25, -60 - h + 15);
    ctx.arc(x + 20, -60 - h + 15, 5, 0, Math.PI);
    ctx.quadraticCurveTo(x + 14, -60 - h + 12, x + 20, -60 - h + 3);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  // 밧줄
  ctx.strokeStyle = alpha("#3a2a1a", 0.6);
  ctx.lineWidth = 1;
  for (const [x0, x1, h] of [
    [-180, -90, 230],
    [-90, 20, 270],
    [20, 120, 270],
    [120, 210, 200],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, -64);
    ctx.lineTo(x1, -60 - h + 10);
    ctx.stroke();
  }
  // 물결
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) ctx.lineTo(-160 + i * 16, 2 - (i % 2) * 3);
  stroke(ctx, "rgba(255,255,255,0.85)", 3);
}

/** 나무 부두: 기둥 + 판자 + 드럼통 · 상자 */
export function pier(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.5) * 1000) + 91);
  for (let i = 0; i < 8; i++) {
    const x = -140 + i * 40;
    rrect(ctx, x - 4, -44, 8, 46, 2);
    fill(ctx, "#6b4420", x, -20, 4, 22, 1.2);
  }
  rrect(ctx, -150, -50, 300, 10, 2);
  fill(ctx, "#b07a44", 0, -45, 150, 5, 1.6);
  for (let i = 0; i < 15; i++) {
    ctx.beginPath();
    ctx.moveTo(-150 + i * 20, -50);
    ctx.lineTo(-150 + i * 20, -40);
    stroke(ctx, alpha("#5c3a18", 0.6), 1);
  }
  for (let i = 0; i < 4; i++) {
    const x = -120 + r() * 240;
    if (r() < 0.5) {
      rrect(ctx, x - 9, -72, 18, 22, 4);
      fill(ctx, i % 2 ? "#e84a3c" : "#2f86ea", x, -62, 9, 11, 1.4);
      ctx.beginPath();
      ctx.moveTo(x - 9, -66);
      ctx.lineTo(x + 9, -66);
      stroke(ctx, "#ffd23f", 2);
    } else {
      rrect(ctx, x - 11, -72, 22, 22, 2);
      fill(ctx, "#c8924f", x, -61, 11, 11, 1.4);
      ctx.beginPath();
      ctx.moveTo(x - 10, -71);
      ctx.lineTo(x + 10, -51);
      stroke(ctx, "#8a5a2a", 2);
    }
  }
  // 등불 기둥
  ctx.beginPath();
  ctx.moveTo(140, -50);
  ctx.lineTo(140, -100);
  stroke(ctx, "#4a2e1a", 3);
  rrect(ctx, 133, -112, 14, 14, 3);
  ctx.fillStyle = "#ffd98a";
  ctx.fill();
}

/** 보물섬: 모래 언덕 + 야자수 + 반짝이는 보물상자 */
export function treasureIsle(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.5) * 1000) + 101);
  const w = 150;
  ctx.beginPath();
  ctx.moveTo(-w, 2);
  ctx.bezierCurveTo(-w * 0.7, -50, w * 0.6, -56, w, 2);
  ctx.closePath();
  fill(ctx, "#f2d690", 0, -30, w, 30, 1.8);
  palm(ctx, -70, -26, 60, 0.3, 41);
  palm(ctx, 60, -26, 52, -0.35, 43);
  palm(ctx, -20, -40, 44, 0.1, 47);
  // 보물상자
  rrect(ctx, -6, -62, 40, 24, 3);
  fill(ctx, "#8a5a2a", 14, -50, 20, 12, 1.6);
  ctx.beginPath();
  ctx.moveTo(-6, -62);
  ctx.quadraticCurveTo(14, -78, 34, -62);
  ctx.closePath();
  fill(ctx, "#a36a34", 14, -68, 20, 8, 1.6);
  for (const x of [-6, 34]) {
    ctx.beginPath();
    ctx.moveTo(x, -62);
    ctx.lineTo(x, -38);
    stroke(ctx, "#ffd23f", 2.4);
  }
  for (let i = 0; i < 6; i++) {
    circ(ctx, -2 + r() * 34, -66 - r() * 4, 3);
    ctx.fillStyle = "#ffe14a";
    ctx.fill();
  }
  // 반짝
  ctx.fillStyle = "#ffffff";
  for (const [x, y, s] of [
    [6, -80, 5],
    [28, -74, 4],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.3, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.3, y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x, y + s * 0.3);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y - s * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  // 반쯤 묻힌 배 닻
  ctx.beginPath();
  ctx.moveTo(-110, -6);
  ctx.lineTo(-104, -30);
  stroke(ctx, "#4b5266", 3);
  ctx.beginPath();
  ctx.arc(-108, -12, 8, 0.2, Math.PI - 0.2);
  stroke(ctx, "#4b5266", 3);
}

/** 돌 요새 탑 (바위 위) */
export function fortTower(ctx) {
  smooth(ctx, [-70, 2, -64, -24, -30, -40, 30, -38, 66, -20, 72, 2], true, 0.3);
  fill(ctx, "#7f8899", 0, -20, 70, 22, 1.8);
  rrect(ctx, -34, -150, 68, 116, 4);
  fill(ctx, "#b8b0a0", -10, -90, 34, 58, 2);
  for (let y = -140; y < -40; y += 16)
    for (let x = -30 + ((y / 16) % 2 ? 8 : 0); x < 30; x += 20) {
      rrect(ctx, x, y, 18, 14, 2);
      stroke(ctx, alpha("#6b6458", 0.45), 1);
    }
  for (let i = 0; i < 4; i++) {
    rrect(ctx, -34 + i * 19, -164, 12, 16, 2);
    fill(ctx, "#b8b0a0", -28 + i * 19, -156, 6, 8, 1.4);
  }
  rrect(ctx, -8, -112, 16, 22, 6);
  ctx.fillStyle = "#2a2018";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -164);
  ctx.lineTo(0, -200);
  stroke(ctx, "#4a2e1a", 2.4);
  ctx.beginPath();
  ctx.moveTo(0, -200);
  ctx.lineTo(26, -192);
  ctx.lineTo(0, -184);
  ctx.closePath();
  ctx.fillStyle = "#b8282f";
  ctx.fill();
}

/* ---- 코스 안 장애물 (cm 단위) ---- */

/** 난파선 돛대: 비스듬히 물 밖으로 솟은 부러진 돛대 + 찢어진 돛 */
export function wreckMast(ctx) {
  ctx.beginPath();
  ctx.moveTo(-20, 6);
  ctx.lineTo(30, -260);
  ctx.lineTo(48, -256);
  ctx.lineTo(4, 6);
  ctx.closePath();
  fill(ctx, "#6b4420", 10, -120, 24, 130, 2.6);
  ctx.beginPath();
  ctx.moveTo(-50, -170);
  ctx.lineTo(110, -190);
  stroke(ctx, "#5c3a18", 9);
  ctx.beginPath();
  ctx.moveTo(-40, -164);
  ctx.quadraticCurveTo(20, -150, 96, -182);
  ctx.lineTo(80, -110);
  ctx.lineTo(60, -126);
  ctx.lineTo(40, -98);
  ctx.lineTo(10, -120);
  ctx.lineTo(-30, -104);
  ctx.closePath();
  fill(ctx, "#e2d2b0", 20, -140, 60, 40, 2);
  ctx.beginPath();
  ctx.moveTo(30, -260);
  ctx.lineTo(70, -250);
  ctx.lineTo(32, -236);
  ctx.closePath();
  ctx.fillStyle = "#1d2233";
  ctx.fill();
  ell(ctx, -6, 4, 70, 12);
  stroke(ctx, "rgba(255,255,255,0.85)", 4);
}

/** 산호 바위 장애물 (코스 안 · cm) */
export function reefHead(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.5) * 1000) + 111);
  smooth(ctx, [-110, 6, -100, -50, -40, -96, 30, -90, 90, -50, 110, 6], true, 0.3);
  fill(ctx, "#9a8f9e", -20, -50, 100, 56, 3);
  const cols = ["#ff7a9c", "#ffb347", "#b37aff", "#ff5a6e", "#5fd0c0"];
  for (let i = 0; i < 9; i++) {
    const x = -84 + r() * 168;
    const y = -20 - r() * 60;
    const c = cols[i % cols.length];
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (k - 1) * 10, y - 18, x + (k - 1) * 16, y - 26 - r() * 10);
      stroke(ctx, lineOf(c), 9);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (k - 1) * 10, y - 18, x + (k - 1) * 16, y - 26 - r() * 10);
      stroke(ctx, c, 6);
    }
  }
  ell(ctx, 0, 4, 114, 14);
  stroke(ctx, "rgba(255,255,255,0.85)", 4);
}

void pirateHat;
void shadow;
void dot;
void mix;
void lighten;
void linear;
void radial;
void flat;
void gloss;
void ell;
