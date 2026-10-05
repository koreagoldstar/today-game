/*
 * 🌊 바다 물총 대작전 — 주인공 '지혁' + AQUA BLASTER
 *  - 뒷모습(3/4): 게임 중. 바다를 바라보며 물총을 겨눈다 (옆얼굴 · 귀 · 머리카락 · 모자 · 물탱크 배낭)
 *  - 앞모습: 메뉴 · 환호 · 흠뻑 젖었을 때 · 결과 화면 (내 얼굴 사진을 쓸 수 있다)
 * 좌표: (0,0) = 두 발 사이 바닥, 위가 -y
 */
import { TAU, INK, mix, lighten, darken, alpha, lineOf, lit, vlit, linear, radial, ell, circ, rrect, smooth, fill, flat, stroke, gloss, bounce, dot, shadow, eye, brow, mouth, blush, limb, drop, star } from "./kit.js?v=2";

export const KID = {
  skin: "#ffd5b3",
  skinShade: "#f0b48f",
  hair: "#4a2b1d",
  vest: "#ff7a1a",
  shirt: "#2d4f9e",
  shorts: "#c79a5c",
  hat: "#dcc289",
  band: "#7a4f2a",
  glove: "#25c2b4",
  shoe: "#ffffff",
  sole: "#ff6a3d",
  tank: "#7fe0ff",
};

/* ================================================================
 * AQUA BLASTER — 총구는 +x 방향, (0,0) = 손잡이 위 피벗
 * ============================================================== */
export function drawBlaster(ctx, st, scale = 1) {
  const t = st.t || 0;
  const firing = Boolean(st.firing);
  ctx.save();
  ctx.scale(scale, scale);
  // 손잡이
  ctx.beginPath();
  ctx.moveTo(-4, 6);
  ctx.quadraticCurveTo(-10, 26, -6, 34);
  ctx.lineTo(8, 34);
  ctx.quadraticCurveTo(12, 22, 10, 6);
  ctx.closePath();
  fill(ctx, "#ef6a1f", 2, 20, 10, 16, 2.4);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-6 + i * 0.6, 14 + i * 6);
    ctx.lineTo(8, 14 + i * 6);
    stroke(ctx, alpha("#8a3200", 0.45), 1.6);
  }
  // 방아쇠 울
  ctx.beginPath();
  ctx.moveTo(12, 8);
  ctx.quadraticCurveTo(22, 22, 30, 8);
  stroke(ctx, lineOf("#ef6a1f"), 3);
  // 몸통
  ctx.beginPath();
  ctx.moveTo(-18, -10);
  ctx.quadraticCurveTo(-22, 0, -16, 10);
  ctx.lineTo(70, 10);
  ctx.quadraticCurveTo(78, 0, 70, -10);
  ctx.closePath();
  fill(ctx, "#ff8a3d", 26, -2, 46, 12, 2.6);
  // 옆판 + 글자
  rrect(ctx, 4, -6, 50, 11, 5);
  ctx.fillStyle = linear(ctx, "bl-panel", 0, -6, 0, 6, [
    [0, "#ffffff"],
    [1, "#d8f4ff"],
  ]);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = alpha("#a04000", 0.5);
  ctx.stroke();
  ctx.font = '900 8.5px "Bagel Fat One", "Jua", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1a7fd6";
  ctx.fillText("AQUA", 29, 0);
  // 펌프 손잡이(앞)
  rrect(ctx, 44, 7, 26, 10, 4);
  fill(ctx, "#20b8ab", 57, 12, 14, 6, 2.2);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(49 + i * 7, 8.5);
    ctx.lineTo(49 + i * 7, 15.5);
    stroke(ctx, alpha("#0b5f58", 0.55), 1.4);
  }
  // 총열 + 크롬 링 + 노즐
  rrect(ctx, 68, -5.5, 26, 11, 4);
  ctx.fillStyle = linear(ctx, "bl-barrel", 0, -6, 0, 6, [
    [0, "#9ff0e8"],
    [0.45, "#2ec4b6"],
    [1, "#138a80"],
  ]);
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "#0d5f59";
  ctx.stroke();
  rrect(ctx, 88, -8, 8, 16, 3);
  ctx.fillStyle = linear(ctx, "bl-chrome", 0, -8, 0, 8, [
    [0, "#ffffff"],
    [0.4, "#c7d3e3"],
    [0.6, "#8796ad"],
    [1, "#e8eef7"],
  ]);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#56627a";
  ctx.stroke();
  rrect(ctx, 95, -5, 9, 10, 3);
  fill(ctx, "#ffcf33", 99, 0, 5, 5, 1.8);
  // 물탱크 (투명 + 출렁이는 물 + 기포)
  ell(ctx, 22, -20, 24, 13);
  ctx.fillStyle = "rgba(205,245,255,0.55)";
  ctx.fill();
  ctx.save();
  ell(ctx, 22, -20, 23, 12);
  ctx.clip();
  const slosh = Math.sin(t * 7) * 2.6 + (firing ? Math.sin(t * 31) * 1.6 : 0);
  ctx.beginPath();
  ctx.moveTo(-4, -20 + slosh);
  ctx.quadraticCurveTo(22, -27 - slosh, 48, -20 + slosh);
  ctx.lineTo(48, -4);
  ctx.lineTo(-4, -4);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, "bl-water", 0, -26, 0, -6, [
    [0, "#7fe6ff"],
    [1, "#1f8fe6"],
  ]);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const bx = 6 + ((i * 11 + t * 18) % 34);
    const by = -10 - ((t * 22 + i * 7) % 10);
    circ(ctx, bx, by, 1.6 + (i % 2));
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke();
  }
  ctx.restore();
  ell(ctx, 22, -20, 24, 13);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#2a7fb8";
  ctx.stroke();
  gloss(ctx, 12, -26, 9, 3.5, 0.9);
  // 탱크 뚜껑
  rrect(ctx, 16, -37, 12, 6, 2.5);
  fill(ctx, "#ffcf33", 22, -34, 6, 3, 1.6);
  // 호스 연결구
  circ(ctx, -16, -2, 5);
  fill(ctx, "#20b8ab", -16, -2, 5, 5, 1.6);
  // 몸통 하이라이트
  gloss(ctx, 20, -6, 26, 3, 0.45, 0);
  ctx.restore();
}

/** 쏠 때 총구에서 터지는 물보라 (총구 좌표계) */
export function drawMuzzle(ctx, st, scale = 1) {
  if (!st.firing && !(st.recoil > 0.3)) return;
  const t = st.t || 0;
  const k = Math.max(0.4, st.recoil || 0.6);
  ctx.save();
  ctx.translate(106 * scale, 0);
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t * 9;
    const r = (8 + Math.sin(t * 40 + i) * 3) * k * scale;
    ell(ctx, Math.cos(a) * r * 0.6, Math.sin(a) * r, 4.5 * k * scale, 2.6 * k * scale, a);
    ctx.fillStyle = i % 2 ? "#ffffff" : "#aeeaff";
    ctx.fill();
  }
  ctx.fillStyle = radial(ctx, "muzzle", 0, 0, 0, 0, 0, 16, [
    [0, "rgba(255,255,255,0.95)"],
    [0.5, "rgba(170,235,255,0.6)"],
    [1, "rgba(170,235,255,0)"],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, 16 * k * scale, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ================================================================
 * 뒷모습 3/4 (게임 중)
 * st: { t, aim(라디안), recoil, firing, hurt, breath }
 * 그린 뒤 노즐 끝 좌표(이 그림 좌표계)를 돌려준다
 * ============================================================== */
export const GUN_PIVOT = { x: 24, y: -146 };

export function drawHeroBack(ctx, st) {
  const t = st.t || 0;
  const breath = Math.sin(t * 2.2) * 1.4;
  const hurt = st.hurt || 0;
  const rec = (st.recoil || 0) * 7;
  const a = st.aim == null ? -1.3 : st.aim;
  shadow(ctx, 0, 2, 46, 10, 0.32, "40,25,10");
  // ---- 다리 · 신발 ----
  for (const s of [-1, 1]) {
    const lx = s * 13;
    // 종아리
    ctx.beginPath();
    ctx.moveTo(lx - 8, -66);
    ctx.quadraticCurveTo(lx - 10, -40, lx - 7, -20);
    ctx.lineTo(lx + 7, -20);
    ctx.quadraticCurveTo(lx + 10, -42, lx + 8, -66);
    ctx.closePath();
    ctx.fillStyle = vlit(ctx, KID.skin, -66, -20);
    ctx.fill();
    stroke(ctx, lineOf(KID.skin), 2.2);
    // 양말
    rrect(ctx, lx - 8, -26, 16, 10, 3);
    flat(ctx, "#ffffff", 2, "#9fb3c8");
    ctx.fillStyle = "#25c2b4";
    ctx.fillRect(lx - 7, -23, 14, 2.6);
    // 운동화 (뒤축이 보이는 각도)
    ctx.beginPath();
    ctx.moveTo(lx - 12, -12);
    ctx.quadraticCurveTo(lx - 13, -22, lx - 4, -20);
    ctx.lineTo(lx + 6, -20);
    ctx.quadraticCurveTo(lx + 14, -20, lx + 13, -10);
    ctx.quadraticCurveTo(lx + 13, 0, lx, 0);
    ctx.quadraticCurveTo(lx - 13, 0, lx - 12, -12);
    ctx.closePath();
    fill(ctx, "#f4f8ff", lx, -10, 13, 10, 2.4);
    ctx.beginPath();
    ctx.moveTo(lx - 12.5, -5);
    ctx.quadraticCurveTo(lx, 3, lx + 12.5, -5);
    ctx.lineTo(lx + 12, -1);
    ctx.quadraticCurveTo(lx, 5, lx - 12, -1);
    ctx.closePath();
    flat(ctx, KID.sole, 1.6);
    rrect(ctx, lx - 3, -19, 6, 9, 2);
    flat(ctx, "#25c2b4", 1.4);
  }
  // ---- 반바지 ----
  ctx.save();
  ctx.translate(0, breath * 0.2);
  ctx.beginPath();
  ctx.moveTo(-31, -114);
  ctx.lineTo(31, -114);
  ctx.quadraticCurveTo(35, -88, 30, -62);
  ctx.lineTo(4, -60);
  ctx.lineTo(0, -80);
  ctx.lineTo(-4, -60);
  ctx.lineTo(-30, -62);
  ctx.quadraticCurveTo(-35, -88, -31, -114);
  ctx.closePath();
  fill(ctx, KID.shorts, 0, -90, 34, 28, 2.6);
  // 허리 밴드 · 주머니 · 주름
  rrect(ctx, -31, -116, 62, 9, 4);
  flat(ctx, darken(KID.shorts, 0.15), 2);
  rrect(ctx, 8, -102, 16, 16, 4);
  flat(ctx, lighten(KID.shorts, 0.08), 1.8);
  ctx.beginPath();
  ctx.moveTo(8, -97);
  ctx.lineTo(24, -97);
  stroke(ctx, lineOf(KID.shorts), 1.6);
  dot(ctx, 16, -99, 1.6, "#5b3a1a");
  for (const [x0, y0, x1, y1] of [
    [-20, -84, -14, -70],
    [-10, -96, -6, -86],
    [18, -78, 22, -66],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + 4, (y0 + y1) / 2, x1, y1);
    stroke(ctx, alpha(darken(KID.shorts, 0.35), 0.5), 1.6);
  }
  ctx.restore();

  // ---- 몸통: 소매 · 구명조끼 ----
  ctx.save();
  ctx.translate(0, breath);
  ctx.scale(1, 1 + breath * 0.004);
  for (const s of [-1, 1]) {
    // 줄무늬 반팔 (어깨)
    ell(ctx, s * 34, -150, 13, 15, s * 0.3);
    fill(ctx, "#ffffff", s * 34, -150, 13, 15, 2.2);
    ctx.save();
    ell(ctx, s * 34, -150, 12.5, 14.5, s * 0.3);
    ctx.clip();
    ctx.fillStyle = KID.shirt;
    for (let i = -2; i <= 2; i++) ctx.fillRect(s * 34 - 14, -150 + i * 7 - 1.8, 28, 3.6);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(-34, -164);
  ctx.quadraticCurveTo(-38, -138, -32, -110);
  ctx.quadraticCurveTo(0, -102, 32, -110);
  ctx.quadraticCurveTo(38, -138, 34, -164);
  ctx.quadraticCurveTo(0, -178, -34, -164);
  ctx.closePath();
  fill(ctx, KID.vest, 0, -140, 36, 34, 2.8);
  // 바느질 · 반사띠 · 옆 버클 끈
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(-28, -158);
  ctx.quadraticCurveTo(-31, -136, -27, -116);
  ctx.moveTo(28, -158);
  ctx.quadraticCurveTo(31, -136, 27, -116);
  stroke(ctx, alpha("#ffd2a8", 0.9), 1.3);
  ctx.setLineDash([]);
  rrect(ctx, -33, -132, 66, 8, 2);
  ctx.fillStyle = linear(ctx, "reflect", 0, -132, 0, -124, [
    [0, "#ffffff"],
    [0.5, "#c5d3e6"],
    [1, "#f2f6fb"],
  ]);
  ctx.fill();
  for (const s of [-1, 1]) {
    rrect(ctx, s * 36 - 4, -124, 8, 14, 2);
    flat(ctx, "#22283a", 1.2, "#0e1220");
    rrect(ctx, s * 36 - 5, -120, 10, 6, 2);
    flat(ctx, "#9aa7bd", 1.2, "#4b5670");
  }
  // 목 뒤 패드
  ell(ctx, 0, -168, 22, 9);
  fill(ctx, darken(KID.vest, 0.08), 0, -168, 22, 9, 2.4);
  // 물탱크 배낭
  ctx.save();
  ctx.translate(-4, -140);
  ctx.beginPath();
  ctx.moveTo(-28, -18);
  ctx.lineTo(-24, -36);
  ctx.moveTo(20, -18);
  ctx.lineTo(16, -36);
  stroke(ctx, "#1d3557", 6);
  rrect(ctx, -20, -26, 32, 48, 14);
  ctx.fillStyle = "rgba(210,246,255,0.6)";
  ctx.fill();
  ctx.save();
  rrect(ctx, -19, -25, 30, 46, 13);
  ctx.clip();
  const lvl = -6 + Math.sin(t * 3) * 1.5;
  ctx.fillStyle = linear(ctx, "pack-water", 0, -20, 0, 22, [
    [0, "#82e8ff"],
    [1, "#1b86de"],
  ]);
  ctx.beginPath();
  ctx.moveTo(-20, lvl);
  ctx.quadraticCurveTo(-4, lvl - 4 - Math.sin(t * 5) * 2, 12, lvl);
  ctx.lineTo(12, 24);
  ctx.lineTo(-20, 24);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    circ(ctx, -12 + ((i * 9) % 22), 18 - ((t * 20 + i * 9) % 22), 1.8);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke();
  }
  ctx.restore();
  rrect(ctx, -20, -26, 32, 48, 14);
  stroke(ctx, "#2a7fb8", 2.6);
  gloss(ctx, -10, -12, 5, 12, 0.85, 0);
  rrect(ctx, -11, -32, 14, 8, 3);
  fill(ctx, "#ffcf33", -4, -28, 7, 4, 1.8);
  ctx.restore();
  ctx.restore();

  // ---- 머리 ----
  const hx = 6 + Math.sin(t * 1.1) * 0.6;
  const hy = -198 + breath * 1.1;
  const R = 34;
  // 목
  rrect(ctx, hx - 9, hy + 22, 18, 14, 6);
  ctx.fillStyle = KID.skinShade;
  ctx.fill();
  // 얼굴 쪽 (오른쪽 옆얼굴)
  ctx.save();
  ctx.translate(hx, hy);
  ctx.beginPath();
  ctx.moveTo(R * 0.15, -R * 0.75);
  ctx.quadraticCurveTo(R * 1.12, -R * 0.55, R * 1.08, R * 0.12);
  ctx.quadraticCurveTo(R * 1.14, R * 0.22, R * 1.04, R * 0.32);
  ctx.quadraticCurveTo(R * 0.92, R * 0.92, R * 0.18, R * 0.95);
  ctx.closePath();
  fill(ctx, KID.skin, R * 0.6, 0, R * 0.7, R, 2.4);
  // 볼 · 코끝 · 눈 · 눈썹 · 입꼬리
  blush(ctx, R * 0.82, R * 0.42, 9);
  const pose = { t, now: t, blink: t % 3.6 < 0.13, soaked: hurt > 0.5 };
  if (!pose.soaked) {
    ctx.beginPath();
    ctx.ellipse(R * 0.88, -R * 0.06, 4.5, 6.5, 0.15, 0, TAU);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(R * 0.92, -R * 0.03, 3.4, 5, 0.15, 0, TAU);
    ctx.fillStyle = "#5a3418";
    ctx.fill();
    dot(ctx, R * 0.9, -R * 0.1, 1.4, "#ffffff");
    ctx.beginPath();
    ctx.moveTo(R * 0.72, -R * 0.24);
    ctx.quadraticCurveTo(R * 0.92, -R * 0.36, R * 1.02, -R * 0.2);
    stroke(ctx, INK, 2.4);
    if (pose.blink) {
      ctx.beginPath();
      ctx.moveTo(R * 0.78, -R * 0.04);
      ctx.lineTo(R * 1.0, -R * 0.02);
      stroke(ctx, INK, 2.2);
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(R * 0.74, -R * 0.12);
    ctx.lineTo(R * 0.94, -R * 0.02);
    ctx.lineTo(R * 0.76, R * 0.08);
    stroke(ctx, INK, 2.6);
  }
  ctx.beginPath();
  ctx.moveTo(R * 0.7, -R * 0.42);
  ctx.quadraticCurveTo(R * 0.86, -R * 0.52, R * 1.02, -R * 0.44);
  stroke(ctx, "#3a2014", 3);
  ctx.beginPath();
  ctx.moveTo(R * 0.86, R * 0.58);
  ctx.quadraticCurveTo(R * 0.96, R * 0.66, R * 1.02, R * 0.56);
  stroke(ctx, "#8a3a2a", 2.2);
  ctx.restore();
  // 뒤통수 머리카락
  ctx.save();
  ctx.translate(hx, hy);
  ctx.beginPath();
  ctx.moveTo(R * 0.42, -R * 0.86);
  ctx.quadraticCurveTo(R * 0.85, -R * 0.4, R * 0.62, R * 0.12);
  ctx.quadraticCurveTo(R * 0.58, R * 0.52, R * 0.38, R * 0.86);
  ctx.quadraticCurveTo(R * 0.22, R * 0.98, R * 0.08, R * 0.82);
  ctx.quadraticCurveTo(-R * 0.08, R * 1.02, -R * 0.22, R * 0.84);
  ctx.quadraticCurveTo(-R * 0.4, R * 1.0, -R * 0.52, R * 0.78);
  ctx.quadraticCurveTo(-R * 1.08, R * 0.3, -R * 0.96, -R * 0.3);
  ctx.quadraticCurveTo(-R * 0.6, -R * 1.04, R * 0.42, -R * 0.86);
  ctx.closePath();
  fill(ctx, KID.hair, -R * 0.1, -R * 0.1, R, R, 2.6);
  // 머릿결 광택
  ctx.beginPath();
  ctx.moveTo(-R * 0.62, -R * 0.42);
  ctx.quadraticCurveTo(-R * 0.1, -R * 0.66, R * 0.36, -R * 0.36);
  stroke(ctx, alpha("#c9875a", 0.55), 4);
  for (const [x0, y0, x1, y1] of [
    [-R * 0.5, R * 0.1, -R * 0.36, R * 0.56],
    [-R * 0.1, R * 0.12, -R * 0.02, R * 0.6],
    [R * 0.24, R * 0.06, R * 0.24, R * 0.5],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + 4, (y0 + y1) / 2, x1, y1);
    stroke(ctx, alpha("#2a160c", 0.6), 1.6);
  }
  // 귀
  ell(ctx, R * 0.6, R * 0.08, 8, 11, 0.25);
  fill(ctx, KID.skin, R * 0.6, R * 0.08, 8, 11, 2.2);
  ctx.beginPath();
  ctx.ellipse(R * 0.6, R * 0.1, 4, 6, 0.25, -0.6 * Math.PI, 0.6 * Math.PI);
  stroke(ctx, KID.skinShade, 2.2);
  ctx.restore();
  // 탐험가 모자
  drawExplorerHat(ctx, hx, hy - R * 0.62, 1, "back", t);
  if (hurt > 0) {
    for (let i = 0; i < 5; i++) drop(ctx, hx - 30 + i * 15, hy - 20 + ((t * 120 + i * 20) % 70), 3.6);
  }

  // ---- 팔 + 물총 (어깨 너머로 보이게 몸 다음에) ----
  const px = GUN_PIVOT.x;
  const py = GUN_PIVOT.y + breath;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const along = (d, side) => ({ x: px + ca * (d - rec) - sa * side, y: py + sa * (d - rec) + ca * side });
  const grip = along(4, 20);
  const pump = along(56, 10);
  // 호스 (배낭 → 물총)
  const hose = along(-14, 0);
  ctx.beginPath();
  ctx.moveTo(-14, -118);
  ctx.bezierCurveTo(10, -96, hose.x - 20, hose.y + 24, hose.x, hose.y);
  stroke(ctx, "#1a9e93", 6);
  ctx.beginPath();
  ctx.moveTo(-14, -118);
  ctx.bezierCurveTo(10, -96, hose.x - 20, hose.y + 24, hose.x, hose.y);
  stroke(ctx, "#5fe0d4", 2.4);
  // 오른팔 (손잡이)
  limb(ctx, [30, -156, 46, -136, grip.x + 4, grip.y + 6], 12, KID.skin, { line: 4 });
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(a);
  ctx.translate(-rec, 0);
  drawBlaster(ctx, st, 1);
  drawMuzzle(ctx, st, 1);
  ctx.restore();
  // 왼팔은 몸 앞으로 돌아가 있어서 뒤에서는 어깨와 손만 보인다
  limb(ctx, [-30, -156, -36, -140, -30, -126], 11, KID.skin, { line: 4 });
  glove(ctx, grip.x, grip.y, a, 1);
  glove(ctx, pump.x, pump.y, a, -1);
  return along(106, 0);
}

function glove(ctx, x, y, a, side) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ell(ctx, 0, 0, 10, 8.5);
  fill(ctx, KID.glove, 0, 0, 10, 8.5, 2.2);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-4 + i * 4, -7);
    ctx.lineTo(-3 + i * 4, -2);
    stroke(ctx, alpha("#0b5f58", 0.6), 1.3);
  }
  ell(ctx, -6, side * 5, 4.5, 3.5, 0.4);
  fill(ctx, lighten(KID.glove, 0.1), -6, side * 5, 4.5, 3.5, 1.6);
  ctx.restore();
}

/** 탐험가 모자 — view: back | front */
export function drawExplorerHat(ctx, x, y, s, view, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const hat = KID.hat;
  // 챙 (뒤쪽 절반)
  ctx.beginPath();
  ctx.ellipse(0, 6, 52, 15, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fillStyle = darken(hat, 0.12);
  ctx.fill();
  // 모자 몸통
  ctx.beginPath();
  ctx.moveTo(-30, 6);
  ctx.quadraticCurveTo(-32, -30, 0, -32);
  ctx.quadraticCurveTo(32, -30, 30, 6);
  ctx.closePath();
  fill(ctx, hat, -4, -12, 30, 24, 2.6);
  // 가운데 솔기 · 통풍 구멍
  ctx.beginPath();
  ctx.moveTo(view === "front" ? 0 : -6, -31);
  ctx.quadraticCurveTo(view === "front" ? 0 : -10, -12, view === "front" ? 0 : -8, 4);
  stroke(ctx, alpha(darken(hat, 0.35), 0.6), 1.6);
  for (const vx of view === "front" ? [-18, 18] : [16]) {
    circ(ctx, vx, -18, 2.4);
    flat(ctx, "#8a7346", 1, "#5d4b2a");
  }
  // 띠 + 닻 배지
  ctx.beginPath();
  ctx.moveTo(-30, -4);
  ctx.quadraticCurveTo(0, 2, 30, -4);
  ctx.lineTo(30, 4);
  ctx.quadraticCurveTo(0, 10, -30, 4);
  ctx.closePath();
  fill(ctx, KID.band, 0, 0, 30, 5, 2);
  const bx = view === "front" ? 0 : 20;
  circ(ctx, bx, 1, 6.5);
  fill(ctx, "#ffcf33", bx, 1, 6.5, 6.5, 1.6);
  ctx.beginPath();
  ctx.moveTo(bx, -3);
  ctx.lineTo(bx, 4);
  ctx.moveTo(bx - 3, 3);
  ctx.quadraticCurveTo(bx, 6, bx + 3, 3);
  stroke(ctx, "#9a6a00", 1.4);
  gloss(ctx, -12, -22, 10, 5, 0.45);
  // 챙 (앞쪽 절반)
  ctx.beginPath();
  ctx.ellipse(0, 6, 52, 15, 0, 0, Math.PI);
  ctx.lineTo(-30, 6);
  ctx.ellipse(0, 6, 30, 6, 0, Math.PI, 0, true);
  ctx.closePath();
  fill(ctx, lighten(hat, 0.04), 0, 10, 52, 15, 2.4);
  ctx.beginPath();
  ctx.ellipse(0, 7, 46, 12, 0, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.setLineDash([3, 3]);
  stroke(ctx, alpha("#7a6136", 0.7), 1.3);
  ctx.setLineDash([]);
  ctx.restore();
}

/* ================================================================
 * 앞모습 (메뉴 · 환호 · 젖음 · 결과)
 * mood: happy | cheer | wet | ready
 * ============================================================== */
export function drawHeroFront(ctx, x, y, s, st, mood = "happy") {
  const t = st.t || 0;
  const cheer = mood === "cheer";
  const wet = mood === "wet";
  const jump = cheer ? Math.abs(Math.sin(t * 6)) * 14 : 0;
  const breath = Math.sin(t * 2.2) * 1.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  shadow(ctx, 0, 2, 44 - jump * 0.6, 9, 0.3, "40,25,10");
  ctx.translate(0, -jump);
  // 다리 · 신발
  for (const sd of [-1, 1]) {
    const lx = sd * 13;
    ctx.beginPath();
    ctx.moveTo(lx - 8, -68);
    ctx.quadraticCurveTo(lx - 9, -42, lx - 7, -22);
    ctx.lineTo(lx + 7, -22);
    ctx.quadraticCurveTo(lx + 9, -44, lx + 8, -68);
    ctx.closePath();
    ctx.fillStyle = vlit(ctx, KID.skin, -68, -22);
    ctx.fill();
    stroke(ctx, lineOf(KID.skin), 2.2);
    rrect(ctx, lx - 8, -28, 16, 10, 3);
    flat(ctx, "#ffffff", 2, "#9fb3c8");
    ctx.fillStyle = "#25c2b4";
    ctx.fillRect(lx - 7, -25, 14, 2.6);
    ctx.beginPath();
    ctx.moveTo(lx - 13, -6);
    ctx.quadraticCurveTo(lx - 14, -20, lx, -21);
    ctx.quadraticCurveTo(lx + 14, -20, lx + 14 + sd * 2, -6);
    ctx.quadraticCurveTo(lx + 14, 1, lx, 1);
    ctx.quadraticCurveTo(lx - 14, 1, lx - 13, -6);
    ctx.closePath();
    fill(ctx, "#f4f8ff", lx, -10, 14, 10, 2.4);
    ctx.beginPath();
    ctx.moveTo(lx - 13, -4);
    ctx.quadraticCurveTo(lx, 1, lx + 14, -4);
    ctx.lineTo(lx + 14, 0);
    ctx.quadraticCurveTo(lx, 4, lx - 13, 0);
    ctx.closePath();
    flat(ctx, KID.sole, 1.4);
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(lx - 5, -17 + i * 4);
      ctx.lineTo(lx + 5, -17 + i * 4);
      stroke(ctx, "#7a8ba3", 1.6);
    }
    ell(ctx, lx - 5, -9, 4, 2.4, -0.3);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fill();
  }
  // 반바지
  ctx.beginPath();
  ctx.moveTo(-31, -114);
  ctx.lineTo(31, -114);
  ctx.quadraticCurveTo(35, -90, 31, -64);
  ctx.lineTo(4, -62);
  ctx.lineTo(0, -82);
  ctx.lineTo(-4, -62);
  ctx.lineTo(-31, -64);
  ctx.quadraticCurveTo(-35, -90, -31, -114);
  ctx.closePath();
  fill(ctx, KID.shorts, 0, -92, 34, 28, 2.6);
  for (const sd of [-1, 1]) {
    rrect(ctx, sd * 22 - 8, -96, 16, 18, 4);
    flat(ctx, lighten(KID.shorts, 0.08), 1.6);
    ctx.beginPath();
    ctx.moveTo(sd * 22 - 8, -90);
    ctx.lineTo(sd * 22 + 8, -90);
    stroke(ctx, lineOf(KID.shorts), 1.4);
  }
  // 몸통 (티셔츠 + 구명조끼)
  ctx.save();
  ctx.translate(0, breath);
  ctx.beginPath();
  ctx.moveTo(-30, -168);
  ctx.quadraticCurveTo(0, -176, 30, -168);
  ctx.lineTo(28, -110);
  ctx.quadraticCurveTo(0, -104, -28, -110);
  ctx.closePath();
  ctx.fillStyle = KID.shirt;
  ctx.fill();
  // 조끼 좌우 판
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sd * 6, -164);
    ctx.quadraticCurveTo(sd * 22, -176, sd * 36, -164);
    ctx.quadraticCurveTo(sd * 40, -138, sd * 33, -110);
    ctx.quadraticCurveTo(sd * 18, -104, sd * 4, -108);
    ctx.closePath();
    fill(ctx, KID.vest, sd * 20, -140, 20, 32, 2.6);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(sd * 10, -158);
    ctx.lineTo(sd * 8, -114);
    stroke(ctx, alpha("#ffd2a8", 0.9), 1.3);
    ctx.setLineDash([]);
  }
  // 버클 띠
  for (const by of [-146, -126]) {
    rrect(ctx, -26, by, 52, 6, 2);
    flat(ctx, "#22283a", 1.2, "#0e1220");
    rrect(ctx, -7, by - 2.5, 14, 11, 3);
    ctx.fillStyle = linear(ctx, "buckle", 0, -3, 0, 8, [
      [0, "#e6edf7"],
      [1, "#8d99b0"],
    ]);
    ctx.save();
    ctx.translate(0, by);
    rrect(ctx, -7, -2.5, 14, 11, 3);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "#4b5670";
    ctx.stroke();
  }
  // 호루라기
  ctx.beginPath();
  ctx.moveTo(-16, -166);
  ctx.quadraticCurveTo(-12, -150, -14, -138);
  stroke(ctx, "#1d3557", 1.4);
  rrect(ctx, -19, -140, 10, 7, 3);
  fill(ctx, "#ffcf33", -14, -136, 5, 4, 1.4);
  ctx.restore();
  // 팔
  const handY = cheer ? -246 + Math.sin(t * 12) * 6 : wet ? -176 : -122;
  const handX = cheer ? 52 : wet ? 46 : 44;
  for (const sd of [-1, 1]) {
    ell(ctx, sd * 34, -156 + breath, 12, 14, sd * 0.3);
    fill(ctx, "#ffffff", sd * 34, -156, 12, 14, 2.2);
    ctx.save();
    ell(ctx, sd * 34, -156 + breath, 11.5, 13.5, sd * 0.3);
    ctx.clip();
    ctx.fillStyle = KID.shirt;
    for (let i = -2; i <= 2; i++) ctx.fillRect(sd * 34 - 14, -156 + i * 7 - 1.8, 28, 3.6);
    ctx.restore();
    // aim: 오른쪽 어깨 높이로 물총을 겨누는 자세 (물총은 바깥에서 그린다)
    const hx2 = mood === "aim" ? (sd > 0 ? 46 : 12) : sd * handX;
    const hy2 = mood === "aim" ? (sd > 0 ? -150 : -128) : handY;
    limb(ctx, [sd * 38, -150, mood === "aim" ? (sd > 0 ? 50 : -24) : sd * (handX + 8), mood === "aim" ? -124 : (handY - 150) / 2 + (cheer ? -40 : 4), hx2, hy2], 11, KID.skin, { line: 4 });
    glove(ctx, hx2, hy2, sd < 0 ? Math.PI : 0, 1);
  }
  if (mood !== "cheer" && mood !== "wet" && mood !== "aim") {
    // 물총을 비스듬히 든 자세
    ctx.save();
    ctx.translate(-30, -116);
    ctx.rotate(-0.5);
    drawBlaster(ctx, { t, firing: false }, 0.82);
    ctx.restore();
    glove(ctx, -26, -112, -0.5, 1);
    glove(ctx, 18, -140, -0.5, -1);
  } else if (cheer) {
    ctx.save();
    ctx.translate(46, handY - 4);
    ctx.rotate(-1.35);
    drawBlaster(ctx, { t, firing: false }, 0.7);
    ctx.restore();
  }
  // 머리
  const hy = -206 + breath * 1.2;
  const R = 36;
  rrect(ctx, -9, hy + 22, 18, 16, 6);
  ctx.fillStyle = KID.skinShade;
  ctx.fill();
  // 귀
  for (const sd of [-1, 1]) {
    ell(ctx, sd * R * 0.98, hy + 4, 8, 10.5);
    fill(ctx, KID.skin, sd * R * 0.98, hy + 4, 8, 10.5, 2.2);
    ctx.beginPath();
    ctx.ellipse(sd * R * 0.98, hy + 5, 3.8, 5.5, 0, sd > 0 ? -0.6 * Math.PI : 0.4 * Math.PI, sd > 0 ? 0.6 * Math.PI : 1.6 * Math.PI);
    stroke(ctx, KID.skinShade, 2);
  }
  let photo = false;
  if (window.TodayFace && TodayFace.drawHead && st.face !== false) {
    photo = TodayFace.drawHead(ctx, 0, hy, R, { ring: 3, ringColor: lineOf(KID.skin) });
  }
  if (!photo) {
    circ(ctx, 0, hy, R);
    fill(ctx, KID.skin, 0, hy, R, R, 2.6);
    // 앞머리
    ctx.beginPath();
    ctx.moveTo(-R * 0.98, hy + 2);
    ctx.quadraticCurveTo(-R * 1.08, hy - R * 0.9, 0, hy - R * 1.02);
    ctx.quadraticCurveTo(R * 1.08, hy - R * 0.9, R * 0.98, hy + 2);
    ctx.quadraticCurveTo(R * 0.8, hy - R * 0.32, R * 0.46, hy - R * 0.36);
    ctx.quadraticCurveTo(R * 0.3, hy - R * 0.18, R * 0.12, hy - R * 0.42);
    ctx.quadraticCurveTo(-R * 0.1, hy - R * 0.2, -R * 0.3, hy - R * 0.44);
    ctx.quadraticCurveTo(-R * 0.62, hy - R * 0.26, -R * 0.98, hy + 2);
    ctx.closePath();
    fill(ctx, KID.hair, 0, hy - R * 0.6, R, R * 0.6, 2.4);
    ctx.beginPath();
    ctx.moveTo(-R * 0.6, hy - R * 0.72);
    ctx.quadraticCurveTo(0, hy - R * 0.92, R * 0.5, hy - R * 0.7);
    stroke(ctx, alpha("#c9875a", 0.55), 3.4);
    const pose = { t, now: t, blink: t % 3.4 < 0.13, soaked: wet, hit: 0 };
    const ey = hy + 2;
    if (cheer) {
      eye(ctx, -R * 0.38, ey, 7.5, pose, { happy: true });
      eye(ctx, R * 0.38, ey, 7.5, pose, { happy: true });
    } else {
      eye(ctx, -R * 0.38, ey, 7.5, pose, { iris: "#6b3f1f", look: 0 });
      eye(ctx, R * 0.38, ey, 7.5, pose, { iris: "#6b3f1f", look: 0 });
    }
    brow(ctx, -R * 0.38, ey - 13, 7, wet ? -3 : 1, 3, "#3a2014");
    brow(ctx, R * 0.38, ey - 13, 7, wet ? 3 : -1, 3, "#3a2014");
    // 코
    ctx.beginPath();
    ctx.moveTo(-1, ey + 8);
    ctx.quadraticCurveTo(3, ey + 12, -1, ey + 14);
    stroke(ctx, KID.skinShade, 2.2);
    dot(ctx, -2, ey + 10, 1.4, "rgba(255,255,255,0.7)");
    mouth(ctx, 0, ey + 19, cheer || wet ? 8 : 7, pose, cheer ? "open" : wet ? "o" : "smile", "#5a2a1a");
    blush(ctx, -R * 0.58, ey + 12, 7.5);
    blush(ctx, R * 0.58, ey + 12, 7.5);
    for (const [fx, fy] of [
      [-R * 0.56, ey + 9],
      [-R * 0.48, ey + 13],
      [R * 0.52, ey + 10],
    ])
      dot(ctx, fx, fy, 1.1, "rgba(170,90,60,0.5)");
  }
  drawExplorerHat(ctx, 0, hy - R * 0.66, 1.05, "front", t);
  // 턱끈
  ctx.beginPath();
  ctx.moveTo(-R * 0.9, hy - 8);
  ctx.quadraticCurveTo(-R * 0.7, hy + R * 0.95, 0, hy + R * 0.98);
  ctx.quadraticCurveTo(R * 0.7, hy + R * 0.95, R * 0.9, hy - 8);
  stroke(ctx, alpha("#5d3b1a", 0.7), 1.6);
  if (wet) {
    for (let i = 0; i < 6; i++) drop(ctx, -32 + i * 13, hy - 20 + ((t * 120 + i * 17) % 60), 3.8);
  }
  ctx.restore();
}

/** HUD 초상화 (작은 캔버스에 얼굴만 크게) */
export function drawHeroPortrait(cv, st = {}) {
  const ctx = cv.getContext("2d");
  const w = cv.width;
  const h = cv.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  const s = w / 118;
  ctx.translate(w / 2, h * 0.56);
  ctx.scale(s, s);
  ctx.translate(0, 214);
  drawHeroFront(ctx, 0, 0, 1, { t: st.t || 0.3, face: true }, st.mood || "happy");
  ctx.restore();
}

export { star };
