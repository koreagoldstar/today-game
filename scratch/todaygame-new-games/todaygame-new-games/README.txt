오늘의게임 - 신규 게임 2종 통합 안내
=====================================

포함된 게임
-----------
1. games/wisdom-quiz/index.html   → 오늘의 상식퀴즈 (URL 예상: /games/wisdom-quiz/)
2. games/fortune-draw/index.html  → 오늘의 운세 뽑기 (URL 예상: /games/fortune-draw/)

기존 사이트가 /games/penalty-kick/ 처럼 "폴더 + index.html" 구조의 정적 페이지라면,
이 games 폴더를 통째로 기존 프로젝트의 games 폴더 안에 복사해 넣기만 하면 됩니다.

만약 Next.js / React 기반이라 각 게임이 컴포넌트(app/games/[slug]/page.tsx 등)로
관리되고 있다면, index.html 안의 <style>과 <script> 내용을 그대로 옮겨서
컴포넌트 하나로 감싸시면 됩니다 (dangerouslySetInnerHTML 또는 raw HTML 렌더링,
혹은 <style jsx>와 useEffect로 <script> 로직 이전).
이 경우 실제 게임 목록 페이지(games/index 등) 파일 하나를 Cursor에서 보여주시면
정확히 같은 패턴으로 다시 만들어 드릴 수 있습니다.

홈 화면 카드 추가 (선택)
-------------------------
기존 카테고리 카드 마크업 패턴을 참고해서 아래처럼 추가하면 자연스럽게 어울립니다.

  퍼즐·두뇌 카테고리에 추가 예시:
  [오늘의 상식퀴즈 · 매일 5문제 · 플레이](/games/wisdom-quiz/)

  새 카테고리 또는 "오늘의 챌린지" 섹션 근처에 추가 예시:
  [오늘의 운세 뽑기 · 운세·메뉴·아이템 · 플레이](/games/fortune-draw/)

참고 사항
---------
- 두 파일 모두 외부 의존성은 구글 폰트(Jua, Gowun Dodum) CDN 링크 하나뿐입니다.
- 최고기록/오늘의 결과는 localStorage에 저장됩니다 (서버 DB 불필요).
- 공유 버튼은 navigator.share (모바일 공유시트)를 우선 사용하고,
  미지원 브라우저에서는 클립보드 복사로 대체됩니다.
- 카카오톡 공유 SDK를 쓰고 계시다면 shareBtn 클릭 이벤트 부분만 교체하면 됩니다.
