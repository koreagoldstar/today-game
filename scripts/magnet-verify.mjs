/**
 * 자석 대소동 · 스테이지 풀이 검증 (Node · 브라우저 없이)
 *  node scripts/magnet-verify.mjs        → 모든 스테이지 + 오늘의 실험
 *  node scripts/magnet-verify.mjs 3 -v   → 3번만 · 0.25초마다 위치 출력
 *  검증: 적어 둔 풀이를 게임과 같은 규칙으로 두어 → 깸 · 별 3개 · 떨어짐 0 · 물리 이상(NaN) 0
 */
import { STAGES, DAILY } from "../games/magnet-mayhem/js/levels.js?v=1";
import { createGame, starsOf } from "../games/magnet-mayhem/js/sim.js?v=1";
import { runBot } from "./magnet-bot.mjs";
import { SOLUTIONS, DAILY_SOLUTIONS } from "./magnet-solutions.mjs";

const only = process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : null;
const verbose = process.argv.includes("-v");
const list = [...STAGES.map((d) => ({ def: d, sol: SOLUTIONS[d.id], key: String(d.id) })), ...DAILY.map((d, i) => ({ def: d, sol: (DAILY_SOLUTIONS || {})[d.id], key: `D${i + 1}` }))].filter((x) => !only || x.key === only);
let bad = 0;
for (const { def, sol, key } of list) {
  const G = createGame(def);
  let last = -1;
  const r = sol
    ? runBot(G, sol, {
        maxT: 120,
        onFrame: verbose
          ? (G) => {
              const s = Math.floor(G.t * 4);
              if (s === last) return;
              last = s;
              const objs = G.objs.map((b) => `${b.id}:${b.x.toFixed(0)},${b.y.toFixed(0)}${G.held.has(b.id) ? "*" : ""}`).join(" ");
              console.log(`  t${G.t.toFixed(2)} R ${G.robot.x.toFixed(0)},${G.robot.y.toFixed(0)}${G.robot.ground ? "" : "~"} mag ${G.mag.on ? G.mag.pole : "-"} ${objs} ${Object.entries(G.sense).filter(([, v]) => v).map(([k]) => k).join(",")}${G.energy != null ? " E" + G.energy.toFixed(0) : ""}`);
            }
          : null,
      })
    : { won: false, log: ["풀이 없음"] };
  const st = r.won ? starsOf(G) : { n: 0, got: [] };
  const ok = r.won && st.n === 3 && r.falls === 0 && G.world.fixes === 0;
  if (!ok) bad++;
  console.log(`${ok ? "OK " : "XX "} ${key.padStart(3)} ${def.name.padEnd(12)} ${r.won ? `깸 ${G.winT.toFixed(1)}초 (★2 ${def.stars.time}초)` : "못 깸"} · 별 ${st.n} [${st.got.map((g) => (g ? "★" : "☆")).join("")}] · 기어 ${G.gearGot} · 자석 ${G.uses}번 · 극 ${G.poleSwitches}번${G.energy != null ? ` · 에너지 ${G.energy.toFixed(0)}` : ""}${r.falls ? ` · 떨어짐 ${r.falls}` : ""}${r.log.length ? " · " + r.log.join(" / ") : ""}`);
}
console.log(bad ? `\n문제 ${bad}개` : `\n모두 통과 (${list.length}개)`);
process.exit(bad ? 1 : 0);
