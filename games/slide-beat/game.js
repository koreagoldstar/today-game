(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const LANES = 3;
  const LANE_TOP = 108;
  const LANE_BOTTOM = H - 120;
  const LANE_H = (LANE_BOTTOM - LANE_TOP) / LANES;
  const SPAWN_X = 24;
  const HIT_X = W - 56;
  const TRACK_W = HIT_X - SPAWN_X;
  const APPROACH = 2.05;
  const PERFECT = 0.11;
  const GOOD = 0.22;
  const MAX_LIVES = 5;
  const SEED = 5151;
  const NOTE_R = 22;
  const ZONE_W = 42;

  const ROW_COLORS = ["#00f5ff", "#ff2d95", "#c8ff00"];
  const NOTE_KEYS = ["note_cyan", "note_magenta", "note_lime"];

  const COLORS = {
    cyan: "#00f5ff",
    magenta: "#ff2d95",
    lime: "#c8ff00",
    void: "#05050c",
    dim: "rgba(122, 138, 168, 0.35)",
  };

  const imgs = {
    note_cyan: null,
    note_magenta: null,
    note_lime: null,
    hit_line: null,
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

  const SONGS = HipCore.buildSongList(20, SEED, "slide-beat").map((song) => ({
    ...song,
    chart: buildChart(song),
  }));

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  const audio = HipCore.createAudio("slide-beat");

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  const tapBar = document.getElementById("tap-bar");
  const judgeFlash = document.getElementById("judge-flash");
  const comboBurst = document.getElementById("combo-burst");
  const comboBig = document.getElementById("hud-combo-big");

  let state = "title";
  let songIndex = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let lives = MAX_LIVES;
  let noteIdx = 0;
  let notes = [];
  let particles = [];
  let hitFlashes = [];
  let screenPulse = 0;
  let missFlash = 0;
  let beatPulse = 0;
  let barPulse = 0;
  let judgeLineFlash = 0;
  let songEnd = 0;
  let last = 0;
  let raf = 0;
  let judgeTimer = 0;

  function laneY(row) {
    return LANE_TOP + row * LANE_H + LANE_H * 0.5;
  }

  function buildChart(song) {
    const rand = HipCore.mulberry32(7000 + song.id * 173);
    const beat = 60 / song.bpm;
    const totalBeats = song.bars * 4;
    const chart = [];
    let t = 1.35;
    let lastRow = -1;

    for (let b = 0; b < totalBeats; b += 1) {
      const dens = 0.42 + song.diff * 0.04;

      if (rand() < dens) {
        chart.push({ time: roundTime(t), row: pickRow(rand, lastRow, song.diff) });
        lastRow = chart[chart.length - 1].row;
      }

      // 가끔 반박자 — 난이도 높을 때만
      if (song.diff >= 2 && rand() < 0.22 + song.diff * 0.03) {
        const row = pickRow(rand, lastRow, song.diff);
        chart.push({ time: roundTime(t + beat * 0.5), row });
        lastRow = row;
      }

      if (song.diff >= 4 && b % 8 === 4 && rand() < 0.28) {
        chart.push({ time: roundTime(t + beat * 0.25), row: pickRow(rand, lastRow, song.diff) });
      }

      t += beat;
    }

    chart.sort((a, b) => a.time - b.time || a.row - b.row);

    const cleaned = [];
    let prev = -1;
    for (const n of chart) {
      if (prev >= 0 && n.time - prev < 0.14) continue;
      cleaned.push(n);
      prev = n.time;
    }
    return cleaned;
  }

  function pickRow(rand, lastRow, diff) {
    let row = Math.floor(rand() * 3);
    if (diff >= 2 && lastRow >= 0 && rand() < 0.55) {
      row = (lastRow + 1 + Math.floor(rand() * 2)) % 3;
    }
    return row;
  }

  function roundTime(t) {
    return +t.toFixed(4);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function songTime() {
    return audio.now();
  }

  function noteProgress(noteTime, now) {
    const start = noteTime - APPROACH;
    if (now < start) return -1;
    if (now > noteTime + GOOD) return 2;
    return Math.min(1, (now - start) / APPROACH);
  }

  function noteX(noteTime, now) {
    const prog = noteProgress(noteTime, now);
    if (prog < 0) return SPAWN_X - NOTE_R;
    // 등속 — 타이밍 읽기 쉬움
    return SPAWN_X + TRACK_W * Math.min(1, Math.max(0, prog));
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (overlays[name]) overlays[name].classList.remove("hidden");
    tapBar.classList.toggle("hidden", name != null);
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

  function buildSongList() {
    const list = document.getElementById("song-list");
    list.innerHTML = "";
    SONGS.forEach((song, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "song-item" + (i === songIndex ? " on" : "");
      btn.innerHTML = `<span>${i + 1}. ${song.name}</span><span class="meta">${song.bpm} BPM · ★${song.diff}</span>`;
      btn.addEventListener("click", () => {
        songIndex = i;
        document.getElementById("pick-label").textContent = `${i + 1}. ${song.name}`;
        list.querySelectorAll(".song-item").forEach((el, j) => el.classList.toggle("on", j === i));
      });
      list.appendChild(btn);
    });
    document.getElementById("pick-label").textContent = `${songIndex + 1}. ${SONGS[songIndex].name}`;
  }

  function resetSong() {
    const song = SONGS[songIndex];
    noteIdx = 0;
    notes = song.chart.map((n, i) => ({
      time: n.time,
      row: n.row,
      idx: i,
      status: "pending",
    }));
    particles = [];
    hitFlashes = [];
    combo = 0;
    maxCombo = 0;
    lives = MAX_LIVES;
    screenPulse = 0;
    missFlash = 0;
    beatPulse = 0;
    barPulse = 0;
    judgeLineFlash = 0;
    songEnd = notes.length ? notes[notes.length - 1].time + 2.8 : 6;
    updateHud();
    audio.playTrack(song.track, song.rate, song.offset);
  }

  function nextNote() {
    while (noteIdx < notes.length && notes[noteIdx].status !== "pending") noteIdx += 1;
    return noteIdx < notes.length ? notes[noteIdx] : null;
  }

  function visibleNotes(now) {
    const out = [];
    for (let i = noteIdx; i < notes.length; i += 1) {
      const n = notes[i];
      if (n.status !== "pending") continue;
      const prog = noteProgress(n.time, now);
      if (prog >= 0 && prog <= 1.15) out.push(n);
      if (out.length >= 8) break;
    }
    return out;
  }

  function showJudge(kind) {
    const labels = { perfect: "PERFECT", good: "GOOD", miss: "MISS" };
    judgeFlash.textContent = labels[kind] || "";
    judgeFlash.className = "judge-flash " + kind;
    clearTimeout(judgeTimer);
    judgeTimer = setTimeout(() => {
      judgeFlash.className = "judge-flash";
      judgeFlash.textContent = "";
    }, 560);

    tapBar.classList.remove("perfect-hit", "good-hit", "miss-hit", "vibe");
    void tapBar.offsetWidth;
    tapBar.classList.add(kind + "-hit", "vibe");
  }

  function spawnHitBurst(row, kind) {
    const x = HIT_X;
    const y = laneY(row);
    const count = kind === "perfect" ? 26 : kind === "good" ? 14 : 10;
    const palette =
      kind === "perfect"
        ? [COLORS.lime, COLORS.cyan, COLORS.magenta]
        : kind === "good"
          ? [COLORS.cyan, COLORS.cyan, COLORS.magenta]
          : [COLORS.magenta];

    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI + (Math.random() - 0.5) * 1.6;
      const speed = 2 + Math.random() * (kind === "perfect" ? 5 : 3);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.35,
        max: 0.45 + Math.random() * 0.35,
        size: 2 + Math.random() * (kind === "perfect" ? 4 : 2.5),
        color: palette[i % palette.length],
      });
    }

    hitFlashes.push({
      x: HIT_X,
      y,
      row,
      life: kind === "perfect" ? 0.55 : kind === "good" ? 0.4 : 0.3,
      max: kind === "perfect" ? 0.55 : kind === "good" ? 0.4 : 0.3,
      kind,
    });

    judgeLineFlash = kind === "perfect" ? 1 : kind === "good" ? 0.7 : 0.5;
  }

  function applyHit(kind) {
    const note = nextNote();
    if (!note) return;

    note.status = kind === "miss" ? "missed" : "hit";
    audio.sfxHit(kind);
    showJudge(kind);
    barPulse = kind === "perfect" ? 1 : kind === "good" ? 0.65 : 0.3;
    spawnHitBurst(note.row, kind);

    if (kind === "perfect") {
      combo += 1;
      score += 320 + combo * 14;
      screenPulse = 1;
    } else if (kind === "good") {
      combo += 1;
      score += 160 + combo * 7;
      screenPulse = 0.55;
    } else {
      combo = 0;
      lives -= 1;
      missFlash = 1;
    }

    maxCombo = Math.max(maxCombo, combo);
    noteIdx += 1;
    updateHud();

    if (lives <= 0) {
      setTimeout(failSong, 400);
    }
  }

  function tryTap() {
    if (state !== "play") return;

    const t = songTime();
    const note = nextNote();
    if (!note) return;

    const delta = t - note.time;
    if (Math.abs(delta) <= PERFECT) {
      applyHit("perfect");
    } else if (Math.abs(delta) <= GOOD) {
      applyHit("good");
    }
  }

  function checkAutoMiss() {
    if (state !== "play") return;
    const t = songTime();
    const note = nextNote();
    if (!note) return;

    if (t > note.time + GOOD) {
      applyHit("miss");
    }
  }

  function checkSongEnd() {
    if (state !== "play") return;
    const t = songTime();
    const allDone = noteIdx >= notes.length;
    if (allDone && t > songEnd) {
      clearSong();
    }
  }

  function clearSong() {
    state = "clear";
    audio.stop();
    showOverlay("clear");
    const song = SONGS[songIndex];
    document.getElementById("clear-title").textContent = `${song.name} 클리어!`;
    document.getElementById("clear-detail").textContent =
      `SCORE ${score.toLocaleString()} · MAX COMBO ${maxCombo} · ${song.bpm} BPM`;
  }

  function failSong() {
    if (state !== "play") return;
    state = "over";
    audio.stop();
    showOverlay("over");
    document.getElementById("over-detail").textContent =
      `SCORE ${score.toLocaleString()} · COMBO ${maxCombo} · ${SONGS[songIndex].name}`;
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "slide-beat", gameTitle: "슬라이드 비트", formParent: document.getElementById("over") });
      TodayGameRank.open(score);
    }
  }

  function startPlay(fresh) {
    state = "play";
    if (fresh) {
      score = 0;
      if (window.TodayGameRank) TodayGameRank.reset();
    }
    showOverlay(null);
    resetSong();
    last = performance.now();
    cancelAnimationFrame(raf);
    loop(last);
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, W, H);

    const grd = ctx.createRadialGradient(W * 0.72, H * 0.42, 20, W * 0.72, H * 0.42, 260);
    grd.addColorStop(0, "rgba(0, 245, 255, 0.07)");
    grd.addColorStop(0.45, "rgba(255, 45, 149, 0.05)");
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    if (missFlash > 0) {
      ctx.fillStyle = `rgba(255, 45, 149, ${missFlash * 0.14})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (screenPulse > 0) {
      ctx.fillStyle = `rgba(200, 255, 0, ${screenPulse * 0.05})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawLaneGrid(now) {
    // thumb-style dark track rail behind lanes
    ctx.fillStyle = "rgba(10, 24, 36, 0.85)";
    ctx.beginPath();
    ctx.roundRect(10, LANE_TOP - 8, W - 20, LANE_BOTTOM - LANE_TOP + 16, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 245, 255, 0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (let row = 0; row < LANES; row += 1) {
      const y = laneY(row);
      const laneTop = LANE_TOP + row * LANE_H;

      ctx.fillStyle = row % 2 === 0 ? "rgba(0, 245, 255, 0.04)" : "rgba(255, 45, 149, 0.035)";
      ctx.fillRect(16, laneTop, W - 32, LANE_H - 2);

      ctx.strokeStyle = hexAlpha(ROW_COLORS[row], 0.28);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(18, y);
      ctx.lineTo(W - 18, y);
      ctx.stroke();

      const tickCount = 8;
      for (let i = 0; i <= tickCount; i += 1) {
        const tx = SPAWN_X + (TRACK_W * i) / tickCount;
        ctx.fillStyle = "rgba(122, 138, 168, 0.16)";
        ctx.fillRect(tx, laneTop + 6, 1, LANE_H - 12);
      }
    }

    const song = SONGS[songIndex];
    const beat = 60 / song.bpm;
    const phase = (now % beat) / beat;
    ctx.fillStyle = `rgba(200, 255, 0, ${0.12 + beatPulse * 0.15})`;
    ctx.fillRect(SPAWN_X, LANE_TOP - 6, TRACK_W * phase, 3);
  }

  function drawJudgeLine() {
    const flash = judgeLineFlash;
    const lead = state === "play" ? nextNote() : null;
    const t = songTime();
    const inPerfect = lead && Math.abs(t - lead.time) <= PERFECT;
    const inGood = lead && Math.abs(t - lead.time) <= GOOD;

    // 넓은 히트 존 (눈에 확 들어오게)
    ctx.fillStyle = inPerfect
      ? "rgba(200, 255, 0, 0.22)"
      : inGood
        ? "rgba(255, 230, 100, 0.14)"
        : "rgba(0, 245, 255, 0.1)";
    ctx.fillRect(HIT_X - ZONE_W / 2, LANE_TOP - 4, ZONE_W, LANE_BOTTOM - LANE_TOP + 8);

    ctx.strokeStyle = inPerfect ? COLORS.lime : inGood ? "#ffe566" : "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(HIT_X - ZONE_W / 2, LANE_TOP - 4, ZONE_W, LANE_BOTTOM - LANE_TOP + 8);

    // 중앙 판정선
    ctx.save();
    if (imgs.hit_line) {
      const h = LANE_BOTTOM - LANE_TOP + 28;
      ctx.globalAlpha = inPerfect ? 1 : 0.9;
      ctx.shadowColor = inPerfect ? COLORS.lime : COLORS.cyan;
      ctx.shadowBlur = 18 + flash * 24;
      ctx.drawImage(imgs.hit_line, HIT_X - 10, LANE_TOP - 14, 20, h);
    } else {
      ctx.strokeStyle = inPerfect ? COLORS.lime : "#ffffff";
      ctx.lineWidth = 4 + flash * 3;
      ctx.shadowColor = inPerfect ? COLORS.lime : COLORS.cyan;
      ctx.shadowBlur = 18 + flash * 24;
      ctx.beginPath();
      ctx.moveTo(HIT_X, LANE_TOP - 10);
      ctx.lineTo(HIT_X, LANE_BOTTOM + 10);
      ctx.stroke();
    }
    ctx.restore();

    // 라벨
    ctx.fillStyle = inPerfect ? COLORS.lime : "rgba(255,255,255,0.7)";
    ctx.font = '700 12px "Chakra Petch", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(inPerfect ? "지금!" : "HIT", HIT_X, LANE_TOP - 16);
  }

  function drawNoteTrail(x, y, color, prog) {
    const trailLen = 40 + prog * 20;
    const grad = ctx.createLinearGradient(x - trailLen, y, x, y);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.4, hexAlpha(color, 0.1));
    grad.addColorStop(1, hexAlpha(color, 0.55));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x - trailLen * 0.35, y, trailLen * 0.5, NOTE_R * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function hexAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function drawNotes(now) {
    const visible = visibleNotes(now);
    const lead = nextNote();

    // 다음 칠 노트 레인 강조
    if (lead && lead.status === "pending") {
      const ly = laneY(lead.row);
      const laneTop = LANE_TOP + lead.row * LANE_H;
      ctx.fillStyle = "rgba(200, 255, 0, 0.07)";
      ctx.fillRect(12, laneTop + 2, W - 24, LANE_H - 4);
      ctx.fillStyle = ROW_COLORS[lead.row];
      ctx.font = '700 11px "Chakra Petch", sans-serif';
      ctx.textAlign = "left";
      ctx.fillText("▶ 이 줄", 16, ly + 4);
    }

    visible.forEach((note) => {
      const prog = noteProgress(note.time, now);
      if (prog < 0 || prog > 1.15) return;

      const x = noteX(note.time, now);
      const y = laneY(note.row);
      const color = ROW_COLORS[note.row];
      const isLead = lead && note.idx === lead.idx;
      const delta = now - note.time;
      const inPerfect = Math.abs(delta) <= PERFECT;
      const inGood = Math.abs(delta) <= GOOD;
      const inZone = Math.abs(x - HIT_X) <= ZONE_W * 0.55;
      const scale = isLead
        ? 1 + (inPerfect ? 0.22 : inGood || inZone ? 0.12 : 0)
        : 0.88;

      drawNoteTrail(x, y, color, prog);

      ctx.save();
      ctx.globalAlpha = isLead ? 1 : 0.45;

      const noteImg = imgs[NOTE_KEYS[note.row]];
      const drawR = NOTE_R * scale;

      if (noteImg) {
        ctx.shadowColor = inPerfect ? COLORS.lime : color;
        ctx.shadowBlur = isLead ? 26 : 8;
        const s = drawR * 2.4;
        ctx.drawImage(noteImg, x - s / 2, y - s / 2, s, s);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, drawR + 10, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(inPerfect ? COLORS.lime : color, isLead ? 0.2 : 0.08);
        ctx.shadowColor = inPerfect ? COLORS.lime : color;
        ctx.shadowBlur = isLead ? 26 : 8;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, drawR, 0, Math.PI * 2);
        ctx.fillStyle = inPerfect ? COLORS.lime : color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, drawR, 0, Math.PI * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = isLead ? 3 : 1.5;
        ctx.shadowBlur = 0;
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(x - 5, y - 5, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isLead && inZone) {
        ctx.strokeStyle = inPerfect ? COLORS.lime : "#ffe566";
        ctx.lineWidth = 4;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(x, y, drawR + 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    });

    // 하단 안내
    if (lead && lead.status === "pending") {
      const delta = now - lead.time;
      let cue = "노트가 노란 칸에 들어오면 탭";
      let col = "rgba(200,210,230,0.75)";
      if (Math.abs(delta) <= PERFECT) {
        cue = "지금 탭!";
        col = COLORS.lime;
      } else if (Math.abs(delta) <= GOOD) {
        cue = "거의…!";
        col = "#ffe566";
      }
      ctx.fillStyle = col;
      ctx.font = `700 ${Math.abs(delta) <= PERFECT ? 22 : 14}px "Chakra Petch", sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = col;
      ctx.shadowBlur = Math.abs(delta) <= PERFECT ? 16 : 0;
      ctx.fillText(cue, W / 2, LANE_BOTTOM + 36);
      ctx.shadowBlur = 0;
    }
  }

  function drawHitFlashes(dt) {
    hitFlashes = hitFlashes.filter((f) => {
      f.life -= dt;
      if (f.life <= 0) return false;
      const a = f.life / f.max;
      const color =
        f.kind === "perfect" ? COLORS.lime : f.kind === "good" ? COLORS.cyan : COLORS.magenta;

      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 + (1 - a) * 4;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(f.x, f.y, NOTE_R + 10 + (1 - a) * 30, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = hexAlpha(color, a * 0.35);
      ctx.fillRect(f.x - 2, LANE_TOP, 4, LANE_BOTTOM - LANE_TOP);
      ctx.restore();
      return true;
    });
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.vx *= 0.97;
      const a = p.life / p.max;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      return true;
    });
  }

  function updateBeatPulse(now) {
    const song = SONGS[songIndex];
    const beat = 60 / song.bpm;
    const phase = (now % beat) / beat;
    beatPulse = phase < 0.12 ? 1 - phase / 0.12 : beatPulse * 0.9;
  }

  function drawTitleIdle(now) {
    drawLaneGrid(now);
    drawJudgeLine();

    for (let row = 0; row < LANES; row += 1) {
      const y = laneY(row);
      const phase = (now * 0.4 + row * 0.33) % 1;
      const x = SPAWN_X + TRACK_W * phase;
      const color = ROW_COLORS[row];
      drawNoteTrail(x, y, color, phase);
      ctx.beginPath();
      ctx.arc(x, y, NOTE_R * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(200, 210, 230, 0.8)";
    ctx.font = '600 13px "Chakra Petch", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("노트가 오른쪽 HIT 칸에 들어오면 탭", W / 2, LANE_BOTTOM + 36);
  }

  function drawFrame(now, dt) {
    drawBackground();
    if (state === "play") {
      drawLaneGrid(now);
      drawJudgeLine();
      drawNotes(now);
      drawHitFlashes(dt);
      drawParticles(dt);
      updateBeatPulse(now);
    } else if (state === "title") {
      drawTitleIdle(now);
    }

    screenPulse *= 0.9;
    missFlash *= 0.88;
    barPulse *= 0.85;
    judgeLineFlash *= 0.88;
  }

  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;

    if (state === "play") {
      checkAutoMiss();
      checkSongEnd();
    }

    drawFrame(songTime(), dt);
    raf = requestAnimationFrame(loop);
  }

  function bindEvents() {
    document.getElementById("start-btn").addEventListener("click", () => {
      audio.ensure();
      startPlay(true);
    });

    document.getElementById("next-btn").addEventListener("click", () => {
      if (songIndex < SONGS.length - 1) {
        songIndex += 1;
        startPlay();
      } else {
        state = "allclear";
        showOverlay("all");
        document.getElementById("all-detail").textContent =
          `20곡 올클리어! · TOTAL SCORE ${score.toLocaleString()} · MAX COMBO ${maxCombo}`;
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "slide-beat", gameTitle: "슬라이드 비트", formParent: document.getElementById("allclear") });
      TodayGameRank.open(score);
    }
      }
    });

    document.getElementById("retry-btn").addEventListener("click", () => startPlay(true));

    document.getElementById("menu-btn").addEventListener("click", () => {
      state = "title";
      audio.stop();
      showOverlay("title");
      buildSongList();
    });

    document.getElementById("menu-btn2").addEventListener("click", () => {
      state = "title";
      audio.stop();
      showOverlay("title");
      buildSongList();
    });

    document.getElementById("again-btn").addEventListener("click", () => {
      songIndex = 0;
      score = 0;
      state = "title";
      showOverlay("title");
      buildSongList();
    });

    tapBar.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      tryTap();
    });

    canvas.addEventListener("pointerdown", (e) => {
      if (state !== "play") return;
      const rect = canvas.getBoundingClientRect();
      const sy = ((e.clientY - rect.top) / rect.height) * H;
      if (sy < LANE_BOTTOM + 20) tryTap();
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "KeyJ") {
        e.preventDefault();
        if (state === "title") {
          audio.ensure();
          startPlay(true);
        } else {
          tryTap();
        }
      }
    });
  }

  function init() {
    buildSongList();
    showOverlay("title");
    last = performance.now();
    bindEvents();
    loadAssets().then(() => {
      raf = requestAnimationFrame(loop);
    });
  }

  init();

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "slide-beat",
      gameTitle: "슬라이드 비트",
      formParent: document.getElementById("over") || document.body,
    });
  }
})();
