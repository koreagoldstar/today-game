(() => {
  "use strict";

  const ASSET = "/assets/edu/";
  const ROUNDS = 5;
  const JAMOS = [
    { id: "ㄱ", name: "기역", items: [
      { file: "edu_giraffe.svg", word: "기린" },
      { file: "edu_puppy.svg", word: "강아지" },
      { file: "edu_cat.svg", word: "고양이" },
    ]},
    { id: "ㄴ", name: "니은", items: [
      { file: "edu_butterfly.svg", word: "나비" },
      { file: "edu_raccoon.svg", word: "너구리" },
      { file: "edu_snowman.svg", word: "눈사람" },
    ]},
    { id: "ㄷ", name: "디귿", items: [
      { file: "edu_squirrel.svg", word: "다람쥐" },
      { file: "edu_pig.svg", word: "돼지" },
      { file: "edu_strawberry.svg", word: "딸기" },
    ]},
    { id: "ㄹ", name: "리을", items: [
      { file: "edu_ramen.svg", word: "라면" },
      { file: "edu_robot.svg", word: "로봇" },
      { file: "edu_ribbon.svg", word: "리본" },
    ]},
    { id: "ㅁ", name: "미음", items: [
      { file: "edu_octopus.svg", word: "문어" },
      { file: "edu_fish.svg", word: "물고기" },
      { file: "edu_hat.svg", word: "모자" },
    ]},
    { id: "ㅂ", name: "비읍", items: [
      { file: "edu_banana.svg", word: "바나나" },
      { file: "edu_chick.svg", word: "병아리" },
      { file: "edu_snake.svg", word: "뱀" },
    ]},
    { id: "ㅅ", name: "시옷", items: [
      { file: "edu_lion.svg", word: "사자" },
      { file: "edu_apple.svg", word: "사과" },
      { file: "edu_watermelon.svg", word: "수박" },
    ]},
    { id: "ㅇ", name: "이응", items: [
      { file: "edu_umbrella.svg", word: "우산" },
      { file: "edu_duck.svg", word: "오리" },
      { file: "edu_icecream.svg", word: "아이스크림" },
    ]},
    { id: "ㅈ", name: "지읒", items: [
      { file: "edu_car.svg", word: "자동차" },
      { file: "edu_worm.svg", word: "지렁이" },
      { file: "edu_gloves.svg", word: "장갑" },
    ]},
    { id: "ㅊ", name: "치읓", items: [
      { file: "edu_sparrow.svg", word: "참새" },
      { file: "edu_cheetah.svg", word: "치타" },
      { file: "edu_chocolate.svg", word: "초콜릿" },
    ]},
    { id: "ㅋ", name: "키읔", items: [
      { file: "edu_elephant.svg", word: "코끼리" },
      { file: "edu_cup.svg", word: "컵" },
      { file: "edu_crayon.svg", word: "크레용" },
    ]},
    { id: "ㅌ", name: "티읕", items: [
      { file: "edu_rabbit.svg", word: "토끼" },
      { file: "edu_sun.svg", word: "태양" },
      { file: "edu_truck.svg", word: "트럭" },
    ]},
    { id: "ㅍ", name: "피읖", items: [
      { file: "edu_panda.svg", word: "판다" },
      { file: "edu_balloon.svg", word: "풍선" },
      { file: "edu_pizza.svg", word: "피자" },
    ]},
    { id: "ㅎ", name: "히읗", items: [
      { file: "edu_tiger.svg", word: "호랑이" },
      { file: "edu_sunflower.svg", word: "해바라기" },
      { file: "edu_hippo.svg", word: "하마" },
    ]},
  ];

  const els = {
    title: document.getElementById("title"),
    done: document.getElementById("done"),
    jamo: document.getElementById("jamo"),
    choices: document.getElementById("choices"),
    progress: document.getElementById("progress-pill"),
    learned: document.getElementById("learned"),
    startBtn: document.getElementById("start-btn"),
    againBtn: document.getElementById("again-btn"),
    speakBtn: document.getElementById("speak-btn"),
  };

  let roundIndex = 0;
  let misses = 0;
  let locked = false;
  let current = null;
  let audioCtx = null;

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function ding() {
    if (window.TodayEduSpeak) {
      TodayEduSpeak.ding();
      return;
    }
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02 + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + i * 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + 0.4 + i * 0.05);
    });
  }

  function speak(text) {
    if (window.speakSoftly) {
      speakSoftly(text);
      return;
    }
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ko-KR";
    utter.rate = 0.85;
    utter.pitch = 1.15;
    utter.volume = 1.0;
    speechSynthesis.speak(utter);
  }

  function showOverlay(name) {
    els.title.classList.toggle("hidden", name !== "title");
    els.done.classList.toggle("hidden", name !== "done");
  }

  function pickQuestion(usedIds) {
    const pool = JAMOS.filter((j) => !usedIds.includes(j.id));
    const jamo = (pool.length ? pool : JAMOS)[Math.floor(Math.random() * (pool.length || JAMOS.length))];
    const answer = jamo.items[Math.floor(Math.random() * jamo.items.length)];
    const others = JAMOS.filter((j) => j.id !== jamo.id)
      .flatMap((j) => j.items.map((item) => ({ ...item, jamo: j.id })));
    const distractors = shuffle(others).slice(0, 2);
    const choices = shuffle([
      { ...answer, jamo: jamo.id, correct: true },
      ...distractors.map((d) => ({ ...d, correct: false })),
    ]);
    return { jamo, answer, choices };
  }

  function promptText() {
    if (!current) return "";
    return `${current.jamo.name}. ${current.jamo.name}으로 시작하는 걸 찾아볼까?`;
  }

  function speakPrompt() {
    if (!current) return;
    speak(`${current.jamo.name}. ${current.jamo.name}으로 시작하는 걸 찾아볼까?`);
  }

  function renderChoices() {
    els.choices.innerHTML = "";
    current.choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.dataset.correct = choice.correct ? "1" : "0";
      btn.setAttribute("aria-label", choice.word);
      btn.innerHTML = `<img src="${ASSET}${choice.file}" alt="" width="78" height="78" /><span class="word">${choice.word}</span>`;
      btn.addEventListener("click", () => onPick(btn, choice));
      els.choices.appendChild(btn);
    });
  }

  function startRound(usedIds) {
    locked = false;
    misses = 0;
    current = pickQuestion(usedIds);
    usedIds.push(current.jamo.id);
    els.jamo.textContent = current.jamo.id;
    els.progress.textContent = `${roundIndex + 1} / ${ROUNDS}`;
    renderChoices();
    speakPrompt();
  }

  function hintCorrect() {
    const btn = els.choices.querySelector('[data-correct="1"]');
    if (btn) btn.classList.add("hint");
  }

  function onPick(btn, choice) {
    if (locked || !current) return;
    if (choice.correct) {
      locked = true;
      btn.classList.add("correct");
      ding();
      speak(choice.word);
      if (window.TodayEdu) TodayEdu.recordResult("level1", current.jamo.id, true);
      window.setTimeout(() => nextRound(), 900);
      return;
    }
    btn.classList.remove("shake");
    void btn.offsetWidth;
    btn.classList.add("shake");
    misses += 1;
    if (window.TodayEdu) TodayEdu.recordResult("level1", current.jamo.id, false);
    speak("다시 해볼까?");
    if (misses >= 3) hintCorrect();
  }

  const usedIds = [];

  function nextRound() {
    roundIndex += 1;
    if (roundIndex >= ROUNDS) {
      finish();
      return;
    }
    startRound(usedIds);
  }

  function finish() {
    if (window.TodayEdu) TodayEdu.completeAttempt("level1");
    const data = window.TodayEdu ? TodayEdu.load() : null;
    const learned = data && data.todayLearned && data.todayLearned.length
      ? data.todayLearned.join("  ")
      : current
        ? current.jamo.id
        : "ㄱ";
    els.learned.textContent = learned;
    showOverlay("done");
    speak(window.TodayEdu ? TodayEdu.todaySummary(data) || "잘했어요" : "잘했어요");
  }

  function startGame() {
    if (window.TodayEduSpeak) TodayEduSpeak.unlock();
    else ensureAudio();
    roundIndex = 0;
    usedIds.length = 0;
    showOverlay(null);
    startRound(usedIds);
  }

  els.startBtn.addEventListener("click", startGame);
  els.againBtn.addEventListener("click", startGame);
  els.speakBtn.addEventListener("click", speakPrompt);
})();
