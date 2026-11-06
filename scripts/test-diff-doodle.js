/*
 * 다른 그림 찾기 · 폴짝 하늘 점검. 서버를 띄운 뒤: node scripts/test-diff-doodle.js
 * 다른 그림 찾기는 50단계를 모두 그려 "바뀐 곳은 정말 다르고, 그 밖은 똑같은지" 픽셀로 확인한다.
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3456";
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
}
async function open(browser, path, { width = 1280, height = 720, mobile = false } = {}) {
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
  await page.goto(BASE + path);
  return page;
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });

  /* ---------- 다른 그림 찾기: 50단계 그림 검사 ---------- */
  if (want("scenes")) {
    const page = await open(browser, "/games/diff/");
    await page.waitForFunction(() => window.SpotDiff, null, { timeout: 20000 });
    const res = await page.evaluate(async () => {
      const { buildStage, drawScene, SW, SH } = await import("/games/diff/js/scenes.js?v=2");
      await document.fonts.load("20px Jua");
      const mk = () => {
        const c = document.createElement("canvas");
        c.width = SW;
        c.height = SH;
        return c;
      };
      const out = [];
      for (let i = 0; i < 50; i += 1) {
        const st = buildStage(i);
        const again = buildStage(i);
        const L = mk();
        const R = mk();
        drawScene(L.getContext("2d"), st, "L");
        drawScene(R.getContext("2d"), st, "R");
        const a = L.getContext("2d").getImageData(0, 0, SW, SH).data;
        const b = R.getContext("2d").getImageData(0, 0, SW, SH).data;
        const inside = st.diffs.map(() => 0);
        let stray = 0;
        let strayAt = null;
        for (let y = 0; y < SH; y += 1) {
          for (let x = 0; x < SW; x += 1) {
            const k = (y * SW + x) * 4;
            const d = Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]);
            if (d < 40) continue;
            let near = false;
            st.diffs.forEach((df, j) => {
              const dist = Math.hypot(df.x - x, df.y - y);
              if (dist < df.hit * 1.5) inside[j] += 1;
              if (dist < df.hit * 2.4) near = true;
            });
            if (!near) {
              stray += 1;
              strayAt = strayAt || [x, y];
            }
          }
        }
        let minGap = Infinity;
        for (let p = 0; p < st.diffs.length; p += 1) for (let q = p + 1; q < st.diffs.length; q += 1) minGap = Math.min(minGap, Math.hypot(st.diffs[p].x - st.diffs[q].x, st.diffs[p].y - st.diffs[q].y));
        out.push({
          i,
          need: Math.min(7, 3 + Math.floor(i / 7)),
          n: st.diffs.length,
          weak: st.diffs.filter((_, j) => inside[j] < 25).map((d) => `${st.objs[d.oi].k}.${d.key}`),
          stray,
          strayAt,
          minGap,
          same: JSON.stringify(st.diffs) === JSON.stringify(again.diffs),
          vis: st.diffs.reduce((s, d) => s + d.vis, 0) / st.diffs.length,
        });
      }
      return out;
    });
    const short = res.filter((r) => r.n !== r.need);
    check("50단계 모두 차이 개수가 맞음 (3개 → 7개)", short.length === 0, short.map((r) => `${r.i + 1}단계 ${r.n}/${r.need}`).join(", "));
    const weak = res.filter((r) => r.weak.length);
    check("모든 차이가 그림에서 실제로 보임 (가려진 차이 없음)", weak.length === 0, weak.map((r) => `${r.i + 1}단계 ${r.weak.join("/")}`).slice(0, 6).join(", "));
    const stray = res.filter((r) => r.stray > 20);
    check("차이 말고 다른 곳은 똑같이 그려짐", stray.length === 0, stray.map((r) => `${r.i + 1}단계 ${r.stray}px @${r.strayAt}`).slice(0, 6).join(", "));
    check("차이끼리 서로 떨어져 있음 (90 이상)", res.every((r) => r.minGap >= 90), `최소 ${Math.min(...res.map((r) => r.minGap)).toFixed(0)}`);
    check("같은 단계는 언제나 같은 그림", res.every((r) => r.same));
    const early = res.slice(0, 10).reduce((s, r) => s + r.vis, 0) / 10;
    const late = res.slice(40).reduce((s, r) => s + r.vis, 0) / 10;
    check("앞 단계는 잘 보이는 차이, 뒤 단계는 작은 차이", early > late + 0.6, `앞 ${early.toFixed(2)} · 뒤 ${late.toFixed(2)}`);
    check("그림 검사 오류 없음", page.errors.length === 0, page.errors.slice(0, 2).join(" | "));
    await page.context().close();
  }

  /* ---------- 다른 그림 찾기: 플레이 ---------- */
  if (want("diff")) {
    const page = await open(browser, "/games/diff/");
    await page.waitForFunction(() => window.SpotDiff, null, { timeout: 20000 });
    await page.evaluate(() => localStorage.removeItem("today-diff-v2"));
    await page.reload();
    await page.waitForFunction(() => window.SpotDiff);
    check("처음엔 이어하기 버튼 없음", await page.evaluate(() => document.getElementById("cont-btn").classList.contains("hidden")));
    await page.click("#start-btn");
    const tap = async (side, x, y) => {
      const r = await page.evaluate((s) => {
        const q = document.getElementById(s).getBoundingClientRect();
        return { x: q.left, y: q.top, w: q.width, h: q.height };
      }, side);
      await page.mouse.click(r.x + (x / 800) * r.w, r.y + (y / 600) * r.h);
    };
    const st = await page.evaluate(() => window.SpotDiff.stage);
    const t0 = await page.evaluate(() => window.SpotDiff.timeLeft);
    await tap("right", st.diffs[0].x, st.diffs[0].y);
    check("오른쪽 그림에서 차이를 누르면 찾음", (await page.evaluate(() => window.SpotDiff.found)) === 1);
    await tap("left", st.diffs[0].x, st.diffs[0].y);
    const t1 = await page.evaluate(() => window.SpotDiff.timeLeft);
    check("이미 찾은 곳을 또 눌러도 감점 없음", t0 - t1 < 2, `${t0.toFixed(1)}→${t1.toFixed(1)}`);
    // 차이에서 먼 곳
    let far = null;
    for (const [x, y] of [[30, 30], [770, 30], [30, 570], [770, 570], [400, 30], [400, 570]]) if (st.diffs.every((d) => Math.hypot(d.x - x, d.y - y) > d.hit + 10)) far = far || [x, y];
    await tap("left", far[0], far[1]);
    const t2 = await page.evaluate(() => window.SpotDiff.timeLeft);
    check("틀린 곳을 누르면 5초 감점", t1 - t2 > 4.5 && t1 - t2 < 6, `${t1.toFixed(1)}→${t2.toFixed(1)}`);
    await page.click("#item-hint");
    const hintN = await page.evaluate(() => document.getElementById("count-hint").textContent);
    check("힌트 아이템 (하나 줄고 반짝임)", hintN === "2" && (await page.evaluate(() => document.getElementById("item-hint").disabled)));
    await page.click("#item-time");
    const t3 = await page.evaluate(() => window.SpotDiff.timeLeft);
    check("+15초 아이템", t3 - t2 > 14, `${t2.toFixed(1)}→${t3.toFixed(1)}`);
    for (const d of st.diffs.slice(1)) await tap("left", d.x, d.y);
    await page.waitForFunction(() => !document.getElementById("clear").classList.contains("hidden"), null, { timeout: 4000 });
    const cl = await page.evaluate(() => ({ s: window.SpotDiff.state, score: window.SpotDiff.score, t: document.getElementById("clear-tally").textContent }));
    check("모두 찾으면 클리어 + 점수 계산", cl.s === "clear" && cl.score > 300, `${cl.score}점`);
    await page.click("#next-btn");
    check("다음 단계로", (await page.evaluate(() => window.SpotDiff.stage.index)) === 1);
    // ESC 일시정지
    const p0 = await page.evaluate(() => window.SpotDiff.timeLeft);
    await page.keyboard.press("Escape");
    await sleep(600);
    const p1 = await page.evaluate(() => ({ t: window.SpotDiff.timeLeft, s: window.SpotDiff.state }));
    check("ESC 일시정지: 시간이 멈춤", p1.s === "paused" && p0 - p1.t < 0.3, `${p0.toFixed(2)}→${p1.t.toFixed(2)}`);
    await page.keyboard.press("Escape");
    await sleep(200);
    // 시간 끝
    await page.evaluate(() => window.SpotDiff.setTime(0.05));
    await page.waitForFunction(() => window.SpotDiff.state === "over", null, { timeout: 3000 });
    const ov = await page.evaluate(() => ({ vis: !document.getElementById("over").classList.contains("hidden"), rank: !!document.querySelector("#over .today-rank-form") }));
    check("시간이 끝나면 끝 화면 + 랭킹 등록", ov.vis && ov.rank, JSON.stringify(ov));
    await page.click("#retry-btn");
    check("이 단계 다시", (await page.evaluate(() => ({ s: window.SpotDiff.state, i: window.SpotDiff.stage.index }))).i === 1);
    await page.reload();
    await page.waitForFunction(() => window.SpotDiff);
    const cont = await page.evaluate(() => ({ h: document.getElementById("cont-btn").classList.contains("hidden"), t: document.getElementById("cont-btn").textContent }));
    check("새로고침 뒤 이어하기 (2단계)", !cont.h && cont.t.includes("2단계"), cont.t);
    await page.click("#cont-btn");
    check("이어하기를 누르면 그 단계부터", (await page.evaluate(() => window.SpotDiff.stage.index)) === 1);
    check("플레이 오류 없음", page.errors.length === 0, page.errors.slice(0, 2).join(" | "));
    await page.context().close();
  }

  /* ---------- 다른 그림 찾기: 휴대폰 터치 · 화면 크기 ---------- */
  if (want("layout")) {
    for (const [width, height, mobile] of [[1920, 1080, false], [1280, 720, false], [1024, 600, false], [768, 1024, true], [844, 390, true], [667, 375, true], [390, 844, true], [360, 640, true]]) {
      const page = await open(browser, "/games/diff/", { width, height, mobile });
      await page.waitForFunction(() => window.SpotDiff);
      await page.click("#start-btn");
      await sleep(150);
      const lay = await page.evaluate(() => {
        const R = (s) => document.querySelector(s).getBoundingClientRect();
        const hit = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
        const L = R("#left");
        const Rt = R("#right");
        const fit = (r) => r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
        return {
          fit: fit(L) && fit(Rt) && fit(R(".tools")) && fit(R(".top")),
          ratio: Math.abs(L.width / L.height - 4 / 3) < 0.02,
          over: hit(L, Rt) || hit(Rt, R(".tools")) || hit(L, R(".tools")) || hit(L, R(".timebar")),
          w: Math.round(L.width),
          sw: document.documentElement.scrollWidth <= innerWidth,
        };
      });
      check(`[${width}x${height}] 그림 두 장이 4:3 으로 화면 안 · 겹침 없음`, lay.fit && lay.ratio && !lay.over && lay.sw, `그림 폭 ${lay.w}px`);
      if (mobile && width === 390) {
        const st = await page.evaluate(() => window.SpotDiff.stage);
        const r = await page.evaluate(() => {
          const q = document.getElementById("right").getBoundingClientRect();
          return { x: q.left, y: q.top, w: q.width, h: q.height };
        });
        await page.touchscreen.tap(r.x + (st.diffs[0].x / 800) * r.w, r.y + (st.diffs[0].y / 600) * r.h);
        check(`[${width}x${height}] 손가락으로 차이 찾기`, (await page.evaluate(() => window.SpotDiff.found)) === 1);
      }
      check(`[${width}x${height}] 오류 없음`, page.errors.length === 0, page.errors.slice(0, 2).join(" | "));
      await page.context().close();
    }
  }

  /* ---------- 폴짝 하늘 ---------- */
  if (want("doodle")) {
    for (const [width, height, mobile] of [[1280, 720, false], [390, 844, true]]) {
      const page = await open(browser, "/games/doodle/?test=1", { width, height, mobile });
      await page.waitForFunction(() => window.DoodleTest && window.DoodleTest.ready(), null, { timeout: 20000 });
      check(`[${width}] 개구리 · 사탕 발판 그림 준비`, true);
      await page.click("#start-btn");
      if (!mobile) {
        for (let i = 0; i < 8; i += 1) {
          await page.keyboard.down(i % 2 ? "ArrowLeft" : "ArrowRight");
          await sleep(220);
          await page.keyboard.up(i % 2 ? "ArrowLeft" : "ArrowRight");
        }
      } else await sleep(1600);
      const mid = await page.evaluate(() => window.DoodleTest.state);
      check(`[${width}] 시작하면 점프하며 진행`, mid === "play" || mid === "over", mid);
      // 높이별 하늘이 바뀌는지: 픽셀 색으로
      const colorAt = () =>
        page.evaluate(() => {
          const c = document.getElementById("game");
          const d = c.getContext("2d").getImageData(4, 4, 1, 1).data;
          return [d[0], d[1], d[2]];
        });
      await page.evaluate(() => window.DoodleTest.climb(0));
      await sleep(120);
      const sky0 = await colorAt();
      await page.evaluate(() => window.DoodleTest.climb(2000));
      await sleep(120);
      const sky2 = await colorAt();
      check(`[${width}] 높이 올라가면 밤하늘로 바뀜`, sky0[2] > 200 && sky2[0] + sky2[1] + sky2[2] < 260, `${sky0} → ${sky2}`);
      // 발판이 없으면 떨어져 끝
      await page.evaluate(() => window.DoodleTest.drop());
      await page.waitForFunction(() => window.DoodleTest.state === "over", null, { timeout: 12000 });
      const ov = await page.evaluate(() => !document.getElementById("over").classList.contains("hidden"));
      check(`[${width}] 떨어지면 끝 화면`, ov);
      check(`[${width}] 폴짝 하늘 오류 없음`, page.errors.length === 0, page.errors.slice(0, 2).join(" | "));
      await page.context().close();
    }
  }

  await browser.close();
  console.log(`\n통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("실패:", e);
  process.exit(2);
});
