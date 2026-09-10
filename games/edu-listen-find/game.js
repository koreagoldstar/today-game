(() => {
  "use strict";

  const ROUNDS = 5;
  const { JAMOS, shuffle } = window.TodayEduWords;
  const speak = (t) => window.speakSoftly && speakSoftly(t);
  const ding = () => window.TodayEduSpeak && TodayEduSpeak.ding();

  const els = {
    title: document.getElementById("title"),
    done: document.getElementById("done"),
    choices: document.getElementById("choices"),
    progress: document.getElementById("progress-pill"),
    learned: document.getElementById("learned"),
    startBtn: document.getElementById("start-btn"),
    againBtn: document.getElementById("again-btn"),
    speakBtn: document.getElementById("speak-btn"),
    speaker: document.getElementById("speaker"),
  };

  let roundIndex = 0;
  let locked = false;
  let current = null;
  const used = [];

  function showOverlay(name) {
    els.title.classList.toggle("hidden", name !== "title");
    els.done.classList.toggle("hidden", name !== "done");
  }

  function speakTarget() {
    if (!current) return;
    speak(`${current.name}. ${current.name}`);
  }

  function pickQuestion() {
    const pool = JAMOS.filter((j) => !used.includes(j.id));
    const answer = (pool.length ? pool : JAMOS)[Math.floor(Math.random() * (pool.length || JAMOS.length))];
    const others = shuffle(JAMOS.filter((j) => j.id !== answer.id)).slice(0, 4);
    const cards = shuffle([answer, ...others]);
    return { ...answer, cards };
  }

  function renderCards() {
    els.choices.innerHTML = "";
    current.cards.forEach((jamo) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice letter";
      btn.textContent = jamo.id;
      btn.setAttribute("aria-label", jamo.name);
      btn.addEventListener("click", () => onPick(btn, jamo));
      els.choices.appendChild(btn);
    });
  }

  function startRound() {
    locked = false;
    current = pickQuestion();
    used.push(current.id);
    els.progress.textContent = `${roundIndex + 1} / ${ROUNDS}`;
    renderCards();
    speakTarget();
  }

  function onPick(btn, jamo) {
    if (locked || !current) return;
    if (jamo.id === current.id) {
      locked = true;
      btn.classList.add("correct");
      ding();
      speak(current.name);
      if (window.TodayEdu) TodayEdu.recordResult("level1", current.id, true);
      window.setTimeout(nextRound, 900);
      return;
    }
    btn.classList.remove("shake");
    void btn.offsetWidth;
    btn.classList.add("shake");
    speak("다시 들어볼까?");
    window.setTimeout(speakTarget, 700);
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
    if (window.TodayEdu) TodayEdu.completeAttempt("level1");
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
  els.speakBtn.addEventListener("click", speakTarget);
  els.speaker.addEventListener("click", speakTarget);
})();
