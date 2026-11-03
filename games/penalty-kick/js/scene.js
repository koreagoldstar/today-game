/*
 * 경기장: 잔디 · 흰 선 · 골대 · 출렁이는 그물 · 공 · 관중 · 전광판 · 조명
 *  좌표: 골라인이 z=0, 페널티 지점이 z=11, 카메라 쪽이 +z. 단위 m.
 */
import { THREE, Batch, canvas, tex, rng, std, mat4, glow, TAU } from "../../oneshot-elite/js/kit.js";

export const GOAL = { hw: 3.66, h: 2.44, postR: 0.06, depth: 1.9 };
export const SPOT = { x: 0, z: 11 };
export const BALL_R = 0.11;

/* ---------- 공 무늬: 진짜 축구공처럼 오각형 12 + 육각형 20 ---------- */
export function ballTexture(size = 512) {
  const phi = (1 + Math.sqrt(5)) / 2;
  const V = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ].map((v) => {
    const l = Math.hypot(...v);
    return [v[0] / l, v[1] / l, v[2] / l];
  });
  const faces = [];
  for (let a = 0; a < 12; a += 1) {
    for (let b = a + 1; b < 12; b += 1) {
      for (let c = b + 1; c < 12; c += 1) {
        const near = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2] > 0.4;
        if (near(V[a], V[b]) && near(V[b], V[c]) && near(V[a], V[c])) {
          const s = [V[a][0] + V[b][0] + V[c][0], V[a][1] + V[b][1] + V[c][1], V[a][2] + V[b][2] + V[c][2]];
          const l = Math.hypot(...s);
          faces.push([s[0] / l, s[1] / l, s[2] / l]);
        }
      }
    }
  }
  const pts = [...V, ...faces];
  const w = size;
  const h = size / 2;
  const c = canvas(w, h);
  const g = c.getContext("2d");
  const im = g.createImageData(w, h);
  const d = im.data;
  for (let y = 0; y < h; y += 1) {
    const lat = ((y + 0.5) / h) * Math.PI;
    const sy = Math.cos(lat);
    const sr = Math.sin(lat);
    for (let x = 0; x < w; x += 1) {
      const lon = ((x + 0.5) / w) * TAU;
      const px = sr * Math.cos(lon);
      const pz = sr * Math.sin(lon);
      let best = -2;
      let second = -2;
      let idx = 0;
      for (let i = 0; i < pts.length; i += 1) {
        const q = pts[i];
        // 오각형은 조금 더 넓게 잡힘
        const dot = (px * q[0] + sy * q[1] + pz * q[2]) * (i < 12 ? 1.015 : 1);
        if (dot > best) {
          second = best;
          best = dot;
          idx = i;
        } else if (dot > second) second = dot;
      }
      const seam = best - second < 0.012;
      const black = idx < 12;
      const v = seam ? (black ? 40 : 96) : black ? 26 : 246;
      const k = (y * w + x) * 4;
      d[k] = v;
      d[k + 1] = v;
      d[k + 2] = black ? v + 6 : v;
      d[k + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return tex(c, { repeat: false });
}

/* ---------- 잔디 무늬 조각 ---------- */
function noiseTex() {
  const c = canvas(256, 256);
  const g = c.getContext("2d");
  const r = rng(13);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i += 1) {
    const v = 90 + r() * 90;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 1.2, 2 + r() * 4);
  }
  return tex(c);
}

/* ---------- 경기장 ---------- */
export function buildStadium(scene, quality) {
  const root = new THREE.Group();
  scene.add(root);
  const uT = { value: 0 };
  const uJump = { value: 0.05 };

  // 잔디: 깎은 줄무늬 + 결
  const pitchMat = std({ color: 0xffffff, roughness: 0.92 });
  pitchMat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: noiseTex() };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D detailMap;\nvarying vec3 vWPos;")
      .replace(
        "#include <map_fragment>",
        `float dA = texture2D(detailMap, vWPos.xz * 0.9).r;
float dB = texture2D(detailMap, vWPos.xz * 0.17).r;
float stripe = step(0.5, fract(vWPos.z / 11.0 + 0.5));
vec3 grassA = vec3(0.052, 0.178, 0.05);
vec3 grassB = vec3(0.085, 0.262, 0.07);
diffuseColor.rgb = mix(grassA, grassB, stripe) * (0.66 + 0.46 * dA + 0.26 * dB);`
      );
  };
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(220, 200), pitchMat);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0, 20);
  pitch.receiveShadow = true;
  root.add(pitch);

  // 흰 선: 그림이 아니라 면이라 가까이서도 또렷함
  const lines = new Batch();
  const white = std({ color: 0xf6f6f0, roughness: 0.85 });
  const LY = 0.012;
  const lineBox = (x0, z0, x1, z1, w = 0.1) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const a = Math.atan2(dx, dz);
    lines.add(white, new THREE.BoxGeometry(w, 0.004, len), mat4((x0 + x1) / 2, LY, (z0 + z1) / 2, 0, a, 0), 0xffffff);
  };
  lineBox(-52, 0, 52, 0); // 골라인
  lineBox(-9.16, 5.5, 9.16, 5.5); // 골 지역
  lineBox(-9.16, 0, -9.16, 5.5);
  lineBox(9.16, 0, 9.16, 5.5);
  lineBox(-20.16, 16.5, 20.16, 16.5); // 페널티 지역
  lineBox(-20.16, 0, -20.16, 16.5);
  lineBox(20.16, 0, 20.16, 16.5);
  lines.add(white, new THREE.CylinderGeometry(0.12, 0.12, 0.004, 24), mat4(0, LY, SPOT.z), 0xffffff);
  // 페널티 아크
  let prev = null;
  for (let i = 0; i <= 28; i += 1) {
    const a = -0.93 + (i / 28) * 1.86;
    const p = [Math.sin(a) * 9.15, SPOT.z + Math.cos(a) * 9.15];
    if (p[1] >= 16.5 && prev && prev[1] >= 16.5) lineBox(prev[0], prev[1], p[0], p[1], 0.1);
    prev = p;
  }
  lines.build(root, { cast: false });

  // 관중석
  const shirts = [0x8c2a2a, 0xb9bcc4, 0x7c2525, 0x1f3d7a, 0x9c8a3a, 0x9a9ca6, 0x19223f, 0x8c2a2a, 0x2a2f45, 0x3a4560, 0x24293a, 0x6e2a33];
  const heads = [0x9c7a60, 0x8d6e56, 0xa98a6e, 0x1c1c22, 0x2c221a];
  const r = rng(77);
  const bodyGeo = new THREE.BoxGeometry(0.4, 0.58, 0.28);
  bodyGeo.translate(0, 0.31, 0);
  const headGeo = new THREE.IcosahedronGeometry(0.135, 1);
  headGeo.translate(0, 0.72, 0);
  const seatMat = std({ color: 0x1a2340, roughness: 0.9 });
  const steps = new Batch();
  const people = [];
  const density = quality === "high" ? 1 : quality === "mid" ? 0.6 : 0.3;
  const addStand = (cx, cz, rotY, width, rows, baseH) => {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const put = (lx, y, lz) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
    for (let row = 0; row < rows; row += 1) {
      const y = baseH + row * 0.62;
      const lz = -row * 1.05;
      const [x, , z] = put(0, 0, lz);
      steps.add(seatMat, new THREE.BoxGeometry(width, y + 0.2, 1.08), mat4(x, (y + 0.2) / 2, z, 0, rotY, 0), row % 2 ? 0x1f2a4d : 0x18213e);
      for (let lx = -width / 2 + 0.4; lx < width / 2; lx += 0.56) {
        if (r() > density) continue;
        const [px, py, pz] = put(lx + (r() - 0.5) * 0.18, y + 0.2, lz);
        people.push({ x: px, y: py, z: pz, ry: rotY + (r() - 0.5) * 0.5, s: 0.88 + r() * 0.2 });
      }
    }
    // 뒤 벽 · 지붕
    const [bx, , bz] = put(0, 0, -rows * 1.05 - 0.4);
    const topY = baseH + rows * 0.62;
    steps.add(seatMat, new THREE.BoxGeometry(width, topY + 7, 1), mat4(bx, (topY + 7) / 2, bz, 0, rotY, 0), 0x121a33);
    const [rx, , rz] = put(0, 0, -rows * 0.55);
    steps.add(seatMat, new THREE.BoxGeometry(width + 2, 0.5, rows * 1.3), mat4(rx, topY + 6.5, rz, 0.08, rotY, 0), 0x2a3555);
  };
  addStand(0, -17, 0, 120, 26, 1.5); // 골대 뒤
  addStand(-46, 18, Math.PI / 2, 80, 16, 1.6);
  addStand(46, 18, -Math.PI / 2, 80, 16, 1.6);
  addStand(0, 62, Math.PI, 110, 16, 1.6);
  steps.build(root, { cast: false, receive: false });

  const bodies = new THREE.InstancedMesh(bodyGeo, std({ roughness: 0.85 }), people.length);
  const headsM = new THREE.InstancedMesh(headGeo, std({ roughness: 0.8 }), people.length);
  const col = new THREE.Color();
  const dummy = new THREE.Object3D();
  people.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.ry, 0);
    dummy.scale.setScalar(p.s);
    dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    headsM.setMatrixAt(i, dummy.matrix);
    bodies.setColorAt(i, col.set(shirts[Math.floor(r() * shirts.length)]));
    headsM.setColorAt(i, col.set(heads[Math.floor(r() * heads.length)]));
  });
  const jumpShader = (m) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uT = uT;
      sh.uniforms.uJump = uJump;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uT;\nuniform float uJump;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.y += abs(sin(uT * (4.2 + fract(instanceMatrix[3][0] * 0.37) * 2.4) + instanceMatrix[3][0] * 0.9 + instanceMatrix[3][2] * 1.3)) * uJump;\ntransformed.x += sin(uT * 2.0 + instanceMatrix[3][2]) * uJump * 0.15;");
    };
  };
  jumpShader(bodies.material);
  jumpShader(headsM.material);
  bodies.frustumCulled = false;
  headsM.frustumCulled = false;
  root.add(bodies);
  root.add(headsM);

  // 광고판 (전광 띠)
  const bc = canvas(2048, 128);
  const bg = bc.getContext("2d");
  const boardBase = () => {
    const gr = bg.createLinearGradient(0, 0, 2048, 0);
    gr.addColorStop(0, "#0b2a6b");
    gr.addColorStop(0.5, "#1248b8");
    gr.addColorStop(1, "#0b2a6b");
    bg.fillStyle = gr;
    bg.fillRect(0, 0, 2048, 128);
    bg.font = "900 78px Arial, sans-serif";
    bg.textBaseline = "middle";
    const items = ["TODAY GAME", "오늘의 게임", "PENALTY HERO", "승부차기 히어로"];
    let x = 30;
    for (const t of items) {
      bg.fillStyle = "#ffffff";
      bg.fillText(t, x, 68);
      x += bg.measureText(t).width + 70;
      bg.fillStyle = "#ffd338";
      bg.fillText("★", x - 56, 68);
    }
  };
  boardBase();
  const boardTex = tex(bc);
  const boardMat = new THREE.MeshBasicMaterial({ map: boardTex, color: new THREE.Color(1.05, 1.05, 1.05), toneMapped: false });
  const addBoard = (x, z, ry, w) => {
    boardTex.repeat.x = 1;
    const g = new THREE.PlaneGeometry(w, 1.05);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setX(i, (uv.getX(i) * w) / 24);
    const m = new THREE.Mesh(g, boardMat);
    m.position.set(x, 0.53, z);
    m.rotation.y = ry;
    root.add(m);
  };
  addBoard(0, -8, 0, 110);
  addBoard(-27, 20, Math.PI / 2, 70);
  addBoard(27, 20, -Math.PI / 2, 70);

  // 조명탑
  const towers = new Batch();
  const towerMat = std({ color: 0x2a3555, roughness: 0.6 });
  for (const [x, z] of [[-52, -22], [52, -22], [-52, 66], [52, 66]]) {
    towers.add(towerMat, new THREE.CylinderGeometry(0.6, 1, 44, 8), mat4(x, 22, z), 0xffffff);
    towers.add(towerMat, new THREE.BoxGeometry(11, 5, 0.7), mat4(x, 45, z, 0, Math.atan2(-x, 20 - z), 0), 0xffffff);
    const lamp = glow(0xffffff, 26, 0.95);
    lamp.position.set(x * 0.985, 45, z < 0 ? z + 1 : z - 1);
    root.add(lamp);
    for (let k = -1; k <= 1; k += 2) {
      const spot = glow(0xdce9ff, 11, 0.9);
      spot.position.set(x + k * 3.4, 45, z < 0 ? z + 1.1 : z - 1.1);
      root.add(spot);
    }
  }
  towers.build(root, { cast: false, receive: false });

  // 관중 플래시 (골 때 번쩍번쩍)
  const flashN = 160;
  const fp = new Float32Array(flashN * 3);
  const fc = new Float32Array(flashN * 4);
  for (let i = 0; i < flashN; i += 1) {
    const p = people[Math.floor(r() * people.length)];
    fp.set([p.x, p.y + 0.9, p.z + 0.2], i * 3);
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
  fg.setAttribute("color", new THREE.BufferAttribute(fc, 4));
  const flashes = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, fog: false, blending: THREE.AdditiveBlending }));
  flashes.frustumCulled = false;
  root.add(flashes);

  let cheer = 0.08;
  let cheerTarget = 0.08;
  let boardMsg = 0;
  return {
    setCheer(v) {
      cheerTarget = v;
    },
    tick(dt, time) {
      uT.value = time;
      cheer += (cheerTarget - cheer) * Math.min(1, dt * 3);
      uJump.value = cheer;
      boardTex.offset.x = (time * 0.06) % 1;
      const k = Math.max(0, cheer - 0.2) / 0.5;
      for (let i = 0; i < flashN; i += 1) {
        const on = Math.random() < 0.012 + k * 0.1;
        fc.set([1.6, 1.6, 1.6, on ? 1 : Math.max(0, fc[i * 4 + 3] - dt * 7)], i * 4);
      }
      fg.attributes.color.needsUpdate = true;
      boardMsg += dt;
    },
  };
}

/* ---------- 골대 ---------- */
export function buildGoal(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const { hw, h, postR, depth } = GOAL;
  const mat = std({ color: 0xffffff, roughness: 0.35, emissive: 0x333333 });
  const b = new Batch();
  const seg = 16;
  b.add(mat, new THREE.CylinderGeometry(postR, postR, h + postR, seg), mat4(-hw, (h + postR) / 2, 0), 0xffffff);
  b.add(mat, new THREE.CylinderGeometry(postR, postR, h + postR, seg), mat4(hw, (h + postR) / 2, 0), 0xffffff);
  b.add(mat, new THREE.CylinderGeometry(postR, postR, hw * 2 + postR * 2, seg), mat4(0, h, 0, 0, 0, Math.PI / 2), 0xffffff);
  // 뒤 지지대
  const strut = std({ color: 0xcfd5de, roughness: 0.5 });
  for (const sx of [-1, 1]) {
    const len = Math.hypot(depth, h);
    b.add(strut, new THREE.CylinderGeometry(0.03, 0.03, len, 8), mat4(sx * hw, h / 2, -depth / 2, Math.atan2(depth, h), 0, 0), 0xffffff);
    b.add(strut, new THREE.CylinderGeometry(0.03, 0.03, depth, 8), mat4(sx * hw, 0.03, -depth / 2, Math.PI / 2, 0, 0), 0xffffff);
  }
  b.add(strut, new THREE.CylinderGeometry(0.03, 0.03, hw * 2, 8), mat4(0, 0.03, -depth, 0, 0, Math.PI / 2), 0xffffff);
  b.build(root, { cast: true, receive: false });
  return root;
}

/* ---------- 그물: 실제로 흔들리는 천 ---------- */
export class Net {
  constructor(scene) {
    const { hw, h, depth } = GOAL;
    const NX = 34;
    const NY = 13;
    const NR = 5;
    const NS = 6;
    const nodes = [];
    const links = [];
    const index = new Map();
    const add = (key, x, y, z, pin) => {
      if (index.has(key)) return index.get(key);
      const id = nodes.length;
      nodes.push({ x, y, z, px: x, py: y, pz: z, pin, hx: x, hy: y, hz: z });
      index.set(key, id);
      return id;
    };
    // 뒷면: 위쪽은 앞으로 조금 기울어짐
    const topZ = -depth * 0.52;
    const backPoint = (i, jj) => {
      const v = jj / NY;
      return [-hw + (i / NX) * hw * 2, h - 0.04 - v * (h - 0.04), topZ + (-depth - topZ) * v];
    };
    for (let i = 0; i <= NX; i += 1) {
      for (let jj = 0; jj <= NY; jj += 1) {
        const p = backPoint(i, jj);
        add(`b${i}:${jj}`, p[0], p[1], p[2], jj === NY);
      }
    }
    const link = (a, b) => {
      const A = nodes[a];
      const B = nodes[b];
      links.push([a, b, Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z)]);
    };
    for (let i = 0; i <= NX; i += 1) {
      for (let jj = 0; jj <= NY; jj += 1) {
        if (i < NX) link(index.get(`b${i}:${jj}`), index.get(`b${i + 1}:${jj}`));
        if (jj < NY) link(index.get(`b${i}:${jj}`), index.get(`b${i}:${jj + 1}`));
      }
    }
    // 지붕: 크로스바에서 뒷면 위까지
    for (let i = 0; i <= NX; i += 1) {
      let last = null;
      for (let k = 0; k <= NR; k += 1) {
        const v = k / NR;
        const p = backPoint(i, 0);
        const id = k === NR ? index.get(`b${i}:0`) : add(`r${i}:${k}`, p[0], h - 0.04 * v, topZ * v, k === 0);
        if (last != null) link(last, id);
        if (k < NR && i > 0) link(index.get(`r${i - 1}:${k}`), id);
        last = id;
      }
    }
    // 옆면
    for (const [side, colI] of [["L", 0], ["R", NX]]) {
      for (let jj = 0; jj <= NY; jj += 1) {
        let last = null;
        for (let k = 0; k <= NS; k += 1) {
          const v = k / NS;
          const bp = backPoint(colI, jj);
          const yy = h - 0.04 - (jj / NY) * (h - 0.04);
          const id = k === NS ? index.get(`b${colI}:${jj}`) : add(`s${side}${jj}:${k}`, bp[0], yy, bp[2] * v, k === 0 || jj === NY);
          if (last != null) link(last, id);
          if (k < NS && jj > 0) link(index.get(`s${side}${jj - 1}:${k}`), id);
          last = id;
        }
      }
    }
    this.nodes = nodes;
    this.links = links;
    const pos = new Float32Array(links.length * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.pos = pos;
    this.geo = g;
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.5), transparent: true, opacity: 0.62, depthWrite: false }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.active = 2;
    this.write();
  }
  write() {
    const { nodes, links, pos } = this;
    for (let i = 0; i < links.length; i += 1) {
      const a = nodes[links[i][0]];
      const b = nodes[links[i][1]];
      const k = i * 6;
      pos[k] = a.x;
      pos[k + 1] = a.y;
      pos[k + 2] = a.z;
      pos[k + 3] = b.x;
      pos[k + 4] = b.y;
      pos[k + 5] = b.z;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  poke(x, y, z, r, push) {
    this.active = 3;
    const r2 = r * r;
    for (const n of this.nodes) {
      if (n.pin) continue;
      const dx = n.x - x;
      const dy = n.y - y;
      const dz = n.z - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r2) {
        const d = Math.sqrt(d2) || 1e-3;
        const k = (r - d) / d;
        n.x += dx * k;
        n.y += dy * k;
        n.z += dz * k + push;
      }
    }
  }
  tick(dt, ball) {
    if (ball && ball.z < 0.6 && Math.abs(ball.x) < GOAL.hw + 0.5 && ball.y < GOAL.h + 0.5) this.poke(ball.x, ball.y, ball.z, BALL_R + 0.09, 0);
    if (this.active <= 0) return;
    this.active -= dt;
    const h = Math.min(dt, 1 / 40);
    const damp = 0.965;
    for (const n of this.nodes) {
      if (n.pin) continue;
      const vx = (n.x - n.px) * damp;
      const vy = (n.y - n.py) * damp;
      const vz = (n.z - n.pz) * damp;
      n.px = n.x;
      n.py = n.y;
      n.pz = n.z;
      n.x += vx + (n.hx - n.x) * 3.2 * h;
      n.y += vy + (n.hy - n.y) * 3.2 * h - 0.5 * h * h;
      n.z += vz + (n.hz - n.z) * 3.2 * h;
      if (n.y < 0.02) n.y = 0.02;
    }
    for (let it = 0; it < 2; it += 1) {
      for (const [a, b, len] of this.links) {
        const A = this.nodes[a];
        const B = this.nodes[b];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dz = B.z - A.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4;
        if (d <= len * 1.25) continue; // 그물은 늘어나지 않고 처지기만 함
        const k = (d - len * 1.25) / d;
        const wa = A.pin ? 0 : B.pin ? 1 : 0.5;
        const wb = B.pin ? 0 : A.pin ? 1 : 0.5;
        A.x += dx * k * wa;
        A.y += dy * k * wa;
        A.z += dz * k * wa;
        B.x -= dx * k * wb;
        B.y -= dy * k * wb;
        B.z -= dz * k * wb;
      }
    }
    this.write();
  }
}
