# marketing/ — TODAY GAME 홍보 자동화 (새 세션은 이 파일부터)

지시서: `C:\Users\COM\Desktop\TODAYGAME_MARKETING_FULL_PROMPT.md` (저장소 밖 — 없으면 관리자에게 요청)
브랜치: `feature/marketing` (worktree `.claude/worktrees/marketing-automation`). 기본 브랜치는 `master`. master 에 직접 커밋 · 푸시 금지.

## 지금 상태

- PHASE 1 승인 (2026-11-08, 결정 1~11 모두 제안대로).
- **PHASE 2 (코어 뼈대) 진행 중.**

## 꼭 지킬 것 (지시서 요약)

1. 기존 사이트 · 게임 · 랭킹 · 챌린지 · URL · SEO · 배포를 훼손하지 않는다. 새 코드는 `marketing/`, `api/mkt-*.js`, `api/_mkt/`, `mkt-admin/`, `.github/workflows/mkt-*.yml` 에만.
2. **기존 파일을 고쳐야 하면 고치기 전에 이유를 보고하고 승인받는다.** (`docs/IMPLEMENTATION_PLAN.md` 맨 위 표)
3. 실제 게임 화면 · 실제 데이터만. 가짜 플레이 · 지어낸 순위 · 기록 · 기능 금지. 봇의 god · noLava · ram 은 녹화에 쓰지 않는다.
4. 녹화는 로컬 서버에서, `/api/**` 가짜 응답 + 서비스워커 차단. 운영 데이터는 읽기 전용 GET(또는 Redis 읽기)만.
5. 승인되지 않은 콘텐츠는 어떤 채널에도 게시하지 않는다. 문구 · 이미지 · 영상 · 채널 · 시각이 바뀌면 승인 무효.
6. 각 플랫폼 공식 API 만. API 버전 · 권한 · 한도 · 규격은 구현할 때 공식 문서로 확인하고 `docs/API_RESEARCH.md` 에 주소를 남긴다.
7. 비밀값은 GitHub Secrets / Vercel 환경변수에만. 저장소 · 프런트 · 로그 노출 금지 (공개 저장소라 Actions 로그도 공개).
8. 동작하지 않는 버튼 · 가짜 통계 · 미완성 기능을 완료처럼 보이게 하지 않는다.
9. 보고는 "실제 실행해서 확인한 것 / 확인하지 못한 것 / 관리자 조치 필요" 로.
10. PHASE 마다: 구현 → 실제 실행 · 테스트 → `docs/REPORT_PHASE_N.md` → 커밋 → **멈추고 보고**. 관리자가 "다음"이라고 하면 다음 PHASE.
11. 외부 계정 · 키, 기존 파일 수정, 비용이 드는 서비스, 구조 문제 → 즉시 멈추고 질문. 계정이 없으면 Mock 으로 끝까지 검증.

## 폴더

```
core/ sources/ renderers/ templates/ channels/ copy/ profiles/ docs/ tests/
```
자세한 구조 · 플러그인 인터페이스 · Redis 키 · 상태 머신: `docs/ARCHITECTURE.md`

## 알아 둘 함정

- 3D 게임(용암 서핑 · 하늘섬 · 드래곤 석상)은 GPU 없는 러너에서 초당 2~5장 → 그대로 녹화 불가. 관리자 제안: **PC 가 켜져 있을 때 PC(GPU)로 녹화해 재고로 쌓기** (ARCHITECTURE §11). 셀프 호스트 러너는 공개 저장소라 쓰지 않음.
- GitHub Actions 예약은 master 의 워크플로만 돈다. 공개 저장소는 60일 활동이 없으면 예약이 꺼진다.
- Vercel Hobby: `api/` 함수 배포당 12개 (지금 7개). Blob 포함분을 넘으면 30일 동안 Blob 사용 불가.
- 랭킹 닉네임에 나쁜 말 거르기가 없음. 주간 랭킹 기록이 거의 없음 (2026-W45 기준 1건).
- 원래 폴더 `D:\프로젝트\오늘의게임` 에는 다른 작업의 커밋 안 된 변경이 있다 — 그 폴더에서 git 작업 금지.

## PHASE 진행표

| PHASE | 내용 | 상태 |
|---|---|---|
| 1 | 분석 · 설계 | 승인 (2026-11-08) |
| 2 | 코어 뼈대 | 진행 중 |
| 3 | 게임 릴스 녹화 | - |
| 4 | 편집 · 문구 · QC | - |
| 5 | 텔레그램 승인 · Mock 게시 · 자동 실행 | - |
| 6 | Instagram 실제 연결 | - |
| 7 | 이미지 계열 콘텐츠 | - |
| 8 | 신작 감지 · 추가 채널 | - |
| 9 | 웹 관리자 | - |
| 10 | 성과 · 고도화 | - |
| 11 | 통합 · 문서 · 병합 준비 | - |
