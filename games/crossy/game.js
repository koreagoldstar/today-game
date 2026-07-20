(() => {
  "use strict";

  const W = 390;
  const H = 620;
  const TILE = 48;
  const COLS = 9;
  const VISIBLE_ROWS = 12;
  const STAGE_COUNT = 50;
  const ORIGIN_X = (W - COLS * TILE) / 2;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  const hud = {
    stage: document.getElementById("hud-stage"),
    goal: document.getElementById("hud-goal"),
    score: document.getElementById("hud-score"),
    best: document.getElementById("hud-best"),
  };

  const imgs = {};
  let assetsReady = false;

  let state = "title";
  let stageIndex = 0;
  let endless = false;
  let score = 0;
  let best = Number(localStorage.getItem("crossy-best") || "0");
  let lanes = [];
  let seed = 1;
  let player = { x: 4, z: 0, tx: 4, tz: 0, t: 1 };
  let moveQueue = [];
  let particles = [];
  let camZ = 0;
  let swipeStart = null;
  let last = 0;
  let frameDt = 0;
  let raf = 0;

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (overlays[name]) overlays[name].classList.remove("hidden");
  }

  function stageGoal(index) {
    if (endless) return Infinity;
    return 20 + index * 10;
  }

  function loadAssets() {
    const names = ["chick", "car_red", "car_blue", "car_purple", "car_green", "bush"];
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

  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function resetSeed(s) {
    seed = s >>> 0 || 1;
  }

  function laneColor(type) {
    if (type === "grass") return ["#c8f5b8", "#a8e88a"];
    if (type === "road") return ["#6e7682", "#5a626e"];
    if (type === "river") return ["#7ec8ff", "#5eb0ef"];
    return ["#c8c0d8", "#aaa0b8"];
  }

  function makeGrassLane(z) {
    const bushes = [];
    const count = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i += 1) {
      bushes.push({ x: Math.floor(rand() * COLS), w: 1 + Math.floor(rand() * 2) });
    }
    return { z, type: "grass", bushes, entities: [], speed: 0, dir: 1 };
  }

  function makeRoadLane(z) {
    const dir = rand() > 0.5 ? 1 : -1;
    const speed = 70 + rand() * 90 + stageIndex * 4;
    const entities = [];
    const count = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i += 1) {
      entities.push({
        x: rand() * COLS * 1.5,
        w: 1.4 + rand() * 0.8,
        color: ["red", "blue", "purple", "green"][Math.floor(rand() * 4)],
      });
    }
    return { z, type: "road", dir, speed, entities, bushes: [] };
  }

  function makeRiverLane(z) {
    const dir = rand() > 0.5 ? 1 : -1;
    const speed = 40 + rand() * 50 + stageIndex * 1.5;
    const entities = [];
    const count = 2 + Math.floor(rand() * 2); // 2~3 logs so rides are fair
    const gap = COLS / count;
    for (let i = 0; i < count; i += 1) {
      entities.push({
        x: i * gap + rand() * 0.8,
        w: 1.8 + rand() * 1.1,
      });
    }
    return { z, type: "river", dir, speed, entities, bushes: [] };
  }

  function makeRailLane(z) {
    const speed = 180 + rand() * 80;
    return {
      z,
      type: "rail",
      dir: rand() > 0.5 ? 1 : -1,
      speed,
      entities: [{ x: -3, w: 2.5, timer: 1.2 + rand() * 2.5 }],
      bushes: [],
    };
  }

  function generateLane(z) {
    if (z <= 2) return makeGrassLane(z);
    const r = rand();
    if (r < 0.42) return makeGrassLane(z);
    if (r < 0.72) return makeRoadLane(z);
    if (r < 0.9) return makeRiverLane(z);
    return makeRailLane(z);
  }

  function ensureLanes(upTo) {
    while (lanes.length <= upTo + VISIBLE_ROWS + 4) {
      const z = lanes.length;
      lanes.push(generateLane(z));
    }
  }

  let runStartedAt = 0;
  let stageStartedAt = 0;

  function resetRun(fromTitle) {
    stageStartedAt = performance.now();
    if (fromTitle) runStartedAt = performance.now();
    if (fromTitle) {
      stageIndex = 0;
      endless = false;
      score = 0;
    }
    resetSeed(1000 + stageIndex * 77);
    lanes = [makeGrassLane(0), makeGrassLane(1), makeGrassLane(2)];
    ensureLanes(30);
    player = { x: 4, z: 0, tx: 4, tz: 0, t: 1, onLog: null, logOffset: null };
    moveQueue = [];
    particles = [];
    camZ = 0;
    updateHud();
  }

  function updateHud() {
    hud.stage.textContent = endless ? "∞" : String(stageIndex + 1);
    hud.goal.textContent = endless ? "∞" : String(stageGoal(stageIndex));
    hud.score.textContent = String(score);
    hud.best.textContent = String(best);
  }

  function startGame(fromTitle) {
    state = "play";
    showOverlay(null);
    if (fromTitle && window.TodayGameRank) TodayGameRank.reset();
    resetRun(fromTitle);
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 10; i += 1) {
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * (40 + Math.random() * 120),
        vy: Math.sin(a) * (40 + Math.random() * 120),
        life: 0.4 + Math.random() * 0.3,
        t: 0,
        color,
      });
    }
  }

  function screenY(worldZ) {
    return H - 120 - (worldZ - camZ) * TILE;
  }

  function drawSprite(img, x, y, w, h, flipX = false) {
    if (assetsReady && img) {
      ctx.save();
      if (flipX) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        ctx.drawImage(img, x, y, w, h);
      }
      ctx.restore();
      return;
    }
    const rad = Math.min(w, h) * 0.22;
    if (img === imgs.chick) {
      ctx.fillStyle = "#ffe27a";
      roundRect(x, y, w, h, rad);
      ctx.fill();
      ctx.fillStyle = "#ff8ab5";
      ctx.beginPath();
      ctx.arc(x + w * 0.35, y + h * 0.38, w * 0.08, 0, Math.PI * 2);
      ctx.arc(x + w * 0.65, y + h * 0.38, w * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff6b3d";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.42, y + h * 0.12);
      ctx.lineTo(x + w * 0.5, y);
      ctx.lineTo(x + w * 0.58, y + h * 0.12);
      ctx.fill();
      return;
    }
    if (img === imgs.car_red || img === imgs.car_blue || img === imgs.car_purple || img === imgs.car_green) {
      const fill =
        img === imgs.car_red
          ? "#ff6bb5"
          : img === imgs.car_blue
            ? "#5b9fff"
            : img === imgs.car_purple
              ? "#b48cff"
              : "#8be05a";
      ctx.fillStyle = fill;
      roundRect(x + 2, y + h * 0.2, w - 4, h * 0.6, rad * 0.6);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      roundRect(x + w * 0.15, y + h * 0.28, w * 0.28, h * 0.22, 4);
      roundRect(x + w * 0.57, y + h * 0.28, w * 0.28, h * 0.22, 4);
      ctx.fill();
      return;
    }
    if (img === imgs.bush) {
      ctx.fillStyle = "#5cb85c";
      ctx.beginPath();
      ctx.arc(x + w * 0.3, y + h * 0.65, w * 0.28, 0, Math.PI * 2);
      ctx.arc(x + w * 0.55, y + h * 0.55, w * 0.32, 0, Math.PI * 2);
      ctx.arc(x + w * 0.75, y + h * 0.68, w * 0.24, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = "#ffe27a";
    roundRect(x, y, w, h, rad);
    ctx.fill();
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

  function laneAt(z) {
    ensureLanes(z);
    return lanes[z];
  }

  function entityWorldX(ent, lane, dt) {
    let x = ent.x;
    if (lane.type === "rail") {
      ent.timer -= dt;
      if (ent.timer <= 0) {
        ent.x = lane.dir > 0 ? -3 : COLS + 1;
        ent.timer = 2 + rand() * 3;
      }
      x = ent.x + lane.dir * lane.speed * dt * 0.015;
      ent.x = x;
      return x;
    }
    x += lane.dir * lane.speed * dt * 0.012;
    if (x < -3) x = COLS + 2;
    if (x > COLS + 2) x = -3;
    ent.x = x;
    return x;
  }

  function tryMove(dx, dz) {
    if (state !== "play" || player.t < 1) return;
    const nx = player.x + dx;
    const nz = player.z + dz;
    if (nx < 0 || nx >= COLS || nz < 0) return;

    const lane = laneAt(nz);
    if (lane.type === "grass") {
      for (const b of lane.bushes) {
        if (nx >= b.x && nx < b.x + b.w) return;
      }
    }

    moveQueue.push({ x: nx, z: nz });
    if (moveQueue.length === 1) beginMove();
  }

  function beginMove() {
    if (!moveQueue.length) return;
    const m = moveQueue[0];
    player.tx = m.x;
    player.tz = m.z;
    player.t = 0;
  }

  function finishMove() {
    player.x = player.tx;
    player.z = player.tz;
    player.t = 1;
    moveQueue.shift();
    if (player.z > score) {
      score = player.z;
      if (score > best) {
        best = score;
        localStorage.setItem("crossy-best", String(best));
      }
    }
    ensureLanes(player.z + 8);

    // Landing on river: snap onto overlapping / nearest boat so rides feel fair
    const lane = laneAt(player.z);
    if (lane.type === "river") {
      let log = findLogUnder(player.x, lane);
      if (!log) {
        let best = null;
        let bestD = 1.0;
        for (const ent of lane.entities) {
          const mid = ent.x + ent.w / 2;
          const d = Math.abs(player.x + 0.5 - mid);
          if (d < bestD) {
            bestD = d;
            best = ent;
          }
        }
        log = best;
      }
      if (log) {
        const minX = log.x;
        const maxX = log.x + log.w - 1;
        player.x = Math.max(minX, Math.min(maxX, player.x));
        player.tx = player.x;
        player.onLog = log;
        player.logOffset = player.x - log.x;
      } else {
        player.onLog = null;
        player.logOffset = null;
        die("강에 빠졌어요");
        return;
      }
    } else {
      player.onLog = null;
      player.logOffset = null;
    }

    updateHud();
    checkStageClear();
    if (state !== "play") return;
    if (moveQueue.length) beginMove();
  }

  function checkStageClear() {
    if (endless) return;
    if (score >= stageGoal(stageIndex)) {
      const elapsed = (performance.now() - stageStartedAt) / 1000;
      score += Math.max(0, Math.floor(20 - elapsed)) * 8;
      updateHud();
      state = "clear";
      document.getElementById("clear-detail").textContent = `${score}칸 전진 · 스테이지 ${stageIndex + 1} 클리어!`;
      showOverlay("clear");
    }
  }

  function die(reason) {
    if (state !== "play") return;
    state = "over";
    player.onLog = null;
    player.logOffset = null;
    const px = ORIGIN_X + player.x * TILE + TILE / 2;
    const py = screenY(player.z);
    spawnParticles(px, py, "#ff8ab5");
    document.getElementById("over-detail").textContent = `${reason} · ${score}칸 · 스테이지 ${endless ? "∞" : stageIndex + 1}`;
    showOverlay("over");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "crossy", gameTitle: "삐약이 건너기", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  /** Generous overlap: player body vs log (not "fully inside" which was too harsh). */
  function findLogUnder(px, lane) {
    const left = px + 0.08;
    const right = px + 0.92;
    for (const log of lane.entities) {
      if (right > log.x && left < log.x + log.w) return log;
    }
    return null;
  }

  function updatePlayer(dt) {
    if (player.t < 1) {
      player.t = Math.min(1, player.t + dt * 9);
      if (player.t >= 1) finishMove();
    }
    if (state !== "play") return;

    const lane = laneAt(player.z);
    if (lane.type === "river") {
      let log = findLogUnder(player.x, lane);
      if (!log && player.onLog && lane.entities.includes(player.onLog)) {
        // stay glued if we were riding and still near that boat
        const tracked = player.onLog;
        if (Math.abs(player.x + 0.5 - (tracked.x + tracked.w / 2)) < tracked.w * 0.7 + 0.4) {
          log = tracked;
        }
      }

      if (log && player.t >= 1) {
        player.onLog = log;
        if (player.logOffset == null) player.logOffset = player.x - log.x;
        // clamp offset so chick stays on boat
        player.logOffset = Math.max(0, Math.min(log.w - 1, player.logOffset));
        player.x = log.x + player.logOffset;
        player.tx = player.x;

        if (player.x < -0.35 || player.x > COLS - 0.65) {
          die("강에 빠졌어요");
          return;
        }
      } else if (player.t >= 1) {
        player.onLog = null;
        player.logOffset = null;
        die("강에 빠졌어요");
        return;
      }
    } else {
      player.onLog = null;
      player.logOffset = null;
    }

    if (lane.type === "road" && player.t >= 1) {
      for (const car of lane.entities) {
        const cx = car.x;
        const carLeft = cx;
        const carRight = cx + car.w;
        const pLeft = player.x + 0.2;
        const pRight = player.x + 0.8;
        if (pRight > carLeft && pLeft < carRight) die("차에 치였어요");
      }
    }

    if (lane.type === "rail" && player.t >= 1) {
      for (const train of lane.entities) {
        const tx = train.x;
        const pLeft = player.x + 0.15;
        const pRight = player.x + 0.85;
        if (pRight > tx && pLeft < tx + train.w) die("기차에 치였어요");
      }
    }

    const targetCam = player.z - 3;
    camZ += (targetCam - camZ) * Math.min(1, dt * 6);
  }

  function drawLane(lane, dt) {
    const y = screenY(lane.z);
    if (y < -TILE || y > H + TILE) return;

    const [c1, c2] = laneColor(lane.type);
    const laneGradient = ctx.createLinearGradient(0, y, 0, y + TILE);
    laneGradient.addColorStop(0, lane.z % 2 ? c1 : c2);
    laneGradient.addColorStop(1, lane.z % 2 ? c2 : c1);
    ctx.fillStyle = laneGradient;
    ctx.fillRect(ORIGIN_X, y, COLS * TILE, TILE);

    if (lane.type === "road") {
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(ORIGIN_X, y + 2, COLS * TILE, 3);
      ctx.fillRect(ORIGIN_X, y + TILE - 5, COLS * TILE, 3);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < COLS; i += 2) {
        roundRect(ORIGIN_X + i * TILE + TILE * 0.22, y + TILE * 0.46, TILE * 0.56, 3, 2);
        ctx.fill();
      }
    }

    if (lane.type === "river") {
      const waveTime = performance.now() * 0.025;
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        const wx = ORIGIN_X + ((lane.z * 31 + i * 108 + waveTime) % (COLS * TILE + 50)) - 25;
        ctx.beginPath();
        ctx.moveTo(wx, y + 10 + i * 9);
        ctx.quadraticCurveTo(wx + 12, y + 5 + i * 9, wx + 24, y + 10 + i * 9);
        ctx.quadraticCurveTo(wx + 36, y + 15 + i * 9, wx + 48, y + 10 + i * 9);
        ctx.stroke();
      }
    }

    if (lane.type === "rail") {
      ctx.fillStyle = "#735f55";
      for (let x = ORIGIN_X; x < ORIGIN_X + COLS * TILE; x += 25) {
        ctx.fillRect(x, y + 8, 7, TILE - 16);
      }
      ctx.fillStyle = "#5d6570";
      ctx.fillRect(ORIGIN_X, y + TILE * 0.35, COLS * TILE, 4);
      ctx.fillRect(ORIGIN_X, y + TILE * 0.62, COLS * TILE, 4);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(ORIGIN_X, y + TILE * 0.35, COLS * TILE, 1);
    }

    if (lane.type === "grass") {
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      for (let i = 0; i < COLS; i += 1) {
        const gx = ORIGIN_X + i * TILE + ((lane.z * 17 + i * 23) % 30);
        ctx.fillRect(gx, y + 7 + ((i * 13) % 28), 3, 6);
      }
      lane.bushes.forEach((b) => {
        for (let n = 0; n < b.w; n += 1) {
          const bx = ORIGIN_X + (b.x + n) * TILE;
          drawShadow(bx + TILE / 2, y + TILE * 0.78, TILE * 0.34, TILE * 0.1);
          drawSprite(imgs.bush, bx + 2, y + 1, TILE - 4, TILE - 5);
        }
      });
    }

    lane.entities.forEach((ent) => {
      const ex = ORIGIN_X + ent.x * TILE;
      if (lane.type === "road") {
        const carKey =
          ent.color === "blue"
            ? "car_blue"
            : ent.color === "purple"
              ? "car_purple"
              : ent.color === "green"
                ? "car_green"
                : "car_red";
        const img = imgs[carKey];
        drawShadow(ex + TILE * ent.w / 2, y + TILE * 0.78, TILE * ent.w * 0.38, 5);
        drawSprite(img, ex, y + 3, TILE * ent.w, TILE - 6, lane.dir < 0);
      } else if (lane.type === "river") {
        const logGradient = ctx.createLinearGradient(ex, y, ex, y + TILE);
        logGradient.addColorStop(0, "#e0aa72");
        logGradient.addColorStop(1, "#9a603b");
        ctx.fillStyle = logGradient;
        ctx.beginPath();
        const lw = TILE * ent.w;
        const lh = TILE - 20;
        const ly = y + 10;
        ctx.moveTo(ex + 8, ly);
        ctx.lineTo(ex + lw - 8, ly);
        ctx.quadraticCurveTo(ex + lw, ly, ex + lw, ly + 8);
        ctx.lineTo(ex + lw, ly + lh - 8);
        ctx.quadraticCurveTo(ex + lw, ly + lh, ex + lw - 8, ly + lh);
        ctx.lineTo(ex + 8, ly + lh);
        ctx.quadraticCurveTo(ex, ly + lh, ex, ly + lh - 8);
        ctx.lineTo(ex, ly + 8);
        ctx.quadraticCurveTo(ex, ly, ex + 8, ly);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(90,45,20,0.35)";
        ctx.lineWidth = 2;
        for (let lx = ex + 16; lx < ex + lw - 10; lx += 22) {
          ctx.beginPath();
          ctx.moveTo(lx, y + 13);
          ctx.lineTo(lx, y + lh + 7);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        roundRect(ex + 8, y + 14, lw - 16, 4, 2);
        ctx.fill();
      } else if (lane.type === "rail") {
        drawShadow(ex + TILE * ent.w / 2, y + TILE * 0.78, TILE * ent.w * 0.42, 6);
        const trainG = ctx.createLinearGradient(ex, y, ex + TILE * ent.w, y);
        trainG.addColorStop(0, "#ff5a6b");
        trainG.addColorStop(1, "#d83252");
        ctx.fillStyle = trainG;
        roundRect(ex, y + 4, TILE * ent.w, TILE - 8, 10);
        ctx.fill();
        ctx.fillStyle = "#bceaff";
        for (let wx = ex + 12; wx < ex + TILE * ent.w - 14; wx += 28) {
          roundRect(wx, y + 12, 16, 10, 4);
          ctx.fill();
        }
        ctx.fillStyle = "#ffe27a";
        ctx.beginPath();
        ctx.arc(lane.dir > 0 ? ex + TILE * ent.w - 7 : ex + 7, y + TILE / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function drawShadow(x, y, rx, ry) {
    ctx.fillStyle = "rgba(30,45,35,0.2)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#7ec8ff");
    bg.addColorStop(0.35, "#b8e8ff");
    bg.addColorStop(1, "#e8ffd8");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // smiling sun like thumb
    ctx.fillStyle = "#ffe27a";
    ctx.beginPath();
    ctx.arc(48, 48, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 200, 80, 0.55)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(48 + Math.cos(a) * 32, 48 + Math.sin(a) * 32);
      ctx.lineTo(48 + Math.cos(a) * 40, 48 + Math.sin(a) * 40);
      ctx.stroke();
    }
    ctx.fillStyle = "#5a4030";
    ctx.beginPath();
    ctx.arc(40, 44, 2.5, 0, Math.PI * 2);
    ctx.arc(56, 44, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5a4030";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(48, 50, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // fluffy clouds
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.ellipse(200, 40, 36, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(180, 44, 20, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(220, 44, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(320, 70, 28, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(305, 74, 16, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(335, 74, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    const minZ = Math.max(0, Math.floor(camZ) - 1);
    const maxZ = Math.floor(camZ) + VISIBLE_ROWS;
    for (let z = minZ; z <= maxZ; z += 1) {
      drawLane(laneAt(z), frameDt);
    }

    const px = ORIGIN_X + (player.x + (player.tx - player.x) * player.t) * TILE;
    const pz = player.z + (player.tz - player.z) * player.t;
    const hop = player.t < 1 ? Math.sin(player.t * Math.PI) * 12 : 0;
    const py = screenY(pz) - hop;
    drawShadow(px + TILE / 2, screenY(pz) + TILE * 0.78, TILE * 0.28, 5);
    ctx.save();
    const squash = player.t < 1 ? 1 + Math.sin(player.t * Math.PI) * 0.08 : 1;
    ctx.translate(px + TILE / 2, py + TILE / 2);
    ctx.scale(1 / squash, squash);
    drawSprite(imgs.chick, -TILE * 0.43, -TILE * 0.48, TILE * 0.86, TILE * 0.86);
    ctx.restore();

    particles.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "13px Jua";
    ctx.textAlign = "center";
    ctx.fillText("↑앞 · ←→이동 · 스와이프 · WASD", W / 2, H - 8);
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    frameDt = dt;

    if (state === "play") {
      // Move hazards first so river boats stay in sync with the rider
      lanes.forEach((lane) => {
        if (lane.z >= camZ - 1 && lane.z <= camZ + VISIBLE_ROWS) {
          lane.entities.forEach((ent) => entityWorldX(ent, lane, dt));
        }
      });
      updatePlayer(dt);
      particles.forEach((p) => {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      });
      particles = particles.filter((p) => p.t < p.life);
    }

    draw();
    raf = requestAnimationFrame(loop);
  }

  function handleKey(e) {
    if (state !== "play") return;
    const k = e.key.toLowerCase();
    if (k === "arrowup" || k === "w") {
      e.preventDefault();
      tryMove(0, 1);
    } else if (k === "arrowdown" || k === "s") {
      e.preventDefault();
      tryMove(0, -1);
    } else if (k === "arrowleft" || k === "a") {
      e.preventDefault();
      tryMove(-1, 0);
    } else if (k === "arrowright" || k === "d") {
      e.preventDefault();
      tryMove(1, 0);
    }
  }

  document.addEventListener("keydown", handleKey);

  document.querySelectorAll(".pad-btn").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const dir = btn.dataset.dir;
      if (dir === "up") tryMove(0, 1);
      else if (dir === "left") tryMove(-1, 0);
      else if (dir === "right") tryMove(1, 0);
    });
  });

  canvas.addEventListener("pointerdown", (e) => {
    swipeStart = { x: e.clientX, y: e.clientY, t: Date.now() };
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!swipeStart || state !== "play") return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (Math.max(adx, ady) < 18) {
      tryMove(0, 1);
    } else if (adx > ady) {
      tryMove(dx > 0 ? 1 : -1, 0);
    } else {
      tryMove(0, dy < 0 ? 1 : -1);
    }
    swipeStart = null;
  });

  document.getElementById("start-btn").addEventListener("click", () => startGame(true));
  document.getElementById("next-btn").addEventListener("click", () => {
    stageIndex += 1;
    if (stageIndex >= STAGE_COUNT) {
      showOverlay("all");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "crossy", gameTitle: "삐약이 건너기", formParent: overlays.all });
      TodayGameRank.open(score);
    }
      return;
    }
    startGame(false);
  });
  document.getElementById("retry-btn").addEventListener("click", () => startGame(false));
  document.getElementById("endless-btn").addEventListener("click", () => {
    endless = true;
    startGame(false);
  });
  document.getElementById("again-btn")?.addEventListener("click", () => startGame(true));

  hud.best.textContent = String(best);
  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "crossy",
      gameTitle: "삐약이 건너기",
      formParent: overlays.over || overlays.all || document.body,
    });
  }

  loadAssets().then(() => {
    showOverlay("title");
    last = performance.now();
    raf = requestAnimationFrame(loop);
  });
})();
