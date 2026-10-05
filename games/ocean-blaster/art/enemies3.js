/*
 * 🌊 바다 물총 대작전 — 바다 친구들 3: 물고기 · 돌고래 · 고래 · 새우 · 랍스터 · 해파리 · 앵무새 · 가오리 · 거북이 · 숨은 친구
 */
import {
  TAU, INK, mix, lighten, darken, alpha, lineOf, lit, vlit, linear, radial,
  ell, circ, rrect, smooth, fill, flat, stroke, gloss, bounce, dot, shadow,
  eye, brow, mouth, blush, star, sparkle, dizzyStars, wetDrops, drop, pirateHat, eyepatch, limb, fin,
} from "./kit.js?v=2";
import { ENEMY_ART } from "./enemies.js?v=2";

const def = (id, fn) => (ENEMY_ART[id] = fn);

/* ================================================================
 * 물고기 공통 — 몸 모양 · 꼬리 · 무늬가 종마다 다르다
 * o: { x, y, rx, ry, body, belly, tail, fin, tailKind(fork|fan|round), pattern(bands|stripes|scales|none), patternColor, eyeR, iris, gold, nose }
 * ============================================================== */
function fish(ctx, p, o) {
  const { x, y, rx, ry } = o;
  const t = p.t;
  const wag = Math.sin(t * 13) * 0.28;
  // 꼬리
  ctx.save();
  ctx.translate(x - rx + 3, y);
  ctx.rotate(wag);
  const L = ry * 1.35;
  if (o.tailKind === "fan") {
    smooth(ctx, [0, 0, -L * 0.7, -L * 1.1, -L * 1.5, -L * 0.9, -L * 1.2, 0, -L * 1.5, L * 0.9, -L * 0.7, L * 1.1], true, 0.5);
    ctx.fillStyle = alpha(o.tail, 0.92);
    ctx.fill();
    stroke(ctx, lineOf(o.tail), 2.2);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(-L * 1.3, i * L * 0.4);
      stroke(ctx, alpha(darken(o.tail, 0.3), 0.45), 1.3);
    }
  } else if (o.tailKind === "round") {
    ell(ctx, -L * 0.6, 0, L * 0.65, L * 0.8);
    fill(ctx, o.tail, -L * 0.6, 0, L * 0.65, L * 0.8, 2.4);
  } else {
    fin(ctx, [0, 0, -L * 0.9, -L * 1.05, -L * 1.2, -L * 0.85, -L * 0.75, 0, -L * 1.2, L * 0.85, -L * 0.9, L * 1.05], o.tail, 3);
  }
  ctx.restore();
  // 등 · 배 지느러미
  smooth(ctx, [x - rx * 0.45, y - ry + 2, x - rx * 0.15, y - ry - ry * 0.75, x + rx * 0.25, y - ry * 0.95], false, 0.5);
  ctx.lineTo(x + rx * 0.3, y - ry * 0.6);
  ctx.lineTo(x - rx * 0.5, y - ry * 0.6);
  ctx.closePath();
  ctx.fillStyle = alpha(o.fin || o.tail, 0.9);
  ctx.fill();
  stroke(ctx, lineOf(o.fin || o.tail), 2);
  // 몸
  const nose = o.nose || 1;
  smooth(ctx, [x - rx, y, x - rx * 0.55, y - ry, x + rx * 0.35, y - ry * 0.98, x + rx * nose, y - ry * 0.15, x + rx * 0.9, y + ry * 0.45, x + rx * 0.3, y + ry * 0.95, x - rx * 0.55, y + ry * 0.85], true, 0.5);
  fill(ctx, o.body, x - rx * 0.1, y - ry * 0.2, rx, ry, 2.8);
  ctx.save();
  smooth(ctx, [x - rx, y, x - rx * 0.55, y - ry, x + rx * 0.35, y - ry * 0.98, x + rx * nose, y - ry * 0.15, x + rx * 0.9, y + ry * 0.45, x + rx * 0.3, y + ry * 0.95, x - rx * 0.55, y + ry * 0.85], true, 0.5);
  ctx.clip();
  // 배
  ell(ctx, x + rx * 0.1, y + ry * 0.75, rx * 0.95, ry * 0.55);
  ctx.fillStyle = alpha(o.belly, 0.95);
  ctx.fill();
  // 무늬
  if (o.pattern === "bands") {
    for (const bx of [x + rx * 0.35, x - rx * 0.2]) {
      ctx.beginPath();
      ctx.moveTo(bx - 3, y - ry);
      ctx.quadraticCurveTo(bx + 4, y, bx - 3, y + ry);
      ctx.lineTo(bx + 4, y + ry);
      ctx.quadraticCurveTo(bx + 11, y, bx + 4, y - ry);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#1a1a2e";
      ctx.stroke();
    }
  } else if (o.pattern === "stripes") {
    ctx.beginPath();
    ctx.moveTo(x - rx, y - ry * 0.1);
    ctx.quadraticCurveTo(x, y - ry * 0.45, x + rx * 0.8, y - ry * 0.25);
    stroke(ctx, alpha(o.patternColor || "#1a2a5a", 0.85), ry * 0.28);
  } else if (o.pattern === "scales") {
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = alpha(darken(o.body, 0.25), 0.5);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++) {
        const sx = x - rx * 0.5 + c * rx * 0.3 + (r % 2) * rx * 0.15;
        const sy = y - ry * 0.45 + r * ry * 0.4;
        ctx.beginPath();
        ctx.arc(sx, sy, ry * 0.22, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      }
  }
  ctx.restore();
  // 가슴지느러미
  ctx.save();
  ctx.translate(x + rx * 0.1, y + ry * 0.25);
  ctx.rotate(0.4 + Math.sin(t * 10) * 0.3);
  fin(ctx, [0, 0, -ry * 0.7, ry * 0.35, -ry * 0.9, ry * 0.05, -ry * 0.55, -ry * 0.3], o.fin || o.tail, 2);
  ctx.restore();
  gloss(ctx, x - rx * 0.15, y - ry * 0.55, rx * 0.4, ry * 0.18, 0.6, 0);
  bounce(ctx, x, y, rx, ry, 0.45);
  eye(ctx, x + rx * 0.5, y - ry * 0.18, o.eyeR || ry * 0.42, p, { iris: o.iris || "#1f3f7a", look: 0.4 });
  if (o.patch && !p.soaked) eyepatch(ctx, x + rx * 0.5, y - ry * 0.18, (o.eyeR || ry * 0.42) * 0.95);
  mouth(ctx, x + rx * 0.86, y + ry * 0.28, Math.max(3, ry * 0.22), p, o.mouth || "smile");
  blush(ctx, x + rx * 0.55, y + ry * 0.2, ry * 0.25);
  if (o.gold) {
    const sh = 0.45 + 0.45 * Math.sin((p.now || 0) * 7);
    ctx.save();
    ctx.globalAlpha *= sh;
    gloss(ctx, x, y - ry * 0.25, rx * 0.6, ry * 0.25, 0.95, 0);
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const a = (p.now || 0) * 2 + i * 1.6;
      sparkle(ctx, x + Math.cos(a) * rx * 1.5, y + Math.sin(a) * ry * 1.8, 5 + (i % 2) * 2, 0.5 + 0.5 * Math.sin((p.now || 0) * 6 + i));
    }
  }
}

/* ---------------- 날치 — 날씬한 몸 + 커다란 날개 지느러미 ---------------- */
def("flying-fish", (ctx, e, p) => {
  const flap = Math.sin(p.t * 20) * 0.4;
  for (const side of [1, -1]) {
    ctx.save();
    ctx.translate(-2, -18);
    ctx.rotate(-0.55 + flap * side * 0.6);
    ctx.scale(1, side > 0 ? 1 : 0.6);
    fin(ctx, [0, 0, -14, -30, -34, -42, -46, -32, -30, -14], side > 0 ? "#9fdcff" : "#7cc8f2", 4);
    ctx.restore();
  }
  fish(ctx, p, { x: 0, y: -14, rx: 30, ry: 10, body: "#3b86e8", belly: "#e6f4ff", tail: "#2f6fd0", fin: "#8fd0ff", tailKind: "fork", pattern: "stripes", patternColor: "#1f4fb0", eyeR: 6.4, iris: "#13306a", nose: 1.08 });
});

/* ---------------- 물고기 떼 — 다섯 마리가 서로 다른 열대어 ---------------- */
const SCHOOL = [
  { body: "#ff8a2a", belly: "#ffd2a6", tail: "#ff7a1a", fin: "#ff9f4a", pattern: "bands", tailKind: "round", iris: "#2a1a0a" }, // 흰동가리
  { body: "#2f7fe8", belly: "#bfe0ff", tail: "#ffd23f", fin: "#1a4fb0", pattern: "stripes", patternColor: "#0d1f5a", tailKind: "fork" }, // 블루탱
  { body: "#ffd84a", belly: "#fff6c8", tail: "#ffc21a", fin: "#ffe680", pattern: "stripes", patternColor: "#e08a00", tailKind: "fan" }, // 나비고기
  { body: "#5fd08a", belly: "#e6fff0", tail: "#3fb06a", fin: "#9ff0c0", pattern: "scales", tailKind: "fork" }, // 놀래기
  { body: "#ff7ab8", belly: "#ffe3f0", tail: "#ff5fa2", fin: "#ffb3d6", pattern: "scales", tailKind: "fan" }, // 꽃돔
];
def("fish-school", (ctx, e, p) => {
  const c = SCHOOL[(e.slot || 0) % SCHOOL.length];
  fish(ctx, p, { x: 0, y: -13, rx: 21, ry: 12, ...c, eyeR: 6 });
});

/* ---------------- 황금 물고기 — 하늘하늘 금붕어 꼬리 ---------------- */
def("golden-fish", (ctx, e, p) => {
  fish(ctx, p, { x: 2, y: -15, rx: 24, ry: 15, body: "#ffc928", belly: "#fff2b0", tail: "#ff9f1c", fin: "#ffb84a", tailKind: "fan", pattern: "scales", eyeR: 7, iris: "#5a2a00", gold: true });
});

/* ---------------- 황금 해적 물고기 — 동글동글 보물 물고기 ---------------- */
def("golden-pirate-fish", (ctx, e, p) => {
  // 등에 매단 금화 주머니
  fish(ctx, p, { x: 0, y: -20, rx: 32, ry: 21, body: "#ffbf1f", belly: "#fff0a6", tail: "#e68a00", fin: "#ffcf4d", tailKind: "round", pattern: "scales", eyeR: 8.5, iris: "#3a1f00", gold: true, patch: true, mouth: "grin" });
  pirateHat(ctx, 12, -42, 0.72, "#2b2d4a", 0.18);
  for (let i = 0; i < 3; i++) {
    const a = p.t * 3 + i * 2.1;
    ell(ctx, -20 + Math.cos(a) * 6, -48 + Math.sin(a) * 4 - i * 6, 6, 3);
    flat(ctx, "#ffd23f", 1.4, "#a36a00");
  }
});

/* ================================================================
 * 장난 돌고래 — 아치형 몸, 긴 주둥이, 반짝이는 등
 * ============================================================== */
def("dolphin", (ctx, e, p) => {
  const base = "#6aa2dc";
  // 꼬리
  ctx.save();
  ctx.translate(-46, -8);
  ctx.rotate(-0.3 + Math.sin(p.t * 8) * 0.2);
  smooth(ctx, [0, 0, -14, -14, -24, -16, -14, -2, -24, 12, -14, 10], true, 0.4);
  fill(ctx, darken(base, 0.08), -12, -2, 12, 12, 2.6);
  ctx.restore();
  // 몸 (아치)
  smooth(ctx, [-48, -6, -32, -34, 0, -44, 30, -40, 46, -28, 66, -22, 66, -16, 46, -12, 20, -4, -14, -2], true, 0.45);
  fill(ctx, base, 4, -26, 50, 20, 3);
  ctx.save();
  smooth(ctx, [-48, -6, -32, -34, 0, -44, 30, -40, 46, -28, 66, -22, 66, -16, 46, -12, 20, -4, -14, -2], true, 0.45);
  ctx.clip();
  smooth(ctx, [-30, 4, 0, -18, 40, -20, 70, -18, 70, 6], true, 0.5);
  ctx.fillStyle = "#eaf4ff";
  ctx.fill();
  ctx.restore();
  // 등지느러미
  smooth(ctx, [-6, -42, -2, -64, -16, -66, -18, -42], true, 0.4);
  fill(ctx, darken(base, 0.08), -10, -54, 8, 12, 2.6);
  // 가슴지느러미
  ctx.save();
  ctx.translate(14, -16);
  ctx.rotate(0.6 + Math.sin(p.t * 6) * 0.2);
  smooth(ctx, [0, 0, -4, 14, -14, 18, -10, 4], true, 0.5);
  fill(ctx, darken(base, 0.1), -6, 8, 7, 8, 2.2);
  ctx.restore();
  gloss(ctx, -4, -36, 18, 4, 0.6, -0.1);
  bounce(ctx, 6, -22, 48, 18, 0.4);
  eye(ctx, 36, -32, 6.5, p, { iris: "#1f3f7a", look: 0.4 });
  ctx.beginPath();
  ctx.moveTo(48, -20);
  ctx.quadraticCurveTo(56, -15, 66, -19);
  stroke(ctx, "#2a3d66", 2.6);
  blush(ctx, 44, -24, 5);
  dot(ctx, 30, -42, 2.6, "rgba(40,80,140,0.6)");
  if (p.dizzy) dizzyStars(ctx, p.now, -70, 22);
});

/* ================================================================
 * 꼬마 고래 — 큰 둥근 등, 숨구멍(약점), 물기둥
 * ============================================================== */
function whale(ctx, e, p, c) {
  const r = c.r;
  const spout = p.mode === "spout" && !p.soaked;
  // 꼬리
  ctx.save();
  ctx.translate(-r - 4, -18);
  ctx.rotate(-0.55 + Math.sin(p.t * 2) * 0.15);
  smooth(ctx, [0, 0, -8, -22, -30, -30, -16, -12, -6, -6, -16, -4, -32, 4, -10, 6], true, 0.45);
  fill(ctx, c.body, -14, -10, 16, 16, 2.8);
  ctx.restore();
  smooth(ctx, [-r, 4, -r - 2, -r * 0.6, -r * 0.4, -r * 0.88, r * 0.4, -r * 0.86, r + 4, -r * 0.3, r + 6, 0, r - 6, 6], true, 0.45);
  fill(ctx, c.body, -r * 0.1, -r * 0.4, r, r * 0.6, 3);
  ctx.save();
  smooth(ctx, [-r, 4, -r - 2, -r * 0.6, -r * 0.4, -r * 0.88, r * 0.4, -r * 0.86, r + 4, -r * 0.3, r + 6, 0, r - 6, 6], true, 0.45);
  ctx.clip();
  smooth(ctx, [0, 10, r * 0.4, -r * 0.24, r + 8, -r * 0.24, r + 8, 10], true, 0.5);
  ctx.fillStyle = c.belly;
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(r * 0.35 + i * 7, -r * 0.18 + i);
    ctx.lineTo(r * 0.42 + i * 7, 4);
    stroke(ctx, alpha(darken(c.belly, 0.2), 0.5), 1.6);
  }
  if (c.spots)
    for (const [x, y] of [
      [-r * 0.4, -r * 0.5],
      [-r * 0.1, -r * 0.7],
      [-r * 0.6, -r * 0.25],
    ]) {
      circ(ctx, x, y, 3.6);
      ctx.fillStyle = alpha(darken(c.body, 0.25), 0.5);
      ctx.fill();
    }
  ctx.restore();
  gloss(ctx, -r * 0.35, -r * 0.62, r * 0.38, r * 0.1, 0.55, -0.15);
  bounce(ctx, 0, -r * 0.3, r, r * 0.6, 0.4);
  // 숨구멍
  ell(ctx, -6, -r * 0.82, 7, 2.8);
  flat(ctx, "#1d2a55", 1.4, "#0d1430");
  eye(ctx, r * 0.55, -r * 0.42, 7.5, p, { iris: "#1f3f7a", look: 0.3 });
  ctx.beginPath();
  ctx.moveTo(r * 0.62, -r * 0.16);
  ctx.quadraticCurveTo(r * 0.84, -r * 0.02, r + 4, -r * 0.18);
  stroke(ctx, "#2a3d66", 3);
  blush(ctx, r * 0.74, -r * 0.27, 6);
  // 가슴지느러미
  ctx.save();
  ctx.translate(r * 0.2, -4);
  ctx.rotate(0.5 + Math.sin(p.t * 3) * 0.2);
  smooth(ctx, [0, 0, -8, 14, -22, 16, -14, 2], true, 0.5);
  fill(ctx, darken(c.body, 0.06), -10, 8, 10, 8, 2.4);
  ctx.restore();
  if (spout) {
    const h = 66 + Math.sin(p.now * 20) * 6;
    const y0 = -r * 0.84;
    smooth(ctx, [-12, y0, -16, y0 - h * 0.6, -34, y0 - h, -18, y0 - h - 16, 0, y0 - h - 8, 18, y0 - h - 16, 30, y0 - h, 10, y0 - h * 0.6, 2, y0], true, 0.45);
    ctx.fillStyle = linear(ctx, "spout", 0, y0 - h - 16, 0, y0, [
      [0, "rgba(255,255,255,0.95)"],
      [1, "rgba(160,225,255,0.85)"],
    ]);
    ctx.fill();
    stroke(ctx, "rgba(70,160,220,0.8)", 2.2);
    for (let i = 0; i < 6; i++) drop(ctx, -30 + i * 12, y0 - h - 10 + ((p.now * 90 + i * 17) % 50), 3.2);
  }
  if (p.dizzy) dizzyStars(ctx, p.now, -r - 14, 26);
}
def("little-whale", (ctx, e, p) => whale(ctx, e, p, { body: "#4f86e8", belly: "#dbe8ff", r: 54 }));
def("baby-narwhal", (ctx, e, p) => {
  // 반짝이는 나선 뿔
  ctx.save();
  ctx.translate(38, -40);
  ctx.rotate(-0.8);
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(0, -46);
  ctx.lineTo(5, 0);
  ctx.closePath();
  fill(ctx, "#fff3c4", 0, -22, 5, 24, 2.2);
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-5 + i * 1.1, -i * 9);
    ctx.lineTo(4 - i * 0.9, -i * 9 - 4);
    stroke(ctx, alpha("#c9a24a", 0.7), 1.4);
  }
  ctx.restore();
  whale(ctx, e, p, { body: "#bfdcf2", belly: "#ffffff", r: 46, spots: true });
  for (let i = 0; i < 3; i++) sparkle(ctx, Math.cos(p.now * 2 + i * 2) * 50, -40 + Math.sin(p.now * 2 + i * 2) * 20, 6, 0.5 + 0.5 * Math.sin(p.now * 5 + i));
});

/* ================================================================
 * 새우 특공대 — 휘어진 마디 몸, 긴 더듬이, 특공대 머리띠
 * ============================================================== */
def("shrimp-squad", (ctx, e, p) => {
  const base = "#ff8577";
  const t = p.t;
  // 다리
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-8 + i * 7, -12);
    ctx.lineTo(-10 + i * 7, -2 + Math.sin(t * 14 + i) * 2);
    stroke(ctx, darken(base, 0.2), 2.2);
  }
  // 꼬리 부채
  ctx.save();
  ctx.translate(-24, -12);
  ctx.rotate(0.3 + Math.sin(t * 9) * 0.15);
  smooth(ctx, [0, 0, -14, -10, -20, -2, -14, 6], true, 0.4);
  fill(ctx, darken(base, 0.05), -10, -2, 9, 7, 2.2);
  ctx.restore();
  // 마디 (휘어진 몸)
  const segs = [
    [-20, -12, 8],
    [-11, -18, 9.5],
    [0, -22, 10.5],
    [12, -24, 12],
  ];
  for (const [x, y, r] of segs) {
    ell(ctx, x, y, r, r * 0.92);
    fill(ctx, base, x, y, r, r * 0.92, 2.6);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.8, r * 0.75, 0, 1.1 * Math.PI, 1.9 * Math.PI);
    stroke(ctx, alpha("#ffffff", 0.45), 1.6);
  }
  gloss(ctx, 8, -30, 6, 3, 0.55);
  // 머리 + 뿔
  ctx.beginPath();
  ctx.moveTo(18, -34);
  ctx.lineTo(34, -40);
  ctx.lineTo(22, -30);
  ctx.closePath();
  flat(ctx, darken(base, 0.05), 1.8);
  // 더듬이
  ctx.beginPath();
  ctx.moveTo(20, -32);
  ctx.bezierCurveTo(34, -56, 48, -58, 58, -46 + Math.sin(t * 6) * 3);
  ctx.moveTo(18, -34);
  ctx.bezierCurveTo(26, -64, 40, -70, 50, -66 + Math.sin(t * 6 + 1) * 3);
  stroke(ctx, lineOf(base), 1.8);
  // 머리띠
  ctx.beginPath();
  ctx.arc(12, -24, 12.6, -2.7, -0.55);
  stroke(ctx, "#2f9be0", 4.6);
  ctx.beginPath();
  ctx.moveTo(1, -32);
  ctx.lineTo(-8, -40 + Math.sin(t * 16) * 3);
  ctx.moveTo(1, -32);
  ctx.lineTo(-6, -28 + Math.sin(t * 16 + 1) * 3);
  stroke(ctx, "#2f9be0", 3.4);
  eye(ctx, 16, -26, 5.5, p, { iris: "#2a1a3a", look: 0.4 });
  if (!p.soaked) brow(ctx, 16, -34, 5, 2.4, 2.4);
  mouth(ctx, 22, -17, 4, p);
  wetDrops(ctx, p, -50, 16);
});

/* ================================================================
 * 랍스터 대장 — 큰 집게 · 콧수염 · 줄무늬 배(약점) · 선장 견장
 * ============================================================== */
def("lobster-chief", (ctx, e, p) => {
  const base = "#e8423a";
  const t = p.t;
  const wave = p.soaked ? 1.1 : Math.sin(t * 3) * 0.3;
  // 더듬이
  ctx.beginPath();
  ctx.moveTo(-6, -86);
  ctx.bezierCurveTo(-14, -120, -36, -124, -50, -108 + Math.sin(t * 4) * 4);
  ctx.moveTo(6, -86);
  ctx.bezierCurveTo(14, -124, 38, -128, 52, -112 + Math.sin(t * 4 + 1) * 4);
  stroke(ctx, lineOf(base), 2.6);
  // 집게 (크고 두꺼운)
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 22, -58);
    ctx.rotate(s * (-0.5 + (s > 0 ? wave : -wave * 0.5)));
    limb(ctx, [0, 0, s * 10, -12, s * 14, -26], 8, base, { line: 4 });
    ctx.translate(s * 16, -34);
    ctx.scale(s, 1);
    smooth(ctx, [-10, 6, -14, -12, -4, -26, 10, -24, 16, -10, 6, -6, 10, 4], true, 0.45);
    fill(ctx, base, 0, -10, 14, 16, 2.6);
    smooth(ctx, [6, -6, 18, -2, 20, 8, 8, 6], true, 0.45);
    fill(ctx, darken(base, 0.05), 12, 2, 7, 6, 2.2);
    gloss(ctx, -4, -16, 5, 8, 0.5, 0.2);
    for (let i = 0; i < 3; i++) dot(ctx, -6 + i * 5, -2 - i * 4, 1.6, alpha("#ffffff", 0.7));
    ctx.restore();
  }
  // 꼬리 부채
  smooth(ctx, [-14, -6, -22, 4, 0, 8, 22, 4, 14, -6], true, 0.4);
  fill(ctx, darken(base, 0.06), 0, 0, 20, 7, 2.4);
  // 몸 (마디)
  smooth(ctx, [-20, -16, -24, -48, -16, -76, 0, -84, 16, -76, 24, -48, 20, -16, 0, -10], true, 0.5);
  fill(ctx, base, -4, -50, 22, 36, 3);
  // 배 줄무늬 (약점)
  for (let i = 0; i < 4; i++) {
    ell(ctx, 0, -18 - i * 8, 13 - i * 1.2, 4.6);
    fill(ctx, "#ffb7a6", 0, -18 - i * 8, 13 - i * 1.2, 4.6, 1.6);
  }
  // 선장 견장
  for (const s of [-1, 1]) {
    ell(ctx, s * 20, -62, 8, 4.4, s * 0.3);
    flat(ctx, "#ffd23f", 1.6, "#a36a00");
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * (15 + i * 4), -59);
      ctx.lineTo(s * (15 + i * 4), -53);
      stroke(ctx, "#ffd23f", 1.6);
    }
  }
  gloss(ctx, -10, -66, 6, 12, 0.5, 0.15);
  bounce(ctx, 0, -48, 20, 34, 0.4);
  eye(ctx, -8, -72, 7, p, { iris: "#1f2d5a" });
  eye(ctx, 8, -72, 7, p, { iris: "#1f2d5a" });
  brow(ctx, -8, -82, 6, p.angry ? 3 : -1, 3);
  brow(ctx, 8, -82, 6, p.angry ? -3 : 1, 3);
  // 콧수염
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.bezierCurveTo(-6, -66, -18, -64, -20, -56);
  ctx.bezierCurveTo(-14, -60, -6, -58, 0, -60);
  ctx.bezierCurveTo(6, -58, 14, -60, 20, -56);
  ctx.bezierCurveTo(18, -64, 6, -66, 0, -60);
  flat(ctx, "#6d4c41", 1.6, "#3e2a24");
  if (p.soaked) mouth(ctx, 0, -52, 6, p);
  if (p.dizzy) dizzyStars(ctx, p.now, -96, 20);
  wetDrops(ctx, p, -100, 18);
});

/* ================================================================
 * 둥실 해파리 — 반투명 갓 · 안쪽 무늬 · 프릴 · 긴 리본 촉수
 * ============================================================== */
def("jellyfish", (ctx, e, p) => {
  const t = p.t;
  // 리본 촉수
  for (let i = 0; i < 6; i++) {
    const x = -20 + i * 8;
    ctx.beginPath();
    ctx.moveTo(x, -36);
    for (let k = 1; k <= 7; k++) ctx.lineTo(x + Math.sin(t * 5 + i + k * 0.9) * (3 + k * 0.6), -36 + k * 6.5);
    stroke(ctx, i % 2 ? "rgba(255,150,210,0.9)" : "rgba(200,160,255,0.9)", i % 3 ? 2.6 : 4.2);
  }
  // 프릴
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const x = -26 + i * 6.5;
    const y = -34 + Math.sin(t * 6 + i) * 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.quadraticCurveTo(x - 3.2, y + 7, x, y);
  }
  stroke(ctx, "rgba(255,170,220,0.95)", 4);
  // 갓
  smooth(ctx, [-34, -36, -34, -62, -18, -80, 0, -84, 18, -80, 34, -62, 34, -36, 0, -32], true, 0.5);
  ctx.fillStyle = linear(ctx, "jellybell", 0, -84, 0, -32, [
    [0, "rgba(255,214,240,0.97)"],
    [0.6, "rgba(255,160,215,0.92)"],
    [1, "rgba(230,130,220,0.88)"],
  ]);
  ctx.fill();
  stroke(ctx, "#c2508f", 2.6);
  // 안쪽 네잎 무늬
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    ell(ctx, Math.cos(a) * 10, -62 + Math.sin(a) * 5, 6, 4, a);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fill();
  }
  gloss(ctx, -14, -68, 8, 12, 0.7, 0.3);
  eye(ctx, -10, -50, 6, p, { iris: "#7a2a6a" });
  eye(ctx, 10, -50, 6, p, { iris: "#7a2a6a" });
  mouth(ctx, 0, -41, 5, p);
  blush(ctx, -19, -44, 5);
  blush(ctx, 19, -44, 5);
  if (p.dizzy) dizzyStars(ctx, p.now, -96, 20);
});

/* ================================================================
 * 해적 앵무새 — 날개 깃털 층 · 굽은 부리 · 해적 모자
 * ============================================================== */
def("pirate-parrot", (ctx, e, p) => {
  const t = p.t;
  const flap = Math.sin(t * 15);
  // 꼬리 깃
  for (const [c, a] of [
    ["#2f6fe8", 0.15],
    ["#ffd23f", 0],
    ["#ff4d4d", -0.15],
  ]) {
    ctx.save();
    ctx.translate(-16, -6);
    ctx.rotate(a);
    smooth(ctx, [0, -3, -36, -4, -42, 0, -36, 4, 0, 3], true, 0.4);
    fill(ctx, c, -20, 0, 20, 4, 2);
    ctx.restore();
  }
  // 뒷날개
  ctx.save();
  ctx.translate(-2, -14);
  ctx.scale(1, flap);
  smooth(ctx, [0, 0, -16, -16, -30, -34, -10, -40, 6, -22, 8, 0], true, 0.45);
  fill(ctx, "#1fb36a", -10, -20, 16, 20, 2.4);
  ctx.restore();
  // 몸
  smooth(ctx, [-20, -8, -14, -24, 6, -26, 22, -16, 18, 2, 0, 6], true, 0.5);
  fill(ctx, "#ff4d4d", 0, -10, 22, 16, 3);
  ell(ctx, 6, -4, 12, 7);
  ctx.fillStyle = "#ffd23f";
  ctx.fill();
  // 머리
  circ(ctx, 20, -26, 14);
  fill(ctx, "#ff4d4d", 20, -26, 14, 14, 2.8);
  ell(ctx, 24, -24, 7, 8);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  // 부리
  smooth(ctx, [30, -30, 44, -30, 46, -18, 38, -14, 32, -20], true, 0.45);
  fill(ctx, "#ffd84a", 38, -24, 8, 8, 2.4);
  smooth(ctx, [32, -18, 40, -14, 36, -10], true, 0.4);
  flat(ctx, "#3a3a4a", 1.4);
  eye(ctx, 24, -28, 5, p, { iris: "#1a1a2e", look: 0.4 });
  // 앞날개 (깃털 층)
  ctx.save();
  ctx.translate(-2, -12);
  ctx.scale(1, -flap * 0.85 + 0.15);
  smooth(ctx, [-6, 0, -22, -14, -26, -36, -6, -42, 10, -24, 10, 0], true, 0.45);
  fill(ctx, "#2fd07f", -6, -20, 16, 20, 2.6);
  for (const [x, c] of [
    [-16, "#2f6fe8"],
    [-8, "#1fb36a"],
  ]) {
    smooth(ctx, [x, -30, x - 4, -42, x + 4, -38], true, 0.4);
    flat(ctx, c, 1.4);
  }
  ctx.restore();
  pirateHat(ctx, 16, -38, 0.58, "#2b2d4a", 0.1);
  if (p.dizzy) dizzyStars(ctx, p.now, -50, 18);
  wetDrops(ctx, p, -52, 18);
});

/* ================================================================
 * 폭풍 가오리 — 넓은 날개 · 번개 무늬 · 머리 위 꼬마 먹구름
 * ============================================================== */
def("storm-ray", (ctx, e, p) => {
  const t = p.t;
  const flap = Math.sin(t * 5) * 9;
  // 꼬리
  ctx.beginPath();
  ctx.moveTo(-28, -14);
  ctx.bezierCurveTo(-56, -10, -70, -30, -86, -20 + Math.sin(t * 6) * 4);
  stroke(ctx, "#2d2f6a", 3);
  // 날개 몸
  smooth(ctx, [44, -14, 18, -30 - flap * 0.4, -6, -54 - flap, -16, -30, -36, -14, -16, -2, -6, 22 + flap, 18, 2], true, 0.45);
  fill(ctx, "#4d50b8", 2, -14, 40, 26, 3);
  smooth(ctx, [38, -14, 14, -4, 0, 12 + flap * 0.8, 6, -8], true, 0.4);
  ctx.fillStyle = "#8a8ef0";
  ctx.fill();
  // 번개 무늬
  ctx.beginPath();
  ctx.moveTo(-4, -40);
  ctx.lineTo(6, -28);
  ctx.lineTo(-2, -26);
  ctx.lineTo(8, -12);
  stroke(ctx, "#fff27a", 3.4);
  gloss(ctx, 4, -26, 12, 4, 0.5);
  eye(ctx, 28, -20, 5.5, p, { iris: "#2a1a5a", look: 0.5 });
  if (p.open && !p.soaked) {
    ell(ctx, 36, -10, 6, 4.5);
    flat(ctx, "#7c2140", 2);
    const gl = 0.6 + 0.4 * Math.sin(p.now * 20);
    shadow(ctx, 4, -8, 14 * gl + 6, 10 * gl + 4, 0.8, "255,240,120");
  } else mouth(ctx, 36, -12, 4.5, p);
  // 꼬마 먹구름
  const cy = -80 + Math.sin(t * 2) * 4;
  for (const [x, y, r] of [
    [-16, cy + 2, 12],
    [0, cy - 6, 16],
    [16, cy + 2, 12],
  ]) {
    circ(ctx, x, y, r);
    fill(ctx, "#b8c4d8", x, y, r, r, 2.4);
  }
  ell(ctx, 0, cy + 6, 26, 8);
  ctx.fillStyle = "#b8c4d8";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-6, cy - 2, 3.4, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.moveTo(10, cy - 2);
  ctx.arc(6, cy - 2, 3.4, 0.1 * Math.PI, 0.9 * Math.PI);
  stroke(ctx, "#4a5672", 2);
  if (Math.sin(t * 3) > 0.7) {
    ctx.beginPath();
    ctx.moveTo(-2, cy + 12);
    ctx.lineTo(-8, cy + 24);
    ctx.lineTo(0, cy + 22);
    ctx.lineTo(-6, cy + 34);
    stroke(ctx, "#fff27a", 3);
  }
});

/* ================================================================
 * 거북이 · 방패 거북이
 * ============================================================== */
function turtle(ctx, e, p, c) {
  const hide = p.mode === "shell" && !p.soaked;
  const lowered = p.mode === "lowered";
  const swim = Math.sin(p.t * 5);
  for (const s of [-1, 1]) {
    ell(ctx, s * 30, -8, 14, 6.5, s * (0.4 + swim * 0.2));
    fill(ctx, c.skin, s * 30, -8, 14, 6.5, 2.4);
  }
  // 등껍질
  smooth(ctx, [-40, -10, -38, -40, -18, -60, 8, -62, 30, -50, 40, -26, 40, -10], true, 0.45);
  fill(ctx, c.shell, -2, -36, 40, 28, 3);
  ctx.save();
  smooth(ctx, [-40, -10, -38, -40, -18, -60, 8, -62, 30, -50, 40, -26, 40, -10], true, 0.45);
  ctx.clip();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = alpha(darken(c.shell, 0.35), 0.75);
  const hex = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.75);
    }
    ctx.closePath();
    ctx.fillStyle = alpha(lighten(c.shell, 0.12), 0.55);
    ctx.fill();
    ctx.stroke();
  };
  hex(0, -36, 13);
  hex(-24, -28, 11);
  hex(24, -28, 11);
  hex(-12, -54, 9);
  hex(12, -54, 9);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-42, -10);
  ctx.lineTo(42, -10);
  stroke(ctx, c.rim, 7);
  gloss(ctx, -16, -48, 12, 5, 0.5);
  // 머리
  if (!hide) {
    ctx.save();
    ctx.translate(34, -40);
    smooth(ctx, [-10, 10, -12, -6, 0, -16, 14, -12, 18, 2, 8, 12], true, 0.5);
    fill(ctx, c.skin, 2, -2, 15, 13, 2.6);
    eye(ctx, 6, -4, 6.2, p, { iris: "#1f3f2a", look: 0.4 });
    if (c.pirate) {
      if (!p.soaked) eyepatch(ctx, -4, -4, 5);
      pirateHat(ctx, 2, -14, 0.62, "#2b2d4a", 0.15);
    }
    if (lowered) {
      ell(ctx, 10, 6, 5, 6);
      flat(ctx, "#7c2140", 1.8);
    } else mouth(ctx, 10, 5, 5, p);
    blush(ctx, 11, 1, 3.6);
    ctx.restore();
  } else {
    for (const x of [28, 35]) {
      ell(ctx, x, -16, 2.4, 3);
      ctx.fillStyle = "#fff6c8";
      ctx.fill();
    }
  }
  if (c.shield) {
    ctx.save();
    if (lowered) {
      ctx.translate(20, -8);
      ctx.rotate(1.2);
    } else ctx.translate(44, -40);
    circ(ctx, 0, 0, 24);
    fill(ctx, "#b37b45", 0, 0, 24, 24, 2.6);
    circ(ctx, 0, 0, 24);
    ctx.lineWidth = 5;
    ctx.strokeStyle = linear(ctx, "shieldrim", 0, -24, 0, 24, [
      [0, "#ffffff"],
      [0.5, "#a7b3c6"],
      [1, "#6d7a90"],
    ]);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      dot(ctx, Math.cos(a) * 19, Math.sin(a) * 19, 1.8, "#e6edf7");
    }
    star(ctx, 0, 0, 10, "#ffcf33", 0, "#a36a00");
    gloss(ctx, -8, -9, 7, 3.5, 0.45);
    ctx.restore();
  }
  if (p.soaked) dizzyStars(ctx, p.now, -72, 24);
  wetDrops(ctx, p, -70, 26);
}
def("turtle-pirate", (ctx, e, p) => turtle(ctx, e, p, { shell: "#a0703f", rim: "#6f4a26", skin: "#8bd17c", pirate: true }));
def("shield-turtle", (ctx, e, p) => turtle(ctx, e, p, { shell: "#3fae6a", rim: "#24704a", skin: "#a8dc8c", shield: true }));

/* ================================================================
 * 숨은 친구: 선글라스 불가사리 · 무지개 해마
 * ============================================================== */
def("sunny-starfish", (ctx, e, p) => {
  ctx.save();
  ctx.translate(0, -30);
  ctx.rotate(Math.sin(p.t * 1.5) * 0.15);
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? 15 : 36;
    const a = (i / 10) * TAU - Math.PI / 2;
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  smooth(ctx, pts, true, 0.3);
  fill(ctx, "#ff9a3c", -4, -6, 32, 32, 3);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    for (let k = 1; k <= 2; k++) dot(ctx, Math.cos(a) * 9 * k + 1, Math.sin(a) * 9 * k + 1, 2.2, "#ffd39b");
  }
  gloss(ctx, -8, -10, 9, 5, 0.5);
  if (!p.soaked) {
    for (const s of [-1, 1]) {
      rrect(ctx, s * 9 - 8, -10, 16, 11, 5);
      ctx.fillStyle = linear(ctx, "shades", 0, -10, 0, 1, [
        [0, "#3a3f6a"],
        [1, "#10142a"],
      ]);
      ctx.fill();
      stroke(ctx, "#05070f", 1.6);
      gloss(ctx, s * 9 - 3, -7, 3.4, 1.6, 0.85, 0);
    }
    ctx.beginPath();
    ctx.moveTo(-1, -6);
    ctx.lineTo(1, -6);
    stroke(ctx, "#05070f", 2);
  } else {
    eye(ctx, -9, -5, 6, p);
    eye(ctx, 9, -5, 6, p);
  }
  mouth(ctx, 0, 8, 7, p, "grin");
  ctx.restore();
});

def("rainbow-seahorse", (ctx, e, p) => {
  const g = linear(ctx, "rainbowhorse", 0, -92, 0, 4, [
    [0, "#ff6b8b"],
    [0.2, "#ffad4d"],
    [0.4, "#ffe066"],
    [0.6, "#6fe0a0"],
    [0.8, "#56c2ff"],
    [1, "#9b7bff"],
  ]);
  // 등지느러미
  ctx.save();
  ctx.translate(-12, -46);
  ctx.rotate(Math.sin(p.t * 12) * 0.2);
  fin(ctx, [0, 0, -14, -6, -16, 6, -12, 14, 0, 10], "#ffffff", 3);
  ctx.restore();
  smooth(ctx, [4, -86, 22, -84, 24, -70, 36, -66, 36, -58, 20, -58, 22, -42, 10, -30, 2, -18, 8, -6, 2, 4, -8, 0, -6, -10, -16, -24, -14, -44, -6, -64], true, 0.5);
  ctx.fillStyle = g;
  ctx.fill();
  stroke(ctx, "#6a3f9a", 2.8);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(-12 + i * 1.6, -62 + i * 8);
    ctx.lineTo(-4 + i * 2, -60 + i * 8);
    stroke(ctx, "rgba(255,255,255,0.5)", 1.6);
  }
  gloss(ctx, -4, -70, 5, 12, 0.6, 0.3);
  eye(ctx, 14, -72, 6, p, { iris: "#4a2a7a", look: 0.4 });
  blush(ctx, 20, -64, 4);
  for (let i = 0; i < 3; i++) sparkle(ctx, Math.cos(p.now * 2 + i * 2) * 32, -50 + Math.sin(p.now * 2 + i * 2) * 34, 6, 0.5 + 0.5 * Math.sin(p.now * 5 + i));
});

export { fish, whale, turtle };
