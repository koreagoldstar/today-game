(() => {
  "use strict";

  const BEST_KEY = "today-reaction-best";
  const TRIES_KEY = "today-reaction-tries";
  const GAME_ID = "reaction";
  const GAME_TITLE = "번쩍 반응";

  const arena = document.getElementById("arena");
  const signal = document.getElementById("signal");
  const mascot = document.getElementById("mascot");
  const arenaMsg = document.getElementById("arena-msg");
  const arenaSub = document.getElementById("arena-sub");
  const overlays = {
    title: document.getElementById("title"),
    early: document.getElementById("early"),
    result: document.getElementById("result"),
  };

  let state = "title";
  let waitTimer = null;
  let readyAt = 0;
  let lastMs = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;
  let tries = Number(localStorage.getItem(TRIES_KEY) || "0") || 0;

  function showOverlay(name) {
    Object.keys(overlays).forEach((k) => {
      overlays[k].classList.toggle("hidden", k !== name);
    });
  }

  function hideOverlays() {
    Object.keys(overlays).forEach((k) => overlays[k].classList.add("hidden"));
  }

  function formatBest(ms) {
    return ms > 0 ? `${ms}ms` : "—";
  }

  function updateHud() {
    document.getElementById("hud-best").textContent = formatBest(best);
    document.getElementById("hud-tries").textContent = String(tries);
  }

  function clearWait() {
    if (waitTimer) {
      clearTimeout(waitTimer);
      waitTimer = null;
    }
  }

  function setArena(mode, msg, sub) {
    arena.classList.remove("mode-idle", "mode-wait", "mode-ready");
    arena.classList.add(`mode-${mode}`);
    arenaMsg.textContent = msg;
    arenaSub.textContent = sub;
    if (mode === "ready") {
      mascot.src = "assets/go.png";
    } else if (mode === "wait") {
      mascot.src = "assets/wait.png";
    } else {
      mascot.src = "assets/thumb.png";
    }
  }

  function noteForMs(ms) {
    if (ms < 180) return "번개 손가락!";
    if (ms < 230) return "엄청 빨라요";
    if (ms < 280) return "좋은 반응이에요";
    if (ms < 350) return "괜찮은 속도예요";
    if (ms < 450) return "조금 더 연습해봐요";
    return "여유롭게 눌렀네요";
  }

  function startWait() {
    clearWait();
    hideOverlays();
    state = "wait";
    setArena("wait", "기다리세요…", "초록이 되면 바로 탭!");
    const delay = 1200 + Math.random() * 2300;
    waitTimer = setTimeout(() => {
      waitTimer = null;
      if (state !== "wait") return;
      state = "ready";
      readyAt = performance.now();
      setArena("ready", "지금!", "바로 탭!");
      if (navigator.vibrate) navigator.vibrate(12);
    }, delay);
  }

  function failEarly() {
    clearWait();
    state = "early";
    setArena("idle", "너무 빨라요", "초록 전에 눌렀어요");
    showOverlay("early");
  }

  function finish(ms) {
    clearWait();
    lastMs = ms;
    tries += 1;
    localStorage.setItem(TRIES_KEY, String(tries));
    const isNewBest = !best || ms < best;
    if (isNewBest) {
      best = ms;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud();

    state = "result";
    setArena("idle", "기록 완료", "한 번 더 도전해봐요");
    document.getElementById("result-ms").textContent = String(ms);
    document.getElementById("result-note").textContent = noteForMs(ms);
    document.getElementById("result-best").textContent = isNewBest
      ? "🎉 최고 기록 갱신!"
      : `최고 기록 ${formatBest(best)}`;
    document.getElementById("share-msg").textContent = "";
    showOverlay("result");

    if (window.TodayGameRank) {
      TodayGameRank.mount({
        gameId: GAME_ID,
        gameTitle: GAME_TITLE,
        formParent: overlays.result,
      });
      TodayGameRank.open(ms, { label: `${ms}ms` });
    }
  }

  function onArenaTap(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (state === "wait") {
      failEarly();
      return;
    }
    if (state === "ready") {
      const ms = Math.max(1, Math.round(performance.now() - readyAt));
      finish(ms);
    }
  }

  function sharePayload() {
    return {
      gameTitle: GAME_TITLE,
      name: localStorage.getItem("today-game-name") || "나",
      score: lastMs,
      scoreLabel: `${lastMs}ms`,
      url: "https://www.todaygame.co.kr/games/reaction/",
    };
  }

  async function shareKakao() {
    const msg = document.getElementById("share-msg");
    if (!window.TodayScores || !TodayScores.shareToKakao) {
      msg.textContent = "공유 모듈을 불러오지 못했어요";
      return;
    }
    const result = await TodayScores.shareToKakao(sharePayload());
    msg.textContent = TodayScores.formatShareResult
      ? TodayScores.formatShareResult(result)
      : result.ok
        ? "공유했어요"
        : "공유에 실패했어요";
  }

  async function shareOther() {
    const msg = document.getElementById("share-msg");
    if (!window.TodayScores || !TodayScores.shareRank) {
      msg.textContent = "공유 모듈을 불러오지 못했어요";
      return;
    }
    const result = await TodayScores.shareRank(sharePayload());
    msg.textContent = TodayScores.formatShareResult
      ? TodayScores.formatShareResult(result)
      : "";
    if (result.mode === "share") msg.textContent = "";
  }

  document.getElementById("start-btn").addEventListener("click", () => {
    if (window.TodayGameRank) TodayGameRank.reset();
    startWait();
  });
  document.getElementById("early-btn").addEventListener("click", () => startWait());
  document.getElementById("retry-btn").addEventListener("click", () => {
    if (window.TodayGameRank) TodayGameRank.reset();
    startWait();
  });
  document.getElementById("kakao-btn").addEventListener("click", () => shareKakao());
  document.getElementById("share-btn").addEventListener("click", () => shareOther());

  arena.addEventListener("pointerdown", onArenaTap);
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "Space" || e.code === "Enter") {
      if (state === "title") {
        e.preventDefault();
        document.getElementById("start-btn").click();
        return;
      }
      if (state === "early") {
        e.preventDefault();
        document.getElementById("early-btn").click();
        return;
      }
      if (state === "result") {
        e.preventDefault();
        document.getElementById("retry-btn").click();
        return;
      }
      if (state === "wait" || state === "ready") {
        e.preventDefault();
        onArenaTap();
      }
    }
  });

  updateHud();
  setArena("idle", "준비가 되면 시작!", "초록이 되면 바로 탭");
  showOverlay("title");

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: GAME_ID,
      gameTitle: GAME_TITLE,
      formParent: overlays.result,
    });
  }

  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => state === "wait" || state === "ready",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "wait" && state !== "ready") return false;
        clearWait();
        state = "paused";
        setArena("idle", "잠깐 멈춤", "계속하면 다시 대기부터");
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        startWait();
        return true;
      },
    });
  }
})();
