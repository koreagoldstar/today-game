(() => {
  "use strict";

  const A = window.TodayAdult;
  const PATH = "/games/balance-game/";
  const PER_SET = 10;

  /** [id, A, B] — id 는 집계 키라 바꾸지 말 것 (새 질문은 뒤에 추가) */
  const QUESTIONS = [
    ["q01", "평생 짜장면만 먹기", "평생 짬뽕만 먹기"],
    ["q02", "탕수육 부먹", "탕수육 찍먹"],
    ["q03", "여름에 에어컨 없이 살기", "겨울에 난방 없이 살기"],
    ["q04", "월급 2배, 주 6일 근무", "월급 그대로, 주 4일 근무"],
    ["q05", "10년 전으로 돌아가기", "10년 뒤로 가 보기"],
    ["q06", "평생 스마트폰 없이 살기", "평생 친구 없이 살기"],
    ["q07", "깻잎 떼어주는 애인", "새우 까주는 애인"],
    ["q08", "아침형 인간", "저녁형 인간"],
    ["q09", "엘리베이터 없는 20층 사무실", "화장실 없는 사무실"],
    ["q10", "말 많은 상사", "말 없는 상사"],
    ["q11", "로또 1등 1번", "평생 매달 300만 원"],
    ["q12", "내 생각이 다 들리는 사람", "남의 생각이 다 들리는 사람"],
    ["q13", "치킨 평생 무료", "피자 평생 무료"],
    ["q14", "물복숭아", "딱복숭아"],
    ["q15", "민트초코 좋아", "민트초코 싫어"],
    ["q16", "회식 2차 노래방", "회식 2차 없이 귀가"],
    ["q17", "답장 빠른데 단답", "답장 느린데 장문"],
    ["q18", "산으로 휴가", "바다로 휴가"],
    ["q19", "연봉 높은 야근 회사", "연봉 낮은 칼퇴 회사"],
    ["q20", "평생 여름", "평생 겨울"],
    ["q21", "순대 소금", "순대 막장·쌈장"],
    ["q22", "샤워 아침에", "샤워 저녁에"],
    ["q23", "동물과 대화하기", "모든 외국어 하기"],
    ["q24", "택배 하루 늦게 오기", "택배 박스 찌그러져 오기"],
    ["q25", "카톡 읽고 답 안 하기 (읽씹)", "카톡 안 읽고 두기 (안읽씹)"],
    ["q26", "배달비 5천 원", "직접 30분 걸어가기"],
    ["q27", "재택근무 평생", "출근 평생 (대신 집 앞 회사)"],
    ["q28", "라면에 계란 넣기", "라면에 계란 안 넣기"],
    ["q29", "카톡 프사 매일 바꾸는 친구", "프사 기본인 친구"],
    ["q30", "영화관에서 팝콘", "영화관에서 오징어"],
    ["q31", "잠 4시간 자고 일 잘하기", "잠 10시간 자고 일 평범"],
    ["q32", "평생 반팔", "평생 긴팔"],
    ["q33", "고기 굽는 사람", "고기 먹기만 하는 사람"],
    ["q34", "지하철 서서 30분", "버스 앉아서 60분"],
    ["q35", "김치볶음밥", "카레라이스"],
    ["q36", "투명인간 되기", "하늘 날기"],
    ["q37", "월요일 없애기", "금요일 하나 더"],
    ["q38", "단톡방 알림 999+", "메일함 안 읽음 999+"],
    ["q39", "콜라", "사이다"],
    ["q40", "여행 계획 꼼꼼히", "여행 즉흥으로"],
    ["q41", "아이폰", "갤럭시"],
    ["q42", "커피 없는 1년", "디저트 없는 1년"],
    ["q43", "영원히 25살 얼굴", "영원히 25살 체력"],
    ["q44", "친구 결혼식 축사", "친구 결혼식 축가"],
    ["q45", "냉면 물냉", "냉면 비냉"],
    ["q46", "귀신 보이는 능력", "1분 뒤 미래 보는 능력"],
    ["q47", "점심 혼밥", "점심 팀 다 같이"],
    ["q48", "붕어빵 머리부터", "붕어빵 꼬리부터"],
    ["q49", "1년 동안 휴가", "평생 1년에 1주 휴가 더"],
    ["q50", "알람 5개 맞추기", "알람 1개 맞추기"],
    ["q51", "어색한 사이 엘리베이터 둘이", "어색한 사이 택시 둘이"],
    ["q52", "고수 듬뿍", "고수 빼 주세요"],
    ["q53", "휴대폰 배터리 항상 10%", "와이파이 항상 1칸"],
    ["q54", "평생 노래방 금지", "평생 PC방 금지"],
    ["q55", "소주", "맥주"],
    ["q56", "집 넓은데 회사 멀리", "집 좁은데 회사 바로 앞"],
    ["q57", "유명해지기", "부자 되기 (아무도 모르게)"],
    ["q58", "새벽 4시 기상 평생", "새벽 4시 취침 평생"],
    ["q59", "떡볶이 밀떡", "떡볶이 쌀떡"],
    ["q60", "과거 기억 다 지우기", "미래 기억 미리 알기"],
  ];

  const $ = (id) => document.getElementById(id);
  const screens = { title: $("title"), play: $("play"), over: $("over") };
  const params = new URLSearchParams(location.search);

  /** 날짜 → 그날의 세트 (모두 같은 10문제) */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let s = seed || 1;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  function setFor(key) {
    const r = rng(hash(`bal-${key}`));
    const idx = QUESTIONS.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, PER_SET).map((i) => QUESTIONS[i]);
  }

  const today = A.seoulDay();
  const friendSet = /^\d{4}-\d{2}-\d{2}$/.test(params.get("d") || "") ? params.get("d") : null;
  const friendAns = /^[ab]{10}$/.test(params.get("r") || "") ? params.get("r") : null;
  const friendName = (params.get("n") || "").slice(0, 8);

  let setKey = friendSet && friendAns ? friendSet : today;
  let questions = setFor(setKey);
  let idx = 0;
  let answers = [];
  let majority = 0;
  let measured = 0;
  let polls = {};
  let locked = false;

  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    window.scrollTo(0, 0);
  }

  function paintTitle() {
    const done = A.store(`today-adult-bal-${today}`, null);
    $("title-today").textContent = `${today.slice(5).replace("-", "월 ")}일 세트 · ${PER_SET}문제`;
    const fb = $("friend-banner");
    if (friendAns) {
      fb.classList.remove("hidden");
      fb.innerHTML = `<b>${A.esc(friendName || "친구")}</b>님이 밸런스 게임 궁합을 물어봤어요!<br />같은 10문제에 답하고 몇 개 같은지 확인해 보세요.`;
      $("start-btn").textContent = "궁합 확인하러 가기";
    } else if (done) {
      $("title-done").classList.remove("hidden");
      $("title-done").textContent = `오늘 세트 완료!${done.measured ? ` 다수파 ${done.majority}/${done.measured}` : ""} · 다시 해도 집계에는 한 번만 들어가요`;
    }
  }

  async function start() {
    idx = 0;
    answers = [];
    majority = 0;
    measured = 0;
    show("play");
    paintQ();
    const got = await A.poll.get(questions.map((q) => `bal-${q[0]}`));
    if (got) polls = got;
  }

  function paintQ() {
    const q = questions[idx];
    locked = false;
    $("q-num").textContent = `${idx + 1} / ${PER_SET}`;
    $("q-bar").style.width = `${(idx / PER_SET) * 100}%`;
    [
      ["opt-a", q[1], "a"],
      ["opt-b", q[2], "b"],
    ].forEach(([id, text]) => {
      const el = $(id);
      el.classList.remove("chosen", "other", "revealed");
      el.querySelector(".bal-text").textContent = text;
      el.querySelector(".bal-pct").textContent = "";
      el.querySelector(".bal-fill").style.width = "0%";
    });
    $("next-btn").classList.add("hidden");
    $("q-note").textContent = friendAns ? "" : "고르면 다른 사람들의 선택이 보여요";
  }

  async function choose(side) {
    if (locked) return;
    locked = true;
    A.sfx("pick");
    const q = questions[idx];
    const pollId = `bal-${q[0]}`;
    answers.push(side);

    const votedKey = `today-adult-bal-voted-${pollId}`;
    let counts = polls[pollId] || null;
    if (!A.store(votedKey, false)) {
      const fresh = await A.poll.vote(pollId, side);
      if (fresh) {
        counts = fresh;
        A.save(votedKey, true);
      }
    }
    let a = (counts && counts.a) || 0;
    let b = (counts && counts.b) || 0;
    const noData = a + b === 0;
    // 집계가 없으면 내 선택만 반영 (다수파 계산에서는 뺌)
    if (noData) {
      if (side === "a") a = 1;
      else b = 1;
    }
    const pa = Math.round((a / (a + b)) * 100);
    const pb = 100 - pa;
    // 나 혼자만 있는 집계(첫 투표)는 다수파 판정에서 제외
    if (a + b >= 2) {
      measured += 1;
      if ((side === "a" ? pa : pb) >= 50) majority += 1;
    }

    [
      ["opt-a", pa, "a"],
      ["opt-b", pb, "b"],
    ].forEach(([id, pct, s]) => {
      const el = $(id);
      el.classList.add("revealed", s === side ? "chosen" : "other");
      el.querySelector(".bal-pct").textContent = `${pct}%`;
      requestAnimationFrame(() => {
        el.querySelector(".bal-fill").style.width = `${pct}%`;
      });
    });

    let note = noData
      ? "아직 집계가 없어요. 이 질문의 첫 투표!"
      : `${(a + b).toLocaleString("ko-KR")}명 중 ${side === "a" ? pa : pb}%가 나와 같은 선택`;
    if (friendAns) {
      const fa = friendAns[idx];
      note = fa === side ? `💞 ${friendName || "친구"}님도 같은 선택!` : `${friendName || "친구"}님은 반대를 골랐어요`;
    }
    $("q-note").textContent = note;
    $("next-btn").classList.remove("hidden");
    $("next-btn").textContent = idx + 1 >= PER_SET ? "결과 보기" : "다음 문제";
  }

  function next() {
    idx += 1;
    if (idx >= PER_SET) {
      finish();
      return;
    }
    paintQ();
  }

  function typeOf(m) {
    if (m >= 9) return ["🐑", "완벽한 대세파", "남들과 생각이 거의 똑같아요. 어디서나 무난하게 잘 어울리는 타입!"];
    if (m >= 7) return ["🙂", "공감 능력자", "대부분 사람들과 통해요. 그래도 가끔 나만의 고집이 있어요."];
    if (m >= 4) return ["⚖️", "밸런스 장인", "대세와 소수 사이를 오가는 균형 잡힌 취향이에요."];
    if (m >= 2) return ["🦄", "개성파", "남들이 안 고르는 걸 고르는 편. 취향 확실한 사람!"];
    return ["👽", "외계인급 소수파", "거의 모든 문제에서 소수 의견! 당신만의 세계가 있군요."];
  }

  function finish() {
    A.sfx("win");
    $("q-bar").style.width = "100%";
    // 집계가 모자라면 10문제 기준으로 환산
    const scaled = measured ? Math.round((majority / measured) * PER_SET) : -1;
    const [emoji, name, desc] =
      scaled < 0 ? ["🌱", "개척자", "아직 이 질문들에 답한 사람이 거의 없어요. 당신이 첫 기준이 됐어요!"] : typeOf(scaled);
    $("res-emoji").textContent = emoji;
    $("res-type").textContent = name;
    $("res-desc").textContent = desc;
    $("res-major").textContent = measured ? `다수파 선택 ${majority} / ${measured}` : "다른 사람들 답을 기다리는 중";

    const fr = $("res-friend");
    if (friendAns) {
      const same = answers.filter((x, i) => x === friendAns[i]).length;
      const pct = same * 10;
      const label =
        same >= 9 ? "영혼의 단짝 💖" : same >= 7 ? "찰떡궁합 😍" : same >= 5 ? "적당히 잘 맞아요 🙂" : same >= 3 ? "다르니까 재밌는 사이 😆" : "정반대 매력 ⚡";
      fr.classList.remove("hidden");
      fr.innerHTML = `<b>${A.esc(friendName || "친구")}</b>님과 궁합 <b class="bal-big">${pct}%</b><br />${same}개 같은 선택 · ${label}`;
    } else {
      fr.classList.add("hidden");
    }

    $("res-list").innerHTML = questions
      .map((q, i) => {
        const mine = answers[i] === "a" ? q[1] : q[2];
        const fmark = friendAns ? (friendAns[i] === answers[i] ? " 💞" : " ⚡") : "";
        return `<li><span class="bal-q">Q${i + 1}</span> ${A.esc(mine)}${fmark}</li>`;
      })
      .join("");

    if (setKey === today && !friendAns) A.save(`today-adult-bal-${today}`, { majority, measured, at: Date.now() });
    show("over");
  }

  function shareUrl() {
    let name = "";
    try {
      name = (localStorage.getItem("today-game-name") || "").slice(0, 8);
    } catch (_) {
      /* 없음 */
    }
    const q = new URLSearchParams({ d: setKey, r: answers.join("") });
    if (name) q.set("n", name);
    return `${A.SITE}${PATH}?${q.toString()}`;
  }

  async function askName() {
    let name = "";
    try {
      name = localStorage.getItem("today-game-name") || "";
    } catch (_) {
      /* 없음 */
    }
    if (!name) {
      const input = $("my-name");
      name = String((input && input.value) || "").trim().slice(0, 8);
      if (name) {
        try {
          localStorage.setItem("today-game-name", name);
        } catch (_) {
          /* 저장 불가 */
        }
      }
    }
    return name;
  }

  $("share-kakao").addEventListener("click", async () => {
    const name = await askName();
    await A.kakao({
      gameId: "balance-game",
      title: `${name || "친구"}님이 밸런스 게임 궁합을 물어봐요!`,
      description: "같은 10문제, 나랑 몇 개나 같을까?",
      buttonTitle: "궁합 확인하기",
      url: shareUrl(),
    });
  });

  $("share-link").addEventListener("click", async () => {
    const name = await askName();
    await A.share({
      title: "밸런스 게임 궁합 테스트 | 오늘의 게임",
      text: `${name || "내"} 밸런스 게임 답 맞혀 봐! 10문제 중 몇 개 같을까?`,
      url: shareUrl(),
    });
  });

  $("opt-a").addEventListener("click", () => choose("a"));
  $("opt-b").addEventListener("click", () => choose("b"));
  $("next-btn").addEventListener("click", next);
  $("start-btn").addEventListener("click", start);
  $("again-btn").addEventListener("click", () => {
    setKey = today;
    questions = setFor(setKey);
    start();
  });

  document.addEventListener("keydown", (e) => {
    if (screens.play.classList.contains("hidden")) return;
    if (!locked && (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "1")) choose("a");
    else if (!locked && (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "2")) choose("b");
    else if (locked && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      next();
    }
  });

  // 이름 입력칸: 저장된 이름이 있으면 숨김
  try {
    const saved = localStorage.getItem("today-game-name");
    if (saved) $("name-row").classList.add("hidden");
  } catch (_) {
    /* 없음 */
  }

  paintTitle();
})();
