(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const BEST_KEY = "today-rps-best";
  const CHOICES = ["rock", "scissors", "paper"];
  const LABELS = { rock: "바위", scissors: "가위", paper: "보" };
  const NEON = { rock: "#d8e0ea", scissors: "#00f2ff", paper: "#ff9a1a" };
  const CYAN = "#00f2ff";
  const CORAL = "#ff3131";
  const TOTAL_STAGES = 50;

  const BASE_NAMES = [
    "네온 입문", "핸드 스파크", "연속 도전", "승부사", "하이 볼트",
    "흔들림 금지", "플래시 대결", "대결왕", "연승 질주", "마스터",
    "아케이드 나이트", "RPS 레전드",
  ];

  const STAGES = Array.from({ length: TOTAL_STAGES }, (_, i) => ({
    name: BASE_NAMES[i] || `스테이지 ${i + 1}`,
    goal: 3 + Math.floor(i * 1.2),
    lives: i < 4 ? 3 : i < 8 ? 2 : 1,
  }));

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };
  const pickBar = document.getElementById("pick-bar");

  let state = "title";
  let stageIndex = 0;
  let streak = 0;
  let stageWins = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  let lives = 3;
  let playerChoice = null;
  let cpuChoice = null;
  let revealT = 0;
  let result = null;
  let resultT = 0;
  let bounce = 0;
  let shake = 0;
  let particles = [];
  let floats = [];
  let last = 0;
  let message = "골라주세요!";
  let ringPulse = 0;
  const sprites = {
    rock: null,
    scissors: null,
    paper: null,
    bg: null,
    ring: null,
    vs: null,
  };

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadAssets() {
    const [rock, scissors, paper, bg, ring, vs] = await Promise.all([
      loadImg("assets/rock.png"),
      loadImg("assets/scissors.png"),
      loadImg("assets/paper.png"),
      loadImg("assets/bg-metal.png"),
      loadImg("assets/arena-ring.png"),
      loadImg("assets/vs-badge.png"),
    ]);
    sprites.rock = rock;
    sprites.scissors = scissors;
    sprites.paper = paper;
    sprites.bg = bg;
    sprites.ring = ring;
    sprites.vs = vs;
  }

  function show(el, on) {
    el.classList.toggle("hidden", !on);
  }

  function hideAll() {
    Object.values(overlays).forEach((o) => show(o, false));
  }

  function setPicks(on) {
    pickBar.classList.toggle("on", on);
  }

  function beats(a, b) {
    return (
      (a === "rock" && b === "scissors") ||
      (a === "scissors" && b === "paper") ||
      (a === "paper" && b === "rock")
    );
  }

  function updateHud() {
    const st = STAGES[stageIndex];
    document.getElementById("hud-stage").textContent = String(stageIndex + 1);
    document.getElementById("hud-streak").textContent = String(streak);
    document.getElementById("hud-goal").textContent = String(st.goal);
    document.getElementById("hud-best").textContent = String(best);
    document.getElementById("goal-fill").style.width =
      `${Math.min(100, (stageWins / st.goal) * 100)}%`;
  }

  function saveBest() {
    if (streak > best) {
      best = streak;
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  function burst(x, y, colors, n = 28) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 240;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 70,
        life: 0.65 + Math.random() * 0.55,
        size: 2.5 + Math.random() * 4.5,
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 10,
        shape: Math.random() < 0.35 ? "star" : "rect",
      });
    }
  }

  function confettiWin() {
    burst(W / 2, H * 0.38, [CORAL, CYAN, "#ffd60a", "#fff", "#7ad7ff", "#d8e0ea"], 48);
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 1.1 });
  }

  function drawStar(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const b = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(b) * r * 0.42, y + Math.sin(b) * r * 0.42);
    }
    ctx.closePath();
    ctx.fill();
  }

  function chromeFill(x0, y0, x1, y1, c0, c1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.22, c0);
    g.addColorStop(0.7, c1);
    g.addColorStop(1, "#0a1218");
    return g;
  }

  function drawGlowOrb(x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawRock(scale = 1) {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.shadowColor = "#c8d4e0";
    ctx.shadowBlur = 18;
    ctx.fillStyle = chromeFill(-20, -30, 20, 30, "#f4f7fb", "#8a96a8");
    ctx.beginPath();
    ctx.moveTo(-28, 8);
    ctx.quadraticCurveTo(-34, -6, -22, -22);
    ctx.quadraticCurveTo(-8, -34, 4, -30);
    ctx.quadraticCurveTo(18, -34, 28, -20);
    ctx.quadraticCurveTo(34, -4, 26, 14);
    ctx.quadraticCurveTo(18, 28, 0, 30);
    ctx.quadraticCurveTo(-18, 28, -28, 8);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    [[-14, -12], [0, -16], [14, -12]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0.2, Math.PI - 0.2);
      ctx.stroke();
    });
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, -8);
    ctx.quadraticCurveTo(-4, -22, 12, -10);
    ctx.stroke();
    ctx.restore();
  }

  function drawPaper(scale = 1) {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.shadowColor = NEON.paper;
    ctx.shadowBlur = 18;
    ctx.fillStyle = chromeFill(-16, -30, 16, 28, "#ffd080", "#ff7a18");
    ctx.beginPath();
    ctx.roundRect(-22, -4, 44, 36, 14);
    ctx.fill();
    [[-18, -28], [-6, -36], [6, -36], [18, -26]].forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.roundRect(x - 6, y, 12, 28 + (i === 1 || i === 2 ? 4 : 0), 6);
      ctx.fill();
    });
    ctx.beginPath();
    ctx.ellipse(-28, 8, 9, 14, -0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.lineTo(-10, 22);
    ctx.moveTo(2, 2);
    ctx.lineTo(2, 22);
    ctx.moveTo(14, 4);
    ctx.lineTo(14, 20);
    ctx.stroke();
    ctx.restore();
  }

  function drawScissors(scale = 1) {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.shadowColor = NEON.scissors;
    ctx.shadowBlur = 18;
    ctx.fillStyle = chromeFill(-12, -28, 18, 24, "#9ff8ff", "#00f2ff");
    ctx.beginPath();
    ctx.ellipse(2, 12, 20, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-14, -16, 9, 26, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(18, -16, 9, 26, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-4, 22, 7, 9, 0.15, 0, Math.PI * 2);
    ctx.ellipse(12, 22, 7, 9, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-14, -28);
    ctx.lineTo(-10, 2);
    ctx.moveTo(18, -28);
    ctx.lineTo(14, 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawHand(choice, x, y, scale, bounceY, flip) {
    ctx.save();
    ctx.translate(x, y + bounceY);
    if (flip) ctx.scale(-1, 1);

    const spr = sprites[choice];
    if (spr) {
      const glow = NEON[choice];
      const baseH = 118 * scale;
      const aspect = (spr.naturalWidth || spr.width) / (spr.naturalHeight || spr.height || 1);
      const drawH = baseH;
      const drawW = drawH * aspect;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 26 * scale;
      ctx.drawImage(spr, -drawW / 2, -drawH * 0.62, drawW, drawH);
      ctx.shadowBlur = 0;
    } else if (choice === "rock") {
      drawRock(scale);
    } else if (choice === "paper") {
      drawPaper(scale);
    } else {
      drawScissors(scale);
    }

    // pedestal ring
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = NEON[choice];
    ctx.lineWidth = 2.2;
    ctx.shadowColor = NEON[choice];
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 48 * scale, 34 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBackground(t) {
    if (sprites.bg) {
      ctx.drawImage(sprites.bg, 0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#061018");
      g.addColorStop(0.5, "#0a0c10");
      g.addColorStop(1, "#14080c");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // dark vignette for HUD readability
    const vig = ctx.createRadialGradient(W / 2, H * 0.38, 40, W / 2, H * 0.4, 320);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // cyan / red ambient wash matching thumbnail
    drawGlowOrb(46, 250, 70, CYAN, 0.1 + Math.sin(t * 2) * 0.025);
    drawGlowOrb(344, 250, 70, CORAL, 0.1 + Math.sin(t * 2.2 + 1) * 0.025);
    drawGlowOrb(W / 2, 180, 50, "#ffffff", 0.03 + Math.sin(t * 1.6) * 0.01);

    // brushed metal micro scratches (procedural overlay)
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.strokeStyle = "#c8d4e0";
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i += 1) {
      const y = 90 + i * 22 + Math.sin(t + i) * 1.5;
      ctx.beginPath();
      ctx.moveTo(18, y);
      ctx.quadraticCurveTo(W / 2, y + Math.sin(i * 0.7) * 4, W - 18, y);
      ctx.stroke();
    }
    ctx.restore();

    // arena floor plate
    ctx.save();
    const floorY = 268;
    const floorG = ctx.createRadialGradient(W / 2, floorY, 20, W / 2, floorY, 160);
    floorG.addColorStop(0, "rgba(28, 34, 44, 0.55)");
    floorG.addColorStop(0.55, "rgba(10, 14, 20, 0.35)");
    floorG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = floorG;
    ctx.beginPath();
    ctx.ellipse(W / 2, floorY + 78, 148, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // neon arena ring
    const ringPulseScale = 1 + Math.sin(t * 3.2) * 0.012;
    const ringSize = 300 * ringPulseScale;
    if (sprites.ring) {
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 18;
      ctx.drawImage(
        sprites.ring,
        W / 2 - ringSize / 2,
        168 - (ringSize - 300) / 2,
        ringSize,
        ringSize
      );
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(W / 2, 318);
      ctx.lineWidth = 4;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, 118, Math.PI * 0.5, Math.PI * 1.5);
      ctx.strokeStyle = CYAN;
      ctx.shadowColor = CYAN;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 118, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.strokeStyle = CORAL;
      ctx.shadowColor = CORAL;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawVsBadge(t) {
    ringPulse = 18 + Math.sin(t * 5) * 3;
    ctx.save();
    ctx.translate(W / 2, 278);
    const pulse = 1 + Math.sin(t * 4.5) * 0.04;
    if (sprites.vs) {
      const size = 78 * pulse;
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 18;
      ctx.drawImage(sprites.vs, -size / 2, -size / 2, size, size);
    } else {
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, ringPulse, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,242,255,0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(-20, -20, 20, 20);
      g.addColorStop(0, CORAL);
      g.addColorStop(1, CYAN);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#061018";
      ctx.font = '700 15px "Orbitron", "Bagel Fat One", "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("VS", 0, 1);
    }
    ctx.restore();
  }

  function currentCpuDisplay() {
    if (state === "reveal") {
      // 가위바위보 동시에 섞기
      return CHOICES[Math.floor(revealT * 14) % CHOICES.length];
    }
    if (state === "result" && cpuChoice) return cpuChoice;
    return CHOICES[Math.floor((performance.now() / 380) % 3)];
  }

  function currentPlayerDisplay() {
    if (state === "reveal") {
      // 플레이어 선택도 공개 전까지 같이 섞임 (먼저 고정 표시 X)
      return CHOICES[Math.floor(revealT * 14 + 1) % CHOICES.length];
    }
    if ((state === "result" || state === "clear" || state === "over" || state === "allclear") && playerChoice) {
      return playerChoice;
    }
    if (state === "play") {
      return CHOICES[Math.floor((bounce * 1.6) % 3)];
    }
    return playerChoice || CHOICES[0];
  }

  function drawSideLabel(text, x, y, color) {
    ctx.save();
    ctx.font = '700 12px "Orbitron", "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawScene(dt) {
    bounce += dt;
    const bob = Math.sin(bounce * 3.4) * 5;
    const bob2 = Math.sin(bounce * 3.4 + 1.1) * 5;

    let sx = 0;
    let sy = 0;
    if (shake > 0) {
      sx = (Math.random() - 0.5) * shake;
      sy = (Math.random() - 0.5) * shake;
      shake *= 0.86;
      if (shake < 0.35) shake = 0;
    }

    ctx.save();
    ctx.translate(sx, sy);
    drawBackground(bounce);

    ctx.fillStyle = "rgba(232,255,255,0.78)";
    ctx.font = '700 12px "Orbitron", "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 8;
    ctx.fillText(STAGES[stageIndex].name.toUpperCase(), W / 2, 98);
    ctx.shadowBlur = 0;

    drawSideLabel("CPU", 108, 148, CYAN);
    drawSideLabel("YOU", 282, 148, CORAL);

    const cpuShow = currentCpuDisplay();
    const playerShow = currentPlayerDisplay();

    let cpuScale = 0.98;
    let plyScale = 0.98;
    if (state === "reveal") {
      // 양쪽 동시에 흔들림
      const shakeScale = 0.88 + Math.sin(revealT * 28) * 0.12;
      cpuScale = shakeScale;
      plyScale = shakeScale;
    }
    if (state === "result") {
      const pop = Math.min(1, resultT * 4);
      const ease = 1 + Math.sin(pop * Math.PI) * 0.2;
      if (result === "win") plyScale = ease;
      if (result === "lose") cpuScale = ease;
      if (result === "draw") {
        cpuScale = ease;
        plyScale = ease;
      }
    }

    drawHand(cpuShow, 108, 248, cpuScale, bob, true);
    drawHand(playerShow, 282, 248, plyScale, bob2, false);
    drawVsBadge(bounce);

    // message plaque — chrome metal strip
    ctx.save();
    const px = 40;
    const py = 428;
    const pw = W - 80;
    const ph = 48;
    const plate = ctx.createLinearGradient(px, py, px, py + ph);
    plate.addColorStop(0, "rgba(48, 56, 68, 0.92)");
    plate.addColorStop(0.45, "rgba(12, 16, 24, 0.92)");
    plate.addColorStop(1, "rgba(8, 10, 16, 0.94)");
    ctx.shadowColor = "rgba(0,242,255,0.28)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = plate;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    const rim = ctx.createLinearGradient(px, py, px + pw, py);
    rim.addColorStop(0, "rgba(0,242,255,0.7)");
    rim.addColorStop(0.5, "rgba(220,230,240,0.45)");
    rim.addColorStop(1, "rgba(255,49,49,0.7)");
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#e8ffff";
    ctx.font = '17px "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,242,255,0.35)";
    ctx.shadowBlur = 6;
    ctx.fillText(message, W / 2, 458);
    ctx.shadowBlur = 0;

    // lives
    for (let i = 0; i < STAGES[stageIndex].lives; i += 1) {
      const alive = i < lives;
      const hx = W / 2 - (STAGES[stageIndex].lives - 1) * 11 + i * 22;
      ctx.save();
      ctx.shadowColor = alive ? CORAL : "transparent";
      ctx.shadowBlur = alive ? 10 : 0;
      ctx.fillStyle = alive ? CORAL : "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.arc(hx, 496, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.rot += p.spin * dt;
      if (p.life <= 0) return false;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      if (p.shape === "star") drawStar(0, 0, p.size, p.color);
      else ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
      ctx.restore();
      return true;
    });
  }

  function drawFloats(dt) {
    floats = floats.filter((f) => {
      f.life -= dt;
      f.y -= 50 * dt;
      if (f.life <= 0) return false;
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.font = '700 24px "Orbitron", "Bagel Fat One", "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 12;
      ctx.fillText(f.text, f.x, f.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      return true;
    });
  }

  function beginReveal(choice) {
    // 선택은 내부만 저장 — 화면에는 동시에 공개
    playerChoice = choice;
    cpuChoice = CHOICES[Math.floor(Math.random() * 3)];
    state = "reveal";
    revealT = 0;
    message = "가위! 바위! 보!";
    setPicks(false);
  }

  function finishReveal() {
    state = "result";
    resultT = 0;
    // 여기서 양쪽 실제 패가 동시에 고정 표시됨
    if (playerChoice === cpuChoice) {
      result = "draw";
      message = `무승부 · ${LABELS[playerChoice]}`;
      addFloat(W / 2, 280, "DRAW", "#ffd60a");
      burst(W / 2, 260, ["#ffd60a", CYAN, "#fff"], 18);
    } else if (beats(playerChoice, cpuChoice)) {
      result = "win";
      streak += 1;
      stageWins += 1;
      saveBest();
      message = `WIN · ${LABELS[playerChoice]} > ${LABELS[cpuChoice]}`;
      addFloat(W / 2, 270, "WIN!", CYAN);
      confettiWin();
    } else {
      result = "lose";
      streak = 0;
      lives -= 1;
      message = `LOSE · ${LABELS[cpuChoice]} > ${LABELS[playerChoice]}`;
      addFloat(W / 2, 270, "LOSE", CORAL);
      shake = 12;
      burst(W / 2, 260, [CORAL, "#888"], 16);
    }
    updateHud();
  }

  function afterResult() {
    const st = STAGES[stageIndex];
    if (lives <= 0) {
      state = "over";
      setPicks(false);
      const rankScore = Math.max(1, best * 100);
      document.getElementById("over-detail").textContent =
        `연속 ${Math.max(stageWins, 0)}승 · 최고 ${best}연속 · 점수 ${rankScore}`;
      show(overlays.over, true);
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "rps", gameTitle: "가위바위보", formParent: overlays.over });
      TodayGameRank.open(rankScore);
    }
      return;
    }
    if (stageWins >= st.goal) {
      if (stageIndex >= TOTAL_STAGES - 1) {
        state = "allclear";
        setPicks(false);
        document.getElementById("all-detail").textContent =
          `최고 연속 ${best}승! 레전드 클리어`;
        show(overlays.all, true);
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "rps", gameTitle: "가위바위보", formParent: overlays.all });
      TodayGameRank.open(Math.max(1, best * 100));
    }
        confettiWin();
        return;
      }
      state = "clear";
      setPicks(false);
      document.getElementById("clear-detail").textContent =
        `${st.name} 클리어! 목표 ${st.goal}승 달성`;
      show(overlays.clear, true);
      confettiWin();
      return;
    }
    playerChoice = null;
    cpuChoice = null;
    result = null;
    state = "play";
    message = "골라주세요!";
    setPicks(true);
  }

  function tick(dt) {
    if (state === "reveal") {
      revealT += dt;
      // 가위 / 바위 / 보 멘트
      if (revealT < 0.45) message = "가위!";
      else if (revealT < 0.9) message = "바위!";
      else if (revealT < 1.35) message = "보!";
      else finishReveal();
    } else if (state === "result") {
      resultT += dt;
      if (resultT >= 1.35) afterResult();
    }
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    tick(dt);
    drawScene(dt);
    drawParticles(dt);
    drawFloats(dt);
    requestAnimationFrame(loop);
  }

  function resetStage() {
    const st = STAGES[stageIndex];
    stageWins = 0;
    lives = st.lives;
    playerChoice = null;
    cpuChoice = null;
    result = null;
    message = "골라주세요!";
    updateHud();
  }

  function startGame() {
    stageIndex = 0;
    streak = 0;
    if (window.TodayGameRank) TodayGameRank.reset();
    state = "play";
    hideAll();
    resetStage();
    setPicks(true);
  }

  pickBar.querySelectorAll(".pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state !== "play") return;
      beginReveal(btn.dataset.choice);
    });
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", () => {
    stageIndex += 1;
    state = "play";
    hideAll();
    resetStage();
    setPicks(true);
  });

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      this.moveTo(x + rr, y);
      this.arcTo(x + w, y, x + w, y + h, rr);
      this.arcTo(x + w, y + h, x, y + h, rr);
      this.arcTo(x, y + h, x, y, rr);
      this.arcTo(x, y, x + w, y, rr);
      this.closePath();
      return this;
    };
  }

  updateHud();
  setPicks(false);
  last = performance.now();
  loadAssets().then(() => {
    requestAnimationFrame(loop);
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "rps",
      gameTitle: "가위바위보",
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
