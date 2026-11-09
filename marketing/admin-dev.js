#!/usr/bin/env node
"use strict";
/*
 * 웹 관리자를 이 PC 에서만 시험하는 서버 (운영 배포 없이).
 *   node marketing/admin-dev.js [--port 8787] [--empty]
 *  - 운영 저장소(.env.local 의 Upstash)는 **읽기만** 해서 최근 콘텐츠 · 설정을 메모리 저장소로 복사한다.
 *    화면에서 승인 · 반려 등을 눌러도 메모리에만 반영되고 운영 데이터 · 텔레그램 · 채널에는 아무 일도 없다.
 *  - 관리자 키는 실행할 때마다 새로 만들어 marketing/out/admin-dev-key.txt (git 제외)에만 적는다.
 *  - 화면(mkt-admin/)과 API(api/mkt-admin.js 와 같은 core/admin.js)를 같은 주소에서 낸다.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { loadEnvFile } = require("./core/env");
const { createFakeUpstash } = require("./core/memory-redis");
const { createStore } = require("./core/store");
const { createAdmin } = require("./core/admin");
const { createRegistry } = require("./core/registry");
const { registerChannels } = require("./channels");
const { writeSnapshot } = require("./core/snapshot");

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const port = Number(argv.includes("--port") ? argv[argv.indexOf("--port") + 1] : 8787);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

(async () => {
  loadEnvFile(path.join(__dirname, ".env.local"));
  const mem = createFakeUpstash({ jitter: false });
  const store = createStore({ url: mem.url, token: mem.token, fetchImpl: mem.fetchImpl });
  if (!argv.includes("--empty") && (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)) {
    const real = createStore();
    const docs = await real.listContents(60); // GET 만
    for (const d of docs.reverse()) await store.saveContent(d);
    const settings = await real.getJson("settings");
    if (settings) await store.setJson("settings", settings);
    for (const s of ((await real.run("LRANGE", "logs", 0, 99)) || []).reverse()) await store.run("LPUSH", "logs", s);
    console.log(`운영 저장소에서 읽어 메모리로 복사: 콘텐츠 ${docs.length}개 (운영 데이터는 바꾸지 않음)`);
  }
  const registry = createRegistry();
  registerChannels(registry, {}); // 모두 mock
  await writeSnapshot({ store, registry });

  const key = crypto.randomBytes(18).toString("base64url"); // 24자
  fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "out", "admin-dev-key.txt"), key + "\n");
  const admin = createAdmin({ store, env: { MKT_ADMIN_KEY: key } });

  http
    .createServer(async (req, res) => {
      const u = new URL(req.url, `http://localhost:${port}`);
      if (u.pathname === "/api/mkt-admin") {
        let raw = "";
        for await (const c of req) raw += c;
        let body = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch (_) {}
        const out = await admin.handle({ method: req.method, query: Object.fromEntries(u.searchParams), body, headers: req.headers, ip: req.socket.remoteAddress });
        res.writeHead(out.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify(out.body));
        return;
      }
      const rel = u.pathname === "/" ? "/mkt-admin/index.html" : u.pathname.endsWith("/") ? `${u.pathname}index.html` : u.pathname;
      const file = path.join(ROOT, decodeURIComponent(rel));
      if (!file.startsWith(path.join(ROOT, "mkt-admin")) || !fs.existsSync(file)) {
        res.writeHead(404).end("없음");
        return;
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
    })
    .listen(port, () => console.log(`웹 관리자 시험: http://localhost:${port}/mkt-admin/  (키: marketing/out/admin-dev-key.txt)`));
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
