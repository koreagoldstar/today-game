/*
 * 말랑팡! 슬라임 연구소 · 그림 (캔버스 2D · 외부 그림 파일 없음)
 *  - 슬라임 몸 + 꾸밈(귀 · 왕관 · 뿔 …)은 단계별로 한 번 그려 두고(스프라이트) 화면 배율이 바뀔 때만 다시
 *  - 얼굴(눈 · 입 · 볼)은 표정이 바뀌므로 매번 그림 (몸과 같은 말랑 변형 안에서)
 *  - 연구소 배경 · 유리 용기 · 진화표 아이콘
 */
import { LEVELS, JAR } from "./config.js?v=1";

const TAU = Math.PI * 2;

/* ================================================================
 * 슬라임 몸 (R=1 기준 단위 u 로 그림)
 * ============================================================== */
/**
 * 젤리 슬라임 몸: 위는 둥근 돔 · 아래 가장자리는 말랑하게 늘어진 물결(방울 세 개)
 *  (충돌은 동그라미 그대로 · 그림만 슬라임 모양 — 둘레가 동그라미를 거의 벗어나지 않게)
 */
function bodyPath(ctx, L, u) {
  ctx.beginPath();
  if (L.lv === 1) {
    // 물방울 슬라임: 머리끝이 쪼르륵 뾰족
    ctx.moveTo(0, -1.5 * u);
    ctx.bezierCurveTo(0.42 * u, -1.05 * u, 1.0 * u, -0.62 * u, 1.0 * u, 0);
  } else {
    ctx.moveTo(-u, 0.02 * u);
    ctx.arc(0, 0, u, Math.PI, 0, false);
  }
  // 오른쪽 옆구리 → 아래 물결 → 왼쪽 옆구리
  ctx.bezierCurveTo(1.0 * u, 0.3 * u, 0.94 * u, 0.5 * u, 0.86 * u, 0.6 * u);
  ctx.quadraticCurveTo(0.78 * u, 0.98 * u, 0.5 * u, 0.86 * u);
  ctx.quadraticCurveTo(0.26 * u, 1.04 * u, 0, 0.9 * u);
  ctx.quadraticCurveTo(-0.26 * u, 1.04 * u, -0.5 * u, 0.86 * u);
  ctx.quadraticCurveTo(-0.78 * u, 0.98 * u, -0.86 * u, 0.6 * u);
  ctx.bezierCurveTo(-0.94 * u, 0.5 * u, -1.0 * u, 0.3 * u, -u, 0.02 * u);
  if (L.lv === 1) ctx.bezierCurveTo(-1.0 * u, -0.62 * u, -0.42 * u, -1.05 * u, 0, -1.5 * u);
  ctx.closePath();
}

function fillBody(ctx, L, u, alpha = 0.93) {
  const [c0, c1, c2] = L.c;
  // 젤리: 가운데가 밝게 비치고 가장자리로 갈수록 진한 색
  const g = ctx.createRadialGradient(-0.25 * u, -0.35 * u, 0.05 * u, 0, 0.05 * u, 1.15 * u);
  g.addColorStop(0, c0);
  g.addColorStop(0.42, c1);
  g.addColorStop(1, c2);
  ctx.globalAlpha = alpha;
  bodyPath(ctx, L, u);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** 젤리 느낌: 속이 비치는 빛 · 공기방울 · 가장자리 빛 · 테두리 */
function jelly(ctx, L, u) {
  ctx.save();
  bodyPath(ctx, L, u);
  ctx.clip();
  // 속에서 비치는 빛
  const core = ctx.createRadialGradient(0.05 * u, 0.25 * u, 0.05 * u, 0.05 * u, 0.25 * u, 0.8 * u);
  core.addColorStop(0, "rgba(255,255,255,0.32)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(-1.6 * u, -1.6 * u, 3.2 * u, 3.2 * u);
  // 아래쪽에 고인 진한 젤리 (부피감)
  const e = ctx.createRadialGradient(0, -0.1 * u, 0.6 * u, 0, -0.1 * u, 1.15 * u);
  e.addColorStop(0, "rgba(0,0,0,0)");
  e.addColorStop(1, hexA(L.line, 0.26));
  ctx.fillStyle = e;
  ctx.fillRect(-1.6 * u, -1.6 * u, 3.2 * u, 3.2 * u);
  // 공기방울
  for (const [x, y, r] of [
    [0.52, 0.38, 0.075],
    [0.66, 0.16, 0.045],
    [-0.58, 0.5, 0.055],
  ]) {
    ctx.beginPath();
    ctx.arc(x * u, y * u, r * u, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, 0.018 * u);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.stroke();
  }
  // 오른쪽 아래 가장자리 빛 (젤리가 빛을 머금은 느낌)
  ctx.beginPath();
  ctx.arc(0, 0, 0.86 * u, 0.12 * Math.PI, 0.42 * Math.PI);
  ctx.lineWidth = Math.max(1, 0.07 * u);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.stroke();
  ctx.restore();
  // 테두리 (작아도 또렷하게)
  bodyPath(ctx, L, u);
  ctx.lineWidth = Math.max(1.4, 0.075 * u);
  ctx.strokeStyle = hexA(L.line, 0.62);
  ctx.stroke();
}
function gloss(ctx, u, k = 1) {
  ctx.save();
  ctx.translate(-0.4 * u, -0.5 * u);
  ctx.rotate(-0.55);
  const g = ctx.createLinearGradient(0, -0.16 * u, 0, 0.16 * u);
  g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`);
  g.addColorStop(1, "rgba(255,255,255,0.1)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.3 * u, 0.15 * u, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = `rgba(255,255,255,${0.85 * k})`;
  ctx.beginPath();
  ctx.arc(-0.12 * u, -0.72 * u, 0.06 * u, 0, TAU);
  ctx.fill();
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function leaf(ctx, x, y, s, rot, col = "#5ccf6c", dark = "#2f8f45") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.55, -s * 0.5, s * 1.1, 0);
  ctx.quadraticCurveTo(s * 0.55, s * 0.5, 0, 0);
  const g = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.4);
  g.addColorStop(0, "#9af09a");
  g.addColorStop(1, col);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.strokeStyle = dark;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.1, 0);
  ctx.lineTo(s * 0.95, 0);
  ctx.stroke();
  ctx.restore();
}
function star5(ctx, x, y, r, rot = -Math.PI / 2, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** 단계별 꾸밈 (몸 뒤 / 몸 위) */
const DECO = {
  2: {
    // 레몬 슬라임: 노란 젤리 + 머리에 꽂은 레몬 조각 핀 (몸은 과일이 아니라 젤리)
    front(ctx, L, u) {
      const x = 0.5 * u;
      const y = -0.74 * u;
      const r = 0.3 * u;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.35);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = "#f7c21a";
      ctx.fill();
      ctx.lineWidth = Math.max(1, 0.035 * u);
      ctx.strokeStyle = "#a8740c";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.84, 0, TAU);
      ctx.fillStyle = "#fffbe8";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.74, 0, TAU);
      ctx.fillStyle = "#ffe866";
      ctx.fill();
      ctx.strokeStyle = "#fffbe8";
      ctx.lineWidth = Math.max(1, 0.03 * u);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.35, r * 0.14, 0, TAU);
      ctx.fill();
      ctx.restore();
    },
  },
  3: {
    // 복숭아 슬라임: 분홍 젤리 + 작은 복숭아 머리핀
    front(ctx, L, u) {
      const x = -0.5 * u;
      const y = -0.76 * u;
      const r = 0.25 * u;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.3);
      leaf(ctx, 0.02 * u, -r * 0.9, 0.3 * u, -0.5);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.75);
      ctx.bezierCurveTo(r * 1.1, -r * 1.25, r * 1.35, r * 0.6, 0, r);
      ctx.bezierCurveTo(-r * 1.35, r * 0.6, -r * 1.1, -r * 1.25, 0, -r * 0.75);
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.2, 0, 0, 0, r * 1.2);
      g.addColorStop(0, "#fff0e0");
      g.addColorStop(0.5, "#ffb08a");
      g.addColorStop(1, "#ff6f8e");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = Math.max(1, 0.03 * u);
      ctx.strokeStyle = "#b04a5c";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7);
      ctx.quadraticCurveTo(-r * 0.25, 0, 0, r * 0.8);
      ctx.strokeStyle = "rgba(176,74,92,0.5)";
      ctx.stroke();
      ctx.restore();
    },
  },
  4: {
    // 토끼: 긴 귀 (한쪽은 살짝 접힘)
    back(ctx, L, u) {
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 0.42 * u, -0.78 * u);
        ctx.rotate(s * 0.22);
        if (s > 0) ctx.rotate(0.12);
        ctx.beginPath();
        ctx.ellipse(0, -0.5 * u, 0.24 * u, 0.62 * u, 0, 0, TAU);
        const g = ctx.createLinearGradient(-0.24 * u, 0, 0.24 * u, 0);
        g.addColorStop(0, L.c[0]);
        g.addColorStop(1, L.c[2]);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = Math.max(1.2, 0.06 * u);
        ctx.strokeStyle = hexA(L.line, 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, -0.5 * u, 0.11 * u, 0.44 * u, 0, 0, TAU);
        ctx.fillStyle = "#ffc2dc";
        ctx.fill();
        ctx.restore();
      }
    },
  },
  5: {
    // 별빛: 둘레 빛 · 몸속 별자리 · 별 더듬이
    glow(ctx, L, u) {
      const g = ctx.createRadialGradient(0, 0, 0.8 * u, 0, 0, 1.55 * u);
      g.addColorStop(0, "rgba(160,140,255,0.45)");
      g.addColorStop(1, "rgba(160,140,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1.55 * u, 0, TAU);
      ctx.fill();
    },
    back(ctx, L, u) {
      ctx.beginPath();
      ctx.moveTo(0, -0.95 * u);
      ctx.quadraticCurveTo(0.05 * u, -1.25 * u, 0.22 * u, -1.42 * u);
      ctx.lineWidth = Math.max(1.4, 0.07 * u);
      ctx.strokeStyle = L.line;
      ctx.lineCap = "round";
      ctx.stroke();
    },
    inner(ctx, L, u) {
      const pts = [
        [-0.5, 0.42],
        [-0.12, 0.62],
        [0.3, 0.45],
        [0.58, 0.18],
      ];
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(1, 0.025 * u);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * u, y * u) : ctx.moveTo(x * u, y * u)));
      ctx.stroke();
      ctx.fillStyle = "#fff6b0";
      for (const [x, y] of pts) {
        star5(ctx, x * u, y * u, 0.07 * u);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (const [x, y, r] of [
        [-0.68, -0.05, 0.025],
        [0.7, -0.3, 0.03],
        [-0.3, -0.62, 0.02],
        [0.45, 0.72, 0.02],
      ]) {
        ctx.beginPath();
        ctx.arc(x * u, y * u, r * u, 0, TAU);
        ctx.fill();
      }
    },
    front(ctx, L, u) {
      const g = ctx.createRadialGradient(0.22 * u, -1.48 * u, 0, 0.22 * u, -1.48 * u, 0.22 * u);
      g.addColorStop(0, "#fffbd0");
      g.addColorStop(1, "#ffc93a");
      ctx.fillStyle = g;
      star5(ctx, 0.22 * u, -1.48 * u, 0.2 * u, -Math.PI / 2 + 0.2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, 0.035 * u);
      ctx.strokeStyle = "#c98a12";
      ctx.stroke();
    },
  },
  6: {
    // 무지개: 몸속 무지개 띠 · 머리 위 구름
    inner(ctx, L, u) {
      const cols = ["#ff7a8a", "#ffad5a", "#ffe066", "#7fe08a", "#6cc6ff", "#a88cff"];
      ctx.lineWidth = 0.085 * u;
      cols.forEach((c, i) => {
        ctx.strokeStyle = hexA(c, 0.75);
        ctx.beginPath();
        ctx.arc(0, 0.55 * u, (1.0 - i * 0.085) * u, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      });
    },
    front(ctx, L, u) {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(170,150,200,0.7)";
      ctx.lineWidth = Math.max(1, 0.04 * u);
      ctx.beginPath();
      for (const [x, y, r] of [
        [-0.28, -0.98, 0.2],
        [0.02, -1.08, 0.26],
        [0.32, -0.98, 0.2],
        [0.48, -0.9, 0.14],
      ])
        ctx.moveTo(x * u + r * u, y * u), ctx.arc(x * u, y * u, r * u, 0, TAU);
      ctx.stroke();
      ctx.fill();
    },
  },
  7: {
    // 왕관
    front(ctx, L, u) {
      const y = -0.86 * u;
      const w = 0.62 * u;
      ctx.beginPath();
      ctx.moveTo(-w, y);
      ctx.lineTo(-w * 1.05, y - 0.42 * u);
      ctx.lineTo(-w * 0.5, y - 0.2 * u);
      ctx.lineTo(0, y - 0.55 * u);
      ctx.lineTo(w * 0.5, y - 0.2 * u);
      ctx.lineTo(w * 1.05, y - 0.42 * u);
      ctx.lineTo(w, y);
      ctx.quadraticCurveTo(0, y + 0.12 * u, -w, y);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, y - 0.55 * u, 0, y + 0.1 * u);
      g.addColorStop(0, "#fff3a8");
      g.addColorStop(0.5, "#ffcc3a");
      g.addColorStop(1, "#e09412");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = Math.max(1.2, 0.04 * u);
      ctx.strokeStyle = "#a8650c";
      ctx.stroke();
      for (const [x, yy, r, c] of [
        [-1.05, -0.42, 0.06, "#ff5a8a"],
        [0, -0.55, 0.075, "#5ad1ff"],
        [1.05, -0.42, 0.06, "#ff5a8a"],
        [0, -0.04, 0.07, "#ff4a6a"],
      ]) {
        ctx.beginPath();
        ctx.arc(x * w, y + yy * u, r * u, 0, TAU);
        ctx.fillStyle = c;
        ctx.fill();
        ctx.lineWidth = Math.max(1, 0.02 * u);
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.stroke();
      }
    },
  },
  8: {
    // 전설의 젤리 드래곤: 날개 · 뿔 · 등 가시 · 배
    back(ctx, L, u) {
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 0.82 * u, -0.25 * u);
        ctx.scale(s, 1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(0.35 * u, -0.6 * u, 0.62 * u, -0.55 * u);
        ctx.quadraticCurveTo(0.55 * u, -0.3 * u, 0.62 * u, -0.12 * u);
        ctx.quadraticCurveTo(0.45 * u, -0.08 * u, 0.5 * u, 0.12 * u);
        ctx.quadraticCurveTo(0.3 * u, 0.05 * u, 0, 0.25 * u);
        ctx.closePath();
        ctx.fillStyle = "#4fc9a3";
        ctx.fill();
        ctx.lineWidth = Math.max(1.2, 0.04 * u);
        ctx.strokeStyle = L.line;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0.05 * u, 0.05 * u);
        ctx.lineTo(0.55 * u, -0.45 * u);
        ctx.moveTo(0.05 * u, 0.1 * u);
        ctx.lineTo(0.55 * u, -0.1 * u);
        ctx.strokeStyle = hexA(L.line, 0.5);
        ctx.stroke();
        ctx.restore();
      }
      // 등 가시
      for (const [x, s] of [
        [-0.22, 0.16],
        [0.0, 0.2],
        [0.22, 0.16],
      ]) {
        ctx.beginPath();
        ctx.moveTo((x - s * 0.7) * u, -0.94 * u);
        ctx.quadraticCurveTo(x * u, (-0.98 - s * 1.6) * u, (x + s * 0.7) * u, -0.94 * u);
        ctx.fillStyle = "#2fbf8f";
        ctx.fill();
        ctx.lineWidth = Math.max(1, 0.03 * u);
        ctx.strokeStyle = L.line;
        ctx.stroke();
      }
    },
    inner(ctx, L, u) {
      ctx.beginPath();
      ctx.ellipse(0, 0.55 * u, 0.55 * u, 0.4 * u, 0, 0, TAU);
      ctx.fillStyle = "rgba(255,250,215,0.75)";
      ctx.fill();
      ctx.strokeStyle = "rgba(200,170,110,0.35)";
      ctx.lineWidth = Math.max(1, 0.025 * u);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0.55 * u, 0.5 * u - i * 0.02 * u, 0.12 * u + i * 0.11 * u, 0, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
      // 점박이 비늘
      ctx.fillStyle = "rgba(15,107,82,0.18)";
      for (const [x, y, r] of [
        [-0.72, -0.15, 0.08],
        [0.74, -0.1, 0.07],
        [-0.55, -0.55, 0.06],
        [0.58, -0.58, 0.06],
      ]) {
        ctx.beginPath();
        ctx.arc(x * u, y * u, r * u, 0, TAU);
        ctx.fill();
      }
    },
    front(ctx, L, u) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 0.32 * u, -0.86 * u);
        ctx.quadraticCurveTo(s * 0.48 * u, -1.32 * u, s * 0.72 * u, -1.38 * u);
        ctx.quadraticCurveTo(s * 0.58 * u, -1.15 * u, s * 0.56 * u, -0.78 * u);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, -1.38 * u, 0, -0.8 * u);
        g.addColorStop(0, "#fffbe8");
        g.addColorStop(1, "#e8cf96");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = Math.max(1.2, 0.035 * u);
        ctx.strokeStyle = "#a07c3a";
        ctx.stroke();
      }
    },
  },
};

/** 스프라이트: 단계 하나를 지금 배율로 그린 캔버스 (몸 가운데가 캔버스 가운데) */
export function makeSprite(level, px) {
  const L = LEVELS[level];
  const u = L.r * px;
  const size = Math.ceil(u * 4);
  const cv = document.createElement("canvas");
  cv.width = cv.height = Math.max(8, size);
  const ctx = cv.getContext("2d");
  ctx.translate(cv.width / 2, cv.height / 2);
  const D = DECO[level] || {};
  if (D.glow) D.glow(ctx, L, u);
  if (D.back) D.back(ctx, L, u);
  // 바닥 쪽 그림자 (살짝)
  fillBody(ctx, L, u);
  if (D.inner) {
    ctx.save();
    bodyPath(ctx, L, u);
    ctx.clip();
    D.inner(ctx, L, u);
    ctx.restore();
  }
  jelly(ctx, L, u);
  gloss(ctx, u, level === 5 ? 0.8 : 1);
  if (D.front) D.front(ctx, L, u);
  return { cv, half: cv.width / 2, u };
}

/** 실루엣 (도감 · 진화표의 아직 못 찾은 슬라임) */
export function makeSilhouette(level, px) {
  const s = makeSprite(level, px);
  const ctx = s.cv.getContext("2d");
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "rgba(120,110,150,0.55)";
  ctx.fillRect(0, 0, s.cv.width, s.cv.height);
  return s;
}

/* ================================================================
 * 얼굴 (매번 · 몸 변형 안에서)
 *  expr: idle · blink · happy · squish · worried · surprise · sleep
 *  lx, ly: 눈동자 보는 쪽 (-1~1)
 * ============================================================== */
const EYE = [0, 0.2, 0.18, 0.17, 0.16, 0.15, 0.14, 0.13, 0.125];
const INK = "#2b2140";
export function drawFace(ctx, level, u, expr, lx = 0, ly = 0) {
  const L = LEVELS[level];
  const es = EYE[level] * u;
  const ex = (level === 1 ? 0.34 : 0.33) * u;
  const ey = (level === 1 ? 0.0 : -0.06) * u;
  const lw = Math.max(1.3, es * 0.32);
  // 볼
  ctx.fillStyle = hexA(L.cheek, level === 5 ? 0.6 : 0.45);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 0.58 * u, ey + 0.2 * u, 0.15 * u, 0.085 * u, 0, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = lw;
  for (const s of [-1, 1]) {
    const x = s * ex;
    if (expr === "blink" || expr === "sleep") {
      ctx.beginPath();
      ctx.arc(x, ey - es * 0.2, es * 0.75, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    } else if (expr === "happy") {
      ctx.beginPath();
      ctx.arc(x, ey + es * 0.45, es * 0.75, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    } else if (expr === "squish") {
      // > < (눈을 질끈 · 꼭짓점이 얼굴 가운데 쪽)
      ctx.beginPath();
      ctx.moveTo(x + s * es * 0.6, ey - es * 0.55);
      ctx.lineTo(x - s * es * 0.45, ey);
      ctx.lineTo(x + s * es * 0.6, ey + es * 0.55);
      ctx.stroke();
    } else {
      const big = expr === "surprise" ? 1.18 : 1;
      // 흰자 테두리 (놀람)
      if (expr === "surprise") {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(x, ey, es * 1.05, es * 1.25, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
      }
      const px = x + lx * es * 0.28;
      const py = ey + ly * es * 0.22;
      ctx.beginPath();
      ctx.ellipse(px, py, es * 0.82 * big * (expr === "surprise" ? 0.7 : 1), es * 1.02 * big * (expr === "surprise" ? 0.7 : 1), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      if (level === 5) {
        star5(ctx, px - es * 0.28, py - es * 0.35, es * 0.36);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(px - es * 0.3, py - es * 0.38, es * 0.34, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(px + es * 0.32, py + es * 0.36, es * 0.16, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      if (expr === "worried") {
        // 걱정 눈썹: 얼굴 가운데 쪽 끝이 올라감
        ctx.beginPath();
        ctx.moveTo(x + s * es * 0.6, ey - es * 1.4);
        ctx.lineTo(x - s * es * 0.55, ey - es * 1.78);
        ctx.stroke();
      }
    }
  }
  // 입
  const my = ey + 0.22 * u;
  const mw = Math.max(es * 0.9, 0.11 * u);
  ctx.lineWidth = lw * 0.9;
  if (expr === "surprise" || expr === "worried") {
    ctx.beginPath();
    if (expr === "surprise") ctx.ellipse(0, my + mw * 0.2, mw * 0.42, mw * 0.55, 0, 0, TAU);
    else {
      ctx.moveTo(-mw * 0.6, my + mw * 0.2);
      ctx.quadraticCurveTo(-mw * 0.3, my - mw * 0.1, 0, my + mw * 0.15);
      ctx.quadraticCurveTo(mw * 0.3, my + mw * 0.4, mw * 0.6, my + mw * 0.05);
    }
    if (expr === "surprise") {
      ctx.fillStyle = "#7a2a4a";
      ctx.fill();
      ctx.fillStyle = INK;
    }
    ctx.stroke();
    return;
  }
  if (expr === "squish") {
    ctx.beginPath();
    ctx.moveTo(-mw * 0.5, my);
    ctx.quadraticCurveTo(0, my + mw * 0.5, mw * 0.5, my);
    ctx.stroke();
    return;
  }
  const open = expr === "happy" || level === 2 || level === 6;
  if (level === 3 || level === 4) {
    // w 입 · ω
    ctx.beginPath();
    ctx.moveTo(-mw * 0.7, my - mw * 0.05);
    ctx.quadraticCurveTo(-mw * 0.35, my + mw * 0.55, 0, my);
    ctx.quadraticCurveTo(mw * 0.35, my + mw * 0.55, mw * 0.7, my - mw * 0.05);
    ctx.stroke();
    if (level === 4) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-mw * 0.16, my + mw * 0.02, mw * 0.32, mw * 0.32);
      ctx.strokeRect(-mw * 0.16, my + mw * 0.02, mw * 0.32, mw * 0.32);
      ctx.fillStyle = INK;
    }
    return;
  }
  if (open) {
    ctx.beginPath();
    ctx.moveTo(-mw * 0.6, my);
    ctx.quadraticCurveTo(0, my + mw * 1.15, mw * 0.6, my);
    ctx.closePath();
    ctx.fillStyle = "#c2416a";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff8fb0";
    ctx.beginPath();
    ctx.ellipse(0, my + mw * 0.5, mw * 0.28, mw * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK;
    return;
  }
  ctx.beginPath();
  if (level === 7) {
    // 의젓한 웃음 (한쪽이 더 올라감)
    ctx.moveTo(-mw * 0.55, my + mw * 0.1);
    ctx.quadraticCurveTo(0, my + mw * 0.55, mw * 0.65, my - mw * 0.12);
  } else {
    ctx.moveTo(-mw * 0.5, my);
    ctx.quadraticCurveTo(0, my + mw * 0.6, mw * 0.5, my);
  }
  ctx.stroke();
  if (level === 8) {
    // 작은 송곳니
    ctx.fillStyle = "#ffffff";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * mw * 0.32, my + mw * 0.14);
      ctx.lineTo(s * mw * 0.18, my + mw * 0.42);
      ctx.lineTo(s * mw * 0.08, my + mw * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = lw * 0.5;
      ctx.stroke();
    }
    ctx.fillStyle = INK;
  }
}

/* ================================================================
 * 연구소 배경 (화면 크기가 바뀔 때만 다시)
 * ============================================================== */
export function drawLab(ctx, w, h, jar) {
  // 벽
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#fde9f6");
  g.addColorStop(0.55, "#eaf3ff");
  g.addColorStop(1, "#dff6ef");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // 바둑판 타일 (아주 연하게)
  const t = Math.max(26, Math.round(Math.min(w, h) / 14));
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let y = 0; y < h; y += t) for (let x = (y / t) % 2 ? t : 0; x < w; x += t * 2) ctx.fillRect(x, y, t, t);
  // 바닥 (작업대)
  const fy = jar.by + jar.k * 26;
  const fg = ctx.createLinearGradient(0, fy, 0, h);
  fg.addColorStop(0, "#c9b6ef");
  fg.addColorStop(0.08, "#b9a3e6");
  fg.addColorStop(1, "#a690dc");
  ctx.fillStyle = fg;
  ctx.fillRect(0, fy, w, h - fy);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(0, fy, w, Math.max(2, jar.k * 4));
  // 둥근 창문 (구름)
  const wr = Math.min(w, h) * 0.13;
  const wx = jar.cx - jar.w * 0.5 - wr * 1.6;
  const wy = h * 0.2;
  if (wx - wr > 4) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(wx, wy, wr, 0, TAU);
    const sk = ctx.createLinearGradient(0, wy - wr, 0, wy + wr);
    sk.addColorStop(0, "#9fd8ff");
    sk.addColorStop(1, "#e2f4ff");
    ctx.fillStyle = sk;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const [dx, dy, r] of [
      [-0.3, 0.15, 0.32],
      [0.05, 0.05, 0.4],
      [0.4, 0.2, 0.3],
    ]) {
      ctx.beginPath();
      ctx.arc(wx + dx * wr, wy + dy * wr + wr * 0.3, r * wr, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = Math.max(3, wr * 0.12);
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(wx, wy, wr, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, wr * 0.05);
    ctx.beginPath();
    ctx.moveTo(wx - wr, wy);
    ctx.lineTo(wx + wr, wy);
    ctx.moveTo(wx, wy - wr);
    ctx.lineTo(wx, wy + wr);
    ctx.stroke();
  }
  // 선반 + 플라스크 (오른쪽)
  const sx = jar.cx + jar.w * 0.5 + jar.k * 40;
  if (sx + jar.k * 60 < w) {
    // 선반은 플라스크 몇 개 놓일 만큼만 (넓은 화면에서 끝없이 늘어서지 않게)
    const sw = Math.min(w - sx - 6, jar.k * 300);
    const shelfY = [h * 0.28, h * 0.5];
    for (const yy of shelfY) {
      ctx.fillStyle = "#e7c9a7";
      roundRect(ctx, sx, yy, sw, Math.max(6, jar.k * 9), 4);
      ctx.fill();
      ctx.fillStyle = "rgba(150,100,60,0.25)";
      ctx.fillRect(sx, yy + Math.max(6, jar.k * 9) - 2, sw, 2);
    }
    const cols = ["#8fd6ff", "#ffe866", "#ffb9a4", "#c9b6f2", "#7fe8c4", "#ff8fc8"];
    let i = 0;
    for (const yy of shelfY) {
      for (let x = sx + jar.k * 22; x < sx + sw - jar.k * 22; x += jar.k * 52) {
        flask(ctx, x, yy, jar.k * (14 + (i % 3) * 3), cols[i % cols.length], i % 2);
        i++;
      }
    }
  }
  // 왼쪽 아래 화분
  const px = jar.cx - jar.w * 0.5 - jar.k * 70;
  if (px > jar.k * 20) {
    const py = fy;
    ctx.fillStyle = "#ff9a8a";
    roundRect(ctx, px - jar.k * 18, py - jar.k * 30, jar.k * 36, jar.k * 30, jar.k * 6);
    ctx.fill();
    for (const [a, l] of [
      [-0.5, 46],
      [0, 58],
      [0.5, 44],
    ]) {
      ctx.save();
      ctx.translate(px, py - jar.k * 28);
      ctx.rotate(a);
      ctx.fillStyle = "#6fd08a";
      ctx.beginPath();
      ctx.ellipse(0, -jar.k * l * 0.5, jar.k * 9, jar.k * l * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
}
function flask(ctx, x, base, s, col, round) {
  ctx.save();
  ctx.translate(x, base);
  ctx.beginPath();
  if (round) {
    ctx.arc(0, -s, s, 0, TAU);
    ctx.rect(-s * 0.3, -s * 2.8, s * 0.6, s * 1.2);
  } else {
    ctx.moveTo(-s * 0.3, -s * 2.6);
    ctx.lineTo(-s * 0.3, -s * 1.6);
    ctx.lineTo(-s, 0);
    ctx.lineTo(s, 0);
    ctx.lineTo(s * 0.3, -s * 1.6);
    ctx.lineTo(s * 0.3, -s * 2.6);
    ctx.closePath();
  }
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, s * 0.1);
  ctx.strokeStyle = "rgba(140,120,190,0.6)";
  ctx.stroke();
  ctx.clip();
  ctx.fillStyle = hexA(col, 0.85);
  ctx.fillRect(-s * 1.2, -s * 1.05, s * 2.4, s * 1.1);
  ctx.restore();
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ================================================================
 * 유리 용기 (뒤 · 앞)
 *  jar: {x0,y0(입구),w,h,k(px/단위)} — 화면 좌표
 * ============================================================== */
export function drawJarBack(ctx, j) {
  const t = j.k * 10;
  // 받침대
  ctx.fillStyle = "#8a7ab8";
  roundRect(ctx, j.x0 - t * 1.6, j.by, j.w + t * 3.2, j.k * 18, j.k * 6);
  ctx.fill();
  ctx.fillStyle = "#a79ad0";
  roundRect(ctx, j.x0 - t * 1.6, j.by, j.w + t * 3.2, j.k * 7, j.k * 4);
  ctx.fill();
  // 유리 안쪽
  const g = ctx.createLinearGradient(j.x0, 0, j.x0 + j.w, 0);
  g.addColorStop(0, "rgba(200,230,255,0.42)");
  g.addColorStop(0.5, "rgba(235,248,255,0.22)");
  g.addColorStop(1, "rgba(200,225,255,0.42)");
  ctx.fillStyle = g;
  roundRect(ctx, j.x0, j.y0, j.w, j.h, j.k * 12);
  ctx.fill();
  // 바닥의 말랑 젤 (살짝)
  const gg = ctx.createLinearGradient(0, j.by - j.k * 40, 0, j.by);
  gg.addColorStop(0, "rgba(180,240,220,0)");
  gg.addColorStop(1, "rgba(150,225,205,0.45)");
  ctx.fillStyle = gg;
  ctx.fillRect(j.x0, j.by - j.k * 40, j.w, j.k * 40);
  // 눈금
  ctx.strokeStyle = "rgba(120,140,200,0.35)";
  ctx.lineWidth = Math.max(1, j.k * 1.5);
  for (let i = 1; i < 10; i++) {
    const y = j.by - (j.h * i) / 10;
    ctx.beginPath();
    ctx.moveTo(j.x0 + j.w - j.k * (i % 5 ? 10 : 20), y);
    ctx.lineTo(j.x0 + j.w, y);
    ctx.stroke();
  }
}
export function drawJarFront(ctx, j, danger, t) {
  const th = Math.max(3, j.k * 9);
  // 유리 벽 (두께)
  ctx.lineWidth = th;
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.moveTo(j.x0 - th / 2, j.y0 - j.k * 8);
  ctx.lineTo(j.x0 - th / 2, j.by - j.k * 12);
  ctx.quadraticCurveTo(j.x0 - th / 2, j.by + th / 2, j.x0 + j.k * 12, j.by + th / 2);
  ctx.lineTo(j.x0 + j.w - j.k * 12, j.by + th / 2);
  ctx.quadraticCurveTo(j.x0 + j.w + th / 2, j.by + th / 2, j.x0 + j.w + th / 2, j.by - j.k * 12);
  ctx.lineTo(j.x0 + j.w + th / 2, j.y0 - j.k * 8);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, j.k * 2.2);
  ctx.strokeStyle = "rgba(120,130,200,0.55)";
  ctx.stroke();
  // 입구 테두리
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const x of [j.x0 - th * 1.5, j.x0 + j.w - th * 0.5]) {
    roundRect(ctx, x, j.y0 - j.k * 12, th * 2, j.k * 10, j.k * 4);
    ctx.fill();
  }
  // 반짝 줄
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  roundRect(ctx, j.x0 + j.k * 10, j.y0 + j.k * 30, j.k * 7, j.h * 0.55, j.k * 4);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  roundRect(ctx, j.x0 + j.k * 22, j.y0 + j.k * 40, j.k * 3, j.h * 0.35, j.k * 2);
  ctx.fill();
  // 위험선
  const dy = j.y0 + JAR.DANGER_Y * j.k;
  const pulse = danger > 0 ? 0.55 + 0.45 * Math.sin(t * 12) : 0;
  ctx.save();
  ctx.setLineDash([j.k * 10, j.k * 8]);
  ctx.lineWidth = Math.max(2, j.k * (danger > 0 ? 3.5 : 2.5));
  ctx.strokeStyle = danger > 0 ? `rgba(255,70,110,${0.55 + pulse * 0.45})` : "rgba(255,110,140,0.45)";
  ctx.beginPath();
  ctx.moveTo(j.x0 + j.k * 4, dy);
  ctx.lineTo(j.x0 + j.w - j.k * 4, dy);
  ctx.stroke();
  ctx.restore();
  // 이름표 (받침대 위 · 슬라임을 가리지 않게)
  const lw = j.k * 110;
  const lx = j.x0 + j.w / 2 - lw / 2;
  const ly = j.by + j.k * 3;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  roundRect(ctx, lx, ly, lw, j.k * 13, j.k * 5);
  ctx.fill();
  ctx.fillStyle = "rgba(110,90,170,0.9)";
  ctx.font = `700 ${Math.max(8, j.k * 10)}px Jua, "Noto Sans KR", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SLIME LAB", j.x0 + j.w / 2, ly + j.k * 7);
}

/** 투하 장치 (레일 · 스포이트) */
export function drawDropper(ctx, j, x, ready) {
  const ry = j.y0 + (JAR.SPAWN_Y - 46) * j.k;
  ctx.fillStyle = "#b9a8e6";
  roundRect(ctx, j.x0 - j.k * 20, ry - j.k * 6, j.w + j.k * 40, j.k * 10, j.k * 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(j.x0 - j.k * 16, ry - j.k * 5, j.w + j.k * 32, Math.max(1, j.k * 2));
  // 집게
  const cx = x;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cx - j.k * 16, ry - j.k * 9, j.k * 32, j.k * 16, j.k * 6);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, j.k * 2);
  ctx.strokeStyle = "#8f7cc8";
  ctx.stroke();
  ctx.fillStyle = ready ? "#7fe8a8" : "#ffb08a";
  ctx.beginPath();
  ctx.arc(cx, ry - j.k * 1, j.k * 3.5, 0, TAU);
  ctx.fill();
  // 스포이트 관
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  roundRect(ctx, cx - j.k * 5, ry + j.k * 6, j.k * 10, j.k * 16, j.k * 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(140,120,200,0.7)";
  ctx.lineWidth = Math.max(1, j.k * 1.5);
  ctx.stroke();
}
