/*
 * 소리: 파일 없이 WebAudio 로 합성 (총성 · 메아리 · 노리쇠 · 맞는 소리 · 심장 · 숨 · 바람/비 · 메뉴)
 *  공용 음소거(TodayAudio)가 AudioContext 를 감싸므로 따로 처리하지 않아도 음소거를 따른다.
 */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.vol = 0.9;
    this.amb = null;
    this.heartT = null;
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
      this.master = this.ctx.createGain();
      this.master.gain.value = this.vol;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      // 메아리
      this.echo = this.ctx.createDelay(1.5);
      this.echo.delayTime.value = 0.34;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.34;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      this.echo.connect(lp);
      lp.connect(fb);
      fb.connect(this.echo);
      lp.connect(this.master);
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }
  setVolume(v) {
    this.vol = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }
  noise(dur, freq, type, q, peak, attack = 0.002, send = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    if (send) {
      const e = c.createGain();
      e.gain.value = send;
      g.connect(e);
      e.connect(this.echo);
    }
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }
  tone(freq, dur, type, peak, slide = 0, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  shot() {
    this.noise(0.09, 3200, "highpass", 0.4, 0.95, 0.001);
    this.noise(0.5, 900, "lowpass", 0.7, 1.0, 0.002, 0.9);
    this.noise(1.1, 240, "lowpass", 0.5, 0.75, 0.004, 0.55);
    this.tone(120, 0.28, "sine", 0.85, 0.3);
  }
  bolt() {
    this.noise(0.04, 2600, "bandpass", 3, 0.3);
    setTimeout(() => this.noise(0.06, 1800, "bandpass", 4, 0.32), 150);
    setTimeout(() => this.noise(0.05, 2200, "bandpass", 3, 0.3), 330);
    setTimeout(() => this.noise(0.05, 1500, "bandpass", 4, 0.34), 520);
    setTimeout(() => this.tone(3800, 0.14, "triangle", 0.05, 0.7), 260); // 탄피
  }
  impactWall() {
    this.noise(0.14, 1300, "bandpass", 1, 0.2);
  }
  impactSoft() {
    this.noise(0.12, 400, "lowpass", 0.8, 0.45);
  }
  armor() {
    this.tone(2400, 0.2, "square", 0.08, 0.5);
    this.noise(0.1, 3000, "bandpass", 2, 0.3);
  }
  headshot() {
    this.tone(1320, 0.16, "triangle", 0.24);
    this.tone(1980, 0.26, "triangle", 0.18, 1, 0.07);
  }
  hit() {
    this.tone(880, 0.16, "triangle", 0.2);
  }
  dry() {
    this.noise(0.03, 3400, "bandpass", 6, 0.3);
  }
  zoom() {
    this.noise(0.03, 5000, "bandpass", 8, 0.08);
  }
  scope(on) {
    this.noise(0.08, on ? 1200 : 800, "bandpass", 2, 0.12);
  }
  spot() {
    this.tone(1560, 0.07, "sine", 0.12);
    this.tone(2100, 0.1, "sine", 0.1, 1, 0.05);
  }
  ui() {
    this.tone(720, 0.05, "triangle", 0.1);
  }
  uiGo() {
    this.tone(520, 0.08, "triangle", 0.14);
    this.tone(780, 0.14, "triangle", 0.14, 1, 0.07);
  }
  breathIn() {
    this.noise(0.5, 1400, "bandpass", 0.8, 0.07, 0.2);
  }
  breathOut() {
    this.noise(0.8, 900, "bandpass", 0.7, 0.08, 0.1);
  }
  gasp() {
    this.noise(0.6, 1600, "bandpass", 0.8, 0.16, 0.05);
  }
  heart(on) {
    clearInterval(this.heartT);
    if (!on) return;
    const beat = () => {
      this.tone(58, 0.14, "sine", 0.55, 0.8);
      this.tone(52, 0.16, "sine", 0.4, 0.8, 0.2);
    };
    beat();
    this.heartT = setInterval(beat, 880);
  }
  alarm() {
    this.tone(540, 0.2, "sawtooth", 0.05, 1.3);
    this.tone(540, 0.2, "sawtooth", 0.05, 1.3, 0.28);
  }
  slow() {
    this.noise(1.2, 300, "lowpass", 0.6, 0.3, 0.05);
    this.tone(90, 1.1, "sine", 0.35, 0.5);
  }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.16, 1, i * 0.11));
  }
  lose() {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.4, "triangle", 0.15, 0.95, i * 0.17));
  }
  star(i) {
    this.tone(880 + i * 220, 0.22, "triangle", 0.18);
  }
  /** 배경 소리: wind · rain · city */
  ambience(kind) {
    if (!this.ctx) return;
    this.stopAmbience();
    if (!kind) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = kind === "rain" ? "highpass" : "lowpass";
    f.frequency.value = kind === "rain" ? 1400 : kind === "harbor" ? 520 : 340;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(kind === "rain" ? 0.11 : 0.09, c.currentTime, 0.8);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start();
    // 천천히 일렁임
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.09;
    const lg = c.createGain();
    lg.gain.value = 0.035;
    lfo.connect(lg);
    lg.connect(g.gain);
    lfo.start();
    this.amb = { s, g, lfo };
  }
  stopAmbience() {
    if (!this.amb || !this.ctx) return;
    const { s, g, lfo } = this.amb;
    g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    setTimeout(() => {
      try {
        s.stop();
        lfo.stop();
      } catch (_) {
        /* ignore */
      }
    }, 900);
    this.amb = null;
  }
}
