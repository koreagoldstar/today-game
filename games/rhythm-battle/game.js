(() => {
  "use strict";

  const LANES = 4;
  const LANE_COLORS = ["#00f5ff", "#7b5cfa", "#ffe156", "#ff2d95"];
  const KEYMAP = { d: 0, f: 1, j: 2, k: 3 };
  const HIT = { perfect: 78, great: 138, good: 196 };
  const TRAVEL = 1680;
  const HIT_BOTTOM = 86;

  const audio = window.HipCore ? HipCore.createAudio("rhythm-battle") : null;
  const FALLBACK_SONG = { id: 0, name: "배틀 아레나", bpm: 128, rate: 1, track: 0, offset: 0, diff: 1 };
  const SONGS = window.HipCore ? HipCore.buildSongList(20, 42, "rhythm-battle") : [FALLBACK_SONG];
  let songIndex = 0;
  function currentSong() {
    return SONGS[songIndex] || SONGS[0] || FALLBACK_SONG;
  }

  const lanesEl = document.getElementById("lanes");
  const field = document.getElementById("field");
  const judgePop = document.getElementById("judge-pop");
  const hitline = document.getElementById("hitline");
  const pads = [...document.querySelectorAll(".pad")];
  const overlays = {
    title: document.getElementById("title"),
    count: document.getElementById("count"),
    over: document.getElementById("over"),
  };

  const laneEls = [];
  for (let i = 0; i < LANES; i += 1) {
    const d = document.createElement("div");
    d.className = "lane";
    d.style.setProperty("--lc", LANE_COLORS[i]);
    lanesEl.appendChild(d);
    laneEls.push(d);
  }

  let state = "title";
  let chart = [];
  let songLen = 40000;
  let meHp = 100;
  let rivalHp = 100;
  let combo = 0;
  let maxCombo = 0;
  let score = 0;
  let startTime = 0;
  let pauseAccum = 0;
  let pauseAt = 0;
  let rafId = 0;
  let won = false;

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
    const rnd = mulberry(20260911 + song.id * 131);
    let t = 2400;
    let lastLane = 0;
    const bars = 18 + song.diff * 3;
    const dens0 = 0.36 + song.diff * 0.055;
    for (let bar = 0; bar < bars; bar += 1) {
      const dens = bar < 3 ? dens0 * 0.7 : dens0;
      for (let b = 0; b < 4; b += 1) {
        if (rnd() < dens) {
          let lane = Math.floor(rnd() * LANES);
          if (lane === lastLane) lane = (lane + 1 + Math.floor(rnd() * 3)) % LANES;
          lastLane = lane;
          notes.push({ time: t, lane, hit: false, missed: false, el: null });
        }
        if (bar > 4 && song.diff >= 2 && rnd() > 0.84) {
          const lane2 = (lastLane + 2) % LANES;
          notes.push({ time: t + beat * 0.5, lane: lane2, hit: false, missed: false, el: null });
        }
        t += beat;
      }
    }
    notes.sort((a, b) => a.time - b.time);
    return notes;
  }

  function mountNotes() {
    laneEls.forEach((lane) => {
      lane.querySelectorAll(".note").forEach((n) => n.remove());
    });
    chart.forEach((n) => {
      const el = document.createElement("div");
      el.className = "note";
      el.style.background = `linear-gradient(180deg, ${LANE_COLORS[n.lane]}, transparent)`;
      el.style.boxShadow = `0 0 12px ${LANE_COLORS[n.lane]}`;
      el.style.display = "none";
      laneEls[n.lane].appendChild(el);
      n.el = el;
    });
  }

  function updateHud() {
    meHp = Math.max(0, Math.min(100, meHp));
    rivalHp = Math.max(0, Math.min(100, rivalHp));
    document.getElementById("me-hp").style.width = `${meHp}%`;
    document.getElementById("rival-hp").style.width = `${rivalHp}%`;
    document.getElementById("me-hp-text").textContent = String(Math.round(meHp));
    document.getElementById("rival-hp-text").textContent = String(Math.round(rivalHp));
    document.getElementById("combo-text").innerHTML = `${combo}<small>COMBO</small>`;
    document.getElementById("score-text").textContent = String(score);
  }

  function popJudge(text, color) {
    judgePop.textContent = text;
    judgePop.style.color = color;
    judgePop.classList.remove("show");
    void judgePop.offsetWidth;
    judgePop.classList.add("show");
  }

  function burstAt(lane) {
    const laneEl = laneEls[lane];
    const rect = laneEl.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    for (let i = 0; i < 10; i += 1) {
      const b = document.createElement("div");
      b.className = "burst";
      b.style.background = LANE_COLORS[lane];
      b.style.left = `${rect.left - fieldRect.left + rect.width / 2}px`;
      b.style.top = `${fieldRect.height - 96}px`;
      field.appendChild(b);
      const ang = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 34;
      b.animate(
        [
          { transform: "translate(0,0)", opacity: 1 },
          { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px)`, opacity: 0 },
        ],
        { duration: 420, easing: "ease-out" }
      );
      setTimeout(() => b.remove(), 440);
    }
  }

  function bumpFace(id) {
    const el = document.getElementById(id);
    el.classList.remove("hit");
    void el.offsetWidth;
    el.classList.add("hit");
  }

  function checkEnd() {
    if (rivalHp <= 0) endGame(true);
    else if (meHp <= 0) endGame(false);
  }

  function judgeHit(diff, lane) {
    if (diff <= HIT.perfect) {
      rivalHp -= 4.4;
      combo += 1;
      score += 300 + combo * 3;
      popJudge("PERFECT", "#c8ff00");
      burstAt(lane);
      sfx("perfect");
      if (combo >= 8 && combo % 4 === 0) meHp = Math.min(100, meHp + 1.6);
    } else if (diff <= HIT.great) {
      rivalHp -= 2.6;
      combo += 1;
      score += 160 + combo;
      popJudge("GREAT", "#00f5ff");
      burstAt(lane);
      sfx("good");
    } else if (diff <= HIT.good) {
      rivalHp -= 1.1;
      combo += 1;
      score += 70;
      popJudge("GOOD", "#ffe156");
      sfx("good");
    } else {
      registerMiss();
      return;
    }
    maxCombo = Math.max(maxCombo, combo);
    bumpFace("face-rival");
    hitline.classList.remove("pulse");
    void hitline.offsetWidth;
    hitline.classList.add("pulse");
    updateHud();
    checkEnd();
  }

  function registerMiss() {
    combo = 0;
    meHp -= 3.6;
    popJudge("MISS", "#ff4d6d");
    field.classList.remove("shake");
    void field.offsetWidth;
    field.classList.add("shake");
    bumpFace("face-me");
    sfx("miss");
    updateHud();
    checkEnd();
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
      judgeHit(bestDiff, lane);
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
      if (dt < -320 && !n.missed) {
        n.missed = true;
        n.el.style.display = "none";
        registerMiss();
        if (state !== "play") return;
        continue;
      }
      if (dt > TRAVEL || dt < -320) {
        n.el.style.display = "none";
        continue;
      }
      n.el.style.display = "block";
      const progress = 1 - dt / TRAVEL;
      n.el.style.top = `${Math.max(-30, progress * hitY - 14)}px`;
    }

    const pct = Math.max(0, Math.min(100, (now / songLen) * 100));
    document.getElementById("progress").style.width = `${pct}%`;

    if (now > songLen + 400) {
      endGame(meHp >= rivalHp);
      return;
    }

    rafId = requestAnimationFrame(loop);
  }

  function endGame(win) {
    if (state === "over") return;
    state = "over";
    won = win;
    cancelAnimationFrame(rafId);
    if (audio) audio.stop();
    document.getElementById("over-art").src = win ? "assets/chick.png" : "assets/fox.png";
    document.getElementById("over-badge").textContent = win ? "WIN" : "LOSE";
    document.getElementById("over-badge").classList.toggle("soft", win);
    document.getElementById("over-title").textContent = win ? "승리!" : "아쉬워요";
    document.getElementById("over-detail").textContent = win
      ? "삐약이가 폭스를 이겼어요!"
      : "폭스에게 졌어요. 한 판 더!";
    document.getElementById("over-score").textContent = `SCORE ${score}`;
    document.getElementById("over-combo").textContent = `MAX COMBO ${maxCombo}`;
    show("over");
    if (window.TodayGameRank) {
      TodayGameRank.mount({
        gameId: "rhythm-battle",
        gameTitle: "리듬 배틀",
        formParent: overlays.over,
      });
      TodayGameRank.open(score);
    }
  }

  function resetStats() {
    meHp = 100;
    rivalHp = 100;
    combo = 0;
    maxCombo = 0;
    score = 0;
    pauseAccum = 0;
    const selected = currentSong();
    chart = buildChart(selected);
    songLen = (chart[chart.length - 1] ? chart[chart.length - 1].time : 30000) + 1800;
    mountNotes();
    updateHud();
    document.getElementById("progress").style.width = "0%";
    document.getElementById("song-chip").textContent = selected.name;
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

  pads.forEach((btn) => {
    const lane = Number(btn.dataset.lane);
    const activate = (e) => {
      e.preventDefault();
      btn.classList.add("active");
      laneEls[lane].classList.add("flash");
      tryHitLane(lane);
      setTimeout(() => {
        btn.classList.remove("active");
        laneEls[lane].classList.remove("flash");
      }, 90);
    };
    btn.addEventListener("touchstart", activate, { passive: false });
    btn.addEventListener("mousedown", activate);
  });

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (!(k in KEYMAP)) return;
    e.preventDefault();
    const lane = KEYMAP[k];
    pads[lane].classList.add("active");
    laneEls[lane].classList.add("flash");
    tryHitLane(lane);
    setTimeout(() => {
      pads[lane].classList.remove("active");
      laneEls[lane].classList.remove("flash");
    }, 90);
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
        document.getElementById("song-chip").textContent = currentSong().name;
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

  document.getElementById("share-btn").addEventListener("click", async () => {
    const btn = document.getElementById("share-btn");
    if (!window.TodayScores || !TodayScores.shareToKakao) return;
    const outcome = won ? "승리" : "패배";
    const canvas = TodayScores.makeResultCard
      ? TodayScores.makeResultCard({
          eyebrow: "오늘의게임 · 리듬 배틀",
          title: currentSong().name,
          hero: outcome,
          lines: [`SCORE ${score}`, `MAX COMBO ${maxCombo}`],
          bg0: "#081828",
          bg1: "#070714",
          accent: won ? "#ffe156" : "#ff2d95",
        })
      : null;
    const result = await TodayScores.shareToKakao({
      gameId: "rhythm-battle",
      gameTitle: "리듬 배틀",
      title: `리듬 배틀 ${outcome} · ${currentSong().name}`,
      description: `SCORE ${score} · MAX COMBO ${maxCombo}`,
      score,
      scoreLabel: `${Number(score).toLocaleString("ko-KR")}점`,
      canvas,
      buttonTitle: "나도 대결하기",
    });
    const prev = btn.textContent;
    btn.textContent = result.ok ? "공유 창 열림" : "공유 실패";
    setTimeout(() => {
      btn.textContent = prev;
    }, 1600);
  });

  updateHud();
  syncSongList();
  document.getElementById("song-chip").textContent = currentSong().name;

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "rhythm-battle",
      gameTitle: "리듬 배틀",
      formParent: overlays.over,
    });
  }

  if (window.TodayPause) {
    TodayPause.mount({
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

  // 내 얼굴로 플레이: 켜져 있으면 내 쪽 얼굴 사진을 바꿔요 (화면에만 표시)
  if (window.TodayFace) {
    const faceMe = document.getElementById("face-me");
    const chickSrc = faceMe.getAttribute("src");
    const syncFace = () => {
      faceMe.src = TodayFace.dataUrl() || chickSrc;
    };
    syncFace();
    TodayFace.onChange(syncFace);
  }
})();
