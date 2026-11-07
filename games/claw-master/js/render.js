/*
 * 인형뽑기 기계 그리기: 장난감 가게 배경 · 캐비닛 · 유리 · 레일 · 집게 · 인형 · 그림자.
 *  기계 안은 앞에서 본 원근: 뒤로 갈수록 작고 위에 있다.
 */
import { BOX, CHUTE, RAIL_Y, PRONG, PHASE_KO } from "./sim.js?v=1";
import { dollById } from "./data.js?v=1";
import { drawPlush } from "./plush.js?v=1";

const TAU = Math.PI * 2;
const DEEP = 0.36; // 맨 뒤는 36% 작게 (원근을 세게 해서 앞뒤가 잘 보이게)
const RISE = 0.6; // 1cm 깊이마다 화면에서 위로 (위에서 내려다보는 각도)

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

export class View {
  constructor() {
    this.bg = document.createElement("canvas");
    this.over = document.createElement("canvas");
    this.sprites = new Map();
    this.soft = new Map(); // 인형마다 말랑한 몸 (그림 전용 스프링)
    this.pops = []; // 배출구 문으로 나오는 인형
    this.W = 2;
    this.H = 2;
  }

  /** 획득: 배출구가 빛나고, 앞문으로 인형이 통통 튀어나온다 */
  pop(kind) {
    this.pops.push({ kind, t: 0 });
  }

  /**
   * 말랑한 몸: 착지하면 납작해졌다가 출렁이며 돌아오고, 발에 눌리면 옆이 오므라든다.
   * 물리 모양(구)은 그대로 두고 그림만 바꾼다 → 충돌은 안정, 보이는 크기는 거의 같다.
   */
  softOf(d, dt) {
    let s = this.soft.get(d.id);
    if (!s) {
      s = { k: 0, v: 0, imp: d.impact, grip: 0, bend: 0, bv: 0, pvx: d.vx };
      this.soft.set(d.id, s);
    }
    if (d.impact > s.imp + 0.08) s.v += d.impact * 7; // 쿵 → 납작
    s.imp = d.impact;
    const m = d.prongMask || 0;
    const n = (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
    s.grip += ((n ? Math.min(1, 0.25 + n * 0.25) : 0) - s.grip) * Math.min(1, dt * 10);
    s.v += (-260 * s.k - 9 * s.v) * dt;
    s.k = Math.max(-0.3, Math.min(0.3, s.k + s.v * dt));
    // 목이 말랑해서 잡힌 인형의 몸통이 집게 움직임보다 늦게 따라 휜다 (가속 반대쪽으로 기울었다 출렁)
    const ax = dt > 0 ? (d.vx - s.pvx) / dt : 0;
    s.pvx = d.vx;
    const want = m ? Math.max(-0.45, Math.min(0.45, (ax / 980) * 1.4)) : 0;
    s.bv += ((want - s.bend) * 90 - s.bv * 3.5) * dt;
    s.bend = Math.max(-0.6, Math.min(0.6, s.bend + s.bv * dt));
    return s;
  }

  /** 기계 크기 · 위치. box: 기계를 넣을 화면 영역 */
  layout(W, H, dpr, box, theme, skin) {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.theme = theme;
    this.skin = skin;
    // 기계 전체: 폭 116cm, 높이 140cm (안쪽 + 간판 + 아래 받침)
    const S = Math.min(box.w / 118, box.h / 142);
    this.S = S;
    this.cx = box.x + box.w / 2;
    const mh = 142 * S;
    const top = box.y + (box.h - mh) / 2;
    this.top = top;
    this.floorY = top + 20 * S + 96 * S; // 간판 20 + 안쪽 96
    this.mx = this.cx - 58 * S;
    this.mw = 116 * S;
    this.mtop = top;
    this.mbot = top + mh;
    this.sprites.clear();
    this.build();
  }

  sc(z) {
    return this.S * (1 - (DEEP * z) / BOX.z1);
  }
  X(x, z) {
    return this.cx + x * this.sc(z);
  }
  Y(y, z) {
    return this.floorY - z * this.S * RISE - y * this.sc(z);
  }
  /** 화면 → 바닥 (마우스로 집게 옮길 때) */
  toFloor(px, py) {
    const z = (this.floorY - py) / (this.S * RISE);
    const zc = Math.max(0, Math.min(BOX.z1, z));
    return { x: (px - this.cx) / this.sc(zc), z };
  }

  build() {
    const { W, H, dpr, S, theme: T } = this;
    for (const c of [this.bg, this.over]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const g = this.bg.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.paintShop(g);
    this.paintCabinet(g);
    this.paintInside(g);
    const o = this.over.getContext("2d");
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.paintGlass(o);
    void T;
    void S;
  }

  /** 장난감 가게 배경 */
  paintShop(g) {
    const { W, H, S } = this;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#ffe3ef");
    gr.addColorStop(0.62, "#ffd6e6");
    gr.addColorStop(0.63, "#e8b88a");
    gr.addColorStop(1, "#c98f5c");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    // 벽지 땡땡이
    g.fillStyle = "rgba(255,255,255,.55)";
    for (let y = 18; y < H * 0.6; y += 34) {
      for (let x = (y / 34) % 2 ? 10 : 27; x < W; x += 34) {
        g.beginPath();
        g.arc(x, y, 4, 0, TAU);
        g.fill();
      }
    }
    // 마루 선
    g.strokeStyle = "rgba(120,70,30,.25)";
    g.lineWidth = 2;
    for (let x = -H; x < W + H; x += 60) {
      g.beginPath();
      g.moveTo(x, H * 0.63);
      g.lineTo(x - (H - H * 0.63) * 0.6, H);
      g.stroke();
    }
    // 선반 + 장난감 상자 (기계 양옆)
    const shelfY = [this.mtop + 30 * S, this.mtop + 70 * S];
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 0 : this.mx + this.mw + 14 * S;
      const x1 = side < 0 ? this.mx - 14 * S : W;
      if (x1 - x0 < 30) continue;
      for (const y of shelfY) {
        g.fillStyle = "#d9a06a";
        g.fillRect(x0, y, x1 - x0, 7 * S * 0.4 + 4);
        g.fillStyle = "rgba(90,50,20,.25)";
        g.fillRect(x0, y + 7 * S * 0.4 + 4, x1 - x0, 4);
        let x = x0 + 8;
        let i = 0;
        const cols = ["#8fd3ff", "#ffb3d1", "#ffe27a", "#b9a3ff", "#9fe6b8"];
        while (x < x1 - 20) {
          const w = 16 + ((i * 37) % 22);
          const h = 18 + ((i * 53) % 26);
          g.fillStyle = cols[i % cols.length];
          rr(g, x, y - h, w, h, 3);
          g.fill();
          g.fillStyle = "rgba(255,255,255,.55)";
          g.fillRect(x + 3, y - h + 4, w - 6, 3);
          x += w + 6;
          i += 1;
        }
      }
    }
    // 기계 그림자
    g.fillStyle = "rgba(90,40,20,.22)";
    g.beginPath();
    g.ellipse(this.cx, this.mbot + 2, this.mw * 0.56, 10 * S * 0.4 + 6, 0, 0, TAU);
    g.fill();
  }

  /** 캐비닛 겉 (프레임 · 간판 · 아래 받침 · 배출구 문) */
  paintCabinet(g) {
    const { S, theme: T, mx, mw, mtop, mbot } = this;
    const body = g.createLinearGradient(mx, 0, mx + mw, 0);
    body.addColorStop(0, T.body[1]);
    body.addColorStop(0.12, T.body[0]);
    body.addColorStop(0.88, T.body[0]);
    body.addColorStop(1, T.body[1]);
    // 몸통
    g.fillStyle = body;
    rr(g, mx, mtop + 14 * S, mw, mbot - mtop - 14 * S, 6 * S);
    g.fill();
    g.strokeStyle = "rgba(90,20,50,.45)";
    g.lineWidth = Math.max(2, S * 0.6);
    g.stroke();
    // 간판
    const sg = g.createLinearGradient(0, mtop, 0, mtop + 20 * S);
    sg.addColorStop(0, "#fff3b0");
    sg.addColorStop(1, T.trim);
    g.fillStyle = sg;
    rr(g, mx - 2 * S, mtop, mw + 4 * S, 21 * S, [10 * S, 10 * S, 4 * S, 4 * S]);
    g.fill();
    g.strokeStyle = "rgba(150,90,10,.6)";
    g.stroke();
    this.bulbs = [];
    for (let i = 0; i < 15; i += 1) this.bulbs.push([mx + 4 * S + (i * (mw - 8 * S)) / 14, mtop + 2.6 * S]);
    for (let i = 0; i < 15; i += 1) this.bulbs.push([mx + 4 * S + (i * (mw - 8 * S)) / 14, mtop + 18.4 * S]);
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `400 ${11 * S}px "Bagel Fat One", "Jua", sans-serif`;
    g.lineJoin = "round";
    g.lineWidth = 2.6 * S;
    g.strokeStyle = "#a8326b";
    g.strokeText("CLAW MASTER", this.cx, mtop + 10.8 * S);
    g.fillStyle = "#fff";
    g.fillText("CLAW MASTER", this.cx, mtop + 10.8 * S);
    g.restore();
    // 안쪽 창 (유리 둘레 은색 틀)
    const fx0 = this.X(BOX.x0, 0);
    const fx1 = this.X(BOX.x1, 0);
    const fy0 = this.Y(BOX.top, BOX.z1) - 2 * S;
    const fy1 = this.floorY + 1.5 * S;
    this.win = { x: fx0, y: fy0, w: fx1 - fx0, h: fy1 - fy0 };
    g.fillStyle = "#e9edf5";
    rr(g, fx0 - 3 * S, fy0 - 3 * S, fx1 - fx0 + 6 * S, fy1 - fy0 + 6 * S, 4 * S);
    g.fill();
    g.strokeStyle = "#9aa4b8";
    g.lineWidth = Math.max(1.5, S * 0.5);
    g.stroke();
    // 아래 받침: 조작판 · 동전 · 배출구 문
    const by = fy1 + 4 * S;
    g.fillStyle = "rgba(255,255,255,.18)";
    rr(g, mx + 4 * S, by, mw - 8 * S, mbot - by - 4 * S, 4 * S);
    g.fill();
    // 배출구 문 (왼쪽 아래: 안의 배출구와 같은 쪽)
    const dx = this.X(-40, 0) - 12 * S;
    const dy = by + 3 * S;
    g.fillStyle = "#3a2030";
    rr(g, dx, dy, 24 * S, 14 * S, 3 * S);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.22)";
    rr(g, dx + 1.5 * S, dy + 1.5 * S, 21 * S, 5 * S, 2 * S);
    g.fill();
    g.fillStyle = "#fff";
    g.font = `400 ${3.4 * S}px "Jua", sans-serif`;
    g.textAlign = "center";
    g.fillText("PRIZE", dx + 12 * S, dy + 11.5 * S);
    this.door = { x: dx, y: dy, w: 24 * S, h: 14 * S };
    // 동전 투입구
    const cx = this.X(40, 0);
    g.fillStyle = "#c9cfdc";
    rr(g, cx - 6 * S, dy, 12 * S, 14 * S, 2.5 * S);
    g.fill();
    g.fillStyle = "#2a2a36";
    rr(g, cx - 0.8 * S, dy + 3 * S, 1.6 * S, 6 * S, 1);
    g.fill();
    g.fillStyle = "#ffd84a";
    g.font = `400 ${3 * S}px "Jua", sans-serif`;
    g.fillText("COIN", cx, dy + 12.6 * S);
    // 조이스틱 장식
    const jx = this.cx;
    g.fillStyle = "#5c5470";
    rr(g, jx - 9 * S, dy + 8 * S, 18 * S, 4 * S, 2 * S);
    g.fill();
    g.strokeStyle = "#3a3448";
    g.lineWidth = 1.8 * S;
    g.beginPath();
    g.moveTo(jx - 3 * S, dy + 9 * S);
    g.lineTo(jx - 4 * S, dy + 2 * S);
    g.stroke();
    g.fillStyle = "#ff4d6d";
    g.beginPath();
    g.arc(jx - 4 * S, dy + 2 * S, 2.6 * S, 0, TAU);
    g.fill();
    g.fillStyle = "#ffd23f";
    g.beginPath();
    g.arc(jx + 5 * S, dy + 9 * S, 2.6 * S, 0, TAU);
    g.fill();
  }

  /** 기계 안: 뒷벽 · 옆벽 · 바닥 · 레일 */
  paintInside(g) {
    const { S, theme: T } = this;
    const P = (x, y, z) => [this.X(x, z), this.Y(y, z)];
    const quad = (a, b, c, d) => {
      g.beginPath();
      g.moveTo(...a);
      g.lineTo(...b);
      g.lineTo(...c);
      g.lineTo(...d);
      g.closePath();
    };
    g.save();
    g.beginPath();
    g.rect(this.win.x, this.win.y, this.win.w, this.win.h);
    g.clip();
    // 천장 (어두운 안쪽)
    g.fillStyle = "#3a2a3e";
    g.fillRect(this.win.x, this.win.y, this.win.w, this.win.h);
    // 뒷벽
    const back = g.createLinearGradient(0, this.Y(BOX.top, BOX.z1), 0, this.Y(0, BOX.z1));
    back.addColorStop(0, T.back[1]);
    back.addColorStop(1, T.back[0]);
    quad(P(BOX.x0, 0, BOX.z1), P(BOX.x1, 0, BOX.z1), P(BOX.x1, BOX.top, BOX.z1), P(BOX.x0, BOX.top, BOX.z1));
    g.fillStyle = back;
    g.fill();
    // 뒷벽 별 무늬
    g.save();
    g.clip();
    g.fillStyle = "rgba(255,255,255,.6)";
    for (let i = 0; i < 26; i += 1) {
      const x = BOX.x0 + ((i * 37) % 100);
      const y = 10 + ((i * 53) % 78);
      const [sx, sy] = P(x, y, BOX.z1);
      star(g, sx, sy, (1.4 + (i % 3)) * S * 0.78);
    }
    g.restore();
    // 옆벽
    for (const xs of [BOX.x0, BOX.x1]) {
      quad(P(xs, 0, 0), P(xs, 0, BOX.z1), P(xs, BOX.top, BOX.z1), P(xs, BOX.top, 0));
      const sg = g.createLinearGradient(this.X(xs, 0), 0, this.X(xs, BOX.z1), 0);
      sg.addColorStop(0, "#f5d6e6");
      sg.addColorStop(1, "#e8bcd2");
      g.fillStyle = sg;
      g.fill();
      // 거울 같은 세로 줄
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.lineWidth = Math.max(1, S * 0.3);
      for (const z of [15, 30, 45]) {
        g.beginPath();
        g.moveTo(...P(xs, 0, z));
        g.lineTo(...P(xs, BOX.top, z));
        g.stroke();
      }
    }
    // 바닥 (폭신한 카펫)
    quad(P(BOX.x0, 0, 0), P(BOX.x1, 0, 0), P(BOX.x1, 0, BOX.z1), P(BOX.x0, 0, BOX.z1));
    const fl = g.createLinearGradient(0, this.Y(0, BOX.z1), 0, this.floorY);
    fl.addColorStop(0, T.floor[1]);
    fl.addColorStop(1, T.floor[0]);
    g.fillStyle = fl;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = "rgba(255,255,255,.25)";
    for (let i = 0; i < 120; i += 1) {
      const [sx, sy] = P(BOX.x0 + ((i * 41) % 100), 0, (i * 23) % 60);
      g.fillRect(sx, sy, S * 0.5, S * 0.3);
    }
    g.restore();
    // 배출구 구멍 (어둡게)
    quad(P(CHUTE.x0, 0, 0), P(CHUTE.x1, 0, 0), P(CHUTE.x1, 0, CHUTE.z1), P(CHUTE.x0, 0, CHUTE.z1));
    g.fillStyle = "#2a1626";
    g.fill();
    // 위 조명 띠
    const lg = g.createLinearGradient(0, this.Y(BOX.top, 30), 0, this.Y(BOX.top - 18, 30));
    lg.addColorStop(0, "rgba(255,250,220,.75)");
    lg.addColorStop(1, "rgba(255,250,220,0)");
    g.fillStyle = lg;
    g.fillRect(this.win.x, this.Y(BOX.top, BOX.z1), this.win.w, 22 * S);
    // 레일 (양옆, 앞뒤 방향)
    g.strokeStyle = "#8a93a8";
    g.lineWidth = Math.max(2, S * 1.1);
    g.lineCap = "round";
    for (const xs of [BOX.x0 + 2, BOX.x1 - 2]) {
      g.beginPath();
      g.moveTo(...P(xs, RAIL_Y + 3, 2));
      g.lineTo(...P(xs, RAIL_Y + 3, BOX.z1 - 2));
      g.stroke();
    }
    g.restore();
  }

  /** 유리 반사 · 배출구 아크릴 (인형 위에 덮어 그린다) */
  paintGlass(g) {
    const { S, win } = this;
    const P = (x, y, z) => [this.X(x, z), this.Y(y, z)];
    g.save();
    g.beginPath();
    g.rect(win.x, win.y, win.w, win.h);
    g.clip();
    // 배출구 아크릴 벽
    const panel = (a, b, c, d) => {
      g.beginPath();
      g.moveTo(...a);
      g.lineTo(...b);
      g.lineTo(...c);
      g.lineTo(...d);
      g.closePath();
      g.fillStyle = "rgba(200,240,255,.22)";
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.8)";
      g.lineWidth = Math.max(1.2, S * 0.4);
      g.stroke();
    };
    panel(P(CHUTE.x1, 0, 0), P(CHUTE.x1, 0, CHUTE.z1), P(CHUTE.x1, CHUTE.h, CHUTE.z1), P(CHUTE.x1, CHUTE.h, 0));
    panel(P(CHUTE.x0, 0, CHUTE.z1), P(CHUTE.x1, 0, CHUTE.z1), P(CHUTE.x1, CHUTE.h, CHUTE.z1), P(CHUTE.x0, CHUTE.h, CHUTE.z1));
    g.fillStyle = "rgba(255,255,255,.85)";
    g.font = `400 ${3.6 * S}px "Jua", sans-serif`;
    g.textAlign = "center";
    const [lx, ly] = P((CHUTE.x0 + CHUTE.x1) / 2, CHUTE.h * 0.55, 0);
    g.fillText("PRIZE", lx, ly);
    // 앞 유리 빛줄기
    g.globalCompositeOperation = "screen";
    for (const [x, w, a] of [[0.12, 0.08, 0.18], [0.22, 0.03, 0.14], [0.7, 0.06, 0.1]]) {
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.beginPath();
      g.moveTo(win.x + win.w * x, win.y);
      g.lineTo(win.x + win.w * (x + w), win.y);
      g.lineTo(win.x + win.w * (x + w - 0.18), win.y + win.h);
      g.lineTo(win.x + win.w * (x - 0.18), win.y + win.h);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  /* ---------- 인형 그림 캐시 ---------- */
  sprite(kind, eye, mouth) {
    const key = `${kind}|${eye}|${mouth}`;
    let sp = this.sprites.get(key);
    if (sp) return sp;
    const def = dollById(kind);
    let m = 0;
    let cx = 0;
    let cy = 0;
    for (const [x, y, r] of def.sph) {
      const mi = r * r * r;
      m += mi;
      cx += x * mi;
      cy += y * mi;
    }
    cx /= m;
    cy /= m;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [x, y, r] of def.sph) {
      x0 = Math.min(x0, x - cx - r);
      x1 = Math.max(x1, x - cx + r);
      y0 = Math.min(y0, -(y - cy) - r);
      y1 = Math.max(y1, -(y - cy) + r);
    }
    x0 -= 9;
    x1 += 9;
    y0 -= 12;
    y1 += 3;
    const ref = Math.min(9, this.S * 1.6) * this.dpr;
    const c = document.createElement("canvas");
    c.width = Math.ceil((x1 - x0) * ref);
    c.height = Math.ceil((y1 - y0) * ref);
    const g = c.getContext("2d");
    drawPlush(g, kind, -x0 * ref, -y0 * ref, ref, 0, { t: 0.4, eye, mouth, ear: 0, comX: cx, comY: cy });
    let pivot = 0;
    for (const [, y, r] of def.sph) if (r > 3) pivot = Math.max(pivot, y - cy);
    sp = { c, ox: -x0 * ref, oy: -y0 * ref, ref, bottom: y1, pivot };
    this.sprites.set(key, sp);
    return sp;
  }

  /* ---------- 매 프레임 ---------- */
  draw(g, sim, st) {
    const { S } = this;
    st.dt = st.dt || 1 / 60;
    st.touches = sim.touches || [];
    if (this.soft.size > sim.dolls.length + 30) for (const id of [...this.soft.keys()]) if (!sim.dolls.some((d) => d.id === id)) this.soft.delete(id);
    g.drawImage(this.bg, 0, 0, this.W, this.H);
    // 간판 전구
    const t = st.t;
    this.bulbs.forEach(([x, y], i) => {
      const on = st.party ? (Math.floor(t * 10) + i) % 2 === 0 : (Math.floor(t * 3) + i) % 3 !== 0;
      g.fillStyle = on ? "#fffbe0" : "#e0a83a";
      g.beginPath();
      g.arc(x, y, Math.max(1.5, S * 0.9), 0, TAU);
      g.fill();
      if (on) {
        g.fillStyle = "rgba(255,240,150,.35)";
        g.beginPath();
        g.arc(x, y, S * 1.8, 0, TAU);
        g.fill();
      }
    });
    const win = this.win;
    g.save();
    g.beginPath();
    g.rect(win.x, win.y, win.w, win.h);
    g.clip();
    // 레일 다리 (앞뒤로 움직이는 가로대 + 수레)
    const bz = sim.cz;
    g.strokeStyle = "#b8c0d2";
    g.lineWidth = Math.max(3, S * 1.6);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(this.X(BOX.x0 + 2, bz), this.Y(RAIL_Y + 3, bz));
    g.lineTo(this.X(BOX.x1 - 2, bz), this.Y(RAIL_Y + 3, bz));
    g.stroke();
    g.strokeStyle = "rgba(60,60,80,.5)";
    g.lineWidth = Math.max(1, S * 0.4);
    g.stroke();
    // 가로대 양 끝: 옆 레일 위를 앞뒤로 미끄러지는 받침
    const bsc = this.sc(bz);
    for (const xs of [BOX.x0 + 2, BOX.x1 - 2]) {
      const x = this.X(xs, bz);
      const y = this.Y(RAIL_Y + 3, bz);
      g.fillStyle = this.skin.c[1];
      rr(g, x - 3 * bsc, y - 2.4 * bsc, 6 * bsc, 4.8 * bsc, 1.2 * bsc);
      g.fill();
      g.strokeStyle = this.skin.c[2];
      g.lineWidth = Math.max(1, bsc * 0.4);
      g.stroke();
    }
    if (st.guide > 0.01) this.drawGuide(g, sim, st.guide);
    // 그릴 것들을 깊이 순서로
    const items = [];
    // 집게 안에 들어온 인형(발에 닿았거나, 잡혔거나, 내려오는 집게 바로 밑)은 뒷발과 앞발 사이에 그린다.
    // 그래야 발이 인형을 감싸 보이고, 인형이 조금 앞에 있어도 집게 머리 · 앞발을 덮지 않는다.
    st.engaged = false;
    for (const d of sim.dolls) {
      const inCage = d.held || d.prongN > 0 || (Math.hypot(d.x - sim.hx, d.z - sim.hz) < 10 && d.y < sim.hy && d.y > sim.hy - 32);
      if (inCage) st.engaged = true;
      items.push({ z: inCage ? sim.hz + Math.max(-2.5, Math.min(2.5, d.z - sim.hz)) : d.z, d });
    }
    items.push({ z: sim.hz + 3, claw: "back" });
    items.push({ z: sim.hz - 3, claw: "front" });
    items.sort((a, b) => b.z - a.z);
    // 집게 그림자: 바로 아래 가장 높은 곳에
    const shadowY = st.groundY;
    let shadowDone = false;
    // 그림자가 인형 위에 떨어지면 그 인형 바로 다음에 (앞 인형에 가려지지 않게)
    const onDoll = st.groundOn;
    for (const it of items) {
      if (!shadowDone && !onDoll && it.z < sim.hz) {
        this.drawShadow(g, sim, shadowY, st);
        shadowDone = true;
      }
      if (it.d) this.drawDoll(g, it.d, st);
      else this.drawClaw(g, sim, it.claw, st);
      if (!shadowDone && onDoll && it.d && it.d.id === onDoll) {
        this.drawShadow(g, sim, shadowY, st);
        shadowDone = true;
      }
    }
    if (!shadowDone) this.drawShadow(g, sim, shadowY, st);
    // 수레 + 케이블
    const tx = this.X(sim.cx, sim.cz);
    const ty = this.Y(RAIL_Y + 3, sim.cz);
    const hx = this.X(sim.hx, sim.hz);
    const hy = this.Y(sim.hy + 4.5, sim.hz);
    const slack = Math.max(0, sim.slackNow || 0);
    const tension = Math.min(1, (sim.ropeT || 0) * 1e-4 / 9); // 0~9N
    g.strokeStyle = tension > 0.55 ? "#7f89a2" : "#5e6880";
    g.lineWidth = Math.max(1.2, S * (0.32 + tension * 0.12));
    g.beginPath();
    g.moveTo(tx, ty);
    if (slack > 0.4) {
      // 느슨한 케이블: 아래로 처진다
      const sag = Math.min(10, slack * 0.7) * this.sc(sim.hz);
      g.quadraticCurveTo((tx + hx) / 2 + sag * 0.4, (ty + hy) / 2 + sag, hx, hy);
    } else g.lineTo(hx, hy);
    g.stroke();
    const sk = this.skin.c;
    const sc = this.sc(sim.cz);
    g.fillStyle = sk[1];
    rr(g, tx - 4 * sc, ty - 2.5 * sc, 8 * sc, 5 * sc, 1.5 * sc);
    g.fill();
    g.strokeStyle = sk[2];
    g.lineWidth = Math.max(1, sc * 0.4);
    g.stroke();
    // 배출구 빛 (획득 직후)
    for (const p of this.pops) {
      if (p.t > 0.9) continue;
      const a = 1 - p.t / 0.9;
      const cxp = this.X((CHUTE.x0 + CHUTE.x1) / 2, CHUTE.z1 / 2);
      const cyp = this.Y(0, CHUTE.z1 / 2);
      const R = 22 * S;
      const gr = g.createRadialGradient(cxp, cyp, 0, cxp, cyp, R);
      gr.addColorStop(0, `rgba(255,240,150,${0.7 * a})`);
      gr.addColorStop(1, "rgba(255,240,150,0)");
      g.fillStyle = gr;
      g.fillRect(cxp - R, cyp - R, R * 2, R * 2);
    }
    g.restore();
    g.drawImage(this.over, 0, 0, this.W, this.H);
    this.drawPops(g, st.dt);
    if (st.debug) this.drawDebug(g, sim);
  }

  /** 앞문으로 나온 인형: 통통 튀다가 사라진다 */
  drawPops(g, dt) {
    const door = this.door;
    if (!door) return;
    for (const p of this.pops) {
      p.t += dt;
      const sp = this.sprite(p.kind, "happy", "smile");
      const h = door.h * 1.5;
      const k = h / (sp.c.height || 1);
      const hop = Math.abs(Math.sin(p.t * 7)) * Math.exp(-p.t * 2) * door.h * 1.1;
      const land = Math.max(0, 1 - Math.abs(Math.sin(p.t * 7)) * 4) * Math.exp(-p.t * 2);
      const x = door.x + door.w / 2;
      const y = door.y + door.h * 0.9 - hop;
      g.save();
      g.globalAlpha = p.t > 2 ? Math.max(0, 1 - (p.t - 2) / 0.5) : 1;
      // 문 안쪽 빛
      const gr = g.createRadialGradient(x, door.y + door.h / 2, 0, x, door.y + door.h / 2, door.w * 0.8);
      gr.addColorStop(0, "rgba(255,236,140,.55)");
      gr.addColorStop(1, "rgba(255,236,140,0)");
      g.fillStyle = gr;
      g.fillRect(x - door.w, door.y - door.h, door.w * 2, door.h * 2);
      g.translate(x, y);
      g.scale(k * (1 + land * 0.18), k * (1 - land * 0.16));
      g.drawImage(sp.c, -sp.c.width / 2, -sp.c.height);
      g.restore();
    }
    this.pops = this.pops.filter((p) => p.t < 2.5);
  }

  /** 개발자 전용 물리 그림: 충돌 구 · 무게중심 · 발 · 접촉점 · 케이블 힘 (?debug=1) */
  drawDebug(g, sim) {
    const P = (x, y, z) => [this.X(x, z), this.Y(y, z)];
    g.save();
    g.lineWidth = 1;
    g.font = "11px monospace";
    for (const d of sim.dolls) {
      g.strokeStyle = d.held ? "rgba(0,200,90,.9)" : d.sleep ? "rgba(120,120,140,.6)" : "rgba(0,170,255,.85)";
      for (const s of d.sw || []) {
        const [x, y] = P(s[0], s[1], s[2]);
        g.beginPath();
        g.arc(x, y, s[3] * this.sc(s[2]), 0, TAU);
        g.stroke();
      }
      const [cx, cy] = P(d.x, d.y, d.z);
      g.fillStyle = "#ff3b6b";
      g.beginPath();
      g.arc(cx, cy, 3, 0, TAU);
      g.fill();
      // 속도 화살표
      g.strokeStyle = "#ff8a00";
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + d.vx * 0.25 * this.S * 0.4, cy - d.vy * 0.25 * this.S * 0.4);
      g.stroke();
      g.fillStyle = "rgba(20,20,40,.85)";
      g.fillText(`${d.def.ko} ${Math.round(d.m * 10)}g z${d.z.toFixed(0)}${d.held ? " 잡힘" : ""}${d.sleep ? " 잠" : ""}`, cx + 5, cy - 4);
    }
    // 집게 발 (캡슐) · 머리
    const pts = sim.pp || [];
    pts.forEach((pp, i) => {
      g.strokeStyle = "rgba(255,40,80,.35)";
      g.lineCap = "round";
      g.lineWidth = Math.max(2, PRONG.r * 2 * this.sc(pp[0][2]));
      g.beginPath();
      g.moveTo(...P(pp[0][0], pp[0][1], pp[0][2]));
      g.lineTo(...P(pp[1][0], pp[1][1], pp[1][2]));
      g.lineTo(...P(pp[2][0], pp[2][1], pp[2][2]));
      g.stroke();
      const [tx, ty] = P(pp[2][0], pp[2][1], pp[2][2]);
      g.fillStyle = "#c0003a";
      g.fillText(`발${i + 1} ${((sim.prongF[i] || 0) * 1e-4).toFixed(1)}N ${Math.round((sim.prongs[i].a * 180) / Math.PI)}°`, tx + 4, ty + 12);
    });
    const [hx, hy] = P(sim.hx, sim.hy, sim.hz);
    g.strokeStyle = "rgba(255,40,80,.6)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(hx, hy, 4.6 * this.sc(sim.hz), 0, TAU);
    g.stroke();
    // 접촉점 · 미는 방향
    g.strokeStyle = "#ffd400";
    g.fillStyle = "#ffd400";
    for (const t of sim.touches || []) {
      const [x, y] = P(t.p[0], t.p[1], t.p[2]);
      g.beginPath();
      g.arc(x, y, 2.5, 0, TAU);
      g.fill();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + t.n[0] * 14, y - t.n[1] * 14);
      g.stroke();
    }
    // 케이블 (연결 제약) 힘
    const [tx, ty] = P(sim.cx, RAIL_Y, sim.cz);
    g.fillStyle = "#334";
    g.fillText(`케이블 ${((sim.ropeT || 0) * 1e-4).toFixed(1)}N · 길이 ${sim.L.toFixed(1)} · ${PHASE_KO[sim.phase] || sim.phase}`, tx + 6, ty + 14);
    g.restore();
  }

  /** 조준선: 집게 아래를 지나는 바닥의 십자선 + 양옆 벽의 세로 빛줄 (앞뒤 위치가 한눈에) */
  drawGuide(g, sim, k) {
    const { S } = this;
    const P = (x, y, z) => [this.X(x, z), this.Y(y, z)];
    const x = sim.hx;
    const z = Math.max(BOX.z0, Math.min(BOX.z1, sim.hz));
    const segs = [
      [P(BOX.x0, 0.2, z), P(BOX.x1, 0.2, z)],
      [P(x, 0.2, BOX.z0), P(x, 0.2, BOX.z1)],
      [P(BOX.x0, 0, z), P(BOX.x0, RAIL_Y, z)],
      [P(BOX.x1, 0, z), P(BOX.x1, RAIL_Y, z)],
    ];
    g.save();
    g.lineCap = "round";
    for (const [w, a] of [[S * 1.8, 0.16], [Math.max(1, S * 0.4), 0.7]]) {
      g.strokeStyle = `rgba(255,${a > 0.5 ? 120 : 90},${a > 0.5 ? 170 : 150},${a * k})`;
      g.lineWidth = w;
      g.beginPath();
      for (const [p, q] of segs) {
        g.moveTo(p[0], p[1]);
        g.lineTo(q[0], q[1]);
      }
      g.stroke();
    }
    // 옆벽에 닿는 곳에 작은 빛
    g.fillStyle = `rgba(255,255,255,${0.85 * k})`;
    for (const xs of [BOX.x0, BOX.x1]) {
      const p = P(xs, RAIL_Y - 2, z);
      g.beginPath();
      g.arc(p[0], p[1], Math.max(1.5, S * 0.7), 0, TAU);
      g.fill();
    }
    g.restore();
  }

  drawShadow(g, sim, gy, st) {
    const sc = this.sc(sim.hz);
    const x = this.X(sim.hx, sim.hz);
    const y = this.Y(gy, sim.hz);
    const k = Math.max(0.35, 1 - (sim.hy - gy) / 120);
    g.fillStyle = `rgba(40,10,40,${0.28 * k})`;
    g.beginPath();
    g.ellipse(x, y, 9 * sc, 3.2 * sc, 0, 0, TAU);
    g.fill();
    if (st.moving) {
      // 내려갈 곳: 점선 + 동그라미
      g.strokeStyle = "rgba(255,80,140,.75)";
      g.lineWidth = Math.max(1, sc * 0.35);
      g.setLineDash([sc * 1.6, sc * 1.2]);
      g.beginPath();
      g.moveTo(x, this.Y(sim.hy - 12, sim.hz));
      g.lineTo(x, y);
      g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.ellipse(x, y, 4 * sc, 1.5 * sc, 0, 0, TAU);
      g.stroke();
    }
  }

  drawDoll(g, d, st) {
    const sc = this.sc(d.z);
    const x = this.X(d.x, d.z);
    const y = this.Y(d.y, d.z);
    const face = st.faces.get(d.id) || { eye: "open", mouth: "smile" };
    const sp = this.sprite(d.kind, face.eye, face.mouth);
    const k = sc / sp.ref;
    const soft = this.softOf(d, st.dt);
    d.grip = soft.grip; // 점검용
    g.save();
    g.translate(x, y);
    g.rotate(-d.a);
    // 몸통 휨: 머리(잡힌 자리)를 축으로
    if (Math.abs(soft.bend) > 0.002) {
      const py = -sp.pivot * sc;
      g.translate(0, py);
      g.rotate(soft.bend);
      g.translate(0, -py);
    }
    // 찌그러짐: 바닥 쪽 기준 (착지 출렁임 + 발에 눌림 + 숨쉬기)
    g.translate(0, sp.bottom * sc);
    g.scale((1 + soft.k * 0.6) * (1 - soft.grip * 0.09), (1 - soft.k) * (1 + soft.grip * 0.05) * (1 + 0.018 * Math.sin(st.t * 2.2 + d.id * 1.7)));
    g.translate(0, -sp.bottom * sc);
    if (st.target === d.id) {
      g.shadowColor = `rgba(255,90,160,${0.5 + 0.5 * st.targetK})`;
      g.shadowBlur = (5 + 7 * st.targetK) * this.dpr;
    }
    g.drawImage(sp.c, -sp.ox * k, -sp.oy * k, sp.c.width * k, sp.c.height * k);
    g.restore();
    // 발이 누른 자리: 천이 오목하게 들어간 그늘 (앞에서 보이는 쪽만)
    for (const t of st.touches) {
      if (t.id !== d.id || t.n[2] < -0.3 || t.depth < 0.2) continue;
      const px = this.X(t.p[0], t.p[2]);
      const py = this.Y(t.p[1], t.p[2]);
      const R = (1.4 + t.depth * 0.9) * this.sc(t.p[2]);
      const gr = g.createRadialGradient(px, py, 0, px, py, R);
      gr.addColorStop(0, `rgba(110,45,80,${Math.min(0.34, 0.08 + t.depth * 0.1)})`);
      gr.addColorStop(1, "rgba(110,45,80,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(px, py, R, 0, TAU);
      g.fill();
    }
  }

  drawClaw(g, sim, part, st) {
    const sk = this.skin.c;
    const pts = sim.pp || sim.prongs.map((p) => sim.prongPts(p));
    const P = (p) => [this.X(p[0], p[2]), this.Y(p[1], p[2])];
    const sc = this.sc(sim.hz);
    const drawProng = (pp, i) => {
      const a = P(pp[0]);
      const b = P(pp[1]);
      const c = P(pp[2]);
      g.lineCap = "round";
      g.lineJoin = "round";
      if (part === "front" && st.engaged) {
        // 인형을 누르는 앞발: 인형 위에 얇은 그림자 (발이 인형 표면에 닿아 보이게)
        g.strokeStyle = "rgba(70,20,50,.28)";
        g.lineWidth = Math.max(2, 4.6 * sc);
        g.beginPath();
        g.moveTo(a[0] + 0.7 * sc, a[1] + 1.1 * sc);
        g.lineTo(b[0] + 0.7 * sc, b[1] + 1.1 * sc);
        g.lineTo(c[0] + 0.7 * sc, c[1] + 1.1 * sc);
        g.stroke();
      }
      for (const [w, col] of [[3.4, sk[2]], [2.3, sk[1]], [0.9, sk[0]]]) {
        g.strokeStyle = col;
        g.lineWidth = Math.max(1, w * sc);
        g.beginPath();
        g.moveTo(...a);
        g.lineTo(...b);
        g.lineTo(...c);
        g.stroke();
      }
      g.fillStyle = sk[2];
      g.beginPath();
      g.arc(b[0], b[1], 1.6 * sc, 0, TAU);
      g.fill();
      // 발끝 고무
      g.fillStyle = this.skin.rainbow ? ["#ff8fb8", "#ffd84a", "#7fd6ff"][i] : "#ff7aa8";
      g.beginPath();
      g.arc(c[0], c[1], 1.5 * sc, 0, TAU);
      g.fill();
    };
    if (part === "back") {
      // 뒤쪽 두 발 (화면 안쪽으로 뻗은)
      pts.forEach((pp, i) => {
        if (sim.prongs[i].rz > 0) drawProng(pp, i);
      });
      return;
    }
    // 머리 (원통)
    const hx = this.X(sim.hx, sim.hz);
    const hy = this.Y(sim.hy, sim.hz);
    const r = 5.2 * sc;
    const body = g.createLinearGradient(hx - r, 0, hx + r, 0);
    body.addColorStop(0, sk[2]);
    body.addColorStop(0.35, sk[0]);
    body.addColorStop(1, sk[1]);
    g.fillStyle = body;
    g.fillRect(hx - r, hy - 4.5 * sc, r * 2, 6.5 * sc);
    g.beginPath();
    g.ellipse(hx, hy + 2 * sc, r, r * 0.35, 0, 0, TAU);
    g.fill();
    g.fillStyle = sk[0];
    g.beginPath();
    g.ellipse(hx, hy - 4.5 * sc, r, r * 0.35, 0, 0, TAU);
    g.fill();
    g.strokeStyle = sk[2];
    g.lineWidth = Math.max(1, sc * 0.35);
    g.stroke();
    if (this.skin.sparkle || this.skin.rainbow) {
      const tw = 0.5 + Math.sin(st.t * 5) * 0.5;
      g.fillStyle = `rgba(255,255,255,${tw})`;
      star(g, hx + r * 0.5, hy - 2 * sc, 1.6 * sc);
    }
    pts.forEach((pp, i) => {
      if (sim.prongs[i].rz <= 0) drawProng(pp, i);
    });
  }
}

function star(g, x, y, R) {
  g.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const q = i % 2 ? R * 0.45 : R;
    g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  g.closePath();
  g.fill();
}
export { PRONG };
