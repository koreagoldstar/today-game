/*
 * 🌊 바다 물총 대작전 — 소품 · 보스 부품 · 날아오는 것 · 아이템 방울 (이모지 없이 직접 그림)
 */
import {
  TAU, INK, mix, lighten, darken, alpha, lineOf, lit, vlit, linear, radial,
  ell, circ, rrect, smooth, fill, flat, stroke, gloss, bounce, dot, shadow,
  eye, brow, mouth, blush, star, sparkle, dizzyStars, wetDrops, drop, limb,
} from "./kit.js?v=2";
import { ENEMY_ART } from "./enemies.js?v=2";

const def = (id, fn) => (ENEMY_ART[id] = fn);

/* ---------------- 보너스 소품 ---------------- */
def("coconut", (ctx, e, p) => {
  circ(ctx, 0, -24, 23);
  fill(ctx, "#8d5a3b", 0, -24, 23, 23, 3);
  ctx.save();
  circ(ctx, 0, -24, 22);
  ctx.clip();
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.moveTo(-24 + i * 6, -48);
    ctx.lineTo(-30 + i * 6, 0);
    stroke(ctx, alpha("#5e3a22", 0.4), 1.4);
  }
  ctx.restore();
  for (const [x, y] of [
    [-7, -30],
    [7, -30],
    [0, -20],
  ]) {
    ell(ctx, x, y, 3.2, 2.8);
    ctx.fillStyle = "#3e2414";
    ctx.fill();
  }
  gloss(ctx, -9, -36, 7, 4, 0.4);
  smooth(ctx, [0, -46, 14, -60, 32, -56, 18, -48], true, 0.5);
  fill(ctx, "#3fae6a", 16, -52, 12, 5, 2);
});

def("treasure-chest", (ctx, e, p) => {
  const open = e.hp < e.maxHp || p.soaked;
  rrect(ctx, -32, -36, 64, 34, 6);
  fill(ctx, "#a8652f", 0, -20, 32, 17, 3);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-32, -28 + i * 9);
    ctx.lineTo(32, -28 + i * 9);
    stroke(ctx, alpha("#5d3518", 0.45), 1.4);
  }
  if (open) {
    ell(ctx, 0, -38, 26, 9);
    ctx.fillStyle = radial(ctx, "chestglow", 0, -40, 2, 0, -40, 28, [
      [0, "rgba(255,248,180,1)"],
      [1, "rgba(255,210,80,0.3)"],
    ]);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ell(ctx, -14 + i * 9, -40 - (i % 2) * 3, 6, 3);
      flat(ctx, "#ffd23f", 1.4, "#a36a00");
    }
    for (let i = 0; i < 3; i++) sparkle(ctx, -18 + i * 18, -54 - (i % 2) * 8, 6, 0.6 + 0.4 * Math.sin(p.now * 6 + i));
  }
  ctx.save();
  ctx.translate(-32, -36);
  ctx.rotate(open ? -0.55 : 0);
  smooth(ctx, [0, 0, 6, -18, 32, -26, 58, -18, 64, 0], true, 0.45);
  fill(ctx, "#c47a3a", 32, -12, 32, 14, 3);
  rrect(ctx, 28, -26, 8, 26, 2);
  flat(ctx, "#ffcf33", 1.4, "#8a5a00");
  ctx.restore();
  for (const x of [-32, 28]) {
    rrect(ctx, x, -36, 4, 34, 1);
    flat(ctx, "#ffcf33", 1, "#8a5a00");
  }
  rrect(ctx, -7, -28, 14, 14, 3);
  fill(ctx, "#ffd23f", 0, -21, 7, 7, 1.8);
  dot(ctx, 0, -22, 2, "#5d3518");
  gloss(ctx, -18, -30, 8, 3, 0.35, 0);
});

/* ---------------- 보스 부품 ---------------- */
function tentacle(ctx, e, p, col, cup, s = 1, glow) {
  const slap = e.mem && e.mem.slap > 0 ? e.mem.slap : 0;
  if (e.mem && e.mem.slap > 0) e.mem.slap -= 1 / 60;
  const wig = Math.sin(p.t * 3 + e.uid) * 14 + slap * 34;
  const pts = [0, 8, -20 * s + wig * 0.4, -52 * s, 26 * s + wig, -92 * s, 6 * s + wig * 1.2, -132 * s];
  if (glow) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    stroke(ctx, `rgba(${glow},0.35)`, 40 * s);
    ctx.restore();
  }
  limb(ctx, pts, 24 * s, col, { line: 5 });
  const bez = (a, b, c, d, t) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    const x = bez(pts[0], pts[2], pts[4], pts[6], t);
    const y = bez(pts[1], pts[3], pts[5], pts[7], t);
    ell(ctx, x + 8 * s, y, 4.6 * s * (1 - t * 0.4), 3.6 * s * (1 - t * 0.4));
    flat(ctx, cup, 1.4, lineOf(cup));
    dot(ctx, x + 8 * s, y, 1.4 * s, alpha(darken(cup, 0.3), 0.8));
  }
  ctx.beginPath();
  ctx.arc(pts[6] - 7 * s, pts[7] + 5 * s, 9 * s, -0.5, Math.PI * 1.4);
  stroke(ctx, col, 9 * s);
  if (glow) {
    for (let i = 0; i < 3; i++) {
      const t = (p.now * 1.2 + i / 3) % 1;
      const x = bez(pts[0], pts[2], pts[4], pts[6], t);
      const y = bez(pts[1], pts[3], pts[5], pts[7], t);
      sparkle(ctx, x, y, 7 * s, 0.9, glow);
    }
  }
  if (p.soaked) dizzyStars(ctx, p.now, -134 * s, 16);
}
def("tentacle", (ctx, e, p) => tentacle(ctx, e, p, "#9b5fe0", "#ffc2ec", 1));
def("king-tentacle", (ctx, e, p) => tentacle(ctx, e, p, "#2c7a86", "#a8fff0", 1.15, "120,255,230"));
def("jelly-tentacle", (ctx, e, p) => tentacle(ctx, e, p, "#c78cff", "#fff3a8", 1.05, "255,240,140"));

def("cannon", (ctx, e, p) => {
  const fire = e.mem && e.mem.slap > 0;
  ell(ctx, 0, -10, 28, 10);
  fill(ctx, "#8d5a35", 0, -10, 28, 10, 2.6);
  for (const s of [-1, 1]) {
    circ(ctx, s * 18, -10, 7);
    fill(ctx, "#6d4426", s * 18, -10, 7, 7, 2);
    dot(ctx, s * 18, -10, 2, "#ffcf33");
  }
  circ(ctx, 0, -30, 21 + (fire ? 3 : 0));
  fill(ctx, "#3c4766", 0, -30, 22, 22, 3);
  circ(ctx, 0, -30, 21);
  stroke(ctx, "#ffcf33", 4);
  circ(ctx, 0, -30, 13);
  ctx.fillStyle = radial(ctx, "cannonhole", 0, -30, 2, 0, -30, 13, [
    [0, "#05070f"],
    [1, "#1c2236"],
  ]);
  ctx.fill();
  if (fire || Math.sin(p.t * 3) > 0.55) {
    circ(ctx, 0, -30, 9);
    fill(ctx, "#ff5d5d", 0, -30, 9, 9, 2);
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.arc(0, -30, 8, -0.4, 0.8);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  gloss(ctx, -8, -40, 6, 3, 0.5);
  eye(ctx, -9, -54, 4.8, p, { noBlink: false });
  eye(ctx, 9, -54, 4.8, p, { noBlink: false });
  brow(ctx, -9, -61, 4, 2, 2);
  brow(ctx, 9, -61, 4, -2, 2);
});

/* ---------------- 보너스 과녁 ---------------- */
function balloon(ctx, p, color, gold) {
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.bezierCurveTo(6, -2, -6, 8, 2, 26);
  stroke(ctx, "rgba(40,60,90,0.8)", 1.6);
  smooth(ctx, [0, -14, -20, -26, -24, -48, -12, -66, 0, -70, 12, -66, 24, -48, 20, -26], true, 0.5);
  fill(ctx, color, -4, -44, 24, 28, 3);
  ctx.beginPath();
  ctx.moveTo(-5, -12);
  ctx.lineTo(5, -12);
  ctx.lineTo(0, -17);
  ctx.closePath();
  flat(ctx, color, 2, lineOf(color));
  gloss(ctx, -9, -54, 6, 11, 0.7, 0.3);
  dot(ctx, 8, -30, 2.4, "rgba(255,255,255,0.6)");
  eye(ctx, -7, -42, 4, p, { noBlink: true, look: 0 });
  eye(ctx, 7, -42, 4, p, { noBlink: true, look: 0 });
  mouth(ctx, 0, -33, 4.5, p, "smile");
  blush(ctx, -12, -36, 3.6);
  blush(ctx, 12, -36, 3.6);
  if (gold) for (let i = 0; i < 3; i++) sparkle(ctx, Math.cos(p.now * 2 + i * 2) * 30, -42 + Math.sin(p.now * 2 + i * 2) * 30, 6, 0.6 + 0.4 * Math.sin(p.now * 6 + i));
}
const BALLOON_COLORS = ["#ff6b8b", "#56c2ff", "#ffd23f", "#6fe0a0", "#b388ff", "#ff9f43"];
def("balloon-target", (ctx, e, p) => balloon(ctx, p, BALLOON_COLORS[e.uid % BALLOON_COLORS.length]));
def("balloon-gold", (ctx, e, p) => balloon(ctx, p, "#ffc928", true));

function buoy(ctx, p, gold) {
  ell(ctx, 0, -6, 26, 8);
  fill(ctx, gold ? "#ffcf33" : "#f4f8ff", 0, -6, 26, 8, 2.6);
  rrect(ctx, -4, -28, 8, 22, 2);
  fill(ctx, "#8d6e63", 0, -17, 4, 11, 2);
  const rings = gold ? ["#ffcf33", "#fff3b0", "#ffb000", "#fff3b0"] : ["#ef4444", "#ffffff", "#ef4444", "#ffffff"];
  rings.forEach((c, i) => {
    circ(ctx, 0, -50, 24 - i * 6);
    if (i === 0) fill(ctx, c, 0, -50, 24, 24, 3);
    else flat(ctx, c, 0);
  });
  dot(ctx, 0, -50, 3, gold ? "#a36a00" : "#ef4444");
  gloss(ctx, -9, -60, 7, 4, 0.5);
  if (gold) for (let i = 0; i < 3; i++) sparkle(ctx, Math.cos(p.now * 2 + i * 2) * 32, -50 + Math.sin(p.now * 2 + i * 2) * 28, 6, 0.6 + 0.4 * Math.sin(p.now * 6 + i));
}
def("splash-target", (ctx, e, p) => buoy(ctx, p, false));
def("splash-target-gold", (ctx, e, p) => buoy(ctx, p, true));

/* ================================================================
 * 날아오는 것 (그림 중심 0,0 · 반지름 ≈ 18)
 * ============================================================== */
export function drawShot(ctx, s, now) {
  const k = s.kind;
  ctx.save();
  if (k === "beachball" || k === "seed" || k === "cannonball") ctx.rotate(s.rot);
  switch (k) {
    case "balloon": {
      const wob = 1 + Math.sin(now * 14 + s.age * 3) * 0.08;
      ctx.scale(wob, 2 - wob);
      smooth(ctx, [0, -18, 14, -10, 15, 6, 0, 16, -15, 6, -14, -10], true, 0.5);
      fill(ctx, "#ff6fae", 0, -2, 15, 17, 2.8);
      ctx.beginPath();
      ctx.moveTo(-4, 16);
      ctx.lineTo(4, 16);
      ctx.lineTo(0, 12);
      ctx.closePath();
      flat(ctx, "#ff6fae", 1.6);
      ctx.save();
      smooth(ctx, [0, -18, 14, -10, 15, 6, 0, 16, -15, 6, -14, -10], true, 0.5);
      ctx.clip();
      ctx.fillStyle = "rgba(120,200,255,0.35)";
      ctx.fillRect(-16, 2 + Math.sin(now * 8) * 2, 32, 16);
      ctx.restore();
      gloss(ctx, -5, -8, 4, 7, 0.75, 0.3);
      break;
    }
    case "bubble":
      circ(ctx, 0, 0, 18);
      ctx.fillStyle = radial(ctx, "bubbleshot", -5, -6, 2, 0, 0, 18, [
        [0, "rgba(255,255,255,0.5)"],
        [0.7, "rgba(190,240,255,0.25)"],
        [1, "rgba(160,220,255,0.55)"],
      ]);
      ctx.fill();
      stroke(ctx, "rgba(120,200,255,0.95)", 2.6);
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0.2, 1.5);
      stroke(ctx, "rgba(255,160,240,0.85)", 2.2);
      gloss(ctx, -6, -7, 5, 3, 0.95);
      break;
    case "ink":
      smooth(ctx, [0, -16, 13, -8, 15, 6, 4, 15, -10, 13, -15, 2, -11, -10], true, 0.5);
      fill(ctx, "#5b3a8c", 0, 0, 15, 15, 2.6);
      gloss(ctx, -5, -6, 5, 3, 0.45);
      eye(ctx, -5, 1, 3.4, { t: now, now }, { noBlink: true, look: 0 });
      eye(ctx, 5, 1, 3.4, { t: now, now }, { noBlink: true, look: 0 });
      brow(ctx, -5, -4, 3, 1.5, 1.6, "#1a0f2a");
      brow(ctx, 5, -4, 3, -1.5, 1.6, "#1a0f2a");
      break;
    case "wave":
      smooth(ctx, [-30, 8, -24, -10, -6, -22, 12, -20, 24, -8, 20, 2, 10, -6, 4, 2, 14, 8, 30, 8], true, 0.45);
      fill(ctx, "#3fb4f0", 0, -4, 28, 14, 2.8);
      ctx.beginPath();
      ctx.moveTo(-20, -6);
      ctx.quadraticCurveTo(-8, -20, 10, -17);
      stroke(ctx, "#ffffff", 4.4);
      for (let i = 0; i < 4; i++) dot(ctx, -24 + i * 14, 8, 4 + (i % 2), "#ffffff");
      break;
    case "spark":
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      shadow(ctx, 0, 0, 26, 26, 0.7, "255,240,120");
      ctx.restore();
      star(ctx, 0, 0, 16, "#fff27a", now * 6, "#c99a00");
      dot(ctx, 0, 0, 5, "#ffffff");
      break;
    case "pebble":
    case "snowball":
      circ(ctx, 0, 0, 15);
      fill(ctx, k === "snowball" ? "#f4fbff" : "#ffb36b", 0, 0, 15, 15, 2.6);
      gloss(ctx, -5, -6, 5, 3, 0.8);
      if (k === "snowball") for (let i = 0; i < 4; i++) dot(ctx, Math.cos(i * 1.7) * 8, Math.sin(i * 1.7) * 8, 1.8, "#cfe8f5");
      break;
    case "beachball":
      circ(ctx, 0, 0, 20);
      fill(ctx, "#ffffff", 0, 0, 20, 20, 2.8);
      ["#ff4d4d", "#3fa7f5", "#ffd23f"].forEach((c, i) => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 18.6, (i / 3) * TAU, (i / 3) * TAU + 1.05);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.fill();
      });
      dot(ctx, 0, 0, 4, "#ffffff");
      gloss(ctx, -7, -8, 6, 3, 0.6);
      break;
    case "cannonball":
      circ(ctx, 0, 0, 17);
      fill(ctx, "#3a4560", 0, 0, 17, 17, 2.8);
      gloss(ctx, -6, -6, 6, 3, 0.55);
      ctx.beginPath();
      ctx.moveTo(10, -10);
      ctx.quadraticCurveTo(16, -18, 20, -16);
      stroke(ctx, "#a8742c", 2.4);
      sparkle(ctx, 21, -17, 5, 0.6 + 0.4 * Math.sin(now * 20), "255,220,120");
      break;
    case "spray":
      circ(ctx, 0, 0, 17);
      fill(ctx, "#4fc3ff", 0, 0, 17, 17, 2.6);
      circ(ctx, -4, -5, 8);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fill();
      for (let i = 0; i < 5; i++) dot(ctx, Math.cos(now * 6 + i * 1.3) * 17, Math.sin(now * 6 + i * 1.3) * 17, 2.8, "#e6f8ff");
      break;
    case "seed":
      ell(ctx, 0, 0, 10, 13);
      fill(ctx, "#b8763b", 0, 0, 10, 13, 2.4);
      ctx.beginPath();
      ctx.moveTo(-4, -6);
      ctx.lineTo(4, -6);
      stroke(ctx, "#7a4a22", 2);
      gloss(ctx, -3, -5, 3, 2, 0.5);
      break;
    default:
      circ(ctx, 0, 0, 14);
      fill(ctx, "#7fd6ff", 0, 0, 14, 14, 2.4);
  }
  ctx.restore();
}

/* ================================================================
 * 아이템 방울 — 유리 방울 안에 그린 아이콘 (이모지 없음)
 * ============================================================== */
function itemIcon(ctx, effect, r, now) {
  switch (effect) {
    case "bomb": {
      // 물폭탄: 파란 물방울 폭탄 + 심지
      circ(ctx, 0, r * 0.12, r * 0.52);
      fill(ctx, "#2f7fd8", 0, r * 0.12, r * 0.52, r * 0.52, 2.4);
      rrect(ctx, -r * 0.16, -r * 0.5, r * 0.32, r * 0.18, 3);
      flat(ctx, "#56627a", 1.6);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.5);
      ctx.quadraticCurveTo(r * 0.2, -r * 0.75, r * 0.38, -r * 0.62);
      stroke(ctx, "#a8742c", 2.6);
      sparkle(ctx, r * 0.4, -r * 0.62, r * 0.18, 0.7 + 0.3 * Math.sin(now * 20), "255,230,120");
      drop(ctx, -r * 0.14, r * 0.1, r * 0.16, "#bfeeff");
      gloss(ctx, -r * 0.2, -r * 0.08, r * 0.14, r * 0.08, 0.7);
      break;
    }
    case "thunder":
      ctx.beginPath();
      ctx.moveTo(r * 0.12, -r * 0.62);
      ctx.lineTo(-r * 0.32, r * 0.08);
      ctx.lineTo(-r * 0.02, r * 0.08);
      ctx.lineTo(-r * 0.16, r * 0.62);
      ctx.lineTo(r * 0.34, -r * 0.1);
      ctx.lineTo(r * 0.04, -r * 0.1);
      ctx.closePath();
      fill(ctx, "#ffd23f", 0, 0, r * 0.4, r * 0.6, 2.6);
      break;
    case "ice":
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i / 6) * TAU + now * 0.5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r * 0.6);
        ctx.moveTo(0, -r * 0.36);
        ctx.lineTo(-r * 0.14, -r * 0.5);
        ctx.moveTo(0, -r * 0.36);
        ctx.lineTo(r * 0.14, -r * 0.5);
        stroke(ctx, "#3fa7f5", 3.6);
        ctx.restore();
      }
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i / 6) * TAU + now * 0.5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r * 0.6);
        stroke(ctx, "#ffffff", 1.6);
        ctx.restore();
      }
      break;
    case "rainbow":
      ["#ff5d6c", "#ffad4d", "#ffe066", "#6fe0a0", "#56c2ff", "#9b7bff"].forEach((c, i) => {
        ctx.beginPath();
        ctx.arc(0, r * 0.28, r * (0.62 - i * 0.08), Math.PI, 0);
        stroke(ctx, c, r * 0.085, "butt");
      });
      for (const s of [-1, 1]) {
        circ(ctx, s * r * 0.5, r * 0.3, r * 0.16);
        flat(ctx, "#ffffff", 1.4, "#c2d8ee");
      }
      break;
    case "heart": {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.48, 0, TAU);
      stroke(ctx, "#ffffff", r * 0.24);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.48, i * (Math.PI / 2) + 0.35, i * (Math.PI / 2) + 1.05);
        stroke(ctx, "#ff4d4d", r * 0.24, "butt");
      }
      break;
    }
    default:
      star(ctx, 0, 0, r * 0.5, "#ffe066", 0);
  }
}

export function drawItem(ctx, it, now) {
  const r = 30 * it.s + 8;
  const pulse = 1 + Math.sin(now * 5 + it.age) * 0.05;
  const d = it.d || {};
  ctx.save();
  ctx.translate(it.sx, it.sy);
  ctx.scale(pulse, pulse);
  // 빛 번짐
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.45 + 0.25 * Math.sin(now * 6);
  shadow(ctx, 0, 0, r * 1.6, r * 1.6, 0.6, d.glow || "200,240,255");
  ctx.restore();
  // 유리 방울
  circ(ctx, 0, 0, r);
  ctx.fillStyle = radial(ctx, `itbub${Math.round(r)}`, -r * 0.3, -r * 0.35, r * 0.05, 0, 0, r, [
    [0, "rgba(255,255,255,0.95)"],
    [0.55, "rgba(215,244,255,0.55)"],
    [1, "rgba(120,200,255,0.8)"],
  ]);
  ctx.fill();
  stroke(ctx, "rgba(255,255,255,0.95)", 3);
  // 무지개빛 테두리
  ctx.beginPath();
  ctx.arc(0, 0, r - 3, -2.4 + now, -1.2 + now);
  stroke(ctx, "rgba(255,170,240,0.8)", 2.4);
  itemIcon(ctx, d.effect, r, now);
  gloss(ctx, -r * 0.4, -r * 0.48, r * 0.26, r * 0.12, 0.95);
  ctx.restore();
  // 이름표 리본
  if (!d.name) return;
  ctx.save();
  ctx.font = '15px "Bagel Fat One", "Jua", sans-serif';
  const w = ctx.measureText(d.name || "").width + 18;
  const y = it.sy + r + 16;
  rrect(ctx, it.sx - w / 2, y - 11, w, 22, 11);
  ctx.fillStyle = "rgba(10,47,87,0.88)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#e2b456";
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(d.name || "", it.sx, y + 1);
  ctx.restore();
}

export { itemIcon };
