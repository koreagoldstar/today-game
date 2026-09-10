(() => {
  "use strict";

  const ROUNDS = 5;
  const { ASSET, DICTATION, shuffle } = window.TodayEduWords;
  const speak = (t) => window.speakSoftly && speakSoftly(t);
  const ding = () => window.TodayEduSpeak && TodayEduSpeak.ding();

  const els = {
    title: document.getElementById("title"),
    done: document.getElementById("done"),
    speaker: document.getElementById("speaker"),
    picture: document.getElementById("picture"),
    choices: document.getElementById("choices"),
    progress: document.getElementById("progress-pill"),
    learned: document.getElementById("learned"),
    startBtn: document.getElementById("start-btn"),
    againBtn: document.getElementById("again-btn"),
    speakBtn: document.getElementById("speak-btn"),
  };

  let roundIndex = 0;
  let locked = false;
  let current = null;
  const used = [];

  function showOverlay(name) {
    els.title.classList.toggle("hidden", name !== "title");
    els.done.classList.toggle("hidden", name !== "done");
  }

  function pick() {
    const pool = DICTATION.filter((w) => !used.includes(w.word));
    const src = pool.length ? pool : DICTATION;
    return src[Math.floor(Math.random() * src.length)];
  }

  function speakWord() {
    if (!current) return;
    speak(current.word);
  }

  function renderChoices() {
    els.choices.innerHTML = "";
    const others = shuffle(DICTATION.filter((w) => w.word !== current.word)).slice(0, 3);
    const cards = shuffle([current, ...others]);
    cards.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.innerHTML = `<span class="word">${item.word}</span>`;
      btn.addEventListener("click", () => onPick(btn, item));
      els.choices.appendChild(btn);
    });
  }

  function startRound() {
    locked = false;
    current = pick();
    used.push(current.word);
    els.picture.hidden = true;
    els.picture.classList.remove("bounce");
    els.progress.textContent = `${roundIndex + 1} / ${ROUNDS}`;
    renderChoices();
    speakWord();
  }

  function onPick(btn, item) {
    if (locked || !current) return;
    if (item.word === current.word) {
      locked = true;
      btn.classList.add("correct");
      els.picture.src = `${ASSET}${current.file}`;
      els.picture.hidden = false;
      els.picture.classList.add("bounce");
      ding();
      speak(current.word);
      if (window.TodayEdu) TodayEdu.recordResult("level3", current.word, true);
      window.setTimeout(nextRound, 1000);
      return;
    }
    btn.classList.remove("shake");
    void btn.offsetWidth;
    btn.classList.add("shake");
    speak("다시 들어볼까?");
    window.setTimeout(speakWord, 700);
  }

  function nextRound() {
    roundIndex += 1;
    if (roundIndex >= ROUNDS) {
      finish();
      return;
    }
    startRound();
  }

  function finish() {
    if (window.TodayEdu) TodayEdu.completeAttempt("level3");
    const data = window.TodayEdu ? TodayEdu.load() : null;
    els.learned.textContent =
      data && data.todayLearned && data.todayLearned.length ? data.todayLearned.join("  ") : used.join("  ");
    showOverlay("done");
    speak(window.TodayEdu ? TodayEdu.todaySummary(data) || "잘했어요" : "잘했어요");
  }

  function startGame() {
    if (window.TodayEduSpeak) TodayEduSpeak.unlock();
    roundIndex = 0;
    used.length = 0;
    showOverlay(null);
    startRound();
  }

  els.startBtn.addEventListener("click", startGame);
  els.againBtn.addEventListener("click", startGame);
  els.speakBtn.addEventListener("click", speakWord);
  els.speaker.addEventListener("click", speakWord);
})();
