# PHASE 1 보고 — 분석과 설계

날짜 2026-11-08 · 브랜치 `feature/marketing` · 이 PHASE 에서는 프로젝트 코드를 쓰지 않았습니다 (문서만).

## 실제 실행해서 확인한 것

| 확인 | 한 일 | 결과 |
|---|---|---|
| 게임 목록 | `js/main.js` GAMES · `scripts/game-seo-data.js` 읽기 | 90개 (자체 82 · 외부 고전 8), 설명 데이터 90개 |
| 커밋 안 된 녹화 도구 | 원래 폴더에서 `node tools/game-reels/index.js --game reaction,slide-2048,whack-mole,penalty-kick,suika --duration 30` (로컬 서버 녹화, `/api` 차단) | 번쩍 반응 · 두배두배 **영상 완성**, 두더지 팡팡 **실패**("게임 상태를 읽지 못함" — 게임 개편 뒤 자동 플레이가 안 맞음), 그 실패 처리 중 **프로그램이 통째로 멈춰** 승부차기 · 수박은 시험 못 함 |
| GPU 있음/없음 화면 속도 | 임시 측정 스크립트(작업 폴더 밖, 커밋 안 함)로 대상 5개 게임을 GPU(d3d11) · SwiftShader 로 열어 5초 동안 화면 갱신 수 측정 | GPU: 모두 약 60. SwiftShader: 용암 5.5 · 하늘섬 2.3 · 드래곤 1.8 · 인형뽑기 38.3 · 반응 60.2 |
| 봇 옵션 | 봇 3개 소스 읽기 | 입력만 바꾸는 구조. 규칙을 바꾸는 옵션 god · noLava · ram 확인 (녹화에서 끔) |
| 퀴즈 · 운세 형식 | 소스 읽기 | 퀴즈 1,708문항 `{q, a[4], c}` · 운세 3분류, 날짜별로 모두에게 같은 결과 |
| 랭킹 · 챌린지 | 운영 사이트에 **읽기 전용 GET** (`/api/challenge`, `/api/scores?period=week`, 닉네임은 기록 안 함) | 오늘 챌린지 = 번쩍 반응, 참여 0명. 이번 주 주간 기록: 12개 게임 중 펄럭 병아리 1건뿐 |
| Redis 키 | 코드 전체에서 `todaygame:*` 검색 | `todaygame:mkt` 를 쓰는 곳 없음 |
| 배경음악 후보 | `assets/audio/*/CREDITS.txt` 읽기 | `hip/` 9곡 CC0(OpenGameArt 출처 링크 있음), `packs/` "오늘의게임용 자체 제작" |
| 공식 문서 | Instagram · Threads · Facebook Reels · YouTube · 텔레그램 · GitHub Actions · Vercel · Upstash 문서 읽기 | `API_RESEARCH.md` 에 정리 (문서 주소 포함) |
| Vercel 계정 | Vercel 연결 도구로 팀 · 프로젝트 조회 | 팀 없음, 프로젝트 `today-game` 있음 |

## 확인하지 못한 것

- **GitHub Actions 러너에서의 실제 화면 속도** — 이 PC 의 SwiftShader 로 비슷하게 잰 값입니다. 러너 CPU 는 더 느릴 가능성이 큽니다. (PHASE 3 에서 실제 러너로 측정)
- **`recordVideo` 화질** — Playwright 전용 ffmpeg 가 이 PC 에 없어 이번에는 측정 못 함.
- 텔레그램 파일 크기 · 버튼 데이터 길이 · 묶음 개수 (공식 문서 해당 부분 미확인), YouTube 미검수 프로젝트 공개 제한 (자료끼리 서로 다름), Facebook 링크 게시물, Threads 성과 권한, 인스타 캐러셀 · 게시 한도 숫자 차이(100 vs 50).
- Vercel 요금제가 Hobby 인지 (팀이 없어 Hobby 로 추정), Vercel 이 GitHub 와 연결되어 있는지, Upstash 를 사이트가 이미 얼마나 쓰는지.
- 대상 5개 게임의 **실제 녹화** — PHASE 3 일.

## 관리자 조치 · 결정 필요

1. **`ARCHITECTURE.md` §10 결정 1~11 에 답해 주세요.** 특히 1(3D 녹화), 2(녹화 도구 재사용), 5(토큰 보관)는 다음 PHASE 설계를 바꿉니다.
2. 지시서 §0 값: 로고 파일(없으면 글자 로고 "오늘의 게임"), 허용 배경음악 목록(후보 위 표), 문구 AI 와 모델, 쓸 채널.
3. Vercel 요금제 확인, Upstash 대시보드의 월 명령 수 확인.
4. (PHASE 5 전) 텔레그램 봇 만들기(BotFather) — `TG_BOT_TOKEN`, `TG_ADMIN_CHAT_ID`.
5. (PHASE 6 전) Meta 개발자 앱 + Instagram 프로페셔널 계정 연결.

## 그 밖에 알게 된 것

- 지시서는 기본 브랜치를 `main` 으로 적었지만 이 저장소는 **`master`** 입니다.
- 원래 작업 폴더(`D:\프로젝트\오늘의게임`)에 다른 작업으로 보이는 커밋 안 된 변경(`games/claw-master/js/sim.js`, `js/family-sites.js` 등)이 있어, 이 작업은 **별도 worktree** (`.claude/worktrees/marketing-automation`, 브랜치 `feature/marketing`)에서만 합니다. 원래 폴더는 건드리지 않았습니다.
- 녹화 도구 시험 결과물은 원래 폴더의 `reels/`(git 제외 폴더)에 남아 있습니다.
- 새 지시서를 받기 전에 쓰던 초안 코드(공용 모듈 4개)와 기존 파일 수정안은 **모두 되돌렸고**, 참고용 사본만 작업 폴더 밖 임시 폴더에 있습니다 (세션이 끝나면 사라질 수 있음).
