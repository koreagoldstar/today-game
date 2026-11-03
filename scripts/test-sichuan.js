// 짝짝 사천성 점검: 길 찾기 규칙 · 미는 규칙 · 60단계 봇 완주 · 폭탄 · 아이템 · 실제 클릭 · 폰 배치
const { chromium } = require("playwright");

const URL_ = process.env.TEST_URL || "http://localhost:3456/games/memory/";
let pass = 0;
let fail = 0;
function check(name, ok, info) {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${info !== undefined ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(ctxOpts) {
  const ctx = await browser.newContext({ serviceWorkers: "block", ...ctxOpts });
  const page = await ctx.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) page.errs.push(`${r.status()} ${r.url()}`);
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.setItem("today_visit_counted", "1");
    } catch (_) {
      /* 없어도 됨 */
    }
  });
  await page.goto(URL_);
  await page.waitForFunction(() => window.Sichuan && document.fonts.status === "loaded", null, { timeout: 15000 });
  await sleep(300);
  return page;
}

let browser;
(async () => {
  browser = await chromium.launch({ channel: "chrome" });
  const p = await open({ viewport: { width: 390, height: 844 } });

  /* ---------- 길 찾기 ---------- */
  const paths = await p.evaluate(() => {
    const S = window.Sichuan;
    S.startStage(0);
    const out = {};
    const G = S.grid();
    const C = S.s.C;
    const R = S.s.R;
    const save = G.map((r) => r.slice());
    const only = (cells, kinds) => {
      for (let y = 0; y < R; y += 1) for (let x = 0; x < C; x += 1) G[y][x] = null;
      cells.forEach(([x, y], i) => {
        const t = save[y][x];
        t.x = x;
        t.y = y;
        t.kind = kinds ? kinds[i] : i < 2 ? 0 : 100 + i;
        G[y][x] = t;
      });
      return cells.map(([x, y]) => G[y][x]);
    };
    const turns = (pts) => (pts ? pts.length - 2 : -1);
    let c = only([[1, 1], [2, 1]]);
    out.adjacent = turns(S.findPath(c[0], c[1]));
    c = only([[1, 1], [4, 1]]);
    out.straight = turns(S.findPath(c[0], c[1]));
    c = only([[1, 1], [3, 3]]);
    out.oneTurn = turns(S.findPath(c[0], c[1]));
    // 같은 줄 사이가 막혔을 때: 위로 돌아감 (꺾임 2번)
    c = only([[1, 1], [3, 1], [2, 1]]);
    out.around = turns(S.findPath(c[0], c[1]));
    // 맨 윗줄끼리 막혔을 때: 판 바깥으로 돌아감
    c = only([[1, 0], [3, 0], [2, 0]]);
    const border = S.findPath(c[0], c[1]);
    out.border = border && border.some((q) => q[1] === -1);
    // 위아래 막으면 못 감
    c = only([[1, 1], [3, 1], [2, 1], [1, 0], [3, 0], [1, 2], [3, 2], [0, 1], [4, 1]]);
    out.walled = turns(S.findPath(c[0], c[1]));
    // 꺾임 3번이 있어야 하는 모양
    c = only([[0, 0], [2, 2], [1, 0], [0, 1], [2, 1], [1, 2], [3, 2], [2, 3]]);
    out.threeTurns = turns(S.findPath(c[0], c[1]));
    // 다른 그림은 연결 안 됨
    c = only([[1, 1], [2, 1]], [0, 1]);
    out.diffKind = S.findPath(c[0], c[1]) === null;
    return out;
  });
  check("바로 옆 패는 연결", paths.adjacent === 0);
  check("한 줄로 뚫리면 연결", paths.straight === 0);
  check("꺾임 1번 연결", paths.oneTurn === 1);
  check("막혀도 돌아가면 꺾임 2번으로 연결", paths.around === 2);
  check("판 바깥 한 칸으로 돌아가는 길", paths.border === true);
  check("사방이 막히면 연결 안 됨", paths.walled === -1);
  check("꺾임 3번은 안 됨", paths.threeTurns === -1);
  check("다른 그림은 연결 안 됨", paths.diffKind === true);

  /* ---------- 미는 규칙 ---------- */
  const gravity = await p.evaluate(() => {
    const S = window.Sichuan;
    const out = {};
    const packed = (G, C, R, m) => {
      const midR = Math.floor(R / 2);
      const midC = Math.floor(C / 2);
      const colOk = (x, a, b, toEnd) => {
        let seen = false;
        for (let k = 0; k < b - a; k += 1) {
          const y = toEnd ? b - 1 - k : a + k;
          if (G[y][x]) {
            if (seen) return false;
          } else seen = true;
        }
        return true;
      };
      const rowOk = (y, a, b, toEnd) => {
        let seen = false;
        for (let k = 0; k < b - a; k += 1) {
          const x = toEnd ? b - 1 - k : a + k;
          if (G[y][x]) {
            if (seen) return false;
          } else seen = true;
        }
        return true;
      };
      for (let x = 0; x < C; x += 1) {
        if (m === "down" && !colOk(x, 0, R, true)) return false;
        if (m === "up" && !colOk(x, 0, R, false)) return false;
        if (m === "vcenter" && !(colOk(x, 0, midR, true) && colOk(x, midR, R, false))) return false;
        if (m === "vout" && !(colOk(x, 0, midR, false) && colOk(x, midR, R, true))) return false;
      }
      for (let y = 0; y < R; y += 1) {
        if (m === "right" && !rowOk(y, 0, C, true)) return false;
        if (m === "left" && !rowOk(y, 0, C, false)) return false;
        if (m === "hcenter" && !(rowOk(y, 0, midC, true) && rowOk(y, midC, C, false))) return false;
        if (m === "hout" && !(rowOk(y, 0, midC, false) && rowOk(y, midC, C, true))) return false;
      }
      return true;
    };
    for (const m of ["down", "up", "left", "right", "vcenter", "vout", "hcenter", "hout"]) {
      S.startStage(20);
      S.setMode(m);
      let ok = true;
      let posOk = true;
      for (let i = 0; i < 18; i += 1) {
        const pr = S.findPair();
        if (!pr) break;
        S.select(pr[0]);
        S.select(pr[1]);
        const G = S.grid();
        ok = ok && packed(G, S.s.C, S.s.R, m);
        for (let y = 0; y < S.s.R; y += 1) for (let x = 0; x < S.s.C; x += 1) if (G[y][x] && (G[y][x].x !== x || G[y][x].y !== y)) posOk = false;
      }
      out[m] = { ok, posOk };
    }
    return out;
  });
  for (const m of Object.keys(gravity)) check(`미는 규칙 ${m}: 빈칸 없이 밀림 · 좌표 일치`, gravity[m].ok && gravity[m].posOk, gravity[m]);

  /* ---------- 60단계 봇 완주 ---------- */
  const run = await p.evaluate(() => {
    const S = window.Sichuan;
    const rows = [];
    const problems = [];
    for (let i = 0; i < S.TOTAL; i += 1) {
      for (let round = 0; round < 3; round += 1) {
        S.startStage(i);
        S.skipIntro();
        let guard = 0;
        const start = S.s.remain;
        const startMoves = S.countMoves();
        while (S.s.remain > 0 && guard < 400) {
          const pr = S.findPair();
          if (!pr) {
            problems.push(`${i} 막힘 remain=${S.s.remain}`);
            break;
          }
          const before = S.s.remain;
          // 판마다 먼저 찾는 짝이 판 전체를 한쪽으로 쏠리지 않게 무작위 짝도 씀
          S.select(pr[0]);
          S.select(pr[1]);
          if (S.s.remain >= before) {
            problems.push(`${i} 안 지워짐`);
            break;
          }
          const counts = {};
          S.allTiles().forEach((t) => {
            counts[t.kind] = (counts[t.kind] || 0) + 1;
          });
          if (Object.values(counts).some((n) => n % 2)) problems.push(`${i} 짝이 안 맞음`);
          guard += 1;
        }
        if (S.s.remain > 0) problems.push(`${i} 남음 ${S.s.remain}`);
        if (round === 0) rows.push({ i, start, startMoves, shuffles: S.s.shufflesUsed, time: S.s.timeMax });
      }
    }
    return { rows, problems };
  });
  check("60단계 × 3번 봇이 모두 깸", run.problems.length === 0, run.problems.slice(0, 5));
  const shuffles = run.rows.map((r) => r.shuffles);
  check("막혀서 저절로 섞는 일이 드묾 (단계당 평균 2번 이하)", shuffles.reduce((a, b) => a + b, 0) / shuffles.length <= 2, { max: Math.max(...shuffles), avg: +(shuffles.reduce((a, b) => a + b, 0) / shuffles.length).toFixed(2) });
  const minMoves = Math.min(...run.rows.map((r) => r.startMoves));
  check("시작하자마자 고를 짝이 여러 개", minMoves >= 3, { minMoves });
  const firstT = run.rows[0];
  const lastT = run.rows[run.rows.length - 1];
  check("시간: 처음엔 넉넉, 끝엔 빠듯", firstT.time / (firstT.start / 2) > lastT.time / (lastT.start / 2), { first: `${firstT.time}초/${firstT.start / 2}쌍`, last: `${lastT.time}초/${lastT.start / 2}쌍` });
  const modes = await p.evaluate(() => {
    const S = window.Sichuan;
    const set = new Set();
    for (let i = 0; i < S.TOTAL; i += 1) set.add(S.stageInfo(i).mode);
    return [...set];
  });
  check("미는 규칙이 판마다 다양", modes.length >= 8, modes);

  /* ---------- 폭탄 ---------- */
  const bomb = await p.evaluate(() => {
    const S = window.Sichuan;
    S.startStage(29);
    const list = S.allTiles();
    const bombs = list.filter((t) => t.kind === S.BOMB);
    const before = S.s.remain;
    const a = list.find((t) => t.kind === S.BOMB);
    // 폭탄 두 개를 바로 옆에 둠
    const b = bombs[1];
    const near = S.tileAt(a.x + (a.x > 0 ? -1 : 1), a.y);
    if (near && near !== b) {
      const k = near.kind;
      near.kind = b.kind;
      b.kind = k;
    }
    S.select(a);
    S.select(near);
    const counts = {};
    S.allTiles().forEach((t) => {
      counts[t.kind] = (counts[t.kind] || 0) + 1;
    });
    return { before, after: S.s.remain, even: Object.values(counts).every((n) => n % 2 === 0), bombs: bombs.length };
  });
  check("폭탄: 주변까지 터지고 짝 수는 그대로 맞음", bomb.after < bomb.before - 2 && bomb.even, bomb);

  /* ---------- 진행: 시간 끝 · 클리어 · 저장 ---------- */
  const flow = await p.evaluate(() => {
    const S = window.Sichuan;
    S.startStage(3);
    S.skipIntro();
    S.setTime(0.01);
    S.update(0.1);
    const over = S.s.screen;
    const form = document.getElementById("over").classList.contains("hidden");
    S.startStage(4);
    S.skipIntro();
    const t0 = S.s.timeLeft;
    for (let i = 0; i < 400 && S.s.remain > 0; i += 1) {
      const pr = S.findPair();
      S.select(pr[0]);
      S.select(pr[1]);
    }
    const cleared = S.s.clearT >= 0;
    for (let i = 0; i < 90; i += 1) S.update(0.016);
    const shown = S.s.screen;
    const stars = document.querySelectorAll("#clear-stars i").length;
    const saved = JSON.parse(localStorage.getItem("sichuan-v2"));
    return { over, form, cleared, shown, stars, saved: saved.best["4"], t0 };
  });
  check("시간이 끝나면 실패 화면", flow.over === "over" && flow.form === false, flow.over);
  check("다 지우면 클리어 화면 · 별 · 저장", flow.cleared && flow.shown === "clear" && flow.saved && flow.saved.stars >= 1, flow.saved);

  const replay = await p.evaluate(() => {
    const S = window.Sichuan;
    const total = () => Object.values(S.save.best).reduce((a, b) => a + b.score, 0);
    const clear = (i) => {
      S.startStage(i);
      S.skipIntro();
      for (let k = 0; k < 400 && S.s.remain > 0; k += 1) {
        const pr = S.findPair();
        S.select(pr[0]);
        S.select(pr[1]);
      }
    };
    clear(5);
    const a = total();
    const items = JSON.stringify(S.save.items);
    clear(5);
    clear(5);
    const b = total();
    return { a, b, itemsSame: items === JSON.stringify(S.save.items) };
  });
  check("같은 판 되풀이로 총점 · 아이템이 불지 않음", replay.b - replay.a < 3000 && replay.itemsSame, replay);

  /* ---------- 아이템 ---------- */
  const items = await p.evaluate(() => {
    const S = window.Sichuan;
    S.save.items = { hint: 2, shuffle: 2, bolt: 2, clock: 2 };
    S.startStage(10);
    S.skipIntro();
    const r0 = S.s.remain;
    S.useItem("hint");
    const hint = S.s.hint;
    S.useItem("bolt");
    const bolt = S.s.remain === r0 - 2;
    const kinds0 = S.allTiles().map((t) => t.kind).sort().join();
    const pos0 = S.allTiles().map((t) => t.kind).join();
    S.useItem("shuffle");
    const kinds1 = S.allTiles().map((t) => t.kind).sort().join();
    const pos1 = S.allTiles().map((t) => t.kind).join();
    const tBefore = S.s.timeLeft;
    S.useItem("clock");
    const clock = S.s.timeLeft > tBefore + 19;
    S.save.items.bolt = 0;
    const r1 = S.s.remain;
    S.useItem("bolt");
    return { hint, bolt, shuffleKeep: kinds0 === kinds1, shuffleMoved: pos0 !== pos1, clock, empty: S.s.remain === r1 };
  });
  check("힌트 · 번개 · 섞기 · 시계가 제대로 작동", items.hint && items.bolt && items.shuffleKeep && items.shuffleMoved && items.clock, items);
  check("아이템이 0개면 안 써짐", items.empty);

  /* ---------- 타임어택 ---------- */
  const atk = await p.evaluate(() => {
    const S = window.Sichuan;
    S.startAttack();
    S.skipIntro();
    const first = S.s.timeLeft;
    for (let i = 0; i < 300 && S.s.attackLevel === 0; i += 1) {
      const pr = S.findPair();
      S.select(pr[0]);
      S.select(pr[1]);
    }
    const lvl = S.s.attackLevel;
    const remainNew = S.s.remain;
    const score = S.s.score;
    S.setTime(0.01);
    S.skipIntro();
    S.update(0.1);
    return { first, lvl, remainNew, score, screen: S.s.screen };
  });
  check("타임어택: 판을 비우면 다음 판 · 점수 유지 · 시간 끝나면 끝", atk.lvl === 1 && atk.remainNew > 0 && atk.score > 0 && atk.screen === "over", atk);
  const ghost = await p.evaluate(() => {
    const S = window.Sichuan;
    S.save.items.bolt = 3;
    S.startStage(10);
    S.skipIntro();
    const pr = S.findPair();
    S.select(pr[0]);
    S.useItem("bolt");
    const after = S.s;
    const sel = after.selected;
    const remain = after.remain;
    const mate = S.allTiles().find((t) => t.kind === pr[0].kind);
    if (mate) S.select(mate);
    const counts = {};
    S.allTiles().forEach((t) => {
      counts[t.kind] = (counts[t.kind] || 0) + 1;
    });
    return { sel, remain, after: S.s.remain, even: Object.values(counts).every((n) => n % 2 === 0) };
  });
  check("고른 패가 번개로 사라져도 짝이 안 어긋남", !ghost.sel && ghost.after === ghost.remain && ghost.even, ghost);
  check("오류 없음", p.errs.length === 0, p.errs.slice(0, 4));
  await p.context().close();

  /* ---------- 일시정지 ---------- */
  const z = await open({ viewport: { width: 390, height: 844 } });
  await z.click("#start-btn");
  await sleep(900);
  await z.click(".today-pause-btn");
  await sleep(150);
  const t1 = await z.evaluate(() => window.Sichuan.s.timeLeft);
  await sleep(600);
  const t2 = await z.evaluate(() => window.Sichuan.s.timeLeft);
  check("일시정지하면 시간이 멈춤", t1 === t2, { t1, t2 });
  await z.click("#today-pause-resume");
  await sleep(500);
  const t3 = await z.evaluate(() => window.Sichuan.s.timeLeft);
  check("이어하면 시간이 다시 감", t3 < t2, { t2, t3 });
  await z.context().close();

  /* ---------- 실제 손가락 ---------- */
  for (const [name, vp, st] of [
    ["폰", { width: 390, height: 844 }, 44],
    ["작은 폰", { width: 360, height: 640 }, 55],
    ["폰 눕힘", { width: 844, height: 390 }, 44],
    ["데스크톱", { width: 1280, height: 800 }, 30],
  ]) {
    const page = await open({ viewport: vp, hasTouch: vp.width < 1000, deviceScaleFactor: 2 });
    await page.click("#start-btn");
    await sleep(900);
    let s = await page.evaluate(() => window.Sichuan.s);
    const clickTile = async (t) => {
      const v = await page.evaluate(() => window.Sichuan.s);
      await page.mouse.click(v.ox + (t.x + 0.5) * v.cell, v.oy + (t.y + 0.5) * v.tileH);
    };
    const pair = await page.evaluate(() => window.Sichuan.findPair().map((t) => ({ x: t.x, y: t.y })));
    const r0 = s.remain;
    await clickTile(pair[0]);
    await sleep(40);
    const sel = (await page.evaluate(() => window.Sichuan.s)).selected;
    await clickTile(pair[1]);
    await sleep(120);
    s = await page.evaluate(() => window.Sichuan.s);
    check(`${name}: 손으로 눌러 짝 없애기`, sel && s.remain === r0 - 2, { sel, remain: s.remain });
    // 가장 큰 판 배치
    await page.evaluate((k) => window.Sichuan.startStage(k), st);
    await sleep(300);
    const lay = await page.evaluate(() => {
      const v = window.Sichuan.s;
      const R = (id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height };
      };
      const rects = { hud: R("hud"), time: R("time-row"), mode: R("mode-row"), items: R("items") };
      const pause = document.querySelector(".today-pause-btn");
      const mute = document.querySelector(".today-mute-btn, #today-mute, .mute-btn");
      const ov = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const pr = pause && pause.getBoundingClientRect();
      const mr = mute && mute.getBoundingClientRect();
      return {
        cell: v.cell,
        C: v.C,
        R: v.R,
        boardTop: v.oy,
        boardBottom: v.oy + v.boardH,
        boardLeft: v.ox,
        boardRight: v.ox + v.boardW,
        topMax: Math.max(rects.hud.bottom, rects.time.bottom, rects.mode.bottom),
        items: rects.items,
        pauseHitsHud: ov(pr, rects.hud) || ov(pr, rects.time),
        muteHitsHud: ov(mr, rects.hud) || ov(mr, rects.time),
        vw: innerWidth,
        vh: innerHeight,
        sw: document.documentElement.scrollWidth,
      };
    });
    const side = lay.items.bottom - lay.items.top > lay.items.right - lay.items.left;
    check(`${name}: 판이 화면 안 · 위아래 안 겹침`, lay.boardTop >= lay.topMax && lay.boardLeft >= 0 && lay.boardRight <= (side ? lay.items.left : lay.vw) && lay.boardBottom <= (side ? lay.vh : lay.items.top), lay);
    check(`${name}: 패 크기 손가락에 충분 (29px 이상)`, lay.cell >= 29, { cell: lay.cell, C: lay.C, R: lay.R });
    check(`${name}: 일시정지 · 소리 버튼이 안 겹침`, !lay.pauseHitsHud && !lay.muteHitsHud, { pause: lay.pauseHitsHud, mute: lay.muteHitsHud });
    check(`${name}: 가로 넘침 없음`, lay.sw <= lay.vw + 1, { sw: lay.sw });
    check(`${name}: 오류 없음`, page.errs.length === 0, page.errs.slice(0, 3));
    await page.context().close();
  }

  /* ---------- 폰 돌리기 ---------- */
  const q = await open({ viewport: { width: 390, height: 844 } });
  await q.click("#start-btn");
  await sleep(500);
  const a0 = await q.evaluate(() => {
    const S = window.Sichuan;
    const pr = S.findPair();
    S.select(pr[0]);
    S.select(pr[1]);
    return { C: S.s.C, R: S.s.R, remain: S.s.remain };
  });
  await q.setViewportSize({ width: 844, height: 390 });
  await sleep(300);
  const a1 = await q.evaluate(() => {
    const S = window.Sichuan;
    const G = S.grid();
    let ok = G.length === S.s.R && G[0].length === S.s.C;
    for (let y = 0; y < S.s.R; y += 1) for (let x = 0; x < S.s.C; x += 1) if (G[y][x] && (G[y][x].x !== x || G[y][x].y !== y)) ok = false;
    return { C: S.s.C, R: S.s.R, remain: S.s.remain, ok };
  });
  check("폰을 돌리면 판도 돌아감 · 패 그대로", a1.C === a0.R && a1.R === a0.C && a1.remain === a0.remain && a1.ok, { a0, a1 });
  await q.context().close();

  await browser.close();
  console.log(`\n결과: 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
