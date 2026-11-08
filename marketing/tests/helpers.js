"use strict";
/* 시험 준비: 가짜 Redis + 가짜 Source · Renderer · Copywriter + Mock 채널 + 조작 가능한 시계 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { createFakeUpstash } = require("./fake-upstash");
const { createStore } = require("../core/store");
const { createRegistry } = require("../core/registry");
const { createLogger } = require("../core/logger");
const { DEFAULTS, merge, validate } = require("../core/settings");
const { createApproval } = require("../core/approval");
const { registerChannels } = require("../channels");
const { createMockChannel } = require("../channels/mock");
const { utmLink } = require("../core/links");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "mkt-test-"));

/** Mock 채널을 감싸 실제로 몇 번 "올렸는지" 센다 */
function counting(channel) {
  const c = { ...channel, published: 0 };
  c.publish = async (item, opts) => {
    const r = await channel.publish(item, opts);
    c.published++;
    return r;
  };
  return c;
}

function makeCtx({ settings: patch = {}, sameBytes = false, failThreads = null, failInstagram = null, start = "2026-11-09T09:00:00+09:00" } = {}) {
  const fake = createFakeUpstash();
  const store = createStore({ url: fake.url, token: fake.token, fetchImpl: fake.fetchImpl });
  const registry = createRegistry();
  registerChannels(registry, {}); // 모두 mock
  const instagram = counting(createMockChannel("instagram", failInstagram ? { failWith: failInstagram } : {}));
  const threads = counting(createMockChannel("threads", failThreads ? { failWith: failThreads } : {}));
  registry.register("channel", "instagram", instagram);
  registry.register("channel", "threads", threads);

  registry.register("source", "fake", {
    collect: async () => ({ sourceType: "fake", sourceId: "demo-game", facts: { title: "데모 게임", url: "/games/demo/" }, assets: {} }),
  });
  let renders = 0;
  registry.register("renderer", "fake", {
    kinds: ["reel"],
    async render(source) {
      renders++;
      const file = path.join(TMP, `${crypto.randomBytes(4).toString("hex")}.mp4`);
      fs.writeFileSync(file, sameBytes ? "same-bytes" : crypto.randomBytes(64));
      return { kind: "reel", files: [{ role: "video", path: file }], meta: { title: source.facts.title, durationSec: 18 } };
    },
  });
  let copies = 0;
  registry.register("copywriter", "default", {
    async write({ source, channels }) {
      copies++;
      return Object.fromEntries(
        channels.map((ch) => [ch, { caption: `${source.facts.title} 한 판 어때요? (${copies})`, hashtags: ["#오늘의게임"], link: utmLink(source.facts.url, { channel: ch, kind: "reel", sourceId: source.sourceId }) }])
      );
    },
  });
  const events = [];
  registry.register("notifier", "default", { notify: async (event, doc) => void events.push({ event, id: doc && doc.id }) });
  registry.register("media", "default", { put: async (f) => ({ url: `https://media.test/${path.basename(f.path)}` }) });

  const settings = validate(merge(DEFAULTS, patch));
  let t = Date.parse(start);
  const clock = { now: () => t, set: (iso) => (t = Date.parse(iso)), add: (ms) => (t += ms) };
  const ctx = { store, registry, settings, logger: createLogger(store, { echo: false }), now: clock.now };
  const approval = createApproval({ store, settings, registry, now: clock.now });
  return { ctx, fake, store, registry, settings, clock, approval, events, instagram, threads, counts: () => ({ renders, copies }) };
}

const PLAN = { slot: "feed", sourceType: "fake", renderer: "fake", template: "t1", channels: ["instagram"], reason: "시험" };
const WHO = { by: "admin", via: "web" };

module.exports = { makeCtx, PLAN, WHO, TMP };
