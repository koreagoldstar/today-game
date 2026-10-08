/*
 * 바다괴물 탐험대 · 괴물 (숨기 → 들킴 → 발견 → 활동 · 공격 → 도망 · 다시 숨기 → 포획)
 *
 * 상태: hidden(숨음) · emerge(나타나는 중) · active(활동) · flee(다른 곳으로 도망) · captured(잡힘)
 * 괴물마다 숨는 곳 · 들키는 몸짓(tell) · 나타나는 조건 · 움직임 · 공격 · 맞았을 때 반응 · 도망 규칙이 다르다 → BEH 표.
 * 그림 상태는 this.p (art/monsters*.js 가 읽는다).
 */
import { TAU, clamp, lerp, rand, pick, dist, sign } from "./view.js?v=1";
import { drawMonster } from "../art/registry.js?v=1";

/* ---------------- 공통 도우미 ---------------- */
function lookAt(m, tx, ty) {
  const dx = tx - m.x;
  const dy = ty - m.y;
  const d = Math.hypot(dx, dy) + 1;
  m.p.look.x = lerp(m.p.look.x, (dx / d) * m.face, 0.2);
  m.p.look.y = lerp(m.p.look.y, dy / d, 0.2);
}
function steer(m, tx, ty, speed, dt, acc = 4) {
  const dx = tx - m.x;
  const dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return d;
  m.vx += ((dx / d) * speed - m.vx) * Math.min(1, acc * dt);
  m.vy += ((dy / d) * speed - m.vy) * Math.min(1, acc * dt);
  return d;
}
function moveBy(m, dt, g, r = m.r * 0.8) {
  m.x += m.vx * dt;
  m.y += m.vy * dt;
  const hit = g.world.push(m, r);
  if (hit) {
    // 벽에 부딪히면 미끄러진다
    const dot = m.vx * hit.nx + m.vy * hit.ny;
    if (dot < 0) {
      m.vx -= dot * hit.nx;
      m.vy -= dot * hit.ny;
    }
  }
}
/** 비어 있는 다른 숨는 곳 (지혁에게서 멀리) */
function otherSpot(m, g, kinds) {
  const list = g.world.spots.filter((s) => kinds.includes(s.kind) && s !== m.spot && !s.monster);
  if (!list.length) return null;
  list.sort((a, b) => dist(b.hx, b.hy, g.player.x, g.player.y) - dist(a.hx, a.hy, g.player.x, g.player.y));
  // 가장 먼 몇 곳 중 하나 (너무 뻔하지 않게)
  return pick(list.slice(0, Math.min(3, list.length)));
}

/** 쌍둥이: 분신 둘을 만든다 (진짜와 똑같이 생겼지만 빛이 차갑다) */
function twinSplit(m, g, n = 2) {
  m.clones = [];
  for (let i = 0; i < n; i++) {
    const a = n === 2 ? (i ? 0 : Math.PI) : (i / n) * TAU + 0.5;
    const c = { x: m.x, y: m.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 200, on: true, face: m.face, p: { ...m.p, clone: 1, look: m.p.look, hit: 0, t: m.p.t + i + 1 } };
    m.clones.push(c);
  }
  g.fx.sparkle(m.x, m.y, 12, "#ffd0e8", 40);
  g.fx.spawn({ kind: "ring", x: m.x, y: m.y, r: 20, grow: 4, life: 0.45, c: "rgba(255,208,232,0.9)" });
  g.audio.play("swap");
}

/* ================================================================
 * 괴물별 행동
 * ============================================================== */
const BEH = {
  /* ---------- 01 산호문어: 산호처럼 위장 · 촉수 꼼지락 · 먹물 뿜고 다른 산호로 ---------- */
  coralOcto: {
    layer: "behind",
    hide(m) {
      m.p.camo = 1;
      m.x = m.spot.hx + rand(-24, 24);
      m.y = m.spot.hy + 22;
      m.offY = 0;
    },
    tell(m, k) {
      // 산호 위로 머리를 쏙 · 촉수 하나가 꼼지락
      const up = Math.sin(k * Math.PI);
      m.offY = -up * 26;
      m.p.tell = up;
      m.p.tellTent = m.tellN % 6;
      m.p.peek = k > 0.25 && k < 0.75 ? 0.8 : 0;
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.offY = -26 - k * 40;
      if (k >= 1) {
        m.y += m.offY;
        m.offY = 0;
      }
    },
    active(m, dt, g) {
      const pl = g.player;
      m.p.squish = Math.max(0, m.p.squish - dt * 2.2);
      m.jetT -= dt;
      if (m.jetT <= 0 && !m.atk) {
        m.jetT = rand(1.0, 1.8);
        // 집(산호) 근처, 너무 가까우면 거리 벌리기
        const d = dist(m.x, m.y, pl.x, pl.y);
        let tx = m.spot.hx + rand(-130, 130);
        let ty = m.spot.hy - rand(40, 150);
        if (d < 320 && Math.random() < 0.45) {
          // 장난치듯 지혁 쪽으로 슝
          tx = pl.x + rand(-80, 80);
          ty = pl.y + rand(-60, 40);
        } else if (d < 120) {
          tx = m.x + (m.x - pl.x) * 0.8;
          ty = m.y + (m.y - pl.y) * 0.8 - 30;
        }
        const dx = tx - m.x;
        const dy = ty - m.y;
        const dd = Math.hypot(dx, dy) + 1;
        m.vx = (dx / dd) * m.def.speed * 2.2;
        m.vy = (dy / dd) * m.def.speed * 2.2;
        m.p.squish = 1;
        g.fx.bubbles(m.x - (dx / dd) * 20, m.y + 18, 3, 6, 0.8);
      }
      const dr = Math.exp(-2.2 * dt);
      m.vx *= dr;
      m.vy *= dr;
      m.vy += Math.sin(m.p.t * 2) * 8 * dt;
      moveBy(m, dt, g);
    },
    strike(m, g) {
      // 촉수로 철썩 — 지혁 쪽으로 짧게 돌진
      const pl = g.player;
      const dx = pl.x - m.x;
      const dy = pl.y - m.y;
      const d = Math.hypot(dx, dy) + 1;
      m.vx = (dx / d) * 420;
      m.vy = (dy / d) * 420;
      m.p.squish = 1;
      m.hurtR = 44;
      m.hurtT = 0.28;
    },
    flee(m, g) {
      g.fx.ink(m.x, m.y, 1);
      g.audio.play("ink");
    },
    react(m) {
      m.p.squish = 0.8;
    },
  },

  /* ---------- 02 복어괴물: 바위 · 산호 뒤 · 가시가 삐죽 · 맞으면 빵빵 ---------- */
  puffer: {
    layer: "behind",
    hide(m) {
      m.x = m.spot.hx + rand(-10, 10);
      m.y = m.spot.hy + 10;
      m.p.camo = 0.8;
    },
    tell(m, k) {
      // 가리개 위로 머리 · 가시가 쏙
      m.p.peek = Math.sin(k * Math.PI);
      m.offY = -m.p.peek * 46;
      m.p.camo = 0.8 - m.p.peek * 0.6;
    },
    emerge(m, k) {
      m.offY = -46 - k * 50;
      m.p.camo = 0;
      m.p.peek = 1;
      if (k >= 1) {
        m.y += m.offY;
        m.offY = 0;
      }
    },
    active(m, dt, g) {
      const pl = g.player;
      m.p.inflate = Math.max(0, m.p.inflate - dt * (m.inflT > 0 ? 0 : 0.8));
      if (m.inflT > 0) m.inflT -= dt;
      m.r = m.def.r * (1 + m.p.inflate * 0.65);
      const d = dist(m.x, m.y, pl.x, pl.y);
      // 지혁 근처 140쯤에서 둥실둥실
      const want = 110 + Math.sin(m.p.t * 0.5) * 30;
      const ang = Math.atan2(m.y - pl.y, m.x - pl.x) + Math.sin(m.p.t * 0.6) * 0.6;
      const tx = pl.x + Math.cos(ang) * want;
      const ty = pl.y + Math.sin(ang) * want * 0.7 - 20;
      steer(m, tx, ty, m.def.speed * (1 - m.p.inflate * 0.6), dt, 1.6);
      m.vy += Math.sin(m.p.t * 2.4) * 30 * dt;
      moveBy(m, dt, g);
      // 부풀어 있을 때는 닿으면 따끔
      if (m.p.inflate > 0.55 && d < m.r + 22) m.contact = true;
      else m.contact = false;
    },
    strike(m, g) {
      m.p.inflate = 1;
      m.inflT = 1.2;
      m.hurtR = m.def.r * 1.9;
      m.hurtT = 0.3;
      g.audio.play("puff");
    },
    react(m, g) {
      m.p.inflate = 1;
      m.inflT = 2.2;
      if (m.puffN++ % 3 === 0) g.audio.play("puff");
    },
  },

  /* ---------- 03 바위게: 바위인 척 · 눈자루 쏙 · 일어나 옆걸음 · 모래 속으로 도망 ---------- */
  rockCrab: {
    layer: "front",
    hide(m) {
      m.p.camo = 1;
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.groundY = m.spot.hy;
    },
    tell(m, k) {
      m.p.peek = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
    },
    active(m, dt, g) {
      const pl = g.player;
      // 바닥(또는 턱) 높이를 따라 옆으로 다닌다
      const onBed = Math.abs(m.spot.y - g.world.bedY(m.spot.x)) < 40;
      m.walkT -= dt;
      if (m.walkT <= 0 && !m.atk) {
        m.walkT = rand(0.5, 1.1);
        const toward = Math.random() < 0.7 ? sign(pl.x - m.x) : -sign(pl.x - m.x);
        m.walkDir = toward || 1;
        m.walkV = rand(0.7, 1.1) * m.def.speed;
      }
      let vx = m.atk ? 0 : m.walkDir * m.walkV;
      const minX = onBed ? g.world.wallL(m.y) + 50 : m.spot.x - 90;
      const maxX = onBed ? g.world.wallR(m.y) - 50 : m.spot.x + 90;
      if (m.x < minX + 10) m.walkDir = 1;
      if (m.x > maxX - 10) m.walkDir = -1;
      m.vx += (vx - m.vx) * Math.min(1, 8 * dt);
      m.x = clamp(m.x + m.vx * dt, minX, maxX);
      const gy = onBed ? g.world.bedY(m.x) - 16 : m.groundY;
      m.y += (gy - m.y) * Math.min(1, 10 * dt);
      m.p.walk = Math.min(1, Math.abs(m.vx) / 60);
      m.face = pl.x >= m.x ? 1 : -1;
      if (Math.abs(m.vx) > 40 && Math.random() < dt * 6) g.fx.dust(m.x, m.y + 18, 0.3);
    },
    strike(m, g) {
      m.p.snap = 0.25;
      m.x += sign(g.player.x - m.x) * 34;
      m.hurtR = 58;
      m.hurtT = 0.22;
      g.audio.play("snap");
    },
    flee(m, g) {
      g.fx.dust(m.x, m.y + 16, 1.4);
      g.audio.play("burrow");
      m.burrow = true;
    },
    react(m) {
      m.vx -= m.face * 60;
    },
  },

  /* ---------- 04 조개괴물: 꼭 닫힘 · 살짝 열리며 기포 · 열렸을 때만 맞음 · 진주 발사 ---------- */
  clam: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.open = 0;
      m.p.camo = 1;
    },
    tell(m, k, g) {
      m.p.peek = Math.sin(k * Math.PI);
      if (Math.random() < 0.08) g.fx.bubbles(m.x + 20 * m.face, m.y - 8, 1, 4, 0.7);
    },
    emerge(m, k) {
      m.p.open = k;
      m.p.camo = 0;
      m.y = m.spot.hy - Math.sin(k * Math.PI) * 18;
    },
    active(m, dt, g) {
      const pl = g.player;
      m.face = pl.x >= m.x ? 1 : -1;
      m.cyc -= dt;
      const fast = m.hp < m.maxHp * 0.5 ? 0.75 : 1;
      if (m.phase === "open") {
        m.p.open = Math.min(1, m.p.open + dt * 5);
        if (m.cyc <= 0 && !m.atk) {
          m.phase = "closed";
          m.cyc = rand(1.1, 1.6) * fast;
          g.audio.play("clamShut");
        }
      } else {
        m.p.open = Math.max(0, m.p.open - dt * 7);
        // 닫혀 있는 동안 통통 뛴다
        m.hop = (m.hop || 0) + dt * 4;
        m.y = m.spot.hy - Math.abs(Math.sin(m.hop)) * 10;
        if (m.cyc <= 0) {
          m.phase = "open";
          m.cyc = rand(1.8, 2.4) / fast;
          m.p.spat = false;
          m.atkCd = Math.min(m.atkCd, 0.3);
        }
      }
      m.armor = m.p.open < 0.35;
    },
    canAttack(m) {
      return m.phase === "open" && m.p.open > 0.8 && !m.p.spat;
    },
    strike(m, g) {
      const pl = g.player;
      const ang = Math.atan2(pl.y - (m.y - 10), pl.x - m.x);
      g.shoot({ kind: "pearl", x: m.x + Math.cos(ang) * 20, y: m.y - 10 + Math.sin(ang) * 20, vx: Math.cos(ang) * 270, vy: Math.sin(ang) * 270, r: 9, dmg: m.def.atk.dmg, life: 2.4 });
      m.p.spat = true;
      g.audio.play("spit");
    },
    react(m) {
      m.p.open = Math.max(0.5, m.p.open - 0.25);
    },
  },

  /* ---------- 05 산호곰치: 벽 구멍 · 머리 쏙 · 앞을 지나가면 덥석 ---------- */
  reefEel: {
    layer: "hole",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.face = m.spot.side < 0 ? 1 : -1;
      m.p.out = 0;
      m.phase = "in";
      m.cyc = rand(1.2, 2.2);
    },
    tell(m, k) {
      m.p.out = Math.sin(k * Math.PI) * 0.32;
    },
    emerge(m, k) {
      m.p.out = 0.35 + k * 0.3;
    },
    active(m, dt, g) {
      const pl = g.player;
      // 머리 위치 (맞는 곳)
      const dir = m.face;
      m.cyc -= dt;
      const inFront = (pl.x - m.spot.hx) * dir > 20 && Math.abs(pl.y - m.spot.hy) < 140 && dist(pl.x, pl.y, m.spot.hx, m.spot.hy) < m.def.atk.range + 40;
      if (m.phase === "in") {
        m.p.out = Math.max(0, m.p.out - dt * 4);
        if (m.cyc <= 0) {
          m.phase = "peek";
          m.cyc = rand(1.0, 1.6);
        }
      } else if (m.phase === "peek") {
        m.p.out += (0.42 - m.p.out) * Math.min(1, dt * 6);
        if (inFront && m.atkCd <= 0 && !m.atk) m.startAttack(g);
        if (m.cyc <= 0 && !m.atk) {
          m.phase = "in";
          m.cyc = rand(1.0, 2.0);
        }
      } else if (m.phase === "out") {
        m.p.out = Math.min(1, m.p.out + dt * 9);
        m.p.bite = Math.max(0, m.p.bite - dt * 3);
        if (m.cyc <= 0) {
          m.phase = "in";
          m.cyc = rand(1.2, 2.0);
        }
      }
      // 맞는 범위는 머리를 따라 움직인다
      const reach = (20 + m.p.out * 92) * (m.p.s || 1);
      m.hx = m.spot.hx + dir * reach;
      m.hy = m.spot.hy;
      m.armor = m.p.out < 0.2;
    },
    canAttack() {
      return false; // peek 단계에서 직접 시작한다
    },
    windUp(m) {
      m.p.out += (0.5 - m.p.out) * 0.2;
    },
    strike(m, g) {
      m.phase = "out";
      m.cyc = 0.7;
      m.p.bite = 1;
      m.hurtR = 40;
      m.hurtT = 0.25;
      m.hurtAt = () => ({ x: m.spot.hx + m.face * 105, y: m.spot.hy });
      g.audio.play("chomp");
    },
    react(m) {
      m.phase = "in";
      m.cyc = rand(0.8, 1.3);
    },
  },

  /* ---------- 06 해초상어: 해초 덤불 · 꼬리만 살랑 · 들키면 쏜살같이 다른 덤불로 ---------- */
  kelpShark: {
    layer: "behind",
    hide(m) {
      m.x = m.spot.hx + rand(-16, 16);
      m.y = m.spot.hy + 6;
      m.offX = 0;
      m.p.fast = 0;
    },
    tell(m, k) {
      // 덤불 옆으로 꼬리가 삐죽 · 살랑살랑
      const out = Math.sin(k * Math.PI);
      m.offX = -m.face * out * 54;
      m.p.fast = out;
    },
    emerge(m, k, g) {
      m.offX = 0;
      m.p.fast = 1;
      if (k >= 1 && !m.bolted) {
        // 처음 들키면 싸우지 않고 도망 (추적!)
        m.bolted = true;
        m.startFlee(g, true);
      }
    },
    active(m, dt, g) {
      const pl = g.player;
      m.p.fast = Math.max(0, m.p.fast - dt);
      m.p.bite = Math.max(0, (m.p.bite || 0) - dt * 3);
      // 지혁 둘레를 빙빙 돌며 기회를 본다
      m.orbit = (m.orbit || Math.random() * 6) + dt * 0.9;
      const tx = pl.x + Math.cos(m.orbit) * 190;
      const ty = pl.y + Math.sin(m.orbit) * 110;
      if (!m.atk) steer(m, tx, ty, m.def.speed, dt, 2.4);
      else {
        m.vx *= Math.exp(-3 * dt);
        m.vy *= Math.exp(-3 * dt);
      }
      moveBy(m, dt, g);
      m.face = (m.atk ? pl.x - m.x : m.vx) >= 0 ? 1 : -1;
    },
    strike(m, g) {
      const pl = g.player;
      const dx = pl.x - m.x;
      const dy = pl.y - m.y;
      const d = Math.hypot(dx, dy) + 1;
      m.vx = (dx / d) * 560;
      m.vy = (dy / d) * 560;
      m.p.bite = 1;
      m.p.fast = 1;
      m.hurtR = 46;
      m.hurtT = 0.32;
      g.audio.play("chomp");
    },
    flee(m, g) {
      g.fx.bubbles(m.x, m.y, 10, 20);
      m.p.fast = 1;
    },
    react(m) {
      m.vx -= m.face * 120;
    },
  },

  /* ---------- 07 미역괴물: 미역인 척 · 지나가면 뒤에서 살금살금 따라온다 ---------- */
  weedMonster: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy - 56;
      m.p.camo = 1;
      m.p.lean = 0;
      m.stalk = false;
    },
    tell(m, k) {
      m.p.tell = k > 0.1 && k < 0.9 ? 1 : 0;
      m.p.peek = k > 0.35 && k < 0.65 ? 0.6 : 0;
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
    },
    active(m, dt, g) {
      const pl = g.player;
      // 지혁 '등 뒤' 120 쯤을 따라다닌다
      const bx = pl.x - pl.face * 130;
      const by = pl.y - 10 + Math.sin(m.p.t * 1.7) * 20;
      if (!m.atk) steer(m, bx, by, m.def.speed, dt, 2);
      else {
        m.vx *= Math.exp(-4 * dt);
        m.vy *= Math.exp(-4 * dt);
      }
      moveBy(m, dt, g, 24);
      m.p.lean = Math.max(-1, Math.min(1, m.vx / 120));
      m.face = pl.x >= m.x ? 1 : -1;
      // 지혁이 돌아보면 들킨다 → 그때 '발견'
      const facing = (m.x - pl.x) * pl.face > 0;
      if (!m.found && facing && dist(m.x, m.y, pl.x, pl.y) < 260) g.onReveal(m, "seen");
    },
    strike(m, g) {
      m.hurtR = 56;
      m.hurtT = 0.3;
      m.vx = (g.player.x - m.x) * 3;
      m.vy = (g.player.y - m.y) * 3;
      g.audio.play("snap");
    },
    react(m) {
      m.vx += -m.face * 140;
    },
  },

  /* ---------- 08 성게돌이: 가시 바위인 척 · 바닥을 데굴데굴 ---------- */
  urchin: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy - 4;
      m.p.camo = 1;
      m.p.rot = 0;
    },
    tell(m, k) {
      m.p.peek = k > 0.2 && k < 0.8 ? 0.8 : 0;
      m.p.curl = Math.sin(k * Math.PI) * 0.6;
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.y = m.spot.hy - 4 - Math.sin(k * Math.PI) * 30;
    },
    active(m, dt, g) {
      const pl = g.player;
      m.p.curl = Math.max(0, (m.p.curl || 0) - dt * 2);
      const onBed = Math.abs(m.spot.y - g.world.bedY(m.spot.x)) < 50;
      const gy = onBed ? g.world.bedY(m.x) - 26 : m.spot.hy - 4;
      if (!m.atk) {
        const want = Math.sign(pl.x - m.x) * m.def.speed * (Math.abs(pl.x - m.x) > 60 ? 1 : 0.2);
        m.vx += (want - m.vx) * Math.min(1, 2 * dt);
      }
      m.vx *= Math.exp(-0.6 * dt);
      const minX = onBed ? g.world.wallL(m.y) + 40 : m.spot.x - 100;
      const maxX = onBed ? g.world.wallR(m.y) - 40 : m.spot.x + 100;
      m.x = Math.max(minX, Math.min(maxX, m.x + m.vx * dt));
      if (m.x <= minX || m.x >= maxX) m.vx *= -0.6;
      m.y += (gy - Math.abs(Math.sin(m.p.t * 5)) * Math.min(20, Math.abs(m.vx) * 0.06) - m.y) * Math.min(1, 12 * dt);
      m.p.rot = (m.p.rot || 0) + (m.vx / 30) * dt;
      m.contact = Math.abs(m.vx) > 90;
      if (Math.abs(m.vx) > 100 && Math.random() < dt * 8) g.fx.dust(m.x, m.y + 24, 0.3);
    },
    windUp(m) {
      m.p.rot += Math.sin(m.p.t * 40) * 0.05;
    },
    strike(m, g) {
      m.vx = Math.sign(g.player.x - m.x) * 420;
      g.audio.play("burrow");
    },
    react(m) {
      m.p.curl = 1;
      m.vx = -m.vx * 0.5;
    },
  },

  /* ---------- 09 해마기사: 해초에 꼬리를 감고 숨음 · 창처럼 돌진 ---------- */
  seahorse: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx + 10;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.p.charge = 0;
    },
    tell(m, k) {
      m.p.peek = k > 0.2 && k < 0.8 ? 0.8 : 0;
      m.offY = -Math.sin(k * Math.PI) * 6;
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.offY = -k * 20;
      if (k >= 1) {
        m.y += m.offY;
        m.offY = 0;
      }
    },
    active(m, dt, g) {
      const pl = g.player;
      if (m.chargeT > 0) {
        m.chargeT -= dt;
        m.p.charge = 1;
        if (m.chargeT <= 0) m.p.charge = 0;
      } else if (!m.atk) {
        const ang = Math.atan2(m.y - pl.y, m.x - pl.x);
        steer(m, pl.x + Math.cos(ang) * 170, pl.y + Math.sin(ang) * 120 - 20, m.def.speed, dt, 2);
        m.vy += Math.sin(m.p.t * 3) * 40 * dt;
      } else {
        m.vx *= Math.exp(-5 * dt);
        m.vy *= Math.exp(-5 * dt);
      }
      moveBy(m, dt, g);
      m.face = (m.chargeT > 0 ? m.vx : pl.x - m.x) >= 0 ? 1 : -1;
    },
    strike(m, g) {
      const pl = g.player;
      const dx = pl.x - m.x;
      const dy = pl.y - m.y;
      const d = Math.hypot(dx, dy) + 1;
      m.vx = (dx / d) * 600;
      m.vy = (dy / d) * 600;
      m.chargeT = 0.4;
      m.hurtR = 40;
      m.hurtT = 0.4;
      g.audio.play("escape");
    },
    flee(m, g) {
      g.fx.bubbles(m.x, m.y, 8, 14);
    },
    react(m) {
      m.vx -= m.face * 100;
    },
  },

  /* ---------- 10 보물상자괴물: 가짜 상자들 사이 · 혀 날름 · 열렸을 때만 맞음 · 금화 뱉기 ---------- */
  chestMimic: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.open = 0;
      m.p.camo = 1;
      m.baseY = m.spot.hy;
    },
    tell(m, k, g) {
      m.p.peek = k > 0.15 && k < 0.85 ? 1 : 0;
      if (Math.random() < 0.05) g.fx.sparkle(m.x + 20, m.y - 30, 1, "#ffe14a", 6);
    },
    emerge(m, k) {
      m.p.open = k;
      m.p.camo = 0;
      m.y = m.baseY - Math.sin(k * Math.PI) * 26;
    },
    active(m, dt, g) {
      const pl = g.player;
      m.face = pl.x >= m.x ? 1 : -1;
      m.cyc -= dt;
      // 깡총깡총 지혁 쪽으로 (자기 방 안에서만)
      m.hop = (m.hop || 0) + dt * 3.2;
      const [x0, x1] = m.spot.patrol;
      if (!m.atk) m.x = Math.max(x0, Math.min(x1, m.x + Math.sign(pl.x - m.x) * 70 * dt));
      m.y = m.baseY - Math.abs(Math.sin(m.hop)) * 16;
      if (m.phase === "open") {
        m.p.open = Math.min(1, m.p.open + dt * 5);
        if (m.cyc <= 0 && !m.atk) {
          m.phase = "closed";
          m.cyc = rand(1.0, 1.5);
          g.audio.play("clamShut");
        }
      } else {
        m.p.open = Math.max(0, m.p.open - dt * 6);
        if (m.cyc <= 0) {
          m.phase = "open";
          m.cyc = rand(1.8, 2.4);
          m.atkCd = Math.min(m.atkCd, 0.4);
        }
      }
      m.armor = m.p.open < 0.35;
    },
    canAttack(m) {
      return m.phase === "open" && m.p.open > 0.8;
    },
    strike(m, g) {
      const pl = g.player;
      const d = dist(m.x, m.y, pl.x, pl.y);
      if (d < 110) {
        // 와앙 물기
        m.x += Math.sign(pl.x - m.x) * 30;
        m.hurtR = 50;
        m.hurtT = 0.25;
        g.audio.play("chomp");
      } else {
        // 금화 세 개 뱉기
        const ang = Math.atan2(pl.y - (m.y - 20), pl.x - m.x);
        for (const da of [-0.22, 0, 0.22]) g.shoot({ kind: "coin", x: m.x + Math.cos(ang) * 24, y: m.y - 20, vx: Math.cos(ang + da) * 250, vy: Math.sin(ang + da) * 250, r: 8, dmg: 3, life: 2.2 });
        g.audio.play("spit");
      }
    },
    react(m) {
      m.p.open = Math.max(0.5, m.p.open - 0.2);
    },
  },

  /* ---------- 11 창문눈알: 둥근 창에 눈만 보였다가 다른 창으로 ---------- */
  porthole: {
    layer: "hole",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.vis = 0;
      m.awayT = rand(0.8, 2.2);
      m.showT = 0;
    },
    tell(m, k, g) {
      // 숨은 동안 '텔' = 창에 잠깐 나타나기 (가끔 다른 창으로 옮긴다)
      m.p.vis = k < 0.2 ? k / 0.2 : k > 0.8 ? (1 - k) / 0.2 : 1;
      if (k > 0.95 && Math.random() < 0.35) m.hop(g);
    },
    emerge(m, k) {
      m.p.vis = 1;
    },
    active(m, dt, g) {
      if (m.showT > 0) {
        m.showT -= dt;
        m.p.vis = Math.min(1, m.p.vis + dt * 6);
        if (m.showT <= 0 && !m.atk) m.awayT = rand(0.8, 1.3);
      } else {
        m.p.vis = Math.max(0, m.p.vis - dt * 6);
        m.awayT -= dt;
        if (m.awayT <= 0) {
          if (Math.random() < 0.6) m.hop(g);
          m.showT = rand(2.6, 3.4);
          m.atkCd = Math.min(m.atkCd, 0.8);
        }
      }
      m.armor = m.p.vis < 0.5;
    },
    canAttack(m) {
      return m.p.vis > 0.9 && m.showT > 0.6;
    },
    strike(m, g) {
      // 창 밖으로 먹물 공
      const pl = g.player;
      const ang = Math.atan2(pl.y - m.y, pl.x - m.x);
      g.shoot({ kind: "ink", x: m.x + Math.cos(ang) * 30, y: m.y + Math.sin(ang) * 30, vx: Math.cos(ang) * 240, vy: Math.sin(ang) * 240, r: 10, dmg: 4, life: 2.4 });
      g.audio.play("spit");
    },
    flee(m, g) {
      m.p.vis = 0;
    },
    react(m) {
      m.showT = Math.min(m.showT, 0.5);
    },
  },

  /* ---------- 12 닻게: 닻 밑에 숨음 · 등(닻)은 단단 · 닻 휘두르기 ---------- */
  anchorCrab: {
    layer: "front",
    hide(m) {
      m.p.camo = 1;
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.groundY = m.spot.hy;
    },
    tell(m, k) {
      m.p.peek = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
    },
    active(m, dt, g) {
      const pl = g.player;
      m.walkT -= dt;
      if (m.walkT <= 0 && !m.atk) {
        m.walkT = rand(0.6, 1.2);
        m.walkDir = Math.random() < 0.65 ? Math.sign(pl.x - m.x) || 1 : -Math.sign(pl.x - m.x) || 1;
        m.walkV = rand(0.6, 1) * m.def.speed;
      }
      const [x0, x1] = m.spot.patrol;
      const vx = m.atk ? 0 : m.walkDir * m.walkV;
      m.vx += (vx - m.vx) * Math.min(1, 8 * dt);
      m.x = Math.max(x0, Math.min(x1, m.x + m.vx * dt));
      if (m.x <= x0 + 2) m.walkDir = 1;
      if (m.x >= x1 - 2) m.walkDir = -1;
      m.y += (m.groundY - m.y) * Math.min(1, 10 * dt);
      m.p.walk = Math.min(1, Math.abs(m.vx) / 60);
      // 닻 쪽(등)은 늘 지혁 반대편 — 앞을 노려야 한다
      if (!m.atk) m.face = pl.x >= m.x ? 1 : -1;
      m.p.swing = Math.max(0, (m.p.swing || 0) - dt * 2.5);
    },
    windUp(m) {
      m.p.swing = -0.25 * m.p.wind;
    },
    strike(m, g) {
      m.p.swing = 1;
      m.hurtR = 74;
      m.hurtT = 0.3;
      m.hurtAt = () => ({ x: m.x + m.face * 46, y: m.y - 24 });
      g.audio.play("snap");
    },
    flee(m, g) {
      g.fx.bubbles(m.x, m.y, 8, 14);
    },
    react(m) {
      m.vx -= m.face * 80;
    },
    /** 뒤에서(닻 쪽) 맞으면 '팅' */
    blocks(m, dir) {
      return Math.cos(dir) * m.face > 0.3;
    },
  },

  /* ---------- 14 동굴눈물고기: 어둠 속 빛나는 두 눈 · 헤드램프로 비추면 발견 ---------- */
  caveFish: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.glow = 60;
    },
    tell(m, k) {
      m.p.blink = k > 0.3 && k < 0.42;
      m.offY = Math.sin(k * Math.PI * 2) * 4;
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.fast = 1;
    },
    active(m, dt, g) {
      const pl = g.player;
      m.glow = 70;
      m.p.fast = Math.max(0, (m.p.fast || 0) - dt);
      m.dartT = (m.dartT || 0) - dt;
      if (m.dartT <= 0 && !m.atk) {
        m.dartT = rand(0.6, 1.2);
        const a = rand(0, Math.PI * 2);
        const tx = pl.x + Math.cos(a) * 180;
        const ty = pl.y + Math.sin(a) * 120;
        const dx = tx - m.x;
        const dy = ty - m.y;
        const d = Math.hypot(dx, dy) + 1;
        m.vx = (dx / d) * m.def.speed * 1.6;
        m.vy = (dy / d) * m.def.speed * 1.6;
        m.p.fast = 0.6;
      }
      m.vx *= Math.exp(-2 * dt);
      m.vy *= Math.exp(-2 * dt);
      moveBy(m, dt, g);
      m.face = (m.atk ? pl.x - m.x : m.vx) >= 0 ? 1 : -1;
    },
    strike(m, g) {
      const pl = g.player;
      const dx = pl.x - m.x;
      const dy = pl.y - m.y;
      const d = Math.hypot(dx, dy) + 1;
      m.vx = (dx / d) * 520;
      m.vy = (dy / d) * 520;
      m.hurtR = 36;
      m.hurtT = 0.3;
      g.audio.play("chomp");
    },
    flee(m, g) {
      g.fx.bubbles(m.x, m.y, 8, 12);
    },
    react(m) {
      m.vx -= m.face * 120;
    },
  },

  /* ---------- 13 그늘가오리: 빛을 피한다 · 어둠 속에서 슬금슬금 ---------- */
  shadeRay: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.home = { x: m.spot.hx, y: m.spot.hy };
    },
    tell(m, k) {
      m.p.peek = k > 0.3 && k < 0.7 ? 0.7 : 0;
      m.p.fast = Math.sin(k * Math.PI);
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
    },
    active(m, dt, g) {
      const pl = g.player;
      const lit = g.inLight(m.x, m.y);
      m.p.shy = lit ? Math.min(1, (m.p.shy || 0) + dt * 4) : Math.max(0, (m.p.shy || 0) - dt * 2);
      if (lit && !m.atk) {
        // 눈부셔! 빛 밖으로 미끄러진다
        const ang = Math.atan2(m.y - pl.y, m.x - pl.x);
        const side = Math.sin(pl.aim - ang) > 0 ? -1 : 1;
        const fx = Math.cos(ang + side * 1.2);
        const fy = Math.sin(ang + side * 1.2);
        steer(m, m.x + fx * 200, m.y + fy * 200, m.def.speed * 1.5, dt, 3);
        m.p.fast = 1;
      } else if (!m.atk) {
        // 어둠 속에서 지혁 뒤쪽으로 슬금슬금
        const bx = pl.x - pl.face * 210;
        const by = pl.y + Math.sin(m.p.t * 0.8) * 60;
        steer(m, bx, by, m.def.speed * 0.8, dt, 1.4);
        m.p.fast = 0;
      } else {
        m.vx *= Math.exp(-4 * dt);
        m.vy *= Math.exp(-4 * dt);
      }
      moveBy(m, dt, g, 36);
      m.face = (m.atk ? pl.x - m.x : m.vx) >= 0 ? 1 : -1;
    },
    strike(m, g) {
      m.hurtR = 64;
      m.hurtT = 0.3;
      m.hurtAt = () => ({ x: m.x - m.face * 70, y: m.y });
      m.face = -m.face;
      g.audio.play("snap");
    },
    flee(m, g) {
      g.fx.bubbles(m.x, m.y, 10, 20);
    },
    react(m) {
      m.vx -= m.face * 100;
    },
  },

  /* ---------- 15 돌얼굴: 벽의 얼굴 무늬 · 입이 열리면 돌을 뱉는다 · 벽 속으로 옮겨 감 ---------- */
  stoneFace: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.p.open = 0;
      m.phase = "closed";
      m.cyc = 1;
    },
    tell(m, k, g) {
      m.p.peek = k > 0.3 && k < 0.7 ? 0.8 : 0;
      if (Math.random() < 0.1) g.fx.dust(m.x, m.y + 40, 0.3);
    },
    emerge(m, k, g) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      if (Math.random() < 0.4) g.fx.dust(m.x + rand(-40, 40), m.y + rand(-50, 50), 0.4);
    },
    active(m, dt, g) {
      m.cyc -= dt;
      if (m.phase === "open") {
        m.p.open = Math.min(1, m.p.open + dt * 4);
        if (m.cyc <= 0 && !m.atk) {
          m.phase = "closed";
          m.cyc = rand(1.3, 2.0);
          g.audio.play("clamShut");
        }
      } else {
        m.p.open = Math.max(0, m.p.open - dt * 5);
        if (m.cyc <= 0) {
          m.phase = "open";
          m.cyc = rand(1.8, 2.4);
          m.atkCd = Math.min(m.atkCd, 0.35);
        }
      }
      m.armor = m.p.open < 0.35;
    },
    canAttack(m) {
      return m.phase === "open" && m.p.open > 0.8;
    },
    strike(m, g) {
      const pl = g.player;
      const ang = Math.atan2(pl.y - (m.y + 34), pl.x - m.x);
      for (const da of [-0.28, 0, 0.28]) g.shoot({ kind: "rock", x: m.x + Math.cos(ang) * 30, y: m.y + 34 + Math.sin(ang) * 30, vx: Math.cos(ang + da) * 260, vy: Math.sin(ang + da) * 260, r: 10, dmg: 5, life: 2.4 });
      g.audio.play("spit");
      g.fx.dust(m.x, m.y + 40, 0.6);
    },
    flee(m, g) {
      g.fx.dust(m.x, m.y, 1.6);
      g.audio.play("burrow");
      m.burrow = true;
    },
    react(m) {
      m.p.open = Math.max(0.5, m.p.open - 0.2);
    },
  },

  /* ================= 05 해파리 계곡 ================= */
  /* ---------- 16 해파리괴물: 빛나는 해파리 무리 속 · 혼자 박자가 다르게 깜빡 ---------- */
  jellyMonster: {
    layer: "front",
    hide(m) {
      const sp = m.spot;
      const a = rand(0, TAU);
      m.x = sp.hx + Math.cos(a) * 40;
      m.y = sp.hy + Math.sin(a) * 30;
      m.p.camo = 1;
      m.p.peek = 0;
      m.glow = 70;
    },
    tell(m, k, g) {
      // 다른 해파리와 박자가 어긋나게 '움찔' · 보랏빛이 번쩍 · 눈이 슬쩍
      m.p.flick = k > 0.15 && k < 0.85 ? 1 : 0;
      m.p.peek = k > 0.35 && k < 0.65 ? 0.8 : 0;
      m.offY = -Math.sin(k * Math.PI) * 16;
      if (k > 0.4 && k < 0.45 && Math.random() < 0.5) g.fx.sparkle(m.x, m.y + 20, 2, "#fff36a", 12);
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.p.flick = 0;
      m.offY = -k * 20;
      if (k >= 1) {
        m.y += m.offY;
        m.offY = 0;
      }
    },
    active(m, dt, g) {
      const pl = g.player;
      m.glow = 90;
      // 해파리처럼 '퐁' 하고 밀었다가 둥실 (지혁 쪽으로)
      m.jetT -= dt;
      if (m.jetT <= 0 && !m.atk) {
        m.jetT = rand(0.9, 1.4);
        const d = dist(m.x, m.y, pl.x, pl.y);
        const tx = pl.x + rand(-140, 140);
        const ty = pl.y - rand(60, 160);
        const dx = tx - m.x;
        const dy = ty - m.y;
        const dd = Math.hypot(dx, dy) + 1;
        const sp = m.def.speed * (d > 260 ? 2 : 1.3);
        m.vx = (dx / dd) * sp;
        m.vy = (dy / dd) * sp;
        m.p.pulse = 1;
      }
      m.p.pulse = Math.max(0, (m.p.pulse || 0) - dt * 2.5);
      m.vx *= Math.exp(-1.6 * dt);
      m.vy *= Math.exp(-1.6 * dt);
      m.vy += 14 * dt;
      moveBy(m, dt, g);
    },
    windUp(m) {
      m.vx *= 0.9;
      m.vy *= 0.9;
    },
    strike(m, g) {
      // 촉수에서 찌릿! 둥근 전기
      m.hurtR = 96;
      m.hurtT = 0.3;
      m.zapT = 0.35;
      g.fx.spawn({ kind: "ring", x: m.x, y: m.y + 10, r: 30, grow: 2.4, life: 0.35, c: "rgba(255,243,106,0.95)" });
      g.fx.sparkle(m.x, m.y + 20, 10, "#fff36a", 60);
      g.audio.play("zap");
    },
    flee(m, g) {
      g.fx.sparkle(m.x, m.y, 8, "#c58bff", 30);
      g.fx.bubbles(m.x, m.y, 8, 16);
    },
    react(m) {
      m.p.pulse = 1;
      m.vy -= 40;
    },
  },

  /* ---------- 17 전기뱀장어: 바위 틈 불꽃 · 헤엄쳐 나와 몸에 전기를 모았다가 번쩍 ---------- */
  zapEel: {
    layer: "behind",
    hide(m) {
      const sp = m.spot;
      m.face = sp.side < 0 ? 1 : -1;
      m.x = sp.hx - m.face * 8;
      m.y = sp.hy;
      m.p.out = 0;
      m.p.camo = 1;
      m.glow = 0;
    },
    tell(m, k, g) {
      // 틈 밖으로 불꽃 · 머리가 쏙
      m.p.out = Math.sin(k * Math.PI) * 0.18;
      m.p.peek = k > 0.3 && k < 0.7 ? 1 : 0;
      if (Math.random() < 0.35) g.fx.spawn({ kind: "spark", x: m.spot.hx + m.face * rand(10, 40), y: m.spot.hy + rand(-16, 16), vx: m.face * rand(40, 140), vy: rand(-80, 80), r: rand(3, 5), life: 0.3, drag: 4, c: "#fff36a" });
      m.glow = 50 * Math.sin(k * Math.PI);
    },
    emerge(m, k) {
      // 틈에서 쭉 헤엄쳐 나온다
      m.p.camo = 0;
      m.p.peek = 1;
      m.p.out = k;
      m.x = m.spot.hx + m.face * k * 90;
      m.glow = 60;
    },
    active(m, dt, g) {
      const pl = g.player;
      m.glow = 60 + (m.p.wind || 0) * 120;
      if (!m.atk) {
        // 지혁 둘레를 물결치듯 빙 돈다
        if (m.orb == null) {
          m.orb = Math.atan2(m.y - pl.y, m.x - pl.x);
          m.dirO = Math.random() < 0.5 ? 1 : -1;
        }
        m.orb += dt * 0.9 * m.dirO;
        const tx = pl.x + Math.cos(m.orb) * 230;
        const ty = pl.y + Math.sin(m.orb) * 150 + Math.sin(m.p.t * 3) * 30;
        steer(m, tx, ty, m.def.speed, dt, 2.2);
      } else {
        m.vx *= Math.exp(-5 * dt);
        m.vy *= Math.exp(-5 * dt);
      }
      moveBy(m, dt, g, 30);
      m.face = (m.atk ? pl.x - m.x : m.vx) >= 0 ? 1 : -1;
    },
    windUp(m, g) {
      if (Math.random() < 0.3) g.fx.sparkle(m.x + rand(-60, 60), m.y + rand(-10, 10), 1, "#fff36a", 6);
    },
    strike(m, g) {
      m.hurtR = 150;
      m.hurtT = 0.3;
      m.orb = null;
      g.fx.spawn({ kind: "ring", x: m.x, y: m.y, r: 40, grow: 2.7, life: 0.35, c: "rgba(255,243,106,1)" });
      g.fx.spawn({ kind: "ring", x: m.x, y: m.y, r: 30, grow: 4, life: 0.45, c: "rgba(200,160,255,0.8)" });
      g.fx.sparkle(m.x, m.y, 14, "#fff36a", 120);
      g.fx.flash(0.15, "#fff6c0");
      g.audio.play("zap");
    },
    flee(m, g) {
      g.fx.sparkle(m.x, m.y, 8, "#fff36a", 30);
    },
    react(m) {
      m.vx -= m.face * 90;
    },
  },

  /* ---------- 18 쌍둥이해파리: 똑같은 둘이 겹쳐 보임 · 나오면 분신 둘 · 진짜는 따뜻한 빛 ---------- */
  jellyTwins: {
    layer: "front",
    hide(m) {
      const sp = m.spot;
      m.x = sp.hx + rand(-30, 30);
      m.y = sp.hy + rand(-20, 20);
      m.p.camo = 1;
      m.glow = 70;
      m.clones = [];
    },
    tell(m, k) {
      // 옆에 '똑같은 해파리'가 잠깐 겹쳐 보인다 (하나가 둘로)
      m.p.twin = Math.sin(k * Math.PI);
      m.p.peek = k > 0.35 && k < 0.65 ? 0.8 : 0;
      m.p.flick = k > 0.2 && k < 0.8 ? 1 : 0;
    },
    emerge(m, k, g) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.p.twin = 0;
      m.p.flick = 0;
      if (k >= 1 && !m.clones.length) twinSplit(m, g);
    },
    active(m, dt, g) {
      const pl = g.player;
      m.glow = 90;
      m.cloneT = (m.cloneT || 0) - dt;
      if (!m.clones.length && m.cloneT <= 0) twinSplit(m, g);
      // 셋이 지혁 둘레 삼각형 자리 · 가끔 '휙' 자리 바꾸기
      m.swapT = (m.swapT == null ? 3 : m.swapT) - dt;
      if (m.swapT <= 0 && !m.atk && m.clones.length) {
        m.swapT = rand(2.6, 3.6);
        m.slotA = (m.slotA || 0) + 1 + Math.floor(rand(0, 2));
        g.fx.sparkle(m.x, m.y, 6, "#ffd0e8", 24);
        for (const c of m.clones) if (c.on) g.fx.sparkle(c.x, c.y, 6, "#d8c8ff", 24);
        g.audio.play("swap");
      }
      const all = [m, ...m.clones];
      const base = m.p.t * 0.35;
      all.forEach((o, i) => {
        if (o !== m && !o.on) return;
        const slot = (i + (m.slotA || 0)) % 3;
        const a = base + (slot / 3) * TAU;
        const tx = pl.x + Math.cos(a) * 220;
        const ty = pl.y - 40 + Math.sin(a) * 150;
        if (o === m) {
          if (!m.atk) steer(m, tx, ty, m.def.speed * 1.4, dt, 2);
          else {
            m.vx *= Math.exp(-4 * dt);
            m.vy *= Math.exp(-4 * dt);
          }
          moveBy(m, dt, g);
        } else {
          o.vx += ((tx - o.x) * 2 - o.vx) * Math.min(1, 2 * dt);
          o.vy += ((ty - o.y) * 2 - o.vy) * Math.min(1, 2 * dt);
          const sp = Math.hypot(o.vx, o.vy);
          const mx = m.def.speed * 1.4;
          if (sp > mx) {
            o.vx *= mx / sp;
            o.vy *= mx / sp;
          }
          o.x += o.vx * dt;
          o.y += o.vy * dt;
          g.world.push(o, 26);
        }
      });
    },
    strike(m, g) {
      // 진짜도 분신도 별빛 공을 쏜다 (분신 공은 느리다)
      const pl = g.player;
      const fire = (o, sp) => {
        const a = Math.atan2(pl.y - o.y, pl.x - o.x);
        g.shoot({ kind: "spark", x: o.x + Math.cos(a) * 26, y: o.y + Math.sin(a) * 26, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 11, dmg: 4, life: 2.4 });
      };
      fire(m, 300);
      for (const c of m.clones) if (c.on) fire(c, 200);
      g.audio.play("spit");
    },
    flee(m, g) {
      for (const c of m.clones) if (c.on) g.fx.sparkle(c.x, c.y, 8, "#d8c8ff", 24);
      m.clones = [];
      m.cloneT = 1.2;
    },
    react(m) {
      m.p.pulse = 1;
    },
    /** 분신이 맞으면 '퐁' 사라진다 */
    cloneHit(m, c, g) {
      c.on = false;
      g.fx.sparkle(c.x, c.y, 10, "#d8c8ff", 30);
      g.fx.spawn({ kind: "ring", x: c.x, y: c.y, r: 16, grow: 4, life: 0.4, c: "rgba(216,200,255,0.9)" });
      g.fx.text("가짜!", c.x, c.y - 40, { size: 24, color: "#d8c8ff", stroke: "#3a1a6a", life: 0.7 });
      g.audio.play("puff");
      if (m.clones.every((o) => !o.on)) {
        m.clones = [];
        m.cloneT = 4;
      }
    },
  },

  /* ================= 06 화산 해저 ================= */
  /* ---------- 19 용암게: 용암 바위 무더기인 척 · 등이 뜨거우면 물이 '치익' · 식히면 약해진다 ---------- */
  lavaCrab: {
    layer: "front",
    hide(m, g) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.groundY = m.spot.hy;
      m.p.camo = 1;
      m.heat = 0.85;
      m.p.heat = m.heat;
      m.onBed = g ? Math.abs(m.spot.y - g.world.bedY(m.spot.x)) < 50 : false;
    },
    tell(m, k, g) {
      m.p.peek = k > 0.25 && k < 0.75 ? 1 : 0;
      m.p.heat = 0.85 + Math.sin(k * Math.PI) * 0.15;
      if (Math.random() < 0.25) g.fx.spawn({ kind: "mist", x: m.x + rand(-30, 30), y: m.y - 30, vx: rand(-10, 10), vy: -50, r: 10, grow: 1.6, life: 0.8, a: 0.45 });
    },
    emerge(m, k, g) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.y = m.groundY - Math.sin(k * Math.PI) * 26;
      if (k > 0.9 && !m.landed) {
        m.landed = true;
        g.fx.dust(m.x, m.groundY + 20, 0.5);
      }
    },
    active(m, dt, g) {
      const pl = g.player;
      // 시간이 지나면 다시 뜨거워진다
      const was = m.heat;
      m.heat = Math.min(1, m.heat + dt * 0.085);
      if (was < 0.45 && m.heat >= 0.45) g.fx.text("다시 뜨거워!", m.x, m.y - 60, { size: 20, color: "#ffb06a", stroke: "#4a1000", life: 0.7 });
      m.p.heat = m.heat;
      m.contact = m.heat > 0.7 && !m.atk;
      if (m.heat > 0.6 && Math.random() < dt * 4) g.fx.spawn({ kind: "mist", x: m.x + rand(-30, 30), y: m.y - 26, vx: 0, vy: -40, r: 8, grow: 1.6, life: 0.7, a: 0.35 });
      // 옆으로 종종종 (지혁 쪽으로)
      m.walkT -= dt;
      if (m.walkT <= 0 && !m.atk) {
        m.walkT = rand(0.5, 1.0);
        m.walkDir = Math.random() < 0.7 ? Math.sign(pl.x - m.x) || 1 : -Math.sign(pl.x - m.x) || 1;
        m.walkV = rand(0.6, 1) * m.def.speed;
      }
      const vx = m.atk ? 0 : m.walkDir * m.walkV;
      m.vx += (vx - m.vx) * Math.min(1, 8 * dt);
      const x0 = m.onBed ? g.world.wallL(m.y) + 50 : m.spot.x - 120;
      const x1 = m.onBed ? g.world.wallR(m.y) - 50 : m.spot.x + 120;
      m.x = Math.max(x0, Math.min(x1, m.x + m.vx * dt));
      if (m.x <= x0 + 2) m.walkDir = 1;
      if (m.x >= x1 - 2) m.walkDir = -1;
      const gy = m.onBed ? g.world.bedY(m.x) - (m.spot.y - m.spot.hy) : m.groundY;
      m.y += (gy - m.y) * Math.min(1, 10 * dt);
      m.p.walk = Math.min(1, Math.abs(m.vx) / 60);
    },
    strike(m, g) {
      m.p.snap = 1;
      m.vx = m.face * 380;
      m.hurtR = 60;
      m.hurtT = 0.3;
      m.hurtAt = () => ({ x: m.x + m.face * 64, y: m.y - 8 });
      g.audio.play("snap");
    },
    flee(m, g) {
      g.fx.dust(m.x, m.y + 20, 0.8);
    },
    react(m) {
      m.vx -= m.face * 60;
    },
    /** 뜨거울 땐 물이 증발 (피해 없음 · 식는다) */
    absorb(m, g, x, y) {
      if (m.heat < 0.45) return false;
      m.heat = Math.max(0, m.heat - 0.08);
      m.p.heat = m.heat;
      g.fx.spawn({ kind: "mist", x: x || m.x, y: (y || m.y) - 6, vx: rand(-20, 20), vy: -70, r: 12, grow: 1.8, life: 0.6, a: 0.7 });
      if (m.heat < 0.45) {
        g.fx.text("식었다! 지금!", m.x, m.y - 64, { size: 24, color: "#9fe8ff", stroke: "#0a3a5a", punch: true, life: 0.9 });
        g.audio.play("freeze");
      } else if (!m.steamTip) {
        m.steamTip = true;
        g.fx.text("치익!", m.x, m.y - 64, { size: 24, color: "#ffd0a0", stroke: "#4a1000", life: 0.7 });
        g.ui.hint("뜨거운 등딱지는 물이 증발해요. 계속 쏴서 식혀요!", 2.6);
      }
      return true;
    },
  },

  /* ---------- 20 열수구벌레: 굴뚝 안 · 기포가 멈추면 빨간 깃이 쑥 · 다른 굴뚝으로 옮겨 감 ---------- */
  ventWorm: {
    layer: "hole",
    hopFlee: true,
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.out = 0;
      m.phase = "in";
      m.cyc = rand(1.2, 2.0);
      if (m.spot.vent) m.spot.vent.off = false;
    },
    tell(m, k) {
      m.p.out = Math.sin(k * Math.PI) * 0.6;
      if (m.spot.vent) m.spot.vent.off = m.p.out > 0.1;
    },
    seenReveal(m, d, g) {
      return m.p.out > 0.45 && d < 430 && g.onScreen(m.x, m.y - 60, -20);
    },
    hiddenBlock(m) {
      return m.p.out < 0.3;
    },
    emerge(m, k) {
      m.p.out = Math.max(m.p.out, 0.55 + k * 0.45);
      m.phase = "out";
      m.cyc = rand(2.2, 2.8);
      if (m.spot.vent) m.spot.vent.off = true;
    },
    active(m, dt, g) {
      m.cyc -= dt;
      if (m.phase === "out") {
        m.p.out = Math.min(1, m.p.out + dt * 5);
        if (m.cyc <= 0 && !m.atk) {
          m.phase = "in";
          m.cyc = rand(1.1, 1.7);
          g.audio.play("clamShut");
        }
      } else {
        m.p.out = Math.max(0.08, m.p.out - dt * 6);
        if (m.cyc <= 0) {
          m.phase = "out";
          m.cyc = rand(2.2, 2.8);
          m.atkCd = Math.min(m.atkCd, 0.5);
        }
        if (Math.random() < dt * 10) g.fx.spawn({ kind: "bubble", x: m.x + rand(-10, 10), y: m.y - 10, vx: rand(-10, 10), vy: rand(-160, -110), r: rand(2, 4), life: 1, drag: 0.4 });
      }
      if (m.spot.vent) m.spot.vent.off = m.p.out > 0.15;
      m.armor = m.p.out < 0.35;
      m.face = g.player.x >= m.x ? 1 : -1;
    },
    hitAt(m) {
      return { x: m.x + Math.sin(m.p.t * 1.8) * 8 * m.p.out, y: m.y - (16 + m.p.out * 100) + 4 };
    },
    canAttack(m) {
      return m.phase === "out" && m.p.out > 0.85;
    },
    strike(m, g) {
      const pl = g.player;
      const h = BEH.ventWorm.hitAt(m);
      const ang = Math.atan2(pl.y - h.y, pl.x - h.x);
      for (const da of [-0.3, 0, 0.3]) g.shoot({ kind: "hot", x: h.x + Math.cos(ang) * 20, y: h.y + Math.sin(ang) * 20, vx: Math.cos(ang + da) * 250, vy: Math.sin(ang + da) * 250, r: 10, dmg: 4, life: 2.2 });
      g.audio.play("spit");
      m.p.bite = 1;
    },
    flee(m, g) {
      g.fx.bubbles(m.x, m.y - 30, 14, 20);
      g.audio.play("burrow");
      if (m.spot.vent) m.spot.vent.off = false;
    },
    react(m) {
      m.p.out = Math.max(0.6, m.p.out - 0.12);
    },
  },

  /* ---------- 21 마그마거북: 바위 등껍질(김) · 껍질은 '팅' · 앞에서 머리를 노려야 한다 · 불 기포 숨 ---------- */
  magmaTurtle: {
    layer: "front",
    blockTip: "팅! 껍질은 단단해요 · 앞에서 머리를 노려요!",
    hide(m, g) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.groundY = m.spot.hy;
      m.p.camo = 1;
      m.onBed = g ? Math.abs(m.spot.y - g.world.bedY(m.spot.x)) < 50 : false;
    },
    tell(m, k, g) {
      m.p.peek = k > 0.3 && k < 0.7 ? 0.7 : 0;
      if (Math.random() < 0.3) g.fx.spawn({ kind: "mist", x: m.x + 6, y: m.y - 40, vx: rand(-10, 10), vy: -60, r: 10, grow: 2, life: 0.9, a: 0.5 });
    },
    emerge(m, k, g) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      if (Math.random() < 0.3) g.fx.dust(m.x + rand(-40, 40), m.y + 24, 0.3);
    },
    active(m, dt, g) {
      const pl = g.player;
      if (!m.atk) {
        const want = Math.sign(pl.x - m.x) * m.def.speed * (Math.abs(pl.x - m.x) > 160 ? 1 : 0);
        m.vx += (want - m.vx) * Math.min(1, 2 * dt);
      } else m.vx *= Math.exp(-6 * dt);
      const x0 = m.onBed ? g.world.wallL(m.y) + 70 : m.spot.x - 110;
      const x1 = m.onBed ? g.world.wallR(m.y) - 70 : m.spot.x + 110;
      m.x = Math.max(x0, Math.min(x1, m.x + m.vx * dt));
      const gy = m.onBed ? g.world.bedY(m.x) - (m.spot.y - m.spot.hy) : m.groundY;
      m.y += (gy - m.y) * Math.min(1, 8 * dt);
      m.p.walk = Math.min(1, Math.abs(m.vx) / 40);
      m.p.headHit = Math.max(0, (m.p.headHit || 0) - dt * 3);
      if (Math.random() < dt * 1.5) g.fx.spawn({ kind: "mist", x: m.x + 6, y: m.y - 40, vx: 0, vy: -50, r: 9, grow: 2, life: 0.9, a: 0.4 });
    },
    strike(m, g) {
      // 불 기포 숨: 부채꼴로 다섯
      const pl = g.player;
      const hx = m.x + m.face * 80;
      const hy = m.y - 8;
      const ang = Math.atan2(pl.y - hy, pl.x - hx);
      for (const da of [-0.4, -0.2, 0, 0.2, 0.4]) g.shoot({ kind: "hot", x: hx, y: hy, vx: Math.cos(ang + da) * 270, vy: Math.sin(ang + da) * 270, r: 9, dmg: 4, life: 1.5 });
      g.fx.spawn({ kind: "mist", x: hx, y: hy, vx: Math.cos(ang) * 60, vy: Math.sin(ang) * 60, r: 18, grow: 2, life: 0.5, a: 0.6 });
      g.audio.play("geyser");
    },
    flee(m, g) {
      g.fx.dust(m.x, m.y + 20, 1);
    },
    react(m) {
      m.p.headHit = 1;
    },
    /** 맞은 자리가 머리 근처가 아니면 껍질 '팅' */
    blocks(m, dir, hx, hy) {
      if (hx == null) return false;
      const s = m.p.s || 1;
      return dist(hx, hy, m.x + m.face * 72 * s, m.y) > 50;
    },
  },

  /* ================= 07 얼음 바다 ================= */
  /* ---------- 22 서리오징어: 얼음 덩어리 뒤 · 하얀 먹물 구름 속에서 휙 자리 바꾸기 · 얼음 조각 ---------- */
  frostSquid: {
    layer: "behind",
    hide(m) {
      m.x = m.spot.hx + rand(-20, 20);
      m.y = m.spot.hy + 16;
      m.p.camo = 1;
      m.offY = 0;
      m.streak = 0;
    },
    tell(m, k, g) {
      const up = Math.sin(k * Math.PI);
      m.offY = -up * 34;
      m.p.peek = k > 0.3 && k < 0.7 ? 0.9 : 0;
      if (k > 0.45 && k < 0.5 && Math.random() < 0.5) g.fx.spawn({ kind: "mist", x: m.x - 30, y: m.y + m.offY, vx: -20, vy: -10, r: 14, grow: 1.6, life: 0.8, a: 0.7 });
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.offY = -34 - k * 50;
      if (k >= 1) {
        m.y += m.offY;
        m.offY = 0;
      }
    },
    active(m, dt, g) {
      const pl = g.player;
      m.p.squish = Math.max(0, m.p.squish - dt * 2.2);
      m.p.snap = Math.max(0, (m.p.snap || 0) - dt * 2);
      m.inkT = (m.inkT == null ? rand(3.5, 5) : m.inkT) - dt;
      if (m.inkT <= 0 && !m.atk) BEH.frostSquid.poof(m, g);
      m.jetT -= dt;
      if (m.jetT <= 0 && !m.atk) {
        m.jetT = rand(0.9, 1.5);
        const a = rand(0, TAU);
        const tx = pl.x + Math.cos(a) * 230;
        const ty = pl.y + Math.sin(a) * 140 - 40;
        const dx = tx - m.x;
        const dy = ty - m.y;
        const dd = Math.hypot(dx, dy) + 1;
        m.vx = (dx / dd) * m.def.speed * 2.2;
        m.vy = (dy / dd) * m.def.speed * 2.2;
        m.p.squish = 1;
        g.fx.bubbles(m.x - (dx / dd) * 30, m.y, 3, 6, 0.8);
      }
      const dr = Math.exp(-2.2 * dt);
      m.vx *= dr;
      m.vy *= dr;
      moveBy(m, dt, g);
      if (m.ghostT > 0) m.ghostT -= dt;
    },
    /** 하얀 먹물 구름 + 다른 자리로 휙 */
    poof(m, g) {
      const pl = g.player;
      m.inkT = rand(3.8, 5.2);
      m.streak = 0;
      for (let i = 0; i < 9; i++) g.fx.spawn({ kind: "mist", x: m.x + rand(-40, 40), y: m.y + rand(-30, 30), vx: rand(-30, 30), vy: rand(-20, 10), r: rand(30, 46), grow: 1.6, life: rand(1.8, 2.4), drag: 2, a: 0.96 });
      g.audio.play("ink");
      for (let tries = 0; tries < 10; tries++) {
        const a = rand(0, TAU);
        const x = pl.x + Math.cos(a) * rand(200, 280);
        const y = pl.y + Math.sin(a) * rand(120, 200);
        if (g.world.open(x, y, 40)) {
          m.x = x;
          m.y = y;
          break;
        }
      }
      m.vx = 0;
      m.vy = 0;
      m.ghostT = 0.35;
      for (let i = 0; i < 5; i++) g.fx.spawn({ kind: "mist", x: m.x + rand(-30, 30), y: m.y + rand(-20, 20), vx: rand(-20, 20), vy: rand(-20, 10), r: rand(24, 34), grow: 1.4, life: rand(1, 1.4), drag: 2, a: 0.85 });
    },
    ghost(m) {
      return m.ghostT > 0;
    },
    windUp(m) {
      m.vx *= 0.9;
      m.vy *= 0.9;
    },
    strike(m, g) {
      const pl = g.player;
      const ang = Math.atan2(pl.y - m.y, pl.x - m.x);
      for (const da of [-0.22, 0, 0.22]) g.shoot({ kind: "ice", x: m.x + Math.cos(ang) * 30, y: m.y + Math.sin(ang) * 30, vx: Math.cos(ang + da) * 320, vy: Math.sin(ang + da) * 320, r: 9, dmg: 4, life: 2 });
      m.p.snap = 1;
      g.audio.play("freeze");
    },
    flee(m, g) {
      for (let i = 0; i < 6; i++) g.fx.spawn({ kind: "mist", x: m.x + rand(-30, 30), y: m.y + rand(-20, 20), vx: rand(-30, 30), vy: rand(-20, 10), r: rand(26, 40), grow: 1.5, life: rand(1.4, 2), drag: 2, a: 0.9 });
      g.audio.play("ink");
    },
    react(m, g) {
      m.p.squish = 0.8;
      m.streak = (m.streak || 0) + 1;
      // 너무 많이 맞으면 먹물 뿜고 휙
      if (m.streak >= 6 && m.hp > 0) BEH.frostSquid.poof(m, g);
    },
  },

  /* ---------- 23 유리게: 얼음 판 속에 비쳐 보임 · 투명해지면 물총이 통과 · 심장만 살짝 보인다 ---------- */
  glassCrab: {
    layer: "behind",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.face = m.spot.side < 0 ? 1 : -1;
      m.p.camo = 1;
      m.p.clear = 0.75;
      m.phase = "show";
      m.cyc = 2;
    },
    tell(m, k, g) {
      m.p.peek = k > 0.3 && k < 0.7 ? 1 : 0;
      m.p.clear = 0.75 - Math.sin(k * Math.PI) * 0.4;
      if (Math.random() < 0.2) g.fx.sparkle(m.x + rand(-20, 20), m.y + rand(-20, 20), 1, "#e8faff", 10);
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.p.clear = 0.75 * (1 - k);
      const dir = m.spot.side < 0 ? 1 : -1;
      m.x = m.spot.hx + dir * k * 90;
    },
    active(m, dt, g) {
      const pl = g.player;
      m.cyc -= dt;
      m.p.snap = Math.max(0, (m.p.snap || 0) - dt * 2);
      if (m.phase === "show") {
        m.p.clear = Math.max(0, m.p.clear - dt * 3);
        if (m.cyc <= 0 && !m.atk) {
          m.phase = "fade";
          m.cyc = rand(1.5, 2.1);
          g.audio.play("swap");
          // 투명해지는 동안 다른 자리로 살금살금
          const a = rand(0, TAU);
          m.tx = pl.x + Math.cos(a) * 220;
          m.ty = pl.y + Math.sin(a) * 140;
        }
        if (!m.atk) steer(m, pl.x + (m.x > pl.x ? 170 : -170), pl.y + 30, m.def.speed * 0.6, dt, 2);
        else {
          m.vx *= Math.exp(-5 * dt);
          m.vy *= Math.exp(-5 * dt);
        }
      } else {
        m.p.clear = Math.min(1, m.p.clear + dt * 2.5);
        steer(m, m.tx, m.ty, m.def.speed * 1.6, dt, 3);
        if (m.cyc <= 0) {
          m.phase = "show";
          m.cyc = rand(1.9, 2.5);
          m.atkCd = Math.min(m.atkCd, 0.6);
          g.fx.sparkle(m.x, m.y, 8, "#e8faff", 30);
          g.audio.play("blocked");
        }
      }
      moveBy(m, dt, g, 26);
      m.p.walk = Math.min(1, Math.hypot(m.vx, m.vy) / 80);
    },
    ghost(m) {
      return m.p.clear > 0.6;
    },
    canAttack(m) {
      return m.phase === "show";
    },
    strike(m, g) {
      const pl = g.player;
      const dx = pl.x - m.x;
      const dy = pl.y - m.y;
      const d = Math.hypot(dx, dy) + 1;
      m.vx = (dx / d) * 460;
      m.vy = (dy / d) * 460;
      m.p.snap = 1;
      m.hurtR = 46;
      m.hurtT = 0.3;
      g.audio.play("snap");
    },
    flee(m, g) {
      g.fx.sparkle(m.x, m.y, 10, "#e8faff", 30);
    },
    react(m) {
      m.vx -= m.face * 70;
    },
  },

  /* ---------- 24 눈물범괴물: 얼음 구멍 숨바꼭질 · 쏙 나와 눈뭉치 · 퐁당 들어가 다른 구멍으로 ---------- */
  snowSeal: {
    layer: "hole",
    hopFlee: true,
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.face = m.spot.side < 0 ? 1 : -1;
      m.p.out = 0;
      m.phase = "away";
      m.cyc = 0.8;
    },
    tell(m, k) {
      m.p.out = Math.sin(k * Math.PI) * 0.42;
      m.p.twitch = 1;
    },
    seenReveal(m, d, g) {
      return m.p.out > 0.32 && d < 460 && g.onScreen(m.x, m.y, -20);
    },
    hiddenBlock(m) {
      return m.p.out < 0.22;
    },
    emerge(m, k) {
      m.p.out = Math.max(m.p.out, 0.4 + k * 0.5);
      m.phase = "out";
      m.cyc = rand(2.0, 2.6);
    },
    active(m, dt, g) {
      m.cyc -= dt;
      m.p.twitch = Math.max(0, (m.p.twitch || 0) - dt);
      m.p.throw = Math.max(0, (m.p.throw || 0) - dt * 3);
      m.p.angry = Math.max(0, (m.p.angry || 0) - dt);
      if (m.phase === "out") {
        m.p.out = Math.min(1, m.p.out + dt * 5);
        if (m.cyc <= 0 && !m.atk) {
          m.phase = "dive";
          m.cyc = 0.35;
          g.fx.bubbles(m.x + m.face * 40, m.y, 8, 16);
          g.audio.play("puff");
        }
      } else if (m.phase === "dive") {
        m.p.out = Math.max(0, m.p.out - dt * 4);
        if (m.cyc <= 0) {
          m.phase = "away";
          m.cyc = rand(0.7, 1.1);
          m.hop(g, false);
          m.face = m.spot.side < 0 ? 1 : -1;
        }
      } else {
        m.p.out = 0;
        if (m.cyc <= 0) {
          m.phase = "out";
          m.cyc = rand(2.0, 2.6);
          m.atkCd = Math.min(m.atkCd, 0.7);
          g.fx.bubbles(m.x + m.face * 30, m.y, 10, 14);
          g.fx.text("뿅!", m.x + m.face * 40, m.y - 50, { size: 22, color: "#ffffff", stroke: "#2a5a8a", life: 0.6 });
        }
      }
      m.armor = m.p.out < 0.3;
    },
    hitAt(m) {
      return { x: m.x + m.face * (-30 + m.p.out * 64 + 4), y: m.y - 2 };
    },
    canAttack(m) {
      return m.phase === "out" && m.p.out > 0.85;
    },
    strike(m, g) {
      const pl = g.player;
      const h = BEH.snowSeal.hitAt(m);
      const ang = Math.atan2(pl.y - h.y, pl.x - h.x);
      g.shoot({ kind: "snow", x: h.x + Math.cos(ang) * 30, y: h.y + Math.sin(ang) * 30, vx: Math.cos(ang) * 330, vy: Math.sin(ang) * 330, r: 13, dmg: 4, life: 2.2 });
      m.p.throw = 1;
      g.audio.play("throw");
    },
    flee(m, g) {
      g.fx.bubbles(m.x, m.y, 12, 20);
      g.audio.play("puff");
    },
    react(m) {
      m.p.angry = 1;
      m.p.twitch = 1;
    },
  },

  /* ================= 08 심해 협곡 ================= */
  /* ---------- 25 심해아귀: 어둠 속 작은 빛 하나 · 헤드램프에 몸이 드러남 · 큰 입으로 덥석 ---------- */
  angler: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.glow = 0;
    },
    tell(m, k) {
      m.p.lureDx = Math.sin(k * Math.PI * 4) * 14;
      m.p.peek = k > 0.4 && k < 0.6 ? 0.8 : 0;
    },
    lightAt(m) {
      const s = m.p.s || 1;
      return { x: m.x + m.face * (48 + (m.p.lureDx || 0)) * s, y: m.y - 70 * s, r: 110 };
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.p.roar = Math.sin(k * Math.PI);
    },
    active(m, dt, g) {
      const pl = g.player;
      m.p.roar = Math.max(0, (m.p.roar || 0) - dt * 2);
      m.p.bite = Math.max(0, (m.p.bite || 0) - dt * 2.5);
      if (!m.atk) {
        // 유인등을 지혁 쪽으로 내밀고 슬금슬금 (적당한 거리)
        const d = dist(m.x, m.y, pl.x, pl.y);
        const k = d > 260 ? 1 : d < 160 ? -1 : 0;
        const ang = Math.atan2(pl.y - m.y, pl.x - m.x);
        const side = Math.sin(m.p.t * 0.7);
        steer(m, m.x + Math.cos(ang) * 100 * k - Math.sin(ang) * 60 * side, m.y + Math.sin(ang) * 100 * k + Math.cos(ang) * 60 * side, m.def.speed, dt, 1.6);
      } else {
        m.vx *= Math.exp(-4 * dt);
        m.vy *= Math.exp(-4 * dt);
      }
      moveBy(m, dt, g, 34);
    },
    strike(m, g) {
      // 덥석! 큰 입으로 돌진
      const pl = g.player;
      const dx = pl.x - m.x;
      const dy = pl.y - m.y;
      const d = Math.hypot(dx, dy) + 1;
      m.vx = (dx / d) * 560;
      m.vy = (dy / d) * 560;
      m.p.bite = 1;
      m.hurtR = 52;
      m.hurtT = 0.32;
      m.hurtAt = () => ({ x: m.x + m.face * 46, y: m.y + 8 });
      g.audio.play("chomp");
    },
    flee(m, g) {
      g.fx.bubbles(m.x, m.y, 10, 20);
    },
    react(m) {
      m.vx -= m.face * 90;
    },
  },

  /* ---------- 26 펠리컨장어: 꼬리 끝 분홍 빛 · 입을 쩍 벌려 빨아들이고 물을 삼킨다 · 다물 때가 기회 ---------- */
  gulper: {
    layer: "front",
    blockTip: "꿀꺽! 입을 벌리면 물을 삼켜요 · 입을 다물 때 쏴요!",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.face = m.spot.side < 0 ? 1 : -1;
      m.p.camo = 1;
      m.p.open = 0;
      m.phase = "drift";
      m.glow = 0;
    },
    tell(m, k) {
      m.p.open = Math.sin(k * Math.PI) * 0.4;
      m.p.peek = k > 0.35 && k < 0.65 ? 0.8 : 0;
    },
    lightAt(m) {
      const s = m.p.s || 1;
      return { x: m.x - m.face * 190 * s, y: m.y, r: 90 };
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.p.open = Math.sin(k * Math.PI) * 0.8;
    },
    active(m, dt, g) {
      const pl = g.player;
      m.p.gulp = Math.max(0, (m.p.gulp || 0) - dt * 1.5);
      if (m.phase === "suck") {
        m.suckT -= dt;
        m.p.open = Math.min(1, m.p.open + dt * 6);
        // 빨아들이기: 입 쪽으로 끌려간다
        const mx = m.x + m.face * 70;
        const my = m.y + 10;
        const d = dist(pl.x, pl.y, mx, my);
        if (d < 460 && pl.control) {
          const f = 520 * (1 - d / 520);
          pl.vx += ((mx - pl.x) / (d + 1)) * f * dt;
          pl.vy += ((my - pl.y) / (d + 1)) * f * dt;
        }
        if (Math.random() < dt * 30) {
          const a = rand(-0.8, 0.8) + (m.face > 0 ? 0 : Math.PI);
          const r0 = rand(120, 260);
          g.fx.spawn({ kind: "bubble", x: mx + Math.cos(a) * r0, y: my + Math.sin(a) * r0, vx: -Math.cos(a) * 260, vy: -Math.sin(a) * 260, r: rand(2, 4), life: 0.6, drag: 0.5 });
        }
        m.hurtR = 44;
        m.hurtT = 0.1;
        m.hurtAt = () => ({ x: m.x + m.face * 70, y: m.y + 12 });
        m.vx *= Math.exp(-5 * dt);
        m.vy *= Math.exp(-5 * dt);
        if (m.suckT <= 0) {
          m.phase = "drift";
          m.p.gulp = 1;
          g.audio.play("gulp");
          g.fx.text("꿀꺽!", m.x, m.y - 50, { size: 24, color: "#ffd0f0", stroke: "#3a0a3a", life: 0.7 });
        }
      } else {
        m.p.open = Math.max(0, m.p.open - dt * 3);
        if (!m.atk) {
          m.orb = (m.orb == null ? Math.atan2(m.y - pl.y, m.x - pl.x) : m.orb) + dt * 0.5;
          steer(m, pl.x + Math.cos(m.orb) * 270, pl.y + Math.sin(m.orb) * 160, m.def.speed, dt, 1.5);
        } else {
          m.vx *= Math.exp(-5 * dt);
          m.vy *= Math.exp(-5 * dt);
        }
      }
      moveBy(m, dt, g, 34);
      m.face = pl.x >= m.x ? 1 : -1;
    },
    windUp(m) {
      m.p.open = Math.max(m.p.open, m.p.wind * 0.6);
    },
    strike(m, g) {
      m.phase = "suck";
      m.suckT = 1.6;
      g.audio.play("bossAppear");
    },
    canAttack(m) {
      return m.phase === "drift";
    },
    /** 입을 벌리고 있을 땐 물을 삼킨다 */
    blocks(m) {
      return m.phase === "suck";
    },
    hitAt(m) {
      return { x: m.x + m.face * 16, y: m.y };
    },
    flee(m, g) {
      m.phase = "drift";
      m.p.open = 0;
      g.fx.bubbles(m.x, m.y, 12, 30);
    },
    react(m) {
      m.vx -= m.face * 80;
    },
  },

  /* ---------- 27 대왕갯강구: 고래 뼈 사이 · 몸을 말면 갑옷 공 · 데굴데굴 굴러온다 · 풀릴 때가 기회 ---------- */
  isopod: {
    layer: "front",
    hide(m, g) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.groundY = m.spot.hy;
      m.p.camo = 1;
      m.p.curl = 0;
      m.onBed = g ? Math.abs(m.spot.y - g.world.bedY(m.spot.x)) < 60 : true;
      m.roll = 0;
    },
    tell(m, k) {
      m.p.peek = k > 0.3 && k < 0.7 ? 1 : 0;
      m.p.walk = k > 0.2 && k < 0.8 ? 0.6 : 0;
      m.offX = Math.sin(k * Math.PI) * 10;
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.offX = 0;
    },
    active(m, dt, g) {
      const pl = g.player;
      const x0 = m.onBed ? g.world.wallL(m.y) + 50 : m.spot.x - 140;
      const x1 = m.onBed ? g.world.wallR(m.y) - 50 : m.spot.x + 140;
      if (m.roll > 0) {
        // 데굴데굴
        m.roll -= dt;
        m.p.curl = 1;
        m.p.rot = (m.p.rot || 0) + (m.vx / 34) * dt;
        m.contact = true;
        if (Math.random() < dt * 12) g.fx.dust(m.x, m.y + 26, 0.3);
        if (m.x <= x0 + 2 || m.x >= x1 - 2) m.vx *= -0.8;
        if (m.roll <= 0) {
          m.contact = false;
          m.dizzyT = 1.5;
          g.fx.text("어질어질", m.x, m.y - 46, { size: 20, color: "#fff6a0", stroke: "#3a2a00", life: 0.8 });
        }
      } else {
        m.p.curl = Math.max(m.atk ? m.p.wind * 0.6 : 0, m.p.curl - dt * 3);
        m.dizzyT = Math.max(0, (m.dizzyT || 0) - dt);

        if (!m.atk && m.dizzyT <= 0) {
          const want = Math.sign(pl.x - m.x) * m.def.speed * (Math.abs(pl.x - m.x) > 70 ? 1 : 0);
          m.vx += (want - m.vx) * Math.min(1, 3 * dt);
        } else m.vx *= Math.exp(-6 * dt);
        m.p.walk = Math.min(1, Math.abs(m.vx) / 50);
      }
      m.x = Math.max(x0, Math.min(x1, m.x + m.vx * dt));
      const gy = m.onBed ? g.world.bedY(m.x) - (m.spot.y - m.spot.hy) : m.groundY;
      m.y += (gy - m.y) * Math.min(1, 10 * dt);
      m.armor = m.p.curl > 0.6;
    },
    canAttack(m) {
      return m.roll <= 0 && !(m.dizzyT > 0);
    },
    strike(m, g) {
      m.roll = 1.3;
      m.vx = Math.sign(g.player.x - m.x || 1) * 430;
      g.audio.play("burrow");
    },
    flee(m, g) {
      m.roll = 0;
      m.p.curl = 0;
      g.fx.dust(m.x, m.y + 20, 0.8);
    },
    react(m) {
      m.vx -= m.face * 50;
    },
  },

  /* ================= 09 잃어버린 도시 ================= */
  /* ---------- 28 석상수호자: 석상인 척 · 깨어나면 삼지창 · 다시 돌로 굳으면 '팅' ---------- */
  statueGuard: {
    layer: "front",
    blockTip: "돌로 굳었을 땐 안 통해요 · 눈이 빛나며 움직일 때 쏴요!",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.p.stone = 0;
      m.phase = "alive";
      m.cyc = 2.6;
    },
    tell(m, k, g) {
      m.p.eyeGlow = Math.sin(k * Math.PI);
      if (k > 0.45 && k < 0.5 && Math.random() < 0.5) g.fx.dust(m.x, m.y + 70, 0.3);
    },
    emerge(m, k, g) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.offX = Math.sin(k * 40) * 3 * (1 - k);
      if (Math.random() < 0.3) g.fx.dust(m.x + rand(-30, 30), m.y + rand(-40, 60), 0.3);
      if (k >= 1) m.offX = 0;
    },
    active(m, dt, g) {
      const pl = g.player;
      m.cyc -= dt;
      m.p.thrust = Math.max(0, (m.p.thrust || 0) - dt * 2.5);
      if (m.phase === "alive") {
        m.p.stone = Math.max(0, m.p.stone - dt * 4);
        if (!m.atk) steer(m, pl.x - Math.sign(pl.x - m.x) * 150, pl.y - 20, m.def.speed, dt, 2);
        else {
          m.vx *= Math.exp(-5 * dt);
          m.vy *= Math.exp(-5 * dt);
        }
        if (m.cyc <= 0 && !m.atk) {
          m.phase = "stone";
          m.cyc = rand(1.3, 1.7);
          g.fx.dust(m.x, m.y, 0.7);
          g.audio.play("clamShut");
        }
      } else {
        m.p.stone = Math.min(1, m.p.stone + dt * 5);
        m.vx *= Math.exp(-4 * dt);
        m.vy = lerp(m.vy, 30, dt * 2);
        if (m.cyc <= 0) {
          m.phase = "alive";
          m.cyc = rand(2.4, 3.0);
          m.atkCd = Math.min(m.atkCd, 0.6);
          g.fx.dust(m.x, m.y, 0.8);
          g.fx.sparkle(m.x + m.face * 10, m.y - 50, 6, "#5ff0d0", 20);
        }
      }
      moveBy(m, dt, g, 34);
      m.armor = m.phase === "stone" && m.p.stone > 0.5;
    },
    canAttack(m) {
      return m.phase === "alive";
    },
    strike(m, g) {
      const pl = g.player;
      const dx = pl.x - m.x;
      const dy = pl.y - m.y;
      const d = Math.hypot(dx, dy) + 1;
      m.vx = (dx / d) * 420;
      m.vy = (dy / d) * 420;
      m.p.thrust = 1;
      m.hurtR = 50;
      m.hurtT = 0.3;
      m.hurtAt = () => ({ x: m.x + m.face * 92, y: m.y - 12 });
      g.audio.play("snap");
    },
    flee(m, g) {
      g.fx.dust(m.x, m.y, 1);
    },
    react(m) {
      m.vx -= m.face * 60;
    },
  },

  /* ---------- 29 고대앵무조개: 기둥 뒤 · 빙글 순간 이동으로 기둥 사이를 옮겨 다닌다 · 진주 쏘기 ---------- */
  nautilus: {
    layer: "behind",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.offX = 0;
      m.p.warp = 0;
    },
    tell(m, k) {
      m.offX = Math.sin(k * Math.PI) * 44 * (m.spot.id.length % 2 ? 1 : -1);
      m.p.peek = k > 0.3 && k < 0.7 ? 1 : 0;
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.offX = k * 60;
      if (k >= 1) {
        m.x += m.offX;
        m.offX = 0;
      }
    },
    active(m, dt, g) {
      const pl = g.player;
      m.warpT = (m.warpT == null ? rand(2.0, 2.6) : m.warpT) - dt;
      if (m.warping) {
        m.warping += dt;
        const k = m.warping;
        if (k < 0.32) m.p.warp = k / 0.32;
        else {
          if (!m.warped) {
            m.warped = true;
            // 지혁 근처의 다른 기둥 옆 (없으면 근처 빈 물)
            const list = g.world.spots.filter((s) => s.kind === "pillar" && dist(s.hx, s.hy, pl.x, pl.y) < 520);
            let tx = null;
            let ty = null;
            if (list.length) {
              const s = pick(list);
              tx = s.hx + (Math.random() < 0.5 ? -70 : 70);
              ty = s.hy + rand(-60, 60);
            }
            if (tx == null || !g.world.open(tx, ty, 30)) {
              const a = rand(0, TAU);
              tx = pl.x + Math.cos(a) * 230;
              ty = pl.y + Math.sin(a) * 150;
            }
            if (g.world.open(tx, ty, 30)) {
              m.x = tx;
              m.y = ty;
            }
            g.audio.play("teleport");
          }
          m.p.warp = Math.max(0, 1 - (k - 0.32) / 0.32);
          if (k > 0.64) {
            m.warping = 0;
            m.p.warp = 0;
            m.warpT = rand(2.0, 2.6);
          }
        }
        if (Math.random() < 0.5) g.fx.sparkle(m.x, m.y, 1, "#9fe8ff", 30);
        m.vx = 0;
        m.vy = 0;
        return;
      }
      if (m.warpT <= 0 && !m.atk) {
        m.warping = 0.0001;
        m.warped = false;
        return;
      }
      if (!m.atk) {
        m.orb = (m.orb == null ? 0 : m.orb) + dt * 0.8;
        steer(m, pl.x + Math.cos(m.orb) * 210, pl.y + Math.sin(m.orb) * 120, m.def.speed, dt, 2);
      } else {
        m.vx *= Math.exp(-5 * dt);
        m.vy *= Math.exp(-5 * dt);
      }
      moveBy(m, dt, g, 30);
    },
    ghost(m) {
      return (m.p.warp || 0) > 0.35;
    },
    canAttack(m) {
      return !m.warping;
    },
    strike(m, g) {
      const pl = g.player;
      const ang = Math.atan2(pl.y - m.y, pl.x - m.x);
      for (const da of [-0.12, 0.12]) g.shoot({ kind: "pearl", x: m.x + Math.cos(ang) * 30, y: m.y + Math.sin(ang) * 30, vx: Math.cos(ang + da) * 300, vy: Math.sin(ang + da) * 300, r: 9, dmg: 4, life: 2.2 });
      g.audio.play("spit");
    },
    flee(m, g) {
      m.warping = 0;
      m.p.warp = 0;
      g.fx.sparkle(m.x, m.y, 10, "#9fe8ff", 30);
    },
    react(m) {
      m.vx -= m.face * 60;
    },
  },

  /* ---------- 30 거울물고기: 아치 속 반짝 · 분신 셋 · 진짜만 바닥에 그림자가 진다 ---------- */
  mirrorFish: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.clones = [];
    },
    tell(m, k, g) {
      m.p.peek = k > 0.3 && k < 0.7 ? 1 : 0;
      if (Math.random() < 0.3) g.fx.sparkle(m.x + rand(-20, 20), m.y + rand(-14, 14), 1, "#ffffff", 8);
    },
    emerge(m, k, g) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      if (k >= 1 && !m.clones.length) twinSplit(m, g, 3);
    },
    active(m, dt, g) {
      const pl = g.player;
      m.cloneT = (m.cloneT || 0) - dt;
      if (!m.clones.length && m.cloneT <= 0) twinSplit(m, g, 3);
      m.swapT = (m.swapT == null ? 3 : m.swapT) - dt;
      if (m.swapT <= 0 && !m.atk && m.clones.length) {
        m.swapT = rand(2.6, 3.4);
        m.slotA = (m.slotA || 0) + 1 + Math.floor(rand(0, 3));
        g.fx.sparkle(m.x, m.y, 6, "#ffffff", 24);
        for (const c of m.clones) if (c.on) g.fx.sparkle(c.x, c.y, 6, "#d8e0ff", 24);
        g.audio.play("swap");
      }
      const all = [m, ...m.clones];
      const base = m.p.t * 0.4;
      all.forEach((o, i) => {
        if (o !== m && !o.on) return;
        const slot = (i + (m.slotA || 0)) % 4;
        const a = base + (slot / 4) * TAU;
        const tx = pl.x + Math.cos(a) * 230;
        const ty = pl.y - 30 + Math.sin(a) * 160;
        if (o === m) {
          if (!m.atk) steer(m, tx, ty, m.def.speed * 1.5, dt, 2.2);
          else {
            m.vx *= Math.exp(-4 * dt);
            m.vy *= Math.exp(-4 * dt);
          }
          moveBy(m, dt, g);
        } else {
          o.vx += ((tx - o.x) * 2 - o.vx) * Math.min(1, 2 * dt);
          o.vy += ((ty - o.y) * 2 - o.vy) * Math.min(1, 2 * dt);
          const sp = Math.hypot(o.vx, o.vy);
          const mx = m.def.speed * 1.5;
          if (sp > mx) {
            o.vx *= mx / sp;
            o.vy *= mx / sp;
          }
          o.x += o.vx * dt;
          o.y += o.vy * dt;
          g.world.push(o, 26);
        }
      });
    },
    strike(m, g) {
      const pl = g.player;
      const fire = (o, sp) => {
        const a = Math.atan2(pl.y - o.y, pl.x - o.x);
        g.shoot({ kind: "spark", x: o.x + Math.cos(a) * 26, y: o.y + Math.sin(a) * 26, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 10, dmg: 4, life: 2.4 });
      };
      fire(m, 310);
      for (const c of m.clones) if (c.on) fire(c, 190);
      g.audio.play("spit");
    },
    flee(m, g) {
      for (const c of m.clones) if (c.on) g.fx.sparkle(c.x, c.y, 8, "#d8e0ff", 24);
      m.clones = [];
      m.cloneT = 1.2;
    },
    react(m) {
      m.vx -= m.face * 60;
    },
    cloneHit(m, c, g) {
      BEH.jellyTwins.cloneHit(m, c, g);
    },
  },

  /* ================= 10 괴물의 둥지 ================= */
  /* ---------- 31 알깍쟁이: 알이 흔들흔들 · 깨어나면 근처 알도 줄줄이 · 폴짝폴짝 깨물기 ---------- */
  eggling: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.p.crack = 0;
      m.p.wobble = 0;
    },
    tell(m, k) {
      m.p.wobble = Math.sin(k * Math.PI);
      m.p.peek = k > 0.4 && k < 0.6 ? 1 : 0;
      m.p.crack = 0.3;
    },
    emerge(m, k, g) {
      m.p.wobble = 1;
      m.p.crack = Math.min(1, k * 2);
      if (k >= 0.5 && m.p.camo > 0) {
        m.p.camo = 0;
        m.p.peek = 1;
        for (let i = 0; i < 10; i++) {
          const a = rand(0, TAU);
          g.fx.spawn({ kind: "drop", x: m.x, y: m.y, vx: Math.cos(a) * rand(80, 200), vy: Math.sin(a) * rand(80, 200) - 60, r: rand(3, 6), life: 0.6, drag: 3, c: "#f4e8ff" });
        }
        g.fx.text("부화!", m.x, m.y - 40, { size: 22, color: "#e8fff0", stroke: "#1a5a3a", life: 0.7 });
        g.audio.play("pop");
        // 근처 알도 줄줄이 깨어난다
        for (const o of g.monsters) if (o !== m && o.id === "eggling" && o.hidden && dist(o.x, o.y, m.x, m.y) < 460) setTimeout(() => o.reveal(g, "near"), 300 + Math.random() * 500);
      }
    },
    active(m, dt, g) {
      const pl = g.player;
      m.jetT -= dt;
      if (m.jetT <= 0 && !m.atk) {
        m.jetT = rand(0.45, 0.8);
        const a = rand(0, TAU);
        const tx = pl.x + Math.cos(a) * 160;
        const ty = pl.y + Math.sin(a) * 110;
        const dx = tx - m.x;
        const dy = ty - m.y;
        const d = Math.hypot(dx, dy) + 1;
        m.vx = (dx / d) * m.def.speed * 1.8;
        m.vy = (dy / d) * m.def.speed * 1.8;
      }
      m.vx *= Math.exp(-3 * dt);
      m.vy *= Math.exp(-3 * dt);
      moveBy(m, dt, g, 24);
      m.p.walk = Math.min(1, Math.hypot(m.vx, m.vy) / 100);
    },
    strike(m, g) {
      const pl = g.player;
      const dx = pl.x - m.x;
      const dy = pl.y - m.y;
      const d = Math.hypot(dx, dy) + 1;
      m.vx = (dx / d) * 480;
      m.vy = (dy / d) * 480;
      m.hurtR = 32;
      m.hurtT = 0.3;
      g.audio.play("chomp");
    },
    react(m) {
      m.vx -= m.face * 80;
    },
  },

  /* ================= 11 심해 폭풍 ================= */
  /* ---------- 32 소용돌이물고기: 작은 소용돌이 속 · 빙글 돌아 순식간에 등 뒤로 · 뒤에서 덥석 ---------- */
  whirlFish: {
    layer: "front",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.p.spin = 1;
    },
    tell(m, k) {
      m.p.peek = k > 0.35 && k < 0.65 ? 1 : 0;
      m.p.spin = 1 - Math.sin(k * Math.PI) * 0.7;
    },
    emerge(m, k) {
      m.p.camo = 1 - k;
      m.p.spin = 1 - k;
      m.p.peek = 1;
    },
    active(m, dt, g) {
      const pl = g.player;
      m.whirlT = (m.whirlT == null ? rand(2.2, 3.0) : m.whirlT) - dt;
      if (m.spinning > 0) {
        m.spinning -= dt;
        m.p.spin = Math.min(1, m.p.spin + dt * 6);
        if (m.spinning <= 0.25 && !m.jumped) {
          // 등 뒤로 휙
          m.jumped = true;
          const bx = pl.x - pl.face * 200;
          const by = pl.y + rand(-60, 40);
          if (g.world.open(bx, by, 30)) {
            m.x = bx;
            m.y = by;
          }
          g.fx.spawn({ kind: "ring", x: m.x, y: m.y, r: 20, grow: 3, life: 0.4, c: "rgba(200,244,255,0.9)" });
          g.audio.play("swap");
        }
        if (m.spinning <= 0) {
          m.p.spin = 0;
          m.atkCd = 0;
          m.whirlT = rand(2.4, 3.2);
        }
        m.vx = 0;
        m.vy = 0;
        return;
      }
      m.p.spin = Math.max(0, m.p.spin - dt * 4);
      if (m.whirlT <= 0 && !m.atk) {
        m.spinning = 0.6;
        m.jumped = false;
        return;
      }
      if (!m.atk) {
        m.orb = (m.orb == null ? 0 : m.orb) + dt * 1.1;
        steer(m, pl.x + Math.cos(m.orb) * 230, pl.y + Math.sin(m.orb) * 140, m.def.speed, dt, 2);
      } else {
        m.vx *= Math.exp(-5 * dt);
        m.vy *= Math.exp(-5 * dt);
      }
      moveBy(m, dt, g, 28);
    },
    ghost(m) {
      return (m.p.spin || 0) > 0.5 && m.state === "active";
    },
    canAttack(m) {
      return !(m.spinning > 0);
    },
    strike(m, g) {
      const pl = g.player;
      const dx = pl.x - m.x;
      const dy = pl.y - m.y;
      const d = Math.hypot(dx, dy) + 1;
      m.vx = (dx / d) * 520;
      m.vy = (dy / d) * 520;
      m.hurtR = 38;
      m.hurtT = 0.3;
      g.audio.play("chomp");
    },
    flee(m, g) {
      m.spinning = 0;
      g.fx.bubbles(m.x, m.y, 10, 20);
    },
    react(m) {
      m.vx -= m.face * 70;
    },
  },

  /* ---------- 33 폭풍가오리: 모래 속 · 날갯짓으로 거센 물살(물총이 날아간다) · 잦아들면 지쳐서 기회 ---------- */
  stormRay: {
    layer: "front",
    blockTip: "휘잉! 물살이 셀 땐 물이 날아가요 · 잦아들 때 쏴요!",
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.phase = "glide";
      m.cyc = 0;
    },
    tell(m, k, g) {
      m.p.peek = k > 0.3 && k < 0.7 ? 1 : 0;
      if (Math.random() < 0.3) g.fx.dust(m.x + rand(-60, 60), m.y + 10, 0.3);
    },
    emerge(m, k, g) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      m.offY = -k * 60;
      if (Math.random() < 0.4) g.fx.dust(m.x + rand(-60, 60), m.y + 10, 0.4);
      if (k >= 1) {
        m.y += m.offY;
        m.offY = 0;
      }
    },
    active(m, dt, g) {
      const pl = g.player;
      m.cyc -= dt;
      if (m.phase === "gust") {
        // 거센 물살: 가오리에게서 밀려난다
        const d = dist(pl.x, pl.y, m.x, m.y);
        if (d < 560 && pl.control) {
          const f = 1100 * (1 - d / 600);
          pl.vx += ((pl.x - m.x) / (d + 1)) * f * dt;
          pl.vy += ((pl.y - m.y) / (d + 1)) * f * dt;
        }
        if (Math.random() < dt * 40) {
          const a = rand(0, TAU);
          g.fx.spawn({ kind: "bubble", x: m.x + Math.cos(a) * 60, y: m.y + Math.sin(a) * 40, vx: Math.cos(a) * 420, vy: Math.sin(a) * 300, r: rand(2, 4), life: 0.7, drag: 0.6 });
        }
        if (Math.random() < dt * 6) g.fx.sparkle(m.x + rand(-60, 60), m.y + rand(-40, 40), 2, "#ffe14a", 20);
        m.p.wind = 1;
        m.vx *= Math.exp(-4 * dt);
        m.vy *= Math.exp(-4 * dt);
        if (m.cyc <= 0) {
          m.phase = "tired";
          m.cyc = 1.9;
          m.p.wind = 0;
          g.fx.text("헉헉… 지금!", m.x, m.y - 70, { size: 24, color: "#fff6a0", stroke: "#3a2a00", life: 0.9 });
        }
      } else if (m.phase === "tired") {
        m.vx *= Math.exp(-2 * dt);
        m.vy = lerp(m.vy, 20, dt);
        if (m.cyc <= 0) m.phase = "glide";
      } else if (!m.atk) {
        m.orb = (m.orb == null ? 0 : m.orb) + dt * 0.7;
        steer(m, pl.x + Math.cos(m.orb) * 300, pl.y - 120 + Math.sin(m.orb * 2) * 80, m.def.speed, dt, 1.4);
      } else {
        m.vx *= Math.exp(-4 * dt);
        m.vy *= Math.exp(-4 * dt);
      }
      moveBy(m, dt, g, 40);
      m.p.dizzy = m.phase === "tired" ? 1 : 0;
    },
    canAttack(m) {
      return m.phase === "glide";
    },
    strike(m, g) {
      m.phase = "gust";
      m.cyc = 1.6;
      g.audio.play("splash", { big: true });
      g.fx.shake(6);
      g.fx.spawn({ kind: "ring", x: m.x, y: m.y, r: 40, grow: 6, life: 0.6, c: "rgba(230,250,255,0.9)" });
    },
    blocks(m) {
      return m.phase === "gust";
    },
    hit2(m) {},
    flee(m, g) {
      m.phase = "glide";
      g.fx.dust(m.x, m.y, 1.2);
    },
    react(m) {
      m.vx -= m.face * 50;
    },
  },

  /* ================= 12 어비스 ================= */
  /* ---------- 34 심연등불: 떠 있는 빛 중 하나 · 빛 속 눈이 깜빡 · 더 깊은 곳으로 유인 · 번쩍 + 따라오는 도깨비불 ---------- */
  abyssLantern: {
    layer: "front",
    hopFlee: true,
    hide(m) {
      m.x = m.spot.hx;
      m.y = m.spot.hy;
      m.p.camo = 1;
      m.glow = 0;
    },
    tell(m, k) {
      m.p.peek = k > 0.3 && k < 0.7 ? 1 : 0;
      m.offY = Math.sin(k * Math.PI) * 10;
    },
    lightAt(m) {
      return { x: m.x, y: m.y + m.offY, r: 150 };
    },
    emerge(m, k, g) {
      m.p.camo = 1 - k;
      m.p.peek = 1;
      if (k > 0.5 && !m.laughed) {
        m.laughed = true;
        g.fx.text("히히히…", m.x, m.y - 60, { size: 22, color: "#ffe8b0", stroke: "#2a1a00", life: 0.9 });
      }
    },
    active(m, dt, g) {
      const pl = g.player;
      // 지혁을 더 깊은 곳으로 데려가려는 듯 아래쪽으로 슬금슬금
      if (!m.atk) {
        const d = dist(m.x, m.y, pl.x, pl.y);
        const tx = pl.x + Math.sin(m.p.t * 0.6) * 160;
        const ty = pl.y + (d < 200 ? 260 : 180);
        steer(m, tx, Math.min(ty, g.world.bedY(tx) - 120), m.def.speed, dt, 1.4);
      } else {
        m.vx *= Math.exp(-4 * dt);
        m.vy *= Math.exp(-4 * dt);
      }
      moveBy(m, dt, g, 30);
      m.laughed = false;
    },
    strike(m, g) {
      // 번쩍! + 따라오는 도깨비불 셋
      g.fx.flash(0.35, "#fff2c0");
      const pl = g.player;
      for (let i = 0; i < 3; i++) {
        const a = Math.atan2(pl.y - m.y, pl.x - m.x) + (i - 1) * 0.6;
        g.shoot({ kind: "wisp", x: m.x + Math.cos(a) * 30, y: m.y + Math.sin(a) * 30, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, r: 10, dmg: 4, life: 3.2, home: 1.6, speed: 170 });
      }
      g.audio.play("zap");
    },
    flee(m, g) {
      g.fx.sparkle(m.x, m.y, 12, "#ffe08a", 30);
      g.fx.text("휙!", m.x, m.y - 40, { size: 22, color: "#ffe8b0", stroke: "#2a1a00", life: 0.6 });
    },
    react(m) {
      m.vx -= m.face * 60;
    },
  },
};

/* ================================================================
 * 괴물 한 마리
 * ============================================================== */
export class Monster {
  constructor(def, spot, g) {
    this.def = def;
    this.id = def.id;
    this.B = BEH[def.id] || BEH.puffer;
    this.spot = spot;
    spot.monster = this;
    this.x = spot.hx;
    this.y = spot.hy;
    this.vx = 0;
    this.vy = 0;
    this.face = Math.random() < 0.5 ? 1 : -1;
    this.hp = def.hp || 10;
    this.maxHp = this.hp;
    this.r = def.r || 30;
    this.state = "hidden";
    this.st = 0;
    this.found = false;
    this.tellT = rand(1.2, 3.2);
    this.tellK = -1;
    this.tellN = Math.floor(rand(0, 6));
    this.atk = null;
    this.atkCd = rand(1, 2);
    this.fleeIdx = 0;
    this.sonarT = 0;
    this.offY = 0;
    this.jetT = 0;
    this.walkT = 0;
    this.walkDir = 1;
    this.walkV = 0;
    this.inflT = 0;
    this.puffN = 0;
    this.cyc = 0;
    this.phase = "open";
    this.armor = false;
    this.hurtT = 0;
    this.hurtR = 0;
    this.hurtAt = null;
    this.contact = false;
    this.capT = 0;
    this.done = false;
    this.seen = false; // 화면에 들킨 몸짓을 보였는가 (발견 판정용)
    this.clones = []; // 분신 (쌍둥이해파리 · 거울물고기)
    this.p = { t: rand(0, 10), face: this.face, s: def.s || 1, camo: 1, peek: 0, look: { x: 0, y: 0 }, hit: 0, wind: 0, inflate: 0, open: 0, out: 0, walk: 0, squish: 0, bite: 0 };
    this.B.hide(this, g);
  }

  get hidden() {
    return this.state === "hidden" || this.state === "hiding";
  }
  get targetable() {
    return (this.state === "active" || this.state === "emerge") && !(this.B.ghost && this.B.ghost(this));
  }
  /** 맞는 자리 (곰치는 머리) */
  get hitX() {
    if (this.B.hitAt && !this.hidden) return this.B.hitAt(this).x;
    return this.hx != null && this.id === "reefEel" ? this.hx : this.x;
  }
  get hitY() {
    if (this.B.hitAt && !this.hidden) return this.B.hitAt(this).y;
    return this.hx != null && this.id === "reefEel" ? this.hy : this.y + this.offY;
  }

  update(dt, g) {
    const p = this.p;
    p.t += dt;
    p.hit = Math.max(0, p.hit - dt * 4);
    if (this.sonarT > 0) this.sonarT -= dt;
    if (p.snap) p.snap = Math.max(0, p.snap - dt);
    p.blink = (p.t % 3.7) < 0.12;
    this.st += dt;
    const pl = g.player;
    const d = dist(this.x, this.y, pl.x, pl.y);
    switch (this.state) {
      case "hidden": {
        // 들키는 몸짓 (가까이 오면 더 자주)
        this.tellT -= dt * (d < 320 ? 1.8 : 1);
        if (this.tellK < 0 && this.tellT <= 0) {
          this.tellK = 0;
          this.tellN++;
          this.tellDur = rand(0.8, 1.2);
        }
        if (this.tellK >= 0) {
          this.tellK += dt / this.tellDur;
          if (this.tellK >= 1) {
            this.tellK = -1;
            this.tellT = rand(1.6, 3.4);
            this.B.tell(this, 0, g);
            this.p.tell = 0;
            this.p.peek = 0;
            this.offY = 0;
          } else {
            this.B.tell(this, this.tellK, g);
            if (g.onScreen(this.x, this.y, 20)) this.seen = true;
          }
        }
        lookAt(this, pl.x, pl.y);
        // 동굴 괴물: 헤드램프에 비치면 '발견'
        if (this.def.light && d < this.def.light && g.inLight(this.x, this.y)) this.reveal(g, "near");
        // 창문눈알: 창에 보이는 동안 가까이 있으면 '발견'
        if (this.id === "porthole" && (this.p.vis || 0) > 0.8 && d < 400 && g.onScreen(this.x, this.y, -20)) this.reveal(g, "near");
        if (this.B.seenReveal && this.B.seenReveal(this, d, g)) this.reveal(g, "near");
        // 가까이 오면 스스로 나타남 (near = 0 이면 맞혀야만)
        if (this.def.near && d < this.def.near) this.reveal(g, this.def.sneak ? "silent" : "near");
        // 곰치: 구멍 앞을 지나가면 발견 (튀어나와 문다)
        if (this.id === "reefEel" && d < 230 && (pl.x - this.spot.hx) * (this.spot.side < 0 ? 1 : -1) > 0) this.reveal(g, "near");
        break;
      }
      case "emerge": {
        const k = Math.min(1, this.st / 0.55);
        this.B.emerge(this, k, g);
        lookAt(this, pl.x, pl.y);
        if (k >= 1) this.setState("active");
        break;
      }
      case "active": {
        this.B.active(this, dt, g);
        if (this.id !== "rockCrab" && this.id !== "reefEel" && this.id !== "clam") this.face = pl.x >= this.x ? 1 : -1;
        lookAt(this, pl.x, pl.y);
        this.updateAttack(dt, g, d);
        break;
      }
      case "flee": {
        const s = this.fleeTo;
        const tx = s.hx;
        const ty = s.hy - (this.id === "coralOcto" ? 6 : 0);
        if (this.burrow) {
          // 모래 속으로 이동 (흙먼지 길)
          this.x += clamp(tx - this.x, -260 * dt, 260 * dt);
          this.y += clamp(ty - this.y, -260 * dt, 260 * dt);
          if (Math.random() < dt * 14) g.fx.dust(this.x, this.y + 14, 0.35);
          this.p.camo = 1;
        } else {
          // 도망칠 때는 바위 뒤로 지나간다 (막혀서 멈추지 않게)
          const dd = steer(this, tx, ty, this.def.fleeSpeed || 330, dt, 5);
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          this.face = this.vx >= 0 ? 1 : -1;
          if (Math.random() < dt * 10) g.fx.bubbles(this.x - this.vx * 0.05, this.y, 1, 6, 0.8);
          if (dd < 24) {
            this.x = tx;
            this.y = ty;
          }
        }
        if (this.st > 4) {
          // 너무 오래 걸리면 먹물 · 흙먼지 속에서 도착
          g.fx.bubbles(this.x, this.y, 8, 16);
          this.x = tx;
          this.y = ty;
        }
        if (dist(this.x, this.y, tx, ty) < 26) {
          this.spot.monster = null;
          this.spot = s;
          this.burrow = false;
          this.vx = 0;
          this.vy = 0;
          this.B.hide(this, g);
          this.setState("hidden");
          this.tellT = rand(1.5, 2.6);
          g.onRehide(this);
        }
        break;
      }
      case "captured": {
        this.capT += dt;
        p.dizzy = 1;
        this.vx *= Math.exp(-3 * dt);
        this.vy = lerp(this.vy, -60, dt * 2);
        this.x += this.vx * dt;
        if (this.capT > 0.45) this.y += this.vy * dt;
        if (this.capT > 1.5 && !this.done) {
          this.done = true;
          g.onCaptured(this);
        }
        break;
      }
    }
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.zapT > 0) this.zapT -= dt;
    p.face = this.face;
    for (const c of this.clones) {
      c.p.t += dt;
      c.p.hit = Math.max(0, c.p.hit - dt * 4);
      c.p.wind = p.wind;
      c.p.peek = p.peek;
      c.p.camo = p.camo;
      c.p.pulse = p.pulse;
      c.face = pl.x >= c.x ? 1 : -1;
      c.p.face = c.face;
    }
  }

  setState(s) {
    this.state = s;
    this.st = 0;
  }

  /** 창문눈알: 다른 둥근 창으로 순간 이동 (far: 멀리 · 아니면 가까운 창 중에서) */
  hop(g, far) {
    const list = g.world.spots.filter((s) => s.kind === this.spot.kind && s !== this.spot && !s.monster);
    if (!list.length) return;
    list.sort((a, b) => dist(a.hx, a.hy, this.spot.hx, this.spot.hy) - dist(b.hx, b.hy, this.spot.hx, this.spot.hy));
    const s = far ? list[list.length - 1 - Math.floor(Math.random() * Math.min(2, list.length))] : list[Math.floor(Math.random() * Math.min(2, list.length))];
    this.spot.monster = null;
    this.spot = s;
    s.monster = this;
    this.x = s.hx;
    this.y = s.hy;
  }

  /** 나타나기 (가까이 · 물줄기 · 처음 발견) */
  reveal(g, why) {
    if (!this.hidden) return;
    this.tellK = -1;
    this.p.tell = 0;
    this.setState("emerge");
    this.atkCd = rand(0.9, 1.5);
    this.phase = this.id === "clam" ? "open" : this.id === "reefEel" ? "peek" : this.phase;
    this.cyc = this.id === "clam" ? 2.2 : this.id === "reefEel" ? 1.4 : this.cyc;
    g.onReveal(this, why);
  }

  /* ---------- 공격: 준비(빨갛게 눈썹) → 한 방 → 쉬기 ---------- */
  startAttack(g) {
    this.atk = { phase: "wind", t: 0 };
    g.audio.play("windup");
  }
  updateAttack(dt, g, d) {
    const A = this.def.atk;
    if (!A) return;
    if (this.atk) {
      const a = this.atk;
      a.t += dt;
      if (a.phase === "wind") {
        this.p.wind = Math.min(1, a.t / A.wind);
        if (this.B.windUp) this.B.windUp(this, g);
        if (a.t >= A.wind) {
          a.phase = "strike";
          a.t = 0;
          this.B.strike(this, g);
        }
      } else if (a.phase === "strike") {
        this.p.wind = Math.max(0, this.p.wind - dt * 4);
        if (a.t > 0.45) {
          this.atk = null;
          this.atkCd = A.cd * rand(0.85, 1.2);
          this.p.wind = 0;
        }
      }
      return;
    }
    this.atkCd -= dt;
    const can = this.B.canAttack ? this.B.canAttack(this) : true;
    if (can && this.atkCd <= 0 && d < A.range && g.player.alive) this.startAttack(g);
  }
  get winding() {
    return this.atk && this.atk.phase === "wind";
  }

  /**
   * 물방울이 맞았다. 돌려줌: "blocked" | "perfect" | "hit" | "reveal" | "capture"
   */
  hit(g, dmg, dir = 0, hx, hy) {
    if (this.state === "captured" || this.state === "flee") return null;
    if (this.hidden) {
      if (this.id === "porthole" && (this.p.vis || 0) < 0.4) return "blocked";
      if (this.B.hiddenBlock && this.B.hiddenBlock(this)) return "blocked";
      this.reveal(g, "water");
      this.p.hit = 1;
      return "reveal";
    }
    if (this.armor || (this.B.blocks && this.B.blocks(this, dir, hx, hy))) {
      return "blocked";
    }
    // 뜨거운 등딱지: 물이 증발 (공격 준비 중엔 PERFECT 가 우선)
    if (!this.winding && this.B.absorb && this.B.absorb(this, g, hx, hy)) {
      this.p.hit = 0.35;
      return "cool";
    }
    let res = "hit";
    if (this.winding) {
      // 공격 직전에 맞히면 PERFECT: 공격이 끊기고 잠깐 멍
      res = "perfect";
      this.atk = null;
      this.p.wind = 0;
      this.atkCd = this.def.atk.cd * 1.4;
      dmg *= 2;
    }
    this.hp -= dmg;
    this.p.hit = 1;
    if (this.B.react) this.B.react(this, g);
    if (this.hp <= 0) {
      this.capture(g);
      return res === "perfect" ? "perfect" : "capture";
    }
    // 도망 (체력이 정해진 비율 아래로)
    const th = (this.def.flee || [])[this.fleeIdx];
    if (th != null && this.hp <= this.maxHp * th) {
      this.fleeIdx++;
      this.startFlee(g);
    }
    return res;
  }

  /** 다른 숨는 곳으로 도망 (quiet: '도망!' 글자 없이) */
  startFlee(g, quiet) {
    if (this.id === "porthole") {
      this.hop(g, true);
      this.p.vis = 0;
      this.showT = 0;
      this.awayT = rand(1.2, 2);
      this.atk = null;
      g.onFlee(this, quiet);
      return;
    }
    if (this.B.hopFlee) {
      const before = this.spot;
      this.atk = null;
      this.p.wind = 0;
      if (this.B.flee) this.B.flee(this, g);
      this.hop(g, true);
      if (this.spot === before) {
        if (this.state !== "active") this.setState("active");
        return;
      }
      g.onFlee(this, quiet);
      this.B.hide(this, g);
      this.setState("hidden");
      this.tellT = rand(1.4, 2.4);
      g.onRehide(this);
      return;
    }
    const s = otherSpot(this, g, this.def.spots);
    if (!s) {
      if (this.state !== "active") this.setState("active");
      return;
    }
    this.atk = null;
    this.p.wind = 0;
    if (this.B.flee) this.B.flee(this, g);
    this.fleeTo = s;
    s.monster = this;
    this.setState("flee");
    g.onFlee(this, quiet);
  }

  capture(g) {
    for (const c of this.clones) if (c.on) g.fx.sparkle(c.x, c.y, 8, "#d8c8ff", 24);
    this.clones = [];
    this.state = "captured";
    this.capT = 0;
    this.atk = null;
    this.p.wind = 0;
    this.p.inflate = Math.min(this.p.inflate, 0.4);
    if (this.spot) this.spot.monster = null;
    g.onCapturing(this);
  }

  /** 지혁을 다치게 하는 범위 (공격 중 · 부푼 가시) */
  harm() {
    if (this.hurtT > 0) {
      const c = this.hurtAt ? this.hurtAt() : { x: this.x, y: this.y };
      return { x: c.x, y: c.y, r: this.hurtR };
    }
    if (this.contact) return { x: this.x, y: this.y, r: this.r * 0.9 };
    return null;
  }

  /** 소나: 가리개 너머로 보이는 청록 윤곽 (깜빡깜빡) */
  drawXray(ctx, cam, t) {
    const k = Math.min(1, this.sonarT / 0.5);
    const S = 280;
    if (!Monster.xc) {
      Monster.xc = document.createElement("canvas");
      Monster.xc.width = S;
      Monster.xc.height = S;
    }
    const xc = Monster.xc;
    const x = xc.getContext("2d");
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = "source-over";
    x.clearRect(0, 0, S, S);
    x.translate(S / 2, S / 2);
    x.scale(this.face, 1);
    const out = this.p.out;
    if (this.id === "reefEel") this.p.out = 0.55;
    drawMonster(x, this.id, this.p);
    this.p.out = out;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = "#8ff6ff";
    x.fillRect(0, 0, S, S);
    ctx.save();
    ctx.globalAlpha = (0.35 + 0.25 * Math.sin(t * 8)) * k;
    ctx.drawImage(xc, this.x - cam.x - S / 2, this.y + this.offY - cam.y - S / 2);
    ctx.restore();
  }

  draw(ctx, cam) {
    for (const c of this.clones) {
      if (!c.on) continue;
      ctx.save();
      ctx.translate(c.x - cam.x, c.y - cam.y);
      ctx.scale(c.face, 1);
      drawMonster(ctx, this.id, c.p);
      ctx.restore();
    }
    const x = this.x + (this.offX || 0) - cam.x;
    const y = this.y + this.offY - cam.y;
    ctx.save();
    ctx.translate(x, y);
    if (this.state === "captured") {
      // 포획 물방울 안에서 빙글 · 둥실
      const k = Math.min(1, this.capT / 0.4);
      ctx.rotate(Math.sin(this.capT * 6) * 0.3);
      ctx.scale(1 - k * 0.25, 1 - k * 0.25);
    }
    ctx.scale(this.face, 1);
    // 소나에 걸린 숨은 괴물: 테두리 빛
    if (this.sonarT > 0 && this.hidden) {
      ctx.save();
      ctx.shadowColor = "#8ff6ff";
      ctx.shadowBlur = 18;
      ctx.globalAlpha = 0.9;
      drawMonster(ctx, this.id, this.p);
      ctx.restore();
    } else drawMonster(ctx, this.id, this.p);
    ctx.restore();
    if (this.state === "captured") {
      // 포획 물방울
      const k = Math.min(1, this.capT / 0.4);
      const r = (this.r + 22) * (0.4 + k * 0.7);
      ctx.save();
      ctx.translate(x, y);
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, "rgba(255,255,255,0.35)");
      g.addColorStop(0.7, "rgba(160,235,255,0.18)");
      g.addColorStop(1, "rgba(200,250,255,0.55)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(235,252,255,0.9)";
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.22, r * 0.12, -0.6, 0, TAU);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
      ctx.restore();
    }
  }
}

/* ================================================================
 * 괴물이 쏘는 것 (진주 · 먹물 공 · 가시 ...)
 * ============================================================== */
export class Shot {
  constructor(o) {
    Object.assign(this, { life: 2, r: 8, dmg: 4, age: 0, on: true }, o);
  }
  update(dt, g) {
    this.age += dt;
    if (this.ay) this.vy += this.ay * dt;
    if (this.home && g.player) {
      // 도깨비불: 지혁 쪽으로 천천히 방향을 튼다
      const want = Math.atan2(g.player.y - this.y, g.player.x - this.x);
      let a = Math.atan2(this.vy, this.vx);
      let da = want - a;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      a += Math.max(-this.home * dt, Math.min(this.home * dt, da));
      const sp = this.speed || Math.hypot(this.vx, this.vy);
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.age > this.life || !g.world.open(this.x, this.y, 2)) {
      this.on = false;
      g.fx.splash(this.x, this.y, 0, 0.5);
    }
  }
  draw(ctx, cam, t) {
    const x = this.x - cam.x;
    const y = this.y - cam.y;
    if (this.kind === "rock") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.age * 6);
      ctx.fillStyle = "#8a7f74";
      ctx.strokeStyle = "#3a3430";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-this.r, -2);
      ctx.lineTo(-3, -this.r);
      ctx.lineTo(this.r, -3);
      ctx.lineTo(this.r * 0.6, this.r);
      ctx.lineTo(-this.r * 0.7, this.r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (this.kind === "spark") {
      // 별빛 전기 공
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(x, y, 1, x, y, this.r * 2.4);
      g.addColorStop(0, "rgba(255,250,200,0.95)");
      g.addColorStop(0.4, "rgba(255,200,240,0.6)");
      g.addColorStop(1, "rgba(200,140,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - this.r * 2.4, y - this.r * 2.4, this.r * 4.8, this.r * 4.8);
      ctx.restore();
      ctx.fillStyle = "#fffbe0";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? this.r * 0.45 : this.r;
        const a = (i / 10) * TAU + this.age * 6;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ff8ac8";
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }
    if (this.kind === "wisp") {
      // 도깨비불 (꼬리 달린 따뜻한 빛)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(x, y, 1, x, y, this.r * 2.6);
      g.addColorStop(0, "rgba(255,240,190,0.95)");
      g.addColorStop(0.4, "rgba(255,190,90,0.5)");
      g.addColorStop(1, "rgba(255,150,60,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - this.r * 2.6, y - this.r * 2.6, this.r * 5.2, this.r * 5.2);
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(x - this.vx * 0.04 * i, y - this.vy * 0.04 * i, this.r * (0.7 - i * 0.15), 0, TAU);
        ctx.fillStyle = `rgba(255,200,120,${0.5 - i * 0.12})`;
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, y, this.r * 0.55, 0, TAU);
      ctx.fillStyle = "#fffbe0";
      ctx.fill();
      return;
    }
    if (this.kind === "dart") {
      const a = Math.atan2(this.vy, this.vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(8, 0);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#6a5a40";
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(4, -7);
      ctx.lineTo(4, 7);
      ctx.closePath();
      ctx.fillStyle = "#9aa6a8";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#2a3436";
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (this.kind === "ice") {
      // 얼음 조각 (날아가는 쪽으로 뾰족)
      const a = Math.atan2(this.vy, this.vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(this.r * 1.8, 0);
      ctx.lineTo(-this.r, -this.r * 0.7);
      ctx.lineTo(-this.r * 0.5, 0);
      ctx.lineTo(-this.r, this.r * 0.7);
      ctx.closePath();
      ctx.fillStyle = "#dff6ff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#4a8ac0";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.r * 1.2, -1);
      ctx.lineTo(-this.r * 0.3, -this.r * 0.35);
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (this.kind === "snow") {
      // 눈뭉치 (빙글)
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.age * 8);
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, TAU);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#8ab0d0";
      ctx.stroke();
      for (const [px, py] of [
        [-4, -3],
        [4, 2],
        [-1, 5],
      ]) {
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, TAU);
        ctx.fillStyle = "#cfe2f2";
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (this.kind === "hot") {
      // 뜨거운 기포 (주황 빛)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(x, y, 1, x, y, this.r * 2.2);
      g.addColorStop(0, "rgba(255,200,120,0.8)");
      g.addColorStop(1, "rgba(255,90,30,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - this.r * 2.2, y - this.r * 2.2, this.r * 4.4, this.r * 4.4);
      ctx.restore();
      const w = Math.sin(this.age * 14) * 1.2;
      ctx.beginPath();
      ctx.ellipse(x, y, this.r + w, this.r - w, 0, 0, TAU);
      ctx.fillStyle = "rgba(255,150,70,0.55)";
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#ffe0a0";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - this.r * 0.35, y - this.r * 0.35, this.r * 0.28, 0, TAU);
      ctx.fillStyle = "#fff6d0";
      ctx.fill();
      return;
    }
    if (this.kind === "coin") {
      const sq = Math.abs(Math.cos(this.age * 12));
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = "#a06a00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, this.r * (0.35 + sq * 0.65), this.r, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      return;
    }
    if (this.kind === "ink") {
      ctx.fillStyle = "rgba(50,24,90,0.92)";
      ctx.beginPath();
      ctx.arc(x, y, this.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(160,120,220,0.5)";
      ctx.beginPath();
      ctx.arc(x - 3, y - 3, this.r * 0.4, 0, TAU);
      ctx.fill();
      return;
    }
    if (this.kind === "pearl") {
      const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, this.r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.6, "#f2eaff");
      g.addColorStop(1, "#b9a6ff");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, this.r, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#7a6ab8";
      ctx.stroke();
      // 꼬리 기포
      ctx.fillStyle = "rgba(230,250,255,0.6)";
      ctx.beginPath();
      ctx.arc(x - this.vx * 0.03, y - this.vy * 0.03, 3, 0, TAU);
      ctx.fill();
    }
  }
}
