(() => {
  "use strict";

  const A = window.TodayAdult;
  const $ = (id) => document.getElementById(id);
  const screens = { title: $("title"), play: $("play"), over: $("over") };

  const LEVELS = {
    easy: { name: "쉬움", clues: 40 },
    normal: { name: "보통", clues: 32 },
    hard: { name: "어려움", clues: 26 },
  };
  const SAVE_KEY = "today-sudoku-save";
  const BEST_KEY = "today-sudoku-best";

  /* ---------- 퍼즐 만들기 (씨앗이 같으면 같은 퍼즐) ---------- */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0 || 1;
  }

  function makeRng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const PEERS = (() => {
    const out = [];
    for (let i = 0; i < 81; i += 1) {
      const r = Math.floor(i / 9);
      const c = i % 9;
      const set = new Set();
      for (let k = 0; k < 9; k += 1) {
        set.add(r * 9 + k);
        set.add(k * 9 + c);
      }
      const br = Math.floor(r / 3) * 3;
      const bc = Math.floor(c / 3) * 3;
      for (let y = 0; y < 3; y += 1) for (let x = 0; x < 3; x += 1) set.add((br + y) * 9 + bc + x);
      set.delete(i);
      out.push([...set]);
    }
    return out;
  })();

  function canPlace(g, i, v) {
    return PEERS[i].every((p) => g[p] !== v);
  }

  function fill(g, rnd) {
    const i = g.indexOf(0);
    if (i < 0) return true;
    for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd)) {
      if (canPlace(g, i, v)) {
        g[i] = v;
        if (fill(g, rnd)) return true;
        g[i] = 0;
      }
    }
    return false;
  }

  /** 해답 개수 (limit 까지만 셈) */
  function countSolutions(g, limit) {
    let best = -1;
    let bestN = 10;
    for (let i = 0; i < 81; i += 1) {
      if (g[i]) continue;
      let n = 0;
      for (let v = 1; v <= 9; v += 1) if (canPlace(g, i, v)) n += 1;
      if (n === 0) return 0;
      if (n < bestN) {
        bestN = n;
        best = i;
      }
    }
    if (best < 0) return 1;
    let total = 0;
    for (let v = 1; v <= 9; v += 1) {
      if (!canPlace(g, best, v)) continue;
      g[best] = v;
      total += countSolutions(g, limit - total);
      g[best] = 0;
      if (total >= limit) break;
    }
    return total;
  }

  function generate(seedStr, level) {
    const rnd = makeRng(hash(seedStr));
    const solution = new Array(81).fill(0);
    fill(solution, rnd);
    const puzzle = solution.slice();
    let clues = 81;
    const target = LEVELS[level].clues;
    for (const i of shuffled([...Array(81).keys()], rnd)) {
      if (clues <= target) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle.slice(), 2) !== 1) puzzle[i] = keep;
      else clues -= 1;
    }
    return { puzzle, solution };
  }

  /* ---------- 상태 ---------- */
  let level = "normal";
  let game = null; // { id, name, level, puzzle, solution, cells, notes, mistakes, hints, elapsed }
  let sel = -1;
  let noteMode = false;
  let showErrors = true;
  let undoStack = [];
  let timer = 0;
  let lastTick = 0;

  const params = new URLSearchParams(location.search);

  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    document.body.classList.toggle("is-play", name === "play");
    window.scrollTo(0, 0);
  }

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function fmtKo(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m ? `${m}분 ${s}초` : `${s}초`;
  }

  function paintBest() {
    const best = A.store(BEST_KEY, {});
    const b = best[level];
    $("best-line").textContent = b ? `${LEVELS[level].name} 최고 기록 ${fmtKo(b)}` : `${LEVELS[level].name} · 아직 기록 없음`;
    const saved = A.store(SAVE_KEY, null);
    $("resume-btn").classList.toggle("hidden", !saved || saved.done);
    if (saved && !saved.done) $("resume-btn").textContent = `이어서 하기 (${saved.name} · ${fmt(saved.elapsed || 0)})`;
  }

  function startGame(id, name, lv) {
    $("title").classList.add("sd-loading");
    // 어려움 생성은 잠깐 걸릴 수 있어 한 프레임 쉬고 시작
    setTimeout(() => {
      const { puzzle, solution } = generate(id, lv);
      game = {
        id,
        name,
        level: lv,
        puzzle,
        solution,
        cells: puzzle.slice(),
        notes: Array.from({ length: 81 }, () => []),
        mistakes: 0,
        hints: 3,
        elapsed: 0,
        done: false,
      };
      undoStack = [];
      sel = puzzle.indexOf(0);
      $("title").classList.remove("sd-loading");
      enterPlay();
    }, 30);
  }

  function enterPlay() {
    show("play");
    buildBoard();
    paint();
    lastTick = performance.now();
    clearInterval(timer);
    timer = setInterval(tick, 500);
  }

  function tick() {
    if (!game || game.done) return;
    const now = performance.now();
    if (!document.hidden) game.elapsed += (now - lastTick) / 1000;
    lastTick = now;
    $("sd-time").textContent = fmt(game.elapsed);
    if (Math.floor(game.elapsed) % 5 === 0) A.save(SAVE_KEY, game);
  }

  document.addEventListener("visibilitychange", () => {
    lastTick = performance.now();
    if (game && !game.done) A.save(SAVE_KEY, game);
  });

  /* ---------- 화면 ---------- */
  let cellEls = [];

  function buildBoard() {
    const board = $("board");
    board.innerHTML = "";
    cellEls = [];
    for (let i = 0; i < 81; i += 1) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "sd-cell";
      const r = Math.floor(i / 9);
      const c = i % 9;
      if (c % 3 === 2 && c !== 8) el.classList.add("br");
      if (r % 3 === 2 && r !== 8) el.classList.add("bb");
      el.setAttribute("role", "gridcell");
      el.addEventListener("click", () => {
        sel = i;
        paint();
      });
      board.appendChild(el);
      cellEls.push(el);
    }
    const pad = $("pad");
    pad.innerHTML = "";
    for (let v = 1; v <= 9; v += 1) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sd-key";
      b.dataset.v = v;
      b.innerHTML = `${v}<small></small>`;
      b.addEventListener("click", () => input(v));
      pad.appendChild(b);
    }
  }

  function paint() {
    if (!game) return;
    $("sd-name").textContent = game.name;
    $("sd-mistakes").textContent = `실수 ${game.mistakes}`;
    $("hint-left").textContent = game.hints;
    $("note-state").textContent = noteMode ? "켬" : "끔";
    $("note-btn").classList.toggle("on", noteMode);
    $("sd-time").textContent = fmt(game.elapsed);

    const sr = sel >= 0 ? Math.floor(sel / 9) : -1;
    const sc = sel >= 0 ? sel % 9 : -1;
    const sb = sel >= 0 ? Math.floor(sr / 3) * 3 + Math.floor(sc / 3) : -1;
    const sv = sel >= 0 ? game.cells[sel] : 0;
    const counts = new Array(10).fill(0);

    for (let i = 0; i < 81; i += 1) {
      const el = cellEls[i];
      const v = game.cells[i];
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const given = game.puzzle[i] !== 0;
      const wrong = showErrors && v && !given && v !== game.solution[i];
      if (v && v === game.solution[i]) counts[v] += 1;
      el.classList.toggle("given", given);
      el.classList.toggle("sel", i === sel);
      el.classList.toggle("peer", i !== sel && (r === sr || c === sc || b === sb));
      el.classList.toggle("same", Boolean(sv) && v === sv && i !== sel);
      el.classList.toggle("wrong", Boolean(wrong));
      if (v) {
        el.innerHTML = String(v);
        el.setAttribute("aria-label", `${r + 1}행 ${c + 1}열 ${v}`);
      } else if (game.notes[i].length) {
        el.innerHTML = `<span class="sd-notes">${[1, 2, 3, 4, 5, 6, 7, 8, 9]
          .map((n) => `<i>${game.notes[i].includes(n) ? n : ""}</i>`)
          .join("")}</span>`;
        el.setAttribute("aria-label", `${r + 1}행 ${c + 1}열 메모 ${game.notes[i].join(",")}`);
      } else {
        el.innerHTML = "";
        el.setAttribute("aria-label", `${r + 1}행 ${c + 1}열 빈칸`);
      }
    }
    $("pad")
      .querySelectorAll(".sd-key")
      .forEach((k) => {
        const v = Number(k.dataset.v);
        const left = 9 - counts[v];
        k.classList.toggle("done", left <= 0);
        k.querySelector("small").textContent = left > 0 ? left : "";
      });
  }

  function pushUndo() {
    undoStack.push({ cells: game.cells.slice(), notes: game.notes.map((n) => n.slice()) });
    if (undoStack.length > 200) undoStack.shift();
  }

  function input(v) {
    if (!game || game.done || sel < 0 || game.puzzle[sel]) return;
    if (noteMode) {
      if (game.cells[sel]) return;
      pushUndo();
      const n = game.notes[sel];
      const at = n.indexOf(v);
      if (at >= 0) n.splice(at, 1);
      else n.push(v);
      n.sort();
      A.sfx("tap");
      paint();
      return;
    }
    if (game.cells[sel] === v) return;
    pushUndo();
    game.cells[sel] = v;
    game.notes[sel] = [];
    if (v !== game.solution[sel]) {
      game.mistakes += 1;
      A.sfx("bad");
    } else {
      // 같은 줄·칸 메모에서 이 숫자 지우기
      PEERS[sel].forEach((p) => {
        const at = game.notes[p].indexOf(v);
        if (at >= 0) game.notes[p].splice(at, 1);
      });
      A.sfx("tap");
    }
    paint();
    checkDone();
  }

  function erase() {
    if (!game || sel < 0 || game.puzzle[sel]) return;
    if (!game.cells[sel] && !game.notes[sel].length) return;
    pushUndo();
    game.cells[sel] = 0;
    game.notes[sel] = [];
    paint();
  }

  function undo() {
    const prev = undoStack.pop();
    if (!prev || !game) return;
    game.cells = prev.cells;
    game.notes = prev.notes;
    paint();
  }

  function hint() {
    if (!game || game.done) return;
    if (game.hints <= 0) {
      A.toast("힌트를 다 썼어요");
      return;
    }
    let target = sel >= 0 && !game.puzzle[sel] && game.cells[sel] !== game.solution[sel] ? sel : -1;
    if (target < 0) {
      const empties = [];
      for (let i = 0; i < 81; i += 1) if (game.cells[i] !== game.solution[i]) empties.push(i);
      if (!empties.length) return;
      target = empties[Math.floor(Math.random() * empties.length)];
    }
    pushUndo();
    game.hints -= 1;
    game.cells[target] = game.solution[target];
    game.notes[target] = [];
    sel = target;
    A.sfx("pick");
    paint();
    checkDone();
  }

  function checkDone() {
    if (!game.cells.every((v, i) => v === game.solution[i])) return;
    game.done = true;
    clearInterval(timer);
    A.save(SAVE_KEY, null);
    A.sfx("win");
    const sec = Math.round(game.elapsed);
    const best = A.store(BEST_KEY, {});
    const isBest = !best[game.level] || sec < best[game.level];
    if (isBest) {
      best[game.level] = sec;
      A.save(BEST_KEY, best);
    }
    $("done-time").textContent = fmtKo(sec);
    $("done-line").textContent = `${game.name} · 실수 ${game.mistakes} · 힌트 ${3 - game.hints}개 사용${isBest ? " · 🏅 최고 기록!" : ""}`;
    setTimeout(() => {
      show("over");
      if (window.TodayDuel) {
        TodayDuel.report(sec, {
          label: fmtKo(sec),
          lowerIsBetter: true,
          parent: $("duel-slot"),
          extra: { p: game.id, lv: game.level },
          subject: `${game.name} 스도쿠`,
        });
      }
    }, 500);
  }

  /* ---------- 입력 ---------- */
  document.addEventListener("keydown", (e) => {
    if (screens.play.classList.contains("hidden") || !game) return;
    const k = e.key;
    if (/^[1-9]$/.test(k)) {
      input(Number(k));
      return;
    }
    if (k === "Backspace" || k === "Delete" || k === "0") {
      erase();
      return;
    }
    const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (moves[k] != null) {
      e.preventDefault();
      if (sel < 0) sel = 0;
      const r = Math.floor(sel / 9);
      const c = sel % 9;
      if (k === "ArrowUp") sel = ((r + 8) % 9) * 9 + c;
      if (k === "ArrowDown") sel = ((r + 1) % 9) * 9 + c;
      if (k === "ArrowLeft") sel = r * 9 + ((c + 8) % 9);
      if (k === "ArrowRight") sel = r * 9 + ((c + 1) % 9);
      paint();
      return;
    }
    if (k === "n" || k === "N") {
      noteMode = !noteMode;
      paint();
    }
    if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "Z")) {
      e.preventDefault();
      undo();
    }
  });

  $("levels").addEventListener("click", (e) => {
    const b = e.target.closest("[data-level]");
    if (!b) return;
    level = b.dataset.level;
    $("levels")
      .querySelectorAll("[data-level]")
      .forEach((x) => x.classList.toggle("on", x === b));
    paintBest();
  });

  $("daily-btn").addEventListener("click", () => {
    const day = A.seoulDay();
    startGame(`daily-${day}-${level}`, `오늘의 스도쿠 ${day.slice(5).replace("-", "/")} · ${LEVELS[level].name}`, level);
  });
  $("random-btn").addEventListener("click", () => {
    const id = `r-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    startGame(id, LEVELS[level].name, level);
  });
  $("next-btn").addEventListener("click", () => {
    const lv = game ? game.level : level;
    startGame(`r-${Date.now().toString(36)}`, LEVELS[lv].name, lv);
  });
  $("resume-btn").addEventListener("click", () => {
    const saved = A.store(SAVE_KEY, null);
    if (!saved) return;
    game = saved;
    undoStack = [];
    sel = game.cells.findIndex((v, i) => !game.puzzle[i] && v !== game.solution[i]);
    enterPlay();
  });
  $("quit-btn").addEventListener("click", () => {
    if (game && !game.done) A.save(SAVE_KEY, game);
    clearInterval(timer);
    show("title");
    paintBest();
  });
  $("home-btn").addEventListener("click", () => {
    show("title");
    paintBest();
  });
  $("undo-btn").addEventListener("click", undo);
  $("erase-btn").addEventListener("click", erase);
  $("hint-btn").addEventListener("click", hint);
  $("note-btn").addEventListener("click", () => {
    noteMode = !noteMode;
    paint();
  });
  $("check-btn").addEventListener("click", () => {
    showErrors = !showErrors;
    $("check-btn").textContent = `틀린 칸 표시: ${showErrors ? "켬" : "끔"}`;
    paint();
  });

  // 친구 도전장으로 들어오면 같은 퍼즐로 바로 시작
  const sharedId = params.get("p");
  const sharedLv = params.get("lv");
  paintBest();
  if (sharedId && /^[a-z0-9-]{3,40}$/.test(sharedId) && LEVELS[sharedLv]) {
    level = sharedLv;
    $("levels")
      .querySelectorAll("[data-level]")
      .forEach((x) => x.classList.toggle("on", x.dataset.level === level));
    paintBest();
    const go = document.createElement("button");
    go.type = "button";
    go.className = "ad-btn";
    go.textContent = `⚔️ 친구와 같은 퍼즐로 대결 (${LEVELS[level].name})`;
    go.addEventListener("click", () => startGame(sharedId, `친구 퍼즐 · ${LEVELS[level].name}`, level));
    $("title").insertBefore(go, $("daily-btn").parentNode);
  }
})();
