(() => {
  "use strict";

  const GAME_ID = "fish-rush";
  const W = 390;
  const H = 700;
  const PIVOT_X = W * 0.5;
  const PIVOT_Y = 118;
  const WATER_Y = 156;
  const MAX_LEN = 520;

  /** value = money, weight = reel drag, rarity = spawn weight */
  const SPECIES = [
    { id: "anchovy", name: "멸치", value: 5, weight: 0.4, r: 15, rarity: 3.4, shape: "slim", palette: ["#d7e4ec", "#7f95a6", "#f5fbff", "#4a5c6a"] },
    { id: "mackerel", name: "고등어", value: 16, weight: 0.85, r: 23, rarity: 2.8, shape: "stripe", palette: ["#3aa39a", "#1b5e5a", "#c8fff4", "#0f3a38"] },
    { id: "sea-bream", name: "도미", value: 38, weight: 1.15, r: 27, rarity: 1.9, shape: "tall", palette: ["#ef7a7a", "#b33d3d", "#ffe4dc", "#7a2020"] },
    { id: "salmon", name: "연어", value: 58, weight: 1.45, r: 31, rarity: 1.35, shape: "long", palette: ["#ef8f5c", "#c24e28", "#ffd8c0", "#7a2e14"] },
    { id: "tuna", name: "참치", value: 95, weight: 2.15, r: 38, rarity: 0.85, shape: "thick", palette: ["#3a6fb0", "#1a3f72", "#b8d6ff", "#0d2748"] },
    { id: "blowfish", name: "복어", value: 78, weight: 1.35, r: 29, rarity: 0.75, shape: "puff", palette: ["#f4df8a", "#c9a43a", "#fff6d0", "#8a6e18"] },
    { id: "goldfish", name: "황금잉어", value: 180, weight: 1.7, r: 33, rarity: 0.28, shape: "koi", special: "gold", palette: ["#f2c84a", "#c48a0e", "#fff3b8", "#8a5c08"] },
    { id: "shark", name: "상어", value: 260, weight: 3.1, r: 46, rarity: 0.22, shape: "shark", special: "shark", palette: ["#7a8b99", "#3d4a56", "#e0e6ec", "#1e2830"] },
    { id: "boot", name: "장화", value: 1, weight: 2.6, r: 25, rarity: 1.35, junk: true, shape: "boot", palette: ["#355844", "#1a2e24", "#7aa090", "#0e1a14"] },
    { id: "can", name: "빈 캔", value: 1, weight: 1.85, r: 17, rarity: 1.25, junk: true, shape: "can", palette: ["#9aa2aa", "#5a626a", "#e0e4e8", "#2e3438"] },
    { id: "tire", name: "타이어", value: 2, weight: 3.4, r: 29, rarity: 0.95, junk: true, shape: "tire", palette: ["#2e2e34", "#121216", "#6a6a74", "#050508"] },
  ];

  const STAGE_NAMES = [
    "얕은 갯벌", "아침 물때", "은빛 멸치떼", "도미의 그림자", "연어 회귀",
    "깊은 해협", "황금빛 물결", "상어 주의보", "안개 낀 항구", "보물 어장",
    "야간 집어등", "급류 낚시", "황금잉어 소문", "심해 입구", "태풍 직전",
    "전설의 포인트", "달빛 바다", "참치 회랑", "복어 주의", "황금 만조",
    "심해 협곡", "유령 선창", "은빛 폭풍", "골든 리프", "흑조 어장",
    "새벽 물안개", "진주 만", "검은 조류", "전설 낚시터", "왕의 바다",
    "빙하 해협", "불꽃 물결", "심해 왕좌", "유령 멸치", "황금 심연",
    "폭풍 항구", "달빛 상어", "수정 어장", "붉은 조류", "은빛 심연",
    "최종 해협", "전설의 훅", "심해 결전", "황금 폭풍", "왕의 포인트",
    "심해 신화", "낚시왕 시험", "전설 어장", "황금 왕좌", "끝없는 바다",
  ];

  const STAGES = Array.from({ length: 50 }, (_, i) => {
    const t = i / 49;
    return {
      goal: Math.round(120 + i * 52 + t * t * 520),
      time: Math.max(26, 52 - i * 0.42),
      count: Math.min(18, 9 + Math.floor(i / 3)),
      junk: Math.min(0.55, 0.2 + i * 0.0075),
      rareBoost: Math.min(1.35, 0.85 + i * 0.008),
      swing: 1.25 + i * 0.028,
      fishSpeed: 1.15 + i * 0.035,
      catchPad: Math.max(4, 10 - i * 0.1),
      name: STAGE_NAMES[i] || `스테이지 ${i + 1}`,
    };
  });

  const fishSprites = Object.create(null);
  const fishImgs = Object.create(null);

  function loadFishImages() {
    const keys = SPECIES.filter((s) => !s.junk).map((s) => s.id);
    return Promise.all(
      keys.map(
        (id) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              fishImgs[id] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `assets/${id}.png`;
          })
      )
    );
  }

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const hudStage = document.getElementById("hud-stage");
  const hudScore = document.getElementById("hud-score");
  const hudGoal = document.getElementById("hud-goal");
  const hudTime = document.getElementById("hud-time");
  const hudCash = document.getElementById("hud-cash");
  const goalFill = document.getElementById("goal-fill");
  const hint = document.getElementById("hint");
  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  let state = "title";
  let stageIndex = 0;
  let score = 0;
  let cash = 0;
  let timeLeft = 60;
  let angle = 0;
  let angVel = 1.15;
  let angDir = 1;
  let mode = "swing"; // swing | drop | reel
  let lineLen = 0;
  let catchItem = null;
  let fishes = [];
  let bubbles = [];
  let particles = [];
  let floats = [];
  let rays = [];
  let seaweed = [];
  let last = 0;
  let raf = 0;
  let hintTimer = 4;
  let clearPulse = 0;
  let shake = 0;
  let waterPhase = 0;

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pickSpecies(st) {
    const pool = SPECIES.filter((s) => {
      if (s.junk) return Math.random() < st.junk * 1.4;
      return true;
    });
    const list = pool.length ? pool : SPECIES.filter((s) => !s.junk);
    let total = 0;
    const weights = list.map((s) => {
      let w = s.rarity;
      if (s.special === "gold" || s.special === "shark") w *= st.rareBoost;
      if (s.junk) w *= 0.9 + st.junk;
      total += w;
      return w;
    });
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  function spawnFish(st, forced) {
    const sp = forced || pickSpecies(st);
    const margin = 36 + sp.r;
    const spd = (st.fishSpeed || 1) * rand(22, 52) * (0.75 + Math.random() * 0.55);
    return {
      sp,
      x: rand(margin, W - margin),
      y: rand(WATER_Y + 50, H - 70),
      vx: spd * (Math.random() < 0.5 ? -1 : 1),
      bob: rand(0, Math.PI * 2),
      bobAmp: rand(5, 12),
      flip: 0,
      caught: false,
      wriggle: rand(0, Math.PI * 2),
    };
  }

  function resetStage() {
    const st = STAGES[stageIndex];
    cash = 0;
    timeLeft = st.time;
    angle = 0;
    angVel = st.swing;
    angDir = 1;
    mode = "swing";
    lineLen = 0;
    catchItem = null;
    fishes = Array.from({ length: st.count }, () => spawnFish(st));
    // guarantee at least one decent fish early
    if (stageIndex > 0) fishes[0] = spawnFish(st, SPECIES[Math.min(3 + Math.floor(stageIndex / 6), 6)]);
    particles = [];
    floats = [];
    clearPulse = 0;
    shake = 0;
    hintTimer = stageIndex === 0 ? 5 : 2.2;
    hint.classList.remove("fade");
    hint.textContent = "탭해서 낚싯바늘 던지기";
    updateHud();
  }

  function makeDecor() {
    bubbles = Array.from({ length: 28 }, () => ({
      x: rand(10, W - 10),
      y: rand(WATER_Y, H),
      r: rand(1.5, 4.5),
      vy: rand(12, 28),
      wob: rand(0, Math.PI * 2),
    }));
    rays = Array.from({ length: 5 }, (_, i) => ({
      x: 40 + i * 70 + rand(-10, 10),
      w: rand(18, 36),
      a: rand(0.04, 0.1),
    }));
    seaweed = Array.from({ length: 9 }, (_, i) => ({
      x: 20 + i * 42 + rand(-8, 8),
      h: rand(40, 90),
      phase: rand(0, Math.PI * 2),
      shade: rand(0.4, 0.85),
    }));
  }

  function updateHud() {
    const st = STAGES[stageIndex];
    hudStage.textContent = String(stageIndex + 1);
    hudScore.textContent = String(score);
    hudGoal.textContent = String(st.goal);
    hudTime.textContent = String(Math.max(0, Math.ceil(timeLeft)));
    hudCash.textContent = String(cash);
    const pct = Math.min(100, (cash / st.goal) * 100);
    goalFill.style.width = `${pct}%`;
  }

  function tipPos() {
    const a = angle;
    return {
      x: PIVOT_X + Math.sin(a) * lineLen,
      y: PIVOT_Y + Math.cos(a) * lineLen,
    };
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 1.1, vy: -36 });
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 140);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.35, 0.7),
        r: rand(2, 5),
        color,
      });
    }
  }

  function stageClear() {
    const st = STAGES[stageIndex];
    const bonus = Math.max(0, Math.floor(timeLeft * 2.2));
    score += cash + bonus;
    state = "clear";
    clearPulse = 1;
    document.getElementById("clear-detail").textContent =
      `${st.name} · 획득 ₩${cash}` + (bonus ? ` · 시간보너스 +${bonus}` : "");
    overlays.clear.classList.remove("hidden");
    updateHud();
  }

  function gameOver() {
    state = "over";
    score += cash;
    document.getElementById("over-detail").textContent =
      `스테이지 ${stageIndex + 1} · 총점 ${score} · 이번 ₩${cash}/${STAGES[stageIndex].goal}`;
    overlays.over.classList.remove("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "황금 낚시", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  function allClear() {
    state = "all";
    document.getElementById("all-detail").textContent = `최종 점수 ${score}`;
    overlays.all.classList.remove("hidden");
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "황금 낚시", formParent: overlays.all });
      TodayGameRank.open(score);
    }
  }

  function startGame() {
    if (window.TodayGameRank) TodayGameRank.reset();
    overlays.title.classList.add("hidden");
    overlays.clear.classList.add("hidden");
    overlays.over.classList.add("hidden");
    overlays.all.classList.add("hidden");
    bakeFishSprites();
    stageIndex = 0;
    score = 0;
    makeDecor();
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function nextStage() {
    overlays.clear.classList.add("hidden");
    stageIndex += 1;
    if (stageIndex >= STAGES.length) {
      allClear();
      return;
    }
    resetStage();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function cast() {
    if (state !== "play" || mode !== "swing") return;
    mode = "drop";
    lineLen = 28;
    hintTimer = 0;
    hint.classList.add("fade");
  }

  function tryCatch(tip) {
    const st = STAGES[stageIndex];
    const pad = st.catchPad != null ? st.catchPad : 10;
    let best = null;
    let bestD = 1e9;
    for (const f of fishes) {
      if (f.caught) continue;
      const dx = f.x - tip.x;
      const dy = f.y + Math.sin(f.bob) * f.bobAmp - tip.y;
      const d = Math.hypot(dx, dy);
      if (d < f.sp.r + pad && d < bestD) {
        best = f;
        bestD = d;
      }
    }
    if (best) {
      best.caught = true;
      catchItem = best;
      mode = "reel";
      burst(tip.x, tip.y, best.sp.palette[2], 12);
      return true;
    }
    return false;
  }

  function finishReel() {
    if (catchItem) {
      const sp = catchItem.sp;
      cash += sp.value;
      score += 0; // score banks on clear/over
      const col = sp.junk ? "#9aa8b0" : sp.special === "gold" ? "#ffe27a" : "#7ef0d2";
      addFloat(PIVOT_X, PIVOT_Y + 20, sp.junk ? `${sp.name} +₩${sp.value}` : `+₩${sp.value} ${sp.name}`, col);
      burst(PIVOT_X, WATER_Y + 10, col, sp.special === "gold" ? 22 : 14);
      if (sp.special === "gold") shake = 0.35;
      // respawn replacement
      const st = STAGES[stageIndex];
      fishes = fishes.filter((f) => f !== catchItem);
      fishes.push(spawnFish(st));
      catchItem = null;
      updateHud();
      if (cash >= st.goal) {
        stageClear();
        return;
      }
    }
    mode = "swing";
    lineLen = 0;
  }

  function update(dt) {
    waterPhase += dt;
    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) hint.classList.add("fade");
    }
    if (shake > 0) shake -= dt;
    if (clearPulse > 0) clearPulse -= dt;

    const st = STAGES[stageIndex];
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHud();
      if (cash >= st.goal) stageClear();
      else gameOver();
      return;
    }
    if (Math.floor(timeLeft) !== Math.floor(timeLeft + dt)) updateHud();

    // decor
    for (const b of bubbles) {
      b.y -= b.vy * dt;
      b.wob += dt * 2;
      b.x += Math.sin(b.wob) * 8 * dt;
      if (b.y < WATER_Y) {
        b.y = H + rand(0, 40);
        b.x = rand(10, W - 10);
      }
    }

    for (const f of fishes) {
      if (f.caught) continue;
      f.bob += dt * 2.2;
      f.wriggle += dt * 8;
      f.x += f.vx * dt;
      const m = 20 + f.sp.r;
      if (f.x < m) {
        f.x = m;
        f.vx = Math.abs(f.vx);
      }
      if (f.x > W - m) {
        f.x = W - m;
        f.vx = -Math.abs(f.vx);
      }
      // soft vertical wander
      f.y += Math.sin(f.bob * 0.7) * 6 * dt;
      f.y = Math.max(WATER_Y + 40, Math.min(H - 50, f.y));
    }

    if (mode === "swing") {
      angle += angDir * angVel * dt;
      const lim = 1.05;
      if (angle > lim) {
        angle = lim;
        angDir = -1;
      }
      if (angle < -lim) {
        angle = -lim;
        angDir = 1;
      }
    } else if (mode === "drop") {
      const speed = 340;
      lineLen += speed * dt;
      const tip = tipPos();
      if (tryCatch(tip)) {
        // caught
      } else if (lineLen >= MAX_LEN || tip.y >= H - 24 || tip.x < 8 || tip.x > W - 8) {
        mode = "reel";
      }
    } else if (mode === "reel") {
      const w = catchItem ? catchItem.sp.weight : 0.55;
      const speed = Math.max(42, 240 / w);
      lineLen -= speed * dt;
      if (catchItem) {
        const tip = tipPos();
        catchItem.x = tip.x;
        catchItem.y = tip.y;
      }
      if (lineLen <= 26) {
        lineLen = 26;
        finishReel();
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
  }

  function drawSkyBoat(g) {
    // sky band
    const sky = g.createLinearGradient(0, 0, 0, WATER_Y + 20);
    sky.addColorStop(0, "#7ec8d8");
    sky.addColorStop(0.55, "#4aa0b4");
    sky.addColorStop(1, "#1a6a7c");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, WATER_Y + 24);

    // sun glow
    const sun = g.createRadialGradient(300, 36, 4, 300, 36, 70);
    sun.addColorStop(0, "rgba(255,236,170,0.85)");
    sun.addColorStop(1, "rgba(255,236,170,0)");
    g.fillStyle = sun;
    g.fillRect(230, 0, 140, 100);

    // distant hills
    g.fillStyle = "rgba(20,70,80,0.35)";
    g.beginPath();
    g.moveTo(0, WATER_Y + 8);
    g.quadraticCurveTo(80, WATER_Y - 28, 160, WATER_Y + 4);
    g.quadraticCurveTo(240, WATER_Y - 22, 320, WATER_Y + 6);
    g.quadraticCurveTo(360, WATER_Y - 10, W, WATER_Y + 8);
    g.lineTo(W, WATER_Y + 24);
    g.lineTo(0, WATER_Y + 24);
    g.fill();

    // wooden dock / boat deck
    g.fillStyle = "#5a3a22";
    g.fillRect(0, WATER_Y - 18, W, 22);
    g.fillStyle = "#7a5232";
    g.fillRect(0, WATER_Y - 18, W, 8);
    for (let i = 0; i < 8; i++) {
      g.strokeStyle = "rgba(0,0,0,0.18)";
      g.beginPath();
      g.moveTo(i * 52, WATER_Y - 18);
      g.lineTo(i * 52, WATER_Y + 4);
      g.stroke();
    }

    // boat cabin
    g.fillStyle = "#c45a3a";
    g.beginPath();
    g.moveTo(PIVOT_X - 48, WATER_Y - 18);
    g.lineTo(PIVOT_X - 36, WATER_Y - 52);
    g.lineTo(PIVOT_X + 40, WATER_Y - 52);
    g.lineTo(PIVOT_X + 54, WATER_Y - 18);
    g.closePath();
    g.fill();
    g.fillStyle = "#2a6a88";
    g.fillRect(PIVOT_X - 18, WATER_Y - 46, 22, 16);
    g.fillStyle = "#f0c14a";
    g.fillRect(PIVOT_X + 10, WATER_Y - 70, 6, 22);
    g.beginPath();
    g.moveTo(PIVOT_X + 16, WATER_Y - 70);
    g.lineTo(PIVOT_X + 42, WATER_Y - 62);
    g.lineTo(PIVOT_X + 16, WATER_Y - 54);
    g.closePath();
    g.fill();
  }

  function drawWater(g) {
    const water = g.createLinearGradient(0, WATER_Y, 0, H);
    water.addColorStop(0, "#1a8a9a");
    water.addColorStop(0.35, "#0c5c6c");
    water.addColorStop(0.7, "#074850");
    water.addColorStop(1, "#032830");
    g.fillStyle = water;
    g.fillRect(0, WATER_Y, W, H - WATER_Y);

    // light shafts
    for (const ray of rays) {
      g.fillStyle = `rgba(180,230,255,${ray.a})`;
      g.beginPath();
      g.moveTo(ray.x, WATER_Y);
      g.lineTo(ray.x + ray.w * 0.3, H);
      g.lineTo(ray.x + ray.w, H);
      g.lineTo(ray.x + ray.w * 0.55, WATER_Y);
      g.closePath();
      g.fill();
    }

    // surface shimmer
    g.strokeStyle = "rgba(200,244,255,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = WATER_Y + Math.sin(x * 0.05 + waterPhase * 2.2) * 2.5;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();

    // seabed
    g.fillStyle = "#1a3428";
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) {
      g.lineTo(x, H - 28 - Math.sin(x * 0.04 + 1) * 10);
    }
    g.lineTo(W, H);
    g.fill();
    g.fillStyle = "#2a4a38";
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 18) {
      g.lineTo(x, H - 14 - Math.sin(x * 0.07) * 6);
    }
    g.lineTo(W, H);
    g.fill();

    // seaweed
    for (const s of seaweed) {
      g.strokeStyle = `rgba(40,140,90,${0.35 + s.shade * 0.35})`;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(s.x, H - 12);
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        const x = s.x + Math.sin(waterPhase * 1.4 + s.phase + t * 2) * (6 + t * 10);
        const y = H - 12 - s.h * t;
        g.lineTo(x, y);
      }
      g.stroke();
    }

    // bubbles
    for (const b of bubbles) {
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.strokeStyle = "rgba(200,240,255,0.45)";
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = "rgba(200,240,255,0.12)";
      g.fill();
    }
  }

  function drawFishBody(g, f) {
    const sp = f.sp;
    const dir = f.caught ? (angle > 0 ? 1 : -1) : f.vx >= 0 ? 1 : -1;
    const y = f.caught ? f.y : f.y + Math.sin(f.bob) * f.bobAmp;
    const spr = fishSprites[sp.id];
    g.save();
    g.translate(f.x, y);
    g.scale(dir, 1);
    if (!f.caught) g.rotate(Math.sin(f.wriggle || 0) * 0.08);
    // soft contact shadow
    g.fillStyle = "rgba(0,20,30,0.28)";
    g.beginPath();
    g.ellipse(2, sp.r * 0.55, sp.r * 0.85, sp.r * 0.22, 0, 0, Math.PI * 2);
    g.fill();
    if (spr) {
      const dw = spr.dw;
      const dh = spr.dh;
      g.drawImage(spr.canvas, -dw * 0.55, -dh * 0.5, dw, dh);
    } else {
      drawLiveFish(g, sp);
    }
    g.restore();
  }

  function bakeFishSprites() {
    for (const sp of SPECIES) {
      if (fishImgs[sp.id]) {
        const img = fishImgs[sp.id];
        const targetW = sp.r * 2.6;
        const ratio = img.naturalHeight / img.naturalWidth;
        fishSprites[sp.id] = {
          canvas: img,
          dw: targetW,
          dh: targetW * ratio,
          isImg: true,
        };
        continue;
      }
      const scale = 2.5;
      const pad = sp.r * 2.8;
      const cw = Math.ceil(pad * 2 * scale);
      const ch = Math.ceil(pad * 2 * scale);
      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      const g = c.getContext("2d");
      g.scale(scale, scale);
      g.translate(pad, pad);
      drawLiveFish(g, sp);
      fishSprites[sp.id] = {
        canvas: c,
        dw: pad * 2,
        dh: pad * 2,
      };
    }
  }

  function drawLiveFish(g, sp) {
    if (sp.junk) {
      drawJunkHQ(g, sp);
      return;
    }
    if (sp.shape === "shark") {
      drawSharkHQ(g, sp);
      return;
    }
    if (sp.shape === "puff") {
      drawBlowfishHQ(g, sp);
      return;
    }
    if (sp.shape === "koi") {
      drawKoiHQ(g, sp);
      return;
    }
    drawFishHQ(g, sp);
  }

  function bodyRadii(sp) {
    const r = sp.r;
    if (sp.shape === "slim") return { rx: r * 1.05, ry: r * 0.38 };
    if (sp.shape === "tall") return { rx: r * 0.95, ry: r * 0.72 };
    if (sp.shape === "long") return { rx: r * 1.2, ry: r * 0.48 };
    if (sp.shape === "thick") return { rx: r * 1.15, ry: r * 0.62 };
    return { rx: r, ry: r * 0.55 };
  }

  function drawEye(g, x, y, s) {
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#14202c";
    g.beginPath();
    g.arc(x + s * 0.28, y, s * 0.52, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.beginPath();
    g.arc(x - s * 0.25, y - s * 0.28, s * 0.22, 0, Math.PI * 2);
    g.fill();
  }

  function drawFishHQ(g, sp) {
    const r = sp.r;
    const [c0, c1, c2, c3] = sp.palette;
    const { rx, ry } = bodyRadii(sp);

    // tail
    const tGrad = g.createLinearGradient(-rx, 0, -rx * 1.5, 0);
    tGrad.addColorStop(0, c1);
    tGrad.addColorStop(1, c3 || c1);
    g.fillStyle = tGrad;
    g.beginPath();
    g.moveTo(-rx * 0.78, 0);
    g.quadraticCurveTo(-rx * 1.05, -ry * 1.15, -rx * 1.55, -ry * 1.05);
    g.quadraticCurveTo(-rx * 1.15, 0, -rx * 1.55, ry * 1.05);
    g.quadraticCurveTo(-rx * 1.05, ry * 1.15, -rx * 0.78, 0);
    g.fill();

    // pelvic / anal hints
    g.fillStyle = c1;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(-rx * 0.15, ry * 0.55);
    g.lineTo(rx * 0.05, ry * 1.05);
    g.lineTo(rx * 0.22, ry * 0.5);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;

    // body
    const body = g.createLinearGradient(0, -ry, 0, ry);
    body.addColorStop(0, c2);
    body.addColorStop(0.35, c0);
    body.addColorStop(0.72, c1);
    body.addColorStop(1, c3 || c1);
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    g.fill();

    // outline
    g.strokeStyle = "rgba(10,30,40,0.28)";
    g.lineWidth = Math.max(1.2, r * 0.06);
    g.stroke();

    // belly sheen
    g.fillStyle = "rgba(255,255,255,0.28)";
    g.beginPath();
    g.ellipse(rx * 0.08, ry * 0.28, rx * 0.62, ry * 0.32, -0.12, 0, Math.PI * 2);
    g.fill();

    // dorsal fin
    const dGrad = g.createLinearGradient(0, -ry, 0, -ry * 1.6);
    dGrad.addColorStop(0, c0);
    dGrad.addColorStop(1, c1);
    g.fillStyle = dGrad;
    g.beginPath();
    g.moveTo(-rx * 0.15, -ry * 0.55);
    g.quadraticCurveTo(rx * 0.05, -ry * 1.55, rx * 0.4, -ry * 0.5);
    g.quadraticCurveTo(rx * 0.1, -ry * 0.85, -rx * 0.15, -ry * 0.55);
    g.fill();

    // gill
    g.strokeStyle = "rgba(0,0,0,0.22)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(rx * 0.22, 0, ry * 0.55, -1.1, 1.1);
    g.stroke();

    // stripes for mackerel
    if (sp.shape === "stripe") {
      g.strokeStyle = "rgba(10,40,45,0.35)";
      g.lineWidth = Math.max(1.5, r * 0.08);
      g.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const x = -rx * 0.35 + i * rx * 0.22;
        g.beginPath();
        g.moveTo(x, -ry * 0.55);
        g.quadraticCurveTo(x + 4, 0, x - 2, ry * 0.35);
        g.stroke();
      }
    }

    // scale hints
    if (sp.shape === "tall" || sp.shape === "thick") {
      g.strokeStyle = "rgba(255,255,255,0.18)";
      g.lineWidth = 1;
      for (let row = -2; row <= 2; row++) {
        for (let col = -2; col <= 3; col++) {
          const sx = col * rx * 0.18;
          const sy = row * ry * 0.28;
          if (sx * sx / (rx * rx) + sy * sy / (ry * ry) > 0.65) continue;
          g.beginPath();
          g.arc(sx, sy, r * 0.07, 0.2, Math.PI - 0.2);
          g.stroke();
        }
      }
    }

    drawEye(g, rx * 0.55, -ry * 0.12, Math.max(3.2, r * 0.16));

    // mouth
    g.strokeStyle = "rgba(40,20,20,0.35)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(rx * 0.88, ry * 0.08, r * 0.12, 0.2, 1.2);
    g.stroke();
  }

  function drawKoiHQ(g, sp) {
    const r = sp.r;
    const [c0, c1, c2, c3] = sp.palette;
    // flowing tail
    g.fillStyle = c1;
    g.beginPath();
    g.moveTo(-r * 0.7, 0);
    g.bezierCurveTo(-r * 1.1, -r * 1.1, -r * 1.7, -r * 0.9, -r * 1.85, -r * 0.2);
    g.bezierCurveTo(-r * 1.4, 0, -r * 1.85, r * 0.35, -r * 1.55, r * 0.95);
    g.bezierCurveTo(-r * 1.05, r * 0.55, -r * 0.9, r * 0.2, -r * 0.7, 0);
    g.fill();
    g.fillStyle = c2;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(-r * 0.75, -r * 0.1);
    g.bezierCurveTo(-r * 1.2, -r * 0.9, -r * 1.6, -r * 0.5, -r * 1.5, -r * 0.05);
    g.fill();
    g.globalAlpha = 1;

    const body = g.createRadialGradient(-r * 0.1, -r * 0.15, r * 0.2, 0, 0, r * 1.15);
    body.addColorStop(0, c2);
    body.addColorStop(0.45, c0);
    body.addColorStop(1, c3);
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, 0, r * 1.05, r * 0.62, 0, 0, Math.PI * 2);
    g.fill();

    // red-gold patches
    g.fillStyle = "rgba(220,70,40,0.55)";
    g.beginPath();
    g.ellipse(r * 0.15, -r * 0.15, r * 0.35, r * 0.22, -0.4, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(-r * 0.25, r * 0.1, r * 0.28, r * 0.18, 0.3, 0, Math.PI * 2);
    g.fill();

    // dorsal ribbon
    g.fillStyle = c0;
    g.beginPath();
    g.moveTo(-r * 0.1, -r * 0.5);
    g.quadraticCurveTo(r * 0.2, -r * 1.35, r * 0.55, -r * 0.45);
    g.quadraticCurveTo(r * 0.15, -r * 0.85, -r * 0.1, -r * 0.5);
    g.fill();

    // glow ring
    g.strokeStyle = "rgba(255,236,150,0.65)";
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(0, 0, r * 1.12, r * 0.7, 0, 0, Math.PI * 2);
    g.stroke();

    // scales sparkle
    g.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.28, 1.6, 0, Math.PI * 2);
      g.fill();
    }

    drawEye(g, r * 0.55, -r * 0.1, r * 0.15);
  }

  function drawBlowfishHQ(g, sp) {
    const r = sp.r;
    const [c0, c1, c2, c3] = sp.palette;
    // spines first (behind)
    g.strokeStyle = c1;
    g.lineWidth = 2;
    g.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
      g.lineTo(Math.cos(a) * r * 1.28, Math.sin(a) * r * 1.28);
      g.stroke();
      g.fillStyle = c3;
      g.beginPath();
      g.arc(Math.cos(a) * r * 1.28, Math.sin(a) * r * 1.28, 1.8, 0, Math.PI * 2);
      g.fill();
    }

    const body = g.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.15, 0, 0, r);
    body.addColorStop(0, c2);
    body.addColorStop(0.55, c0);
    body.addColorStop(1, c1);
    g.fillStyle = body;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = c2;
    g.beginPath();
    g.ellipse(0, r * 0.28, r * 0.72, r * 0.48, 0, 0, Math.PI * 2);
    g.fill();

    // spots
    g.fillStyle = "rgba(80,50,10,0.25)";
    for (const [sx, sy, sr] of [[-0.35, -0.25, 0.12], [0.1, -0.4, 0.1], [0.35, -0.15, 0.14], [-0.1, 0.05, 0.09]]) {
      g.beginPath();
      g.arc(sx * r, sy * r, sr * r, 0, Math.PI * 2);
      g.fill();
    }

    // tiny fins
    g.fillStyle = c1;
    g.beginPath();
    g.ellipse(-r * 0.85, 0, r * 0.22, r * 0.35, 0, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(10,30,40,0.25)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();

    drawEye(g, r * 0.35, -r * 0.18, r * 0.18);
    // smile
    g.strokeStyle = "rgba(60,40,20,0.4)";
    g.beginPath();
    g.arc(r * 0.55, r * 0.15, r * 0.2, 0.15, 1.2);
    g.stroke();
  }

  function drawSharkHQ(g, sp) {
    const r = sp.r;
    const [c0, c1, c2, c3] = sp.palette;

    // tail
    g.fillStyle = c1;
    g.beginPath();
    g.moveTo(-r * 0.85, 0);
    g.lineTo(-r * 1.55, -r * 0.75);
    g.lineTo(-r * 1.15, 0);
    g.lineTo(-r * 1.45, r * 0.55);
    g.closePath();
    g.fill();

    // body
    const body = g.createLinearGradient(0, -r * 0.5, 0, r * 0.5);
    body.addColorStop(0, c2);
    body.addColorStop(0.4, c0);
    body.addColorStop(1, c3);
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(r * 1.25, 0);
    g.bezierCurveTo(r * 0.6, -r * 0.55, -r * 0.2, -r * 0.55, -r * 0.9, -r * 0.12);
    g.lineTo(-r * 0.9, r * 0.12);
    g.bezierCurveTo(-r * 0.2, r * 0.45, r * 0.55, r * 0.4, r * 1.25, 0);
    g.closePath();
    g.fill();

    // white belly
    g.fillStyle = "rgba(240,245,250,0.85)";
    g.beginPath();
    g.moveTo(r * 1.1, 0.05 * r);
    g.bezierCurveTo(r * 0.3, r * 0.32, -r * 0.4, r * 0.28, -r * 0.75, r * 0.08);
    g.bezierCurveTo(-r * 0.2, r * 0.02, r * 0.4, 0, r * 1.1, 0.05 * r);
    g.fill();

    // dorsal
    g.fillStyle = c1;
    g.beginPath();
    g.moveTo(-r * 0.05, -r * 0.35);
    g.lineTo(r * 0.12, -r * 1.15);
    g.lineTo(r * 0.42, -r * 0.28);
    g.closePath();
    g.fill();

    // pectoral
    g.beginPath();
    g.moveTo(r * 0.05, r * 0.15);
    g.lineTo(r * 0.15, r * 0.7);
    g.lineTo(r * 0.45, r * 0.2);
    g.closePath();
    g.fill();

    // gill slits
    g.strokeStyle = "rgba(20,30,40,0.35)";
    g.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(r * (0.15 - i * 0.1), 0, r * 0.28, -0.9, 0.9);
      g.stroke();
    }

    // outline
    g.strokeStyle = "rgba(10,20,30,0.3)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(r * 1.25, 0);
    g.bezierCurveTo(r * 0.6, -r * 0.55, -r * 0.2, -r * 0.55, -r * 0.9, -r * 0.12);
    g.stroke();

    drawEye(g, r * 0.7, -r * 0.12, r * 0.09);
    // snout tip
    g.fillStyle = c3;
    g.beginPath();
    g.ellipse(r * 1.15, 0, r * 0.12, r * 0.08, 0, 0, Math.PI * 2);
    g.fill();
  }

  function drawJunkHQ(g, sp) {
    const r = sp.r;
    const [c0, c1, c2, c3] = sp.palette;
    if (sp.shape === "boot") {
      // shadow volume
      const boot = g.createLinearGradient(-r, 0, r, 0);
      boot.addColorStop(0, c3);
      boot.addColorStop(0.4, c0);
      boot.addColorStop(1, c1);
      g.fillStyle = boot;
      g.beginPath();
      g.moveTo(-r * 0.55, -r * 0.85);
      g.quadraticCurveTo(-r * 0.5, -r * 0.95, -r * 0.2, -r * 0.95);
      g.lineTo(r * 0.15, -r * 0.9);
      g.lineTo(r * 0.22, r * 0.15);
      g.quadraticCurveTo(r * 0.55, r * 0.2, r * 0.95, r * 0.35);
      g.lineTo(r * 0.95, r * 0.72);
      g.quadraticCurveTo(r * 0.2, r * 0.82, -r * 0.55, r * 0.72);
      g.closePath();
      g.fill();
      g.strokeStyle = c2;
      g.lineWidth = 2;
      g.stroke();
      // cuff
      g.fillStyle = c1;
      g.fillRect(-r * 0.55, -r * 0.95, r * 0.72, r * 0.18);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.beginPath();
      g.moveTo(-r * 0.35, -r * 0.5);
      g.lineTo(r * 0.05, -r * 0.45);
      g.lineTo(r * 0.1, r * 0.4);
      g.lineTo(-r * 0.3, r * 0.35);
      g.fill();
    } else if (sp.shape === "tire") {
      g.fillStyle = c3;
      g.beginPath();
      g.arc(0, 0, r * 1.05, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = c0;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.arc(0, 0, r * 0.42, 0, Math.PI * 2, true);
      g.fill();
      g.strokeStyle = c2;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.12)";
      g.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
        g.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
        g.stroke();
      }
      g.fillStyle = c1;
      g.beginPath();
      g.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      g.fill();
    } else {
      // can with label
      const can = g.createLinearGradient(-r, 0, r, 0);
      can.addColorStop(0, c3);
      can.addColorStop(0.35, c2);
      can.addColorStop(0.55, c0);
      can.addColorStop(1, c1);
      g.fillStyle = can;
      roundRect(g, -r * 0.58, -r * 0.8, r * 1.16, r * 1.55, 4);
      g.fill();
      g.fillStyle = c2;
      roundRect(g, -r * 0.58, -r * 0.8, r * 1.16, r * 0.28, 4);
      g.fill();
      g.fillStyle = "#c45a3a";
      g.fillRect(-r * 0.4, -r * 0.25, r * 0.8, r * 0.45);
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(-r * 0.5, -r * 0.7, r * 0.18, r * 1.3);
      g.strokeStyle = "rgba(0,0,0,0.25)";
      g.lineWidth = 1.2;
      roundRect(g, -r * 0.58, -r * 0.8, r * 1.16, r * 1.55, 4);
      g.stroke();
    }
  }

  function roundRect(g, x, y, w, h, rad) {
    const r = Math.min(rad, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawHook(g, tip) {
    g.save();
    g.translate(tip.x, tip.y);
    g.rotate(-angle);
    g.strokeStyle = "#f0d878";
    g.lineWidth = 3.2;
    g.lineCap = "round";
    g.shadowColor = "rgba(240,200,80,0.45)";
    g.shadowBlur = 6;
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(0, 9);
    g.quadraticCurveTo(1, 20, 12, 17);
    g.stroke();
    g.shadowBlur = 0;
    const bead = g.createRadialGradient(-1, -5, 1, 0, -4, 5);
    bead.addColorStop(0, "#fff6c8");
    bead.addColorStop(1, "#d4a020");
    g.fillStyle = bead;
    g.beginPath();
    g.arc(0, -4, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function draw(g) {
    g.save();
    if (shake > 0) {
      g.translate(rand(-3, 3) * shake * 4, rand(-2, 2) * shake * 4);
    }

    drawSkyBoat(g);
    drawWater(g);

    // fishes (back to front by y)
    const ordered = fishes.slice().sort((a, b) => a.y - b.y);
    for (const f of ordered) {
      if (!f.caught) drawFishBody(g, f);
    }

    // fishing line
    const tip = tipPos();
    const len = mode === "swing" ? 26 : lineLen;
    const tipSwing = {
      x: PIVOT_X + Math.sin(angle) * len,
      y: PIVOT_Y + Math.cos(angle) * len,
    };
    g.strokeStyle = "rgba(240,230,200,0.9)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(PIVOT_X, PIVOT_Y);
    g.lineTo(tipSwing.x, tipSwing.y);
    g.stroke();
    drawHook(g, tipSwing);

    if (catchItem) drawFishBody(g, catchItem);

    // rod
    g.strokeStyle = "#8b5a2b";
    g.lineWidth = 4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(PIVOT_X - 8, WATER_Y - 28);
    g.lineTo(PIVOT_X, PIVOT_Y);
    g.stroke();
    g.fillStyle = "#f0c14a";
    g.beginPath();
    g.arc(PIVOT_X, PIVOT_Y, 4, 0, Math.PI * 2);
    g.fill();

    // particles / floats
    for (const p of particles) {
      g.globalAlpha = Math.max(0, p.life * 1.4);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    for (const f of floats) {
      g.globalAlpha = Math.min(1, f.life * 1.5);
      g.fillStyle = f.color;
      g.font = '700 16px "Jua", sans-serif';
      g.textAlign = "center";
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;

    // vignette
    const vig = g.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, H * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,10,16,0.35)");
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    g.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (state === "play") {
      update(dt);
      draw(ctx);
      raf = requestAnimationFrame(loop);
    } else if (state === "paused") {
      draw(ctx);
      raf = requestAnimationFrame(loop);
    } else if (state === "clear" || state === "over" || state === "all" || state === "title") {
      draw(ctx);
    }
  }

  function onPointer() {
    if (state === "play") cast();
  }

  canvas.addEventListener("pointerdown", onPointer);
  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "황금 낚시", formParent: overlays.title });
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
        last = performance.now();
        return true;
      },
    });
  }

  makeDecor();
  loadFishImages().then(() => {
    bakeFishSprites();
    // idle title backdrop
    fishes = Array.from({ length: 10 }, () => spawnFish(STAGES[0]));
    lineLen = 26;
    draw(ctx);
    last = performance.now();
    raf = requestAnimationFrame(function idle(now) {
      if (state !== "title") return;
      const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
      last = now;
      waterPhase += dt;
      angle = Math.sin(now * 0.0012) * 0.7;
      for (const f of fishes) {
        f.bob += dt * 2;
        f.wriggle = (f.wriggle || 0) + dt * 8;
        f.x += f.vx * dt;
        if (f.x < 30 || f.x > W - 30) f.vx *= -1;
      }
      for (const b of bubbles) {
        b.y -= b.vy * dt;
        if (b.y < WATER_Y) b.y = H;
      }
      draw(ctx);
      raf = requestAnimationFrame(idle);
    });
  });
})();
