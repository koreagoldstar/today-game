(() => {
  "use strict";

  const A = window.TodayAdult;
  const PATH = "/games/guess-me/";
  const PER = 10;
  const MINE_KEY = "today-adult-gm-mine";

  /**
   * 나에 대한 질문. {who} = "나는" / "지혁님은", {whose} = "내" / "지혁님의"
   * 씨앗이 이 배열의 순서로 문제를 고르므로 순서를 바꾸거나 지우지 말 것 (새 질문은 맨 뒤에)
   */
  const BANK = [
    ["{who} 치킨 시키면?", [["🍗", "후라이드"], ["🌶️", "양념"], ["🧄", "간장 · 마늘"], ["🍽️", "무조건 반반"]]],
    ["{who} 주말 아침에?", [["😴", "점심까지 꿀잠"], ["🌅", "일찍 일어나 움직임"]]],
    ["{who} 스트레스 받으면?", [["🍜", "먹는다"], ["🛌", "잔다"], ["🏃", "운동한다"], ["🗣️", "수다 떤다"]]],
    ["{whose} 여행 스타일은?", [["📋", "분 단위 계획"], ["🎲", "대충 즉흥"]]],
    ["{whose} 카톡 답장 속도는?", [["⚡", "보자마자 바로"], ["📦", "모아서 한 번에"], ["🙈", "읽고 까먹음"]]],
    ["{who} 라면 끓일 때?", [["🍜", "꼬들꼬들"], ["🥣", "푹 퍼지게"]]],
    ["{whose} 커피 취향은?", [["🧊", "아아 (얼죽아)"], ["☕", "따뜻한 라떼"], ["🥤", "달달한 음료"], ["🚫", "커피 안 마심"]]],
    ["{who} 노래방 가면?", [["🎤", "마이크 독점"], ["🪇", "탬버린 담당"], ["🏠", "애초에 안 감"]]],
    ["{who} 돈이 생기면?", [["🛍️", "일단 쓴다"], ["🏦", "일단 모은다"]]],
    ["{whose} 최애 계절은?", [["🌸", "봄"], ["🏖️", "여름"], ["🍁", "가을"], ["⛄", "겨울"]]],
    ["{who} 이 중에 제일 무서운 건?", [["🐛", "벌레"], ["👻", "귀신"], ["🏔️", "높은 곳"], ["📞", "상사 전화"]]],
    ["{who} 쉬는 날에?", [["🛋️", "집콕이 최고"], ["🚶", "무조건 나간다"]]],
    ["{who} 연락할 때?", [["📞", "전화가 편함"], ["💬", "문자가 편함 (전화 공포증)"]]],
    ["{whose} 방 상태는?", [["✨", "깔끔 정리왕"], ["🌀", "나만 아는 질서"]]],
    ["{whose} 민트초코 생각은?", [["😋", "없어서 못 먹음"], ["🪥", "치약 맛"]]],
    ["{who} 아침밥을?", [["🍚", "꼭 먹는다"], ["⏭️", "안 먹는다"]]],
    ["{who} 탕수육 먹을 때?", [["🫗", "부먹"], ["🥢", "찍먹"], ["🤷", "아무거나"]]],
    ["{who} 휴대폰으로 제일 많이 하는 건?", [["▶️", "유튜브"], ["💬", "카톡"], ["📸", "인스타"], ["🛒", "쇼핑"]]],
    ["모임에서 {who}?", [["🎉", "분위기 메이커"], ["👏", "리액션 담당"], ["👀", "조용히 관찰"]]],
    ["술자리에서 {who}?", [["🌙", "끝까지 남는다"], ["🍺", "1차만"], ["🥤", "술 안 마심"]]],
    ["{whose} 아침 알람은?", [["⏰", "1개면 끝"], ["🔁", "5분 간격 여러 개"]]],
    ["고깃집에서 {who}?", [["🥩", "굽는 사람"], ["😋", "먹는 사람"]]],
    ["{who} 화나면?", [["💥", "바로 말한다"], ["🤐", "혼자 삭인다"]]],
    ["사진 찍을 때 {who}?", [["📷", "찍어 주는 사람"], ["🧍", "찍히는 사람"], ["🤳", "셀카파"]]],
    ["{who} 여행지를 고른다면?", [["🌊", "바다"], ["⛰️", "산"], ["🏙️", "도시"], ["🏠", "집이 최고"]]],
    ["마지막 한 조각이 남으면 {who}?", [["😏", "내가 먹는다"], ["🙏", "양보한다"]]],
    ["{whose} 최애 간식은?", [["🍪", "과자"], ["🥐", "빵"], ["🍦", "아이스크림"], ["🍓", "과일"]]],
    ["{who} 새해 계획을?", [["📝", "꼭 세운다"], ["🙅", "안 세운다"]]],
    ["{who} 샤워를?", [["🌞", "아침에"], ["🌙", "저녁에"]]],
    ["{who} 운동은?", [["💪", "꾸준히 한다"], ["💭", "마음만 있다"]]],
    ["줄 서는 맛집 앞에서 {who}?", [["⏳", "줄 서서라도 먹는다"], ["➡️", "옆집 간다"]]],
    ["배터리가 20% 남으면 {who}?", [["🔌", "불안해서 바로 충전"], ["🪫", "0%까지 버틴다"]]],
    ["{who}?", [["🐓", "아침형 인간"], ["🦉", "저녁형 인간"]]],
    ["선물 받는다면 {who}?", [["🧰", "실용템이 좋아"], ["🎁", "깜짝 선물이 좋아"], ["💵", "현금이 최고"]]],
    ["중국집에서 {who}?", [["🖤", "짜장"], ["❤️", "짬뽕"], ["🌓", "짬짜면"]]],
    ["공포 영화를 {who}?", [["😆", "재밌게 본다"], ["🙈", "절대 못 본다"]]],
    ["{whose} 혼밥 레벨은?", [["🥩", "고깃집도 혼자 가능"], ["🍙", "분식집까지"], ["🙅", "혼밥 못 함"]]],
    ["한동안 연락이 없으면 {who}?", [["📲", "먼저 연락한다"], ["⌛", "기다린다"]]],
    ["{who} 영화관에서?", [["🍿", "팝콘 필수"], ["🦑", "오징어파"], ["🙅", "아무것도 안 먹음"]]],
    ["{whose} 잠버릇은?", [["😪", "누우면 바로 잠"], ["📱", "폰 보다 늦게 잠"]]],
    ["{who} 떡볶이는?", [["🌾", "밀떡"], ["🍚", "쌀떡"]]],
    ["{who} 냉면은?", [["🧊", "물냉"], ["🔥", "비냉"]]],
    ["{who} 쇼핑할 때?", [["⚡", "보자마자 산다"], ["🔍", "최저가 끝까지 찾는다"]]],
    ["{whose} 인생 영화 장르는?", [["😂", "코미디"], ["💘", "로맨스"], ["💥", "액션"], ["🔪", "스릴러"]]],
  ];

  const $ = (id) => document.getElementById(id);
  const screens = { title: $("title"), play: $("play"), made: $("made"), scored: $("scored") };
  const params = new URLSearchParams(location.search);

  /* ---------- 문제 고르기 · 답 섞기 ---------- */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }

  function setFor(seed) {
    const r = rng(seed);
    const idx = BANK.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, PER).map((i) => BANK[i]);
  }

  /** 링크에서 답이 바로 안 보이게 씨앗으로 섞음 (보안이 아니라 스포일러 방지) */
  function maskOf(seed) {
    const r = rng(seed ^ 0x5bd1e995);
    return Array.from({ length: PER }, () => Math.floor(r() * 4));
  }
  const encode = (seed, ans) => ans.map((a, i) => (a + maskOf(seed)[i]) % 4).join("");
  const decode = (seed, code) => code.split("").map((c, i) => (Number(c) - maskOf(seed)[i] + 4) % 4);
  // 자체 점검: 섞고 풀면 원래 답
  console.assert(decode(777, encode(777, [0, 1, 2, 3, 1, 0, 2, 1, 0, 3])).join("") === "0123102103", "나를 맞혀봐 답 섞기 오류");

  /* ---------- 받은 링크 ---------- */
  const fSeed = /^\d{1,10}$/.test(params.get("s") || "") ? Number(params.get("s")) : 0;
  const fCode = /^[0-3]{10}$/.test(params.get("a") || "") ? params.get("a") : "";
  const fName = (params.get("n") || "").trim().slice(0, 8) || "친구";
  const bragName = (params.get("g") || "").trim().slice(0, 8);
  const bragScore = /^\d{1,2}$/.test(params.get("gs") || "") ? Math.min(PER, Number(params.get("gs"))) : -1;
  let friend = null;
  if (fSeed && fCode) {
    const qs = setFor(fSeed);
    const ans = decode(fSeed, fCode);
    if (ans.every((a, i) => a < qs[i][1].length)) friend = { seed: fSeed, code: fCode, name: fName, qs, ans };
  }

  /* ---------- 상태 ---------- */
  let mode = "make"; // make | guess
  let seed = 0;
  let qs = [];
  let picks = [];
  let idx = 0;
  let locked = false;
  let myName = "";

  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    window.scrollTo(0, 0);
  }

  function savedName() {
    try {
      return (localStorage.getItem("today-game-name") || "").slice(0, 8);
    } catch (_) {
      return "";
    }
  }

  function phrase(text, name) {
    const self = mode === "make";
    return text.replace("{who}", self ? "나는" : `${name}님은`).replace("{whose}", self ? "내" : `${name}님의`);
  }

  /* ---------- 시작 화면 ---------- */
  function paintTitle() {
    $("my-name").value = savedName();
    const mine = A.store(MINE_KEY, null);
    $("mine-btn").classList.toggle("hidden", !mine);
    if (friend) {
      $("title-kicker").textContent = "어른이용 게임 · 우정 테스트 도착";
      $("title-sub").innerHTML = "친구가 자기 취향 문제를 보냈어요.<br />과연 몇 개나 맞힐 수 있을까요?";
      $("invite").classList.remove("hidden");
      $("invite-top").textContent = "💌 문제가 도착했어요";
      $("invite-name").textContent = `${friend.name}님을 맞혀봐`;
      if (bragName && bragScore >= 0) {
        $("invite-brag").classList.remove("hidden");
        $("invite-brag").textContent = `🏅 ${bragName}님은 ${bragScore}/${PER} 맞혔어요. 당신은?`;
      }
      $("guess-btn").classList.remove("hidden");
      $("make-btn").classList.add("soft");
      $("make-btn").textContent = "✍️ 나도 내 문제 만들기";
    }
  }

  /* ---------- 문제 화면 ---------- */
  function startMake() {
    const input = $("my-name");
    myName = String(input.value || "").trim().slice(0, 8);
    if (!myName) {
      input.classList.remove("shake");
      void input.offsetWidth;
      input.classList.add("shake");
      input.focus();
      A.toast("친구에게 보일 이름을 적어 주세요");
      return;
    }
    try {
      localStorage.setItem("today-game-name", myName);
    } catch (_) {
      /* 저장 불가 */
    }
    mode = "make";
    seed = Math.floor(Math.random() * 1e9) + 1;
    qs = setFor(seed);
    picks = [];
    idx = 0;
    show("play");
    paintQ();
  }

  function startGuess() {
    mode = "guess";
    seed = friend.seed;
    qs = friend.qs;
    picks = [];
    idx = 0;
    show("play");
    paintQ();
  }

  function paintQ() {
    locked = false;
    const [text, opts] = qs[idx];
    $("gm-mode").textContent = mode === "make" ? "✍️ 내 답 고르기" : `🔍 ${friend.name}님 맞히기`;
    $("gm-num").textContent = `${idx + 1} / ${PER}`;
    $("gm-bar").style.width = `${(idx / PER) * 100}%`;
    $("gm-who").textContent = mode === "make" ? "솔직하게!" : `${friend.name}님이라면?`;
    $("gm-text").textContent = phrase(text, mode === "make" ? myName : friend.name);
    const box = $("gm-opts");
    box.className = `gm-opts${opts.length === 2 ? " two" : ""}`;
    box.innerHTML = "";
    opts.forEach(([emo, label], i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gm-opt";
      b.innerHTML = `<span class="gm-emo">${emo}</span><span>${A.esc(label)}</span>`;
      b.addEventListener("click", () => pick(i));
      box.appendChild(b);
    });
    $("gm-note").textContent = mode === "make" ? "고르면 바로 다음 문제로 넘어가요" : "";
    $("gm-next").classList.add("hidden");
    $("gm-back").classList.toggle("hidden", mode !== "make" || idx === 0);
  }

  function pick(i) {
    if (locked) return;
    locked = true;
    picks[idx] = i;
    const btns = [...$("gm-opts").children];
    if (mode === "make") {
      A.sfx("pick");
      btns[i].classList.add("pick");
      setTimeout(next, 280);
      return;
    }
    const right = friend.ans[idx];
    btns.forEach((b, k) => {
      if (k === right) {
        b.classList.add("right");
        b.insertAdjacentHTML("beforeend", `<span class="gm-mark">${A.esc(friend.name)}님 답</span>`);
      } else if (k === i) b.classList.add("wrong");
      else b.classList.add("dim");
    });
    A.sfx(i === right ? "win" : "bad");
    const got = picks.filter((p, k) => p === friend.ans[k]).length;
    $("gm-note").textContent = i === right ? `⭕ 정답! 지금까지 ${got}개` : `❌ 아쉬워요! 지금까지 ${got}개`;
    $("gm-next").textContent = idx + 1 >= PER ? "결과 보기" : "다음 문제";
    $("gm-next").classList.remove("hidden");
  }

  function next() {
    idx += 1;
    if (idx >= PER) {
      if (mode === "make") finishMake();
      else finishGuess();
      return;
    }
    paintQ();
  }

  function prev() {
    if (mode !== "make" || idx === 0) return;
    idx -= 1;
    paintQ();
  }

  /* ---------- 다 만들었을 때 ---------- */
  function finishMake() {
    A.sfx("win");
    const mine = { seed, code: encode(seed, picks), name: myName, picks: picks.slice() };
    A.save(MINE_KEY, mine);
    paintMade(mine);
    show("made");
  }

  function paintMade(mine) {
    const list = setFor(mine.seed);
    $("made-list").innerHTML = list
      .map(([text, opts], i) => {
        const [emo, label] = opts[mine.picks[i]];
        return `<li><span class="n">Q${i + 1}</span><span class="q">${A.esc(text.replace("{who}", "나는").replace("{whose}", "내"))}</span><span class="a">${emo} ${A.esc(label)}</span></li>`;
      })
      .join("");
  }

  function quizUrl(mine, extra) {
    const q = new URLSearchParams({ s: String(mine.seed), a: mine.code, n: mine.name });
    if (extra) Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    return `${A.SITE}${PATH}?${q.toString()}`;
  }

  function sendMine(kind) {
    const mine = A.store(MINE_KEY, null);
    if (!mine) return;
    const url = quizUrl(mine);
    if (kind === "kakao") {
      A.kakao({
        gameId: "guess-me",
        title: `${mine.name}님을 맞혀봐! 💌`,
        description: "내 취향 10문제, 너는 몇 개나 맞힐까?",
        buttonTitle: "맞히러 가기",
        url,
      });
    } else {
      A.share({ title: "나를 맞혀봐 | 오늘의 게임", text: `${mine.name}님을 맞혀봐! 내 취향 10문제, 몇 개나 맞힐까?`, url });
    }
  }

  /* ---------- 다 맞혔을 때 ---------- */
  function tierOf(n) {
    if (n === PER) return ["💯", "영혼의 단짝", "이 정도면 거의 텔레파시! 서로 모르는 게 없는 사이예요."];
    if (n >= 8) return ["🫶", "찐친 인정", "취향을 훤히 꿰고 있어요. 진짜 친구 맞네요!"];
    if (n >= 6) return ["😎", "꽤 아는 사이", "웬만한 건 다 알아요. 조금만 더 친해지면 찐친!"];
    if (n >= 4) return ["🤔", "아는 듯 모르는 사이", "생각보다 모르는 게 많았어요. 밥 한 번 같이 먹어요!"];
    return ["🙇", "처음 뵙겠습니다", "앞으로 알아 갈 게 많은 사이! 오늘부터 친해지기 시작!"];
  }

  function finishGuess() {
    const got = picks.filter((p, i) => p === friend.ans[i]).length;
    const [emo, tier, desc] = tierOf(got);
    A.sfx(got >= 6 ? "win" : "pick");
    $("score-emoji").textContent = emo;
    $("score-who").textContent = `${friend.name}님을 맞힌 개수`;
    $("score-h").textContent = `${got} / ${PER}`;
    $("score-tier").textContent = tier;
    $("score-desc").textContent = desc;
    $("score-list").innerHTML = qs
      .map(([text, opts], i) => {
        const ok = picks[i] === friend.ans[i];
        const [e, label] = opts[friend.ans[i]];
        return `<li class="${ok ? "ok" : "no"}"><span class="n">${ok ? "⭕" : "❌"}</span><span class="q">${A.esc(phrase(text, friend.name))}</span><span class="a">${e} ${A.esc(label)}</span></li>`;
      })
      .join("");
    lastScore = got;
    show("scored");
  }

  let lastScore = 0;
  function brag(kind) {
    const me = savedName() || "나";
    const url = quizUrl({ seed: friend.seed, code: friend.code, name: friend.name }, { g: me, gs: String(lastScore) });
    const text = `${friend.name}님 문제 ${lastScore}/${PER} 맞혔어요! (${tierOf(lastScore)[1]})`;
    if (kind === "kakao") {
      A.kakao({ gameId: "guess-me", title: text, description: `${friend.name}님을 얼마나 아는지 너도 해 봐!`, buttonTitle: "나도 맞히기", url });
    } else {
      A.share({ title: "나를 맞혀봐 | 오늘의 게임", text, url });
    }
  }

  /* ---------- 버튼 ---------- */
  $("make-btn").addEventListener("click", () => {
    if (friend && $("make-card").classList.contains("hidden")) {
      $("make-card").classList.remove("hidden");
      $("my-name").focus();
      return;
    }
    startMake();
  });
  $("guess-btn").addEventListener("click", startGuess);
  $("mine-btn").addEventListener("click", () => {
    const mine = A.store(MINE_KEY, null);
    if (!mine) return;
    paintMade(mine);
    show("made");
  });
  $("gm-next").addEventListener("click", next);
  $("gm-back").addEventListener("click", prev);
  $("send-kakao").addEventListener("click", () => sendMine("kakao"));
  $("send-link").addEventListener("click", () => sendMine("link"));
  $("remake-btn").addEventListener("click", () => {
    paintTitle();
    show("title");
  });
  $("brag-kakao").addEventListener("click", () => brag("kakao"));
  $("brag-link").addEventListener("click", () => brag("link"));
  $("me-too-btn").addEventListener("click", () => {
    $("make-card").classList.remove("hidden");
    show("title");
    $("my-name").focus();
  });
  $("my-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") startMake();
  });

  document.addEventListener("keydown", (e) => {
    if (screens.play.classList.contains("hidden")) return;
    const n = qs[idx] ? qs[idx][1].length : 0;
    if (!locked && /^[1-4]$/.test(e.key) && Number(e.key) <= n) pick(Number(e.key) - 1);
    else if (locked && mode === "guess" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      next();
    }
  });

  // 친구 문제를 받았으면 이름 칸은 '나도 만들기' 누를 때만
  if (friend) $("make-card").classList.add("hidden");
  paintTitle();
})();
