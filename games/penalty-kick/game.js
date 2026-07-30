(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const TOTAL_ROUNDS = 10;
  const GOAL = { left: 34, right: 356, top: 143, bottom: 370 };
  const BALL_START = { x: 195, y: 578 };
  const KICK_CONTACT_TIME = 0.54;
  const KICK_MOTION_END = 0.78;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const characterSprites = {
    keeper: new Image(),
    striker: new Image(),
    strikerKick: new Image(),
  };
  characterSprites.keeper.src = "assets/goalkeeper.png?v=3";
  characterSprites.striker.src = "assets/striker.png?v=4";
  characterSprites.strikerKick.src = "assets/striker-kick-sheet.png?v=1";

  const ui = {
    title: document.getElementById("title"),
    result: document.getElementById("round-result"),
    over: document.getElementById("game-over"),
    timing: document.getElementById("timing-panel"),
    cursor: document.getElementById("timing-cursor"),
    grade: document.getElementById("timing-grade"),
    coach: document.getElementById("coach"),
    dots: document.getElementById("shot-dots"),
    round: document.getElementById("hud-round"),
    goals: document.getElementById("hud-goals"),
    saves: document.getElementById("hud-saves"),
    score: document.getElementById("hud-score"),
    resultBadge: document.getElementById("result-badge"),
    resultTitle: document.getElementById("result-title"),
    resultDetail: document.getElementById("result-detail"),
    overTitle: document.getElementById("over-title"),
    overDetail: document.getElementById("over-detail"),
    finalGoals: document.getElementById("final-goals"),
    finalPerfect: document.getElementById("final-perfect"),
    finalCombo: document.getElementById("final-combo"),
  };

  let phase = "title";
  let round = 0;
  let goals = 0;
  let saves = 0;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let perfects = 0;
  let results = [];
  let directionHistory = [];
  let aim = null;
  let hoverAim = { x: 195, y: 245 };
  let keeperPlan = { dive: 0, height: "mid", tell: 0 };
  let timing = { value: 0.08, dir: 1, speed: 0.78 };
  let shot = null;
  let keeper = { x: 195, y: 300, rotation: 0, stretch: 0, dive: 0 };
  let particles = [];
  let floats = [];
  let ripples = [];
  let shake = 0;
  let flash = 0;
  let crowdPulse = 0;
  let last = 0;
  let audioCtx = null;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rand = (a, b) => a + Math.random() * (b - a);

  function showOnly(name) {
    [ui.title, ui.result, ui.over].forEach((el) => el.classList.add("hidden"));
    if (name && ui[name]) ui[name].classList.remove("hidden");
  }

  function tone(freq, duration, type = "sine", volume = 0.05, delay = 0) {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const start = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration);
    } catch {
      /* sound is optional */
    }
  }

  function kickSound() {
    tone(105, 0.1, "triangle", 0.11);
    tone(62, 0.16, "sine", 0.08);
  }

  function goalSound() {
    [392, 523, 659].forEach((f, i) => tone(f, 0.3, "triangle", 0.055, i * 0.08));
  }

  function saveSound() {
    tone(130, 0.22, "sawtooth", 0.045);
    tone(82, 0.28, "square", 0.03, 0.04);
  }

  function directionOf(x) {
    if (x < 155) return -1;
    if (x > 235) return 1;
    return 0;
  }

  function chooseKeeperPlan() {
    const difficulty = round / (TOTAL_ROUNDS - 1);
    let dive;
    if (directionHistory.length >= 2 && Math.random() < 0.42 + difficulty * 0.24) {
      const counts = [-1, 0, 1].map((dir) => ({
        dir,
        count: directionHistory.filter((value) => value === dir).length,
      }));
      counts.sort((a, b) => b.count - a.count || Math.random() - 0.5);
      dive = counts[0].dir;
    } else {
      dive = [-1, 0, 1][Math.floor(Math.random() * 3)];
    }
    const height = Math.random() < 0.48 ? "high" : "low";
    const truthChance = 0.78 - difficulty * 0.24;
    const tell = Math.random() < truthChance ? dive : [-1, 0, 1][Math.floor(Math.random() * 3)];
    return { dive, height, tell };
  }

  function buildDots() {
    ui.dots.innerHTML = "";
    for (let i = 0; i < TOTAL_ROUNDS; i += 1) {
      const dot = document.createElement("i");
      dot.className = `shot-dot${results[i] === true ? " goal" : results[i] === false ? " miss" : ""}`;
      ui.dots.appendChild(dot);
    }
  }

  function updateHud() {
    ui.round.textContent = String(Math.min(round + 1, TOTAL_ROUNDS));
    ui.goals.textContent = String(goals);
    ui.saves.textContent = String(saves);
    ui.score.textContent = score.toLocaleString("ko-KR");
    buildDots();
  }

  function resetKeeper() {
    keeper = { x: 195, y: 300, rotation: 0, stretch: 0, dive: 0 };
  }

  function beginRound() {
    phase = "aim";
    aim = null;
    hoverAim = { x: 195, y: 245 };
    shot = null;
    keeperPlan = chooseKeeperPlan();
    timing = {
      value: rand(0.05, 0.2),
      dir: 1,
      speed: 0.75 + round * 0.045,
    };
    resetKeeper();
    ui.timing.classList.add("hidden");
    ui.coach.textContent =
      round < 3
        ? "골키퍼의 시선과 무게중심을 읽고 빈 곳을 누르세요"
        : round < 7
          ? "골키퍼가 슛 패턴을 학습합니다 · 방향을 섞으세요"
          : "결정적 순간! 구석과 PERFECT 타이밍을 노리세요";
    updateHud();
  }

  function startGame() {
    round = 0;
    goals = 0;
    saves = 0;
    score = 0;
    streak = 0;
    bestStreak = 0;
    perfects = 0;
    results = [];
    directionHistory = [];
    particles = [];
    floats = [];
    ripples = [];
    showOnly(null);
    beginRound();
    tone(440, 0.12, "triangle", 0.04);
    tone(660, 0.16, "triangle", 0.04, 0.1);
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  }

  function isInsideGoal(p) {
    return p.x >= GOAL.left + 8 && p.x <= GOAL.right - 8 && p.y >= GOAL.top + 8 && p.y <= GOAL.bottom - 12;
  }

  function selectAim(p) {
    if (phase !== "aim" || !isInsideGoal(p)) return;
    aim = {
      x: clamp(p.x, GOAL.left + 16, GOAL.right - 16),
      y: clamp(p.y, GOAL.top + 16, GOAL.bottom - 24),
    };
    phase = "timing";
    ui.timing.classList.remove("hidden");
    ui.coach.textContent = "중앙의 하얀 PERFECT 존에서 슛!";
    tone(780, 0.08, "sine", 0.035);
  }

  function timingQuality(value) {
    return clamp(1 - Math.abs(value - 0.5) * 2, 0, 1);
  }

  function timingLabel(q) {
    if (q >= 0.9) return "PERFECT";
    if (q >= 0.68) return "GREAT";
    if (q >= 0.42) return "GOOD";
    return "MISS HIT";
  }

  function resolveShot() {
    if (phase !== "timing" || !aim) return;
    const quality = timingQuality(timing.value);
    const grade = timingLabel(quality);
    const difficulty = round / (TOTAL_ROUNDS - 1);
    const chosenDir = directionOf(aim.x);
    directionHistory.push(chosenDir);

    let actualX = aim.x;
    let actualY = aim.y;
    const error = Math.pow(1 - quality, 1.45) * (72 + round * 1.8);
    actualX += rand(-error, error);
    actualY += rand(-error * 0.55, error * 0.72);

    let keeperDive = keeperPlan.dive;
    const reactiveRead = 0.08 + difficulty * 0.27 + (1 - quality) * 0.3;
    if (Math.random() < reactiveRead) keeperDive = chosenDir;

    const keeperTarget = {
      x: keeperDive === -1 ? 109 : keeperDive === 1 ? 281 : 195,
      y: keeperPlan.height === "high" ? 225 : 306,
    };
    const onTarget =
      actualX > GOAL.left + 6 &&
      actualX < GOAL.right - 6 &&
      actualY > GOAL.top + 5 &&
      actualY < GOAL.bottom - 8;
    const targetDir = directionOf(actualX);
    const corner =
      onTarget &&
      (actualX < 118 || actualX > 272) &&
      actualY < 248;
    const reach =
      44 +
      difficulty * 19 +
      (keeperDive === targetDir ? 16 : 0) -
      quality * 9 -
      (corner ? 8 : 0);
    const dist = Math.hypot(actualX - keeperTarget.x, actualY - keeperTarget.y);
    const saved = onTarget && dist < reach;
    const goal = onTarget && !saved;

    shot = {
      time: 0,
      motionTime: 0,
      duration: 0.78 - quality * 0.18,
      target: { x: actualX, y: actualY },
      aim: { ...aim },
      quality,
      grade,
      goal,
      saved,
      onTarget,
      corner,
      keeperDive,
      keeperTarget,
      displayedResult: false,
    };
    phase = "kick";
    ui.timing.classList.add("hidden");
    ui.coach.textContent = "도움닫기 · 디딤발을 고정하세요!";
  }

  function launchBall() {
    if (!shot || phase !== "kick") return;
    phase = "flight";
    shot.time = 0;
    ui.coach.textContent =
      shot.grade === "PERFECT" ? "PERFECT SHOT!" : `${shot.grade} · 공의 궤적을 보세요`;
    kickSound();
    shake = 5 + shot.quality * 3;
    spawnKickParticles();
  }

  function spawnKickParticles() {
    for (let i = 0; i < 15; i += 1) {
      particles.push({
        x: BALL_START.x + rand(-7, 7),
        y: BALL_START.y + rand(-4, 5),
        vx: rand(-55, 55),
        vy: rand(-70, 5),
        life: rand(0.25, 0.52),
        max: 0.52,
        size: rand(1.5, 4),
        color: i % 3 === 0 ? "#d8ffbf" : "#89d66d",
      });
    }
  }

  function spawnGoalBurst(x, y) {
    const colors = ["#ffe55c", "#49e3ff", "#ff4f75", "#5ff09b", "#ffffff"];
    for (let i = 0; i < 52; i += 1) {
      const angle = rand(-Math.PI, 0);
      const speed = rand(80, 260);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: rand(0.65, 1.35),
        max: 1.35,
        size: rand(2, 6),
        color: colors[i % colors.length],
        gravity: 260,
      });
    }
    ripples.push({ x, y, life: 0.75, max: 0.75 });
  }

  function finishFlight() {
    if (!shot || shot.displayedResult) return;
    shot.displayedResult = true;
    const { goal, saved, onTarget, grade, quality, corner } = shot;
    let gained = 0;

    if (goal) {
      goals += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      if (grade === "PERFECT") perfects += 1;
      gained =
        900 +
        Math.round(quality * 650) +
        (corner ? 450 : 0) +
        (grade === "PERFECT" ? 350 : 0) +
        Math.min(5, streak - 1) * 180;
      score += gained;
      results.push(true);
      ui.resultBadge.textContent = corner ? "TOP CORNER!" : grade === "PERFECT" ? "PERFECT GOAL!" : "GOAL!";
      ui.resultTitle.textContent = corner ? "구석을 찔렀어요!" : "골망을 흔들었어요!";
      ui.resultDetail.innerHTML = `${grade} · <b>+${gained.toLocaleString("ko-KR")}점</b>${streak >= 2 ? `<br />🔥 ${streak} COMBO` : ""}`;
      goalSound();
      spawnGoalBurst(shot.target.x, shot.target.y);
      crowdPulse = 1;
      flash = 0.72;
    } else {
      saves += 1;
      streak = 0;
      gained = onTarget ? Math.round(quality * 120) : 0;
      score += gained;
      results.push(false);
      ui.resultBadge.textContent = saved ? "SAVED" : "OFF TARGET";
      ui.resultTitle.textContent = saved ? "골키퍼가 막았어요!" : "골대를 벗어났어요!";
      ui.resultDetail.innerHTML = saved
        ? `${grade} · 골키퍼가 방향을 읽었습니다${gained ? `<br />유효 슛 +${gained}점` : ""}`
        : `${grade} · 타이밍을 중앙에 맞춰보세요`;
      saveSound();
      shake = 8;
    }

    updateHud();
    setTimeout(() => {
      phase = "result";
      showOnly("result");
      document.getElementById("next-btn").textContent =
        round + 1 >= TOTAL_ROUNDS ? "최종 결과" : "다음 킥";
    }, 440);
  }

  function nextRound() {
    showOnly(null);
    if (round + 1 >= TOTAL_ROUNDS) {
      endGame();
      return;
    }
    round += 1;
    beginRound();
  }

  function endGame() {
    phase = "over";
    ui.timing.classList.add("hidden");
    ui.coach.textContent = "경기 종료";
    const rate = Math.round((goals / TOTAL_ROUNDS) * 100);
    ui.overTitle.textContent =
      goals >= 9 ? "전설의 키커!" : goals >= 7 ? "승부차기 마스터!" : goals >= 5 ? "멋진 승부였어요!" : "다시 도전해봐요!";
    ui.overDetail.innerHTML = `10번 중 <b>${goals}골</b> · 성공률 ${rate}%<br />최종 점수 <b>${score.toLocaleString("ko-KR")}점</b>`;
    ui.finalGoals.textContent = String(goals);
    ui.finalPerfect.textContent = String(perfects);
    ui.finalCombo.textContent = String(bestStreak);
    showOnly("over");
    if (window.TodayGameRank) {
      window.TodayGameRank.open(score, {
        label: `${goals}골 · ${score.toLocaleString("ko-KR")}점`,
      });
    }
  }

  function update(dt) {
    crowdPulse = Math.max(0, crowdPulse - dt * 0.8);
    flash = Math.max(0, flash - dt * 2.2);
    shake = Math.max(0, shake - dt * 20);

    if (phase === "timing") {
      timing.value += timing.dir * timing.speed * dt;
      if (timing.value >= 1) {
        timing.value = 1;
        timing.dir = -1;
      } else if (timing.value <= 0) {
        timing.value = 0;
        timing.dir = 1;
      }
      const q = timingQuality(timing.value);
      ui.cursor.style.left = `${timing.value * 100}%`;
      ui.grade.textContent = timingLabel(q);
    }

    if (phase === "kick" && shot) {
      shot.motionTime += dt;
      if (shot.motionTime >= KICK_CONTACT_TIME) {
        shot.motionTime = KICK_CONTACT_TIME;
        launchBall();
      }
    }

    if (phase === "flight" && shot) {
      shot.time += dt;
      shot.motionTime = Math.min(KICK_MOTION_END, shot.motionTime + dt);
      const t = clamp(shot.time / shot.duration, 0, 1);
      const difficulty = round / (TOTAL_ROUNDS - 1);
      const diveDelay = 0.1 + (1 - difficulty) * 0.1;
      const diveT = clamp((t - diveDelay) / (0.65 - diveDelay), 0, 1);
      const k = easeOut(diveT);
      keeper.x = lerp(195, shot.keeperTarget.x, k);
      keeper.y = lerp(300, shot.keeperTarget.y, k);
      keeper.rotation = shot.keeperDive * lerp(0, 1.14, k);
      keeper.stretch = k;
      keeper.dive = shot.keeperDive;
      if (t >= 1) finishFlight();
    }

    particles.forEach((p) => {
      p.life -= dt;
      p.vy += (p.gravity || 120) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    particles = particles.filter((p) => p.life > 0);
    floats.forEach((f) => {
      f.life -= dt;
      f.y -= 34 * dt;
    });
    floats = floats.filter((f) => f.life > 0);
    ripples.forEach((r) => (r.life -= dt));
    ripples = ripples.filter((r) => r.life > 0);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawSky(time) {
    const grad = ctx.createLinearGradient(0, 0, 0, 430);
    grad.addColorStop(0, "#03122f");
    grad.addColorStop(0.52, "#0b4d8b");
    grad.addColorStop(1, "#5da3c6");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 430);

    const glow = ctx.createRadialGradient(195, 82, 4, 195, 82, 210);
    glow.addColorStop(0, "rgba(123,211,255,.2)");
    glow.addColorStop(1, "rgba(4,24,55,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 350);

    ctx.fillStyle = "rgba(255,255,255,.6)";
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 71 + 19) % W;
      const y = 108 + ((i * 43) % 105);
      const a = 0.25 + Math.sin(time * 1.8 + i) * 0.18;
      ctx.globalAlpha = a;
      ctx.fillRect(x, y, 1.3, 1.3);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloodlight(x, y, flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);
    const beam = ctx.createLinearGradient(0, 0, 95, 210);
    beam.addColorStop(0, "rgba(225,248,255,.16)");
    beam.addColorStop(1, "rgba(225,248,255,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(10, 5);
    ctx.lineTo(125, 260);
    ctx.lineTo(42, 260);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#233c56";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(2, 15);
    ctx.lineTo(22, 260);
    ctx.stroke();
    ctx.fillStyle = "#dff8ff";
    roundRect(-12, -4, 45, 25, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        ctx.beginPath();
        ctx.arc(-5 + col * 10, 3 + row * 10, 3.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawStands(time) {
    const stand = ctx.createLinearGradient(0, 190, 0, 357);
    stand.addColorStop(0, "#0c2039");
    stand.addColorStop(0.35, "#071326");
    stand.addColorStop(1, "#020913");
    ctx.fillStyle = stand;
    ctx.beginPath();
    ctx.moveTo(0, 208);
    ctx.quadraticCurveTo(195, 170, W, 208);
    ctx.lineTo(W, 360);
    ctx.lineTo(0, 360);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(126,190,232,.2)";
    ctx.lineWidth = 2;
    for (let y = 220; y <= 326; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(195, y - 10, W, y);
      ctx.stroke();
    }

    const colors = ["#f7df72", "#ef6b87", "#6ccff6", "#73d28b", "#e8f2ff", "#ff914d"];
    for (let row = 0; row < 8; row += 1) {
      const count = 31 + row * 2;
      for (let col = 0; col < count; col += 1) {
        const x = (col / (count - 1)) * (W + 12) - 6;
        const y = 221 + row * 15 + Math.sin(col * 1.7 + row) * 1.5;
        const bounce = crowdPulse * Math.sin(time * 20 + col * 0.8) * 5;
        ctx.globalAlpha = 0.42 + ((col + row) % 4) * 0.12;
        ctx.fillStyle = colors[(col * 5 + row * 3) % colors.length];
        ctx.beginPath();
        ctx.arc(x, y + bounce, 2.2 + (row / 8) * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    const led = ctx.createLinearGradient(0, 329, W, 329);
    led.addColorStop(0, "#04b9ff");
    led.addColorStop(0.25, "#eafaff");
    led.addColorStop(0.5, "#ffcf3b");
    led.addColorStop(0.75, "#eafaff");
    led.addColorStop(1, "#04b9ff");
    ctx.fillStyle = "#071a2e";
    ctx.fillRect(0, 326, W, 29);
    ctx.fillStyle = led;
    ctx.globalAlpha = 0.82;
    ctx.fillRect(0, 330, W, 18);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#08213a";
    ctx.font = "900 9px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("TODAY GAME  ·  PENALTY HERO  ·  KOREA", 195, 342);
  }

  function drawPitch() {
    const grad = ctx.createLinearGradient(0, 345, 0, H);
    grad.addColorStop(0, "#208354");
    grad.addColorStop(0.42, "#117344");
    grad.addColorStop(1, "#075332");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 345, W, H - 345);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 345, W, H - 345);
    ctx.clip();
    for (let i = 0; i < 10; i += 1) {
      ctx.fillStyle = i % 2 ? "rgba(2,72,38,.17)" : "rgba(115,215,139,.075)";
      ctx.beginPath();
      ctx.moveTo(195 + (i - 5) * 25, 345);
      ctx.lineTo(195 + (i - 5) * 83, H);
      ctx.lineTo(195 + (i - 4) * 83, H);
      ctx.lineTo(195 + (i - 4) * 25, 345);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,.025)";
    for (let y = 380; y < H; y += 18) ctx.fillRect(0, y, W, 1);
    ctx.restore();

    ctx.strokeStyle = "rgba(242,255,240,.76)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(22, 370);
    ctx.lineTo(-62, 700);
    ctx.moveTo(368, 370);
    ctx.lineTo(452, 700);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(195, 646, 135, 64, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(BALL_START.x, BALL_START.y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = "#eaffea";
    ctx.fill();
  }

  function drawGoal() {
    const ripplePower = ripples.reduce((sum, r) => sum + r.life / r.max, 0);
    ctx.save();
    const depth = 18;
    ctx.fillStyle = "rgba(183,226,246,.07)";
    ctx.beginPath();
    ctx.moveTo(GOAL.left, GOAL.top);
    ctx.lineTo(GOAL.right, GOAL.top);
    ctx.lineTo(GOAL.right - depth, GOAL.bottom);
    ctx.lineTo(GOAL.left + depth, GOAL.bottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(216,242,255,${0.4 + ripplePower * 0.25})`;
    ctx.lineWidth = 0.9;
    for (let i = 0; i <= 14; i += 1) {
      const topX = lerp(GOAL.left, GOAL.right, i / 14);
      const bottomX = lerp(GOAL.left + depth, GOAL.right - depth, i / 14);
      ctx.beginPath();
      ctx.moveTo(topX, GOAL.top);
      const bend = ripplePower * Math.sin(i * 1.4) * 8;
      ctx.quadraticCurveTo((topX + bottomX) / 2 + bend, 250, bottomX, GOAL.bottom);
      ctx.stroke();
    }
    for (let i = 0; i <= 10; i += 1) {
      const y = lerp(GOAL.top, GOAL.bottom, i / 10);
      const inset = (i / 10) * depth;
      ctx.beginPath();
      ctx.moveTo(GOAL.left + inset, y);
      ctx.quadraticCurveTo(195, y + ripplePower * Math.sin(i * 1.7) * 6, GOAL.right - inset, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(0,14,27,.32)";
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(GOAL.left + 3, GOAL.bottom + 5);
    ctx.lineTo(GOAL.left + 3, GOAL.top + 3);
    ctx.lineTo(GOAL.right + 3, GOAL.top + 3);
    ctx.lineTo(GOAL.right + 3, GOAL.bottom + 5);
    ctx.stroke();

    const post = ctx.createLinearGradient(GOAL.left, 0, GOAL.left + 10, 0);
    post.addColorStop(0, "#bdd9e7");
    post.addColorStop(0.42, "#ffffff");
    post.addColorStop(1, "#a5c2d1");
    ctx.strokeStyle = post;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(196,239,255,.5)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(GOAL.left, GOAL.bottom);
    ctx.lineTo(GOAL.left, GOAL.top);
    ctx.lineTo(GOAL.right, GOAL.top);
    ctx.lineTo(GOAL.right, GOAL.bottom);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawSegment(x1, y1, x2, y2, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawBoot(x, y, angle, color, flip = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(flip, 1);
    const boot = ctx.createLinearGradient(-10, -5, 18, 8);
    boot.addColorStop(0, color);
    boot.addColorStop(1, "#151e2d");
    ctx.fillStyle = boot;
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(8, -7);
    ctx.quadraticCurveTo(13, -2, 23, 2);
    ctx.quadraticCurveTo(25, 8, 16, 10);
    ctx.lineTo(-8, 8);
    ctx.quadraticCurveTo(-12, 1, -8, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillRect(1, -3, 11, 2);
    ctx.fillStyle = "#07111e";
    ctx.fillRect(-7, 7, 26, 2.5);
    ctx.restore();
  }

  function drawKeeperVector(time) {
    let tellLean = 0;
    if (phase === "aim" || phase === "timing") {
      tellLean = keeperPlan.tell * (4 + Math.sin(time * 3.2) * 1.7);
      keeper.x = 195 + tellLean;
      keeper.y = 300 + Math.sin(time * 4.4) * 2.5;
      keeper.rotation = tellLean * 0.005;
    }

    ctx.save();
    ctx.translate(keeper.x, keeper.y);
    ctx.rotate(keeper.rotation);
    const stretch = keeper.stretch;
    const dive = keeper.dive || keeperPlan.tell;
    const leftHand = {
      x: -48 - stretch * 35,
      y: -11 - stretch * 29,
    };
    const rightHand = {
      x: 48 + stretch * 35,
      y: -11 + stretch * 5,
    };

    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(0, 62, 41 + stretch * 35, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const leftKnee = { x: -25 - dive * stretch * 18, y: 42 - stretch * 10 };
    const rightKnee = { x: 25 - dive * stretch * 7, y: 42 + stretch * 2 };
    const leftFoot = { x: -34 - dive * stretch * 22, y: 65 - stretch * 13 };
    const rightFoot = { x: 34 - dive * stretch * 8, y: 65 + stretch * 4 };
    drawSegment(-12, 27, leftKnee.x, leftKnee.y, 18, "#17243d");
    drawSegment(12, 27, rightKnee.x, rightKnee.y, 18, "#17243d");
    drawSegment(leftKnee.x, leftKnee.y, leftFoot.x, leftFoot.y, 10, "#f0f5fa");
    drawSegment(rightKnee.x, rightKnee.y, rightFoot.x, rightFoot.y, 10, "#f0f5fa");
    drawBoot(leftFoot.x - 2, leftFoot.y + 1, -0.08, "#e9f4ff", -1);
    drawBoot(rightFoot.x + 2, rightFoot.y + 1, 0.08, "#e9f4ff", 1);

    const leftElbow = {
      x: lerp(-31, leftHand.x + 19, stretch),
      y: lerp(-2, leftHand.y + 10, stretch),
    };
    const rightElbow = {
      x: lerp(31, rightHand.x - 19, stretch),
      y: lerp(-2, rightHand.y + 10, stretch),
    };
    drawSegment(-23, -11, leftElbow.x, leftElbow.y, 17, "#f4b900");
    drawSegment(leftElbow.x, leftElbow.y, leftHand.x, leftHand.y, 14, "#ffc92e");
    drawSegment(23, -11, rightElbow.x, rightElbow.y, 17, "#f4b900");
    drawSegment(rightElbow.x, rightElbow.y, rightHand.x, rightHand.y, 14, "#ffc92e");

    [leftHand, rightHand].forEach((hand, index) => {
      const side = index === 0 ? -1 : 1;
      ctx.save();
      ctx.translate(hand.x, hand.y);
      ctx.rotate(side * (0.25 + stretch * 0.18));
      ctx.fillStyle = "#eefaff";
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.quadraticCurveTo(0, -12, 9, -6);
      ctx.lineTo(11, 5);
      ctx.quadraticCurveTo(2, 12, -9, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#47a9d5";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "rgba(35,92,123,.48)";
      ctx.lineWidth = 1;
      for (let finger = -4; finger <= 4; finger += 4) {
        ctx.beginPath();
        ctx.moveTo(finger, -6);
        ctx.lineTo(finger + side, 5);
        ctx.stroke();
      }
      ctx.restore();
    });

    const jersey = ctx.createLinearGradient(-30, -34, 30, 34);
    jersey.addColorStop(0, "#ffe879");
    jersey.addColorStop(0.45, "#ffc62c");
    jersey.addColorStop(1, "#dc8500");
    ctx.fillStyle = jersey;
    ctx.beginPath();
    ctx.moveTo(-25, -25);
    ctx.quadraticCurveTo(0, -35, 25, -25);
    ctx.lineTo(24, 20);
    ctx.quadraticCurveTo(19, 33, 0, 34);
    ctx.quadraticCurveTo(-19, 33, -24, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.19)";
    ctx.beginPath();
    ctx.moveTo(-18, -24);
    ctx.lineTo(-7, -28);
    ctx.lineTo(-10, 29);
    ctx.lineTo(-19, 25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(110,61,0,.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-24, 19);
    ctx.quadraticCurveTo(0, 24, 24, 19);
    ctx.stroke();
    ctx.fillStyle = "#092d57";
    ctx.font = "900 20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("1", 0, 15);
    ctx.font = "700 5.5px system-ui";
    ctx.fillText("KOREA", 0, -15);
    ctx.fillStyle = "#163156";
    roundRect(-20, 28, 40, 15, 5);
    ctx.fill();

    ctx.fillStyle = "#efbc94";
    roundRect(-6, -38, 12, 13, 4);
    ctx.fill();
    ctx.fillStyle = "#e7ae84";
    ctx.beginPath();
    ctx.ellipse(-16, -49, 3.8, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(16, -49, 3.8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    const skin = ctx.createLinearGradient(-15, -66, 13, -39);
    skin.addColorStop(0, "#ffd4ad");
    skin.addColorStop(1, "#e8ac81");
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(0, -51, 16, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#201923";
    ctx.beginPath();
    ctx.moveTo(-16, -54);
    ctx.quadraticCurveTo(-14, -72, 2, -70);
    ctx.quadraticCurveTo(16, -68, 17, -53);
    ctx.quadraticCurveTo(8, -59, 1, -61);
    ctx.quadraticCurveTo(-6, -55, -16, -54);
    ctx.closePath();
    ctx.fill();

    const look = phase === "aim" || phase === "timing" ? keeperPlan.tell * 1.2 : keeper.dive * 1.2;
    ctx.strokeStyle = "#3a2525";
    ctx.lineWidth = 1.4;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(side * 3 + look, -52);
      ctx.lineTo(side * 8 + look, -52.5);
      ctx.stroke();
      ctx.fillStyle = "#172230";
      ctx.beginPath();
      ctx.arc(side * 5.5 + look, -51.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = "#9b5945";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, -43, 5, Math.PI + 0.15, Math.PI * 2 - 0.15);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.42)";
    ctx.beginPath();
    ctx.ellipse(-7, -58, 4, 2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawKeeper(time) {
    const sprite = characterSprites.keeper;
    if (!sprite.complete || !sprite.naturalWidth) {
      drawKeeperVector(time);
      return;
    }

    let tellLean = 0;
    if (phase === "aim" || phase === "timing") {
      tellLean = keeperPlan.tell * (4 + Math.sin(time * 3.2) * 1.7);
      keeper.x = 195 + tellLean;
      keeper.y = 300 + Math.sin(time * 4.4) * 2.5;
      keeper.rotation = tellLean * 0.005;
    }

    const stretch = keeper.stretch;
    const dive = keeper.dive || 0;
    const h = 168;
    const w = h * (sprite.naturalWidth / sprite.naturalHeight);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.ellipse(keeper.x + dive * stretch * 18, 364, 36 + stretch * 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(keeper.x, keeper.y + 58);
    ctx.rotate(keeper.rotation + dive * stretch * 0.55);
    ctx.scale(1 + stretch * 0.08, 1 - stretch * 0.04);
    ctx.shadowColor = "rgba(0,11,24,.26)";
    ctx.shadowBlur = 6;
    ctx.drawImage(sprite, -w / 2, -h, w, h);
    ctx.restore();
  }

  function drawAim(time) {
    if (phase !== "aim" && phase !== "timing") return;
    const p = aim || hoverAim;
    ctx.save();
    ctx.globalAlpha = aim ? 1 : 0.72;
    const pulse = 1 + Math.sin(time * 6) * 0.08;
    ctx.translate(p.x, p.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = aim ? "#ffe55c" : "#71e8ff";
    ctx.lineWidth = 2.4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-27, 0);
    ctx.lineTo(-12, 0);
    ctx.moveTo(27, 0);
    ctx.lineTo(12, 0);
    ctx.moveTo(0, -27);
    ctx.lineTo(0, -12);
    ctx.moveTo(0, 27);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.restore();
  }

  function ballPosition(t) {
    const target = shot.target;
    const arc = 95 + shot.quality * 55;
    const x = lerp(BALL_START.x, target.x, easeInOut(t));
    const linearY = lerp(BALL_START.y, target.y, t);
    const y = linearY - Math.sin(Math.PI * t) * arc;
    return { x, y };
  }

  function drawBall(x, y, r, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#172331";
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const px = Math.cos(a) * r * 0.36;
      const py = Math.sin(a) * r * 0.36;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(22,35,50,.55)";
    ctx.lineWidth = Math.max(0.7, r * 0.08);
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
      ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStrikerVector(time) {
    const flightT = phase === "flight" && shot ? clamp(shot.time / shot.duration, 0, 1) : 0;
    const kick = Math.sin(Math.min(1, flightT * 2.2) * Math.PI);
    const breathe = Math.sin(time * 2.2) * 1.1;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath();
    ctx.ellipse(246, 688, 48, 10, -0.04, 0, Math.PI * 2);
    ctx.fill();

    // Rear view: lean and step into the goal (up the pitch), swing foot toward the ball.
    ctx.translate(248 - kick * 8, 668 + breathe - kick * 12);
    ctx.rotate(-0.05 - kick * 0.1);

    drawSegment(-24, -88, -38, -58, 14, "#eef4f8");
    drawSegment(-38, -58, -44, -30, 10, "#e9b58f");
    drawSegment(24, -88, 38, -58, 14, "#eef4f8");
    drawSegment(38, -58, 44, -30, 10, "#e9b58f");
    ctx.fillStyle = "#e9b58f";
    ctx.beginPath();
    ctx.arc(-45, -26, 5.5, 0, Math.PI * 2);
    ctx.arc(45, -26, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#172d50";
    roundRect(-24, -42, 48, 34, 8);
    ctx.fill();
    ctx.fillStyle = "#e52f4c";
    ctx.fillRect(-22, -38, 44, 4);

    const plantKnee = { x: 16, y: 24 };
    const plantAnkle = { x: 20, y: 54 };
    drawSegment(10, -8, plantKnee.x, plantKnee.y, 18, "#dce8ef");
    drawSegment(plantKnee.x, plantKnee.y, plantAnkle.x, plantAnkle.y, 11, "#eef5f8");
    drawBoot(plantAnkle.x + 3, plantAnkle.y + 1, 0.08, "#ff3a56", 1);

    // Kick foot starts planted near ball, then drives forward/up into the goal.
    const swingKnee = { x: -14 + kick * 4, y: 18 - kick * 18 };
    const swingAnkle = { x: -28 + kick * 10, y: 50 - kick * 46 };
    drawSegment(-10, -8, swingKnee.x, swingKnee.y, 18, "#dce8ef");
    drawSegment(swingKnee.x, swingKnee.y, swingAnkle.x, swingAnkle.y, 11, "#eef5f8");
    drawBoot(swingAnkle.x - 2, swingAnkle.y, -0.55 - kick * 0.35, "#ff3a56", -1);

    const shirt = ctx.createLinearGradient(-30, -104, 30, -34);
    shirt.addColorStop(0, "#f8fbff");
    shirt.addColorStop(0.55, "#e6eff5");
    shirt.addColorStop(1, "#adbfcd");
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(-28, -98);
    ctx.quadraticCurveTo(0, -112, 28, -98);
    ctx.lineTo(24, -40);
    ctx.quadraticCurveTo(0, -32, -24, -40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e92745";
    ctx.fillRect(-26, -74, 52, 6);
    ctx.fillStyle = "#122a4b";
    ctx.textAlign = "center";
    ctx.font = "800 8px system-ui";
    ctx.fillText("KOREA", 0, -86);
    ctx.font = "900 26px system-ui";
    ctx.fillText("10", 0, -48);

    ctx.fillStyle = "#d99d78";
    roundRect(-5, -116, 10, 16, 4);
    ctx.fill();
    ctx.fillStyle = "#1d1820";
    ctx.beginPath();
    ctx.ellipse(0, -128, 17, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0b889";
    ctx.beginPath();
    ctx.ellipse(0, -122, 13, 10, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }

  function drawStriker(time) {
    const idleSprite = characterSprites.striker;
    if (!idleSprite.complete || !idleSprite.naturalWidth) {
      drawStrikerVector(time);
      return;
    }

    const isMoving = shot && (phase === "kick" || phase === "flight");
    const kickSheet = characterSprites.strikerKick;
    const useFrames = isMoving && kickSheet.complete && kickSheet.naturalWidth;
    const motion = isMoving ? Math.min(KICK_MOTION_END, shot.motionTime) : 0;
    const breathe = isMoving ? 0 : Math.sin(time * 2.2) * 1.1;
    const run = clamp(motion / KICK_CONTACT_TIME, 0, 1);
    const recover = clamp((motion - KICK_CONTACT_TIME) / (KICK_MOTION_END - KICK_CONTACT_TIME), 0, 1);
    const footX = 248 - run * 9 - recover * 5;
    const footY = 690 - run * 8 - recover * 3 + breathe;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.24)";
    ctx.beginPath();
    ctx.ellipse(footX - 2, 684, 43 - recover * 4, 9, -0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "rgba(0,8,18,.24)";
    ctx.shadowBlur = 7;

    if (useFrames) {
      // Whole, consistently rendered frames avoid sliced-limb seams and impossible joints.
      const frame =
        motion < 0.16 ? 0 :
          motion < 0.34 ? 1 :
            motion < KICK_CONTACT_TIME ? 2 : 3;
      const frameCrops = [
        { x: 0, w: 330 },
        { x: 330, w: 460 },
        { x: 780, w: 430 },
        { x: 1230, w: 306 },
      ];
      const crop = frameCrops[frame];
      const sourceScale = kickSheet.naturalWidth / 1536;
      const sourceX = crop.x * sourceScale;
      const sourceW = crop.w * sourceScale;
      const sourceY = kickSheet.naturalHeight * 0.1;
      const sourceH = kickSheet.naturalHeight * 0.8;
      const drawH = 218;
      const drawW = drawH * (sourceW / sourceH);
      ctx.translate(footX, footY);
      ctx.rotate(-0.025 - run * 0.025 + recover * 0.035);
      ctx.drawImage(
        kickSheet,
        sourceX,
        sourceY,
        sourceW,
        sourceH,
        -drawW / 2,
        -drawH,
        drawW,
        drawH
      );
    } else {
      const h = 208;
      const w = h * (idleSprite.naturalWidth / idleSprite.naturalHeight);
      ctx.translate(footX, footY);
      ctx.rotate(-0.03);
      ctx.drawImage(idleSprite, -w / 2, -h, w, h);
    }
    ctx.restore();
  }

  function drawShot() {
    if ((phase !== "flight" && phase !== "kick") || !shot) {
      drawBall(BALL_START.x, BALL_START.y, 13, 0);
      return;
    }
    if (phase === "kick") {
      drawBall(BALL_START.x, BALL_START.y, 13, 0);
      return;
    }
    const t = clamp(shot.time / shot.duration, 0, 1);
    const pos = ballPosition(t);
    const targetScale = 0.48;
    const radius = lerp(13, 13 * targetScale, t);

    ctx.fillStyle = `rgba(0,0,0,${0.25 * (1 - t)})`;
    ctx.beginPath();
    ctx.ellipse(
      lerp(BALL_START.x, shot.target.x, t),
      lerp(BALL_START.y + 13, GOAL.bottom + 4, t),
      radius * 1.4,
      radius * 0.45,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.strokeStyle = `rgba(218,248,255,${0.48 * (1 - t)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < 7; i += 1) {
      const tt = clamp(t - i * 0.025, 0, 1);
      const p = ballPosition(tt);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    drawBall(pos.x, pos.y, radius, t * 13);
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.globalAlpha = clamp(p.life / Math.min(p.max, 0.45), 0, 1);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.x * 0.03);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.72);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  function draw(time) {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawSky(time);
    drawFloodlight(8, 150, 1);
    drawFloodlight(382, 150, -1);
    drawStands(time);
    drawPitch();
    drawGoal();
    drawAim(time);
    drawKeeper(time);
    drawShot();
    drawStriker(time);
    drawParticles();
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,242,130,${flash * 0.22})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(now) {
    const dt = Math.min(0.033, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    update(dt);
    draw(now / 1000);
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointermove", (event) => {
    if (phase !== "aim") return;
    const p = pointFromEvent(event);
    if (isInsideGoal(p)) hoverAim = p;
  });
  canvas.addEventListener("click", (event) => {
    event.preventDefault();
    if (phase === "aim") selectAim(pointFromEvent(event));
  });
  document.getElementById("kick-btn").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    resolveShot();
  });
  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextRound);
  document.getElementById("retry-btn").addEventListener("click", startGame);

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      if (phase === "timing") {
        event.preventDefault();
        resolveShot();
      }
    }
    if (phase === "aim") {
      const step = event.shiftKey ? 18 : 8;
      if (event.code === "ArrowLeft") hoverAim.x -= step;
      if (event.code === "ArrowRight") hoverAim.x += step;
      if (event.code === "ArrowUp") hoverAim.y -= step;
      if (event.code === "ArrowDown") hoverAim.y += step;
      hoverAim.x = clamp(hoverAim.x, GOAL.left + 16, GOAL.right - 16);
      hoverAim.y = clamp(hoverAim.y, GOAL.top + 16, GOAL.bottom - 24);
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
      if (event.code === "Enter") selectAim(hoverAim);
    }
  });

  document.addEventListener("visibilitychange", () => {
    last = performance.now();
  });

  buildDots();
  updateHud();
  if (window.TodayGameRank) {
    window.TodayGameRank.mount({
      gameId: "penalty-kick",
      gameTitle: "승부차기 히어로",
      formParent: ui.over,
    });
  }
  requestAnimationFrame(loop);
})();
