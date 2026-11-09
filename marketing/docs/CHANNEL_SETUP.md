# 채널 계정 연결 설명서

모든 비밀값은 **GitHub 저장소 → Settings → Secrets and variables → Actions** 와 이 PC 의 `marketing/.env.local`(git 제외)에만 둡니다. 채팅 · 코드 · 로그에 남기지 마세요.
채널마다 `CHANNEL_MODE_{채널}` 이 `mock`(기본)이면 실제로 올리지 않습니다. 실제 게시는 GitHub → Settings → Variables 에서 `CHANNEL_MODE_INSTAGRAM=live` 처럼 **관리자가 직접** 켭니다.

## 1. 텔레그램 (승인 · 알림) — 연결됨 (2026-11-09)

- 봇: @todaygamebot · Secrets `TG_BOT_TOKEN`, `TG_ADMIN_CHAT_ID`
- 토큰을 바꾸려면: @BotFather → `/revoke` → 새 토큰을 `TG_BOT_TOKEN` 에 넣기
- 주의: 웹훅을 켜면 지금 방식(30분마다 getUpdates)이 멈춥니다.

## 2. Instagram (필수) — 연결 대기

공식 문서: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/create-a-meta-app-with-instagram (2026-11-09 확인)

1. **인스타 계정을 프로페셔널로**: 인스타 앱 → 설정 → 계정 유형 및 도구 → 프로페셔널 계정으로 전환 (비즈니스 또는 크리에이터). 계정은 **공개**여야 함.
2. **Meta 개발자 앱 만들기**: https://developers.facebook.com → 내 앱 → 앱 만들기 → 사용 사례 **기타** → 앱 유형 **비즈니스** → 이름 · 연락처 이메일.
3. **Instagram 제품 추가**: 앱 대시보드에서 Instagram → 설정 → "Instagram 로그인으로 API 설정"이 자동으로 붙음.
4. **계정 추가 · 토큰 만들기**: "액세스 토큰 생성" → 계정 추가 → 인스타 계정으로 로그인 → 권한 `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`, `instagram_business_manage_comments`(퀴즈 정답 첫 댓글 — 없으면 게시는 되고 댓글만 빠짐) 를 허용 → 표시된 **토큰** 복사.
5. **토큰 연결** (택1)
   - 저(Claude)에게 토큰을 알려 주면 이 PC 에서 연결합니다 (대화 기록에 남는다는 점만 주의).
   - 직접: PowerShell 에서 `$env:IG_NEW_TOKEN="토큰"; node marketing/run.js ig-connect` → 저장소에 **암호화**되어 들어감 (열쇠 `MKT_TOKEN_KEY` 는 이미 Secrets 에 있음).
   - 확인: `node marketing/run.js ig-status` (계정 · 남은 날짜).
6. (선택) 앱 대시보드 → 앱 설정 → 기본 설정의 **앱 시크릿**을 Secret `INSTAGRAM_APP_SECRET` 에 넣으면 1시간짜리 토큰도 60일 토큰으로 바꿔 씁니다.
7. **실제 게시 켜기**: GitHub → Settings → Secrets and variables → Actions → **Variables** → `CHANNEL_MODE_INSTAGRAM` = `live`.

주의 (문서 그대로)
- "connect your app to a business that has completed Business Verification" — 게시하려면 **비즈니스 인증**을 마친 비즈니스에 앱을 연결해야 한다고 적혀 있습니다 (앱 설정 → 기본 설정).
- "Instagram requires successful completion of the App Review process before your app can access live data" — **앱 검수**가 필요하다고 적혀 있습니다. 앱에 역할로 추가한 우리 계정만 쓰는 경우(Standard Access) 검수 없이 되는지는 문서에서 확인되지 않았습니다 → 연결 뒤 첫 게시로 확인합니다.
- 토큰은 60일. 시스템이 만료 7일 전부터 매일 갱신을 시도하고, 실패하거나 만료되면 텔레그램으로 알립니다. 60일 동안 갱신하지 못하면 영구 만료 → 4~5번을 다시.
- 게시 한도: 24시간에 100건(문서 안에 50건이라는 곳도 있어 게시 전에 실제 남은 수를 확인함).

## 3. Threads · Facebook 페이지 · YouTube (선택) — 코드 완료 · 연결 대기 (Mock)

실제 어댑터 코드 · 시험(가짜 플랫폼 서버)은 PHASE 8 에서 끝났습니다. **쓰기로 정한 채널만** 아래처럼 연결하고 GitHub 저장소 → Settings → Secrets and variables → Actions → **Variables** 에 `CHANNEL_MODE_{채널}=live` 를 넣으면 켜집니다. 넣지 않으면 계속 Mock (아무것도 올라가지 않음).

**Threads** (`channels/threads.js`, 24시간 250건, 글 500자, 주제 태그 1개)
1. developers.facebook.com → 앱 → 제품 추가 → **Threads API** → 권한 `threads_basic`, `threads_content_publish` (성과를 보려면 `threads_manage_insights`).
2. Threads 계정으로 로그인해 **장기 토큰(60일)** 을 받습니다.
3. 이 PC 에서: `THREADS_NEW_TOKEN=받은토큰 node marketing/run.js threads-connect` → 토큰은 암호화해서 저장소에만 (`channel:threads`), 만료 7일 전부터 자동 갱신, 실패하면 텔레그램.
4. Variables 에 `CHANNEL_MODE_THREADS=live`.

**Facebook 페이지 릴스** (`channels/facebook.js`, 릴스만 · 3~90초 · 24시간 30건)
1. 같은 Meta 앱에 **Facebook 로그인** → 권한 `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
2. 그래프 API 탐색기에서 페이지 관리자 계정으로 사용자 토큰 → 장기 토큰 → `/me/accounts` 의 **페이지 토큰**(만료 없음)과 **페이지 id**.
3. Secrets: `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_TOKEN`. Variables: `CHANNEL_MODE_FACEBOOK=live`.

**YouTube Shorts** (`channels/youtube.js`, 영상만, 하루 100회)
1. Google Cloud 콘솔 → 새 프로젝트 → **YouTube Data API v3** 사용 → OAuth 동의 화면(외부, 게시 상태 "프로덕션" — "테스트" 상태면 갱신 토큰이 7일 뒤 만료) → OAuth 클라이언트 ID(데스크톱 앱).
2. 범위 `https://www.googleapis.com/auth/youtube.upload` + `https://www.googleapis.com/auth/youtube.readonly` 로 한 번 로그인해 **갱신 토큰(refresh token)** 을 받습니다 (OAuth Playground 등).
3. Secrets: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`. Variables: `CHANNEL_MODE_YOUTUBE=live`. 처음엔 Variables `YOUTUBE_PRIVACY=private` 로 시험해도 됩니다 (워크플로에 추가 필요).
4. 공식 문서(2026-11-10): "미검수 API 프로젝트에서 올린 영상도 비공개로 제한되지 않는다". 그래도 처음 몇 개는 채널에서 공개 상태를 확인하세요.

확인: `node marketing/run.js channels` — 채널마다 mock/live · 연결 상태.

## 4. 저장소 · 미디어 — 연결됨

- Upstash Redis (사이트와 같은 것, 마케팅 키는 `todaygame:mkt:*` 만) · Secrets `UPSTASH_REDIS_REST_URL/TOKEN`
- Vercel Blob `todaygame-mkt-media` (공개, iad1) · Secret `BLOB_READ_WRITE_TOKEN`
- 인스타 토큰 암호화 열쇠 · Secret `MKT_TOKEN_KEY`
