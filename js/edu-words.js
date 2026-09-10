/**
 * 교육 게임 공통 단어 · 자음 · 음절 세트
 */
(() => {
  "use strict";

  const ASSET = "/assets/edu/";

  const JAMOS = [
    { id: "ㄱ", name: "기역" },
    { id: "ㄴ", name: "니은" },
    { id: "ㄷ", name: "디귿" },
    { id: "ㄹ", name: "리을" },
    { id: "ㅁ", name: "미음" },
    { id: "ㅂ", name: "비읍" },
    { id: "ㅅ", name: "시옷" },
    { id: "ㅇ", name: "이응" },
    { id: "ㅈ", name: "지읒" },
    { id: "ㅊ", name: "치읓" },
    { id: "ㅋ", name: "키읔" },
    { id: "ㅌ", name: "티읕" },
    { id: "ㅍ", name: "피읖" },
    { id: "ㅎ", name: "히읗" },
  ];

  const JUNGS = [
    { id: "ㅏ", name: "아" },
    { id: "ㅑ", name: "야" },
    { id: "ㅓ", name: "어" },
    { id: "ㅕ", name: "여" },
    { id: "ㅗ", name: "오" },
    { id: "ㅛ", name: "요" },
    { id: "ㅜ", name: "우" },
    { id: "ㅠ", name: "유" },
    { id: "ㅡ", name: "으" },
    { id: "ㅣ", name: "이" },
  ];

  const PAIRS = [
    { word: "사과", file: "edu_apple.svg" },
    { word: "바나나", file: "edu_banana.svg" },
    { word: "우산", file: "edu_umbrella.svg" },
    { word: "자동차", file: "edu_car.svg" },
    { word: "모자", file: "edu_hat.svg" },
    { word: "나무", file: "edu_tree.svg" },
    { word: "신발", file: "edu_shoes.svg" },
    { word: "가방", file: "edu_backpack.svg" },
    { word: "연필", file: "edu_pencil.svg" },
    { word: "시계", file: "edu_clock.svg" },
    { word: "문", file: "edu_door.svg" },
    { word: "집", file: "edu_house.svg" },
  ];

  const SYLLABLES = [
    { cho: "ㄱ", jung: "ㅏ", text: "가", file: "edu_backpack.svg", word: "가방" },
    { cho: "ㄴ", jung: "ㅏ", text: "나", file: "edu_butterfly.svg", word: "나비" },
    { cho: "ㄷ", jung: "ㅏ", text: "다", file: "edu_squirrel.svg", word: "다람쥐" },
    { cho: "ㄹ", jung: "ㅏ", text: "라", file: "edu_ramen.svg", word: "라면" },
    { cho: "ㅁ", jung: "ㅏ", text: "마", file: "edu_hat.svg", word: "모자" },
    { cho: "ㅂ", jung: "ㅏ", text: "바", file: "edu_banana.svg", word: "바나나" },
    { cho: "ㅅ", jung: "ㅏ", text: "사", file: "edu_apple.svg", word: "사과" },
    { cho: "ㅇ", jung: "ㅏ", text: "아", file: "edu_icecream.svg", word: "아이스크림" },
    { cho: "ㅈ", jung: "ㅏ", text: "자", file: "edu_car.svg", word: "자동차" },
    { cho: "ㅊ", jung: "ㅏ", text: "차", file: "edu_sparrow.svg", word: "참새" },
    { cho: "ㅋ", jung: "ㅏ", text: "카", file: "edu_cup.svg", word: "컵" },
    { cho: "ㅌ", jung: "ㅏ", text: "타", file: "edu_sun.svg", word: "태양" },
    { cho: "ㅍ", jung: "ㅏ", text: "파", file: "edu_panda.svg", word: "판다" },
    { cho: "ㅎ", jung: "ㅏ", text: "하", file: "edu_hippo.svg", word: "하마" },
    { cho: "ㄱ", jung: "ㅗ", text: "고", file: "edu_cat.svg", word: "고양이" },
    { cho: "ㄴ", jung: "ㅗ", text: "노", file: "edu_snowman.svg", word: "눈사람" },
    { cho: "ㅁ", jung: "ㅗ", text: "모", file: "edu_hat.svg", word: "모자" },
    { cho: "ㅇ", jung: "ㅗ", text: "오", file: "edu_duck.svg", word: "오리" },
    { cho: "ㄱ", jung: "ㅣ", text: "기", file: "edu_giraffe.svg", word: "기린" },
    { cho: "ㅅ", jung: "ㅣ", text: "시", file: "edu_clock.svg", word: "시계" },
    { cho: "ㅈ", jung: "ㅣ", text: "지", file: "edu_worm.svg", word: "지렁이" },
    { cho: "ㅊ", jung: "ㅣ", text: "치", file: "edu_cheetah.svg", word: "치타" },
    { cho: "ㅎ", jung: "ㅣ", text: "히", file: "edu_hippo.svg", word: "하마" },
  ];

  const BATCHIM = [
    { cho: "ㅅ", jung: "ㅣ", jong: "ㄴ", text: "신", file: "edu_shoes.svg", word: "신발" },
    { cho: "ㅁ", jung: "ㅜ", jong: "ㄴ", text: "문", file: "edu_door.svg", word: "문" },
    { cho: "ㅈ", jung: "ㅣ", jong: "ㅂ", text: "집", file: "edu_house.svg", word: "집" },
    { cho: "ㄱ", jung: "ㅏ", jong: "ㅇ", text: "강", file: "edu_puppy.svg", word: "강아지" },
    { cho: "ㅇ", jung: "ㅕ", jong: "ㄴ", text: "연", file: "edu_pencil.svg", word: "연필" },
  ];

  const WORDS3 = [
    { word: "바나나", syllables: ["바", "나", "나"], blank: 1, file: "edu_banana.svg", wrong: ["가", "다"] },
    { word: "자동차", syllables: ["자", "동", "차"], blank: 1, file: "edu_car.svg", wrong: ["고", "바"] },
    { word: "코끼리", syllables: ["코", "끼", "리"], blank: 0, file: "edu_elephant.svg", wrong: ["호", "다"] },
    { word: "강아지", syllables: ["강", "아", "지"], blank: 2, file: "edu_puppy.svg", wrong: ["기", "사"] },
    { word: "다람쥐", syllables: ["다", "람", "쥐"], blank: 1, file: "edu_squirrel.svg", wrong: ["나", "고"] },
    { word: "초콜릿", syllables: ["초", "콜", "릿"], blank: 0, file: "edu_chocolate.svg", wrong: ["사", "바"] },
    { word: "고양이", syllables: ["고", "양", "이"], blank: 1, file: "edu_cat.svg", wrong: ["나", "마"] },
    { word: "눈사람", syllables: ["눈", "사", "람"], blank: 2, file: "edu_snowman.svg", wrong: ["감", "지"] },
    { word: "너구리", syllables: ["너", "구", "리"], blank: 0, file: "edu_raccoon.svg", wrong: ["다", "호"] },
    { word: "물고기", syllables: ["물", "고", "기"], blank: 1, file: "edu_fish.svg", wrong: ["사", "바"] },
    { word: "병아리", syllables: ["병", "아", "리"], blank: 2, file: "edu_chick.svg", wrong: ["지", "나"] },
    { word: "지렁이", syllables: ["지", "렁", "이"], blank: 0, file: "edu_worm.svg", wrong: ["고", "사"] },
    { word: "호랑이", syllables: ["호", "랑", "이"], blank: 1, file: "edu_tiger.svg", wrong: ["다", "바"] },
    { word: "크레용", syllables: ["크", "레", "용"], blank: 0, file: "edu_crayon.svg", wrong: ["치", "코"] },
    { word: "거북이", syllables: ["거", "북", "이"], blank: 1, file: "edu_opp_slow.svg", wrong: ["다", "사"] },
    { word: "도토리", syllables: ["도", "토", "리"], blank: 0, file: "edu_acorn.svg", wrong: ["나", "고"] },
  ];

  const OPPOSITES = [
    { id: "크다-작다", a: { word: "크다", file: "edu_opp_big.svg" }, b: { word: "작다", file: "edu_opp_small.svg" } },
    { id: "길다-짧다", a: { word: "길다", file: "edu_opp_long.svg" }, b: { word: "짧다", file: "edu_opp_short.svg" } },
    { id: "뜨겁다-차갑다", a: { word: "뜨겁다", file: "edu_opp_hot.svg" }, b: { word: "차갑다", file: "edu_opp_cold.svg" } },
    { id: "빠르다-느리다", a: { word: "빠르다", file: "edu_opp_fast.svg" }, b: { word: "느리다", file: "edu_opp_slow.svg" } },
    { id: "많다-적다", a: { word: "많다", file: "edu_opp_many.svg" }, b: { word: "적다", file: "edu_opp_few.svg" } },
  ];

  const SENTENCES = [
    {
      sentence: "병아리가 사과를 먹어요",
      parts: [
        { text: "병아리", file: "edu_chick.svg" },
        { text: "사과", file: "edu_apple.svg" },
        { text: "먹어요", file: null },
      ],
    },
    {
      sentence: "강아지가 공을 던져요",
      parts: [
        { text: "강아지", file: "edu_puppy.svg" },
        { text: "공", file: "edu_ball.svg" },
        { text: "던져요", file: null },
      ],
    },
    {
      sentence: "고양이가 물고기를 봐요",
      parts: [
        { text: "고양이", file: "edu_cat.svg" },
        { text: "물고기", file: "edu_fish.svg" },
        { text: "봐요", file: null },
      ],
    },
    {
      sentence: "토끼가 당근을 먹어요",
      parts: [
        { text: "토끼", file: "edu_rabbit.svg" },
        { text: "당근", file: "edu_carrot.svg" },
        { text: "먹어요", file: null },
      ],
    },
    {
      sentence: "오리가 물에서 헤엄쳐요",
      parts: [
        { text: "오리", file: "edu_duck.svg" },
        { text: "물", file: "edu_water.svg" },
        { text: "헤엄쳐요", file: null },
      ],
    },
    {
      sentence: "사자가 크게 소리쳐요",
      parts: [
        { text: "사자", file: "edu_lion.svg" },
        { text: "크게", file: "edu_opp_big.svg" },
        { text: "소리쳐요", file: null },
      ],
    },
    {
      sentence: "나비가 꽃 위에 앉아요",
      parts: [
        { text: "나비", file: "edu_butterfly.svg" },
        { text: "꽃", file: "edu_sunflower.svg" },
        { text: "앉아요", file: null },
      ],
    },
    {
      sentence: "다람쥐가 도토리를 먹어요",
      parts: [
        { text: "다람쥐", file: "edu_squirrel.svg" },
        { text: "도토리", file: "edu_acorn.svg" },
        { text: "먹어요", file: null },
      ],
    },
    {
      sentence: "코끼리가 물을 뿌려요",
      parts: [
        { text: "코끼리", file: "edu_elephant.svg" },
        { text: "물", file: "edu_water.svg" },
        { text: "뿌려요", file: null },
      ],
    },
    {
      sentence: "거북이가 느리게 걸어요",
      parts: [
        { text: "거북이", file: "edu_opp_slow.svg" },
        { text: "느리게", file: null },
        { text: "걸어요", file: null },
      ],
    },
    {
      sentence: "토끼가 빠르게 뛰어요",
      parts: [
        { text: "토끼", file: "edu_rabbit.svg" },
        { text: "빠르게", file: "edu_opp_fast.svg" },
        { text: "뛰어요", file: null },
      ],
    },
    {
      sentence: "판다가 낮잠을 자요",
      parts: [
        { text: "판다", file: "edu_panda.svg" },
        { text: "낮잠을", file: null },
        { text: "자요", file: null },
      ],
    },
  ];

  const DICTATION = [
    { word: "사과", file: "edu_apple.svg" },
    { word: "바나나", file: "edu_banana.svg" },
    { word: "우산", file: "edu_umbrella.svg" },
    { word: "자동차", file: "edu_car.svg" },
    { word: "모자", file: "edu_hat.svg" },
    { word: "나무", file: "edu_tree.svg" },
    { word: "신발", file: "edu_shoes.svg" },
    { word: "가방", file: "edu_backpack.svg" },
    { word: "연필", file: "edu_pencil.svg" },
    { word: "시계", file: "edu_clock.svg" },
    { word: "문", file: "edu_door.svg" },
    { word: "집", file: "edu_house.svg" },
    { word: "강아지", file: "edu_puppy.svg" },
    { word: "코끼리", file: "edu_elephant.svg" },
  ];

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  window.TodayEduWords = {
    ASSET,
    JAMOS,
    JUNGS,
    PAIRS,
    SYLLABLES,
    BATCHIM,
    WORDS3,
    DICTATION,
    OPPOSITES,
    SENTENCES,
    shuffle,
  };
})();
