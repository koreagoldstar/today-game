"use strict";
/*
 * Copywriter — 채널별 문구 · 해시태그. 근거는 Source 의 facts 만.
 *  LLM_API_KEY 가 있으면 Claude 가 쓰고(같은 입력은 저장해 둔 결과를 다시 씀), 없거나 결과가 규칙에 안 맞으면 정해진 틀 문구.
 *  규칙: 원본에 없는 숫자 · 순위/최초 같은 주장 금지 · 최근 20개 첫 문장과 다름 · 인스타는 "프로필 링크" 로 유도 · 해시태그 5~10개(#오늘의게임 고정)
 */
const crypto = require("crypto");
const { utmLink } = require("../core/links");

const MODEL = process.env.LLM_MODEL || "claude-opus-5-5";
const GENRE_TAG = { arcade: "#아케이드게임", sports: "#스포츠게임", action: "#액션게임", puzzle: "#퍼즐게임", rhythm: "#리듬게임", edu: "#교육게임" };
const CLAIMS = /1위|일위|TOP\s*\d|탑\s*\d|랭킹|순위|최초|역대|최고의|무조건|100\s*%|만\s*명|천\s*명/i;

const firstSentence = (s) => (String(s || "").match(/^.*?(?:[.!?]|다\.)(?=\s|$)/) || [String(s || "")])[0].trim();
const factText = (f) => JSON.stringify(f); // 원본 사실 전부 (게임 소개 · 퀴즈 문항 · 랭킹 점수 · 운세 문구 …)

/** 문구가 사실 규칙에 맞는지 — 틀리면 이유 목록 */
function factProblems(text, facts) {
  const src = factText(facts);
  const out = [];
  for (const n of String(text).match(/\d+(?:[.,]\d+)?/g) || []) if (!src.includes(n)) out.push(`원본에 없는 숫자 "${n}"`);
  const claim = String(text).match(CLAIMS);
  if (claim && !CLAIMS.test(src)) out.push(`확인 안 된 주장 "${claim[0]}"`);
  return out;
}

function hashtagsFor(facts, profileTags = []) {
  return [...new Set(["#오늘의게임", "#무료게임", "#웹게임", "#미니게임", ...profileTags, GENRE_TAG[facts.category]].filter(Boolean))].slice(0, 8);
}

const TYPE_TAGS = {
  quiz: ["#상식퀴즈", "#퀴즈", "#상식", "#두뇌게임"],
  ranking: ["#주간랭킹", "#게임랭킹", "#기록도전"],
  fortune: ["#오늘의운세", "#운세"],
  challenge: ["#오늘의챌린지", "#기록도전"],
  recycle: [],
  "new-game": ["#신작게임", "#새게임"],
};

/** 게임이 아닌 유형의 첫 줄 후보 · 본문 (facts 에 있는 것만) */
function typeLines(type, f, kind) {
  const n = (f.questions || []).length;
  if (type === "quiz") return { openers: [`오늘의 상식퀴즈 ${n}문제, 몇 개 맞힐 수 있을까요? 🧠`, `상식퀴즈 ${n}문제 도전! 🧠`, `옆으로 넘기며 푸는 상식퀴즈 ${n}문제 🧠`], body: ["정답은 첫 댓글에서 확인하세요.", "더 많은 문제는 오늘의 게임 상식퀴즈에서!"] };
  if (type === "ranking") {
    const g = (f.games || [])[0];
    return { openers: [`지난주 TOP 기록 🏆 (${f.week})`, `${f.week} 주간 랭킹 🏆`], body: [...(f.games || []).map((x) => `${x.title} 1위 ${x.top[0].name} · ${x.top[0].text}`), g ? "내 기록으로 도전해 보세요!" : ""] };
  }
  if (type === "fortune") return { openers: [`${f.day} 오늘의 운세 🍀`], body: Object.values(f.items || {}).map((x) => `${x.emoji} ${x.title}: ${x.t}`) };
  if (type === "challenge") return { openers: [`오늘의 챌린지: ${f.game} 🏆`], body: [f.participants ? `지금까지 ${f.participants}명 도전` : "", "오늘 하루만 열리는 기록 대결!"] };
  if (type === "new-game") return { openers: [`NEW! 신작 게임 ${f.title} 🎉`, `새로 나온 게임: ${f.title} 🎉`, `오늘의 게임 신작 — ${f.title} 🎉`], body: [firstSentence(f.intro), f.tag, "오늘의 게임에서 무료로 바로 플레이할 수 있어요."] };
  if (type === "recycle") return { openers: [`${kind === "reel" ? "새 영상" : "새 게시물"}: ${f.title}`], body: ["프로필에서 확인해 보세요!"] };
  return null;
}

/** 정해진 틀 문구 (AI 없이) */
function templateCopy({ source, render, channels, recent = [], profileTags = [], linkOpts = {} }) {
  const f = source.facts;
  const t = typeLines(source.sourceType, f, f.kind);
  if (t) {
    const first = t.openers.find((o) => !recent.includes(o)) || t.openers[t.openers.length - 1];
    const body = t.body.filter(Boolean);
    const tags = [...new Set(["#오늘의게임", ...TYPE_TAGS[source.sourceType], ...profileTags, GENRE_TAG[f.category], "#무료게임", "#웹게임", "#미니게임"].filter(Boolean))].slice(0, 8);
    const kind = (render && render.kind) || "image";
    const link = (ch) => utmLink(f.url || "/", { channel: ch, kind, sourceId: source.sourceId, ...linkOpts });
    const out = {};
    for (const ch of channels) {
      if (ch === "instagram") out[ch] = { caption: [first, ...body, "프로필 링크에서 플레이!"].join("\n"), hashtags: tags, link: link(ch) };
      else if (ch === "threads") out[ch] = { caption: [first, body[0]].filter(Boolean).join("\n"), hashtags: ["#오늘의게임"], link: link(ch) };
      else if (ch === "facebook") out[ch] = { caption: [first, ...body, `바로 가기: ${link(ch)}`].join("\n"), hashtags: tags.slice(0, 3), link: link(ch) };
      else if (ch === "youtube") out[ch] = { title: first.slice(0, 100), caption: [...body, link(ch)].join("\n"), hashtags: tags, link: link(ch) };
    }
    return out;
  }
  const hook = (render && render.meta && render.meta.hook) || f.title;
  const openers = [`${hook} 🎮`, `${f.title}, 해 보셨나요? 🎮`, `${f.title} 한 판 어때요? 🎮`, `오늘의 게임 추천: ${f.title} 🎮`, `${f.tag} — ${f.title} 🎮`];
  const first = openers.find((o) => o && !recent.includes(o)) || openers[openers.length - 1];
  const intro = firstSentence(f.intro);
  // 조작 설명은 짧고 휴대폰에도 맞는 문장일 때만 (사이트 설명은 "컴퓨터에서는 …" 처럼 긴 경우가 많다)
  const how0 = firstSentence(f.how);
  const how = how0.length <= 60 && !/^컴퓨터/.test(how0) ? how0 : "";
  const tags = hashtagsFor(f, profileTags);
  const kind = (render && render.kind) || "reel";
  const link = (ch) => utmLink(f.url, { channel: ch, kind, sourceId: source.sourceId, ...linkOpts });
  const out = {};
  for (const ch of channels) {
    if (ch === "instagram") out[ch] = { caption: [first, intro, how, "오늘의 게임에서 무료로 바로 플레이할 수 있어요.", "프로필 링크에서 플레이!"].filter(Boolean).join("\n"), hashtags: tags, link: link(ch) };
    else if (ch === "threads") out[ch] = { caption: [first, intro].filter(Boolean).join("\n"), hashtags: ["#오늘의게임"], link: link(ch) };
    else if (ch === "facebook") out[ch] = { caption: [first, intro, how, `지금 플레이: ${link(ch)}`].filter(Boolean).join("\n"), hashtags: tags.slice(0, 3), link: link(ch) };
    else if (ch === "youtube") out[ch] = { title: `${hook} | ${f.title}`.slice(0, 100), caption: [intro, how, `플레이: ${link(ch)}`].filter(Boolean).join("\n"), hashtags: tags, link: link(ch) };
  }
  return out;
}

/** AI 결과가 규칙에 맞는지 */
function checkAi(copy, { source, channels, recent }) {
  const bad = [];
  for (const ch of channels) {
    const c = copy[ch];
    if (!c || !String(c.caption || "").trim()) {
      bad.push(`${ch} 문구 없음`);
      continue;
    }
    bad.push(...factProblems(`${c.title || ""} ${c.caption}`, source.facts).map((x) => `${ch}: ${x}`));
    if (source.sourceType === "quiz") for (const q of source.facts.questions || []) if (String(q.answer).length >= 2 && c.caption.includes(q.answer)) bad.push(`${ch}: 캡션에 정답 "${q.answer}"`);
    const first = c.caption.split("\n")[0].trim();
    if (recent.includes(first)) bad.push(`${ch}: 최근 문구와 첫 문장이 같음`);
    if (ch === "instagram") {
      if (!c.hashtags.includes("#오늘의게임")) bad.push("instagram: #오늘의게임 없음");
      if (c.hashtags.length < 5 || c.hashtags.length > 10) bad.push(`instagram: 해시태그 ${c.hashtags.length}개`);
      if (!/프로필 링크/.test(c.caption)) bad.push('instagram: "프로필 링크" 유도 없음');
      if (/https?:\/\//.test(c.caption)) bad.push("instagram: 캡션에 주소 (눌리지 않음)");
    }
  }
  return bad;
}

const SCHEMA = (channels) => ({
  type: "object",
  additionalProperties: false,
  required: channels,
  properties: Object.fromEntries(
    channels.map((ch) => [
      ch,
      { type: "object", additionalProperties: false, required: ["caption", "hashtags", ...(ch === "youtube" ? ["title"] : [])], properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, ...(ch === "youtube" ? { title: { type: "string" } } : {}) } },
    ])
  ),
});

const SYSTEM = `당신은 웹 미니게임 사이트 "오늘의 게임"(todaygame.co.kr)의 SNS 문구 담당입니다.
사실 근거는 사용자가 준 facts 뿐입니다. facts 에 없는 숫자, 순위, 기록, 기능, 수상, 인원 수는 절대 쓰지 마세요.
자연스러운 한국어로 짧고 강한 첫 줄을 쓰고, 이모지는 1~3개만 씁니다. 과장하지 않습니다.
채널별 형식:
- instagram: 4~6줄, 마지막 줄은 "프로필 링크에서 플레이!" 같은 프로필 링크 유도. 캡션에 URL 을 넣지 않음. hashtags 5~10개, "#오늘의게임" 반드시 포함.
- threads: 대화체 1~3문장. hashtags 0~1개.
- facebook: 2~5줄, 끝에 주어진 링크를 그대로 넣어도 됨. hashtags 0~3개.
- youtube: title 은 60자 이내, caption 은 설명 2~4줄 + 주어진 링크. hashtags 3~8개.
최근 문구의 첫 문장과 같은 첫 문장은 쓰지 마세요.
type 별: game 은 게임 플레이 영상 소개, new-game 은 새로 나온 게임 소개(facts.added 날짜 외의 출시 주장 금지), quiz 는 캐러셀 퀴즈(정답은 쓰지 말고 "정답은 첫 댓글" 로 안내), ranking 은 facts 의 점수 · 가린 닉네임 그대로(바꾸지 않음).`;

/**
 * @param {{ store?, env?, client? }} o  client: 시험용으로 바꿔 끼울 수 있는 Claude 클라이언트
 */
function createCopywriter({ store = null, env = process.env, client = null, profileTags = () => [] } = {}) {
  const key = env.LLM_API_KEY;
  let api = client;
  if (!api && key) {
    const mod = require("@anthropic-ai/sdk");
    const Anthropic = mod.default || mod;
    api = new Anthropic({ apiKey: key });
  }

  async function ask({ source, channels, recent, render, linkOpts }) {
    const links = Object.fromEntries(channels.map((ch) => [ch, utmLink(source.facts.url, { channel: ch, kind: render.kind, sourceId: source.sourceId, ...linkOpts })]));
    const user = JSON.stringify({ type: source.sourceType, facts: source.facts, hook: render.meta && render.meta.hook, kind: render.kind, channels, links, recentFirstLines: recent.slice(0, 20) });
    const cacheKey = `copycache:${crypto.createHash("sha256").update(`${MODEL}\n${SYSTEM}\n${user}`).digest("hex").slice(0, 40)}`;
    if (store) {
      const hit = await store.getJson(cacheKey).catch(() => null);
      if (hit) return { copy: hit, cached: true, links };
    }
    const res = await api.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // 안전 분류기가 거절하면 서버가 대신 모델로 다시 시도
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA(channels) } },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason === "refusal") throw new Error("AI 가 요청을 거절함");
    const text = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const copy = JSON.parse(text);
    if (store) await store.setJson(cacheKey, copy, { ex: 30 * 86400 }).catch(() => {});
    return { copy, cached: false, links };
  }

  return {
    model: api ? MODEL : null,
    async write({ source, render, channels, recent = [], ctx = {}, contentId = null }) {
      const linkOpts = { track: !!(ctx.settings && ctx.settings.trackClicks), contentId };
      let tags = [];
      if (source.sourceType === "game" || source.sourceType === "new-game") {
        try {
          tags = profileTags(source.sourceId);
        } catch (_) {} // 신작은 녹화 프로필이 없을 수 있음
      }
      const fallback = (reason) => {
        const out = templateCopy({ source, render, channels, recent, profileTags: tags, linkOpts });
        for (const c of Object.values(out)) Object.assign(c, { source: "template", note: reason || "" });
        return out;
      };
      if (!api) return fallback("AI 열쇠 없음 — 틀 문구");
      if (render.kind === "story") return fallback("스토리는 문구가 게시되지 않아 틀 문구");
      try {
        const { copy, cached, links } = await ask({ source, channels, recent, render, linkOpts });
        const out = {};
        for (const ch of channels) {
          const c = copy[ch] || {};
          const hashtags = [...new Set((c.hashtags || []).map((t) => String(t).trim()).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`)))];
          out[ch] = { ...c, caption: String(c.caption || "").trim(), hashtags, link: links[ch], source: cached ? "ai-cache" : "ai", model: MODEL };
        }
        const bad = checkAi(out, { source, channels, recent });
        if (bad.length) {
          if (ctx.logger) await ctx.logger.warn(`AI 문구가 규칙에 안 맞아 틀 문구로: ${bad.join(" / ")}`);
          return fallback(`AI 문구 거부: ${bad.slice(0, 3).join(" / ")}`);
        }
        return out;
      } catch (e) {
        if (ctx.logger) await ctx.logger.warn(`AI 문구 실패, 틀 문구로: ${e.message}`);
        return fallback(`AI 실패: ${e.message.slice(0, 120)}`);
      }
    },
  };
}

module.exports = { createCopywriter, templateCopy, factProblems, checkAi, hashtagsFor, firstSentence };
