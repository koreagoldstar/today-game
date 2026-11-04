/**
 * 닌자 표창 · 공룡 헌터 · 콩콩 점프 · 별똥별 벽돌깨기 자동 점검
 *
 * 사용:
 *   1) npx --yes serve . -l 3456          (다른 창에서)
 *   2) node scripts/test-four-games.js     (FG_ONLY=ninja,dino,jump,brick 으로 골라서도 됨)
 *
 * - 게임 규칙을 화면 없이 빠르게 돌려 봇으로 잰다 (window.NinjaDodge · DinoHunt · JumpRun · BrickGame).
 * - /api/* 는 가짜 응답. 실제 사이트 통계에 영향 없음.
 */
"use strict";

const { chromium } = require("playwright");

const BASE = process.env.FG_BASE || "http://localhost:3456";
const ONLY = (process.env.FG_ONLY || "ninja,dino,jump,brick").split(",");
const results = [];
function check(id, name, ok, detail) {
  results.push({ id, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  [${id}] ${name}${detail != null ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, path, { vp = { width: 390, height: 844 }, touch = true } = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch, serviceWorkers: "block" });
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push("PE " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource|fonts\.g/.test(m.text())) p.errs.push(m.text().slice(0, 160));
  });
  p.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(BASE) && !/favicon|\/api\//.test(r.url())) p.errs.push(`${r.status()} ${r.url()}`);
  });
  await p.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"scores":[],"items":[]}' }));
  await p.goto(BASE + path, { waitUntil: "domcontentloaded" });
  return p;
}

/* ---------- 공통: 첫 화면 집 버튼 · 눕혀도 안 깨짐 ---------- */
async function commonChecks(browser, tag, path, readyFn) {
  const p = await open(browser, path);
  await p.waitForFunction(readyFn, null, { timeout: 30000 });
  await sleep(1100);
  const homeOk = await p.evaluate(async () => {
    const homes = () => [...document.querySelectorAll(".today-brand, .today-home-icon, .today-home-btn")];
    let ok = 0;
    for (let i = 0; i < 12; i += 1) {
      const hit = homes().some((el) => {
        const q = el.getBoundingClientRect();
        if (!q.width) return false;
        const t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        return t && (t === el || el.contains(t));
      });
      if (hit) ok += 1;
      await new Promise((r) => setTimeout(r, 200));
    }
    return ok;
  });
  check(`${tag}0`, "첫 화면 집 버튼이 계속 눌림 (2.4초 동안)", homeOk === 12, `${homeOk}/12`);
  const box = await p.locator(".today-brand").first().boundingBox();
  await Promise.all([p.waitForURL((u) => new URL(u).pathname === "/", { timeout: 8000 }).catch(() => {}), p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)]);
  check(`${tag}1`, "집 버튼을 터치하면 홈으로 감", new URL(p.url()).pathname === "/", new URL(p.url()).pathname);
  await p.context().close();
}

/* ---------- 닌자 ---------- */
async function testNinja(browser) {
  await commonChecks(browser, "N", "/games/ninja-dodge/", () => window.NinjaDodge && window.NinjaDodge.ready);
  const p = await open(browser, "/games/ninja-dodge/");
  await p.waitForFunction(() => window.NinjaDodge && window.NinjaDodge.ready, null, { timeout: 30000 });
  const r = await p.evaluate(() => {
    const N = window.NinjaDodge;
    const DT = N.STEP;
    const eta = (o, kind) => {
      const px = N.player.x;
      if (kind === "shot") return o.lane === "top" ? (N.GROUND - 70 - o.y) / o.vy : (px - o.x) / o.vx;
      if (o.lane === "top") return o.launchAt - N.time + (N.GROUND - 70 + 24) / Math.max(250, o.speed);
      return o.launchAt - N.time + (o.dir === "left" ? px + 24 : N.W + 24 - px) / o.speed;
    };
    const human = (react, err, jit) => {
      const seen = new Map();
      return () => {
        const list = [];
        for (const w of N.warnings) list.push({ o: w, e: eta(w, "warn"), since: w.warn - (w.launchAt - N.time), lane: w.lane, gold: w.gold, x: w.x, sp: w.speed });
        for (const s of N.shots) if (!s.passed) list.push({ o: s, e: eta(s, "shot"), since: 9, lane: s.lane, gold: s.gold, x: s.x, shot: s, sp: Math.abs(s.vx) || s.vy });
        let duck = false;
        let jump = false;
        let dest = null;
        for (const t of list) {
          if (t.since < react) continue;
          let m = seen.get(t.o);
          if (!m) {
            m = { miss: Math.random() < err, off: (Math.random() * 2 - 1) * jit };
            seen.set(t.o, m);
          }
          if (m.miss) continue;
          if (t.lane === "top") {
            if (Math.abs(t.x - N.player.x) < 36 && t.e > 0) {
              const tops = list.filter((q) => q.lane === "top" && q.e > -0.2).map((q) => q.x);
              let best = -1;
              for (const c of [t.x - 62, t.x + 62]) {
                if (c < 44 || c > N.W - 44) continue;
                const v = Math.min(...tops.map((x) => Math.abs(x - c)));
                if (v > best) {
                  best = v;
                  dest = c;
                }
              }
            }
            continue;
          }
          if (t.gold && t.shot && Math.hypot(t.shot.x - N.player.x, t.shot.y - (N.player.y - 40)) < 80) {
            N.trySlash();
            continue;
          }
          const half = 20 / t.sp;
          const tc = t.e - half + m.off;
          if (t.lane === "high" && tc < 0.16 && t.e > -half - 0.04) duck = true;
          if (t.lane !== "high" && tc < (t.lane === "mid" ? 0.17 : 0.2) && t.e > -half) jump = true;
        }
        if (jump && N.player.onGround) N.jump();
        N.hold(duck && !jump);
        if (dest != null) N.moveTo(dest);
        else if (!list.some((t) => t.lane === "top")) N.moveTo(null);
      };
    };
    const run = (brain, limit = 240) => {
      N.start();
      let t = 0;
      while (N.state === "play" && t < limit) {
        brain();
        N.update(DT);
        t += DT;
      }
      N.hold(false);
      N.moveTo(null);
      return { t, score: N.score, alive: N.state === "play" };
    };
    const median = (mk, n, limit) => {
      const rows = [];
      for (let i = 0; i < n; i += 1) rows.push(run(mk(), limit));
      rows.sort((a, c) => a.t - c.t);
      return { t: Math.round(rows[n >> 1].t), score: rows[n >> 1].score, alive: rows.filter((q) => q.alive).length };
    };
    // 모든 묶음의 도착 시각을 재서, 답을 바꿀 시간이 항상 있는지 직접 확인 (가운데 서 있는 경우)
    const scheduleCheck = () => {
      const seen = new Set();
      const arrivals = [];
      N.start();
      for (let i = 0; i < 300 / DT; i += 1) {
        N.shield(1);
        for (const list of [N.plan, N.warnings]) {
          for (const w of list) {
            if (seen.has(w)) continue;
            seen.add(w);
            const travel = w.lane === "top" ? (N.GROUND - 60 + 24) / Math.max(250, w.speed) : (N.W / 2 + 24) / w.speed;
            arrivals.push({ t: w.launchAt + travel, lane: w.lane });
          }
        }
        N.update(DT);
      }
      arrivals.sort((a, c) => a.t - c.t);
      const ans = (l) => (l === "top" ? "move" : l === "high" ? "duck" : "jump");
      let bad = 0;
      let minGap = 9;
      for (let i = 1; i < arrivals.length; i += 1) {
        const a = arrivals[i - 1];
        const c = arrivals[i];
        const gap = c.t - a.t;
        if (ans(a.lane) === ans(c.lane) && gap < 0.4) continue; // 같은 답을 함께 (양쪽 동시 · 낙하 두 개)
        const need = N.switchGap(a.lane, c.lane);
        minGap = Math.min(minGap, gap - need);
        if (gap < need - 0.02) bad += 1;
      }
      return { count: arrivals.length, bad, minGap: +minGap.toFixed(2) };
    };
    const schedule = scheduleCheck();
    let cd = 0;
    const spam = () => () => {
      N.hold(true);
      cd -= DT;
      if (cd <= 0) {
        N.trySlash();
        cd = 0.22;
      }
    };
    // 규칙: 서 있으면 모든 줄에 맞고, 숙이면 위만 피하고, 충분히 뛰면 아래 줄을 피한다
    const boxTest = () => {
      N.start();
      return { high: N.LANE_Y.high < N.LANE_Y.mid && N.LANE_Y.mid < N.LANE_Y.low };
    };
    return {
      idle: median(() => () => {}, 4, 60),
      spam: median(spam, 6, 120),
      good: median(() => human(0.4, 0.12, 0.1), 60, 240), // 편차가 커서 60번의 중앙값으로 잰다
      perfect: median(() => human(0.25, 0, 0), 8, 300),
      schedule,
      lanes: boxTest(),
      gapDuckJump: N.switchGap("high", "low"),
      gapJumpDuck: N.switchGap("low", "high"),
    };
  });
  check("N2", "가만히 있으면 금방 끝남", r.idle.t < 15, r.idle);
  check("N3", "숙인 채 베기만 연타해서는 오래 못 버팀 (예전엔 52초 · 504점)", r.spam.t < 25 && r.spam.score < 120, r.spam);
  check("N4", "보통 사람 봇은 30초 이상 버팀", r.good.t >= 30, r.good);
  check("N5", "5분 동안 나온 표창 전부: 답을 바꿀 시간이 항상 있음 (피할 수 없는 조합 없음)", r.schedule.bad === 0 && r.schedule.count > 100, r.schedule);
  check("N5b", "실수 없는 봇은 대부분 5분을 버팀 (옆으로 움직이며 뛰는 봇 자체의 실수가 드물게 있음)", r.perfect.alive >= 7 && r.perfect.t >= 300, r.perfect);
  check("N6", "연속 답 사이 간격: 점프 뒤 숙이기는 착지 시간만큼", r.gapJumpDuck >= 0.7 && r.gapDuckJump >= 0.3, [r.gapDuckJump, r.gapJumpDuck]);
  const q = await open(browser, "/games/ninja-dodge/");
  await q.waitForFunction(() => window.NinjaDodge && window.NinjaDodge.ready, null, { timeout: 30000 });
  await sleep(300);
  await q.tap("#start-btn");
  await sleep(1500);
  const pad = await q.evaluate(() => document.getElementById("pad").classList.contains("show") && window.NinjaDodge.state === "play");
  await q.context().close();
  await p.evaluate(() => window.NinjaDodge.start());
  await sleep(200);
  check("N7", "시작하면 숙이기 · 베기 · 점프 버튼이 보임", pad);
  await p.evaluate(() => TodayPause.pause());
  const a = await p.evaluate(() => window.NinjaDodge.time);
  await sleep(300);
  const b = await p.evaluate(() => window.NinjaDodge.time);
  await p.evaluate(() => TodayPause.resume());
  await sleep(300);
  const c = await p.evaluate(() => window.NinjaDodge.time);
  check("N8", "일시정지 · 다시 시작", a === b && c > b, [a, b, c].map((v) => +v.toFixed(2)));
  check("N9", "페이지 오류 없음", p.errs.length === 0, p.errs.slice(0, 3));
  await p.context().close();
}

/* ---------- 공룡 ---------- */
async function testDino(browser) {
  await commonChecks(browser, "D", "/games/dino-hunt/", () => window.DinoHunt && window.DinoHunt.ready);
  const p = await open(browser, "/games/dino-hunt/");
  await p.waitForFunction(() => window.DinoHunt && window.DinoHunt.ready, null, { timeout: 30000 });
  const r = await p.evaluate(() => {
    const D = window.DinoHunt;
    const S = D.S;
    const P = D.player;
    const DT = 1 / 120;
    const run = (brain, limit = 400) => {
      D.start();
      let t = 0;
      while (S.phase === "play" && t < limit) {
        brain();
        D.step(DT);
        t += DT;
      }
      for (let i = 0; i < 240 && S.phase === "dying"; i += 1) D.step(DT);
      D.input.left = D.input.right = D.input.fire = false;
      return { t: Math.round(t), kills: S.kills, bosses: S.bossKills, weapon: S.weaponIndex, zone: S.zone, loop: S.loop, phase: S.phase };
    };
    const stand = run(() => {
      D.input.fire = true;
    });
    const idle = run(() => {});
    // 보스가 멀리 가도 사라지지 않아야 한다
    D.start();
    P.inv = 999;
    S.zoneKills = 999;
    for (let i = 0; i < 30; i += 1) D.step(DT);
    const boss = S.boss;
    boss.x = P.x + 3000;
    for (let i = 0; i < 30; i += 1) D.step(DT);
    const bossKept = S.dinos.includes(S.boss) && Math.abs(S.boss.x - P.x) < 500;
    // 보스를 잡으면 다음 구역으로
    S.boss.hp = 0.1;
    S.bullets.push({ x: S.boss.x, y: S.boss.y - S.boss.h / 2, vx: 1, vy: 0, dmg: 5, pierce: 0, life: 1, color: "#fff", r: 3, hit: null });
    for (let i = 0; i < 120 * 4; i += 1) D.step(DT);
    const moved = S.zone === 1 && S.boss == null;
    // 총이 강해질 때 게임이 멈추지 않는다 (예전엔 버튼을 눌러야 했다)
    D.start();
    P.inv = 999;
    S.kills = 7;
    D.spawnDino("raptor", { x: P.x + 90, hp: 0.5 });
    D.input.fire = true;
    for (let i = 0; i < 120 * 2; i += 1) D.step(DT);
    D.input.fire = false;
    const up = { w: S.weaponIndex, phase: S.phase };
    // 나무 위에서 오래 버티면 흔들려 떨어진다
    D.start();
    P.inv = 999;
    const tree = S.trees[0];
    P.x = tree.x;
    D.tryClimb();
    for (let i = 0; i < 120; i += 1) D.step(DT);
    const perched = P.climbState === "perch";
    D.spawnDino("raptor", { x: tree.x + 10, hp: 500 });
    let fell = false;
    for (let i = 0; i < 120 * 12; i += 1) {
      D.step(DT);
      if (P.climbState === "ground" || P.climbState === "fall") {
        fell = true;
        break;
      }
    }
    return { stand, idle, bossKept, moved, up, perched, fell };
  });
  check("D2", "가만히 있으면 끝남 · 무한히 안 끝나는 일 없음", r.idle.phase === "over" && r.idle.t < 40, r.idle);
  check("D3", "서서 쏘기만 해도 첫 보스까지는 간다 (자동 조준)", r.stand.bosses >= 1, r.stand);
  check("D4", "서서 쏘기만으로는 끝까지 못 감", r.stand.phase === "over", r.stand.t);
  check("D5", "보스가 멀어져도 사라지지 않음 (진행 멈춤 방지)", r.bossKept);
  check("D6", "보스를 잡으면 다음 구역으로", r.moved);
  check("D7", "총이 강해져도 멈추지 않고 이어짐", r.up.w >= 1 && r.up.phase === "play", r.up);
  check("D8", "나무 위로 올라가고, 오래 있으면 흔들려 떨어짐", r.perched && r.fell, [r.perched, r.fell]);
  // 진짜 터치
  const q = await open(browser, "/games/dino-hunt/");
  await q.waitForFunction(() => window.DinoHunt && window.DinoHunt.ready, null, { timeout: 30000 });
  await sleep(300);
  await q.tap("#start-btn");
  await sleep(500);
  const btn = await q.locator("#fire-btn").boundingBox();
  await q.touchscreen.tap(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await sleep(150);
  const shot = await q.evaluate(() => window.DinoHunt.S.bullets.length + window.DinoHunt.S.particles.length);
  await q.context().close();
  check("D9", "발사 버튼을 터치하면 총이 나감", shot > 0, shot);
  const dir = await p.evaluate(() => {
    const D = window.DinoHunt;
    return { quetz: D.TYPES.quetz.native, ptera: D.TYPES.ptera.native };
  });
  check("D10", "케찰코아틀 방향 보정 (원본 그림이 오른쪽을 봄)", dir.quetz === 1 && dir.ptera === -1, dir);
  check("D11", "페이지 오류 없음", p.errs.length === 0, p.errs.slice(0, 3));
  await p.context().close();
}

/* ---------- 콩콩 ---------- */
async function testJump(browser) {
  await commonChecks(browser, "J", "/games/jump-run/", () => window.JumpRun && window.JumpRun.ready);
  const p = await open(browser, "/games/jump-run/");
  await p.waitForFunction(() => window.JumpRun && window.JumpRun.ready, null, { timeout: 30000 });
  const r = await p.evaluate(() => {
    const J = window.JumpRun;
    const DT = J.STEP;
    // 닿을 수 없는 발판 (판 위에 띄워 두고 판만 만들어 본다)
    const reach = {};
    let bad = 0;
    let pairs = 0;
    for (const L of [0, 3, 6, 10, 15, 20, 30, 40]) {
      J.start();
      const seen = new Set();
      for (let i = 0; i < 30 * 120; i += 1) {
        J.player.y = 200;
        J.player.vy = 0;
        J.distance = L * 1100 + 10;
        J.update(DT);
        const ps = J.platforms;
        for (let k = 1; k < ps.length; k += 1) {
          const a = ps[k - 1];
          const c = ps[k];
          if (seen.has(c)) continue;
          seen.add(c);
          if (a.kind === "spring") continue;
          const windy = J.winds.some((w) => w.x < c.x && w.x + w.w > a.x + a.w - 10);
          if (windy) continue;
          const gap = c.x - (a.x + a.w);
          const dy = c.baseY - a.baseY - (c.amp || 0) - (a.amp || 0);
          const T = J.airTime(dy);
          pairs += 1;
          if (T === 0 || J.difficulty().speed * T < gap) bad += 1;
        }
      }
      reach[L + 1] = seen.size;
    }
    // 판을 미리 너무 많이 만들지 않음
    J.start();
    for (let i = 0; i < 60 * 120; i += 1) {
      J.player.y = 200;
      J.player.vy = 0;
      J.update(DT);
    }
    const ahead = J.genX - J.camX;
    const count = J.platforms.length;

    // 스프링은 손을 떼도 높이 뜬다
    J.start();
    const P = J.platforms[0];
    P.kind = "spring";
    J.player.y = P.y - J.player.h - 30;
    J.player.vy = 200;
    J.player.onGround = false;
    let top = 1e9;
    for (let i = 0; i < 120; i += 1) {
      J.update(DT);
      top = Math.min(top, J.player.y);
    }
    const springRise = P.y - J.player.h - top;

    // 톡 / 꾹
    const rise = (hold) => {
      J.start();
      const y0 = J.player.y;
      let m = y0;
      J.down();
      for (let i = 0; i < 90; i += 1) {
        if (i === Math.round(hold * 120)) J.up();
        J.update(DT);
        m = Math.min(m, J.player.y);
      }
      J.up();
      return y0 - m;
    };
    const tap = rise(0.05);
    const full = rise(0.5);

    // 봇
    const HOLDS = [0.02, 0.05, 0.08, 0.11, 0.14, 0.17, 0.2, 0.24, 0.28, 0.32, 0.36];
    const flight = (hold, dy) => {
      let vy = J.JUMP_V;
      let y = 0;
      let t = 0;
      while (t < 2.5) {
        vy += J.GRAVITY / 120;
        if (t >= hold && vy < -220) vy += (-220 - vy) * (1 - Math.pow(0.0001, 1 / 120));
        y += vy / 120;
        t += 1 / 120;
        if (vy > 0 && y >= dy) return t;
      }
      return t;
    };
    const bot = (jit, err) => {
      let left = 0;
      let dec = null;
      return () => {
        const pl = J.player;
        const speed = J.difficulty().speed;
        const meX = J.camX + J.PLAYER_X;
        if (left > 0) {
          left -= DT;
          if (left <= 0) J.up();
        }
        if (!pl.onGround || !pl.plat) return;
        const plat = pl.plat;
        const next = J.platforms.filter((q) => !q.falling && q.x > plat.x + plat.w - 1)[0] || { x: plat.x + plat.w + 500, y: plat.y, w: 200, kind: "normal" };
        const edge = plat.x + plat.w - (meX + 3);
        const spike = J.spikes.find((s) => s.x > meX + 20 && s.x < plat.x + plat.w && Math.abs(s.y - plat.y) < 4);
        const dS = spike ? spike.x - (meX + 30) : 1e9;
        if (!dec || dec.plat !== plat || dec.spike !== (spike || null)) dec = { plat, spike: spike || null, off: (Math.random() * 2 - 1) * jit, miss: Math.random() < err };
        const mustEdge = edge < speed * Math.max(0.015, 0.07 + dec.off);
        const mustSpike = dS < speed * (0.11 + dec.off * 0.8) && dS > -30;
        if (dec.miss && !mustSpike) return;
        if (!mustEdge && !mustSpike) return;
        let best = 0.36;
        if (mustSpike && !mustEdge) {
          const room = plat.x + plat.w - meX;
          for (const h of HOLDS) {
            const land = speed * flight(h, 0);
            if (land > dS + 58 && land < room - 6) {
              best = h;
              break;
            }
          }
        } else {
          const dy = next.y - plat.y;
          const near = next.x + 8 - meX;
          const far = next.x + next.w - 8 - meX;
          const mid = next.x + Math.min(next.w * 0.42, 90) - meX;
          let bv = 1e9;
          for (const h of HOLDS) {
            const land = speed * flight(h, dy);
            const v = land < near || land > far ? 1e6 + Math.abs(land - mid) : Math.abs(land - mid);
            if (v < bv) {
              bv = v;
              best = h;
            }
          }
          if (next.kind === "move") best = Math.max(best, 0.2);
        }
        J.down();
        left = best;
      };
    };
    const play = (b, level) => {
      J.start();
      let t = 0;
      while (J.state === "play" && t < 600 && J.difficulty().level <= level) {
        b();
        J.update(DT);
        t += DT;
      }
      J.up();
      return { lv: J.stats.maxLevel, cause: J.state === "play" ? "끝까지" : J.cause, coins: J.stats.coins };
    };
    const perfect = [];
    for (let i = 0; i < 6; i += 1) perfect.push(play(bot(0, 0), 25));
    const normal = [];
    for (let i = 0; i < 8; i += 1) normal.push(play(bot(0.05, 0.04), 25));
    return { bad, pairs, reach, ahead: Math.round(ahead), count, springRise: Math.round(springRise), tap: Math.round(tap), full: Math.round(full), perfect, normal };
  });
  check("J2", "닿을 수 없는 발판 없음 (예전 21단계는 15%)", r.bad === 0 && r.pairs > 100, `${r.bad}/${r.pairs}`);
  check("J3", "판을 미리 많이 만들지 않음 (예전엔 60초 뒤 1만 픽셀 · 58개)", r.ahead < 1100 && r.count < 24, [r.ahead, r.count]);
  check("J4", "스프링은 손을 떼도 높이 뜸", r.springRise > 180, r.springRise);
  check("J5", "톡 누르면 낮게, 꾹 누르면 높게", r.tap < r.full - 30 && r.full > 100, [r.tap, r.full]);
  const lv = r.perfect.map((q) => q.lv).sort((a, b) => a - b);
  check("J6", "실수 없는 봇은 25단계까지 간다", lv[lv.length >> 1] >= 25, r.perfect.map((q) => `${q.lv}${q.cause === "끝까지" ? "" : q.cause[0]}`).join(" "));
  const nl = r.normal.map((q) => q.lv).sort((a, b) => a - b);
  check("J7", "보통 사람 봇은 3단계 이상 간다", nl[nl.length >> 1] >= 3, nl.join(" "));
  // 공중에서 미리 누른 점프가 오래 남지 않는다 (예전엔 착지 때 무조건 튀었다)
  const buffered = await p.evaluate(() => {
    const J = window.JumpRun;
    J.start();
    J.down();
    J.up();
    for (let i = 0; i < 6; i += 1) J.update(J.STEP);
    J.down(); // 공중에서 누름
    J.up();
    let landedAndStayed = 0;
    for (let i = 0; i < 180; i += 1) {
      J.update(J.STEP);
      if (J.player.onGround) landedAndStayed += 1;
    }
    return landedAndStayed;
  });
  check("J8", "공중에서 미리 누른 점프가 착지 때 멋대로 튀지 않음", buffered > 20, buffered);
  await p.evaluate(() => window.JumpRun.start());
  await sleep(300);
  await p.evaluate(() => TodayPause.pause());
  const a = await p.evaluate(() => window.JumpRun.camX);
  await sleep(250);
  const b = await p.evaluate(() => window.JumpRun.camX);
  await p.evaluate(() => TodayPause.resume());
  await sleep(250);
  const c = await p.evaluate(() => window.JumpRun.camX);
  check("J9", "일시정지 · 다시 시작", a === b && c > b);
  check("J10", "페이지 오류 없음", p.errs.length === 0, p.errs.slice(0, 3));
  await p.context().close();
}

/* ---------- 벽돌 ---------- */
async function testBrick(browser) {
  await commonChecks(browser, "B", "/games/brick/", () => window.BrickGame && window.BrickGame.ready);
  const p = await open(browser, "/games/brick/");
  await p.waitForFunction(() => window.BrickGame && window.BrickGame.ready, null, { timeout: 30000 });
  const r = await p.evaluate(() => {
    const G = window.BrickGame;
    const S = G.S;
    const DT = G.STEP;
    const out = { motifBad: [], unreachable: [], sizes: [] };
    for (const [k, m] of Object.entries(G.MOTIFS)) if (m.some((l) => l.length !== G.COLS)) out.motifBad.push(k);
    const shapes = new Set();
    for (let i = 0; i < 50; i += 1) {
      const rows = G.layout(i);
      if (!G.reachable(rows)) out.unreachable.push(i + 1);
      out.sizes.push(rows.reduce((a, q) => a + (q ? q.filter((c) => c !== "." && c !== "R").length : 0), 0));
      shapes.add(rows.map((q) => (q ? q.join("") : "")).join("|"));
    }
    out.shapes = shapes.size;
    const play = (stage) => {
      G.begin(stage);
      let t = 0;
      let aim = 195;
      let timer = 0;
      let off = 0;
      for (let i = 0; i < 300; i += 1) G.step(DT);
      G.launch();
      while ((S.screen === "play" || S.screen === "clearing") && t < 240) {
        timer -= DT;
        if (timer <= 0) {
          timer = 0.05;
          const py = G.paddleY;
          let best = null;
          let eta = 1e9;
          for (const q of S.balls) {
            if (q.stuck || q.vy <= 0) continue;
            const e = (py - q.y) / q.vy;
            if (e < eta) {
              eta = e;
              best = q;
            }
          }
          if (best) {
            let x = best.x + best.vx * eta;
            const span = 390 - 2 * best.r;
            x -= best.r;
            x = ((x % (2 * span)) + 2 * span) % (2 * span);
            if (x > span) x = 2 * span - x;
            // 사람처럼 바의 여기저기로 받는다 (정가운데로만 받으면 같은 길만 왕복)
            if (Math.random() < 0.05) off = (Math.random() * 2 - 1) * S.paddle.w * 0.36;
            aim = x + best.r + off;
          }
        }
        S.pointerX = aim;
        G.step(DT);
        t += DT;
      }
      return { screen: S.screen, t: Math.round(t), lost: S.lostLives };
    };
    const rows = [];
    for (let i = 0; i < 50; i += 1) rows.push(play(i));
    out.clear = rows.filter((q) => q.screen === "clear").length;
    out.worst = Math.max(...rows.map((q) => q.t));
    out.lost = rows.reduce((a, q) => a + q.lost, 0);
    G.resetSave();

    // 공이 벽돌을 뚫고 지나가지 않음: 벽돌 안에 공 중심이 들어가는 일이 없어야 한다
    G.begin(4);
    for (let i = 0; i < 300; i += 1) G.step(DT);
    G.launch();
    let inside = 0;
    for (let i = 0; i < 240 * 40 && S.screen === "play"; i += 1) {
      S.pointerX = S.balls[0] ? S.balls[0].x : 195;
      G.step(DT);
      for (const q of S.balls) {
        for (const b of S.bricks) {
          if (b.alive && b.type === "R" && q.x > b.x && q.x < b.x + b.w && q.y > b.y && q.y < b.y + b.h) inside += 1;
        }
      }
    }
    out.inside = inside;

    // 아이템
    G.begin(0);
    for (let i = 0; i < 300; i += 1) G.step(DT);
    G.launch();
    for (let i = 0; i < 60; i += 1) G.step(DT);
    const take = (id) => {
      G.dropItemForTest(id, S.paddle.x, G.paddleY - 10);
      for (let i = 0; i < 60; i += 1) {
        S.pointerX = S.paddle.x;
        G.step(DT);
      }
    };
    take("wide");
    take("laser");
    take("fire");
    take("slow");
    take("net");
    const before = S.balls.length;
    take("multi");
    out.items = { wide: S.wideT > 0, laser: S.laserT > 0, fire: S.fireT > 0, slow: S.slowT > 0, net: S.net, multi: S.balls.length > before };

    // 저장 · 잠금
    G.resetSave();
    G.begin(0);
    S.bricks.forEach((b) => (b.alive = false));
    S.bricksLeft = 0;
    for (let i = 0; i < 240 * 2; i += 1) G.step(DT);
    out.saved = { screen: S.screen, unlocked: G.save.unlocked, stars: G.save.best[0].st, score: G.save.best[0].s };
    G.resetSave();
    return out;
  });
  check("B2", "판 설계도: 칸 수가 맞고 갇힌 벽돌이 없음", r.motifBad.length === 0 && r.unreachable.length === 0, { 잘못: r.motifBad, 갇힘: r.unreachable });
  check("B3", "판이 서로 다름 (50단계 중 45개 이상)", r.shapes >= 45, r.shapes);
  check("B4", "정확한 봇이 50단계를 모두 깸", r.clear === 50, `${r.clear}/50 · 가장 오래 ${r.worst}초 · 잃은 목숨 ${r.lost}`);
  check("B5", "공이 바위 안으로 들어가지 않음", r.inside === 0, r.inside);
  check("B6", "아이템이 모두 작동", Object.values(r.items).every(Boolean), r.items);
  check("B7", "깨면 별 · 점수 저장 · 다음 단계 열림", r.saved.screen === "clear" && r.saved.unlocked === 1 && r.saved.stars === 3 && r.saved.score > 0, r.saved);
  // 일시정지 (예전엔 풀어도 멈춰 있었다)
  await p.evaluate(() => window.BrickGame.begin(0));
  await sleep(1100);
  await p.touchscreen.tap(195, 500);
  await sleep(300);
  const launched = await p.evaluate(() => window.BrickGame.S.launched);
  check("B8", "화면을 터치하면 공이 나감", launched);
  const pz = await p.evaluate(async () => {
    const G = window.BrickGame;
    TodayPause.pause();
    const a = G.S.stageTime;
    await new Promise((q) => setTimeout(q, 300));
    const b = G.S.stageTime;
    TodayPause.resume();
    await new Promise((q) => setTimeout(q, 400));
    return [b - a, G.S.stageTime - b];
  });
  check("B9", "일시정지를 풀면 다시 움직임 (예전 버그)", pz[0] === 0 && pz[1] > 0.1, pz.map((v) => +v.toFixed(2)));
  check("B10", "페이지 오류 없음", p.errs.length === 0, p.errs.slice(0, 3));
  await p.context().close();
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
  if (ONLY.includes("ninja")) await testNinja(browser);
  if (ONLY.includes("dino")) await testDino(browser);
  if (ONLY.includes("jump")) await testJump(browser);
  if (ONLY.includes("brick")) await testBrick(browser);
  await browser.close();
  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? " · FAIL: " + failed.map((f) => f.id).join(", ") : ""}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("테스트 중단:", e);
  process.exit(1);
});
