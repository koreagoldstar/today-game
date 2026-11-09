# 새 콘텐츠 유형 · 채널 추가하기 (플러그인 작성 가이드)

새 기능은 **파일 하나 + `register` 한 줄**로 붙습니다. 핵심 흐름(`core/pipeline.js` → 검수 → 승인 → `core/publisher.js`)은 고치지 않습니다.
등록 검사는 `core/registry.js` 가 합니다. 함수가 빠지면 시작할 때 바로 멈춥니다.

| 종류 | 꼭 있어야 하는 것 | 예 |
|---|---|---|
| source | `collect(ctx)` → `{ sourceType, sourceId, facts, assets }` | `sources/quiz.js` |
| renderer | `kinds[]` · `render(source, template, ctx)` → `{ kind, files[], meta }` · (선택) `qc(render, ctx)` → `checks[]` | `renderers/image/` |
| copywriter | `write({ source, render, channels, recent, ctx, contentId })` → `{ [채널]: { caption, hashtags, link, title? } }` | `copy/copywriter.js` |
| channel | `capabilities()` · `publish(item, { save })` · `verify(postId)` · `insights(postId)` · `health()` · (선택) `resume` · `comment` · `followers` | `channels/threads.js` |
| media | `put(file, { contentId })` → `{ url }` | `media/blob.js` |
| notifier | `notify(event, doc, extra)` | `approval/telegram.js` |

## 새 콘텐츠 유형 (예: "오늘의 명언")

1. **Source** `sources/quote.js`:
   - 사이트의 실제 데이터만 읽습니다. 사이트 파일은 `sources/site-data.js` 의 `read` · `literal` · `fn`, 운영 데이터는 GET 또는 `store.readSite`(허용한 키 모양만).
   - 자료가 모자라면 `throw Object.assign(new Error("이유"), { code: "NO_DATA" })` 를 던집니다. 실패 알림 없이 취소되고 편성표의 다음 유형으로 넘어갑니다.
   - `facts` 에 넣은 것만 문구 · 그림에 쓸 수 있습니다 (AI 사실 검사 근거).
2. **그리기:**
   - 이미지는 `renderers/image/templates.js` 에 템플릿 함수를 더하고 `renderers/image/index.js` 의 `KIND` · `pagesFor` 에 한 줄씩 넣습니다.
   - 피드 1080x1350 · 스토리 1080x1920 JPEG, Pretendard.
   - 넘칠 수 있는 글자는 `class="fit"` + 고정 높이로 둡니다. 줄여도 넘치면 검수에서 불합격됩니다.
3. **편성:**
   - `core/planner.js` 의 `TYPES` 에 `{ kind, renderer, sourceType, daily? }` 를 더합니다. `daily` 는 그날만 맞는 콘텐츠입니다.
   - `core/settings.js` 의 `FEED_TYPES` 또는 `STORY_TYPES` 에 이름을 넣습니다 (편성표 검증 · 웹 관리자 선택지).
4. **문구 틀:** `copy/copywriter.js` 의 `typeLines` · `TYPE_TAGS` 에 첫 줄 후보 · 본문을 넣습니다. facts 에 있는 것만 씁니다.
5. **등록:** `run.js` · `make.js` 의 source 목록에 이름을 넣습니다.
6. **시험:**
   - `node marketing/make.js quote` 로 실제로 그려 봅니다 (저장소 · 게시 없음).
   - `tests/` 에 Source 원문 그대로 · 자료 부족 · 렌더 검수 시험을 더합니다.

## 새 채널 (예: "X")

1. `channels/caps.js` 에 규격을 넣습니다: 받는 형식(`kinds`) · 글자 수 · 해시태그 수 · 영상 길이 · 크기 · 하루 한도. **공식 문서로 확인한 값**만 넣고 `docs/API_RESEARCH.md` 에 주소를 남깁니다.
2. `channels/x.js` 에서 `create({ env, store, fetchImpl })` 를 내보냅니다.
   - **공식 API 만** 씁니다. 비밀번호 로그인 · 브라우저 매크로는 쓰지 않습니다.
   - 오류는 `kind` 로 나눕니다: TOKEN · PERMISSION · RATE_LIMIT · MEDIA · INVALID · NETWORK. `retryable` 로 다시 시도 여부를 정합니다.
   - 플랫폼 id 를 받으면 바로 `save({ containerId | platformId })` 합니다. 끊겨도 `resume` 으로 이어 가고 두 번 올리지 않습니다.
   - 토큰은 오류 글 · 로그에 남기지 않습니다. 오래가는 토큰은 Secrets, 바뀌는 토큰은 `core/secret.js` 로 암호화해 저장소에 둡니다.
3. Mock 은 자동입니다: `channels/index.js` 가 `CAPS` 에 있는 채널마다 Mock 을 등록하고, `CHANNEL_MODE_X=live` 일 때만 실제 어댑터를 씁니다.
4. 설정: `core/settings.js` 의 `CHANNELS` · `DEFAULTS.dailyCaps` 에 더합니다. 문구 형식은 `copywriter.templateCopy` · AI 안내(`SYSTEM`)에 더합니다.
5. 시험: 가짜 플랫폼 서버로 게시 순서 · 오류 구분 · 비밀값 숨김 · 이어 하기를 확인합니다 (`tests/channels.test.js` 참고). 워크플로에 Secrets 이름을 더합니다.

## 지켜야 할 것

- 실제 게임 화면 · 실제 데이터만 씁니다. 지어낸 순위 · 기록 · 기능은 금지입니다.
- 승인된 버전만 게시합니다. 승인 뒤 바뀌는 값(문구 · 파일 · 채널 · 시각)은 `core/state.js invalidate` 를 거칩니다.
- 저장소 키는 `todaygame:mkt:` 앞머리만 씁니다 (`core/store.js` 가 강제). 사이트 데이터는 읽기만 합니다.
- 기존 사이트 파일은 고치지 않습니다. 꼭 필요하면 먼저 이유를 보고하고 승인받습니다.
