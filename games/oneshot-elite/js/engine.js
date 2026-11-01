/*
 * 화면 · 하늘 · 빛 · 안개 · 카메라 · 화면 효과
 *  - 하늘: 그라데이션 + 해 + 셰이더 구름(뭉게 · 그늘 · 은빛 테두리) + 먼 산 능선 두 겹
 *  - 반사: 하늘을 환경맵(PMREM)으로 구워 금속 · 유리창이 하늘을 비춤
 *  - 화면 효과: HDR 로 그린 뒤 빛 번짐(블룸) · 필름 톤 · 색 보정(어두운 곳 청록 · 밝은 곳 주황) · 비네팅 · 필름 입자 · 가장자리 색 번짐 · 야간 투시
 *  - 연기 기둥 · 비: GPU 가 움직임 (한 번 그리기)
 */
import { THREE, rng, clamp, setAniso, canvas, tex } from "./kit.js";

/** 시간 · 날씨 (월드와 미션이 고름) */
export const ATMOS = {
  day: { top: "#3f6c9e", hor: "#c3cfd4", low: "#8d9296", sun: "#ffedd2", sunI: 3.9, sunEl: 30, sunAz: -128, hemiSky: "#c9d6e2", hemiGround: "#6f665a", hemiI: 0.42, env: 0.62, fog: "#b4bfc6", fogD: 0.0023, exp: 1.0, clouds: 0.62, cloudDark: 0.6, mtn: "#7f93a6", grade: "cine" },
  morning: { top: "#3d72ad", hor: "#e6d2b6", low: "#a69584", sun: "#ffd9ac", sunI: 3.0, sunEl: 17, sunAz: 122, hemiSky: "#d6dcf0", hemiGround: "#6f6050", hemiI: 0.35, env: 0.85, fog: "#cfc4b6", fogD: 0.0019, exp: 1.05, clouds: 0.45, cloudDark: 0.3, mtn: "#8e93a3", grade: "warm" },
  golden: { top: "#344f80", hor: "#eba86c", low: "#8a6a55", sun: "#ffad62", sunI: 3.3, sunEl: 11, sunAz: -112, hemiSky: "#f2cfaa", hemiGround: "#5a4436", hemiI: 0.3, env: 0.8, fog: "#c99a74", fogD: 0.0021, exp: 1.08, clouds: 0.6, cloudDark: 0.45, mtn: "#7a6a78", grade: "warm" },
  harbor: { top: "#4b7aa3", hor: "#c9d3d9", low: "#8b979e", sun: "#fff4e4", sunI: 3.0, sunEl: 30, sunAz: 130, hemiSky: "#d4e0ea", hemiGround: "#5d666b", hemiI: 0.35, env: 0.9, fog: "#b9c6ce", fogD: 0.0017, exp: 1.0, clouds: 0.7, cloudDark: 0.4, mtn: "#8396a6", grade: "cine" },
  desert: { top: "#4f8cc6", hor: "#e6d3ae", low: "#c9ad82", sun: "#ffe9c6", sunI: 3.0, sunEl: 34, sunAz: 128, hemiSky: "#e6dcc6", hemiGround: "#8a6c46", hemiI: 0.32, env: 0.62, fog: "#cdb68e", fogD: 0.0021, exp: 0.86, clouds: 0.18, cloudDark: 0.2, mtn: "#b8a088", grade: "warm" },
  dust: { top: "#9a8662", hor: "#d6b583", low: "#c49f6c", sun: "#ffd394", sunI: 2.6, sunEl: 30, sunAz: -150, hemiSky: "#e5ca9c", hemiGround: "#8f6c45", hemiI: 0.45, env: 0.8, fog: "#cba776", fogD: 0.0058, exp: 1.0, clouds: 0, cloudDark: 0, mtn: "#c2a27a", grade: "warm", dust: true },
  night: { top: "#050a18", hor: "#1f2a4a", low: "#0c1018", sun: "#a9bcff", sunI: 1.25, sunEl: 40, sunAz: -130, hemiSky: "#3a4a78", hemiGround: "#1c1814", hemiI: 0.62, env: 0.95, fog: "#121a30", fogD: 0.0019, exp: 1.42, clouds: 0.3, cloudDark: 0.9, mtn: "#0a0f1c", grade: "night", stars: true },
  storm: { top: "#3a3f43", hor: "#7c8082", low: "#44474a", sun: "#e8e6df", sunI: 1.9, sunEl: 40, sunAz: 150, hemiSky: "#b0b4b5", hemiGround: "#3d3d3a", hemiI: 0.6, env: 0.8, fog: "#6d7273", fogD: 0.0034, exp: 1.16, clouds: 0.95, cloudDark: 0.75, mtn: "#50565a", grade: "cold", rain: true },
};

/* ---------- 하늘 셰이더 ---------- */
const NOISE_GLSL = `
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0; float a = 0.5; for(int i=0;i<OCT;i++){ s += a*vnoise(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
float h11(float x){ return fract(sin(x*127.1)*43758.5453); }
float n1(float x){ float i = floor(x); float f = fract(x); f = f*f*(3.0-2.0*f); return mix(h11(i), h11(i+1.0), f); }
float ridge(float x){ return n1(x)*0.55 + n1(x*2.3+3.1)*0.28 + n1(x*5.1+7.7)*0.12 + n1(x*11.0+1.3)*0.05; }
`;
const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FS = `
uniform vec3 top; uniform vec3 hor; uniform vec3 low; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunSize;
uniform float cover; uniform float cdark; uniform float time; uniform vec3 mtn; uniform float mtnOn; uniform float seed; uniform float stars;
varying vec3 vDir;
${NOISE_GLSL}
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h,0.0,1.0), 0.5)) : mix(hor, low, pow(clamp(-h*4.0,0.0,1.0),0.6));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  c += sunCol * (smoothstep(0.9993, 0.9997, s) * sunSize * 6.0 + pow(s, 64.0) * 0.35 + pow(s, 6.0) * 0.12);
  if (stars > 0.5 && h > 0.0) { vec2 sp = floor(d.xz / (h + 0.3) * 420.0); float st = step(0.9975, h21(sp)); c += vec3(st * 0.9 * smoothstep(0.0, 0.25, h)); }
  if (h > 0.0 && cover > 0.0) {
    vec2 p = d.xz / (h + 0.09) * 1.15 + vec2(time * 0.006, time * 0.002) + seed;
    float n = fbm(p * 0.9);
    float n2 = fbm(p * 0.9 + normalize(sunDir.xz + 1e-4) * 0.09);
    float th = 1.0 - cover;
    float dens = smoothstep(th - 0.02, th + 0.28, n);
    float lit = clamp(0.62 + (n - n2) * 6.0, 0.0, 1.0);
    vec3 cLit = mix(vec3(1.0), sunCol, 0.35) * (1.05 + pow(s, 8.0) * 1.2);
    vec3 cSh = mix(hor * 0.55, vec3(0.32, 0.36, 0.42), 0.5) * (1.0 - cdark * 0.55);
    vec3 cc = mix(cSh, cLit, lit);
    cc += sunCol * pow(s, 18.0) * (1.0 - dens) * 1.4;
    float fade = smoothstep(0.0, 0.16, h);
    c = mix(c, mix(hor, cc, 0.85), dens * fade);
  }
  if (mtnOn > 0.5) {
    float az = atan(d.x, -d.z);
    float r1 = 0.012 + ridge(az * 3.2 + seed) * 0.07;
    float r2 = 0.004 + ridge(az * 6.0 + seed * 2.1 + 4.0) * 0.04;
    vec3 far = mix(mtn, hor, 0.55);
    vec3 near = mix(mtn, hor, 0.22) * 0.92;
    if (h < r1 && h > -0.05) c = mix(far, hor, smoothstep(r1 - 0.05, r1, h) * 0.25);
    if (h < r2 && h > -0.05) c = mix(near, hor, clamp(-h * 6.0, 0.0, 0.6));
  }
  gl_FragColor = vec4(c, 1.0);
}`;

/* ---------- 화면 효과 셰이더 ---------- */
const FS_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BRIGHT_FS = `
uniform sampler2D src; uniform float thr; varying vec2 vUv;
void main(){ vec3 c = texture2D(src, vUv).rgb; float l = max(c.r, max(c.g, c.b)); float k = clamp((l - thr) / max(l, 1e-4), 0.0, 1.0); gl_FragColor = vec4(min(c * k, vec3(40.0)), 1.0); }`;
const DOWN_FS = `
uniform sampler2D src; uniform vec2 px; varying vec2 vUv;
void main(){
  vec3 a = texture2D(src, vUv + px*vec2(-1,-1)).rgb + texture2D(src, vUv + px*vec2(1,-1)).rgb + texture2D(src, vUv + px*vec2(-1,1)).rgb + texture2D(src, vUv + px*vec2(1,1)).rgb;
  vec3 b = texture2D(src, vUv + px*vec2(-2,0)).rgb + texture2D(src, vUv + px*vec2(2,0)).rgb + texture2D(src, vUv + px*vec2(0,-2)).rgb + texture2D(src, vUv + px*vec2(0,2)).rgb;
  vec3 c = texture2D(src, vUv).rgb;
  gl_FragColor = vec4(c*0.25 + a*0.125 + b*0.0625, 1.0);
}`;
const UP_FS = `
uniform sampler2D src; uniform sampler2D add; uniform vec2 px; varying vec2 vUv;
void main(){
  vec3 s = texture2D(src, vUv).rgb*4.0;
  s += (texture2D(src, vUv + px*vec2(-1,0)).rgb + texture2D(src, vUv + px*vec2(1,0)).rgb + texture2D(src, vUv + px*vec2(0,-1)).rgb + texture2D(src, vUv + px*vec2(0,1)).rgb)*2.0;
  s += texture2D(src, vUv + px*vec2(-1,-1)).rgb + texture2D(src, vUv + px*vec2(1,-1)).rgb + texture2D(src, vUv + px*vec2(-1,1)).rgb + texture2D(src, vUv + px*vec2(1,1)).rgb;
  gl_FragColor = vec4(s / 16.0 + texture2D(add, vUv).rgb, 1.0);
}`;
const COMP_FS = `
uniform sampler2D scene; uniform sampler2D bloom; uniform float bloomK; uniform float exposure; uniform float time;
uniform vec3 lift; uniform vec3 gain; uniform float sat; uniform float contrast; uniform vec3 shadowTint; uniform vec3 hiTint;
uniform float vig; uniform float grain; uniform float ca; uniform float nv; uniform vec2 sunUv; uniform float sunK; uniform float aspect; uniform float flash;
varying vec2 vUv;
vec3 aces(vec3 x){ const float a=2.51; const float b=0.03; const float c=2.43; const float d=0.59; const float e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc);
  vec3 col;
  if (ca > 0.0) {
    vec2 off = cc * r2 * ca;
    col = vec3(texture2D(scene, uv - off).r, texture2D(scene, uv).g, texture2D(scene, uv + off).b);
  } else col = texture2D(scene, uv).rgb;
  col += texture2D(bloom, uv).rgb * bloomK;
  if (sunK > 0.0) {
    vec2 sd = (uv - sunUv) * vec2(aspect, 1.0);
    float dl = length(sd);
    col += vec3(1.0, 0.86, 0.66) * (exp(-dl * 7.0) * 0.55 + exp(-abs(sd.y) * 90.0) * exp(-abs(sd.x) * 3.0) * 0.18) * sunK;
  }
  col *= exposure;
  if (nv > 0.0) {
    float l = dot(col, vec3(0.3, 0.55, 0.15));
    l = pow(l * 3.2, 0.75);
    vec3 g = vec3(0.32, 1.0, 0.42) * l;
    g += (hash(uv * 900.0 + time) - 0.5) * 0.12;
    g *= 1.0 - smoothstep(0.15, 0.55, r2) * 0.6;
    col = mix(col, g, nv);
  }
  col = aces(col);
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = col * gain + lift * (1.0 - col);
  col = mix(col, col * shadowTint * 2.0, (1.0 - smoothstep(0.0, 0.45, L)) * 0.35);
  col = mix(col, col * hiTint * 2.0, smoothstep(0.45, 1.0, L) * 0.3);
  col = (col - 0.5) * contrast + 0.5;
  L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(L), col, sat);
  col = clamp(col, 0.0, 1.0);
  col *= 1.0 - smoothstep(0.08, 0.62, r2 * (1.0 + 0.2 * aspect)) * vig;
  col += (hash(uv * vec2(1931.0, 1173.0) + fract(time * 7.13)) - 0.5) * grain;
  col = mix(col, vec3(1.0, 0.95, 0.85), flash);
  gl_FragColor = vec4(toSRGB(clamp(col, 0.0, 1.0)), 1.0);
}`;
const GRADES = {
  cine: { lift: [0.012, 0.018, 0.026], gain: [1.03, 1.0, 0.96], sat: 0.92, contrast: 1.12, sh: [0.46, 0.52, 0.56], hi: [0.54, 0.5, 0.45], vig: 0.55, bloom: 0.09, thr: 1.6 },
  warm: { lift: [0.02, 0.016, 0.02], gain: [1.05, 1.0, 0.92], sat: 0.95, contrast: 1.1, sh: [0.47, 0.5, 0.55], hi: [0.56, 0.5, 0.42], vig: 0.55, bloom: 0.11, thr: 1.5 },
  cold: { lift: [0.012, 0.015, 0.018], gain: [1.0, 1.0, 1.0], sat: 0.84, contrast: 1.13, sh: [0.48, 0.5, 0.52], hi: [0.52, 0.5, 0.48], vig: 0.56, bloom: 0.08, thr: 1.6 },
  night: { lift: [0.008, 0.012, 0.024], gain: [1.0, 1.0, 1.03], sat: 0.95, contrast: 1.08, sh: [0.46, 0.5, 0.56], hi: [0.56, 0.5, 0.42], vig: 0.52, bloom: 0.14, thr: 1.2 },
};

/* ---------- 연기 · 비 (GPU 가 움직임) ---------- */
function puffTex() {
  const c = canvas(128, 128);
  const g = c.getContext("2d");
  const r = rng(5);
  for (let i = 0; i < 26; i++) {
    const x = 34 + r() * 60;
    const y = 34 + r() * 60;
    const rad = 14 + r() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(255,255,255,0.32)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  return tex(c, { repeat: false });
}
const SMOKE_VS = `
attribute vec3 aBase; attribute vec4 aP;
uniform float time; uniform vec3 wind;
varying float vA; varying vec2 vUv; varying float vH; varying float vFog;
void main(){
  float life = fract(time * 0.035 + aP.x);
  vec3 p = aBase + vec3(0.0, life * aP.y, 0.0) + wind * pow(life, 1.4) * aP.y * 0.9;
  p.x += sin(aP.x * 40.0 + life * 5.0) * aP.z * life;
  p.z += cos(aP.x * 23.0 + life * 4.0) * aP.z * life;
  float size = aP.w * (0.35 + life * 1.8);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float a = aP.x * 6.283 + life * 0.8;
  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy;
  mv.xy += q * size;
  gl_Position = projectionMatrix * mv;
  vA = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.55, 1.0, life));
  vUv = uv; vH = life; vFog = length(mv.xyz);
}`;
const SMOKE_FS = `
uniform sampler2D map; uniform vec3 dark; uniform vec3 light; uniform vec3 fogColor; uniform float fogD; uniform float opacity;
varying float vA; varying vec2 vUv; varying float vH; varying float vFog;
void main(){
  float t = texture2D(map, vUv).a;
  vec3 c = mix(dark, light, clamp(vUv.y * 0.7 + vH * 0.5, 0.0, 1.0));
  float f = 1.0 - exp(-fogD * fogD * vFog * vFog);
  c = mix(c, fogColor, f);
  gl_FragColor = vec4(c, t * vA * opacity);
}`;
const RAIN_VS = `
attribute vec4 aP; uniform float time; uniform vec3 cam; uniform float zoomFade;
varying float vA; varying vec2 vUv;
void main(){
  vec3 box = vec3(70.0, 40.0, 70.0);
  vec3 p = aP.xyz * box;
  p.y -= time * (22.0 + aP.w * 8.0);
  p = mod(p - cam + box * 0.5, box) - box * 0.5 + cam;
  vec3 dir = normalize(vec3(0.12, -1.0, 0.05));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 mv2 = modelViewMatrix * vec4(p + dir * 0.9, 1.0);
  vec2 sd = normalize(mv2.xy - mv.xy + 1e-5);
  vec2 sn = vec2(-sd.y, sd.x);
  mv.xy += sn * position.x * 0.012 + (mv2.xy - mv.xy) * (position.y + 0.5);
  mv.z += (mv2.z - mv.z) * (position.y + 0.5);
  gl_Position = projectionMatrix * mv;
  float d = length(mv.xyz);
  vA = smoothstep(1.5, 5.0, d) * (1.0 - smoothstep(30.0, 38.0, d)) * mix(1.0, 0.25, zoomFade);
  vUv = uv;
}`;
const RAIN_FS = `varying float vA; varying vec2 vUv; void main(){ float k = 1.0 - abs(vUv.x - 0.5) * 2.0; gl_FragColor = vec4(vec3(0.78, 0.84, 0.9), k * vA * 0.38); }`;

export class Engine {
  constructor(canvasEl, { quality = "high" } = {}) {
    this.canvas = canvasEl;
    this.quality = quality;
    this.post = quality !== "low";
    const r = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: !this.post, powerPreference: "high-performance", preserveDrawingBuffer: false, stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = this.post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = quality !== "low";
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    this.renderer = r;
    setAniso(Math.min(quality === "high" ? 16 : 4, r.capabilities.getMaxAnisotropy()));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.25, 6000);
    this.camera.rotation.order = "YXZ";
    this.time = 0;
    const oct = quality === "high" ? 6 : quality === "mid" ? 5 : 4;
    this.skyU = {
      top: { value: new THREE.Color() },
      hor: { value: new THREE.Color() },
      low: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunCol: { value: new THREE.Color() },
      sunSize: { value: 1 },
      cover: { value: 0.5 },
      cdark: { value: 0.3 },
      time: { value: 0 },
      mtn: { value: new THREE.Color() },
      mtnOn: { value: 1 },
      seed: { value: 0 },
      stars: { value: 0 },
    };
    const skyMat = new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false, defines: { OCT: oct } });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), skyMat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    sky.userData.block = false;
    this.sky = sky;
    this.scene.add(sky);
    // 환경맵용 하늘 (낮은 해상도)
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VS.replace("gl_Position.z = gl_Position.w;", ""), fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, defines: { OCT: 4 } }));
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(r);
    this.envRT = null;
    // 빛
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = quality !== "low";
    const sm = quality === "high" ? 4096 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.35;
    this.sun.shadow.radius = 2.5;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.fog = new THREE.FogExp2(0xffffff, 0.002);
    this.atmos = null;
    this.nest = new THREE.Vector3();
    this.ray = new THREE.Raycaster();
    this.tmp = new THREE.Vector3();
    this.nv = 0;
    this.flash = 0;
    this.zoom = 1;
    this.vmAds = 0;
    // 앞 화면 (총 · 손) — 따로 그림
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(42, 1, 0.02, 20);
    this.vmSun = new THREE.DirectionalLight(0xffffff, 2);
    this.vmScene.add(this.vmSun);
    this.vmHemi = new THREE.HemisphereLight(0xffffff, 0x333333, 0.3);
    this.vmScene.add(this.vmHemi);
    this.vmRim = new THREE.DirectionalLight(0xffffff, 1.2);
    this.vmRim.position.set(1.4, 0.5, -1.2);
    this.vmScene.add(this.vmRim);
    this.vmVisible = true;
    // 접안렌즈에 비치는 확대 화면
    this.lensOn = quality === "high";
    if (this.lensOn) {
      this.rtLens = new THREE.WebGLRenderTarget(320, 320, { type: THREE.HalfFloatType, samples: 2 });
      this.lensCam = new THREE.PerspectiveCamera(5, 1, 1, 6000);
      this.lensCam.rotation.order = "YXZ";
      this.lensTick = 0;
    }
    // 연기 · 비
    this.fx = new THREE.Group();
    this.scene.add(this.fx);
    this.smoke = null;
    this.rain = null;
    this.setupPost();
  }

  setupPost() {
    if (!this.post) return;
    const mk = (w, h, o = {}) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, ...o });
    this.rtScene = mk(4, 4, { depthBuffer: true, samples: this.quality === "high" ? 4 : 2 });
    this.rtB = [mk(4, 4), mk(4, 4), mk(4, 4), mk(4, 4), mk(4, 4)];
    this.rtU = [mk(4, 4), mk(4, 4), mk(4, 4), mk(4, 4)];
    const tri = new THREE.BufferGeometry();
    tri.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const sm = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: FS_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
    this.mBright = sm(BRIGHT_FS, { src: { value: null }, thr: { value: 1.5 } });
    this.mDown = sm(DOWN_FS, { src: { value: null }, px: { value: new THREE.Vector2() } });
    this.mUp = sm(UP_FS, { src: { value: null }, add: { value: null }, px: { value: new THREE.Vector2() } });
    this.compU = {
      scene: { value: null },
      bloom: { value: null },
      bloomK: { value: 0.1 },
      exposure: { value: 1 },
      time: { value: 0 },
      lift: { value: new THREE.Vector3() },
      gain: { value: new THREE.Vector3(1, 1, 1) },
      sat: { value: 1 },
      contrast: { value: 1 },
      shadowTint: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      hiTint: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      vig: { value: 0.5 },
      grain: { value: 0.035 },
      ca: { value: 0.012 },
      nv: { value: 0 },
      sunUv: { value: new THREE.Vector2() },
      sunK: { value: 0 },
      aspect: { value: 1 },
      flash: { value: 0 },
    };
    this.mComp = sm(COMP_FS, this.compU);
    this.fsQuad = new THREE.Mesh(tri, this.mComp);
    this.fsQuad.frustumCulled = false;
    this.fsScene = new THREE.Scene();
    this.fsScene.add(this.fsQuad);
  }

  pass(mat, target) {
    this.fsQuad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCam);
  }

  setAtmos(key, { shadowCenter = new THREE.Vector3(0, 0, -200), shadowSize = 260, seed = 1, mountains = true, smoke = [], wind = [6, 0, -2] } = {}) {
    const a = ATMOS[key] || ATMOS.day;
    this.atmos = a;
    this.atmosKey = key;
    const U = this.skyU;
    U.top.value.set(a.top);
    U.hor.value.set(a.hor);
    U.low.value.set(a.low);
    U.sunCol.value.set(a.sun);
    U.sunSize.value = a.stars ? 0.35 : a.rain ? 0 : 1;
    U.cover.value = a.clouds;
    U.cdark.value = a.cloudDark;
    U.mtn.value.set(a.mtn);
    U.mtnOn.value = mountains ? 1 : 0;
    U.seed.value = (seed % 97) * 1.37;
    U.stars.value = a.stars ? 1 : 0;
    const el = (a.sunEl * Math.PI) / 180;
    const az = (a.sunAz * Math.PI) / 180;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    this.sunDir = dir;
    U.sunDir.value.copy(dir);
    this.hemi.color.set(a.hemiSky);
    this.hemi.groundColor.set(a.hemiGround);
    this.hemi.intensity = a.hemiI;
    this.sun.color.set(a.sun);
    this.sun.intensity = a.sunI;
    this.sun.target.position.copy(shadowCenter);
    this.sun.position.copy(shadowCenter).addScaledVector(dir, 700);
    const sc = this.sun.shadow.camera;
    sc.left = -shadowSize;
    sc.right = shadowSize;
    sc.top = shadowSize;
    sc.bottom = -shadowSize;
    sc.near = 50;
    sc.far = 1600;
    sc.updateProjectionMatrix();
    this.scene.fog.color.set(a.fog);
    this.scene.fog.density = a.fogD;
    this.renderer.toneMappingExposure = a.exp;
    // 환경맵 (하늘을 구워 반사 · 은은한 빛으로)
    U.time.value = 0;
    if (this.envRT) this.envRT.dispose();
    // 환경맵은 하늘색을 덜 진하게 (유리 · 금속 · 그늘이 파랗게 뜨지 않도록)
    const topSave = U.top.value.clone();
    U.top.value.lerp(U.hor.value, 0.55);
    this.envRT = this.pmrem.fromScene(this.envScene, 0.02);
    U.top.value.copy(topSave);
    this.scene.environment = this.envRT.texture;
    this.vmScene.environment = this.envRT.texture;
    this.scene.traverse((o) => {
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) if (m.isMeshStandardMaterial) m.envMapIntensity = a.env * (m.userData.envK ?? 1);
    });
    this.vmScene.traverse((o) => {
      if (o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = Math.max(0.5, a.env) * (o.material.userData.envK ?? 1);
    });
    // 앞 화면 빛
    this.vmSun.color.set(a.sun);
    this.vmSun.intensity = a.sunI * 0.8;
    this.vmSun.position.set(-0.8, 1.4, 0.6);
    this.vmRim.color.set(a.hor);
    this.vmRim.intensity = a.sunI * 0.5;
    this.vmHemi.color.set(a.hemiSky);
    this.vmHemi.groundColor.set(a.hemiGround);
    this.vmHemi.intensity = a.stars ? 1.5 : Math.max(0.5, a.hemiI * 2.4);
    // 색 보정
    if (this.post) {
      const G = GRADES[a.grade] || GRADES.cine;
      const C = this.compU;
      C.lift.value.set(...G.lift);
      C.gain.value.set(...G.gain);
      C.sat.value = G.sat;
      C.contrast.value = G.contrast;
      C.shadowTint.value.set(...G.sh);
      C.hiTint.value.set(...G.hi);
      C.vig.value = G.vig;
      C.bloomK.value = this.quality === "high" ? G.bloom : G.bloom * 0.8;
      this.mBright.uniforms.thr.value = G.thr;
      C.exposure.value = a.exp;
      C.grain.value = a.stars ? 0.012 : this.quality === "high" ? 0.02 : 0.014;
    }
    this.setSmoke(smoke, wind);
    this.setRain(!!a.rain);
  }

  /** 연기 기둥: [{x, y, z, h(높이), s(굵기)}] */
  setSmoke(list, wind) {
    if (this.smoke) {
      this.fx.remove(this.smoke);
      this.smoke.geometry.dispose();
      this.smoke = null;
    }
    if (!list || !list.length) return;
    const per = this.quality === "low" ? 18 : 34;
    const n = list.length * per;
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.setAttribute("position", base.attributes.position);
    g.setAttribute("uv", base.attributes.uv);
    const B = new Float32Array(n * 3);
    const P = new Float32Array(n * 4);
    const r = rng(41);
    list.forEach((s, k) => {
      for (let i = 0; i < per; i++) {
        const j = k * per + i;
        B.set([s.x + (r() - 0.5) * s.s * 0.4, s.y, s.z + (r() - 0.5) * s.s * 0.4], j * 3);
        P.set([i / per + r() * 0.02, s.h, s.s * 0.8, s.s * (0.9 + r() * 0.5)], j * 4);
      }
    });
    g.setAttribute("aBase", new THREE.InstancedBufferAttribute(B, 3));
    g.setAttribute("aP", new THREE.InstancedBufferAttribute(P, 4));
    g.instanceCount = n;
    const a = this.atmos;
    const night = !!a.stars;
    const m = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VS,
      fragmentShader: SMOKE_FS,
      transparent: true,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
        wind: { value: new THREE.Vector3(...wind).normalize() },
        map: { value: puffTex() },
        dark: { value: new THREE.Color(night ? "#07080b" : "#3a3c40") },
        light: { value: new THREE.Color(night ? "#22252c" : "#8d8f92").lerp(new THREE.Color(a.sun), 0.12) },
        fogColor: { value: new THREE.Color(a.fog) },
        fogD: { value: a.fogD * 0.8 },
        opacity: { value: night ? 0.75 : 0.85 },
      },
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.userData.block = false;
    mesh.renderOrder = 2;
    this.smoke = mesh;
    this.fx.add(mesh);
  }

  setRain(on) {
    if (this.rain) {
      this.fx.remove(this.rain);
      this.rain.geometry.dispose();
      this.rain = null;
    }
    if (!on) return;
    const n = this.quality === "high" ? 9000 : this.quality === "mid" ? 5000 : 2500;
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.setAttribute("position", base.attributes.position);
    g.setAttribute("uv", base.attributes.uv);
    const P = new Float32Array(n * 4);
    const r = rng(9);
    for (let i = 0; i < n; i++) P.set([r() - 0.5, r() - 0.5, r() - 0.5, r()], i * 4);
    g.setAttribute("aP", new THREE.InstancedBufferAttribute(P, 4));
    g.instanceCount = n;
    const m = new THREE.ShaderMaterial({ vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, zoomFade: { value: 0 } } });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.userData.block = false;
    mesh.renderOrder = 3;
    this.rain = mesh;
    this.fx.add(mesh);
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const maxDpr = this.quality === "low" ? 1 : this.quality === "mid" ? 1.5 : 2;
    const dpr = Math.min(maxDpr, window.devicePixelRatio || 1) * (this.scale || 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = w / h;
    this.vmCamera.updateProjectionMatrix();
    if (this.post) {
      const W = Math.max(1, Math.round(w * dpr));
      const H = Math.max(1, Math.round(h * dpr));
      this.rtScene.setSize(W, H);
      let bw = Math.max(1, W >> 1);
      let bh = Math.max(1, H >> 1);
      for (let i = 0; i < this.rtB.length; i++) {
        this.rtB[i].setSize(bw, bh);
        if (i < this.rtU.length) this.rtU[i].setSize(bw, bh);
        bw = Math.max(1, bw >> 1);
        bh = Math.max(1, bh >> 1);
      }
      this.compU.aspect.value = w / h;
    }
  }

  /** 저격 위치에서 바라보기 (yaw: 왼쪽 + · pitch: 위 +) — sway 는 조준 흔들림(라디안) */
  look(yaw, pitch, fov, swayX = 0, swayY = 0) {
    const c = this.camera;
    c.position.copy(this.nest);
    c.rotation.set(pitch + swayY, yaw + swayX, 0);
    if (Math.abs(c.fov - fov) > 1e-4) {
      c.fov = fov;
      c.updateProjectionMatrix();
    }
    this.zoom = 55 / fov;
    this.sky.position.copy(c.position);
  }

  tick(dt) {
    this.time += dt;
    this.skyU.time.value = this.time;
    if (this.smoke) this.smoke.material.uniforms.time.value = this.time;
    if (this.rain) {
      const u = this.rain.material.uniforms;
      u.time.value = this.time;
      u.cam.value.copy(this.camera.position);
      u.zoomFade.value = clamp((this.zoom - 1.5) / 4, 0, 1);
    }
    this.flash = Math.max(0, this.flash - dt * 9);
  }

  render() {
    const r = this.renderer;
    this.camera.updateMatrixWorld();
    // 그림자는 몇 프레임에 한 번만 (건물은 안 움직이고, 사람 그림자는 조금 늦어도 티가 안 남)
    this.frameNo = (this.frameNo || 0) + 1;
    r.shadowMap.autoUpdate = false;
    if (this.frameNo % (this.quality === "high" ? 2 : 4) === 0) r.shadowMap.needsUpdate = true;
    if (!this.post) {
      r.setRenderTarget(null);
      r.clear();
      r.render(this.scene, this.camera);
      if (this.vmVisible) {
        r.clearDepth();
        r.render(this.vmScene, this.vmCamera);
      }
      return;
    }
    // 렌즈 화면 (두 프레임에 한 번 · 그림자는 그대로 씀)
    if (this.lensOn && this.vmVisible && this.vmAds < 0.5 && this.lensTick++ % 2 === 0) {
      const lc = this.lensCam;
      lc.position.copy(this.camera.position);
      lc.rotation.copy(this.camera.rotation);
      lc.updateMatrixWorld();
      r.setRenderTarget(this.rtLens);
      r.clear();
      r.render(this.scene, lc);
    }
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, this.camera);
    if (this.vmVisible) {
      r.clearDepth();
      r.render(this.vmScene, this.vmCamera);
    }
    // 빛 번짐
    const B = this.rtB;
    const U = this.rtU;
    this.mBright.uniforms.src.value = this.rtScene.texture;
    this.pass(this.mBright, B[0]);
    for (let i = 1; i < B.length; i++) {
      this.mDown.uniforms.src.value = B[i - 1].texture;
      this.mDown.uniforms.px.value.set(1 / B[i - 1].width, 1 / B[i - 1].height);
      this.pass(this.mDown, B[i]);
    }
    let src = B[B.length - 1];
    for (let i = B.length - 2; i >= 0; i--) {
      this.mUp.uniforms.src.value = src.texture;
      this.mUp.uniforms.add.value = B[i].texture;
      this.mUp.uniforms.px.value.set(1 / src.width, 1 / src.height);
      this.pass(this.mUp, U[i]);
      src = U[i];
    }
    const C = this.compU;
    C.time.value = this.time;
    C.nv.value = this.nv;
    C.flash.value = this.flash;
    C.ca.value = this.zoom > 1.5 ? 0.02 : 0.01;
    if (this.sunDir && !this.atmos.stars && !this.atmos.rain) {
      const p = this.tmp.copy(this.camera.position).addScaledVector(this.sunDir, 1000).project(this.camera);
      const inFront = p.z < 1;
      C.sunUv.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
      const edge = Math.max(Math.abs(p.x), Math.abs(p.y));
      C.sunK.value = inFront ? clamp(1.4 - edge, 0, 1) * 0.9 : 0;
    } else C.sunK.value = 0;
    C.scene.value = this.rtScene.texture;
    C.bloom.value = U[0].texture;
    this.pass(this.mComp, null);
  }

  /** 화면 가운데(조준점)에서 쏜 광선이 처음 맞는 것 */
  pickCenter(objects, nx = 0, ny = 0) {
    this.ray.setFromCamera({ x: nx, y: ny }, this.camera);
    this.ray.far = 3000;
    const hits = this.ray.intersectObjects(objects, true);
    for (const h of hits) {
      let o = h.object;
      let ok = true;
      for (let p = o; p; p = p.parent) {
        if (p.userData && p.userData.block === false && !p.userData.hitbox) {
          ok = false;
          break;
        }
        if (!p.visible) {
          ok = false;
          break;
        }
      }
      if (ok) return h;
    }
    return null;
  }

  dispose() {
    this.renderer.dispose();
  }
}

export { clamp };
