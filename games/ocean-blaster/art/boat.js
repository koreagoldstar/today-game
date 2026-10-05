/*
 * 🌊 바다 물총 대작전 — 보트 6종 (뒤에서 내려다본 모습)
 * 좌표: (0,0) = 배 뒤(선미) 가운데 물높이, 앞(선수)은 -y
 * 움직이지 않는 부분은 한 번 그려 스프라이트로 보관하고, 깃발 · 물보라 · 항적만 매 프레임 그린다.
 */
import { TAU, INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, smooth, fill, flat, stroke, gloss, dot, shadow, star } from "./kit.js?v=2";

export const BOAT_STYLE = {
  "blue-shark": { hull: "#2f7fd8", belly: "#f2f8ff", rim: "#5fb0ff", deck: "#e9c995", plank: "#c99a5b", trim: "#ffffff", name: "BLUE SHARK", plate: "#1d3a6b", letter: "#ffd75e" },
  "pirate-boat": { hull: "#8a5530", belly: "#5e3519", rim: "#b27a43", deck: "#d8b27a", plank: "#a87a45", trim: "#ffcf4d", name: "PIRATE BOAT", plate: "#2b1a10", letter: "#ffcf4d" },
  "speed-boat": { hull: "#f4f7fc", belly: "#e2463b", rim: "#ffffff", deck: "#41506b", plank: "#334058", trim: "#e2463b", name: "SPEED BOAT", plate: "#e2463b", letter: "#ffffff" },
  submarine: { hull: "#ffc928", belly: "#f29f05", rim: "#ffe27a", deck: "#ffd95e", plank: "#e8b52a", trim: "#3d7bfd", name: "SUBMARINE", plate: "#3d7bfd", letter: "#ffffff" },
  "ice-boat": { hull: "#9fdcff", belly: "#ffffff", rim: "#e6f8ff", deck: "#eaf7ff", plank: "#c4e3f5", trim: "#ffffff", name: "ICE BOAT", plate: "#2d6d9e", letter: "#e6f8ff" },
  "rainbow-boat": { hull: "#ff6b8b", belly: "#ffffff", rim: "#ffd1dc", deck: "#fff2d6", plank: "#f0d4a4", trim: "#ffffff", name: "RAINBOW BOAT", plate: "#7a3cff", letter: "#fff6b0" },
};

const BOW = -262;
const W2 = 172;

function hullOuter(ctx) {
  ctx.beginPath();
  ctx.moveTo(0, BOW);
  ctx.bezierCurveTo(70, BOW + 22, W2 - 4, -150, W2, -44);
  ctx.lineTo(W2 - 12, 26);
  ctx.quadraticCurveTo(0, 36, -(W2 - 12), 26);
  ctx.lineTo(-W2, -44);
  ctx.bezierCurveTo(-(W2 - 4), -150, -70, BOW + 22, 0, BOW);
  ctx.closePath();
}
function deckPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(0, BOW + 26);
  ctx.bezierCurveTo(58, BOW + 44, W2 - 26, -150, W2 - 24, -56);
  ctx.lineTo(-(W2 - 24), -56);
  ctx.bezierCurveTo(-(W2 - 26), -150, -58, BOW + 44, 0, BOW + 26);
  ctx.closePath();
}

/** 움직이지 않는 부분 (스프라이트로 캐시) */
export function drawBoatStatic(ctx, id) {
  const S = BOAT_STYLE[id] || BOAT_STYLE["blue-shark"];
  if (id === "submarine") return drawSub(ctx, S);
  // ---- 선체 바깥 ----
  hullOuter(ctx);
  ctx.fillStyle = linear(ctx, `hull${id}`, -W2, 0, W2, 0, [
    [0, darken(S.hull, 0.22)],
    [0.3, S.hull],
    [0.55, lighten(S.hull, 0.12)],
    [0.8, S.hull],
    [1, darken(S.hull, 0.25)],
  ]);
  ctx.fill();
  if (id === "rainbow-boat") {
    ctx.save();
    hullOuter(ctx);
    ctx.clip();
    ["#ff6b8b", "#ffad4d", "#ffe066", "#6fe0a0", "#56c2ff", "#9b7bff"].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(-W2, BOW + i * 50, W2 * 2, 50);
    });
    ctx.restore();
  }
  if (id === "pirate-boat") {
    ctx.save();
    hullOuter(ctx);
    ctx.clip();
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(-W2, -40 + i * 8 - 70);
      ctx.quadraticCurveTo(0, -30 + i * 8 - 70 + 40, W2, -40 + i * 8 - 70);
      stroke(ctx, alpha("#3d2210", 0.35), 1.6);
    }
    ctx.restore();
  }
  // 아래쪽 배 색 (상어 배 · 물높이 띠)
  ctx.save();
  hullOuter(ctx);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(-W2 - 10, -14);
  ctx.quadraticCurveTo(0, 6, W2 + 10, -14);
  ctx.lineTo(W2 + 10, 40);
  ctx.lineTo(-W2 - 10, 40);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `belly${id}`, 0, -14, 0, 36, [
    [0, lighten(S.belly, 0.1)],
    [1, darken(S.belly, 0.18)],
  ]);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-W2 - 10, -14);
  ctx.quadraticCurveTo(0, 6, W2 + 10, -14);
  stroke(ctx, alpha(darken(S.hull, 0.4), 0.6), 2.4);
  ctx.restore();
  hullOuter(ctx);
  stroke(ctx, lineOf(S.hull), 4);
  // 상어 장식: 아가미 · 눈 · 이빨 (선수 옆)
  if (id === "blue-shark") {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(s * (W2 - 6), -112 + i * 16);
        ctx.quadraticCurveTo(s * (W2 - 16), -104 + i * 16, s * (W2 - 9), -96 + i * 16);
        stroke(ctx, alpha("#123f78", 0.75), 2.6);
      }
      // 뱃머리 눈
      const ex = s * 52;
      const ey = BOW + 52;
      ell(ctx, ex, ey, 11, 8, s * 0.5);
      flat(ctx, "#ffffff", 2.2, "#123f78");
      circ(ctx, ex + s * 2, ey + 1, 4.6);
      ctx.fillStyle = "#101a33";
      ctx.fill();
      dot(ctx, ex + s * 0.5, ey - 1.5, 1.6, "#ffffff");
    }
    // 이빨 줄
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const k = i / 10;
      const x = -46 + k * 92;
      const y = BOW + 22 + Math.abs(k - 0.5) * 34;
      ctx.lineTo(x, y + (i % 2 ? 7 : 0));
    }
    stroke(ctx, "#ffffff", 3);
  }
  if (id === "ice-boat") {
    for (let i = 0; i < 10; i++) {
      const x = -W2 + 22 + i * 33;
      ctx.beginPath();
      ctx.moveTo(x - 7, 22);
      ctx.lineTo(x, 40 + (i % 3) * 7);
      ctx.lineTo(x + 7, 22);
      ctx.closePath();
      flat(ctx, "rgba(235,250,255,0.95)", 1.6, "#8fc9e8");
    }
  }
  // ---- 테두리(뱃전) ----
  ctx.beginPath();
  ctx.moveTo(0, BOW + 8);
  ctx.bezierCurveTo(66, BOW + 30, W2 - 12, -150, W2 - 10, -50);
  ctx.lineTo(-(W2 - 10), -50);
  ctx.bezierCurveTo(-(W2 - 12), -150, -66, BOW + 30, 0, BOW + 8);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `rim${id}`, 0, BOW, 0, -40, [
    [0, lighten(S.rim, 0.25)],
    [1, S.rim],
  ]);
  ctx.fill();
  stroke(ctx, lineOf(S.rim), 2.4);
  // ---- 갑판 ----
  deckPath(ctx);
  ctx.fillStyle = linear(ctx, `deck${id}`, 0, BOW + 26, 0, -56, [
    [0, darken(S.deck, 0.12)],
    [0.5, S.deck],
    [1, lighten(S.deck, 0.08)],
  ]);
  ctx.fill();
  ctx.save();
  deckPath(ctx);
  ctx.clip();
  // 판자 이음새 (선수로 모이는 원근)
  for (let i = -5; i <= 5; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 30, -56);
    ctx.lineTo(i * 6, BOW + 30);
    stroke(ctx, alpha(darken(S.plank, 0.25), 0.55), 1.8, "butt");
    if (id !== "speed-boat") {
      // 나뭇결
      for (let k = 0; k < 3; k++) {
        const y0 = -80 - k * 52 - (i % 2) * 18;
        const x0 = i * 30 + (i * 6 - i * 30) * ((-56 - y0) / (-56 - BOW - 30)) + 12;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 + 3, y0 - 10, x0 - 1, y0 - 22);
        stroke(ctx, alpha(darken(S.plank, 0.15), 0.35), 1.1);
      }
    }
  }
  // 가로 이음새
  for (const y of [-118, -186]) {
    ctx.beginPath();
    ctx.moveTo(-W2, y);
    ctx.lineTo(W2, y);
    stroke(ctx, alpha(darken(S.plank, 0.3), 0.45), 1.4, "butt");
  }
  // 갑판 그늘 (가장자리 쪽 어둡게)
  ctx.fillStyle = linear(ctx, `deckshade${id}`, -W2, 0, W2, 0, [
    [0, "rgba(60,30,10,0.28)"],
    [0.18, "rgba(60,30,10,0)"],
    [0.82, "rgba(60,30,10,0)"],
    [1, "rgba(60,30,10,0.28)"],
  ]);
  ctx.fillRect(-W2, BOW, W2 * 2, 260);
  ctx.restore();
  deckPath(ctx);
  stroke(ctx, alpha(darken(S.deck, 0.45), 0.8), 2.2);
  // 미끄럼 방지 매트 (지혁이 서는 곳)
  rrect(ctx, -64, -106, 128, 46, 14);
  flat(ctx, "#2a8f9a", 2.2, "#166570");
  ctx.save();
  rrect(ctx, -62, -104, 124, 42, 12);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.2;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 10, -106);
    ctx.lineTo(i * 10 + 30, -60);
    ctx.stroke();
  }
  ctx.restore();
  // ---- 장비 ----
  // 선수 물탱크 + 압력계
  ctx.save();
  ctx.translate(0, BOW + 84);
  ell(ctx, 0, 16, 34, 9);
  ctx.fillStyle = "rgba(40,20,10,0.25)";
  ctx.fill();
  rrect(ctx, -26, -18, 52, 34, 12);
  ctx.fillStyle = "rgba(200,245,255,0.75)";
  ctx.fill();
  ctx.save();
  rrect(ctx, -25, -17, 50, 32, 11);
  ctx.clip();
  ctx.fillStyle = linear(ctx, "deck-tank", 0, -8, 0, 16, [
    [0, "#7fe6ff"],
    [1, "#1b86de"],
  ]);
  ctx.fillRect(-26, -6, 52, 24);
  ctx.restore();
  rrect(ctx, -26, -18, 52, 34, 12);
  stroke(ctx, "#2a7fb8", 2.4);
  gloss(ctx, -12, -8, 8, 3.5, 0.9, 0);
  for (const sx of [-30, 30]) {
    rrect(ctx, sx - 4, -14, 8, 26, 3);
    ctx.fillStyle = linear(ctx, "metal-v", 0, -14, 0, 12, [
      [0, "#eef3fa"],
      [0.5, "#a3b0c4"],
      [1, "#dfe6f0"],
    ]);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "#56627a";
    ctx.stroke();
  }
  circ(ctx, 18, -22, 8);
  flat(ctx, "#f6f8fc", 2, "#56627a");
  ctx.beginPath();
  ctx.moveTo(18, -22);
  ctx.lineTo(22, -27);
  stroke(ctx, "#e2463b", 1.6);
  ctx.font = '900 9px "Bagel Fat One", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("AQUA", 0, 6);
  ctx.restore();
  // 밧줄 뭉치 (왼쪽)
  ctx.save();
  ctx.translate(-92, -150);
  ell(ctx, 0, 4, 22, 9);
  ctx.fillStyle = "rgba(40,20,10,0.25)";
  ctx.fill();
  for (let i = 4; i >= 0; i--) {
    ell(ctx, 0, -i * 1.6, 8 + i * 3.4, 4 + i * 1.5);
    ctx.lineWidth = 4.2;
    ctx.strokeStyle = i % 2 ? "#d9b36a" : "#c39a52";
    ctx.stroke();
  }
  ell(ctx, 0, -6, 6, 2.6);
  ctx.fillStyle = "#6b4a24";
  ctx.fill();
  ctx.restore();
  // 쇠 클리트 (오른쪽)
  ctx.save();
  ctx.translate(96, -160);
  rrect(ctx, -14, -4, 28, 8, 4);
  ctx.fillStyle = linear(ctx, "cleat", 0, -4, 0, 4, [
    [0, "#ffffff"],
    [0.5, "#a7b3c6"],
    [1, "#7d8aa1"],
  ]);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#4b5670";
  ctx.stroke();
  ctx.restore();
  // 크롬 난간 (앞쪽 양옆)
  for (const s of [-1, 1]) {
    const pts = [
      [s * 20, BOW + 34],
      [s * 70, BOW + 66],
      [s * 118, -160],
      [s * 140, -110],
    ];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1] - 16);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y - 16);
    stroke(ctx, "#5e6b82", 4.2);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1] - 16);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y - 16);
    stroke(ctx, "#e9eff8", 2);
    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.moveTo(x, y - 16);
      ctx.lineTo(x, y);
      stroke(ctx, "#8592a8", 3);
      dot(ctx, x, y, 2.4, "#5e6b82");
    }
  }
  // 구명 튜브 (오른쪽 난간에 걸림)
  ctx.save();
  ctx.translate(W2 - 18, -86);
  ctx.rotate(0.25);
  ell(ctx, 0, 0, 16, 18);
  ctx.lineWidth = 9;
  ctx.strokeStyle = "#ff4d4d";
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 18, 0, i * (Math.PI / 2) + 0.35, i * (Math.PI / 2) + 0.95);
    stroke(ctx, "#ffffff", 9, "butt");
  }
  ell(ctx, 0, 0, 20.5, 22.5);
  stroke(ctx, "#8a1f1f", 1.6);
  ell(ctx, 0, 0, 11.5, 13.5);
  stroke(ctx, "#8a1f1f", 1.6);
  ctx.restore();
  // 꾸미기
  if (id === "speed-boat") {
    ctx.beginPath();
    ctx.moveTo(-74, -196);
    ctx.lineTo(74, -196);
    ctx.lineTo(56, -226);
    ctx.lineTo(-56, -226);
    ctx.closePath();
    ctx.fillStyle = "rgba(160,220,255,0.55)";
    ctx.fill();
    stroke(ctx, "#56627a", 3);
    gloss(ctx, -26, -214, 18, 4, 0.7, 0);
  }
  if (id === "pirate-boat") {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 120, -128);
      ell(ctx, 0, 0, 13, 15);
      fill(ctx, "#8d5a35", 0, 0, 13, 15, 2);
      ctx.beginPath();
      ctx.moveTo(-13, -5);
      ctx.lineTo(13, -5);
      ctx.moveTo(-13, 5);
      ctx.lineTo(13, 5);
      stroke(ctx, "#3d2a1a", 2);
      ctx.restore();
    }
  }
  if (id === "rainbow-boat" || id === "ice-boat") {
    for (let i = 0; i < 5; i++) star(ctx, -110 + i * 55, -24, 7, id === "ice-boat" ? "#ffffff" : "#fff6b0", i, id === "ice-boat" ? "#8fc9e8" : "#c98a00");
  }
  // ---- 뒤판(트랜섬) ----
  ctx.beginPath();
  ctx.moveTo(-(W2 + 2), -50);
  ctx.lineTo(W2 + 2, -50);
  ctx.lineTo(W2 - 12, 26);
  ctx.quadraticCurveTo(0, 36, -(W2 - 12), 26);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `transom${id}`, 0, -50, 0, 30, [
    [0, darken(S.hull, 0.05)],
    [1, darken(S.hull, 0.35)],
  ]);
  ctx.fill();
  stroke(ctx, lineOf(S.hull), 3.4);
  ctx.beginPath();
  ctx.moveTo(-(W2 + 2), -50);
  ctx.lineTo(W2 + 2, -50);
  stroke(ctx, S.trim, 6);
  ctx.beginPath();
  ctx.moveTo(-(W2 - 2), -46);
  ctx.lineTo(W2 - 2, -46);
  stroke(ctx, alpha("#ffffff", 0.45), 1.6);
  // 미등
  for (const s of [-1, 1]) {
    rrect(ctx, s * 138 - 9, -36, 18, 9, 4);
    flat(ctx, s < 0 ? "#ff5050" : "#4cdf7a", 1.6, "#2a2f40");
    gloss(ctx, s * 138 - 2, -34, 5, 2, 0.8, 0);
  }
  // 이름판
  rrect(ctx, -92, -30, 184, 30, 9);
  ctx.fillStyle = linear(ctx, `plate${id}`, 0, -30, 0, 0, [
    [0, lighten(S.plate, 0.12)],
    [1, darken(S.plate, 0.2)],
  ]);
  ctx.fill();
  stroke(ctx, "#0c1630", 2.4);
  for (const [x, y] of [
    [-84, -22],
    [84, -22],
    [-84, -8],
    [84, -8],
  ]) {
    dot(ctx, x, y, 2.4, "#c9d3e3");
    dot(ctx, x - 0.6, y - 0.6, 1, "#ffffff");
  }
  ctx.font = '900 19px "Bagel Fat One", "Jua", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeText(S.name, 0, -14);
  ctx.fillStyle = linear(ctx, `letter${id}`, 0, -24, 0, -4, [
    [0, lighten(S.letter, 0.4)],
    [1, darken(S.letter, 0.15)],
  ]);
  ctx.fillText(S.name, 0, -14);
  // 선외기
  ctx.save();
  ctx.translate(0, 6);
  rrect(ctx, -9, 0, 18, 30, 4);
  ctx.fillStyle = linear(ctx, "shaft", -9, 0, 9, 0, [
    [0, "#5e6b82"],
    [0.5, "#c7d0de"],
    [1, "#5e6b82"],
  ]);
  ctx.fill();
  ctx.restore();
}

function drawSub(ctx, S) {
  ell(ctx, 0, -112, 160, 140);
  fill(ctx, S.hull, 0, -112, 160, 140, 4.4);
  ctx.save();
  ell(ctx, 0, -112, 158, 138);
  ctx.clip();
  ctx.fillStyle = alpha(S.belly, 0.55);
  ctx.fillRect(-170, -40, 340, 120);
  ctx.restore();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    dot(ctx, Math.cos(a) * 148, -112 + Math.sin(a) * 128, 3, darken(S.hull, 0.35));
  }
  for (const s of [-1, 1]) {
    circ(ctx, s * 96, -96, 22);
    ctx.fillStyle = radial(ctx, "port", s * 96 - 6, -102, 0, s * 96, -96, 22, [
      [0, "#e9fbff"],
      [1, "#5fb8e6"],
    ]);
    ctx.fill();
    circ(ctx, s * 96, -96, 22);
    stroke(ctx, S.trim, 6);
    gloss(ctx, s * 96 - 6, -104, 7, 4, 0.9);
  }
  ctx.beginPath();
  ctx.moveTo(-122, -200);
  ctx.lineTo(-122, -250);
  ctx.lineTo(-96, -250);
  stroke(ctx, "#8592a8", 10);
  ctx.beginPath();
  ctx.moveTo(-122, -200);
  ctx.lineTo(-122, -250);
  ctx.lineTo(-96, -250);
  stroke(ctx, "#d7dee9", 4);
  ell(ctx, 0, -110, 78, 30);
  fill(ctx, darken(S.hull, 0.2), 0, -110, 78, 30, 3);
  ell(ctx, 0, -112, 64, 22);
  flat(ctx, "#33405c", 2.4, "#1b2236");
  rrect(ctx, -64, -26, 128, 24, 8);
  flat(ctx, S.plate, 2.4, "#0c1630");
  ctx.font = '900 16px "Bagel Fat One", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = S.letter;
  ctx.fillText(S.name, 0, -14);
}

/* ---------------- 스프라이트 캐시 ---------------- */
const SPRITES = new Map();
export function boatSprite(id, px) {
  const key = `${id}|${px.toFixed(2)}`;
  let sp = SPRITES.get(key);
  if (sp) return sp;
  const x0 = -200;
  const y0 = -300;
  const w = 400;
  const h = 360;
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w * px);
  cv.height = Math.ceil(h * px);
  const c = cv.getContext("2d");
  c.scale(px, px);
  c.translate(-x0, -y0);
  drawBoatStatic(c, id);
  sp = { cv, x0, y0, w, h };
  if (SPRITES.size > 8) SPRITES.clear();
  SPRITES.set(key, sp);
  return sp;
}

/* ---------------- 움직이는 부분 ---------------- */
/** 배 아래 물: 반사 · 그림자 · 항적 (배보다 먼저) */
export function drawBoatWater(ctx, t, id, moving = 1) {
  // 그림자 + 물에 비친 배
  shadow(ctx, 0, 30, 190, 40, 0.38, "4,30,70");
  ctx.save();
  ctx.globalAlpha = 0.28;
  const S = BOAT_STYLE[id] || BOAT_STYLE["blue-shark"];
  for (let i = 0; i < 5; i++) {
    const y = 30 + i * 9;
    ctx.beginPath();
    ctx.moveTo(-150 + Math.sin(t * 3 + i) * 6, y);
    ctx.lineTo(150 + Math.sin(t * 3 + i + 1) * 6, y);
    stroke(ctx, i % 2 ? darken(S.hull, 0.3) : lighten(S.hull, 0.2), 5 - i * 0.6, "butt");
  }
  ctx.restore();
  // V 항적 (양옆으로 퍼지는 거품 띠)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const k = (t * 0.55 * moving + i / 9) % 1;
      const x = s * (150 + k * 170);
      const y = 8 + k * 70;
      const r = 10 + k * 26;
      ctx.globalAlpha = (1 - k) * 0.75;
      ell(ctx, x, y, r, r * 0.42, s * 0.2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ell(ctx, x - s * r * 0.3, y - 2, r * 0.6, r * 0.22, s * 0.2);
      ctx.fillStyle = "#d6f6ff";
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // 프로펠러 물거품
  for (let i = 0; i < 12; i++) {
    const k = (t * 1.4 + i / 12) % 1;
    const a = i * 2.4;
    const x = Math.cos(a) * (8 + k * 34);
    const y = 40 + k * 46;
    ctx.globalAlpha = (1 - k) * 0.9;
    circ(ctx, x, y, 5 + k * 9);
    ctx.fillStyle = i % 3 ? "#ffffff" : "#bfeeff";
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 배 위에서 움직이는 것: 깃발 · 뱃전 물보라 */
export function drawBoatLive(ctx, t, id) {
  // 깃발 (선미 왼쪽)
  ctx.save();
  ctx.translate(-150, -52);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -92);
  stroke(ctx, "#5e6b82", 4);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -92);
  stroke(ctx, "#dfe6f0", 1.6);
  dot(ctx, 0, -94, 4, "#ffcf33");
  const S = BOAT_STYLE[id] || BOAT_STYLE["blue-shark"];
  const flagColor = id === "pirate-boat" ? "#2b2d4a" : id === "rainbow-boat" ? "#7a3cff" : "#1e74d6";
  ctx.beginPath();
  ctx.moveTo(2, -90);
  for (let i = 1; i <= 6; i++) ctx.lineTo(2 + i * 9, -90 + Math.sin(t * 7 - i * 0.9) * (i * 0.9) + i * 0.5);
  for (let i = 6; i >= 1; i--) ctx.lineTo(2 + i * 9, -64 + Math.sin(t * 7 - i * 0.9) * (i * 0.9) - i * 0.3);
  ctx.lineTo(2, -64);
  ctx.closePath();
  flat(ctx, flagColor, 2, darken(flagColor, 0.5));
  // 상어 지느러미 마크
  ctx.beginPath();
  ctx.moveTo(18, -68 + Math.sin(t * 7 - 2) * 1.5);
  ctx.quadraticCurveTo(26, -86, 34, -86 + Math.sin(t * 7 - 3) * 2);
  ctx.quadraticCurveTo(30, -76, 34, -68 + Math.sin(t * 7 - 3) * 2);
  ctx.closePath();
  ctx.fillStyle = id === "pirate-boat" ? "#ffffff" : S.trim === "#ffffff" ? "#ffffff" : S.trim;
  ctx.fill();
  ctx.restore();
  // 뱃전에 튀는 물보라
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const k = (t * 1.1 + i / 5 + (s > 0 ? 0.5 : 0)) % 1;
      ctx.globalAlpha = (1 - k) * 0.85;
      circ(ctx, s * (W2 + 4 + k * 26), -40 - k * 30 + k * k * 50, 3 + (i % 3));
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** 배 앞쪽 물가 물결 (배 위에 겹쳐서 물에 잠긴 느낌) */
export function drawBoatFoam(ctx, t) {
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 14; i++) {
    const k = i / 13;
    const x = -168 + k * 336;
    const y = 28 + Math.sin(t * 4 + i * 1.3) * 3 + Math.abs(k - 0.5) * -10;
    ell(ctx, x, y, 16, 5.5);
    ctx.fillStyle = i % 2 ? "#ffffff" : "#e2f8ff";
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
