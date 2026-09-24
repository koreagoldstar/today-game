(() => {
  "use strict";

  const ROUNDS = 5;
  const COLORS = ["#ff6b3d", "#4fa8e8", "#5fbe8a", "#7b5cfa", "#ff8c42"];
  const { JAMOS, JUNGS } = window.TodayEduWords;
  const LETTERS = [...JAMOS.map((item) => item.id), ...JUNGS.map((item) => item.id)];
  const NAMES = Object.fromEntries([...JAMOS, ...JUNGS].map((item) => [item.id, item.name]));

  const speak = (t) => window.speakSoftly && speakSoftly(t);
  const ding = () => window.TodayEduSpeak && TodayEduSpeak.ding();

  const els = {
    title: document.getElementById("title"),
    done: document.getElementById("done"),
    hint: document.getElementById("hint"),
    wrap: document.getElementById("trace-wrap"),
    guide: document.getElementById("guide-canvas"),
    draw: document.getElementById("draw-canvas"),
    pop: document.getElementById("trace-pop"),
    picker: document.getElementById("picker"),
    progress: document.getElementById("progress-pill"),
    learned: document.getElementById("learned"),
    startBtn: document.getElementById("start-btn"),
    againBtn: document.getElementById("again-btn"),
    speakBtn: document.getElementById("speak-btn"),
    clearBtn: document.getElementById("clear-btn"),
    doneBtn: document.getElementById("done-btn"),
  };

  const gctx = els.guide.getContext("2d");
  const dctx = els.draw.getContext("2d");

  let roundIndex = 0;
  let letterIndex = 0;
  let colorIndex = 0;
  let drawing = false;
  let lastX = 0;
  let lastY = 0;
  let ink = 0;
  let pointerId = null;
  const practiced = [];

  function showOverlay(name) {
    els.title.classList.toggle("hidden", name !== "title");
    els.done.classList.toggle("hidden", name !== "done");
  }

  function letterName(ch) {
    return NAMES[ch] || ch;
  }

  function objectPhrase(ch) {
    const name = letterName(ch);
    const code = name.charCodeAt(name.length - 1);
    const particle = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 ? "을" : "를";
    return `${name}${particle}`;
  }

  function currentLetter() {
    return LETTERS[letterIndex] || LETTERS[0];
  }

  function speakLetter() {
    speak(letterName(currentLetter()));
  }

  function cssSize() {
    const box = els.wrap.getBoundingClientRect();
    return { w: Math.max(1, box.width), h: Math.max(1, box.height) };
  }

  function resizeCanvases() {
    const { w, h } = cssSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    [els.guide, els.draw].forEach((canvas) => {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    });
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGuide();
  }

  function drawGuide() {
    const { w, h } = cssSize();
    gctx.clearRect(0, 0, w, h);
    gctx.save();
    gctx.font = `900 ${Math.floor(w * 0.62)}px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    gctx.fillStyle = "rgba(61, 40, 24, 0.48)";
    gctx.textAlign = "center";
    gctx.textBaseline = "middle";
    gctx.fillText(currentLetter(), w / 2, h / 2 + h * 0.02);
    gctx.restore();
  }

  function clearInk() {
    const { w, h } = cssSize();
    dctx.clearRect(0, 0, w, h);
    ink = 0;
  }

  function pointFromEvent(e) {
    const box = els.draw.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }

  function startDraw(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    drawing = true;
    pointerId = e.pointerId;
    try {
      els.draw.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    const pos = pointFromEvent(e);
    lastX = pos.x;
    lastY = pos.y;
  }

  function moveDraw(e) {
    if (!drawing || (pointerId !== null && e.pointerId !== pointerId)) return;
    e.preventDefault();
    const pos = pointFromEvent(e);
    dctx.strokeStyle = COLORS[colorIndex % COLORS.length];
    dctx.lineWidth = 16;
    dctx.lineCap = "round";
    dctx.lineJoin = "round";
    dctx.beginPath();
    dctx.moveTo(lastX, lastY);
    dctx.lineTo(pos.x, pos.y);
    dctx.stroke();
    ink += Math.hypot(pos.x - lastX, pos.y - lastY);
    lastX = pos.x;
    lastY = pos.y;
  }

  function endDraw(e) {
    if (pointerId !== null && e && e.pointerId !== pointerId) return;
    drawing = false;
    pointerId = null;
  }

  function renderPicker() {
    els.picker.innerHTML = "";
    LETTERS.forEach((ch, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "trace-letter";
      if (i === letterIndex) btn.classList.add("on");
      if (practiced.includes(ch)) btn.classList.add("done");
      btn.textContent = ch;
      btn.setAttribute("aria-label", letterName(ch));
      btn.addEventListener("click", () => selectLetter(i));
      els.picker.appendChild(btn);
    });
  }

  function selectLetter(i) {
    letterIndex = i;
    colorIndex += 1;
    clearInk();
    drawGuide();
    renderPicker();
    els.hint.textContent = `${objectPhrase(currentLetter())} 따라 그려요`;
    speakLetter();
  }

  function nextLetter() {
    letterIndex = (letterIndex + 1) % LETTERS.length;
    colorIndex += 1;
    clearInk();
    drawGuide();
    renderPicker();
    els.hint.textContent = `${objectPhrase(currentLetter())} 따라 그려요`;
    speakLetter();
  }

  function popStar() {
    els.pop.hidden = false;
    els.pop.classList.remove("show");
    void els.pop.offsetWidth;
    els.pop.classList.add("show");
    window.setTimeout(() => {
      els.pop.classList.remove("show");
      els.pop.hidden = true;
    }, 650);
  }

  function markDone() {
    if (ink < 90) {
      speak("조금 더 그려볼까?");
      return;
    }
    const ch = currentLetter();
    if (!practiced.includes(ch)) {
      practiced.push(ch);
      if (window.TodayEdu) TodayEdu.recordResult("level1", ch, true);
    }
    ding();
    speak(letterName(ch));
    popStar();
    roundIndex += 1;
    if (roundIndex >= ROUNDS) {
      els.progress.textContent = `${ROUNDS} / ${ROUNDS}`;
      window.setTimeout(finish, 800);
      return;
    }
    els.progress.textContent = `${roundIndex + 1} / ${ROUNDS}`;
    window.setTimeout(nextLetter, 700);
  }

  function finish() {
    if (window.TodayEdu) TodayEdu.completeAttempt("level1");
    const data = window.TodayEdu ? TodayEdu.load() : null;
    els.learned.textContent =
      data && data.todayLearned && data.todayLearned.length ? data.todayLearned.join("  ") : practiced.join("  ");
    showOverlay("done");
    speak(window.TodayEdu ? TodayEdu.todaySummary(data) || "잘했어요" : "잘했어요");
  }

  function startGame() {
    if (window.TodayEduSpeak) TodayEduSpeak.unlock();
    roundIndex = 0;
    practiced.length = 0;
    letterIndex = Math.floor(Math.random() * LETTERS.length);
    colorIndex = 0;
    showOverlay(null);
    els.progress.textContent = `1 / ${ROUNDS}`;
    window.requestAnimationFrame(() => {
      resizeCanvases();
      clearInk();
      drawGuide();
      renderPicker();
      els.hint.textContent = `${objectPhrase(currentLetter())} 따라 그려요`;
      speakLetter();
    });
  }

  els.draw.addEventListener("pointerdown", startDraw, { passive: false });
  els.draw.addEventListener("pointermove", moveDraw, { passive: false });
  els.draw.addEventListener("pointerup", endDraw);
  els.draw.addEventListener("pointercancel", endDraw);
  els.draw.addEventListener("lostpointercapture", endDraw);

  els.startBtn.addEventListener("click", startGame);
  els.againBtn.addEventListener("click", startGame);
  els.speakBtn.addEventListener("click", speakLetter);
  els.clearBtn.addEventListener("click", () => {
    clearInk();
    speak("지웠어요. 다시 그려볼까?");
  });
  els.doneBtn.addEventListener("click", markDone);
  window.addEventListener("resize", () => {
    if (els.title.classList.contains("hidden")) resizeCanvases();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (els.title.classList.contains("hidden")) drawGuide();
    });
  }
})();
