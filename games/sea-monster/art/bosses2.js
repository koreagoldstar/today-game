/*
 * 바다괴물 탐험대 — 보스 그림 2
 *  거대 해파리 (giantJelly) · 화산 심해괴수 (volcanoBeast) · 심해의 크라켄 (kraken)
 * 원점 = 몸 가운데. p = 보스 상태 (boss.js 가 채운다)
 */
import { INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss, blush } from "../../ocean-blaster/art/kit.js?v=3";
import { ART } from "./registry.js?v=1";
import { BOSS_ART } from "./bosses.js?v=1";

const TAU = Math.PI * 2;
const q8 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 8) / 8;

function glowAt(ctx, x, y, r, color, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, 0.7 * a));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** 큰 보스 눈 (흰자 · 눈동자 · 반짝 · 화난 눈썹 · 어질 소용돌이) */
export function bossEye(ctx, x, y, r, p, o = {}) {
  const look = p.look || { x: 0, y: 0 };
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * (o.tall || 1.1), 0, 0, TAU);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (p.stun) {
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = i * 0.55 + (p.t || 0) * 8;
      const rr = (i / 26) * r * 0.8;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    stroke(ctx, INK, 2.4);
    return;
  }
  const px = x + look.x * r * 0.3;
  const py = y + look.y * r * 0.3 + r * 0.1;
  ctx.beginPath();
  ctx.arc(px, py, r * 0.55, 0, TAU);
  ctx.fillStyle = o.iris || "#3a1a5a";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px, py, r * 0.3, 0, TAU);
  ctx.fillStyle = o.pupil || "#0a0612";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px - r * 0.2, py - r * 0.24, r * 0.17, 0, TAU);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  if (o.angry) {
    ctx.beginPath();
    const s = o.side || 1;
    ctx.moveTo(x - r * 1.1 * s, y - r * 1.25);
    ctx.lineTo(x + r * 0.9 * s, y - r * 0.75);
    ctx.lineCap = "round";
    ctx.lineWidth = r * 0.32;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

/* ================================================================
 * 거대 해파리 — 계곡을 덮는 투명한 갓 · 네 잎 무늬 · 프릴 팔 · 전기 촉수
 * ============================================================== */
const GJ = { bell: "#c99bff", rim: "#ffd0f2", organ: "#ff8ad8", arm: "#f2b8ff", tent: "#e8d8ff" };
function giantJelly(ctx, p) {
  const t = p.t || 0;
  const wind = p.wind || 0;
  const rage = p.rage ? 1 : 0;
  const pulse = Math.sin(t * (2 + rage)) * 0.5 + 0.5 + (p.pulse || 0) * 0.6;
  const w = 150 * (1 + pulse * 0.05);
  const h = 118 * (1 - pulse * 0.06);
  const bellC = rage ? mix(GJ.bell, "#ff6ab8", 0.45) : GJ.bell;
  const elec = wind > 0.15 || p.charge;
  glowAt(ctx, 0, -20, 260 + wind * 80, elec ? "#fff36a" : rage ? "#ff7ad0" : "#c58bff", 0.75);
  // 가는 촉수 (뒤)
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const u = (i + 0.5) / 12;
    const x0 = -w * 0.85 + u * w * 1.7;
    const len = 200 + (i % 4) * 34 + (p.charge ? 60 : 0);
    ctx.beginPath();
    ctx.moveTo(x0, 18);
    for (let k = 1; k <= 8; k++) {
      const v = k / 8;
      const sw = Math.sin(t * 2.2 + i * 0.9 + v * 4) * 14 * v * (p.charge ? 0.4 : 1);
      ctx.lineTo(x0 + sw - (p.charge ? 0 : Math.sin(t * 0.7) * 10 * v), 18 + v * len);
    }
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = alpha(elec && i % 2 ? "#fff36a" : GJ.tent, 0.8);
    ctx.stroke();
  }
  // 프릴 팔 (가운데 넷)
  for (let i = 0; i < 4; i++) {
    const x0 = -54 + i * 36;
    ctx.beginPath();
    ctx.moveTo(x0 - 12, 14);
    const L = 150 + (i % 2) * 30;
    for (let k = 1; k <= 7; k++) {
      const v = k / 7;
      ctx.lineTo(x0 + Math.sin(t * 2 + i + v * 5) * 18 * v - 12 + v * 4, 14 + v * L);
    }
    for (let k = 7; k >= 0; k--) {
      const v = k / 7;
      ctx.lineTo(x0 + Math.sin(t * 2 + i + v * 5) * 18 * v + 12 - v * 4 + Math.sin(v * 22 + t * 4) * 5, 14 + v * L);
    }
    ctx.closePath();
    ctx.fillStyle = alpha(rage ? mix(GJ.arm, "#ff8ac8", 0.4) : GJ.arm, 0.75);
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = alpha("#ffffff", 0.6);
    ctx.stroke();
  }
  // 갓
  const bell = () => {
    ctx.beginPath();
    ctx.moveTo(-w, 18);
    ctx.bezierCurveTo(-w * 1.06, -h * 1.25, w * 1.06, -h * 1.25, w, 18);
    for (let i = 0; i <= 10; i++) {
      const x = w - (i / 10) * w * 2;
      ctx.quadraticCurveTo(x + w / 10, 34 + Math.sin(t * 4 + i) * 3, x, 18);
    }
    ctx.closePath();
  };
  bell();
  ctx.fillStyle = linear(ctx, `gjb${q8(rage * 0.5)}`, 0, -h, 0, 30, [
    [0, alpha(lighten(bellC, 0.45), 0.94)],
    [0.7, alpha(bellC, 0.82)],
    [1, alpha(darken(bellC, 0.2), 0.8)],
  ]);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = alpha(GJ.rim, 0.95);
  ctx.stroke();
  // 네 잎 무늬 (안쪽 빛나는 기관)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.785;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 34, -62 + Math.sin(a) * 22, 22, 13, a, 0, TAU);
    ctx.fillStyle = alpha(elec ? "#fff36a" : GJ.organ, 0.55 + pulse * 0.2);
    ctx.fill();
  }
  // 무늬 줄
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha("#ffffff", 0.35);
  for (let i = 0; i < 7; i++) {
    const x = -w * 0.8 + (i / 6) * w * 1.6;
    ctx.beginPath();
    ctx.moveTo(x * 0.35, -h * 0.95);
    ctx.quadraticCurveTo(x * 0.9, -h * 0.4, x, 14);
    ctx.stroke();
  }
  gloss(ctx, -w * 0.45, -h * 0.75, w * 0.3, h * 0.14, 0.8, -0.35);
  // 얼굴
  const angry = wind > 0.2 || rage;
  bossEye(ctx, -40, -16, 22, p, { angry, side: 1, iris: rage ? "#a0204a" : "#5a2a8a" });
  bossEye(ctx, 40, -16, 22, p, { angry, side: -1, iris: rage ? "#a0204a" : "#5a2a8a" });
  const mo = Math.max(p.roar || 0, wind * 0.6, p.charge ? 1 : 0);
  ctx.beginPath();
  if (mo > 0.1) {
    ctx.ellipse(0, 20, 22, 6 + mo * 14, 0, 0, TAU);
    ctx.fillStyle = "#4a0a3a";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    for (const x of [-10, 4]) {
      ctx.beginPath();
      ctx.moveTo(x, 20 - 6 - mo * 10);
      ctx.lineTo(x + 3, 20 - mo * 4);
      ctx.lineTo(x + 6, 20 - 6 - mo * 10);
      ctx.fill();
    }
  } else {
    ctx.moveTo(-14, 18);
    ctx.quadraticCurveTo(0, 26, 14, 18);
    stroke(ctx, INK, 3);
  }
  if (!rage) {
    blush(ctx, -70, 6, 10);
    blush(ctx, 70, 6, 10);
  }
  // 왕관 같은 돌기 (위)
  for (let i = -2; i <= 2; i++) {
    const x = i * 30;
    const y = -h * 0.94 + Math.abs(i) * 8;
    ctx.beginPath();
    ctx.arc(x, y, 7 - Math.abs(i), 0, TAU);
    ctx.fillStyle = elec ? "#fff36a" : "#ffe0fa";
    ctx.fill();
  }
  if (elec) {
    ctx.strokeStyle = "#fffbe0";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * TAU;
      const r0 = 100;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, -30 + Math.sin(a) * r0 * 0.7);
      for (let k = 1; k <= 3; k++) ctx.lineTo(Math.cos(a) * (r0 + k * 26) + (Math.random() - 0.5) * 20, -30 + Math.sin(a) * (r0 + k * 26) * 0.7 + (Math.random() - 0.5) * 20);
      ctx.stroke();
    }
  }
  if (p.hit) {
    ctx.save();
    bell();
    ctx.fillStyle = `rgba(255,255,255,${0.55 * p.hit})`;
    ctx.fill();
    ctx.restore();
  }
}
BOSS_ART.giantJelly = giantJelly;
ART.giantJelly = (ctx, p) => {
  ctx.save();
  ctx.translate(0, -20);
  ctx.scale(0.32 * (p.s || 1), 0.32 * (p.s || 1));
  giantJelly(ctx, p);
  ctx.restore();
};

/* ================================================================
 * 화산 심해괴수 — 현무암 갑옷 · 용암 금 · 등에 작은 화산 셋 · 커다란 턱
 * ============================================================== */
const VB = { rock: "#4a3e40", rock2: "#5e5050", dark: "#241c1e", belly: "#7a5a4a", eye: "#ffb03a" };
function lavaLines(ctx, lines, heat, w) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [wd, col, a] of [
    [w * 2.8, "#ff4a10", 0.35],
    [w, mix("#ff8a2a", "#fff0a0", q8(heat)), 1],
  ]) {
    ctx.beginPath();
    for (const ln of lines) {
      ctx.moveTo(ln[0], ln[1]);
      for (let i = 2; i < ln.length; i += 2) ctx.lineTo(ln[i], ln[i + 1]);
    }
    ctx.lineWidth = wd;
    ctx.strokeStyle = alpha(col, a);
    ctx.stroke();
  }
}
function volcanoBeast(ctx, p) {
  const t = p.t || 0;
  const wind = p.wind || 0;
  const rage = p.rage ? 1 : 0;
  const heat = Math.min(1, 0.55 + rage * 0.35 + wind * 0.3 + Math.sin(t * 3) * 0.08);
  const sw = Math.sin(t * (p.charge ? 12 : 3.5)) * (0.12 + (p.charge ? 0.1 : 0));
  const jaw = Math.max(p.roar || 0, wind * 0.75, p.charge ? 0.9 : 0, p.spit || 0);
  glowAt(ctx, 0, 0, 300, rage ? "#ff5a1a" : "#ff7a2a", 0.4 + wind * 0.3);
  // 꼬리 (끝에 바위 곤봉)
  ctx.save();
  ctx.translate(-150, 10);
  ctx.rotate(sw);
  ctx.beginPath();
  ctx.moveTo(20, -36);
  ctx.quadraticCurveTo(-60, -30, -110, -8);
  ctx.quadraticCurveTo(-60, 30, 20, 36);
  ctx.closePath();
  fill(ctx, VB.rock, -40, -6, 70, 30, 4);
  ell(ctx, -116, -4, 30, 26);
  fill(ctx, VB.rock2, -120, -12, 30, 26, 4);
  for (const [x, y] of [
    [-130, -24],
    [-104, -26],
    [-136, 6],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 4);
    ctx.lineTo(x, y - 12);
    ctx.lineTo(x + 6, y + 4);
    ctx.closePath();
    flat(ctx, VB.dark, 2, "#120c0e");
  }
  lavaLines(ctx, [[-90, -2, -60, 4, -30, -6, 10, 2]], heat, 3);
  ctx.restore();
  // 뒷지느러미 팔 (뒤)
  ctx.save();
  ctx.translate(-20, 60);
  ctx.rotate(0.5 + Math.sin(t * 3) * 0.15);
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  ctx.quadraticCurveTo(30, 40, 10, 70);
  ctx.quadraticCurveTo(-20, 40, -30, 0);
  ctx.closePath();
  fill(ctx, darken(VB.rock, 0.2), 0, 30, 24, 36, 3.4);
  ctx.restore();
  // 몸통
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-160, -10);
    ctx.bezierCurveTo(-150, -110, 80, -130, 150, -50);
    ctx.quadraticCurveTo(176, -10, 160, 40);
    ctx.bezierCurveTo(110, 96, -100, 100, -160, 30);
    ctx.closePath();
  };
  body();
  ctx.fillStyle = linear(ctx, "vbb", 0, -120, 0, 100, [
    [0, "#6a5a5a"],
    [0.55, VB.rock],
    [1, "#2a2022"],
  ]);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#140e10";
  ctx.stroke();
  // 배 (밝은 판)
  ctx.save();
  body();
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(10, 84, 150, 50, 0, 0, TAU);
  ctx.fillStyle = VB.belly;
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(-110 + i * 44, 44);
    ctx.quadraticCurveTo(-90 + i * 44, 52, -70 + i * 44, 44);
    ctx.strokeStyle = alpha("#3a2a24", 0.6);
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // 갑옷 판 (육각) + 용암 이음새
  const plates = [
    [-110, -30, 30],
    [-60, -60, 34],
    [0, -74, 36],
    [60, -60, 32],
    [-80, 10, 28],
    [-24, -12, 32],
    [36, -8, 30],
    [100, -24, 26],
  ];
  for (const [x, y, r] of plates) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.52;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.82);
    }
    ctx.closePath();
    ctx.fillStyle = VB.rock2;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = VB.dark;
    ctx.stroke();
    ell(ctx, x - r * 0.25, y - r * 0.3, r * 0.45, r * 0.2);
    ctx.fillStyle = alpha("#ffffff", 0.09);
    ctx.fill();
  }
  lavaLines(ctx, [
    [-150, 0, -110, -2, -80, -30, -40, -36, 0, -40, 40, -34, 80, -40, 120, -40],
    [-80, -30, -94, -60],
    [-40, -36, -30, -80],
    [40, -34, 30, -90],
    [-110, -2, -100, 30, -60, 34, -20, 22, 20, 30, 60, 22, 100, 6],
  ], heat, 3.4);
  ctx.restore();
  // 등의 작은 화산 셋 (연기 · 분노 땐 불꽃)
  for (const [x, y, h] of [
    [-70, -88, 40],
    [-10, -104, 50],
    [50, -92, 40],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x - 26, y + 14);
    ctx.lineTo(x - 9, y - h + 6);
    ctx.lineTo(x + 9, y - h + 6);
    ctx.lineTo(x + 26, y + 14);
    ctx.closePath();
    ctx.fillStyle = VB.dark;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#0e0809";
    ctx.stroke();
    ell(ctx, x, y - h + 6, 9, 4);
    ctx.fillStyle = mix("#ff7a2a", "#fff0a0", q8(heat));
    ctx.fill();
    lavaLines(ctx, [[x - 4, y - h + 8, x - 8, y - h + 24, x - 4, y - h + 34]], heat, 2.4);
    if (rage || wind > 0.3) {
      for (let i = 0; i < 3; i++) {
        const k = (t * 1.6 + i / 3 + x * 0.01) % 1;
        circ(ctx, x + Math.sin(k * 8 + i) * 6, y - h - k * 50, 5 * (1 - k) + 1);
        ctx.fillStyle = alpha(i % 2 ? "#ffd06a" : "#ff6a2a", 1 - k);
        ctx.fill();
      }
    }
  }
  // 머리 (몸 앞쪽) + 턱
  ctx.save();
  ctx.translate(140, -6);
  // 아래턱 (벌어진다)
  ctx.save();
  ctx.rotate(jaw * 0.45);
  ctx.beginPath();
  ctx.moveTo(-30, 20);
  ctx.quadraticCurveTo(40, 54, 96, 30);
  ctx.quadraticCurveTo(100, 20, 90, 14);
  ctx.quadraticCurveTo(30, 26, -20, 6);
  ctx.closePath();
  fill(ctx, VB.rock, 30, 26, 60, 22, 4);
  // 아래 이빨
  ctx.fillStyle = "#f4ead8";
  for (let i = 0; i < 4; i++) {
    const x = 18 + i * 18;
    ctx.beginPath();
    ctx.moveTo(x, 22 - i);
    ctx.lineTo(x + 6, 8 - i);
    ctx.lineTo(x + 12, 22 - i);
    ctx.fill();
  }
  ctx.restore();
  // 입 안 (불빛)
  if (jaw > 0.05) {
    ctx.beginPath();
    ctx.moveTo(-20, 8);
    ctx.quadraticCurveTo(40, 22 + jaw * 30, 92, 16 + jaw * 30);
    ctx.lineTo(92, 12);
    ctx.quadraticCurveTo(40, 14, -20, 2);
    ctx.closePath();
    ctx.fillStyle = "#3a0a04";
    ctx.fill();
    glowAt(ctx, 50, 16 + jaw * 14, 70, "#ff8a2a", jaw);
  }
  // 위턱 · 머리
  ctx.beginPath();
  ctx.moveTo(-40, -60);
  ctx.bezierCurveTo(20, -78, 90, -46, 110, -4);
  ctx.quadraticCurveTo(112, 10, 96, 14);
  ctx.quadraticCurveTo(40, 18, -30, 6);
  ctx.closePath();
  fill(ctx, VB.rock2, 30, -30, 70, 40, 4);
  // 위 이빨
  ctx.fillStyle = "#f4ead8";
  for (let i = 0; i < 5; i++) {
    const x = 6 + i * 18;
    ctx.beginPath();
    ctx.moveTo(x, 10 + i * 0.6);
    ctx.lineTo(x + 6, 24 + i * 0.6);
    ctx.lineTo(x + 12, 11 + i * 0.6);
    ctx.fill();
  }
  // 콧구멍 · 뿔
  circ(ctx, 96, -10, 4);
  ctx.fillStyle = "#140e10";
  ctx.fill();
  for (const [x, y, a, L] of [
    [-10, -64, -0.9, 46],
    [20, -66, -0.6, 36],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 6);
    ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 - 6, y + Math.sin(a) * L * 0.6, x + Math.cos(a) * L, y + Math.sin(a) * L);
    ctx.quadraticCurveTo(x + 4, y - 6, x + 10, y + 6);
    ctx.closePath();
    fill(ctx, "#d8c8b0", x, y - 14, 12, 20, 3);
  }
  // 눈 (용암빛 · 세로 동공)
  const ex = 44;
  const ey = -34;
  ctx.beginPath();
  ctx.ellipse(ex, ey, 20, 16, -0.1, 0, TAU);
  ctx.fillStyle = "#1a0a06";
  ctx.fill();
  glowAt(ctx, ex, ey, 40, VB.eye, 0.7 + wind * 0.3);
  if (p.stun) {
    ctx.beginPath();
    for (let i = 0; i < 22; i++) {
      const a = i * 0.6 + t * 8;
      const rr = (i / 22) * 13;
      ctx.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
    }
    stroke(ctx, "#ffd06a", 2.6);
  } else {
    ctx.beginPath();
    ctx.ellipse(ex, ey, 15, 12, -0.1, 0, TAU);
    ctx.fillStyle = mix(VB.eye, "#fff0a0", q8(heat * 0.6));
    ctx.fill();
    const lx = (p.look ? p.look.x : 0) * 4;
    ctx.beginPath();
    ctx.ellipse(ex + lx, ey, 3.5, 10, 0, 0, TAU);
    ctx.fillStyle = "#1a0a06";
    ctx.fill();
    circ(ctx, ex - 5, ey - 5, 3);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  // 눈썹 바위 (화나면 내려온다)
  ctx.beginPath();
  ctx.moveTo(ex - 26, ey - 18 + (wind > 0.2 || rage ? 6 : 0));
  ctx.lineTo(ex + 24, ey - 14 + (wind > 0.2 || rage ? 12 : 0));
  ctx.lineCap = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = VB.dark;
  ctx.stroke();
  lavaLines(ctx, [[-30, -20, 0, -14, 20, 0, 60, 4]], heat, 2.6);
  ctx.restore();
  // 앞발 (앞)
  ctx.save();
  ctx.translate(60, 60);
  ctx.rotate(-0.3 + Math.sin(t * 3 + 1) * 0.18 - (p.charge ? 0.5 : 0));
  ctx.beginPath();
  ctx.moveTo(-14, -6);
  ctx.quadraticCurveTo(30, 30, 20, 70);
  ctx.quadraticCurveTo(-4, 50, -26, 4);
  ctx.closePath();
  fill(ctx, VB.rock2, 0, 30, 22, 34, 3.4);
  for (const x of [8, 18, 26]) {
    ctx.beginPath();
    ctx.moveTo(x - 4, 64 - (x - 8) * 0.6);
    ctx.lineTo(x + 2, 78 - (x - 8) * 0.6);
    ctx.lineTo(x + 6, 62 - (x - 8) * 0.6);
    ctx.fillStyle = "#e8dcc8";
    ctx.fill();
  }
  ctx.restore();
  if (p.hit) {
    ctx.save();
    body();
    ctx.fillStyle = `rgba(255,255,255,${0.45 * p.hit})`;
    ctx.fill();
    ctx.restore();
  }
}
BOSS_ART.volcanoBeast = volcanoBeast;
ART.volcanoBeast = (ctx, p) => {
  ctx.save();
  ctx.translate(-8, 4);
  ctx.scale(0.27 * (p.s || 1), 0.27 * (p.s || 1));
  volcanoBeast(ctx, p);
  ctx.restore();
};

/* ================================================================
 * 심해의 크라켄 — 둥근 외투 머리 · 가로 동공 큰 눈 · 빨판 촉수 여덟
 * ============================================================== */
const KR = { skin: "#b03a52", dark: "#6a1a32", spot: "#e8708a", sucker: "#ffd8c8", eye: "#ffd23f" };
/**
 * 촉수 하나: (x0,y0) 에서 ang 방향으로 len, 굵기 w → 끝으로 가늘어짐.
 * bend: 휘는 정도 · ph: 물결 위상 · curl: 끝 말림
 */
export function tentacle(ctx, x0, y0, ang, len, w, t, ph, o = {}) {
  const n = 14;
  const pts = [];
  let a = ang;
  let x = x0;
  let y = y0;
  const seg = len / n;
  for (let i = 0; i <= n; i++) {
    pts.push([x, y, a]);
    const u = i / n;
    a += (Math.sin(t * (o.speed || 2.2) + ph + u * 3) * (o.wave == null ? 0.12 : o.wave) + (o.bend || 0) / n) + (u > 0.7 ? (o.curl || 0) * 0.35 : 0);
    x += Math.cos(a) * seg;
    y += Math.sin(a) * seg;
  }
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const [px, py, pa] = pts[i];
    const ww = w * (1 - (i / n) * 0.85) * 0.5;
    left.push([px + Math.cos(pa - Math.PI / 2) * ww, py + Math.sin(pa - Math.PI / 2) * ww]);
    right.push([px + Math.cos(pa + Math.PI / 2) * ww, py + Math.sin(pa + Math.PI / 2) * ww]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const [px, py] of left) ctx.lineTo(px, py);
  for (let i = n; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fillStyle = o.color || KR.skin;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = o.lw || 3.5;
  ctx.strokeStyle = o.line || KR.dark;
  ctx.stroke();
  // 빨판 (오른쪽 면)
  for (let i = 1; i < n; i += 1) {
    const k = i / n;
    const [px, py, pa] = pts[i];
    const ww = w * (1 - k * 0.85) * 0.5;
    const sx = px + Math.cos(pa + Math.PI / 2) * ww * 0.55;
    const sy = py + Math.sin(pa + Math.PI / 2) * ww * 0.55;
    const r = Math.max(1.5, ww * 0.38);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, TAU);
    ctx.fillStyle = o.sucker || KR.sucker;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = o.line || KR.dark;
    ctx.stroke();
  }
  return pts[n];
}
function kraken(ctx, p) {
  const t = p.t || 0;
  const wind = p.wind || 0;
  const rage = p.rage ? 1 : 0;
  const skin = rage ? "#c02a40" : KR.skin;
  glowAt(ctx, 0, 0, 280, rage ? "#ff3a5a" : "#c84a8a", 0.3 + wind * 0.3);
  // 촉수 여덟 (뒤 넷 → 앞 넷)
  const sw = p.charge ? 0.4 : 1;
  const base = [
    [-70, 70, 2.3, 260, 46, 0.0],
    [-30, 86, 2.0, 280, 50, 1.1],
    [30, 86, 1.15, 280, 50, 2.2],
    [70, 70, 0.85, 260, 46, 3.3],
  ];
  for (const [x, y, a, L, w, ph] of base) {
    const ang = p.charge ? Math.PI + (a - Math.PI / 2) * 0.25 : a - wind * 0.5 * Math.sign(Math.PI / 2 - a);
    tentacle(ctx, x, y - 10, ang, L * (p.charge ? 1.1 : 1), w, t, ph + 5, { color: darken(skin, 0.2), wave: 0.14 * sw, curl: 1.2, bend: 0.6 * Math.sign(Math.PI / 2 - a) });
  }
  const front = [
    [-60, 90, 1.95, 300, 56, 0.4],
    [-20, 100, 1.7, 320, 60, 1.6],
    [20, 100, 1.45, 320, 60, 2.8],
    [60, 90, 1.2, 300, 56, 4.0],
  ];
  for (const [x, y, a, L, w, ph] of front) {
    const ang = p.charge ? Math.PI + (a - Math.PI / 2) * 0.3 : a - wind * 0.6 * Math.sign(Math.PI / 2 - a + 0.001);
    tentacle(ctx, x, y - 10, ang, L * (p.charge ? 1.15 : 1), w, t, ph, { color: skin, wave: 0.12 * sw, curl: -1.3 * Math.sign(Math.PI / 2 - a + 0.001), bend: -0.4 * Math.sign(Math.PI / 2 - a + 0.001) });
  }
  // 외투 머리
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(-112, 60);
    ctx.bezierCurveTo(-176, -40, -110, -196, 4, -190);
    ctx.bezierCurveTo(120, -186, 176, -40, 112, 60);
    ctx.quadraticCurveTo(60, 104, 0, 104);
    ctx.quadraticCurveTo(-60, 104, -104, 60);
    ctx.closePath();
  };
  head();
  ctx.fillStyle = linear(ctx, `krh${rage}`, -80, -180, 60, 100, [
    [0, lighten(skin, 0.25)],
    [0.55, skin],
    [1, darken(skin, 0.35)],
  ]);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = KR.dark;
  ctx.stroke();
  // 점무늬 · 주름
  for (const [x, y, r] of [
    [-50, -110, 14],
    [20, -140, 10],
    [60, -90, 12],
    [-80, -40, 9],
    [-20, -70, 7],
    [80, -30, 8],
  ]) {
    ell(ctx, x, y, r, r * 0.8);
    ctx.fillStyle = alpha(KR.spot, 0.6);
    ctx.fill();
  }
  if (rage) {
    // 분노: 빛나는 핏줄
    ctx.strokeStyle = alpha("#ffb03a", 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-60, -150);
    ctx.quadraticCurveTo(-40, -110, -60, -70);
    ctx.moveTo(50, -160);
    ctx.quadraticCurveTo(70, -120, 50, -80);
    ctx.stroke();
  }
  gloss(ctx, -60, -140, 34, 14, 0.5, -0.5);
  // 따개비 (오래된 괴수)
  for (const [x, y, r] of [
    [70, -130, 7],
    [84, -116, 5],
    [62, -114, 4],
    [-96, -70, 6],
    [-104, -54, 4],
  ]) {
    circ(ctx, x, y, r);
    ctx.fillStyle = "#e8e0d0";
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#6a5a50";
    ctx.stroke();
    circ(ctx, x, y, r * 0.4);
    ctx.fillStyle = "#4a3a34";
    ctx.fill();
  }
  // 흉터
  ctx.beginPath();
  ctx.moveTo(-30, -160);
  ctx.lineTo(-10, -120);
  ctx.moveTo(-34, -146);
  ctx.lineTo(-16, -150);
  ctx.moveTo(-24, -134);
  ctx.lineTo(-6, -138);
  stroke(ctx, darken(skin, 0.45), 3);
  // 눈 둘 (가로 동공) · 눈두덩
  for (const sd of [-1, 1]) {
    const ex = sd * 52;
    const ey = -10;
    ell(ctx, ex, ey, 38, 34);
    ctx.fillStyle = darken(skin, 0.25);
    ctx.fill();
    ell(ctx, ex, ey + 2, 29, 25);
    ctx.fillStyle = wind > 0.3 ? "#ff6a4a" : KR.eye;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = KR.dark;
    ctx.stroke();
    if (wind > 0.3) glowAt(ctx, ex, ey, 60, "#ff4a3a", wind);
    if (p.stun) {
      ctx.beginPath();
      for (let i = 0; i < 22; i++) {
        const a = i * 0.6 + t * 8 * sd;
        const rr = (i / 22) * 18;
        ctx.lineTo(ex + Math.cos(a) * rr, ey + 2 + Math.sin(a) * rr);
      }
      stroke(ctx, KR.dark, 3);
    } else {
      const lx = (p.look ? p.look.x : 0) * 6;
      const ly = (p.look ? p.look.y : 0) * 4;
      rrect(ctx, ex + lx - 10, ey + ly - 1, 20, 7, 3.5);
      ctx.fillStyle = "#1a0a12";
      ctx.fill();
      ell(ctx, ex + lx, ey + ly + 2.5, 15, 13);
      ctx.lineWidth = 2;
      ctx.strokeStyle = alpha("#a0400a", 0.6);
      ctx.stroke();
      circ(ctx, ex - 11, ey - 9, 5.5);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    // 눈두덩 (화나면 찌푸림)
    ctx.beginPath();
    const fr = wind > 0.2 || rage ? 12 : 0;
    ctx.moveTo(ex - 32, ey - 24 + (sd > 0 ? fr : -fr) * 0.4);
    ctx.quadraticCurveTo(ex, ey - 40 + fr * 0.5, ex + 32, ey - 24 + (sd > 0 ? -fr : fr) * 0.4);
    ctx.lineCap = "round";
    ctx.lineWidth = 9;
    ctx.strokeStyle = darken(skin, 0.4);
    ctx.stroke();
  }
  // 입 (깔때기 · 포효)
  const mo = Math.max(p.roar || 0, p.inkP || 0);
  ell(ctx, 0, 58, 16 + mo * 10, 9 + mo * 12);
  ctx.fillStyle = darken(skin, 0.4);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = KR.dark;
  ctx.stroke();
  if (mo > 0.2) {
    ell(ctx, 0, 60, 10 + mo * 8, 5 + mo * 9);
    ctx.fillStyle = "#1a0612";
    ctx.fill();
  }
  if (p.hit) {
    head();
    ctx.fillStyle = `rgba(255,255,255,${0.45 * p.hit})`;
    ctx.fill();
  }
}
BOSS_ART.kraken = kraken;
ART.kraken = (ctx, p) => {
  ctx.save();
  ctx.translate(0, 18);
  ctx.scale(0.2 * (p.s || 1), 0.2 * (p.s || 1));
  kraken(ctx, p);
  ctx.restore();
};

/* ================================================================
 * 고대 바다뱀 — 비취빛 용 머리 · 금빛 뿔 · 수염 · 몸통 마디 (몸통은 boss.js 가 머리 자취를 따라 그린다)
 * ============================================================== */
const SP = { skin: "#2fa88a", dark: "#14594a", belly: "#e8e0a8", gold: "#ffd23f", fin: "#5ad0b0" };
function seaSerpent(ctx, p) {
  const t = p.t || 0;
  const wind = p.wind || 0;
  const rage = p.rage ? 1 : 0;
  const skin = rage ? "#2a8a9a" : SP.skin;
  const jaw = Math.max(p.roar || 0, wind * 0.7, p.beam ? 0.9 : 0, p.charge ? 0.6 : 0);
  glowAt(ctx, 0, 0, 200, rage ? "#5ff0ff" : "#5ff0b0", 0.25 + wind * 0.3);
  // 목 (몸통과 이어짐)
  ell(ctx, -56, 6, 40, 34);
  fill(ctx, skin, -60, 0, 40, 34, 4);
  // 아래턱
  ctx.save();
  ctx.translate(-10, 14);
  ctx.rotate(jaw * 0.42);
  ctx.beginPath();
  ctx.moveTo(-20, -2);
  ctx.quadraticCurveTo(40, 26, 104, 8);
  ctx.quadraticCurveTo(100, -2, 90, -4);
  ctx.quadraticCurveTo(40, 4, -20, -12);
  ctx.closePath();
  fill(ctx, SP.belly, 40, 6, 60, 14, 3.4);
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 5; i++) {
    const x = 22 + i * 15;
    ctx.beginPath();
    ctx.moveTo(x, 2 - i * 0.5);
    ctx.lineTo(x + 4, -10 - i * 0.5);
    ctx.lineTo(x + 8, 1 - i * 0.5);
    ctx.fill();
  }
  ctx.restore();
  if (jaw > 0.1) {
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.quadraticCurveTo(40, 18 + jaw * 30, 100, 10 + jaw * 36);
    ctx.lineTo(100, 4);
    ctx.quadraticCurveTo(40, 6, -10, 0);
    ctx.closePath();
    ctx.fillStyle = "#3a0a1a";
    ctx.fill();
    if (p.beam || wind > 0.3) glowAt(ctx, 70, 14 + jaw * 14, 60, "#9ff8ff", Math.max(wind, p.beam ? 1 : 0));
  }
  // 위턱 · 머리
  ctx.beginPath();
  ctx.moveTo(-40, -36);
  ctx.bezierCurveTo(10, -60, 80, -40, 116, -6);
  ctx.quadraticCurveTo(118, 6, 104, 8);
  ctx.quadraticCurveTo(40, 12, -30, 14);
  ctx.closePath();
  fill(ctx, skin, 30, -20, 70, 34, 4);
  // 비늘 무늬
  for (let i = 0; i < 5; i++) {
    const x = -20 + i * 18;
    ctx.beginPath();
    ctx.arc(x, -24 + i * 2, 8, Math.PI * 0.1, Math.PI * 0.9);
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha(SP.dark, 0.6);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 6; i++) {
    const x = 20 + i * 14;
    ctx.beginPath();
    ctx.moveTo(x, 9);
    ctx.lineTo(x + 4, 20);
    ctx.lineTo(x + 8, 9);
    ctx.fill();
  }
  // 콧구멍 · 수염
  circ(ctx, 104, -6, 3.5);
  ctx.fillStyle = SP.dark;
  ctx.fill();
  for (const [dy, L, ph] of [
    [-4, 90, 0],
    [2, 70, 1.4],
  ]) {
    ctx.beginPath();
    ctx.moveTo(100, dy);
    for (let i = 1; i <= 8; i++) {
      const u = i / 8;
      ctx.lineTo(100 - u * L * 0.3 + u * 10, dy + u * L * 0.5 + Math.sin(t * 3 + ph + u * 4) * 10 * u);
    }
    ctx.lineCap = "round";
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = SP.gold;
    ctx.stroke();
  }
  // 뿔 둘
  for (const [x, a, L] of [
    [-6, -2.3, 60],
    [16, -2.0, 50],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x - 8, -46);
    ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.6, -46 + Math.sin(a) * L * 0.5 - 6, x + Math.cos(a) * L, -46 + Math.sin(a) * L);
    ctx.quadraticCurveTo(x + 2, -52, x + 8, -44);
    ctx.closePath();
    fill(ctx, SP.gold, x - 10, -60, 14, 18, 3);
  }
  // 볏 지느러미 (뒤로)
  ctx.beginPath();
  ctx.moveTo(-30, -34);
  for (let i = 0; i < 4; i++) {
    ctx.lineTo(-40 - i * 14, -60 + Math.sin(t * 4 + i) * 4);
    ctx.lineTo(-46 - i * 14, -36);
  }
  ctx.closePath();
  flat(ctx, SP.fin, 2.6, SP.dark);
  // 눈
  const ex = 40;
  const ey = -24;
  ell(ctx, ex, ey, 14, 11);
  ctx.fillStyle = "#fff6d0";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = SP.dark;
  ctx.stroke();
  if (p.stun) {
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = i * 0.7 + t * 8;
      const rr = (i / 18) * 9;
      ctx.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
    }
    stroke(ctx, SP.dark, 2.4);
  } else {
    const lx = (p.look ? p.look.x : 0) * 3;
    ell(ctx, ex + 2 + lx, ey, 3.5, 9);
    ctx.fillStyle = wind > 0.3 ? "#c02a2a" : "#1a2a2a";
    ctx.fill();
    circ(ctx, ex - 4, ey - 4, 2.6);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(ex - 16, ey - 12 + (wind > 0.2 || rage ? 4 : 0));
  ctx.lineTo(ex + 14, ey - 16 + (wind > 0.2 || rage ? 10 : 0));
  ctx.lineCap = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = SP.dark;
  ctx.stroke();
  // 이마 보석
  ctx.beginPath();
  ctx.moveTo(14, -48);
  ctx.lineTo(22, -40);
  ctx.lineTo(14, -32);
  ctx.lineTo(6, -40);
  ctx.closePath();
  ctx.fillStyle = rage ? "#ff5a7a" : "#5ff0ff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = SP.dark;
  ctx.stroke();
  if (p.hit) {
    ell(ctx, 30, -10, 80, 40);
    ctx.fillStyle = `rgba(255,255,255,${0.45 * p.hit})`;
    ctx.fill();
  }
}
/** 몸통 마디 하나 (원점 = 마디 가운데, ang = 진행 방향) */
export function serpentSeg(ctx, r, ang, k, t, rage, last) {
  const skin = rage ? "#2a8a9a" : SP.skin;
  ctx.save();
  ctx.rotate(ang);
  if (last) {
    // 꼬리 지느러미
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 2.6, -r * 1.6 + Math.sin(t * 5) * 6);
    ctx.quadraticCurveTo(-r * 1.6, 0, -r * 2.6, r * 1.6 + Math.sin(t * 5) * 6);
    ctx.closePath();
    flat(ctx, SP.fin, 3, SP.dark);
  }
  // 등지느러미 가시
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.8);
  ctx.lineTo(-r * 0.1, -r * 1.6);
  ctx.lineTo(r * 0.4, -r * 0.8);
  ctx.closePath();
  flat(ctx, SP.fin, 2, SP.dark);
  ell(ctx, 0, 0, r * 1.15, r);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = SP.dark;
  ctx.stroke();
  // 배 (아래 밝은 띠)
  ctx.beginPath();
  ctx.ellipse(0, r * 0.45, r * 0.95, r * 0.45, 0, 0, Math.PI);
  ctx.fillStyle = SP.belly;
  ctx.fill();
  // 비늘 줄
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.1, r * 0.55, Math.PI * 1.1, Math.PI * 1.9);
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha(SP.dark, 0.5);
  ctx.stroke();
  circ(ctx, r * 0.2, -r * 0.35, r * 0.18);
  ctx.fillStyle = alpha(SP.gold, 0.8);
  ctx.fill();
  ctx.restore();
}
BOSS_ART.seaSerpent = seaSerpent;
ART.seaSerpent = (ctx, p) => {
  ctx.save();
  ctx.translate(-14, 6);
  ctx.scale(0.36 * (p.s || 1), 0.36 * (p.s || 1));
  for (let i = 5; i >= 1; i--) {
    ctx.save();
    ctx.translate(-60 - i * 36, Math.sin(i * 1.1) * 18);
    serpentSeg(ctx, 30 - i * 2, 0, i / 6, p.t || 0, false, i === 5);
    ctx.restore();
  }
  seaSerpent(ctx, p);
  ctx.restore();
};

/* ================================================================
 * 산호초 문어왕 — 산호 왕관 · 보라 망토(문어 막) · 촉수 콧수염 · 주황 몸
 * ============================================================== */
const OK = { skin: "#ff8a4a", dark: "#8a3a1a", sucker: "#ffe0c8", cape: "#7a3ab8", trim: "#ffd23f", crownA: "#ff6a9a", crownB: "#ffd23f" };
function octoKing(ctx, p) {
  const t = p.t || 0;
  const wind = p.wind || 0;
  const rage = p.rage ? 1 : 0;
  const skin = rage ? "#ff5a3a" : OK.skin;
  glowAt(ctx, 0, -20, 240, rage ? "#ff5a7a" : "#ffb06a", 0.3 + wind * 0.3);
  // 망토 (문어 막) — 촉수 뒤로 넓게
  ctx.beginPath();
  ctx.moveTo(-110, 40);
  for (let i = 0; i <= 8; i++) {
    const x = -150 + i * 37.5;
    const y = 150 + Math.sin(t * 2 + i) * 10 + (i % 2) * 18;
    ctx.quadraticCurveTo(x - 18, y - 30, x, y);
  }
  ctx.lineTo(110, 40);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `okc${rage}`, 0, 40, 0, 170, [
    [0, rage ? "#9a2a8a" : OK.cape],
    [1, darken(rage ? "#9a2a8a" : OK.cape, 0.4)],
  ]);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = OK.trim;
  ctx.stroke();
  // 촉수 여섯 (짧고 말림)
  const base = [
    [-80, 70, 2.4, 0],
    [-46, 90, 2.0, 1.2],
    [-14, 100, 1.7, 2.4],
    [14, 100, 1.45, 3.6],
    [46, 90, 1.15, 4.8],
    [80, 70, 0.75, 6.0],
  ];
  for (const [x, y, a, ph] of base) {
    const sd = Math.sign(Math.PI / 2 - a + 0.001);
    tentacle(ctx, x, y - 10, a - wind * 0.5 * sd, 170 + (p.charge ? 30 : 0), 46, t, ph, { color: skin, line: OK.dark, sucker: OK.sucker, wave: 0.14, curl: -1.6 * sd, bend: 0.3 * sd });
  }
  // 머리 (동글 큰 외투)
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(-110, 50);
    ctx.bezierCurveTo(-150, -60, -80, -150, 0, -150);
    ctx.bezierCurveTo(80, -150, 150, -60, 110, 50);
    ctx.quadraticCurveTo(60, 96, 0, 96);
    ctx.quadraticCurveTo(-60, 96, -110, 50);
    ctx.closePath();
  };
  head();
  ctx.fillStyle = linear(ctx, `okh${rage}`, -80, -150, 60, 96, [
    [0, lighten(skin, 0.3)],
    [0.55, skin],
    [1, darken(skin, 0.3)],
  ]);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = OK.dark;
  ctx.stroke();
  for (const [x, y, r] of [
    [-60, -80, 10],
    [50, -100, 8],
    [74, -40, 7],
    [-84, -20, 6],
  ]) {
    ell(ctx, x, y, r, r * 0.8);
    ctx.fillStyle = alpha("#ffd0a0", 0.6);
    ctx.fill();
  }
  gloss(ctx, -50, -110, 30, 12, 0.5, -0.5);
  // 산호 왕관
  ctx.save();
  ctx.translate(0, -146);
  rrect(ctx, -64, -10, 128, 22, 8);
  fill(ctx, OK.trim, 0, 0, 64, 12, 3.4);
  for (let i = 0; i < 5; i++) {
    const x = -48 + i * 24;
    const h = 40 + (i === 2 ? 26 : i % 2 ? 10 : 18);
    const col = i % 2 ? OK.crownB : OK.crownA;
    ctx.beginPath();
    ctx.moveTo(x - 6, -6);
    ctx.lineTo(x - 3, -h * 0.6);
    ctx.lineTo(x - 12, -h * 0.85);
    ctx.lineTo(x - 2, -h * 0.75);
    ctx.lineTo(x, -h);
    ctx.lineTo(x + 3, -h * 0.7);
    ctx.lineTo(x + 12, -h * 0.9);
    ctx.lineTo(x + 5, -h * 0.55);
    ctx.lineTo(x + 6, -6);
    ctx.closePath();
    flat(ctx, col, 2.6, darken(col, 0.45));
  }
  for (const x of [-40, 0, 40]) {
    circ(ctx, x, 1, 6);
    ctx.fillStyle = x ? "#ffffff" : "#5ff0ff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = OK.dark;
    ctx.stroke();
  }
  ctx.restore();
  // 눈 (크고 둥글게 · 무거운 눈썹)
  for (const sd of [-1, 1]) {
    bossEye(ctx, sd * 44, -30, 24, p, { angry: wind > 0.2 || rage, side: sd < 0 ? 1 : -1, iris: rage ? "#a01a3a" : "#3a1a6a" });
  }
  // 촉수 콧수염 (말린)
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sd * 8, 20);
    ctx.bezierCurveTo(sd * 40, 6, sd * 70, 30, sd * 60, 46 + Math.sin(t * 3) * 3);
    ctx.bezierCurveTo(sd * 54, 54, sd * 44, 44, sd * 52, 38);
    ctx.lineCap = "round";
    ctx.lineWidth = 12;
    ctx.strokeStyle = OK.dark;
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.strokeStyle = darken(skin, 0.15);
    ctx.stroke();
  }
  // 입
  const mo = Math.max(p.roar || 0, p.charge ? 0.8 : 0, wind * 0.5);
  if (mo > 0.15) {
    ell(ctx, 0, 40, 18 + mo * 8, 8 + mo * 14);
    ctx.fillStyle = "#3a0a12";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OK.dark;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-14, 38);
    ctx.quadraticCurveTo(0, 46, 14, 38);
    stroke(ctx, OK.dark, 3);
  }
  if (p.hit) {
    head();
    ctx.fillStyle = `rgba(255,255,255,${0.45 * p.hit})`;
    ctx.fill();
  }
}
BOSS_ART.octoKing = octoKing;
ART.octoKing = (ctx, p) => {
  ctx.save();
  ctx.translate(0, 8);
  ctx.scale(0.23 * (p.s || 1), 0.23 * (p.s || 1));
  octoKing(ctx, p);
  ctx.restore();
};
/** 문어왕이 만드는 '분신 산호' 무더기 (원점 = 바닥 가운데) */
export function kingMound(ctx, t, wob, crown) {
  ctx.save();
  ctx.rotate(Math.sin(t * 16) * 0.05 * wob);
  const cols = ["#ff6a9a", "#ffb347", "#b066ff", "#5fd3a8"];
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI;
    const x = Math.cos(a) * 60;
    const h = 70 + (i % 3) * 22;
    ctx.beginPath();
    ctx.moveTo(x - 12, 0);
    ctx.quadraticCurveTo(x - 16, -h * 0.6, x - 4, -h);
    ctx.quadraticCurveTo(x + 6, -h * 0.9, x + 2, -h * 0.6);
    ctx.quadraticCurveTo(x + 16, -h * 0.5, x + 12, 0);
    ctx.closePath();
    flat(ctx, cols[i % 4], 3, darken(cols[i % 4], 0.45));
  }
  ell(ctx, 0, -6, 70, 34);
  fill(ctx, "#ff8a6a", 0, -16, 70, 34, 3.4);
  for (const [x, y] of [
    [-30, -14],
    [10, -24],
    [36, -6],
  ]) {
    circ(ctx, x, y, 6);
    ctx.fillStyle = "#ffe0d0";
    ctx.fill();
  }
  if (crown > 0) {
    // 진짜: 왕관 끝이 반짝
    ctx.save();
    ctx.globalAlpha = crown;
    ctx.translate(0, -78);
    for (let i = 0; i < 3; i++) {
      const x = -16 + i * 16;
      ctx.beginPath();
      ctx.moveTo(x - 5, 8);
      ctx.lineTo(x, -10 - (i === 1 ? 8 : 0));
      ctx.lineTo(x + 5, 8);
      ctx.closePath();
      flat(ctx, "#ffd23f", 2, "#8a5a00");
    }
    glowAt(ctx, 0, -2, 40, "#ffd23f", 0.6);
    ctx.restore();
  }
  ctx.restore();
}

/* ================================================================
 * THE ABYSSAL — 깊은 바다의 고대 바다괴수 (정면) · 거대한 가운데 눈 · 작은 눈 넷 · 빛나는 뿔 왕관 · 발광 줄무늬 · 빛나는 이빨
 *  p.eye 0~1 눈 뜸 · p.jaw 입 · p.lines 발광(0~1) · p.tents 촉수(0~1) · p.silhouette (등장 연출: 검게)
 * ============================================================== */
const AB = { skin: "#1c1a3a", skin2: "#2c2860", ridge: "#3a3478", glow: "#5ff0ff", glow2: "#c58bff", iris: "#ffb03a", teeth: "#d8f8ff" };
function abyssal(ctx, p) {
  const t = p.t || 0;
  const rage = p.rage ? 1 : 0;
  const wind = p.wind || 0;
  const eye = p.eye == null ? 1 : p.eye;
  const lines = p.lines == null ? 1 : p.lines;
  const tents = p.tents == null ? 1 : p.tents;
  const sil = p.silhouette || 0;
  const glowC = rage ? "#ff5aa8" : AB.glow;
  if (!sil) glowAt(ctx, 0, 0, 420, rage ? "#a01a5a" : "#3a2a8a", 0.5);
  // 촉수 (뒤 · 옆으로 펼침)
  if (tents > 0.02) {
    const list = [
      [-220, 60, 2.7, 0],
      [-180, 110, 2.25, 1.3],
      [-120, 140, 1.9, 2.6],
      [120, 140, 1.25, 3.9],
      [180, 110, 0.9, 5.2],
      [220, 60, 0.45, 6.5],
    ];
    for (const [x, y, a, ph] of list) {
      const sd = Math.sign(Math.PI / 2 - a + 0.001);
      tentacle(ctx, x, y, a + Math.sin(t * 0.8 + ph) * 0.1, 360 * tents, 80, t * 0.7, ph, { color: sil ? "#05060e" : AB.skin2, line: sil ? "#05060e" : "#0c0a20", sucker: sil ? "#05060e" : alpha(glowC, 0.8), wave: 0.1, curl: -1.4 * sd, bend: 0.5 * sd, lw: 4 });
    }
  }
  // 머리 (거대한 돔)
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(-280, 60);
    ctx.bezierCurveTo(-300, -160, -170, -280, 0, -286);
    ctx.bezierCurveTo(170, -280, 300, -160, 280, 60);
    ctx.quadraticCurveTo(250, 150, 160, 180);
    ctx.lineTo(-160, 180);
    ctx.quadraticCurveTo(-250, 150, -280, 60);
    ctx.closePath();
  };
  // 뿔 왕관 (뒤에서 위로)
  for (let i = 0; i < 7; i++) {
    const u = (i - 3) / 3;
    const bx = u * 200;
    const by = -250 + Math.abs(u) * 70;
    const L = 130 - Math.abs(u) * 30;
    const a = -Math.PI / 2 + u * 0.7;
    ctx.beginPath();
    ctx.moveTo(bx - 22, by + 20);
    ctx.quadraticCurveTo(bx + Math.cos(a - 0.4) * L * 0.6, by + Math.sin(a - 0.4) * L * 0.6, bx + Math.cos(a) * L, by + Math.sin(a) * L);
    ctx.quadraticCurveTo(bx + Math.cos(a + 0.3) * L * 0.5, by + Math.sin(a + 0.3) * L * 0.5, bx + 22, by + 20);
    ctx.closePath();
    ctx.fillStyle = sil ? "#05060e" : AB.ridge;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = sil ? "#05060e" : "#0c0a20";
    ctx.stroke();
    if (!sil || lines > 0.3) {
      circ(ctx, bx + Math.cos(a) * L, by + Math.sin(a) * L, 7);
      ctx.fillStyle = glowC;
      ctx.fill();
      if (!sil) glowAt(ctx, bx + Math.cos(a) * L, by + Math.sin(a) * L, 30, glowC, 0.7);
    }
  }
  head();
  if (sil) {
    ctx.fillStyle = "#05060e";
    ctx.fill();
  } else {
    ctx.fillStyle = linear(ctx, `abh${rage}`, 0, -286, 0, 180, [
      [0, AB.ridge],
      [0.45, AB.skin2],
      [1, AB.skin],
    ]);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#0a0818";
    ctx.stroke();
    // 갑옷 주름
    ctx.save();
    head();
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(0, -60, 120 + i * 40, 110 + i * 30, 0, Math.PI * 1.15, Math.PI * 1.85);
      ctx.lineWidth = 4;
      ctx.strokeStyle = alpha("#000000", 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }
  // 발광 줄무늬 (점선 · 등장 연출에서 차례로 켜진다)
  if (lines > 0.02) {
    const paths = [
      [-250, 40, -200, -120, -90, -220],
      [250, 40, 200, -120, 90, -220],
      [-200, 120, -120, 40, -40, 110],
      [200, 120, 120, 40, 40, 110],
      [-140, -170, 0, -230, 140, -170],
    ];
    paths.forEach((q, pi) => {
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        if (k > lines * 1.2 - pi * 0.04) break;
        const x = (1 - k) * (1 - k) * q[0] + 2 * (1 - k) * k * q[2] + k * k * q[4];
        const y = (1 - k) * (1 - k) * q[1] + 2 * (1 - k) * k * q[3] + k * k * q[5];
        const tw = 0.6 + 0.4 * Math.sin(t * 3 + i + pi);
        circ(ctx, x, y, 5 + (i % 2) * 2);
        ctx.fillStyle = alpha(i % 3 ? glowC : AB.glow2, tw);
        ctx.fill();
      }
    });
  }
  if (!sil) {
    // 작은 눈 넷
    for (const [x, y, r, ph] of [
      [-150, -90, 20, 0],
      [150, -90, 20, 1.7],
      [-200, -10, 15, 3.1],
      [200, -10, 15, 4.4],
    ]) {
      const bl = Math.sin(t * 1.3 + ph) > 0.95 ? 0.1 : 1;
      ell(ctx, x, y, r, r * 0.8 * bl);
      ctx.fillStyle = rage ? "#ff5a7a" : "#ffe08a";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#0a0818";
      ctx.stroke();
      if (bl > 0.5) {
        ell(ctx, x + (p.look ? p.look.x * 4 : 0), y, r * 0.22, r * 0.6);
        ctx.fillStyle = "#14060c";
        ctx.fill();
      }
      glowAt(ctx, x, y, r * 2.2, rage ? "#ff3a6a" : "#ffd23f", 0.5);
    }
  }
  // 가운데 거대한 눈 (약점)
  const ER = 72;
  if (!sil || eye > 0.05) {
    ctx.save();
    ctx.translate(0, -40);
    // 눈두덩
    ell(ctx, 0, 0, ER + 22, ER * 0.8 + 18);
    ctx.fillStyle = sil ? "#05060e" : "#120f28";
    ctx.fill();
    const open = Math.max(0.02, eye);
    ctx.save();
    ell(ctx, 0, 0, ER, ER * 0.78 * open);
    ctx.clip();
    const ir = rage ? "#ff4a5a" : wind > 0.3 ? "#ff7a3a" : AB.iris;
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, ER);
    g.addColorStop(0, "#fff6c0");
    g.addColorStop(0.35, ir);
    g.addColorStop(1, darken(ir, 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(-ER, -ER, ER * 2, ER * 2);
    if (p.stun) {
      ctx.beginPath();
      for (let i = 0; i < 30; i++) {
        const a = i * 0.6 + t * 8;
        const rr = (i / 30) * ER * 0.8;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#1a0a0a";
      ctx.stroke();
    } else {
      const lx = (p.look ? p.look.x : 0) * 18;
      const ly = (p.look ? p.look.y : 0) * 10;
      ell(ctx, lx, ly, 12 + wind * 6, ER * 0.68);
      ctx.fillStyle = "#0a0408";
      ctx.fill();
      circ(ctx, lx - 26, ly - 24, 11);
      ctx.fillStyle = alpha("#ffffff", 0.9);
      ctx.fill();
    }
    ctx.restore();
    // 눈꺼풀 선
    ell(ctx, 0, 0, ER, ER * 0.78 * open);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#0a0818";
    ctx.stroke();
    if (!sil) glowAt(ctx, 0, 0, ER * 2.2, rage ? "#ff3a5a" : wind > 0.3 ? "#ff8a3a" : "#ffd23f", 0.3 + wind * 0.5);
    ctx.restore();
  }
  // 입 (빛나는 이빨)
  if (!sil) {
    const jaw = Math.max(p.jaw || 0, p.roar || 0, wind * 0.3);
    ctx.save();
    ctx.translate(0, 110);
    ctx.beginPath();
    ctx.moveTo(-150, 0);
    ctx.quadraticCurveTo(0, 30 + jaw * 80, 150, 0);
    ctx.quadraticCurveTo(0, 14, -150, 0);
    ctx.closePath();
    ctx.fillStyle = "#06040e";
    ctx.fill();
    if (jaw > 0.1) glowAt(ctx, 0, 20 + jaw * 30, 120, glowC, jaw * 0.6);
    ctx.fillStyle = AB.teeth;
    for (let i = 0; i < 9; i++) {
      const x = -128 + i * 32;
      const yy = 4 + Math.sin((i / 8) * Math.PI) * 8;
      ctx.beginPath();
      ctx.moveTo(x - 9, yy);
      ctx.lineTo(x, yy + 22 + (i % 2) * 8);
      ctx.lineTo(x + 9, yy);
      ctx.fill();
      const by = 12 + jaw * 70 + Math.sin((i / 8) * Math.PI) * 12;
      ctx.beginPath();
      ctx.moveTo(x - 7, by + 10);
      ctx.lineTo(x + 2, by - 10 - (i % 2) * 6);
      ctx.lineTo(x + 9, by + 10);
      ctx.fill();
    }
    ctx.restore();
  }
  if (p.hit && !sil) {
    ctx.save();
    ctx.translate(0, -40);
    ell(ctx, 0, 0, ER + 10, ER * 0.85);
    ctx.fillStyle = `rgba(255,255,255,${0.55 * p.hit})`;
    ctx.fill();
    ctx.restore();
  }
}
BOSS_ART.abyssal = abyssal;
ART.abyssal = (ctx, p) => {
  ctx.save();
  ctx.translate(0, 10);
  ctx.scale(0.13 * (p.s || 1), 0.13 * (p.s || 1));
  abyssal(ctx, { ...p, eye: 1, lines: 1, tents: 1 });
  ctx.restore();
};
