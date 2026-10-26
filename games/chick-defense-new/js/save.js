/*
 * 저장 (이 기기 브라우저에만 · 로그인 없음)
 *  캠페인(월드별 진행 · 정비 시점 이어하기)과 무한 생존 기록은 따로.
 *  형식이 바뀌면 v 로 옮기고, 저장이 막힌 브라우저면 이번 방문 동안만 기억 (ok = false).
 */
const KEY = "today-chick-defense-new-v1";

const fresh = () => ({
  v: 1,
  settings: { music: true, sfx: true, musicVol: 0.6, sfxVol: 0.85, quality: "auto", shake: true, dmgNums: true, difficulty: "normal" },
  campaign: { unlocked: 1, worlds: {}, run: null },
  endless: { bestWave: 0, bestScore: 0, plays: 0 },
  tutorial: { done: false },
  seen: [],
});

export class Save {
  constructor() {
    this.ok = true;
    this.data = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = migrate(JSON.parse(raw));
    } catch (_) {
      this.ok = false;
    }
    try {
      localStorage.setItem(KEY + "-t", "1");
      localStorage.removeItem(KEY + "-t");
    } catch (_) {
      this.ok = false;
    }
  }
  write() {
    if (!this.ok) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      return true;
    } catch (_) {
      this.ok = false;
      return false;
    }
  }
  world(id) {
    return this.data.campaign.worlds[id] || { cleared: false, best: 0, score: 0 };
  }
  /** 웨이브를 깰 때마다: 그 월드 최고 도달 웨이브 */
  waveReached(worldId, local) {
    const w = (this.data.campaign.worlds[worldId] = this.world(worldId));
    if (local > w.best) w.best = local;
    this.write();
  }
  worldClear(worldId, score, nestHp) {
    const w = (this.data.campaign.worlds[worldId] = this.world(worldId));
    const first = !w.cleared;
    w.cleared = true;
    w.best = 30;
    if (score > (w.score || 0)) w.score = score;
    if (nestHp > (w.nest || 0)) w.nest = nestHp;
    this.data.campaign.unlocked = Math.max(this.data.campaign.unlocked, Math.min(5, worldId + 1));
    if (worldId === 5) this.data.campaign.done = true;
    this.data.campaign.run = null;
    this.write();
    return first;
  }
  get campaignDone() {
    return !!this.data.campaign.done;
  }
  saveRun(snap, difficulty) {
    this.data.campaign.run = snap ? { ...snap, difficulty, at: Date.now() } : null;
    this.write();
  }
  endlessResult(wave, score) {
    const e = this.data.endless;
    const rec = { newWave: wave > e.bestWave, newScore: score > e.bestScore };
    e.bestWave = Math.max(e.bestWave, wave);
    e.bestScore = Math.max(e.bestScore, score);
    e.plays++;
    this.write();
    return rec;
  }
  setting(k, v) {
    this.data.settings[k] = v;
    this.write();
  }
  markSeen(type) {
    if (this.data.seen.includes(type)) return false;
    this.data.seen.push(type);
    this.write();
    return true;
  }
}

function migrate(d) {
  const f = fresh();
  if (!d || typeof d !== "object") return f;
  return {
    ...f,
    ...d,
    v: 1,
    settings: { ...f.settings, ...(d.settings || {}) },
    campaign: { ...f.campaign, ...(d.campaign || {}), worlds: { ...((d.campaign && d.campaign.worlds) || {}) } },
    endless: { ...f.endless, ...(d.endless || {}) },
    tutorial: { ...f.tutorial, ...(d.tutorial || {}) },
    seen: Array.isArray(d.seen) ? d.seen : [],
  };
}
