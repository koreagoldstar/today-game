/*
 * 바다괴물 탐험대 — 3지역 괴물 (침몰한 보물선)
 *  보물상자괴물 · 창문눈알 · 닻게
 */
import { INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss, limb, blush } from "../../ocean-blaster/art/kit.js?v=3";
import { ART } from "./registry.js?v=1";
import { mEye } from "./monsters1.js?v=1";

const TAU = Math.PI * 2;
function hitFlash(ctx, p, path) {
  if (!p.hit) return;
  ctx.save();
  path();
  ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
  ctx.fill();
  ctx.restore();
}

/* ================================================================
 * 보물상자 (괴물 · 가짜 공통) — open 0 닫힘 ~ 1 활짝
 * ============================================================== */
const CH = { wood: "#a8693a", band: "#ffd23f", dark: "#5a3018", inner: "#4a0f22", tongue: "#ff6f91" };
export function drawChest(ctx, p, mimic = true) {
  const t = p.t || 0;
  const s = p.s || 1;
  const open = Math.max(0, Math.min(1, Math.max(p.open || 0, (p.peek || 0) * 0.25)));
  ctx.save();
  ctx.scale(s, s);
  // 아래 상자
  const box = () => {
    rrect(ctx, -38, -10, 76, 34, 6);
  };
  box();
  ctx.fillStyle = linear(ctx, "chestBox", 0, -10, 0, 24, [
    [0, lighten(CH.wood, 0.15)],
    [1, darken(CH.wood, 0.3)],
  ]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = lineOf(CH.wood);
  ctx.stroke();
  for (const x of [-26, 22]) {
    rrect(ctx, x, -10, 6, 34, 1.5);
    flat(ctx, CH.band, 1.4, "#8a5a00");
  }
  // 나뭇결
  for (const y of [0, 10]) {
    ctx.beginPath();
    ctx.moveTo(-36, y);
    ctx.lineTo(36, y);
    stroke(ctx, alpha(CH.dark, 0.35), 1.4);
  }
  // 입 안 (열리면)
  if (open > 0.03 && mimic) {
    ctx.beginPath();
    ctx.moveTo(-36, -10);
    ctx.lineTo(36, -10);
    ctx.lineTo(36, -10 - open * 34);
    ctx.lineTo(-36, -10 - open * 34);
    ctx.closePath();
    ctx.fillStyle = CH.inner;
    ctx.fill();
    // 이빨 (둥글둥글)
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(-32 + i * 10, -10);
      ctx.lineTo(-27 + i * 10, -18 - open * 4);
      ctx.lineTo(-22 + i * 10, -10);
      flat(ctx, "#fff6e0", 1, "#8a7a6a");
    }
    // 혀 (날름)
    const lick = Math.sin(t * 6) * 6;
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.quadraticCurveTo(10 + lick, -14 - open * 10, 30 + open * 18 + lick, -4 + open * 10);
    ctx.quadraticCurveTo(12, -4, -8, -8);
    ctx.closePath();
    flat(ctx, CH.tongue, 1.6, "#8a2040");
    // 금화 몇 개
    for (const [x, y] of [
      [-20, -14],
      [-12, -18],
    ]) {
      circ(ctx, x, y - open * 6, 4);
      flat(ctx, CH.band, 1.2, "#8a5a00");
    }
  }
  // 뚜껑 (경첩 = 뒤쪽 위)
  ctx.save();
  ctx.translate(-38, -10);
  ctx.rotate(-open * 0.95);
  ctx.translate(38, 10);
  const lid = () => {
    ctx.beginPath();
    ctx.moveTo(-40, -10);
    ctx.lineTo(40, -10);
    ctx.lineTo(40, -26);
    ctx.quadraticCurveTo(0, -44, -40, -26);
    ctx.closePath();
  };
  lid();
  ctx.fillStyle = linear(ctx, "chestLid", 0, -40, 0, -10, [
    [0, lighten(CH.wood, 0.25)],
    [1, CH.wood],
  ]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = lineOf(CH.wood);
  ctx.stroke();
  for (const x of [-27, 21]) {
    ctx.beginPath();
    ctx.moveTo(x + 3, -10);
    ctx.lineTo(x + 3, -36);
    stroke(ctx, CH.band, 6);
  }
  // 자물쇠
  rrect(ctx, -6, -18, 12, 12, 3);
  flat(ctx, CH.band, 1.4, "#8a5a00");
  circ(ctx, 0, -12, 2);
  ctx.fillStyle = "#5a3a00";
  ctx.fill();
  gloss(ctx, -16, -32, 14, 3, 0.55, 0);
  // 뚜껑 틈 사이 눈 (괴물만 · 살짝 열렸을 때)
  ctx.restore();
  if (mimic && open > 0.06) {
    const ey = -14 - open * 18;
    mEye(ctx, -12, ey, 6 + open * 2, p, { angry: (p.wind || 0) > 0.2, white: "#fff6cf", color: "#7a1f3a" });
    mEye(ctx, 12, ey, 6 + open * 2, p, { angry: (p.wind || 0) > 0.2, white: "#fff6cf", color: "#7a1f3a" });
  }
  // 반짝 (가짜도 똑같이 반짝 → 헷갈리게)
  const tw = Math.max(0, Math.sin(t * 2.2 + (p.seed || 0)));
  if (tw > 0.85) {
    ctx.save();
    ctx.translate(28, -30);
    ctx.globalAlpha = (tw - 0.85) / 0.15;
    ctx.fillStyle = "#fffbe0";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? 1.5 : 6;
      const a = (i / 8) * TAU;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.fill();
    ctx.restore();
  }
  hitFlash(ctx, p, box);
  ctx.restore();
}

/* ================================================================
 * 창문눈알 — 둥근 창 안쪽의 외눈 괴물 (창틀은 배 그림 · 이 그림은 유리 안쪽만)
 *  p.vis 보이는 정도(0~1), 원점 = 창 가운데
 * ============================================================== */
const PH = { body: "#6a4aa8", dark: "#3a2468", eye: "#ffe14a" };
function drawPorthole(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const vis = Math.max(0, Math.min(1, p.vis == null ? 1 : p.vis));
  ctx.save();
  ctx.scale(s, s);
  // 유리 안 (어둠)
  circ(ctx, 0, 0, 30);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#0a0f22";
  ctx.fillRect(-32, -32, 64, 64);
  if (vis > 0.02) {
    ctx.globalAlpha = vis;
    // 몸 (창에 얼굴을 바짝 붙였다)
    ctx.beginPath();
    ctx.ellipse(0, 4 + (1 - vis) * 20, 34, 30, 0, 0, TAU);
    fill(ctx, PH.body, -8, -4, 34, 30, 0);
    // 빨판 촉수가 유리에 착
    for (const [x, y, a] of [
      [-24, 18, 0.6],
      [22, 20, -0.5],
    ]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.sin(t * 3 + x) * 0.2);
      ctx.beginPath();
      ctx.ellipse(0, -8, 6, 12, 0, 0, TAU);
      ctx.fillStyle = lighten(PH.body, 0.1);
      ctx.fill();
      circ(ctx, 0, -14, 3);
      ctx.fillStyle = "#e0c8ff";
      ctx.fill();
      ctx.restore();
    }
    // 커다란 외눈
    const lx = (p.look ? p.look.x : 0) * 5;
    const ly = (p.look ? p.look.y : 0) * 4;
    const open = p.blink ? 0.08 : 1;
    ell(ctx, 0, -2, 17, 15 * open);
    ctx.fillStyle = "#fffbea";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    if (open > 0.5) {
      circ(ctx, lx, -2 + ly, 9);
      ctx.fillStyle = (p.wind || 0) > 0.2 ? "#ff5a5a" : PH.eye;
      ctx.fill();
      ell(ctx, lx, -2 + ly, 3, 7);
      ctx.fillStyle = "#1a0a00";
      ctx.fill();
      circ(ctx, lx + 3, -6 + ly, 2.6);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    if (p.dizzy) {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = i * 0.8 + t * 8;
        const rr = (i / 16) * 12;
        ctx.lineTo(Math.cos(a) * rr, -2 + Math.sin(a) * rr);
      }
      stroke(ctx, INK, 2);
    }
    ctx.globalAlpha = 1;
  }
  // 유리 반사
  ctx.beginPath();
  ctx.ellipse(-12, -14, 10, 5, -0.6, 0, TAU);
  ctx.fillStyle = "rgba(200,240,255,0.35)";
  ctx.fill();
  if (p.hit) {
    ctx.fillStyle = `rgba(255,255,255,${0.5 * p.hit})`;
    ctx.fillRect(-32, -32, 64, 64);
  }
  ctx.restore();
  ctx.restore();
}

/* ================================================================
 * 닻게 — 녹슨 닻을 등에 지고 다니는 게. 뒤(닻 쪽)는 단단하다
 * ============================================================== */
const AC = { shell: "#e8723a", leg: "#ff8a4a", anchor: "#7a8494", rust: "#b0643a" };
function drawAnchorCrab(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const up = 1 - (p.camo || 0);
  const walk = p.walk || 0;
  const swing = p.swing || 0; // 닻 휘두르기 (0~1)
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(0, 8 - up * 8);
  // 다리
  if (up > 0.05) {
    ctx.globalAlpha = Math.min(1, up * 1.5);
    for (const sd of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const ph = t * 16 * walk + i * 1.8 + (sd > 0 ? 0.9 : 0);
        const lift = Math.max(0, Math.sin(ph)) * 6 * walk;
        limb(ctx, [sd * (12 + i * 8), 6, sd * (26 + i * 9), -2 - lift, sd * (32 + i * 9), 22 * up], 5, AC.leg, { line: 2.2, hi: false });
      }
    }
    ctx.globalAlpha = 1;
  }
  const lie = Math.min(1, (p.camo || 0) * 1.2);
  // 숨을 땐 몸을 작게 웅크린다 (닻이 덮는다)
  if (lie > 0.5) {
    ctx.save();
    ctx.translate(0, 6);
    ctx.scale(0.75, 0.6);
    ctx.beginPath();
    ctx.ellipse(0, -4, 26, 16, 0, 0, TAU);
    fill(ctx, darken(AC.shell, 0.35), -6, -10, 26, 16, 2.4);
    ctx.restore();
  }
  // 닻 (등 뒤 = 왼쪽 위로 비스듬히, 휘두르면 앞으로 · 숨을 땐 바닥에 눕는다)
  ctx.save();
  ctx.translate(-4 + lie * 4, -16 + lie * 16);
  ctx.rotate((-0.5 + swing * 2.2) * (1 - lie) - 1.35 * lie);
  rrect(ctx, -4, -56, 8, 56, 3);
  fill(ctx, AC.anchor, -1, -30, 4, 28, 2.2);
  circ(ctx, 0, -60, 7);
  ctx.lineWidth = 4;
  ctx.strokeStyle = AC.anchor;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-26, -6);
  ctx.quadraticCurveTo(0, 14, 26, -6);
  stroke(ctx, lineOf(AC.anchor), 9);
  stroke(ctx, AC.anchor, 6);
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sd * 26, -6);
    ctx.lineTo(sd * 30, -16);
    ctx.lineTo(sd * 20, -8);
    ctx.closePath();
    flat(ctx, AC.anchor, 1.6, lineOf(AC.anchor));
  }
  rrect(ctx, -14, -44, 28, 6, 2);
  flat(ctx, AC.anchor, 1.6, lineOf(AC.anchor));
  // 녹 · 따개비
  for (const [x, y] of [
    [-2, -34],
    [12, -2],
    [-16, -2],
  ]) {
    circ(ctx, x, y, 3);
    ctx.fillStyle = alpha(AC.rust, 0.8);
    ctx.fill();
  }
  ctx.restore();
  // 집게 (앞쪽)
  if (up > 0.05) {
    const open = (p.wind || 0) * 0.8;
    for (const [sd, big] of [
      [1, 1.1],
      [-1, 0.75],
    ]) {
      const cx = sd * 36 * up;
      const cy = -6 - up * 4;
      limb(ctx, [sd * 18, 0, sd * 28, -2, cx - sd * 6, cy + 4], 6, AC.leg, { line: 2.2 });
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sd * big, big);
      ell(ctx, 0, 0, 11, 8);
      fill(ctx, AC.shell, -2, -2, 11, 8, 2.2);
      ctx.beginPath();
      ctx.moveTo(5, -3);
      ctx.lineTo(17, -8 - open * 8);
      ctx.lineTo(12, 0);
      ctx.closePath();
      fill(ctx, AC.shell, 10, -4, 5, 5, 1.8);
      ctx.restore();
    }
  }
  // 몸 (등딱지)
  const body = () => {
    ctx.beginPath();
    ctx.ellipse(0, -4, 26, 16, 0, 0, TAU);
  };
  if (lie > 0.5) {
    // 숨음: 눈자루만 (텔)
    const stalk = p.peek || 0;
    if (stalk > 0.05) {
      for (const sd of [-1, 1]) {
        const x = 8 + sd * 7;
        const top = -6 - stalk * 16;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + sd * 2, top);
        stroke(ctx, lineOf(AC.leg), 5);
        stroke(ctx, AC.leg, 3);
        mEye(ctx, x + sd * 2, top - 4, 5, p, { open: Math.min(1, stalk * 1.4) });
      }
    }
    ctx.restore();
    return;
  }
  body();
  fill(ctx, AC.shell, -6, -10, 26, 16, 2.8);
  for (const [x, y] of [
    [-10, -10],
    [8, -12],
    [0, -2],
  ]) {
    circ(ctx, x, y, 2.6);
    ctx.fillStyle = alpha("#fff3c4", 0.6);
    ctx.fill();
  }
  // 눈자루
  const stalk = Math.max(up, p.peek || 0);
  if (stalk > 0.05) {
    for (const sd of [-1, 1]) {
      const x = 10 + sd * 7;
      const top = -20 - stalk * 14;
      ctx.beginPath();
      ctx.moveTo(x, -16);
      ctx.lineTo(x + sd * 2, top);
      stroke(ctx, lineOf(AC.leg), 5);
      stroke(ctx, AC.leg, 3);
      mEye(ctx, x + sd * 2, top - 4, 5.5, p, { open: Math.min(1, stalk * 1.4), angry: (p.wind || 0) > 0.2 });
    }
  }
  if (up > 0.5) {
    ctx.beginPath();
    ctx.moveTo(14, 4);
    ctx.quadraticCurveTo(19, 7, 24, 3);
    stroke(ctx, INK, 1.8);
  }
  hitFlash(ctx, p, body);
  ctx.restore();
}

ART.chestMimic = (ctx, p) => drawChest(ctx, p, true);
ART.porthole = drawPorthole;
ART.anchorCrab = drawAnchorCrab;
