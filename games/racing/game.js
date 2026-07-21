(() => {
  "use strict";

  const W = 390;
  const H = 640;
  const LANES = 3;
  const ROAD_X = 52;
  const ROAD_W = W - 104;
  const LANE_W = ROAD_W / LANES;
  const PLAYER_Y = H - 118;
  const LERP = 14;
  const BEST_KEY = "speed-bbaek-best";

  const STAGES = Array.from({ length: 50 }, (_, i) => ({
    goal: 400 + i * 120,
    speed: 1 + i * 0.09,
    spawn: Math.max(0.55, 1.35 - i * 0.035),
    name: `스테이지 ${i + 1}`,
  }));

  const imgs = { player: null, car_red: null, car_blue: null, tree: null, cone: null };
  const THEMES = [
    { grass: "#7BC85A", grassDark: "#5AAA40", curb: "#FFFFFF", accent: "#FF5A6A", sky: "#6EC8FF" },
    { grass: "#6BD070", grassDark: "#4AB858", curb: "#FFFFFF", accent: "#FF5A6A", sky: "#8AD8FF" },
    { grass: "#8FD36F", grassDark: "#6ABA50", curb: "#FFFFFF", accent: "#FF6B9A", sky: "#A8E0FF" },
    { grass: "#74C868", grassDark: "#52A848", curb: "#FFFFFF", accent: "#FF8A40", sky: "#7ED0FF" },
  ];

  function isPunchBg(r, g, b, a) {
    if (a < 28) return true;
    if (r > 220 && g < 40 && b > 220) return true;
    if (r > 185 && b > 175 && g < 145 && r + b > g * 2.1) return true;
    if (r > 210 && b > 200 && g < 160 && Math.abs(r - b) < 90) return true;
    if (r > 220 && g > 160 && b > 190 && r > g + 20 && b > g + 10 && (r + g + b) / 3 > 195) return true;
    if (r > 230 && g > 190 && b > 210 && Math.abs(r - b) < 50) return true;
    if (r > 235 && g > 210 && b > 225) return true;
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

  function loadAssets() {
    return Promise.all(
      Object.keys(imgs).map(
        (key) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              imgs[key] = punchBg(img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `assets/${key}.png`;
          })
      )
    );
  }

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

  let state = "title";
  let stageIndex = 0;
  let runStartedAt = 0;
  let stageStartedAt = 0;
  let endless = false;
  let score = 0;
  let bonusScore = 0;
  let stageDist = 0;
  let totalDist = 0;
  let scroll = 0;
  let dashOff = 0;
  let spawnAcc = 0;
  let player = { lane: 1, x: laneX(1), targetLane: 1 };
  let enemies = [];
  let trees = [];
  let particles = [];
  let exhaust = [];
  let flashLife = 0;
  let nearFlash = 0;
  let steering = 0;
  let last = 0;
  let raf = 0;
  let swipeX = 0;

  function laneX(lane) {
    return ROAD_X + LANE_W * (lane + 0.5);
  }

  function showOverlay(key) {
    Object.entries(overlays).forEach(([k, el]) => el.classList.toggle("hidden", k !== key));
  }

  function updateHud() {
    const st = STAGES[stageIndex] || STAGES[19];
    document.getElementById("hud-stage").textContent = endless ? "∞" : String(stageIndex + 1);
    document.getElementById("hud-dist").textContent = String(Math.floor(stageDist));
    document.getElementById("hud-score").textContent = String(score);
    document.getElementById("hud-best").textContent = String(Number(localStorage.getItem(BEST_KEY) || 0));
    if (!endless) {
      const goal = st.goal;
      void goal;
    }
  }

  function resetRun() {
    stageDist = 0;
    scroll = 0;
    dashOff = 0;
    spawnAcc = 0;
    player = { lane: 1, x: laneX(1), targetLane: 1 };
    enemies = [];
    trees = [];
    particles = [];
    exhaust = [];
    flashLife = 0;
    nearFlash = 0;
    steering = 0;
    for (let i = 0; i < 8; i += 1) {
      trees.push(makeTree(-40 + i * 90));
    }
    updateHud();
  }

  function makeTree(y) {
    return {
      y,
      side: Math.random() < 0.5 ? "left" : "right",
      scale: 0.7 + Math.random() * 0.32,
      kind: Math.random() < 0.78 ? "tree" : "cone",
    };
  }

  function burst(x, y, colors, count = 10) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 120;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.35,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 4,
      });
    }
  }

  function spawnEnemy() {
    const lane = Math.floor(Math.random() * LANES);
    const occupied = enemies.some((e) => e.lane === lane && e.y < 140);
    if (occupied) return;
    enemies.push({
      lane,
      y: -90,
      type: Math.random() < 0.5 ? "car_red" : "car_blue",
      nearMissed: false,
    });
  }

  function moveLane(dir) {
    if (state !== "play") return;
    const next = Math.max(0, Math.min(LANES - 1, player.targetLane + dir));
    if (next === player.targetLane) return;
    player.targetLane = next;
    steering = dir * 1;
  }

  function enemyBox(e) {
    const w = 34;
    const h = 48;
    return {
      x: laneX(e.lane) - w / 2,
      y: e.y + 12,
      w,
      h,
    };
  }

  function playerBox() {
    const w = 36;
    const h = 52;
    return {
      x: player.x - w / 2,
      y: PLAYER_Y - h / 2 + 8,
      w,
      h,
    };
  }

  function playerLaneApprox() {
    return Math.max(0, Math.min(LANES - 1, Math.round((player.x - ROAD_X) / LANE_W - 0.5)));
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function drawRoad() {
    const theme = THEMES[stageIndex % THEMES.length];
    const grass = ctx.createLinearGradient(0, 0, W, H);
    grass.addColorStop(0, theme.grass);
    grass.addColorStop(1, theme.grassDark);
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, W, H);

    // soft hill bands
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let y = -24; y < H + 24; y += 46) {
      const gy = ((y + scroll * 0.42) % (H + 48)) - 24;
      ctx.beginPath();
      ctx.ellipse(ROAD_X / 2, gy + 10, ROAD_X * 0.38, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(W - ROAD_X / 2, gy + 18, ROAD_X * 0.36, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowColor = "rgba(29,35,55,0.34)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#5A6270";
    ctx.fillRect(ROAD_X - 4, 0, ROAD_W + 8, H);
    ctx.shadowBlur = 0;

    const road = ctx.createLinearGradient(ROAD_X, 0, ROAD_X + ROAD_W, 0);
    road.addColorStop(0, "#6A7280");
    road.addColorStop(0.5, "#8A92A0");
    road.addColorStop(1, "#6A7280");
    ctx.fillStyle = road;
    ctx.fillRect(ROAD_X, 0, ROAD_W, H);

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let y = 0; y < H; y += 32) {
      const yy = (y + scroll * 0.7) % H;
      ctx.fillRect(ROAD_X + 12 + (y % 3) * 34, yy, 28, 2);
      ctx.fillRect(ROAD_X + ROAD_W - 66, yy + 15, 36, 2);
    }

    // red-and-white racing curbs
    const curbH = 22;
    for (let y = -curbH; y < H + curbH; y += curbH) {
      const yy = ((y + scroll) % (H + curbH * 2)) - curbH;
      const even = Math.floor((y + scroll) / curbH) % 2 === 0;
      ctx.fillStyle = even ? theme.curb : theme.accent;
      ctx.fillRect(ROAD_X - 8, yy, 8, curbH + 1);
      ctx.fillRect(ROAD_X + ROAD_W, yy, 8, curbH + 1);
    }

    dashOff = scroll % 64;
    ctx.strokeStyle = "rgba(255,255,255,0.88)";
    ctx.lineWidth = 4;
    ctx.setLineDash([28, 36]);
    ctx.lineDashOffset = dashOff;
    for (let i = 1; i < LANES; i += 1) {
      const x = ROAD_X + LANE_W * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawTrees() {
    for (const t of trees) {
      const img = imgs[t.kind];
      if (!img) continue;
      const base = t.kind === "tree" ? 64 : 28;
      const ratio = img.width / img.height;
      const th = base * t.scale;
      const tw = th * ratio;
      const x = t.side === "left" ? ROAD_X / 2 - tw / 2 - 4 : W - ROAD_X / 2 - tw / 2 + 4;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, (t.y + 80) / 80));
      ctx.shadowColor = "rgba(28,45,40,0.28)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 7;
      ctx.drawImage(img, x, t.y, tw, th);
      ctx.restore();
    }
  }

  function drawCarSprite(img, cx, cy, w, h, angle = 0, playerCar = false) {
    if (!img) return;
    ctx.save();
    ctx.translate(cx, cy);
    // 스프라이트 앞이 아래를 보고 있어서, 진행 방향(위)으로 180도 돌림
    ctx.rotate(Math.PI + angle);
    ctx.fillStyle = "rgba(25,31,45,0.28)";
    ctx.beginPath();
    ctx.ellipse(3, h * 0.13, w * 0.43, h * 0.43, 0, 0, Math.PI * 2);
    ctx.fill();
    if (playerCar) {
      ctx.shadowColor = "rgba(255,211,62,0.5)";
      ctx.shadowBlur = 16;
    }
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function addExhaust(dt) {
    if (Math.random() > dt * 22) return;
    exhaust.push({
      x: player.x + (Math.random() - 0.5) * 14,
      y: PLAYER_Y + 37,
      life: 0.35,
      size: 3 + Math.random() * 3,
    });
  }

  function drawSpeedFx(speedMul) {
    if (state !== "play") return;
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.32, 0.08 + speedMul * 0.04)})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i += 1) {
      const x = 12 + ((i * 47 + Math.floor(scroll * 0.13)) % (W - 24));
      const y = (i * 83 + scroll * (0.65 + (i % 3) * 0.08)) % H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 18 + speedMul * 6);
      ctx.stroke();
    }
  }

  function update(dt) {
    if (state !== "play") return;

    const st = STAGES[Math.min(stageIndex, 19)];
    const speedMul = endless ? st.speed * 1.35 + Math.min(2, totalDist / 8000) : st.speed;
    const scrollSpeed = 180 * speedMul;

    scroll += scrollSpeed * dt;
    stageDist += scrollSpeed * dt * 0.12;
    totalDist += scrollSpeed * dt * 0.12;
    score = Math.floor(totalDist) + bonusScore;

    player.x += (laneX(player.targetLane) - player.x) * Math.min(1, LERP * dt);
    player.lane = player.targetLane;
    steering *= Math.max(0, 1 - dt * 8);
    addExhaust(dt);

    spawnAcc += dt;
    if (spawnAcc >= st.spawn) {
      spawnAcc = 0;
      spawnEnemy();
    }

    for (const t of trees) t.y += scrollSpeed * dt;
    trees = trees.filter((t) => t.y < H + 80);
    while (trees.length < 10) {
      const top = Math.min(...trees.map((t) => t.y), 0);
      trees.push(makeTree(top - (70 + Math.random() * 50)));
    }

    const pb = playerBox();
    const pLane = playerLaneApprox();
    for (const e of enemies) {
      e.y += scrollSpeed * dt * 1.05;
      const eb = enemyBox(e);
      if (!e.nearMissed && !overlap(pb, eb)) {
        const laneDiff = Math.abs(e.lane - pLane);
        const vert = Math.abs(e.y + eb.h / 2 - PLAYER_Y);
        if (laneDiff === 1 && vert < 36 && e.y > PLAYER_Y - 120) {
          e.nearMissed = true;
          bonusScore += 25;
          nearFlash = 0.7;
          burst(player.x, PLAYER_Y - 20, ["#ffd86b", "#ff9ec4", "#fff"]);
        }
      }
      // 같은 차선에서만 충돌 (차선 변경 중 옆차와 스치는 오판 방지)
      if (e.lane === pLane && overlap(pb, eb)) {
        state = "over";
        flashLife = 0.5;
        burst(player.x, PLAYER_Y, ["#ff6b6b", "#ffb347", "#fff"], 18);
        const best = Number(localStorage.getItem(BEST_KEY) || 0);
        if (score > best) localStorage.setItem(BEST_KEY, String(score));
        document.getElementById("over-detail").textContent =
          `${Math.floor(stageDist)}m 달림 · 점수 ${score}`;
        showOverlay("over");
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "racing", gameTitle: "스피드 삐약이", formParent: overlays.over });
      TodayGameRank.open(score);
    }
        updateHud();
        return;
      }
    }
    enemies = enemies.filter((e) => e.y < H + 100);

    if (!endless && stageDist >= st.goal) {
      const elapsed = (performance.now() - stageStartedAt) / 1000;
      score += Math.max(0, Math.floor(20 - elapsed)) * 8;
      state = "clear";
      burst(W / 2, H / 2, ["#9ed4ff", "#ff9ec4", "#fff"], 20);
      document.getElementById("clear-detail").textContent =
        `${st.goal}m 달성! 점수 ${score}`;
      if (stageIndex >= 19) {
        showOverlay("all");
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "racing", gameTitle: "스피드 삐약이", formParent: overlays.all });
      TodayGameRank.open(score);
    }
      } else {
        showOverlay("clear");
      }
      updateHud();
      return;
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = exhaust.length - 1; i >= 0; i -= 1) {
      const p = exhaust[i];
      p.life -= dt;
      p.y += scrollSpeed * dt * 0.24;
      p.size += dt * 11;
      if (p.life <= 0) exhaust.splice(i, 1);
    }

    if (flashLife > 0) flashLife -= dt;
    if (nearFlash > 0) nearFlash -= dt;
    updateHud();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawProgress(st) {
    if (state !== "play") return;
    const x = ROAD_X + 12;
    const y = H - 18;
    const w = ROAD_W - 24;
    const pct = endless ? (stageDist % 500) / 500 : Math.min(1, stageDist / st.goal);
    ctx.fillStyle = "rgba(24,31,48,0.45)";
    roundRect(x, y, w, 8, 4);
    ctx.fill();
    if (pct > 0) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, "#ffe15b");
      g.addColorStop(1, "#ff7ca9");
      ctx.fillStyle = g;
      roundRect(x, y, Math.max(8, w * pct), 8, 4);
      ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const st = STAGES[Math.min(stageIndex, 19)];
    const speedMul = endless ? st.speed * 1.35 : st.speed;
    drawRoad();
    drawTrees();
    drawSpeedFx(speedMul);

    for (const e of enemies) {
      const img = imgs[e.type];
      const bob = Math.sin((e.y + e.lane * 31) * 0.06) * 0.012;
      drawCarSprite(img, laneX(e.lane), e.y + 44, 58, 94, bob);
    }

    for (const p of exhaust) {
      ctx.globalAlpha = Math.max(0, p.life * 1.8);
      ctx.fillStyle = "#e6f5ff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawCarSprite(imgs.player, player.x, PLAYER_Y, 64, 108, steering * 0.12, true);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (nearFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, nearFlash * 2);
      ctx.font = '20px "Bagel Fat One", "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#ff6b9d";
      ctx.shadowBlur = 10;
      ctx.fillText("아슬아슬! +25", W / 2, 118);
      ctx.restore();
    }

    if (flashLife > 0) {
      ctx.fillStyle = `rgba(255,120,120,${flashLife})`;
      ctx.fillRect(0, 0, W, H);
    }

    drawProgress(st);
  }

  function loop(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
    last = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function startPlay(fromTitle) {
    if (fromTitle) {
      stageIndex = 0;
      endless = false;
      score = 0;
      bonusScore = 0;
      totalDist = 0;
      runStartedAt = performance.now();
      if (window.TodayGameRank) TodayGameRank.reset();
    }
    stageStartedAt = performance.now();
    resetRun();
    state = "play";
    showOverlay(null);
    updateHud();
  }

  document.getElementById("start-btn").addEventListener("click", () => startPlay(true));
  document.getElementById("retry-btn").addEventListener("click", () => startPlay(true));
  document.getElementById("next-btn").addEventListener("click", () => {
    stageIndex += 1;
    startPlay(false);
  });
  document.getElementById("endless-btn").addEventListener("click", () => {
    endless = true;
    startPlay(false);
  });

  document.querySelectorAll(".pad-btn").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      moveLane(btn.dataset.dir === "left" ? -1 : 1);
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      e.preventDefault();
      moveLane(-1);
    }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      e.preventDefault();
      moveLane(1);
    }
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    e.preventDefault();
    swipeX = e.clientX;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (state !== "play") return;
    e.preventDefault();
    const dx = e.clientX - swipeX;
    if (Math.abs(dx) > 24) {
      moveLane(dx < 0 ? -1 : 1);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    moveLane(e.clientX < rect.left + rect.width / 2 ? -1 : 1);
  });

  loadAssets().then(() => {
    updateHud();
    showOverlay("title");
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "racing",
      gameTitle: "스피드 삐약이",
      formParent: overlays.over || overlays.all || document.body,
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
