/*
 * 자석 대소동 · 게임 진행 (고정 걸음 물리 · 화면 그리기 · 연출 · 화면 전환)
 *  물리는 1/120초 고정 걸음으로만 (화면이 느려도 결과가 같음) · 탭이 숨으면 멈추고 시간을 쌓지 않음
 */
import { DT } from "./physics.js?v=1";
import { createGame, stepGame, starsOf, MAG } from "./sim.js?v=1";
import { STAGES, DAILY } from "./levels.js?v=1";
import { drawBackdrop, drawWalls, drawObject, drawDevices, drawMagnetField, drawRobot, drawFx, SKINS, C } from "./render.js?v=1";
import { Input } from "./input.js?v=1";
import { MagAudio } from "./audio.js?v=1";
import { Save, seoulDate } from "./save.js?v=1";
import { UI } from "./ui.js?v=1";

const TAU = Math.PI * 2;

/* 오늘의 자석 실험: 서울 날짜 → 모음에서 하나 (고정된 순서로 섞어 모두 같은 판) */
const EPOCH = Date.UTC(2026, 0, 1);
export function dailyFor(date) {
  const [y, m, d] = date.split("-").map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
  const n = DAILY.length;
  const perm = [...Array(n).keys()];
  let seed = 20261025;
  for (let i = n - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const j = seed % (i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return DAILY[perm[((days % n) + n) % n]];
}

export class Game {
  constructor({ canvas, field }) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) throw new Error("캔버스를 쓸 수 없어요");
    this.field = field;
    this.save = new Save();
    this.audio = new MagAudio();
    this.audio.setOn(this.save.data.settings.sound !== false);
    this.input = new Input();
    this.input.onPause = () => this.ui.togglePause();
    this.input.onRestart = () => this.mode === "play" && (this.G && (this.G.won || this.G.failed) ? this.restart() : this.ui.askRestart());
    this.applyReduced();
    this.mode = "menu";
    this.G = null;
    this.kind = "stage";
    this.paused = false;
    this.acc = 0;
    this.time = 0;
    this.shake = 0;
    this.fx = [];
    this.A = { hop: 0, sx: 1, sy: 1, spin: 0, face: "idle", faceT: 0, land: 0, wasGround: true, vy: 0, blink: 0, dance: 0 };
    this.view = { scale: 1, ox: 0, oy: 0, follow: false, fit: false, camX: 0 };
    this.bg = document.createElement("canvas");
    this.speed = 1; // 점검용 (시간 빠르게)
    this.ui = new UI(this);
    window.addEventListener("resize", () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(field);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.mode === "play" && this.G && !this.G.won && !this.G.failed && !this.paused) this.ui.openPause();
    });
    this.resize();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    this.ui.showTitle();
  }
  applyReduced() {
    const r = this.save.data.settings.reduced;
    this.reduced = r == null ? !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) : !!r;
    document.body.classList.toggle("reduced", this.reduced);
  }
  skin() {
    return SKINS.find((s) => s.id === this.save.data.skin) || SKINS[0];
  }

  /* ---------------- 판 시작 ---------------- */
  start(def, kind = "stage", extra = {}) {
    this.G = createGame(def);
    this.kind = kind;
    this.extra = extra;
    this.def = def;
    this.mode = "play";
    this.paused = false;
    this.acc = 0;
    this.shake = 0;
    this.fx = [];
    this.screws = [];
    this.A = { hop: 0, sx: 1, sy: 1, spin: 0, face: "idle", faceT: 0, land: 0, wasGround: true, vy: 0, blink: 0, dance: 0 };
    this.input.reset();
    this.input.enabled = true;
    this.audio.humOff();
    this.ended = false;
    this.resize();
    this.ui.enterPlay();
  }
  startStage(id) {
    const def = STAGES.find((s) => s.id === id);
    if (def) this.start(def, "stage");
  }
  startDaily(date = seoulDate()) {
    this.start(dailyFor(date), "daily", { date });
  }
  restart() {
    if (!this.def) return;
    this.start(this.def, this.kind, this.extra);
  }
  toMenu() {
    this.mode = "menu";
    this.G = null;
    this.input.enabled = false;
    this.input.reset();
    this.audio.humOff();
    this.paused = false;
  }
  setPaused(p) {
    this.paused = p;
    this.input.reset();
    if (p) this.audio.humOff();
    else if (this.G && this.G.mag.on) this.audio.humOn(this.G.mag.pole);
  }

  /* ---------------- 화면 크기 · 카메라 ---------------- */
  resize() {
    const r = this.field.getBoundingClientRect();
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    const G = this.G;
    if (!G) return;
    const ins = this.ui.insets();
    const aw = this.W - ins.left - ins.right;
    const ah = this.H - ins.top - ins.bottom;
    const fit = Math.min(aw / G.W, ah / G.H);
    const V = this.view;
    // 세로 휴대폰처럼 전체를 맞추면 너무 작을 때: 높이에 맞추고 마그를 따라감 (전체 보기 버튼으로 바꿀 수 있음)
    V.canFollow = fit < 0.62 && ah / G.H > fit * 1.25;
    V.follow = V.canFollow && !V.fit;
    // 따라가기 배율: 판의 절반쯤(520)이 보이게 (너무 크게 당기면 퍼즐이 안 보임)
    V.scale = V.follow ? Math.min(ah / G.H, Math.max(fit, aw / 520), 1.3) : fit;
    V.ox = ins.left + (aw - G.W * V.scale) / 2;
    V.oy = ins.top + (ah - G.H * V.scale) / 2;
    V.aw = aw;
    V.ins = ins;
    // 배경은 크기가 바뀔 때만
    this.bg.width = Math.ceil(G.W * V.scale * this.dpr) + 2;
    this.bg.height = Math.ceil(G.H * V.scale * this.dpr) + 2;
    const b = this.bg.getContext("2d");
    b.setTransform(V.scale * this.dpr, 0, 0, V.scale * this.dpr, 0, 0);
    drawBackdrop(b, G, V.scale);
    this.ui.layoutPads();
  }
  /** 화면 좌표 ↔ 세계 좌표 (점검 · 따라가기) */
  worldToScreen(x, y) {
    const V = this.view;
    return { x: V.ox + (x - V.camX) * V.scale, y: V.oy + y * V.scale };
  }

  /* ---------------- 매 프레임 ---------------- */
  loop(ts) {
    const real = Math.min(0.1, Math.max(0, (ts - this.last) / 1000)); // 탭이 오래 숨어도 한꺼번에 쌓지 않음
    this.last = ts;
    try {
      if (this.mode === "play" && this.G && !this.paused) {
        this.acc += real * this.speed;
        let n = 0;
        while (this.acc >= DT && n < 24 * this.speed) {
          stepGame(this.G, this.input.take());
          this.handleEvents();
          this.acc -= DT;
          n++;
        }
        if (n >= 24 * this.speed) this.acc = 0;
      }
      if (!this.paused) {
        this.time += real;
        if (this.shake > 0) this.shake = Math.max(0, this.shake - real);
      }
      this.updateFx(real);
      this.draw();
    } catch (e) {
      console.error(e);
      // 한 번 실수로 멈추지 않게: 이 판을 처음부터
      if (this.G && !this.crashOnce) {
        this.crashOnce = true;
        this.restart();
      }
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  handleEvents() {
    const G = this.G;
    for (const e of G.events) {
      const R = G.robot;
      switch (e.type) {
        case "mag-on":
          this.audio.play("mag-on");
          this.audio.humOn(G.mag.pole);
          this.spawnScrews();
          break;
        case "mag-off":
        case "empty":
          this.audio.play(e.type === "empty" ? "empty" : "mag-off");
          this.audio.humOff();
          this.dropScrews();
          if (e.type === "empty") this.ui.toast("에너지가 바닥나 자석이 꺼졌어요");
          break;
        case "no-energy":
          this.audio.play("no-energy");
          this.ui.toast("에너지가 없어요 · 자석을 끄고 잠깐 기다려요");
          break;
        case "pole":
          this.audio.play("pole", { pole: e.pole });
          this.A.spin = TAU;
          if (G.mag.on) {
            this.audio.humOff();
            this.audio.humOn(G.mag.pole);
          }
          break;
        case "clank": {
          const b = G.objs.find((o) => o.id === e.id);
          this.audio.play("clank", { v: e.v });
          if (b && !this.reduced) this.sparks(b.x, b.bottom, 4, C.lemon);
          break;
        }
        case "switch-on":
          this.audio.play("switch-on");
          this.face("wow", 0.7);
          break;
        case "switch-off":
          this.audio.play("switch-off");
          break;
        case "door-open":
          this.audio.play("door-open");
          break;
        case "magnet-wake": {
          // 고정 전자석이 켜짐 · 마지막 판의 거대 자석은 화면이 흔들리는 큰 연출
          const m = G.magnets.find((q) => q.id === e.id);
          const big = !!this.def.finale;
          this.audio.play(big ? "wake" : "switch-on");
          if (m) {
            this.text(m.x + m.w / 2, m.y + m.h + 34, big ? "거대 자석 가동!!" : "자석 켜짐!", C.lemon);
            if (!this.reduced) this.stars(m.x + m.w / 2, m.y + m.h / 2, big ? 18 : 8);
          }
          if (big) {
            this.shake = this.reduced ? 0 : 0.8;
            this.face("wow", 1.4);
            this.ui.toast("거대 자석이 깨어났어요! 리프트를 타고 위로");
          }
          break;
        }
        case "exit-open":
          this.audio.play("exit-open");
          this.ui.toast("출구가 열렸어요!");
          break;
        case "lock": {
          this.audio.play("lock");
          const g = G.goals.find((q) => q.id === e.id);
          if (g) this.text(g.x + g.w / 2, g.y - 20, "딸깍!", C.lemon);
          this.face("happy", 0.8);
          break;
        }
        case "jump":
          this.audio.play("jump");
          break;
        case "spring":
          this.audio.play("spring");
          break;
        case "lever":
          this.audio.play("lever");
          break;
        case "use-none":
          this.ui.toast("가까이에 레버가 없어요");
          break;
        case "gear":
          this.audio.play("gear");
          this.text(R.x, R.top - 20, "숨은 기어!", C.lemon);
          this.stars(R.x, R.top, 8);
          break;
        case "respawn": {
          const b = G.objs.find((o) => o.id === e.id);
          this.audio.play("respawn");
          if (b) this.text(b.x, b.y - 30, "뿅!", "#fff");
          break;
        }
        case "fall":
          this.audio.play("fall");
          this.audio.humOff();
          this.face("dizzy", 1.2);
          this.ui.toast("앗! 다시 처음 자리에서");
          break;
        case "squash":
          this.audio.play("squash");
          this.face("dizzy", 0.8);
          this.A.squashT = 0.5;
          break;
        case "win":
          this.onWin();
          break;
        case "fail":
          this.onFail(e.why);
          break;
      }
    }
    // 착지
    const R = G.robot;
    const g = !!R.ground;
    if (g && !this.A.wasGround && this.A.vy > 320) {
      this.A.land = 1;
      this.audio.play("land");
      if (!this.reduced) this.dust(R.x, R.bottom);
    }
    this.A.wasGround = g;
    this.A.vy = R.vy;
    this.ui.hud();
  }
  face(f, t) {
    this.A.face = f;
    this.A.faceT = t;
  }

  onWin() {
    if (this.ended) return;
    this.ended = true;
    const G = this.G;
    this.audio.humOff();
    this.audio.play("win");
    this.face("happy", 3);
    this.A.dance = 1.6;
    if (!this.reduced) this.confetti();
    const st = starsOf(G);
    let rec;
    if (this.kind === "stage") rec = this.save.recordStage(this.def.id, { stars: st.n, time: G.winT, gear: G.gearGot });
    else rec = this.save.recordDaily(this.extra.date, { ok: true, time: G.winT, stars: st.n });
    this.input.enabled = false;
    setTimeout(() => {
      if (this.G === G) this.ui.result({ ok: true, st, rec });
    }, this.reduced ? 500 : this.def.id === 12 ? 1900 : 1200);
  }
  onFail(why) {
    if (this.ended) return;
    this.ended = true;
    const G = this.G;
    this.audio.humOff();
    this.audio.play("fail");
    this.face("dizzy", 3);
    if (this.kind === "daily") this.save.recordDaily(this.extra.date, { ok: false });
    this.input.enabled = false;
    setTimeout(() => {
      if (this.G === G) this.ui.result({ ok: false, why });
    }, 900);
  }

  /* ---------------- 효과 ---------------- */
  text(x, y, text, color) {
    this.fx.push({ kind: "text", x, y, text, color, t: 0, life: 1, size: 17 });
  }
  sparks(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI + Math.random() * Math.PI;
      const v = 120 + Math.random() * 200;
      this.fx.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 600, t: 0, life: 0.35, color });
    }
  }
  dust(x, y) {
    for (let i = 0; i < 6; i++) this.fx.push({ kind: "dot", x: x + (Math.random() - 0.5) * 30, y: y - 2, vx: (Math.random() - 0.5) * 80, vy: -30 - Math.random() * 40, g: 0, t: 0, life: 0.4, size: 4 + Math.random() * 3, color: "rgba(255,246,230,0.6)" });
  }
  stars(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.fx.push({ kind: "star", x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 60, g: 300, t: 0, life: 0.8, size: 6, color: C.lemon });
    }
  }
  confetti() {
    const G = this.G;
    const cols = [C.teal, C.coral, C.lemon, C.lav, C.cream];
    for (let i = 0; i < 70; i++) this.fx.push({ kind: "star", x: Math.random() * G.W, y: -20 - Math.random() * 120, vx: (Math.random() - 0.5) * 80, vy: 80 + Math.random() * 160, g: 120, t: 0, life: 2.6, size: 4 + Math.random() * 4, color: cols[i % 5] });
  }
  /** 자석을 켜면 작은 나사들이 날아와 마그에게 착 (끄면 떨어짐) — 그림만 */
  spawnScrews() {
    if (this.reduced) return;
    const R = this.G.robot;
    this.screws = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * TAU;
      this.screws.push({ x: R.x + Math.cos(a) * 140, y: R.y + Math.sin(a) * 90 - 20, ox: (Math.random() - 0.5) * 30, oy: -10 - Math.random() * 26, stuck: false, vx: 0, vy: 0 });
    }
  }
  dropScrews() {
    for (const s of this.screws || []) {
      s.stuck = false;
      s.fall = true;
      s.vx = (Math.random() - 0.5) * 120;
      s.vy = -120;
      s.t = 0;
    }
  }
  updateFx(dt) {
    this.fx = this.fx.filter((p) => {
      p.t += dt;
      if (p.vx != null) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.g || 0) * dt;
      }
      return p.t < p.life;
    });
    const G = this.G;
    if (!G) return;
    const R = G.robot;
    this.screws = (this.screws || []).filter((s) => {
      if (s.fall) {
        s.t += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 900 * dt;
        return s.t < 0.8;
      }
      const tx = R.x + s.ox;
      const ty = R.bottom - 22 + s.oy;
      s.x += (tx - s.x) * Math.min(1, dt * 10);
      s.y += (ty - s.y) * Math.min(1, dt * 10);
      return true;
    });
    // 마그 연출
    const A = this.A;
    A.faceT -= dt;
    if (A.faceT <= 0) A.face = "idle";
    A.blink -= dt;
    if (A.blink < -3) A.blink = 0.12;
    if (A.face === "idle" && A.blink > 0) A.face = "blink";
    else if (A.face === "blink" && A.blink <= 0) A.face = "idle";
    A.spin = Math.max(0, A.spin - dt * 14);
    A.land = Math.max(0, A.land - dt * 5);
    A.squashT = Math.max(0, (A.squashT || 0) - dt);
    A.dance = Math.max(0, A.dance - dt);
    const moving = R.ground && Math.abs(R.vx - R.groundVx) > 30;
    A.hop = this.reduced ? 0 : moving ? Math.abs(Math.sin(this.time * 15)) * 3 : 0;
    let sx = 1;
    let sy = 1;
    if (!R.ground) {
      sy = R.vy < 0 ? 1.08 : 0.98;
      sx = R.vy < 0 ? 0.94 : 1.02;
    }
    if (A.land > 0) {
      sy = 1 - A.land * 0.22;
      sx = 1 + A.land * 0.18;
    }
    if (A.squashT > 0) {
      sy = 0.72;
      sx = 1.25;
    }
    if (A.dance > 0 && !this.reduced) {
      A.hop = Math.abs(Math.sin(this.time * 12)) * 10;
      sx = 1 + Math.sin(this.time * 24) * 0.06;
    }
    if (G.mag.on && !this.reduced) sx *= 1 + Math.sin(this.time * 40) * 0.01;
    A.sx = sx;
    A.sy = sy;
  }

  /* ---------------- 그리기 ---------------- */
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    const G = this.G;
    if (this.mode !== "play" || !G) {
      this.drawTitle(ctx);
      return;
    }
    const V = this.view;
    // 따라가기: 마그가 가운데쯤 오게 (판 끝에서는 멈춤)
    if (V.follow) {
      const viewW = V.aw / V.scale;
      const want = Math.max(0, Math.min(G.W - viewW, G.robot.x - viewW / 2));
      V.camX += (want - V.camX) * 0.15;
      V.ox = V.ins.left;
    } else V.camX = 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(V.ins.left, V.ins.top, V.aw, this.H - V.ins.top - V.ins.bottom);
    ctx.clip();
    // 흔들림 (거대 자석 가동 · 움직임 줄이기 설정이면 없음)
    const shx = this.shake > 0 ? Math.sin(this.time * 70) * 7 * this.shake : 0;
    const shy = this.shake > 0 ? Math.cos(this.time * 53) * 5 * this.shake : 0;
    ctx.translate(V.ox - V.camX * V.scale + shx, V.oy + shy);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, (V.ox - V.camX * V.scale + shx) * this.dpr, (V.oy + shy) * this.dpr);
    ctx.drawImage(this.bg, 0, 0);
    ctx.restore();
    ctx.scale(V.scale, V.scale);
    const now = this.reduced ? 0 : this.time;
    drawDevices(ctx, G, now);
    drawWalls(ctx, G);
    drawMagnetField(ctx, G, now);
    for (const b of G.objs) if (!b.data.stored) drawObject(ctx, b, G, now);
    // 칸에 넣은 물건 (유리 덮개 안)
    for (const b of G.objs) if (b.data.stored) this.drawStored(ctx, b, G, now);
    drawRobot(ctx, G, this.A, now, this.skin());
    drawFx(ctx, (this.screws || []).map((s) => ({ kind: "screw", x: s.x, y: s.y, t: 0, life: 1 })));
    drawFx(ctx, this.fx);
    ctx.restore();
  }
  drawStored(ctx, b, G, now) {
    const k = Math.min(1, (G.t - b.data.stored) / 0.3);
    ctx.save();
    ctx.translate(b.x, b.y + k * 6);
    ctx.scale(1 - k * 0.25, 1 - k * 0.25);
    ctx.translate(-b.x, -b.y);
    drawObject(ctx, b, G, now);
    ctx.restore();
  }
  drawTitle(ctx) {
    // 첫 화면 뒤: 공장 분위기 + 큰 마그가 자석으로 나사를 모음
    const W = this.W;
    const H = this.H;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2a3a6e");
    g.addColorStop(1, "#1d2849");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const t = this.reduced ? 0 : this.time;
    ctx.strokeStyle = "rgba(185,167,240,0.12)";
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    const hole = this.ui.titleHole();
    if (!hole) return;
    const s = Math.min(3.2, Math.max(1.6, (hole.bottom - hole.top) / 70));
    const fake = {
      robot: { x: 0, bottom: 0, y: -21, vx: 0 },
      facing: Math.sin(t * 0.7) > 0 ? 1 : -1,
      mag: { on: Math.sin(t * 1.3) > -0.3, pole: Math.sin(t * 0.45) > 0 ? "N" : "S" },
    };
    ctx.save();
    ctx.translate(hole.x, hole.bottom - 6);
    ctx.scale(s, s);
    // 자석 범위 물결
    if (fake.mag.on) {
      const col = fake.mag.pole === "N" ? "255,107,87" : "58,167,232";
      for (let k = 0; k < 3; k++) {
        const q = 1 - ((t * 0.8 + k / 3) % 1);
        ctx.strokeStyle = `rgba(${col},${0.5 * (1 - q)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -27, 26 + 40 * q, 0, TAU);
        ctx.stroke();
      }
      // 끌려오는 나사
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + t * 0.6;
        const r = 30 + ((t * 30 + k * 13) % 34);
        drawFx(ctx, [{ kind: "screw", x: Math.cos(a) * r, y: -27 + Math.sin(a) * r * 0.7, t: 0, life: 1 }]);
      }
    }
    const A = { hop: Math.abs(Math.sin(t * 3)) * 4, sx: 1, sy: 1, spin: 0, face: (t % 4) < 0.15 ? "blink" : "happy" };
    drawRobot(ctx, fake, A, t, this.skin());
    ctx.restore();
  }

  /** 점검용 요약 */
  probe() {
    const G = this.G;
    return {
      mode: this.mode,
      kind: this.kind,
      id: this.def ? this.def.id : null,
      paused: this.paused,
      t: G ? G.t : 0,
      won: G ? G.won : false,
      failed: G ? G.failed : null,
      mag: G ? { ...G.mag } : null,
      energy: G ? G.energy : null,
      robot: G ? { x: G.robot.x, y: G.robot.y } : null,
      bodies: G ? G.world.bodies.length : 0,
      sense: G ? { ...G.sense } : {},
      scale: this.view.scale,
      follow: this.view.follow,
    };
  }
}
export { MAG };
