(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const BEST_KEY = "today-odd-even-best";
  const TOTAL_STAGES = 50;
  const CORAL = "#ff1a5c";
  const CYAN = "#00d4ff";
  const GOLD = "#ffd60a";

  const BASE_NAMES = [
    "네온 입문", "볼 스핀", "홀짝 레슨", "하이 볼트", "연속 도전",
    "플래시 링", "넘버 러시", "고수 코스", "마스터 코어", "아케이드 나이트",
    "도파민 질주", "홀짝 레전드",
  ];

  const STAGES = Array.from({ length: TOTAL_STAGES }, (_, i) => ({
    name: BASE_NAMES[i] || `스테이지 ${i + 1}`,
    goal: 3 + Math.floor(i * 1.15),
    lives: i < 4 ? 3 : i < 8 ? 2 : 1,
    coinBonus: 10 + i * 5,
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
  ctx.imageSmoothingQuality = "high";

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

  const sprites = { red: null, blue: null, bg: null };

  function isPunchBg(r, g, b, a) {
    if (a < 28) return true;
    // solid magenta chroma #FF00FF
    if (r > 200 && b > 200 && g < 120 && Math.abs(r - b) < 80) return true;
    if (r > 185 && b > 175 && g < 145 && r + b > g * 2.1) return true;
    if (r > 210 && b > 200 && g < 160 && Math.abs(r - b) < 90) return true;
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
    const [red, blue, bg] = await Promise.all([
      loadImg("assets/ball-red.png"),
      loadImg("assets/ball-blue.png"),
      loadImg("assets/bg.png"),
    ]);
    if (red) sprites.red = punchBg(red);
    if (blue) sprites.blue = punchBg(blue);
    if (bg) sprites.bg = bg;
  }

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
  let stageStreak = 0;
  let coins = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  let lives = 3;
  let guess = null;
  let secret = 0;
  let rollT = 0;
  let result = null;
  let resultT = 0;
  let bounce = 0;
  let shake = 0;
  let particles = [];
  let floats = [];
  let displayNum = 0;
  let message = "홀? 짝?";
  let last = 0;
  let ballSpin = 0;
  let shards = Array.from({ length: 14 }, () => ({
    x: Math.random() * W,
    y: 120 + Math.random() * 340,
    s: 3 + Math.random() * 7,
    a: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.4,
    hue: Math.random() < 0.5 ? 0 : 190,
    drift: 8 + Math.random() * 18,
  }));

  function show(el, on) {
    el.classList.toggle("hidden", !on);
  }

  function hideAll() {
    Object.values(overlays).forEach((o) => show(o, false));
  }

  function setPicks(on) {
    pickBar.classList.toggle("on", on);
  }

  function updateHud() {
    const st = STAGES[stageIndex];
    document.getElementById("hud-stage").textContent = String(stageIndex + 1);
    document.getElementById("hud-streak").textContent = String(streak);
    document.getElementById("hud-coins").textContent = String(coins);
    document.getElementById("hud-best").textContent = String(best);
    document.getElementById("hud-goal").textContent = String(st.goal);
    document.getElementById("goal-fill").style.width =
      `${Math.min(100, (stageStreak / st.goal) * 100)}%`;
  }

  function saveBest() {
    if (streak > best) {
      best = streak;
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  function burst(x, y, colors, n = 30) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 260;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 90,
        life: 0.65 + Math.random() * 0.65,
        size: 2.5 + Math.random() * 4.5,
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 12,
        shape: Math.random() < 0.45 ? "shard" : Math.random() < 0.5 ? "star" : "rect",
      });
    }
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 1.15 });
  }

  function drawStar(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const b = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(b) * r * 0.4, y + Math.sin(b) * r * 0.4);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawShard(size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.55, size * 0.2);
    ctx.lineTo(0, size * 0.75);
    ctx.lineTo(-size * 0.45, size * 0.15);
    ctx.closePath();
    ctx.fill();
  }

  function drawBallSprite(x, y, radius, color, num, spin) {
    const spr = color === CORAL ? sprites.red : sprites.blue;
    ctx.save();
    ctx.translate(x, y);

    ctx.shadowColor = color;
    ctx.shadowBlur = 36;
    const glow = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius * 1.7);
    glow.addColorStop(0, color);
    glow.addColorStop(0.45, color);
    glow.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 24;

    if (spr) {
      const size = radius * 2.35;
      ctx.save();
      ctx.rotate(spin * 0.08);
      ctx.drawImage(spr, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      // procedural fallback matching thumb look
      const g = ctx.createRadialGradient(-radius * 0.3, -radius * 0.35, radius * 0.1, 0, 0, radius);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, color);
      g.addColorStop(0.8, color);
      g.addColorStop(1, "#0a0a0c");
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = "rgba(20,22,28,0.92)";
      ctx.fillRect(-radius * 0.95, -radius * 0.14, radius * 1.9, radius * 0.28);
      ctx.strokeStyle = "rgba(180,190,210,0.55)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-radius * 0.95, -radius * 0.14, radius * 1.9, radius * 0.28);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = "#2a2e38";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    if (num != null) {
      ctx.fillStyle = "rgba(8,10,14,0.88)";
      ctx.beginPath();
      ctx.arc(0, radius * 0.52, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#e8f4ff";
      ctx.font = `700 ${Math.floor(radius * 0.38)}px "Bagel Fat One", "Jua", cursive`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillText(String(num), 0, radius * 0.54);
    }

    ctx.restore();
  }

  function drawPedestal(x, y, color) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    for (let i = 0; i < 3; i += 1) {
      ctx.strokeStyle = i % 2 === 0 ? color : "rgba(180,200,220,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + i * 8, 44 - i * 4, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(x, y + 28, 38, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShards(t) {
    for (const s of shards) {
      s.a += s.spin * 0.016;
      const y = s.y + Math.sin(t * 1.2 + s.x * 0.02) * 6;
      const x = s.x + Math.sin(t * 0.7 + s.y * 0.01) * 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.a);
      ctx.globalAlpha = 0.35 + Math.sin(t * 2 + s.x) * 0.12;
      const col = s.hue < 100
        ? `hsla(${340 + (s.hue % 20)}, 100%, 65%, 0.85)`
        : `hsla(${185 + (s.hue % 20)}, 100%, 65%, 0.85)`;
      drawShard(s.s, col);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawBackground(t) {
    if (sprites.bg) {
      ctx.drawImage(sprites.bg, 0, 0, W, H);
      // subtle dark vignette so UI stays readable
      const vig = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.45, H * 0.72);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(5,6,10,0.35)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#07080c");
      g.addColorStop(0.5, "#0c1018");
      g.addColorStop(1, "#0a0a0c");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // split neon rim (red left / cyan right) matching thumb frame
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = CORAL;
    ctx.strokeStyle = "rgba(255,26,92,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(20, 104, (W - 44) * 0.5, 358, 22);
    ctx.stroke();
    ctx.shadowColor = CYAN;
    ctx.strokeStyle = "rgba(0,212,255,0.45)";
    ctx.beginPath();
    ctx.roundRect(20 + (W - 44) * 0.5, 104, (W - 44) * 0.5, 358, 22);
    ctx.stroke();
    ctx.restore();

    // outer arena frame
    ctx.save();
    ctx.strokeStyle = "rgba(142,154,175,0.28)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(18, 102, W - 36, 362, 24);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,212,255,0.18)";
    ctx.beginPath();
    ctx.roundRect(28, 112, W - 56, 342, 18);
    ctx.stroke();
    ctx.restore();

    drawShards(t);

    // scanning beam
    const beamY = 120 + ((t * 40) % 320);
    ctx.fillStyle = "rgba(0,212,255,0.035)";
    ctx.fillRect(28, beamY, W - 56, 16);
  }

  function drawLives() {
    const max = STAGES[stageIndex].lives;
    for (let i = 0; i < max; i += 1) {
      const alive = i < lives;
      const hx = W / 2 - (max - 1) * 12 + i * 24;
      ctx.save();
      ctx.shadowColor = alive ? CORAL : "transparent";
      ctx.shadowBlur = alive ? 12 : 0;
      ctx.fillStyle = alive ? CORAL : "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(hx, 478, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawScene(dt) {
    bounce += dt;
    ballSpin += dt * (state === "roll" ? 16 : 1.4);

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

    ctx.fillStyle = "rgba(180,200,220,0.85)";
    ctx.font = '13px "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,212,255,0.35)";
    ctx.shadowBlur = 8;
    ctx.fillText(STAGES[stageIndex].name, W / 2, 138);
    ctx.shadowBlur = 0;

    drawPedestal(118, 372, CORAL);
    drawPedestal(272, 372, CYAN);

    const bob = Math.sin(bounce * 3.5) * 7;
    const bob2 = Math.sin(bounce * 3.5 + 1.1) * 7;

    let mainY = 275 + Math.sin(bounce * 2.4) * 4;
    let mainX = W / 2;
    let mainScale = 1;
    let showNum = null;
    let mainColor = CORAL;

    if (state === "roll") {
      const progress = Math.min(1, rollT / 1.4);
      mainX = W / 2 + Math.sin(rollT * 11) * 72 * (1 - progress * 0.25);
      mainY = 245 + Math.abs(Math.sin(rollT * 13)) * 42 * (1 - progress);
      displayNum = 1 + Math.floor((rollT * 20) % 9);
      showNum = displayNum;
      mainColor = displayNum % 2 === 1 ? CORAL : CYAN;
      mainScale = 1.08 + Math.sin(rollT * 22) * 0.07;
    } else if (state === "result" || (secret && state !== "play" && state !== "title")) {
      showNum = secret;
      mainColor = secret % 2 === 1 ? CORAL : CYAN;
      if (state === "result") {
        const pop = Math.min(1, resultT * 3.5);
        mainScale = 1 + Math.sin(pop * Math.PI) * 0.24;
      }
    } else if (state === "play") {
      showNum = "?";
      mainColor = Math.sin(bounce * 2.2) > 0 ? CORAL : CYAN;
    }

    drawBallSprite(118, 318 + bob, 36, CORAL, null, ballSpin * 0.35);
    drawBallSprite(272, 318 + bob2, 36, CYAN, null, -ballSpin * 0.35);

    const numLabel = showNum === "?" ? null : showNum;
    drawBallSprite(mainX, mainY, 60 * mainScale, mainColor, numLabel, ballSpin);

    if (showNum === "?") {
      ctx.fillStyle = "rgba(8,10,14,0.88)";
      ctx.beginPath();
      ctx.arc(mainX, mainY + 34, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#e8f4ff";
      ctx.font = '700 20px "Bagel Fat One", "Jua", cursive';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", mainX, mainY + 35);
    }

    // message plaque — metallic dark panel
    ctx.save();
    ctx.shadowColor = "rgba(0,212,255,0.25)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(8,10,14,0.9)";
    ctx.beginPath();
    ctx.roundRect(42, 418, W - 84, 44, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(142,154,175,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // split accent line
    const mid = W / 2;
    ctx.strokeStyle = "rgba(255,26,92,0.55)";
    ctx.beginPath();
    ctx.moveTo(54, 460);
    ctx.lineTo(mid - 4, 460);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,212,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(mid + 4, 460);
    ctx.lineTo(W - 54, 460);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#e8f4ff";
    ctx.font = '16px "Jua", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(message, W / 2, 445);

    drawLives();
    ctx.restore();
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 310 * dt;
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
      else if (p.shape === "shard") drawShard(p.size * 1.4, p.color);
      else ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
      ctx.restore();
      return true;
    });
  }

  function drawFloats(dt) {
    floats = floats.filter((f) => {
      f.life -= dt;
      f.y -= 52 * dt;
      if (f.life <= 0) return false;
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.font = '700 24px "Bagel Fat One", "Jua", cursive';
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

  function beginRoll(g) {
    guess = g;
    secret = 1 + Math.floor(Math.random() * 9);
    state = "roll";
    rollT = 0;
    message = "SPINNING…";
    setPicks(false);
  }

  function finishRoll() {
    state = "result";
    resultT = 0;
    const isOdd = secret % 2 === 1;
    const correct = (guess === "odd" && isOdd) || (guess === "even" && !isOdd);
    const label = isOdd ? "홀" : "짝";

    if (correct) {
      result = "win";
      streak += 1;
      stageStreak += 1;
      const gain = 5 + stageIndex * 2 + streak;
      coins += gain;
      saveBest();
      message = `${secret} → ${label}! +${gain}🪙`;
      addFloat(W / 2, 235, "HIT!", CYAN);
      burst(W / 2, 275, [CORAL, CYAN, GOLD, "#fff"], 44);
    } else {
      result = "lose";
      streak = 0;
      lives -= 1;
      message = `${secret} → ${label}… MISS`;
      addFloat(W / 2, 235, "MISS", CORAL);
      shake = 12;
      burst(W / 2, 275, [CORAL, "#888"], 16);
    }
    updateHud();
  }

  function afterResult() {
    const st = STAGES[stageIndex];
    if (lives <= 0) {
      state = "over";
      setPicks(false);
      document.getElementById("over-detail").textContent =
        `연속 ${stageStreak} · 코인 ${coins} · 최고 ${best}`;
      show(overlays.over, true);
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "odd-even", gameTitle: "홀짝 팡", formParent: overlays.over });
      TodayGameRank.open(Math.max(1, coins));
    }
      return;
    }
    if (stageStreak >= st.goal) {
      coins += st.coinBonus;
      updateHud();
      if (stageIndex >= TOTAL_STAGES - 1) {
        state = "allclear";
        setPicks(false);
        document.getElementById("all-detail").textContent =
          `최고 연속 ${best} · 코인 ${coins}개!`;
        show(overlays.all, true);
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "odd-even", gameTitle: "홀짝 팡", formParent: overlays.all });
      TodayGameRank.open(Math.max(1, coins));
    }
        burst(W / 2, 300, [CORAL, CYAN, GOLD, "#fff"], 55);
        return;
      }
      state = "clear";
      setPicks(false);
      document.getElementById("clear-detail").textContent =
        `${st.name} 클리어! 보너스 +${st.coinBonus}🪙`;
      show(overlays.clear, true);
      burst(W / 2, 300, [CORAL, CYAN, GOLD], 38);
      return;
    }
    guess = null;
    secret = 0;
    result = null;
    state = "play";
    message = "홀? 짝?";
    setPicks(true);
  }

  function tick(dt) {
    if (state === "roll") {
      rollT += dt;
      if (rollT >= 1.45) finishRoll();
    } else if (state === "result") {
      resultT += dt;
      if (resultT >= 1.4) afterResult();
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
    stageStreak = 0;
    lives = st.lives;
    guess = null;
    secret = 0;
    result = null;
    message = "홀? 짝?";
    updateHud();
  }

  function startGame() {
    stageIndex = 0;
    streak = 0;
    coins = 0;
    if (window.TodayGameRank) TodayGameRank.reset();
    state = "play";
    hideAll();
    resetStage();
    setPicks(true);
  }

  pickBar.querySelectorAll(".pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state !== "play") return;
      beginRoll(btn.dataset.guess);
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

  updateHud();
  setPicks(false);
  last = performance.now();
  loadAssets();
  requestAnimationFrame(loop);

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "odd-even",
      gameTitle: "홀짝 팡",
      formParent: overlays.over || overlays.all || document.body,
    });
  }
})();
