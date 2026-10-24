// 말랑콩떡! 젤리 공장 · 규칙 엔진 단위 점검 (Node 만 · 브라우저 없이)
// 사용: node scripts/test-jelly-engine.mjs
import * as E from "../games/jelly-factory/js/engine.js";
let ok = 0;
let bad = 0;
const check = (n, c, info) => {
  c ? ok++ : bad++;
  console.log(`${c ? "PASS" : "FAIL"} ${n}${info !== undefined ? "  — " + JSON.stringify(info) : ""}`);
};
const at = (s, x, y) => y * s.board.w + x;
const xy = (s, i) => [i % s.board.w, Math.floor(i / s.board.w)];
const U = 0, R = 1, D = 2, L = 3;

// 1) 멈추는 자리 · 무효 이동
let s = E.create({ map: ["R....#.", ".......", "...Y..."] });
let sl = E.slide(s, at(s, 0, 0), R);
check("벽 앞에서 멈춤", sl.valid && sl.end === at(s, 4, 0), xy(s, sl.end));
check("못 가면 무효 (끝에 붙음)", !E.slide(s, at(s, 0, 0), L).valid);
s = E.create({ map: ["R...Y.."] });
check("다른 젤리 앞에서 멈춤", E.slide(s, at(s, 0, 0), R).end === at(s, 3, 0));
// 2) 패드 · 파이프 · 끈적판 · 고리
s = E.create({ map: ["R..v...", ".......", ".......", "......."] });
sl = E.slide(s, at(s, 0, 0), R);
check("튕김 패드에서 꺾임 (아래 끝까지)", sl.end === at(s, 3, 3) && sl.steps.some((t) => t.kind === "pad"), xy(s, sl.end));
s = E.create({ map: ["R.1....", ".......", "....1.."] });
sl = E.slide(s, at(s, 0, 0), R);
check("파이프로 나와 같은 방향으로 계속", sl.end === at(s, 6, 2), xy(s, sl.end));
s = E.create({ map: ["R.1....", ".......", "....1Y."] });
sl = E.slide(s, at(s, 0, 0), R);
check("파이프로 나왔는데 바로 막히면 나온 파이프 칸에 멈춤", sl.end === at(s, 4, 2), xy(s, sl.end));
s = E.create({ map: ["R.1....", ".......", "....1.."], on: [[4, 2, "Y"]] });
sl = E.slide(s, at(s, 0, 0), R);
check("나갈 파이프에 무언가 있으면 들어간 파이프 칸에 멈춤", sl.end === at(s, 2, 0), xy(s, sl.end));
s = E.create({ map: ["R..~..."] });
check("끈적판에서 멈춤", E.slide(s, at(s, 0, 0), R).end === at(s, 3, 0));
s = E.create({ map: [">.v", "...", "^.<"], on: [[1, 0, "R"]] });
sl = E.slide(s, at(s, 1, 0), R);
check("패드 고리면 끝없이 돌지 않고 멈춤", sl.steps.some((t) => t.kind === "loop"), { end: xy(s, sl.end), steps: sl.steps.map((t) => t.kind) });
// 3) 연결
s = E.create({ map: ["...R...", ".RR.g..", ".X.#...", "......."] });
let r = E.move(s, at(s, 3, 0), D); // (3,1) 에서 멈춤 → R R R 가로
let m = r.log.find((e) => e.type === "merge");
check("3개 연결 → 사라짐 · 90점 · 옆 상자 금 · 옆 꽁꽁 녹음", m && m.cells.length === 3 && r.state.score === 90 && r.state.pieces[at(s, 1, 2)] === E.CRATE1 && r.state.pieces[at(s, 4, 1)] === 4 && r.state.cleared[0] === 3 && r.state.thawed === 1, { score: r.state.score });
s = E.create({ map: ["......R", ".RR....", "......."] });
r = E.move(s, at(s, 6, 0), D);
check("이어지지 않으면 그대로 (점수 0 · 콤보 0)", r && !r.log.some((e) => e.type === "merge") && r.state.score === 0 && r.state.combo === 0);
check("무효 이동은 null (이동 수도 그대로)", E.move(s, at(s, 6, 0), R) === null);
// 4) 모양별 특수
const mk = (map, x, y, d) => {
  const t = E.create({ map });
  const q = E.move(t, at(t, x, y), d);
  return { t, q, me: q && q.log.find((e) => e.type === "merge") };
};
let k = mk(["...R...", "RRR....", "...#..."], 3, 0, D);
check("4개 가로 한 줄 → 가로 번개 (멈춘 자리에) · 점수 120+50+60", k.me && k.me.special === E.BOLT_H && k.q.state.pieces[at(k.t, 3, 1)] === E.BOLT_H && k.q.state.score === 230, { sp: k.me && k.me.special, score: k.q && k.q.state.score });
k = mk(["R..", "R.#", "R..", "...", "R.."], 0, 4, U);
check("4개 세로 → 세로 번개", k.me && k.me.special === E.BOLT_V);
k = mk(["RR.R", "R..#"], 3, 0, L);
check("4개 ㄱ자 → 폭신", k.me && k.me.special === E.FLUFFY);
k = mk(["R.R", "...", ".R.", ".R."], 1, 3, U);
k = mk(["R.R", "...", ".R.", "..."], 1, 2, U); // (1,0) 으로 → (0,0)(1,0)(2,0) + 아래 없음 = 3 …
k = mk(["R.R", "...", "...", ".R."], 1, 3, U); // (1,0) → 3개
k = mk(["R.R.", ".#..", "....", ".R.."], 1, 3, U); // 벽에 막혀 못 감
k = mk(["R.R", ".R.", "...", "..."], 1, 1, U); // (1,1) 위로 → (1,0) : (0,0)(1,0)(2,0) + (1,1)? 비었음 → 3개
k = mk(["R.R", "...", ".R.", "...", ".R."], 1, 4, U); // (1,4) 위로 → (1,3) (아래 R(1,2) 앞) … 
k = mk(["R.R", "...", "...", ".R.", ".#."], 1, 3, U); // (1,3) 위로 → (1,0)? (1,1)(1,2) 비었고 → (1,0) → 3개
k = mk([".R.", "R.R", "...", ".R."], 1, 3, U); // (1,3) 위로 → (1,1) → (1,0)(0,1)(2,1)(1,1) = T자 4개
check("4개 T자 → 별", k.me && k.me.special === E.STAR && k.me.cells.length === 4, k.me && k.me.special);
k = mk(["R...", "RR.R", "####"], 3, 1, L);
check("4개 ㄱ자 (가운데로 이음) → 폭신", k.me && k.me.special === E.FLUFFY, k.me && k.me.special);
k = mk(["RR..", "...R", "..#."], 2, 0, D);
k = mk(["RR.RR", "..R..", "....."], 2, 1, U);
check("5개 → 무지개", k.me && k.me.special === E.RAINBOW && k.me.cells.length === 5);
// 5) 특수 효과
let t = E.create({ map: ["|......", ".......", "BxY.G.."] });
let q = E.move(t, at(t, 0, 0), D); // (0,1) 에서 멈춤 → 0열
check("세로 번개: 그 열 전부", q.state.pieces[at(t, 0, 2)] === 0 && q.state.pieces[at(t, 1, 2)] === E.CRATE1 && q.state.used === 1);
t = E.create({ map: [".......", "RxY..S.", "......."] });
q = E.move(t, at(t, 5, 1), L); // (3,1) 멈춤 → 3x3 x2..4
check("별: 둘레 3x3 (밖은 그대로)", q.state.pieces[at(t, 2, 1)] === 0 && q.state.pieces[at(t, 1, 1)] === E.CRATE1 && q.state.pieces[at(t, 0, 1)] === 1);
t = E.create({ map: ["X.r..F.", "......#"] });
q = E.move(t, at(t, 5, 0), L); // (3,0) 멈춤 → 5x5 x1..5
check("폭신: 상자 · 얼음만 (얼음은 녹고 · 범위 밖 상자는 그대로)", q.state.pieces[at(t, 2, 0)] === 1 && q.state.pieces[at(t, 0, 0)] === E.CRATE2);
t = E.create({ map: ["X.r.F..", "......#"] });
q = E.move(t, at(t, 4, 0), L); // (3,0) 멈춤 → x1..5 → X(0,0) 밖, r 녹음
t = E.create({ map: ["Xr..F..", "......#"] });
q = E.move(t, at(t, 4, 0), L); // (2,0) 멈춤 → x0..4 → X 없어짐 · r 녹음
check("폭신: 범위 안 상자(체력 2도) 한 번에 · 얼음 녹음", q.state.pieces[at(t, 0, 0)] === 0 && q.state.pieces[at(t, 1, 0)] === 1 && q.state.crates === 1, [q.state.pieces[at(t, 0, 0)], q.state.pieces[at(t, 1, 0)]]);
t = E.create({ map: ["W..B..B", "B......", "....Y.."] });
q = E.move(t, at(t, 0, 0), R); // (2,0) 멈춤 · 앞 B → 하늘색 모두
check("무지개: 부딪힌 젤리 색 모두", E.count(q.state, (p) => p === 3) === 0 && q.state.pieces[at(t, 4, 2)] === 2 && q.state.cleared[2] === 3, q.state.cleared);
t = E.create({ map: ["W...#..", "B......"] });
q = E.move(t, at(t, 0, 0), R); // 벽 앞 멈춤 → 아무 일 없음
check("무지개가 벽에 부딪히면 아무 일 없음 (터지기만)", q.state.cleared.every((c) => c === 0));
// 6) 연쇄 (한 번만)
t = E.create({ map: [".....", ".....", "-.|.B", "..R.."] });
q = E.move(t, at(t, 0, 2), R); // (1,2) 멈춤 → 2행: | 연쇄 → 2열
const fs = q.log.filter((e) => e.type === "special");
check("연쇄: 번개가 번개를 터뜨림 · 각각 한 번만", fs.length === 2 && q.state.pieces[at(t, 2, 3)] === 0 && q.state.pieces[at(t, 4, 2)] === 0 && q.state.used === 2, fs.map((e) => [e.piece, e.depth]));
t = E.create({ map: ["-|-|-", "|-|-|", "-|-|-", "....."], on: [] });
t = E.create({ map: ["S|S..", "-S-..", "S|S..", "....."] });
q = E.move(t, at(t, 2, 1), R); // 가로 번개 (4,1) 로 → 1행: 번개 · 별 → 별 3x3 → 모두 연쇄
check("특수 젤리가 빽빽해도 연쇄가 끝남 · 9개 각각 한 번", q && q.state.used === 9 && E.count(q.state, E.isSpecial) === 0, q && q.state.used);
// 7) 콤보
t = E.create({ map: ["#R#", "R.R", "###", "#Y#", "Y.Y", "###"] });
const a = E.move(t, at(t, 1, 0), D);
const b = E.move(a.state, at(t, 1, 3), D);
check("콤보: 연속 연결이면 두 번째 점수 1.25배", a.state.combo === 1 && b.state.combo === 2 && b.state.score === 90 + Math.round(90 * 1.25), { a: a.state.score, b: b.state.score });
// 8) 목표
t = E.create({ map: ["R.R..x", ".....R", "..y.x."] });
const goals = [{ type: "clear" }, { type: "crates" }];
check("목표 진행: 모두 없애기 · 상자", E.goalProgress(t, goals[0], t).n === 4 && E.goalProgress(t, goals[1], t).n === 2 && !E.goalsDone(t, goals, t));
// 9) 점수 도전: 새 젤리가 바로 3개를 만들지 않음
t = E.create({ map: ["......", "......", "......", "......", "......", "......"] });
const rand = E.rng(7);
let bad3 = 0;
for (let i = 0; i < 12; i++) {
  E.spawn(t, 3, [0, 1, 2], rand);
  for (let j = 0; j < t.pieces.length; j++) if (E.isJelly(t.pieces[j]) && E.group(t, j).length >= 3) bad3++;
}
check("새 젤리는 바로 3개 이어지게 놓이지 않음 · 판이 차면 멈춤", bad3 === 0 && E.count(t, E.isJelly) <= 36, { full: E.count(t, E.isJelly) });
console.log(`\n${ok}/${ok + bad} PASS`);
process.exit(bad ? 1 : 0);
