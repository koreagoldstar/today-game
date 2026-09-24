오늘의게임 - 신규 리듬게임 3종 통합 안내
=========================================

포함된 게임
-----------
1. games/rhythm-battle/index.html  → 리듬 배틀 아레나 (URL 예상: /games/rhythm-battle/)
   - 생별이 VS 라이벌 폭스, 정확도로 상대 체력을 깎는 대결형 리듬게임
   - 조작: D F J K 키 또는 화면 하단 4버튼 터치

2. games/neon-runner/index.html    → 네온 러너 (URL 예상: /games/neon-runner/)
   - 비트에 맞춰 점프/슬라이드하는 네온 도시 러닝 게임, Canvas 기반
   - 조작: 스페이스(점프)/아래방향키(슬라이드) 또는 화면 좌/우 탭

3. games/mirror-rhythm/index.html  → 미러 리듬 (URL 예상: /games/mirror-rhythm/)
   - 양손이 동시에 다른 패턴을 연주하는 고난이도 대칭 모드
   - 조작: Q W (왼손) / O P (오른손) 키 또는 화면 4버튼 터치
   - 결과 화면 "결과 카드 저장" 버튼으로 PNG 이미지 다운로드 (카톡 공유용)

적용 방법
---------
기존 사이트가 /games/penalty-kick/ 처럼 "폴더 + index.html" 구조의 정적 페이지라면,
이 games 폴더 안의 3개 폴더를 기존 프로젝트의 games 폴더 안에 그대로 복사해 넣으면 됩니다.

만약 Next.js / React 기반으로 각 게임이 컴포넌트(app/games/[slug]/page.tsx 등)로
관리되고 있다면, index.html 안의 <style>과 <script> 내용을 그대로 옮겨서
컴포넌트 하나로 감싸시면 됩니다. 이 경우 실제 게임 페이지 파일 하나를 Cursor에서
보여주시면 정확히 같은 패턴으로 다시 만들어 드릴 수 있습니다.

리듬 · 음악 카테고리에 추가 예시 (기존 카드 마크업 패턴 참고):
  [리듬 배틀 아레나 · 대결 · 체력전플레이](/games/rhythm-battle/)
  [네온 러너 · 러닝 · 랭킹플레이](/games/neon-runner/)
  [미러 리듬 · 대칭 · 고난이도플레이](/games/mirror-rhythm/)

참고 사항
---------
- 외부 의존성은 구글 폰트(Jua, Orbitron) CDN 링크 하나뿐입니다.
- 효과음/비트는 외부 음원 파일 없이 Web Audio API로 직접 생성합니다.
- 최고기록(네온 러너)은 localStorage에 저장됩니다.
- 공유 버튼은 navigator.share(모바일 공유시트) 우선, 미지원 시 클립보드 복사로 대체됩니다.
- 실제 플레이 테스트 후 타이밍 판정(HIT_WINDOW)이나 난이도 조정이 필요하면 알려주세요.
