/*
 * 자석 대소동 · 그리기 (캔버스 2D · 그림 파일 없이 직접)
 *  물리 상태(sim)는 읽기만 하고, 움직임 연출(통통 · 납작 · 빙글)은 여기서만 계산한다.
 *  재질은 색만이 아니라 무늬 · 글자로도 구분: 철(볼트 · Fe) · 합금(줄무늬 · 합금) · 나무(나뭇결) · 고무(물방울 점) · 자석(N · S 글자)
 */
import { MAG, MAT } from "./sim.js?v=1";

const TAU = Math.PI * 2;
export const C = {
  navy: "#1f2a4d",
  navy2: "#2c3b6b",
  ink: "#1b2340",
  teal: "#2bb5a6",
  teal2: "#1d8f84",
  coral: "#ff7a59",
  coral2: "#e0573a",
  lemon: "#ffd84d",
  lemon2: "#e9b21c",
  lav: "#b9a7f0",
  lav2: "#8d77d8",
  cream: "#fff6e6",
  steel: "#6f7f9c",
  steel2: "#47546f",
  N: "#ff6b57",
  S: "#3aa7e8",
};

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const lerp = (a, b, t) => a + (b - a) * t;

/* ================================================================
 * 배경 (스테이지가 바뀌거나 크기가 바뀔 때만 미리 그려 둠)
 * ============================================================== */
export function drawBackdrop(ctx, G, scale) {
  const W = G.W;
  const H = G.H;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2a3a6e");
  g.addColorStop(1, "#1d2849");
  ctx.fillStyle = g;
  ctx.fillRect(-200, -200, W + 400, H + 400);
  // 벽 패널
  ctx.strokeStyle = "rgba(185,167,240,0.12)";
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 60; y < H; y += 120) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // 둥근 창 · 큰 톱니 · 파이프 (분위기)
  const seed = (G.def.id || 1) * 97;
  const rnd = (k) => {
    const s = Math.sin(seed + k * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let k = 0; k < 3; k++) {
    const x = 120 + rnd(k) * (W - 240);
    const y = 70 + rnd(k + 5) * 90;
    ctx.fillStyle = "rgba(255,246,230,0.08)";
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,246,230,0.16)";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,216,77,0.10)";
    ctx.beginPath();
    ctx.arc(x - 8, y - 8, 12, 0, TAU);
    ctx.fill();
  }
  for (let k = 0; k < 2; k++) {
    const x = 80 + rnd(k + 10) * (W - 160);
    const y = 140 + rnd(k + 20) * 220;
    bigGear(ctx, x, y, 46 + rnd(k + 30) * 30, "rgba(185,167,240,0.10)");
  }
  ctx.strokeStyle = "rgba(43,181,166,0.18)";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-10, 40 + rnd(40) * 40);
  ctx.lineTo(W * 0.3, 40 + rnd(40) * 40);
  ctx.lineTo(W * 0.3, 110);
  ctx.stroke();
  void scale;
}
function bigGear(ctx, x, y, r, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = col;
  ctx.beginPath();
  const n = 10;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU;
    const q = i % 2 ? r * 0.82 : r;
    ctx.lineTo(Math.cos(a - 0.12) * q, Math.sin(a - 0.12) * q);
    ctx.lineTo(Math.cos(a + 0.12) * q, Math.sin(a + 0.12) * q);
  }
  ctx.closePath();
  ctx.arc(0, 0, r * 0.35, 0, TAU, true);
  ctx.fill("evenodd");
  ctx.restore();
}

/* 고정 벽 · 바닥 (금속판 · 리벳 · 노랑 줄무늬 끝) */
export function drawWalls(ctx, G) {
  for (const b of G.walls) {
    if (b.left < -20 || b.right > G.W + 20) continue; // 화면 밖 벽
    const x = b.left;
    const y = b.top;
    const w = b.hw * 2;
    const h = b.hh * 2;
    ctx.fillStyle = "rgba(10,14,30,0.35)";
    rr(ctx, x + 3, y + 5, w, h, 6);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#5b6f99");
    g.addColorStop(1, "#3b4a72");
    ctx.fillStyle = g;
    rr(ctx, x, y, w, h, 6);
    ctx.fill();
    // 윗면 하이라이트
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    rr(ctx, x + 2, y + 2, w - 4, Math.min(5, h / 3), 3);
    ctx.fill();
    // 리벳
    ctx.fillStyle = "rgba(255,246,230,0.45)";
    for (let rx = x + 10; rx < x + w - 6; rx += 40) {
      ctx.beginPath();
      ctx.arc(rx, y + Math.min(h / 2, 11), 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(14,20,40,0.55)";
    ctx.lineWidth = 2;
    rr(ctx, x, y, w, h, 6);
    ctx.stroke();
  }
}

/* ================================================================
 * 물체
 * ============================================================== */
function bolt(ctx, x, y, s, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.42, 0, TAU);
  ctx.fill();
  ctx.restore();
}
function label(ctx, text, x, y, size, col = "#fff", stroke = "rgba(20,24,44,0.75)") {
  ctx.font = `700 ${size}px Jua, "Noto Sans KR", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, size * 0.22);
  ctx.strokeStyle = stroke;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = col;
  ctx.fillText(text, x, y);
}

export function drawObject(ctx, b, G, now, opts = {}) {
  const held = G.held.has(b.id);
  const locked = b.type === "static" && b.data.obj;
  ctx.save();
  ctx.translate(b.x, b.y);
  // 그림자
  ctx.fillStyle = "rgba(8,12,28,0.28)";
  ctx.beginPath();
  ctx.ellipse(2, b.hh + 2, b.hw * 0.9, 4, 0, 0, TAU);
  ctx.fill();
  // 자석에 끌려오면 살짝 떨림 · 빛
  if (held) {
    ctx.translate(Math.sin(now * 60) * 0.6, Math.cos(now * 55) * 0.6);
    ctx.shadowColor = G.mag.pole === "N" ? C.N : C.S;
    ctx.shadowBlur = 14;
  }
  if (b.shape === "circle") drawBall(ctx, b);
  else drawCrate(ctx, b);
  ctx.shadowBlur = 0;
  if (locked) {
    // 목표에 딸깍 고정됨
    ctx.strokeStyle = C.lemon;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(b.hw, b.hh) + 6 + Math.sin(now * 6) * 1.5, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  void opts;
}
function drawBall(ctx, b) {
  const r = b.r;
  const mat = b.mat;
  const grads = {
    iron: ["#c3cfe6", "#6f7f9c", "#38445e"],
    alloy: ["#fff3c4", "#d9b45a", "#8a6a22"],
    rubber: ["#ffd0c4", "#ff7a59", "#c24a30"],
    wood: ["#ffd9a6", "#d58f4a", "#8c5422"],
    magN: ["#ffd2c9", C.N, "#b8372a"],
    magS: ["#cdeaff", C.S, "#1f6ea6"],
  }[mat] || ["#ddd", "#999", "#555"];
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, grads[0]);
  g.addColorStop(0.55, grads[1]);
  g.addColorStop(1, grads[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.rotate(b.angle);
  if (mat === "iron") {
    // 굴러가는 게 보이게 볼트 두 개
    bolt(ctx, r * 0.45, 0, r * 0.2, "rgba(255,255,255,0.55)");
    bolt(ctx, -r * 0.45, 0, r * 0.2, "rgba(255,255,255,0.4)");
  } else if (mat === "rubber") {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (const [x, y] of [
      [0.4, 0.2],
      [-0.3, 0.45],
      [-0.2, -0.4],
    ]) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, r * 0.13, 0, TAU);
      ctx.fill();
    }
  } else if (mat === "alloy") {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, -r * 0.2);
    ctx.lineTo(r * 0.8, -r * 0.2);
    ctx.moveTo(-r * 0.8, r * 0.25);
    ctx.lineTo(r * 0.8, r * 0.25);
    ctx.stroke();
  }
  ctx.restore();
  // 반짝
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.42, r * 0.28, r * 0.16, -0.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(14,18,36,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  if (mat === "magN" || mat === "magS") label(ctx, mat === "magN" ? "N" : "S", 0, 1, r * 1.05);
}
function drawCrate(ctx, b) {
  const w = b.hw * 2;
  const h = b.hh * 2;
  const x = -b.hw;
  const y = -b.hh;
  const mat = b.mat;
  if (mat === "wood") {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#f0b26a");
    g.addColorStop(1, "#c47a3c");
    ctx.fillStyle = g;
    rr(ctx, x, y, w, h, 5);
    ctx.fill();
    // 판자 · 나뭇결
    ctx.strokeStyle = "rgba(120,62,22,0.55)";
    ctx.lineWidth = 2;
    for (let k = 1; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x + 3, y + (h * k) / 3);
      ctx.lineTo(x + w - 3, y + (h * k) / 3);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,230,190,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.15);
    ctx.quadraticCurveTo(x + w * 0.45, y + h * 0.25, x + w * 0.75, y + h * 0.12);
    ctx.stroke();
    ctx.strokeStyle = "#7a4318";
    ctx.lineWidth = 2.5;
    rr(ctx, x, y, w, h, 5);
    ctx.stroke();
    return;
  }
  if (mat === "rubber") {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#ffa58c");
    g.addColorStop(1, "#e65b3c");
    ctx.fillStyle = g;
    rr(ctx, x, y, w, h, Math.min(w, h) * 0.3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (const [px, py] of [
      [0.25, 0.3],
      [0.7, 0.55],
      [0.4, 0.75],
    ]) {
      ctx.beginPath();
      ctx.arc(x + w * px, y + h * py, Math.min(w, h) * 0.07, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = "#a63a22";
    ctx.lineWidth = 2.5;
    rr(ctx, x, y, w, h, Math.min(w, h) * 0.3);
    ctx.stroke();
    return;
  }
  if (mat === "magN" || mat === "magS") {
    const col = mat === "magN" ? C.N : C.S;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, mat === "magN" ? "#ffb3a6" : "#9fd6ff");
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    rr(ctx, x, y, w, h, 7);
    ctx.fill();
    // 자석 표시 (말굽 모양)
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = Math.max(3, w * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, h * 0.08, w * 0.24, Math.PI, 0);
    ctx.moveTo(-w * 0.24, h * 0.08);
    ctx.lineTo(-w * 0.24, h * 0.3);
    ctx.moveTo(w * 0.24, h * 0.08);
    ctx.lineTo(w * 0.24, h * 0.3);
    ctx.stroke();
    label(ctx, mat === "magN" ? "N" : "S", 0, -h * 0.12, Math.min(w, h) * 0.46);
    ctx.strokeStyle = "rgba(14,18,36,0.7)";
    ctx.lineWidth = 2.5;
    rr(ctx, x, y, w, h, 7);
    ctx.stroke();
    return;
  }
  // 철 · 합금 상자
  const alloy = mat === "alloy";
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, alloy ? "#fff0bd" : "#a9b6d0");
  g.addColorStop(0.5, alloy ? "#d8b25a" : "#73839f");
  g.addColorStop(1, alloy ? "#9c7a2c" : "#46536e");
  ctx.fillStyle = g;
  rr(ctx, x, y, w, h, 6);
  ctx.fill();
  // 모서리 철판 · 리벳
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(x + 4, y + 4, w - 8, 4);
  ctx.fillStyle = "rgba(20,26,46,0.45)";
  for (const [px, py] of [
    [0.16, 0.16],
    [0.84, 0.16],
    [0.16, 0.84],
    [0.84, 0.84],
  ]) {
    ctx.beginPath();
    ctx.arc(x + w * px, y + h * py, 2.6, 0, TAU);
    ctx.fill();
  }
  if (alloy) {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, y + h * (0.5 + k * 0.17));
      ctx.lineTo(x + w * 0.8, y + h * (0.5 + k * 0.17));
      ctx.stroke();
    }
    label(ctx, "합금", 0, 1, Math.min(w, h) * 0.26, "#fff8e0");
  } else {
    // X 보강대 + 철 표시
    ctx.strokeStyle = "rgba(20,26,46,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 6);
    ctx.lineTo(x + w - 6, y + h - 6);
    ctx.moveTo(x + w - 6, y + 6);
    ctx.lineTo(x + 6, y + h - 6);
    ctx.stroke();
    label(ctx, "Fe", 0, 1, Math.min(w, h) * 0.3, "#eef3ff");
  }
  if (b.data.heavy) {
    // 무거움 표시 (작은 추)
    ctx.fillStyle = "rgba(20,26,46,0.6)";
    rr(ctx, x + w - 14, y - 9, 12, 9, 3);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(14,18,36,0.75)";
  ctx.lineWidth = 2.5;
  rr(ctx, x, y, w, h, 6);
  ctx.stroke();
}

/* ================================================================
 * 장치
 * ============================================================== */
export function drawDevices(ctx, G, now) {
  // 자석 레일 · 고정 전자석
  for (const m of G.magnets) {
    const col = m.pole === "N" ? C.N : C.S;
    if (m.rail) {
      ctx.fillStyle = "#4a587e";
      rr(ctx, m.x, m.y, m.w, m.h, 5);
      ctx.fill();
      for (let x = m.x + 8; x < m.x + m.w - 4; x += 18) {
        ctx.fillStyle = m.active ? "#ffd84d" : "#7d89a8";
        rr(ctx, x, m.y + 3, 10, m.h - 6, 3);
        ctx.fill();
      }
      if (m.active) {
        ctx.strokeStyle = "rgba(255,216,77,0.35)";
        ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const yy = m.y + m.h + 6 + ((now * 40 + k * 14) % 40);
          ctx.globalAlpha = 1 - (yy - m.y - m.h) / 46;
          ctx.beginPath();
          ctx.moveTo(m.x + 6, yy);
          ctx.lineTo(m.x + m.w - 6, yy);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = "#1b2340";
      ctx.lineWidth = 2;
      rr(ctx, m.x, m.y, m.w, m.h, 5);
      ctx.stroke();
      label(ctx, "자석 레일", m.x + m.w / 2, m.y - 10, 12, "#fff6e6");
      continue;
    }
    const cx = m.x + m.w / 2;
    const cy = m.y + m.h / 2;
    if (m.active) {
      const R = m.range || 170;
      ctx.fillStyle = m.pole === "N" ? "rgba(255,107,87,0.08)" : "rgba(58,167,232,0.08)";
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = m.pole === "N" ? "rgba(255,107,87,0.45)" : "rgba(58,167,232,0.45)";
      ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const q = ((now * 0.6 + k * 0.5) % 1) * R;
        ctx.globalAlpha = 0.6 * (1 - q / R);
        ctx.beginPath();
        ctx.arc(cx, cy, R - q, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#3b4a72";
    rr(ctx, m.x, m.y, m.w, m.h, 8);
    ctx.fill();
    // 코일
    ctx.strokeStyle = m.active ? "#ffb347" : "#8a6a3a";
    ctx.lineWidth = 3;
    for (let y = m.y + 8; y < m.y + m.h - 6; y += 6) {
      ctx.beginPath();
      ctx.moveTo(m.x + 6, y);
      ctx.lineTo(m.x + m.w - 6, y);
      ctx.stroke();
    }
    ctx.fillStyle = m.active ? col : "#7d89a8";
    rr(ctx, m.x + m.w * 0.22, m.y + m.h * 0.22, m.w * 0.56, m.h * 0.56, 6);
    ctx.fill();
    label(ctx, m.pole, cx, cy + 1, Math.min(m.w, m.h) * 0.42);
    ctx.strokeStyle = "#1b2340";
    ctx.lineWidth = 2.5;
    rr(ctx, m.x, m.y, m.w, m.h, 8);
    ctx.stroke();
    if (!m.active) label(ctx, "꺼짐", cx, m.y - 10, 12, "#c9d0e6");
  }
  // 컨베이어
  for (const c of G.conveyors) {
    const { x, y, w, h } = c;
    ctx.fillStyle = "#2a3150";
    rr(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.save();
    rr(ctx, x + 2, y + 2, w - 4, h - 4, (h - 4) / 2);
    ctx.clip();
    ctx.fillStyle = "#414c74";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c.body.surf ? C.lemon : "#7d89a8";
    const step = 22;
    const off = ((c.roll % step) + step) % step;
    const dirn = Math.sign(c.body.surf || c.speed);
    for (let px = x - step + off; px < x + w + step; px += step) {
      ctx.beginPath();
      ctx.moveTo(px, y + h * 0.25);
      ctx.lineTo(px + dirn * 7, y + h * 0.5);
      ctx.lineTo(px, y + h * 0.75);
      ctx.lineTo(px + 4 * dirn, y + h * 0.75);
      ctx.lineTo(px + dirn * 11, y + h * 0.5);
      ctx.lineTo(px + 4 * dirn, y + h * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // 바퀴
    for (const wx of [x + h / 2, x + w - h / 2]) {
      ctx.fillStyle = "#c9d0e6";
      ctx.beginPath();
      ctx.arc(wx, y + h / 2, h * 0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#1b2340";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const a = c.roll / (h * 0.3);
      ctx.moveTo(wx + Math.cos(a) * h * 0.28, y + h / 2 + Math.sin(a) * h * 0.28);
      ctx.lineTo(wx - Math.cos(a) * h * 0.28, y + h / 2 - Math.sin(a) * h * 0.28);
      ctx.stroke();
    }
    ctx.strokeStyle = "#141a33";
    ctx.lineWidth = 2.5;
    rr(ctx, x, y, w, h, h / 2);
    ctx.stroke();
  }
  // 스프링
  for (const s of G.springs) {
    const sq = s.squeeze;
    const top = s.y - 4 + sq * 8;
    ctx.strokeStyle = "#c9d0e6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const n = 4;
    for (let i = 0; i <= n * 2; i++) {
      const yy = lerp(top + 6, s.y + 14, i / (n * 2));
      const xx = s.x + s.w / 2 + (i % 2 ? -1 : 1) * s.w * 0.3;
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.fillStyle = C.lemon;
    rr(ctx, s.x, top - 2, s.w, 9, 4);
    ctx.fill();
    ctx.strokeStyle = "#8a6a10";
    ctx.lineWidth = 2;
    rr(ctx, s.x, top - 2, s.w, 9, 4);
    ctx.stroke();
    // 위 화살표
    ctx.fillStyle = "rgba(255,216,77,0.8)";
    const ax = s.x + s.w / 2;
    const ay = top - 16 - Math.abs(Math.sin(now * 4)) * 4;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 7);
    ctx.lineTo(ax + 7, ay + 3);
    ctx.lineTo(ax - 7, ay + 3);
    ctx.closePath();
    ctx.fill();
  }
  // 움직이는 발판 · 리프트
  for (const p of [...G.platforms, ...G.lifts]) {
    const b = p.body;
    const isLift = G.lifts.includes(p);
    if (isLift) {
      ctx.strokeStyle = "rgba(201,208,230,0.5)";
      ctx.lineWidth = 2;
      for (const cx of [b.left + 8, b.right - 8]) {
        ctx.beginPath();
        ctx.moveTo(cx, Math.min(p.y2, p.y) - 40);
        ctx.lineTo(cx, b.top);
        ctx.stroke();
      }
    } else {
      // 지나가는 길
      ctx.strokeStyle = "rgba(201,208,230,0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.path[0][0] + p.w / 2, p.path[0][1] + p.h / 2);
      ctx.lineTo(p.path[1][0] + p.w / 2, p.path[1][1] + p.h / 2);
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, b.top, 0, b.bottom);
    g.addColorStop(0, isLift ? "#b9a7f0" : "#5fd3c4");
    g.addColorStop(1, isLift ? "#8d77d8" : "#1d8f84");
    ctx.fillStyle = g;
    rr(ctx, b.left, b.top, b.hw * 2, b.hh * 2, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(20,26,46,0.35)";
    for (let x = b.left + 8; x < b.right - 6; x += 16) ctx.fillRect(x, b.top + 4, 8, 3);
    ctx.strokeStyle = "#141a33";
    ctx.lineWidth = 2;
    rr(ctx, b.left, b.top, b.hw * 2, b.hh * 2, 6);
    ctx.stroke();
    if (isLift) label(ctx, "리프트", b.x, b.y + 1, 11, "#fff6e6");
  }
  // 문
  for (const d of G.doors) {
    const h = d.h * (1 - d.frac);
    ctx.fillStyle = "#2a3150";
    ctx.fillRect(d.x - 4, d.y - 6, d.w + 8, 8);
    if (h > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(d.x, d.y, d.w, h);
      ctx.clip();
      ctx.fillStyle = "#c9a227";
      ctx.fillRect(d.x, d.y, d.w, h);
      ctx.fillStyle = "#2a2f45";
      for (let k = -2; k < (d.h + d.w) / 18 + 2; k++) {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y + k * 18);
        ctx.lineTo(d.x + d.w, d.y + k * 18 - d.w);
        ctx.lineTo(d.x + d.w, d.y + k * 18 - d.w + 9);
        ctx.lineTo(d.x, d.y + k * 18 + 9);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = "#141a33";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(d.x, d.y, d.w, h);
      // 자물쇠 표시
      ctx.fillStyle = "#fff6e6";
      rr(ctx, d.x + d.w / 2 - 7, d.y + Math.min(h - 18, 20), 14, 12, 3);
      ctx.fill();
      ctx.strokeStyle = "#fff6e6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(d.x + d.w / 2, d.y + Math.min(h - 18, 20), 4.5, Math.PI, 0);
      ctx.stroke();
    }
  }
  // 누름 스위치
  for (const s of G.switches) {
    const down = s.press * 5;
    ctx.fillStyle = "#2a3150";
    rr(ctx, s.x - 3, s.y + 2, s.w + 6, 10, 4);
    ctx.fill();
    ctx.fillStyle = s.on ? "#7ee081" : C.coral;
    rr(ctx, s.x + 3, s.y - 6 + down, s.w - 6, 10 - down * 0.6, 4);
    ctx.fill();
    ctx.strokeStyle = "#141a33";
    ctx.lineWidth = 2;
    rr(ctx, s.x + 3, s.y - 6 + down, s.w - 6, 10 - down * 0.6, 4);
    ctx.stroke();
    // 무엇이 누를 수 있나 (아이콘)
    const ix = s.x + s.w / 2;
    const iy = s.y - 22;
    if (s.accepts && s.accepts !== "any") {
      ctx.fillStyle = "rgba(20,26,46,0.7)";
      rr(ctx, ix - 16, iy - 9, 32, 16, 8);
      ctx.fill();
      label(ctx, s.accepts === "object" ? "물건만" : (s.accepts.map ? s.accepts.map((m) => MAT[m] ? MAT[m].label : m).join("·") : ""), ix, iy - 1, 10, "#fff6e6", "rgba(0,0,0,0)");
    }
    if (s.on) {
      ctx.fillStyle = "#7ee081";
      ctx.beginPath();
      ctx.arc(ix, s.y - 13, 3, 0, TAU);
      ctx.fill();
    }
  }
  // 목표 칸
  for (const g of G.goals) {
    const pulse = 0.6 + Math.sin(now * 4) * 0.25;
    ctx.save();
    ctx.globalAlpha = g.locked ? 0.9 : pulse;
    ctx.strokeStyle = g.locked ? "#7ee081" : C.lemon;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    rr(ctx, g.x, g.y, g.w, g.h, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = g.locked ? "rgba(126,224,129,0.15)" : "rgba(255,216,77,0.1)";
    rr(ctx, g.x, g.y, g.w, g.h, 8);
    ctx.fill();
    ctx.restore();
    if (!g.locked) {
      // 무엇을 넣는지
      const name = (g.accepts || []).map((m) => (MAT[m] ? MAT[m].label : m === "ball" ? "공" : m === "crate" ? "상자" : m)).join("·") || "물건";
      // 칸 바로 위가 벽(굴 지붕 등)이면 그 벽 위에 글씨
      let ly = g.y - 12;
      const lx = g.x + g.w / 2;
      for (const w of G.walls) if (lx > w.left && lx < w.right && ly > w.top - 8 && ly < w.bottom + 8) ly = w.top - 12;
      label(ctx, `${name} 넣기`, lx, ly, 12, C.lemon);
      ctx.fillStyle = C.lemon;
      const ay = g.y + 12 + Math.sin(now * 5) * 3;
      ctx.beginPath();
      ctx.moveTo(g.x + g.w / 2, ay + 8);
      ctx.lineTo(g.x + g.w / 2 + 7, ay);
      ctx.lineTo(g.x + g.w / 2 - 7, ay);
      ctx.closePath();
      ctx.fill();
    }
  }
  // 레버
  for (const l of G.levers) {
    ctx.fillStyle = "#2a3150";
    rr(ctx, l.x - 16, l.y + 8, 32, 12, 4);
    ctx.fill();
    ctx.strokeStyle = "#c9d0e6";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    const a = l.on ? 0.6 : -0.6;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y + 12);
    ctx.lineTo(l.x + Math.sin(a) * 22, l.y + 12 - Math.cos(a) * 22);
    ctx.stroke();
    ctx.fillStyle = l.on ? "#7ee081" : C.coral;
    ctx.beginPath();
    ctx.arc(l.x + Math.sin(a) * 22, l.y + 12 - Math.cos(a) * 22, 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#141a33";
    ctx.lineWidth = 2;
    ctx.stroke();
    label(ctx, l.on ? "켜짐" : "꺼짐", l.x, l.y + 30, 11, "#fff6e6");
  }
  // 출구
  if (G.exit) {
    const e = G.exit;
    const open = e.open_;
    ctx.fillStyle = "#141a33";
    rr(ctx, e.x - 4, e.y - 4, e.w + 8, e.h + 4, 14);
    ctx.fill();
    const g = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
    g.addColorStop(0, open ? "#9ff2c8" : "#59657f");
    g.addColorStop(1, open ? "#2bb5a6" : "#3b4560");
    ctx.fillStyle = g;
    rr(ctx, e.x, e.y, e.w, e.h, 12);
    ctx.fill();
    if (open) {
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + Math.sin(now * 5) * 0.2})`;
      ctx.lineWidth = 3;
      for (let k = 0; k < 2; k++) {
        const q = ((now * 0.8 + k * 0.5) % 1) * 18;
        rr(ctx, e.x + q / 2, e.y + q / 2, e.w - q, e.h - q, 10);
        ctx.stroke();
      }
    } else {
      // 잠긴 막대
      ctx.strokeStyle = "#9aa3bd";
      ctx.lineWidth = 4;
      for (let x = e.x + 10; x < e.x + e.w - 4; x += 13) {
        ctx.beginPath();
        ctx.moveTo(x, e.y + 8);
        ctx.lineTo(x, e.y + e.h - 4);
        ctx.stroke();
      }
    }
    // 간판
    ctx.fillStyle = open ? "#2bb5a6" : "#59657f";
    rr(ctx, e.x + e.w / 2 - 26, e.y - 26, 52, 18, 6);
    ctx.fill();
    label(ctx, open ? "출구 ▶" : "잠김", e.x + e.w / 2, e.y - 17, 12, "#fff");
  }
  // 숨은 기어
  const gd = G.def.gear;
  if (gd && !G.gearGot) {
    ctx.save();
    ctx.translate(gd.x, gd.y + Math.sin(now * 3) * 3);
    ctx.rotate(now * 1.5);
    ctx.fillStyle = C.lemon;
    ctx.strokeStyle = "#8a6a10";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const q = i % 2 ? 9 : 13;
      ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8a6a10";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(255,216,77,${0.25 + Math.sin(now * 6) * 0.15})`;
    ctx.beginPath();
    ctx.arc(gd.x, gd.y, 22, 0, TAU);
    ctx.fill();
  }
}

/* ================================================================
 * 자석 범위 · 마그
 * ============================================================== */
export function drawMagnetField(ctx, G, now) {
  if (!G.mag.on) return;
  const R = G.robot;
  const cx = R.x - G.facing * 4;
  const cy = R.y - 6;
  const col = G.mag.pole === "N" ? "255,107,87" : "58,167,232";
  ctx.fillStyle = `rgba(${col},0.08)`;
  ctx.beginPath();
  ctx.arc(cx, cy, MAG.range, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(${col},0.55)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, MAG.range, 0, TAU);
  ctx.stroke();
  // 안쪽으로 모이는 물결 (끌어당김 느낌)
  for (let k = 0; k < 3; k++) {
    const q = 1 - ((now * 0.9 + k / 3) % 1);
    ctx.globalAlpha = 0.45 * (1 - q) + 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy, MAG.range * q, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // 끌려오는 물체로 가는 선
  for (const b of G.objs) {
    if (!G.held.has(b.id)) continue;
    ctx.strokeStyle = `rgba(${col},0.5)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const mx = (cx + b.x) / 2 + Math.sin(now * 20) * 3;
    const my = (cy + b.y) / 2 - 10;
    ctx.quadraticCurveTo(mx, my, b.x, b.y);
    ctx.stroke();
  }
}

/** 마그 (anim: 렌더 쪽 상태 — bounce · squash · spin · face · skin) */
export function drawRobot(ctx, G, A, now, skin) {
  const R = G.robot;
  const S = skin || SKINS[0];
  const f = G.facing;
  ctx.save();
  ctx.translate(R.x, R.bottom);
  // 그림자
  ctx.fillStyle = "rgba(8,12,28,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 1, 20, 5, 0, 0, TAU);
  ctx.fill();
  const sx = A.sx;
  const sy = A.sy;
  ctx.translate(0, -A.hop);
  ctx.scale(sx, sy);
  // 등 자석 (말굽 · 극 색 · 켜지면 빛)
  const pole = G.mag.pole;
  const pcol = pole === "N" ? C.N : C.S;
  ctx.save();
  ctx.translate(-f * 15, -30);
  ctx.rotate(-f * 0.25 + A.spin);
  if (G.mag.on) {
    ctx.shadowColor = pcol;
    ctx.shadowBlur = 16;
  }
  ctx.strokeStyle = pcol;
  ctx.lineWidth = 7;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.arc(0, 0, 11, Math.PI * 0.05, Math.PI * 0.95, true);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#e8edf7";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.lineTo(-11, 7);
  ctx.moveTo(11, 0);
  ctx.lineTo(11, 7);
  ctx.stroke();
  ctx.restore();
  // 몸 (둥근 통)
  const g = ctx.createLinearGradient(-20, -44, 20, 0);
  g.addColorStop(0, S.light);
  g.addColorStop(1, S.body);
  ctx.fillStyle = g;
  rr(ctx, -19, -44, 38, 42, 16);
  ctx.fill();
  ctx.strokeStyle = "#141a33";
  ctx.lineWidth = 2.5;
  rr(ctx, -19, -44, 38, 42, 16);
  ctx.stroke();
  // 배 판
  ctx.fillStyle = "rgba(255,246,230,0.9)";
  rr(ctx, -11 + f * 2, -18, 22, 12, 5);
  ctx.fill();
  ctx.fillStyle = G.mag.on ? pcol : "#c9d0e6";
  ctx.beginPath();
  ctx.arc(-4 + f * 2, -12, 2.5, 0, TAU);
  ctx.arc(4 + f * 2, -12, 2.5, 0, TAU);
  ctx.fill();
  // 바퀴 발
  ctx.fillStyle = "#2a3150";
  for (const wx of [-10, 10]) {
    ctx.beginPath();
    ctx.arc(wx, -2, 5, 0, TAU);
    ctx.fill();
  }
  // 안테나
  ctx.strokeStyle = "#141a33";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(f * 4, -44);
  ctx.quadraticCurveTo(f * 6, -54, f * 2 + Math.sin(now * 8) * 2, -58);
  ctx.stroke();
  ctx.fillStyle = G.mag.on ? pcol : C.lemon;
  ctx.beginPath();
  ctx.arc(f * 2 + Math.sin(now * 8) * 2, -59, 4, 0, TAU);
  ctx.fill();
  // 얼굴 화면
  ctx.fillStyle = "#1b2340";
  rr(ctx, -14 + f * 3, -39, 28, 18, 8);
  ctx.fill();
  drawEyes(ctx, f, A.face, now, G.mag.on);
  // 기분 좋은 볼
  ctx.fillStyle = "rgba(255,122,89,0.55)";
  ctx.beginPath();
  ctx.ellipse(-14 + f * 3, -22, 3.5, 2, 0, 0, TAU);
  ctx.ellipse(14 + f * 3, -22, 3.5, 2, 0, 0, TAU);
  ctx.fill();
  if (S.hat) S.hat(ctx, f);
  ctx.restore();
}
function drawEyes(ctx, f, face, now, on) {
  const ex = [-6 + f * 4, 6 + f * 4];
  const ey = -30;
  ctx.fillStyle = "#9ff2e8";
  ctx.strokeStyle = "#9ff2e8";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  for (const x of ex) {
    if (face === "happy") {
      ctx.beginPath();
      ctx.arc(x, ey + 2, 3.5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (face === "dizzy") {
      ctx.beginPath();
      ctx.moveTo(x - 3, ey - 3);
      ctx.lineTo(x + 3, ey + 3);
      ctx.moveTo(x + 3, ey - 3);
      ctx.lineTo(x - 3, ey + 3);
      ctx.stroke();
    } else if (face === "wow") {
      ctx.beginPath();
      ctx.arc(x, ey, 4.2, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, ey, 1.6, 0, TAU);
      ctx.fill();
    } else if (face === "blink") {
      ctx.beginPath();
      ctx.moveTo(x - 3.5, ey);
      ctx.lineTo(x + 3.5, ey);
      ctx.stroke();
    } else {
      const h = on ? 3 : 4.2;
      ctx.beginPath();
      ctx.ellipse(x + f * 0.8, ey, 3, h, 0, 0, TAU);
      ctx.fill();
    }
  }
  if (on && face !== "happy") {
    // 힘주는 눈썹
    ctx.strokeStyle = "#9ff2e8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex[0] - 4, ey - 7);
    ctx.lineTo(ex[0] + 3, ey - 5);
    ctx.moveTo(ex[1] + 4, ey - 7);
    ctx.lineTo(ex[1] - 3, ey - 5);
    ctx.stroke();
  }
  void now;
}

/** 마그 스킨 (겉모습만 · 능력 차이 없음) */
export const SKINS = [
  { id: "classic", name: "기본 마그", body: "#2bb5a6", light: "#9ff2e8", need: 0 },
  {
    id: "coral",
    name: "코랄 마그",
    body: "#ff7a59",
    light: "#ffd0c4",
    need: 3,
    hat(ctx, f) {
      // 작은 공장 모자
      ctx.fillStyle = C.lemon;
      rr(ctx, -12 - f * 2, -50, 24, 8, 4);
      ctx.fill();
      ctx.strokeStyle = "#141a33";
      ctx.lineWidth = 2;
      rr(ctx, -12 - f * 2, -50, 24, 8, 4);
      ctx.stroke();
    },
  },
  {
    id: "lemon",
    name: "레몬 마그",
    body: "#e9b21c",
    light: "#fff1a8",
    need: 6,
    hat(ctx, f) {
      ctx.fillStyle = "#fff6e6";
      ctx.strokeStyle = "#141a33";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6 + f, -44);
      ctx.lineTo(0 + f, -54);
      ctx.lineTo(6 + f, -44);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },
  },
  {
    id: "lavender",
    name: "라벤더 마그",
    body: "#8d77d8",
    light: "#e2d8ff",
    need: 9,
    hat(ctx, f) {
      // 별 배지
      ctx.fillStyle = C.lemon;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const q = i % 2 ? 2.4 : 5.5;
        ctx.lineTo(13 * -f + Math.cos(a) * q, -38 + Math.sin(a) * q);
      }
      ctx.closePath();
      ctx.fill();
    },
  },
  { id: "navy", name: "밤하늘 마그", body: "#2c3b6b", light: "#7d8ccc", need: 12 },
];

/* ================================================================
 * 효과 (불꽃 · 먼지 · 별 · 달라붙는 나사)
 * ============================================================== */
export function drawFx(ctx, fx) {
  for (const p of fx) {
    const k = p.t / p.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k);
    if (p.kind === "text") {
      label(ctx, p.text, p.x, p.y - k * 24, p.size || 16, p.color || "#fff");
    } else if (p.kind === "spark") {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    } else if (p.kind === "screw") {
      bolt(ctx, p.x, p.y, 3.2, "#c9d0e6");
    } else if (p.kind === "star") {
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.t * 5);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        const q = i % 2 ? p.size * 0.45 : p.size;
        ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
export { label };
