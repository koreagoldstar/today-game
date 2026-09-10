(() => {
  "use strict";

  const ROUNDS = 5;
  const { JAMOS, SYLLABLES, shuffle } = window.TodayEduWords;
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

  function syllableCards() {
    const seen = new Set();
    return SYLLABLES.filter((item) => {
      if (seen.has(item.text)) return false;
      seen.add(item.text);
      return true;
    }).map((item) => ({ id: item.text, name: item.text, kind: "syl" }));
  }

  function jamoCards() {
    return JAMOS.map((item) => ({ id: item.id, name: item.name, kind: "jamo" }));
  }

  function useSyllables() {
    const data = window.TodayEdu ? TodayEdu.load() : null;
    if (!data) return false;
    const ready = (data.level1.attemptsCompleted || 0) >= 3 || (data.level1.mastered || []).length >= 5;
    return ready && Math.random() < 0.6;
  }

  function pickQuestion() {
    const source = useSyllables() ? syllableCards() : jamoCards();
    const pool = source.filter((item) => !used.includes(item.id));
    const src = pool.length ? pool : source;
    const answer = src[Math.floor(Math.random() * src.length)];
    const extra = 3 + Math.floor(Math.random() * 3);
    const others = shuffle(source.filter((item) => item.id !== answer.id)).slice(0, extra);
    return { ...answer, cards: shuffle([answer, ...others]) };
  }

  function speakTarget() {
    if (!current) return;
    els.speaker.classList.remove("hint");
    if (current.kind === "syl") speak(current.name);
    else speak(`${current.name}. ${current.name}`);
  }

  function renderCards() {
    els.choices.innerHTML = "";
    current.cards.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice letter";
      btn.textContent = item.id;
      btn.setAttribute("aria-label", item.name);
      btn.addEventListener("click", () => onPick(btn, item));
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

  function onPick(btn, item) {
    if (locked || !current) return;
    if (item.id === current.id) {
      locked = true;
      els.speaker.classList.remove("hint");
      btn.classList.add("correct");
      ding();
      speak(current.kind === "syl" ? current.name : current.name);
      if (window.TodayEdu) TodayEdu.recordResult("level1", current.id, true);
      window.setTimeout(nextRound, 900);
      return;
    }
    btn.classList.remove("shake");
    void btn.offsetWidth;
    btn.classList.add("shake");
    els.speaker.classList.add("hint");
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
