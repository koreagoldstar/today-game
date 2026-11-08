# TODAY GAME 홍보 자동화 — 설계 (PHASE 1)

작성 2026-11-08 · 브랜치 `feature/marketing` · 지시서 `TODAYGAME_MARKETING_FULL_PROMPT.md`
**이 문서는 아직 승인 전입니다.** 맨 아래 "결정이 필요한 것" 에 관리자 답이 필요합니다.

---

## 1. 지금 사이트 구조

| 부분 | 실제 모습 |
|---|---|
| 화면 | 프레임워크 없는 정적 HTML · JS. 게임 90개(자체 82 · 외부 고전 8), 홈 카탈로그는 `js/main.js` 의 `GAMES` 배열 (15개에 `added` 날짜) |
| 서버 함수 | `api/` 에 7개 (challenge · monitor · plays · scores · share-card · speak · visits) + 도우미 `_stats.js` |
| 저장소 | Upstash Redis 하나. 쓰는 키 앞머리: `todaygame:plays · visits · challenge · monitor · scores · popularity · stats`. **`todaygame:mkt` 는 아무도 안 씀** |
| 배포 | Vercel 프로젝트 `today-game`, `npm run deploy` (CLI). 팀이 없는 개인 계정 → **Hobby 요금제로 추정 (관리자 확인 필요)** |
| 저장소(GitHub) | `koreagoldstar/today-game` **공개 저장소**, 기본 브랜치는 **`master`** (지시서의 main 이 아님) |
| 운영자 화면 | `/monitor/` — `MONITOR_KEY` 로 로그인 → 30일 열쇠(저장소엔 sha256 만), IP별 · 전체 실패 횟수 잠금 |

## 2. 기존 자산 조사 결과

| 자산 | 형식 · 쓸 수 있는지 |
|---|---|
| `scripts/game-seo-data.js` | 90개, `{ id, title, intro, how, faq[] }`. 문구의 **사실 근거**로 그대로 씀 |
| 자동 조종 봇 3개 | `lava-autopilot.js`(용암 서핑) · `sky-autopilot.js`(하늘섬) · `dragon-autopilot.js`(드래곤 석상 대작전 모험). 셋 다 `page.evaluate` 로 넣고 **입력 함수(steer/move · consume · jumpHeld)만 바꿔 끼움**. 규칙을 바꾸는 옵션: 용암 `god` · `noLava` · `ram`, 하늘섬 · 드래곤 `god` → **녹화에서는 전부 끔** |
| 테스트 패턴 | `test-*.js`: `serviceWorkers: "block"` + `page.route("**/api/**")` 가짜 응답. 3D 테스트는 GPU 인자(`--use-angle=d3d11`), `*_GPU=0` 이면 SwiftShader |
| 퀴즈 | `games/wisdom-quiz/questions.js` → `window.WISDOM_QUIZ_BANK = [{ q, a:[4개], c:정답번호 }]`, **1,708문항** |
| 운세 | `games/fortune-draw/game.js` 의 `CATS` = 오늘의 운세 · 오늘의 점심 · 오늘의 행운템, 각 `pool:[{ t, d }]`. 결과는 `mulberry32(seedFromString("서울날짜_분류"))` → **그날은 누구에게나 같은 결과**. 그래서 사이트와 똑같은 운세 카드를 만들 수 있음 |
| 랭킹 | `api/scores.js` GET `?game=&period=day|week&limit=` (이번 기간만). Redis `todaygame:scores:{game}:{day|week}:{id}`, 주간 id 는 `2026-W45` 꼴, 주간 기록 16일 보관 → 월요일에 **지난주 키를 직접 읽어야** 함. 닉네임은 2~8자, 특수문자만 지우고 **나쁜 말 거르기가 없음** |
| 오늘의 챌린지 | `api/challenge.js` GET → `{ day, game:{id,title,href,metric,lower,unit}, participants, best, top10 }`. 20개 게임이 날짜 순서로 돌아감 |
| 녹화 도구 (커밋 안 됨) | 원래 폴더의 `tools/game-reels/` (**git 에 없음**, 약 3,000줄): CDP 화면 캡처(810×1440) + 페이지 안 WebAudio 녹음으로 **게임 원래 소리까지** 녹화, 하이라이트 고르기, FFmpeg 9:16 편집, 문구 PNG, 썸네일, 게임 15개 전용 자동 플레이. 2026-11-08 시험: 번쩍 반응 · 두배두배 **성공**, 두더지 팡팡 **실패**(게임 개편 뒤 맞지 않음) + 실패할 때 프로그램 전체가 멈추는 버그 발견 (고친 안은 있음, 아직 반영 안 함) |

## 3. 처음 녹화할 게임 5개

측정: 2026-11-08, 이 PC(Ryzen 5 5600X · RTX 3060), 405×720 @2배, 첫 화면 4초 뒤 5초 동안 화면 갱신 수. GPU 없음 = Chrome SwiftShader(GitHub Actions 기본 러너와 같은 조건. 러너 CPU 는 이 PC 보다 느릴 가능성이 큼).

| 게임 | 그리기 | 조작 (실제) | 녹화용 조종 | GPU 있음 | **GPU 없음** |
|---|---|---|---|---|---|
| 용암 서핑 `lava-surfers` | three.js 3D | 방향키 · 점프 · 부스터 / 터치 패드 | `lava-autopilot` (god·noLava 끔) | 60.1 | **5.5** |
| 하늘섬 대탈출 `sky-island` | three.js 3D | 이동 · 점프(누르는 길이) | `sky-autopilot` (god 끔) | 60.1 | **2.3** |
| 드래곤 석상 대작전 `dragon-statue` | three.js 3D | 이동 · 점프 | `dragon-autopilot` (god 끔) | 60.2 | **1.8** |
| 인형뽑기 마스터 `claw-master` | Canvas 2D (직접 만든 물리) | 방향키 · Space(동전 · 내리기) / 화면 버튼 | **새로 만들어야 함** (상태는 `window.ClawMaster` 로 읽기만) | 60.1 | 38.3 |
| 번쩍 반응 `reaction` | DOM + 2D | 시작 버튼 → 신호에 탭 | `tools/game-reels/adapters/reaction.js` (오늘 실제 성공) | 60.4 | 60.2 |

**구조적 문제:** 3D 게임 3개는 GPU 없는 무료 러너에서 초당 2~5장 밖에 안 그려집니다. 메모에 남은 대로 이 게임들은 프레임 사이 시간을 1/20초로 잘라서, 느린 컴퓨터에서는 게임 속 시간이 실제보다 느리게 흐릅니다 → **그대로 녹화하면 쓸 수 없는 영상**. 선택지는 §10 결정 1.

## 4. 전체 구조

```
GitHub Actions (cron, PC 꺼져 있어도 동작)
  mkt-produce  매일 08:00 KST  → Planner → Source → Renderer → Copywriter → QC → 승인 대기 + 텔레그램 알림
  mkt-publish  30분마다        → 텔레그램 답 처리(폴링 방식일 때) → "승인 + 시각 지남 + 미게시" 만 게시 → 결과 확인
  mkt-insights 하루 1번        → 게시 후 1·3·7일 지표 · 토큰 만료 확인 · 오래된 파일 삭제 · (월) 주간 요약
        │                 │
        ▼                 ▼
  Upstash Redis (todaygame:mkt:*)      Vercel Blob (공개 HTTPS 미디어, 30일 뒤 삭제)
        ▲
        │ 같은 데이터 · 같은 상태 머신
  Vercel 함수: api/mkt-telegram.js (웹훅) · api/mkt-admin.js (PHASE 9) · (선택) api/mkt-go.js (유입 집계)
```

녹화 · 인코딩은 GitHub Actions 안에서만 합니다. 워크플로가 저장소를 받아 로컬 서버로 사이트를 띄워 녹화하므로 **운영 사이트를 녹화하지 않고**, `/api/**` 는 가짜 응답 · 서비스워커 차단으로 **운영 통계 · 랭킹을 건드리지 않습니다.** 운영 데이터는 읽기 전용 GET(또는 Redis 읽기)만 합니다.

## 5. 폴더 · 플러그인

```
marketing/
  CLAUDE.md          새 세션은 이것부터
  core/              state.js store.js planner.js qc.js approval.js publisher.js logger.js registry.js
  sources/           game.js quiz.js fortune.js ranking.js challenge.js new-game.js
  renderers/         reel/ (record.js edit.js) image/ carousel/ story/
  templates/         reel-*/ image-*/ (HTML+CSS)
  channels/          instagram.js threads.js facebook.js youtube.js mock.js
  copy/              prompts/ copywriter.js
  profiles/          <game-id>.json
  docs/  tests/
api/mkt-telegram.js  api/mkt-admin.js  (api/mkt-go.js)
mkt-admin/           (PHASE 9)
.github/workflows/mkt-produce.yml mkt-publish.yml mkt-insights.yml
```

- **Source** `collect(ctx) → { sourceType, sourceId, facts, assets }` — `facts` 만 문구 근거
- **Renderer** `render(source, template) → { kind, files[], meta }`
- **Channel** `capabilities() · publish(content) · verify(postId) · insights(postId) · health()`
- 등록은 `core/registry.js` 한 곳. 새 유형 · 채널 = 파일 하나 + 등록 한 줄.
- Node.js (사이트 · 기존 테스트와 같은 언어). 외부 라이브러리는 `marketing/package.json` 에만 두고(사이트 배포에 섞이지 않게) 꼭 필요한 것만: `playwright`(이미 씀), Blob 업로드용 `@vercel/blob`, 문구 AI SDK. FFmpeg 는 러너에 설치.

## 6. 저장소 (Redis) 키

모두 `todaygame:mkt:` 로 시작 — 기존 키와 겹치지 않음을 확인했습니다. 하루 1~2건 규모라 관계형 DB 는 필요 없다고 판단합니다.

| 키 | 종류 | 내용 |
|---|---|---|
| `content:{id}` | JSON | 콘텐츠 1개 (아래 상태 · 버전 · 파일 · 채널별 문구 · 검수 결과 · 승인 · 채널별 게시 상태) |
| `contents` | ZSET | 만든 시각 → id (목록) |
| `job:{id}` / `jobs` | JSON / LIST | 작업 유형 · 상태 · 시작 · 끝 · 재시도 · 오류 |
| `post:{contentId}:{channel}` | JSON | 플랫폼 게시 id · permalink · 시각 · 결과 · 오류 코드 · idempotency 키 |
| `idem:{contentId}:{channel}:v{version}` | 문자열 (SET NX) | 같은 버전을 같은 채널에 두 번 올리지 않게 |
| `insights:{contentId}:{channel}` | LIST | `{ metric, value, at }` |
| `channels` | HASH | 채널별 연결 상태 · 토큰 만료일 (**토큰 값은 Secrets 에만**) |
| `games` · `profiles` | HASH | 게임별 홍보 제외 · 마지막 홍보일 · 녹화 프로필 참조 |
| `settings` | JSON | 편성표 · 게시 시각 · 채널별 하루 상한 · 검수 기준 |
| `seen:games` · `seen:quiz` | SET / ZSET | 신작 감지용 이전 목록 · 90일 안 쓴 퀴즈 |
| `clip:{id}` / `clips` | JSON / ZSET | PC 가 올린 3D 녹화본 재고 (게임 · 녹화 시각 · 커밋 · fps · 길이 · 파일 주소 · used) — §11 |
| `logs` | LIST (최근 1,000) | 상태 변경 · API 호출 결과 · 오류 (토큰 가림) |
| `lock:{name}` | 문자열 (SET NX EX) | 작업 · 콘텐츠 잠금 |
| `tg:done:{callbackId}` | 문자열 (SET NX EX) | 텔레그램 버튼 한 번만 처리 |

**토큰을 어디 둘지 (주의):** 지시서는 "토큰 값은 Secrets 에만" 입니다. 그런데 Instagram 장기 토큰은 60일마다 **갱신하면 값이 바뀌고**, 워크플로는 GitHub Secret 을 스스로 고칠 수 없습니다 (따로 개인 접근 토큰이 있어야 함). → §10 결정 5.

## 7. 상태 머신

콘텐츠: `PLANNED → COLLECTING → RENDERING → COPYWRITING → QC → READY_FOR_APPROVAL → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED`
끝 · 예외: `REJECTED` · `FAILED` · `CANCELLED` · `EXPIRED`(승인 대기 72시간 초과)

- 허용 표에 없는 전환은 거부하고 로그에 남김. 다시 만들기(QC 불합격)는 `QC → RENDERING` 한 길만 허용, 최대 2번.
- 채널별 게시 상태는 콘텐츠 안에 따로: `PENDING → PUBLISHING → PUBLISHED | FAILED` (한 채널 실패가 다른 채널을 막지 않음). 콘텐츠의 `PUBLISHED` = 고른 채널 중 하나 이상 성공.
- 문구 · 이미지 · 영상 · 채널 · 게시 시각 중 하나라도 바뀌면 `version+1`, 승인 삭제, `READY_FOR_APPROVAL` 로 돌아감.
- 게시 직전 확인: 승인 상태 · 승인 버전 = 지금 버전 · 그 채널 오늘 상한 · `idem` 키 없음 · 플랫폼 한도(`content_publishing_limit`).
- 작업이 중간에 죽으면: 다음 실행이 `updatedAt` 이 오래된 제작 중 콘텐츠를 `FAILED`(사유: 작업 중단)로 정리. 게시 중이던 것은 저장해 둔 컨테이너 id 로 상태를 다시 물어 이어서 게시하거나 FAILED 처리 — **컨테이너 id · 게시 id 는 받는 즉시 저장**해서 재실행이 두 번 올리지 않게.

## 8. 승인 경로

**텔레그램 (PHASE 5).** 버튼: 승인 · 반려 · 문구 다시 만들기 · 다시 제작 · 게시 취소 · 채널 선택. 답장으로 보낸 글 = 문구 직접 수정(버전 +1, 승인 무효).
받는 방법 두 가지 → §10 결정 3.
- **웹훅** (`api/mkt-telegram.js`): 누르는 즉시 반영. 비밀 헤더 검증 · 허용 chat_id 만 · 같은 버튼은 `tg:done` 으로 한 번만. 단, **운영 사이트에 함수를 새로 배포**해야 함 (함수 7 → 8개).
- **폴링** (mkt-publish 가 30분마다 `getUpdates`): 사이트를 전혀 안 건드림. 대신 반영이 최대 30분(+ 크론 지연) 늦음.

**웹 관리자 (PHASE 9).** `mkt-admin/` + `api/mkt-admin.js`, `MKT_ADMIN_KEY` 로 로그인 → 모니터실처럼 열쇠를 받아 `Authorization` 헤더로만 보냄(쿠키를 안 쓰므로 다른 사이트가 대신 누르게 하는 CSRF 가 성립하지 않음, CORS 허용 없음). 텔레그램과 같은 상태 머신 + 콘텐츠 잠금으로 동시에 눌러도 한 번만 반영.

## 9. 유입 측정 (UTM)

링크: `?utm_source={channel}&utm_medium=organic&utm_campaign=todaygame_{kind}&utm_content={sourceId}`
- Vercel Web Analytics 의 UTM 집계는 Hobby 에서 안 됨.
- 지금 `api/plays.js` · `api/visits.js` 는 출처(UTM)를 기록하지 않음.
- **방법 A (기존 파일 수정 없음):** 새 함수 `api/mkt-go.js` — 프로필 링크 · 텔레그램 링크를 여기로 걸고, 누른 수를 `todaygame:mkt:clicks:{날짜}` 에 센 뒤 UTM 붙은 게임 주소로 보냄. **방문(클릭)까지** 셀 수 있음. 함수 1개 추가.
- **방법 B (기존 파일 수정 필요):** 게임 페이지가 `/api/plays` 에 보내는 값에 `src` 를 붙이고(`js/bgm.js`, `js/scores.js` 각 2줄), `api/plays.js` 가 출처별로 한 줄 더 기록 → **"게임 페이지를 연 것"까지** 출처별로 셈. → §10 결정 4.

## 10. 결정이 필요한 것 (관리자 답 필요)

| # | 결정 | 선택지 | 제안 |
|---|---|---|---|
| 1 | **3D 게임 녹화** (GPU 없는 러너에서 초당 2~5장) | ① **가상 시간 캡처**: 페이지의 시계를 1/30초씩 직접 넘기며 한 장씩 찍음. 게임 규칙 · 물리 · 봇은 그대로. 오래 걸리고 게임 소리는 못 씀 ② GitHub GPU 러너 (Team 조직 필요 · 분당 $0.052~0.07 · 저장소를 조직으로 옮겨야 함) ③ 3D 게임은 빼고 2D 게임부터 ④ **이 PC 가 켜져 있을 때 3D 녹화본을 미리 쌓아 두기** (관리자 제안, 아래 §11) ⑤ 이 PC 를 GitHub 셀프 호스트 러너로 등록 — GitHub 보안 문서가 "공개 저장소에는 거의 절대 쓰지 말라" 고 함 (남이 PR 로 이 PC 에서 코드를 돌릴 수 있음) | **④** (2D 는 지금처럼 GitHub Actions). ⑤ 는 쓰지 않음 |
| 2 | **녹화 방식** | ① 지시서대로 `recordVideo` (WebM VP8, 소리 없음, Playwright 전용 ffmpeg 필요) ② 커밋 안 된 `tools/game-reels` 의 CDP 화면 캡처(810×1440 JPEG) + 게임 원래 소리 녹음 재사용 | **②** — 이미 동작하고 화질 · 소리가 낫다. 원래 폴더의 커밋 안 된 파일을 `marketing/renderers/reel/` 로 가져오고, 발견한 버그를 고쳐야 하므로 승인 필요 |
| 3 | 텔레그램 받는 방법 | 웹훅(즉시, 사이트에 함수 배포) / 폴링(사이트 그대로, 최대 30분 늦음) | **PHASE 5 는 폴링**으로 사이트를 안 건드리고 검증 → 운영에 넣을 때 웹훅 |
| 4 | 유입 측정 | A 클릭만(새 함수) / A+B 게임 열기까지(기존 3개 파일 수정) | A 먼저, B 는 PHASE 10 에서 승인 받고 |
| 5 | 인스타 토큰 보관 | ① GitHub Secret 에만 + 관리자가 60일마다 직접 교체 ② 암호화해서 Redis 에 저장(열쇠 `MKT_TOKEN_KEY` 만 Secrets/Vercel 에) → 자동 갱신 가능 ③ 워크플로가 Secret 을 고칠 수 있게 개인 접근 토큰(PAT)을 따로 둠 | **②** — 지시서 문구와 다르므로 승인 필요 |
| 6 | 주간 랭킹(C5) | 이번 주(W45) 주간 기록: 12개 게임 중 **펄럭 병아리 1건뿐** → 거의 매주 "기록 부족"으로 안 만들어짐 | 편성표 월요일을 "기록이 기준(예: 게임당 5건) 넘을 때만 C5, 아니면 C1" 로 |
| 7 | 랭킹 닉네임 | 사이트에 나쁜 말 거르기가 없음 | 모든 닉네임을 일부 가림(예: `삐*이`) + 승인 화면에서 원래 이름도 보여 줌 |
| 8 | 기본 브랜치 · 예약 실행 | 예약(cron)은 **master 에 있는 워크플로만** 돔 → PHASE 5 "PC 꺼진 상태에서 자동 실행" 확인 전에 워크플로 파일이 master 에 있어야 함 | PHASE 5 에서 `feature/marketing` 에 push 할 때 도는 시험용 트리거로 먼저 확인 → 운영 예약은 master 병합 뒤 |
| 9 | 함수 개수 | Hobby 12개 중 7개 사용. 텔레그램 · 관리자 · 유입 = 3개 더하면 10개 | 그대로 진행 (남는 2개는 사이트용) |
| 10 | 문구 AI | 비어 있음 | Claude API (`LLM_API_KEY`). 모델은 관리자 선택 — 비용표 참고 |
| 11 | 공개 저장소의 로그 | Actions 로그는 누구나 봄 | 로그에 토큰 · 미디어 주소 · 승인 전 문구를 찍지 않음 (가림 처리) |

## 11. 3D 녹화본 재고 (결정 1 ④ 안)

GPU 가 있는 이 PC(RTX 3060, 3D 게임 60fps)가 **켜져 있을 때만** 3D 게임을 녹화해 "녹화본 재고" 로 올려 두고, 매일 아침 GitHub Actions 제작은 그 재고를 꺼내 편집합니다. PC 가 꺼져 있어도 매일 제작 · 승인 · 게시는 그대로 돌아갑니다.

```
[이 PC — 켜져 있을 때] Windows 작업 스케줄러 (로그온 시 + 몇 시간마다)
   → 깨끗한 master 사본 로컬 서버 → 3D 게임 녹화 (GPU, 실제 속도, 게임 소리 가능)
   → 원본 클립 · 메타(게임 · 녹화 시각 · 커밋 · fps · 길이)를 Blob + Redis `todaygame:mkt:clip:*` 재고에 등록
[GitHub Actions — 매일 08:00] Planner 가 오늘 3D 게임을 고르면 → 안 쓴 재고 클립이 있을 때만 사용 (없으면 2D 게임으로)
```

- 들어오는 연결이 필요 없음 (PC 가 바깥으로 올리기만). PC 에는 Redis · Blob 쓰기 열쇠가 `marketing/.env.local`(git 제외)에만 있음.
- 녹화는 원래 작업 폴더가 아니라 **깨끗한 master 사본**에서 (원래 폴더엔 다른 작업의 커밋 안 된 변경이 있음). 운영 사이트 녹화 금지 · `/api` 가짜 응답 · 서비스워커 차단 · 봇 치트 옵션 끔은 똑같이.
- 클립은 한 번 쓰면 `used` 표시 · 30일 지나면 삭제. 게임이 바뀌어(커밋이 달라져) 오래된 화면이 된 클립은 쓰지 않음.
- 재고가 바닥나면 텔레그램으로 "PC 를 켜면 3D 녹화가 채워집니다" 알림.
- 작업 스케줄러 등록은 이 PC 의 설정을 바꾸는 일이라 PHASE 3 에서 따로 승인 받음.
- 근거: GitHub 보안 문서 "self-hosted runners should almost never be used for public repositories" — https://docs.github.com/en/actions/reference/security/secure-use
