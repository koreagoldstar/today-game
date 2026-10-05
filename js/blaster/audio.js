/*
 * 물총 대작전 엔진 · AudioSystem
 * 효과음과 배경음악을 전부 WebAudio 로 합성한다 (파일 다운로드 없음).
 * 사이트 공용 음소거(TodayAudio)는 AudioContext 를 감싸서 자동으로 적용된다.
 */
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  penta: [0, 2, 4, 7, 9],
  minorPenta: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

// 화음 진행 (음계 도수)
const PROGRESSIONS = {
  bright: [0, 4, 5, 3],
  calm: [0, 3, 0, 4],
  minor: [0, 5, 3, 4],
  boss: [0, 0, 5, 4],
  island: [0, 3, 4, 4],
};

export class AudioSystem {
  constructor(settings = {}) {
    this.sfxOn = settings.sfx !== false;
    this.musicOn = settings.music !== false;
    this.ctx = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noiseBuf = null;
    this.stream = null;
    this.music = null;
    this.lastPlay = {};
    this._onVis = () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", this._onVis);
  }

  /** 첫 터치/클릭 때 불러 주세요 (브라우저 자동재생 정책) */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (_) {
        return;
      }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      // 갑자기 큰 소리가 나지 않게 살짝 눌러 준다
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(c.destination);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.75 : 0;
      this.sfxBus.connect(this.master);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
      this.musicBus.connect(this.master);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(on ? 0.75 : 0, this.ctx.currentTime, 0.02);
    if (!on) this.streamOff();
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.05);
  }

  /* ---------- 합성 도구 ---------- */

  tone(freq, dur, { type = "sine", vol = 0.3, at = 0, attack = 0.005, slide = 0, bus = this.sfxBus, curve = 0.3 } = {}) {
    const c = this.ctx;
    if (!c || !bus) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.setTargetAtTime(0.0001, t + attack, dur * curve);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.3);
  }

  noise(dur, { vol = 0.3, at = 0, type = "lowpass", freq = 1200, to = 0, q = 0.8, attack = 0.004, bus = this.sfxBus } = {}) {
    const c = this.ctx;
    if (!c || !bus || !this.noiseBuf) return;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /* ---------- 효과음 ---------- */

  play(name, opt = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const now = performance.now();
    // 같은 소리가 한 프레임에 겹쳐 터지지 않게
    const gap = { fire: 55, splash: 40, hit: 35, drop: 60 }[name] || 25;
    if (now - (this.lastPlay[name] || 0) < gap) return;
    this.lastPlay[name] = now;
    const r = 1 + (Math.random() - 0.5) * 0.12;
    switch (name) {
      case "fire":
        this.noise(0.09, { vol: 0.16, type: "bandpass", freq: 2600 * r, to: 1400, q: 1.2 });
        this.tone(900 * r, 0.06, { type: "sine", vol: 0.05, slide: 1.6 });
        break;
      case "splash": {
        const big = opt.big ? 1.6 : 1;
        this.noise(0.28 * big, { vol: 0.32, type: "lowpass", freq: 3200, to: 500, q: 0.6 });
        for (let i = 0; i < 3; i++) this.tone((500 + Math.random() * 500) * r, 0.07, { vol: 0.07, at: 0.03 + i * 0.045, slide: 1.8 });
        break;
      }
      case "hit": // 덜 젖었을 때 '뽁'
        this.tone(620 * r, 0.09, { type: "sine", vol: 0.16, slide: 0.55 });
        this.noise(0.06, { vol: 0.08, type: "bandpass", freq: 1800, q: 2 });
        break;
      case "boing": // 젖어서 튕겨 나갈 때
        this.tone(220 * r, 0.28, { type: "triangle", vol: 0.18, slide: 2.6 });
        this.tone(330 * r, 0.22, { type: "sine", vol: 0.08, at: 0.05, slide: 2.2 });
        break;
      case "escape": // 슬라이드 휘슬 — 멀리 날아감
        this.tone(500 * r, 0.42, { type: "sine", vol: 0.12, slide: 3.2, curve: 0.6 });
        break;
      case "perfect":
        [0, 4, 7, 12].forEach((s, i) => this.tone(NOTE(84 + s), 0.18, { type: "triangle", vol: 0.12, at: i * 0.045 }));
        this.tone(NOTE(96), 0.4, { type: "sine", vol: 0.06, at: 0.18 });
        break;
      case "combo": {
        const n = Math.min(24, opt.n || 1);
        this.tone(NOTE(72 + (n % 12) + Math.floor(n / 12) * 12 * 0.5), 0.12, { type: "square", vol: 0.05 });
        this.tone(NOTE(79 + (n % 12)), 0.14, { type: "triangle", vol: 0.08, at: 0.04 });
        break;
      }
      case "multiplier":
        [0, 7, 12, 16].forEach((s, i) => this.tone(NOTE(76 + s), 0.16, { type: "square", vol: 0.05, at: i * 0.06 }));
        break;
      case "bonus":
        [0, 5, 12].forEach((s, i) => this.tone(NOTE(86 + s), 0.14, { type: "sine", vol: 0.12, at: i * 0.05 }));
        this.noise(0.25, { vol: 0.04, type: "highpass", freq: 7000, at: 0.05 });
        break;
      case "item":
        [0, 4, 7, 11, 14].forEach((s, i) => this.tone(NOTE(74 + s), 0.16, { type: "triangle", vol: 0.1, at: i * 0.04 }));
        break;
      case "boatHit":
        this.noise(0.4, { vol: 0.35, type: "lowpass", freq: 2200, to: 300 });
        this.tone(330, 0.35, { type: "triangle", vol: 0.14, slide: 0.5, at: 0.05 });
        break;
      case "shield":
        this.tone(1400 * r, 0.12, { type: "square", vol: 0.05, slide: 0.8 });
        this.tone(2100 * r, 0.1, { type: "sine", vol: 0.05 });
        break;
      case "pop": // 적 투사체 · 풍선
        this.tone(900 * r, 0.06, { type: "sine", vol: 0.14, slide: 0.4 });
        this.noise(0.08, { vol: 0.12, type: "highpass", freq: 2500 });
        break;
      case "throw":
        this.tone(300 * r, 0.16, { type: "triangle", vol: 0.07, slide: 1.8 });
        break;
      case "warn":
        this.tone(NOTE(81), 0.1, { type: "square", vol: 0.05 });
        this.tone(NOTE(81), 0.1, { type: "square", vol: 0.05, at: 0.14 });
        break;
      case "teleport":
        this.tone(1200 * r, 0.18, { type: "sine", vol: 0.08, slide: 0.3 });
        this.tone(400 * r, 0.18, { type: "sine", vol: 0.08, slide: 3, at: 0.1 });
        break;
      case "zap":
        this.noise(0.18, { vol: 0.12, type: "bandpass", freq: 4000, q: 4 });
        this.tone(160, 0.2, { type: "sawtooth", vol: 0.05, slide: 1.5 });
        break;
      case "freeze":
        [0, 3, 7, 12, 15].forEach((s, i) => this.tone(NOTE(88 + s), 0.25, { type: "sine", vol: 0.06, at: i * 0.03 }));
        break;
      case "bomb":
        this.noise(0.7, { vol: 0.45, type: "lowpass", freq: 1800, to: 180 });
        this.tone(110, 0.5, { type: "sine", vol: 0.28, slide: 0.5 });
        break;
      case "bossAppear":
        this.tone(NOTE(45), 0.9, { type: "sawtooth", vol: 0.09, curve: 0.5 });
        this.tone(NOTE(52), 0.9, { type: "sawtooth", vol: 0.07, at: 0.35, curve: 0.5 });
        this.tone(NOTE(57), 1.2, { type: "sawtooth", vol: 0.08, at: 0.7, curve: 0.6 });
        for (let i = 0; i < 8; i++) this.noise(0.05, { vol: 0.12, type: "bandpass", freq: 300, at: i * 0.07 });
        break;
      case "bossHit":
        this.tone(140 * r, 0.16, { type: "sine", vol: 0.24, slide: 0.6 });
        this.noise(0.14, { vol: 0.14, type: "lowpass", freq: 1500 });
        break;
      case "weak":
        this.tone(NOTE(88), 0.1, { type: "square", vol: 0.06 });
        this.tone(NOTE(95), 0.18, { type: "triangle", vol: 0.1, at: 0.05 });
        this.noise(0.2, { vol: 0.16, type: "lowpass", freq: 2600, to: 600 });
        break;
      case "super":
        this.noise(1.4, { vol: 0.4, type: "lowpass", freq: 3500, to: 200 });
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(NOTE(72 + s), 0.3, { type: "triangle", vol: 0.1, at: 0.2 + i * 0.07 }));
        break;
      case "clear":
        [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36], [7, 0.5], [12, 0.62]].forEach(([s, at]) =>
          this.tone(NOTE(72 + s), 0.24, { type: "square", vol: 0.06, at })
        );
        this.tone(NOTE(84), 0.8, { type: "triangle", vol: 0.12, at: 0.74, curve: 0.5 });
        break;
      case "rankS":
        [0, 4, 7, 11, 14, 19, 24].forEach((s, i) => this.tone(NOTE(76 + s), 0.3, { type: "triangle", vol: 0.1, at: i * 0.06 }));
        this.noise(0.6, { vol: 0.05, type: "highpass", freq: 6000, at: 0.3 });
        break;
      case "stamp":
        this.tone(90, 0.18, { type: "sine", vol: 0.3, slide: 0.6 });
        this.noise(0.12, { vol: 0.15, type: "lowpass", freq: 900 });
        break;
      case "fail":
        this.tone(NOTE(67), 0.2, { type: "triangle", vol: 0.1 });
        this.tone(NOTE(64), 0.2, { type: "triangle", vol: 0.1, at: 0.2 });
        this.tone(NOTE(60), 0.5, { type: "triangle", vol: 0.1, at: 0.4, slide: 0.8 });
        break;
      case "motor":
        this.noise(0.9, { vol: 0.12, type: "lowpass", freq: 400, to: 1400 });
        this.tone(80, 0.9, { type: "sawtooth", vol: 0.05, slide: 2 });
        break;
      case "click":
        this.tone(NOTE(84), 0.05, { type: "sine", vol: 0.12, slide: 1.3 });
        break;
      case "discover":
        [0, 7, 12, 16].forEach((s, i) => this.tone(NOTE(79 + s), 0.2, { type: "sine", vol: 0.1, at: i * 0.08 }));
        break;
      case "quack":
        this.tone(560 * r, 0.12, { type: "sawtooth", vol: 0.05, slide: 0.7 });
        this.tone(520 * r, 0.12, { type: "sawtooth", vol: 0.05, slide: 0.7, at: 0.13 });
        break;
      default:
        break;
    }
  }

  /** 누르고 있는 동안 나는 '쏴아' 물줄기 소리 */
  streamOn() {
    if (!this.ctx || !this.sfxOn || this.stream) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1900;
    f.Q.value = 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 0.06);
    // 물줄기가 출렁이는 느낌
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 9;
    lg.gain.value = 500;
    lfo.connect(lg);
    lg.connect(f.frequency);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start();
    lfo.start();
    this.stream = { src, g, lfo };
  }

  streamOff() {
    const s = this.stream;
    if (!s || !this.ctx) return;
    this.stream = null;
    const t = this.ctx.currentTime;
    s.g.gain.cancelScheduledValues(t);
    s.g.gain.setTargetAtTime(0.0001, t, 0.04);
    s.src.stop(t + 0.25);
    s.lfo.stop(t + 0.25);
  }

  /* ---------- 배경음악 (절차 생성 루프) ---------- */

  /**
   * mood: { bpm, root(MIDI), scale, prog, lead: 'marimba'|'steel'|'pluck'|'bell'|'flute', drums: 'soft'|'island'|'storm'|'boss'|'none', pad, seed }
   */
  playMusic(mood) {
    this.stopMusic();
    if (!this.ctx || !mood) return;
    const m = {
      bpm: 104,
      root: 60,
      scale: "major",
      prog: "bright",
      lead: "marimba",
      drums: "soft",
      pad: false,
      seed: 7,
      density: 0.55,
      ...mood,
    };
    const scale = SCALES[m.scale] || SCALES.major;
    const prog = PROGRESSIONS[m.prog] || PROGRESSIONS.bright;
    let seed = m.seed * 9301 + 49297;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    // 2마디짜리 멜로디 두 개(A, B)를 만들어 A A B A 로 돈다
    const makeMelody = () => {
      const out = [];
      let deg = 4 + Math.floor(rnd() * 3);
      for (let i = 0; i < 32; i++) {
        const strong = i % 4 === 0;
        if (rnd() < (strong ? m.density + 0.3 : m.density * 0.6)) {
          deg += Math.floor(rnd() * 5) - 2;
          deg = Math.max(0, Math.min(scale.length * 2, deg));
          out.push({ i, deg, len: rnd() < 0.25 ? 2 : 1 });
        }
      }
      return out;
    };
    const A = makeMelody();
    const B = makeMelody();
    const degToMidi = (deg, base) => {
      const oct = Math.floor(deg / scale.length);
      return base + scale[((deg % scale.length) + scale.length) % scale.length] + oct * 12;
    };
    const step = 60 / m.bpm / 4;
    const state = { m, nextT: this.ctx.currentTime + 0.12, i: 0, timer: 0 };
    const leadVoice = (freq, t, len) => {
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      const bus = this.musicBus;
      let vol = 0.11;
      let dec = 0.22;
      switch (m.lead) {
        case "steel":
          o.type = "triangle";
          vol = 0.1;
          dec = 0.35;
          break;
        case "pluck":
          o.type = "sawtooth";
          vol = 0.045;
          dec = 0.12;
          break;
        case "bell":
          o.type = "sine";
          vol = 0.12;
          dec = 0.6;
          break;
        case "flute":
          o.type = "sine";
          vol = 0.09;
          dec = 0.4;
          break;
        default:
          o.type = "sine";
          vol = 0.13;
          dec = 0.16;
      }
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (m.lead === "flute" ? 0.04 : 0.006));
      g.gain.setTargetAtTime(0.0001, t + 0.01, dec * len);
      let out = g;
      if (m.lead === "pluck") {
        const f = c.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.setValueAtTime(2600, t);
        f.frequency.exponentialRampToValueAtTime(500, t + 0.25);
        g.connect(f);
        out = f;
      }
      o.connect(g);
      out.connect(bus);
      o.start(t);
      o.stop(t + dec * len * 5 + 0.1);
      if (m.lead === "marimba" || m.lead === "steel" || m.lead === "bell") {
        // 배음 하나 더 — 실로폰/스틸드럼 느낌
        const o2 = c.createOscillator();
        const g2 = c.createGain();
        o2.type = "sine";
        o2.frequency.setValueAtTime(freq * (m.lead === "steel" ? 2.01 : m.lead === "bell" ? 2.76 : 4), t);
        g2.gain.setValueAtTime(vol * 0.3, t);
        g2.gain.setTargetAtTime(0.0001, t, 0.04);
        o2.connect(g2);
        g2.connect(bus);
        o2.start(t);
        o2.stop(t + 0.4);
      }
    };
    const schedule = () => {
      const c = this.ctx;
      if (!c) return;
      while (state.nextT < c.currentTime + 0.18) {
        const t = state.nextT;
        const i = state.i;
        const bar = Math.floor(i / 16) % 8; // 8마디 루프
        const s16 = i % 16;
        const chordDeg = prog[Math.floor(bar / 2) % prog.length];
        // 베이스
        if (s16 === 0 || s16 === 8 || (m.drums === "boss" && s16 % 4 === 0) || (m.drums === "island" && s16 === 11)) {
          const f = NOTE(degToMidi(chordDeg, m.root - 24));
          this.tone(f, step * 3, { type: m.drums === "boss" ? "sawtooth" : "triangle", vol: m.drums === "boss" ? 0.06 : 0.14, bus: this.musicBus, curve: 0.5 });
        }
        // 화음 패드 (조용한 장면)
        if (m.pad && s16 === 0 && bar % 2 === 0) {
          [0, 2, 4].forEach((k) =>
            this.tone(NOTE(degToMidi(chordDeg + k, m.root - 12)), step * 30, { type: "sine", vol: 0.035, attack: 0.4, bus: this.musicBus, curve: 0.8 })
          );
        }
        // 멜로디
        const phrase = bar < 4 ? A : bar < 6 ? B : A;
        const local = (bar % 2) * 16 + s16;
        const note = phrase.find((n) => n.i === local);
        if (note) leadVoice(NOTE(degToMidi(note.deg + chordDeg * 0, m.root)), t, note.len);
        // 반주 (화음 분산)
        if (m.lead !== "flute" && (s16 === 4 || s16 === 12)) {
          this.tone(NOTE(degToMidi(chordDeg + 2, m.root - 12)), step * 2, { type: "triangle", vol: 0.04, bus: this.musicBus });
          this.tone(NOTE(degToMidi(chordDeg + 4, m.root - 12)), step * 2, { type: "triangle", vol: 0.035, bus: this.musicBus });
        }
        // 드럼
        if (m.drums !== "none") {
          const kick = m.drums === "boss" ? s16 % 4 === 0 : s16 === 0 || s16 === 10;
          if (kick) this.tone(120, 0.16, { type: "sine", vol: m.drums === "soft" ? 0.12 : 0.2, slide: 0.35, bus: this.musicBus });
          if (s16 % 2 === 0) this.noise(0.03, { vol: s16 % 4 === 2 ? 0.035 : 0.018, type: "highpass", freq: 7500, bus: this.musicBus });
          if ((m.drums === "island" || m.drums === "boss" || m.drums === "storm") && (s16 === 4 || s16 === 12))
            this.noise(0.12, { vol: 0.07, type: "bandpass", freq: m.drums === "island" ? 900 : 1800, q: 1.4, bus: this.musicBus });
          if (m.drums === "island" && (s16 === 6 || s16 === 14)) this.tone(NOTE(79), 0.05, { type: "sine", vol: 0.05, bus: this.musicBus });
          if (m.drums === "storm" && s16 === 0 && bar % 4 === 3) this.noise(1.2, { vol: 0.06, type: "lowpass", freq: 300, bus: this.musicBus });
        }
        state.nextT += step;
        state.i++;
      }
    };
    schedule();
    state.timer = setInterval(schedule, 60);
    this.music = state;
  }

  stopMusic() {
    if (this.music) clearInterval(this.music.timer);
    this.music = null;
  }

  destroy() {
    this.stopMusic();
    this.streamOff();
    document.removeEventListener("visibilitychange", this._onVis);
  }
}
