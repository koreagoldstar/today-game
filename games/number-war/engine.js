/* 숫자전쟁 : NUMBER WAR — 규칙 엔진 (화면과 분리 · 브라우저와 node 양쪽에서 씀)
 *
 * 판: 5×5. 한 턴에 한 가지 행동.
 *   1) 조합: 타일 A 를 고르고 상하좌우로 붙은 타일 B 를 고른다. 규칙이 맞으면 B 자리에 결과가 남는다.
 *      텐(합 10)     A+B=10      → 두 타일 모두 사라짐          40 + 3×큰 수
 *      쌍둥이(같은 수) A=B        → B 가 한 단계 커짐(A+1)      10×A   (9+9 는 '노바': 둘 다 사라짐, 150)
 *      계단(연속 수)  |A−B|=1     → A 만 사라지고 B 는 그대로    4×(A+B)
 *      배수(특수)     작은 수≥2 이고 큰 수가 그 배수 → B 자리에 몫이 남음   6×큰 수
 *      두 가지가 겹치면 텐 > 쌍둥이 > 계단 > 배수 순서로 하나만 적용한다 (예: 5·5 는 텐).
 *   2) 이동: 타일을 붙어 있는 빈칸으로 옮긴다. 점수 없음 · 콤보가 끊긴다.
 *   3) 폭탄: 폭탄 타일을 두 번 누르면 둘레 8칸을 지운다. 5×지운 숫자 합 + 20.
 * 콤보: 조합(또는 폭탄)을 연달아 성공한 턴 수. 1연속 ×1, 2연속 ×1.2, 3연속 ×1.5, 4연속 ×2, 그 뒤 +0.25씩(최대 ×3). 이동하면 끊긴다.
 * 특수 타일: 와일드(아무 숫자와 쌍둥이) · 폭탄 · 더블(점수 ×2) · 연쇄(콤보가 한 단계 더 오름) · 잠금(옆칸에서 조합이 일어나야 풀림)
 * 턴이 끝나면 정해진 수만큼 새 타일이 빈칸에 생긴다(같은 씨앗이면 같은 순서). 턴이 다 되거나 둘 곳이 없으면 끝.
 */
(function (root) {
  "use strict";
  const N = 5;
  const CELLS = N * N;

  /* ---------- 난수 (씨앗이 같으면 같은 결과) ---------- */
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function rngNext(st) {
    // mulberry32 · 상태를 객체에 보관해 저장 · 복원 가능
    st.r = (st.r + 0x6d2b79f5) >>> 0;
    let t = st.r;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /* ---------- 모드 ---------- */
  const MODES = {
    classic: { name: "클래식", turns: 30, spawn: 2, start: 12, special: { wild: 0.03, bomb: 0.02, double: 0.04, chain: 0.03 }, locks: 0, bonus: 1 },
    daily: { name: "오늘의 숫자전쟁", turns: 30, spawn: 2, start: 12, special: { wild: 0.03, bomb: 0.02, double: 0.04, chain: 0.03 }, locks: 1, bonus: 1 },
    time: { name: "시간 제한", turns: Infinity, seconds: 120, spawn: 2, start: 12, special: { wild: 0.04, bomb: 0.03, double: 0.04, chain: 0.04 }, locks: 0, bonus: 1 },
    strategy: { name: "고난도 전략", turns: 18, spawn: 1, start: 16, special: { wild: 0.05, bomb: 0.03, double: 0.05, chain: 0.05 }, locks: 3, startSpecials: ["wild", "bomb", "double", "chain"], bonus: 1.25 },
    vs: { name: "AI 대결", turns: 30, spawn: 1, start: 12, special: { wild: 0.03, bomb: 0.02, double: 0.04, chain: 0.03 }, locks: 0, bonus: 1 },
  };
  const VALUE_W = [0, 14, 14, 13, 12, 11, 10, 9, 8, 7]; // 1~9 나올 비율 (작은 수가 조금 더 자주)

  function drawValue(st) {
    let total = 0;
    for (let v = 1; v <= 9; v += 1) total += VALUE_W[v];
    let r = rngNext(st) * total;
    for (let v = 1; v <= 9; v += 1) {
      r -= VALUE_W[v];
      if (r < 0) return v;
    }
    return 9;
  }
  function drawTile(st, cfg) {
    const r = rngNext(st);
    const sp = cfg.special;
    let acc = 0;
    if (r < (acc += sp.wild)) return { v: 0, s: "wild" };
    if (r < (acc += sp.bomb)) return { v: 0, s: "bomb" };
    const v = drawValue(st);
    if (r < (acc += sp.double)) return { v, s: "double" };
    if (r < (acc += sp.chain)) return { v, s: "chain" };
    return { v, s: null };
  }
  const empties = (cells) => cells.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  function spawn(g, count) {
    const out = [];
    for (let k = 0; k < count; k += 1) {
      const e = empties(g.cells);
      if (!e.length) break;
      const at = e[Math.floor(rngNext(g.rng) * e.length)];
      g.cells[at] = drawTile(g.rng, MODES[g.mode]);
      out.push(at);
    }
    return out;
  }

  /** 새 게임. seed 는 숫자나 글자 (오늘의 숫자전쟁은 날짜 글자) */
  function newGame(mode, seed, opts = {}) {
    const cfg = MODES[mode];
    const g = {
      mode,
      seed: String(seed),
      rng: { r: hashStr(`nw:${mode}:${seed}`) },
      cells: new Array(CELLS).fill(null),
      turn: 0,
      maxTurns: cfg.turns,
      score: 0,
      combo: 0,
      maxCombo: 0,
      over: false,
      reason: "",
      log: [],
      stats: { ten: 0, twin: 0, step: 0, mult: 0, nova: 0, bomb: 0, wild: 0, double: 0, chain: 0, unlock: 0, made: {}, moves: 0, combos: 0 },
      players: opts.vs ? [{ score: 0, combo: 0, maxCombo: 0 }, { score: 0, combo: 0, maxCombo: 0 }] : null,
      current: 0,
    };
    // 처음 판: 숫자 타일만 깔고, 전략 모드는 특수 타일 · 잠금을 정해진 수만큼
    let placed = 0;
    while (placed < cfg.start) {
      const e = empties(g.cells);
      const at = e[Math.floor(rngNext(g.rng) * e.length)];
      g.cells[at] = { v: drawValue(g.rng), s: null };
      placed += 1;
    }
    const filled = g.cells.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
    let pick = filled.slice();
    const take = () => pick.splice(Math.floor(rngNext(g.rng) * pick.length), 1)[0];
    for (const s of cfg.startSpecials || []) {
      const at = take();
      g.cells[at] = s === "wild" || s === "bomb" ? { v: 0, s } : { v: g.cells[at].v, s };
    }
    for (let k = 0; k < cfg.locks; k += 1) {
      const at = take();
      if (g.cells[at].s === "wild" || g.cells[at].s === "bomb") continue;
      g.cells[at].lock = true;
    }
    if (!hasAnyAction(g)) {
      // 첫 판에 둘 곳이 없으면(거의 없음) 한 칸 비움
      g.cells[filled[0]] = null;
    }
    return g;
  }

  /* ---------- 규칙 ---------- */
  const adj = (i) => {
    const r = Math.floor(i / N);
    const c = i % N;
    const out = [];
    if (r > 0) out.push(i - N);
    if (r < N - 1) out.push(i + N);
    if (c > 0) out.push(i - 1);
    if (c < N - 1) out.push(i + 1);
    return out;
  };
  const around = (i) => {
    const r = Math.floor(i / N);
    const c = i % N;
    const out = [];
    for (let dr = -1; dr <= 1; dr += 1)
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
      }
    return out;
  };
  /** 두 숫자에 맞는 규칙 (없으면 null) */
  function ruleOf(a, b) {
    if (!a || !b) return null;
    if (a + b === 10) return "ten";
    if (a === b) return a === 9 ? "nova" : "twin";
    if (Math.abs(a - b) === 1) return "step";
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (lo >= 2 && hi % lo === 0) return "mult";
    return null;
  }
  const RULE_NAME = { ten: "텐", twin: "쌍둥이", nova: "노바", step: "계단", mult: "배수", wild: "와일드", bomb: "폭탄" };
  /** 타일 두 개(source → target)의 조합 판정 */
  function combineInfo(src, dst) {
    if (!src || !dst || src.lock || dst.lock) return null;
    if (src.s === "bomb" || dst.s === "bomb") return null;
    if (src.s === "wild" && dst.s === "wild") return null;
    if (src.s === "wild" || dst.s === "wild") {
      const n = src.s === "wild" ? dst.v : src.v;
      return { rule: n === 9 ? "nova" : "twin", a: n, b: n, viaWild: true };
    }
    const rule = ruleOf(src.v, dst.v);
    return rule ? { rule, a: src.v, b: dst.v } : null;
  }
  function baseOf(rule, a, b) {
    if (rule === "ten") return 40 + 3 * Math.max(a, b);
    if (rule === "twin") return 10 * a;
    if (rule === "nova") return 150;
    if (rule === "step") return 4 * (a + b);
    if (rule === "mult") return 6 * Math.max(a, b);
    return 0;
  }
  function comboMult(c) {
    if (c <= 1) return 1;
    if (c === 2) return 1.2;
    if (c === 3) return 1.5;
    return Math.min(3, 2 + 0.25 * (c - 4));
  }

  /** 한 칸에서 할 수 있는 행동 목록 */
  function actionsFrom(g, i) {
    const t = g.cells[i];
    const out = [];
    if (!t || t.lock || g.over) return out;
    if (t.s === "bomb") out.push({ type: "bomb", from: i, to: i });
    for (const j of adj(i)) {
      const d = g.cells[j];
      if (!d) out.push({ type: "move", from: i, to: j });
      else {
        const info = combineInfo(t, d);
        if (info) out.push({ type: "combine", from: i, to: j, rule: info.rule });
      }
    }
    return out;
  }
  function allActions(g) {
    const out = [];
    for (let i = 0; i < CELLS; i += 1) for (const a of actionsFrom(g, i)) out.push(a);
    return out;
  }
  function hasAnyAction(g) {
    for (let i = 0; i < CELLS; i += 1) if (actionsFrom(g, i).length) return true;
    return false;
  }

  const clone = (g) => JSON.parse(JSON.stringify({ ...g, maxTurns: g.maxTurns === Infinity ? -1 : g.maxTurns }), (k, v) => (k === "maxTurns" && v === -1 ? Infinity : v));

  /** 점수만 미리 계산 (판은 바꾸지 않음) — 화면 미리보기 · AI 가 씀 */
  function preview(g, act) {
    const combo = g.players ? g.players[g.current].combo : g.combo;
    const src = g.cells[act.from];
    if (act.type === "move") return { points: 0, base: 0, mult: 1, combo: 0, rule: "move" };
    if (act.type === "bomb") {
      let sum = 0;
      let n = 0;
      for (const j of around(act.from)) if (g.cells[j]) {
        sum += g.cells[j].v || 0;
        n += 1;
      }
      const c = combo + 1;
      const base = 20 + 5 * sum;
      const m = comboMult(c);
      return { points: Math.round(base * m), base, mult: m, combo: c, rule: "bomb", cleared: n };
    }
    const dst = g.cells[act.to];
    const info = combineInfo(src, dst);
    if (!info) return null;
    const dbl = src.s === "double" || dst.s === "double" ? 2 : 1;
    const chain = src.s === "chain" || dst.s === "chain" ? 1 : 0;
    const c = combo + 1 + chain;
    const base = baseOf(info.rule, info.a, info.b);
    const m = comboMult(c);
    return { points: Math.round(base * dbl * m), base, mult: m, dbl, combo: c, rule: info.rule, viaWild: !!info.viaWild };
  }

  /** 행동을 실행 (판을 바꿈). 반환: { ok, points, rule, changed:[칸], spawned:[칸], unlocked:[칸] } */
  function apply(g, act, { noSpawn = false } = {}) {
    if (g.over) return { ok: false, why: "over" };
    const legal = actionsFrom(g, act.from).find((a) => a.type === act.type && a.to === act.to);
    if (!legal) return { ok: false, why: "illegal" };
    const P = g.players ? g.players[g.current] : null;
    const st = g.stats;
    const pv = preview(g, act);
    const src = g.cells[act.from];
    const changed = [act.from, act.to];
    const unlocked = [];
    let made = null;
    const unlockAround = (center) => {
      for (const j of adj(center)) if (g.cells[j] && g.cells[j].lock) {
        g.cells[j].lock = false;
        unlocked.push(j);
        st.unlock += 1;
      }
    };
    if (act.type === "move") {
      g.cells[act.to] = src;
      g.cells[act.from] = null;
      st.moves += 1;
      if (P) P.combo = 0;
      else g.combo = 0;
    } else if (act.type === "bomb") {
      for (const j of around(act.from)) if (g.cells[j]) {
        g.cells[j] = null;
        changed.push(j);
      }
      g.cells[act.from] = null;
      st.bomb += 1;
      unlockAround(act.from);
    } else {
      const dst = g.cells[act.to];
      const info = combineInfo(src, dst);
      if (src.s === "double" || dst.s === "double") st.double += 1;
      if (src.s === "chain" || dst.s === "chain") st.chain += 1;
      if (info.viaWild) st.wild += 1;
      st[info.rule] += 1;
      g.cells[act.from] = null;
      if (info.rule === "ten" || info.rule === "nova") g.cells[act.to] = null;
      else if (info.rule === "twin") g.cells[act.to] = { v: info.a + 1, s: null };
      else if (info.rule === "step") g.cells[act.to] = { v: dst.s === "wild" ? src.v : dst.v, s: null };
      else if (info.rule === "mult") g.cells[act.to] = { v: Math.max(info.a, info.b) / Math.min(info.a, info.b), s: null };
      if (g.cells[act.to]) {
        made = g.cells[act.to].v;
        st.made[made] = (st.made[made] || 0) + 1;
      }
      unlockAround(act.to);
    }
    if (act.type !== "move") {
      st.combos += 1;
      if (P) {
        P.combo = pv.combo;
        P.maxCombo = Math.max(P.maxCombo, P.combo);
        P.score += pv.points;
      } else {
        g.combo = pv.combo;
        g.maxCombo = Math.max(g.maxCombo, g.combo);
        g.score += pv.points;
      }
    }
    g.turn += 1;
    g.log.push({ t: g.turn, type: act.type, rule: pv.rule, points: pv.points, p: g.players ? g.current : 0 });
    const spawned = noSpawn ? [] : spawn(g, MODES[g.mode].spawn);
    if (g.players) g.current = 1 - g.current;
    if (g.turn >= g.maxTurns) finish(g, "turns");
    else if (!hasAnyAction(g)) finish(g, "stuck");
    return { ok: true, points: pv.points, rule: pv.rule, combo: pv.combo, mult: pv.mult, dbl: pv.dbl || 1, changed, spawned, unlocked, made };
  }

  /** 시간 제한 모드: 앞 조합 뒤 3초 안에 또 조합하면 빠른 판단 보너스 (+15) */
  const QUICK_BONUS = 15;
  function quick(g) {
    g.score += QUICK_BONUS;
    g.stats.quick = (g.stats.quick || 0) + 1;
    return QUICK_BONUS;
  }

  /** 끝 보너스: 빈칸 정리 · 완전 정리 시 남은 턴 · 난이도 */
  function endBonus(g) {
    const empty = empties(g.cells).length;
    const board = empty * 8;
    const clear = empty === CELLS && Number.isFinite(g.maxTurns) ? Math.max(0, g.maxTurns - g.turn) * 30 : 0;
    const subtotal = (g.players ? g.players[0].score : g.score) + board + clear;
    const diff = Math.round(subtotal * (MODES[g.mode].bonus - 1));
    return { board, clear, diff, total: board + clear + diff };
  }
  function finish(g, reason) {
    if (g.over) return;
    g.over = true;
    g.reason = reason;
    if (!g.players) {
      g.bonus = endBonus(g);
      g.final = g.score + g.bonus.total;
    } else {
      g.final = g.players[0].score;
    }
  }

  /* ---------- AI ---------- */
  /** 판 상태 점수: 조합 가능한 수 · 빈칸 · 큰 숫자 · 특수 타일 */
  function boardEval(g) {
    let options = 0;
    for (let i = 0; i < CELLS; i += 1) for (const a of actionsFrom(g, i)) if (a.type !== "move") options += 1;
    const empty = empties(g.cells).length;
    return options * 3 + empty * 2;
  }
  function simulate(g, act) {
    const h = clone(g);
    const r = apply(h, act, { noSpawn: true }); // AI 는 다음에 나올 타일을 미리 보지 않는다 (공정)
    return { h, r };
  }
  /**
   * level: easy  — 지금 당장 기본 점수가 가장 큰 수 (콤보 · 특수 효과는 따지지 않음)
   *        normal — 콤보 배율 · 더블 · 폭탄까지 계산한 실제 점수 + 판 상태
   *        hard   — 내 수 → 상대의 가장 좋은 대응 → 내 다음 수까지 (3수) 내다봄
   * 같은 판이면 언제나 같은 수를 고른다 (무작위 없음).
   */
  function aiChoose(g, level = "normal") {
    const acts = allActions(g);
    if (!acts.length) return null;
    const keyOf = (a) => a.from * 100 + a.to + (a.type === "bomb" ? 0.5 : 0);
    let best = null;
    let bestV = -Infinity;
    const consider = (a, v) => {
      if (v > bestV + 1e-9 || (Math.abs(v - bestV) <= 1e-9 && keyOf(a) < keyOf(best))) {
        best = a;
        bestV = v;
      }
    };
    if (level === "easy") {
      for (const a of acts) {
        const p = preview(g, a);
        let v = p.base;
        if (a.type === "move") v = -1; // 조합이 없을 때만 이동
        consider(a, v);
      }
      return best;
    }
    const me = g.current;
    const scoreOf = (h, who) => (h.players ? h.players[who].score : h.score);
    for (const a of acts) {
      const { h } = simulate(g, a);
      let v = scoreOf(h, me) - scoreOf(g, me) + boardEval(h) * 0.6;
      if (a.type === "move") v -= 6;
      if (level === "hard" && !h.over) {
        if (h.players) {
          // 상대의 가장 좋은 대응
          let oppBest = 0;
          let after = h;
          for (const b of allActions(h)) {
            const s = simulate(h, b);
            const gain = scoreOf(s.h, 1 - me) - scoreOf(h, 1 - me);
            if (gain > oppBest) {
              oppBest = gain;
              after = s.h;
            }
          }
          let myNext = 0;
          if (!after.over) for (const c of allActions(after)) myNext = Math.max(myNext, preview(after, c).points);
          v += myNext * 0.5 - oppBest * 0.8;
        } else {
          let myNext = 0;
          for (const c of allActions(h)) myNext = Math.max(myNext, preview(h, c).points);
          v += myNext * 0.7;
        }
      }
      consider(a, v);
    }
    return best;
  }

  /* ---------- 오늘의 숫자전쟁 · 미션 ---------- */
  const MISSIONS = [
    { id: "combo3", text: "3연속 콤보 달성", test: (g) => maxComboOf(g) >= 3 },
    { id: "combo5", text: "5연속 콤보 달성", test: (g) => maxComboOf(g) >= 5 },
    { id: "make9", text: "숫자 9 만들기 (쌍둥이 8+8)", test: (g) => (g.stats.made[9] || 0) >= 1 },
    { id: "make7", text: "숫자 7 을 두 번 만들기", test: (g) => (g.stats.made[7] || 0) >= 2 },
    { id: "special2", text: "특수 타일 2회 활용", test: (g) => g.stats.wild + g.stats.bomb + g.stats.double + g.stats.chain >= 2 },
    { id: "ten5", text: "텐(합 10) 5회", test: (g) => g.stats.ten >= 5 },
    { id: "mult3", text: "배수 조합 3회", test: (g) => g.stats.mult >= 3 },
    { id: "step6", text: "계단 조합 6회", test: (g) => g.stats.step >= 6 },
    { id: "nova", text: "노바(9+9) 터뜨리기", test: (g) => g.stats.nova >= 1 },
    { id: "unlock", text: "잠금 타일 풀기", test: (g) => g.stats.unlock >= 1 },
    { id: "score2500", text: "2,500점 이상", test: (g) => (g.final || g.score) >= 2500 },
    { id: "score4000", text: "4,000점 이상", test: (g) => (g.final || g.score) >= 4000 },
    { id: "nomove", text: "이동 3회 이하로 끝내기", test: (g) => g.over && g.stats.moves <= 3 },
  ];
  function maxComboOf(g) {
    return g.players ? g.players[0].maxCombo : g.maxCombo;
  }
  function dailyMissions(dateKey) {
    const st = { r: hashStr(`nw-mission:${dateKey}`) };
    const pool = MISSIONS.slice();
    const out = [];
    while (out.length < 3) out.push(pool.splice(Math.floor(rngNext(st) * pool.length), 1)[0]);
    return out;
  }

  const api = { N, CELLS, MODES, RULE_NAME, newGame, ruleOf, combineInfo, baseOf, comboMult, actionsFrom, allActions, hasAnyAction, preview, apply, endBonus, finish, aiChoose, boardEval, dailyMissions, MISSIONS, quick, QUICK_BONUS, hashStr, adj, around, clone };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NW = api;
})(typeof window !== "undefined" ? window : globalThis);
