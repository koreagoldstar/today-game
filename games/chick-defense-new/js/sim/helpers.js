/* 보스 · 능력이 같이 쓰는 작은 도구 */

/** 부모 곁에 적을 예약 출현 (세대 +1 · 상한은 spawnEnemy 가 지킴 · 웨이브 끝 판정이 기다림) */
export function spawnEnemyLater(sim, type, parent, o = {}) {
  sim.schedule(o.delay || 0, { type, gen: (parent.gen || 0) + 1, path: parent.pathIdx, parent: parent.id, s: o.s, lane: o.lane, rewardMul: o.rewardMul ?? 0.6 });
}

/** 길 위 거리 s 의 점 */
export function pathPoint(e, s) {
  return e.path.at(s, {});
}

/** 타워가 가장 몰려 있는 곳 n 군데 (서로 r 이상 떨어짐) — 보스 범위 공격의 목표 */
export function towerCluster(sim, n, r) {
  const scored = sim.towers
    .map((t) => ({ x: t.x, z: t.z, id: t.id, k: sim.towers.filter((o) => Math.hypot(o.x - t.x, o.z - t.z) <= r).length }))
    .sort((a, b) => b.k - a.k || a.id - b.id);
  const out = [];
  for (const c of scored) {
    if (out.length >= n) break;
    if (out.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= r)) out.push(c);
  }
  return out;
}
