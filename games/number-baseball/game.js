(() => {
  "use strict";

  const A = window.TodayAdult;
  const PATH = "/games/number-baseball/";
  const MAX = 10;
  const CUR_KEY = "today-adult-nb-cur";

  const $ = (id) => document.getElementById(id);
  const screens = { title: $("title"), play: $("play"), over: $("over") };
  const params = new URLSearchParams(location.search);
  const today = A.seoulDay();

  /* ---------- 문제 만들기 (씨앗이 같으면 모두 같은 숫자) ---------- */
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

  /** 1~9 중 서로 다른 n개 */
  function secretOf(seed, n) {
    const r = rng(seed);
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n).join("");
  }

  /** 스트라이크 · 볼 세기 */
  function judge(secret, guess) {
    let s = 0;
    let b = 0;
    for (let i = 0; i < guess.length; i += 1) {
      if (guess[i] === secret[i]) s += 1;
      else if (secret.includes(guess[i])) b += 1;
    }
    return { s, b };
  }
  // 자체 점검: 세는 규칙이 바뀌면 바로 알 수 있게
  console.assert(judge("456", "465").s === 1 && judge("456", "465").b === 2, "숫자야구 판정 오류");
  console.assert(judge("1234", "5678").s === 0 && judge("1234", "5678").b === 0, "숫자야구 판정 오류");

  const dailySeed = (n) => hash(`nb-${today}-${n}`);

  /* ---------- 상태 ---------- */
  let size = 3;
  let game = null; // { seed, n, daily, secret, guesses: [{g, s, b}], memo: [0..2 x9], done, won, at }
  let entry = "";

  const friendSeed = /^\d{1,10}$/.test(params.get("s") || "") ? Number(params.get("s")) : 0;
  const friendSize = params.get("k") === "4" ? 4 : 3;
  const friendName = (params.get("vs") || "").slice(0, 8);

  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    window.scrollTo(0, 0);
  }

  function dailyRecord(n) {
    return A.store(`today-adult-nb-${today}-${n}`, null);
  }

  function paintTitle() {
    document.querySelectorAll("#sizes .ad-chip").forEach((c) => c.classList.toggle("on", Number(c.dataset.n) === size));
    const rec = dailyRecord(size);
    const best = A.store(`today-adult-nb-best-${size}`, 0);
    const parts = [];
    if (rec) parts.push(rec.won ? `오늘 기록 ${rec.tries}번 만에 홈런` : "오늘 문제는 아웃… 연습으로 다시!");
    if (best) parts.push(`최고 ${best}번`);
    $("best-line").textContent = parts.join(" · ") || `${size}자리 · 아직 기록 없음`;
    $("daily-btn").textContent = rec ? "⚾ 오늘 기록 보기" : "⚾ 오늘의 숫자야구";

    const cur = A.store(CUR_KEY, null);
    $("resume-btn").classList.toggle("hidden", !(cur && !cur.done && cur.guesses && cur.guesses.length));

    if (friendSeed) {
      const fb = $("friend-banner");
      fb.classList.remove("hidden");
      fb.innerHTML = `<b>${A.esc(friendName || "친구")}</b>님이 숫자야구 도전장을 보냈어요!<br />똑같은 ${friendSize}자리 문제, 누가 더 적게 던질까?`;
      $("friend-btn").classList.remove("hidden");
    }
  }

  /* ---------- 시작 ---------- */
  function begin(seed, n, daily) {
    game = { seed, n, daily, secret: secretOf(seed, n), guesses: [], memo: Array(10).fill(0), done: false, won: false, at: Date.now() };
    entry = "";
    save();
    openPlay();
  }

  function openPlay() {
    buildPad();
    paint();
    show("play");
  }

  function save() {
    if (game) A.save(CUR_KEY, game);
  }

  /* ---------- 화면 ---------- */
  function buildPad() {
    const memo = $("memo");
    memo.innerHTML = "";
    for (let d = 1; d <= 9; d += 1) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = d;
      b.dataset.d = d;
      b.setAttribute("aria-label", `${d} 메모`);
      b.addEventListener("click", () => cycleMemo(d));
      memo.appendChild(b);
    }
    const pad = $("pad");
    pad.innerHTML = "";
    for (let d = 1; d <= 9; d += 1) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nb-key";
      b.textContent = d;
      b.dataset.d = d;
      b.addEventListener("click", () => press(String(d)));
      pad.appendChild(b);
    }
    const del = document.createElement("button");
    del.type = "button";
    del.className = "nb-key del";
    del.textContent = "⌫ 지움";
    del.addEventListener("click", back);
    pad.appendChild(del);
  }

  function paint() {
    const n = game.n;
    $("nb-name").textContent = `${game.daily ? "오늘의 숫자야구" : "연습 한 판"} · ${n}자리`;
    $("nb-tries").textContent = `${Math.min(game.guesses.length + 1, MAX)} / ${MAX}번`;

    // 기록
    $("history").innerHTML = game.guesses
      .map((g, i) => {
        const res =
          g.s === n
            ? `<b class="hr">홈런!</b>`
            : g.s + g.b === 0
              ? `<b class="o">아웃</b>`
              : `${g.s ? `<b class="s">${g.s}S</b>` : ""}${g.b ? `<b class="b">${g.b}B</b>` : ""}`;
        return `<li class="nb-row"><span class="nb-try">${i + 1}</span><span class="nb-digits">${g.g
          .split("")
          .map((d) => `<i>${d}</i>`)
          .join("")}</span><span class="nb-judge">${res}</span></li>`;
      })
      .join("");
    const hist = $("history");
    hist.scrollTop = hist.scrollHeight;

    // 입력 칸
    $("slots").innerHTML = Array.from({ length: n }, (_, i) => {
      const d = entry[i];
      return `<span class="nb-slot${d ? " full" : i === entry.length ? " next" : ""}">${d || ""}</span>`;
    }).join("");

    // 메모 · 숫자판
    document.querySelectorAll("#memo button").forEach((b) => {
      const m = game.memo[Number(b.dataset.d)];
      b.className = m === 1 ? "no" : m === 2 ? "yes" : "";
    });
    document.querySelectorAll("#pad .nb-key[data-d]").forEach((b) => {
      const d = b.dataset.d;
      const m = game.memo[Number(d)];
      b.disabled = entry.includes(d) || entry.length >= n;
      b.classList.toggle("no", m === 1);
      b.classList.toggle("yes", m === 2);
    });
    $("throw-btn").disabled = entry.length !== n;
  }

  function msg(text) {
    $("msg").textContent = text;
    clearTimeout(msg.t);
    if (text) msg.t = setTimeout(() => ($("msg").textContent = ""), 1800);
  }

  /* ---------- 입력 ---------- */
  function press(d) {
    if (!game || game.done) return;
    if (entry.length >= game.n || entry.includes(d)) return;
    entry += d;
    A.sfx("tap");
    paint();
  }

  function back() {
    if (!game || game.done || !entry) return;
    entry = entry.slice(0, -1);
    paint();
  }

  function cycleMemo(d) {
    if (!game) return;
    game.memo[d] = (game.memo[d] + 1) % 3;
    save();
    paint();
  }

  function throwBall() {
    if (!game || game.done || entry.length !== game.n) return;
    if (game.guesses.some((g) => g.g === entry)) {
      msg("이미 던진 숫자예요");
      return;
    }
    const { s, b } = judge(game.secret, entry);
    game.guesses.push({ g: entry, s, b });
    // 아웃이면 그 숫자들은 없음(✕)으로 자동 메모
    if (s + b === 0) entry.split("").forEach((d) => (game.memo[Number(d)] = 1));
    entry = "";
    if (s === game.n) {
      finish(true);
      return;
    }
    A.sfx(s + b === 0 ? "bad" : "pick");
    if (game.guesses.length >= MAX) {
      finish(false);
      return;
    }
    msg(s + b === 0 ? "아웃! 이 숫자들은 하나도 없어요" : `${s} 스트라이크 ${b} 볼`);
    save();
    paint();
  }

  /* ---------- 끝 ---------- */
  function finish(won) {
    game.done = true;
    game.won = won;
    save();
    paint();
    A.sfx(won ? "win" : "bad");
    const tries = game.guesses.length;

    if (game.daily && !dailyRecord(game.n)) A.save(`today-adult-nb-${today}-${game.n}`, { tries, won });
    let isBest = false;
    if (won) {
      const best = A.store(`today-adult-nb-best-${game.n}`, 0);
      if (!best || tries < best) {
        A.save(`today-adult-nb-best-${game.n}`, tries);
        isBest = Boolean(best);
      }
    }
    paintOver(isBest);
    setTimeout(() => {
      show("over");
      if (won && window.TodayDuel) {
        TodayDuel.report(tries, {
          label: `${tries}번`,
          lowerIsBetter: true,
          parent: $("duel-slot"),
          extra: { s: game.seed, k: game.n },
          subject: `${game.n}자리 숫자야구`,
        });
      }
    }, 700);
  }

  function paintOver(isBest) {
    const tries = game.guesses.length;
    $("done-emoji").textContent = game.won ? (tries <= 4 ? "🏆" : "⚾") : "😵";
    $("done-h").textContent = game.won ? "홈런!" : "삼진 아웃…";
    $("done-big").textContent = game.won ? `${tries}번 만에 맞혔어요` : `${MAX}번 안에 못 맞혔어요`;
    $("done-line").textContent = `${game.daily ? `오늘의 숫자야구 ${today.slice(5).replace("-", "/")}` : "연습 한 판"} · ${game.n}자리${isBest ? " · 🏅 최고 기록!" : ""}`;
    $("done-answer").innerHTML = game.secret
      .split("")
      .map((d) => `<i>${d}</i>`)
      .join("");
    $("share-grid").textContent = shareText();
  }

  function shareText() {
    const head = game.won
      ? `⚾ ${game.daily ? "오늘의 숫자야구" : "숫자야구"} ${game.n}자리 · ${game.guesses.length}번 만에 홈런!`
      : `⚾ ${game.daily ? "오늘의 숫자야구" : "숫자야구"} ${game.n}자리 · 삼진 아웃…`;
    const lines = game.guesses.map((g) => "🟢".repeat(g.s) + "🟡".repeat(g.b) + "⚪".repeat(game.n - g.s - g.b));
    return `${head}\n${lines.join("\n")}`;
  }

  function shareUrl() {
    const q = new URLSearchParams({ s: String(game.seed), k: String(game.n) });
    let name = "";
    try {
      name = (localStorage.getItem("today-game-name") || "").slice(0, 8);
    } catch (_) {
      /* 없음 */
    }
    if (name) q.set("vs", name);
    if (game.won) {
      q.set("vss", String(game.guesses.length));
      q.set("vsl", `${game.guesses.length}번`);
      q.set("vsd", "1");
    }
    return `${A.SITE}${PATH}?${q.toString()}`;
  }

  /* ---------- 버튼 ---------- */
  $("sizes").addEventListener("click", (e) => {
    const c = e.target.closest(".ad-chip");
    if (!c) return;
    size = Number(c.dataset.n);
    paintTitle();
  });

  $("daily-btn").addEventListener("click", () => {
    const rec = dailyRecord(size);
    const cur = A.store(CUR_KEY, null);
    const seed = dailySeed(size);
    if (cur && cur.seed === seed && cur.n === size && (rec || !cur.done)) {
      game = cur;
      entry = "";
      if (game.done) {
        paint();
        paintOver(false);
        show("over");
      } else openPlay();
      return;
    }
    if (rec) {
      A.toast("오늘 문제는 이미 했어요. 연습 한 판으로 더 즐겨요!");
      return;
    }
    begin(seed, size, true);
  });

  $("random-btn").addEventListener("click", () => begin(Math.floor(Math.random() * 1e9) + 1, size, false));
  $("friend-btn").addEventListener("click", () => begin(friendSeed, friendSize, friendSeed === dailySeed(friendSize)));
  $("resume-btn").addEventListener("click", () => {
    const cur = A.store(CUR_KEY, null);
    if (!cur || cur.done) return;
    game = cur;
    size = cur.n;
    entry = "";
    openPlay();
  });

  $("throw-btn").addEventListener("click", throwBall);
  $("quit-btn").addEventListener("click", () => {
    paintTitle();
    show("title");
  });
  $("next-btn").addEventListener("click", () => begin(Math.floor(Math.random() * 1e9) + 1, game ? game.n : size, false));
  $("home-btn").addEventListener("click", () => {
    paintTitle();
    show("title");
  });

  $("share-kakao").addEventListener("click", () =>
    A.kakao({
      gameId: "number-baseball",
      title: game.won ? `숫자야구 ${game.guesses.length}번 만에 홈런!` : "숫자야구, 나는 삼진 아웃… 너는?",
      description: `${game.n}자리 · 똑같은 문제로 대결해요`,
      buttonTitle: "같은 문제 도전",
      url: shareUrl(),
    })
  );
  $("share-link").addEventListener("click", () =>
    A.share({ title: "숫자야구 | 오늘의 게임", text: shareText(), url: shareUrl() })
  );

  document.addEventListener("keydown", (e) => {
    if (screens.play.classList.contains("hidden") || !game || game.done) return;
    if (/^[1-9]$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") back();
    else if (e.key === "Enter") {
      e.preventDefault();
      throwBall();
    }
  });

  if (friendSeed) size = friendSize;
  paintTitle();
})();
