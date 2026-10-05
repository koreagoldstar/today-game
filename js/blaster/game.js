/*
 * 물총 대작전 엔진 · BlasterGame (StageSystem + CollisionSystem + 전체 흐름)
 *
 * 테마(바다 · 우주 · 공룡 …)는 content 하나로 꽂는다:
 *   content = { id, enemies, bosses, stages, bonus, items, projectiles, boats, art, scenes, menuScene, texts }
 * 엔진은 바다를 모른다. 적 이름 · 그림 · 배경 · 음악 분위기는 전부 content 에 있다.
 */
import { W, H, HORIZON, project, depthAt, setupCanvas, clamp, lerp, rand, pick, ease } from "./view.js?v=2";
import { AudioSystem } from "./audio.js?v=2";
import { EffectSystem, drawStar } from "./fx.js?v=2";
import { AimSystem } from "./input.js?v=2";
import { WaterSystem } from "./water.js?v=2";
import { ScoreSystem, POINTS } from "./score.js?v=2";
import { SaveSystem } from "./save.js?v=2";
import { EnemyBase, Spawn, groupOffsets } from "./enemy.js?v=2";
import { EnemyShot, ItemBubble } from "./shots.js?v=2";
import { BossBase } from "./boss.js?v=2";
import { BlasterUI } from "./ui.js?v=2";

const MAX_HEARTS = 3;

export class BlasterGame {
  constructor({ canvas, host, content }) {
    this.content = content;
    this.canvas = canvas;
    this.view = setupCanvas(canvas, host, () => {
      // 화면 비율이 바뀌면 배경 캐시를 다시 그린다
      if (this.scene && this.scene.rebuild) this.scene.rebuild();
      if (this.menuScene && this.menuScene.rebuild) this.menuScene.rebuild();
    });
    this.ctx = this.view.ctx;
    this.save = new SaveSystem(content.id);
    this.audio = new AudioSystem(this.save.settings);
    this.fx = new EffectSystem();
    this.fx.quality = this.save.settings.effects === "low" ? 0.5 : 1;
    this.aim = new AimSystem(canvas, this.view);
    this.water = new WaterSystem();
    this.score = new ScoreSystem();
    this.enemies = [];
    this.shots = [];
    this.items = [];
    this.boss = null;
    this.scene = null;
    this.run = null;
    this.state = "menu";
    this.time = 0;
    this.hearts = MAX_HEARTS;
    this.invuln = 0;
    this.power = null;
    this.player = { t: 0, recoil: 0, hurt: 0, cheer: 0, escape: 0, sail: 1 };
    this.hover = null;
    this.zaps = [];
    this.tut = null;
    this.hudCache = {};
    this.menuScene = content.menuScene ? content.menuScene(this) : null;
    this.env = this.makeEnv();
    this.ui = new BlasterUI(this, content);

    this.aim.onPress = () => {
      this.audio.unlock();
      if (this.tut && this.tut.step === 0) this.tut.pressed = true;
    };
    // 첫 터치에서 소리를 깨운다 (메뉴 버튼 포함)
    const wake = () => {
      this.audio.unlock();
      if (this.state === "menu" && !this.menuMusic) this.playMenuMusic();
    };
    window.addEventListener("pointerdown", wake, { passive: true });
    window.addEventListener("keydown", wake);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "play") this.pause();
    });

    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  /* ================================================================
   * 적 · 보스가 엔진에 부탁할 수 있는 것들
   * ============================================================== */
  makeEnv() {
    const g = this;
    return {
      t: 0,
      speed: 1,
      attackRate: 1,
      attacksOn: true,
      boatX: 0,
      fx: g.fx,
      audio: g.audio,
      waveAt: (x, z, t) => (g.scene && g.scene.waveAt ? g.scene.waveAt(x, z, t) : 0),
      hitBoat: (src) => g.hurt(src),
      shoot: (kind, from, opts) => g.enemyShoot(kind, from, opts),
      spawnEnemy: (id, opts) => g.spawnEnemy(id, opts || {}),
      flash: (a, c) => g.fx.flash(a, c),
      shake: (a) => g.fx.shake(a),
      say: (text, src) => {
        if (!src) return;
        g.fx.text(text, src.sx || W / 2, (src.sy || 300) - 120 * (src.s || 1), { size: 30, color: "#fff4a8", stroke: "#7a2f00", life: 1.1 });
      },
      onTeleport: (e) => {
        g.fx.bubbles(e.sx, e.sy - 20 * e.s, e.s * 1.4, 8);
        g.fx.mist(e.sx, e.sy - 30 * e.s, e.s, "rgba(220,200,255,0.8)");
        g.audio.play("teleport");
      },
      onBossDefeat: (b) => g.bossDefeated(b),
      onBossPhase: (b, ph) => {
        g.fx.showBanner(ph.shout || "화났다!", { color: "#ffe066", stroke: "#a3122a", life: 1.4, size: 54 });
        g.fx.shake(16);
        g.audio.play("bossAppear");
        g.shots.forEach((s) => (s.alive = false));
      },
      onBossStun: (b) => {
        g.fx.text("기절! 약점을 노려!", W / 2, 300, { size: 30, color: "#ffef7a", stroke: "#8a1d5a", life: 1.6 });
        g.fx.stars(b.sx, b.sy - 120 * b.s, b.s * 1.6, 8);
        g.audio.play("boing");
      },
      onBossWindup: (b, atk) => {
        if (atk.warn !== false) g.audio.play("warn");
      },
    };
  }

  /* ================================================================
   * 스테이지 시작
   * ============================================================== */
  startStage(index) {
    const data = this.content.stages[index];
    if (!data) return;
    this.beginRun({ kind: "stage", data, index });
  }

  startBonus(id) {
    const data = this.content.bonus.find((b) => b.id === id);
    if (!data) return;
    this.beginRun({ kind: "bonus", data, index: -1 });
  }

  beginRun({ kind, data, index }) {
    this.audio.unlock();
    this.resetField();
    const timeline = [];
    let lastT = 0;
    let gid = 0;
    for (const w of data.waves || []) {
      const [t, id, count = 1, opts = {}] = w;
      if (opts.group) {
        timeline.push({ t, id, n: count, opts, group: ++gid });
      } else {
        const gap = opts.gap != null ? opts.gap : 0.75;
        for (let i = 0; i < count; i++) timeline.push({ t: t + i * gap, id, n: 1, opts, slot: i, of: count });
      }
      lastT = Math.max(lastT, t + (opts.group ? 0 : (count - 1) * (opts.gap != null ? opts.gap : 0.75)));
    }
    timeline.sort((a, b) => a.t - b.t);
    for (const r of data.rare || []) {
      if (Math.random() < (r.chance == null ? 1 : r.chance)) timeline.push({ t: r.at, id: r.id, n: 1, opts: { ...(r.opts || {}), extra: true } });
    }
    timeline.sort((a, b) => a.t - b.t);
    const d = data.difficulty || 1;
    this.run = {
      kind,
      data,
      index,
      t: 0,
      phase: "waves",
      timeline,
      ti: 0,
      lastT,
      total: 0,
      groups: {},
      discovered: [],
      itemT: data.items ? data.items.first || 12 : 999,
      endT: 0,
      bossAt: 0,
      timeLeft: data.time || 0,
      rules: (data.rules || []).map((r) => ({ ...r, next: r.start || 0 })),
      tutorial: kind === "stage" && index === 0 && !this.save.data.tutorial,
    };
    Object.assign(this.env, {
      speed: data.speed || 0.8 + d * 0.035,
      attackRate: data.attackRate || 0.4 + d * 0.05,
      missChance: data.missChance != null ? data.missChance : Math.max(0.25, 0.6 - d * 0.03),
      attacksOn: data.attacks !== false && kind === "stage",
    });
    this.scene = this.content.scenes.create(data.scene, this);
    this.hearts = MAX_HEARTS;
    this.invuln = 0;
    this.power = null;
    this.water.kind = "normal";
    this.player = { t: 0, recoil: 0, hurt: 0, cheer: 0, escape: 0, sail: 0 };
    this.tut = this.run.tutorial ? { step: 0, t: 0, target: null, pressed: false } : null;
    this.audio.playMusic(data.music);
    this.menuMusic = false;
    this.aim.enabled = true;
    this.aim.x = W / 2;
    this.aim.y = 470;
    this.state = "play";
    this.ui.enterPlay(this.run);
    const title = kind === "bonus" ? `BONUS!` : `STAGE ${index + 1}`;
    this.fx.showBanner(title, { sub: data.name, life: 1.6, size: 58 });
    this.audio.play("motor");
  }

  resetField() {
    this.enemies.length = 0;
    this.shots.length = 0;
    this.items.length = 0;
    this.zaps.length = 0;
    this.boss = null;
    this.fx.reset();
    this.water.reset();
    this.score.reset();
    this.hudCache = {};
    this.hover = null;
  }

  /* ================================================================
   * 생성
   * ============================================================== */
  spawnEnemy(id, opts = {}) {
    const d = this.content.enemies[id];
    if (!d) return null;
    const e = new EnemyBase(d, { ...opts, attackRate: this.env.attackRate });
    if (opts.hp) e.hp = e.maxHp = opts.hp;
    const how = opts.spawn || d.spawnPattern || "side";
    if (how !== "none") (Spawn[how] || Spawn.side)(e, opts);
    else {
      e.x = opts.x || 0;
      e.z = opts.z || 0.4;
      e.sub = opts.sub || 0;
    }
    if (opts.dir) e.dir = opts.dir;
    if (opts.vx != null) e.mem.vx = opts.vx;
    if (d.carry) e.carry = d.carry === "random" ? pick(this.itemPool()) : d.carry;
    if (!opts.minion && !opts.extra && !opts.part && this.run) this.run.total++;
    this.enemies.push(e);
    return e;
  }

  spawnEntry(en) {
    const d = this.content.enemies[en.id];
    if (!d) return;
    const opts = { ...en.opts };
    if (en.of > 1 && opts.x == null && (opts.spawn || d.spawnPattern) === "popup") {
      // 여러 마리가 한꺼번에 솟을 때는 겹치지 않게 자리를 나눠 준다
      opts.x = lerp(-0.7, 0.7, (en.slot + 0.5) / en.of) + rand(-0.1, 0.1);
    }
    if (en.group) {
      const lead = this.spawnEnemy(en.id, opts);
      if (!lead) return;
      lead.slot = 0;
      lead.mem.gid = en.group;
      const offs = groupOffsets(opts.group, en.n);
      this.run.groups[en.group] = { n: en.n, soaked: 0, id: en.id, kind: opts.group };
      for (let i = 1; i < en.n; i++) {
        const e = this.spawnEnemy(en.id, { ...opts, spawn: "none", x: lead.x + offs[i].dx * lead.dir, z: clamp(lead.z + offs[i].dz, 0.05, 0.85), dir: lead.dir, sub: lead.sub });
        if (!e) continue;
        e.slot = i;
        e.leader = lead;
        e.mem.gid = en.group;
        e.age = -i * 0.05;
      }
      return;
    }
    this.spawnEnemy(en.id, opts);
  }

  enemyShoot(kind, from, opts = {}) {
    const data = (this.content.projectiles || {})[kind] || {};
    // 일반 친구가 던지는 것은 꽤 자주 보트 옆으로 빗나간다 (아이가 숨 돌릴 틈)
    if (opts.fromEnemy && Math.random() < this.env.missChance) opts = { ...opts, dx: (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 0.85) };
    const s = new EnemyShot(kind, data, from, opts);
    this.shots.push(s);
    if (!opts.silent) this.audio.play("throw");
    return s;
  }

  itemPool() {
    const r = this.run;
    const pool = (r && r.data.items && r.data.items.pool) || ["bomb", "rainbow"];
    return this.hearts < MAX_HEARTS && r && (r.data.difficulty || 1) >= 4 ? pool.concat(["heart"]) : pool;
  }

  spawnItem(id, opts) {
    const data = (this.content.items || {})[id];
    if (!data) return null;
    const it = new ItemBubble(id, data, opts);
    this.items.push(it);
    return it;
  }

  /* ================================================================
   * 메인 루프
   * ============================================================== */
  frame(now) {
    const dt = Math.min(1 / 30, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    try {
      this.update(dt);
      this.draw();
    } catch (err) {
      // 한 프레임 오류로 게임 전체가 멈추지 않게
      console.error(err);
    }
    requestAnimationFrame(this.frame);
  }

  update(dt) {
    if (this.state === "menu") {
      if (this.menuScene) this.menuScene.update(dt);
      return;
    }
    if (this.state === "paused" || this.state === "result") {
      return;
    }
    const run = this.run;
    if (!run) return;
    const env = this.env;
    const iceSlow = this.power && this.power.id === "ice" ? 0.3 : 1;
    // PERFECT 순간 아주 잠깐 멈칫 (히트스톱) — 손맛
    let stop = 1;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      stop = 0.08;
    }
    const wdt = dt * iceSlow * stop;
    run.t += dt;
    env.t = run.t;
    this.player.t += dt;
    this.player.sail = Math.min(1, this.player.sail + dt * 1.2);
    this.player.recoil = Math.max(0, this.player.recoil - dt * 8);
    this.player.hurt = Math.max(0, this.player.hurt - dt * 0.8);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.scene && this.scene.update) this.scene.update(dt, this);
    this.aim.update(dt);

    // --- 스테이지 진행 ---
    if (run.phase === "waves") {
      if (run.kind === "bonus") this.updateBonusRules(dt);
      while (run.ti < run.timeline.length && run.timeline[run.ti].t <= run.t) {
        this.spawnEntry(run.timeline[run.ti]);
        run.ti++;
      }
      if (run.data.items && run.kind === "stage") {
        run.itemT -= dt;
        if (run.itemT <= 0) {
          run.itemT = run.data.items.every || 16;
          this.spawnItem(pick(this.itemPool()));
        }
      }
      if (run.kind === "bonus") {
        run.timeLeft = Math.max(0, (run.data.time || 30) - run.t);
        if (run.timeLeft <= 0) this.bonusTimeUp();
      } else if (run.ti >= run.timeline.length) {
        const liveMain = this.enemies.some((e) => e.state === "live" && !e.minion && !e.opts.extra);
        if (!liveMain || run.t > run.lastT + 14) {
          if (run.data.boss) this.startBoss();
          else this.stageClear();
        }
      }
    } else if (run.phase === "bossIntro") {
      run.bossAt += dt;
      if (run.bossAt > 0.1 && !this.boss) this.spawnBoss();
      if (this.boss && this.boss.mode !== "intro") run.phase = "boss";
    } else if (run.phase === "clear" || run.phase === "fail" || run.phase === "timeup") {
      run.endT += dt;
      if (run.phase === "clear") this.player.cheer = Math.min(1, this.player.cheer + dt * 2);
      if (run.phase === "fail") this.player.escape = Math.min(1, run.endT / 2.2);
      if (run.endT > (run.phase === "fail" ? 2.8 : 2.6)) this.finishRun();
    }

    // --- 적 ---
    for (const e of this.enemies) {
      e.update(wdt, env);
      e.layout();
      if (e.mem.splash) {
        e.mem.splash = false;
        const w = project(e.x, e.z, 0);
        this.fx.splash(w.sx, w.sy, e.s * 0.7, { count: 6, ring: true });
      }
      if (e.state === "dead" && !e.counted) {
        e.counted = true;
        if (e.escaped && !e.minion && !e.opts.extra && !e.opts.part) {
          this.score.escaped++;
          if (e.visibleAt >= 0 && run.phase === "waves" && run.kind === "stage") {
            this.fx.text("바이바이~", clamp(e.sx, 60, W - 60), e.sy - 40 * e.s, { size: 20, color: "#d8f3ff", stroke: "#2a5d82", life: 0.9, pop: false });
          }
        }
        if (e.parent && this.boss) this.boss.parts = this.boss.parts.filter((p) => p !== e);
      }
    }
    if (this.enemies.length > 0 && this.enemies.some((e) => e.state === "dead")) this.enemies = this.enemies.filter((e) => e.state !== "dead");

    // --- 보스 ---
    if (this.boss) {
      this.boss.update(wdt);
      this.boss.layout();
      if (this.boss.done && run.phase === "boss") this.stageClear(true);
    }

    // --- 적이 던진 것 ---
    for (const s of this.shots) {
      const r = s.update(wdt, 1);
      s.layout();
      if (r === "boat") this.shotReachedBoat(s);
      else if (r === "water") {
        this.fx.splash(s.sx, s.sy, s.s * 0.8, { count: 8, color: (s.d && s.d.color) || "#7fd6ff" });
      }
    }
    if (this.shots.some((s) => !s.alive)) this.shots = this.shots.filter((s) => s.alive);

    // --- 아이템 ---
    for (const it of this.items) {
      it.update(dt);
      it.layout();
    }
    if (this.items.some((i) => !i.alive)) this.items = this.items.filter((i) => i.alive);

    // --- 파워업 ---
    if (this.power) {
      this.power.t -= dt;
      if (this.power.t <= 0) {
        this.power = null;
        this.water.kind = "normal";
        this.water.rate = 0.11;
      }
    }

    // --- 물총 ---
    const canShoot = run.phase === "waves" || run.phase === "boss" || run.phase === "bossIntro";
    const firing = canShoot && this.aim.shooting;
    if (firing) this.audio.streamOn();
    else this.audio.streamOff();
    if (this.water.ready(dt, firing)) this.fireOnce();
    const noz = this.nozzle();
    this.water.update(dt, firing, this.aim, noz, (b) => this.resolve(b), (t) => this.homingPoint(t));
    this.hover = canShoot ? this.pickAt(this.aim.x, this.aim.y, this.save.settings.assist ? 1.3 : 1, this.save.settings.assist ? 18 : 0) : null;

    // --- 번개 줄 ---
    for (const z of this.zaps) z.t -= dt;
    if (this.zaps.length && this.zaps[0].t <= 0) this.zaps = this.zaps.filter((z) => z.t > 0);

    // --- 점수 · 콤보 ---
    const broke = this.score.update(dt);
    if (broke) this.ui.comboBroke();
    this.fx.update(dt);
    if (this.tut) this.updateTutorial(dt);
    this.ui.hud(this.hudState());
  }

  updateBonusRules(dt) {
    const run = this.run;
    for (const r of run.rules) {
      if (r.once && r.done) continue;
      if (r.cond === "combo" && this.score.combo.count < (r.combo || 10)) continue;
      r.next -= dt;
      if (r.next > 0) continue;
      r.next = r.every * rand(0.85, 1.15) * (r.speedUp ? Math.max(0.55, 1 - run.t / (run.data.time * 1.6)) : 1);
      const n = r.n || 1;
      for (let i = 0; i < n; i++) {
        const opts = { ...(r.opts || {}), extra: false };
        if (r.rows) {
          const row = pick(r.rows);
          Object.assign(opts, { spawn: "none", z: row.z, x: -1.25 * row.dir, dir: row.dir, h: row.h || 0 });
        }
        if (r.xs) opts.x = rand(r.xs[0], r.xs[1]);
        if (r.zs) opts.z = rand(r.zs[0], r.zs[1]);
        const id = Array.isArray(r.enemy) ? weighted(r.enemy) : r.enemy;
        this.spawnEnemy(id, opts);
      }
      if (r.once) r.done = true;
    }
  }

  /* ================================================================
   * 쏘기 · 맞히기 (CollisionSystem)
   * ============================================================== */
  nozzle() {
    return this.content.art.nozzle(this.playerState());
  }

  playerState() {
    return {
      ...this.player,
      aimX: this.aim.x,
      aimY: this.aim.y,
      firing: this.aim.shooting,
      boat: this.save.data.boat,
      hearts: this.hearts,
      invuln: this.invuln,
      power: this.power ? this.power.id : null,
      time: this.time,
    };
  }

  /** (x, y) 에 있는 맞힐 수 있는 것 중 가장 앞에 있는 것 */
  pickAt(x, y, mult = 1, extra = 0) {
    let best = null;
    let bestScore = Infinity;
    const consider = (kind, ref, cx, cy, r, z, weak) => {
      const d = Math.hypot(x - cx, y - cy);
      const rr = r * mult + extra;
      if (d > rr) return;
      // 가까운(앞쪽) 것과 원 중심에 가까운 것을 먼저 · 약점과 날아오는 것은 우선
      const sc = d / rr - z * 0.6 - (weak ? 0.5 : 0) - (kind === "shot" ? 0.35 : 0);
      if (sc < bestScore) {
        bestScore = sc;
        best = { kind, ref, x: cx, y: cy, r, weak: Boolean(weak) };
      }
    };
    for (const e of this.enemies) {
      if (!e.targetable) continue;
      const w = e.weakPointScreen();
      if (w) consider("enemy", e, w.x, w.y, w.r, e.z + 0.01, true);
      consider("enemy", e, e.hx, e.hy, e.hr, e.z, false);
    }
    for (const s of this.shots) if (s.targetable) consider("shot", s, s.sx, s.sy, s.hr, s.z);
    for (const it of this.items) if (it.targetable) consider("item", it, it.sx, it.sy, it.hr, it.z);
    if (this.boss) {
      const cs = this.boss.hitCircles();
      cs.forEach((c, i) => consider("boss", this.boss, c.x, c.y, c.r, this.boss.z - (c.weak ? 0 : 0.02), c.weak ? { i, id: c.id } : null));
    }
    return best;
  }

  /** 물방울이 따라갈 대상의 지금 위치 */
  homingPoint(t) {
    if (t.kind === "enemy") {
      const e = t.ref;
      if (!e.targetable) return null;
      if (t.weak) {
        const w = e.weakPointScreen();
        return w ? { x: w.x, y: w.y } : { x: e.hx, y: e.hy };
      }
      return { x: e.hx, y: e.hy };
    }
    if (t.kind === "shot" || t.kind === "item") return t.ref.targetable ? { x: t.ref.sx, y: t.ref.sy } : null;
    if (t.kind === "boss") {
      const b = t.ref;
      if (!b.alive) return null;
      const cs = b.hitCircles();
      const c = t.weak ? cs.find((q) => q.weak && q.id === t.weak.id) : cs.find((q) => !q.weak);
      return c ? { x: c.x, y: c.y } : null;
    }
    return null;
  }

  fireOnce() {
    const assist = this.save.settings.assist;
    const raw = { x: this.aim.x, y: this.aim.y };
    const noz = this.nozzle();
    const shootAt = (ax, ay) => {
      const cand = this.pickAt(ax, ay, assist ? 1.3 : 1, assist ? 18 : 0);
      let to = { x: ax, y: ay };
      let perfect = false;
      if (cand) {
        // 한가운데(반지름 30% 안)를 맞혀야 PERFECT — 약점은 언제나 PERFECT
        perfect = Math.hypot(ax - cand.x, ay - cand.y) <= cand.r * 0.3 || cand.weak;
        // 조준 도우미: 대상 쪽으로 살짝 끌어당기고 따라가게
        to = assist ? { x: lerp(ax, cand.x, 0.65), y: lerp(ay, cand.y, 0.65) } : to;
      }
      const b = this.water.fire(noz, to, { target: cand, raw: { x: ax, y: ay } });
      if (b) b.perfect = perfect;
      this.score.shot();
    };
    if (this.power && this.power.id === "rainbow") {
      shootAt(raw.x, raw.y);
      shootAt(raw.x - 46, raw.y + 8);
      shootAt(raw.x + 46, raw.y + 8);
    } else shootAt(raw.x, raw.y);
    this.player.recoil = 1;
    this.audio.play("fire");
  }

  resolve(b) {
    const run = this.run;
    if (!run || this.state !== "play") return;
    let hit = null;
    if (b.target) {
      const p = this.homingPoint(b.target);
      if (p && Math.hypot(p.x - b.tx, p.y - b.ty) < b.target.r * 1.35 + 14) hit = b.target;
    }
    if (!hit) hit = this.pickAt(b.tx, b.ty, 1.1, 6);
    // 바위 · 빙산 같은 가림막
    const blocker = this.scene && this.scene.blockAt ? this.scene.blockAt(b.tx, b.ty, hit ? hitZ(hit) : -1) : null;
    if (blocker) {
      this.fx.impact(b.tx, b.ty, 0.8, { onWater: false });
      this.fx.text("팅!", b.tx, b.ty - 20, { size: 22, color: "#fff", stroke: "#555", life: 0.5 });
      this.audio.play("shield");
      return;
    }
    if (!hit) {
      // 빗나감: 물에 '첨벙' (멀수록 작게)
      if (b.ty > HORIZON + 18) this.fx.impact(b.tx, b.ty, project(0, depthAt(b.ty), 0).s, { onWater: true, power: 0.8 });
      else this.fx.splash(b.tx, b.ty, 0.4, { count: 5, ring: false });
      this.audio.play("drop");
      return;
    }
    this.score.hit();
    this.applyHit(hit, b, 1);
    if (this.power && this.power.id === "thunder") this.chainZap(hit, b);
  }

  applyHit(hit, b, dmg) {
    const fx = this.fx;
    const px = b ? b.tx : hit.x;
    const py = b ? b.ty : hit.y;
    if (hit.kind === "enemy") {
      const e = hit.ref;
      const res = e.takeHit(dmg, this.env, { weak: hit.weak, big: b && b.big });
      if (res === "chip" || res === "soak" || res === "shield") {
        // 물줄기 방향으로 살짝 밀려나며 부르르
        const n = this.nozzle();
        const dx = px - n.x;
        const dy = py - n.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = res === "shield" ? 3 : 9;
        e.kbx += (dx / d) * f * Math.max(0.6, e.s);
        e.kby += (dy / d) * f * 0.6 * Math.max(0.6, e.s);
        e.shakeT = 0.18;
      }
      if (res === "shield") {
        fx.sparkle(px, py, 0.8, 5, "#ffffff");
        fx.text("팅!", px, py - 24, { size: 22, color: "#fff", stroke: "#45607a", life: 0.5 });
        this.audio.play("shield");
        if (this.tut && this.tut.step >= 1) this.tutHint("등껍질이 열릴 때 쏴요!");
      } else if (res === "chip") {
        fx.impact(px, py, Math.max(0.6, e.s), { onWater: false });
        const { got } = this.score.add(POINTS.chip, { combo: false });
        fx.text(`+${got}`, px, py - 30 * e.s, { size: 18, color: "#d6f4ff", life: 0.6 });
        this.audio.play("hit");
      } else if (res === "soak") {
        this.onSoak(e, { perfect: b ? b.perfect : false, weak: hit.weak, x: px, y: py });
      }
    } else if (hit.kind === "shot") {
      const s = hit.ref;
      s.hp -= dmg;
      if (s.hp <= 0) {
        s.alive = false;
        fx.splash(s.sx, s.sy, s.s * 1.1, { count: 14, color: (s.d && s.d.color) || "#7fd6ff" });
        if (s.kind === "ink") fx.ink(s.sx, s.sy, s.s);
        this.score.combo.add();
        const { got } = this.score.add(50);
        fx.text(`+${got}`, s.sx, s.sy - 20, { size: 20, color: "#fff", life: 0.6 });
        this.audio.play("pop");
      }
    } else if (hit.kind === "item") {
      this.collectItem(hit.ref);
    } else if (hit.kind === "boss") {
      const boss = hit.ref;
      const res = boss.takeHit(Boolean(hit.weak));
      if (res === "weak") {
        this.score.weakHits++;
        const first = boss.scoredSeq !== boss.modeSeq;
        if (first) {
          // 약점이 열린 뒤 첫 명중 = 1000점, 이어서 맞히면 작은 점수
          boss.scoredSeq = boss.modeSeq;
          this.score.combo.add();
          const { got } = this.score.add(POINTS.weak);
          fx.splash(px, py, 1.6, { count: 22, power: 1.2 });
          fx.stars(px, py, 1.2, 5);
          fx.text(`+${got}`, px, py - 40, { size: 34, color: "#ffe066", stroke: "#8a2a00", life: 0.9 });
          fx.text("약점!", px, py - 84, { size: 26, color: "#ff8fc2", stroke: "#6b0f3f", life: 0.8 });
          fx.shake(7);
          this.audio.play("weak");
          this.haptic(25);
        } else {
          const { got } = this.score.add(60, { combo: false });
          fx.splash(px, py, 1.1, { count: 12 });
          if (Math.random() < 0.4) fx.text(`+${got}`, px, py - 30, { size: 20, color: "#ffd1e8", life: 0.5 });
          this.audio.play("bossHit");
          fx.shake(2);
        }
      } else if (res === "body") {
        fx.splash(px, py, 0.9, { count: 9 });
        const { got } = this.score.add(20, { combo: false });
        if (Math.random() < 0.35) fx.text(`+${got}`, px, py - 24, { size: 18, color: "#e8f7ff", life: 0.5 });
        this.audio.play("bossHit");
      } else if (res === "shield") {
        fx.sparkle(px, py, 0.8, 4, "#fff");
        if (Math.random() < 0.3) fx.text("촉수부터!", px, py - 30, { size: 20, color: "#fff", stroke: "#5b2a86", life: 0.7 });
        this.audio.play("shield");
      }
    }
  }

  onSoak(e, info) {
    const fx = this.fx;
    const run = this.run;
    const d = e.d;
    if (e.mem.noScore) return;
    if (!e.minion && !e.opts.extra && !e.opts.part) this.score.soaked++;
    let base = d.score || POINTS.hit;
    let label = "";
    const fast = e.visibleAt >= 0 && e.age - e.visibleAt < 1.1 && !e.opts.part;
    if (e.bonus) {
      base = Math.max(base, POINTS.bonus);
      label = "BONUS!";
      this.score.bonusHits++;
    }
    if (info.weak || info.perfect) {
      base = Math.max(base, POINTS.perfect);
      label = "PERFECT!";
      this.score.perfects++;
    } else if (fast) {
      base = Math.max(base, POINTS.fast);
      label = label || "FAST!";
      this.score.fasts++;
    }
    const multUp = this.score.combo.add();
    const { got, mult } = this.score.add(base);
    const x = e.hx;
    const y = e.hy;
    fx.impact(x, y, Math.max(0.8, e.s * 1.2), { onWater: false, power: 1.2 });
    fx.splash(x, y, Math.max(0.7, e.s * 1.1), { count: 12, power: 1.1, ring: false });
    fx.stars(x, y - 10, e.s, 4);
    fx.text(`+${got}`, x, y - 36 * e.s, { size: 28 + Math.min(10, mult * 2), color: mult > 1 ? "#ffe066" : "#ffffff", life: 0.9 });
    if (label) {
      const perfect = label.startsWith("PERFECT");
      fx.text(label, x, y - 80 * e.s - 10, { size: perfect ? 40 : 24, color: perfect ? "#ff9ad1" : e.bonus ? "#ffd84a" : "#9ff3ff", stroke: perfect ? "#6a1050" : "#0d4b6e", life: 1 });
      if (perfect) {
        fx.perfectBurst(x, y, Math.max(0.8, e.s));
        fx.flash(0.16, "#ffffff");
        fx.shake(5);
        this.hitStop = 0.07;
        this.audio.play("perfect");
      }
    }
    if (e.bonus) {
      fx.coins(x, y, 8);
      this.audio.play("bonus");
    }
    this.audio.play("splash");
    this.audio.play(d.sound || "boing");
    if (multUp) {
      fx.showBanner(`x${this.score.combo.mult} 콤보!`, { color: "#ffe066", stroke: "#b33a00", life: 0.9, size: 48 });
      this.audio.play("multiplier");
    } else if (this.score.combo.count >= 3) this.audio.play("combo", { n: this.score.combo.count });
    this.haptic(12);
    // 도감
    if (d.book !== false && this.save.discover(d.bookId || d.id)) {
      run.discovered.push(d.bookId || d.id);
      this.ui.toast(`새 친구 발견! ${d.name}`);
      this.audio.play("discover");
    }
    // 무리 보너스
    const gid = e.mem.gid;
    if (gid && run.groups[gid]) {
      const g = run.groups[gid];
      g.soaked++;
      if (g.soaked === g.n) {
        const r = this.score.add(POINTS.bonus);
        fx.text(`${g.kind === "school" ? "물고기 떼" : "특공대"} 전부! +${r.got}`, W / 2, 330, { size: 28, color: "#ffe066", stroke: "#0b4f7c", life: 1.4 });
        this.audio.play("bonus");
      }
    }
    // 특수 능력
    if (d.specialAbility === "split" && d.splitInto) {
      for (let i = 0; i < 3; i++) {
        const m = this.spawnEnemy(d.splitInto, { minion: true, spawn: "none", x: clamp(e.x + (i - 1) * 0.22, -0.95, 0.95), z: clamp(e.z + rand(-0.05, 0.08), 0.1, 0.8) });
        if (m) m.mem.vx = (i - 1) * 0.25;
      }
      fx.text("펑! 셋이 됐다!", x, y - 110 * e.s, { size: 24, color: "#fff", stroke: "#8a3d00", life: 1 });
    }
    if (e.carry) {
      this.spawnItem(e.carry, { x: e.x, z: e.z, h: 60 });
      fx.text("보물을 되찾았다!", x, y - 110 * e.s, { size: 22, color: "#ffe066", stroke: "#6b3a00", life: 1.1 });
      e.carry = null;
    }
    if (d.drop && Math.random() < (d.dropChance || 1)) this.spawnItem(d.drop === "random" ? pick(this.itemPool()) : d.drop, { x: e.x, z: e.z, h: 60 });
    // 튜토리얼
    if (this.tut) this.tut.soaked = (this.tut.soaked || 0) + 1;
  }

  chainZap(hit, b) {
    // 찌릿 물총: 근처 둘에게 번개가 옮겨 간다
    const from = { x: b.tx, y: b.ty };
    let n = 0;
    for (const e of this.enemies) {
      if (n >= 2) break;
      if (!e.targetable || (hit.kind === "enemy" && hit.ref === e)) continue;
      if (Math.hypot(e.hx - from.x, e.hy - from.y) > 190) continue;
      this.zaps.push({ x0: from.x, y0: from.y, x1: e.hx, y1: e.hy, t: 0.22 });
      this.applyHit({ kind: "enemy", ref: e, x: e.hx, y: e.hy, r: e.hr, weak: false }, null, 1);
      n++;
    }
    if (n) this.audio.play("zap");
  }

  collectItem(it) {
    it.alive = false;
    const fx = this.fx;
    const d = it.d;
    fx.sparkle(it.sx, it.sy, 1.4, 14, d.color || "#fff");
    fx.splash(it.sx, it.sy, 1, { count: 10, ring: false });
    this.audio.play("item");
    this.save.markItem(it.id);
    if (d.book !== false && this.save.discover(`item-${it.id}`)) this.run.discovered.push(`item-${it.id}`);
    switch (d.effect) {
      case "bomb":
        this.waterBomb(it.sx, it.sy);
        break;
      case "heart":
        this.hearts = Math.min(MAX_HEARTS, this.hearts + 1);
        fx.text("하트 +1", it.sx, it.sy - 30, { size: 30, color: "#ff8fb1", stroke: "#7a0f35", life: 1.1 });
        break;
      default:
        this.power = { id: d.effect, t: d.time || 7, max: d.time || 7 };
        this.water.kind = d.effect;
        this.water.rate = d.effect === "rainbow" ? 0.13 : 0.11;
        if (d.effect === "rainbow") this.score.doubleT = d.time || 7;
        if (d.effect === "ice") {
          fx.flash(0.4, "#d8f6ff");
          this.audio.play("freeze");
        }
        break;
    }
    fx.showBanner(d.title || d.name, { sub: d.desc || "", color: d.color || "#fff", stroke: d.stroke || "#0b4f7c", life: 1.3, size: 46 });
  }

  waterBomb(x, y) {
    const fx = this.fx;
    fx.splash(x, y, 3, { count: 50, power: 1.4 });
    fx.flash(0.5, "#c9f1ff");
    fx.shake(18);
    this.audio.play("bomb");
    const R = 230;
    for (const e of this.enemies) {
      if (!e.targetable || Math.hypot(e.hx - x, e.hy - y) > R) continue;
      e.shielded = false;
      e.hp = 1;
      this.applyHit({ kind: "enemy", ref: e, x: e.hx, y: e.hy, r: e.hr }, null, 1);
    }
    for (const s of this.shots) {
      if (s.targetable && Math.hypot(s.sx - x, s.sy - y) < R + 60) this.applyHit({ kind: "shot", ref: s }, null, 9);
    }
    if (this.boss && this.boss.alive && this.boss.mode !== "intro") {
      this.boss.shielded = false;
      for (let i = 0; i < 3; i++) this.boss.takeHit(true);
      fx.text("보스에게 대폭발!", W / 2, 320, { size: 30, color: "#ffe066", stroke: "#0b4f7c", life: 1.2 });
    }
  }

  shotReachedBoat(s) {
    const d = s.d || {};
    if (d.effect === "ink") {
      this.fx.inkScreen(3);
      this.fx.text("먹물 뿅! (금방 지워져요)", W / 2, H - 320, { size: 22, color: "#fff", stroke: "#3d2266", life: 1.4 });
      this.audio.play("splash");
      this.score.combo.break();
      return;
    }
    this.hurt(s);
  }

  hurt(src) {
    if (!this.run || this.invuln > 0 || this.run.phase === "clear" || this.run.phase === "fail") return;
    if (this.run.kind === "bonus") return;
    this.hearts--;
    this.score.heartsLost++;
    this.invuln = 2.1;
    this.player.hurt = 1;
    const had = this.score.combo.break();
    if (had >= 5) this.ui.comboBroke();
    this.fx.wetScreen(16);
    this.fx.shake(12);
    this.fx.flash(0.25, "#bfe9ff");
    this.audio.play("boatHit");
    this.haptic(60);
    this.fx.text(pick(["앗 차가워!", "으앗, 흠뻑!", "푸하하 젖었다!"]), W / 2, H - 270, { size: 28, color: "#ffffff", stroke: "#1b5f95", life: 1.2 });
    if (this.hearts <= 0) this.stageFail();
  }

  haptic(ms) {
    if (!this.save.settings.vibrate || !navigator.vibrate) return;
    try {
      navigator.vibrate(ms);
    } catch (_) {}
  }

  /* ================================================================
   * 보스
   * ============================================================== */
  startBoss() {
    const run = this.run;
    run.phase = "bossIntro";
    run.bossAt = 0;
    const bd = this.content.bosses[run.data.boss];
    this.fx.showBanner("BOSS!", { sub: bd.name, color: "#ffe066", stroke: "#a3122a", life: 2.4, size: 76 });
    this.audio.play("bossAppear");
    this.fx.shake(10);
    if (run.data.bossMusic) this.audio.playMusic(run.data.bossMusic);
    // 보스 앞에서 하트가 모자라면 하트 튜브 하나 (아이들이 끝까지 해 볼 수 있게)
    if (this.hearts < MAX_HEARTS) this.spawnItem("heart", { x: 0.35, z: 0.55, h: 90, life: 14 });
  }

  spawnBoss() {
    const bd = this.content.bosses[this.run.data.boss];
    const b = new BossBase(bd, this.env);
    this.boss = b;
    b.layout();
    this.ui.bossBar(bd);
  }

  bossDefeated(b) {
    const fx = this.fx;
    this.shots.forEach((s) => (s.alive = false));
    for (const e of this.enemies) if (e.state === "live") e.soak(this.env, "spinAway");
    const { got } = this.score.add(5000, { combo: false });
    fx.showBanner("SUPER SPLASH!!", { sub: `+${got}`, color: "#7ff3ff", stroke: "#0b3f7c", life: 2.6, size: 54 });
    fx.splash(b.sx, b.sy - 80 * b.s, 4, { count: 70, power: 1.6 });
    fx.stars(b.sx, b.sy - 100 * b.s, 2.4, 16);
    fx.flash(0.7, "#ffffff");
    fx.shake(24);
    this.audio.play("super");
    this.haptic(120);
    if (this.save.discover(b.d.bookId || b.d.id)) {
      this.run.discovered.push(b.d.bookId || b.d.id);
      this.ui.toast(`보스 기록! ${b.d.name}`);
    }
  }

  /* ================================================================
   * 끝내기
   * ============================================================== */
  stageClear(fromBoss) {
    const run = this.run;
    if (run.phase === "clear" || run.phase === "fail") return;
    run.phase = "clear";
    run.endT = fromBoss ? -0.8 : 0;
    this.aim.release();
    this.audio.streamOff();
    for (const e of this.enemies) if (e.state === "live") e.done = true;
    this.shots.forEach((s) => (s.alive = false));
    this.fx.showBanner("STAGE CLEAR!", { color: "#fff36b", stroke: "#0b4f7c", life: 2.2, size: 56 });
    this.fx.confetti(70);
    this.audio.stopMusic();
    this.audio.play("clear");
    this.ui.bossBar(null);
  }

  stageFail() {
    const run = this.run;
    run.phase = "fail";
    run.endT = 0;
    this.aim.release();
    this.audio.streamOff();
    this.shots.forEach((s) => (s.alive = false));
    this.fx.showBanner("긴급 탈출!", { sub: "괜찮아, 다시 하면 돼!", color: "#ffffff", stroke: "#c2410c", life: 2.6, size: 50 });
    this.audio.stopMusic();
    this.audio.play("fail");
    this.audio.play("motor");
    this.ui.bossBar(null);
  }

  bonusTimeUp() {
    const run = this.run;
    run.phase = "timeup";
    run.endT = 0;
    this.aim.release();
    this.audio.streamOff();
    for (const e of this.enemies) if (e.state === "live") e.done = true;
    this.fx.showBanner("TIME UP!", { color: "#ffe066", stroke: "#0b4f7c", life: 2.2, size: 60 });
    this.fx.confetti(40);
    this.audio.stopMusic();
    this.audio.play("clear");
  }

  finishRun() {
    const run = this.run;
    this.state = "result";
    this.aim.enabled = false;
    this.audio.streamOff();
    if (run.kind === "bonus") {
      const g = run.data.grades || { S: 9000, A: 6000, B: 3000 };
      const sc = this.score.score;
      const grade = sc >= g.S ? "S" : sc >= g.A ? "A" : sc >= g.B ? "B" : "C";
      const rec = this.save.recordBonus(run.data.id, sc);
      if (grade === "S") this.audio.play("rankS");
      this.ui.showResult({
        kind: "bonus",
        data: run.data,
        cleared: true,
        score: sc,
        accuracy: this.score.accuracy,
        maxCombo: this.score.combo.max,
        perfects: this.score.perfects,
        grade,
        newBest: rec.newBest,
        best: this.save.data.bonus[run.data.id].best,
        discovered: run.discovered,
        newBoats: [],
        bonusUnlocked: [],
      });
      return;
    }
    const cleared = run.phase === "clear";
    const g = this.score.grade({ total: run.total, heartsLeft: this.hearts, maxHearts: MAX_HEARTS, failed: !cleared });
    const r = {
      kind: "stage",
      data: run.data,
      index: run.index,
      cleared,
      failed: !cleared,
      score: this.score.score,
      accuracy: this.score.accuracy,
      maxCombo: this.score.combo.max,
      perfects: this.score.perfects,
      soaked: this.score.soaked,
      total: run.total,
      grade: g.grade,
      gradePoints: g.points,
      discovered: run.discovered,
    };
    const prevUnlocked = this.save.data.unlocked;
    const rec = this.save.recordStage(run.data.id, run.index, r, this.content.stages.length);
    if (cleared && run.index === 0) this.save.data.tutorial = true;
    r.newBest = rec.newBest;
    r.firstClear = rec.firstClear;
    r.unlockedNext = rec.unlockedNext;
    r.best = (this.save.stage(run.data.id) || {}).best || 0;
    r.newBoats = [];
    r.bonusUnlocked = [];
    if (cleared) {
      for (const bt of this.content.boats || []) {
        if (bt.unlock && bt.unlock.stage === run.index + 1 && this.save.unlockBoat(bt.id)) r.newBoats.push(bt);
        if (bt.unlock && bt.unlock.allS && this.allS() && this.save.unlockBoat(bt.id)) r.newBoats.push(bt);
      }
      for (const bn of this.content.bonus || []) if (bn.unlockAfter === run.index + 1 && prevUnlocked <= run.index + 1) r.bonusUnlocked.push(bn);
    }
    this.save.save();
    if (cleared && g.grade === "S") this.audio.play("rankS");
    this.ui.showResult(r);
  }

  allS() {
    return this.content.stages.every((s) => (this.save.stage(s.id) || {}).grade === "S");
  }

  isBonusOpen(bn) {
    return this.save.data.unlocked > bn.unlockAfter || this.save.stage(this.content.stages[bn.unlockAfter - 1].id)?.clears > 0;
  }

  pause() {
    if (this.state !== "play") return;
    this.state = "paused";
    this.aim.release();
    this.audio.streamOff();
    this.audio.stopMusic();
    this.ui.showPause(true);
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "play";
    this.last = performance.now();
    if (this.run) this.audio.playMusic(this.run.phase === "boss" && this.run.data.bossMusic ? this.run.data.bossMusic : this.run.data.music);
    this.ui.showPause(false);
  }

  toMenu() {
    this.state = "menu";
    this.run = null;
    this.aim.enabled = false;
    this.aim.release();
    this.audio.streamOff();
    this.resetField();
    this.playMenuMusic();
  }

  playMenuMusic() {
    this.menuMusic = true;
    this.audio.playMusic(this.content.menuMusic);
  }

  /* ================================================================
   * 튜토리얼 — 글은 짧게, 손가락으로 보여 주기
   * ============================================================== */
  updateTutorial(dt) {
    const tut = this.tut;
    tut.t += dt;
    if (tut.step === 0) {
      tut.target = this.enemies.find((e) => e.targetable) || null;
      if ((tut.soaked || 0) >= 1) {
        tut.step = 1;
        tut.t = 0;
        this.fx.showBanner("좋아!", { color: "#fff36b", stroke: "#0b4f7c", life: 1, size: 70 });
      }
    } else if (tut.step === 1) {
      if ((tut.soaked || 0) >= 3) {
        tut.step = 2;
        tut.t = 0;
        tut.msg = this.aim.mode === "key" ? "Space 를 꾹 누르면 물줄기!" : "꾹 누르고 있으면 물줄기 발사!";
      }
    } else if (tut.step === 2) {
      if (tut.t > 3) {
        tut.step = 3;
        tut.msg = "";
      }
    }
  }

  tutHint(msg) {
    if (!this.tut) return;
    this.tut.msg = msg;
    this.tut.step = 2;
    this.tut.t = 0;
  }

  hudState() {
    const run = this.run;
    let progress = 0;
    if (run.kind === "bonus") progress = 1 - run.timeLeft / (run.data.time || 30);
    else if (run.phase === "waves") progress = Math.min(0.94, run.t / (run.lastT + 3));
    else progress = 1;
    return {
      score: this.score.score,
      hearts: this.hearts,
      maxHearts: MAX_HEARTS,
      progress,
      boss: this.boss ? this.boss.hp / this.boss.maxHp : null,
      bossPhase: this.boss ? this.boss.phase : 0,
      power: this.power ? { id: this.power.id, k: this.power.t / this.power.max } : null,
      timeLeft: run.kind === "bonus" ? Math.ceil(run.timeLeft) : null,
      bonus: run.kind === "bonus",
    };
  }

  /* ================================================================
   * 그리기
   * ============================================================== */
  draw() {
    const ctx = this.ctx;
    this.view.resetTransform();
    if (this.state === "menu" || !this.run) {
      if (this.menuScene) this.menuScene.draw(ctx, this.time);
      return;
    }
    const t = this.run.t;
    const fx = this.fx;
    ctx.save();
    ctx.translate(fx.shakeX, fx.shakeY);
    const sc = this.scene;
    sc.drawBack(ctx, t, this);
    sc.drawWater(ctx, t, this);

    // 깊이 순서대로 (먼 것부터)
    const list = [];
    if (sc.props) for (const p of sc.props) list.push({ z: p.z, p });
    for (const e of this.enemies) list.push({ z: e.z, e });
    if (this.boss) list.push({ z: this.boss.z - 0.01, b: this.boss });
    for (const s of this.shots) if (s.delay <= 0) list.push({ z: s.z, s });
    for (const it of this.items) list.push({ z: it.z, it });
    list.sort((a, b) => a.z - b.z);
    const art = this.content.art;
    for (const o of list) {
      if (o.p) sc.drawProp(ctx, o.p, t, this);
      else if (o.e) this.drawEnemy(ctx, o.e);
      else if (o.b) this.drawBoss(ctx, o.b);
      else if (o.s) this.drawShot(ctx, o.s);
      else if (o.it) art.item(ctx, o.it, this.time);
    }

    if (sc.drawMid) sc.drawMid(ctx, t, this);
    // 물줄기 → 물방울 → 보트
    const ps = this.playerState();
    this.water.draw(ctx, this.nozzle(), this.time, fx.quality);
    this.drawZaps(ctx);
    fx.draw(ctx);
    art.player(ctx, ps, this);
    if (sc.drawFront) sc.drawFront(ctx, t, this);
    if (this.power && this.power.id === "ice") this.drawFrost(ctx);
    ctx.restore();

    if (this.run.phase === "waves" || this.run.phase === "boss" || this.run.phase === "bossIntro") this.drawCrosshair(ctx);
    fx.drawTexts(ctx);
    this.drawCombo(ctx);
    if (this.tut) this.drawTutorial(ctx);
    fx.drawOverlay(ctx, this.time);
  }

  drawEnemy(ctx, e) {
    const art = this.content.art;
    const water = project(e.x, e.z, 0);
    const k = e.k;
    const pose = e.pose(this.time);
    // 맞았을 때 밀림 + 부르르
    const jit = e.shakeT > 0 ? Math.sin(this.time * 90) * 2.4 * (e.shakeT / 0.18) : 0;
    const ox = e.kbx + jit;
    const oy = e.kby;
    // 하늘을 나는 친구는 물 위에 그림자
    if (e.h > 24 && e.vis > 0.2) {
      ctx.globalAlpha = 0.2 * e.vis * Math.max(0, 1 - e.h / 400);
      ctx.fillStyle = "#06324f";
      ctx.beginPath();
      ctx.ellipse(water.sx + ox, water.sy, 34 * k, 9 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const inWater = e.h < 30 && !e.d.flying;
    const clipY = water.sy + (e.d.clipBelow == null ? 4 : e.d.clipBelow) * k;
    const body = (alphaMul) => {
      ctx.globalAlpha = clamp(e.vis, 0, 1) * alphaMul;
      ctx.translate(e.sx + ox, e.sy + oy + e.sub * 60 * k);
      ctx.rotate(e.rot);
      const sq = e.squash;
      ctx.scale(k * (1 + sq * 0.16), k * (1 - sq * 0.16));
      if (e.dir < 0 && !e.d.noFlip) ctx.scale(-1, 1);
      art.enemy(ctx, e, pose);
    };
    if (inWater && e.vis > 0.1) {
      // 물속 그림자 (몸 아래 어두운 물)
      ctx.fillStyle = "rgba(0,28,70,0.2)";
      ctx.beginPath();
      ctx.ellipse(water.sx + ox, water.sy + 10 * k, (e.d.ripple || 38) * k * 1.1, 14 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      // 물에 잠긴 부분이 희미하게 비쳐 보인다
      if (this.fx.quality >= 1 && e.sub < 0.95) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, clipY, W, 140 * k);
        ctx.clip();
        body(0.26);
        ctx.restore();
      }
    }
    ctx.save();
    if (inWater) {
      ctx.beginPath();
      ctx.rect(0, 0, W, clipY);
      ctx.clip();
    }
    if (e.hitT > 0) ctx.filter = "brightness(1.55)";
    body(1);
    ctx.filter = "none";
    ctx.restore();
    ctx.globalAlpha = 1;
    // 물결 고리 (안쪽 거품 + 바깥으로 퍼지는 고리)
    if (inWater && e.sub < 0.98 && e.vis > 0.2) {
      const rw = (e.d.ripple || 38) * k;
      const wv = Math.sin(this.time * 4 + e.uid) * 2.5 * k;
      ctx.globalAlpha = 0.7 * e.vis;
      ctx.strokeStyle = "#f2fdff";
      ctx.lineWidth = Math.max(1.5, 3.2 * e.s);
      ctx.beginPath();
      ctx.ellipse(water.sx + ox, water.sy + 2 * k, rw + wv, 7.5 * k, 0, 0, Math.PI * 2);
      ctx.stroke();
      const ph = (this.time * 0.8 + e.uid * 0.37) % 1;
      ctx.globalAlpha = (1 - ph) * 0.45 * e.vis;
      ctx.lineWidth = Math.max(1, 2.2 * e.s);
      ctx.beginPath();
      ctx.ellipse(water.sx + ox, water.sy + 3 * k, rw * (1 + ph * 0.9), 8 * k * (1 + ph * 0.9), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.state !== "live") return;
    // 젖은 친구는 물방울이 뚝뚝
    if (e.wet > 0 && Math.random() < 0.3 * this.fx.quality) {
      this.fx.spawn({ kind: "drop", x: e.hx + rand(-20, 20) * k, y: e.hy + 10 * k, vx: 0, vy: 40, g: 500, r: 2.5 * Math.max(0.6, e.s), life: 0.5, color: "#a8e4ff" });
    }
    // 약점 표시
    const w = e.weakPointScreen();
    if (w && e.targetable) this.drawWeakMark(ctx, w.x, w.y, w.r);
    // 체력 물방울 (두 번 이상 맞혀야 하는 친구)
    if (e.maxHp > 1 && e.hp < e.maxHp && e.targetable) {
      const n = e.maxHp;
      const y = e.hy - e.hr - 12;
      for (let i = 0; i < n; i++) {
        const x = e.hx + (i - (n - 1) / 2) * 14;
        const full = i < e.hp;
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.quadraticCurveTo(x + 5.5, y - 1, x + 5, y + 2);
        ctx.arc(x, y + 2, 5, 0, Math.PI);
        ctx.quadraticCurveTo(x - 5.5, y - 1, x, y - 7);
        ctx.fillStyle = full ? "#5fd0ff" : "rgba(255,255,255,0.35)";
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = "#0d4f7f";
        ctx.stroke();
        if (full) {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(x - 1.8, y + 0.5, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  drawWeakMark(ctx, x, y, r) {
    const p = 1 + Math.sin(this.time * 10) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(p, p);
    ctx.strokeStyle = "#ff4fa3";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -this.time * 30;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(10, r * 0.8), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawBoss(ctx, b) {
    const art = this.content.art;
    const water = project(b.x, b.z, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, water.sy + 6 * b.k);
    if (b.mode !== "defeat") ctx.clip();
    ctx.translate(b.sx, b.sy + b.sub * 70 * b.k);
    ctx.rotate(b.rot);
    const sq = b.squash;
    ctx.scale(b.k * (1 + sq * 0.08), b.k * (1 - sq * 0.08));
    if (b.dir < 0 && !b.d.noFlip) ctx.scale(-1, 1);
    if (b.hitT > 0) ctx.filter = "brightness(1.45)";
    art.boss(ctx, b, b.pose(this.time));
    ctx.filter = "none";
    ctx.restore();
    if (b.mode !== "defeat" && b.sub < 0.9) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = "#e9fbff";
      ctx.lineWidth = 4 * b.s;
      ctx.beginPath();
      ctx.ellipse(water.sx, water.sy + 4, (b.d.ripple || 60) * b.k + Math.sin(this.time * 3) * 6, 12 * b.k, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 예고 '!' 표시
    if (b.mode === "windup") {
      const y = b.sy - (b.d.height || 130) * b.k - 20;
      const s = 1 + Math.sin(this.time * 18) * 0.15;
      ctx.save();
      ctx.translate(b.sx, y);
      ctx.scale(s, s);
      ctx.font = '44px "Bagel Fat One", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 9;
      ctx.strokeStyle = "#a3122a";
      ctx.strokeText("!", 0, 0);
      ctx.fillStyle = "#ffe066";
      ctx.fillText("!", 0, 0);
      ctx.restore();
    }
    for (const c of b.hitCircles()) if (c.weak) this.drawWeakMark(ctx, c.x, c.y, c.r);
  }

  drawShot(ctx, s) {
    const art = this.content.art;
    const w = project(s.x, s.z, 0);
    // 떨어질 자리 그림자 (보트 줄이면 빨갛게)
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = s.danger ? "#ff3b3b" : "#06324f";
    ctx.beginPath();
    ctx.ellipse(w.sx, w.sy, 16 * s.s, 5 * s.s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(s.sx, s.sy);
    const sc = s.s * 1.15;
    ctx.scale(sc, sc);
    art.shot(ctx, s, this.time);
    ctx.restore();
    if (s.danger && s.t > 0.45) {
      // 위험! 링
      ctx.strokeStyle = `rgba(255,70,70,${0.5 + Math.sin(this.time * 16) * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, s.hr * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawZaps(ctx) {
    if (!this.zaps.length) return;
    ctx.strokeStyle = "#fff6a0";
    ctx.lineWidth = 3;
    for (const z of this.zaps) {
      ctx.globalAlpha = Math.min(1, z.t * 6);
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const k = i / 8;
        const j = i === 0 || i === 8 ? 0 : rand(-12, 12);
        const x = lerp(z.x0, z.x1, k) + j;
        const y = lerp(z.y0, z.y1, k) + j;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawFrost(ctx) {
    const k = Math.min(1, this.power.t);
    ctx.globalAlpha = 0.18 * k;
    ctx.fillStyle = "#bdf0ff";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.7 * k;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 14; i++) {
      const x = (i * 97) % W;
      const y = i % 2 ? 230 + (i * 53) % 90 : H - 60 - (i * 31) % 80;
      drawStar(ctx, x, y, 7 + (i % 3) * 3, this.time * 0.5 + i, "#ffffff");
    }
    ctx.globalAlpha = 1;
  }

  /** 조준점: 반투명 원 + 중심점 + 회전하는 바깥 링 · 대상 위에서는 락온 브래킷 */
  drawCrosshair(ctx) {
    const x = this.aim.x;
    const y = this.aim.y;
    const hov = this.hover;
    const on = Boolean(hov);
    const weak = on && hov.weak;
    const want = on ? clamp(hov.r * 0.95, 22, 70) : 24;
    this.crossR = lerp(this.crossR || 24, want, 0.25);
    this.crossLock = lerp(this.crossLock || 0, on ? 1 : 0, 0.22);
    const firing = this.aim.shooting;
    const R = this.crossR * (firing ? 0.92 + Math.sin(this.time * 40) * 0.03 : 1);
    const col = weak ? "255,95,176" : on ? "255,216,74" : "255,255,255";
    // 대상의 맞는 범위를 은은하게
    if (on && hov.kind !== "shot") {
      ctx.save();
      ctx.globalAlpha = 0.5 * this.crossLock;
      ctx.strokeStyle = `rgba(${col},0.9)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -this.time * 40;
      ctx.beginPath();
      ctx.arc(hov.x, hov.y, hov.r * 1.05, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y);
    // 반투명 렌즈
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 2, 0, 0, R);
    g.addColorStop(0, `rgba(${col},0.22)`);
    g.addColorStop(1, `rgba(${col},0.06)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    // 바깥 링 (4조각, 천천히 회전)
    const spin = this.time * (on ? 2.4 : 0.8);
    ctx.rotate(spin);
    ctx.lineCap = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? "rgba(6,40,80,0.45)" : `rgba(${col},0.95)`;
      ctx.lineWidth = pass === 0 ? 6.5 : 3.2;
      for (let i = 0; i < 4; i++) {
        const a0 = (i / 4) * Math.PI * 2 + 0.22;
        ctx.beginPath();
        ctx.arc(0, 0, R, a0, a0 + Math.PI / 2 - 0.44);
        ctx.stroke();
      }
    }
    ctx.rotate(-spin);
    // 안쪽 얇은 링
    ctx.strokeStyle = `rgba(${col},0.55)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.52, 0, Math.PI * 2);
    ctx.stroke();
    // 락온 브래킷
    if (this.crossLock > 0.05) {
      const b = R + 10 - this.crossLock * 4 + Math.sin(this.time * 9) * 2;
      const L = 9;
      ctx.globalAlpha = this.crossLock;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass === 0 ? "rgba(6,40,80,0.5)" : `rgba(${col},1)`;
          ctx.lineWidth = pass === 0 ? 6 : 3;
          ctx.beginPath();
          ctx.moveTo(b - L * 0.2, -L);
          ctx.lineTo(b, -L);
          ctx.lineTo(b, -L * 0.1);
          ctx.moveTo(b - L * 0.2, L);
          ctx.lineTo(b, L);
          ctx.lineTo(b, L * 0.1);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // 중심점
    ctx.fillStyle = `rgba(${col},1)`;
    ctx.strokeStyle = "rgba(6,40,80,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (weak) {
      ctx.font = '24px "Bagel Fat One", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#7a1450";
      ctx.lineWidth = 6;
      ctx.strokeText("!", R + 12, -R - 6);
      ctx.fillStyle = "#ffffff";
      ctx.fillText("!", R + 12, -R - 6);
    }
    ctx.restore();
  }

  drawCombo(ctx) {
    const c = this.score.combo;
    if (c.count < 2) return;
    const x = W - 64;
    const y = 262;
    const pulse = 1 + Math.max(0, c.timer - c.window + 0.25) * 1.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    // 타이머 고리
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,40,70,0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = c.mult >= 4 ? "#ff7ab8" : c.mult >= 2 ? "#ffd84a" : "#8fe3ff";
    ctx.beginPath();
    ctx.arc(0, 0, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c.ratio);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.font = '34px "Bagel Fat One", sans-serif';
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#0b3f66";
    ctx.strokeText(String(c.count), 0, -4);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(c.count), 0, -4);
    ctx.font = '13px "Bagel Fat One", sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeText("COMBO", 0, 22);
    ctx.fillText("COMBO", 0, 22);
    if (c.mult > 1) {
      ctx.translate(30, -34);
      ctx.rotate(0.2);
      ctx.fillStyle = "#ff4f8b";
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '17px "Bagel Fat One", sans-serif';
      ctx.fillStyle = "#fff";
      ctx.fillText(`x${c.mult}`, 0, 1);
    }
    ctx.restore();
  }

  drawTutorial(ctx) {
    const tut = this.tut;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    if (tut.step === 0 && tut.target && tut.target.targetable) {
      const e = tut.target;
      const bob = Math.sin(this.time * 7) * 10;
      const x = e.hx + 40;
      const y = e.hy + 70 + bob;
      ctx.font = "54px sans-serif";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.4);
      ctx.fillText("👆", 0, 0);
      ctx.restore();
      ctx.font = '30px "Bagel Fat One", "Jua", sans-serif';
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#0b4f7c";
      ctx.strokeText("여기!", e.hx, e.hy - e.hr - 30 + bob * 0.4);
      ctx.fillStyle = "#fff36b";
      ctx.fillText("여기!", e.hx, e.hy - e.hr - 30 + bob * 0.4);
    }
    if (tut.msg) {
      ctx.font = '24px "Jua", sans-serif';
      const w = ctx.measureText(tut.msg).width + 36;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      roundRect(ctx, W / 2 - w / 2, 236, w, 44, 22);
      ctx.fill();
      ctx.fillStyle = "#0b4f7c";
      ctx.fillText(tut.msg, W / 2, 259);
    }
  }
}

function hitZ(hit) {
  return hit.ref && hit.ref.z != null ? hit.ref.z : 0;
}

function weighted(list) {
  // [[id, weight], ...] 또는 [id, id, ...]
  if (!Array.isArray(list[0])) return pick(list);
  const sum = list.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * sum;
  for (const [id, w] of list) {
    r -= w;
    if (r <= 0) return id;
  }
  return list[0][0];
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export { ease };
