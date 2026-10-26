/*
 * 투사체: 따라가는 것(화살 · 얼음) · 포물선(폭탄 · 포탄 · 서리 장판) · 꿰뚫는 화살
 *  모두 시뮬레이션 시간으로 움직이고, 맞는 순간 한 번만 피해 (표적이 먼저 쓰러지면 빗나감)
 */
import { damage, applySlow, applyFreeze, applyStun, applyBurn, applyShred } from "./enemies.js";

const MAX_PROJ = 400;

function predict(e, T) {
  const s = Math.min(e.path.length, e.s + (e.v || 0) * T);
  const p = e.path.at(s, {});
  return { x: p.x - p.dz * e.lane, z: p.z + p.dx * e.lane };
}

export function fireProjectile(sim, t, st, e, kind) {
  if (sim.projs.length >= MAX_PROJ) return;
  const y0 = 0.9 + t.y;
  const p = { id: sim.nextId++, kind, x: t.x, y: y0, z: t.z, src: t, st, t: 0 };
  switch (kind) {
    case "arrow":
    case "iceShard":
      p.homing = true;
      p.target = e.id;
      p.speed = kind === "arrow" ? 15 : 11;
      p.tx = e.x;
      p.ty = e.y + 0.35;
      p.tz = e.z;
      break;
    case "pierceArrow": {
      const dx = e.x - t.x;
      const dz = e.z - t.z;
      const L = Math.hypot(dx, dz) || 1;
      p.dx = dx / L;
      p.dz = dz / L;
      p.speed = 16;
      p.maxDist = st.range + 1.4;
      p.left = st.pierce;
      p.hit = new Set();
      p.y = 0.7;
      break;
    }
    case "bomb":
    case "shell":
    case "frostLob": {
      const d = Math.hypot(e.x - t.x, e.z - t.z);
      const T = kind === "shell" ? Math.max(0.3, Math.min(0.8, d / 9)) : Math.max(0.35, Math.min(0.9, d / 7));
      const aim = predict(e, T + (kind === "frostLob" ? 0.4 : 0));
      p.ballistic = true;
      p.T = T;
      p.x0 = t.x;
      p.z0 = t.z;
      p.y0 = y0;
      p.tx = aim.x;
      p.tz = aim.z;
      p.arc = kind === "shell" ? 0.9 : 1.5;
      p.primary = e.id;
      break;
    }
    default:
      return;
  }
  sim.projs.push(p);
}

export function updateProjectiles(sim, dt) {
  const keep = [];
  for (const p of sim.projs) {
    p.t += dt;
    let alive = true;
    if (p.homing) alive = stepHoming(sim, p, dt);
    else if (p.ballistic) {
      const k = Math.min(1, p.t / p.T);
      p.x = p.x0 + (p.tx - p.x0) * k;
      p.z = p.z0 + (p.tz - p.z0) * k;
      p.y = p.y0 * (1 - k) + 0.1 * k + p.arc * 4 * k * (1 - k);
      if (k >= 1) {
        land(sim, p);
        alive = false;
      }
    } else alive = stepPierce(sim, p, dt);
    if (alive) keep.push(p);
  }
  sim.projs = keep;
}

function stepHoming(sim, p, dt) {
  const e = sim.byId(p.target);
  if (e && !e.dead && !e.leaked && !e.mods.untargetable) {
    p.tx = e.x;
    p.ty = e.y + 0.35;
    p.tz = e.z;
  } else p.lost = true;
  const dx = p.tx - p.x;
  const dy = p.ty - p.y;
  const dz = p.tz - p.z;
  const L = Math.hypot(dx, dy, dz);
  const step = p.speed * dt;
  if (L <= step + 0.05 || p.t > 3) {
    if (!p.lost && e) hit(sim, p, e);
    return false;
  }
  p.x += (dx / L) * step;
  p.y += (dy / L) * step;
  p.z += (dz / L) * step;
  return true;
}

function hit(sim, p, e) {
  const st = p.st;
  const src = p.src;
  if (p.kind === "arrow") {
    damage(sim, e, st.dmg, { type: "phys", src, sx: src.x, sz: src.z, canDodge: true });
    sim.emit({ type: "hit", kind: "arrow", id: e.id });
  } else if (p.kind === "iceShard") {
    const done = damage(sim, e, st.dmg, { type: "ice", src, sx: src.x, sz: src.z, canDodge: true });
    if (done > 0 && !e.dead) {
      applySlow(sim, e, st.slow, st.slowT);
      if (st.freeze && sim.rng() < st.freeze) applyFreeze(sim, e, st.freezeT);
    }
    sim.emit({ type: "hit", kind: "ice", id: e.id });
  }
}

function stepPierce(sim, p, dt) {
  const step = p.speed * dt;
  p.x += p.dx * step;
  p.z += p.dz * step;
  p.dist = (p.dist || 0) + step;
  for (const e of sim.enemies) {
    if (p.left <= 0) break;
    if (e.dead || e.leaked || e.mods.untargetable || p.hit.has(e.id)) continue;
    if (Math.hypot(e.x - p.x, e.z - p.z) > 0.32 + e.radius) continue;
    p.hit.add(e.id);
    p.left--;
    damage(sim, e, p.st.dmg, { type: "phys", src: p.src, sx: p.src.x, sz: p.src.z, ap: 0.2 });
    sim.emit({ type: "hit", kind: "arrow", id: e.id });
  }
  return p.left > 0 && p.dist < p.maxDist && p.x > -2 && p.z > -2 && p.x < 24 && p.z < 16;
}

function land(sim, p) {
  const st = p.st;
  const src = p.src;
  if (p.kind === "frostLob") {
    // 서리 장판은 길 위에만 (가장 가까운 길 지점으로)
    let best = null;
    for (const path of sim.map.paths) {
      const n = path.nearest(p.tx, p.tz);
      if (!best || n.d < best.d) best = { d: n.d, s: n.s, path };
    }
    const q = best.path.at(best.s, {});
    sim.addZone({ kind: "frost", x: q.x, z: q.z, r: st.zoneR, dur: st.zoneT * (1 + sim.mods.dot * 0.5), owner: src.id, max: st.zoneMax, slow: st.slow, dps: st.dmg * (1 + sim.mods.dot), src });
    sim.emit({ type: "boom", x: q.x, z: q.z, r: st.zoneR, look: "frost" });
    return;
  }
  const r = st.splash;
  const primary = sim.byId(p.primary);
  let n = 0;
  for (const e of sim.enemies) {
    if (e.dead || e.leaked || e.mods.untargetable || e.flying) continue;
    if (Math.hypot(e.x - p.tx, e.z - p.tz) > r + e.radius * 0.6) continue;
    n++;
    if (p.kind === "shell") {
      const full = e === primary || Math.hypot(e.x - p.tx, e.z - p.tz) < r * 0.5;
      damage(sim, e, st.dmg * (full ? 1 : 0.6), { type: "phys", ap: st.ap, src, sx: src.x, sz: src.z });
      if (st.shred && !e.dead) applyShred(e, st.shred);
    } else {
      damage(sim, e, st.dmg, { type: "blast", src, sx: src.x, sz: src.z });
      if (!e.dead && st.burn) applyBurn(sim, e, st.burn, st.burnT, src);
      if (!e.dead && st.stun) applyStun(sim, e, st.stun);
    }
  }
  sim.emit({ type: "boom", x: p.tx, z: p.tz, r, look: p.kind === "shell" ? (st.shred ? "siege" : "shell") : st.burn ? "fire" : st.stun ? "shock" : "bomb", n });
}
