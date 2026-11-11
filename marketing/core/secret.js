"use strict";
/*
 * 토큰 암호화 (AES-256-GCM) — 결정 5: 인스타 토큰은 60일마다 갱신되어 값이 바뀌므로 Redis 에 암호문으로 두고,
 * 열쇠 MKT_TOKEN_KEY 만 GitHub Secrets / 이 PC .env.local 에 둔다.
 */
const crypto = require("crypto");

function key(env = process.env) {
  const s = env.MKT_TOKEN_KEY || "";
  if (s.length < 32) throw new Error("MKT_TOKEN_KEY 가 없거나 너무 짧습니다 (32자 이상).");
  return crypto.createHash("sha256").update(s).digest();
}

function encrypt(text, env) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(env), iv);
  const body = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

function decrypt(packed, env) {
  const [v, iv, tag, body] = String(packed || "").split(".");
  if (v !== "v1" || !iv || !tag || !body) throw new Error("저장된 토큰 형식이 올바르지 않습니다.");
  const d = crypto.createDecipheriv("aes-256-gcm", key(env), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
}

module.exports = { encrypt, decrypt };
