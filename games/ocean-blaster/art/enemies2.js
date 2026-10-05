/*
 * 🌊 바다 물총 대작전 — 바다 친구들 2: 게 · 소라게 · 오징어 · 문어 · 상어 · 악어
 */
import {
  TAU, INK, mix, lighten, darken, alpha, lineOf, lit, vlit, linear, radial,
  ell, circ, rrect, smooth, fill, flat, stroke, gloss, bounce, dot, shadow,
  eye, brow, mouth, blush, star, sparkle, dizzyStars, wetDrops, drop, pirateHat, eyepatch, limb, fin,
} from "./kit.js?v=2";
import { ENEMY_ART, crabClaw, crabLegs, stalkEye } from "./enemies.js?v=2";

const def = (id, fn) => (ENEMY_ART[id] = fn);

/* ================================================================
 * 폭주 게 — 각진 가시 등딱지, 한쪽만 거대한 집게, 빨간 머리띠
 * ============================================================== */
def("rage-crab", (ctx, e, p) => {
  const base = "#6c5cff";
  const t = p.t;
  const dashing = e.mem && e.mem.dashing && !p.soaked;
  if (dashing) {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-48 - i * 4, -50 + i * 12);
      ctx.lineTo(-84 - i * 8, -50 + i * 12);
      stroke(ctx, "rgba(255,255,255,0.85)", 3.4);
    }
    for (let i = 0; i < 3; i++) {
      const k = (t * 3 + i / 3) % 1;
      circ(ctx, -36 - k * 30, -4 - k * 8, 4 + k * 5);
      ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
      ctx.fill();
    }
  }
  crabLegs(ctx, base, t, dashing ? 26 : 9, 1.05);
  crabClaw(ctx, -1, base, t, 0.3 + Math.sin(t * 9) * 0.25, 0.75, 0);
  crabClaw(ctx, 1, base, t, 0.5 + Math.sin(t * 7) * 0.4, 1.45, p.soaked ? 0 : 0.6);
  // 각진 등딱지 (양옆 가시)
  ctx.beginPath();
  ctx.moveTo(-34, -16);
  ctx.lineTo(-44, -30);
  ctx.lineTo(-34, -34);
  ctx.lineTo(-38, -46);
  ctx.lineTo(-22, -48);
  ctx.lineTo(-14, -60);
  ctx.lineTo(0, -54);
  ctx.lineTo(14, -60);
  ctx.lineTo(22, -48);
  ctx.lineTo(38, -46);
  ctx.lineTo(34, -34);
  ctx.lineTo(44, -30);
  ctx.lineTo(34, -16);
  ctx.quadraticCurveTo(0, -4, -34, -16);
  ctx.closePath();
  fill(ctx, base, -6, -38, 38, 26, 3);
  // 번개 무늬
  ctx.beginPath();
  ctx.moveTo(-6, -50);
  ctx.lineTo(4, -38);
  ctx.lineTo(-2, -36);
  ctx.lineTo(8, -24);
  stroke(ctx, "#fff27a", 3.2);
  gloss(ctx, -18, -44, 12, 4, 0.55);
  bounce(ctx, 0, -28, 34, 18, 0.5);
  // 머리띠
  ctx.beginPath();
  ctx.moveTo(-36, -34);
  ctx.quadraticCurveTo(0, -46, 36, -34);
  stroke(ctx, "#ff3d3d", 6.5);
  ctx.beginPath();
  ctx.moveTo(-36, -34);
  ctx.lineTo(-52, -40 + Math.sin(t * 18) * 5);
  ctx.moveTo(-36, -34);
  ctx.lineTo(-50, -28 + Math.sin(t * 18 + 1) * 5);
  stroke(ctx, "#ff3d3d", 4.5);
  stalkEye(ctx, -11, -66, 8, base, p, { iris: "#c4123a", look: 0.6 });
  stalkEye(ctx, 11, -66, 8, base, p, { iris: "#c4123a", look: 0.6 });
  if (!p.soaked) {
    brow(ctx, -11, -78, 7, 4, 3.4);
    brow(ctx, 11, -78, 7, -4, 3.4);
    // 땀
    drop(ctx, 30, -60, 3.6);
  }
  mouth(ctx, 0, -24, 9, p, "grin");
  if (p.dizzy) dizzyStars(ctx, p.now, -88, 20);
  wetDrops(ctx, p, -90, 22);
});

/* ================================================================
 * 도둑 게 — 납작하고 넓은 줄무늬 등딱지, 도둑 가면, 보물 자루
 * ============================================================== */
def("thief-crab", (ctx, e, p) => {
  const base = "#2f9be0";
  const t = p.t;
  if (e.carry) {
    // 등에 멘 보물 자루
    ctx.save();
    ctx.translate(-30, -54);
    ctx.rotate(-0.25 + Math.sin(t * 10) * 0.06);
    smooth(ctx, [-18, 10, -22, -8, -10, -24, 6, -26, 18, -12, 16, 10, 0, 16], true, 0.5);
    fill(ctx, "#c48a4a", 0, -4, 20, 18, 2.6);
    ctx.beginPath();
    ctx.moveTo(-8, -24);
    ctx.quadraticCurveTo(0, -32, 8, -25);
    stroke(ctx, "#7a4a1e", 3);
    star(ctx, 0, -2, 7, "#ffe066", 0.2);
    for (const [x, y] of [
      [-6, -24],
      [4, -27],
    ]) {
      ell(ctx, x, y, 4, 2.2);
      flat(ctx, "#ffd23f", 1.2, "#a36a00");
    }
    gloss(ctx, -8, -12, 6, 3, 0.4);
    ctx.restore();
  }
  crabLegs(ctx, base, t, 16, 1.15);
  crabClaw(ctx, -1, base, t, 0.6, 0.85, 0.4);
  crabClaw(ctx, 1, base, t, 0.6 + Math.sin(t * 8) * 0.3, 0.9, 0.2);
  // 납작 넓은 등딱지 + 줄무늬
  ell(ctx, 0, -26, 40, 18);
  fill(ctx, base, -6, -32, 40, 18, 3);
  ctx.save();
  ell(ctx, 0, -26, 39, 17);
  ctx.clip();
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 12 - 4, -44);
    ctx.quadraticCurveTo(i * 12 + 2, -26, i * 12 - 2, -8);
    stroke(ctx, alpha("#ffffff", 0.32), 4);
  }
  ctx.restore();
  ell(ctx, 0, -14, 26, 6);
  ctx.fillStyle = "#bfe4ff";
  ctx.fill();
  gloss(ctx, -16, -36, 12, 4, 0.55);
  bounce(ctx, 0, -26, 38, 16, 0.45);
  // 눈 + 도둑 가면
  const look = Math.sin(t * 2.3) > 0 ? 0.7 : -0.5;
  stalkEye(ctx, -12, -58, 8, base, p, { iris: "#3a2a1a", look });
  stalkEye(ctx, 12, -58, 8, base, p, { iris: "#3a2a1a", look });
  if (!p.soaked) {
    ctx.beginPath();
    ctx.moveTo(-26, -60);
    ctx.quadraticCurveTo(0, -66, 26, -60);
    ctx.quadraticCurveTo(27, -52, 20, -50);
    ctx.quadraticCurveTo(0, -54, -20, -50);
    ctx.quadraticCurveTo(-27, -52, -26, -60);
    ctx.closePath();
    ctx.fillStyle = "rgba(20,22,40,0.9)";
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    eye(ctx, -12, -58, 5.6, p, { iris: "#3a2a1a", look });
    eye(ctx, 12, -58, 5.6, p, { iris: "#3a2a1a", look });
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(26, -58);
    ctx.lineTo(36, -62 + Math.sin(t * 12) * 3);
    stroke(ctx, "rgba(20,22,40,0.9)", 3);
  }
  mouth(ctx, 4, -22, 7, p, e.carry ? "smile" : "o");
  blush(ctx, -22, -24, 5);
  blush(ctx, 22, -24, 5);
  if (p.dizzy) dizzyStars(ctx, p.now, -80, 20);
  wetDrops(ctx, p, -84, 22);
});

/* ================================================================
 * 소라게 — 커다란 나선 소라 껍데기 · 빼꼼 나오는 눈과 집게
 * ============================================================== */
def("hermit-crab", (ctx, e, p) => {
  const peek = p.open || p.soaked;
  const shellBase = "#ffd2bd";
  ctx.save();
  if (!peek) ctx.translate(0, 6);
  // 소라 껍데기 (나선 · 돌기)
  smooth(ctx, [-36, -6, -42, -38, -24, -62, -4, -76, -22, -90, 2, -96, 24, -78, 34, -48, 28, -12, 10, -2], true, 0.45);
  fill(ctx, shellBase, -6, -46, 36, 44, 3);
  ctx.save();
  smooth(ctx, [-36, -6, -42, -38, -24, -62, -4, -76, -22, -90, 2, -96, 24, -78, 34, -48, 28, -12, 10, -2], true, 0.45);
  ctx.clip();
  // 나선 띠
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(-2 + i * 2, -40 - i * 13, 34 - i * 7, 15 - i * 2.5, -0.35, 0.05 * Math.PI, 1.0 * Math.PI);
    stroke(ctx, i % 2 ? "#ff9f7a" : "#f4785c", 5);
  }
  for (let i = 0; i < 6; i++) {
    circ(ctx, -26 + i * 9, -18 - (i % 2) * 6, 2.6);
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fill();
  }
  ctx.restore();
  // 돌기
  for (const [x, y] of [
    [-34, -36],
    [-20, -62],
    [-6, -84],
    [20, -74],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 3);
    ctx.lineTo(x - 2, y - 7);
    ctx.lineTo(x + 4, y + 2);
    ctx.closePath();
    flat(ctx, "#ffe7da", 1.6, lineOf(shellBase));
  }
  gloss(ctx, -18, -54, 9, 16, 0.6, 0.4);
  // 입구
  ell(ctx, 14, -18, 15, 12, -0.2);
  ctx.fillStyle = radial(ctx, "hermit-hole", 14, -18, 2, 14, -18, 16, [
    [0, "#1c0f12"],
    [1, "#5a2f2a"],
  ]);
  ctx.fill();
  stroke(ctx, lineOf(shellBase), 2.6);
  ctx.restore();
  if (peek) {
    // 몸 · 집게 · 눈
    limb(ctx, [24, -12, 34, -16, 40, -24], 6, "#ff7a4d", { line: 3 });
    ctx.save();
    ctx.translate(42, -28);
    ell(ctx, 0, 0, 11, 9, -0.3);
    fill(ctx, "#ff7a4d", 0, 0, 11, 9, 2.4);
    ctx.beginPath();
    ctx.moveTo(4, -6);
    ctx.lineTo(10, -2);
    stroke(ctx, lineOf("#ff7a4d"), 2);
    ctx.restore();
    stalkEye(ctx, 18, -44, 7, "#ff7a4d", p, { iris: "#2a5fc4", look: 0.4 });
    stalkEye(ctx, 32, -40, 7, "#ff7a4d", p, { iris: "#2a5fc4", look: 0.5 });
    mouth(ctx, 22, -18, 5, p);
  } else {
    // 껍데기 속에서 반짝이는 눈
    for (const x of [9, 18]) {
      ell(ctx, x, -14, 2.6, 3.2);
      ctx.fillStyle = "#fff6c8";
      ctx.fill();
    }
  }
  if (p.dizzy) dizzyStars(ctx, p.now, -100, 22);
});

/* ================================================================
 * 꼬마 오징어 — 위로 뾰족한 몸통, 삼각 지느러미, 짧은 다리 + 긴 촉완
 * ============================================================== */
def("baby-squid", (ctx, e, p) => {
  const base = "#ff86b9";
  const t = p.t;
  const puff = e.mem && e.mem.throwT > 0;
  // 다리 8개 + 긴 촉완 2개
  for (let i = 0; i < 6; i++) {
    const x = -15 + i * 6;
    const w = Math.sin(t * 6 + i * 1.1) * 5;
    limb(ctx, [x, -30, x + w, -18, x - w * 0.6 + (i - 2.5) * 2, -6], 4.4, darken(base, 0.05), { line: 3, hi: false });
  }
  for (const s of [-1, 1]) {
    const w = Math.sin(t * 4 + s) * 8;
    limb(ctx, [s * 8, -30, s * 22 + w, -14, s * 26 + w, 4], 3.4, darken(base, 0.08), { line: 3, hi: false });
    ell(ctx, s * 26 + w, 6, 5, 7);
    fill(ctx, darken(base, 0.05), s * 26 + w, 6, 5, 7, 2);
  }
  // 몸통 (위로 뾰족)
  smooth(ctx, [0, -94, 14, -78, 22, -56, 22, -36, 12, -28, -12, -28, -22, -36, -22, -56, -14, -78], true, 0.5);
  fill(ctx, base, -4, -62, 22, 34, 3);
  // 지느러미
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 8, -88);
    ctx.quadraticCurveTo(s * 30, -96, s * 26, -72);
    ctx.quadraticCurveTo(s * 18, -74, s * 12, -70);
    ctx.closePath();
    fill(ctx, lighten(base, 0.05), s * 18, -84, 10, 10, 2.4);
  }
  // 색소 점
  for (const [x, y, r] of [
    [-8, -76, 2.4],
    [6, -82, 2],
    [10, -64, 2.6],
    [-12, -60, 2],
    [2, -68, 1.6],
  ]) {
    circ(ctx, x, y, r);
    ctx.fillStyle = alpha("#c2337a", 0.55);
    ctx.fill();
  }
  gloss(ctx, -9, -72, 6, 12, 0.6, 0.15);
  bounce(ctx, 0, -48, 20, 18, 0.45);
  eye(ctx, -9, -46, 8, p, { iris: "#5a2a86" });
  eye(ctx, 9, -46, 8, p, { iris: "#5a2a86" });
  if (puff && !p.soaked) {
    ell(ctx, 0, -32, 7, 6);
    fill(ctx, lighten(base, 0.2), 0, -32, 7, 6, 2.2);
    ell(ctx, 0, -31, 2.4, 2);
    ctx.fillStyle = "#5b3a8c";
    ctx.fill();
  } else mouth(ctx, 0, -35, 5, p);
  blush(ctx, -16, -38, 5);
  blush(ctx, 16, -38, 5);
  if (p.dizzy) dizzyStars(ctx, p.now, -102, 18);
  wetDrops(ctx, p, -104, 18);
});

/* ================================================================
 * 문어 공통 — 머리 · 다리(빨판) · 얼굴
 * ============================================================== */
function octoLegs(ctx, base, t, n = 4, spread = 1, curl = 1) {
  for (let i = 0; i < n; i++) {
    const s = i < n / 2 ? -1 : 1;
    const k = i % (n / 2);
    const x0 = s * (6 + k * 11);
    const w = Math.sin(t * 4.5 + i * 1.3) * 9;
    const ex = s * (24 + k * 9) * spread + w * 0.5;
    const ey = -4 - k * 3;
    limb(ctx, [x0, -24, x0 + s * 10 + w, -18, ex, ey], 9, base, { line: 4 });
    // 끝 말림
    ctx.beginPath();
    ctx.arc(ex + s * 4 * curl, ey - 3, 4.5, s > 0 ? Math.PI : 0, s > 0 ? TAU * 0.9 : Math.PI * 1.9, s < 0);
    stroke(ctx, lineOf(base), 3);
    // 빨판
    for (let j = 1; j <= 2; j++) {
      const u = j / 3;
      circ(ctx, x0 + (ex - x0) * u + s * 2, -24 + (ey + 24) * u + 3, 2.1);
      ctx.fillStyle = lighten(base, 0.45);
      ctx.fill();
    }
  }
}

def("mischief-octopus", (ctx, e, p) => {
  const base = "#9b62ff";
  const t = p.t;
  octoLegs(ctx, darken(base, 0.04), t, 6, 1.05);
  // 머리
  smooth(ctx, [-34, -30, -36, -58, -22, -80, 0, -86, 22, -80, 36, -58, 34, -30, 16, -22, -16, -22], true, 0.5);
  fill(ctx, base, -6, -58, 36, 34, 3);
  for (const [x, y, r] of [
    [16, -72, 4],
    [24, -58, 3],
    [-24, -48, 3.2],
    [-14, -72, 2.4],
  ]) {
    circ(ctx, x, y, r);
    ctx.fillStyle = alpha(darken(base, 0.3), 0.5);
    ctx.fill();
  }
  gloss(ctx, -14, -70, 12, 7, 0.55);
  bounce(ctx, 0, -50, 32, 30, 0.45);
  // 반다나 (빨간 물방울 무늬 + 매듭)
  ctx.beginPath();
  ctx.moveTo(-35, -60);
  ctx.quadraticCurveTo(0, -78, 35, -60);
  ctx.quadraticCurveTo(36, -54, 33, -50);
  ctx.quadraticCurveTo(0, -66, -33, -50);
  ctx.quadraticCurveTo(-37, -55, -35, -60);
  ctx.closePath();
  fill(ctx, "#ef3e4a", 0, -62, 34, 10, 2.4);
  for (let i = -3; i <= 3; i++) dot(ctx, i * 9, -63 + Math.abs(i) * 1.6, 1.9, "#ffffff");
  ctx.save();
  ctx.translate(34, -56);
  ctx.rotate(Math.sin(t * 6) * 0.15);
  smooth(ctx, [0, 0, 14, -10, 18, -2, 12, 4], true, 0.5);
  fill(ctx, "#ef3e4a", 9, -3, 8, 6, 2);
  smooth(ctx, [0, 0, 12, 10, 8, 14, 2, 6], true, 0.5);
  fill(ctx, "#ef3e4a", 6, 7, 6, 6, 2);
  ctx.restore();
  // 얼굴: 윙크 + 장난 웃음
  eye(ctx, -12, -44, 8.5, p, { happy: !p.soaked && !p.dizzy && p.hit < 0.4 });
  eye(ctx, 12, -44, 8.5, p, { iris: "#3a1f7a", look: 0.3 });
  if (!p.soaked) {
    brow(ctx, -12, -57, 7, -2, 3);
    brow(ctx, 12, -58, 7, -4, 3);
  }
  mouth(ctx, 0, -32, 10, p, p.angry ? "grin" : "open");
  blush(ctx, -24, -36, 6);
  blush(ctx, 24, -36, 6);
  // 던지기 직전: 물풍선을 번쩍
  if (e.atkT != null && e.atkT < 0.8 && !p.soaked && e.d && e.d.attackPattern === "lob") {
    limb(ctx, [26, -40, 40, -60, 36, -82], 8, base, { line: 4 });
    circ(ctx, 36, -94, 12);
    fill(ctx, "#ff7eb6", 36, -94, 12, 12, 2.4);
    gloss(ctx, 31, -99, 4, 3, 0.85);
  }
  if (p.dizzy) dizzyStars(ctx, p.now, -96, 24);
  wetDrops(ctx, p, -96, 24);
});

def("teleport-octopus", (ctx, e, p) => {
  const base = "#1fbfae";
  const t = p.t;
  // 마법 반짝이 고리
  for (let i = 0; i < 5; i++) {
    const a = t * 2.2 + (i / 5) * TAU;
    sparkle(ctx, Math.cos(a) * 44, -52 + Math.sin(a) * 18, 5 + (i % 2) * 2, 0.5 + 0.5 * Math.sin(t * 5 + i), "200,255,250");
  }
  octoLegs(ctx, darken(base, 0.06), t, 4, 0.9);
  // 길쭉한 머리
  smooth(ctx, [-28, -28, -32, -60, -18, -88, 0, -94, 18, -88, 32, -60, 28, -28, 12, -22, -12, -22], true, 0.5);
  fill(ctx, base, -6, -60, 32, 36, 3);
  for (let i = 0; i < 3; i++) star(ctx, -12 + i * 12, -78 + (i % 2) * 8, 3.4, alpha("#e6fffb", 0.75), i, null);
  gloss(ctx, -12, -74, 9, 9, 0.5);
  bounce(ctx, 0, -52, 28, 30, 0.45);
  // 나비넥타이
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(-10, -32);
  ctx.lineTo(-10, -20);
  ctx.closePath();
  ctx.moveTo(0, -26);
  ctx.lineTo(10, -32);
  ctx.lineTo(10, -20);
  ctx.closePath();
  flat(ctx, "#c2337a", 2, "#6a0f3a");
  dot(ctx, 0, -26, 2.6, "#ffcf33");
  // 마술 모자
  ctx.save();
  ctx.translate(2, -86);
  ctx.rotate(-0.12);
  ell(ctx, 0, 4, 26, 6);
  fill(ctx, "#2b2d4a", 0, 4, 26, 6, 2.4);
  rrect(ctx, -16, -30, 32, 34, 5);
  fill(ctx, "#2b2d4a", -4, -14, 16, 18, 2.4);
  ctx.fillStyle = "#8c4bd8";
  ctx.fillRect(-16, -6, 32, 6);
  star(ctx, 0, -18, 6, "#ffe066", t, "#a36a00");
  gloss(ctx, -8, -22, 4, 9, 0.35, 0);
  ctx.restore();
  // 지팡이
  ctx.save();
  ctx.translate(30, -36);
  ctx.rotate(-0.7 + Math.sin(t * 3) * 0.2);
  rrect(ctx, -2, -30, 4, 30, 2);
  flat(ctx, "#2b2d4a", 1.4, "#000");
  rrect(ctx, -2.2, -32, 4.4, 6, 1.5);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  sparkle(ctx, 0, -36, 7, 0.9);
  ctx.restore();
  eye(ctx, -11, -50, 8.5, p, { iris: "#6a2fd0" });
  eye(ctx, 11, -50, 8.5, p, { iris: "#6a2fd0" });
  if (!p.soaked && !p.blink) {
    star(ctx, -10, -50, 2.6, "#ffffff", t * 2, null);
    star(ctx, 12, -50, 2.6, "#ffffff", t * 2, null);
  }
  mouth(ctx, 0, -36, 7, p, "smile");
  blush(ctx, -21, -40, 5);
  blush(ctx, 21, -40, 5);
  if (p.dizzy) dizzyStars(ctx, p.now, -124, 22);
});

def("ghost-octopus", (ctx, e, p) => {
  const t = p.t;
  ctx.save();
  // 은은한 빛
  ctx.globalCompositeOperation = "lighter";
  shadow(ctx, 0, -48, 56, 52, 0.35, "120,240,255");
  ctx.restore();
  // 유령처럼 물결치는 아랫단
  ctx.beginPath();
  ctx.moveTo(-32, -50);
  ctx.quadraticCurveTo(-34, -88, 0, -90);
  ctx.quadraticCurveTo(34, -88, 32, -50);
  for (let i = 0; i <= 6; i++) {
    const x = 32 - i * (64 / 6);
    const y = -12 + Math.sin(t * 5 + i * 1.4) * 5 + (i % 2) * 8;
    ctx.quadraticCurveTo(x + 4, y + 8, x - 5, y);
  }
  ctx.closePath();
  ctx.fillStyle = linear(ctx, "ghostbody", 0, -90, 0, -8, [
    [0, "rgba(235,255,255,0.86)"],
    [0.6, "rgba(170,235,255,0.62)"],
    [1, "rgba(120,210,255,0.25)"],
  ]);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = "rgba(90,200,240,0.9)";
  ctx.stroke();
  // 몸속 빛나는 심장
  const pulse = 0.6 + 0.4 * Math.sin(t * 4);
  shadow(ctx, 0, -40, 14 * pulse + 6, 10 * pulse + 4, 0.7, "255,170,240");
  gloss(ctx, -12, -74, 10, 6, 0.75);
  eye(ctx, -11, -58, 8, p, { iris: "#2aa6c8", lid: p.soaked ? 0 : 0.3, lidColor: "rgba(210,245,255,0.95)" });
  eye(ctx, 11, -58, 8, p, { iris: "#2aa6c8", lid: p.soaked ? 0 : 0.3, lidColor: "rgba(210,245,255,0.95)" });
  mouth(ctx, 0, -44, 6, p, "smile", "#3a8fb0");
  blush(ctx, -20, -48, 5);
  blush(ctx, 20, -48, 5);
  for (let i = 0; i < 3; i++) sparkle(ctx, Math.cos(t * 1.6 + i * 2.1) * 40, -60 + Math.sin(t * 1.6 + i * 2.1) * 26, 5, 0.5 + 0.5 * Math.sin(t * 4 + i), "235,255,255");
  if (p.dizzy) dizzyStars(ctx, p.now, -100, 22);
});

/* ================================================================
 * 아기 상어 — 둥근 콧등, 흰 배, 작은 세모 이빨, 입 벌리면 약점
 * ============================================================== */
def("baby-shark", (ctx, e, p) => {
  const base = "#6d9fdc";
  const t = p.t;
  const open = p.open && !p.soaked;
  // 등지느러미
  smooth(ctx, [-20, -40, -14, -70, -4, -76, 2, -60, 8, -42], true, 0.4);
  fill(ctx, darken(base, 0.06), -8, -58, 12, 18, 2.8);
  // 머리 (둥근 콧등)
  smooth(ctx, [-42, 4, -42, -24, -24, -44, 6, -46, 34, -40, 50, -20, 50, -4, 40, 4], true, 0.5);
  fill(ctx, base, 0, -24, 46, 26, 3);
  // 흰 배
  ctx.save();
  smooth(ctx, [-42, 4, -42, -24, -24, -44, 6, -46, 34, -40, 50, -20, 50, -4, 40, 4], true, 0.5);
  ctx.clip();
  smooth(ctx, [-20, 8, 0, -12, 26, -14, 52, -16, 52, 10], true, 0.5);
  ctx.fillStyle = linear(ctx, "sharkbelly", 0, -16, 0, 8, [
    [0, "#ffffff"],
    [1, "#d8e6f6"],
  ]);
  ctx.fill();
  ctx.restore();
  // 아가미
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-18 + i * 6, -28);
    ctx.quadraticCurveTo(-22 + i * 6, -18, -18 + i * 6, -8);
    stroke(ctx, alpha(darken(base, 0.4), 0.7), 2.2);
  }
  gloss(ctx, -12, -36, 16, 5, 0.55);
  bounce(ctx, 4, -20, 44, 22, 0.4);
  if (open) {
    smooth(ctx, [18, -22, 30, -30, 48, -26, 50, -12, 40, -4, 24, -6], true, 0.5);
    flat(ctx, "#a3254a", 2.6, "#5a0f26");
    ell(ctx, 36, -9, 9, 4);
    ctx.fillStyle = "#ff8aa5";
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(22 + i * 6, -24 + i * 0.6);
      ctx.lineTo(25 + i * 6, -18);
      ctx.lineTo(28 + i * 6, -24 + i * 0.6);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(18, -16);
    ctx.quadraticCurveTo(34, -4, 50, -14);
    stroke(ctx, "#2a3d66", 3);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(24 + i * 6, -12 + Math.abs(i - 1.5) * -1);
      ctx.lineTo(27 + i * 6, -7);
      ctx.lineTo(30 + i * 6, -12 + Math.abs(i - 1.5) * -1);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  }
  eye(ctx, 20, -30, 8.5, p, { iris: "#1f3f7a", look: 0.35 });
  blush(ctx, 32, -24, 6);
  // 가슴지느러미
  ctx.save();
  ctx.translate(0, -6);
  ctx.rotate(0.5 + Math.sin(t * 6) * 0.2);
  smooth(ctx, [0, 0, -6, 12, -18, 16, -12, 4], true, 0.5);
  fill(ctx, darken(base, 0.08), -8, 8, 9, 8, 2.2);
  ctx.restore();
  if (p.dizzy) dizzyStars(ctx, p.now, -80, 22);
  wetDrops(ctx, p, -84, 24);
});

/* ================================================================
 * 아기 악어 — 긴 주둥이 · 등 비늘 · 눈 혹 · 입 쩍 (약점)
 * ============================================================== */
def("baby-croc", (ctx, e, p) => {
  const base = "#5fbf4f";
  const open = p.open && !p.soaked;
  const jaw = open ? 0.42 : 0;
  // 등 비늘
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-40 + i * 9, -10);
    ctx.lineTo(-36 + i * 9, -20 - (i % 2) * 3);
    ctx.lineTo(-32 + i * 9, -10);
    ctx.closePath();
    fill(ctx, darken(base, 0.12), -36 + i * 9, -14, 5, 6, 1.8);
  }
  // 아래턱
  smooth(ctx, [-30, 2, -24, -10, 20, -8, 52, -6, 54, 2, 40, 6], true, 0.4);
  fill(ctx, lighten(base, 0.08), 12, -2, 40, 8, 2.6);
  if (open) {
    smooth(ctx, [0, -10, 50, -8, 46, -34, 10, -26], true, 0.3);
    flat(ctx, "#b0254f", 2.4, "#5a0f26");
    ell(ctx, 28, -14, 12, 4);
    ctx.fillStyle = "#ff8aa5";
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(14 + i * 7, -8);
      ctx.lineTo(17 + i * 7, -13);
      ctx.lineTo(20 + i * 7, -8);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
  }
  // 위턱 + 머리
  ctx.save();
  ctx.translate(0, -10);
  ctx.rotate(-jaw);
  smooth(ctx, [-34, 8, -38, -20, -16, -32, 8, -28, 18, -18, 52, -12, 58, -4, 50, 2], true, 0.45);
  fill(ctx, base, 6, -12, 46, 16, 3);
  // 콧구멍 혹
  for (const x of [46, 52]) {
    circ(ctx, x, -10, 3.4);
    fill(ctx, base, x, -10, 3.4, 3.4, 1.8);
  }
  // 이빨 (위)
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(12 + i * 7, 2);
    ctx.lineTo(15 + i * 7, 8);
    ctx.lineTo(18 + i * 7, 2);
    ctx.closePath();
    flat(ctx, "#ffffff", 1.2, "#3d5a33");
  }
  // 비늘 점
  for (let i = 0; i < 4; i++) {
    ell(ctx, -22 + i * 8, -14, 3, 2);
    ctx.fillStyle = alpha(darken(base, 0.3), 0.5);
    ctx.fill();
  }
  gloss(ctx, 18, -20, 14, 3.5, 0.45, 0);
  // 눈 혹
  for (const x of [-12, 6]) {
    circ(ctx, x, -30, 11);
    fill(ctx, base, x, -30, 11, 11, 2.6);
  }
  eye(ctx, -12, -33, 7, p, { iris: "#b7741a", look: 0.4, lid: p.soaked ? 0 : 0.25, lidColor: base });
  eye(ctx, 6, -34, 7, p, { iris: "#b7741a", look: 0.4, lid: p.soaked ? 0 : 0.25, lidColor: base });
  ctx.restore();
  blush(ctx, 20, -14, 6);
  if (p.dizzy) dizzyStars(ctx, p.now, -60, 22);
  wetDrops(ctx, p, -62, 22);
});
