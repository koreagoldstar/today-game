/*
 * 자석 대소동 · 게임 규칙 (화면과 상관없는 순수 계산 — 브라우저 · 자동 풀이 점검이 같은 코드)
 *
 * ■ 재질
 *   철(iron)   : N · S 어느 쪽이든 강하게 끌려온다 (철은 자석이 아니라서 밀려나지 않음)
 *   합금(alloy): 끌려오지만 힘이 약하다 (절반 아래)
 *   나무 · 고무: 자석과 상관없음 (몸으로 밀기 · 고무는 잘 튕김)
 *   자석 블록(magN · magS): 같은 극이면 밀려나고, 다른 극이면 끌려온다
 * ■ 자석 힘: 범위 안에서만 · 가까울수록 세게 · 무거울수록 덜 움직임 · 힘과 속도 상한
 *   딱 붙는 거리에서는 '용수철 + 브레이크'로 붙잡음 → 중심으로 끝없이 빨려 들거나 떨리지 않음
 * ■ 장치: 누름 스위치 · 목표 칸(올려놓으면 딸깍 고정) · 문 · 출구 · 컨베이어 · 스프링 · 움직이는 발판 · 리프트
 *         고정 전자석(극 · 켜짐 조건) · 자석 레일(천장 띠) · 레버(가까이서 '조작')
 * ■ 화면 밖: 물체가 떨어지면 처음 자리로 '뿅' · 마그가 떨어지면 시작 자리로 (실패 아님)
 * ■ 에너지(일부 스테이지): 자석을 켜 두면 줄고, 끄면 다시 찬다(회복 0 인 스테이지도 있음). 0 이면 자석이 꺼진다
 */
import { World, Body, DT, overlap } from "./physics.js?v=1";

export const ROBOT = { w: 36, h: 42, m: 2.2, speed: 240, jump: 660, acc: 16, airAcc: 8 };
export const MAG = { range: 210, strength: 4200, holdGap: 8, maxAcc: 4200, maxSpeed: 760 };
export const MAT = {
  iron: { k: 1, metal: true, m: 1, label: "철" },
  alloy: { k: 0.5, metal: true, m: 0.7, label: "합금" }, // 가벼운 합금: 철의 절반 힘 · 가까이서는 따라오고 멀면 살살
  wood: { k: 0, metal: false, m: 0.8, label: "나무" },
  rubber: { k: 0, metal: false, m: 0.6, label: "고무" },
  magN: { k: 1, metal: true, pole: "N", m: 1, label: "자석 N" },
  magS: { k: 1, metal: true, pole: "S", m: 1, label: "자석 S" },
};

/** 물체 하나 → 물리 몸체 */
function makeObject(o) {
  const M = MAT[o.mat];
  const ball = o.shape === "ball";
  const size = o.size || (ball ? 30 : 48);
  const heavy = o.heavy ? 2 : 1; // 무거운 상자: 들 수는 없고 끌 수만
  const b = new Body({
    id: o.id,
    shape: ball ? "circle" : "box",
    x: o.x,
    y: o.y,
    r: ball ? size / 2 : undefined,
    w: ball ? undefined : size,
    h: ball ? undefined : o.h || size,
    m: (o.m || M.m * (ball ? 1 : 1.6)) * heavy,
    e: o.mat === "rubber" ? 0.72 : ball ? 0.18 : 0.05,
    mu: ball ? (o.mat === "rubber" ? 0.6 : 0.06) : o.mat === "wood" ? 0.55 : o.heavy ? 0.3 : 0.45,
    mat: o.mat,
    data: { obj: true, kind: o.shape || "crate", heavy: !!o.heavy, label: o.label || "" },
  });
  return b;
}

const wallBody = (r, extra = {}) => new Body({ type: "static", x: r[0] + r[2] / 2, y: r[1] + r[3] / 2, w: r[2], h: r[3], mu: 0.6, mat: "wall", ...extra });

export function createGame(def) {
  const W = def.world || { w: 960, h: 540 };
  const world = new World(W);
  const G = {
    def,
    world,
    W: W.w,
    H: W.h,
    t: 0,
    frame: 0,
    mag: { on: false, pole: def.pole || "S" },
    uses: 0,
    poleSwitches: 0,
    energy: def.energy ? def.energy.max : null,
    won: false,
    failed: null,
    emptyT: 0,
    falls: 0,
    gearGot: false,
    events: [],
    facing: 1,
    coyote: 0,
    jumpBuf: 0,
    jumpCut: false,
    held: new Set(),
    walls: [],
    objs: [],
    sensors: {},
    switches: [],
    goals: [],
    doors: [],
    conveyors: [],
    springs: [],
    platforms: [],
    lifts: [],
    magnets: [],
    levers: [],
    exit: null,
    squash: 0,
    sense: {},
  };
  // 바깥 벽 (천장은 없음 → 위로 날아가도 다시 떨어짐)
  const out = [
    [-40, 0, 40, W.h + 200],
    [W.w, 0, 40, W.h + 200],
  ];
  for (const r of out) G.walls.push(world.add(wallBody(r)));
  for (const r of def.walls || []) G.walls.push(world.add(wallBody(r, { mat: r[4] || "wall" })));
  for (const o of def.objects || []) G.objs.push(world.add(makeObject(o)));
  // 누름 스위치: 바닥과 같은 높이 (턱이 없어 물체가 그대로 미끄러져 올라옴) · s.y 는 바닥 윗면 · 그 위 감지 칸
  for (const s of def.switches || []) G.switches.push({ ...s, on: false, press: 0 });
  for (const g of def.goals || []) G.goals.push({ ...g, on: false, locked: null });
  for (const d of def.doors || []) {
    const body = world.add(new Body({ type: "static", x: d.x + d.w / 2, y: d.y + d.h / 2, w: d.w, h: d.h, mu: 0.4, mat: "door" }));
    G.doors.push({ ...d, body, frac: 0, want: 0 }); // frac: 0 닫힘 ~ 1 열림
  }
  for (const c of def.conveyors || []) {
    const body = world.add(new Body({ type: "static", x: c.x + c.w / 2, y: c.y + c.h / 2, w: c.w, h: c.h, mu: 0.9, mat: "belt" }));
    G.conveyors.push({ ...c, body, roll: 0 });
  }
  for (const s of def.springs || []) {
    // 스프링 판: 윗면이 s.y (바닥 높이에 두면 물체가 밀려 올라탐) · 그 아래 14
    const body = world.add(new Body({ type: "static", x: s.x + s.w / 2, y: s.y + 7, w: s.w, h: 14, mu: 0.5, e: 0, mat: "spring" }));
    G.springs.push({ ...s, body, squeeze: 0, cool: new Map() });
  }
  for (const p of def.platforms || []) {
    const body = world.add(new Body({ id: p.id, type: "kinematic", x: p.x + p.w / 2, y: p.y + p.h / 2, w: p.w, h: p.h, mu: 0.9, mat: "platform" }));
    G.platforms.push({ ...p, body, phase: p.phase || 0 });
  }
  for (const l of def.lifts || []) {
    const body = world.add(new Body({ id: l.id, type: "kinematic", x: l.x + l.w / 2, y: l.y + l.h / 2, w: l.w, h: l.h, mu: 0.9, mat: "lift" }));
    G.lifts.push({ ...l, body, y1: l.y + l.h / 2, y2: l.y2 + l.h / 2 });
  }
  for (const m of def.magnets || []) {
    const body = m.rail ? null : world.add(new Body({ type: "static", x: m.x + m.w / 2, y: m.y + m.h / 2, w: m.w, h: m.h, mu: 0.6, mat: "emag" }));
    G.magnets.push({ ...m, body, active: false });
  }
  for (const l of def.levers || []) G.levers.push({ ...l, on: !!l.on });
  if (def.exit) G.exit = { ...def.exit, open_: false };
  // 마그
  const R = new Body({ id: "robot", x: def.start.x, y: def.start.y, w: ROBOT.w, h: ROBOT.h, m: ROBOT.m, mu: 0, e: 0, mat: "robot", data: { robot: true } });
  G.robot = world.add(R);
  // 자석에 붙은 물체는 마그 몸과 부딪히지 않음 (머리 위 공에 막혀 못 뛰거나 공 위에 올라타는 일 없게)
  world.skip = (a, b) => (a === R && G.held.has(b.id)) || (b === R && G.held.has(a.id));
  return G;
}

const ev = (G, type, data = {}) => G.events.push({ type, t: G.t, ...data });

/** 조건 이름 → 켜졌나 (스위치 · 목표 · 레버 · "always") */
function active(G, name) {
  if (!name || name === "always") return true;
  if (name.includes("&")) return name.split("&").every((n) => active(G, n));
  if (name.includes("|")) return name.split("|").some((n) => active(G, n));
  if (name.startsWith("!")) return !active(G, name.slice(1));
  return !!G.sense[name];
}
const allOn = (G, list) => (list || []).every((n) => active(G, n));

/** 자석이 물체에 주는 힘 (cx,cy 자석 중심 · 극 · 범위 · 세기) — 끌어당기는 대상이면 붙잡음 */
function magnetForce(G, b, cx, cy, pole, range, strength, holdTo) {
  const M = MAT[b.mat];
  if (!M || !M.metal || b.type !== "dynamic") return false;
  const dx = cx - b.x;
  const dy = cy - b.y;
  const d = Math.hypot(dx, dy) || 0.001;
  if (d > range + b.r) return false;
  let sign = 1; // +1 끌어당김 · -1 밀어냄
  if (M.pole) sign = M.pole === pole ? -1 : 1;
  const ux = dx / d;
  const uy = dy / d;
  const near = Math.max(0, 1 - d / range);
  let f = strength * M.k * (0.35 + 0.65 * near); // 가까울수록 세게
  const maxF = MAG.maxAcc * b.m;
  if (sign > 0 && holdTo) {
    // 붙잡는 거리: 몸체 끝과 자석 사이 약간의 틈
    const gap = holdTo + b.r + MAG.holdGap;
    if (d < gap + 26) {
      // 가까우면 용수철(목표 거리) + 상대 속도 브레이크 → 함께 따라다님
      const pull = (d - gap) * 130 * b.m;
      const rvx = b.vx - G.robot.vx;
      const rvy = b.vy - G.robot.vy;
      const fx = ux * pull - rvx * 11 * b.m;
      const fy = uy * pull - rvy * 11 * b.m - 1900 * b.m * 0.6; // 붙잡은 것은 무게를 조금 버텨 줌
      const lim = Math.min(maxF, strength * M.k * 1.25);
      const mag = Math.hypot(fx, fy);
      const s = mag > lim ? lim / mag : 1;
      b.fx += fx * s;
      b.fy += fy * s;
      return true;
    }
  }
  f = Math.min(f, maxF);
  b.fx += ux * f * sign;
  b.fy += uy * f * sign;
  return sign > 0 && d < 90;
}

/** 직사각형 위 가장 가까운 점 (자석 레일) */
function closestOn(r, x, y) {
  return [Math.max(r.x, Math.min(x, r.x + r.w)), Math.max(r.y, Math.min(y, r.y + r.h))];
}

/**
 * 한 걸음 (1/120초)
 * input: { left, right, jump(누르고 있음), jumpPressed, magPressed, polPressed, usePressed }
 */
export function stepGame(G, input) {
  G.events.length = 0;
  if (G.won || G.failed) {
    G.robot.vx *= 0.85; // 끝나면 마그는 제자리에서 기뻐함 (미끄러지지 않게)
    G.world.step(DT);
    G.t += DT;
    G.frame++;
    return;
  }
  const R = G.robot;
  const D = G.def;
  // ---------- 입력 → 마그 ----------
  if (input.magPressed) {
    if (!G.mag.on && G.energy != null && G.energy <= 0.5) ev(G, "no-energy");
    else {
      G.mag.on = !G.mag.on;
      if (G.mag.on) G.uses++;
      ev(G, G.mag.on ? "mag-on" : "mag-off");
    }
  }
  if (input.polPressed) {
    G.mag.pole = G.mag.pole === "N" ? "S" : "N";
    G.poleSwitches++;
    ev(G, "pole", { pole: G.mag.pole });
  }
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) G.facing = dir;
  const grounded = !!R.ground;
  G.coyote = grounded ? 0.09 : Math.max(0, G.coyote - DT);
  if (input.jumpPressed) G.jumpBuf = 0.12;
  else G.jumpBuf = Math.max(0, G.jumpBuf - DT);
  // 무거운 것을 자석으로 끄는 동안은 천천히 (힘껏 끄는 느낌 · 상자가 따라올 수 있게)
  let speed = ROBOT.speed;
  for (const id of G.held) {
    const b = G.objs.find((q) => q.id === id);
    if (b && b.data.heavy) speed = ROBOT.speed * 0.45;
  }
  // 밟고 있는 것(컨베이어 · 발판)의 속도 + 걷기
  const target = dir * speed + (grounded ? R.groundVx : 0);
  const acc = grounded ? ROBOT.acc : ROBOT.airAcc;
  R.vx += (target - R.vx) * Math.min(1, acc * DT);
  if (G.jumpBuf > 0 && (grounded || G.coyote > 0)) {
    R.vy = -ROBOT.jump;
    G.jumpBuf = 0;
    G.coyote = 0;
    G.jumpCut = true;
    ev(G, "jump");
  }
  if (G.jumpCut && !input.jump && R.vy < -220) {
    R.vy *= 0.5;
    G.jumpCut = false;
  }
  if (R.vy >= 0) G.jumpCut = false;
  // ---------- 조작 (레버) ----------
  if (input.usePressed) {
    let best = null;
    for (const l of G.levers) {
      const d = Math.abs(l.x - R.x) + Math.abs(l.y - R.y) * 0.6;
      if (d < 70 && (!best || d < best.d)) best = { l, d };
    }
    if (best) {
      best.l.on = !best.l.on;
      ev(G, "lever", { id: best.l.id, on: best.l.on });
    } else ev(G, "use-none");
  }
  // ---------- 에너지 ----------
  if (G.energy != null) {
    const E = D.energy;
    if (G.mag.on) {
      G.energy = Math.max(0, G.energy - E.drain * DT);
      if (G.energy <= 0) {
        G.mag.on = false;
        ev(G, "empty");
      }
    } else G.energy = Math.min(E.max, G.energy + (E.regen || 0) * DT);
  }
  // ---------- 감지 (지난 걸음 위치 기준) ----------
  sense(G);
  // ---------- 자석 힘 ----------
  G.held.clear();
  if (G.mag.on) {
    const cx = R.x - G.facing * 4;
    const cy = R.y - 6;
    for (const b of G.objs) if (magnetForce(G, b, cx, cy, G.mag.pole, MAG.range, MAG.strength, Math.max(R.hw, R.hh) * 0.86)) G.held.add(b.id);
  }
  for (const m of G.magnets) {
    const was = m.active;
    m.active = active(G, m.on || "always");
    if (m.active && was === false) ev(G, "magnet-wake", { id: m.id });
    if (!m.active) continue;
    for (const b of G.objs) {
      if (m.rail) {
        // 자석 레일: 띠 위 가장 가까운 점으로 (붙으면 그 자리에서 미끄러지듯)
        const [px, py] = closestOn(m, b.x, b.y);
        const dx = px - b.x;
        const dy = py - b.y;
        const d = Math.hypot(dx, dy);
        const M = MAT[b.mat];
        if (!M || !M.metal || d > m.range) continue;
        const f = Math.min(m.strength * M.k, MAG.maxAcc * b.m);
        if (d > b.r + 2) {
          b.fx += (dx / d) * f;
          b.fy += (dy / d) * f;
        } else {
          b.fy -= 1900 * b.m * 1.02; // 띠에 붙어 있음 (중력 버팀)
          b.vy *= 0.6;
        }
        continue;
      }
      magnetForce(G, b, m.x + m.w / 2, m.y + m.h / 2, m.pole, m.range || 170, m.strength || 3800, 0);
    }
  }
  // 자석 힘을 받는 물체는 속도 상한 (튕겨 나가지 않게)
  for (const b of G.objs) {
    if (!b.fx && !b.fy) continue;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAG.maxSpeed) {
      b.vx *= MAG.maxSpeed / sp;
      b.vy *= MAG.maxSpeed / sp;
    }
  }
  // ---------- 움직이는 장치 ----------
  for (const p of G.platforms) {
    // 두 점 사이를 오감 (멈춤 시간 포함)
    const [a, b2] = p.path;
    const len = Math.hypot(b2[0] - a[0], b2[1] - a[1]);
    const travel = len / (p.speed || 80);
    const per = 2 * (travel + (p.pause || 0.6));
    let k = ((G.t + p.phase) % per) / per;
    let u;
    const tp = travel / per;
    const pp = (p.pause || 0.6) / per;
    if (k < pp) u = 0;
    else if (k < pp + tp) u = (k - pp) / tp;
    else if (k < 2 * pp + tp) u = 1;
    else u = 1 - (k - 2 * pp - tp) / tp;
    if (p.on && !active(G, p.on)) u = p.u != null ? p.u : 0;
    p.u = u;
    const tx = a[0] + (b2[0] - a[0]) * u + p.w / 2;
    const ty = a[1] + (b2[1] - a[1]) * u + p.h / 2;
    p.body.vx = (tx - p.body.x) / DT;
    p.body.vy = (ty - p.body.y) / DT;
  }
  for (const l of G.lifts) {
    const want = active(G, l.on) ? l.y2 : l.y1;
    const dy = want - l.body.y;
    const v = Math.sign(dy) * Math.min(Math.abs(dy) / DT, l.speed || 90);
    l.body.vy = v;
    l.body.vx = 0;
  }
  for (const c of G.conveyors) {
    const run = !c.on || active(G, c.on);
    const rev = c.rev && active(G, c.rev) ? -1 : 1;
    c.body.surf = run ? c.speed * rev : 0;
    c.roll += c.body.surf * DT;
  }
  // 문: 조건이 맞으면 위로 열림 · 닫힐 때 무언가 끼면 멈춤
  for (const d of G.doors) {
    const want = (d.any ? (d.open || []).some((n) => active(G, n)) : allOn(G, d.open)) ? 1 : 0;
    if (want !== d.want) ev(G, want ? "door-open" : "door-close", { id: d.id });
    d.want = want;
    let next = d.frac + Math.sign(want - d.frac) * DT * (want ? 2.4 : 1.6);
    next = Math.max(0, Math.min(1, next));
    if (next < d.frac) {
      // 닫히는 중: 새 높이에 무언가 있으면 그대로
      const h = d.h * (1 - next);
      const probe = { left: d.x, right: d.x + d.w, top: d.y, bottom: d.y + h };
      const blocked = [R, ...G.objs].some((b) => b.type === "dynamic" && overlap(probe, b));
      if (blocked) next = d.frac;
    }
    d.frac = next;
    const h = Math.max(0.001, d.h * (1 - d.frac));
    d.body.hh = h / 2;
    d.body.y = d.y + h / 2;
    d.body.solid = d.frac < 0.97;
  }
  // ---------- 물리 ----------
  G.world.step(DT);
  G.t += DT;
  G.frame++;
  // 작은 턱(8 이하)은 걸어서 넘어감 (구덩이를 메운 상자 · 스위치 판 모서리)
  if (dir && R.ground) {
    for (const c of G.world.contacts) {
      if (c.a !== R && c.b !== R) continue;
      const o = c.a === R ? c.b : c.a;
      if (Math.abs(c.nx) < 0.5 || o.type === "dynamic") continue;
      const sideOk = (o.x - R.x) * dir > 0;
      const rise = R.bottom - o.top;
      if (sideOk && rise > 0 && rise <= 9) {
        R.y -= rise + 0.5;
        R.vx = dir * Math.max(Math.abs(R.vx), 60);
      }
    }
  }
  // ---------- 스프링 ----------
  for (const s of G.springs) {
    s.squeeze = Math.max(0, s.squeeze - DT * 4);
    for (const b of [R, ...G.objs]) {
      if (b.ground !== s.body) continue;
      const cd = s.cool.get(b.id) || 0;
      if (G.t < cd) continue;
      b.vy = -(s.power || 1000);
      s.cool.set(b.id, G.t + 0.25);
      s.squeeze = 1;
      ev(G, "spring", { id: b.id });
    }
  }
  // 무거운 상자에 눌림 (재미 연출)
  for (const b of G.objs) {
    if (b.data.kind === "crate" && b.ground === R) {
      if (G.squash <= 0) ev(G, "squash");
      G.squash = 0.6;
    }
  }
  G.squash = Math.max(0, G.squash - DT);
  // 부딪힘 소리
  for (const b of G.objs) if (b.hit > 260 && MAT[b.mat].metal) ev(G, "clank", { id: b.id, v: b.hit });
  // ---------- 목표 칸: 들어오면 딸깍 고정 ----------
  for (const g of G.goals) {
    if (g.locked) continue;
    for (const b of G.objs) {
      if (b.type !== "dynamic") continue;
      if (g.accepts && !g.accepts.includes(b.mat) && !g.accepts.includes(b.data.kind)) continue;
      if (b.x > g.x && b.x < g.x + g.w && b.y > g.y && b.y < g.y + g.h && Math.hypot(b.vx, b.vy) < 520) {
        // 딸깍 → 칸 안으로 쏙 (더는 부딪히지 않아 길을 막지 않음)
        g.locked = b.id;
        b.type = "static";
        b.solid = false;
        b.im = 0;
        b.m = 0;
        b.vx = b.vy = 0;
        b.x = g.x + g.w / 2;
        b.y = g.y + g.h - b.hh;
        b.data.stored = G.t;
        G.held.delete(b.id);
        ev(G, "lock", { id: g.id, obj: b.id });
        break;
      }
    }
  }
  // ---------- 화면 밖 ----------
  for (const b of G.objs) {
    if (b.type !== "dynamic") continue;
    if (b.y > G.H + 80 || b.x < -60 || b.x > G.W + 60) {
      b.x = b.home.x;
      b.y = b.home.y;
      b.vx = b.vy = 0;
      ev(G, "respawn", { id: b.id });
    }
  }
  if (R.y > G.H + 60) {
    R.x = D.start.x;
    R.y = D.start.y;
    R.vx = R.vy = 0;
    G.falls++;
    G.mag.on = false;
    ev(G, "fall");
  }
  // ---------- 기어 · 출구 ----------
  if (D.gear && !G.gearGot && Math.abs(R.x - D.gear.x) < 30 && Math.abs(R.y - D.gear.y) < 34) {
    G.gearGot = true;
    ev(G, "gear");
  }
  sense(G);
  if (G.exit) {
    if (G.exit.ride) {
      const p = G.platforms.find((q) => q.id === G.exit.ride) || G.lifts.find((q) => q.id === G.exit.ride);
      if (p) {
        G.exit.x = p.body.x - G.exit.w / 2;
        G.exit.y = p.body.top - G.exit.h;
      }
    }
    const open = allOn(G, G.exit.open);
    if (open && !G.exit.open_) ev(G, "exit-open");
    G.exit.open_ = open;
    if (open && R.x > G.exit.x && R.x < G.exit.x + G.exit.w && R.y > G.exit.y && R.y < G.exit.y + G.exit.h) {
      G.won = true;
      G.winT = G.t;
      G.mag.on = false;
      ev(G, "win");
    }
  }
  // 에너지가 바닥나고 다시 차지 않으면 (물체가 굴러가 해결될 시간 3초 뒤) 실패
  if (G.energy != null && !D.energy.regen && G.energy <= 0 && !G.won) {
    G.emptyT += DT;
    if (G.emptyT > 3) {
      G.failed = "energy";
      ev(G, "fail", { why: "energy" });
    }
  }
}

/** 스위치 · 목표 · 레버 상태 */
function sense(G) {
  const S = G.sense;
  const R = G.robot;
  for (const s of G.switches) {
    const zone = { left: s.x + 2, right: s.x + s.w - 2, top: s.y - 16, bottom: s.y + 2 };
    let on = false;
    for (const b of [R, ...G.objs]) {
      if (!overlap(zone, b)) continue;
      if (b === R && s.accepts && s.accepts !== "any") continue;
      if (b !== R && Array.isArray(s.accepts) && !s.accepts.includes(b.mat)) continue;
      if (b.bottom < s.y - 6) continue; // 위에 떠 있으면 안 눌림
      on = true;
      break;
    }
    if (s.latch && s.on) on = true;
    if (on && !s.on) ev(G, "switch-on", { id: s.id });
    if (!on && s.on) ev(G, "switch-off", { id: s.id });
    s.on = on;
    s.press += ((on ? 1 : 0) - s.press) * 0.3;
    S[s.id] = on;
  }
  for (const g of G.goals) S[g.id] = !!g.locked;
  for (const l of G.levers) S[l.id] = l.on;
}

/**
 * 이름 조건 (안내 · 풀이 로봇): "start" · "moved" · "exit" · "won" · "held:물체" · "near:목표나 물체" · "magOn"
 *  "energy<35" · "물체.x>520" · "robot.y<300" · "a&b" · "a|b" · "!a" · 그 밖은 스위치 · 목표 · 레버 id
 */
export function cond(G, name) {
  if (name.includes("&")) return name.split("&").every((n) => cond(G, n));
  if (name.includes("|")) return name.split("|").some((n) => cond(G, n));
  if (name.startsWith("!")) return !cond(G, name.slice(1));
  if (name === "start") return true;
  if (name === "moved") return Math.abs(G.robot.x - G.def.start.x) > 50;
  if (name === "exit") return !!(G.exit && G.exit.open_);
  if (name === "won") return G.won;
  if (name === "magOn") return G.mag.on;
  if (name.startsWith("held:")) return G.held.has(name.slice(5));
  if (name.startsWith("energy<")) return G.energy != null && G.energy < Number(name.slice(7));
  if (name.startsWith("near:")) {
    const id = name.slice(5);
    const goal = G.goals.find((q) => q.id === id);
    const obj = G.objs.find((q) => q.id === id);
    const x = goal ? goal.x + goal.w / 2 : obj ? obj.x : -1e9;
    return Math.abs(G.robot.x - x) < 130;
  }
  const m = name.match(/^(\w+)\.(x|y)([<>])(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const b = m[1] === "robot" ? G.robot : G.world.bodies.find((q) => q.id === m[1]);
    if (!b) return false;
    return m[3] === "<" ? b[m[2]] < Number(m[4]) : b[m[2]] > Number(m[4]);
  }
  return !!G.sense[name];
}

/** 별 (스테이지마다 조건) */
export function starsOf(G) {
  const D = G.def;
  const st = D.stars || {};
  const t = G.winT != null ? G.winT : G.t;
  const got = [true, t <= (st.time || 9999), false];
  const sp = st.special || { type: "gear" };
  if (sp.type === "gear") got[2] = G.gearGot;
  else if (sp.type === "energy") got[2] = G.energy != null && G.energy >= sp.n;
  else if (sp.type === "uses") got[2] = G.uses <= sp.n;
  else if (sp.type === "poles") got[2] = G.poleSwitches <= sp.n;
  return { n: got.filter(Boolean).length, got };
}
export function specialText(D) {
  const sp = (D.stars && D.stars.special) || { type: "gear" };
  if (sp.type === "gear") return "숨은 기어 찾기";
  if (sp.type === "energy") return `에너지 ${sp.n}% 이상 남기기`;
  if (sp.type === "uses") return sp.n === 0 ? "자석 없이 깨기" : `자석 ${sp.n}번 이하로 켜기`;
  if (sp.type === "poles") return `극 ${sp.n}번 이하로 바꾸기`;
  return "";
}
