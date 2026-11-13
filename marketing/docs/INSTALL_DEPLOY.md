# 설치 · 배포 설명서

홍보 자동화는 세 곳에서 돕니다. **사이트 배포와는 따로**입니다. master 에 병합해도 사이트는 바뀌지 않습니다 (Vercel 이 GitHub 에 연결돼 있지 않음).

| 어디서 | 무엇을 | 언제 |
|---|---|---|
| GitHub Actions `mkt-produce` | 오늘의 스토리 · 피드 만들기 → 검수 → 텔레그램 승인 요청 | 매일 08:07(서울) 예약 + 수동 실행 |
| GitHub Actions `mkt-publish` | 텔레그램 답 처리 → 기한 · 멈춤 정리 → **승인된 것만** 게시 → 지표 · 주간 요약 · 관리자 화면 자료 · (하루 한 번) 토큰 갱신 · 팔로워 · 오래된 Blob 정리 | 매시 13분 · 43분 예약 + 수동 |
| 이 PC (GPU) | 게임 플레이 녹화 → 압축 → Blob 재고 (게임당 2개) | 작업 스케줄러 (켜져 있을 때) |
| Vercel (사이트와 같은 배포) | 웹 관리자 `/mkt-admin/` · `api/mkt-admin` · 클릭 세기 `api/mkt-go` | 관리자가 배포할 때 |

> GitHub 예약 실행은 붐빌 때 몇 분~수십 분 늦을 수 있습니다. 게시 시각은 "그 시각 이후 첫 실행"입니다. 공개 저장소는 60일 동안 활동이 없으면 예약이 꺼지므로, 꺼지면 Actions 화면에서 다시 켭니다.
>
> **실제 운영 (2026-11-11~13):** 30분마다 예약한 게시가 실제로는 4~8시간마다만 돌았습니다. 그래서 **Upstash QStash 예약이 GitHub 워크플로를 직접 깨웁니다** (workflow_dispatch, 2026-11-13 설정).
> - 예약 두 개: 게시는 매시 13 · 43분, 제작은 매일 23:07 UTC.
> - 설정 · 확인: `node marketing/pc/qstash-setup.js check | create | test | list`.
> - 필요한 값 (이 PC `marketing/.env.local`):
>   - `GH_DISPATCH_TOKEN`: GitHub 세분화 토큰. 이 저장소만, Actions 읽기 · 쓰기. 만료되면 다시 만들어 `save` → `create`.
>   - `QSTASH_TOKEN`
>   - `QSTASH_URL`: 이 계정은 `https://qstash-us-east-1.upstash.io`.
> - GitHub 자체 예약도 그대로 둡니다. 겹쳐도 잠금 · 하루 상한 때문에 두 번 게시되지 않습니다.

## 1. 저장소 · 병합

1. PR(`feature/marketing` → `master`)을 검토하고 **관리자가 직접 병합**합니다. 병합 뒤부터 예약 실행이 돕니다.
2. 병합 전에 정할 것: `.vercelignore` 수정 승인 (아래 4-2). 승인하지 않아도 Actions 쪽은 그대로 동작합니다.

## 2. GitHub Secrets · Variables (저장소 → Settings → Secrets and variables → Actions)

**Secrets** — 이미 넣은 것:
- `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN`: 사이트와 같은 Redis. 키는 `todaygame:mkt:*` 만 씀.
- `TG_BOT_TOKEN` · `TG_ADMIN_CHAT_ID`
- `BLOB_READ_WRITE_TOKEN` (저장소 `todaygame-mkt-media`)
- `MKT_TOKEN_KEY`: 채널 토큰 암호화 열쇠, 32자 이상.

**Secrets** — 필요할 때 넣을 것:
- `LLM_API_KEY`: AI 문구. 없으면 정해진 틀 문구를 씀.
- `INSTAGRAM_APP_SECRET`: 짧은 토큰 교환용, 선택.
- `FACEBOOK_PAGE_ID` · `FACEBOOK_PAGE_TOKEN`
- `YOUTUBE_CLIENT_ID` · `YOUTUBE_CLIENT_SECRET` · `YOUTUBE_REFRESH_TOKEN`

**Variables** (값이 없으면 모두 `mock` = 아무것도 올라가지 않음):
- `CHANNEL_MODE_INSTAGRAM` · `CHANNEL_MODE_THREADS` · `CHANNEL_MODE_FACEBOOK` · `CHANNEL_MODE_YOUTUBE` = `live`
- `YOUTUBE_PRIVACY` = `public` | `private`

계정 연결 방법: `CHANNEL_SETUP.md`. 비밀값은 저장소 · 로그 · 화면에 남기지 않습니다. 공개 저장소라 Actions 로그는 누구나 봅니다.

## 3. 이 PC (녹화 재고)

```
cd marketing
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci          # Pretendard · Claude SDK · playwright (크롬은 설치된 것을 씀)
```
- `marketing/.env.local`(git 제외)에 2-의 값 중 `UPSTASH_*` · `BLOB_READ_WRITE_TOKEN` · `TG_*` · `MKT_TOKEN_KEY` 를 넣습니다. 이미 넣어 둠.
- 재고 채우기: `node marketing/pc/record-stock.js`
- 매일 자동으로 하려면 관리자가 PowerShell 에서 직접 `marketing/pc/install-task.ps1` 를 실행합니다. 자동 모드에서는 작업 스케줄러 등록이 막혀 있습니다.
- 재고가 없으면 Actions 는 그 게임을 고르지 않고 다른 게임 · 유형으로 넘어갑니다. 5개 게임 모두 이 PC 에서 녹화합니다.

## 4. Vercel (웹 관리자 · 클릭 세기) — 관리자가 배포할 때

### 4-1. 환경 변수

- `MKT_ADMIN_KEY`: 24자 이상 임의 문자열. 웹 관리자 비밀번호.
- `KV_REST_API_URL` · `KV_REST_API_TOKEN`: 사이트가 이미 쓰는 것을 그대로 씀.

### 4-2. `.vercelignore` (기존 파일 — 수정 승인 필요)

지금 그대로 배포하면 이 PC 의 `marketing/out/`(녹화 원본, 수 GB)이 함께 올라갑니다. 다음 줄을 더하자고 제안합니다:
```
marketing/out
marketing/tests
marketing/docs
marketing/pc
```

### 4-3. 배포

```
npm run deploy        # 기존 방식 그대로 (npx vercel deploy --prod)
```

배포한 뒤 확인할 것:
- `https://www.todaygame.co.kr/mkt-admin/` 에서 키로 로그인되는지
- 웹 관리자 → 채널 연결 메뉴가 열리는지
- `/api/mkt-go?to=/` 가 홈으로 가는지

`/api/mkt-go` 가 동작하면 웹 관리자 → 편성표 → **사이트 클릭 세기**를 켭니다 (켜기 전 링크는 일반 UTM 주소).

## 5. 수동 명령 (이 PC 또는 Actions "Run workflow")

```
node marketing/run.js produce [--slot story|feed] [--type quiz|ranking|fortune|challenge|recycle|new-game|reel] [--game <id>] [--force]
node marketing/run.js publish | redo | status | channels | weekly [--monday YYYY-MM-DD]
IG_NEW_TOKEN=… node marketing/run.js ig-connect        THREADS_NEW_TOKEN=… node marketing/run.js threads-connect
node marketing/make.js <게임|quiz|fortune|challenge|ranking|new-game:<id>> [--latest]   # 저장소 없이 시험 제작 (게시 안 함)
node marketing/admin-dev.js                             # 웹 관리자를 이 PC 에서 시험 (운영은 읽기만)
cd marketing && npm test                                 # 시험 91개
```

## 6. 되돌리기 · 멈추기

- **게시만 멈추기:** Variables 의 `CHANNEL_MODE_*` 를 지우거나 `mock` 으로. 즉시 모의로 바뀝니다.
- **전부 멈추기:** Actions → `mkt-produce` · `mkt-publish` → Disable workflow.
- **코드 되돌리기:** 이 PR 은 새 파일만 더합니다 (기존 파일 변경 0). 병합 커밋을 revert 하면 끝입니다.
- **저장소 데이터:** `todaygame:mkt:*` 키만 쓰므로 사이트 데이터와 섞이지 않습니다.
