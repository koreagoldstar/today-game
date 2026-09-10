/**
 * 교육 게임 공통 TTS · 딩동
 *
 * 1) Vercel /api/speak 한국어 음성 (기기 음성팩 없어도 동일)
 * 2) 실패 시에만 브라우저 speechSynthesis
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
  const SILENT =
    "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

  let speakTimer = null;
  let cachedVoice = null;
  let audioCtx = null;
  let voiceAudio = null;
  let lastStatus = "idle";

  function koVoices() {
    if (!window.speechSynthesis) return [];
    return (speechSynthesis.getVoices() || []).filter((v) => v.lang && /^ko/i.test(v.lang));
  }

  function pickVoice() {
    if (cachedVoice) return cachedVoice;
    const voices = koVoices();
    const preferred =
      voices.find((v) => v.localService && /Heami|Hyemi|혜미|Yuna|SunHi|선희|female|여성/i.test(v.name)) ||
      voices.find((v) => v.localService) ||
      voices.find((v) => v.lang === "ko-KR" && /Heami|Google|여성|female/i.test(v.name)) ||
      voices.find((v) => v.lang === "ko-KR") ||
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

  function ensureVoiceAudio() {
    if (voiceAudio) return voiceAudio;
    voiceAudio = new Audio();
    voiceAudio.setAttribute("playsinline", "true");
    voiceAudio.setAttribute("webkit-playsinline", "true");
    voiceAudio.preload = "auto";
    return voiceAudio;
  }

  function makeUtterance(text, slow) {
    const utter = new SpeechSynthesisUtterance(String(text));
    utter.lang = "ko-KR";
    utter.rate = slow ? 0.75 : 0.85;
    utter.pitch = 1.15;
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
      lastStatus = (event && event.error) || "error";
      if (!event || event.error === "canceled" || event.error === "interrupted") return;
      if (utter.voice) {
        utter.voice = null;
        window.setTimeout(() => {
          try {
            speechSynthesis.speak(utter);
          } catch (_) {
            /* ignore */
          }
        }, 40);
      }
    };
    return utter;
  }

  function speakBrowser(text, slow) {
    if (!window.speechSynthesis || !text) return;
    const utter = makeUtterance(text, slow);
    const busy = speechSynthesis.speaking || speechSynthesis.pending;
    if (busy) {
      try {
        speechSynthesis.cancel();
      } catch (_) {
        /* ignore */
      }
      speakTimer = window.setTimeout(() => {
        try {
          if (speechSynthesis.paused) speechSynthesis.resume();
          speechSynthesis.speak(utter);
        } catch (_) {
          /* ignore */
        }
      }, 80);
      return;
    }
    try {
      if (speechSynthesis.paused) speechSynthesis.resume();
      speechSynthesis.speak(utter);
    } catch (_) {
      /* ignore */
    }
  }

  function speakServer(text, slow) {
    const audio = ensureVoiceAudio();
    try {
      audio.pause();
    } catch (_) {
      /* ignore */
    }
    audio.onplaying = () => {
      lastStatus = "start";
    };
    audio.onended = () => {
      lastStatus = "end";
    };
    audio.onerror = () => {
      lastStatus = "error";
      speakBrowser(text, slow);
    };
    audio.playbackRate = slow ? 0.88 : 0.96;
    audio.src = `/api/speak?q=${encodeURIComponent(text)}`;
    const play = audio.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => speakBrowser(text, slow));
    }
  }

  function speakSoftly(text) {
    if (!text) return;
    if (speakTimer) {
      clearTimeout(speakTimer);
      speakTimer = null;
    }
    try {
      if (window.speechSynthesis) speechSynthesis.cancel();
    } catch (_) {
      /* ignore */
    }
    const { said, slow } = prepareSpeech(text);
    speakServer(said, slow);
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

  function unlock() {
    pickVoice();
    const ctx = ensureAudio();
    if (ctx && ctx.state === "suspended") ctx.resume();
    const audio = ensureVoiceAudio();
    try {
      audio.src = SILENT;
      audio.play().catch(() => {});
    } catch (_) {
      /* ignore */
    }
    if (window.speechSynthesis && speechSynthesis.paused) {
      try {
        speechSynthesis.resume();
      } catch (_) {
        /* ignore */
      }
    }
  }

  if (window.speechSynthesis) {
    speechSynthesis.addEventListener("voiceschanged", () => {
      cachedVoice = null;
      pickVoice();
    });
  }

  window.speakSoftly = speakSoftly;
  window.TodayEduSpeak = {
    speakSoftly,
    ding,
    ensureAudio,
    unlock,
    pickVoice,
    lastStatus: () => lastStatus,
  };
  if (window.TodayEdu) {
    TodayEdu.speakSoftly = speakSoftly;
    TodayEdu.ding = ding;
  }
})();
