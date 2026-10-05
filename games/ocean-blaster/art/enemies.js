/*
 * 🌊 바다 물총 대작전 — 바다 친구들 (적) 그림
 * 그림 단위: (0,0) = 물 위 가운데, 몸은 위쪽(-y), 기본 크기 반지름 ≈ 50, 오른쪽을 본다.
 * 같은 몸을 색만 바꿔 복제하지 않는다 — 친구마다 실루엣 · 재질 · 표정 · 소품이 다르다.
 */
import {
  TAU, INK, mix, lighten, darken, alpha, lineOf, lit, vlit, linear, radial,
  ell, circ, rrect, smooth, fill, flat, stroke, gloss, bounce, dot, shadow,
  eye, brow, mouth, blush, star, sparkle, dizzyStars, wetDrops, drop, pirateHat, eyepatch, limb, fin,
} from "./kit.js?v=2";

export const ENEMY_ART = {};
const def = (id, fn) => (ENEMY_ART[id] = fn);

/* ================================================================
 * 공용 부품
 * ============================================================== */
/** 게 집게: 팔 두 마디 + 큰 집게 (위 손 + 움직이는 아래 손가락) */
function crabClaw(ctx, s, base, t, open, size = 1, raise = 0) {
  ctx.save();
  ctx.scale(s, 1);
  // 팔
  limb(ctx, [0, 0, 10, -10, 14, -22 - raise * 6], 8 * size, base, { line: 4 });
  ctx.translate(14, -24 - raise * 6);
  ctx.rotate(-0.35 - raise * 0.3);
  ctx.scale(size, size);
  // 아래 손가락 (움직임)
  ctx.save();
  ctx.rotate(0.25 + open * 0.45);
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.quadraticCurveTo(16, 8, 24, -2);
  ctx.quadraticCurveTo(14, 0, 4, -4);
  ctx.closePath();
  fill(ctx, base, 10, 0, 14, 6, 2.4);
  ctx.restore();
  // 위 손 (큰 집게)
  ctx.beginPath();
  ctx.moveTo(-8, 4);
  ctx.quadraticCurveTo(-12, -16, 4, -20);
  ctx.quadraticCurveTo(24, -24, 30, -8);
  ctx.quadraticCurveTo(24, -6, 18, -6);
  ctx.quadraticCurveTo(8, 2, -8, 4);
  ctx.closePath();
  fill(ctx, base, 6, -10, 18, 14, 2.6);
  // 톱니
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(14 + i * 5, -6.5);
    ctx.lineTo(16 + i * 5, -2.5);
    ctx.lineTo(18 + i * 5, -6.5);
    ctx.fillStyle = "#fff4ea";
    ctx.fill();
  }
  gloss(ctx, 2, -12, 9, 4, 0.55);
  dot(ctx, -2, -6, 2, alpha(darken(base, 0.3), 0.5));
  dot(ctx, 4, -2, 1.6, alpha(darken(base, 0.3), 0.5));
  ctx.restore();
}

/** 게 다리 3쌍 (마디 + 뾰족 끝) */
function crabLegs(ctx, base, t, speed = 12, spread = 1) {
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = s * (18 + i * 8) * spread;
      const k = Math.sin(t * speed + i * 1.7 + (s > 0 ? 1 : 0)) * 3;
      const kx = s * (14 + i * 3);
      limb(ctx, [x, -16, x + kx, -20 + k, x + kx + s * 8, -2 + k * 0.5], 4.2, darken(base, 0.08), { line: 3.4, hi: false });
    }
  }
}

/** 눈자루 + 눈 */
function stalkEye(ctx, x, y, r, base, p, opt = {}) {
  ctx.beginPath();
  ctx.moveTo(x * 0.7, y + 16);
  ctx.quadraticCurveTo(x * 0.9, y + 8, x, y + r * 0.6);
  stroke(ctx, lineOf(base), 7);
  ctx.beginPath();
  ctx.moveTo(x * 0.7, y + 16);
  ctx.quadraticCurveTo(x * 0.9, y + 8, x, y + r * 0.6);
  stroke(ctx, lighten(base, 0.1), 4);
  eye(ctx, x, y, r, p, opt);
}

/* ================================================================
 * 해적 게 — 둥근 산호빛 등딱지, 안대, 작은 해적 모자, 큰 집게
 * ============================================================== */
def("pirate-crab", (ctx, e, p) => {
  const base = "#ff5a3c";
  const t = p.t;
  const wave = p.soaked ? 1.4 : Math.sin(t * 4.2) * 0.4;
  crabLegs(ctx, base, t, e.mem && e.mem.left ? 20 : 10);
  crabClaw(ctx, -1, base, t, 0.4 + Math.sin(t * 6) * 0.3, 1, Math.max(0, -wave));
  crabClaw(ctx, 1, base, t, 0.4 + Math.cos(t * 6) * 0.3, 1.08, Math.max(0, wave));
  // 등딱지 (가장자리가 물결무늬)
  const pts = [];
  for (let i = 0; i < 14; i++) {
    const a = Math.PI + (i / 13) * Math.PI;
    const r = 36 + (i % 2 ? 2.5 : 0);
    pts.push(Math.cos(a) * r, -24 + Math.sin(a) * 25);
  }
  pts.push(30, -12, 0, -6, -30, -12);
  smooth(ctx, pts, true, 0.45);
  fill(ctx, base, -4, -34, 36, 26, 3);
  // 배 (밝은 아랫면)
  ctx.beginPath();
  ctx.moveTo(-28, -14);
  ctx.quadraticCurveTo(0, -2, 28, -14);
  ctx.quadraticCurveTo(0, -20, -28, -14);
  ctx.closePath();
  flat(ctx, "#ffc4a6", 0);
  // 무늬 · 하이라이트
  for (const [x, y, r] of [
    [-18, -40, 3.4],
    [-6, -46, 2.6],
    [10, -44, 3],
    [20, -36, 2.4],
    [-24, -30, 2.2],
  ]) {
    ell(ctx, x, y, r, r * 0.8);
    ctx.fillStyle = alpha("#b8261a", 0.4);
    ctx.fill();
  }
  gloss(ctx, -14, -44, 13, 5, 0.6);
  bounce(ctx, 0, -24, 34, 18, 0.5);
  // 눈
  stalkEye(ctx, -12, -64, 8.5, base, p, { iris: "#2a5fc4" });
  stalkEye(ctx, 12, -64, 8.5, base, p, { iris: "#2a5fc4" });
  if (!p.soaked && !p.dizzy) eyepatch(ctx, -12, -64, 8.3);
  pirateHat(ctx, 3, -74, 0.42, "#2b2d4a", 0.18);
  mouth(ctx, 0, -27, 7, p, p.hit > 0.3 ? "o" : "smile");
  blush(ctx, -21, -28, 6);
  blush(ctx, 21, -28, 6);
  if (p.dizzy) dizzyStars(ctx, p.now, -86, 20);
  wetDrops(ctx, p, -90, 22);
});

/* ================================================================
 * 통통 복어 — 노란 몸에 표범 무늬, 가시 줄, 뾰로통한 입술
 * ============================================================== */
function puffer(ctx, e, p, c) {
  const puff = (e.mem && e.mem.puff) || 0;
  const t = p.t;
  const R = 27 + puff * 8 + Math.sin(t * 3) * 0.8;
  const cy = -R + 8;
  // 꼬리지느러미
  ctx.save();
  ctx.translate(-R + 4, cy + 2);
  ctx.rotate(Math.sin(t * 9) * 0.25);
  fin(ctx, [0, 0, -14, -14, -20, -6, -16, 0, -20, 8, -14, 12], c.fin, 3);
  ctx.restore();
  // 가시 (뒤쪽 줄)
  const spikes = 16;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * TAU + 0.1;
    const len = (puff > 0 ? 11 : 5) + (i % 2) * 2;
    const r0 = R - 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.1) * r0, cy + Math.sin(a - 0.1) * r0);
    ctx.lineTo(Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len));
    ctx.lineTo(Math.cos(a + 0.1) * r0, cy + Math.sin(a + 0.1) * r0);
    ctx.closePath();
    ctx.fillStyle = lighten(c.body, 0.25);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = lineOf(c.body);
    ctx.stroke();
  }
  // 몸
  circ(ctx, 0, cy, R);
  ctx.fillStyle = linear(ctx, `pf${c.body}${R | 0}`, 0, cy - R, 0, cy + R, [
    [0, lighten(c.body, 0.18)],
    [0.55, c.body],
    [0.62, c.belly],
    [1, lighten(c.belly, 0.2)],
  ]);
  ctx.fill();
  ctx.save();
  circ(ctx, 0, cy, R);
  ctx.clip();
  // 표범 무늬 (등)
  for (const [x, y, r] of c.spots) {
    ell(ctx, x * (R / 30), cy + y * (R / 30), r * (R / 30), r * 0.8 * (R / 30), 0.3);
    ctx.fillStyle = alpha(c.spot, 0.75);
    ctx.fill();
  }
  // 오른쪽 아래 그늘
  ctx.fillStyle = radial(ctx, `pfs${R | 0}`, -R * 0.3, cy - R * 0.4, R * 0.2, 0, cy, R * 1.05, [
    [0, "rgba(0,0,0,0)"],
    [0.75, "rgba(0,0,0,0)"],
    [1, "rgba(80,40,0,0.28)"],
  ]);
  ctx.fillRect(-R, cy - R, R * 2, R * 2);
  ctx.restore();
  circ(ctx, 0, cy, R);
  stroke(ctx, lineOf(c.body), 3);
  gloss(ctx, -R * 0.35, cy - R * 0.48, R * 0.36, R * 0.16, 0.7);
  bounce(ctx, 0, cy, R, R, 0.45);
  // 가슴지느러미
  ctx.save();
  ctx.translate(-2, cy + R * 0.2);
  ctx.rotate(-0.4 + Math.sin(t * 12) * 0.35);
  fin(ctx, [0, 0, -12, -10, -18, -2, -12, 6], c.fin, 2);
  ctx.restore();
  // 얼굴
  const er = 8.5 + puff * 1.4;
  eye(ctx, R * 0.18, cy - R * 0.2, er, p, { iris: c.iris, look: 0.5 });
  eye(ctx, R * 0.62, cy - R * 0.14, er * 0.9, p, { iris: c.iris, look: 0.6 });
  if (p.soaked || p.hit > 0.3) mouth(ctx, R * 0.82, cy + R * 0.28, 6, p, "o");
  else {
    // 뾰로통 입술
    ell(ctx, R * 0.86, cy + R * 0.3, 5.5, 4.5);
    flat(ctx, "#ff7f9e", 2, "#a3304e");
    ell(ctx, R * 0.86, cy + R * 0.3, 2, 1.4);
    ctx.fillStyle = "#a3304e";
    ctx.fill();
  }
  blush(ctx, R * 0.5, cy + R * 0.16, 6 + puff);
  if (c.lure) {
    // 미끼 등불
    ctx.beginPath();
    ctx.moveTo(R * 0.1, cy - R);
    ctx.quadraticCurveTo(R * 0.3, cy - R - 34, R * 1.0, cy - R - 26);
    stroke(ctx, lineOf(c.body), 4);
    ctx.beginPath();
    ctx.moveTo(R * 0.1, cy - R);
    ctx.quadraticCurveTo(R * 0.3, cy - R - 34, R * 1.0, cy - R - 26);
    stroke(ctx, c.spot, 2);
    const gl = 0.6 + 0.4 * Math.sin(t * 6);
    ctx.save();
    ctx.globalAlpha *= 0.5 * gl;
    circ(ctx, R * 1.04, cy - R - 24, 16);
    ctx.fillStyle = radial(ctx, "lureglow", 0, 0, 0, 0, 0, 16, [
      [0, "rgba(255,245,150,1)"],
      [1, "rgba(255,245,150,0)"],
    ]);
    ctx.save();
    ctx.translate(R * 1.04, cy - R - 24);
    circ(ctx, 0, 0, 16);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    circ(ctx, R * 1.04, cy - R - 24, 6.5);
    flat(ctx, "#fff27a", 2, "#c9a400");
    dot(ctx, R * 1.0, cy - R - 26, 2, "#ffffff");
  }
  if (c.crown) {
    ctx.beginPath();
    ctx.moveTo(-8, cy - R + 2);
    ctx.lineTo(-10, cy - R - 12);
    ctx.lineTo(-3, cy - R - 5);
    ctx.lineTo(2, cy - R - 15);
    ctx.lineTo(7, cy - R - 5);
    ctx.lineTo(13, cy - R - 12);
    ctx.lineTo(11, cy - R + 2);
    ctx.closePath();
    fill(ctx, "#ffd54f", 2, cy - R - 5, 12, 8, 2);
  }
  wetDrops(ctx, p, cy - R - 12, R * 0.7);
}
def("puffer", (ctx, e, p) =>
  puffer(ctx, e, p, {
    body: "#ffc93c",
    belly: "#fff3cf",
    spot: "#c9741c",
    fin: "#ffad42",
    iris: "#3a7a2a",
    spots: [
      [-14, -16, 4],
      [-2, -22, 3.4],
      [10, -18, 3.8],
      [-22, -4, 3],
      [-8, -8, 2.6],
      [18, -8, 2.4],
      [4, -10, 2.2],
    ],
  })
);
def("decoy-puffer", (ctx, e, p) =>
  puffer(ctx, e, p, {
    body: "#b98cff",
    belly: "#f3e8ff",
    spot: "#6f3fd1",
    fin: "#d58cff",
    iris: "#c23b8a",
    lure: true,
    spots: [
      [-16, -14, 2.4],
      [-6, -20, 2.4],
      [6, -22, 2.4],
      [16, -14, 2.4],
      [-20, -2, 2.4],
      [0, -10, 2.4],
    ],
  })
);
def("mini-puffer", (ctx, e, p) =>
  puffer(ctx, e, p, {
    body: "#ff9ec4",
    belly: "#ffeaf3",
    spot: "#e85c97",
    fin: "#ff8ab8",
    iris: "#7a2a5a",
    spots: [
      [-12, -16, 3],
      [4, -20, 3],
      [-18, -4, 2.4],
    ],
  })
);

/* ================================================================
 * 해적 오리 — 반짝이는 고무 재질, 빨간 스카프, 해적 모자
 * ============================================================== */
function duck(ctx, p, c) {
  const t = p.t;
  // 꼬리
  ctx.beginPath();
  ctx.moveTo(-26, -26);
  ctx.quadraticCurveTo(-36, -34, -40, -46);
  ctx.quadraticCurveTo(-30, -40, -24, -36);
  ctx.quadraticCurveTo(-34, -30, -26, -26);
  fill(ctx, c.body, -30, -36, 10, 10, 2.6);
  // 몸
  smooth(ctx, [-30, -22, -22, -38, 0, -40, 22, -34, 30, -20, 22, -4, 0, 0, -24, -6], true, 0.5);
  fill(ctx, c.body, -4, -22, 32, 20, 3);
  // 날개 (돋을새김)
  ctx.save();
  ctx.translate(-6, -22);
  ctx.rotate(Math.sin(t * 3) * 0.06);
  smooth(ctx, [-16, -2, -8, -12, 8, -12, 16, -4, 6, 6, -10, 6], true, 0.5);
  fill(ctx, darken(c.body, 0.08), 0, -4, 16, 9, 2.2);
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.quadraticCurveTo(0, 2, 8, 0);
  stroke(ctx, alpha(darken(c.body, 0.35), 0.5), 1.6);
  ctx.restore();
  // 머리
  circ(ctx, 14, -48, 16);
  fill(ctx, c.body, 14, -48, 16, 16, 3);
  // 스카프
  if (c.scarf) {
    ctx.beginPath();
    ctx.moveTo(2, -38);
    ctx.quadraticCurveTo(14, -30, 26, -36);
    ctx.lineTo(26, -30);
    ctx.quadraticCurveTo(14, -24, 2, -32);
    ctx.closePath();
    fill(ctx, c.scarf, 14, -32, 12, 4, 2);
    ctx.beginPath();
    ctx.moveTo(4, -34);
    ctx.lineTo(-6, -26 + Math.sin(t * 5) * 2);
    ctx.lineTo(0, -24);
    ctx.closePath();
    fill(ctx, c.scarf, 0, -28, 5, 5, 1.8);
    for (let i = 0; i < 3; i++) dot(ctx, 8 + i * 6, -33 + (i % 2), 1.3, "#ffffff");
  }
  // 부리
  ctx.beginPath();
  ctx.moveTo(26, -50);
  ctx.quadraticCurveTo(40, -52, 42, -45);
  ctx.quadraticCurveTo(40, -40, 26, -41);
  ctx.closePath();
  fill(ctx, "#ff8a1c", 34, -46, 9, 5, 2.4);
  ctx.beginPath();
  ctx.moveTo(27, -45.5);
  ctx.quadraticCurveTo(34, -44.5, 41, -45);
  stroke(ctx, alpha("#9a3d00", 0.6), 1.4);
  dot(ctx, 33, -49, 1.2, "#9a3d00");
  // 눈 · 볼
  eye(ctx, 18, -53, 6.5, p, { iris: "#1f2d5a", look: 0.4 });
  blush(ctx, 22, -42, 5);
  // 고무 광택
  gloss(ctx, -8, -34, 14, 5, 0.75, -0.2);
  gloss(ctx, 8, -58, 6, 3, 0.8);
  bounce(ctx, -2, -20, 30, 16, 0.5);
  if (c.hat) pirateHat(ctx, 12, -63, 0.6, "#2b2d4a", 0.12);
  if (c.crown) {
    ctx.beginPath();
    ctx.moveTo(4, -62);
    ctx.lineTo(4, -78);
    ctx.lineTo(10, -68);
    ctx.lineTo(15, -80);
    ctx.lineTo(20, -68);
    ctx.lineTo(26, -78);
    ctx.lineTo(26, -62);
    ctx.closePath();
    fill(ctx, "#ffd54f", 15, -70, 11, 9, 2.2);
    dot(ctx, 15, -67, 2.4, "#e53935");
  }
  if (c.target) {
    circ(ctx, -4, -20, 11);
    flat(ctx, "#ffffff", 2, "#b8322a");
    circ(ctx, -4, -20, 7);
    flat(ctx, "#e53935", 0);
    circ(ctx, -4, -20, 3);
    flat(ctx, "#ffffff", 0);
  }
  if (c.gold) {
    ctx.save();
    ctx.globalAlpha *= 0.4 + 0.4 * Math.sin(p.now * 7);
    gloss(ctx, 0, -28, 18, 7, 0.9, 0);
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const a = p.now * 2 + i * 2.1;
      sparkle(ctx, Math.cos(a) * 40, -40 + Math.sin(a) * 22, 6, 0.6 + 0.4 * Math.sin(p.now * 6 + i));
    }
  }
  wetDrops(ctx, p, -78, 20);
}
def("pirate-duck", (ctx, e, p) => duck(ctx, p, { body: "#ffd23f", hat: true, scarf: "#e8423a" }));
def("golden-duck", (ctx, e, p) => duck(ctx, p, { body: "#ffc21a", crown: true, gold: true }));
def("duck-target", (ctx, e, p) => {
  rrect(ctx, -3, -4, 6, 34, 2);
  fill(ctx, "#a0703f", 0, 12, 3, 17, 1.6);
  duck(ctx, p, { body: "#fff06a", target: true });
});
def("duck-gold", (ctx, e, p) => {
  rrect(ctx, -3, -4, 6, 34, 2);
  fill(ctx, "#a0703f", 0, 12, 3, 17, 1.6);
  duck(ctx, p, { body: "#ffc21a", target: true, gold: true });
});

export { crabClaw, crabLegs, stalkEye, puffer, duck };
