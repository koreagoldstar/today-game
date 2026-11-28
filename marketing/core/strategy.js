"use strict";
/*
 * 콘텐츠 유형 (성장 최적화 3장): 도전형 · 실패/반전형 · 기록 경쟁형 · 게임 발견형.
 *  - classify: 만든 결과물에서 실제로 보이는 것만 근거로 유형을 정한다 (지어내지 않음). 승인 대기 때 doc.strategy 에 남김.
 *  - wantedType: 최근 콘텐츠의 실제 유형 비율과 목표 비율(settings.typeMix, 초기 40/25/25/10)을 비교해 가장 모자란 유형.
 *  - hookOptions: 첫 2초 후킹 문구 5개 — 서로 다른 관점(질문 · 도발 · 친구 · 공감 · 결과), 최근 쓴 문구는 뺌, 원본에 없는 숫자 금지.
 */
const TYPES = {
  challenge: "도전형",
  fail: "실패·반전형",
  record: "기록 경쟁형",
  discover: "게임 발견형",
};
const RECORD_WORDS = /기록|몇\s*(ms|타|점|초|단계)|타수|점수|랭킹|TOP|대결/i;

// 유형별 후킹 문구 (관점: 질문 · 도발 · 친구 · 공감 · 결과). {title} {tag} 는 사이트 사실로 채움. 숫자는 넣지 않는다.
const HOOK_BANK = {
  challenge: ["이거 한 번에 성공할 수 있을까?", "쉬워 보이죠? 직접 해 보면 달라요", "친구한테 보내고 누가 먼저 깨나 보세요", "딱 한 판만 하려다 계속하게 되는 {title}", "끝까지 간 사람 손 🙋"],
  fail: ["마지막 순간에 무너졌다", "여기서 이럴 줄 몰랐다", "나만 여기서 막히나요?", "방심한 순간 끝… 😱", "이 장면 보고 다시 도전함"],
  record: ["내 기록, 이길 수 있어요?", "점수 보고 놀라지 마세요", "친구랑 기록 대결해 보세요", "{tag}", "기록 갱신 가능?"],
  discover: ["이런 게임 알고 있었어요?", "설치 없이 바로 하는 {title}", "쉬는 시간에 딱 좋은 게임 찾았다", "{title}, 처음 보는 사람?", "오늘의 숨은 게임 🎮"],
};
// 예상 시청자 반응 — 실험 가설 (실제 성과로 확인)
const EXPECT = {
  challenge: "도전 댓글 · 친구에게 공유",
  fail: "공감 댓글 · 다시 보기 (시청 유지)",
  record: "점수 인증 · 친구 태그",
  discover: "저장 · 프로필 방문",
};
const DEFAULT_MIX = { challenge: 40, fail: 25, record: 25, discover: 10 };

/** 최근 콘텐츠 유형 비율이 목표보다 가장 모자란 유형 (같으면 목표 비율이 큰 것). 근거 문장 포함 */
function wantedType(recent, mix = DEFAULT_MIX) {
  const types = Object.keys(mix);
  const n = recent.length;
  const count = Object.fromEntries(types.map((t) => [t, recent.filter((x) => x === t).length]));
  const gap = (t) => mix[t] / 100 - (n ? count[t] / n : 0);
  const type = types.slice().sort((a, b) => gap(b) - gap(a) || mix[b] - mix[a])[0];
  return { type, reason: `최근 ${n}개 중 ${TYPES[type]} ${count[type]}개 (목표 ${mix[type]}%) — 가장 모자람` };
}

/** 후킹 문구 5개: 이 게임 전용 문구(녹화 프로필) 중 유형에 맞는 것 먼저 + 유형 문구 은행, 최근 쓴 것 제외 */
function hookOptions({ type, facts = {}, profileHooks = [], used = [] }) {
  const fill = (h) => h.replace(/\{title\}/g, facts.title || "").replace(/\{tag\}/g, facts.tag || "").trim();
  const fits = (h) => (type === "record" ? RECORD_WORDS.test(h) : type === "challenge" ? !RECORD_WORDS.test(h) : false);
  // 모자라면 도전형 문구로 채움 (같은 문구를 다시 쓰는 것보다 낫다)
  const pool = [...profileHooks.filter(fits), ...(HOOK_BANK[type] || HOOK_BANK.challenge).map(fill), ...(type === "challenge" ? [] : HOOK_BANK.challenge.map(fill))].filter((h) => h && h.length <= 30);
  const fresh = [...new Set(pool)].filter((h) => !used.includes(h));
  return (fresh.length >= 5 ? fresh : [...new Set([...fresh, ...pool])]).slice(0, 5);
}

/** @returns {{ type, label, hook, durationSec, reason, wanted?, hooks?, expect }} */
function classify(doc) {
  const st = doc.source && doc.source.sourceType;
  const meta = (doc.render && doc.render.meta) || {};
  const plan = doc.plan || {};
  const hook = meta.hook || (doc.copy && doc.copy.instagram && String(doc.copy.instagram.caption || "").split("\n")[0]) || "";
  const pick = (type, reason) => ({
    type,
    label: TYPES[type],
    hook,
    durationSec: meta.durationSec || null,
    reason,
    expect: EXPECT[type],
    ...(plan.wantType ? { wanted: plan.wantType, wantReason: plan.wantReason || "" } : {}),
    hooks: meta.hookOptions || hookOptions({ type, facts: (doc.source && doc.source.facts) || {} }),
  });
  if (st === "spotlight" || st === "new-game" || st === "fortune") return pick("discover", "아직 안 해 본 게임 · 사이트 기능 소개");
  if (st === "quiz") return pick("challenge", "몇 개 맞힐 수 있는지 도전");
  if (st === "ranking" || st === "challenge") return pick("record", "실제 기록 · 순위로 겨루기");
  if (st === "game") {
    const caps = meta.captions || [];
    if (caps.some((c) => c.type === "fail")) return pick("fail", `영상 속 실패 장면 (${caps.filter((c) => c.type === "fail").map((c) => c.text).join(", ")})`);
    if (RECORD_WORDS.test(hook)) return pick("record", `첫 문구가 기록을 겨룸 ("${hook}")`);
    return pick("challenge", `첫 문구가 도전을 권함 ("${hook}")`);
  }
  return pick("discover", "기타");
}

/** 이 계획이 그 유형을 만들 수 있나 (편성 순서를 정할 때) */
function canMake(plan, type) {
  if (plan.sourceType === "game") return type !== "discover";
  if (plan.sourceType === "spotlight" || plan.sourceType === "new-game") return type === "discover";
  if (plan.sourceType === "quiz") return type === "challenge";
  if (plan.sourceType === "ranking") return type === "record";
  return false;
}

module.exports = { classify, wantedType, hookOptions, canMake, TYPES, HOOK_BANK, EXPECT, DEFAULT_MIX };
