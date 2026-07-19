(() => {
  "use strict";

  // 서로 다른 파일만 사용 (중복 cyber/hip 제거)
  const ALL_TRACKS = [
    { src: "/assets/audio/hip/hip01.mp3", baseBpm: 150, label: "Electric Step" },
    { src: "/assets/audio/hip/hip02.mp3", baseBpm: 128, label: "Game Emulation" },
    { src: "/assets/audio/hip/hip03.mp3", baseBpm: 130, label: "Bouncer" },
    { src: "/assets/audio/hip/hip04.mp3", baseBpm: 126, label: "Funky House" },
    { src: "/assets/audio/hip/hip05.mp3", baseBpm: 134, label: "Liquid Flame" },
    { src: "/assets/audio/hip/cyber01.mp3", baseBpm: 138, label: "Cyber Beauty" },
    { src: "/assets/audio/hip/cyber02.mp3", baseBpm: 110, label: "Pynchon Rush" },
    { src: "/assets/audio/hip/cyber05.mp3", baseBpm: 128, label: "Oldskool" },
    { src: "/assets/audio/hip/cyber06.mp3", baseBpm: 132, label: "Approach" },
  ];

  // 게임마다 겹치지 않는 트랙 묶음
  const PACKS = {
    "beat-tap": [0, 1], // hip01–02
    "slide-beat": [2, 3], // hip03–04
    "dual-pad": [4, 5], // hip05 + cyber01
    rhythm: [6, 7, 8], // cyber02/05/06
    default: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  };

  const TITLE_POOLS = {
    "beat-tap": [
      "원버튼 스톰", "펄스 캐논", "탭 메가톤", "비트 펀치", "도파민 탭",
      "네온 원샷", "하이퍼 클릭", "제로 미스", "플래시 탭", "메가 펄스",
      "핑크 트리거", "볼트 탭", "슈퍼 클릭", "레이브 원샷", "울트라 탭",
      "글리치 펀치", "핫 트리거", "인피니티 탭", "레이저 원샷", "코어 펄스",
    ],
    "slide-beat": [
      "슬라이드 하이웨이", "가로 레이브", "레인 러시", "사이드 볼트", "스와이프 스톰",
      "네온 레일", "가로 캐논", "플릭 파티", "레일 브레이커", "슬라이드 붐",
      "핑크 레일", "메가 스와이프", "하이퍼 레인", "글리치 레일", "울트라 플릭",
      "서킷 슬라이드", "레이저 레인", "볼텍스 레일", "크롬 스와이프", "인피니티 레일",
    ],
    "dual-pad": [
      "듀얼 코어", "양손 레이브", "트윈 비트", "레프트 라이트", "페어 펀치",
      "미러 탭", "양손 스톰", "트윈 볼트", "더블 캐논", "시너지 드롭",
      "핑크 듀얼", "메가 트윈", "하이퍼 페어", "글리치 듀얼", "울트라 트윈",
      "서킷 페어", "레이저 듀얼", "볼텍스 트윈", "크롬 페어", "인피니티 듀얼",
    ],
    rhythm: [
      "네온 오버드라이브", "사이버 펄스", "그리드 러너", "홀로그램 레이브", "데이터 스톰",
      "핑크 와이어", "메가 바이트", "글리치 시티", "레이저 하이웨이", "나이트 서킷",
      "크로마 킥", "버추얼 레이브", "신스웨이브", "제로 쿨다운", "하이퍼 링크",
      "픽셀 애시드", "퀀텀 비트", "미러넷 러시", "볼트 댄서", "코어 멜트",
    ],
    default: [
      "도파민 드롭", "네온 하이", "애시드 러시", "클럽 그리드", "하이퍼 펀치",
      "비트 캐논", "핑크 볼트", "사이버 붐", "레이브 코어", "글리치 파티",
    ],
  };

  const SYNTH_STYLES = {
    "beat-tap": { scale: [65.41, 82.41, 98, 130.81, 164.81], lead: 880, kickGap: 4 },
    "slide-beat": { scale: [55, 73.42, 87.31, 110, 146.83], lead: 660, kickGap: 2 },
    "dual-pad": { scale: [49, 61.74, 73.42, 98, 123.47], lead: 990, kickGap: 4 },
    rhythm: { scale: [82.41, 98, 123.47, 164.81, 196], lead: 1320, kickGap: 4 },
    default: { scale: [55, 65.41, 73.42, 82.41, 98, 110], lead: 660, kickGap: 4 },
  };

  function tracksFor(packId) {
    const idx = PACKS[packId] || PACKS.default;
    return idx.map((i) => ALL_TRACKS[i]);
  }

  function mulberry32(a) {
    return function rand() {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * @param {number} count
   * @param {number} seed
   * @param {string} [packId]
   */
  function buildSongList(count, seed, packId = "default") {
    const tracks = tracksFor(packId);
    const titles = TITLE_POOLS[packId] || TITLE_POOLS.default;
    const rand = mulberry32(seed);
    const songs = [];
    for (let i = 0; i < count; i += 1) {
      const track = i % tracks.length;
      // 팩마다 배속 곡선도 다르게
      const rateBase = packId === "slide-beat" ? 1.12 : packId === "dual-pad" ? 1.18 : 1.22;
      const rate = Math.min(1.58, rateBase + (i % 7) * 0.04 + (i % 3) * 0.025);
      const bpm = Math.round(Math.min(182, Math.max(140, tracks[track].baseBpm * rate)));
      const diff = Math.min(5, 1 + Math.floor(i / 5) + (i % 4 === 3 ? 1 : 0));
      songs.push({
        id: i,
        name: titles[i % titles.length],
        bpm,
        rate,
        track,
        pack: packId,
        diff,
        bars: 12 + diff * 2 + Math.floor(rand() * 3),
        // 같은 파일이라도 시작 지점을 다르게
        offset: (i * 7.3 + seed % 11) % 28,
      });
    }
    return songs;
  }

  function createAudio(packId = "default") {
    const tracks = tracksFor(packId);
    const style = SYNTH_STYLES[packId] || SYNTH_STYLES.default;

    /** @type {AudioContext | null} */
    let ctx = null;
    /** @type {HTMLAudioElement | null} */
    let el = null;
    /** @type {GainNode | null} */
    let master = null;
    let startedAt = 0;
    let pausedAt = 0;
    let playing = false;
    let usingEl = false;
    let synthTimer = 0;
    let musicOffset = 0;

    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.85;
        master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function stopSynth() {
      if (synthTimer) {
        clearInterval(synthTimer);
        synthTimer = 0;
      }
    }

    function blip(freq, dur, type, gain) {
      const c = ensure();
      const t0 = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(gain || 0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }

    function kick() {
      const c = ensure();
      const t0 = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(160, t0);
      o.frequency.exponentialRampToValueAtTime(42, t0 + 0.14);
      g.gain.setValueAtTime(0.55, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + 0.2);
    }

    function snare() {
      const c = ensure();
      const t0 = c.currentTime;
      const buf = c.createBuffer(1, c.sampleRate * 0.12, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
      const src = c.createBufferSource();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 1800;
      src.buffer = buf;
      g.gain.setValueAtTime(0.28, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t0);
    }

    function hat() {
      blip(8800, 0.03, "square", 0.035);
    }

    function bass(freq) {
      const c = ensure();
      const t0 = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.16, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(900, t0);
      o.connect(f);
      f.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + 0.24);
    }

    function startSynth(bpm) {
      stopSynth();
      ensure();
      let step = 0;
      const ms = ((60 / bpm) * 1000) / 2;
      const scale = style.scale;
      synthTimer = setInterval(() => {
        if (!playing) return;
        const s = step % 16;
        if (s % style.kickGap === 0) kick();
        if (s === 4 || s === 12) snare();
        if (s % 2 === 1) hat();
        if (s % 4 === 0) bass(scale[(step / 4) % scale.length]);
        if (s === 2 || s === 10) blip(style.lead + (step % 5) * 60, 0.08, "square", 0.07);
        if (s === 6 || s === 14) blip(style.lead * 0.75, 0.06, "triangle", 0.05);
        step += 1;
      }, ms);
    }

    async function playTrack(trackIndex, rate, offsetSec) {
      ensure();
      stop();
      const meta = tracks[trackIndex % tracks.length];
      playing = true;
      startedAt = performance.now();
      pausedAt = 0;
      usingEl = true;
      musicOffset = Math.max(0, Number(offsetSec) || 0);
      el = new Audio(meta.src);
      el.crossOrigin = "anonymous";
      el.loop = true;
      el.playbackRate = rate;
      el.volume = 0.9;
      try {
        el.currentTime = musicOffset;
        await el.play();
        startedAt = performance.now();
        return true;
      } catch (_) {
        usingEl = false;
        el = null;
        startSynth(Math.round(meta.baseBpm * rate));
        return false;
      }
    }

    function stop() {
      playing = false;
      stopSynth();
      if (el) {
        el.pause();
        el.src = "";
        el = null;
      }
      startedAt = 0;
      pausedAt = 0;
    }

    function now() {
      if (!playing) return pausedAt;
      return (performance.now() - startedAt) / 1000;
    }

    function sfxHit(kind) {
      ensure();
      if (kind === "perfect") {
        blip(1320, 0.07, "sine", 0.14);
        blip(1980, 0.05, "triangle", 0.08);
      } else if (kind === "good") {
        blip(880, 0.06, "triangle", 0.1);
      } else if (kind === "miss") {
        blip(120, 0.12, "sawtooth", 0.08);
      } else {
        blip(640, 0.04, "square", 0.06);
      }
    }

    return {
      TRACKS: tracks,
      ensure,
      playTrack,
      stop,
      now,
      sfxHit,
      get playing() {
        return playing;
      },
    };
  }

  window.HipCore = {
    TRACKS: ALL_TRACKS,
    PACKS,
    TITLE_POOL: TITLE_POOLS.default,
    mulberry32,
    buildSongList,
    createAudio,
    tracksFor,
  };
})();
