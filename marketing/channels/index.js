"use strict";
/*
 * 채널 등록 — CHANNEL_MODE_{채널}=mock|live (기본 mock). live 는 관리자가 직접 켠다.
 * live 어댑터 파일이 아직 없으면 조용히 mock 으로 바꾸지 않고 오류로 멈춘다 (실제로 게시된 줄 착각하지 않게).
 */
const fs = require("fs");
const path = require("path");
const { CAPS } = require("./caps");
const { createMockChannel } = require("./mock");

function channelMode(name, env = process.env) {
  const v = String(env[`CHANNEL_MODE_${name.toUpperCase()}`] || "mock").toLowerCase();
  if (v !== "mock" && v !== "live") throw new Error(`CHANNEL_MODE_${name.toUpperCase()} 는 mock 또는 live 입니다.`);
  return v;
}

function registerChannels(registry, env = process.env, { store = null } = {}) {
  const modes = {};
  for (const name of Object.keys(CAPS)) {
    modes[name] = channelMode(name, env);
    if (modes[name] === "mock") {
      registry.register("channel", name, createMockChannel(name));
      continue;
    }
    const file = path.join(__dirname, `${name}.js`);
    if (!fs.existsSync(file)) throw new Error(`${name} 실제 연결(live)은 아직 구현되지 않았습니다. CHANNEL_MODE_${name.toUpperCase()}=mock 으로 두세요.`);
    registry.register("channel", name, require(file).create({ env, store }));
  }
  return modes;
}

module.exports = { registerChannels, channelMode };
