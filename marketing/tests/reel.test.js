"use strict";
/* PHASE 3 — 녹화 프로필 정적 검사 · 치트 옵션 거부 · 3D 녹화본 재고 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createFakeUpstash } = require("./fake-upstash");
const { createStore } = require("../core/store");
const { addClip, takeClip, availableClips, gameHash } = require("../core/clips");
const { assertNoCheats } = require("../renderers/reel/players/autopilot");

const ROOT = path.resolve(__dirname, "../..");
const PROFILES = path.join(ROOT, "marketing", "profiles");
const profiles = fs.readdirSync(PROFILES).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(PROFILES, f), "utf8")));

test("녹화 프로필: 대상 5개 · 필수 값 · 실제 게임 폴더 · 원본 40~60초", () => {
  assert.deepEqual(profiles.map((p) => p.id).sort(), ["claw-master", "dragon-statue", "lava-surfers", "reaction", "sky-island"]);
  for (const p of profiles) {
    assert.ok(fs.existsSync(path.join(ROOT, "games", p.id, "index.html")), `${p.id} 게임 폴더`);
    assert.equal(p.path, `/games/${p.id}/`);
    assert.ok(p.rawSec >= 40 && p.rawSec <= 60, `${p.id} rawSec`);
    assert.ok(["pc", "actions"].includes(p.runner), `${p.id} runner`);
    assert.equal(p.runner === "pc", p.needsGpu === true, `${p.id}: GPU 가 필요한 게임은 PC 에서`);
    assert.ok(fs.existsSync(path.join(ROOT, "marketing/renderers/reel/players", `${p.player}.js`)), `${p.id} 조종 코드`);
  }
});

test("녹화에 치트 옵션(god · noLava · ram)이 켜지지 않음", () => {
  for (const p of profiles.filter((x) => x.player === "autopilot")) {
    assert.doesNotThrow(() => assertNoCheats(p.autopilot.arg), p.id);
    assert.ok(p.autopilot.script.startsWith("scripts/") && fs.existsSync(path.join(ROOT, p.autopilot.script)), `${p.id} 봇 파일`);
  }
  assert.throws(() => assertNoCheats(true), /god/);
  assert.throws(() => assertNoCheats({ noLava: true }), /noLava/);
  assert.throws(() => assertNoCheats({ god: 1, ram: true }), /god, ram/);
  // 녹화 코드(주석 제외) 어디에도 치트를 켜거나 게임 상태를 바꾸는 점검용 도구가 없음
  const src = ["record.js", "players/autopilot.js", "players/claw-master.js", "players/reaction.js"]
    .map((f) => fs.readFileSync(path.join(ROOT, "marketing/renderers/reel", f), "utf8"))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /god\s*:\s*true|noLava\s*:\s*true|ram\s*:\s*true|aimAt|solo\(/);
});

test("3D 녹화본 재고: 지문이 같고 안 쓴 최신 것만, 한 번 쓰면 다시 안 나옴, 동시에 꺼내도 하나만", async () => {
  const fake = createFakeUpstash();
  const store = createStore({ url: fake.url, token: fake.token, fetchImpl: fake.fetchImpl });
  const base = { gameId: "lava-surfers", durationSec: 46, url: "https://blob.test/a.mp4" };
  const now = Date.parse("2026-11-09T09:00:00Z");
  await addClip(store, { ...base, id: "lava-old", gameHash: "OLD", recordedAt: "2026-11-08T09:00:00Z" });
  await addClip(store, { ...base, id: "lava-a", gameHash: "NEW", recordedAt: "2026-11-08T10:00:00Z" });
  await addClip(store, { ...base, id: "lava-b", gameHash: "NEW", recordedAt: "2026-11-08T11:00:00Z" });
  await assert.rejects(() => addClip(store, { ...base, id: "lava-http", gameHash: "NEW", recordedAt: "2026-11-08T11:00:00Z", url: "http://insecure/a.mp4" }), /https/);
  assert.deepEqual((await availableClips(store, "lava-surfers", "NEW", now)).map((c) => c.id), ["lava-b", "lava-a"]);
  const [x, y] = await Promise.allSettled([takeClip(store, "lava-surfers", "NEW", "c1", now), takeClip(store, "lava-surfers", "NEW", "c2", now)]);
  const got = [x, y].filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value.id);
  assert.equal(got.length, 1, "동시에 꺼내면 하나만 (다른 하나는 잠금에 막힘)");
  assert.equal(got[0], "lava-b");
  assert.equal((await takeClip(store, "lava-surfers", "NEW", "c3", now)).id, "lava-a");
  assert.equal(await takeClip(store, "lava-surfers", "NEW", "c4", now), null, "남은 건 옛 지문뿐");
  assert.equal(await takeClip(store, "lava-surfers", "NEW", "c5", now + 40 * 86400000), null);
});

test("게임 지문: 같은 폴더는 같은 값, 이상한 id 거부", () => {
  const a = gameHash(ROOT, "reaction");
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(gameHash(ROOT, "reaction"), a);
  assert.notEqual(gameHash(ROOT, "claw-master"), a);
  assert.throws(() => gameHash(ROOT, "../api"));
});
