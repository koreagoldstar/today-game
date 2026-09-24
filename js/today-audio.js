(() => {
  "use strict";

  if (window.TodayAudio) return;

  const KEY = "today-game-muted";
  const masters = [];
  const media = new Set();
  let muted = false;

  try {
    muted = localStorage.getItem(KEY) === "1";
  } catch (_) {
    muted = false;
  }

  const NativeConnect = typeof AudioNode !== "undefined" ? AudioNode.prototype.connect : null;

  function isMuted() {
    return muted;
  }

  function applyMaster(node) {
    if (!node || !node.gain) return;
    try {
      const ctx = node.context;
      const now = ctx && typeof ctx.currentTime === "number" ? ctx.currentTime : 0;
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(muted ? 0 : 1, now, 0.015);
    } catch (_) {
      try {
        node.gain.value = muted ? 0 : 1;
      } catch (__) {
        /* ignore */
      }
    }
  }

  function wrapContext(ctx) {
    if (!ctx || ctx.__todayMaster || !NativeConnect) return ctx;
    if (typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext) return ctx;
    try {
      const master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      NativeConnect.call(master, ctx.destination);
      ctx.__todayMaster = master;
      masters.push(master);
    } catch (_) {
      /* ignore */
    }
    return ctx;
  }

  function rememberVolume(el) {
    try {
      const vol = Number(el.volume);
      if (!muted && Number.isFinite(vol) && vol > 0) el.__todayVol = vol;
    } catch (_) {
      /* ignore */
    }
  }

  function applyMedia(el) {
    if (!el) return;
    try {
      rememberVolume(el);
      el.muted = muted;
      if (muted) {
        el.volume = 0;
      } else if (typeof el.__todayVol === "number") {
        el.volume = el.__todayVol;
      } else if (el.volume === 0) {
        el.volume = 0.9;
      }
    } catch (_) {
      /* ignore */
    }
  }

  function trackMedia(el) {
    if (!el || typeof el.play !== "function") return el;
    media.add(el);
    applyMedia(el);
    return el;
  }

  function scanMedia() {
    try {
      document.querySelectorAll("audio, video").forEach((el) => trackMedia(el));
    } catch (_) {
      /* ignore */
    }
  }

  function applyAll() {
    masters.forEach(applyMaster);
    media.forEach(applyMedia);
    scanMedia();
    if (muted && window.speechSynthesis) {
      try {
        speechSynthesis.cancel();
      } catch (_) {
        /* ignore */
      }
    }
    try {
      if (window.TodayBGM && TodayBGM.setMuted) TodayBGM.setMuted(muted);
    } catch (_) {
      /* ignore */
    }
    if (!muted) {
      try {
        if (window.TodayBGM && TodayBGM.start) {
          const id = document.body && document.body.getAttribute("data-bgm");
          if (id && id !== "rhythm") {
            TodayBGM.unlock && TodayBGM.unlock();
            TodayBGM.start(id);
          }
        }
      } catch (_) {
        /* ignore */
      }
    }
    try {
      window.dispatchEvent(new CustomEvent("todaygame-mute", { detail: { muted } }));
    } catch (_) {
      /* ignore */
    }
  }

  function setMuted(next) {
    muted = !!next;
    try {
      localStorage.setItem(KEY, muted ? "1" : "0");
    } catch (_) {
      /* ignore */
    }
    applyAll();
    return muted;
  }

  function toggle() {
    return setMuted(!muted);
  }

  if (NativeConnect) {
    AudioNode.prototype.connect = function todayConnect(dest, ...rest) {
      if (dest && this.context && dest === this.context.destination && this !== this.context.__todayMaster) {
        wrapContext(this.context);
        if (this.context.__todayMaster) {
          return NativeConnect.call(this, this.context.__todayMaster, ...rest);
        }
      }
      return NativeConnect.call(this, dest, ...rest);
    };
  }

  const NativeAC = window.AudioContext || window.webkitAudioContext;
  if (NativeAC && !NativeAC.__todayPatched) {
    const Patched = function TodayAudioContext(...args) {
      const ctx = new NativeAC(...args);
      wrapContext(ctx);
      return ctx;
    };
    Patched.prototype = NativeAC.prototype;
    try {
      Object.setPrototypeOf(Patched, NativeAC);
    } catch (_) {
      /* ignore */
    }
    Patched.__todayPatched = true;
    window.AudioContext = Patched;
    if (window.webkitAudioContext) window.webkitAudioContext = Patched;
  }

  const NativeAudio = window.Audio;
  if (NativeAudio && !NativeAudio.__todayPatched) {
    const PatchedAudio = function TodayMediaAudio(...args) {
      const el = new NativeAudio(...args);
      return trackMedia(el);
    };
    PatchedAudio.prototype = NativeAudio.prototype;
    try {
      Object.setPrototypeOf(PatchedAudio, NativeAudio);
    } catch (_) {
      /* ignore */
    }
    PatchedAudio.__todayPatched = true;
    window.Audio = PatchedAudio;
  }

  const nativeCreate = Document.prototype.createElement;
  if (nativeCreate && !Document.prototype.__todayCreatePatched) {
    Document.prototype.createElement = function todayCreateElement(tag, opts) {
      const el = nativeCreate.call(this, tag, opts);
      const name = String(tag || "").toLowerCase();
      if (name === "audio" || name === "video") trackMedia(el);
      return el;
    };
    Document.prototype.__todayCreatePatched = true;
  }

  if (typeof HTMLMediaElement !== "undefined" && HTMLMediaElement.prototype.play && !HTMLMediaElement.prototype.__todayPlayPatched) {
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function todayPlay(...args) {
      trackMedia(this);
      return nativePlay.apply(this, args);
    };
    HTMLMediaElement.prototype.__todayPlayPatched = true;
  }

  window.TodayAudio = {
    isMuted,
    setMuted,
    toggle,
    wrapContext,
    trackMedia,
  };
})();
