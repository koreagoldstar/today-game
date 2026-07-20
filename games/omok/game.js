(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const PAD = 28;
  const BOARD_PX = W - PAD * 2;
  const CELL = BOARD_PX / (SIZE - 1);
  const ORIGIN = { x: PAD, y: 118 };

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
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const overlays = {
    title: document.getElementById("title"),
    result: document.getElementById("result"),
  };
  const undoBtn = document.getElementById("undo-btn");
  const sprites = { black: null, white: null };

  function isPunchBg(r, g, b, a) {
    if (a < 28) return true;
    if (r > 220 && g < 40 && b > 220) return true;
    if (r > 185 && b > 175 && g < 145 && r + b > g * 2.1) return true;
    if (r > 210 && b > 200 && g < 160 && Math.abs(r - b) < 90) return true;
    if (r > 220 && g > 160 && b > 190 && r > g + 20 && b > g + 10 && (r + g + b) / 3 > 195) return true;
    if (r > 230 && g > 190 && b > 210 && Math.abs(r - b) < 50) return true;
    return false;
  }

  function punchBg(img) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (isPunchBg(d[i], d[i + 1], d[i + 2], d[i + 3])) d[i + 3] = 0;
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadAssets() {
    const [black, white] = await Promise.all([
      loadImg("assets/stone-black.png"),
      loadImg("assets/stone-white.png"),
    ]);
    if (black) sprites.black = punchBg(black);
    if (white) sprites.white = punchBg(white);
  }

  let board = [];
  let state = "title";
  let difficulty = "normal";
  let turn = BLACK;
  let lastMove = null;
  let history = [];
  let winLine = null;
  let aiBusy = false;
  let hoverCell = null;
  let pulse = 0;
  let last = 0;
  let raf = 0;
  const petals = Array.from({ length: 14 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: 3 + Math.random() * 4,
    vy: 8 + Math.random() * 16,
    vx: -6 + Math.random() * 12,
    rot: Math.random() * Math.PI * 2,
    vr: -0.6 + Math.random() * 1.2,
  }));

  function show(el, on) {
    el.classList.toggle("hidden", !on);
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
    turn = BLACK;
    aiBusy = false;
  }

  function updateHud() {
    const diffLabel = { easy: "쉬움", normal: "보통", hard: "어려움" }[difficulty];
    document.getElementById("hud-diff").textContent = `난이도: ${diffLabel}`;
    if (state !== "play") {
      document.getElementById("hud-turn").textContent = "대기 중";
    } else if (aiBusy) {
      document.getElementById("hud-turn").textContent = "백돌 생각 중…";
    } else {
      document.getElementById("hud-turn").textContent = turn === BLACK ? "흑돌(나) 차례" : "백돌 차례";
    }
    undoBtn.disabled = state !== "play" || history.length < 2 || aiBusy || turn !== BLACK;
  }

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
  }

  function undo() {
    if (history.length < 2 || aiBusy) return;
    for (let i = 0; i < 2; i += 1) {
      const mv = history.pop();
      if (mv) board[mv.r][mv.c] = EMPTY;
    }
    lastMove = history.length ? { r: history[history.length - 1].r, c: history[history.length - 1].c } : null;
    turn = BLACK;
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

  function endGame(winner, r, c, color) {
    state = "result";
    winLine = findWinningLine(r, c, color);
    show(overlays.result, true);
    if (winner === BLACK) {
      const score = Math.max(1, 5000 - history.length * 10);
      document.getElementById("result-badge").textContent = "WIN";
      document.getElementById("result-title").textContent = "승리!";
      document.getElementById("result-detail").textContent = `다섯 알을 먼저 연결했어요 · 점수 ${score}`;
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "omok", gameTitle: "오목", formParent: overlays.result });
      TodayGameRank.open(score);
    }
    } else {
      document.getElementById("result-badge").textContent = "LOSE";
      document.getElementById("result-title").textContent = "패배…";
      document.getElementById("result-detail").textContent = "AI가 먼저 다섯 알을 놓았어요";
    }
    updateHud();
  }

  function applyMove(r, c, color) {
    place(r, c, color);
    if (checkWin(r, c, color)) {
      endGame(color, r, c, color);
      return;
    }
    // 보드가 가득 차면 무승부
    if (history.length >= SIZE * SIZE) {
      state = "result";
      show(overlays.result, true);
      document.getElementById("result-badge").textContent = "DRAW";
      document.getElementById("result-title").textContent = "무승부!";
      document.getElementById("result-detail").textContent = "더 이상 둘 곳이 없어요";
      updateHud();
      return;
    }
    turn = color === BLACK ? WHITE : BLACK;
    updateHud();
    if (state === "play" && turn === WHITE) {
      aiBusy = true;
      updateHud();
      setTimeout(() => {
        if (state !== "play") {
          aiBusy = false;
          return;
        }
        const mv = aiMove();
        if (mv) applyMove(mv.r, mv.c, WHITE);
        aiBusy = false;
        updateHud();
      }, 380);
    }
  }

  function drawBoard() {
    const wood = ctx.createLinearGradient(0, ORIGIN.y - 20, 0, ORIGIN.y + BOARD_PX + 20);
    wood.addColorStop(0, "#D4A060");
    wood.addColorStop(0.45, "#C48E4D");
    wood.addColorStop(1, "#9A6838");
    ctx.fillStyle = wood;
    ctx.fillRect(PAD - 14, ORIGIN.y - 18, BOARD_PX + 28, BOARD_PX + 36);
    ctx.strokeStyle = "rgba(60, 36, 16, 0.35)";
    ctx.lineWidth = 4;
    ctx.strokeRect(PAD - 12, ORIGIN.y - 16, BOARD_PX + 24, BOARD_PX + 32);

    // subtle grain
    ctx.strokeStyle = "rgba(80, 48, 20, 0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
      const gy = ORIGIN.y + (BOARD_PX * i) / 7;
      ctx.beginPath();
      ctx.moveTo(PAD - 8, gy);
      ctx.lineTo(PAD + BOARD_PX + 8, gy + 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(40, 24, 10, 0.62)";
    ctx.lineWidth = 1.15;
    for (let i = 0; i < SIZE; i += 1) {
      const p0 = cellXY(i, 0);
      const p1 = cellXY(i, SIZE - 1);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      const q0 = cellXY(0, i);
      const q1 = cellXY(SIZE - 1, i);
      ctx.beginPath();
      ctx.moveTo(q0.x, q0.y);
      ctx.lineTo(q1.x, q1.y);
      ctx.stroke();
    }

    [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]].forEach(([r, c]) => {
      const p = cellXY(r, c);
      ctx.fillStyle = "rgba(40,24,10,0.7)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawStone(r, c, color, highlight) {
    const p = cellXY(r, c);
    const rad = CELL * 0.42;
    const spr = color === BLACK ? sprites.black : sprites.white;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    if (spr) {
      const size = rad * 2.15;
      ctx.drawImage(spr, p.x - size / 2, p.y - size / 2, size, size);
    } else {
      const grad = ctx.createRadialGradient(
        p.x - rad * 0.35,
        p.y - rad * 0.35,
        rad * 0.1,
        p.x,
        p.y,
        rad
      );
      if (color === BLACK) {
        grad.addColorStop(0, "#555");
        grad.addColorStop(0.35, "#1a1410");
        grad.addColorStop(1, "#000");
      } else {
        grad.addColorStop(0, "#fff");
        grad.addColorStop(0.4, "#f0f0f0");
        grad.addColorStop(1, "#c8c8c8");
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    if (highlight) {
      const win = winLine && winLine.some((cell) => cell.r === r && cell.c === c);
      ctx.strokeStyle = win ? "#FFD700" : color === BLACK ? "#ffd76a" : "#ff8844";
      ctx.lineWidth = win ? 3.2 : 2.5;
      ctx.shadowColor = win ? "rgba(255, 215, 0, 0.85)" : "transparent";
      ctx.shadowBlur = win ? 14 : 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad + 3 + Math.sin(pulse * 4) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      if (!win) {
        ctx.fillStyle = color === BLACK ? "#fff" : "#333";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawHover() {
    if (!hoverCell || state !== "play" || turn !== BLACK || aiBusy) return;
    const { r, c } = hoverCell;
    if (board[r][c] !== EMPTY) return;
    const p = cellXY(r, c);
    ctx.globalAlpha = 0.35;
    drawStone(r, c, BLACK, false);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, CELL * 0.42 + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawWinLine() {
    if (!winLine || winLine.length < 5) return;
    ctx.save();
    const sorted = winLine.slice().sort((a, b) => a.r - b.r || a.c - b.c);
    const a = cellXY(sorted[0].r, sorted[0].c);
    const b = cellXY(sorted[sorted.length - 1].r, sorted[sorted.length - 1].c);
    ctx.strokeStyle = "rgba(255, 215, 0, 0.55)";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(255, 220, 80, 0.95)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 250, 200, 0.9)";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // sparkles
    for (let i = 0; i < 8; i += 1) {
      const t = (i + pulse * 0.4) % 1;
      const sx = a.x + (b.x - a.x) * t;
      const sy = a.y + (b.y - a.y) * t;
      ctx.fillStyle = `rgba(255,250,200,${0.4 + 0.5 * Math.sin(pulse * 6 + i)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPetals(dt) {
    petals.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > H + 10) {
        p.y = -10;
        p.x = Math.random() * W;
      }
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = "rgba(255, 180, 200, 0.55)";
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function render() {
    const table = ctx.createLinearGradient(0, 0, 0, H);
    table.addColorStop(0, "#3A2818");
    table.addColorStop(0.5, "#2A2018");
    table.addColorStop(1, "#1A1410");
    ctx.fillStyle = table;
    ctx.fillRect(0, 0, W, H);
    drawPetals(1 / 60);
    drawBoard();
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (board[r][c] !== EMPTY) {
          const hl = lastMove && lastMove.r === r && lastMove.c === c;
          const win = winLine && winLine.some((p) => p.r === r && p.c === c);
          drawStone(r, c, board[r][c], hl || win);
        }
      }
    }
    drawWinLine();
    drawHover();
    ctx.font = '15px "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,240,220,0.85)";
    ctx.fillText("흑돌 · 나", PAD + 36, ORIGIN.y + BOARD_PX + 52);
    ctx.fillText("백돌 · AI", W - PAD - 36, ORIGIN.y + BOARD_PX + 52);
  }

  function loop(now) {
    pulse += (now - last) / 1000;
    last = now;
    render();
    raf = requestAnimationFrame(loop);
  }

  function posToCell(x, y) {
    let best = null;
    let bestD = CELL * 0.55;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const p = cellXY(r, c);
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < bestD) {
          bestD = d;
          best = { r, c };
        }
      }
    }
    return best;
  }

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function onTap(e) {
    if (state !== "play" || turn !== BLACK || aiBusy) return;
    e.preventDefault();
    const p = canvasPos(e);
    const cell = posToCell(p.x, p.y);
    if (!cell || board[cell.r][cell.c] !== EMPTY) return;
    applyMove(cell.r, cell.c, BLACK);
  }

  function onMove(e) {
    if (state !== "play") {
      hoverCell = null;
      return;
    }
    const p = canvasPos(e);
    hoverCell = posToCell(p.x, p.y);
  }

  function startGame() {
    if (window.TodayGameRank) TodayGameRank.reset();
    state = "play";
    show(overlays.title, false);
    show(overlays.result, false);
    clearBoard();
    updateHud();
  }

  document.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".diff-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      difficulty = btn.dataset.diff;
      updateHud();
    });
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  undoBtn.addEventListener("click", undo);

  canvas.addEventListener("pointerdown", onTap);
  canvas.addEventListener("pointermove", onMove);

  clearBoard();
  updateHud();
  loadAssets();
  raf = requestAnimationFrame(loop);

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "omok",
      gameTitle: "오목",
      formParent: overlays.result || document.body,
    });
  }
})();
