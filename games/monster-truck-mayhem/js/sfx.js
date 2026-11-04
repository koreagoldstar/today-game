/* 소리: 파일 없이 전부 합성. 전체 음소거는 공용 today-audio 가 AudioContext 에서 처리한다 */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Sfx {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.engine = null;
    this.music = null;
    this.lastPlay = new Map();
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createDynamicsCompressor();
      this.master.threshold.value = -14;
      this.master.ratio.value = 5;
      this.master.connect(c.destination);
      this.bus = c.createGain();
      this.bus.gain.value = this.sfxOn ? 0.9 : 0;
      this.bus.connect(this.master);
      this.mbus = c.createGain();
      this.mbus.gain.value = this.musicOn ? 0.2 : 0;
      this.mbus.connect(this.master);
      const len = c.sampleRate * 2;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.bus) this.bus.gain.value = on ? 0.9 : 0;
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.mbus) this.mbus.gain.value = on ? 0.2 : 0;
  }

  suspend(off) {
    if (!this.ctx) return;
    if (off) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  /** 너무 자주 겹치지 않게 */
  gate(key, ms) {
    if (!this.ctx) return false;
    const now = performance.now();
    if (now - (this.lastPlay.get(key) || 0) < ms) return false;
    this.lastPlay.set(key, now);
    return true;
  }

  burst({ dur = 0.2, freq = 1000, q = 1, type = "bandpass", gain = 0.5, sweep = 0, attack = 0.002, dest }) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random();
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweep), t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest || this.bus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  tone({ dur = 0.2, freq = 440, to = 0, type = "sine", gain = 0.3, attack = 0.003, delay = 0, dest }) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /* ---------- 엔진 ---------- */
  engineStart(def) {
    if (!this.ctx) return;
    this.engineStop();
    const c = this.ctx;
    const pitch = def.engine || 1;
    this.tone({ dur: 0.5, freq: 40 * pitch, to: 110 * pitch, type: "sawtooth", gain: 0.28 });
    this.burst({ dur: 0.45, freq: 500, sweep: 1500, q: 0.6, gain: 0.16 });
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500;
    lp.Q.value = 2.2;
    const gain = c.createGain();
    gain.gain.value = 0;
    const o1 = c.createOscillator();
    o1.type = "sawtooth";
    const o2 = c.createOscillator();
    o2.type = "square";
    const g2 = c.createGain();
    g2.gain.value = 0.52;
    const lfo = c.createOscillator();
    lfo.frequency.value = 17;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.12;
    lfo.connect(lfoG).connect(gain.gain);
    o1.connect(lp);
    o2.connect(g2).connect(lp);
    lp.connect(gain).connect(this.bus);
    o1.start();
    o2.start();
    lfo.start();
    // 타이어 끌림
    const scr = c.createBufferSource();
    scr.buffer = this.noise;
    scr.loop = true;
    const scrF = c.createBiquadFilter();
    scrF.type = "bandpass";
    scrF.frequency.value = 1650;
    scrF.Q.value = 3.2;
    const scrG = c.createGain();
    scrG.gain.value = 0;
    scr.connect(scrF).connect(scrG).connect(this.bus);
    scr.start();
    // 바람 · 땅 소리
    const wind = c.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const windF = c.createBiquadFilter();
    windF.type = "lowpass";
    windF.frequency.value = 500;
    const windG = c.createGain();
    windG.gain.value = 0;
    wind.connect(windF).connect(windG).connect(this.bus);
    wind.start();
    // 부스터
    const bst = c.createBufferSource();
    bst.buffer = this.noise;
    bst.loop = true;
    const bstF = c.createBiquadFilter();
    bstF.type = "bandpass";
    bstF.frequency.value = 900;
    bstF.Q.value = 0.8;
    const bstG = c.createGain();
    bstG.gain.value = 0;
    bst.connect(bstF).connect(bstG).connect(this.bus);
    bst.start();
    this.engine = { o1, o2, lfo, lp, gain, scr, scrG, wind, windF, windG, bst, bstG, pitch, rev: 0, nodes: [o1, o2, lfo, scr, wind, bst] };
  }

  engineUpdate(dt, { speedK = 0, throttle = 0, boost = false, slip = 0, air = false, idle = false }) {
    const e = this.engine;
    if (!e) return;
    const c = this.ctx;
    const t = c.currentTime;
    const want = idle ? 0.1 : clamp(speedK * 0.82 + throttle * 0.22 + (air ? throttle * 0.28 : 0), 0, 1.15);
    e.rev += (want - e.rev) * Math.min(1, dt * 5);
    // 기어 단수처럼 음높이가 오르내린다
    const gears = 4;
    const g = Math.min(gears - 1, Math.floor(e.rev * gears));
    const inGear = e.rev * gears - g;
    const f = (36 + (g * 14 + inGear * 56)) * e.pitch;
    e.o1.frequency.setTargetAtTime(f, t, 0.04);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
    e.lp.frequency.setTargetAtTime(340 + e.rev * 1500 + throttle * 300, t, 0.06);
    e.gain.gain.setTargetAtTime(0.13 + throttle * 0.08 + e.rev * 0.08, t, 0.08);
    e.scrG.gain.setTargetAtTime(air ? 0 : clamp(slip * 0.26, 0, 0.2), t, 0.06);
    e.windF.frequency.setTargetAtTime(240 + speedK * 1000, t, 0.1);
    e.windG.gain.setTargetAtTime(clamp(speedK * speedK * 0.14, 0, 0.13), t, 0.1);
    e.bstG.gain.setTargetAtTime(boost ? 0.28 : 0, t, 0.05);
  }

  engineStop() {
    const e = this.engine;
    if (!e) return;
    for (const n of e.nodes) {
      try {
        n.stop();
      } catch (_) {
        /* 이미 멈춤 */
      }
    }
    e.gain.disconnect();
    e.scrG.disconnect();
    e.windG.disconnect();
    e.bstG.disconnect();
    this.engine = null;
  }

  /* ---------- 충돌 ---------- */
  material(mat, power = 0.6, vol = 1) {
    if (!this.ctx) return;
    const k = clamp(power, 0.15, 1) * vol;
    if (k <= 0.02) return;
    if (mat === "wood") {
      if (!this.gate("wood", 40)) return;
      this.burst({ dur: 0.16, freq: 900 + Math.random() * 500, q: 1.6, gain: 0.6 * k });
      this.tone({ dur: 0.12, freq: 210 + Math.random() * 90, to: 90, type: "triangle", gain: 0.45 * k });
      this.burst({ dur: 0.1, freq: 2600, q: 3, gain: 0.25 * k });
    } else if (mat === "metal" || mat === "car") {
      if (!this.gate("metal", 50)) return;
      this.burst({ dur: 0.26, freq: 1500, sweep: 500, q: 2.4, gain: 0.55 * k });
      this.tone({ dur: 0.32, freq: 330 + Math.random() * 240, to: 190, type: "square", gain: 0.14 * k });
      this.tone({ dur: 0.44, freq: 880 + Math.random() * 480, to: 640, type: "triangle", gain: 0.12 * k });
      this.tone({ dur: 0.18, freq: 74, to: 36, type: "sine", gain: 0.55 * k });
    } else if (mat === "glass") {
      if (!this.gate("glass", 60)) return;
      for (let i = 0; i < 7; i += 1) this.tone({ dur: 0.1 + Math.random() * 0.2, freq: 2600 + Math.random() * 4200, type: "sine", gain: 0.1 * k, delay: Math.random() * 0.14 });
      this.burst({ dur: 0.26, freq: 5600, q: 1, gain: 0.34 * k, type: "highpass" });
    } else if (mat === "stone") {
      if (!this.gate("stone", 60)) return;
      this.burst({ dur: 0.24, freq: 460, q: 0.9, gain: 0.62 * k, type: "lowpass" });
      this.tone({ dur: 0.16, freq: 96, to: 44, gain: 0.62 * k });
    } else if (mat === "rubber") {
      if (!this.gate("rubber", 60)) return;
      this.tone({ dur: 0.2, freq: 140, to: 56, type: "triangle", gain: 0.55 * k });
      this.burst({ dur: 0.1, freq: 300, q: 1, gain: 0.3 * k });
    } else if (mat === "ice") {
      if (!this.gate("ice", 60)) return;
      for (let i = 0; i < 5; i += 1) this.tone({ dur: 0.14, freq: 1800 + Math.random() * 2600, type: "triangle", gain: 0.1 * k, delay: Math.random() * 0.1 });
      this.burst({ dur: 0.2, freq: 3200, q: 1.1, gain: 0.26 * k });
    } else if (mat === "snow") {
      if (!this.gate("snow", 60)) return;
      this.burst({ dur: 0.24, freq: 780, q: 0.6, gain: 0.34 * k, type: "lowpass" });
    } else {
      if (!this.gate("plastic", 40)) return;
      this.burst({ dur: 0.1, freq: 1300, q: 1.6, gain: 0.4 * k });
      this.tone({ dur: 0.08, freq: 420, to: 240, type: "triangle", gain: 0.24 * k });
    }
  }

  explosion(vol = 1) {
    if (!this.gate("boom", 70)) return;
    this.tone({ dur: 0.75, freq: 104, to: 26, type: "sine", gain: 0.95 * vol, attack: 0.004 });
    this.burst({ dur: 0.9, freq: 2400, sweep: 110, q: 0.6, gain: 0.82 * vol, type: "lowpass" });
    this.burst({ dur: 0.22, freq: 3600, q: 0.6, gain: 0.34 * vol });
  }

  crush(vol = 1) {
    if (!this.gate("crush", 60)) return;
    this.burst({ dur: 0.34, freq: 950, sweep: 320, q: 1.6, gain: 0.7 * vol });
    this.tone({ dur: 0.22, freq: 92, to: 44, type: "square", gain: 0.24 * vol });
    for (let i = 0; i < 3; i += 1) this.tone({ dur: 0.1, freq: 500 + Math.random() * 900, type: "square", gain: 0.05 * vol, delay: i * 0.05 });
  }

  jump() {
    if (!this.gate("jump", 100)) return;
    this.tone({ dur: 0.26, freq: 130, to: 340, type: "triangle", gain: 0.26 });
    this.burst({ dur: 0.2, freq: 420, q: 0.8, gain: 0.34 });
  }

  land(power) {
    if (!this.gate("land", 90)) return;
    const k = clamp(power, 0.15, 1);
    this.tone({ dur: 0.3, freq: 80, to: 30, gain: 0.95 * k });
    this.burst({ dur: 0.3, freq: 620, sweep: 150, q: 0.7, gain: 0.62 * k, type: "lowpass" });
    this.tone({ dur: 0.16, freq: 340, to: 180, type: "triangle", gain: 0.12 * k, delay: 0.06 });
  }

  wall(power) {
    if (!this.gate("wall", 100)) return;
    const k = clamp(power, 0.2, 1);
    this.burst({ dur: 0.2, freq: 700, q: 1, gain: 0.56 * k });
    this.tone({ dur: 0.16, freq: 96, to: 46, type: "square", gain: 0.2 * k });
  }

  fuse() {
    if (!this.gate("fuse", 120)) return;
    this.burst({ dur: 0.36, freq: 5000, q: 2.6, gain: 0.16 });
  }

  creak() {
    if (!this.gate("creak", 240)) return;
    this.tone({ dur: 0.5, freq: 220, to: 124, type: "sawtooth", gain: 0.06 });
    this.tone({ dur: 0.5, freq: 330, to: 170, type: "square", gain: 0.03, delay: 0.1 });
  }

  boostKick() {
    if (!this.gate("kick", 140)) return;
    this.burst({ dur: 0.4, freq: 500, sweep: 2600, q: 0.8, gain: 0.5 });
    this.tone({ dur: 0.36, freq: 160, to: 620, type: "sawtooth", gain: 0.12 });
  }

  combo(tier) {
    const base = 440 * Math.pow(2, Math.min(4, tier) * (3 / 12));
    [0, 4, 7, 12].forEach((s, i) => this.tone({ dur: 0.2, freq: base * Math.pow(2, s / 12), type: "square", gain: 0.1, delay: i * 0.055 }));
    this.tone({ dur: 0.34, freq: base * 2, type: "triangle", gain: 0.16, delay: 0.2 });
  }

  stunt(bad) {
    if (bad) {
      this.tone({ dur: 0.34, freq: 240, to: 90, type: "sawtooth", gain: 0.14 });
      return;
    }
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ dur: 0.24, freq: f, type: "triangle", gain: 0.17, delay: i * 0.07 }));
  }

  success() {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ dur: 0.3, freq: f, type: "square", gain: 0.09, delay: i * 0.09 }));
    this.tone({ dur: 0.7, freq: 1047, type: "triangle", gain: 0.2, delay: 0.54 });
    for (let i = 0; i < 4; i += 1) setTimeout(() => this.burst({ dur: 0.18, freq: 2500, q: 0.7, gain: 0.16 }), 120 + i * 140);
  }

  fail() {
    [392, 330, 262, 196].forEach((f, i) => this.tone({ dur: 0.3, freq: f, type: "sawtooth", gain: 0.1, delay: i * 0.15 }));
  }

  click() {
    this.tone({ dur: 0.07, freq: 780, to: 520, type: "triangle", gain: 0.2 });
    this.tone({ dur: 0.05, freq: 120, type: "square", gain: 0.1 });
  }

  buy() {
    [660, 880, 1320].forEach((f, i) => this.tone({ dur: 0.14, freq: f, type: "square", gain: 0.1, delay: i * 0.07 }));
  }

  count(go) {
    this.tone({ dur: go ? 0.5 : 0.2, freq: go ? 880 : 440, type: "square", gain: 0.16 });
  }

  /* ---------- 음악: 거친 록 반복 ---------- */
  startMusic(world = 0) {
    if (!this.ctx) return;
    this.stopMusic();
    const song = SONGS[world % SONGS.length];
    const bpm = song.bpm;
    const step = 60 / bpm / 4;
    let t = this.ctx.currentTime + 0.1;
    let i = 0;
    const self = this;
    const hit = {
      k(at) {
        self.mTone(at, 0.2, 118, 38, "sine", 0.85);
      },
      s(at) {
        self.mNoise(at, 0.16, 1900, 0.55);
        self.mTone(at, 0.09, 190, 120, "triangle", 0.28);
      },
      h(at, open) {
        self.mNoise(at, open ? 0.12 : 0.03, 7400, 0.16);
      },
    };
    const tick = () => {
      if (!this.music) return;
      const c = this.ctx;
      if (c.state === "suspended") return;
      while (t < c.currentTime + 0.4) {
        const n = i % 16;
        const bar = Math.floor(i / 16) % song.roots.length;
        const root = song.roots[bar];
        if (song.kick[n] === "x") hit.k(t);
        if (song.snare[n] === "x") hit.s(t);
        if (n % 2 === 0) hit.h(t, n % 8 === 6);
        const b = song.bass[n];
        if (b !== ".") {
          const f = 55 * Math.pow(2, (root + (b === "x" ? 0 : Number(b))) / 12);
          this.mTone(t, step * 0.92, f, 0, "sawtooth", 0.3, 520);
          this.mTone(t, step * 0.92, f * 1.5, 0, "square", 0.08, 760);
        }
        t += step;
        i += 1;
      }
    };
    this.music = { timer: setInterval(tick, 120) };
    tick();
  }

  mTone(at, dur, f0, f1, type, gain, lp) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    if (lp) {
      const fl = c.createBiquadFilter();
      fl.type = "lowpass";
      fl.frequency.value = lp;
      o.connect(fl).connect(g);
    } else o.connect(g);
    g.connect(this.mbus);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  mNoise(at, dur, f, gain) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const fl = c.createBiquadFilter();
    fl.type = "highpass";
    fl.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(fl).connect(g).connect(this.mbus);
    s.start(at, Math.random());
    s.stop(at + dur + 0.02);
  }

  stopMusic() {
    if (this.music) {
      clearInterval(this.music.timer);
      this.music = null;
    }
  }
}

const SONGS = [
  { bpm: 132, roots: [0, 0, 3, 5], kick: "x.....x.x.......", snare: "....x.......x...", bass: "x.xx..x.x.xx..33" },
  { bpm: 140, roots: [5, 5, 8, 3], kick: "x...x.....x.x...", snare: "....x.......x..x", bass: "x.x.x.x.xxx.x.7." },
  { bpm: 148, roots: [0, 1, 0, 3], kick: "x.x...x.x.x.....", snare: "....x.......x...", bass: "xxx.xxx.xxx.1.1." },
  { bpm: 124, roots: [2, 2, 5, 0], kick: "x.....x...x.....", snare: "....x.......x...", bass: "x...x.x.x...3.5." },
  { bpm: 156, roots: [0, 3, 5, 7], kick: "x...x...x...x.x.", snare: "....x.......x...", bass: "x.xxx.xxx.xxx.xx" },
];
