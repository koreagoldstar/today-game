/*
 * 제트스키 썬더 레이스 — 레이서 (뒷모습 · 게임 중)
 *
 * 다섯 명 모두 같은 뼈대로 그린다:
 *   관절 위치 계산(rig) → 핸들 · 안장 · 다리 · 헬멧 · 몸통 · 팔 · 손 순서로 그리기.
 * 캐릭터마다 체형 · 기본 자세 · 헬멧 · 고글 · 소품 · 움직임 성격(RIG)만 다르다.
 *
 * 좌표: 1 = 1cm, 원점 = 갑판 높이 · 안장 뒤끝 가운데, 위가 -y.
 * 카메라가 뒤 위에서 내려다보므로, 앞으로 숙이면 헬멧이 어깨 사이로 들어가 보이고(등이 헬멧 아래를 가린다)
 * 팔꿈치는 바깥으로 벌어지고, 손은 핸들 끝을 감싸 쥔다.
 *
 * pose (없으면 기본값으로): t speed yaw
 *   steer(-1~1) boostK(0~1) kick(부스트 시작 1→0) air airS(0~1) airK(0 이륙 → 1 착지)
 *   land(1→0 착지 충격) hit(1→0 충돌) bump(1→0 살짝 부딪힘) hitDir fin(결승 후 초 · 없으면 -1) place
 *   k(화면 배율 — 작게 보이면 잔 무늬를 줄인다)
 */
import { INK, lighten, darken, alpha, lineOf, linear, ell, circ, rrect, fill, flat, stroke, gloss, shadow, limb, blush } from "../../ocean-blaster/art/kit.js?v=3";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const R2 = (v) => Math.round(v);

/** 빛 받은 채우기 — 움직이는 부위도 그라데이션이 끝없이 쌓이지 않게 좌표를 반올림 */
function lf(ctx, base, x, y, rx, ry, lw = 2.6) {
  fill(ctx, base, R2(x), R2(y), Math.max(1, R2(rx)), Math.max(1, R2(ry)), lw);
}

/* ---------------- 캐릭터별 체형 · 자세 · 장비 ---------------- */
const RIG = {
  // 지혁 — 주인공: 균형 잡힌 체형 · 큰 고글 · 스포일러 헬멧 · 노란 스카프 · 주황 장갑과 어깨
  jihyeok: { shW: 28, waist: 16, hip: 21, torso: 56, head: 23.5, arm: 10.5, leg: 14, lean: 0.62, elbow: 8, bob: 1, turn: 1, look: 1, helmet: "hero", goggle: "big", glove: "#ff8a2a", cuff: "#ffffff", pad: null, padLine: "#ff8a2a", elbowPad: true, shoe: "#ffffff", shoeLine: "#ff6a3d", scarf: "#ffd23f", name: true },
  // 샤키 — 스피드형: 길고 날렵한 몸, 낮고 흔들림 없는 자세, 팔꿈치를 몸에 붙인다
  sharky: { shW: 25, waist: 14, hip: 19, torso: 60, head: 22, arm: 10, leg: 13, lean: 0.78, elbow: 3, bob: 0.4, turn: 0.7, look: 0.6, helmet: "fin", goggle: "wrap", glove: "#3fe0ff", cuff: "#ffffff", pad: null, shoe: "#e9f6ff", shoeLine: "#2f86ea", sleeve: "short", tail: true },
  // 루비 — 트릭형: 작고 가벼운 몸, 통통 튀고 고개를 잘 돌린다, 점프하면 한 손을 놓고 흔든다
  ruby: { shW: 22, waist: 13, hip: 18, torso: 50, head: 22, arm: 9.5, leg: 12, lean: 0.46, elbow: 6, bob: 1.6, turn: 1.4, look: 1.4, helmet: "ears", goggle: "heart", glove: "#ffe066", cuff: "#8a5bff", pad: null, shoe: "#ffffff", shoeLine: "#ff5fa8", pigtails: true, trick: true },
  // 캡틴 크랩 — 공격형: 넓은 등딱지 어깨, 가장 낮게 숙이고 어깨를 들썩인다, 집게로 핸들을 움켜쥔다
  crab: { shW: 37, waist: 24, hip: 25, torso: 46, head: 21, arm: 9, leg: 6, lean: 0.88, elbow: 11, bob: 0.9, turn: 1.1, look: 1, helmet: "pirate", goggle: "sharp", glove: null, shoe: null, sway: true, crab: true },
  // 블리츠 — 서서 타는 고수: 무릎을 굽힌 낮은 자세, 모히칸 헬멧 · 통 바이저
  blitz: { stand: true, shW: 27, waist: 17, hip: 18, torso: 54, head: 21.5, arm: 10.5, leg: 14, lean: 0.7, elbow: 7, bob: 1, turn: 1.15, look: 1, helmet: "mohawk", goggle: "visor", glove: "#b8ff3a", cuff: "#2e3550", pad: "#2e3550", shoe: "#ffffff", shoeLine: "#b8ff3a", bolt: true },
};

/* ================================================================
 * 관절 계산 — 애니메이션 상태(RACE · TURN · BOOST · JUMP · LAND · HIT · FINISH · WIN · LOSE)를
 * 숙임 각도 · 엉덩이 높이 · 고개 돌림 · 팔꿈치 · 무릎 위치로 바꾼다.
 * ============================================================== */
function rig(R, S, hb, pose, sk) {
  const t = pose.t || 0;
  const sp = clamp(pose.speed || 0, 0, 1.3);
  const steer = clamp(pose.steer != null ? pose.steer : (pose.yaw || 0) / 0.85, -1, 1);
  const boost = clamp(pose.boostK != null ? pose.boostK : pose.boost || 0, 0, 1);
  const kick = clamp(pose.kick || 0, 0, 1);
  const airS = clamp(pose.airS != null ? pose.airS : pose.air ? 1 : 0, 0, 1);
  const airK = pose.air ? clamp(pose.airK != null ? pose.airK : 0.5, 0, 1) : 1;
  const land = Math.pow(clamp(pose.land || 0, 0, 1), 0.7);
  const hit = clamp(Math.max(pose.hit || 0, (pose.bump || 0) * 0.55), 0, 1);
  const hd = pose.hitDir || 1;
  const fin = pose.fin != null ? pose.fin : -1;
  const done = fin >= 0;
  const place = pose.place || 1;
  const win = done && place === 1;
  const podium = done && place > 1 && place <= 3;
  const lose = done && place > 3;
  const fb = done ? ease(clamp(fin / 0.45, 0, 1)) : 0;
  const move = clamp((sp - 0.03) * 5, 0, 1); // 0 = 출발 전 정지
  const stand = !!S.stand;

  // 공중: 떠오를 땐 몸을 세우고 엉덩이가 뜨고, 내려올 땐 앞으로 숙여 착지를 준비
  const rise = airS * clamp(1 - airK / 0.45, 0, 1);
  const fall = airS * clamp((airK - 0.45) / 0.55, 0, 1);

  // 출렁임 (파도 · 엔진) — 머리는 조금 늦게 따라온다. 멈춰 있으면 숨쉬기.
  const bobA = S.bob * (0.35 + sp * 0.9) * move * (1 - airS);
  const bob = Math.sin(t * 9) * 1.4 * bobA + Math.sin(t * 2.3) * 0.9 * (1 - move);
  const bobH = Math.sin(t * 9 - 0.9) * 1.4 * bobA;
  const jit = Math.sin(t * 37) * 0.35 * sp * move;
  const shake = hit * Math.sin(t * 24);
  const shakeL = hit * Math.sin(t * 24 - 1.1);

  // 숙임 각도: 정지 0.16 → 레이스(캐릭터별) → 부스트 더 낮게
  let a = lerp(0.16, S.lean, move);
  a += boost * 0.34 + kick * 0.16;
  a += -0.26 * rise + 0.2 * fall;
  a += land * 0.24;
  if (done) a = lerp(a, win ? -0.08 : podium ? 0.1 : 0.36, fb);
  a = Math.min(a, 1.15);
  const sa = Math.sin(Math.max(0, a));

  // 결승 포즈: 1등은 한 손 번쩍 + 흔들기, 2~3등은 주먹 한 번, 그 아래는 아쉬움
  let raise = 0;
  let wave = 0;
  if (win) {
    raise = ease(clamp((fin - 0.2) / 0.35, 0, 1));
    wave = Math.sin(fin * 9);
  } else if (podium) {
    raise = ease(clamp((fin - 0.2) / 0.25, 0, 1)) * clamp((2.3 - fin) / 0.5, 0, 1);
    wave = Math.abs(Math.sin(fin * 7));
  }
  // 루비: 점프 중 한 손을 놓고 흔든다 (트릭)
  const free = S.trick ? airS * Math.sin(clamp(airK / 0.8, 0, 1) * Math.PI) : 0;

  // 엉덩이 · 몸통
  const hipX = steer * 3 * S.turn + shake * 3 * hd;
  const crouchS = boost * 6 + land * 14 + airS * 12 + kick * 3;
  const hipY = stand ? -72 + crouchS + bob * 0.6 : -22 - 8 * rise + land * 4;
  const squash = land * 7 + boost * 4 + kick * 4 + fall * 3;
  const L = S.torso * (1 - 0.42 * sa) + (a < 0 ? 2 : 0) - squash + bob + jit;
  const hunch = 3 + 7 * sa + (lose ? 3 * fb : 0);
  let headUp = S.head * 0.9 * (1 - 0.72 * sa) - land * 3 + bobH * 0.5;
  if (lose) headUp -= 5 * fb;
  if (win) headUp += 3 * raise;

  // 몸 기울기 (엉덩이 축): 꺾는 쪽으로 + 충돌 흔들림 + 성격
  let tilt = steer * 0.09 * S.turn + shake * 0.15 * hd;
  if (S.sway) tilt += Math.sin(t * 5.3) * 0.045 * move * (1 - fb);
  if (win) tilt += Math.sin(fin * 4.5) * 0.05 * raise;
  tilt += free * 0.08;

  // 고개: 가는 쪽을 본다 · 출발 전 두리번 · 1등은 카메라 쪽을 돌아보며 웃는다 · 아쉬우면 고개를 젓는다
  let look = steer * 0.55 * S.look + shakeL * 0.3;
  if (!done) look += Math.sin(t * 0.9) * 0.5 * (1 - move);
  look *= 1 - fb;
  if (win) look += 0.72 * raise;
  if (podium) look += 0.4 * raise;
  if (lose) look += Math.sin(fin * 6) * 0.32 * fb * clamp(2.4 - fin, 0, 1);
  look = clamp(look, -1, 1);
  let headRoll = steer * 0.1 * S.turn + shakeL * 0.14;
  if (S.trick) headRoll += Math.sin(t * 4.2) * 0.05 * move;
  if (lose) headRoll += 0.06 * fb;

  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const T = (x, y) => [hipX + x * ct - y * st, hipY + x * st + y * ct];
  const head = T(look * 3, -L - headUp);

  // 핸들: 꺾으면 꺾는 쪽 손잡이가 몸 쪽(화면 아래)으로 온다
  // 손잡이 높이: 레이스 자세일 때 어깨보다 조금 아래 (체형마다 맞춘다 — 핸들은 제트스키에 붙어 있어 몸이 움직여도 그대로)
  const gx = stand ? 36 : Math.round(hb.w * 0.38);
  const baseL = S.torso * (1 - 0.42 * Math.sin(S.lean));
  const hyB = (stand ? -72 : -22) - baseL + 9;
  const bx = sk * 0.45;
  const th = steer * 0.3;
  const grips = [-1, 1].map((s) => [bx + s * gx * Math.cos(th), hyB + s * gx * Math.sin(th) * 0.35]);

  const arms = [-1, 1].map((s, i) => {
    const sh = T(s * (S.shW - 5), -L + 5 - hunch * 0.3);
    const g = grips[i];
    // 팔꿈치: 어깨와 손잡이 사이에서 바깥 · 아래로 굽는다 (앞으로 뻗어 핸들을 잡은 모양)
    const out = S.elbow + boost * 3 + land * 5 + kick * 2 - rise * 3;
    let el = [Math.max(Math.abs(g[0]), Math.abs(sh[0]) + 17) * s + s * out * 0.5, Math.max(sh[1], g[1]) + 6 + boost * 4 + land * 3];
    let hand = g.slice();
    let off = 0;
    if (s > 0 && raise > 0) {
      const up = win ? [sh[0] + 9 + wave * 5, sh[1] - 50] : [sh[0] + 15, sh[1] - 26 - wave * 9];
      hand = [lerp(g[0], up[0], raise), lerp(g[1], up[1], raise)];
      el = [lerp(el[0], sh[0] + 20, raise), lerp(el[1], sh[1] - (win ? 22 : 8), raise)];
      off = raise;
    }
    if (s < 0 && free > 0) {
      const up = [sh[0] - 20, sh[1] - 34 + Math.sin(t * 16) * 5];
      hand = [lerp(g[0], up[0], free), lerp(g[1], up[1], free)];
      el = [lerp(el[0], sh[0] - 24, free), lerp(el[1], sh[1] - 8, free)];
      off = free;
    }
    // 충돌: 팔이 흔들린다 (손은 핸들을 놓지 않는다)
    el[0] += shake * 3 * s;
    el[1] += shakeL * 2;
    return { s, sh, el, hand, off };
  });

  const legs = [-1, 1].map((s) => {
    if (stand) {
      const foot = [s * 20 + sk * 0.05, -2];
      const hip = [hipX * 0.6 + s * S.hip * 0.55, hipY + 4];
      const bend = 6 + crouchS * 0.8 + bob * 0.5;
      const knee = [hipX * 0.3 + s * (S.hip + 7 + bend * 0.35), (hipY + foot[1]) / 2 - 4 - bend * 0.45 + s * steer * 2];
      return { s, hip, knee, foot };
    }
    const fx = (hb.w * 0.23 + hb.w * 0.5 - 8) / 2 + 2; // 발판 가운데
    const lift = airS * (6 + 5 * fall);
    const hip = [hipX + s * S.hip * 0.5, hipY + 3];
    const knee = [hipX * 0.5 + s * (S.hip + 7 + land * 5 + airS * 5), hipY - 8 - airS * 9 + land * 3 + s * steer * 2.5];
    let foot = [s * fx + sk * 0.08, -5 - lift];
    if (S.trick && s > 0 && free > 0) foot = [lerp(foot[0], s * (fx + 22), free), lerp(foot[1], -14, free)];
    return { s, hip, knee, foot };
  });

  return { t, sp, steer, boost, kick, airS, rise, fall, land, hit, move, done, win, lose, fb, raise, free, a, sa, hipX, hipY, L, hunch, headUp, tilt, T, head, look, headRoll, gx, hyB, bx, grips, arms, legs, stand };
}

/* ================================================================
 * 그리기
 * ============================================================== */
export function drawRider(ctx, R, hb, pose, sk) {
  const S = RIG[R.id] || RIG.jihyeok;
  const J = rig(R, S, hb, pose, sk);
  const lod = pose.k == null ? 1 : pose.k;
  drawBars(ctx, J, lod);
  if (!J.stand) drawSeat(ctx, hb);
  // 몸이 안장 · 갑판에 드리운 그림자 (붙어 앉은 느낌)
  shadow(ctx, R2(J.hipX), J.stand ? -4 : -10, J.stand ? 30 : 40, 11, 0.34);
  drawLegs(ctx, R, S, J, lod);
  drawHead(ctx, R, S, J, lod);
  drawTorso(ctx, R, S, J, lod);
  if (S.pigtails) drawPigtails(ctx, R, S, J);
  if (S.scarf) drawScarf(ctx, S, J, lod);
  drawArms(ctx, R, S, J, lod);
  if (J.boost > 0.2 && lod > 0.45) drawWind(ctx, S, J);
}

/** 핸들바 (가운데는 몸에 가려지고 양 끝만 보인다) + 작은 백미러 */
function drawBars(ctx, J, lod) {
  const [gl, gr] = J.grips;
  if (J.stand) {
    ctx.beginPath();
    ctx.moveTo(J.bx * 0.3, 0);
    ctx.lineTo(J.bx, J.hyB + 6);
    stroke(ctx, "#454c63", 7);
    ctx.beginPath();
    ctx.moveTo(J.bx * 0.3 - 2, -4);
    ctx.lineTo(J.bx - 2, J.hyB + 8);
    stroke(ctx, alpha("#ffffff", 0.18), 2);
  } else if (lod > 0.2) {
    // 백미러: 앞 덮개 양옆에 작게 (팔 아래로)
    for (const s of [-1, 1]) {
      const mx = J.bx + s * (J.gx - 12);
      const my = J.hyB + 12;
      ctx.beginPath();
      ctx.moveTo(J.bx + s * (J.gx - 22), my + 6);
      ctx.lineTo(mx, my);
      stroke(ctx, "#2a2f40", 2.6);
      ell(ctx, mx + s * 2, my - 2, 6, 4, s * 0.2);
      flat(ctx, "#1f2533");
      ell(ctx, mx + s * 2, my - 2, 4.2, 2.6, s * 0.2);
      flat(ctx, "#b9e6ff");
    }
  }
  ctx.beginPath();
  ctx.moveTo(gl[0], gl[1]);
  ctx.quadraticCurveTo(J.bx, J.hyB + 7, gr[0], gr[1]);
  stroke(ctx, "#2a2f40", 6);
  ctx.beginPath();
  ctx.moveTo(gl[0], gl[1] - 1);
  ctx.quadraticCurveTo(J.bx, J.hyB + 5, gr[0], gr[1] - 1);
  stroke(ctx, "#6b7590", 2);
}

/** 안장: 뒤끝 + 다리 사이로 앞까지 이어지는 윗면 */
function drawSeat(ctx, hb) {
  const w = hb.seat / 2;
  ctx.beginPath();
  ctx.moveTo(-w * 0.86, -12);
  ctx.quadraticCurveTo(-w * 0.82, -40, -w * 0.5, -50);
  ctx.quadraticCurveTo(0, -56, w * 0.5, -50);
  ctx.quadraticCurveTo(w * 0.82, -40, w * 0.86, -12);
  ctx.closePath();
  flat(ctx, "#232a39", 2, "#121722");
  rrect(ctx, -w, -18, hb.seat, 20, 9);
  fill(ctx, "#2a3142", -6, -12, hb.seat * 0.5, 12, 2.4);
  ctx.beginPath();
  ctx.moveTo(-w + 6, -14);
  ctx.quadraticCurveTo(0, -20, w - 6, -14);
  stroke(ctx, alpha("#ffffff", 0.25), 2);
}

/** 다리: 허벅지가 안장 양옆을 감싸고, 정강이가 발판으로 내려와 뒤꿈치가 보인다 */
function drawLegs(ctx, R, S, J, lod) {
  const rd = R.rider;
  for (const g of J.legs) {
    const s = g.s;
    if (S.crab) {
      // 게 다리 두 쌍 (가늘고 마디가 있다)
      for (let i = 1; i >= 0; i--) {
        const ox = i * 7 * s;
        const oy = -i * 8;
        const k = [g.knee[0] + ox + s * 4, g.knee[1] + oy * 0.6 - 4];
        const f = [g.foot[0] + ox * 0.5, g.foot[1] + oy * 0.3 - 1];
        limb(ctx, [g.hip[0] + ox * 0.4, g.hip[1] + oy, k[0], k[1]], 6.5, rd.shell, { line: 2.6, shade: lod > 0.8, hi: false });
        limb(ctx, [k[0], k[1], f[0] + s * 2, f[1] - 6, f[0], f[1]], 5.5, rd.shell, { line: 2.6, shade: lod > 0.8, hi: false });
        circ(ctx, k[0], k[1], 3.6);
        flat(ctx, darken(rd.shell, 0.15), 1.4, lineOf(rd.shell));
        shadow(ctx, R2(f[0]), R2(f[1] + 3), 7, 3, 0.3);
      }
      continue;
    }
    const suit = rd.suit;
    // 허벅지 (엉덩이 → 무릎)
    limb(ctx, [g.hip[0], g.hip[1], (g.hip[0] + g.knee[0]) / 2 + s * 2, g.knee[1] + 6, g.knee[0], g.knee[1]], S.leg, suit, { line: 3, shade: lod > 0.8, hi: lod > 0.8 });
    // 정강이 (무릎 → 발목, 종아리가 바깥으로 살짝)
    const ank = [g.foot[0], g.foot[1] - 7];
    limb(ctx, [g.knee[0], g.knee[1], g.knee[0] + s * 5, (g.knee[1] + ank[1]) / 2, ank[0], ank[1]], S.leg * 0.86, suit, { line: 3, shade: lod > 0.8, hi: lod > 0.8 });
    if (lod > 0.45) {
      // 무릎 보호대
      ell(ctx, g.knee[0], g.knee[1], S.leg * 0.5, S.leg * 0.44);
      ctx.fillStyle = alpha(darken(suit, 0.3), 0.6);
      ctx.fill();
    }
    // 신발 (뒤꿈치) + 발판에 닿은 그림자
    shadow(ctx, R2(g.foot[0]), R2(g.foot[1] + 4), 12, 4, 0.38);
    ell(ctx, g.foot[0], g.foot[1], 9.5, 6.5);
    lf(ctx, S.shoe, g.foot[0], g.foot[1], 9.5, 6.5, 2);
    ctx.beginPath();
    ctx.moveTo(g.foot[0] - 9, g.foot[1] + 2.5);
    ctx.quadraticCurveTo(g.foot[0], g.foot[1] + 8, g.foot[0] + 9, g.foot[1] + 2.5);
    stroke(ctx, "#3a4157", 2.4);
    if (lod > 0.45) {
      ctx.beginPath();
      ctx.moveTo(g.foot[0] - 7, g.foot[1] - 1);
      ctx.lineTo(g.foot[0] + 7, g.foot[1] - 1);
      stroke(ctx, S.shoeLine, 2.2);
    }
  }
}

/* ---------------- 헬멧 · 고글 ---------------- */
const STRAP = { hero: "#1d2233", fin: "#0b4f8e", ears: "#5a2a8c", pirate: "#1a1b2e" };

function quadPt(x0, y0, cx, cy, x1, y1, u) {
  const v = 1 - u;
  return [v * v * x0 + 2 * u * v * cx + u * u * x1, v * v * y0 + 2 * u * v * cy + u * u * y1];
}

function heartPath(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.85);
  ctx.bezierCurveTo(x - r * 1.3, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.3, y - r * 0.1, x, y + r * 0.85);
  ctx.closePath();
}

/** 고글 렌즈 (돌아본 쪽 옆에서 보인다) */
function lens(ctx, S, rd, x, y, m, sd) {
  const vis = rd.visor || "#1d3a5c";
  const g = linear(ctx, `lens${vis}`, 0, -10, 0, 10, [
    [0, lighten(vis, 0.75)],
    [0.45, lighten(vis, 0.25)],
    [1, vis],
  ]);
  ctx.save();
  ctx.translate(x, y);
  if (S.goggle === "heart") {
    heartPath(ctx, 0, 0, 5 + m * 3.5);
    flat(ctx, "#ff8cc6", 2.2, "#8a5bff");
    heartPath(ctx, 0, 0.6, 3.2 + m * 2.4);
    ctx.fillStyle = g;
    ctx.fill();
  } else if (S.goggle === "sharp") {
    // 날카로운 고글: 바깥이 치켜 올라간 모양
    ctx.beginPath();
    ctx.moveTo(-sd * 2, -4);
    ctx.lineTo(sd * (4 + m * 6), -8 - m * 2);
    ctx.lineTo(sd * (5 + m * 6), 1);
    ctx.lineTo(-sd * 2, 4);
    ctx.closePath();
    flat(ctx, "#1a1b2e", 2, "#0a0b16");
    ctx.beginPath();
    ctx.moveTo(-sd * 0.5, -2.5);
    ctx.lineTo(sd * (3.5 + m * 5), -6 - m * 1.5);
    ctx.lineTo(sd * (4 + m * 5), -0.5);
    ctx.lineTo(-sd * 0.5, 2);
    ctx.closePath();
    ctx.fillStyle = "#ffcf4d";
    ctx.fill();
  } else if (S.goggle === "visor") {
    ell(ctx, sd * m * 2, 0, 3 + m * 6, 10 + m * 2);
    flat(ctx, "#101522", 2, "#05070d");
    ell(ctx, sd * m * 2.4, 0, 2 + m * 5, 8 + m * 2);
    ctx.fillStyle = g;
    ctx.fill();
  } else {
    const wide = S.goggle === "wrap" ? 1.25 : 1;
    ell(ctx, 0, 0, (3 + m * 5) * wide, 7.5 + m);
    flat(ctx, S.goggle === "wrap" ? "#0b4f8e" : "#1d2233", 2, "#0a0e1a");
    ell(ctx, sd * 0.6, 0, (2 + m * 4) * wide, 6 + m);
    ctx.fillStyle = g;
    ctx.fill();
  }
  gloss(ctx, sd * 1, -2.5, R2(2 + m * 2), 1.2, 0.85, -0.2);
  ctx.restore();
}

function drawHead(ctx, R, S, J, lod) {
  const rd = R.rider;
  const r = S.head;
  const look = J.look;
  const m = Math.min(1, Math.abs(look));
  const sd = look >= 0 ? 1 : -1;
  const x0 = -look * r * 0.42; // 헬멧 뒤 가운데 선 (고개를 돌리면 반대쪽으로 밀린다)
  const sy = r * 0.1; // 고글 끈 높이
  const skin = S.crab ? rd.shell : rd.skin || "#ffd5b3";
  const headUp = J.headUp;
  ctx.save();
  ctx.translate(J.head[0], J.head[1]);
  ctx.rotate(J.headRoll + J.tilt * 0.5);
  // 목 (똑바로 앉으면 보이고, 숙이면 등에 가려진다)
  if (headUp > r * 0.7) {
    rrect(ctx, -7 + look * 2, r * 0.5, 14, headUp - r * 0.5 + 4, 6);
    ctx.fillStyle = darken(skin, 0.14);
    ctx.fill();
  }
  // 루비: 헬멧 위 동그란 귀
  if (S.helmet === "ears") {
    for (const s of [-1, 1]) {
      const ex = x0 * 0.5 + s * r * 0.62;
      circ(ctx, ex, -r * 0.74, r * 0.34);
      fill(ctx, rd.stripe, R2(ex), R2(-r * 0.74), R2(r * 0.34), R2(r * 0.34), 2.2);
      circ(ctx, ex, -r * 0.72, r * 0.17);
      ctx.fillStyle = "#ffc2e0";
      ctx.fill();
    }
  }
  // 돌아본 쪽 볼 (헬멧 아래 옆으로 살짝)
  if (m > 0.1) {
    const cx = sd * (r * 0.66 + m * 7);
    ell(ctx, cx, r * 0.45, 5 + m * 4, 8.5);
    lf(ctx, skin, cx, r * 0.45, 5 + m * 4, 8.5, 2);
  }
  // 헬멧
  ell(ctx, 0, 0, r, r * 1.03);
  fill(ctx, rd.helmet, 0, 0, R2(r), R2(r * 1.03), 2.8);
  ctx.save();
  ell(ctx, 0, 0, r, r * 1.03);
  ctx.clip();
  ctx.fillStyle = darken(rd.helmet, 0.32);
  ctx.fillRect(-r, r * 0.64, r * 2, r);
  switch (S.helmet) {
    case "hero":
      ctx.fillStyle = rd.stripe;
      ctx.fillRect(x0 - 5.5, -r, 11, r * 2);
      if (lod > 0.45) {
        ctx.fillStyle = "#13b5a8";
        ctx.fillRect(x0 - 9, -r, 2, r * 2);
        ctx.fillRect(x0 + 7, -r, 2, r * 2);
      }
      break;
    case "fin":
      ctx.fillStyle = rd.stripe;
      ctx.fillRect(x0 - 4.5, -r, 9, r * 2);
      break;
    case "ears":
      ctx.fillStyle = rd.stripe;
      ctx.fillRect(x0 - 3.5, -r, 7, r * 2);
      break;
    case "pirate":
      ctx.fillStyle = "#1a1b2e";
      ctx.fillRect(x0 - 5, -r, 10, r * 2);
      ctx.fillStyle = "#ffcf4d";
      ctx.fillRect(x0 - 7, -r, 1.6, r * 2);
      ctx.fillRect(x0 + 5.4, -r, 1.6, r * 2);
      break;
    case "mohawk":
      ctx.fillStyle = rd.stripe;
      ctx.fillRect(x0 - 2.5, -r, 5, r * 2);
      break;
  }
  ctx.restore();
  // 통풍구
  if (lod > 0.45 && (S.helmet === "hero" || S.helmet === "fin")) {
    for (const s of [-1, 1]) {
      rrect(ctx, x0 + s * r * 0.44 - 3, -r * 0.56, 6, 8, 2);
      ctx.fillStyle = alpha("#0d1424", 0.55);
      ctx.fill();
    }
  }
  if (S.helmet === "ears" && lod > 0.45) {
    for (const s of [-1, 1]) starAt(ctx, x0 + s * r * 0.48, -r * 0.34, 3.6, "#ffffff");
  }
  // 고글 끈 · 버클 · 양옆으로 튀어나온 고글 테
  if (S.goggle === "visor") {
    // 통 바이저: 헬멧 아래쪽을 감싸는 짙은 유리 테
    for (const s of [-1, 1]) {
      const vis = 0.5 + Math.max(0, s * look) * 0.8;
      ell(ctx, s * r * 0.96, sy + 2, 2.5 * vis + 1.5, 10);
      flat(ctx, "#101522", 1.6, "#05070d");
    }
  } else {
    const sc = STRAP[S.helmet] || "#1d2233";
    const cx = x0 * 0.6;
    ctx.beginPath();
    ctx.moveTo(-r * 0.99, sy - 2);
    ctx.quadraticCurveTo(cx, sy + 8, r * 0.99, sy - 2);
    stroke(ctx, sc, r * 0.26);
    if (S.helmet === "hero" && lod > 0.5) {
      ctx.fillStyle = alpha("#ffffff", 0.8);
      for (const u of [0.16, 0.3, 0.7, 0.84]) {
        const p = quadPt(-r * 0.99, sy - 2, cx, sy + 8, r * 0.99, sy - 2, u);
        ctx.fillRect(p[0] - 1.5, p[1] - 1, 3, 2);
      }
    }
    if (S.helmet === "pirate" && lod > 0.5) {
      ctx.fillStyle = "#ffcf4d";
      for (const u of [0.2, 0.8]) {
        const p = quadPt(-r * 0.99, sy - 2, cx, sy + 8, r * 0.99, sy - 2, u);
        circ(ctx, p[0], p[1], 1.6);
        ctx.fill();
      }
    }
    const by = sy + 4;
    if (S.helmet === "ears") {
      heartPath(ctx, cx, by, 4.5);
      flat(ctx, "#ffe066", 1.4, "#b08a00");
    } else {
      rrect(ctx, cx - 5, by - 3, 10, 6, 2);
      flat(ctx, S.helmet === "pirate" ? "#ffcf4d" : "#c9d3e6", 1.2, "#5b6478");
    }
    for (const s of [-1, 1]) {
      const vis = 0.5 + Math.max(0, s * look) * 0.8;
      if (S.goggle === "heart") {
        heartPath(ctx, s * r * 0.97, sy - 1, 3 + vis * 1.5);
        flat(ctx, "#ff8cc6", 1.6, "#8a5bff");
      } else if (S.goggle === "sharp") {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.9, sy - 5);
        ctx.lineTo(s * (r * 0.98 + 3 * vis), sy - 8);
        ctx.lineTo(s * (r * 0.98 + 2 * vis), sy + 3);
        ctx.lineTo(s * r * 0.9, sy + 3);
        ctx.closePath();
        flat(ctx, "#1a1b2e", 1.4, "#0a0b16");
      } else {
        // 고글 테가 헬멧 옆으로 반달처럼 살짝 나온다 (돌아본 쪽이 더 크게)
        const wrap = S.goggle === "wrap";
        const rx = (wrap ? 1.6 : 2.2) + (wrap ? 2 : 2.8) * vis;
        const ry = wrap ? 6.5 : 8;
        const cx = s * r * 0.9;
        ctx.beginPath();
        ctx.ellipse(cx, sy - 1, rx + 2, ry, 0, -Math.PI / 2, Math.PI / 2, s < 0);
        ctx.closePath();
        flat(ctx, wrap ? "#0b4f8e" : "#1d2233", 1.4, "#0a0e1a");
        ctx.beginPath();
        ctx.ellipse(cx, sy - 1, rx, ry - 2.2, 0, -Math.PI / 2, Math.PI / 2, s < 0);
        ctx.closePath();
        ctx.fillStyle = wrap ? "#3fe0ff" : lighten(rd.visor || "#1d3a5c", 0.35);
        ctx.fill();
      }
    }
  }
  // 위 장식: 스포일러 · 상어 지느러미 · 해적 모자 볏 · 모히칸
  topParts(ctx, R, S, r, x0, lod);
  // 반짝임 + 위쪽 테두리 빛 (밝은 바다에서도 윤곽이 서도록)
  gloss(ctx, -r * 0.4, -r * 0.5, r * 0.42, r * 0.2, 0.75);
  ctx.beginPath();
  ctx.arc(0, 0, r - 1.6, Math.PI * 1.08, Math.PI * 1.42);
  stroke(ctx, alpha("#ffffff", 0.45), 2);
  // 번호 (주인공)
  if (S.helmet === "hero" && lod > 0.45) {
    ctx.font = `${R2(r * 0.46)}px "Bagel Fat One", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(R.no, x0, -r * 0.3);
    ctx.fillStyle = "#1d3a5c";
    ctx.fillText(R.no, x0, -r * 0.3);
  }
  // 돌아본 쪽: 고글 렌즈 + (많이 돌아보면) 웃는 입과 볼터치
  if (m > 0.1) {
    lens(ctx, S, rd, sd * (r * 0.84 + m * 5), sy - 1, m, sd);
    if (m > 0.45 && lod > 0.35) {
      const mx = sd * (r * 0.8 + m * 8);
      const my = r * 0.62;
      ctx.beginPath();
      ctx.arc(mx, my - 2.5, 3.6, 0.15 * Math.PI, 0.85 * Math.PI);
      stroke(ctx, INK, 1.8);
      blush(ctx, mx - sd * 1.5, my - 7, 3.2);
    }
  }
  ctx.restore();
}

function starAt(ctx, x, y, r, c) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
}

function topParts(ctx, R, S, r, x0, lod) {
  const rd = R.rider;
  if (S.helmet === "hero" && lod > 0.2) {
    // 리어 스포일러 (청록)
    ctx.save();
    ctx.translate(x0 * 0.5, -r * 0.7);
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 2);
    ctx.quadraticCurveTo(0, -5, r * 0.5, 2);
    ctx.lineTo(r * 0.46, 6.5);
    ctx.quadraticCurveTo(0, 0.5, -r * 0.46, 6.5);
    ctx.closePath();
    flat(ctx, "#13b5a8", 2, lineOf("#13b5a8"));
    ctx.beginPath();
    ctx.moveTo(-r * 0.36, 1.6);
    ctx.quadraticCurveTo(0, -3.4, r * 0.36, 1.6);
    stroke(ctx, alpha("#ffffff", 0.55), 1.4);
    ctx.restore();
  } else if (S.helmet === "fin") {
    // 상어 등지느러미
    const fx = x0 * 0.7;
    ctx.beginPath();
    ctx.moveTo(fx - 6, -r * 0.8);
    ctx.quadraticCurveTo(fx, -r * 1.5, fx + 13, -r * 1.85);
    ctx.quadraticCurveTo(fx + 7, -r * 1.35, fx + 8, -r * 0.78);
    ctx.closePath();
    fill(ctx, R.body, R2(fx + 3), R2(-r * 1.3), 10, 14, 2.4);
    ctx.beginPath();
    ctx.moveTo(fx - 1, -r * 1.02);
    ctx.quadraticCurveTo(fx + 3, -r * 1.4, fx + 9, -r * 1.65);
    stroke(ctx, alpha("#ffffff", 0.5), 1.6);
  } else if (S.helmet === "pirate") {
    // 해적 선장 볏 (삼각 모자 모양) — 넓고 위로 꺾인 양 끝
    ctx.save();
    ctx.translate(x0 * 0.4, 0);
    ctx.beginPath();
    ctx.moveTo(-r * 1.22, -r * 0.3);
    ctx.quadraticCurveTo(-r * 1.3, -r * 0.92, -r * 0.82, -r * 1.02);
    ctx.quadraticCurveTo(-r * 0.36, -r * 0.78, 0, -r * 1.28);
    ctx.quadraticCurveTo(r * 0.36, -r * 0.78, r * 0.82, -r * 1.02);
    ctx.quadraticCurveTo(r * 1.3, -r * 0.92, r * 1.22, -r * 0.3);
    ctx.quadraticCurveTo(0, -r * 0.62, -r * 1.22, -r * 0.3);
    ctx.closePath();
    fill(ctx, rd.hat || "#2b2d4a", 0, R2(-r * 0.8), R2(r * 1.2), R2(r * 0.5), 2.4);
    ctx.beginPath();
    ctx.moveTo(-r * 1.18, -r * 0.36);
    ctx.quadraticCurveTo(0, -r * 0.66, r * 1.18, -r * 0.36);
    stroke(ctx, "#ffcf4d", 2.6);
    if (lod > 0.45) {
      // 작은 해골 배지
      circ(ctx, 0, -r * 0.86, 4.2);
      flat(ctx, "#ffffff", 1.2, "#7a8090");
      ctx.beginPath();
      ctx.moveTo(-5, -r * 0.86 + 6);
      ctx.lineTo(5, -r * 0.86 + 2);
      ctx.moveTo(5, -r * 0.86 + 6);
      ctx.lineTo(-5, -r * 0.86 + 2);
      stroke(ctx, "#ffffff", 1.6);
    }
    ctx.restore();
  } else if (S.helmet === "mohawk") {
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.6;
      const rr = i % 2 ? 24 : 34;
      ctx.lineTo(x0 * 0.6 + Math.cos(a) * rr * 0.55, -r * 0.55 + Math.sin(a) * rr);
    }
    ctx.lineTo(x0 * 0.6 + 2, -r * 0.62);
    ctx.closePath();
    fill(ctx, rd.stripe, R2(x0 * 0.6 - 6), R2(-r * 1.3), 12, 18, 2.4);
  }
}

/* ---------------- 몸통 ---------------- */
/** 등 모양: 숙일수록 어깨(승모근)가 올라가 목 둘레가 W 모양이 된다 */
function backPath(ctx, sh, wa, L, hunch) {
  ctx.beginPath();
  ctx.moveTo(-wa, 6);
  ctx.bezierCurveTo(-wa - 1, -L * 0.3, -sh + 1, -L * 0.52, -sh, -L + 7);
  ctx.quadraticCurveTo(-sh + 1, -L - hunch * 0.55, -sh * 0.52, -L - hunch);
  ctx.quadraticCurveTo(-sh * 0.16, -L - hunch * 0.55, 0, -L + 1);
  ctx.quadraticCurveTo(sh * 0.16, -L - hunch * 0.55, sh * 0.52, -L - hunch);
  ctx.quadraticCurveTo(sh - 1, -L - hunch * 0.55, sh, -L + 7);
  ctx.bezierCurveTo(sh - 1, -L * 0.52, wa + 1, -L * 0.3, wa, 6);
  ctx.quadraticCurveTo(0, 11, -wa, 6);
  ctx.closePath();
}

function vestPath(ctx, sh, wa, L, hunch) {
  ctx.beginPath();
  ctx.moveTo(-wa - 1, 3);
  ctx.bezierCurveTo(-wa - 2, -L * 0.3, -sh + 5, -L * 0.52, -sh + 6, -L + 9);
  ctx.quadraticCurveTo(-sh + 7, -L - hunch * 0.5, -sh * 0.48, -L - hunch * 0.92);
  ctx.quadraticCurveTo(-sh * 0.2, -L - hunch * 0.4, 0, -L + 3);
  ctx.quadraticCurveTo(sh * 0.2, -L - hunch * 0.4, sh * 0.48, -L - hunch * 0.92);
  ctx.quadraticCurveTo(sh - 7, -L - hunch * 0.5, sh - 6, -L + 9);
  ctx.bezierCurveTo(sh - 5, -L * 0.52, wa + 2, -L * 0.3, wa + 1, 3);
  ctx.quadraticCurveTo(0, 8, -wa - 1, 3);
  ctx.closePath();
}

function drawTorso(ctx, R, S, J, lod) {
  const rd = R.rider;
  const L = J.L;
  const hunch = J.hunch;
  const sh = S.shW;
  const wa = S.waist;
  const body = S.crab ? rd.shell : rd.suit;
  ctx.save();
  ctx.translate(J.hipX, J.hipY);
  ctx.rotate(J.tilt);
  // 엉덩이 (안장에 눌려 앉은 모양)
  ell(ctx, 0, 2, S.hip + 1, 11);
  lf(ctx, darken(body, 0.12), -4, -2, S.hip + 1, 11, 2.6);
  // 등
  backPath(ctx, sh, wa, L, hunch);
  lf(ctx, body, -sh * 0.2, -L * 0.6, sh * 1.1, L * 0.75, 2.8);
  if (S.crab) {
    // 등딱지 무늬 + 레이싱 하네스 조끼
    ctx.save();
    backPath(ctx, sh, wa, L, hunch);
    ctx.clip();
    ctx.fillStyle = alpha(lighten(rd.shell, 0.4), 0.55);
    for (const [x, y, rr] of [
      [-sh * 0.62, -L * 0.42, 5],
      [sh * 0.6, -L * 0.5, 4.4],
      [-sh * 0.7, -L * 0.8, 3.4],
      [sh * 0.72, -L * 0.18, 3.6],
    ]) {
      circ(ctx, x, y, rr);
      ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-wa * 0.62, 4);
    ctx.bezierCurveTo(-wa * 0.7, -L * 0.4, -sh * 0.55, -L * 0.7, -sh * 0.44, -L - hunch * 0.7);
    ctx.quadraticCurveTo(-sh * 0.18, -L - hunch * 0.3, 0, -L + 4);
    ctx.quadraticCurveTo(sh * 0.18, -L - hunch * 0.3, sh * 0.44, -L - hunch * 0.7);
    ctx.bezierCurveTo(sh * 0.55, -L * 0.7, wa * 0.7, -L * 0.4, wa * 0.62, 4);
    ctx.quadraticCurveTo(0, 8, -wa * 0.62, 4);
    ctx.closePath();
    lf(ctx, rd.vest, -4, -L * 0.6, sh * 0.6, L * 0.7, 2.4);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#ffcf4d";
    ctx.fillRect(-sh, -L * 0.36, sh * 2, 3.4);
    ctx.restore();
    if (lod > 0.6) {
      ctx.font = '13px "Bagel Fat One", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffcf4d";
      ctx.fillText(R.no, 0, -L * 0.62);
    }
  } else if (rd.vest && !S.bolt) {
    vestPath(ctx, sh, wa, L, hunch);
    lf(ctx, rd.vest, -sh * 0.15, -L * 0.6, sh * 0.95, L * 0.72, 2.6);
    ctx.save();
    vestPath(ctx, sh, wa, L, hunch);
    ctx.clip();
    if (rd.panel) {
      // 옆 색 패널 (샤키)
      ctx.fillStyle = rd.panel;
      ctx.fillRect(-sh, -L, sh * 0.42, L + 10);
      ctx.fillRect(sh * 0.58, -L, sh * 0.42, L + 10);
    }
    // 반사띠
    ctx.fillStyle = rd.band || "rgba(255,255,255,0.88)";
    ctx.fillRect(-sh, -L * 0.36, sh * 2, 5);
    // 가운데 솔기
    ctx.beginPath();
    ctx.moveTo(0, -L + 6);
    ctx.lineTo(0, 4);
    stroke(ctx, alpha(darken(rd.vest, 0.5), 0.25), 1.4);
    // 아래쪽 그늘 (안장 쪽)
    ctx.fillStyle = alpha(darken(rd.vest, 0.45), 0.22);
    ctx.fillRect(-sh, -6, sh * 2, 14);
    ctx.restore();
    if (S.name && lod > 0.6) {
      ctx.font = '9px "Bagel Fat One", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = alpha(darken(rd.vest, 0.5), 0.92);
      ctx.fillText(R.en, 0, -L * 0.17);
    }
    if (rd.badge && lod > 0.45) starAt(ctx, 0, -L * 0.62, 6, rd.badge);
    if (rd.no && lod > 0.6) {
      ctx.font = '11px "Bagel Fat One", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rd.no;
      ctx.fillText(R.no, 0, -L * 0.62);
    }
    // 옆 버클
    if (lod > 0.45 && !S.name) {
      for (const s of [-1, 1]) {
        rrect(ctx, s * (wa - 3) - 4, -12, 8, 9, 2);
        flat(ctx, "#22283a", 1.2, "#0e1220");
      }
    }
  } else if (S.bolt) {
    // 블리츠: 등에 번개 무늬
    ctx.beginPath();
    ctx.moveTo(-10, -L + 10);
    ctx.lineTo(4, -L * 0.62);
    ctx.lineTo(-5, -L * 0.55);
    ctx.lineTo(10, -L * 0.18);
    stroke(ctx, rd.vest, 5);
    if (lod > 0.45) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * (sh - 4), -L + 10);
        ctx.lineTo(s * (wa + 1), 2);
        stroke(ctx, alpha(rd.vest, 0.8), 2);
      }
    }
  }
  // 헬멧 아래 그늘 (숙이면 목 둘레가 어둡다) · 어깨 위 빛
  shadow(ctx, R2(J.look * 3), R2(-L + 4), 16, 5, Math.round(J.sa * 10) * 0.03);
  if (lod > 0.35) {
    for (const s of [-1, 1]) gloss(ctx, s * sh * 0.55, -L - hunch + 5, 7, 3, s < 0 ? 0.45 : 0.22, -0.2 * s);
  }
  // 샤키 꼬리 (조끼 아래로 나와 안장 위에서 살랑)
  if (S.tail) {
    const wag = Math.sin(J.t * 8) * 6 * (0.4 + J.sp);
    ctx.save();
    ctx.translate(0, 4);
    ctx.beginPath();
    ctx.moveTo(-7, -4);
    ctx.quadraticCurveTo(-4 + wag * 0.3, 12, -2 + wag, 20);
    ctx.lineTo(-18 + wag, 31);
    ctx.quadraticCurveTo(wag, 27, 16 + wag, 33);
    ctx.lineTo(6 + wag, 20);
    ctx.quadraticCurveTo(7, 10, 7, -4);
    ctx.closePath();
    lf(ctx, rd.skin, wag, 16, 17, 17, 2.4);
    ctx.restore();
  }
  ctx.restore();
}

/* ---------------- 팔 · 손 ---------------- */
function drawArms(ctx, R, S, J, lod) {
  const rd = R.rider;
  for (const A of J.arms) {
    const s = A.s;
    const upper = S.crab ? rd.shell : rd.suit;
    const fore = S.crab ? rd.shell : S.sleeve === "short" ? rd.skin : rd.suit;
    const mid = [(A.sh[0] + A.el[0]) / 2 + s * 2, (A.sh[1] + A.el[1]) / 2 - 3];
    if (S.crab) {
      limb(ctx, [A.sh[0], A.sh[1], mid[0], mid[1], A.el[0], A.el[1]], S.arm, upper, { line: 2.6, shade: lod > 0.8, hi: lod > 0.8 });
      limb(ctx, [A.el[0], A.el[1], A.hand[0], A.hand[1]], S.arm * 0.9, upper, { line: 2.6, shade: lod > 0.8, hi: lod > 0.8 });
      circ(ctx, A.el[0], A.el[1], 4.2);
      flat(ctx, darken(rd.shell, 0.15), 1.4, lineOf(rd.shell));
      drawClaw(ctx, rd, A, J);
      continue;
    }
    // 핸들을 쥔 손은 팔보다 앞(멀리)에 있어서 아래팔 끝에 살짝 가려진다 → 앞으로 뻗은 팔
    const gripping = A.off < 0.5;
    if (gripping) drawGlove(ctx, S, A, lod);
    const fe = gripping ? [lerp(A.el[0], A.hand[0], 0.78), lerp(A.el[1], A.hand[1], 0.78)] : A.hand;
    limb(ctx, [A.el[0], A.el[1], fe[0], fe[1]], S.arm * (gripping ? 0.95 : 0.86), fore, { line: 3, shade: lod > 0.8, hi: lod > 0.8 });
    limb(ctx, [A.sh[0], A.sh[1], mid[0], mid[1], A.el[0], A.el[1]], S.arm, upper, { line: 3, shade: lod > 0.8, hi: lod > 0.8 });
    if (S.sleeve === "short") {
      // 짧은 소매 끝 + 아래팔 작은 지느러미 (샤키)
      ell(ctx, A.el[0] + (A.sh[0] - A.el[0]) * 0.22, A.el[1] + (A.sh[1] - A.el[1]) * 0.22, S.arm * 0.62, S.arm * 0.5);
      flat(ctx, rd.panel || rd.suit, 1.6, lineOf(rd.suit));
      if (lod > 0.45) {
        const fx = (A.el[0] + A.hand[0]) / 2 + s * 4;
        const fy = (A.el[1] + A.hand[1]) / 2;
        ctx.beginPath();
        ctx.moveTo(fx - s * 2, fy - 4);
        ctx.lineTo(fx + s * 8, fy + 2);
        ctx.lineTo(fx - s * 2, fy + 4);
        ctx.closePath();
        flat(ctx, darken(rd.skin, 0.1), 1.4, lineOf(rd.skin));
      }
    }
    if (S.padLine && lod > 0.45) {
      // 소매 바깥 줄무늬 (주인공)
      ctx.save();
      ctx.translate(s * 1.5, -2.5);
      ctx.beginPath();
      ctx.moveTo(lerp(A.sh[0], A.el[0], 0.18), lerp(A.sh[1], A.el[1], 0.18));
      ctx.quadraticCurveTo(mid[0], mid[1], lerp(A.sh[0], A.el[0], 0.92), lerp(A.sh[1], A.el[1], 0.92));
      stroke(ctx, S.padLine, 2.2);
      ctx.restore();
    }
    if (S.elbowPad && lod > 0.45) {
      ell(ctx, A.el[0], A.el[1], 5, 4.5);
      lf(ctx, lighten(rd.suit, 0.12), A.el[0], A.el[1], 5, 4.5, 1.4);
    }
    if (!gripping) drawGlove(ctx, S, A, lod);
  }
  // 어깨 (윗팔이 시작되는 둥근 어깨) — 팔 방향으로 납작하게
  for (const A of J.arms) {
    const s = A.s;
    const c = S.crab ? rd.shell : S.pad || rd.suit;
    const rr = S.crab ? S.arm * 0.95 : S.arm * 0.72;
    const ang = Math.atan2(A.el[1] - A.sh[1], A.el[0] - A.sh[0]);
    ell(ctx, A.sh[0] + s * 1.5, A.sh[1] - 1, rr * 1.15, rr * 0.82, ang);
    lf(ctx, c, A.sh[0] + s * 1.5, A.sh[1] - 1, rr * 1.15, rr * 0.82, 2.2);
    if (S.padLine && lod > 0.35) {
      ctx.beginPath();
      ctx.ellipse(A.sh[0] + s * 1.5, A.sh[1] - 1, rr * 0.8, rr * 0.5, ang, Math.PI * 1.1, Math.PI * 1.9);
      stroke(ctx, S.padLine, 2.4);
    }
  }
}

/** 장갑: 핸들을 쥐면 손등과 손가락 마디, 놓으면 주먹 */
function drawGlove(ctx, S, A, lod) {
  const s = A.s;
  const [x, y] = A.hand;
  const ang = Math.atan2(y - A.el[1], x - A.el[0]);
  ctx.save();
  ctx.translate(x, y);
  ctx.save();
  ctx.rotate(ang);
  rrect(ctx, -11, -5.5, 8, 11, 3);
  flat(ctx, S.cuff, 1.6, lineOf(S.cuff));
  ctx.restore();
  ell(ctx, 0, -1, 8.5, 7.5, s * 0.15);
  fill(ctx, S.glove, 0, -1, 8.5, 8, 2.2);
  if (lod > 0.45) {
    ctx.beginPath();
    ctx.moveTo(-5, 2.5);
    ctx.quadraticCurveTo(0, 5, 5, 2.5);
    stroke(ctx, alpha(darken(S.glove, 0.45), 0.7), 1.4);
    ell(ctx, -s * 6, -2, 3.2, 4, -s * 0.5);
    fill(ctx, S.glove, -s * 6, -2, 3, 4, 1.6);
  }
  ctx.restore();
}

/** 집게 (캡틴 크랩): 핸들 끝을 위아래로 꽉 문다. 들어 올리면 딱딱! */
function drawClaw(ctx, rd, A, J) {
  const s = A.s;
  const [x, y] = A.hand;
  const snap = A.off > 0.2 ? Math.abs(Math.sin(J.t * 10)) : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-s * 2, 2);
  ctx.quadraticCurveTo(s * 14, 10, s * 18, -1 + snap * 5);
  ctx.quadraticCurveTo(s * 10, 3, -s * 2, -2);
  ctx.closePath();
  fill(ctx, rd.shell, s * 8, 3, 10, 6, 2);
  ell(ctx, -s * 3, -4, 12, 9.5, s * 0.25);
  fill(ctx, rd.shell, -s * 3, -4, 12, 10, 2.4);
  ctx.beginPath();
  ctx.moveTo(s * 2, -10);
  ctx.quadraticCurveTo(s * 14, -16 - snap * 8, s * 19, -6 - snap * 4);
  ctx.quadraticCurveTo(s * 10, -6, s * 4, -3);
  ctx.closePath();
  fill(ctx, rd.shell, s * 10, -9, 9, 6, 2);
  gloss(ctx, -s * 6, -8, 5, 2.4, 0.55);
  ctx.restore();
}

/* ---------------- 바람에 날리는 것들 ---------------- */
/** 루비 양 갈래 머리 */
function drawPigtails(ctx, R, S, J) {
  const rd = R.rider;
  const r = S.head;
  const rot = J.headRoll + J.tilt * 0.5;
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  for (const s of [-1, 1]) {
    const px = s * r * 0.78;
    const py = r * 0.28;
    const root = [J.head[0] + px * c - py * sn, J.head[1] + px * sn + py * c];
    const flap = Math.sin(J.t * 14 + s) * 5 * (0.4 + J.sp) + J.boost * s * 4;
    const end = [root[0] + s * 12 + flap * 1.3, root[1] + 30 - J.sp * 6 - J.airS * 12];
    for (const [col, w] of [
      [lineOf(rd.hair), 12],
      [rd.hair, 8.5],
    ]) {
      ctx.beginPath();
      ctx.moveTo(root[0], root[1]);
      ctx.bezierCurveTo(root[0] + s * 14, root[1] + 2, end[0] + s * 6, end[1] - 14, end[0], end[1]);
      stroke(ctx, col, w);
    }
    circ(ctx, root[0] + s * 2, root[1] + 2, 4.2);
    flat(ctx, R.accent, 1.2, "#b08a00");
  }
}

/** 지혁 스카프: 목 뒤 매듭 + 바람에 같은 쪽으로 펄럭이는 두 꼬리 (속도 · 부스트를 보여 준다) */
function drawScarf(ctx, S, J, lod) {
  const c = S.scarf;
  const [kx, ky] = J.T(J.look * 2, -J.L + 3);
  const sp = J.sp;
  const b = J.boost;
  // 바람은 뒤(화면 아래)로, 꺾는 반대쪽으로 흘러간다
  const drift = 20 - J.steer * 12;
  if (lod > 0.2) {
    for (let i = 0; i < 2; i++) {
      const len = (i ? 12 : 18) + sp * 8 + b * 9;
      const f = J.t * (12 + b * 10) + i * 2.1;
      const x0 = kx + (i ? 3 : -2);
      const y0 = ky + 3;
      const ex = x0 + drift * (i ? 0.8 : 1) + Math.sin(f - 1.6) * 3;
      const ey = y0 + len;
      for (const [col, w] of [
        [lineOf(c), i ? 7 : 8.4],
        [c, i ? 4.4 : 5.6],
      ]) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x0 + Math.sin(f) * 4, y0 + len * 0.35, ex - Math.sin(f - 0.8) * 4, y0 + len * 0.7, ex, ey);
        stroke(ctx, col, w);
      }
    }
  }
  ell(ctx, kx, ky, 7.5, 5);
  lf(ctx, c, kx, ky, 7.5, 5, 2);
}

/** 부스트 바람 줄 (헬멧 · 어깨 옆을 스쳐 지나간다) */
function drawWind(ctx, S, J) {
  ctx.save();
  ctx.globalAlpha = 0.55 * J.boost;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const s = i % 2 ? 1 : -1;
    const ph = (J.t * 3.2 + i * 0.37) % 1;
    const x = J.head[0] + s * (S.head + 5 + i * 3);
    const y = J.head[1] - 8 + i * 8 + ph * 22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 3, y + 14);
    ctx.stroke();
  }
  ctx.restore();
}
