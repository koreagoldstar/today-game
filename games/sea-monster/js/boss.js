/*
 * 바다괴물 탐험대 · 보스
 *  등장 연출(어두워짐 → 거대한 그림자 → 눈 → 등장) · 체력 바 · 패턴 · 2단계(분노) · PERFECT(돌진 준비 중) · 포획
 * 보스마다 행동은 BOSS_BEH 표.
 */
import { W, H, TAU, clamp, lerp, rand, pick, dist } from "./view.js?v=1";
import { bolt, zapRing } from "./hazard.js?v=1";
import { BOSS_ART } from "../art/bosses.js?v=1";
import { tentacle, serpentSeg, kingMound } from "../art/bosses2.js?v=1";
import { drawMonster } from "../art/registry.js?v=1";

/* ---------------- 부하 (보스가 부르는 작은 괴물) ---------------- */
export class Minion {
  constructor(o) {
    Object.assign(this, { hp: 3, r: 20, speed: 230, art: "kelpShark", s: 0.5, dmg: 3, on: true, t: 0 }, o);
    this.vx = 0;
    this.vy = 0;
    this.face = 1;
    this.p = { t: Math.random() * 5, s: this.s, face: 1, camo: 0, peek: 1, look: { x: 0, y: 0 }, hit: 0, fast: 1 };
  }
  update(dt, g) {
    this.t += dt;
    this.p.t += dt;
    this.p.hit = Math.max(0, this.p.hit - dt * 4);
    const pl = g.player;
    const dx = pl.x - this.x;
    const dy = pl.y - this.y + Math.sin(this.t * 3) * 30;
    const d = Math.hypot(dx, dy) + 1;
    this.vx += ((dx / d) * this.speed - this.vx) * Math.min(1, 2.2 * dt);
    this.vy += ((dy / d) * this.speed - this.vy) * Math.min(1, 2.2 * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    g.world.push(this, this.r);
    this.face = this.vx >= 0 ? 1 : -1;
  }
  hit(g) {
    this.hp--;
    this.p.hit = 1;
    if (this.hp <= 0) {
      this.on = false;
      g.fx.burst(this.x, this.y, 0.5);
      g.audio.play("pop");
    }
    return this.hp <= 0 ? "capture" : "hit";
  }
  draw(ctx, cam) {
    ctx.save();
    ctx.translate(this.x - cam.x, this.y - cam.y);
    ctx.scale(this.face, 1);
    drawMonster(ctx, this.art, this.p);
    ctx.restore();
  }
}

/* ================================================================
 * 보스별 행동
 * ============================================================== */
const BOSS_BEH = {
  /* ---------- 난파선 상어왕 ---------- */
  sharkKing: {
    hp: 220,
    r: 100,
    scale: 0.86,
    speed: 230,
    // 등장: 배 짐칸 쪽 어둠에서
    start(b, g) {
      b.x = g.boss_spawn.x;
      b.y = g.boss_spawn.y;
      b.face = -1;
    },
    pick(b, g) {
      const d = dist(b.x, b.y, g.player.x, g.player.y);
      const list = ["circle", "charge", "charge", "summon"];
      if (b.rage && d < 260) list.push("spin", "spin");
      if (b.rage) list.push("charge");
      let p = pick(list);
      if (p === b.lastP && p !== "charge") p = "charge";
      if (b.afterStun) {
        // 기절에서 깨면 일단 벽에서 떨어져 빙빙 돈다
        b.afterStun = false;
        p = "circle";
      }
      if (p === "summon" && g.minions.length > 2) p = "circle";
      return p;
    },
    pattern: {
      circle(b, dt, g, T) {
        if (T === 0) b.patT = rand(2.6, 3.6);
        const pl = g.player;
        b.orbit = (b.orbit || 0) + dt * (b.rage ? 1.0 : 0.75);
        let tx = pl.x + Math.cos(b.orbit) * 300;
        let ty = pl.y + Math.sin(b.orbit) * 180 - 40;
        const cx = g.world.w / 2;
        tx = tx + (cx - tx) * 0.25;
        b.steer(tx, ty, b.speed, dt, 1.8);
        b.face = b.vx >= 0 ? 1 : -1;
        return T > b.patT;
      },
      charge(b, dt, g, T) {
        const pl = g.player;
        const windT = b.rage ? 0.7 : 0.95;
        if (T === 0) {
          b.wind = 0;
          g.audio.play("windup");
          b.chargeN = (b.chargeN || 0) + 1;
        }
        if (T < windT) {
          // 준비: 멈춰서 꼬리를 흔들고 눈이 빨개진다 (이때 맞히면 PERFECT)
          b.p.wind = T / windT;
          b.winding = true;
          b.vx *= Math.exp(-5 * dt);
          b.vy *= Math.exp(-5 * dt);
          b.face = pl.x >= b.x ? 1 : -1;
          b.aimX = pl.x;
          b.aimY = pl.y;
          return false;
        }
        if (!b.charging) {
          b.winding = false;
          b.p.wind = 0;
          b.charging = true;
          const dx = b.aimX - b.x;
          const dy = b.aimY - b.y;
          const d = Math.hypot(dx, dy) + 1;
          b.vx = (dx / d) * (b.rage ? 1000 : 860);
          b.vy = (dy / d) * (b.rage ? 1000 : 860);
          b.face = b.vx >= 0 ? 1 : -1;
          g.audio.play("chomp");
          g.fx.shake(4);
        }
        b.p.charge = 1;
        b.harmR = 118;
        if (Math.random() < dt * 30) g.fx.bubbles(b.x - b.face * 120, b.y, 2, 20);
        // 벽에 쾅 → 어질어질 (큰 기회)
        if (b.wallHit) {
          b.wallHit = false;
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          b.stun(g, 1.6);
          b.afterStun = true;
          return true;
        }
        if (T > windT + 0.75) {
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          b.vx *= 0.3;
          b.vy *= 0.3;
          // 분노: 한 번 더
          if (b.rage && b.chargeN % 2 === 1) {
            b.patT = -1;
            return "again";
          }
          return true;
        }
        return false;
      },
      summon(b, dt, g, T) {
        if (T === 0) {
          b.p.roar = 1;
          g.audio.play("bossAppear");
          g.fx.bubbles(b.x, b.y, 20, 60, 1.4);
        }
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        if (T > 0.5 && !b.summoned) {
          b.summoned = true;
          const n = b.rage ? 4 : 3;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            g.addMinion(new Minion({ x: b.x + Math.cos(a) * 120, y: b.y + Math.sin(a) * 80, art: "kelpShark", s: 0.48, hp: 3, speed: 210 + i * 20 }));
          }
          g.fx.text("부하 상어들!", b.x, b.y - 120, { size: 24, color: "#ffd0a0", stroke: "#5a2a00", life: 1 });
        }
        if (T > 1.2) {
          b.summoned = false;
          b.p.roar = 0;
          return true;
        }
        return false;
      },
      spin(b, dt, g, T) {
        if (T === 0) {
          b.winding = true;
          g.audio.play("windup");
        }
        if (T < 0.6) {
          b.p.wind = T / 0.6;
          b.vx *= Math.exp(-6 * dt);
          b.vy *= Math.exp(-6 * dt);
          return false;
        }
        if (!b.spun) {
          b.spun = true;
          b.winding = false;
          b.p.wind = 0;
          g.fx.spawn({ kind: "ring", x: b.x, y: b.y, r: 60, grow: 4, life: 0.6, c: "rgba(200,240,255,0.95)" });
          g.fx.spawn({ kind: "ring", x: b.x, y: b.y, r: 40, grow: 6, life: 0.8, c: "rgba(140,220,255,0.7)" });
          g.fx.shake(8);
          g.audio.play("splash", { big: true });
          b.wave = { r: 60, t: 0 };
        }
        b.spinA = (b.spinA || 0) + dt * 18;
        if (T > 1.3) {
          b.spun = false;
          b.spinA = 0;
          return true;
        }
        return false;
      },
    },
  },

  /* ---------- 거대 해파리: 위에서 둥실 · 전기 고리 · 쏘기 돌진 · 아기 해파리 · (분노) 번개 기둥 ---------- */
  giantJelly: {
    hp: 260,
    r: 105,
    scale: 0.82,
    speed: 140,
    hitOff: [0, -30],
    harmOff: [0, 40],
    waveStyle: "zap",
    glow: 260,
    start(b, g) {
      b.x = g.boss_spawn.x;
      b.y = g.boss_spawn.y;
      b.face = 1;
    },
    pick(b, g) {
      const list = ["drift", "ring", "ring", "dive", "babies"];
      if (b.rage) list.push("storm", "storm", "ring");
      let p = pick(list);
      if (p === b.lastP) p = p === "ring" ? "dive" : "ring";
      if (b.afterStun) {
        b.afterStun = false;
        p = "drift";
      }
      if (p === "babies" && g.minions.length > 3) p = "drift";
      return p;
    },
    pattern: {
      drift(b, dt, g, T) {
        // 지혁 위쪽에서 '퐁 · 퐁' 하고 따라온다
        if (T === 0) b.patT = rand(2.0, 2.8);
        const pl = g.player;
        b.jet = (b.jet || 0) - dt;
        if (b.jet <= 0) {
          b.jet = b.rage ? 0.7 : 1.0;
          const tx = pl.x + rand(-120, 120);
          const ty = pl.y - 230;
          const dx = tx - b.x;
          const dy = ty - b.y;
          const d = Math.hypot(dx, dy) + 1;
          const sp = Math.min(b.speed * 2.2, d * 1.6);
          b.vx = (dx / d) * sp;
          b.vy = (dy / d) * sp;
          b.p.pulse = 1;
        }
        b.vx *= Math.exp(-1.6 * dt);
        b.vy *= Math.exp(-1.6 * dt);
        return T > b.patT;
      },
      ring(b, dt, g, T) {
        // 갓에 전기를 모았다가 (PERFECT 찬스) 번쩍! 퍼지는 전기 고리
        const windT = b.rage ? 0.8 : 1.05;
        if (T === 0) {
          b.winding = true;
          g.audio.play("charge");
          b.rings = b.rage ? 2 : 1;
        }
        b.vx *= Math.exp(-4 * dt);
        b.vy *= Math.exp(-4 * dt);
        if (T < windT) {
          b.p.wind = T / windT;
          return false;
        }
        if (b.winding) {
          b.winding = false;
          b.p.wind = 0;
          b.wave = { r: 60, t: 0, w: 30 };
          g.fx.shake(6);
          g.fx.flash(0.2, "#fff6c0");
          g.audio.play("zap");
          b.p.pulse = 1.4;
        }
        if (b.rings > 1 && T > windT + 0.55 && !b.wave2) {
          b.wave2 = true;
          b.wave = { r: 60, t: 0, w: 30 };
          g.audio.play("zap");
        }
        if (T > windT + (b.rings > 1 ? 1.3 : 0.8)) {
          b.wave2 = false;
          return true;
        }
        return false;
      },
      dive(b, dt, g, T) {
        // 촉수를 모으고 (PERFECT 찬스) 지혁에게 쏙 내려 꽂힌다 → 바닥 · 벽에 닿으면 어질
        const pl = g.player;
        const windT = b.rage ? 0.7 : 0.9;
        if (T === 0) {
          b.winding = true;
          g.audio.play("windup");
        }
        if (T < windT) {
          b.p.wind = T / windT;
          b.vx *= Math.exp(-5 * dt);
          b.vy = lerp(b.vy, -60, dt * 3);
          b.aimX = pl.x;
          b.aimY = pl.y;
          return false;
        }
        if (!b.charging) {
          b.winding = false;
          b.p.wind = 0;
          b.charging = true;
          const dx = b.aimX - b.x;
          const dy = b.aimY + 40 - b.y;
          const d = Math.hypot(dx, dy) + 1;
          b.vx = (dx / d) * (b.rage ? 820 : 700);
          b.vy = (dy / d) * (b.rage ? 820 : 700);
          g.audio.play("zap");
        }
        b.p.charge = 1;
        b.harmR = 100;
        if (Math.random() < dt * 30) g.fx.sparkle(b.x + rand(-60, 60), b.y + 60, 1, "#fff36a", 10);
        if (b.wallHit) {
          b.wallHit = false;
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          b.stun(g, 1.7);
          b.afterStun = true;
          return true;
        }
        if (T > windT + 0.7) {
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          b.vx *= 0.3;
          b.vy *= 0.3;
          return true;
        }
        return false;
      },
      babies(b, dt, g, T) {
        if (T === 0) {
          b.p.roar = 1;
          g.audio.play("bossAppear");
        }
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        if (T > 0.5 && !b.summoned) {
          b.summoned = true;
          const n = b.rage ? 4 : 3;
          for (let i = 0; i < n; i++) {
            const a = Math.PI * 0.2 + (i / (n - 1)) * Math.PI * 0.6;
            g.addMinion(new Minion({ x: b.x + Math.cos(a) * 110, y: b.y + 60 + Math.sin(a) * 60, art: "jellyMonster", s: 0.55, hp: 2, r: 22, speed: 130 + i * 15, dmg: 3, glow: true }));
          }
          g.fx.text("아기 해파리들!", b.x, b.y - 140, { size: 24, color: "#ffd0f2", stroke: "#4a1a5a", life: 1 });
        }
        if (T > 1.2) {
          b.summoned = false;
          b.p.roar = 0;
          return true;
        }
        return false;
      },
      storm(b, dt, g, T) {
        // 분노: 위에서 번개 기둥 (먼저 점선으로 자리 표시)
        const pl = g.player;
        if (T === 0) {
          b.p.roar = 1;
          b.bolts = [];
          const n = 3;
          for (let i = 0; i < n; i++) b.bolts.push({ x: pl.x + (i - 1) * 150 + rand(-30, 30), t: -i * 0.25, hit: false });
          g.audio.play("charge");
        }
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        for (const bo of b.bolts) {
          const was = bo.t;
          bo.t += dt;
          if (was < 0.9 && bo.t >= 0.9) {
            g.audio.play("zap");
            g.fx.shake(5);
            g.fx.sparkle(bo.x, pl.y, 8, "#fff36a", 40);
          }
        }
        if (T > 2.1) {
          b.bolts = null;
          b.p.roar = 0;
          return true;
        }
        return false;
      },
    },
    harms(b, g) {
      const out = [];
      if (b.bolts) for (const bo of b.bolts) if (bo.t > 0.9 && bo.t < 1.2) out.push({ rect: true, x0: bo.x - 34, x1: bo.x + 34, y0: g.cam.y - 100, y1: g.cam.y + H + 100 });
      return out;
    },
    drawFx(ctx, cam, b, g, t) {
      if (!b.bolts) return;
      for (const bo of b.bolts) {
        if (bo.t < 0) continue;
        const x = bo.x - cam.x;
        if (bo.t < 0.9) {
          ctx.save();
          ctx.setLineDash([12, 12]);
          ctx.lineDashOffset = -t * 80;
          ctx.strokeStyle = `rgba(255,243,106,${0.3 + bo.t * 0.6})`;
          ctx.lineWidth = 3;
          for (const dx of [-30, 30]) {
            ctx.beginPath();
            ctx.moveTo(x + dx, 0);
            ctx.lineTo(x + dx, H);
            ctx.stroke();
          }
          ctx.restore();
        } else if (bo.t < 1.25) {
          const a = 1 - (bo.t - 0.9) / 0.35;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = "rgba(255,240,150,0.35)";
          ctx.fillRect(x - 40, 0, 80, H);
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = a;
          ctx.lineJoin = "round";
          for (const [w, c] of [
            [14, "rgba(200,160,255,0.6)"],
            [6, "#fff36a"],
            [2.4, "#ffffff"],
          ]) {
            bolt(ctx, x, -20, x + rand(-10, 10), H + 20, 26, 12);
            ctx.strokeStyle = c;
            ctx.lineWidth = w;
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    },
  },

  /* ---------- 화산 심해괴수: 빙빙 · 돌진(벽 쾅 → 어질) · 용암 폭탄 · 새끼 용암게 · (분노) 마그마 기둥 ---------- */
  volcanoBeast: {
    hp: 300,
    r: 120,
    scale: 0.7,
    speed: 190,
    hitOff: [20, -10],
    harmOff: [110, 0],
    glow: 300,
    start(b, g) {
      b.x = g.boss_spawn.x;
      b.y = g.boss_spawn.y;
      b.face = -1;
    },
    pick(b, g) {
      const list = ["prowl", "charge", "charge", "spit", "spit", "crabs"];
      if (b.rage) list.push("erupt", "erupt", "charge");
      let p = pick(list);
      if (p === b.lastP && p !== "charge") p = "charge";
      if (b.afterStun) {
        b.afterStun = false;
        p = "prowl";
      }
      if (p === "crabs" && g.minions.length > 2) p = "spit";
      return p;
    },
    pattern: {
      prowl(b, dt, g, T) {
        if (T === 0) b.patT = rand(2.2, 3.0);
        const pl = g.player;
        b.orbit = (b.orbit || 0) + dt * (b.rage ? 0.9 : 0.65);
        let tx = pl.x + Math.cos(b.orbit) * 320;
        const ty = pl.y + Math.sin(b.orbit) * 170 - 30;
        tx += (g.world.w / 2 - tx) * 0.3;
        b.steer(tx, ty, b.speed, dt, 1.6);
        b.face = b.vx >= 0 ? 1 : -1;
        return T > b.patT;
      },
      charge(b, dt, g, T) {
        const pl = g.player;
        const windT = b.rage ? 0.75 : 0.95;
        if (T === 0) {
          b.winding = true;
          g.audio.play("windup");
          g.audio.play("rumble");
        }
        if (T < windT) {
          b.p.wind = T / windT;
          b.vx *= Math.exp(-5 * dt);
          b.vy *= Math.exp(-5 * dt);
          b.face = pl.x >= b.x ? 1 : -1;
          b.aimX = pl.x;
          b.aimY = pl.y;
          if (Math.random() < dt * 20) g.fx.spawn({ kind: "mist", x: b.x + rand(-80, 80), y: b.y - 70, vx: 0, vy: -60, r: 14, grow: 2, life: 0.8, a: 0.45 });
          return false;
        }
        if (!b.charging) {
          b.winding = false;
          b.p.wind = 0;
          b.charging = true;
          const dx = b.aimX - b.x;
          const dy = b.aimY - b.y;
          const d = Math.hypot(dx, dy) + 1;
          b.vx = (dx / d) * (b.rage ? 880 : 760);
          b.vy = (dy / d) * (b.rage ? 880 : 760);
          b.face = b.vx >= 0 ? 1 : -1;
          g.audio.play("chomp");
          g.fx.shake(5);
        }
        b.p.charge = 1;
        b.harmR = 110;
        if (Math.random() < dt * 30) g.fx.spawn({ kind: "mist", x: b.x - b.face * 120, y: b.y + rand(-40, 40), vx: -b.vx * 0.1, vy: -20, r: 14, grow: 1.6, life: 0.6, a: 0.4 });
        if (b.wallHit) {
          b.wallHit = false;
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          g.fx.dust(b.x + b.face * 120, b.y, 2);
          b.stun(g, 1.8);
          b.afterStun = true;
          return true;
        }
        if (T > windT + 0.8) {
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          b.vx *= 0.3;
          b.vy *= 0.3;
          return true;
        }
        return false;
      },
      spit(b, dt, g, T) {
        // 입에 용암을 모았다가 (PERFECT 찬스) 부채꼴 용암 폭탄
        const pl = g.player;
        const windT = b.rage ? 0.7 : 0.85;
        if (T === 0) {
          b.winding = true;
          g.audio.play("windup");
        }
        b.vx *= Math.exp(-4 * dt);
        b.vy *= Math.exp(-4 * dt);
        b.face = pl.x >= b.x ? 1 : -1;
        if (T < windT) {
          b.p.wind = T / windT;
          return false;
        }
        if (b.winding) {
          b.winding = false;
          b.p.wind = 0;
          b.p.spit = 1;
          const mx = b.x + b.face * 150 * b.B.scale;
          const my = b.y + 10;
          const ang = Math.atan2(pl.y - 80 - my, pl.x - mx);
          const n = b.rage ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const da = (i / (n - 1) - 0.5) * 1.0;
            const sp = rand(300, 360);
            g.shoot({ kind: "hot", x: mx, y: my, vx: Math.cos(ang + da) * sp, vy: Math.sin(ang + da) * sp, ay: 260, r: 14, dmg: 5, life: 2.4 });
          }
          g.audio.play("geyser");
          g.fx.shake(4);
        }
        b.p.spit = Math.max(0, (b.p.spit || 0) - dt * 2);
        return T > windT + 0.7;
      },
      crabs(b, dt, g, T) {
        if (T === 0) {
          b.p.roar = 1;
          g.audio.play("bossAppear");
          g.fx.dust(b.x, b.y + 60, 1.5);
        }
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        if (T > 0.5 && !b.summoned) {
          b.summoned = true;
          const n = b.rage ? 4 : 3;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            g.addMinion(new Minion({ x: b.x + Math.cos(a) * 130, y: b.y + Math.sin(a) * 80, art: "lavaCrab", s: 0.45, hp: 2, r: 22, speed: 170 + i * 15, dmg: 3 }));
          }
          g.fx.text("새끼 용암게들!", b.x, b.y - 130, { size: 24, color: "#ffc08a", stroke: "#4a1000", life: 1 });
        }
        if (T > 1.2) {
          b.summoned = false;
          b.p.roar = 0;
          return true;
        }
        return false;
      },
      erupt(b, dt, g, T) {
        // 분노: 땅에서 마그마 기둥 셋 (먼저 바닥이 빨갛게)
        const pl = g.player;
        if (T === 0) {
          b.p.roar = 1;
          b.cols = [];
          for (let i = 0; i < 3; i++) b.cols.push({ x: clamp(pl.x + (i - 1) * 170 + rand(-30, 30), 60, g.world.w - 60), t: -i * 0.3 });
          g.audio.play("rumble");
          g.fx.shake(4);
        }
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        for (const c of b.cols) {
          const was = c.t;
          c.t += dt;
          if (was < 0.9 && c.t >= 0.9) {
            g.audio.play("geyser");
            g.fx.shake(5);
          }
          if (c.t > 0.9 && c.t < 1.3 && Math.random() < dt * 40) g.fx.spawn({ kind: "bubble", x: c.x + rand(-26, 26), y: g.cam.y + H + 20, vx: 0, vy: rand(-900, -700), r: rand(3, 7), life: 1.4, drag: 0.2 });
        }
        if (T > 2.2) {
          b.cols = null;
          b.p.roar = 0;
          return true;
        }
        return false;
      },
    },
    harms(b, g) {
      const out = [];
      if (b.cols) for (const c of b.cols) if (c.t > 0.9 && c.t < 1.3) out.push({ rect: true, x0: c.x - 36, x1: c.x + 36, y0: g.cam.y - 100, y1: g.cam.y + H + 100, dmg: 6 });
      return out;
    },
    drawFx(ctx, cam, b, g, t) {
      if (!b.cols) return;
      for (const c of b.cols) {
        if (c.t < 0) continue;
        const x = c.x - cam.x;
        if (c.t < 0.9) {
          // 예고: 바닥에서 올라오는 빨간 빛 · 점선
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const gr = ctx.createLinearGradient(0, H, 0, H - 400);
          gr.addColorStop(0, `rgba(255,90,30,${0.2 + c.t * 0.4})`);
          gr.addColorStop(1, "rgba(255,90,30,0)");
          ctx.fillStyle = gr;
          ctx.fillRect(x - 40, H - 400, 80, 400);
          ctx.restore();
          ctx.save();
          ctx.setLineDash([12, 12]);
          ctx.lineDashOffset = t * 80;
          ctx.strokeStyle = `rgba(255,150,60,${0.3 + c.t * 0.6})`;
          ctx.lineWidth = 3;
          for (const dx of [-32, 32]) {
            ctx.beginPath();
            ctx.moveTo(x + dx, 0);
            ctx.lineTo(x + dx, H);
            ctx.stroke();
          }
          ctx.restore();
        } else if (c.t < 1.35) {
          const a = 1 - (c.t - 0.9) / 0.45;
          ctx.save();
          ctx.globalAlpha = a;
          const gr = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
          gr.addColorStop(0, "rgba(255,80,20,0)");
          gr.addColorStop(0.3, "rgba(255,140,50,0.9)");
          gr.addColorStop(0.5, "rgba(255,240,170,1)");
          gr.addColorStop(0.7, "rgba(255,140,50,0.9)");
          gr.addColorStop(1, "rgba(255,80,20,0)");
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.moveTo(x - 36, H);
          for (let i = 0; i <= 12; i++) ctx.lineTo(x - 30 + Math.sin(t * 18 + i) * 6, H - (i / 12) * (H + 20));
          for (let i = 12; i >= 0; i--) ctx.lineTo(x + 30 + Math.sin(t * 20 + i * 2) * 6, H - (i / 12) * (H + 20));
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    },
  },

  /* ---------- 심해의 크라켄: 빙빙 · 밑에서 촉수 쾅 · 촉수 둘 뻗기(눈이 빨개지면 PERFECT) · 먹물 · 돌진 ---------- */
  kraken: {
    hp: 340,
    r: 112,
    scale: 0.68,
    speed: 170,
    hitOff: [0, -50],
    harmOff: [0, 0],
    glow: 260,
    start(b, g) {
      b.x = g.boss_spawn.x;
      b.y = g.boss_spawn.y;
      b.face = 1;
    },
    pick(b, g) {
      const list = ["lurk", "slam", "slam", "grab", "grab", "ink", "charge"];
      if (b.rage) list.push("slam", "grab", "charge");
      let p = pick(list);
      if (p === b.lastP && p !== "grab") p = "grab";
      if (b.afterStun) {
        b.afterStun = false;
        p = "lurk";
      }
      return p;
    },
    pattern: {
      lurk(b, dt, g, T) {
        if (T === 0) b.patT = rand(1.8, 2.6);
        const pl = g.player;
        b.orbit = (b.orbit || 0) + dt * (b.rage ? 0.8 : 0.55);
        const tx = pl.x + Math.cos(b.orbit) * 300;
        const ty = pl.y - 120 + Math.sin(b.orbit) * 120;
        b.steer(tx, ty, b.speed, dt, 1.4);
        b.face = pl.x >= b.x ? 1 : -1;
        return T > b.patT;
      },
      slam(b, dt, g, T) {
        // 아래에서 거대한 촉수가 솟는다 (먼저 기포 · 그림자 · 점선)
        const pl = g.player;
        if (T === 0) {
          b.p.roar = 0.8;
          b.slams = [];
          const n = b.rage ? 2 : 1;
          for (let i = 0; i < n; i++) b.slams.push({ x: clamp(pl.x + (n > 1 ? (i - 0.5) * 220 : 0) + rand(-20, 20), 70, g.world.w - 70), t: -i * 0.35, ph: rand(0, 9) });
          g.audio.play("rumble");
        }
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        for (const s of b.slams) {
          const was = s.t;
          s.t += dt;
          if (s.t > 0 && s.t < 1 && Math.random() < dt * 30) g.fx.spawn({ kind: "bubble", x: s.x + rand(-40, 40), y: g.cam.y + H + 10, vx: 0, vy: rand(-420, -260), r: rand(2, 5), life: 1.4, drag: 0.3 });
          if (was < 1 && s.t >= 1) {
            g.audio.play("splash", { big: true });
            g.fx.shake(9);
          }
        }
        if (T > (b.rage ? 2.6 : 2.2)) {
          b.slams = null;
          b.p.roar = 0;
          return true;
        }
        return false;
      },
      grab(b, dt, g, T) {
        // 눈이 빨개지며 (PERFECT 찬스) → 촉수 둘을 쭉 뻗는다
        const pl = g.player;
        const windT = b.rage ? 0.7 : 0.9;
        if (T === 0) {
          b.winding = true;
          g.audio.play("windup");
        }
        if (T < windT) {
          b.p.wind = T / windT;
          b.vx *= Math.exp(-5 * dt);
          b.vy *= Math.exp(-5 * dt);
          b.face = pl.x >= b.x ? 1 : -1;
          b.grabAng = Math.atan2(pl.y - (b.y + 40), pl.x - b.x);
          return false;
        }
        if (b.winding) {
          b.winding = false;
          b.p.wind = 0;
          b.grab = { t: 0, ang: b.grabAng };
          g.audio.play("snap");
          g.fx.shake(4);
        }
        b.grab.t += dt;
        if (b.grab.t > 1.0) {
          b.grab = null;
          return true;
        }
        return false;
      },
      ink(b, dt, g, T) {
        const pl = g.player;
        if (T === 0) {
          b.p.inkP = 1;
          g.fx.ink(b.x, b.y + 30, 3.2);
          g.audio.play("ink");
          const ang = Math.atan2(pl.y - b.y, pl.x - b.x);
          const n = b.rage ? 8 : 6;
          for (let i = 0; i < n; i++) {
            const a = ang + (i / (n - 1) - 0.5) * 1.3;
            g.shoot({ kind: "ink", x: b.x + Math.cos(a) * 60, y: b.y + 40 + Math.sin(a) * 60, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, r: 14, dmg: 4, life: 2.2 });
          }
          // 먹물 뒤로 휙 물러난다
          b.vx = -Math.cos(ang) * 520;
          b.vy = -Math.sin(ang) * 360;
        }
        b.vx *= Math.exp(-2.2 * dt);
        b.vy *= Math.exp(-2.2 * dt);
        b.p.inkP = Math.max(0, b.p.inkP - dt * 1.5);
        return T > 1.1;
      },
      charge(b, dt, g, T) {
        const pl = g.player;
        const windT = b.rage ? 0.75 : 0.95;
        if (T === 0) {
          b.winding = true;
          g.audio.play("windup");
        }
        if (T < windT) {
          b.p.wind = T / windT;
          b.vx *= Math.exp(-5 * dt);
          b.vy *= Math.exp(-5 * dt);
          b.aimX = pl.x;
          b.aimY = pl.y;
          b.face = pl.x >= b.x ? 1 : -1;
          return false;
        }
        if (!b.charging) {
          b.winding = false;
          b.p.wind = 0;
          b.charging = true;
          const dx = b.aimX - b.x;
          const dy = b.aimY - b.y;
          const d = Math.hypot(dx, dy) + 1;
          b.vx = (dx / d) * (b.rage ? 820 : 700);
          b.vy = (dy / d) * (b.rage ? 820 : 700);
          g.audio.play("chomp");
        }
        b.p.charge = 1;
        b.harmR = 100;
        if (b.wallHit) {
          b.wallHit = false;
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          b.stun(g, 1.8);
          b.afterStun = true;
          return true;
        }
        if (T > windT + 0.8) {
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          b.vx *= 0.3;
          b.vy *= 0.3;
          return true;
        }
        return false;
      },
    },
    /** 뻗는 촉수의 길이 (0~1) */
    grabLen(b) {
      const t = b.grab.t;
      return t < 0.22 ? t / 0.22 : t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45);
    },
    harms(b, g) {
      const out = [];
      if (b.slams) for (const s of b.slams) if (s.t > 1 && s.t < 1.6) out.push({ rect: true, x0: s.x - 44, x1: s.x + 44, y0: g.cam.y + H - (H * 0.78) * Math.min(1, (s.t - 1) / 0.2), y1: g.cam.y + H + 100, dmg: 6 });
      if (b.grab) {
        const L = 520 * BOSS_BEH.kraken.grabLen(b);
        if (L > 80) {
          for (const da of [-0.16, 0.16]) {
            const a = b.grab.ang + da;
            for (let d = 80; d <= L; d += 50) out.push({ x: b.x + Math.cos(a) * d, y: b.y + 40 + Math.sin(a) * d, r: 26, dmg: 5 });
          }
        }
      }
      return out;
    },
    drawFx(ctx, cam, b, g, t) {
      if (b.grab) {
        const L = 520 * BOSS_BEH.kraken.grabLen(b);
        if (L > 10) {
          for (const [da, ph] of [
            [-0.16, 0],
            [0.16, 2],
          ]) {
            tentacle(ctx, b.x - cam.x, b.y + 40 - cam.y, b.grab.ang + da, L, 52, t, ph, { wave: 0.03, curl: 0.4, color: b.rage ? "#c02a40" : "#b03a52" });
          }
        }
      }
      if (!b.slams) return;
      for (const s of b.slams) {
        if (s.t < 0) continue;
        const x = s.x - cam.x;
        if (s.t < 1) {
          // 예고: 바닥에 커다란 그림자 · 점선
          ctx.save();
          ctx.globalAlpha = 0.25 + s.t * 0.5;
          ctx.fillStyle = "#14060c";
          ctx.beginPath();
          ctx.ellipse(x, H - 10, 70 + s.t * 20, 30, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.setLineDash([14, 12]);
          ctx.lineDashOffset = t * 90;
          ctx.strokeStyle = `rgba(255,120,140,${0.3 + s.t * 0.6})`;
          ctx.lineWidth = 3;
          for (const dx of [-42, 42]) {
            ctx.beginPath();
            ctx.moveTo(x + dx, H * 0.2);
            ctx.lineTo(x + dx, H);
            ctx.stroke();
          }
          ctx.restore();
        } else if (s.t < 1.75) {
          const k = s.t < 1.2 ? (s.t - 1) / 0.2 : s.t < 1.45 ? 1 : 1 - (s.t - 1.45) / 0.3;
          tentacle(ctx, x - 30, H + 60, -Math.PI / 2 + 0.06, H * 0.82 * Math.max(0.05, k), 110, t * 0.6, s.ph, { wave: 0.05, curl: 1.4, color: b.rage ? "#c02a40" : "#b03a52", lw: 5 });
        }
      }
    },
  },

  /* ---------- 고대 바다뱀: 물결치듯 헤엄 · 돌진 · 물줄기 숨(휩쓸기) · 몸으로 칭칭 (몸통 마디가 머리를 따라온다) ---------- */
  seaSerpent: {
    hp: 320,
    r: 72,
    scale: 0.78,
    speed: 230,
    hitOff: [36, -10],
    harmOff: [70, 0],
    glow: 220,
    tilt: true,
    N: 16,
    gap: 30,
    start(b, g) {
      b.x = g.boss_spawn.x;
      b.y = g.boss_spawn.y;
      b.face = -1;
      b.trail = [];
      for (let i = 0; i < 60; i++) b.trail.push([b.x + i * 10, b.y + Math.sin(i * 0.3) * 20]);
      b.segs = [];
    },
    tick(b, dt, g) {
      const B = b.B;
      const last = b.trail[0];
      if (!last || dist(last[0], last[1], b.x, b.y) > 4) b.trail.unshift([b.x, b.y]);
      // 마디: 자취를 따라 일정 간격
      const sc = B.scale;
      const need = (B.N + 1) * B.gap * sc;
      let acc = 0;
      const segs = [];
      let want = B.gap * sc * 1.6;
      for (let i = 1; i < b.trail.length && segs.length < B.N; i++) {
        const [x0, y0] = b.trail[i - 1];
        const [x1, y1] = b.trail[i];
        const d = Math.hypot(x1 - x0, y1 - y0);
        while (acc + d >= want && segs.length < B.N) {
          const k = (want - acc) / (d || 1);
          segs.push({ x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, ang: Math.atan2(y0 - y1, x0 - x1) });
          want += B.gap * sc;
        }
        acc += d;
        if (acc > need + 200) {
          b.trail.length = i + 1;
          break;
        }
      }
      b.segs = segs;
      if (b.trail.length > 400) b.trail.length = 400;
    },
    pick(b, g) {
      const list = ["swim", "dive", "dive", "beam", "beam", "coil"];
      if (b.rage) list.push("coil", "beam", "dive");
      let p = pick(list);
      if (p === b.lastP && p !== "dive") p = "dive";
      if (b.afterStun) {
        b.afterStun = false;
        p = "swim";
      }
      return p;
    },
    pattern: {
      swim(b, dt, g, T) {
        if (T === 0) b.patT = rand(2.0, 2.8);
        const pl = g.player;
        b.orbit = (b.orbit || 0) + dt * (b.rage ? 1.0 : 0.75);
        const tx = pl.x + Math.cos(b.orbit) * 330 + Math.sin(T * 4) * 60;
        const ty = pl.y + Math.sin(b.orbit) * 200 - 40;
        b.steer(tx, ty, b.speed, dt, 1.8);
        b.face = b.vx >= 0 ? 1 : -1;
        return T > b.patT;
      },
      dive(b, dt, g, T) {
        const pl = g.player;
        const windT = b.rage ? 0.7 : 0.9;
        if (T === 0) {
          b.winding = true;
          g.audio.play("windup");
        }
        if (T < windT) {
          b.p.wind = T / windT;
          b.vx *= Math.exp(-5 * dt);
          b.vy *= Math.exp(-5 * dt);
          b.face = pl.x >= b.x ? 1 : -1;
          b.aimX = pl.x;
          b.aimY = pl.y;
          return false;
        }
        if (!b.charging) {
          b.winding = false;
          b.p.wind = 0;
          b.charging = true;
          const dx = b.aimX - b.x;
          const dy = b.aimY - b.y;
          const d = Math.hypot(dx, dy) + 1;
          b.vx = (dx / d) * (b.rage ? 900 : 780);
          b.vy = (dy / d) * (b.rage ? 900 : 780);
          b.face = b.vx >= 0 ? 1 : -1;
          g.audio.play("chomp");
        }
        b.p.charge = 1;
        b.harmR = 80;
        if (b.wallHit) {
          b.wallHit = false;
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          b.stun(g, 1.7);
          b.afterStun = true;
          return true;
        }
        if (T > windT + 0.8) {
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          b.vx *= 0.3;
          b.vy *= 0.3;
          return true;
        }
        return false;
      },
      beam(b, dt, g, T) {
        // 입에 물을 모았다가 (PERFECT 찬스) 강한 물줄기로 휩쓴다
        const pl = g.player;
        const windT = b.rage ? 0.75 : 0.95;
        b.vx *= Math.exp(-4 * dt);
        b.vy *= Math.exp(-4 * dt);
        if (T === 0) {
          b.winding = true;
          g.audio.play("charge");
        }
        if (T < windT) {
          b.p.wind = T / windT;
          b.face = pl.x >= b.x ? 1 : -1;
          b.beamA0 = Math.atan2(pl.y - b.y, pl.x - b.x);
          return false;
        }
        if (b.winding) {
          b.winding = false;
          b.p.wind = 0;
          g.audio.play("splash", { big: true });
          g.fx.shake(4);
        }
        const k = (T - windT) / 1.3;
        const sweep = b.rage ? 0.65 : 0.45;
        b.beamA = b.beamA0 + (k - 0.5) * 2 * sweep * (b.face > 0 ? 1 : -1);
        b.p.beam = 1;
        if (Math.random() < dt * 40) {
          const L = rand(60, b.beamL || 400);
          const mx = b.x + b.face * 60 * b.B.scale;
          g.fx.spawn({ kind: "bubble", x: mx + Math.cos(b.beamA) * L, y: b.y + Math.sin(b.beamA) * L, vx: Math.cos(b.beamA) * 200, vy: Math.sin(b.beamA) * 200 - 30, r: rand(2, 5), life: 0.5, drag: 1 });
        }
        if (k >= 1) {
          b.p.beam = 0;
          b.beamA = null;
          return true;
        }
        return false;
      },
      coil(b, dt, g, T) {
        // 지혁 둘레를 빙빙 돌며 몸으로 감싼다 (몸통에 닿으면 아야)
        const pl = g.player;
        const dur = 2.8;
        if (T === 0) {
          b.coilA = Math.atan2(b.y - pl.y, b.x - pl.x);
          b.cx = pl.x;
          b.cy = pl.y;
          g.fx.text("칭칭 감긴다! 빠져나가요!", pl.x, pl.y - 90, { size: 22, color: "#bff8e8", stroke: "#0a3a2a", life: 1.2 });
          g.audio.play("bossAppear");
        }
        const k = T / dur;
        b.coiling = true;
        b.cx = lerp(b.cx, pl.x, dt * 0.6);
        b.cy = lerp(b.cy, pl.y, dt * 0.6);
        b.coilA += dt * (b.rage ? 2.6 : 2.1);
        const R = 270 - k * (b.rage ? 110 : 90);
        b.steer(b.cx + Math.cos(b.coilA) * R, b.cy + Math.sin(b.coilA) * R * 0.85, b.speed * 2.4, dt, 6);
        b.face = b.vx >= 0 ? 1 : -1;
        if (k >= 1) {
          b.coiling = false;
          return true;
        }
        return false;
      },
    },
    harms(b, g) {
      const out = [];
      const sc = b.B.scale;
      if (b.coiling) for (const s of b.segs) out.push({ x: s.x, y: s.y, r: 24 * sc + 4, dmg: 5 });
      if (b.beamA != null && b.p.beam) {
        const mx = b.x + b.face * 60 * sc;
        const my = b.y + 4;
        let L = 40;
        for (; L < 620; L += 34) {
          const x = mx + Math.cos(b.beamA) * L;
          const y = my + Math.sin(b.beamA) * L;
          if (!g.world.open(x, y, 4)) break;
          out.push({ x, y, r: 22, dmg: 5 });
        }
        b.beamL = L;
      }
      return out;
    },
    drawBack(ctx, cam, b, g, t) {
      const sc = b.B.scale;
      const n = b.segs.length;
      for (let i = n - 1; i >= 0; i--) {
        const s = b.segs[i];
        const r = (30 - (i / b.B.N) * 12) * 1;
        ctx.save();
        ctx.translate(s.x - cam.x, s.y - cam.y);
        ctx.scale(sc, sc);
        serpentSeg(ctx, r, s.ang, i / n, t + i * 0.3, b.rage, i === n - 1);
        if (b.p.hit) {
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.15, r, 0, 0, TAU);
          ctx.fillStyle = `rgba(255,255,255,${0.3 * b.p.hit})`;
          ctx.fill();
        }
        ctx.restore();
      }
    },
    drawFx(ctx, cam, b, g, t) {
      if (b.beamA == null || !b.p.beam) return;
      const sc = b.B.scale;
      const mx = b.x + b.face * 60 * sc - cam.x;
      const my = b.y + 4 - cam.y;
      const L = b.beamL || 400;
      const ex = mx + Math.cos(b.beamA) * L;
      const ey = my + Math.sin(b.beamA) * L;
      ctx.save();
      ctx.lineCap = "round";
      for (const [w, c] of [
        [40, "rgba(120,220,255,0.25)"],
        [24, "rgba(160,240,255,0.6)"],
        [10, "rgba(240,255,255,0.95)"],
      ]) {
        ctx.beginPath();
        ctx.moveTo(mx, my);
        for (let i = 1; i <= 10; i++) {
          const k = i / 10;
          ctx.lineTo(mx + (ex - mx) * k + Math.sin(t * 30 + i) * 3, my + (ey - my) * k + Math.cos(t * 26 + i) * 3);
        }
        ctx.lineWidth = w;
        ctx.strokeStyle = c;
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  /* ---------- 산호초 문어왕: 분신 산호 숨바꼭질(왕관이 반짝이는 게 진짜) · 촉수 휘두르기 · 먹물 · 알깍쟁이 부르기 · 돌진 ---------- */
  octoKing: {
    hp: 340,
    r: 100,
    scale: 0.64,
    speed: 180,
    hitOff: [0, -40],
    harmOff: [0, 30],
    glow: 220,
    start(b, g) {
      b.x = g.boss_spawn.x;
      b.y = g.boss_spawn.y;
      b.face = 1;
    },
    pick(b, g) {
      const list = ["prowl", "hide", "slap", "slap", "ink", "eggs", "charge"];
      if (b.rage) list.push("hide", "charge", "slap");
      let p = pick(list);
      if (p === b.lastP && p !== "slap") p = "slap";
      if (b.afterStun) {
        b.afterStun = false;
        p = "prowl";
      }
      if (p === "eggs" && g.minions.length > 3) p = "ink";
      if (p === "hide" && ((b.hideCd || 0) > 0 || g.world.bedY(g.player.x) - g.player.y > 560)) p = "slap";
      return p;
    },
    pattern: {
      prowl(b, dt, g, T) {
        if (T === 0) b.patT = rand(1.8, 2.6);
        const pl = g.player;
        b.orbit = (b.orbit || 0) + dt * (b.rage ? 0.9 : 0.6);
        b.steer(pl.x + Math.cos(b.orbit) * 290, pl.y - 60 + Math.sin(b.orbit) * 140, b.speed, dt, 1.6);
        b.face = pl.x >= b.x ? 1 : -1;
        return T > b.patT;
      },
      hide(b, dt, g, T) {
        // 먹물 펑 → 바닥에 산호 무더기 넷 · 그중 하나에 숨는다 (진짜는 왕관 끝이 반짝)
        const pl = g.player;
        if (T === 0) {
          g.fx.ink(b.x, b.y, 3);
          g.audio.play("ink");
          const xs = [-330, -110, 110, 330].map((dx) => clamp(pl.x + dx, g.world.wallL(pl.y) + 90, g.world.wallR(pl.y) - 90));
          const real = Math.floor(rand(0, 4));
          b.mounds = xs.map((x, i) => ({ x, y: g.world.bedY(x) + 6, real: i === real, pop: 0, ph: rand(0, 6) }));
          b.hidden = true;
          b.vx = 0;
          b.vy = 0;
          b.hideT = b.rage ? 4.2 : 5.2;
          g.fx.text("산호 속에 숨었다! 왕관을 찾아요!", pl.x, pl.y - 90, { size: 22, color: "#ffe08a", stroke: "#5a2a00", life: 1.6 });
          g.audio.play("swap");
        }
        if (b.found) {
          // 찾았다! 진짜 산호에서 튀어나와 어질어질
          b.found = false;
          BOSS_BEH.octoKing.unhide(b, g, true);
          return true;
        }
        if (T > b.hideT) {
          // 못 찾음: 진짜 산호에서 튀어나오며 충격파
          BOSS_BEH.octoKing.unhide(b, g, false);
          b.wave = { r: 60, t: 0, w: 28 };
          g.fx.shake(10);
          g.audio.play("bossAppear");
          return true;
        }
        return false;
      },
      slap(b, dt, g, T) {
        // 촉수를 모았다가 (PERFECT 찬스) 빙글 휘두르기 → 충격파
        const pl = g.player;
        const windT = b.rage ? 0.7 : 0.9;
        if (T === 0) {
          b.winding = true;
          g.audio.play("windup");
        }
        if (T < windT) {
          b.p.wind = T / windT;
          b.steer(pl.x, pl.y - 40, b.speed * 0.8, dt, 2);
          return false;
        }
        if (b.winding) {
          b.winding = false;
          b.p.wind = 0;
          b.wave = { r: 60, t: 0, w: 26 };
          g.fx.shake(8);
          g.audio.play("splash", { big: true });
          b.spinT = 0.7;
        }
        b.vx *= Math.exp(-4 * dt);
        b.vy *= Math.exp(-4 * dt);
        b.spinT -= dt;
        b.spinA = b.spinT > 0 ? (b.spinA || 0) + dt * 14 : 0;
        if (T > windT + 0.9) {
          b.spinA = 0;
          return true;
        }
        return false;
      },
      ink(b, dt, g, T) {
        const pl = g.player;
        if (T === 0) {
          b.p.roar = 1;
          g.fx.ink(b.x, b.y + 30, 2.4);
          g.audio.play("ink");
          const ang = Math.atan2(pl.y - b.y, pl.x - b.x);
          const n = b.rage ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const a = ang + (i / (n - 1) - 0.5) * 1.1;
            g.shoot({ kind: "ink", x: b.x + Math.cos(a) * 50, y: b.y + 30 + Math.sin(a) * 50, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, r: 13, dmg: 4, life: 2.2 });
          }
        }
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        return T > 0.9;
      },
      eggs(b, dt, g, T) {
        if (T === 0) {
          b.p.roar = 1;
          g.audio.play("bossAppear");
        }
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        if (T > 0.5 && !b.summoned) {
          b.summoned = true;
          const n = b.rage ? 4 : 3;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            g.addMinion(new Minion({ x: b.x + Math.cos(a) * 110, y: b.y + Math.sin(a) * 80, art: "eggling", s: 0.7, hp: 2, r: 20, speed: 190 + i * 15, dmg: 3 }));
          }
          g.fx.text("알깍쟁이들아, 나와라!", b.x, b.y - 130, { size: 22, color: "#e8fff0", stroke: "#1a5a3a", life: 1 });
        }
        if (T > 1.2) {
          b.summoned = false;
          b.p.roar = 0;
          return true;
        }
        return false;
      },
      charge(b, dt, g, T) {
        const pl = g.player;
        const windT = b.rage ? 0.75 : 0.95;
        if (T === 0) {
          b.winding = true;
          g.audio.play("windup");
        }
        if (T < windT) {
          b.p.wind = T / windT;
          b.vx *= Math.exp(-5 * dt);
          b.vy *= Math.exp(-5 * dt);
          b.aimX = pl.x;
          b.aimY = pl.y;
          return false;
        }
        if (!b.charging) {
          b.winding = false;
          b.p.wind = 0;
          b.charging = true;
          const dx = b.aimX - b.x;
          const dy = b.aimY - b.y;
          const d = Math.hypot(dx, dy) + 1;
          b.vx = (dx / d) * (b.rage ? 820 : 700);
          b.vy = (dy / d) * (b.rage ? 820 : 700);
          g.audio.play("chomp");
        }
        b.p.charge = 1;
        b.harmR = 96;
        if (b.wallHit) {
          b.wallHit = false;
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          b.stun(g, 1.7);
          b.afterStun = true;
          return true;
        }
        if (T > windT + 0.8) {
          b.charging = false;
          b.p.charge = 0;
          b.harmR = 0;
          b.vx *= 0.3;
          b.vy *= 0.3;
          return true;
        }
        return false;
      },
    },
    unhide(b, g, found) {
      const m = b.mounds.find((q) => q.real) || b.mounds[0];
      b.x = m.x;
      b.y = m.y - 120;
      b.hidden = false;
      b.mounds = null;
      b.hideCd = 6;
      b.p.roar = 1;
      g.fx.burst(m.x, m.y - 40, 1.2);
      if (found) {
        g.fx.text("찾았다!", m.x, m.y - 170, { size: 34, color: "#fff6a0", stroke: "#6a3a00", punch: true, life: 1 });
        b.stun(g, 1.8);
        b.afterStun = true;
        b.hp = Math.max(1, b.hp - 12);
        b.p.hit = 1;
        g.audio.play("perfect");
      }
    },
    tick(b, dt) {
      if (b.hideCd > 0) b.hideCd -= dt;
      if (b.mounds) for (const m of b.mounds) if (m.pop > 0) m.pop += dt;
    },
    /** 분신 산호 (물줄기 표적) */
    extraTargets(b) {
      if (!b.mounds) return [];
      return b.mounds.filter((m) => !m.pop).map((m) => ({ x: m.x, y: m.y - 44, r: 64, ref: m }));
    },
    hitExtra(b, tg, g, x, y) {
      const m = tg.ref;
      if (m.real) {
        b.found = true;
        return;
      }
      // 가짜 산호: 펑! 가시를 뿌린다
      m.pop = 0.001;
      g.fx.burst(m.x, m.y - 40, 0.8);
      g.fx.text("꽝! 가짜", m.x, m.y - 110, { size: 24, color: "#ffd0d0", stroke: "#5a0a0a", life: 0.8 });
      g.audio.play("puff");
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * 0.45;
        g.shoot({ kind: "ice", x: m.x, y: m.y - 50, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, r: 8, dmg: 3, life: 1.4 });
      }
    },
    drawFx(ctx, cam, b, g, t) {
      if (!b.mounds) return;
      for (const m of b.mounds) {
        if (m.pop) continue;
        const x = m.x - cam.x;
        const y = m.y - cam.y;
        ctx.save();
        ctx.translate(x, y);
        const crown = m.real ? Math.max(0, Math.sin(t * 2.4 + m.ph) - 0.35) * 1.6 : 0;
        kingMound(ctx, t + m.ph, 0.6 + 0.4 * Math.sin(t * 3 + m.ph), Math.min(1, crown));
        ctx.restore();
      }
    },
  },

  /* ---------- THE ABYSSAL: 거대한 눈(약점 · 깜빡이면 '팅') · 눈빛 광선 · 밑에서 촉수 · 덥석 · 등불 부하 · (분노) 불 꺼짐 ---------- */
  abyssal: {
    hp: 420,
    r: 64,
    scale: 0.62,
    speed: 130,
    hitOff: [0, -26],
    harmOff: [0, 60],
    glow: 320,
    front: true,
    first: "drift",
    spawn(g) {
      const pl = g.player;
      const x = clamp(pl.x, g.world.wallL(pl.y) + 220, g.world.wallR(pl.y) - 220);
      return { x, y: Math.min(g.world.bedY(x) - 240, pl.y + 400) };
    },
    start(b, g) {
      b.x = g.boss_spawn.x;
      b.y = g.boss_spawn.y;
      b.face = 1;
      b.eyeT = 2.6;
      b.eyeOpen = true;
      b.p.eye = 1;
      b.p.lines = 1;
      b.p.tents = 1;
    },
    tick(b, dt, g) {
      b.face = 1;
      // 눈 깜빡임 (감으면 '팅')
      b.eyeT -= dt;
      if (b.eyeT <= 0 && !b.winding) {
        b.eyeOpen = !b.eyeOpen;
        b.eyeT = b.eyeOpen ? rand(2.4, 3.2) : b.rage ? 1.0 : 0.8;
      }
      if (b.winding || b.stunT > 0) b.eyeOpen = true;
      b.p.eye = lerp(b.p.eye, b.eyeOpen ? 1 : 0.04, Math.min(1, dt * 12));
      b.p.jaw = Math.max(0, (b.p.jaw || 0) - dt * 2);
      // 분노: 불이 꺼진다
      if (b.darkT > 0) b.darkT -= dt;
      g.world.extraDark = lerp(g.world.extraDark || 0, b.darkT > 0 ? 0.55 : 0, Math.min(1, dt * 2));
    },
    armor(b) {
      return b.p.eye < 0.4;
    },
    blockTip: "눈을 감았어요! 눈을 뜰 때 쏴요!",
    pick(b, g) {
      const list = ["drift", "gaze", "gaze", "slam", "slam", "bite", "lanterns"];
      if (b.rage) list.push("gaze", "bite", "slam");
      let p = pick(list);
      if (p === b.lastP && p !== "slam") p = "slam";
      if (b.afterStun) {
        b.afterStun = false;
        p = "drift";
      }
      if (b.rage && !b.darkDone) {
        b.darkDone = true;
        b.darkT = 7;
        g.fx.text("불이 꺼졌다…! 빛나는 눈을 노려요!", g.player.x, g.player.y - 90, { size: 22, color: "#c8e8ff", stroke: "#0a0a2a", life: 1.8 });
        g.audio.play("bossAppear");
      }
      if (p === "lanterns" && g.minions.length > 3) p = "gaze";
      return p;
    },
    pattern: {
      drift(b, dt, g, T) {
        if (T === 0) b.patT = rand(1.8, 2.6);
        const pl = g.player;
        const tx = clamp(pl.x + Math.sin(T * 1.2) * 120, g.world.wallL(b.y) + 200, g.world.wallR(b.y) - 200);
        const ty = Math.min(g.world.bedY(tx) - 220, pl.y + 330);
        b.steer(tx, ty, b.speed, dt, 1.2);
        return T > b.patT;
      },
      gaze(b, dt, g, T) {
        // 눈에 빛을 모았다가 (PERFECT 찬스) 눈빛 광선으로 휩쓴다
        const pl = g.player;
        const windT = b.rage ? 0.85 : 1.05;
        b.vx *= Math.exp(-4 * dt);
        b.vy *= Math.exp(-4 * dt);
        if (T === 0) {
          b.winding = true;
          g.audio.play("charge");
        }
        if (T < windT) {
          b.p.wind = T / windT;
          b.beamA0 = Math.atan2(pl.y - (b.y - 26), pl.x - b.x);
          return false;
        }
        if (b.winding) {
          b.winding = false;
          b.p.wind = 0;
          g.audio.play("zap");
          g.fx.shake(5);
        }
        const k = (T - windT) / 1.4;
        const sweep = b.rage ? 0.7 : 0.5;
        b.beamA = b.beamA0 + (k - 0.5) * 2 * sweep * (b.sweepDir || 1);
        b.p.beam = 1;
        if (k >= 1) {
          b.p.beam = 0;
          b.beamA = null;
          b.sweepDir = -(b.sweepDir || 1);
          return true;
        }
        return false;
      },
      slam(b, dt, g, T) {
        const pl = g.player;
        if (T === 0) {
          b.p.roar = 0.8;
          b.slams = [];
          const n = b.rage ? 3 : 2;
          for (let i = 0; i < n; i++) b.slams.push({ x: clamp(pl.x + (i - (n - 1) / 2) * 200 + rand(-30, 30), 70, g.world.w - 70), t: -i * 0.3, ph: rand(0, 9) });
          g.audio.play("rumble");
        }
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        for (const s of b.slams) {
          const was = s.t;
          s.t += dt;
          if (s.t > 0 && s.t < 1 && Math.random() < dt * 30) g.fx.spawn({ kind: "bubble", x: s.x + rand(-40, 40), y: g.cam.y + H + 10, vx: 0, vy: rand(-420, -260), r: rand(2, 5), life: 1.4, drag: 0.3 });
          if (was < 1 && s.t >= 1) {
            g.audio.play("splash", { big: true });
            g.fx.shake(9);
          }
        }
        if (T > 2.4) {
          b.slams = null;
          b.p.roar = 0;
          return true;
        }
        return false;
      },
      bite(b, dt, g, T) {
        // 입을 쩍 (PERFECT 찬스) → 지혁에게 덥석 솟구친다
        const pl = g.player;
        const windT = b.rage ? 0.75 : 0.95;
        if (T === 0) {
          b.winding = true;
          g.audio.play("windup");
          b.homeY = b.y;
        }
        if (T < windT) {
          b.p.wind = T / windT;
          b.p.jaw = T / windT;
          b.vx *= Math.exp(-5 * dt);
          b.vy *= Math.exp(-5 * dt);
          b.aimX = pl.x;
          b.aimY = pl.y + 60;
          return false;
        }
        if (!b.charging) {
          b.winding = false;
          b.p.wind = 0;
          b.charging = true;
          const dx = b.aimX - b.x;
          const dy = b.aimY - b.y;
          const d = Math.hypot(dx, dy) + 1;
          b.vx = (dx / d) * (b.rage ? 760 : 640);
          b.vy = (dy / d) * (b.rage ? 760 : 640);
          g.audio.play("chomp");
          g.fx.shake(6);
        }
        b.p.jaw = 1;
        b.harmR = 104;
        if (b.wallHit) {
          b.wallHit = false;
          b.charging = false;
          b.harmR = 0;
          b.stun(g, 1.8);
          b.afterStun = true;
          return true;
        }
        if (T > windT + 0.7) {
          b.charging = false;
          b.harmR = 0;
          b.vx *= 0.2;
          b.vy *= 0.2;
          return true;
        }
        return false;
      },
      lanterns(b, dt, g, T) {
        if (T === 0) {
          b.p.roar = 1;
          g.audio.play("bossAppear");
        }
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        if (T > 0.5 && !b.summoned) {
          b.summoned = true;
          const n = b.rage ? 4 : 3;
          for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.7;
            g.addMinion(new Minion({ x: b.x + Math.cos(a) * 200, y: b.y - 60 + Math.sin(a) * 150, art: "abyssLantern", s: 0.6, hp: 2, r: 22, speed: 120 + i * 15, dmg: 4 }));
          }
          g.fx.text("심연의 등불들!", b.x, b.y - 200, { size: 24, color: "#ffe08a", stroke: "#2a1a00", life: 1 });
        }
        if (T > 1.2) {
          b.summoned = false;
          b.p.roar = 0;
          return true;
        }
        return false;
      },
    },
    harms(b, g) {
      const out = [];
      if (b.slams) for (const s of b.slams) if (s.t > 1 && s.t < 1.6) out.push({ rect: true, x0: s.x - 44, x1: s.x + 44, y0: g.cam.y + H - (H * 0.8) * Math.min(1, (s.t - 1) / 0.2), y1: g.cam.y + H + 100, dmg: 5 });
      if (b.beamA != null && b.p.beam) {
        const ex = b.x;
        const ey = b.y - 26;
        let L = 60;
        for (; L < 720; L += 34) {
          const x = ex + Math.cos(b.beamA) * L;
          const y = ey + Math.sin(b.beamA) * L;
          if (!g.world.open(x, y, 4)) break;
          out.push({ x, y, r: 22, dmg: 5 });
        }
        b.beamL = L;
      }
      return out;
    },
    drawFx(ctx, cam, b, g, t) {
      if (b.beamA != null && b.p.beam) {
        const mx = b.x - cam.x;
        const my = b.y - 26 - cam.y;
        const L = b.beamL || 500;
        const ex = mx + Math.cos(b.beamA) * L;
        const ey = my + Math.sin(b.beamA) * L;
        ctx.save();
        ctx.lineCap = "round";
        for (const [w, c] of [
          [50, b.rage ? "rgba(255,60,120,0.25)" : "rgba(255,140,60,0.25)"],
          [26, b.rage ? "rgba(255,90,140,0.7)" : "rgba(255,180,80,0.7)"],
          [10, "rgba(255,250,220,0.95)"],
        ]) {
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(ex + Math.sin(t * 40) * 3, ey + Math.cos(t * 36) * 3);
          ctx.lineWidth = w;
          ctx.strokeStyle = c;
          ctx.stroke();
        }
        ctx.restore();
      }
      if (b.slams) {
        for (const s of b.slams) {
          if (s.t < 0) continue;
          const x = s.x - cam.x;
          if (s.t < 1) {
            ctx.save();
            ctx.globalAlpha = 0.25 + s.t * 0.5;
            ctx.fillStyle = "#04020c";
            ctx.beginPath();
            ctx.ellipse(x, H - 10, 76 + s.t * 20, 30, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.setLineDash([14, 12]);
            ctx.lineDashOffset = t * 90;
            ctx.strokeStyle = `rgba(120,240,255,${0.3 + s.t * 0.6})`;
            ctx.lineWidth = 3;
            for (const dx of [-44, 44]) {
              ctx.beginPath();
              ctx.moveTo(x + dx, H * 0.2);
              ctx.lineTo(x + dx, H);
              ctx.stroke();
            }
            ctx.restore();
          } else if (s.t < 1.75) {
            const k = s.t < 1.2 ? (s.t - 1) / 0.2 : s.t < 1.45 ? 1 : 1 - (s.t - 1.45) / 0.3;
            tentacle(ctx, x - 30, H + 60, -Math.PI / 2 + 0.06, H * 0.84 * Math.max(0.05, k), 116, t * 0.6, s.ph, { wave: 0.05, curl: 1.4, color: "#2c2860", line: "#0a0818", sucker: b.rage ? "#ff5aa8" : "#5ff0ff", lw: 5 });
          }
        }
      }
    },
    /** 등장 연출: 어둠 → 거대한 눈 → 빛나는 실루엣 → 촉수 → 전체 */
    intro: {
      dur: 5.6,
      spawnAt: 4.6,
      cue(bi, g, was) {
        const t = bi.t;
        if (was < 0.6 && t >= 0.6) {
          g.fx.shake(4);
          g.audio.play("rumble");
        }
        if (was < 2.0 && t >= 2.0) {
          g.fx.shake(5);
          g.audio.play("rumble");
        }
        if (was < 3.4 && t >= 3.4) {
          g.fx.shake(7);
          g.audio.play("bossAppear");
        }
      },
      draw(ctx, bi, g, sx, sy) {
        const t = bi.t;
        const z = g.cam.zoom;
        const fade = t < 0.6 ? t / 0.6 : t > 4.6 ? Math.max(0, 1 - (t - 4.6) / 0.8) : 1;
        ctx.fillStyle = `rgba(1,2,8,${0.9 * fade})`;
        ctx.fillRect(0, 0, W, H);
        if (t > 0.6 && t < 4.75) {
          const eye = clamp((t - 0.8) / 1.0, 0, 1);
          const lines = clamp((t - 2.0) / 1.3, 0, 1);
          const tents = clamp((t - 3.4) / 1.0, 0, 1);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(0.62 * z, 0.62 * z);
          BOSS_ART.abyssal(ctx, { t, hit: 0, wind: t > 3.4 ? 0.6 : 0, stun: 0, rage: 0, roar: 0, look: { x: 0, y: -0.4 }, silhouette: 1, eye, lines, tents });
          ctx.restore();
        }
        if (t > 4.45 && t < 4.75) {
          ctx.fillStyle = `rgba(255,255,255,${1 - Math.abs(t - 4.6) / 0.15})`;
          ctx.fillRect(0, 0, W, H);
        }
      },
    },
  },
};

/** 보스별 행동 표 (등장 연출 · 등장 자리 등을 game.js 가 읽는다) */
export function bossBeh(id) {
  return BOSS_BEH[id];
}

/* ================================================================
 * 보스
 * ============================================================== */
export class Boss {
  constructor(def, g) {
    this.def = def;
    this.id = def.id;
    this.B = BOSS_BEH[def.id];
    this.g = g;
    this.maxHp = this.B.hp;
    this.hp = this.maxHp;
    this.r = this.B.r;
    this.speed = this.B.speed;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.face = -1;
    this.state = "intro";
    this.st = 0;
    this.pat = null;
    this.patT = 0;
    this.T = 0;
    this.stunT = 0;
    this.harmR = 0;
    this.rage = false;
    this.winding = false;
    this.capT = 0;
    this.done = false;
    this.p = { t: 0, hit: 0, wind: 0, charge: 0, stun: 0, rage: 0, roar: 0, pulse: 0, look: { x: 0, y: 0 } };
    this.glow = this.B.glow || 0;
    this.B.start(this, g);
  }

  steer(tx, ty, speed, dt, acc = 2) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) + 1;
    this.vx += ((dx / d) * speed - this.vx) * Math.min(1, acc * dt);
    this.vy += ((dy / d) * speed - this.vy) * Math.min(1, acc * dt);
  }

  stun(g, t) {
    this.stunT = t;
    this.p.stun = 1;
    this.winding = false;
    this.p.wind = 0;
    this.pat = null;
    this.grab = null;
    this.charging = false;
    this.harmR = 0;
    this.beamA = null;
    this.p.beam = 0;
    this.coiling = false;
    g.fx.text("어질어질!", this.x, this.y - 110, { size: 30, color: "#fff6a0", stroke: "#5a2a00", punch: true, life: 1 });
    g.fx.shake(10);
    g.audio.play("boing");
  }

  update(dt, g) {
    this.p.t += dt;
    this.p.hit = Math.max(0, this.p.hit - dt * 4);
    this.p.roar = Math.max(0, this.p.roar - dt);
    this.p.pulse = Math.max(0, this.p.pulse - dt * 2);
    if (g.player) {
      const dx = g.player.x - this.x;
      const dy = g.player.y - this.y;
      const d = Math.hypot(dx, dy) + 1;
      this.p.look.x = lerp(this.p.look.x, (dx / d) * (this.face || 1), 0.1);
      this.p.look.y = lerp(this.p.look.y, dy / d, 0.1);
    }
    this.st += dt;
    if (this.state === "captured") {
      this.capT += dt;
      this.p.stun = 1;
      this.vx *= Math.exp(-2 * dt);
      this.vy = lerp(this.vy, -50, dt);
      this.x += this.vx * dt;
      if (this.capT > 0.8) this.y += this.vy * dt;
      if (this.capT > 2.6 && !this.done) {
        this.done = true;
        g.onBossCaptured(this);
      }
      return;
    }
    if (this.state === "intro") return;
    // 충격파
    if (this.wave) {
      this.wave.t += dt;
      this.wave.r = 60 + this.wave.t * (this.wave.sp || 520);
      if (this.wave.t > (this.wave.life || 0.75)) this.wave = null;
    }
    if (this.stunT > 0) {
      this.stunT -= dt;
      this.vx *= Math.exp(-3 * dt);
      this.vy *= Math.exp(-3 * dt);
      this.vy += Math.sin(this.p.t * 3) * 10 * dt;
      if (this.stunT <= 0) this.p.stun = 0;
    } else {
      if (!this.pat) {
        this.pat = this.B.pick(this, g);
        this.lastP = this.pat;
        this.T = 0;
      }
      const done = this.B.pattern[this.pat](this, dt, g, this.T);
      this.T += dt;
      if (done === "again") this.T = 0;
      else if (done) this.pat = null;
    }
    // 움직이기 (돌진 중 벽에 닿으면 표시)
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const hit = g.world.push(this, 90);
    if (hit && this.charging) this.wallHit = true;
    if (this.B.tick) this.B.tick(this, dt, g);
    if (this.B.tilt) {
      const want = this.stunT > 0 ? 0 : Math.max(-0.6, Math.min(0.6, this.face * Math.atan2(this.vy, Math.abs(this.vx) + 80)));
      this.tiltA = lerp(this.tiltA || 0, want, Math.min(1, dt * 6));
    }
    if (this.winding && this.state === "fight") this.p.wind = Math.max(this.p.wind, 0.01);
  }

  /** 맞는 자리 (보스마다 몸 중심이 다르다) */
  hitBox() {
    const o = this.B.hitOff || [40, 0];
    return { x: this.x + this.face * o[0], y: this.y + o[1], r: this.r + 6 };
  }

  /** 물줄기에 맞음 → "perfect" | "hit" | "capture" */
  hit(g, dmg) {
    if (this.state !== "fight") return null;
    if (this.B.armor && this.B.armor(this)) return "blocked";
    let res = "hit";
    if (this.winding) {
      res = "perfect";
      dmg *= 2;
      this.stun(g, 1.5);
      this.afterStun = true;
    }
    if (this.stunT > 0 && res !== "perfect") dmg *= 1.25;
    this.hp -= dmg;
    this.p.hit = 1;
    if (!this.rage && this.hp <= this.maxHp * 0.5) {
      this.rage = true;
      this.p.rage = 1;
      this.speed *= 1.25;
      g.onBossRage(this);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = "captured";
      this.capT = 0;
      this.harmR = 0;
      this.winding = false;
      g.onBossCapturing(this);
      return "capture";
    }
    return res;
  }

  /** 지혁을 다치게 하는 곳 */
  harms() {
    const out = [];
    if (this.state !== "fight") return out;
    const o = this.B.harmOff || [80, 0];
    if (this.harmR > 0 && !this.hidden) out.push({ x: this.x + this.face * o[0], y: this.y + o[1], r: this.harmR });
    if (this.wave) out.push({ x: this.x, y: this.y, r: this.wave.r, ring: this.wave.w || 26 });
    if (this.B.harms) for (const h of this.B.harms(this, this.g)) out.push(h);
    return out;
  }

  draw(ctx, cam) {
    const sc = this.B.scale;
    if (this.B.drawBack) {
      ctx.save();
      if (this.state === "captured") ctx.globalAlpha = Math.max(0, 1 - this.capT / 1.6);
      this.B.drawBack(ctx, cam, this, this.g, this.p.t);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(this.x - cam.x, this.y - cam.y);
    if (this.state === "captured") {
      const k = Math.min(1, this.capT / 0.8);
      ctx.rotate(Math.sin(this.capT * 4) * 0.25);
      ctx.scale(1 - k * 0.2, 1 - k * 0.2);
    }
    if (this.spinA) ctx.rotate(this.spinA);
    if (this.tiltA) ctx.rotate(this.tiltA);
    ctx.scale(this.face * sc, sc);
    if (!this.hidden) BOSS_ART[this.id](ctx, { ...this.p, rage: this.rage });
    ctx.restore();
    if (this.wave) {
      const a = 1 - this.wave.t / (this.wave.life || 0.75);
      if (this.B.waveStyle === "zap") zapRing(ctx, this.x - cam.x, this.y - cam.y, this.wave.r, a);
      else if (this.B.drawWave) this.B.drawWave(ctx, this.x - cam.x, this.y - cam.y, this.wave, a);
      else {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = "rgba(220,250,255,0.9)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(this.x - cam.x, this.y - cam.y, this.wave.r, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (this.B.drawFx && this.state === "fight") this.B.drawFx(ctx, cam, this, this.g, this.p.t);
    if (this.state === "captured") {
      const k = Math.min(1, this.capT / 0.8);
      const r = 190 * (0.4 + k * 0.7);
      ctx.save();
      ctx.translate(this.x - cam.x, this.y - cam.y);
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, "rgba(255,255,255,0.3)");
      g.addColorStop(0.7, "rgba(160,235,255,0.16)");
      g.addColorStop(1, "rgba(200,250,255,0.55)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(235,252,255,0.9)";
      ctx.stroke();
      ctx.restore();
    }
  }
}
