(() => {
  "use strict";

  const W = 390;
  const H = 700;
  const LANES = 4;
  const LANE_W = W / LANES;
  const HIT_Y = 500;
  const SPAWN_Y = -40;
  const APPROACH = 1.95;
  const PERFECT_MS = 90;
  const GOOD_MS = 175;
  const MAX_LIVES = 5;
  const NOTE_SIZE = 46;
  const LANE_COLORS = ["#ff4d9a", "#ffc14d", "#00e8ff", "#b44dff"];
  const NOTE_KEYS = ["note_pink", "note_yellow", "note_cyan", "note_purple"];
  const PAD_KEYS = ["pad_pink", "pad_yellow", "pad_cyan", "pad_purple"];

  const CODE_LANES = {
    KeyD: 0,
    KeyF: 1,
    KeyJ: 2,
    KeyK: 3,
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
    Digit4: 3,
  };

  // 리듬 톡톡 전용 트랙 (다른 리듬 게임과 겹치지 않음)
  const TRACKS = [
    { src: "/assets/audio/hip/cyber02.mp3", baseBpm: 110 },
    { src: "/assets/audio/hip/cyber05.mp3", baseBpm: 128 },
    { src: "/assets/audio/hip/cyber06.mp3", baseBpm: 132 },
    { src: "audio/cyber02.mp3", baseBpm: 110 },
    { src: "audio/cyber05.mp3", baseBpm: 128 },
    { src: "audio/cyber06.mp3", baseBpm: 132 },
  ];

  const CYBER_NAMES = [
    "네온 오버드라이브",
    "사이버 펄스",
    "그리드 러너",
    "홀로그램 레이브",
    "데이터 스톰",
    "핑크 와이어",
    "메가 바이트 드롭",
    "글리치 시티",
    "레이저 하이웨이",
    "나이트 서킷",
    "크로마 킥",
    "버추얼 레이브",
    "신스웨이브 맥스",
    "제로 쿨다운",
    "하이퍼 링크",
    "픽셀 애시드",
    "퀀텀 비트",
    "미러넷 러시",
    "볼트 댄서",
    "코어 멜트다운",
    "스펙트럴 펀치",
    "네온 카타나",
    "부트 시퀀스",
    "오버클럭",
    "사이버 드래곤",
    "플럭스 캐논",
    "인피니티 루프",
    "다크넷 파티",
    "홀로 비트",
    "레트로 퓨처",
    "아크 라이트",
    "스파크 레인",
    "바이너리 붐",
    "펄스 캐논",
    "네온 독스",
    "슈퍼노바 링크",
    "크로노 브레이크",
    "일렉트릭 섀도우",
    "메가 서버",
    "썬더 프로토콜",
    "글리치 펀치",
    "사이버 츄잉",
    "로드 러너 2099",
    "미러볼 매트릭스",
    "골든 오버클럭",
    "나이트 레이스",
    "퍼플 그리드",
    "플래시 뱅",
    "피날레 드롭",
    "엔딩 크레센도",
  ];

  const SONG_META = CYBER_NAMES.map((name, i) => {
    const track = i % TRACKS.length;
    // 빠른 사이버 템포: 재생 배속으로 BPM 끌어올림
    const rate = Math.min(1.55, 1.2 + (i % 8) * 0.04 + (i % 3) * 0.025);
    const bpm = Math.round(Math.min(180, Math.max(150, TRACKS[track].baseBpm * rate)));
    const diff = Math.min(4, 1 + Math.floor(i / 12) + (i % 5 === 4 ? 1 : 0));
    return {
      name,
      bpm,
      style: "cyber",
      diff,
      track,
      rate,
      offset: (i * 11) % 24,
    };
  });

  const PATTERNS = {
    1: [[0], [1], [2], [3], [0, 2], [1, 3]],
    2: [[0], [1], [2], [3], [0, 1], [2, 3], [0, 2], [1, 3], [1, 2]],
    3: [[0], [1], [2], [3], [0, 1], [1, 2], [2, 3], [0, 3], [0, 2], [1, 3], [0, 1, 2]],
    4: [[0], [1], [2], [3], [0, 1], [1, 2], [2, 3], [0, 3], [0, 2], [1, 3], [0, 1, 2], [1, 2, 3], [0, 1, 3]],
  };

  function mulberry32(a) {
    return function rand() {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildChart(meta, index) {
    const rand = mulberry32(9000 + index * 97);
    const beat = 60 / meta.bpm;
    const bars = 10 + meta.diff * 2 + Math.floor(rand() * 3);
    const dens = 0.42 + meta.diff * 0.12;
    const pool = PATTERNS[Math.min(4, meta.diff)] || PATTERNS[2];
    const chart = [];
    let t = 1.0;
    for (let b = 0; b < bars * 4; b += 1) {
      if (rand() < dens) {
        const lanes = pool[Math.floor(rand() * pool.length)];
        for (const lane of lanes) {
          chart.push({ lane, time: +(t + (rand() - 0.5) * 0.02).toFixed(3) });
        }
      }
      // occasional 8th note flourish
      if (meta.diff >= 2 && rand() < 0.18) {
        chart.push({ lane: Math.floor(rand() * 4), time: +(t + beat * 0.5).toFixed(3) });
      }
      t += beat;
    }
    chart.sort((a, b) => a.time - b.time || a.lane - b.lane);
    // dedupe same lane same time
    const cleaned = [];
    const seen = new Set();
    for (const n of chart) {
      const key = `${n.lane}:${n.time.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(n);
    }
    return { ...meta, chart: cleaned };
  }

  const SONGS = SONG_META.map((m, i) => buildChart(m, i));

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

  const imgs = {
    note_pink: null,
    note_yellow: null,
    note_cyan: null,
    note_purple: null,
    pad_pink: null,
    pad_yellow: null,
    pad_cyan: null,
    pad_purple: null,
    stage_bg: null,
    mascot_cat: null,
    mascot_penguin: null,
    tap_ring: null,
    chick: null,
  };
  let audioCtx = null;
  let musicNodes = [];
  let musicTimer = null;
  let musicBeat = 0;
  let musicAudio = null;
  let useSynthFallback = false;

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
  let laneFlash = [0, 0, 0, 0];
  let screenPulse = 0;
  let missFlash = 0;
  let beatPulse = 0;
  let last = 0;
  let raf = 0;
  let songEnd = 0;

  const lanePads = document.getElementById("lane-pads");
  const comboBurst = document.getElementById("combo-burst");
  const comboBig = document.getElementById("hud-combo-big");

  function showOverlay(name) {
    Object.values(overlays).forEach((el) => el.classList.add("hidden"));
    if (overlays[name]) overlays[name].classList.remove("hidden");
    lanePads.classList.toggle("hidden", name != null);
  }

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

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function tone(freq, dur, type, vol, when) {
    if (!audioCtx) return;
    const t0 = when != null ? when : audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    musicNodes.push(osc);
  }

  function noiseHit(dur, vol, when) {
    if (!audioCtx) return;
    const t0 = when != null ? when : audioCtx.currentTime;
    const len = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;
    src.buffer = buf;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    musicNodes.forEach((n) => {
      try {
        n.stop();
      } catch (_) {
        /* ignore */
      }
    });
    musicNodes = [];
    if (musicAudio) {
      try {
        musicAudio.pause();
        musicAudio.removeAttribute("src");
        musicAudio.load();
      } catch (_) {
        /* ignore */
      }
      musicAudio = null;
    }
    useSynthFallback = false;
  }

  function startCyberSynth(song) {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    if (musicAudio) {
      try {
        musicAudio.pause();
      } catch (_) {
        /* ignore */
      }
      musicAudio = null;
    }
    ensureAudio();
    musicBeat = 0;
    useSynthFallback = true;
    const stepMs = (60 / song.bpm) * 1000 * 0.5;
    // 미성 사이버: 수퍼소우 느낌 스케일 + 빠른 아르페지오
    const scale = [311.13, 369.99, 415.3, 466.16, 554.37, 622.25, 739.99, 830.61];
    const bassProg = [77.78, 92.5, 103.83, 116.54];

    musicTimer = setInterval(() => {
      if (state !== "play" || !audioCtx) return;
      const t = audioCtx.currentTime;
      const step = musicBeat % 16;
      const bar = Math.floor(musicBeat / 16) % 4;

      if (step % 4 === 0) {
        tone(95, 0.08, "sine", 0.22, t);
        tone(48, 0.14, "triangle", 0.14, t);
      }
      if (step % 2 === 1) noiseHit(0.03, 0.06, t);
      if (step === 4 || step === 12) {
        noiseHit(0.1, 0.11, t);
        tone(220, 0.06, "square", 0.04, t);
      }
      if (step % 2 === 0) {
        const root = bassProg[bar % bassProg.length];
        tone(root, 0.15, "sawtooth", 0.07, t);
        tone(root * 2, 0.1, "square", 0.03, t);
      }
      // 빠른 사이버 아르페지오
      const note = scale[(musicBeat * 3 + bar) % scale.length];
      tone(note, 0.08, "square", 0.055, t);
      tone(note * 1.5, 0.07, "sawtooth", 0.03, t + 0.02);
      if (step === 0 || step === 8) tone(scale[(bar + 5) % scale.length] * 2, 0.1, "square", 0.035, t);
      if (bar === 3 && step >= 12) tone(280 + (step - 12) * 90, 0.07, "sawtooth", 0.03, t);

      beatPulse = step % 4 === 0 ? 1 : 0.4;
      musicBeat += 1;
    }, stepMs);
  }

  function startMusic(song) {
    stopMusic();
    ensureAudio();
    const track = TRACKS[song.track] || TRACKS[0];
    const audio = new Audio(track.src);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0.78;
    try {
      audio.playbackRate = song.rate || 1.2;
    } catch (_) {
      /* older browsers */
    }
    const startAt = Math.max(0, song.offset || 0);
    const tryPlay = () => {
      audio.currentTime = startAt;
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => startCyberSynth(song));
      }
    };
    audio.addEventListener(
      "error",
      () => {
        startCyberSynth(song);
      },
      { once: true }
    );
    if (audio.readyState >= 2) tryPlay();
    else {
      audio.addEventListener("canplay", tryPlay, { once: true });
      audio.load();
    }
    musicAudio = audio;

    // 비트 펄스용 가벼운 메트로놈 펄스 (실제 사운드는 트랙)
    musicBeat = 0;
    const stepMs = (60 / song.bpm) * 1000 * 0.5;
    musicTimer = setInterval(() => {
      if (state !== "play") return;
      beatPulse = musicBeat % 4 === 0 ? 1 : 0.35;
      musicBeat += 1;
    }, stepMs);
  }

  function playHit(kind) {
    ensureAudio();
    if (kind === "perfect") {
      tone(988, 0.07, "sine", 0.1);
      tone(1319, 0.08, "triangle", 0.06);
    } else if (kind === "good") {
      tone(740, 0.07, "sine", 0.08);
    } else {
      tone(180, 0.12, "sawtooth", 0.07);
    }
  }

  function laneCenter(lane) {
    return lane * LANE_W + LANE_W / 2;
  }

  function noteSpeed() {
    return (HIT_Y - SPAWN_Y) / APPROACH;
  }

  function resetSong() {
    const song = SONGS[songIndex];
    songTime = -0.6;
    spawnIdx = 0;
    notes = [];
    particles = [];
    floats = [];
    rings = [];
    laneFlash = [0, 0, 0, 0];
    screenPulse = 0;
    missFlash = 0;
    beatPulse = 0;
    combo = 0;
    lives = MAX_LIVES;
    songEnd = song.chart.length ? song.chart[song.chart.length - 1].time + 2.8 : 8;
    updateHud();
    startMusic(song);
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
        lane: c.lane,
        hitTime: c.time,
        y: SPAWN_Y,
        hit: false,
        missed: false,
        color: spawnIdx % 2 === 0 ? "pink" : "blue",
      });
      spawnIdx += 1;
    }
  }

  function addParticles(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2,
        life: 0.45 + Math.random() * 0.35,
        color,
        size: 2.5 + Math.random() * 3.5,
      });
    }
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, life: 0.9, vy: -1.15 });
  }

  function registerMiss(lane) {
    combo = 0;
    lives -= 1;
    missFlash = 0.35;
    laneFlash[lane] = 0.3;
    playHit("miss");
    addFloat(laneXAt(lane, HIT_Y), HIT_Y - 30, "Miss", "#ff6b7a");
    flashPad(lane);
    updateHud();
    if (lives <= 0) {
      stopMusic();
      state = "over";
      document.getElementById("over-detail").textContent = `점수 ${score} · 최대 콤보 ${maxCombo}`;
      showOverlay("over");
      if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "rhythm", gameTitle: "리듬 톡톡", formParent: document.getElementById("over") });
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

  function flashPad(lane) {
    const btn = lanePads.querySelector(`[data-lane="${lane}"]`);
    if (!btn) return;
    btn.classList.add("flash");
    clearTimeout(btn._flashT);
    btn._flashT = setTimeout(() => btn.classList.remove("flash"), 120);
  }

  function tapLane(lane) {
    if (state !== "play") return;
    ensureAudio();
    laneFlash[lane] = 0.25;
    flashPad(lane);
    rings.push({ lane, life: 0.4, scale: 0.55 });

    let best = null;
    let bestDelta = Infinity;
    for (const note of notes) {
      if (note.hit || note.missed || note.lane !== lane) continue;
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
    const x = laneXAt(lane, HIT_Y);
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    const mult = 1 + Math.floor(combo / 10) * 0.12;
    score += kind === "perfect" ? Math.round(320 * mult) : Math.round(160 * mult);
    playHit(kind);

    if (kind === "perfect") {
      screenPulse = 0.3;
      addParticles(x, HIT_Y, "#ffe066", 16);
      addFloat(x, HIT_Y - 42, "Perfect!", "#ffd700");
    } else {
      addParticles(x, HIT_Y, "#3ee0c0", 9);
      addFloat(x, HIT_Y - 38, "Good", "#fff");
    }
    if (combo >= 5 && combo % 5 === 0) addFloat(W / 2, 190, `${combo} COMBO!`, "#ff5f87");
    updateHud();
  }

  function updateNotes() {
    const speed = noteSpeed();
    for (const note of notes) {
      if (note.hit) continue;
      note.y = HIT_Y - (note.hitTime - songTime) * speed;
      if (!note.missed && songTime - note.hitTime > GOOD_MS / 1000) {
        note.missed = true;
        registerMiss(note.lane);
      }
    }
    notes = notes.filter((n) => !n.hit && !(n.missed && n.y > H + 40));
  }

  function checkSongEnd() {
    const allDone = spawnIdx >= SONGS[songIndex].chart.length && notes.length === 0;
    if (allDone && songTime >= songEnd - 1.5) {
      stopMusic();
      state = "clear";
      if (songIndex >= SONGS.length - 1) {
        document.getElementById("all-detail").textContent = `50곡 완주! 총점 ${score} · 최대 콤보 ${maxCombo}`;
        showOverlay("all");
        if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "rhythm", gameTitle: "리듬 톡톡", formParent: document.getElementById("allclear") });
      TodayGameRank.open(score);
    }
      } else {
        document.getElementById("clear-title").textContent = `${SONGS[songIndex].name} 클리어!`;
        document.getElementById("clear-detail").textContent =
          `점수 ${score} · BPM ${SONGS[songIndex].bpm} · 콤보 ${maxCombo}`;
        showOverlay("clear");
      }
    }
  }

  function laneXAt(lane, y) {
    // perspective: lanes widen toward bottom
    const t = Math.max(0, Math.min(1, (y + 40) / (HIT_Y + 40)));
    const topInset = 78;
    const botInset = 8;
    const inset = topInset + (botInset - topInset) * t;
    const usable = W - inset * 2;
    return inset + (lane + 0.5) * (usable / LANES);
  }

  function laneWidthAt(y) {
    const t = Math.max(0, Math.min(1, (y + 40) / (HIT_Y + 40)));
    const topInset = 78;
    const botInset = 8;
    const inset = topInset + (botInset - topInset) * t;
    return (W - inset * 2) / LANES;
  }

  function drawBackground() {
    ctx.clearRect(0, 0, W, H);
    const pulse = beatPulse;

    if (imgs.stage_bg) {
      ctx.globalAlpha = 0.55 + pulse * 0.08;
      ctx.drawImage(imgs.stage_bg, 0, 0, W, H * 0.72);
      ctx.globalAlpha = 1;
      const fade = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.78);
      fade.addColorStop(0, "rgba(5,6,16,0)");
      fade.addColorStop(1, "rgba(5,6,16,0.92)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, H * 0.45, W, H * 0.35);
    }

    // vanishing point / stage star glow
    const vg = ctx.createRadialGradient(W / 2, 90, 10, W / 2, 120, 220);
    vg.addColorStop(0, `rgba(180,100,255,${0.32 + pulse * 0.22})`);
    vg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // perspective track
    for (let i = 0; i < LANES; i += 1) {
      const color = LANE_COLORS[i];
      ctx.beginPath();
      const x0 = laneXAt(i, -20) - laneWidthAt(-20) * 0.45;
      const x1 = laneXAt(i, -20) + laneWidthAt(-20) * 0.45;
      const x2 = laneXAt(i, HIT_Y + 40) + laneWidthAt(HIT_Y + 40) * 0.48;
      const x3 = laneXAt(i, HIT_Y + 40) - laneWidthAt(HIT_Y + 40) * 0.48;
      ctx.moveTo(x0, 70);
      ctx.lineTo(x1, 70);
      ctx.lineTo(x2, HIT_Y + 50);
      ctx.lineTo(x3, HIT_Y + 50);
      ctx.closePath();
      const lg = ctx.createLinearGradient(0, 70, 0, HIT_Y);
      lg.addColorStop(0, "rgba(255,255,255,0.02)");
      lg.addColorStop(1, hexAlpha(color, 0.14 + pulse * 0.1));
      ctx.fillStyle = lg;
      ctx.fill();
      ctx.strokeStyle = hexAlpha(color, 0.4 + pulse * 0.28);
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // mascots flanking track
    if (imgs.mascot_cat) {
      ctx.globalAlpha = 0.92;
      ctx.drawImage(imgs.mascot_cat, -8, H * 0.38, 92, 92);
      ctx.globalAlpha = 1;
    }
    if (imgs.mascot_penguin) {
      ctx.globalAlpha = 0.92;
      ctx.drawImage(imgs.mascot_penguin, W - 84, H * 0.38, 92, 92);
      ctx.globalAlpha = 1;
    } else if (imgs.chick) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(imgs.chick, W - 78, H * 0.4, 72, 72);
      ctx.globalAlpha = 1;
    }

    // judgment line
    const jg = ctx.createLinearGradient(0, HIT_Y - 18, 0, HIT_Y + 18);
    jg.addColorStop(0, "rgba(255,255,255,0)");
    jg.addColorStop(0.5, `rgba(255,255,255,${0.35 + pulse * 0.35})`);
    jg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = jg;
    ctx.fillRect(6, HIT_Y - 18, W - 12, 36);

    ctx.strokeStyle = `rgba(255,255,255,${0.75 + pulse * 0.25})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(180,140,255,0.8)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(16, HIT_Y);
    ctx.lineTo(W - 16, HIT_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // receptors
    for (let i = 0; i < LANES; i += 1) {
      const x = laneXAt(i, HIT_Y);
      const flash = laneFlash[i];
      const padImg = imgs[PAD_KEYS[i]];
      const r = 26 + flash * 10;
      if (padImg) {
        ctx.save();
        ctx.translate(x, HIT_Y);
        ctx.globalAlpha = 0.75 + flash * 0.25;
        ctx.shadowColor = LANE_COLORS[i];
        ctx.shadowBlur = 10 + flash * 18;
        ctx.drawImage(padImg, -r, -r, r * 2, r * 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, HIT_Y, 22 + flash * 10, 0, Math.PI * 2);
        ctx.strokeStyle = hexAlpha(LANE_COLORS[i], 0.55 + flash * 0.45);
        ctx.lineWidth = 3 + flash * 4;
        ctx.shadowColor = LANE_COLORS[i];
        ctx.shadowBlur = 12 + flash * 20;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, HIT_Y, 8, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(LANE_COLORS[i], 0.35 + flash * 0.5);
        ctx.fill();
        ctx.shadowBlur = 0;
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

  function drawNotes() {
    for (const note of notes) {
      if (note.hit) continue;
      const progress = Math.max(0, Math.min(1.2, (note.y + 40) / (HIT_Y + 40)));
      const x = laneXAt(note.lane, note.y);
      const scale = 0.45 + progress * 0.7;
      const size = NOTE_SIZE * scale;
      const color = LANE_COLORS[note.lane];

      // trail
      ctx.strokeStyle = hexAlpha(color, 0.35);
      ctx.lineWidth = 4 * scale;
      ctx.beginPath();
      ctx.moveTo(x, note.y - 28 * scale);
      ctx.lineTo(x, note.y + 4);
      ctx.stroke();

      ctx.save();
      ctx.translate(x, note.y);
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      const img = imgs[NOTE_KEYS[note.lane]];
      if (img) {
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-size / 2, -size * 0.28, size, size * 0.56, 10);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawFX() {
    for (const ring of rings) {
      const alpha = ring.life / 0.4;
      const x = laneXAt(ring.lane, HIT_Y);
      const size = 70 * ring.scale;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = LANE_COLORS[ring.lane];
      ctx.lineWidth = 4;
      ctx.shadowColor = LANE_COLORS[ring.lane];
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(x, HIT_Y, size / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < LANES; i += 1) {
      if (laneFlash[i] > 0) {
        const x = laneXAt(i, HIT_Y);
        const w = laneWidthAt(HIT_Y);
        ctx.fillStyle = hexAlpha(LANE_COLORS[i], laneFlash[i] * 0.35);
        ctx.fillRect(x - w * 0.45, HIT_Y - 70, w * 0.9, 120);
      }
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.font = f.text.includes("COMBO") ? 'bold 24px "Bagel Fat One", Jua' : 'bold 20px "Bagel Fat One", Jua';
      ctx.fillStyle = f.color;
      ctx.shadowColor = "rgba(0,0,0,0.45)";
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
      ctx.fillStyle = `rgba(255,255,255,${screenPulse * 0.12})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (missFlash > 0) {
      ctx.fillStyle = `rgba(255,60,100,${missFlash * 0.2})`;
      ctx.fillRect(0, 0, W, H);
    }
    drawNotes();
    drawFX();
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    beatPulse = Math.max(0, beatPulse - dt * 3.2);

    if (state === "play") {
      songTime += dt;
      spawnNotes();
      updateNotes();
      particles = particles.filter((p) => {
        p.life -= dt;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.14;
        return p.life > 0;
      });
      floats = floats.filter((f) => {
        f.life -= dt;
        f.y += f.vy;
        return f.life > 0;
      });
      rings = rings.filter((r) => {
        r.life -= dt;
        r.scale += dt * 1.8;
        return r.life > 0;
      });
      for (let i = 0; i < LANES; i += 1) laneFlash[i] = Math.max(0, laneFlash[i] - dt);
      screenPulse = Math.max(0, screenPulse - dt);
      missFlash = Math.max(0, missFlash - dt);
      checkSongEnd();
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
    stopMusic();
    state = "title";
    showOverlay("title");
    syncSongList();
  }

  function laneFromX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / Math.max(1, rect.width)) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < LANES; i += 1) {
      const d = Math.abs(px - laneXAt(i, HIT_Y));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function syncSongList() {
    const list = document.getElementById("song-list");
    const label = document.getElementById("pick-label");
    list.innerHTML = "";
    SONGS.forEach((song, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "song-item" + (i === songIndex ? " on" : "");
      btn.innerHTML = `<span>${i + 1}. ${song.name}</span><span class="bpm">BPM ${song.bpm}</span>`;
      btn.addEventListener("click", () => {
        songIndex = i;
        label.textContent = `${i + 1}. ${song.name}`;
        syncSongList();
      });
      list.appendChild(btn);
    });
    label.textContent = `${songIndex + 1}. ${SONGS[songIndex].name}`;
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (state !== "play") return;
      e.preventDefault();
      tapLane(laneFromX(e.clientX));
    },
    { passive: false }
  );

  lanePads.querySelectorAll(".lane-pad").forEach((btn) => {
    const fire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      tapLane(Number(btn.dataset.lane));
    };
    btn.addEventListener("pointerdown", fire);
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const lane = CODE_LANES[e.code];
    if (lane != null) {
      e.preventDefault();
      tapLane(lane);
    }
  });

  document.getElementById("start-btn").addEventListener("click", () => {
    ensureAudio();
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

  loadAssets().then(() => {
    syncSongList();
    showOverlay("title");
    last = performance.now();
    raf = requestAnimationFrame(tick);
  });

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "rhythm",
      gameTitle: "리듬 톡톡",
      formParent: document.getElementById("over") || document.body,
    });
  }
})();
