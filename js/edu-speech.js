/**
 * 교육 게임 공통 음성
 *
 * 휴대폰(특히 iOS)에서는 speechSynthesis / 외부 TTS가 자주 막혀서
 * 미리 만들어 둔 로컬 MP3(/assets/edu/voice)를 우선 재생한다.
 * 파일이 없을 때만 Web Speech로 폴백한다.
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

  const VOICE_BASE = "/assets/edu/voice/";
  const MANIFEST_URL = VOICE_BASE + "manifest.json?v=8";

  let speakTimer = null;
  let cachedVoice = null;
  let audioCtx = null;
  let lastStatus = "idle";
  let unlocked = false;
  let keepAliveTimer = null;
  /** @type {HTMLAudioElement | null} */
  let audioEl = null;
  /** @type {Record<string, string> | null} */
  let manifest = null;
  let manifestPromise = null;
  let playToken = 0;

  function isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  }

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

  function loadManifest() {
    if (manifest) return Promise.resolve(manifest);
    if (manifestPromise) return manifestPromise;
    manifestPromise = fetch(MANIFEST_URL, { cache: "force-cache" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        manifest = data && typeof data === "object" ? data : {};
        return manifest;
      })
      .catch(() => {
        manifest = {};
        return manifest;
      });
    return manifestPromise;
  }

  function resolveVoiceFile(text) {
    if (!manifest) return null;
    const raw = String(text || "").trim();
    if (!raw) return null;
    if (manifest[raw]) return manifest[raw];
    const clarified = clarifySpeech(raw);
    if (manifest[clarified]) return manifest[clarified];
    // "기역. 기역으로 ..." 앞 이름만으로라도 재생
    const name = clarified.split(/[.\s]/)[0];
    if (name && manifest[`${name}. ${name}`]) return manifest[`${name}. ${name}`];
    if (name && manifest[name]) return manifest[name];
    return null;
  }

  function ensureAudioEl() {
    if (audioEl) return audioEl;
    audioEl = new Audio();
    audioEl.preload = "auto";
    audioEl.setAttribute("playsinline", "true");
    audioEl.playsInline = true;
    return audioEl;
  }

  function stopAudio() {
    playToken += 1;
    if (!audioEl) return;
    try {
      audioEl.onended = null;
      audioEl.onerror = null;
      audioEl.pause();
      audioEl.removeAttribute("src");
      audioEl.load();
    } catch (_) {
      /* ignore */
    }
  }

  function playVoiceFile(file) {
    const el = ensureAudioEl();
    const token = ++playToken;
    const url = VOICE_BASE + file;
    return new Promise((resolve) => {
      const done = (ok) => {
        if (token !== playToken) return;
        lastStatus = ok ? "end" : "file-error";
        resolve(ok);
      };
      try {
        el.onended = () => done(true);
        el.onerror = () => done(false);
        el.src = url;
        el.currentTime = 0;
        const p = el.play();
        lastStatus = "start";
        if (p && typeof p.catch === "function") {
          p.catch(() => done(false));
        }
      } catch (_) {
        done(false);
      }
    });
  }

  function speakSynth(text) {
    if (!hasSynth()) return false;
    try {
      if (speechSynthesis.paused) speechSynthesis.resume();
      const utter = new SpeechSynthesisUtterance(clarifySpeech(text));
      utter.lang = "ko-KR";
      utter.rate = isMobile() ? 0.9 : 0.85;
      utter.pitch = 1;
      utter.volume = 1;
      const preferred = pickVoice();
      if (preferred) utter.voice = preferred;
      utter.onstart = () => {
        lastStatus = "start";
      };
      utter.onend = () => {
        lastStatus = "end";
      };
      utter.onerror = () => {
        lastStatus = "synth-error";
      };
      speechSynthesis.speak(utter);
      return true;
    } catch (_) {
      return false;
    }
  }

  function speakSoftly(text) {
    if (!text) return;
    if (speakTimer) {
      clearTimeout(speakTimer);
      speakTimer = null;
    }
    stopAudio();
    if (hasSynth()) {
      try {
        speechSynthesis.cancel();
      } catch (_) {
        /* ignore */
      }
    }

    if (!unlocked) unlock();

    const raw = String(text).trim();
    loadManifest().then((man) => {
      const file = resolveVoiceFile(raw);
      if (file) {
        playVoiceFile(file).then((ok) => {
          if (!ok && !isMobile()) speakSynth(raw);
        });
        return;
      }
      // 파일이 없으면 데스크톱만 synth 시도 (모바일 synth는 불안정)
      if (!isMobile()) speakSynth(raw);
      else {
        // 모바일: 이름만이라도 재생
        const clarified = clarifySpeech(raw);
        const name = clarified.split(/[.\s]/)[0];
        const fallbackFile = (man && (man[name] || man[`${name}. ${name}`])) || null;
        if (fallbackFile) playVoiceFile(fallbackFile);
        else lastStatus = "missing-voice";
      }
    });
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
    unlocked = true;
    pickVoice();
    loadManifest();

    const ctx = ensureAudio();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // iOS/Android: 제스처 안에서 Audio를 한 번 울려 재생 권한을 연다
    const el = ensureAudioEl();
    try {
      el.muted = true;
      el.src = VOICE_BASE + "unlock.mp3";
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          try {
            el.pause();
            el.currentTime = 0;
          } catch (_) {
            /* ignore */
          }
          el.muted = false;
        }).catch(() => {
          el.muted = false;
        });
      } else {
        el.muted = false;
      }
    } catch (_) {
      el.muted = false;
    }

    if (hasSynth()) {
      try {
        speechSynthesis.getVoices();
        if (speechSynthesis.paused) speechSynthesis.resume();
      } catch (_) {
        /* ignore */
      }
    }
  }

  // 미리 매니페스트·오디오 권한 준비
  loadManifest();
  if (hasSynth()) {
    try {
      speechSynthesis.getVoices();
      speechSynthesis.addEventListener("voiceschanged", () => {
        cachedVoice = null;
        pickVoice();
      });
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
    loadManifest,
  };
  if (window.TodayEdu) {
    TodayEdu.speakSoftly = speakSoftly;
    TodayEdu.ding = ding;
  }
})();
