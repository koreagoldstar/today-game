/** 랭킹·챌린지 공통 목록 (archive / 제외 게임은 챌린지 풀에서만 빠짐) */
(() => {
  "use strict";

  /** 챌린지에서 제외 (매일 로테이션 대상 아님) */
  const CHALLENGE_EXCLUDE = new Set([
    "pinball",
    "rps",
    "odd-even",
    "dual-pad",
    "slide-beat",
    "beat-tap",
    "minigolf",
    "wordle",
    "sokoban",
  ]);

  /** 랭킹 등록 가능 게임 (점수제) — archive 제외 전 플레이어블 */
  const RANKABLE = [
    { id: "flappy", title: "펄럭 병아리" },
    { id: "doodle", title: "폴짝 하늘" },
    { id: "tetris", title: "블록 팡팡" },
    { id: "jump-run", title: "콩콩 점프" },
    { id: "ninja-dodge", title: "닌자 표창 피하기" },
    { id: "stork-stride", title: "서빙왕" },
    { id: "snake", title: "애플 스네이크" },
    { id: "minesweeper", title: "지뢰찾기" },
    { id: "alggagi", title: "알까기" },
    { id: "whack-mole", title: "두더지 팡팡" },
    { id: "omok", title: "오목" },
    { id: "rhythm", title: "리듬 톡톡" },
    { id: "racing", title: "스피드 삐약이" },
    { id: "drift-chick", title: "드리프트 삐약이" },
    { id: "crossy", title: "삐약이 건너기" },
    { id: "cute-shoot", title: "귀염뽀짝 쏘세요" },
    { id: "brick", title: "별똥별 벽돌깨기" },
    { id: "puzzle-bubble", title: "팝샷 버블" },
    { id: "ttamogi", title: "땅땅 차지" },
    { id: "memory", title: "짝짝 사천성" },
    { id: "diff", title: "다른 그림 찾기" },
    { id: "suika", title: "수박 합치기" },
    { id: "slide-2048", title: "두배두배" },
    { id: "tower", title: "흔들흔들 스카이" },
    { id: "fruit-catch", title: "과일 바스켓" },
    { id: "bubble-pop", title: "팝팝 방울" },
    { id: "pinball", title: "핀볼팡팡" },
    { id: "rps", title: "가위바위보" },
    { id: "odd-even", title: "홀짝 팡" },
    { id: "dual-pad", title: "듀얼 패드" },
    { id: "slide-beat", title: "슬라이드 비트" },
    { id: "beat-tap", title: "펄스 탭" },
    { id: "minigolf", title: "홀인원 골프" },
    { id: "wordle", title: "오늘의 워들" },
    { id: "sokoban", title: "상자야 굴러가" },
    { id: "reaction", title: "번쩍 반응" },
  ];

  /** 챌린지 로테이션 풀 (고정 순서) */
  const CHALLENGE_POOL = RANKABLE.filter((g) => !CHALLENGE_EXCLUDE.has(g.id)).map((g) => ({
    id: g.id,
    title: g.title,
    href: `/games/${g.id}/`,
    metric: "score",
  }));

  window.TodayRankMeta = {
    CHALLENGE_EXCLUDE,
    RANKABLE,
    CHALLENGE_POOL,
    isRankable(id) {
      return RANKABLE.some((g) => g.id === id);
    },
    titleOf(id) {
      const hit = RANKABLE.find((g) => g.id === id);
      return hit ? hit.title : id;
    },
  };
})();
