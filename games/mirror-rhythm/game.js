(() => {
  "use strict";

  const LANE_COLORS = ["#00f5ff", "#7b5cfa", "#ff2d95", "#ffe156"];
  const KEYMAP = { q: 0, w: 1, o: 2, p: 3 };
  const HIT = { perfect: 70, great: 122, good: 180 };
  const TRAVEL = 1500;
  const HIT_BOTTOM = 82;

  const audio = window.HipCore ? HipCore.createAudio("mirror-rhythm") : null;
  const FALLBACK_SONG = { id: 0, name: "미러 코어", bpm: 120, rate: 1, track: 0, offset: 0, diff: 1 };
  const SONGS = window.HipCore ? HipCore.buildSongList(20, 91, "mirror-rhythm") : [FALLBACK_SONG];
  let songIndex = 0;
  function currentSong() {
    return SONGS[songIndex] || SONGS[0] || FALLBACK_SONG;
  }

  const field = document.getElementById("field");
  const judgePop = document.getElementById("judge-pop");
  const laneEls = [0, 1, 2, 3].map((i) => document.querySelector(`.lane[data-lane="${i}"]`));
  const pads = [...document.querySelectorAll(".pad")];
  const overlays = {
    title: document.getElementById("title"),
    count: document.getElementById("count"),
    over: document.getElementById("over"),
  };
  const chickImg = new Image();
  chickImg.src = "assets/chick.png";
  const thumbImg = new Image();
  thumbImg.src = "assets/thumb.png";

  let state = "title";
  let chart = [];
  let songLen = 40000;
  let combo = 0;
  let maxCombo = 0;
  let score = 0;
  let hits = 0;
  let total = 0;
  let startTime = 0;
  let pauseAccum = 0;
  let pauseAt = 0;
  let rafId = 0;

  function gameNow() {
    if (state === "paused") return pauseAt - startTime - pauseAccum;
    return performance.now() - startTime - pauseAccum;
  }

  function show(id) {
    Object.keys(overlays).forEach((key) => overlays[key].classList.toggle("hidden", key !== id));
  }

  function hideAll() {
    Object.keys(overlays).forEach((key) => overlays[key].classList.add("hidden"));
  }

  function sfx(kind) {
    if (audio && audio.sfxHit) audio.sfxHit(kind);
  }

  function mulberry(a) {
    return function rand() {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildChart(song) {
    const beat = 60000 / song.bpm;
    const notes = [];
    const rnd = mulberry(777001 + song.id * 97);
    let t = 2200;
    let lastL = 0;
    let lastR = 2;
    const bars = 16 + song.diff * 3;
    for (let bar = 0; bar < bars; bar += 1) {
      const densL = bar < 3 ? 0.42 : 0.52 + song.diff * 0.05;
      const densR = bar < 3 ? 0.38 : 0.48 + song.diff * 0.05;
      for (let b = 0; b < 4; b += 1) {
        if (rnd() < densL) {
          let lane = rnd() > 0.5 ? 0 : 1;
          if (lane === lastL) lane = 1 - lane;
          lastL = lane;
          notes.push({ time: t, lane, hit: false, missed: false, el: null });
        }
        if (rnd() < densR) {
            const off = bar > 6 && song.diff >= 2 && rnd() > 0.62 ? beat * 0.5 : 0;
          let lane = rnd() > 0.5 ? 2 : 3;
          if (lane === lastR) lane = lane === 2 ? 3 : 2;
          lastR = lane;
          notes.push({ time: t + off, lane, hit: false, missed: false, el: null });
        }
        t += beat;
      }
    }
    notes.sort((a, b) => a.time - b.time);
    return notes;
  }

  function mountNotes() {
    laneEls.forEach((lane) => lane.querySelectorAll(".note").forEach((n) => n.remove()));
    chart.forEach((n) => {
      const el = document.createElement("div");
      el.className = "note";
      el.style.background = `linear-gradient(180deg, ${LANE_COLORS[n.lane]}, transparent)`;
      el.style.boxShadow = `0 0 10px ${LANE_COLORS[n.lane]}`;
      el.style.display = "none";
      laneEls[n.lane].appendChild(el);
      n.el = el;
    });
  }

  function acc() {
    return total ? Math.round((hits / total) * 100) : 100;
  }

  function updateHud() {
    document.getElementById("combo-text").innerHTML = `${combo}<small>COMBO</small>`;
    document.getElementById("score-text").textContent = String(score);
    document.getElementById("acc-text").textContent = `ACC ${acc()}%`;
  }

  function popJudge(text, color) {
    judgePop.textContent = text;
    judgePop.style.color = color;
    judgePop.classList.remove("show");
    void judgePop.offsetWidth;
    judgePop.classList.add("show");
  }

  function rankFor(value) {
    if (value >= 95) return "S";
    if (value >= 85) return "A";
    if (value >= 70) return "B";
    if (value >= 50) return "C";
    return "D";
  }

  function judgeHit(diff) {
    total += 1;
    if (diff <= HIT.perfect) {
      hits += 1;
      combo += 1;
      score += 320 + combo * 2;
      popJudge("PERFECT", "#c8ff00");
      sfx("perfect");
    } else if (diff <= HIT.great) {
      hits += 1;
      combo += 1;
      score += 160 + combo;
      popJudge("GREAT", "#00f5ff");
      sfx("good");
    } else if (diff <= HIT.good) {
      hits += 1;
      combo += 1;
      score += 70;
      popJudge("GOOD", "#ffe156");
      sfx("good");
    } else {
      registerMiss(false);
      return;
    }
    maxCombo = Math.max(maxCombo, combo);
    updateHud();
  }

  function registerMiss(countTotal) {
    if (countTotal !== false) total += 1;
    combo = 0;
    popJudge("MISS", "#ff4d6d");
    field.classList.remove("shake");
    void field.offsetWidth;
    field.classList.add("shake");
    sfx("miss");
    updateHud();
  }

  function tryHitLane(lane) {
    if (state !== "play") return;
    const now = gameNow();
    let best = null;
    let bestDiff = Infinity;
    for (let i = 0; i < chart.length; i += 1) {
      const n = chart[i];
      if (n.hit || n.missed || n.lane !== lane) continue;
      const diff = Math.abs(n.time - now);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = n;
      }
    }
    if (best && bestDiff <= HIT.good) {
      best.hit = true;
      best.el.style.display = "none";
      judgeHit(bestDiff);
    }
  }

  function loop() {
    if (state !== "play") return;
    const now = gameNow();
    const fieldH = field.clientHeight;
    const hitY = fieldH - HIT_BOTTOM;
    for (let i = 0; i < chart.length; i += 1) {
      const n = chart[i];
      if (n.hit) continue;
      const dt = n.time - now;
      if (dt < -300 && !n.missed) {
        n.missed = true;
        n.el.style.display = "none";
        registerMiss();
        continue;
      }
      if (dt > TRAVEL || dt < -300) {
        n.el.style.display = "none";
        continue;
      }
      n.el.style.display = "block";
      n.el.style.top = `${Math.max(-30, (1 - dt / TRAVEL) * hitY - 12)}px`;
    }
    if (now > songLen + 400) {
      endGame();
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function endGame() {
    if (state === "over") return;
    state = "over";
    cancelAnimationFrame(rafId);
    if (audio) audio.stop();
    const a = acc();
    const rank = rankFor(a);
    document.getElementById("rank-text").textContent = rank;
    document.getElementById("over-score").textContent = `SCORE ${score}`;
    document.getElementById("over-combo").textContent = `MAX COMBO ${maxCombo}`;
    document.getElementById("over-acc").textContent = `ACC ${a}%`;
    show("over");
    if (window.TodayGameRank) {
      TodayGameRank.mount({
        gameId: "mirror-rhythm",
        gameTitle: "미러 리듬",
        formParent: overlays.over,
      });
      TodayGameRank.open(score);
    }
  }

  function resetStats() {
    combo = 0;
    maxCombo = 0;
    score = 0;
    hits = 0;
    total = 0;
    pauseAccum = 0;
    const selected = currentSong();
    chart = buildChart(selected);
    songLen = (chart[chart.length - 1] ? chart[chart.length - 1].time : 28000) + 1600;
    mountNotes();
    updateHud();
    const chip = document.getElementById("song-chip");
    if (chip) chip.textContent = selected.name;
    if (window.TodayGameRank) TodayGameRank.reset();
  }

  function beginPlay() {
    hideAll();
    state = "play";
    startTime = performance.now();
    pauseAccum = 0;
    if (audio) audio.playTrack(currentSong().track, currentSong().rate, currentSong().offset);
    rafId = requestAnimationFrame(loop);
  }

  function runCountdown() {
    resetStats();
    state = "count";
    show("count");
    const seq = ["3", "2", "1", "시작!"];
    let i = 0;
    const num = document.getElementById("count-num");
    const tick = () => {
      if (state !== "count") return;
      if (i >= seq.length) {
        beginPlay();
        return;
      }
      num.textContent = seq[i];
      i += 1;
      setTimeout(tick, i === seq.length ? 420 : 680);
    };
    tick();
  }

  function drawCard() {
    const cvs = document.getElementById("share-canvas");
    const cx = cvs.getContext("2d");
    const a = acc();
    const rank = rankFor(a);
    const g = cx.createLinearGradient(0, 0, 640, 360);
    g.addColorStop(0, "#1a1040");
    g.addColorStop(1, "#070714");
    cx.fillStyle = g;
    cx.fillRect(0, 0, 640, 360);
    cx.strokeStyle = "rgba(0,245,255,.55)";
    cx.lineWidth = 3;
    cx.strokeRect(14, 14, 612, 332);
    if (thumbImg.complete) {
      cx.save();
      cx.beginPath();
      cx.arc(88, 188, 54, 0, Math.PI * 2);
      cx.clip();
      cx.drawImage(chickImg.complete ? chickImg : thumbImg, 34, 134, 108, 108);
      cx.restore();
    }
    cx.fillStyle = "#8ea0c4";
    cx.font = "16px sans-serif";
    cx.fillText("오늘의게임 · 미러 리듬", 160, 58);
    cx.fillStyle = "#ffe156";
    cx.font = "bold 96px Arial";
    cx.fillText(rank, 160, 170);
    cx.fillStyle = "#eef6ff";
    cx.font = "bold 22px Arial";
    cx.fillText(`SCORE ${score}`, 300, 128);
    cx.fillText(`MAX COMBO ${maxCombo}`, 300, 164);
    cx.fillText(`ACCURACY ${a}%`, 300, 200);
    cx.fillText(`TRACK ${currentSong().name}`, 300, 236);
    cx.fillStyle = "#00f5ff";
    cx.font = "16px sans-serif";
    cx.fillText("https://www.todaygame.co.kr/games/mirror-rhythm/", 32, 318);
    return cvs;
  }

  function saveCard() {
    const cvs = drawCard();
    const link = document.createElement("a");
    link.download = "mirror-rhythm-result.png";
    link.href = cvs.toDataURL("image/png");
    link.click();
  }

  async function shareKakao() {
    const btn = document.getElementById("kakao-btn");
    if (!window.TodayScores || !TodayScores.shareToKakao) return;
    const a = acc();
    const rank = rankFor(a);
    const result = await TodayScores.shareToKakao({
      gameId: "mirror-rhythm",
      gameTitle: "미러 리듬",
      title: `미러 리듬 ${rank} · ${currentSong().name}`,
      description: `SCORE ${score} · MAX COMBO ${maxCombo} · ACC ${a}%`,
      score,
      scoreLabel: `${Number(score).toLocaleString("ko-KR")}점`,
      canvas: drawCard(),
      buttonTitle: "나도 연주하기",
    });
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = result.ok ? "공유 창 열림" : "공유 실패";
    setTimeout(() => {
      btn.textContent = prev;
    }, 1600);
  }

  pads.forEach((btn) => {
    const lane = Number(btn.dataset.lane);
    const act = (e) => {
      e.preventDefault();
      btn.classList.add("active");
      laneEls[lane].classList.add("flash");
      laneEls[lane].style.setProperty("--c", LANE_COLORS[lane]);
      tryHitLane(lane);
      setTimeout(() => {
        btn.classList.remove("active");
        laneEls[lane].classList.remove("flash");
      }, 90);
    };
    btn.addEventListener("touchstart", act, { passive: false });
    btn.addEventListener("mousedown", act);
  });

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (!(k in KEYMAP)) return;
    e.preventDefault();
    const lane = KEYMAP[k];
    pads[lane].classList.add("active");
    tryHitLane(lane);
    setTimeout(() => pads[lane].classList.remove("active"), 90);
  });

  function syncSongList() {
    const list = document.getElementById("song-list");
    const label = document.getElementById("pick-label");
    if (!list || !label) return;
    list.innerHTML = "";
    SONGS.forEach((item, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "song-item" + (i === songIndex ? " on" : "");
      btn.innerHTML = `<span>${i + 1}. ${item.name}</span><span class="meta">${item.bpm} BPM · ★${item.diff}</span>`;
      btn.addEventListener("click", () => {
        songIndex = i;
        syncSongList();
        const chip = document.getElementById("song-chip");
        if (chip) chip.textContent = currentSong().name;
      });
      list.appendChild(btn);
    });
    label.textContent = `${songIndex + 1}. ${currentSong().name}`;
    const on = list.querySelector(".song-item.on");
    if (on) on.scrollIntoView({ block: "nearest" });
  }

  function playSelected() {
    if (audio) audio.ensure();
    runCountdown();
  }

  function backToMenu() {
    if (audio) audio.stop();
    state = "title";
    show("title");
    syncSongList();
  }

  document.getElementById("start-btn").addEventListener("click", playSelected);
  document.getElementById("retry-btn").addEventListener("click", playSelected);
  document.getElementById("next-btn").addEventListener("click", () => {
    songIndex = (songIndex + 1) % SONGS.length;
    syncSongList();
    playSelected();
  });
  document.getElementById("menu-btn").addEventListener("click", backToMenu);
  document.getElementById("save-btn").addEventListener("click", saveCard);
  document.getElementById("kakao-btn").addEventListener("click", shareKakao);

  updateHud();
  syncSongList();

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "mirror-rhythm",
      gameTitle: "미러 리듬",
      formParent: overlays.over,
    });
  }

  if (window.TodayPause) {
    TodayPause.mount({
      pauseKey: "esc",
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        pauseAt = performance.now();
        state = "paused";
        if (audio && audio.pause) audio.pause();
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        pauseAccum += performance.now() - pauseAt;
        state = "play";
        if (audio && audio.resume) audio.resume();
        rafId = requestAnimationFrame(loop);
        return true;
      },
    });
  }
})();
