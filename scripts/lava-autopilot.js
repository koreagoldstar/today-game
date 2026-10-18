/**
 * 용암 서핑 · 자동 조종 (점검용)
 *  page.evaluate(installLavaBot, opts) 로 넣는다. 입력(steer · consume)만 바꿔 끼우고 게임 규칙 · 물리 · 충돌은 그대로.
 *  장애물은 사람이 보는 정보(보이는 위치 · 경고 상태 · 움직임)로만 피한다.
 *  opts.god = true 면 하트가 줄지 않음 · opts.noLava = true 면 용암이 멀리서 멈춤(코스 끝까지 보기용)
 *  opts.ram = true 면 일부러 바위 · 돌기둥에 부딪힘 (부딪힐 때 용암이 가까워지는지 점검용)
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
  const tick = () => {
    requestAnimationFrame(tick);
    if (opts.god && G.run) G.run.hearts = 3;
    if (opts.noLava && G.lava && G.state === "play") G.lava.lavaS = Math.min(G.lava.lavaS, G.player.s - 70);
    if (G.state !== "play" || G.paused) {
      bot.steer = 0;
      return;
    }
    const P = G.player;
    const T = G.track;
    const I = G.items;
    const v = Math.max(8, P.speed);
    const hw = T.halfWidth(P.s);
    // 1) 갈 길(가로 위치) 고르기: 앞 40m 의 장애물 · 구멍을 피하고 구슬 · 가운데를 좋아함
    let best = P.u;
    let bestCost = Infinity;
    const lim = hw - 0.9;
    for (let u = -lim; u <= lim + 0.01; u += 0.5) {
      let cost = Math.abs(u) * 0.15 + Math.abs(u - P.u) * 0.12;
      for (let d = 2; d <= 40; d += 2) {
        const s = P.s + d;
        const t = d / v;
        const w = 1 / (1 + d * 0.05);
        if (T.surfaceY(s, u) == null && !T.inGap(s)) cost += 20 * w; // 무너진 땅 · 가장자리 밖
      }
      for (const o of I.obs) {
        const ahead = (o.type === "crumble" ? o.s0 : o.s) - P.s;
        if (ahead < -3 || ahead > 45) continue;
        const t = Math.max(0, ahead) / v;
        const w = 1 / (1 + Math.max(0, ahead) * 0.04);
        if (opts.ram && (o.type === "spire" || o.type === "rock")) cost += Math.abs(u - o.u) < o.r ? -80 * w : 0;
        else if (o.type === "spire") cost += Math.abs(u - o.u) < o.r + 1.0 ? 60 * w : 0;
        else if (o.type === "rock") cost += Math.abs(u - o.u) < o.r + 0.9 ? 25 * w : 0;
        else if (o.type === "slider") {
          const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * (I.t + t)) / o.period);
          const su = o.u0 + (o.u1 - o.u0) * k;
          cost += Math.abs(u - su) < o.w / 2 + 1.0 ? 50 * w : 0;
        } else if (o.type === "fire") {
          const cyc = o.period;
          const k = ((((I.t + t) / cyc + o.phase) % 1) + 1) % 1 * cyc;
          const danger = k > cyc - o.warn - o.on - 0.2;
          cost += danger && Math.abs(u - o.u) < o.r + 1.0 ? 50 * w : Math.abs(u - o.u) < o.r ? 4 * w : 0;
        } else if (o.type === "roll") {
          if (o.state === "gone") continue;
          let ru = o.state === "roll" ? o.ru : o.u0;
          const startIn = o.state === "roll" ? 0 : Math.max(0, (ahead - o.trigger) / v);
          const travel = Math.max(0, t - startIn) * o.speed;
          const pu = ru + -o.side * travel;
          cost += Math.abs(u - pu) < o.r + 1.6 ? 70 * w : 0;
        } else if (o.type === "crumble") {
          if (ahead < 40 && u > o.u0 - 0.8 && u < o.u1 + 0.8 && P.s < o.s1 + 1) cost += 45 * w;
        }
      }
      // 용암 위 바위 발판: 틈 앞이면 발판 쪽으로
      for (const p of T.pads) {
        const ahead = p.s - P.s;
        if (ahead > 0 && ahead < 30 && T.inGap(p.s)) cost += Math.abs(u - p.u) * 1.2;
      }
      for (const o of I.orbs) {
        if (o.taken) continue;
        const ahead = o.s - P.s;
        if (ahead > 2 && ahead < 25 && Math.abs(u - o.u) < 0.8 && !o.air) cost -= 0.6;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = u;
      }
    }
    bot.target = best;
    bot.steer = Math.max(-1, Math.min(1, (best - P.u) * 0.9 - P.vu * 0.06));
    // 2) 점프: 틈 바로 앞 (점프대 위가 아니면) · 점프대 끝에서 큰 틈 · 낮은 바위
    let jump = false;
    const onRamp = T.rampAdd(P.s) > 0.05;
    if (P.onGround) {
      const look = v * 0.12 + 0.4;
      if (!onRamp && T.surfaceY(P.s + look, P.u) == null && T.inGap(P.s + look + 0.5)) jump = true;
      for (const [s0, s1, h] of T.ramps) {
        if (P.s > s1 - v * 0.05 && P.s < s1 + 0.2) {
          // 이 점프대 뒤 틈 길이
          const gap = T.gaps.find(([g0]) => g0 > s1 - 1 && g0 < s1 + 6);
          if (gap && gap[1] - gap[0] > 15) jump = true;
        }
      }
      for (const o of I.obs)
        if (!opts.ram && o.type === "rock" && o.s - P.s > 0 && o.s - P.s < v * 0.22 && Math.abs(o.u - P.u) < o.r + 0.5) jump = true;
      // 바위 발판 위에서 앞이 틈이면 점프
      const onPad = T.pads.some((p) => Math.hypot(P.s - p.s, P.u - p.u) < p.r);
      if (onPad && T.surfaceY(P.s + v * 0.1, P.u) == null) jump = true;
    }
    if (jump) {
      bot.flags.jump = true;
      bot.jumps++;
    }
    // 3) 부스터: 용암이 가깝거나 큰 점프 직전
    const bigJump = T.ramps.some(([s0, s1, h]) => h >= 3 && s0 - P.s > 0 && s0 - P.s < 50);
    if (P.boostReady && P.onGround && ((G.lava.d ?? 99) < 34 || bigJump)) {
      bot.flags.boost = true;
      bot.boosts++;
    }
    bot.dbg = { s: +P.s.toFixed(1), u: +P.u.toFixed(2), tgt: best, v: +P.speed.toFixed(1), d: +(G.lava.d || 0).toFixed(1) };
  };
  tick();
}

module.exports = { installLavaBot };
