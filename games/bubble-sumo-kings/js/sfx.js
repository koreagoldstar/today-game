/* 소리: 파일 없이 합성 (저작권 걱정 없음). 전체 음소거는 공용 today-audio 가 처리한다 */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Sfx {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.vol = 0.8;
    this.music = null;
    this.last = new Map();
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      this.ctx = c;
      this.master = c.createDynamicsCompressor();
      this.master.threshold.value = -12;
      this.master.ratio.value = 4;
      this.master.connect(c.destination);
      this.bus = c.createGain();
      this.mbus = c.createGain();
      this.bus.connect(this.master);
      this.mbus.connect(this.master);
      const n = c.sampleRate;
      this.noise = c.createBuffer(1, n, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < n; i += 1) d[i] = Math.random() * 2 - 1;
      this.apply();
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  apply() {
    if (!this.ctx) return;
    this.bus.gain.value = this.sfxOn ? this.vol : 0;
    this.mbus.gain.value = this.musicOn ? this.vol * 0.22 : 0;
  }

  set({ sfx, music, vol }) {
    if (sfx !== undefined) this.sfxOn = sfx;
    if (music !== undefined) this.musicOn = music;
    if (vol !== undefined) this.vol = clamp(vol, 0, 1);
    this.apply();
  }

  suspend(off) {
    if (!this.ctx) return;
    if (off) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  gate(k, ms) {
    if (!this.ctx) return false;
    const now = performance.now();
    if (now - (this.last.get(k) || 0) < ms) return false;
    this.last.set(k, now);
    return true;
  }

  tone({ dur = 0.15, f = 440, to = 0, type = "sine", gain = 0.3, delay = 0, dest }) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  burst({ dur = 0.15, f = 1000, to = 0, q = 1, type = "bandpass", gain = 0.3, delay = 0 }) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.bus);
    s.start(t, Math.random() * 0.8);
    s.stop(t + dur + 0.02);
  }

  /** 말랑한 몸통 충돌: 뽀용 */
  boing(p = 0.6) {
    if (!this.gate("boing", 50)) return;
    const k = clamp(p, 0.15, 1);
    this.tone({ dur: 0.2 + k * 0.14, f: 280 + k * 80, to: 90, type: "sine", gain: 0.46 * (0.5 + k * 0.6) });
    this.tone({ dur: 0.16, f: 620, to: 240, type: "triangle", gain: 0.14 * k, delay: 0.015 });
    this.burst({ dur: 0.07, f: 900, q: 0.7, gain: 0.16 * k });
  }

  thump(p = 1) {
    if (!this.gate("thump", 60)) return;
    this.tone({ dur: 0.24, f: 130, to: 42, gain: 0.7 * p });
    this.burst({ dur: 0.16, f: 500, to: 120, q: 0.5, type: "lowpass", gain: 0.34 * p });
  }

  step() {
    if (!this.gate("step", 110)) return;
    this.tone({ dur: 0.05, f: 170 + Math.random() * 60, to: 100, type: "triangle", gain: 0.1 });
  }

  whoosh() {
    if (!this.gate("whoosh", 70)) return;
    this.burst({ dur: 0.13, f: 700, to: 2200, q: 0.8, gain: 0.13 });
  }

  dash(p = 1) {
    this.burst({ dur: 0.24, f: 500, to: 2800, q: 0.8, gain: 0.24 });
    this.tone({ dur: 0.2, f: 180, to: 520 + p * 240, type: "sawtooth", gain: 0.07 });
  }

  charge(k) {
    if (!this.gate("charge", 90)) return;
    this.tone({ dur: 0.09, f: 220 + k * 500, type: "square", gain: 0.035 });
  }

  guard() {
    if (!this.gate("guard", 120)) return;
    this.tone({ dur: 0.09, f: 200, to: 150, type: "triangle", gain: 0.2 });
  }

  block() {
    if (!this.gate("block", 70)) return;
    this.tone({ dur: 0.13, f: 240, to: 130, type: "square", gain: 0.11 });
    this.burst({ dur: 0.08, f: 1600, q: 1, gain: 0.14 });
  }

  parry() {
    this.tone({ dur: 0.1, f: 880, type: "triangle", gain: 0.22 });
    this.tone({ dur: 0.26, f: 1320, type: "triangle", gain: 0.2, delay: 0.05 });
    this.burst({ dur: 0.08, f: 3000, q: 1.5, gain: 0.14 });
  }

  dodge() {
    this.burst({ dur: 0.14, f: 1100, to: 3000, q: 1, gain: 0.12 });
    this.tone({ dur: 0.11, f: 520, to: 900, type: "sine", gain: 0.12 });
  }

  whiff() {
    this.tone({ dur: 0.26, f: 420, to: 150, type: "triangle", gain: 0.16 });
  }

  fall() {
    this.tone({ dur: 0.34, f: 520, to: 90, type: "sine", gain: 0.3 });
    this.thump(0.7);
  }

  special() {
    [392, 587, 784, 1175].forEach((f, i) => this.tone({ dur: 0.15, f, type: "square", gain: 0.075, delay: i * 0.04 }));
    this.burst({ dur: 0.3, f: 400, to: 2600, q: 0.7, gain: 0.18 });
  }

  roar() {
    this.tone({ dur: 0.42, f: 150, to: 70, type: "sawtooth", gain: 0.22 });
    this.burst({ dur: 0.42, f: 500, to: 180, q: 0.6, gain: 0.22 });
  }

  ringOut() {
    // 뾰오오옹 떨어지는 소리
    this.tone({ dur: 0.62, f: 900, to: 90, type: "sine", gain: 0.3 });
    this.tone({ dur: 0.62, f: 1350, to: 135, type: "triangle", gain: 0.08 });
  }

  splash() {
    this.thump(1);
    this.burst({ dur: 0.26, f: 900, to: 300, q: 0.6, gain: 0.26 });
  }

  crowd(k = 1) {
    if (!this.gate("crowd", 260)) return;
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const fl = c.createBiquadFilter();
    fl.type = "bandpass";
    fl.frequency.value = 1100;
    fl.Q.value = 0.5;
    const g = c.createGain();
    const d = 0.7 + k * 0.7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13 * k, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl).connect(g).connect(this.bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + d + 0.02);
  }

  drum(go) {
    this.tone({ dur: go ? 0.32 : 0.14, f: go ? 150 : 110, to: 60, gain: 0.62 });
    this.burst({ dur: 0.06, f: 800, q: 0.5, gain: 0.16 });
    if (go) [523, 659, 784].forEach((f, i) => this.tone({ dur: 0.18, f, type: "triangle", gain: 0.14, delay: 0.04 + i * 0.05 }));
  }

  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ dur: 0.22, f, type: "triangle", gain: 0.2, delay: i * 0.09 }));
    this.tone({ dur: 0.6, f: 1568, type: "triangle", gain: 0.16, delay: 0.46 });
    this.crowd(1.4);
  }

  lose() {
    [392, 370, 349, 262].forEach((f, i) => this.tone({ dur: i === 3 ? 0.5 : 0.2, f, type: "triangle", gain: 0.2, delay: i * 0.17 }));
  }

  click() {
    this.tone({ dur: 0.07, f: 720, to: 520, type: "triangle", gain: 0.2 });
  }

  coin() {
    this.tone({ dur: 0.07, f: 988, type: "square", gain: 0.06 });
    this.tone({ dur: 0.2, f: 1319, type: "square", gain: 0.06, delay: 0.06 });
  }

  /** 월드별 음악: 통통 튀는 짧은 반복 */
  startMusic(world = 0) {
    if (!this.ctx) return;
    this.stopMusic();
    const song = SONGS[world % SONGS.length];
    const step = 60 / song.bpm / 2;
    let t = this.ctx.currentTime + 0.1;
    let i = 0;
    const tick = () => {
      const c = this.ctx;
      if (!this.music || c.state === "suspended") return;
      while (t < c.currentTime + 0.4) {
        const n = i % song.lead.length;
        const lead = song.lead[n];
        const bass = song.bass[Math.floor(i / 2) % song.bass.length];
        if (lead) this.tone({ dur: step * 0.9, f: lead, type: song.wave, gain: 0.3, dest: this.mbus, delay: Math.max(0, t - c.currentTime) });
        if (i % 2 === 0 && bass) this.tone({ dur: step * 1.6, f: bass, type: "triangle", gain: 0.42, dest: this.mbus, delay: Math.max(0, t - c.currentTime) });
        if (i % 4 === 0) this.tone({ dur: 0.1, f: 120, to: 55, gain: 0.5, dest: this.mbus, delay: Math.max(0, t - c.currentTime) });
        t += step;
        i += 1;
      }
    };
    this.music = setInterval(tick, 130);
    tick();
  }

  stopMusic() {
    if (this.music) clearInterval(this.music);
    this.music = null;
  }
}

const N = { c: 262, d: 294, e: 330, f: 349, g: 392, a: 440, b: 494, C: 523, D: 587, E: 659, F: 698, G: 784, A: 880, _: 0, l: 220, m: 196, k: 175, j: 165 };
const seq = (s) => s.split("").map((c) => N[c] || 0);
const SONGS = [
  { bpm: 136, wave: "triangle", lead: seq("CEGEC_GEaCEC g_Gd".replace(" ", "_")), bass: seq("cgaf") },
  { bpm: 112, wave: "sine", lead: seq("DE_GA_GE D_EG_A__"), bass: seq("ldge") },
  { bpm: 124, wave: "sine", lead: seq("EG_ECD_aC_EDC___"), bass: seq("lfcg") },
  { bpm: 146, wave: "square", lead: seq("AGE_DE_GA_CAG_E_"), bass: seq("ldlm") },
  { bpm: 130, wave: "triangle", lead: seq("GACDE_DCA_GE_DE_"), bass: seq("cgaf") },
];
