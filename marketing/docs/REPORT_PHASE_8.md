# PHASE 8 보고 — 신작 감지(C4) · Threads · Facebook 페이지 · YouTube Shorts

날짜: 2026-11-10 · 브랜치 `feature/marketing` · 시험 80/80 통과

## 만든 것

**C4 신작 감지 (`sources/new-game.js`)**
- 사이트 카탈로그(`js/main.js` GAMES) 중 `games/` 폴더가 있는 홍보 대상 게임(82개)을 지난번 목록(`todaygame:mkt:seen:games`)과 비교합니다.
- 처음 실행 때는 기준 목록만 저장합니다. 그래서 기존 게임 82개가 전부 신작으로 잡히지 않습니다.
- 이미 알린 신작(승인 대기 이후 · 반려 · 기한 지남)은 다시 알리지 않습니다. 제작 실패 · 취소된 것만 다시 시도합니다.
- 결과물: 녹화 프로필이 있으면 릴스, 없으면 실제 썸네일과 사이트 설명으로 피드 이미지(1080x1350)를 만듭니다.
  - Actions 에서는 PC 녹화 재고가 없으면 이미지로 만듭니다 (지시서 "제작 가능 여부를 함께 본다").
- 금요일 편성 `new-game → reel`: 신작이 없으면 C1 게임 릴스로 넘어갑니다.

**채널 어댑터.** 모두 공식 API만 씁니다. 기본은 Mock 이고, 관리자가 `CHANNEL_MODE_*=live` 로 켭니다.

| 채널 | 파일 | 형식 | 순서 | 토큰 |
|---|---|---|---|---|
| Threads | `channels/threads.js` | 영상 · 이미지 · 캐러셀 · 글 | 컨테이너 → 상태 FINISHED → `threads_publish` → 다시 조회(permalink) | 60일. 저장소에 암호화, 만료 7일 전 `th_refresh_token` 자동 갱신 (`run.js threads-connect`) |
| Facebook 페이지 | `channels/facebook.js` | 릴스 | `video_reels` start → `rupload`(OAuth 헤더 · `file_url`) → finish(PUBLISHED) → 게시 완료 확인 | 페이지 장기 토큰(만료 없음). Secret `FACEBOOK_PAGE_TOKEN` · `FACEBOOK_PAGE_ID` |
| YouTube Shorts | `channels/youtube.js` | 영상 | 갱신 토큰 → 이어 올리기(메타데이터 → 바이트) → `videos.list` 로 확인 | Secret `YOUTUBE_CLIENT_ID` · `_SECRET` · `_REFRESH_TOKEN` |

- 세 채널 공통:
  - 오류를 TOKEN · PERMISSION · RATE_LIMIT · MEDIA · INVALID · NETWORK 로 나눕니다. 다시 시도할 오류와 바로 멈출 오류를 구분합니다.
  - 오류 글에 토큰 · 비밀값을 남기지 않습니다.
  - 게시가 중간에 끊기면 이어서 처리합니다. Threads 는 이미 올라간 글을 찾아 중복 게시를 막습니다.
- 지표는 플랫폼이 주는 것만 씁니다. YouTube 는 공개 통계(조회 · 좋아요 · 댓글)만 씁니다.
- `node marketing/run.js channels`: 채널마다 mock/live · 연결 상태를 보여 줍니다. live 인데 계정이 없으면 "연결 안 됨"이라고 그대로 표시합니다.
- 워크플로에 새 Secrets · Variables 이름을 추가했습니다. 값이 없으면 계속 Mock 입니다.
- `channels/caps.js`: Threads 글 500자 · 주제 태그 1개를 공식 문서로 확인했습니다 (2026-11-10).

## 실제 실행해서 확인한 것

- **신작 감지 실물:** `node marketing/make.js new-game:tetris`
  - 기준 목록에서 "블록 팡팡"을 뺐더니 신작으로 감지했습니다.
  - 실제 썸네일 · 사이트 소개로 이미지를 만들었고 검수를 통과했습니다 (그림을 눈으로 확인).
- **실제 GitHub Actions** (run 42707123195, 2026-11-10, 이 PHASE 코드로):
  - 스토리: 운영 `/api/challenge` 의 "우주 회피" 챌린지 스토리를 만들었습니다.
  - 피드: PC 녹화 재고로 "드래곤 석상 대작전" 릴스를 만들었습니다.
  - 둘 다 텔레그램 승인 대기까지 갔습니다. 리눅스 러너에서도 한글 · 이모지(🏆)가 제대로 그려진 것을 내려받아 확인했습니다 (PHASE 7 의 "Actions 에서 이미지 미확인" 해결).
- **채널 상태:** `run.js channels` 로 기본은 4채널 모두 mock, `CHANNEL_MODE_*=live` 로 켜면 "연결 안 됨"으로 정직하게 표시됨을 확인했습니다.
- **시험 7개 추가 (가짜 플랫폼 서버):**
  - 신작: 첫 실행 기준 저장, 감지, 이미지 제작, 다시 안 잡힘, 프로필이 있으면 릴스, Actions 재고 규칙.
  - Threads: 영상 · 캐러셀 · 한도 · 토큰 없음 · 갱신.
  - Facebook: 3단계 · 헤더 · 권한 오류에서 토큰 숨김.
  - YouTube: 갱신 토큰 · 이어 올리기 · 할당량 · 취소된 토큰 · 비밀값 숨김.
  - **한 채널이 실패해도 다른 채널은 게시됨:** 실제 어댑터로 Facebook 은 성공, YouTube 는 권한 실패여도 콘텐츠는 게시 완료로 끝납니다.

## 확인하지 못한 것

- **Threads · Facebook · YouTube 실제 게시 1건:** 관리자가 채널을 고르고 계정을 연결해야 합니다 (지시서 완료 조건 "live 로 켠 채널은 실제 게시 1건" — 아직 live 로 켠 채널이 없음).
- **Threads 컨테이너 상태 값(FINISHED 등):** 공식 문서 요약에 없어 Instagram 과 같은 방식으로 구현했습니다. 실제 연결 때 확인이 필요합니다.
- **Facebook 영상 지표 이름:** API 가 돌려주는 대로만 표시합니다 (미확인).

## 관리자 조치 필요

- 쓸 채널을 골라 `docs/CHANNEL_SETUP.md` §3 대로 연결해 주세요. 안 고르면 인스타그램만 씁니다.
- 텔레그램에 온 오늘(11-10) 승인 요청 2개(우주 회피 챌린지 스토리 · 드래곤 석상 릴스)는 이 PHASE 시험으로 만든 것입니다.
  - 승인하면 Mock 게시만 됩니다 (실제 인스타에는 아무것도 올라가지 않음).
  - 두면 기한 지남으로 정리됩니다 (스토리는 자정, 릴스는 72시간 뒤).

## 바꾼 기존 파일

없음 (`marketing/` · `.github/workflows/mkt-*.yml` 만).
