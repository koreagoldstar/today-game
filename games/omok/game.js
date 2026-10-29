(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const TAU = Math.PI * 2;
  const SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  // 바둑판: 화면 위쪽 줄 아래에 정사각형 · 앞면 두께
  const BOARD = { x: 14, y: 84, size: 362, edge: 10, r: 12 };
  const MARGIN = 17;
  const ORIGIN = { x: BOARD.x + MARGIN, y: BOARD.y + MARGIN };
  const CELL = (BOARD.size - MARGIN * 2) / (SIZE - 1);
  const STONE_R = CELL * 0.47;
  const DIFF_KEY = "today-omok-diff";
  const DIFF_LABEL = { easy: "쉬움", normal: "보통", hard: "어려움" };

  const OPENINGS = [
    [7, 7],
    [7, 8],
    [8, 7],
    [6, 7],
    [7, 6],
    [8, 8],
    [6, 6],
    [8, 6],
    [6, 8],
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let pxScale = 1;
  const bgLayer = document.createElement("canvas");
  const boardLayer = document.createElement("canvas");
  const stoneSprites = { 1: null, 2: null, shadow: null, scale: 0 };

  const overlays = {
    title: document.getElementById("title"),
    result: document.getElementById("result"),
  };
  const el = {
    status: document.querySelector(".status"),
    statusStone: document.getElementById("status-stone"),
    turn: document.getElementById("hud-turn"),
    diff: document.getElementById("hud-diff"),
    cardMe: document.getElementById("card-me"),
    cardAi: document.getElementById("card-ai"),
    aiLevel: document.getElementById("ai-level"),
    aiState: document.getElementById("ai-state"),
    actions: document.getElementById("actions"),
    badge: document.getElementById("result-badge"),
    resultTitle: document.getElementById("result-title"),
    resultDetail: document.getElementById("result-detail"),
  };
  const undoBtn = document.getElementById("undo-btn");
  const newBtn = document.getElementById("new-btn");

  let board = [];
  let state = "title"; // title · play · paused · ending · result
  let difficulty = readDiff();
  let turn = BLACK;
  let lastMove = null;
  let history = [];
  let winLine = null;
  let winColor = EMPTY;
  let winAt = 0;
  let endT = 0;
  let aiBusy = false;
  let threat = false;
  let aim = null;
  let aiming = false;
  let newConfirmT = 0;
  let t = 0;
  let last = performance.now();
  const drops = new Map(); // 막 놓은 돌의 내려앉는 움직임
  let ripples = [];
  let sparks = [];
  const petals = Array.from({ length: 11 }, () => newPetal(true));

  function readDiff() {
    try {
      const d = localStorage.getItem(DIFF_KEY);
      return DIFF_LABEL[d] ? d : "easy";
    } catch (_) {
      return "easy";
    }
  }

  function show(node, on) {
    node.classList.toggle("hidden", !on);
  }

  function cellXY(r, c) {
    return { x: ORIGIN.x + c * CELL, y: ORIGIN.y + r * CELL };
  }

  function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function clearBoard() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    lastMove = null;
    history = [];
    winLine = null;
    winColor = EMPTY;
    turn = BLACK;
    aiBusy = false;
    threat = false;
    drops.clear();
    ripples = [];
    sparks = [];
  }

  /* ---------- 소리 (나무판에 돌 놓는 '탁' · 공용 소리 끄기 버튼을 따름) ---------- */
  const SFX = (() => {
    let ac = null;
    function audio() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
          ac = new AC();
        } catch (_) {
          return null;
        }
      }
      if (ac.state === "suspended") ac.resume().catch(() => {});
      return ac;
    }
    function click(soft) {
      const a = audio();
      if (!a) return;
      const now = a.currentTime;
      const n = Math.floor(a.sampleRate * 0.05);
      const buf = a.createBuffer(1, n, a.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
      const src = a.createBufferSource();
      src.buffer = buf;
      const f = a.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = soft ? 1500 : 2100;
      f.Q.value = 1.3;
      const g = a.createGain();
      g.gain.value = soft ? 0.45 : 0.65;
      src.connect(f);
      f.connect(g);
      g.connect(a.destination);
      src.start(now);
      const o = a.createOscillator();
      const og = a.createGain();
      o.frequency.setValueAtTime(soft ? 190 : 230, now);
      o.frequency.exponentialRampToValueAtTime(100, now + 0.07);
      og.gain.setValueAtTime(0.16, now);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      o.connect(og);
      og.connect(a.destination);
      o.start(now);
      o.stop(now + 0.1);
    }
    function notes(list, type, vol, gap) {
      const a = audio();
      if (!a) return;
      list.forEach((freq, i) => {
        const at = a.currentTime + i * gap;
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, at);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
        o.connect(g);
        g.connect(a.destination);
        o.start(at);
        o.stop(at + 0.4);
      });
    }
    return {
      unlock: audio,
      click,
      win: () => notes([523, 659, 784, 1046, 1319], "triangle", 0.12, 0.09),
      lose: () => notes([494, 440, 370, 330], "sine", 0.1, 0.14),
      undo: () => notes([660, 520], "sine", 0.06, 0.06),
    };
  })();

  /* ---------- 화면 글자 ---------- */
  function updateHud() {
    const label = DIFF_LABEL[difficulty];
    const moves = history.length;
    el.aiLevel.textContent = label;
    el.status.classList.toggle("thinking", aiBusy);
    el.status.classList.toggle("warn", threat && state === "play" && !aiBusy && turn === BLACK);
    let stone = "black";
    let main = "대국을 기다려요";
    let sub = label;
    if (state === "play" || state === "paused") {
      sub = `${label} · ${moves}수째`;
      if (aiBusy || turn === WHITE) {
        stone = "white";
        main = "AI가 생각하고 있어요";
      } else if (threat) {
        main = "조심! 막아야 할 곳이 있어요";
        sub = `백돌이 넷 · ${label} · ${moves}수째`;
      } else {
        main = moves === 0 ? "가운데쯤에 첫 돌을 놓아요" : "내 차례예요";
      }
    } else if (state === "ending" || state === "result") {
      stone = winColor === WHITE ? "white" : "black";
      main = winColor === BLACK ? "다섯 알 완성!" : winColor === WHITE ? "AI가 다섯 알을 이었어요" : "무승부";
      sub = `${label} · ${moves}수`;
    }
    el.statusStone.className = `stone-ico ${stone}`;
    el.turn.textContent = main;
    el.diff.textContent = sub;
    const playing = state === "play" || state === "paused";
    el.cardMe.classList.toggle("active", playing && turn === BLACK && !aiBusy);
    el.cardAi.classList.toggle("active", playing && (turn === WHITE || aiBusy));
    if (playing && (turn === WHITE || aiBusy)) {
      if (!el.aiState.querySelector(".dots")) el.aiState.innerHTML = '생각 중<span class="dots"><i>.</i><i>.</i><i>.</i></span>';
    } else el.aiState.textContent = "백돌";
    undoBtn.disabled = state !== "play" || history.length < 2 || aiBusy || turn !== BLACK;
    newBtn.disabled = state !== "play" || aiBusy;
    if (newBtn.disabled) resetNewBtn();
  }

  function resetNewBtn() {
    newConfirmT = 0;
    newBtn.classList.remove("confirm");
    newBtn.textContent = "↻ 새 판";
  }

  /* ---------- 규칙 · AI (예전 그대로) ---------- */
  function countLine(r, c, dr, dc, color) {
    let n = 0;
    let rr = r + dr;
    let cc = c + dc;
    while (inBounds(rr, cc) && board[rr][cc] === color) {
      n += 1;
      rr += dr;
      cc += dc;
    }
    return n;
  }

  function checkWin(r, c, color) {
    if (!inBounds(r, c) || board[r][c] !== color) return false;
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    return dirs.some(([dr, dc]) => {
      // 양옆(또는 위아래) 연속 + 방금 둔 돌 1개
      const total = 1 + countLine(r, c, dr, dc, color) + countLine(r, c, -dr, -dc, color);
      return total >= 5;
    });
  }

  function findWinningLine(r, c, color) {
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    for (let i = 0; i < dirs.length; i += 1) {
      const [dr, dc] = dirs[i];
      const cells = [{ r, c }];
      let rr = r + dr;
      let cc = c + dc;
      while (inBounds(rr, cc) && board[rr][cc] === color) {
        cells.push({ r: rr, c: cc });
        rr += dr;
        cc += dc;
      }
      rr = r - dr;
      cc = c - dc;
      while (inBounds(rr, cc) && board[rr][cc] === color) {
        cells.push({ r: rr, c: cc });
        rr -= dr;
        cc -= dc;
      }
      if (cells.length >= 5) return cells;
    }
    return null;
  }

  function place(r, c, color) {
    board[r][c] = color;
    lastMove = { r, c };
    history.push({ r, c, color });
    drops.set(r * SIZE + c, t);
    const p = cellXY(r, c);
    ripples.push({ x: p.x, y: p.y, t0: t, color });
    SFX.click(color === WHITE);
  }

  function undo() {
    if (history.length < 2 || aiBusy || state !== "play") return;
    for (let i = 0; i < 2; i += 1) {
      const mv = history.pop();
      if (mv) {
        board[mv.r][mv.c] = EMPTY;
        drops.delete(mv.r * SIZE + mv.c);
        const p = cellXY(mv.r, mv.c);
        for (let k = 0; k < 5; k++) sparks.push(spark(p.x, p.y, mv.color === BLACK ? "#5a5048" : "#fffaf0", 60));
      }
    }
    lastMove = history.length ? { r: history[history.length - 1].r, c: history[history.length - 1].c } : null;
    turn = BLACK;
    threat = false;
    SFX.undo();
    updateHud();
  }

  function neighbors(r, c) {
    for (let dr = -2; dr <= 2; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        if (!dr && !dc) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (inBounds(rr, cc) && board[rr][cc] !== EMPTY) return true;
      }
    }
    return false;
  }

  function candidates() {
    const list = [];
    let hasStone = false;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (board[r][c] !== EMPTY) hasStone = true;
      }
    }
    if (!hasStone) {
      OPENINGS.forEach(([r, c]) => list.push({ r, c }));
      return list;
    }
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (board[r][c] === EMPTY && neighbors(r, c)) list.push({ r, c });
      }
    }
    if (!list.length) list.push({ r: 7, c: 7 });
    return list;
  }

  function patternScore(r, c, color) {
    let score = 0;
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    dirs.forEach(([dr, dc]) => {
      const fwd = countLine(r, c, dr, dc, color);
      const back = countLine(r, c, -dr, -dc, color);
      const len = fwd + back + 1;
      if (len >= 5) score += 100000;
      else if (len === 4) score += 8000;
      else if (len === 3) score += 800;
      else if (len === 2) score += 80;
      else score += 8;
    });
    const center = 7;
    score += 14 - (Math.abs(r - center) + Math.abs(c - center));
    return score;
  }

  function evaluate() {
    let total = 0;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (board[r][c] === EMPTY) continue;
        const s = patternScore(r, c, board[r][c]);
        total += board[r][c] === WHITE ? s : -s;
      }
    }
    return total;
  }

  function winMove(color) {
    const cand = candidates();
    for (let i = 0; i < cand.length; i += 1) {
      const { r, c } = cand[i];
      board[r][c] = color;
      const win = checkWin(r, c, color);
      board[r][c] = EMPTY;
      if (win) return { r, c };
    }
    return null;
  }

  function scoreCell(r, c) {
    board[r][c] = WHITE;
    const atk = patternScore(r, c, WHITE);
    board[r][c] = BLACK;
    const def = patternScore(r, c, BLACK);
    board[r][c] = EMPTY;
    return atk * 1.08 + def * 0.95;
  }

  function pickHeuristic() {
    const win = winMove(WHITE);
    if (win) return win;
    const block = winMove(BLACK);
    if (block) return block;
    const cand = candidates();
    let best = null;
    let bestScore = -Infinity;
    cand.forEach(({ r, c }) => {
      let s = scoreCell(r, c);
      if (difficulty === "easy") s += (Math.random() - 0.5) * 120;
      if (s > bestScore) {
        bestScore = s;
        best = { r, c };
      }
    });
    return best || cand[Math.floor(Math.random() * cand.length)];
  }

  function minimax(depth, alpha, beta, maximizing) {
    const winW = winMove(WHITE);
    if (winW) return { score: 999999 - (4 - depth), move: winW };
    const winB = winMove(BLACK);
    if (winB) return { score: -999999 + (4 - depth), move: winB };
    if (depth === 0) return { score: evaluate(), move: null };

    const cand = candidates()
      .map(({ r, c }) => ({ r, c, s: scoreCell(r, c) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 10);

    let bestMove = cand[0] || { r: 7, c: 7 };
    if (maximizing) {
      let best = -Infinity;
      for (let i = 0; i < cand.length; i += 1) {
        const { r, c } = cand[i];
        board[r][c] = WHITE;
        const child = minimax(depth - 1, alpha, beta, false);
        board[r][c] = EMPTY;
        if (child.score > best) {
          best = child.score;
          bestMove = { r, c };
        }
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return { score: best, move: bestMove };
    }
    let best = Infinity;
    for (let i = 0; i < cand.length; i += 1) {
      const { r, c } = cand[i];
      board[r][c] = BLACK;
      const child = minimax(depth - 1, alpha, beta, true);
      board[r][c] = EMPTY;
      if (child.score < best) {
        best = child.score;
        bestMove = { r, c };
      }
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return { score: best, move: bestMove };
  }

  function aiMove() {
    const depthMap = { easy: 1, normal: 2, hard: 3 };
    let move;
    if (difficulty === "easy" && Math.random() < 0.35) {
      const cand = candidates();
      move = cand[Math.floor(Math.random() * cand.length)];
    } else if (difficulty === "hard") {
      move = minimax(depthMap.hard, -Infinity, Infinity, true).move;
    } else {
      move = pickHeuristic();
      if (difficulty === "normal" && Math.random() < 0.12) {
        const cand = candidates();
        move = cand[Math.floor(Math.random() * cand.length)];
      }
    }
    return move;
  }

  /* ---------- 흐름 ---------- */
  function endGame(color, r, c) {
    state = "ending";
    winColor = color;
    winLine = color ? findWinningLine(r, c, color) : null;
    winAt = t;
    endT = color ? 1.6 : 0.6;
    aim = null;
    if (color === BLACK) {
      SFX.win();
      burstAlongLine();
    } else if (color === WHITE) SFX.lose();
    updateHud();
  }

  // 이긴 판에서 연 랭킹 등록 칸 · 어제와 비교 글이 진 판에 남지 않게
  function hideRank() {
    overlays.result.querySelectorAll("#today-rank-form, .yesterday-feedback").forEach((n) => {
      n.hidden = true;
    });
  }

  function showResult() {
    state = "result";
    hideRank();
    const moves = history.length;
    const seal = el.badge;
    seal.className = "seal";
    if (winColor === BLACK) {
      const score = Math.max(1, 5000 - moves * 10);
      seal.textContent = "승";
      el.resultTitle.textContent = "승리!";
      el.resultDetail.textContent = `${moves}수 만에 다섯 알을 이었어요 · 점수 ${score.toLocaleString("ko-KR")}`;
      show(overlays.result, true);
      if (window.TodayGameRank) {
        TodayGameRank.mount({ gameId: "omok", gameTitle: "오목", formParent: overlays.result.querySelector(".result-card") });
        TodayGameRank.open(score);
      }
    } else if (winColor === WHITE) {
      seal.textContent = "패";
      seal.classList.add("lose");
      el.resultTitle.textContent = "아쉬워요!";
      el.resultDetail.textContent = `AI가 먼저 다섯 알을 이었어요 · ${moves}수`;
      show(overlays.result, true);
    } else {
      seal.textContent = "무";
      seal.classList.add("draw");
      el.resultTitle.textContent = "무승부!";
      el.resultDetail.textContent = "판이 가득 찼어요";
      show(overlays.result, true);
    }
    updateHud();
  }

  function applyMove(r, c, color) {
    place(r, c, color);
    if (checkWin(r, c, color)) {
      endGame(color, r, c);
      return;
    }
    // 보드가 가득 차면 무승부
    if (history.length >= SIZE * SIZE) {
      endGame(EMPTY, r, c);
      return;
    }
    turn = color === BLACK ? WHITE : BLACK;
    threat = false;
    updateHud();
    if (state === "play" && turn === WHITE) {
      aiBusy = true;
      updateHud();
      setTimeout(runAi, 420 + Math.random() * 260);
    } else if (turn === BLACK && difficulty !== "hard") {
      // 쉬움 · 보통: 백돌이 다섯 알 직전이면 알려 줌
      threat = !!winMove(WHITE);
      updateHud();
    }
  }

  function runAi() {
    if (state === "paused") {
      setTimeout(runAi, 200);
      return;
    }
    if (state !== "play") {
      aiBusy = false;
      updateHud();
      return;
    }
    const mv = aiMove();
    aiBusy = false;
    if (mv) applyMove(mv.r, mv.c, WHITE);
    updateHud();
  }

  function startGame() {
    SFX.unlock();
    if (window.TodayGameRank) TodayGameRank.reset();
    hideRank();
    state = "play";
    show(overlays.title, false);
    show(overlays.result, false);
    clearBoard();
    resetNewBtn();
    updateHud();
  }

  /* ---------- 그림 도구 ---------- */
  function circle(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, Math.max(0.1, r), 0, TAU);
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function layer(cv) {
    cv.width = Math.round(W * pxScale);
    cv.height = Math.round(H * pxScale);
    const g = cv.getContext("2d");
    g.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    return g;
  }

  function blossom(g, x, y, s, rot, alpha) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.globalAlpha = alpha;
    for (let k = 0; k < 5; k++) {
      g.save();
      g.rotate((k / 5) * TAU);
      const gr = g.createLinearGradient(0, 0, 0, -s);
      gr.addColorStop(0, "#f7a9bd");
      gr.addColorStop(1, "#ffe3ea");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(-s * 0.55, -s * 0.35, -s * 0.45, -s * 0.95, -s * 0.12, -s);
      g.lineTo(0, -s * 0.86);
      g.lineTo(s * 0.12, -s);
      g.bezierCurveTo(s * 0.45, -s * 0.95, s * 0.55, -s * 0.35, 0, 0);
      g.fill();
      g.restore();
    }
    g.fillStyle = "#e0607e";
    circle(g, 0, 0, s * 0.2);
    g.fill();
    g.fillStyle = "#f5c04a";
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.3;
      circle(g, Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3, s * 0.06);
      g.fill();
    }
    g.restore();
  }

  function branch(g, pts, w) {
    g.strokeStyle = "#6b4a3a";
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length - 1; k++) {
      const mx = (pts[k][0] + pts[k + 1][0]) / 2;
      const my = (pts[k][1] + pts[k + 1][1]) / 2;
      g.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
    }
    const e = pts[pts.length - 1];
    g.lineTo(e[0], e[1]);
    g.stroke();
  }

  /* 한지 바탕 + 벚꽃 가지 */
  function buildBg() {
    const g = layer(bgLayer);
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, "#f9f3e8");
    base.addColorStop(0.55, "#f4ebdb");
    base.addColorStop(1, "#eee1ca");
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    const rnd = seeded(7);
    // 닥나무 섬유
    for (let k = 0; k < 520; k++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const len = 3 + rnd() * 11;
      const a = rnd() * Math.PI;
      g.strokeStyle = `rgba(${150 + rnd() * 40},${120 + rnd() * 30},${80 + rnd() * 30},${0.05 + rnd() * 0.08})`;
      g.lineWidth = 0.4 + rnd() * 0.6;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + rnd() * 2, y + Math.sin(a) * len * 0.5 + rnd() * 2, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    for (let k = 0; k < 14; k++) {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, "rgba(255,255,255,0.35)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.save();
      g.translate(rnd() * W, rnd() * H);
      g.scale(30 + rnd() * 60, 20 + rnd() * 40);
      g.fillStyle = gr;
      circle(g, 0, 0, 1);
      g.fill();
      g.restore();
    }
    // 아래쪽 벚꽃 가지
    branch(g, [[-10, 690], [60, 662], [120, 668], [178, 646], [232, 652]], 5);
    branch(g, [[96, 666], [118, 640], [132, 630]], 2.6);
    branch(g, [[178, 646], [196, 624], [204, 612]], 2.2);
    branch(g, [[400, 640], [350, 660], [300, 664], [270, 680]], 4);
    [
      [58, 660, 9, 0.2],
      [132, 628, 8, 1.1],
      [118, 676, 6.5, 0.6],
      [204, 610, 7.5, 2.1],
      [232, 650, 9, 0.9],
      [172, 664, 5.5, 1.7],
      [330, 656, 8.5, 0.4],
      [282, 676, 7, 1.4],
      [372, 642, 6, 2.4],
      [20, 680, 6, 1.9],
    ].forEach(([x, y, s, r]) => blossom(g, x, y, s, r, 0.95));
    // 위쪽 모서리 꽃잎 몇 개 (점수 줄 뒤)
    [
      [360, 70, 6, 0.8],
      [24, 74, 5, 2.2],
    ].forEach(([x, y, s, r]) => blossom(g, x, y, s, r, 0.55));
  }

  /* 원목 바둑판 (결 · 앞면 두께 · 그림자 · 줄 · 화점) */
  function buildBoard() {
    const g = layer(boardLayer);
    const { x, y, size, edge, r } = BOARD;
    // 그림자
    g.save();
    g.shadowColor = "rgba(80,50,20,0.38)";
    g.shadowBlur = 22;
    g.shadowOffsetY = 12;
    roundRect(g, x, y, size, size + edge, r);
    g.fillStyle = "#9a6434";
    g.fill();
    g.restore();
    // 앞면 두께
    roundRect(g, x, y, size, size + edge, r);
    const side = g.createLinearGradient(0, y + size - 4, 0, y + size + edge);
    side.addColorStop(0, "#b47a40");
    side.addColorStop(1, "#7f4f25");
    g.fillStyle = side;
    g.fill();
    // 윗면 나무
    g.save();
    roundRect(g, x, y, size, size, r);
    g.clip();
    const wood = g.createLinearGradient(x, y, x + size, y + size);
    wood.addColorStop(0, "#efcd93");
    wood.addColorStop(0.5, "#e3b878");
    wood.addColorStop(1, "#d6a463");
    g.fillStyle = wood;
    g.fillRect(x, y, size, size);
    const rnd = seeded(31);
    for (let k = 0; k < 64; k++) {
      const y0 = y - 10 + (k / 64) * (size + 20) + (rnd() - 0.5) * 4;
      const a1 = 1.5 + rnd() * 3.5;
      const f1 = 0.008 + rnd() * 0.012;
      const p1 = rnd() * TAU;
      const a2 = 0.6 + rnd() * 1.4;
      const f2 = 0.03 + rnd() * 0.04;
      const p2 = rnd() * TAU;
      g.strokeStyle = `rgba(${140 + rnd() * 30},${85 + rnd() * 25},${40 + rnd() * 15},${0.05 + rnd() * 0.12})`;
      g.lineWidth = 0.5 + rnd() * 1.6;
      g.beginPath();
      for (let px = x - 4; px <= x + size + 4; px += 6) {
        const py = y0 + Math.sin(px * f1 + p1) * a1 + Math.sin(px * f2 + p2) * a2;
        if (px === x - 4) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
    // 빛 · 가장자리
    const sheen = g.createLinearGradient(x, y, x + size * 0.7, y + size * 0.7);
    sheen.addColorStop(0, "rgba(255,255,255,0.22)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sheen;
    g.fillRect(x, y, size, size);
    const vg = g.createRadialGradient(x + size / 2, y + size / 2, size * 0.42, x + size / 2, y + size / 2, size * 0.75);
    vg.addColorStop(0, "rgba(120,70,30,0)");
    vg.addColorStop(1, "rgba(120,70,30,0.18)");
    g.fillStyle = vg;
    g.fillRect(x, y, size, size);
    g.restore();
    // 윗면 테두리
    roundRect(g, x + 0.5, y + 0.5, size - 1, size - 1, r);
    g.strokeStyle = "rgba(255,240,210,0.55)";
    g.lineWidth = 1;
    g.stroke();
    // 줄
    const a = cellXY(0, 0);
    const b = cellXY(SIZE - 1, SIZE - 1);
    g.strokeStyle = "rgba(52,32,14,0.78)";
    g.lineWidth = 1;
    for (let i = 0; i < SIZE; i += 1) {
      const p = cellXY(i, 0);
      const q = cellXY(0, i);
      g.beginPath();
      g.moveTo(a.x, p.y);
      g.lineTo(b.x, p.y);
      g.moveTo(q.x, a.y);
      g.lineTo(q.x, b.y);
      g.stroke();
    }
    g.lineWidth = 1.8;
    g.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    // 화점
    g.fillStyle = "rgba(52,32,14,0.85)";
    [
      [3, 3],
      [3, 11],
      [11, 3],
      [11, 11],
      [7, 7],
    ].forEach(([rr, cc]) => {
      const p = cellXY(rr, cc);
      circle(g, p.x, p.y, 2.9);
      g.fill();
    });
  }

  /* 돌 그림 (한 번만 그려 두고 찍어 씀) */
  function buildStones() {
    const k = pxScale * 1.3; // 내려앉을 때 커져도 또렷하게
    const R = STONE_R;
    const size = Math.ceil((R * 2 + 6) * k);
    const make = (color) => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const g = cv.getContext("2d");
      g.setTransform(k, 0, 0, k, (size / 2) | 0, (size / 2) | 0);
      if (color === BLACK) {
        const gr = g.createRadialGradient(-R * 0.36, -R * 0.42, R * 0.05, 0, 0, R * 1.05);
        gr.addColorStop(0, "#6d6d74");
        gr.addColorStop(0.22, "#34343a");
        gr.addColorStop(0.68, "#151518");
        gr.addColorStop(1, "#08080a");
        g.fillStyle = gr;
        circle(g, 0, 0, R);
        g.fill();
        // 판에서 비친 따뜻한 빛
        g.strokeStyle = "rgba(255,200,140,0.14)";
        g.lineWidth = R * 0.12;
        g.beginPath();
        g.arc(0, 0, R * 0.9, 0.2, 1.6);
        g.stroke();
        const sp = g.createRadialGradient(-R * 0.38, -R * 0.42, 0, -R * 0.38, -R * 0.42, R * 0.42);
        sp.addColorStop(0, "rgba(255,255,255,0.42)");
        sp.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = sp;
        circle(g, -R * 0.38, -R * 0.42, R * 0.42);
        g.fill();
      } else {
        const gr = g.createRadialGradient(-R * 0.32, -R * 0.38, R * 0.05, 0, 0, R * 1.05);
        gr.addColorStop(0, "#ffffff");
        gr.addColorStop(0.45, "#f6f2ea");
        gr.addColorStop(0.85, "#ddd5c6");
        gr.addColorStop(1, "#c7bda9");
        g.fillStyle = gr;
        circle(g, 0, 0, R);
        g.fill();
        // 조개 결
        g.save();
        circle(g, 0, 0, R);
        g.clip();
        g.strokeStyle = "rgba(170,150,120,0.13)";
        g.lineWidth = 0.7;
        for (let i = -3; i <= 3; i++) {
          g.beginPath();
          g.arc(0, R * 2.2, R * 1.7 + i * R * 0.22, Math.PI * 1.32, Math.PI * 1.68);
          g.stroke();
        }
        g.restore();
        g.strokeStyle = "rgba(120,100,70,0.35)";
        g.lineWidth = 0.8;
        circle(g, 0, 0, R - 0.3);
        g.stroke();
        const sp = g.createRadialGradient(-R * 0.36, -R * 0.42, 0, -R * 0.36, -R * 0.42, R * 0.45);
        sp.addColorStop(0, "rgba(255,255,255,0.95)");
        sp.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = sp;
        circle(g, -R * 0.36, -R * 0.42, R * 0.45);
        g.fill();
      }
      return cv;
    };
    const sh = document.createElement("canvas");
    sh.width = sh.height = size;
    const g = sh.getContext("2d");
    g.setTransform(k, 0, 0, k, (size / 2) | 0, (size / 2) | 0);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.15);
    gr.addColorStop(0, "rgba(60,35,12,0.55)");
    gr.addColorStop(0.6, "rgba(60,35,12,0.28)");
    gr.addColorStop(1, "rgba(60,35,12,0)");
    g.fillStyle = gr;
    circle(g, 0, 0, R * 1.15);
    g.fill();
    stoneSprites[BLACK] = make(BLACK);
    stoneSprites[WHITE] = make(WHITE);
    stoneSprites.shadow = sh;
    stoneSprites.scale = k;
  }

  /* ---------- 움직이는 그림 ---------- */
  function newPetal(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : -12,
      s: 3 + Math.random() * 3.5,
      vy: 10 + Math.random() * 14,
      sway: Math.random() * TAU,
      rot: Math.random() * TAU,
      vr: -0.8 + Math.random() * 1.6,
    };
  }

  function spark(x, y, color, speed) {
    const a = Math.random() * TAU;
    const sp = speed * (0.4 + Math.random() * 0.8);
    return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.6 + Math.random() * 0.5, max: 1.1, color, s: 2 + Math.random() * 2.5, petal: Math.random() < 0.5, rot: Math.random() * TAU };
  }

  function burstAlongLine() {
    if (!winLine) return;
    for (const cell of winLine) {
      const p = cellXY(cell.r, cell.c);
      for (let k = 0; k < 6; k++) sparks.push(spark(p.x, p.y, k % 2 ? "#f7a9bd" : "#f2c55c", 150));
    }
  }

  function drawPetals(g, dt) {
    for (const p of petals) {
      p.y += p.vy * dt;
      p.sway += dt * 1.4;
      p.x += Math.sin(p.sway) * 12 * dt;
      p.rot += p.vr * dt;
      if (p.y > H + 12) Object.assign(p, newPetal(false));
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.scale(1, 0.55 + 0.35 * Math.sin(p.sway * 1.7));
      g.fillStyle = "rgba(247,169,189,0.75)";
      g.beginPath();
      g.moveTo(0, -p.s);
      g.quadraticCurveTo(p.s * 0.9, 0, 0, p.s);
      g.quadraticCurveTo(-p.s * 0.9, 0, 0, -p.s);
      g.fill();
      g.restore();
    }
  }

  function drawStone(g, r, c, color, alpha) {
    const p = cellXY(r, c);
    const k = stoneSprites.scale;
    const spr = stoneSprites[color];
    const size = spr.width / k;
    const t0 = drops.get(r * SIZE + c);
    let lift = 0;
    let sc = 1;
    if (t0 !== undefined) {
      const e = Math.min(1, (t - t0) / 0.22);
      lift = (1 - e) * (1 - e) * 10;
      sc = 1 + (1 - e) * 0.18 - Math.sin(e * Math.PI) * 0.03;
      if (e >= 1) drops.delete(r * SIZE + c);
    }
    g.globalAlpha = alpha * (0.85 - lift * 0.03);
    g.drawImage(stoneSprites.shadow, p.x + 1.6 + lift * 0.4 - size / 2, p.y + 2.6 + lift * 0.6 - size / 2, size, size);
    g.globalAlpha = alpha;
    const s2 = size * sc;
    g.drawImage(spr, p.x - s2 / 2, p.y - lift - s2 / 2, s2, s2);
    g.globalAlpha = 1;
  }

  function drawAim(g) {
    if (!aim || state !== "play" || turn !== BLACK || aiBusy) return;
    const { r, c } = aim;
    if (board[r][c] !== EMPTY) return;
    const p = cellXY(r, c);
    const a = cellXY(0, 0);
    const b = cellXY(SIZE - 1, SIZE - 1);
    // 가로 · 세로 안내선 (손가락에 가려도 보이게)
    g.strokeStyle = "rgba(212,72,59,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(a.x, p.y);
    g.lineTo(b.x, p.y);
    g.moveTo(p.x, a.y);
    g.lineTo(p.x, b.y);
    g.stroke();
    drawStone(g, r, c, BLACK, 0.5);
    g.strokeStyle = "rgba(212,72,59,0.8)";
    g.lineWidth = 2;
    circle(g, p.x, p.y, STONE_R + 3);
    g.stroke();
  }

  function drawWin(g) {
    if (!winLine || winLine.length < 5) return;
    const sorted = winLine.slice().sort((p, q) => p.r - q.r || p.c - q.c);
    const a = cellXY(sorted[0].r, sorted[0].c);
    const b = cellXY(sorted[sorted.length - 1].r, sorted[sorted.length - 1].c);
    const e = Math.min(1, (t - winAt) / 0.55);
    const ease = 1 - (1 - e) ** 3;
    const ex = a.x + (b.x - a.x) * ease;
    const ey = a.y + (b.y - a.y) * ease;
    const gold = winColor === BLACK;
    g.save();
    g.lineCap = "round";
    g.shadowColor = gold ? "rgba(255,200,80,0.9)" : "rgba(120,170,255,0.8)";
    g.shadowBlur = 14;
    g.strokeStyle = gold ? "rgba(242,190,70,0.75)" : "rgba(140,170,230,0.7)";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(ex, ey);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = "rgba(255,250,225,0.95)";
    g.lineWidth = 2.5;
    g.stroke();
    g.restore();
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    for (const cell of winLine) {
      const p = cellXY(cell.r, cell.c);
      g.strokeStyle = gold ? `rgba(242,190,70,${0.55 + 0.4 * pulse})` : `rgba(140,170,230,${0.5 + 0.4 * pulse})`;
      g.lineWidth = 2.4;
      circle(g, p.x, p.y, STONE_R + 3 + pulse * 1.5);
      g.stroke();
    }
  }

  function render(dt) {
    const g = ctx;
    g.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    g.drawImage(bgLayer, 0, 0, W, H);
    drawPetals(g, dt);
    g.drawImage(boardLayer, 0, 0, W, H);
    // 놓는 자리 물결
    ripples = ripples.filter((rp) => t - rp.t0 < 0.5);
    for (const rp of ripples) {
      const e = (t - rp.t0) / 0.5;
      g.strokeStyle = rp.color === BLACK ? `rgba(60,35,12,${0.35 * (1 - e)})` : `rgba(255,250,235,${0.8 * (1 - e)})`;
      g.lineWidth = 1.6;
      circle(g, rp.x, rp.y, STONE_R + 2 + e * 12);
      g.stroke();
    }
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (board[r][c] !== EMPTY) drawStone(g, r, c, board[r][c], 1);
      }
    }
    // 마지막 수 표시 (작은 붉은 점)
    if (lastMove && !winLine) {
      const p = cellXY(lastMove.r, lastMove.c);
      const t0 = drops.get(lastMove.r * SIZE + lastMove.c);
      if (t0 === undefined) {
        g.fillStyle = "#e0483e";
        circle(g, p.x, p.y, 3.1);
        g.fill();
        g.strokeStyle = board[lastMove.r][lastMove.c] === BLACK ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.9)";
        g.lineWidth = 1;
        g.stroke();
      }
    }
    drawWin(g);
    drawAim(g);
    // 반짝이 · 꽃잎
    for (const s of sparks) {
      s.vy += 160 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += dt * 4;
      s.life -= dt;
      g.globalAlpha = Math.max(0, Math.min(1, s.life / 0.4));
      g.fillStyle = s.color;
      if (s.petal) {
        g.save();
        g.translate(s.x, s.y);
        g.rotate(s.rot);
        g.beginPath();
        g.ellipse(0, 0, s.s * 1.3, s.s * 0.7, 0, 0, TAU);
        g.fill();
        g.restore();
      } else {
        circle(g, s.x, s.y, s.s * 0.6);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    sparks = sparks.filter((s) => s.life > 0);
  }

  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    if (state === "paused") {
      render(0);
      return;
    }
    t += dt;
    if (state === "ending") {
      endT -= dt;
      if (endT <= 0) showResult();
    }
    if (newConfirmT > 0) {
      newConfirmT -= dt;
      if (newConfirmT <= 0) resetNewBtn();
    }
    render(dt);
  }

  /* ---------- 누르기: 누른 채 움직여 자리를 고르고, 떼면 놓음 ---------- */
  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function cellAt(e) {
    const p = canvasPos(e);
    const c = Math.round((p.x - ORIGIN.x) / CELL);
    const r = Math.round((p.y - ORIGIN.y) / CELL);
    if (!inBounds(r, c)) return null;
    const q = cellXY(r, c);
    if (Math.hypot(p.x - q.x, p.y - q.y) > CELL * 0.75) return null;
    return { r, c };
  }

  function myTurn() {
    return state === "play" && turn === BLACK && !aiBusy;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!myTurn()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    SFX.unlock();
    aiming = true;
    aim = cellAt(e);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
  });
  canvas.addEventListener("pointermove", (e) => {
    if (aiming || e.pointerType === "mouse") aim = myTurn() ? cellAt(e) : null;
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!aiming) return;
    aiming = false;
    const cell = cellAt(e) || aim;
    if (e.pointerType !== "mouse") aim = null;
    if (!cell || !myTurn() || board[cell.r][cell.c] !== EMPTY) return;
    applyMove(cell.r, cell.c, BLACK);
  });
  canvas.addEventListener("pointercancel", () => {
    aiming = false;
    aim = null;
  });
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse" && !aiming) aim = null;
  });

  /* ---------- 버튼 ---------- */
  function setDiff(d) {
    difficulty = d;
    try {
      localStorage.setItem(DIFF_KEY, d);
    } catch (_) {}
    document.querySelectorAll(".diff-btn").forEach((b) => b.classList.toggle("active", b.dataset.diff === d));
    updateHud();
  }

  document.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.addEventListener("click", () => setDiff(btn.dataset.diff));
  });
  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("change-btn").addEventListener("click", () => {
    state = "title";
    clearBoard();
    show(overlays.result, false);
    show(overlays.title, true);
    updateHud();
  });
  undoBtn.addEventListener("click", undo);
  // 새 판: 실수로 누르지 않게 두 번 눌러야 함
  newBtn.addEventListener("click", () => {
    if (state !== "play") return;
    if (history.length < 2 || newConfirmT > 0) {
      startGame();
      return;
    }
    newConfirmT = 2.2;
    newBtn.classList.add("confirm");
    newBtn.textContent = "한 번 더 누르면 새 판";
  });

  /* ---------- 시작 ---------- */
  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(3, Math.max(1, (window.devicePixelRatio || 1) * ((rect.width || W) / W)));
    if (Math.abs(scale - pxScale) < 0.01 && canvas.width === Math.round(W * scale) && stoneSprites.scale) return;
    pxScale = scale;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    buildBg();
    buildBoard();
    buildStones();
  }
  window.addEventListener("resize", fitCanvas);

  clearBoard();
  setDiff(difficulty);
  fitCanvas();
  updateHud();
  requestAnimationFrame(loop);

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "omok",
      gameTitle: "오목",
      formParent: overlays.result.querySelector(".result-card") || overlays.result,
    });
  }

  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        state = "paused";
        aim = null;
        aiming = false;
        updateHud();
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "play";
        last = performance.now();
        updateHud();
        return true;
      },
    });
    // 공용 '일시정지' 버튼을 판 아래 버튼 줄로
    const pb = document.getElementById("today-pause-btn");
    if (pb && el.actions) el.actions.insertBefore(pb, el.actions.firstChild);
  }

  // 화면 점검용 (주소에 ?test=1 일 때만): 칸 좌표
  if (/[?&]test=1\b/.test(location.search)) {
    window.__omok = {
      cell: (r, c) => cellXY(r, c),
      get state() {
        return state;
      },
      get history() {
        return history.slice();
      },
      setBoard(moves) {
        clearBoard();
        for (const [r, c, color] of moves) {
          board[r][c] = color;
          history.push({ r, c, color });
          lastMove = { r, c };
        }
        updateHud();
      },
    };
  }
})();
