/*
 * 바다괴물 탐험대 — 1지역 괴물 (산호초 입구)
 *  산호문어 · 복어괴물 · 바위게 · 조개괴물 · 산호곰치
 *
 * 공통: 원점 = 몸 가운데, 오른쪽을 본다. p = 괴물 상태(monster.js 가 채운다)
 *  p.t 시간 · p.face 방향 · p.camo 위장(0~1) · p.peek 내다봄(0~1) · p.look{x,y} 시선
 *  p.hit 맞은 직후(0~1) · p.wind 공격 준비(0~1) · p.dizzy 잡히기 직전 · p.blink
 * 크기는 p.s (1 = 기본)
 */
import { INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss, shadow, limb, blush, eye, brow, mouth } from "../../ocean-blaster/art/kit.js?v=3";
import { ART } from "./registry.js?v=1";

const R2 = (v) => Math.round(v);
const TAU = Math.PI * 2;

/** 괴물 눈: 흰자 + 홍채 + 반짝임 (위장 중에는 가늘게 감는다) */
export function mEye(ctx, x, y, r, p, o = {}) {
  const open = o.open == null ? 1 : o.open;
  const lx = (p.look ? p.look.x : 0) * r * 0.35;
  const ly = (p.look ? p.look.y : 0) * r * 0.3;
  if (open < 0.15 || p.blink) {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.8, y);
    ctx.quadraticCurveTo(x, y + r * 0.35, x + r * 0.8, y);
    stroke(ctx, o.line || INK, Math.max(1.6, r * 0.22));
    return;
  }
  if (p.dizzy) {
    // 빙글빙글 눈
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = i * 0.7 + p.t * 8;
      const rr = (i / 18) * r * 0.85;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ell(ctx, x, y, r, r * open);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = Math.max(1.4, r * 0.16);
    ctx.strokeStyle = o.line || INK;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = i * 0.7 + p.t * 8;
      const rr = (i / 18) * r * 0.8;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    stroke(ctx, INK, Math.max(1.2, r * 0.14));
    return;
  }
  ell(ctx, x, y, r, r * open);
  ctx.fillStyle = o.white || "#ffffff";
  ctx.fill();
  ctx.lineWidth = Math.max(1.4, r * 0.16);
  ctx.strokeStyle = o.line || INK;
  ctx.stroke();
  ctx.save();
  ell(ctx, x, y, r, r * open);
  ctx.clip();
  const ir = r * (o.iris || 0.62);
  ell(ctx, x + lx, y + ly, ir, ir * (o.slit ? 0.55 : 1));
  ctx.fillStyle = o.color || "#2b2d4a";
  ctx.fill();
  if (o.slit) {
    rrect(ctx, x + lx - ir * 0.7, y + ly - ir * 0.16, ir * 1.4, ir * 0.32, ir * 0.16);
    ctx.fillStyle = "#0b0d1a";
    ctx.fill();
  } else {
    circ(ctx, x + lx, y + ly, ir * 0.55);
    ctx.fillStyle = "#0b0d1a";
    ctx.fill();
  }
  circ(ctx, x + lx + ir * 0.35, y + ly - ir * 0.4, ir * 0.36);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  circ(ctx, x + lx - ir * 0.35, y + ly + ir * 0.35, ir * 0.16);
  ctx.fill();
  // 눈꺼풀 (화나면 내려온다)
  if (o.angry) {
    ctx.beginPath();
    ctx.moveTo(x - r * 1.1, y - r * 1.1);
    ctx.lineTo(x + r * 1.1, y - r * 0.2);
    ctx.lineTo(x + r * 1.1, y - r * 1.4);
    ctx.lineTo(x - r * 1.1, y - r * 1.4);
    ctx.closePath();
    ctx.fillStyle = o.lid || "#5a3a6a";
    ctx.fill();
  }
  ctx.restore();
  if (o.angry) {
    ctx.beginPath();
    ctx.moveTo(x - r * 1.05, y - r * 0.95);
    ctx.lineTo(x + r * 1.05, y - r * 0.2);
    stroke(ctx, o.line || INK, Math.max(1.6, r * 0.2));
  }
}

/** 맞은 직후 하얗게 번쩍 (몸 모양 그대로) */
function hitFlash(ctx, p, path) {
  if (!p.hit) return;
  ctx.save();
  path();
  ctx.fillStyle = `rgba(255,255,255,${0.6 * p.hit})`;
  ctx.fill();
  ctx.restore();
}

/* ================================================================
 * 01 산호문어 — 산호처럼 위장. 촉수 끝이 꼼지락
 * ============================================================== */
const OCTO = { body: "#ff7f6e", spot: "#ffd27a", camo1: "#ff7aa2", camo2: "#ffb347", belly: "#ffc7b8" };
function drawOcto(ctx, p) {
  const t = p.t || 0;
  const camo = p.camo || 0;
  const s = p.s || 1;
  const body = mix(OCTO.body, OCTO.camo1, camo * 0.7);
  const pulse = p.squish || 0; // 물 뿜고 나갈 때 쭉 늘어남
  ctx.save();
  ctx.scale(s * (1 - pulse * 0.18), s * (1 + pulse * 0.22));
  // 촉수 6개 (뒤 3개 먼저 · 어둡게)
  const tent = (i, back) => {
    const u = (i + 0.5) / 6;
    const bx = -26 + u * 52;
    const curl = camo > 0.5 ? 1 : 0;
    const wig = Math.sin(t * 3 + i * 1.3) * (6 + (p.tell || 0) * 10) * (1 - camo * 0.8) + (p.tellTent === i ? Math.sin(t * 14) * 12 : 0);
    const reach = 30 + (p.wind || 0) * 22;
    const ex = bx + (u - 0.5) * 30 + wig - (p.vx || 0) * 0.04;
    const ey = 22 + reach - curl * 14;
    const c = back ? darken(body, 0.25) : body;
    limb(ctx, [bx, 14, bx + (u - 0.5) * 20 + wig * 0.5, 30, ex, ey], 11 - curl * 2, c, { line: 3 });
    // 끝이 말려 올라감 (위장하면 산호 가지처럼 꼿꼿)
    ctx.beginPath();
    ctx.arc(ex + (u < 0.5 ? -4 : 4), ey - 2, 4.5, 0, TAU);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = lineOf(c);
    ctx.stroke();
    // 빨판
    if (!back) {
      for (let k = 0; k < 3; k++) {
        circ(ctx, bx + (ex - bx) * (0.35 + k * 0.2), 20 + (ey - 20) * (0.35 + k * 0.2), 2);
        ctx.fillStyle = OCTO.belly;
        ctx.fill();
      }
    }
  };
  for (const i of [1, 3, 5]) tent(i, true);
  for (const i of [0, 2, 4]) tent(i, false);
  // 머리 (둥근 외투막)
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(-30, 16);
    ctx.bezierCurveTo(-38, -24, -18, -44, 0, -44);
    ctx.bezierCurveTo(18, -44, 38, -24, 30, 16);
    ctx.quadraticCurveTo(0, 24, -30, 16);
    ctx.closePath();
  };
  head();
  fill(ctx, body, -6, -18, 34, 34, 3);
  // 산호 같은 돌기 · 반점 (위장할수록 진하게)
  ctx.save();
  head();
  ctx.clip();
  const spots = [
    [-14, -30, 6],
    [6, -36, 5],
    [18, -20, 6],
    [-22, -10, 5],
    [12, -4, 4],
    [-4, -18, 4],
  ];
  for (const [x, y, r] of spots) {
    circ(ctx, x, y, r);
    ctx.fillStyle = alpha(mix(OCTO.spot, OCTO.camo2, camo), 0.65 + camo * 0.3);
    ctx.fill();
    circ(ctx, x - r * 0.3, y - r * 0.3, r * 0.35);
    ctx.fillStyle = alpha("#ffffff", 0.45);
    ctx.fill();
  }
  ctx.restore();
  // 위장: 머리 위 산호 가지 돌기
  if (camo > 0.05) {
    ctx.globalAlpha = camo;
    for (const [x, len, a] of [
      [-16, 18, -1.9],
      [-2, 24, -1.6],
      [14, 16, -1.2],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, -36);
      ctx.lineTo(x + Math.cos(a) * len, -36 + Math.sin(a) * len);
      stroke(ctx, lineOf(OCTO.camo1), 8);
      stroke(ctx, OCTO.camo1, 5);
      circ(ctx, x + Math.cos(a) * len, -36 + Math.sin(a) * len, 4);
      ctx.fillStyle = "#ffe3ef";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  gloss(ctx, -12, -32, 12, 6, 0.6, -0.5);
  // 눈 (위장 중에는 감고, 내다볼 때 뜬다)
  const open = Math.max(1 - camo, p.peek || 0);
  for (const sx of [-12, 12]) mEye(ctx, sx, -8, 9, p, { open, slit: true, color: "#ffb03a", angry: (p.wind || 0) > 0.2 });
  // 입 (작은 동그라미 — 물 뿜는 관)
  if (open > 0.3) {
    ell(ctx, 0, 8, 5, (p.wind || 0) > 0.2 ? 5 : 3);
    flat(ctx, darken(body, 0.45), 1.6, INK);
    blush(ctx, -20, 4, 4);
    blush(ctx, 20, 4, 4);
  }
  hitFlash(ctx, p, head);
  ctx.restore();
}

/* ================================================================
 * 02 복어괴물 — 맞으면 가시 공처럼 부풀어 오른다
 * ============================================================== */
const PUF = { body: "#ffd23f", belly: "#fff6c9", spot: "#c9862a", fin: "#ff9f3a" };
function drawPuffer(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const inf = p.inflate || 0; // 0 보통 · 1 빵빵
  const rx = 34 + inf * 22;
  const ry = 26 + inf * 30;
  ctx.save();
  ctx.scale(s, s);
  // 꼬리 지느러미
  const wag = Math.sin(t * 9) * 0.3;
  ctx.save();
  ctx.translate(-rx + 4, 0);
  ctx.rotate(wag);
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.quadraticCurveTo(-14, -18, -22, -14);
  ctx.quadraticCurveTo(-14, 0, -22, 14);
  ctx.quadraticCurveTo(-14, 18, 4, 0);
  ctx.closePath();
  fill(ctx, PUF.fin, -10, -4, 12, 12, 2.4);
  ctx.restore();
  // 가시 (부풀면 길어진다)
  const spikes = 18;
  const sl = 5 + inf * 14;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * TAU + 0.1;
    const x0 = Math.cos(a) * rx * 0.92;
    const y0 = Math.sin(a) * ry * 0.92;
    ctx.beginPath();
    ctx.moveTo(x0 + Math.cos(a + 1.57) * 3.5, y0 + Math.sin(a + 1.57) * 3.5);
    ctx.lineTo(Math.cos(a) * (rx + sl), Math.sin(a) * (ry + sl));
    ctx.lineTo(x0 - Math.cos(a + 1.57) * 3.5, y0 - Math.sin(a + 1.57) * 3.5);
    ctx.closePath();
    flat(ctx, inf > 0.3 ? "#fff1b8" : darken(PUF.body, 0.1), 1.6, lineOf(PUF.body));
  }
  // 몸
  const body = () => {
    ell(ctx, 0, 0, rx, ry);
  };
  body();
  fill(ctx, PUF.body, -6, -6, rx, ry, 3);
  ctx.save();
  body();
  ctx.clip();
  ell(ctx, 2, ry * 0.55, rx * 0.9, ry * 0.6);
  ctx.fillStyle = PUF.belly;
  ctx.fill();
  for (const [x, y, r] of [
    [-16, -14, 4],
    [-2, -20, 3.5],
    [12, -16, 3],
    [-22, 0, 3],
    [-8, -6, 2.6],
  ])
    circ(ctx, x * (rx / 34), y * (ry / 26), r), (ctx.fillStyle = alpha(PUF.spot, 0.6)), ctx.fill();
  ctx.restore();
  // 가슴 지느러미 (팔랑)
  ctx.save();
  ctx.translate(-2, ry * 0.25);
  ctx.rotate(-0.4 + Math.sin(t * 12) * 0.35);
  ctx.beginPath();
  ctx.ellipse(-6, 0, 10, 6, 0, 0, TAU);
  fill(ctx, PUF.fin, -6, 0, 10, 6, 2);
  ctx.restore();
  gloss(ctx, -rx * 0.35, -ry * 0.55, rx * 0.36, ry * 0.18, 0.75, -0.3);
  // 얼굴
  const ex = rx * 0.42;
  mEye(ctx, ex - 8, -ry * 0.25, 7.5 + inf * 2, p, { angry: inf > 0.4 || (p.wind || 0) > 0.2, open: Math.max(0.2, 1 - (p.camo || 0)) });
  mEye(ctx, ex + 10, -ry * 0.28, 6.5 + inf * 2, p, { angry: inf > 0.4 || (p.wind || 0) > 0.2, open: Math.max(0.2, 1 - (p.camo || 0)) });
  // 뾰로통한 입술
  ctx.save();
  ctx.translate(rx - 2, ry * 0.12);
  ell(ctx, 0, 0, 6 + inf * 2, 5 + inf * 2);
  flat(ctx, "#ff8a7a", 2, lineOf("#ff8a7a"));
  ell(ctx, 1, 0, 2.5, 2 + inf);
  ctx.fillStyle = "#7a2a2a";
  ctx.fill();
  ctx.restore();
  if (inf > 0.3) {
    blush(ctx, rx * 0.15, ry * 0.15, 6 + inf * 3);
  }
  hitFlash(ctx, p, body);
  ctx.restore();
}

/* ================================================================
 * 03 바위게 — 바닥 바위와 똑같이 생겼다. 눈자루가 쏙!
 * ============================================================== */
const CRAB = { shell: "#7d8fa6", moss: "#7fd18a", leg: "#ff7a4d", claw: "#ff6a3d" };
function drawRockCrab(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const up = 1 - (p.camo || 0); // 0 = 납작 엎드림(바위) · 1 = 일어섬
  const walk = p.walk || 0;
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(0, 10 - up * 10);
  // 다리 (일어서면 보인다)
  if (up > 0.05) {
    ctx.globalAlpha = Math.min(1, up * 1.5);
    for (const sd of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const ph = t * 16 * walk + i * 1.8 + (sd > 0 ? 0.9 : 0);
        const lift = Math.max(0, Math.sin(ph)) * 6 * walk;
        const x0 = sd * (14 + i * 9);
        limb(ctx, [x0, 8, sd * (30 + i * 10), -2 - lift, sd * (36 + i * 10), 24 * up], 5.5, CRAB.leg, { line: 2.4, hi: false });
      }
    }
    ctx.globalAlpha = 1;
  }
  // 집게 (앞쪽 큰 것 · 공격 준비면 벌린다)
  if (up > 0.05) {
    const open = (p.wind || 0) * 0.9 + Math.max(0, Math.sin(t * 3)) * 0.1;
    for (const [sd, big] of [
      [-1, 0.85],
      [1, 1.1],
    ]) {
      const cx = sd * 44 * up + (p.snap ? sd * 10 : 0);
      const cy = -14 - up * 6;
      limb(ctx, [sd * 22, 0, sd * 34, -4, cx - sd * 6, cy + 4], 6.5, CRAB.leg, { line: 2.4 });
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sd * big, big);
      ell(ctx, 0, 0, 13, 10);
      fill(ctx, CRAB.claw, -2, -2, 13, 10, 2.4);
      ctx.beginPath();
      ctx.moveTo(6, -4);
      ctx.lineTo(20, -10 - open * 10);
      ctx.lineTo(14, -1);
      ctx.closePath();
      fill(ctx, CRAB.claw, 12, -6, 6, 6, 2);
      ctx.beginPath();
      ctx.moveTo(6, 3);
      ctx.lineTo(20, 6 + open * 6);
      ctx.lineTo(12, 7);
      ctx.closePath();
      fill(ctx, darken(CRAB.claw, 0.1), 12, 5, 6, 4, 2);
      gloss(ctx, -3, -4, 6, 2.6, 0.6);
      ctx.restore();
    }
  }
  // 눈자루 (텔: 쏙 올라왔다 들어감)
  const stalk = Math.max(up, p.peek || 0);
  if (stalk > 0.05) {
    for (const sd of [-1, 1]) {
      const x = sd * 9;
      const top = -30 - stalk * 18;
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.lineTo(x + sd * 2, top);
      stroke(ctx, lineOf(CRAB.leg), 6);
      stroke(ctx, CRAB.leg, 3.5);
      mEye(ctx, x + sd * 2, top - 4, 6, p, { open: Math.min(1, stalk * 1.4), angry: (p.wind || 0) > 0.2 });
    }
  }
  // 등딱지 = 바위 (윗면 밝고, 이끼 · 갈라진 틈)
  const shell = () => {
    ctx.beginPath();
    ctx.moveTo(-36, 10);
    ctx.bezierCurveTo(-44, -22, -14, -36, 4, -34);
    ctx.bezierCurveTo(30, -32, 46, -16, 38, 10);
    ctx.quadraticCurveTo(0, 18, -36, 10);
    ctx.closePath();
  };
  shell();
  ctx.fillStyle = linear(ctx, "crabShell", 0, -36, 0, 14, [
    [0, lighten(CRAB.shell, 0.3)],
    [0.45, CRAB.shell],
    [1, darken(CRAB.shell, 0.35)],
  ]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = lineOf(CRAB.shell);
  ctx.stroke();
  ctx.save();
  shell();
  ctx.clip();
  for (const [x, y, rx, ry] of [
    [-18, -22, 8, 3],
    [8, -28, 9, 3.5],
    [22, -14, 6, 2.6],
    [-6, -10, 5, 2.2],
  ]) {
    ell(ctx, x, y, rx, ry);
    ctx.fillStyle = alpha(CRAB.moss, 0.6);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-10, -30);
  ctx.quadraticCurveTo(-4, -16, -12, -2);
  ctx.moveTo(16, -26);
  ctx.quadraticCurveTo(20, -14, 14, 2);
  stroke(ctx, alpha(darken(CRAB.shell, 0.45), 0.5), 2);
  // 일어서면 배 쪽에 게 색이 비친다
  if (up > 0.05) {
    ctx.fillStyle = alpha(CRAB.leg, 0.5 * up);
    ctx.fillRect(-44, 2, 90, 14);
  }
  ctx.restore();
  gloss(ctx, -14, -26, 12, 4, 0.45, -0.15);
  // 입 (일어섰을 때만)
  if (up > 0.5) {
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.quadraticCurveTo(0, 8, 6, 4);
    stroke(ctx, INK, 2);
  }
  hitFlash(ctx, p, shell);
  ctx.restore();
}

/* ================================================================
 * 04 조개괴물 — 꼭 닫혀 있다가 입을 벌려 진주를 뱉는다
 * ============================================================== */
const CLAM = { shell: "#b28bff", inner: "#ffd0e6", tongue: "#ff6f91", pearl: "#ffffff" };
function drawClam(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const open = Math.max(0, Math.min(1, p.open || 0)); // 0 닫힘 · 1 활짝
  const lift = (p.peek || 0) * 0.22;
  const op = Math.max(open, lift);
  ctx.save();
  ctx.scale(s, s);
  // 아래 껍데기
  const lower = () => {
    ctx.beginPath();
    ctx.moveTo(-40, -2);
    ctx.quadraticCurveTo(-36, 22, 0, 24);
    ctx.quadraticCurveTo(36, 22, 40, -2);
    ctx.quadraticCurveTo(0, 6, -40, -2);
    ctx.closePath();
  };
  lower();
  fill(ctx, darken(CLAM.shell, 0.12), -4, 8, 40, 20, 3);
  // 입 안 (벌어질수록 보인다)
  if (op > 0.02) {
    const mh = op * 30;
    ctx.beginPath();
    ctx.moveTo(-36, -2);
    ctx.quadraticCurveTo(0, -2 - mh * 1.3, 36, -2);
    ctx.quadraticCurveTo(0, 6, -36, -2);
    ctx.closePath();
    ctx.fillStyle = "#4a1030";
    ctx.fill();
    // 혀 + 진주
    ell(ctx, 0, 0, 20 * op + 4, 6 * op + 2);
    ctx.fillStyle = CLAM.tongue;
    ctx.fill();
    if (open > 0.4 && !p.spat) {
      circ(ctx, 0, -6 * op, 7);
      ctx.fillStyle = radial(ctx, "pearl", -2, -6 * op - 2, 1, 0, -6 * op, 8, [
        [0, "#ffffff"],
        [0.6, "#f2eaff"],
        [1, "#c9b8ff"],
      ]);
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "#8a7ab8";
      ctx.stroke();
    }
    // 안쪽 눈 (틈 사이로 반짝)
    if (op > 0.08) {
      for (const sx of [-14, 14]) mEye(ctx, sx, -2 - mh * 0.55, 5 + op * 3, p, { open: Math.min(1, op * 3), angry: (p.wind || 0) > 0.2, white: "#fff6cf" });
    }
  }
  // 위 껍데기 (경첩=뒤쪽, 앞이 들린다)
  ctx.save();
  ctx.translate(0, -2);
  ctx.translate(-38, 0);
  ctx.rotate(-op * 0.75);
  ctx.translate(38, 0);
  const upper = () => {
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.bezierCurveTo(-44, -36, 44, -36, 40, 0);
    ctx.quadraticCurveTo(0, 8, -40, 0);
    ctx.closePath();
  };
  upper();
  fill(ctx, CLAM.shell, -8, -16, 40, 26, 3);
  ctx.save();
  upper();
  ctx.clip();
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 3, 2);
    ctx.quadraticCurveTo(i * 9, -16, i * 13, -30);
    stroke(ctx, alpha(darken(CLAM.shell, 0.35), 0.5), 2.2);
  }
  ctx.restore();
  gloss(ctx, -14, -18, 12, 4, 0.6, -0.2);
  // 껍데기 위 작은 눈썹 무늬 (화나면 기울어짐)
  ctx.restore();
  hitFlash(ctx, p, lower);
  ctx.restore();
}

/* ================================================================
 * 05 산호곰치 — 벽 구멍에서 쏙. out(0~1) 만큼 몸이 나온다
 *  원점 = 구멍 가운데, 오른쪽으로 나온다 (face 로 뒤집음)
 * ============================================================== */
const EEL = { body: "#9bd34a", spot: "#3f7a2a", belly: "#e9f7b8", fin: "#c9e86a" };
function drawEel(ctx, p) {
  const t = p.t || 0;
  const s = p.s || 1;
  const out = Math.max(0, p.out || 0);
  if (out < 0.08 && !p.dizzy) {
    // 어두운 구멍 속: 노란 두 눈만 가끔 반짝
    const on = (t % 4.2) < 2.6 && !p.blink;
    if (on || p.peek) {
      ctx.save();
      ctx.scale(s, s);
      for (const [x, y] of [
        [-2, -6],
        [10, -6],
      ]) {
        ctx.beginPath();
        ctx.ellipse(x, y, 4.2, 2.6, -0.15, 0, TAU);
        ctx.fillStyle = "#ffd23f";
        ctx.shadowColor = "#ffd23f";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(x + 1, y, 1.2, 2.2, 0, 0, TAU);
        ctx.fillStyle = "#1a1200";
        ctx.fill();
      }
      ctx.restore();
    }
    return;
  }
  const len = 20 + out * 92;
  ctx.save();
  ctx.scale(1.12, 1.12);
  const jaw = (p.wind || 0) * 0.6 + (p.bite || 0) * 0.5 + Math.max(0, Math.sin(t * 2.4)) * 0.08;
  ctx.save();
  ctx.scale(s, s);
  // 몸 (구멍에서 머리까지 S 곡선)
  const pts = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = -16 + u * len;
    const y = Math.sin(u * 3.2 - t * 5) * 6 * u * (0.4 + out * 0.6);
    pts.push([x, y]);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const body = (w, c) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = w;
    ctx.strokeStyle = c;
    ctx.stroke();
  };
  body(28, lineOf(EEL.body));
  body(23, EEL.body);
  // 등지느러미 줄
  ctx.beginPath();
  for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1] - 12);
  stroke(ctx, EEL.fin, 3.4);
  // 반점
  for (let i = 1; i < n; i++) {
    circ(ctx, pts[i][0], pts[i][1] + (i % 2 ? -4 : 4), 2.6);
    ctx.fillStyle = alpha(EEL.spot, 0.7);
    ctx.fill();
  }
  // 머리
  const [hx, hy] = pts[n];
  ctx.save();
  ctx.translate(hx, hy);
  // 아래턱
  ctx.save();
  ctx.rotate(jaw * 0.9);
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.quadraticCurveTo(14, 4, 26, 2);
  ctx.quadraticCurveTo(16, 16, -8, 14);
  ctx.closePath();
  fill(ctx, EEL.belly, 6, 8, 14, 7, 2.4);
  // 아랫니 (둥글둥글)
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(4 + i * 5, 3);
    ctx.lineTo(6 + i * 5, -2);
    ctx.lineTo(8 + i * 5, 3);
    flat(ctx, "#ffffff", 1, "#7a8a6a");
  }
  ctx.restore();
  // 입 속
  if (jaw > 0.1) {
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(14, 4 + jaw * 12, 24, 2);
    ctx.lineTo(24, -1);
    ctx.closePath();
    ctx.fillStyle = "#7a1f3a";
    ctx.fill();
  }
  // 위턱 · 머리
  const headP = () => {
    ctx.beginPath();
    ctx.moveTo(-14, 10);
    ctx.bezierCurveTo(-16, -16, 6, -18, 22, -8);
    ctx.quadraticCurveTo(30, -4, 28, 1);
    ctx.quadraticCurveTo(10, 2, -14, 10);
    ctx.closePath();
  };
  headP();
  fill(ctx, EEL.body, 0, -8, 20, 12, 2.6);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(8 + i * 5, 1);
    ctx.lineTo(10 + i * 5, 6);
    ctx.lineTo(12 + i * 5, 1);
    flat(ctx, "#ffffff", 1, "#7a8a6a");
  }
  circ(ctx, 24, -4, 1.6);
  ctx.fillStyle = INK;
  ctx.fill();
  gloss(ctx, 0, -10, 8, 3, 0.6, -0.3);
  mEye(ctx, 6, -9, 8, p, { angry: (p.wind || 0) > 0.2 || (p.bite || 0) > 0, color: "#ffb03a", slit: true });
  hitFlash(ctx, p, headP);
  ctx.restore();
  ctx.restore();
  ctx.restore();
}

ART.coralOcto = drawOcto;
ART.puffer = drawPuffer;
ART.rockCrab = drawRockCrab;
ART.clam = drawClam;
ART.reefEel = drawEel;
