# 집 PC 작업을 GitHub에 남기는 방법

Cloud Agent가 복구한 아이 교육(한글) 게임·음성 수정은 이미 GitHub에 있습니다.

- **브랜치:** `cursor/fix-edu-hangul-speech-1e8b`
- **PR:** https://github.com/koreagoldstar/today-game/pull/1

## 집에서 Cursor 열자마자

```bash
git fetch origin
git checkout cursor/fix-edu-hangul-speech-1e8b
git pull origin cursor/fix-edu-hangul-speech-1e8b
git status
```

집 PC에만 남은 파일이 보이면:

```bash
git add -A
git commit -m "chore: sync home PC edu hangul work"
git push -u origin cursor/fix-edu-hangul-speech-1e8b
```

## 규칙

- 작업 후 반드시 GitHub에 `push` (Vercel만 배포하지 말 것)
- 교육 게임 경로: `games/edu-*`, `js/edu-*.js`, `assets/edu/`
- 충돌 시 음성 수정(`js/edu-speech.js`)은 GitHub 버전을 유지하고, 집 전용 새 에셋만 추가


## 휴대폰 소리가 안 들릴 때

실사이트(`todaygame.co.kr`)는 집 PC에서 `vercel --prod`로 배포된 버전입니다.
GitHub에만 올린 수정은 자동으로 휴대폰에 반영되지 않습니다.

집 Cursor에서 프로덕션 배포:

```bash
git fetch origin
git checkout cursor/fix-edu-hangul-speech-1e8b
git pull
npx vercel --prod
```

교육 음성은 이제 `/assets/edu/voice/*.mp3` 로컬 파일로 재생됩니다 (휴대폰 TTS 차단 우회).
