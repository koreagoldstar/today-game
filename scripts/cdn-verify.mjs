/**
 * NEW 둥지디펜스 · 데이터 검증 + 자동 플레이 (Node)
 *  node scripts/cdn-verify.mjs          → 150 웨이브 · 월드 콘텐츠 · 타워/카드 참조 검사 + 로봇이 5개 월드를 끝까지
 *  node scripts/cdn-verify.mjs --fast   → 데이터만
 */
import { WORLDS } from "../games/chick-defense-new/js/data/worlds.js";
import { ENEMIES, BOSSES, specialsOf, bossesOf } from "../games/chick-defense-new/js/data/enemies.js";
import { TOWERS, TOWER_ORDER } from "../games/chick-defense-new/js/data/towers.js";
import { CARDS } from "../games/chick-defense-new/js/data/cards.js";
import { WORLD_WAVES, campaignWave, WAVES_PER_WORLD } from "../games/chick-defense-new/js/data/waves.js";
import { GameMap } from "../games/chick-defense-new/js/sim/map.js";
import { playWorld } from "./cdn-bot.mjs";

const fast = process.argv.includes("--fast");
const problems = [];
const P = (s) => problems.push(s);
const pos = (v) => Number.isFinite(v) && v > 0;

/* ---------- 월드 · 지도 ---------- */
for (const w of WORLDS) {
  const map = new GameMap(w);
  let open = 0;
  for (let z = 0; z < map.d; z++) for (let x = 0; x < map.w; x++) if (map.buildable(x, z)) open++;
  if (open < 60) P(`${w.name}: 설치 칸 ${open}`);
  for (const p of map.paths) {
    const end = p.at(p.length);
    if (Math.hypot(end.x - w.nest.x, end.z - w.nest.z) > 0.01) P(`${w.name}: 길 끝이 둥지가 아님`);
    if (p.length < 30) P(`${w.name}: 길이 너무 짧음 ${p.length}`);
  }
  if (!w.theme || !w.music) P(`${w.name}: 색 · 음악 없음`);
}

/* ---------- 150 웨이브 ---------- */
let total = 0;
const usedByWorld = {};
for (const w of WORLDS) {
  const rows = WORLD_WAVES[w.id];
  if (!rows || rows.length !== WAVES_PER_WORLD) P(`${w.name}: 웨이브 ${rows && rows.length}`);
  const used = (usedByWorld[w.id] = new Set());
  let prevSig = "";
  for (let i = 1; i <= WAVES_PER_WORLD; i++) {
    let wave;
    try {
      wave = campaignWave(w.id, i);
    } catch (e) {
      P(`${w.id}-${i}: ${e.message}`);
      continue;
    }
    total++;
    if (!wave.groups.length) P(`${w.id}-${i}: 빈 웨이브`);
    const sc = wave.scale;
    for (const k of ["hp", "bossHp", "reward", "clear"]) if (!pos(sc[k]) || sc[k] > 1e5) P(`${w.id}-${i}: 배율 ${k}=${sc[k]}`);
    let count = 0;
    for (const g of wave.groups) {
      const d = g.boss ? BOSSES[g.type] : ENEMIES[g.type];
      if (!d) P(`${w.id}-${i}: 없는 적 ${g.type}`);
      else {
        if (g.boss && !BOSSES[g.type]) P(`${w.id}-${i}: 보스가 아님 ${g.type}`);
        if (!g.boss && BOSSES[g.type]) P(`${w.id}-${i}: 보스를 B: 없이 ${g.type}`);
        if (d.minion) P(`${w.id}-${i}: 꼬마(${g.type})를 직접 출현`);
        if (!pos(d.hp) || !pos(d.speed) || d.reward < 0) P(`${g.type}: 수치 이상`);
        used.add(g.type);
      }
      if (!(g.count >= 1) || g.count > 60) P(`${w.id}-${i}: 마리 수 ${g.count}`);
      if (g.count > 1 && !pos(g.interval)) P(`${w.id}-${i}: 간격 ${g.interval}`);
      if (!(g.delay >= 0) || g.delay > 60) P(`${w.id}-${i}: 시작 ${g.delay}`);
      if (g.path !== "x" && !(g.path >= 0 && g.path < w.paths.length)) P(`${w.id}-${i}: 길 번호 ${g.path}`);
      count += g.count;
    }
    if (count > 120) P(`${w.id}-${i}: 한 웨이브 ${count} 마리`);
    if (i % 10 === 0 && w.id !== 0 && !wave.boss && i === 30) P(`${w.id}-30: 마지막 웨이브에 보스 없음`);
    const sig = wave.groups.map((g) => g.type + g.count).join();
    if (sig === prevSig) P(`${w.id}-${i}: 바로 앞 웨이브와 똑같음`);
    prevSig = sig;
  }
}
// 무한 소환 가능성: 소환 · 분열 능력은 모두 횟수 · 세대 상한이 있어야 함
for (const [k, d] of Object.entries(ENEMIES)) {
  const ab = d.ab || {};
  if (ab.split && !(ab.split.maxGen >= 1)) P(`${k}: 분열 세대 상한 없음`);
  if (ab.summon && !(ab.summon.max >= 1)) P(`${k}: 소환 횟수 상한 없음`);
  if (ab.summonPast && !(ab.summonPast.max >= 1)) P(`${k}: 소환 횟수 상한 없음`);
  if (ab.clones && !(ab.clones.casts >= 1 && ab.clones.maxAlive >= 1)) P(`${k}: 분신 상한 없음`);
  if (ab.heal && !(ab.heal.maxTotal > 0 && ab.heal.pct <= 0.2)) P(`${k}: 치료 상한`);
  if (ab.split && ENEMIES[ab.split.into] && ENEMIES[ab.split.into].ab && ENEMIES[ab.split.into].ab.split) P(`${k}: 분열이 또 분열`);
}

/* ---------- 월드 콘텐츠 ---------- */
const content = [];
for (const w of WORLDS) {
  const sp = specialsOf(w.id);
  const bs = bossesOf(w.id);
  const used = usedByWorld[w.id] || new Set();
  const unusedSp = sp.filter((k) => !used.has(k));
  const unusedBs = bs.filter((k) => !used.has(k));
  const last = campaignWave(w.id, 30);
  const finalBoss = last.groups.find((g) => g.boss);
  if (sp.length < 6) P(`${w.name}: 특화 적 ${sp.length}`);
  if (bs.length < 2) P(`${w.name}: 보스 ${bs.length}`);
  if (unusedSp.length) P(`${w.name}: 웨이브에 안 나오는 특화 적 ${unusedSp}`);
  if (unusedBs.length) P(`${w.name}: 웨이브에 안 나오는 보스 ${unusedBs}`);
  if (!finalBoss || !bs.includes(finalBoss.type)) P(`${w.name}: 30번이 이 월드 보스가 아님`);
  content.push(`${w.name} 특화 ${sp.length} · 보스 ${bs.length} (${bs.map((b) => BOSSES[b].name).join(", ")}) · 30번 ${finalBoss && BOSSES[finalBoss.type].name}`);
}

/* ---------- 타워 · 카드 ---------- */
if (TOWER_ORDER.length < 6) P(`타워 ${TOWER_ORDER.length}`);
for (const k of TOWER_ORDER) {
  const T = TOWERS[k];
  if (!T) {
    P(`없는 타워 ${k}`);
    continue;
  }
  if (T.levels.length < 3) P(`${k}: 강화 ${T.levels.length}단계`);
  for (const [i, L] of T.levels.entries()) if (i > 0 && !pos(L.cost)) P(`${k} L${i + 1}: 비용`);
  const evos = Object.entries(T.evos || {});
  if (evos.length !== 2) P(`${k}: 진화 ${evos.length}`);
  for (const [ek, E] of evos) {
    if (!pos(E.cost) || !E.levels.length) P(`${k}.${ek}: 진화 비용/단계`);
    for (const [i, L] of E.levels.entries()) if (i > 0 && !pos(L.cost)) P(`${k}.${ek} L${i + 1}: 비용`);
    if (!T.support && !(pos(E.levels[0].dmg) && pos(E.levels[0].rate) && pos(E.levels[0].range))) P(`${k}.${ek}: 수치`);
  }
}
for (const c of CARDS) if (!c.instant && !(c.max >= 1)) P(`카드 ${c.id}: 최대 중첩 없음`);

console.log("== 데이터 ==");
console.log(`웨이브 ${total} / 150`);
for (const c of content) console.log("  " + c);
console.log(`특화 적 ${WORLDS.reduce((a, w) => a + specialsOf(w.id).length, 0)} · 보스 ${Object.keys(BOSSES).length} · 타워 ${TOWER_ORDER.length} (진화 ${TOWER_ORDER.length * 2}) · 카드 ${CARDS.length}`);

/* ---------- 자동 플레이 ---------- */
let playBad = 0;
if (!fast) {
  console.log("\n== 자동 플레이 (보통 난이도) ==");
  for (const w of WORLDS) {
    const runs = [1, 2].map((seed) => playWorld(w.id, { level: "good", seed }));
    const lazy = playWorld(w.id, { level: "lazy", seed: 1 });
    const stuck = runs.find((r) => r.stuck) || (lazy.stuck ? lazy : null);
    const wins = runs.filter((r) => r.won).length;
    const evs = runs[0].evCount;
    const line = `${w.name}: 잘하는 로봇 ${runs.map((r) => (r.won ? `깸(둥지 ${r.sim.nest.hp})` : `짐@${r.log.length}`)).join(" ")} · 궁수만 3개 ${lazy.won ? "깸 (너무 쉬움)" : `짐@${lazy.log.length}`} · 보스 처치 ${evs.death ? "있음" : "없음"}`;
    console.log("  " + line);
    if (stuck) {
      P(`${w.name}: 끝나지 않는 웨이브 ${stuck.stuck}`);
      playBad++;
    }
    if (wins === 0) {
      P(`${w.name}: 잘하는 로봇도 못 깸`);
      playBad++;
    }
    if (lazy.won) {
      P(`${w.name}: 궁수만으로 깨짐`);
      playBad++;
    }
  }
}

console.log(problems.length ? `\n문제 ${problems.length}개\n - ` + problems.join("\n - ") : `\n모두 통과`);
process.exit(problems.length ? 1 : 0);
