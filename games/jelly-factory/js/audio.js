/*
 * 말랑콩떡! 젤리 공장 · 효과음 (소리 파일 없이 바로 만들어 냄)
 *  - 브라우저 자동 재생 제한: 첫 클릭/터치(unlock) 뒤에만 소리
 *  - 사이트 전체 음소거(TodayAudio)는 공용 스크립트가 AudioContext 를 감싸서 자동으로 따름
 *  - 게임 자체 소리 켜기/끄기 (on)
 */
const SEMI = (n) => Math.pow(2, n / 12);

export class JellyAudio {
  constructor() {
    this.ctx = null;
    this.on = true;
  }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch (_) {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }
  setOn(on) {
    this.on = on;
  }
  tone(f0, f1, dur, { type = "sine", vol = 0.3, at = 0, attack = 0.006 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.12, at = 0, freq = 1800, q = 1.2 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + at;
    if (!this.nbuf) {
      this.nbuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource();
    s.buffer = this.nbuf;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, 0, Math.min(0.48, dur + 0.02));
  }
  play(name, o = {}) {
    if (!this.on || !this.ctx || this.ctx.state !== "running") return;
    switch (name) {
      case "select":
        this.tone(660, 990, 0.07, { type: "triangle", vol: 0.12 });
        break;
      case "deny":
        this.tone(300, 220, 0.12, { type: "triangle", vol: 0.12 });
        break;
      case "slide":
        // 쭈욱 미끄러지는 소리
        this.tone(420, 620 + Math.min(6, o.n || 1) * 40, 0.06 + Math.min(6, o.n || 1) * 0.03, { type: "sine", vol: 0.08 });
        this.noise(0.06 + Math.min(6, o.n || 1) * 0.02, { vol: 0.03, freq: 900 });
        break;
      case "land":
        // 말랑 '퐁'
        this.tone(280, 150, 0.12, { vol: 0.2 });
        break;
      case "pad":
        this.tone(500, 900, 0.1, { type: "triangle", vol: 0.12 });
        break;
      case "pipe":
        this.tone(900, 300, 0.1, { type: "sine", vol: 0.1 });
        this.tone(300, 900, 0.1, { type: "sine", vol: 0.1, at: 0.1 });
        break;
      case "sticky":
        this.noise(0.12, { vol: 0.08, freq: 500, q: 3 });
        break;
      case "merge": {
        // 말랑~ 꿀렁 합쳐지는 소리 (개수 · 콤보가 클수록 높게)
        const base = 392 * SEMI(Math.min(12, (o.n || 3) - 3) * 2 + Math.min(8, (o.combo || 1) - 1) * 2);
        this.tone(base * 0.6, base, 0.16, { type: "sine", vol: 0.2 });
        this.tone(base, base * 1.5, 0.16, { type: "triangle", vol: 0.14, at: 0.12 });
        this.noise(0.05, { vol: 0.05, freq: 2600, at: 0.14 });
        break;
      }
      case "make":
        [0, 7, 12].forEach((s, i) => this.tone(784 * SEMI(s), 784 * SEMI(s), 0.12, { type: "triangle", vol: 0.12, at: i * 0.06 }));
        break;
      case "bolt":
        this.noise(0.35, { vol: 0.16, freq: 3200, q: 0.7 });
        this.tone(1200, 200, 0.3, { type: "sawtooth", vol: 0.06 });
        break;
      case "star":
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone(880 * SEMI(s), 880 * SEMI(s), 0.1, { type: "triangle", vol: 0.1, at: i * 0.04 }));
        this.noise(0.2, { vol: 0.08, freq: 1800 });
        break;
      case "fluffy":
        this.noise(0.4, { vol: 0.12, freq: 600, q: 0.5 });
        this.tone(320, 480, 0.25, { vol: 0.08 });
        break;
      case "rainbow":
        [0, 2, 4, 7, 9, 12, 14, 16].forEach((s, i) => this.tone(523 * SEMI(s), 523 * SEMI(s), 0.14, { type: "triangle", vol: 0.09, at: i * 0.045 }));
        break;
      case "crate":
        this.noise(0.1, { vol: 0.14, freq: 700, q: 2 });
        this.tone(200, 120, 0.1, { type: "square", vol: 0.05 });
        break;
      case "ice":
        this.tone(2400, 1800, 0.08, { type: "triangle", vol: 0.08 });
        this.noise(0.12, { vol: 0.06, freq: 5000 });
        break;
      case "spawn":
        this.tone(900, 1300, 0.05, { type: "sine", vol: 0.05 });
        break;
      case "combo": {
        const n = Math.min(10, o.combo || 2);
        const f = 523 * SEMI(n * 2);
        this.tone(f, f, 0.08, { type: "square", vol: 0.04 });
        this.tone(f * 1.25, f * 1.25, 0.1, { type: "square", vol: 0.04, at: 0.07 });
        break;
      }
      case "clear":
        [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.tone(587 * SEMI(s), 587 * SEMI(s), 0.18, { type: "triangle", vol: 0.13, at: i * 0.09 }));
        break;
      case "fail":
        [4, 0, -3].forEach((s, i) => this.tone(440 * SEMI(s), 440 * SEMI(s - 1), 0.22, { type: "triangle", vol: 0.11, at: i * 0.17 }));
        break;
      case "best":
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(523 * SEMI(s), 523 * SEMI(s), 0.15, { type: "triangle", vol: 0.12, at: i * 0.08 }));
        break;
      case "discover":
        [0, 4, 7, 12].forEach((s, i) => this.tone(659 * SEMI(s), 659 * SEMI(s), 0.14, { type: "triangle", vol: 0.12, at: i * 0.07 }));
        break;
    }
  }
}
