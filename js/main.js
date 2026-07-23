(() => {
  "use strict";

  /** @typedef {{ id: string, title: string, tag: string, href: string, thumb?: string, emoji?: string, category: string }} GameEntry */

  /** @type {{ id: string, title: string, desc: string }[]} */
  const CATEGORIES = [
    { id: "rhythm", title: "리듬 · 음악", desc: "비트에 맞춰 톡톡" },
    { id: "sports", title: "스포츠 · 레이싱", desc: "공 치고 달리고" },
    { id: "action", title: "액션 · 슈팅", desc: "손맛 있게 쏘고 피하는 게임" },
    { id: "puzzle", title: "퍼즐 · 두뇌", desc: "생각하고 맞추는 게임" },
    { id: "arcade", title: "아케이드 · 캐치", desc: "짧게 중독되는 캐주얼" },
  ];

  /** 고전 게임은 오른쪽 레일로 분리 */

  /** @type {GameEntry[]} — 새 게임은 배열 맨 앞에 추가 (위쪽·최신순) */
  const GAMES = [
    {
      id: "order-memo",
      title: "순서톡톡",
      tag: "기억 · 50단계",
      href: "/games/order-memo/",
      thumb: "/assets/thumbs/order-memo.png",
      category: "puzzle",
    },
    {
      id: "reaction",
      title: "번쩍 반응",
      tag: "반사 · ms 기록",
      href: "/games/reaction/",
      thumb: "/assets/thumbs/reaction.png",
      category: "rhythm",
    },
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
      tag: "균형 · 무한 · 랭킹",
      href: "/games/stork-stride/",
      thumb: "/assets/thumbs/stork-stride.png",
      category: "arcade",
    },
    {
      id: "tetris",
      title: "블록 팡팡",
      tag: "퍼즐 · 랭킹",
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
      id: "drift-chick",
      title: "드리프트 삐약이",
      tag: "드리프트 · 원터치",
      href: "/games/drift-chick/",
      thumb: "/assets/thumbs/drift-chick.png",
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
  const archiveList = document.getElementById("archive-list");
  const todayLabel = document.getElementById("today-label");
  const sparkles = document.getElementById("sparkles");
  const visitCount = document.getElementById("visit-count");

  const GAME_NAMES = Object.fromEntries(
    (window.TodayRankMeta && TodayRankMeta.RANKABLE
      ? TodayRankMeta.RANKABLE
      : [
          { id: "flappy", title: "펄럭 병아리" },
          { id: "doodle", title: "폴짝 하늘" },
          { id: "tetris", title: "블록 팡팡" },
          { id: "jump-run", title: "콩콩 점프" },
          { id: "ninja-dodge", title: "닌자 표창" },
          { id: "stork-stride", title: "서빙왕" },
        ]
    ).map((g) => [g.id, g.title])
  );

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

  function gameIndex(game) {
    return GAMES.indexOf(game);
  }

  /** API 랭킹 등록 가능 게임 */
  const RANKING_IDS = new Set(
    window.TodayRankMeta && Array.isArray(TodayRankMeta.RANKABLE)
      ? TodayRankMeta.RANKABLE.map((g) => g.id)
      : ["flappy", "tetris", "doodle", "jump-run", "ninja-dodge", "stork-stride"]
  );
  /** 카탈로그 맨 아래 고정 */
  const BOTTOM_IDS = new Set(["pinball", "rps", "odd-even"]);

  /**
   * 콜드스타트용 인기 시드 (실제 플레이 수가 쌓이면 자동으로 그 순서로 올라감)
   * 앞쪽일수록 기본 인기 높음
   */
  const POPULAR_SEED = [
    "flappy",
    "tetris",
    "doodle",
    "jump-run",
    "snake",
    "slide-2048",
    "suika",
    "minesweeper",
    "wordle",
    "stork-stride",
    "ninja-dodge",
    "whack-mole",
    "brick",
    "puzzle-bubble",
    "memory",
    "cute-shoot",
    "racing",
    "drift-chick",
    "crossy",
    "bubble-pop",
    "fruit-catch",
    "tower",
    "omok",
    "alggagi",
    "ttamogi",
    "diff",
    "sokoban",
    "rhythm",
    "minigolf",
    "beat-tap",
    "slide-beat",
    "dual-pad",
  ];
  const SEED_RANK = Object.fromEntries(POPULAR_SEED.map((id, i) => [id, i]));

  let playCounts = {};
  let popularOrder = {};

  function hasRanking(game) {
    return RANKING_IDS.has(game.id);
  }

  function isBottom(game) {
    return BOTTOM_IDS.has(game.id);
  }

  function playScore(game) {
    return Number(playCounts[game.id]) || 0;
  }

  function seedRank(game) {
    if (popularOrder[game.id] != null) return popularOrder[game.id];
    return SEED_RANK[game.id] != null ? SEED_RANK[game.id] : 900 + gameIndex(game);
  }

  /** 하루 캐시된 인기순 → 시드 → 맨 아래 고정 */
  function sortShelfGames(catId, games) {
    return games.slice().sort((a, b) => {
      const bottomA = isBottom(a) ? 1 : 0;
      const bottomB = isBottom(b) ? 1 : 0;
      if (bottomA !== bottomB) return bottomA - bottomB;

      const playA = playScore(a);
      const playB = playScore(b);
      if (playA !== playB) return playB - playA;

      const seedA = seedRank(a);
      const seedB = seedRank(b);
      if (seedA !== seedB) return seedA - seedB;

      if (catId === "rhythm") {
        if (a.id === "rhythm") return -1;
        if (b.id === "rhythm") return 1;
      }
      if (catId === "archive") {
        if (a.id === "goindol") return -1;
        if (b.id === "goindol") return 1;
      }
      return gameIndex(a) - gameIndex(b);
    });
  }

  function shelfPopularity(games) {
    return games.reduce((sum, g) => sum + playScore(g), 0);
  }

  function shelfSeedBest(games) {
    return games.reduce((best, g) => Math.min(best, seedRank(g)), Number.POSITIVE_INFINITY);
  }

  function applyPopularity(data) {
    if (!data) return;
    if (data.plays && typeof data.plays === "object") {
      playCounts = data.plays;
    }
    if (Array.isArray(data.order) && data.order.length) {
      popularOrder = Object.fromEntries(data.order.map((id, i) => [id, i]));
    }
  }

  function popularityCacheKey() {
    return `today-game-popularity-${todayKey()}`;
  }

  /** 브라우저·서버 모두 하루 1회만 갱신 */
  async function loadPlayCounts() {
    const key = popularityCacheKey();
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        applyPopularity(JSON.parse(raw));
        return;
      }
    } catch (_) {
      /* ignore */
    }

    try {
      const res = await fetch("/api/plays", { cache: "default" });
      const data = await res.json();
      applyPopularity(data);
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            day: data.day || todayKey(),
            plays: playCounts,
            order: data.order || [],
          })
        );
      } catch (_) {
        /* ignore */
      }
    } catch (_) {
      /* seed fallback */
    }
  }

  function createGameSlot(game, opts = {}) {
    const a = document.createElement("a");
    a.className = (game.thumb ? "slot has-photo" : "slot") + (opts.compact ? " slot-compact" : "");
    a.href = game.href;
    a.setAttribute("aria-label", `${game.title} 플레이`);
    if (opts.external) {
      a.classList.add("slot-external");
    }
    const art = game.thumb
      ? `<img src="${game.thumb}" alt="" loading="lazy" width="220" height="220" />`
      : `<span class="slot-emoji" aria-hidden="true">${game.emoji || "🎮"}</span>`;
    const tag = opts.external
      ? `<p class="slot-tag">${game.tag}</p><span class="slot-ext">↗ 외부 연결</span>`
      : `<p class="slot-tag">${game.tag}</p><span class="slot-play">플레이</span>`;
    a.innerHTML = `
      <div class="slot-art">${art}</div>
      <div class="slot-meta">
        <p class="slot-name">${game.title}</p>
        ${tag}
      </div>
    `;
    return a;
  }

  function renderCatalog() {
    if (!catalog) return;
    catalog.innerHTML = "";
    const frag = document.createDocumentFragment();

    const shelves = CATEGORIES.map((cat) => {
      const games = sortShelfGames(
        cat.id,
        GAMES.filter((g) => g.category === cat.id)
      );
      return {
        cat,
        games,
        pops: shelfPopularity(games),
        seed: shelfSeedBest(games),
      };
    })
      .filter((shelf) => shelf.games.length > 0)
      .sort((a, b) => {
        if (a.pops !== b.pops) return b.pops - a.pops;
        return a.seed - b.seed;
      });

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

  function renderArchiveRail() {
    if (!archiveList) return;
    const games = sortShelfGames(
      "archive",
      GAMES.filter((g) => g.category === "archive")
    );
    archiveList.innerHTML = "";
    games.forEach((game) => {
      archiveList.appendChild(createGameSlot(game, { compact: true, external: true }));
    });
  }

  // createGameSlot: for archive, show external hint but stay on site wrappers
  // (wrappers themselves open Internet Archive)

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
  spawnSparkles();
  loadVisitors();
  // 오늘 캐시가 있으면 바로 인기순, 없으면 시드로 즉시 표시
  try {
    const raw = localStorage.getItem(popularityCacheKey());
    if (raw) applyPopularity(JSON.parse(raw));
  } catch (_) {
    /* ignore */
  }
  renderCatalog();
  renderArchiveRail();
  loadPlayCounts().then(() => {
    renderCatalog();
    renderArchiveRail();
  });

  /** 챌린지 TOP10 — 랭킹 가능 게임은 scores API 우선 */
  const RANKING_SCORE_GAMES = RANKING_IDS;
  initChallenge();

  function formatRemain(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `⏰ ${h}시간 ${String(m).padStart(2, "0")}분 남음`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setChallengeBest(el, name, label) {
    if (!el) return;
    if (!label) {
      el.textContent = "기록 없음";
      return;
    }
    if (name) {
      el.innerHTML = `<span class="challenge-best-name">${escapeHtml(name)}</span>${escapeHtml(label)}`;
    } else {
      el.textContent = label;
    }
  }

  function renderMyChallengeRank(el, playersEl, gameId, participants) {
    if (!el) return;
    let saved = null;
    try {
      if (window.TodayGameRank && TodayGameRank.loadLocal) {
        saved = TodayGameRank.loadLocal(gameId);
      } else {
        const raw = localStorage.getItem(
          `today-game-challenge-result-${todayKey()}-${gameId}`
        );
        if (raw) saved = JSON.parse(raw);
      }
    } catch (_) {
      saved = null;
    }
    const total = Math.max(
      Number(participants) || 0,
      saved && saved.total != null ? Number(saved.total) : 0
    );
    if (saved && saved.rank != null) {
      el.textContent = `${saved.rank} / ${total || "—"}`;
    } else if (total > 0) {
      el.textContent = `— / ${total}`;
    } else {
      el.textContent = "—";
    }
  }

  function renderChallengeTop10(listEl, rows, metric) {
    if (!listEl) return;
    if (!rows || !rows.length) {
      listEl.innerHTML = `<li class="score-empty">아직 기록이 없어요<br />첫 챌린저가 되어 보세요!</li>`;
      return;
    }
    listEl.innerHTML = rows
      .slice(0, 10)
      .map((row, i) => {
        const rank = row.rank || i + 1;
        const name = escapeHtml(row.name || "???");
        const label =
          row.label ||
          (metric === "time"
            ? `${Number(row.score).toLocaleString("ko-KR")}초`
            : `${Number(row.score).toLocaleString("ko-KR")}점`);
        return `<li><span class="rank">${rank}</span><span class="name">${name}</span><span class="pts">${escapeHtml(label)}</span></li>`;
      })
      .join("");
  }

  async function initChallenge() {
    const root = document.getElementById("today-challenge");
    const gameEl = document.getElementById("challenge-game");
    const playersEl = document.getElementById("challenge-players");
    const bestEl = document.getElementById("challenge-best");
    const leftEl = document.getElementById("challenge-left");
    const myRankEl = document.getElementById("challenge-my-rank");
    const topEl = document.getElementById("challenge-top10");
    const btn = document.getElementById("challenge-btn");
    if (!root || !gameEl || !btn) return;

    let endsAt = Date.now() + 86400000;
    let href = "#";
    let gameId = "";
    let metric = "score";
    let participants = 0;

    try {
      const res = await fetch("/api/challenge", { cache: "no-store" });
      const data = await res.json();
      if (!data || !data.ok || !data.game) throw new Error("challenge");
      gameId = data.game.id;
      metric = data.game.metric || "score";
      href = `${data.game.href}${data.game.href.includes("?") ? "&" : "?"}challenge=1`;
      gameEl.textContent = data.game.title;
      btn.href = href;
      participants = data.participants == null ? 0 : Number(data.participants) || 0;
      playersEl.textContent =
        data.participants == null
          ? "오늘 —명 도전중"
          : `오늘 ${participants.toLocaleString("ko-KR")}명 도전중`;
      endsAt = Number(data.endsAt) || endsAt;
      renderMyChallengeRank(myRankEl, playersEl, gameId, participants);

      const shareRow = document.getElementById("challenge-share-row");
      const shareBtn = document.getElementById("challenge-share-btn");
      const kakaoBtn = document.getElementById("challenge-share-kakao");
      let savedResult = null;
      try {
        if (window.TodayGameRank && TodayGameRank.loadLocal) {
          savedResult = TodayGameRank.loadLocal(gameId);
        }
      } catch (_) {
        savedResult = null;
      }
      if (shareRow) {
        if (savedResult && savedResult.score != null) {
          shareRow.hidden = false;
          const payload = {
            gameTitle: `오늘의 챌린지 · ${data.game.title}`,
            name: savedResult.name || "나",
            score: savedResult.score,
            rankDay: savedResult.rank,
            rankWeek: null,
            url: "https://www.todaygame.co.kr/",
          };
          if (kakaoBtn) {
            kakaoBtn.onclick = async () => {
              if (!window.TodayScores || !TodayScores.shareToKakao) return;
              const result = await TodayScores.shareToKakao(payload);
              kakaoBtn.textContent = result.ok ? "공유 창 열림" : "공유 실패";
              setTimeout(() => {
                kakaoBtn.textContent = "카카오톡 공유";
              }, 1600);
            };
          }
          if (shareBtn) {
            shareBtn.onclick = async () => {
              if (!window.TodayScores || !TodayScores.shareRank) return;
              const result = await TodayScores.shareRank(payload);
              if (result.mode === "copy") shareBtn.textContent = "복사됨!";
              else if (result.ok) shareBtn.textContent = "공유 완료!";
              else shareBtn.textContent = "공유 실패";
              setTimeout(() => {
                shareBtn.textContent = "다른 앱으로 공유";
              }, 1600);
            };
          }
        } else {
          shareRow.hidden = true;
        }
      }

      let top10 = Array.isArray(data.top10) ? data.top10 : [];

      if (RANKING_SCORE_GAMES.has(gameId) && window.TodayScores) {
        const board = await window.TodayScores.fetchScores(gameId, 10, "day");
        if (board.ok && board.scores && board.scores.length) {
          top10 = board.scores.slice(0, 10).map((entry, i) => ({
            rank: i + 1,
            name: entry.name,
            score: entry.score,
            label: `${Number(entry.score).toLocaleString("ko-KR")}점`,
          }));
        }
      }

      if (top10.length) {
        setChallengeBest(bestEl, top10[0].name, top10[0].label || null);
      } else if (data.bestLabel) {
        setChallengeBest(bestEl, data.bestName, data.bestLabel);
      } else {
        setChallengeBest(bestEl, null, null);
      }
      renderChallengeTop10(topEl, top10, metric);
    } catch (_) {
      gameEl.textContent = "준비 중";
      playersEl.textContent = "오늘 —명 도전중";
      bestEl.textContent = "—";
      if (myRankEl) myRankEl.textContent = "—";
      btn.href = "/";
      if (topEl) topEl.innerHTML = `<li class="score-empty">불러오지 못했어요</li>`;
    }

    const tick = () => {
      leftEl.textContent = formatRemain(endsAt - Date.now());
    };
    tick();
    setInterval(tick, 15000);

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const day = todayKey();
      const flag = `today-game-challenge-join-${day}-${gameId}`;
      if (gameId && !localStorage.getItem(flag)) {
        try {
          const res = await fetch("/api/challenge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "join" }),
          });
          const data = await res.json();
          if (data && data.participants != null) {
            participants = Number(data.participants) || participants;
            playersEl.textContent = `오늘 ${participants.toLocaleString("ko-KR")}명 도전중`;
            renderMyChallengeRank(myRankEl, playersEl, gameId, participants);
          }
          localStorage.setItem(flag, "1");
        } catch (_) {
          /* ignore */
        }
      }
      window.location.href = href || btn.href;
    });
  }
})();
