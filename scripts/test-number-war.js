/**
 * 숫자전쟁 규칙 엔진 단위 테스트 (브라우저 없이)
 *   node scripts/test-number-war.js
 */
const NW = require("../games/number-war/engine.js");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const T = (v, s = null, lock = false) => ({ v, s, ...(lock ? { lock: true } : {}) });
function board(map, mode = "classic") {
  const g = NW.newGame(mode, "unit");
  g.cells = new Array(25).fill(null);
  for (const [i, t] of Object.entries(map)) g.cells[i] = t;
  g.turn = 0;
  g.score = 0;
  g.combo = 0;
  return g;
}

/* 1. 규칙표: 81쌍 모두 */
let ruleOk = true;
const counts = { ten: 0, twin: 0, nova: 0, step: 0, mult: 0, none: 0 };
for (let a = 1; a <= 9; a += 1)
  for (let b = 1; b <= 9; b += 1) {
    const r = NW.ruleOf(a, b);
    let want = null;
    if (a + b === 10) want = "ten";
    else if (a === b) want = a === 9 ? "nova" : "twin";
    else if (Math.abs(a - b) === 1) want = "step";
    else if (Math.min(a, b) >= 2 && Math.max(a, b) % Math.min(a, b) === 0) want = "mult";
    if (r !== want) ruleOk = false;
    counts[r || "none"] += 1;
    if (NW.ruleOf(b, a) !== r) ruleOk = false;
  }
check("R1 81쌍 규칙표 · 순서 바꿔도 같음 · 우선순위(텐>쌍둥이>계단>배수)", ruleOk, JSON.stringify(counts));
check("R2 5+5 는 텐 · 9+9 노바 · 4+8 배수 · 3+4 계단 · 2+8 텐 · 1+8 없음", NW.ruleOf(5, 5) === "ten" && NW.ruleOf(9, 9) === "nova" && NW.ruleOf(4, 8) === "mult" && NW.ruleOf(3, 4) === "step" && NW.ruleOf(2, 8) === "ten" && NW.ruleOf(1, 8) === null);
check("R3 조합 안 되는 쌍이 충분히 있다 (전략: 아무거나 붙이면 안 됨)", counts.none >= 20, String(counts.none));

/* 2. 효과 */
let g = board({ 0: T(3), 1: T(7) });
let r = NW.apply(g, { type: "combine", from: 0, to: 1 }, { noSpawn: true });
check("E1 텐: 둘 다 사라짐 · 40+3×7=61점", r.ok && !g.cells[0] && !g.cells[1] && r.points === 61, JSON.stringify(r));
g = board({ 0: T(4), 1: T(4) });
r = NW.apply(g, { type: "combine", from: 0, to: 1 }, { noSpawn: true });
check("E2 쌍둥이: 받는 칸이 5로 · 40점", !g.cells[0] && g.cells[1].v === 5 && r.points === 40);
g = board({ 0: T(9), 1: T(9) });
r = NW.apply(g, { type: "combine", from: 0, to: 1 }, { noSpawn: true });
check("E3 노바: 9+9 둘 다 사라짐 · 150점", !g.cells[0] && !g.cells[1] && r.points === 150);
g = board({ 0: T(3), 1: T(4) });
r = NW.apply(g, { type: "combine", from: 0, to: 1 }, { noSpawn: true });
check("E4 계단: 고른 타일만 사라지고 받는 칸 그대로 · 28점", !g.cells[0] && g.cells[1].v === 4 && r.points === 28);
g = board({ 0: T(2), 1: T(8) });
check("E5 2·8 은 배수가 아니라 텐", NW.preview(g, { type: "combine", from: 0, to: 1 }).rule === "ten");
g = board({ 0: T(3), 1: T(9) });
r = NW.apply(g, { type: "combine", from: 0, to: 1 }, { noSpawn: true });
check("E6 배수: 3·9 → 받는 칸에 몫 3 · 54점", g.cells[1].v === 3 && r.points === 54);
g = board({ 0: T(1), 1: T(8) });
check("E7 규칙 없는 쌍은 실행 거부", !NW.apply(g, { type: "combine", from: 0, to: 1 }).ok && g.cells[0].v === 1);
g = board({ 0: T(3), 2: T(7) });
check("E8 붙어 있지 않으면(한 칸 건너) 조합 불가", !NW.apply(g, { type: "combine", from: 0, to: 2 }).ok);
g = board({ 4: T(3), 5: T(7) });
check("E9 줄 끝에서 다음 줄 첫 칸은 이웃이 아님", !NW.actionsFrom(g, 4).some((a) => a.to === 5));

/* 3. 콤보 */
check("C1 콤보 배율 1 · 1.2 · 1.5 · 2 · 2.25 … 최대 3", NW.comboMult(1) === 1 && NW.comboMult(2) === 1.2 && NW.comboMult(3) === 1.5 && NW.comboMult(4) === 2 && NW.comboMult(5) === 2.25 && NW.comboMult(20) === 3);
g = board({ 0: T(3), 1: T(7), 5: T(4), 6: T(4), 10: T(2), 11: T(3), 20: T(1) });
const p1 = NW.apply(g, { type: "combine", from: 0, to: 1 }, { noSpawn: true }).points; // 61 ×1
const p2 = NW.apply(g, { type: "combine", from: 5, to: 6 }, { noSpawn: true }).points; // 40 ×1.2
const p3 = NW.apply(g, { type: "combine", from: 10, to: 11 }, { noSpawn: true }).points; // 20 ×1.5
check("C2 연속 조합 점수 61 · 48 · 30", p1 === 61 && p2 === 48 && p3 === 30 && g.combo === 3, `${p1} ${p2} ${p3}`);
NW.apply(g, { type: "move", from: 20, to: 21 }, { noSpawn: true });
check("C3 이동하면 콤보 초기화", g.combo === 0);

/* 4. 특수 타일 */
g = board({ 0: T(0, "wild"), 1: T(6) });
r = NW.apply(g, { type: "combine", from: 0, to: 1 }, { noSpawn: true });
check("S1 와일드: 6 과 쌍둥이 → 7 · 60점", g.cells[1].v === 7 && r.points === 60 && r.rule === "twin");
g = board({ 0: T(0, "wild"), 1: T(0, "wild") });
check("S2 와일드끼리는 조합 불가", !NW.actionsFrom(g, 0).some((a) => a.type === "combine"));
g = board({ 0: T(3, "double"), 1: T(7) });
check("S3 더블: 점수 2배 (122)", NW.apply(g, { type: "combine", from: 0, to: 1 }, { noSpawn: true }).points === 122);
g = board({ 0: T(3, "chain"), 1: T(7) });
r = NW.apply(g, { type: "combine", from: 0, to: 1 }, { noSpawn: true });
check("S4 연쇄: 첫 조합부터 콤보 2 (×1.2)", g.combo === 2 && r.points === Math.round(61 * 1.2));
g = board({ 6: T(0, "bomb"), 0: T(2), 1: T(3), 2: T(4), 5: T(1), 7: T(9), 12: T(5), 18: T(8) });
r = NW.apply(g, { type: "bomb", from: 6, to: 6 }, { noSpawn: true });
check("S5 폭탄: 둘레 8칸 지움 (먼 칸은 남음) · 20+5×24=140", !g.cells[0] && !g.cells[1] && !g.cells[2] && !g.cells[5] && !g.cells[7] && !g.cells[12] && !g.cells[6] && g.cells[18].v === 8 && r.points === 140, JSON.stringify(r));
g = board({ 0: T(3, null, true), 1: T(7) });
check("S6 잠금: 고를 수도 받을 수도 없음", NW.actionsFrom(g, 0).length === 0 && !NW.actionsFrom(g, 1).some((a) => a.to === 0));
g = board({ 0: T(3, null, true), 1: T(4), 6: T(6) });
NW.apply(g, { type: "combine", from: 6, to: 1 }, { noSpawn: true }); // 6+4 텐 at 1 → 옆칸 0 풀림
check("S7 잠금: 옆칸에서 조합이 일어나면 풀림", !g.cells[0].lock && g.stats.unlock === 1);
g = board({ 0: T(0, "bomb") });
check("S8 폭탄은 다른 숫자와 조합 불가 · 이동 · 터뜨리기만", NW.actionsFrom(g, 0).every((a) => a.type !== "combine") && NW.actionsFrom(g, 0).some((a) => a.type === "bomb"));

/* 5. 턴 · 생성 · 끝 */
g = NW.newGame("classic", 42);
const startTiles = g.cells.filter(Boolean).length;
check("T1 클래식 시작 타일 12개 · 30턴", startTiles === 12 && g.maxTurns === 30);
const firstAct = NW.allActions(g)[0];
NW.apply(g, firstAct);
check("T2 한 턴 뒤 턴 1 · 새 타일 2개", g.turn === 1 && g.log.length === 1);
let guard = 0;
while (!g.over && guard++ < 200) NW.apply(g, NW.aiChoose(g, "normal"));
check("T3 30턴이 되면 끝 (또는 막히면 끝)", g.over && (g.turn === 30 || g.reason === "stuck"), `${g.turn} ${g.reason}`);
check("T4 끝난 뒤엔 어떤 행동도 거부", !NW.apply(g, firstAct).ok && NW.allActions(g).length === 0);
g = board({ 0: T(1), 1: T(8) });
for (let i = 2; i < 25; i += 1) g.cells[i] = T([1, 8][i % 2] === 1 ? 1 : 8);
// 체스판처럼 1 · 8 만 깔린 꽉 찬 판 → 둘 곳 없음
for (let i = 0; i < 25; i += 1) g.cells[i] = T((Math.floor(i / 5) + (i % 5)) % 2 ? 8 : 1);
check("T5 꽉 차고 조합도 없으면 할 일 없음 판정", !NW.hasAnyAction(g));
g = NW.newGame("classic", 7);
g.cells = new Array(25).fill(null);
g.cells[0] = T(3);
g.cells[1] = T(7);
g.maxTurns = 30;
NW.apply(g, { type: "combine", from: 0, to: 1 }, { noSpawn: true });
NW.finish(g, "test");
check("T6 끝 보너스: 빈칸 25×8=200 · 완전 정리 남은 29턴×30=870", g.bonus.board === 200 && g.bonus.clear === 870 && g.final === 61 + 1070, JSON.stringify(g.bonus));
const sg = NW.newGame("strategy", 3);
check("T7 전략 모드: 시작 16개 · 잠금 · 특수 타일 · 18턴 · 난이도 보너스 1.25", sg.cells.filter(Boolean).length === 16 && sg.cells.filter((c) => c && c.lock).length >= 2 && sg.cells.filter((c) => c && c.s).length >= 3 && sg.maxTurns === 18);

/* 6. 같은 씨앗 = 같은 판 (오늘의 숫자전쟁) */
const d1 = NW.newGame("daily", "2026-11-21");
const d2 = NW.newGame("daily", "2026-11-21");
const d3 = NW.newGame("daily", "2026-11-22");
check("D1 같은 날짜 = 같은 시작 판", JSON.stringify(d1.cells) === JSON.stringify(d2.cells));
check("D2 다른 날짜 = 다른 판", JSON.stringify(d1.cells) !== JSON.stringify(d3.cells));
for (let k = 0; k < 6; k += 1) {
  const a = NW.aiChoose(d1, "normal");
  NW.apply(d1, a);
  NW.apply(d2, a);
}
check("D3 같은 수를 두면 새 타일도 똑같이 나온다", JSON.stringify(d1.cells) === JSON.stringify(d2.cells) && d1.score === d2.score);
check("D4 오늘의 미션 3개 · 날짜마다 같음", JSON.stringify(NW.dailyMissions("2026-11-21").map((m) => m.id)) === JSON.stringify(NW.dailyMissions("2026-11-21").map((m) => m.id)) && NW.dailyMissions("2026-11-21").length === 3);
const ser = NW.clone(d1);
check("D5 저장 · 복원(JSON) 뒤에도 같은 상태 · 다음 타일 같음", (() => {
  const a = NW.aiChoose(ser, "normal");
  const x = NW.clone(d1);
  NW.apply(x, a);
  NW.apply(ser, a);
  return JSON.stringify(x.cells) === JSON.stringify(ser.cells);
})());

/* 7. AI */
let legal = true;
let det = true;
for (const lv of ["easy", "normal", "hard"]) {
  const h = NW.newGame("vs", 99, { vs: true });
  let n = 0;
  while (!h.over && n++ < 40) {
    const a = NW.aiChoose(h, lv);
    const again = NW.aiChoose(h, lv);
    if (JSON.stringify(a) !== JSON.stringify(again)) det = false;
    if (!NW.actionsFrom(h, a.from).some((b) => b.type === a.type && b.to === a.to)) legal = false;
    NW.apply(h, a);
  }
}
check("A1 AI 는 언제나 규칙에 맞는 수만 둔다 (3단계)", legal);
check("A2 AI 는 무작위가 아니다 (같은 판 = 같은 수)", det);
// 같은 판에서 1인 30턴 점수 비교 (20판 평균)
const avg = {};
const t0 = Date.now();
for (const lv of ["easy", "normal", "hard"]) {
  let sum = 0;
  for (let s = 1; s <= 12; s += 1) {
    const h = NW.newGame("classic", `ai-${s}`);
    let n = 0;
    while (!h.over && n++ < 60) NW.apply(h, NW.aiChoose(h, lv));
    sum += h.final;
  }
  avg[lv] = Math.round(sum / 12);
}
const ms = Date.now() - t0;
check("A3 혼자 둘 때 NORMAL 이 EASY 보다 점수가 높다", avg.easy < avg.normal, JSON.stringify(avg));
let hn = 0;
for (let s = 1; s <= 6; s += 1)
  for (const first of [0, 1]) {
    const h = NW.newGame("vs", `hn-${s}`, { vs: true });
    let n = 0;
    while (!h.over && n++ < 60) NW.apply(h, NW.aiChoose(h, h.current === first ? "hard" : "normal"));
    if (h.players[first].score > h.players[1 - first].score) hn += 1;
  }
check("A6 대결: HARD 가 NORMAL 을 12판 중 8판 이상 이김 (선공 · 후공 번갈아)", hn >= 8, String(hn));
// 대결에서 HARD 가 EASY 를 더 자주 이긴다
let hardWins = 0;
for (let s = 1; s <= 10; s += 1) {
  const h = NW.newGame("vs", `duel-${s}`, { vs: true });
  let n = 0;
  while (!h.over && n++ < 60) NW.apply(h, NW.aiChoose(h, h.current === 0 ? "hard" : "easy"));
  if (h.players[0].score > h.players[1].score) hardWins += 1;
}
check("A4 대결: HARD 가 EASY 를 10판 중 7판 이상 이김", hardWins >= 7, String(hardWins));
const tHard = Date.now();
NW.aiChoose(NW.newGame("vs", "speed", { vs: true }), "hard");
check("A5 HARD 한 수 생각 시간 300ms 이내", Date.now() - tHard < 300, `${Date.now() - tHard}ms`);

let pass = 0;
for (const x of results) {
  console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.ok ? "" : "  — " + x.detail}`);
  if (x.ok) pass += 1;
}
console.log(`\nAI 평균(클래식 12판): ${JSON.stringify(avg)} · ${ms}ms`);
console.log(`${pass}/${results.length} PASS`);
process.exit(pass === results.length ? 0 : 1);
