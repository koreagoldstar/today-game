/*
 * 인형뽑기 마스터 점검. 서버를 띄운 뒤: node scripts/test-claw-master.js
 *  ONLY=physics,play,menus,save,modes,mobile,perf 로 일부만 돌릴 수 있다.
 *  키보드 · 마우스 · 터치는 진짜 입력(Playwright / CDP 터치)으로 넣는다. /api 는 가짜로 응답해 통계를 건드리지 않는다.
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3456";
const URL = `${BASE}/games/claw-master/`;
const KEY = "claw-master-v1";
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
}
const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);

async function open(browser, { width = 1280, height = 720, mobile = false, save = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) page.errors.push(m.text());
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.addInitScript(
    ([d, k, s]) => {
      localStorage.setItem(`today-game-visit-${d}`, "1");
      localStorage.setItem("today_visit_counted", "1");
      if (s && !sessionStorage.getItem("cm-seeded")) {
        sessionStorage.setItem("cm-seeded", "1");
        localStorage.setItem(k, s);
      }
    },
    [today, KEY, save]
  );
  await page.goto(URL);
  await page.waitForFunction(() => window.ClawMaster && document.getElementById("boot").classList.contains("hidden"), null, { timeout: 30000 });
  await page.evaluate(async () => {
    window.__sim = await import("/games/claw-master/js/sim.js?v=1");
    window.__data = await import("/games/claw-master/js/data.js?v=1");
    // 사건 기록
    const A = window.ClawMaster;
    window.__ev = [];
    const E = A.events.bind(A);
    A.events = () => {
      for (const e of A.sim.events) window.__ev.push({ ...e });
      E();
    };
  });
  return page;
}
const evCount = (page, t) => page.evaluate((x) => window.__ev.filter((e) => e.t === x).length, t);
const tutorialOff = (page) => page.evaluate(() => (window.ClawMaster.save.tutorial = true));
/** 인형 한 개만 있는 기계로 바꾼다 (점검용) */
const solo = (page, kind, x = 10, z = 30) =>
  page.evaluate(
    ([k, xx, zz]) => {
      const A = window.ClawMaster;
      const { Claw, STEP } = window.__sim;
      A.sim = new Claw({ seed: 3, machine: A.machine, power: A.upVal("power"), stable: A.upVal("stable"), speed: A.upVal("speed"), dolls: [[k, xx, 20, zz, 0]] });
      for (let i = 0; i < 480; i += 1) A.sim.step(STEP, true);
      A.sim.events.length = 0;
      A.faces = new Map();
    },
    [kind, x, z]
  );
/** 집게를 인형 바로 위로 (조준만 대신, 내리기는 진짜 입력으로) */
const aimAt = (page, kind) =>
  page.evaluate((k) => {
    const s = window.ClawMaster.sim;
    const d = s.dolls.find((q) => q.kind === k) || s.dolls[0];
    s.cx = s.hx = d.x;
    s.cz = s.hz = d.z;
    s.cvx = s.cvz = s.hvx = s.hvz = 0;
    return d.kind;
  }, kind);
const waitReady = (page, ms = 30000) => page.waitForFunction(() => window.ClawMaster.sim.phase === "idle", null, { timeout: ms });

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });

  /* ---------- 물리 ---------- */
  if (want("physics")) {
    const page = await open(browser);
    const st = await page.evaluate(() => {
      const { Claw, STEP, BOX, CHUTE } = window.__sim;
      const { MACHINES } = window.__data;
      let maxPen = 0;
      let minFloor = 99;
      let outside = 0;
      let floating = 0;
      let maxV = 0;
      let lost = 0;
      for (let seed = 1; seed <= 24; seed += 1) {
        const s = new Claw({ seed, machine: MACHINES[0] });
        if (s.dolls.length !== MACHINES[0].count) lost += 1;
        // 늦게 기우는 인형은 있어도 되지만, 계속 떨리면 안 됨: 2초 뒤부터 2초 동안 본다
        for (let i = 0; i < 960; i += 1) {
          s.step(STEP, true);
          if (i >= 480) for (const d of s.dolls) maxV = Math.max(maxV, Math.hypot(d.vx, d.vy, d.vz));
        }
        if (s.dolls.length !== MACHINES[0].count) lost += 1;
        const all = s.dolls.flatMap((d) => d.sw.map((q) => ({ d, q })));
        for (const d of s.dolls) {
          if (d.x < BOX.x0 || d.x > BOX.x1 || d.z < BOX.z0 || d.z > BOX.z1) outside += 1;
          let low = 99;
          for (const q of d.sw) low = Math.min(low, q[1] - q[3]);
          const inChute = d.x < CHUTE.x1 && d.z < CHUTE.z1;
          if (!inChute) minFloor = Math.min(minFloor, low);
          // 받침: 바닥 · 다른 인형 · 배출구 벽 · 기계 벽 중 하나에 닿아 있어야 (공중에 멈춤 X)
          const touch = d.sw.some((q) => all.some((o) => o.d !== d && Math.hypot(o.q[0] - q[0], o.q[1] - q[1], o.q[2] - q[2]) < o.q[3] + q[3] + 0.6));
          const wall = d.sw.some((q) => q[0] - q[3] < BOX.x0 + 0.6 || q[0] + q[3] > BOX.x1 - 0.6 || q[2] - q[3] < BOX.z0 + 0.6 || q[2] + q[3] > BOX.z1 - 0.6 || (Math.abs(q[0] - CHUTE.x1) < q[3] + 1 && q[2] < CHUTE.z1 + q[3]) || (Math.abs(q[2] - CHUTE.z1) < q[3] + 1 && q[0] < CHUTE.x1 + q[3]));
          if (low > 0.8 && !touch && !wall) floating += 1;
        }
        for (let i = 0; i < all.length; i += 1)
          for (let j = i + 1; j < all.length; j += 1) {
            const a = all[i];
            const b = all[j];
            if (a.d === b.d) continue;
            const pen = a.q[3] + b.q[3] - Math.hypot(a.q[0] - b.q[0], a.q[1] - b.q[1], a.q[2] - b.q[2]);
            maxPen = Math.max(maxPen, pen);
          }
      }
      return { maxPen, minFloor, outside, floating, maxV, lost };
    });
    check("인형끼리 파고들지 않음 (24판 · 최대 겹침 0.5cm 미만)", st.maxPen < 0.5, `${st.maxPen.toFixed(2)}cm`);
    check("바닥을 뚫지 않음", st.minFloor > -0.3, `가장 낮은 곳 ${st.minFloor.toFixed(2)}cm`);
    check("기계 밖으로 안 나감 · 시작할 때 인형이 사라지지 않음", st.outside === 0 && st.lost === 0, `밖 ${st.outside} · 줄어든 판 ${st.lost}`);
    check("공중에 멈춘 인형 없음", st.floating === 0, `${st.floating}개`);
    check("가만히 두면 멈춰 있음 (계속 떨리지 않음)", st.maxV < 3, `최대 속도 ${st.maxV.toFixed(2)}cm/s`);

    // 인형별 · 힘별 잡기 (같은 8곳 x 선 자세 · 누운 자세 = 16번)
    const grab = await page.evaluate(() => {
      const { Claw, STEP } = window.__sim;
      const { MACHINES } = window.__data;
      const offs = [[0, 0], [1, 0], [0, 1], [-1.5, 0], [0, -1.5], [2.5, 0], [0, 2.5], [3.5, 1]];
      const out = {};
      let maxCable = 0;
      let bounce = 0;
      let slips = 0;
      for (const power of [1, 1.6]) {
        for (const kind of ["bear", "bunny", "pig", "duck", "panda", "cat", "fox", "penguin", "tiger", "koala", "unicorn", "dragon"]) {
          let win = 0;
          for (const [off, a0] of offs.flatMap((o) => [[o, 0], [o, 1.4]])) {
            const s = new Claw({ seed: 3, machine: MACHINES[0], power, dolls: [[kind, 10, 20, 30, a0]] });
            for (let i = 0; i < 480; i += 1) s.step(STEP, true);
            const d = s.dolls[0];
            s.cx = s.hx = d.x + off[0];
            s.cz = s.hz = d.z + off[1];
            s.phase = "moving";
            s.drop();
            for (let i = 0; i < 240 * 16 && s.phase !== "idle"; i += 1) {
              s.step(STEP, false);
              // 줄: 수레와 집게 사이가 줄 길이보다 길어지지 않음
              const cable = Math.hypot(s.hx - s.cx, s.hy - 86, s.hz - s.cz) - s.L;
              maxCable = Math.max(maxCable, cable);
              // 집게를 닫을 때 인형이 튀지 않음
              if ((s.phase === "closing" || s.phase === "gripping") && s.dolls[0] && s.dolls[0].vy > 90) bounce += 1;
              for (const e of s.events) {
                if (e.t === "prize") win += 1;
                if (e.t === "slip") slips += 1;
              }
              s.events.length = 0;
            }
          }
          out[`${kind}@${power}`] = win;
        }
      }
      return { out, maxCable, bounce, slips };
    });
    const g = grab.out;
    const avg = (ks, p) => ks.reduce((a, k) => a + g[`${k}@${p}`], 0) / ks.length;
    const COMMON = ["bear", "bunny", "pig", "duck"];
    const RARE = ["panda", "cat", "fox", "penguin", "tiger", "koala", "unicorn", "dragon"];
    const all = [...COMMON, ...RARE];
    const common = avg(COMMON, 1);
    const rare = avg(RARE, 1);
    const rareUp = avg(RARE, 1.6);
    const base = Object.fromEntries(all.map((k) => [k, g[`${k}@1`]]));
    check("일반 인형은 잘 노리면 잡힘 (기본 힘 · 16번 중 평균 5번 이상)", common >= 5, JSON.stringify(base));
    check("등급 때문에 불가능한 인형 없음: 12종 모두 기본 힘으로 정확히 노리면 잡힘", all.every((k) => g[`${k}@1`] >= 1), JSON.stringify(base));
    check("희귀 이상은 일반보다 정확해야 함 (평균 성공이 더 낮음)", rare < common, `일반 ${common.toFixed(1)} · 희귀 이상 ${rare.toFixed(1)} / 16`);
    check("집게 힘 업그레이드로 희귀 인형이 확실히 쉬워짐", rareUp >= rare + 4, `${rare.toFixed(1)} → ${rareUp.toFixed(1)} / 16`);
    check("놓치는 이유가 물리로 보임 (미끄러짐 사건)", grab.slips > 0, `미끄러짐 ${grab.slips}번`);
    check("줄이 늘어나지 않음 (자연스러운 줄)", grab.maxCable < 0.8, `최대 ${grab.maxCable.toFixed(2)}cm`);
    check("집게를 닫을 때 인형이 튀어 오르지 않음", grab.bounce === 0, `${grab.bounce}번`);

    // 쌓인 더미에서 맨 위 인형 노리기: 되긴 하지만 매번은 아님
    const pile = await page.evaluate(() => {
      const { Claw, STEP } = window.__sim;
      const { MACHINES } = window.__data;
      let win = 0;
      let n = 0;
      let wrongChute = 0;
      let pushed = 0;
      for (let seed = 1; seed <= 16; seed += 1) {
        const s = new Claw({ seed: seed * 7, machine: MACHINES[0] });
        const top = s.dolls.slice().sort((a, b) => b.y - a.y)[0];
        const before = s.dolls.filter((d) => d !== top).map((d) => [d, d.x, d.y, d.z]);
        s.cx = s.hx = top.x;
        s.cz = s.hz = top.z;
        s.phase = "moving";
        s.drop();
        n += 1;
        let got = 0;
        for (let i = 0; i < 240 * 18 && s.phase !== "idle"; i += 1) {
          s.step(STEP, false);
          for (const e of s.events) if (e.t === "prize") got += 1;
          s.events.length = 0;
        }
        if (got) win += 1;
        // F: 목표가 아닌 인형이 집게 · 들린 인형에 밀리거나 굴러감
        if (before.some(([d, x, y, z]) => s.dolls.includes(d) && Math.hypot(d.x - x, d.y - y, d.z - z) > 1)) pushed += 1;
        // 배출구에 들어간 것만 사라진다 (남은 인형 + 뽑힌 수 = 처음 수)
        if (s.dolls.length + got !== MACHINES[0].count) wrongChute += 1;
      }
      return { win, n, wrongChute, pushed };
    });
    check("더미 맨 위 인형: 가끔 성공 · 가끔 실패 (5~85%)", pile.win / pile.n >= 0.05 && pile.win / pile.n <= 0.85, `${pile.win}/${pile.n}`);
    check("배출구로 들어간 인형만 획득 처리", pile.wrongChute === 0, `${pile.wrongChute}판 어긋남`);
    check("F. 더미에서 집으면 주변 인형도 밀리거나 굴러감 (16판 중 4판 이상)", pile.pushed >= 4, `${pile.pushed}/16판`);

    const perf = await page.evaluate(() => {
      const { Claw, STEP } = window.__sim;
      const { MACHINES } = window.__data;
      const s = new Claw({ seed: 9, machine: MACHINES[0] });
      const t0 = performance.now();
      for (let i = 0; i < 2400; i += 1) s.step(STEP, true);
      return (performance.now() - t0) / 2400;
    });
    check("물리 한 걸음 0.25ms 이하 (14개 · 1/240초)", perf < 0.25, `${perf.toFixed(3)}ms`);
    check("물리 오류 없음", page.errors.length === 0, page.errors.slice(0, 2).join(" | "));
    await page.context().close();
  }

  /* ---------- 상황별 물리 (지시서 A~I): 실제 엔진으로 한 판씩 ---------- */
  if (want("scenarios")) {
    const page = await open(browser);
    const R = await page.evaluate(() => {
      const { Claw, STEP, BOX } = window.__sim;
      const { MACHINES } = window.__data;
      const bits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
      /** 한 판: dolls 배치 → (x,z)로 내려 → 끝날 때까지. hook(s) 로 중간 조작 */
      const turn = (dolls, x, z, o = {}) => {
        const s = new Claw({ seed: 3, machine: MACHINES[0], power: o.power || 1, dolls });
        for (let i = 0; i < 480; i += 1) s.step(STEP, true);
        const start = s.dolls.map((d) => ({ id: d.id, x: d.x, y: d.y, z: d.z }));
        const tgt = o.target ? s.dolls.find((d) => d.kind === o.target) : null;
        s.cx = s.hx = tgt ? tgt.x + x : x;
        s.cz = s.hz = tgt ? tgt.z + z : z;
        s.phase = "moving";
        s.drop();
        const r = { phases: [], prize: [], grab: 0, slip: 0, jump: 0, warp: 0, heldBad: 0, relX: [], swing: [], maxV: 0, n0: s.dolls.length, outside: 0, empty: false };
        let last = "";
        const prev = new Map(s.dolls.map((d) => [d.id, [d.x, d.y, d.z]]));
        for (let i = 0; i < 240 * 22 && s.phase !== "idle"; i += 1) {
          if (o.hook) o.hook(s, i);
          s.step(STEP, false);
          if (s.phase !== last) r.phases.push((last = s.phase));
          for (const e of s.events) {
            if (e.t === "prize") r.prize.push(e.kind);
            if (e.t === "grab") r.grab += 1;
            if (e.t === "slip") r.slip += 1;
          }
          s.events.length = 0;
          for (const d of s.dolls) {
            const p = prev.get(d.id);
            // 순간이동: 속도로 설명 안 되는 위치 변화 / 집게에 닿아 있는 동안의 한 걸음 이동
            if (p) {
              const step = Math.hypot(d.x - p[0], d.y - p[1], d.z - p[2]);
              r.warp = Math.max(r.warp, step - Math.hypot(d.vx, d.vy, d.vz) * STEP);
              if (d.prongMask) r.jump = Math.max(r.jump, step);
            }
            prev.set(d.id, [d.x, d.y, d.z]);
            r.maxV = Math.max(r.maxV, Math.hypot(d.vx, d.vy, d.vz));
            if (d.held && bits(d.prongMask) < 2) r.heldBad += 1;
            if (d.held && s.phase === "carrying") {
              r.relX.push(d.x - s.hx);
              r.swing.push(d.x - s.cx);
            }
          }
        }
        for (const d of s.dolls) if (d.x < BOX.x0 - 1 || d.x > BOX.x1 + 1 || d.z < -1 || d.z > BOX.z1 + 1 || d.y < -2) r.outside += 1;
        r.n1 = s.dolls.length;
        r.log = s.log.slice(-6);
        r.moved = s.dolls.filter((d) => {
          const p = start.find((q) => q.id === d.id);
          return p && Math.hypot(d.x - p.x, d.z - p.z) > 1;
        }).length;
        return r;
      };
      const span = (a) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
      const out = {};
      // A. 몸통 가운데를 정확히: 곰 하나
      out.A = turn([["bear", 10, 20, 30, 0]], 0, 0, { target: "bear" });
      // B. 가장자리: 곰 옆 6cm
      out.B = turn([["bear", 10, 20, 30, 0]], 6.5, 0, { target: "bear" });
      // C. 귀만: 토끼 귀 높이에서 멈춰 닫기 (하강을 귀에서 끊는다)
      out.C = [0, 1, -1, 0.5].map((dx) =>
        turn([["bunny", 10, 20, 30, 0]], dx, 0, {
          target: "bunny",
          hook: (s) => {
            const b = s.dolls[0];
            const tip = s.pp ? Math.min(...s.pp.map((q) => q[2][1])) : 99;
            if (s.phase === "descending" && b && tip < b.sw[2][1] + 1) {
              s.L = Math.hypot(s.hx - s.cx, s.hy - 86, s.hz - s.cz);
              s.Lrate = 0;
              s.go("contact");
            }
          },
        })
      );
      // D. 두 인형 사이
      out.D = turn([["bear", -2, 20, 30, 0], ["bear", 16, 20, 30, 0]], 7, 30);
      // E. 큰 인형 (판다) 가운데
      out.E = turn([["panda", 10, 20, 30, 0]], 0, 0, { target: "panda" });
      // G. 들고 있을 때 수레를 갑자기 크게 흔듦 (관성 · 늦게 따라옴)
      out.G = turn([["bear", 10, 20, 30, 0]], 0, 0, {
        target: "bear",
        power: 1.6,
        hook: (s) => {
          if (s.phase === "carrying" && s.phaseT < 0.6) s.cvx = s.phaseT < 0.3 ? -40 : 40;
        },
      });
      // I. 빈 곳에서 닫힘
      out.I = turn([["bear", 10, 20, 30, 0]], 30, 50);
      return out;
    });
    const { A, B, C, D, E, G, I } = R;
    const span = (a) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
    const seq = ["descending", "contact", "closing", "gripping", "lifting", "carrying", "releasing", "returning", "idle"];
    check("A. 가운데를 정확히 → 상태가 하강·접촉·닫힘·잡기·상승·운반·놓기·복귀 순서 · 배출구로 들어감", JSON.stringify(A.phases) === JSON.stringify(seq) && A.prize[0] === "bear" && A.n1 === A.n0 - 1, `${A.phases.join(">")} · ${A.prize}`);
    check("A. 인형이 집게로 순간이동하지 않음 (집게에 닿은 동안 한 걸음 1cm 미만 · 속도로 설명 안 되는 이동 없음)", A.jump < 1 && Math.max(A.warp, B.warp, E.warp, G.warp) < 0.05, `걸음 ${A.jump.toFixed(2)}cm · 설명 안 되는 이동 ${Math.max(A.warp, B.warp, E.warp, G.warp).toFixed(3)}cm`);
    check("A. 잡힘은 늘 서로 다른 발 2개 이상이 닿을 때만", A.heldBad === 0 && B.heldBad === 0 && E.heldBad === 0);
    check("A. 운반 중 인형이 케이블에 매달려 수레보다 늦게 흔들림 (진자)", span(A.swing) > 2, `수레 기준 ${span(A.swing).toFixed(2)}cm`);
    check("B. 가장자리를 잡으면 실패하고 인형은 기계 안에 남음", !B.prize.length && B.n1 === B.n0 && B.outside === 0, B.log.join(" / "));
    const cWins = C.filter((r) => r.prize.length).length;
    check("C. 귀만 잡으면 대부분 빠짐 (4번 중 1번 이하)", cWins <= 1, `${cWins}/4 · ${C[0].log.slice(-3).join(" / ")}`);
    check("D. 두 인형 사이: 튀거나 겹치지 않고 둘 다 기계 안 · 주변이 밀림", D.maxV < 300 && D.outside === 0 && D.n1 + D.prize.length === D.n0 && D.moved >= 1, `최대 ${D.maxV.toFixed(0)}cm/s · 움직인 인형 ${D.moved}`);
    check("E. 큰 판다를 가운데로 잡으면 들려 올라감", E.grab >= 1, E.log.join(" / "));
    check("G. 수레를 갑자기 흔들면 인형이 늦게 따라오며 흔들림 · 순간이동 없음", span(G.relX) > 1 && G.jump < 1.2, `흔들림 ${span(G.relX).toFixed(2)}cm · 최대 걸음 ${G.jump.toFixed(2)}cm · ${G.prize.length ? "획득" : "떨어짐"}`);
    check("I. 빈 곳에서 닫으면 '잡기' 단계 없이 빈 집게로 돌아옴", !I.phases.includes("gripping") && !I.grab && !I.prize.length && I.log.some((l) => l.includes("빈 곳")), I.log.join(" / "));
    check("상황 점검 오류 없음", page.errors.length === 0, page.errors.slice(0, 2).join(" | "));
    await page.context().close();
  }

  /* ---------- PC 플레이: 키보드 · 마우스 · 획득 ---------- */
  if (want("play")) {
    const page = await open(browser);
    await tutorialOff(page);
    check("첫 화면 · 코인 40", await page.evaluate(() => window.ClawMaster.screen === "title" && window.ClawMaster.save.coins === 40));
    await page.click("#play-btn");
    check("자유 뽑기 → 플레이 화면", await page.evaluate(() => window.ClawMaster.screen === "play"));
    await page.keyboard.press("Space");
    let s = await page.evaluate(() => ({ c: window.ClawMaster.save.coins, ph: window.ClawMaster.sim.phase }));
    check("Space 로 동전 넣기 (코인 -2)", s.c === 38 && s.ph === "moving", JSON.stringify(s));
    const p0 = await page.evaluate(() => ({ x: window.ClawMaster.sim.cx, z: window.ClawMaster.sim.cz }));
    await page.keyboard.down("KeyD");
    await sleep(600);
    await page.keyboard.up("KeyD");
    await page.keyboard.down("KeyW");
    await sleep(500);
    await page.keyboard.up("KeyW");
    await sleep(250);
    const p1 = await page.evaluate(() => ({ x: window.ClawMaster.sim.cx, z: window.ClawMaster.sim.cz, vx: window.ClawMaster.sim.cvx }));
    check("D 오른쪽 · W 안쪽으로 움직임", p1.x > p0.x + 8 && p1.z > p0.z + 6, `x ${p0.x.toFixed(1)}→${p1.x.toFixed(1)} · z ${p0.z.toFixed(1)}→${p1.z.toFixed(1)}`);
    check("키를 떼면 멈춤", Math.abs(p1.vx) < 1, `속도 ${p1.vx.toFixed(2)}`);
    await page.keyboard.down("KeyA");
    await sleep(400);
    await page.keyboard.up("KeyA");
    await page.keyboard.down("KeyS");
    await sleep(300);
    await page.keyboard.up("KeyS");
    const p2 = await page.evaluate(() => ({ x: window.ClawMaster.sim.cx, z: window.ClawMaster.sim.cz }));
    check("A 왼쪽 · S 앞쪽", p2.x < p1.x - 4 && p2.z < p1.z - 3);
    // 마우스로 기계 안을 끌기
    const target = await page.evaluate(() => {
      const v = window.ClawMaster.view;
      const r = document.getElementById("game").getBoundingClientRect();
      return { x: r.left + v.X(30, 40), y: r.top + v.Y(0, 40) };
    });
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await sleep(3500);
    await page.mouse.up();
    const p3 = await page.evaluate(() => ({ x: window.ClawMaster.sim.cx, z: window.ClawMaster.sim.cz }));
    check("마우스로 끈 곳으로 집게가 감", Math.abs(p3.x - 30) < 4 && Math.abs(p3.z - 40) < 4, `(${p3.x.toFixed(1)}, ${p3.z.toFixed(1)})`);
    // 남은 시간이 지나면 저절로 내려감
    await page.evaluate(() => (window.ClawMaster.turnLeft = 0.3));
    await sleep(600);
    check("시간이 다 되면 자동으로 내려감", await page.evaluate(() => window.ClawMaster.sim.phase !== "moving"));
    await waitReady(page);

    // 획득: 곰 하나만 있는 기계
    const before = await page.evaluate(() => ({ c: window.ClawMaster.save.coins, b: window.ClawMaster.save.col.bear || 0 }));
    await solo(page, "bear");
    await page.keyboard.press("Space");
    await aimAt(page, "bear");
    await page.keyboard.press("Space");
    await page.waitForFunction(() => window.ClawMaster.revealing(), null, { timeout: 30000 }).catch(() => {});
    s = await page.evaluate(() => ({ c: window.ClawMaster.save.coins, col: window.ClawMaster.save.col.bear, name: document.getElementById("rv-name").textContent, isNew: !document.getElementById("rv-new").classList.contains("hidden") }));
    check("곰 획득 → 창 + 코인 (+4, 처음이면 NEW) + 도감 등록", s.name === "몽실곰" && s.isNew === (before.b === 0) && s.col === before.b + 1 && s.c === before.c - 2 + 4 + (before.b ? 2 : 0), `${JSON.stringify(before)} → ${JSON.stringify(s)}`);
    check("잡을 때 · 들 때 사건 (소리 · 진동 · 표정)", (await evCount(page, "grab")) >= 1 && (await evCount(page, "clack")) >= 1);
    await sleep(500);
    await page.keyboard.press("Space");
    check("Space 로 획득 창 닫기", await page.evaluate(() => !window.ClawMaster.revealing()));
    await waitReady(page);
    const c1 = await page.evaluate(() => window.ClawMaster.save.coins);
    await solo(page, "bear");
    await page.keyboard.press("Space");
    await aimAt(page, "bear");
    await page.keyboard.press("Space");
    await page.waitForFunction(() => window.ClawMaster.revealing(), null, { timeout: 30000 }).catch(() => {});
    s = await page.evaluate(() => ({ c: window.ClawMaster.save.coins, col: window.ClawMaster.save.col.bear, isNew: !document.getElementById("rv-new").classList.contains("hidden") }));
    check("같은 인형 다시 → 중복 보너스 (+4+2)", s.col === before.b + 2 && !s.isNew && s.c === c1 - 2 + 6, `${c1} → ${s.c}`);
    await sleep(500);
    await page.mouse.click(640, 360);
    await waitReady(page);
    // 앞뒤 조준선 · 잡을 때 다가가는 카메라 · 눌리는 인형 · 옮길 때 물러남
    await solo(page, "duck");
    await page.keyboard.press("Space");
    await aimAt(page, "duck");
    await sleep(300);
    const aimSt = await page.evaluate(() => ({ guide: window.ClawMaster.guide, on: window.ClawMaster.groundUnder().target === window.ClawMaster.sim.dolls[0].id }));
    check("조준할 때 바닥 · 옆벽 조준선이 켜지고 그림자가 노리는 인형 위에", aimSt.guide > 0.9 && aimSt.on, JSON.stringify(aimSt));
    await page.keyboard.press("Space");
    await page.waitForFunction(() => window.ClawMaster.sim.phase === "closing" && window.ClawMaster.sim.phaseT > 0.15, null, { timeout: 20000 }).catch(() => {});
    const grabSt = await page.evaluate(() => ({ zoom: window.ClawMaster.zoom, guide: window.ClawMaster.guide }));
    check("잡을 때 카메라가 집게로 다가가고 조준선은 꺼짐", grabSt.zoom > 0.2 && grabSt.guide < 0.1, JSON.stringify(grabSt));
    // 오리는 누운 채라 발이 몸 아래로 닫히고, 들어 올릴 때 걸린다
    await page.waitForFunction(() => window.ClawMaster.sim.dolls.some((d) => d.held), null, { timeout: 20000 }).catch(() => {});
    await sleep(150);
    const grip = await page.evaluate(() => (window.ClawMaster.sim.dolls[0] ? window.ClawMaster.sim.dolls[0].grip || 0 : -1));
    check("집게 발에 잡힌 인형이 말랑하게 눌림", grip > 0.2, grip.toFixed(2));
    // 잡힌 인형이 집게 앞발을 덮지 않음: 앞발 아래 마디의 화면 점 5곳 중 대부분이 쇠 색(회색)이어야 (반짝이 효과가 한두 점 덮을 수 있음)
    const px = await page.evaluate(() => {
      const A = window.ClawMaster;
      const s = A.sim;
      const v = A.view;
      const fi = s.prongs.findIndex((p) => p.rz <= 0);
      const pp = s.prongs.map((p) => s.prongPts(p))[fi];
      const z = A.zoom;
      const out = [];
      for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) {
        const m = [0, 1, 2].map((k) => pp[1][k] + (pp[2][k] - pp[1][k]) * t);
        const sx = A.camX + (v.X(m[0], m[2]) - A.camX) * (1 + z);
        const sy = A.camY + (v.Y(m[1], m[2]) - A.camY) * (1 + z);
        const d = A.g.getImageData(Math.round(sx * A.dpr), Math.round(sy * A.dpr), 1, 1).data;
        out.push([d[0], d[1], d[2]]);
      }
      return { rgb: out, held: s.dolls.some((q) => q.held) };
    });
    // 오리(노랑)가 앞발을 덮으면 노란 점이 찍힌다. 쇠 색 · 발끝 분홍 고무는 집게 그림
    const duckN = px.rgb.filter((c) => c[0] > 200 && c[1] > 160 && c[2] < 140).length;
    const gray = duckN <= 1;
    check("잡힌 인형 앞으로 집게 앞발이 보임 (인형이 집게를 덮지 않음)", px.held && gray, JSON.stringify(px));
    let bend = 0;
    for (let i = 0; i < 40; i += 1) {
      bend = Math.max(bend, await page.evaluate(() => {
        const A = window.ClawMaster;
        const d = A.sim.dolls.find((q) => q.held);
        const s = d && A.view.soft.get(d.id);
        return s ? Math.abs(s.bend) : 0;
      }));
      if (await page.evaluate(() => window.ClawMaster.sim.phase === "releasing")) break;
      await sleep(100);
    }
    check("옮길 때 잡힌 인형 몸통이 집게보다 늦게 따라 휨 (말랑한 목)", bend > 0.02, `최대 ${bend.toFixed(3)}rad`);
    await page.waitForFunction(() => window.ClawMaster.sim.phase === "releasing", null, { timeout: 20000 }).catch(() => {});
    await sleep(600);
    const zoom = await page.evaluate(() => window.ClawMaster.zoom);
    check("배출구로 옮길 때 카메라가 물러남", zoom < 0.12, zoom.toFixed(2));
    await page.waitForFunction(() => window.ClawMaster.revealing() || window.ClawMaster.sim.phase === "idle", null, { timeout: 30000 });
    await sleep(500);
    await page.mouse.click(640, 360);
    // 동전이 모자라면 무료 코인 창
    await waitReady(page);
    await page.evaluate(() => {
      window.ClawMaster.save.coins = 1;
      window.ClawMaster.save.freeAt = 0;
    });
    await page.keyboard.press("Space");
    check("코인이 모자라면 충전 창", await page.isVisible("#refill"));
    await page.click("#rf-get");
    s = await page.evaluate(() => ({ c: window.ClawMaster.save.coins, wait: window.ClawMaster.save.freeAt > Date.now() }));
    check("무료 코인 +15 · 3분 대기", s.c === 16 && s.wait, JSON.stringify(s));
    await page.evaluate(() => (window.ClawMaster.save.coins = 0));
    await page.keyboard.press("Space");
    check("대기 중에는 다시 못 받음", await page.isDisabled("#rf-get"));
    await page.click("#rf-close");
    // 일시정지: 물리가 멈춤
    await page.evaluate(() => (window.ClawMaster.save.coins = 20));
    await page.keyboard.press("Space");
    await page.keyboard.press("Escape");
    const t0 = await page.evaluate(() => window.ClawMaster.sim.t);
    await sleep(500);
    const t1 = await page.evaluate(() => window.ClawMaster.sim.t);
    check("Esc 일시정지 동안 멈춤", t1 === t0 && (await page.isVisible("#today-pause-overlay")));
    await page.click("#today-pause-resume");
    await sleep(300);
    check("계속하기 → 다시 움직임", (await page.evaluate(() => window.ClawMaster.sim.t)) > t1);
    // 탭을 숨겼다 돌아오기: 누르던 키가 남지 않음
    await page.evaluate(() => window.ClawMaster.sim.phase === "idle" && window.ClawMaster.act());
    await page.keyboard.down("KeyD");
    await sleep(200);
    const tab = await page.evaluate(() => {
      const A = window.ClawMaster;
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      const out = { held: A.keys.r, input: A.sim.input.x, paused: A.paused };
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
      return out;
    });
    await page.keyboard.up("KeyD");
    check("탭 숨김 → 저절로 일시정지 · 누르던 키 풀림", tab.paused && tab.held === 0 && tab.input === 0, JSON.stringify(tab));
    await page.click("#today-pause-resume");
    await sleep(500);
    const back = await page.evaluate(() => ({ v: window.ClawMaster.sim.cvx, ph: window.ClawMaster.sim.phase, paused: window.ClawMaster.paused }));
    check("돌아와 계속하면 집게가 저절로 움직이지 않음", !back.paused && Math.abs(back.v) < 1 && back.ph === "moving", JSON.stringify(back));
    // 창 크기 바꾸기 (회전 · 창 조절)
    await page.setViewportSize({ width: 700, height: 900 });
    await sleep(300);
    await page.setViewportSize({ width: 1280, height: 720 });
    await sleep(300);
    const rs = await page.evaluate(() => {
      const v = window.ClawMaster.view;
      return { w: v.W, h: v.H, inside: v.win.x >= 0 && v.win.x + v.win.w <= innerWidth && v.win.y >= 0 && v.win.y + v.win.h <= innerHeight };
    });
    check("창 크기를 바꿔도 기계가 화면 안에 다시 맞춰짐", rs.w === 1280 && rs.h === 720 && rs.inside, JSON.stringify(rs));
    check("플레이 오류 없음", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  /* ---------- 메뉴: 컬렉션 · 업그레이드 · 꾸미기 · 설정 ---------- */
  if (want("menus")) {
    const save = JSON.stringify({ coins: 1000, col: { bear: 3, unicorn: 1 }, tutorial: true, lastDay: today });
    const page = await open(browser, { save });
    await page.click('[data-go="col"]');
    let c = await page.evaluate(() => ({
      n: document.getElementById("col-n").textContent,
      cells: document.querySelectorAll("#col-grid .cell").length,
      unknown: document.querySelectorAll("#col-grid .cell.no").length,
      names: [...document.querySelectorAll("#col-grid .cell b")].map((b) => b.textContent),
    }));
    check("도감 12칸 · 2종 보유 · 나머지는 실루엣(???)", c.n === "2 / 12" && c.cells === 12 && c.unknown === 10 && c.names.includes("몽실곰") && c.names.filter((x) => x === "???").length === 10, JSON.stringify(c).slice(0, 120));
    await page.click('#col-tabs [data-i="3"]');
    c = await page.evaluate(() => [...document.querySelectorAll("#col-grid .cell b")].map((b) => b.textContent));
    check("등급 필터 (전설만)", c.length === 1 && c[0] === "유니콘슈", c.join(","));
    await page.click("#col-grid .cell");
    check("인형 자세히 보기", (await page.isVisible("#detail")) && (await page.textContent("#md-n")).includes("1번"));
    await page.click("#md-close");
    await page.click("#col [data-back]");
    await page.click('[data-go="up"]');
    await page.click('#ups [data-u="power"]');
    let u = await page.evaluate(() => ({ lv: window.ClawMaster.save.up.power, c: window.ClawMaster.save.coins }));
    check("집게 힘 업그레이드 (코인 40)", u.lv === 1 && u.c === 960, JSON.stringify(u));
    await page.click('#ups [data-u="power"]');
    u = await page.evaluate(() => ({ lv: window.ClawMaster.save.up.power, c: window.ClawMaster.save.coins }));
    check("다음 단계는 더 비쌈 (코인 80)", u.lv === 2 && u.c === 880, JSON.stringify(u));
    await page.click('#skins [data-k="gold"]');
    u = await page.evaluate(() => ({ skin: window.ClawMaster.save.skin, own: window.ClawMaster.save.skins, c: window.ClawMaster.save.coins, view: window.ClawMaster.view.skin.id }));
    check("골드 집게 구입 · 바로 적용", u.skin === "gold" && u.own.includes("gold") && u.c === 730 && u.view === "gold", JSON.stringify(u));
    await page.click("#up [data-back]");
    await page.click("#play-btn");
    const pw = await page.evaluate(() => ({ p: window.ClawMaster.sim.power, sk: window.ClawMaster.view.skin.id }));
    check("업그레이드가 실제 집게 힘에 반영 (1.24)", Math.abs(pw.p - 1.24) < 1e-9 && pw.sk === "gold", JSON.stringify(pw));
    await page.evaluate(() => window.ClawMaster.toTitle());
    await page.click('[data-go="set"]');
    await page.uncheck("#set-music");
    await page.$eval("#set-sfxv", (el) => {
      el.value = "30";
      el.dispatchEvent(new Event("input"));
    });
    const snd = await page.evaluate(() => ({ s: window.ClawMaster.save.sound, mv: window.ClawMaster.sfx.musicOn, v: window.ClawMaster.sfx.sfxVol }));
    check("설정: 배경 음악 끄기 · 효과음 크기", snd.s.music === false && snd.mv === false && Math.abs(snd.v - 0.3) < 1e-6, JSON.stringify(snd.s));
    await page.reload();
    await page.waitForFunction(() => window.ClawMaster);
    const kept = await page.evaluate(() => {
      const S = window.ClawMaster.save;
      return { c: S.coins, up: S.up.power, skin: S.skin, music: S.sound.music, bear: S.col.bear };
    });
    check("새로고침해도 코인 · 업그레이드 · 꾸미기 · 설정 · 도감 유지", kept.c === 730 && kept.up === 2 && kept.skin === "gold" && kept.music === false && kept.bear === 3, JSON.stringify(kept));
    check("메뉴 오류 없음", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  /* ---------- 저장이 망가졌을 때 ---------- */
  if (want("save")) {
    for (const [name, raw] of [
      ["문법이 깨진 값", "{bad json"],
      ["배열", "[1,2,3]"],
      ["엉뚱한 타입 · 음수 · 큰 값", JSON.stringify({ coins: "많이", col: { bear: -5, zzz: 3, fox: 2 }, up: { power: 99, aim: -1 }, skin: "rainbow", skins: ["silver", "hack"], stats: 5, sound: { sfxVol: 7 }, daily: [] })],
    ]) {
      const page = await open(browser, { save: raw });
      const s = await page.evaluate(() => {
        const S = window.ClawMaster.save;
        return { coins: S.coins, col: S.col, up: S.up, skin: S.skin, skins: S.skins, vol: S.sound.sfxVol, screen: window.ClawMaster.screen };
      });
      const ok = Number.isFinite(s.coins) && s.coins >= 0 && !s.col.bear && !s.col.zzz && s.up.power <= 5 && s.up.aim >= 0 && s.skin === "silver" && !s.skins.includes("hack") && s.vol <= 1 && s.screen === "title";
      check(`망가진 저장 (${name}) → 안전하게 시작`, ok && page.errors.length === 0, JSON.stringify(s).slice(0, 120));
      await page.context().close();
    }
    const page = await open(browser);
    const others = await page.evaluate((k) => {
      localStorage.setItem("some-other-game", "keep");
      window.ClawMaster.persist();
      return localStorage.getItem("some-other-game") === "keep" && !!localStorage.getItem(k);
    }, KEY);
    check("다른 게임 저장은 건드리지 않음 (독립 키)", others);
    await page.context().close();
  }

  /* ---------- 모드: 오늘의 도전 · 타임어택 · 희귀 인형 ---------- */
  if (want("modes")) {
    const page = await open(browser, { save: JSON.stringify({ coins: 50, tutorial: true, lastDay: today }) });
    await page.click('[data-go="daily"]');
    const dd = await page.evaluate(() => ({ t: document.getElementById("mode-t").textContent, art: document.querySelectorAll("#mode-art canvas").length }));
    check("오늘의 도전 안내 (목표 + 그림)", dd.t.length > 3 && dd.art >= 1, dd.t);
    await page.click("#mode-go");
    let m = await page.evaluate(() => ({ mode: window.ClawMaster.mode, goal: document.getElementById("hud-goal").textContent, n: window.ClawMaster.sim.dolls.length }));
    check("오늘의 도전 시작 · 목표 표시", m.mode === "daily" && /남은/.test(m.goal) && m.n >= 12, m.goal);
    const same = await page.evaluate(() => {
      const a = window.ClawMaster.sim.dolls.map((d) => d.kind).join();
      window.ClawMaster.toTitle();
      window.ClawMaster.pendingMode = "daily";
      window.ClawMaster.startMode();
      return a === window.ClawMaster.sim.dolls.map((d) => d.kind).join();
    });
    check("오늘의 인형 배치는 하루 동안 같음", same);
    let c0 = await page.evaluate(() => window.ClawMaster.save.coins);
    await page.keyboard.press("Space");
    let c1 = await page.evaluate(() => window.ClawMaster.save.coins);
    check("오늘의 도전 다시 하기는 코인을 냄 (무한 코인 방지)", c1 === c0 - 2, `${c0}→${c1}`);
    // 성공 판정: 목표 인형을 하나만 둔 기계에서 뽑기
    const def = await page.evaluate(() => window.ClawMaster.goal.def);
    const kind = def.who || (def.k === "rarity" ? "tiger" : def.k === "rarity2" ? "panda" : "bear");
    await page.evaluate(() => window.ClawMaster.sim.drop());
    await waitReady(page);
    await page.evaluate((d) => {
      // 목표를 한 번에 끝낼 수 있게 남은 조건을 채워 둔다 (판정만 점검)
      const G = window.ClawMaster.goal;
      if (d.k === "count" || d.k === "rarity2") G.prog = d.n - 1;
      if (d.k === "streak") G.streak = d.n - 1;
      if (d.k === "kinds") for (const k of ["fox", "koala", "cat"].slice(0, d.n - 1)) G.kinds.add(k);
    }, def);
    await solo(page, kind);
    await page.keyboard.press("Space");
    await aimAt(page, kind);
    await page.keyboard.press("Space");
    await page.waitForFunction(() => window.ClawMaster.revealing(), null, { timeout: 30000 }).catch(() => {});
    await sleep(500);
    await page.keyboard.press("Space");
    await page.waitForFunction(() => window.ClawMaster.screen === "result", null, { timeout: 30000 }).catch(() => {});
    m = await page.evaluate(() => ({ s: window.ClawMaster.screen, t: document.getElementById("res-t").textContent, done: window.ClawMaster.save.daily.done }));
    check(`오늘의 도전 성공 → 결과 · 보상 (${def.ko})`, m.s === "result" && m.t === "도전 성공!" && m.done, JSON.stringify(m));

    // 타임어택
    await page.click("#result [data-back]");
    await page.click('[data-go="ta"]');
    await page.click("#mode-go");
    c0 = await page.evaluate(() => window.ClawMaster.save.coins);
    await page.keyboard.press("Space");
    c1 = await page.evaluate(() => window.ClawMaster.save.coins);
    await sleep(1200);
    const left = await page.evaluate(() => window.ClawMaster.ta.left);
    check("타임어택: 코인 없이 시작 · 시간이 줄어듦", c1 === c0 && left < 89.5, `남은 ${left.toFixed(1)}초`);
    await page.evaluate(() => (window.ClawMaster.ta.left = 0.2));
    await page.waitForFunction(() => window.ClawMaster.screen === "result", null, { timeout: 40000 }).catch(() => {});
    m = await page.evaluate(() => ({ s: window.ClawMaster.screen, k: document.getElementById("res-k").textContent }));
    check("타임어택: 시간이 끝나면 (하던 판을 마치고) 결과", m.s === "result" && m.k === "타임어택", JSON.stringify(m));

    // 희귀 인형 도전
    await page.click("#result [data-back]");
    await page.click('[data-go="rare"]');
    const tgt = await page.evaluate(() => window.ClawMaster.rareTarget);
    c0 = await page.evaluate(() => window.ClawMaster.save.coins);
    await page.click("#mode-go");
    m = await page.evaluate((t) => ({ c: window.ClawMaster.save.coins, has: window.ClawMaster.sim.dolls.some((d) => d.kind === t), r: window.__data.dollById(t).rarity }), tgt);
    check("희귀 도전: 입장 코인 6 · 목표 인형이 기계 안에", m.c === c0 - 6 && m.has && m.r >= 1, `${tgt} ${JSON.stringify(m)}`);
    await page.keyboard.press("Space");
    for (let i = 0; i < 5; i += 1) {
      await page.evaluate(() => window.ClawMaster.sim.phase === "moving" && window.ClawMaster.sim.drop());
      await page.waitForFunction(() => window.ClawMaster.sim.phase === "idle" || window.ClawMaster.screen === "result", null, { timeout: 30000 });
      await page.evaluate(() => window.ClawMaster.revealing() && window.ClawMaster.nextReveal());
      if (await page.evaluate(() => window.ClawMaster.screen === "result")) break;
      await page.keyboard.press("Space");
    }
    await page.waitForFunction(() => window.ClawMaster.screen === "result", null, { timeout: 30000 }).catch(() => {});
    m = await page.evaluate(() => ({ s: window.ClawMaster.screen, used: window.ClawMaster.goal && window.ClawMaster.goal.used }));
    check("희귀 도전: 5번 쓰면 끝 (결과 화면)", m.s === "result", JSON.stringify(m));
    check("모드 오류 없음", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  /* ---------- 휴대폰: 진짜 터치 · 배치 ---------- */
  if (want("mobile")) {
    for (const [width, height, label] of [[390, 844, "세로"], [360, 640, "작은 세로"], [844, 390, "가로"], [768, 1024, "태블릿"]]) {
      const page = await open(browser, { width, height, mobile: true, save: JSON.stringify({ coins: 40, tutorial: true, lastDay: today }) });
      const cdp = await page.context().newCDPSession(page);
      const center = (sel) =>
        page.evaluate((s) => {
          const r = document.querySelector(s).getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, sel);
      const tp = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((p, id) => ({ x: p.x, y: p.y, id })) });
      const tap = async (sel) => {
        const p = await center(sel);
        await tp("touchStart", [p]);
        await sleep(60);
        await tp("touchEnd", []);
        await sleep(120);
      };
      await tap("#play-btn");
      await tap("#act");
      const ph = await page.evaluate(() => ({ ph: window.ClawMaster.sim.phase, c: window.ClawMaster.save.coins }));
      check(`[${label}] 큰 버튼 터치로 동전 넣기`, ph.ph === "moving" && ph.c === 38, JSON.stringify(ph));
      const x0 = await page.evaluate(() => window.ClawMaster.sim.cx);
      await tp("touchStart", [await center(".pb.right")]);
      await sleep(500);
      await tp("touchEnd", []);
      await sleep(200);
      const x1 = await page.evaluate(() => ({ x: window.ClawMaster.sim.cx, pad: window.ClawMaster.pad.r }));
      check(`[${label}] 오른쪽 버튼 누르는 동안 이동 · 떼면 멈춤`, x1.x > x0 + 6 && x1.pad === 0, `${x0.toFixed(1)}→${x1.x.toFixed(1)}`);
      const z0 = await page.evaluate(() => window.ClawMaster.sim.cz);
      await tp("touchStart", [await center(".pb.up")]);
      await sleep(400);
      await tp("touchEnd", []);
      const z1 = await page.evaluate(() => window.ClawMaster.sim.cz);
      check(`[${label}] 안쪽 버튼`, z1 > z0 + 4, `${z0.toFixed(1)}→${z1.toFixed(1)}`);
      // 두 손가락: 오른쪽 + 안쪽 동시에
      const b0 = await page.evaluate(() => ({ x: window.ClawMaster.sim.cx, z: window.ClawMaster.sim.cz }));
      await tp("touchStart", [await center(".pb.left")]);
      await tp("touchStart", [await center(".pb.left"), await center(".pb.down")]);
      await sleep(400);
      await tp("touchEnd", []);
      await sleep(150);
      const b1 = await page.evaluate(() => ({ x: window.ClawMaster.sim.cx, z: window.ClawMaster.sim.cz, l: window.ClawMaster.pad.l, d: window.ClawMaster.pad.d }));
      check(`[${label}] 두 손가락 (왼쪽 + 앞쪽 동시에) · 남는 입력 없음`, b1.x < b0.x - 3 && b1.z < b0.z - 3 && !b1.l && !b1.d, `${JSON.stringify(b0)} → ${JSON.stringify(b1)}`);
      await tap("#act");
      check(`[${label}] 내리기 버튼`, await page.evaluate(() => window.ClawMaster.sim.phase !== "moving"));
      const lay = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const R = (s) => q(s).getBoundingClientRect();
        const hit = (a, b) => !(a.right <= b.left + 1 || a.left >= b.right - 1 || a.bottom <= b.top + 1 || a.top >= b.bottom - 1);
        const v = window.ClawMaster.view;
        const win = { left: v.win.x, top: v.win.y, right: v.win.x + v.win.w, bottom: v.win.y + v.win.h };
        const parts = { hud: R("#hud"), goal: R("#hud-goal"), turn: R("#turn"), pad: R("#pad"), act: R("#act"), pause: R("#today-pause-btn"), mute: q(".today-mute-btn") ? R(".today-mute-btn") : null };
        const names = Object.keys(parts).filter((k) => parts[k]);
        const over = [];
        for (let i = 0; i < names.length; i += 1) for (let j = i + 1; j < names.length; j += 1) if (hit(parts[names[i]], parts[names[j]])) over.push(`${names[i]}-${names[j]}`);
        // 조작 버튼 · 정보가 기계 유리창(인형 보이는 곳)을 가리지 않음
        for (const k of ["hud", "goal", "pad", "act"]) if (hit(parts[k], win)) over.push(`${k}-유리창`);
        const fit = names.every((k) => parts[k].left >= -1 && parts[k].top >= -1 && parts[k].right <= innerWidth + 1 && parts[k].bottom <= innerHeight + 1);
        return { over, fit, sw: document.documentElement.scrollWidth <= innerWidth, winH: Math.round(win.bottom - win.top) };
      });
      check(`[${label}] 버튼 · 정보 겹침 없음 · 유리창 안 가림 · 화면 안`, !lay.over.length && lay.fit && lay.sw, JSON.stringify(lay));
      check(`[${label}] 오류 없음`, page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
      await page.context().close();
    }
  }

  /* ---------- 연속 플레이 성능 ---------- */
  if (want("perf")) {
    const page = await open(browser, { save: JSON.stringify({ coins: 500, tutorial: true, lastDay: today }) });
    await page.click("#play-btn");
    await page.evaluate(() => {
      const A = window.ClawMaster;
      window.__ft = [];
      const U = A.update.bind(A);
      const Rn = A.render.bind(A);
      A.update = (dt) => {
        const t = performance.now();
        U(dt);
        window.__ut = performance.now() - t;
      };
      A.render = (dt) => {
        const t = performance.now();
        Rn(dt);
        window.__ft.push(window.__ut + performance.now() - t);
      };
    });
    let wins = 0;
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press("Space");
      await page.evaluate(() => {
        const s = window.ClawMaster.sim;
        const top = s.dolls.filter((d) => d.x > -15).sort((a, b) => b.y - a.y)[0];
        s.cx = s.hx = top.x;
        s.cz = s.hz = top.z;
      });
      await page.keyboard.press("Space");
      await page.waitForFunction(() => window.ClawMaster.sim.phase === "idle" || window.ClawMaster.revealing(), null, { timeout: 30000 });
      if (await page.evaluate(() => window.ClawMaster.revealing())) {
        wins += 1;
        await sleep(500);
        await page.keyboard.press("Space");
        await waitReady(page);
      }
    }
    const r = await page.evaluate(() => {
      const f = window.__ft.slice().sort((a, b) => a - b);
      const s = window.ClawMaster.sim;
      return { avg: f.reduce((a, b) => a + b, 0) / f.length, p95: f[Math.floor(f.length * 0.95)], n: s.dolls.length, out: s.dolls.filter((d) => Math.abs(d.x) > 51 || d.z < -1 || d.z > 61 || d.y < -2).length };
    });
    check("연속 10판: 한 프레임 계산 평균 4ms 이하", r.avg < 4, `평균 ${r.avg.toFixed(2)}ms · p95 ${r.p95.toFixed(2)}ms · 성공 ${wins}/10`);
    check("연속 10판: 인형이 줄면 새로 채워짐 · 밖으로 샌 인형 없음", r.n >= 10 && r.out === 0, JSON.stringify(r));
    check("성능 오류 없음", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  /* ---------- 사이트 연결: 홈 카드 · 공유 그림 · 사이트맵 · 소개 글 ---------- */
  if (want("site")) {
    const page = await open(browser);
    const meta = await page.evaluate(async () => {
      const og = document.querySelector('meta[property="og:image"]').content;
      const r = await fetch(new URL(og).pathname);
      const b = await createImageBitmap(await r.blob());
      const sm = await fetch("/sitemap.xml").then((x) => x.text());
      return { ok: r.ok, w: b.width, h: b.height, seo: !!document.querySelector("#title .seo-about h2"), map: sm.includes("/games/claw-master/") };
    });
    check("공유 그림 (og:image) 1200×675", meta.ok && meta.w === 1200 && meta.h === 675, JSON.stringify(meta));
    check("사이트맵 · 첫 화면 소개 글", meta.map && meta.seo);
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await sleep(1200);
    const card = await page.evaluate(async () => {
      const a = document.querySelector('#cat-arcade a[href="/games/claw-master/"]');
      if (!a) return null;
      a.scrollIntoView();
      const img = a.querySelector("img");
      img.loading = "eager";
      await img.decode().catch(() => {});
      return { natural: img.naturalWidth, text: a.textContent.replace(/\s+/g, " ").trim() };
    });
    check("홈 아케이드 칸에 카드 + 썸네일 512", !!card && card.natural === 512 && card.text.includes("인형뽑기 마스터"), JSON.stringify(card));
    check("홈 오류 없음", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  await browser.close();
  console.log(`\n통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("실패:", e);
  process.exit(2);
});
