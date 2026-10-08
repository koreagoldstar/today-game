/*
 * 바다괴물 탐험대 · 게임 (흐름 · 카메라 · 조준 · 충돌 · 발견 연출 · 콤보 · PERFECT · 보상)
 *
 *  menu(바닷속 배경 데모) → intro(수면에서 풍덩) → play(탐색 · 발견 · 조준 · 공격 · 추적 · 포획)
 *  → clear(모두 잡음) | fail(산소 부족) → result(별 · 점수 · 카드 · 코인)
 */
import { W, H, setupCanvas, clamp, lerp, rand, pick, dist, ease, TAU, dayKey, hash2 } from "./view.js?v=1";
import { setPixel } from "../art/sprites.js?v=1";
import "../art/monsters1.js?v=1";
import "../art/monsters2.js?v=1";
import "../art/monsters3.js?v=1";
import "../art/monsters4.js?v=1";
import "../art/monsters5.js?v=1";
import "../art/monsters6.js?v=1";
import "../art/monsters7.js?v=1";
import "../art/monsters8.js?v=1";
import "../art/monsters9.js?v=1";
import "../art/monsters10.js?v=1";
import { World } from "./world.js?v=1";
import { STAGES } from "./stages.js?v=1";
import { MONSTERS, MONSTER_BY_ID, GRADES, EQUIP, SCORE } from "./data.js?v=1";
import { Player } from "./player.js?v=1";
import { Monster, Shot } from "./monster.js?v=1";
import { drawMonster } from "../art/registry.js?v=1";
import { drawChest } from "../art/monsters3.js?v=1";
import { drawAnchor } from "../art/ship.js?v=1";
import { WaterGun } from "./water.js?v=1";
import { Effects } from "./fx.js?v=1";
import { SeaAudio } from "./audio.js?v=1";
import { Input } from "./input.js?v=1";
import { Save } from "./save.js?v=1";
import { UI } from "./ui.js?v=1";
import { Boss, bossBeh } from "./boss.js?v=1";
import { BOSS_BY_ID } from "./data.js?v=1";
import { BOSS_ART } from "../art/bosses.js?v=1";
import "../art/bosses2.js?v=1";

const HIT_SOUND = { coralOcto: "hitSoft", puffer: "hitPuff", rockCrab: "hitShell", clam: "hitShell", reefEel: "hitEel", kelpShark: "hitEel", weedMonster: "hitSoft", urchin: "hitShell", seahorse: "hitPuff", chestMimic: "hitShell", porthole: "hitSoft", anchorCrab: "hitShell", caveFish: "hitEel", shadeRay: "hitSoft", stoneFace: "hitShell", jellyMonster: "hitSoft", zapEel: "hitEel", jellyTwins: "hitPuff", lavaCrab: "hitShell", ventWorm: "hitSoft", magmaTurtle: "hitShell", frostSquid: "hitSoft", glassCrab: "hitShell", snowSeal: "hitPuff", angler: "hitSoft", gulper: "hitEel", isopod: "hitShell", statueGuard: "hitShell", nautilus: "hitShell", mirrorFish: "hitPuff", eggling: "hitPuff", whirlFish: "hitEel", stormRay: "hitSoft", abyssLantern: "hitShell" };

/** 선분(x0,y0)-(x1,y1) 이 원(cx,cy,r)에 처음 닿는 비율 t (없으면 -1) */
function segCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a < 1e-6) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

export class Game {
  constructor({ canvas, host }) {
    this.canvas = canvas;
    this.host = host;
    this.view = setupCanvas(canvas, host, () => {
      setPixel(this.view ? this.view.pixel : 1);
      if (this.ui) this.ui.onResize();
    });
    setPixel(this.view.pixel);
    this.ctx = this.view.ctx;
    this.save = new Save();
    this.audio = new SeaAudio(this.save.data.settings);
    this.fx = new Effects();
    this.input = new Input(host, this.view);
    this.input.onFirst = () => this.audio.unlock();
    this.state = "menu";
    this.t = 0;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.run = null;
    this.focus = null;
    this.letterbox = 0;
    this.ui = new UI(this);
    this.startMenu();
    this.last = performance.now();
    this.loop = (now) => this.frame(now);
    requestAnimationFrame(this.loop);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "play") this.pause();
    });
  }

  /* ================================================================
   * 메뉴 배경: 1지역 바닷속을 천천히 둘러보는 데모
   * ============================================================== */
  startMenu() {
    this.state = "menu";
    this.world = new World(STAGES[0]);
    this.player = new Player(540, 330);
    this.player.control = false;
    this.monsters = [];
    this.shots = [];
    this.boss = null;
    this.minions = [];
    this.bossIntro = null;
    this.decoyFor = {};
    this.demoT = 0;
    this.cam.x = 270;
    this.cam.y = 120;
    this.cam.zoom = 1;
    this.fx.reset();
    this.input.enabled = false;
    this.audio.stopMusic();
    this.audio.streamOff();
    if (this.audio.ctx) this.audio.playMusic({ bpm: 84, root: 60, scale: "major", prog: "calm", lead: "bell", drums: "none", pad: true, seed: 5, density: 0.4 });
    this.ui.showMenu();
  }

  /* ================================================================
   * 스테이지 시작
   * ============================================================== */
  startStage(index) {
    const stage = STAGES[index];
    if (!stage || stage.soon) return;
    this.audio.unlock();
    this.stageIndex = index;
    this.world = new World(stage);
    this.world.g = this;
    const eq = this.save.data.equip;
    const o2 = stage.oxygen + EQUIP[3].levels[eq.tank];
    const pl = new Player(stage.start.x - 90, -58);
    pl.control = false;
    pl.pitch = -1.1;
    this.player = pl;
    this.gun = new WaterGun();
    this.gun.rate = EQUIP[0].levels[eq.gun];
    this.monsters = [];
    this.shots = [];
    this.boss = null;
    this.minions = [];
    this.bossIntro = null;
    this.boss_spawn = stage.bossSpawn || { x: stage.world.w / 2, y: stage.world.h * 0.45 };
    // 괴물 배치: 종류마다 숨을 수 있는 곳 중 무작위 (같은 곳 겹치지 않게)
    const pool = stage.hunt.fixed ? stage.hunt.pool.slice() : this.pickPool(stage);
    for (const id of pool) {
      const def = MONSTER_BY_ID[id];
      const spots = this.world.spots.filter((s) => def.spots.includes(s.kind) && !s.monster);
      if (!spots.length) continue;
      const sp = pick(spots);
      this.monsters.push(new Monster(def, sp, this));
    }
    // 빈 모래 · 바위 자리에 놓을 가짜 (이 바다의 위장 괴물 모양)
    this.decoyFor = {};
    for (const id of new Set(pool)) {
      const def = MONSTER_BY_ID[id];
      for (const k of ["sand", "rockbed", "chest", "anchor", "wallface", "lavarock", "boulder", "bones", "statue", "egg"]) if (def.spots.includes(k) && !this.decoyFor[k] && ["clam", "rockCrab", "urchin", "chestMimic", "anchorCrab", "stoneFace", "lavaCrab", "magmaTurtle", "isopod", "statueGuard", "eggling"].includes(id)) this.decoyFor[k] = id;
    }
    this.run = {
      stage,
      total: this.monsters.length,
      score: 0,
      combo: 0,
      comboT: 0,
      maxCombo: 0,
      fired: 0,
      hits: 0,
      hurtN: 0,
      perfects: 0,
      found: 0,
      captured: [],
      newCards: [],
      time: 0,
      o2,
      o2Max: o2,
      sonarCd: 0,
      sonarMax: 9,
      radarR: EQUIP[1].levels[eq.radar],
      suit: EQUIP[2].levels[eq.suit],
      radarLv: 0,
      beepT: 0,
      coins: 0,
      xp: 0,
      lowWarn: false,
      daily: { found: 0, hits: 0, perfect: 0 },
      introT: 0,
      endT: 0,
      clear: false,
    };
    this.fx.reset();
    this.cam.x = clamp(pl.x - W / 2, 0, this.world.w - W);
    this.cam.y = -H * 0.36;
    this.cam.zoom = 1;
    this.focus = null;
    this.state = "intro";
    this.input.enabled = true;
    this.input.release();
    this.ui.showHUD(stage, this.monsters.length);
    this.audio.stopMusic();
    this.audio.playMusic(stage.music);
    this.audio.ambienceOn();
    this.ui.hideScreens();
  }

  pickPool(stage) {
    const pool = stage.hunt.pool.slice();
    const out = [];
    // 꼭 나오는 괴물 먼저 (둥지의 알깍쟁이 등)
    for (const id of stage.hunt.must || []) {
      const i = pool.indexOf(id);
      if (i >= 0) pool.splice(i, 1);
      out.push(id);
    }
    while (out.length < stage.hunt.count && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }

  pause() {
    if (this.state !== "play" && this.state !== "intro") return;
    this.resumeState = this.state;
    this.state = "paused";
    this.input.release();
    this.audio.streamOff();
    this.ui.showPause(true);
  }
  resume() {
    if (this.state !== "paused") return;
    this.state = this.resumeState || "play";
    this.ui.showPause(false);
    this.last = performance.now();
  }
  quit() {
    this.audio.ambienceOff();
    this.audio.streamOff();
    this.ui.showPause(false);
    this.ui.hideHUD();
    this.startMenu();
  }
  retry() {
    this.audio.ambienceOff();
    this.ui.showPause(false);
    this.startStage(this.stageIndex);
  }

  /* ================================================================
   * 루프
   * ============================================================== */
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // 한 프레임에서 문제가 생겨도 게임이 멈추지 않게
    try {
      if (this.state !== "paused") {
        this.update(dt);
      } else if (this.input.takePause()) this.resume();
      this.render();
    } catch (e) {
      if (!this.errLogged) {
        this.errLogged = true;
        console.error(e);
      }
    }
    requestAnimationFrame(this.loop);
  }

  update(dtReal) {
    this.t += dtReal;
    this.fx.update(dtReal);
    const dt = dtReal * this.fx.timeScale;
    switch (this.state) {
      case "menu":
        this.updateMenu(dt);
        break;
      case "intro":
        this.updateIntro(dt);
        break;
      case "play":
        this.updatePlay(dt, dtReal);
        break;
      case "clear":
      case "fail":
        this.updateEnd(dt, dtReal);
        break;
      case "result":
        this.world.update(dt, null);
        break;
    }
  }

  updateMenu(dt) {
    this.demoT += dt;
    const pl = this.player;
    // 지혁이 화면 안에서 천천히 8자로 헤엄친다
    const tx = 540 + Math.sin(this.demoT * 0.35) * 220;
    const ty = 360 + Math.sin(this.demoT * 0.7) * 90;
    const mv = { x: clamp((tx - pl.x) / 120, -0.6, 0.6), y: clamp((ty - pl.y) / 120, -0.6, 0.6) };
    pl.control = true;
    pl.update(dt, mv, null, false, this.world, this.fx);
    this.world.update(dt, pl);
    this.cam.x = lerp(this.cam.x, clamp(pl.x - W / 2, 0, this.world.w - W), dt * 0.8);
    this.cam.y = lerp(this.cam.y, 80 + Math.sin(this.demoT * 0.12) * 60, dt * 0.8);
  }

  updateIntro(dt) {
    const r = this.run;
    const pl = this.player;
    r.introT += dt;
    const k = r.introT;
    // 보트에서 뛰어 → 수면을 뚫고 풍덩 → 쭉 내려간다
    if (k < 0.45) {
      pl.st.t += dt;
      return this.introCam(dt, true);
    }
    if (!r.jumped) {
      r.jumped = true;
      pl.vy = -160;
      pl.vx = 70;
    }
    if (pl.y < 0) {
      pl.vy += 900 * dt;
      pl.pitch = lerp(pl.pitch, 1.35, dt * 5);
    } else {
      if (!r.splashed) {
        r.splashed = true;
        this.fx.splash(pl.x, 0, -Math.PI / 2, 2.4);
        for (let i = 0; i < 18; i++) this.fx.spawn({ kind: "drop", x: pl.x + rand(-30, 30), y: -4, vx: rand(-160, 160), vy: rand(-420, -160), r: rand(2, 5), life: rand(0.5, 0.9), g: 900, drag: 0.6, c: "#e9fbff" });
        this.fx.bubbles(pl.x, 30, 34, 40, 1.5);
        this.fx.shake(7);
        this.audio.play("dive");
        this.fx.showBanner(`${String(r.stage.no).padStart(2, "0")} ${r.stage.name}`, { sub: r.stage.en, size: 52, life: 2.0 });
      }
      pl.vy = lerp(pl.vy, 230, dt * 2.5);
      pl.vx *= Math.exp(-2 * dt);
      pl.pitch = lerp(pl.pitch, 0.9, dt * 3);
      if (Math.random() < dt * 30) this.fx.bubbles(pl.x + rand(-20, 20), pl.y - 30, 1, 10);
    }
    pl.x += pl.vx * dt;
    pl.y += pl.vy * dt;
    pl.st.t += dt;
    pl.kick = pl.y > 0 ? 1 : 0.2;
    this.introCam(dt, false);
    if (pl.y >= r.stage.start.y) {
      pl.control = true;
      pl.vy *= 0.5;
      this.state = "play";
      this.ui.hint(r.stage.tip, 4);
      if (!this.save.data.tutorial) this.ui.tutorial();
    }
  }
  introCam(dt, hold) {
    const pl = this.player;
    this.world.update(dt, pl);
    // 처음엔 수면이 화면 위쪽 1/3 에 오게, 뛰어든 뒤로는 지혁을 따라 내려간다
    const ty = hold ? -H * 0.36 : Math.max(-H * 0.36, pl.y - H * 0.42);
    this.cam.y = lerp(this.cam.y, ty, Math.min(1, dt * 3));
    this.cam.x = lerp(this.cam.x, clamp(pl.x - W / 2, 0, this.world.w - W), dt * 3);
  }

  /* ---------------- 탐험 ---------------- */
  updatePlay(dt, dtReal) {
    const r = this.run;
    const pl = this.player;
    const inp = this.input;
    inp.update();
    if (inp.takePause()) {
      this.pause();
      return;
    }
    r.time += dt;
    // 조준
    const aimWorld = this.aimTarget();
    const firing = (inp.aim.firing || inp.keyFire) && pl.control;
    pl.update(dt, inp.move, aimWorld, firing, this.world, this.fx);
    // 물총
    const noz = pl.nozzle();
    const ang = pl.aim;
    const fired = this.gun.update(dt, firing, noz, ang, (q, x0, y0, x1, y1) => this.resolveShot(q, x0, y0, x1, y1), this.fx);
    if (fired) r.fired++;
    if (firing) this.audio.streamOn();
    else this.audio.streamOff();
    // 소나
    if (r.sonarCd > 0) r.sonarCd -= dt;
    if (inp.takeSonar()) this.sonar();
    // 괴물 · 쏘는 것
    for (const m of this.monsters) m.update(dt, this);
    this.monsters = this.monsters.filter((m) => !m.done);
    if (this.bossIntro) this.updateBossIntro(dt);
    if (this.boss) {
      const bo = this.boss;
      bo.update(dt, this);
      if (this.boss) this.ui.bossHP(bo.hp / bo.maxHp, bo.rage);
    }
    for (const mi of this.minions) mi.update(dt, this);
    this.minions = this.minions.filter((mi) => mi.on);
    for (const s of this.shots) s.update(dt, this);
    this.shots = this.shots.filter((s) => s.on);
    this.checkHurt();
    // 콤보
    if (r.comboT > 0) {
      r.comboT -= dt;
      if (r.comboT <= 0) r.combo = 0;
    }
    // 산소
    r.o2 -= dt;
    if (r.o2 < 15 && !r.lowWarn) {
      r.lowWarn = true;
      this.ui.hint("산소가 얼마 안 남았어요!", 2.5);
    }
    if (r.o2 < 15) {
      r.o2Beep = (r.o2Beep || 0) - dt;
      if (r.o2Beep <= 0) {
        r.o2Beep = r.o2 < 6 ? 0.6 : 1.2;
        this.audio.play("o2low");
      }
    }
    if (r.o2 <= 0) {
      r.o2 = 0;
      this.endRun(false);
    }
    this.updateRadar(dtReal);
    this.world.update(dt, pl);
    this.updateCamera(dtReal);
    this.audio.ambienceSet(clamp(pl.y / this.world.h, 0, 1), dt);
    this.ui.updateHUD(r, this.monsters);
  }

  /** 조준점 (세계 좌표) · 터치는 누르는 동안만, 마우스는 늘 */
  aimTarget() {
    const inp = this.input;
    const pl = this.player;
    const a = inp.aim;
    let target = null;
    const recent = performance.now() - a.last < 500;
    if (a.on && (a.mouse || a.firing || recent)) target = this.screenToWorld(a.x, a.y);
    if (inp.keyFire && !a.firing) {
      // 키보드 발사: 가장 가까운 괴물
      let best = null;
      let bd = this.gun.range * 1.2;
      for (const m of this.monsters) {
        if (!m.targetable) continue;
        const d = dist(m.hitX, m.hitY, pl.x, pl.y);
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
      target = best ? { x: best.hitX, y: best.hitY } : { x: pl.x + pl.face * 200, y: pl.y };
    }
    // 터치 조준 도우미: 괴물 근처를 누르면 살짝 끌어당긴다
    if (target && !a.mouse) {
      let best = null;
      let bd = 80;
      for (const m of this.monsters) {
        if (!m.targetable) continue;
        const d = dist(m.hitX, m.hitY, target.x, target.y);
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
      if (best) {
        target.x = lerp(target.x, best.hitX, 0.6);
        target.y = lerp(target.y, best.hitY, 0.6);
      }
    }
    this.aimW = target;
    return target;
  }

  /** 헤드램프 빛 안인가 (원뿔 + 몸 주변) */
  inLight(x, y) {
    const pl = this.player;
    if (!pl) return false;
    const d = dist(x, y, pl.x, pl.y);
    if (d < 150) return true;
    if (d > 420) return false;
    let a = Math.atan2(y - pl.y, x - pl.x) - pl.aim;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return Math.abs(a) < 0.45;
  }

  screenToWorld(sx, sy) {
    const z = this.cam.zoom;
    return { x: this.cam.x + (sx - W / 2) / z + W / 2, y: this.cam.y + (sy - H / 2) / z + H / 2 };
  }
  onScreen(x, y, pad = 0) {
    return x > this.cam.x - pad && x < this.cam.x + W + pad && y > this.cam.y - pad && y < this.cam.y + H + pad;
  }

  /* ---------------- 물줄기가 맞았는가 ---------------- */
  resolveShot(q, x0, y0, x1, y1) {
    let best = null;
    let bt = 2;
    for (const m of this.monsters) {
      if (m.state === "captured" || m.state === "flee") continue;
      if (!m.hidden && m.B.ghost && m.B.ghost(m)) continue;
      let cx;
      let cy;
      let rr;
      if (m.hidden) {
        if (m.B.layer === "behind" || m.B.layer === "hole") {
          cx = m.spot.hx;
          cy = m.spot.hy;
          rr = m.spot.r * 0.75;
        } else {
          cx = m.x;
          cy = m.y + m.offY;
          rr = m.r * 1.1;
        }
      } else {
        cx = m.hitX;
        cy = m.hitY;
        rr = m.r;
      }
      const t = segCircle(x0, y0, x1, y1, cx, cy, rr + 4 * (q.big || 1));
      if (t >= 0 && t < bt) {
        bt = t;
        best = m;
      }
    }
    let cloneHit = null;
    for (const m of this.monsters) {
      if (!m.clones.length || m.state !== "active") continue;
      for (const c of m.clones) {
        if (!c.on) continue;
        const t = segCircle(x0, y0, x1, y1, c.x, c.y, m.r + 4);
        if (t >= 0 && t < bt) {
          bt = t;
          cloneHit = [m, c];
          best = null;
        }
      }
    }
    // 보스가 만든 표적 (문어왕의 분신 산호 등)
    let extraHit = null;
    if (this.boss && this.boss.state === "fight" && this.boss.B.extraTargets) {
      for (const tg of this.boss.B.extraTargets(this.boss)) {
        const t = segCircle(x0, y0, x1, y1, tg.x, tg.y, tg.r);
        if (t >= 0 && t < bt) {
          bt = t;
          extraHit = tg;
          best = null;
          cloneHit = null;
        }
      }
    }
    let bossHit = null;
    if (this.boss && this.boss.state === "fight" && !this.boss.hidden) {
      const b = this.boss;
      const hb = b.hitBox();
      const t = segCircle(x0, y0, x1, y1, hb.x, hb.y, hb.r);
      if (t >= 0 && t < bt) {
        bt = t;
        bossHit = b;
        best = null;
        cloneHit = null;
        extraHit = null;
      }
    }
    let minHit = null;
    for (const mi of this.minions) {
      const t = segCircle(x0, y0, x1, y1, mi.x, mi.y, mi.r + 4);
      if (t >= 0 && t < bt) {
        bt = t;
        minHit = mi;
        best = null;
        bossHit = null;
        cloneHit = null;
        extraHit = null;
      }
    }
    if (best || bossHit || minHit || cloneHit || extraHit) {
      const x = x0 + (x1 - x0) * bt;
      const y = y0 + (y1 - y0) * bt;
      if (best) this.onShotHit(best, x, y, Math.atan2(y1 - y0, x1 - x0), q);
      else if (extraHit) {
        this.fx.splash(x, y, Math.atan2(y1 - y0, x1 - x0), 0.8);
        this.run.hits++;
        this.boss.B.hitExtra(this.boss, extraHit, this, x, y);
      } else if (cloneHit) {
        this.fx.splash(x, y, Math.atan2(y1 - y0, x1 - x0), 0.8);
        cloneHit[0].B.cloneHit(cloneHit[0], cloneHit[1], this);
      }
      else if (bossHit) this.onBossHit(bossHit, x, y, Math.atan2(y1 - y0, x1 - x0), q);
      else {
        minHit.hit(this);
        this.fx.splash(x, y, Math.atan2(y1 - y0, x1 - x0), 0.7);
        this.run.hits++;
        this.audio.play("hitEel");
      }
      return { x, y };
    }
    // 지형 (벽 · 바닥 · 바위)
    if (!this.world.open(x1, y1, 1)) {
      this.fx.splash(x1, y1, Math.atan2(y1 - y0, x1 - x0), 0.6);
      return { x: x1, y: y1 };
    }
    return null;
  }

  onShotHit(m, x, y, dir, q) {
    const r = this.run;
    const res = m.hit(this, q.big > 1 ? 2 : 1, dir, x, y);
    if (!res) return;
    if (res === "blocked") {
      this.fx.ting(x, y);
      this.audio.play("blocked");
      if (!m.tingTip) {
        m.tingTip = true;
        this.fx.text("팅!", x, y - 20, { size: 22, color: "#fff6c0", life: 0.6 });
        if (m.B.blockTip) this.ui.hint(m.B.blockTip, 2.6);
      }
      return;
    }
    r.hits++;
    if (this.daily && m.id === this.daily.monster) r.daily.hits++;
    this.fx.splash(x, y, dir, 1);
    this.fx.shake(1.6);
    this.audio.play(res === "cool" ? "steam" : HIT_SOUND[m.id] || "hit");
    // 콤보
    r.combo = r.comboT > 0 ? r.combo + 1 : 1;
    r.comboT = 1.15;
    r.maxCombo = Math.max(r.maxCombo, r.combo);
    const mult = 1 + Math.min(10, Math.floor(r.combo / 3)) * 0.5;
    const pts = Math.round(SCORE.hit * mult);
    r.score += pts;
    this.fx.text(`+${pts}`, x + rand(-10, 10), y - 16, { size: 18 + Math.min(10, r.combo), color: "#ffffff", stroke: "#0b4f7c", life: 0.55, rise: 36 });
    if (r.combo >= 2) {
      this.audio.play("combo", { n: r.combo });
      if (r.combo === 5) {
        this.fx.text("SUPER COMBO!", W / 2, 330, { screen: true, size: 34, color: "#ffe14a", stroke: "#6a2a00", punch: true, life: 1 });
        this.audio.play("superCombo");
      } else if (r.combo === 10) {
        this.fx.text("MEGA COMBO!", W / 2, 330, { screen: true, size: 40, color: "#ff8ad0", stroke: "#4a1060", punch: true, life: 1.2 });
        this.audio.play("superCombo");
        this.fx.flash(0.25, "#fff6c0");
      }
    }
    if (res === "perfect") {
      r.perfects++;
      if (this.daily && m.id === this.daily.monster) r.daily.perfect++;
      r.score += SCORE.perfect;
      this.fx.text("PERFECT!", m.x, m.y - m.r - 30, { size: 40, color: "#fff6a0", stroke: "#7a3a00", punch: true, life: 1, sub: `+${SCORE.perfect}` });
      this.fx.slow(0.35, 0.32);
      this.fx.flash(0.35, "#ffffff");
      this.fx.burst(x, y, 0.8);
      this.gun.powerT = 1.4;
      this.audio.play("perfect");
      this.haptic(30);
    }
    if (res === "reveal") {
      this.fx.bubbles(m.x, m.y, 10, 20);
    }
  }

  /* ---------------- 지혁이 다치는가 ---------------- */
  checkHurt() {
    const pl = this.player;
    if (pl.inv > 0) return;
    for (const m of this.monsters) {
      const h = m.harm();
      if (h && dist(h.x, h.y, pl.x, pl.y) < h.r + pl.r * 0.7) {
        this.hurt(m.def.atk ? m.def.atk.dmg : 4, h.x, h.y);
        return;
      }
    }
    if (this.boss) {
      for (const h of this.boss.harms()) {
        const d = h.rect ? 0 : dist(h.x, h.y, pl.x, pl.y);
        const inRing = h.rect ? pl.x > h.x0 - pl.r * 0.5 && pl.x < h.x1 + pl.r * 0.5 && pl.y > h.y0 && pl.y < h.y1 : h.ring ? Math.abs(d - h.r) < h.ring + pl.r * 0.6 : d < h.r + pl.r * 0.7;
        if (inRing) {
          this.hurt(h.dmg || 7, h.rect ? (h.x0 + h.x1) / 2 : this.boss.x, h.rect ? pl.y - 1 : this.boss.y);
          return;
        }
      }
    }
    for (const mi of this.minions) {
      if (dist(mi.x, mi.y, pl.x, pl.y) < mi.r + pl.r * 0.7) {
        this.hurt(mi.dmg, mi.x, mi.y);
        mi.vx *= -1;
        mi.vy *= -1;
        return;
      }
    }
    for (const hz of this.world.hazards) {
      const z = hz.harm();
      if (!z) continue;
      const inside = z.rect ? pl.x > z.x0 - pl.r * 0.6 && pl.x < z.x1 + pl.r * 0.6 && pl.y > z.y0 - pl.r * 0.5 && pl.y < z.y1 + pl.r * 0.3 : dist(z.x, z.y, pl.x, pl.y) < z.r + pl.r * 0.7;
      if (inside) {
        this.hurt(hz.dmg, z.x, z.rect ? pl.y + 40 : z.y);
        return;
      }
    }
    for (const s of this.shots) {
      if (dist(s.x, s.y, pl.x, pl.y) < s.r + pl.r * 0.8) {
        s.on = false;
        this.fx.splash(s.x, s.y, 0, 0.8);
        this.hurt(s.dmg, s.x, s.y);
        return;
      }
    }
  }
  hurt(dmg, fx, fy) {
    const r = this.run;
    const pl = this.player;
    const dx = pl.x - fx;
    const dy = pl.y - fy;
    const d = Math.hypot(dx, dy) + 1;
    if (!pl.hurt({ x: dx / d, y: dy / d }, this.fx)) return;
    const loss = dmg * r.suit;
    r.o2 -= loss;
    r.hurtN++;
    r.combo = 0;
    r.comboT = 0;
    this.fx.shake(8);
    this.fx.flash(0.25, "#ff6a6a");
    this.fx.text(`-${Math.round(loss)}초`, pl.x, pl.y - 50, { size: 24, color: "#ff8a8a", stroke: "#5a0a0a", life: 0.9 });
    this.audio.play("hurt");
    this.haptic(60);
    this.ui.o2Hit();
  }

  shoot(o) {
    this.shots.push(new Shot(o));
  }

  /* ---------------- 소나 (탐지기) ---------------- */
  sonar() {
    const r = this.run;
    if (r.sonarCd > 0 || this.state !== "play") return;
    r.sonarCd = r.sonarMax;
    const pl = this.player;
    const R = r.radarR * 0.62;
    this.fx.sonar(pl.x, pl.y, R);
    this.audio.play("sonar");
    let n = 0;
    for (const m of this.monsters) {
      if (m.hidden && dist(m.x, m.y, pl.x, pl.y) < R) {
        m.sonarT = 2.6;
        n++;
      }
    }
    this.ui.sonarUsed();
    if (n) this.fx.text(n > 1 ? `무언가 ${n}마리!` : "무언가 있다!", pl.x, pl.y - 60, { size: 22, color: "#8ff6ff", stroke: "#06345a", life: 1.1 });
  }

  /* ---------------- 레이더: 거리만 (방향은 안 알려 준다) ---------------- */
  updateRadar(dt) {
    const r = this.run;
    const pl = this.player;
    let d = Infinity;
    for (const m of this.monsters) {
      if (m.state === "captured") continue;
      d = Math.min(d, dist(m.x, m.y, pl.x, pl.y));
    }
    const R = r.radarR;
    const lv = d > R ? 0 : d > R * 0.75 ? 1 : d > R * 0.52 ? 2 : d > R * 0.34 ? 3 : d > R * 0.2 ? 4 : 5;
    r.radarLv = lv;
    r.beepT -= dt;
    if (lv > 0 && r.beepT <= 0) {
      r.beepT = [0, 1.5, 1.05, 0.72, 0.46, 0.26][lv];
      this.audio.play("radar", { lv });
      this.ui.radarPing(lv);
    }
  }

  /* ---------------- 카메라 (발견 순간에는 괴물 쪽으로 살짝 당겨진다) ---------------- */
  updateCamera(dt) {
    const pl = this.player;
    let tx = pl.x - W / 2 + pl.vx * 0.25;
    let ty = pl.y - H * 0.46 + pl.vy * 0.25;
    if (this.aimW && this.input.aim.firing) {
      tx += clamp((this.aimW.x - pl.x) * 0.2, -60, 60);
      ty += clamp((this.aimW.y - pl.y) * 0.2, -60, 60);
    }
    let zoom = 1;
    if (this.focus) {
      this.focus.t -= dt;
      const k = clamp(this.focus.t / this.focus.dur, 0, 1);
      const w = Math.sin(k * Math.PI);
      tx = lerp(tx, this.focus.x - W / 2, w * 0.55);
      ty = lerp(ty, this.focus.y - H / 2, w * 0.55);
      zoom = 1 + w * 0.1;
      this.letterbox = w;
      if (this.focus.t <= 0) {
        this.focus = null;
        this.letterbox = 0;
      }
    }
    tx = clamp(tx, 0, this.world.w - W);
    ty = clamp(ty, -60, this.world.h - H);
    this.cam.x = lerp(this.cam.x, tx, Math.min(1, dt * 5));
    this.cam.y = lerp(this.cam.y, ty, Math.min(1, dt * 5));
    this.cam.zoom = lerp(this.cam.zoom, zoom, Math.min(1, dt * 6));
  }

  /* ================================================================
   * 괴물 이벤트
   * ============================================================== */
  onReveal(m, why) {
    const r = this.run;
    if (!r || why === "silent") return;
    if (this.daily && m.id === this.daily.monster) r.daily.found++;
    if (!m.found) {
      m.found = true;
      r.found++;
      r.score += SCORE.find;
      const fresh = this.save.seen(m.id);
      // 짧은 시네마틱: 느리게 · 괴물 쪽으로 당김 · 위아래 검은 띠
      this.fx.slow(0.32, 0.55);
      this.focus = { x: m.x, y: m.y, t: 1.1, dur: 1.1 };
      this.fx.text("발견!", m.x, m.y - m.r - 40, { size: 38, color: "#ffffff", stroke: "#0b3a66", punch: true, life: 1.1, sub: m.def.name });
      this.fx.bubbles(m.x, m.y, 16, 30, 1.2);
      this.audio.play("discover");
      this.haptic(25);
      this.ui.discovered(m.def, fresh);
    } else {
      this.fx.text("찾았다!", m.x, m.y - m.r - 26, { size: 24, color: "#bff6ff", stroke: "#0b3a66", life: 0.8 });
      this.fx.bubbles(m.x, m.y, 8, 20);
      this.audio.play("tell");
    }
  }
  onFlee(m, quiet) {
    this.fx.text(quiet ? "앗, 도망간다!" : "도망!", m.x, m.y - m.r - 20, { size: 24, color: "#ffd0a0", stroke: "#5a2a00", life: 0.9 });
    this.audio.play("escape");
  }
  onRehide() {}
  onCapturing(m) {
    this.audio.play("capture");
    this.fx.bubbles(m.x, m.y, 12, 20, 1.2);
  }
  onCaptured(m) {
    const r = this.run;
    if (!r) return;
    const g = GRADES[m.def.grade];
    this.fx.burst(m.x, m.y - 20, 1);
    const sx = m.x - this.cam.x;
    const sy = m.y - this.cam.y;
    const coinsTarget = this.ui.coinTarget();
    this.fx.coins(m.x, m.y - 20, 6, coinsTarget.x, coinsTarget.y);
    setTimeout(() => this.audio.play("coin"), 500);
    setTimeout(() => this.audio.play("coin"), 650);
    this.audio.play("release");
    r.captured.push(m.id);
    r.score += SCORE.capture;
    r.coins += g.coins;
    r.xp += g.xp;
    const first = this.save.caught(m.id);
    this.save.save();
    if (first) r.newCards.push(m.id);
    this.fx.text("포획!", m.x, m.y - 50, { size: 30, color: "#fff6a0", stroke: "#6a3a00", punch: true, life: 0.9, sub: `+${g.coins} 코인` });
    this.ui.captured(m.def, first, sx, sy);
    this.player.setMood("happy", 1.2);
    if (r.captured.length >= r.total) {
      // 모두 잡았다 → 보스가 있는 바다면 보스 등장, 아니면 클리어
      if (r.stage.boss && !this.boss && !r.bossDone) setTimeout(() => this.startBossIntro(), 900);
      else if (!r.stage.boss) this.endRun(true);
    }
  }

  /* ================================================================
   * 보스: 어두워짐 → 거대한 그림자 → 눈 → 등장
   * ============================================================== */
  startBossIntro() {
    const r = this.run;
    if (!r || this.state !== "play" || this.boss) return;
    const def = BOSS_BY_ID[r.stage.boss];
    this.bossIntro = { t: 0, def };
    // 지혁에게서 먼 쪽에서 나타난다
    const base = r.stage.bossSpawn || { x: this.world.w / 2, y: this.world.h * 0.45 };
    const cands = [base, { x: this.world.w - base.x, y: base.y }, { x: base.x, y: base.y - 300 }, { x: this.world.w * 0.25, y: base.y - 150 }, { x: this.world.w * 0.75, y: base.y - 150 }].filter((c) => this.world.open(c.x, c.y, 100));
    cands.sort((a, b) => dist(b.x, b.y, this.player.x, this.player.y) - dist(a.x, a.y, this.player.x, this.player.y));
    this.boss_spawn = cands[0] || base;
    const BB = bossBeh(def.id);
    if (BB && BB.spawn) this.boss_spawn = BB.spawn(this);
    this.bossIntro.B = BB;
    this.audio.stopMusic();
    this.audio.play("bossAppear");
    this.player.control = false;
    this.input.release();
    this.audio.streamOff();
    this.ui.hint("무언가 거대한 것이 다가와요…", 2.4);
  }
  updateBossIntro(dt) {
    const bi = this.bossIntro;
    const was = bi.t;
    bi.t += dt;
    const IN = bi.B && bi.B.intro;
    if (IN && IN.cue) IN.cue(bi, this, was);
    const spawnAt = IN ? IN.spawnAt : 2.6;
    const endAt = IN ? IN.dur : 3.3;
    const sp = this.boss_spawn;
    // 카메라: 지혁과 등장 자리 사이
    this.focus = { x: (this.player.x + sp.x) / 2, y: (this.player.y + sp.y) / 2, t: 0.5, dur: 1 };
    if (!IN && bi.t > 1.0 && !bi.shook) {
      bi.shook = true;
      this.fx.shake(5);
    }
    if (bi.t > spawnAt && !this.boss) {
      this.boss = new Boss(bi.def, this);
      this.boss.state = "fight";
      this.boss.st = 0;
      this.boss.pat = this.boss.B.first || Object.keys(this.boss.B.pattern)[0];
      this.boss.T = 0;
      this.boss.p.roar = 1.2;
      this.fx.burst(sp.x, sp.y, 1.6);
      this.fx.bubbles(sp.x, sp.y, 40, 120, 1.6);
      this.fx.shake(14);
      this.fx.flash(0.4, "#ffffff");
      this.audio.play("bossAppear");
      if (bi.def.id === "abyssal") this.fx.showBanner("THE ABYSSAL", { sub: "깊은 바다의 고대 바다괴수", size: 58, life: 2.8, color2: "#9ff8ff", stroke: "#0a0a2a" });
      else this.fx.showBanner(bi.def.name, { sub: "BOSS", size: 56, life: 2.2, color2: "#ffb0a0", stroke: "#3a0a0a" });
      this.save.seen(bi.def.id);
      this.ui.showBoss(bi.def);
      this.haptic(80);
    }
    if (bi.t > endAt) {
      this.bossIntro = null;
      this.focus = null;
      this.player.control = true;
      this.audio.playMusic({ bpm: 132, root: 57, scale: "minor", prog: "boss", lead: "pluck", drums: "boss", pad: false, seed: 66, density: 0.6 });
    }
  }
  drawBossIntro(ctx) {
    const bi = this.bossIntro;
    const t = bi.t;
    if (bi.B && bi.B.intro && bi.B.intro.draw) {
      const sp = this.boss_spawn;
      const z = this.cam.zoom;
      bi.B.intro.draw(ctx, bi, this, (sp.x - this.cam.x - W / 2) * z + W / 2, (sp.y - this.cam.y - H / 2) * z + H / 2);
      return;
    }
    // 화면이 잠깐 어두워진다
    const dark = t < 0.5 ? t / 0.5 : t > 2.7 ? Math.max(0, 1 - (t - 2.7) / 0.6) : 1;
    ctx.fillStyle = `rgba(2,10,26,${0.55 * dark})`;
    ctx.fillRect(0, 0, W, H);
    // 거대한 그림자가 지나간다 (보스 모양 그대로)
    if (t > 0.3 && t < 2.0) {
      const k = (t - 0.3) / 1.7;
      const sh = this.bossShadow(bi.def.id);
      ctx.save();
      ctx.globalAlpha = 0.6 * Math.sin(k * Math.PI);
      ctx.translate(W + 360 - k * (W + 760), H * 0.42);
      ctx.scale(-1.25, 1.25);
      ctx.drawImage(sh, -sh.width / 2 / sh.k, -sh.height / 2 / sh.k + 40, sh.width / sh.k, sh.height / sh.k);
      ctx.restore();
    }
    // 어둠 속 빨간 눈
    if (t > 1.7 && t < 2.7) {
      const sp = this.boss_spawn;
      const z = this.cam.zoom;
      const sx = (sp.x - this.cam.x - W / 2) * z + W / 2;
      const sy = (sp.y - this.cam.y - H / 2) * z + H / 2;
      const blink = (t > 2.1 && t < 2.18) ? 0.1 : 1;
      for (const dx of [-26, 26]) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(sx + dx, sy, 1, sx + dx, sy, 30);
        g.addColorStop(0, "rgba(255,90,90,0.9)");
        g.addColorStop(1, "rgba(255,60,60,0)");
        ctx.fillStyle = g;
        ctx.fillRect(sx + dx - 30, sy - 30, 60, 60);
        ctx.restore();
        ctx.fillStyle = "#ffe0e0";
        ctx.beginPath();
        ctx.ellipse(sx + dx, sy, 9, 6 * blink, 0, 0, TAU);
        ctx.fill();
      }
    }
  }
  /** 보스 실루엣 (등장 연출용 · 한 번만 만든다) */
  bossShadow(id) {
    this.shadows = this.shadows || {};
    if (this.shadows[id]) return this.shadows[id];
    const k = 0.5;
    const c = document.createElement("canvas");
    c.width = 900 * k;
    c.height = 760 * k;
    c.k = k;
    const x = c.getContext("2d");
    x.scale(k, k);
    x.translate(450, 300);
    try {
      BOSS_ART[id](x, { t: 0.4, hit: 0, wind: 0, charge: 0, stun: 0, rage: 0, roar: 0, pulse: 0, look: { x: 0, y: 0 } });
    } catch (_) {}
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = "#020812";
    x.fillRect(0, 0, c.width, c.height);
    this.shadows[id] = c;
    return c;
  }
  addMinion(m) {
    this.minions.push(m);
  }
  onBossHit(b, x, y, dir, q) {
    const r = this.run;
    const res = b.hit(this, q.big > 1 ? 2 : 1);
    if (!res) return;
    if (res === "blocked") {
      this.fx.ting(x, y);
      this.audio.play("blocked");
      if (!b.tingTip && b.B.blockTip) {
        b.tingTip = true;
        this.ui.hint(b.B.blockTip, 2.4);
      }
      return;
    }
    r.hits++;
    this.fx.splash(x, y, dir, 1.1);
    this.fx.shake(2);
    this.audio.play("bossHit");
    r.combo = r.comboT > 0 ? r.combo + 1 : 1;
    r.comboT = 1.15;
    r.maxCombo = Math.max(r.maxCombo, r.combo);
    const pts = Math.round(SCORE.hit * (1 + Math.min(10, Math.floor(r.combo / 3)) * 0.5));
    r.score += pts;
    this.fx.text(`+${pts}`, x + rand(-14, 14), y - 20, { size: 18 + Math.min(10, r.combo), color: "#ffffff", stroke: "#0b4f7c", life: 0.55, rise: 36 });
    if (r.combo >= 2) this.audio.play("combo", { n: r.combo });
    if (res === "perfect") {
      r.perfects++;
      r.score += SCORE.perfect;
      this.fx.text("PERFECT!", b.x, b.y - 130, { size: 44, color: "#fff6a0", stroke: "#7a3a00", punch: true, life: 1, sub: `+${SCORE.perfect} · 기절!` });
      this.fx.slow(0.3, 0.4);
      this.fx.flash(0.4, "#ffffff");
      this.fx.burst(x, y, 1);
      this.gun.powerT = 1.4;
      this.audio.play("perfect");
      this.haptic(40);
    }
  }
  onBossRage(b) {
    this.fx.text("화났다!", b.x, b.y - 140, { size: 36, color: "#ff8a8a", stroke: "#4a0a0a", punch: true, life: 1.2 });
    this.fx.shake(10);
    this.fx.flash(0.3, "#ff6a6a");
    this.audio.play("bossAppear");
    b.p.roar = 1;
  }
  onBossCapturing(b) {
    this.audio.play("capture");
    this.fx.slow(0.4, 0.8);
    this.fx.bubbles(b.x, b.y, 30, 80, 1.6);
    for (const mi of this.minions) {
      mi.on = false;
      this.fx.burst(mi.x, mi.y, 0.5);
    }
    this.minions = [];
  }
  onBossCaptured(b) {
    const r = this.run;
    this.fx.burst(b.x, b.y, 2.2);
    this.fx.flash(0.5, "#ffffff");
    this.fx.shake(12);
    const tgt = this.ui.coinTarget();
    this.fx.coins(b.x, b.y, 14, tgt.x, tgt.y);
    for (let i = 0; i < 6; i++) setTimeout(() => this.audio.play("coin"), 400 + i * 90);
    this.audio.play("release");
    const g = GRADES.BOSS;
    r.score += 3000;
    r.coins += g.coins;
    r.xp += g.xp;
    r.bossDone = true;
    r.bossId = b.id;
    if (this.save.caught(b.id)) r.newCards.push(b.id);
    r.captured.push(b.id);
    this.save.save();
    this.boss = null;
    this.ui.hideBoss();
    this.fx.text("보스 포획!", b.x, b.y - 80, { size: 40, color: "#fff6a0", stroke: "#6a3a00", punch: true, life: 1.2, sub: `+${g.coins} 코인` });
    if (b.id === "abyssal") {
      // 마지막 바다괴수! 큰 보상 + 엔딩 배너
      r.final = true;
      r.coins += 500;
      r.xp += 300;
      r.score += 5000;
      this.world.extraDark = 0;
      setTimeout(() => this.fx.showBanner("바다의 영웅!", { sub: "THE ABYSSAL 포획 · 모든 바다 탐험 완료!", size: 60, life: 3, color2: "#ffe14a" }), 600);
      setTimeout(() => this.endRun(true), 2600);
      return;
    }
    setTimeout(() => this.endRun(true), 700);
  }

  /* ---------------- 끝 ---------------- */
  endRun(clear) {
    const r = this.run;
    if (this.state !== "play") return;
    r.clear = clear;
    r.endT = 0;
    this.state = clear ? "clear" : "fail";
    this.player.control = false;
    this.audio.streamOff();
    this.input.release();
    this.audio.stopMusic();
    if (clear) {
      this.fx.showBanner("STAGE CLEAR!", { sub: `바다괴물 ${r.captured.length}마리 포획!`, size: 64, life: 2.4, color2: "#ffe14a" });
      this.audio.play("clear");
      this.fx.bubbles(this.player.x, this.player.y, 30, 60, 1.4);
      this.player.setMood("happy", 3);
    } else {
      this.fx.showBanner("산소 부족!", { sub: "수면으로 올라가요", size: 60, life: 2.4, color2: "#ffb0a0" });
      this.audio.play("fail");
      this.player.setMood("sad", 3);
    }
  }
  updateEnd(dt, dtReal) {
    const r = this.run;
    r.endT += dtReal;
    const pl = this.player;
    if (r.clear) {
      // 신나서 빙글
      pl.vy = lerp(pl.vy, -30, dt * 2);
      pl.pitch = Math.sin(r.endT * 4) * 0.5 - 0.8;
      if (Math.random() < dt * 12) this.fx.bubbles(pl.x, pl.y - 20, 2, 20);
    } else {
      pl.vy = lerp(pl.vy, -120, dt * 1.5);
      pl.pitch = lerp(pl.pitch, -1.2, dt * 3);
    }
    pl.x += pl.vx * dt;
    pl.y += pl.vy * dt;
    pl.vx *= Math.exp(-2 * dt);
    pl.st.t += dt;
    for (const m of this.monsters) {
      if (m.state === "captured") m.update(dt, this);
    }
    this.world.update(dt, pl);
    this.updateCamera(dtReal);
    if (r.endT > 2.6) this.finish();
  }

  finish() {
    const r = this.run;
    const st = r.stage;
    this.state = "result";
    this.audio.ambienceOff();
    // 점수 · 별
    const acc = r.fired ? r.hits / r.fired : 0;
    if (r.clear) {
      r.score += Math.round(r.o2) * SCORE.timeBonus;
      if (r.hurtN === 0) r.score += SCORE.noHurt;
    }
    const stars = r.clear ? 1 + (r.time <= st.par ? 1 : 0) + (r.hurtN <= 1 ? 1 : 0) : 0;
    r.stars = stars;
    r.acc = acc;
    if (r.clear) {
      r.coins += 50 + stars * 20;
      r.xp += 60 + stars * 20;
    }
    // 오늘의 도전
    this.applyDaily(r);
    const rec = this.save.record(st, { score: r.score, stars, clear: r.clear, time: r.time, coins: r.coins, xp: r.xp, maxCombo: r.maxCombo }, STAGES.length);
    this.ui.hideHUD();
    this.ui.showResult(r, rec);
  }

  /* ---------------- 오늘의 바다괴물 ---------------- */
  get daily() {
    if (this._daily && this._daily.day === dayKey()) return this._daily;
    const day = dayKey();
    const pool = MONSTERS.filter((m) => {
      const s = STAGES[m.stage - 1];
      return s && !s.soon && m.stage <= this.save.data.unlocked;
    });
    if (!pool.length) return null;
    const n = parseInt(day.replace(/-/g, ""), 10);
    const mon = pool[Math.floor(hash2(n, 7) * pool.length)];
    let d = this.save.data.daily;
    if (!d || d.day !== day) {
      d = { day, monster: mon.id, found: 0, hits: 0, perfect: 0, done: false, claimed: false };
      this.save.data.daily = d;
      this.save.save();
    }
    this._daily = d;
    return d;
  }
  applyDaily(r) {
    const d = this.daily;
    if (!d) return;
    d.found += r.daily.found;
    d.hits += r.daily.hits;
    d.perfect += r.daily.perfect;
    if (!d.done && d.found >= 3 && d.hits >= 10 && d.perfect >= 1) {
      d.done = true;
      r.dailyDone = true;
    }
    this.save.save();
  }
  claimDaily() {
    const d = this.daily;
    if (!d || !d.done || d.claimed) return 0;
    d.claimed = true;
    this.save.data.coins += 150;
    this.save.data.xp += 100;
    this.save.save();
    return 150;
  }

  buyEquip(id) {
    const e = EQUIP.find((q) => q.id === id);
    const lv = this.save.data.equip[id];
    if (!e || lv >= e.levels.length - 1) return false;
    const cost = e.cost[lv + 1];
    if (this.save.data.coins < cost) return false;
    this.save.data.coins -= cost;
    this.save.data.equip[id] = lv + 1;
    this.save.save();
    this.audio.play("item");
    return true;
  }

  haptic(ms) {
    if (!this.save.data.settings.vibrate) return;
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (_) {}
  }

  /* ================================================================
   * 그리기
   * ============================================================== */
  render() {
    const ctx = this.ctx;
    this.view.resetTransform();
    const cam = this.cam;
    const z = cam.zoom;
    ctx.save();
    ctx.translate(this.fx.sx, this.fx.sy);
    if (z !== 1) {
      ctx.translate(W / 2, H / 2);
      ctx.scale(z, z);
      ctx.translate(-W / 2, -H / 2);
    }
    const w = this.world;
    w.drawBack(ctx, cam);
    w.drawTerrain(ctx, cam);
    for (const hz of w.hazards) hz.draw(ctx, cam, this.t);
    // 숨는 곳: 뒤판 → (숨은 괴물) → 가리개
    const behind = new Map();
    for (const m of this.monsters) {
      if ((m.B.layer === "behind" && m.hidden) || m.B.layer === "hole") behind.set(m.spot, m);
    }
    for (const sp of w.spots) {
      if (!this.onScreen(sp.x, sp.y, 160)) continue;
      w.drawSpotBack(ctx, sp, cam);
      const m = behind.get(sp);
      if (m && m.state !== "captured") m.draw(ctx, cam);
      else if (!sp.monster && this.decoyFor && this.decoyFor[sp.kind]) this.drawDecoy(ctx, sp, cam);
      w.drawSpotCover(ctx, sp, cam);
    }
    // 나머지 괴물 (앞쪽 · 활동 · 도망 · 잡힘)
    const rest = this.monsters.filter((m) => !(behind.get(m.spot) === m && m.state !== "captured"));
    rest.sort((a, b) => a.y - b.y);
    for (const m of rest) if (this.onScreen(m.x, m.y, 120)) m.draw(ctx, cam);
    for (const mi of this.minions) mi.draw(ctx, cam);
    if (this.boss) this.boss.draw(ctx, cam);
    for (const s of this.shots) s.draw(ctx, cam, this.t);
    // 소나에 걸린 숨은 괴물: 가리개 너머로 빛나는 윤곽
    for (const m of this.monsters) if (m.sonarT > 0 && m.hidden) m.drawXray(ctx, cam, this.t);
    // 지혁 + 물줄기
    if (this.player) {
      const pl = this.player;
      if (this.gun && (this.state === "play" || this.state === "clear")) this.gun.draw(ctx, cam, pl.nozzle(), this.input.aim.firing || this.input.keyFire, this.t);
      pl.draw(ctx, cam);
    }
    w.drawOccluders(ctx, cam);
    this.fx.drawWorld(ctx, cam);
    // 앞쪽 · 어둠 · 비네팅
    const lights = [];
    if (this.player) {
      const px = this.player.x - cam.x;
      const py = this.player.y - cam.y;
      lights.push({ x: px, y: py, r: 170, a: 0.9 });
      lights.push({ x: px, y: py - 10, r: 420, cone: 0.42, ang: this.player.aim, a: 0.95 });
    }
    for (const m of this.monsters) {
      if (m.glow && this.onScreen(m.x, m.y, 100)) lights.push({ x: m.x - cam.x, y: m.y + m.offY - cam.y, r: m.glow, a: 0.8 });
      if (m.B.lightAt && m.state !== "captured" && this.onScreen(m.x, m.y, 260)) {
        const L = m.B.lightAt(m);
        lights.push({ x: L.x - cam.x, y: L.y - cam.y, r: L.r, a: 0.85 });
      }
      for (const c of m.clones) if (c.on && this.onScreen(c.x, c.y, 100)) lights.push({ x: c.x - cam.x, y: c.y - cam.y, r: 80, a: 0.7 });
    }
    if (this.boss && this.boss.glow) lights.push({ x: this.boss.x - cam.x, y: this.boss.y - cam.y, r: this.boss.glow, a: 0.85 });
    w.drawFront(ctx, cam, lights);
    ctx.restore();
    // 화면 공간: 조준점 · 조이스틱 · 글자 · 배너
    if (this.state === "play") {
      this.drawAim(ctx);
      this.drawStick(ctx);
      this.drawDanger(ctx);
    }
    if (this.bossIntro) this.drawBossIntro(ctx);
    if (this.letterbox > 0.01) {
      const h = 46 * this.letterbox;
      ctx.fillStyle = "rgba(2,10,24,0.85)";
      ctx.fillRect(0, 0, W, h);
      ctx.fillRect(0, H - h, W, h);
    }
    this.fx.drawTexts(ctx, cam);
    this.fx.drawCoins(ctx, cam);
    this.fx.drawScreen(ctx);
  }

  /** 빈 모래 · 바위 자리에 놓는 가짜 (진짜 괴물은 몸짓으로 들킨다) */
  drawDecoy(ctx, sp, cam) {
    const id = this.decoyFor[sp.kind];
    if (!sp.decoyP) sp.decoyP = { t: Math.random() * 9, seed: Math.random() * 9, face: sp.x % 2 ? 1 : -1, s: 1, camo: 1, peek: 0, look: { x: 0, y: 0 }, hit: 0, wind: 0, open: 0, walk: 0, decoy: true };
    sp.decoyP.t += 1 / 60;
    ctx.save();
    ctx.translate(sp.hx - cam.x, sp.hy - cam.y);
    ctx.scale(sp.decoyP.face, 1);
    if (id === "chestMimic") drawChest(ctx, sp.decoyP, false);
    else if (id === "anchorCrab") drawAnchor(ctx);
    else drawMonster(ctx, id, sp.decoyP);
    ctx.restore();
  }

  /** 조준점: 기본 · 괴물 위(타깃) · 사거리 밖 · 위험(공격 준비 = PERFECT 찬스) */
  drawAim(ctx) {
    const a = this.aimW;
    if (!a) return;
    const z = this.cam.zoom;
    const sx = (a.x - this.cam.x - W / 2) * z + W / 2;
    const sy = (a.y - this.cam.y - H / 2) * z + H / 2;
    const pl = this.player;
    const inRange = dist(a.x, a.y, pl.x, pl.y) < this.gun.range + 30;
    let tgt = null;
    for (const m of this.monsters) {
      if (!m.targetable) continue;
      if (dist(m.hitX, m.hitY, a.x, a.y) < m.r + 16) tgt = m;
    }
    const danger = tgt && tgt.winding;
    const t = this.t;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.lineCap = "round";
    if (tgt) {
      const r = tgt.r * z + 8 + Math.sin(t * 10) * 2;
      const c = danger ? "#ff5a5a" : "#ffb03a";
      ctx.strokeStyle = "rgba(0,20,40,0.5)";
      ctx.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        const ang = i * (Math.PI / 2) + Math.PI / 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, ang - 0.32, ang + 0.32);
        ctx.stroke();
      }
      ctx.strokeStyle = c;
      ctx.lineWidth = 3.5;
      for (let i = 0; i < 4; i++) {
        const ang = i * (Math.PI / 2) + Math.PI / 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, ang - 0.32, ang + 0.32);
        ctx.stroke();
      }
      if (danger) {
        ctx.font = '20px "Bagel Fat One", sans-serif';
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#4a0a0a";
        ctx.strokeText("NOW!", 0, -r - 14);
        ctx.fillStyle = "#ffe14a";
        ctx.fillText("NOW!", 0, -r - 14);
      }
    } else {
      ctx.globalAlpha = inRange ? 0.95 : 0.5;
      ctx.strokeStyle = "rgba(0,20,40,0.45)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      if (!inRange) ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = danger ? "#ff5a5a" : "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawStick(ctx) {
    const s = this.input.stick;
    if (s.on) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "rgba(10,40,80,0.35)";
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.bx, s.by, this.input.stickR, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      const dx = s.kx - s.bx;
      const dy = s.ky - s.by;
      const d = Math.hypot(dx, dy);
      const k = d > this.input.stickR ? this.input.stickR / d : 1;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(s.bx + dx * k, s.by + dy * k, 26, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (this.input.touchMode) {
      // 처음 하는 사람을 위한 흐린 자리 표시
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(110, H - 170, this.input.stickR, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** 화면 밖에서 공격 준비 중인 괴물 → 가장자리에 작은 '!' */
  drawDanger(ctx) {
    for (const m of this.monsters) {
      if (!m.winding) continue;
      const sx = m.x - this.cam.x;
      const sy = m.y - this.cam.y;
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
      const x = clamp(sx, 24, W - 24);
      const y = clamp(sy, 90, H - 24);
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "#ff5a5a";
      ctx.beginPath();
      ctx.arc(0, 0, 14 + Math.sin(this.t * 14) * 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = '18px "Bagel Fat One", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", 0, 1);
      ctx.restore();
    }
  }
}
