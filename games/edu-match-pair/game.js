(() => {
  "use strict";

  const PAIR_COUNT = 6;
  const { ASSET, PAIRS, shuffle } = window.TodayEduWords;
  const speak = (t) => window.speakSoftly && speakSoftly(t);
  const ding = () => window.TodayEduSpeak && TodayEduSpeak.ding();

  const els = {
    title: document.getElementById("title"),
    done: document.getElementById("done"),
    board: document.getElementById("board"),
    progress: document.getElementById("progress-pill"),
    learned: document.getElementById("learned"),
    startBtn: document.getElementById("start-btn"),
    againBtn: document.getElementById("again-btn"),
    speakBtn: document.getElementById("speak-btn"),
  };

  let cards = [];
  let open = [];
  let matched = 0;
  let locked = false;
  let lastWord = "짝을 찾아볼까?";

  function showOverlay(name) {
    els.title.classList.toggle("hidden", name !== "title");
    els.done.classList.toggle("hidden", name !== "done");
  }

  function renderBoard() {
    els.board.innerHTML = "";
    cards.forEach((card, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mem-card";
      btn.dataset.index = String(index);
      btn.setAttribute("aria-label", card.kind === "pic" ? `${card.word} 그림` : card.word);
      btn.dataset.word = card.word;
      btn.dataset.kind = card.kind;
      const face = document.createElement("div");
      face.className = "face";
      if (card.kind === "pic") {
        face.innerHTML = `<img src="${ASSET}${card.file}" alt="" width="54" height="54" />`;
      } else {
        face.innerHTML = `<span class="word">${card.word}</span>`;
      }
      btn.appendChild(face);
      btn.addEventListener("click", () => onFlip(index, btn));
      els.board.appendChild(btn);
    });
  }

  function onFlip(index, btn) {
    if (locked || btn.classList.contains("open") || btn.classList.contains("matched")) return;
    btn.classList.add("open");
    open.push({ index, btn, card: cards[index] });
    if (open.length < 2) return;
    locked = true;
    const [a, b] = open;
    if (a.card.word === b.card.word && a.card.kind !== b.card.kind) {
      a.btn.classList.add("matched");
      b.btn.classList.add("matched");
      matched += 1;
      lastWord = a.card.word;
      ding();
      speak(a.card.word);
      if (window.TodayEdu) TodayEdu.recordResult("level2", a.card.word, true);
      els.progress.textContent = `${matched} / ${PAIR_COUNT}`;
      open = [];
      locked = false;
      if (matched >= PAIR_COUNT) window.setTimeout(finish, 700);
      return;
    }
    a.btn.classList.add("shake");
    b.btn.classList.add("shake");
    speak("다시 해볼까?");
    window.setTimeout(() => {
      a.btn.classList.remove("open", "shake");
      b.btn.classList.remove("open", "shake");
      open = [];
      locked = false;
    }, 750);
  }

  function finish() {
    if (window.TodayEdu) TodayEdu.completeAttempt("level2");
    const data = window.TodayEdu ? TodayEdu.load() : null;
    els.learned.textContent =
      data && data.todayLearned && data.todayLearned.length ? data.todayLearned.join("  ") : lastWord;
    showOverlay("done");
    speak(window.TodayEdu ? TodayEdu.todaySummary(data) || "잘했어요" : "잘했어요");
  }

  function startGame() {
    if (window.TodayEduSpeak) TodayEduSpeak.unlock();
    const picked = shuffle(PAIRS).slice(0, PAIR_COUNT);
    cards = shuffle(
      picked.flatMap((item) => [
        { kind: "pic", word: item.word, file: item.file },
        { kind: "word", word: item.word, file: item.file },
      ])
    );
    open = [];
    matched = 0;
    locked = false;
    lastWord = "짝을 찾아볼까?";
    els.progress.textContent = `0 / ${PAIR_COUNT}`;
    renderBoard();
    showOverlay(null);
    speak("그림과 글자 짝을 찾아볼까?");
  }

  els.startBtn.addEventListener("click", startGame);
  els.againBtn.addEventListener("click", startGame);
  els.speakBtn.addEventListener("click", () => speak(lastWord));
})();
