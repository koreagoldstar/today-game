/*
 * 드래곤 석상 대작전 · 소리
 *  바다 물총 대작전의 AudioSystem (WebAudio 합성 · 배경음악 · 사이트 공용 음소거 · 첫 터치 뒤에만 소리)을 쓰고
 *  이 게임 소리를 더한다: 등장 · 카운트다운 · 휘두르기 · 쾅 · 깨짐 · 팅(오답) · 하트 · 콤보 · 보상 · 게임 오버 · 승리 · 째깍
 */
import { AudioSystem } from "../../../js/blaster/audio.js?v=3";

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class DragonAudio extends AudioSystem {
  constructor(settings = {}) {
    super(settings);
    this.musicVol = settings.musicVol ?? 0.8;
    this.sfxVol = settings.sfxVol ?? 0.9;
  }
  /** 음악 · 효과음 크기 따로 (0~1, 0 이면 끔) */
  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVol();
  }
  applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxOn ? 0.75 * 1.2 * this.sfxVol : 0, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.32 * 1.25 * this.musicVol : 0, t, 0.05);
  }
  unlock() {
    super.unlock();
    this.applyVol();
  }
  setSfx(on) {
    super.setSfx(on);
    this.applyVol();
  }
  setMusic(on) {
    super.setMusic(on);
    this.applyVol();
  }
  play(name, opt = {}) {
    if (!this.ctx || !this.sfxOn || this.sfxVol <= 0) return;
    const now = performance.now();
    const gap = { tick: 200, tap: 40, step: 90, gem: 35, land: 80, thud: 90, warn: 250, fireWarn: 300, wind: 600, flame: 300, geyser: 300, crumble: 200, enemyHit: 60, bubble: 120, fireball: 150 }[name] || 25;
    if (now - (this.lastPlay["d" + name] || 0) < gap) return;
    this.lastPlay["d" + name] = now;
    const r = 1 + (Math.random() - 0.5) * 0.08;
    switch (name) {
      case "tap": // 버튼
        this.tone(880 * r, 0.06, { type: "triangle", vol: 0.08 });
        break;
      case "select": // 캐릭터 고르기
        this.tone(NOTE(76), 0.08, { type: "triangle", vol: 0.1 });
        this.tone(NOTE(83), 0.12, { type: "triangle", vol: 0.1, at: 0.07 });
        break;
      case "enter": // 등장 '슝 · 띠링'
        this.noise(0.35, { vol: 0.08, type: "bandpass", freq: 700, to: 2600, q: 1.5 });
        [0, 4, 7, 12].forEach((s, i) => this.tone(NOTE(72 + s), 0.18, { type: "triangle", vol: 0.09, at: 0.18 + i * 0.07 }));
        break;
      case "rise": // 석상이 솟아오름 '드르륵'
        this.noise(0.4, { vol: 0.09, type: "lowpass", freq: 380, to: 160 });
        this.tone(70, 0.35, { type: "sine", vol: 0.12, slide: 1.3 });
        break;
      case "count": // 3 · 2 · 1
        this.tone(NOTE(72), 0.16, { type: "square", vol: 0.05 });
        this.tone(NOTE(72), 0.16, { type: "sine", vol: 0.1 });
        break;
      case "go":
        this.tone(NOTE(84), 0.32, { type: "square", vol: 0.05 });
        this.tone(NOTE(79), 0.32, { type: "sine", vol: 0.12 });
        this.tone(NOTE(88), 0.4, { type: "sine", vol: 0.08, at: 0.05 });
        break;
      case "hop": // 깡충
        this.tone(420 * r, 0.09, { type: "sine", vol: 0.08, slide: 1.8 });
        break;
      case "swing": // 휘익
        this.noise(0.18, { vol: 0.13, type: "bandpass", freq: 900, to: 2400, q: 2.4 });
        break;
      case "hit": // 쾅 (정답 · 돌 깨짐)
        this.tone(95, 0.3, { type: "sine", vol: 0.32, slide: 0.45 });
        this.noise(0.12, { vol: 0.25, type: "lowpass", freq: 1800 });
        this.noise(0.5, { vol: 0.14, type: "bandpass", freq: 3000, to: 900, q: 0.8, at: 0.04 });
        for (let i = 0; i < 6; i++) this.tone((1800 + Math.random() * 2600) * r, 0.05, { type: "triangle", vol: 0.04, at: 0.08 + i * 0.045 });
        break;
      case "success": // 정답 반짝 아르페지오
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone(NOTE(76 + s), 0.2, { type: "triangle", vol: 0.1, at: 0.12 + i * 0.065 }));
        this.tone(NOTE(100), 0.6, { type: "sine", vol: 0.05, at: 0.5 });
        break;
      case "bonk": // 틀림: 방망이 '팅' + 뾰잉
        this.tone(1650 * r, 0.16, { type: "triangle", vol: 0.12 });
        this.tone(2480 * r, 0.1, { type: "sine", vol: 0.05 });
        this.tone(520, 0.35, { type: "sine", vol: 0.1, at: 0.06, slide: 0.55, curve: 0.4 });
        break;
      case "heart": // 하트 깨짐
        this.tone(NOTE(67), 0.14, { type: "triangle", vol: 0.1 });
        this.tone(NOTE(63), 0.14, { type: "triangle", vol: 0.1, at: 0.12 });
        this.tone(NOTE(58), 0.3, { type: "triangle", vol: 0.1, at: 0.24 });
        break;
      case "combo": {
        const n = Math.min(8, opt.n || 2);
        for (let i = 0; i < Math.min(5, n); i++) this.tone(NOTE(79 + i * 2 + n), 0.1, { type: "square", vol: 0.035, at: i * 0.05 });
        this.tone(NOTE(91 + Math.min(6, n)), 0.3, { type: "sine", vol: 0.08, at: 0.22 });
        break;
      }
      case "fairy": // 요정 '뾰로롱'
        for (let i = 0; i < 6; i++) this.tone(NOTE(88 + (i % 3) * 4 + Math.floor(i / 3) * 2), 0.08, { type: "sine", vol: 0.07, at: i * 0.05 });
        break;
      case "reward": // 새 친구 · 새 방망이
        [0, 4, 7, 12].forEach((s, i) => this.tone(NOTE(72 + s), 0.24, { type: "triangle", vol: 0.12, at: i * 0.1 }));
        [0, 4, 7].forEach((s) => this.tone(NOTE(84 + s), 0.7, { type: "sine", vol: 0.06, at: 0.42 }));
        break;
      case "tick": // 남은 시간 경고
        this.tone(1320, 0.04, { type: "square", vol: 0.035 });
        break;
      case "timeout":
        this.tone(NOTE(64), 0.22, { type: "sawtooth", vol: 0.05 });
        this.tone(NOTE(60), 0.4, { type: "sawtooth", vol: 0.05, at: 0.2 });
        break;
      case "hint":
        this.tone(NOTE(84), 0.1, { type: "sine", vol: 0.08 });
        this.tone(NOTE(91), 0.2, { type: "sine", vol: 0.07, at: 0.08 });
        break;
      case "roar": // 보스 수호자 '우르릉'
        this.noise(0.9, { vol: 0.16, type: "lowpass", freq: 420, to: 140 });
        this.tone(68, 0.9, { type: "sawtooth", vol: 0.06, slide: 0.7, curve: 0.6 });
        break;
      case "seal": // 보스 봉인 하나 깨짐
        this.tone(NOTE(84), 0.3, { type: "sine", vol: 0.12 });
        this.tone(NOTE(91), 0.4, { type: "sine", vol: 0.08, at: 0.06 });
        this.noise(0.3, { vol: 0.08, type: "highpass", freq: 3500 });
        break;
      case "over": // 게임 오버 (부드럽게)
        [7, 4, 0, -5].forEach((s, i) => this.tone(NOTE(72 + s), 0.3, { type: "triangle", vol: 0.1, at: i * 0.2 }));
        break;
      case "win": // 승리 팡파레
        [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.tone(NOTE(72 + s), i === 6 ? 0.8 : 0.16, { type: "square", vol: 0.045, at: i * 0.12 }));
        [0, 4, 7, 12].forEach((s, i) => this.tone(NOTE(60 + s), 1.1, { type: "triangle", vol: 0.07, at: 0.72 }));
        break;
      case "clear": // 스테이지 통과
        [0, 7, 12].forEach((s, i) => this.tone(NOTE(79 + s), 0.18, { type: "triangle", vol: 0.1, at: i * 0.09 }));
        break;
      /* ---------- 모험 ---------- */
      case "step": // 발소리 (작게)
        this.noise(0.05, { vol: 0.05, type: "lowpass", freq: 700 * r });
        this.tone(160 * r, 0.05, { type: "sine", vol: 0.04, slide: 0.7 });
        break;
      case "jump": // 퐁
        this.tone(330 * r, 0.14, { type: "triangle", vol: 0.1, slide: 2.1 });
        this.noise(0.08, { vol: 0.04, type: "highpass", freq: 2500 });
        break;
      case "land": {
        const k = 0.5 + (opt.k || 0.5) * 0.8;
        this.tone(120 * r, 0.12, { type: "sine", vol: 0.12 * k, slide: 0.6 });
        this.noise(0.1, { vol: 0.07 * k, type: "lowpass", freq: 600 });
        break;
      }
      case "dash": // 휙
        this.noise(0.22, { vol: 0.12, type: "bandpass", freq: 600, to: 3200, q: 1.8 });
        this.tone(500, 0.18, { type: "sine", vol: 0.05, slide: 1.8 });
        break;
      case "gem": {
        // 수정 소리: 콤보가 이어질수록 높아진다
        const n = Math.min(12, opt.n || 0);
        const f = NOTE(84 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][n]);
        this.tone(f, 0.12, { type: "sine", vol: 0.09 });
        this.tone(f * 2, 0.08, { type: "sine", vol: 0.035, at: 0.02 });
        break;
      }
      case "bigGem":
        [0, 4, 7, 12, 16, 19].forEach((s2, i) => this.tone(NOTE(81 + s2), 0.16, { type: "triangle", vol: 0.09, at: i * 0.05 }));
        this.tone(NOTE(105), 0.5, { type: "sine", vol: 0.05, at: 0.3 });
        break;
      case "enemyHit": // 콩
        this.tone(520 * r, 0.1, { type: "square", vol: 0.05, slide: 0.6 });
        this.tone(260 * r, 0.12, { type: "sine", vol: 0.12, slide: 0.5 });
        this.noise(0.06, { vol: 0.08, type: "bandpass", freq: 2200, q: 2 });
        break;
      case "defeat": // 퐁 사라짐
        this.tone(420, 0.25, { type: "triangle", vol: 0.1, slide: 2.4 });
        [0, 7, 12].forEach((s2, i) => this.tone(NOTE(84 + s2), 0.1, { type: "sine", vol: 0.06, at: 0.08 + i * 0.05 }));
        break;
      case "break": // 와장창 (나무)
        this.noise(0.25, { vol: 0.16, type: "bandpass", freq: 1400, to: 500, q: 0.9 });
        for (let i = 0; i < 4; i++) this.tone((300 + Math.random() * 400) * r, 0.06, { type: "triangle", vol: 0.05, at: i * 0.04 });
        break;
      case "hurt": // 아야
        this.tone(NOTE(70), 0.12, { type: "square", vol: 0.05, slide: 0.7 });
        this.tone(NOTE(62), 0.2, { type: "triangle", vol: 0.1, at: 0.08, slide: 0.8 });
        break;
      case "checkpoint":
        [0, 4, 7].forEach((s2, i) => this.tone(NOTE(79 + s2), 0.16, { type: "triangle", vol: 0.09, at: i * 0.07 }));
        break;
      case "warn": // 조심 (짧은 경고)
        this.tone(880, 0.07, { type: "square", vol: 0.035 });
        this.tone(880, 0.07, { type: "square", vol: 0.035, at: 0.12 });
        break;
      case "fireWarn": // 부글부글
        this.noise(0.5, { vol: 0.07, type: "lowpass", freq: 300, to: 700 });
        break;
      case "flame": // 화르륵
        this.noise(0.55, { vol: 0.12, type: "bandpass", freq: 900, to: 400, q: 0.7 });
        break;
      case "geyser": // 촤아
        this.noise(0.6, { vol: 0.1, type: "highpass", freq: 1800, to: 900 });
        break;
      case "wind": // 휘이잉
        this.noise(1.2, { vol: 0.07, type: "bandpass", freq: 500, to: 1400, q: 3 });
        break;
      case "crumble": // 우르르
        this.noise(0.4, { vol: 0.1, type: "lowpass", freq: 500, to: 200 });
        this.tone(90, 0.3, { type: "sine", vol: 0.08, slide: 0.7 });
        break;
      case "thud": // 쿵
        this.tone(80 * r, 0.22, { type: "sine", vol: 0.16, slide: 0.5 });
        this.noise(0.12, { vol: 0.08, type: "lowpass", freq: 500 });
        break;
      case "bubble": // 뽀글 발사
        this.tone(600 * r, 0.12, { type: "sine", vol: 0.08, slide: 0.6 });
        break;
      case "fireball":
        this.noise(0.3, { vol: 0.08, type: "bandpass", freq: 700, q: 1 });
        break;
      case "fall": // 휘이 떨어짐
        this.tone(700, 0.6, { type: "sine", vol: 0.08, slide: 0.3, curve: 0.5 });
        break;
      case "splash": // 첨벙
        this.noise(0.5, { vol: 0.16, type: "bandpass", freq: 1200, to: 400, q: 0.8 });
        this.tone(220, 0.2, { type: "sine", vol: 0.08, slide: 0.6 });
        break;
      case "rumble": // 보스가 깨어남
        this.noise(1.4, { vol: 0.16, type: "lowpass", freq: 200, to: 120 });
        this.tone(55, 1.2, { type: "sawtooth", vol: 0.05, slide: 1.3, curve: 0.6 });
        break;
      case "bossWarn": // 보스 공격 예고
        this.tone(220, 0.35, { type: "sawtooth", vol: 0.05, slide: 1.6, curve: 0.6 });
        this.noise(0.3, { vol: 0.06, type: "lowpass", freq: 400 });
        break;
      case "bossCharge":
        this.noise(0.6, { vol: 0.1, type: "lowpass", freq: 300, to: 600 });
        this.tone(110, 0.6, { type: "sawtooth", vol: 0.05, slide: 1.5 });
        break;
      case "slam": // 쿠웅 충격파
        this.tone(60, 0.6, { type: "sine", vol: 0.3, slide: 0.5 });
        this.noise(0.5, { vol: 0.2, type: "lowpass", freq: 900, to: 150 });
        break;
      case "crash": // 벽에 쾅
        this.tone(70, 0.5, { type: "sine", vol: 0.3, slide: 0.5 });
        this.noise(0.4, { vol: 0.2, type: "bandpass", freq: 1500, to: 400, q: 0.7 });
        for (let i = 0; i < 5; i++) this.tone(1200 + Math.random() * 2000, 0.05, { type: "triangle", vol: 0.04, at: 0.1 + i * 0.05 });
        break;
      case "bossHit": // 약점 명중
        this.tone(NOTE(76), 0.12, { type: "square", vol: 0.06 });
        this.tone(NOTE(88), 0.25, { type: "sine", vol: 0.12, at: 0.05 });
        this.noise(0.2, { vol: 0.12, type: "highpass", freq: 3000 });
        this.tone(90, 0.3, { type: "sine", vol: 0.2, slide: 0.5 });
        break;
      case "bossDown": // 보스가 무너짐
        this.noise(1.6, { vol: 0.2, type: "lowpass", freq: 600, to: 120 });
        this.tone(70, 1.4, { type: "sine", vol: 0.25, slide: 0.4 });
        [0, 4, 7, 12, 16].forEach((s2, i) => this.tone(NOTE(72 + s2), 0.3, { type: "triangle", vol: 0.08, at: 0.9 + i * 0.1 }));
        break;
      default:
        super.play(name, opt);
    }
  }
}
