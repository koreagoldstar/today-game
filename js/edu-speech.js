/**
 * 교육 게임 공통 TTS · 딩동
 *
 * 한글 자음·모음은 엔진이 "ㄱ"을 거의 안 읽으므로 기역/니은처럼 풀어 읽고,
 * 짧게 천천히, 높낮이는 보통으로 둔다.
 *
 * Chrome / iOS 주의:
 * - 첫 재생은 반드시 클릭/터치 핸들러 스택에서 speak() 해야 함
 * - unlock()에서 무음 프리임 + AudioContext resume
 * - cancel() 직후 바로 speak() 하면 먹통이 되므로 짧게 쉬고 다시 speak()
 * - speechSynthesis가 실패하면 번역 TTS(audio)로 폴백
 */
(() => {
  "use strict";

  const JAMO_SAY = {
    ㄱ: "기역",
    ㄲ: "쌍기역",
    ㄴ: "니은",
    ㄷ: "디귿",
    ㄸ: "쌍디귿",
    ㄹ: "리을",
    ㅁ: "미음",
    ㅂ: "비읍",
    ㅃ: "쌍비읍",
    ㅅ: "시옷",
    ㅆ: "쌍시옷",
    ㅇ: "이응",
    ㅈ: "지읒",
    ㅉ: "쌍지읒",
    ㅊ: "치읓",
    ㅋ: "키읔",
    ㅌ: "티읕",
    ㅍ: "피읖",
    ㅎ: "히읗",
    ㅏ: "아",
    ㅑ: "야",
    ㅓ: "어",
    ㅕ: "여",
    ㅗ: "오",
    ㅛ: "요",
    ㅜ: "우",
    ㅠ: "유",
    ㅡ: "으",
    ㅣ: "이",
    ㅐ: "애",
    ㅒ: "얘",
    ㅔ: "에",
    ㅖ: "예",
    ㅘ: "와",
    ㅙ: "왜",
    ㅚ: "외",
    ㅝ: "워",
    ㅞ: "웨",
    ㅟ: "위",
    ㅢ: "의",
  };
  const JAMO_NAMES = new Set(Object.values(JAMO_SAY));

  let speakTimer = null;
  let cachedVoice = null;
  let audioCtx = null;
  let lastStatus = "idle";
  let unlocked = false;
  let keepAliveTimer = null;
  /** @type {HTMLAudioElement | null} */
  let fallbackAudio = null;
  let preferFallback = false;

  function hasSynth() {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
  }

  function koVoices() {
    if (!hasSynth()) return [];
    return (speechSynthesis.getVoices() || []).filter((v) => v.lang && /^ko/i.test(v.lang));
  }

  function pickVoice() {
    if (cachedVoice && koVoices().includes(cachedVoice)) return cachedVoice;
    const voices = koVoices();
    const preferred =
      voices.find((v) => v.localService && /Heami|Hyemi|혜미|Yuna|SunHi|선희|female|여성/i.test(v.name)) ||
      voices.find((v) => v.localService) ||
      voices.find((v) => /^ko-KR/i.test(v.lang) && /Heami|Google|여성|female/i.test(v.name)) ||
      voices.find((v) => /^ko-KR/i.test(v.lang)) ||
      voices[0] ||
      null;
    cachedVoice = preferred;
    return preferred;
  }

  function clarifySpeech(text) {
    let s = String(text);
    s = s.replace(/([ㄱ-ㅎ])으로/g, (_, ch) => `${JAMO_SAY[ch] || ch}으로`);
    s = s.replace(/[ㄱ-ㅎㅏ-ㅣ]/g, (ch) => (JAMO_SAY[ch] ? `${JAMO_SAY[ch]} ` : ch));
    return s.replace(/[ \t]+/g, " ").replace(/ \./g, ".").trim();
  }

  function prepareSpeech(text) {
    const original = String(text).trim();
    let said = clarifySpeech(original);
    const compact = original.replace(/[\s.,!?]/g, "");
    const jamoOnly = /^[ㄱ-ㅎㅏ-ㅣ]+$/.test(compact);
    if (jamoOnly || JAMO_NAMES.has(said) || JAMO_NAMES.has(original)) {
      said = `${said}. ${said}`;
    }
    return { said, slow: jamoOnly || said.length <= 8 };
  }

  function stopFallback() {
    if (!fallbackAudio) return;
    try {
      fallbackAudio.onended = null;
      fallbackAudio.onerror = null;
      fallbackAudio.pause();
      fallbackAudio.removeAttribute("src");
      fallbackAudio.load();
    } catch (_) {
      /* ignore */
    }
    fallbackAudio = null;
  }

  function speakFallback(text) {
    stopFallback();
    const said = prepareSpeech(text).said;
    if (!said) return;
    // Google Translate TTS — Web Speech 미지원/실패 시 폴백 (아동 한글 학습용)
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ko&q=" +
      encodeURIComponent(said.slice(0, 80));
    const audio = new Audio();
    fallbackAudio = audio;
    audio.preload = "auto";
    audio.src = url;
    const play = () => {
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          lastStatus = "fallback-blocked";
        });
      }
    };
    audio.onended = () => {
      lastStatus = "end";
    };
    audio.onerror = () => {
      lastStatus = "fallback-error";
    };
    play();
  }

  function makeUtterance(text, slow) {
    const utter = new SpeechSynthesisUtterance(String(text));
    utter.lang = "ko-KR";
    utter.rate = slow ? 0.78 : 0.88;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    const preferred = pickVoice();
    if (preferred) utter.voice = preferred;
    utter.onstart = () => {
      lastStatus = "start";
    };
    utter.onend = () => {
      lastStatus = "end";
    };
    utter.onerror = (event) => {
      const err = (event && event.error) || "error";
      lastStatus = err;
      if (err === "canceled" || err === "interrupted") return;
      // 엔진/보이스 오류 → 폴백
      preferFallback = true;
      speakFallback(text);
    };
    return utter;
  }

  function playUtterance(utter) {
    if (!hasSynth()) {
      speakFallback(utter.text);
      return;
    }
    try {
      if (speechSynthesis.paused) speechSynthesis.resume();
      speechSynthesis.speak(utter);
      // 엔진이 완전히 무시하는 경우만 폴백 (시작 신호 없이 큐도 비면)
      window.setTimeout(() => {
        if (
          lastStatus === "idle" &&
          !speechSynthesis.speaking &&
          !speechSynthesis.pending
        ) {
          preferFallback = true;
          speakFallback(utter.text);
        }
      }, 500);
    } catch (_) {
      preferFallback = true;
      speakFallback(utter.text);
    }
  }

  function speakSoftly(text) {
    if (!text) return;
    if (speakTimer) {
      clearTimeout(speakTimer);
      speakTimer = null;
    }
    stopFallback();
    lastStatus = "idle";

    const { said, slow } = prepareSpeech(text);
    if (!said) return;

    if (!unlocked) unlock();

    if (preferFallback || !hasSynth()) {
      speakFallback(said);
      return;
    }

    const utter = makeUtterance(said, slow);
    const busy = speechSynthesis.speaking || speechSynthesis.pending;

    if (busy) {
      try {
        speechSynthesis.cancel();
      } catch (_) {
        /* ignore */
      }
      // cancel 직후 즉시 speak 하면 Chrome에서 무음이 됨
      speakTimer = window.setTimeout(() => playUtterance(utter), 160);
      return;
    }

    playUtterance(utter);
  }

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function ding() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const start = () => {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02 + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + i * 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + 0.4 + i * 0.05);
      });
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(start).catch(start);
      return;
    }
    start();
  }

  function startKeepAlive() {
    if (keepAliveTimer || !hasSynth()) return;
    // Chrome 장기 무음 버그 완화
    keepAliveTimer = window.setInterval(() => {
      try {
        if (!speechSynthesis.speaking) {
          speechSynthesis.pause();
          speechSynthesis.resume();
        }
      } catch (_) {
        /* ignore */
      }
    }, 12000);
  }

  function unlock() {
    unlocked = true;
    pickVoice();
    const ctx = ensureAudio();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    if (!hasSynth()) {
      preferFallback = true;
      return;
    }
    try {
      if (speechSynthesis.paused) speechSynthesis.resume();
    } catch (_) {
      /* ignore */
    }
    // 제스처 안에서 보이스 목록만 준비한다.
    // 여기서 speak() 하면 이어지는 본 음성이 busy/cancel 경로로 밀려
    // iOS/Chrome에서 무음이 될 수 있다.
    try {
      speechSynthesis.getVoices();
      if (speechSynthesis.paused) speechSynthesis.resume();
    } catch (_) {
      /* ignore */
    }
    startKeepAlive();
  }

  if (hasSynth()) {
    speechSynthesis.addEventListener("voiceschanged", () => {
      cachedVoice = null;
      pickVoice();
    });
    // 일부 브라우저는 이벤트 전에 getVoices()가 비어 있음
    try {
      speechSynthesis.getVoices();
    } catch (_) {
      /* ignore */
    }
  }

  window.speakSoftly = speakSoftly;
  window.TodayEduSpeak = {
    speakSoftly,
    ding,
    ensureAudio,
    unlock,
    pickVoice,
    lastStatus: () => lastStatus,
    useFallback: () => {
      preferFallback = true;
    },
  };
  if (window.TodayEdu) {
    TodayEdu.speakSoftly = speakSoftly;
    TodayEdu.ding = ding;
  }
})();
