"use strict";
/*
 * 메모리 속 Upstash Redis (REST 흉내) — 시험과 저장소 없이 해 보는 시험 제작(make.js) 용. 운영 저장소 대신 쓴다.
 * 요청마다 0~3ms 쉬어서 동시 실행이 실제처럼 엇갈리게 한다. 받은 키를 모두 기록(keysSeen)해 앞머리 검사에 쓴다.
 */

function createFakeUpstash({ jitter = true } = {}) {
  const data = new Map(); // key → { t: "s"|"z"|"l"|"set"|"h", v, exp }
  const keysSeen = new Set();
  const alive = (k) => {
    const e = data.get(k);
    if (e && e.exp && e.exp < Date.now()) {
      data.delete(k);
      return null;
    }
    return e || null;
  };
  const of = (k, t, init) => {
    let e = alive(k);
    if (!e) data.set(k, (e = { t, v: init(), exp: 0 }));
    if (e.t !== t) throw new Error("WRONGTYPE");
    return e;
  };

  function exec([op, ...a]) {
    op = String(op).toUpperCase();
    if (a[0] !== undefined && op !== "MGET") keysSeen.add(a[0]);
    if (op === "MGET") a.forEach((k) => keysSeen.add(k));
    switch (op) {
      case "GET": {
        const e = alive(a[0]);
        return e && e.t === "s" ? e.v : null;
      }
      case "SET": {
        const nx = a.includes("NX");
        const ex = a.indexOf("EX");
        if (nx && alive(a[0])) return null;
        data.set(a[0], { t: "s", v: String(a[1]), exp: ex > 0 ? Date.now() + Number(a[ex + 1]) * 1000 : 0 });
        return "OK";
      }
      case "INCR": {
        const e = alive(a[0]);
        const n = (e && e.t === "s" ? Number(e.v) : 0) + 1;
        data.set(a[0], { t: "s", v: String(n), exp: e ? e.exp : 0 });
        return n;
      }
      case "DEL":
        return a.reduce((n, k) => n + (data.delete(k) ? 1 : 0), 0);
      case "MGET":
        return a.map((k) => {
          const e = alive(k);
          return e && e.t === "s" ? e.v : null;
        });
      case "EXPIRE": {
        const e = alive(a[0]);
        if (!e) return 0;
        e.exp = Date.now() + Number(a[1]) * 1000;
        return 1;
      }
      case "ZADD": {
        const e = of(a[0], "z", () => new Map());
        e.v.set(String(a[2]), Number(a[1]));
        return 1;
      }
      case "ZREVRANGE": {
        const e = alive(a[0]);
        if (!e) return [];
        const ids = [...e.v.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? 1 : -1)).map((x) => x[0]);
        const stop = Number(a[2]);
        return ids.slice(Number(a[1]), stop < 0 ? ids.length + stop + 1 : stop + 1);
      }
      case "ZRANGEBYSCORE": {
        const e = alive(a[0]);
        if (!e) return [];
        const num = (x) => (x === "+inf" ? Infinity : x === "-inf" ? -Infinity : Number(x));
        return [...e.v.entries()].filter(([, s]) => s >= num(a[1]) && s <= num(a[2])).sort((x, y) => x[1] - y[1]).map((x) => x[0]);
      }
      case "ZREM": {
        const e = alive(a[0]);
        return e ? a.slice(1).reduce((n, m) => n + (e.v.delete(String(m)) ? 1 : 0), 0) : 0;
      }
      case "LPUSH": {
        const e = of(a[0], "l", () => []);
        e.v.unshift(...a.slice(1).reverse());
        return e.v.length;
      }
      case "LTRIM": {
        const e = alive(a[0]);
        if (e) e.v = e.v.slice(Number(a[1]), Number(a[2]) + 1);
        return "OK";
      }
      case "LRANGE": {
        const e = alive(a[0]);
        return e ? e.v.slice(Number(a[1]), Number(a[2]) < 0 ? undefined : Number(a[2]) + 1) : [];
      }
      case "SADD": {
        const e = of(a[0], "set", () => new Set());
        let n = 0;
        for (const m of a.slice(1)) if (!e.v.has(m)) e.v.add(m), n++;
        return n;
      }
      case "SREM": {
        const e = alive(a[0]);
        return e ? a.slice(1).reduce((n, m) => n + (e.v.delete(m) ? 1 : 0), 0) : 0;
      }
      case "SMEMBERS": {
        const e = alive(a[0]);
        return e ? [...e.v] : [];
      }
      default:
        throw new Error(`가짜 Redis 가 모르는 명령: ${op}`);
    }
  }

  const wait = () => new Promise((r) => setTimeout(r, jitter ? Math.random() * 3 : 0));
  const reply = (body) => ({ ok: true, status: 200, json: async () => body });
  const one = (cmd) => {
    try {
      return { result: exec(cmd) };
    } catch (e) {
      return { error: e.message };
    }
  };

  async function fetchImpl(url, init) {
    await wait();
    const body = JSON.parse(init.body);
    return reply(String(url).endsWith("/pipeline") ? body.map(one) : one(body));
  }

  return { fetchImpl, data, keysSeen, url: "https://fake-upstash.test", token: "fake-token-for-tests" };
}

module.exports = { createFakeUpstash };
