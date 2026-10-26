/*
 * NEW 둥지디펜스 · 소리 (모두 WebAudio 로 합성 · 파일 없음 · 첫 터치 뒤에만)
 *  사이트 공용 AudioSystem(효과음 · 배경음악 · 사이트 음소거) 위에 이 게임 효과음과 월드별 환경음을 더한다.
 *  배경음악 · 효과음 크기는 따로 (0~1).
 */
import { AudioSystem } from "../../../js/blaster/audio.js?v=3";

export const MUSIC = {
  title: { bpm: 92, root: 60, scale: "major", prog: "bright", lead: "marimba", drums: "soft", pad: true, seed: 11, density: 0.45 },
  meadow: { bpm: 112, root: 62, scale: "major", prog: "bright", lead: "marimba", drums: "soft", pad: true, seed: 21, density: 0.55 },
  forest: { bpm: 104, root: 57, scale: "dorian", prog: "calm", lead: "pluck", drums: "soft", pad: true, seed: 41, density: 0.55 },
  ice: { bpm: 100, root: 64, scale: "minor", prog: "calm", lead: "bell", drums: "soft", pad: true, seed: 61, density: 0.5 },
  lava: { bpm: 128, root: 52, scale: "minor", prog: "minor", lead: "pluck", drums: "storm", pad: true, seed: 81, density: 0.62 },
  castle: { bpm: 118, root: 50, scale: "minor", prog: "boss", lead: "steel", drums: "storm", pad: true, seed: 101, density: 0.6 },
  boss: { bpm: 140, root: 52, scale: "minor", prog: "boss", lead: "pluck", drums: "boss", pad: true, seed: 131, density: 0.7 },
  victory: { bpm: 100, root: 64, scale: "major", prog: "island", lead: "bell", drums: "island", pad: true, seed: 151, density: 0.5 },
};
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class NestAudio extends AudioSystem {
  constructor(settings = {}) {
    super({ sfx: settings.sfx !== false, music: settings.music !== false });
    this.musicVol = settings.musicVol ?? 0.6;
    this.sfxVol = settings.sfxVol ?? 0.85;
    this.amb = null;
    this.ambKind = null;
    this.mood = null;
  }
  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVol();
  }
  applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxOn ? 0.8 * this.sfxVol : 0, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.42 * this.musicVol : 0, t, 0.05);
  }
  unlock() {
    super.unlock();
    this.applyVol();
    if (this.mood && !this.music) this.playMusic(MUSIC[this.mood]);
    if (this.ambKind && !this.amb) this.ambience(this.ambKind);
  }
  setSfx(on) {
    super.setSfx(on);
    this.applyVol();
  }
  setMusic(on) {
    super.setMusic(on);
    this.applyVol();
  }
  setMood(mood) {
    if (this.mood === mood && this.music) return;
    this.mood = mood;
    if (this.ctx) this.playMusic(MUSIC[mood]);
  }
  /** 월드 환경음 (바람 · 숲 · 눈보라 · 용암 · 성채) — 잡음을 걸러 계속 */
  ambience(kind) {
    this.ambKind = kind;
    if (!this.ctx) return;
    if (this.amb) {
      try {
        this.amb.src.stop();
      } catch (_) {}
      this.amb = null;
    }
    if (!kind) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    const cfg = { meadow: ["bandpass", 500, 0.6, 0.05], forest: ["bandpass", 1200, 2, 0.03], ice: ["highpass", 2200, 0.4, 0.05], lava: ["lowpass", 180, 1, 0.12], castle: ["lowpass", 320, 4, 0.07] }[kind] || ["lowpass", 400, 1, 0.04];
    f.type = cfg[0];
    f.frequency.value = cfg[1];
    f.Q.value = cfg[2];
    const g = c.createGain();
    g.gain.value = cfg[3];
    // 천천히 숨 쉬듯 (바람)
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.12;
    const lg = c.createGain();
    lg.gain.value = cfg[3] * 0.6;
    lfo.connect(lg);
    lg.connect(g.gain);
    lfo.start();
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start();
    this.amb = { src, lfo };
  }
  play(name, opt = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const now = this.ctx.currentTime;
    const gap = { hitArrow: 0.04, hitIce: 0.05, zap: 0.05, coin: 0.05, boom: 0.06, shoot: 0.05, dmg: 0.05 }[name];
    if (gap && this.lastPlay[name] && now - this.lastPlay[name] < gap) return;
    this.lastPlay[name] = now;
    switch (name) {
      case "click":
        return this.tone(880, 0.05, { type: "triangle", vol: 0.12 });
      case "place":
        this.tone(330, 0.12, { type: "triangle", vol: 0.2, slide: 2 });
        return this.tone(660, 0.18, { type: "sine", vol: 0.14, at: 0.08, slide: 1.5 });
      case "placeFail":
        return this.tone(220, 0.15, { type: "square", vol: 0.08, slide: -0.4 });
      case "arrow":
        return this.noise(0.06, { vol: 0.08, type: "bandpass", freq: 3000, to: 1200 });
      case "bomb":
        return this.tone(180, 0.12, { type: "sine", vol: 0.16, slide: 1.4 });
      case "ice":
        return this.tone(1400, 0.1, { type: "sine", vol: 0.08, slide: 0.6 });
      case "zap":
        this.noise(0.12, { vol: 0.12, type: "highpass", freq: 2500 });
        return this.tone(1200, 0.08, { type: "sawtooth", vol: 0.05, slide: -0.5 });
      case "cannon":
        this.noise(0.25, { vol: 0.2, type: "lowpass", freq: 600, to: 120 });
        return this.tone(90, 0.25, { type: "sine", vol: 0.25, slide: -0.5 });
      case "hitArrow":
        return this.tone(520 + Math.random() * 80, 0.04, { type: "triangle", vol: 0.06 });
      case "hitIce":
        return this.tone(1800, 0.06, { type: "sine", vol: 0.06, slide: -0.3 });
      case "boom":
        this.noise(0.35, { vol: 0.22 * (opt.big ? 1.4 : 1), type: "lowpass", freq: 900, to: 90 });
        return this.tone(70, 0.3, { type: "sine", vol: 0.2, slide: -0.4 });
      case "coin":
        this.tone(1320, 0.06, { type: "square", vol: 0.05 });
        return this.tone(1760, 0.08, { type: "square", vol: 0.04, at: 0.05 });
      case "upgrade":
        [0, 4, 7, 12].forEach((s, i) => this.tone(NOTE(72 + s), 0.12, { type: "triangle", vol: 0.12, at: i * 0.06 }));
        return;
      case "evolve":
        [0, 4, 7, 12, 16, 19].forEach((s, i) => this.tone(NOTE(67 + s), 0.16, { type: "triangle", vol: 0.14, at: i * 0.07 }));
        return this.noise(0.6, { vol: 0.05, type: "highpass", freq: 4000, at: 0.1 });
      case "sell":
        return this.tone(660, 0.12, { type: "triangle", vol: 0.1, slide: -0.4 });
      case "waveStart":
        this.tone(NOTE(67), 0.15, { type: "square", vol: 0.08 });
        return this.tone(NOTE(74), 0.25, { type: "square", vol: 0.08, at: 0.15 });
      case "waveClear":
        [0, 4, 7].forEach((s, i) => this.tone(NOTE(72 + s), 0.2, { type: "triangle", vol: 0.14, at: i * 0.1 }));
        return;
      case "bossIn":
        this.tone(55, 1.2, { type: "sawtooth", vol: 0.12, slide: 0.3 });
        this.noise(1, { vol: 0.1, type: "lowpass", freq: 300 });
        return [0, 3, 7].forEach((s, i) => this.tone(NOTE(45 + s), 0.5, { type: "square", vol: 0.07, at: 0.5 + i * 0.25 }));
      case "phase":
        return this.tone(110, 0.6, { type: "sawtooth", vol: 0.1, slide: 0.8 });
      case "nestHit":
        this.tone(160, 0.25, { type: "square", vol: 0.14, slide: -0.5 });
        return this.noise(0.15, { vol: 0.1, type: "bandpass", freq: 900 });
      case "warn":
        return this.tone(740, 0.12, { type: "square", vol: 0.07 });
      case "stun":
        return this.tone(400, 0.25, { type: "triangle", vol: 0.08, slide: -0.6 });
      case "heal":
        return this.tone(990, 0.15, { type: "sine", vol: 0.05, slide: 0.4 });
      case "shield":
        return this.tone(600, 0.2, { type: "sine", vol: 0.08, slide: 0.6 });
      case "shatter":
        return this.noise(0.25, { vol: 0.14, type: "highpass", freq: 3000, to: 1500 });
      case "card":
        return this.tone(NOTE(79), 0.2, { type: "triangle", vol: 0.12, slide: 0.2 });
      case "win":
        [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.tone(NOTE(67 + s), 0.22, { type: "triangle", vol: 0.15, at: i * 0.12 }));
        return;
      case "lose":
        [7, 5, 3, 0].forEach((s, i) => this.tone(NOTE(60 + s), 0.3, { type: "triangle", vol: 0.13, at: i * 0.18 }));
        return;
      case "summon":
        return this.tone(300, 0.3, { type: "sawtooth", vol: 0.05, slide: 1.2 });
      default:
        return super.play(name, opt);
    }
  }
}
