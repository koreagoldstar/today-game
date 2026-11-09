# marketing/ — TODAY GAME 홍보 자동화 (새 세션은 이 파일부터)

지시서: `C:\Users\COM\Desktop\TODAYGAME_MARKETING_FULL_PROMPT.md` (저장소 밖 — 없으면 관리자에게 요청)
브랜치: `feature/marketing` (worktree `.claude/worktrees/marketing-automation`). 기본 브랜치는 `master`. master 에 직접 커밋 · 푸시 금지.

## 지금 상태

- PHASE 1 승인 (2026-11-08, 결정 1~11 모두 제안대로).
- PHASE 2 코어 뼈대 완료.
- PHASE 3 게임 녹화 완료 (5/5). 녹화: `node marketing/record.js [게임|--runner pc|actions]`.
- PHASE 4 편집 · 문구 · 검수 완료. 시험 제작: `node marketing/make.js <게임…> --latest`.
- **PHASE 5 (텔레그램 승인 · Mock 게시 · 자동 실행) 완료 보고 — 관리자 "다음" 대기.** 실제 Actions · 텔레그램 · Upstash · Blob 으로 제작 → 승인 → Mock 게시까지 확인 (2026-11-09). `docs/REPORT_PHASE_5.md`. 시험: `cd marketing && npm test` (53개). 실행: `node marketing/run.js produce|publish|redo|status`. 매일 자동 실행은 master 병합 뒤부터.
- **2026-11-09 관리자: "11단계까지 멈추지 말고 계속, 끝나면 컴퓨터 끄기"** — 단계마다 멈추지 않음. 계정이 필요한 것은 Mock + "연결 대기", master 병합 · 운영 배포는 관리자.
- PHASE 6 인스타 실제 연결: 코드 · 시험 완료(62/62), **관리자 Meta 연결 대기** (`docs/REPORT_PHASE_6.md`, `docs/CHANNEL_SETUP.md`). 연결: `IG_NEW_TOKEN=… node marketing/run.js ig-connect`.
- PHASE 7 이미지 콘텐츠(퀴즈 캐러셀 · 운세 · 랭킹 · 챌린지 · 스토리 재활용) 완료 (`docs/REPORT_PHASE_7.md`, 시험 73/73). 시험 제작: `node marketing/make.js quiz fortune challenge ranking`. 자리별 제작: `run.js produce --slot story|feed --type <유형>`.
- PHASE 8 신작 감지(C4) · Threads · Facebook 페이지 릴스 · YouTube Shorts 어댑터 완료 — 채널은 관리자 연결 대기 (`docs/REPORT_PHASE_8.md`, 시험 80/80). 신작 시험: `node marketing/make.js new-game:<id>`. 채널 상태: `run.js channels`.
- PHASE 9 웹 관리자 완료 — 운영 배포 안 함 (`docs/REPORT_PHASE_9.md`, 시험 85/85). 이 PC 시험: `node marketing/admin-dev.js` (운영 저장소는 읽기만, 키는 `out/admin-dev-key.txt`). 배포 전: Vercel `MKT_ADMIN_KEY` · `.vercelignore` 수정 승인 필요.
- PHASE 10 성과(1·3·7일 지표 · 팔로워 · 주간 요약 · 가중치) · 클릭 세기(`api/mkt-go.js`, 설정 trackClicks 기본 꺼짐) 완료 (`docs/REPORT_PHASE_10.md`, 시험 89/89). 주간 요약 직접: `run.js weekly --monday YYYY-MM-DD`.
- PHASE 11 통합 시험 · Blob 정리 · 문서 완료, 시험용 push 트리거 제거, PR 생성 (`docs/REPORT_PHASE_11.md`, 시험 91/91). **master 병합 · Vercel 배포는 관리자.**
- 설치: `cd marketing && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci` (Pretendard · Claude SDK · playwright 1.65 — 크롬은 시스템 것을 씀).

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
- 녹화: 화면 캡처는 `--force-device-scale-factor` 가 없으면 CSS 크기(404×720)로 온다. 3D 는 `--render cpu` 에서 초당 5장 미만 → 실패 처리됨(정상).
- 녹화본(`out/clips/`)은 git 제외. 3D 원본은 45~62MB — 재고로 올릴 때 압축.
- 같은 게임을 다시 녹화하면 거의 같은 장면 (봇 · 게임이 결정적) — 다시 홍보할 때 다양성 대책 필요.
- 3D 봇 상태 이름: 클리어 · 체크포인트만 "성공", 게임 오버 · respawn 은 "실패", 보스 등장 등은 자막 없음 (`players/autopilot.js`).
- 워크플로의 시험용 `push` 트리거는 PHASE 11 에서 지웠다. 브랜치에서 다시 Actions 로 시험하려면 잠깐 되살리고(지난 커밋 참고) 끝나면 지울 것.
- **녹화는 5개 게임 모두 이 PC(GPU)** — 실제 GitHub 러너는 2배 캡처가 초당 10.6장이라 기준 미달. Actions 는 재고로 편집 · 게시만. 재고 채우기: `node marketing/pc/record-stock.js` (작업 스케줄러 등록은 자동 모드에서 막혀 관리자가 `pc/install-task.ps1` 직접 실행).
- 게임 지문(`core/clips.js gameHash`)은 텍스트 파일 줄바꿈을 LF 로 맞춰 계산 — 안 그러면 윈도 PC 와 리눅스 러너 값이 달라 재고를 못 씀.
- 열쇠: GitHub Secrets 5개 (`UPSTASH_REDIS_REST_URL/TOKEN` · `TG_BOT_TOKEN` · `TG_ADMIN_CHAT_ID` · `BLOB_READ_WRITE_TOKEN`) + 이 PC `marketing/.env.local`. Blob 저장소 `todaygame-mkt-media`(iad1). **Vercel CLI 로 저장소를 만들면 원래 폴더 `.env.local` 에 사이트 Redis 열쇠를 넣으니 지울 것**.
- 텔레그램은 폴링(getUpdates) — 웹훅을 켜면 getUpdates 가 멈춘다. 웹훅으로 바꿀 때 publish 쪽 폴링을 끌 것.
- 랭킹은 **지난주** 기록 (월요일 게시). 점수 표시는 사이트 `js/rankable.js formatScore` 를 vm 으로 그대로 씀 — 단위를 직접 만들지 말 것.
- 운세 · 챌린지 스토리는 `plan.validDay` — 그날만 게시, 날이 지나면 EXPIRED. 퀴즈 정답은 이미지 · 캡션이 아니라 첫 댓글.
- 신작 감지는 첫 실행 때 기준 목록만 저장 (`seen:games`). 기준을 지우면 다음 실행이 다시 기준만 만든다 (기존 게임 전부 신작 아님).
- 설정은 **바꾼 값만** 저장 (`saveSettings`). 전체를 저장하면 기본값 변경이 운영에 안 먹는다.
- 웹 관리자 · 텔레그램은 같은 `core/approval.js` — 동시에 눌러도 잠금 + 버전으로 한 번만.
- `.vercelignore` 에 `marketing/out` 이 없으면 배포 때 녹화 파일(수 GB)이 올라간다 — 관리자 승인 받고 추가할 것.
- `trackClicks` 는 `api/mkt-go.js` 운영 배포 뒤에만 켤 것 (켜면 문구 링크가 /api/mkt-go 로 바뀜, 배포 전이면 404).
- 지표는 실제 게시만 (posts[ch].mock 이면 건너뜀) — 모의 게시에 숫자를 만들지 않는다.
- 작업 시계: 편성 · 게시 · 기록 시각은 모두 `ctx.now` (시험에서 시계를 돌림). `new Date()` 를 새로 쓰지 말 것.
- Blob 정리는 `core/cleanup.js` (하루 한 번) — 끝난 콘텐츠 30일, 쓴 녹화본 3일, 녹화 25일.
- `@vercel/blob` 은 2.4.0 고정 (2.8.2 는 zod 보안 경고).

## PHASE 진행표

| PHASE | 내용 | 상태 |
|---|---|---|
| 1 | 분석 · 설계 | 승인 (2026-11-08) |
| 2 | 코어 뼈대 | 완료 보고 (시험 25/25) |
| 3 | 게임 릴스 녹화 | 완료 보고 (5/5 녹화, 시험 29/29) |
| 4 | 편집 · 문구 · QC | 완료 보고 (실물 5개, 시험 40/40) |
| 5 | 텔레그램 승인 · Mock 게시 · 자동 실행 | 완료 보고 (실제 Actions 로 제작→승인→Mock 게시, 시험 53/53) |
| 6 | Instagram 실제 연결 | 코드 · 시험 완료, Meta 연결 대기 |
| 7 | 이미지 계열 콘텐츠 | 완료 (실물 4종 · 실제 텔레그램 사진 승인 요청, 시험 73/73) |
| 8 | 신작 감지 · 추가 채널 | 완료 (실제 Actions 로 스토리 · 릴스, 채널 3개는 연결 대기, 시험 80/80) |
| 9 | 웹 관리자 | 완료 (이 PC 에서 실데이터 복사본으로 확인, 운영 배포 전, 시험 85/85) |
| 10 | 성과 · 고도화 | 완료 (실제 텔레그램 주간 요약, 실제 지표는 채널 연결 뒤, 시험 89/89) |
| 11 | 통합 · 문서 · 병합 준비 | 완료 (최종 코드 실제 Actions 성공, PR 생성 — 병합 대기) |
