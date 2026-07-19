(() => {
  "use strict";

  /** @typedef {{ id: string, title: string, tag: string, href: string, thumb?: string, emoji?: string, category: string }} GameEntry */

  /** @type {{ id: string, title: string, desc: string }[]} */
  const CATEGORIES = [
    { id: "archive", title: "고전 게임", desc: "Internet Archive로 원작 플레이" },
    { id: "rhythm", title: "리듬 · 음악", desc: "비트에 맞춰 톡톡" },
    { id: "sports", title: "스포츠 · 레이싱", desc: "공 치고 달리고" },
    { id: "action", title: "액션 · 슈팅", desc: "손맛 있게 쏘고 피하는 게임" },
    { id: "puzzle", title: "퍼즐 · 두뇌", desc: "생각하고 맞추는 게임" },
    { id: "arcade", title: "아케이드 · 캐치", desc: "짧게 중독되는 캐주얼" },
  ];

  /** @type {GameEntry[]} — 새 게임은 배열 맨 앞에 추가 (위쪽·최신순) */
  const GAMES = [
    {
      id: "wordle",
      title: "오늘의 워들",
      tag: "퍼즐 · 하루 100문제",
      href: "/games/wordle/",
      thumb: "/assets/thumbs/wordle.png",
      category: "puzzle",
    },
    {
      id: "doodle",
      title: "폴짝 하늘",
      tag: "점프 · 랭킹",
      href: "/games/doodle/",
      thumb: "/assets/thumbs/doodle.png",
      category: "arcade",
    },
    {
      id: "flappy",
      title: "펄럭 병아리",
      tag: "아케이드 · 랭킹",
      href: "/games/flappy/",
      thumb: "/assets/thumbs/flappy.png",
      category: "arcade",
    },
    {
      id: "pinball",
      title: "핀볼팡팡",
      tag: "아케이드 · 50단계",
      href: "/games/pinball/",
      thumb: "/assets/thumbs/pinball.png",
      category: "arcade",
    },
    {
      id: "jump-run",
      title: "콩콩 점프",
      tag: "점프런 · 무한 · 랭킹",
      href: "/games/jump-run/",
      thumb: "/assets/thumbs/jump-run.png",
      category: "action",
    },
    {
      id: "rps",
      title: "가위바위보",
      tag: "대결 · 연승",
      href: "/games/rps/",
      thumb: "/assets/thumbs/rps.png",
      category: "arcade",
    },
    {
      id: "odd-even",
      title: "홀짝 팡",
      tag: "운 · 연속도전",
      href: "/games/odd-even/",
      thumb: "/assets/thumbs/odd-even.png",
      category: "arcade",
    },
    {
      id: "donkey-kong",
      title: "동키콩",
      tag: "Internet Archive",
      href: "/games/donkey-kong/",
      thumb: "/assets/thumbs/donkey-kong.png",
      category: "archive",
    },
    {
      id: "prince",
      title: "프린스 오브 페르시아",
      tag: "Internet Archive",
      href: "/games/prince/",
      thumb: "/assets/thumbs/prince.png",
      category: "archive",
    },
    {
      id: "lemmings",
      title: "레밍즈",
      tag: "Internet Archive",
      href: "/games/lemmings/",
      thumb: "/assets/thumbs/lemmings.png",
      category: "archive",
    },
    {
      id: "bubble-bobble",
      title: "보글보글",
      tag: "Internet Arcade",
      href: "/games/bubble-bobble/",
      thumb: "/assets/thumbs/bubble-bobble.png",
      category: "archive",
    },
    {
      id: "pacman-classic",
      title: "팩맨",
      tag: "Internet Arcade",
      href: "/games/pacman-classic/",
      thumb: "/assets/thumbs/pacman-classic.png",
      category: "archive",
    },
    {
      id: "galaga",
      title: "갤러그",
      tag: "Internet Arcade",
      href: "/games/galaga/",
      thumb: "/assets/thumbs/galaga.png",
      category: "archive",
    },
    {
      id: "lode-runner",
      title: "로드러너",
      tag: "Internet Archive",
      href: "/games/lode-runner/",
      thumb: "/assets/thumbs/lode-runner.png",
      category: "archive",
    },
    {
      id: "goindol",
      title: "고인돌",
      tag: "Internet Archive",
      href: "/games/sinseokgi/",
      thumb: "/assets/thumbs/goindol.png",
      category: "archive",
    },
    {
      id: "snake",
      title: "애플 스네이크",
      tag: "아케이드 · 50단계",
      href: "/games/snake/",
      thumb: "/assets/thumbs/snake.png",
      category: "arcade",
    },
    {
      id: "minesweeper",
      title: "지뢰찾기",
      tag: "퍼즐 · 추억",
      href: "/games/minesweeper/",
      thumb: "/assets/thumbs/minesweeper.png",
      category: "puzzle",
    },
    {
      id: "alggagi",
      title: "알까기",
      tag: "대결 · 50단계",
      href: "/games/alggagi/",
      thumb: "/assets/thumbs/alggagi.png",
      category: "sports",
    },
    {
      id: "whack-mole",
      title: "두더지 팡팡",
      tag: "반응 · 50단계",
      href: "/games/whack-mole/",
      thumb: "/assets/thumbs/whack-mole.png",
      category: "arcade",
    },
    {
      id: "omok",
      title: "오목",
      tag: "대국 · AI",
      href: "/games/omok/",
      thumb: "/assets/thumbs/omok.png",
      category: "puzzle",
    },
    {
      id: "ninja-dodge",
      title: "닌자 표창 피하기",
      tag: "회피 · 무한 · 랭킹",
      href: "/games/ninja-dodge/",
      thumb: "/assets/thumbs/ninja-dodge.png",
      category: "action",
    },
    {
      id: "stork-stride",
      title: "서빙왕",
      tag: "균형 · 접시탑",
      href: "/games/stork-stride/",
      thumb: "/assets/thumbs/stork-stride.png",
      category: "arcade",
    },
    {
      id: "tetris",
      title: "블록 팡팡",
      tag: "퍼즐 · 단계/무한",
      href: "/games/tetris/",
      thumb: "/assets/thumbs/tetris.png",
      category: "puzzle",
    },
    {
      id: "dual-pad",
      title: "듀얼 패드",
      tag: "양손 탭 · 20곡",
      href: "/games/dual-pad/",
      thumb: "/assets/thumbs/dual-pad.svg",
      category: "rhythm",
    },
    {
      id: "slide-beat",
      title: "슬라이드 비트",
      tag: "가로 레인 · 20곡",
      href: "/games/slide-beat/",
      thumb: "/assets/thumbs/slide-beat.svg",
      category: "rhythm",
    },
    {
      id: "beat-tap",
      title: "펄스 탭",
      tag: "원버튼 · 20곡",
      href: "/games/beat-tap/",
      thumb: "/assets/thumbs/beat-tap.svg",
      category: "rhythm",
    },
    {
      id: "rhythm",
      title: "리듬 톡톡",
      tag: "리듬 · 50곡",
      href: "/games/rhythm/",
      thumb: "/assets/thumbs/rhythm.png",
      category: "rhythm",
    },
    {
      id: "minigolf",
      title: "홀인원 골프",
      tag: "골프 · 18홀",
      href: "/games/minigolf/",
      thumb: "/assets/thumbs/minigolf.png",
      category: "sports",
    },
    {
      id: "racing",
      title: "스피드 삐약이",
      tag: "레이싱 · 50단계",
      href: "/games/racing/",
      thumb: "/assets/thumbs/racing.png",
      category: "sports",
    },
    {
      id: "crossy",
      title: "삐약이 건너기",
      tag: "액션 · 50단계",
      href: "/games/crossy/",
      thumb: "/assets/thumbs/crossy.png",
      category: "action",
    },
    {
      id: "cute-shoot",
      title: "귀염뽀짝 쏘세요",
      tag: "슈팅 · 자체제작",
      href: "/games/cute-shoot/",
      thumb: "/assets/thumbs/cute-shoot.png",
      category: "action",
    },
    {
      id: "brick",
      title: "별똥별 벽돌깨기",
      tag: "아케이드 · 50단계",
      href: "/games/brick/",
      thumb: "/assets/thumbs/brick.png",
      category: "action",
    },
    {
      id: "puzzle-bubble",
      title: "팝샷 버블",
      tag: "슈팅 · 50단계",
      href: "/games/puzzle-bubble/",
      thumb: "/assets/thumbs/puzzlebubble.png",
      category: "action",
    },
    {
      id: "ttamogi",
      title: "땅땅 차지",
      tag: "아케이드 · 38단계",
      href: "/games/ttamogi/",
      thumb: "/assets/thumbs/ttamogi.png",
      category: "action",
    },
    {
      id: "memory",
      title: "짝짝 사천성",
      tag: "연결 · 60단계",
      href: "/games/memory/",
      thumb: "/assets/thumbs/sacheon.png",
      category: "puzzle",
    },
    {
      id: "diff",
      title: "다른 그림 찾기",
      tag: "찾기 · 50단계",
      href: "/games/diff/",
      thumb: "/assets/thumbs/diff.png",
      category: "puzzle",
    },
    {
      id: "suika",
      title: "수박 합치기",
      tag: "머지 · 물리",
      href: "/games/suika/",
      thumb: "/assets/thumbs/suika.png",
      category: "puzzle",
    },
    {
      id: "sokoban",
      title: "상자야 굴러가",
      tag: "퍼즐 · 50단계",
      href: "/games/sokoban/",
      thumb: "/assets/thumbs/sokoban.png",
      category: "puzzle",
    },
    {
      id: "slide-2048",
      title: "두배두배",
      tag: "퍼즐 · 2048",
      href: "/games/slide-2048/",
      thumb: "/assets/thumbs/2048.png",
      category: "puzzle",
    },
    {
      id: "tower",
      title: "흔들흔들 스카이",
      tag: "타이밍 · 쌓기",
      href: "/games/tower/",
      thumb: "/assets/thumbs/tower.png",
      category: "arcade",
    },
    {
      id: "fruit-catch",
      title: "과일 바스켓",
      tag: "캐치 · 50단계",
      href: "/games/fruit-catch/",
      thumb: "/assets/thumbs/fruit.png",
      category: "arcade",
    },
    {
      id: "bubble-pop",
      title: "팝팝 방울",
      tag: "탭 · 50단계",
      href: "/games/bubble-pop/",
      thumb: "/assets/thumbs/bubble.png",
      category: "arcade",
    },
  ];

  const catalog = document.getElementById("catalog");
  const todayLabel = document.getElementById("today-label");
  const sparkles = document.getElementById("sparkles");
  const visitCount = document.getElementById("visit-count");

  function formatToday() {
    const now = new Date();
    const week = ["일", "월", "화", "수", "목", "금", "토"];
    return `${now.getMonth() + 1}월 ${now.getDate()}일 ${week[now.getDay()]}요일`;
  }

  function todayKey() {
    return new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
  }

  async function loadVisitors() {
    const day = todayKey();
    const flag = `today-game-visit-${day}`;
    const firstToday = !localStorage.getItem(flag);
    if (firstToday) localStorage.setItem(flag, "1");

    try {
      const res = await fetch(`/api/visits${firstToday ? "?count=1" : ""}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json();
      if (data && data.today != null) {
        visitCount.textContent = Number(data.today).toLocaleString("ko-KR");
        return;
      }
    } catch (_) {
      /* fall through */
    }

    const localKey = `today-game-local-${day}`;
    let n = Number(localStorage.getItem(localKey) || "0");
    if (firstToday) {
      n += 1;
      localStorage.setItem(localKey, String(n));
    }
    visitCount.textContent = n.toLocaleString("ko-KR");
  }

  function createGameSlot(game) {
    const a = document.createElement("a");
    a.className = game.thumb ? "slot has-photo" : "slot";
    a.href = game.href;
    a.setAttribute("aria-label", `${game.title} 플레이`);
    const art = game.thumb
      ? `<img src="${game.thumb}" alt="" loading="lazy" width="220" height="220" />`
      : `<span class="slot-emoji" aria-hidden="true">${game.emoji || "🎮"}</span>`;
    a.innerHTML = `
      <div class="slot-art">${art}</div>
      <div class="slot-meta">
        <p class="slot-name">${game.title}</p>
        <p class="slot-tag">${game.tag}</p>
        <span class="slot-play">플레이</span>
      </div>
    `;
    return a;
  }

  function gameIndex(game) {
    return GAMES.indexOf(game);
  }

  /** 고전: 고인돌 맨 앞 / 리듬: 리듬 톡톡 맨 앞, 나머지는 최신순 */
  function sortShelfGames(catId, games) {
    return games.slice().sort((a, b) => {
      if (catId === "archive") {
        if (a.id === "goindol") return -1;
        if (b.id === "goindol") return 1;
      }
      if (catId === "rhythm") {
        if (a.id === "rhythm") return -1;
        if (b.id === "rhythm") return 1;
      }
      return gameIndex(a) - gameIndex(b);
    });
  }

  function renderCatalog() {
    const frag = document.createDocumentFragment();

    const shelves = CATEGORIES.map((cat) => {
      const games = sortShelfGames(
        cat.id,
        GAMES.filter((g) => g.category === cat.id)
      );
      // 카테고리 순서용: 고인돌은 제외하고 최신 게임 기준
      const orderGames = cat.id === "archive" ? games.filter((g) => g.id !== "goindol") : games;
      const newest = orderGames.length
        ? Math.min(...orderGames.map(gameIndex))
        : games.length
          ? gameIndex(games[0])
          : Number.POSITIVE_INFINITY;
      return { cat, games, newest };
    })
      .filter((shelf) => shelf.games.length > 0)
      .sort((a, b) => a.newest - b.newest);

    shelves.forEach(({ cat, games }) => {
      const section = document.createElement("section");
      section.className = "cat-shelf";
      section.id = `cat-${cat.id}`;
      section.setAttribute("aria-labelledby", `cat-title-${cat.id}`);

      const head = document.createElement("div");
      head.className = "cat-head";
      head.innerHTML = `
        <div>
          <h3 class="cat-title" id="cat-title-${cat.id}">${cat.title}</h3>
          <p class="cat-desc">${cat.desc}</p>
        </div>
        <span class="cat-count">${games.length}개</span>
      `;
      section.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "game-grid";
      games.forEach((game) => grid.appendChild(createGameSlot(game)));
      section.appendChild(grid);
      frag.appendChild(section);
    });

    catalog.appendChild(frag);
  }

  function spawnSparkles() {
    for (let i = 0; i < 14; i += 1) {
      const s = document.createElement("span");
      s.className = "sparkle";
      s.style.left = `${Math.random() * 100}%`;
      s.style.top = `${Math.random() * 100}%`;
      s.style.animationDelay = `${Math.random() * 2.8}s`;
      s.style.width = `${5 + Math.random() * 5}px`;
      s.style.height = s.style.width;
      sparkles.appendChild(s);
    }
  }

  todayLabel.textContent = formatToday();
  renderCatalog();
  spawnSparkles();
  loadVisitors();

  let activeScoreGame = "flappy";
  let activeScorePeriod = "day";
  const scoreList = document.getElementById("score-list");
  const scoreNote = document.getElementById("score-note");

  async function renderScoreboard(game = activeScoreGame, period = activeScorePeriod) {
    activeScoreGame = game;
    activeScorePeriod = period;
    if (!scoreList) return;
    scoreList.innerHTML = `<li class="score-empty">불러오는 중…</li>`;
    const gameNames = {
      flappy: "펄럭 병아리",
      doodle: "폴짝 하늘",
      tetris: "블록 팡팡",
      "jump-run": "콩콩 점프",
      "ninja-dodge": "닌자 표창",
    };
    const gName = gameNames[game] || "게임";
    if (scoreNote) {
      scoreNote.textContent =
        period === "week" ? `이번주 ${gName}` : `오늘의 ${gName}`;
    }
    if (!window.TodayScores) {
      scoreList.innerHTML = `<li class="score-empty">랭킹 모듈을 불러오지 못했어요</li>`;
      return;
    }
    const data = await window.TodayScores.fetchScores(game, 20, period);
    if (!data.configured) {
      scoreList.innerHTML = `<li class="score-empty">랭킹을 불러오지 못했어요</li>`;
      return;
    }
    if (!data.scores.length) {
      scoreList.innerHTML =
        period === "week"
          ? `<li class="score-empty">이번주 기록이 아직 없어요<br />첫 랭커가 되어 보세요!</li>`
          : `<li class="score-empty">오늘 기록이 아직 없어요<br />오늘의 1등에 도전!</li>`;
      return;
    }
    scoreList.innerHTML = data.scores
      .map((entry, i) => {
        const row = window.TodayScores.formatScoreRow(entry, i);
        return `<li><span class="rank">${row.rank}</span><span class="name">${row.name}</span><span class="pts">${row.score.toLocaleString("ko-KR")}</span></li>`;
      })
      .join("");
  }

  document.querySelectorAll(".period-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".period-tab").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      renderScoreboard(activeScoreGame, btn.dataset.period);
    });
  });

  document.querySelectorAll(".score-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".score-tab").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      renderScoreboard(btn.dataset.game, activeScorePeriod);
    });
  });

  renderScoreboard("flappy", "day");
})();
