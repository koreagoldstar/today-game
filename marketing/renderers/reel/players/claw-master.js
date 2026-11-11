"use strict";
/*
 * 인형뽑기 마스터: 실제 키 입력으로만 플레이한다 (Space 동전 · 내리기, A/D 좌우, W/S 앞뒤).
 * 게임 상태(집게 · 인형 위치)는 읽기만 한다. 점검 스크립트의 aimAt(집게 순간이동) · solo(기계 바꾸기)는 쓰지 않는다.
 * 노리는 인형: 가장 높이 쌓인 인형 (게임 메모: 위에 드러난 인형이 잘 뽑힘).
 */
const { sleep } = require("../io");

const PEEK = () => {
  const A = window.ClawMaster;
  if (!A || !A.sim) return null;
  const s = A.sim;
  return {
    screen: A.screen,
    phase: s.phase,
    cx: s.cx,
    cz: s.cz,
    dolls: s.dolls.map((d) => ({ x: d.x, y: d.y, z: d.z, held: !!d.held, kind: d.kind })),
    revealing: !!A.revealing(),
    coins: A.save.coins,
  };
};

async function hold(io, key, until, maxMs) {
  await io.keyboard.down(key);
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < maxMs && io.running()) {
      const s = await io.page.evaluate(PEEK);
      if (!s || s.phase !== "moving" || until(s)) return;
      await sleep(30);
    }
  } finally {
    await io.keyboard.up(key);
  }
}

module.exports = {
  id: "claw-master",
  needsCanvas: true,

  async start(io) {
    await io.page.waitForFunction(() => window.ClawMaster && window.ClawMaster.screen === "title", null, { timeout: 20000 });
    await sleep(600);
    await io.click("#play-btn");
    await sleep(800);
    const s = await io.page.evaluate(PEEK);
    if (!s || s.screen !== "play") return false;
    io.mark("start", "게임 시작", 0);
    return true;
  },

  async play(io) {
    let grabbed = false;
    while (io.running()) {
      const s = await io.page.evaluate(PEEK);
      if (!s) return;
      if (s.revealing) {
        io.mark("clear", "인형 획득!", 3);
        grabbed = false;
        await sleep(1500);
        await io.key("Space"); // 획득 창 닫기
        await sleep(500);
        continue;
      }
      if (s.phase === "idle") {
        if (grabbed) io.mark("miss", "아깝다", 1.5); // 잡았다가 놓침
        grabbed = false;
        await io.key("Space"); // 동전 넣기
        await sleep(350);
        continue;
      }
      if (s.phase === "moving") {
        const free = s.dolls.filter((d) => !d.held);
        if (!free.length) return;
        const t = free.reduce((a, b) => (b.y > a.y ? b : a));
        // 사람처럼 조금 어긋나게
        const tx = t.x + (Math.random() - 0.5) * 2.5;
        const tz = t.z + (Math.random() - 0.5) * 2.5;
        if (Math.abs(s.cx - tx) > 1.2) await hold(io, s.cx < tx ? "KeyD" : "KeyA", (q) => Math.abs(q.cx - tx) < 1.2 || (s.cx < tx ? q.cx > tx : q.cx < tx), 4000);
        await sleep(120);
        const s2 = await io.page.evaluate(PEEK);
        if (s2 && s2.phase === "moving" && Math.abs(s2.cz - tz) > 1.2) await hold(io, s2.cz < tz ? "KeyW" : "KeyS", (q) => Math.abs(q.cz - tz) < 1.2 || (s2.cz < tz ? q.cz > tz : q.cz < tz), 4000);
        await sleep(250);
        const s3 = await io.page.evaluate(PEEK);
        if (s3 && s3.phase === "moving") {
          await io.key("Space"); // 내리기
          io.mark("drop", "집게 내려간다", 1);
        }
        continue;
      }
      if (!grabbed && s.dolls.some((d) => d.held)) {
        grabbed = true;
        io.mark("near", "잡았다?!", 2);
      }
      await sleep(80);
    }
  },
};
