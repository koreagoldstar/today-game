/*
 * NEW 둥지디펜스 · 전투 시뮬레이션 (그림 · 화면과 분리 — Node 에서도 그대로 돌아감)
 *  고정 걸음 DT 로만 진행 → 배속은 걸음을 여러 번, 멈춤은 걸음을 안 함 (모든 시간이 같이 멈춤)
 *  흐름: build(정비) → wave(전투) → cards(카드 고르기) → build … / won(월드 클리어) / lost
 *  화면에 보낼 일은 events 에 쌓고 (그림 쪽이 꺼내 감), 상태는 그대로 읽어 감.
 */
import { GameMap } from "./map.js";
import { Env } from "./env.js";
import { makeRng } from "./rng.js";
import { spawnEnemy, updateEnemy, damage } from "./enemies.js";
import { updateTowers, nextSteps, debuffTower, stunTower, statsOf, baseStats } from "./towers.js";
import { updateProjectiles } from "./projectiles.js";
import { TOWERS, SELL_RATE } from "../data/towers.js";
import { CARDS, cardById } from "../data/cards.js";
import { campaignWave, endlessWave, WAVES_PER_WORLD } from "../data/waves.js";
import { worldById } from "../data/worlds.js";

export const DT = 1 / 60;
/** 난이도: 적 체력 배율 · 처음 코인 배율 (아이도 끝까지 갈 수 있게 '쉬움') */
export const DIFFICULTY = {
  easy: { name: "쉬움", hp: 0.68, coins: 1.25 },
  normal: { name: "보통", hp: 1, coins: 1 },
  hard: { name: "어려움", hp: 1.3, coins: 0.9 },
};
export const NEST_HP = 20;
const MAX_ZONES = 40;
const MAX_EVENTS = 600;

const baseMods = () => ({ rate: 1, dmg: 1, range: 1, splash: 1, frost: 0, boss: 0, elite: 0, bounty: 0, double: 0, chain: 0, dot: 0, crit: 0, interest: 0, discount: 0, refund: SELL_RATE, enemySpeed: 1 });

export class Sim {
  /**
   * @param {{ world:number, mode?:"campaign"|"endless", seed?:number, snapshot?:object, startCoins?:number }} o
   */
  constructor(o) {
    this.mode = o.mode || "campaign";
    this.diffKey = DIFFICULTY[o.difficulty] ? o.difficulty : "normal";
    this.diff = DIFFICULTY[this.diffKey];
    this.world = worldById(o.world);
    this.map = new GameMap(this.world);
    this.env = new Env(this.world);
    this.seed = o.seed ?? 12345;
    this.rng = makeRng(this.seed);
    this.t = 0;
    this.nextId = 1;
    this.enemies = [];
    this.towers = [];
    this.projs = [];
    this.zones = [];
    this.markers = [];
    this.events = [];
    this.spawnQ = [];
    this.byIdMap = new Map();
    this.mods = baseMods();
    this.cards = {};
    this.offer = null;
    this.coins = o.startCoins ?? Math.round(this.world.startCoins * this.diff.coins);
    this.nest = { hp: NEST_HP, maxHp: NEST_HP, shield: 0, maxShield: 10 };
    this.score = 0;
    this.stats = { kills: 0, leaks: 0, coinsEarned: 0, dmg: 0, healed: 0, wavesCleared: 0, towersBuilt: 0 };
    this.local = 1; // 다음(또는 지금) 웨이브 번호 (캠페인: 1~30 · 무한: 1~)
    this.phase = "build";
    this.wave = null;
    this.waveT = 0;
    if (o.snapshot) this.restore(o.snapshot);
    this.wave = this.makeWave(this.local);
  }

  /* ---------------- 읽기 ---------------- */
  get globalWave() {
    return this.mode === "campaign" ? (this.world.id - 1) * WAVES_PER_WORLD + this.local : this.local;
  }
  makeWave(n) {
    return this.mode === "endless" ? endlessWave(n, this.map.paths.length) : campaignWave(this.world.id, n);
  }
  byId(id) {
    const e = this.byIdMap.get(id);
    return e && !e.dead && !e.leaked ? e : null;
  }
  aliveCount() {
    let n = 0;
    for (const e of this.enemies) if (!e.dead && !e.leaked) n++;
    return n;
  }
  /** 남은 적 수 (살아 있는 + 아직 안 나온) */
  remaining() {
    return this.aliveCount() + this.spawnQ.length;
  }
  towerAt(cx, cz) {
    return this.towers.find((t) => t.cx === cx && t.cz === cz) || null;
  }
  emit(ev) {
    this.events.push(ev);
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
  }
  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  /* ---------------- 플레이어 행동 ---------------- */
  costOf(type) {
    return Math.round(TOWERS[type].cost * (1 - this.mods.discount));
  }
  /** 설치: 칸 검사 → 성공할 때만 코인을 뺌 */
  canPlace(type, cx, cz) {
    if (!TOWERS[type]) return "없는 타워";
    if (this.phase === "won" || this.phase === "lost") return "끝난 판";
    if (!this.map.buildable(cx, cz)) return "여기엔 세울 수 없어요";
    if (this.towerAt(cx, cz)) return "이미 타워가 있어요";
    if (this.coins < this.costOf(type)) return "코인이 모자라요";
    return null;
  }
  place(type, cx, cz) {
    const why = this.canPlace(type, cx, cz);
    if (why) {
      this.emit({ type: "placeFail", why, cx, cz });
      return null;
    }
    const cost = this.costOf(type);
    const t = this.makeTower(type, cx, cz);
    t.spent = cost;
    this.coins -= cost;
    this.towers.push(t);
    this.stats.towersBuilt++;
    this.emit({ type: "place", tower: t.id, ttype: type });
    return t;
  }
  makeTower(type, cx, cz) {
    return {
      id: this.nextId++,
      type,
      cx,
      cz,
      x: cx + 0.5,
      z: cz + 0.5,
      y: this.map.height(cx, cz),
      level: 0,
      evo: null,
      elevel: 0,
      target: type === "cannon" ? "strong" : "first",
      spent: 0,
      cd: 0.2,
      deb: {},
      stunT: 0,
      stunImm: 0,
      zoneRate: 1,
      zoneDmg: 1,
      buffRate: 0,
      buffRange: 0,
      kills: 0,
      dmgDone: 0,
      fireT: -9,
      aimX: cx + 0.5,
      aimZ: cz + 1.5,
    };
  }
  tower(id) {
    return this.towers.find((t) => t.id === id) || null;
  }
  upgrade(id) {
    const t = this.tower(id);
    if (!t) return false;
    const n = nextSteps(this, t);
    if (!n.up || this.coins < n.up.cost) return false;
    this.coins -= n.up.cost;
    t.spent += n.up.cost;
    if (t.evo) t.elevel++;
    else t.level++;
    this.emit({ type: "upgrade", tower: t.id });
    return true;
  }
  evolve(id, key) {
    const t = this.tower(id);
    if (!t) return false;
    const opt = nextSteps(this, t).evos.find((e) => e.key === key);
    if (!opt || this.coins < opt.cost) return false;
    this.coins -= opt.cost;
    t.spent += opt.cost;
    t.evo = key;
    t.elevel = 0;
    t.deb = {};
    this.emit({ type: "evolve", tower: t.id, evo: key });
    return true;
  }
  sellValue(t) {
    return Math.floor(t.spent * this.mods.refund);
  }
  sell(id) {
    const i = this.towers.findIndex((t) => t.id === id);
    if (i < 0) return 0;
    const t = this.towers[i];
    const v = this.sellValue(t);
    this.coins += v;
    this.towers.splice(i, 1);
    // 이 타워가 깐 서리 장판은 함께 사라짐
    this.zones = this.zones.filter((z) => !(z.kind === "frost" && z.owner === t.id));
    this.emit({ type: "sell", tower: id, n: v, x: t.x, z: t.z });
    return v;
  }
  setTarget(id, mode) {
    const t = this.tower(id);
    if (t) t.target = mode;
  }

  /* ---------------- 웨이브 ---------------- */
  startWave() {
    if (this.phase !== "build") return false;
    this.wave = this.makeWave(this.local);
    this.phase = "wave";
    this.waveT = 0;
    this.env.reset();
    for (const g of this.wave.groups) {
      for (let i = 0; i < g.count; i++) {
        const path = g.path === "x" ? i % this.map.paths.length : g.path;
        this.spawnQ.push({ at: g.delay + i * g.interval, type: g.type, elite: g.elite, awakened: g.awakened, path, wave: true });
      }
    }
    this.spawnQ.sort((a, b) => a.at - b.at);
    this.emit({ type: "waveStart", n: this.local, boss: this.wave.boss, ev: this.wave.ev });
    return true;
  }
  /** 능력이 만드는 적 (분열 · 소환) — 큐에 넣어 웨이브 끝 판정이 기다리게 */
  schedule(delay, o) {
    this.spawnQ.push({ at: this.waveT + delay, ...o });
    this.spawnQ.sort((a, b) => a.at - b.at);
  }
  hurtNest(n, src) {
    if (n <= 0) return;
    let left = n;
    if (this.nest.shield > 0) {
      const s = Math.min(this.nest.shield, left);
      this.nest.shield -= s;
      left -= s;
      this.emit({ type: "nestBlock", n: s });
    }
    if (left > 0) {
      this.nest.hp = Math.max(0, this.nest.hp - left);
      this.emit({ type: "nestHit", n: left, boss: !!(src && src.boss) });
    }
    if (this.nest.hp <= 0 && this.phase === "wave") {
      this.phase = "lost";
      this.emit({ type: "lost" });
    }
  }

  /* ---------------- 구역 · 표시 ---------------- */
  addZone(z) {
    // 같은 주인 구역 수 상한 (오래된 것부터 지움) · 전체 상한
    if (z.max) {
      const mine = this.zones.filter((q) => q.owner === z.owner && q.kind === z.kind);
      while (mine.length >= z.max) {
        const old = mine.shift();
        this.zones.splice(this.zones.indexOf(old), 1);
      }
    }
    if (this.zones.length >= MAX_ZONES) this.zones.shift();
    // 불 지대는 겹친 서리 장판을 녹임
    if (z.kind === "fire") this.zones = this.zones.filter((q) => !(q.kind === "frost" && Math.hypot(q.x - z.x, q.z - z.z) < q.r + z.r * 0.7));
    const zone = { id: this.nextId++, t: 0, ...z };
    this.zones.push(zone);
    this.emit({ type: "zone", id: zone.id, kind: z.kind });
    return zone;
  }
  addMarker(m) {
    const mk = { id: this.nextId++, t: 0, ...m };
    this.markers.push(mk);
    return mk;
  }
  debuffTower(t, kind, mul, dur) {
    debuffTower(this, t, kind, mul, dur);
  }
  stunTower(t, dur, look) {
    return stunTower(this, t, dur, look);
  }
  stunTowers(x, z, r, dur, look) {
    let n = 0;
    for (const t of this.towers) if (Math.hypot(t.x - x, t.z - z) <= r && stunTower(this, t, dur, look)) n++;
    return n;
  }

  /* ---------------- 한 걸음 ---------------- */
  step(dt = DT) {
    if (this.phase !== "wave") return;
    this.t += dt;
    this.waveT += dt;
    // 1) 출현
    while (this.spawnQ.length && this.spawnQ[0].at <= this.waveT) {
      const q = this.spawnQ.shift();
      const e = spawnEnemy(this, q.type, q);
      if (e) this.byIdMap.set(e.id, e);
    }
    // 2) 환경
    this.env.update(this, dt);
    // 3) 구역 효과 계산 (적: 장판 감속 · 불 · 회복 / 타워: 독 · 불 근처 · 저주)
    for (const e of this.enemies) {
      e.st.zoneSlow = 1;
      e.st.onFire = false;
    }
    for (const t of this.towers) {
      t.zoneRate = 1;
      t.zoneDmg = 1;
    }
    const keepZ = [];
    for (const z of this.zones) {
      z.t += dt;
      if (z.t >= z.dur) continue;
      keepZ.push(z);
      const r2 = z.r * z.r;
      if (z.kind === "frost" || z.kind === "fire" || z.kind === "poison" || z.kind === "spore") {
        for (const e of this.enemies) {
          if (e.dead || e.leaked || e.flying) continue;
          if ((e.x - z.x) ** 2 + (e.z - z.z) ** 2 > r2) continue;
          if (z.kind === "frost") {
            e.st.zoneSlow = Math.min(e.st.zoneSlow, 1 - Math.min(0.7, z.slow * (1 + this.mods.frost)));
            if (z.dps && !e.mods.untargetable) damage(this, e, z.dps * dt, { type: "ice", dot: true, src: z.src });
          } else if (z.kind === "fire") e.st.onFire = true;
          else if (z.heal && !e.illusion) {
            const add = Math.min(e.maxHp - e.hp, e.maxHp * z.heal * dt * (e.boss ? 0.25 : 1));
            if (add > 0) e.hp += add;
          }
        }
      }
      if (z.kind === "poison" || z.kind === "fire") {
        if (z.towerRate && z.towerRate < 1) for (const t of this.towers) if ((t.x - z.x) ** 2 + (t.z - z.z) ** 2 <= (z.r + 0.6) ** 2) t.zoneRate = Math.min(t.zoneRate, z.towerRate);
      }
      if (z.kind === "curse") for (const t of this.towers) if ((t.x - z.x) ** 2 + (t.z - z.z) ** 2 <= r2) t.zoneDmg = Math.min(t.zoneDmg, z.dmg);
    }
    this.zones = keepZ;
    // 4) 적
    for (const e of this.enemies) updateEnemy(this, e, dt);
    // 5) 타워 · 6) 투사체
    updateTowers(this, dt);
    updateProjectiles(this, dt);
    // 7) 미리 표시 → 효과
    const keepM = [];
    for (const m of this.markers) {
      if (m.cancel) continue;
      m.t += dt;
      if (m.follow) {
        const o = this.byId(m.follow);
        if (o) {
          m.x = o.x;
          m.z = o.z;
        }
      }
      if (m.t >= m.dur) {
        if (m.done) m.done(this, m);
        continue;
      }
      keepM.push(m);
    }
    this.markers = keepM;
    // 8) 정리
    if (this.enemies.some((e) => e.dead || e.leaked)) {
      for (const e of this.enemies) if (e.dead || e.leaked) this.byIdMap.delete(e.id);
      this.enemies = this.enemies.filter((e) => !e.dead && !e.leaked);
    }
    if (this.phase === "lost") return;
    // 9) 웨이브 끝: 남은 적 · 예약 출현 · 진행 중 표시(폭발 대기 등)가 모두 없을 때
    if (!this.spawnQ.length && !this.enemies.length && !this.markers.some((m) => m.blocking)) this.clearWave();
  }

  clearWave() {
    const w = this.wave;
    let bonus = w.scale.clear;
    if (this.mods.interest > 0) bonus += Math.min(30 * this.mods.interest, Math.floor(this.coins * 0.05 * this.mods.interest));
    this.coins += bonus;
    this.score += 100 * this.local + this.nest.hp * 5;
    this.stats.wavesCleared++;
    this.zones = [];
    this.markers = [];
    this.projs = [];
    for (const t of this.towers) {
      t.deb = {};
      t.stunT = 0;
      t.stunImm = 0;
      t.cd = 0.2;
    }
    this.emit({ type: "waveClear", n: this.local, bonus, boss: w.boss });
    if (this.mode === "campaign" && this.local >= WAVES_PER_WORLD) {
      this.score += this.nest.hp * 200;
      this.phase = "won";
      this.emit({ type: "worldClear", world: this.world.id });
      return;
    }
    this.local++;
    this.wave = this.makeWave(this.local);
    this.offer = this.makeOffer();
    this.phase = this.offer.length ? "cards" : "build";
  }

  /* ---------------- 카드 ---------------- */
  makeOffer() {
    const pool = CARDS.filter((c) => c.instant || (this.cards[c.id] || 0) < c.max);
    const out = [];
    const bag = pool.slice();
    while (out.length < 3 && bag.length) {
      const sum = bag.reduce((a, c) => a + c.weight, 0);
      let r = this.rng() * sum;
      let i = 0;
      for (; i < bag.length - 1; i++) if ((r -= bag[i].weight) <= 0) break;
      out.push(bag[i].id);
      bag.splice(i, 1);
    }
    return out;
  }
  pickCard(i) {
    if (this.phase !== "cards" || !this.offer || !this.offer[i]) return false;
    const id = this.offer[i];
    this.applyCard(id);
    this.offer = null;
    this.phase = "build";
    this.emit({ type: "card", id });
    return true;
  }
  applyCard(id) {
    const m = this.mods;
    const c = cardById(id);
    if (!c) return;
    if (!c.instant) this.cards[id] = (this.cards[id] || 0) + 1;
    switch (id) {
      case "swift": m.rate += 0.08; break;
      case "power": m.dmg += 0.1; break;
      case "eagle": m.range += 0.07; break;
      case "blast": m.splash += 0.15; break;
      case "frost": m.frost += 0.2; break;
      case "boss": m.boss += 0.2; break;
      case "elite": m.elite += 0.25; break;
      case "bounty": m.bounty += 1; break;
      case "double": m.double += 0.08; break;
      case "chain": m.chain += 1; break;
      case "dot": m.dot += 0.25; break;
      case "crit": m.crit += 0.1; break;
      case "interest": m.interest += 1; break;
      case "discount": m.discount += 0.08; break;
      case "refund": m.refund = 0.9; break;
      case "shieldUp": this.nest.shield = Math.min(this.nest.maxShield, this.nest.shield + 3); break;
      case "repair": this.nest.hp = Math.min(this.nest.maxHp, this.nest.hp + 4); break;
    }
  }

  /* ---------------- 저장 (정비 시간에만 · 그림 객체는 안 넣음) ---------------- */
  snapshot() {
    if (this.phase !== "build" && this.phase !== "cards") return null;
    return {
      v: 1,
      world: this.world.id,
      mode: this.mode,
      local: this.local,
      phase: this.phase,
      offer: this.offer,
      coins: this.coins,
      nest: { ...this.nest },
      score: this.score,
      stats: { ...this.stats },
      cards: { ...this.cards },
      rng: this.rng.state(),
      nextId: this.nextId,
      towers: this.towers.map((t) => ({ id: t.id, type: t.type, cx: t.cx, cz: t.cz, level: t.level, evo: t.evo, elevel: t.elevel, target: t.target, spent: t.spent, kills: t.kills })),
    };
  }
  restore(s) {
    if (!s || s.v !== 1) throw new Error("저장 형식이 달라요");
    this.local = s.local;
    this.coins = s.coins;
    this.nest = { ...this.nest, ...s.nest };
    this.score = s.score;
    this.stats = { ...this.stats, ...s.stats };
    this.nextId = s.nextId;
    this.rng.set(s.rng);
    for (const [id, n] of Object.entries(s.cards || {})) for (let i = 0; i < n; i++) this.applyCard(id);
    for (const q of s.towers) {
      if (!TOWERS[q.type] || !this.map.buildable(q.cx, q.cz) || this.towerAt(q.cx, q.cz)) continue;
      const t = this.makeTower(q.type, q.cx, q.cz);
      Object.assign(t, { id: q.id, level: q.level, evo: q.evo, elevel: q.elevel, target: q.target, spent: q.spent, kills: q.kills || 0 });
      this.towers.push(t);
    }
    this.phase = s.phase === "cards" && s.offer ? "cards" : "build";
    this.offer = this.phase === "cards" ? s.offer : null;
  }
}

export { statsOf, baseStats, nextSteps };
