# PHASE 6 보고 — Instagram 실제 연결

날짜 2026-11-09 · **상태: 코드 · 시험 완료, 실제 연결은 "관리자 계정 연결 대기"** (Meta 앱 · 프로페셔널 계정 · 비즈니스 인증 / 앱 검수는 관리자만 할 수 있음 — 지시서 §13-5)

## 만든 것

| 파일 | 하는 일 |
|---|---|
| `channels/instagram.js` | 공식 Instagram API(Instagram 로그인, `graph.instagram.com`, v27.0). 게시 전 **24시간 게시 한도 확인** → 컨테이너(릴스 `REELS` + 커버 · 이미지 · 캐러셀 2~20장 · 스토리) → `status_code` 확인(EXPIRED · ERROR · FINISHED · PUBLISHED) → `media_publish` → **다시 조회해 permalink**. 컨테이너 id · 게시 id 를 받는 즉시 저장, 중간에 멈추면 상태를 다시 물어 이어서 게시(만료 컨테이너는 새로). 공개 https 주소가 없으면 게시 안 함 |
| 오류 구분 | 토큰(190 등) · 권한(10 · 200번대) · 한도(4 · 17 · 32 · 613 · 429) · 미디어 처리(9004 · 2207xxx) · 요청 값(100) · 네트워크 · 그 밖. 토큰 · 권한 · 미디어는 다시 시도하지 않고 바로 실패 + 알림, 한도 · 네트워크 · 그 밖은 백오프 뒤 다시 |
| 토큰 (결정 5) | `run.js ig-connect` (토큰은 환경 변수 `IG_NEW_TOKEN` 으로만 — 명령 인자 · 로그에 안 남게) → `/me` 로 **프로페셔널 계정만** 받음 → **AES-256-GCM 암호문**으로 Redis `channel:instagram` (열쇠 `MKT_TOKEN_KEY` 는 Secrets · 이 PC 에만, 만듦). 앱 시크릿이 있으면 1시간 토큰을 60일 토큰으로 교환. 만료일 저장(대시보드 토큰은 60일 추정 표시) |
| 갱신 · 만료 | 게시 작업이 하루 한 번: **만료 7일 전부터 `refresh_access_token`** (발급 24시간 뒤부터), 실패 → 텔레그램 "토큰 갱신 실패", 만료 → "토큰 만료" + 게시 거부 |
| 지표 | 릴스 지표 `views · reach · likes · comments · saved · shares · total_interactions` 중 **실제로 주는 것만** (한꺼번에 오류면 하나씩 다시, 안 되는 건 빼고 지어내지 않음) — PHASE 10 에서 수집 |
| `run.js ig-status` · 워크플로 | 연결 상태 · 남은 날짜. 워크플로에 `MKT_TOKEN_KEY` · `INSTAGRAM_APP_SECRET` |
| `docs/CHANNEL_SETUP.md` | 텔레그램 · 인스타(Meta 앱 만들기 → 토큰 → 연결 → live 켜기) · 그 밖 채널 · 저장소 연결 설명서 |

## 실제 실행해서 확인한 것

- `npm test` **62개 모두 통과** — 새 인스타 시험 9개 (가짜 Meta 서버): 암호화(열쇠 다르면 못 읽음, 저장소에 원문 없음) · 프로페셔널 계정만 · 릴스 게시 순서 · 문구 + 해시태그 · id 즉시 저장 · permalink · 공개 주소 없으면 거부 · 캐러셀(자식 3개 + CAROUSEL) · 스토리 · 오류 구분 9가지 · Meta 처리 ERROR / 시간 초과 / 토큰 오류(토큰이 오류 문구에 안 나옴) · 이어가기 3가지 · 지원 안 되는 지표 빼기 · 갱신(그대로 / 갱신 / 실패 알림 / 만료 알림 / 만료면 게시 거부).
- `node marketing/run.js ig-status` → `{"connected":false}` (연결 전 정상).
- `MKT_TOKEN_KEY` 를 만들어 GitHub Secret · 이 PC `.env.local` 에 넣음 (값은 출력하지 않음).

## 확인하지 못한 것 (완료 조건 — 관리자 연결 뒤)

- **실제 릴스 1건 게시 · permalink 저장** — Meta 앱 · 토큰이 없어 못 함.
- 실제 토큰 만료 확인 · 실제 오류 응답 형식 (가짜 서버로만).
- Meta 문서에 "비즈니스 인증을 마친 비즈니스에 앱 연결" · "라이브 데이터는 앱 검수 후" 라고 되어 있음 — 우리 계정만 쓰는 개발 모드에서 검수 없이 게시되는지는 문서로 확인 안 됨.
- 영상 규격의 "closed GOP" 는 x264 기본값(open-gop 꺼짐)에 기대고 있음 — 실제 업로드로 확인 필요.

## 관리자 조치 필요

`docs/CHANNEL_SETUP.md` §2 의 1~7 (프로페셔널 전환 → Meta 앱 → 토큰 → 연결 → `CHANNEL_MODE_INSTAGRAM=live`). 연결 뒤 `[mkt-run]` 으로 한 건 올려 확인합니다.
