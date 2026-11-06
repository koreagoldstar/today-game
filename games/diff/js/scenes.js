/*
 * 다른 그림 찾기 — 장면을 코드로 그린다.
 *  장면 = 배경 + 물건 목록. 물건마다 "바꿀 수 있는 곳(parts)" 이 있어
 *  오른쪽 그림은 그 중 몇 곳만 바꿔 그린다 (지붕 색 · 굴뚝 · 사과 하나 · 모자 …).
 */
import { Puppet } from "../../bubble-sumo-kings/js/rig.js?v=1";

export const SW = 800;
export const SH = 600;
const INK = "#4b3428";
const TAU = Math.PI * 2;

/* ---------- 도구 ---------- */
export function mulberry32(a) {
  return function rand() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const other = (r, a, v) => pick(r, a.filter((x) => x !== v));
const between = (r, a, b) => a + r() * (b - a);

function fillStroke(g, fill, lw = 3) {
  g.fillStyle = fill;
  g.fill();
  if (lw) {
    g.lineWidth = lw;
    g.strokeStyle = INK;
    g.lineJoin = "round";
    g.stroke();
  }
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function circ(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
}
function ell(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, TAU);
}
function shine(g, x, y, w, h) {
  g.fillStyle = "rgba(255,255,255,.35)";
  rr(g, x, y, w, h, h / 2);
  g.fill();
}
function star5(g, x, y, R, r = R * 0.45) {
  g.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const q = i % 2 ? r : R;
    g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  g.closePath();
}
function heart(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.4, y, x - s * 0.8, y - s * 1, x, y - s * 0.35);
  g.bezierCurveTo(x + s * 0.8, y - s * 1, x + s * 1.4, y, x, y + s * 0.9);
  g.closePath();
}
function flower(g, x, y, r, c) {
  g.fillStyle = c;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * TAU;
    circ(g, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.52);
    g.fill();
    g.lineWidth = 1.6;
    g.strokeStyle = INK;
    g.stroke();
  }
  circ(g, x, y, r * 0.42);
  fillStroke(g, "#ffd23f", 1.6);
}

const C = {
  bright: ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#9775fa", "#f783ac", "#38d9a9"],
  roof: ["#e8594a", "#4a7fd8", "#f0a03c", "#8a5cd0", "#2fa36b", "#d94f8a"],
  wall: ["#fff3dc", "#ffe0e6", "#e3f2ff", "#fff8c4", "#e6f7e1", "#f3e6ff"],
  curtain: ["#ff8fab", "#74c0fc", "#ffd43b", "#8ce99a", "#b197fc", "#ffa94d"],
  pale: ["#ffc9de", "#bfe3ff", "#fff0a8", "#c3f0c8", "#e2d4ff", "#ffd8b0"],
};

/* ---------- 물건 ----------
 * draw(g, p, o): 물건 기준점(0,0)에서 그린다. 크기는 o.s 로 이미 맞춰져 있다.
 * parts(p, r): [{ key, at: [x, y], r, vis, alt: {...바뀐 값} }]  vis 3 은 눈에 잘 띔, 1 은 꼼꼼히 봐야 함
 */
const K = {};

K.sun = {
  draw(g, p) {
    g.save();
    g.strokeStyle = "#ffb703";
    g.lineWidth = 7;
    g.lineCap = "round";
    for (let i = 0; i < p.n; i += 1) {
      const a = (i / p.n) * TAU;
      g.beginPath();
      g.moveTo(Math.cos(a) * 50, Math.sin(a) * 50);
      g.lineTo(Math.cos(a) * 66, Math.sin(a) * 66);
      g.stroke();
    }
    g.restore();
    circ(g, 0, 0, 40);
    fillStroke(g, p.c, 3);
    g.fillStyle = INK;
    circ(g, -13, -4, 4);
    g.fill();
    circ(g, 13, -4, 4);
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.beginPath();
    g.arc(0, 6, 12, 0.2, Math.PI - 0.2);
    g.stroke();
    g.fillStyle = "rgba(255,120,120,.5)";
    circ(g, -24, 8, 6);
    g.fill();
    circ(g, 24, 8, 6);
    g.fill();
  },
  parts: (p) => [{ key: "n", at: [0, 0], r: 66, vis: 1, alt: { n: p.n === 8 ? 11 : 8 } }, { key: "c", at: [0, 0], r: 46, vis: 2, alt: { c: p.c === "#ffd43b" ? "#ff922b" : "#ffd43b" } }],
};

K.moon = {
  draw(g, p) {
    circ(g, 0, 0, 38);
    fillStroke(g, "#fff3bf", 3);
    g.fillStyle = "rgba(230,200,120,.6)";
    for (const [x, y, r] of p.spots) {
      circ(g, x, y, r);
      g.fill();
    }
  },
  parts: (p) => [{ key: "spots", at: [0, 0], r: 40, vis: 1, alt: { spots: p.spots.slice(1) } }],
};

K.cloud = {
  draw(g, p) {
    g.beginPath();
    for (const [x, y, r] of p.b) {
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, TAU);
    }
    g.lineWidth = 6;
    g.strokeStyle = p.night ? "#8d86c9" : "#9cc8ee";
    g.stroke();
    g.fillStyle = p.night ? "#d8d3f5" : "#fff";
    g.fill();
  },
  parts: (p) => [{ key: "b", at: [p.b[p.b.length - 1][0], p.b[p.b.length - 1][1]], r: 34, vis: 1, alt: { b: p.b.slice(0, -1) } }],
  remove: 3,
  size: 70,
};

K.birds = {
  draw(g, p) {
    g.strokeStyle = INK;
    g.lineWidth = 3.4;
    g.lineCap = "round";
    for (const [x, y] of p.b) {
      g.beginPath();
      g.moveTo(x - 12, y - 4);
      g.quadraticCurveTo(x - 5, y - 10, x, y);
      g.quadraticCurveTo(x + 5, y - 10, x + 12, y - 4);
      g.stroke();
    }
  },
  parts: (p) => p.b.map(([x, y], i) => ({ key: "b", at: [x, y], r: 22, vis: 1, alt: { b: p.b.filter((_, j) => j !== i) } })),
};

K.tree = {
  draw(g, p) {
    rr(g, -13, -70, 26, 72, 6);
    fillStroke(g, "#a0703c");
    if (p.hole) {
      ell(g, 0, -40, 6, 9);
      fillStroke(g, "#5a3a1c", 2);
    }
    g.beginPath();
    for (const [x, y, r] of [[0, -150, 58], [-46, -112, 44], [46, -112, 44], [0, -104, 46]]) {
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, TAU);
    }
    g.lineWidth = 6;
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = p.leaf;
    g.fill();
    g.fillStyle = "rgba(255,255,255,.18)";
    circ(g, -18, -168, 22);
    g.fill();
    for (const [x, y] of p.f) {
      circ(g, x, y, 8.5);
      fillStroke(g, p.fc, 2);
      g.fillStyle = "rgba(255,255,255,.6)";
      circ(g, x - 3, y - 3, 2.5);
      g.fill();
    }
  },
  parts: (p, r) => [
    ...p.f.map(([x, y], i) => ({ key: "f", at: [x, y], r: 16, vis: 1, alt: { f: p.f.filter((_, j) => j !== i) } })),
    { key: "fc", at: [0, -130], r: 50, vis: 2, alt: { fc: other(r, ["#ff4d4d", "#ffd43b", "#ff922b", "#cc5de8"], p.fc) } },
    { key: "hole", at: [0, -40], r: 18, vis: 1, alt: { hole: !p.hole } },
    { key: "leaf", at: [0, -130], r: 70, vis: 3, alt: { leaf: p.leaf === "#5fc06a" ? "#f0a03c" : "#5fc06a" } },
  ],
};

K.pine = {
  draw(g, p) {
    rr(g, -9, -24, 18, 26, 4);
    fillStroke(g, "#8a5a2c");
    for (const [y, w] of [[-26, 62], [-70, 50], [-110, 36]]) {
      g.beginPath();
      g.moveTo(-w, y);
      g.lineTo(0, y - 64);
      g.lineTo(w, y);
      g.closePath();
      fillStroke(g, "#2f9e6a");
      if (p.snow) {
        g.beginPath();
        g.moveTo(-w * 0.5, y - 32);
        g.lineTo(0, y - 64);
        g.lineTo(w * 0.5, y - 32);
        g.quadraticCurveTo(0, y - 24, -w * 0.5, y - 32);
        g.fillStyle = "#fff";
        g.fill();
      }
    }
    for (const [x, y, c] of p.o) {
      circ(g, x, y, 6.5);
      fillStroke(g, c, 2);
    }
    if (p.star) {
      star5(g, 0, -176, 15);
      fillStroke(g, "#ffd43b", 2.5);
    }
  },
  parts: (p, r) => [
    { key: "star", at: [0, -176], r: 20, vis: 2, alt: { star: !p.star } },
    ...p.o.map(([x, y, c], i) => ({ key: "o", at: [x, y], r: 14, vis: 1, alt: { o: p.o.map((q, j) => (j === i ? [q[0], q[1], other(r, C.bright, c)] : q)) } })),
  ],
};

K.flowers = {
  draw(g, p) {
    for (const f of p.fl) {
      g.strokeStyle = "#2f8a4a";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(f.x, 0);
      g.lineTo(f.x, -f.h);
      g.stroke();
      ell(g, f.x + 7, -f.h * 0.4, 7, 3.5, -0.5);
      fillStroke(g, "#69c06a", 1.6);
      flower(g, f.x, -f.h, 11, f.c);
    }
  },
  parts: (p, r) =>
    p.fl.flatMap((f, i) => [
      { key: "fl", at: [f.x, -f.h], r: 18, vis: 1, alt: { fl: p.fl.map((q, j) => (j === i ? { ...q, c: other(r, C.bright, q.c) } : q)) } },
      { key: "fl", at: [f.x, -f.h * 0.6], r: 20, vis: 1, alt: { fl: p.fl.filter((_, j) => j !== i) } },
    ]),
};

K.fence = {
  draw(g, p) {
    rr(g, 0, -42, p.n * 26, 9, 3);
    fillStroke(g, p.c, 2.5);
    rr(g, 0, -20, p.n * 26, 9, 3);
    fillStroke(g, p.c, 2.5);
    for (let i = 0; i < p.n; i += 1) {
      if (i === p.miss) continue;
      g.beginPath();
      g.moveTo(i * 26 + 4, 0);
      g.lineTo(i * 26 + 4, -50);
      g.lineTo(i * 26 + 11, -58);
      g.lineTo(i * 26 + 18, -50);
      g.lineTo(i * 26 + 18, 0);
      g.closePath();
      fillStroke(g, p.c, 2.5);
    }
  },
  parts: (p, r) => {
    const i = 1 + Math.floor(r() * (p.n - 2));
    return [
      { key: "miss", at: [i * 26 + 11, -28], r: 20, vis: 2, alt: { miss: i } },
      { key: "c", at: [p.n * 13, -28], r: Math.min(80, p.n * 13), vis: 3, alt: { c: p.c === "#ffffff" ? "#ffd8a8" : "#ffffff" } },
    ];
  },
};

K.house = {
  draw(g, p) {
    const w = p.w;
    const h = p.h;
    // 굴뚝
    if (p.chim) {
      rr(g, w * 0.58, -h - 72, 26, 44, 3);
      fillStroke(g, "#c4694a");
      if (p.snow) {
        rr(g, w * 0.58 - 3, -h - 76, 32, 9, 4);
        fillStroke(g, "#fff", 2);
      }
      if (p.smoke) {
        g.fillStyle = "rgba(255,255,255,.85)";
        for (const [x, y, r] of [[w * 0.62, -h - 86, 9], [w * 0.68, -h - 102, 12], [w * 0.62, -h - 122, 14]]) {
          circ(g, x, y, r);
          g.fill();
        }
      }
    }
    rr(g, 0, -h, w, h, 4);
    fillStroke(g, p.wall);
    // 지붕
    g.beginPath();
    if (p.round) {
      g.moveTo(-16, -h + 4);
      g.quadraticCurveTo(w / 2, -h - 120, w + 16, -h + 4);
    } else {
      g.moveTo(-18, -h + 4);
      g.lineTo(w / 2, -h - 78);
      g.lineTo(w + 18, -h + 4);
    }
    g.closePath();
    fillStroke(g, p.roof);
    if (p.snow) {
      g.beginPath();
      if (p.round) {
        g.moveTo(-10, -h - 6);
        g.quadraticCurveTo(w / 2, -h - 124, w + 10, -h - 6);
        g.quadraticCurveTo(w / 2, -h - 98, -10, -h - 6);
      } else {
        g.moveTo(-12, -h - 2);
        g.lineTo(w / 2, -h - 80);
        g.lineTo(w + 12, -h - 2);
        g.quadraticCurveTo(w / 2, -h - 50, -12, -h - 2);
      }
      fillStroke(g, "#fff", 2.5);
    }
    // 창문
    for (const win of p.win) {
      const x = win.x * w;
      const y = -h + win.y * h;
      if (win.round) {
        circ(g, x, y, 22);
        fillStroke(g, p.lit ? "#ffe8a3" : "#bfe7ff");
      } else {
        rr(g, x - 22, y - 22, 44, 44, 4);
        fillStroke(g, p.lit ? "#ffe8a3" : "#bfe7ff");
      }
      g.save();
      if (win.round) circ(g, x, y, 22);
      else rr(g, x - 22, y - 22, 44, 44, 4);
      g.clip();
      g.fillStyle = win.c;
      g.beginPath();
      g.moveTo(x - 24, y - 24);
      g.quadraticCurveTo(x - 10, y, x - 24, y + 24);
      g.lineTo(x - 24, y - 24);
      g.moveTo(x + 24, y - 24);
      g.quadraticCurveTo(x + 10, y, x + 24, y + 24);
      g.lineTo(x + 24, y - 24);
      g.fill();
      g.restore();
      if (win.cross) {
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, y - 22);
        g.lineTo(x, y + 22);
        g.moveTo(x - 22, y);
        g.lineTo(x + 22, y);
        g.stroke();
      }
      if (win.box) {
        rr(g, x - 26, y + 22, 52, 12, 3);
        fillStroke(g, "#b5651d", 2.5);
        for (let i = 0; i < 3; i += 1) flower(g, x - 16 + i * 16, y + 20, 7, win.box);
      }
    }
    // 문
    const dx = p.door * w;
    rr(g, dx - 22, -66, 44, 66, [20, 20, 2, 2]);
    fillStroke(g, p.dc);
    if (p.knob) {
      circ(g, dx + 12, -32, 4.5);
      fillStroke(g, "#ffd43b", 2);
    }
    if (p.wreath) {
      circ(g, dx, -48, 12);
      g.lineWidth = 7;
      g.strokeStyle = "#2f9e6a";
      g.stroke();
      circ(g, dx, -38, 4);
      g.fillStyle = p.wreath;
      g.fill();
    }
  },
  parts: (p, r) => {
    const w = p.w;
    const h = p.h;
    const out = [
      { key: "roof", at: [w / 2, -h - 30], r: Math.min(80, w * 0.4), vis: 3, alt: { roof: other(r, C.roof, p.roof) } },
      { key: "dc", at: [p.door * w, -34], r: 30, vis: 2, alt: { dc: other(r, C.bright, p.dc) } },
      { key: "knob", at: [p.door * w + 12, -32], r: 16, vis: 1, alt: { knob: !p.knob } },
    ];
    if (p.chim) out.push({ key: "chim", at: [w * 0.58 + 13, -h - 50], r: 26, vis: 2, alt: { chim: false } });
    if (p.chim && !p.snow) out.push({ key: "smoke", at: [w * 0.64, -h - 104], r: 26, vis: 1, alt: { smoke: !p.smoke } });
    if (p.wreath) out.push({ key: "wreath", at: [p.door * w, -48], r: 18, vis: 1, alt: { wreath: p.wreath === "#ff4d4d" ? "#4dabf7" : "#ff4d4d" } });
    p.win.forEach((win, i) => {
      const at = [win.x * w, -h + win.y * h];
      const set = (q) => ({ win: p.win.map((v, j) => (j === i ? { ...v, ...q } : v)) });
      out.push({ key: "win", at, r: 26, vis: 2, alt: set({ c: other(r, C.curtain, win.c) }) });
      out.push({ key: "win", at, r: 26, vis: 1, alt: set({ cross: !win.cross }) });
      if (win.box) out.push({ key: "win", at: [at[0], at[1] + 26], r: 26, vis: 1, alt: set({ box: other(r, C.bright, win.box) }) });
    });
    return out;
  },
};

K.shop = {
  draw(g, p) {
    const w = 190;
    const h = 150;
    rr(g, 0, -h, w, h, 4);
    fillStroke(g, p.wall);
    // 간판
    rr(g, 30, -h - 46, w - 60, 42, 10);
    fillStroke(g, "#fff8e6");
    SIGN[p.icon](g, w / 2, -h - 25);
    // 차양
    const n = 6;
    for (let i = 0; i < n; i += 1) {
      g.beginPath();
      const x = -8 + (i * (w + 16)) / n;
      const x2 = -8 + ((i + 1) * (w + 16)) / n;
      g.moveTo(x, -h + 8);
      g.lineTo(x2, -h + 8);
      g.lineTo(x2, -h + 44);
      g.quadraticCurveTo((x + x2) / 2, -h + 58, x, -h + 44);
      g.closePath();
      fillStroke(g, i % 2 ? "#fff" : p.aw, 2.5);
    }
    // 진열창
    rr(g, 16, -h + 66, 100, 64, 4);
    fillStroke(g, "#d8f0ff");
    p.items.forEach((it, i) => SIGN[it](g, 40 + i * 26, -h + 108, 0.62));
    rr(g, 132, -h + 70, 44, 80, [20, 20, 2, 2]);
    fillStroke(g, p.dc);
    circ(g, 166, -h + 112, 4);
    fillStroke(g, "#ffd43b", 2);
  },
  parts: (p, r) => [
    { key: "aw", at: [95, -120], r: 70, vis: 3, alt: { aw: other(r, ["#ff6b6b", "#4dabf7", "#69db7c", "#ffa94d", "#9775fa"], p.aw) } },
    { key: "icon", at: [95, -175], r: 30, vis: 2, alt: { icon: other(r, Object.keys(SIGN), p.icon) } },
    ...p.items.map((it, i) => ({ key: "items", at: [40 + i * 26, -52], r: 16, vis: 1, alt: { items: p.items.map((q, j) => (j === i ? other(r, Object.keys(SIGN), q) : q)) } })),
    { key: "dc", at: [154, -40], r: 28, vis: 2, alt: { dc: other(r, C.bright, p.dc) } },
  ],
};

/** 간판 · 진열 그림 */
const SIGN = {
  cake(g, x, y, k = 1) {
    g.save();
    g.translate(x, y);
    g.scale(k, k);
    rr(g, -16, -8, 32, 20, 4);
    fillStroke(g, "#ffd8e8", 2.4);
    rr(g, -16, -8, 32, 7, 3);
    fillStroke(g, "#fff", 2.4);
    circ(g, 0, -13, 5);
    fillStroke(g, "#ff4d4d", 2);
    g.restore();
  },
  bread(g, x, y, k = 1) {
    g.save();
    g.translate(x, y);
    g.scale(k, k);
    ell(g, 0, 0, 20, 11);
    fillStroke(g, "#e8a54b", 2.4);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    for (const d of [-8, 0, 8]) {
      g.beginPath();
      g.moveTo(d - 3, -6);
      g.lineTo(d + 3, 4);
      g.stroke();
    }
    g.restore();
  },
  flower(g, x, y, k = 1) {
    g.save();
    g.translate(x, y);
    g.scale(k, k);
    flower(g, 0, -2, 12, "#ff8fab");
    g.restore();
  },
  fish(g, x, y, k = 1) {
    g.save();
    g.translate(x, y);
    g.scale(k, k);
    g.beginPath();
    g.ellipse(-2, 0, 15, 9, 0, 0, TAU);
    g.moveTo(12, 0);
    g.lineTo(22, -8);
    g.lineTo(22, 8);
    g.closePath();
    fillStroke(g, "#74c0fc", 2.4);
    circ(g, -9, -2, 2);
    g.fillStyle = INK;
    g.fill();
    g.restore();
  },
  cup(g, x, y, k = 1) {
    g.save();
    g.translate(x, y);
    g.scale(k, k);
    rr(g, -12, -10, 22, 20, [2, 2, 8, 8]);
    fillStroke(g, "#fff", 2.4);
    g.beginPath();
    g.arc(11, 0, 6, -1.4, 1.4);
    g.lineWidth = 2.4;
    g.strokeStyle = INK;
    g.stroke();
    heart(g, -1, 0, 5);
    g.fillStyle = "#ff6b6b";
    g.fill();
    g.restore();
  },
};

K.lamp = {
  draw(g, p) {
    rr(g, -5, -150, 10, 150, 3);
    fillStroke(g, p.c, 2.5);
    rr(g, -14, -6, 28, 8, 3);
    fillStroke(g, p.c, 2.5);
    if (p.lit) {
      const gl = g.createRadialGradient(0, -168, 2, 0, -168, 46);
      gl.addColorStop(0, "rgba(255,240,170,.85)");
      gl.addColorStop(1, "rgba(255,240,170,0)");
      g.fillStyle = gl;
      circ(g, 0, -168, 46);
      g.fill();
    }
    g.beginPath();
    g.moveTo(-14, -152);
    g.lineTo(-18, -182);
    g.lineTo(18, -182);
    g.lineTo(14, -152);
    g.closePath();
    fillStroke(g, p.lit ? "#fff3a8" : "#d0e6f5", 2.5);
    g.beginPath();
    g.moveTo(-22, -182);
    g.lineTo(0, -198);
    g.lineTo(22, -182);
    g.closePath();
    fillStroke(g, p.c, 2.5);
  },
  parts: (p, r) => [
    { key: "lit", at: [0, -168], r: 26, vis: 2, alt: { lit: !p.lit } },
    { key: "c", at: [0, -90], r: 22, vis: 1, alt: { c: other(r, ["#3a4a6b", "#2f9e6a", "#c2483a"], p.c) } },
  ],
};

K.mailbox = {
  draw(g, p) {
    rr(g, -4, -60, 8, 60, 2);
    fillStroke(g, "#7a5a3a", 2.5);
    rr(g, -24, -92, 48, 34, [16, 16, 3, 3]);
    fillStroke(g, p.c);
    rr(g, -12, -80, 24, 4, 2);
    g.fillStyle = INK;
    g.fill();
    if (p.flag) {
      rr(g, 22, -110, 5, 30, 2);
      fillStroke(g, "#ff4d4d", 2);
      rr(g, 22, -110, 16, 10, 2);
      fillStroke(g, "#ff4d4d", 2);
    }
  },
  parts: (p, r) => [
    { key: "c", at: [0, -76], r: 26, vis: 2, alt: { c: other(r, ["#4dabf7", "#ff6b6b", "#69db7c", "#ffd43b"], p.c) } },
    { key: "flag", at: [28, -96], r: 18, vis: 1, alt: { flag: !p.flag } },
  ],
};

K.bench = {
  draw(g, p) {
    for (const x of [-48, 40]) {
      rr(g, x, -30, 8, 30, 2);
      fillStroke(g, "#5a4a3a", 2.5);
    }
    rr(g, -60, -36, 120, 10, 3);
    fillStroke(g, p.c, 2.5);
    for (const y of [-70, -55]) {
      rr(g, -60, y, 120, 10, 3);
      fillStroke(g, p.c, 2.5);
    }
  },
  parts: (p, r) => [{ key: "c", at: [0, -48], r: 50, vis: 2, alt: { c: other(r, ["#e8594a", "#4a7fd8", "#2fa36b", "#f0a03c"], p.c) } }],
};

K.cat = {
  draw(g, p) {
    // 꼬리
    g.strokeStyle = INK;
    g.lineWidth = 12;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(14 * p.tail, -10);
    g.quadraticCurveTo(40 * p.tail, -14, 36 * p.tail, -46);
    g.stroke();
    g.strokeStyle = p.c;
    g.lineWidth = 7;
    g.stroke();
    ell(g, 0, -20, 22, 22);
    fillStroke(g, p.c, 3);
    ell(g, 0, -50, 21, 18);
    fillStroke(g, p.c, 3);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 18, -58);
      g.lineTo(s * 16, -76);
      g.lineTo(s * 4, -66);
      g.closePath();
      fillStroke(g, p.c, 3);
    }
    g.fillStyle = INK;
    circ(g, -7, -52, 2.8);
    g.fill();
    circ(g, 7, -52, 2.8);
    g.fill();
    circ(g, 0, -45, 2.2);
    g.fill();
    rr(g, -13, -36, 26, 6, 3);
    fillStroke(g, p.collar, 2);
  },
  parts: (p, r) => [
    { key: "collar", at: [0, -33], r: 16, vis: 1, alt: { collar: other(r, ["#ff4d4d", "#4dabf7", "#ffd43b", "#69db7c"], p.collar) } },
    { key: "tail", at: [30 * p.tail, -30], r: 22, vis: 1, alt: { tail: -p.tail } },
    { key: "c", at: [0, -36], r: 30, vis: 2, alt: { c: other(r, ["#ffb366", "#9aa3b5", "#ffffff", "#5c5c66"], p.c) } },
  ],
};

/** 동물 친구 (씨름왕 인형을 빌려 씀) */
const HEADS = [undefined, "headband", "cheer", "crown"];
K.pal = {
  draw(g, p) {
    if (p.bal) {
      g.strokeStyle = "#7a6a5a";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(40, -80);
      g.quadraticCurveTo(60, -140, 54, -196);
      g.stroke();
      ell(g, 54, -220, 21, 26);
      fillStroke(g, p.bal, 2.5);
      shine(g, 44, -234, 7, 12);
    }
    const pp = new Puppet(p.id, { size: 1, belt: p.belt, cos: { head: p.head, face: p.glass ? "sunglasses" : undefined, body: p.happi ? "happi" : undefined } });
    pp.t = p.t;
    pp.nextBlink = 1e9;
    pp.face = p.face;
    pp.faceK = p.face;
    pp.moveAmt = 0;
    if (p.pose === "sit") {
      pp.state = "defeat";
      pp.stateT = 2;
    } else if (p.pose === "cheer") {
      pp.victoryPose = "flex";
      pp.state = "victory";
    }
    pp.update(1);
    pp.eye = p.eye;
    pp.mouth = p.mouth;
    pp.P.mouthOpen = p.mouth === "open" ? 0.7 : 0;
    pp.drawShadow(g, 0, 0, 0.44);
    pp.draw(g, 0, 0, 0.44);
  },
  parts: (p, r) => {
    const top = p.pose === "sit" ? -86 : -102;
    return [
      { key: "head", at: [0, top - 6], r: 26, vis: 2, alt: { head: other(r, HEADS, p.head) } },
      { key: "glass", at: [6 * p.face, top + 20], r: 20, vis: p.glass ? 2 : 1, alt: { glass: !p.glass } },
      { key: "mouth", at: [6 * p.face, top + 34], r: 16, vis: 1, alt: { mouth: p.mouth === "smile" ? "open" : "smile", eye: p.eye } },
      { key: "belt", at: [0, -30], r: 28, vis: 2, alt: { belt: other(r, ["#ff6b6b", "#4dabf7", "#69db7c", "#ffd43b", "#9775fa"], p.belt) } },
      ...(p.bal ? [{ key: "bal", at: [54, -220], r: 28, vis: 2, alt: { bal: other(r, ["#ff6b6b", "#4dabf7", "#ffd43b", "#69db7c", "#f783ac"], p.bal) } }] : []),
      ...(p.pose !== "sit" ? [{ key: "happi", at: [0, -50], r: 30, vis: 2, alt: { happi: !p.happi } }] : []),
    ];
  },
};

K.kite = {
  draw(g, p) {
    g.strokeStyle = "#7a6a5a";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 40);
    g.bezierCurveTo(-10, 80, 30, 110, 10, 150);
    g.stroke();
    p.bows.forEach((on, i) => {
      if (!on) return;
      const y = 62 + i * 26;
      const x = i % 2 ? 8 : -2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 10, y - 6);
      g.lineTo(x - 10, y + 6);
      g.closePath();
      g.moveTo(x, y);
      g.lineTo(x + 10, y - 6);
      g.lineTo(x + 10, y + 6);
      g.closePath();
      fillStroke(g, p.c2, 2);
    });
    g.beginPath();
    g.moveTo(0, -44);
    g.lineTo(32, 0);
    g.lineTo(0, 44);
    g.lineTo(-32, 0);
    g.closePath();
    fillStroke(g, p.c1);
    g.save();
    g.clip();
    g.fillStyle = p.c2;
    g.fillRect(0, -44, 32, 44);
    g.fillRect(-32, 0, 32, 44);
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -44);
    g.lineTo(0, 44);
    g.moveTo(-32, 0);
    g.lineTo(32, 0);
    g.stroke();
  },
  parts: (p, r) => [
    { key: "c1", at: [0, 0], r: 36, vis: 2, alt: { c1: other(r, C.bright, p.c1) } },
    ...p.bows.map((on, i) => ({ key: "bows", at: [i % 2 ? 8 : -2, 62 + i * 26], r: 15, vis: 1, alt: { bows: p.bows.map((v, j) => (j === i ? !v : v)) } })),
  ],
};

K.mat = {
  draw(g, p) {
    g.save();
    g.beginPath();
    g.moveTo(-150, 0);
    g.lineTo(150, 0);
    g.lineTo(120, -70);
    g.lineTo(-120, -70);
    g.closePath();
    fillStroke(g, "#fff");
    g.clip();
    g.fillStyle = p.c;
    for (let i = -8; i < 8; i += 1) {
      g.beginPath();
      g.moveTo(i * 26, 0);
      g.lineTo(i * 26 + 13, 0);
      g.lineTo(i * 21 + 10.5, -70);
      g.lineTo(i * 21, -70);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 0.55;
    for (let j = 0; j < 4; j += 1) g.fillRect(-160, -70 + j * 18, 320, 9);
    g.restore();
    g.globalAlpha = 1;
    g.beginPath();
    g.moveTo(-150, 0);
    g.lineTo(150, 0);
    g.lineTo(120, -70);
    g.lineTo(-120, -70);
    g.closePath();
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.stroke();
    // 바구니
    if (p.basket) {
      rr(g, -112, -64, 56, 38, 6);
      fillStroke(g, "#d9a24e");
      g.beginPath();
      g.arc(-84, -64, 22, Math.PI, 0);
      g.lineWidth = 5;
      g.strokeStyle = INK;
      g.stroke();
      g.strokeStyle = "rgba(90,50,10,.5)";
      g.lineWidth = 2;
      for (const y of [-52, -40]) {
        g.beginPath();
        g.moveTo(-110, y);
        g.lineTo(-58, y);
        g.stroke();
      }
    }
    // 케이크
    rr(g, -22, -58, 50, 30, 4);
    fillStroke(g, "#ffd8e8");
    rr(g, -22, -58, 50, 10, 4);
    fillStroke(g, "#fff", 2.5);
    for (let i = 0; i < p.candles; i += 1) {
      rr(g, -10 + i * 12, -76, 5, 18, 2);
      fillStroke(g, "#74c0fc", 2);
      ell(g, -7.5 + i * 12, -81, 3, 5);
      g.fillStyle = "#ffa94d";
      g.fill();
    }
    if (p.cherry) {
      circ(g, 3, -62, 6);
      fillStroke(g, "#ff4d4d", 2);
    }
    // 컵
    p.cups.forEach((c, i) => {
      const x = 52 + i * 30;
      rr(g, x, -46, 20, 24, [2, 2, 6, 6]);
      fillStroke(g, c, 2.5);
      rr(g, x + 3, -42, 14, 5, 2);
      g.fillStyle = "rgba(255,255,255,.6)";
      g.fill();
    });
    if (p.sand) {
      g.beginPath();
      g.moveTo(-50, -10);
      g.lineTo(-10, -10);
      g.lineTo(-30, -34);
      g.closePath();
      fillStroke(g, "#ffe8a3", 2.5);
      g.strokeStyle = "#69c06a";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(-46, -14);
      g.lineTo(-14, -14);
      g.stroke();
    }
  },
  parts: (p, r) => [
    { key: "c", at: [0, -35], r: 80, vis: 3, alt: { c: other(r, ["#ff6b6b", "#4dabf7", "#69db7c", "#ffa94d", "#9775fa"], p.c) } },
    { key: "cherry", at: [3, -62], r: 16, vis: 1, alt: { cherry: !p.cherry } },
    { key: "candles", at: [0, -76], r: 20, vis: 1, alt: { candles: p.candles === 2 ? 3 : 2 } },
    ...p.cups.map((c, i) => ({ key: "cups", at: [62 + i * 30, -34], r: 16, vis: 1, alt: { cups: p.cups.map((q, j) => (j === i ? other(r, C.bright, q) : q)) } })),
    { key: "sand", at: [-30, -20], r: 22, vis: 2, alt: { sand: !p.sand } },
    { key: "basket", at: [-84, -55], r: 30, vis: 2, alt: { basket: !p.basket } },
  ],
};

K.pond = {
  draw(g, p) {
    ell(g, 0, 0, 120, 34);
    fillStroke(g, "#74c0fc");
    g.fillStyle = "rgba(255,255,255,.5)";
    ell(g, -40, -8, 30, 5);
    g.fill();
    for (const [x, y] of [[60, 8], [78, -6]]) {
      ell(g, x, y, 15, 7);
      fillStroke(g, "#69c06a", 2);
    }
    if (p.duck) {
      g.save();
      g.translate(-30, 0);
      g.scale(p.duck, 1);
      ell(g, 0, -10, 22, 13);
      fillStroke(g, "#ffd43b", 2.5);
      circ(g, 14, -26, 11);
      fillStroke(g, "#ffd43b", 2.5);
      g.beginPath();
      g.moveTo(23, -27);
      g.lineTo(34, -24);
      g.lineTo(23, -21);
      g.closePath();
      fillStroke(g, "#ff922b", 2);
      circ(g, 16, -29, 2.2);
      g.fillStyle = INK;
      g.fill();
      g.restore();
    }
  },
  parts: (p) => [
    { key: "duck", at: [-30, -16], r: 28, vis: 2, alt: { duck: 0 } },
    { key: "duck", at: [-30, -16], r: 28, vis: 1, alt: { duck: -p.duck } },
  ],
};

K.butterfly = {
  draw(g, p) {
    for (const s of [-1, 1]) {
      ell(g, s * 12, -8, 12, 14, s * 0.4);
      fillStroke(g, p.c, 2.2);
      ell(g, s * 9, 8, 8, 9, -s * 0.4);
      fillStroke(g, p.c, 2.2);
    }
    rr(g, -3, -16, 6, 32, 3);
    fillStroke(g, INK, 0);
  },
  parts: (p, r) => [{ key: "c", at: [0, 0], r: 24, vis: 1, alt: { c: other(r, C.bright, p.c) } }],
  remove: 2,
  size: 26,
};

K.ball = {
  draw(g, p) {
    circ(g, 0, -24, 24);
    fillStroke(g, "#fff");
    g.save();
    circ(g, 0, -24, 24);
    g.clip();
    g.fillStyle = p.c1;
    g.beginPath();
    g.moveTo(0, -24);
    g.arc(0, -24, 30, -2.2, -1.2);
    g.closePath();
    g.fill();
    g.fillStyle = p.c2;
    g.beginPath();
    g.moveTo(0, -24);
    g.arc(0, -24, 30, -0.2, 0.8);
    g.closePath();
    g.fill();
    g.fillStyle = p.c1;
    g.beginPath();
    g.moveTo(0, -24);
    g.arc(0, -24, 30, 1.8, 2.8);
    g.closePath();
    g.fill();
    g.restore();
    circ(g, 0, -24, 24);
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.stroke();
  },
  parts: (p, r) => [{ key: "c1", at: [0, -24], r: 28, vis: 2, alt: { c1: other(r, C.bright, p.c1) } }],
  remove: 2,
  size: 28,
  cy: -24,
};

/* 바닷가 */
K.boat = {
  draw(g, p) {
    g.beginPath();
    g.moveTo(-60, -18);
    g.lineTo(60, -18);
    g.lineTo(42, 4);
    g.lineTo(-42, 4);
    g.closePath();
    fillStroke(g, p.hull);
    rr(g, -3, -118, 6, 100, 2);
    fillStroke(g, "#7a5a3a", 2.5);
    g.beginPath();
    g.moveTo(6, -112);
    g.lineTo(6, -26);
    g.lineTo(58, -26);
    g.closePath();
    fillStroke(g, "#fff");
    g.save();
    g.clip();
    g.fillStyle = p.sail;
    for (let i = 0; i < 3; i += 1) g.fillRect(0, -100 + i * 28, 70, 12);
    g.restore();
    if (p.flag) {
      g.beginPath();
      g.moveTo(-3, -118);
      g.lineTo(-30, -110);
      g.lineTo(-3, -102);
      g.closePath();
      fillStroke(g, "#ff4d4d", 2);
    }
  },
  parts: (p, r) => [
    { key: "sail", at: [26, -64], r: 36, vis: 2, alt: { sail: other(r, ["#ff6b6b", "#4dabf7", "#ffd43b", "#69db7c"], p.sail) } },
    { key: "flag", at: [-16, -110], r: 18, vis: 1, alt: { flag: !p.flag } },
    { key: "hull", at: [0, -8], r: 36, vis: 2, alt: { hull: other(r, ["#e8594a", "#4a7fd8", "#f0a03c", "#2fa36b"], p.hull) } },
  ],
};

K.lighthouse = {
  draw(g, p) {
    g.beginPath();
    g.moveTo(-26, 0);
    g.lineTo(-17, -130);
    g.lineTo(17, -130);
    g.lineTo(26, 0);
    g.closePath();
    fillStroke(g, "#fff");
    g.save();
    g.clip();
    g.fillStyle = p.c;
    for (let i = 0; i < 3; i += 1) g.fillRect(-30, -24 - i * 42, 60, 20);
    g.restore();
    g.beginPath();
    g.moveTo(-26, 0);
    g.lineTo(-17, -130);
    g.lineTo(17, -130);
    g.lineTo(26, 0);
    g.closePath();
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.stroke();
    rr(g, -16, -156, 32, 26, 4);
    fillStroke(g, p.light);
    g.beginPath();
    g.moveTo(-22, -156);
    g.lineTo(0, -176);
    g.lineTo(22, -156);
    g.closePath();
    fillStroke(g, p.c);
    if (p.door) {
      rr(g, -8, -26, 16, 26, [8, 8, 0, 0]);
      fillStroke(g, "#7a5a3a", 2.5);
    }
  },
  parts: (p, r) => [
    { key: "c", at: [0, -70], r: 30, vis: 2, alt: { c: other(r, ["#ff6b6b", "#4dabf7", "#69db7c"], p.c) } },
    { key: "light", at: [0, -143], r: 18, vis: 1, alt: { light: p.light === "#fff3a8" ? "#a5d8ff" : "#fff3a8" } },
    { key: "door", at: [0, -13], r: 16, vis: 1, alt: { door: !p.door } },
  ],
};

K.island = {
  draw(g, p) {
    ell(g, 0, 0, 70, 18);
    fillStroke(g, "#f5d98a");
    g.strokeStyle = INK;
    g.lineWidth = 9;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-6, -4);
    g.quadraticCurveTo(-14, -50, 4, -92);
    g.stroke();
    g.strokeStyle = "#a0703c";
    g.lineWidth = 5;
    g.stroke();
    for (const a of [-2.6, -1.9, -1.2, -0.5]) {
      g.beginPath();
      g.moveTo(4, -92);
      g.quadraticCurveTo(4 + Math.cos(a) * 30, -92 + Math.sin(a) * 30 - 6, 4 + Math.cos(a) * 52, -92 + Math.sin(a) * 30 + 18);
      g.quadraticCurveTo(4 + Math.cos(a) * 26, -92 + Math.sin(a) * 18, 4, -92);
      fillStroke(g, "#40b06a", 2.5);
    }
    for (let i = 0; i < p.co; i += 1) {
      circ(g, -4 + i * 9, -84, 6);
      fillStroke(g, "#8a5a2c", 2);
    }
  },
  parts: (p) => [{ key: "co", at: [4, -84], r: 18, vis: 1, alt: { co: p.co - 1 } }],
};

K.umbrella = {
  draw(g, p) {
    // 수건
    g.save();
    g.beginPath();
    g.moveTo(-40, 26);
    g.lineTo(80, 26);
    g.lineTo(66, -2);
    g.lineTo(-30, -2);
    g.closePath();
    fillStroke(g, p.towel);
    g.clip();
    g.fillStyle = "rgba(255,255,255,.75)";
    for (let i = 0; i < 4; i += 1) g.fillRect(-40 + i * 34, -4, 10, 34);
    g.restore();
    rr(g, -3, -126, 6, 136, 2);
    fillStroke(g, "#7a5a3a", 2.5);
    const n = 6;
    const rim = -100;
    for (let i = 0; i < n; i += 1) {
      const x0 = -96 + (i * 192) / n;
      const x1 = -96 + ((i + 1) * 192) / n;
      g.beginPath();
      g.moveTo(0, -160);
      g.quadraticCurveTo((x0 + 0) / 2 - 10 * Math.sign(x0 || 1), -150, x0, rim);
      g.quadraticCurveTo((x0 + x1) / 2, rim + 14, x1, rim);
      g.quadraticCurveTo((x1 + 0) / 2 - 10 * Math.sign(x1 || 1), -150, 0, -160);
      g.closePath();
      fillStroke(g, i % 2 ? "#fff" : p.c, 2.5);
    }
    circ(g, 0, -162, 5);
    fillStroke(g, p.c, 2);
  },
  parts: (p, r) => [
    { key: "c", at: [0, -128], r: 60, vis: 3, alt: { c: other(r, ["#ff6b6b", "#4dabf7", "#ffd43b", "#69db7c", "#f783ac"], p.c) } },
    { key: "towel", at: [20, 12], r: 34, vis: 2, alt: { towel: other(r, ["#ff8fab", "#74c0fc", "#ffd43b", "#8ce99a"], p.towel) } },
  ],
};

K.bush = {
  draw(g, p) {
    g.beginPath();
    for (const [x, y, r] of [[-26, -22, 24], [0, -34, 30], [28, -22, 24]]) {
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, TAU);
    }
    g.lineWidth = 6;
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = p.c;
    g.fill();
    g.fillStyle = "rgba(255,255,255,.18)";
    circ(g, -6, -46, 12);
    g.fill();
    for (const [x, y, c] of p.f) {
      if (p.k === "berry") {
        circ(g, x, y, 5.5);
        fillStroke(g, c, 2);
      } else flower(g, x, y, 7.5, c);
    }
  },
  parts: (p, r) =>
    p.f.flatMap(([x, y, c], i) => [
      { key: "f", at: [x, y], r: 15, vis: 1, alt: { f: p.f.map((q, j) => (j === i ? [q[0], q[1], other(r, C.bright, c)] : q)) } },
      { key: "f", at: [x, y], r: 15, vis: 1, alt: { f: p.f.filter((_, j) => j !== i) } },
    ]),
};

K.ring = {
  draw(g, p) {
    g.save();
    g.scale(1, 0.62);
    circ(g, 0, -30, 30);
    g.lineWidth = 18;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 13;
    g.strokeStyle = "#fff";
    g.stroke();
    g.strokeStyle = p.c;
    for (let i = 0; i < 4; i += 1) {
      g.beginPath();
      g.arc(0, -30, 30, (i * Math.PI) / 2, (i * Math.PI) / 2 + 0.75);
      g.stroke();
    }
    g.restore();
  },
  parts: (p, r) => [{ key: "c", at: [0, -18], r: 30, vis: 2, alt: { c: other(r, ["#ff6b6b", "#4dabf7", "#69db7c", "#ffa94d"], p.c) } }],
  remove: 2,
  size: 30,
  cy: -18,
};

K.surf = {
  draw(g, p) {
    g.save();
    g.rotate(-0.12);
    ell(g, 0, -70, 20, 72);
    fillStroke(g, p.c);
    g.save();
    ell(g, 0, -70, 20, 72);
    g.clip();
    g.fillStyle = p.s;
    g.fillRect(-4, -150, 8, 160);
    g.restore();
    g.restore();
  },
  parts: (p, r) => [
    { key: "s", at: [-6, -70], r: 22, vis: 1, alt: { s: other(r, ["#fff", "#ff6b6b", "#3a4a6b"], p.s) } },
    { key: "c", at: [-6, -70], r: 30, vis: 2, alt: { c: other(r, ["#ffd43b", "#4dabf7", "#f783ac", "#69db7c"], p.c) } },
  ],
};

K.floorlamp = {
  draw(g, p) {
    rr(g, -22, -8, 44, 8, 3);
    fillStroke(g, "#7a5a3a", 2.5);
    rr(g, -3, -150, 6, 144, 2);
    fillStroke(g, "#7a5a3a", 2.5);
    g.beginPath();
    g.moveTo(-22, -150);
    g.lineTo(-32, -112);
    g.lineTo(32, -112);
    g.lineTo(22, -150);
    g.closePath();
    fillStroke(g, p.c);
    if (p.tassel) {
      g.fillStyle = p.c;
      for (const x of [-24, 0, 24]) {
        circ(g, x, -104, 4);
        fillStroke(g, p.c, 2);
      }
    }
  },
  parts: (p, r) => [
    { key: "c", at: [0, -130], r: 30, vis: 2, alt: { c: other(r, ["#ffd8a8", "#bfe3ff", "#ffc9de", "#c3f0c8"], p.c) } },
    { key: "tassel", at: [0, -104], r: 22, vis: 1, alt: { tassel: !p.tassel } },
  ],
};

K.castle = {
  draw(g, p) {
    const sand = "#f2c66d";
    p.tw.forEach((on, i) => {
      if (!on) return;
      const x = -50 + i * 50;
      rr(g, x - 16, -66, 32, 66, 2);
      fillStroke(g, sand);
      for (let j = 0; j < 3; j += 1) {
        rr(g, x - 16 + j * 12, -76, 8, 12, 2);
        fillStroke(g, sand, 2.5);
      }
    });
    rr(g, -44, -40, 88, 40, 2);
    fillStroke(g, sand);
    rr(g, -10, -26, 20, 26, [10, 10, 0, 0]);
    fillStroke(g, "#c99a45", 2.5);
    if (p.flag) {
      rr(g, -1, -110, 3, 36, 1);
      fillStroke(g, INK, 0);
      g.beginPath();
      g.moveTo(2, -110);
      g.lineTo(24, -103);
      g.lineTo(2, -96);
      g.closePath();
      fillStroke(g, p.flag, 2);
    }
  },
  parts: (p, r) => [
    ...(p.flag ? [{ key: "flag", at: [12, -103], r: 18, vis: 1, alt: { flag: other(r, ["#ff4d4d", "#4dabf7", "#69db7c"], p.flag) } }] : []),
    { key: "tw", at: [-50, -40], r: 30, vis: 2, alt: { tw: [false, p.tw[1], p.tw[2]] } },
    { key: "tw", at: [50, -40], r: 30, vis: 2, alt: { tw: [p.tw[0], p.tw[1], false] } },
  ],
};

K.bucket = {
  draw(g, p) {
    if (p.shovel) {
      g.save();
      g.rotate(0.5);
      rr(g, 18, -60, 6, 46, 3);
      fillStroke(g, "#ffd43b", 2.5);
      g.beginPath();
      g.moveTo(10, -18);
      g.lineTo(32, -18);
      g.lineTo(28, 4);
      g.lineTo(14, 4);
      g.closePath();
      fillStroke(g, "#ffd43b", 2.5);
      g.restore();
    }
    g.beginPath();
    g.moveTo(-22, -40);
    g.lineTo(22, -40);
    g.lineTo(16, 0);
    g.lineTo(-16, 0);
    g.closePath();
    fillStroke(g, p.c);
    g.beginPath();
    g.arc(0, -40, 22, Math.PI, 0);
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.stroke();
  },
  parts: (p, r) => [
    { key: "c", at: [0, -20], r: 26, vis: 2, alt: { c: other(r, ["#ff6b6b", "#4dabf7", "#69db7c", "#9775fa"], p.c) } },
    { key: "shovel", at: [26, -26], r: 20, vis: 1, alt: { shovel: !p.shovel } },
  ],
};

K.crab = {
  draw(g, p) {
    g.strokeStyle = INK;
    g.lineWidth = 3;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        g.beginPath();
        g.moveTo(s * 18, -8 + i * 5);
        g.lineTo(s * 32, -2 + i * 6);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(s * 18, -16);
      g.lineTo(s * 28, -34);
      g.stroke();
      if (s === 1 || p.claws) {
        circ(g, s * 30, -40, 9);
        fillStroke(g, p.c, 2.5);
      }
    }
    ell(g, 0, -12, 24, 15);
    fillStroke(g, p.c);
    for (const s of [-1, 1]) {
      circ(g, s * 7, -32, 5);
      fillStroke(g, "#fff", 2);
      circ(g, s * 7, -32, 2);
      g.fillStyle = INK;
      g.fill();
    }
  },
  parts: (p, r) => [
    { key: "c", at: [0, -14], r: 28, vis: 2, alt: { c: other(r, ["#ff6b6b", "#ff922b", "#f783ac"], p.c) } },
    { key: "claws", at: [-30, -40], r: 16, vis: 1, alt: { claws: !p.claws } },
  ],
};

K.shells = {
  draw(g, p) {
    for (const s of p.s) {
      if (s.k === "star") {
        star5(g, s.x, -10, 14, 6);
        fillStroke(g, s.c, 2.5);
      } else {
        g.beginPath();
        g.moveTo(s.x - 12, -2);
        g.quadraticCurveTo(s.x, -30, s.x + 12, -2);
        g.closePath();
        fillStroke(g, s.c, 2.5);
        g.strokeStyle = "rgba(90,50,40,.5)";
        g.lineWidth = 1.5;
        for (const d of [-5, 0, 5]) {
          g.beginPath();
          g.moveTo(s.x, -2);
          g.lineTo(s.x + d, -18);
          g.stroke();
        }
      }
    }
  },
  parts: (p, r) =>
    p.s.flatMap((s, i) => [
      { key: "s", at: [s.x, -10], r: 18, vis: 1, alt: { s: p.s.map((q, j) => (j === i ? { ...q, c: other(r, ["#ffa94d", "#f783ac", "#ffd43b", "#74c0fc"], q.c) } : q)) } },
      { key: "s", at: [s.x, -10], r: 18, vis: 1, alt: { s: p.s.filter((_, j) => j !== i) } },
    ]),
};

/* 방 안 */
K.window = {
  draw(g, p) {
    rr(g, -80, -70, 160, 140, 6);
    fillStroke(g, p.night ? "#2a3b7a" : "#a5d8ff");
    if (p.view === "sun") {
      circ(g, 34, -30, 20);
      fillStroke(g, "#ffd43b", 2.5);
    } else if (p.view === "moon") {
      circ(g, 34, -30, 18);
      fillStroke(g, "#fff3bf", 2.5);
    } else {
      g.beginPath();
      for (const [x, y, r] of [[-20, -26, 16], [-2, -32, 20], [18, -24, 14]]) {
        g.moveTo(x + r, y);
        g.arc(x, y, r, 0, TAU);
      }
      fillStroke(g, "#fff", 2.5);
    }
    ell(g, -10, 72, 120, 16);
    g.fillStyle = "#8cd48a";
    g.save();
    rr(g, -80, -70, 160, 140, 6);
    g.clip();
    ell(g, -20, 76, 120, 40);
    g.fill();
    g.restore();
    g.strokeStyle = "#fff";
    g.lineWidth = 10;
    rr(g, -80, -70, 160, 140, 6);
    g.stroke();
    g.beginPath();
    g.moveTo(0, -70);
    g.lineTo(0, 70);
    g.moveTo(-80, 0);
    g.lineTo(80, 0);
    g.stroke();
    rr(g, -86, -76, 172, 152, 8);
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.stroke();
    // 커튼
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 98, -86);
      g.lineTo(s * 60, -86);
      g.quadraticCurveTo(s * 70, 0, s * 96, 86);
      g.lineTo(s * 104, 86);
      g.closePath();
      fillStroke(g, s < 0 ? p.cur : p.cur2 || p.cur);
    }
    rr(g, -110, -96, 220, 12, 6);
    fillStroke(g, "#c99a45", 2.5);
  },
  parts: (p, r) => [
    { key: "cur", at: [-82, 0], r: 40, vis: 3, alt: { cur: other(r, C.curtain, p.cur), cur2: p.cur } },
    { key: "view", at: [24, -30], r: 30, vis: 2, alt: { view: other(r, p.night ? ["moon", "cloud"] : ["sun", "cloud"], p.view) } },
  ],
};

K.frame = {
  draw(g, p) {
    rr(g, -42, -52, 84, 104, 4);
    fillStroke(g, p.fc, 3);
    rr(g, -32, -42, 64, 84, 2);
    fillStroke(g, p.bg, 2.5);
    if (p.icon === "heart") {
      heart(g, 0, 2, 16);
      fillStroke(g, "#ff6b6b", 2.5);
    } else if (p.icon === "star") {
      star5(g, 0, 0, 20);
      fillStroke(g, "#ffd43b", 2.5);
    } else if (p.icon === "flower") flower(g, 0, 0, 15, "#f783ac");
    else {
      rr(g, -16, -4, 32, 24, 2);
      fillStroke(g, "#fff3dc", 2.5);
      g.beginPath();
      g.moveTo(-20, -2);
      g.lineTo(0, -22);
      g.lineTo(20, -2);
      g.closePath();
      fillStroke(g, "#e8594a", 2.5);
    }
  },
  parts: (p, r) => [
    { key: "icon", at: [0, 0], r: 28, vis: 2, alt: { icon: other(r, ["heart", "star", "flower", "house"], p.icon) } },
    { key: "fc", at: [0, 0], r: 50, vis: 1, alt: { fc: other(r, ["#c99a45", "#e8594a", "#4a7fd8", "#2fa36b"], p.fc) } },
  ],
};

K.clock = {
  draw(g, p) {
    circ(g, 0, 0, 40);
    fillStroke(g, p.c, 3);
    circ(g, 0, 0, 31);
    fillStroke(g, "#fff", 2.5);
    g.fillStyle = INK;
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * TAU;
      circ(g, Math.cos(a) * 25, Math.sin(a) * 25, i % 3 ? 1.5 : 2.6);
      g.fill();
    }
    g.strokeStyle = INK;
    g.lineCap = "round";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 0);
    const ha = (p.h / 12) * TAU - Math.PI / 2;
    g.lineTo(Math.cos(ha) * 15, Math.sin(ha) * 15);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    const ma = (p.m / 60) * TAU - Math.PI / 2;
    g.lineTo(Math.cos(ma) * 23, Math.sin(ma) * 23);
    g.stroke();
  },
  parts: (p, r) => [
    { key: "h", at: [0, 0], r: 34, vis: 1, alt: { h: (p.h + 3 + Math.floor(r() * 5)) % 12 } },
    { key: "c", at: [0, -36], r: 22, vis: 2, alt: { c: other(r, ["#ff8fab", "#74c0fc", "#ffd43b", "#8ce99a"], p.c) } },
  ],
};

K.shelf = {
  draw(g, p) {
    rr(g, -110, 0, 220, 12, 3);
    fillStroke(g, "#c99a45");
    let x = -100;
    for (const b of p.books) {
      if (b.c) {
        rr(g, x, -b.h, b.w, b.h, 2);
        fillStroke(g, b.c, 2.5);
        g.fillStyle = "rgba(255,255,255,.5)";
        g.fillRect(x + 3, -b.h + 8, b.w - 6, 4);
      }
      x += b.w + 2;
    }
    if (p.pot) {
      rr(g, 52, -30, 34, 30, [2, 2, 8, 8]);
      fillStroke(g, p.pot);
      for (const a of [-0.6, 0, 0.6]) {
        ell(g, 69 + Math.sin(a) * 14, -42 - Math.cos(a) * 6, 8, 16, a);
        fillStroke(g, "#51b85e", 2.5);
      }
    }
  },
  parts: (p, r) => {
    const out = [];
    let x = -100;
    p.books.forEach((b, i) => {
      const at = [x + b.w / 2, -b.h / 2];
      x += b.w + 2;
      if (!b.c) return;
      out.push({ key: "books", at, r: 16, vis: 1, alt: { books: p.books.map((q, j) => (j === i ? { ...q, c: other(r, C.bright, q.c) } : q)) } });
      out.push({ key: "books", at, r: 16, vis: 1, alt: { books: p.books.map((q, j) => (j === i ? { ...q, c: null } : q)) } });
    });
    if (p.pot) out.push({ key: "pot", at: [69, -30], r: 26, vis: 2, alt: { pot: null } });
    return out;
  },
};

K.sofa = {
  draw(g, p) {
    rr(g, -150, -120, 300, 90, 30);
    fillStroke(g, p.c);
    rr(g, -170, -80, 50, 80, 20);
    fillStroke(g, p.c);
    rr(g, 120, -80, 50, 80, 20);
    fillStroke(g, p.c);
    rr(g, -126, -56, 252, 50, 14);
    fillStroke(g, p.c);
    g.fillStyle = "rgba(255,255,255,.18)";
    rr(g, -130, -112, 260, 18, 9);
    g.fill();
    for (const [i, cx] of [[0, -118], [1, 118]]) {
      if (!p.cush[i]) continue;
      rr(g, cx - 30, -104, 60, 50, 14);
      fillStroke(g, p.cush[i]);
    }
    for (const x of [-140, 130]) {
      rr(g, x, -6, 12, 12, 3);
      fillStroke(g, "#7a5a3a", 2.5);
    }
  },
  parts: (p, r) => [
    { key: "c", at: [0, -90], r: 80, vis: 3, alt: { c: other(r, ["#ff8787", "#74c0fc", "#8ce99a", "#ffd43b", "#b197fc"], p.c) } },
    ...p.cush.map((c, i) => ({ key: "cush", at: [i ? 118 : -118, -80], r: 30, vis: 2, alt: { cush: p.cush.map((q, j) => (j === i ? (q ? other(r, C.pale, q) : q) : q)) } })),
  ],
};

K.rug = {
  draw(g, p) {
    ell(g, 0, 0, 190, 46);
    fillStroke(g, p.c);
    ell(g, 0, 0, 150, 34);
    g.lineWidth = 6;
    g.strokeStyle = "rgba(255,255,255,.6)";
    g.stroke();
    ell(g, 0, 0, 100, 22);
    g.stroke();
  },
  parts: (p, r) => [{ key: "c", at: [0, 0], r: 90, vis: 3, alt: { c: other(r, ["#ffc9de", "#bfe3ff", "#c3f0c8", "#e2d4ff"], p.c) } }],
};

K.table = {
  draw(g, p) {
    rr(g, -80, -50, 160, 16, 6);
    fillStroke(g, "#c99a45");
    for (const x of [-66, 56]) {
      rr(g, x, -36, 10, 36, 3);
      fillStroke(g, "#a0703c", 2.5);
    }
    p.cups.forEach((c, i) => {
      if (!c) return;
      const x = -54 + i * 40;
      rr(g, x, -74, 22, 24, [2, 2, 7, 7]);
      fillStroke(g, c, 2.5);
      g.beginPath();
      g.arc(x + 23, -62, 6, -1.4, 1.4);
      g.lineWidth = 2.5;
      g.strokeStyle = INK;
      g.stroke();
    });
    if (p.steam) {
      g.strokeStyle = "rgba(255,255,255,.9)";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-44, -80);
      g.bezierCurveTo(-52, -92, -36, -98, -44, -110);
      g.stroke();
    }
  },
  parts: (p, r) => [
    ...p.cups.map((c, i) => ({ key: "cups", at: [-43 + i * 40, -62], r: 18, vis: 1, alt: { cups: p.cups.map((q, j) => (j === i ? (q ? other(r, C.bright, q) : q) : q)) } })),
    { key: "steam", at: [-44, -96], r: 18, vis: 1, alt: { steam: !p.steam } },
  ],
};

K.blocks = {
  draw(g, p) {
    p.b.forEach((b, i) => {
      const x = i === 2 ? -14 : -40 + i * 52;
      const y = i === 2 ? -88 : -44;
      rr(g, x, y, 44, 44, 5);
      fillStroke(g, b.c);
      g.fillStyle = "#fff";
      g.font = "400 28px Jua, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(b.t, x + 22, y + 24);
      g.lineWidth = 1.5;
      g.strokeStyle = INK;
      g.strokeText(b.t, x + 22, y + 24);
    });
  },
  parts: (p, r) =>
    p.b.flatMap((b, i) => {
      const at = i === 2 ? [8, -66] : [-18 + i * 52, -22];
      const set = (q) => ({ b: p.b.map((v, j) => (j === i ? { ...v, ...q } : v)) });
      return [
        { key: "b", at, r: 24, vis: 1, alt: set({ t: other(r, ["가", "나", "다", "A", "B", "C", "1", "2"], b.t) }) },
        { key: "b", at, r: 24, vis: 2, alt: set({ c: other(r, ["#ff6b6b", "#4dabf7", "#69db7c", "#ffa94d", "#9775fa"], b.c) }) },
      ];
    }),
};

K.plant = {
  draw(g, p) {
    p.lv.forEach((on, i) => {
      if (!on) return;
      const a = -1 + i * 0.5;
      ell(g, Math.sin(a) * 26, -60 - Math.cos(a) * 22, 11, 26, a);
      fillStroke(g, "#40b06a", 2.5);
    });
    g.beginPath();
    g.moveTo(-26, -46);
    g.lineTo(26, -46);
    g.lineTo(20, 0);
    g.lineTo(-20, 0);
    g.closePath();
    fillStroke(g, p.pot);
  },
  parts: (p, r) => [
    { key: "pot", at: [0, -22], r: 26, vis: 2, alt: { pot: other(r, ["#e8834a", "#4dabf7", "#f783ac", "#ffd43b"], p.pot) } },
    ...p.lv.map((on, i) => {
      const a = -1 + i * 0.5;
      return { key: "lv", at: [Math.sin(a) * 26, -60 - Math.cos(a) * 22], r: 18, vis: 1, alt: { lv: p.lv.map((v, j) => (j === i ? !v : v)) } };
    }),
  ],
};

/* 눈 오는 마을 */
K.snowman = {
  draw(g, p) {
    circ(g, 0, -40, 40);
    fillStroke(g, "#fff");
    circ(g, 0, -104, 30);
    fillStroke(g, "#fff");
    for (const s of [-1, 1]) {
      if (s === -1 && !p.arm) continue;
      g.strokeStyle = "#7a5a3a";
      g.lineWidth = 5;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(s * 34, -60);
      g.lineTo(s * 70, -88);
      g.moveTo(s * 58, -78);
      g.lineTo(s * 64, -96);
      g.stroke();
    }
    for (let i = 0; i < p.btn; i += 1) {
      circ(g, 0, -58 + i * 16, 4.5);
      g.fillStyle = INK;
      g.fill();
    }
    g.fillStyle = INK;
    circ(g, -10, -110, 3.5);
    g.fill();
    circ(g, 10, -110, 3.5);
    g.fill();
    if (p.nose) {
      g.beginPath();
      g.moveTo(-2, -102);
      g.lineTo(22, -98);
      g.lineTo(-2, -94);
      g.closePath();
      fillStroke(g, "#ff922b", 2);
    }
    // 목도리
    rr(g, -30, -82, 60, 13, 6);
    fillStroke(g, p.scarf, 2.5);
    rr(g, 8, -78, 13, 30, 5);
    fillStroke(g, p.scarf, 2.5);
    // 모자
    rr(g, -30, -136, 60, 9, 3);
    fillStroke(g, p.hat, 2.5);
    rr(g, -20, -170, 40, 36, 4);
    fillStroke(g, p.hat, 2.5);
    rr(g, -20, -146, 40, 7, 0);
    g.fillStyle = "#ff6b6b";
    g.fill();
  },
  parts: (p, r) => [
    { key: "hat", at: [0, -150], r: 28, vis: 2, alt: { hat: other(r, ["#3a3f5c", "#c2483a", "#2f6fd0"], p.hat) } },
    { key: "scarf", at: [0, -74], r: 26, vis: 2, alt: { scarf: other(r, ["#ff6b6b", "#4dabf7", "#69db7c", "#ffd43b"], p.scarf) } },
    { key: "nose", at: [10, -98], r: 16, vis: 1, alt: { nose: !p.nose } },
    { key: "btn", at: [0, -42], r: 20, vis: 1, alt: { btn: p.btn - 1 } },
    { key: "arm", at: [-52, -76], r: 24, vis: 2, alt: { arm: !p.arm } },
  ],
};

K.gift = {
  draw(g, p) {
    rr(g, -24, -40, 48, 40, 3);
    fillStroke(g, p.c);
    g.fillStyle = p.rib;
    g.fillRect(-5, -40, 10, 40);
    g.fillRect(-24, -24, 48, 9);
    for (const s of [-1, 1]) {
      ell(g, s * 10, -46, 10, 7, s * 0.4);
      fillStroke(g, p.rib, 2.2);
    }
    rr(g, -24, -40, 48, 40, 3);
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.stroke();
  },
  parts: (p, r) => [
    { key: "rib", at: [0, -44], r: 20, vis: 1, alt: { rib: other(r, ["#ffd43b", "#ff6b6b", "#fff", "#69db7c"], p.rib) } },
    { key: "c", at: [0, -20], r: 26, vis: 2, alt: { c: other(r, ["#ff6b6b", "#4dabf7", "#69db7c", "#9775fa"], p.c) } },
  ],
  remove: 2,
  size: 30,
  cy: -22,
};

K.sled = {
  draw(g, p) {
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-50, 0);
    g.lineTo(46, 0);
    g.quadraticCurveTo(62, 0, 60, -14);
    g.stroke();
    for (const x of [-32, 24]) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, -14);
      g.stroke();
    }
    rr(g, -52, -26, 100, 14, 5);
    fillStroke(g, p.c);
  },
  parts: (p, r) => [{ key: "c", at: [0, -18], r: 40, vis: 2, alt: { c: other(r, ["#ff6b6b", "#4dabf7", "#69db7c", "#ffd43b"], p.c) } }],
};

/* ---------- 배경 ---------- */
function sky(g, top, bot, h = SH) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bot);
  g.fillStyle = gr;
  g.fillRect(0, 0, SW, h);
}
function hills(g, y, col, amp, seed) {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(0, SH);
  for (let x = 0; x <= SW; x += 20) g.lineTo(x, y - (Math.sin(x * 0.012 + seed) * 0.5 + 0.5) * amp - Math.sin(x * 0.031 + seed * 2) * amp * 0.25);
  g.lineTo(SW, SH);
  g.closePath();
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = "rgba(60,90,60,.35)";
  g.stroke();
}

const BG = {
  village(g, b) {
    sky(g, "#7cc7ff", "#d8f1ff", 330);
    hills(g, 270, "#a8dc8f", 50, b.seed);
    hills(g, 300, "#8fcf7a", 30, b.seed + 2);
    // 땅 · 인도 · 길
    g.fillStyle = "#9fd88a";
    g.fillRect(0, 330, SW, 270);
    g.fillStyle = "#e9dcc4";
    g.fillRect(0, 380, SW, 110);
    g.strokeStyle = "rgba(120,90,60,.25)";
    g.lineWidth = 2;
    for (let x = 0; x < SW; x += 50) {
      g.beginPath();
      g.moveTo(x, 380);
      g.lineTo(x - 20, 490);
      g.stroke();
    }
    g.fillStyle = "#8c8f9c";
    g.fillRect(0, 490, SW, 70);
    g.fillStyle = "#fff";
    for (let x = 20; x < SW; x += 90) g.fillRect(x, 522, 46, 7);
    g.fillStyle = "#9fd88a";
    g.fillRect(0, 560, SW, 40);
  },
  park(g, b) {
    sky(g, "#86ceff", "#e2f6ff", 300);
    hills(g, 250, "#b9e49b", 60, b.seed);
    for (let i = 0; i < 9; i += 1) {
      const x = 30 + i * 92 + ((b.seed * 37 + i * 53) % 30);
      const y = 262 + ((i * 17) % 20);
      circ(g, x, y, 24);
      g.fillStyle = i % 2 ? "#7fc77a" : "#6db86a";
      g.fill();
    }
    hills(g, 300, "#8fd47a", 26, b.seed + 3);
    g.fillStyle = "#86cf6f";
    g.fillRect(0, 320, SW, 280);
    g.fillStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 197 + b.seed * 31) % SW;
      const y = 340 + ((i * 89) % 250);
      g.fillRect(x, y, 3, 8);
    }
  },
  beach(g, b) {
    sky(g, "#5fb8ff", "#d6f1ff", 250);
    const sea = g.createLinearGradient(0, 240, 0, 350);
    sea.addColorStop(0, "#2f9ee8");
    sea.addColorStop(1, "#7fd8f5");
    g.fillStyle = sea;
    g.fillRect(0, 240, SW, 120);
    g.strokeStyle = "rgba(255,255,255,.7)";
    g.lineWidth = 3;
    for (let i = 0; i < 8; i += 1) {
      const x = (i * 113 + b.seed * 17) % SW;
      const y = 262 + (i % 4) * 22;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 14, y - 6, x + 28, y);
      g.stroke();
    }
    g.fillStyle = "#f7e2a8";
    g.beginPath();
    g.moveTo(0, 360);
    for (let x = 0; x <= SW; x += 20) g.lineTo(x, 352 + Math.sin(x * 0.03 + b.seed) * 6);
    g.lineTo(SW, SH);
    g.lineTo(0, SH);
    g.closePath();
    g.fill();
    g.strokeStyle = "#fff";
    g.lineWidth = 6;
    g.beginPath();
    for (let x = 0; x <= SW; x += 20) g.lineTo(x, 352 + Math.sin(x * 0.03 + b.seed) * 6);
    g.stroke();
    g.fillStyle = "rgba(200,160,90,.25)";
    for (let i = 0; i < 50; i += 1) {
      circ(g, (i * 151 + b.seed * 13) % SW, 380 + ((i * 71) % 210), 2);
      g.fill();
    }
  },
  room(g, b) {
    g.fillStyle = b.wall;
    g.fillRect(0, 0, SW, 420);
    // 벽지 무늬
    g.fillStyle = "rgba(255,255,255,.35)";
    for (let y = 20; y < 400; y += 46) for (let x = (y / 46) % 2 ? 20 : 43; x < SW; x += 46) {
      circ(g, x, y, 4);
      g.fill();
    }
    g.fillStyle = "#fff6e6";
    g.fillRect(0, 380, SW, 40);
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 380);
    g.lineTo(SW, 380);
    g.moveTo(0, 420);
    g.lineTo(SW, 420);
    g.stroke();
    g.fillStyle = "#d9a66b";
    g.fillRect(0, 420, SW, 180);
    g.strokeStyle = "rgba(120,70,30,.35)";
    g.lineWidth = 2;
    for (let y = 450; y < SH; y += 34) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(SW, y);
      g.stroke();
    }
  },
  snow(g, b) {
    sky(g, "#4b5fb0", "#b8c6f0", 330);
    g.fillStyle = "rgba(255,255,255,.9)";
    for (let i = 0; i < 26; i += 1) {
      circ(g, (i * 173 + b.seed * 11) % SW, (i * 97) % 300, 2.4);
      g.fill();
    }
    hills(g, 290, "#e8f0ff", 40, b.seed);
    g.fillStyle = "#f4f8ff";
    g.fillRect(0, 330, SW, 270);
    g.fillStyle = "#d8e3f8";
    g.beginPath();
    g.moveTo(0, 470);
    g.quadraticCurveTo(400, 430, SW, 480);
    g.lineTo(SW, 520);
    g.quadraticCurveTo(400, 480, 0, 512);
    g.closePath();
    g.fill();
  },
};

/* ---------- 장면 짜기 ---------- */
const PALS = ["bear", "bunny", "panda", "pig", "duck", "cat", "tiger", "penguin"];
function pal(r, x, y, opt = {}) {
  return {
    k: "pal",
    x,
    y,
    s: opt.s || 1,
    p: {
      id: opt.id || pick(r, PALS),
      head: r() < 0.5 ? pick(r, HEADS.slice(1)) : undefined,
      glass: r() < 0.3,
      happi: opt.pose !== "sit" && r() < 0.3,
      belt: pick(r, ["#ff6b6b", "#4dabf7", "#69db7c", "#ffd43b", "#9775fa"]),
      bal: opt.bal ? pick(r, ["#ff6b6b", "#4dabf7", "#ffd43b", "#f783ac"]) : null,
      eye: pick(r, ["open", "happy"]),
      mouth: "smile",
      pose: opt.pose || "idle",
      face: opt.face || (r() < 0.5 ? 1 : -1),
      t: r() * 10,
    },
  };
}
function house(r, x, y, opt = {}) {
  const w = opt.w || between(r, 130, 170);
  const nw = r() < 0.5 ? 2 : 1;
  const win = [];
  for (let i = 0; i < nw; i += 1) win.push({ x: nw === 1 ? 0.26 : 0.24 + i * 0.52, y: 0.32, c: pick(r, C.curtain), cross: r() < 0.6, round: r() < 0.25, box: r() < 0.4 ? pick(r, C.bright) : null });
  const door = nw === 2 ? 0.5 : 0.72;
  if (nw === 2) win.forEach((v) => (v.y = 0.3));
  return {
    k: "house",
    x,
    y,
    s: opt.s || 1,
    p: { w, h: between(r, 120, 150), wall: pick(r, C.wall), roof: pick(r, C.roof), round: r() < 0.3, chim: r() < 0.7, smoke: r() < 0.5, win, door, dc: pick(r, C.bright), knob: true, snow: !!opt.snow, lit: !!opt.snow, wreath: opt.snow ? "#ff4d4d" : null },
  };
}
function cloud(r, x, y, s, night) {
  const b = [[0, 0, 30], [-32, 8, 22], [32, 6, 24], [-12, -16, 24]];
  if (r() < 0.6) b.push([54, 12, 16]);
  return { k: "cloud", x, y, s, p: { b, night } };
}
function flowersRow(r, x, y, n, s = 1) {
  return { k: "flowers", x, y, s, p: { fl: Array.from({ length: n }, (_, i) => ({ x: i * 34 + between(r, -4, 4), h: between(r, 26, 44), c: pick(r, C.bright) })) } };
}

const THEMES = [
  {
    id: "village",
    name: "동물 마을 거리",
    build(r) {
      const o = [];
      o.push({ k: "sun", x: between(r, 80, 720), y: 70, s: 0.75, p: { n: 10, c: "#ffd43b" } });
      o.push(cloud(r, between(r, 120, 330), between(r, 60, 110), 1));
      o.push(cloud(r, between(r, 470, 700), between(r, 50, 120), 0.8));
      const sun = o[0];
      o.push({ k: "birds", x: sun.x < 400 ? between(r, 470, 640) : between(r, 160, 300), y: 160, s: 1, p: { b: [[0, 0], [30, 14], [56, -4]] } });
      // 집 2 + 가게 1, 순서 무작위
      const slots = [[30, 0], [290, 1], [560, 2]];
      const shopAt = Math.floor(r() * 3);
      slots.forEach(([x], i) => {
        if (i === shopAt) o.push({ k: "shop", x: x - 10, y: 380, s: 1, p: { wall: pick(r, C.wall), aw: pick(r, ["#ff6b6b", "#4dabf7", "#69db7c", "#ffa94d"]), icon: pick(r, ["cake", "bread", "flower", "fish", "cup"]), items: [pick(r, ["cake", "bread", "cup"]), pick(r, ["bread", "flower", "cup"]), pick(r, ["cake", "fish", "flower"])], dc: pick(r, C.bright) } });
        else o.push(house(r, x, 380, { w: 170 }));
      });
      const trees = [between(r, 228, 262), between(r, 498, 530)];
      trees.forEach((x) => o.push({ k: "tree", x, y: 392, s: 0.72, p: { leaf: "#5fc06a", f: [[-30, -140], [24, -160], [36, -112], [-8, -112]].slice(0, 3 + Math.floor(r() * 2)), fc: "#ff4d4d", hole: r() < 0.5 } }));
      o.push({ k: "cat", x: 0, y: 0, s: 0.8, p: { c: pick(r, ["#ffb366", "#9aa3b5", "#5c5c66"]), tail: 1, collar: pick(r, ["#ff4d4d", "#4dabf7"]) }, onRoof: true });
      o.push({ k: "lamp", x: between(r, 130, 680), y: 488, s: 0.85, p: { c: "#3a4a6b", lit: r() < 0.5 } });
      o.push({ k: "mailbox", x: between(r, 60, 740), y: 486, s: 0.85, p: { c: pick(r, ["#4dabf7", "#ff6b6b"]), flag: r() < 0.5 } });
      const xs = [between(r, 110, 230), between(r, 350, 450), between(r, 570, 690)];
      xs.forEach((x, i) => o.push(pal(r, x, 478 + between(r, 0, 10), { bal: i === Math.floor(r() * 3) })));
      for (const x of [between(r, 20, 60), between(r, 730, 780)]) o.push({ k: "bush", x, y: 392, s: 0.8, p: { c: "#4fb35e", k: "flower", f: [[-24, -30, pick(r, C.bright)], [6, -48, pick(r, C.bright)], [26, -24, pick(r, C.bright)]] } });
      o.push(flowersRow(r, between(r, 20, 120), 590, 6, 0.9));
      o.push(flowersRow(r, between(r, 520, 600), 590, 5, 0.9));
      o.push({ k: "fence", x: between(r, 260, 330), y: 590, s: 0.9, p: { n: 8, c: "#ffffff", miss: -1 } });
      return o;
    },
  },
  {
    id: "park",
    name: "공원 소풍",
    build(r) {
      const o = [];
      const sunX = between(r, 520, 740);
      o.push({ k: "sun", x: sunX, y: 70, s: 0.7, p: { n: 8, c: "#ffd43b" } });
      o.push(cloud(r, between(r, 80, 280), 80, 0.9));
      o.push(cloud(r, between(r, 340, 480), 60, 0.7));
      o.push({ k: "kite", x: between(r, 300, 460), y: 140, s: 0.85, p: { c1: pick(r, C.bright), c2: "#fff", bows: [true, true, true, true] } });
      o.push({ k: "birds", x: between(r, 560, 700), y: 150, s: 0.9, p: { b: [[0, 0], [28, 12]] } });
      const left = r() < 0.5;
      o.push({ k: "tree", x: left ? 110 : 690, y: 430, s: 1.05, p: { leaf: "#5fc06a", f: [[-36, -150], [20, -176], [44, -120], [-10, -112], [-50, -104]], fc: "#ff4d4d", hole: r() < 0.6 } });
      o.push({ k: "pond", x: left ? 600 : 220, y: 350, s: 0.85, p: { duck: 1 } });
      o.push({ k: "bench", x: left ? 680 : 120, y: 410, s: 0.9, p: { c: pick(r, ["#e8594a", "#4a7fd8", "#2fa36b"]) } });
      o.push({ k: "mat", x: 400, y: 540, s: 1.15, p: { c: pick(r, ["#ff6b6b", "#4dabf7", "#69db7c"]), basket: true, candles: 2, cherry: true, cups: [pick(r, C.bright), pick(r, C.bright)], sand: true } });
      o.push({ ...pal(r, 230, 520, { pose: "sit", face: 1 }), z: 545 });
      o.push({ ...pal(r, 570, 520, { pose: "sit", face: -1 }), z: 545 });
      o.push(pal(r, left ? 330 : 470, 445, { bal: true, pose: "cheer" }));
      o.push({ k: "butterfly", x: between(r, 160, 640), y: between(r, 330, 380), s: 0.9, p: { c: pick(r, C.bright) } });
      o.push({ k: "butterfly", x: between(r, 100, 700), y: between(r, 420, 460), s: 0.75, p: { c: pick(r, C.bright) } });
      o.push({ k: "ball", x: left ? 700 : 100, y: 585, s: 1, p: { c1: "#ff6b6b", c2: "#4dabf7" } });
      o.push(flowersRow(r, 20, 600, 4, 0.9));
      o.push(flowersRow(r, 660, 600, 4, 0.9));
      o.push({ k: "fence", x: left ? 470 : 60, y: 330, s: 0.75, p: { n: 10, c: "#ffffff", miss: -1 } });
      o.push({ k: "bush", x: left ? 260 : 540, y: 372, s: 0.85, p: { c: "#4fb35e", k: "berry", f: [[-24, -28, "#ff4d4d"], [4, -46, "#ff4d4d"], [24, -26, "#ff4d4d"], [-4, -24, "#ff4d4d"]] } });
      o.push({ k: "bush", x: left ? 760 : 40, y: 470, s: 0.9, p: { c: "#4fb35e", k: "flower", f: [[-22, -30, pick(r, C.bright)], [8, -46, pick(r, C.bright)], [26, -22, pick(r, C.bright)]] } });
      return o;
    },
  },
  {
    id: "beach",
    name: "바닷가 하루",
    build(r) {
      const o = [];
      o.push({ k: "sun", x: between(r, 80, 300), y: 70, s: 0.75, p: { n: 12, c: "#ffd43b" } });
      o.push(cloud(r, between(r, 380, 700), 80, 0.85));
      o.push({ k: "birds", x: between(r, 360, 620), y: 140, s: 1, p: { b: [[0, 0], [26, -10], [52, 6]] } });
      const lr = r() < 0.5;
      o.push({ k: "island", x: lr ? 120 : 680, y: 262, s: 0.8, p: { co: 3 } });
      o.push({ k: "lighthouse", x: lr ? 700 : 100, y: 300, s: 0.75, p: { c: "#ff6b6b", light: "#fff3a8", door: true } });
      o.push({ k: "boat", x: between(r, 300, 500), y: 300, s: 0.75, p: { hull: pick(r, ["#e8594a", "#4a7fd8"]), sail: pick(r, ["#ff6b6b", "#4dabf7", "#ffd43b"]), flag: true } });
      o.push({ k: "umbrella", x: lr ? 600 : 200, y: 470, s: 1, p: { c: pick(r, ["#ff6b6b", "#4dabf7", "#ffd43b"]), towel: pick(r, ["#ff8fab", "#74c0fc"]) } });
      o.push({ k: "castle", x: lr ? 260 : 540, y: 500, s: 0.95, p: { tw: [true, false, true], flag: "#ff4d4d" } });
      o.push({ k: "bucket", x: lr ? 360 : 440, y: 520, s: 0.85, p: { c: pick(r, ["#ff6b6b", "#4dabf7", "#69db7c"]), shovel: true } });
      o.push({ k: "crab", x: between(r, 80, 720), y: 575, s: 0.85, p: { c: "#ff6b6b", claws: true } });
      o.push({ k: "shells", x: between(r, 120, 280), y: 590, s: 1, p: { s: [{ x: 0, k: "star", c: "#ffa94d" }, { x: 44, k: "shell", c: "#f783ac" }, { x: 92, k: "shell", c: "#ffd43b" }] } });
      o.push({ k: "ball", x: between(r, 420, 560), y: 590, s: 1, p: { c1: "#ff6b6b", c2: "#ffd43b" } });
      o.push(pal(r, lr ? 470 : 330, 480, { face: lr ? 1 : -1 }));
      o.push(pal(r, lr ? 700 : 100, 565, { face: lr ? -1 : 1, pose: "sit" }));
      o.push({ k: "ring", x: lr ? 730 : 70, y: 470, s: 1, p: { c: "#ff6b6b" } });
      o.push({ k: "surf", x: lr ? 70 : 730, y: 470, s: 0.95, p: { c: pick(r, ["#ffd43b", "#4dabf7", "#f783ac"]), s: "#fff" } });
      o.push({ k: "boat", x: lr ? 560 : 240, y: 268, s: 0.42, p: { hull: "#4a7fd8", sail: "#ffd43b", flag: true } });
      return o;
    },
  },
  {
    id: "room",
    name: "아늑한 방",
    build(r) {
      const o = [];
      const wl = r() < 0.5;
      o.push({ k: "window", x: wl ? 170 : 630, y: 170, s: 1, p: { cur: pick(r, C.curtain), view: r() < 0.5 ? "sun" : "cloud" } });
      o.push({ k: "frame", x: wl ? 400 : 330, y: 140, s: 0.9, p: { icon: pick(r, ["heart", "star", "flower", "house"]), bg: pick(r, C.pale), fc: "#c99a45" } });
      o.push({ k: "clock", x: wl ? 540 : 460, y: 110, s: 0.9, p: { h: Math.floor(r() * 12), m: pick(r, [0, 15, 30, 45]), c: pick(r, ["#ff8fab", "#74c0fc", "#ffd43b"]) } });
      o.push({ k: "shelf", x: wl ? 610 : 180, y: 280, s: 0.95, p: { books: Array.from({ length: 6 }, () => ({ w: between(r, 14, 22), h: between(r, 38, 56), c: pick(r, C.bright) })), pot: pick(r, ["#e8834a", "#4dabf7"]) } });
      o.push({ k: "rug", x: 400, y: 520, s: 1, p: { c: pick(r, ["#ffc9de", "#bfe3ff", "#c3f0c8"]) } });
      o.push({ k: "sofa", x: 400, y: 430, s: 0.95, p: { c: pick(r, ["#ff8787", "#74c0fc", "#8ce99a", "#b197fc"]), cush: [pick(r, C.pale), pick(r, C.pale)] } });
      o.push({ ...pal(r, 355, 408, { pose: "sit", face: 1 }), z: 431, s: 1.15 });
      o.push({ ...pal(r, 445, 408, { pose: "sit", face: -1 }), z: 431, s: 1.15 });
      o.push({ k: "table", x: 400, y: 575, s: 1, p: { cups: [pick(r, C.bright), pick(r, C.bright), pick(r, C.bright)], steam: true } });
      o.push({ k: "blocks", x: wl ? 650 : 140, y: 580, s: 0.9, p: { b: [{ t: "가", c: "#ff6b6b" }, { t: "나", c: "#4dabf7" }, { t: "다", c: "#69db7c" }] } });
      o.push({ k: "plant", x: wl ? 90 : 710, y: 500, s: 1, p: { pot: pick(r, ["#e8834a", "#f783ac"]), lv: [true, true, true, true, true] } });
      o.push({ k: "floorlamp", x: wl ? 740 : 60, y: 470, s: 1, p: { c: pick(r, ["#ffd8a8", "#bfe3ff", "#ffc9de"]), tassel: true } });
      o.push({ k: "frame", x: wl ? 400 : 330, y: 258, s: 0.6, p: { icon: pick(r, ["heart", "star", "flower", "house"]), bg: pick(r, C.pale), fc: "#e8594a" } });
      o.push({ ...pal(r, wl ? 590 : 210, 598, { pose: "sit", id: "bear", face: wl ? -1 : 1 }), s: 0.62 });
      o.push({ k: "cat", x: wl ? 230 : 570, y: 560, s: 0.9, p: { c: pick(r, ["#ffb366", "#9aa3b5", "#5c5c66"]), tail: wl ? -1 : 1, collar: "#ff4d4d" } });
      o.push({ k: "ball", x: wl ? 520 : 280, y: 595, s: 0.75, p: { c1: "#ff6b6b", c2: "#ffd43b" } });
      return o;
    },
  },
  {
    id: "snow",
    name: "눈 오는 마을",
    build(r) {
      const o = [];
      o.push({ k: "moon", x: between(r, 80, 720), y: 70, s: 0.85, p: { spots: [[-12, -8, 7], [10, 10, 6], [12, -14, 4]] } });
      o.push(cloud(r, between(r, 200, 600), 110, 0.75, true));
      o.push(house(r, 40, 380, { w: 160, snow: true }));
      o.push(house(r, 580, 380, { w: 170, snow: true }));
      o.push({ k: "pine", x: between(r, 270, 330), y: 395, s: 0.85, p: { snow: true, star: true, o: [[-20, -48, "#ff4d4d"], [18, -60, "#ffd43b"], [-10, -96, "#4dabf7"], [14, -128, "#ff4d4d"]] } });
      o.push({ k: "pine", x: between(r, 450, 490), y: 400, s: 0.7, p: { snow: true, star: false, o: [[-16, -50, "#ffd43b"], [16, -86, "#ff4d4d"]] } });
      o.push({ k: "snowman", x: 400, y: 520, s: 0.95, p: { hat: "#3a3f5c", scarf: pick(r, ["#ff6b6b", "#4dabf7"]), nose: true, btn: 3, arm: true } });
      o.push({ k: "sled", x: between(r, 560, 680), y: 560, s: 1, p: { c: pick(r, ["#ff6b6b", "#4dabf7"]) } });
      o.push({ k: "gift", x: between(r, 120, 220), y: 590, s: 1, p: { c: pick(r, ["#ff6b6b", "#69db7c"]), rib: "#ffd43b" } });
      o.push({ k: "gift", x: between(r, 250, 300), y: 595, s: 0.8, p: { c: pick(r, ["#4dabf7", "#9775fa"]), rib: "#fff" } });
      o.push({ k: "lamp", x: between(r, 538, 560), y: 470, s: 0.85, p: { c: "#3a4a6b", lit: true } });
      o.push(pal(r, 250, 505, { face: 1 }));
      o.push(pal(r, 660, 480, { face: -1, bal: r() < 0.5 }));
      o.push({ k: "bush", x: between(r, 720, 770), y: 600, s: 0.85, p: { c: "#3f9a68", k: "berry", f: [[-20, -30, "#ff4d4d"], [6, -46, "#ff4d4d"], [24, -24, "#ff4d4d"]] } });
      o.push({ k: "gift", x: between(r, 330, 360), y: 600, s: 0.7, p: { c: "#ffd43b", rib: "#ff6b6b" } });
      return o;
    },
  },
];
export const THEME_NAMES = THEMES.map((t) => t.name);

/** 지붕 위 고양이 같은 붙어 있는 물건 자리 잡기 */
function settle(objs, r) {
  const cat = objs.find((o) => o.onRoof);
  if (cat) {
    const homes = objs.filter((o) => o.k === "house");
    const h = pick(r, homes);
    const w = h.p.w;
    const fx = 0.2;
    let ry;
    if (h.p.round) {
      const u = (fx * w + 16) / (w + 32);
      ry = -h.p.h + 4 - 2 * u * (1 - u) * 124;
    } else ry = -h.p.h + 4 - 82 * (1 - Math.abs(fx * w - w / 2) / (w / 2 + 18));
    cat.x = h.x + fx * w * h.s;
    cat.y = h.y + (ry + 10) * h.s;
    cat.z = h.y + 1;
    cat.p.tail = r() < 0.5 ? 1 : -1;
  }
}

/* ---------- 단계 만들기 ---------- */
export function buildStage(index) {
  const r = mulberry32(5150 + index * 977);
  const theme = THEMES[index % THEMES.length];
  const objs = theme.build(r);
  settle(objs, r);
  const bg = { seed: Math.floor(r() * 100), wall: pick(r, ["#ffe3ec", "#e3f0ff", "#fff3d1", "#e6f7e1"]) };
  const need = Math.min(7, 3 + Math.floor(index / 7));
  // 앞 단계는 잘 보이는 차이, 뒤로 갈수록 작은 차이
  const prefer = 3 - Math.min(2, (index / 49) * 2.4);
  const cands = [];
  objs.forEach((o, oi) => {
    const def = K[o.k];
    const sx = o.flip ? -o.s : o.s;
    for (const part of def.parts(o.p, r)) cands.push({ oi, key: part.key, alt: part.alt, vis: part.vis, x: o.x + part.at[0] * sx, y: o.y + part.at[1] * o.s, r: part.r * o.s });
    if (def.remove) cands.push({ oi, key: "gone", alt: { gone: true }, vis: def.remove, x: o.x, y: o.y + (def.cy || 0) * o.s, r: def.size * o.s });
  });
  cands.forEach((c) => (c.w = r() + Math.abs(c.vis - prefer) * 0.8));
  cands.sort((a, b) => a.w - b.w);
  const diffs = [];
  for (const c of cands) {
    if (diffs.length >= need) break;
    if (c.x < 20 || c.x > SW - 20 || c.y < 20 || c.y > SH - 10) continue;
    if (diffs.some((d) => Math.hypot(d.x - c.x, d.y - c.y) < 90)) continue;
    if (diffs.some((d) => d.oi === c.oi && (d.key === c.key || d.key === "gone" || c.key === "gone"))) continue;
    diffs.push({ id: `d${diffs.length}`, ...c, hit: Math.max(42, c.r * 1.2) });
  }
  return { index, theme: theme.id, name: `${theme.name} ${Math.floor(index / THEMES.length) + 1}`, objs, bg, diffs, need: diffs.length };
}

/** side: "L" 원본, "R" 다른 그림 */
export function drawScene(g, st, side) {
  BG[st.theme](g, st.bg);
  const right = side === "R";
  const list = st.objs.map((o, oi) => {
    if (!right) return o;
    let p = o.p;
    for (const d of st.diffs) if (d.oi === oi) p = { ...p, ...d.alt };
    return p === o.p ? o : { ...o, p };
  });
  const zOf = (o) => (o.z === undefined ? o.y : o.z);
  const order = list.map((o, i) => i).sort((a, b) => zOf(list[a]) - zOf(list[b]) || a - b);
  for (const i of order) {
    const o = list[i];
    if (o.p.gone) continue;
    g.save();
    g.translate(o.x, o.y);
    g.scale(o.flip ? -o.s : o.s, o.s);
    K[o.k].draw(g, o.p, o);
    g.restore();
  }
}
