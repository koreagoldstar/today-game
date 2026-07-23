(() => {
  "use strict";

  const GAME_ID = "order-memo";
  const GAME_TITLE = "순서톡톡";
  const BEST_KEY = "today-order-memo-best";
  const MAX_STAGE = 50;
  const MAX_SEQ = 20;
  const MAX_TILES = 10;

  const ICON_POOL = [
    "star",
    "heart",
    "chick",
    "cloud",
    "candy",
    "berry",
    "moon",
    "drop",
    "gift",
    "sun",
  ];

  const board = document.getElementById("board");
  const phaseMsg = document.getElementById("phase-msg");
  const hint = document.getElementById("hint");
  const overlays = {
    title: document.getElementById("title"),
    clear: document.getElementById("clear"),
    allclear: document.getElementById("allclear"),
    over: document.getElementById("over"),
  };

  let state = "title";
  let stage = 1;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || "0") || 0;
  /** @type {string[]} */
  let tiles = [];
  /** @type {number[]} */
  let sequence = [];
  let inputIndex = 0;
  let playToken = 0;
  let inputReadyAt = 0;
  let inputBusy = false;
  let lastTapAt = 0;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function pickUnique(count) {
    return shuffle(ICON_POOL).slice(0, Math.min(count, ICON_POOL.length, MAX_TILES));
  }

  /** 1→3 … 점점 늘어 최대 20 */
  function seqLenForStage(s) {
    return Math.min(2 + s, MAX_SEQ);
  }

  /** 초반 4 → 중반 6~8 → 후반 10 */
  function tileCountForStage(s) {
    if (s <= 3) return 4;
    if (s <= 8) return 6;
    if (s <= 18) return 8;
    return MAX_TILES;
  }

  function flashMsForStage(s) {
    return Math.max(220, 720 - (s - 1) * 10);
  }

  function gapMsForStage(s) {
    return Math.max(80, 220 - (s - 1) * 3);
  }

  function showOverlay(name) {
    Object.keys(overlays).forEach((k) => {
      overlays[k].classList.toggle("hidden", k !== name);
    });
  }

  function hideOverlays() {
    Object.keys(overlays).forEach((k) => overlays[k].classList.add("hidden"));
  }

  function updateHud() {
    document.getElementById("hud-stage").textContent = `${stage}/${MAX_STAGE}`;
    document.getElementById("hud-score").textContent = String(score);
  }

  function setPhase(text, sub) {
    phaseMsg.textContent = text;
    hint.textContent = sub;
  }

  function setTilesEnabled(on) {
    board.querySelectorAll(".tile").forEach((btn) => {
      btn.disabled = !on;
    });
  }

  function saveBest() {
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  function openRank(parent) {
    if (!window.TodayGameRank) return;
    TodayGameRank.mount({
      gameId: GAME_ID,
      gameTitle: GAME_TITLE,
      formParent: parent,
    });
    TodayGameRank.open(score, { label: `${score}점 · ${stage}단계` });
  }

  function renderBoard() {
    board.innerHTML = "";
    board.classList.toggle("cols-3", tiles.length >= 6 && tiles.length < 10);
    board.classList.toggle("cols-5", tiles.length >= 10);
    tiles.forEach((id, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.dataset.index = String(index);
      btn.setAttribute("aria-label", id);
      const img = document.createElement("img");
      img.src = `assets/icons/${id}.png`;
      img.alt = "";
      img.draggable = false;
      img.width = 120;
      img.height = 120;
      btn.appendChild(img);
      // click 한 경로만 사용 (마우스 pointerup 중복/캡처 이슈 방지)
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onTileTap(index);
      });
      board.appendChild(btn);
    });
  }

  function tileEl(index) {
    return board.querySelector(`.tile[data-index="${index}"]`);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function flashTile(index, ms) {
    const el = tileEl(index);
    if (!el) return;
    el.classList.add("lit");
    if (navigator.vibrate) navigator.vibrate(10);
    await sleep(ms);
    el.classList.remove("lit");
  }

  function buildRound() {
    const count = tileCountForStage(stage);
    tiles = pickUnique(count);
    const len = seqLenForStage(stage);
    sequence = Array.from({ length: len }, () => Math.floor(Math.random() * tiles.length));
    for (let i = 1; i < sequence.length; i += 1) {
      if (sequence[i] === sequence[i - 1] && Math.random() < 0.55) {
        sequence[i] = (sequence[i] + 1 + Math.floor(Math.random() * (tiles.length - 1))) % tiles.length;
      }
    }
    renderBoard();
  }

  async function playSequence() {
    const token = ++playToken;
    state = "watch";
    setTilesEnabled(false);
    setPhase("잘 보세요!", `${sequence.length}개 · 칸 ${tiles.length}개`);
    await sleep(450);
    if (token !== playToken) return;
    const flash = flashMsForStage(stage);
    const gap = gapMsForStage(stage);
    for (let i = 0; i < sequence.length; i += 1) {
      if (token !== playToken) return;
      await flashTile(sequence[i], flash);
      if (token !== playToken) return;
      await sleep(gap);
    }
    if (token !== playToken) return;
    inputIndex = 0;
    inputBusy = false;
    lastTapAt = 0;
    state = "input";
    // 보기 직후 남아 있는 터치/클릭이 자동 입력되지 않게
    inputReadyAt = performance.now() + 420;
    setTilesEnabled(true);
    setPhase("따라 눌러요!", `${sequence.length}개 순서`);
  }

  function allClear() {
    playToken += 1;
    state = "allclear";
    setTilesEnabled(false);
    saveBest();
    document.getElementById("all-detail").textContent =
      `50단계 완료!\n점수 ${score}` + (best ? `\n최고 ${best}점` : "");
    showOverlay("allclear");
    openRank(overlays.allclear);
  }

  function stageClear() {
    playToken += 1;
    setTilesEnabled(false);
    const gained = sequence.length * 10 + stage * 5;
    score += gained;
    updateHud();

    if (stage >= MAX_STAGE) {
      allClear();
      return;
    }

    state = "clear";
    document.getElementById("clear-detail").textContent =
      `단계 ${stage}/${MAX_STAGE} 클리어 · +${gained}점\n다음 ${seqLenForStage(stage + 1)}개 순서`;
    showOverlay("clear");
  }

  function gameOver() {
    playToken += 1;
    state = "over";
    setTilesEnabled(false);
    saveBest();
    document.getElementById("over-detail").textContent =
      `단계 ${stage}/${MAX_STAGE} · 점수 ${score}` + (best ? `\n최고 ${best}점` : "");
    showOverlay("over");
    openRank(overlays.over);
  }

  function onTileTap(index) {
    if (state !== "input" || inputBusy) return;
    const now = performance.now();
    if (now < inputReadyAt) return;
    // 마우스 더블클릭/중복 이벤트 방지
    if (now - lastTapAt < 220) return;
    lastTapAt = now;

    const expect = sequence[inputIndex];
    const el = tileEl(index);
    if (index !== expect) {
      inputBusy = true;
      if (el) el.classList.add("bad");
      setPhase("앗!", "순서가 틀렸어요");
      setTimeout(() => gameOver(), 380);
      return;
    }

    inputBusy = true;
    if (el) {
      el.classList.add("ok", "lit");
      setTimeout(() => el.classList.remove("ok", "lit"), 180);
    }

    const next = inputIndex + 1;
    if (next >= sequence.length) {
      inputIndex = next;
      stageClear();
      return;
    }

    inputIndex = next;
    setPhase("좋아요!", `${inputIndex}/${sequence.length}`);
    setTimeout(() => {
      if (state === "input") inputBusy = false;
    }, 180);
  }

  function startGame() {
    if (window.TodayGameRank) TodayGameRank.reset();
    playToken += 1;
    stage = 1;
    score = 0;
    updateHud();
    hideOverlays();
    buildRound();
    playSequence();
  }

  function nextStage() {
    stage += 1;
    updateHud();
    hideOverlays();
    buildRound();
    playSequence();
  }

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("next-btn").addEventListener("click", nextStage);
  document.getElementById("retry-btn").addEventListener("click", startGame);
  document.getElementById("again-btn").addEventListener("click", startGame);

  updateHud();
  setPhase("순서톡톡", "시작을 눌러요");
  showOverlay("title");

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: GAME_ID,
      gameTitle: GAME_TITLE,
      formParent: overlays.over,
    });
  }

  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => state === "watch" || state === "input",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "watch" && state !== "input") return false;
        playToken += 1;
        state = "paused";
        setTilesEnabled(false);
        setPhase("잠깐 멈춤", "이어서 같은 단계부터");
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        hideOverlays();
        renderBoard();
        playSequence();
        return true;
      },
    });
  }
})();
