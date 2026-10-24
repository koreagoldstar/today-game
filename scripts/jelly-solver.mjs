/**
 * 말랑콩떡! 젤리 공장 — 자동 풀이기 · 스테이지 검증
 *
 *  게임과 같은 규칙 엔진(games/jelly-factory/js/engine.js)으로 가능한 이동을 짧은 것부터 모두 찾아
 *  (같은 판은 다시 안 봄) 목표를 이루는 가장 짧은 풀이를 구한다.
 *
 *  사용:
 *    node scripts/jelly-solver.mjs            → 스테이지 30개 + 오늘의 퍼즐 모음을 모두 검증
 *    node scripts/jelly-solver.mjs 7          → 7번 스테이지만 (풀이 출력)
 *  검증: ① 처음 판에 이미 3개 이어진 곳이 없음 ② 제한 이동 안에 풀림(가장 짧은 풀이 = par)
 *        ③ 적어 둔 풀이(sol)를 그대로 두면 실제로 깨짐 ④ 적어 둔 par 가 실제 가장 짧은 풀이와 같음
 */
import * as E from "../games/jelly-factory/js/engine.js";

/**
 * 이미 못 깨는 판인가 (가지치기)
 *  특수 젤리가 없고 앞으로도 생길 수 없을 때(어느 색도 4개가 안 됨)만 판단한다
 *  → 남은 1~2개짜리 색은 영영 못 없앰. (게임의 '더는 이을 수 없어요' 와 같은 규칙)
 */
export function dead(s, goals) {
  if (s.pieces.some(E.isSpecial)) return false;
  const cnt = [0, 0, 0, 0, 0, 0];
  for (const p of s.pieces) if (E.isJelly(p)) cnt[E.colorOf(p)]++;
  if (cnt.some((c) => c >= 4)) return false;
  for (const g of goals) {
    if (g.type === "clear" && cnt.some((c) => c === 1 || c === 2)) return true;
    if (g.type === "color" && s.cleared[g.color] + (cnt[g.color] >= 3 ? cnt[g.color] : 0) < g.n) return true;
  }
  return false;
}

/**
 * 가장 짧은 풀이 (너비 우선) → { ok, par, path:[[칸, 방향]…], nodes } · 못 찾으면 ok:false (cap 넘으면 capped)
 */
export function solve(def, { maxDepth = def.moves, cap = 2_500_000 } = {}) {
  const start = E.create(def);
  const goals = def.goals;
  if (E.goalsDone(start, goals, start)) return { ok: true, par: 0, path: [], nodes: 1 };
  let layer = [{ s: start, path: [] }];
  const seen = new Set([E.key(start, goals)]);
  let nodes = 1;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = [];
    for (const { s, path } of layer) {
      for (const [i, d] of E.validMoves(s)) {
        const r = E.move(s, i, d);
        if (!r) continue;
        const np = path.concat([[i, d]]);
        if (E.goalsDone(r.state, goals, start)) return { ok: true, par: depth, path: np, nodes };
        const k = E.key(r.state, goals);
        if (seen.has(k)) continue;
        seen.add(k);
        if (dead(r.state, goals)) continue;
        nodes++;
        if (nodes > cap) return { ok: false, capped: true, depth, nodes };
        next.push({ s: r.state, path: np });
      }
    }
    if (!next.length) return { ok: false, depth, nodes };
    layer = next;
  }
  return { ok: false, depth: maxDepth, nodes };
}

/** 적어 둔 풀이를 그대로 두어 봄 → 깨지나 · 몇 번 만에 */
export function replay(def, sol) {
  let s = E.create(def);
  const start = s;
  for (let n = 0; n < sol.length; n++) {
    const [x, y, d] = sol[n];
    const r = E.move(s, y * s.board.w + x, d);
    if (!r) return { ok: false, why: `${n + 1}번째 이동이 안 됨 (${x},${y} ${E.DIR_NAMES[d]})` };
    s = r.state;
    if (E.goalsDone(s, def.goals, start)) return { ok: n + 1 <= def.moves, used: n + 1, score: s.score };
  }
  return { ok: false, why: "다 두어도 목표를 못 이룸" };
}

/** 처음 판 확인: 이미 3개 이어진 곳 · 움직일 수 있는 것 */
export function lint(def) {
  const s = E.create(def);
  const issues = [];
  for (let i = 0; i < s.pieces.length; i++) if (E.isJelly(s.pieces[i]) && E.group(s, i).length >= 3) issues.push("처음부터 3개 이어짐");
  if (!E.validMoves(s).length) issues.push("움직일 수 있는 젤리가 없음");
  return [...new Set(issues)];
}

const toXY = (def, path) => {
  const w = def.map[0].length;
  return path.map(([i, d]) => [i % w, Math.floor(i / w), d]);
};

// ---------------- 명령줄 ----------------
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("jelly-solver.mjs")) {
  const { STAGES, DAILY } = await import("../games/jelly-factory/js/levels.js");
  const only = process.argv[2] ? Number(process.argv[2]) : 0;
  const list = only ? STAGES.filter((s) => s.id === only) : [...STAGES, ...DAILY.map((d, i) => ({ ...d, id: `D${i + 1}` }))];
  let bad = 0;
  for (const def of list) {
    const t0 = Date.now();
    const lintIssues = lint(def);
    const r = solve(def);
    const rp = def.sol ? replay(def, def.sol) : { ok: false, why: "적어 둔 풀이 없음" };
    const ok = !lintIssues.length && r.ok && rp.ok && (def.par == null || def.par === r.par);
    if (!ok) bad++;
    const sol = r.ok ? JSON.stringify(toXY(def, r.path)) : "-";
    console.log(`${ok ? "OK " : "XX "} ${String(def.id).padStart(3)} ${String(def.name || "").padEnd(14)} 제한 ${def.moves} · 가장 짧은 풀이 ${r.ok ? r.par : r.capped ? "탐색 한도 초과" : "없음"}${def.par != null && r.ok && def.par !== r.par ? ` (적어 둔 par ${def.par})` : ""} · 적어 둔 풀이 ${rp.ok ? `${rp.used}수 OK` : rp.why}${lintIssues.length ? " · " + lintIssues.join(",") : ""} · ${r.nodes}판 ${Date.now() - t0}ms${only ? "\n   풀이 " + sol : ""}`);
  }
  console.log(bad ? `\n문제 ${bad}개` : `\n모두 통과 (${list.length}개)`);
  process.exit(bad ? 1 : 0);
}
