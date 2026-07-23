(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const GAME_ID = "chick-shield";
  const GAME_TITLE = "막아요 쏴요";
  const BEST_KEY = "today-chick-shield-best";
  const NAME_KEY = "today-chick-shield-name";

  const ENEMY_KINDS = ["pink", "star", "candy"];
  const ITEM_KINDS = ["heart", "shield", "triple", "rapid"];

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

  const overlays = {
    title: document.getElementById("title"),
    over: document.getElementById("over"),
  };
  const hintEl = document.getElementById("hint");
  const nameInput = document.getElementById("player-name");
  nameInput.value = localStorage.getItem(NAME_KEY) || "";

  let best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;
  document.getElementById("hud-best").textContent = String(best);

  const imgs = {};
  let assetsReady = false;

  let state = "title";
  let score = 0;
  let lives = 3;
  let wave = 1;
  let playTime = 0;
  let last = 0;
  let raf = 0;
  let submitted = false;
  let lastRank = { rankDay: null, rankWeek: null };
  let shield = false;
  let fireAcc = 0;
  let spawnAcc = 0;
  let invuln = 0;
  let shake = 0;
  let flash = 0;
  let keys = Object.create(null);
  let pointerId = null;
  let dragX = null;
  let holding = false;

  let buffRapid = 0;
  let buffTriple = 0;
  let buffBubble = 0;

  const player = { x: W / 2, y: H - 118, r: 26 };

  let enemies = [];
  let bullets = [];
  let items = [];
  let particles = [];
  let floats = [];
  let sparkles = [];
  let clouds = [];

  function isBg(r, g, b, a) {
    if (a < 12) return true;
    // magenta / pink key
    if (r > 185 && b > 175 && g < 150 && r + b > g * 2.05) return true;
    // pure / near black leftover mats
    if (r < 18 && g < 18 && b < 18) return true;
    // washed pastel plate (very light, low saturation)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max > 228 && max - min < 28) return true;
    return false;
  }

  function punchBg(img) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    let minX = c.width;
    let minY = c.height;
    let maxX = 0;
    let maxY = 0;
    // flood from edges for leftover plate colors
    const w = c.width;
    const h = c.height;
    const seen = new Uint8Array(w * h);
    const stack = [];
    const push = (px, py) => {
      const i = py * w + px;
      if (seen[i]) return;
      seen[i] = 1;
      stack.push(i);
    };
    for (let px = 0; px < w; px += 1) {
      push(px, 0);
      push(px, h - 1);
    }
    for (let py = 0; py < h; py += 1) {
      push(0, py);
      push(w - 1, py);
    }
    while (stack.length) {
      const i = stack.pop();
      const o = i * 4;
      if (!isBg(d[o], d[o + 1], d[o + 2], d[o + 3])) continue;
      d[o + 3] = 0;
      const px = i % w;
      const py = (i / w) | 0;
      if (px > 0) push(px - 1, py);
      if (px < w - 1) push(px + 1, py);
      if (py > 0) push(px, py - 1);
      if (py < h - 1) push(px, py + 1);
    }
    for (let i = 0; i < d.length; i += 4) {
      if (isBg(d[i], d[i + 1], d[i + 2], d[i + 3])) d[i + 3] = 0;
      if (d[i + 3] < 12) continue;
      const px = (i / 4) % w;
      const py = ((i / 4) / w) | 0;
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
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const side = Math.max(bw, bh);
    out.width = side;
    out.height = side;
    const ox = ((side - bw) / 2) | 0;
    const oy = ((side - bh) / 2) | 0;
    out.getContext("2d").drawImage(c, minX, minY, bw, bh, ox, oy, bw, bh);
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
    const map = {
      chick: "assets/chick.png",
      pink: "assets/enemy-pink.png",
      star: "assets/enemy-star.png",
      candy: "assets/enemy-candy.png",
      missile: "assets/missile.png",
      enemyShot: "assets/enemy-shot.png",
      heart: "assets/item-heart.png",
      shieldItem: "assets/item-shield.png",
      triple: "assets/item-triple.png",
      rapid: "assets/item-rapid.png",
    };
    await Promise.all(
      Object.entries(map).map(async ([k, src]) => {
        const raw = await loadImg(src);
        imgs[k] = raw ? punchBg(raw) : null;
      })
    );
    assetsReady = Object.values(imgs).some(Boolean);
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (name && overlays[name]) overlays[name].classList.remove("hidden");
  }

  function updateHud() {
    document.getElementById("hud-wave").textContent = String(wave);
    document.getElementById("hud-score").textContent = String(Math.floor(score));
    document.getElementById("hud-best").textContent = String(best);
    const livesEl = document.getElementById("hud-lives");
    livesEl.innerHTML = "";
    for (let i = 0; i < 3; i += 1) {
      const d = document.createElement("div");
      d.className = "life" + (i < lives ? "" : " empty");
      livesEl.appendChild(d);
    }
    document.getElementById("buff-rapid").classList.toggle("on", buffRapid > 0);
    document.getElementById("buff-triple").classList.toggle("on", buffTriple > 0);
    document.getElementById("buff-bubble").classList.toggle("on", buffBubble > 0);
  }

  function saveBest() {
    if (score > best) {
      best = Math.floor(score);
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  function difficulty() {
    const t = Math.min(1, playTime / 160);
    return {
      spawn: Math.max(0.5, 1.5 - t * 0.9),
      enemySpeed: 28 + t * 55,
      enemyHp: t > 0.55 ? 3 : t > 0.28 ? 2 : 1,
      shootGap: Math.max(0.85, 2.05 - t * 1.05),
      bulletSpeed: 145 + t * 125,
      fireRate: Math.max(0.14, 0.3 - t * 0.08),
      multi: t > 0.4 ? 2 : 1,
      drop: 0.28 + t * 0.12,
    };
  }

  function seedClouds() {
    clouds = [];
    for (let i = 0; i < 6; i += 1) {
      clouds.push({
        x: Math.random() * W,
        y: 30 + Math.random() * 240,
        s: 0.55 + Math.random() * 0.9,
        v: 6 + Math.random() * 16,
      });
    }
    for (let i = 0; i < 18; i += 1) {
      sparkles.push({
        x: Math.random() * W,
        y: Math.random() * (H - 80),
        r: 1 + Math.random() * 2,
        a: Math.random(),
        v: 0.4 + Math.random() * 0.8,
      });
    }
  }

  function resetRun() {
    score = 0;
    lives = 3;
    wave = 1;
    playTime = 0;
    shield = false;
    fireAcc = 0;
    spawnAcc = 0;
    invuln = 0;
    shake = 0;
    flash = 0;
    buffRapid = 0;
    buffTriple = 0;
    buffBubble = 0;
    enemies = [];
    bullets = [];
    items = [];
    particles = [];
    floats = [];
    player.x = W / 2;
    submitted = false;
    lastRank = { rankDay: null, rankWeek: null };
    document.getElementById("rank-msg").textContent = "";
    const shareBtn = document.getElementById("share-rank-btn");
    if (shareBtn) shareBtn.hidden = true;
    seedClouds();
    updateHud();
  }

  function startGame() {
    resetRun();
    state = "play";
    showOverlay(null);
    hintEl.classList.remove("dim");
    last = performance.now();
    if (window.TodayGameRank) TodayGameRank.reset();
  }

  function gameOver() {
    state = "over";
    saveBest();
    updateHud();
    document.getElementById("over-detail").textContent =
      `웨이브 ${wave} · ${Math.floor(score).toLocaleString("ko-KR")}점`;
    showOverlay("over");
  }

  function spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 140;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.4,
        t: 0,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function floatText(x, y, text, color) {
    floats.push({ x, y, text, t: 0, color });
  }

  function spawnEnemy() {
    const d = difficulty();
    const kind = ENEMY_KINDS[(Math.random() * ENEMY_KINDS.length) | 0];
    enemies.push({
      x: 40 + Math.random() * (W - 80),
      y: -36,
      vx: (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * d.enemySpeed),
      vy: 32 + Math.random() * 28,
      hp: d.enemyHp,
      maxHp: d.enemyHp,
      t: Math.random() * 10,
      shoot: 0.35 + Math.random() * 0.9,
      kind,
      bob: Math.random() * Math.PI * 2,
    });
  }

  function dropItem(x, y) {
    const kind = ITEM_KINDS[(Math.random() * ITEM_KINDS.length) | 0];
    items.push({
      x,
      y,
      vy: 55 + Math.random() * 30,
      kind,
      t: 0,
      spin: Math.random() * Math.PI * 2,
    });
  }

  function applyItem(kind) {
    if (kind === "heart") {
      if (lives < 3) {
        lives += 1;
        floatText(player.x, player.y - 40, "하트!", "#ff6b9d");
      } else {
        score += 150;
        floatText(player.x, player.y - 40, "+150", "#ff6b9d");
      }
    } else if (kind === "shield") {
      buffBubble = Math.max(buffBubble, 6);
      floatText(player.x, player.y - 40, "자동방패!", "#5ce1ff");
    } else if (kind === "triple") {
      buffTriple = Math.max(buffTriple, 8);
      floatText(player.x, player.y - 40, "삼연발!", "#ff8a4c");
    } else if (kind === "rapid") {
      buffRapid = Math.max(buffRapid, 8);
      floatText(player.x, player.y - 40, "연사!", "#ffd76a");
    }
    spawnBurst(player.x, player.y - 20, "#fff", 12);
    updateHud();
  }

  function firePlayer() {
    const mk = (ox, ang) => {
      bullets.push({
        x: player.x + ox,
        y: player.y - 30,
        vx: Math.sin(ang) * 40,
        vy: -460,
        friendly: true,
        trail: [],
        spin: 0,
      });
    };
    if (buffTriple > 0) {
      mk(-14, -0.18);
      mk(0, 0);
      mk(14, 0.18);
    } else {
      mk(0, 0);
    }
  }

  function hitPlayer() {
    if (invuln > 0) return;
    lives -= 1;
    invuln = 1.15;
    shake = 12;
    flash = 0.28;
    spawnBurst(player.x, player.y, "#ff6b9d", 18);
    updateHud();
    if (lives <= 0) gameOver();
  }

  function update(dt) {
    playTime += dt;
    wave = 1 + Math.floor(playTime / 18);
    const d = difficulty();

    if (buffRapid > 0) buffRapid = Math.max(0, buffRapid - dt);
    if (buffTriple > 0) buffTriple = Math.max(0, buffTriple - dt);
    if (buffBubble > 0) buffBubble = Math.max(0, buffBubble - dt);
    document.getElementById("buff-rapid").classList.toggle("on", buffRapid > 0);
    document.getElementById("buff-triple").classList.toggle("on", buffTriple > 0);
    document.getElementById("buff-bubble").classList.toggle("on", buffBubble > 0);

    let move = 0;
    if (keys.ArrowLeft || keys.a) move -= 1;
    if (keys.ArrowRight || keys.d) move += 1;
    if (dragX != null) {
      const dx = dragX - player.x;
      player.x += Math.max(-340 * dt, Math.min(340 * dt, dx * 14 * dt));
    } else {
      player.x += move * 270 * dt;
    }
    player.x = Math.max(30, Math.min(W - 30, player.x));

    const holdShield = holding || !!(keys[" "] || keys.Spacebar || keys.ShiftLeft || keys.ShiftRight);
    shield = holdShield || buffBubble > 0;
    if (holdShield) hintEl.classList.add("dim");

    const rate = buffRapid > 0 ? d.fireRate * 0.45 : d.fireRate;
    if (!holdShield) {
      fireAcc += dt;
      if (fireAcc >= rate) {
        fireAcc = 0;
        firePlayer();
      }
    } else {
      fireAcc = rate;
    }

    spawnAcc += dt;
    if (spawnAcc >= d.spawn) {
      spawnAcc = 0;
      for (let i = 0; i < d.multi; i += 1) spawnEnemy();
    }

    if (invuln > 0) invuln -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
    if (flash > 0) flash = Math.max(0, flash - dt);

    clouds.forEach((c) => {
      c.x += c.v * dt;
      if (c.x > W + 70) c.x = -70;
    });
    sparkles.forEach((s) => {
      s.a += s.v * dt;
      if (s.a > 1) s.a -= 1;
    });

    enemies.forEach((e) => {
      e.t += dt;
      e.bob += dt * 3;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < 30 || e.x > W - 30) e.vx *= -1;
      e.shoot -= dt;
      if (e.shoot <= 0 && e.y > 24 && e.y < H - 170) {
        e.shoot = d.shootGap * (0.75 + Math.random() * 0.5);
        bullets.push({
          x: e.x,
          y: e.y + 18,
          vx: (player.x - e.x) * 0.08,
          vy: d.bulletSpeed,
          friendly: false,
          trail: [],
          spin: 0,
        });
      }
    });
    enemies = enemies.filter((e) => e.y < H + 50 && e.hp > 0);

    items.forEach((it) => {
      it.t += dt;
      it.spin += dt * 2.5;
      it.y += it.vy * dt;
      it.x += Math.sin(it.t * 3) * 18 * dt;
    });
    items = items.filter((it) => it.y < H + 40);

    bullets.forEach((b) => {
      b.x += (b.vx || 0) * dt;
      b.y += b.vy * dt;
      b.spin += dt * 10;
      b.trail.push({ x: b.x, y: b.y, a: 1 });
      if (b.trail.length > 8) b.trail.shift();
      b.trail.forEach((t) => {
        t.a *= 0.86;
      });
    });

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      if (b.y < -50 || b.y > H + 50 || b.x < -40 || b.x > W + 40) {
        bullets.splice(i, 1);
        continue;
      }
      if (b.friendly) {
        for (let j = enemies.length - 1; j >= 0; j -= 1) {
          const e = enemies[j];
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          if (dx * dx + dy * dy < 32 * 32) {
            bullets.splice(i, 1);
            e.hp -= 1;
            spawnBurst(e.x, e.y, "#ffd76a", 8);
            if (e.hp <= 0) {
              const gain = 100 + wave * 10;
              score += gain;
              floatText(e.x, e.y, `+${gain}`, "#ff6b9d");
              spawnBurst(e.x, e.y, "#fff", 18);
              if (Math.random() < difficulty().drop) dropItem(e.x, e.y);
              enemies.splice(j, 1);
            }
            updateHud();
            break;
          }
        }
      } else {
        const dx = player.x - b.x;
        const dy = player.y - b.y;
        const shieldR = 52;
        const bodyR = player.r + 4;
        if (shield && dx * dx + dy * dy < shieldR * shieldR && b.y < player.y + 10) {
          bullets.splice(i, 1);
          score += 12;
          floatText(b.x, b.y - 8, "BLOCK", "#5ce1ff");
          spawnBurst(b.x, b.y, "#5ce1ff", 12);
          updateHud();
          continue;
        }
        if (invuln <= 0 && dx * dx + dy * dy < bodyR * bodyR) {
          bullets.splice(i, 1);
          hitPlayer();
        }
      }
    }

    for (let i = items.length - 1; i >= 0; i -= 1) {
      const it = items[i];
      const dx = it.x - player.x;
      const dy = it.y - player.y;
      if (dx * dx + dy * dy < 40 * 40) {
        applyItem(it.kind);
        items.splice(i, 1);
      }
    }

    if (invuln <= 0) {
      for (const e of enemies) {
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (dx * dx + dy * dy < 38 * 38) {
          if (shield && e.y < player.y + 4) {
            e.vy = -Math.abs(e.vy) - 50;
            e.y = player.y - 46;
            score += 8;
          } else {
            hitPlayer();
          }
          break;
        }
      }
    }

    particles.forEach((p) => {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
    });
    particles = particles.filter((p) => p.t < p.life);

    floats.forEach((f) => {
      f.t += dt;
      f.y -= 42 * dt;
    });
    floats = floats.filter((f) => f.t < 0.85);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#9fd8ff");
    g.addColorStop(0.45, "#c8e9ff");
    g.addColorStop(0.72, "#ffe0f0");
    g.addColorStop(1, "#ffcfe4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    sparkles.forEach((s) => {
      const a = 0.15 + Math.abs(Math.sin(s.a * Math.PI * 2)) * 0.55;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    clouds.forEach((c) => {
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      const s = 30 * c.s;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, s * 1.7, s * 0.72, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - s * 0.75, c.y + 4, s, s * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + s * 0.85, c.y + 2, s * 1.15, s * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    const ground = ctx.createLinearGradient(0, H - 70, 0, H);
    ground.addColorStop(0, "#b8ef9a");
    ground.addColorStop(1, "#8fd67f");
    ctx.fillStyle = ground;
    ctx.fillRect(0, H - 64, W, 64);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(0, H - 64, W, 8);

    // soft hills
    ctx.fillStyle = "#9fe08a";
    ctx.beginPath();
    ctx.moveTo(0, H - 40);
    ctx.quadraticCurveTo(80, H - 78, 160, H - 48);
    ctx.quadraticCurveTo(240, H - 20, 320, H - 58);
    ctx.quadraticCurveTo(360, H - 70, W, H - 44);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
  }

  function drawSprite(img, x, y, size, rot) {
    if (!img) return false;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }

  function drawShieldFX(x, y) {
    const pulse = 1 + Math.sin(performance.now() / 110) * 0.05;
    ctx.save();
    ctx.translate(x, y - 4);
    ctx.scale(pulse, pulse);
    const grd = ctx.createRadialGradient(0, 0, 6, 0, 0, 56);
    grd.addColorStop(0, "rgba(120, 240, 255, 0.55)");
    grd.addColorStop(0.55, "rgba(120, 240, 255, 0.18)");
    grd.addColorStop(1, "rgba(120, 240, 255, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 3.5;
    ctx.shadowColor = "#5ce1ff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 44, -Math.PI * 0.9, -Math.PI * 0.1);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawChickFallback(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#ffd84a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff3b0";
    ctx.beginPath();
    ctx.ellipse(0, 7, 13, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a3a55";
    ctx.beginPath();
    ctx.arc(-8, -4, 3.4, 0, Math.PI * 2);
    ctx.arc(8, -4, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff8a4c";
    ctx.beginPath();
    ctx.moveTo(-5, 2);
    ctx.lineTo(5, 2);
    ctx.lineTo(0, 9);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemyFallback(e) {
    ctx.save();
    ctx.translate(e.x, e.y + Math.sin(e.bob) * 3);
    ctx.fillStyle = e.kind === "star" ? "#7ddea0" : e.kind === "candy" ? "#c9a0ff" : "#ff8eb5";
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-6, -3, 4.2, 0, Math.PI * 2);
    ctx.arc(6, -3, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a3545";
    ctx.beginPath();
    ctx.arc(-6, -3, 2, 0, Math.PI * 2);
    ctx.arc(6, -3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawSky();

    items.forEach((it) => {
      const key =
        it.kind === "heart"
          ? "heart"
          : it.kind === "shield"
            ? "shieldItem"
            : it.kind === "triple"
              ? "triple"
              : "rapid";
      const bob = Math.sin(it.t * 4) * 4;
      const ok = drawSprite(imgs[key], it.x, it.y + bob, 42, Math.sin(it.spin) * 0.15);
      if (!ok) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(it.x, it.y + bob, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    enemies.forEach((e) => {
      const key = e.kind;
      const y = e.y + Math.sin(e.bob) * 3;
      const ok = drawSprite(imgs[key], e.x, y, 54, Math.sin(e.t * 2) * 0.08);
      if (!ok) drawEnemyFallback(e);
      if (e.maxHp > 1) {
        const w = 28;
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fillRect(e.x - w / 2, y + 26, w, 5);
        ctx.fillStyle = "#ff6b9d";
        ctx.fillRect(e.x - w / 2, y + 26, w * (e.hp / e.maxHp), 5);
      }
    });

    bullets.forEach((b) => {
      b.trail.forEach((t, i) => {
        ctx.globalAlpha = t.a * 0.45;
        ctx.fillStyle = b.friendly ? "#ffb347" : "#ff8eb5";
        ctx.beginPath();
        ctx.arc(t.x, t.y, b.friendly ? 3 + i * 0.3 : 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (b.friendly) {
        ctx.save();
        ctx.shadowColor = "#ffb347";
        ctx.shadowBlur = 12;
        const ang = Math.atan2(b.vy, b.vx || 0) + Math.PI / 2;
        const ok = drawSprite(imgs.missile, b.x, b.y, 30, ang);
        ctx.shadowBlur = 0;
        ctx.restore();
        if (!ok) {
          ctx.fillStyle = "#ff8a4c";
          ctx.beginPath();
          ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const ok = drawSprite(imgs.enemyShot, b.x, b.y, 24, 0);
        if (!ok) {
          ctx.fillStyle = "#ff5a8a";
          ctx.beginPath();
          ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    if (shield) drawShieldFX(player.x, player.y);

    ctx.save();
    if (invuln > 0) ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(performance.now() / 55));
    const chickOk = drawSprite(imgs.chick, player.x, player.y, 64, 0);
    if (!chickOk) drawChickFallback(player.x, player.y);
    ctx.restore();

    particles.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    floats.forEach((f) => {
      ctx.globalAlpha = 1 - f.t / 0.85;
      ctx.fillStyle = f.color;
      ctx.font = "bold 17px Jua";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    });

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,90,130,${flash * 0.32})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (state !== "play") {
      if (state === "title" || state === "over") {
        drawSky();
        if (shield) drawShieldFX(W / 2, H - 150);
        if (!drawSprite(imgs.chick, W / 2, H - 150, 78, 0)) drawChickFallback(W / 2, H - 150);
      }
      return;
    }
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
  }

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    canvas.setPointerCapture(e.pointerId);
    pointerId = e.pointerId;
    holding = true;
    dragX = canvasPos(e).x;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (state !== "play" || e.pointerId !== pointerId) return;
    dragX = canvasPos(e).x;
  });
  function endPointer(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    holding = false;
    dragX = null;
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (["ArrowLeft", "ArrowRight", " ", "Spacebar"].includes(e.key)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("retry-btn").addEventListener("click", startGame);

  document.getElementById("rank-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submit-btn");
    const name = nameInput.value.trim();
    if (name.length < 2) return;
    localStorage.setItem(NAME_KEY, name);
    if (submitted) {
      document.getElementById("rank-msg").textContent = "이미 등록했어요";
      return;
    }
    btn.disabled = true;
    if (!window.TodayScores) {
      document.getElementById("rank-msg").textContent = "랭킹 모듈을 불러오지 못했어요";
      btn.disabled = false;
      return;
    }
    const res = await window.TodayScores.submitScore(GAME_ID, name, Math.floor(score));
    if (res.ok) {
      submitted = true;
      lastRank = { rankDay: res.rankDay || res.rank, rankWeek: res.rankWeek };
      document.getElementById("rank-msg").textContent = window.TodayScores.formatRankMessage
        ? window.TodayScores.formatRankMessage(res)
        : "등록 완료!";
      const shareBtn = document.getElementById("share-rank-btn");
      if (shareBtn) shareBtn.hidden = false;
      if (window.TodayGameRank && TodayGameRank.afterSubmit) {
        await TodayGameRank.afterSubmit({
          gameId: GAME_ID,
          gameTitle: GAME_TITLE,
          name,
          score: Math.floor(score),
          rankDay: lastRank.rankDay,
          label: `${Math.floor(score).toLocaleString("ko-KR")}점`,
        });
      }
    } else {
      document.getElementById("rank-msg").textContent = res.error || "등록 실패";
    }
    btn.disabled = false;
  });

  document.getElementById("share-rank-btn").addEventListener("click", async () => {
    const name = nameInput.value.trim() || "나";
    const msg = document.getElementById("rank-msg");
    if (!window.TodayScores || !TodayScores.shareRank) return;
    const result = await window.TodayScores.shareRank({
      gameTitle: GAME_TITLE,
      name,
      score: Math.floor(score),
      rankDay: lastRank.rankDay,
      rankWeek: lastRank.rankWeek,
      url: `https://www.todaygame.co.kr/games/${GAME_ID}/`,
    });
    msg.textContent = window.TodayScores.formatShareResult
      ? window.TodayScores.formatShareResult(result)
      : "공유했어요!";
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: GAME_ID,
      gameTitle: GAME_TITLE,
      formParent: document.getElementById("over"),
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
        last = performance.now();
        return true;
      },
    });
  }

  seedClouds();
  updateHud();
  showOverlay("title");
  loadAssets().then(() => {
    raf = requestAnimationFrame(frame);
  });
})();
