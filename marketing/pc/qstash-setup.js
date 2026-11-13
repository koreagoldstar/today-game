#!/usr/bin/env node
"use strict";
/*
 * GitHub 예약 실행이 붐빌 때 몇 시간씩 건너뛰는 문제 → Upstash QStash 예약이 GitHub 워크플로를 직접 깨운다 (workflow_dispatch).
 *   node marketing/pc/qstash-setup.js save <KEY>    환경 변수 SECRET_VALUE 의 값을 marketing/.env.local 의 KEY 로 저장 (값은 찍지 않음)
 *                                                   KEY: GH_DISPATCH_TOKEN (GitHub 세분화 토큰, 이 저장소 Actions 읽기·쓰기만) · QSTASH_TOKEN · QSTASH_URL(선택)
 *   node marketing/pc/qstash-setup.js check          두 토큰이 통하는지 확인 (GitHub 워크플로 목록 · QStash 예약 목록)
 *   node marketing/pc/qstash-setup.js create         예약 2개 만들기/덮어쓰기 — 게시 30분마다(13·43분) · 제작 매일 08:07(서울)
 *   node marketing/pc/qstash-setup.js test           지금 한 번 게시 실행을 깨움 (QStash 즉시 전달)
 *   node marketing/pc/qstash-setup.js list           QStash 예약 목록
 * 토큰은 이 PC 의 .env.local(git 제외)과 QStash 예약(전달 헤더)에만 남는다. 화면 · 로그에는 찍지 않는다.
 */
const fs = require("fs");
const path = require("path");
const { loadEnvFile } = require("../core/env");

const ENV_FILE = path.join(__dirname, "..", ".env.local");
const REPO = "koreagoldstar/today-game";
const JOBS = [
  { id: "todaygame-mkt-publish", workflow: "mkt-publish.yml", cron: "13,43 * * * *", what: "게시 · 텔레그램 답 처리 (30분마다)" },
  { id: "todaygame-mkt-produce", workflow: "mkt-produce.yml", cron: "7 23 * * *", what: "제작 (매일 08:07 서울 = 23:07 UTC)" },
];

loadEnvFile(ENV_FILE);
const secrets = () => [process.env.GH_DISPATCH_TOKEN, process.env.QSTASH_TOKEN, process.env.SECRET_VALUE].filter(Boolean);
const hide = (s) => secrets().reduce((t, x) => t.split(x).join("***"), String(s));
const qstashUrl = () => String(process.env.QSTASH_URL || "https://qstash.upstash.io").replace(/\/$/, "");
const need = (k) => {
  if (!process.env[k]) throw new Error(`${k} 가 없습니다. 먼저 save ${k}`);
  return process.env[k];
};

function save(key) {
  if (!["GH_DISPATCH_TOKEN", "QSTASH_TOKEN", "QSTASH_URL"].includes(key)) throw new Error("KEY 는 GH_DISPATCH_TOKEN · QSTASH_TOKEN · QSTASH_URL 중 하나");
  const v = String(process.env.SECRET_VALUE || "").trim();
  if (!v || /\s/.test(v)) throw new Error("값이 비었거나 공백이 들어 있습니다 (복사가 제대로 됐는지 확인).");
  if (key === "GH_DISPATCH_TOKEN" && !/^(github_pat_|ghp_)/.test(v)) throw new Error("GitHub 토큰 모양이 아닙니다 (github_pat_ 로 시작해야 함).");
  if (key === "QSTASH_URL" && !/^https:\/\/qstash[\w.-]*\.upstash\.io\/?$/.test(v)) throw new Error("QStash 주소 모양이 아닙니다.");
  const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith(`${key}=`)) : [];
  lines.push(`${key}=${v}`);
  fs.writeFileSync(ENV_FILE, lines.join("\n") + "\n");
  console.log(`${key} 저장함 (길이 ${v.length}, 앞 ${v.slice(0, 4)}…)`);
}

async function call(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  return { status: res.status, ok: res.ok, text: hide(text).slice(0, 300) };
}

const qHeaders = () => ({ Authorization: `Bearer ${need("QSTASH_TOKEN")}` });
const forward = () => ({
  "Content-Type": "application/json",
  "Upstash-Method": "POST",
  "Upstash-Retries": "2",
  "Upstash-Forward-Authorization": `Bearer ${need("GH_DISPATCH_TOKEN")}`,
  "Upstash-Forward-Accept": "application/vnd.github+json",
  "Upstash-Forward-X-GitHub-Api-Version": "2022-11-28",
  "Upstash-Forward-User-Agent": "todaygame-mkt-qstash",
});
const dispatchUrl = (wf) => `https://api.github.com/repos/${REPO}/actions/workflows/${wf}/dispatches`;

async function check() {
  const gh = await call(`https://api.github.com/repos/${REPO}/actions/workflows`, { headers: { Authorization: `Bearer ${need("GH_DISPATCH_TOKEN")}`, Accept: "application/vnd.github+json", "User-Agent": "todaygame-mkt-qstash" } });
  const names = gh.ok ? (gh.text.match(/mkt-(produce|publish)\.yml/g) || []).join(", ") : "";
  console.log(`GitHub 토큰: HTTP ${gh.status} ${gh.ok ? `워크플로 보임 (${names || "목록 일부만"})` : gh.text}`);
  const q = await call(`${qstashUrl()}/v2/schedules`, { headers: qHeaders() });
  console.log(`QStash 토큰: HTTP ${q.status} ${q.ok ? "통함" : q.text}`);
  if (!gh.ok || !q.ok) process.exitCode = 1;
}

async function create() {
  for (const j of JOBS) {
    const r = await call(`${qstashUrl()}/v2/schedules/${dispatchUrl(j.workflow)}`, { method: "POST", headers: { ...qHeaders(), ...forward(), "Upstash-Cron": j.cron, "Upstash-Schedule-Id": j.id }, body: JSON.stringify({ ref: "master" }) });
    console.log(`${j.id} (${j.what}): HTTP ${r.status} ${r.text}`);
    if (!r.ok) process.exitCode = 1;
  }
}

async function test() {
  const r = await call(`${qstashUrl()}/v2/publish/${dispatchUrl("mkt-publish.yml")}`, { method: "POST", headers: { ...qHeaders(), ...forward() }, body: JSON.stringify({ ref: "master" }) });
  console.log(`지금 한 번 게시 실행 깨우기: HTTP ${r.status} ${r.text}`);
  if (!r.ok) process.exitCode = 1;
}

async function list() {
  const r = await call(`${qstashUrl()}/v2/schedules`, { headers: qHeaders() });
  if (!r.ok) return console.log(`HTTP ${r.status} ${r.text}`);
  const res = await fetch(`${qstashUrl()}/v2/schedules`, { headers: qHeaders() }).then((x) => x.json());
  for (const s of res) console.log(`${s.scheduleId} · ${s.cron} · ${String(s.destination).replace(/^https:\/\/api\.github\.com\/repos\//, "")} · ${s.isPaused ? "멈춤" : "켜짐"}`);
}

const [cmd, arg] = process.argv.slice(2);
const run = { save: () => save(arg), check, create, test, list }[cmd];
if (!run) {
  console.error("명령: save <KEY> | check | create | test | list");
  process.exit(2);
}
Promise.resolve(run()).catch((e) => {
  console.error(`실패: ${hide(e.message)}`);
  process.exit(1);
});
