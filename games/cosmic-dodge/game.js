(() => {
  "use strict";

  const GAME_ID = "cosmic-dodge";
  const GAME_TITLE = "우주 회피";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const hudScore = document.getElementById("hud-score");
  const hudBest = document.getElementById("hud-best");
  const titleOverlay = document.getElementById("title");
  const overOverlay = document.getElementById("over");
  const overDetail = document.getElementById("over-detail");
  const startBtn = document.getElementById("start-btn");
  const retryBtn = document.getElementById("retry-btn");
  const rankContainer = document.getElementById("rank-form-container");

  // Audio Synth (Web Audio API)
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    try {
      const ac = getAudioCtx();
      if (!ac) return;
      const now = ac.currentTime;

      if (type === "star") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === "shield") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.25);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === "hit") {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (_) {}
  }

  // Canvas High-DPI Resizing
  let W = 390;
  let H = 700;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width || 390;
    H = rect.height || 700;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // Game States
  let state = "title"; // "title", "playing", "over"
  let score = 0;
  let bestScore = Number(localStorage.getItem(`best_${GAME_ID}`) || 0);
  hudBest.textContent = bestScore.toLocaleString("ko-KR");

  // Player
  const player = {
    x: W / 2,
    y: H - 120,
    r: 22,
    vx: 0,
    targetX: W / 2,
    hasShield: false,
    slowTimer: 0,
  };

  // Entities
  let stars = []; // background starfield
  let hazards = []; // meteors & mines
  let items = []; // stars & shield powerups
  let particles = []; // explosions & engine thruster trail

  function initStarfield() {
    stars = [];
    for (let i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 2.2 + 0.8,
        speed: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.8 + 0.2,
      });
    }
  }
  initStarfield();

  // Touch / Mouse / Keyboard Input
  let isDragging = false;
  const keys = {};

  function getXFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
    return clientX - rect.left;
  }

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (state === "playing" && (e.key === "Escape" || e.key === "p" || e.key === "P")) {
      if (window.TodayPause) window.TodayPause.toggle();
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  canvas.addEventListener("pointerdown", (e) => {
    getAudioCtx();
    if (state !== "playing") return;
    isDragging = true;
    player.targetX = getXFromEvent(e);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (state !== "playing" || !isDragging) return;
    player.targetX = getXFromEvent(e);
  });

  window.addEventListener("pointerup", () => {
    isDragging = false;
  });

  // Game Setup
  function resetGame() {
    score = 0;
    hudScore.textContent = "0";
    player.x = W / 2;
    player.targetX = W / 2;
    player.y = H - 120;
    player.hasShield = false;
    player.slowTimer = 0;
    hazards = [];
    items = [];
    particles = [];
  }

  function spawnHazard() {
    const isMine = Math.random() < 0.25;
    const size = isMine ? 18 : Math.random() * 16 + 14;
    hazards.push({
      x: Math.random() * (W - 60) + 30,
      y: -40,
      r: size,
      type: isMine ? "mine" : "meteor",
      vy: (Math.random() * 2.5 + 2.8) * (1 + score / 3000),
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.08,
    });
  }

  function spawnItem() {
    const isShield = Math.random() < 0.2 && !player.hasShield;
    const isSlow = Math.random() < 0.15 && player.slowTimer <= 0;
    let type = "star";
    if (isShield) type = "shield";
    else if (isSlow) type = "slow";

    items.push({
      x: Math.random() * (W - 60) + 30,
      y: -30,
      r: 16,
      type,
      vy: Math.random() * 1.5 + 2.0,
      rot: 0,
    });
  }

  function addExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: Math.random() * 3 + 2,
        color,
        life: 1,
        decay: Math.random() * 0.04 + 0.02,
      });
    }
  }

  let spawnTimer = 0;
  let itemTimer = 0;
  let lastTime = performance.now();

  function update(dt) {
    // Starfield animation
    const speedMult = player.slowTimer > 0 ? 0.4 : 1;
    stars.forEach((s) => {
      s.y += s.speed * speedMult;
      if (s.y > H) {
        s.y = 0;
        s.x = Math.random() * W;
      }
    });

    if (state !== "playing") return;

    // Slow powerup countdown
    if (player.slowTimer > 0) {
      player.slowTimer -= dt;
    }

    // Controls input (Keyboard + Touch target)
    if (keys["ArrowLeft"] || keys["a"] || keys["A"]) {
      player.targetX -= 8;
    }
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) {
      player.targetX += 8;
    }

    player.targetX = Math.max(player.r, Math.min(W - player.r, player.targetX));
    player.x += (player.targetX - player.x) * 0.2;

    // Thruster Particles
    if (Math.random() < 0.8) {
      particles.push({
        x: player.x + (Math.random() - 0.5) * 10,
        y: player.y + 18,
        vx: (Math.random() - 0.5) * 1.2,
        vy: Math.random() * 3 + 2,
        r: Math.random() * 3 + 1,
        color: player.hasShield ? "#00f0ff" : "#ff9e00",
        life: 1,
        decay: 0.06,
      });
    }

    // Score accumulation
    score += Math.floor(dt * 60);
    hudScore.textContent = score.toLocaleString("ko-KR");

    // Spawning hazards & items
    spawnTimer += dt;
    itemTimer += dt;

    const spawnInterval = Math.max(0.35, 1.2 - score / 5000);
    if (spawnTimer > spawnInterval) {
      spawnTimer = 0;
      spawnHazard();
    }

    if (itemTimer > 2.5) {
      itemTimer = 0;
      spawnItem();
    }

    // Hazards update
    const hazardSpeedMult = player.slowTimer > 0 ? 0.35 : 1;
    for (let i = hazards.length - 1; i >= 0; i--) {
      const h = hazards[i];
      h.y += h.vy * hazardSpeedMult;
      h.rot += h.vRot;

      // Collision check with player
      const dx = h.x - player.x;
      const dy = h.y - player.y;
      const dist = Math.hypot(dx, dy);

      if (dist < h.r + player.r - 4) {
        if (player.hasShield) {
          player.hasShield = false;
          playSound("shield");
          addExplosion(h.x, h.y, "#00f0ff", 16);
          hazards.splice(i, 1);
        } else {
          // Game Over
          playSound("hit");
          addExplosion(player.x, player.y, "#ff3366", 30);
          gameOver();
          return;
        }
      } else if (h.y > H + 50) {
        hazards.splice(i, 1);
      }
    }

    // Items update
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy;

      const dx = it.x - player.x;
      const dy = it.y - player.y;
      const dist = Math.hypot(dx, dy);

      if (dist < it.r + player.r) {
        if (it.type === "star") {
          score += 500;
          playSound("star");
          addExplosion(it.x, it.y, "#ffd166", 10);
        } else if (it.type === "shield") {
          player.hasShield = true;
          playSound("shield");
          addExplosion(it.x, it.y, "#00f0ff", 14);
        } else if (it.type === "slow") {
          player.slowTimer = 5;
          playSound("star");
          addExplosion(it.x, it.y, "#b5179e", 14);
        }
        items.splice(i, 1);
      } else if (it.y > H + 40) {
        items.splice(i, 1);
      }
    }

    // Particles update
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Render Starfield
    ctx.fillStyle = "#ffffff";
    stars.forEach((s) => {
      ctx.globalAlpha = s.alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Render Hazards
    hazards.forEach((h) => {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);

      if (h.type === "mine") {
        ctx.fillStyle = "#ff0055";
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, h.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, h.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Meteor
        ctx.fillStyle = "#e07a5f";
        ctx.shadowColor = "#f4a261";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        const sides = 6;
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2;
          const rad = h.r * (0.8 + (i % 2 === 0 ? 0.25 : 0.05));
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });

    // Render Items
    items.forEach((it) => {
      ctx.save();
      ctx.translate(it.x, it.y);

      if (it.type === "star") {
        ctx.fillStyle = "#ffd166";
        ctx.shadowColor = "#ffd166";
        ctx.shadowBlur = 14;
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⭐", 0, 0);
      } else if (it.type === "shield") {
        ctx.fillStyle = "#00f0ff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 14;
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🛡️", 0, 0);
      } else if (it.type === "slow") {
        ctx.fillStyle = "#b5179e";
        ctx.shadowColor = "#b5179e";
        ctx.shadowBlur = 14;
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⏳", 0, 0);
      }
      ctx.restore();
    });

    // Render Particles
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Render Player
    if (state === "playing" || state === "title") {
      ctx.save();
      ctx.translate(player.x, player.y);

      // Shield Aura
      if (player.hasShield) {
        ctx.strokeStyle = "#00f0ff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 16;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, player.r + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Slow Aura
      if (player.slowTimer > 0) {
        ctx.strokeStyle = "#b5179e";
        ctx.shadowColor = "#b5179e";
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, player.r + 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Rocket Icon / Body
      ctx.shadowColor = "#00b4d8";
      ctx.shadowBlur = 12;
      ctx.font = "36px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🚀", 0, -2);
      ctx.restore();
    }
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (!window.TodayPause || !window.TodayPause.isPaused()) {
      update(dt);
    }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function startGame() {
    getAudioCtx();
    resetGame();
    state = "playing";
    titleOverlay.classList.add("hidden");
    overOverlay.classList.add("hidden");
  }

  function gameOver() {
    state = "over";
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(`best_${GAME_ID}`, bestScore);
      hudBest.textContent = bestScore.toLocaleString("ko-KR");
    }

    overDetail.textContent = `최종 점수: ${score.toLocaleString("ko-KR")}점`;
    overOverlay.classList.remove("hidden");

    if (window.TodayGameRank) {
      window.TodayGameRank.mount({
        gameId: GAME_ID,
        gameTitle: GAME_TITLE,
        formParent: rankContainer,
      });
      window.TodayGameRank.open(score, { label: `${score.toLocaleString("ko-KR")}점` });
    }
  }

  startBtn.addEventListener("click", startGame);
  retryBtn.addEventListener("click", startGame);

  // Initialize Pause system
  if (window.TodayPause) {
    window.TodayPause.init({
      gameTitle: GAME_TITLE,
      onPause() {},
      onResume() {},
    });
  }
})();
