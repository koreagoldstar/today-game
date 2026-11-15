(() => {
  "use strict";

  const A = window.TodayAdult;
  const BANK = window.ChosungBank;
  const PATH = "/games/chosung-quiz/";
  const PER = 10;
  const POINTS = [10, 7, 4]; // 힌트 0 · 1 · 2개

  const $ = (id) => document.getElementById(id);
  const screens = { title: $("title"), play: $("play"), over: $("over") };
  const params = new URLSearchParams(location.search);
  const today = A.seoulDay();

  /* ---------- 초성 ---------- */
  const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  function choOf(ch) {
    const c = ch.charCodeAt(0) - 0xac00;
    return c >= 0 && c <= 11171 ? CHO[Math.floor(c / 588)] : ch;
  }
  const clean = (s) => String(s).replace(/[\s·.,!?~'"-]/g, "");
  const choString = (s) => [...clean(s)].map(choOf).join("");
  // 자체 점검
  console.assert(choString("김치찌개") === "ㄱㅊㅉㄱ" && clean("티끌 모아 태산") === "티끌모아태산", "초성퀴즈 초성 계산 오류");

  /* ---------- 문제 고르기 (씨앗이 같으면 모두 같은 10문제) ---------- */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  }
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }
  function shuffled(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** 분야를 돌아가며 하나씩 (같은 분야만 몰리지 않게) */
  function pickFrom(tier, count, r) {
    const cats = shuffled(Object.keys(BANK[tier]), r);
    const lists = Object.fromEntries(cats.map((c) => [c, shuffled(BANK[tier][c], r)]));
    const out = [];
    for (let k = 0; out.length < count; k += 1) {
      const c = cats[k % cats.length];
      const q = lists[c][Math.floor(k / cats.length)];
      if (q) out.push({ cat: c, answer: q[0], hint: q[1] });
    }
    return out;
  }
  function setFor(seed) {
    const r = rng(seed);
    return [...pickFrom("easy", 5, r), ...pickFrom("mid", 3, r), ...pickFrom("hard", 2, r)];
  }
  const dailySeed = () => hash(`cq-${today}`);

  /* ---------- 상태 ---------- */
  let game = null; // { seed, daily, qs, idx, hints, marks: ["g"|"y"|"r"], score, startedAt }
  let locked = false;

  const friendSeed = /^\d{1,10}$/.test(params.get("s") || "") ? Number(params.get("s")) : 0;
  const friendName = (params.get("vs") || "").slice(0, 8);

  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    window.scrollTo(0, 0);
  }

  function paintTitle() {
    $("title-today").textContent = `${Number(today.slice(5, 7))}월 ${Number(today.slice(8))}일 문제 · ${PER}문제`;
    const rec = A.store(`today-adult-cq-${today}`, null);
    $("title-done").textContent = rec ? `오늘 기록 ${rec.score}점 ${rec.marks.map(markEmoji).join("")}` : "";
    $("daily-btn").textContent = rec ? "📅 오늘 결과 보기" : "📅 오늘의 문제";
    if (friendSeed) {
      const fb = $("friend-banner");
      fb.classList.remove("hidden");
      fb.innerHTML = `<b>${A.esc(friendName || "친구")}</b>님이 초성퀴즈 도전장을 보냈어요!<br />똑같은 10문제, 누가 더 많이 맞힐까?`;
      $("friend-btn").classList.remove("hidden");
    }
  }

  const markEmoji = (m) => (m === "g" ? "🟩" : m === "y" ? "🟨" : "🟥");

  /* ---------- 시작 ---------- */
  function begin(seed, daily) {
    game = { seed, daily, qs: setFor(seed), idx: 0, hints: 0, marks: [], score: 0, startedAt: Date.now() };
    show("play");
    paintQ();
  }

  function paintQ() {
    locked = false;
    const q = game.qs[game.idx];
    $("cq-mode").textContent = game.daily ? "📅 오늘의 초성퀴즈" : "🎲 연습 세트";
    $("cq-num").textContent = `${game.idx + 1} / ${PER}`;
    $("cq-bar").style.width = `${(game.idx / PER) * 100}%`;
    $("cq-cat").textContent = q.cat;
    paintTiles();
    $("cq-hints").innerHTML = "";
    $("cq-msg").textContent = "";
    const input = $("cq-input");
    input.value = "";
    input.disabled = false;
    $("hint-btn").disabled = false;
    $("hint-btn").textContent = "💡 힌트 (2)";
    $("skip-btn").disabled = false;
    $("next-btn").classList.add("hidden");
    // 휴대폰에서 문제마다 키보드가 다시 뜨지 않게, 이미 입력 중일 때만 이어서 포커스
    if (document.activeElement === input || window.matchMedia("(hover: hover)").matches) input.focus();
  }

  /** state: "" (초성) | "peek" (첫 글자 공개) | "open" (정답) | "miss" (넘김) */
  function paintTiles(state = "") {
    const q = game.qs[game.idx];
    const chars = [...q.answer];
    const box = $("cq-tiles");
    box.classList.toggle("long", chars.length > 7);
    let n = 0;
    box.innerHTML = chars
      .map((ch) => {
        if (ch === " ") return `<span class="cq-tile gap"></span>`;
        const i = n++;
        if (state === "open" || state === "miss") return `<span class="cq-tile ${state}" style="animation-delay:${i * 0.04}s">${ch}</span>`;
        if (game.hints >= 2 && i === 0) return `<span class="cq-tile peek">${ch}</span>`;
        return `<span class="cq-tile">${choOf(ch)}</span>`;
      })
      .join("");
  }

  /* ---------- 답 확인 ---------- */
  function check() {
    if (!game || locked) return;
    const input = $("cq-input");
    const guess = clean(input.value);
    if (!guess) return;
    const q = game.qs[game.idx];
    if (guess === clean(q.answer)) {
      solve(true);
      return;
    }
    const card = $("cq-card");
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
    A.sfx("bad");
    $("cq-msg").textContent = choString(guess) === choString(q.answer) ? "초성은 맞아요! 그런데 정답은 다른 말이에요" : "초성이 달라요. 다시 해 봐요!";
    input.select();
  }

  function useHint() {
    if (!game || locked || game.hints >= 2) return;
    game.hints += 1;
    const q = game.qs[game.idx];
    const box = $("cq-hints");
    if (game.hints === 1) box.insertAdjacentHTML("beforeend", `<p class="cq-hint">💡 ${A.esc(q.hint)}</p>`);
    else {
      box.insertAdjacentHTML("beforeend", `<p class="cq-hint">🔤 첫 글자는 <b>${A.esc(q.answer[0])}</b></p>`);
      paintTiles();
    }
    $("hint-btn").textContent = game.hints >= 2 ? "💡 힌트 끝" : `💡 힌트 (${2 - game.hints})`;
    $("hint-btn").disabled = game.hints >= 2;
    A.sfx("tap");
  }

  function solve(right) {
    locked = true;
    const q = game.qs[game.idx];
    const pts = right ? POINTS[game.hints] : 0;
    game.score += pts;
    game.marks.push(!right ? "r" : game.hints ? "y" : "g");
    paintTiles(right ? "open" : "miss");
    $("cq-msg").textContent = right ? `⭕ 정답! +${pts}점` : `정답은 「${q.answer}」`;
    A.sfx(right ? "win" : "bad");
    $("cq-input").disabled = true;
    $("hint-btn").disabled = true;
    $("skip-btn").disabled = true;
    $("next-btn").textContent = game.idx + 1 >= PER ? "결과 보기" : "다음 문제";
    $("next-btn").classList.remove("hidden");
    game.hints = 0;
  }

  function next() {
    game.idx += 1;
    if (game.idx >= PER) {
      finish();
      return;
    }
    paintQ();
  }

  /* ---------- 끝 ---------- */
  function finish() {
    const sec = Math.round((Date.now() - game.startedAt) / 1000);
    if (game.daily && !A.store(`today-adult-cq-${today}`, null)) {
      A.save(`today-adult-cq-${today}`, { score: game.score, marks: game.marks, sec });
    }
    paintOver(sec);
    show("over");
    if (window.TodayDuel) {
      TodayDuel.report(game.score, {
        label: `${game.score}점`,
        parent: $("duel-slot"),
        extra: { s: game.seed },
        subject: game.daily ? "오늘의 초성퀴즈" : "초성퀴즈 연습 세트",
      });
    }
  }

  function paintOver(sec) {
    const s = game.score;
    $("done-emoji").textContent = s >= 90 ? "🏆" : s >= 70 ? "😎" : s >= 40 ? "🙂" : "🤔";
    $("done-h").textContent = game.daily ? `${Number(today.slice(5, 7))}월 ${Number(today.slice(8))}일 초성퀴즈` : "초성퀴즈 연습 세트";
    $("done-score").textContent = `${s}점`;
    $("done-marks").textContent = game.marks.map(markEmoji).join("");
    const right = game.marks.filter((m) => m !== "r").length;
    $("done-line").textContent = `${right}문제 맞힘${sec ? ` · ${Math.floor(sec / 60)}분 ${sec % 60}초` : ""}`;
    $("done-list").innerHTML = game.qs
      .map((q, i) => `<li><span class="m">${markEmoji(game.marks[i])}</span><span class="c">${A.esc(q.cat)} · ${choString(q.answer)}</span><span class="a">${A.esc(q.answer)}</span></li>`)
      .join("");
  }

  function shareText() {
    const head = game.daily ? `🔤 오늘의 초성퀴즈 ${Number(today.slice(5, 7))}/${Number(today.slice(8))}` : "🔤 초성퀴즈 연습 세트";
    return `${head} · ${game.score}점\n${game.marks.map(markEmoji).join("")}`;
  }

  function shareUrl() {
    const q = new URLSearchParams({ s: String(game.seed) });
    try {
      const name = (localStorage.getItem("today-game-name") || "").slice(0, 8);
      if (name) q.set("vs", name);
    } catch (_) {
      /* 없음 */
    }
    q.set("vss", String(game.score));
    q.set("vsl", `${game.score}점`);
    return `${A.SITE}${PATH}?${q.toString()}`;
  }

  /* ---------- 버튼 ---------- */
  $("daily-btn").addEventListener("click", () => {
    const rec = A.store(`today-adult-cq-${today}`, null);
    if (rec) {
      // 오늘 문제 결과 다시 보기 (같은 씨앗이라 문제를 다시 만들 수 있음)
      game = { seed: dailySeed(), daily: true, qs: setFor(dailySeed()), idx: PER, hints: 0, marks: rec.marks, score: rec.score, startedAt: 0 };
      paintOver(rec.sec || 0);
      show("over");
      return;
    }
    begin(dailySeed(), true);
  });
  $("random-btn").addEventListener("click", () => begin(Math.floor(Math.random() * 1e9) + 1, false));
  $("friend-btn").addEventListener("click", () => begin(friendSeed, friendSeed === dailySeed()));
  $("again-btn").addEventListener("click", () => begin(Math.floor(Math.random() * 1e9) + 1, false));
  $("home-btn").addEventListener("click", () => {
    paintTitle();
    show("title");
  });
  $("cq-form").addEventListener("submit", (e) => {
    e.preventDefault();
    // 한글 조합 중 Enter 는 조합이 끝난 값으로 확인
    setTimeout(check, 0);
  });
  $("hint-btn").addEventListener("click", useHint);
  $("skip-btn").addEventListener("click", () => {
    if (!game || locked) return;
    solve(false);
  });
  $("next-btn").addEventListener("click", next);
  document.addEventListener("keydown", (e) => {
    if (screens.play.classList.contains("hidden") || !locked) return;
    if (e.key === "Enter") {
      e.preventDefault();
      next();
    }
  });
  $("share-kakao").addEventListener("click", () =>
    A.kakao({
      gameId: "chosung-quiz",
      title: `초성퀴즈 ${game.score}점 ${game.marks.map(markEmoji).join("")}`,
      description: "초성만 보고 맞혀 봐! 같은 10문제, 너는 몇 점?",
      buttonTitle: "같은 문제 풀기",
      url: shareUrl(),
    })
  );
  $("share-link").addEventListener("click", () => A.share({ title: "오늘의 초성퀴즈 | 오늘의 게임", text: shareText(), url: shareUrl() }));

  // 자동 점검용 (?test=1 일 때만)
  if (params.has("test")) window.__cqTest = { answer: () => game && game.qs[game.idx] && game.qs[game.idx].answer, set: () => game && game.qs.map((q) => q.answer) };

  paintTitle();
})();
