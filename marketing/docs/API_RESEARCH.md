# 채널별 공식 API 조사 (PHASE 1)

조사일: 2026-11-08. 아래 내용은 이날 공식 문서를 직접 읽어 확인한 것입니다. **"미확인"** 표시는 공식 문서에서 확인하지 못했다는 뜻이며, 해당 PHASE 에서 다시 확인한 뒤 구현합니다.

---

## 1. Instagram (필수)

문서
- 게시: https://developers.facebook.com/docs/instagram-platform/content-publishing
- 미디어 만들기 · 릴스 규격: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
- 성과: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights
- 로그인 · 토큰: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
- 댓글 → DM(비공개 답장): https://developers.facebook.com/docs/instagram-platform/private-replies

| 항목 | 확인한 내용 |
|---|---|
| 로그인 방식 | **Instagram 로그인** (`graph.instagram.com`) 권장. Facebook 페이지 연결이 필요 없음. Facebook 로그인 방식(`graph.facebook.com`)도 있음 |
| 계정 | Instagram **프로페셔널 계정**(비즈니스 · 크리에이터). 개인 계정은 불가 |
| 권한 (Instagram 로그인) | `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights` + 첫 댓글(퀴즈 정답) `instagram_business_manage_comments` — `POST graph.instagram.com/{media-id}/comments?message=` (라이브 영상에는 불가). 확인 2026-11-09: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/comments. 옛 이름 `business_*` 는 2025-01-27 부터 사용 중지 |
| 앱 검수 | 앱에 역할로 추가한 **우리 계정만** 쓰면 Standard Access 로 충분. 남의 계정까지 쓰려면 Advanced Access. 앱 검수 절차 이름은 문서에 없음 → PHASE 6 에서 실제로 확인 |
| 토큰 | 짧은 토큰(1시간) → `GET graph.instagram.com/access_token?grant_type=ig_exchange_token` (앱 비밀값 필요, 서버에서만) → **장기 토큰 60일**. 갱신 `GET /refresh_access_token?grant_type=ig_refresh_token`: 발급 후 24시간 이상 · 만료 전 · 60일 안에 갱신하지 않으면 영구 만료 |
| 게시 순서 | `POST /{ig-user-id}/media` (컨테이너) → `GET /{container}?fields=status_code` (EXPIRED · ERROR · FINISHED · IN_PROGRESS · PUBLISHED, **1분에 한 번씩 최대 5분** 확인 권장) → `POST /{ig-user-id}/media_publish` (`creation_id`) |
| 컨테이너 수명 | 24시간 안에 게시하지 않으면 EXPIRED |
| 게시 종류 | 이미지(**JPEG 만**), 릴스(`media_type=REELS`, `video_url`), 스토리(`media_type=STORIES`), 캐러셀(`media_type=CAROUSEL`, 자식 `is_carousel_item=true`, **최대 20장**, 모두 첫 장 비율로 잘림 · 기본 1:1) |
| 미디어 주소 | Meta 가 가져갈 수 있는 **공개 URL** 이어야 함. 큰 영상의 이어 올리기(`upload_type=resumable`)는 Facebook 로그인 방식 전용 |
| 릴스 규격 | MP4/MOV(moov 앞쪽, 편집 목록 없음) · H.264 또는 HEVC, 4:2:0, closed GOP · AAC 48kHz 이하 128kbps · 23~60fps · 가로 1920px 이하 · 9:16 권장 · **3초~15분** · 300MB 이하 · 커버 JPEG 8MB 이하 |
| 캡션 | 2,200자, 해시태그 30개, @언급 20개까지 |
| 게시 한도 | 24시간 이동 창에 **100건** (`media_publish` 기준). 같은 문서 캐러셀 항목에는 50건이라고 적혀 있어 서로 다름 → 게시 전에 `GET /{ig-user-id}/content_publishing_limit` 로 실제 남은 수를 확인하는 방식으로 구현 |
| 릴스 지표 | `views`(개발 중 표시), `reach`, `likes`, `comments`, `saved`, `shares`, `reposts`, `total_interactions`(개발 중), `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`, `reels_skip_rate` 등. `impressions` 는 2024-07-02 이후 게시물에 쓸 수 없음. 하나라도 지원되지 않으면 요청 전체가 오류가 날 수 있어 지표별로 나눠 다시 묻는 방식으로 구현 |
| 공식 API 로 안 되는 것 | 인기 음원 사용, 스토리 스티커 · 투표, 쇼핑 태그 · 필터 |
| 댓글 → DM | 비공개 답장: 댓글 단 사람에게 **DM 1통**, 댓글 뒤 **7일 안**. `comments` 웹훅 구독이 필요해 Vercel 함수가 하나 더 필요. 검수 필요 여부는 문서에 없음 → **보고만 하고 구현하지 않음** (지시서 9-5) |

## 2. Threads (선택)

문서: https://developers.facebook.com/docs/threads/posts

| 항목 | 확인한 내용 |
|---|---|
| 주소 | 문서 예시는 `https://graph.threads.com/v1.0/` |
| 게시 순서 | `POST /{threads-user-id}/threads` (`media_type` = TEXT · IMAGE · VIDEO) → **평균 30초 기다린 뒤** `POST /{threads-user-id}/threads_publish` (`creation_id`) |
| 권한 | `threads_basic`, `threads_content_publish` (성과는 `threads_manage_insights` — 미확인) |
| 한도 | 24시간에 **250건** (캐러셀은 1건) |
| 캐러셀 | 2~20장 (이미지 · 영상 섞기 가능) |
| 이미지 | JPEG 또는 PNG · 8MB · 가로 320~1440px · 비율 10:1 이하 |
| 영상 | MP4/MOV · H.264/HEVC · AAC 48kHz · 23~60fps · 가로 1920px 이하 · 9:16 권장 · **5분 이하** · 1GB 이하 |

## 3. Facebook 페이지 (선택)

문서: https://developers.facebook.com/docs/video-api/guides/reels-publishing

| 항목 | 확인한 내용 |
|---|---|
| 순서 | `POST /{page-id}/video_reels upload_phase=start` → `rupload.facebook.com/video-upload/{video-id}` 로 올리기 (`file_url` 로 공개 주소 전달 가능) → `upload_phase=finish`, `video_state=PUBLISHED` |
| 권한 | `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` + 페이지 토큰 (페이지에서 `CREATE_CONTENT` 가능한 사용자) |
| 규격 | 9:16, 1080×1920 권장(최소 540×960), **3~90초**, 24~60fps, MP4 권장 |
| 한도 | 24시간에 **30건** |
| 링크 게시물 | 피드 링크 게시는 이번 조사에서 문서를 읽지 않음 → **미확인** |

## 4. YouTube Shorts (선택)

문서: https://developers.google.com/youtube/v3/docs/videos/insert

| 항목 | 확인한 내용 |
|---|---|
| 업로드 | `videos.insert`, OAuth 범위 `youtube.upload` (또는 `youtube`, `youtube.force-ssl`) |
| 할당량 | 문서: "Video Uploads 할당량 묶음에서 1단위", "하루 100회" (2026년에 바뀐 방식으로 보임) |
| Shorts | 따로 된 API 없음. 세로 짧은 영상을 올리면 YouTube 가 Shorts 로 분류 (분류 기준 길이는 **미확인**) |
| 검수 안 된 API 프로젝트 | **문서와 다른 자료가 서로 다름.** 공식 페이지를 요약한 결과는 "비공개로 제한되지 않는다", 2026년 중반 외부 자료 여러 곳은 "2020-07-28 이후 만든 미검수 프로젝트는 비공개로 고정, 검수(audit) 필요". PHASE 8 에서 공식 문서 원문으로 다시 확인. 제한이 있으면 "비공개로 올린 뒤 관리자가 공개 전환" 으로 안내 |

## 5. 텔레그램 (승인 경로)

문서: https://core.telegram.org/bots/api

| 항목 | 확인한 내용 |
|---|---|
| 웹훅 보안 | `setWebhook` 의 `secret_token`(1~256자, A-Z a-z 0-9 _ -) → 모든 웹훅 요청에 헤더 `X-Telegram-Bot-Api-Secret-Token` 으로 옴 |
| 답장 받기 | `Message.reply_to_message` 로 어떤 메시지에 대한 답장인지 알 수 있음 (문구 직접 수정에 사용) |
| 파일 크기 (2026-11-09 확인) | sendVideo · sendDocument "up to 50 MB". 직접 올리기(multipart) 사진 10MB · 그 밖 50MB, 주소로 보내기 사진 5MB · 그 밖 20MB. 봇이 내려받기 20MB |
| 버튼 데이터 (확인) | `callback_data` "1-64 bytes". 누르면 `answerCallbackQuery` 를 부를 때까지 진행 표시 |
| 묶음 보내기 (확인) | `sendMediaGroup` "2-10 items" |
| 글자 수 (확인) | 본문 1~4096자, 캡션 0~1024자 |
| ForceReply (확인) | 받는 쪽에 "답장" 입력창을 띄움 → 반려 사유 · 문구 수정 받기에 사용 |
| getUpdates (확인) | offset = 받은 최대 update_id + 1 로 부르면 그 앞은 확인 처리. 서버 보관 **24시간**. **웹훅이 설정돼 있으면 동작 안 함** → 30분 폴링 방식(결정 3)은 24시간 안이라 안전 |

## 6. 실행 · 저장 환경

| 서비스 | 확인한 내용 | 문서 |
|---|---|---|
| GitHub Actions | 공개 저장소의 표준 러너는 **무료**. 큰 러너(GPU 포함)는 공개 저장소도 **유료**, Team · Enterprise 조직만 쓸 수 있음 | https://docs.github.com/en/billing/concepts/product-billing/github-actions |
| GitHub Actions 예약 | 최소 5분 간격 · 정각처럼 붐빌 때 **늦어질 수 있음** · 공개 저장소는 **60일 동안 활동이 없으면 예약이 꺼짐** · **기본 브랜치에 있는 워크플로만 예약 실행** · IANA 시간대 지정 가능 | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows |
| Vercel 함수 (Hobby) | 프레임워크 없이 `api/` 를 쓰면 **배포당 함수 12개까지** (지금 7개 사용) · 요청/응답 본문 4.5MB · 최대 300초 · 메모리 2GB | https://vercel.com/docs/functions/runtimes · https://vercel.com/docs/functions/limitations |
| Vercel Blob (Hobby) | 저장 1GB/월 · 전송 10GB · 단순 작업 1만 · 고급 작업(업로드 · 목록) 2,000 포함. **넘으면 돈은 안 나가지만 30일 동안 Blob 을 못 씀** | https://vercel.com/docs/vercel-blob/usage-and-pricing |
| Vercel Web Analytics | UTM 집계는 **Hobby 에서 안 됨** (Pro + Web Analytics Plus 월 $10) | https://vercel.com/docs/analytics/limits-and-pricing |
| Upstash Redis 무료 | 명령 월 50만 · 저장 250MB · 전송 10GB · 초과분 10만 명령당 $0.20 | https://upstash.com/pricing/redis |

## 7. 참고한 외부 자료 (공식 아님)

- 텔레그램 파일 크기: https://docs.rs/crate/actix-telegram/latest/target-redirect/x86_64-unknown-linux-gnu/actix_telegram/methods/struct.SendVideo.html , https://fast.io/resources/telegram-file-size-limit.md
- GitHub GPU 러너 요금 (분당 $0.052 또는 $0.07 — 서로 다름): https://docs.github.com/en/enterprise-cloud@latest/billing/reference/actions-runner-pricing , https://cicdcalculator.com/github-actions-larger-runners-pricing
- YouTube 미검수 프로젝트 제한: https://singhamandeep.com/youtube-shorts-api/ , https://postproxy.dev/blog/automate-youtube-uploads/
- 인스타 토큰 갱신 실무: https://bundle.social/blog/instagram-graph-api
