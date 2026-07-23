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
  /** @type {string[]} 화면에 보이는 아이콘 id */
  let tiles = [];
  /** @type {string[]} 눌러야 할 아이콘 id 순서 */
  let sequence = [];
  let inputIndex = 0;
  let playToken = 0;
  let inputBusy = false;

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

  function seqLenForStage(s) {
    return Math.min(2 + s, MAX_SEQ);
  }

  function tileCountForStage(s) {
    if (s <= 3) return 4;
    if (s <= 8) return 6;
    if (s <= 18) return 8;
    return MAX_TILES;
  }

  function flashMsForStage(s) {
    return Math.max(320, 820 - (s - 1) * 10);
  }

  function gapMsForStage(s) {
    return Math.max(140, 280 - (s - 1) * 3);
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

  function setBoardInteractive(on) {
    board.classList.toggle("locked", !on);
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

  function indexOfIcon(iconId) {
    return tiles.indexOf(iconId);
  }

  function renderBoard() {
    board.innerHTML = "";
    board.classList.toggle("cols-3", tiles.length >= 6 && tiles.length < 10);
    board.classList.toggle("cols-5", tiles.length >= 10);
    tiles.forEach((id, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.dataset.icon = id;
      btn.dataset.index = String(index);
      btn.setAttribute("aria-label", id);
      const img = document.createElement("img");
      img.src = `assets/icons/${id}.png`;
      img.alt = "";
      img.draggable = false;
      img.width = 120;
      img.height = 120;
      btn.appendChild(img);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onTileTap(id);
      });
      board.appendChild(btn);
    });
  }

  function tileElByIcon(iconId) {
    return board.querySelector(`.tile[data-icon="${iconId}"]`);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function flashIcon(iconId, ms, step, total) {
    const el = tileElByIcon(iconId);
    if (!el) return;
    board.querySelectorAll(".tile").forEach((t) => t.classList.remove("lit", "dim"));
    board.querySelectorAll(".tile").forEach((t) => {
      if (t !== el) t.classList.add("dim");
    });
    el.classList.add("lit");
    setPhase("잘 보세요!", `${step}/${total}`);
    if (navigator.vibrate) navigator.vibrate(10);
    await sleep(ms);
    el.classList.remove("lit");
    board.querySelectorAll(".tile").forEach((t) => t.classList.remove("dim"));
  }

  function buildRound() {
    const count = tileCountForStage(stage);
    tiles = pickUnique(count);
    const len = seqLenForStage(stage);
    sequence = [];
    for (let i = 0; i < len; i += 1) {
      let next = tiles[Math.floor(Math.random() * tiles.length)];
      // 같은 그림이 연속으로 너무 자주 나오지 않게
      if (i > 0 && next === sequence[i - 1] && tiles.length > 1 && Math.random() < 0.7) {
        const others = tiles.filter((t) => t !== sequence[i - 1]);
        next = others[Math.floor(Math.random() * others.length)];
      }
      sequence.push(next);
    }
    renderBoard();
  }

  async function playSequence() {
    const token = ++playToken;
    state = "watch";
    inputBusy = true;
    setBoardInteractive(false);
    setPhase("잘 보세요!", `${sequence.length}개 순서`);
    await sleep(550);
    if (token !== playToken) return;

    const flash = flashMsForStage(stage);
    const gap = gapMsForStage(stage);
    for (let i = 0; i < sequence.length; i += 1) {
      if (token !== playToken) return;
      await flashIcon(sequence[i], flash, i + 1, sequence.length);
      if (token !== playToken) return;
      await sleep(gap);
    }
    if (token !== playToken) return;

    setPhase("준비…", "곧 따라 눌러요");
    await sleep(500);
    if (token !== playToken) return;

    inputIndex = 0;
    inputBusy = false;
    state = "input";
    setBoardInteractive(true);
    setPhase("따라 눌러요!", `1 / ${sequence.length}`);
  }

  function allClear() {
    playToken += 1;
    state = "allclear";
    setBoardInteractive(false);
    saveBest();
    document.getElementById("all-detail").textContent =
      `50단계 완료!\n점수 ${score}` + (best ? `\n최고 ${best}점` : "");
    showOverlay("allclear");
    openRank(overlays.allclear);
  }

  function stageClear() {
    playToken += 1;
    setBoardInteractive(false);
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

  function gameOver(tappedIcon) {
    playToken += 1;
    state = "over";
    setBoardInteractive(false);
    saveBest();
    const expected = sequence[inputIndex] || "?";
    document.getElementById("over-detail").textContent =
      `단계 ${stage}/${MAX_STAGE} · 점수 ${score}\n` +
      `${inputIndex + 1}번째에서 실패` +
      (best ? `\n최고 ${best}점` : "");
    showOverlay("over");
    openRank(overlays.over);
  }

  function onTileTap(iconId) {
    if (state !== "input" || inputBusy) return;
    if (board.classList.contains("locked")) return;

    inputBusy = true;
    const expect = sequence[inputIndex];
    const el = tileElByIcon(iconId);

    if (iconId !== expect) {
      if (el) el.classList.add("bad");
      const expectEl = tileElByIcon(expect);
      if (expectEl) expectEl.classList.add("lit");
      setPhase("앗!", "순서가 틀렸어요");
      setTimeout(() => gameOver(iconId), 450);
      return;
    }

    if (el) {
      el.classList.add("ok", "lit");
      setTimeout(() => el.classList.remove("ok", "lit"), 200);
    }

    const next = inputIndex + 1;
    if (next >= sequence.length) {
      inputIndex = next;
      stageClear();
      return;
    }

    inputIndex = next;
    setPhase("좋아요!", `${inputIndex + 1} / ${sequence.length}`);
    // 다음 입력 허용
    setTimeout(() => {
      if (state === "input") inputBusy = false;
    }, 200);
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
        setBoardInteractive(false);
        setPhase("잠깐 멈춤", "이어하면 순서를 다시 보여줘요");
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
