(() => {
  "use strict";

  const GAME_ID = "chick-rescue";
  const GAME_TITLE = "병아리 구출";
  const { STAGE_COUNT, CELL, buildLevel, cloneBarriers } = window.ChickRescueLevels;
  const Water = window.ChickRescueWater;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let W = 360;
  let H = 480;
  let state = "title";
  let stageIdx = 0;
  let score = 0;
  let moves = 0;
  let level = null;
  let barriers = null;
  let water = null;
  let animWater = null;
  let flowAnim = null;
  let chickHappy = false;
  let toastTimer = 0;

  const imgs = {};
  const imgList = [
    ["bg", "assets/bg.jpg"],
    ["chick", "assets/chick.png"],
    ["water", "assets/water_tile.png"],
    ["lava", "assets/lava_tile.png"],
  ];

  function loadImages() {
    return Promise.all(
      imgList.map(([key, src]) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { imgs[key] = img; resolve(); };
        img.onerror = () => resolve();
        img.src = `${src}?v=1`;
      }))
    );
  }

  function resize() {
    const wrap = canvas.parentElement;
    W = Math.floor(wrap.clientWidth);
    H = Math.floor(wrap.clientHeight);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function showOverlay(id) {
    document.querySelectorAll(".overlay").forEach((el) => el.classList.remove("show"));
    const el = document.getElementById(id);
    if (el) el.classList.add("show");
  }

  function hideOverlays() {
    document.querySelectorAll(".overlay").forEach((el) => el.classList.remove("show"));
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    toastTimer = 1.6;
  }

  function updateHud() {
    document.getElementById("hud-stage").textContent = String(stageIdx + 1);
    document.getElementById("hud-score").textContent = String(score);
    document.getElementById("hud-moves").textContent = String(moves);
  }

  function loadStage(idx) {
    stageIdx = idx;
    level = buildLevel(idx);
    barriers = cloneBarriers(level.barriers);
    water = Water.initWater(level);
    animWater = water.map((row) => row.slice());
    moves = 0;
    chickHappy = false;
    flowAnim = null;
    updateHud();
    document.getElementById("hint").textContent =
      idx < 3
        ? "나무 칸막이(갈색)를 탭! · 물이 병아리에게 닿으면 클리어"
        : "칸막이 제거 → 물 흐름 확인 · 용암에 물이 빠지면 주의!";
    draw();
  }

  function resetStage() {
    loadStage(stageIdx);
  }

  function gridLayout() {
    if (!level) return { ox: 0, oy: 0, cell: 40, pad: 8 };
    const pad = 14;
    const cell = Math.floor(Math.min((W - pad * 2) / level.cols, (H - pad * 2) / level.rows));
    const boardW = cell * level.cols;
    const boardH = cell * level.rows;
    return {
      ox: (W - boardW) / 2,
      oy: (H - boardH) / 2,
      cell,
      pad,
    };
  }

  function cellRect(r, c, lay) {
    return {
      x: lay.ox + c * lay.cell,
      y: lay.oy + r * lay.cell,
      w: lay.cell,
      h: lay.cell,
    };
  }

  function drawCell(r, c, lay) {
    const type = level.cells[r][c];
    const rect = cellRect(r, c, lay);
    const wx = animWater[r][c];

    ctx.save();
    if (type === CELL.WALL) {
      ctx.fillStyle = "#6c757d";
      roundRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, 8);
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      roundRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(33,158,188,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (type === CELL.LAVA) {
        if (imgs.lava) ctx.drawImage(imgs.lava, rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8);
        else {
          ctx.fillStyle = "#ff6b35";
          roundRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12, 8);
          ctx.fill();
        }
      }

      if (wx > 0.5) {
        const h = (rect.h - 10) * (wx / 100);
        const waterY = rect.y + rect.h - 6 - h;
        if (imgs.water) {
          ctx.save();
          ctx.beginPath();
          roundRect(rect.x + 5, waterY, rect.w - 10, h, 6);
          ctx.clip();
          ctx.drawImage(imgs.water, rect.x + 5, waterY, rect.w - 10, Math.max(h, 8));
          ctx.restore();
        } else {
          ctx.fillStyle = "rgba(72,202,228,0.85)";
          roundRect(rect.x + 5, waterY, rect.w - 10, h, 6);
          ctx.fill();
        }
      }

      if (type === CELL.SOURCE && wx < 95) {
        ctx.fillStyle = "rgba(33,158,188,0.25)";
        ctx.font = `${Math.floor(lay.cell * 0.35)}px Jua`;
        ctx.textAlign = "center";
        ctx.fillText("💧", rect.x + rect.w / 2, rect.y + lay.cell * 0.42);
      }

      if (type === CELL.CHICK) {
        const size = lay.cell * 0.72;
        const cx = rect.x + rect.w / 2 - size / 2;
        const cy = rect.y + rect.h / 2 - size / 2 + (chickHappy ? -3 : 0);
        if (imgs.chick) ctx.drawImage(imgs.chick, cx, cy, size, size);
        else {
          ctx.font = `${Math.floor(size)}px serif`;
          ctx.textAlign = "center";
          ctx.fillText("🐥", rect.x + rect.w / 2, rect.y + rect.h * 0.62);
        }
      }

      if (type === CELL.ROCK) {
        ctx.fillStyle = "#495057";
        ctx.beginPath();
        ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, lay.cell * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBarrier(r, c, horizontal, lay) {
    const present = horizontal ? barriers.h[r][c] : barriers.v[r][c];
    if (!present) return;
    const removable = horizontal ? level.removable.h[r][c] : level.removable.v[r][c];
    const thick = Math.max(6, lay.cell * 0.14);
    let x1, y1, x2, y2;
    if (horizontal) {
      const rect = cellRect(r, c, lay);
      x1 = rect.x + rect.w;
      y1 = rect.y + rect.h * 0.18;
      x2 = x1;
      y2 = rect.y + rect.h * 0.82;
    } else {
      const rect = cellRect(r, c, lay);
      x1 = rect.x + rect.w * 0.18;
      y1 = rect.y + rect.h;
      x2 = rect.x + rect.w * 0.82;
      y2 = y1;
    }
    ctx.save();
    ctx.strokeStyle = removable ? "#b5651d" : "#5c6770";
    ctx.lineWidth = thick;
    ctx.lineCap = "round";
    ctx.shadowColor = removable ? "rgba(181,101,29,0.45)" : "rgba(0,0,0,0.2)";
    ctx.shadowBlur = removable ? 8 : 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (removable) {
      ctx.fillStyle = "#ffd166";
      ctx.font = `${Math.max(10, lay.cell * 0.18)}px Jua`;
      ctx.textAlign = "center";
      ctx.fillText("×", (x1 + x2) / 2, (y1 + y2) / 2 + 4);
    }
    ctx.restore();
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

  function draw() {
    if (!level) return;
    ctx.clearRect(0, 0, W, H);
    if (imgs.bg) {
      ctx.drawImage(imgs.bg, 0, 0, W, H);
      ctx.fillStyle = "rgba(232,244,255,0.35)";
      ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#fff7e6");
      g.addColorStop(1, "#c8e7ff");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    const lay = gridLayout();
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) drawCell(r, c, lay);
    }
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols - 1; c++) drawBarrier(r, c, true, lay);
    }
    for (let r = 0; r < level.rows - 1; r++) {
      for (let c = 0; c < level.cols; c++) drawBarrier(r, c, false, lay);
    }
  }

  function hitBarrier(px, py) {
    const lay = gridLayout();
    const hitDist = lay.cell * 0.22;
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols - 1; c++) {
        if (!barriers.h[r][c]) continue;
        const rect = cellRect(r, c, lay);
        const bx = rect.x + rect.w;
        const by = rect.y + rect.h / 2;
        if (Math.hypot(px - bx, py - by) < hitDist) return { t: "h", r, c };
      }
    }
    for (let r = 0; r < level.rows - 1; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (!barriers.v[r][c]) continue;
        const rect = cellRect(r, c, lay);
        const bx = rect.x + rect.w / 2;
        const by = rect.y + rect.h;
        if (Math.hypot(px - bx, py - by) < hitDist) return { t: "v", r, c };
      }
    }
    return null;
  }

  function removeBarrier(hit) {
    if (!hit) return;
    const rem = hit.t === "h" ? level.removable.h[hit.r][hit.c] : level.removable.v[hit.r][hit.c];
    if (!rem) {
      toast("철 칸막이는 제거할 수 없어요!");
      return;
    }
    if (hit.t === "h") barriers.h[hit.r][hit.c] = false;
    else barriers.v[hit.r][hit.c] = false;
    moves++;
    updateHud();
    toast("칸막이 제거!");
    runFlow(true);
  }

  function runFlow(autoCheck) {
    if (flowAnim) return;
    let steps = 0;
    flowAnim = setInterval(() => {
      const moved = Water.simulateStep(level, animWater, barriers);
      draw();
      steps++;
      if (moved < 0.4 || steps > 80) {
        clearInterval(flowAnim);
        flowAnim = null;
        water = animWater.map((row) => row.slice());
        if (autoCheck) checkResult();
      }
    }, 28);
  }

  function starCount() {
    const par = level.par || 3;
    if (moves <= par) return 3;
    if (moves <= par + 2) return 2;
    return 1;
  }

  function checkResult() {
    if (Water.isWin(level, animWater)) {
      chickHappy = true;
      draw();
      const stars = starCount();
      score += 100 + stageIdx * 8 + stars * 40;
      updateHud();
      if (stageIdx >= STAGE_COUNT - 1) {
        document.getElementById("all-detail").textContent = `최종 점수 ${score} · 100단계 완주!`;
        showOverlay("allclear");
        state = "allclear";
        if (window.TodayGameRank) TodayGameRank.open(score);
        if (window.submitGameScore) window.submitGameScore(GAME_ID, score);
      } else {
        document.getElementById("clear-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
        document.getElementById("clear-detail").textContent =
          `이동 ${moves}회 · 병아리 구출 성공!`;
        showOverlay("clear");
        state = "clear";
      }
      return;
    }
    if (Water.isFail(level, animWater)) {
      showOverlay("fail");
      state = "fail";
    }
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onPointer(e) {
    if (state !== "play" || !level) return;
    e.preventDefault();
    const p = pointerPos(e);
    removeBarrier(hitBarrier(p.x, p.y));
  }

  function startGame() {
    score = 0;
    state = "play";
    hideOverlays();
    loadStage(0);
    if (window.TodayGameRank) {
      TodayGameRank.mount({
        gameId: GAME_ID,
        gameTitle: GAME_TITLE,
        formParent: document.getElementById("fail") || document.body,
      });
    }
  }

  function nextStage() {
    hideOverlays();
    state = "play";
    loadStage(stageIdx + 1);
  }

  function loop(ts) {
    if (toastTimer > 0) {
      toastTimer -= 0.016;
      if (toastTimer <= 0) document.getElementById("toast").classList.remove("show");
    }
    requestAnimationFrame(loop);
  }

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", () => {
    hideOverlays();
    state = "play";
    resetStage();
  });
  document.getElementById("again-btn").addEventListener("click", startGame);
  document.getElementById("reset-btn").addEventListener("click", resetStage);
  document.getElementById("flow-btn").addEventListener("click", () => runFlow(true));

  canvas.addEventListener("mousedown", onPointer);
  canvas.addEventListener("touchstart", onPointer, { passive: false });

  window.addEventListener("resize", resize);

  loadImages().then(() => {
    resize();
    requestAnimationFrame(loop);
  });
})();
