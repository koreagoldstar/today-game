/*
 * 용암 서핑 · 보드 움직임 (트랙 좌표: s 앞 · u 옆 · y 높이)
 *
 *  - 앞으로 가는 속도: 경사가 가파를수록 빨라지는 목표 속도로 가속/감속 (부스터는 목표 +)
 *  - 좌우: 입력으로 옆 속도를 가속 (공중에서는 덜 듣는다) · 바위벽에 닿으면 튕김
 *  - 땅을 따라 미끄러짐: 표면 높이를 따라가다가, 점프대 끝처럼 표면이 갑자기 꺼지면 공중으로 뜬다
 *  - 점프: 표면 속도 + 위로 · 공중에서 한 번 더 누르면 빙글 회전(스턴트) — 착지 전에 끝나야 성공
 *  - 착지: 충격 크기 · 회전 성공/실패 · 완벽한 착지 판정
 *  - 충돌(장애물): 넘어질 뻔 → 속도 뚝 · 잠깐 무적
 *  - 틈이나 가장자리 밖으로 떨어져 용암 높이까지 내려가면 '용암에 빠짐'
 *  고정 시간 간격(1/120초)으로 나눠 계산 → 화면 빠르기와 상관없이 같은 움직임
 */
const SUB = 1 / 120;

export const PH = {
  g: 24,
  base: 15, // 평지 목표 속도 (m/s)
  slopeK: 58, // 경사 1 당 더해지는 목표 속도
  minSpeed: 11,
  maxSpeed: 27,
  accel: 8,
  decel: 9,
  boostAdd: 9,
  boostTime: 1.5,
  boostCD: 5,
  padBoost: 1.2,
  steer: 11,
  steerAcc: 42,
  steerDecel: 30,
  airSteer: 0.55,
  jumpV: 9.2,
  coyote: 0.1,
  buffer: 0.12,
  launch: 4.5, // 표면 속도가 이만큼 갑자기 줄면 공중으로
  crashSpeed: 12,
  crashTime: 0.7,
  invuln: 1.3,
  spinTime: 0.55,
  edge: 0.38,
};

export class Player {
  constructor(track) {
    this.track = track;
    this.reset(0);
  }
  reset(s, speed = PH.base) {
    const T = this.track;
    this.s = s;
    this.u = 0;
    this.y = T.surfaceY(s, 0) ?? T.frame(s, {}).y;
    const y2 = T.surfaceY(s + speed / 120, 0);
    this.surfRate = y2 == null ? 0 : (y2 - this.y) * 120;
    this.vy = this.surfRate;
    this.vu = 0;
    this.speed = speed;
    this.onGround = true;
    this.coyote = 0;
    this.bufferT = 0;
    this.airT = 0;
    this.boostT = 0;
    this.boostCD = 0;
    this.crashT = 0;
    this.invulnT = 0;
    this.spinT = -1;
    this.spinAng = 0;
    this.spins = 0;
    this.maxAirY = this.y;
    this.inLava = false;
    this.frozen = false;
    this.steer = 0;
  }
  get invulnerable() {
    return this.invulnT > 0;
  }
  get boostReady() {
    return this.boostCD <= 0 && this.boostT <= 0;
  }
  /** 장애물에 부딪힘 → true 면 실제로 넘어질 뻔함 */
  crash() {
    if (this.invulnT > 0) return false;
    this.crashT = PH.crashTime;
    this.invulnT = PH.invuln;
    this.speed = Math.min(this.speed, PH.crashSpeed);
    this.boostT = 0;
    this.spinT = -1;
    this.spinAng = 0;
    return true;
  }
  /** 부스터 발판 · 버튼 */
  boost(time = PH.boostTime, free = false) {
    if (!free && !this.boostReady) return false;
    this.boostT = Math.max(this.boostT, time);
    if (!free) this.boostCD = PH.boostCD;
    this.speed = Math.max(this.speed, this.targetSpeed() * 0.9);
    return true;
  }
  targetSpeed() {
    const T = this.track;
    const sl = T.slope(this.s);
    let v = Math.max(PH.minSpeed, Math.min(PH.maxSpeed, PH.base + PH.slopeK * sl));
    if (this.boostT > 0) v += PH.boostAdd;
    if (this.crashT > 0) v = Math.min(v, PH.crashSpeed + (1 - this.crashT / PH.crashTime) * 6);
    return v;
  }
  /**
   * @param input {steer: -1..1, jump: 눌렀나, boost: 눌렀나}
   * @returns 일어난 일 { jump, land:{impact, spins, failed, perfect}, launch, wall, lava, spinStart, boost }
   */
  update(dt, input) {
    const ev = {};
    if (this.frozen) return ev;
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.crashT = Math.max(0, this.crashT - dt);
    this.boostCD = Math.max(0, this.boostCD - dt);
    this.boostT = Math.max(0, this.boostT - dt);
    if (input.jump) {
      // 공중이면 회전 스턴트 시작 (이미 돌고 있으면 무시)
      if (!this.onGround && this.coyote <= 0 && this.airT > 0.08) {
        if (this.spinT < 0) {
          this.spinT = 0;
          ev.spinStart = true;
        }
      } else this.bufferT = PH.buffer;
    }
    if (input.boost && this.boost()) ev.boost = true;
    this.steer = input.steer || 0;
    const n = Math.min(12, Math.max(1, Math.ceil(dt / SUB)));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.step(h, ev);
    return ev;
  }
  step(h, ev) {
    const T = this.track;
    // 앞으로
    const tgt = this.targetSpeed();
    if (this.onGround) {
      const d = tgt - this.speed;
      const m = (d > 0 ? PH.accel : PH.decel) * h;
      this.speed += Math.abs(d) <= m ? d : Math.sign(d) * m;
    } else if (this.boostT > 0) this.speed = Math.max(this.speed, tgt - 2);
    // 옆으로
    const want = this.steer * PH.steer;
    const acc = (Math.abs(this.steer) > 0.05 ? PH.steerAcc : PH.steerDecel) * (this.onGround ? 1 : PH.airSteer) * h;
    const dv = want - this.vu;
    this.vu += Math.abs(dv) <= acc ? dv : Math.sign(dv) * acc;
    this.s += this.speed * h;
    this.u += this.vu * h;
    // 바위벽
    const hw = T.halfWidth(this.s);
    const side = Math.sign(this.u) || 1;
    if (Math.abs(this.u) > hw - PH.edge && T.wall(this.s, side)) {
      this.u = side * (hw - PH.edge);
      if (Math.abs(this.vu) > 5) {
        ev.wall = Math.abs(this.vu);
        this.speed *= 0.93;
      }
      this.vu = -this.vu * 0.25;
    }
    // 위아래
    this.coyote = Math.max(0, this.coyote - h);
    this.bufferT = Math.max(0, this.bufferT - h);
    const hS = T.surfaceY(this.s, this.u);
    if (this.onGround) {
      if (hS == null) {
        // 땅이 끝났다 (틈 · 가장자리)
        this.onGround = false;
        this.coyote = PH.coyote;
        this.vy = this.surfRate;
        this.airT = 0;
        this.maxAirY = this.y;
      } else {
        const rate = (hS - this.y) / h;
        if (this.surfRate - rate > PH.launch && this.surfRate > -2) {
          // 점프대 끝: 표면이 꺼져도 몸은 위로 날아간다
          this.onGround = false;
          this.vy = this.surfRate;
          this.airT = 0;
          this.maxAirY = this.y;
          ev.launch = this.surfRate;
        } else {
          this.y = hS;
          this.surfRate = rate;
          this.vy = rate;
        }
      }
    }
    // 점프 (땅 · 코요테 시간)
    if (this.bufferT > 0 && (this.onGround || this.coyote > 0) && this.crashT <= 0.3) {
      this.vy = Math.max(this.vy, 0) + PH.jumpV;
      this.onGround = false;
      this.coyote = 0;
      this.bufferT = 0;
      this.airT = 0;
      this.maxAirY = this.y;
      ev.jump = true;
    }
    if (!this.onGround) {
      this.airT += h;
      this.vy -= PH.g * h;
      this.y += this.vy * h;
      this.maxAirY = Math.max(this.maxAirY, this.y);
      // 회전 스턴트
      if (this.spinT >= 0) {
        this.spinT += h;
        this.spinAng = (this.spinT / PH.spinTime) * Math.PI * 2;
        if (this.spinT >= PH.spinTime) {
          this.spins++;
          this.spinT = -1;
          this.spinAng = 0;
          ev.spinDone = this.spins;
        }
      }
      const g = T.surfaceY(this.s, this.u);
      if (g != null && this.y <= g && this.vy <= 0.5) {
        // 착지
        const impact = -this.vy;
        const midSpin = this.spinT >= 0;
        const prog = midSpin ? this.spinT / PH.spinTime : 0;
        const failed = midSpin && prog > 0.12 && prog < 0.85;
        ev.land = { impact, spins: this.spins, failed, air: this.airT, height: this.maxAirY - g, perfect: !failed && this.airT > 0.6 && Math.abs(this.vu) < 3 && !midSpin };
        this.y = g;
        // 착지한 자리의 경사(표면 높이 변화 빠르기)를 바로 넣는다 → 내리막에 내려도 다시 튀지 않음
        const g2 = T.surfaceY(this.s + this.speed * h, this.u);
        this.surfRate = g2 == null ? 0 : (g2 - g) / h;
        this.vy = this.surfRate;
        this.onGround = true;
        this.spinT = -1;
        this.spinAng = 0;
        this.spins = 0;
        if (failed) {
          this.crashT = PH.crashTime;
          this.invulnT = PH.invuln * 0.7;
          this.speed = Math.min(this.speed, PH.crashSpeed);
        }
        if (impact > 24) this.speed *= 0.85;
      } else if (this.y < T.lavaY(this.s) + 0.4) {
        ev.lava = true;
        this.inLava = true;
      }
    }
  }
}
