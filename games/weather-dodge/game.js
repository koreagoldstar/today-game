(() => {
  "use strict";

  const GAME_ID = "weather-dodge";
  const W = 390;
  const H = 700;
  const GROUND = 575;
  const MAX_HP = 3;
  const BEST_KEY = "weather-dodge-best-v1";
  const WAVE_COUNT = 40;

  const BUSHES = [
    { x: 70, y: GROUND + 8, r: 42 },
    { x: 320, y: GROUND + 8, r: 42 },
  ];

  const WAVE_NAMES = [
    "이슬비", "첫 소나기", "바람 시작", "번개 예고", "우박 방울",
    "장대비", "돌풍", "천둥", "우박 소나기", "복합 전선",
    "가을비", "센 바람", "벼락", "우박 폭풍", "중급 시험",
    "폭우", "태풍 맛보기", "연쇄 번개", "우박 폭격", "폭풍 전야",
    "먹구름", "칼바람", "벼락 난사", "빙결 우박", "상급 시험",
    "장마", "회오리", "천둥벼락", "우박 지옥", "전선 충돌",
    "슈퍼 소나기", "광풍", "천벌", "우박 종말", "최후 전선",
    "종말의 비", "종말의 바람", "종말의 번개", "종말의 우박", "날씨 마스터",
  ];

  const imgs = {
    bg: null,
    chick: null,
    "chick-umbrella": null,
    "chick-jump": null,
    "chick-hide": null,
    rain: null,
    bolt: null,
    wind: null,
    hail: null,
    bush: null,
    cloud: null,
  };

  function punchKey(img) {
    if (!img) return null;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if ((r > 185 && b > 175 && g < 145 && r + b > g * 2.1) || (r > 200 && b > 150 && g < 90)) {
        d[i + 3] = 0;
      }
    }
    x.putImageData(data, 0, 0);
    return c;
  }

  function loadAssets() {
    return Promise.all(
      Object.keys(imgs).map(
        (key) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => {
              imgs[key] = key === "bg" ? im : punchKey(im) || im;
              res();
            };
            im.onerror = () => res();
            im.src = key === "bg" ? "assets/bg.jpg" : `assets/${key}.png`;
          })
      )
    );
  }

  function makeWave(i) {
    const t = i / (WAVE_COUNT - 1);
    const events = [];
    const n = 7 + Math.floor(i * 0.55);
    const gap = Math.max(0.55, 1.35 - i * 0.018);
    for (let k = 0; k < n; k++) {
      const roll = ((i * 19 + k * 37) % 100) / 100;
      let kind = "rain";
      if (i >= 2 && roll < 0.22 + t * 0.12) kind = "wind";
      if (i >= 3 && ((i * 11 + k * 23) % 100) / 100 < 0.18 + t * 0.15) kind = "bolt";
      if (i >= 4 && ((i * 7 + k * 41) % 100) / 100 < 0.16 + t * 0.14) kind = "hail";
      if (i >= 9 && k % 5 === 4) kind = ["rain", "wind", "bolt", "hail"][k % 4];
      events.push({ kind, t: 0.8 + k * gap });
    }
    return {
      name: WAVE_NAMES[i] || `웨이브 ${i + 1}`,
      events,
      speed: 1 + t * 0.85,
    };
  }

  const WAVES = Array.from({ length: WAVE_COUNT }, (_, i) => makeWave(i));

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

  const hudWave = document.getElementById("hud-wave");
  const hudScore = document.getElementById("hud-score");
  const hudBest = document.getElementById("hud-best");
  const hudLives = document.getElementById("hud-lives");
  const waveFill = document.getElementById("wave-fill");
  const warnEl = document.getElementById("warn");
  const pad = document.getElementById("pad");
  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  let state = "title";
  let waveIndex = 0;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let hp = MAX_HP;
  let player = null;
  let hazards = [];
  let particles = [];
  let floats = [];
  let clouds = [];
  let queue = [];
  let waveAcc = 0;
  let totalEvents = 0;
  let doneEvents = 0;
  let invuln = 0;
  let shake = 0;
  let flash = 0;
  let warnTimer = 0;
  let warnText = "";
  let time = 0;
  let last = 0;
  let raf = 0;
  let keys = { left: false, right: false };

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function nearBush(x) {
    return BUSHES.some((b) => Math.abs(b.x - x) < b.r);
  }

  function updateLives() {
    hudLives.innerHTML = "";
    for (let i = 0; i < MAX_HP; i++) {
      const el = document.createElement("i");
      if (i >= hp) el.classList.add("off");
      hudLives.appendChild(el);
    }
  }

  function updateHud() {
    hudWave.textContent = String(waveIndex + 1);
    hudScore.textContent = String(score);
    hudBest.textContent = String(best);
    waveFill.style.width = `${totalEvents ? Math.min(100, (doneEvents / totalEvents) * 100) : 0}%`;
    updateLives();
    warnEl.textContent = warnText;
    warnEl.classList.toggle("on", warnTimer > 0);
    document.getElementById("btn-umbrella").classList.toggle("on", !!(player && player.umbrella));
    document.getElementById("btn-hide").classList.toggle("on", !!(player && player.hide));
  }

  function showWarn(text, dur = 1.4) {
    warnText = text;
    warnTimer = dur;
    updateHud();
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 1, vy: -40 });
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 140);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.25, 0.55), r: rand(2, 4.5), color,
      });
    }
  }

  function resetPlayer() {
    player = {
      x: W / 2,
      y: GROUND,
      vy: 0,
      facing: 1,
      umbrella: false,
      hide: false,
      jumping: false,
      bob: 0,
      hurtFlash: 0,
    };
  }

  function resetWave() {
    const w = WAVES[waveIndex];
    hazards = [];
    particles = [];
    floats = [];
    queue = w.events.map((e) => ({ ...e }));
    waveAcc = 0;
    totalEvents = queue.length;
    doneEvents = 0;
    invuln = 0.6;
    player.umbrella = false;
    player.hide = false;
    player.vy = 0;
    player.y = GROUND;
    player.jumping = false;
    showWarn(`${w.name}`, 1.6);
    pad.classList.remove("hidden");
    updateHud();
  }

  function startGame() {
    if (window.TodayGameRank) TodayGameRank.reset();
    overlays.title.classList.add("hidden");
    overlays.clear.classList.add("hidden");
    overlays.over.classList.add("hidden");
    overlays.all.classList.add("hidden");
    waveIndex = 0;
    score = 0;
    hp = MAX_HP;
    resetPlayer();
    resetWave();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function nextWave() {
    overlays.clear.classList.add("hidden");
    waveIndex += 1;
    if (waveIndex >= WAVE_COUNT) {
      allClear();
      return;
    }
    resetWave();
    state = "play";
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function waveClear() {
    const bonus = 80 + waveIndex * 12 + hp * 25;
    score += bonus;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    state = "clear";
    document.getElementById("clear-detail").textContent =
      `${WAVES[waveIndex].name} 클리어 · +${bonus}`;
    overlays.clear.classList.remove("hidden");
    pad.classList.add("hidden");
    updateHud();
  }

  function gameOver() {
    state = "over";
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    document.getElementById("over-detail").textContent =
      `WAVE ${waveIndex + 1} · 점수 ${score}`;
    overlays.over.classList.remove("hidden");
    pad.classList.add("hidden");
    updateHud();
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "날씨 피하기", formParent: overlays.over });
      TodayGameRank.open(score);
    }
  }

  function allClear() {
    state = "all";
    score += 500;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    document.getElementById("all-detail").textContent = `최종 점수 ${score}`;
    overlays.all.classList.remove("hidden");
    pad.classList.add("hidden");
    updateHud();
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "날씨 피하기", formParent: overlays.all });
      TodayGameRank.open(score);
    }
  }

  function hurt(kind) {
    if (invuln > 0 || state !== "play") return;
    hp -= 1;
    invuln = 1.1;
    shake = 0.35;
    flash = 0.2;
    player.hurtFlash = 0.4;
    player.hide = false;
    player.umbrella = false;
    burst(player.x, player.y - 30, "#ff8a8a", 16);
    addFloat(player.x, player.y - 50, kind === "bolt" ? "벼락!" : "아야!", "#ff8a8a");
    updateHud();
    if (hp <= 0) gameOver();
  }

  function spawnHazard(kind) {
    const spd = WAVES[waveIndex].speed;
    if (kind === "rain") {
      const x = rand(50, W - 50);
      showWarn("💧 비! 우산!", 0.9);
      for (let i = 0; i < 5 + Math.floor(waveIndex / 8); i++) {
        hazards.push({
          kind: "rain",
          x: x + rand(-36, 36),
          y: -20 - i * 28,
          vy: 220 * spd + rand(0, 40),
          r: 12,
          life: 4,
        });
      }
      clouds.push({ x, y: 90, life: 1.8, kind: "rain" });
    } else if (kind === "bolt") {
      const x = player.x + rand(-40, 40);
      const tx = Math.max(50, Math.min(W - 50, x));
      showWarn("⚡ 번개! 덤불에 숨기!", 1.1);
      hazards.push({
        kind: "bolt",
        x: tx,
        y: 0,
        phase: "tele",
        tele: 1.05,
        strike: 0.18,
        r: 38,
        life: 2,
      });
      clouds.push({ x: tx, y: 70, life: 1.4, kind: "bolt" });
    } else if (kind === "wind") {
      const dir = Math.random() < 0.5 ? -1 : 1;
      showWarn(dir > 0 ? "🍃 돌풍 → 점프!" : "🍃 ← 돌풍 점프!", 1.0);
      hazards.push({
        kind: "wind",
        x: dir > 0 ? -40 : W + 40,
        y: GROUND - 55,
        vx: dir * (210 * spd),
        r: 34,
        life: 3,
        push: dir * (140 + waveIndex * 2),
      });
    } else if (kind === "hail") {
      showWarn("🧊 우박! 점프!", 0.95);
      const count = 3 + Math.floor(waveIndex / 10);
      for (let i = 0; i < count; i++) {
        hazards.push({
          kind: "hail",
          x: rand(40, W - 40),
          y: -30 - i * 40,
          vy: 180 * spd,
          vx: rand(-40, 40),
          r: 16,
          life: 4,
          bounce: 0,
        });
      }
      clouds.push({ x: W / 2, y: 80, life: 1.5, kind: "hail" });
    }
  }

  function protectedFrom(kind) {
    if (!player) return false;
    if (player.hide && nearBush(player.x)) return true;
    if (kind === "rain" && player.umbrella && !player.jumping) return true;
    if ((kind === "wind" || kind === "hail") && player.jumping && player.y < GROUND - 28) return true;
    if (kind === "bolt" && player.hide && nearBush(player.x)) return true;
    return false;
  }

  function setUmbrella(on) {
    if (!player || state !== "play") return;
    if (on && player.hide) player.hide = false;
    if (on && player.jumping) return;
    player.umbrella = !!on;
    updateHud();
  }

  function tryHide() {
    if (!player || state !== "play") return;
    if (!nearBush(player.x)) {
      addFloat(player.x, player.y - 40, "덤불 근처!", "#9ae06a");
      return;
    }
    player.hide = !player.hide;
    if (player.hide) {
      player.umbrella = false;
      player.vy = 0;
      player.y = GROUND;
      player.jumping = false;
    }
    updateHud();
  }

  function tryJump() {
    if (!player || state !== "play") return;
    if (player.jumping || player.hide) return;
    player.umbrella = false;
    player.jumping = true;
    player.vy = -420;
    burst(player.x, player.y, "#ffe27a", 6);
    updateHud();
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;
    if (flash > 0) flash -= dt;
    if (invuln > 0) invuln -= dt;
    if (warnTimer > 0) {
      warnTimer -= dt;
      if (warnTimer <= 0) updateHud();
    }
    if (player.hurtFlash > 0) player.hurtFlash -= dt;

    waveAcc += dt;
    while (queue.length && waveAcc >= queue[0].t) {
      spawnHazard(queue.shift().kind);
      doneEvents += 1;
      updateHud();
    }

    // player move
    let mx = 0;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    if (!player.hide) {
      const speed = player.umbrella ? 150 : 210;
      player.x += mx * speed * dt;
      if (mx) player.facing = mx > 0 ? 1 : -1;
    }
    player.x = Math.max(36, Math.min(W - 36, player.x));

    if (player.jumping) {
      player.vy += 1450 * dt;
      player.y += player.vy * dt;
      if (player.y >= GROUND) {
        player.y = GROUND;
        player.vy = 0;
        player.jumping = false;
      }
    } else {
      player.y = GROUND;
      player.bob += dt * 5;
    }

    // wind push while active wind near
    for (const h of hazards) {
      if (h.kind === "wind" && !player.hide && Math.abs(h.x - player.x) < 80 && Math.abs(h.y - (player.y - 40)) < 70) {
        if (!protectedFrom("wind")) {
          player.x += h.push * dt * 0.55;
        }
      }
    }
    player.x = Math.max(36, Math.min(W - 36, player.x));

    for (let i = hazards.length - 1; i >= 0; i--) {
      const h = hazards[i];
      h.life -= dt;

      if (h.kind === "rain") {
        h.y += h.vy * dt;
        const hitY = player.hide ? player.y - 10 : player.y - (player.umbrella ? 55 : 35);
        if (Math.abs(h.x - player.x) < 22 && h.y > hitY - 10 && h.y < player.y + 10) {
          if (protectedFrom("rain")) {
            score += 2;
            burst(h.x, h.y, "#6ec8ff", 4);
            hazards.splice(i, 1);
            continue;
          }
          hurt("rain");
          hazards.splice(i, 1);
          continue;
        }
        if (h.y > GROUND + 40 || h.life <= 0) hazards.splice(i, 1);
      } else if (h.kind === "bolt") {
        if (h.phase === "tele") {
          h.tele -= dt;
          if (h.tele <= 0) {
            h.phase = "strike";
            flash = 0.25;
            shake = 0.3;
          }
        } else {
          h.strike -= dt;
          const dx = Math.abs(h.x - player.x);
          if (dx < h.r && !protectedFrom("bolt")) {
            hurt("bolt");
          } else if (dx < h.r && protectedFrom("bolt")) {
            score += 15;
            addFloat(player.x, player.y - 60, "피함!", "#9ae06a");
          }
          if (h.strike <= 0) {
            burst(h.x, GROUND - 20, "#ffe66a", 18);
            hazards.splice(i, 1);
            score += 5;
          }
        }
      } else if (h.kind === "wind") {
        h.x += h.vx * dt;
        if (Math.abs(h.x - player.x) < 40 && Math.abs(h.y - (player.y - 40)) < 45) {
          if (protectedFrom("wind")) {
            score += 12;
            addFloat(player.x, player.y - 55, "점프!", "#ffe27a");
            burst(h.x, h.y, "#a8e0d0", 8);
            hazards.splice(i, 1);
            continue;
          }
          hurt("wind");
          hazards.splice(i, 1);
          continue;
        }
        if (h.x < -80 || h.x > W + 80 || h.life <= 0) hazards.splice(i, 1);
      } else if (h.kind === "hail") {
        h.vy += 400 * dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        if (h.y >= GROUND - 8) {
          h.y = GROUND - 8;
          h.vy *= -0.45;
          h.bounce += 1;
          if (h.bounce > 2) {
            hazards.splice(i, 1);
            continue;
          }
        }
        const py = player.jumping ? player.y - 20 : player.y - 28;
        if (Math.hypot(h.x - player.x, h.y - py) < 28) {
          if (protectedFrom("hail")) {
            score += 10;
            burst(h.x, h.y, "#c8e8ff", 8);
            hazards.splice(i, 1);
            continue;
          }
          hurt("hail");
          hazards.splice(i, 1);
          continue;
        }
        if (h.life <= 0) hazards.splice(i, 1);
      }
    }

    for (let i = clouds.length - 1; i >= 0; i--) {
      clouds[i].life -= dt;
      if (clouds[i].life <= 0) clouds.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }

    if (queue.length === 0 && hazards.length === 0 && state === "play") {
      score += 20;
      waveClear();
    }
  }

  function drawImg(g, img, x, y, w, h, flip) {
    if (!img) return false;
    g.save();
    if (flip) {
      g.translate(x, y);
      g.scale(-1, 1);
      g.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      g.drawImage(img, x - w / 2, y - h / 2, w, h);
    }
    g.restore();
    return true;
  }

  function draw(g) {
    g.save();
    if (shake > 0) g.translate(rand(-4, 4) * shake * 4, rand(-3, 3) * shake * 4);

    if (imgs.bg) g.drawImage(imgs.bg, 0, 0, W, H);
    else {
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#7eb8e0");
      sky.addColorStop(0.55, "#8ec070");
      sky.addColorStop(1, "#5a9a40");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
    }

    // ambient weather tint by wave
    const t = waveIndex / Math.max(1, WAVE_COUNT - 1);
    g.fillStyle = `rgba(40, 60, 90, ${0.08 + t * 0.18})`;
    g.fillRect(0, 0, W, H);

    // ground soft shadow line
    g.fillStyle = "rgba(20,40,20,0.18)";
    g.fillRect(0, GROUND + 18, W, H - GROUND);

    // bushes
    for (const b of BUSHES) {
      const glow = player && player.hide && Math.abs(player.x - b.x) < b.r;
      if (glow) {
        g.strokeStyle = "rgba(154,224,106,0.7)";
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(b.x, b.y - 10, b.r + 6, b.r * 0.7, 0, 0, Math.PI * 2);
        g.stroke();
      }
      if (!drawImg(g, imgs.bush, b.x, b.y - 28, 96, 88, false)) {
        g.fillStyle = "#4a9a3a";
        g.beginPath();
        g.ellipse(b.x, b.y - 20, 40, 32, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "rgba(255,248,230,0.75)";
      g.font = '12px "Jua"';
      g.textAlign = "center";
      g.fillText("숨기", b.x, b.y + 22);
    }

    // clouds
    for (const c of clouds) {
      g.globalAlpha = Math.min(1, c.life);
      drawImg(g, imgs.cloud, c.x, c.y, 110, 70, false);
      g.globalAlpha = 1;
    }

    // hazards
    for (const h of hazards) {
      if (h.kind === "rain") {
        drawImg(g, imgs.rain, h.x, h.y, 22, 34, false);
      } else if (h.kind === "bolt") {
        if (h.phase === "tele") {
          const pulse = 0.4 + Math.sin(time * 18) * 0.25;
          g.strokeStyle = `rgba(255,230,100,${pulse})`;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(h.x, GROUND, h.r * (0.7 + (1 - h.tele) * 0.4), 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = `rgba(255,80,60,${0.15 + pulse * 0.2})`;
          g.beginPath();
          g.arc(h.x, GROUND, h.r * 0.55, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#ffe66a";
          g.font = '700 14px "Jua"';
          g.textAlign = "center";
          g.fillText("!", h.x, GROUND - h.r - 8);
        } else {
          g.save();
          g.globalAlpha = 0.95;
          drawImg(g, imgs.bolt, h.x, 200, 70, 320, false);
          g.restore();
          g.fillStyle = "rgba(255,255,200,0.35)";
          g.fillRect(h.x - 18, 0, 36, GROUND);
        }
      } else if (h.kind === "wind") {
        drawImg(g, imgs.wind, h.x, h.y, 90, 70, h.vx < 0);
      } else if (h.kind === "hail") {
        drawImg(g, imgs.hail, h.x, h.y, 36, 34, false);
      }
    }

    // player
    if (player) {
      const bob = player.jumping ? 0 : Math.sin(player.bob) * 2;
      let spr = imgs.chick;
      let sw = 72;
      let sh = 78;
      if (player.hide && nearBush(player.x)) {
        spr = imgs["chick-hide"];
        sw = 78;
        sh = 70;
      } else if (player.jumping) {
        spr = imgs["chick-jump"];
        sw = 74;
        sh = 80;
      } else if (player.umbrella) {
        spr = imgs["chick-umbrella"];
        sw = 78;
        sh = 88;
      }

      g.save();
      if (invuln > 0 && Math.floor(time * 16) % 2 === 0) g.globalAlpha = 0.45;
      if (player.hurtFlash > 0) {
        g.filter = "brightness(1.4) saturate(0.5)";
      }
      const py = player.hide ? player.y - 8 + bob : player.y - 36 + bob;
      if (!drawImg(g, spr, player.x, py, sw, sh, player.facing < 0)) {
        g.fillStyle = "#ffe27a";
        g.beginPath();
        g.ellipse(player.x, player.y - 20, 22, 26, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();

      // shadow
      g.fillStyle = "rgba(0,0,0,0.2)";
      g.beginPath();
      g.ellipse(player.x, GROUND + 14, 22 - (GROUND - player.y) * 0.05, 7, 0, 0, Math.PI * 2);
      g.fill();
    }

    for (const p of particles) {
      g.globalAlpha = Math.max(0, p.life * 1.6);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    for (const f of floats) {
      g.globalAlpha = Math.min(1, f.life * 1.4);
      g.fillStyle = f.color;
      g.font = '700 15px "Jua"';
      g.textAlign = "center";
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;

    if (flash > 0) {
      g.fillStyle = `rgba(255,255,220,${flash * 1.5})`;
      g.fillRect(0, 0, W, H);
    }

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
    } else {
      draw(ctx);
    }
  }

  // controls
  const hold = { left: false, right: false, umbrella: false };

  function bindHold(btn, key, onStart, onEnd) {
    const start = (ev) => {
      ev.preventDefault();
      hold[key] = true;
      if (onStart) onStart();
    };
    const end = (ev) => {
      ev.preventDefault();
      hold[key] = false;
      if (onEnd) onEnd();
    };
    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointerleave", end);
    btn.addEventListener("pointercancel", end);
  }

  bindHold(document.getElementById("btn-left"), "left", () => { keys.left = true; }, () => { keys.left = false; });
  bindHold(document.getElementById("btn-right"), "right", () => { keys.right = true; }, () => { keys.right = false; });
  bindHold(
    document.getElementById("btn-umbrella"),
    "umbrella",
    () => setUmbrella(true),
    () => setUmbrella(false)
  );
  document.getElementById("btn-hide").addEventListener("click", tryHide);
  document.getElementById("btn-jump").addEventListener("click", tryJump);

  window.addEventListener("keydown", (ev) => {
    if (ev.code === "ArrowLeft" || ev.code === "KeyA") keys.left = true;
    if (ev.code === "ArrowRight" || ev.code === "KeyD") keys.right = true;
    if (ev.code === "KeyS" || ev.code === "ArrowDown") setUmbrella(true);
    if (ev.code === "KeyW" || ev.code === "ArrowUp" || ev.code === "Space") {
      ev.preventDefault();
      tryJump();
    }
    if (ev.code === "KeyE" || ev.code === "ShiftLeft") tryHide();
  });
  window.addEventListener("keyup", (ev) => {
    if (ev.code === "ArrowLeft" || ev.code === "KeyA") keys.left = false;
    if (ev.code === "ArrowRight" || ev.code === "KeyD") keys.right = false;
    if (ev.code === "KeyS" || ev.code === "ArrowDown") setUmbrella(false);
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextWave);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  if (window.TodayGameRank) {
    TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "날씨 피하기", formParent: overlays.title });
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

  pad.classList.add("hidden");
  hudBest.textContent = String(best);
  updateLives();

  loadAssets().then(() => {
    resetPlayer();
    draw(ctx);
    last = performance.now();
    raf = requestAnimationFrame(function idle(now) {
      if (state !== "title") return;
      last = now;
      time += 0.016;
      if (player) player.bob += 0.08;
      draw(ctx);
      raf = requestAnimationFrame(idle);
    });
  });
})();
