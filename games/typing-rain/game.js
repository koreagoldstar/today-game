(() => {
  "use strict";

  const A = window.TodayAdult;
  const PATH = "/games/typing-rain/";
  const LIVES = 5;
  const WORDS = window.TypingRainWords;

  const $ = (id) => document.getElementById(id);
  const screens = { title: $("title"), over: $("over") };
  const play = $("play");
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const input = $("type-input");
  const params = new URLSearchParams(location.search);

  /* ---------- 타수: 실제로 누르는 자판 수 (한글은 자음 · 모음 단위, 겹모음 · 겹받침은 2타) ---------- */
  const DOUBLE_MED = new Set([9, 10, 11, 14, 15, 16, 19]);
  const DOUBLE_JONG = new Set([3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18]);
  function strokes(word) {
    let n = 0;
    for (const ch of word) {
      const c = ch.charCodeAt(0) - 0xac00;
      if (c < 0 || c > 11171) {
        n += 1;
        continue;
      }
      const med = Math.floor((c % 588) / 28);
      const jong = c % 28;
      n += 1 + (DOUBLE_MED.has(med) ? 2 : 1) + (jong === 0 ? 0 : DOUBLE_JONG.has(jong) ? 2 : 1);
    }
    return n;
  }
  // 자체 점검: 사과 = ㅅㅏㄱㅗㅏ(5), 닭 = ㄷㅏㄹㄱ(4), cat = 3
  console.assert(strokes("사과") === 5 && strokes("닭") === 4 && strokes("cat") === 3, "타자 소나기 타수 계산 오류");

  /* ---------- 상태 ---------- */
  let lang = params.get("l") === "en" ? "en" : "ko";
  let W = 360;
  let H = 600;
  let dpr = 1;
  let words = []; // { text, x, y, w, kind, born }
  let fx = []; // 터짐 · 점수 글자
  let running = false;
  let paused = false;
  let freezeUntil = 0;
  let lastT = 0;
  let spawnIn = 0;
  let level = 1;
  let poppedInLevel = 0;
  let score = 0;
  let lives = LIVES;
  let popped = 0;
  let totalStrokes = 0;
  let activeMs = 0;
  let pools = null;
  let raf = 0;
  let clouds = [];

  const target = () => 8 + level * 2;
  const fallTime = () => Math.max(4.2, 12.5 - level * 0.75); // 하늘 → 땅까지 걸리는 초
  const spawnGap = () => Math.max(0.75, 2.3 - level * 0.14);
  const groundY = () => H - 74;

  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    play.classList.toggle("hidden", name !== "play");
    document.body.style.overflow = name === "play" ? "hidden" : "";
    window.scrollTo(0, 0);
  }

  /* ---------- 시작 화면 ---------- */
  function bestOf(l) {
    return A.store(`today-adult-tr-best-${l}`, { score: 0, tpm: 0 });
  }

  function paintTitle() {
    document.querySelectorAll("#langs .ad-chip").forEach((c) => c.classList.toggle("on", c.dataset.lang === lang));
    const b = bestOf(lang);
    $("best-line").textContent = b.score ? `최고 ${b.score.toLocaleString("ko-KR")}점 · 최고 ${b.tpm}타` : `${lang === "ko" ? "한글" : "영어"} · 아직 기록 없음`;
    const vs = (params.get("vs") || "").slice(0, 8);
    if (vs) {
      const fb = $("friend-banner");
      fb.classList.remove("hidden");
      fb.innerHTML = `<b>${A.esc(vs)}</b>님이 타자 소나기 도전장을 보냈어요!<br />${params.get("l") === "en" ? "영어" : "한글"} 모드, 누가 더 오래 버틸까?`;
    }
  }

  /* ---------- 화면 크기 (휴대폰 키보드가 올라오면 보이는 높이에 맞춤) ---------- */
  function fitViewport() {
    const vv = window.visualViewport;
    play.style.setProperty("--vvh", `${vv ? vv.height : window.innerHeight}px`);
    play.style.setProperty("--vvtop", `${vv ? vv.offsetTop : 0}px`);
    const r = $("field").getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(200, r.width);
    H = Math.max(200, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- 단어 고르기 ---------- */
  function buildPools() {
    const list = WORDS[lang];
    const len = (w) => (lang === "ko" ? w.length : w.length / 2.2);
    pools = {
      short: list.filter((w) => len(w) <= 2),
      mid: list.filter((w) => len(w) > 2 && len(w) <= 3),
      long: list.filter((w) => len(w) > 3),
    };
  }

  function pickWord() {
    const r = Math.random();
    const longP = Math.min(0.45, 0.04 + level * 0.05);
    const midP = Math.min(0.5, 0.25 + level * 0.04);
    const pool = r < longP ? pools.long : r < longP + midP ? pools.mid : pools.short;
    for (let k = 0; k < 6; k += 1) {
      const w = pool[Math.floor(Math.random() * pool.length)];
      if (!words.some((o) => o.text === w)) return w;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pickKind() {
    if (level < 2 || Math.random() > 0.11) return "normal";
    const r = Math.random();
    if (r < 0.34) return "gold";
    if (r < 0.6) return "ice";
    if (r < 0.82) return "sweep";
    return lives < LIVES ? "heal" : "gold";
  }

  const ICON = { gold: "🌈", ice: "⏸️", sweep: "🧹", heal: "🌱" };

  function spawn() {
    const text = pickWord();
    const kind = pickKind();
    ctx.font = '21px "Jua", sans-serif';
    const w = ctx.measureText(text).width + (kind === "normal" ? 30 : 56);
    let x = 10;
    for (let k = 0; k < 10; k += 1) {
      x = 10 + Math.random() * Math.max(1, W - w - 20);
      const clash = words.some((o) => o.y < 90 && x < o.x + o.w + 10 && x + w + 10 > o.x);
      if (!clash) break;
    }
    words.push({ text, x, y: -40, w, kind, born: performance.now() });
  }

  /* ---------- 진행 ---------- */
  function start() {
    buildPools();
    words = [];
    fx = [];
    level = 1;
    poppedInLevel = 0;
    score = 0;
    lives = LIVES;
    popped = 0;
    totalStrokes = 0;
    activeMs = 0;
    freezeUntil = 0;
    spawnIn = 0.4;
    paused = false;
    clouds = Array.from({ length: 5 }, (_, i) => ({ x: Math.random() * 400, y: 10 + (i % 3) * 22, s: 0.6 + Math.random() * 0.6, v: 6 + Math.random() * 10 }));
    show("play");
    $("paused").classList.add("hidden");
    input.value = "";
    input.placeholder = lang === "ko" ? "단어를 치고 Enter" : "type the word + Enter";
    fitViewport();
    paintHud();
    running = true;
    lastT = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    banner("1단계 시작!");
    setTimeout(() => input.focus(), 50);
  }

  function loop(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (!paused) step(dt, t);
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function step(dt, t) {
    activeMs += dt * 1000;
    clouds.forEach((c) => (c.x = (c.x + c.v * dt) % (W + 200)));
    const frozen = t < freezeUntil;
    if (!frozen) {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = spawnGap() * (0.75 + Math.random() * 0.5);
      }
      const v = (groundY() + 40) / fallTime();
      for (const w of words) w.y += v * dt;
    }
    const gy = groundY();
    for (let i = words.length - 1; i >= 0; i -= 1) {
      const w = words[i];
      if (w.y + 34 >= gy) {
        words.splice(i, 1);
        land(w);
        if (!running) return;
      }
    }
    fx = fx.filter((f) => t - f.t < f.life);
    if (Math.floor(activeMs / 500) !== Math.floor((activeMs - dt * 1000) / 500)) paintHud();
  }

  function land(w) {
    lives -= 1;
    A.sfx("bad");
    fx.push({ kind: "splash", x: w.x + w.w / 2, y: groundY(), t: performance.now(), life: 600 });
    paintHud();
    if (lives <= 0) gameOver();
  }

  /* ---------- 입력 ---------- */
  function submit() {
    const typed = input.value.trim();
    input.value = "";
    highlight = "";
    if (!running || paused || !typed) return;
    let hit = -1;
    words.forEach((w, i) => {
      if (w.text === typed && (hit < 0 || w.y > words[hit].y)) hit = i;
    });
    if (hit < 0) {
      input.classList.remove("miss");
      void input.offsetWidth;
      input.classList.add("miss");
      return;
    }
    const w = words.splice(hit, 1)[0];
    pop(w, 1);
    if (w.kind === "gold") banner("🌈 점수 3배!");
    if (w.kind === "ice") {
      freezeUntil = performance.now() + 3000;
      banner("⏸️ 3초 멈춤!");
    }
    if (w.kind === "sweep") {
      const all = words.splice(0, words.length);
      all.forEach((o) => pop(o, 0.5));
      banner(`🧹 싹쓸이 ${all.length}개!`);
    }
    if (w.kind === "heal" && lives < LIVES) {
      lives += 1;
      banner("🌱 꽃이 살아났어요!");
    }
    A.sfx("tap");
    paintHud();
  }

  /** 단어 하나 터뜨리기 (rate: 싹쓸이로 같이 터진 건 반 점수) */
  function pop(w, rate) {
    const base = strokes(w.text) * 10 * (1 + (level - 1) * 0.2);
    const gain = Math.round(base * rate * (w.kind === "gold" ? 3 : 1));
    score += gain;
    popped += 1;
    if (rate === 1) totalStrokes += strokes(w.text);
    fx.push({ kind: "pop", x: w.x + w.w / 2, y: w.y + 17, t: performance.now(), life: 700, text: `+${gain}` });
    poppedInLevel += 1;
    if (poppedInLevel >= target()) {
      level += 1;
      poppedInLevel = 0;
      A.sfx("win");
      banner(`${level}단계! 더 빨라져요`);
    }
  }

  function tpm() {
    if (activeMs < 5000) return 0;
    return Math.round(totalStrokes / (activeMs / 60000));
  }

  function paintHud() {
    $("hud-score").textContent = score.toLocaleString("ko-KR");
    $("hud-level").textContent = level;
    const s = tpm();
    $("hud-tpm").textContent = s ? s : "-";
  }

  let bannerTimer = 0;
  function banner(text) {
    const el = $("banner");
    el.textContent = text;
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.add("hidden"), 1400);
  }

  /* ---------- 그리기 ---------- */
  let highlight = "";
  function draw(t) {
    const g = ctx;
    g.clearRect(0, 0, W, H);
    // 하늘
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#221a52");
    sky.addColorStop(0.6, "#3a2c78");
    sky.addColorStop(1, "#5a3f8c");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // 빗줄기
    g.strokeStyle = "rgba(190, 210, 255, 0.16)";
    g.lineWidth = 1.5;
    const off = (t / 6) % 40;
    for (let x = -40; x < W + 40; x += 26) {
      for (let y = -40 + ((x * 7) % 40); y < H; y += 80) {
        g.beginPath();
        g.moveTo(x + off * 0.3, y + off);
        g.lineTo(x + off * 0.3 - 4, y + off + 14);
        g.stroke();
      }
    }
    // 구름
    clouds.forEach((c) => {
      const x = c.x - 100;
      g.fillStyle = "rgba(235, 230, 255, 0.85)";
      // 타원마다 따로 그려야 이어지는 선(뾰족한 모서리)이 안 생김
      for (const [dx, dy, rx, ry] of [[0, 16, 46, 18], [28, 8, 30, 22], [-26, 12, 26, 16]]) {
        g.beginPath();
        g.ellipse(x + dx * c.s, c.y + dy, rx * c.s, ry * c.s, 0, 0, Math.PI * 2);
        g.fill();
      }
    });
    const frozen = t < freezeUntil;
    if (frozen) {
      g.fillStyle = "rgba(160, 220, 255, 0.12)";
      g.fillRect(0, 0, W, H);
    }
    // 단어 방울
    g.font = '21px "Jua", sans-serif';
    g.textBaseline = "middle";
    const typed = highlight;
    words.forEach((w) => {
      const match = typed && w.text.startsWith(typed);
      const pal = {
        normal: ["#e9f3ff", "#b9d4ff", "#33406e"],
        gold: ["#fff3c2", "#ffb3d6", "#5a2a00"],
        ice: ["#e6fbff", "#9fe3ff", "#0f4a66"],
        sweep: ["#efe6ff", "#c3a6ff", "#3a1f73"],
        heal: ["#e9fff1", "#9fe7bd", "#14532d"],
      }[w.kind];
      const r = 17;
      g.save();
      g.shadowColor = "rgba(0, 0, 0, 0.35)";
      g.shadowBlur = 10;
      g.shadowOffsetY = 4;
      const grd = g.createLinearGradient(0, w.y, 0, w.y + 34);
      grd.addColorStop(0, pal[0]);
      grd.addColorStop(1, pal[1]);
      g.fillStyle = grd;
      roundRect(g, w.x, w.y, w.w, 34, r);
      g.fill();
      g.restore();
      g.lineWidth = match ? 3 : 1.5;
      g.strokeStyle = match ? "#ffc94a" : "rgba(255, 255, 255, 0.8)";
      roundRect(g, w.x, w.y, w.w, 34, r);
      g.stroke();
      let tx = w.x + 15;
      if (w.kind !== "normal") {
        g.font = '18px "Noto Sans KR", sans-serif';
        g.fillText(ICON[w.kind], w.x + 10, w.y + 18);
        g.font = '21px "Jua", sans-serif';
        tx = w.x + 38;
      }
      if (match) {
        g.fillStyle = "#e2365a";
        g.fillText(typed, tx, w.y + 18);
        g.fillStyle = pal[2];
        g.fillText(w.text.slice(typed.length), tx + g.measureText(typed).width, w.y + 18);
      } else {
        g.fillStyle = pal[2];
        g.fillText(w.text, tx, w.y + 18);
      }
    });
    // 옥상 정원
    const gy = groundY();
    const ground = g.createLinearGradient(0, gy, 0, H);
    ground.addColorStop(0, "#6b4a8f");
    ground.addColorStop(1, "#3e2a5a");
    g.fillStyle = ground;
    g.fillRect(0, gy, W, H - gy);
    g.fillStyle = "rgba(255, 255, 255, 0.12)";
    g.fillRect(0, gy, W, 4);
    for (let i = 0; i < LIVES; i += 1) {
      const cx = (W / (LIVES + 1)) * (i + 1);
      drawFlower(g, cx, gy + 52, i < lives, t + i * 400);
    }
    // 효과
    fx.forEach((f) => {
      const k = (t - f.t) / f.life;
      if (f.kind === "pop") {
        g.globalAlpha = 1 - k;
        g.fillStyle = "#fff6c8";
        for (let j = 0; j < 8; j += 1) {
          const a = (j / 8) * Math.PI * 2;
          g.beginPath();
          g.arc(f.x + Math.cos(a) * 30 * k, f.y + Math.sin(a) * 30 * k, 3, 0, Math.PI * 2);
          g.fill();
        }
        g.font = '20px "Bagel Fat One", "Jua", sans-serif';
        g.textAlign = "center";
        g.fillStyle = "#ffd766";
        g.fillText(f.text, f.x, f.y - 26 * k);
        g.textAlign = "left";
        g.globalAlpha = 1;
      } else {
        g.globalAlpha = 1 - k;
        g.strokeStyle = "#9fd8ff";
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(f.x, f.y, 10 + 30 * k, 4 + 8 * k, 0, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }
    });
    if (frozen) {
      g.font = '16px "Jua", sans-serif';
      g.fillStyle = "#cfefff";
      g.textAlign = "center";
      g.fillText(`⏸️ 멈춤 ${Math.ceil((freezeUntil - t) / 1000)}초`, W / 2, 24);
      g.textAlign = "left";
    }
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawFlower(g, x, y, alive, t) {
    // 화분
    g.fillStyle = "#c46b4a";
    g.beginPath();
    g.moveTo(x - 16, y - 14);
    g.lineTo(x + 16, y - 14);
    g.lineTo(x + 11, y + 6);
    g.lineTo(x - 11, y + 6);
    g.closePath();
    g.fill();
    g.fillStyle = "#e08a62";
    g.fillRect(x - 18, y - 18, 36, 6);
    if (alive) {
      const sway = Math.sin(t / 600) * 3;
      g.strokeStyle = "#4fbf6f";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y - 18);
      g.quadraticCurveTo(x + sway, y - 30, x + sway, y - 40);
      g.stroke();
      g.fillStyle = "#ff8ab5";
      for (let j = 0; j < 5; j += 1) {
        const a = (j / 5) * Math.PI * 2 + t / 2000;
        g.beginPath();
        g.arc(x + sway + Math.cos(a) * 7, y - 44 + Math.sin(a) * 7, 5.5, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#ffd766";
      g.beginPath();
      g.arc(x + sway, y - 44, 4.5, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = "#7a6a5a";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y - 18);
      g.quadraticCurveTo(x + 2, y - 30, x + 12, y - 28);
      g.stroke();
      g.fillStyle = "#8a7a6a";
      g.beginPath();
      g.arc(x + 14, y - 27, 4, 0, Math.PI * 2);
      g.fill();
    }
  }

  /* ---------- 일시정지 · 끝 ---------- */
  function setPaused(on) {
    if (!running) return;
    paused = on;
    $("paused").classList.toggle("hidden", !on);
    if (!on) {
      lastT = performance.now();
      input.focus();
    }
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(raf);
    const speed = tpm();
    const best = bestOf(lang);
    const isBest = score > (best.score || 0);
    A.save(`today-adult-tr-best-${lang}`, { score: Math.max(score, best.score || 0), tpm: Math.max(speed, best.tpm || 0) });
    $("done-emoji").textContent = isBest ? "🏆" : "☔";
    $("done-h").textContent = isBest ? "최고 기록!" : "소나기 끝!";
    $("done-score").textContent = `${score.toLocaleString("ko-KR")}점`;
    $("st-tpm").textContent = speed || "-";
    $("st-level").textContent = level;
    $("st-words").textContent = popped;
    $("done-line").textContent = `${lang === "ko" ? "한글" : "영어"} 모드${speed > (best.tpm || 0) && best.tpm ? " · 🏅 타수 신기록!" : ""}`;
    input.blur();
    A.sfx("bad");
    show("over");
    if (window.TodayDuel) {
      TodayDuel.report(score, {
        label: `${score.toLocaleString("ko-KR")}점 · ${speed}타`,
        parent: $("duel-slot"),
        extra: { l: lang },
        subject: `타자 소나기 (${lang === "ko" ? "한글" : "영어"})`,
      });
    }
  }

  function shareText() {
    return `☔ 타자 소나기 ${lang === "ko" ? "한글" : "영어"} · ${score.toLocaleString("ko-KR")}점\n평균 ${tpm()}타 · ${level}단계 · 단어 ${popped}개 막음`;
  }

  /* ---------- 버튼 ---------- */
  $("langs").addEventListener("click", (e) => {
    const c = e.target.closest(".ad-chip");
    if (!c) return;
    lang = c.dataset.lang;
    paintTitle();
  });
  $("start-btn").addEventListener("click", start);
  $("again-btn").addEventListener("click", start);
  $("home-btn").addEventListener("click", () => {
    paintTitle();
    show("title");
  });
  $("pause-btn").addEventListener("click", () => setPaused(!paused));
  $("resume-btn").addEventListener("click", () => setPaused(false));
  $("quit-btn").addEventListener("click", () => {
    running = false;
    cancelAnimationFrame(raf);
    paintTitle();
    show("title");
  });
  $("share-kakao").addEventListener("click", () =>
    A.kakao({
      gameId: "typing-rain",
      title: `타자 소나기 ${score.toLocaleString("ko-KR")}점 · ${tpm()}타!`,
      description: "쏟아지는 단어를 타자로 막아라! 너는 몇 타?",
      buttonTitle: "나도 도전",
      url: `${A.SITE}${PATH}?l=${lang}`,
    })
  );
  $("share-link").addEventListener("click", () =>
    A.share({ title: "타자 소나기 | 오늘의 게임", text: shareText(), url: `${A.SITE}${PATH}?l=${lang}` })
  );

  // Enter: 폼 제출 (휴대폰 키보드의 완료 · 이동 키도 여기로)
  $("type-form").addEventListener("submit", (e) => {
    e.preventDefault();
    // 한글 조합 중 Enter 는 조합이 끝난 뒤 값으로 처리
    setTimeout(submit, 0);
    input.focus();
  });
  // 스페이스로도 제출 (단어에 띄어쓰기는 없음)
  input.addEventListener("input", () => {
    if (/\s/.test(input.value)) {
      submit();
      return;
    }
    highlight = input.value.trim();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setPaused(!paused);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running && !paused) setPaused(true);
  });
  window.addEventListener("resize", () => running && fitViewport());
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => running && fitViewport());
    window.visualViewport.addEventListener("scroll", () => running && fitViewport());
  }
  // 게임 판을 눌러도 입력칸에 계속 쓰기
  $("field").addEventListener("pointerdown", () => {
    if (running && !paused) setTimeout(() => input.focus(), 0);
  });

  // 자동 점검용 (?test=1 일 때만)
  if (params.has("test")) {
    window.__trTest = { words: () => words.map((w) => ({ text: w.text, y: w.y })), state: () => ({ score, level, lives, popped, running, tpm: tpm() }) };
  }

  paintTitle();
})();
