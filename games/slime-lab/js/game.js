/*
 * 말랑팡! 슬라임 연구소 · 게임 진행
 *  상태: title(연구소 · 슬라임들이 꼼지락) → play ⇄ paused → over(클래식 넘침) · mdone(미션 끝)
 *  한 프레임: 입력 → 물리(고정 1/60초 · 잘게 나눔) → 합체(한 번에 · 중복 없음) → 점수 → 위험선 → 말랑 효과 → 그리기
 *  게임 루프는 하나만 돈다 (다시 하기 · 모드 바꾸기에도 새로 만들지 않음)
 */
import { JAR, PHYS, RULES, LEVELS, MAX_LV, SPAWN_W } from "./config.js?v=1";
import { World } from "./physics.js?v=1";
import { ScoreKeeper } from "./score.js?v=1";
import { MISSIONS, TIERS, progress, progressText, starsFor, tierOpen, rng } from "./missions.js?v=1";
import { Save } from "./save.js?v=1";
import { SlimeAudio } from "./audio.js?v=1";
import { FX } from "./fx.js?v=1";
import { UI } from "./ui.js?v=1";
import { makeSprite, drawFace, drawLab, drawJarBack, drawJarFront, drawDropper } from "./art.js?v=1";

const STEP = 1 / 60;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

export class Game {
  constructor({ canvas, field }) {
    this.canvas = canvas;
    this.field = field;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) throw new Error("no canvas");
    this.save = new Save();
    this.audio = new SlimeAudio();
    this.audio.setOn(this.save.data.settings.sound !== false);
    this.world = new World();
    this.keeper = new ScoreKeeper();
    this.fx = new FX();
    this.ui = new UI(this);
    const rs = this.save.data.settings.reduced;
    this.reduced = rs == null ? matchMedia("(prefers-reduced-motion: reduce)").matches : !!rs;
    this.fx.reduced = this.reduced;
    this.state = "title";
    this.mode = "classic";
    this.mission = null;
    this.paused = false;
    this.t = 0; // 게임 시간 (멈추면 안 흐름)
    this.clock = 0; // 화면 시간 (꼼지락 · 깜빡임)
    this.acc = 0;
    this.seq = 0; // 슬라임 번호
    this.mergeSeq = 0; // 합체 이벤트 번호
    this.pairs = [];
    this.sprites = [];
    this.aimX = JAR.W / 2;
    this.keys = new Set();
    this.touch = matchMedia("(pointer:coarse)").matches;
    this.last = performance.now();
    this.resize();
    this.bindInput();
    window.addEventListener("resize", () => this.resize());
    // 화면 칸 크기가 바뀌면(주소창 접힘 · 글꼴 늦게 옴 등) 다시 배치
    if (window.ResizeObserver) {
      let last = "";
      new ResizeObserver(() => {
        const key = `${this.field.clientWidth}x${this.field.clientHeight}`;
        if (key !== last) {
          last = key;
          this.resize();
        }
      }).observe(this.field);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.resize());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (this.state === "play" && !this.paused) this.pause();
        this.save.write();
      }
    });
    this.ui.setSound(this.audio.on);
    this.ui.setHint(this.touch);
    this.toTitle(true);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /* ================================================================
   * 화면 크기 · 배치 (세계 → 화면)
   * ============================================================== */
  resize() {
    // 첫 그림 때 아직 크기를 못 읽으면 창 크기로 (배율이 0 이하가 되지 않게)
    let w = this.field.clientWidth;
    let h = this.field.clientHeight;
    if (!(w > 100)) w = Math.max(200, innerWidth || 0);
    if (!(h > 100)) h = Math.max(200, innerHeight || 0);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = w;
    this.H = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    const hud = document.getElementById("hud");
    const bot = document.getElementById("hud-bottom");
    const bar = document.getElementById("mission-bar");
    let top = (hud && hud.offsetHeight ? hud.offsetHeight : 64) + (bar && !bar.hidden ? bar.offsetHeight + 6 : 0) + 6;
    let bottom = (bot && bot.offsetHeight ? bot.offsetHeight : 64) + 4;
    let left = 0;
    let right = 0;
    // 낮은 가로 화면(가로로 든 휴대폰): HUD 는 왼쪽 세로 줄 · 진화표는 오른쪽 → 용기가 높이를 다 씀
    if (hud && !hud.hidden && hud.offsetWidth && hud.offsetWidth < 200 && hud.offsetHeight > h * 0.5) {
      left = hud.offsetWidth + 4;
      right = (bot && bot.offsetWidth ? bot.offsetWidth : 60) + 4;
      top = (bar && !bar.hidden ? bar.offsetHeight + 10 : 0) + 4;
      bottom = 4;
    }
    // 타이틀: 로고 · 메뉴를 피해 빈 곳에 용기를 (슬라임들이 메뉴에 가리지 않게)
    //  넓은 가로 화면은 왼쪽에 메뉴 · 오른쪽에 용기 / 그 밖엔 로고와 메뉴 사이
    const title = document.getElementById("title");
    if (this.state === "title" && title && !title.hidden) {
      const fr = this.field.getBoundingClientRect();
      const logo = title.querySelector(".logo").getBoundingClientRect();
      const menu = title.querySelector(".menu").getBoundingClientRect();
      if (menu.right < fr.left + fr.width * 0.55) {
        left = Math.max(logo.right, menu.right) - fr.left + 16;
        right = 16;
        top = 24;
        bottom = 24;
      } else if (menu.top - logo.bottom > 140) {
        top = logo.bottom - fr.top + 2;
        bottom = fr.bottom - menu.top + 2;
      }
    }
    // 보여 줄 세계 범위: 레일 ~ 받침대
    const wx0 = -34;
    const wx1 = JAR.W + 34;
    const wy0 = JAR.SPAWN_Y - 74;
    const wy1 = JAR.H + 34;
    const aw = Math.max(120, w - 16 - left - right);
    const ah = Math.max(120, h - top - bottom);
    const k = Math.max(0.2, Math.min(aw / (wx1 - wx0), ah / (wy1 - wy0)));
    this.k = k;
    this.ox = left + (w - left - right - (wx1 - wx0) * k) / 2 - wx0 * k;
    this.oy = top + (ah - (wy1 - wy0) * k) / 2 - wy0 * k;
    this.jar = { x0: this.ox, y0: this.oy, w: JAR.W * k, h: JAR.H * k, by: this.oy + JAR.H * k, cx: this.ox + (JAR.W * k) / 2, k };
    // 배경은 크기가 바뀔 때만 다시 그림
    this.bg = this.bg || document.createElement("canvas");
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;
    const b = this.bg.getContext("2d");
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLab(b, w, h, this.jar);
    this.sprites = [];
    if (this.ui) {
      this.ui.drawEvo(this.save);
      this.ui.drawNext(this.next);
    }
  }
  X(x) {
    return this.ox + x * this.k;
  }
  Y(y) {
    return this.oy + y * this.k;
  }
  sprite(level) {
    let s = this.sprites[level];
    if (!s) s = this.sprites[level] = makeSprite(level, this.k * this.dpr);
    return s;
  }

  /* ================================================================
   * 입력: 마우스 · 터치(옮기고 떼면 투하 · 한 손가락만) · 키보드
   * ============================================================== */
  bindInput() {
    const f = this.field;
    const toX = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return (e.clientX - r.left - this.ox) / this.k;
    };
    this.ptr = null; // 지금 누르고 있는 손가락/마우스
    f.addEventListener("pointerdown", (e) => {
      if (!this.canPlay() || e.target.closest("button, a, .card")) return;
      if (this.ptr !== null) return; // 다른 손가락은 무시
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      this.audio.unlock();
      this.ptr = e.pointerId;
      if (e.pointerType !== "mouse") this.setTouch(true);
      f.setPointerCapture && f.setPointerCapture(e.pointerId);
      this.aimX = toX(e);
    });
    f.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse" && this.ptr === null) {
        if (this.canPlay()) this.aimX = toX(e);
        return;
      }
      if (e.pointerId !== this.ptr) return;
      e.preventDefault();
      this.aimX = toX(e);
    });
    const up = (e, drop) => {
      if (e.pointerId !== this.ptr) return;
      this.ptr = null;
      if (drop && this.canPlay()) {
        this.aimX = toX(e);
        this.drop();
      }
    };
    f.addEventListener("pointerup", (e) => up(e, true));
    f.addEventListener("pointercancel", (e) => up(e, false));
    f.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => {
      const k = e.code;
      if (k === "Escape" || k === "KeyP") {
        if (this.state === "play") {
          e.preventDefault();
          this.paused ? this.resume() : this.pause();
        } else if (["howto", "settings", "missions", "dex"].includes(this.ui.current)) this.ui.show(this.ui.backTo || "title");
        return;
      }
      if (k === "KeyR" && (this.paused || this.state === "over" || this.state === "mdone")) {
        e.preventDefault();
        this.restart();
        return;
      }
      if (!this.canPlay()) return;
      if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(k)) {
        e.preventDefault();
        this.keys.add(k);
      }
      if ((k === "Space" || k === "Enter" || k === "ArrowDown" || k === "KeyS") && !e.repeat) {
        e.preventDefault();
        this.audio.unlock();
        this.drop();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }
  setTouch(on) {
    if (this.touch === on) return;
    this.touch = on;
    this.ui.setHint(on);
  }
  canPlay() {
    return this.state === "play" && !this.paused;
  }

  /* ================================================================
   * 슬라임 만들기 · 떨어뜨리기
   * ============================================================== */
  makeBody(level, x, y, o = {}) {
    const L = LEVELS[level];
    const R = L.r;
    const r = o.grow ? R * 0.68 : R;
    const m = R * R;
    // 어디서 만들든 용기 벽 안쪽에서 시작
    x = clamp(x, r, JAR.W - r);
    if (y > JAR.H - r) y = JAR.H - r;
    const b = {
      id: ++this.seq,
      level,
      x,
      y,
      px: x,
      py: y,
      vx: o.vx || 0,
      vy: o.vy || 0,
      r,
      R,
      m,
      w: 1 / m,
      alive: true,
      touch: 0,
      born: this.t,
      dropT: o.drop ? this.t : -1,
      landT: -1,
      chain: o.chain || 0,
      mergeAt: this.t + (o.grow ? 0.06 : 0),
      // 말랑 효과
      sq: o.grow ? -0.1 : 0,
      sqv: 0,
      sqa: Math.PI / 2,
      tilt: 0,
      tv: 0,
      pop: o.grow ? 0 : 1,
      expr: o.grow ? "happy" : "idle",
      exprT: o.grow ? 0.75 : 0,
      blink: 1 + Math.random() * 3,
    };
    this.world.add(b);
    this.keeper.saw(level);
    if (this.state !== "title") this.discover(level);
    return b;
  }
  pick() {
    const r = this.rand();
    let acc = 0;
    for (let lv = 1; lv < SPAWN_W.length; lv++) {
      acc += SPAWN_W[lv];
      if (r < acc) return lv;
    }
    return 1;
  }
  /** 지금 매달린 슬라임 떨어뜨리기 (쿨다운 · 미션 남은 수) */
  drop() {
    if (!this.canPlay() || this.cool > 0 || !this.cur) return false;
    if (this.mode === "mission" && this.used >= this.mission.drops) return false;
    const L = LEVELS[this.cur];
    const x = clamp(this.aimX, L.r, JAR.W - L.r);
    this.aimX = x;
    const b = this.makeBody(this.cur, x, JAR.SPAWN_Y, { drop: true, vy: 40 });
    b.sq = -0.12;
    this.drops++;
    this.used++;
    this.lastDropT = this.t;
    this.keeper.onDrop();
    this.audio.play("drop");
    this.fx.puff(x, JAR.SPAWN_Y + L.r * 0.6, L.c[1], 3);
    this.cool = RULES.dropCooldown;
    this.cur = 0;
    this.paintHud();
    return true;
  }
  discover(level) {
    if (this.save.discover(level)) {
      this.save.write();
      this.ui.toast(`✨ 새 슬라임 발견! ${LEVELS[level].name}`);
      this.audio.play("discover");
      this.ui.drawEvo(this.save);
    }
  }

  /* ================================================================
   * 모드 시작 · 끝
   * ============================================================== */
  clearRun() {
    this.world.clear();
    this.keeper.reset();
    this.fx.reset();
    this.pairs.length = 0;
    this.t = 0;
    this.acc = 0;
    this.cool = 0.3;
    this.drops = 0;
    this.used = 0;
    this.lastDropT = -9;
    this.dangerT = 0;
    this.warnBeep = 0;
    this.overT = 0;
    this.doneT = 0;
    this.result = null;
    this.bestToast = false;
    this.ptr = null;
    this.keys.clear();
  }
  start(mode, mission = null) {
    this.audio.unlock();
    this.mode = mode;
    this.mission = mission;
    this.clearRun();
    if (mode === "mission") this.rand = rng(mission.seed);
    else this.rand = Math.random;
    this.cur = this.pick();
    this.next = this.pick();
    this.discover(this.cur);
    this.discover(this.next);
    this.aimX = JAR.W / 2;
    this.state = "play";
    this.paused = false;
    this.ui.show(null);
    this.ui.hud(true, mission);
    this.resize();
    this.paintHud();
    this.ui.drawNext(this.next);
    this.ui.drawEvo(this.save);
  }
  restart() {
    this.start(this.mode, this.mission);
  }
  toTitle(first = false) {
    this.state = "title";
    this.paused = false;
    this.clearRun();
    this.rand = Math.random;
    this.ui.hud(false);
    // 연구소에서 쉬고 있는 슬라임들 (처음부터 떨어지는 1~4단계만 · 못 찾은 큰 슬라임은 미리 안 보여 줌)
    const demo = [
      [1, 50],
      [2, 110],
      [3, 180],
      [4, 270],
      [3, 350],
      [2, 30],
      [1, 230],
    ];
    for (const [lv, x] of demo) this.makeBody(lv, x, JAR.H - 120 - Math.random() * 80);
    this.cur = 0;
    this.next = 0;
    this.ui.paintTitle(this.save);
    this.ui.show("title");
    this.resize();
    if (!first) this.save.write();
  }
  pause() {
    if (this.state !== "play" || this.paused) return;
    this.paused = true;
    this.keys.clear();
    this.ptr = null;
    this.ui.backTo = "pause";
    this.ui.show("pause");
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.ui.show(null);
    this.last = performance.now();
  }
  setSound(on) {
    this.save.setSetting("sound", on);
    this.audio.setOn(on);
    if (on) this.audio.unlock();
    this.ui.setSound(on);
    const box = document.getElementById("set-sound");
    if (box) box.checked = on;
  }
  setReduced(on) {
    this.save.setSetting("reduced", on);
    this.reduced = on;
    this.fx.reduced = on;
    document.body.classList.toggle("reduced", on);
  }
  nextMission() {
    if (!this.mission) return null;
    const n = MISSIONS.find((m) => m.id === this.mission.id + 1);
    if (!n) return null;
    return tierOpen(n.tier, this.save.data.missions) ? n : null;
  }

  /* ================================================================
   * 매 프레임
   * ============================================================== */
  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.clock += dt;
    if (!this.paused) this.update(dt);
    this.render();
  }
  update(dt) {
    const playing = this.state === "play";
    // 게임 오버 연출 중엔 천천히
    const slow = this.state === "over" ? 0.45 : 1;
    if (playing) this.t += dt;
    // 키보드로 투하 위치
    if (playing && this.keys.size) {
      let d = 0;
      if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) d -= 1;
      if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) d += 1;
      this.aimX += d * 330 * dt;
    }
    if (this.cur) this.aimX = clamp(this.aimX, LEVELS[this.cur].r, JAR.W - LEVELS[this.cur].r);
    else this.aimX = clamp(this.aimX, 10, JAR.W - 10);
    // 다음 슬라임 준비
    if (playing && this.cool > 0) {
      this.cool -= dt;
      if (this.cool <= 0 && !this.cur) {
        const left = this.mode === "mission" ? this.mission.drops - this.used : Infinity;
        if (left > 0) {
          this.cur = this.next;
          this.next = this.pick();
          this.discover(this.next);
          this.ui.drawNext(left > 1 ? this.next : 0);
          this.curPop = 0;
        }
      }
    }
    // 물리 (고정 간격)
    this.acc += dt * slow;
    let n = 0;
    while (this.acc >= STEP && n < 4) {
      this.world.step(STEP);
      this.afterStep();
      this.acc -= STEP;
      n++;
    }
    if (n === 4) this.acc = 0;
    // 말랑 효과 · 표정
    this.animate(dt);
    if (playing) {
      this.checkDanger(dt);
      if (this.mode === "mission") this.checkMission(dt);
    } else if (this.state === "over") {
      this.overT += dt;
      if (this.overT > 1.5 && !this.result) this.showOver();
    } else if (this.state === "mdone") {
      this.doneT += dt;
      if (this.doneT > 1.1 && !this.result) this.showMission();
    }
    this.fx.update(dt);
  }
  /** 물리 한 걸음 뒤: 커지는 중인 슬라임 · 부딪힘 효과 · 합체 */
  afterStep() {
    const B = this.world.bodies;
    for (const b of B) {
      if (b.r < b.R) {
        b.r = Math.min(b.R, b.r + (b.R - b.r) * Math.min(1, STEP * PHYS.grow) + 0.2);
        // 커지는 동안에도 유리 밖으로 삐져나가지 않게
        b.x = clamp(b.x, b.r, JAR.W - b.r);
        if (b.y > JAR.H - b.r) b.y = JAR.H - b.r;
      }
      if (b.landT < 0 && b.touch > 0 && b.y > JAR.SPAWN_Y + b.r) b.landT = this.t;
    }
    // 부딪힘 → 말랑 · 소리
    const I = this.world.impacts;
    for (let i = 0; i < I.length; i += 5) {
      const a = I[i];
      const b = I[i + 1];
      const nx = I[i + 2];
      const ny = I[i + 3];
      const sp = I[i + 4];
      const k = Math.min(0.32, sp / 1500);
      this.kick(a, nx, ny, k);
      if (b) this.kick(b, nx, ny, k * 0.8);
      if (sp > 300 && this.state !== "title") {
        this.audio.play("squish", { k: sp / 900, size: a.level });
        if (sp > 650) {
          a.expr = "squish";
          a.exprT = 0.28;
        }
      }
    }
    if (this.state === "play" || this.state === "title") this.mergeAll();
  }
  kick(b, nx, ny, k) {
    if (k < 0.02) return;
    b.sqa = Math.atan2(ny, nx);
    b.sqv += k * 9;
    b.tv += (Math.random() - 0.5) * k * 6;
  }
  /** 같은 단계끼리 닿은 것 합치기 (한 슬라임은 한 번만 · 새로 생긴 것은 다음 프레임부터) */
  mergeAll() {
    if (this.state === "title") return;
    const pairs = this.world.sameTouch(this.pairs, (b) => this.t >= b.mergeAt);
    if (!pairs.length) return;
    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i];
      const b = pairs[i + 1];
      if (!a.alive || !b.alive) continue;
      this.merge(a, b);
    }
    this.world.sweep();
  }
  merge(a, b) {
    a.alive = false;
    b.alive = false;
    const lv = a.level;
    const fresh = (s) => s.chain > 0 && this.t - s.born <= RULES.freshChain;
    const chain = fresh(a) || fresh(b) ? Math.max(a.chain, b.chain) + 1 : 1;
    const mt = a.m + b.m;
    const x = (a.x * a.m + b.x * b.m) / mt;
    const y = (a.y * a.m + b.y * b.m) / mt;
    const vx = (a.vx * a.m + b.vx * b.m) / mt;
    const vy = Math.min(0, (a.vy * a.m + b.vy * b.m) / mt);
    const id = ++this.mergeSeq;
    const L = LEVELS[lv];
    if (lv >= MAX_LV) {
      // 전설 둘 → 하늘로
      const res = this.keeper.apply({ id, level: MAX_LV + 1, chain, t: this.t });
      if (!res) return;
      this.fx.burst(x, y, L.r, ["#7fe8c4", "#ffe866", "#ffffff", "#ff8fc8"], 9, res.combo);
      this.fx.text(x, y - L.r, `+${res.points.toLocaleString("ko-KR")}`, "#fff6a8", 1.5);
      this.ui.combo("전설의 비행! 🐉", true);
      this.audio.play("legend");
      this.afterMerge(res);
      return;
    }
    const nb = this.makeBody(lv + 1, x, y, { grow: true, vx, vy: vy - 170, chain });
    nb.born = this.t;
    const res = this.keeper.apply({ id, level: lv + 1, chain, t: this.t });
    if (!res) return;
    const N = LEVELS[lv + 1];
    this.fx.burst(x, y, N.r, [N.c[1], N.c[0], L.c[1], "#ffffff"], lv + 1, res.combo);
    this.fx.text(x, y - N.r * 0.6, `+${res.points.toLocaleString("ko-KR")}`, res.combo >= 3 ? "#ffe866" : "#ffffff", 1 + Math.min(0.6, res.combo * 0.08));
    this.audio.play("merge", { level: lv + 1, combo: res.combo });
    // 이웃 슬라임들이 살짝 놀람
    for (const o of this.world.bodies) {
      if (!o.alive || o === nb) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < N.r + o.r + 30) this.kick(o, (o.x - x) / (d || 1), (o.y - y) / (d || 1), 0.12);
    }
    this.afterMerge(res);
  }
  afterMerge(res) {
    if (res.chain >= 2) this.ui.combo(`${res.chain}연쇄!${res.combo >= 2 ? ` · 콤보 x${res.combo}` : ""}`, res.chain >= 3);
    else if (res.combo >= 2) this.ui.combo(`콤보 x${res.combo}!`, res.combo >= 5);
    if (res.combo >= 2) this.audio.play("combo", { combo: res.combo });
    if (this.mode === "classic" && !this.bestToast && this.save.data.best > 0 && this.keeper.score > this.save.data.best) {
      this.bestToast = true;
      this.ui.toast("🎉 최고 기록 돌파!", 1.8);
    }
    this.paintHud();
  }
  /** 위험선: 떨어지는 중인 슬라임은 빼고 · 오래 넘쳐 있으면 끝 */
  checkDanger(dt) {
    let over = false;
    for (const b of this.world.bodies) {
      if (!b.alive) continue;
      if (b.dropT >= 0) {
        const since = this.t - b.dropT;
        const grace = b.landT >= 0 ? Math.min(RULES.dropGrace, b.landT - b.dropT + 0.35) : RULES.dropGrace;
        if (since < grace) continue;
      }
      if (b.y - b.r < JAR.DANGER_Y) {
        over = true;
        break;
      }
    }
    if (over) this.dangerT += dt;
    else this.dangerT = Math.max(0, this.dangerT - dt * 2);
    const warn = this.dangerT > RULES.dangerWarn;
    this.ui.warn(warn);
    if (warn) {
      this.warnBeep -= dt;
      if (this.warnBeep <= 0) {
        this.audio.play("warn");
        this.warnBeep = 0.7;
      }
    }
    if (this.dangerT >= RULES.dangerOver) this.gameOver();
  }
  gameOver() {
    if (this.state !== "play") return;
    this.ui.warn(false);
    if (this.mode === "mission") {
      this.finishMission(false, true);
      return;
    }
    this.state = "over";
    this.overT = 0;
    this.cur = 0;
    this.audio.play("over");
    // 슬라임들이 깜짝 놀라 퐁 뛰어오름
    for (const b of this.world.bodies) {
      b.expr = "surprise";
      b.exprT = 9;
      b.vy -= 120 + Math.random() * 180;
      b.sqv -= 2;
    }
  }
  showOver() {
    const k = this.keeper;
    const newBest = this.save.recordClassic(k);
    this.result = { score: k.score, best: this.save.data.best, newBest, merges: k.merges, maxCombo: k.maxCombo, maxChain: k.maxChain, maxLevel: k.maxLevel };
    this.ui.hud(false);
    if (newBest && k.score > 0) {
      this.fx.confetti(JAR.W, JAR.H);
      this.audio.play("best");
    }
    this.ui.over(this.result);
  }
  checkMission(dt) {
    const m = this.mission;
    const p = progress(m, this.keeper);
    if (p.done) return this.finishMission(true);
    // 다 떨어뜨렸고 · 합체도 멈췄으면 실패
    if (this.used >= m.drops) {
      const quiet = this.t - this.lastDropT > 1.4 && this.t - this.keeper.lastT > 1.2 && this.world.energy() < 4000 * Math.max(1, this.world.bodies.length);
      if (quiet || this.t - this.lastDropT > 5) this.finishMission(false);
    }
  }
  finishMission(ok, overflow = false) {
    if (this.state !== "play") return;
    this.state = "mdone";
    this.doneT = 0;
    this.cur = 0;
    this.ui.warn(false);
    const m = this.mission;
    const stars = ok ? starsFor(m, this.used) : 0;
    const before = TIERS.map((_, ti) => tierOpen(ti, this.save.data.missions));
    if (ok) this.save.recordMission(m.id, stars);
    const after = TIERS.map((_, ti) => tierOpen(ti, this.save.data.missions));
    const opened = TIERS.findIndex((t, ti) => !before[ti] && after[ti]);
    this.pendingMission = { ok, overflow, stars, m, used: this.used, unlock: opened >= 0 ? `'${TIERS[opened].name}' 미션이 열렸어요!` : "" };
    if (ok) {
      this.audio.play("clear");
      this.fx.confetti(JAR.W, JAR.H);
      for (const b of this.world.bodies) {
        b.expr = "happy";
        b.exprT = 9;
        b.vy -= 80 + Math.random() * 120;
      }
    } else {
      this.audio.play("fail");
      for (const b of this.world.bodies) {
        b.expr = "surprise";
        b.exprT = 9;
      }
    }
  }
  showMission() {
    const k = this.keeper;
    const p = this.pendingMission;
    this.result = { ...p, score: k.score, merges: k.merges, maxChain: k.maxChain, prog: progressText(p.m, k), next: this.nextMission() };
    this.ui.hud(false);
    this.ui.missionResult(this.result);
  }
  paintHud() {
    if (this.state === "title") return;
    this.ui.setScore(this.keeper.score, Math.max(this.save.data.best, this.mode === "classic" ? this.keeper.score : 0), this.mode === "mission");
    if (this.mode === "mission") this.ui.setMission(this.mission, progressText(this.mission, this.keeper), this.mission.drops - this.used);
  }

  /* ================================================================
   * 말랑 효과 · 표정 (화면 시간 기준)
   * ============================================================== */
  animate(dt) {
    const danger = this.dangerT > RULES.dangerWarn;
    for (const b of this.world.bodies) {
      // 목표 변형: 바닥/다른 슬라임에 얹혀 있으면 살짝 눌림 · 빨리 떨어지면 길쭉
      let target = 0;
      if (b.touch > 0) target = 0.045;
      else if (b.vy > 250) target = -Math.min(0.14, (b.vy - 250) / 3500);
      // 축은 천천히 세로로 돌아옴
      let da = Math.PI / 2 - b.sqa;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      b.sqa += da * Math.min(1, dt * 3);
      const K = 300;
      const C = 11;
      b.sqv += (-(b.sq - target) * K - b.sqv * C) * dt;
      b.sq = clamp(b.sq + b.sqv * dt, -0.28, 0.32);
      b.tv += (-b.tilt * 120 - b.tv * 9 + b.vx * 0.004) * dt;
      b.tilt = clamp(b.tilt + b.tv * dt, -0.22, 0.22);
      if (b.pop < 1) b.pop = Math.min(1, b.pop + dt / 0.32);
      // 표정
      if (b.exprT > 0) {
        b.exprT -= dt;
        if (b.exprT <= 0) b.expr = "idle";
      } else {
        b.expr = danger && b.y - b.r < JAR.DANGER_Y + 60 ? "worried" : "idle";
      }
      b.blink -= dt;
      if (b.blink < -0.12) b.blink = 2 + Math.random() * 3.5;
    }
    if (this.cur) this.curPop = Math.min(1, (this.curPop || 0) + dt / 0.25);
  }

  /* ================================================================
   * 그리기
   * ============================================================== */
  render() {
    const c = this.ctx;
    const dpr = this.dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    let sx = 0;
    let sy = 0;
    if (this.fx.shake > 0 && !this.reduced) {
      sx = (Math.random() - 0.5) * this.fx.shake * 10;
      sy = (Math.random() - 0.5) * this.fx.shake * 10;
    }
    c.drawImage(this.bg, 0, 0, this.W, this.H);
    c.translate(sx, sy);
    const j = this.jar;
    drawJarBack(c, j);
    const playing = this.state === "play";
    const ax = this.X(this.aimX);
    if (this.state === "play" || this.state === "title") drawDropper(c, j, this.state === "title" ? j.cx : ax, playing && !!this.cur);
    // 떨어질 곳 안내선
    if (playing && this.cur && !this.paused) {
      const r = LEVELS[this.cur].r;
      const ly = this.world.landY(this.aimX, r);
      c.save();
      c.setLineDash([this.k * 6, this.k * 7]);
      c.lineWidth = Math.max(1.5, this.k * 2.2);
      c.strokeStyle = "rgba(140,110,200,0.55)";
      c.beginPath();
      c.moveTo(ax, this.Y(JAR.SPAWN_Y + r));
      c.lineTo(ax, this.Y(ly + r));
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = "rgba(140,110,200,0.35)";
      c.beginPath();
      c.ellipse(ax, this.Y(ly + r), r * this.k * 0.7, Math.max(2, r * this.k * 0.14), 0, 0, TAU);
      c.fill();
      c.restore();
    }
    // 슬라임들
    const look = playing ? this.aimX : JAR.W / 2 + Math.sin(this.clock * 0.6) * 160;
    for (const b of this.world.bodies) if (b.alive) this.drawBody(c, b, look);
    // 매달린 슬라임
    if (this.cur && (playing || this.state === "title")) {
      const L = LEVELS[this.cur];
      const p = this.curPop == null ? 1 : this.curPop;
      const s = p < 1 ? 0.55 + 0.45 * Math.sin((p * Math.PI) / 2) * 1.08 : 1;
      const fake = { level: this.cur, x: this.aimX, y: JAR.SPAWN_Y + Math.sin(this.clock * 3) * 1.5, sq: Math.sin(this.clock * 4) * 0.025, sqa: Math.PI / 2, tilt: Math.sin(this.clock * 2) * 0.05, r: L.r * s, R: L.r, pop: 1, expr: "idle", blink: Math.sin(this.clock * 0.8) > 0.97 ? -0.05 : 1 };
      this.drawBody(c, fake, look, 0, 0.7);
    }
    drawJarFront(c, j, this.dangerT > RULES.dangerWarn ? 1 : 0, this.clock);
    this.fx.draw(c, (x) => this.X(x), (y) => this.Y(y), this.k);
    // 위험: 가장자리 붉게 (반짝임 없이 천천히)
    if (this.dangerT > RULES.dangerWarn && playing) {
      const a = Math.min(0.35, (this.dangerT - RULES.dangerWarn) * 0.15) * (this.reduced ? 0.7 : 0.75 + 0.25 * Math.sin(this.clock * 4));
      const g = c.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
      g.addColorStop(0, "rgba(255,80,120,0)");
      g.addColorStop(1, `rgba(255,80,120,${a})`);
      c.fillStyle = g;
      c.fillRect(-20, -20, this.W + 40, this.H + 40);
    }
  }
  drawBody(c, b, lookX, lx0 = null, ly0 = null) {
    const S = this.sprite(b.level);
    const dpr = this.dpr;
    const x = this.X(b.x);
    const y = this.Y(b.y);
    const vis = (b.r / b.R) * (b.pop < 1 ? 1 + 0.07 * Math.sin(b.pop * Math.PI) : 1);
    c.save();
    c.translate(x, y);
    c.rotate(b.sqa);
    c.scale(1 - b.sq, 1 + b.sq);
    c.rotate(-b.sqa + b.tilt);
    c.scale(vis, vis);
    const half = S.half / dpr;
    c.drawImage(S.cv, -half, -half, S.cv.width / dpr, S.cv.height / dpr);
    const u = S.u / dpr;
    const lx = lx0 != null ? lx0 : clamp((lookX - b.x) / 140, -1, 1);
    const ly = ly0 != null ? ly0 : clamp((JAR.SPAWN_Y - b.y) / 400, -1, 0.3);
    const expr = b.expr !== "idle" ? b.expr : b.blink < 0 ? "blink" : "idle";
    drawFace(c, b.level, u, expr, lx, ly);
    c.restore();
  }
}
