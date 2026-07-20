(() => {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const CELL = 36;
  const W = COLS * CELL;
  const H = ROWS * CELL;

  const COLORS = {
    I: { fill: "#7cf0ff", deep: "#3aa8d4", light: "#e8fbff" },
    O: { fill: "#ffe27a", deep: "#e0b040", light: "#fff8d4" },
    T: { fill: "#d4a0ff", deep: "#9b6ed4", light: "#f3e6ff" },
    S: { fill: "#b5ff9a", deep: "#6fc86a", light: "#eaffdf" },
    Z: { fill: "#ff8ab5", deep: "#e04f84", light: "#ffe0ee" },
    J: { fill: "#7eb8ff", deep: "#4a7fd4", light: "#e0efff" },
    L: { fill: "#ffb347", deep: "#e08820", light: "#ffe8c4" },
  };

  const EVENT_COLORS = {
    bomb: { fill: "#ff5a4a", deep: "#b82820", light: "#ffc4bc" },
    gold: { fill: "#ffd24a", deep: "#c99210", light: "#fff3b8" },
    stone: { fill: "#9aa3b2", deep: "#5c6574", light: "#d8dde6" },
    rainbow: { fill: "#ff7ad9", deep: "#6b7cff", light: "#fff" },
  };

  const EVENTS = ["bomb", "gold", "stone", "rainbow"];
  const EVENT_CHANCE = 0.12;

  const SHAPES = {
    I: [
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
      ],
    ],
    O: [
      [
        [1, 1],
        [1, 1],
      ],
    ],
    T: [
      [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 1, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    ],
    S: [
      [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 0, 1],
      ],
    ],
    Z: [
      [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
    ],
    J: [
      [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 1],
        [0, 1, 0],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 1],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
    ],
    L: [
      [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [1, 0, 0],
      ],
      [
        [1, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
      ],
    ],
  };

  const TYPES = Object.keys(SHAPES);
  const LINE_SCORES = [0, 100, 300, 500, 800];
  const TOTAL_STAGES = 50;
  const BEST_KEY = "tetris-stage-best";

  const STAGE_NAMES = [
    "젤리 입문", "첫 줄 연습", "솜사탕 낙하", "핑크 퍼즐", "하늘 블록",
    "달콤 콤보", "반짝 라인", "구름 쌓기", "캔디 탑", "젤리 질주",
    "무지개 줄", "하트 테트리스", "별빛 낙하", "솜뭉치 챌린지", "스위트 스택",
    "네온 젤리", "빠른 낙하", "라인 파티", "블록 축제", "핑크 스톰",
    "슈퍼 콤보", "하늘 미로", "젤리 요새", "더블 라인", "트리플 점프",
    "테트리스 비", "스피드 캔디", "블록 레이스", "달콤 시련", "마스터 입문",
    "하이퍼 낙하", "라인 폭풍", "젤리 결전", "무지개 질주", "콤보 왕국",
    "초고속 스택", "핑크 레전드", "별가루 테트리스", "최종 연습", "챔피언 코스",
    "슈퍼노바 줄", "젤리 신화", "무한 낙하", "블록 황제", "스위트 결전",
    "네온 마스터", "최종 폭풍", "왕관 라인", "전설의 스택", "블록 신화",
  ];

  const STAGES = Array.from({ length: TOTAL_STAGES }, (_, i) => {
    const t = i / Math.max(1, TOTAL_STAGES - 1);
    return {
      name: STAGE_NAMES[i] || `스테이지 ${i + 1}`,
      goal: Math.round(6 + t * 16),
      speed: 1 + Math.floor(i * 0.34),
    };
  });

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;
  const nextCanvas = document.getElementById("next");
  const nextCtx = nextCanvas.getContext("2d");
  const holdCanvas = document.getElementById("hold");
  const holdCtx = holdCanvas.getContext("2d");

  const blockImgs = {};
  let blocksReady = false;

  function loadBlockAssets() {
    return Promise.all(
      TYPES.map(
        (t) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              blockImgs[t] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `assets/block_${t}.png`;
          })
      )
    ).then(() => {
      blocksReady = TYPES.some((t) => blockImgs[t]);
    });
  }

  const overlays = {
    title: document.getElementById("title"),
    paused: document.getElementById("paused"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  const rankPanel = document.getElementById("rank-panel");
  const rankName = document.getElementById("rank-name");
  const rankBtn = document.getElementById("rank-btn");
  const rankMsg = document.getElementById("rank-msg");
  const shareRankBtn = document.getElementById("share-rank-btn");
  let lastRank = { rankDay: null, rankWeek: null };

  let state = "title";
  let gameMode = "stage"; // "stage" | "endless"
  let stageIndex = 0;
  let board = [];
  let bag = [];
  let current = null;
  let nextPiece = null;
  let holdPiece = null;
  let canHold = true;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || "0");
  let stageLines = 0;
  let totalLines = 0;
  let endlessLevel = 1;
  let combo = 0;
  let dropAcc = 0;
  let lockAcc = 0;
  let softDropping = false;
  let last = 0;
  let raf = 0;
  let clearFx = [];
  let particles = [];
  let flash = 0;
  let keys = { left: false, right: false, soft: false };
  let dasAcc = 0;
  let dasDir = 0;
  let dasArmed = false;
  let stageClearPending = false;
  let rankSubmitted = false;

  function showOverlay(key) {
    Object.entries(overlays).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", k !== key);
    });
  }

  function currentStage() {
    return STAGES[stageIndex];
  }

  function getSpeed() {
    if (gameMode === "endless") return endlessLevel;
    return currentStage().speed;
  }

  function syncEndlessLevel() {
    endlessLevel = Math.min(20, 1 + Math.floor(totalLines / 10));
  }

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function cellColor(cell) {
    if (!cell) return null;
    if (cell.ev && EVENT_COLORS[cell.ev]) return EVENT_COLORS[cell.ev];
    return COLORS[cell.t];
  }

  function rollEvent() {
    // 무한 모드는 일반 블록만
    if (gameMode === "endless") return null;
    if (Math.random() >= EVENT_CHANCE) return null;
    return EVENTS[Math.floor(Math.random() * EVENTS.length)];
  }

  function refillBag() {
    const shuffled = [...TYPES];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    bag.push(...shuffled.map((type) => ({ type, ev: rollEvent() })));
  }

  function takeFromBag() {
    if (bag.length < 7) refillBag();
    return bag.shift();
  }

  function makePiece(spec) {
    const type = typeof spec === "string" ? spec : spec.type;
    const ev = typeof spec === "string" ? rollEvent() : spec.ev || null;
    return {
      type,
      ev,
      rot: 0,
      x: type === "O" ? 4 : 3,
      y: 0,
    };
  }

  function matrixOf(piece) {
    const mats = SHAPES[piece.type];
    return mats[piece.rot % mats.length];
  }

  function cellsOf(piece, ox = piece.x, oy = piece.y, rot = piece.rot) {
    const mats = SHAPES[piece.type];
    const m = mats[rot % mats.length];
    const cells = [];
    for (let r = 0; r < m.length; r += 1) {
      for (let c = 0; c < m[r].length; c += 1) {
        if (m[r][c]) cells.push({ x: ox + c, y: oy + r });
      }
    }
    return cells;
  }

  function fits(piece, ox = piece.x, oy = piece.y, rot = piece.rot) {
    return cellsOf(piece, ox, oy, rot).every((p) => {
      if (p.x < 0 || p.x >= COLS || p.y >= ROWS) return false;
      if (p.y < 0) return true;
      return !board[p.y][p.x];
    });
  }

  function ghostY(piece) {
    let y = piece.y;
    while (fits(piece, piece.x, y + 1, piece.rot)) y += 1;
    return y;
  }

  function setModeUi() {
    const isEndless = gameMode === "endless";
    document.querySelectorAll(".stage-only").forEach((el) => {
      el.classList.toggle("hidden", isEndless);
    });
    document.querySelectorAll(".endless-only").forEach((el) => {
      el.classList.toggle("hidden", !isEndless);
    });
    document.getElementById("mode-text").textContent = isEndless ? "무한" : "50단계";
  }

  function spawn() {
    if (stageClearPending || state !== "play") return false;
    const next = nextPiece || takeFromBag();
    nextPiece = takeFromBag();
    current = makePiece(next);
    canHold = true;
    lockAcc = 0;
    if (!fits(current)) {
      endGame();
      return false;
    }
    drawSide();
    return true;
  }

  function updateHud() {
    setModeUi();
    document.getElementById("stage-num").textContent = String(stageIndex + 1);
    document.getElementById("stage-total").textContent = String(TOTAL_STAGES);
    document.getElementById("score").textContent = String(score);
    document.getElementById("combo").textContent = String(combo);

    if (gameMode === "endless") {
      syncEndlessLevel();
      document.getElementById("endless-level").textContent = String(endlessLevel);
      document.getElementById("endless-lines").textContent = String(totalLines);
      document.getElementById("stage-name").textContent = `무한 스코어 · Lv.${endlessLevel}`;
    } else {
      const st = currentStage();
      document.getElementById("goal-lines").textContent = String(Math.min(stageLines, st.goal));
      document.getElementById("goal-need").textContent = String(st.goal);
      document.getElementById("level").textContent = String(st.speed);
      document.getElementById("stage-name").textContent = st.name;
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
      }
    }
  }

  function dropInterval() {
    const speed = getSpeed();
    return Math.max(0.08, 0.88 - (speed - 1) * 0.045);
  }

  function applyGravity() {
    for (let x = 0; x < COLS; x += 1) {
      const stack = [];
      for (let y = 0; y < ROWS; y += 1) {
        if (board[y][x]) stack.push(board[y][x]);
      }
      for (let y = 0; y < ROWS; y += 1) board[y][x] = null;
      let y = ROWS - 1;
      while (stack.length) {
        board[y][x] = stack.pop();
        y -= 1;
      }
    }
  }

  function explodeBombs(origins) {
    if (!origins.length) return false;
    const kill = new Set();
    origins.forEach(({ x, y }) => {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
          kill.add(`${nx},${ny}`);
        }
      }
    });
    kill.forEach((key) => {
      const [x, y] = key.split(",").map(Number);
      const cell = board[y][x];
      if (!cell) return;
      burst(x * CELL + CELL / 2, y * CELL + CELL / 2, cellColor(cell).fill);
      board[y][x] = null;
    });
    applyGravity();
    flash = Math.max(flash, 0.18);
    return kill.size > 0;
  }

  function clearRowsByIndex(rows, opts = {}) {
    const unique = [...new Set(rows)].filter((y) => y >= 0 && y < ROWS).sort((a, b) => a - b);
    if (!unique.length) return 0;

    let goldBonus = 0;
    const speed = getSpeed();

    unique.forEach((y) => {
      clearFx.push({ y, life: 0.28 });
      for (let x = 0; x < COLS; x += 1) {
        const cell = board[y][x];
        if (!cell) continue;
        if (cell.ev === "gold") goldBonus += 200 * speed;
        burst(x * CELL + CELL / 2, y * CELL + CELL / 2, cellColor(cell).fill);
      }
    });

    board = board.filter((_, y) => !unique.includes(y));
    while (board.length < ROWS) board.unshift(Array(COLS).fill(null));

    const n = unique.length;
    if (!opts.skipCombo) combo += 1;
    const base = opts.baseScore != null ? opts.baseScore : LINE_SCORES[Math.min(n, 4)] * speed;
    const bonus = !opts.skipCombo && combo > 1 ? (combo - 1) * 50 * speed : 0;
    score += base + bonus + goldBonus;
    stageLines += n;
    totalLines += n;
    if (gameMode === "endless") syncEndlessLevel();
    flash = Math.max(flash, 0.22);
    return n;
  }

  function clearRainbowRows() {
    const rows = [];
    for (let y = 0; y < ROWS; y += 1) {
      if (board[y].some((c) => c && c.ev === "rainbow")) rows.push(y);
    }
    if (!rows.length) return 0;
    const speed = getSpeed();
    // 무지개: 줄이 꽉 차지 않아도 즉시 제거 + 보너스
    return clearRowsByIndex(rows, {
      baseScore: 150 * rows.length * speed,
      skipCombo: false,
    });
  }

  function clearFullLines() {
    const full = [];
    for (let y = 0; y < ROWS; y += 1) {
      if (board[y].every((c) => c)) full.push(y);
    }
    if (!full.length) return 0;
    return clearRowsByIndex(full);
  }

  function lockPiece() {
    if (!current || stageClearPending) return;
    const locked = cellsOf(current).filter((p) => p.y >= 0);
    const bombOrigins = [];

    locked.forEach((p) => {
      board[p.y][p.x] = { t: current.type, ev: current.ev || null };
      if (current.ev === "bomb") bombOrigins.push({ x: p.x, y: p.y });
    });

    const pieceEv = current.ev;
    current = null;

    let cleared = 0;
    if (pieceEv === "bomb") explodeBombs(bombOrigins);
    if (pieceEv === "rainbow") cleared += clearRainbowRows();
    cleared += clearFullLines();
    if (!cleared) combo = 0;

    updateHud();

    if (gameMode === "stage") {
      const st = currentStage();
      if (stageLines >= st.goal) {
        finishStage();
        return;
      }
    }

    if (!stageClearPending) spawn();
  }

  function finishStage() {
    stageClearPending = true;
    current = null;
    state = "clear";
    cancelAnimationFrame(raf);
    const st = currentStage();
    document.getElementById("clear-detail").textContent =
      `${st.name} · 목표 ${st.goal}줄 · 점수 ${score}`;
    if (stageIndex >= TOTAL_STAGES - 1) {
      document.getElementById("all-detail").textContent =
        `${TOTAL_STAGES}단계 완주! 총점 ${score} · 라인 ${totalLines}`;
      showOverlay("all");
    } else {
      showOverlay("clear");
    }
  }

  function burst(x, y, color) {
    for (let i = 0; i < 8; i += 1) {
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * (40 + Math.random() * 90),
        vy: Math.sin(a) * (40 + Math.random() * 90) - 20,
        life: 0.35 + Math.random() * 0.25,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function softDrop() {
    if (!current) return;
    if (fits(current, current.x, current.y + 1)) {
      current.y += 1;
      score += 1;
      updateHud();
      lockAcc = 0;
    } else {
      lockAcc += 0.05;
    }
  }

  function hardDrop() {
    if (!current || state !== "play") return;
    const gy = ghostY(current);
    const fallen = gy - current.y;
    current.y = gy;
    score += fallen * 2;
    updateHud();
    lockPiece();
  }

  function move(dx) {
    if (!current || state !== "play") return false;
    if (fits(current, current.x + dx, current.y)) {
      current.x += dx;
      lockAcc = 0;
      return true;
    }
    return false;
  }

  function rotate(dir = 1) {
    if (!current || state !== "play") return;
    if (current.ev === "stone") return;
    const mats = SHAPES[current.type];
    const nextRot = (current.rot + dir + mats.length) % mats.length;
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (fits(current, current.x + k, current.y, nextRot)) {
        current.rot = nextRot;
        current.x += k;
        lockAcc = 0;
        return;
      }
    }
  }

  function hold() {
    if (!current || !canHold || state !== "play") return;
    const swap = holdPiece;
    holdPiece = { type: current.type, ev: current.ev || null };
    canHold = false;
    if (swap) current = makePiece(swap);
    else spawn();
    if (current && !fits(current)) endGame();
    drawSide();
  }

  function resetBoard() {
    board = emptyBoard();
    bag = [];
    refillBag();
    nextPiece = takeFromBag();
    holdPiece = null;
    canHold = true;
    stageLines = 0;
    combo = 0;
    dropAcc = 0;
    lockAcc = 0;
    softDropping = false;
    clearFx = [];
    particles = [];
    flash = 0;
    stageClearPending = false;
    current = null;
    updateHud();
  }

  function startStage(idx, resetRun) {
    gameMode = "stage";
    if (resetRun) {
      stageIndex = 0;
      score = 0;
      totalLines = 0;
    } else {
      stageIndex = idx;
    }
    showOverlay(null);
    resetBoard();
    state = "play";
    spawn();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function startEndless() {
    gameMode = "endless";
    stageIndex = 0;
    score = 0;
    totalLines = 0;
    endlessLevel = 1;
    rankSubmitted = false;
    showOverlay(null);
    resetBoard();
    state = "play";
    spawn();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function startGame() {
    startStage(0, true);
  }

  function nextStage() {
    startStage(stageIndex + 1, false);
  }

  function retryStage() {
    if (gameMode === "endless") {
      startEndless();
      return;
    }
    const keepScore = score;
    const keepTotal = totalLines;
    const idx = stageIndex;
    stageIndex = idx;
    score = keepScore;
    totalLines = keepTotal;
    showOverlay(null);
    resetBoard();
    state = "play";
    spawn();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function pauseGame() {
    if (state !== "play") return;
    state = "paused";
    showOverlay("paused");
  }

  function resumeGame() {
    if (state !== "paused") return;
    showOverlay(null);
    state = "play";
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function endGame() {
    state = "over";
    current = null;
    cancelAnimationFrame(raf);
    if (gameMode === "endless") {
      document.getElementById("over-detail").textContent =
        `무한 스코어 · Lv.${endlessLevel} · ${totalLines}줄 · 점수 ${score}`;
      rankPanel.classList.remove("hidden");
      rankSubmitted = false;
      rankMsg.textContent = "";
      if (shareRankBtn) shareRankBtn.hidden = true;
      rankName.value = "";
      rankBtn.disabled = false;
    } else {
      const st = currentStage();
      document.getElementById("over-detail").textContent =
        `STAGE ${stageIndex + 1} ${st.name} · ${stageLines}/${st.goal}줄 · 점수 ${score}`;
      rankPanel.classList.add("hidden");
    }
    showOverlay("over");
  }

  async function submitRank() {
    if (gameMode !== "endless" || rankSubmitted) return;
    const name = String(rankName.value || "").trim();
    if (name.length < 2 || name.length > 8) {
      rankMsg.textContent = "이름은 2~8자로 입력해 주세요";
      return;
    }
    if (!window.TodayScores || typeof window.TodayScores.submitScore !== "function") {
      rankMsg.textContent = "랭킹 서비스를 불러오지 못했어요";
      return;
    }
    rankBtn.disabled = true;
    rankMsg.textContent = "등록 중…";
    const result = await window.TodayScores.submitScore("tetris", name, score);
    if (result.ok) {
      rankSubmitted = true;
      lastRank = { rankDay: result.rankDay || result.rank, rankWeek: result.rankWeek };
      rankMsg.textContent = window.TodayScores.formatRankMessage
        ? window.TodayScores.formatRankMessage(result)
        : result.rank
          ? `오늘 ${result.rank}위 등록!`
          : "등록 완료!";
      if (shareRankBtn) shareRankBtn.hidden = false;
      if (window.TodayGameRank && TodayGameRank.afterSubmit) {
        await TodayGameRank.afterSubmit({
          gameId: "tetris",
          gameTitle: "블록 팡팡",
          name,
          score,
          rankDay: lastRank.rankDay,
          label: `${score.toLocaleString("ko-KR")}점`,
        });
      }
    } else {
      rankBtn.disabled = false;
      const err = result.error === "network" ? "네트워크 오류" : result.error || "등록 실패";
      rankMsg.textContent = err;
    }
  }

  function update(dt) {
    if (flash > 0) flash -= dt;
    clearFx.forEach((f) => {
      f.life -= dt;
    });
    clearFx = clearFx.filter((f) => f.life > 0);

    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
    });
    particles = particles.filter((p) => p.life > 0);

    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (dir !== 0) {
      if (dasDir !== dir) {
        dasDir = dir;
        dasAcc = 0;
        dasArmed = false;
        move(dir);
      } else {
        dasAcc += dt;
        if (!dasArmed && dasAcc >= 0.16) {
          dasArmed = true;
          dasAcc = 0;
          move(dir);
        } else if (dasArmed && dasAcc >= 0.045) {
          dasAcc = 0;
          move(dir);
        }
      }
    } else {
      dasDir = 0;
      dasAcc = 0;
      dasArmed = false;
    }

    if (!current) return;

    dropAcc += dt;
    const interval = softDropping || keys.soft ? 0.045 : dropInterval();
    while (dropAcc >= interval) {
      dropAcc -= interval;
      if (fits(current, current.x, current.y + 1)) {
        current.y += 1;
        if (softDropping || keys.soft) {
          score += 1;
          updateHud();
        }
        lockAcc = 0;
      } else {
        lockAcc += interval;
        if (lockAcc >= 0.45) {
          lockPiece();
          break;
        }
      }
    }
  }

  function drawEventMark(c, px, py, size, ev) {
    if (!ev) return;
    const cx = px + size / 2;
    const cy = py + size / 2;
    c.save();
    if (ev === "bomb") {
      c.fillStyle = "#2a1a20";
      c.beginPath();
      c.arc(cx, cy + size * 0.02, size * 0.18, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#ffd080";
      c.lineWidth = Math.max(1.2, size * 0.06);
      c.beginPath();
      c.moveTo(cx + size * 0.08, cy - size * 0.12);
      c.quadraticCurveTo(cx + size * 0.22, cy - size * 0.28, cx + size * 0.16, cy - size * 0.34);
      c.stroke();
      c.fillStyle = "#ffb040";
      c.beginPath();
      c.arc(cx + size * 0.16, cy - size * 0.34, size * 0.06, 0, Math.PI * 2);
      c.fill();
    } else if (ev === "gold") {
      c.fillStyle = "#fff8c8";
      c.strokeStyle = "#c99210";
      c.lineWidth = Math.max(1, size * 0.05);
      c.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const r = i % 2 === 0 ? size * 0.22 : size * 0.1;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.closePath();
      c.fill();
      c.stroke();
    } else if (ev === "stone") {
      c.fillStyle = "rgba(60,70,85,0.85)";
      c.beginPath();
      c.moveTo(cx - size * 0.18, cy + size * 0.08);
      c.lineTo(cx - size * 0.08, cy - size * 0.16);
      c.lineTo(cx + size * 0.14, cy - size * 0.1);
      c.lineTo(cx + size * 0.2, cy + size * 0.12);
      c.lineTo(cx - size * 0.02, cy + size * 0.18);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.35)";
      c.lineWidth = 1;
      c.stroke();
    } else if (ev === "rainbow") {
      const bands = ["#ff6b9d", "#ffb347", "#ffe27a", "#7cf0ff", "#d4a0ff"];
      bands.forEach((col, i) => {
        c.strokeStyle = col;
        c.lineWidth = Math.max(1.5, size * 0.055);
        c.beginPath();
        c.arc(cx, cy + size * 0.12, size * (0.1 + i * 0.045), Math.PI * 1.1, Math.PI * 1.9);
        c.stroke();
      });
    }
    c.restore();
  }

  function drawCell(c, x, y, cellOrType, alpha = 1, ghost = false, evOverride = null) {
    const isObj = cellOrType && typeof cellOrType === "object";
    const type = isObj ? cellOrType.t : cellOrType;
    const ev = isObj ? cellOrType.ev : evOverride;
    if (!type) return;

    const px = x * CELL;
    const py = y * CELL;
    const base = COLORS[type];
    const tint = ev && EVENT_COLORS[ev] ? EVENT_COLORS[ev] : base;
    c.save();
    c.globalAlpha = alpha;
    if (ghost) {
      c.strokeStyle = tint.fill;
      c.lineWidth = 2;
      roundRectPath(c, px + 3, py + 3, CELL - 6, CELL - 6, 8);
      c.stroke();
      c.restore();
      return;
    }
    const img = blockImgs[type];
    if (blocksReady && img && !ev) {
      c.drawImage(img, px + 0.5, py + 0.5, CELL - 1, CELL - 1);
      c.restore();
      return;
    }
    if (blocksReady && img && ev) {
      c.drawImage(img, px + 0.5, py + 0.5, CELL - 1, CELL - 1);
      c.fillStyle = "rgba(255,255,255,0.22)";
      roundRectPath(c, px + 1.5, py + 1.5, CELL - 3, CELL - 3, 8);
      c.fill();
      // event wash
      c.globalAlpha = alpha * 0.35;
      c.fillStyle = tint.fill;
      roundRectPath(c, px + 1.5, py + 1.5, CELL - 3, CELL - 3, 8);
      c.fill();
      c.globalAlpha = alpha;
      drawEventMark(c, px, py, CELL, ev);
      c.restore();
      return;
    }
    const g = c.createLinearGradient(px, py, px, py + CELL);
    g.addColorStop(0, tint.light);
    g.addColorStop(0.45, tint.fill);
    g.addColorStop(1, tint.deep);
    c.fillStyle = g;
    roundRectPath(c, px + 1.5, py + 1.5, CELL - 3, CELL - 3, 8);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.45)";
    roundRectPath(c, px + 5, py + 4, CELL - 10, 7, 4);
    c.fill();
    if (!ev) {
      const eyeR = CELL * 0.075;
      const smileR = CELL * 0.12;
      c.fillStyle = "#3d2a55";
      c.beginPath();
      c.arc(px + CELL * 0.35, py + CELL * 0.42, eyeR, 0, Math.PI * 2);
      c.arc(px + CELL * 0.65, py + CELL * 0.42, eyeR, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#3d2a55";
      c.lineWidth = Math.max(1.2, CELL * 0.04);
      c.beginPath();
      c.arc(px + CELL * 0.5, py + CELL * 0.55, smileR, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
    } else {
      drawEventMark(c, px, py, CELL, ev);
    }
    c.strokeStyle = "rgba(90,60,120,0.45)";
    c.lineWidth = Math.max(1.5, CELL * 0.055);
    roundRectPath(c, px + 1.5, py + 1.5, CELL - 3, CELL - 3, Math.max(6, CELL * 0.22));
    c.stroke();
    c.restore();
  }

  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawMini(c, piece) {
    c.clearRect(0, 0, 96, 96);
    const bg = c.createLinearGradient(0, 0, 0, 96);
    bg.addColorStop(0, "rgba(255,230,245,0.85)");
    bg.addColorStop(1, "rgba(210,235,255,0.9)");
    c.fillStyle = bg;
    c.fillRect(0, 0, 96, 96);
    if (!piece || !piece.type) return;
    const type = piece.type;
    const ev = piece.ev || null;
    const mats = SHAPES[type];
    const m = mats[0];
    const size = 18;
    const w = m[0].length * size;
    const h = m.length * size;
    const ox = (96 - w) / 2;
    const oy = (96 - h) / 2;
    const img = blockImgs[type];
    const tint = ev && EVENT_COLORS[ev] ? EVENT_COLORS[ev] : COLORS[type];
    for (let r = 0; r < m.length; r += 1) {
      for (let col = 0; col < m[r].length; col += 1) {
        if (!m[r][col]) continue;
        const px = ox + col * size;
        const py = oy + r * size;
        if (blocksReady && img && !ev) {
          c.drawImage(img, px, py, size, size);
          continue;
        }
        if (blocksReady && img && ev) {
          c.drawImage(img, px, py, size, size);
          c.fillStyle = tint.fill;
          c.globalAlpha = 0.35;
          roundRectPath(c, px + 1, py + 1, size - 2, size - 2, 5);
          c.fill();
          c.globalAlpha = 1;
          drawEventMark(c, px, py, size, ev);
          continue;
        }
        const g = c.createLinearGradient(px, py, px, py + size);
        g.addColorStop(0, tint.light);
        g.addColorStop(1, tint.fill);
        c.fillStyle = g;
        roundRectPath(c, px + 1, py + 1, size - 2, size - 2, 5);
        c.fill();
        if (ev) drawEventMark(c, px, py, size, ev);
      }
    }
  }

  function drawSide() {
    drawMini(nextCtx, nextPiece);
    drawMini(holdCtx, holdPiece);
  }

  function draw() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#c8e9ff");
    bg.addColorStop(0.55, "#f0e8ff");
    bg.addColorStop(1, "#ffd6e8");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 5; i += 1) {
      const cx = 40 + ((i * 97) % W);
      const cy = 50 + ((i * 131) % (H - 80));
      ctx.beginPath();
      ctx.ellipse(cx, cy, 28, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 18, cy + 4, 16, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 18, cy + 3, 18, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < 12; i += 1) {
      const sx = (i * 53 + 17) % W;
      const sy = (i * 89 + 31) % H;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx + 1.5, sy);
      ctx.lineTo(sx, sy + 4);
      ctx.lineTo(sx - 1.5, sy);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(120,90,150,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, H);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(W, y * CELL);
      ctx.stroke();
    }

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (board[y][x]) drawCell(ctx, x, y, board[y][x]);
      }
    }

    clearFx.forEach((f) => {
      ctx.fillStyle = `rgba(255,255,255,${f.life * 2.2})`;
      ctx.fillRect(0, f.y * CELL, W, CELL);
    });

    if (current) {
      const gy = ghostY(current);
      cellsOf(current, current.x, gy).forEach((p) => {
        if (p.y >= 0) drawCell(ctx, p.x, p.y, current.type, 0.55, true, current.ev);
      });
      cellsOf(current).forEach((p) => {
        if (p.y >= 0) drawCell(ctx, p.x, p.y, { t: current.type, ev: current.ev || null });
      });
    }

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (combo >= 2) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 22px 'Bagel Fat One', Jua";
      ctx.textAlign = "center";
      ctx.fillText(`${combo} COMBO!`, W / 2, 36);
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(t) {
    if (state !== "play") return;
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    draw();
    if (state === "play") raf = requestAnimationFrame(loop);
  }

  function act(name) {
    if (name === "left") move(-1);
    if (name === "right") move(1);
    if (name === "rotate") rotate(1);
    if (name === "soft") softDrop();
    if (name === "hard") hardDrop();
    if (name === "hold") hold();
  }

  window.addEventListener("keydown", (e) => {
    const typingRank =
      state === "over" &&
      gameMode === "endless" &&
      (e.target === rankName || document.activeElement === rankName);

    if (!typingRank && ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (state === "title") return;
    if (state === "over" && gameMode === "endless") {
      if (e.code === "Enter") {
        e.preventDefault();
        submitRank();
      }
      return;
    }
    if (e.code === "Escape" || e.code === "KeyP") {
      if (state === "play") pauseGame();
      else if (state === "paused") resumeGame();
      return;
    }
    if (state !== "play") return;
    if (e.repeat && (e.code === "ArrowUp" || e.code === "KeyX" || e.code === "Space" || e.code === "KeyC")) return;
    if (e.code === "ArrowLeft") keys.left = true;
    if (e.code === "ArrowRight") keys.right = true;
    if (e.code === "ArrowDown") keys.soft = true;
    if (e.code === "ArrowUp" || e.code === "KeyX") rotate(1);
    if (e.code === "KeyZ") rotate(-1);
    if (e.code === "Space") hardDrop();
    if (e.code === "KeyC" || e.code === "ShiftLeft" || e.code === "ShiftRight") hold();
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft") keys.left = false;
    if (e.code === "ArrowRight") keys.right = false;
    if (e.code === "ArrowDown") keys.soft = false;
  });

  document.querySelectorAll(".pad-btn").forEach((btn) => {
    const name = btn.dataset.act;
    const on = (e) => {
      e.preventDefault();
      if (state !== "play") return;
      if (name === "left") keys.left = true;
      else if (name === "right") keys.right = true;
      else if (name === "soft") keys.soft = true;
      else act(name);
    };
    const off = () => {
      if (name === "left") keys.left = false;
      if (name === "right") keys.right = false;
      if (name === "soft") keys.soft = false;
    };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("pointercancel", off);
  });

  document.getElementById("stage-btn").addEventListener("click", startGame);
  document.getElementById("endless-btn").addEventListener("click", startEndless);
  document.getElementById("retry-btn").addEventListener("click", retryStage);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("again-btn").addEventListener("click", startGame);
  document.getElementById("resume-btn").addEventListener("click", resumeGame);
  rankBtn.addEventListener("click", submitRank);
  if (shareRankBtn) {
    shareRankBtn.addEventListener("click", async () => {
      const name = String(rankName.value || "").trim() || "나";
      const result = await window.TodayScores.shareRank({
        gameTitle: "블록 팡팡",
        name,
        score,
        rankDay: lastRank.rankDay,
        rankWeek: lastRank.rankWeek,
        url: "https://www.todaygame.co.kr/games/tetris/",
      });
      if (result.mode === "copy") rankMsg.textContent = window.TodayScores.formatShareResult
        ? window.TodayScores.formatShareResult(result)
        : "복사됨! 카톡·SNS에 붙여넣기 하세요";
      else if (result.error === "cancel") rankMsg.textContent = "공유를 취소했어요";
      else if (!result.ok) rankMsg.textContent = "공유에 실패했어요";
      else if (result.mode === "share") rankMsg.textContent = "";
    });
  }

  board = emptyBoard();
  updateHud();
  showOverlay("title");
  loadBlockAssets().then(() => {
    draw();
    drawSide();
  });
  draw();
  drawSide();
})();
