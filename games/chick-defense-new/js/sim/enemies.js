/*
 * 적: 생성 · 이동(길을 따라 s 로만 움직임 → 길을 벗어나거나 둥지를 건너뛰지 않음) · 상태 효과 · 특수 능력 · 피해 · 처치
 *  능력 상태는 e.ab[이름] 에 두고, 매 걸음 e.mods (속도 · 갑옷 · 받는 피해 · 표적 불가) 를 새로 계산한다.
 *  처치 · 보상 · 분열 · 둥지 도달은 e.dead / e.rewarded / e.leaked 로 한 번만 처리.
 */
import { ENEMIES, BOSSES, ELITE } from "../data/enemies.js";
import { BOSS_AI } from "./bosses.js";

export const MAX_ACTIVE = 160; // 살아 있는 적 상한 (분열 · 소환은 넘치면 생략)
const MAX_SHIELD = 0.6; // 보호막은 최대 체력의 60% 까지

export function spawnEnemy(sim, type, o = {}) {
  const boss = !!BOSSES[type];
  const d = boss ? BOSSES[type] : ENEMIES[type];
  if (!d) return null;
  const alive = sim.aliveCount();
  if (o.gen && alive >= MAX_ACTIVE) return null;
  if (alive >= MAX_ACTIVE + 60) return null; // 정해진 출현도 너무 많으면 안전하게 생략
  const el = o.elite ? ELITE : null;
  const sc = sim.wave ? sim.wave.scale : { hp: 1, bossHp: 1, reward: 1 };
  let maxHp = d.illusion ? 1 : Math.max(1, Math.round(d.hp * (boss ? sc.bossHp : sc.hp) * (el ? el.hp : 1) * (o.hpMul ?? 1) * sim.diff.hp));
  if (boss && o.awakened) maxHp = Math.round(maxHp * 1.45);
  const pathIdx = Math.min(sim.map.paths.length - 1, o.path || 0);
  const path = sim.map.paths[pathIdx];
  const e = {
    id: sim.nextId++,
    type,
    def: d,
    boss,
    elite: !!el,
    awakened: !!o.awakened,
    gen: o.gen || 0,
    parent: o.parent || 0,
    illusion: !!d.illusion,
    hp: maxHp,
    maxHp,
    shield: 0,
    maxShield: 0,
    armorBase: Math.min(0.8, (d.armor || 0) + (el ? el.armor : 0)),
    resist: d.resist || {},
    speedBase: d.speed * (el ? el.speed : 1),
    reward: d.illusion ? 0 : Math.round(d.reward * (o.gen ? 1 : sc.reward) * (el ? el.reward : 1) * (o.rewardMul ?? 1)),
    leak: d.leak == null ? 1 : d.leak,
    size: (d.size || 0.45) * (el ? el.size : 1),
    flying: !!d.flying,
    hover: !!d.hover,
    pathIdx,
    path,
    s: o.s != null ? o.s : 0,
    lane: o.lane != null ? o.lane : (sim.rng() - 0.5) * 0.5,
    x: 0,
    z: 0,
    y: 0,
    dx: 1,
    dz: 0,
    st: { slow: 1, slowT: 0, frozenT: 0, freezeImm: 0, stunT: 0, stunImm: 0, burn: 0, burnT: 0, shred: 0, shredT: 0, vuln: 1, vulnT: 0, armorBuff: 0, armorBuffT: 0, rage: null, zoneSlow: 1, onFire: false },
    mods: { speed: 1, armor: 0, cut: 1, untargetable: false },
    state: "move",
    stateT: 0,
    ab: {},
    healed: 0,
    hitT: 0,
    age: 0,
    dead: false,
    rewarded: false,
    leaked: false,
    soulBoost: 0,
  };
  if (el) e.leak *= ELITE.leak;
  e.radius = e.size * 0.75;
  for (const [k, cfg] of Object.entries(d.ab || {})) initAbility(sim, e, k, cfg);
  if (boss && BOSS_AI[type]) BOSS_AI[type].init(sim, e);
  place(e);
  sim.enemies.push(e);
  sim.emit({ type: "spawn", id: e.id, etype: type, boss, elite: e.elite, illusion: e.illusion });
  return e;
}

function place(e) {
  const p = e.path.at(e.s, PT);
  e.dx = p.dx;
  e.dz = p.dz;
  e.x = p.x - p.dz * e.lane;
  e.z = p.z + p.dx * e.lane;
}
const PT = {};

export const effArmor = (e) => Math.max(0, Math.min(0.85, e.armorBase + e.mods.armor + e.st.armorBuff - e.st.shred));

/* ---------------- 능력 준비 ---------------- */
function initAbility(sim, e, k, c) {
  const a = { cd: c.first != null ? c.first : c.every || 0, n: 0 };
  if (k === "shieldCharge") {
    e.shield = e.maxShield = Math.round(e.maxHp * c.shieldPct);
    a.cd = c.every * 0.6;
  }
  if (k === "perch") a.phase = "fly";
  if (k === "dodge") a.charges = c.charges;
  e.ab[k] = a;
}

/* ---------------- 한 걸음 ---------------- */
export function updateEnemy(sim, e, dt) {
  if (e.dead || e.leaked) return;
  e.age += dt;
  e.hitT = Math.max(0, e.hitT - dt);
  const st = e.st;
  // 상태 효과 시간
  if (st.slowT > 0 && (st.slowT -= dt) <= 0) st.slow = 1;
  if (st.frozenT > 0) st.frozenT -= dt;
  if (st.freezeImm > 0) st.freezeImm -= dt;
  if (st.stunT > 0) st.stunT -= dt;
  if (st.stunImm > 0) st.stunImm -= dt;
  if (st.shredT > 0 && (st.shredT -= dt) <= 0) st.shred = 0;
  if (st.vulnT > 0 && (st.vulnT -= dt) <= 0) st.vuln = 1;
  if (st.armorBuffT > 0 && (st.armorBuffT -= dt) <= 0) st.armorBuff = 0;
  if (st.rage && (st.rage.t -= dt) <= 0) st.rage = null;
  if (st.burnT > 0) {
    st.burnT -= dt;
    damage(sim, e, st.burn * dt, { type: "fire", dot: true, src: st.burnSrc });
    if (e.dead) return;
  }
  // 능력 (매 걸음 mods 를 새로)
  const m = e.mods;
  m.speed = 1;
  m.armor = 0;
  m.cut = 1;
  m.untargetable = false;
  const d = e.def;
  for (const [k, c] of Object.entries(d.ab || {})) {
    const fn = ABILITY[k];
    if (fn && fn.update) fn.update(sim, e, c, e.ab[k], dt);
    if (e.dead || e.leaked) return;
  }
  if (e.boss && BOSS_AI[e.type]) {
    BOSS_AI[e.type].update(sim, e, dt);
    if (e.dead || e.leaked) return;
  }
  if (e.soulBoost > 0) {
    const sf = e.ab.soulFeed;
    if (sf && (sf.t -= dt) <= 0) {
      sf.stacks = 0;
      e.soulBoost = 0;
    }
  }
  // 속도: 기본 × 능력 × 감속(상태 · 장판 · 상한) × 분노 × 빙판
  let slow = Math.min(st.slow, st.zoneSlow);
  if (st.onFire) slow = 1; // 불 위에서는 얼음 효과가 풀림
  const minSlow = e.boss ? 0.55 : 0.3;
  slow = Math.max(minSlow, slow);
  let v = e.speedBase * m.speed * slow * sim.mods.enemySpeed;
  if (st.rage) v *= st.rage.speed;
  if (!e.flying) v *= sim.env.speedAt(e.x, e.z);
  if ((st.frozenT > 0 && !st.onFire) || st.stunT > 0) v = 0;
  e.v = v;
  e.s += v * dt;
  if (e.s >= e.path.length) {
    e.s = e.path.length;
    place(e);
    leakEnemy(sim, e);
    return;
  }
  place(e);
  e.y = e.flying ? 1.5 : e.hover ? 1.1 : 0;
}

/* ---------------- 둥지 도달 ---------------- */
export function leakEnemy(sim, e, amount) {
  if (e.dead || e.leaked) return;
  e.leaked = true;
  let n = amount != null ? amount : e.leak + (e.st.rage ? e.st.rage.leakAdd : 0);
  if (e.ab.frenzy && e.ab.frenzy.on) n *= e.def.ab.frenzy.leakMul;
  if (e.illusion) n = 0;
  sim.hurtNest(n, e);
  if (e.def.ab && e.def.ab.thief) {
    const stolen = Math.min(sim.coins, e.def.ab.thief.steal);
    sim.coins -= stolen;
    if (stolen) sim.emit({ type: "steal", id: e.id, n: stolen });
  }
  sim.stats.leaks++;
  sim.emit({ type: "leak", id: e.id, n, boss: e.boss });
}

/* ---------------- 피해 ---------------- */
/**
 * o: { type: phys|blast|ice|shock|fire, ap(갑옷 관통 0~1), src(타워), dot, sx/sz(공격이 온 곳 — 방향 판정), canDodge, noCrit }
 * 돌려줌: 실제로 들어간 피해 (막히면 0)
 */
export function damage(sim, e, amount, o = {}) {
  if (e.dead || e.leaked || !(amount > 0)) return 0;
  if (e.mods.untargetable && !o.force) return 0;
  if (e.illusion) {
    kill(sim, e, o.src);
    return 1;
  }
  // 회피 (설원 그림자): 한 대상 공격만
  if (o.canDodge && e.ab.dodge && tryDodge(sim, e)) return 0;
  let a = amount;
  if (e.boss) a *= 1 + sim.mods.boss;
  if (e.elite) a *= 1 + sim.mods.elite;
  a *= e.st.vuln;
  const t = o.type || "phys";
  const arm = effArmor(e);
  if (t === "phys") a *= 1 - Math.max(0, arm - (o.ap || 0));
  else if (t === "blast") a *= 1 - Math.max(0, arm * 0.5 - (o.ap || 0));
  const r = e.resist[t];
  if (r) a *= 1 - Math.max(-0.5, Math.min(1, r));
  a *= e.mods.cut;
  // 그림자 기사: 앞에서 온 공격은 막음 (실제 방향으로 판정 — 공격이 온 곳 sx, sz)
  const fg = e.def.ab && e.def.ab.frontGuard;
  if (fg && o.sx != null) {
    const vx = o.sx - e.x;
    const vz = o.sz - e.z;
    const L = Math.hypot(vx, vz) || 1;
    if ((vx * e.dx + vz * e.dz) / L >= fg.cos) {
      a *= 1 - fg.cut;
      if (sim.rng() < 0.3) sim.emit({ type: "block", id: e.id });
    }
  }
  let crit = false;
  if (!o.dot && !o.noCrit && sim.mods.crit > 0 && sim.rng() < sim.mods.crit) {
    a *= 2;
    crit = true;
  }
  if (a <= 0) return 0;
  // 보호막 먼저
  let toHp = a;
  if (e.shield > 0) {
    const take = Math.min(e.shield, a);
    e.shield -= take;
    toHp -= take;
    if (e.shield <= 0.001) {
      e.shield = 0;
      onShieldBreak(sim, e);
    }
  }
  e.hp -= toHp;
  e.hitT = 0.12;
  sim.stats.dmg += a;
  if (o.src) o.src.dmgDone += a;
  if (e.boss && BOSS_AI[e.type] && BOSS_AI[e.type].onDamage) BOSS_AI[e.type].onDamage(sim, e, a);
  if (o.dot) {
    e.dotAcc = (e.dotAcc || 0) + a;
    if (e.dotAcc >= 4 || e.hp <= 0) {
      sim.emit({ type: "dmg", id: e.id, n: Math.round(e.dotAcc), kind: t, dot: true });
      e.dotAcc = 0;
    }
  } else sim.emit({ type: "dmg", id: e.id, n: Math.round(a), kind: t, crit });
  if (e.hp <= 0) kill(sim, e, o.src);
  return a;
}

function onShieldBreak(sim, e) {
  sim.emit({ type: "shieldBreak", id: e.id });
  if (e.ab.iceShield) {
    e.ab.iceShield.cd = e.def.ab.iceShield.every;
    e.state = "stagger";
    e.stateT = 1;
    e.st.vuln = Math.max(e.st.vuln, 1.3);
    e.st.vulnT = 1.2;
  }
  if (e.boss && BOSS_AI[e.type] && BOSS_AI[e.type].onShieldBreak) BOSS_AI[e.type].onShieldBreak(sim, e);
}

function tryDodge(sim, e) {
  const c = e.def.ab.dodge;
  const a = e.ab.dodge;
  if (a.charges <= 0 || a.cd > 0 || e.state === "blink") return false;
  if (sim.rng() >= c.chance) return false;
  a.charges--;
  a.cd = c.cd;
  e.s = Math.min(e.path.length - 0.8, e.s + c.blink);
  e.state = "blink";
  e.stateT = c.inv;
  place(e);
  sim.emit({ type: "dodge", id: e.id });
  return true;
}

/* ---------------- 처치 ---------------- */
export function kill(sim, e, src) {
  if (e.dead || e.leaked) return;
  e.dead = true;
  e.hp = 0;
  if (!e.rewarded) {
    e.rewarded = true;
    if (e.reward > 0) {
      const bonus = e.illusion ? 0 : sim.mods.bounty;
      sim.coins += e.reward + bonus;
      sim.stats.coinsEarned += e.reward + bonus;
      sim.score += (e.reward + bonus) * 10 * (e.boss ? 3 : 1);
      sim.emit({ type: "coin", id: e.id, n: e.reward + bonus, x: e.x, z: e.z });
    }
    if (!e.illusion) sim.stats.kills++;
    if (src) src.kills++;
  }
  sim.emit({ type: "death", id: e.id, etype: e.type, boss: e.boss, x: e.x, z: e.z, illusion: e.illusion });
  // 죽을 때 능력
  const d = e.def;
  for (const [k, c] of Object.entries(d.ab || {})) {
    const fn = ABILITY[k];
    if (fn && fn.death) fn.death(sim, e, c, e.ab[k]);
  }
  if (e.boss && BOSS_AI[e.type] && BOSS_AI[e.type].death) BOSS_AI[e.type].death(sim, e);
  // 영혼 수확자: 둘레 친구가 쓰러지면 강해짐
  if (!e.illusion)
    for (const r of sim.enemies) {
      if (r === e || r.dead || r.leaked || !r.ab.soulFeed) continue;
      const c = r.def.ab.soulFeed;
      if (Math.hypot(r.x - e.x, r.z - e.z) > c.r) continue;
      const a = r.ab.soulFeed;
      a.stacks = Math.min(c.max, (a.stacks || 0) + 1);
      a.t = c.dur;
      r.soulBoost = a.stacks;
      sim.emit({ type: "soul", from: e.id, to: r.id, stacks: a.stacks });
    }
}

/* ---------------- 상태 효과 걸기 ---------------- */
export function applySlow(sim, e, amount, dur) {
  if (e.dead || e.st.onFire) return;
  const mul = 1 - Math.min(0.7, amount * (1 + sim.mods.frost));
  if (mul < e.st.slow || e.st.slowT < dur * 0.5) {
    e.st.slow = Math.min(e.st.slow, mul);
    e.st.slowT = Math.max(e.st.slowT, dur);
  }
}
export function applyFreeze(sim, e, dur) {
  if (e.dead || e.st.onFire || e.st.freezeImm > 0) return false;
  if (e.boss) {
    applySlow(sim, e, 0.5, dur + 1);
    return false;
  }
  e.st.frozenT = dur;
  e.st.freezeImm = dur + 2;
  sim.emit({ type: "freeze", id: e.id });
  return true;
}
export function applyStun(sim, e, dur) {
  if (e.dead || e.st.stunImm > 0) return;
  const t = e.boss ? dur * 0.35 : dur;
  e.st.stunT = t;
  e.st.stunImm = t + 1.5;
}
export function applyBurn(sim, e, dps, dur, src) {
  if (e.dead) return;
  const v = dps * (1 + sim.mods.dot);
  if (v >= e.st.burn || e.st.burnT <= 0) {
    e.st.burn = v;
    e.st.burnSrc = src;
  }
  e.st.burnT = Math.max(e.st.burnT, dur);
}
export function applyShred(e, amount) {
  e.st.shred = Math.min(0.3, e.st.shred + amount);
  e.st.shredT = 4;
}
export function addShield(e, amount) {
  const cap = e.maxHp * MAX_SHIELD;
  e.shield = Math.min(cap, e.shield + amount);
  e.maxShield = Math.max(e.maxShield, e.shield);
}

/** 길 거리 s 에서 가까운 친구들 */
function alliesNear(sim, e, r, withSelf = false) {
  const out = [];
  for (const o of sim.enemies) {
    if (o.dead || o.leaked || o.illusion || (!withSelf && o === e)) continue;
    if (Math.hypot(o.x - e.x, o.z - e.z) <= r) out.push(o);
  }
  return out;
}
function towersNear(sim, x, z, r) {
  return sim.towers.filter((t) => Math.hypot(t.x - x, t.z - z) <= r);
}

/* ---------------- 능력들 ---------------- */
const ABILITY = {
  /* 거북: 등껍질 방어 */
  defend: {
    update(sim, e, c, a, dt) {
      if (e.state === "defend") {
        e.mods.armor += c.armor;
        e.mods.speed *= c.speed;
        if ((e.stateT -= dt) <= 0) {
          e.state = "move";
          a.cd = c.every;
          sim.emit({ type: "state", id: e.id, state: "move" });
        }
        return;
      }
      if ((a.cd -= dt) <= 0 && e.state === "move") {
        e.state = "defend";
        e.stateT = c.dur;
        sim.emit({ type: "state", id: e.id, state: "defend" });
      }
    },
  },
  /* 두더지: 땅굴 (미리 흙더미 → 땅속 이동 → 다시 나옴) — s 는 계속 앞으로만 */
  burrow: {
    update(sim, e, c, a, dt) {
      const L = e.path.length;
      if (e.state === "burrowWarn") {
        e.mods.speed *= 0.3;
        if ((e.stateT -= dt) <= 0) {
          e.state = "burrow";
          e.stateT = c.dur;
          sim.emit({ type: "state", id: e.id, state: "burrow" });
        }
        return;
      }
      if (e.state === "burrow") {
        e.mods.untargetable = true;
        e.mods.speed *= c.speed;
        // 둥지 바로 앞에서는 반드시 나옴 (둥지를 땅속으로 건너뛰지 않게)
        if ((e.stateT -= dt) <= 0 || e.s > L - 1.6) {
          e.state = "emerge";
          e.stateT = 0.45;
          a.n++;
          a.cd = c.every;
          sim.emit({ type: "state", id: e.id, state: "emerge" });
        }
        return;
      }
      if (e.state === "emerge") {
        e.mods.speed *= 0.3;
        if ((e.stateT -= dt) <= 0) e.state = "move";
        return;
      }
      if (a.n < c.max && (a.cd -= dt) <= 0 && e.s < L - 4) {
        e.state = "burrowWarn";
        e.stateT = c.warn;
        sim.emit({ type: "state", id: e.id, state: "burrowWarn" });
      }
    },
  },
  /* 버섯 분열체: 쓰러지면 갈라짐 (세대 상한 · 활성 상한) — 살짝 뒤에 예약 (웨이브 끝 판정이 기다림) */
  split: {
    death(sim, e, c) {
      if (e.gen >= c.maxGen) return;
      for (let i = 0; i < c.n; i++)
        sim.schedule(0.15, { type: c.into, gen: e.gen + 1, path: e.pathIdx, s: Math.max(0, e.s - 0.15 - i * 0.25), lane: e.lane + (i ? 0.2 : -0.2), parent: e.id });
      sim.emit({ type: "split", id: e.id });
    },
  },
  /* 멧돼지: 준비(발 구르기) → 돌진 */
  charge: {
    update(sim, e, c, a, dt) {
      chargeLike(sim, e, c, a, dt, true);
    },
  },
  /* 치료사: 가장 많이 다친 친구를 치료 (한 번 양 · 대상마다 평생 상한 · 보스는 조금만) */
  heal: {
    update(sim, e, c, a, dt) {
      if ((a.cd -= dt) > 0) return;
      let best = null;
      let bf = 1;
      for (const o of alliesNear(sim, e, c.r)) {
        if (o.mods.untargetable) continue;
        const f = o.hp / o.maxHp;
        if (f < bf && o.healed < o.maxHp * c.maxTotal) {
          bf = f;
          best = o;
        }
      }
      if (!best || bf > 0.97) {
        a.cd = 0.5;
        return;
      }
      const amt = Math.min(best.maxHp - best.hp, best.maxHp * (best.boss ? c.bossPct : c.pct), best.maxHp * c.maxTotal - best.healed);
      best.hp += amt;
      best.healed += amt;
      a.cd = c.every;
      sim.stats.healed += amt;
      sim.emit({ type: "heal", from: e.id, to: best.id, n: Math.round(amt), look: c.look });
    },
  },
  /* 박쥐 도적: 둥지 도달 때 코인 훔침 — leakEnemy 에서 처리 */
  thief: {},
  /* 독버섯 스포어: 독 구름 */
  poisonTrail: {
    update(sim, e, c, a, dt) {
      if ((a.cd -= dt) > 0) return;
      a.cd = c.every;
      sim.addZone({ kind: "poison", x: e.x, z: e.z, r: c.r, dur: c.dur, owner: e.id, max: c.max, towerRate: c.towerRate, heal: c.heal });
    },
  },
  /* 포자 폭탄충: 쓰러지면 부풀었다 폭발 → 근처 타워 멈춤 */
  deathBlast: {
    death(sim, e, c) {
      const x = e.x;
      const z = e.z;
      sim.addMarker({
        kind: "blast",
        x,
        z,
        r: c.r,
        dur: c.warn,
        color: 0xb4ff6a,
        blocking: true,
        done(sim) {
          sim.stunTowers(x, z, c.r, c.stun, "spore");
          sim.emit({ type: "boom", x, z, r: c.r, look: "spore" });
        },
      });
    },
  },
  /* 덩굴 기어충: 옆 타워 공격속도 ↓ */
  vine: {
    update(sim, e, c, a, dt) {
      if ((a.cd -= dt) > 0) return;
      const t = towersNear(sim, e.x, e.z, c.r)[0];
      if (!t) return;
      sim.debuffTower(t, "vine", c.rate, c.dur);
      a.cd = c.cd;
      sim.emit({ type: "vine", from: e.id, tower: t.id });
    },
  },
  /* 버섯 복제술사: 꼬마 소환 (횟수 상한) */
  summon: {
    update(sim, e, c, a, dt) {
      if (a.n >= c.max || (a.cd -= dt) > 0) return;
      a.cd = c.every;
      a.n++;
      for (let i = 0; i < c.n; i++) sim.schedule(0.05 * i, { type: c.type, gen: e.gen + 1, path: e.pathIdx, s: Math.max(0, e.s - 0.4 - i * 0.3), lane: (i - 0.5) * 0.4, parent: e.id });
      sim.emit({ type: "summon", id: e.id });
    },
  },
  /* 서리 박쥐: 날기 ↔ 내려앉기 */
  perch: {
    update(sim, e, c, a, dt) {
      a.t = (a.t ?? c.fly) - dt;
      if (a.t <= 0) {
        a.phase = a.phase === "fly" ? "land" : "fly";
        a.t = a.phase === "fly" ? c.fly : c.land;
        sim.emit({ type: "state", id: e.id, state: a.phase });
      }
      e.flying = a.phase === "fly";
      if (!e.flying) e.mods.speed *= 0.5;
    },
  },
  frostBite: {
    update(sim, e, c, a, dt) {
      if ((a.cd -= dt) > 0) return;
      const t = towersNear(sim, e.x, e.z, c.r)[0];
      if (!t) return;
      sim.debuffTower(t, "frost", c.rate, c.dur);
      a.cd = c.cd;
      sim.emit({ type: "frostBite", from: e.id, tower: t.id });
    },
  },
  /* 빙결 골렘: 보호막 (깨지면 휘청 · 다시 생기기까지 기다림) */
  iceShield: {
    update(sim, e, c, a, dt) {
      if (e.state === "stagger") {
        e.mods.speed *= 0.3;
        if ((e.stateT -= dt) <= 0) e.state = "move";
      }
      if (e.shield > 0) return;
      if ((a.cd -= dt) <= 0) {
        addShield(e, e.maxHp * c.pct);
        a.cd = c.every;
        sim.emit({ type: "shieldUp", id: e.id });
      }
    },
  },
  /* 눈보라 정령: 둘레 친구에게 갑옷 (겹치지 않음 · 새로 고침만) */
  armorAura: {
    update(sim, e, c, a, dt) {
      if ((a.cd -= dt) > 0) return;
      a.cd = c.every;
      for (const o of alliesNear(sim, e, c.r, true)) {
        o.st.armorBuff = Math.max(o.st.armorBuff, c.armor);
        o.st.armorBuffT = Math.max(o.st.armorBuffT, c.dur);
      }
      sim.emit({ type: "pulse", id: e.id, r: c.r, look: "snow" });
    },
  },
  /* 얼음 수정충: 친구들에게 보호막 나눠 주기 */
  shieldGive: {
    update(sim, e, c, a, dt) {
      if ((a.cd -= dt) > 0) return;
      const list = alliesNear(sim, e, c.r).filter((o) => !o.illusion);
      if (!list.length) {
        a.cd = 0.6;
        return;
      }
      list.sort((p, q) => q.maxHp - p.maxHp || p.id - q.id);
      const to = list.slice(0, c.n);
      for (const o of to) addShield(o, o.maxHp * (o.boss ? 0.05 : c.pct));
      a.cd = c.every;
      sim.emit({ type: "shieldGive", from: e.id, to: to.map((o) => o.id) });
    },
  },
  /* 설원 그림자: 회피 (damage() 에서 확률 · 여기선 쿨다운 · 순간이동 무적 시간) */
  dodge: {
    update(sim, e, c, a, dt) {
      if (a.cd > 0) a.cd -= dt;
      if (e.state === "blink") {
        e.mods.untargetable = true;
        if ((e.stateT -= dt) <= 0) e.state = "move";
      }
    },
  },
  /* 용암 도마뱀: 불 자국 */
  fireTrail: {
    update(sim, e, c, a, dt) {
      if ((a.cd -= dt) > 0) return;
      a.cd = c.every;
      sim.addZone({ kind: "fire", x: e.x, z: e.z, r: c.r, dur: c.dur, owner: e.id, max: c.max, towerRate: c.towerRate });
    },
  },
  /* 불씨 박쥐: 쓰러지면 길에 불씨 */
  emberDrop: {
    death(sim, e, c) {
      const n = e.path.nearest(e.x, e.z);
      const p = e.path.at(n.s);
      sim.addZone({ kind: "fire", x: p.x, z: p.z, r: c.r, dur: c.dur, owner: e.id, max: 1, towerRate: 0.85 });
    },
  },
  /* 마그마 골렘: 굳기(피해 흡수) → 빨갛게 빛남 → 폭발(근처 타워 멈춤) */
  absorb: {
    update(sim, e, c, a, dt) {
      if (e.state === "absorb") {
        e.mods.cut *= 1 - c.cut;
        e.mods.speed *= 0.4;
        if ((e.stateT -= dt) <= 0) {
          e.state = "burstWarn";
          e.stateT = c.warn;
          const owner = e;
          sim.addMarker({
            kind: "blast",
            x: e.x,
            z: e.z,
            r: c.r,
            dur: c.warn,
            color: 0xff5a2a,
            follow: e.id,
            blocking: true,
            done(sim, mk) {
              if (owner.dead || owner.leaked) return; // 그 전에 쓰러뜨리면 폭발 없음
              sim.stunTowers(mk.x, mk.z, c.r, c.stun, "magma");
              sim.emit({ type: "boom", x: mk.x, z: mk.z, r: c.r, look: "magma" });
            },
          });
          sim.emit({ type: "state", id: e.id, state: "burstWarn" });
        }
        return;
      }
      if (e.state === "burstWarn") {
        e.mods.speed *= 0.6;
        if ((e.stateT -= dt) <= 0) {
          e.state = "move";
          a.cd = c.every;
        }
        return;
      }
      if ((a.cd -= dt) <= 0 && e.state === "move") {
        e.state = "absorb";
        e.stateT = c.dur;
        sim.emit({ type: "state", id: e.id, state: "absorb" });
      }
    },
  },
  /* 화염 폭탄병: 둥지 근처에서 심지 → 다 타면 둥지에 큰 피해 (그 전에 처치하면 안 터짐) */
  selfDestruct: {
    update(sim, e, c, a, dt) {
      const left = e.path.length - e.s;
      if (e.state === "arming") {
        e.mods.speed *= 0.85;
        if ((e.stateT -= dt) <= 0) {
          sim.emit({ type: "kamikaze", id: e.id, x: e.x, z: e.z });
          leakEnemy(sim, e, Math.round(c.leak * (e.elite ? 1.5 : 1)));
        }
        return;
      }
      if (left <= c.near && e.state === "move") {
        e.state = "arming";
        e.stateT = c.arm;
        sim.emit({ type: "state", id: e.id, state: "arming" });
      }
    },
  },
  /* 철갑 화염 멧돼지: 보호막 있는 동안만 돌진 · 깨지면 느려짐 */
  shieldCharge: {
    update(sim, e, c, a, dt) {
      if (e.shield <= 0) {
        if (e.state === "chargeWarn" || e.state === "charge") e.state = "move";
        e.mods.speed *= c.weakSpeed;
        return;
      }
      chargeLike(sim, e, c, a, dt, true);
    },
  },
  /* 재의 주술사: 둘레 친구 분노 (빨라지고 둥지를 더 세게) — 겹치지 않음 */
  rageAura: {
    update(sim, e, c, a, dt) {
      if ((a.cd -= dt) > 0) return;
      a.cd = c.every;
      for (const o of alliesNear(sim, e, c.r, true)) if (!o.boss || o === e) o.st.rage = { speed: c.speed, leakAdd: c.leakAdd, t: c.dur };
      sim.emit({ type: "pulse", id: e.id, r: c.r, look: "rage" });
    },
  },
  /* 그림자 기사: damage() 에서 방향 판정 */
  frontGuard: {},
  /* 환영 까마귀: 분신 (살아 있는 수 · 횟수 상한) */
  clones: {
    update(sim, e, c, a, dt) {
      if (a.n >= c.casts || (a.cd -= dt) > 0) return;
      a.cd = c.every;
      const alive = sim.enemies.filter((o) => o.parent === e.id && o.illusion && !o.dead && !o.leaked).length;
      if (alive >= c.maxAlive) return;
      a.n++;
      for (let i = 0; i < Math.min(c.n, c.maxAlive - alive); i++)
        sim.schedule(0, { type: "crowClone", gen: e.gen + 1, path: e.pathIdx, s: Math.max(0, e.s + (i ? 0.5 : -0.5)), lane: i ? 0.35 : -0.35, parent: e.id });
      sim.emit({ type: "clones", id: e.id });
    },
  },
  /* 영혼 수확자: kill() 에서 쌓임 · 여기서 효과 */
  soulFeed: {
    update(sim, e, c, a) {
      const n = a.stacks || 0;
      if (!n) return;
      e.mods.speed *= 1 + n * c.speed;
      e.mods.armor += n * c.armor;
    },
  },
  /* 암흑 소환사: 지난 월드 몬스터 소환 */
  summonPast: {
    update(sim, e, c, a, dt) {
      if (a.n >= c.max || (a.cd -= dt) > 0) return;
      a.cd = c.every;
      a.n++;
      const type = c.pool[Math.floor(sim.rng() * c.pool.length)];
      sim.schedule(0, { type, gen: e.gen + 1, path: e.pathIdx, s: Math.max(0, e.s - 0.5), lane: 0, parent: e.id, rewardMul: 0.5 });
      sim.emit({ type: "summon", id: e.id, what: type });
    },
  },
  /* 저주술사: 둘레 타워 공격력 ↓ (겹치지 않음) */
  curse: {
    update(sim, e, c, a, dt) {
      if ((a.cd -= dt) > 0) return;
      a.cd = c.every;
      for (const t of towersNear(sim, e.x, e.z, c.r)) sim.debuffTower(t, "curse", c.dmg, c.dur);
      sim.emit({ type: "pulse", id: e.id, r: c.r, look: "curse" });
    },
  },
  /* 공허 포식자: 체력이 낮으면 떨다가 폭주 (빨라짐 · 둥지 두 배 · 갑옷 벗음) */
  frenzy: {
    update(sim, e, c, a, dt) {
      if (a.on) {
        e.mods.speed *= c.speed;
        e.mods.armor -= e.armorBase;
        return;
      }
      if (e.state === "frenzyWarn") {
        e.mods.speed *= 0.4;
        if ((e.stateT -= dt) <= 0) {
          a.on = true;
          e.state = "frenzy";
          sim.emit({ type: "state", id: e.id, state: "frenzy" });
        }
        return;
      }
      if (e.hp <= e.maxHp * c.at) {
        e.state = "frenzyWarn";
        e.stateT = c.warn;
        sim.emit({ type: "state", id: e.id, state: "frenzyWarn" });
      }
    },
  },
};

/** 돌진 공통 (멧돼지 · 화염 멧돼지 · 늑대 짧은 돌진) */
function chargeLike(sim, e, c, a, dt, announce) {
  if (e.state === "chargeWarn") {
    e.mods.speed *= 0.15;
    if ((e.stateT -= dt) <= 0) {
      e.state = "charge";
      e.stateT = c.dur;
      if (announce) sim.emit({ type: "state", id: e.id, state: "charge" });
    }
    return;
  }
  if (e.state === "charge") {
    e.mods.speed *= c.mult;
    if ((e.stateT -= dt) <= 0) {
      e.state = "move";
      a.cd = c.every;
    }
    return;
  }
  if ((a.cd -= dt) <= 0 && e.state === "move" && e.path.length - e.s > 2) {
    e.state = "chargeWarn";
    e.stateT = c.warn;
    sim.emit({ type: "state", id: e.id, state: "chargeWarn" });
  }
}
ABILITY.dash = {
  update(sim, e, c, a, dt) {
    chargeLike(sim, e, c, a, dt, true);
  },
};
