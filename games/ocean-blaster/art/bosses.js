/*
 * 🌊 바다 물총 대작전 — 보스 5종 (일반 적을 키운 게 아니라 각자 다른 실루엣 · 색 · 소품)
 *  armored-crab  거대 갑옷 게     — 산호가 자란 갑옷 등딱지, 망치 집게, 열리는 배 갑옷(약점)
 *  storm-jelly   폭풍 해파리      — 먹구름 왕관, 번개 핵(약점), 전기 촉수
 *  shark-king    상어 해적왕      — 선장 코트 · 큰 해적 모자 · 금니, 입을 벌리면 약점
 *  octopus-captain 거대 문어 선장 — 선장 모자 닻 배지(약점), 콧수염, 견장
 *  leviathan     바다 괴수        — 지느러미 갈기 · 뿔 · 이마 보석(약점) · 뒤로 솟은 몸통 고리
 * 좌표: (0,0) = 물 위 가운데, 위가 -y. 크기는 엔진이 data.size 로 맞춘다.
 */
import {
  TAU, INK, mix, lighten, darken, alpha, lineOf, lit, vlit, linear, radial,
  ell, circ, rrect, smooth, fill, flat, stroke, gloss, bounce, dot, shadow,
  eye, brow, mouth, blush, star, sparkle, dizzyStars, drop, pirateHat, eyepatch, limb, fin,
} from "./kit.js?v=3";

export const BOSS_ART = {};
const def = (id, fn) => (BOSS_ART[id] = fn);
const ep = (p) => ({ ...p, dizzy: p.mode === "stun" || p.mode === "defeat", soaked: p.mode === "defeat" });
const tired = (p) => p.mode === "recover" || p.mode === "stun";

/* ================================================================
 * 거대 갑옷 게
 * ============================================================== */
def("armored-crab", (ctx, b, p) => {
  const t = p.t;
  const base = "#e8503a";
  const armor = "#8a96ae";
  const slam = p.mode === "attack" && p.atk === "slam";
  const raise = p.windup;
  const open = p.open;
  // 다리
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const x = s * (36 + i * 13);
      limb(ctx, [x, -24, x + s * 22, -14 + Math.sin(t * 6 + i) * 3, x + s * 28, 4], 7, darken(base, 0.08), { line: 4 });
    }
  // 집게 (왼쪽 보통, 오른쪽 망치 집게)
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 56, -62);
    const ang = slam ? s * 0.95 : s * (-0.65 - raise * 0.7 + Math.sin(t * 2.4 + s) * 0.12) + (tired(p) ? s * 0.8 : 0);
    ctx.rotate(ang);
    limb(ctx, [0, 0, s * 10, -18, s * 16, -36], 13, base, { line: 5 });
    // 팔 갑옷 띠
    for (const yy of [-14, -26]) {
      ctx.beginPath();
      ctx.moveTo(s * 2 - 9, yy);
      ctx.lineTo(s * 12 + 9, yy - 4);
      stroke(ctx, "#ffd23f", 5);
    }
    ctx.translate(s * 18, -58);
    ctx.scale(s, 1);
    const big = s > 0 ? 1.25 : 1;
    ctx.scale(big, big);
    smooth(ctx, [-16, 12, -24, -14, -8, -34, 16, -32, 30, -14, 18, -8, 26, 6, 6, 16], true, 0.45);
    fill(ctx, base, 2, -10, 26, 24, 3);
    // 집게 갑옷판
    smooth(ctx, [-18, -6, -14, -26, 4, -32, 8, -12], true, 0.45);
    fill(ctx, armor, -6, -18, 12, 14, 2.4);
    for (const [x, y] of [
      [-12, -10],
      [-6, -24],
      [2, -20],
    ])
      dot(ctx, x, y, 1.8, "#e6edf7");
    ctx.beginPath();
    ctx.moveTo(18, -8);
    ctx.lineTo(24, 0);
    ctx.lineTo(28, -6);
    ctx.lineTo(30, 2);
    stroke(ctx, "#fff4ea", 3);
    gloss(ctx, 10, -24, 8, 4, 0.5);
    ctx.restore();
  }
  // 눈자루
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 18, -84);
    ctx.quadraticCurveTo(s * 22, -100, s * 26, -112);
    stroke(ctx, lineOf(base), 10);
    ctx.beginPath();
    ctx.moveTo(s * 18, -84);
    ctx.quadraticCurveTo(s * 22, -100, s * 26, -112);
    stroke(ctx, lighten(base, 0.1), 6);
  }
  // 몸 (붉은 아랫몸)
  ell(ctx, 0, -46, 64, 38);
  fill(ctx, base, -6, -52, 64, 38, 3.4);
  // 배 갑옷 (열리면 말랑한 배가 보인다)
  if (open) {
    ell(ctx, 0, -30, 26, 16);
    fill(ctx, "#ffc2a6", 0, -30, 26, 16, 2.6);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-18 + i * 2, -36 + i * 6);
      ctx.quadraticCurveTo(0, -32 + i * 6, 18 - i * 2, -36 + i * 6);
      stroke(ctx, alpha("#d06a50", 0.6), 1.8);
    }
    mouth(ctx, 0, -40, 9, p, "o");
  }
  ctx.save();
  if (open) ctx.translate(0, 18);
  smooth(ctx, [-36, -22, -30, -44, 0, -50, 30, -44, 36, -22, 0, -12], true, 0.45);
  fill(ctx, armor, 0, -32, 34, 18, 2.8);
  for (let i = -2; i <= 2; i++) dot(ctx, i * 12, -40 + Math.abs(i) * 2, 2.2, "#e6edf7");
  ctx.restore();
  // 등 갑옷 (투구 같은 등딱지 + 금 테두리 + 리벳)
  smooth(ctx, [-70, -50, -60, -84, -30, -100, 0, -104, 30, -100, 60, -84, 70, -50, 40, -56, 0, -58, -40, -56], true, 0.45);
  fill(ctx, armor, -10, -80, 66, 28, 3.2);
  ctx.beginPath();
  ctx.moveTo(-68, -52);
  ctx.quadraticCurveTo(0, -64, 68, -52);
  stroke(ctx, "#ffd23f", 5);
  for (let i = -4; i <= 4; i++) {
    dot(ctx, i * 14, -56 - Math.cos((i / 4) * 1.2) * 4, 2.6, "#fff3c4");
    dot(ctx, i * 14, -56 - Math.cos((i / 4) * 1.2) * 4, 1.2, "#a36a00");
  }
  // 갑옷 판 이음새
  for (const x of [-34, 0, 34]) {
    ctx.beginPath();
    ctx.moveTo(x, -100 + Math.abs(x) * 0.2);
    ctx.lineTo(x * 1.1, -60);
    stroke(ctx, alpha("#4b5670", 0.6), 2.2);
  }
  gloss(ctx, -30, -88, 22, 7, 0.55, -0.15);
  // 갑옷 위에 자란 산호 · 따개비
  for (const [x, c] of [
    [-40, "#ff7aa8"],
    [30, "#ffb067"],
  ]) {
    ctx.save();
    ctx.translate(x, -96);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo((k - 1) * 6, -10, (k - 1) * 10, -20 - (k % 2) * 6);
      stroke(ctx, lineOf(c), 7);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo((k - 1) * 6, -10, (k - 1) * 10, -20 - (k % 2) * 6);
      stroke(ctx, c, 4.4);
    }
    ctx.restore();
  }
  for (const [x, y] of [
    [10, -100],
    [-14, -102],
    [50, -78],
  ]) {
    circ(ctx, x, y, 4);
    flat(ctx, "#f1ead8", 1.4, "#8a8270");
    dot(ctx, x, y, 1.4, "#8a8270");
  }
  // 눈
  const e = ep(p);
  eye(ctx, -26, -116, 13, e, { iris: "#c4123a" });
  eye(ctx, 26, -116, 13, e, { iris: "#c4123a" });
  if (!e.dizzy) {
    brow(ctx, -26, -134, 11, p.angry ? 5 : 1, 4.4);
    brow(ctx, 26, -134, 11, p.angry ? -5 : -1, 4.4);
  }
  if (!open) mouth(ctx, 0, -24, 12, p, p.angry ? "grin" : "flat");
  blush(ctx, -44, -40, 9);
  blush(ctx, 44, -40, 9);
  bounce(ctx, 0, -46, 62, 36, 0.45);
  if (p.mode === "stun") dizzyStars(ctx, p.now, -146, 38, 1.4);
});

/* ================================================================
 * 폭풍 해파리
 * ============================================================== */
def("storm-jelly", (ctx, b, p) => {
  const t = p.t;
  const e = ep(p);
  // 매달린 리본 촉수
  for (let i = 0; i < 7; i++) {
    const x = -48 + i * 16;
    ctx.beginPath();
    ctx.moveTo(x, -60);
    for (let k = 1; k <= 8; k++) ctx.lineTo(x + Math.sin(t * 3 + i + k * 0.8) * (4 + k), -60 + k * 9);
    stroke(ctx, i % 2 ? "rgba(200,150,255,0.9)" : "rgba(140,220,255,0.9)", i % 3 ? 4 : 7);
  }
  // 전기 지직
  if (Math.sin(t * 7) > 0.4 || p.mode === "attack") {
    ctx.beginPath();
    let x = -30 + Math.sin(t * 11) * 20;
    ctx.moveTo(x, -50);
    for (let k = 1; k < 7; k++) ctx.lineTo(x + Math.sin(t * 40 + k) * 10, -50 + k * 10);
    stroke(ctx, "#fff6a0", 3);
  }
  // 갓 (반투명 + 안쪽 무늬)
  smooth(ctx, [-70, -56, -70, -100, -46, -136, 0, -146, 46, -136, 70, -100, 70, -56, 0, -48], true, 0.5);
  ctx.fillStyle = linear(ctx, "stormbell", 0, -146, 0, -48, [
    [0, "rgba(200,190,255,0.97)"],
    [0.5, "rgba(150,140,245,0.93)"],
    [1, "rgba(110,110,230,0.9)"],
  ]);
  ctx.fill();
  stroke(ctx, "#4b3fa8", 3.4);
  // 프릴
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const x = -70 + i * 14;
    const y = -54 + Math.sin(t * 5 + i) * 3;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.quadraticCurveTo(x - 7, y + 12, x, y);
  }
  stroke(ctx, "rgba(220,200,255,0.95)", 5);
  // 번개 핵 (약점)
  const pulse = 0.6 + 0.4 * Math.sin(t * (p.open ? 12 : 4));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  shadow(ctx, 0, -92, 34 * pulse + 10, 30 * pulse + 8, p.open ? 0.95 : 0.5, "255,240,140");
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(4, -112);
  ctx.lineTo(-12, -90);
  ctx.lineTo(0, -90);
  ctx.lineTo(-6, -72);
  ctx.lineTo(12, -96);
  ctx.lineTo(0, -96);
  ctx.closePath();
  fill(ctx, p.open ? "#fff27a" : "#ffd23f", 0, -92, 10, 18, 2.4);
  gloss(ctx, -34, -122, 20, 10, 0.6, -0.3);
  // 얼굴
  eye(ctx, -26, -98, 12, e, { iris: "#5a2a9a", lid: tired(p) ? 0.35 : 0, lidColor: "#b9b0ff" });
  eye(ctx, 26, -98, 12, e, { iris: "#5a2a9a", lid: tired(p) ? 0.35 : 0, lidColor: "#b9b0ff" });
  if (!e.dizzy) {
    brow(ctx, -26, -116, 10, p.angry ? 5 : 0, 4);
    brow(ctx, 26, -116, 10, p.angry ? -5 : 0, 4);
  }
  mouth(ctx, 0, -72, 10, p, p.mode === "windup" ? "o" : p.angry ? "grin" : "smile");
  blush(ctx, -46, -80, 9);
  blush(ctx, 46, -80, 9);
  // 먹구름 왕관
  const cy = -158 + Math.sin(t * 2) * 3;
  for (const [x, y, r] of [
    [-34, cy + 4, 18],
    [-12, cy - 8, 24],
    [16, cy - 6, 22],
    [38, cy + 4, 16],
  ]) {
    circ(ctx, x, y, r);
    fill(ctx, "#8f9bb8", x, y, r, r, 3);
  }
  ell(ctx, 2, cy + 10, 50, 12);
  ctx.fillStyle = "#8f9bb8";
  ctx.fill();
  for (const x of [-30, 0, 30]) {
    ctx.beginPath();
    ctx.moveTo(x - 6, cy - 22);
    ctx.lineTo(x, cy - 36);
    ctx.lineTo(x + 6, cy - 22);
    ctx.closePath();
    fill(ctx, "#ffd23f", x, cy - 28, 6, 7, 2);
  }
  if (p.mode === "windup" || Math.sin(t * 2.3) > 0.8) {
    ctx.beginPath();
    ctx.moveTo(-10, cy + 14);
    ctx.lineTo(-20, cy + 32);
    ctx.lineTo(-8, cy + 30);
    ctx.lineTo(-18, cy + 50);
    stroke(ctx, "#fff27a", 4);
  }
  if (p.mode === "stun") dizzyStars(ctx, p.now, -190, 40, 1.4);
});

/* ================================================================
 * 상어 해적왕
 * ============================================================== */
def("shark-king", (ctx, b, p) => {
  const t = p.t;
  const base = "#5f86c8";
  const e = ep(p);
  const open = p.open || p.mode === "windup";
  // 꼬리 (뒤쪽에서 물을 친다)
  ctx.save();
  ctx.translate(-70, -16);
  ctx.rotate(-0.4 + Math.sin(t * 4) * 0.25);
  smooth(ctx, [0, 0, -12, -36, -30, -50, -20, -18, -36, 6, -12, 8], true, 0.4);
  fill(ctx, darken(base, 0.1), -16, -14, 16, 26, 3);
  ctx.restore();
  // 몸 (물 위로 솟은 상체)
  smooth(ctx, [-62, 6, -66, -60, -44, -120, -6, -150, 34, -140, 64, -100, 74, -50, 66, 6], true, 0.45);
  fill(ctx, base, -8, -80, 70, 80, 3.4);
  ctx.save();
  smooth(ctx, [-62, 6, -66, -60, -44, -120, -6, -150, 34, -140, 64, -100, 74, -50, 66, 6], true, 0.45);
  ctx.clip();
  smooth(ctx, [-10, 10, 10, -56, 50, -86, 80, -80, 80, 10], true, 0.5);
  ctx.fillStyle = linear(ctx, "kingbelly", 0, -86, 0, 10, [
    [0, "#ffffff"],
    [1, "#d6e2f2"],
  ]);
  ctx.fill();
  // 아가미
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-30 + i * 9, -86);
    ctx.quadraticCurveTo(-36 + i * 9, -66, -30 + i * 9, -46);
    stroke(ctx, alpha(darken(base, 0.45), 0.7), 3);
  }
  ctx.restore();
  // 등지느러미 (모자 뒤로)
  smooth(ctx, [-40, -120, -46, -170, -26, -176, -14, -134], true, 0.4);
  fill(ctx, darken(base, 0.08), -32, -150, 14, 26, 3);
  // 선장 코트 깃 + 금단추
  ctx.beginPath();
  ctx.moveTo(-64, -10);
  ctx.quadraticCurveTo(-30, -40, -6, -20);
  ctx.lineTo(-10, 6);
  ctx.lineTo(-64, 6);
  ctx.closePath();
  fill(ctx, "#2b2d4a", -36, -10, 30, 16, 3);
  ctx.beginPath();
  ctx.moveTo(-60, -10);
  ctx.quadraticCurveTo(-30, -36, -8, -18);
  stroke(ctx, "#ffd23f", 3.4);
  for (const y of [-6, 2]) dot(ctx, -26, y, 3.4, "#ffd23f");
  // 견장
  ell(ctx, -54, -30, 16, 8, 0.3);
  fill(ctx, "#ffd23f", -54, -30, 16, 8, 2.4);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-64 + i * 6, -24);
    ctx.lineTo(-66 + i * 6, -12);
    stroke(ctx, "#ffd23f", 2.4);
  }
  // 입 (약점: 금니)
  if (open) {
    smooth(ctx, [10, -64, 36, -78, 70, -70, 74, -50, 56, -40, 22, -46], true, 0.45);
    flat(ctx, "#a3254a", 3, "#4a0f22");
    ell(ctx, 46, -48, 16, 6);
    ctx.fillStyle = "#ff8aa5";
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const gold = i === 3;
      ctx.beginPath();
      ctx.moveTo(16 + i * 8, -68 + i * 0.6);
      ctx.lineTo(20 + i * 8, -60);
      ctx.lineTo(24 + i * 8, -68 + i * 0.6);
      ctx.closePath();
      flat(ctx, gold ? "#ffd23f" : "#ffffff", 1, gold ? "#a36a00" : "#9fb3c8");
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(14, -54);
    ctx.quadraticCurveTo(44, -36, 74, -54);
    stroke(ctx, "#1d2a55", 3.4);
    for (let i = 0; i < 6; i++) {
      const gold = i === 2;
      ctx.beginPath();
      ctx.moveTo(22 + i * 8, -50 + Math.abs(i - 2.5) * -1.5);
      ctx.lineTo(26 + i * 8, -42);
      ctx.lineTo(30 + i * 8, -50 + Math.abs(i - 2.5) * -1.5);
      ctx.closePath();
      flat(ctx, gold ? "#ffd23f" : "#ffffff", 1, gold ? "#a36a00" : "#9fb3c8");
    }
  }
  // 눈 + 안대
  eye(ctx, 30, -98, 13, e, { iris: "#1f3f7a", look: 0.4 });
  if (!e.dizzy) {
    eyepatch(ctx, -6, -100, 12, 0.1);
    brow(ctx, 30, -116, 11, p.angry ? -5 : -1, 4.4);
  }
  blush(ctx, 52, -78, 9);
  gloss(ctx, -26, -116, 18, 8, 0.5, -0.4);
  bounce(ctx, 4, -70, 66, 70, 0.4);
  // 해적왕 모자 (깃털 + 금 테)
  ctx.save();
  ctx.translate(6, -150);
  ctx.rotate(0.08);
  pirateHat(ctx, 0, 0, 2.2, "#1f2240", 0, "#ffd23f");
  ctx.beginPath();
  ctx.moveTo(30, -40);
  ctx.bezierCurveTo(60, -70, 80, -40, 66, -20);
  ctx.bezierCurveTo(60, -36, 46, -40, 30, -40);
  fill(ctx, "#ff5d6c", 54, -40, 16, 14, 2.4);
  ctx.restore();
  // 닻 목걸이
  ctx.beginPath();
  ctx.moveTo(20, -30);
  ctx.quadraticCurveTo(36, -16, 52, -30);
  stroke(ctx, "#ffd23f", 2.4);
  ctx.save();
  ctx.translate(36, -18);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 8);
  ctx.moveTo(-7, 3);
  ctx.quadraticCurveTo(0, 12, 7, 3);
  stroke(ctx, "#ffd23f", 3);
  ctx.restore();
  if (p.mode === "stun") dizzyStars(ctx, p.now, -210, 42, 1.4);
});

/* ================================================================
 * 거대 문어 선장
 * ============================================================== */
def("octopus-captain", (ctx, b, p) => {
  const t = p.t;
  const base = "#ff6b4a";
  const e = ep(p);
  // 다리 6개 (빨판)
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1;
    const k = i % 3;
    const x0 = s * (14 + k * 16);
    const w = Math.sin(t * 3 + i) * 12;
    const ex = s * (50 + k * 14) + w;
    limb(ctx, [x0, -40, x0 + s * (26 + w), -30, ex, -8], 15, darken(base, 0.04), { line: 5 });
    for (let j = 1; j <= 2; j++) {
      const u = j / 3;
      ell(ctx, x0 + (ex - x0) * u, -40 + 32 * u + 6, 4, 3);
      flat(ctx, "#ffd9c8", 1.2);
    }
  }
  // 머리
  smooth(ctx, [-60, -50, -64, -100, -44, -146, 0, -158, 44, -146, 64, -100, 60, -50, 30, -38, -30, -38], true, 0.5);
  fill(ctx, base, -10, -100, 60, 58, 3.4);
  for (const [x, y, r] of [
    [30, -132, 6],
    [44, -106, 4.5],
    [-40, -86, 5],
    [-30, -132, 3.6],
    [6, -146, 3.4],
  ]) {
    circ(ctx, x, y, r);
    ctx.fillStyle = alpha(darken(base, 0.3), 0.45);
    ctx.fill();
  }
  gloss(ctx, -24, -128, 20, 10, 0.5);
  bounce(ctx, 0, -96, 58, 56, 0.4);
  // 선장 코트 깃 + 견장
  ctx.beginPath();
  ctx.moveTo(-62, -40);
  ctx.quadraticCurveTo(0, -20, 62, -40);
  ctx.lineTo(50, -58);
  ctx.quadraticCurveTo(0, -42, -50, -58);
  ctx.closePath();
  fill(ctx, "#1f2a5a", 0, -44, 56, 12, 3);
  for (const s of [-1, 1]) {
    ell(ctx, s * 58, -52, 18, 8, s * 0.2);
    fill(ctx, "#ffd23f", s * 58, -52, 18, 8, 2.4);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(s * (46 + i * 7), -46);
      ctx.lineTo(s * (46 + i * 7), -34);
      stroke(ctx, "#ffd23f", 2.4);
    }
  }
  // 선장 모자 + 닻 배지(약점)
  ctx.save();
  ctx.translate(0, -158);
  smooth(ctx, [-54, 12, -50, -16, -20, -32, 20, -32, 50, -16, 54, 12], true, 0.4);
  fill(ctx, "#283a6e", 0, -10, 54, 22, 3);
  ell(ctx, 0, 12, 62, 11);
  fill(ctx, "#1a2650", 0, 12, 62, 11, 3);
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(-52, 2, 104, 6);
  ctx.save();
  if (p.open) {
    ctx.globalCompositeOperation = "lighter";
    shadow(ctx, 0, -10, 30, 30, 0.8, "255,240,150");
    ctx.globalCompositeOperation = "source-over";
  }
  circ(ctx, 0, -10, 14);
  fill(ctx, p.open ? "#fff27a" : "#ffd23f", 0, -10, 14, 14, 2.6);
  ctx.beginPath();
  ctx.moveTo(0, -19);
  ctx.lineTo(0, -1);
  ctx.moveTo(-7, -5);
  ctx.quadraticCurveTo(0, 3, 7, -5);
  ctx.moveTo(-5, -14);
  ctx.lineTo(5, -14);
  stroke(ctx, "#8a5a00", 2.6);
  ctx.restore();
  gloss(ctx, -26, -16, 12, 5, 0.35, 0);
  ctx.restore();
  // 얼굴
  eye(ctx, -22, -104, 14, e, { iris: "#1f3f7a" });
  eye(ctx, 22, -104, 14, e, { iris: "#1f3f7a" });
  if (!e.dizzy) {
    brow(ctx, -22, -124, 12, p.angry ? 5 : 0, 4.6);
    brow(ctx, 22, -124, 12, p.angry ? -5 : 0, 4.6);
  }
  // 콧수염
  ctx.beginPath();
  ctx.moveTo(0, -78);
  ctx.bezierCurveTo(-12, -88, -36, -84, -42, -70);
  ctx.bezierCurveTo(-28, -76, -14, -72, 0, -74);
  ctx.bezierCurveTo(14, -72, 28, -76, 42, -70);
  ctx.bezierCurveTo(36, -84, 12, -88, 0, -78);
  fill(ctx, "#5b2a1a", 0, -78, 40, 8, 2.2);
  mouth(ctx, 0, -64, 12, { ...p, soaked: tired(p) }, p.mode === "windup" ? "o" : p.angry ? "grin" : "smile");
  blush(ctx, -42, -84, 9);
  blush(ctx, 42, -84, 9);
  if (p.mode === "stun") dizzyStars(ctx, p.now, -196, 42, 1.4);
});

/* ================================================================
 * 바다 괴수 (최종 보스)
 * ============================================================== */
def("leviathan", (ctx, b, p) => {
  const t = p.t;
  const base = "#2a6f9a";
  const scale = "#5fd0c8";
  const e = ep(p);
  const charge = p.mode === "attack" && p.atk === "charge";
  // 뒤로 솟은 몸통 고리 3개
  for (const [x, h, w, ph] of [
    [-110, 70, 34, 0],
    [96, 84, 38, 1.4],
    [-58, 48, 26, 2.6],
  ]) {
    const hh = h + Math.sin(t * 1.6 + ph) * 6;
    ctx.beginPath();
    ctx.moveTo(x - w, 4);
    ctx.bezierCurveTo(x - w, -hh * 1.2, x + w, -hh * 1.2, x + w, 4);
    ctx.lineTo(x + w * 0.45, 4);
    ctx.bezierCurveTo(x + w * 0.45, -hh * 0.62, x - w * 0.45, -hh * 0.62, x - w * 0.45, 4);
    ctx.closePath();
    fill(ctx, darken(base, 0.12), x, -hh * 0.5, w, hh * 0.6, 3);
    for (let i = 0; i < 4; i++) {
      const u = (i + 0.5) / 4;
      const px = x - w * 0.72 + u * w * 1.44;
      const py = -hh * 0.85 * Math.sin(u * Math.PI) - 4;
      ctx.beginPath();
      ctx.moveTo(px - 5, py + 2);
      ctx.lineTo(px, py - 10);
      ctx.lineTo(px + 5, py + 2);
      ctx.closePath();
      fill(ctx, "#ffb84a", px, py - 4, 5, 6, 1.8);
      dot(ctx, px, py + 10, 2.6, alpha("#9ff8ff", 0.85));
    }
  }
  // 목
  smooth(ctx, [-40, 6, -46, -60, -30, -110, 30, -110, 46, -60, 40, 6], true, 0.45);
  fill(ctx, base, -6, -54, 44, 56, 3.4);
  ctx.save();
  smooth(ctx, [-40, 6, -46, -60, -30, -110, 30, -110, 46, -60, 40, 6], true, 0.45);
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    ell(ctx, 6, -10 - i * 18, 22, 8);
    ctx.fillStyle = i % 2 ? "#ffe3a8" : "#ffd27a";
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = alpha("#b7741a", 0.6);
    ctx.stroke();
  }
  ctx.restore();
  // 지느러미 갈기 (양옆)
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 56, -150);
    ctx.scale(s, 1);
    ctx.rotate(-0.2 + Math.sin(t * 3 + s) * 0.08);
    fin(ctx, [0, 0, 40, -30, 58, -10, 50, 14, 30, 22], "#5fd0c8", 4);
    ctx.restore();
  }
  // 머리
  smooth(ctx, [-64, -130, -60, -176, -30, -202, 0, -206, 30, -202, 60, -176, 64, -130, 40, -104, 0, -98, -40, -104], true, 0.5);
  fill(ctx, base, -10, -158, 62, 54, 3.4);
  // 비늘 무늬
  ctx.save();
  smooth(ctx, [-64, -130, -60, -176, -30, -202, 0, -206, 30, -202, 60, -176, 64, -130, 40, -104, 0, -98, -40, -104], true, 0.5);
  ctx.clip();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = alpha(scale, 0.45);
  for (let r = 0; r < 4; r++)
    for (let c = -4; c <= 4; c++) {
      ctx.beginPath();
      ctx.arc(c * 14 + (r % 2) * 7, -190 + r * 14, 7, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  ctx.restore();
  // 뿔 (둥글둥글)
  for (const s of [-1, 1]) {
    smooth(ctx, [s * 22, -196, s * 30, -232, s * 44, -238, s * 40, -198], true, 0.45);
    fill(ctx, "#ffe3a8", s * 34, -216, 10, 20, 2.6);
  }
  // 이마 보석 (약점)
  const gp = 0.6 + 0.4 * Math.sin(t * (p.open ? 12 : 3));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  shadow(ctx, 0, -176, 26 * gp + 12, 26 * gp + 12, p.open ? 0.95 : 0.45, "255,120,220");
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(0, -192);
  ctx.lineTo(12, -178);
  ctx.lineTo(0, -162);
  ctx.lineTo(-12, -178);
  ctx.closePath();
  fill(ctx, p.open ? "#ff9ae8" : "#e05bc0", 0, -178, 12, 15, 2.6);
  gloss(ctx, -3, -182, 4, 3, 0.9);
  gloss(ctx, -34, -180, 18, 8, 0.4, -0.3);
  bounce(ctx, 0, -150, 60, 50, 0.4);
  // 눈
  eye(ctx, -30, -150, 15, e, { iris: charge ? "#ff4fa3" : "#ffb02e", lid: tired(p) ? 0.3 : 0, lidColor: base });
  eye(ctx, 30, -150, 15, e, { iris: charge ? "#ff4fa3" : "#ffb02e", lid: tired(p) ? 0.3 : 0, lidColor: base });
  if (!e.dizzy) {
    brow(ctx, -30, -172, 13, p.angry || charge ? 6 : 1, 5);
    brow(ctx, 30, -172, 13, p.angry || charge ? -6 : -1, 5);
  }
  // 주둥이 + 콧구멍
  ell(ctx, 0, -116, 36, 18);
  fill(ctx, lighten(base, 0.12), 0, -116, 36, 18, 2.8);
  for (const s of [-1, 1]) {
    ell(ctx, s * 12, -122, 4, 2.6);
    ctx.fillStyle = "#123a52";
    ctx.fill();
  }
  if (charge || p.mode === "windup") {
    smooth(ctx, [-24, -108, 0, -112, 24, -108, 18, -92, 0, -88, -18, -92], true, 0.45);
    flat(ctx, "#7c2140", 2.6);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-14 + i * 9, -108);
      ctx.lineTo(-11 + i * 9, -102);
      ctx.lineTo(-8 + i * 9, -108);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  } else mouth(ctx, 0, -108, 14, { ...p, soaked: tired(p) }, p.angry ? "grin" : "smile");
  // 수염 (하늘하늘)
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 30, -112);
    ctx.bezierCurveTo(s * 60, -110, s * 70, -90 + Math.sin(t * 3 + s) * 8, s * 92, -96 + Math.sin(t * 3 + s) * 10);
    stroke(ctx, lineOf("#ffe3a8"), 6);
    ctx.beginPath();
    ctx.moveTo(s * 30, -112);
    ctx.bezierCurveTo(s * 60, -110, s * 70, -90 + Math.sin(t * 3 + s) * 8, s * 92, -96 + Math.sin(t * 3 + s) * 10);
    stroke(ctx, "#ffe3a8", 3.4);
  }
  if (p.mode === "stun") dizzyStars(ctx, p.now, -250, 44, 1.5);
});

/* 바다 괴수의 몸통 고리 (보스 부품) */
export function seaCoil(ctx, e, p) {
  const base = "#2a6f9a";
  const slap = e.mem && e.mem.slap > 0 ? e.mem.slap : 0;
  if (e.mem && e.mem.slap > 0) e.mem.slap -= 1 / 60;
  const h = 96 + Math.sin(p.t * 2 + e.uid) * 8 + slap * 24;
  const w = 36;
  ctx.beginPath();
  ctx.moveTo(-w, 6);
  ctx.bezierCurveTo(-w, -h * 1.25, w, -h * 1.25, w, 6);
  ctx.lineTo(w * 0.42, 6);
  ctx.bezierCurveTo(w * 0.42, -h * 0.62, -w * 0.42, -h * 0.62, -w * 0.42, 6);
  ctx.closePath();
  fill(ctx, base, 0, -h * 0.55, w, h * 0.6, 3.2);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) {
    const u = (i + 0.5) / 5;
    shadow(ctx, -w * 0.72 + u * w * 1.44, -h * 0.82 * Math.sin(u * Math.PI) + 8, 6, 6, 0.7, "120,255,240");
  }
  ctx.restore();
  for (let i = 0; i < 5; i++) {
    const u = (i + 0.5) / 5;
    const px = -w * 0.72 + u * w * 1.44;
    const py = -h * 0.9 * Math.sin(u * Math.PI) - 4;
    ctx.beginPath();
    ctx.moveTo(px - 5, py + 3);
    ctx.lineTo(px, py - 11);
    ctx.lineTo(px + 5, py + 3);
    ctx.closePath();
    fill(ctx, "#ffb84a", px, py - 4, 5, 7, 1.8);
  }
  gloss(ctx, -12, -h * 0.8, 10, 5, 0.45);
  if (p.soaked) dizzyStars(ctx, p.now, -h - 20, 18);
}
