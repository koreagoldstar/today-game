/*
 * 🌊 바다 물총 대작전 — 아트 키트 (모든 그림이 같은 '빛'과 '선'을 쓰도록)
 *
 * 아트 디렉션
 *  - 빛: 왼쪽 위의 따뜻한 햇빛 + 아래에서 올라오는 바다 반사광(청록 림라이트)
 *  - 선: 검정이 아니라 '그 색의 진한 색'으로 부드러운 외곽선
 *  - 면: 평평한 색 금지 — 모든 큰 면은 빛 그라데이션 + 하이라이트
 * 그라데이션은 '그림 좌표'로 만들어 캐시한다. 캔버스 변환(위치 · 크기)이 바뀌어도 그대로 재사용된다.
 */
export const TAU = Math.PI * 2;
export const INK = "#1d2a44";

/* ---------------- 색 ---------------- */
const RGB = new Map();
export function rgb(hex) {
  let v = RGB.get(hex);
  if (v) return v;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  RGB.set(hex, v);
  return v;
}
const hx = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
const MIX = new Map();
export function mix(a, b, t) {
  const k = `${a}${b}${t}`;
  let v = MIX.get(k);
  if (v) return v;
  const A = rgb(a);
  const B = rgb(b);
  v = `#${hx(A[0] + (B[0] - A[0]) * t)}${hx(A[1] + (B[1] - A[1]) * t)}${hx(A[2] + (B[2] - A[2]) * t)}`;
  MIX.set(k, v);
  return v;
}
export const lighten = (c, t) => mix(c, "#ffffff", t);
export const darken = (c, t) => mix(c, "#141a3a", t);
export const warm = (c, t) => mix(c, "#fff1c4", t);
export function alpha(c, a) {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
}
export const lineOf = (c) => mix(darken(c, 0.62), INK, 0.3);

/* ---------------- 그라데이션 캐시 (컨텍스트별) ---------------- */
const STORE = new WeakMap();
function store(ctx) {
  let m = STORE.get(ctx);
  if (!m) {
    m = new Map();
    STORE.set(ctx, m);
  }
  return m;
}
export function radial(ctx, key, x0, y0, r0, x1, y1, r1, stops) {
  const m = store(ctx);
  let g = m.get(key);
  if (!g) {
    g = ctx.createRadialGradient(x0, y0, Math.max(0, r0), x1, y1, Math.max(0.01, r1));
    for (const [o, c] of stops) g.addColorStop(o, c);
    m.set(key, g);
  }
  return g;
}
export function linear(ctx, key, x0, y0, x1, y1, stops) {
  const m = store(ctx);
  let g = m.get(key);
  if (!g) {
    g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    m.set(key, g);
  }
  return g;
}

/** 빛 받은 둥근 몸: 왼쪽 위가 밝고 오른쪽 아래가 어둡다 */
export function lit(ctx, base, x, y, rx, ry = rx, power = 1) {
  return radial(ctx, `lit${base}|${x}|${y}|${rx}|${ry}|${power}`, x - rx * 0.38, y - ry * 0.46, 0, x + rx * 0.05, y + ry * 0.05, Math.max(rx, ry) * 1.12, [
    [0, lighten(warm(base, 0.18 * power), 0.34 * power)],
    [0.35, lighten(base, 0.1 * power)],
    [0.72, base],
    [1, darken(base, 0.3 * power)],
  ]);
}
/** 위→아래 세로 그라데이션 (지느러미 · 팔다리) */
export function vlit(ctx, base, y0, y1) {
  return linear(ctx, `v${base}|${y0}|${y1}`, 0, y0, 0, y1, [
    [0, lighten(base, 0.22)],
    [0.55, base],
    [1, darken(base, 0.24)],
  ]);
}
export function hlit(ctx, base, x0, x1) {
  return linear(ctx, `h${base}|${x0}|${x1}`, x0, 0, x1, 0, [
    [0, lighten(base, 0.2)],
    [0.5, base],
    [1, darken(base, 0.22)],
  ]);
}

/* ---------------- 모양 ---------------- */
export function ell(ctx, x, y, rx, ry = rx, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}
export function circ(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
}
export function rrect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
/** 점들을 부드럽게 잇는 닫힌(또는 열린) 곡선 — Catmull-Rom */
export function smooth(ctx, pts, closed = true, t = 0.5) {
  const n = pts.length / 2;
  ctx.beginPath();
  const P = (i) => {
    const k = closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
    return [pts[k * 2], pts[k * 2 + 1]];
  };
  const [sx, sy] = P(0);
  ctx.moveTo(sx, sy);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [x0, y0] = P(i - 1);
    const [x1, y1] = P(i);
    const [x2, y2] = P(i + 1);
    const [x3, y3] = P(i + 2);
    ctx.bezierCurveTo(x1 + ((x2 - x0) / 6) * t * 2, y1 + ((y2 - y0) / 6) * t * 2, x2 - ((x3 - x1) / 6) * t * 2, y2 - ((y3 - y1) / 6) * t * 2, x2, y2);
  }
  if (closed) ctx.closePath();
}

/* ---------------- 칠하기 ---------------- */
/** 지금 경로를 빛 그라데이션으로 칠하고 부드러운 외곽선 */
export function fill(ctx, base, x, y, rx, ry = rx, lw = 3, power = 1) {
  ctx.fillStyle = lit(ctx, base, x, y, rx, ry, power);
  ctx.fill();
  if (lw > 0) {
    ctx.lineJoin = "round";
    ctx.lineWidth = lw;
    ctx.strokeStyle = lineOf(base);
    ctx.stroke();
  }
}
export function flat(ctx, color, lw = 0, line) {
  ctx.fillStyle = color;
  ctx.fill();
  if (lw > 0) {
    ctx.lineJoin = "round";
    ctx.lineWidth = lw;
    ctx.strokeStyle = line || lineOf(color);
    ctx.stroke();
  }
}
export function stroke(ctx, color, lw, cap = "round") {
  ctx.lineCap = cap;
  ctx.lineJoin = "round";
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.stroke();
}
/** 반짝이는 하이라이트 (가장자리가 부드럽게 사라짐) */
export function gloss(ctx, x, y, rx, ry, a = 0.6, rot = -0.45) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, `gl${rx}|${a}`, 0, 0, 0, 0, 0, rx, [
    [0, `rgba(255,255,255,${a})`],
    [0.55, `rgba(255,255,255,${a * 0.55})`],
    [1, "rgba(255,255,255,0)"],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}
/** 바다 반사광 — 몸 아래쪽 안쪽 가장자리를 따라 청록 빛 */
export function bounce(ctx, x, y, rx, ry, a = 0.55, w) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.86, ry * 0.84, 0, 0.18 * Math.PI, 0.82 * Math.PI);
  ctx.lineCap = "round";
  ctx.lineWidth = w || Math.max(1.5, ry * 0.13);
  ctx.strokeStyle = `rgba(150,240,255,${a})`;
  ctx.stroke();
}
export function dot(ctx, x, y, r, c = "#ffffff") {
  circ(ctx, x, y, r);
  ctx.fillStyle = c;
  ctx.fill();
}
/** 부드러운 그림자 (물 위 · 갑판 위) */
export function shadow(ctx, x, y, rx, ry, a = 0.3, color = "6,30,60") {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, `sh${rx}|${a}|${color}`, 0, 0, 0, 0, 0, rx, [
    [0, `rgba(${color},${a})`],
    [0.6, `rgba(${color},${a * 0.6})`],
    [1, `rgba(${color},0)`],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ---------------- 얼굴 ---------------- */
/**
 * 눈 — 반짝이는 홍채 + 두 개의 하이라이트 + 윗눈꺼풀 선
 * opt: { iris, look(-1~1), lid(0~1 덮임), lash, squint, noBlink, white }
 */
export function eye(ctx, x, y, r, p, opt = {}) {
  const ink = opt.ink || INK;
  if (p.dizzy) {
    ctx.beginPath();
    for (let i = 0; i < 28; i++) {
      const a = i * 0.55 + (p.now || 0) * 10;
      const rr = (i / 28) * r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    stroke(ctx, ink, Math.max(1.6, r * 0.2));
    return;
  }
  if (p.soaked || p.hit > 0.45 || opt.squint) {
    // 질끈 감은 눈 (><)
    const s = opt.side || 1;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.75 * s, y - r * 0.62);
    ctx.quadraticCurveTo(x + r * 0.2 * s, y - r * 0.1, x + r * 0.6 * s, y);
    ctx.quadraticCurveTo(x + r * 0.2 * s, y + r * 0.1, x - r * 0.75 * s, y + r * 0.62);
    stroke(ctx, ink, Math.max(1.8, r * 0.26));
    return;
  }
  if (opt.happy) {
    ctx.beginPath();
    ctx.arc(x, y + r * 0.35, r * 0.78, 1.15 * Math.PI, 1.85 * Math.PI);
    stroke(ctx, ink, Math.max(1.8, r * 0.26));
    return;
  }
  if (p.blink && !opt.noBlink) {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.15, r * 0.82, 0.12 * Math.PI, 0.88 * Math.PI);
    stroke(ctx, ink, Math.max(1.6, r * 0.22));
    if (opt.lash) {
      ctx.beginPath();
      ctx.moveTo(x + r * 0.78, y + r * 0.2);
      ctx.lineTo(x + r * 1.05, y + r * 0.02);
      stroke(ctx, ink, Math.max(1.2, r * 0.14));
    }
    return;
  }
  const rx = r * (opt.wide || 0.9);
  // 흰자
  ell(ctx, x, y, rx, r);
  ctx.fillStyle = radial(ctx, `ew${r}|${x}|${y}`, x - r * 0.2, y - r * 0.4, 0, x, y, r * 1.1, [
    [0, "#ffffff"],
    [0.7, "#f4f8ff"],
    [1, "#d5e1f2"],
  ]);
  ctx.fill();
  // 홍채
  const iris = opt.iris || "#2f6fd6";
  const lk = opt.look == null ? 0.18 : opt.look;
  const ix = x + rx * lk * 0.42;
  const iy = y + r * (opt.lookY == null ? 0.1 : opt.lookY);
  const ir = r * (opt.irisR || 0.64);
  ctx.save();
  ell(ctx, x, y, rx, r);
  ctx.clip();
  circ(ctx, ix, iy, ir);
  ctx.fillStyle = radial(ctx, `ei${iris}|${ir}|${ix}|${iy}`, ix, iy + ir * 0.45, 0, ix, iy, ir, [
    [0, lighten(iris, 0.45)],
    [0.55, iris],
    [1, darken(iris, 0.45)],
  ]);
  ctx.fill();
  circ(ctx, ix, iy, ir * 0.5);
  ctx.fillStyle = "#0c1230";
  ctx.fill();
  // 윗부분 그늘
  ctx.fillStyle = "rgba(20,30,70,0.16)";
  ctx.fillRect(x - rx, y - r, rx * 2, r * 0.5);
  ctx.restore();
  dot(ctx, ix - ir * 0.36, iy - ir * 0.42, ir * 0.34, "#ffffff");
  dot(ctx, ix + ir * 0.34, iy + ir * 0.34, ir * 0.15, "rgba(255,255,255,0.85)");
  // 외곽 + 윗눈꺼풀
  ell(ctx, x, y, rx, r);
  stroke(ctx, ink, Math.max(1.2, r * 0.13));
  ctx.beginPath();
  ctx.ellipse(x, y, rx, r, 0, 1.08 * Math.PI, 1.92 * Math.PI);
  stroke(ctx, ink, Math.max(1.8, r * 0.24));
  if (opt.lash) {
    ctx.beginPath();
    ctx.moveTo(x + rx * 0.82, y - r * 0.5);
    ctx.lineTo(x + rx * 1.12, y - r * 0.75);
    stroke(ctx, ink, Math.max(1.2, r * 0.14));
  }
  if (opt.lid) {
    ctx.save();
    ell(ctx, x, y, rx + 1, r + 1);
    ctx.clip();
    ctx.fillStyle = opt.lidColor || "#999";
    ctx.fillRect(x - rx - 2, y - r - 2, rx * 2 + 4, r * 2 * opt.lid);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(x - rx, y - r + r * 2 * opt.lid);
    ctx.lineTo(x + rx, y - r + r * 2 * opt.lid);
    stroke(ctx, ink, Math.max(1.6, r * 0.2));
  }
}

export function brow(ctx, x, y, w, tilt = 0, lw = 3, color = INK) {
  ctx.beginPath();
  ctx.moveTo(x - w, y + tilt);
  ctx.quadraticCurveTo(x, y - w * 0.35, x + w, y - tilt);
  stroke(ctx, color, lw);
}

/** 입: smile | open | grin | o | pout | flat · 젖으면 '오~' */
export function mouth(ctx, x, y, w, p, kind = "smile", ink = INK) {
  if (p.soaked && kind !== "none") kind = "o";
  switch (kind) {
    case "open": {
      ctx.beginPath();
      ctx.moveTo(x - w, y - w * 0.15);
      ctx.quadraticCurveTo(x, y - w * 0.05, x + w, y - w * 0.15);
      ctx.quadraticCurveTo(x + w * 0.8, y + w * 0.95, x, y + w * 0.95);
      ctx.quadraticCurveTo(x - w * 0.8, y + w * 0.95, x - w, y - w * 0.15);
      ctx.closePath();
      flat(ctx, "#7c2140", Math.max(1.4, w * 0.16), ink);
      ctx.save();
      ctx.clip();
      ell(ctx, x + w * 0.1, y + w * 0.85, w * 0.62, w * 0.42);
      ctx.fillStyle = "#ff8aa5";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - w, y - w * 0.3, w * 2, w * 0.32);
      ctx.restore();
      break;
    }
    case "grin": {
      ctx.beginPath();
      ctx.moveTo(x - w, y - w * 0.1);
      ctx.quadraticCurveTo(x, y + w * 1.05, x + w, y - w * 0.1);
      ctx.closePath();
      flat(ctx, "#ffffff", Math.max(1.4, w * 0.16), ink);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.82, y + w * 0.12);
      ctx.quadraticCurveTo(x, y + w * 0.42, x + w * 0.82, y + w * 0.12);
      stroke(ctx, alpha(ink, 0.5), Math.max(1, w * 0.1));
      break;
    }
    case "o":
      ell(ctx, x, y + w * 0.2, w * 0.42, w * 0.52);
      flat(ctx, "#7c2140", Math.max(1.4, w * 0.15), ink);
      ell(ctx, x, y + w * 0.45, w * 0.24, w * 0.16);
      ctx.fillStyle = "#ff8aa5";
      ctx.fill();
      break;
    case "pout":
      ell(ctx, x, y, w * 0.42, w * 0.32);
      flat(ctx, "#ff8aa5", Math.max(1.3, w * 0.14), ink);
      break;
    case "flat":
      ctx.beginPath();
      ctx.moveTo(x - w * 0.6, y);
      ctx.lineTo(x + w * 0.6, y);
      stroke(ctx, ink, Math.max(1.4, w * 0.18));
      break;
    case "none":
      break;
    default:
      ctx.beginPath();
      ctx.moveTo(x - w, y - w * 0.18);
      ctx.quadraticCurveTo(x, y + w * 0.62, x + w, y - w * 0.18);
      stroke(ctx, ink, Math.max(1.4, w * 0.2));
  }
}

export function blush(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.62);
  ctx.fillStyle = radial(ctx, `bl${r}`, 0, 0, 0, 0, 0, r, [
    [0, "rgba(255,110,150,0.62)"],
    [1, "rgba(255,110,150,0)"],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function star(ctx, x, y, r, color = "#ffe066", rot = 0, line = "#c98a00") {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.48 : r;
    const a = (i / 10) * TAU - Math.PI / 2 + rot;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (line) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.strokeStyle = line;
    ctx.stroke();
  }
}

export function sparkle(ctx, x, y, r, a = 1, color = "255,255,240") {
  ctx.fillStyle = `rgba(${color},${a})`;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  ctx.fill();
}

export function dizzyStars(ctx, now, y, r = 26, s = 1) {
  for (let i = 0; i < 3; i++) {
    const a = now * 5 + (i / 3) * TAU;
    star(ctx, Math.cos(a) * r, y + Math.sin(a) * r * 0.35, 6 * s, "#ffe45c", a);
  }
}

/** 젖은 친구 머리 위로 떨어지는 물방울 */
export function wetDrops(ctx, p, y, w) {
  if (!p.wet || p.soaked) return;
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * w * 0.5;
    const yy = y + ((p.t * 40 + i * 13) % 18);
    drop(ctx, x, yy, 4.5);
  }
}
export function drop(ctx, x, y, r, c = "#bfeeff") {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.6);
  ctx.quadraticCurveTo(x + r, y - r * 0.2, x + r, y + r * 0.2);
  ctx.arc(x, y + r * 0.2, r, 0, Math.PI);
  ctx.quadraticCurveTo(x - r, y - r * 0.2, x, y - r * 1.6);
  ctx.fillStyle = c;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.25);
  ctx.strokeStyle = "rgba(40,120,180,0.6)";
  ctx.stroke();
  dot(ctx, x - r * 0.3, y, r * 0.28, "#ffffff");
}

/* ---------------- 소품 ---------------- */
/** 해적 모자 (해골 대신 물방울 문장) */
export function pirateHat(ctx, x, y, s = 1, color = "#2b2d4a", rot = 0, trim = "#ffcf4d") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-30, 6);
  ctx.quadraticCurveTo(-26, -10, -18, -18);
  ctx.quadraticCurveTo(-8, -30, 0, -28);
  ctx.quadraticCurveTo(8, -30, 18, -18);
  ctx.quadraticCurveTo(26, -10, 30, 6);
  ctx.quadraticCurveTo(0, -4, -30, 6);
  ctx.closePath();
  fill(ctx, color, 0, -12, 30, 18, 2.6);
  ctx.beginPath();
  ctx.moveTo(-28, 4);
  ctx.quadraticCurveTo(0, -6, 28, 4);
  stroke(ctx, trim, 3.2);
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.quadraticCurveTo(6, -14, 4.5, -11);
  ctx.arc(0, -12, 4.5, 0, Math.PI);
  ctx.quadraticCurveTo(-6, -14, 0, -22);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  gloss(ctx, -12, -16, 8, 3, 0.35);
  ctx.restore();
}

export function eyepatch(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  ctx.moveTo(x - r * 1.9, y - r * 1.3 + rot * 10);
  ctx.lineTo(x + r * 1.9, y - r * 0.1 - rot * 10);
  stroke(ctx, "#1c1c28", Math.max(1.4, r * 0.28));
  ell(ctx, x, y, r * 0.98, r * 0.86);
  ctx.fillStyle = linear(ctx, `ep${r}|${x}|${y}`, 0, y - r, 0, y + r, [
    [0, "#3a3b4f"],
    [1, "#15151f"],
  ]);
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.strokeStyle = "#0d0d16";
  ctx.stroke();
  gloss(ctx, x - r * 0.3, y - r * 0.35, r * 0.4, r * 0.2, 0.35);
}

/** 굵은 팔다리 · 촉수: 외곽선 + 빛 받은 안쪽 + 하이라이트 줄 */
export function limb(ctx, pts, w, color, opts = {}) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    if (pts.length === 6) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
    else if (pts.length === 8) ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    else for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  path();
  ctx.lineWidth = w + (opts.line == null ? 5 : opts.line);
  ctx.strokeStyle = lineOf(color);
  ctx.stroke();
  path();
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
  if (opts.shade !== false) {
    ctx.save();
    ctx.translate(w * 0.12, w * 0.18);
    path();
    ctx.lineWidth = w * 0.45;
    ctx.strokeStyle = alpha(darken(color, 0.35), 0.45);
    ctx.stroke();
    ctx.restore();
  }
  if (opts.hi !== false) {
    ctx.save();
    ctx.translate(-w * 0.16, -w * 0.2);
    path();
    ctx.lineWidth = w * 0.22;
    ctx.strokeStyle = alpha(lighten(color, 0.6), 0.55);
    ctx.stroke();
    ctx.restore();
  }
}

/** 지느러미 (반투명 막 + 살대) */
export function fin(ctx, pts, color, ribs = 3) {
  smooth(ctx, pts, true, 0.4);
  ctx.fillStyle = alpha(color, 0.88);
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = lineOf(color);
  ctx.lineJoin = "round";
  ctx.stroke();
  if (ribs) {
    const x0 = pts[0];
    const y0 = pts[1];
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = alpha(darken(color, 0.35), 0.55);
    for (let i = 1; i <= ribs; i++) {
      const k = 2 + Math.floor(((pts.length / 2 - 2) * i) / (ribs + 1)) * 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (pts[k] - x0) * 0.85, y0 + (pts[k + 1] - y0) * 0.85);
      ctx.stroke();
    }
  }
}
