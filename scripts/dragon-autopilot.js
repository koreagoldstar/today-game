/**
 * 드래곤 석상 대작전 · 모험 자동 조종 (점검용)
 *  page.evaluate(installBot, god) 로 페이지 안에 넣는다. 입력(input.move · consume · jumpHeld)만 바꿔 끼우고
 *  게임 규칙 · 물리 · 판정은 그대로 쓴다 → "사람이 끝까지 갈 수 있는 길인가"를 확인하는 용도.
 *  god=true 면 하트가 줄지 않는다 (길 · 보스 패턴 끝까지 보기용).
 */
"use strict";

function installBot(god) {
  const A = DragonStatue.adv;
  const bot = (window.__bot = { move: { x: 0, y: 0 }, flags: {}, held: false, holdT: 0, log: [], stuck: 0, lastK: 0 });
  A.input.move = () => bot.move;
  A.input.consume = () => {
    const f = bot.flags;
    bot.flags = {};
    return f;
  };
  Object.defineProperty(A.input, "jumpHeld", { get: () => bot.held, configurable: true });
  if (god) A.loseHeart = function () { this.g.ui.advSet({ hearts: this.hearts }); };
  const V3 = DragonStatue.cam.position.constructor;
  let last = performance.now();
  const tick = () => {
    requestAnimationFrame(tick);
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    const P = A.player;
    const L = A.level;
    if (!P || !L || (A.state !== "PLAYING" && A.state !== "CHECKPOINT" && A.state !== "BOSS_BATTLE")) {
      bot.move = { x: 0, y: 0 };
      return;
    }
    let tx, tz;
    if (A.boss && A.state === "BOSS_BATTLE") {
      const B = A.boss;
      if (B.weakOpen) {
        const w = B.weakPos();
        tx = w.x - P.pos.x;
        tz = w.z - P.pos.z;
        if (Math.hypot(tx, tz) < 1.8) bot.flags.attack = true;
      } else {
        // 보스 주위를 돌며 거리 유지
        const dx = P.pos.x - B.pos.x, dz = P.pos.z - B.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        const want = 8.5;
        tx = (-dz / d) * 1 + (dx / d) * (want - d) * 0.5;
        tz = (dx / d) * 1 + (dz / d) * (want - d) * 0.5;
        if (B.state === "tail" || (B.waves && B.waves.some((w) => Math.abs(Math.hypot(P.pos.x - w.c.x, P.pos.z - w.c.z) - (2 + w.t * 8.5)) < 1.6))) bot.flags.jump = true, (bot.held = true), (bot.holdT = 0.3);
        if (B.state === "charge") bot.flags.dash = true;
      }
    } else {
      const pr = L.progress(P.pos, {});
      const i = Math.min(L.path.length - 1, pr.seg + 1);
      const tgt = L.path[i];
      tx = tgt.x - P.pos.x;
      tz = tgt.z - P.pos.z;
      if (Math.hypot(tx, tz) < 0.8 && i + 1 < L.path.length) {
        tx = L.path[i + 1].x - P.pos.x;
        tz = L.path[i + 1].z - P.pos.z;
      }
      // 앞을 0.25m 씩 훑어서: 틈 시작 s0 · 착지 시작 s1 · 착지 끝 s2 (또는 턱)
      const dl = Math.hypot(tx, tz) || 1;
      const ux = tx / dl, uz = tz / dl;
      let s0 = -1, s1 = -1, s2 = 9, wall = -1, moverNear = true;
      let landTop = null;
      for (let d = 0.3; d <= 7; d += 0.25) {
        const x = P.pos.x + ux * d, z = P.pos.z + uz * d;
        const g = L.ground(x, z, 0.3, P.pos.y + 1.4);
        const base = P.onGround ? P.pos.y : (A.lastGroundY ?? P.pos.y);
        const ok = g && g.h > base - 1.7;
        if (ok && s0 >= 0 && s1 < 0) landTop = g.h;
        if (g && g.h > P.pos.y + 0.42 && wall < 0 && s0 < 0) wall = d;
        if (s0 < 0 && !ok) s0 = d;
        else if (s0 >= 0 && s1 < 0 && ok) {
          s1 = d;
          if (g.s.mover) {
            // 옆으로 움직이는 발판: 가운데가 지금 내 앞 줄 가까이 있고
            const o = L.dyn.find((q) => q.solid === g.s);
            if (o) {
              const cx = (o.solid.x0 + o.solid.x1) / 2, cz = (o.solid.z0 + o.solid.z1) / 2;
              const lat = Math.abs((cx - P.pos.x) * -uz + (cz - P.pos.z) * ux);
              const lateral = Math.abs(o.a.x - o.b.x) * Math.abs(uz) + Math.abs(o.a.z - o.b.z) * Math.abs(ux) > 1;
              // 뛰어서 닿을 즈음(약 0.75초 뒤) 발판 가운데가 내 앞 줄에 맞을 때만
              const lat2 = Math.abs((cx + o.solid.dx * 45 - P.pos.x) * -uz + (cz + o.solid.dz * 45 - P.pos.z) * ux);
              if (lateral && (lat > 0.9 || lat2 > 0.6)) moverNear = false;
              // 앞뒤로 오가는 발판: 끝에서 거의 멈췄을 때만 올라탄다 (사람도 그때 뛴다)
              if (!lateral && Math.hypot(o.solid.dx, o.solid.dz) * 60 > 0.9) moverNear = false;
            }
          }
        } else if (s1 >= 0 && !ok) {
          s2 = d;
          break;
        }
      }
      // 아주 좁은 틈(발판 사이 이음새)은 그냥 달린다
      if (s0 >= 0 && s1 >= 0 && s1 - s0 < 0.7 && moverNear) { s0 = -1; s1 = -1; }
      // 틈 위에 움직이는 발판만 있고 아직 멀면 기다린다
      let speed = 1;
      if (s0 >= 0 && s1 < 0) {
        speed = s0 > 0.9 ? 0.5 : 0;
      }
      // 틈이 너무 넓거나 착지할 곳이 너무 높으면 (움직이는 발판 · 승강 발판이 아직 멀면) 기다린다
      // 앞뒤로 오가는 발판 위에서는 발판이 끝에 멈췄을 때 내린다
      const gs = P.onGround && P.groundSolid && P.groundSolid.mover ? L.dyn.find((q) => q.solid === P.groundSolid) : null;
      const ridingFast = gs && Math.abs(gs.a.y - gs.b.y) < 0.1 && Math.hypot(gs.solid.dx, gs.solid.dz) * 60 > 0.9 && Math.abs(gs.a.x - gs.b.x) * Math.abs(uz) + Math.abs(gs.a.z - gs.b.z) * Math.abs(ux) <= 1;
      const feasible = !ridingFast && moverNear && s0 >= 0 && s1 >= 0 && s1 - s0 <= 2.8 && (landTop == null || landTop <= P.pos.y + 1.3);
      if (s0 >= 0 && !feasible) speed = s0 > 0.9 ? 0.5 : 0;
      if (feasible) {
        const land = s1 + Math.min(1.4, (s2 - s1) * 0.4);
        const D = land - s0 + 0.5; // 틈 앞 0.5m 에서 뛴다고 보고 필요한 거리
        speed = Math.max(0.42, Math.min(1, D / 4.8));
        if (s0 < 0.7 && P.onGround) {
          bot.flags.jump = true;
          bot.held = true;
          bot.holdT = 0.4;
        }
      } else if (wall >= 0 && wall < 1.1 && P.onGround) {
        bot.flags.jump = true;
        bot.held = true;
        bot.holdT = 0.4;
      }
      bot.speed = speed;
      bot.dbg = { x: +P.pos.x.toFixed(1), y: +P.pos.y.toFixed(1), z: +P.pos.z.toFixed(1), s0, s1, s2, speed, moverNear, landTop };
      if (P.onGround) A.lastGroundY = P.pos.y;
      // 적 · 부술 것이 가까우면 방망이
      for (const e of A.enemies) if (e.alive && e.hittable && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 2.0) bot.flags.attack = true;
      for (const br of L.breakables) if (!br.broken && Math.hypot(br.p.x - P.pos.x, br.p.z - P.pos.z) < (br.wide ? 3.8 : 1.9)) bot.flags.attack = true;
      for (const s of L.switches) if (!s.on && Math.hypot(s.p.x - P.pos.x, s.p.z - P.pos.z) < 2.2) bot.flags.attack = true;
      // 스위치 쪽으로 (문이 닫혀 있으면)
      const sw = L.switches.find((s) => !s.on);
      if (sw && Math.hypot(sw.p.x - P.pos.x, sw.p.z - P.pos.z) < 9) {
        tx = sw.p.x - P.pos.x;
        tz = sw.p.z - P.pos.z;
      }
      // 1.5초 동안 0.6m 도 못 갔으면 막힌 것 → 점프
      bot.win = bot.win || { t: 0, x: P.pos.x, z: P.pos.z };
      bot.win.t += dt;
      if (bot.win.t > 1.5) {
        bot.stuck = Math.hypot(P.pos.x - bot.win.x, P.pos.z - bot.win.z) < 0.6 && bot.speed > 0 ? 2 : 0;
        bot.win = { t: 0, x: P.pos.x, z: P.pos.z };
      }
      if (bot.stuck > 1.2) {
        bot.flags.jump = true;
        bot.held = true;
        bot.holdT = 0.35;
        bot.stuck = 0;
      }
    }
    bot.holdT -= dt;
    if (bot.holdT <= 0) bot.held = false;
    // 카메라 기준으로 바꾸기
    const f = A.camDir;
    const l = Math.hypot(tx, tz) || 1;
    const wx = tx / l, wz = tz / l;
    bot.move = { x: wx * -f.z + wz * f.x, y: wx * f.x + wz * f.z };
    const ml = Math.hypot(bot.move.x, bot.move.y) || 1;
    // 뛸 때 정한 빠르기를 착지까지 그대로 (사람처럼 공중에서 갑자기 멈추거나 더 달리지 않는다)
    let sp = bot.speed == null ? 1 : bot.speed;
    if (P.onGround) bot.commit = bot.flags.jump ? Math.max(0.42, sp) : null;
    else if (bot.commit != null) sp = bot.commit;
    // 조이스틱 끝 쪽일수록 빠르다 (input.js 와 같은 곡선: 0.14 이하 무시)
    const mag = sp <= 0 ? 0 : 0.14 + sp * 0.76;
    bot.move.x = (bot.move.x / ml) * (P.onGround ? mag : Math.max(mag, 0.6));
    bot.move.y = (bot.move.y / ml) * (P.onGround ? mag : Math.max(mag, 0.6));
    // input.move() 를 바꿔 놓았으니 조이스틱 곡선 없이 그대로 쓰인다 → 직접 크기로
    bot.move.x *= sp <= 0 ? 0 : 1;
    bot.move.y *= sp <= 0 ? 0 : 1;
  };
  tick();
}

module.exports = { installBot };
