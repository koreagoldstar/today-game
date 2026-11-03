/*
 * 3D 무대: 렌더러 · 하늘 · 지형 · 길 · 바다 · 눈 · 풍경.
 *  월드마다 바탕 지형과 풍경이 완전히 다르다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { rng, clamp, lerp, smooth, TAU } from "./course.js";
import { toyMat, roundBox } from "./penguin.js";
import { ball, lathe, mesh, makeHouse, iceMat } from "./toys.js";

export const LOOK = {
  village: { top: 0x2f8fe3, hor: 0xc4e9fc, low: 0xeaf6ff, sunCol: 0xfff0d6, sun: 2.75, sky: 0xcfeaff, gnd: 0x9fb8dc, hemi: 0.42, env: 0.42, fog: 0xcfeafa, near: 48, far: 210, snow: 0.4, exposure: 0.98, wallA: 0xe4f1fb, wallB: 0x8cb6de, mtn: [0xa9cdec, 0x7fb0dd], cloud: 0.55 },
  canyon: { top: 0x2467c0, hor: 0xa6dcf6, low: 0xc4e6f7, sunCol: 0xfff4e3, sun: 2.6, sky: 0xbfe2ff, gnd: 0x6d90c6, hemi: 0.42, env: 0.45, fog: 0xa9d6f0, near: 40, far: 170, snow: 0.25, exposure: 0.98, wallA: 0x9fd0ee, wallB: 0x2f5f94, mtn: [0x88b4dc, 0x5e93c8], cloud: 0.35 },
  sea: { top: 0x1f8fe0, hor: 0xc9f1ff, low: 0xe8fbff, sunCol: 0xfff3dc, sun: 2.8, sky: 0xcdeeff, gnd: 0x7ab4d8, hemi: 0.45, env: 0.5, fog: 0xc6eefa, near: 55, far: 240, snow: 0.08, exposure: 0.98, wallA: 0xd4f2ff, wallB: 0x3e9ed4, mtn: [0xb4dff2, 0x8ccbe8], cloud: 0.5 },
  peaks: { top: 0x5a7da8, hor: 0xc9d9e8, low: 0xdde7f0, sunCol: 0xffe6c8, sun: 2.1, sky: 0xb7cbe0, gnd: 0x76889f, hemi: 0.5, env: 0.42, fog: 0xc0d0e0, near: 36, far: 145, snow: 1, exposure: 1, wallA: 0xdbe6f0, wallB: 0x5f708a, mtn: [0xa7b9cd, 0x8299b5], cloud: 0.75 },
  aurora: { top: 0x070a2c, hor: 0x2c2a78, low: 0x3e3191, sunCol: 0xbcd0ff, sun: 1.5, sky: 0x6a5cff, gnd: 0x271f66, hemi: 0.72, env: 0.62, fog: 0x1d1a5c, near: 44, far: 185, snow: 0.3, exposure: 1.12, wallA: 0xb9a6ff, wallB: 0x2f2680, mtn: [0x2d2a78, 0x1f1c5c], cloud: 0, night: true },
};

const SKY_VS = "varying vec3 vP;void main(){vP=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}";
const SKY_FS = `
varying vec3 vP;
uniform vec3 top,hor,low,sunDir,sunCol;
uniform float time,cloud,night;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n2(p);p*=2.03;a*=.5;}return s;}
void main(){
  vec3 d=normalize(vP);
  float h=d.y;
  vec3 c=mix(hor,top,pow(clamp(h,0.,1.),.62));
  c=mix(c,low,smoothstep(.12,-.1,h));
  float s=max(dot(d,sunDir),0.);
  c+=sunCol*(pow(s,420.)*2.2+pow(s,24.)*.28+pow(s,4.)*.09);
  if(cloud>0.01&&h>-.02){
    vec2 uv=d.xz/(h+.22)*1.15+vec2(time*.012,0.);
    float f=fbm(uv);
    float m=smoothstep(.56-cloud*.16,.86,f)*smoothstep(0.,.2,h);
    vec3 cc=mix(vec3(.86,.92,1.),vec3(1.),smoothstep(.55,.9,f));
    c=mix(c,cc,m*.92);
  }
  if(night>.5){
    vec2 g=floor(d.xz/(abs(h)+.35)*120.);
    float st=step(.994,h21(g))*smoothstep(0.,.12,h);
    c+=vec3(st)*(.6+.4*sin(time*2.+h21(g+3.)*40.));
    // 오로라 커튼
    float y=clamp(h,0.,1.);
    float x=atan(d.x,d.z);
    float w=sin(x*3.+time*.15+sin(x*7.+time*.3)*.9);
    float band=smoothstep(.06,.0,abs(y-.38-w*.12))+.55*smoothstep(.1,.0,abs(y-.52+w*.08));
    float curtain=(.55+.45*sin(x*38.+time*.8+w*6.))*(.7+.3*sin(x*90.-time));
    vec3 ac=mix(vec3(.15,1.,.65),vec3(.6,.25,1.),smoothstep(.3,.62,y+w*.05));
    c+=ac*band*curtain*.95;
    float up=smoothstep(.3,.75,y)*smoothstep(.95,.5,y);
    c+=ac*.1*up*(.6+.4*w);
    // 달
    float m=max(dot(d,normalize(vec3(.5,.56,-.66))),0.);
    c+=vec3(.95,.97,1.)*(smoothstep(.9988,.9992,m)+pow(m,300.)*.5);
  }
  gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
}`;

function mergeParts(parts) {
  // parts: [{geo, color}] → 정점색 있는 비색인 지오메트리 하나
  const list = parts.map(({ geo, color, m }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    if (!g.attributes.normal) g.computeVertexNormals();
    return { g, c: new THREE.Color(color) };
  });
  let n = 0;
  for (const a of list) n += a.g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const a of list) {
    pos.set(a.g.attributes.position.array, o * 3);
    nor.set(a.g.attributes.normal.array, o * 3);
    for (let i = 0; i < a.g.attributes.position.count; i += 1) {
      col[(o + i) * 3] = a.c.r;
      col[(o + i) * 3 + 1] = a.c.g;
      col[(o + i) * 3 + 2] = a.c.b;
    }
    o += a.g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}
const M4 = (x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function noiseTexture(size, fn, srgb = false) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  fn(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
/** 눈 표면의 오돌토돌한 노멀맵 */
function snowNormal() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  const img = g.createImageData(S, S);
  const R = rng(5);
  const H = new Float32Array(S * S);
  for (let i = 0; i < 2600; i += 1) {
    const x = Math.floor(R() * S);
    const y = Math.floor(R() * S);
    const r = 1 + Math.floor(R() * 4);
    const a = R() * 0.5 + 0.2;
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) H[((y + dy + S) % S) * S + ((x + dx + S) % S)] += a * Math.max(0, 1 - (dx * dx + dy * dy) / (r * r));
  }
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const dx = H[y * S + ((x + 1) % S)] - H[y * S + ((x - 1 + S) % S)];
      const dy = H[((y + 1) % S) * S + x] - H[((y - 1 + S) % S) * S + x];
      const i = (y * S + x) * 4;
      const k = 1.3;
      const nx = -dx * k;
      const ny = -dy * k;
      const l = Math.hypot(nx, ny, 1);
      img.data[i] = (nx / l) * 127 + 128;
      img.data[i + 1] = (ny / l) * 127 + 128;
      img.data[i + 2] = (1 / l) * 127 + 128;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function iceDetail() {
  return noiseTexture(
    512,
    (g, S) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, S, S);
      const R = rng(9);
      // 긁힌 자국 · 금
      for (let i = 0; i < 60; i += 1) {
        g.strokeStyle = `rgba(255,255,255,${0.2 + R() * 0.3})`;
        g.lineWidth = 0.6 + R() * 1.6;
        let x = R() * S;
        let y = R() * S;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k += 1) {
          x += (R() - 0.5) * 90;
          y += (R() - 0.5) * 90;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      for (let i = 0; i < 34; i += 1) {
        g.strokeStyle = `rgba(70,140,190,${0.1 + R() * 0.2})`;
        g.lineWidth = 0.8 + R() * 1.6;
        let x = R() * S;
        let y = R() * S;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 5; k += 1) {
          x += (R() - 0.5) * 70;
          y += (R() - 0.5) * 70;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      for (let i = 0; i < 14; i += 1) {
        const x = R() * S;
        const y = R() * S;
        const r = 16 + R() * 44;
        const a = g.createRadialGradient(x, y, 1, x, y, r);
        a.addColorStop(0, "rgba(120,190,235,.26)");
        a.addColorStop(1, "rgba(120,190,235,0)");
        g.fillStyle = a;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
    true
  );
}

export class Stage3D {
  constructor(canvasEl, quality) {
    this.canvas = canvasEl;
    this.quality = quality;
    const r = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: quality !== "low", powerPreference: "high-performance", stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = quality !== "low";
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.2, 1400);
    this.time = 0;
    this.skyU = {
      top: { value: new THREE.Color() },
      hor: { value: new THREE.Color() },
      low: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunCol: { value: new THREE.Color() },
      time: { value: 0 },
      cloud: { value: 0.5 },
      night: { value: 0 },
    };
    const skyMat = new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 18), skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8899bb, 0.4);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = quality !== "low";
    const sm = quality === "high" ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 3.2;
    const sc = this.sun.shadow.camera;
    sc.near = 1;
    sc.far = 130;
    this.shadowSize = 26;
    sc.left = sc.bottom = -this.shadowSize;
    sc.right = sc.top = this.shadowSize;
    this.scene.add(this.sun, this.sun.target);
    this.sunOffset = new THREE.Vector3(-22, 42, 24);
    this.scene.fog = new THREE.Fog(0xffffff, 40, 200);
    this.baseFog = { near: 40, far: 200 };
    this.pmrem = new THREE.PMREMGenerator(r);
    this.envRT = null;
    this.envScene = new THREE.Scene();
    this.envMesh = new THREE.Mesh(
      new THREE.SphereGeometry(10, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: { a: { value: new THREE.Color() }, b: { value: new THREE.Color() }, c: { value: new THREE.Color() }, sun: { value: new THREE.Vector3() }, sunC: { value: new THREE.Color() } },
        vertexShader: "varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader: `varying vec3 p;uniform vec3 a,b,c,sun,sunC;void main(){vec3 d=normalize(p);float h=d.y;vec3 col=mix(b,a,smoothstep(0.,.8,h));col=mix(col,c,smoothstep(0.,-.5,h));float s=max(dot(d,sun),0.);col+=sunC*(pow(s,18.)*2.+pow(s,3.)*.3);float sb=smoothstep(.55,.9,dot(d,normalize(vec3(.7,.2,.7))));col+=vec3(.5)*sb;gl_FragColor=vec4(col,1.);}`,
      })
    );
    this.envScene.add(this.envMesh);
    this.snowN = snowNormal();
    this.iceTex = iceDetail();
    this.resize();
  }
  setDPR(d) {
    this.dpr = d;
    this.resize();
  }
  resize() {
    const c = this.canvas;
    const w = Math.max(1, c.clientWidth);
    const h = Math.max(1, c.clientHeight);
    const cap = this.quality === "high" ? 2 : this.quality === "mid" ? 1.5 : 1;
    const d = Math.min(this.dpr || 9, cap, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(d);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.w = w;
    this.h = h;
  }
  setLook(key) {
    const L = LOOK[key];
    this.look = L;
    this.lookKey = key;
    const U = this.skyU;
    U.top.value.set(L.top);
    U.hor.value.set(L.hor);
    U.low.value.set(L.low);
    U.sunCol.value.set(L.sunCol);
    U.cloud.value = this.quality === "low" ? 0 : L.cloud;
    U.night.value = L.night ? 1 : 0;
    const sd = this.sunOffset.clone().normalize();
    U.sunDir.value.copy(sd);
    this.sun.color.set(L.sunCol);
    this.sun.intensity = L.sun;
    this.hemi.color.set(L.sky);
    this.hemi.groundColor.set(L.gnd);
    this.hemi.intensity = L.hemi;
    this.renderer.toneMappingExposure = L.exposure;
    this.scene.fog.color.set(L.fog);
    this.baseFog.near = L.near;
    this.baseFog.far = L.far;
    this.scene.fog.near = L.near;
    this.scene.fog.far = L.far;
    // 환경맵: 하늘빛과 부드러운 반사판
    const eU = this.envMesh.material.uniforms;
    eU.a.value.set(L.top);
    eU.b.value.set(L.hor);
    eU.c.value.set(L.gnd);
    eU.sun.value.copy(sd);
    eU.sunC.value.set(L.sunCol);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0.04);
    this.scene.environment = this.envRT.texture;
    this.envIntensity = L.env;
    this.scene.traverse((o) => {
      if (o.material && o.material.isMeshStandardMaterial) {
        o.material.envMapIntensity = L.env;
        o.material.needsUpdate = true;
      }
    });
  }
  /** 그림자가 펭귄 근처만 또렷하게 */
  followShadow(x, y, z) {
    const s = this.sun;
    const q = this.shadowSize / 512;
    const gx = Math.round(x / q) * q;
    const gz = Math.round(z / q) * q;
    s.target.position.set(gx, y, gz);
    s.position.set(gx + this.sunOffset.x, y + this.sunOffset.y, gz + this.sunOffset.z);
  }
  render() {
    this.sky.position.copy(this.camera.position);
    this.skyU.time.value = this.time;
    this.renderer.render(this.scene, this.camera);
  }
}

/* ---------- 길 메시 ---------- */
function buildRibbons(course, stage, q) {
  const G = new THREE.Group();
  const L = LOOK[course.world.key];
  const P = course.P;
  const N = q === "low" ? 6 : 10;
  const wallA = new THREE.Color(L.wallA);
  const wallB = new THREE.Color(L.wallB);
  const snowC = new THREE.Color(course.world.key === "aurora" ? 0xeef0ff : 0xfafdff);
  const iceC = new THREE.Color(course.world.key === "aurora" ? 0x8fb6ff : 0x7fd2f4);
  const deepC = new THREE.Color(0xffffff);
  const tmp = new THREE.Color();
  // 이어진 구간마다 하나
  let i = 0;
  const depth = course.world.key === "village" ? 3.2 : course.world.sea ? 5 : 16;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, normalMap: stage.snowN, normalScale: new THREE.Vector2(0.55, 0.55) });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.iceMap = { value: stage.iceTex };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aIce;\nvarying float vIce;\nvarying vec2 vW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvIce=aIce;vW=uv;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D iceMap;\nvarying float vIce;\nvarying vec2 vW;")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.16,vIce);")
      .replace("#include <map_fragment>", "#include <map_fragment>\nif(vIce>.01){vec3 ic=texture2D(iceMap,vW*.42).rgb;diffuseColor.rgb*=mix(vec3(1.),ic,vIce);}");
  };
  while (i < P.length) {
    if (!P[i].solid) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < P.length && P[j + 1].solid) j += 1;
    const n = j - i + 1;
    const rows = 2 * 6 + N + 1;
    const pos = new Float32Array(n * rows * 3);
    const col = new Float32Array(n * rows * 3);
    const uv = new Float32Array(n * rows * 2);
    const ice = new Float32Array(n * rows);
    for (let k = 0; k < n; k += 1) {
      const s = P[i + k];
      // 양 끝은 둥글게 줄임
      const endK = Math.min(k, n - 1 - k);
      const round = clamp(endK / 2, 0, 1);
      const capW = lerp(0.2, 1, Math.sqrt(round));
      const hw = s.hw * capW;
      const lipY = -0.5 * (1 - round);
      const bankH = (side) => {
        // 둑 높이: 주변 표본으로 부드럽게
        let v = 0;
        let c = 0;
        for (let d = -3; d <= 3; d += 1) {
          const t = P[clamp(i + k + d, i, j)];
          v += (side < 0 ? t.bankL : t.bankR) ? 1 : 0;
          c += 1;
        }
        return v / c;
      };
      const bL = bankH(-1);
      const bR = bankH(1);
      const profile = [];
      const push = (lat, y, kind) => profile.push([lat, y, kind]);
      push(-hw - 0.56, -depth, 3);
      push(-hw - 0.56, -0.7, 2);
      push(-hw - 0.5 - bL * 0.25, -0.2 + bL * 0.28, 2);
      push(-hw - 0.34 - bL * 0.2, 0.02 + bL * 0.62, 1);
      push(-hw - 0.12, 0.02 + bL * 0.55, 1);
      push(-hw + 0.12, 0.0 + bL * 0.14, 1);
      for (let a = 0; a <= N; a += 1) push(-hw + 0.12 + ((2 * hw - 0.24) * a) / N, 0, 0);
      push(hw - 0.12 + 0.24, 0.0 + bR * 0.14, 1);
      push(hw + 0.12, 0.02 + bR * 0.55, 1);
      push(hw + 0.34 + bR * 0.2, 0.02 + bR * 0.62, 1);
      push(hw + 0.5 + bR * 0.25, -0.2 + bR * 0.28, 2);
      push(hw + 0.56, -0.7, 2);
      push(hw + 0.56, -depth, 3);
      for (let a = 0; a < rows; a += 1) {
        const [lat, dy, kind] = profile[a];
        const x = s.x + s.rx * lat;
        const y = s.y + dy + lipY * (kind === 0 || kind === 1 ? 1 : 0);
        const z = s.z + s.rz * lat;
        const o = (k * rows + a) * 3;
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = z;
        const o2 = (k * rows + a) * 2;
        uv[o2] = x * 0.28;
        uv[o2 + 1] = z * 0.28;
        let surf = s.surf;
        if (s.patch && lat >= s.patch.lat0 && lat <= s.patch.lat1) surf = s.patch.surf;
        const isIce = kind === 0 && surf === "ice" ? 1 : 0;
        if (kind === 0) tmp.copy(surf === "ice" ? iceC : surf === "deep" ? deepC : snowC);
        else if (kind === 1) tmp.copy(snowC);
        else if (kind === 2) tmp.copy(wallA);
        else tmp.copy(wallB);
        if (kind === 0) {
          const edge = clamp(Math.min(lat + hw, hw - lat) / 1.2, 0, 1);
          const shade = lerp(0.9, 1, edge);
          tmp.multiplyScalar(shade);
        }
        col[o] = tmp.r;
        col[o + 1] = tmp.g;
        col[o + 2] = tmp.b;
        ice[k * rows + a] = isIce;
      }
    }
    const idx = [];
    for (let k = 0; k < n - 1; k += 1) {
      for (let a = 0; a < rows - 1; a += 1) {
        const p0 = k * rows + a;
        const p1 = p0 + 1;
        const p2 = p0 + rows;
        const p3 = p2 + 1;
        idx.push(p0, p1, p2, p1, p3, p2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("aIce", new THREE.BufferAttribute(ice, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.castShadow = q === "high";
    m.frustumCulled = true;
    G.add(m);
    i = j + 1;
  }
  return G;
}

/* ---------- 넓은 지형 ---------- */
function buildTerrain(course, q) {
  const key = course.world.key;
  if (key === "sea" || key === "aurora") return null;
  const P = course.P;
  const L = LOOK[key];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of P) {
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minZ = Math.min(minZ, s.z);
    maxZ = Math.max(maxZ, s.z);
  }
  const pad = key === "canyon" ? 60 : 80;
  minX -= pad;
  maxX += pad;
  minZ -= pad;
  maxZ += pad;
  const cell = q === "low" ? 4.2 : q === "mid" ? 3.1 : 2.3;
  const nx = Math.min(190, Math.ceil((maxX - minX) / cell));
  const nz = Math.min(190, Math.ceil((maxZ - minZ) / cell));
  const dx = (maxX - minX) / nx;
  const dz = (maxZ - minZ) / nz;
  const n = (nx + 1) * (nz + 1);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const R = rng(course.stageIndex * 7 + course.worldIndex * 31 + 3);
  // 값 노이즈
  const G = 64;
  const vals = new Float32Array(G * G);
  for (let i = 0; i < vals.length; i += 1) vals[i] = R();
  const v2 = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const w = fy * fy * (3 - 2 * fy);
    const at = (a, b) => vals[((b & 63) << 6) | (a & 63)];
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), w);
  };
  const fbm = (x, y) => v2(x, y) * 0.55 + v2(x * 2.1, y * 2.1) * 0.3 + v2(x * 4.3, y * 4.3) * 0.15;
  const snow = new THREE.Color(0xf6fbff);
  const blue = new THREE.Color(L.wallA);
  const deep = new THREE.Color(L.wallB);
  const c = new THREE.Color();
  const sparse = P.filter((_, i) => i % 3 === 0);
  let v = 0;
  const hA = new Float32Array(n);
  for (let iz = 0; iz <= nz; iz += 1) {
    for (let ix = 0; ix <= nx; ix += 1) {
      const x = minX + ix * dx;
      const z = minZ + iz * dz;
      let best = sparse[0];
      let bd = Infinity;
      for (let k = 0; k < sparse.length; k += 1) {
        const s = sparse[k];
        const a = x - s.x;
        const b = z - s.z;
        const d = a * a + b * b;
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      const dist = Math.sqrt(bd);
      const lat = (x - best.x) * best.rx + (z - best.z) * best.rz;
      const edge = dist - best.hw;
      let y;
      const nv = fbm(x * 0.022, z * 0.022);
      if (key === "village") {
        const hills = smooth(clamp((edge - 4) / 26, 0, 1));
        y = best.y - 1.05 + smooth(clamp((edge - 0.3) / 5, 0, 1)) * 1.3 + hills * (2 + nv * 14) + (fbm(x * 0.1, z * 0.1) - 0.5) * 0.7 * smooth(clamp(edge / 5, 0, 1));
      } else if (key === "canyon") {
        const wall = smooth(clamp((edge - 9) / 16, 0, 1));
        y = best.y - 26 + wall * (32 + nv * 34) + (fbm(x * 0.09, z * 0.09) - 0.5) * 6 * wall;
      } else {
        // 산맥: 왼쪽은 산비탈, 오른쪽은 깊은 골짜기
        const side = lat < 0 ? 1 : 0;
        const up = smooth(clamp((edge - 0.6) / 8, 0, 1));
        const down = smooth(clamp((edge - 2) / 14, 0, 1));
        y = side ? best.y - 1 + up * (9 + nv * 26) + (fbm(x * 0.08, z * 0.08) - 0.5) * 5 * up : best.y - 2 - down * (26 + nv * 10) + smooth(clamp((edge - 26) / 30, 0, 1)) * (34 + nv * 30);
      }
      hA[v] = y;
      pos[v * 3] = x;
      pos[v * 3 + 1] = y;
      pos[v * 3 + 2] = z;
      v += 1;
    }
  }
  const idx = [];
  for (let iz = 0; iz < nz; iz += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const a = iz * (nx + 1) + ix;
      const b = a + 1;
      const d = a + nx + 1;
      const e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // 경사와 높이로 색칠
  const nor = g.attributes.normal;
  for (let i = 0; i < n; i += 1) {
    const ny = nor.getY(i);
    const steep = smooth(clamp((0.86 - ny) / 0.4, 0, 1));
    c.copy(snow);
    const depthK = key === "village" ? 0 : smooth(clamp((course.minY - 6 - hA[i]) / 22, 0, 1));
    c.lerp(blue, steep * (key === "village" ? 0.32 : 0.9));
    c.lerp(deep, depthK * 0.95);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }));
  m.receiveShadow = q !== "low";
  m.userData.heightAt = (x, z) => {
    const ix = clamp(Math.round((x - minX) / dx), 0, nx);
    const iz = clamp(Math.round((z - minZ) / dz), 0, nz);
    return hA[iz * (nx + 1) + ix];
  };
  return m;
}

/* ---------- 풍경 조각 ---------- */
export const treeGeo = (() => {
  let g = null;
  return () => {
    if (g) return g;
    const parts = [];
    parts.push({ geo: new THREE.CylinderGeometry(0.2, 0.3, 1.3, 7), color: 0x7a5230, m: M4(0, 0.6, 0) });
    const layers = [
      [0, 1.1, 1.75, 1.7, 0x2f8d68],
      [0, 2.05, 1.38, 1.5, 0x37a076],
      [0, 2.9, 1.0, 1.35, 0x43b284],
    ];
    for (const [x, y, r, h, col] of layers) {
      parts.push({ geo: new THREE.ConeGeometry(r, h, 9, 1), color: col, m: M4(x, y + h / 2, 0) });
      parts.push({ geo: new THREE.SphereGeometry(r * 0.62, 9, 6), color: 0xffffff, m: M4(x, y + h * 0.66, 0, 1.03, 0.68, 1.03) });
    }
    parts.push({ geo: new THREE.SphereGeometry(0.28, 8, 6), color: 0xffffff, m: M4(0, 4.34, 0, 1, 1.15, 1) });
    g = mergeParts(parts);
    return g;
  };
})();
const rockGeo = () => {
  const a = new THREE.IcosahedronGeometry(1, 1);
  const p = a.attributes.position;
  const R = rng(3);
  const seen = new Map();
  for (let i = 0; i < p.count; i += 1) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(k)) seen.set(k, 0.82 + R() * 0.36);
    const v = seen.get(k);
    p.setXYZ(i, p.getX(i) * v, p.getY(i) * v, p.getZ(i) * v);
  }
  a.computeVertexNormals();
  return a;
};
const crystalGeo = () => {
  const parts = [];
  const pieces = [
    [0, 0, 0, 0.5, 2.6, 0, 0],
    [0.46, 0, 0.1, 0.32, 1.6, 0, -0.36],
    [-0.42, 0, -0.1, 0.34, 1.8, 0, 0.32],
    [0.05, 0, 0.42, 0.24, 1.2, 0.35, 0],
  ];
  for (const [x, y, z, r, h, rx, rz] of pieces) {
    const g = new THREE.ConeGeometry(r, h * 0.35, 6);
    g.translate(0, h * 0.5 + h * 0.175, 0);
    const b = new THREE.CylinderGeometry(r, r * 0.8, h, 6);
    parts.push({ geo: b, color: 0xffffff, m: M4(x, y + h / 2, z, 1, 1, 1, 0, rx, rz) });
    parts.push({ geo: g, color: 0xffffff, m: M4(x, y + h / 2, z, 1, 1, 1, 0, rx, rz) });
  }
  return mergeParts(parts);
};
const lampGeo = (() => {
  let g = null;
  return () => {
    if (g) return g;
    g = mergeParts([
      { geo: new THREE.CylinderGeometry(0.07, 0.1, 2.9, 8), color: 0x3b4660, m: M4(0, 1.45, 0) },
      { geo: new THREE.SphereGeometry(0.28, 12, 8), color: 0xffe9a8, m: M4(0, 3.05, 0) },
      { geo: new THREE.SphereGeometry(0.38, 12, 6), color: 0xffffff, m: M4(0, 3.32, 0, 1, 0.45, 1) },
    ]);
    return g;
  };
})();
const fenceGeo = (() => {
  let g = null;
  return () => {
    if (g) return g;
    g = mergeParts([
      { geo: new THREE.CylinderGeometry(0.07, 0.09, 1, 6), color: 0x8a5e36, m: M4(-1, 0.5, 0) },
      { geo: new THREE.CylinderGeometry(0.07, 0.09, 1, 6), color: 0x8a5e36, m: M4(1, 0.5, 0) },
      { geo: new THREE.BoxGeometry(2.2, 0.12, 0.06), color: 0x9d6e42, m: M4(0, 0.74, 0) },
      { geo: new THREE.BoxGeometry(2.2, 0.12, 0.06), color: 0x9d6e42, m: M4(0, 0.42, 0) },
      { geo: new THREE.SphereGeometry(0.17, 7, 5), color: 0xffffff, m: M4(-1, 1.02, 0) },
      { geo: new THREE.SphereGeometry(0.17, 7, 5), color: 0xffffff, m: M4(1, 1.02, 0) },
    ]);
    return g;
  };
})();
const iglooGeo = (() => {
  let g = null;
  return () => {
    if (g) return g;
    const dome = new THREE.SphereGeometry(1.7, 14, 8, 0, TAU, 0, Math.PI / 2);
    const door = new THREE.CylinderGeometry(0.7, 0.8, 1.2, 10, 1, false, 0, Math.PI);
    door.rotateX(Math.PI / 2);
    g = mergeParts([
      { geo: dome, color: 0xeaf6ff },
      { geo: new THREE.SphereGeometry(0.72, 10, 6, 0, TAU, 0, Math.PI / 2), color: 0xddeefa, m: M4(0, 0, 1.55, 1, 1, 1.05) },
      { geo: new THREE.CircleGeometry(0.46, 10), color: 0x264a78, m: M4(0, 0.36, 2.28) },
    ]);
    void door;
    return g;
  };
})();

function scatter(course, q, terrain) {
  const G = new THREE.Group();
  const key = course.world.key;
  const P = course.P;
  const R = rng(course.worldIndex * 101 + course.stageIndex * 17 + 9);
  const density = q === "low" ? 0.45 : q === "mid" ? 0.75 : 1;
  const tooClose = (x, z, margin) => {
    for (let k = 0; k < P.length; k += 4) {
      const s = P[k];
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < s.hw + margin) return true;
    }
    return false;
  };
  const place = (count, fn) => {
    for (let n = 0; n < count; n += 1) {
      const s = P[Math.floor(R() * P.length)];
      const side = R() < 0.5 ? -1 : 1;
      fn(s, side);
    }
  };
  const inst = (geo, mat, list, cast = true) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    const d = new THREE.Object3D();
    list.forEach((a, i) => {
      d.position.set(a.x, a.y, a.z);
      d.rotation.set(a.rx || 0, a.ry || 0, a.rz || 0);
      if (a.sx) d.scale.set(a.sx, a.sy, a.sz);
      else d.scale.setScalar(a.s || 1);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      if (a.col) m.setColorAt(i, a.col);
    });
    m.castShadow = cast && q !== "low";
    m.receiveShadow = false;
    m.instanceMatrix.needsUpdate = true;
    G.add(m);
    return m;
  };
  const ht = (x, z, fallback) => (terrain ? terrain.userData.heightAt(x, z) : fallback);
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 });
  if (key === "village" || key === "peaks") {
    const trees = [];
    const lamps = [];
    const fences = [];
    place(Math.round((key === "village" ? 130 : 85) * density), (s, side) => {
      const off = s.hw + 3 + R() * R() * 44;
      if (key === "peaks" && side > 0 && off < 30) return;
      const x = s.x + s.rx * side * off + s.dx * (R() - 0.5) * 6;
      const z = s.z + s.rz * side * off + s.dz * (R() - 0.5) * 6;
      if (tooClose(x, z, 2.4)) return;
      const big = 0.85 + R() * 1.05;
      trees.push({ x, y: ht(x, z, s.y) - 0.1, z, s: big, ry: R() * TAU });
    });
    if (key === "village") {
      for (let k = 12; k < P.length - 14; k += 26) {
        const s = P[k];
        if (!s.solid) continue;
        const side = k % 52 === 12 ? -1 : 1;
        const x = s.x + s.rx * side * (s.hw + 1.4);
        const z = s.z + s.rz * side * (s.hw + 1.4);
        lamps.push({ x, y: s.y - 0.1, z });
      }
      for (let k = 6; k < P.length - 8; k += 5) {
        const s = P[k];
        if (!s.solid || k % 40 > 18) continue;
        for (const side of [-1, 1]) {
          const x = s.x + s.rx * side * (s.hw + 2.6);
          const z = s.z + s.rz * side * (s.hw + 2.6);
          if (tooClose(x, z, 1.8)) continue;
          fences.push({ x, y: ht(x, z, s.y), z, ry: s.h + Math.PI / 2 + Math.PI / 2 });
        }
      }
      // 마을 집들
      for (let k = 20; k < P.length - 30; k += 44) {
        const s = P[k];
        const side = k % 88 === 20 ? 1 : -1;
        const off = s.hw + 9 + R() * 6;
        const x = s.x + s.rx * side * off;
        const z = s.z + s.rz * side * off;
        if (tooClose(x, z, 5)) continue;
        const h = makeHouse(["village", "canyon", "sea"][k % 3], q === "high" ? "mid" : q);
        h.position.set(x, ht(x, z, s.y) - 0.15, z);
        h.rotation.y = Math.atan2(s.x - x, s.z - z);
        h.scale.setScalar(1.05);
        G.add(h);
      }
    } else {
      // 눈보라 속 가로등
      for (let k = 8; k < P.length - 10; k += 15) {
        const s = P[k];
        if (!s.solid) continue;
        const side = 1 - (k % 30 === 8 ? 2 : 0);
        lamps.push({ x: s.x + s.rx * side * (s.hw + 0.5), y: s.y - 0.1, z: s.z + s.rz * side * (s.hw + 0.5) });
      }
      const rocks = [];
      place(Math.round(40 * density), (s) => {
        const off = s.hw + 6 + R() * 26;
        const x = s.x - s.rx * off;
        const z = s.z - s.rz * off;
        if (tooClose(x, z, 3)) return;
        rocks.push({ x, y: ht(x, z, s.y), z, s: 1.4 + R() * 3.2, ry: R() * TAU, rx: R() });
      });
      inst(rockGeo(), new THREE.MeshStandardMaterial({ color: 0x6d7c92, roughness: 0.85 }), rocks);
    }
    inst(treeGeo(), vc, trees);
    inst(lampGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0xffb95e, emissiveIntensity: key === "peaks" ? 0.65 : 0.25 }), lamps);
    inst(fenceGeo(), vc, fences);
    if (key === "village") {
      const igloos = [];
      place(Math.round(5 * density), (s, side) => {
        const off = s.hw + 8 + R() * 14;
        const x = s.x + s.rx * side * off;
        const z = s.z + s.rz * side * off;
        if (tooClose(x, z, 4)) return;
        igloos.push({ x, y: ht(x, z, s.y) - 0.1, z, s: 0.9 + R() * 0.5, ry: Math.atan2(s.x - x, s.z - z) });
      });
      inst(iglooGeo(), vc, igloos);
    }
  } else if (key === "canyon") {
    const spires = [];
    const crystals = [];
    place(Math.round(70 * density), (s, side) => {
      const off = s.hw + 13 + R() * 20;
      const x = s.x + s.rx * side * off;
      const z = s.z + s.rz * side * off;
      if (tooClose(x, z, 8)) return;
      spires.push({ x, y: ht(x, z, s.y) - 2, z, sx: 2.4 + R() * 3, sy: 5 + R() * 11, sz: 2.4 + R() * 3, ry: R() * TAU });
    });
    place(Math.round(36 * density), (s, side) => {
      const off = s.hw + 0.9 + R() * 1.2;
      const x = s.x + s.rx * side * off;
      const z = s.z + s.rz * side * off;
      if (!s.solid || tooClose(x, z, 0.45)) return;
      crystals.push({ x, y: s.y - 0.5, z, s: 0.42 + R() * 0.55, ry: R() * TAU, rz: (R() - 0.5) * 0.5 });
    });
    inst(rockGeo(), new THREE.MeshStandardMaterial({ color: 0x7fb2dc, roughness: 0.42, metalness: 0.02 }), spires);
    inst(crystalGeo(), new THREE.MeshPhysicalMaterial({ color: 0xa9e6ff, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9, vertexColors: true }), crystals, false);
  } else if (key === "sea") {
    const bergs = [];
    place(Math.round(46 * density), (s, side) => {
      const off = s.hw + 16 + R() * R() * 90;
      const x = s.x + s.rx * side * off;
      const z = s.z + s.rz * side * off;
      if (tooClose(x, z, 11)) return;
      const k = 2.2 + R() * 7;
      bergs.push({ x, y: course.seaY - k * 0.14, z, sx: k * (0.9 + R() * 0.8), sy: k * (0.55 + R() * 0.7), sz: k * (0.9 + R() * 0.6), ry: R() * TAU });
    });
    inst(rockGeo(), new THREE.MeshPhysicalMaterial({ color: 0xe9f8ff, roughness: 0.5, clearcoat: 0.3 }), bergs);
    // 부표
    const buoys = [];
    for (let k = 10; k < P.length; k += 34) {
      const s = P[k];
      const side = (k / 34) % 2 > 1 ? 1 : -1;
      buoys.push({ x: s.x + s.rx * side * (s.hw + 3), y: course.seaY, z: s.z + s.rz * side * (s.hw + 3) });
    }
    const buoyG = mergeParts([
      { geo: new THREE.SphereGeometry(0.5, 10, 8), color: 0xe9463c, m: M4(0, 0.1, 0, 1, 0.8, 1) },
      { geo: new THREE.CylinderGeometry(0.1, 0.2, 1, 8), color: 0xffffff, m: M4(0, 0.8, 0) },
      { geo: new THREE.SphereGeometry(0.15, 8, 6), color: 0xffd24a, m: M4(0, 1.36, 0) },
    ]);
    inst(buoyG, vc, buoys);
  } else if (key === "aurora") {
    const crystals = [];
    const cols = [0x8fe8ff, 0xc29bff, 0x78f5c8, 0xff9be0];
    place(Math.round(50 * density), (s, side) => {
      const off = s.hw + 8 + R() * R() * 44;
      const x = s.x + s.rx * side * off;
      const z = s.z + s.rz * side * off;
      if (tooClose(x, z, 7)) return;
      const y = s.y - 13 - R() * 20;
      const big = 2 + R() * 1.6;
      crystals.push({ x, y, z, s: big, ry: R() * TAU, rz: (R() - 0.5) * 0.4, col: new THREE.Color(cols[Math.floor(R() * 4)]) });
    });
    inst(crystalGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x5a50ff, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.1 }), crystals, false);
    // 떠 있는 얼음 탑
    const towers = [];
    place(Math.round(12 * density), (s, side) => {
      const off = s.hw + 24 + R() * 46;
      const x = s.x + s.rx * side * off;
      const z = s.z + s.rz * side * off;
      if (tooClose(x, z, 14)) return;
      towers.push({ x, y: s.y - 20, z, sx: 2 + R() * 2, sy: 7 + R() * 7, sz: 2 + R() * 2, ry: R() * TAU });
    });
    const towerG = mergeParts([
      { geo: new THREE.CylinderGeometry(1, 1.15, 4, 8), color: 0xcbbcff, m: M4(0, 2, 0) },
      { geo: new THREE.ConeGeometry(1.28, 1.8, 8), color: 0x7a5cff, m: M4(0, 4.9, 0) },
      { geo: new THREE.SphereGeometry(0.2, 8, 6), color: 0xfff3a8, m: M4(0, 5.9, 0) },
    ]);
    inst(towerG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: 0x3a2fa8, emissiveIntensity: 0.5 }), towers, false);
  }
  return G;
}

/** 먼 산 고리 */
function buildMountains(course, q) {
  const key = course.world.key;
  const L = LOOK[key];
  const G = new THREE.Group();
  const P = course.P;
  const mid = P[Math.floor(P.length / 2)];
  const R0 = rng(course.worldIndex * 13 + 1);
  const ring = (radius, high, color, seed, snowy, base) => {
    const seg = q === "low" ? 72 : 144;
    const pos = [];
    const col = [];
    const idx = [];
    const R = rng(seed);
    const peaks = [];
    for (let i = 0; i < 24; i += 1) peaks.push({ a: R() * TAU, w: 0.1 + R() * 0.24, h: 0.45 + R() * 0.65 });
    const baseC = new THREE.Color(color);
    const snowC = new THREE.Color(key === "aurora" ? 0x8d84ff : 0xffffff);
    for (let i = 0; i <= seg; i += 1) {
      const a = (i / seg) * TAU;
      let h = 0.1 + Math.sin(a * 5 + seed) * 0.03;
      for (const p of peaks) {
        let d = Math.abs(a - p.a);
        if (d > Math.PI) d = TAU - d;
        h = Math.max(h, p.h * (1 - d / p.w));
      }
      h += Math.sin(a * 23 + seed) * 0.02 + Math.sin(a * 53) * 0.008;
      const x = Math.sin(a) * radius;
      const z = Math.cos(a) * radius;
      pos.push(x, base, z, x, base + h * high, z);
      col.push(baseC.r, baseC.g, baseC.b);
      const tip = snowy ? smooth(clamp((h - 0.32) / 0.22, 0, 1)) : 0;
      const t = baseC.clone().lerp(snowC, tip * 0.92);
      col.push(t.r, t.g, t.b);
      if (i < seg) {
        const v = i * 2;
        idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide, toneMapped: true }));
    m.position.set(mid.x, 0, mid.z);
    G.add(m);
  };
  const yBase = course.minY - (key === "sea" ? 2 : 16);
  const hs = key === "sea" ? 0.35 : key === "aurora" ? 0.7 : 1;
  ring(620, 210 * hs, L.mtn[0], 11, key !== "aurora", yBase);
  ring(460, 150 * hs, L.mtn[1], 23 + Math.floor(R0() * 9), key !== "aurora", yBase);
  return G;
}

/** 바다 */
function buildSea(course, q) {
  const u = { t: { value: 0 }, sun: { value: new THREE.Vector3(-0.4, 0.7, 0.5).normalize() }, fogC: { value: new THREE.Color(LOOK.sea.fog) }, cam: { value: new THREE.Vector3() } };
  const seg = q === "low" ? 1 : 60;
  const g = new THREE.PlaneGeometry(1400, 1400, seg, seg);
  g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `uniform float t;varying vec3 vW;void main(){vec3 p=position;vec4 w=modelMatrix*vec4(p,1.);w.y+=sin(w.x*.09+t*1.1)*.16+sin(w.z*.13-t*.9)*.14;vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float t;uniform vec3 sun,fogC,cam;varying vec3 vW;
    float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
    void main(){
      vec2 uv=vW.xz*.16;
      float a=n2(uv+vec2(t*.22,t*.1));float b=n2(uv*2.3-vec2(t*.3,-t*.18));float c=n2(uv*5.-vec2(-t*.4,t*.36));
      vec3 n=normalize(vec3((a-.5)*.55+(b-.5)*.32+(c-.5)*.14,1.,(b-.5)*.55+(c-.5)*.28));
      vec3 v=normalize(cam-vW);
      float fres=pow(1.-max(dot(n,v),0.),3.);
      vec3 deep=vec3(.02,.33,.56);vec3 shal=vec3(.08,.64,.82);
      vec3 col=mix(deep,shal,a*.6+.2);
      col=mix(col,vec3(.72,.92,1.),fres*.75);
      vec3 hv=normalize(sun+v);
      float sp=pow(max(dot(n,hv),0.),140.);
      col+=vec3(1.,.96,.86)*sp*1.5;
      float foam=smoothstep(.72,.82,b*.6+c*.5)*.42;
      col=mix(col,vec3(.95,.99,1.),foam);
      float d=length(cam-vW);
      col=mix(col,fogC,smoothstep(60.,420.,d));
      gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
    }`,
    toneMapped: false,
  });
  const m = new THREE.Mesh(g, mat);
  const P = course.P;
  const mid = P[Math.floor(P.length / 2)];
  m.position.set(mid.x, course.seaY, mid.z);
  m.frustumCulled = false;
  m.userData.u = u;
  return m;
}

/** 깊은 곳 (협곡 바닥 · 오로라 아래 거울 바다) */
function buildBelow(course) {
  const key = course.world.key;
  const P = course.P;
  const mid = P[Math.floor(P.length / 2)];
  if (key === "aurora") {
    const u = { t: { value: 0 }, cam: { value: new THREE.Vector3() } };
    const g = new THREE.PlaneGeometry(1600, 1600);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: "varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
      fragmentShader: `uniform float t;uniform vec3 cam;varying vec3 vW;
      float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      void main(){
        float d=length(cam-vW);
        vec2 g=floor(vW.xz*.2);
        float st=step(.985,h21(g))*(.5+.5*sin(t*2.+h21(g+1.)*30.));
        float w=sin(vW.x*.02+t*.2+sin(vW.z*.03-t*.1)*2.);
        vec3 ac=mix(vec3(.1,.8,.55),vec3(.5,.2,.9),.5+.5*w);
        vec3 c=vec3(.03,.035,.16)+ac*.14*(.5+.5*sin(vW.z*.05+t*.3))+vec3(st)*.8;
        c=mix(c,vec3(.114,.102,.361),smoothstep(60.,420.,d));
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`,
      toneMapped: false,
    });
    const m = new THREE.Mesh(g, mat);
    m.position.set(mid.x, course.minY - 34, mid.z);
    m.frustumCulled = false;
    m.userData.u = u;
    return m;
  }
  return null;
}

/** 떨어지는 눈: 카메라 주변 상자에서 무한 반복 */
export class SnowFall {
  constructor(n) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    const s = new Float32Array(n);
    const R = rng(4);
    for (let i = 0; i < n; i += 1) {
      p[i * 3] = R() * 60;
      p[i * 3 + 1] = R() * 34;
      p[i * 3 + 2] = R() * 60;
      s[i] = 0.5 + R() * R() * 1.5;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("aS", new THREE.BufferAttribute(s, 1));
    this.u = { t: { value: 0 }, cam: { value: new THREE.Vector3() }, wind: { value: new THREE.Vector2() }, size: { value: 1 }, color: { value: new THREE.Color(0xffffff) }, op: { value: 0.9 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.u,
      transparent: true,
      depthWrite: false,
      vertexShader: `attribute float aS;uniform float t,size;uniform vec3 cam;uniform vec2 wind;varying float vA;
      void main(){vec3 q=position;
        q.y-=t*(1.4+aS*.9);q.x+=wind.x+sin(t*.8+position.z)*.6;q.z+=wind.y+cos(t*.7+position.x)*.6;
        vec3 b=vec3(60.,34.,60.);
        q=mod(q-cam+b*.5,b)-b*.5+cam;
        vec4 mv=viewMatrix*vec4(q,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=size*aS*(170./max(1.,-mv.z));
        vA=smoothstep(30.,14.,-mv.z)*smoothstep(1.,4.,-mv.z);
      }`,
      fragmentShader: `varying float vA;uniform vec3 color;uniform float op;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.15,d)*vA*op;if(a<.01)discard;gl_FragColor=vec4(color,a);}`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.count = n;
    this.wx = 0;
    this.wz = 0;
  }
  update(dt, cam, density, wx, wz) {
    this.u.t.value += dt;
    this.u.cam.value.copy(cam);
    this.wx += wx * dt;
    this.wz += wz * dt;
    this.u.wind.value.set(this.wx, this.wz);
    this.points.geometry.setDrawRange(0, Math.floor(this.count * clamp(density, 0, 1)));
    this.points.visible = density > 0.01;
  }
}

/** 코스 전체의 정적인 그림 */
export function buildCourseWorld(course, stage) {
  const q = stage.quality;
  const G = new THREE.Group();
  G.add(buildRibbons(course, stage, q));
  const terrain = buildTerrain(course, q);
  if (terrain) G.add(terrain);
  if (!course.noScatter) G.add(scatter(course, q, terrain));
  G.add(buildMountains(course, q));
  let sea = null;
  let below = null;
  if (course.world.sea) {
    sea = buildSea(course, q);
    G.add(sea);
  } else {
    below = buildBelow(course);
    if (below) G.add(below);
  }
  return { group: G, sea, below, terrain };
}
void lathe;
void ball;
void mesh;
void toyMat;
void roundBox;
void iceMat;
