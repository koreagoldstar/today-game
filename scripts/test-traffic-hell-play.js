/**
 * 교통지옥 — 실제 브라우저로 플레이 (휴대폰 터치 · PC 마우스/키보드 · 저장 · 날짜 · 성능)
 *   (npm start 로 3456 서버를 띄운 뒤) node scripts/test-traffic-hell-play.js
 * /api 는 가짜 응답 (실제 랭킹에 기록하지 않음)
 */
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:3456";
const URL = `${BASE}/games/traffic-hell/`;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

async function page(browser, vp, extra = "") {
  const mobile = vp.width < 600;
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: "block", ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  p.errors = [];
  p.posts = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && p.errors.push(m.text()));
  await p.route("**/api/**", (r) => {
    if (r.request().method() === "POST") p.posts.push(r.request().postDataJSON());
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, scores: [], rankDay: 1 }) });
  });
  await p.goto(`${URL}?test=1${extra}`);
  await p.waitForTimeout(700);
  return p;
}
/** 월드 좌표 → 화면 좌표 */
const screenOf = (p, x, y) =>
  p.evaluate(([x, y]) => {
    const R = window.__thTest.G.R;
    const r = document.getElementById("cv").getBoundingClientRect();
    const s = R.toScreen(x, y);
    return [r.left + s[0], r.top + s[1]];
  }, [x, y]);
/** 기준 봇으로 끝까지 (고장 · 사고 차는 자동 견인) */
const botToEnd = (p, maxSec = 600) =>
  p.evaluate(async (maxSec) => {
    const T = window.__thTest;
    const G = T.G;
    for (let i = 0; i < maxSec * 2 && !G.ended; i++) {
      T.bot();
      for (const v of G.sim.vehicles) if ((v.broken || v.crashed) && !v.towing && (v.brokenT > 2 || v.crashT > 2 || v.crashT < -1e8)) G.sim.tow(v.id);
      T.stepN(15);
      if (i % 40 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return { ended: G.ended, status: G.sim.status, reason: G.sim.reason, st: G.sim.stats() };
  }, maxSec);

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });

  /* ===== 휴대폰 ===== */
  const m = await page(browser, { width: 390, height: 844 });
  check("U1 메뉴: 모드 4개 · 오늘의 미션 3개", (await m.$$eval("[data-mode]", (e) => e.length)) === 4 && (await m.$$eval("#missions li", (e) => e.length)) === 3);
  check("U2 휴대폰 메뉴 가로 넘침 없음", !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)));

  // 튜토리얼: 실제 교차로를 손가락으로
  await m.tap("#tut-btn");
  await m.waitForTimeout(400);
  check("T1 튜토리얼 시작 · 안내 표시", !(await m.isHidden("#coach")) && (await m.textContent("#coach")).includes("1/4"));
  const I0 = await m.evaluate(() => {
    const I = window.__thTest.G.sim.net.inters[0];
    return [I.x, I.y];
  });
  let [sx, sy] = await screenOf(m, I0[0], I0[1]);
  await m.touchscreen.tap(sx, sy);
  await m.waitForTimeout(150);
  check("T2 교차로를 탭하면 신호가 바뀜 (노란불)", (await m.evaluate(() => window.__thTest.G.sim.net.inters[0].state)) === "Y");
  await m.evaluate(() => window.__thTest.stepN(30 * 9));
  await m.waitForTimeout(250);
  check("T3 노란불 뒤 초록 · 다음 안내", (await m.textContent("#coach")).includes("3/4"), await m.textContent("#coach"));
  await m.tap('.th-ph[data-ph="1"]');
  await m.waitForTimeout(250);
  check("T4 아래 신호 버튼으로 바로 고르기", (await m.textContent("#coach")).includes("4/4") && (await m.evaluate(() => window.__thTest.G.sim.net.inters[0].next)) === 1);
  const tut = await botToEnd(m, 300);
  await m.waitForTimeout(300);
  check("T5 튜토리얼 끝 (12대 통과) · 완료 창 · 저장", tut.status === "win" && (await m.textContent("#modal-body")).includes("튜토리얼 완료") && (await m.evaluate(() => window.__thTest.db().tutorial)) === true, `${Math.round(tut.st.t)}초 · ${tut.st.passed}대`);
  await m.tap("#t-menu");
  await m.waitForTimeout(300);

  // 스테이지 1: 메뉴 → 고르기 → 안내 → 플레이 → 결과
  await m.tap('[data-mode="stage"]');
  await m.waitForTimeout(250);
  const cards = await m.$$eval("#pick-list .th-card", (e) => e.map((x) => ({ lock: x.disabled })));
  check("S1 스테이지 20개 (테스트 모드라 모두 열림)", cards.length === 20);
  await m.tap('#pick-list .th-card[data-i="0"]');
  await m.waitForTimeout(250);
  check("S2 시작 전 안내 (목표 · 팁)", (await m.textContent("#modal-body")).includes("30대 통과") && (await m.$$eval(".th-tips li", (e) => e.length)) >= 2);
  await m.tap("#go-btn");
  await m.waitForTimeout(500);
  check("S3 게임 화면 · 실시간 지표 8칸 · 신호 버튼", (await m.$$eval("#bar > div", (e) => e.length)) === 8 && (await m.$$eval(".th-ph", (e) => e.length)) === 2);
  const lay = await m.evaluate(() => {
    const st = document.getElementById("stage").getBoundingClientRect();
    const dk = document.getElementById("dock").getBoundingClientRect();
    const cv = document.getElementById("cv");
    return { stH: st.height, overlap: dk.top < st.bottom - 1, cvOk: Math.abs(cv.width / devicePixelRatio - st.width) < 3, sw: document.documentElement.scrollWidth > innerWidth };
  });
  check("S4 휴대폰: 도로 화면이 크고 버튼이 차를 가리지 않음", lay.stH > 380 && !lay.overlap && lay.cvOk && !lay.sw, JSON.stringify(lay));
  // 차가 실제로 움직인다
  const mv = await m.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 2500));
    const s = window.__thTest.G.sim;
    return { n: s.vehicles.length, moving: s.vehicles.filter((v) => v.v > 1).length, t: s.t };
  });
  check("S5 실시간 진행: 차가 생기고 움직임", mv.n > 0 && mv.moving > 0 && mv.t > 2, JSON.stringify(mv));
  const s1 = await botToEnd(m);
  await m.waitForTimeout(400);
  const res = await m.textContent("#modal-body");
  check("S6 스테이지 1 성공 · 결과 창 (별 · 점수 내역)", s1.status === "win" && res.includes("성공") && (await m.$$eval(".th-bigstars .on", (e) => e.length)) >= 1 && res.includes("차량 통과"), `${s1.st.passed}대 · ${s1.st.score}점`);
  const rec = await m.evaluate(() => window.__thTest.db().stages.s1);
  check("S7 기록 저장: 클리어 · 별 · 최고 점수", rec && rec.cleared && rec.stars >= 1 && rec.best === s1.st.score);
  check("S8 다음 스테이지 버튼", !!(await m.$("#r-next")));
  await m.tap("#r-next");
  await m.waitForTimeout(250);
  check("S9 다음 스테이지 안내", (await m.textContent("#modal-body")).includes("한쪽이 붐빈다"));
  await m.tap("#modal-x");

  // 여러 교차로: 탭한 교차로가 정확히 선택 · 전환
  await m.evaluate(() => window.__thTest.startLevel("stage", "s16"));
  await m.waitForTimeout(500);
  const B = await m.evaluate(() => {
    const I = window.__thTest.G.sim.net.inters[1];
    return [I.x, I.y];
  });
  [sx, sy] = await screenOf(m, B[0], B[1]);
  await m.touchscreen.tap(sx, sy);
  await m.waitForTimeout(150);
  const selB = await m.evaluate(() => ({ sel: window.__thTest.G.sel, a: window.__thTest.G.sim.net.inters[0].state, b: window.__thTest.G.sim.net.inters[1].state }));
  check("M1 작은 화면에서도 누른 교차로(B)만 선택 · 전환", selB.sel === 1 && selB.b === "Y" && selB.a === "G", JSON.stringify(selB));
  check("M2 교차로 고르기 버튼 A · B", (await m.$$eval(".th-isel button", (e) => e.length)) === 2);

  // 사고 수습: 사고 차를 탭해서 견인
  await m.evaluate(() => window.__thTest.startLevel("mission", "m2"));
  await m.evaluate(() => window.__thTest.stepN(10));
  const wreck = await m.evaluate(() => {
    const G = window.__thTest.G;
    const v = G.sim.vehicles.find((o) => o.crashed);
    return { id: v.id, x: v.x, y: v.y, k: G.R.cssK };
  });
  [sx, sy] = await screenOf(m, wreck.x, wreck.y);
  await m.touchscreen.tap(sx, sy - 16);
  await m.waitForTimeout(150);
  check("M3 사고 차 아이콘을 탭하면 견인", await m.evaluate((id) => window.__thTest.G.sim.vehicles.find((o) => o.id === id).towing, wreck.id));
  const m2 = await botToEnd(m);
  check("M4 사고 수습 미션 성공", m2.status === "win", `${m2.reason} · ${m2.st.passed}대`);

  // 오늘의 교통지옥: 끝까지 → 순위 등록
  await m.evaluate(() => {
    document.getElementById("modal").hidden = true;
  });
  await m.evaluate(() => window.__thTest.startLevel("daily"));
  const dly = await botToEnd(m);
  await m.waitForTimeout(300);
  check("D1 오늘의 교통지옥 4분 완주 · 결과", dly.ended && Math.round(dly.st.t) >= 239 && (await m.textContent("#modal-body")).includes("오늘의 교통지옥 완주"), `${dly.st.score}점 · ${dly.st.passed}대`);
  await m.fill("#rank-name", "교통왕");
  await m.tap("#rank-form button");
  await m.waitForTimeout(400);
  const post = m.posts.find((x) => x.game === "traffic-hell-daily");
  check("D2 오늘의 순위 등록 (traffic-hell-daily)", post && post.name === "교통왕" && post.score === dly.st.score, JSON.stringify(post));
  const dd = await m.evaluate(() => {
    const d = window.__thTest.db();
    return { day: d.daily[window.__thTest.today()], week: d.week, dm: d.dm[window.__thTest.today()] };
  });
  check("D3 일일 기록 · 주간 합계 · 오늘의 미션 진행 저장", dd.day && dd.day.best === dly.st.score && dd.week.sum >= dly.st.score && dd.dm.dailyDone === 1 && dd.dm.passed > 0);

  // 무한 모드
  await m.evaluate(() => {
    document.getElementById("modal").hidden = true;
  });
  await m.evaluate(() => window.__thTest.startLevel("endless"));
  const inf = await botToEnd(m, 1200);
  await m.waitForTimeout(300);
  const e = await m.evaluate(() => window.__thTest.db().endless);
  check("E1 무한 교통지옥: 끝날 때까지 · 생존 · 통과 · 최고 점수 기록", inf.ended && e.best === inf.st.score && Math.abs(e.time - inf.st.t) < 0.1 && e.passed === inf.st.passed, `생존 ${Math.round(inf.st.t)}초 · ${inf.st.passed}대 · ${inf.reason}`);
  check("E2 무한 랭킹 등록 폼", !!(await m.$("#rank-form")));

  // 새로고침 → 기록 유지
  await m.reload();
  await m.waitForTimeout(700);
  const menuTxt = await m.textContent("#modes");
  check("R1 새로고침 뒤에도 기록 유지 (메뉴 표시)", menuTxt.includes("1/20 클리어") && menuTxt.includes("최고"), menuTxt.replace(/\s+/g, " ").slice(0, 160));
  await m.evaluate(() => localStorage.setItem("tg-traffichell", "{broken json"));
  await m.reload();
  await m.waitForTimeout(600);
  check("R2 깨진 저장값이어도 정상 시작", (await m.$$eval("[data-mode]", (e) => e.length)) === 4);
  check("R3 휴대폰 콘솔 오류 0", m.errors.length === 0, m.errors.slice(0, 3).join(" | "));

  /* ===== 360px ===== */
  const n = await page(browser, { width: 360, height: 740 });
  await n.evaluate(() => window.__thTest.startLevel("stage", "s20"));
  await n.waitForTimeout(500);
  const l360 = await n.evaluate(() => ({ sw: document.documentElement.scrollWidth > innerWidth, st: document.getElementById("stage").getBoundingClientRect().height, ph: [...document.querySelectorAll(".th-ph")].every((b) => b.getBoundingClientRect().height >= 44) }));
  check("X1 360px: 가로 넘침 없음 · 도로 화면 · 버튼 44px 이상", !l360.sw && l360.st > 300 && l360.ph, JSON.stringify(l360));

  /* ===== PC ===== */
  const d = await page(browser, { width: 1366, height: 860 });
  await d.evaluate(() => window.__thTest.startLevel("stage", "s6"));
  await d.waitForTimeout(400);
  await d.keyboard.press("3");
  await d.waitForTimeout(80);
  check("K1 숫자 키 3 = 남북 좌회전 신호", await d.evaluate(() => window.__thTest.G.sim.net.inters[0].next === 2));
  await d.evaluate(() => window.__thTest.stepN(30 * 8));
  await d.keyboard.press(" ");
  await d.waitForTimeout(80);
  check("K2 스페이스 = 다음 신호", await d.evaluate(() => window.__thTest.G.sim.net.inters[0].state === "Y" && window.__thTest.G.sim.net.inters[0].next === 3));
  await d.keyboard.press("p");
  await d.waitForTimeout(100);
  const t0 = await d.evaluate(() => window.__thTest.G.sim.t);
  await d.waitForTimeout(600);
  const t1 = await d.evaluate(() => window.__thTest.G.sim.t);
  check("K3 P = 일시정지 (시간이 멈춤)", !(await d.isHidden("#paused")) && t1 === t0);
  await d.keyboard.press("p");
  await d.keyboard.press("f");
  check("K4 F = 2배속", (await d.textContent("#speed-btn")) === "×2");
  // PC 레이아웃: 신호 버튼은 오른쪽
  const pc = await d.evaluate(() => {
    const st = document.getElementById("stage").getBoundingClientRect();
    const dk = document.getElementById("dock").getBoundingClientRect();
    return { right: dk.left >= st.right - 1, stW: st.width, stH: st.height };
  });
  check("K5 PC: 도로 화면 넓게 · 신호 버튼 오른쪽", pc.right && pc.stW > 900 && pc.stH > 500, JSON.stringify(pc));
  // 마우스 클릭으로 교차로 전환
  await d.evaluate(() => window.__thTest.stepN(30 * 8));
  const I = await d.evaluate(() => {
    const I = window.__thTest.G.sim.net.inters[0];
    return [I.x, I.y];
  });
  [sx, sy] = await screenOf(d, I[0], I[1]);
  const before = await d.evaluate(() => window.__thTest.G.sim.net.inters[0].switches);
  await d.mouse.click(sx, sy);
  check("K6 마우스로 교차로 클릭 = 신호 전환", (await d.evaluate(() => window.__thTest.G.sim.net.inters[0].switches)) === before + 1);

  // 성능: 차가 많은 판에서 계산 · 그리기
  await d.evaluate(() => window.__thTest.startLevel("stage", "s20"));
  const perf = await d.evaluate(async () => {
    const T = window.__thTest;
    const G = T.G;
    for (let i = 0; i < 120; i++) {
      T.bot();
      T.stepN(15);
    }
    const n = G.sim.vehicles.length;
    const a = performance.now();
    T.stepN(30 * 20);
    const simMs = (performance.now() - a) / 600;
    let frames = 0;
    const b = performance.now();
    await new Promise((r) => {
      const f = () => {
        frames++;
        if (performance.now() - b < 2000) requestAnimationFrame(f);
        else r();
      };
      requestAnimationFrame(f);
    });
    const c = performance.now();
    for (let i = 0; i < 30; i++) G.R.draw(0.5);
    const drawMs = (performance.now() - c) / 30;
    return { n, simMs: +simMs.toFixed(3), fps: Math.round(frames / 2), drawMs: +drawMs.toFixed(2) };
  });
  check("P1 차량 많을 때: 계산 걸음 1ms · 그리기 16ms 미만", perf.simMs < 1 && perf.drawMs < 16, JSON.stringify(perf));

  // 날짜 바꾸기: 다른 날짜 = 다른 오늘의 판
  const a = await page(browser, { width: 1366, height: 860 }, "&today=2026-11-22");
  const ida = await a.evaluate(() => window.__thTest.startLevel("daily").level.id);
  const b2 = await page(browser, { width: 1366, height: 860 }, "&today=2026-11-23");
  const idb = await b2.evaluate(() => window.__thTest.startLevel("daily").level.id);
  check("N1 날짜가 바뀌면 오늘의 판도 바뀜 (서울 날짜)", ida === "daily-2026-11-22" && idb === "daily-2026-11-23");
  check("N2 PC 콘솔 오류 0", d.errors.length === 0 && n.errors.length === 0 && a.errors.length === 0, [...d.errors, ...n.errors].slice(0, 3).join(" | "));

  // 기존 홈에 등록
  const home = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await home.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await home.goto(BASE + "/");
  await home.waitForTimeout(800);
  check("H1 홈에 교통지옥 카드", (await home.$$eval('a[href="/games/traffic-hell/"]', (e) => e.length)) >= 1);

  await browser.close();
  let bad = 0;
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? " · " + r.detail : ""}`);
    if (!r.ok) bad++;
  }
  console.log(`\n${results.length - bad}/${results.length} ${bad ? "FAIL" : "PASS"}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
