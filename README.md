# 오늘의 게임

작고 귀여운 게임들을 모아두는 플레이룸입니다.

**플레이:** https://today-game.vercel.app

## 로컬 실행

```bash
npx serve .
```

## 공유 랭킹

플래피·테트리스(무한) 랭킹은 `/api/scores` 로 저장됩니다.

1. **권장:** Vercel에 Upstash Redis 연결
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
2. **폴백:** Upstash가 없으면 내장 JSONBlob 저장소를 사용합니다.

## 게임 추가

1. `games/` 아래에 게임 폴더를 넣습니다.
2. `js/main.js` 의 `GAMES` 배열에 항목을 추가합니다.
