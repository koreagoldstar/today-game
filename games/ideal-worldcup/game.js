(() => {
  "use strict";

  const A = window.TodayAdult;
  const PATH = "/games/ideal-worldcup/";

  /** 주제마다 16개 · 사진 없이 이모지로 (초상권 · 저작권 걱정 없음) */
  const THEMES = [
    {
      id: "yasik",
      title: "야식 월드컵",
      icon: "🌙",
      ask: "밤 11시, 딱 하나만 시킨다면?",
      items: [
        ["chicken", "🍗", "치킨", "반반은 국룰"],
        ["pizza", "🍕", "피자", "콜라 필수"],
        ["jokbal", "🐷", "족발", "막국수 서비스"],
        ["bossam", "🥬", "보쌈", "김치랑 같이"],
        ["tteokbokki", "🌶️", "떡볶이", "순대·튀김 추가"],
        ["ramen", "🍜", "라면", "끓이는 데 4분"],
        ["gopchang", "🔥", "곱창", "볶음밥은 필수"],
        ["samgyeopsal", "🥓", "삼겹살", "소주 한 잔"],
        ["jjamppong", "🦐", "짬뽕", "얼큰한 국물"],
        ["tangsuyuk", "🍖", "탕수육", "부먹 vs 찍먹"],
        ["malatang", "🥘", "마라탕", "꿔바로우 세트"],
        ["dakbal", "🐔", "닭발", "주먹밥이랑"],
        ["hoe", "🐟", "회", "광어·우럭 세트"],
        ["burger", "🍔", "햄버거", "감자튀김 라지"],
        ["mandu", "🥟", "만두", "군만두 한 판"],
        ["eomuk", "🍢", "어묵탕", "포장마차 감성"],
      ],
    },
    {
      id: "lunch",
      title: "직장인 점심 월드컵",
      icon: "🍱",
      ask: "점심시간 12시 정각, 오늘 메뉴는?",
      items: [
        ["kimchijjigae", "🍲", "김치찌개", "공깃밥 추가"],
        ["doenjang", "🫕", "된장찌개", "집밥 느낌"],
        ["jeyuk", "🐖", "제육볶음", "기사식당 정석"],
        ["donkatsu", "🍛", "돈까스", "소스 듬뿍"],
        ["gukbap", "🥣", "국밥", "든든하게 한 그릇"],
        ["naengmyeon", "🍜", "냉면", "물냉 vs 비냉"],
        ["bibimbap", "🍚", "비빔밥", "고추장 한 숟갈"],
        ["kalguksu", "🥢", "칼국수", "겉절이 무한리필"],
        ["pho", "🌿", "쌀국수", "고수는 빼 주세요"],
        ["sushi", "🍣", "초밥", "오늘은 플렉스"],
        ["salad", "🥗", "샐러드", "다이어트 중"],
        ["sandwich", "🥪", "샌드위치", "빨리 먹고 쉬기"],
        ["dosirak", "🍱", "편의점 도시락", "가성비 최고"],
        ["sundubu", "🌶️", "순두부찌개", "계란 톡"],
        ["budae", "🥫", "부대찌개", "라면사리 추가"],
        ["jjajang", "🍝", "짜장면", "곱빼기로"],
      ],
    },
    {
      id: "trip",
      title: "국내 여행지 월드컵",
      icon: "🧳",
      ask: "연차 쓰고 딱 한 곳 간다면?",
      items: [
        ["jeju", "🍊", "제주도", "오름·바다·흑돼지"],
        ["busan", "🌊", "부산", "해운대·광안리"],
        ["gangneung", "☕", "강릉", "바다 앞 카페"],
        ["gyeongju", "🏯", "경주", "황리단길 산책"],
        ["yeosu", "🌃", "여수", "밤바다 낭만"],
        ["jeonju", "🥢", "전주", "한옥마을·비빔밥"],
        ["sokcho", "🦑", "속초", "중앙시장 닭강정"],
        ["namhae", "🏝️", "남해", "독일마을 드라이브"],
        ["tongyeong", "⛵", "통영", "케이블카·꿀빵"],
        ["gapyeong", "🏕️", "가평", "글램핑 한 박"],
        ["chuncheon", "🚣", "춘천", "닭갈비·호수"],
        ["andong", "🎭", "안동", "하회마을·찜닭"],
        ["danyang", "⛰️", "단양", "패러글라이딩"],
        ["damyang", "🎋", "담양", "죽녹원 대나무숲"],
        ["pohang", "🌅", "포항", "호미곶 일출"],
        ["seoul", "🗼", "서울", "궁궐·한강 야경"],
      ],
    },
    {
      id: "weekend",
      title: "주말 계획 월드컵",
      icon: "🛋️",
      ask: "아무 약속 없는 토요일, 뭐 할까?",
      items: [
        ["sleep", "😴", "늦잠", "알람 없이 푹"],
        ["binge", "📺", "드라마 정주행", "소파와 한 몸"],
        ["camping", "⛺", "캠핑", "불멍 타임"],
        ["hiking", "⛰️", "등산", "정상에서 컵라면"],
        ["foodtour", "🍽️", "맛집 탐방", "웨이팅도 OK"],
        ["cafe", "☕", "카페 투어", "디저트까지"],
        ["gaming", "🎮", "게임", "오늘은 밤새기"],
        ["workout", "💪", "운동", "헬스·러닝"],
        ["shopping", "🛍️", "쇼핑", "장바구니 털기"],
        ["drive", "🚗", "드라이브", "노래 크게 틀고"],
        ["fishing", "🎣", "낚시", "손맛 기다리기"],
        ["reading", "📚", "독서", "조용한 하루"],
        ["cleaning", "🧹", "대청소", "개운한 기분"],
        ["friends", "🍻", "친구 만나기", "수다 삼매경"],
        ["cooking", "🍳", "요리하기", "집밥 셰프"],
        ["travel", "✈️", "당일치기 여행", "훌쩍 떠나기"],
      ],
    },
    {
      id: "dessert",
      title: "디저트 월드컵",
      icon: "🍰",
      ask: "밥 배 따로 디저트 배 따로, 하나만!",
      items: [
        ["bungeoppang", "🐟", "붕어빵", "팥 vs 슈크림"],
        ["hotteok", "🥞", "호떡", "씨앗호떡"],
        ["tanghulu", "🍓", "탕후루", "바삭 달콤"],
        ["macaron", "🍬", "마카롱", "뚱카롱"],
        ["icecream", "🍦", "아이스크림", "콘으로"],
        ["bingsu", "🍧", "빙수", "팥빙수 vs 망고"],
        ["cake", "🍰", "케이크", "생크림 딸기"],
        ["donut", "🍩", "도넛", "글레이즈드"],
        ["croffle", "🧇", "크로플", "아이스크림 올려"],
        ["cookie", "🍪", "쿠키", "르뱅 쿠키"],
        ["chocolate", "🍫", "초콜릿", "단짠 조합"],
        ["pudding", "🍮", "푸딩", "탱글탱글"],
        ["yakgwa", "🍯", "약과", "할매니얼"],
        ["tteok", "🍡", "떡", "인절미·꿀떡"],
        ["churros", "🥨", "츄러스", "놀이공원 맛"],
        ["tiramisu", "☕", "티라미수", "커피 향 가득"],
      ],
    },
    {
      id: "pet",
      title: "반려동물 월드컵",
      icon: "🐾",
      ask: "딱 한 마리 키울 수 있다면?",
      items: [
        ["dog", "🐶", "강아지", "산책 메이트"],
        ["cat", "🐱", "고양이", "집사 생활"],
        ["hamster", "🐹", "햄스터", "볼주머니 빵빵"],
        ["rabbit", "🐰", "토끼", "깡총깡총"],
        ["parrot", "🦜", "앵무새", "말 따라 하기"],
        ["turtle", "🐢", "거북이", "느긋한 친구"],
        ["hedgehog", "🦔", "고슴도치", "가시 공"],
        ["goldfish", "🐠", "물고기", "어항 힐링"],
        ["lizard", "🦎", "도마뱀", "크레스티드 게코"],
        ["chick", "🐥", "병아리", "삐약삐약"],
        ["penguin", "🐧", "펭귄", "상상은 자유"],
        ["otter", "🦦", "수달", "손 잡고 둥둥"],
        ["alpaca", "🦙", "알파카", "복슬복슬"],
        ["panda", "🐼", "판다", "대나무 먹방"],
        ["fox", "🦊", "여우", "사막여우"],
        ["sheep", "🐑", "양", "구름 같은 털"],
      ],
    },
  ];

  const $ = (id) => document.getElementById(id);
  const screens = { title: $("title"), play: $("play"), over: $("over") };

  const params = new URLSearchParams(location.search);
  let theme = THEMES.find((t) => t.id === params.get("t")) || THEMES[0];
  let size = 16;
  const friend = params.get("w") ? { theme: params.get("t"), win: params.get("w") } : null;

  /** 진행 상태 */
  let roundItems = [];
  let nextRound = [];
  let matchIdx = 0;
  let history = [];
  let reached = {}; // id → 진출한 마지막 라운드 크기 (16, 8, 4, 2, 1)
  let busy = false;

  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    window.scrollTo(0, 0);
    if (window.TodayChrome && TodayChrome.sync) TodayChrome.sync();
  }

  function itemOf(t, id) {
    const row = t.items.find((r) => r[0] === id);
    return row ? { id: row[0], emoji: row[1], name: row[2], desc: row[3] } : null;
  }

  function renderThemes() {
    const box = $("themes");
    box.innerHTML = "";
    THEMES.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `wc-theme${t.id === theme.id ? " on" : ""}`;
      b.innerHTML = `<span class="wc-theme-icon">${t.icon}</span><span>${A.esc(t.title)}</span>`;
      b.addEventListener("click", () => {
        theme = t;
        renderThemes();
      });
      box.appendChild(b);
    });
  }

  function renderFriend() {
    if (!friend) return;
    const t = THEMES.find((x) => x.id === friend.theme);
    const item = t && itemOf(t, friend.win);
    if (!item) return;
    const el = $("friend-banner");
    el.innerHTML = `친구의 <b>${A.esc(t.title)}</b> 1위는 <b>${item.emoji} ${A.esc(item.name)}</b>!<br />나는 뭘 고를까? 해 보고 비교해 보세요.`;
    el.classList.remove("hidden");
  }

  $("rounds").addEventListener("click", (e) => {
    const b = e.target.closest("[data-size]");
    if (!b) return;
    size = Number(b.dataset.size);
    $("rounds")
      .querySelectorAll("[data-size]")
      .forEach((x) => x.classList.toggle("on", x === b));
  });

  function roundLabel(n) {
    if (n === 2) return "결승";
    if (n === 4) return "준결승";
    return `${n}강`;
  }

  function start() {
    const all = theme.items.map((r) => ({ id: r[0], emoji: r[1], name: r[2], desc: r[3] }));
    roundItems = A.shuffle(all).slice(0, size);
    nextRound = [];
    matchIdx = 0;
    history = [];
    reached = {};
    roundItems.forEach((it) => (reached[it.id] = size));
    $("play-theme").textContent = `${theme.icon} ${theme.title}`;
    show("play");
    paintMatch();
  }

  function totalMatches() {
    return size - 1;
  }

  function doneMatches() {
    let done = 0;
    let n = size;
    while (n > roundItems.length) {
      done += n / 2;
      n /= 2;
    }
    return done + matchIdx;
  }

  function fillPick(btn, item) {
    btn.innerHTML = `
      <span class="wc-emoji">${item.emoji}</span>
      <span class="wc-name">${A.esc(item.name)}</span>
      <span class="wc-desc">${A.esc(item.desc)}</span>`;
    btn.setAttribute("aria-label", `${item.name} 선택`);
    btn.classList.remove("win", "lose");
  }

  function paintMatch() {
    const a = roundItems[matchIdx * 2];
    const b = roundItems[matchIdx * 2 + 1];
    fillPick($("pick-a"), a);
    fillPick($("pick-b"), b);
    const pairs = roundItems.length / 2;
    $("play-round").textContent = `${roundLabel(roundItems.length)} ${pairs > 1 ? `${matchIdx + 1}/${pairs}` : ""}`.trim();
    $("play-bar").style.width = `${(doneMatches() / totalMatches()) * 100}%`;
    $("undo-btn").disabled = history.length === 0;
    busy = false;
  }

  function choose(side) {
    if (busy) return;
    busy = true;
    const a = roundItems[matchIdx * 2];
    const b = roundItems[matchIdx * 2 + 1];
    const win = side === "a" ? a : b;
    history.push({ roundItems: roundItems.slice(), nextRound: nextRound.slice(), matchIdx, reached: { ...reached } });
    $(side === "a" ? "pick-a" : "pick-b").classList.add("win");
    $(side === "a" ? "pick-b" : "pick-a").classList.add("lose");
    A.sfx("pick");
    nextRound.push(win);
    reached[win.id] = roundItems.length / 2;

    setTimeout(() => {
      matchIdx += 1;
      if (matchIdx * 2 >= roundItems.length) {
        if (nextRound.length === 1) {
          finish(nextRound[0]);
          return;
        }
        roundItems = A.shuffle(nextRound);
        nextRound = [];
        matchIdx = 0;
      }
      paintMatch();
    }, 380);
  }

  function undo() {
    const prev = history.pop();
    if (!prev) return;
    roundItems = prev.roundItems;
    nextRound = prev.nextRound;
    matchIdx = prev.matchIdx;
    reached = prev.reached;
    paintMatch();
  }

  let winner = null;

  function finish(w) {
    winner = w;
    A.sfx("win");
    $("win-theme").textContent = `${theme.icon} ${theme.title} · ${size}강`;
    $("win-emoji").textContent = w.emoji;
    $("win-name").textContent = w.name;
    $("win-desc").textContent = w.desc;

    // TOP4: 우승 → 준우승 → 4강 탈락 둘
    const order = Object.entries(reached)
      .sort((x, y) => x[1] - y[1])
      .slice(0, 4)
      .map(([id]) => itemOf(theme, id));
    const labels = ["🥇 1위", "🥈 2위", "🥉 공동 3위", "🥉 공동 3위"];
    $("my-top").innerHTML = order
      .map((it, i) => `<li><span class="wc-medal">${labels[i]}</span><span>${it.emoji} ${A.esc(it.name)}</span></li>`)
      .join("");

    const vs = $("vs-friend");
    if (friend && friend.theme === theme.id) {
      const f = itemOf(theme, friend.win);
      vs.classList.remove("hidden");
      vs.textContent =
        f && f.id === w.id
          ? `🎉 친구랑 1위가 똑같아요! 둘 다 ${f.emoji} ${f.name}`
          : `친구는 ${f ? `${f.emoji} ${f.name}` : "다른 것"}, 나는 ${w.emoji} ${w.name}! 취향 차이 인정?`;
    } else {
      vs.classList.add("hidden");
    }

    show("over");
    $("share-msg").textContent = "";
    saveHistory(w);
    loadStats(true);
  }

  function saveHistory(w) {
    const key = "today-adult-wc-history";
    const list = A.store(key, []);
    list.unshift({ t: theme.id, w: w.id, at: Date.now() });
    A.save(key, list.slice(0, 30));
  }

  async function loadStats(vote) {
    const box = $("stats");
    box.innerHTML = `<p class="ad-msg">불러오는 중…</p>`;
    const pollId = `wc-${theme.id}`;
    let counts = null;
    // 같은 주제는 하루에 한 번만 집계에 넣음 (새로고침 연타 방지)
    const flag = `today-adult-wc-voted-${pollId}-${A.seoulDay()}`;
    if (vote && !A.store(flag, false)) {
      counts = await A.poll.vote(pollId, winner.id);
      if (counts) A.save(flag, true);
    }
    if (!counts) {
      const polls = await A.poll.get([pollId]);
      counts = polls && polls[pollId];
    }
    if (!counts || !Object.keys(counts).length) {
      box.innerHTML = `<p class="ad-msg">아직 집계가 없어요. 첫 기록의 주인공!</p>`;
      return;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const rows = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => ({ it: itemOf(theme, id), n }))
      .filter((r) => r.it);
    const myRank = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .findIndex(([id]) => id === winner.id);
    box.innerHTML =
      rows
        .map(({ it, n }) => {
          const pct = Math.round((n / total) * 100);
          const mine = it.id === winner.id ? " mine" : "";
          return `<div class="wc-bar${mine}">
            <span class="wc-bar-name">${it.emoji} ${A.esc(it.name)}</span>
            <span class="wc-bar-track"><i style="width:${Math.max(4, pct)}%"></i></span>
            <span class="wc-bar-pct">${pct}%</span>
          </div>`;
        })
        .join("") +
      `<p class="ad-msg">총 ${total.toLocaleString("ko-KR")}명 참여${
        myRank >= 0 ? ` · 내 1위는 전체 ${myRank + 1}등` : ""
      }</p>`;
  }

  function shareUrl() {
    return `${A.SITE}${PATH}?t=${theme.id}&w=${winner.id}`;
  }

  $("share-kakao").addEventListener("click", async () => {
    if (!winner) return;
    await A.kakao({
      gameId: "ideal-worldcup",
      title: `내 ${theme.title} 1위는 ${winner.emoji} ${winner.name}!`,
      description: `${theme.ask} 너는 뭐 고를래?`,
      buttonTitle: "나도 해보기",
      url: shareUrl(),
    });
  });

  $("share-link").addEventListener("click", async () => {
    if (!winner) return;
    await A.share({
      title: "이상형 월드컵 | 오늘의 게임",
      text: `내 ${theme.title} 1위는 ${winner.emoji} ${winner.name}! 너는 뭐 고를래?`,
      url: shareUrl(),
    });
  });

  $("pick-a").addEventListener("click", () => choose("a"));
  $("pick-b").addEventListener("click", () => choose("b"));
  $("undo-btn").addEventListener("click", undo);
  $("start-btn").addEventListener("click", start);
  $("again-btn").addEventListener("click", start);
  $("other-btn").addEventListener("click", () => {
    const i = THEMES.indexOf(theme);
    theme = THEMES[(i + 1) % THEMES.length];
    renderThemes();
    show("title");
  });

  document.addEventListener("keydown", (e) => {
    if (screens.play.classList.contains("hidden")) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "1") choose("a");
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "2") choose("b");
    if (e.key === "Backspace") undo();
  });

  renderThemes();
  renderFriend();
})();
