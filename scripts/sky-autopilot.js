/**
 * 하늘섬 대탈출 · 자동 조종 (점검용)
 *  page.evaluate(installBot, god) 로 페이지 안에 넣는다. 입력(input.move · consume · jumpHeld)만 바꿔 끼우고
 *  게임 규칙 · 물리 · 충돌은 그대로 쓴다 → "사람이 끝까지 갈 수 있는 코스인가"를 확인하는 용도.
 *  god=true 면 하트가 줄지 않는다 (코스 끝까지 보기용).
 *  장치마다 "지금 지나가도 되나"를 장치가 보여 주는 상태(경고 · 남은 시간)로만 판단한다 (사람이 보는 것과 같은 정보).
 */
"use strict";

function installBot(god) {
  const G = window.SkyIsland;
  const IN = G.input;
  const bot = (window.__bot = { move: { x: 0, y: 0 }, flags: {}, held: false, holdT: 0, commit: null, dbg: {}, waits: 0 });
  IN.move = () => bot.move;
  IN.consume = () => {
    const f = bot.flags;
    bot.flags = {};
    return f;
  };
  Object.defineProperty(IN, "jumpHeld", { get: () => bot.held, configurable: true });
  let last = performance.now();
  const TAU = Math.PI * 2;

  /** 장치들: 기다릴지 · 서두를지 · 뛸지 */
  function hazards(P, C, ux, uz) {
    const out = { wait: false, rush: false, jump: false, dash: false, why: "" };
    const ahead = (x, z) => (x - P.pos.x) * ux + (z - P.pos.z) * uz;
    const side = (x, z) => Math.abs((x - P.pos.x) * uz - (z - P.pos.z) * ux);
    const near = (x, y, z) => Math.abs(y - P.pos.y) < 3;
    // 맞바람이면 건너는 데 더 오래 걸린다
    const sp = Math.max(2.5, 6.6 + P.wind.x * ux + P.wind.z * uz);
    for (const m of C.mechs || []) {
      switch (m.kind) {
        case "blade": {
          const d = ahead(m.x, m.z);
          if (!near(m.x, m.y, m.z) || side(m.x, m.z) > 2.5) break;
          if (d > 0.7 && d < 3.2) {
            const t0 = (d - 0.9) / 7;
            const t1 = (d + 0.9) / 7 + 0.15;
            let bad = false;
            for (let k = 0; k <= 8; k++) {
              const t = t0 + ((t1 - t0) * k) / 8;
              if (m.blocking(m.ang + m.speed * t, P.pos.x)) bad = true;
            }
            if (bad) {
              out.wait = true;
              out.why = "blade";
            } else out.rush = true;
          } else if (d >= -0.9 && d <= 0.7) out.rush = true;
          break;
        }
        case "drop": {
          if (!near(m.x, m.y, m.z)) break;
          const d = ahead(m.x, m.z);
          const sd = side(m.x, m.z);
          if (sd > m.r + 0.9) break;
          const inside = Math.hypot(P.pos.x - m.x, P.pos.z - m.z) < m.r + 0.6;
          if (inside) {
            if (m.danger) out.rush = true;
            break;
          }
          if (d > 0 && d < m.r + 2.4) {
            let soon = m.danger;
            if (m.mode === "timer" && m.state === "wait") {
              const k = ((m.t % m.period) + m.period) % m.period;
              const untilWarn = m.period - m.warn - 0.05 - k;
              if (untilWarn < (d + m.r + 0.6) / sp + 0.25) soon = true;
            }
            if (soon) {
              out.wait = true;
              out.why = "drop";
            }
          }
          break;
        }
        case "bolt": {
          for (const s of m.spots) {
            if (!near(s.x, s.y, s.z) || side(s.x, s.z) > m.r + 0.8) continue;
            const d = ahead(s.x, s.z);
            const inside = Math.hypot(P.pos.x - s.x, P.pos.z - s.z) < m.r + 0.3;
            const l = m.left(s);
            if (inside) {
              if (l < m.warn + 0.2 || s.hot > 0) out.rush = true;
              continue;
            }
            if (d > 0 && d < m.r + 2.2) {
              const cross = (d + m.r * 2 + 0.6) / 6.5;
              if (s.hot > 0 || l < cross + 0.25 || l > m.period - 0.25) {
                out.wait = true;
                out.why = "bolt";
              }
            }
          }
          break;
        }
        case "spike": {
          if (!near(m.x, m.y, m.z) || side(m.x, m.z) > m.w / 2 + 0.8) break;
          const d = ahead(m.x, m.z) - m.l / 2;
          if (m.inside(P, 0.2)) {
            out.rush = true;
            break;
          }
          if (d > -0.2 && d < 2.2) {
            const cross = (d + m.l + 0.8) / 6.5 + 0.2;
            if (m.safeFor < cross) {
              out.wait = true;
              out.why = "spike";
            }
          }
          break;
        }
        case "cannon": {
          // 포탄 길(직선)과 내 길이 만나는 곳
          const dx = m.dir.x;
          const dz = m.dir.z;
          const mx = m.muzzle.x;
          const mz = m.muzzle.z;
          if (Math.abs(m.muzzle.y - m.h - P.pos.y) > 3 && Math.abs(m.floorY - P.pos.y) > 1.5) break;
          // 내 위치에서 포탄 줄까지 거리 (줄에 수직)
          const lane = Math.abs((P.pos.x - mx) * dz - (P.pos.z - mz) * dx);
          const along = (P.pos.x - mx) * dx + (P.pos.z - mz) * dz;
          if (along < 0 || along > m.range) break;
          // 줄로 다가가는 중인가
          const towards = -((P.pos.x - mx) * -dz + (P.pos.z - mz) * dx) * (-dz * ux + dx * uz);
          const tHit = along / m.speed;
          let danger = false;
          for (const b of m.balls) {
            if (!b.on) continue;
            const bAlong = (b.p.x - mx) * dx + (b.p.z - mz) * dz;
            if (bAlong < along + 0.8) danger = true;
          }
          if (m.untilFire + tHit < 1.4 || (m.untilFire < m.warn + 0.1)) danger = true;
          if (lane < 1.0) {
            out.rush = true;
            for (const b of m.balls) {
              if (!b.on) continue;
              const bAlong = (b.p.x - mx) * dx + (b.p.z - mz) * dz;
              if (bAlong < along && along - bAlong < 2.6) out.jump = true;
            }
          } else if (lane < 3.4 && danger) {
            out.wait = true;
            out.why = "cannon";
          }
          break;
        }
        case "beam": {
          if (!near(m.x, m.y, m.z)) break;
          const dd = m.dist(P);
          if (dd < 1.25 && P.onGround) out.jump = true;
          break;
        }
        case "draw": {
          if (Math.abs(m.y - P.pos.y) > 2) break;
          const zA = Math.max(m.zA, m.zB);
          const zB = Math.min(m.zA, m.zB);
          if (Math.abs(P.pos.x - m.x) > m.w) break;
          const d = P.pos.z - zA;
          if (P.pos.z < zA && P.pos.z > zB) {
            out.rush = true;
            break;
          }
          if (d > 0 && d < 3) {
            const cross = (zA - zB + d + 0.6) / 6.8;
            if (m.safeFor < cross) {
              out.wait = true;
              out.why = "draw";
            }
          }
          break;
        }
      }
    }
    return out;
  }

  const tick = () => {
    requestAnimationFrame(tick);
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    const P = G.player;
    const C = G.course;
    if (god && G.run) G.run.hearts = 3;
    if (G.state !== "play" || G.paused) {
      bot.move = { x: 0, y: 0 };
      return;
    }
    // 보스전: 따로
    if (C.boss && C.boss.fighting && C.boss.visible) {
      bossTick(P, C, dt);
      return;
    }
    const pr = C.progress(P.pos, {});
    let i = Math.min(C.path.length - 1, pr.seg + 1);
    let tgt = C.path[i];
    if (Math.hypot(tgt.x - P.pos.x, tgt.z - P.pos.z) < 0.9 && i + 1 < C.path.length) tgt = C.path[++i];
    // 길 위 가장 가까운 점에서 2.5m 앞을 본다 (바람 · 띠에 밀려도 길로 돌아오게)
    {
      const a = C.path[pr.seg];
      const b = C.path[Math.min(C.path.length - 1, pr.seg + 1)];
      const sx = b.x - a.x;
      const sz = b.z - a.z;
      const L = Math.hypot(sx, sz) || 1;
      const u = Math.max(0, Math.min(1, ((P.pos.x - a.x) * sx + (P.pos.z - a.z) * sz) / (L * L)));
      const cx = a.x + sx * u;
      const cz = a.z + sz * u;
      const lat = Math.hypot(P.pos.x - cx, P.pos.z - cz);
      const rest = L * (1 - u);
      if (lat > 0.25 && rest > 2.5) tgt = { x: cx + (sx / L) * 2.5, y: tgt.y, z: cz + (sz / L) * 2.5 };
    }
    let tx = tgt.x - P.pos.x;
    let tz = tgt.z - P.pos.z;
    const dl = Math.hypot(tx, tz) || 1;
    const ux = tx / dl;
    const uz = tz / dl;
    if (P.onGround) bot.lastGroundY = P.pos.y;
    // 앞을 0.25m 씩 훑기: 틈 시작 s0 · 착지 시작 s1 · 착지 끝 s2 · 턱(벽)
    let s0 = -1;
    let s1 = -1;
    let s2 = 9;
    let wall = -1;
    let moverOk = true;
    let landTop = null;
    const base = P.onGround ? P.pos.y : bot.lastGroundY ?? P.pos.y;
    for (let d = 0.3; d <= 7; d += 0.25) {
      const x = P.pos.x + ux * d;
      const z = P.pos.z + uz * d;
      const g = C.ground(x, z, 0.3, P.pos.y + 1.4);
      const ok = g && g.h > base - 1.7;
      // 턱: 좁은 틈(0.6m 미만) 바로 뒤의 높은 곳도 턱으로 본다
      if (g && g.h > P.pos.y + 0.42 && wall < 0 && (s0 < 0 || d - s0 < 0.6)) wall = d;
      if (s0 < 0 && !ok) s0 = d;
      else if (s0 >= 0 && s1 < 0 && ok) {
        s1 = d;
        landTop = g.h;
        const sol = g.s;
        if (sol.phase) {
          // 사라지는 수정 발판: 닿을 때 충분히 남아 있어야
          if (sol.phase.remain() < 1.05) moverOk = false;
        } else if (sol.predict) {
          // 움직이는 발판: 뛰어서 닿을 즈음(약 0.7초 뒤) 발판이 착지 지점에 있어야
          const land = { x: P.pos.x + ux * (s1 + 0.9), z: P.pos.z + uz * (s1 + 0.9) };
          const pp = sol.predict(0.7);
          const half = sol.swing ? Math.min(sol.swing.w, sol.swing.l) / 2 : sol.rad || 1.5;
          if (Math.hypot(pp.x - land.x, pp.z - land.z) > half - 0.35) moverOk = false;
          if (pp.y > P.pos.y + 1.2) moverOk = false;
        } else if (sol.mover) {
          const m = C.movers.find((q) => q.solid === sol);
          if (m) {
            const lateral = Math.abs(m.a.x - m.b.x) > 1;
            const v = Math.hypot(m.solid.dx, m.solid.dz) * 60;
            if (lateral) {
              const lat2 = Math.abs(m.solid.cx + m.solid.dx * 45 - P.pos.x);
              if (lat2 > 0.7) moverOk = false;
            } else if (v > 0.9) moverOk = false;
          }
        }
      } else if (s1 >= 0 && !ok) {
        s2 = d;
        break;
      }
    }
    if (s0 >= 0 && s1 >= 0 && s1 - s0 < 0.6 && moverOk) {
      s0 = -1;
      s1 = -1;
    }
    let speed = 1;
    // 움직이는 발판 위: 앞뒤로 오가는 발판은 끝에서 거의 멈췄을 때 내린다
    const gsol = P.onGround && P.groundSolid;
    const gs = gsol && gsol.mover && !gsol.swing ? C.movers.find((q) => q.solid === gsol) : null;
    const ridingFast = gs && Math.abs(gs.a.x - gs.b.x) < 1 && Math.hypot(gs.solid.dx, gs.solid.dz) * 60 > 0.9;
    const feasible = !ridingFast && moverOk && s0 >= 0 && s1 >= 0 && s1 - s0 <= 3.1 && (landTop == null || landTop <= P.pos.y + 1.3);
    if (s0 >= 0 && !feasible) speed = s0 > 0.9 ? 0.5 : 0;
    let jump = false;
    if (feasible) {
      const land = s1 + Math.min(1.4, (s2 - s1) * 0.4);
      const D = land - s0 + 0.5;
      speed = Math.max(0.42, Math.min(1, D / 4.8));
      if (s0 < 0.7 && P.onGround) jump = true;
    } else if (wall >= 0 && wall < 1.1 && P.onGround) jump = true;
    // 서 있는 발판이 곧 사라지면 (수정 발판) 그냥 다음으로 서두름
    if (gsol && gsol.phase && gsol.phase.remain() < 0.6 && feasible) speed = 1;
    // 특별한 곳 ① 상승기류: 바람 돌 위에서 뛰고 앞으로 (높은 섬 벽에 붙어 올라감)
    for (const v of C.vents) {
      const d = Math.hypot(P.pos.x - v.x, P.pos.z - v.z);
      if (d < v.r && P.pos.y < v.top && P.pos.y > v.y - 0.3) {
        speed = 1;
        if (P.onGround) jump = true;
        bot.vent = true;
      }
    }
    // ② 바람 고리: 섬 끝에서 뛰어 고리를 지나간다
    for (const r of C.rings) {
      const dz = P.pos.z - r.z;
      if (dz > 0 && dz < 4.5 && Math.abs(P.pos.x - r.x) < 0.8 && Math.abs(P.pos.y + 1 - r.y) < 3) {
        speed = 1;
        if (P.onGround && s0 >= 0 && s0 < 0.7) jump = true;
        if (s0 >= 0) bot.ringRun = true;
      }
    }
    if (bot.ringRun && s0 >= 0 && !feasible && P.onGround) {
      speed = 1;
      if (s0 < 0.7) jump = true;
    }
    if (P.onGround && s0 < 0) bot.ringRun = false;
    // ③ 회전 나무 기둥: 팔이 가까우면 뛰어넘기
    for (const s of C.sweepers) {
      const ex = s.x + Math.cos(s.ang) * s.len;
      const ez = s.z - Math.sin(s.ang) * s.len;
      const ax = ex - s.x;
      const az = ez - s.z;
      const L2 = ax * ax + az * az;
      const u = Math.max(0, Math.min(1, ((P.pos.x - s.x) * ax + (P.pos.z - s.z) * az) / L2));
      const dd = Math.hypot(P.pos.x - (s.x + ax * u), P.pos.z - (s.z + az * u));
      if (dd < 1.3 && P.onGround) jump = true;
    }
    // ④ 새 장치들
    const hz = hazards(P, C, ux, uz);
    // 무너지는 · 사라지는 · 움직이는 발판 위에서는 기다리지 않는다
    if (P.onGround && !(gsol && (gsol.phase || gsol.mover || gsol.crumble || gsol.tile))) {
      if (hz.wait && !hz.rush) {
        speed = 0;
        jump = false;
        bot.waits++;
      } else if (hz.rush) speed = Math.max(speed, feasible || s0 < 0 ? 1 : speed);
    } else if (hz.rush) speed = Math.max(speed, 0.9);
    if (hz.jump && P.onGround) jump = true;
    bot.why = hz.why;
    if (jump) {
      bot.flags.jump = true;
      bot.held = true;
      bot.holdT = 0.4;
    }
    // 막힘: 2초 동안 0.5m 도 못 가면 점프 (일부러 기다리는 중이면 빼고)
    bot.win = bot.win || { t: 0, x: P.pos.x, z: P.pos.z };
    bot.win.t += dt;
    if (bot.win.t > 2) {
      if (Math.hypot(P.pos.x - bot.win.x, P.pos.z - bot.win.z) < 0.5 && speed > 0) {
        bot.flags.jump = true;
        bot.held = true;
        bot.holdT = 0.4;
      }
      bot.win = { t: 0, x: P.pos.x, z: P.pos.z };
    }
    bot.holdT -= dt;
    if (bot.holdT <= 0 && !(bot.vent && !P.onGround)) bot.held = false;
    if (P.onGround) bot.vent = false;
    // 뛸 때 정한 빠르기를 착지까지 그대로 (상승기류 · 고리 · 점프대에선 앞으로 계속)
    if (P.onGround) bot.commit = bot.flags.jump ? Math.max(0.42, speed) : null;
    else if (bot.commit != null && !bot.vent && !bot.ringRun) speed = bot.commit;
    if (P.launched || bot.vent) speed = 1;
    bot.dbg = { x: +P.pos.x.toFixed(1), y: +P.pos.y.toFixed(1), z: +P.pos.z.toFixed(1), s0, s1, speed: +speed.toFixed(2), feasible, moverOk, why: hz.why };
    steer(ux, uz, speed);
  };
  function steer(ux, uz, speed, raw = false) {
    const f = G.camDir;
    let mx = ux * -f.z + uz * f.x;
    let my = ux * f.x + uz * f.z;
    const ml = Math.hypot(mx, my) || 1;
    const mag = speed <= 0 ? 0 : raw ? speed : 0.14 + speed * 0.76;
    bot.move = { x: (mx / ml) * mag, y: (my / ml) * mag };
  }

  /* ---------------- 보스전: 공격 피하기 · 약점이 열리면 머리로 대시 ---------------- */
  function bossTick(P, C, dt) {
    const B = C.boss;
    const A = B.A;
    let gx;
    let gz;
    let speed = 1;
    let jump = false;
    let dash = false;
    const st = B.state;
    const toward = (x, z) => {
      gx = x - P.pos.x;
      gz = z - P.pos.z;
    };
    // 기본: 용 앞 아레나 가운데쯤 (가장자리에서 떨어져)
    const home = B.rim(B.phi, -1.5);
    toward(home.x, home.z);
    if (Math.hypot(gx, gz) < 1.2) speed = 0;
    if (st === "tired" && B.st > 0.5 && B.headSolid.active) {
      // 머리로 달려가 대시
      const s = B.headSolid;
      const cx = (s.x0 + s.x1) / 2;
      const cz = (s.z0 + s.z1) / 2;
      toward(cx, cz);
      const ex = Math.max(s.x0 - P.pos.x, 0, P.pos.x - s.x1);
      const ez = Math.max(s.z0 - P.pos.z, 0, P.pos.z - s.z1);
      const de = Math.hypot(ex, ez);
      speed = 1;
      if (de < 2.2 && P.dashCD <= 0 && P.onGround) dash = true;
    }
    if (st === "breathWarn" || st === "breath") {
      // 빨간 길 밖으로 (길에 수직으로, 아레나 가운데 쪽)
      if (B.laneA && B.laneB) {
        const ax = B.laneB.x - B.laneA.x;
        const az = B.laneB.z - B.laneA.z;
        const L = Math.hypot(ax, az) || 1;
        const nx = -az / L;
        const nz = ax / L;
        const off = (P.pos.x - B.laneA.x) * nx + (P.pos.z - B.laneA.z) * nz;
        if (Math.abs(off) < 2.4) {
          let sgn = Math.sign(off) || 1;
          // 가장자리 쪽이면 반대로
          const tx = P.pos.x + nx * sgn * 3;
          const tz = P.pos.z + nz * sgn * 3;
          if (Math.hypot(tx - A.x, tz - A.z) > B.R - 1.5) sgn = -sgn;
          gx = nx * sgn;
          gz = nz * sgn;
          speed = 1;
          if (Math.abs(off) < 1.6 && st === "breathWarn" && B.st > 0.5 && P.dashCD <= 0) dash = true;
        } else speed = 0;
      }
    }
    if (st === "tail" || st === "tailWarn") {
      if (st === "tail" && B.tailPivot) {
        const sg = B.tailSeg();
        const ax = sg.b.x - sg.a.x;
        const az = sg.b.z - sg.a.z;
        const L2 = ax * ax + az * az || 1;
        const u = Math.max(0, Math.min(1, ((P.pos.x - sg.a.x) * ax + (P.pos.z - sg.a.z) * az) / L2));
        const dd = Math.hypot(P.pos.x - (sg.a.x + ax * u), P.pos.z - (sg.a.z + az * u));
        if (dd < 1.7 && P.onGround) jump = true;
      }
      speed = Math.min(speed, 0.4);
    }
    if (B.waveR > 0 && !B.waveSoft) {
      const d = Math.hypot(P.pos.x - B.waveC.x, P.pos.z - B.waveC.z);
      if (d - B.waveR > 0 && d - B.waveR < 1.3 && P.onGround) jump = true;
    }
    if (st === "slamWarn") {
      // 그림자 원 밖으로
      const d = Math.hypot(P.pos.x - B.slamMark.position.x, P.pos.z - B.slamMark.position.z);
      if (d < 3.6) {
        gx = P.pos.x - B.slamMark.position.x || 0.1;
        gz = P.pos.z - B.slamMark.position.z;
        speed = 1;
      }
    }
    // 불덩이 원 밖으로
    for (const b of B.balls) {
      if (!b.on) continue;
      const d = Math.hypot(P.pos.x - b.b.x, P.pos.z - b.b.z);
      if (d < 2.4) {
        gx = P.pos.x - b.b.x || 0.1;
        gz = P.pos.z - b.b.z;
        speed = 1;
      }
    }
    // 아레나 밖으로 나가지 않게
    const dc = Math.hypot(P.pos.x + gx * 0.3 - A.x, P.pos.z + gz * 0.3 - A.z);
    if (dc > B.R - 1.2) {
      gx = A.x - P.pos.x;
      gz = A.z - P.pos.z;
    }
    const l = Math.hypot(gx, gz) || 1;
    if (jump) {
      bot.flags.jump = true;
      bot.held = true;
      bot.holdT = 0.35;
    }
    if (dash) bot.flags.dash = true;
    bot.holdT -= dt;
    if (bot.holdT <= 0) bot.held = false;
    bot.dbg = { boss: st, hp: B.hp, x: +P.pos.x.toFixed(1), z: +P.pos.z.toFixed(1), speed };
    steer(gx / l, gz / l, speed);
  }
  tick();
}

module.exports = { installBot };
