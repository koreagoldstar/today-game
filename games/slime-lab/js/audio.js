/*
 * 말랑팡! 슬라임 연구소 · 효과음 (소리 파일 없이 바로 만들어 냄)
 *  - 브라우저 자동 재생 제한: 첫 클릭/터치(unlock) 뒤에만 소리
 *  - 사이트 전체 음소거(TodayAudio)는 공용 스크립트가 AudioContext 를 감싸서 자동으로 따름
 *  - 게임 자체 소리 켜기/끄기 (on)
 *  - 같은 소리가 한꺼번에 몰리면 줄임 (충돌음은 초당 몇 번만)
 */
const SEMI = (n) => Math.pow(2, n / 12);

export class SlimeAudio {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.lastHit = 0;
    this.hits = 0;
  }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
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
  /** 짧은 음 하나: 주파수 f0 → f1 · 길이 dur · 모양 type */
  tone(f0, f1, dur, { type = "sine", vol = 0.3, at = 0, attack = 0.005 } = {}) {
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
  noise(dur, { vol = 0.15, at = 0, freq = 1800 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    if (!this.nbuf || this.nbuf.length < n) {
      this.nbuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.4), c.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource();
    s.buffer = this.nbuf;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, 0, dur + 0.02);
  }
  play(name, o = {}) {
    if (!this.on || !this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    switch (name) {
      case "tap":
        this.tone(880, 1200, 0.06, { type: "triangle", vol: 0.12 });
        break;
      case "drop":
        // 가벼운 '톡'
        this.tone(720, 380, 0.08, { vol: 0.22 });
        this.noise(0.03, { vol: 0.05, freq: 3000 });
        break;
      case "squish": {
        // 말랑한 충돌: 초당 8번까지만
        if (now - this.lastHit > 1) this.hits = 0;
        if (this.hits > 8) return;
        this.hits++;
        this.lastHit = now;
        const k = Math.min(1, (o.k || 0.5) * 1.2);
        const f = 220 - (o.size || 0) * 14 + Math.random() * 30;
        this.tone(f * 1.3, f * 0.7, 0.12, { vol: 0.08 + 0.14 * k });
        break;
      }
      case "merge": {
        // 명확한 '팡': 단계가 높을수록 높게 · 콤보면 더 높게
        const lv = o.level || 2;
        const base = 392 * SEMI((lv - 2) * 2 + Math.min(10, (o.combo || 1) - 1));
        this.tone(base * 0.7, base * 1.4, 0.09, { type: "triangle", vol: 0.26 });
        this.tone(base * 1.5, base * 2.0, 0.14, { vol: 0.14, at: 0.02 });
        this.noise(0.05, { vol: 0.06, freq: 2400 });
        if (lv >= 6) this.tone(base * 2, base * 3, 0.25, { type: "sine", vol: 0.1, at: 0.06 });
        break;
      }
      case "combo": {
        // 콤보 단계에 따라 올라가는 소리
        const n = Math.min(12, o.combo || 2);
        const f = 523 * SEMI(n * 2);
        this.tone(f, f, 0.08, { type: "square", vol: 0.05 });
        this.tone(f * 1.25, f * 1.25, 0.1, { type: "square", vol: 0.05, at: 0.07 });
        break;
      }
      case "legend":
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone(523 * SEMI(s), 523 * SEMI(s), 0.22, { type: "triangle", vol: 0.16, at: i * 0.08 }));
        break;
      case "discover":
        // 새 슬라임 발견: 짧은 축하
        [0, 4, 7, 12].forEach((s, i) => this.tone(659 * SEMI(s), 659 * SEMI(s), 0.16, { type: "triangle", vol: 0.14, at: i * 0.07 }));
        this.tone(2093, 2637, 0.3, { vol: 0.05, at: 0.28 });
        break;
      case "warn":
        this.tone(660, 620, 0.12, { type: "triangle", vol: 0.08 });
        break;
      case "over":
        // 귀엽게 '어라라~' (너무 슬프지 않게)
        [7, 4, 0].forEach((s, i) => this.tone(523 * SEMI(s), 523 * SEMI(s - 1), 0.22, { type: "triangle", vol: 0.14, at: i * 0.16 }));
        this.tone(392, 440, 0.35, { vol: 0.1, at: 0.5 });
        break;
      case "best":
        [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.tone(523 * SEMI(s), 523 * SEMI(s), 0.16, { type: "triangle", vol: 0.13, at: i * 0.09 }));
        break;
      case "clear":
        [0, 4, 7, 12].forEach((s, i) => this.tone(587 * SEMI(s), 587 * SEMI(s), 0.2, { type: "triangle", vol: 0.15, at: i * 0.1 }));
        break;
      case "fail":
        [4, 0].forEach((s, i) => this.tone(440 * SEMI(s), 440 * SEMI(s - 2), 0.25, { type: "triangle", vol: 0.12, at: i * 0.2 }));
        break;
    }
  }
}
