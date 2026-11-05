/*
 * 통통 동물 씨름왕 점검. 서버를 띄운 뒤: node scripts/test-bubble-sumo.js
 * 키보드 · 터치는 진짜 입력(Playwright / CDP 터치)으로 넣는다. /api 는 가짜로 응답해 통계를 건드리지 않는다.
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3456";
const URL = `${BASE}/games/bubble-sumo-kings/`;
const KEY = "bubble-sumo-kings-v1";
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let fail = 0;
const results = [];
function check(name, ok, detail = "") {
  if (ok) pass += 1;
  else fail += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  console.log(results[results.length - 1]);
}
const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);

async function open(browser, { width = 1280, height = 720, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) page.errors.push(m.text());
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.addInitScript((d) => {
    localStorage.setItem(`today-game-visit-${d}`, "1");
    localStorage.setItem("today_visit_counted", "1");
  }, today);
  await page.goto(URL);
  await page.waitForFunction(() => window.BubbleSumo, null, { timeout: 30000 });
  await hookEvents(page);
  return page;
}
/** 경기 사건을 모아 둔다 */
async function hookEvents(page) {
  await page.evaluate(() => {
    const A = window.BubbleSumo;
    window.__ev = [];
    const H = A.handleEvents.bind(A);
    A.handleEvents = () => {
      for (const e of A.bout.events) window.__ev.push({ ...e });
      H();
    };
  });
}
const ev = (page, f) => page.evaluate((src) => window.__ev.filter(new Function("e", `return ${src}`)).length, f);
const clearEv = (page) => page.evaluate(() => (window.__ev.length = 0));
const waitFight = (page) => page.waitForFunction(() => window.BubbleSumo.bout.phase === "fight", null, { timeout: 8000 });
/** 상대 없이 1-1 시작 */
async function duel(page, id = "1-1", ai = false) {
  await page.evaluate(
    ([sid, keepAi]) => {
      const A = window.BubbleSumo;
      A.save.tutorial = true;
      A.startDuel(window.__camp.find((s) => s.id === sid));
      if (!keepAi) A.ais = [];
    },
    [id, ai]
  );
  await waitFight(page);
}
async function loadCamp(page) {
  await page.evaluate(async () => {
    const d = await import("/games/bubble-sumo-kings/js/data.js?v=1");
    window.__camp = d.CAMPAIGN;
    window.__data = d;
  });
}
const want = (name) => !ONLY.length || ONLY.includes(name);

(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--js-flags=--expose-gc"] });

  /* ---------- 물리 (화면 없이) ---------- */
  if (want("physics")) {
    const page = await open(browser);
    const out = await page.evaluate(async () => {
      const { FIGHTERS } = await import("/games/bubble-sumo-kings/js/data.js?v=1");
      const { Bout, STEP } = await import("/games/bubble-sumo-kings/js/sim.js?v=1");
      const { BoutAI } = await import("/games/bubble-sumo-kings/js/ai.js?v=1");
      const W = { fr: 1, bounce: 0.62 };
      const fight = (a, b) => {
        const B = new Bout({ a, b, world: W, need: 1, time: 0 });
        B.phase = "fight";
        return B;
      };
      let centerOut = 0;
      let pushOut = 0;
      let bigKnock = 0;
      for (const a of FIGHTERS) {
        for (const b of FIGHTERS) {
          // 가운데에서 힘을 가득 모은 돌진 한 방: 절대 못 떨어뜨린다
          let B = fight(a, b);
          B.f[0].x = -125;
          B.f[1].x = 0;
          B.input[0].dash = true;
          for (let i = 0; i < 100; i += 1) B.step(STEP);
          B.input[0].dash = false;
          let maxD = 0;
          for (let i = 0; i < 300; i += 1) {
            B.step(STEP);
            maxD = Math.max(maxD, Math.abs(B.f[1].x));
          }
          if (B.phase !== "fight") centerOut += 1;
          if (maxD > 100) bigKnock += 1;
          // 끝 근처에서 약한 밀기 한 번: 떨어지지 않는다
          B = fight(a, b);
          B.f[0].x = 240;
          B.f[1].x = 360;
          B.f[0].face = 1;
          B.f[1].face = -1;
          B.input[0].push = 0.14;
          for (let i = 0; i < 240; i += 1) B.step(STEP);
          if (B.phase !== "fight") pushOut += 1;
        }
      }
      // 난이도: 초급은 고급에게, 고급은 중급에게 대체로 진다
      const match = (la, lb) => {
        const B = new Bout({ a: FIGHTERS[0], b: FIGHTERS[0], world: W, need: 2 });
        const A0 = new BoutAI(B, 0, { level: la, style: "smart" });
        const A1 = new BoutAI(B, 1, { level: lb, style: "smart" });
        while (B.phase !== "over" && B.total < 300) {
          A0.update(STEP);
          A1.update(STEP);
          B.step(STEP);
          B.events.length = 0;
        }
        return B;
      };
      let hard = 0;
      let len = 0;
      const N = 12;
      for (let i = 0; i < N; i += 1) {
        const r = match(0, 2);
        if (r.winner === 1) hard += 1;
      }
      for (let i = 0; i < N; i += 1) len += match(1, 1).total;
      return { centerOut, pushOut, bigKnock, hard, N, len: len / N };
    });
    check("한 방에 안 떨어짐: 가운데서 최대 돌진 (8x8)", out.centerOut === 0, `떨어진 횟수 ${out.centerOut}`);
    check("작은 밀기 한 번으로 안 떨어짐: 끝 근처 (8x8)", out.pushOut === 0, `떨어진 횟수 ${out.pushOut}`);
    check("최대 돌진은 크게 밀림 (8x8 거의 전부)", out.bigKnock >= 60, `${out.bigKnock}/64`);
    check("고급이 초급을 이김", out.hard >= out.N - 1, `${out.hard}/${out.N}`);
    check("경기 길이 30~60초 범위 (소개 포함 평균)", out.len >= 25 && out.len <= 65, `${out.len.toFixed(1)}초`);
    await page.context().close();
  }

  /* ---------- 요구한 10가지 장면 ---------- */
  if (want("qa")) {
    const page = await open(browser);
    await loadCamp(page);

    // 1 플레이어가 상대를 밀어낸다 (진짜 키)
    await duel(page, "1-1");
    await page.keyboard.down("KeyD");
    let t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      await page.keyboard.press("Space");
      await sleep(180);
      const w = await page.evaluate(() => window.BubbleSumo.bout.wins[0]);
      if (w >= 1) break;
    }
    await page.keyboard.up("KeyD");
    const q1 = await page.evaluate(() => ({ w: window.BubbleSumo.bout.wins, ko: window.BubbleSumo.bout.lastKo, hits: window.BubbleSumo.m.hits }));
    check("QA1 플레이어가 키보드로 상대를 밀어냄", q1.w[0] === 1 && q1.hits > 0, `타격 ${q1.hits}회 · 마지막 ${q1.ko && q1.ko.by}`);
    await page.waitForFunction(() => window.BubbleSumo.screen === "result", null, { timeout: 8000 });
    const coin1 = await page.evaluate(() => window.BubbleSumo.save.coins);
    check("이기면 결과 화면 + 코인", coin1 > 0, `코인 ${coin1}`);

    // 2 상대가 플레이어를 밀어낸다 (진짜 AI)
    await duel(page, "1-2", true);
    await page.waitForFunction(() => window.BubbleSumo.bout.wins[1] >= 1, null, { timeout: 45000 });
    const q2 = await page.evaluate(() => ({ w: window.BubbleSumo.bout.wins, ko: window.BubbleSumo.bout.lastKo }));
    check("QA2 가만히 있으면 AI가 나를 밀어냄", q2.w[1] >= 1, `시간 ${q2.ko.time.toFixed(1)}초 · 마지막 ${q2.ko.by}`);

    // 3 양쪽이 끝에서 버틴다
    await duel(page, "1-3");
    await clearEv(page);
    await page.evaluate(() => {
      const b = window.BubbleSumo.bout;
      b.f[0].x = 372;
      b.f[1].x = 248;
      b.f[0].face = -1;
      b.f[1].face = 1;
    });
    await page.keyboard.down("KeyA");
    const edgeInfo = await page.evaluate(
      () =>
        new Promise((res) => {
          const A = window.BubbleSumo;
          const b = A.bout;
          let teeter = 0;
          let locked = 0;
          const t0 = performance.now();
          const T = () => {
            b.input[1].mx = 1; // 상대가 계속 민다
            if (b.f[0].teeter) teeter += 1;
            if (b.f[0].locked) locked += 1;
            if (performance.now() - t0 > 1000 || b.phase !== "fight") res({ teeter, locked, ph: b.phase, x: b.f[0].x, edge: b.f[0].edge });
            else requestAnimationFrame(T);
          };
          T();
        })
    );
    await page.evaluate(() => {
      const b = window.BubbleSumo.bout;
      b.input[1].mx = 0;
      b.f[1].vx = -300;
    });
    await sleep(900);
    await page.keyboard.up("KeyA");
    const saves = await ev(page, 'e.t==="save"&&e.i===0');
    check("QA3 끝에서 몸을 맞대고 버팀 (1초)", edgeInfo.ph === "fight" && edgeInfo.teeter > 15 && edgeInfo.locked > 15, `기우뚱 ${edgeInfo.teeter}프레임 · 맞댐 ${edgeInfo.locked}프레임 · x ${edgeInfo.x.toFixed(0)}`);
    check("QA3 버티고 돌아오면 '버텼다' 보상", saves >= 1, `${saves}번`);

    // 4 강한 돌진으로 역전
    await duel(page, "1-3");
    await clearEv(page);
    await page.evaluate(() => {
      const b = window.BubbleSumo.bout;
      b.f[0].x = 335;
      b.f[1].x = 190;
      b.f[0].face = -1;
      b.f[1].face = 1;
      b.f[1].bal = 60;
    });
    await page.keyboard.down("ShiftLeft");
    await sleep(750);
    const beforeDash = await page.evaluate(() => {
      const b = window.BubbleSumo.bout;
      return { st: b.f[0].state, c: b.f[0].charge, ox: b.f[1].x };
    });
    await page.keyboard.up("ShiftLeft");
    await sleep(650);
    const afterDash = await page.evaluate(() => {
      const b = window.BubbleSumo.bout;
      return { x: b.f[0].x, ox: b.f[1].x };
    });
    const dashHit = await ev(page, 'e.t==="hit"&&e.att===0&&e.kind==="dash"');
    check("QA4 돌진 힘 모으기", beforeDash.st === "charge" && beforeDash.c > 0.5, `힘 ${beforeDash.c.toFixed(2)}`);
    check("QA4 끝에서 돌진으로 상대를 멀리 날리고 안쪽으로 나옴", dashHit >= 1 && beforeDash.ox - afterDash.ox > 120 && afterDash.x < 325, `상대 ${beforeDash.ox.toFixed(0)}→${afterDash.ox.toFixed(0)} · 나 x ${afterDash.x.toFixed(0)}`);

    // 5 버티기로 튕겨 내고 반격
    await duel(page, "1-3");
    let parry = 0;
    for (let i = 0; i < 4 && !parry; i += 1) {
      await clearEv(page);
      await page.evaluate(() => {
        const b = window.BubbleSumo.bout;
        b.f[0].x = -60;
        b.f[1].x = 62;
        b.f[0].face = 1;
        b.f[1].face = -1;
        b.f[0].vx = b.f[1].vx = 0;
      });
      await page.keyboard.down("KeyS");
      await page.evaluate(() => {
        window.BubbleSumo.bout.input[1].push = 0.14;
      });
      await sleep(260);
      await page.keyboard.up("KeyS");
      parry = await ev(page, 'e.t==="parry"&&e.i===0');
      if (!parry) await sleep(500);
    }
    const oppState = await page.evaluate(() => window.BubbleSumo.bout.f[1].state);
    check("QA5 맞는 순간 버티기로 튕겨 냄", parry >= 1, `상대 상태 ${oppState}`);
    await clearEv(page);
    await page.keyboard.down("KeyD");
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Space");
      await sleep(190);
    }
    await page.keyboard.up("KeyD");
    const counter = await ev(page, 'e.t==="hit"&&e.att===0');
    check("QA5 튕겨 낸 뒤 반격이 들어감", counter >= 1, `${counter}타`);

    // 6 AI 가 내 공격을 피한다
    await duel(page, "1-3", true);
    await page.evaluate(() => {
      const A = window.BubbleSumo;
      return import("/games/bubble-sumo-kings/js/ai.js?v=1").then(({ BoutAI }) => {
        A.ais = [new BoutAI(A.bout, 1, { level: 2, style: "swift" })];
      });
    });
    await clearEv(page);
    for (let i = 0; i < 12; i += 1) {
      await page.evaluate(() => {
        const b = window.BubbleSumo.bout;
        if (b.phase !== "fight") return;
        b.f[0].x = -150;
        b.f[1].x = 90;
        b.f[0].bal = b.f[1].bal = 100;
        b.time = 0;
      });
      await page.keyboard.down("ShiftLeft");
      await sleep(420);
      await page.keyboard.up("ShiftLeft");
      await sleep(620);
      if ((await ev(page, 'e.t==="dodge"&&e.i===1')) >= 2) break;
    }
    const dodged = await ev(page, 'e.t==="dodge"&&e.i===1');
    const whiffs = await ev(page, 'e.t==="whiff"&&e.i===0');
    check("QA6 고급 민첩 AI가 내 돌진을 피함", dodged >= 1, `피하기 ${dodged}번 · 내 돌진 빗나감 ${whiffs}번`);

    // 7 특수 기술로 승리
    await page.evaluate(() => {
      const S = window.BubbleSumo.save;
      S.stats.specialWins = 0;
      S.ach = S.ach.filter((a) => a !== "specialko");
    });
    await duel(page, "1-1");
    await clearEv(page);
    await page.evaluate(() => {
      const b = window.BubbleSumo.bout;
      b.f[0].x = 170;
      b.f[1].x = 385;
      b.f[0].face = 1;
      b.f[1].bal = 25;
      b.f[0].spec = 100;
    });
    await page.keyboard.press("KeyE");
    await page.waitForFunction(() => window.BubbleSumo.screen === "result", null, { timeout: 8000 });
    const q7 = await page.evaluate(() => ({ by: window.BubbleSumo.bout.lastKo.by, sw: window.BubbleSumo.save.stats.specialWins, ach: window.BubbleSumo.save.ach.includes("specialko") }));
    check("QA7 기술로 승리 + 기록 · 업적", q7.by === "special" && q7.sw === 1 && q7.ach, `마지막 공격 ${q7.by}`);

    // 9 새로고침해도 기록 유지
    const before = await page.evaluate(() => {
      const A = window.BubbleSumo;
      A.persist();
      return JSON.stringify({ c: A.save.coins, camp: A.save.camp, st: A.save.stats.wins, ach: A.save.ach, t: A.save.tutorial });
    });
    await page.reload();
    await page.waitForFunction(() => window.BubbleSumo);
    const after = await page.evaluate(() => {
      const A = window.BubbleSumo;
      return JSON.stringify({ c: A.save.coins, camp: A.save.camp, st: A.save.stats.wins, ach: A.save.ach, t: A.save.tutorial });
    });
    check("QA9 새로고침해도 코인 · 진행 · 업적 유지", before === after, after.slice(0, 90));
    check("QA 오류 없음", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  /* ---------- 휴대폰 조작 (진짜 터치) ---------- */
  if (want("mobile")) {
    for (const [width, height, label] of [[390, 844, "세로"], [844, 390, "가로"]]) {
      const page = await open(browser, { width, height, mobile: true });
      await loadCamp(page);
      const cdp = await page.context().newCDPSession(page);
      const center = (id) =>
        page.evaluate((i) => {
          const r = document.getElementById(i).getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, id);
      const tp = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((p, id) => ({ x: p.x, y: p.y, id })) });
      const reset = async () => {
        await page.evaluate(() => {
          const b = window.BubbleSumo.bout;
          b.f[0].x = -120;
          b.f[1].x = 200;
          b.f[0].vx = b.f[1].vx = 0;
          b.f[0].bal = b.f[1].bal = 100;
          b.time = 0;
          b.f[0].state = "idle";
          b.f[0].stun = 0;
          b.f[0].pushCd = b.f[0].dashCd = b.f[0].dodgeCd = 0;
        });
        await clearEv(page);
      };
      await duel(page, "1-2");
      const visible = await page.evaluate(() => {
        const r = document.getElementById("touch");
        return !r.classList.contains("hidden");
      });
      check(`[${label}] 터치 조작이 보임`, visible);
      await reset();
      const x0 = await page.evaluate(() => window.BubbleSumo.bout.f[0].x);
      const padR = await center("pad-r");
      const padL = await center("pad-l");
      const push = await center("tb-push");
      await tp("touchStart", [padR]);
      await sleep(320);
      await tp("touchEnd", []);
      const x1 = await page.evaluate(() => window.BubbleSumo.bout.f[0].x);
      check(`[${label}] 오른쪽 화살표`, x1 > x0 + 40, `${x0.toFixed(0)}→${x1.toFixed(0)}`);
      await sleep(100);
      await tp("touchStart", [padL]);
      await sleep(320);
      await tp("touchEnd", []);
      const x2 = await page.evaluate(() => window.BubbleSumo.bout.f[0].x);
      check(`[${label}] 왼쪽 화살표`, x2 < x1 - 15, `${x1.toFixed(0)}→${x2.toFixed(0)}`);
      // 손가락을 밀어서 방향 바꾸기
      await reset();
      await tp("touchStart", [padL]);
      await sleep(180);
      await tp("touchMove", [padR]);
      await sleep(180);
      const slide = await page.evaluate(() => window.BubbleSumo.touch.mx);
      await tp("touchEnd", []);
      check(`[${label}] 누른 채 반대쪽으로 밀면 방향 전환`, slide === 1);
      const stuck = await page.evaluate(() => window.BubbleSumo.touch.mx);
      check(`[${label}] 손을 떼면 멈춤 (입력 남지 않음)`, stuck === 0);
      // 두 손가락: 이동하면서 밀기
      await reset();
      await tp("touchStart", [padR]);
      await sleep(120);
      await tp("touchStart", [padR, push]);
      await sleep(60);
      const both = await page.evaluate(() => ({ mx: window.BubbleSumo.touch.mx, st: window.BubbleSumo.bout.f[0].state }));
      await tp("touchEnd", []);
      const bothN = await ev(page, 'e.t==="whoosh"&&e.i===0');
      check(`[${label}] 두 손가락: 이동 + 밀기 동시에`, both.mx === 1 && bothN === 1, `상태 ${both.st} · 방향 ${both.mx} · 밀기 ${bothN}번`);
      // 밀기 한 번 = 한 번만
      await sleep(350);
      await reset();
      await tp("touchStart", [push]);
      await sleep(90);
      await tp("touchEnd", []);
      await sleep(350);
      const pushes = await ev(page, 'e.t==="whoosh"&&e.i===0');
      check(`[${label}] 밀기 한 번은 정확히 한 번`, pushes === 1, `${pushes}번`);
      // 돌진: 꾹 → 떼기
      await reset();
      const dash = await center("tb-dash");
      await tp("touchStart", [dash]);
      await sleep(520);
      const chg = await page.evaluate(() => ({ s: window.BubbleSumo.bout.f[0].state, c: window.BubbleSumo.bout.f[0].charge }));
      await tp("touchEnd", []);
      await sleep(150);
      check(`[${label}] 돌진 꾹 눌러 힘 모으기 → 떼면 돌진`, chg.s === "charge" && (await ev(page, 'e.t==="dash"&&e.i===0')) === 1, `힘 ${chg.c.toFixed(2)}`);
      await sleep(900);
      // 버티기
      await reset();
      const guard = await center("tb-guard");
      await tp("touchStart", [guard]);
      await sleep(200);
      const g = await page.evaluate(() => window.BubbleSumo.bout.f[0].state);
      await tp("touchEnd", []);
      await sleep(200);
      const g2 = await page.evaluate(() => window.BubbleSumo.bout.f[0].state);
      check(`[${label}] 버티기 누르는 동안만`, g === "guard" && g2 !== "guard", `${g}→${g2}`);
      // 피하기
      await reset();
      const dodge = await center("tb-dodge");
      await tp("touchStart", [dodge]);
      await sleep(80);
      await tp("touchEnd", []);
      await sleep(120);
      check(`[${label}] 피하기`, (await ev(page, 'e.t==="dodge"&&e.i===0')) === 1);
      await sleep(700);
      // 기술
      await reset();
      await page.evaluate(() => {
        window.BubbleSumo.bout.f[0].spec = 100;
      });
      await sleep(80);
      const ready = await page.evaluate(() => document.getElementById("tb-spec").classList.contains("ready"));
      const spec = await center("tb-spec");
      await tp("touchStart", [spec]);
      await sleep(80);
      await tp("touchEnd", []);
      await sleep(120);
      check(`[${label}] 기술 버튼 (찼을 때 빛남)`, ready && (await ev(page, 'e.t==="special"&&e.i===0')) === 1);
      // 겹침
      const lay = await page.evaluate(() => {
        const R = (s) => document.querySelector(s).getBoundingClientRect();
        const hit = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
        const hud = R("#hud");
        const pad = R("#pad");
        const tbs = R(".tbs");
        const fit = (r) => r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
        return { over: hit(hud, pad) || hit(hud, tbs) || hit(pad, tbs), fit: fit(hud) && fit(pad) && fit(tbs), sw: document.documentElement.scrollWidth <= innerWidth };
      });
      check(`[${label}] HUD · 버튼 겹침 없음 · 화면 안`, !lay.over && lay.fit && lay.sw, JSON.stringify(lay));
      check(`[${label}] 오류 없음`, page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
      await page.context().close();
    }
  }

  /* ---------- 저장 ---------- */
  if (want("save")) {
    const page = await open(browser);
    for (const [name, raw] of [
      ["문법이 깨진 값", "{bad json"],
      ["엉뚱한 타입", JSON.stringify({ coins: "많이", owned: "다", sel: "dragon", stats: 5, camp: [1, "9-9", "1-1"], best: null, sound: 3, daily: [], equip: 1 })],
      ["음수 · 무한", '{"coins":-500,"owned":["bear","nope"],"stats":{"wins":-3,"plays":1e999},"sound":{"vol":77}}'],
    ]) {
      await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, raw]);
      await page.reload();
      await page.waitForFunction(() => window.BubbleSumo);
      await sleep(200);
      const s = await page.evaluate(() => {
        const S = window.BubbleSumo.save;
        return { coins: S.coins, owned: S.owned, sel: S.sel, wins: S.stats.wins, plays: S.stats.plays, vol: S.sound.vol, title: window.BubbleSumo.screen };
      });
      const ok = Number.isFinite(s.coins) && s.coins >= 0 && s.owned.includes("bear") && !s.owned.includes("nope") && s.sel === "bear" && s.wins >= 0 && Number.isFinite(s.plays) && s.vol <= 1 && s.title === "title";
      check(`망가진 저장 (${name}) → 안전하게 시작`, ok, JSON.stringify(s).slice(0, 110));
    }
    const others = await page.evaluate(async (k) => {
      localStorage.setItem("some-other-game", "keep");
      window.BubbleSumo.persist();
      return localStorage.getItem("some-other-game") === "keep" && !!localStorage.getItem(k);
    }, KEY);
    check("다른 게임 저장은 건드리지 않음", others);
    await page.context().close();
  }

  /* ---------- 모드 · 메뉴 ---------- */
  if (want("modes")) {
    const page = await open(browser);
    await loadCamp(page);
    await page.evaluate(() => window.BubbleSumo.toTitle());

    // 첫 화면 버튼을 진짜로 누른다
    for (const [sel, screen] of [
      ['[data-go="camp"]', "camp"],
      ['[data-go="practice"]', "practice"],
      ['[data-go="select"]', "select"],
      ['[data-go="book"]', "book"],
      ['[data-go="settings"]', "settings"],
    ]) {
      await page.click(sel);
      const s = await page.evaluate(() => window.BubbleSumo.screen);
      check(`메뉴: ${screen} 열림`, s === screen, s);
      await page.click(`#${screen} [data-back]`);
      const t = await page.evaluate(() => window.BubbleSumo.screen);
      check(`메뉴: ${screen} 뒤로`, t === "title", t);
    }
    // 챔피언십 구성
    const camp = await page.evaluate(() => {
      const { CAMPAIGN, WORLDS, FIGHTERS } = window.__data;
      const perWorld = WORLDS.map((_, w) => CAMPAIGN.filter((s) => s.world === w));
      return {
        n: CAMPAIGN.length,
        w: WORLDS.length,
        min: Math.min(...perWorld.map((l) => l.length)),
        styles: Math.min(...perWorld.map((l) => new Set(l.map((s) => s.style)).size)),
        champs: perWorld.every((l) => l[l.length - 1].champ),
        boss: CAMPAIGN[CAMPAIGN.length - 1].boss === true,
        chars: FIGHTERS.length,
        sum: [...new Set(FIGHTERS.map((f) => f.power + f.defense + f.speed + f.balance + f.special))],
      };
    });
    check("챔피언십 5월드 25경기 · 월드 챔피언 · 최종 보스", camp.n === 25 && camp.w === 5 && camp.min === 5 && camp.champs && camp.boss, JSON.stringify(camp));
    check("월드마다 상대 전술이 3가지 이상", camp.styles >= 3, `최소 ${camp.styles}가지`);
    check("캐릭터 8종 · 능력치 합이 같음", camp.chars === 8 && camp.sum.length === 1, `합 ${camp.sum}`);
    // 잠금
    await page.click('[data-go="camp"]');
    const locked = await page.evaluate(() => {
      const list = [...document.querySelectorAll(".stage-card")];
      return { first: !list[0].disabled, second: list[1].disabled };
    });
    check("챔피언십 잠금: 처음엔 첫 경기만", locked.first && locked.second);
    await page.click('[data-s="1-1"]');
    const camMode = await page.evaluate(() => ({ s: window.BubbleSumo.screen, m: window.BubbleSumo.m.mode, st: window.BubbleSumo.m.stage.id }));
    check("경기 카드를 누르면 그 경기 시작", camMode.s === "fight" && camMode.st === "1-1", JSON.stringify(camMode));
    await page.evaluate(() => {
      window.BubbleSumo.ais = [];
    });
    await waitFight(page);
    await page.evaluate(() => {
      window.BubbleSumo.bout.f[1].x = 480;
    });
    await page.waitForFunction(() => window.BubbleSumo.screen === "result", null, { timeout: 8000 });
    const clear = await page.evaluate(() => window.BubbleSumo.save.camp.includes("1-1"));
    check("이기면 다음 경기 열림", clear);
    await page.click("#res-next");
    const nx = await page.evaluate(() => window.BubbleSumo.m.stage.id);
    check("'다음 경기' 버튼", nx === "1-2", nx);
    // 해금: 1-3 을 깨면 토끼 합류
    await page.evaluate(() => {
      const A = window.BubbleSumo;
      A.save.camp = ["1-1", "1-2"];
      A.startDuel(window.__camp[2]);
      A.ais = [];
      A.bout.need = 1;
    });
    await waitFight(page);
    await page.evaluate(() => {
      window.BubbleSumo.bout.f[1].x = 480;
    });
    await page.waitForFunction(() => window.BubbleSumo.screen === "result", null, { timeout: 8000 });
    const news = await page.evaluate(() => ({ own: window.BubbleSumo.save.owned, t: document.getElementById("res-news").textContent }));
    check("챔피언십으로 캐릭터 해금 (토끼)", news.own.includes("bunny") && news.t.includes("합류"), news.t.slice(0, 50));
    // 코인으로 구입 · 선택 · 꾸미기
    await page.evaluate(() => {
      const A = window.BubbleSumo;
      A.save.coins = 3000;
      A.toTitle();
    });
    await page.click('[data-go="select"]');
    await page.click('[data-id="panda"]');
    const gate = await page.evaluate(() => document.getElementById("sel-go").textContent);
    await page.click("#sel-go");
    const buy = await page.evaluate(() => ({ own: window.BubbleSumo.save.owned.includes("panda"), sel: window.BubbleSumo.save.sel, c: window.BubbleSumo.save.coins }));
    check("코인으로 판다 데려오기 + 자동 선택", buy.own && buy.sel === "panda" && buy.c === 2400, `${gate} → 코인 ${buy.c}`);
    await page.click('[data-c="crown"]');
    const eq = await page.evaluate(() => ({ e: window.BubbleSumo.save.equip.head, c: window.BubbleSumo.save.coins }));
    check("꾸미기 구입 · 착용", eq.e === "crown" && eq.c === 1600, JSON.stringify(eq));
    const power = await page.evaluate(() => {
      const A = window.BubbleSumo;
      A.startDuel(window.__camp[0]);
      const k1 = [A.bout.f[0].pushK, A.bout.f[0].grip, A.bout.f[0].mass];
      const cos = A.pp[0].cos.head;
      A.save.equip = {};
      A.startDuel(window.__camp[0]);
      const k2 = [A.bout.f[0].pushK, A.bout.f[0].grip, A.bout.f[0].mass];
      A.toTitle();
      return { same: JSON.stringify(k1) === JSON.stringify(k2), cos };
    });
    check("꾸미기는 모습만 바꿈 (능력치 그대로)", power.same && power.cos === "crown");
    await page.evaluate(() => {
      const A = window.BubbleSumo;
      A.save.sel = "bear";
      A.toTitle();
    });

    // 서바이벌
    await page.click('[data-go="survival"]');
    await waitFight(page);
    const foes = [];
    for (let i = 0; i < 4; i += 1) {
      const lv = await page.evaluate(() => {
        const A = window.BubbleSumo;
        const l = A.ais[0].level;
        A.ais = [];
        A.bout.f[1].x = 480;
        return { l, s: A.m.streak };
      });
      foes.push(lv.l);
      await page.waitForFunction((n) => window.BubbleSumo.m.streak === n, lv.s + 1, { timeout: 6000 });
      await waitFight(page);
    }
    const sv = await page.evaluate(() => ({ st: window.BubbleSumo.m.streak, lvl: window.BubbleSumo.ais[0].level, score: window.BubbleSumo.m.score, ph: window.BubbleSumo.bout.phase }));
    check("서바이벌: 연승이 쌓이고 상대가 강해짐", sv.st === 4 && sv.lvl >= 1 && sv.score > 0, `연승 ${sv.st} · 난이도 ${foes.join(",")}→${sv.lvl}`);
    await page.evaluate(() => {
      window.BubbleSumo.ais = [];
      window.BubbleSumo.bout.f[0].x = -480;
    });
    await page.waitForFunction(() => window.BubbleSumo.screen === "result", null, { timeout: 8000 });
    const sv2 = await page.evaluate(() => ({ best: window.BubbleSumo.save.best.survival, title: document.getElementById("res-title").textContent, rank: !document.getElementById("res-rank").classList.contains("hidden") }));
    check("서바이벌: 지면 끝 + 최고 기록 저장 + 랭킹", sv2.best === 4 && sv2.title === "4연승" && sv2.rank, JSON.stringify(sv2));
    await page.click("#res-next");
    await sleep(200);
    check("서바이벌: 다시 도전", (await page.evaluate(() => window.BubbleSumo.m.streak)) === 0);
    await page.evaluate(() => window.BubbleSumo.toTitle());

    // 타임어택
    await page.click('[data-go="ta"]');
    await waitFight(page);
    const ta0 = await page.evaluate(() => window.BubbleSumo.m.left);
    await page.evaluate(() => {
      window.BubbleSumo.ais = [];
      window.BubbleSumo.bout.f[1].x = 480;
    });
    await page.waitForFunction(() => window.BubbleSumo.m.ko === 1, null, { timeout: 6000 });
    const ta1 = await page.evaluate(() => ({ left: window.BubbleSumo.m.left, score: window.BubbleSumo.m.score }));
    check("타임어택: 밀어내면 점수 + 시간 3초", ta1.left > ta0 && ta1.score >= 500, JSON.stringify(ta1));
    await waitFight(page);
    await page.evaluate(() => {
      window.BubbleSumo.ais = [];
      window.BubbleSumo.bout.f[0].x = -480;
    });
    await page.waitForFunction(() => window.BubbleSumo.m.streak === 0 && window.BubbleSumo.bout.phase !== "fight", null, { timeout: 6000 });
    const ta2 = await page.evaluate(() => window.BubbleSumo.m.left);
    check("타임어택: 내가 떨어지면 6초 줄고 연속 끊김", ta2 < ta1.left - 4, `${ta1.left.toFixed(1)}→${ta2.toFixed(1)}`);
    await waitFight(page);
    await page.evaluate(() => {
      window.BubbleSumo.m.left = 0.2;
    });
    await page.waitForFunction(() => window.BubbleSumo.screen === "result", null, { timeout: 8000 });
    const ta3 = await page.evaluate(() => ({ b: window.BubbleSumo.save.best.ta, k: window.BubbleSumo.save.best.taKo }));
    check("타임어택: 시간이 끝나면 결과 + 최고 점수", ta3.b >= 500 && ta3.k === 1, JSON.stringify(ta3));
    await page.evaluate(() => window.BubbleSumo.toTitle());

    // 연습
    const statsB = await page.evaluate(() => window.BubbleSumo.save.stats.plays);
    await page.click('[data-go="practice"]');
    await page.click('#pr-level [data-v="0"]');
    await page.click("#pr-go");
    await waitFight(page);
    await page.evaluate(() => {
      window.BubbleSumo.bout.f[1].x = 480;
    });
    await sleep(1500);
    await page.waitForFunction(() => window.BubbleSumo.bout.phase === "fight" || window.BubbleSumo.bout.phase === "intro", null, { timeout: 4000 });
    const pr = await page.evaluate(() => ({ s: window.BubbleSumo.screen, plays: window.BubbleSumo.save.stats.plays, n: window.BubbleSumo.ais.length, x: window.BubbleSumo.bout.f[1].x }));
    check("연습: 밀어내도 계속 이어지고 기록 안 남음", pr.s === "fight" && pr.plays === statsB && pr.n === 0 && Math.abs(pr.x) < 300, JSON.stringify(pr));
    await page.click("#quit-chip");
    check("연습: 끝내기 버튼", (await page.evaluate(() => window.BubbleSumo.screen)) === "title");

    // 난이도 선택
    await page.click('[data-go="practice"]');
    await page.click('#pr-level [data-v="3"]');
    await page.click('#pr-world [data-v="0"]');
    await page.click("#pr-go");
    const prL = await page.evaluate(() => ({ lv: window.BubbleSumo.ais[0].level }));
    check("연습: AI 난이도 선택", prL.lv === 2, JSON.stringify(prL));
    await page.evaluate(() => window.BubbleSumo.toTitle());

    // 오늘의 도전
    const daily = await page.evaluate(() => {
      const A = window.BubbleSumo;
      const a = A.dailyList().map((d) => d.id);
      const b = A.dailyList().map((d) => d.id);
      A.save.daily = { date: "2000-01-01", prog: { wins3: 2 }, done: ["wins3"] };
      const c = A.dailyList();
      return { same: JSON.stringify(a) === JSON.stringify(b), n: a.length, cleared: A.save.daily.date !== "2000-01-01" && A.save.daily.done.length === 0, c: c.length };
    });
    check("오늘의 도전 3개 · 날짜가 바뀌면 새로", daily.same && daily.n === 3 && daily.cleared, JSON.stringify(daily));
    await page.click('[data-go="book"]');
    for (const t of ["daily", "dex", "ach", "stats"]) {
      await page.click(`[data-tab="${t}"]`);
      const n = await page.evaluate(() => document.getElementById("book-body").children.length);
      check(`도감 · 업적 탭: ${t}`, n > 0, `${n}개`);
    }
    await page.click("#book [data-back]");

    // 설정
    await page.click('[data-go="settings"]');
    await page.click("#set-music");
    await page.reload();
    await page.waitForFunction(() => window.BubbleSumo);
    const sound = await page.evaluate(() => ({ m: window.BubbleSumo.save.sound.music, sf: window.BubbleSumo.sfx.musicOn }));
    check("소리 설정이 저장됨", sound.m === false && sound.sf === false, JSON.stringify(sound));
    await hookEvents(page);
    await loadCamp(page);

    // 일시정지
    await duel(page, "1-2");
    await page.keyboard.press("Escape");
    await sleep(120);
    const p1 = await page.evaluate(() => ({ p: window.BubbleSumo.paused, t: window.BubbleSumo.bout.total }));
    await sleep(400);
    const p2 = await page.evaluate(() => window.BubbleSumo.bout.total);
    check("ESC: 일시정지 · 시간이 멈춤", p1.p && p1.t === p2, `${p1.t.toFixed(2)}→${p2.toFixed(2)}`);
    await page.keyboard.press("Escape");
    await sleep(250);
    const p3 = await page.evaluate(() => ({ p: window.BubbleSumo.paused, t: window.BubbleSumo.bout.total }));
    check("ESC: 다시 이어 하기", !p3.p && p3.t > p2);
    // 같은 키 꾹 = 한 번
    await clearEv(page);
    await page.evaluate(() => {
      const b = window.BubbleSumo.bout;
      b.f[0].pushCd = 0;
    });
    await page.keyboard.down("Space");
    await page.keyboard.down("Space");
    await page.keyboard.down("Space");
    await sleep(500);
    await page.keyboard.up("Space");
    const once = await ev(page, 'e.t==="whoosh"&&e.i===0');
    check("Space 를 꾹 눌러도 한 번만", once === 1, `${once}번`);
    // 화면 크기 변경
    await page.setViewportSize({ width: 900, height: 500 });
    await sleep(250);
    const rs = await page.evaluate(() => ({ w: window.BubbleSumo.W, cw: document.getElementById("game").getBoundingClientRect().width, t: window.BubbleSumo.bout.total }));
    await sleep(200);
    const rs2 = await page.evaluate(() => window.BubbleSumo.bout.total);
    check("경기 중 창 크기를 바꿔도 계속 돔", rs.w === 900 && rs.cw === 900 && rs2 > rs.t, JSON.stringify(rs));
    check("모드 오류 없음", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  /* ---------- 튜토리얼 ---------- */
  if (want("tutorial")) {
    const page = await open(browser);
    await page.click("#btn-play");
    const m = await page.evaluate(() => window.BubbleSumo.m.mode);
    check("첫 PLAY 는 튜토리얼부터", m === "tutorial", m);
    const text0 = await page.evaluate(() => document.getElementById("coach-t").textContent);
    await waitFight(page);
    await page.keyboard.down("KeyD");
    await page.waitForFunction(() => window.BubbleSumo.m.step === 1, null, { timeout: 6000 });
    await page.keyboard.up("KeyD");
    for (let i = 0; i < 40; i += 1) {
      if ((await page.evaluate(() => window.BubbleSumo.m.step)) !== 1) break;
      const near = await page.evaluate(() => Math.abs(window.BubbleSumo.bout.f[0].x - window.BubbleSumo.bout.f[1].x));
      if (near > 170) {
        await page.keyboard.down("KeyD");
        await sleep(160);
        await page.keyboard.up("KeyD");
      }
      await page.keyboard.press("Space");
      await sleep(200);
    }
    check("튜토리얼 2단계: 밀기 3번", (await page.evaluate(() => window.BubbleSumo.m.step)) === 2);
    for (let i = 0; i < 10; i += 1) {
      if ((await page.evaluate(() => window.BubbleSumo.m.step)) !== 2) break;
      await page.evaluate(() => {
        const b = window.BubbleSumo.bout;
        if (Math.abs(b.f[0].x - b.f[1].x) > 240) b.f[1].x = b.f[0].x + 200;
      });
      await page.keyboard.down("ShiftLeft");
      await sleep(420);
      await page.keyboard.up("ShiftLeft");
      await sleep(800);
    }
    check("튜토리얼 3단계: 돌진", (await page.evaluate(() => window.BubbleSumo.m.step)) === 3);
    await page.keyboard.down("KeyS");
    await page.waitForFunction(() => window.BubbleSumo.m.step !== 3, null, { timeout: 12000 });
    await page.keyboard.up("KeyS");
    check("튜토리얼 4단계: 상대가 밀 때 버티기", (await page.evaluate(() => window.BubbleSumo.m.step)) === 4);
    await waitFight(page);
    await sleep(100);
    await page.keyboard.press("KeyE");
    await page.waitForFunction(() => window.BubbleSumo.m.step === 5, null, { timeout: 5000 }).catch(() => {});
    const s4 = await page.evaluate(() => window.BubbleSumo.m.step);
    check("튜토리얼 5단계: 기술", s4 === 4 || s4 === 5, `단계 ${s4}`);
    if (s4 === 4) {
      // 기술 사용 뒤 다음 단계로 넘어가는지 (사건으로)
      check("튜토리얼 5단계: 기술을 쓰면 다음으로", false, "기술 사건이 진행으로 이어지지 않음");
    }
    await page.evaluate(() => {
      const b = window.BubbleSumo.bout;
      b.f[1].x = 480;
    });
    await page.waitForFunction(() => window.BubbleSumo.m.mode === "duel", null, { timeout: 6000 });
    const after = await page.evaluate(() => ({ st: window.BubbleSumo.m.stage.id, tut: window.BubbleSumo.save.tutorial, coin: window.BubbleSumo.save.coins }));
    check("튜토리얼을 마치면 첫 경기로", after.st === "1-1" && after.tut && after.coin >= 100, `${text0} → ${JSON.stringify(after)}`);
    // 건너뛰기
    await page.evaluate(() => {
      window.BubbleSumo.save.tutorial = false;
      window.BubbleSumo.toTitle();
    });
    await page.click("#btn-play");
    await page.click("#coach-skip");
    const sk = await page.evaluate(() => ({ m: window.BubbleSumo.m.mode, t: window.BubbleSumo.save.tutorial }));
    check("튜토리얼 건너뛰기", sk.m === "duel" && sk.t, JSON.stringify(sk));
    check("튜토리얼 오류 없음", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  /* ---------- 화면 크기 ---------- */
  if (want("layout")) {
    for (const [width, height, mobile] of [[1920, 1080, false], [1280, 720, false], [1024, 600, false], [768, 1024, true], [844, 390, true], [667, 375, true], [390, 844, true], [360, 640, true]]) {
      const page = await open(browser, { width, height, mobile });
      await loadCamp(page);
      await sleep(200);
      const fit = (ids) =>
        page.evaluate((list) => {
          const out = [];
          for (const s of list) {
            const el = document.querySelector(s);
            if (!el) {
              out.push(`${s}:없음`);
              continue;
            }
            const r = el.getBoundingClientRect();
            if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.push(`${s}:${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
          }
          return out;
        }, ids);
      const t = await fit(["#btn-play", ".row.modes", ".row.subs", ".logo"]);
      check(`[${width}x${height}] 첫 화면이 화면 안`, t.length === 0, t.join(" "));
      await page.evaluate(() => window.BubbleSumo.go("select"));
      const sel = await page.evaluate(() => ({ w: document.querySelector("#select").scrollWidth <= innerWidth + 1, go: !!document.querySelector("#sel-go") }));
      check(`[${width}x${height}] 캐릭터 선택: 옆으로 안 넘침`, sel.w);
      await page.evaluate(() => window.BubbleSumo.toTitle());
      await duel(page, "1-2");
      const f = await fit(["#hud"]);
      const ring = await page.evaluate(() => {
        const st = window.BubbleSumo.stage;
        const hudB = document.getElementById("hud").getBoundingClientRect().bottom;
        // 줄 위 가장 끝에 선 캐릭터까지 화면 안, 머리가 HUD 아래
        const lx = st.cx - st.rx - 10;
        return { left: lx, right: st.cx + st.rx + 10, W: st.W, headTop: st.gy - 250 * st.S * 0.88, hudB };
      });
      check(`[${width}x${height}] 경기장이 가로로 다 보임`, ring.left >= -6 && ring.right <= ring.W + 6, JSON.stringify(ring));
      check(`[${width}x${height}] 캐릭터 머리가 HUD 아래`, ring.headTop >= ring.hudB - 26 || height < 420, `머리 ${ring.headTop.toFixed(0)} · HUD ${ring.hudB.toFixed(0)}`);
      check(`[${width}x${height}] HUD 가 화면 안`, f.length === 0, f.join(" "));
      await page.evaluate(() => {
        window.BubbleSumo.bout.need = 1;
        window.BubbleSumo.bout.f[1].x = 480;
      });
      await page.waitForFunction(() => window.BubbleSumo.screen === "result", null, { timeout: 8000 });
      await sleep(300);
      const res = await fit([".res-card", "#res-next", "#res-menu"]);
      check(`[${width}x${height}] 결과 카드가 화면 안`, res.length === 0, res.join(" "));
      check(`[${width}x${height}] 오류 없음`, page.errors.length === 0, page.errors.slice(0, 2).join(" | "));
      await page.context().close();
    }
  }

  /* ---------- 연속 경기 성능 ---------- */
  if (want("perf")) {
    const page = await open(browser);
    await loadCamp(page);
    await sleep(400);
    const before = await page.evaluate(() => {
      if (window.gc) window.gc();
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });
    const frames = [];
    for (let i = 0; i < 12; i += 1) {
      await duel(page, "1-1", true);
      const f = await page.evaluate(
        () =>
          new Promise((res) => {
            const list = [];
            let last = performance.now();
            const T = (n) => {
              list.push(n - last);
              last = n;
              if (list.length >= 90) res(list);
              else requestAnimationFrame(T);
            };
            requestAnimationFrame(T);
          })
      );
      frames.push(...f);
      await page.evaluate(() => {
        window.BubbleSumo.bout.f[1].x = 480;
      });
      await page.waitForFunction(() => window.BubbleSumo.screen === "result", null, { timeout: 9000 });
      await sleep(250);
    }
    const heap = await page.evaluate(() => {
      window.BubbleSumo.toTitle();
      if (window.gc) window.gc();
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });
    frames.sort((a, b) => a - b);
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    const p95 = frames[Math.floor(frames.length * 0.95)];
    const first = await page.evaluate(() => window.BubbleSumo.fpsNow || 0);
    check("연속 12경기: 평균 프레임 25ms 이하", avg <= 25, `평균 ${avg.toFixed(1)}ms · p95 ${p95.toFixed(1)}ms · 최근 ${first.toFixed(0)}fps`);
    const mb = (heap - before) / 1048576;
    check("연속 12경기: 메모리가 쌓이지 않음 (+15MB 이하)", mb < 15, `${mb.toFixed(1)}MB`);
    check("성능 오류 없음", page.errors.length === 0, page.errors.slice(0, 2).join(" | "));
    await page.context().close();
  }

  await browser.close();
  console.log(`\n통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("실패:", e);
  process.exit(2);
});
