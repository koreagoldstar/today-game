/*
 * 월드 환경 기믹 (실제 규칙): 포자 꽃밭(회복) · 빙판(빨라짐) · 용암 분출구(불 지대 + 타워 과열) · 그림자 구역(가까운 타워만 봄)
 *  미리 표시(marker)한 뒤 효과가 난다. 웨이브 끝 판정은 기다리지 않음 (blocking 아님).
 */
export class Env {
  constructor(world) {
    this.g = world.gimmick || null;
    this.t = 0;
    this.sight = this.g && this.g.kind === "shadow" ? this.g.sight : 99;
  }
  reset() {
    this.t = 0;
  }
  /** 빙판 위면 빨라짐 */
  speedAt(x, z) {
    const g = this.g;
    if (!g || g.kind !== "icePatch") return 1;
    for (const s of g.spots) if ((x - s.x) ** 2 + (z - s.z) ** 2 <= s.r * s.r) return g.speed;
    return 1;
  }
  /** 그림자 구역 안인가 */
  hidden(x, z) {
    const g = this.g;
    if (!g || g.kind !== "shadow") return false;
    for (const s of g.spots) if ((x - s.x) ** 2 + (z - s.z) ** 2 <= s.r * s.r) return true;
    return false;
  }
  update(sim, dt) {
    const g = this.g;
    if (!g || (g.kind !== "sporeBloom" && g.kind !== "lavaVent")) return;
    const prev = this.t;
    this.t += dt;
    const warnAt = g.every - g.warn;
    if (prev < warnAt && this.t >= warnAt) {
      const spots = g.kind === "sporeBloom" ? g.spots : g.vents;
      for (const s of spots)
        sim.addMarker({
          kind: g.kind === "sporeBloom" ? "bloom" : "vent",
          x: s.x,
          z: s.z,
          r: s.r,
          dur: g.warn,
          color: g.kind === "sporeBloom" ? 0xd6a2ff : 0xff6a1a,
          done: (sim) => {
            if (g.kind === "sporeBloom") sim.addZone({ kind: "spore", x: s.x, z: s.z, r: s.r, dur: g.dur, owner: -1, max: 9, heal: g.heal, env: true });
            else {
              sim.addZone({ kind: "fire", x: s.x, z: s.z, r: s.r, dur: g.zoneDur, owner: -1, max: 9, towerRate: 1, env: true });
              for (const t of sim.towers) if (Math.hypot(t.x - s.x, t.z - s.z) <= s.r + 0.5) sim.debuffTower(t, "heat", g.heat, g.heatDur);
              sim.emit({ type: "boom", x: s.x, z: s.z, r: s.r, look: "vent" });
            }
          },
        });
    }
    if (this.t >= g.every) this.t -= g.every;
  }
}
