# PHASE 11 보고 — 통합 시험 · 문서 · 병합 준비

날짜: 2026-11-10 · 브랜치 `feature/marketing` · 시험 91/91 통과 · **PR 생성, 병합은 관리자가 직접**

## 한 것

- **통합 시험 (`tests/e2e.test.js`)**
  - 수요일 편성표 → 실제 퀴즈 캐러셀 렌더 → 텔레그램 앨범 승인 요청 → 웹 승인 → 19:00 전엔 게시 안 함 → Mock 게시 + 첫 댓글.
  - 목요일: 어제 게시물로 스토리 재활용 → 텔레그램 · 웹 **동시 승인은 한 번만** → 08:30 게시.
  - 그 뒤: 웹 현황 → 지표(모의라 없음) → 주간 요약 → 저장소 키 앞머리 검사.
- **통합 시험이 찾은 문제 2가지를 고쳤습니다:**
  - `planSlot` 이 작업 시계(`ctx.now`) 대신 컴퓨터 시계를 써서, 시험 · 재실행 때 다른 요일 편성을 고를 수 있었음.
  - 게시 기록 시각(`publishedAt` · 상태 기록)이 작업 시계가 아니라 컴퓨터 시계였음. 스토리 재활용은 이제 실제 게시 시각(`publishedAt`)으로 "48시간 안"을 판단합니다.
- **빠져 있던 것: 오래된 Blob 정리 (`core/cleanup.js`)**
  - 계획에만 있고 구현되지 않았던 것을 이번에 찾아 만들었습니다.
  - 하루 한 번 지웁니다: 끝난 콘텐츠의 파일(30일 뒤), 쓴 녹화본(3일 뒤), 오래된 녹화본(25일 뒤).
  - Blob Hobby 1GB 를 넘으면 30일 동안 Blob 을 못 써서 게시가 멈추기 때문입니다.
  - 콘텐츠 기록은 남기고, 웹 관리자에 "파일은 30일 뒤 지웠습니다"로 표시합니다.
- **시험용 push 트리거 제거:** 두 워크플로에서 `feature/marketing` push · `[mkt-run]` 조건을 지웠습니다. 이제 예약(master) · 수동 실행만 남습니다.
- **문서 (`marketing/docs/`)** — 지시서 §15 전부:

| 지시서 항목 | 파일 |
|---|---|
| 설치 · 배포 설명서 | `INSTALL_DEPLOY.md` |
| 관리자 사용 설명서 (텔레그램 + 웹) | `ADMIN_GUIDE.md` |
| 채널별 계정 연결 (Meta / Threads / Facebook / YouTube / 텔레그램) | `CHANNEL_SETUP.md` |
| 새 콘텐츠 유형 · 채널 추가 (플러그인) | `PLUGINS.md` |
| 테스트 결과 (Mock 과 live 분리) | `TEST_REPORT.md` |
| 월간 운영비 | `COST_ESTIMATE.md` (PHASE 11 실제 사용량 추가 — 지금 월 $0) |
| PHASE 별 보고서 | `REPORT_PHASE_1.md` ~ `REPORT_PHASE_11.md` |
| 구조 · API 조사 | `ARCHITECTURE.md` · `API_RESEARCH.md` |

## 실제 실행해서 확인한 것

- **최종 코드로 실제 GitHub Actions** (push 트리거를 지우기 직전 커밋 4편, run 42711009638 · 42711009445 — 둘 다 성공):
  - 제작: 오늘 스토리 · 피드가 이미 있어 정상적으로 건너뜀.
  - 게시: 텔레그램 처리 · 지표 단계 · 관리자 화면 자료 저장까지.
- 기존 파일 변경이 없음을 확인했습니다: `git diff origin/master...HEAD` 결과 새 파일만 (기존 파일 0줄 변경).
- 기존 시험 `scripts/test-monitor.js` 11/13. 실패 2개는 master 에서도 같은 파일이라 **이 브랜치와 상관없는 기존 상태**입니다 (`TEST_REPORT.md` §4).
- 시험 91/91.

## 확인하지 못한 것

- 실제 채널 게시(live) 전부: Meta 등 계정 연결 대기 (`TEST_REPORT.md` §3).
- Vercel 운영 배포 뒤 `/mkt-admin/` · `/api/mkt-go`: 배포는 관리자.
- master 병합 뒤 예약 실행이 실제로 도는지: 병합 뒤 첫 08:07 · 매시 13/43분 실행을 Actions 화면에서 확인하세요.

## 관리자 조치 필요 (병합 전후)

1. PR 검토 → **직접 병합** (병합해도 사이트는 바뀌지 않음 — Vercel 은 GitHub 에 연결돼 있지 않음).
2. 병합 뒤 Actions 화면에서 `mkt-produce` · `mkt-publish` 예약이 켜졌는지 확인.
3. 웹 관리자 · 클릭 세기를 쓰려면:
   - `.vercelignore` 수정 승인 (`REPORT_PHASE_9.md`)
   - Vercel 환경 변수 `MKT_ADMIN_KEY` 추가
   - 배포
   - 웹 편성표에서 클릭 세기 켜기
4. 인스타그램 연결 (`CHANNEL_SETUP.md` §2) → Variables `CHANNEL_MODE_INSTAGRAM=live`.
5. (선택) Threads · Facebook · YouTube 중 쓸 채널 연결, `LLM_API_KEY` (AI 문구).
6. 이 PC 녹화 재고 자동화: PowerShell 에서 `marketing/pc/install-task.ps1` 직접 실행.

## 바꾼 기존 파일

없음.
