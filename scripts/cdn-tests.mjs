/**
 * NEW 둥지디펜스 · 규칙 단위 점검 (Node · 브라우저 없이)
 *  node scripts/cdn-tests.mjs        → 전부
 *  node scripts/cdn-tests.mjs boss   → 이름에 boss 가 들어간 것만
 *  게임과 같은 시뮬레이션(js/sim)을 직접 만들어 능력 · 규칙이 '실제로' 전투에 들어가는지 확인한다.
 */
import { Sim, DT } from "../games/chick-defense-new/js/sim/sim.js";
import { spawnEnemy, damage, kill, MAX_ACTIVE, effArmor } from "../games/chick-defense-new/js/sim/enemies.js";
import { statsOf, findTarget, baseStats, nextSteps } from "../games/chick-defense-new/js/sim/towers.js";
import { ENEMIES, BOSSES, specialsOf, bossesOf } from "../games/chick-defense-new/js/data/enemies.js";
import { TOWERS } from "../games/chick-defense-new/js/data/towers.js";
import { endlessWave, ENDLESS_MAX_HP } from "../games/chick-defense-new/js/data/waves.js";
import { playWorld } from "./cdn-bot.mjs";

const only = process.argv[2] || "";
const results = [];
function test(name, fn) {
  if (only && !name.includes(only)) return;
  let ok = false;
  let detail = "";
  try {
    const r = fn();
    ok = r === true || (r && r.ok);
    detail = r && r.detail ? r.detail : "";
  } catch (e) {
    detail = "오류 " + (e.stack || e).toString().split("\n").slice(0, 2).join(" ");
  }
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}
const R = (ok, detail) => ({ ok: !!ok, detail });

/** 웨이브 중인 빈 판 (적은 직접 넣음) */
function arena(world = 1, o = {}) {
  const sim = new Sim({ world, seed: o.seed || 5, startCoins: o.coins ?? 5000 });
  sim.startWave();
  sim.spawnQ = [];
  return sim;
}
const add = (sim, type, o = {}) => {
  const e = spawnEnemy(sim, type, o);
  if (e) sim.byIdMap.set(e.id, e);
  return e;
};
const run = (sim, sec, each) => {
  const n = Math.round(sec / DT);
  for (let i = 0; i < n; i++) {
    sim.step(DT);
    if (each && each(i) === false) return;
    if (sim.phase !== "wave") return;
  }
};
/** 판에 적이 하나도 없으면 웨이브가 끝나 버리므로, 시험 동안 먼 곳에 묶어 둘 '말뚝' */
const peg = (sim) => {
  const e = add(sim, "beetle", { s: 0.2 });
  e.speedBase = 0;
  e.hp = e.maxHp = 1e9;
  e.reward = 0;
  return e;
};
/** 길 위 s 에서 가장 가까운 설치 칸 */
function cellNear(sim, s, path = 0) {
  const p = sim.map.paths[path].at(s);
  let best = null;
  let bd = 99;
  for (let z = 0; z < sim.map.d; z++)
    for (let x = 0; x < sim.map.w; x++) {
      if (!sim.map.buildable(x, z) || sim.towerAt(x, z)) continue;
      const d = Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z);
      if (d < bd) {
        bd = d;
        best = [x, z];
      }
    }
  return best;
}

/* ======================= 기본 흐름 ======================= */
test("1 시작 · 초기화: 정비 단계 · 처음 코인 · 둥지 20 · 적 없음", () => {
  const sim = new Sim({ world: 1, seed: 1 });
  return R(sim.phase === "build" && sim.coins === 220 && sim.nest.hp === 20 && sim.enemies.length === 0 && sim.local === 1, `${sim.phase} ${sim.coins} ${sim.nest.hp}`);
});
test("2 설치하면 정확히 가격만큼 코인이 줄고 · 3 길 · 둥지 · 물 · 이미 있는 칸 · 코인 부족이면 실패하고 코인 그대로", () => {
  const sim = new Sim({ world: 1, seed: 1 });
  const c0 = sim.coins;
  const [x, z] = cellNear(sim, 5);
  const t = sim.place("archer", x, z);
  const afterOk = sim.coins;
  const fails = [sim.place("archer", 3, 2), sim.place("archer", 19, 10), sim.place("archer", 9, 7), sim.place("archer", x, z)];
  const afterFail = sim.coins;
  const poor = new Sim({ world: 1, seed: 1, startCoins: 50 });
  const p = poor.place("archer", x, z);
  return R(t && afterOk === c0 - 60 && fails.every((f) => f === null) && afterFail === afterOk && p === null && poor.coins === 50, `${c0}→${afterOk} · 실패 4 → ${afterFail} · 코인 50 → ${poor.coins}`);
});
test("4 타워 공격 · 피해 계산: 궁수 8 → 슬라임 체력 8 깎임 · 딱정벌레(갑옷 0.3)는 5.6", () => {
  const sim = arena(1);
  peg(sim);
  const [x, z] = cellNear(sim, 6);
  const t = sim.place("archer", x, z);
  const e = add(sim, "slime", { s: sim.map.paths[0].nearest(x + 0.5, z + 0.5).s, lane: 0 });
  e.speedBase = 0;
  const hp0 = e.hp;
  let first = null;
  run(sim, 3, () => {
    if (e.hp < hp0 && first == null) first = hp0 - e.hp;
  });
  const b = add(sim, "beetle", { s: e.s, lane: 0 });
  b.speedBase = 0;
  const bh = b.hp;
  e.hp = 0;
  kill(sim, e);
  let bf = null;
  run(sim, 3, () => {
    if (b.hp < bh && bf == null) bf = bh - b.hp;
  });
  return R(Math.abs(first - 8) < 1e-6 && Math.abs(bf - 5.6) < 1e-6, `슬라임 -${first} · 딱정벌레 -${bf}`);
});
test("5 처치 보상은 한 번만 (두 번 쓰러뜨려도 · 피해가 겹쳐도)", () => {
  const sim = arena(1);
  peg(sim);
  const e = add(sim, "slime", { s: 5 });
  const c0 = sim.coins;
  damage(sim, e, 9999);
  damage(sim, e, 9999);
  kill(sim, e);
  return R(sim.coins - c0 === e.reward && sim.stats.kills === 1, `+${sim.coins - c0} (보상 ${e.reward}) · 처치 ${sim.stats.kills}`);
});
test("6 분열 상한: 분열체 → 꼬마 2 (세대 1) · 꼬마는 다시 안 갈라짐 · 적이 가득하면 분열 생략", () => {
  const sim = arena(1);
  peg(sim);
  const e = add(sim, "shroomSplit", { s: 6 });
  kill(sim, e);
  run(sim, 0.3);
  const kids = sim.enemies.filter((o) => o.type === "sprout");
  for (const k of kids) kill(sim, k);
  run(sim, 0.3);
  const grand = sim.enemies.filter((o) => o.type === "sprout").length;
  // 가득 찬 판
  const s2 = arena(1);
  for (let i = 0; i < MAX_ACTIVE; i++) add(s2, "slime", { s: 1 + (i % 20) * 0.1 }).speedBase = 0;
  const sp = add(s2, "shroomSplit", { s: 8 });
  const n0 = s2.aliveCount();
  kill(s2, sp);
  run(s2, 0.3);
  return R(kids.length === 2 && kids.every((k) => k.gen === 1) && grand === 0 && s2.aliveCount() <= n0, `꼬마 ${kids.length} (세대 ${kids.map((k) => k.gen)}) · 손주 ${grand} · 가득 찬 판 ${n0}→${s2.aliveCount()}`);
});
test("7 두더지: 흙더미 신호 → 땅속(표적 불가) → 다시 나옴 · 길 진행은 앞으로만 · 둥지 바로 앞에선 반드시 나옴", () => {
  const sim = arena(1);
  peg(sim);
  const e = add(sim, "mole", { s: 3 });
  let prev = e.s;
  let back = false;
  const states = new Set();
  let untargetSeen = false;
  let emergeS = [];
  run(sim, 70, () => {
    if (e.dead || e.leaked) return false;
    if (e.s < prev - 1e-9) back = true;
    prev = e.s;
    states.add(e.state);
    if (e.state === "burrow" && e.mods.untargetable) untargetSeen = true;
    if (e.state === "emerge" && !emergeS.includes(Math.round(e.s))) emergeS.push(Math.round(e.s));
  });
  const L = e.path.length;
  return R(!back && states.has("burrowWarn") && untargetSeen && states.has("emerge") && e.ab.burrow.n <= 2 && e.leaked && emergeS.every((s) => s <= L - 1), `상태 ${[...states]} · 땅굴 ${e.ab.burrow.n}번 · 나온 곳 ${emergeS} / 길 ${L.toFixed(1)} · 뒤로 감 ${back}`);
});
test("8 치료량 제한: 가장 다친 친구 우선 · 한 번 12% · 한 대상 평생 최대 100%", () => {
  const sim = arena(1);
  peg(sim);
  const h = add(sim, "featherHealer", { s: 5, lane: 0 });
  const a = add(sim, "beetle", { s: 5.5, lane: 0 });
  const b = add(sim, "beetle", { s: 5.2, lane: 0 });
  for (const o of [h, a, b]) o.speedBase = 0;
  a.hp = a.maxHp * 0.3;
  b.hp = b.maxHp * 0.8;
  let firstTo = null;
  let maxOnce = 0;
  const last = { a: a.hp };
  run(sim, 2.95);
  run(sim, 0.2, () => {
    if (firstTo == null && a.hp > last.a + 1e-9) firstTo = "a";
  });
  for (let i = 0; i < 60; i++) {
    a.hp = Math.max(1, a.hp - a.maxHp * 0.2);
    const before = a.hp;
    run(sim, 3.1);
    maxOnce = Math.max(maxOnce, a.hp - before);
  }
  return R(firstTo === "a" && maxOnce <= a.maxHp * 0.12 + 1e-6 && a.healed <= a.maxHp * 1 + 1e-6, `먼저 ${firstTo} · 한 번 최대 ${(maxOnce / a.maxHp * 100).toFixed(1)}% · 평생 ${(a.healed / a.maxHp * 100).toFixed(0)}%`);
});
test("9 돌진: 준비 → 빠르게 · 늘 길 위 · 둥지를 건너뛰지 않고 한 번만 도달", () => {
  const sim = arena(1);
  peg(sim);
  const e = add(sim, "boar", { s: 35, lane: 0 });
  let maxV = 0;
  let offPath = 0;
  let leaks = 0;
  let prev = e.s;
  let back = false;
  run(sim, 40, () => {
    if (!e.leaked && !e.dead) {
      maxV = Math.max(maxV, e.v);
      offPath = Math.max(offPath, e.path.nearest(e.x, e.z).d);
      if (e.s < prev - 1e-9) back = true;
      prev = e.s;
    }
  });
  leaks = sim.stats.leaks;
  return R(maxV > e.speedBase * 2.5 && offPath < 0.01 && leaks === 1 && !back && e.s <= e.path.length, `최고 속도 ${maxV.toFixed(2)} (기본 ${e.speedBase}) · 길에서 벗어난 거리 ${offPath.toFixed(3)} · 도달 ${leaks}`);
});
test("10 둥지 피해 → 0 이면 패배 (방어막이 먼저 막음)", () => {
  const sim = arena(1);
  sim.nest.shield = 2;
  for (let i = 0; i < 30; i++) add(sim, "slime", { s: sim.map.paths[0].length - 0.2 - i * 0.01 });
  run(sim, 2);
  return R(sim.phase === "lost" && sim.nest.hp === 0 && sim.nest.shield === 0, `${sim.phase} · 둥지 ${sim.nest.hp} · 방어막 ${sim.nest.shield}`);
});
test("11 웨이브 끝 → 카드 3장 → 고르면 정비 · 다음 웨이브 번호 · 보너스 코인", () => {
  const sim = new Sim({ world: 1, seed: 2 });
  const [x, z] = cellNear(sim, 6);
  sim.place("archer", x, z);
  const [x2, z2] = cellNear(sim, 20);
  sim.place("archer", x2, z2);
  sim.startWave();
  run(sim, 120);
  const ph = sim.phase;
  const offer = sim.offer ? sim.offer.slice() : [];
  const c = sim.coins;
  sim.pickCard(0);
  return R(ph === "cards" && offer.length === 3 && new Set(offer).size === 3 && sim.phase === "build" && sim.local === 2 && sim.startWave(), `${ph} · 카드 ${offer} · 코인 ${c} · 다음 ${sim.local}`);
});
test("12 예약된 분열 · 폭발 대기 중엔 웨이브가 안 끝남", () => {
  const sim = arena(2);
  const e = add(sim, "sporeBomb", { s: 6 });
  const s2 = add(sim, "shroomSplit", { s: 6 });
  kill(sim, e);
  kill(sim, s2);
  sim.step(DT);
  const mid = { phase: sim.phase, markers: sim.markers.length, q: sim.spawnQ.length, alive: sim.aliveCount() };
  for (const o of sim.enemies) kill(sim, o);
  run(sim, 2, () => {
    for (const o of sim.enemies) kill(sim, o);
  });
  return R(mid.phase === "wave" && (mid.markers > 0 || mid.q > 0 || mid.alive > 0) && sim.phase === "cards", `직후 ${JSON.stringify(mid)} → ${sim.phase}`);
});
test("14 강화 · 진화 비용과 수치 (화면 수치 = 전투 수치)", () => {
  const sim = new Sim({ world: 1, seed: 1, startCoins: 5000 });
  const [x, z] = cellNear(sim, 6);
  const t = sim.place("archer", x, z);
  const c0 = sim.coins;
  sim.upgrade(t.id);
  const c1 = sim.coins;
  sim.upgrade(t.id);
  const c2 = sim.coins;
  const evos = nextSteps(sim, t).evos.map((e) => e.key).join(",");
  sim.evolve(t.id, "rapid");
  const c3 = sim.coins;
  const st = statsOf(sim, t);
  const sell = sim.sellValue(t);
  const v = sim.sell(t.id);
  return R(c0 - c1 === 45 && c1 - c2 === 75 && evos === "rapid,pierce" && c2 - c3 === 150 && st.rate === 3.8 && st.dmg === 15 && v === sell && v === Math.floor((60 + 45 + 75 + 150) * 0.7), `강화 -${c0 - c1} -${c1 - c2} · 진화 ${evos} -${c2 - c3} · 속사 ${st.dmg}×${st.rate} · 판매 ${v}`);
});
test("16 다시 하기 (같은 씨앗) → 완전히 같은 판 · 17 걸음을 나눠도 결과 같음 (배속 안전)", () => {
  const play = (chunk) => {
    const sim = new Sim({ world: 1, seed: 9 });
    const [x, z] = cellNear(sim, 6);
    sim.place("archer", x, z);
    sim.startWave();
    let i = 0;
    while (sim.phase === "wave" && i < 6000) {
      for (let k = 0; k < chunk && sim.phase === "wave"; k++, i++) sim.step(DT);
    }
    return JSON.stringify([sim.coins, sim.stats.kills, sim.nest.hp, sim.local, Math.round(sim.stats.dmg)]);
  };
  const a = play(1);
  const b = play(3);
  const c = play(1);
  return R(a === b && a === c, `${a} / ${b} / ${c}`);
});
test("22 저장 → 복구: 타워 · 단계 · 코인 · 카드 · 둥지 · 웨이브 번호 그대로 (그림 객체 없음)", () => {
  const sim = new Sim({ world: 1, seed: 3, startCoins: 2000 });
  const [x, z] = cellNear(sim, 6);
  const t = sim.place("archer", x, z);
  sim.upgrade(t.id);
  sim.upgrade(t.id);
  sim.evolve(t.id, "pierce");
  sim.applyCard("swift");
  sim.applyCard("swift");
  sim.nest.hp = 13;
  sim.local = 7;
  const snap = JSON.parse(JSON.stringify(sim.snapshot()));
  const b = new Sim({ world: 1, seed: 3, snapshot: snap });
  const t2 = b.towers[0];
  return R(t2 && t2.evo === "pierce" && b.coins === sim.coins && b.nest.hp === 13 && b.local === 7 && Math.abs(b.mods.rate - 1.16) < 1e-9 && b.cards.swift === 2 && !JSON.stringify(snap).includes("THREE"), `타워 ${t2 && t2.type}/${t2 && t2.evo} · 코인 ${b.coins} · 둥지 ${b.nest.hp} · ${b.local}번 · 공격속도 ${b.mods.rate}`);
});

/* ======================= 월드 특화 적 능력 ======================= */
function towerBeside(sim, e, type = "archer") {
  const c = cellNear(sim, e.s, e.pathIdx);
  return sim.place(type, c[0], c[1]);
}
test("W1 거북: 방어 태세 동안 같은 화살 피해가 크게 줄고 느려짐", () => {
  const sim = arena(1);
  peg(sim);
  const e = add(sim, "turtle", { s: 5 });
  const normal = damage(sim, e, 10, { type: "phys" });
  run(sim, 2.1);
  const st = e.state;
  const v = e.v;
  const def = damage(sim, e, 10, { type: "phys" });
  return R(st === "defend" && def < normal * 0.6 && v < e.speedBase * 0.5, `${st} · 평소 ${normal.toFixed(1)} → 방어 ${def.toFixed(1)} · 속도 ${v.toFixed(2)}`);
});
test("W1 박쥐 도적: 하늘(폭탄 · 대포는 못 노림 · 궁수는 노림) · 둥지에 닿으면 코인을 훔침", () => {
  const sim = arena(1);
  peg(sim);
  const e = add(sim, "bat", { s: 8, lane: 0 });
  e.speedBase = 0;
  const b = towerBeside(sim, e, "bomb");
  const a = towerBeside(sim, e, "archer");
  const tb = findTarget(sim, b, statsOf(sim, b));
  const ta = findTarget(sim, a, statsOf(sim, a));
  const c0 = sim.coins;
  e.speedBase = 3;
  e.s = e.path.length - 0.3;
  run(sim, 0.5);
  return R(e.flying && !tb && ta === e && c0 - sim.coins === 6, `폭탄 표적 ${tb && tb.id} · 궁수 표적 ${ta && ta.id} · 훔친 코인 ${c0 - sim.coins}`);
});
test("W2 독버섯: 독 구름 → 옆 타워 공격속도 0.8배 · 구름 속 적 회복 · 한 마리 구름 최대 3", () => {
  const sim = arena(2);
  peg(sim);
  const e = add(sim, "poisonSpore", { s: 6, lane: 0 });
  e.speedBase = 0.4;
  run(sim, 1.4);
  const z = sim.zones.find((q) => q.kind === "poison");
  const c = cellNear(sim, sim.map.paths[0].nearest(z.x, z.z).s);
  const t = sim.place("archer", c[0], c[1]);
  const f = add(sim, "beetle", { s: e.s, lane: 0 });
  f.speedBase = 0;
  f.x = z.x;
  f.z = z.z;
  f.hp = f.maxHp * 0.5;
  run(sim, 6);
  const mine = sim.zones.filter((q) => q.owner === e.id).length;
  const rate = statsOf(sim, t).rate;
  return R(z && Math.abs(t.zoneRate - 0.8) < 1e-9 && rate < 1.4 && mine <= 3, `타워 배율 ${t.zoneRate} (공격속도 ${rate.toFixed(2)}) · 구름 ${mine}`);
});
test("W2 포자 폭탄충: 쓰러지면 표시 → 폭발 → 근처 타워 멈춤 (면역 시간 지킴)", () => {
  const sim = arena(2);
  peg(sim);
  const e = add(sim, "sporeBomb", { s: 6, lane: 0 });
  e.speedBase = 0;
  const t = towerBeside(sim, e);
  kill(sim, e);
  const marked = sim.markers.length;
  run(sim, 0.7);
  const st1 = t.stunT;
  const e2 = add(sim, "sporeBomb", { s: 6, lane: 0 });
  e2.speedBase = 0;
  kill(sim, e2);
  run(sim, 0.7);
  return R(marked === 1 && st1 > 0.4 && t.stunImm > 0, `표시 ${marked} · 멈춤 ${st1.toFixed(2)}초 · 면역 ${t.stunImm.toFixed(2)}`);
});
test("W2 덩굴 기어충: 옆 타워 공격속도 0.6배 (겹치지 않음)", () => {
  const sim = arena(2);
  peg(sim);
  const e = add(sim, "vineCrawler", { s: 6, lane: 0 });
  e.speedBase = 0;
  const t = towerBeside(sim, e);
  const e2 = add(sim, "vineCrawler", { s: 6, lane: 0 });
  e2.speedBase = 0;
  run(sim, 0.2);
  return R(t.deb.vine && t.deb.vine.mul === 0.6, `덩굴 ${JSON.stringify(t.deb.vine)}`);
});
test("W2 복제술사: 꼬마 소환 최대 3번 (꼬마는 소환 안 함)", () => {
  const sim = arena(2);
  peg(sim);
  const e = add(sim, "cloner", { s: 3 });
  e.speedBase = 0;
  run(sim, 30);
  const minis = sim.enemies.filter((o) => o.type === "miniShroom");
  return R(e.ab.summon.n === 3 && minis.length === 6 && minis.every((m) => m.gen === 1), `소환 ${e.ab.summon.n}번 · 꼬마 ${minis.length}`);
});
test("W2 꿀벌 치료사: 하늘을 날며 자주 조금씩 치료 (깃털 치료사와 다른 설정)", () => {
  const sim = arena(2);
  peg(sim);
  const h = add(sim, "beeHealer", { s: 5, lane: 0 });
  const a = add(sim, "beetle", { s: 5.2, lane: 0 });
  h.speedBase = a.speedBase = 0;
  a.hp = a.maxHp * 0.3;
  const h0 = a.hp;
  run(sim, 2);
  return R(h.flying && a.hp > h0 && a.hp - h0 <= a.maxHp * 0.07 + 1e-6, `하늘 ${h.flying} · 회복 ${((a.hp - h0) / a.maxHp * 100).toFixed(1)}%`);
});
test("W2 거대 버섯 갑각병: 폭발 · 화살에 강하고 불 · 번개에 약함", () => {
  const sim = arena(2);
  peg(sim);
  const v = {};
  for (const type of ["phys", "blast", "fire", "shock"]) {
    const e = add(sim, "shroomKnight", { s: 5 });
    e.hp = e.maxHp = 1e6;
    v[type] = damage(sim, e, 100, { type, noCrit: true });
  }
  return R(v.phys < 50 && v.blast < 60 && v.fire > 120 && v.shock > 110, `화살 ${v.phys.toFixed(0)} · 폭발 ${v.blast.toFixed(0)} · 불 ${v.fire.toFixed(0)} · 번개 ${v.shock.toFixed(0)}`);
});
test("W3 얼음 늑대: 몸을 낮춘 뒤 빠르게 돌진", () => {
  const sim = arena(3);
  peg(sim);
  const e = add(sim, "iceWolf", { s: 3 });
  let maxV = 0;
  const st = new Set();
  run(sim, 4, () => {
    maxV = Math.max(maxV, e.v || 0);
    st.add(e.state);
  });
  return R(st.has("chargeWarn") && maxV > e.speedBase * 2, `상태 ${[...st]} · 최고 ${maxV.toFixed(2)}`);
});
test("W3 서리 박쥐: 날기 ↔ 내려앉기 (내려앉으면 폭탄도 노림) · 스친 타워 공격속도 0.7배", () => {
  const sim = arena(3);
  peg(sim);
  const e = add(sim, "frostBat", { s: 6, lane: 0 });
  e.speedBase = 0;
  const b = towerBeside(sim, e, "bomb");
  const flyingSeen = new Set();
  let bombTarget = false;
  let frost = null;
  b.cd = 1e9;
  run(sim, 6, () => {
    flyingSeen.add(e.flying);
    if (!e.flying && findTarget(sim, b, statsOf(sim, b)) === e) bombTarget = true;
    if (b.deb.frost) frost = b.deb.frost.mul;
  });
  return R(flyingSeen.has(true) && flyingSeen.has(false) && bombTarget && frost === 0.7, `날기 ${[...flyingSeen]} · 내려앉았을 때 폭탄 표적 ${bombTarget} · 서리 ${frost}`);
});
test("W3 빙결 골렘: 보호막이 먼저 피해를 받고 · 깨지면 휘청 + 더 아픔 · 시간이 지나면 다시 생김", () => {
  const sim = arena(3);
  peg(sim);
  const e = add(sim, "frostGolem", { s: 5 });
  e.speedBase = 0;
  run(sim, 1.1);
  const sh = e.shield;
  const hp0 = e.hp;
  damage(sim, e, sh * 0.5, { type: "shock" });
  const hpMid = e.hp;
  damage(sim, e, sh, { type: "shock" });
  const stag = e.state;
  const vuln = e.st.vuln;
  run(sim, 7.5);
  return R(sh > 0 && hpMid === hp0 && stag === "stagger" && vuln > 1 && e.shield > 0, `보호막 ${sh.toFixed(0)} · 반 맞아도 체력 그대로 ${hpMid === hp0} · 깨진 뒤 ${stag} ×${vuln} · 다시 ${e.shield.toFixed(0)}`);
});
test("W3 눈보라 정령: 둘레 친구 갑옷 +0.25 (겹치지 않음)", () => {
  const sim = arena(3);
  peg(sim);
  const s1 = add(sim, "blizzardSpirit", { s: 5, lane: 0 });
  const s2 = add(sim, "blizzardSpirit", { s: 5.1, lane: 0 });
  const f = add(sim, "slime", { s: 5.3, lane: 0 });
  for (const o of [s1, s2, f]) o.speedBase = 0;
  run(sim, 5.1);
  return R(Math.abs(f.st.armorBuff - 0.25) < 1e-9 && effArmor(f) <= 0.25 + 1e-9, `친구 갑옷 ${f.st.armorBuff}`);
});
test("W3 얼음 수정충: 친구 셋에게 보호막 (상한 60%)", () => {
  const sim = arena(3);
  peg(sim);
  const c = add(sim, "crystalBug", { s: 5, lane: 0 });
  const fr = [0, 1, 2, 3].map((i) => add(sim, "slime", { s: 5.2 + i * 0.2, lane: 0 }));
  for (const o of [c, ...fr]) o.speedBase = 0;
  run(sim, 30);
  const shielded = fr.filter((o) => o.shield > 0).length;
  return R(shielded === 3 && fr.every((o) => o.shield <= o.maxHp * 0.6 + 1e-6), `보호막 받은 친구 ${shielded} · 최대 ${Math.max(...fr.map((o) => o.shield / o.maxHp)).toFixed(2)}`);
});
test("W3 설원 그림자: 화살을 피해 앞으로 순간이동 (최대 3번) · 번개는 못 피함", () => {
  const sim = arena(3);
  peg(sim);
  const e = add(sim, "snowShade", { s: 5 });
  e.speedBase = 0;
  e.hp = e.maxHp = 1e6;
  let dodged = 0;
  for (let i = 0; i < 200; i++) {
    if (damage(sim, e, 1, { canDodge: true }) === 0) dodged++;
    run(sim, 0.4);
  }
  const s1 = e.s;
  const shock = damage(sim, e, 10, { type: "shock" });
  return R(dodged === 3 && e.ab.dodge.charges === 0 && s1 > 5 && shock > 0, `피함 ${dodged} · 남은 ${e.ab.dodge.charges} · 앞으로 ${(s1 - 5).toFixed(1)} · 번개 ${shock}`);
});
test("W4 용암 도마뱀: 불 자국 위 적은 감속이 풀림 · 근처 타워 과열 · 불이 서리 장판을 녹임", () => {
  const sim = arena(4);
  peg(sim);
  const e = add(sim, "lavaLizard", { s: 6, lane: 0 });
  e.speedBase = 0.01;
  sim.addZone({ kind: "frost", x: e.x, z: e.z, r: 1.2, dur: 9, owner: 999, max: 3, slow: 0.5, dps: 0 });
  const f = add(sim, "slime", { s: 6, lane: 0 });
  f.speedBase = 1;
  f.st.slow = 0.4;
  f.st.slowT = 5;
  run(sim, 1.2);
  const frostLeft = sim.zones.filter((z) => z.kind === "frost").length;
  return R(f.st.onFire && f.v >= f.speedBase * 0.99 && frostLeft === 0, `불 위 ${f.st.onFire} · 속도 ${f.v.toFixed(2)} · 남은 서리 ${frostLeft}`);
});
test("W4 마그마 골렘: 굳기(피해 70% 막음) → 빨간 표시 → 폭발로 근처 타워 멈춤 · 그 전에 쓰러뜨리면 폭발 없음", () => {
  const sim = arena(4);
  peg(sim);
  const e = add(sim, "magmaGolem", { s: 6, lane: 0 });
  e.speedBase = 0;
  const t = towerBeside(sim, e, "lightning");
  t.cd = 99;
  run(sim, 3.1);
  const st = e.state;
  const cut = damage(sim, e, 100, { type: "shock" });
  run(sim, 4);
  const stunned = t.stunImm > 0;
  const s2 = arena(4);
  peg(s2);
  const g2 = add(s2, "magmaGolem", { s: 6, lane: 0 });
  g2.speedBase = 0;
  const t2 = towerBeside(s2, g2, "lightning");
  t2.cd = 99;
  run(s2, 5.7);
  kill(s2, g2);
  run(s2, 2);
  return R(st === "absorb" && cut < 31 && stunned && t2.stunImm <= 0, `${st} · 피해 100 → ${cut.toFixed(0)} · 폭발 멈춤 ${stunned} · 먼저 쓰러뜨리면 ${t2.stunImm <= 0 ? "안 멈춤" : "멈춤"}`);
});
test("W4 화염 폭탄병: 둥지 근처에서 심지 → 다 타면 둥지 -4 · 심지 동안 처치하면 안 터짐", () => {
  const sim = arena(4);
  peg(sim);
  const L = sim.map.paths[0].length;
  const e = add(sim, "fireBomber", { s: L - 4.6 });
  run(sim, 0.3);
  const st = e.state;
  run(sim, 2.2);
  const hp1 = sim.nest.hp;
  const s2 = arena(4);
  peg(s2);
  const e2 = add(s2, "fireBomber", { s: L - 4.6 });
  run(s2, 1);
  kill(s2, e2);
  run(s2, 3);
  return R(st === "arming" && hp1 === 16 && s2.nest.hp === 20, `${st} · 다 타면 둥지 ${hp1} · 처치하면 ${s2.nest.hp}`);
});
test("W4 철갑 화염 멧돼지: 보호막 있을 때 돌진 · 깨지면 돌진 못 하고 느려짐", () => {
  const sim = arena(4);
  peg(sim);
  const e = add(sim, "fireBoar", { s: 3 });
  let maxV = 0;
  run(sim, 5, () => (maxV = Math.max(maxV, e.v)));
  e.shield = 0;
  let maxV2 = 0;
  run(sim, 8, () => (maxV2 = Math.max(maxV2, e.v)));
  return R(maxV > e.speedBase * 2 && maxV2 <= e.speedBase * 0.76, `보호막 있을 때 최고 ${maxV.toFixed(2)} · 깨진 뒤 ${maxV2.toFixed(2)}`);
});
test("W4 재의 주술사: 둘레 친구 분노 (빨라지고 둥지를 1 더 침 · 겹치지 않음)", () => {
  const sim = arena(4);
  peg(sim);
  const sh = add(sim, "ashShaman", { s: 5, lane: 0 });
  const f = add(sim, "slime", { s: 5.2, lane: 0 });
  sh.speedBase = 0;
  f.speedBase = 0;
  run(sim, 4.1);
  return R(f.st.rage && f.st.rage.speed === 1.25 && f.st.rage.leakAdd === 1, `분노 ${JSON.stringify(f.st.rage)}`);
});
test("W5 그림자 기사: 앞에서 온 공격은 60% 막고 뒤에서 온 공격은 그대로 (실제 방향)", () => {
  const sim = arena(5);
  peg(sim);
  const e = add(sim, "shadowKnight", { s: 8, lane: 0 });
  const front = damage(sim, e, 100, { type: "shock", sx: e.x + e.dx * 3, sz: e.z + e.dz * 3, noCrit: true });
  const back = damage(sim, e, 100, { type: "shock", sx: e.x - e.dx * 3, sz: e.z - e.dz * 3, noCrit: true });
  const side = damage(sim, e, 100, { type: "shock", sx: e.x - e.dz * 3, sz: e.z + e.dx * 3, noCrit: true });
  return R(Math.abs(front - 40) < 1e-6 && back === 100 && side === 100, `앞 ${front} · 뒤 ${back} · 옆 ${side}`);
});
test("W5 환영 까마귀: 분신(한 방에 사라짐 · 보상 0 · 둥지 피해 0) · 살아 있는 분신 2 · 3번까지", () => {
  const sim = arena(5);
  peg(sim);
  const e = add(sim, "illusionCrow", { s: 3 });
  e.speedBase = 0;
  let maxAlive = 0;
  run(sim, 30, () => {
    maxAlive = Math.max(maxAlive, sim.enemies.filter((o) => o.illusion).length);
    if (sim.t > 7) for (const o of sim.enemies) if (o.illusion && o.age > 3) damage(sim, o, 5);
  });
  const c0 = sim.coins;
  const cl = add(sim, "crowClone", { s: 5, gen: 1 });
  damage(sim, cl, 1);
  return R(maxAlive <= 2 && maxAlive > 0 && e.ab.clones.n <= 3 && cl.dead && sim.coins === c0, `동시에 ${maxAlive} · ${e.ab.clones.n}번 · 분신 보상 ${sim.coins - c0}`);
});
test("W5 영혼 수확자: 둘레 친구가 쓰러지면 강해짐 (최대 3겹)", () => {
  const sim = arena(5);
  peg(sim);
  const r = add(sim, "soulReaper", { s: 5, lane: 0 });
  r.speedBase = 0;
  for (let i = 0; i < 6; i++) kill(sim, add(sim, "slime", { s: 5.3, lane: 0 }));
  run(sim, 0.1);
  return R(r.ab.soulFeed.stacks === 3 && effArmor(r) >= 0.3 - 1e-9, `겹 ${r.ab.soulFeed.stacks} · 갑옷 ${effArmor(r).toFixed(2)}`);
});
test("W5 암흑 소환사: 지난 월드 몬스터만 · 최대 4번", () => {
  const sim = arena(5);
  peg(sim);
  const e = add(sim, "darkSummoner", { s: 4 });
  e.speedBase = 0;
  const seen = new Set();
  run(sim, 40, () => {
    for (const o of sim.enemies) if (o.parent === e.id) seen.add(o.type);
  });
  const pool = ENEMIES.darkSummoner.ab.summonPast.pool;
  return R(e.ab.summonPast.n === 4 && [...seen].every((t) => pool.includes(t)), `${e.ab.summonPast.n}번 · ${[...seen]}`);
});
test("W5 저주술사: 둘레 타워 공격력 0.65배 (화면 수치에도 반영)", () => {
  const sim = arena(5);
  peg(sim);
  const e = add(sim, "curseCaster", { s: 6, lane: 0 });
  e.speedBase = 0;
  const t = towerBeside(sim, e);
  const d0 = statsOf(sim, t).dmg;
  run(sim, 2.1);
  const d1 = statsOf(sim, t).dmg;
  return R(Math.abs(d1 / d0 - 0.65) < 1e-9, `${d0} → ${d1.toFixed(2)}`);
});
test("W5 공허 포식자: 체력이 줄면 떨다가 폭주 (빨라짐 · 갑옷 0 · 둥지 두 배)", () => {
  const sim = arena(5);
  peg(sim);
  const L = sim.map.paths[0].length;
  const e = add(sim, "voidEater", { s: L - 6 });
  e.hp = e.maxHp * 0.39;
  run(sim, 0.2);
  const warn = e.state;
  run(sim, 1);
  const v = e.v;
  const arm = effArmor(e);
  run(sim, 6);
  return R(warn === "frenzyWarn" && v > e.speedBase * 1.8 && arm === 0 && sim.nest.hp === 16, `${warn} → 속도 ${v.toFixed(2)} · 갑옷 ${arm} · 둥지 ${sim.nest.hp}`);
});
test("W1 · W3 나머지: 분열체(위) · 깃털(위) · 늑대 · 박쥐 — 월드마다 특화 적 6종이 모두 능력 또는 뚜렷한 특성을 가짐", () => {
  const bad = [];
  for (let w = 1; w <= 5; w++) {
    const list = specialsOf(w);
    if (list.length < 6) bad.push(`${w}월드 ${list.length}종`);
    for (const k of list) {
      const d = ENEMIES[k];
      if (!d.ab && !d.resist && !d.flying && !(d.armor > 0.4)) bad.push(k);
    }
  }
  return R(!bad.length, bad.length ? bad.join(", ") : "5월드 × 6종 = 30종");
});

/* ======================= 환경 기믹 ======================= */
test("환경: 빙판 위 적 +25% · 그림자 구역 적은 가까운 타워만 봄 · 포자 꽃밭 회복 · 용암 분출 타워 과열", () => {
  const s3 = arena(3);
  peg(s3);
  const g3 = s3.world.gimmick.spots[0];
  const sp = s3.map.paths[0].nearest(g3.x, g3.z).s;
  const e = add(s3, "slime", { s: sp, lane: 0 });
  s3.step(DT);
  const fast = e.v / e.speedBase;
  const s5 = arena(5);
  peg(s5);
  const g5 = s5.world.gimmick.spots[0];
  const e5 = add(s5, "slime", { s: s5.map.paths[0].nearest(g5.x, g5.z).s, lane: 0 });
  e5.speedBase = 0;
  s5.step(DT);
  // 사거리 안이지만 2.2칸 밖 타워
  let far = null;
  let near = null;
  for (let z = 0; z < 14; z++)
    for (let x = 0; x < 22; x++) {
      if (!s5.map.buildable(x, z)) continue;
      const d = Math.hypot(x + 0.5 - e5.x, z + 0.5 - e5.z);
      if (d > 2.5 && d < 3.1 && !far) far = [x, z];
      if (d < 2.0 && !near) near = [x, z];
    }
  const tf = s5.place("archer", far[0], far[1]);
  const tn = s5.place("archer", near[0], near[1]);
  const seeFar = findTarget(s5, tf, statsOf(s5, tf));
  const seeNear = findTarget(s5, tn, statsOf(s5, tn));
  const s2 = arena(2);
  peg(s2);
  const sb = s2.world.gimmick.spots[0];
  const e2 = add(s2, "beetle", { s: s2.map.paths[0].nearest(sb.x, sb.z).s, lane: 0 });
  e2.speedBase = 0;
  e2.hp = e2.maxHp * 0.5;
  run(s2, 20);
  const healed = e2.hp > e2.maxHp * 0.5;
  const s4 = arena(4);
  peg(s4);
  const v = s4.world.gimmick.vents[0];
  let vc = null;
  for (let z = 0; z < 14 && !vc; z++) for (let x = 0; x < 22 && !vc; x++) if (s4.map.buildable(x, z) && Math.hypot(x + 0.5 - v.x, z + 0.5 - v.z) < v.r) vc = [x, z];
  const t4 = s4.place("archer", vc[0], vc[1]);
  let heat = false;
  run(s4, 16, () => {
    if (t4.deb.heat) heat = true;
  });
  return R(Math.abs(fast - 1.25) < 1e-9 && !seeFar && seeNear === e5 && healed && heat, `빙판 ×${fast} · 그림자 먼 타워 ${seeFar ? "봄" : "못 봄"} · 가까운 ${seeNear ? "봄" : "못 봄"} · 포자 회복 ${healed} · 과열 ${heat}`);
});

/* ======================= 보스 ======================= */
const BOSS_EXPECT = {
  crownSlime: ["phase", "towerStun", "boom", "crown"],
  ironBoarChief: ["phase", "towerStun", "state"],
  sporeQueen: ["phase", "zone", "summon"],
  mushroomColossus: ["phase", "towerStun", "shieldUp", "shieldBreak"],
  glacierGuardian: ["phase", "towerStun", "shieldBreak", "shieldUp"],
  blizzardQueen: ["phase", "blizzard", "spear"],
  magmaColossus: ["phase", "towerStun", "zone", "state"],
  ignis: ["phase", "towerStun", "zone"],
  darkLord: ["phase", "state", "zone"],
  ravenKing: ["phase", "clones", "nestStrike", "interrupt", "finalPhase", "shadowStorm", "finalDefeat"],
};
for (const [type, need] of Object.entries(BOSS_EXPECT)) {
  test(`보스 ${BOSSES[type].name}: 패턴 · 페이즈 전환 · 미리 표시 후 효과 (${need.join(", ")})`, () => {
    const sim = arena(BOSSES[type].world);
    peg(sim);
    const e = add(sim, type, { s: 2, awakened: true });
    e.speedBase *= 0.25;
    // 둘레에 타워 몇 개 (보스가 노릴 대상)
    for (const d of [3, 5, 7, 9]) {
      const c = cellNear(sim, d);
      if (c) {
        const t = sim.place("archer", c[0], c[1]);
        t.cd = 1e9;
      }
    }
    const seen = new Set();
    let telegraphed = 0;
    let preStunMarkers = true;
    let strikeTried = 0;
    let strikes = 0;
    let lastState = "";
    run(sim, 150, (i) => {
      if (e.s > e.path.length * 0.6) e.s = 2;
      if (e.state === "strikeWarn" && lastState !== "strikeWarn") strikes++;
      lastState = e.state;
      for (const ev of sim.drainEvents()) {
        seen.add(ev.type);
        if (ev.type === "towerStun" && telegraphed === 0 && type !== "ironBoarChief" && type !== "ignis") preStunMarkers = false;
      }
      telegraphed += sim.markers.filter((m) => m.t === DT || (m.t > 0 && m.t <= DT + 1e-9)).length;
      // 천천히 체력을 깎아 페이즈를 모두 지나게 (마왕 둥지 공격은 한 번은 끊고 한 번은 그대로 둠)
      if (e.state === "strikeWarn") {
        strikeTried++;
        if (strikes === 1) damage(sim, e, e.maxHp * 0.01, { type: "shock", force: true, noCrit: true });
      } else if (i % 30 === 0 && e.hp > e.maxHp * 0.05) damage(sim, e, e.maxHp * 0.012, { type: "shock", force: true, noCrit: true });
      if (sim.t > 140 && !e.dead) kill(sim, e);
    });
    if (!e.dead) kill(sim, e);
    for (const ev of sim.drainEvents()) seen.add(ev.type);
    const miss = need.filter((n) => !seen.has(n));
    return R(!miss.length && e.b.phase >= 2 && preStunMarkers, miss.length ? `빠짐 ${miss.join(",")} · 페이즈 ${e.b.phase}` : `페이즈 ${e.b.phase} · 미리 표시 ${telegraphed}개`);
  });
}

/* ======================= 무한 생존 · 오래 하기 ======================= */
test("무한 생존 웨이브 1~300: 비지 않음 · 마리 수 상한 · 체력 배율 상한 · 10마다 보스 · 숫자 이상 없음", () => {
  let bad = [];
  let maxCount = 0;
  let maxHp = 0;
  for (let n = 1; n <= 300; n++) {
    const w = endlessWave(n, 2);
    const total = w.groups.reduce((a, g) => a + g.count, 0);
    maxCount = Math.max(maxCount, total);
    maxHp = Math.max(maxHp, w.scale.hp);
    if (!w.groups.length || total <= 0 || !Number.isFinite(w.scale.hp) || w.scale.hp <= 0) bad.push(n);
    for (const g of w.groups) if (!(ENEMIES[g.type] || BOSSES[g.type])) bad.push(`${n}:${g.type}`);
    if (n % 10 === 0 && !w.groups.some((g) => g.boss)) bad.push(`${n} 보스 없음`);
  }
  return R(!bad.length && maxHp <= ENDLESS_MAX_HP && maxCount <= 80, `최대 마리 ${maxCount} · 최대 체력 배율 ${maxHp.toFixed(1)}${bad.length ? " · 문제 " + bad.slice(0, 5) : ""}`);
});
test("23 오래 하기: 무한 생존 40 웨이브 자동 플레이 — 구역 · 투사체 · 표시 · 적 목록이 늘어나기만 하지 않음 · NaN 없음", () => {
  let maxZ = 0;
  let maxP = 0;
  let maxM = 0;
  let maxE = 0;
  let nan = false;
  const r = playWorld(1, {
    level: "good",
    mode: "endless",
    maxWaves: 40,
    seed: 4,
    onWave(rec, sim) {
      maxZ = Math.max(maxZ, sim.zones.length);
      maxP = Math.max(maxP, sim.projs.length);
      maxM = Math.max(maxM, sim.markers.length);
      maxE = Math.max(maxE, sim.enemies.length);
      if (!Number.isFinite(sim.coins) || sim.enemies.some((e) => !Number.isFinite(e.hp))) nan = true;
    },
  });
  const sim = r.sim;
  return R(!nan && sim.byIdMap.size <= sim.enemies.length + 5 && maxZ <= 40 && maxP <= 400 && r.log.length >= 15, `${r.log.length} 웨이브 (${r.won ? "40 생존" : "패배"}) · 웨이브 끝 구역 ${maxZ} 투사체 ${maxP} 표시 ${maxM} 적 ${maxE} · id 표 ${sim.byIdMap.size}`);
});

const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} PASS`);
process.exit(pass === results.length ? 0 : 1);
