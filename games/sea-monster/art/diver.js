/*
 * 바다괴물 탐험대 — 어린 탐험대장 '지혁' (옆모습 · 헤엄)
 *
 * 탐험 헬멧(전등) · 큰 잠수 마스크 · 산소탱크 · 노란 오리발 · 아쿠아 물총.
 * 좌표: 원점 = 몸통 가운데, 오른쪽을 본다(+x 가 머리 쪽). 1 = 1px (게임에서는 약 0.72배로 그린다).
 *
 * pose = {
 *   t, face(1 오른쪽 · -1 왼쪽), pitch(몸 기울기: 0 수평, -1.2 거의 선 자세),
 *   aim(조준 각도, 월드 기준 라디안), kick(발차기 빠르기 0~1), recoil(0~1), firing,
 *   mood: "go" | "happy" | "wow" | "hurt" | "sad", blink, hit(0~1 맞은 직후)
 * }
 * drawDiver 는 pose.nozzle = {x,y} (몸 원점 기준 월드 방향 좌표)을 채워 준다 → 물줄기 시작점.
 */
import { INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss, shadow, limb, blush } from "../../ocean-blaster/art/kit.js?v=3";

export const DIVER = {
  suit: "#2d4f9e",
  panel: "#ff7a1a",
  trim: "#13b5a8",
  helmet: "#ff8a2a",
  stripe: "#ffffff",
  mask: "#13b5a8",
  glass: "#bff3ff",
  skin: "#ffd5b3",
  glove: "#25c2b4",
  fin: "#ffd23f",
  tank: "#dff4ff",
  band: "#ff7a1a",
  gun: "#3fd3ff",
  nozzle: "#ff8a2a",
};
const C = DIVER;
const R2 = (v) => Math.round(v);

/** 몸 좌표(x,y)를 pitch 만큼 돌린 점 */
function rot(x, y, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

/* ---------------- 다리 · 오리발 ---------------- */
function leg(ctx, hip, ph, amp, far) {
  const k = Math.sin(ph) * amp;
  const suit = far ? darken(C.suit, 0.22) : C.suit;
  const finC = far ? darken(C.fin, 0.2) : C.fin;
  const knee = [hip[0] - 19, hip[1] + 4 + k * 0.45];
  const ank = [knee[0] - 17, knee[1] + 2 + k * 0.9];
  limb(ctx, [hip[0], hip[1], (hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2 - 2, knee[0], knee[1]], 16, suit, { line: 3 });
  limb(ctx, [knee[0], knee[1], ank[0], ank[1]], 14, suit, { line: 3 });
  // 무릎 보호대
  ell(ctx, knee[0] + 1, knee[1] + 3, 6.5, 5);
  ctx.fillStyle = far ? darken(C.panel, 0.25) : C.panel;
  ctx.fill();
  // 오리발: 발목에서 뒤로 넓게, 차는 방향 반대로 휜다
  const bend = -k * 0.6;
  ctx.save();
  ctx.translate(ank[0], ank[1]);
  ctx.rotate(0.1 + k * 0.02);
  ctx.beginPath();
  ctx.moveTo(4, -7);
  ctx.quadraticCurveTo(-18, -9 + bend * 0.4, -40, -14 + bend);
  ctx.quadraticCurveTo(-46, -2 + bend, -42, 10 + bend);
  ctx.quadraticCurveTo(-18, 9 + bend * 0.4, 4, 7);
  ctx.closePath();
  fill(ctx, finC, -18, 0, 26, 14, 2.6);
  // 오리발 줄무늬
  ctx.beginPath();
  ctx.moveTo(-4, -2);
  ctx.quadraticCurveTo(-22, -3 + bend * 0.5, -38, -5 + bend);
  ctx.moveTo(-4, 3);
  ctx.quadraticCurveTo(-22, 3 + bend * 0.5, -38, 5 + bend);
  stroke(ctx, alpha(darken(finC, 0.35), 0.55), 1.6);
  // 발 (부츠)
  ell(ctx, 2, 0, 9, 7.5);
  fill(ctx, far ? darken(C.trim, 0.25) : C.trim, 0, -1, 9, 8, 2.2);
  ctx.restore();
}

/* ---------------- 산소탱크 ---------------- */
function tank(ctx, far) {
  ctx.save();
  ctx.translate(-4, -20);
  rrect(ctx, -26, -10, 50, 20, 10);
  ctx.fillStyle = linear(ctx, "dvTank", 0, -10, 0, 10, [
    [0, "#ffffff"],
    [0.35, C.tank],
    [1, "#8fb7d6"],
  ]);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = lineOf("#8fb7d6");
  ctx.stroke();
  // 주황 띠 두 줄
  for (const x of [-14, 6]) {
    rrect(ctx, x, -10, 6, 20, 2);
    ctx.fillStyle = C.band;
    ctx.fill();
  }
  // 밸브 (앞쪽 = 머리 쪽)
  rrect(ctx, 23, -6, 8, 12, 3);
  flat(ctx, "#9aa7bd", 1.6, "#55627a");
  circ(ctx, 32, -9, 4);
  flat(ctx, "#ff5a3c", 1.4, "#8a1f12");
  gloss(ctx, -6, -5, 16, 3, 0.85, 0);
  ctx.restore();
}

/* ---------------- 몸통 ---------------- */
function torso(ctx) {
  ell(ctx, 0, 0, 31, 21);
  fill(ctx, C.suit, -4, -6, 31, 21, 3);
  // 가슴 주황 패널 + 청록 테
  ctx.save();
  ell(ctx, 0, 0, 31, 21);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(8, -24);
  ctx.quadraticCurveTo(26, -6, 22, 24);
  ctx.lineTo(40, 24);
  ctx.lineTo(40, -24);
  ctx.closePath();
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, -24);
  ctx.quadraticCurveTo(26, -6, 22, 24);
  stroke(ctx, C.trim, 3);
  // 배 쪽 그늘
  ctx.fillStyle = alpha("#0b1b3d", 0.22);
  ctx.fillRect(-34, 10, 70, 14);
  ctx.restore();
  // 하네스 (탱크 끈) + 허리 벨트
  ctx.beginPath();
  ctx.moveTo(14, -19);
  ctx.quadraticCurveTo(6, 0, 12, 19);
  stroke(ctx, "#1d2233", 4.5);
  rrect(ctx, -20, -21, 7, 42, 3);
  flat(ctx, "#1d2233");
  rrect(ctx, -21, 4, 9, 9, 2);
  flat(ctx, "#ffd23f", 1.2, "#7a5a00");
  gloss(ctx, -8, -12, 14, 4, 0.5, -0.1);
}

/* ---------------- 머리 (헬멧 · 마스크 · 전등) ---------------- */
function head(ctx, st) {
  const t = st.t || 0;
  const mood = st.mood || "go";
  const r = 23;
  ctx.scale(1.14, 1.14);
  // 얼굴 (마스크 아래 볼과 입)
  ell(ctx, 9, 8, 15, 13);
  fill(ctx, C.skin, 6, 4, 15, 13, 2.4);
  // 헬멧 (뒤 · 위를 감싼다)
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 0.62, Math.PI * 2.1);
  ctx.quadraticCurveTo(r * 0.55, -2, r * 0.2, r * 0.42);
  ctx.quadraticCurveTo(-4, r * 0.8, -r * 0.35, r * 0.94);
  ctx.closePath();
  fill(ctx, C.helmet, -6, -8, r, r, 2.8);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  // 흰 가운데 줄
  ctx.beginPath();
  ctx.arc(0, 0, r - 4, Math.PI * 1.02, Math.PI * 1.62);
  stroke(ctx, C.stripe, 7);
  ctx.restore();
  // 옆 볼트 + 귀 보호대
  circ(ctx, -6, 4, 7.5);
  fill(ctx, "#ffc06a", -7, 3, 7.5, 7.5, 2.2);
  circ(ctx, -6, 4, 2.6);
  flat(ctx, "#b8681a");
  // 헤드램프 (앞이마)
  ctx.save();
  ctx.translate(12, -r + 3);
  ctx.rotate(0.35);
  rrect(ctx, -7, -6, 16, 12, 4);
  flat(ctx, "#2a3142", 2, "#121722");
  ell(ctx, 9, 0, 4.5, 6);
  ctx.fillStyle = st.lamp ? "#fffbe0" : "#cfe9ff";
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#5b6478";
  ctx.stroke();
  ctx.restore();
  // 잠수 마스크 (청록 테 + 유리, 그 안에 눈)
  ctx.save();
  ctx.translate(13, -3);
  rrect(ctx, -11, -11, 24, 20, 9);
  fill(ctx, C.mask, 0, -2, 12, 10, 2.6);
  rrect(ctx, -8, -8, 19, 14, 7);
  ctx.fillStyle = linear(ctx, "dvGlass", 0, -8, 0, 6, [
    [0, "#ffffff"],
    [0.4, C.glass],
    [1, "#7cd6f5"],
  ]);
  ctx.fill();
  // 눈 (마스크 안)
  const blink = st.blink;
  const ex = 3 + (st.lookX || 0) * 1.5;
  const ey = -1 + (st.lookY || 0) * 1.5;
  if (mood === "happy") {
    ctx.beginPath();
    ctx.arc(ex, ey + 2, 4, Math.PI * 1.1, Math.PI * 1.9);
    stroke(ctx, INK, 2.4);
  } else if (mood === "hurt") {
    ctx.beginPath();
    ctx.moveTo(ex - 4, ey - 3);
    ctx.lineTo(ex + 3, ey);
    ctx.lineTo(ex - 4, ey + 3);
    stroke(ctx, INK, 2.4);
  } else if (blink) {
    ctx.beginPath();
    ctx.moveTo(ex - 4, ey);
    ctx.lineTo(ex + 4, ey);
    stroke(ctx, INK, 2.4);
  } else {
    const big = mood === "wow" ? 1.25 : 1;
    ell(ctx, ex, ey, 4.4 * big, 5.4 * big);
    ctx.fillStyle = INK;
    ctx.fill();
    circ(ctx, ex + 1.4, ey - 2, 1.7);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    // 용감한 눈썹 (마스크 유리 위로 살짝)
    ctx.beginPath();
    ctx.moveTo(ex - 5, ey - 8.5 + (mood === "go" ? 1 : 0));
    ctx.lineTo(ex + 4, ey - (mood === "go" ? 9.8 : 8.5));
    stroke(ctx, alpha(INK, 0.8), 2);
  }
  // 유리 반사
  ctx.beginPath();
  ctx.moveTo(-5, -5);
  ctx.lineTo(1, -7);
  stroke(ctx, alpha("#ffffff", 0.9), 2.2);
  ctx.restore();
  // 입 (마스크 아래)
  ctx.beginPath();
  if (mood === "happy" || mood === "wow") {
    ctx.moveTo(10, 13);
    ctx.quadraticCurveTo(15, 20, 21, 13);
    ctx.closePath();
    flat(ctx, "#7a2a2a", 1.6, INK);
  } else if (mood === "hurt" || mood === "sad") {
    ctx.moveTo(11, 16);
    ctx.quadraticCurveTo(15, 12, 20, 16);
    stroke(ctx, INK, 2);
  } else {
    ctx.moveTo(11, 14);
    ctx.quadraticCurveTo(15, 18, 20, 13.5);
    stroke(ctx, INK, 2);
  }
  blush(ctx, 5, 13, 4);
  gloss(ctx, -8, -12, 10, 4.5, 0.8, -0.5);
  // 헬멧 위 테두리 빛
  ctx.beginPath();
  ctx.arc(0, 0, r - 1.5, Math.PI * 1.15, Math.PI * 1.55);
  stroke(ctx, alpha("#ffffff", 0.5), 2);
}

/* ---------------- 물총 (AQUA HUNTER) ---------------- */
function gun(ctx, st) {
  const t = st.t || 0;
  const rec = (st.recoil || 0) * 6;
  ctx.save();
  ctx.translate(-rec, 0);
  // 몸통
  rrect(ctx, -10, -9, 46, 18, 8);
  fill(ctx, C.gun, 10, -4, 24, 10, 2.6);
  // 물 탱크 (투명 · 출렁)
  rrect(ctx, -4, -17, 24, 11, 5);
  ctx.fillStyle = alpha("#e9fbff", 0.85);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = lineOf(C.gun);
  ctx.stroke();
  ctx.save();
  rrect(ctx, -4, -17, 24, 11, 5);
  ctx.clip();
  ctx.beginPath();
  const sl = Math.sin(t * 9) * 1.5;
  ctx.moveTo(-6, -11 + sl);
  ctx.quadraticCurveTo(8, -13 - sl, 22, -11 + sl);
  ctx.lineTo(22, -4);
  ctx.lineTo(-6, -4);
  ctx.closePath();
  ctx.fillStyle = "#4fc8ff";
  ctx.fill();
  ctx.restore();
  // 주황 노즐
  rrect(ctx, 34, -6, 12, 12, 4);
  fill(ctx, C.nozzle, 40, -2, 7, 6, 2.2);
  ell(ctx, 46, 0, 2.6, 4);
  ctx.fillStyle = "#1b2233";
  ctx.fill();
  // 손잡이
  rrect(ctx, -6, 6, 10, 14, 4);
  fill(ctx, "#2a7de1", -2, 12, 6, 8, 2);
  gloss(ctx, 8, -5, 12, 2.5, 0.8, 0);
  ctx.restore();
}

/* ---------------- 팔 ---------------- */
function arm(ctx, sh, hand, far) {
  const suit = far ? darken(C.suit, 0.22) : C.suit;
  const mid = [(sh[0] + hand[0]) / 2, (sh[1] + hand[1]) / 2 + 5];
  limb(ctx, [sh[0], sh[1], mid[0], mid[1], hand[0], hand[1]], 11.5, suit, { line: 3 });
  ell(ctx, hand[0], hand[1], 7, 6.5);
  fill(ctx, far ? darken(C.glove, 0.2) : C.glove, R2(hand[0]), R2(hand[1]), 7, 7, 2);
}

/* ================================================================
 * 지혁 그리기
 * ============================================================== */
export function drawDiver(ctx, st) {
  const t = st.t || 0;
  const face = st.face || 1;
  const pitch = st.pitch || 0;
  const kick = st.kick == null ? 0.4 : st.kick;
  const ph = t * (5 + kick * 9);
  const amp = 6 + kick * 9;
  // 조준 각도 → 오른쪽을 보는 몸 기준
  let aim = st.aim == null ? 0 : st.aim;
  if (face < 0) aim = Math.PI - aim;
  ctx.save();
  if (st.hit) ctx.translate(Math.sin(t * 60) * 3 * st.hit, 0);
  ctx.scale(face, 1);
  // 맞으면 빨갛게 번쩍
  // ---- 몸통 묶음 (pitch 로 회전) ----
  ctx.save();
  ctx.rotate(pitch);
  leg(ctx, [-22, 4], ph + Math.PI, amp, true);
  tank(ctx);
  torso(ctx);
  leg(ctx, [-20, 8], ph, amp, false);
  ctx.restore();
  // ---- 머리: 몸이 서 있어도 얼굴은 거의 수평을 본다 ----
  const neck = rot(30, -4, pitch);
  const aimTilt = Math.max(-0.45, Math.min(0.45, Math.atan2(Math.sin(aim), Math.abs(Math.cos(aim)) + 0.2) * 0.35));
  const headRot = pitch * 0.25 + aimTilt + Math.sin(t * 2.2) * 0.03;
  // 어깨 · 손 (조준)
  const shN = rot(16, 2, pitch);
  const shF = rot(20, -2, pitch);
  const reach = 30;
  const ca = Math.cos(aim);
  const sa = Math.sin(aim);
  const handN = [shN[0] + ca * reach * 0.8 - sa * 4, shN[1] + sa * reach * 0.8 + ca * 4];
  // 먼 팔은 물총 앞 손잡이 (앞쪽을 겨눌 때만)
  const fwd = Math.cos(aim) > -0.2;
  const gunAt = [handN[0], handN[1]];
  const front = [gunAt[0] + ca * 22 - sa * 2, gunAt[1] + sa * 22 + ca * 2];
  if (fwd) arm(ctx, shF, front, true);
  else {
    const sw = Math.sin(t * 4) * 6;
    arm(ctx, shF, [shF[0] - 6, shF[1] + 24 + sw], true);
  }
  ctx.save();
  ctx.translate(neck[0] + 15, neck[1] - 12);
  ctx.rotate(headRot);
  head(ctx, st);
  ctx.restore();
  // 물총 (손에서 조준 방향으로)
  ctx.save();
  ctx.translate(gunAt[0], gunAt[1]);
  ctx.rotate(aim);
  ctx.translate(-2, -2);
  gun(ctx, st);
  ctx.restore();
  arm(ctx, shN, handN, false);
  ctx.restore();
  // 물줄기 시작점 (월드 방향, 몸 원점 기준)
  const nx = gunAt[0] + ca * (44 - (st.recoil || 0) * 6) - sa * -2;
  const ny = gunAt[1] + sa * (44 - (st.recoil || 0) * 6) + ca * -2;
  st.nozzle = { x: nx * face, y: ny };
  st.mouth = { x: (neck[0] + 30) * face, y: neck[1] - 2 };
}

/* ================================================================
 * 앞모습 초상 (메뉴 · 결과) — 원점: 가슴 아래 가운데, 높이 약 220
 *  내 얼굴 사진이 켜져 있으면 마스크를 이마 위로 올리고 사진을 그린다 (화면에만).
 * ============================================================== */
export function drawDiverPortrait(ctx, st = {}) {
  const t = st.t || 0;
  const mood = st.mood || "happy";
  const r = 54;
  const hy = -132;
  ctx.save();
  // 탱크 (어깨 뒤로)
  for (const s of [-1, 1]) {
    rrect(ctx, s * 52 - 13, -110, 26, 90, 13);
    fill(ctx, C.tank, s * 52 - 4, -86, 13, 44, 2.6);
    rrect(ctx, s * 52 - 13, -84, 26, 8, 2);
    ctx.fillStyle = C.band;
    ctx.fill();
  }
  // 몸 (잠수복 + 가슴 패널)
  ctx.beginPath();
  ctx.moveTo(-74, 0);
  ctx.bezierCurveTo(-76, -48, -52, -76, -24, -82);
  ctx.lineTo(24, -82);
  ctx.bezierCurveTo(52, -76, 76, -48, 74, 0);
  ctx.closePath();
  fill(ctx, C.suit, -18, -50, 68, 50, 3);
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(-24, -70);
  ctx.quadraticCurveTo(0, -78, 24, -70);
  ctx.lineTo(30, 0);
  ctx.closePath();
  fill(ctx, C.panel, -6, -44, 34, 40, 3);
  ctx.beginPath();
  ctx.moveTo(-24, -70);
  ctx.quadraticCurveTo(0, -78, 24, -70);
  stroke(ctx, C.trim, 4);
  // 하네스
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 40, -74);
    ctx.quadraticCurveTo(s * 34, -36, s * 36, 0);
    stroke(ctx, "#1d2233", 7);
  }
  rrect(ctx, -12, -40, 24, 14, 4);
  flat(ctx, "#ffd23f", 1.6, "#7a5a00");
  // 목
  rrect(ctx, -14, hy + 36, 28, 22, 8);
  ctx.fillStyle = mix(C.skin, "#d9946b", 0.2);
  ctx.fill();
  // 헬멧 뒤 (얼굴 뒤로 보이는 둥근 테)
  circ(ctx, 0, hy - 4, r + 10);
  fill(ctx, C.helmet, -12, hy - 24, r + 10, r + 10, 3);
  ctx.save();
  circ(ctx, 0, hy - 4, r + 10);
  ctx.clip();
  ctx.fillStyle = C.stripe;
  ctx.fillRect(-9, hy - 80, 18, 40);
  ctx.restore();
  for (const s of [-1, 1]) {
    circ(ctx, s * (r + 6), hy + 6, 14);
    fill(ctx, "#ffc06a", s * (r + 6) - 2, hy + 4, 14, 14, 2.6);
  }
  // 얼굴 (사진이 있으면 사진)
  let photo = false;
  if (st.face !== false && window.TodayFace && TodayFace.drawHead) {
    photo = TodayFace.drawHead(ctx, 0, hy + 8, r * 0.84, { ring: 3, ringColor: lineOf(C.skin) });
  }
  if (!photo) {
    ell(ctx, 0, hy + 8, r * 0.84, r * 0.82);
    fill(ctx, C.skin, -10, hy - 2, r * 0.84, r * 0.82, 2.6);
    const happy = mood === "happy" || mood === "win";
    for (const s of [-1, 1]) {
      if (happy) {
        ctx.beginPath();
        ctx.arc(s * 17, hy + 10, 7, Math.PI * 1.1, Math.PI * 1.9);
        stroke(ctx, INK, 3.4);
      } else {
        ell(ctx, s * 17, hy + 8, 6.5, 8);
        ctx.fillStyle = INK;
        ctx.fill();
        circ(ctx, s * 17 + 2, hy + 5, 2.6);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
      blush(ctx, s * 28, hy + 24, 8);
    }
    ctx.beginPath();
    if (happy) {
      ctx.moveTo(-11, hy + 26);
      ctx.quadraticCurveTo(0, hy + 40, 11, hy + 26);
      ctx.closePath();
      flat(ctx, "#7a2a2a", 2, INK);
    } else {
      ctx.moveTo(-9, hy + 28);
      ctx.quadraticCurveTo(0, hy + 34, 9, hy + 28);
      stroke(ctx, INK, 3);
    }
  }
  // 헬멧 앞 테 + 이마 위로 올린 마스크 + 전등
  ctx.beginPath();
  ctx.arc(0, hy - 4, r + 10, Math.PI * 1.04, Math.PI * 1.96);
  ctx.arc(0, hy - 4, r - 4, Math.PI * 1.94, Math.PI * 1.06, true);
  ctx.closePath();
  fill(ctx, C.helmet, -10, hy - 50, r, 20, 3);
  rrect(ctx, -46, hy - 44, 92, 30, 14);
  fill(ctx, C.mask, -8, hy - 34, 46, 15, 3);
  rrect(ctx, -40, hy - 40, 80, 22, 10);
  ctx.fillStyle = linear(ctx, "pGlass", 0, hy - 40, 0, hy - 18, [
    [0, "#ffffff"],
    [0.45, C.glass],
    [1, "#6ccbea"],
  ]);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-30, hy - 34);
  ctx.lineTo(-16, hy - 37);
  stroke(ctx, alpha("#fff", 0.9), 3);
  rrect(ctx, -14, hy - r - 26, 28, 18, 6);
  flat(ctx, "#2a3142", 2.4, "#121722");
  ell(ctx, 0, hy - r - 17, 9, 6);
  ctx.fillStyle = "#fffbe0";
  ctx.fill();
  const glow = 0.4 + Math.sin(t * 3) * 0.15;
  ctx.fillStyle = radial(ctx, `pLamp${Math.round(glow * 10)}`, 0, hy - r - 17, 0, 0, hy - r - 17, 30, [
    [0, `rgba(255,250,210,${glow})`],
    [1, "rgba(255,250,210,0)"],
  ]);
  circ(ctx, 0, hy - r - 17, 30);
  ctx.fill();
  gloss(ctx, -26, hy - 50, 18, 7, 0.75, -0.4);
  ctx.restore();
}
