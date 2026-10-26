/*
 * 타워: 수치 계산(화면 표시와 전투가 같은 함수) · 표적 고르기 · 공격
 *  공격 간격은 시뮬레이션 시간으로만 줄어듦 → 화면 프레임 · 탭 전환과 관계없이 일정 (밀린 공격을 몰아 쏘지 않음)
 */
import { TOWERS } from "../data/towers.js";
import { damage, applySlow, applyFreeze, applyStun } from "./enemies.js";
import { fireProjectile } from "./projectiles.js";

/** 단계 수치 (강화 · 진화 반영 전 기본) */
export function baseStats(type, level, evo, elevel) {
  const T = TOWERS[type];
  let s;
  let attack = T.attack;
  let air = T.air;
  let ground = T.ground;
  let name = T.name;
  if (evo) {
    const E = T.evos[evo];
    s = E.levels[elevel];
    attack = E.attack || attack;
    if (E.air != null) air = E.air;
    name = E.name;
  } else s = T.levels[level];
  return { ...s, attack, air, ground, name, dmgType: T.dmgType, support: !!T.support };
}

/** 지금 단계 다음에 할 수 있는 것: 강화 / 진화 갈래 */
export function nextSteps(sim, t) {
  const T = TOWERS[t.type];
  const disc = 1 - sim.mods.discount;
  if (!t.evo) {
    if (t.level < T.levels.length - 1) {
      const L = T.levels[t.level + 1];
      return { up: { cost: Math.round(L.cost * disc), stats: baseStats(t.type, t.level + 1, null, 0) }, evos: [] };
    }
    return {
      up: null,
      evos: Object.entries(T.evos).map(([key, E]) => ({ key, name: E.name, desc: E.desc, cost: Math.round(E.cost * disc), stats: baseStats(t.type, 0, key, 0) })),
    };
  }
  const E = T.evos[t.evo];
  if (t.elevel < E.levels.length - 1) return { up: { cost: Math.round(E.levels[t.elevel + 1].cost * disc), stats: baseStats(t.type, 0, t.evo, t.elevel + 1) }, evos: [] };
  return { up: null, evos: [] };
}
export const tierOf = (t) => (t.evo ? 3 + t.elevel : t.level); // 0~4

/** 실제 전투 수치 (카드 · 치유 수호자 응원 · 덩굴 · 서리 · 저주 · 과열 반영) */
export function statsOf(sim, t) {
  const b = baseStats(t.type, t.level, t.evo, t.elevel);
  const m = sim.mods;
  const s = { ...b };
  if (b.support) {
    return s;
  }
  let rateMul = (1 + t.buffRate) * m.rate;
  let deb = 1;
  for (const k of ["vine", "frost", "heat"]) if (t.deb[k]) deb *= t.deb[k].mul;
  deb *= t.zoneRate;
  rateMul *= Math.max(0.45, deb);
  s.rate = b.rate * rateMul;
  let dmgMul = m.dmg * (t.deb.curse ? t.deb.curse.mul : 1) * t.zoneDmg;
  s.dmg = (b.dmg || 0) * Math.max(0.4, dmgMul);
  s.range = b.range * m.range * (1 + t.buffRange);
  if (b.splash) s.splash = b.splash * m.splash;
  if (b.slow) s.slow = b.slow;
  if (b.freeze) s.freeze = Math.min(0.6, b.freeze * (1 + m.frost));
  if (b.chain) s.chain = b.chain + m.chain;
  if (b.burn) s.burn = b.burn * (1 + m.dot);
  if (b.zoneR) s.zoneR = b.zoneR * m.splash;
  return s;
}

/** 이 적을 볼 수 있나 (그림자 구역 안이면 가까운 타워만) */
function visible(sim, t, e, d) {
  return !sim.env.hidden(e.x, e.z) || d <= sim.env.sight;
}

export function canHit(st, e) {
  return e.flying ? st.air : st.ground;
}

/** 표적 하나 고르기 (우선순위) — exclude: 이미 고른 적 */
export function findTarget(sim, t, st, exclude) {
  let best = null;
  let bv = Infinity;
  const mode = t.target;
  for (const e of sim.enemies) {
    if (e.dead || e.leaked || e.mods.untargetable) continue;
    if (!canHit(st, e)) continue;
    if (exclude && exclude.has(e.id)) continue;
    const d = Math.hypot(e.x - t.x, e.z - t.z);
    if (d > st.range + e.radius * 0.5) continue;
    if (!visible(sim, t, e, d)) continue;
    const left = e.path.length - e.s;
    let v;
    if (mode === "first") v = left;
    else if (mode === "last") v = -left;
    else if (mode === "strong") v = -(e.hp + e.shield) + left * 0.001;
    else v = d;
    if (v < bv || (v === bv && e.id < best.id)) {
      bv = v;
      best = e;
    }
  }
  return best;
}

export function updateTowers(sim, dt) {
  // 1) 치유 수호자 응원: 각 타워는 가장 센 응원 하나만
  for (const t of sim.towers) {
    t.buffRate = 0;
    t.buffRange = 0;
  }
  for (const h of sim.towers) {
    if (h.type !== "healer") continue;
    const s = baseStats(h.type, h.level, h.evo, h.elevel);
    const r = s.range * sim.mods.range;
    for (const t of sim.towers) {
      if (t === h || t.type === "healer") continue;
      if (Math.hypot(t.x - h.x, t.z - h.z) > r) continue;
      if (s.buff > t.buffRate) t.buffRate = s.buff;
      if ((s.rangeBuff || 0) > t.buffRange) t.buffRange = s.rangeBuff;
    }
    if (s.cleanse) {
      h.cleanseT = (h.cleanseT ?? s.cleanse) - dt;
      if (h.cleanseT <= 0) {
        h.cleanseT = s.cleanse;
        let n = 0;
        for (const t of sim.towers) {
          if (Math.hypot(t.x - h.x, t.z - h.z) > r) continue;
          for (const k of ["vine", "frost", "curse", "heat"]) if (t.deb[k]) (delete t.deb[k], n++);
        }
        if (n) sim.emit({ type: "cleanse", tower: h.id });
      }
    }
    if (s.shieldEvery) {
      h.shieldT = (h.shieldT ?? s.shieldEvery) - dt;
      if (h.shieldT <= 0) {
        h.shieldT = s.shieldEvery;
        if (sim.nest.shield < s.shieldMax) {
          sim.nest.shield = Math.min(s.shieldMax, sim.nest.shield + 1);
          sim.emit({ type: "nestShield", tower: h.id });
        }
      }
    }
  }
  // 2) 공격
  for (const t of sim.towers) {
    for (const k in t.deb) if ((t.deb[k].t -= dt) <= 0) delete t.deb[k];
    if (t.stunT > 0) t.stunT -= dt;
    if (t.stunImm > 0) t.stunImm -= dt;
    if (t.type === "healer") continue;
    if (t.stunT > 0) continue;
    const st = statsOf(sim, t);
    t.cd -= dt;
    if (t.cd > 0) continue;
    const target = findTarget(sim, t, st);
    if (!target) {
      t.cd = 0; // 표적이 없으면 준비 상태로만 기다림 (쌓아 두지 않음)
      continue;
    }
    attack(sim, t, st, target);
    t.cd = Math.max(t.cd, -0.05) + 1 / st.rate;
    if (sim.mods.double > 0 && st.attack !== "chain" && st.attack !== "bolt" && sim.rng() < sim.mods.double) {
      const ex = new Set([target.id]);
      const t2 = findTarget(sim, t, st, ex) || target;
      attack(sim, t, st, t2, true);
    }
  }
}

function attack(sim, t, st, e, extra) {
  t.aimX = e.x;
  t.aimZ = e.z;
  t.fireT = sim.t;
  sim.emit({ type: "fire", tower: t.id, attack: st.attack, target: e.id, extra: !!extra });
  switch (st.attack) {
    case "chain":
      return chainLightning(sim, t, st, e);
    case "bolt": {
      const x = e.x;
      const z = e.z;
      const flying = e.flying;
      sim.addMarker({
        kind: "bolt",
        x,
        z,
        r: st.splash,
        dur: 0.18,
        color: 0xfff27a,
        done(sim) {
          for (const o of sim.enemies) {
            if (o.dead || o.mods.untargetable) continue;
            if (Math.hypot(o.x - x, o.z - z) > st.splash + o.radius * 0.5) continue;
            if (o.flying && !flying && o !== e) continue;
            damage(sim, o, st.dmg, { type: "shock", src: t, sx: t.x, sz: t.z });
            if (!o.dead) applyStun(sim, o, st.stun);
          }
          sim.emit({ type: "boltHit", x, z, r: st.splash });
        },
      });
      return;
    }
    case "scatter": {
      const ex = new Set([e.id]);
      const list = [e];
      for (let i = 1; i < st.shots; i++) {
        const o = findTarget(sim, t, st, ex);
        if (!o) break;
        ex.add(o.id);
        list.push(o);
      }
      for (let i = 0; i < st.shots; i++) fireProjectile(sim, t, st, list[i % list.length], "shell");
      return;
    }
    default:
      fireProjectile(sim, t, st, e, st.attack);
  }
}

/** 번개: 가장 가까운 아직 안 맞은 적으로 튕김 (같은 거리면 번호 작은 적 — 순서 일정) */
function chainLightning(sim, t, st, first) {
  const hit = new Set();
  const pts = [{ x: t.x, z: t.z, y: 1.2 }];
  let cur = first;
  let dmg = st.dmg;
  for (let i = 0; i < st.chain && cur; i++) {
    hit.add(cur.id);
    pts.push({ x: cur.x, z: cur.z, y: cur.y + 0.4, id: cur.id });
    damage(sim, cur, dmg, { type: "shock", src: t, sx: i === 0 ? t.x : pts[pts.length - 2].x, sz: i === 0 ? t.z : pts[pts.length - 2].z });
    dmg *= st.decay;
    let next = null;
    let nd = Infinity;
    for (const o of sim.enemies) {
      if (o.dead || o.leaked || o.mods.untargetable || hit.has(o.id)) continue;
      const d = Math.hypot(o.x - cur.x, o.z - cur.z);
      if (d <= st.jump && (d < nd || (d === nd && o.id < next.id))) {
        nd = d;
        next = o;
      }
    }
    cur = next;
  }
  sim.emit({ type: "chain", tower: t.id, pts });
}

/** 타워에 효과 걸기 (같은 종류는 겹치지 않고 더 센 쪽 · 긴 쪽만) */
export function debuffTower(sim, t, kind, mul, dur) {
  const d = t.deb[kind];
  if (d) {
    d.mul = Math.min(d.mul, mul);
    d.t = Math.max(d.t, dur);
  } else t.deb[kind] = { mul, t: dur };
}
export function stunTower(sim, t, dur, look) {
  if (t.stunImm > 0) return false;
  t.stunT = Math.min(3, dur);
  t.stunImm = t.stunT + 2; // 풀린 뒤 2초는 다시 안 멈춤 (계속 묶이지 않게)
  sim.emit({ type: "towerStun", tower: t.id, look, dur: t.stunT });
  return true;
}
export { applySlow, applyFreeze };
