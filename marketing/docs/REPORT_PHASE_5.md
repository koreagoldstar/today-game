# PHASE 5 보고 — 텔레그램 승인 + Instagram Mock 게시 + 자동 실행

날짜 2026-11-09 · 브랜치 `feature/marketing` · **기존 파일 수정 0개** (새 파일: `marketing/**`, `.github/workflows/mkt-*.yml`)

**상태: 완료 조건 모두 확인** — 시험(가짜 서버) + **실제 GitHub Actions · 실제 텔레그램 · 실제 Upstash · Blob 으로 제작 → 승인 → 예약 → 인스타 Mock 게시까지 한 번 끝까지 돌림** (2026-11-09 21:37~22:31 KST, 아래 실행 기록). 인스타그램 실제 게시는 PHASE 6.
남은 것: GitHub 예약(cron)은 master 에 있어야 돌므로 **매일 자동 실행은 master 병합 뒤**부터 (지금까지는 `[mkt-run]` push 로 실행). PC 를 실제로 끈 상태로 시험하지는 않음 — 제작 · 게시는 GitHub 서버에서만 돌았고 PC 는 녹화본 재고만 미리 올림.

## 만든 것

| 파일 | 하는 일 |
|---|---|
| `core/planner.js` | 게임 고르기: 14일 안 홍보 안 한 게임 +100 → 신작 +50 → 오래 안 한 게임(최대 +30) · **직전과 같은 게임 금지** · Actions 에서는 3D 게임은 PC 재고가 있을 때만. 하루 피드 1개 · 승인 대기 3개 이상이면 안 만듦 |
| `approval/telegram.js` | 텔레그램 승인 (**폴링, 결정 3** — 사이트에 함수 배포 없음). 승인 요청 = 영상 + 채널별 문구 + 예정 시각 + 검수 + UTM 링크 + 버튼(승인 · 반려 · 문구 다시 만들기 · 다시 제작 · 게시 취소 · 채널 4개). 반려 사유와 문구 수정은 **답장**으로. 허용한 chat_id 외 무시, 같은 버튼 한 번만(`tg:done`), 옛 버전 버튼 거부, 처리한 위치(offset) 저장. 알림: 제작 실패(사유만) · 게시 완료 · 게시 실패 · 기한 지남 |
| `run.js` | `produce`(매일) · `publish`(30분마다: 텔레그램 답 → 만료/멈춤 정리 → 게시) · `redo` · `status`. 로그에 문구 · 미디어 주소 · 토큰을 찍지 않음 (공개 저장소) |
| `.github/workflows/mkt-produce.yml` · `mkt-publish.yml` | 08:07 KST 매일 · 30분마다(:13 · :43). `concurrency` 로 동시 실행 금지, `workflow_dispatch` 수동 실행, 시험용 `push`(feature/marketing + 커밋 메시지 `[mkt-run]`, **master 병합 전에 지움**). 수동 입력값은 환경 변수로만 넘김(명령 주입 방지). redo 가 있을 때만 FFmpeg 설치 |
| `media/blob.js` | Vercel Blob 공개 주소 (`@vercel/blob` **2.4.0** — 최신 2.8.2 는 하위 패키지 zod 에 보안 경고 '높음') |
| `pc/record-stock.js` · `pc/install-task.ps1` | 이 PC(GPU)에서 3D 녹화 → 압축 → Blob → 재고 등록 (게임마다 2개 유지) · Windows 작업 스케줄러 등록 스크립트 (**아직 실행 안 함**) |
| `renderers/reel` | Actions 에서 3D 게임은 재고 클립을 꺼내 내려받아 편집 · 같은 게임 최근 구간과 겹치면 감점(결정적 봇이라 장면이 같아지는 문제) |
| 그 밖 | 문구는 모든 채널 것을 미리 만듦(채널을 바꿔도 바로 재승인) · 게시 완료 알림 · 설정 `maxPending` · `repeatDays` · `core/env.js`(이 PC 의 `.env.local`) |

## 실제 실행해서 확인한 것 (Mock)

`npm test` **52개 모두 통과** — 그중 PHASE 5 완료 조건:

| 완료 조건 | 시험 (가짜 텔레그램 서버 + 메모리 Redis + Mock 인스타) | 결과 |
|---|---|---|
| 승인 | 승인 버튼 → SCHEDULED, 예약 시각 전 게시 0 → 지나면 Mock 게시 + 다시 조회 + "게시 완료 (모의)" 알림 | 통과 |
| 반려 | 반려 버튼 → 답장 창 → 사유 답장 → REJECTED, 48시간 뒤에도 게시 0 | 통과 |
| 문구 수정 후 재승인 | 승인된 것에 답장으로 새 문구 → 버전 2 · 승인 무효 · 새 승인 요청 → **옛 버튼 거부** → 새 버튼으로 승인 | 통과 |
| 승인 없으면 게시 안 됨 | 승인 안 한 콘텐츠: 시간이 지나도 게시 0 | 통과 |
| 중복 게시 방지 | 같은 버튼 두 번 → 한 번만 · offset 으로 같은 업데이트 재처리 없음 · (PHASE 2) 게시 동시 실행 → 1번 | 통과 |
| 72시간 만료 | 73시간 뒤 EXPIRED + 알림, 게시 0 | 통과 |
| 그 밖 | 허용 안 된 대화방 무시 · 게시 취소 · 문구 다시 만들기 → 이어서 만들어 새 승인 요청 · 채널 고르기 · 제작 실패 알림 · 토큰이 오류 문구에 안 나옴 · 버튼 데이터 64바이트 이하 | 통과 |

- 게임 고르기 시험 4개 통과 (재고 규칙 · 14일 · 직전 게임 · 하루 1개 · 승인 대기 상한).
- `node marketing/run.js status` (열쇠 없음) → "저장소 주소 · 열쇠가 없습니다" 로 멈춤 (엉뚱한 곳에 쓰지 않음).
- 워크플로 YAML 2개 문법 확인 (Python yaml).
- `node marketing/pc/record-stock.js --dry` → 3D 3개 GPU 녹화 + 압축: 62.4→20.6MB · 45.0→18.8MB · 35.9→13.4MB (올리지는 않음).
- 텔레그램 공식 문서로 한도 확인 (API_RESEARCH §5).

## 확인하지 못한 것 (열쇠 · 승인 대기)

- **GitHub Actions 에서 실제 실행 (PC 꺼진 상태 확인)** — 아래 1~3 이 있어야 함.
- 실제 텔레그램 봇으로 버튼 · 답장.
- 실제 Upstash 에 `todaygame:mkt:*` 쓰기, 실제 Blob 업로드, 재고 꺼내기.
- 폴링이라 버튼을 누르고 반영까지 **최대 30분 + GitHub 예약 지연**. 오래된 버튼은 텔레그램이 "답 없음" 으로 표시할 수 있음 (처리는 됨 — 결과 메시지를 따로 보냄).
- 연속 제작 실패 3회 알림 (지시서 §11) — 아직 없음 (실패마다 알림은 감).

## 실제 연결 실행 기록 (2026-11-09)

- 21:24 KST 첫 Actions 제작: 인형뽑기 GitHub 러너 녹화 초당 10.6장 → 실패 처리 (가짜 성공 없음) → 2D 도 PC 녹화 재고로
- 21:30 KST Actions 제작: 게임 5개 모두 "제외" → 원인: 게임 지문이 윈도(CRLF) · 리눅스(LF) 줄바꿈에 따라 달라짐 → LF 기준으로 고침
- 21:37 KST Actions 제작 성공: 인형뽑기 (PC GPU 녹화본 59.5장/초) → 편집 · 검수 25항목 통과 · Blob 업로드 · 텔레그램 승인 요청 (77초)
- 21:52 KST 관리자가 텔레그램에서 승인 → 게시 작업 실행
- 21:53 KST Actions 게시 작업: 텔레그램 버튼 3번 입력 → 승인 1번만 기록 (`telegram:breakbug`, 나머지는 "승인 대기 상태 아님"으로 거부) → 22:30 예약
  (시험 동안만 피드 게시 시각을 22:30 으로 바꿨다가 끝난 뒤 19:00 으로 되돌림)
- 22:31 KST Actions 게시 작업: `published: ["2026-11-09-feed-6a5fa8"]` — 인스타 Mock 컨테이너 → 게시 → 다시 조회, 상태 PUBLISHED, 텔레그램 "게시 완료 (모의)" 알림
- 전체 기록: PLANNED → COLLECTING → RENDERING → COPYWRITING → QC → READY_FOR_APPROVAL(21:37) → APPROVED · SCHEDULED(21:53) → PUBLISHING · PUBLISHED(22:31)

연결하면서 생긴 일
- Vercel CLI 로 Blob 저장소를 만들 때 원래 폴더 `D:\프로젝트\오늘의게임\.env.local` 에 사이트 Redis 열쇠(`KV_*` · `REDIS_URL`)가 자동으로 들어감 → 바로 지워 원래대로(`VERCEL_OIDC_TOKEN` 만) 되돌림
- 이 PC 작업 스케줄러 등록은 자동 모드 권한 규칙(지속 설정)에 막힘 → 관리자가 `pc/install-task.ps1` 직접 실행 필요
- 봇 토큰을 대화창에 붙여 받음 → 대화 기록에 남음. 원하면 @BotFather `/revoke` 후 GitHub Secret `TG_BOT_TOKEN` 만 바꾸면 됨
- Actions 로그에 의존 패키지의 `url.parse()` 경고(DEP0169)가 나옴 — 동작에는 영향 없음

## 관리자 조치 필요 (2026-11-09 갱신)

- 1~4 는 끝남 (봇 @todaygamebot · Secrets 5개 · 브랜치 push · Blob 저장소 · 재고 8개). 남은 것: 작업 스케줄러 등록(직접), (선택) `LLM_API_KEY`, (PHASE 6) Meta 앱 · 인스타 프로페셔널 계정.

아래는 처음 요청한 내용 (기록):

1. **텔레그램 봇 만들기**: 텔레그램에서 @BotFather → `/newbot` → 받은 토큰. 그리고 그 봇에게 아무 말이나 한 번 보내 주세요 (그래야 대화방 id 를 알 수 있음).
2. **GitHub Secrets 넣기** (`koreagoldstar/today-game` → Settings → Secrets and variables → Actions): `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN` (사이트와 같은 Redis — 마케팅은 `todaygame:mkt:*` 키만 씀), `TG_BOT_TOKEN`, `TG_ADMIN_CHAT_ID`. 원하시면 제가 Vercel 환경 변수에서 값을 화면에 띄우지 않고 GitHub Secret 으로 옮길 수 있음.
3. **`feature/marketing` 을 GitHub 에 push** 해도 되는지 (공개 저장소 — 코드가 공개됨. 비밀값은 없음). push 후 `[mkt-run]` 커밋으로 Actions 시험.
4. (3D 재고) Vercel Blob 저장소 만들기 + `BLOB_READ_WRITE_TOKEN` (GitHub Secret + 이 PC `marketing/.env.local`), 이 PC 작업 스케줄러 등록 (`pc/install-task.ps1`).
5. (선택) `LLM_API_KEY`.
