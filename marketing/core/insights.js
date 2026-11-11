"use strict";
/*
 * 성과 (PHASE 10) — 플랫폼이 실제로 주는 숫자만. 모의(Mock) 게시는 지표가 없으므로 모으지 않고 지어내지 않는다.
 *  - 게시 1일 · 3일 · 7일 뒤 지표 (doc.insights[채널] = { metrics, at, checkpoints: { 1: {at, metrics}, … } })
 *  - 팔로워 수: 하루 한 번 (followers:{채널}:{서울 날짜}) — 실제 연결된 채널만
 *  - 주간 요약: 월요일 아침 지난주(월~일) — 텔레그램 + report:weekly (웹 관리자 "성과")
 *  - 성과 가중치: 게임별 평균 조회 수 ÷ 전체 평균, settings.weights 범위(기본 0.5~2배)로 게임 고르기 점수에 곱함
 */
const { seoulDay, seoulWeekday, atSeoul } = require("./settings");
const { weekIdOf } = require("../sources/ranking");

const DAY = 86400000;
const CHECKS = [1, 3, 7];
const CH_KO = { instagram: "인스타", threads: "Threads", facebook: "Facebook", youtube: "YouTube" };

const liveChannel = (registry, ch) => registry.has("channel", ch) && !registry.get("channel", ch).mock ? registry.get("channel", ch) : null;

async function collectInsights(ctx, now = Date.now()) {
  const { store, registry, logger } = ctx;
  const out = [];
  for (const d of await store.listContents(200)) {
    for (const [ch, p] of Object.entries(d.posts || {})) {
      if (!p || p.status !== "PUBLISHED" || p.mock || !p.platformId || !p.publishedAt) continue;
      const channel = liveChannel(registry, ch);
      if (!channel || typeof channel.insights !== "function") continue;
      const age = (now - Date.parse(p.publishedAt)) / DAY;
      const done = (d.insights && d.insights[ch] && d.insights[ch].checkpoints) || {};
      const due = CHECKS.filter((k) => age >= k && !done[k]);
      if (!due.length) continue;
      let metrics;
      let unavailable = null;
      try {
        metrics = await channel.insights(p.platformId);
      } catch (e) {
        if (logger) await logger.warn(`${d.id} ${ch} 지표 수집 실패: ${e.message}`);
        if (e.kind !== "PERMISSION") continue; // 일시 오류는 다음 실행에서 다시
        // 권한이 없으면(예: 통합 로그인 구성에 instagram_manage_insights 없음) 다시 물어도 같음 → 그 시점은 "제공 안 됨"으로 기록
        metrics = [];
        unavailable = String(e.message).slice(0, 200);
      }
      const at = new Date(now).toISOString();
      await store.updateContent(d.id, (x) => {
        x.insights = x.insights || {};
        const cur = x.insights[ch] || { checkpoints: {} };
        for (const k of due) cur.checkpoints[k] = { at, metrics, ...(unavailable ? { unavailable } : {}) };
        Object.assign(cur, { metrics, at, unavailable });
        x.insights[ch] = cur;
      });
      out.push({ id: d.id, channel: ch, days: due, metrics: metrics.length });
    }
  }
  return out;
}

async function recordFollowers(ctx, now = Date.now()) {
  const { store, registry } = ctx;
  const day = seoulDay(now);
  const out = {};
  for (const ch of registry.names("channel")) {
    const channel = liveChannel(registry, ch);
    if (!channel || typeof channel.followers !== "function") continue;
    try {
      const n = await channel.followers();
      if (!Number.isFinite(n)) continue;
      await store.setJson(`followers:${ch}:${day}`, { n, at: new Date(now).toISOString() }, { ex: 400 * 86400 });
      out[ch] = n;
    } catch (_) {}
  }
  return out;
}

const viewsOf = (d) => Object.values(d.insights || {}).reduce((s, x) => s + ((x.metrics || []).find((m) => m.metric === "views") || { value: 0 }).value, 0);
const measured = (d) => Object.values(d.insights || {}).some((x) => (x.metrics || []).some((m) => m.metric === "views"));

/** 게임별 성과 가중치 { 게임 id: 배수 } — 실제 조회 수가 있는 게임만 */
function performanceWeights(contents, settings) {
  const { min = 0.5, max = 2 } = settings.weights || {};
  const games = contents.filter((d) => d.status === "PUBLISHED" && d.source && ["game", "new-game"].includes(d.source.sourceType) && measured(d));
  if (!games.length) return {};
  const all = games.reduce((s, d) => s + viewsOf(d), 0) / games.length;
  if (!(all > 0)) return {};
  const by = {};
  for (const d of games) (by[d.source.sourceId] = by[d.source.sourceId] || []).push(viewsOf(d));
  return Object.fromEntries(Object.entries(by).map(([id, v]) => [id, +Math.min(max, Math.max(min, v.reduce((a, b) => a + b, 0) / v.length / all)).toFixed(2)]));
}

/** 월요일: 지난주(월 00:00 ~ 일 24:00, 서울) 요약. 이미 보낸 주는 null */
async function weeklyReport(ctx, now = Date.now()) {
  const { store, registry, settings } = ctx;
  if (seoulWeekday(now) !== "mon") return null;
  const end = atSeoul(seoulDay(now), "00:00");
  const start = end - 7 * DAY;
  const week = weekIdOf(start + DAY);
  if (!(await store.setJson(`report:sent:${week}`, 1, { nx: true, ex: 30 * 86400 }))) return null;
  const list = await store.listContents(200);
  const posted = list.filter((d) => Object.values(d.posts || {}).some((p) => p && p.status === "PUBLISHED" && Date.parse(p.publishedAt) >= start && Date.parse(p.publishedAt) < end));
  const posts = posted.flatMap((d) => Object.entries(d.posts).filter(([, p]) => p.status === "PUBLISHED").map(([ch, p]) => ({ ch, mock: !!p.mock })));
  const real = posts.filter((p) => !p.mock);
  const byCh = {};
  for (const p of posts) byCh[p.ch] = (byCh[p.ch] || 0) + 1;
  const clicks = (await store.mget(posted.map((d) => `clicks:${d.id}`))).reduce((s, x) => s + Number(x || 0), 0);
  const best = posted.filter(measured).sort((a, b) => viewsOf(b) - viewsOf(a))[0];
  const views = posted.reduce((s, d) => s + viewsOf(d), 0);
  const made = list.filter((d) => Date.parse(d.createdAt) >= start && Date.parse(d.createdAt) < end);
  const count = (st) => made.filter((d) => d.status === st).length;
  const lines = [
    `📊 지난주 홍보 요약 (${week} · ${seoulDay(start).slice(5)}~${seoulDay(end - 1).slice(5)})`,
    `게시 ${posted.length}건 — 실제 ${real.length} · 모의 ${posts.length - real.length} (${Object.entries(byCh).map(([c, n]) => `${CH_KO[c] || c} ${n}`).join(", ") || "-"})`,
    real.length ? `조회 합계 ${views.toLocaleString("ko-KR")}${best ? ` · 가장 많이 본 콘텐츠: ${best.render.meta.title} (${viewsOf(best).toLocaleString("ko-KR")})` : " · 아직 지표 없음"}` : "지표: 실제 게시가 없어 없음 (모의 게시는 지표가 없습니다)",
    settings.trackClicks ? `사이트로 넘어온 클릭 ${clicks.toLocaleString("ko-KR")}` : "사이트 클릭: 세기 꺼짐 (api/mkt-go 배포 뒤 켤 수 있음)",
  ];
  const fol = [];
  for (const ch of registry.names("channel")) {
    const a = await store.getJson(`followers:${ch}:${seoulDay(start)}`);
    const b = await store.getJson(`followers:${ch}:${seoulDay(end - 1)}`);
    if (b) fol.push(`${CH_KO[ch] || ch} ${b.n.toLocaleString("ko-KR")}${a ? ` (${b.n - a.n >= 0 ? "+" : ""}${b.n - a.n})` : ""}`);
  }
  if (fol.length) lines.push(`팔로워: ${fol.join(" · ")}`);
  lines.push(`만든 콘텐츠 ${made.length} — 게시 ${count("PUBLISHED")} · 반려 ${count("REJECTED")} · 기한 지남 ${count("EXPIRED")} · 실패 ${count("FAILED")} · 승인 대기 ${count("READY_FOR_APPROVAL")}`);
  const report = { week, at: new Date(now).toISOString(), text: lines.join("\n"), posted: posted.length, real: real.length, views, clicks };
  await store.setJson("report:weekly", report, { ex: 60 * 86400 });
  return report;
}

module.exports = { collectInsights, recordFollowers, performanceWeights, weeklyReport, viewsOf, CHECKS };
