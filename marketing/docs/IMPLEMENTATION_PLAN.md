# 구현 계획 (PHASE 1)

작성 2026-11-08. 지시서 §14 의 PHASE 순서를 그대로 따르고, 조사에서 나온 사항을 반영했습니다. PHASE 마다 **구현 → 실제 실행 · 테스트 → `REPORT_PHASE_N.md` → 커밋 → 멈추고 보고**. 관리자가 "다음"이라고 하면 다음 PHASE.

## 기존 파일을 고쳐야 할 수 있는 곳 (고치기 전에 따로 승인 받음)

| 파일 | 이유 | 언제 |
|---|---|---|
| `.vercelignore` | `marketing/` 소스 · 문서 · 템플릿이 사이트에 정적 파일로 같이 올라가지 않게 `marketing` 한 줄 추가. Vercel 함수가 쓸 공용 코드는 `api/_mkt/`(밑줄이라 함수로 안 나감)에 둠 | PHASE 5 (함수를 처음 배포할 때) |
| `tools/game-reels/*` (원래 폴더에만 있고 커밋 안 됨) | 녹화기로 재사용하려면 `marketing/renderers/reel/` 로 가져오고, 녹화 실패 때 전체가 멈추는 버그를 고침 | PHASE 3 (결정 2) |
| `js/bgm.js` · `js/scores.js` · `api/plays.js` | 출처(UTM)별 "게임 열기" 집계 (방법 B) | PHASE 10 (결정 4) |
| `sw.js` | 관리자 화면 `/mkt-admin/` 이 서비스워커 캐시에 들어가지 않게 하는 것이 필요한지 PHASE 9 에서 확인 | PHASE 9 |

새로 만드는 것만: `marketing/**`, `api/mkt-*.js`, `api/_mkt/**`, `mkt-admin/**`, `.github/workflows/mkt-*.yml`, `.env.example`.

## PHASE 2 — 코어 뼈대
- `marketing/package.json` (사이트 배포와 분리), `core/state.js`(전환표 · 72시간 만료), `core/store.js`(Redis REST, `todaygame:mkt:*`, 잠금), `core/logger.js`(토큰 가림), `core/registry.js`, `channels/mock.js`, `settings` 기본값.
- 시험용 가짜 Redis (메모리 · Upstash REST 흉내) — 운영 Redis 는 테스트에서 절대 안 씀.
- 완료: 가짜 Source → 가짜 Renderer → QC → 승인 대기 → Mock 게시 테스트 통과 · 허용 안 된 전환 거부 · 같은 버전 두 번 게시 안 됨.

## PHASE 3 — 게임 릴스 녹화 (C1-녹화)
- `profiles/<game>.json` 5개: 뷰포트 · 시작 방법 · 조종 방식(봇 파일 · 옵션 god/noLava **false 고정**) · 원본 길이 40~60초.
- 녹화기: (결정 2) CDP 화면 캡처 + 게임 소리 / 또는 `recordVideo`. `/api/**` 가짜 응답, `serviceWorkers: "block"`.
- 인형뽑기 프로필을 새로 작성 (실제 키 입력: 방향키 · Space, 상태는 읽기만).
- (결정 1 ④) 3D 3개는 이 PC(GPU)에서 녹화해 Redis · Blob 재고(`clip:*`)에 올리는 `marketing/pc/record-3d.js` + Windows 작업 스케줄러 등록(승인 필요). GitHub Actions 쪽은 재고가 있을 때만 3D 를 고름.
- 완료: 5개 중 4개 이상 실제 녹화 성공 (실패는 원인 명시) · 녹화 전후 운영 Redis 키 값 비교로 통계 · 랭킹이 안 바뀜 확인 (읽기 전용 GET 비교).

## PHASE 4 — 편집 + 문구 + QC (C1 완성)
- FFmpeg: 1080×1920 · H.264/AAC · 30fps · 15~20초 · `-preset veryfast`, 0~2초 제목 · 가운데 게임(잘림 없음) · 마지막 2초 로고 + todaygame.co.kr, 장르별 레이아웃 2~3종, 커버 1장.
- 폰트: Pretendard(OFL) 파일을 `marketing/assets/fonts/` 에 넣음 (공식 배포본 받기 — 승인 필요).
- 배경음악: 관리자가 정한 허용 목록만 (후보: `assets/audio/hip/*.mp3` CC0 9곡 · `assets/audio/packs/*` 자체 제작 — CREDITS.txt 근거).
- Copywriter: Source `facts` 만 근거, 채널별 문구, 최근 20개 첫 문장과 겹치면 다시, 입력 해시로 결과 캐시. AI 키가 없으면 정해진 틀 문구(사실만 채움).
- QC: ffprobe(해상도 · 길이 · 코덱 · 오디오 · 크기), `blackdetect` 1초↑ 실패, `freezedetect` 2초↑ 실패, 게임 영역 프레임 차이, 문구 넘침(DOM 검사), 허용 음원 · 폰트, 게임명 · 주소가 원본과 같은지, 직전 콘텐츠와 파일 해시 다름, 채널 규격. 통과/실패 + 사유.
- 완료: 실물 MP4 · 커버 제출 · QC 통과 · 검은 화면 · 짧은 영상 일부러 만들어 불합격 확인.

## PHASE 5 — 텔레그램 승인 + Instagram Mock + 자동 실행
- `mkt-produce.yml` · `mkt-publish.yml` (concurrency, workflow_dispatch), (결정 3) 폴링 또는 `api/mkt-telegram.js` 웹훅.
- 텔레그램: 결과물 · 채널별 문구 · 예정 시각 · QC · UTM 링크, 버튼 6개, 답장 = 문구 수정.
- (결정 8) 예약은 master 의 워크플로만 돌므로, 먼저 `feature/marketing` push 시험 트리거로 GitHub Actions 위에서 확인.
- 완료: 승인 · 반려 · 수정 후 재승인 · 승인 없으면 게시 안 됨 · 중복 게시 없음 · 72시간 만료 · PC 꺼진 상태에서 Actions 로 제작 → Mock 게시까지.

## PHASE 6 — Instagram 실제 연결 (관리자 계정 연결 뒤)
- Meta 앱 · Instagram 로그인 · 장기 토큰 · (결정 5) 토큰 보관 · 만료 7일 전 갱신 · 실패 시 텔레그램.
- 완료: 실제 릴스 1건 · permalink 저장 · 토큰 만료 확인 동작 · 오류 분류(토큰 · 권한 · 미디어 · 한도 · 기타).

## PHASE 7 — 이미지 계열 (C2 퀴즈 · C3 운세 · C5 랭킹 · C6 챌린지 · C7 스토리)
- HTML 템플릿 → Playwright 스크린샷(JPEG — 인스타는 JPEG 만), 캐러셀 · 스토리 게시.
- 퀴즈 정답은 원본 `c` 그대로, 90일 안 재사용 금지. 운세는 사이트 페이지를 그날 날짜로 열어 나온 결과를 그대로(계산을 따로 베끼지 않음). 랭킹은 지난주 Redis 키 읽기 + (결정 6 · 7).
- 완료: 유형마다 실물 1건 · 원본 데이터와 일치 · 넘침 QC 동작 · 편성표대로 Planner 가 고름.

## PHASE 8 — 신작 감지(C4) + 추가 채널 (선택한 것만)
- 신작: `game-seo-data.js` · `games/` · `GAMES.added` 를 지난번 목록(`seen:games`)과 비교.
- Threads · Facebook · YouTube 어댑터 (API_RESEARCH 의 미확인 항목을 먼저 공식 문서로 확인).
- 완료: 테스트 신작 id 감지 → 제작 · 채널마다 Mock 통과 · live 채널 실제 1건 · 한 채널 실패해도 나머지 게시.

## PHASE 9 — 웹 관리자
- `mkt-admin/` + `api/mkt-admin.js`, `MKT_ADMIN_KEY`, 모니터실과 같은 잠금 규칙, 메뉴는 실제 동작하는 것만.
- 완료: 모든 메뉴 실제 데이터 · 인증 없이 접근 불가 · 텔레그램과 동시에 눌러도 한 번만.

## PHASE 10 — 성과 + 고도화
- 게시 후 1 · 3 · 7일 지표(지원하는 것만), UTM 유입(결정 4), 유형 · 게임 · 채널별 평균, Planner 가중치(최대 2배), 월요일 주간 요약.
- (승인되면) 게임 원래 소리, 프로필 추가, 댓글 → DM.

## PHASE 11 — 통합 · 문서 · 병합 준비
- 기존 테스트 전부(`scripts/test-*.js` 중 사이트 공통 · 건드린 게임) · 전체 흐름 통합 테스트 · 문서 일체 · master 로 병합 PR (병합은 관리자가).
