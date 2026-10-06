/*
 * 제트스키 썬더 레이스 — 제트스키 + 레이서 (뒷모습, 게임 중)
 *
 * 그림 좌표: 1 = 1cm. (0,0) = 선체 아래 물 표면, 위가 -y.
 * 바다 물총 대작전과 같은 빛 규칙: 왼쪽 위 햇빛 + 아래 청록 반사광, 외곽선은 그 색의 진한 색.
 *
 * pose = { t, yaw(-1~1: + 오른쪽으로 꺾음 → 왼쪽 옆면이 보임), roll(라디안), lean, crouch(0~1),
 *          boost(0~1), spin(공중 회전), speed(0~1), crash(0~1), wave(손 흔들기 0~1) }
 */
import { TAU, INK, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, smooth, fill, flat, stroke, gloss, bounce, dot, shadow, limb, blush, eye, mouth, brow, pirateHat } from "../../ocean-blaster/art/kit.js?v=3";

/* 선체 모양 (뒤에서 본 폭 · 높이) */
const HULLS = {
  sport: { w: 118, h: 48, nose: 0.2, deckLen: 66, seat: 46, round: 0.5 },
  blade: { w: 104, h: 44, nose: 0.12, deckLen: 72, seat: 40, round: 0.3 },
  bubble: { w: 120, h: 52, nose: 0.28, deckLen: 60, seat: 48, round: 1 },
  barge: { w: 132, h: 50, nose: 0.32, deckLen: 62, seat: 50, round: 0.15 },
  stand: { w: 84, h: 42, nose: 0.2, deckLen: 74, seat: 0, round: 0.4 },
};

export function hullInfo(kind) {
  return HULLS[kind] || HULLS.sport;
}

/** 뒤판(트랜섬) 외곽선 */
function transomPath(ctx, hb) {
  const w = hb.w / 2;
  const h = hb.h;
  const r = hb.round;
  ctx.beginPath();
  ctx.moveTo(-w, -h);
  ctx.bezierCurveTo(-w - 3, -h * 0.55, -w + 4 - r * 4, -h * 0.12, -w + 10 + r * 4, 2);
  ctx.quadraticCurveTo(-w * 0.55, 9, -w * 0.32, 9);
  ctx.lineTo(w * 0.32, 9);
  ctx.quadraticCurveTo(w * 0.55, 9, w - 10 - r * 4, 2);
  ctx.bezierCurveTo(w - 4 + r * 4, -h * 0.12, w + 3, -h * 0.55, w, -h);
  ctx.quadraticCurveTo(0, -h - 6 - r * 4, -w, -h);
  ctx.closePath();
}

/** 갑판(위에서 비스듬히 보이는 윗면) — 앞(코)으로 갈수록 좁아진다 */
function deckPath(ctx, hb, sk) {
  const w = hb.w / 2;
  const h = hb.h;
  const top = -h - hb.deckLen;
  const nw = hb.w * hb.nose;
  ctx.beginPath();
  ctx.moveTo(-w, -h);
  ctx.bezierCurveTo(-w + 2, -h - hb.deckLen * 0.5, -nw - 10 + sk * 0.5, top + 14, -nw + sk, top + 4);
  ctx.quadraticCurveTo(sk, top - 8, nw + sk, top + 4);
  ctx.bezierCurveTo(nw + 10 + sk * 0.5, top + 14, w - 2, -h - hb.deckLen * 0.5, w, -h);
  ctx.quadraticCurveTo(0, -h - 6 - hb.round * 4, -w, -h);
  ctx.closePath();
}

/* ================================================================
 * 제트스키 + 레이서
 * ============================================================== */
export function drawRacer(ctx, R, pose) {
  const hb = hullInfo(R.hull);
  const t = pose.t || 0;
  const yaw = pose.yaw || 0;
  const sk = yaw * 26; // 앞쪽이 꺾이는 방향으로 기운다
  ctx.save();
  // 공중 회전(배럴 롤) · 기울기
  ctx.translate(0, -30);
  ctx.rotate((pose.roll || 0) + (pose.spin || 0));
  ctx.translate(0, 30);

  // ---- 옆면 (꺾을 때 반대쪽 옆구리가 보인다) ----
  if (Math.abs(yaw) > 0.04) drawFlank(ctx, R, hb, yaw);

  // ---- 갑판 · 앞 덮개 · 핸들 ----
  deckPath(ctx, hb, sk);
  ctx.fillStyle = linear(ctx, `deck${R.id}|${R.body}`, 0, -hb.h - hb.deckLen, 0, -hb.h, [
    [0, lighten(R.body, 0.08)],
    [0.55, lighten(R.body, 0.28)],
    [1, lighten(R.body, 0.12)],
  ]);
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = lineOf(R.body);
  ctx.stroke();
  drawDeckDetail(ctx, R, hb, sk, t, pose);

  // ---- 뒤판 (번호판 · 노즐 · 후미등) ----
  transomPath(ctx, hb);
  fill(ctx, R.body, -hb.w * 0.18, -hb.h * 0.55, hb.w * 0.62, hb.h * 0.8, 3.2);
  drawTransomDetail(ctx, R, hb, t, pose);

  // ---- 레이서 ----
  ctx.save();
  const lean = pose.lean || 0;
  const cr = pose.crouch || 0;
  ctx.translate(sk * 0.25, -hb.h - 14);
  ctx.rotate(lean);
  ctx.scale(1, 1 - cr * 0.1);
  drawRider(ctx, R, hb, pose, sk);
  ctx.restore();
  ctx.restore();
}

/** 꺾을 때 보이는 옆구리 (번호 · 줄무늬) */
function drawFlank(ctx, R, hb, yaw) {
  const sd = yaw > 0 ? -1 : 1; // 오른쪽으로 꺾으면 왼쪽 옆면
  const a = Math.min(1, Math.abs(yaw));
  const w = hb.w / 2;
  const h = hb.h;
  const reach = 34 * a; // 옆면이 바깥으로 보이는 폭
  const fwd = 18 * a;
  ctx.save();
  ctx.scale(sd, 1);
  ctx.beginPath();
  ctx.moveTo(w, -h);
  ctx.bezierCurveTo(w + 3, -h * 0.55, w - 4, -h * 0.12, w - 10, 2);
  ctx.lineTo(w - 10 + reach * 0.4, 2 - fwd * 0.6);
  ctx.bezierCurveTo(w + reach * 0.7, -h * 0.2 - fwd, w + reach, -h * 0.6 - fwd, w + reach * 0.8, -h - fwd - 6);
  ctx.closePath();
  ctx.fillStyle = darken(R.body, 0.16);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = lineOf(R.body);
  ctx.stroke();
  // 줄무늬
  ctx.beginPath();
  ctx.moveTo(w - 4, -h * 0.55);
  ctx.lineTo(w + reach * 0.82, -h * 0.62 - fwd * 0.9);
  stroke(ctx, alpha(R.trim, 0.95), 5);
  ctx.restore();
}

function drawDeckDetail(ctx, R, hb, sk, t, pose) {
  const w = hb.w / 2;
  const h = hb.h;
  const top = -h - hb.deckLen;
  // 레이싱 줄무늬 두 줄 (앞으로 모인다)
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * w * 0.5, -h - 2);
    ctx.quadraticCurveTo(s * w * 0.42 + sk * 0.3, -h - hb.deckLen * 0.5, s * hb.w * hb.nose * 0.55 + sk, top + 8);
    stroke(ctx, R.trim, 7);
    ctx.beginPath();
    ctx.moveTo(s * w * 0.5 - s * 2, -h - 2);
    ctx.quadraticCurveTo(s * w * 0.42 + sk * 0.3 - s * 2, -h - hb.deckLen * 0.5, s * hb.w * hb.nose * 0.55 + sk - s, top + 8);
    stroke(ctx, alpha("#ffffff", 0.35), 2);
  }
  // 발판 (미끄럼 방지 매트)
  if (R.hull !== "stand") {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * (w - 8), -h - 3);
      ctx.lineTo(s * (w * 0.46), -h - 3);
      ctx.lineTo(s * (w * 0.4) + sk * 0.45, -h - hb.deckLen * 0.62);
      ctx.lineTo(s * (w * 0.62) + sk * 0.45, -h - hb.deckLen * 0.58);
      ctx.closePath();
      ctx.fillStyle = "#2a3346";
      ctx.fill();
      ctx.strokeStyle = "#151b28";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  } else {
    // 스탠드업: 넓은 발판 + 앞쪽 핸들 기둥 받침
    ctx.beginPath();
    ctx.moveTo(-w + 8, -h - 3);
    ctx.lineTo(w - 8, -h - 3);
    ctx.lineTo(w * 0.5 + sk * 0.6, -h - hb.deckLen * 0.7);
    ctx.lineTo(-w * 0.5 + sk * 0.6, -h - hb.deckLen * 0.7);
    ctx.closePath();
    ctx.fillStyle = "#2a3346";
    ctx.fill();
    ctx.strokeStyle = "#151b28";
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  // 앞 덮개 + 바람막이 (짙은 유리)
  const nx = sk;
  ctx.beginPath();
  ctx.moveTo(nx - hb.w * 0.24, top + 26);
  ctx.quadraticCurveTo(nx, top - 10, nx + hb.w * 0.24, top + 26);
  ctx.quadraticCurveTo(nx, top + 18, nx - hb.w * 0.24, top + 26);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, `ws${R.id}`, 0, top - 6, 0, top + 26, [
    [0, "#9fd8ff"],
    [0.35, "#3d6a96"],
    [1, "#16263d"],
  ]);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0e1a2c";
  ctx.stroke();
  gloss(ctx, nx - hb.w * 0.08, top + 6, 10, 3, 0.7, -0.3);
}

function drawTransomDetail(ctx, R, hb, t, pose) {
  const w = hb.w / 2;
  const h = hb.h;
  // 아래쪽 어두운 띠 (물에 젖은 선체 바닥)
  ctx.save();
  transomPath(ctx, hb);
  ctx.clip();
  ctx.fillStyle = linear(ctx, `bot${R.id}`, 0, -10, 0, 10, [
    [0, alpha(darken(R.body, 0.5), 0)],
    [1, alpha(darken(R.body, 0.55), 0.85)],
  ]);
  ctx.fillRect(-w - 4, -12, hb.w + 8, 24);
  // 대각선 데칼
  ctx.fillStyle = alpha(R.trim, 0.95);
  ctx.beginPath();
  ctx.moveTo(-w - 4, -h * 0.62);
  ctx.lineTo(-w * 0.3, -h - 6);
  ctx.lineTo(-w * 0.05, -h - 6);
  ctx.lineTo(-w - 4, -h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w + 4, -h * 0.62);
  ctx.lineTo(w * 0.3, -h - 6);
  ctx.lineTo(w * 0.05, -h - 6);
  ctx.lineTo(w + 4, -h * 0.2);
  ctx.closePath();
  ctx.fill();
  if (R.hull === "blade" || R.hull === "stand") {
    // 번개 · 물결 데칼
    ctx.beginPath();
    ctx.moveTo(-w * 0.9, -h * 0.35);
    ctx.lineTo(-w * 0.5, -h * 0.55);
    ctx.lineTo(-w * 0.55, -h * 0.4);
    ctx.lineTo(-w * 0.15, -h * 0.6);
    stroke(ctx, alpha(R.accent, 0.9), 3);
  }
  if (R.hull === "bubble") {
    for (const [x, y, r] of [
      [-w * 0.72, -h * 0.4, 5],
      [w * 0.72, -h * 0.4, 5],
      [-w * 0.55, -h * 0.72, 3.4],
      [w * 0.55, -h * 0.72, 3.4],
    ])
      starShape(ctx, x, y, r, R.accent);
  }
  ctx.restore();
  // 뒤판 위쪽 빛
  gloss(ctx, -w * 0.45, -h * 0.82, w * 0.35, 5, 0.55, -0.08);
  // 번호판
  const pw = hb.w * 0.36;
  rrect(ctx, -pw / 2, -h * 0.74, pw, h * 0.42, 6);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = lineOf(R.body);
  ctx.stroke();
  ctx.font = `${Math.round(h * 0.36)}px "Bagel Fat One", "Jua", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = darken(R.body, 0.25);
  ctx.fillText(R.no, 0, -h * 0.52);
  // 후미등
  for (const s of [-1, 1]) {
    const lx = s * w * 0.74;
    if (R.hull === "bubble") {
      circ(ctx, lx, -h * 0.68, 5.5);
    } else rrect(ctx, lx - 7, -h * 0.76, 14, 6, 3);
    ctx.fillStyle = pose.boost > 0.2 ? "#fff6d0" : "#ff3b4e";
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "#7a0f1c";
    ctx.stroke();
  }
  // 물 분사 노즐
  ell(ctx, 0, -6, 11, 9);
  ctx.fillStyle = "#1b2233";
  ctx.fill();
  ell(ctx, 0, -6, 11, 9);
  stroke(ctx, "#8a96ad", 3);
  ell(ctx, 0, -5, 6, 5);
  ctx.fillStyle = pose.boost > 0.2 ? "#d8fbff" : "#0b0f18";
  ctx.fill();
  // 범퍼 (바지선) · 지느러미 (블레이드)
  if (R.hull === "barge") {
    for (const s of [-1, 1]) {
      rrect(ctx, s * w - (s > 0 ? 10 : 0), -h * 0.7, 10, h * 0.62, 5);
      ctx.fillStyle = "#2b2d4a";
      ctx.fill();
      ctx.strokeStyle = "#141526";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }
  // 아래 청록 반사광
  bounce(ctx, 0, -h * 0.4, w, h * 0.55, 0.5, 3);
}

function starShape(ctx, x, y, r, c) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * TAU - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
}

/* ================================================================
 * 레이서 (뒷모습) — 좌표 원점: 갑판 높이 · 안장 가운데
 * ============================================================== */
function drawRider(ctx, R, hb, pose, sk) {
  const t = pose.t || 0;
  const k = R.rider.kind;
  const stand = R.hull === "stand";
  const bob = Math.sin(t * 9) * 1.2 * (pose.speed || 0);
  // 안장 끝 (스탠드업은 없음)
  if (!stand) {
    rrect(ctx, -hb.seat / 2, -18, hb.seat, 20, 9);
    fill(ctx, "#2a3142", -6, -12, hb.seat * 0.5, 12, 2.4);
    ctx.beginPath();
    ctx.moveTo(-hb.seat / 2 + 6, -14);
    ctx.quadraticCurveTo(0, -20, hb.seat / 2 - 6, -14);
    stroke(ctx, alpha("#ffffff", 0.25), 2);
  }
  // 핸들바 (몸보다 멀리 있어서 먼저)
  const hy = stand ? -112 : -58;
  const gx = stand ? 34 : 45;
  ctx.save();
  ctx.translate(sk * 0.45, 0);
  if (stand) {
    // 기둥 + 핸들
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, hy + 6);
    stroke(ctx, "#454c63", 7);
  }
  ctx.beginPath();
  ctx.moveTo(-gx, hy);
  ctx.quadraticCurveTo(0, hy + 7, gx, hy);
  stroke(ctx, "#2a2f40", 6);
  ctx.beginPath();
  ctx.moveTo(-gx, hy - 1);
  ctx.quadraticCurveTo(0, hy + 5, gx, hy - 1);
  stroke(ctx, "#6b7590", 2);
  // 백미러
  if (!stand) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * (gx - 6), hy - 2);
      ctx.lineTo(s * (gx + 4), hy - 14);
      stroke(ctx, "#2a2f40", 2.6);
      ell(ctx, s * (gx + 7), hy - 17, 6.5, 4.5, s * 0.25);
      ctx.fillStyle = "#1f2533";
      ctx.fill();
      ell(ctx, s * (gx + 7), hy - 17, 4.6, 3, s * 0.25);
      ctx.fillStyle = "#b9e6ff";
      ctx.fill();
    }
  }
  ctx.restore();

  switch (k) {
    case "shark":
      riderShark(ctx, R, pose, bob, gx, hy, sk);
      break;
    case "crab":
      riderCrab(ctx, R, pose, bob, gx, hy, sk);
      break;
    case "mohawk":
      riderStand(ctx, R, pose, bob, gx, hy, sk);
      break;
    default:
      riderKid(ctx, R, pose, bob, gx, hy, sk);
  }
}

/** 사람 레이서 (지혁 · 루비): 앉은 자세, 앞으로 숙여 핸들을 잡는다 */
function riderKid(ctx, R, pose, bob, gx, hy, sk) {
  const rd = R.rider;
  const t = pose.t || 0;
  const s4 = sk * 0.4;
  // 다리 (무릎이 안장 양옆으로)
  for (const s of [-1, 1]) {
    limb(ctx, [s * 14, -10, s * 34, -18 + bob * 0.3, s * 38 + s4 * 0.2, -34], 15, rd.suit, { line: 4 });
    limb(ctx, [s * 38 + s4 * 0.2, -34, s * 46, -18, s * 44, 0], 12, rd.suit, { line: 4 });
    // 신발
    ell(ctx, s * 45, 0, 10, 6);
    fill(ctx, "#ffffff", s * 45, 0, 10, 6, 2);
    ctx.beginPath();
    ctx.moveTo(s * 36, 3);
    ctx.lineTo(s * 54, 3);
    stroke(ctx, "#ff6a3d", 2.4);
  }
  // 몸통 (구명조끼) — 앞으로 숙여서 어깨가 낮다
  const sy = -76 + bob;
  ctx.beginPath();
  ctx.moveTo(-24, -14);
  ctx.bezierCurveTo(-30, -36, -36, sy + 18, -30 + s4, sy + 2);
  ctx.quadraticCurveTo(s4, sy - 10, 30 + s4, sy + 2);
  ctx.bezierCurveTo(36, sy + 18, 30, -36, 24, -14);
  ctx.quadraticCurveTo(0, -8, -24, -14);
  ctx.closePath();
  fill(ctx, rd.vest, -8, sy + 22, 34, 34, 3);
  // 조끼 반사띠 · 이름
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(-40, sy + 30, 80, 6);
  ctx.fillStyle = alpha(darken(rd.vest, 0.4), 0.9);
  ctx.font = '11px "Bagel Fat One", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(R.en, s4 * 0.5, sy + 18);
  ctx.restore();
  // 등 가운데 지퍼 줄 · 옆 버클
  for (const s of [-1, 1]) {
    rrect(ctx, s * 28 - 4 + s4 * 0.3, sy + 34, 8, 12, 2);
    flat(ctx, "#22283a", 1.2, "#0e1220");
  }
  // 팔 (어깨 → 핸들) + 장갑
  for (const s of [-1, 1]) {
    const sx = s * 26 + s4;
    limb(ctx, [sx, sy + 8, s * 40 + s4 * 1.2, sy + 26, s * gx + sk * 0.45, hy + 3], 11, rd.suit, { line: 4 });
    ell(ctx, s * gx + sk * 0.45, hy, 8, 7);
    fill(ctx, R.id === "ruby" ? R.accent : "#13b5a8", s * gx + sk * 0.45, hy, 8, 7, 2);
  }
  // 목 + 헬멧
  const hx = s4 * 1.3;
  const hcy = sy - 18 + bob * 0.4;
  rrect(ctx, hx - 8, hcy + 8, 16, 12, 5);
  ctx.fillStyle = darken(rd.skin || "#ffd5b3", 0.12);
  ctx.fill();
  // 루비: 헬멧 밖으로 나온 양 갈래 머리 (속도에 펄럭)
  if (R.id === "ruby") {
    for (const s of [-1, 1]) {
      const flap = Math.sin(t * 14 + s) * 5 * (0.4 + (pose.speed || 0));
      ctx.beginPath();
      ctx.moveTo(hx + s * 14, hcy + 6);
      ctx.bezierCurveTo(hx + s * 30, hcy + 10, hx + s * 34 + flap, hcy + 30, hx + s * 26 + flap * 1.4, hcy + 44);
      stroke(ctx, lineOf(rd.hair), 13);
      ctx.beginPath();
      ctx.moveTo(hx + s * 14, hcy + 6);
      ctx.bezierCurveTo(hx + s * 30, hcy + 10, hx + s * 34 + flap, hcy + 30, hx + s * 26 + flap * 1.4, hcy + 44);
      stroke(ctx, rd.hair, 9);
      circ(ctx, hx + s * 17, hcy + 8, 4.5);
      ctx.fillStyle = R.accent;
      ctx.fill();
    }
  }
  helmet(ctx, hx, hcy, 22, rd, R, pose);
}

/** 헬멧 (뒤에서): 줄무늬 · 고글 끈 · 통풍구 */
function helmet(ctx, x, y, r, rd, R, pose) {
  circ(ctx, x, y, r);
  fill(ctx, rd.helmet, x, y, r, r, 3);
  ctx.save();
  circ(ctx, x, y, r);
  ctx.clip();
  // 가운데 줄무늬
  ctx.fillStyle = rd.stripe;
  ctx.fillRect(x - 5, y - r, 10, r * 2);
  // 아래 테 (목 보호대)
  ctx.fillStyle = darken(rd.helmet, 0.35);
  ctx.fillRect(x - r, y + r * 0.62, r * 2, r);
  ctx.restore();
  // 고글 끈
  ctx.beginPath();
  ctx.moveTo(x - r * 0.98, y + 2);
  ctx.quadraticCurveTo(x, y + 8, x + r * 0.98, y + 2);
  stroke(ctx, "#1d2233", 5);
  rrect(ctx, x - 6, y + 2, 12, 7, 2);
  ctx.fillStyle = "#c9d3e6";
  ctx.fill();
  // 통풍구
  for (const s of [-1, 1]) {
    rrect(ctx, x + s * 11 - 3, y - r * 0.55, 6, 9, 2);
    ctx.fillStyle = alpha("#0d1424", 0.6);
    ctx.fill();
  }
  gloss(ctx, x - r * 0.38, y - r * 0.45, r * 0.42, r * 0.22, 0.7);
  if (R.no && R.id === "jihyeok") {
    ctx.font = '9px "Bagel Fat One", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = darken(rd.helmet, 0.45);
    ctx.fillText(R.no, x, y + r * 0.42);
  }
}

/** 샤키: 아기 상어 — 등지느러미 · 꼬리 · 지느러미 손 */
function riderShark(ctx, R, pose, bob, gx, hy, sk) {
  const rd = R.rider;
  const t = pose.t || 0;
  const s4 = sk * 0.4;
  const sy = -78 + bob;
  // 꼬리 (안장 뒤로 늘어져 살랑살랑)
  const wag = Math.sin(t * 8) * 6;
  ctx.save();
  ctx.translate(0, -6);
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.quadraticCurveTo(-4 + wag * 0.3, 12, -2 + wag, 22);
  ctx.lineTo(-20 + wag, 34);
  ctx.quadraticCurveTo(0 + wag, 30, 18 + wag, 36);
  ctx.lineTo(6 + wag, 22);
  ctx.quadraticCurveTo(8, 10, 8, -4);
  ctx.closePath();
  fill(ctx, rd.skin, wag, 18, 18, 18, 2.6);
  ctx.restore();
  // 다리
  for (const s of [-1, 1]) {
    limb(ctx, [s * 14, -10, s * 34, -20, s * 40, -2], 14, rd.skin, { line: 4 });
  }
  // 몸 (둥근 상어 몸통 + 조끼)
  ctx.beginPath();
  ctx.moveTo(-26, -12);
  ctx.bezierCurveTo(-36, -40, -34, sy + 6, s4, sy - 8);
  ctx.bezierCurveTo(34, sy + 6, 36, -40, 26, -12);
  ctx.quadraticCurveTo(0, -4, -26, -12);
  ctx.closePath();
  fill(ctx, rd.skin, -6, sy + 20, 34, 36, 3);
  // 조끼 (노란 구명조끼, 어깨끈)
  ctx.beginPath();
  ctx.moveTo(-24, -16);
  ctx.bezierCurveTo(-30, -34, -28, sy + 30, -18 + s4, sy + 22);
  ctx.lineTo(18 + s4, sy + 22);
  ctx.bezierCurveTo(28, sy + 30, 30, -34, 24, -16);
  ctx.quadraticCurveTo(0, -10, -24, -16);
  ctx.closePath();
  fill(ctx, rd.vest, 0, -30, 30, 22, 2.6);
  // 등지느러미
  ctx.beginPath();
  ctx.moveTo(-9 + s4, sy + 10);
  ctx.quadraticCurveTo(-2 + s4, sy - 18, 8 + s4 * 1.2, sy - 30);
  ctx.quadraticCurveTo(8 + s4, sy - 6, 10 + s4, sy + 10);
  ctx.closePath();
  fill(ctx, darken(rd.skin, 0.08), s4, sy - 6, 12, 20, 2.6);
  // 팔 (지느러미 손)
  for (const s of [-1, 1]) {
    limb(ctx, [s * 24 + s4, sy + 10, s * 44 + s4, sy + 14, s * gx + sk * 0.45, hy + 2], 11, rd.skin, { line: 4 });
    ell(ctx, s * gx + sk * 0.45, hy, 9, 7, s * 0.4);
    fill(ctx, rd.skin, s * gx + sk * 0.45, hy, 9, 7, 2);
  }
  // 머리 + 헬멧 (지느러미 볏)
  const hx = s4 * 1.3;
  const hcy = sy - 16 + bob * 0.4;
  helmet(ctx, hx, hcy, 21, rd, R, pose);
  ctx.beginPath();
  ctx.moveTo(hx - 4, hcy - 18);
  ctx.quadraticCurveTo(hx + 2, hcy - 40, hx + 14, hcy - 44);
  ctx.quadraticCurveTo(hx + 8, hcy - 30, hx + 8, hcy - 16);
  ctx.closePath();
  fill(ctx, R.body, hx + 4, hcy - 28, 10, 14, 2.4);
}

/** 캡틴 크랩: 둥근 등딱지 · 해적 모자 · 집게로 핸들을 잡는다 */
function riderCrab(ctx, R, pose, bob, gx, hy, sk) {
  const rd = R.rider;
  const t = pose.t || 0;
  const s4 = sk * 0.4;
  // 다리 (가는 게 다리 여러 개)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      limb(ctx, [s * (18 + i * 4), -12 - i * 6, s * (40 + i * 5), -22 - i * 4, s * (44 + i * 4), -4 - i * 3], 6, rd.shell, { line: 3, hi: false });
    }
  }
  // 등딱지 (몸)
  const sy = -60 + bob;
  ell(ctx, s4 * 0.6, sy, 38, 32);
  fill(ctx, rd.shell, s4 * 0.6 - 10, sy - 10, 38, 32, 3);
  // 등딱지 무늬
  for (const [x, y, r] of [
    [-14, -8, 5],
    [12, -12, 4],
    [0, 10, 6],
    [-20, 12, 3.4],
    [20, 8, 3.4],
  ]) {
    circ(ctx, s4 * 0.6 + x, sy + y, r);
    ctx.fillStyle = alpha(lighten(rd.shell, 0.4), 0.6);
    ctx.fill();
  }
  // 조끼 끈 (X 자)
  ctx.beginPath();
  ctx.moveTo(-30 + s4 * 0.6, sy - 14);
  ctx.lineTo(26 + s4 * 0.6, sy + 22);
  ctx.moveTo(30 + s4 * 0.6, sy - 14);
  ctx.lineTo(-26 + s4 * 0.6, sy + 22);
  stroke(ctx, rd.vest, 6);
  // 팔 + 큰 집게 (핸들 끝)
  for (const s of [-1, 1]) {
    limb(ctx, [s * 30 + s4 * 0.6, sy - 6, s * 46 + s4, sy - 14, s * gx + sk * 0.45, hy + 4], 9, rd.shell, { line: 3 });
    const cx = s * (gx + 4) + sk * 0.45;
    const cy = hy - 4;
    const snap = Math.max(0, Math.sin(t * 3 + s)) * 0.2;
    ell(ctx, cx, cy, 15, 11, s * 0.3);
    fill(ctx, rd.shell, cx, cy, 15, 11, 2.6);
    ctx.beginPath();
    ctx.moveTo(cx + s * 4, cy - 6);
    ctx.lineTo(cx + s * 18, cy - 14 - snap * 20);
    ctx.lineTo(cx + s * 10, cy - 2);
    ctx.closePath();
    fill(ctx, rd.shell, cx + s * 10, cy - 8, 8, 6, 2);
  }
  // 눈자루 + 해적 모자
  const hx = s4 * 1.1;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + s * 9, sy - 28);
    ctx.lineTo(hx + s * 12, sy - 46);
    stroke(ctx, lineOf(rd.shell), 6);
    ctx.beginPath();
    ctx.moveTo(hx + s * 9, sy - 28);
    ctx.lineTo(hx + s * 12, sy - 46);
    stroke(ctx, rd.shell, 3.5);
    circ(ctx, hx + s * 12, sy - 50, 6.5);
    fill(ctx, "#ffffff", hx + s * 12, sy - 50, 6.5, 6.5, 1.8);
  }
  pirateHat(ctx, hx, sy - 30, 0.9, rd.hat, 0, "#ffcf4d");
}

/** 블리츠: 서서 타는 자세 · 모히칸 헬멧 */
function riderStand(ctx, R, pose, bob, gx, hy, sk) {
  const rd = R.rider;
  const s4 = sk * 0.5;
  const kneeBend = 6 + (pose.crouch || 0) * 18 + bob;
  // 다리 (서서 무릎을 살짝 굽힘)
  for (const s of [-1, 1]) {
    limb(ctx, [s * 20, -2, s * 26 + kneeBend * 0.3 * s, -36 + kneeBend * 0.4, s * 16 + s4 * 0.3, -70 + kneeBend], 15, rd.suit, { line: 4 });
    ell(ctx, s * 21, 0, 12, 6);
    fill(ctx, "#ffffff", s * 21, 0, 12, 6, 2);
    // 다리 옆 형광 줄
    ctx.beginPath();
    ctx.moveTo(s * 25, -10);
    ctx.lineTo(s * 27, -34);
    stroke(ctx, rd.vest, 3);
  }
  // 몸통
  const sy = -140 + kneeBend + bob;
  ctx.beginPath();
  ctx.moveTo(-22 + s4 * 0.3, -66 + kneeBend);
  ctx.bezierCurveTo(-30, -90 + kneeBend, -32 + s4, sy + 16, -26 + s4, sy);
  ctx.quadraticCurveTo(s4, sy - 10, 26 + s4, sy);
  ctx.bezierCurveTo(32 + s4, sy + 16, 30, -90 + kneeBend, 22 + s4 * 0.3, -66 + kneeBend);
  ctx.closePath();
  fill(ctx, rd.suit, s4 - 6, sy + 24, 30, 40, 3);
  // 번개 무늬 조끼 줄
  ctx.beginPath();
  ctx.moveTo(-14 + s4, sy + 8);
  ctx.lineTo(4 + s4, sy + 24);
  ctx.lineTo(-6 + s4, sy + 28);
  ctx.lineTo(14 + s4, sy + 48);
  stroke(ctx, rd.vest, 5);
  // 팔 (가슴 높이 핸들)
  for (const s of [-1, 1]) {
    limb(ctx, [s * 24 + s4, sy + 6, s * 38 + s4, sy + 22, s * gx + sk * 0.45, hy + 2], 11, rd.suit, { line: 4 });
    ell(ctx, s * gx + sk * 0.45, hy, 8, 7);
    fill(ctx, rd.vest, s * gx + sk * 0.45, hy, 8, 7, 2);
  }
  // 헬멧 + 모히칸 볏
  const hx = s4 * 1.2;
  const hcy = sy - 18;
  helmet(ctx, hx, hcy, 21, rd, R, pose);
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.6;
    const rr = i % 2 ? 24 : 34;
    ctx.lineTo(hx + Math.cos(a) * rr * 0.55, hcy - 12 + Math.sin(a) * rr);
  }
  ctx.lineTo(hx + 2, hcy - 14);
  ctx.closePath();
  fill(ctx, rd.stripe, hx - 6, hcy - 30, 12, 18, 2.4);
}

/* ================================================================
 * 앞모습 초상 (메뉴 · 결과 · 출발 소개) — 원점: 가슴 아래 가운데, 높이 약 240
 * ============================================================== */
export function drawPortrait(ctx, R, opts = {}) {
  const rd = R.rider;
  const t = opts.t || 0;
  const mood = opts.mood || "happy";
  const breath = Math.sin(t * 2.4) * 1.5;
  ctx.save();
  ctx.translate(0, breath * 0.3);
  switch (rd.kind) {
    case "shark":
      portraitShark(ctx, R, t, mood);
      break;
    case "crab":
      portraitCrab(ctx, R, t, mood);
      break;
    default:
      portraitKid(ctx, R, t, mood, opts);
  }
  ctx.restore();
}

function portraitBody(ctx, R, color, vest) {
  // 어깨 · 조끼
  ctx.beginPath();
  ctx.moveTo(-78, 0);
  ctx.bezierCurveTo(-78, -50, -54, -78, -26, -84);
  ctx.lineTo(26, -84);
  ctx.bezierCurveTo(54, -78, 78, -50, 78, 0);
  ctx.closePath();
  fill(ctx, color, -20, -50, 70, 50, 3);
  ctx.beginPath();
  ctx.moveTo(-58, 0);
  ctx.bezierCurveTo(-60, -44, -46, -72, -22, -80);
  ctx.lineTo(-10, -30);
  ctx.lineTo(10, -30);
  ctx.lineTo(22, -80);
  ctx.bezierCurveTo(46, -72, 60, -44, 58, 0);
  ctx.closePath();
  fill(ctx, vest, -14, -44, 56, 46, 3);
  // 번호 배지
  circ(ctx, -34, -40, 13);
  fill(ctx, "#ffffff", -34, -40, 13, 13, 2);
  ctx.font = '13px "Bagel Fat One", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = darken(R.body, 0.2);
  ctx.fillText(R.no, -34, -39);
  // 지퍼 · 버클
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(0, 0);
  stroke(ctx, alpha(darken(vest, 0.5), 0.6), 3);
  for (const y of [-22, -8]) {
    rrect(ctx, -12, y, 24, 7, 2);
    flat(ctx, "#22283a", 1.2, "#0e1220");
  }
}

/** 지혁 · 루비 · 블리츠 (사람): 헬멧을 쓰고 고글은 이마 위로 */
function portraitKid(ctx, R, t, mood, opts) {
  const rd = R.rider;
  portraitBody(ctx, R, rd.suit, rd.vest);
  const hy = -150;
  const r = 50;
  // 목
  rrect(ctx, -14, hy + 34, 28, 24, 8);
  ctx.fillStyle = darken(rd.skin, 0.1);
  ctx.fill();
  // 헬멧 뒷부분 (얼굴 뒤로 보이는 테)
  circ(ctx, 0, hy - 4, r + 12);
  fill(ctx, rd.helmet, -12, hy - 24, r + 12, r + 12, 3);
  ctx.save();
  circ(ctx, 0, hy - 4, r + 12);
  ctx.clip();
  ctx.fillStyle = rd.stripe;
  ctx.fillRect(-9, hy - 80, 18, 50);
  ctx.restore();
  if (R.id === "ruby") {
    for (const s of [-1, 1]) {
      const fl = Math.sin(t * 3 + s) * 4;
      ctx.beginPath();
      ctx.moveTo(s * (r + 6), hy + 4);
      ctx.bezierCurveTo(s * (r + 34), hy + 10, s * (r + 30) + fl, hy + 52, s * (r + 18) + fl, hy + 76);
      stroke(ctx, lineOf(rd.hair), 22);
      ctx.beginPath();
      ctx.moveTo(s * (r + 6), hy + 4);
      ctx.bezierCurveTo(s * (r + 34), hy + 10, s * (r + 30) + fl, hy + 52, s * (r + 18) + fl, hy + 76);
      stroke(ctx, rd.hair, 16);
      circ(ctx, s * (r + 10), hy + 6, 7);
      ctx.fillStyle = R.accent;
      ctx.fill();
    }
  }
  // 얼굴 (내 얼굴 사진이 켜져 있으면 사진) — 사진은 화면에만 그리고 어디로도 보내지 않는다
  let photo = false;
  if (R.id === "jihyeok" && opts.face !== false && window.TodayFace && TodayFace.drawHead) {
    photo = TodayFace.drawHead(ctx, 0, hy + 6, r * 0.86, { ring: 3, ringColor: lineOf(rd.skin) });
  }
  if (!photo) {
    ell(ctx, 0, hy + 6, r * 0.86, r * 0.84);
    fill(ctx, rd.skin, -10, hy - 4, r * 0.86, r * 0.84, 2.6);
    // 앞머리 (헬멧 아래로 살짝)
    ctx.beginPath();
    ctx.moveTo(-r * 0.78, hy - 14);
    ctx.quadraticCurveTo(-r * 0.4, hy - 4, -r * 0.1, hy - 16);
    ctx.quadraticCurveTo(r * 0.3, hy - 2, r * 0.78, hy - 14);
    ctx.lineTo(r * 0.8, hy - 32);
    ctx.lineTo(-r * 0.8, hy - 32);
    ctx.closePath();
    fill(ctx, rd.hair, 0, hy - 24, r, 12, 2);
    const p = { t, now: t, blink: t % 3.3 < 0.12 };
    const happy = mood === "cheer" || mood === "win";
    eye(ctx, -17, hy + 6, 9, p, { iris: R.id === "ruby" ? "#8a5bff" : R.id === "blitz" ? "#2fbf6a" : "#6b3b1c", happy, lash: R.id === "ruby", side: -1 });
    eye(ctx, 17, hy + 6, 9, p, { iris: R.id === "ruby" ? "#8a5bff" : R.id === "blitz" ? "#2fbf6a" : "#6b3b1c", happy, lash: R.id === "ruby", side: 1 });
    brow(ctx, -17, hy - 10, 8, mood === "focus" ? -3 : 1, 3);
    brow(ctx, 17, hy - 10, 8, mood === "focus" ? 3 : 1, 3);
    blush(ctx, -28, hy + 22, 9);
    blush(ctx, 28, hy + 22, 9);
    mouth(ctx, 0, hy + 26, 10, p, mood === "sad" ? "flat" : happy ? "open" : mood === "focus" ? "flat" : "grin");
  }
  // 헬멧 앞 테 (얼굴 둘레) + 이마 위 고글
  ctx.beginPath();
  ctx.arc(0, hy - 4, r + 12, Math.PI * 1.02, Math.PI * 1.98);
  ctx.arc(0, hy - 4, r - 2, Math.PI * 1.96, Math.PI * 1.04, true);
  ctx.closePath();
  fill(ctx, rd.helmet, -10, hy - 50, r, 20, 3);
  ctx.beginPath();
  ctx.moveTo(-r - 10, hy - 24);
  ctx.quadraticCurveTo(0, hy - 34, r + 10, hy - 24);
  stroke(ctx, "#1d2233", 7);
  for (const s of [-1, 1]) {
    ell(ctx, s * 19, hy - 30, 17, 12);
    ctx.fillStyle = "#1d2233";
    ctx.fill();
    ell(ctx, s * 19, hy - 30, 13, 8.5);
    ctx.fillStyle = linear(ctx, `gog${rd.visor}`, 0, hy - 40, 0, hy - 20, [
      [0, lighten(rd.visor, 0.6)],
      [1, rd.visor],
    ]);
    ctx.fill();
    gloss(ctx, s * 19 - 4, hy - 33, 5, 2.5, 0.8);
  }
  // 블리츠 모히칸
  if (R.id === "blitz") {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const x = -26 + i * 6.5;
      ctx.lineTo(x, hy - r - 8 - (i % 2 ? 6 : 22));
    }
    ctx.lineTo(26, hy - r - 2);
    ctx.lineTo(-26, hy - r - 2);
    ctx.closePath();
    fill(ctx, rd.stripe, 0, hy - r - 18, 26, 14, 2.4);
  }
}

function portraitShark(ctx, R, t, mood) {
  const rd = R.rider;
  portraitBody(ctx, R, rd.skin, rd.vest);
  const hy = -150;
  ell(ctx, 0, hy, 56, 50);
  fill(ctx, rd.skin, -12, hy - 16, 56, 50, 3);
  ell(ctx, 0, hy + 22, 40, 24);
  ctx.fillStyle = rd.belly;
  ctx.fill();
  const p = { t, now: t, blink: t % 3.7 < 0.12 };
  eye(ctx, -20, hy - 4, 10, p, { iris: "#1f4fa8", happy: mood === "cheer" || mood === "win" });
  eye(ctx, 20, hy - 4, 10, p, { iris: "#1f4fa8", happy: mood === "cheer" || mood === "win" });
  // 상어 이빨 웃음
  ctx.beginPath();
  ctx.moveTo(-22, hy + 22);
  ctx.quadraticCurveTo(0, hy + 40, 22, hy + 22);
  ctx.closePath();
  flat(ctx, "#ffffff", 2, INK);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-18 + i * 9, hy + 23);
    ctx.lineTo(-14 + i * 9, hy + 29);
    ctx.lineTo(-10 + i * 9, hy + 23);
    stroke(ctx, alpha(INK, 0.5), 1.2);
  }
  blush(ctx, -34, hy + 14, 9);
  blush(ctx, 34, hy + 14, 9);
  // 헬멧 (위만) + 지느러미 볏
  ctx.beginPath();
  ctx.arc(0, hy - 6, 58, Math.PI * 1.05, Math.PI * 1.95);
  ctx.quadraticCurveTo(0, hy - 30, -56, hy - 26);
  ctx.closePath();
  fill(ctx, rd.helmet, -10, hy - 48, 50, 22, 3);
  ctx.beginPath();
  ctx.moveTo(-6, hy - 60);
  ctx.quadraticCurveTo(4, hy - 100, 26, hy - 108);
  ctx.quadraticCurveTo(16, hy - 80, 18, hy - 58);
  ctx.closePath();
  fill(ctx, R.body, 8, hy - 80, 16, 24, 2.6);
}

function portraitCrab(ctx, R, t, mood) {
  const rd = R.rider;
  const hy = -110;
  // 집게 두 개 (번쩍)
  for (const s of [-1, 1]) {
    const lift = Math.sin(t * 3 + s) * 4;
    limb(ctx, [s * 50, hy + 40, s * 82, hy + 20, s * 92, hy - 20 + lift], 14, rd.shell, { line: 4 });
    ell(ctx, s * 96, hy - 40 + lift, 26, 20, s * 0.4);
    fill(ctx, rd.shell, s * 96, hy - 40 + lift, 26, 20, 3);
    ctx.beginPath();
    ctx.moveTo(s * 100, hy - 50 + lift);
    ctx.lineTo(s * 120, hy - 72 + lift);
    ctx.lineTo(s * 112, hy - 40 + lift);
    ctx.closePath();
    fill(ctx, rd.shell, s * 110, hy - 56, 10, 14, 2.4);
  }
  ell(ctx, 0, hy + 20, 72, 56);
  fill(ctx, rd.shell, -16, hy, 72, 56, 3.2);
  ctx.beginPath();
  ctx.moveTo(-56, hy - 6);
  ctx.lineTo(50, hy + 64);
  ctx.moveTo(56, hy - 6);
  ctx.lineTo(-50, hy + 64);
  stroke(ctx, rd.vest, 9);
  const p = { t, now: t, blink: t % 3 < 0.12 };
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 16, hy - 20);
    ctx.lineTo(s * 22, hy - 54);
    stroke(ctx, lineOf(rd.shell), 9);
    ctx.beginPath();
    ctx.moveTo(s * 16, hy - 20);
    ctx.lineTo(s * 22, hy - 54);
    stroke(ctx, rd.shell, 6);
    eye(ctx, s * 22, hy - 62, 12, p, { iris: "#2b2d4a", happy: mood === "cheer" || mood === "win" });
  }
  mouth(ctx, 0, hy + 14, 14, p, mood === "sad" ? "flat" : "grin");
  pirateHat(ctx, 0, hy - 70, 1.7, rd.hat, 0, "#ffcf4d");
}

/** 물 위 그림자 + 선체가 물을 가르는 하얀 거품 (선체 아래) */
export function drawHullFoam(ctx, R, pose) {
  const hb = hullInfo(R.hull);
  const w = hb.w / 2;
  const sp = pose.speed || 0;
  shadow(ctx, 0, 6, w * 1.2, 14, 0.35);
  if (pose.air) return;
  // 선체 둘레 거품
  const t = pose.t || 0;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI;
    const wob = Math.sin(t * 22 + i * 1.7) * 2.5;
    const rx = w + 10 + sp * 10 + wob;
    ctx.lineTo(-Math.cos(a) * rx, 4 + Math.sin(a) * (6 + sp * 4) + (i % 2 ? 2 : 0));
  }
  for (let i = 14; i >= 0; i--) {
    const a = (i / 14) * Math.PI;
    ctx.lineTo(-Math.cos(a) * (w - 4), 2 + Math.sin(a) * 2);
  }
  ctx.closePath();
  ctx.fill();
}
