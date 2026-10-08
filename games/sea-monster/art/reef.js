/*
 * 바다괴물 탐험대 — 바닷속 풍경 그림 (산호초 · 바위 · 해초 · 모래 · 먼 실루엣)
 *
 * 좌표: (0,0) = 물건이 바닥에 닿는 가운데, 위가 -y. 1 = 1px.
 * 빛은 물 위(위쪽)에서 온다 → 윗면이 밝고 아랫면이 어둡다, 외곽선은 그 색의 진한 색.
 * 움직이지 않는 것은 sprites.js 가 캐시해서 쓴다. (s = 크기 배율, rnd = 씨앗 난수)
 */
import { TAU, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, smooth, fill, flat, stroke, gloss, shadow } from "../../ocean-blaster/art/kit.js?v=3";

const R2 = (v) => Math.round(v);

/** 위에서 빛 받은 세로 그라데이션 */
function topLit(ctx, base, y0, y1, k = 1) {
  return linear(ctx, `tl${base}|${R2(y0)}|${R2(y1)}|${k}`, 0, y0, 0, y1, [
    [0, lighten(base, 0.3 * k)],
    [0.45, base],
    [1, darken(base, 0.35 * k)],
  ]);
}

/* ================================================================
 * 바위
 * ============================================================== */
export function rock(ctx, s = 1, rnd = Math.random, o = {}) {
  const base = o.color || "#7d8fa6";
  const w = 70 * s;
  const h = 52 * s;
  // 둥글둥글 울퉁불퉁한 덩어리 (점 몇 개를 매끄럽게)
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    const rr = 0.82 + rnd() * 0.26;
    pts.push(Math.cos(a) * w * rr, Math.sin(a) * h * rr * (i === 0 || i === n ? 0.1 : 1));
  }
  ctx.beginPath();
  ctx.moveTo(-w, 4);
  for (let i = 0; i < pts.length; i += 2) {
    const nx = pts[i + 2] ?? w;
    const ny = pts[i + 3] ?? 4;
    ctx.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + nx) / 2, (pts[i + 1] + ny) / 2);
  }
  ctx.lineTo(w, 4);
  ctx.quadraticCurveTo(0, 12 * s, -w, 4);
  ctx.closePath();
  ctx.fillStyle = topLit(ctx, base, -h, 6);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = lineOf(base);
  ctx.stroke();
  // 면 나눔 (어두운 갈라진 틈 · 밝은 모서리)
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 3; i++) {
    const x = (rnd() - 0.5) * w * 1.2;
    const y = -h * (0.25 + rnd() * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rnd() - 0.5) * 20 * s, y + 14 * s, x + (rnd() - 0.5) * 24 * s, y + 30 * s);
    stroke(ctx, alpha(darken(base, 0.45), 0.5), 2.2);
  }
  // 윗면 이끼 (초록 · 분홍 반점)
  for (let i = 0; i < 7; i++) {
    const x = (rnd() - 0.5) * w * 1.4;
    const y = -h * (0.55 + rnd() * 0.4);
    ell(ctx, x, y, (4 + rnd() * 7) * s, (2.5 + rnd() * 3) * s);
    ctx.fillStyle = alpha(rnd() < 0.5 ? "#7fd18a" : "#ff9ec4", 0.55);
    ctx.fill();
  }
  // 아래쪽 바닥 그늘
  ctx.fillStyle = alpha("#0b2a4a", 0.28);
  ctx.fillRect(-w, -h * 0.18, w * 2, h);
  ctx.restore();
  gloss(ctx, -w * 0.35, -h * 0.72, w * 0.32, h * 0.12, 0.45, -0.15);
}

/* ================================================================
 * 산호
 * ============================================================== */
/** 나뭇가지 산호: 가지가 갈라지며 위로, 끝은 밝은 폴립 */
export function branchCoral(ctx, s = 1, rnd = Math.random, o = {}) {
  const base = o.color || "#ff7aa2";
  const tip = lighten(base, 0.45);
  const segs = [];
  const grow = (x, y, a, len, w, d) => {
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    segs.push([x, y, x2, y2, w, d]);
    if (d < 3) {
      const k = 2 + (rnd() < 0.35 ? 1 : 0);
      for (let i = 0; i < k; i++) {
        const na = a + (i - (k - 1) / 2) * (0.55 + rnd() * 0.25) + (rnd() - 0.5) * 0.2;
        grow(x2, y2, na, len * (0.68 + rnd() * 0.14), w * 0.72, d + 1);
      }
    }
  };
  grow(0, 0, -Math.PI / 2 + (rnd() - 0.5) * 0.2, 34 * s, 11 * s, 0);
  // 외곽선 → 몸 → 밝은 위쪽
  ctx.lineCap = "round";
  for (const [x, y, x2, y2, w] of segs) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = w + 4;
    ctx.strokeStyle = lineOf(base);
    ctx.stroke();
  }
  for (const [x, y, x2, y2, w] of segs) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = w;
    ctx.strokeStyle = base;
    ctx.stroke();
  }
  for (const [x, y, x2, y2, w] of segs) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.18, y);
    ctx.lineTo(x2 - w * 0.18, y2);
    ctx.lineWidth = w * 0.3;
    ctx.strokeStyle = alpha(lighten(base, 0.4), 0.7);
    ctx.stroke();
  }
  // 가지 끝 폴립
  for (const [, , x2, y2, w, d] of segs) {
    if (d < 2) continue;
    circ(ctx, x2, y2, w * 0.62 + 1);
    ctx.fillStyle = tip;
    ctx.fill();
    circ(ctx, x2 - w * 0.15, y2 - w * 0.15, w * 0.25);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fill();
  }
}

/** 뇌 산호: 둥근 돔 + 구불구불 홈 */
export function brainCoral(ctx, s = 1, rnd = Math.random, o = {}) {
  const base = o.color || "#ffb347";
  const w = 46 * s;
  const h = 36 * s;
  ctx.beginPath();
  ctx.moveTo(-w, 2);
  ctx.bezierCurveTo(-w * 1.02, -h * 1.1, w * 1.02, -h * 1.1, w, 2);
  ctx.quadraticCurveTo(0, 8 * s, -w, 2);
  ctx.closePath();
  ctx.fillStyle = topLit(ctx, base, -h, 4);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = lineOf(base);
  ctx.stroke();
  ctx.save();
  ctx.clip();
  // 구불구불 홈
  for (let row = 0; row < 6; row++) {
    const y = -h * 0.82 + row * h * 0.16;
    ctx.beginPath();
    const wav = 5 + rnd() * 3;
    for (let x = -w; x <= w; x += 4) {
      const yy = y + Math.sin(x / wav + row * 1.7) * 3.2 * s + Math.cos(x / 13 + row) * 1.5;
      if (x === -w) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    stroke(ctx, alpha(darken(base, 0.4), 0.55), 2);
  }
  ctx.fillStyle = alpha("#0b2a4a", 0.22);
  ctx.fillRect(-w, -h * 0.2, w * 2, h);
  ctx.restore();
  gloss(ctx, -w * 0.3, -h * 0.7, w * 0.36, h * 0.13, 0.5, -0.1);
}

/** 부채 산호: 그물 무늬 부채 */
export function fanCoral(ctx, s = 1, rnd = Math.random, o = {}) {
  const base = o.color || "#b066ff";
  const w = 50 * s;
  const h = 78 * s;
  ctx.beginPath();
  ctx.moveTo(-4 * s, 0);
  ctx.bezierCurveTo(-w * 1.15, -h * 0.35, -w * 0.9, -h * 1.1, 0, -h);
  ctx.bezierCurveTo(w * 0.9, -h * 1.1, w * 1.15, -h * 0.35, 4 * s, 0);
  ctx.closePath();
  ctx.fillStyle = alpha(base, 0.9);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = lineOf(base);
  ctx.stroke();
  ctx.save();
  ctx.clip();
  // 줄기 (부채살)
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a) * h * 0.5, Math.sin(a) * h * 0.5 - 6, Math.cos(a) * h * 1.2, Math.sin(a) * h * 1.2);
    stroke(ctx, alpha(darken(base, 0.35), 0.75), 2.2);
  }
  // 그물 (가로 물결)
  for (let k = 1; k < 7; k++) {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i - 6) * 0.15;
      const rr = (k / 7) * h * (1 + Math.sin(i * 1.3 + k) * 0.03);
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    stroke(ctx, alpha(lighten(base, 0.35), 0.55), 1.4);
  }
  ctx.restore();
  // 굵은 밑동
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(0, -h * 0.25);
  stroke(ctx, darken(base, 0.3), 6 * s);
}

/** 탁자 산호: 넓은 판이 층층이 */
export function tableCoral(ctx, s = 1, rnd = Math.random, o = {}) {
  const base = o.color || "#5fd3a8";
  // 기둥
  rrect(ctx, -7 * s, -30 * s, 14 * s, 32 * s, 6 * s);
  ctx.fillStyle = darken(base, 0.25);
  ctx.fill();
  const layers = [
    [-36 * s, 58 * s, 13 * s],
    [-52 * s, 42 * s, 11 * s],
  ];
  for (const [y, w, th] of layers) {
    ctx.beginPath();
    ctx.moveTo(-w, y + th * 0.4);
    ctx.quadraticCurveTo(-w * 1.05, y - th, 0, y - th * 1.1);
    ctx.quadraticCurveTo(w * 1.05, y - th, w, y + th * 0.4);
    ctx.quadraticCurveTo(0, y + th, -w, y + th * 0.4);
    ctx.closePath();
    ctx.fillStyle = topLit(ctx, base, y - th, y + th);
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = lineOf(base);
    ctx.stroke();
    // 윗면 점무늬 (폴립)
    for (let i = 0; i < 9; i++) {
      const x = (rnd() - 0.5) * w * 1.6;
      circ(ctx, x, y - th * 0.55 + Math.abs(x / w) * th * 0.3, 1.6 * s);
      ctx.fillStyle = alpha(lighten(base, 0.6), 0.9);
      ctx.fill();
    }
    // 판 아래 그늘
    ctx.beginPath();
    ctx.moveTo(-w * 0.9, y + th * 0.45);
    ctx.quadraticCurveTo(0, y + th * 1.05, w * 0.9, y + th * 0.45);
    stroke(ctx, alpha("#0b2a4a", 0.3), 3);
  }
}

/** 관 해면: 굵은 관 여러 개, 위에 구멍 */
export function tubeSponge(ctx, s = 1, rnd = Math.random, o = {}) {
  const base = o.color || "#ffd23f";
  const tubes = [
    [-16, 52, 13],
    [2, 70, 15],
    [20, 44, 12],
  ];
  for (const [x, h, w] of tubes) {
    const X = x * s;
    const Hh = h * s;
    const Wd = w * s;
    rrect(ctx, X - Wd, -Hh, Wd * 2, Hh, Wd * 0.9);
    ctx.fillStyle = linear(ctx, `tube${base}|${R2(Wd)}`, X - Wd, 0, X + Wd, 0, [
      [0, lighten(base, 0.25)],
      [0.5, base],
      [1, darken(base, 0.3)],
    ]);
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = lineOf(base);
    ctx.stroke();
    ell(ctx, X, -Hh + 3 * s, Wd * 0.7, Wd * 0.32);
    ctx.fillStyle = darken(base, 0.6);
    ctx.fill();
    // 겉면 구멍 점
    for (let i = 0; i < 4; i++) {
      circ(ctx, X + (rnd() - 0.5) * Wd, -Hh * (0.2 + rnd() * 0.6), 1.5 * s);
      ctx.fillStyle = alpha(darken(base, 0.4), 0.6);
      ctx.fill();
    }
  }
}

/* ================================================================
 * 움직이는 것 (매 프레임): 말미잘 · 해초 · 다시마
 * ============================================================== */
/** 말미잘: 촉수가 물결에 흔들린다 */
export function anemone(ctx, x, y, s, t, o = {}) {
  const base = o.color || "#ff6f91";
  const tipC = o.tip || "#ffe3ef";
  ctx.save();
  ctx.translate(x, y);
  // 몸통
  rrect(ctx, -14 * s, -16 * s, 28 * s, 18 * s, 8 * s);
  ctx.fillStyle = darken(base, 0.2);
  ctx.fill();
  const n = 13;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const a = -Math.PI / 2 + (u - 0.5) * 2.2;
    const sw = Math.sin(t * 1.6 + i * 0.6 + x * 0.01) * 0.25;
    const len = (24 + Math.sin(i * 2.3) * 6) * s;
    const x1 = Math.cos(a) * 10 * s;
    const y1 = -14 * s;
    const x2 = x1 + Math.cos(a + sw) * len;
    const y2 = y1 + Math.sin(a + sw) * len;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x1 + Math.cos(a) * len * 0.6, y1 + Math.sin(a) * len * 0.6, x2, y2);
    ctx.lineCap = "round";
    ctx.lineWidth = 6 * s;
    ctx.strokeStyle = lineOf(base);
    ctx.stroke();
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = base;
    ctx.stroke();
    circ(ctx, x2, y2, 2.6 * s);
    ctx.fillStyle = tipC;
    ctx.fill();
  }
  ctx.restore();
}

/** 해초 한 포기: 아래는 고정, 위로 갈수록 크게 흔들림 */
export function seaweed(ctx, x, y, h, t, o = {}) {
  const base = o.color || "#3fbf6a";
  const w = o.w || 9;
  const sway = o.sway == null ? 1 : o.sway;
  const n = Math.max(7, Math.min(36, Math.round(h / 45)));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const big = Math.min(3, h / 180);
    const off = Math.sin(t * 1.3 + u * 2.6 * big + x * 0.013) * 14 * u * u * sway * Math.sqrt(big) + Math.sin(t * 0.7 + x) * 4 * u * sway;
    pts.push([x + off, y - u * h]);
  }
  // 리본 모양 (양쪽 가장자리를 따로)
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const ww = w * (1 - u * 0.75) * (1 + Math.sin(u * 9 + t) * 0.12);
    const [px, py] = pts[i];
    if (i === 0) ctx.moveTo(px - ww, py);
    else ctx.lineTo(px - ww, py);
  }
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    const ww = w * (1 - u * 0.75) * (1 + Math.sin(u * 9 + t) * 0.12);
    const [px, py] = pts[i];
    ctx.lineTo(px + ww, py);
  }
  ctx.closePath();
  ctx.fillStyle = base;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = lineOf(base);
  ctx.stroke();
  // 가운데 잎맥
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  stroke(ctx, alpha(lighten(base, 0.35), 0.7), 1.6);
  return pts;
}

/** 큰 다시마 (자이언트 켈프): 가는 줄기 + 길게 늘어진 잎 + 노란 공기주머니 */
export function kelp(ctx, x, y, h, t, o = {}) {
  const base = o.color || "#6f9a3a";
  const n = Math.max(7, Math.min(36, Math.round(h / 45)));
  const big = Math.min(3, h / 180);
  const pts = [];
  // 포기마다 다른 기울기 · 굽음 (곧은 대나무처럼 보이지 않게)
  const lean = (Math.sin(x * 12.9898) * 43758.5453) % 1;
  const bend = (Math.sin(x * 78.233) * 12345.678) % 1;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const shape = lean * 70 * u + Math.sin(u * Math.PI * (1.2 + Math.abs(bend))) * 40 * bend * Math.min(1, big);
    const off = Math.sin(t * 0.9 + u * 2.2 * big + x * 0.013) * 18 * u * u * Math.sqrt(big) + Math.sin(t * 0.55 + x + u * 3) * 7 * u;
    pts.push([x + shape + off, y - u * h]);
  }
  // 줄기
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = lineOf(base);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = darken(base, 0.1);
  ctx.stroke();
  // 잎 (마디마다 양쪽으로 번갈아, 물결 따라 펄럭)
  const leaf = lighten(base, 0.08);
  for (let i = 1; i <= n; i++) {
    if (i % 2 === 0 && i !== n) continue;
    const [px, py] = pts[i];
    const side = ((i + 1) / 2) % 2 ? 1 : -1;
    const u = i / n;
    const fl = Math.sin(t * 1.6 + i * 0.9 + x * 0.02) * 0.3;
    const len = 62 + ((i * 37) % 29) + u * 16;
    const wv = Math.sin(t * 2.2 + i) * 6;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(side * (0.75 + fl) - 0.15);
    // 물결처럼 구불거리는 긴 잎 (끝이 살짝 처진다)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(side * 16, -len * 0.3, side * -6 + wv, -len * 0.62, side * 10 + wv, -len);
    ctx.bezierCurveTo(side * 2 + wv, -len * 0.7, side * -14, -len * 0.35, 0, 0);
    ctx.closePath();
    ctx.fillStyle = i % 3 ? leaf : lighten(base, 0.18);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = lineOf(base);
    ctx.stroke();
    // 공기주머니
    ctx.beginPath();
    ctx.arc(side * 1.5, -3, 3.2, 0, TAU);
    ctx.fillStyle = "#d9c45a";
    ctx.fill();
    ctx.restore();
  }
}

/* ================================================================
 * 바닥 장식 (작게): 조개 · 불가사리 · 소라 · 성게 껍데기
 * ============================================================== */
export function shell(ctx, s = 1, rnd = Math.random) {
  const c = ["#ffd9c2", "#fff0d6", "#ffc0d0"][Math.floor(rnd() * 3)];
  ctx.beginPath();
  ctx.moveTo(-10 * s, 0);
  ctx.quadraticCurveTo(-11 * s, -12 * s, 0, -13 * s);
  ctx.quadraticCurveTo(11 * s, -12 * s, 10 * s, 0);
  ctx.closePath();
  fill(ctx, c, -2, -8 * s, 10 * s, 8 * s, 1.8);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(i * 4.5 * s, -11 * s);
    stroke(ctx, alpha(darken(c, 0.35), 0.6), 1.2);
  }
}

export function starfish(ctx, s = 1, rnd = Math.random) {
  const c = rnd() < 0.5 ? "#ff8a3d" : "#ff5f8a";
  const rot = rnd() * TAU;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = (i % 2 ? 5 : 13) * s;
    const a = rot + (i / 10) * TAU;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.55 - 5 * s);
  }
  ctx.closePath();
  fill(ctx, c, -2, -7 * s, 12 * s, 7 * s, 1.8);
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * TAU;
    circ(ctx, Math.cos(a) * 7 * s, Math.sin(a) * 4 * s - 5 * s, 1.1 * s);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fill();
  }
}

/* ================================================================
 * 먼 배경 실루엣 (물빛에 녹아든 단색) — color = 그 깊이의 물빛보다 조금 진한 색
 * ============================================================== */
/** 먼 산호초 능선 (가로로 긴 덩어리 + 산호 돌기) */
export function farRidge(ctx, w, h, color, rnd = Math.random, top = 0.6) {
  // 능선 윗선을 먼저 정하고 (산호 가지를 그 위에 꽂는다)
  const pts = [];
  let x = 0;
  while (x <= w + 100) {
    pts.push([x, h * (0.12 + rnd() * 0.42) * top + h * (1 - top) * 0.12]);
    x += 50 + rnd() * 80;
  }
  const yAt = (xx) => {
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][0] >= xx) {
        const k = (xx - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * (0.5 - Math.cos(k * Math.PI) / 2);
      }
    }
    return pts[pts.length - 1][1];
  };
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let xx = 0; xx <= w; xx += 8) ctx.lineTo(xx, yAt(xx));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let i = 0; i < w / 70; i++) {
    const bx = rnd() * w;
    const by = yAt(bx) + 6;
    const len = 18 + rnd() * 26;
    ctx.lineWidth = 4 + rnd() * 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by - len);
    ctx.moveTo(bx, by - len * 0.5);
    ctx.lineTo(bx - 10, by - len * 0.85);
    ctx.moveTo(bx, by - len * 0.6);
    ctx.lineTo(bx + 10, by - len * 0.95);
    ctx.stroke();
  }
}

/** 먼 바위 아치 */
export function farArch(ctx, w, h, color) {
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.bezierCurveTo(w * 0.02, h * 0.2, w * 0.25, -h * 0.05, w * 0.5, 0);
  ctx.bezierCurveTo(w * 0.75, -h * 0.05, w * 0.98, h * 0.2, w, h);
  ctx.lineTo(w * 0.8, h);
  ctx.bezierCurveTo(w * 0.78, h * 0.45, w * 0.62, h * 0.32, w * 0.5, h * 0.32);
  ctx.bezierCurveTo(w * 0.38, h * 0.32, w * 0.22, h * 0.45, w * 0.2, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** 지나가는 큰 생물 그림자: 쥐가오리 */
export function mantaShadow(ctx, s, t, color) {
  const flap = Math.sin(t * 1.4) * 0.35;
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(60, 0);
  ctx.quadraticCurveTo(30, -10, 0, -60 - flap * 60);
  ctx.quadraticCurveTo(-10, -20, -30, -6);
  ctx.lineTo(-90, 0);
  ctx.lineTo(-30, 6);
  ctx.quadraticCurveTo(-10, 20, 0, 60 + flap * 60);
  ctx.quadraticCurveTo(30, 10, 60, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** 지나가는 큰 생물 그림자: 고래상어 */
export function whaleShadow(ctx, s, t, color) {
  const sw = Math.sin(t * 1.1) * 0.15;
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(150, 0);
  ctx.quadraticCurveTo(140, -34, 60, -40);
  ctx.quadraticCurveTo(20, -66, 0, -40);
  ctx.quadraticCurveTo(-80, -30, -150, -6);
  ctx.lineTo(-200, -40 + sw * 100);
  ctx.lineTo(-190, 0);
  ctx.lineTo(-210, 34 + sw * 100);
  ctx.lineTo(-150, 6);
  ctx.quadraticCurveTo(-60, 34, 40, 30);
  ctx.lineTo(30, 60);
  ctx.lineTo(70, 30);
  ctx.quadraticCurveTo(140, 28, 150, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** 작은 물고기 한 마리 (앞쪽 · 장식 떼) */
export function smallFish(ctx, x, y, s, t, color, face = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * s, s);
  const wig = Math.sin(t * 14) * 0.3;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.quadraticCurveTo(4, -7, -8, -2);
  ctx.lineTo(-15, -7 + wig * 6);
  ctx.lineTo(-13, 0);
  ctx.lineTo(-15, 7 + wig * 6);
  ctx.lineTo(-8, 2);
  ctx.quadraticCurveTo(4, 7, 12, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  circ(ctx, 6, -1.5, 1.4);
  ctx.fillStyle = "rgba(10,20,40,0.85)";
  ctx.fill();
  ctx.restore();
}

/** 바닥 모래 언덕 띠 (가로로 긴 스프라이트): 위로 볼록한 모래 + 잔물결 무늬 */
export function sandStrip(ctx, w, h, rnd = Math.random, o = {}) {
  const base = o.color || "#f3d9a4";
  ctx.beginPath();
  ctx.moveTo(0, h);
  const pts = [];
  for (let x = 0; x <= w; x += 40) pts.push([x, 16 + Math.sin(x / 90 + 1) * 10 + rnd() * 6]);
  ctx.lineTo(0, pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [qx, qy] = pts[i];
    ctx.quadraticCurveTo(px + 20, py - 4, (px + qx) / 2, (py + qy) / 2);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `sand${base}|${h}`, 0, 0, 0, h, [
    [0, lighten(base, 0.2)],
    [0.25, base],
    [1, darken(base, 0.45)],
  ]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = lineOf(base);
  ctx.stroke();
  ctx.save();
  ctx.clip();
  // 모래 물결 무늬
  for (let i = 0; i < w / 26; i++) {
    const x = rnd() * w;
    const y = 30 + rnd() * (h - 40);
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.quadraticCurveTo(x, y - 4, x + 14, y);
    stroke(ctx, alpha(darken(base, 0.25), 0.4), 1.6);
  }
  // 작은 자갈
  for (let i = 0; i < w / 14; i++) {
    circ(ctx, rnd() * w, 26 + rnd() * (h - 30), 1 + rnd() * 2);
    ctx.fillStyle = alpha(rnd() < 0.5 ? "#ffffff" : darken(base, 0.3), 0.5);
    ctx.fill();
  }
  ctx.restore();
}

/** 산호초 벽 (왼쪽 · 오른쪽 가장자리): 세로로 긴 바위 덩어리. side = 1 이면 오른쪽 벽 (안쪽이 왼쪽) */
export function reefWall(ctx, w, h, side, rnd = Math.random, o = {}) {
  const base = o.color || "#6f7f98";
  const inner = side > 0 ? 0 : w; // 물 쪽 가장자리 x
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(side > 0 ? w : 0, 0);
  let y = 0;
  const edge = [];
  while (y < h) {
    const bulge = 20 + rnd() * (w * 0.55);
    edge.push([side > 0 ? bulge : w - bulge, y]);
    y += 50 + rnd() * 70;
  }
  edge.push([side > 0 ? 30 : w - 30, h]);
  ctx.lineTo(edge[0][0], 0);
  for (let i = 1; i < edge.length; i++) {
    const [px, py] = edge[i - 1];
    const [qx, qy] = edge[i];
    ctx.quadraticCurveTo(px + (side > 0 ? -20 : 20), (py + qy) / 2, qx, qy);
  }
  ctx.lineTo(side > 0 ? w : 0, h);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `wall${base}|${side}|${w}`, inner, 0, side > 0 ? w : 0, 0, [
    [0, lighten(base, 0.15)],
    [0.4, base],
    [1, darken(base, 0.45)],
  ]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = lineOf(base);
  ctx.stroke();
  ctx.clip();
  // 바위 층 · 틈
  for (let i = 0; i < h / 40; i++) {
    const yy = rnd() * h;
    const xx = rnd() * w;
    ctx.beginPath();
    ctx.ellipse(xx, yy, 18 + rnd() * 30, 8 + rnd() * 12, rnd(), 0, TAU);
    ctx.fillStyle = alpha(rnd() < 0.5 ? darken(base, 0.3) : lighten(base, 0.15), 0.45);
    ctx.fill();
  }
  // 벽 위 산호 · 이끼 점
  for (let i = 0; i < h / 22; i++) {
    const yy = rnd() * h;
    const e = edge.find((p, k) => edge[k + 1] && edge[k + 1][1] > yy) || edge[0];
    const xx = e[0] + (side > 0 ? 6 + rnd() * 20 : -6 - rnd() * 20);
    circ(ctx, xx, yy, 3 + rnd() * 5);
    ctx.fillStyle = alpha(["#ff8fb3", "#7fd18a", "#ffd166", "#b28bff"][Math.floor(rnd() * 4)], 0.75);
    ctx.fill();
  }
  ctx.restore();
  return edge;
}

/* ================================================================
 * 중간 레이어 능선: 바위 언덕 + 산호 실루엣 (물빛에 녹은 낮은 대비)
 * ============================================================== */
export function midRidge(ctx, w, h, color, rnd = Math.random) {
  const light = lighten(color, 0.12);
  const dark = darken(color, 0.12);
  ctx.beginPath();
  ctx.moveTo(0, h);
  let x = 0;
  let y = 90 + rnd() * 50;
  ctx.lineTo(0, y);
  const tops = [];
  while (x < w) {
    const nx = Math.min(w, x + 70 + rnd() * 90);
    const ny = 60 + rnd() * 70;
    const cy = Math.min(y, ny) - 30 - rnd() * 40;
    ctx.quadraticCurveTo((x + nx) / 2, cy, nx, ny);
    tops.push([(x + nx) / 2, (y + ny) / 2 - 18 - (Math.min(y, ny) - cy) * 0.4]);
    x = nx;
    y = ny;
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  for (const [tx, ty] of tops) {
    const k = rnd();
    if (k < 0.35) {
      ctx.strokeStyle = light;
      ctx.lineCap = "round";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(tx, ty + 14);
      ctx.lineTo(tx, ty - 26);
      ctx.moveTo(tx, ty - 8);
      ctx.lineTo(tx - 14, ty - 26);
      ctx.moveTo(tx, ty - 14);
      ctx.lineTo(tx + 13, ty - 34);
      ctx.moveTo(tx - 14, ty - 26);
      ctx.lineTo(tx - 18, ty - 38);
      ctx.stroke();
    } else if (k < 0.6) {
      ctx.beginPath();
      ctx.moveTo(tx - 3, ty + 10);
      ctx.bezierCurveTo(tx - 34, ty - 10, tx - 24, ty - 46, tx, ty - 44);
      ctx.bezierCurveTo(tx + 24, ty - 46, tx + 34, ty - 10, tx + 3, ty + 10);
      ctx.closePath();
      ctx.fillStyle = light;
      ctx.fill();
    } else if (k < 0.8) {
      ctx.beginPath();
      ctx.ellipse(tx, ty + 6, 26 + rnd() * 14, 16 + rnd() * 8, 0, Math.PI, 0);
      ctx.fillStyle = dark;
      ctx.fill();
    } else {
      ctx.fillStyle = light;
      for (const [ox, hh] of [
        [-8, 28],
        [6, 38],
      ]) {
        rrect(ctx, tx + ox - 6, ty - hh, 12, hh + 10, 6);
        ctx.fill();
      }
    }
  }
}

/* ================================================================
 * 앞쪽 다시마 덤불 (화면 가장자리 · 어둡고 크게)
 * ============================================================== */
export function kelpClump(ctx, x, y, s, t, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const leaves = [
    [-0.5, 300, 34],
    [-0.2, 380, 40],
    [0.12, 340, 36],
    [0.42, 260, 30],
    [-0.75, 210, 26],
  ];
  leaves.forEach(([a, len, wd], i) => {
    const sw = Math.sin(t * 0.9 + i * 1.3) * 0.12 + Math.sin(t * 0.37 + i) * 0.05;
    const ang = -Math.PI / 2 + a + sw;
    const ex = Math.cos(ang) * len;
    const ey = Math.sin(ang) * len;
    const cx = Math.cos(ang - sw * 2) * len * 0.5 + Math.sin(t + i) * 12;
    const cy = Math.sin(ang - sw * 2) * len * 0.5;
    const nx = -Math.sin(ang) * wd;
    const ny = Math.cos(ang) * wd;
    ctx.beginPath();
    ctx.moveTo(-nx * 0.2, -ny * 0.2);
    ctx.quadraticCurveTo(cx + nx, cy + ny, ex, ey);
    ctx.quadraticCurveTo(cx - nx, cy - ny, nx * 0.2, ny * 0.2);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? color : lighten(color, 0.06);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.strokeStyle = lighten(color, 0.14);
    ctx.lineWidth = 3;
    ctx.stroke();
  });
  ctx.restore();
}

/* ================================================================
 * 벽에서 튀어나온 바위 턱: 벽 쪽이 두껍고 끝이 얇다
 *  원점 = 벽에 붙은 자리의 가운데, +x 로 뻗는다. len 길이 · th 두께
 * ============================================================== */
export function ledgeRock(ctx, len, th, color, rnd = Math.random) {
  ctx.beginPath();
  ctx.moveTo(-30, -th * 0.62);
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const x = u * len;
    const y = -th * (0.62 - u * 0.36) + (rnd() - 0.5) * 8;
    ctx.quadraticCurveTo(x - len / n / 2, y - 6 - rnd() * 6, x, y);
  }
  ctx.quadraticCurveTo(len + th * 0.32, -th * 0.05, len - th * 0.1, th * 0.2);
  for (let i = n - 1; i >= 0; i--) {
    const u = i / n;
    const x = u * len;
    const y = th * (0.22 + (1 - u) * 0.5) + (rnd() - 0.5) * 10;
    ctx.quadraticCurveTo(x + len / n / 2, y + 8 + rnd() * 8, x, y);
  }
  ctx.lineTo(-30, th * 0.8);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `ledge${color}|${R2(th)}`, 0, -th * 0.7, 0, th * 0.8, [
    [0, lighten(color, 0.32)],
    [0.3, color],
    [1, darken(color, 0.5)],
  ]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = lineOf(color);
  ctx.stroke();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < len / 22; i++) {
    const x = rnd() * len;
    const y = (rnd() - 0.3) * th * 0.8;
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + rnd() * 22, 4 + rnd() * 8, rnd() * 0.6, 0, TAU);
    ctx.fillStyle = alpha(rnd() < 0.55 ? darken(color, 0.3) : lighten(color, 0.2), 0.45);
    ctx.fill();
  }
  for (let i = 0; i < len / 26; i++) {
    const x = rnd() * len;
    ell(ctx, x, -th * (0.62 - (x / len) * 0.36) + 4, 6 + rnd() * 10, 2.5 + rnd() * 3);
    ctx.fillStyle = alpha(rnd() < 0.5 ? "#7fd18a" : "#ff9ec4", 0.6);
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-26, -th * 0.6);
  ctx.quadraticCurveTo(len * 0.5, -th * 0.5, len - 6, -th * 0.24);
  stroke(ctx, alpha(lighten(color, 0.55), 0.55), 2.4);
}

/* ================================================================
 * 탐험대 보트 (옆모습 · 수면 위) — 원점 = 물에 닿는 가운데
 * ============================================================== */
export function boatSide(ctx, t) {
  const bob = Math.sin(t * 1.6) * 3;
  const tilt = Math.sin(t * 1.3) * 0.03;
  ctx.save();
  ctx.translate(0, bob);
  ctx.rotate(tilt);
  // 선체
  ctx.beginPath();
  ctx.moveTo(-70, -26);
  ctx.lineTo(74, -26);
  ctx.quadraticCurveTo(70, 6, 46, 10);
  ctx.lineTo(-56, 10);
  ctx.quadraticCurveTo(-70, 0, -70, -26);
  ctx.closePath();
  fill(ctx, "#ffffff", -10, -14, 70, 22, 3);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#ff7a1a";
  ctx.fillRect(-80, -4, 160, 20);
  ctx.fillStyle = "#13b5a8";
  ctx.fillRect(-80, -12, 160, 5);
  ctx.restore();
  // 선실
  rrect(ctx, -44, -60, 58, 36, 8);
  fill(ctx, "#ffd23f", -20, -44, 30, 18, 2.6);
  rrect(ctx, -36, -54, 18, 14, 4);
  ctx.fillStyle = "#bff3ff";
  ctx.fill();
  rrect(ctx, -12, -54, 18, 14, 4);
  ctx.fillStyle = "#bff3ff";
  ctx.fill();
  // 깃발
  ctx.beginPath();
  ctx.moveTo(30, -26);
  ctx.lineTo(30, -84);
  stroke(ctx, "#5b6478", 3);
  const fl = Math.sin(t * 5) * 4;
  ctx.beginPath();
  ctx.moveTo(30, -84);
  ctx.quadraticCurveTo(46, -86 + fl, 58, -80 + fl);
  ctx.lineTo(30, -68);
  ctx.closePath();
  flat(ctx, "#ff5a5a", 1.8, "#7a1a1a");
  // 구명튜브
  circ(ctx, 52, -36, 8);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#ff5a5a";
  ctx.stroke();
  ctx.restore();
}
