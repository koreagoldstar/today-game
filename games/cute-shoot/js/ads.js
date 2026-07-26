/**
 * 귀염뽀짝 쏘세요 — 광고 간판은 공통 설정(/js/ad-boards.js)을 사용합니다.
 * 문구·이미지 변경: /js/ad-boards.js 의 TODAY_AD_BOARDS.items 만 수정하세요.
 */
(() => {
  "use strict";
  function sync() {
    const items =
      window.TodayAdBoards && TodayAdBoards.getItems
        ? TodayAdBoards.getItems()
        : (window.TODAY_AD_BOARDS && window.TODAY_AD_BOARDS.items) || [];
    window.CUTE_SHOOT_ADS = items.slice();
  }
  sync();
  window.TodayAdBoards && TodayAdBoards.preloadImages && TodayAdBoards.preloadImages();
})();
