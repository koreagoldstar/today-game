/*
 * 제트스키 썬더 레이스 · 게임 (흐름 · 루프 · 이벤트 연출)
 *  menu(배경에서 데모 레이스가 달린다) → brief(코스 소개) → race → result
 */
import { setupCanvas, W, H, HZ, PY, clamp, lerp, rand } from "./view.js?v=1";
import { Track } from "./track.js?v=1";
import { Renderer, PSCALE } from "./render.js?v=1";
import { Effects } from "./fx.js?v=1";
import { Race } from "./race.js?v=1";
import { Input } from "./input.js?v=1";
import { RaceAudio } from "./audio.js?v=1";
import { Save } from "./save.js?v=1";
import { UI } from "./ui.js?v=1";
import { COURSES, THEMES, RACERS } from "./data.js?v=1";

export class Game {
  constructor({ canvas, host }) {
    this.canvas = canvas;
    this.view = setupCanvas(canvas, host, () => {
      if (this.renderer) this.renderer.rebuild();
    });
    this.ctx = this.view.ctx;
    this.save = new Save();
    this.audio = new RaceAudio(this.save.settings);
    this.fx = new Effects();
    this.renderer = new Renderer(this.view);
    this.input = new Input(canvas, this.view);
    this.courses = COURSES;
    this.state = "menu";
    this.time = 0;
    this.race = null;
    this.courseIndex = this.lastPlayable();
    this.ui = new UI(this);
    this.input.onPause = () => (this.state === "race" ? this.pause() : this.state === "paused" ? this.resume() : null);
    this.input.onAny = () => this.audio.unlock();
    const wake = () => {
      this.audio.unlock();
      if (this.state === "menu" && !this.menuMusic) this.playMenuMusic();
    };
    window.addEventListener("pointerdown", wake, { passive: true });
    window.addEventListener("keydown", wake);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "race") this.pause();
    });
    this.startDemo();
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  /** 마지막으로 열린(만들어진) 코스 */
  lastPlayable() {
    let i = clamp(this.save.data.unlocked - 1, 0, COURSES.length - 1);
    while (i > 0 && COURSES[i].soon) i--;
    return i;
  }

  isUnlocked(i) {
    return i < this.save.data.unlocked && !COURSES[i].soon;
  }

  /* ---------------- 메뉴 배경 데모 ---------------- */
  startDemo() {
    const c = COURSES[0];
    const track = new Track(c);
    this.fx.reset();
    this.demo = new Race({ course: c, track, fx: this.fx, audio: this.audio, demo: true });
    // 경치 좋은 곳부터
    for (const r of this.demo.racers) {
      r.z += 120;
      r.Y = track.heightAt(r.z);
    }
    this.renderer.setTheme(THEMES[c.theme], c.theme);
    this.race = this.demo;
  }

  playMenuMusic() {
    this.menuMusic = true;
    this.audio.playMusic({ bpm: 118, root: 60, scale: "major", prog: "island", lead: "marimba", drums: "island", seed: 77, density: 0.5 });
  }

  /* ---------------- 레이스 ---------------- */
  startRace(index) {
    const c = COURSES[index];
    if (!c || c.soon) return;
    this.courseIndex = index;
    this.audio.unlock();
    this.fx.reset();
    const track = new Track(c);
    this.race = new Race({ course: c, track, fx: this.fx, audio: this.audio, events: (n, d) => this.onEvent(n, d) });
    this.renderer.setTheme(THEMES[c.theme], c.theme);
    this.renderer.camX = 0;
    this.state = "race";
    this.input.enabled = true;
    this.input.release();
    this.menuMusic = false;
    this.audio.stopMusic();
    this.audio.engineOn();
    this.ui.enterRace(c);
  }

  retry() {
    this.startRace(this.courseIndex);
  }

  pause() {
    if (this.state !== "race") return;
    this.state = "paused";
    this.input.release();
    this.audio.engineSet(0, false, false, true);
    this.audio.stopMusic();
    this.ui.showPause(true);
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "race";
    this.last = performance.now();
    if (this.race && this.race.state !== "intro" && this.race.state !== "count") this.audio.playMusic(this.race.course.music);
    this.ui.showPause(false);
  }

  toMenu() {
    this.state = "menu";
    this.input.enabled = false;
    this.input.release();
    this.audio.engineOff();
    this.audio.stopMusic();
    this.startDemo();
    this.playMenuMusic();
  }

  /* ---------------- 레이스 이벤트 → 연출 ---------------- */
  onEvent(name, d) {
    const fx = this.fx;
    const au = this.audio;
    const py = PY - 250;
    switch (name) {
      case "count":
        fx.showBanner(String(d.n), { kind: "count", size: 170, life: 0.85, color: "#ffffff", color2: "#bff1ff", stroke: "#0a2f5c" });
        au.play("count");
        this.ui.startHint(true);
        this.haptic(15);
        break;
      case "go":
        fx.showBanner("GO!", { kind: "count", size: 160, life: 0.75, color: "#fff6a0", color2: "#ffb52e", stroke: "#7a2f00" });
        fx.flash(0.35, "#ffffff");
        fx.speedLines = 1;
        au.play("go");
        au.playMusic(this.race.course.music);
        this.ui.startHint(false);
        this.ui.steerHint();
        this.haptic(30);
        break;
      case "perfectStart":
        fx.text("PERFECT START!", W / 2, py, { size: 38, color: "#fff36b", stroke: "#7a2f00", punch: true, life: 1.1, sub: "+100" });
        fx.flash(0.2, "#fff6c0");
        au.play("boost");
        this.ui.bonusBump();
        break;
      case "boost":
        fx.text("BOOST!", W / 2, py, { size: d.src === "pad" ? 40 : 46, color: "#8ff4ff", stroke: "#063a6e", punch: true, life: 0.75, slot: "boost" });
        fx.flash(0.12, "#c9f6ff");
        fx.speedLines = 1;
        au.play("boost");
        this.ui.boostFired();
        this.haptic(20);
        break;
      case "boostChain":
        fx.text("BOOST CHAIN!", W / 2, py - 60, { size: 34, color: "#fff36b", stroke: "#7a2f00", punch: true, life: 1, sub: "+300", slot: "chain" });
        au.play("chain");
        this.ui.bonusBump();
        break;
      case "orb":
        fx.text(d.gauge % 1 === 0 ? "BOOST +1" : "+½", W / 2 + 90, PY - 170, { size: 24, color: "#bff6ff", stroke: "#063a6e", life: 0.7, rise: 40, slot: "orb" });
        au.play("orb", { n: Math.round(d.gauge) * 2 });
        this.ui.gaugeBump();
        break;
      case "jump":
        fx.text(d.perfect ? "PERFECT JUMP!" : "JUMP!", W / 2, py - 40, { size: d.perfect ? 40 : 44, color: d.perfect ? "#fff36b" : "#ffffff", stroke: d.perfect ? "#7a2f00" : "#063a6e", punch: true, life: 0.8, slot: "jump" });
        au.play("jump");
        break;
      case "land":
        this.renderer.landBump(3 + d.power * 3);
        au.play("land", { power: Math.min(1.2, d.power / 1.6) });
        if (d.power > 1.5) fx.wetScreen(6);
        if (d.perfect) {
          fx.text("PERFECT LANDING!", W / 2, py, { size: 36, color: "#fff36b", stroke: "#7a2f00", punch: true, life: 1.1, sub: "+200", slot: "land" });
          fx.flash(0.18, "#fff6c0");
          au.play("perfectLand");
          this.ui.bonusBump();
          this.haptic(25);
        }
        break;
      case "crash":
        fx.text("CRASH!", W / 2, py, { size: 44, color: "#ffb0a0", stroke: "#6b1010", punch: true, life: 0.8, slot: "crash" });
        fx.shake(7);
        fx.wetScreen(8);
        au.play("crash");
        this.haptic(70);
        break;
      case "bump":
        au.play("bump");
        fx.shake(3);
        this.haptic(20);
        break;
      case "overtake": {
        // 한 번에 하나만 (연속 추월이면 바꿔 뜬다) · 하늘 쪽 고정 자리
        fx.text("OVERTAKE!", W / 2, HZ - 34, { size: 34, color: "#ffffff", stroke: "#0a2f5c", punch: true, life: 0.9, rise: 24, sub: `+${d.points}`, slot: "ovt" });
        if (d.combo >= 2) fx.text(`COMBO ×${d.combo}`, W / 2, HZ - 96, { size: 30, color: d.combo >= 4 ? "#ff8ad0" : "#ffe14a", stroke: "#4a1060", punch: true, life: 1, rise: 20, slot: "combo" });
        au.play("overtake", { combo: d.combo });
        this.ui.posBump();
        this.ui.bonusBump();
        this.haptic(12);
        break;
      }
      case "finish":
        if (this.race.course.grand) {
          fx.showBanner("GRAND OCEAN GP", { size: 74, life: 2.6, color: "#fff6c0", color2: "#ffb52e", stroke: "#4a1a00", sub: d.place === 1 ? "CHAMPION! 우승을 축하해요!" : `FINISH! ${d.place}위` });
          this.fireworksT = 3;
        } else fx.showBanner("FINISH!", { size: 130, life: 2.4, color: "#ffffff", color2: "#ffd23f", stroke: "#0a2f5c", sub: d.place === 1 ? "1등으로 결승!" : `${d.place}위로 결승!` });
        fx.flash(0.4, "#ffffff");
        fx.burstConfetti(d.place === 1 ? 110 : 60);
        au.stopMusic();
        au.play("finish");
        this.ui.finishFlash();
        this.haptic(60);
        break;
      case "done":
        this.finishRace();
        break;
      case "lightGate":
        fx.text("LIGHT GATE", W / 2, PY - 300, { size: 30, color: "#fff6b0", stroke: "#3a2a6e", punch: true, life: 0.8, sub: "BOOST +½", slot: "gate" });
        au.play("orb", { n: 4 });
        this.ui.gaugeBump();
        break;
      case "warn":
        if (d.o.hazard === "zap" && d.dist < 110) au.play("warnBeep");
        break;
      case "strike":
        if (d.dist < 140 && d.dist > -6) {
          if (d.o.hazard === "zap") {
            au.play("zap");
            fx.flash(0.08 + 0.18 * (1 - d.dist / 140), "#e8f0ff");
          } else if (d.o.hazard === "geyser") au.play("steam");
          else au.play("splashBig");
        }
        break;
      case "hazardHit": {
        const t = d.o.hazard === "zap" ? "찌릿!" : d.o.hazard === "geyser" ? "푸슉!" : "철썩!";
        fx.text(t, W / 2, py - 70, { size: 40, color: "#ffffff", stroke: "#4a1060", punch: true, life: 0.8, slot: "hz" });
        break;
      }
      default:
        break;
    }
  }

  haptic(ms) {
    if (!this.save.settings.vibrate || !navigator.vibrate) return;
    try {
      navigator.vibrate(ms);
    } catch (_) {}
  }

  finishRace() {
    const race = this.race;
    const c = race.course;
    const res = race.results();
    const me = res.find((r) => r.isPlayer);
    const time = me.time * 1000;
    const rec = this.save.record(c, this.courseIndex, COURSES.length, { time, place: me.place });
    const grand = COURSES.every((k) => !k.soon) && this.save.checkGrandMaster(COURSES);
    this.state = "result";
    this.input.enabled = false;
    this.input.release();
    this.audio.engineSet(0.3, false, false, true);
    if (rec.medal > 0) setTimeout(() => this.audio.play(rec.newBest ? "record" : "medal"), 500);
    this.ui.showResult({ course: c, index: this.courseIndex, time, place: me.place, results: res, rec, bonus: race.bonus, stats: race.stats, grand });
  }

  /** 코스 선택 카드용 미리보기: 실제 렌더러로 경쟁자가 달리는 장면을 한 장 */
  renderPreview(c) {
    if (!this.prevR) this.prevR = new Renderer(this.view);
    const r = this.prevR;
    const track = new Track(c);
    const race = new Race({ course: c, track, fx: new Effects(), audio: null, demo: true });
    const z0 = c.preview || 150;
    const lay = [
      [0, 0],
      [16, -3.6],
      [23, 3.2],
      [31, -0.8],
      [40, 4.6],
    ];
    race.racers.forEach((q, i) => {
      q.z = z0 + lay[i][0];
      q.x = lay[i][1];
      q.v = race.vmax * 0.9;
      q.vx = (i % 2 ? 1 : -1) * 2;
      q.Y = track.heightAt(q.z);
      race.pose(q, 1, 10);
    });
    r.setTheme(THEMES[c.theme], c.theme);
    r.updateCamera(track, race.player, 1, 0.85, 0);
    const cv = document.createElement("canvas");
    cv.width = 432;
    cv.height = 270;
    const ctx = cv.getContext("2d");
    const sc = cv.width / W;
    ctx.scale(sc, sc);
    ctx.translate(0, -(HZ - 150));
    r.render(ctx, race, 0.6);
    return cv.toDataURL("image/jpeg", 0.86);
  }

  /* ---------------- 루프 ---------------- */
  frame(now) {
    const dt = Math.min(1 / 30, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    try {
      this.update(dt);
      this.draw();
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(this.frame);
  }

  update(dt) {
    const race = this.race;
    if (!race) return;
    if (this.state === "paused") return;
    const playing = this.state === "race";
    if (playing) this.input.update(dt);
    race.update(dt, playing ? this.input : null);
    const p = race.state === "intro" || race.state === "count" ? race.player : race.player;
    const sp = clamp(p.v / race.vmax, 0, 1.3);
    this.renderer.updateCamera(race.track, p, dt, sp, p.boostT > 0 ? 1 : 0);
    race.camZ = this.renderer.camZ;
    this.fx.update(dt, race.track);
    // 폭풍 테마: 가끔 하늘에서 번개 (경고 없는 배경 번개 — 코스에 떨어지지 않는다)
    const T = this.renderer.theme;
    if (T && T.lightning && this.state !== "paused") {
      this.skyT = (this.skyT == null ? rand(2, 4) : this.skyT) - dt;
      if (this.skyT <= 0) {
        this.skyT = rand(3.5, 7);
        this.renderer.skyBolt = { x: rand(40, W - 40), t: 0.32, seed: Math.floor(rand(0, 9999)) };
        this.fx.flash(0.2, "#e6eeff");
        setTimeout(() => this.audio.play("thunder"), 260);
      }
    }
    if (this.renderer.skyBolt) this.renderer.skyBolt.t -= dt;
    // 그랜드 오션 GP: 마지막 직선과 결승에서 불꽃놀이
    if (race.course && race.course.grand && this.state !== "paused") {
      const near = race.player.z > race.track.length - 240;
      if (this.fireworksT > 0) this.fireworksT -= dt;
      if (near || this.fireworksT > 0) {
        this.fwT = (this.fwT || 0) - dt;
        if (this.fwT <= 0) {
          this.fwT = this.fireworksT > 0 ? 0.28 : 0.7;
          const cols = ["#ff5d8f", "#ffd23f", "#4fd1c5", "#7c83fd", "#ff9f43", "#ffffff"];
          this.fx.firework(rand(60, W - 60), rand(HZ * 0.25, HZ * 0.8), cols[Math.floor(rand(0, cols.length))]);
          if (this.state === "race" || this.state === "result") this.audio.play("pop");
        }
      }
    }
    // 속도감 효과
    const wantLines = p.boostT > 0 ? 0.9 : clamp((sp - 0.82) * 3, 0, 0.45);
    this.fx.speedLines = lerp(this.fx.speedLines, playing || this.state === "result" ? wantLines : wantLines * 0.5, Math.min(1, dt * 4));
    this.fx.boostGlow = lerp(this.fx.boostGlow, p.boostT > 0 ? 1 : 0, Math.min(1, dt * 6));
    if (playing || this.state === "result") this.audio.engineSet(race.state === "count" || race.state === "intro" ? 0.12 + (race.stateT % 0.9 < 0.2 ? 0.25 : 0) : sp, p.boostT > 0, p.air, race.state !== "race");
    if (playing) {
      this.ui.hud(race);
      this.input.endFrame();
    }
  }

  draw() {
    const ctx = this.ctx;
    this.view.resetTransform();
    const race = this.race;
    if (!race) return;
    ctx.save();
    ctx.translate(this.fx.shakeX, this.fx.shakeY);
    this.renderer.render(ctx, race, race.clock);
    ctx.restore();
    // 터널 안은 어둑하게 (가장자리가 더 어둡다)
    const tun = race.track.tunnels.length ? race.track.tunnelAt(this.renderer.camZ + 6) : 0;
    if (tun > 0.01) {
      const g = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.18, W / 2, H * 0.55, H * 0.8);
      g.addColorStop(0, `rgba(10,6,30,${0.15 * tun})`);
      g.addColorStop(1, `rgba(10,6,30,${0.62 * tun})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    const T = this.renderer.theme;
    if (T && T.weather) {
      const pl = race.player;
      this.fx.drawWeather(ctx, this.time, T.weather, race.track.winds.length ? race.track.windAt(pl.z) : T.weather.wind || 0, clamp(pl.v / race.vmax, 0, 1.3));
    }
    this.fx.drawScreen(ctx, this.time);
    if (this.state === "race" && this.input.touching && race.state === "race") this.drawSteer(ctx);
  }

  /** 손가락 조향 표시: 아래쪽 반투명 막대 위로 손잡이가 움직인다 */
  drawSteer(ctx) {
    const s = this.input.steer;
    const y = H - 34;
    const w = 150;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(6,30,62,0.55)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(W / 2 - w, y);
    ctx.lineTo(W / 2 + w, y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(W / 2, y);
    ctx.lineTo(W / 2 + s * w, y);
    ctx.stroke();
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(W / 2 + s * w, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#7a2f00";
    ctx.stroke();
    ctx.restore();
  }
}
