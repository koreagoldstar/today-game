(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const CX = W / 2;
  const CY = H * 0.34;
  const TARGET_R = 62;
  const OUTER_R = 155;
  const APPROACH = 1.15;
  const PERFECT = 0.08;
  const GOOD = 0.15;
  const MAX_LIVES = 5;
  const SEED = 4242;

  const COLORS = {
    cyan: "#00f5ff",
    magenta: "#ff2d95",
    lime: "#c8ff00",
    void: "#05050c",
    dim: "rgba(122, 138, 168, 0.35)",
  };

  const imgs = {
    pulse_target: null,
    orb_cyan: null,
    orb_magenta: null,
    orb_lime: null,
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

  const SONGS = HipCore.buildSongList(20, SEED, "beat-tap").map((song) => ({
    ...song,
    chart: buildChart(song),
  }));

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  const audio = HipCore.createAudio("beat-tap");

  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    over: document.getElementById("over"),
    all: document.getElementById("allclear"),
  };

  const tapPad = document.getElementById("tap-pad");
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
  let rings = [];
  let screenPulse = 0;
  let missFlash = 0;
  let beatPulse = 0;
  let padPulse = 0;
  let songEnd = 0;
  let last = 0;
  let raf = 0;
  let judgeTimer = 0;

  function buildChart(song) {
    const rand = HipCore.mulberry32(9000 + song.id * 131);
    const beat = 60 / song.bpm;
    const totalBeats = song.bars * 4;
    const chart = [];
    let t = 1.1;

    for (let b = 0; b < totalBeats; b += 1) {
      const dens = 0.72 + song.diff * 0.05;

      if (rand() < dens) {
        chart.push({ time: roundTime(t) });
      }

      if (rand() < 0.58 + song.diff * 0.04) {
        chart.push({ time: roundTime(t + beat * 0.5) });
      }

      if (song.diff >= 2 && rand() < 0.14) {
        chart.push({ time: roundTime(t + beat * 0.25) });
      }

      if (b % 4 === 0 && rand() < 0.22) {
        chart.push({ time: roundTime(t + beat * 0.75) });
      }

      if (song.diff >= 3 && b % 8 === 4 && rand() < 0.35) {
        chart.push({ time: roundTime(t + beat * 0.5) });
        chart.push({ time: roundTime(t + beat * 0.75) });
      }

      t += beat;
    }

    chart.sort((a, b) => a.time - b.time);

    const cleaned = [];
    let prev = -1;
    for (const n of chart) {
      if (prev >= 0 && n.time - prev < 0.08) continue;
      cleaned.push(n);
      prev = n.time;
    }
    return cleaned;
  }

  function roundTime(t) {
    return +t.toFixed(4);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function songTime() {
    return audio.now();
  }

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (overlays[name]) overlays[name].classList.remove("hidden");
    tapPad.classList.toggle("hidden", name != null);
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
      idx: i,
      status: "pending",
    }));
    particles = [];
    rings = [];
    combo = 0;
    maxCombo = 0;
    lives = MAX_LIVES;
    screenPulse = 0;
    missFlash = 0;
    beatPulse = 0;
    padPulse = 0;
    songEnd = notes.length ? notes[notes.length - 1].time + 2.5 : 6;
    updateHud();
    audio.playTrack(song.track, song.rate, song.offset);
  }

  function nextNote() {
    while (noteIdx < notes.length && notes[noteIdx].status !== "pending") noteIdx += 1;
    return noteIdx < notes.length ? notes[noteIdx] : null;
  }

  function upcomingNotes(count) {
    const out = [];
    for (let i = noteIdx; i < notes.length && out.length < count; i += 1) {
      if (notes[i].status === "pending") out.push(notes[i]);
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

    tapPad.classList.remove("perfect-hit", "good-hit", "miss-hit", "vibe");
    void tapPad.offsetWidth;
    tapPad.classList.add(kind + "-hit", "vibe");
  }

  function spawnPerfectBurst() {
    const count = 28;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 2.2 + Math.random() * 4.5;
      particles.push({
        x: CX,
        y: CY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.55 + Math.random() * 0.35,
        max: 0.55 + Math.random() * 0.35,
        size: 2 + Math.random() * 4,
        color: i % 3 === 0 ? COLORS.lime : i % 3 === 1 ? COLORS.cyan : COLORS.magenta,
      });
    }
    for (let i = 0; i < 3; i += 1) {
      rings.push({
        r: TARGET_R,
        maxR: TARGET_R + 90 + i * 24,
        life: 0.5,
        max: 0.5,
        color: [COLORS.lime, COLORS.cyan, COLORS.magenta][i],
      });
    }
  }

  function spawnGoodBurst() {
    for (let i = 0; i < 12; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2.5;
      particles.push({
        x: CX,
        y: CY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35,
        max: 0.35,
        size: 2 + Math.random() * 2,
        color: COLORS.cyan,
      });
    }
  }

  function applyHit(kind) {
    const note = nextNote();
    if (!note) return;

    note.status = kind === "miss" ? "missed" : "hit";
    audio.sfxHit(kind);
    showJudge(kind);
    padPulse = kind === "perfect" ? 1 : kind === "good" ? 0.65 : 0.3;

    if (kind === "perfect") {
      combo += 1;
      score += 300 + combo * 12;
      screenPulse = 1;
      spawnPerfectBurst();
    } else if (kind === "good") {
      combo += 1;
      score += 150 + combo * 6;
      screenPulse = 0.6;
      spawnGoodBurst();
    } else {
      combo = 0;
      lives -= 1;
      missFlash = 1;
      rings.push({ r: TARGET_R, maxR: TARGET_R + 60, life: 0.35, max: 0.35, color: COLORS.magenta });
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
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "beat-tap", gameTitle: "펄스 탭", formParent: document.getElementById("over") });
      TodayGameRank.open(score);
    }
    document.getElementById("over-detail").textContent =
      `SCORE ${score.toLocaleString()} · COMBO ${maxCombo} · ${SONGS[songIndex].name}`;
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

  function ringProgress(noteTime, now) {
    const start = noteTime - APPROACH;
    if (now < start) return -1;
    if (now > noteTime + GOOD) return 2;
    return Math.min(1, (now - start) / APPROACH);
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, W, H);

    const grd = ctx.createRadialGradient(CX, CY, 20, CX, CY, 220);
    grd.addColorStop(0, "rgba(0, 245, 255, 0.06)");
    grd.addColorStop(0.5, "rgba(255, 45, 149, 0.04)");
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    if (missFlash > 0) {
      ctx.fillStyle = `rgba(255, 45, 149, ${missFlash * 0.12})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (screenPulse > 0) {
      ctx.fillStyle = `rgba(200, 255, 0, ${screenPulse * 0.06})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawTargetRing(inWindow) {
    const pulse = 1 + beatPulse * 0.03 + padPulse * 0.05 + (inWindow ? 0.06 : 0);
    const r = TARGET_R * pulse;

    // 바깥 가이드 (목표 크기 미리 보기)
    ctx.beginPath();
    ctx.arc(CX, CY, OUTER_R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (imgs.pulse_target) {
      const size = (r + 28) * 2;
      ctx.save();
      ctx.translate(CX, CY);
      ctx.globalAlpha = inWindow ? 1 : 0.92;
      ctx.shadowColor = inWindow ? COLORS.lime : COLORS.cyan;
      ctx.shadowBlur = inWindow ? 28 : 16;
      if (inWindow) ctx.filter = "hue-rotate(-40deg) saturate(1.2) brightness(1.15)";
      ctx.drawImage(imgs.pulse_target, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    // 퍼펙트 존 띠 (목표 링 두께)
    ctx.beginPath();
    ctx.arc(CX, CY, r + 10, 0, Math.PI * 2);
    ctx.strokeStyle = inWindow ? "rgba(200, 255, 0, 0.45)" : "rgba(0, 245, 255, 0.18)";
    ctx.lineWidth = 18;
    ctx.stroke();

    // 목표 링 (두껍고 밝게)
    ctx.beginPath();
    ctx.arc(CX, CY, r, 0, Math.PI * 2);
    ctx.strokeStyle = inWindow ? COLORS.lime : "#ffffff";
    ctx.lineWidth = inWindow ? 10 : 8;
    ctx.shadowColor = inWindow ? COLORS.lime : COLORS.cyan;
    ctx.shadowBlur = inWindow ? 28 : 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 안쪽 채움
    ctx.beginPath();
    ctx.arc(CX, CY, r - 6, 0, Math.PI * 2);
    ctx.fillStyle = inWindow ? "rgba(200, 255, 0, 0.16)" : "rgba(0, 245, 255, 0.08)";
    ctx.fill();

    // 센터 점
    ctx.beginPath();
    ctx.arc(CX, CY, 8, 0, Math.PI * 2);
    ctx.fillStyle = inWindow ? COLORS.lime : COLORS.magenta;
    ctx.shadowColor = inWindow ? COLORS.lime : COLORS.magenta;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function approachColor(prog, inWindow) {
    if (inWindow) return COLORS.lime;
    if (prog > 0.82) return "#ffe566";
    if (prog > 0.55) return COLORS.magenta;
    return "#ff6eb5";
  }

  function drawApproachRings(now) {
    const upcoming = upcomingNotes(2);
    let inWindow = false;
    let leadProg = -1;
    let leadDelta = 99;

    upcoming.forEach((note, layer) => {
      const prog = ringProgress(note.time, now);
      if (prog < 0 || prog > 1.25) return;

      const delta = now - note.time;
      const near = Math.abs(delta) <= GOOD;
      if (layer === 0) {
        leadProg = prog;
        leadDelta = delta;
        inWindow = Math.abs(delta) <= PERFECT;
      }

      const eased = easeOutCubic(Math.min(1, Math.max(0, prog)));
      const radius = OUTER_R - (OUTER_R - TARGET_R) * eased;
      const color = approachColor(prog, layer === 0 && inWindow);
      const alpha = layer === 0 ? 1 : 0.28;

      // 채워진 원 — 크기가 한눈에
      if (layer === 0) {
        ctx.beginPath();
        ctx.arc(CX, CY, radius, 0, Math.PI * 2);
        ctx.fillStyle = near
          ? "rgba(200, 255, 0, 0.12)"
          : "rgba(255, 45, 149, 0.1)";
        ctx.fill();
      }

      // 두꺼운 접근 링
      ctx.beginPath();
      ctx.arc(CX, CY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = layer === 0 ? 12 : 5;
      ctx.shadowColor = color;
      ctx.shadowBlur = layer === 0 ? 22 : 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // 목표와 겹치는 정도를 선으로 표시
      if (layer === 0) {
        const gap = Math.abs(radius - TARGET_R);
        ctx.beginPath();
        ctx.arc(CX, CY, TARGET_R, 0, Math.PI * 2);
        ctx.strokeStyle = gap < 14
          ? `rgba(200, 255, 0, ${Math.max(0.2, 1 - gap / 14)})`
          : "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = gap < 14 ? 6 : 2;
        ctx.stroke();
      }
    });

    // 탭 타이밍 문구
    if (leadProg >= 0) {
      drawTapCue(leadProg, leadDelta, inWindow);
    }

    return inWindow;
  }

  function drawTapCue(prog, delta, inWindow) {
    const abs = Math.abs(delta);
    let label = "";
    let color = COLORS.cyan;

    if (inWindow) {
      label = "지금!";
      color = COLORS.lime;
    } else if (abs <= GOOD && delta < 0) {
      label = "준비…";
      color = "#ffe566";
    } else if (prog > 0.55 && delta < 0) {
      label = "모이는 중";
      color = COLORS.magenta;
    } else if (delta > GOOD) {
      label = "";
    }

    if (!label) return;

    ctx.save();
    ctx.font = `700 ${inWindow ? 34 : 22}px "Chakra Petch", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = inWindow ? 24 : 10;
    ctx.globalAlpha = inWindow ? 1 : 0.9;
    ctx.fillText(label, CX, CY + TARGET_R + 48);
    ctx.restore();
  }

  function drawTimingMeter(now) {
    const note = nextNote();
    const barW = W * 0.78;
    const barH = 14;
    const x0 = (W - barW) / 2;
    const y = H * 0.58;

    // 배경
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    roundRect(x0, y, barW, barH, 7);
    ctx.fill();

    // 퍼펙트 존 (끝부분)
    const perfectW = barW * (PERFECT / APPROACH) * 2;
    const goodW = barW * (GOOD / APPROACH) * 2;
    ctx.fillStyle = "rgba(255, 230, 100, 0.25)";
    ctx.fillRect(x0 + barW - goodW, y, goodW, barH);
    ctx.fillStyle = "rgba(200, 255, 0, 0.45)";
    ctx.fillRect(x0 + barW - perfectW, y, perfectW, barH);

    // 히트 라인
    ctx.fillStyle = "#fff";
    ctx.fillRect(x0 + barW - 2, y - 4, 3, barH + 8);

    if (!note) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = '600 12px "Chakra Petch", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("타이밍 게이지 →", CX, y + 32);
      return;
    }

    const prog = ringProgress(note.time, now);
    if (prog < 0) return;

    const markerX = x0 + Math.min(1, Math.max(0, prog)) * barW;
    const inPerfect = Math.abs(now - note.time) <= PERFECT;
    const inGood = Math.abs(now - note.time) <= GOOD;

    // 진행 채움
    ctx.fillStyle = inPerfect
      ? "rgba(200, 255, 0, 0.55)"
      : inGood
        ? "rgba(255, 230, 100, 0.4)"
        : "rgba(255, 45, 149, 0.45)";
    roundRect(x0, y, Math.max(4, markerX - x0), barH, 7);
    ctx.fill();

    // 마커
    ctx.beginPath();
    ctx.arc(markerX, y + barH / 2, 9, 0, Math.PI * 2);
    ctx.fillStyle = inPerfect ? COLORS.lime : "#fff";
    ctx.shadowColor = inPerfect ? COLORS.lime : COLORS.magenta;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(200, 210, 230, 0.7)";
    ctx.font = '600 11px "Chakra Petch", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("점이 오른쪽 끝에 오면 탭!", CX, y + 32);
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawExpandingRings(dt) {
    rings = rings.filter((ring) => {
      ring.life -= dt;
      if (ring.life <= 0) return false;
      const p = 1 - ring.life / ring.max;
      ring.r = ring.r + (ring.maxR - ring.r) * easeInOutQuad(p) * 0.08 + 1.2;
      ctx.beginPath();
      ctx.arc(CX, CY, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color;
      ctx.globalAlpha = ring.life / ring.max;
      ctx.lineWidth = 3;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      return true;
    });
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.vx *= 0.98;
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
    beatPulse = phase < 0.12 ? 1 - phase / 0.12 : beatPulse * 0.92;
  }

  function drawFrame(now, dt) {
    drawBackground();
    if (state === "play") {
      const inWindow = drawApproachRings(now);
      drawTargetRing(inWindow);
      drawTimingMeter(now);
      drawExpandingRings(dt);
      drawParticles(dt);
      updateBeatPulse(now);
    } else if (state === "title") {
      drawTargetRing(false);
      const idle = Math.sin(performance.now() / 500) * 0.5 + 0.5;
      const r = OUTER_R - (OUTER_R - TARGET_R) * idle;
      ctx.beginPath();
      ctx.arc(CX, CY, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 45, 149, ${0.35 + idle * 0.4})`;
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.fillStyle = "rgba(200, 210, 230, 0.75)";
      ctx.font = '600 14px "Chakra Petch", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("바깥 원이 안쪽 원에 닿을 때 탭", CX, CY + TARGET_R + 56);
    }

    screenPulse *= 0.9;
    missFlash *= 0.88;
    padPulse *= 0.85;
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
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "beat-tap", gameTitle: "펄스 탭", formParent: document.getElementById("allclear") });
      TodayGameRank.open(score);
    }
        document.getElementById("all-detail").textContent =
          `20곡 올클리어! · TOTAL SCORE ${score.toLocaleString()} · MAX COMBO ${maxCombo}`;
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

    tapPad.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      tryTap();
    });

    canvas.addEventListener("pointerdown", (e) => {
      if (state !== "play") return;
      const rect = canvas.getBoundingClientRect();
      const sx = ((e.clientX - rect.left) / rect.width) * W;
      const sy = ((e.clientY - rect.top) / rect.height) * H;
      const dist = Math.hypot(sx - CX, sy - CY);
      if (dist < OUTER_R + 30) tryTap();
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (state === "title") {
          audio.ensure();
          startPlay(true);
        } else {
          tryTap();
        }
      }
    });

    window.addEventListener("blur", () => {
      if (state === "play") {
        /* keep running */
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
      gameId: "beat-tap",
      gameTitle: "펄스 탭",
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
