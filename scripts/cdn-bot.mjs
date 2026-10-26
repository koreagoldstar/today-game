/**
 * NEW 둥지디펜스 · 자동 플레이 로봇 (밸런스 · 끝까지 깨지는지 확인용)
 *  게임과 같은 시뮬레이션(js/sim)을 그대로 돌린다. 사람처럼 정비 시간에 타워를 세우고 · 강화 · 진화 · 카드를 고른다.
 *  level: "good"(보통 사람이 할 만한 배치) · "lazy"(궁수만 조금 — 이러면 져야 정상)
 */
import { Sim, DT } from "../games/chick-defense-new/js/sim/sim.js";
import { TOWERS } from "../games/chick-defense-new/js/data/towers.js";
import { nextSteps } from "../games/chick-defense-new/js/sim/towers.js";

const EVO_PICK = { archer: ["rapid", "pierce"], bomb: ["fire", "shock"], ice: ["frostField", "freezer"], lightning: ["storm", "thunder"], cannon: ["siege", "scatter"], healer: ["cheer", "guardian"] };
const CARD_PREF = ["power", "swift", "boss", "chain", "eagle", "double", "crit", "blast", "dot", "frost", "elite", "bounty", "interest", "discount", "refund", "repair", "shieldUp"];

function samples(sim) {
  const out = [];
  for (const p of sim.map.paths) {
    for (let s = p.entryS(); s < p.length; s += 0.5) {
      const q = p.at(s);
      out.push({ x: q.x, z: q.z, w: 0.6 + (0.8 * s) / p.length });
    }
  }
  return out;
}

function desired(w, level) {
  if (level === "lazy") return { archer: 3 };
  if (level === "ok")
    return {
      archer: Math.min(5, 2 + Math.floor(w / 6)),
      ice: w >= 4 ? Math.min(2, 1 + Math.floor(w / 14)) : 0,
      bomb: w >= 6 ? Math.min(3, 1 + Math.floor(w / 9)) : 0,
      lightning: w >= 9 ? Math.min(3, 1 + Math.floor(w / 11)) : 0,
      cannon: w >= 12 ? Math.min(2, 1 + Math.floor(w / 15)) : 0,
      healer: w >= 16 ? 1 : 0,
    };
  return {
    archer: Math.min(6, 2 + Math.floor(w / 5)),
    ice: w >= 3 ? Math.min(3, 1 + Math.floor(w / 10)) : 0,
    bomb: w >= 5 ? Math.min(4, 1 + Math.floor(w / 7)) : 0,
    lightning: w >= 7 ? Math.min(4, 1 + Math.floor(w / 8)) : 0,
    cannon: w >= 9 ? Math.min(3, 1 + Math.floor(w / 10)) : 0,
    healer: w >= 12 ? Math.min(2, 1 + Math.floor(w / 20)) : 0,
  };
}

function bestCell(sim, type, S, level, rnd) {
  const range = TOWERS[type].levels[0].range;
  let best = null;
  let bv = -1;
  const all = [];
  for (let z = 0; z < sim.map.d; z++)
    for (let x = 0; x < sim.map.w; x++) {
      if (!sim.map.buildable(x, z) || sim.towerAt(x, z)) continue;
      const cx = x + 0.5;
      const cz = z + 0.5;
      let v = 0;
      if (type === "healer") {
        for (const t of sim.towers) if (t.type !== "healer" && Math.hypot(t.x - cx, t.z - cz) <= range) v += 1 + t.level + (t.evo ? 2 : 0);
      } else for (const p of S) if (Math.hypot(p.x - cx, p.z - cz) <= range) v += p.w;
      all.push({ v, c: [x, z] });
      if (v > bv) {
        bv = v;
        best = [x, z];
      }
    }
  if (level === "ok" && all.length) {
    all.sort((a, b) => b.v - a.v);
    const top = all.slice(0, Math.max(1, Math.floor(all.length * 0.4)));
    return top[Math.floor(rnd() * top.length)].c;
  }
  return best;
}

function build(sim, level, S, rnd) {
  const w = sim.local;
  const want = desired(w, level);
  let guard = 0;
  while (guard++ < 60) {
    const have = {};
    for (const t of sim.towers) have[t.type] = (have[t.type] || 0) + 1;
    // 1) 모자란 종류 세우기
    let did = false;
    for (const type of ["archer", "ice", "bomb", "lightning", "cannon", "healer"]) {
      if ((have[type] || 0) >= (want[type] || 0)) continue;
      if (sim.coins < sim.costOf(type)) continue;
      const c = bestCell(sim, type, S, level, rnd);
      if (c && sim.place(type, c[0], c[1])) {
        did = true;
        break;
      }
    }
    if (did) continue;
    if (level === "lazy") break;
    // 2) 강화 · 진화 (싼 것부터)
    let bestT = null;
    let bestCost = Infinity;
    let bestEvo = null;
    for (const t of sim.towers) {
      const n = nextSteps(sim, t);
      if (n.up && n.up.cost < bestCost) {
        bestCost = n.up.cost;
        bestT = t;
        bestEvo = null;
      }
      if (n.evos.length) {
        const idx = sim.towers.filter((o) => o.type === t.type && o.evo).length % 2;
        const key = EVO_PICK[t.type][idx];
        const opt = n.evos.find((e) => e.key === key) || n.evos[0];
        if (opt.cost < bestCost) {
          bestCost = opt.cost;
          bestT = t;
          bestEvo = opt.key;
        }
      }
    }
    if (!bestT || sim.coins < bestCost) break;
    if (level === "ok" && bestEvo && rnd() < 0.5) break; // 진화는 망설이다 다음에
    if (bestEvo) sim.evolve(bestT.id, bestEvo);
    else sim.upgrade(bestT.id);
  }
}

function pickCard(sim, level, rnd) {
  const offer = sim.offer;
  if (level === "ok") return sim.pickCard(Math.floor(rnd() * offer.length));
  let bi = 0;
  let bv = 99;
  offer.forEach((id, i) => {
    let v = CARD_PREF.indexOf(id);
    if (id === "repair" && sim.nest.hp <= 14) v = -1;
    if (v < 0 && id !== "repair") v = 50;
    if (v < bv) {
      bv = v;
      bi = i;
    }
  });
  sim.pickCard(bi);
}

/** 한 월드 30 웨이브 (또는 무한 생존 n 웨이브) */
export function playWorld(world, { level = "good", seed = 1, mode = "campaign", maxWaves = 30, onWave, difficulty = "normal" } = {}) {
  const sim = new Sim({ world, seed, mode, difficulty });
  const S = samples(sim);
  let rs = seed * 7919 + 13;
  const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
  const log = [];
  const evCount = {};
  while (sim.phase !== "won" && sim.phase !== "lost") {
    if (sim.phase === "cards") pickCard(sim, level, rnd);
    build(sim, level, S, rnd);
    const n = sim.local;
    const hp0 = sim.nest.hp;
    sim.startWave();
    let steps = 0;
    while (sim.phase === "wave") {
      sim.step(DT);
      if (globalThis.__prog) for (const e of sim.enemies) globalThis.__prog(n, e.s / e.path.length);
      for (const e of sim.drainEvents()) evCount[e.type] = (evCount[e.type] || 0) + 1;
      if (++steps > 60 * 900) {
        log.push({ n, stuck: true });
        return { won: false, stuck: n, sim, log, evCount };
      }
    }
    const rec = { n, t: +(steps * DT).toFixed(1), lost: hp0 - sim.nest.hp, nest: sim.nest.hp, coins: sim.coins, towers: sim.towers.length };
    log.push(rec);
    if (onWave) onWave(rec, sim);
    if (mode === "endless" && n >= maxWaves) break;
  }
  return { won: sim.phase === "won" || (mode === "endless" && sim.phase !== "lost"), sim, log, evCount, reached: sim.local };
}
