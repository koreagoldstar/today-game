(() => {
  "use strict";

  const ROUNDS = 5;
  const { ASSET, WORDS3, shuffle } = window.TodayEduWords;
  const speak = (t) => window.speakSoftly && speakSoftly(t);
  const ding = () => window.TodayEduSpeak && TodayEduSpeak.ding();

  const els = {
    title: document.getElementById("title"),
    done: document.getElementById("done"),
    picture: document.getElementById("picture"),
    blank: document.getElementById("blank"),
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
    const pool = WORDS3.filter((w) => !used.includes(w.word));
    const src = pool.length ? pool : WORDS3;
    return src[Math.floor(Math.random() * src.length)];
  }

  function speakPrompt() {
    if (!current) return;
    speak("빈칸에 들어갈 소리를 찾아볼까?");
  }

  function renderBlank(fill) {
    els.blank.innerHTML = "";
    current.syllables.forEach((syl, i) => {
      const span = document.createElement("span");
      span.className = "slot-syl";
      if (i === current.blank && !fill) {
        span.classList.add("empty");
        span.textContent = "_";
      } else {
        span.textContent = syl;
      }
      els.blank.appendChild(span);
    });
  }

  function renderChoices() {
    els.choices.innerHTML = "";
    const answer = current.syllables[current.blank];
    const options = shuffle([answer, ...current.wrong]).slice(0, 3);
    options.forEach((syl) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice letter";
      btn.textContent = syl;
      btn.addEventListener("click", () => onPick(btn, syl === answer));
      els.choices.appendChild(btn);
    });
  }

  function startRound() {
    locked = false;
    current = pick();
    used.push(current.word);
    els.picture.src = `${ASSET}${current.file}`;
    els.picture.classList.remove("bounce");
    els.progress.textContent = `${roundIndex + 1} / ${ROUNDS}`;
    renderBlank(false);
    renderChoices();
    speakPrompt();
  }

  function onPick(btn, correct) {
    if (locked || !current) return;
    if (correct) {
      locked = true;
      btn.classList.add("correct");
      renderBlank(true);
      els.picture.classList.remove("bounce");
      void els.picture.offsetWidth;
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
    speak("다시 해볼까?");
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
  els.speakBtn.addEventListener("click", speakPrompt);
})();
