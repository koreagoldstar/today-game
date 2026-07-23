(() => {
  "use strict";

  const CANVAS = 390;
  const LEVELS = [
    ["####","#.@#","#$ #","#  #","####"],
    ["#####","#  .#","# $ #","#@  #","#####"],
    ["######","#   .#","# @$ #","#    #","######"],
    [" #####"," #   #","##$  #","# .@ #","#  $##","## . #"," #####"],
    ["######","# .. #","# $$ #","# @  #","######"],
    ["  ####","###  #","#.$  #","# $ ##","# @. #","######"],
    ["#######","#.   .#","# $$  #","#  @  #","#######"],
    [" ########"," #  ..  #"," # $  $ #","##  @  ##"," #  $$  #"," #  ..  #"," ########"],
    ["########","#.     #","# $##  #","##     #","#@$ . ##","#      #","########"],
    ["########","#     .#","#  #   #","#  ##$ #","#.$ #@ #","#   #  #","########"],
    ["########","##  #  #","#  @#$ #","#  *   #","#    ###","# . #  #","########"],
    ["########","#    # #","# # #  #","#      #","# $.#$ #","#.   @ #","########"],
    ["########","#      #","##  $@ #","#.###. #","# $ #  #","#      #","########"],
    ["########","#      #","# $  ###","# .  $@#","#  # ###","#   .# #","########"],
    ["#########","#   ### #","##   $ ##","#   .   #","#  $ #  #","#  @   ##","#.  #*# #","#########"],
    ["#########","#       #","###  .  #","# $    .#","# $   . #","# $ #   #","#@ ##  ##","#########"],
    ["#########","#  #    #","# *# #$ #","#  #   ##","#    . ##","#.$ #   #","# @     #","#########"],
    ["#########","##  @   #","## #$ # #","#.  . # #","#       #","# # #$$ #","# .    ##","#########"],
    ["#########","#   * # #","# $$# # #","# # #  @#","#    #  #","##.   .##","# #     #","#########"],
    ["#########","#  #    #","# $     #","# #     #","#   # #.#","#   $@# #","#  .# $.#","#########"],
    ["#########","# #.   ##","#   # $ #","#  #@   #","#   $ # #","#  .. $ #","#    ## #","#########"],
    ["#########","#     # #","## #. $ #","# #.. #@#","#     $ #","# #  #$ #","#    #  #","#########"],
    ["#########","#   #####","# #   . #","# $   # #","#.   .  #","#$ ###$ #","#     @ #","#########"],
    ["#########","#   #   #","# #   . #","# @$  # #","#     . #","# $ ##$ #","#   .#  #","#########"],
    ["##########","##  ##  .#","# @$     #","#       ##","# . #   ##","#    ##  #","# $ $ #  #","#    .   #","##########"],
    ["##########","#  #     #","# @ $ #* #","# $    ###","#   #    #","#.       #","#  #     #","#  #. ####","##########"],
    ["##########","# . ##   #","# .  $ ###","#. #    ##","#    #   #","#        #","# $$#    #","##@ #  # #","##########"],
    ["##########","#    @   #","# $# $ # #","#   #    #","#.     # #","#  # . .##","# $#     #","#   #    #","##########"],
    ["##########","#    # $.#","##$#    ##","#    # ###","#       .#","#      $@#","#    .   #","# # #    #","##########"],
    ["##########","# # #   .#","###  # $ #","#    #   #","# $      #","##+# #   #","#.$    # #","#        #","##########"],
    ["##########","#    # . #","#   ## $ #","# #     .#","#   # ## #","# $ #   .#","#     $@ #","# # ##   #","##########"],
    ["##########","#       ##","#*       #","#  #   $ #","#.$# . @ #","#        #","# #    ###","##     # #","##########"],
    ["##########","#     ## #","##  #$ # #","#  #.    #","#.     $ #","###      #","#.     $@#","#      # #","##########"],
    ["##########","# .   .  #","#   @$   #","#   #    #","# # .$## #","#  #   $ #","# #  ## ##","#   #    #","##########"],
    ["##########","#  #     #","## $.   ##","# $    # #","#@#$#  # #","### .    #","#  #.    #","##       #","##########"],
    ["##########","#        #","#@$ .    #","#  ## . ##","#    ##  #","#  .  $ ##","# $   #  #","#  #     #","##########"],
    ["###########","##  ##    #","#. $@# #  #","## .#     #","# # $   # #","#  . #    #","# $# $    #","#  .      #","###########"],
    ["###########","# . #     #","# $## $  ##","#     .   #","# #   # $.#","# ### #   #","#  #  @$  #","#  #   .  #","###########"],
    ["###########","# ##      #","# $     # #","# $#   # ##","#        ##","# * #.   ##","#   @*.  ##","# #     ###","###########"],
    ["###########","#  #  # # #","# $    #  #","#      ## #","# .   #* ##","# #   . $ #","#         #","#   . $@# #","###########"],
    ["###########","#  #.#    #","# $@$  .  #","#  $    # #","#     .   #","##  .   # #","# $#   ####","#     # # #","###########"],
    ["###########","#      #* #","# #  #.   #","#    # $# #","# $ #  @  #","#.  #  #$ #","#    #    #","###   #.  #","###########"],
    ["###########","#    .#   #","# #   $ # #","#  # $#  ##","###       #","#@$    # ##","#.$      ##","##   #. . #","###########"],
    ["###########","#         #","# $ # $   #","# @#*# ####","# *##    .#","#   .     #","#   #     #","#  #      #","###########"],
    ["############","##@ #      #","# $        #","#  . # .   #","#     #   ##","#        $ #","#  ## #$   #","#   #.$  # #","###  # .   #","############"],
    ["############","#   .  #   #","#    . $@  #","#       # ##","##. * ###  #","#  #   #   #","##  #      #","# $  $    ##","#       ## #","############"],
    ["############","#   #   ## #","###    .  .#","#    #     #","#      #   #","#       ####","# # #    $ #","# $  $ # $ #","##    . #+ #","############"],
    ["############","#  .       #","#  #  #$ $ #","#        # #","#.     $ # #","#     #   .#","# #      ###","#   #   $# #","# #   .#  @#","############"],
    ["############","#  #  #   ##","#  #  #  $@#","#   #     ##","## # $$##. #","#       .  #","#    #   # #","#  .    *  #","#          #","############"],
    ["############","#        # #","# #.    ## #","#  #  . #  #","# $#       #","#   # #    #","##.     #  #","#.  #$$ $  #","#    @ #  ##","############"],
  ];

  const TOTAL = LEVELS.length;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    all: document.getElementById("allclear"),
  };

  const hud = {
    stage: document.getElementById("hud-stage"),
    moves: document.getElementById("hud-moves"),
  };

  const imgs = {};
  let assetsReady = false;

  let state = "title";
  let stageIndex = 0;
  let rows = 0;
  let cols = 0;
  let walls = new Set();
  let goals = new Set();
  let crates = new Set();
  let player = { x: 0, y: 0 };
  let cell = 32;
  let offset = { x: 0, y: 0 };
  let moves = 0;
  let runStartedAt = 0;
  let score = 0;
  let totalMoves = 0;
  let history = [];
  let particles = [];
  let swipeStart = null;
  let raf = 0;

  function key(x, y) {
    return `${x},${y}`;
  }

  function parseLevel(index) {
    const map = LEVELS[index];
    rows = map.length;
    cols = Math.max(...map.map((r) => r.length));
    walls = new Set();
    goals = new Set();
    crates = new Set();
    player = { x: 0, y: 0 };

    for (let y = 0; y < rows; y += 1) {
      const line = map[y];
      for (let x = 0; x < cols; x += 1) {
        const ch = line[x] || " ";
        const k = key(x, y);
        if (ch === "#") walls.add(k);
        else if (ch === ".") goals.add(k);
        else if (ch === "$") crates.add(k);
        else if (ch === "*") {
          goals.add(k);
          crates.add(k);
        } else if (ch === "@") player = { x, y };
        else if (ch === "+") {
          player = { x, y };
          goals.add(k);
        }
      }
    }

    cell = Math.floor(Math.min(CANVAS / cols, CANVAS / rows));
    canvas.width = cols * cell;
    canvas.height = rows * cell;
    offset = {
      x: (CANVAS - canvas.width) / 2,
      y: (CANVAS - canvas.height) / 2,
    };
  }

  function snapshot() {
    return {
      player: { ...player },
      crates: new Set(crates),
      moves,
    };
  }

  function restore(snap) {
    player = { ...snap.player };
    crates = new Set(snap.crates);
    moves = snap.moves;
    updateHud();
  }

  function loadAssets() {
    const names = ["bunny", "crate", "grass", "goal", "hedge"];
    return Promise.all(
      names.map(
        (n) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              imgs[n] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `assets/${n}.png`;
          })
      )
    ).then(() => {
      assetsReady = Object.keys(imgs).length > 0;
    });
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (overlays[name]) overlays[name].classList.remove("hidden");
  }

  function updateHud() {
    hud.stage.textContent = String(stageIndex + 1);
    hud.moves.textContent = String(moves);
  }

  function resetStage() {
    parseLevel(stageIndex);
    moves = 0;
    history = [];
    particles = [];
    updateHud();
  }

  function startGame(fromTitle) {
    if (fromTitle) {
      stageIndex = 0;
      totalMoves = 0;
      runStartedAt = performance.now();
      if (window.TodayGameRank) TodayGameRank.reset();
    }
    state = "play";
    showOverlay(null);
    resetStage();
    draw();
  }

  function isWall(x, y) {
    return walls.has(key(x, y));
  }

  function isGoal(x, y) {
    return goals.has(key(x, y));
  }

  function isCrate(x, y) {
    return crates.has(key(x, y));
  }

  function allCratesOnGoals() {
    for (const k of crates) {
      if (!goals.has(k)) return false;
    }
    return crates.size > 0;
  }

  function spawnSparkle(x, y) {
    for (let i = 0; i < 8; i += 1) {
      particles.push({
        x: x * cell + cell / 2,
        y: y * cell + cell / 2,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        life: 0.5,
        t: 0,
      });
    }
  }

  function tryMove(dx, dy) {
    if (state !== "play") return;
    const nx = player.x + dx;
    const ny = player.y + dy;
    const nk = key(nx, ny);
    if (isWall(nx, ny)) return;

    history.push(snapshot());

    if (isCrate(nx, ny)) {
      const bx = nx + dx;
      const by = ny + dy;
      const bk = key(bx, by);
      if (isWall(bx, by) || isCrate(bx, by)) {
        history.pop();
        return;
      }
      crates.delete(nk);
      crates.add(bk);
      if (isGoal(bx, by)) spawnSparkle(bx, by);
    }

    player.x = nx;
    player.y = ny;
    moves += 1;
    totalMoves += 1;
    updateHud();
    draw();

    if (allCratesOnGoals()) {
      const elapsedSec = (performance.now() - runStartedAt) / 1000;
      score = Math.max(1, 50000 - totalMoves * 10 - Math.floor(elapsedSec) * 5);
      state = "clear";
      if (stageIndex >= TOTAL - 1) {
        document.getElementById("all-detail").textContent = `${TOTAL}단계 완료 · 총 ${totalMoves}푸시 · 점수 ${score}`;
        showOverlay("all");
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "sokoban", gameTitle: "상자야 굴러가", formParent: document.getElementById("allclear") });
      TodayGameRank.open(score);
    }
      } else {
        document.getElementById("clear-detail").textContent = `스테이지 ${stageIndex + 1} · ${moves}푸시 · 점수 ${score}`;
        showOverlay("clear");
      }
    }
  }

  function undo() {
    if (!history.length || state !== "play") return;
    restore(history.pop());
    draw();
  }

  function drawSprite(img, x, y, size, fallback) {
    if (assetsReady && img) {
      ctx.drawImage(img, x, y, size, size);
      return;
    }
    const r = size * 0.18;
    if (fallback === "grass") {
      ctx.fillStyle = "#8fd67f";
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = "#7bc86e";
      ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
      return;
    }
    if (fallback === "goal") {
      ctx.fillStyle = "rgba(255, 182, 193, 0.55)";
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff8ab5";
      ctx.font = `${Math.floor(size * 0.45)}px Jua`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", x + size / 2, y + size / 2 + 1);
      return;
    }
    if (fallback === "crate") {
      ctx.fillStyle = "#c8956a";
      roundRect(x, y, size, size, r);
      ctx.fill();
      ctx.strokeStyle = "#8a5a3a";
      ctx.lineWidth = 2;
      roundRect(x + 2, y + 2, size - 4, size - 4, r * 0.6);
      ctx.stroke();
      return;
    }
    if (fallback === "bunny") {
      ctx.fillStyle = "#ffb8d0";
      roundRect(x, y, size, size, r);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(x + size * 0.32, y + size * 0.18, size * 0.1, size * 0.22, -0.2, 0, Math.PI * 2);
      ctx.ellipse(x + size * 0.68, y + size * 0.18, size * 0.1, size * 0.22, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4a3040";
      ctx.beginPath();
      ctx.arc(x + size * 0.38, y + size * 0.52, size * 0.06, 0, Math.PI * 2);
      ctx.arc(x + size * 0.62, y + size * 0.52, size * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
    ctx.fill();
  }

  function drawWall(x, y) {
    const px = x * cell;
    const py = y * cell;
    if (assetsReady && imgs.hedge) {
      ctx.drawImage(imgs.hedge, px, py, cell, cell);
      return;
    }
    ctx.fillStyle = "#5a9e52";
    ctx.fillRect(px, py, cell, cell);
    ctx.fillStyle = "#4a8644";
    ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(px + 4, py + 4, cell - 10, 6);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const px = x * cell;
        const py = y * cell;
        if (isWall(x, y)) {
          drawWall(x, y);
          continue;
        }
        drawSprite(imgs.grass, px, py, cell, "grass");
        if (isGoal(x, y)) {
          drawSprite(imgs.goal, px + cell * 0.12, py + cell * 0.12, cell * 0.76, "goal");
        }
      }
    }

    crates.forEach((k) => {
      const [x, y] = k.split(",").map(Number);
      drawSprite(imgs.crate, x * cell + 2, y * cell + 2, cell - 4, "crate");
    });

    drawSprite(imgs.bunny, player.x * cell + 2, player.y * cell + 2, cell - 4, "bunny");

    const pdt = 0.016;
    particles.forEach((p) => {
      p.t += pdt;
      p.x += p.vx * pdt;
      p.y += p.vy * pdt;
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    particles = particles.filter((p) => p.t < p.life);
  }

  function handleDir(dx, dy) {
    tryMove(dx, dy);
  }

  document.addEventListener("keydown", (e) => {
    if (state !== "play") return;
    const k = e.key.toLowerCase();
    if (k === "arrowup" || k === "w") {
      e.preventDefault();
      handleDir(0, -1);
    } else if (k === "arrowdown" || k === "s") {
      e.preventDefault();
      handleDir(0, 1);
    } else if (k === "arrowleft" || k === "a") {
      e.preventDefault();
      handleDir(-1, 0);
    } else if (k === "arrowright" || k === "d") {
      e.preventDefault();
      handleDir(1, 0);
    } else if (k === "z" && (e.ctrlKey || e.metaKey)) undo();
  });

  document.querySelectorAll(".pad-btn").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const dir = btn.dataset.dir;
      if (dir === "up") handleDir(0, -1);
      else if (dir === "down") handleDir(0, 1);
      else if (dir === "left") handleDir(-1, 0);
      else if (dir === "right") handleDir(1, 0);
    });
  });

  canvas.addEventListener("pointerdown", (e) => {
    swipeStart = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!swipeStart || state !== "play") return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    if (Math.hypot(dx, dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) handleDir(dx > 0 ? 1 : -1, 0);
    else handleDir(0, dy > 0 ? 1 : -1);
    swipeStart = null;
  });

  document.getElementById("start-btn").addEventListener("click", () => startGame(true));
  document.getElementById("next-btn").addEventListener("click", () => {
    stageIndex += 1;
    startGame(false);
  });
  document.getElementById("again-btn").addEventListener("click", () => startGame(true));
  document.getElementById("undo-btn").addEventListener("click", undo);
  document.getElementById("restart-btn").addEventListener("click", () => {
    if (state === "clear" || state === "all") {
      state = "play";
      showOverlay(null);
    }
    resetStage();
    draw();
  });

  loadAssets().then(() => {
    showOverlay("title");
    draw();
    const tick = () => {
      if (particles.length) draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "sokoban",
      gameTitle: "상자야 굴러가",
      formParent: document.getElementById("allclear") || document.getElementById("clear") || document.body,
    });
  }

  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        state = "paused";
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "play";
        if (typeof last !== "undefined") last = performance.now();
        return true;
      },
    });
  }

})();
