/*
 * 제트스키 썬더 레이스 — 코스 09~12 풍경 · 장애물
 *  아이스 오션: 빙산(장애물) · 얼음 조각(장애물) · 빙하 절벽 · 펭귄 얼음섬
 *  딥씨 채널: 거대 산호 기둥 · 산호 아치(터널, 코스 폭에 맞춤)
 *  그랜드 오션 GP: 관중석 · GP 기구(비행선)
 * 그림 좌표: 풍경 dm(1=10cm) · 장애물 cm, (0,0) = 물 표면 가운데.
 */
import { TAU, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, smooth, fill, flat, stroke, gloss, dot } from "../../ocean-blaster/art/kit.js?v=3";
import { seeded } from "../js/view.js?v=2";

/* ================= 아이스 오션 ================= */

/** 빙산 (코스 안 큰 장애물 · cm): 각진 얼음 + 푸른 그늘 + 반짝 */
export function iceberg(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.5) * 1000) + 201);
  const pts = [-330, 10, -300, -120, -220, -250, -120, -330, -20, -300, 60, -420, 160, -320, 260, -200, 330, 10];
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] + (r() - 0.5) * 30, pts[i + 1] + (r() - 0.5) * 30);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `ib${o.v}`, -200, -400, 200, 0, [
    [0, "#ffffff"],
    [0.5, "#dff4ff"],
    [1, "#9fd6f2"],
  ]);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#6aaed6";
  ctx.lineJoin = "round";
  ctx.stroke();
  // 각진 면 (그늘)
  ctx.fillStyle = "rgba(120,190,230,0.45)";
  ctx.beginPath();
  ctx.moveTo(60, -420);
  ctx.lineTo(160, -320);
  ctx.lineTo(260, -200);
  ctx.lineTo(330, 10);
  ctx.lineTo(80, 10);
  ctx.lineTo(40, -200);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-220, -250);
  ctx.lineTo(-120, -330);
  ctx.lineTo(-20, -300);
  ctx.lineTo(60, -420);
  ctx.stroke();
  // 물에 잠긴 부분 (청록)
  ctx.fillStyle = "rgba(60,170,210,0.35)";
  ctx.fillRect(-340, -30, 680, 40);
  ell(ctx, 0, 6, 350, 26);
  stroke(ctx, "rgba(255,255,255,0.9)", 6);
}

/** 얼음 조각 (작은 장애물 · cm) */
export function iceChunk(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.5) * 1000) + 211);
  ctx.beginPath();
  ctx.moveTo(-120, 6);
  ctx.lineTo(-100 + r() * 20, -60);
  ctx.lineTo(-30, -96 - r() * 20);
  ctx.lineTo(50, -80);
  ctx.lineTo(110, -40);
  ctx.lineTo(120, 6);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, "ic", -60, -100, 60, 0, [
    [0, "#ffffff"],
    [1, "#a8dcf4"],
  ]);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#6aaed6";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-30, -96);
  ctx.lineTo(0, -20);
  ctx.lineTo(110, -40);
  stroke(ctx, "rgba(120,190,230,0.6)", 3);
  ell(ctx, 0, 6, 126, 14);
  stroke(ctx, "rgba(255,255,255,0.9)", 4);
}

/** 빙하 절벽 (풍경 · dm) */
export function glacier(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.4) * 1000) + 221);
  const w = 300 + r() * 80;
  const h = 120 + r() * 70;
  ctx.beginPath();
  ctx.moveTo(-w, 4);
  let x = -w;
  while (x < w) {
    const nx = x + 24 + r() * 40;
    ctx.lineTo(x + 8, -h * (0.7 + r() * 0.3));
    ctx.lineTo(nx, -h * (0.65 + r() * 0.35));
    x = nx;
  }
  ctx.lineTo(w, 4);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `gl${w}`, 0, -h, 0, 0, [
    [0, "#ffffff"],
    [0.6, "#d6efff"],
    [1, "#8ccbea"],
  ]);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#7ab8dc";
  ctx.stroke();
  // 세로 균열 (푸른 그늘)
  for (let i = 0; i < 12; i++) {
    const xx = -w + r() * w * 2;
    ctx.beginPath();
    ctx.moveTo(xx, -h * (0.5 + r() * 0.4));
    ctx.lineTo(xx + (r() - 0.5) * 10, 0);
    stroke(ctx, "rgba(90,160,210,0.45)", 3 + r() * 3);
  }
  // 눈 덮인 꼭대기
  ctx.beginPath();
  ctx.moveTo(-w, -h * 0.8);
  ctx.quadraticCurveTo(0, -h * 1.05, w, -h * 0.8);
  stroke(ctx, "#ffffff", 8);
}

/** 펭귄 얼음섬 (풍경 · dm) */
export function penguinFloe(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.4) * 1000) + 231);
  const w = 70 + r() * 30;
  ctx.beginPath();
  ctx.moveTo(-w, 2);
  ctx.lineTo(-w * 0.9, -12);
  ctx.lineTo(w * 0.85, -14);
  ctx.lineTo(w, 2);
  ctx.closePath();
  ctx.fillStyle = "#f2fbff";
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#8ccbea";
  ctx.stroke();
  ctx.fillStyle = "rgba(120,190,230,0.5)";
  ctx.fillRect(-w, -3, w * 2, 5);
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = -w * 0.6 + i * (w * 1.2) / Math.max(1, n - 1) + (r() - 0.5) * 8;
    const s = 0.8 + r() * 0.4;
    ell(ctx, x, -24 * s, 7 * s, 11 * s);
    ctx.fillStyle = "#1d2433";
    ctx.fill();
    ell(ctx, x + 1, -22 * s, 4.6 * s, 8 * s);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    circ(ctx, x, -36 * s, 5 * s);
    ctx.fillStyle = "#1d2433";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 4 * s, -36 * s);
    ctx.lineTo(x + 9 * s, -35 * s);
    ctx.lineTo(x + 4 * s, -34 * s);
    ctx.closePath();
    ctx.fillStyle = "#ffb02e";
    ctx.fill();
    dot(ctx, x + 2 * s, -37.5 * s, 1 * s, "#ffffff");
  }
}

/* ================= 딥씨 채널 ================= */

/** 거대 산호 기둥 (풍경 · dm): 물 밖으로 솟은 가지 산호 + 빛나는 점 */
export function coralSpire(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.4) * 1000) + 241);
  const cols = ["#ff6fa5", "#a86bff", "#ff9a4a", "#3fd6c6"];
  const c = cols[Math.floor(r() * cols.length)];
  const h = 160 + r() * 120;
  const branch = (x, y, len, a, wdt, depth) => {
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + x2) / 2 + Math.cos(a + 1.4) * len * 0.15, (y + y2) / 2, x2, y2);
    stroke(ctx, lineOf(c), wdt + 4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + x2) / 2 + Math.cos(a + 1.4) * len * 0.15, (y + y2) / 2, x2, y2);
    stroke(ctx, c, wdt);
    if (depth > 0) {
      branch(x2, y2, len * 0.7, a - 0.45 - r() * 0.2, wdt * 0.7, depth - 1);
      branch(x2, y2, len * 0.65, a + 0.45 + r() * 0.2, wdt * 0.7, depth - 1);
    } else {
      circ(ctx, x2, y2, wdt * 0.9);
      ctx.fillStyle = lighten(c, 0.4);
      ctx.fill();
    }
  };
  branch(0, 4, h * 0.45, -Math.PI / 2 + (r() - 0.5) * 0.2, 22, 3);
  // 빛나는 점 (심해 생물 빛)
  for (let i = 0; i < 10; i++) {
    const x = (r() - 0.5) * h * 0.8;
    const y = -r() * h;
    circ(ctx, x, y, 3);
    ctx.fillStyle = "rgba(170,255,240,0.9)";
    ctx.fill();
  }
  ell(ctx, 0, 2, 40, 6);
  stroke(ctx, "rgba(200,240,255,0.6)", 2);
}

/** 산호 아치 (터널 · cm): 코스 폭에 맞춰 양쪽 기둥 + 위쪽 가지 아치 */
export function coralArch(ctx, span) {
  const half = span / 2;
  const top = -760;
  const c = "#7a4ab0";
  const c2 = "#ff6fa5";
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    ctx.moveTo(-half, 10);
    ctx.bezierCurveTo(-half - 40, top * 0.6, -half * 0.6, top * 1.15, 0, top * 1.1);
    ctx.bezierCurveTo(half * 0.6, top * 1.15, half + 40, top * 0.6, half, 10);
    stroke(ctx, pass ? c : lineOf(c), pass ? 120 : 136);
  }
  // 아치 위 산호 가지 · 혹
  for (let i = 0; i < 18; i++) {
    const u = i / 17;
    const a = Math.PI * (1 - u);
    const x = Math.cos(a) * half * 1.02;
    const y = 10 + Math.sin(a) * top * 1.04 * (u > 0.08 && u < 0.92 ? 1 : 0.8);
    circ(ctx, x, y, 26 + (i % 3) * 10);
    ctx.fillStyle = i % 2 ? c2 : "#a86bff";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = lineOf(c);
    ctx.stroke();
    if (i % 3 === 0) {
      circ(ctx, x, y, 8);
      ctx.fillStyle = "rgba(170,255,240,0.95)";
      ctx.fill();
    }
  }
  for (const s of [-1, 1]) {
    ell(ctx, s * half, 14, 120, 24);
    stroke(ctx, "rgba(200,240,255,0.7)", 6);
  }
}

/* ================= 그랜드 오션 GP ================= */

/** 물 위 관중석 (풍경 · dm): 계단식 좌석 + 알록달록 관중 + 깃발 + 지붕 */
export function grandstand(ctx, o = {}) {
  const r = seeded(Math.floor((o.v || 0.4) * 1000) + 251);
  const w = 260;
  // 부유 받침
  rrect(ctx, -w, -16, w * 2, 18, 4);
  fill(ctx, "#e6ecf4", 0, -8, w, 9, 1.6);
  // 계단 좌석 5단
  for (let k = 0; k < 5; k++) {
    const y = -16 - k * 22;
    rrect(ctx, -w + k * 14, y - 22, (w - k * 14) * 2, 22, 2);
    ctx.fillStyle = k % 2 ? "#3a64b8" : "#2f56a0";
    ctx.fill();
    // 관중
    for (let x = -w + k * 14 + 8; x < w - k * 14 - 6; x += 11) {
      const c = ["#ff5a6e", "#ffd23f", "#4fd1c5", "#ffffff", "#ff9f43", "#7c83fd", "#5be37d"][Math.floor(r() * 7)];
      circ(ctx, x, y - 14 - (r() < 0.3 ? 4 : 0), 4.2);
      ctx.fillStyle = "#ffd5b3";
      ctx.fill();
      rrect(ctx, x - 4.5, y - 10, 9, 9, 2);
      ctx.fillStyle = c;
      ctx.fill();
      if (r() < 0.25) {
        ctx.beginPath();
        ctx.moveTo(x + 3, y - 12);
        ctx.lineTo(x + 7, y - 26);
        stroke(ctx, "#ffffff", 1.4);
        rrect(ctx, x + 4, y - 32, 10, 7, 1);
        ctx.fillStyle = c;
        ctx.fill();
      }
    }
  }
  // 지붕
  ctx.beginPath();
  ctx.moveTo(-w + 50, -150);
  ctx.quadraticCurveTo(0, -196, w - 50, -150);
  ctx.lineTo(w - 50, -138);
  ctx.quadraticCurveTo(0, -182, -w + 50, -138);
  ctx.closePath();
  fill(ctx, "#ffffff", 0, -160, w, 20, 2);
  for (const x of [-w + 60, 0, w - 60]) {
    ctx.beginPath();
    ctx.moveTo(x, -138);
    ctx.lineTo(x, -112);
    stroke(ctx, "#cfd8e6", 3);
  }
  // 깃발 줄
  for (let i = 0; i < 9; i++) {
    const x = -w + 30 + i * ((w * 2 - 60) / 8);
    ctx.beginPath();
    ctx.moveTo(x, -178 + Math.abs(i - 4) * 4);
    ctx.lineTo(x, -214 + Math.abs(i - 4) * 4);
    stroke(ctx, "#ffffff", 1.6);
    ctx.beginPath();
    ctx.moveTo(x, -214 + Math.abs(i - 4) * 4);
    ctx.lineTo(x + 16, -208 + Math.abs(i - 4) * 4);
    ctx.lineTo(x, -202 + Math.abs(i - 4) * 4);
    ctx.closePath();
    ctx.fillStyle = ["#ff4f6d", "#ffd23f", "#13b5a8"][i % 3];
    ctx.fill();
  }
  // GP 현수막
  rrect(ctx, -110, -134, 220, 26, 6);
  ctx.fillStyle = "#1d2a44";
  ctx.fill();
  ctx.font = '20px "Bagel Fat One", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffd23f";
  ctx.fillText("GRAND OCEAN GP", 0, -120);
}

/** GP 비행선 (하늘에 그려 넣는 용) */
export function blimp(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ell(ctx, 0, 0, 60, 20);
  fill(ctx, "#f2f4f8", -10, -6, 60, 20, 1.6);
  ctx.beginPath();
  ctx.moveTo(-52, -6);
  ctx.lineTo(-72, -20);
  ctx.lineTo(-66, 0);
  ctx.lineTo(-72, 18);
  ctx.lineTo(-52, 6);
  ctx.closePath();
  ctx.fillStyle = "#ff4f6d";
  ctx.fill();
  rrect(ctx, -12, 18, 24, 8, 3);
  ctx.fillStyle = "#3a4560";
  ctx.fill();
  ctx.font = '11px "Bagel Fat One", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1d2a6a";
  ctx.fillText("TODAY GP", 2, 1);
  ctx.restore();
}

void mix;
void darken;
void alpha;
void radial;
void flat;
void gloss;
