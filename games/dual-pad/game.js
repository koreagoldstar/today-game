(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const HIT_Y = 468;
  const SPAWN_Y = -48;
  const APPROACH = 1.85;
  const PERFECT_MS = 70;
  const GOOD_MS = 140;
  const MAX_LIVES = 5;
  const NOTE_H = 52;
  const LEFT_X = W * 0.28;
  const RIGHT_X = W * 0.72;
  const LEFT = 0;
  const RIGHT = 1;

  const COLORS = {
    left: "#ff2d95",
    right: "#00f5ff",
    lime: "#c8ff00",
  };

  const imgs = {
    note_left: null,
    note_right: null,
    pad_left: null,
    pad_right: null,
  };

  function loadAssets() {
    return Promise.all(
      Object.keys(imgs).map(
        (key) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              imgs[key] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `assets/${key}.png`;
          })
      )
    );
  }

  const KEY_LEFT = {
    KeyF: true,
    KeyA: true,
  };
  const KEY_RIGHT = {
    KeyJ: true,
    KeyL: true,
  };

  const SONG_META = HipCore.buildSongList(20, 6262, "dual-pad");
  const audio = HipCore.createAudio("dual-pad");

  function buildChart(song, index) {
    const rand = HipCore.mulberry32(6262 + index * 173);
    const beat = 60 / song.bpm;
    const bars = song.bars;
    const dens = 0.36 + song.diff * 0.1;
    const doubleChance =
      song.diff >= 4 ? 0.22 + rand() * 0.03 : song.diff >= 3 ? 0.15 + rand() * 0.05 : song.diff * 0.035;

    const chart = [];
    let t = 1.15;

    for (let step = 0; step < bars * 4; step += 1) {
      if (rand() < dens) {
        const micro = (rand() - 0.5) * 0.018;
        if (song.diff >= 2 && rand() < doubleChance) {
          const hit = +(t + micro).toFixed(3);
          chart.push({ time: hit, side: LEFT });
          chart.push({ time: hit, side: RIGHT });
        } else {
          chart.push({ time: +(t + micro).toFixed(3), side: rand() < 0.5 ? LEFT : RIGHT });
        }
      }

      if (song.diff >= 3 && rand() < 0.14) {
        const alt = +(t + beat * 0.5).toFixed(3);
        chart.push({ time: alt, side: step % 2 === 0 ? LEFT : RIGHT });
      }

      if (song.diff >= 4 && rand() < 0.1) {
        const burst = +(t + beat * 0.25).toFixed(3);
        chart.push({ time: burst, side: LEFT });
        chart.push({ time: burst, side: RIGHT });
      }

      t += beat;
    }

    chart.sort((a, b) => a.time - b.time || a.side - b.side);

    const cleaned = [];
    const seen = new Set();
    for (const n of chart) {
      const key = `${n.side}:${n.time.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(n);
    }

    return { ...song, chart: cleaned };
  }

  const SONGS = SONG_META.map((s, i) => buildChart(s, i));

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

  const dualPads = document.getElementById("dual-pads");
  const comboBurst = document.getElementById("combo-burst");
  const comboBig = document.getElementById("hud-combo-big");

  let state = "title";
  let songIndex = 0;
  let score = 0;
      if (window.TodayGameRank) TodayGameRank.reset();
  let combo = 0;
  let maxCombo = 0;
  let lives = MAX_LIVES;
  let songTime = 0;
  let notes = [];
  let spawnIdx = 0;
  let particles = [];
  let floats = [];
  let rings = [];
  let sideFlash = [0, 0];
  let screenPulse = 0;
  let missFlash = 0;
  let beatPulse = 0;
  let last = 0;
  let raf = 0;
  let songEnd = 0;
  let musicLead = 0.55;

  function sideX(side) {
    return side === LEFT ? LEFT_X : RIGHT_X;
  }

  function sideColor(side) {
    return side === LEFT ? COLORS.left : COLORS.right;
  }

  function noteSpeed() {
    return (HIT_Y - SPAWN_Y) / APPROACH;
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (overlays[name]) overlays[name].classList.remove("hidden");
    dualPads.classList.toggle("hidden", name != null);
  }

  function resetSong() {
    const song = SONGS[songIndex];
    songTime = -musicLead;
    spawnIdx = 0;
    notes = [];
    particles = [];
    floats = [];
    rings = [];
    sideFlash = [0, 0];
    screenPulse = 0;
    missFlash = 0;
    beatPulse = 0;
    combo = 0;
    lives = MAX_LIVES;
    songEnd = song.chart.length ? song.chart[song.chart.length - 1].time + 2.6 : 8;
    updateHud();
    audio.playTrack(song.track, song.rate, song.offset);
  }

  function updateHud() {
    const song = SONGS[songIndex];
    document.getElementById("hud-title").textContent = song.name;
    document.getElementById("hud-song").textContent = String(songIndex + 1);
    document.getElementById("hud-score").textContent = String(score);
    comboBig.textContent = String(combo);
    comboBurst.classList.toggle("on", combo >= 2);

    const livesEl = document.getElementById("hud-lives");
    livesEl.innerHTML = "";
    for (let i = 0; i < MAX_LIVES; i += 1) {
      const d = document.createElement("span");
      d.className = "life" + (i >= lives ? " empty" : "");
      livesEl.appendChild(d);
    }
  }

  function spawnNotes() {
    const song = SONGS[songIndex];
    while (spawnIdx < song.chart.length && song.chart[spawnIdx].time - APPROACH <= songTime) {
      const c = song.chart[spawnIdx];
      notes.push({
        side: c.side,
        hitTime: c.time,
        y: SPAWN_Y,
        hit: false,
        missed: false,
      });
      spawnIdx += 1;
    }
  }

  function addParticles(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 6;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2.5,
        life: 0.4 + Math.random() * 0.35,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.85, vy: -1.2 });
  }

  function flashPad(side) {
    const btn = dualPads.querySelector(`[data-side="${side}"]`);
    if (!btn) return;
    btn.classList.add("flash");
    clearTimeout(btn._flashT);
    btn._flashT = setTimeout(() => btn.classList.remove("flash"), 130);
  }

  function registerMiss(side) {
    combo = 0;
    lives -= 1;
    missFlash = 0.38;
    sideFlash[side] = 0.35;
    audio.sfxHit("miss");
    addFloat(sideX(side), HIT_Y - 34, "MISS", "#ff5577");
    flashPad(side);
    updateHud();
    if (lives <= 0) {
      audio.stop();
      state = "over";
      document.getElementById("over-detail").textContent = `점수 ${score} · 최대 콤보 ${maxCombo}`;
      showOverlay("over");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "dual-pad", gameTitle: "듀얼 패드", formParent: document.getElementById("over") });
      TodayGameRank.open(score);
    }
    }
  }

  function judgeNote(deltaMs) {
    const abs = Math.abs(deltaMs);
    if (abs <= PERFECT_MS) return "perfect";
    if (abs <= GOOD_MS) return "good";
    return null;
  }

  function tapSide(side) {
    if (state !== "play") return;
    audio.ensure();
    sideFlash[side] = 0.28;
    flashPad(side);
    rings.push({ side, life: 0.42, scale: 0.5 });

    let best = null;
    let bestDelta = Infinity;
    for (const note of notes) {
      if (note.hit || note.missed || note.side !== side) continue;
      const deltaMs = (note.hitTime - songTime) * 1000;
      const abs = Math.abs(deltaMs);
      if (abs < bestDelta && abs <= GOOD_MS) {
        bestDelta = abs;
        best = note;
      }
    }
    if (!best) return;

    const kind = judgeNote((best.hitTime - songTime) * 1000);
    if (!kind) return;

    best.hit = true;
    const x = sideX(side);
    const color = sideColor(side);
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    const mult = 1 + Math.floor(combo / 10) * 0.15;
    score += kind === "perfect" ? Math.round(350 * mult) : Math.round(170 * mult);
    audio.sfxHit(kind);

    if (kind === "perfect") {
      screenPulse = 0.28;
      addParticles(x, HIT_Y, COLORS.lime, 18);
      addFloat(x, HIT_Y - 44, "PERFECT", COLORS.lime);
    } else {
      addParticles(x, HIT_Y, color, 10);
      addFloat(x, HIT_Y - 40, "GOOD", "#fff");
    }

    if (combo >= 5 && combo % 5 === 0) {
      addFloat(W / 2, 180, `${combo} COMBO`, color);
    }
    updateHud();
  }

  function updateNotes() {
    const speed = noteSpeed();
    for (const note of notes) {
      if (note.hit) continue;
      note.y = HIT_Y - (note.hitTime - songTime) * speed;
      if (!note.missed && songTime - note.hitTime > GOOD_MS / 1000) {
        note.missed = true;
        registerMiss(note.side);
      }
    }
    notes = notes.filter((n) => !n.hit && !(n.missed && n.y > H + 50));
  }

  function checkSongEnd() {
    const song = SONGS[songIndex];
    const allDone = spawnIdx >= song.chart.length && notes.length === 0;
    if (allDone && songTime >= songEnd - 1.2) {
      audio.stop();
      state = "clear";
      if (songIndex >= SONGS.length - 1) {
        document.getElementById("all-detail").textContent =
          `20곡 완주! 총점 ${score} · 최대 콤보 ${maxCombo}`;
        showOverlay("all");
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "dual-pad", gameTitle: "듀얼 패드", formParent: document.getElementById("allclear") });
      TodayGameRank.open(score);
    }
      } else {
        document.getElementById("clear-title").textContent = `${song.name} 클리어!`;
        document.getElementById("clear-detail").textContent =
          `점수 ${score} · BPM ${song.bpm} · 콤보 ${maxCombo}`;
        showOverlay("clear");
      }
    }
  }

  function hexAlpha(hex, a) {
    const n = hex.replace("#", "");
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawBackground() {
    ctx.clearRect(0, 0, W, H);
    const pulse = beatPulse;

    const vg = ctx.createRadialGradient(W / 2, 80, 8, W / 2, 120, 240);
    vg.addColorStop(0, `rgba(200,255,0,${0.06 + pulse * 0.08})`);
    vg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    for (let side = 0; side < 2; side += 1) {
      const x = sideX(side);
      const color = sideColor(side);
      const laneW = side === LEFT ? W * 0.38 : W * 0.38;
      const topW = laneW * 0.35;
      const botW = laneW * 0.55;

      ctx.beginPath();
      ctx.moveTo(x - topW * 0.5, 60);
      ctx.lineTo(x + topW * 0.5, 60);
      ctx.lineTo(x + botW * 0.5, HIT_Y + 30);
      ctx.lineTo(x - botW * 0.5, HIT_Y + 30);
      ctx.closePath();

      const lg = ctx.createLinearGradient(0, 60, 0, HIT_Y);
      lg.addColorStop(0, "rgba(255,255,255,0.015)");
      lg.addColorStop(1, hexAlpha(color, 0.1 + pulse * 0.08));
      ctx.fillStyle = lg;
      ctx.fill();
      ctx.strokeStyle = hexAlpha(color, 0.32 + pulse * 0.22);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(200,255,0,${0.25 + pulse * 0.35})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 70);
    ctx.lineTo(W / 2, HIT_Y + 20);
    ctx.stroke();
    ctx.setLineDash([]);

    const jg = ctx.createLinearGradient(0, HIT_Y - 16, 0, HIT_Y + 16);
    jg.addColorStop(0, "rgba(255,255,255,0)");
    jg.addColorStop(0.5, `rgba(200,255,0,${0.28 + pulse * 0.35})`);
    jg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = jg;
    ctx.fillRect(8, HIT_Y - 16, W - 16, 32);

    ctx.strokeStyle = `rgba(255,255,255,${0.6 + pulse * 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = COLORS.lime;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(14, HIT_Y);
    ctx.lineTo(W - 14, HIT_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (let side = 0; side < 2; side += 1) {
      const x = sideX(side);
      const color = sideColor(side);
      const flash = sideFlash[side];
      ctx.beginPath();
      ctx.arc(x, HIT_Y, 24 + flash * 12, 0, Math.PI * 2);
      ctx.strokeStyle = hexAlpha(color, 0.5 + flash * 0.5);
      ctx.lineWidth = 3 + flash * 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14 + flash * 22;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, HIT_Y, 9, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(color, 0.4 + flash * 0.45);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawNotes() {
    for (const note of notes) {
      if (note.hit) continue;
      const progress = Math.max(0, Math.min(1.2, (note.y + 40) / (HIT_Y + 40)));
      const x = sideX(note.side);
      const scale = 0.42 + progress * 0.72;
      const w = NOTE_H * scale * 0.9;
      const h = NOTE_H * scale;
      const color = sideColor(note.side);

      ctx.strokeStyle = hexAlpha(color, 0.4);
      ctx.lineWidth = 4 * scale;
      ctx.beginPath();
      ctx.moveTo(x, note.y - 32 * scale);
      ctx.lineTo(x, note.y + 2);
      ctx.stroke();

      ctx.save();
      ctx.translate(x, note.y);
      ctx.shadowColor = color;
      ctx.shadowBlur = 22;
      const noteImg = note.side === LEFT ? imgs.note_left : imgs.note_right;
      if (noteImg) {
        const s = Math.max(w, h) * 1.15;
        ctx.drawImage(noteImg, -s / 2, -s / 2, s, s);
        ctx.fillStyle = note.side === LEFT ? "#fff" : "#05050c";
        ctx.font = `bold ${Math.round(16 * scale)}px "Bagel Fat One", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowBlur = 0;
        ctx.fillText(note.side === LEFT ? "L" : "R", 0, 0);
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h * 0.32, w, h * 0.64, 10 * scale);
        ctx.fill();

        ctx.strokeStyle = "#fff";
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle = note.side === LEFT ? "#fff" : "#000";
        ctx.font = `bold ${Math.round(16 * scale)}px "Bagel Fat One", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowBlur = 0;
        ctx.fillText(note.side === LEFT ? "L" : "R", 0, 0);
      }
      ctx.restore();
    }
  }

  function drawFX() {
    for (const ring of rings) {
      const alpha = ring.life / 0.42;
      const x = sideX(ring.side);
      const size = 80 * ring.scale;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = sideColor(ring.side);
      ctx.lineWidth = 4;
      ctx.shadowColor = sideColor(ring.side);
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(x, HIT_Y, size / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    for (let s = 0; s < 2; s += 1) {
      if (sideFlash[s] > 0) {
        const x = sideX(s);
        ctx.fillStyle = hexAlpha(sideColor(s), sideFlash[s] * 0.3);
        ctx.fillRect(x - 70, HIT_Y - 80, 140, 130);
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, f.life * 1.4);
      ctx.font = f.text.includes("COMBO")
        ? '700 22px "Bagel Fat One", "Chakra Petch", sans-serif'
        : '700 18px "Chakra Petch", sans-serif';
      ctx.fillStyle = f.color;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 8;
      ctx.fillText(f.text, f.x, f.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  function draw() {
    drawBackground();
    if (screenPulse > 0) {
      ctx.fillStyle = `rgba(200,255,0,${screenPulse * 0.1})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (missFlash > 0) {
      ctx.fillStyle = `rgba(255,45,80,${missFlash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
    drawNotes();
    drawFX();
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    if (state === "play") {
      songTime = audio.now() - musicLead;
      spawnNotes();
      updateNotes();

      const song = SONGS[songIndex];
      const beat = 60 / song.bpm;
      const beatPhase = (songTime % beat) / beat;
      beatPulse = beatPhase < 0.12 ? 1 : 0.25;

      particles = particles.filter((p) => {
        p.life -= dt;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        return p.life > 0;
      });
      floats = floats.filter((f) => {
        f.life -= dt;
        f.y += f.vy;
        return f.life > 0;
      });
      rings = rings.filter((r) => {
        r.life -= dt;
        r.scale += dt * 2;
        return r.life > 0;
      });
      for (let i = 0; i < 2; i += 1) sideFlash[i] = Math.max(0, sideFlash[i] - dt);
      screenPulse = Math.max(0, screenPulse - dt);
      missFlash = Math.max(0, missFlash - dt);
      checkSongEnd();
    } else {
      beatPulse = Math.max(0, beatPulse - dt * 3);
    }

    draw();
    raf = requestAnimationFrame(tick);
  }

  function startGame(fromTitle) {
    if (fromTitle) {
      score = 0;
      maxCombo = 0;
    }
    resetSong();
    state = "play";
    showOverlay(null);
    last = performance.now();
  }

  function backToMenu() {
    audio.stop();
    state = "title";
    showOverlay("title");
    syncSongList();
  }

  function syncSongList() {
    const list = document.getElementById("song-list");
    const label = document.getElementById("pick-label");
    list.innerHTML = "";
    SONGS.forEach((song, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "song-item" + (i === songIndex ? " on" : "");
      btn.innerHTML = `<span>${i + 1}. ${song.name}</span><span class="meta">BPM ${song.bpm} · ★${song.diff}</span>`;
      btn.addEventListener("click", () => {
        songIndex = i;
        label.textContent = `${i + 1}. ${song.name}`;
        syncSongList();
      });
      list.appendChild(btn);
    });
    label.textContent = `${songIndex + 1}. ${SONGS[songIndex].name}`;
  }

  dualPads.querySelectorAll(".pad").forEach((btn) => {
    const fire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      tapSide(Number(btn.dataset.side));
    };
    btn.addEventListener("pointerdown", fire);
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (KEY_LEFT[e.code]) {
      e.preventDefault();
      tapSide(LEFT);
    } else if (KEY_RIGHT[e.code]) {
      e.preventDefault();
      tapSide(RIGHT);
    }
  });

  document.getElementById("start-btn").addEventListener("click", () => {
    audio.ensure();
    startGame(true);
  });
  document.getElementById("retry-btn").addEventListener("click", () => startGame(true));
  document.getElementById("again-btn").addEventListener("click", () => {
    songIndex = 0;
    startGame(true);
  });
  document.getElementById("next-btn").addEventListener("click", () => {
    songIndex += 1;
    startGame(false);
  });
  document.getElementById("menu-btn").addEventListener("click", backToMenu);
  document.getElementById("menu-btn2").addEventListener("click", backToMenu);

  syncSongList();
  showOverlay("title");
  last = performance.now();
  loadAssets().then(() => {
    raf = requestAnimationFrame(tick);
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "dual-pad",
      gameTitle: "듀얼 패드",
      formParent: document.getElementById("over") || document.body,
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
