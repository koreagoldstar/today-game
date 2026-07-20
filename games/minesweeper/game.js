(() => {
  "use strict";

  const DIFFS = {
    easy: { label: "초급", cols: 9, rows: 9, mines: 10 },
    medium: { label: "중급", cols: 12, rows: 12, mines: 20 },
    hard: { label: "고급", cols: 14, rows: 18, mines: 40 },
  };

  const NUM_COLORS = ["", "#4A76C0", "#63A355", "#D65555", "#9B6BD6", "#E07840", "#3A9AAA", "#5A5A8A", "#6A5A4A"];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const boardWrap = document.getElementById("board-wrap");
  const flagBtn = document.getElementById("flag-btn");

  const overlays = {
    title: document.getElementById("title"),
    win: document.getElementById("win"),
    lose: document.getElementById("lose"),
  };

  const sprites = { mine: null, flag: null };

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
    const [mine, flag] = await Promise.all([loadImg("assets/mine.png"), loadImg("assets/flag.png")]);
    if (mine) sprites.mine = punchBg(mine);
    if (flag) sprites.flag = punchBg(flag);
  }

  let dpr = 1;
  let diffKey = "easy";
  let cols = 9;
  let rows = 9;
  let mines = 10;
  let cell = 36;
  let pad = 6;
  let grid = [];
  let state = "title";
  let flagMode = false;
  let flags = 0;
  let revealed = 0;
  let timer = 0;
  let timerOn = false;
  let timerId = null;
  let firstClick = true;
  let exploded = null;
  let longPressTimer = null;
  let suppressClick = false;
  let boomT = 0;
  let boomParticles = [];
  let boomRaf = 0;

  function showOverlay(name) {
    Object.keys(overlays).forEach((k) => {
      overlays[k].classList.toggle("hidden", k !== name);
    });
  }

  function hideOverlays() {
    Object.keys(overlays).forEach((k) => overlays[k].classList.add("hidden"));
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    timerOn = false;
  }

  function startTimer() {
    if (timerOn) return;
    timerOn = true;
    timerId = setInterval(() => {
      timer += 1;
      document.getElementById("hud-time").textContent = String(timer);
    }, 1000);
  }

  function updateHud() {
    document.getElementById("hud-mines").textContent = String(Math.max(0, mines - flags));
    document.getElementById("hud-flags").textContent = String(flags);
    document.getElementById("hud-time").textContent = String(timer);
  }

  function resizeCanvas() {
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const maxW = Math.min(380, boardWrap.clientWidth - 16);
    cell = Math.floor(Math.min(maxW / cols, diffKey === "hard" ? 34 : 38));
    cell = Math.max(28, cell);
    const cw = cols * cell + pad * 2;
    const ch = rows * cell + pad * 2;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    boardWrap.classList.toggle("scrollable", diffKey === "hard" && ch > boardWrap.clientHeight - 8);
  }

  function makeCell() {
    return { mine: false, revealed: false, flagged: false, adj: 0, boom: false };
  }

  function idx(x, y) {
    return y * cols + x;
  }

  function inBounds(x, y) {
    return x >= 0 && x < cols && y >= 0 && y < rows;
  }

  function neighbors(x, y) {
    const list = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(nx, ny)) list.push({ x: nx, y: ny });
      }
    }
    return list;
  }

  function placeMines(safeX, safeY) {
    const safe = new Set([idx(safeX, safeY)]);
    neighbors(safeX, safeY).forEach((n) => safe.add(idx(n.x, n.y)));
    let placed = 0;
    while (placed < mines) {
      const x = Math.floor(Math.random() * cols);
      const y = Math.floor(Math.random() * rows);
      const i = idx(x, y);
      if (safe.has(i) || grid[i].mine) continue;
      grid[i].mine = true;
      placed += 1;
    }
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const c = grid[idx(x, y)];
        if (c.mine) {
          c.adj = -1;
          continue;
        }
        c.adj = neighbors(x, y).filter((n) => grid[idx(n.x, n.y)].mine).length;
      }
    }
  }

  function newGame() {
    const d = DIFFS[diffKey];
    cols = d.cols;
    rows = d.rows;
    mines = d.mines;
    grid = Array.from({ length: cols * rows }, makeCell);
    flags = 0;
    revealed = 0;
    timer = 0;
    firstClick = true;
    exploded = null;
    stopTimer();
    resizeCanvas();
    updateHud();
    draw();
  }

  function revealCell(x, y) {
    const i = idx(x, y);
    const c = grid[i];
    if (c.revealed || c.flagged) return;
    if (firstClick) {
      placeMines(x, y);
      firstClick = false;
      startTimer();
    }
    if (c.mine) {
      c.revealed = true;
      c.boom = true;
      exploded = { x, y };
      startBoom(x, y);
      return;
    }
    const stack = [{ x, y }];
    while (stack.length) {
      const cur = stack.pop();
      const ci = idx(cur.x, cur.y);
      const cellData = grid[ci];
      if (cellData.revealed || cellData.flagged) continue;
      cellData.revealed = true;
      revealed += 1;
      if (cellData.adj === 0) {
        neighbors(cur.x, cur.y).forEach((n) => {
          const ni = idx(n.x, n.y);
          if (!grid[ni].revealed && !grid[ni].flagged && !grid[ni].mine) stack.push(n);
        });
      }
    }
    checkWin();
  }

  function toggleFlag(x, y) {
    const i = idx(x, y);
    const c = grid[i];
    if (c.revealed) return;
    if (c.flagged) {
      c.flagged = false;
      flags -= 1;
    } else {
      c.flagged = true;
      flags += 1;
    }
    updateHud();
    draw();
  }

  function chord(x, y) {
    const i = idx(x, y);
    const c = grid[i];
    if (!c.revealed || c.adj <= 0) return;
    const neigh = neighbors(x, y);
    const flaggedNear = neigh.filter((n) => grid[idx(n.x, n.y)].flagged).length;
    if (flaggedNear !== c.adj) return;
    neigh.forEach((n) => {
      const nc = grid[idx(n.x, n.y)];
      if (!nc.flagged && !nc.revealed) revealCell(n.x, n.y);
    });
  }

  function revealAllMines() {
    grid.forEach((c) => {
      if (c.mine) c.revealed = true;
    });
  }

  function checkWin() {
    if (revealed >= cols * rows - mines) {
      stopTimer();
      state = "win";
      grid.forEach((c) => {
        if (c.mine) c.flagged = true;
      });
      flags = mines;
      updateHud();
      draw();
      document.getElementById("win-detail").textContent = `${DIFFS[diffKey].label} · ${timer}초`;
      showOverlay("win");
      const rankScore = Math.max(1, 10000 - timer * 10);
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "minesweeper", gameTitle: "지뢰찾기", formParent: document.getElementById("win") });
      TodayGameRank.open(rankScore);
    }
    }
  }

  function startBoom(x, y) {
    stopTimer();
    state = "boom";
    boomT = 0;
    const rect = canvas.getBoundingClientRect();
    // particle origins in canvas space
    const px = pad + x * cell + cell / 2;
    const py = pad + y * cell + cell / 2;
    boomParticles = [];
    for (let i = 0; i < 28; i += 1) {
      const a = (Math.PI * 2 * i) / 28 + Math.random() * 0.2;
      const sp = 40 + Math.random() * 140;
      boomParticles.push({
        x: px,
        y: py,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.5 + Math.random() * 0.5,
        t: 0,
        r: 2 + Math.random() * 4,
        color: i % 3 === 0 ? "#ffe27a" : i % 3 === 1 ? "#ff7eb6" : "#ff9a4a",
      });
    }
    if (boomRaf) cancelAnimationFrame(boomRaf);
    const tick = (now) => {
      if (state !== "boom") return;
      boomT += 1 / 60;
      boomParticles.forEach((p) => {
        p.t += 1 / 60;
        p.x += p.vx / 60;
        p.y += p.vy / 60;
        p.vy += 180 / 60;
      });
      if (boomT > 0.35) revealAllMines();
      draw();
      drawBoomFx();
      if (boomT >= 1.15) {
        finishLose();
        return;
      }
      boomRaf = requestAnimationFrame(tick);
    };
    boomRaf = requestAnimationFrame(tick);
  }

  function finishLose() {
    state = "lose";
    revealAllMines();
    draw();
    document.getElementById("lose-detail").textContent = `${DIFFS[diffKey].label} · ${timer}초`;
    showOverlay("lose");
  }

  function drawBoomFx() {
    if (state !== "boom" || !exploded) return;
    const cw = cols * cell + pad * 2;
    const ch = rows * cell + pad * 2;
    const px = pad + exploded.x * cell + cell / 2;
    const py = pad + exploded.y * cell + cell / 2;
    const flash = Math.max(0, 1 - boomT * 1.4);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 90, 70, ${flash * 0.4})`;
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = `rgba(255, 220, 100, ${flash * 0.4})`;
      ctx.beginPath();
      ctx.arc(px, py, cell * (0.8 + boomT * 3.2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = `rgba(255,60,90,${Math.max(0, 1 - boomT)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, cell * (0.4 + boomT * 2.4), 0, Math.PI * 2);
    ctx.stroke();

    boomParticles.forEach((p) => {
      if (p.t >= p.life) return;
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(px, py);
    const s = 1 + Math.sin(Math.min(1, boomT) * Math.PI) * 0.55;
    ctx.scale(s, s);
    ctx.font = `bold ${Math.floor(cell * 0.72)}px Jua`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(180,40,60,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeText("펑!", 0, 0);
    ctx.fillText("펑!", 0, 0);
    ctx.restore();
  }

  function gameLose() {
    finishLose();
  }

  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const cw = cols * cell + pad * 2;
    const ch = rows * cell + pad * 2;
    const x = Math.floor((((clientX - rect.left) / rect.width) * cw - pad) / cell);
    const y = Math.floor((((clientY - rect.top) / rect.height) * ch - pad) / cell);
    if (!inBounds(x, y)) return null;
    return { x, y };
  }

  function handleTap(x, y, asFlag) {
    if (state !== "play") return;
    const c = grid[idx(x, y)];
    if (asFlag || flagMode) {
      toggleFlag(x, y);
      return;
    }
    if (c.revealed && c.adj > 0) {
      chord(x, y);
      draw();
      return;
    }
    revealCell(x, y);
    draw();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawHiddenTile(x, y, w, h, flagged) {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    if (flagged) {
      grad.addColorStop(0, "#FCD4CC");
      grad.addColorStop(1, "#F5B8AE");
    } else {
      grad.addColorStop(0, "#C8B8E0");
      grad.addColorStop(1, "#A898C8");
    }
    roundRect(x, y, w, h, 10);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    roundRect(x + 3, y + 3, w - 6, h * 0.32, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,90,140,0.28)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawRevealedTile(x, y, w, h, boom) {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    if (boom) {
      grad.addColorStop(0, "#FFD0C8");
      grad.addColorStop(1, "#F9A898");
    } else {
      grad.addColorStop(0, "#FFFEFB");
      grad.addColorStop(1, "#F0EBE4");
    }
    roundRect(x, y, w, h, 10);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = boom ? "rgba(220,90,80,0.45)" : "rgba(160,140,120,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawFlag(cx, cy, s) {
    if (sprites.flag) {
      const size = s * 0.78;
      ctx.drawImage(sprites.flag, cx - size / 2, cy - size / 2, size, size);
      return;
    }
    ctx.fillStyle = "#E75A5A";
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.15, cy + s * 0.35);
    ctx.lineTo(cx - s * 0.15, cy - s * 0.45);
    ctx.lineTo(cx + s * 0.35, cy - s * 0.2);
    ctx.lineTo(cx - s * 0.15, cy - s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#C8843D";
    roundRect(cx - s * 0.22, cy + s * 0.2, s * 0.12, s * 0.28, 2);
    ctx.fill();
  }

  function drawMine(cx, cy, s, soft) {
    if (sprites.mine) {
      const size = s * (soft ? 0.72 : 0.88);
      ctx.save();
      if (soft) ctx.globalAlpha = 0.85;
      ctx.drawImage(sprites.mine, cx - size / 2, cy - size / 2 - 1, size, size);
      ctx.restore();
      return;
    }
    const body = ctx.createRadialGradient(cx - s * 0.12, cy - s * 0.14, s * 0.05, cx, cy, s * 0.34);
    body.addColorStop(0, soft ? "#555" : "#3a3a3a");
    body.addColorStop(1, soft ? "#222" : "#111");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    const cw = cols * cell + pad * 2;
    const ch = rows * cell + pad * 2;
    ctx.clearRect(0, 0, cw, ch);

    const bg = ctx.createLinearGradient(0, 0, cw, ch);
    bg.addColorStop(0, "#EDE0D0");
    bg.addColorStop(1, "#DCC8B0");
    ctx.fillStyle = bg;
    roundRect(0, 0, cw, ch, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(160,120,80,0.35)";
    ctx.lineWidth = 3;
    roundRect(1.5, 1.5, cw - 3, ch - 3, 13);
    ctx.stroke();

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const c = grid[idx(x, y)];
        const px = pad + x * cell + 2;
        const py = pad + y * cell + 2;
        const w = cell - 4;
        const h = cell - 4;
        const cx = px + w / 2;
        const cy = py + h / 2;

        if (!c.revealed) {
          drawHiddenTile(px, py, w, h, c.flagged);
          if (c.flagged) drawFlag(cx, cy, w);
        } else if (c.mine) {
          drawRevealedTile(px, py, w, h, c.boom);
          drawMine(cx, cy, w, !c.boom);
        } else {
          drawRevealedTile(px, py, w, h, false);
          if (c.adj > 0) {
            ctx.font = `bold ${Math.floor(w * 0.5)}px Jua`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = NUM_COLORS[c.adj] || "#5A4A3A";
            ctx.fillText(String(c.adj), cx, cy + 1);
          }
        }
      }
    }
  }

  function startPlay() {
    hideOverlays();
    state = "play";
    if (window.TodayGameRank) TodayGameRank.reset();
    newGame();
  }

  flagBtn.addEventListener("click", () => {
    flagMode = !flagMode;
    flagBtn.classList.toggle("active", flagMode);
    flagBtn.setAttribute("aria-pressed", flagMode ? "true" : "false");
  });

  document.getElementById("start-btn").addEventListener("click", startPlay);
  document.getElementById("retry-btn").addEventListener("click", startPlay);
  document.getElementById("again-btn").addEventListener("click", startPlay);
  const challengeBestBtn = document.getElementById("challenge-best-btn");
  if (challengeBestBtn) {
    challengeBestBtn.addEventListener("click", async () => {
      const nameInput = document.getElementById("win-name");
      const msg = document.getElementById("win-rank-msg");
      const name = String(nameInput && nameInput.value ? nameInput.value : "").trim();
      if (name.length < 2 || name.length > 8) {
        if (msg) msg.textContent = "이름은 2~8자로 적어 주세요";
        return;
      }
      localStorage.setItem("today-game-name", name);
      challengeBestBtn.disabled = true;
      if (msg) msg.textContent = "등록 중…";
      try {
        const res = await fetch("/api/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "best", game: "minesweeper", value: timer, name }),
        });
        const data = await res.json();
        if (data.skipped) {
          if (msg) msg.textContent = "오늘은 다른 챌린지 게임이에요";
        } else if (data.ok && data.updated) {
          if (msg) msg.textContent = data.bestLabel ? `최고기록 갱신! ${data.bestLabel}` : "등록 완료!";
        } else if (data.ok) {
          if (msg) msg.textContent = "등록됨 · 더 빠른 기록이 있어요";
        } else {
          if (msg) msg.textContent = "등록 실패 · 다시 시도해 주세요";
        }
      } catch (_) {
        if (msg) msg.textContent = "등록 실패 · 다시 시도해 주세요";
      }
      challengeBestBtn.disabled = false;
    });
  }
  document.getElementById("restart-btn").addEventListener("click", () => {
    if (state === "title") return;
    startPlay();
  });

  document.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      diffKey = btn.dataset.diff;
      document.querySelectorAll(".pill").forEach((b) => b.classList.toggle("active", b === btn));
      if (state !== "title") startPlay();
    });
  });

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const cellPos = cellAt(e.clientX, e.clientY);
    if (cellPos) handleTap(cellPos.x, cellPos.y, true);
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    suppressClick = false;
    const cellPos = cellAt(e.clientX, e.clientY);
    if (!cellPos) return;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      suppressClick = true;
      handleTap(cellPos.x, cellPos.y, true);
    }, 450);
  });

  canvas.addEventListener("pointerup", (e) => {
    clearTimeout(longPressTimer);
    if (state !== "play" || suppressClick) {
      suppressClick = false;
      return;
    }
    const cellPos = cellAt(e.clientX, e.clientY);
    if (cellPos) handleTap(cellPos.x, cellPos.y, false);
  });

  canvas.addEventListener("pointerleave", () => clearTimeout(longPressTimer));
  canvas.addEventListener("pointercancel", () => clearTimeout(longPressTimer));

  window.addEventListener("resize", () => {
    if (state !== "title") {
      resizeCanvas();
      draw();
    }
  });

  showOverlay("title");
  resizeCanvas();
  newGame();
  loadAssets().then(() => draw());

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "minesweeper",
      gameTitle: "지뢰찾기",
      formParent: document.getElementById("win") || document.body,
    });
  }
})();
