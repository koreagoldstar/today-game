/*
 * 상대 AI: 플레이어와 똑같은 입력만 쓴다 (반칙 없음).
 * 난이도는 반응 시간 · 실수 · 판단 주기로만 나뉜다. 보는 정보도 반응 시간만큼 늦다.
 */
import { AI_STYLES } from "./data.js?v=1";
import { press } from "./sim.js?v=1";

const LEVELS = [
  { react: 0.5, think: 0.32, mistake: 0.34, use: 0.25, read: 0 }, // 초급: 어린이도 이긴다
  { react: 0.3, think: 0.2, mistake: 0.14, use: 0.65, read: 0.35 }, // 중급
  { react: 0.16, think: 0.1, mistake: 0.02, use: 1, read: 0.85 }, // 고급: 공격을 읽고 반격
];
const TELL = new Set(["charge", "dash", "special"]);

export class BoutAI {
  constructor(bout, idx, { level = 0, style = "rush" } = {}) {
    this.b = bout;
    this.i = idx;
    this.lv = LEVELS[level];
    this.level = level;
    this.st = AI_STYLES[style] || AI_STYLES.rush;
    this.styleId = style;
    this.seen = [];
    this.thinkT = 0;
    this.mx = 0;
    this.chargeFor = 0;
    this.guardFor = 0;
    this.memo = { dash: 0, push: 0, guard: 0 };
    this.lastState = "";
  }

  rnd(k) {
    return Math.random() < k;
  }

  /** dt 마다 부른다 */
  update(dt) {
    const b = this.b;
    const me = b.f[this.i];
    const op = b.f[1 - this.i];
    const inp = b.input[this.i];
    // 상대의 모습은 반응 시간만큼 늦게 보인다
    this.seen.push({ t: b.total, state: op.state, stateT: op.stateT, x: op.x, vx: op.vx, charge: op.charge, skill: op.def.skill.id });
    while (this.seen.length > 1 && this.seen[1].t <= b.total - this.lv.react) this.seen.shift();
    const v = this.seen[0];
    if (v.state !== this.lastState) {
      this.lastState = v.state;
      if (v.state === "charge" || v.state === "dash") this.memo.dash += 1;
      else if (v.state === "push") this.memo.push += 1;
      else if (v.state === "guard") this.memo.guard += 1;
    }
    if (b.phase !== "fight") {
      inp.mx = 0;
      inp.dash = false;
      inp.guard = false;
      return;
    }
    // 돌진 모으기 · 버티기는 정한 시간만큼 유지
    if (this.chargeFor > 0) {
      this.chargeFor -= dt;
      inp.dash = this.chargeFor > 0;
    }
    if (this.guardFor > 0) {
      this.guardFor -= dt;
      inp.guard = this.guardFor > 0;
    }
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = this.lv.think * (0.8 + Math.random() * 0.4);
    this.decide(me, op, v, inp);
  }

  decide(me, op, v, inp) {
    const st = this.st;
    const lv = this.lv;
    const b = this.b;
    const dir = v.x >= me.x ? 1 : -1;
    const dist = Math.abs(v.x - me.x);
    const gap = dist - me.r - op.r;
    const R = b.R;
    const myEdge = Math.abs(me.x) / R;
    const opEdge = Math.abs(v.x) / R;
    const inward = me.x >= 0 ? -1 : 1;
    const opBehindMe = me.x * dir < 0; // 상대가 나보다 가운데 쪽 = 내가 바깥쪽
    const control = me.state === "idle" || me.state === "walk" || me.state === "run";
    if (me.state === "charge") {
      inp.mx = 0;
      return;
    }
    if (!control && me.state !== "guard") {
      inp.mx = dir * 0.4;
      return;
    }
    // 실수: 잠깐 멍하게 있거나 헛걸음
    if (this.rnd(lv.mistake * 0.55)) {
      inp.mx = this.rnd(0.5) ? 0 : -dir * 0.6;
      inp.guard = false;
      return;
    }
    const threat = (TELL.has(v.state) && gap < 300) || (v.state === "push" && gap < 60);
    if (threat && this.rnd(0.35 + lv.read * 0.6)) {
      // 상대 공격을 읽었다: 스타일대로 대응
      const edgeRisk = myEdge > 0.62 && opBehindMe;
      const wantDodge = st.dodge + (edgeRisk ? 0.25 : 0);
      if (v.state !== "push" && me.dodgeCd <= 0 && this.rnd(wantDodge)) {
        press(inp, "dodge");
        inp.mx = inward * 0.5;
        return;
      }
      if (this.rnd(st.guard + 0.2)) {
        inp.guard = true;
        this.guardFor = 0.22 + Math.random() * 0.3;
        inp.mx = 0;
        return;
      }
    }
    if (me.state === "guard") {
      // 버티다 반격
      if (v.state === "knockback" || v.state === "stumble" || v.state === "hit") {
        inp.guard = false;
        this.guardFor = 0;
        press(inp, "push");
      } else if (st.patience < 0.5 && this.rnd(0.4)) {
        inp.guard = false;
        this.guardFor = 0;
      }
      return;
    }
    // 특수 기술
    if (me.spec >= 100 && this.rnd(lv.use * 0.7)) {
      const skill = me.def.skill.id;
      const good = skill === "iron" ? threat || myEdge > 0.6 : skill === "roll" ? myEdge > 0.45 || gap < 90 : gap < (skill === "hop" ? 190 : skill === "spin" ? 120 : 340);
      if (good) {
        press(inp, "special");
        return;
      }
    }
    // 끝에 몰렸으면 가운데로 (또는 옆으로 빠짐)
    if (myEdge > 0.68 && opBehindMe) {
      if (gap < 60) {
        if (me.dodgeCd <= 0 && this.rnd(st.dodge * 0.6 + lv.read * 0.25)) {
          press(inp, "dodge");
          inp.mx = inward;
          return;
        }
        if (this.rnd(0.5)) press(inp, "push");
        if (this.rnd(st.guard * 0.5)) {
          inp.guard = true;
          this.guardFor = 0.3;
        }
      }
      inp.mx = inward;
      return;
    }
    // 상대가 비틀거리면 공격 기회
    const open = v.state === "stumble" || v.state === "recover" || v.state === "fall" || v.state === "knockback";
    if (gap < 18 && (open || this.rnd(st.push * (0.5 + this.level * 0.25)))) {
      press(inp, "push");
      inp.mx = dir;
      return;
    }
    // 돌진: 거리가 있고, 상대가 끝에 가까울수록 자주
    const dashChance = st.dash * (opEdge > 0.55 ? 1.5 : 0.7) * (0.5 + lv.use * 0.5);
    if (me.dashCd <= 0 && gap > 60 && gap < 300 && this.rnd(dashChance * 0.45)) {
      inp.dash = true;
      // 고급일수록 충분히 모으되, 상대가 보고 피할 틈도 있다
      this.chargeFor = 0.16 + Math.random() * (0.2 + this.level * 0.18);
      inp.mx = 0;
      return;
    }
    // 거리 조절
    const want = st.keep;
    if (want > 0 && gap < want && !open && !this.rnd(st.approach * 0.4)) {
      inp.mx = myEdge > 0.5 ? inward : -dir;
      return;
    }
    if (this.rnd(st.approach) || open) inp.mx = dir;
    else inp.mx = this.rnd(0.5) ? 0 : inward * 0.5;
    // 방어형: 가까우면 먼저 버틴다
    if (gap < 80 && this.rnd(st.guard * 0.45)) {
      inp.guard = true;
      this.guardFor = 0.26 + Math.random() * 0.3;
    }
  }
}
