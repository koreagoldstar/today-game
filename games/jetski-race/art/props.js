/*
 * 제트스키 썬더 레이스 — 코스 소품 (부표 · 회전 부표 · 바위 · 통나무 · 드럼통 · 점프대 · 부스터 구슬 · 게이트 · 표지판)
 * 그림 좌표: 1 = 1cm, (0,0) = 물 표면 가운데 (아래가 +y). 스프라이트로 한 번 그려서 재사용한다.
 */
import { TAU, INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, smooth, fill, flat, stroke, gloss, bounce, dot, shadow } from "../../ocean-blaster/art/kit.js?v=3";

/** 회전 표시 대형 풍선 부표 (원뿔형 · 줄무늬 · 로고) */
export function pylon(ctx, o = {}) {
  const c = o.color || "#ff7a1a";
  const c2 = o.color2 || "#ffffff";
  ctx.beginPath();
  ctx.moveTo(-70, 0);
  ctx.bezierCurveTo(-74, -60, -46, -190, -10, -240);
  ctx.quadraticCurveTo(0, -252, 10, -240);
  ctx.bezierCurveTo(46, -190, 74, -60, 70, 0);
  ctx.quadraticCurveTo(0, 16, -70, 0);
  ctx.closePath();
  fill(ctx, c, -22, -130, 70, 130, 3.2);
  ctx.save();
  ctx.clip();
  for (const y of [-70, -150]) {
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.moveTo(-90, y);
    ctx.quadraticCurveTo(0, y + 12, 90, y);
    ctx.lineTo(90, y - 26);
    ctx.quadraticCurveTo(0, y - 14, -90, y - 26);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.font = '26px "Bagel Fat One", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = darken(c, 0.25);
  ctx.fillText("TG", 0, -108);
  gloss(ctx, -28, -150, 14, 46, 0.6, 0.12);
  bounce(ctx, 0, -40, 66, 40, 0.5, 4);
  // 물에 닿는 띠
  ell(ctx, 0, 0, 74, 12);
  stroke(ctx, "rgba(255,255,255,0.8)", 4);
}

/** 레인 로프의 작은 부표 */
export function floatBall(ctx, c) {
  ell(ctx, 0, -10, 18, 13);
  fill(ctx, c, -6, -16, 18, 13, 2.4);
  gloss(ctx, -6, -16, 6, 3, 0.7);
}

/** 바위 (변형 v: 0~1) */
export function rock(ctx, o = {}) {
  const big = o.big;
  const s = big ? 1.9 : 1;
  const v = o.v || 0;
  const c = o.color || "#7b8496";
  ctx.save();
  ctx.scale(s, s);
  const pts = v > 0.5 ? [-95, 6, -98, -40, -70, -100, -20, -128, 30, -112, 62, -150, 96, -84, 104, -20, 96, 8] : [-100, 6, -92, -60, -50, -118, 6, -140, 52, -96, 92, -66, 102, 6];
  smooth(ctx, pts, true, 0.25);
  fill(ctx, c, -30, -80, 100, 110, 3.4);
  // 면 나누기 (각진 느낌)
  ctx.beginPath();
  ctx.moveTo(-50, -110);
  ctx.lineTo(-20, -40);
  ctx.lineTo(-60, 0);
  ctx.moveTo(-20, -40);
  ctx.lineTo(40, -60);
  ctx.lineTo(70, 0);
  stroke(ctx, alpha(darken(c, 0.4), 0.45), 3);
  ctx.beginPath();
  ctx.moveTo(-40, -112);
  ctx.quadraticCurveTo(-10, -126, 10, -132);
  stroke(ctx, alpha(lighten(c, 0.5), 0.6), 5);
  // 젖은 아래쪽 + 이끼
  ctx.save();
  smooth(ctx, pts, true, 0.25);
  ctx.clip();
  ctx.fillStyle = linear(ctx, `rk${c}`, 0, -30, 0, 10, [
    [0, alpha(darken(c, 0.4), 0)],
    [1, alpha(darken(c, 0.55), 0.9)],
  ]);
  ctx.fillRect(-120, -30, 240, 40);
  ctx.fillStyle = alpha("#4caf6e", 0.55);
  for (const [x, y] of [
    [-60, -20],
    [10, -14],
    [60, -24],
  ]) {
    ell(ctx, x, y, 22, 7);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  // 물보라 테두리
  ell(ctx, 0, 2, 104 * s, 13 * s);
  stroke(ctx, "rgba(255,255,255,0.85)", 4);
}

/** 떠다니는 통나무 (가로로 길다) */
export function log(ctx) {
  rrect(ctx, -260, -46, 520, 50, 25);
  fill(ctx, "#9a6a3a", -80, -30, 260, 30, 3);
  // 나이테 끝
  for (const s of [-1, 1]) {
    ell(ctx, s * 252, -21, 18, 25);
    fill(ctx, "#d7a868", s * 252, -21, 18, 25, 2.4);
    ell(ctx, s * 252, -21, 9, 13);
    stroke(ctx, alpha("#8a5a2a", 0.7), 2);
  }
  for (const x of [-150, -40, 80, 180]) {
    ctx.beginPath();
    ctx.moveTo(x, -40);
    ctx.quadraticCurveTo(x + 20, -22, x + 6, -4);
    stroke(ctx, alpha("#5c3a18", 0.55), 2.4);
  }
  // 나뭇가지
  ctx.beginPath();
  ctx.moveTo(60, -44);
  ctx.quadraticCurveTo(80, -90, 110, -96);
  stroke(ctx, "#7a5228", 9);
  ell(ctx, 116, -100, 16, 9, 0.4);
  ctx.fillStyle = "#4caf6e";
  ctx.fill();
  ell(ctx, 0, 4, 270, 12);
  stroke(ctx, "rgba(255,255,255,0.8)", 4);
}

/** 드럼통 (빨강 · 노랑 줄) */
export function barrel(ctx, o = {}) {
  const c = o.color || "#e84a3c";
  rrect(ctx, -46, -110, 92, 112, 14);
  fill(ctx, c, -14, -70, 50, 60, 3);
  for (const y of [-86, -34]) {
    ctx.beginPath();
    ctx.moveTo(-46, y);
    ctx.quadraticCurveTo(0, y + 8, 46, y);
    stroke(ctx, "#ffd23f", 7);
  }
  ell(ctx, 0, -110, 46, 12);
  fill(ctx, lighten(c, 0.2), 0, -110, 46, 12, 2.4);
  ell(ctx, 14, -112, 7, 3);
  ctx.fillStyle = "#3a1d18";
  ctx.fill();
  gloss(ctx, -24, -70, 8, 26, 0.5, 0);
  ell(ctx, 0, 2, 56, 10);
  stroke(ctx, "rgba(255,255,255,0.85)", 4);
}

/** 나무 상자 */
export function crate(ctx) {
  rrect(ctx, -56, -108, 112, 108, 6);
  fill(ctx, "#c8924f", -18, -64, 60, 60, 3);
  ctx.beginPath();
  ctx.moveTo(-50, -100);
  ctx.lineTo(50, -6);
  ctx.moveTo(50, -100);
  ctx.lineTo(-50, -6);
  stroke(ctx, "#8a5a2a", 6);
  rrect(ctx, -56, -108, 112, 108, 6);
  stroke(ctx, "#6b4420", 4);
  ell(ctx, 0, 2, 64, 10);
  stroke(ctx, "rgba(255,255,255,0.8)", 4);
}

/** 점프대 (뒤에서 본 경사면) — 가운데 노란 화살표가 '스위트 스폿' */
export function ramp(ctx, o = {}) {
  const big = o.big;
  const w = big ? 300 : 260;
  const h = big ? 230 : 160;
  // 받침 부력통
  for (const s of [-1, 1]) {
    rrect(ctx, s * w - (s > 0 ? 40 : 0), -36, 40, 40, 14);
    fill(ctx, "#f2f4f8", s * (w - 20), -18, 20, 20, 2.4);
  }
  // 경사면 (멀어질수록 좁고 높다)
  ctx.beginPath();
  ctx.moveTo(-w, -10);
  ctx.lineTo(-w * 0.7, -h);
  ctx.lineTo(w * 0.7, -h);
  ctx.lineTo(w, -10);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `rp${w}`, 0, -h, 0, -10, [
    [0, "#7fd6ff"],
    [1, "#1f7fd6"],
  ]);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#0d4f8a";
  ctx.lineJoin = "round";
  ctx.stroke();
  // 흰 줄무늬
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    const y = -10 - (i + 0.5) * ((h - 10) / 6);
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(-w, y - (h - 10) / 12, w * 2, (h - 10) / 6);
  }
  ctx.restore();
  // 가운데 노란 화살표 (가운데로 타면 PERFECT)
  for (let i = 0; i < 3; i++) {
    const y = -26 - i * ((h - 40) / 3);
    const ww = 70 - i * 10;
    ctx.beginPath();
    ctx.moveTo(-ww, y);
    ctx.lineTo(0, y - 34 + i * 3);
    ctx.lineTo(ww, y);
    ctx.lineTo(ww * 0.6, y + 4);
    ctx.lineTo(0, y - 22 + i * 3);
    ctx.lineTo(-ww * 0.6, y + 4);
    ctx.closePath();
    ctx.fillStyle = "#ffd23f";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#a36a00";
    ctx.stroke();
  }
  // 위 끝 (도약대 가장자리) 줄무늬
  rrect(ctx, -w * 0.72, -h - 12, w * 1.44, 16, 6);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.save();
  rrect(ctx, -w * 0.72, -h - 12, w * 1.44, 16, 6);
  ctx.clip();
  for (let x = -w; x < w; x += 36) {
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath();
    ctx.moveTo(x, -h + 4);
    ctx.lineTo(x + 18, -h - 12);
    ctx.lineTo(x + 30, -h - 12);
    ctx.lineTo(x + 12, -h + 4);
    ctx.fill();
  }
  ctx.restore();
  ell(ctx, 0, -2, w + 30, 14);
  stroke(ctx, "rgba(255,255,255,0.85)", 4);
}

/** 부스터 구슬 (게이지 +1): 번개 무늬 캡슐 — 빛 번짐은 실시간으로 */
export function orb(ctx) {
  circ(ctx, 0, -110, 46);
  ctx.fillStyle = radial(ctx, "orb", -14, -126, 4, 0, -110, 48, [
    [0, "#ffffff"],
    [0.35, "#b9fbff"],
    [0.75, "#36c9ff"],
    [1, "#1676d6"],
  ]);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#0b4f9a";
  ctx.stroke();
  // 번개
  ctx.beginPath();
  ctx.moveTo(6, -142);
  ctx.lineTo(-14, -106);
  ctx.lineTo(2, -106);
  ctx.lineTo(-6, -78);
  ctx.lineTo(16, -118);
  ctx.lineTo(0, -118);
  ctx.closePath();
  ctx.fillStyle = "#ffe14a";
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = "#8a5a00";
  ctx.stroke();
  gloss(ctx, -18, -128, 14, 7, 0.9);
  // 물 위 고리
  ell(ctx, 0, 0, 40, 9);
  stroke(ctx, "rgba(180,250,255,0.9)", 4);
}

/** 지름길 표지판 */
export function signShort(ctx) {
  for (const s of [-1, 1]) {
    rrect(ctx, s * 90 - 8, -260, 16, 260, 6);
    fill(ctx, "#8a6a4a", s * 90, -130, 8, 130, 2.4);
  }
  rrect(ctx, -170, -330, 340, 120, 22);
  fill(ctx, "#ffd23f", -40, -290, 170, 60, 4);
  rrect(ctx, -158, -318, 316, 96, 16);
  stroke(ctx, "#1d2a44", 4);
  ctx.font = '44px "Bagel Fat One", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1d2a44";
  ctx.fillText("SHORTCUT", 10, -286);
  ctx.font = '26px "Jua", sans-serif';
  ctx.fillText("빠르지만 위험!", 10, -246);
  // 번개 + 화살표
  ctx.beginPath();
  ctx.moveTo(-140, -300);
  ctx.lineTo(-128, -270);
  ctx.lineTo(-136, -270);
  ctx.lineTo(-126, -238);
  ctx.lineTo(-150, -276);
  ctx.lineTo(-142, -276);
  ctx.closePath();
  ctx.fillStyle = "#ff4d4d";
  ctx.fill();
  // 물 위 기둥 받침
  for (const s of [-1, 1]) {
    ell(ctx, s * 90, 2, 24, 7);
    stroke(ctx, "rgba(255,255,255,0.85)", 3);
  }
}

/**
 * 게이트 아치 (출발 · 체크 · 결승): 풍선 기둥 두 개 + 현수막
 * span: 기둥 사이 (cm)
 */
export function gate(ctx, kind, span) {
  const half = span / 2;
  const top = -720;
  const c = kind === "finish" ? "#1d2a44" : kind === "start" ? "#ff4d6d" : "#13b5a8";
  // 아치 (휘어진 풍선 튜브)
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  ctx.bezierCurveTo(-half, top * 0.9, -half * 0.6, top * 1.2, 0, top * 1.2);
  ctx.bezierCurveTo(half * 0.6, top * 1.2, half, top * 0.9, half, 0);
  stroke(ctx, lineOf(c), 112);
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  ctx.bezierCurveTo(-half, top * 0.9, -half * 0.6, top * 1.2, 0, top * 1.2);
  ctx.bezierCurveTo(half * 0.6, top * 1.2, half, top * 0.9, half, 0);
  stroke(ctx, c, 100);
  ctx.beginPath();
  ctx.moveTo(-half - 18, -40);
  ctx.bezierCurveTo(-half - 18, top * 0.9, -half * 0.6, top * 1.2 - 24, 0, top * 1.2 - 26);
  stroke(ctx, alpha("#ffffff", 0.35), 18);
  // 현수막
  const bw = span * 0.62;
  const by = top * 1.02;
  rrect(ctx, -bw / 2, by - 70, bw, 150, 18);
  ctx.fillStyle = kind === "finish" ? "#ffffff" : "#ffffff";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = lineOf(c);
  ctx.stroke();
  if (kind === "finish" || kind === "start") {
    // 체크 무늬
    ctx.save();
    rrect(ctx, -bw / 2, by - 70, bw, 150, 18);
    ctx.clip();
    const sq = 30;
    for (let x = -bw / 2; x < bw / 2; x += sq)
      for (let y = by - 70; y < by + 80; y += sq) {
        if ((Math.round((x + bw) / sq) + Math.round((y + 400) / sq)) % 2 === 0) continue;
        ctx.fillStyle = kind === "finish" ? "#1d2a44" : "#ff4d6d";
        ctx.fillRect(x, y, sq, sq);
      }
    ctx.restore();
    rrect(ctx, -bw * 0.36, by - 52, bw * 0.72, 114, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  ctx.font = `${kind === "check" ? 88 : 96}px "Bagel Fat One", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = kind === "finish" ? "#1d2a44" : c;
  ctx.fillText(kind === "finish" ? "FINISH" : kind === "start" ? "START" : "CHECK", 0, by + 6);
  // 기둥 아래 부력통
  for (const s of [-1, 1]) {
    ell(ctx, s * half, -10, 110, 46);
    fill(ctx, "#f2f4f8", s * half - 20, -22, 110, 46, 3);
    ell(ctx, s * half, 6, 130, 18);
    stroke(ctx, "rgba(255,255,255,0.9)", 5);
  }
}

/** 산호 (코스 안 장애물 · 다음 코스용) */
export function coral(ctx, o = {}) {
  const c = o.color || "#ff7a9c";
  for (const [x, h, w] of [
    [-50, 120, 22],
    [-14, 170, 26],
    [26, 140, 22],
    [60, 100, 18],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, 0);
    ctx.quadraticCurveTo(x - w, -h * 0.6, x - w * 0.2, -h);
    ctx.quadraticCurveTo(x + w * 0.4, -h * 1.05, x + w * 0.5, -h * 0.8);
    ctx.quadraticCurveTo(x + w, -h * 0.4, x + w / 2, 0);
    ctx.closePath();
    fill(ctx, c, x, -h * 0.6, w, h * 0.5, 3);
    for (let i = 0; i < 3; i++) dot(ctx, x - 4 + i * 4, -h * (0.3 + i * 0.2), 3, alpha("#ffffff", 0.6));
  }
  ell(ctx, 0, 2, 100, 12);
  stroke(ctx, "rgba(255,255,255,0.8)", 4);
}
