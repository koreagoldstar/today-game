(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const COLS = 3;
  const ROWS = 4;
  const GRID_TOP = 130;
  const GRID_H = 480;
  const CELL_W = W / COLS;
  const CELL_H = GRID_H / ROWS;
  const HOLE_R = 46;
  const TOTAL_STAGES = 50;

  const STAGE_NAMES = [
    "초원 입문", "작은 구멍", "빠른 손", "두더지 농장", "폭탄 주의",
    "황금 발견", "콤보 연습", "숲속 대결", "연속 타격", "두더지 폭풍",
    "전문가 코스", "번개 반사", "황금 사냥", "폭탄 회피", "마스터 예고",
    "숙련자 시험", "전설의 구멍", "두더지 레이스", "왕관 도전", "두더지왕",
  ];

  const STAGES = Array.from({ length: TOTAL_STAGES }, (_, i) => ({
    name: STAGE_NAMES[i] || `스테이지 ${i + 1}`,
    goal: 10 + i * 2,
    // how long fully visible
    stay: Math.max(0.35, 0.95 - i * 0.028),
    rise: 0.18,
    fall: 0.16,
    spawnRate: Math.max(0.38, 0.85 - i * 0.022),
    bombRate: Math.min(0.2, 0.04 + i * 0.008),
    goldRate: Math.min(0.14, 0.03 + i * 0.004),
    maxActive: Math.min(4, 1 + Math.floor(i / 3)),
    lives: i < 8 ? 3 : i < 15 ? 4 : 5,
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
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  const sprites = { mole: null, mallet: null };
  let pointer = { x: W / 2, y: H / 2, down: false, swing: 0 };

  function isPunchBg(r, g, b, a) {
    if (a < 20) return true;
    if (r > 185 && b > 175 && g < 150 && r + b > g * 2.1) return true;
    if (r > 200 && b > 190 && g < 165 && Math.abs(r - b) < 90) return true;
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
    let minX = c.width;
    let minY = c.height;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (isPunchBg(d[i], d[i + 1], d[i + 2], d[i + 3])) {
        d[i + 3] = 0;
        continue;
      }
      const px = (i / 4) % c.width;
      const py = ((i / 4) / c.width) | 0;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    x.putImageData(data, 0, 0);
    if (maxX <= minX || maxY <= minY) return c;
    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(c.width - 1, maxX + pad);
    maxY = Math.min(c.height - 1, maxY + pad);
    const out = document.createElement("canvas");
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext("2d").drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
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
    const [mole, mallet] = await Promise.all([
      loadImg("assets/mole.png"),
      loadImg("assets/mallet.png"),
    ]);
    if (mole) sprites.mole = punchBg(mole);
    if (mallet) sprites.mallet = punchBg(mallet);
  }

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  let holes = [];
  let state = "title";
  let stageIndex = 0;
  let score = 0;
  let stageScore = 0;
  let lives = 3;
  let combo = 0;
  let comboTimer = 0;
  let spawnAcc = 0;
  let particles = [];
  let floats = [];
  let flash = 0;
  let shake = 0;
  let last = 0;
  let raf = 0;

  function show(el, on) {
    el.classList.toggle("hidden", !on);
  }

  function hideAll() {
    Object.values(overlays).forEach((o) => show(o, false));
  }

  function makeHoles() {
    holes = [];
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        holes.push({
          x: c * CELL_W + CELL_W / 2,
          y: GRID_TOP + r * CELL_H + CELL_H / 2 + 8,
          mole: null,
        });
      }
    }
  }

  function updateHud() {
    const st = STAGES[stageIndex];
    document.getElementById("hud-stage").textContent = String(stageIndex + 1);
    document.getElementById("hud-score").textContent = String(score);
    document.getElementById("hud-goal").textContent = String(st.goal);
    document.getElementById("goal-fill").style.width = `${Math.min(100, (stageScore / st.goal) * 100)}%`;
    const livesEl = document.getElementById("hud-lives");
    livesEl.innerHTML = "";
    for (let i = 0; i < st.lives; i += 1) {
      const d = document.createElement("span");
      d.className = "life" + (i >= lives ? " empty" : "");
      livesEl.appendChild(d);
    }
    const comboBar = document.getElementById("combo-bar");
    if (combo >= 2) {
      comboBar.classList.remove("hidden");
      document.getElementById("hud-combo").textContent = String(combo);
    } else {
      comboBar.classList.add("hidden");
    }
  }

  function resetStage() {
    stageStartedAt = performance.now();
    const st = STAGES[stageIndex];
    stageScore = 0;
    lives = st.lives;
    combo = 0;
    comboTimer = 0;
    spawnAcc = 0.2;
    particles = [];
    floats = [];
    flash = 0;
    shake = 0;
    holes.forEach((h) => {
      h.mole = null;
    });
    updateHud();
  }

  function activeCount() {
    return holes.filter((h) => h.mole && h.mole.phase !== "gone").length;
  }

  function moleVisible(m) {
    return m && !m.hit && (m.phase === "rise" || m.phase === "stay" || m.phase === "fall");
  }

  function spawnMole() {
    const st = STAGES[stageIndex];
    if (activeCount() >= st.maxActive) return;
    const free = holes.filter((h) => !h.mole);
    if (!free.length) return;
    const hole = free[Math.floor(Math.random() * free.length)];
    const roll = Math.random();
    let type = "normal";
    if (roll < st.bombRate) type = "bomb";
    else if (roll < st.bombRate + st.goldRate) type = "gold";
    hole.mole = {
      type,
      phase: "rise",
      t: 0,
      rise: st.rise,
      stay: st.stay,
      fall: st.fall,
      hit: false,
      hitT: 0,
    };
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.9 });
  }

  function addBurst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * (40 + Math.random() * 80),
        vy: Math.sin(ang) * (40 + Math.random() * 80) - 40,
        life: 0.35 + Math.random() * 0.25,
        color,
        size: 3 + Math.random() * 4,
      });
    }
  }

  let runStartedAt = 0;
  let stageStartedAt = 0;

  function checkClearOrOver() {
    const st = STAGES[stageIndex];
    if (stageScore >= st.goal && state === "play") {
      const elapsed = (performance.now() - stageStartedAt) / 1000;
      score += Math.max(0, Math.floor(20 - elapsed)) * 8;
      updateHud();
      state = stageIndex >= TOTAL_STAGES - 1 ? "allclear" : "clear";
      hideAll();
      if (state === "allclear") {
        show(overlays.all, true);
        document.getElementById("all-detail").textContent = `최종 점수 ${score}점 · ${TOTAL_STAGES}스테이지 완주!`;
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "whack-mole", gameTitle: "두더지 팡팡", formParent: overlays.all });
      TodayGameRank.open(score);
    }
      } else {
        show(overlays.clear, true);
        document.getElementById("clear-detail").textContent = `${st.name} · ${score}점`;
      }
      return;
    }
    if (lives <= 0 && state === "play") {
      state = "over";
      hideAll();
      show(overlays.over, true);
      document.getElementById("over-detail").textContent = `${st.name} · ${score}점`;
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "whack-mole", gameTitle: "두더지 팡팡", formParent: overlays.over });
      TodayGameRank.open(score);
    }
    }
  }

  function whack(hole) {
    const m = hole.mole;
    if (!m || m.hit) return;
    if (m.phase !== "rise" && m.phase !== "stay") return;
    // only hittable when mostly out
    const pop = popAmount(m);
    if (pop < 0.35) return;

    m.hit = true;
    m.hitT = 0;
    m.phase = "hit";
    const st = STAGES[stageIndex];

    if (m.type === "bomb") {
      lives -= 1;
      combo = 0;
      comboTimer = 0;
      flash = 0.28;
      shake = 10;
      addFloat(hole.x, hole.y - 36, "폭탄!", "#ff5555");
      addBurst(hole.x, hole.y - 20, "#ff6644", 12);
    } else {
      combo += 1;
      comboTimer = 1.8;
      const bonus = Math.min(30, (combo - 1) * 3);
      let pts = 10 + bonus;
      if (m.type === "gold") {
        pts = 50 + bonus * 2;
        addFloat(hole.x, hole.y - 40, `+${pts} ★`, "#ffd76a");
        addBurst(hole.x, hole.y - 20, "#ffd76a", 16);
      } else {
        addFloat(hole.x, hole.y - 34, `+${pts}`, "#ffffff");
        addBurst(hole.x, hole.y - 20, "#8ec06a", 10);
      }
      score += pts;
      stageScore += 1; // goal = number of hits
    }
    updateHud();
    checkClearOrOver();
  }

  function popAmount(m) {
    if (!m) return 0;
    if (m.phase === "rise") return Math.min(1, m.t / m.rise);
    if (m.phase === "stay" || m.phase === "hit") return 1;
    if (m.phase === "fall") return Math.max(0, 1 - m.t / m.fall);
    return 0;
  }

  function drawBackground() {
    // sunny garden like thumb: blue sky, hills, fence, flowers
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#7ec8ff");
    sky.addColorStop(0.35, "#b8e8ff");
    sky.addColorStop(0.55, "#9fd878");
    sky.addColorStop(1, "#5a9a40");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(70, 70, 40, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(105, 70, 28, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(300, 58, 48, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // hills
    ctx.fillStyle = "#6bb85a";
    ctx.beginPath();
    ctx.moveTo(0, 160);
    ctx.quadraticCurveTo(120, 110, 220, 150);
    ctx.quadraticCurveTo(300, 120, 390, 145);
    ctx.lineTo(390, 220);
    ctx.lineTo(0, 220);
    ctx.fill();

    // white picket fence
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 8; i += 1) {
      const fx = 8 + i * 22;
      ctx.fillRect(fx, 148, 8, 36);
      ctx.beginPath();
      ctx.moveTo(fx, 148);
      ctx.lineTo(fx + 4, 140);
      ctx.lineTo(fx + 8, 148);
      ctx.fill();
    }
    ctx.fillRect(6, 158, 170, 5);
    ctx.fillRect(6, 172, 170, 5);

    // rounded trees
    [[320, 150, 28], [360, 155, 22], [50, 155, 18]].forEach(([tx, ty, r]) => {
      ctx.fillStyle = "#4a8a38";
      ctx.beginPath();
      ctx.arc(tx, ty, r, 0, Math.PI * 2);
      ctx.arc(tx - r * 0.5, ty + 4, r * 0.7, 0, Math.PI * 2);
      ctx.arc(tx + r * 0.5, ty + 4, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a4a28";
      ctx.fillRect(tx - 3, ty + r * 0.4, 6, 18);
    });

    // flower dots
    for (let i = 0; i < 18; i += 1) {
      const fx = 20 + ((i * 97) % (W - 40));
      const fy = 200 + ((i * 53) % 80);
      ctx.fillStyle = i % 3 === 0 ? "#fff" : i % 3 === 1 ? "#ff9ad0" : "#c090ff";
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.arc(fx, fy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = '20px "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.shadowColor = "rgba(40,80,30,0.35)";
    ctx.shadowBlur = 4;
    ctx.fillText(STAGES[stageIndex].name, W / 2, 108);
    ctx.shadowBlur = 0;
  }

  function drawHole(hole) {
    ctx.save();
    ctx.translate(hole.x, hole.y);

    // dirt mound like thumb
    const dirt = ctx.createRadialGradient(0, 6, 4, 0, 8, HOLE_R + 10);
    dirt.addColorStop(0, "#8a5a30");
    dirt.addColorStop(0.55, "#5a3818");
    dirt.addColorStop(1, "#3d2810");
    ctx.fillStyle = dirt;
    ctx.beginPath();
    ctx.ellipse(0, 10, HOLE_R + 10, HOLE_R * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1a1008";
    ctx.beginPath();
    ctx.ellipse(0, 4, HOLE_R * 0.88, HOLE_R * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    if (hole.mole) drawMole(hole.mole);

    ctx.fillStyle = "#4a3018";
    ctx.beginPath();
    ctx.ellipse(0, 14, HOLE_R * 0.95, HOLE_R * 0.28, 0, 0, Math.PI);
    ctx.fill();

    ctx.restore();
  }

  function drawCuteMoleProcedural(type) {
    // charcoal gray mole matching thumb
    const body = type === "gold" ? "#d4a84a" : type === "bomb" ? "#3a3038" : "#4a4a52";
    const belly = type === "gold" ? "#ffe08a" : "#6a6a72";
    const g = ctx.createRadialGradient(-8, -10, 4, 0, 2, 32);
    g.addColorStop(0, type === "gold" ? "#ffe8a0" : "#6a6a72");
    g.addColorStop(1, body);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 2, 30, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    // hair tuft
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-4, -28);
    ctx.quadraticCurveTo(0, -40, 6, -28);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#1a1818";
    ctx.beginPath();
    ctx.ellipse(-9, -6, 7, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(9, -6, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-11, -9, 2.2, 0, Math.PI * 2);
    ctx.arc(7, -9, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // cheeks + nose
    ctx.fillStyle = "#ff8a90";
    ctx.beginPath();
    ctx.ellipse(-16, 4, 6, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(16, 4, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff7a88";
    ctx.beginPath();
    ctx.ellipse(0, 2, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // teeth smile
    ctx.fillStyle = "#2a1810";
    ctx.beginPath();
    ctx.arc(0, 10, 10, 0.15, Math.PI - 0.15);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-5, 8, 4, 5);
    ctx.fillRect(1, 8, 4, 5);
    // paws
    ctx.fillStyle = "#e8c8b0";
    ctx.beginPath();
    ctx.ellipse(-18, 24, 10, 6, -0.2, 0, Math.PI * 2);
    ctx.ellipse(18, 24, 10, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMole(mole) {
    const pop = popAmount(mole);
    if (pop <= 0.02 && mole.phase !== "hit") return;

    const y = 22 - pop * 48;
    const scale = 0.55 + pop * 0.5;
    const squash = mole.hit ? 0.85 : 1;

    ctx.save();
    ctx.translate(0, y);
    ctx.scale(scale * squash, scale / squash);

    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 36, 0, 0, Math.PI * 2);
    ctx.clip();

    if (sprites.mole && mole.type !== "bomb") {
      const size = 78;
      ctx.drawImage(sprites.mole, -size / 2, -size / 2 - 4, size, size);
      if (mole.type === "gold") {
        ctx.fillStyle = "rgba(255, 220, 80, 0.35)";
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '16px "Jua", sans-serif';
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff8d0";
        ctx.fillText("★", 0, -28);
      }
    } else {
      drawCuteMoleProcedural(mole.type);
    }

    if (mole.type === "bomb") {
      ctx.fillStyle = "#2a2430";
      ctx.beginPath();
      ctx.arc(0, -6, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c9a06a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.quadraticCurveTo(8, -28, 12, -26);
      ctx.stroke();
      ctx.fillStyle = "#ffaa44";
      ctx.beginPath();
      ctx.arc(13, -27, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (mole.hit) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawMallet() {
    if (state !== "play" || !sprites.mallet) return;
    const swing = pointer.swing;
    const ang = -0.55 + swing * 1.1;
    const size = 88;
    ctx.save();
    ctx.translate(pointer.x + 10, pointer.y - 8);
    ctx.rotate(ang);
    ctx.drawImage(sprites.mallet, -size * 0.25, -size * 0.85, size, size);
    ctx.restore();
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 140 * dt;
      if (p.life <= 0) return false;
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });
  }

  function drawFloats(dt) {
    floats = floats.filter((f) => {
      f.life -= dt;
      f.y -= 42 * dt;
      if (f.life <= 0) return false;
      ctx.globalAlpha = Math.min(1, f.life * 1.4);
      ctx.font = '18px "Jua", sans-serif';
      ctx.textAlign = "center";
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
      return true;
    });
  }

  function render() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.85;
      if (shake < 0.3) shake = 0;
    }
    drawBackground();
    holes.forEach(drawHole);
    drawMallet();
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,80,60,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function tick(dt) {
    if (pointer.swing > 0) pointer.swing = Math.max(0, pointer.swing - dt * 4);
    if (state !== "play") return;
    const st = STAGES[stageIndex];

    spawnAcc += dt;
    if (spawnAcc >= st.spawnRate) {
      spawnAcc = 0;
      spawnMole();
      // early stages sometimes double spawn feel
      if (st.maxActive > 1 && Math.random() < 0.25) spawnMole();
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    holes.forEach((h) => {
      const m = h.mole;
      if (!m) return;

      if (m.hit || m.phase === "hit") {
        m.hitT += dt;
        if (m.hitT >= 0.22) h.mole = null;
        return;
      }

      m.t += dt;
      if (m.phase === "rise") {
        if (m.t >= m.rise) {
          m.phase = "stay";
          m.t = 0;
        }
      } else if (m.phase === "stay") {
        if (m.t >= m.stay) {
          m.phase = "fall";
          m.t = 0;
        }
      } else if (m.phase === "fall") {
        if (m.t >= m.fall) {
          // missed (non-bomb)
          if (m.type !== "bomb") {
            lives -= 1;
            combo = 0;
            comboTimer = 0;
            addFloat(h.x, h.y - 24, "놓침!", "#ffaaaa");
          }
          h.mole = null;
          updateHud();
          checkClearOrOver();
        }
      }
    });

    if (flash > 0) flash = Math.max(0, flash - dt);
    updateHud();
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    tick(dt);
    render();
    drawParticles(dt);
    drawFloats(dt);
    raf = requestAnimationFrame(loop);
  }

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.changedTouches ? e.changedTouches[0] : e;
    return {
      x: ((src.clientX - rect.left) / rect.width) * W,
      y: ((src.clientY - rect.top) / rect.height) * H,
    };
  }

  function onTap(e) {
    if (state !== "play") return;
    e.preventDefault();
    const p = canvasPos(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.swing = 1;
    let best = null;
    let bestD = Infinity;
    holes.forEach((h) => {
      if (!moleVisible(h.mole)) return;
      const d = Math.hypot(p.x - h.x, p.y - (h.y - 18));
      if (d < HOLE_R + 18 && d < bestD) {
        bestD = d;
        best = h;
      }
    });
    if (best) whack(best);
  }

  canvas.addEventListener("pointermove", (e) => {
    if (state !== "play") return;
    const p = canvasPos(e);
    pointer.x = p.x;
    pointer.y = p.y;
  });

  function startGame() {
    stageIndex = 0;
    score = 0;
    runStartedAt = performance.now();
    if (window.TodayGameRank) TodayGameRank.reset();
    state = "play";
    hideAll();
    makeHoles();
    resetStage();
    last = performance.now();
    spawnMole();
  }

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", () => {
    stageIndex += 1;
    state = "play";
    hideAll();
    resetStage();
    last = performance.now();
    spawnMole();
  });

  canvas.addEventListener("pointerdown", onTap);
  makeHoles();
  updateHud();
  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "whack-mole",
      gameTitle: "두더지 팡팡",
      formParent: overlays.over || overlays.all || document.body,
    });
  }

  loadAssets().then(() => {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  });
})();
