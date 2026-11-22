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

  /* ---------- 사주 운세 풀이: 오늘 일진의 천간이 내 일간에게 어떤 십신인지로 풀이 ---------- */
  const S = window.Saju;
  const AREAS = ["총운", "일 · 공부", "재물", "관계 · 연애", "건강"];
  const READ = {
    비견: {
      title: ["내 힘으로 밀고 가는 날", "자신감이 차오르는 날"],
      total: ["나와 같은 기운이 들어와 마음이 단단해져요. 남에게 기대기보다 내 방식대로 밀고 갈 때 일이 풀려요.", "주관이 뚜렷해지는 하루예요. 고집과 소신 사이, 한 끗만 유연하게 가져가면 좋아요."],
      area: ["혼자 맡은 일에 집중하면 성과가 커요. 협업에선 내 의견을 한 번만 더 부드럽게.", "친구 · 동료와 어울리며 나가는 돈이 생기기 쉬워요. 더치페이가 마음 편해요.", "비슷한 사람끼리 잘 통해요. 다만 자존심 대결은 피하세요.", "체력이 좋은 날. 가볍게 땀 흘리면 기분까지 상쾌해져요."],
      tip: "오늘은 '내가 먼저' 시작해 보세요.",
      stars: [3, 4, 2, 4, 4],
    },
    겁재: {
      title: ["승부욕이 불타는 날", "지갑 단속이 필요한 날"],
      total: ["경쟁심이 살아나 추진력이 붙어요. 대신 욱하는 마음에 큰 결정을 내리지 않도록 조심하세요.", "남과 비교하는 마음이 올라오기 쉬운 날이에요. 내 속도만 지키면 충분히 잘하고 있어요."],
      area: ["라이벌이 자극이 돼요. 실력으로 보여 주되 말다툼은 손해예요.", "충동구매 · 내기 · 빌려주는 돈은 오늘 피하세요. 새는 돈을 막는 게 버는 거예요.", "질투나 서운함이 생기기 쉬워요. 솔직하게 한 마디 하면 금방 풀려요.", "과격한 운동보다 스트레칭이 좋아요. 무리하면 다치기 쉬워요."],
      tip: "결제 버튼 앞에서 10초만 쉬어 가세요.",
      stars: [3, 3, 2, 3, 3],
    },
    식신: {
      title: ["먹을 복 터지는 날", "여유와 재주가 빛나는 날"],
      total: ["마음에 여유가 생기고 좋은 기운이 술술 흘러나와요. 맛있는 걸 먹고 좋아하는 일을 하면 운이 더 올라요.", "타고난 재주가 자연스럽게 드러나는 날이에요. 만들고, 쓰고, 요리하는 일이 다 잘 풀려요."],
      area: ["아이디어와 손재주가 빛나요. 결과물을 보여 주기 좋은 날.", "꾸준히 해 온 일에서 작은 수입이나 보너스가 들어올 수 있어요.", "함께 밥 먹는 자리에서 사이가 가까워져요. 맛집 약속 추천!", "입맛이 도는 날. 과식만 조심하면 컨디션 최고예요."],
      tip: "오늘 점심은 먹고 싶은 걸로 마음껏!",
      stars: [5, 4, 4, 4, 4],
    },
    상관: {
      title: ["말솜씨가 반짝이는 날", "아이디어가 톡톡 튀는 날"],
      total: ["재치와 표현력이 넘쳐 주목받기 쉬운 날이에요. 대신 윗사람 앞에서는 말을 한 번 고르고 하세요.", "틀을 깨는 생각이 잘 떠올라요. 새로운 시도는 좋지만, 규칙은 지키는 선에서."],
      area: ["기획 · 발표 · 글쓰기에 강한 날. 비판은 부드럽게 바꿔 말하면 점수가 올라요.", "재주로 버는 돈 운이 있어요. 다만 기분 따라 쓰는 돈은 조심.", "농담이 지나치면 오해가 생겨요. 칭찬 한 마디가 더 강해요.", "생각이 많아 쉽게 피곤해질 수 있어요. 잠깐씩 눈을 쉬게 해 주세요."],
      tip: "보내기 전에 메시지를 한 번만 다시 읽어 보세요.",
      stars: [3, 4, 3, 2, 3],
    },
    편재: {
      title: ["뜻밖의 기회가 오는 날", "발이 넓어지는 날"],
      total: ["움직이는 만큼 기회가 생기는 날이에요. 새로운 사람 · 새로운 장소에서 좋은 소식이 들어와요.", "통 크게 움직이고 싶은 하루예요. 기회는 잡되 계산은 한 번 더 해 보세요."],
      area: ["영업 · 외근 · 사람 만나는 일이 잘 풀려요.", "뜻밖의 수입이나 할인 · 이벤트 운이 있어요. 다만 큰 투자는 한 번 더 따져 보세요.", "활발한 분위기로 인기가 올라가요. 새로운 만남에도 좋은 날.", "바쁘게 움직이다 끼니를 거르기 쉬워요. 물과 간식을 챙기세요."],
      tip: "평소 안 가던 길로 한 번 가 보세요.",
      stars: [4, 3, 5, 3, 3],
    },
    정재: {
      title: ["차곡차곡 쌓이는 날", "성실함이 보상받는 날"],
      total: ["꾸준히 해 온 일이 결실을 맺는 안정적인 하루예요. 계획대로 차근차근 하면 다 잘 풀려요.", "작은 것부터 정리하고 아끼는 마음이 복을 불러요. 무리하지 않아도 되는 날이에요."],
      area: ["정리 · 마감 · 꼼꼼한 확인이 빛나요. 미뤄 둔 서류를 처리하기 좋아요.", "고정 수입이 든든하고 저축 운이 좋아요. 가계부를 쓰면 더 모여요.", "믿음직한 모습이 호감을 줘요. 약속을 잘 지키면 관계가 단단해져요.", "규칙적인 식사와 잠이 최고의 보약인 날이에요."],
      tip: "오늘 쓴 돈을 한 줄만 적어 보세요.",
      stars: [4, 4, 4, 4, 4],
    },
    편관: {
      title: ["버티면 강해지는 날", "책임이 무거운 날"],
      total: ["해야 할 일과 부담이 한꺼번에 몰릴 수 있어요. 한 번에 하나씩 처리하면 생각보다 금방 끝나요.", "압박이 오는 만큼 실력도 늘어나는 날이에요. 무리하게 다 떠안지 말고 도움을 청하세요."],
      area: ["급한 일 · 갑작스러운 지시가 생길 수 있어요. 우선순위를 먼저 정하세요.", "갑자기 나가는 돈이 생기기 쉬워요. 꼭 필요한 데만 쓰세요.", "피곤함이 말투에 묻어나기 쉬워요. 가까운 사람에게 더 다정하게.", "긴장으로 어깨 · 목이 뭉치기 쉬워요. 일찍 쉬는 게 이기는 날."],
      tip: "오늘 할 일 중 하나는 내일로 미뤄도 괜찮아요.",
      stars: [2, 3, 2, 3, 2],
    },
    정관: {
      title: ["인정받는 날", "반듯하게 풀리는 날"],
      total: ["노력이 눈에 띄고 인정받기 좋은 날이에요. 원칙대로, 약속대로 하면 술술 풀려요.", "질서 있게 움직이면 운이 따라오는 하루예요. 공적인 일 · 중요한 약속에 좋아요."],
      area: ["평가 · 면접 · 보고에 강한 날. 단정한 차림이 플러스예요.", "정해진 수입이 안정적이에요. 계약 · 서류는 꼼꼼히 보면 이득이에요.", "진지한 대화가 잘 통해요. 믿음을 주는 말이 마음을 움직여요.", "생활 리듬이 잘 잡히는 날. 규칙적인 운동을 시작하기 좋아요."],
      tip: "약속 시간 5분 전에 도착해 보세요.",
      stars: [4, 5, 3, 4, 4],
    },
    편인: {
      title: ["직감이 날카로운 날", "혼자만의 시간이 약인 날"],
      total: ["직감과 아이디어가 번뜩이는 날이에요. 남들이 못 보는 걸 보지만, 생각이 많아 결정은 늦어질 수 있어요.", "조용히 혼자 집중할 때 운이 열려요. 새로운 공부나 취미를 시작하기 좋아요."],
      area: ["남다른 해결책이 떠올라요. 메모해 두면 나중에 큰 도움이 돼요.", "돈보다 배움에 쓰는 게 이득인 날. 큰 지출 결정은 미뤄도 좋아요.", "속마음을 잘 안 드러내게 되는 날. 먼저 안부를 물어 보세요.", "잡생각에 잠이 늦어질 수 있어요. 자기 전 휴대폰은 멀리."],
      tip: "떠오른 생각은 바로 메모!",
      stars: [3, 3, 2, 3, 3],
    },
    정인: {
      title: ["도움의 손길이 오는 날", "배움과 문서운이 좋은 날"],
      total: ["주변의 도움과 응원이 따라오는 따뜻한 날이에요. 혼자 끙끙대지 말고 물어보면 금방 풀려요.", "배우고 정리하는 일에 운이 붙어요. 자격증 · 공부 · 계약 같은 문서 일에 좋아요."],
      area: ["선배나 윗사람의 조언이 큰 힘이 돼요. 배운 걸 바로 써 보세요.", "큰돈보다 든든한 지원이 들어오는 날. 어른의 도움 운이 있어요.", "따뜻하게 챙겨 주는 사람이 곁에 있어요. 고맙다는 말을 전해 보세요.", "몸과 마음이 편안한 날. 푹 쉬면 회복이 빨라요."],
      tip: "고마운 사람에게 짧은 메시지를 보내 보세요.",
      stars: [4, 4, 3, 4, 5],
    },
  };
  const RELATION = {
    hap: { text: "오늘 일진이 내 일지와 합(合)을 이뤄 사람과 기회가 잘 맞물려요.", add: [1, 0, 0, 1, 0] },
    samhap: { text: "오늘 일진과 내 일지가 삼합(三合)으로 이어져 함께하는 일이 잘 풀려요.", add: [0, 1, 0, 0, 0] },
    chung: { text: "오늘 일진이 내 일지와 충(沖)해서 변동이 생기기 쉬워요. 이동 · 계약 · 중요한 말은 한 번 더 확인하세요.", add: [-1, 0, 0, 0, -1] },
    same: { text: "오늘 일진이 내 일지와 같아 익숙한 흐름이에요. 하던 일을 이어가기 좋아요.", add: [0, 0, 0, 0, 0] },
    none: { text: "", add: [0, 0, 0, 0, 0] },
  };
  const DAY_MASTER = [
    "곧게 자라는 큰 나무 · 곧은 마음과 추진력",
    "바람에도 꺾이지 않는 풀꽃 · 유연함과 끈기",
    "세상을 비추는 태양 · 밝음과 열정",
    "어둠을 밝히는 촛불 · 따뜻함과 섬세함",
    "듬직한 큰 산 · 믿음직함과 포용력",
    "곡식을 키우는 너른 밭 · 다정함과 실속",
    "단단한 바위와 쇠 · 결단력과 의리",
    "반짝이는 보석 · 섬세함과 자존심",
    "넓은 바다와 큰 강 · 지혜와 큰 그릇",
    "땅을 적시는 이슬비 · 총명함과 감수성",
  ];
  const LUCK = [
    { color: "초록", hex: "#3cb371", num: "3 · 8", dir: "동쪽" },
    { color: "빨강", hex: "#ff5a4f", num: "2 · 7", dir: "남쪽" },
    { color: "노랑", hex: "#f5b82e", num: "5 · 10", dir: "가운데 (집 · 회사 근처)" },
    { color: "흰색", hex: "#ffffff", num: "4 · 9", dir: "서쪽" },
    { color: "남색", hex: "#2c3e8f", num: "1 · 6", dir: "북쪽" },
  ];
  /** 오늘 들어온 기운을 부드럽게 풀어 주는 오행 (관성 → 인성, 재성 → 비겁, 식상 → 재성, 비겁 → 식상, 인성 → 관성) */
  const LUCK_SHIFT = { 비견: 1, 겁재: 1, 식신: 2, 상관: 2, 편재: 0, 정재: 0, 편관: 4, 정관: 4, 편인: 3, 정인: 3 };

  function readToday(profile) {
    const p = S.pillars(profile);
    const today = S.todayPillar(todayKey);
    const dm = p.day.s;
    const god = S.tenGod(dm, today.s);
    const rel = S.branchRelation(p.day.b, today.b);
    const r = READ[god];
    const pick = mulberry32(seedFromString(`${todayKey}_${personKey()}_saju`));
    const v = pick() < 0.5 ? 0 : 1;
    const stars = r.stars.map((n, i) => Math.max(1, Math.min(5, n + RELATION[rel].add[i])));
    const luck = LUCK[(S.STEM_EL[dm] + LUCK_SHIFT[god]) % 5];
    return { p, today, dm, god, rel, title: r.title[v], total: r.total[v], area: r.area, tip: r.tip, stars, luck };
  }

  const starText = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function pillarChip(label, pl) {
    if (!pl) return `<div class="pillar empty"><span class="pl-label">${label}</span><b>?</b><span class="pl-ko">모름</span></div>`;
    const el = S.STEM_EL[pl.s];
    return `<div class="pillar el${el}"><span class="pl-label">${label}</span><b>${S.STEMS_H[pl.s]}${S.BRANCHES_H[pl.b]}</b><span class="pl-ko">${S.name(pl)}</span></div>`;
  }

  /* ---------- 상태 · 저장 (생년월일은 이 기기에만) ---------- */
  const todayKey = new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
  const PROFILE_KEY = "tg_fortune_profile";
  const DEVICE_KEY = "tg_fortune_device";

  function readStore(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (_) {
      return null;
    }
  }
  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* 저장 불가 환경: 이번 화면에서만 */
    }
  }

  let profile = readStore(PROFILE_KEY);
  if (!profile || !(profile.y >= 1900 && profile.m >= 1 && profile.m <= 12 && profile.d >= 1 && profile.d <= 31)) profile = null;
  let device = readStore(DEVICE_KEY);
  if (!device) {
    device = Math.random().toString(36).slice(2, 10);
    writeStore(DEVICE_KEY, device);
  }
  /** 사람마다 다른 결과를 내는 열쇠: 생년월일(+시진), 없으면 기기마다 다른 값 */
  function personKey() {
    return profile ? `${profile.y}-${profile.m}-${profile.d}-${profile.h == null ? "x" : profile.h}` : `dev-${device}`;
  }

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

  const drawnKey = (cat) => `tg_fortune_${cat}_${todayKey}_${seedFromString(personKey())}`;

  function nextResetTime() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const hour = Number((parts.find((p) => p.type === "hour") || {}).value);
    const minute = Number((parts.find((p) => p.type === "minute") || {}).value);
    const remain = (23 - hour) * 60 + (60 - minute);
    return `${Math.floor(remain / 60)}시간 ${remain % 60}분`;
  }

  let currentCat = "fortune";
  const $ = (id) => document.getElementById(id);
  const els = {
    title: $("page-title"),
    lead: $("lead"),
    birth: $("birth"),
    draw: $("draw"),
    result: $("result"),
    egg: $("egg"),
    hint: $("hint"),
    emoji: $("r-emoji"),
    rTitle: $("r-title"),
    rDesc: $("r-desc"),
    saju: $("r-saju"),
    timer: $("timer"),
    share: $("share-btn"),
    next: $("next-btn"),
    edit: $("edit-birth"),
    tabs: [...document.querySelectorAll(".tab")],
  };

  /* ---------- 생년월일 입력 ---------- */
  function fillSelect(sel, from, to, unit, selected) {
    sel.innerHTML = "";
    for (let v = from; v <= to; v += 1) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = `${v}${unit}`;
      if (v === selected) o.selected = true;
      sel.appendChild(o);
    }
  }
  function fillDays() {
    const y = Number($("b-year").value);
    const m = Number($("b-month").value);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cur = Number($("b-day").value) || (profile ? profile.d : 1);
    fillSelect($("b-day"), 1, last, "일", Math.min(cur, last));
  }
  function setupForm() {
    const thisYear = Number(todayKey.slice(0, 4));
    fillSelect($("b-year"), 1930, thisYear, "년", profile ? profile.y : 1990);
    fillSelect($("b-month"), 1, 12, "월", profile ? profile.m : 1);
    fillDays();
    const hour = $("b-hour");
    hour.innerHTML = `<option value="">태어난 시각 모름</option>${S.BRANCHES.map((b, i) => `<option value="${i}">${b}시 (${S.HOURS[i]})</option>`).join("")}`;
    hour.value = profile && profile.h != null ? String(profile.h) : "";
    $("b-year").addEventListener("change", fillDays);
    $("b-month").addEventListener("change", fillDays);
    els.birth.addEventListener("submit", (e) => {
      e.preventDefault();
      const h = $("b-hour").value;
      profile = { y: Number($("b-year").value), m: Number($("b-month").value), d: Number($("b-day").value), h: h === "" ? null : Number(h) };
      writeStore(PROFILE_KEY, profile);
      switchTab("fortune");
    });
  }

  /* ---------- 화면 ---------- */
  function renderResult(catKey) {
    const cat = CATS[catKey];
    els.birth.hidden = true;
    els.draw.classList.add("hide");
    els.result.classList.add("show");
    els.result.classList.toggle("detail", catKey === "fortune");
    els.edit.hidden = catKey !== "fortune";
    els.timer.textContent = `이 항목은 ${nextResetTime()} 후에 다시 열려요`;
    if (catKey === "fortune") {
      const f = readToday(profile);
      els.emoji.textContent = f.stars[0] >= 5 ? "🌟" : f.stars[0] >= 4 ? "😊" : f.stars[0] >= 3 ? "🙂" : "💪";
      els.rTitle.textContent = f.title;
      els.rDesc.textContent = [f.total, RELATION[f.rel].text].filter(Boolean).join(" ");
      const [y, m, d] = todayKey.split("-").map(Number);
      els.saju.hidden = false;
      els.saju.innerHTML = `
        <p class="today-line">${y}년 ${m}월 ${d}일 · <b>${S.name(f.today)}(${S.hanja(f.today)})일</b> · 나에게는 <b>${f.god}</b>의 날</p>
        <div class="pillars">${pillarChip("시주", f.p.hour)}${pillarChip("일주", f.p.day)}${pillarChip("월주", f.p.month)}${pillarChip("연주", f.p.year)}</div>
        <p class="dm-line">내 일간 <b>${S.STEMS[f.dm]}${S.EL[S.STEM_EL[f.dm]]}(${S.STEMS_H[f.dm]}${S.EL_H[S.STEM_EL[f.dm]]})</b> — ${DAY_MASTER[f.dm]} · ${S.ANIMALS[f.p.year.b]}띠</p>
        <ul class="areas">
          <li><span>총운</span><i>${starText(f.stars[0])}</i></li>
          ${f.area.map((t, i) => `<li><span>${AREAS[i + 1]}</span><i>${starText(f.stars[i + 1])}</i><p>${esc(t)}</p></li>`).join("")}
        </ul>
        <div class="lucky">
          <div><span>행운의 색</span><b><i class="swatch" style="background:${f.luck.hex}"></i>${f.luck.color}</b></div>
          <div><span>행운의 숫자</span><b>${f.luck.num}</b></div>
          <div><span>행운의 방향</span><b>${f.luck.dir}</b></div>
        </div>
        <p class="tip">💡 ${esc(f.tip)}</p>
        <p class="privacy">생년월일은 이 기기에만 저장되고 어디에도 보내지 않아요</p>`;
      return;
    }
    els.saju.hidden = true;
    els.saju.innerHTML = "";
    const rand = mulberry32(seedFromString(`${todayKey}_${catKey}_${personKey()}`));
    const item = cat.pool[Math.floor(rand() * cat.pool.length)];
    els.emoji.textContent = cat.emoji;
    els.rTitle.textContent = item.t;
    els.rDesc.textContent = item.d;
  }

  function renderDraw(catKey) {
    els.birth.hidden = true;
    els.result.classList.remove("show");
    els.draw.classList.remove("hide");
    els.timer.textContent = "";
    els.hint.textContent = CATS[catKey].hint;
  }

  function renderBirth() {
    els.result.classList.remove("show");
    els.draw.classList.add("hide");
    els.birth.hidden = false;
    els.timer.textContent = "";
  }

  function switchTab(catKey) {
    currentCat = catKey;
    els.tabs.forEach((t) => t.classList.toggle("active", t.dataset.cat === catKey));
    els.title.textContent = CATS[catKey].title;
    els.lead.textContent = catKey === "fortune" ? "생년월일로 만세력을 짚어 보는 나만의 오늘 운세" : "알을 톡 누르면 삐약이가 알려줘요";
    if (catKey === "fortune" && !profile) renderBirth();
    else if (localStorage.getItem(drawnKey(catKey))) renderResult(catKey);
    else renderDraw(catKey);
  }

  els.egg.addEventListener("click", () => {
    if (els.egg.classList.contains("shaking")) return;
    els.egg.classList.add("shaking");
    window.setTimeout(() => {
      els.egg.classList.remove("shaking");
      try {
        localStorage.setItem(drawnKey(currentCat), "1");
      } catch (_) {
        /* 저장 불가 */
      }
      renderResult(currentCat);
    }, 500);
  });

  els.tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.cat)));
  els.next.addEventListener("click", () => {
    const keys = Object.keys(CATS);
    switchTab(keys[(keys.indexOf(currentCat) + 1) % keys.length]);
  });
  els.edit.addEventListener("click", () => {
    setupForm();
    renderBirth();
  });

  // 공유: 생년월일 · 사주는 넣지 않음 (결과 문구만)
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
      buttonTitle: "내 운세 보기",
    });
    const prev = els.share.textContent;
    els.share.textContent = result.ok ? "공유 창 열림" : "공유 실패";
    window.setTimeout(() => {
      els.share.textContent = prev;
    }, 1600);
  });

  setupForm();
  switchTab("fortune");
})();
