"use strict";
/*
 * 사이트의 점검용 자동 조종 봇(scripts/*-autopilot.js)으로 플레이한다.
 * 봇은 입력 함수만 바꿔 끼우고 게임 규칙 · 물리 · 판정은 그대로 쓴다.
 * 규칙을 바꾸는 옵션(god · noLava · ram)은 녹화에 쓰지 않는다 — 켜져 있으면 녹화를 거부한다.
 *
 * 프로필 autopilot: { script, export, arg }   start: [{ click } | { call }]
 * 프로필 probe: 읽기 전용 상태 식 (page 에서 평가) → { state, score, hearts, ... }
 */
const path = require("path");
const { sleep } = require("../io");

const ROOT = path.resolve(__dirname, "../../../.."); // 저장소 맨 위 (players → reel → renderers → marketing → 위)
const CHEATS = ["god", "noLava", "ram"];

function assertNoCheats(arg) {
  if (arg === true) throw new Error("봇 인자 true(god 무적)는 녹화에 쓸 수 없습니다.");
  if (arg && typeof arg === "object") {
    const on = CHEATS.filter((k) => arg[k]);
    if (on.length) throw new Error(`규칙을 바꾸는 봇 옵션은 녹화에 쓸 수 없습니다: ${on.join(", ")}`);
  }
  return arg;
}

function create(profile) {
  const ap = profile.autopilot;
  assertNoCheats(ap.arg);
  const file = path.join(ROOT, ap.script);
  if (!file.startsWith(path.join(ROOT, "scripts"))) throw new Error("봇은 scripts/ 안의 파일만 씁니다.");
  const install = require(file)[ap.export];
  if (typeof install !== "function") throw new Error(`${ap.script} 에 ${ap.export} 가 없습니다.`);
  const peek = (io) => io.page.evaluate(profile.probe).catch(() => null);

  return {
    async start(io) {
      await io.page.evaluate(install, ap.arg);
      for (const step of profile.start) {
        if (step.click) await io.click(step.click, 8000);
        if (step.call) await io.page.evaluate(step.call);
        await sleep(step.waitMs || 400);
      }
      const t0 = Date.now();
      while (Date.now() - t0 < 15000) {
        const s = await peek(io);
        if (s && s.state === profile.playing) {
          io.mark("start", "게임 시작", 0);
          return true;
        }
        await sleep(150);
      }
      return false;
    },

    /** 봇이 플레이하는 동안 상태 변화를 하이라이트 후보로 기록 (읽기만) */
    async play(io) {
      let last = await peek(io);
      while (io.running()) {
        await sleep(250);
        const s = await peek(io);
        if (!s || !last) {
          last = s;
          continue;
        }
        if (s.score > last.score) io.mark("score", `+${Math.round(s.score - last.score)}`, Math.min(3, 1 + (s.score - last.score) / (profile.scoreUnit || 100)));
        if (s.hearts < last.hearts) io.mark("near", "부딪힘", 2);
        if (s.items > last.items) io.mark("combo", "획득", 1.5);
        // 상태 이름으로만 판단: 클리어 · 체크포인트 = 성공, 게임 오버 = 실패, 그 밖(일시정지 등)은 자막 없이
        if (s.state !== last.state) {
          if (s.state === profile.playing) io.mark("start", s.state, 0);
          else if (/over|fail|dead|caught|respawn|fall/i.test(s.state)) io.mark("fail", s.state, 2);
          else if (/clear|result|checkpoint|goal|win/i.test(s.state)) io.mark("clear", s.state, 2.5);
        }
        last = s;
      }
    },
  };
}

module.exports = { create, assertNoCheats, CHEATS };
