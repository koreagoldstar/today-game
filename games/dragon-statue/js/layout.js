/*
 * 드래곤 석상 대작전 · 스테이지 만들기 (데이터 → 배치 → 카메라 → 검증)
 *
 *  판정 규칙 (데이터 기반):
 *   - 보통 석상은 모두 '화면에서 같은 높이'로 보이도록 크기를 맞춘다 (뒤 줄은 멀어서 작아 보이는 만큼 키운다).
 *   - 정답 석상만 그 높이에 (1 ± diff) 를 곱한다. diff 는 단계마다 정해진 값 (최소 14%).
 *   - 배치 뒤 실제 카메라로 다시 재서 검사한다: 보통 석상끼리 2% 안, 정답은 모든 보통 석상과 diff×0.85 이상 차이,
 *     정답이 앞 석상에 35% 넘게 가리지 않을 것, 정답 한가운데를 누르면 정답이 골라질 것. 실패하면 다시 배치한다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { STATUE_TYPES, PED_R } from "./statues.js?v=1";
import { seeded } from "./tex.js?v=1";
import { PLAZA } from "./world.js?v=1";

export const S0 = 1.7; // 보통 석상 높이 (세계 단위)
export const FLOOR = 0.16; // 광장 바닥 높이
const STEP_H = 0.42; // 계단 한 단 높이 (뒤 줄일수록 높아서 앞 석상에 덜 가린다)
/** 카메라 내려다보는 각도 (라디안) — 세로 화면은 줄이 많아서 더 내려다본다 */
export function pitchFor(aspect) {
  return aspect < 0.8 ? 0.46 : 0.3;
}

/* ---------------- 단계표 ---------------- */
export const TIERS = [
  { theme: "forest", from: 1, to: 3, count: [3, 4, 5], diff: [0.45, 0.4, 0.36], mix: 1, time: 30, pool: ["folded", "baby", "spread"] },
  { theme: "jungle", from: 4, to: 7, count: [5, 5, 6, 6], diff: [0.34, 0.31, 0.29, 0.27], mix: 1, time: 27, pool: ["folded", "spread", "bighorn", "armored", "baby"] },
  { theme: "crystal", from: 8, to: 12, count: [6, 7, 7, 8, 8], diff: [0.27, 0.25, 0.24, 0.23, 0.22], mix: 2, time: 25, pool: ["crystal", "folded", "spread", "armored", "bighorn"] },
  { theme: "volcano", from: 13, to: 17, count: [8, 8, 9, 9, 9], diff: [0.22, 0.21, 0.2, 0.19, 0.19], mix: 2, time: 23, pool: ["lava", "armored", "folded", "bighorn", "spread"] },
  { theme: "ice", from: 18, to: 24, count: [9, 9, 10, 10, 10, 10, 10], diff: [0.19, 0.18, 0.18, 0.17, 0.17, 0.16, 0.16], mix: 3, time: 22, pool: ["ice", "folded", "spread", "crystal", "armored"] },
  { theme: "master", from: 25, to: Infinity, count: [10, 12], diff: [0.16], mix: 3, time: 21, pool: STATUE_TYPES.map((t) => t.id) },
];
export const FINAL_STAGE = 30;
export const MIN_DIFF = 0.14;
export const MIN_TIME = 18;

export function tierOf(n) {
  return TIERS.find((t) => n >= t.from && n <= t.to) || TIERS[TIERS.length - 1];
}

/** 특별 스테이지: boss · gold · multi · giant · normal */
export function stageKind(n) {
  if ([7, 12, 17, 24, FINAL_STAGE].includes(n) || (n > FINAL_STAGE && n % 5 === 0)) return "boss";
  const bonus = { 5: "gold", 10: "multi", 15: "giant", 20: "gold", 22: "multi", 27: "giant" };
  if (bonus[n]) return bonus[n];
  if (n > FINAL_STAGE && n % 5 === 3) return ["gold", "multi", "giant"][Math.floor(n / 5) % 3];
  return "normal";
}

export const KIND_INFO = {
  normal: { title: "크기가 다른 석상 찾기", rule: "크기가 다른 석상 1개를 찾아 방망이로 쾅!" },
  gold: { title: "보너스 · 황금 석상", rule: "모두 황금 석상! 크기가 다른 1개를 찾으면 점수 2배", safe: true },
  multi: { title: "보너스 · 두 개 찾기", rule: "크기가 다른 석상이 2개 숨어 있어요. 둘 다 찾아요!", safe: true },
  giant: { title: "보너스 · 거인 석상", rule: "커다란 거인 석상! 3번 연속으로 다른 크기를 찾아요", safe: true },
  boss: { title: "보스 · 거대 드래곤 수호자", rule: "수호자를 지키는 작은 석상 중 크기가 다른 것을 3번 찾으면 봉인이 풀려요!" },
};

/**
 * 스테이지 데이터 (무작위는 rnd 로만 → 오늘의 도전은 날짜 시드로 모두 같은 문제)
 * @returns {{ n, kind, theme, count, diff, dir, types:string[], time, odds, rounds, scale, safe }}
 */
export function stageSpec(n, rnd) {
  const T = tierOf(n);
  const i = n - T.from;
  const pick = (arr) => arr[Math.min(arr.length - 1, i)];
  const kind = stageKind(n);
  let count = T.theme === "master" ? (rnd() < 0.5 ? 10 : 12) : pick(T.count);
  let diff = T.theme === "master" ? Math.max(MIN_DIFF, 0.16 - (n - 25) * 0.002) : pick(T.diff);
  let time = T.theme === "master" ? Math.max(MIN_TIME, T.time - Math.floor((n - 25) / 5)) : T.time;
  let mix = T.mix;
  let odds = 1;
  let rounds = 1;
  let scale = 1;
  let pool = T.pool;
  if (kind === "gold") {
    pool = ["gold"];
    mix = 1;
    diff = Math.min(0.4, diff + 0.05);
  } else if (kind === "multi") {
    odds = 2;
    count = Math.min(12, count + 1);
    diff = Math.min(0.4, diff + 0.04);
    time += 8;
  } else if (kind === "giant") {
    rounds = 3;
    count = 3;
    scale = 1.75;
    diff = Math.min(0.4, diff + 0.03);
    time = 14;
    mix = 1;
  } else if (kind === "boss") {
    rounds = 3;
    count = Math.min(8, Math.max(5, count));
    diff = Math.min(0.4, diff + 0.03);
  }
  // 종류 고르기 (섞는 수만큼)
  const types = [];
  const bag = pool.slice();
  for (let k = 0; k < mix && bag.length; k++) types.push(bag.splice(Math.floor(rnd() * bag.length), 1)[0]);
  return { n, kind, theme: T.theme, count, diff, dir: rnd() < 0.5 ? 1 : -1, types, time, odds, rounds, scale, safe: !!KIND_INFO[kind].safe, mix };
}

/* ================================================================
 * 배치
 * ============================================================== */
function rowCounts(count, aspect) {
  const maxCols = aspect < 0.62 ? (count <= 6 ? 2 : 3) : aspect < 0.9 ? (count <= 6 ? 3 : 4) : aspect < 1.3 ? 5 : 6;
  const rows = Math.ceil(count / maxCols);
  const base = Math.floor(count / rows);
  const extra = count - base * rows;
  // 뒤 줄에 더 많이 (앞 줄이 적을수록 덜 가린다) — 0 = 앞 줄
  return Array.from({ length: rows }, (_, r) => base + (r >= rows - extra ? 1 : 0));
}

/** 자리(slot) 목록: x, z, y(계단 높이), row */
export function makeSlots(spec, aspect) {
  const big = spec.scale;
  const sx = (aspect < 0.8 ? 2.05 : 2.15) * big;
  const sz = 2.5 * big;
  const counts = spec.kind === "giant" ? [spec.count] : rowCounts(spec.count, aspect);
  const rows = counts.length;
  const slots = [];
  const zFront = PLAZA.cz + PLAZA.d / 2 - 3.6 - (rows === 1 ? 1.2 : 0);
  let prev = -1;
  counts.forEach((k, r) => {
    let off = 0;
    if (k === prev) off = r % 2 ? sx / 4 : -sx / 4; // 같은 수의 줄이 이어지면 반 칸 어긋나게
    prev = k;
    for (let i = 0; i < k; i++) {
      slots.push({ x: (i - (k - 1) / 2) * sx + off, z: zFront - r * sz, y: FLOOR + r * STEP_H, row: r, col: i });
    }
  });
  return { slots, rows, sx, sz, zFront };
}

/* ================================================================
 * 카메라 맞추기: 점들이 화면 안전 구역에 꽉 차게
 * ============================================================== */
const _v = new THREE.Vector3();
export function fitCamera(cam, points, { aspect, fov, pitch = pitchFor(aspect), yaw = 0, safe = aspect < 0.8 ? { l: 0.03, r: 0.03, t: 0.17, b: 0.05 } : { l: 0.05, r: 0.05, t: 0.17, b: 0.05 } }) {
  cam.fov = fov;
  cam.aspect = aspect;
  cam.near = 0.5;
  cam.far = 420;
  cam.updateProjectionMatrix();
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const target = new THREE.Vector3();
  for (const p of points) target.add(p);
  target.multiplyScalar(1 / points.length);
  let dist = 20;
  // 안전 구역 (NDC)
  const L = -1 + safe.l * 2;
  const R = 1 - safe.r * 2;
  const B = -1 + safe.b * 2;
  const Tp = 1 - safe.t * 2;
  for (let it = 0; it < 14; it++) {
    cam.position.copy(target).addScaledVector(dir, dist);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of points) {
      _v.copy(p).project(cam);
      x0 = Math.min(x0, _v.x);
      x1 = Math.max(x1, _v.x);
      y0 = Math.min(y0, _v.y);
      y1 = Math.max(y1, _v.y);
    }
    const k = Math.max((x1 - x0) / (R - L), (y1 - y0) / (Tp - B));
    // 가운데 맞추기 (화면 오른쪽 · 위 방향으로 target 이동)
    const cx = (x0 + x1) / 2 - (L + R) / 2;
    const cy = (y0 + y1) / 2 - (B + Tp) / 2;
    const halfH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * dist;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    target.addScaledVector(right, cx * halfH * aspect).addScaledVector(up, cy * halfH);
    dist *= 0.35 + 0.65 * k;
  }
  cam.position.copy(target).addScaledVector(dir, dist);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  return { target, dist, dir };
}

export function fovFor(aspect) {
  return aspect < 0.8 ? 30 : 27;
}

/** 화면에 보이는 높이 (NDC y 단위) — 받침 바닥에서 꼭대기까지 */
export function screenHeight(cam, x, y, z, h) {
  const a = _v.set(x, y, z).project(cam).y;
  const b = _v.set(x, y + h, z).project(cam).y;
  return b - a;
}

/** 석상 하나의 화면 사각형 (NDC) */
export function screenRect(cam, s) {
  const w = (s.halfW || 0.42) * s.scale;
  const d = 0.35 * s.scale;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const dx of [-w, w])
    for (const dy of [0, s.scale])
      for (const dz of [-d, d]) {
        _v.set(s.x + dx, s.y + dy, s.z + dz).project(cam);
        x0 = Math.min(x0, _v.x);
        x1 = Math.max(x1, _v.x);
        y0 = Math.min(y0, _v.y);
        y1 = Math.max(y1, _v.y);
      }
  return { x0, x1, y0, y1, depth: _v.set(s.x, s.y, s.z).applyMatrix4(cam.matrixWorldInverse).z };
}

function overlap(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * 한 판(라운드) 배치 만들기 + 카메라 + 검증
 * @param spec stageSpec 결과
 * @param ctx { aspect, cam, rnd, avoid: {row,col}[] (지난 정답 자리), typeInfo(id)→{halfW}, boss: bool }
 * @returns { statues:[{x,y,z,scale,typeId,odd,row,col,halfW,yaw}], cam fit, checks, tries, terraces, charStart }
 */
export function buildRound(spec, ctx) {
  const { aspect, cam, rnd } = ctx;
  const { slots, rows, sx, sz, zFront } = makeSlots(spec, aspect);
  const big = spec.scale;
  const SN = S0 * big;
  // 종류 나누기: 섞는 종류마다 최소 2개 이상 보통 석상이 있게
  const n = slots.length;
  const types = [];
  for (let i = 0; i < n; i++) types.push(spec.types[i % spec.types.length]);
  // 같은 종류는 같은 방향을 본다 (돌림 때문에 넓이가 달라 보이지 않게)
  const yawOf = {};
  spec.types.forEach((t) => (yawOf[t] = (rnd() - 0.5) * 0.5));
  // 카메라 맞추기용 점 (정답이 커질 수 있으니 높이는 넉넉히)
  // 주인공 시작 자리: 석상을 가리지 않게 — 가로 화면은 줄 왼쪽 옆, 세로 화면은 앞쪽 멀리
  const minX = Math.min(...slots.map((s) => s.x));
  const charStart = aspect < 0.8 ? new THREE.Vector3(0, FLOOR, zFront + 2.9 * Math.min(1.3, big)) : new THREE.Vector3(minX - 0.78 * sx, FLOOR, zFront + 0.5);
  const pts = [];
  for (const s of slots) {
    pts.push(new THREE.Vector3(s.x - 0.68 * SN, s.y, s.z + 0.45 * SN), new THREE.Vector3(s.x + 0.68 * SN, s.y, s.z + 0.45 * SN));
    pts.push(new THREE.Vector3(s.x, s.y + SN * 1.32, s.z - 0.3));
  }
  pts.push(new THREE.Vector3(charStart.x - 0.6, FLOOR, charStart.z + 0.6), new THREE.Vector3(charStart.x + 0.6, FLOOR + 1.1, charStart.z));
  let boss = null;
  if (ctx.boss) {
    const bz = zFront - (rows - 1) * sz - 3.4;
    boss = { x: 0, y: FLOOR + rows * STEP_H + 0.2, z: bz, scale: 4.3 };
    pts.push(new THREE.Vector3(-2, boss.y, bz), new THREE.Vector3(2, boss.y, bz), new THREE.Vector3(0, boss.y + boss.scale * 1.0, bz));
  }
  const fov = fovFor(aspect);
  const fit = fitCamera(cam, pts, ctx.safe ? { aspect, fov, safe: ctx.safe } : { aspect, fov });
  // 줄마다 화면 높이 맞추기 (원근 보정)
  const hs = slots.map((s) => screenHeight(cam, s.x, s.y, s.z, SN));
  const ref = Math.max(...hs.filter((_, i) => slots[i].row === 0));
  const comp = hs.map((h) => ref / h);

  // 정답 자리 고르기 → 검증 → 실패하면 다른 자리
  const order = slots.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const avoid = ctx.avoid || [];
  order.sort((a, b) => (avoid.some((v) => v.row === slots[a].row && v.col === slots[a].col) ? 1 : 0) - (avoid.some((v) => v.row === slots[b].row && v.col === slots[b].col) ? 1 : 0));
  let tries = 0;
  for (let oi = 0; oi < order.length; oi++) {
    tries++;
    const oddIdx = [order[oi]];
    if (spec.odds === 2) {
      // 두 번째 정답: 첫 번째와 다른 줄이나 떨어진 자리
      const second = order.find((k) => k !== order[oi] && (slots[k].row !== slots[order[oi]].row || Math.abs(slots[k].col - slots[order[oi]].col) > 1));
      if (second == null) continue;
      oddIdx.push(second);
    }
    // 정답 석상 종류: 보통 석상 중 같은 종류가 2개 이상 남도록
    const statues = slots.map((s, i) => {
      const typeId = types[i];
      const info = ctx.typeInfo(typeId);
      const odd = oddIdx.includes(i);
      return {
        x: s.x,
        y: s.y,
        z: s.z,
        row: s.row,
        col: s.col,
        typeId,
        odd,
        halfW: info.halfW,
        yaw: yawOf[typeId],
        scale: SN * comp[i] * (odd ? 1 + spec.dir * spec.diff : 1),
      };
    });
    const sameType = (t) => statues.filter((s) => !s.odd && s.typeId === t).length;
    if (statues.some((s) => s.odd && sameType(s.typeId) < Math.min(2, n - spec.odds))) continue;
    const check = validate(cam, statues, spec);
    if (check.ok) {
      const terraces = [];
      for (let r = 1; r < rows; r++) {
        const rowS = statues.filter((s) => s.row === r);
        const xs = rowS.map((s) => s.x);
        terraces.push({ r, x0: Math.min(...xs) - sx * 0.7, x1: Math.max(...xs) + sx * 0.7, z0: zFront - r * sz + sz / 2, z1: zFront - r * sz - sz / 2 - (r === rows - 1 ? 0.6 : 0), h: r * STEP_H });
      }
      return { statues, fit, check, tries, terraces, charStart, boss, sx, sz, rows, comp };
    }
  }
  // 마지막 수단: 맨 앞 줄 가운데를 정답으로 (가림 없음)
  return buildRound({ ...spec, count: Math.min(spec.count, 5), odds: 1, kind: spec.kind === "giant" ? "giant" : spec.kind }, { ...ctx, avoid: [] });
}

/**
 * 검증: 보통 석상끼리 화면 높이 2% 안 · 정답은 모든 보통과 diff×0.85 이상 차이 · 정답 가림 35% 미만 · 정답 가운데 누르면 정답
 */
export function validate(cam, statues, spec) {
  const H = statues.map((s) => screenHeight(cam, s.x, s.y, s.z, s.scale));
  const normals = H.filter((_, i) => !statues[i].odd);
  const nMin = Math.min(...normals);
  const nMax = Math.max(...normals);
  const spread = nMax / nMin - 1;
  const res = { ok: true, spread, ratios: [], cover: [], pickOk: [] };
  if (spread > 0.02) res.ok = false;
  const rects = statues.map((s) => screenRect(cam, s));
  statues.forEach((s, i) => {
    if (!s.odd) return;
    const ratio = spec.dir > 0 ? H[i] / nMax : nMin / H[i];
    res.ratios.push(ratio);
    if (ratio < 1 + spec.diff * 0.85 * (spec.dir > 0 ? 1 : 0.85)) res.ok = false;
    // 앞(카메라에 더 가까운) 석상에 가려지는 비율
    const me = rects[i];
    const area = (me.x1 - me.x0) * (me.y1 - me.y0);
    let cov = 0;
    rects.forEach((o, j) => {
      if (j !== i && o.depth > me.depth + 0.01) cov += overlap(me, o);
    });
    cov = Math.min(1, cov / area);
    res.cover.push(cov);
    if (cov > 0.35) res.ok = false;
    // 정답 몸통 가운데를 누르면 정답이 골라지는지
    const p = new THREE.Vector3(s.x, s.y + s.scale * 0.5, s.z).project(cam);
    const got = pickAt(cam, statues, p.x, p.y);
    res.pickOk.push(got === i);
    if (got !== i) res.ok = false;
  });
  return res;
}

/* ================================================================
 * 누른 곳 → 석상 (광선 ↔ 세로 원기둥). 맞은 게 없으면 화면에서 가까운 석상 (조금 빗나가도 OK)
 * ============================================================== */
const _ray = new THREE.Raycaster();
const _p = new THREE.Vector2();
export function pickAt(cam, statues, nx, ny, { loose = 0 } = {}) {
  _p.set(nx, ny);
  _ray.setFromCamera(_p, cam);
  const o = _ray.ray.origin;
  const d = _ray.ray.direction;
  let best = -1;
  let bestT = Infinity;
  statues.forEach((s, i) => {
    if (s.gone) return;
    const r = Math.max(PED_R * 1.12, (s.halfW || 0.4) * 0.72) * s.scale;
    const t = rayCylinder(o, d, s.x, s.z, r, s.y, s.y + s.scale);
    if (t != null && t < bestT) {
      bestT = t;
      best = i;
    }
  });
  if (best >= 0 || !loose) return best;
  // 너그러운 판정: 화면 사각형 가운데까지 거리 (NDC, 가로 비율 보정)
  let bd = Infinity;
  statues.forEach((s, i) => {
    if (s.gone) return;
    const rc = screenRect(cam, s);
    const cx = (rc.x0 + rc.x1) / 2;
    const cy = (rc.y0 + rc.y1) / 2;
    const hw = (rc.x1 - rc.x0) / 2 + loose;
    const hh = (rc.y1 - rc.y0) / 2 + loose;
    if (Math.abs(nx - cx) > hw || Math.abs(ny - cy) > hh) return;
    const dd = Math.hypot((nx - cx) / hw, (ny - cy) / hh);
    if (dd < bd) {
      bd = dd;
      best = i;
    }
  });
  return best;
}
function rayCylinder(o, d, cx, cz, r, y0, y1) {
  const ox = o.x - cx;
  const oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  const b = 2 * (ox * d.x + oz * d.z);
  const c = ox * ox + oz * oz - r * r;
  let best = null;
  if (a > 1e-9) {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
        if (t <= 0) continue;
        const y = o.y + d.y * t;
        if (y >= y0 && y <= y1) {
          best = best == null ? t : Math.min(best, t);
        }
      }
    }
  }
  // 윗면
  if (Math.abs(d.y) > 1e-9) {
    const t = (y1 - o.y) / d.y;
    if (t > 0) {
      const x = ox + d.x * t;
      const z = oz + d.z * t;
      if (x * x + z * z <= r * r) best = best == null ? t : Math.min(best, t);
    }
  }
  return best;
}

/* ---------------- 오늘의 도전 (날짜 시드) ---------------- */
export function dayKey(d = new Date()) {
  return d.toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** 오늘의 도전: 10판 (단계 번호 목록) — 날짜마다 다르지만 그날은 모두 같다 */
export function dailyPlan(day = dayKey()) {
  const rnd = seeded(hashStr("dragon-daily-" + day));
  const base = [2, 4, 6, 8, 9, 11, 13, 16, 19, 23];
  const bonusAt = 4 + Math.floor(rnd() * 3); // 중간에 보너스 하나
  const bonusStage = [5, 10, 15][Math.floor(rnd() * 3)];
  const stages = base.map((n, i) => (i === bonusAt ? bonusStage : n));
  return { day, seed: hashStr("dragon-seed-" + day), stages };
}
export { seeded };
