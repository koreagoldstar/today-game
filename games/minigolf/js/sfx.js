/*
 * 소리: 파일 없이 WebAudio 로 합성 (스윙 · 타구음 · 착지 · 물 · 모래 · 컵 · 박수 · 새소리 · 바람)
 *  공용 음소거(TodayAudio)가 AudioContext 를 감싸므로 따로 처리하지 않아도 음소거를 따른다.
 */
import { Sfx } from "../../oneshot-elite/js/sfx.js";

export class GolfSfx extends Sfx {
  constructor() {
    super();
    this.birdT = null;
    this.windNode = null;
  }
  whoosh(power) {
    this.noise(0.2 + power * 0.12, 700 + power * 900, "bandpass", 1.1, 0.16 + power * 0.3, 0.09);
  }
  strike(club, power, sweet) {
    const k = 0.45 + power * 0.55;
    if (club.putter) {
      this.tone(1250, 0.05, "sine", 0.32 * Math.max(0.5, k), 0.7);
      this.noise(0.025, 2800, "bandpass", 3, 0.1);
      return;
    }
    if (club.id === "DR" || club.id === "3W") {
      this.noise(0.05, 3600, "highpass", 0.6, 0.9 * k);
      this.tone(sweet ? 2300 : 1500, 0.09, "triangle", 0.34 * k, 0.5);
      this.tone(320, 0.12, "sine", 0.4 * k, 0.5);
    } else {
      this.noise(0.04, 4600, "highpass", 0.7, 0.62 * k);
      this.tone(sweet ? 3100 : 1900, 0.05, "triangle", 0.28 * k, 0.6);
      this.noise(0.12, 500, "lowpass", 0.5, 0.26 * k, 0.004);
    }
    if (sweet) this.tone(5200, 0.16, "sine", 0.06, 0.92, 0.01);
  }
  land(surf, v = 1) {
    const k = Math.min(1, 0.3 + v * 0.1);
    if (surf === "sand") {
      this.noise(0.26, 1400, "lowpass", 0.6, 0.5 * k, 0.01);
      return;
    }
    if (surf === "green" || surf === "fringe") {
      this.tone(170, 0.09, "sine", 0.34 * k, 0.6);
      this.noise(0.04, 900, "lowpass", 0.8, 0.2 * k);
      return;
    }
    this.tone(120, 0.1, "sine", 0.32 * k, 0.6);
    this.noise(0.08, 520, "lowpass", 0.8, 0.22 * k);
  }
  leaves() {
    this.noise(0.34, 3000, "highpass", 0.5, 0.26, 0.02);
    this.noise(0.06, 900, "bandpass", 2, 0.2);
  }
  pole() {
    this.tone(2100, 0.26, "triangle", 0.2, 0.92);
    this.tone(3400, 0.2, "sine", 0.08, 0.96);
  }
  splash() {
    this.noise(0.6, 1500, "lowpass", 0.5, 0.75, 0.01);
    this.noise(0.18, 3600, "bandpass", 0.8, 0.3, 0.004);
    for (let i = 0; i < 5; i += 1) this.tone(320 + i * 90, 0.09, "sine", 0.1, 2.1, 0.08 + i * 0.07);
  }
  cup() {
    [0, 0.09, 0.2, 0.27].forEach((d, i) => this.tone(1500 - i * 90, 0.07, "triangle", 0.3 - i * 0.04, 0.72, d));
    this.tone(210, 0.14, "sine", 0.3, 0.7, 0.28);
  }
  lip() {
    this.tone(1300, 0.08, "triangle", 0.22, 1.4);
  }
  /** 관중: k 0~1 (파 = 작은 박수 · 홀인원 = 환호) */
  cheer(k) {
    const n = 8 + Math.round(k * 34);
    for (let i = 0; i < n; i += 1) {
      const d = i * 0.06 * (0.5 + Math.random());
      setTimeout(() => this.noise(0.05, 1800 + Math.random() * 2600, "bandpass", 1.4, 0.05 + k * 0.1), d * 1000);
    }
    if (k > 0.5) this.noise(1.5 + k, 900, "bandpass", 0.5, 0.2 * k, 0.26);
    if (k > 0.85) this.noise(2.4, 1500, "bandpass", 0.4, 0.2, 0.4);
  }
  fanfare(k) {
    const scale = [523.25, 659.25, 783.99, 1046.5];
    scale.slice(0, 2 + Math.round(k * 2)).forEach((f, i) => this.tone(f, 0.26, "triangle", 0.14, 0, i * 0.12));
  }
  sad() {
    this.tone(330, 0.3, "triangle", 0.12, 0.8);
    this.tone(262, 0.42, "triangle", 0.12, 0.8, 0.22);
  }
  gauge() {
    this.tone(860, 0.05, "sine", 0.12);
  }
  perfect() {
    this.tone(1320, 0.1, "sine", 0.18);
    this.tone(1760, 0.18, "sine", 0.14, 0, 0.07);
  }
  ui() {
    this.tone(720, 0.05, "sine", 0.14);
  }
  /** 바깥 공기: 낮은 바람 + 가끔 새소리 */
  outdoors(windSpeed = 2) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (!this.windNode) {
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 420;
      const g = c.createGain();
      g.gain.value = 0.02;
      s.connect(f);
      f.connect(g);
      g.connect(this.master);
      s.start();
      this.windNode = { s, f, g };
    }
    const n = this.windNode;
    n.g.gain.setTargetAtTime(0.018 + windSpeed * 0.012, c.currentTime, 1.2);
    n.f.frequency.setTargetAtTime(320 + windSpeed * 90, c.currentTime, 1.2);
    if (!this.birdT) {
      const chirp = () => {
        this.birdT = setTimeout(chirp, 2600 + Math.random() * 6500);
        if (document.hidden) return;
        const base = 2300 + Math.random() * 1800;
        const count = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i += 1) this.tone(base * (1 + Math.random() * 0.12), 0.07, "sine", 0.018 + Math.random() * 0.02, i % 2 ? 1.22 : 0.84, i * 0.1);
      };
      chirp();
    }
  }
}
