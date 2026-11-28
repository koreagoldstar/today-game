"use strict";
/* 바다 물총 대작전: 날아오는 공 → 아이템 → 약점 → 보스 → 가까운 친구 순으로 조준하고 누른 채 연사 */
const { sleep } = require("../io");

/* 녹화 브라우저 안에서만 쓰는 읽기 전용 상태 창 */
function peek() {
  const g = window.OceanBlaster;
  const cv = document.getElementById("game");
  const rc = cv.getBoundingClientRect();
  const H = (540 * rc.height) / rc.width;
  const ev = window.__obEv ? window.__obEv.splice(0) : [];
  if (!g || g.state !== "play" || !g.run) return { state: g ? g.state : "none", H, ev };
  let best = null;
  let bs = -1e9;
  const consider = (x, y, pri) => {
    if (y < 235 || y > H - 40 || x < 10 || x > 530) return;
    if (pri > bs) {
      bs = pri;
      best = { x, y };
    }
  };
  for (const s of g.shots) if (s.targetable) consider(s.sx, s.sy, 300 + (s.danger ? 100 : 0) + s.sy * 0.05);
  for (const it of g.items) if (it.targetable) consider(it.sx, it.sy, 250);
  if (g.boss && g.boss.alive) {
    for (const c of g.boss.hitCircles()) consider(c.x, c.y, c.weak ? 220 : 150);
  }
  for (const e of g.enemies) {
    if (!e.targetable) continue;
    const w = e.weakPointScreen();
    if (w) consider(w.x, w.y, 120 + e.z * 40);
    consider(e.hx, e.hy, 100 + e.z * 40 - Math.abs(e.hx - 270) * 0.02);
  }
  return {
    state: g.state,
    H,
    tgt: best,
    score: g.score.score,
    combo: g.score.combo.count,
    perfects: g.score.perfects,
    hearts: g.hearts,
    boss: g.boss ? +(g.boss.hp / g.boss.maxHp).toFixed(2) : null,
    ev,
  };
}

/* 게임 안에서 일어난 일 엿듣기 (원래 동작 그대로 · 기록만) */
function listen() {
  const g = window.OceanBlaster;
  if (!g || g.__reelHooked) return;
  g.__reelHooked = true;
  const ev = (window.__obEv = []);
  const wrap = (name, fn) => {
    if (typeof g[name] !== "function") return;
    const orig = g[name].bind(g);
    g[name] = (...a) => {
      try {
        fn(...a);
      } catch (_) {}
      return orig(...a);
    };
  };
  wrap("onSoak", (e) => ev.push(["soak", e.d && e.d.name]));
  wrap("collectItem", (it) => ev.push(["item", it && it.id]));
  wrap("startBoss", () => ev.push(["boss", "보스"]));
  wrap("bossDefeated", () => ev.push(["bossDown", "보스 격파"]));
  wrap("stageClear", () => ev.push(["clear", "클리어"]));
  wrap("hurt", () => ev.push(["fail", "아야"]));
}

module.exports = {
  id: "ocean-blaster",
  level: "medium",
  strategy: "B",
  genre: "action",
  hashtags: ["#바다물총대작전", "#물총게임", "#어린이게임"],
  hooks: ["바다 친구들 흠뻑 적시기!", "물총 손맛 미쳤다", "몇 마리나 적실까?"],
  captions: {
    score: ["흠뻑!", "명중!", "첨벙!"],
    combo: ["콤보 폭발!", "연속 명중!"],
    perfect: ["PERFECT!", "한가운데 명중!"],
    item: ["아이템 획득!", "물폭탄 쾅!"],
    boss: ["보스 등장!"],
    clear: ["스테이지 클리어!", "바다 정복!"],
  },
  thumbText: ["물총 손맛 최고", "바다 친구 적시기"],

  async start(io) {
    const page = io.page;
    await page.waitForSelector("#start-btn", { state: "visible", timeout: 10000 });
    await sleep(900);
    // 처음 하는 사람 안내는 건너뛴다 (녹화 브라우저의 이 판에서만)
    await page.evaluate(() => {
      window.OceanBlaster.save.data.tutorial = true;
    });
    await page.evaluate(listen);
    await page.evaluate(`window.__reel = { peek: ${peek} };`);
    await page.locator("#start-btn").click({ force: true, timeout: 4000 }); // 흔들리는 버튼
    io.mark("start", "출항", 0);
    for (let i = 0; i < 30; i++) {
      const s = await io.peek();
      if (s && s.state === "play") return true;
      await sleep(200);
    }
    return false;
  },

  async play(io) {
    const page = io.page;
    let down = false;
    let lastCombo = 0;
    let lastPerf = 0;
    let endAt = 0;
    let wob = 0;
    while (io.running()) {
      const s = await io.peek();
      if (!s) break;
      for (const [type, label] of s.ev || []) {
        if (type === "soak") io.mark("score", label || "흠뻑", 1.3);
        else if (type === "item") io.mark("item", "아이템", 2);
        else if (type === "boss") io.mark("boss", label, 4);
        else if (type === "bossDown") io.mark("clear", label, 4);
        else if (type === "clear") {
          io.mark("clear", label, 3.5);
          endAt = Date.now() + 2500;
        } else if (type === "fail") io.mark("fail", label, 0.8);
      }
      if (s.combo >= 5 && lastCombo < 5) io.mark("combo", "콤보 5", 2.2);
      if (s.combo >= 10 && lastCombo < 10) io.mark("combo", "콤보 10", 2.8);
      if (s.combo >= 20 && lastCombo < 20) io.mark("combo", "콤보 20", 3.2);
      lastCombo = s.combo || 0;
      if (s.perfects > lastPerf) io.mark("perfect", "PERFECT", 2.2);
      lastPerf = s.perfects || 0;
      if (endAt && Date.now() > endAt) break;
      if (s.state !== "play") {
        if (down) {
          await page.mouse.up();
          down = false;
        }
        await sleep(150);
        continue;
      }
      wob += 0.15;
      const tx = s.tgt ? s.tgt.x : 270 + Math.sin(wob) * 120;
      const ty = s.tgt ? s.tgt.y : 420 + Math.cos(wob * 0.7) * 60;
      const p = await io.at(tx, ty, { selector: "#game", W: 540, H: s.H });
      await page.mouse.move(p.x, p.y, { steps: 2 });
      if (!down) {
        await page.mouse.down();
        down = true;
      }
      await sleep(30);
    }
    if (down) await page.mouse.up().catch(() => {});
  },
};
