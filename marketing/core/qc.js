"use strict";
/*
 * 자동 검수 — 잴 수 있는 것만, 통과/실패 + 사유. 하나라도 실패하면 불합격.
 * 공통: 결과 파일 · 직전 콘텐츠와 다른 파일 · 게임명(원본과 같음) · 채널별 문구 · 글자 수 · 해시태그 수 · 형식 · 링크 · 영상 길이/크기 · 허용 음원 · 폰트
 * 형식별(영상 검은 화면 · 멈춤 등)은 renderer.qc() 가 더한다.
 */
const fs = require("fs");
const crypto = require("crypto");
const { SITE } = require("./links");

const sha256File = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

async function runQc(doc, { registry, store, settings }) {
  const checks = [];
  const add = (id, name, ok, reason) => checks.push({ id, name, ok: !!ok, reason: ok ? "" : reason });
  const r = doc.render || {};
  const files = r.files || [];
  const meta = r.meta || {};

  const okFiles = files.length > 0 && files.every((f) => f.path && fs.existsSync(f.path) && fs.statSync(f.path).size > 0);
  add("files", "결과 파일", okFiles, "결과 파일이 없거나 비어 있음");
  for (const f of files) {
    if (f.path && fs.existsSync(f.path)) Object.assign(f, { sha256: sha256File(f.path), bytes: fs.statSync(f.path).size });
  }

  const recent = (await store.listContents(30)).filter((d) => d.id !== doc.id);
  const seen = new Set(recent.flatMap((d) => ((d.render && d.render.files) || []).map((f) => f.sha256)).filter(Boolean));
  const dup = files.find((f) => f.sha256 && seen.has(f.sha256));
  add("duplicate", "직전 콘텐츠와 다른 파일", !dup, dup && `같은 파일이 이미 있음 (${dup.role || dup.path})`);

  const facts = (doc.source && doc.source.facts) || {};
  if (facts.title && meta.title !== undefined) add("title", "화면 속 이름이 원본과 같음", meta.title === facts.title, `화면 "${meta.title}" · 원본 "${facts.title}"`);

  const allow = settings.allow || {};
  for (const a of meta.audio || []) add(`audio:${a}`, "허용된 음원", (allow.audio || []).includes(a), `허용 목록에 없는 음원: ${a}`);
  for (const f of meta.fonts || []) add(`font:${f}`, "허용된 폰트", (allow.fonts || []).includes(f), `허용 목록에 없는 폰트: ${f}`);

  for (const ch of doc.channels || []) {
    const caps = registry.get("channel", ch).capabilities();
    const c = doc.copy && doc.copy[ch];
    add(`kind:${ch}`, `${ch} 가 받는 형식`, caps.kinds.includes(r.kind), `${ch} 는 ${r.kind} 를 올릴 수 없음`);
    add(`copy:${ch}`, `${ch} 문구`, c && String(c.caption || "").trim(), "문구 없음");
    if (!c) continue;
    const text = [c.caption, (c.hashtags || []).join(" ")].filter(Boolean).join("\n\n");
    add(`chars:${ch}`, `${ch} 글자 수`, text.length <= caps.caption.maxChars, `${text.length}자 (최대 ${caps.caption.maxChars}자)`);
    const tags = (text.match(/#[^\s#]+/gu) || []).length;
    add(`tags:${ch}`, `${ch} 해시태그 수`, tags <= caps.caption.maxHashtags, `${tags}개 (최대 ${caps.caption.maxHashtags}개)`);
    if (c.link) add(`link:${ch}`, `${ch} 링크가 사이트 주소`, String(c.link).startsWith(`${SITE}/`), `사이트 밖 주소: ${c.link}`);
    if (caps.video && meta.durationSec != null) {
      add(`len:${ch}`, `${ch} 영상 길이`, meta.durationSec >= caps.video.minSec && meta.durationSec <= caps.video.maxSec, `${meta.durationSec}초 (${caps.video.minSec}~${caps.video.maxSec}초)`);
      const big = files.find((f) => f.bytes > caps.video.maxBytes);
      add(`size:${ch}`, `${ch} 파일 크기`, !big, big && `${big.bytes} 바이트`);
    }
  }

  const renderer = r.renderer && registry.has("renderer", r.renderer) ? registry.get("renderer", r.renderer) : null;
  if (renderer && typeof renderer.qc === "function") {
    for (const c of await renderer.qc(r, { doc, settings })) add(c.id, c.name, c.ok, c.reason);
  }

  return { passed: checks.every((c) => c.ok), checks, at: new Date().toISOString() };
}

module.exports = { runQc, sha256File };
