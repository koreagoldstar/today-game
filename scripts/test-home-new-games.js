/**
 * 홈 목록 — 새 게임 자리 점검
 *
 * 사용: npm run start 후 node scripts/test-home-new-games.js
 *
 * - 출시 30일 안의 게임: 플레이 수가 0 이어도 칸 맨 위 · 최신순
 * - 30일이 지나면: 플레이 수 순서로 돌아감 (안 하면 내려가고, 많이 하면 위에 남음)
 * - 날짜는 시계를 바꿔서, 플레이 수는 /api/plays 가짜 응답으로 시험
 */
"use strict";
const { chromium } = require("playwright");

const BASE = process.env.HOME_BASE || "http://localhost:3456";
const results = [];
const check = (name, ok, detail) => {
  results.push(!!ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
};

/** 오래된 게임은 플레이 수가 많고, 새 게임은 0 */
const PLAYS = { flappy: 50000, tetris: 40000, "zombie-run": 30000, "one-shot": 9000, "ocean-blaster": 20000 };

async function shelves(browser, today) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.route("**/api/**", (r) => {
    const body = /\/api\/plays/.test(r.request().url()) ? { plays: PLAYS, order: [] } : {};
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.addInitScript((iso) => {
    const Real = Date;
    const fixed = new Real(iso).getTime();
    class Fake extends Real {
      constructor(...a) {
        if (a.length) super(...a);
        else super(fixed);
      }
      static now() {
        return fixed;
      }
    }
    window.Date = Fake;
  }, `${today}T12:00:00+09:00`);
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(900);
  const out = await page.evaluate(() => {
    const o = {};
    for (const s of document.querySelectorAll("#catalog .cat-shelf, .catalog .cat-shelf")) {
      o[s.id.replace("cat-", "")] = [...s.querySelectorAll(".game-grid a.slot")].map((a) => a.getAttribute("href").split("/")[2]);
    }
    return o;
  });
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });

  const now = await shelves(browser, "2026-11-01");
  check("액션: 새 게임이 최신순으로 맨 위", now.action.slice(0, 3).join() === "oneshot-elite,sea-monster,ocean-blaster", now.action.slice(0, 5));
  check("아케이드: 새 게임이 맨 위", now.arcade[0] === "chick-defense-new" && now.arcade.slice(1, 3).sort().join() === "lava-surfers,sky-island" && now.arcade[3] === "dragon-statue", now.arcade.slice(0, 5));
  check("퍼즐: 새 게임이 맨 위", now.puzzle.slice(0, 2).sort().join() === "jelly-factory,magnet-mayhem" && now.puzzle[2] === "slime-lab", now.puzzle.slice(0, 4));
  check("스포츠: 새 게임이 맨 위", now.sports[0] === "jetski-race", now.sports.slice(0, 3));
  check("플레이 수 많은 옛 게임은 새 게임 아래", now.action.indexOf("one-shot") > now.action.indexOf("ocean-blaster"));

  const last = await shelves(browser, "2026-12-01");
  check("30일째: 아직 맨 위", last.action[0] === "oneshot-elite", last.action.slice(0, 3));
  const after = await shelves(browser, "2026-12-02");
  check("31일째: 플레이 수 없으면 내려감", after.action.indexOf("oneshot-elite") > after.action.indexOf("one-shot"), after.action.slice(0, 5));

  const later = await shelves(browser, "2027-01-15");
  check("한참 뒤: 플레이 수 많은 게임은 위에 남음", later.action[0] === "zombie-run" || later.action.indexOf("ocean-blaster") < 3, later.action.slice(0, 4));
  check("한참 뒤: 안 한 새 게임은 아래로", later.action.indexOf("sea-monster") > later.action.indexOf("one-shot"), later.action.slice(0, 6));

  await browser.close();
  const fail = results.filter((x) => !x).length;
  console.log(`\n${results.length - fail} / ${results.length} 통과`);
  process.exit(fail ? 1 : 0);
})();
