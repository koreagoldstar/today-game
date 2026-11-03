/*
 * 소리: 음원 파일 없이 WebAudio 로 직접 만든다 (저작권 걱정 없음).
 *  효과음 + 월드마다 다른 배경음악(자동 작곡 패턴).
 *  공용 음소거(TodayAudio)가 AudioContext 를 감싸므로 음소거도 함께 따라간다.
 */
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

/** 월드별 곡: 빠르기 · 코드 진행 · 악기 */
const SONGS = {
  title: { bpm: 104, root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], lead: "bell", bass: "soft", pattern: [0, 2, 4, 2, 3, 4, 2, 1], swing: 0.12 },
  village: { bpm: 112, root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], lead: "bell", bass: "soft", pattern: [0, 2, 3, 4, 3, 2, 0, 2], swing: 0.14 },
  canyon: { bpm: 126, root: 57, scale: [0, 3, 5, 7, 10], chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7]], lead: "pluck", bass: "pulse", pattern: [0, 1, 2, 4, 3, 2, 1, 2], swing: 0 },
  sea: { bpm: 96, root: 62, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [5, 9, 12], [2, 5, 9], [7, 11, 14]], lead: "marimba", bass: "soft", pattern: [2, 4, 3, 2, 0, 2, 3, 1], swing: 0.2 },
  peaks: { bpm: 136, root: 55, scale: [0, 3, 5, 7, 10], chords: [[0, 3, 7], [3, 7, 10], [-2, 2, 5], [-4, 0, 3]], lead: "pluck", bass: "pulse", pattern: [0, 0, 2, 3, 4, 3, 2, 1], swing: 0 },
  aurora: { bpm: 88, root: 64, scale: [0, 2, 3, 7, 8], chords: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -1, 2]], lead: "glass", bass: "pad", pattern: [4, 2, 3, 1, 2, 0, 1, 3], swing: 0.08 },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.6;
    this.sfxVol = 0.85;
    this.on = true;
    this.song = null;
    this.next = 0;
    this.step = 0;
    this.timer = null;
    this.windGain = null;
  }
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
      const comp = c.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(c.destination);
      this.sfxBus = c.createGain();
      this.musBus = c.createGain();
      this.sfxBus.connect(this.master);
      this.musBus.connect(this.master);
      this.applyVolume();
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
      // 메아리
      this.echo = c.createDelay(0.8);
      this.echo.delayTime.value = 0.28;
      const fb = c.createGain();
      fb.gain.value = 0.28;
      const eg = c.createGain();
      eg.gain.value = 0.42;
      this.echo.connect(fb);
      fb.connect(this.echo);
      this.echo.connect(eg);
      eg.connect(this.musBus);
      // 계속 나는 바람 · 미끄럼 · 구르는 소리
      this.loops = {};
      for (const [k, freq, type] of [["wind", 620, "bandpass"], ["ice", 3400, "bandpass"], ["roll", 170, "lowpass"]]) {
        const s = c.createBufferSource();
        s.buffer = this.noiseBuf;
        s.loop = true;
        const f = c.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = k === "ice" ? 1.2 : 0.7;
        const g = c.createGain();
        g.gain.value = 0;
        s.connect(f);
        f.connect(g);
        g.connect(this.sfxBus);
        s.start();
        this.loops[k] = { g, f };
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }
  applyVolume() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.on ? 1 : 0, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.sfxVol, t, 0.02);
    this.musBus.gain.setTargetAtTime(this.musicVol * 0.55, t, 0.02);
  }
  setVolumes(music, sfx, on) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.on = on;
    this.applyVolume();
  }
  setLoop(k, v, freq) {
    if (!this.loops) return;
    const l = this.loops[k];
    l.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08);
    if (freq) l.f.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
  }
  noise(dur, freq, type, peak, attack = 0.003, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }
  tone(freq, dur, type, peak, slide = 1, delay = 0, bus = null) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  /* ---------- 효과음 ---------- */
  step_() {
    this.noise(0.05, 900 + Math.random() * 500, "bandpass", 0.11);
    this.tone(150 + Math.random() * 30, 0.05, "sine", 0.05, 0.7);
  }
  jump() {
    this.tone(320, 0.17, "triangle", 0.2, 2.5);
    this.tone(640, 0.1, "sine", 0.06, 2, 0.03);
  }
  land(k = 0.5) {
    this.noise(0.1 + k * 0.1, 380, "lowpass", 0.14 + k * 0.28);
    this.tone(140, 0.09, "sine", 0.14 * k + 0.05, 0.6);
  }
  drop() {
    // 어이쿠! 위로 뛰다 뚝 떨어지는 소리
    this.tone(760, 0.12, "triangle", 0.24, 1.6);
    this.tone(1120, 0.28, "triangle", 0.2, 0.34, 0.1);
    this.noise(0.05, 2400, "bandpass", 0.16, 0.002, 0.02);
  }
  boxHit(k = 0.5) {
    this.noise(0.05, 700, "bandpass", 0.18 + k * 0.24);
    this.tone(210 + Math.random() * 60, 0.07, "square", 0.05 + k * 0.05, 0.6);
  }
  boxHop() {
    this.tone(300 + Math.random() * 120, 0.05, "triangle", 0.08, 1.5);
  }
  catch_(nice) {
    const base = nice ? 660 : 520;
    [1, 1.26, 1.5, nice ? 2 : 0].forEach((m, i) => {
      if (m) this.tone(base * m, 0.2, "triangle", nice ? 0.22 : 0.16, 1, i * 0.06);
    });
  }
  plop() {
    this.tone(300, 0.2, "sine", 0.3, 0.32);
    this.noise(0.13, 520, "lowpass", 0.26);
    // 띠용
    this.tone(880, 0.32, "triangle", 0.08, 0.6, 0.13);
  }
  hit() {
    this.noise(0.14, 850, "lowpass", 0.42);
    this.tone(190, 0.15, "square", 0.1, 0.5);
  }
  snowed() {
    this.noise(0.42, 1500, "lowpass", 0.48);
    this.tone(620, 0.3, "triangle", 0.1, 0.5, 0.08);
  }
  splash() {
    this.noise(0.55, 1500, "bandpass", 0.42, 0.012);
    this.noise(0.3, 3400, "highpass", 0.18, 0.01, 0.06);
    this.tone(300, 0.2, "sine", 0.2, 0.42);
    for (let i = 0; i < 4; i += 1) this.tone(500 + i * 150, 0.06, "sine", 0.05, 1.4, 0.18 + i * 0.05);
  }
  fish(chain = 0) {
    const f = 880 * Math.pow(2, Math.min(chain, 12) / 12);
    this.tone(f, 0.08, "sine", 0.13);
    this.tone(f * 1.5, 0.1, "sine", 0.1, 1, 0.05);
  }
  star() {
    [880, 1109, 1319, 1760].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.15, 1, i * 0.055));
  }
  power() {
    this.tone(330, 0.32, "sawtooth", 0.09, 3);
    [660, 880, 1320].forEach((f, i) => this.tone(f, 0.16, "sine", 0.12, 1, i * 0.05 + 0.12));
  }
  dash() {
    this.noise(0.26, 1900, "bandpass", 0.26, 0.01);
    this.tone(240, 0.24, "sawtooth", 0.06, 2.4);
  }
  spring() {
    this.tone(200, 0.34, "sine", 0.28, 4.4);
    this.tone(1000, 0.2, "triangle", 0.08, 0.55, 0.08);
  }
  crack() {
    for (let i = 0; i < 3; i += 1) this.noise(0.03, 3200 + Math.random() * 1400, "bandpass", 0.2, 0.001, i * 0.04);
  }
  crumble() {
    this.noise(0.36, 1000, "bandpass", 0.32);
    for (let i = 0; i < 4; i += 1) this.noise(0.04, 2500, "bandpass", 0.12, 0.002, i * 0.06);
  }
  iceWarn() {
    this.tone(1400, 0.08, "triangle", 0.1, 1);
    this.tone(1400, 0.08, "triangle", 0.1, 1, 0.16);
  }
  iceBreak() {
    this.noise(0.25, 4200, "highpass", 0.3);
    [2100, 2800, 3500].forEach((f, i) => this.tone(f, 0.12, "sine", 0.07, 0.8, i * 0.03));
  }
  rumble(dur = 1.2) {
    this.noise(dur, 170, "lowpass", 0.55, 0.15);
  }
  whoosh() {
    this.noise(0.5, 900, "bandpass", 0.26, 0.1);
  }
  geyser() {
    this.noise(0.9, 1200, "bandpass", 0.32, 0.05);
    this.tone(200, 0.6, "sine", 0.1, 2.2);
  }
  fox() {
    this.tone(1200, 0.08, "square", 0.1, 0.7);
    this.tone(1500, 0.1, "square", 0.1, 0.6, 0.1);
  }
  seal() {
    this.tone(420, 0.1, "sawtooth", 0.13, 1.3);
    this.tone(480, 0.12, "sawtooth", 0.13, 0.8, 0.13);
  }
  gull() {
    this.tone(1500, 0.16, "sawtooth", 0.06, 0.65);
    this.tone(1400, 0.2, "sawtooth", 0.06, 0.6, 0.2);
  }
  check() {
    this.tone(784, 0.1, "triangle", 0.14);
    this.tone(1175, 0.16, "triangle", 0.14, 1, 0.08);
  }
  win() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.17, 1, i * 0.09));
    [262, 330, 392].forEach((f) => this.tone(f, 0.75, "sine", 0.1, 1, 0.45));
  }
  starPop(i) {
    this.tone(880 + i * 280, 0.26, "triangle", 0.2);
    this.tone(1760 + i * 560, 0.16, "sine", 0.08, 1, 0.03);
  }
  lose() {
    [392, 370, 349, 262].forEach((f, i) => this.tone(f, i === 3 ? 0.65 : 0.26, "triangle", 0.16, i === 3 ? 0.72 : 1, i * 0.22));
  }
  ui() {
    this.tone(760, 0.05, "sine", 0.13);
    this.tone(1140, 0.05, "sine", 0.07, 1, 0.03);
  }
  coin() {
    this.tone(1320, 0.07, "square", 0.05);
    this.tone(1760, 0.13, "square", 0.05, 1, 0.06);
  }
  /* ---------- 배경음악 ---------- */
  playSong(key) {
    this.unlock();
    if (!this.ctx) return;
    if (this.song === SONGS[key] && this.timer) return;
    this.song = SONGS[key] || SONGS.title;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.12;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 70);
  }
  stopSong() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }
  suspend(on) {
    if (!this.ctx) return;
    if (on) {
      this.setLoop("wind", 0);
      this.setLoop("ice", 0);
      this.setLoop("roll", 0);
    }
    this.paused = on;
    if (!on) this.next = Math.max(this.next, this.ctx.currentTime + 0.05);
  }
  tick() {
    if (!this.ctx || !this.song || this.paused) return;
    const c = this.ctx;
    const S = this.song;
    const dur = 60 / S.bpm / 2;
    while (this.next < c.currentTime + 0.25) {
      this.playStep(S, this.step, this.next, dur);
      this.step = (this.step + 1) % 64;
      this.next += dur;
    }
  }
  inst(kind, midi, at, dur, peak) {
    const c = this.ctx;
    const f = NOTE(midi);
    const o = c.createOscillator();
    const g = c.createGain();
    let attack = 0.006;
    let rel = dur;
    switch (kind) {
      case "bell": {
        o.type = "sine";
        const o2 = c.createOscillator();
        o2.type = "sine";
        o2.frequency.value = f * 3.01;
        const g2 = c.createGain();
        g2.gain.setValueAtTime(peak * 0.35, at);
        g2.gain.exponentialRampToValueAtTime(0.0001, at + rel * 0.6);
        o2.connect(g2);
        g2.connect(this.musBus);
        g2.connect(this.echo);
        o2.start(at);
        o2.stop(at + rel);
        break;
      }
      case "marimba": {
        o.type = "sine";
        const o2 = c.createOscillator();
        o2.type = "triangle";
        o2.frequency.value = f * 4;
        const g2 = c.createGain();
        g2.gain.setValueAtTime(peak * 0.18, at);
        g2.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
        o2.connect(g2);
        g2.connect(this.musBus);
        o2.start(at);
        o2.stop(at + 0.1);
        rel = dur * 0.8;
        break;
      }
      case "pluck":
        o.type = "triangle";
        rel = dur * 0.65;
        break;
      case "glass": {
        o.type = "sine";
        attack = 0.02;
        rel = dur * 1.6;
        const o2 = c.createOscillator();
        o2.type = "sine";
        o2.frequency.value = f * 2.005;
        const g2 = c.createGain();
        g2.gain.setValueAtTime(peak * 0.3, at);
        g2.gain.exponentialRampToValueAtTime(0.0001, at + rel);
        o2.connect(g2);
        g2.connect(this.echo);
        o2.start(at);
        o2.stop(at + rel);
        break;
      }
      case "pulse":
        o.type = "square";
        rel = dur * 0.5;
        peak *= 0.5;
        break;
      case "pad":
        o.type = "triangle";
        attack = 0.2;
        rel = dur * 1.5;
        peak *= 0.6;
        break;
      default:
        o.type = "triangle";
        rel = dur * 0.8;
        break;
    }
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(attack + 0.02, rel));
    o.connect(g);
    g.connect(this.musBus);
    if (kind === "bell" || kind === "glass") g.connect(this.echo);
    o.start(at);
    o.stop(at + rel + 0.05);
  }
  playStep(S, n, at, dur) {
    const c = this.ctx;
    const bar = Math.floor(n / 16) % S.chords.length;
    const beat = n % 16;
    const ch = S.chords[bar];
    const swing = beat % 2 === 1 ? dur * S.swing : 0;
    const t = at + swing;
    // 베이스
    if (beat % 8 === 0 || (beat === 6 && S.bass === "pulse") || (beat === 14 && S.bass !== "pad")) {
      this.inst(S.bass, S.root - 12 + ch[0], t, dur * (S.bass === "pad" ? 8 : 2.4), 0.22);
    }
    // 화음 살짝
    if (beat % 4 === 2) {
      for (const k of ch) this.inst(S.lead === "glass" ? "pad" : "pluck", S.root + k, t, dur * 1.3, 0.035);
    }
    // 선율: 음계 위의 짧은 패턴 (4마디마다 변형)
    const section = Math.floor(n / 32) % 2;
    const pIdx = beat % S.pattern.length;
    const degree = S.pattern[(pIdx + (section ? 3 : 0)) % S.pattern.length];
    const rest = (section === 0 ? [0, 0, 0, 1, 0, 0, 1, 0] : [0, 1, 0, 0, 1, 0, 0, 1])[pIdx];
    if (!rest && (beat % 2 === 0 || S.bpm > 110)) {
      const oct = beat > 11 ? 12 : 0;
      const m = S.root + 12 + S.scale[degree % S.scale.length] + oct + (bar === 3 && beat > 8 ? -2 : 0);
      this.inst(S.lead, m, t, dur * 2, 0.1);
    }
    // 가벼운 박자
    if (beat % 4 === 0) {
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 5200;
      const g = c.createGain();
      g.gain.setValueAtTime(beat % 8 === 0 ? 0.05 : 0.03, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      s.connect(f);
      f.connect(g);
      g.connect(this.musBus);
      s.start(t, Math.random());
      s.stop(t + 0.06);
    }
  }
}
