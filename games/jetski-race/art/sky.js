/*
 * 제트스키 썬더 레이스 — 하늘 · 해 · 구름 · 수평선 너머 섬 (테마별, 한 번 그려 캐시)
 * 하늘 그림은 화면 너비의 2배로 만들어 코너를 돌 때 옆으로 흐르게 한다 (패럴랙스).
 */
import { TAU, lighten, darken, alpha, mix } from "../../ocean-blaster/art/kit.js?v=3";
import { seeded } from "../js/view.js?v=2";

/**
 * 하늘 캔버스: w(논리) × hz(논리) 를 px 배율로
 * layer: "sky" (하늘+해+높은 구름) | "far" (수평선 섬 + 낮은 구름: 더 빨리 흐름)
 */
export function buildSky(theme, w, hz, px) {
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w * px);
  cv.height = Math.ceil((hz + 4) * px);
  const ctx = cv.getContext("2d");
  ctx.scale(px, px);
  const T = theme;
  const g = ctx.createLinearGradient(0, 0, 0, hz);
  const n = T.sky.length;
  T.sky.forEach((c, i) => g.addColorStop(i / (n - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, hz + 4);
  const r = seeded(T.seed || 5);
  // 별 (밤)
  if (T.stars) {
    for (let i = 0; i < 160; i++) {
      const x = r() * w;
      const y = r() * hz * 0.85;
      const s = r() < 0.1 ? 1.8 : 0.9;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.6})`;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, TAU);
      ctx.fill();
    }
  }
  // 해 / 달 (두 번 그려 반복 경계에서도 이어지게 — 한 번만 둔다)
  if (T.sun) {
    const sx = w * T.sun.x * 0.5 + w * 0.25;
    const sy = hz * T.sun.y;
    const sr = T.sun.r || 30;
    const glow = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 6);
    glow.addColorStop(0, `rgba(${T.sun.glow},0.75)`);
    glow.addColorStop(0.25, `rgba(${T.sun.glow},0.28)`);
    glow.addColorStop(1, `rgba(${T.sun.glow},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(sx - sr * 6, sy - sr * 6, sr * 12, sr * 12);
    if (T.sun.rays) {
      ctx.save();
      ctx.translate(sx, sy);
      for (let i = 0; i < 14; i++) {
        ctx.rotate(TAU / 14);
        ctx.fillStyle = `rgba(${T.sun.glow},0.07)`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sr * 9, -sr * 0.5);
        ctx.lineTo(sr * 9, sr * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = T.sun.color;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fill();
    if (T.moon) {
      ctx.fillStyle = "rgba(170,180,220,0.35)";
      for (const [dx, dy, rr] of [
        [-8, -6, 7],
        [9, 6, 5],
        [-2, 12, 4],
      ]) {
        ctx.beginPath();
        ctx.arc(sx + dx, sy + dy, rr, 0, TAU);
        ctx.fill();
      }
    }
  }
  // 높은 새털구름
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const x = r() * w;
    const y = hz * (0.08 + r() * 0.3);
    ctx.lineWidth = 3 + r() * 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 60, y - 6, x + 110 + r() * 80, y + 2);
    ctx.stroke();
  }
  // 뭉게구름 (위는 크고 아래로 갈수록 작고 흐릿)
  const cloudCol = T.cloud || ["#ffffff", "#dfe9f7", "#b9c8e2"];
  const nc = T.clouds === "storm" ? 16 : T.clouds === "night" ? 6 : 10;
  for (let i = 0; i < nc; i++) {
    const y = hz * (0.18 + r() * 0.62);
    const depth = y / hz; // 0 위 ~ 1 수평선
    const x = r() * w;
    const s = (1.25 - depth * 0.85) * (T.clouds === "storm" ? 1.6 : 1);
    cumulus(ctx, x, y, s, r, cloudCol, 1 - depth * 0.45);
    // 반복 경계 이어 붙이기
    if (x < 140) cumulus(ctx, x + w, y, s, seeded(i + 99), cloudCol, 1 - depth * 0.45);
    if (x > w - 140) cumulus(ctx, x - w, y, s, seeded(i + 99), cloudCol, 1 - depth * 0.45);
  }
  // 큰 화산 (볼케이노 테마): 수평선 위 어두운 산 + 붉은 분화구 + 연기 기둥
  if (T.bigVolcano) {
    const vx = w * 0.62;
    const vw = 230;
    const vh = 120;
    ctx.fillStyle = "#4a2f3a";
    ctx.beginPath();
    ctx.moveTo(vx - vw, hz + 2);
    ctx.lineTo(vx - 30, hz - vh);
    ctx.lineTo(vx + 26, hz - vh + 4);
    ctx.lineTo(vx + vw, hz + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,120,40,0.75)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      let x = vx - 10 + i * 12;
      ctx.moveTo(x, hz - vh + 6);
      for (let k = 1; k < 6; k++) {
        x += (r() - 0.5) * 18 + (i - 1) * 6;
        ctx.lineTo(x, hz - vh + 6 + k * 20);
      }
      ctx.stroke();
    }
    const cg = ctx.createRadialGradient(vx, hz - vh, 2, vx, hz - vh, 60);
    cg.addColorStop(0, "rgba(255,170,60,0.85)");
    cg.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = cg;
    ctx.fillRect(vx - 60, hz - vh - 60, 120, 120);
    for (let i = 0; i < 14; i++) {
      const sx = vx + Math.sin(i * 0.7) * (6 + i * 4) + i * 6;
      const sy = hz - vh - 20 - i * 18;
      const sr = 18 + i * 5;
      ctx.fillStyle = `rgba(${70 + i * 4},${55 + i * 3},${60 + i * 3},${0.75 - i * 0.04})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TAU);
      ctx.fill();
    }
  }
  // 수평선 아지랑이
  const hzg = ctx.createLinearGradient(0, hz - 40, 0, hz + 2);
  hzg.addColorStop(0, alpha(T.haze, 0));
  hzg.addColorStop(1, alpha(T.haze, 0.85));
  ctx.fillStyle = hzg;
  ctx.fillRect(0, hz - 40, w, 44);
  return cv;
}

function cumulus(ctx, x, y, s, r, col, a) {
  ctx.save();
  ctx.globalAlpha = a;
  const parts = 6 + Math.floor(r() * 4);
  const blobs = [];
  for (let i = 0; i < parts; i++) {
    const bx = (i - parts / 2) * 18 * s + (r() - 0.5) * 10 * s;
    const by = -Math.sin((i / (parts - 1)) * Math.PI) * 18 * s - r() * 8 * s;
    const br = (16 + r() * 14) * s;
    blobs.push([bx, by, br]);
  }
  // 아래 그늘
  ctx.fillStyle = col[2];
  for (const [bx, by, br] of blobs) {
    ctx.beginPath();
    ctx.arc(x + bx, y + by + br * 0.25, br, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = col[1];
  for (const [bx, by, br] of blobs) {
    ctx.beginPath();
    ctx.arc(x + bx, y + by + br * 0.05, br * 0.95, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = col[0];
  for (const [bx, by, br] of blobs) {
    ctx.beginPath();
    ctx.arc(x + bx - br * 0.12, y + by - br * 0.12, br * 0.8, 0, TAU);
    ctx.fill();
  }
  // 평평한 바닥
  ctx.fillStyle = col[2];
  ctx.fillRect(x - parts * 9 * s - 10 * s, y + 10 * s, parts * 18 * s + 20 * s, 3 * s);
  ctx.restore();
}

/** 수평선 너머 섬 띠 (낮은 층 · 하늘보다 빠르게 흐름) */
export function buildFar(theme, w, h, px) {
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w * px);
  cv.height = Math.ceil(h * px);
  const ctx = cv.getContext("2d");
  ctx.scale(px, px);
  const T = theme;
  const r = seeded((T.seed || 5) + 31);
  const base = h;
  const kind = T.horizon;
  const far = T.farLand || ["#7fb7b0", "#5f9f97"];
  // 멀리 있는 섬들 (두 겹: 더 먼 것은 흐릿)
  for (let layer = 0; layer < 2; layer++) {
    const col = mix(far[layer], T.haze, layer === 0 ? 0.55 : 0.25);
    const n = layer === 0 ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const x = r() * w;
      const ww = 60 + r() * 140;
      const hh = (kind === "volcano" && i === 1 && layer === 1 ? 70 : 10 + r() * (kind === "ice" ? 30 : 26)) * (layer === 0 ? 0.7 : 1);
      for (const dx of [0, -w, w]) island(ctx, x + dx, base, ww, hh, col, kind, r, layer);
    }
  }
  return cv;
}

function island(ctx, x, base, w, h, col, kind, r, layer) {
  ctx.fillStyle = col;
  ctx.beginPath();
  if (kind === "town") {
    // 항구 마을: 지붕 집들 + 등대 + 돛대
    let x0 = x - w / 2;
    ctx.moveTo(x0, base);
    while (x0 < x + w / 2) {
      const hw = 6 + r() * 8;
      const hh = 6 + r() * 12;
      ctx.lineTo(x0, base - hh);
      ctx.lineTo(x0 + hw / 2, base - hh - 5);
      ctx.lineTo(x0 + hw, base - hh);
      x0 += hw;
    }
    ctx.lineTo(x + w / 2, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x + w * 0.3, base - 40, 4, 40);
    ctx.fillRect(x - w * 0.2, base - 34, 1.5, 34);
    ctx.fillRect(x - w * 0.1, base - 28, 1.5, 28);
    return;
  }
  if (kind === "atolls") {
    ctx.moveTo(x - w / 2, base);
    ctx.quadraticCurveTo(x, base - h * 0.35, x + w / 2, base);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const px = x - w * 0.25 + i * w * 0.22;
      ctx.fillRect(px, base - h * 0.3 - 9, 1.2, 9);
      ctx.beginPath();
      ctx.arc(px, base - h * 0.3 - 10, 3.5, 0, TAU);
      ctx.fill();
    }
    return;
  }
  if (kind === "ice") {
    ctx.moveTo(x - w / 2, base);
    ctx.lineTo(x - w * 0.3, base - h * 0.7);
    ctx.lineTo(x - w * 0.1, base - h);
    ctx.lineTo(x + w * 0.15, base - h * 0.8);
    ctx.lineTo(x + w * 0.35, base - h * 0.9);
    ctx.lineTo(x + w / 2, base);
  } else if (kind === "volcano" && h > 50) {
    ctx.moveTo(x - w, base);
    ctx.lineTo(x - w * 0.12, base - h);
    ctx.lineTo(x + w * 0.1, base - h);
    ctx.lineTo(x + w, base);
  } else {
    ctx.moveTo(x - w / 2, base);
    ctx.bezierCurveTo(x - w * 0.35, base - h * 0.9, x - w * 0.05, base - h * 1.1, x + w * 0.12, base - h * 0.85);
    ctx.bezierCurveTo(x + w * 0.3, base - h * 0.7, x + w * 0.4, base - h * 0.4, x + w / 2, base);
  }
  ctx.closePath();
  ctx.fill();
  // 실루엣 야자수 몇 그루
  if ((kind === "islands" || kind === "palms" || kind === "cliffs") && layer === 1 && r() < 0.6) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const px = x - w * 0.2 + i * w * 0.16;
      const py = base - h * 0.8;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + 2, py - 8, px + 3, py - 14);
      ctx.stroke();
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(px + 3, py - 14);
        ctx.quadraticCurveTo(px + 3 + (k - 1.5) * 4, py - 18, px + 3 + (k - 1.5) * 7, py - 12);
        ctx.stroke();
      }
    }
  }
}

/** 갈매기 (실시간) */
export function gull(ctx, x, y, s, flap) {
  ctx.strokeStyle = "rgba(40,60,90,0.75)";
  ctx.lineWidth = 1.6 * s;
  ctx.lineCap = "round";
  const f = Math.sin(flap) * 4 * s;
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y - f);
  ctx.quadraticCurveTo(x - 4 * s, y - 4 * s - f * 0.4, x, y);
  ctx.quadraticCurveTo(x + 4 * s, y - 4 * s - f * 0.4, x + 9 * s, y - f);
  ctx.stroke();
}
