(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const TOTAL_ROUNDS = 10;
  const GOAL = { left: 48, right: 342, top: 166, bottom: 369 };
  const BALL_START = { x: 195, y: 596 };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

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
  let keeper = { x: 195, y: 315, rotation: 0, stretch: 0, dive: 0 };
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
    keeper = { x: 195, y: 315, rotation: 0, stretch: 0, dive: 0 };
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
    phase = "flight";
    ui.timing.classList.add("hidden");
    ui.coach.textContent = grade === "PERFECT" ? "PERFECT SHOT!" : `${grade} · 공의 궤적을 보세요`;
    kickSound();
    shake = 5 + quality * 3;
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

    if (phase === "flight" && shot) {
      shot.time += dt;
      const t = clamp(shot.time / shot.duration, 0, 1);
      const difficulty = round / (TOTAL_ROUNDS - 1);
      const diveDelay = 0.1 + (1 - difficulty) * 0.1;
      const diveT = clamp((t - diveDelay) / (0.65 - diveDelay), 0, 1);
      const k = easeOut(diveT);
      keeper.x = lerp(195, shot.keeperTarget.x, k);
      keeper.y = lerp(315, shot.keeperTarget.y, k);
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
    ctx.fillStyle = "#061329";
    ctx.beginPath();
    ctx.moveTo(0, 236);
    ctx.lineTo(W, 236);
    ctx.lineTo(W, 390);
    ctx.lineTo(0, 390);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#0d2542";
    ctx.fillRect(0, 252, W, 22);
    ctx.fillStyle = "#e8f4ff";
    ctx.globalAlpha = 0.12;
    ctx.fillRect(0, 276, W, 3);
    ctx.globalAlpha = 1;

    const colors = ["#f4d35e", "#e85d75", "#4ea8de", "#8ac926", "#ffffff"];
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 28; col += 1) {
        const x = col * 15 + (row % 2) * 6 - 8;
        const y = 286 + row * 12;
        const bounce = crowdPulse * Math.sin(time * 18 + col * 0.7) * 4;
        ctx.fillStyle = colors[(col * 3 + row) % colors.length];
        ctx.globalAlpha = 0.48 + (row % 3) * 0.12;
        ctx.beginPath();
        ctx.arc(x, y + bounce, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPitch() {
    const grad = ctx.createLinearGradient(0, 350, 0, H);
    grad.addColorStop(0, "#23834f");
    grad.addColorStop(1, "#0f5e36");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 350, W, H - 350);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 350, W, H - 350);
    ctx.clip();
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 ? "rgba(34,139,78,.28)" : "rgba(123,210,124,.08)";
      ctx.beginPath();
      ctx.moveTo(195 + (i - 4) * 34, 350);
      ctx.lineTo(195 + (i - 3) * 110, H);
      ctx.lineTo(195 + (i - 2) * 110, H);
      ctx.lineTo(195 + (i - 3) * 34, 350);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(240,255,238,.82)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, 368);
    ctx.lineTo(-45, 700);
    ctx.moveTo(354, 368);
    ctx.lineTo(435, 700);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(195, 664, 126, 57, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(BALL_START.x, BALL_START.y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = "#eaffea";
    ctx.fill();
  }

  function drawGoal() {
    const ripplePower = ripples.reduce((sum, r) => sum + r.life / r.max, 0);
    ctx.save();
    ctx.strokeStyle = `rgba(207,238,255,${0.35 + ripplePower * 0.2})`;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i += 1) {
      const x = lerp(GOAL.left, GOAL.right, i / 10);
      ctx.beginPath();
      ctx.moveTo(x, GOAL.top);
      const bend = ripplePower * Math.sin(i * 1.5) * 7;
      ctx.quadraticCurveTo(x + bend, (GOAL.top + GOAL.bottom) / 2, x, GOAL.bottom);
      ctx.stroke();
    }
    for (let i = 0; i <= 8; i += 1) {
      const y = lerp(GOAL.top, GOAL.bottom, i / 8);
      ctx.beginPath();
      ctx.moveTo(GOAL.left, y);
      ctx.quadraticCurveTo(195, y + ripplePower * Math.sin(i * 1.8) * 5, GOAL.right, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#f4fbff";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(155,225,255,.42)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(GOAL.left, GOAL.bottom);
    ctx.lineTo(GOAL.left, GOAL.top);
    ctx.lineTo(GOAL.right, GOAL.top);
    ctx.lineTo(GOAL.right, GOAL.bottom);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawKeeper(time) {
    let tellLean = 0;
    if (phase === "aim" || phase === "timing") {
      tellLean = keeperPlan.tell * (3 + Math.sin(time * 3.2) * 1.5);
      keeper.x = 195 + tellLean;
      keeper.y = 315 + Math.sin(time * 4.4) * 2;
      keeper.rotation = tellLean * 0.006;
    }

    ctx.save();
    ctx.translate(keeper.x, keeper.y);
    ctx.rotate(keeper.rotation);
    const stretch = keeper.stretch;
    const dive = keeper.dive || keeperPlan.tell;

    ctx.fillStyle = "rgba(0,0,0,.23)";
    ctx.beginPath();
    ctx.ellipse(0, 46, 30 + stretch * 27, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#f3bf93";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-14, 27);
    ctx.lineTo(-20 - dive * stretch * 15, 48 - stretch * 7);
    ctx.moveTo(14, 27);
    ctx.lineTo(20 - dive * stretch * 5, 48 + stretch * 3);
    ctx.stroke();

    ctx.strokeStyle = "#ffcf3d";
    ctx.lineWidth = 15;
    ctx.beginPath();
    const armReach = 29 + stretch * 24;
    ctx.moveTo(-18, -7);
    ctx.lineTo(-armReach, -19 - stretch * 15);
    ctx.moveTo(18, -7);
    ctx.lineTo(armReach, -19 + stretch * 3);
    ctx.stroke();

    ctx.fillStyle = "#f6fbff";
    [-1, 1].forEach((side) => {
      const handX = side * armReach;
      const handY = side === -1 ? -19 - stretch * 15 : -19 + stretch * 3;
      ctx.beginPath();
      ctx.arc(handX, handY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#67c7ef";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    const jersey = ctx.createLinearGradient(-20, -25, 20, 32);
    jersey.addColorStop(0, "#ffe45b");
    jersey.addColorStop(1, "#f2a900");
    ctx.fillStyle = jersey;
    roundRect(-22, -25, 44, 55, 13);
    ctx.fill();
    ctx.fillStyle = "#0b315a";
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("1", 0, 10);

    ctx.fillStyle = "#f4c19b";
    ctx.beginPath();
    ctx.arc(0, -39, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b1d24";
    ctx.beginPath();
    ctx.arc(0, -45, 15, Math.PI, Math.PI * 2);
    ctx.fill();

    const look = phase === "aim" || phase === "timing" ? keeperPlan.tell * 2.2 : keeper.dive * 2.2;
    ctx.fillStyle = "#fff";
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(side * 6, -40, 4.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#13253b";
      ctx.beginPath();
      ctx.arc(side * 6 + look, -40, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
    });
    ctx.strokeStyle = "#7d382a";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -33, 5, 0.08, Math.PI - 0.08);
    ctx.stroke();
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

  function drawPlayerBoot(time) {
    if (phase === "flight" && shot) return;
    ctx.save();
    ctx.translate(245, 618 + Math.sin(time * 2) * 1.5);
    ctx.rotate(-0.18);
    ctx.fillStyle = "#173d7a";
    roundRect(-10, -40, 24, 66, 10);
    ctx.fill();
    ctx.fillStyle = "#e8f4ff";
    ctx.fillRect(-9, 2, 23, 13);
    ctx.fillStyle = "#ff4c55";
    ctx.beginPath();
    ctx.moveTo(-9, 12);
    ctx.lineTo(18, 10);
    ctx.quadraticCurveTo(38, 15, 35, 27);
    ctx.quadraticCurveTo(5, 34, -10, 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(5, 16, 17, 3);
    ctx.restore();
  }

  function drawShot() {
    if (phase !== "flight" || !shot) {
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
    drawPlayerBoot(time);
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
