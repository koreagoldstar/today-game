/*
 * 공 물리: 비행(중력 · 공기 저항 · 양력 · 휘어짐 · 바람) → 튀기 → 구르기(경사 · 잔디 저항) → 컵
 *  화면 없이 돌아가므로 같은 코드로 낙하 지점 미리보기 · 봇 점검까지 한다.
 */
export const G = 9.81;
const DRAG = 0.0046;
const STEP = 1 / 120;
export const CUP_R = 0.2;
export const BALL_R = 0.06;
export const WIND_K = 2.1; // 바람이 공을 미는 정도 (게임 쪽으로 키움)

/** carry: 평지 · 바람 없음 · 정타 기준 날아가는 거리(m) */
export const CLUBS = [
  { id: "DR", name: "드라이버", short: "1W", carry: 232, launch: 13, lift: 0.0026, bite: 0 },
  { id: "3W", name: "3번 우드", short: "3W", carry: 204, launch: 15, lift: 0.0026, bite: 0.05 },
  { id: "5I", name: "5번 아이언", short: "5I", carry: 172, launch: 19, lift: 0.0026, bite: 0.2 },
  { id: "7I", name: "7번 아이언", short: "7I", carry: 146, launch: 25, lift: 0.0026, bite: 0.35 },
  { id: "9I", name: "9번 아이언", short: "9I", carry: 120, launch: 33, lift: 0.0025, bite: 0.5 },
  { id: "PW", name: "피칭 웨지", short: "PW", carry: 96, launch: 41, lift: 0.0024, bite: 0.65 },
  { id: "SW", name: "샌드 웨지", short: "SW", carry: 68, launch: 52, lift: 0.0022, bite: 0.8 },
  { id: "PT", name: "퍼터", short: "PT", putter: true },
];
export const PUTT_RANGES = [4, 8, 16, 32];

/* e: 튀는 정도 · keep: 튈 때 남는 속도 · roll: 구를 때 저항(m/s²) · lie: 이 땅에서 칠 때 힘 · err: 빗나감 */
export const GROUND = {
  tee: { name: "티잉 그라운드", e: 0.34, keep: 0.6, roll: 2.5, lie: 1, err: 1 },
  fairway: { name: "페어웨이", e: 0.34, keep: 0.6, roll: 2.5, lie: 1, err: 1 },
  first: { name: "퍼스트 컷", e: 0.28, keep: 0.5, roll: 3.2, lie: 0.95, err: 1.1 },
  rough: { name: "러프", e: 0.2, keep: 0.34, roll: 6, lie: 0.84, err: 1.35 },
  deep: { name: "깊은 러프", e: 0.14, keep: 0.22, roll: 9, lie: 0.7, err: 1.7 },
  fringe: { name: "그린 주변", e: 0.3, keep: 0.5, roll: 1.8, lie: 1, err: 1 },
  green: { name: "그린", e: 0.28, keep: 0.5, roll: 0.82, lie: 1, err: 0.8 },
  sand: { name: "벙커", e: 0.05, keep: 0.08, roll: 14, lie: 0.66, err: 1.5 },
  water: { name: "물", e: 0, keep: 0, roll: 99, lie: 0, err: 1 },
  ob: { name: "OB", e: 0.2, keep: 0.3, roll: 8, lie: 0, err: 1 },
};

/** 공 하나 (상태만) */
export function newBall(x, y, z) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, mode: "rest", side: 0, lift: 0, bite: 0, t: 0, bounces: 0, firstHit: null, leaf: 0, tree: false, pole: false, surf: "tee", result: null, lipped: 0 };
}

export function flightStep(b, wind, dt) {
  const wx = wind ? wind.x * WIND_K : 0;
  const wz = wind ? wind.z * WIND_K : 0;
  const rx = b.vx - wx;
  const rz = b.vz - wz;
  const ry = b.vy;
  const sp = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1e-4;
  let ax = -DRAG * sp * rx;
  let ay = -G - DRAG * sp * ry;
  let az = -DRAG * sp * rz;
  // 양력 (속도에 수직 · 위쪽으로)
  const hs = Math.sqrt(rx * rx + rz * rz) || 1e-4;
  const lift = b.lift * sp * sp;
  ax += (-ry / sp) * (rx / hs) * lift;
  ay += (hs / sp) * lift;
  az += (-ry / sp) * (rz / hs) * lift;
  // 휘어짐 (오른쪽이 +)
  if (b.side) {
    const k = b.side * sp * sp;
    ax += (-rz / hs) * k;
    az += (rx / hs) * k;
  }
  b.vx += ax * dt;
  b.vy += ay * dt;
  b.vz += az * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
}

/** 비행 시작 속도를 찾아 둔다 (carry 가 표대로 나오게) */
export function calibrateClubs() {
  for (const c of CLUBS) {
    if (c.putter) continue;
    let lo = 10;
    let hi = 110;
    for (let i = 0; i < 26; i += 1) {
      const v = (lo + hi) / 2;
      const b = launchBall(0, 0, 0, 0, c, 1, 1, 0, 0, v);
      while (b.y > 0 || b.vy > 0) flightStep(b, null, 1 / 60);
      if (Math.hypot(b.x, b.z) < c.carry) lo = v;
      else hi = v;
    }
    c.speed = (lo + hi) / 2;
  }
}

/** 파워 → 속도: carry 가 파워에 거의 비례하게 */
const powerCurve = (p) => Math.pow(p, 0.66);

/**
 * yaw: 0 이 -z(앞) · 오른쪽 +, power: 0~1, lie: 땅 힘, pushDeg: 좌우 어긋남(도), side: 휘어짐
 * speedOverride 는 보정 때만 쓴다.
 */
export function launchBall(x, y, z, yaw, club, power, lie, pushDeg, side, speedOverride) {
  const b = newBall(x, y + BALL_R, z);
  const v = speedOverride || club.speed * powerCurve(power) * lie;
  const el = (club.launch * Math.PI) / 180;
  const a = yaw + (pushDeg * Math.PI) / 180;
  b.vx = Math.sin(a) * Math.cos(el) * v;
  b.vy = Math.sin(el) * v;
  b.vz = -Math.cos(a) * Math.cos(el) * v;
  b.lift = club.lift * (0.45 + 0.55 * power);
  b.side = side;
  b.bite = club.bite;
  b.mode = "fly";
  return b;
}

/** 퍼팅: 평지에서 range × power 만큼 구른다 */
export function puttBall(x, y, z, yaw, range, power, pushDeg, roll = GROUND.green.roll) {
  const b = newBall(x, y + BALL_R, z);
  const v = Math.sqrt(2 * roll * range * Math.max(0.002, power));
  const a = yaw + (pushDeg * Math.PI) / 180;
  b.vx = Math.sin(a) * v;
  b.vz = -Math.cos(a) * v;
  b.mode = "roll";
  return b;
}

/** 첫 착지까지 (미리보기) — 궤적 점들과 착지점 */
export function previewFlight(hole, b, wind, points = null) {
  let n = 0;
  let last = null;
  const dt = 1 / 40;
  while (n < 900) {
    flightStep(b, wind, dt);
    n += 1;
    const h = hole.height(b.x, b.z);
    if (points && n % 2 === 0) points.push(b.x, b.y, b.z);
    if (b.y <= h + BALL_R && b.vy < 0) {
      last = { x: b.x, y: h, z: b.z };
      break;
    }
  }
  return last || { x: b.x, y: hole.height(b.x, b.z), z: b.z };
}

/** 나무 맞음 */
function hitTrees(hole, b, r) {
  for (const t of hole.trees) {
    if (!t.hit) continue;
    const dx = b.x - t.x;
    const dz = b.z - t.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > 30) continue;
    const up = b.y - t.y;
    if (up < 0 || up > t.h) continue;
    // 줄기
    const tr = 0.42 * t.s;
    if (up < 5.6 * t.s && d2 < tr * tr) {
      const d = Math.sqrt(d2) || 1;
      const nx = dx / d;
      const nz = dz / d;
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) {
        b.vx -= 1.5 * vn * nx;
        b.vz -= 1.5 * vn * nz;
        b.vx *= 0.7;
        b.vz *= 0.7;
        b.tree = true;
      }
      return;
    }
    // 잎 (맞으면 속도가 꺾임 · 같은 나무에 한 번만)
    const cr = t.pine ? (1 - (up - 3 * t.s) / (t.h - 3 * t.s)) * 3.3 * t.s : 3.1 * t.s;
    if (up > 3.2 * t.s && d2 < cr * cr && b.leaf !== t) {
      b.leaf = t;
      b.tree = true;
      const k = 0.34 + r() * 0.3;
      b.vx = b.vx * k + (r() - 0.5) * 7;
      b.vy = b.vy * k * 0.5 + (r() - 0.7) * 3;
      b.vz = b.vz * k + (r() - 0.5) * 7;
      b.lift = 0;
      b.side = 0;
      return;
    }
  }
}

/**
 * dt 만큼 진행. 일어난 일은 onEvent(이름, 값) 으로 알려 준다
 * 끝나면 b.mode = "rest" 이고 b.result 가 null / "water" / "ob" / "holed"
 */
export function advance(b, hole, wind, dt, r, onEvent) {
  let left = dt;
  while (left > 1e-6 && b.mode !== "rest") {
    const h = Math.min(STEP, left);
    left -= h;
    b.t += h;
    if (b.mode === "fly") stepFly(b, hole, wind, h, r, onEvent);
    else stepRoll(b, hole, h, r, onEvent);
    if (b.t > 40) b.mode = "rest"; // 안전장치
  }
}

function stepFly(b, hole, wind, h, r, onEvent) {
  flightStep(b, wind, h);
  hitTrees(hole, b, r);
  // 깃대
  const px = b.x - hole.pin.x;
  const pz = b.z - hole.pin.z;
  const d2 = px * px + pz * pz;
  if (!b.pole && d2 < 0.012 && b.y < hole.pin.y + 2.6) {
    b.pole = true;
    b.vx *= -0.16;
    b.vz *= -0.16;
    b.vy *= 0.3;
    if (onEvent) onEvent("pole");
  }
  const gy = hole.height(b.x, b.z);
  if (b.y > gy + BALL_R) return;
  const surf = hole.surface(b.x, b.z);
  b.surf = surf;
  if (!b.firstHit) {
    b.firstHit = { x: b.x, y: gy, z: b.z, surf };
    if (onEvent) onEvent("land", surf);
  }
  if (surf === "water") {
    b.mode = "rest";
    b.result = "water";
    b.y = gy;
    return;
  }
  if (surf === "ob") {
    b.mode = "rest";
    b.result = "ob";
    return;
  }
  const S = GROUND[surf];
  const g = hole.grad(b.x, b.z);
  const il = 1 / Math.sqrt(g.x * g.x + g.z * g.z + 1);
  const nx = -g.x * il;
  const ny = il;
  const nz = -g.z * il;
  const vn = b.vx * nx + b.vy * ny + b.vz * nz;
  if (vn >= 0) {
    b.y = gy + BALL_R;
    return;
  }
  let tx = b.vx - vn * nx;
  let ty = b.vy - vn * ny;
  let tz = b.vz - vn * nz;
  // 첫 바운드에서 백스핀이 걸림 (웨지일수록 많이)
  let keep = S.keep;
  if (b.bounces === 0 && surf !== "sand") keep *= 1 - b.bite * (surf === "green" ? 0.72 : 0.42);
  tx *= keep;
  ty *= keep;
  tz *= keep;
  const up = -vn * S.e;
  b.bounces += 1;
  // 공중 힘은 땅에 닿으면 사라짐
  b.lift = 0;
  b.side = 0;
  b.y = gy + BALL_R;
  if (up < 1 || surf === "sand") {
    b.vx = tx;
    b.vy = 0;
    b.vz = tz;
    b.mode = "roll";
    if (onEvent) onEvent("roll", surf);
    return;
  }
  b.vx = tx + nx * up;
  b.vy = ty + ny * up;
  b.vz = tz + nz * up;
  if (onEvent) onEvent("bounce", { surf, v: up });
}

function stepRoll(b, hole, h, r, onEvent) {
  const surf = hole.surface(b.x, b.z);
  b.surf = surf;
  if (surf === "water") {
    b.mode = "rest";
    b.result = "water";
    return;
  }
  if (surf === "ob") {
    b.mode = "rest";
    b.result = "ob";
    return;
  }
  const S = GROUND[surf];
  const g = hole.grad(b.x, b.z);
  const sp = Math.hypot(b.vx, b.vz);
  // 경사 (구름 관성 5/7 · 게임 쪽으로 조금 키움)
  const slope = G * 0.82;
  const ax = -g.x * slope;
  const az = -g.z * slope;
  const push = Math.hypot(ax, az);
  if (sp < 0.04) {
    // 멈춤: 경사를 이길 만큼 평평하면 그대로
    if (push < S.roll * 0.62) {
      b.vx = 0;
      b.vz = 0;
      b.mode = "rest";
      b.y = hole.height(b.x, b.z) + BALL_R;
      return;
    }
  }
  b.vx += ax * h;
  b.vz += az * h;
  if (sp > 1e-3) {
    const fr = Math.min(sp, S.roll * h);
    b.vx -= (b.vx / sp) * fr;
    b.vz -= (b.vz / sp) * fr;
  }
  b.x += b.vx * h;
  b.z += b.vz * h;
  b.y = hole.height(b.x, b.z) + BALL_R;
  // 컵
  const dx = b.x - hole.pin.x;
  const dz = b.z - hole.pin.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < CUP_R) {
    const v = Math.hypot(b.vx, b.vz);
    if (v < 2.9) {
      b.mode = "rest";
      b.result = "holed";
      b.x = hole.pin.x;
      b.z = hole.pin.z;
      return;
    }
    // 너무 세면 컵을 스치고 지나감
    if (b.lipped < 3) {
      b.lipped += 1;
      const nx = dx / (d || 1);
      const nz = dz / (d || 1);
      const vn = b.vx * nx + b.vz * nz;
      b.vx = (b.vx - 0.7 * vn * nx) * 0.72;
      b.vz = (b.vz - 0.7 * vn * nz) * 0.72;
      if (onEvent) onEvent("lip");
    }
  }
  void r;
}

/** 샷 하나를 끝까지 (봇 · 점검) */
export function runToRest(b, hole, wind, r, onEvent) {
  let guard = 0;
  while (b.mode !== "rest" && guard < 6000) {
    advance(b, hole, wind, 1 / 60, r, onEvent);
    guard += 1;
  }
  if (b.mode !== "rest") b.mode = "rest";
  return b;
}
