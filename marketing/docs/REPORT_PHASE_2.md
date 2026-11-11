# PHASE 2 보고 — 코어 뼈대

날짜 2026-11-08 · 브랜치 `feature/marketing` · 새 파일만 (`marketing/` 아래), **기존 파일 수정 0개** · 외부 계정 · 비용 없음

## 만든 것

| 파일 | 하는 일 |
|---|---|
| `core/state.js` | 상태 머신 (PLANNED → … → PUBLISHED, REJECTED · FAILED · CANCELLED · EXPIRED). 표에 없는 전환은 거부. 승인 무효(`invalidate`) · 72시간 만료 판단 |
| `core/store.js` | Upstash Redis REST. **키 앞머리 `todaygame:mkt:` 강제** (사이트 키는 읽지도 쓰지도 못함), 잠금, 콘텐츠 저장 · 목록 · 잠그고 고치기, 작업(job) · 로그 기록 |
| `core/logger.js` | 콘솔 + 저장소 로그. 이름에 TOKEN · SECRET · KEY 가 든 환경 변수 값, `access_token=`, `Bearer`, `"token":` 을 가림 |
| `core/settings.js` | 편성표 · 게시 시각(피드 19:00 · 스토리 08:30) · 채널별 하루 상한 · 승인 기한 72시간 · 재시도 · 검수 기준 · 허용 음원/폰트 목록. 값 확인 |
| `core/registry.js` | 플러그인 등록 (source · renderer · copywriter · channel · media · notifier). 필요한 함수가 없으면 등록 거부 |
| `core/qc.js` | 공통 검수: 결과 파일 · 직전 콘텐츠와 다른 파일(sha256) · 화면 속 이름 = 원본 · 허용 음원/폰트 · 채널별 형식 · 문구 · 글자 수 · 해시태그 수 · 링크가 사이트 주소 · 영상 길이/크기. 형식별 검수는 renderer.qc() 로 더함 |
| `core/pipeline.js` | 제작 흐름. 단계 전환은 잠금 안에서 짧게, 오래 걸리는 일은 밖에서. 그사이 취소되면 멈춤. 검수 불합격 → 최대 2번 다시 → FAILED. 관리자 요청(문구 다시 · 다시 제작) 이어서 처리 |
| `core/approval.js` | 승인 · 반려 · 문구 수정 · 다시 만들기 · 취소 · 채널 변경 · 시각 변경. **화면에서 본 버전을 같이 보내야 하고**, 다르면 거부 (텔레그램 · 웹 동시 조작 대비). 같은 날 같은 자리 상한 |
| `core/publisher.js` | 게시: 승인 버전 = 지금 버전 · 예약 시각 지남 · 채널별 하루 상한 · idempotency 키(`idem:{id}:{채널}:v{버전}`). 플랫폼 id 를 받는 즉시 저장 → 중간에 죽어도 다시 올리지 않고 이어서 완료. 재시도 3번 · 지수 백오프(15 → 30분). 채널별 상태 분리. 같은 실행에서 72시간 만료 · 멈춘 제작 정리. 전체 잠금으로 동시에 하나만 |
| `core/links.js` | UTM 링크 (`utm_source={채널}&utm_medium=organic&utm_campaign=todaygame_{kind}&utm_content={sourceId}`), 사이트 밖 주소 거부 |
| `channels/caps.js` · `mock.js` · `index.js` | 채널별 규격(공식 문서 값) · Mock 채널(컨테이너 → 게시 → 다시 조회를 흉내, 지표는 만들지 않음) · `CHANNEL_MODE_*` (기본 mock, live 인데 어댑터가 없으면 멈춤) |
| `tests/*` | 가짜 Upstash(메모리, 요청마다 0~3ms 엇갈림) + 시험 25개 |
| `package.json` · `.gitignore` · `.env.example` | 사이트와 분리된 모듈 설정, 비밀 · 결과물 제외, 환경 변수 이름 |

코드 1,041줄 + 시험 555줄.

## 실제 실행해서 확인한 것

명령: `cd marketing && npm test` (= `node --test "tests/*.test.js"`, Node 24) — **25개 모두 통과, 3번 연속 같은 결과**.

| 지시서 완료 조건 | 시험 | 결과 |
|---|---|---|
| 가짜 Source → 가짜 Renderer → QC → 승인 대기 → Mock 게시 | "제작 흐름…", "승인 → 예약 시각 전에는 게시 안 함 → … Mock 게시 + 다시 조회" | 통과. 기록이 PLANNED → COLLECTING → RENDERING → COPYWRITING → QC → READY_FOR_APPROVAL 순서 그대로 |
| 허용되지 않은 상태 전환 거부 | "허용되지 않은 전환은 거부된다" (단계 건너뛰기 · 승인 없이 게시 · 게시 중 취소 · 끝난 상태에서 이동 등) | 통과 |

그 밖에 통과한 것: 승인 없으면 시간이 지나도 게시 안 함 → 72시간 뒤 EXPIRED · 승인 뒤 문구 · 시각 · 채널 변경 → 승인 무효, 옛 버전 승인 거부 · 같은 게시를 두 번 · 동시에 돌려도 플랫폼 게시 1번 · 텔레그램 + 웹 동시 승인 → 1번만 반영 · 같은 날 같은 자리 하나만 · 검수 불합격 → 2번 다시 → FAILED · 한 채널 실패해도 다른 채널 게시 · 일시적 실패 백오프 뒤 성공 / 3번 넘으면 FAILED + 알림 · 게시 중 멈춤 → 다시 올리지 않고 완료 · 멈춘 제작 → FAILED · 문구 다시 만들기 → 이어서 승인 대기 · 저장소가 `todaygame:mkt:` 밖 키를 한 번도 안 씀 · 로그 비밀값 가림 · 설정 값 확인 · live 미구현 채널은 멈춤 · UTM 형식.

기존 파일: `git status` 로 `marketing/` 새 파일만 있음을 확인 → 사이트 회귀 시험은 돌릴 대상이 없어 이번엔 생략.

## 확인하지 못한 것

- **실제 Upstash** 에서는 아직 안 돌렸습니다 (시험은 메모리 가짜 Redis). 실제 저장소 연결은 PHASE 5.
- 잠금 풀기가 "확인 → 지우기" 두 번이라 잠금 시간(콘텐츠 60초 · 게시 25분)을 넘기는 작업이 있으면 남의 잠금을 지울 수 있음 — 코드에 `shortcut:` 표시. 게시 한 번은 25분 안에 끝나도록 PHASE 6 에서 시간 제한을 둠.
- GitHub Actions 에서 실행 (PHASE 5).

## 관리자 조치 필요

없음 (다음 PHASE 3 에서 이 PC 의 작업 스케줄러 등록 · 커밋 안 된 `tools/game-reels` 가져오기는 그때 다시 확인받음 — 결정 1 · 2 는 이미 승인).
