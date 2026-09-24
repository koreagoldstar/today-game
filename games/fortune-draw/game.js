(() => {
  "use strict";

  const CATS = {
    fortune: {
      title: "오늘의 운세",
      emoji: "🌟",
      hint: "알을 눌러 오늘의 운세를 봐요",
      pool: [
        { t: "행운이 가득한 날", d: "작은 일에도 운이 따라와요. 미뤄 둔 일을 시작해 보기 좋아요." },
        { t: "차분함이 필요한 날", d: "서두르면 실수하기 쉬운 하루예요. 한 템포 쉬어 가면 더 잘 풀려요." },
        { t: "인연이 찾아오는 날", d: "우연한 만남이나 연락이 좋은 소식으로 이어질 수 있어요." },
        { t: "재충전이 필요한 날", d: "무리하지 말고 컨디션을 챙기세요. 일찍 쉬는 것만으로도 내일이 달라져요." },
        { t: "집중력이 빛나는 날", d: "평소보다 몰입이 잘 되는 하루예요. 공부나 중요한 결정을 하기 좋아요." },
        { t: "뜻밖의 행운이 있는 날", d: "생각지 못한 곳에서 좋은 일이 생길 수 있어요. 기대해 보세요." },
        { t: "배려가 통하는 날", d: "작은 친절이 크게 돌아와요. 먼저 다가가면 관계가 더 좋아져요." },
        { t: "안정이 필요한 날", d: "큰 변화보다는 지금 하던 대로 꾸준히 가는 게 좋아요." },
        { t: "웃음이 많은 날", d: "사소한 농담이 분위기를 밝혀 줘요. 유머를 아끼지 마세요." },
        { t: "정리의 날", d: "방을 치우거나 할 일을 적어 두면 마음이 한결 가벼워져요." },
        { t: "용기가 돋는 날", d: "평소 못 한 말을 꺼내 보기 좋아요. 솔직함이 길을 열어 줘요." },
        { t: "건강을 챙기는 날", d: "물 한 잔, 스트레칭 한 번이 큰 힘이 되는 하루예요." },
        { t: "아이디어가 샘솟는 날", d: "메모지를 가까이 두세요. 스치는 생각이 보물이 될 수 있어요." },
        { t: "기다림이 약이 되는 날", d: "결과가 바로 안 보여도 괜찮아요. 씨앗이 천천히 자라고 있어요." },
        { t: "친구가 힘이 되는 날", d: "혼자 끙끙대지 말고 옆 사람에게 기대 보세요." },
        { t: "작은 선물이 오는 날", d: "꼭 물건이 아니어도 좋아요. 칭찬 한 마디가 선물이 돼요." },
        { t: "길이 열리는 날", d: "막혀 있던 일이 슬슬 풀려요. 문을 두드려 보세요." },
        { t: "겸손이 빛나는 날", d: "자랑보다 경청이 더 강한 하루예요." },
        { t: "도전이 즐거운 날", d: "새로운 게임을 켜 보듯, 새로운 한 걸음을 떼어 보세요." },
        { t: "감사의 날", d: "오늘 고마운 사람 한 명을 떠올리면 운이 더 밝아져요." },
        { t: "속도보다 방향의 날", d: "빨리보다 바로 가는 게 이득인 하루예요." },
        { t: "우연이 필연이 되는 날", d: "스치는 대화, 눈에 띈 문구를 그냥 지나치지 마세요." },
        { t: "집이 편한 날", d: "바깥보다 안에서 충전하면 내일 더 잘 달려요." },
        { t: "바깥 바람이 좋은 날", d: "짧은 산책만으로도 머리가 맑아져요." },
        { t: "실수가 배움이 되는 날", d: "틀려도 괜찮아요. 다시 하면 더 잘하게 돼요." },
        { t: "팀워크의 날", d: "혼자보다 둘이, 둘보다 여럿이 더 즐거운 하루예요." },
        { t: "금전운이 부드러운 날", d: "큰돈보다 새는 돈을 막는 게 이득이에요." },
        { t: "공부운이 좋은 날", d: "한 페이지라도 읽으면 쌓여요. 삐약이도 응원해요." },
        { t: "창의력이 반짝이는 날", d: "색다른 조합을 시도해 보세요. 실패해도 재미있어요." },
        { t: "인내의 열매가 있는 날", d: "그동안 버틴 일이 슬슬 모습을 드러내요." },
        { t: "새 출발의 날", d: "어제 일은 어제에 두고, 오늘은 새 판이에요." },
        { t: "따뜻한 말의 날", d: "칭찬 한 마디가 상대의 하루를 바꿔 줄 수 있어요." },
        { t: "관찰력이 예민한 날", d: "디테일을 보면 숨은 힌트가 보여요." },
        { t: "휴식이 실력인 날", d: "쉬는 것도 할 일이에요. 죄책감은 내려놓아요." },
        { t: "약속이 행운인 날", d: "시간 약속을 지키면 신뢰가 쌓여 운이 붙어요." },
        { t: "정리하면 들어오는 날", d: "책상만 치워도 좋은 소식이 앉을 자리가 생겨요." },
        { t: "첫걸음의 날", d: "거창하지 않아도 돼요. 시작이 반이에요." },
        { t: "웃음 복이 있는 날", d: "코미디 한 편, 친구와 수다가 약이에요." },
        { t: "밸런스의 날", d: "일과 놀이, 둘 다 조금씩이면 충분해요." },
        { t: "행운의 노란 날", d: "노란 물건이 눈에 띄면 오늘의 마스코트예요." },
      ],
    },
    lunch: {
      title: "오늘의 점심",
      emoji: "🍜",
      hint: "알을 눌러 점심 메뉴를 뽑아요",
      pool: [
        { t: "김치찌개", d: "든든하고 얼큰한 한 그릇이 필요한 날이에요. 밥 한 공기 추가는 필수!" },
        { t: "돈까스", d: "바삭한 튀김옷에 소스 듬뿍! 확실한 만족감으로 채워 보세요." },
        { t: "비빔밥", d: "가볍지만 든든하게, 여러 재료를 골고루 비벼 보세요." },
        { t: "짜장면", d: "고민 없이 즐길 국민 메뉴! 곱빼기도 좋은 선택이에요." },
        { t: "샐러드 볼", d: "속이 편한 하루를 원한다면 채소 위주로 가보세요." },
        { t: "김밥 한 줄", d: "바쁜 하루엔 든든한 김밥 한 줄이면 충분해요." },
        { t: "라멘", d: "진한 국물이 당기는 날이에요. 반숙 계란 토핑 잊지 마세요." },
        { t: "초밥", d: "오늘은 나에게 작은 사치를 허락해도 좋은 날이에요." },
        { t: "된장찌개", d: "구수한 국물에 밥 비벼 먹으면 마음이 안정돼요." },
        { t: "순두부찌개", d: "부드럽고 칼칼한 한 그릇이 속을 달래 줘요." },
        { t: "떡볶이", d: "매콤달콤이 당기면 주저하지 마세요. 튀김 추가는 옵션!" },
        { t: "라면", d: "빠르고 확실한 한 끼. 파와 계란만 있어도 최고예요." },
        { t: "삼겹살", d: "고기 굽는 소리가 힐링인 날이에요. 쌈 채소도 챙기세요." },
        { t: "냉면", d: "시원한 면 한 그릇이 머리를 맑게 해 줘요." },
        { t: "칼국수", d: "따뜻한 국수 한 그릇이 비 오는 마음도 달래요." },
        { t: "우동", d: "통통한 면발이 위로가 되는 날이에요." },
        { t: "햄버거", d: "손으로 집어 먹는 재미가 있는 날이에요." },
        { t: "샌드위치", d: "가볍게, 하지만 속이 되게. 산책하며 먹어도 좋아요." },
        { t: "쌀국수", d: "향긋한 국물이 기분 전환을 도와줘요." },
        { t: "카레", d: "향신료 한 스푼이 오후를 깨워 줘요." },
        { t: "덮밥", d: "밥 위에 올라간 토핑이 고민을 줄여 줘요." },
        { t: "오므라이스", d: "노란 계란 옷이 오늘의 행운 색이에요." },
        { t: "치킨", d: "바삭한 위로가 필요할 때. 양념이든 후라이드든 승리예요." },
        { t: "피자", d: "나눠 먹기 좋은 날. 혼자여도 한 조각의 행복은 충분해요." },
        { t: "파스타", d: "면 요리가 당기는 날이에요. 토마토든 크림이든 OK." },
        { t: "국밥", d: "뜨끈한 국밥 한 그릇이면 오후가 버텨져요." },
        { t: "순대국", d: "진한 국물이 속을 꽉 채워 주는 날이에요." },
        { t: "부대찌개", d: "이것저것 모여도 맛있는 날. 팀플레이 같은 찌개예요." },
        { t: "제육볶음", d: "매콤한 돼지고기가 밥도둑이 되는 날이에요." },
        { t: "생선구이", d: "담백한 한 끼가 몸을 가볍게 해 줘요." },
        { t: "회덮밥", d: "신선함이 당기는 날이에요. 고추냉이 살살." },
        { t: "토스트", d: "바쁜 오전이면 길거리 토스트가 정답일 수 있어요." },
        { t: "샐러드+단백질", d: "가볍게 가되 계란이나 닭가슴살을 더해 보세요." },
        { t: "잔치국수", d: "잔치까지는 아니어도, 면 한 그릇은 잔치예요." },
        { t: "만두", d: "찌든 굽든 오늘은 만두가 정답에 가까워요." },
        { t: "볶음밥", d: "남은 재료로도 훌륭한 한 끼가 되는 날이에요." },
        { t: "우육면", d: "진한 고기 국물이 필요한 날이에요." },
        { t: "모밀", d: "차갑고 담백한 면이 머리를 식혀 줘요." },
        { t: "컵밥", d: "빠르고 귀여운 한 끼. 죄책감 없이 즐겨요." },
        { t: "집밥 백반", d: "반찬 여러 개가 마음을 넓혀 주는 날이에요." },
      ],
    },
    item: {
      title: "오늘의 행운템",
      emoji: "🍀",
      hint: "알을 눌러 행운 아이템을 봐요",
      pool: [
        { t: "파란색 소품", d: "파란색 물건을 하나 지니면 마음이 한결 차분해져요." },
        { t: "좋아하는 향의 핸드크림", d: "좋은 향이 기분 전환에 큰 도움이 되는 하루예요." },
        { t: "작은 메모지", d: "문득 떠오른 아이디어를 놓치지 마세요. 기록이 힘이 돼요." },
        { t: "귀여운 스티커", d: "작은 즐거움이 하루를 밝혀 줘요. 다이어리에 하나 붙여 보세요." },
        { t: "따뜻한 텀블러", d: "따뜻한 음료 한 잔이 오늘의 컨디션을 지켜 줄 거예요." },
        { t: "이어폰", d: "좋아하는 음악과 함께라면 하루가 더 가볍게 흘러가요." },
        { t: "우산", d: "꼭 비가 오지 않아도, 만약을 대비하면 마음이 편해져요." },
        { t: "동전 하나", d: "주머니 속 동전 하나가 뜻밖의 행운을 부를 수 있어요." },
        { t: "노란 양말", d: "발끝부터 밝아지는 하루예요. 삐약이 컬러를 신어 보세요." },
        { t: "모자", d: "머리를 가려 주면 자신감이 올라가는 날이에요." },
        { t: "손수건", d: "작은 손수건이 당황한 순간을 구원해 줘요." },
        { t: "립밤", d: "입술을 촉촉하게. 말할 일이 많은 하루예요." },
        { t: "물병", d: "물을 자주 마시면 집중력이 더 오래 가요." },
        { t: "머리끈", d: "머리를 묶으면 일이 술술 풀리는 느낌이 들어요." },
        { t: "키링", d: "열쇠에 달린 작은 친구가 길을 지켜 줘요." },
        { t: "선글라스", d: "눈이 부신 날. 스타일도 운도 같이 챙겨 보세요." },
        { t: "밴드에이드", d: "작은 상처를 대비하면 큰 걱정이 줄어요." },
        { t: "휴대용 충전기", d: "배터리가 떨어지지 않게. 연락운이 좋은 날이에요." },
        { t: "책 한 권", d: "가방에 얇은 책을 넣으면 기다리는 시간이 보물이 돼요." },
        { t: "볼펜", d: "잘 써지는 펜 하나가 오늘의 결정을 도와줘요." },
        { t: "민트 사탕", d: "입을 상쾌하게. 대화운이 열리는 날이에요." },
        { t: "손난로", d: "손끝이 따뜻하면 마음도 풀려요." },
        { t: "부채", d: "더운 공기를 한 번 저어 주면 기분도 환기돼요." },
        { t: "마스크", d: "필요할 때를 대비하는 센스가 행운을 불러요." },
        { t: "손거울", d: "표정 체크 한 번이 자신감을 올려 줘요." },
        { t: "행운의 클립", d: "종이 클립 하나에도 의미를 붙여 보세요." },
        { t: "흰색 티셔츠", d: "깨끗한 시작. 마음이 정돈되는 옷이에요." },
        { t: "분홍 소품", d: "귀여운 색이 긴장을 풀어 주는 날이에요." },
        { t: "초록 식물", d: "작은 화분이 책상을 살아 있게 해 줘요." },
        { t: "사진 한 장", d: "좋아하는 사람 사진이 용기를 줘요." },
        { t: "손목시계", d: "시간을 보면 하루가 흐트러지지 않아요." },
        { t: "노트", d: "끄적임이 계획을 되고, 계획이 운이 돼요." },
        { t: "손세정제", d: "손을 깨끗이. 상쾌함이 행운을 붙잡아 줘요." },
        { t: "스티커 메모", d: "할 일 하나를 붙여 두면 까먹지 않아요." },
        { t: "작은 인형", d: "가방 속 친구 하나가 심심함을 달래 줘요." },
        { t: "빗", d: "머리를 정돈하면 생각도 정돈돼요." },
        { t: "손전등", d: "어두운 구석을 밝히는 작은 용기예요." },
        { t: "에코백", d: "가벼운 가방이 발걸음을 가볍게 해 줘요." },
        { t: "행운의 돌", d: "주운 돌 하나에도 오늘의 이야기를 붙여 보세요." },
        { t: "노란 병아리 뱃지", d: "오늘의게임 마스코트와 함께면 무조건 귀여운 하루예요." },
      ],
    },
  };

  const todayKey = new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);

  function seedFromString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
    return h;
  }

  function mulberry32(seed) {
    return function rand() {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function storageKey(cat) {
    return `tg_fortune_${cat}_${todayKey}`;
  }

  function nextResetTime() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = Number((parts.find((p) => p.type === "hour") || {}).value);
    const minute = Number((parts.find((p) => p.type === "minute") || {}).value);
    const remain = (23 - hour) * 60 + (60 - minute);
    return `${Math.floor(remain / 60)}시간 ${remain % 60}분`;
  }

  let currentCat = "fortune";
  const els = {
    title: document.getElementById("page-title"),
    draw: document.getElementById("draw"),
    result: document.getElementById("result"),
    egg: document.getElementById("egg"),
    hint: document.getElementById("hint"),
    emoji: document.getElementById("r-emoji"),
    rTitle: document.getElementById("r-title"),
    rDesc: document.getElementById("r-desc"),
    timer: document.getElementById("timer"),
    share: document.getElementById("share-btn"),
    next: document.getElementById("next-btn"),
    tabs: [...document.querySelectorAll(".tab")],
  };

  function renderResult(catKey, item) {
    const cat = CATS[catKey];
    els.emoji.textContent = cat.emoji;
    els.rTitle.textContent = item.t;
    els.rDesc.textContent = item.d;
    els.draw.classList.add("hide");
    els.result.classList.add("show");
    els.timer.textContent = `이 항목은 ${nextResetTime()} 후에 다시 열려요`;
  }

  function renderDraw(catKey) {
    els.result.classList.remove("show");
    els.draw.classList.remove("hide");
    els.timer.textContent = "";
    els.hint.textContent = CATS[catKey].hint;
  }

  function switchTab(catKey) {
    currentCat = catKey;
    els.tabs.forEach((t) => t.classList.toggle("active", t.dataset.cat === catKey));
    els.title.textContent = CATS[catKey].title;
    const saved = localStorage.getItem(storageKey(catKey));
    if (saved) renderResult(catKey, JSON.parse(saved));
    else renderDraw(catKey);
  }

  els.egg.addEventListener("click", () => {
    if (els.egg.classList.contains("shaking")) return;
    els.egg.classList.add("shaking");
    window.setTimeout(() => {
      els.egg.classList.remove("shaking");
      const cat = CATS[currentCat];
      const rand = mulberry32(seedFromString(`${todayKey}_${currentCat}`));
      const item = cat.pool[Math.floor(rand() * cat.pool.length)];
      localStorage.setItem(storageKey(currentCat), JSON.stringify(item));
      renderResult(currentCat, item);
    }, 500);
  });

  els.tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.cat)));

  els.next.addEventListener("click", () => {
    const keys = Object.keys(CATS);
    switchTab(keys[(keys.indexOf(currentCat) + 1) % keys.length]);
  });

  els.share.addEventListener("click", async () => {
    if (!window.TodayScores || !TodayScores.shareToKakao) return;
    const title = els.rTitle.textContent || "오늘의 운세";
    const desc = els.rDesc.textContent || "";
    const canvas = TodayScores.makeResultCard
      ? TodayScores.makeResultCard({
          eyebrow: "오늘의게임 · 운세 뽑기",
          title: els.title.textContent || "오늘의 운세",
          hero: title.slice(0, 12),
          lines: [desc.slice(0, 28), desc.slice(28, 56)].filter(Boolean),
          bg0: "#4a2a18",
          bg1: "#1a0e0a",
          accent: "#ffe156",
        })
      : null;
    const result = await TodayScores.shareToKakao({
      gameId: "fortune-draw",
      gameTitle: "오늘의 운세 뽑기",
      title: `${els.title.textContent} · ${title}`,
      description: desc,
      score: 0,
      scoreLabel: title,
      canvas,
      buttonTitle: "나도 뽑아보기",
    });
    const prev = els.share.textContent;
    els.share.textContent = result.ok ? "공유 창 열림" : "공유 실패";
    window.setTimeout(() => {
      els.share.textContent = prev;
    }, 1600);
  });

  switchTab("fortune");
})();
