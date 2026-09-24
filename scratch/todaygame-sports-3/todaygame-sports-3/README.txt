오늘의게임 - 스포츠·레이싱 신규 게임 3종 통합 안내
====================================================

포함된 게임
-----------
1. games/homerun-derby/index.html      → 홈런왕 (URL 예상: /games/homerun-derby/)
   - 10구 홈런더비 형식, 타이밍 미터를 보고 정확한 순간에 탭해서 스윙
   - 판정: 홈런(4루타)/3루타/2루타/안타/파울/스트라이크, TOTAL BASES로 채점
   - 캔버스 연출: 투구~스윙~타구 궤적 애니메이션, 홈런 시 파티클/사운드 효과
   - 조작: 화면 탭 또는 스페이스바

2. games/basketball-shootout/index.html → 농구 슈팅 챌린지 (URL 예상: /games/basketball-shootout/)
   - 60초 제한시간, 공을 드래그해서 당겼다 놓으면 슛(슬링샷 방식)
   - 실제 중력 물리 시뮬레이션 + 림/백보드 충돌 판정
   - SWISH(림에 안 닿고 클린샷) 시 보너스 점수, STREAK(연속 성공) 표시
   - 조작: 공을 드래그 후 릴리즈 (모바일/PC 공통)

3. games/bowling-strike/index.html      → 볼링 스트라이크 (URL 예상: /games/bowling-strike/)
   - 10프레임 정식 볼링 형식, 2단계 조작(방향 미터 → 파워 미터, 각각 탭으로 고정)
   - 스트라이크/스페어 판정 및 프레임별 기록 스트립 표시
   - 점수는 정식 볼링 규칙을 단순화한 방식입니다 (스트라이크 +10 고정 보너스,
     스페어 +5 고정 보너스 — 다음 프레임 핀 수를 이어붙이는 정식 규칙 대신
     구현 난이도를 낮춘 근사치입니다. 정식 규칙이 필요하면 말씀해주세요)
   - 조작: 화면 탭 2회 (방향 고정 → 파워 고정)

적용 방법
---------
기존 사이트가 /games/penalty-kick/ 처럼 "폴더 + index.html" 구조라면,
이 games 폴더 안의 3개 폴더를 기존 프로젝트의 games 폴더에 그대로 복사해 넣으면 됩니다.

Next.js/React 컴포넌트 구조라면 기존 스포츠 게임 파일(예: penalty-kick, minigolf 컴포넌트) 하나를
Cursor에서 보여주시면 동일한 패턴으로 다시 변환해 드릴 수 있습니다.

스포츠·레이싱 카테고리 추가 예시 (기존 카드 마크업 패턴 참고):
  [홈런왕야구 · 홈런더비플레이](/games/homerun-derby/)
  [농구 슈팅 챌린지농구 · 60초 러쉬플레이](/games/basketball-shootout/)
  [볼링 스트라이크볼링 · 10프레임플레이](/games/bowling-strike/)

참고 사항
---------
- 외부 의존성은 구글 폰트(Jua, Gowun Dodum, Orbitron) CDN 링크 하나뿐입니다.
- 효과음은 외부 음원 파일 없이 Web Audio API로 직접 생성합니다.
- 최고기록은 각각 localStorage에 저장됩니다 (tg_homerun_best, tg_basketball_best, tg_bowling_best).
- 공유 버튼은 navigator.share(모바일 공유시트) 우선, 미지원 시 클립보드 복사로 대체됩니다.
- 세 게임 모두 실제 플레이 테스트를 거치지 않았습니다. 특히 농구의 물리 감도(sensitivity)나
  볼링의 판정 반경(radius)은 실제 플레이해보시고 너무 쉽거나 어려우면 조정해드릴게요.
