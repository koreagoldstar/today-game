/*
 * 보스 10종 패턴 — 모두 '미리 보여 주고(표시 원 · 선) → 효과' 순서. 즉사 패턴 없음.
 *  타워를 멈추는 효과는 sim.stunTowers 가 면역 시간을 지켜 계속 묶이지 않게 한다.
 *  페이즈는 체력 비율로 바뀌고, 바뀔 때 'phase' 알림을 낸다.
 *  e.b 에 보스 상태 (쿨다운 · 페이즈 · 자세)
 */
import { spawnEnemyLater, towerCluster, pathPoint } from "./helpers.js";

const vuln = (e, mul, t) => {
  e.st.vuln = Math.max(e.st.vuln, mul);
  e.st.vulnT = Math.max(e.st.vulnT, t);
};
function phaseCheck(sim, e, cuts) {
  const f = e.hp / e.maxHp;
  let p = 1;
  for (const c of cuts) if (f <= c) p++;
  if (p > e.b.phase) {
    e.b.phase = p;
    sim.emit({ type: "phase", id: e.id, phase: p });
    return true;
  }
  return false;
}
const ahead = (e, d) => Math.min(e.path.length - 0.8, e.s + d);

export const BOSS_AI = {
  /* 왕관 슬라임: 점프(착지 지점 표시) → 충격파(근처 타워 멈춤) + 슬라임 소환 · 반 피 이하면 자주 */
  crownSlime: {
    init(sim, e) {
      e.b = { phase: 1, jump: 5, summoned: 0 };
    },
    update(sim, e, dt) {
      const b = e.b;
      phaseCheck(sim, e, [0.5]);
      if (e.state === "jumpWarn") {
        e.mods.speed = 0;
        if ((e.stateT -= dt) <= 0) {
          e.state = "air";
          e.flying = true;
          const s1 = ahead(e, 2.6);
          const p = pathPoint(e, s1);
          sim.addMarker({
            kind: "ring",
            x: p.x,
            z: p.z,
            r: 2.2,
            dur: 1.1,
            color: 0xffd34d,
            blocking: true,
            done(sim) {
              if (e.dead || e.leaked) return;
              e.s = Math.max(e.s, s1);
              e.flying = false;
              e.state = "move";
              sim.stunTowers(p.x, p.z, 2.2, 1.2, "slam");
              sim.emit({ type: "boom", x: p.x, z: p.z, r: 2.2, look: "slam" });
              const n = b.phase >= 2 ? 3 : 2;
              for (let i = 0; i < n && b.summoned < 14; i++, b.summoned++) spawnEnemyLater(sim, "slime", e, { s: Math.max(0, e.s - 0.3 - i * 0.3), lane: (i - 1) * 0.35 });
            },
          });
        }
        return;
      }
      if (e.state === "air") {
        e.mods.speed = 0;
        return;
      }
      if (b.phase >= 2) e.mods.speed *= 1.2;
      if ((b.jump -= dt) <= 0 && e.path.length - e.s > 3) {
        b.jump = b.phase >= 2 ? 5 : 7;
        e.state = "jumpWarn";
        e.stateT = 0.8;
        sim.emit({ type: "state", id: e.id, state: "jumpWarn" });
      }
    },
    death(sim, e) {
      sim.emit({ type: "crown", x: e.x, z: e.z });
    },
  },

  /* 철갑 멧돼지 대장: 돌진(앞쪽 선 표시) → 끝에서 충격파 · 갑옷 강화 뒤 지쳐서 약점 · 각성하면 돌진 때 멧돼지 호출 */
  ironBoarChief: {
    init(sim, e) {
      e.b = { phase: 1, charge: 4, armor: 10, calls: 0 };
    },
    update(sim, e, dt) {
      const b = e.b;
      phaseCheck(sim, e, [0.33]);
      switch (e.state) {
        case "chargeWarn":
          e.mods.speed = 0.1;
          if ((e.stateT -= dt) <= 0) {
            e.state = "charge";
            e.stateT = 1.6;
            if (e.awakened && b.calls < 3) {
              b.calls++;
              for (let i = 0; i < 2; i++) spawnEnemyLater(sim, "boar", e, { s: Math.max(0, e.s - 0.6 - i * 0.5), lane: i ? 0.3 : -0.3 });
            }
          }
          return;
        case "charge":
          e.mods.speed = 3.2;
          if ((e.stateT -= dt) <= 0) {
            e.state = "move";
            sim.stunTowers(e.x, e.z, 2.0, 1.0, "quake");
            sim.emit({ type: "boom", x: e.x, z: e.z, r: 2.0, look: "quake" });
          }
          return;
        case "armorUp":
          e.mods.armor += 0.4;
          e.mods.speed = 0.6;
          if ((e.stateT -= dt) <= 0) {
            e.state = "tired";
            e.stateT = 3;
            vuln(e, 1.5, 3);
            sim.emit({ type: "state", id: e.id, state: "tired" });
          }
          return;
        case "tired":
          e.mods.speed = 0.4;
          if ((e.stateT -= dt) <= 0) e.state = "move";
          return;
      }
      b.charge -= dt;
      b.armor -= dt;
      if (b.armor <= 0) {
        b.armor = 12;
        e.state = "armorUp";
        e.stateT = 4;
        sim.emit({ type: "state", id: e.id, state: "armorUp" });
        return;
      }
      if (b.charge <= 0 && e.path.length - e.s > 4) {
        b.charge = b.phase >= 2 ? 5 : 8;
        e.state = "chargeWarn";
        e.stateT = 1;
        const p = pathPoint(e, ahead(e, 4.5));
        sim.addMarker({ kind: "line", x: e.x, z: e.z, x2: p.x, z2: p.z, r: 0.6, dur: 1, color: 0xff7a3a });
        sim.emit({ type: "state", id: e.id, state: "chargeWarn" });
      }
    },
  },

  /* 포자 여왕: 길 앞에 포자 구역 · 꼬마 버섯 소환 · 반 피 이하면 타워 무리에 포자를 퍼뜨림 */
  sporeQueen: {
    init(sim, e) {
      e.b = { phase: 1, zones: 3, summon: 5, spread: 6, summoned: 0 };
    },
    update(sim, e, dt) {
      const b = e.b;
      phaseCheck(sim, e, [0.5]);
      const cap = e.awakened ? 24 : 15;
      if ((b.zones -= dt) <= 0) {
        b.zones = e.awakened ? 4.5 : 6;
        for (const d of [1, 2.5, 4]) {
          const p = pathPoint(e, ahead(e, d));
          sim.addZone({ kind: "poison", x: p.x, z: p.z, r: 1.1, dur: 5, owner: e.id, max: 9, towerRate: 0.8, heal: 0.015 });
        }
      }
      if ((b.summon -= dt) <= 0 && b.summoned < cap) {
        b.summon = 7;
        for (let i = 0; i < 3 && b.summoned < cap; i++, b.summoned++) spawnEnemyLater(sim, e.awakened && i === 2 ? "poisonSpore" : "miniShroom", e, { s: Math.max(0, e.s - 0.5 - i * 0.3), lane: (i - 1) * 0.35 });
        sim.emit({ type: "summon", id: e.id });
      }
      if (b.phase >= 2 && (b.spread -= dt) <= 0) {
        b.spread = 8;
        for (const c of towerCluster(sim, 2, 1.6)) {
          sim.addMarker({
            kind: "ring",
            x: c.x,
            z: c.z,
            r: 1.6,
            dur: 1.4,
            color: 0xa6ff5a,
            blocking: true,
            done(sim) {
              sim.addZone({ kind: "poison", x: c.x, z: c.z, r: 1.6, dur: 5, owner: e.id, max: 9, towerRate: 0.7, heal: 0 });
            },
          });
        }
      }
    },
  },

  /* 고대 버섯 거신: 내려찍기(넓게 멈춤) · 둘레 적 갑옷 · 2/3 · 1/3 에서 보호막 → 깨지면 약점 */
  mushroomColossus: {
    init(sim, e) {
      e.b = { phase: 1, slam: 6, shields: 0 };
    },
    update(sim, e, dt) {
      const b = e.b;
      if (phaseCheck(sim, e, [0.66, 0.33]) && b.shields < 2) {
        b.shields++;
        e.shield = e.maxShield = Math.round(e.maxHp * 0.2);
        e.state = "guard";
        sim.emit({ type: "shieldUp", id: e.id });
      }
      for (const o of sim.enemies) if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.z - e.z) < 3) {
        o.st.armorBuff = Math.max(o.st.armorBuff, 0.2);
        o.st.armorBuffT = Math.max(o.st.armorBuffT, 0.3);
      }
      if (e.state === "guard") e.mods.speed = 0.5;
      if (e.state === "exposed") {
        e.mods.speed = 0.3;
        if ((e.stateT -= dt) <= 0) e.state = "move";
      }
      if (e.state === "slamWarn") {
        e.mods.speed = 0;
        if ((e.stateT -= dt) <= 0) e.state = e.shield > 0 ? "guard" : "move";
        return;
      }
      if ((b.slam -= dt) <= 0) {
        b.slam = b.phase >= 3 ? 7 : 9;
        e.state = "slamWarn";
        e.stateT = 1.5;
        const x = e.x;
        const z = e.z;
        sim.addMarker({
          kind: "ring",
          x,
          z,
          r: 3,
          dur: 1.5,
          color: 0xffb35a,
          follow: e.id,
          blocking: true,
          done(sim, mk) {
            if (e.dead) return;
            sim.stunTowers(mk.x, mk.z, 3, 2, "quake");
            sim.emit({ type: "boom", x: mk.x, z: mk.z, r: 3, look: "quake" });
          },
        });
      }
    },
    onShieldBreak(sim, e) {
      e.state = "exposed";
      e.stateT = 4;
      vuln(e, 1.6, 4);
      sim.emit({ type: "state", id: e.id, state: "exposed" });
    },
  },

  /* 빙하 수호자: 얼음 보호막(시작 · 반 피 · 각성은 1/4) · 타워 무리 빙결 · 깨지면 약점 · 각성하면 늑대 무리 */
  glacierGuardian: {
    init(sim, e) {
      e.b = { phase: 1, freeze: 5, wolves: 8 };
      e.shield = e.maxShield = Math.round(e.maxHp * 0.4);
    },
    update(sim, e, dt) {
      const b = e.b;
      if (phaseCheck(sim, e, e.awakened ? [0.5, 0.25] : [0.5])) {
        e.shield = e.maxShield = Math.round(e.maxHp * 0.3);
        sim.emit({ type: "shieldUp", id: e.id });
      }
      if (e.state === "exposed") {
        e.mods.speed = 0.35;
        if ((e.stateT -= dt) <= 0) e.state = "move";
      }
      if ((b.freeze -= dt) <= 0) {
        b.freeze = 8;
        for (const c of towerCluster(sim, 1, 2)) {
          sim.addMarker({
            kind: "ring",
            x: c.x,
            z: c.z,
            r: 2,
            dur: 1.3,
            color: 0x8fe8ff,
            blocking: true,
            done(sim) {
              if (e.dead) return;
              sim.stunTowers(c.x, c.z, 2, 2.5, "ice");
              sim.emit({ type: "boom", x: c.x, z: c.z, r: 2, look: "ice" });
            },
          });
        }
      }
      if (e.awakened && (b.wolves -= dt) <= 0) {
        b.wolves = 10;
        for (let i = 0; i < 3; i++) spawnEnemyLater(sim, "iceWolf", e, { s: Math.max(0, e.s - 0.8 - i * 0.4), lane: (i - 1) * 0.3 });
      }
    },
    onShieldBreak(sim, e) {
      e.state = "exposed";
      e.stateT = 5;
      vuln(e, 1.6, 5);
      sim.emit({ type: "state", id: e.id, state: "exposed" });
    },
  },

  /* 눈보라의 여왕: 넓은 눈보라(모든 타워 공격속도 ↓) · 얼음 창(타워 하나 멈춤) · 반 피 이하면 늑대 · 더 자주 */
  blizzardQueen: {
    init(sim, e) {
      e.b = { phase: 1, storm: 7, spear: 3, wolves: 6 };
    },
    update(sim, e, dt) {
      const b = e.b;
      phaseCheck(sim, e, [0.5]);
      if (b.phase >= 2) e.mods.speed *= 1.15;
      if ((b.storm -= dt) <= 0) {
        b.storm = b.phase >= 2 ? 7 : 11;
        sim.addMarker({
          kind: "storm",
          x: e.x,
          z: e.z,
          r: 99,
          dur: 1.5,
          color: 0xdff6ff,
          blocking: true,
          done(sim) {
            if (e.dead) return;
            for (const t of sim.towers) sim.debuffTower(t, "frost", 0.75, 3);
            sim.emit({ type: "blizzard" });
          },
        });
      }
      if ((b.spear -= dt) <= 0) {
        b.spear = b.phase >= 2 ? 3.5 : 5;
        const t = strongestTower(sim);
        if (t)
          sim.addMarker({
            kind: "line",
            x: e.x,
            z: e.z,
            x2: t.x,
            z2: t.z,
            r: 0.5,
            dur: 0.9,
            color: 0x9fe9ff,
            blocking: true,
            done(sim) {
              if (e.dead) return;
              sim.stunTower(t, 1.5, "ice");
              sim.emit({ type: "spear", from: e.id, tower: t.id });
            },
          });
      }
      if (b.phase >= 2 && (b.wolves -= dt) <= 0) {
        b.wolves = 8;
        for (let i = 0; i < 3; i++) spawnEnemyLater(sim, "iceWolf", e, { s: Math.max(0, e.s - 0.6 - i * 0.4), lane: (i - 1) * 0.3 });
      }
    },
  },

  /* 마그마 거신: 용암 충격파(멈춤 + 불 지대) · 앞쪽 화염 · 방어 자세 뒤 약점 */
  magmaColossus: {
    init(sim, e) {
      e.b = { phase: 1, wave: 5, fire: 3, guard: 11 };
    },
    update(sim, e, dt) {
      const b = e.b;
      phaseCheck(sim, e, [0.5]);
      if (e.state === "guard") {
        e.mods.armor += 0.45;
        e.mods.cut *= 0.5;
        e.mods.speed = 0.3;
        if ((e.stateT -= dt) <= 0) {
          e.state = "weak";
          e.stateT = 3;
          vuln(e, 1.6, 3);
          sim.emit({ type: "state", id: e.id, state: "weak" });
        }
        return;
      }
      if (e.state === "weak") {
        e.mods.speed = 0.5;
        if ((e.stateT -= dt) <= 0) e.state = "move";
      }
      if ((b.guard -= dt) <= 0) {
        b.guard = 13;
        e.state = "guard";
        e.stateT = 4;
        sim.emit({ type: "state", id: e.id, state: "guard" });
        return;
      }
      if ((b.fire -= dt) <= 0) {
        b.fire = b.phase >= 2 ? 4 : 6;
        for (const d of [1.5, 3]) {
          const p = pathPoint(e, ahead(e, d));
          sim.addZone({ kind: "fire", x: p.x, z: p.z, r: 1.1, dur: 4, owner: e.id, max: 8, towerRate: 0.8 });
        }
      }
      if ((b.wave -= dt) <= 0) {
        b.wave = 9;
        sim.addMarker({
          kind: "ring",
          x: e.x,
          z: e.z,
          r: 3,
          dur: 1.4,
          color: 0xff6a1a,
          follow: e.id,
          blocking: true,
          done(sim, mk) {
            if (e.dead) return;
            sim.stunTowers(mk.x, mk.z, 3, 1.5, "magma");
            sim.emit({ type: "boom", x: mk.x, z: mk.z, r: 3, look: "magma" });
          },
        });
      }
    },
  },

  /* 화산왕 이그니스: 불 자국 · 돌진 뒤 폭발 · 2/3 이하 화산탄(타워 표시) · 각성은 1/3 이하 더 빠름 */
  ignis: {
    init(sim, e) {
      e.b = { phase: 1, trail: 1.5, charge: 5, meteor: 5 };
    },
    update(sim, e, dt) {
      const b = e.b;
      phaseCheck(sim, e, e.awakened ? [0.66, 0.33] : [0.66]);
      const fast = b.phase >= 3 ? 0.7 : 1;
      if ((b.trail -= dt) <= 0) {
        b.trail = 1.5;
        sim.addZone({ kind: "fire", x: e.x, z: e.z, r: 1.2, dur: 3.5, owner: e.id, max: 6, towerRate: 0.8 });
      }
      if (e.state === "chargeWarn") {
        e.mods.speed = 0.1;
        if ((e.stateT -= dt) <= 0) {
          e.state = "charge";
          e.stateT = 1.3;
        }
        return;
      }
      if (e.state === "charge") {
        e.mods.speed = 2.8;
        if ((e.stateT -= dt) <= 0) {
          e.state = "move";
          sim.stunTowers(e.x, e.z, 2.2, 1, "magma");
          sim.addZone({ kind: "fire", x: e.x, z: e.z, r: 1.6, dur: 4, owner: e.id, max: 6, towerRate: 0.8 });
          sim.emit({ type: "boom", x: e.x, z: e.z, r: 2.2, look: "magma" });
        }
        return;
      }
      if ((b.charge -= dt) <= 0 && e.path.length - e.s > 4) {
        b.charge = 8 * fast;
        e.state = "chargeWarn";
        e.stateT = 0.9;
        const p = pathPoint(e, ahead(e, 3.6));
        sim.addMarker({ kind: "line", x: e.x, z: e.z, x2: p.x, z2: p.z, r: 0.7, dur: 0.9, color: 0xff5a1a });
      }
      if (b.phase >= 2 && (b.meteor -= dt) <= 0) {
        b.meteor = 7 * fast;
        for (const c of towerCluster(sim, 2, 1.2)) {
          sim.addMarker({
            kind: "ring",
            x: c.x,
            z: c.z,
            r: 1.2,
            dur: 1.6,
            color: 0xff8a3a,
            blocking: true,
            done(sim) {
              sim.stunTowers(c.x, c.z, 1.2, 1.5, "magma");
              sim.emit({ type: "boom", x: c.x, z: c.z, r: 1.2, look: "meteor" });
            },
          });
        }
      }
    },
  },

  /* 어둠의 군주: 방어 자세(단단 · 느림) ↔ 공격 자세(빠름 · 그림자 군단 · 저주 구역) · 각성은 1/3 이하 공허 바람 */
  darkLord: {
    init(sim, e) {
      e.b = { phase: 1, stance: "guard", t: 6, curse: 4, summoned: 0 };
    },
    update(sim, e, dt) {
      const b = e.b;
      phaseCheck(sim, e, e.awakened ? [0.6, 0.3] : [0.5]);
      if ((b.t -= dt) <= 0) {
        b.stance = b.stance === "guard" ? "attack" : "guard";
        b.t = 6;
        sim.emit({ type: "state", id: e.id, state: b.stance });
        if (b.stance === "attack") {
          const cap = e.awakened ? 16 : 10;
          const list = ["shadowKnight", "slime", "slime"];
          if (b.phase >= 2) list.push("curseCaster");
          for (let i = 0; i < list.length && b.summoned < cap; i++, b.summoned++) spawnEnemyLater(sim, list[i], e, { s: Math.max(0, e.s - 0.6 - i * 0.4), lane: (i % 3 - 1) * 0.35, rewardMul: 0.5 });
        }
      }
      e.state = b.stance;
      if (b.stance === "guard") {
        e.mods.armor += 0.4;
        e.mods.speed *= 0.5;
      } else e.mods.speed *= 1.3;
      if (b.stance === "attack" && (b.curse -= dt) <= 0) {
        b.curse = 4;
        for (const c of towerCluster(sim, b.phase >= 2 ? 2 : 1, 1.8)) {
          sim.addMarker({
            kind: "ring",
            x: c.x,
            z: c.z,
            r: 1.8,
            dur: 1.2,
            color: 0xb46bff,
            blocking: true,
            done(sim) {
              sim.addZone({ kind: "curse", x: c.x, z: c.z, r: 1.8, dur: 5, owner: e.id, max: 6, dmg: 0.6 });
            },
          });
        }
      }
      if (e.awakened && b.phase >= 3)
        for (const o of sim.enemies) if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.z - e.z) < 3) o.st.rage = { speed: 1.25, leakAdd: 0, t: 0.3 };
    },
  },

  /* 그림자 까마귀 마왕 (최종): 날기 ↔ 착지 · 분신 · 둥지 공격(충전 중 피해를 주면 끊김) · 3 페이즈 */
  ravenKing: {
    init(sim, e) {
      e.b = { phase: 1, fly: 6, flying: false, clones: 4, strike: 8, curse: 6, storm: 9, cloneN: 0, guard: 0 };
    },
    update(sim, e, dt) {
      const b = e.b;
      if (phaseCheck(sim, e, [0.66, 0.33])) {
        if (b.phase === 3) sim.emit({ type: "finalPhase", id: e.id });
      }
      if (b.phase >= 3) e.mods.speed *= 1.2;
      // 둥지 공격: 충전 동안 최대 체력 4% 를 깎으면 끊김
      if (e.state === "strikeWarn") {
        e.mods.speed = 0;
        e.flying = false;
        if (e.maxHp * 0.04 <= b.strikeDmg) {
          e.state = "stagger";
          e.stateT = 2;
          vuln(e, 1.5, 2);
          sim.emit({ type: "interrupt", id: e.id });
          b.mark && (b.mark.cancel = true);
          return;
        }
        if ((e.stateT -= dt) <= 0) {
          e.state = "move";
          sim.hurtNest(3, e);
          sim.emit({ type: "nestStrike", id: e.id });
        }
        return;
      }
      if (e.state === "stagger") {
        e.mods.speed = 0;
        if ((e.stateT -= dt) <= 0) e.state = "move";
        return;
      }
      // 날기 ↔ 착지 (나는 동안은 하늘을 쏘는 타워만)
      if ((b.fly -= dt) <= 0) {
        b.flying = !b.flying;
        b.fly = b.flying ? (b.phase >= 2 ? 6 : 5) : 7;
        sim.emit({ type: "state", id: e.id, state: b.flying ? "fly" : "land" });
      }
      e.flying = b.flying;
      if ((b.clones -= dt) <= 0) {
        b.clones = 9;
        const alive = sim.enemies.filter((o) => o.parent === e.id && o.illusion && !o.dead && !o.leaked).length;
        const n = Math.min(b.phase >= 2 ? 3 : 2, 4 - alive);
        for (let i = 0; i < n; i++) spawnEnemyLater(sim, "crowClone", e, { s: Math.max(0, e.s + (i - 1) * 0.6), lane: (i - 1) * 0.4 });
        if (n > 0) sim.emit({ type: "clones", id: e.id });
      }
      if ((b.strike -= dt) <= 0 && !e.flying) {
        b.strike = b.phase >= 3 ? 10 : 14;
        e.state = "strikeWarn";
        e.stateT = 2.5;
        b.strikeDmg = 0;
        const n = sim.world.nest;
        b.mark = sim.addMarker({ kind: "nest", x: n.x, z: n.z, r: 1.6, dur: 2.5, color: 0xff3a6a });
        sim.emit({ type: "state", id: e.id, state: "strikeWarn" });
        return;
      }
      if (b.phase >= 2 && (b.curse -= dt) <= 0) {
        b.curse = 8;
        for (const t of sim.towers) if (Math.hypot(t.x - e.x, t.z - e.z) < 3) sim.debuffTower(t, "curse", 0.7, 4);
        sim.emit({ type: "pulse", id: e.id, r: 3, look: "curse" });
      }
      if (b.phase >= 3 && (b.storm -= dt) <= 0) {
        b.storm = 10;
        for (const t of sim.towers) sim.debuffTower(t, "curse", 0.8, 4);
        for (let i = 0; i < 2; i++) spawnEnemyLater(sim, "shadowKnight", e, { s: Math.max(0, e.s - 0.8 - i * 0.5), lane: i ? 0.3 : -0.3, rewardMul: 0.5 });
        sim.emit({ type: "shadowStorm", id: e.id });
      }
    },
    onDamage(sim, e, a) {
      if (e.state === "strikeWarn") e.b.strikeDmg = (e.b.strikeDmg || 0) + a;
    },
    death(sim, e) {
      sim.emit({ type: "finalDefeat", x: e.x, z: e.z });
    },
  },
};

function strongestTower(sim) {
  let best = null;
  for (const t of sim.towers) if (!best || t.spent > best.spent || (t.spent === best.spent && t.id < best.id)) best = t;
  return best;
}
