/**
 * 용암 서핑 · 자동 조종 (점검용)
 *  page.evaluate(installLavaBot, opts) 로 넣는다. 입력(steer · consume)만 바꿔 끼우고 게임 규칙 · 물리 · 충돌은 그대로.
 *  장애물은 사람이 보는 정보(보이는 위치 · 경고 상태 · 움직임 · 표지판)로만 피한다.
 *  opts.god = true 면 하트가 줄지 않음 · opts.noLava = true 면 용암이 멀리서 멈춤 · opts.ram = true 면 일부러 바위 · 기둥에 부딪힘
 */
"use strict";

function installLavaBot(opts = {}) {
  const G = window.LavaSurfers;
  const IN = G.input;
  const bot = (window.__lbot = { steer: 0, flags: {}, dbg: {}, jumps: 0, boosts: 0 });
  IN.steer = () => (IN.enabled ? bot.steer : 0);
  IN.consume = () => {
    const f = bot.flags;
    bot.flags = {};
    return f;
  };
  const cyc = (t, period, phase) => ((((t / period + phase) % 1) + 1) % 1) * period;
  const tick = () => {
    requestAnimationFrame(tick);
    if (opts.god && G.run) G.run.hearts = 3;
    if (opts.noLava && G.lava && G.state === "play") G.lava.lavaS = Math.min(G.lava.lavaS, G.player.s - 70);
    if (G.state !== "play" || G.paused || G.loadingStage) {
      bot.steer = 0;
      return;
    }
    const P = G.player;
    const T = G.track;
    const I = G.items;
    const B = G.boss;
    const v = Math.max(10, P.speed);
    const now = I.t;
    const hw = Math.min(T.halfWidth(P.s), T.halfWidth(P.s + 15));
    const lim = hw - 0.7;
    const floorAt = (s, u) => T.surfaceY(s, u);
    const blockedByDivider = (u) => {
      // 지금 위치와 후보 u 사이에 (앞 0~40m 안에서) 길을 나누는 벽이 있으면 못 감
      for (const d of T.dividers) {
        if (d.s1 < P.s || d.s0 > P.s + 40) continue;
        if ((P.u < d.u && u > d.u - 0.9) || (P.u > d.u && u < d.u + 0.9)) {
          if (P.s >= d.s0 - 1.5) return true;
          if (d.s0 - P.s < (Math.abs(u - P.u) / 9) * v + 2) return true;
        }
      }
      return false;
    };
    let best = P.u;
    let bestCost = Infinity;
    for (let u = -lim; u <= lim + 0.01; u += 0.5) {
      let cost = Math.abs(u) * 0.12 + Math.abs(u - P.u) * 0.1;
      if (blockedByDivider(u)) cost += 500;
      for (let d = 2; d <= 44; d += 2) {
        const s = P.s + d;
        if (floorAt(s, u) != null) continue;
        if (!T.inGap(s)) cost += 22 / (1 + d * 0.05);
        // 용암 위 발판 구간: 발판이 있는 줄을 고름
        else if (T.pads.some((p) => Math.abs(p.s - s) < 30)) cost += 9 / (1 + d * 0.05);
      }
      for (const sg of T.def.signs || []) {
        const a = sg.s - P.s;
        if (a < -5 || a > 70) continue;
        if (sg.kind === "stop" && Math.abs(u - sg.u) < 3.1) cost += 300;
        if (sg.kind === "short" && Math.abs(u - sg.u) < 2) cost -= 2;
      }
      for (const o of I.obs.concat(I.dyn)) {
        const ahead = (o.s0 ?? o.s ?? o.sw ?? P.s) - P.s;
        const t = Math.max(0, ahead) / v;
        const w = 1 / (1 + Math.max(0, ahead) * 0.04);
        switch (o.type) {
          case "spire":
            if (ahead < -2 || ahead > 46) break;
            if (opts.ram) cost += Math.abs(u - o.u) < o.r ? -80 * w : 0;
            else cost += Math.abs(u - o.u) < o.r + 1.0 ? 60 * w : 0;
            break;
          case "rock":
            if (ahead < -2 || ahead > 46) break;
            if (opts.ram) cost += Math.abs(u - o.u) < o.r ? -80 * w : 0;
            else cost += Math.abs(u - o.u) < o.r + 0.9 ? 25 * w : 0;
            break;
          case "slider": {
            if (ahead < -3 || ahead > 46) break;
            const su = I.sliderU(o, now + t);
            cost += Math.abs(u - su) < o.w / 2 + 1.0 ? (o.h < 1.2 ? 6 : 55) * w : 0;
            break;
          }
          case "fire": {
            if (ahead < -3 || ahead > 46) break;
            const k = cyc(now + t, o.period, o.phase);
            const danger = k > o.period - o.warn - o.on - 0.25;
            cost += danger && Math.abs(u - o.u) < o.r + 1.0 ? 50 * w : Math.abs(u - o.u) < o.r ? 4 * w : 0;
            break;
          }
          case "roll": {
            if (o.state === "gone" || ahead < -3 || ahead > 46) break;
            const ru = o.state === "roll" ? o.ru : o.u0;
            const startIn = o.state === "roll" ? 0 : Math.max(0, (ahead - o.trigger) / v);
            const pu = ru - o.side * Math.max(0, t - startIn) * o.speed;
            cost += Math.abs(u - pu) < o.r + 1.6 ? 70 * w : 0;
            break;
          }
          case "crumble":
            if (ahead < 40 && ahead > -8 && u > o.u0 - 0.8 && u < o.u1 + 0.8 && o.delay == null && P.s < o.s1 + 1) cost += 45 * w;
            break;
          case "bomb":
            if (o.state === "fly" || o.state === "impact") {
              const a = o.s - P.s;
              if (a > -3 && a < 50 && Math.abs(u - o.u) < o.r + 1.2) cost += 60 / (1 + Math.max(0, a) * 0.03);
            } else if (o.state === "idle" && ahead > 0 && ahead < 60 && Math.abs(u - o.u) < o.r + 0.6) cost += 3;
            break;
          case "erupt":
            if (ahead > -3 && ahead < 46 && Math.abs(u - o.u) < 3.0) cost += 40 * w;
            break;
          case "gate":
            if (ahead < -1 || ahead > 46) break;
            if (!(u > o.u0 + 0.6 && u < o.u1 - 0.6)) cost += 90 * w;
            if (o.sw && !o.pressed && o.sw.s - P.s > 0 && o.sw.s - P.s < 46 && Math.abs(u - o.sw.u) < 0.8) cost -= 160 / (1 + (o.sw.s - P.s) * 0.04);
            break;
          case "rotor":
            if (ahead < -1 || ahead > 46) break;
            {
              const a = I.rotorAngle(o, now + t);
              if (I.rotorBlocks(o, a, u, 0.5) || I.rotorBlocks(o, a, u, 1.3)) cost += 60 * w;
            }
            break;
          case "wheel": {
            if (ahead < -2 || ahead > 46) break;
            const wu = I.wheelU(o, now + t);
            cost += Math.abs(u - wu) < o.R + 1.0 ? 55 * w : 0;
            break;
          }
          case "lavafall": {
            if (ahead < -2 || ahead > 46) break;
            const st = I.lavafallState(o, now + t).st;
            if (st === "on" && u > o.u0 - 1.0 && u < o.u1 + 1.0) cost += 70 * w;
            else if (o.period && u > o.u0 - 0.6 && u < o.u1 + 0.6) cost += 8 * w;
            break;
          }
          case "sweeper":
            if (ahead > -2 && ahead < 46 && Math.abs(u - o.u) < 1.2) cost += 30 * w;
            break;
          case "flames":
            if (o.state === "on" && P.s < o.s1 + 1 && o.s0 - P.s < 50 && o.h > 1.5 && u > o.u0 - 1 && u < o.u1 + 1) cost += 80;
            break;
        }
      }
      // 지금 밟을 (또는 내릴) 발판 가운데 쪽으로
      const padNow = T.pads.find((p) => p.s - P.s > -p.l && p.s - P.s < 20 && Math.abs(p.u - P.u) < p.r + 1.5);
      if (padNow) cost += Math.max(0, Math.abs(u - padNow.u) - (padNow.r - 1.2)) * 3;
      for (const o of I.orbs) {
        if (o.taken) continue;
        const a = o.s - P.s;
        if (a > 2 && a < 25 && Math.abs(u - o.u) < 0.8 && !o.air) cost -= o.big ? 3 : 0.6;
      }
      if (B) {
        if (B.crystals) for (const c of B.crystals) if (!c.taken && c.s - P.s > 0 && c.s - P.s < 50 && Math.abs(u - c.u) < 1.2) cost -= 25;
        if ((B.mode === "diveWarn" || B.mode === "dive") && Math.abs(u - B.diveU) < 2.6) cost += 120;
        if (B.state === "exposed" && B.gu !== undefined && Math.abs(u - B.gu) < 1.5) cost -= 20;
        if ((B.mode === "toRamp" || B.mode === "expose") && Math.abs(u) < 0.8) cost -= 30;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = u;
      }
    }
    bot.target = best;
    const wind = T.winds.length ? T.windAt(P.s + v * 0.3) : 0;
    bot.steer = Math.max(-1, Math.min(1, (best - P.u) * 0.9 - P.vu * 0.06 - (wind / 11) * (P.onGround ? 0.6 : 1)));
    // 점프
    let jump = false;
    const onRamp = T.rampAdd(P.s) > 0.05;
    if (P.onGround) {
      const look = v * 0.12 + 0.4;
      const pad = T.padAt(P.s, P.u);
      if (!onRamp && !pad && floorAt(P.s + look, P.u) == null) jump = true;
      for (const [, s1] of T.ramps) {
        if (P.s > s1 - v * 0.05 && P.s < s1 + 0.2) {
          const gap = T.gaps.find(([g0]) => g0 > s1 - 1 && g0 < s1 + 6);
          if (gap && gap[1] - gap[0] > 15) jump = true;
        }
      }
      if (pad) {
        const land = P.s + v * 0.72;
        const edge = T.surfaceY(P.s + v * 0.1, P.u) == null;
        const landOk = T.surfaceY(land, P.u) != null && T.surfaceY(land + 2, P.u) != null;
        const nextPad = T.padAt(land, P.u);
        const nextOk = landOk && (!nextPad || nextPad === pad || Math.abs(land - nextPad.s) < nextPad.l * 0.6);
        if (edge || (nextOk && nextPad !== pad && P.s > pad.s - pad.l * 0.2)) jump = true;
        if (pad.sink && pad.state === "sink" && landOk) jump = true;
      }
      const jumpOver = (ahead, ok) => ok && ahead > 0 && ahead < v * 0.2 + 0.6;
      for (const o of I.obs.concat(I.dyn)) {
        const ahead = (o.s0 ?? o.s ?? P.s) - P.s;
        if (o.type === "rock" && !opts.ram && jumpOver(ahead, Math.abs(o.u - P.u) < o.r + 0.5)) jump = true;
        if (o.type === "bar" && jumpOver(ahead, P.u > o.u0 - 0.4 && P.u < o.u1 + 0.4)) jump = true;
        if (o.type === "laser" && jumpOver(ahead, P.u > o.u0 - 0.4 && P.u < o.u1 + 0.4)) {
          const st = cyc(now + ahead / v, o.period, o.phase);
          if (st > o.period - o.warn - o.on - 0.3) jump = true;
        }
        if (o.type === "slider" && o.h < 1.2 && jumpOver(ahead, Math.abs(I.sliderU(o, now + ahead / v) - P.u) < o.w / 2 + 1.2)) jump = true;
        if (o.type === "sweeper" && ahead > 0 && Math.abs(o.u - P.u) < o.L + 0.6 && ahead < v * 0.22 + 0.8) jump = true;
        if (o.type === "linewave" && o.state === "on" && o.sw - P.s > 0 && o.sw - P.s < (v + o.speed) * 0.2 + 0.5) jump = true;
        if (o.type === "ringwave" && o.state === "on") {
          const d = Math.hypot(P.s - o.s, P.u - o.u);
          if (d > o.R && d - o.R < (v * 0.5 + o.speed) * 0.2 + 0.5) jump = true;
        }
        if (o.type === "flames" && o.state === "on" && o.h < 1.5 && jumpOver(o.s0 - P.s, P.u > o.u0 - 0.5 && P.u < o.u1 + 0.5)) jump = true;
      }
      if (B && B.sweepOn && B.sweepS - P.s > 0 && B.sweepS - P.s < v * 0.24 + 0.6) jump = true;
    }
    if (jump) {
      bot.flags.jump = true;
      bot.jumps++;
    }
    // 부스터: 용암이 가깝거나 큰 점프 직전 · 골렘 약점
    const bigJump = T.ramps.some(([s0, s1, h]) => h >= 3 && s0 - P.s > 0 && s0 - P.s < 50 && T.gaps.some(([g0, g1]) => g0 >= s1 - 1 && g0 < s1 + 4 && g1 - g0 > 14));
    let wantBoost = (G.lava.d ?? 99) < 34 || bigJump;
    if (B && !G.escape) wantBoost = B.state === "exposed" && B.gs !== undefined && B.gs - P.s < 26 && Math.abs(B.gu - P.u) < 2.5;
    // 바위 발판 건너기 직전 · 도중에는 부스터 금지 (너무 멀리 날아감)
    if (T.pads.some((p) => p.s - P.s > -p.l && p.s - P.s < 70)) wantBoost = false;
    if (P.boostReady && P.onGround && wantBoost) {
      bot.flags.boost = true;
      bot.boosts++;
    }
    bot.dbg = { s: +P.s.toFixed(1), u: +P.u.toFixed(2), tgt: best, v: +P.speed.toFixed(1), d: +(G.lava.d || 0).toFixed(1) };
  };
  tick();
}

module.exports = { installLavaBot };
