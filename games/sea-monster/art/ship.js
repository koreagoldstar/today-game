/*
 * 바다괴물 탐험대 — 침몰한 보물선 (옆에서 본 단면)
 *  원점 = 용골 가운데 바닥, 위가 -y. 길이 1000 · 높이 380 (선미루 · 선수루 포함)
 *  가운데가 부서져 안이 보인다: 아래 짐칸(바닥 -30) · 가운데 갑판(-140, 가운데에 구멍) · 위 갑판(-260, 부서진 틈)
 *  SHIP 은 world.js 가 부딪힘 · 숨는 곳 자리를 잡을 때 쓰는 치수.
 */
import { mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, fill, flat, stroke, gloss } from "../../ocean-blaster/art/kit.js?v=3";

const TAU = Math.PI * 2;
export const SHIP = {
  stern: { x0: -500, x1: -250, top: -380 },
  bow: { x0: 300, x1: 500, top: -320 },
  hold: { floor: -30, mid: -140, deck: -260 },
  midGap: { x0: 20, x1: 120 },
  deckGap: { x0: -140, x1: -40 },
  bowBreach: { y0: -230, y1: -150 },
  portholes: [
    [-440, -300],
    [-370, -300],
    [-300, -300],
    [-420, -170],
    [-330, -170],
    [370, -230],
    [440, -230],
  ],
  lanterns: [
    [-120, -230],
    [200, -110],
  ],
};

const WOOD = "#7a4a2a";
const DARK = "#3e2414";
const PLANK = "#8f5a32";

function planks(ctx, x0, y0, x1, y1, color, gap = 22) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  for (let y = y0; y < y1; y += gap) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.strokeStyle = alpha(darken(color, 0.45), 0.6);
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let x = x0 + ((y / gap) % 2) * 60; x < x1; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + gap);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 배 전체 (한 번 그려서 캐시) */
export function drawShip(ctx, rnd = Math.random) {
  // ---- 부러진 큰 돛대 (배 뒤쪽 레이어) ----
  ctx.save();
  ctx.translate(60, -260);
  ctx.rotate(0.28);
  rrect(ctx, -10, -470, 20, 470, 6);
  fill(ctx, "#6a4024", 0, -230, 10, 230, 3);
  // 활대 + 찢어진 돛
  rrect(ctx, -110, -380, 220, 12, 5);
  fill(ctx, "#6a4024", 0, -374, 110, 6, 2.4);
  ctx.beginPath();
  ctx.moveTo(-100, -368);
  ctx.lineTo(100, -368);
  ctx.lineTo(86, -250);
  ctx.lineTo(40, -262);
  ctx.lineTo(10, -220);
  ctx.lineTo(-30, -250);
  ctx.lineTo(-90, -230);
  ctx.closePath();
  ctx.fillStyle = "rgba(225,215,190,0.8)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#8a7a5a";
  ctx.stroke();
  // 돛의 해골 무늬 (해적선!)
  circ(ctx, 0, -310, 18);
  ctx.fillStyle = "rgba(40,30,30,0.55)";
  ctx.fill();
  ctx.restore();

  // ---- 선체 바깥 모양 ----
  const hull = () => {
    ctx.beginPath();
    ctx.moveTo(-500, -380);
    ctx.lineTo(-250, -380);
    ctx.lineTo(-250, -262);
    ctx.lineTo(300, -262);
    ctx.lineTo(300, -320);
    ctx.lineTo(470, -320);
    ctx.quadraticCurveTo(540, -240, 500, -120);
    ctx.quadraticCurveTo(440, -10, 300, 0);
    ctx.lineTo(-420, 0);
    ctx.quadraticCurveTo(-500, -40, -510, -160);
    ctx.closePath();
  };
  hull();
  ctx.fillStyle = linear(ctx, "shipHull", 0, -380, 0, 0, [
    [0, lighten(WOOD, 0.12)],
    [0.6, WOOD],
    [1, darken(WOOD, 0.45)],
  ]);
  ctx.fill();
  ctx.save();
  hull();
  ctx.clip();
  planks(ctx, -520, -390, 540, 10, WOOD, 26);
  // 이끼 · 따개비 · 해초
  for (let i = 0; i < 70; i++) {
    const x = -500 + rnd() * 1000;
    const y = -360 + rnd() * 360;
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + rnd() * 12, 2 + rnd() * 5, 0, 0, TAU);
    ctx.fillStyle = alpha(rnd() < 0.6 ? "#5f8a5a" : "#c9c0a8", 0.45);
    ctx.fill();
  }
  // 아래쪽 어둠 (모래에 묻힘)
  ctx.fillStyle = linear(ctx, "shipShade", 0, -90, 0, 0, [
    [0, "rgba(10,20,30,0)"],
    [1, "rgba(10,20,30,0.55)"],
  ]);
  ctx.fillRect(-520, -90, 1060, 100);
  ctx.restore();

  // ---- 가운데 단면 (부서진 곳) — 안쪽 벽 ----
  const cut = () => {
    ctx.beginPath();
    ctx.moveTo(-250, -262);
    ctx.lineTo(-180, -250);
    ctx.lineTo(-130, -268);
    ctx.lineTo(-60, -248);
    ctx.lineTo(20, -262);
    ctx.lineTo(120, -246);
    ctx.lineTo(220, -264);
    ctx.lineTo(300, -250);
    ctx.lineTo(300, -10);
    ctx.lineTo(-250, -10);
    ctx.closePath();
  };
  cut();
  ctx.fillStyle = linear(ctx, "shipIn", 0, -262, 0, -10, [
    [0, "#3a2416"],
    [1, "#1e120a"],
  ]);
  ctx.fill();
  ctx.save();
  cut();
  ctx.clip();
  planks(ctx, -260, -270, 310, 0, "#4a2e1a", 24);
  // 갈비뼈 (늑골)
  for (let x = -220; x < 300; x += 70) {
    rrect(ctx, x, -262, 12, 252, 4);
    ctx.fillStyle = "rgba(20,10,4,0.55)";
    ctx.fill();
  }
  ctx.restore();
  // 부서진 가장자리 (쪼개진 판자)
  ctx.save();
  ctx.strokeStyle = lighten(PLANK, 0.2);
  ctx.lineWidth = 4;
  for (let i = 0; i < 9; i++) {
    const x = -250 + i * 68;
    ctx.beginPath();
    ctx.moveTo(x, -262);
    ctx.lineTo(x + 10 + rnd() * 20, -240 - rnd() * 20);
    ctx.stroke();
  }
  ctx.restore();

  // ---- 바닥 · 가운데 갑판 (구멍) · 위 갑판 (부서진 틈) ----
  const floor = (x0, x1, y, th = 12) => {
    rrect(ctx, x0, y - th / 2, x1 - x0, th, 3);
    ctx.fillStyle = linear(ctx, `fl${y}`, 0, y - th / 2, 0, y + th / 2, [
      [0, lighten(PLANK, 0.25)],
      [1, darken(PLANK, 0.25)],
    ]);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = DARK;
    ctx.stroke();
  };
  floor(-250, 300, SHIP.hold.floor + 6, 14);
  floor(-250, SHIP.midGap.x0, SHIP.hold.mid);
  floor(SHIP.midGap.x1, 300, SHIP.hold.mid);
  floor(-250, SHIP.deckGap.x0, SHIP.hold.deck);
  floor(SHIP.deckGap.x1, 300, SHIP.hold.deck);
  // 갑판 구멍 가장자리 쪼개짐
  for (const x of [SHIP.midGap.x0, SHIP.midGap.x1, SHIP.deckGap.x0, SHIP.deckGap.x1]) {
    ctx.beginPath();
    ctx.moveTo(x, -4 + (x === SHIP.deckGap.x0 || x === SHIP.deckGap.x1 ? SHIP.hold.deck : SHIP.hold.mid));
    ctx.lineTo(x + (x % 2 ? 8 : -8), 12 + (x === SHIP.deckGap.x0 || x === SHIP.deckGap.x1 ? SHIP.hold.deck : SHIP.hold.mid));
    stroke(ctx, PLANK, 5);
  }
  // 기둥
  for (const x of [-170, 230]) {
    rrect(ctx, x - 7, SHIP.hold.deck, 14, SHIP.hold.floor - SHIP.hold.deck, 4);
    fill(ctx, "#5a3420", x, -150, 7, 110, 2);
  }
  // ---- 짐: 상자 · 통 · 금화 더미 ----
  const crate = (x, y, s = 1) => {
    rrect(ctx, x - 22 * s, y - 40 * s, 44 * s, 40 * s, 3);
    fill(ctx, "#b07a42", x - 6, y - 26 * s, 22 * s, 20 * s, 2.4);
    ctx.beginPath();
    ctx.moveTo(x - 20 * s, y - 38 * s);
    ctx.lineTo(x + 20 * s, y - 2 * s);
    ctx.moveTo(x + 20 * s, y - 38 * s);
    ctx.lineTo(x - 20 * s, y - 2 * s);
    stroke(ctx, alpha("#5a3018", 0.7), 3);
  };
  const barrel = (x, y, s = 1) => {
    ctx.beginPath();
    ctx.ellipse(x, y - 24 * s, 18 * s, 24 * s, 0, 0, TAU);
    fill(ctx, "#9a5e30", x - 4, y - 30 * s, 18 * s, 24 * s, 2.4);
    for (const dy of [-38, -10]) {
      ctx.beginPath();
      ctx.moveTo(x - 17 * s, y + dy * s);
      ctx.quadraticCurveTo(x, y + (dy + 4) * s, x + 17 * s, y + dy * s);
      stroke(ctx, "#5a5a6a", 3);
    }
  };
  const coins = (x, y, w) => {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y - w * 0.6, x + w, y);
    ctx.closePath();
    fill(ctx, "#ffcf3f", x - 4, y - w * 0.3, w, w * 0.3, 2);
    for (let i = 0; i < w / 4; i++) {
      circ(ctx, x - w * 0.8 + rnd() * w * 1.6, y - rnd() * w * 0.4, 3);
      ctx.fillStyle = "#fff3a0";
      ctx.fill();
    }
  };
  crate(-215, SHIP.hold.floor);
  crate(-170, SHIP.hold.floor, 0.8);
  barrel(250, SHIP.hold.floor);
  coins(130, SHIP.hold.floor, 34);
  coins(-60, SHIP.hold.floor, 22);
  barrel(-220, SHIP.hold.mid - 6, 0.85);
  crate(260, SHIP.hold.mid - 6, 0.8);
  coins(-10, SHIP.hold.mid - 6, 18);

  // ---- 둥근 창 (놋쇠 테 + 어두운 유리) ----
  for (const [x, y] of SHIP.portholes) {
    circ(ctx, x, y, 36);
    ctx.fillStyle = "#c8962e";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#6a4a10";
    ctx.stroke();
    circ(ctx, x, y, 30);
    ctx.fillStyle = "#0a0f22";
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      circ(ctx, x + Math.cos(a) * 33, y + Math.sin(a) * 33, 2.2);
      ctx.fillStyle = "#6a4a10";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(x - 12, y - 14, 10, 5, -0.6, 0, TAU);
    ctx.fillStyle = "rgba(200,240,255,0.3)";
    ctx.fill();
  }
  // ---- 선미루 장식 · 선수상 ----
  rrect(ctx, -500, -392, 250, 16, 5);
  fill(ctx, "#c8962e", -380, -384, 120, 8, 2.4);
  ctx.save();
  ctx.translate(500, -250);
  ctx.rotate(-0.5);
  ctx.beginPath();
  ctx.ellipse(30, 0, 34, 16, 0, 0, TAU);
  fill(ctx, "#c8962e", 30, -4, 34, 16, 2.4);
  circ(ctx, 56, -8, 12);
  fill(ctx, "#d9a63a", 54, -10, 12, 12, 2);
  ctx.restore();
  // 바깥 테두리
  hull();
  ctx.lineWidth = 4;
  ctx.strokeStyle = darken(WOOD, 0.6);
  ctx.stroke();
  // 뱃머리 쪽 부서진 틈 (들어가는 입구)
  ctx.beginPath();
  ctx.moveTo(300, SHIP.bowBreach.y0);
  ctx.lineTo(330, SHIP.bowBreach.y0 + 10);
  ctx.lineTo(318, (SHIP.bowBreach.y0 + SHIP.bowBreach.y1) / 2);
  ctx.lineTo(334, SHIP.bowBreach.y1 - 6);
  ctx.lineTo(300, SHIP.bowBreach.y1);
  ctx.closePath();
  ctx.fillStyle = "#1e120a";
  ctx.fill();
}

/** 가짜 닻 (닻게가 없는 자리) */
export function drawAnchor(ctx) {
  ctx.save();
  ctx.translate(0, 2);
  ctx.rotate(-1.35);
  rrect(ctx, -4, -56, 8, 56, 3);
  fill(ctx, "#7a8494", -1, -30, 4, 28, 2.2);
  circ(ctx, 0, -60, 7);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#7a8494";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-26, -6);
  ctx.quadraticCurveTo(0, 14, 26, -6);
  stroke(ctx, "#3a404a", 9);
  stroke(ctx, "#7a8494", 6);
  ctx.restore();
}
