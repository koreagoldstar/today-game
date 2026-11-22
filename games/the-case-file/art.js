/* 오늘의 사건파일 — 그림 엔진 (모든 그림을 SVG 코드로 그림: 파일 0개 · 어느 화면에서도 선명)
 *  CFArt.scene(sceneData)      사건 현장 (800×500)
 *  CFArt.prop(kind)            조사 지점 확대 그림 (100×100)
 *  CFArt.portrait(look, mood)  용의자 초상 (200×240)
 *  CFArt.doc(spec)             증거 문서 · CCTV · 기록표 · 쪽지 · 영수증 · 메신저 · 약도
 *  아트 방향: 어두운 남색 · 차콜 · 짙은 갈색 바탕에 따뜻한 스탠드 빛, 금색 · 짙은 빨강 포인트, 납작한 느와르 일러스트
 */
(() => {
  "use strict";
  const C = {
    navy: "#101a2c", navy2: "#18243a", char: "#1d1f25", brown: "#3b2a20", wood: "#5a3d2b", wood2: "#7a5639",
    gold: "#c9a35a", gold2: "#e7c886", red: "#8e1f2a", red2: "#b8323f", paper: "#efe6d2", paper2: "#d9cdb2",
    ink: "#2a2420", glass: "#9fb6c8", lamp: "#ffd892", steel: "#8a96a3", steel2: "#5b6673", green: "#2f5d50",
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let uid = 0;
  const id = (p) => `${p}${++uid}`;

  /* ---------------- 소품 (100×100 좌표) ---------------- */
  const P = {
    door: () => `<rect x="22" y="6" width="56" height="92" rx="2" fill="${C.wood}"/><rect x="28" y="12" width="44" height="34" fill="${C.wood2}" opacity=".55"/><rect x="28" y="52" width="44" height="40" fill="${C.wood2}" opacity=".55"/><circle cx="70" cy="56" r="3.2" fill="${C.gold}"/><rect x="80" y="44" width="9" height="16" rx="2" fill="${C.char}"/><rect x="82" y="47" width="5" height="3" fill="#59d38b"/>`,
    window: () => `<rect x="10" y="8" width="80" height="78" fill="#0a1220"/><g fill="#1f3350">${[12, 24, 38, 52, 66, 78].map((x, i) => `<rect x="${x}" y="${40 - (i % 3) * 9}" width="10" height="${46 + (i % 3) * 9}"/>`).join("")}</g><g fill="${C.lamp}" opacity=".75">${[14, 27, 41, 55, 69, 81].map((x, i) => `<rect x="${x}" y="${50 + (i % 2) * 8}" width="2" height="2"/><rect x="${x + 4}" y="${60 - (i % 3) * 4}" width="2" height="2"/>`).join("")}</g><circle cx="75" cy="20" r="6" fill="#e9e2c4" opacity=".8"/><rect x="8" y="6" width="84" height="82" fill="none" stroke="${C.wood}" stroke-width="4"/><line x1="50" y1="8" x2="50" y2="86" stroke="${C.wood}" stroke-width="3"/>`,
    clock: () => `<circle cx="50" cy="50" r="38" fill="${C.wood}"/><circle cx="50" cy="50" r="32" fill="${C.paper}"/>${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<line x1="${50 + Math.sin(a) * 27}" y1="${50 - Math.cos(a) * 27}" x2="${50 + Math.sin(a) * 30}" y2="${50 - Math.cos(a) * 30}" stroke="${C.ink}" stroke-width="2"/>`; }).join("")}<line x1="50" y1="50" x2="50" y2="28" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/><line x1="50" y1="50" x2="66" y2="58" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round"/><circle cx="50" cy="50" r="2.5" fill="${C.red}"/>`,
    desk: () => `<rect x="4" y="44" width="92" height="8" fill="${C.wood2}"/><rect x="8" y="52" width="30" height="40" fill="${C.wood}"/><rect x="12" y="58" width="22" height="10" fill="${C.wood2}" opacity=".6"/><circle cx="23" cy="63" r="1.6" fill="${C.gold}"/><rect x="12" y="72" width="22" height="10" fill="${C.wood2}" opacity=".6"/><rect x="86" y="52" width="6" height="40" fill="${C.wood}"/><rect x="50" y="34" width="26" height="10" fill="${C.paper}" transform="rotate(-6 63 39)"/>`,
    chair: () => `<rect x="30" y="20" width="40" height="38" rx="6" fill="${C.red}"/><rect x="26" y="56" width="48" height="10" rx="3" fill="${C.red2}"/><rect x="32" y="66" width="4" height="26" fill="${C.char}"/><rect x="64" y="66" width="4" height="26" fill="${C.char}"/>`,
    bed: () => `<rect x="4" y="30" width="20" height="58" rx="3" fill="${C.wood}"/><rect x="18" y="52" width="78" height="26" rx="4" fill="#e6dccb"/><rect x="18" y="62" width="78" height="16" fill="#7d2633"/><rect x="22" y="44" width="22" height="12" rx="5" fill="#f3ecdf"/><rect x="18" y="78" width="78" height="8" fill="${C.wood}"/>`,
    sofa: () => `<rect x="6" y="40" width="88" height="34" rx="10" fill="#4a2a2e"/><rect x="12" y="52" width="76" height="20" rx="6" fill="#5e3338"/><rect x="2" y="50" width="14" height="30" rx="6" fill="#4a2a2e"/><rect x="84" y="50" width="14" height="30" rx="6" fill="#4a2a2e"/><rect x="12" y="80" width="5" height="8" fill="${C.char}"/><rect x="83" y="80" width="5" height="8" fill="${C.char}"/>`,
    lamp: () => `<polygon points="34,20 66,20 74,46 26,46" fill="${C.lamp}"/><polygon points="34,20 66,20 74,46 26,46" fill="#fff" opacity=".2"/><rect x="48" y="46" width="4" height="40" fill="${C.gold}"/><rect x="36" y="86" width="28" height="6" rx="2" fill="${C.gold}"/>`,
    plant: () => `<path d="M50 70 C30 50 20 40 22 22 C36 30 46 44 50 62 C54 40 62 26 78 20 C80 40 68 54 50 70Z" fill="${C.green}"/><path d="M50 70 C42 52 40 36 48 16 C58 34 56 52 50 70Z" fill="#3d7a66"/><rect x="36" y="68" width="28" height="24" rx="3" fill="${C.brown}"/>`,
    shelf: () => `<rect x="10" y="4" width="80" height="92" fill="${C.wood}"/>${[8, 36, 64].map((y) => `<rect x="14" y="${y + 24}" width="72" height="3" fill="${C.wood2}"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${16 + i * 8.6}" y="${y + 6 + (i % 3) * 2}" width="7" height="${18 - (i % 3) * 2}" fill="${["#7d2633", "#2f4a6b", "#c9a35a", "#3d5b4f", "#6b4a8a", "#a8573b"][i % 6]}"/>`).join("")}`).join("")}`,
    safe: () => `<rect x="16" y="14" width="68" height="74" rx="4" fill="${C.steel2}"/><rect x="22" y="20" width="56" height="62" rx="3" fill="${C.steel}"/><circle cx="50" cy="51" r="14" fill="${C.char}"/><circle cx="50" cy="51" r="10" fill="${C.steel2}"/>${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<line x1="${50 + Math.sin(a) * 10}" y1="${51 - Math.cos(a) * 10}" x2="${50 + Math.sin(a) * 13}" y2="${51 - Math.cos(a) * 13}" stroke="${C.paper}" stroke-width="1"/>`; }).join("")}<rect x="68" y="44" width="5" height="14" rx="2" fill="${C.gold}"/>`,
    briefcase: () => `<rect x="38" y="22" width="24" height="10" rx="4" fill="none" stroke="${C.brown}" stroke-width="5"/><rect x="10" y="30" width="80" height="56" rx="5" fill="#4b3322"/><rect x="10" y="50" width="80" height="4" fill="#2e1f15"/><rect x="26" y="46" width="8" height="12" rx="1" fill="${C.gold}"/><rect x="66" y="46" width="8" height="12" rx="1" fill="${C.gold}"/>`,
    cup: () => `<ellipse cx="50" cy="84" rx="30" ry="7" fill="${C.paper2}"/><path d="M28 40 L72 40 L66 82 L34 82Z" fill="${C.paper}"/><ellipse cx="50" cy="40" rx="22" ry="5" fill="#4a2f22"/><path d="M72 48 C86 48 86 70 70 70" fill="none" stroke="${C.paper}" stroke-width="5"/><path d="M40 46 C42 50 46 50 48 47" stroke="${C.red2}" stroke-width="2.4" fill="none"/>`,
    wine: () => `<path d="M34 12 L66 12 C68 40 60 52 50 54 C40 52 32 40 34 12Z" fill="${C.glass}" opacity=".5"/><path d="M36 30 L64 30 C63 44 58 50 50 51 C42 50 37 44 36 30Z" fill="#6d1020"/><rect x="48" y="54" width="4" height="30" fill="${C.glass}" opacity=".7"/><ellipse cx="50" cy="86" rx="18" ry="4" fill="${C.glass}" opacity=".7"/>`,
    phone: () => `<rect x="30" y="8" width="40" height="84" rx="7" fill="${C.char}"/><rect x="34" y="16" width="32" height="64" rx="2" fill="#20344f"/><rect x="38" y="24" width="24" height="4" fill="${C.paper}" opacity=".7"/><rect x="38" y="32" width="18" height="3" fill="${C.paper}" opacity=".5"/><rect x="38" y="40" width="22" height="3" fill="${C.paper}" opacity=".5"/><circle cx="50" cy="86" r="2.5" fill="${C.steel}"/>`,
    laptop: () => `<rect x="18" y="20" width="64" height="44" rx="3" fill="${C.char}"/><rect x="22" y="24" width="56" height="36" fill="#21406a"/><rect x="26" y="28" width="30" height="3" fill="${C.paper}" opacity=".6"/><rect x="26" y="34" width="44" height="3" fill="${C.paper}" opacity=".4"/><rect x="26" y="40" width="38" height="3" fill="${C.paper}" opacity=".4"/><polygon points="10,66 90,66 96,76 4,76" fill="${C.steel}"/>`,
    monitor: () => `<rect x="10" y="14" width="80" height="52" rx="3" fill="${C.char}"/><rect x="14" y="18" width="72" height="44" fill="#16324f"/><rect x="18" y="22" width="40" height="4" fill="#7fd6ff" opacity=".7"/>${[30, 36, 42, 48].map((y, i) => `<rect x="18" y="${y}" width="${60 - i * 9}" height="3" fill="${C.paper}" opacity=".45"/>`).join("")}<rect x="44" y="66" width="12" height="14" fill="${C.char}"/><rect x="30" y="80" width="40" height="5" rx="2" fill="${C.char}"/>`,
    cctv: () => `<rect x="20" y="14" width="10" height="14" fill="${C.steel2}"/><g transform="rotate(18 50 40)"><rect x="22" y="28" width="58" height="22" rx="4" fill="${C.paper2}"/><rect x="76" y="31" width="10" height="16" rx="3" fill="${C.char}"/><circle cx="82" cy="39" r="4" fill="#1d4f7a"/><circle cx="30" cy="34" r="2" fill="${C.red2}"/></g>`,
    printer: () => `<rect x="14" y="38" width="72" height="36" rx="4" fill="#d8d6cf"/><rect x="24" y="22" width="52" height="18" fill="${C.paper}"/><rect x="22" y="74" width="56" height="12" fill="#b9b6ad"/><rect x="28" y="64" width="44" height="18" fill="${C.paper}"/><rect x="66" y="44" width="12" height="6" rx="1" fill="#3b7d5b"/><circle cx="24" cy="47" r="2" fill="#59d38b"/>`,
    papers: () => `<rect x="20" y="22" width="56" height="70" fill="${C.paper2}" transform="rotate(-8 48 57)"/><rect x="24" y="16" width="56" height="70" fill="${C.paper}" transform="rotate(4 52 51)"/>${[28, 36, 44, 52, 60].map((y) => `<rect x="32" y="${y}" width="${36 - (y % 3) * 4}" height="2.4" fill="${C.ink}" opacity=".45" transform="rotate(4 52 51)"/>`).join("")}<circle cx="66" cy="72" r="7" fill="none" stroke="${C.red}" stroke-width="2" transform="rotate(4 52 51)"/>`,
    memo: () => `<rect x="22" y="18" width="58" height="62" fill="#f2df8a" transform="rotate(-5 51 49)"/><rect x="40" y="14" width="22" height="8" fill="#e8d7b0" opacity=".8" transform="rotate(-5 51 49)"/><path d="M30 38 q10 -4 20 0 t20 0 M30 50 q8 -3 16 0 t24 0 M30 62 q12 -4 24 0" stroke="${C.ink}" stroke-width="2" fill="none" opacity=".7" transform="rotate(-5 51 49)"/>`,
    mirror: () => `<rect x="18" y="4" width="64" height="92" rx="30" fill="${C.gold}"/><rect x="23" y="9" width="54" height="82" rx="26" fill="#6f8799"/><path d="M34 20 L46 14 L30 60Z" fill="#fff" opacity=".18"/><rect x="18" y="88" width="64" height="4" fill="${C.char}" opacity=".6"/>`,
    vitrine: () => `<rect x="18" y="66" width="64" height="28" fill="${C.char}"/><rect x="20" y="20" width="60" height="46" fill="${C.glass}" opacity=".25" stroke="${C.steel}" stroke-width="2"/><rect x="40" y="48" width="20" height="18" fill="${C.wood2}"/><path d="M26 26 L36 22 L26 54Z" fill="#fff" opacity=".2"/><rect x="45" y="80" width="10" height="6" rx="1" fill="${C.gold}"/>`,
    drawer: () => `<rect x="12" y="20" width="76" height="70" fill="${C.wood}"/>${[26, 48, 70].map((y) => `<rect x="18" y="${y}" width="64" height="18" fill="${C.wood2}"/><rect x="44" y="${y + 7}" width="12" height="3" rx="1" fill="${C.gold}"/>`).join("")}<rect x="16" y="20" width="68" height="6" fill="${C.brown}"/>`,
    dresser: () => `<ellipse cx="50" cy="26" rx="22" ry="20" fill="${C.gold}"/><ellipse cx="50" cy="26" rx="18" ry="16" fill="#6f8799"/><rect x="14" y="46" width="72" height="44" fill="${C.wood}"/><rect x="20" y="52" width="60" height="16" fill="${C.wood2}"/><rect x="20" y="70" width="60" height="16" fill="${C.wood2}"/><circle cx="50" cy="60" r="2" fill="${C.gold}"/><circle cx="50" cy="78" r="2" fill="${C.gold}"/><rect x="62" y="40" width="12" height="7" rx="2" fill="#2b3f7a"/>`,
    camera: () => `<rect x="14" y="34" width="72" height="46" rx="6" fill="${C.char}"/><rect x="24" y="26" width="20" height="10" rx="2" fill="${C.char}"/><circle cx="54" cy="57" r="17" fill="#3a3f47"/><circle cx="54" cy="57" r="11" fill="#14253a"/><circle cx="50" cy="53" r="3" fill="#fff" opacity=".35"/><rect x="72" y="40" width="8" height="5" fill="${C.red2}"/>`,
    bag: () => `<path d="M30 40 C30 20 70 20 70 40" fill="none" stroke="${C.brown}" stroke-width="5"/><rect x="14" y="38" width="72" height="50" rx="10" fill="#6b3f2a"/><rect x="14" y="54" width="72" height="5" fill="#4a2b1d"/><rect x="45" y="52" width="10" height="9" rx="2" fill="${C.gold}"/>`,
    car: () => `<path d="M8 62 L18 44 Q22 38 30 38 L66 38 Q74 38 80 46 L92 62 L92 76 L8 76Z" fill="#2b3442"/><path d="M24 46 L32 42 L48 42 L48 54 L20 54Z" fill="${C.glass}" opacity=".55"/><path d="M52 42 L66 42 L76 54 L52 54Z" fill="${C.glass}" opacity=".55"/><circle cx="26" cy="76" r="9" fill="${C.char}"/><circle cx="74" cy="76" r="9" fill="${C.char}"/><circle cx="26" cy="76" r="4" fill="${C.steel}"/><circle cx="74" cy="76" r="4" fill="${C.steel}"/><rect x="86" y="62" width="6" height="5" fill="${C.lamp}"/>`,
    gate: () => `<rect x="10" y="40" width="22" height="50" rx="3" fill="${C.steel2}"/><rect x="68" y="40" width="22" height="50" rx="3" fill="${C.steel2}"/><rect x="14" y="46" width="14" height="10" rx="2" fill="#59d38b" opacity=".8"/><rect x="32" y="58" width="36" height="5" rx="2" fill="${C.red2}"/><rect x="72" y="46" width="14" height="10" rx="2" fill="#1d4f7a"/>`,
    train: () => `<rect x="4" y="22" width="92" height="56" rx="10" fill="#c9cdd2"/><rect x="4" y="60" width="92" height="8" fill="${C.red}"/>${[12, 36, 60].map((x) => `<rect x="${x}" y="30" width="18" height="20" rx="2" fill="#20344f"/>`).join("")}<rect x="82" y="30" width="10" height="34" fill="#9aa2ab"/><circle cx="22" cy="82" r="5" fill="${C.char}"/><circle cx="78" cy="82" r="5" fill="${C.char}"/>`,
    streetlight: () => `<rect x="47" y="20" width="6" height="76" fill="${C.char}"/><path d="M50 22 Q50 10 66 10 L76 10" fill="none" stroke="${C.char}" stroke-width="5"/><polygon points="66,12 86,12 82,20 70,20" fill="#ff9d2e"/><polygon points="70,20 82,20 98,70 54,70" fill="#ff9d2e" opacity=".18"/>`,
    sign: () => `<rect x="6" y="26" width="88" height="40" rx="4" fill="${C.char}"/><rect x="10" y="30" width="80" height="32" rx="3" fill="#f4f7fb"/><rect x="18" y="38" width="64" height="5" fill="#9fb3c8"/><rect x="26" y="48" width="48" height="5" fill="#9fb3c8"/>`,
    alarm: () => `<rect x="24" y="12" width="52" height="76" rx="5" fill="#e4e1d8"/><rect x="30" y="18" width="40" height="16" rx="2" fill="#163246"/><rect x="34" y="23" width="22" height="5" fill="#59d38b" opacity=".85"/>${[0, 1, 2].map((r) => [0, 1, 2].map((c) => `<rect x="${32 + c * 13}" y="${40 + r * 13}" width="10" height="9" rx="2" fill="${C.steel}"/>`).join("")).join("")}<circle cx="66" cy="80" r="3" fill="${C.red2}"/>`,
    vent: () => `<rect x="12" y="24" width="76" height="52" rx="3" fill="${C.steel}"/>${[30, 38, 46, 54, 62].map((y) => `<rect x="16" y="${y}" width="68" height="4" fill="${C.steel2}"/>`).join("")}<circle cx="16" cy="28" r="1.8" fill="${C.char}"/><circle cx="84" cy="28" r="1.8" fill="${C.char}"/><circle cx="16" cy="72" r="1.8" fill="${C.char}"/><circle cx="84" cy="72" r="1.8" fill="${C.char}"/>`,
    reader: () => `<rect x="34" y="16" width="32" height="64" rx="5" fill="${C.char}"/><rect x="40" y="24" width="20" height="14" rx="2" fill="#163246"/><rect x="43" y="28" width="14" height="4" fill="#59d38b"/><rect x="40" y="46" width="20" height="24" rx="3" fill="${C.steel2}"/><path d="M45 52 q5 -5 10 0 M46 57 q4 -4 8 0 M47 62 q3 -3 6 0" stroke="${C.paper}" fill="none" stroke-width="1.3"/>`,
    painting: () => `<rect x="10" y="12" width="80" height="66" fill="${C.gold}"/><rect x="16" y="18" width="68" height="54" fill="#2c3a4f"/><path d="M16 60 L36 40 L50 52 L66 34 L84 56 L84 72 L16 72Z" fill="#4c6a5a"/><circle cx="68" cy="28" r="6" fill="${C.gold2}"/>`,
    violin: () => `<rect x="20" y="10" width="60" height="84" rx="26" fill="#2a1a14"/><path d="M50 18 C36 18 34 34 40 42 C32 48 32 70 42 80 C46 84 54 84 58 80 C68 70 68 48 60 42 C66 34 64 18 50 18Z" fill="#9a4a22"/><rect x="48" y="14" width="4" height="64" fill="${C.char}"/><path d="M44 52 q-3 4 0 8 M56 52 q3 4 0 8" stroke="${C.char}" fill="none" stroke-width="1.5"/>`,
    trash: () => `<rect x="28" y="26" width="44" height="64" rx="4" fill="${C.steel2}"/><rect x="24" y="20" width="52" height="8" rx="2" fill="${C.steel}"/>${[36, 50, 64].map((x) => `<rect x="${x - 1}" y="34" width="2" height="48" fill="${C.char}" opacity=".5"/>`).join("")}<rect x="38" y="12" width="26" height="12" fill="${C.paper}" transform="rotate(-14 51 18)"/>`,
    projector: () => `<rect x="14" y="40" width="64" height="28" rx="6" fill="#dcdad3"/><circle cx="66" cy="54" r="9" fill="${C.char}"/><circle cx="66" cy="54" r="5" fill="#2a4f7a"/><polygon points="74,48 98,30 98,78 74,60" fill="${C.lamp}" opacity=".25"/><rect x="20" y="46" width="22" height="4" fill="${C.steel}"/>`,
    tablet: () => `<rect x="16" y="14" width="68" height="72" rx="6" fill="${C.char}"/><rect x="21" y="19" width="58" height="62" rx="2" fill="#203a5c"/><rect x="26" y="26" width="34" height="4" fill="${C.gold2}"/><rect x="26" y="36" width="46" height="10" rx="2" fill="${C.paper}" opacity=".8"/><rect x="26" y="50" width="40" height="10" rx="2" fill="${C.paper}" opacity=".5"/>`,
    server: () => `<rect x="20" y="6" width="60" height="90" rx="3" fill="#20242b"/>${[12, 26, 40, 54, 68, 82].map((y, i) => `<rect x="24" y="${y}" width="52" height="11" fill="#2c323b"/><circle cx="30" cy="${y + 5.5}" r="1.6" fill="${i % 2 ? "#59d38b" : "#4aa3ff"}"/><rect x="36" y="${y + 4}" width="30" height="3" fill="#3c4450"/>`).join("")}`,
    board: () => `<rect x="6" y="10" width="88" height="70" fill="#5c4532"/><rect x="10" y="14" width="80" height="62" fill="#a7835c"/>${[[18, 20], [56, 18], [30, 48], [64, 50]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="20" height="16" fill="${i % 2 ? C.paper : "#d9e2ea"}" transform="rotate(${i % 2 ? 4 : -5} ${x + 10} ${y + 8})"/><circle cx="${x + 10}" cy="${y + 1}" r="1.8" fill="${C.red2}"/>`).join("")}<path d="M28 22 L66 20 L40 50 L74 52" stroke="${C.red2}" stroke-width="1.2" fill="none"/>`,
    ticket: () => `<rect x="20" y="8" width="60" height="86" rx="5" fill="#c8ccd2"/><rect x="28" y="16" width="44" height="26" rx="2" fill="#163246"/><rect x="32" y="22" width="30" height="4" fill="#7fd6ff"/><rect x="32" y="30" width="20" height="4" fill="#7fd6ff" opacity=".6"/><rect x="32" y="52" width="36" height="6" rx="2" fill="${C.char}"/><rect x="40" y="70" width="20" height="14" rx="2" fill="${C.steel2}"/>`,
    coat: () => `<path d="M50 10 L40 16 L22 26 L18 90 L82 90 L78 26 L60 16Z" fill="#7a1f2a"/><path d="M50 16 L42 22 L50 60 L58 22Z" fill="${C.char}" opacity=".5"/><rect x="48" y="4" width="4" height="10" fill="${C.steel}"/>`,
    keybox: () => `<rect x="14" y="12" width="72" height="76" rx="3" fill="${C.wood}"/><rect x="18" y="16" width="64" height="68" fill="#2f241b"/>${[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => `<circle cx="${28 + c * 15}" cy="${26 + r * 16}" r="2" fill="${C.gold}"/><rect x="${26 + c * 15}" y="${29 + r * 16}" width="4" height="7" fill="${(r + c) % 3 ? C.steel : C.red2}"/>`).join("")).join("")}`,
    calendar: () => `<rect x="16" y="14" width="68" height="74" rx="3" fill="${C.paper}"/><rect x="16" y="14" width="68" height="16" fill="${C.red}"/>${Array.from({ length: 20 }, (_, i) => `<rect x="${21 + (i % 5) * 12.5}" y="${36 + Math.floor(i / 5) * 12}" width="9" height="8" fill="${C.paper2}"/>`).join("")}<circle cx="51" cy="52" r="7" fill="none" stroke="${C.red2}" stroke-width="2"/>`,
    fireworks: () => `<rect x="0" y="0" width="100" height="100" fill="#0b1426"/>${[[30, 34, "#ffd36b"], [70, 30, "#ff6b8a"], [50, 58, "#8ad9ff"]].map(([x, y, c]) => Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<line x1="${x}" y1="${y}" x2="${x + Math.cos(a) * 14}" y2="${y + Math.sin(a) * 14}" stroke="${c}" stroke-width="1.6"/>`; }).join("")).join("")}<rect x="0" y="84" width="100" height="16" fill="#050a14"/>`,
    stove: () => `<rect x="12" y="40" width="76" height="50" rx="3" fill="${C.steel2}"/><rect x="18" y="56" width="64" height="28" fill="${C.char}"/><circle cx="34" cy="46" r="6" fill="${C.char}"/><circle cx="66" cy="46" r="6" fill="${C.char}"/><path d="M30 30 q4 -8 0 -16 M50 30 q4 -8 0 -16 M70 30 q4 -8 0 -16" stroke="${C.paper2}" fill="none" stroke-width="2" opacity=".5"/>`,
    hanji: () => `<rect x="8" y="6" width="84" height="88" fill="${C.wood}"/><rect x="13" y="11" width="74" height="78" fill="#efe3c4"/>${[30, 50, 70].map((x) => `<rect x="${x}" y="11" width="2.4" height="78" fill="${C.wood}"/>`).join("")}${[30, 50, 70].map((y) => `<rect x="13" y="${y}" width="74" height="2.4" fill="${C.wood}"/>`).join("")}<rect x="13" y="11" width="74" height="78" fill="${C.lamp}" opacity=".16"/>`,
    easel: () => `<line x1="30" y1="96" x2="48" y2="8" stroke="${C.wood2}" stroke-width="4"/><line x1="70" y1="96" x2="52" y2="8" stroke="${C.wood2}" stroke-width="4"/><line x1="50" y1="40" x2="50" y2="96" stroke="${C.wood}" stroke-width="3"/><rect x="24" y="16" width="52" height="40" fill="${C.paper}"/><path d="M28 48 L40 32 L50 42 L60 28 L72 48Z" fill="#5f7a6a"/><rect x="22" y="56" width="56" height="4" fill="${C.wood}"/>`,
    usb: () => `<rect x="30" y="30" width="40" height="46" rx="5" fill="#c4282f"/><rect x="38" y="14" width="24" height="18" fill="${C.steel}"/><rect x="43" y="19" width="5" height="5" fill="${C.char}"/><rect x="52" y="19" width="5" height="5" fill="${C.char}"/><rect x="36" y="44" width="28" height="6" fill="#fff" opacity=".7"/>`,
    stamp: () => `<rect x="36" y="14" width="28" height="40" rx="6" fill="${C.wood2}"/><rect x="28" y="52" width="44" height="14" rx="3" fill="${C.char}"/><rect x="24" y="76" width="52" height="14" rx="2" fill="none" stroke="${C.red2}" stroke-width="3"/>`,
  };
  function prop(kind) {
    const f = P[kind] || P.papers;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true"><defs><radialGradient id="pg"><stop offset="0" stop-color="#3a3024"/><stop offset="1" stop-color="#14161b"/></radialGradient></defs><rect width="100" height="100" fill="url(#pg)"/>${f()}</svg>`;
  }

  /* ---------------- 현장 배경 테마 (800×500) ---------------- */
  const THEMES = {
    hotel: { wall: "#1c2f3d", wall2: "#243b4c", floor: "#4a2c22", trim: C.gold, light: [600, 120] },
    office: { wall: "#2b2320", wall2: "#3a2e27", floor: "#3a2a20", trim: C.wood2, light: [200, 110] },
    meeting: { wall: "#18202c", wall2: "#212c3b", floor: "#2a2e36", trim: C.steel, light: [400, 70] },
    law: { wall: "#2a2219", wall2: "#33291f", floor: "#43301f", trim: C.gold, light: [620, 120] },
    vault: { wall: "#252a30", wall2: "#2e343b", floor: "#30353c", trim: C.steel2, light: [400, 60] },
    hanok: { wall: "#3b2c1f", wall2: "#4a3726", floor: "#5a3e28", trim: C.wood2, light: [400, 100] },
    street: { wall: "#0e1626", wall2: "#151f33", floor: "#20242c", trim: "#2b3442", light: [180, 60], outdoor: true },
    station: { wall: "#141c28", wall2: "#1c2636", floor: "#3a3f47", trim: C.steel, light: [400, 50] },
    studio: { wall: "#2c2a26", wall2: "#38352f", floor: "#4b3a2a", trim: C.wood2, light: [560, 80] },
    devoffice: { wall: "#1a2130", wall2: "#212a3b", floor: "#2b2f38", trim: "#3b4a63", light: [300, 60] },
  };
  function scene(sc) {
    const t = THEMES[sc.theme] || THEMES.office;
    const g = id("sg");
    const fy = sc.floorY || 330;
    const items = (sc.items || [])
      .map((it) => `<svg x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" viewBox="0 0 100 100" preserveAspectRatio="none"${it.flip ? ` transform="translate(${it.x * 2 + it.w} 0) scale(-1 1)"` : ""}>${(P[it.p] || P.papers)()}</svg>`)
      .join("");
    const wallDeco = t.outdoor
      ? `<g fill="#0b1220">${[0, 90, 170, 260, 520, 610, 700].map((x, i) => `<rect x="${x}" y="${60 + (i % 3) * 30}" width="${70 + (i % 2) * 20}" height="${fy - 60 - (i % 3) * 30}"/>`).join("")}</g><g fill="${C.lamp}" opacity=".5">${Array.from({ length: 40 }, (_, i) => `<rect x="${(i * 97) % 760 + 10}" y="${80 + ((i * 53) % 180)}" width="5" height="7"/>`).join("")}</g>`
      : `<rect y="${fy - 70}" width="800" height="8" fill="${t.trim}" opacity=".5"/><g fill="${t.wall2}">${[60, 260, 460, 660].map((x) => `<rect x="${x}" y="40" width="120" height="${fy - 130}" rx="3"/>`).join("")}</g>`;
    return `<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="cf-scene-svg" role="img" aria-label="${esc(sc.title || "사건 현장")}"><defs><radialGradient id="${g}l" cx="${t.light[0] / 800}" cy="${t.light[1] / 500}" r=".75"><stop offset="0" stop-color="${C.lamp}" stop-opacity=".28"/><stop offset=".55" stop-color="${C.lamp}" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient><linearGradient id="${g}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.floor}"/><stop offset="1" stop-color="#0d0d10"/></linearGradient></defs><rect width="800" height="${fy}" fill="${t.wall}"/>${wallDeco}<rect y="${fy}" width="800" height="${500 - fy}" fill="url(#${g}f)"/>${t.outdoor ? `<g stroke="#c9a35a" stroke-width="3" opacity=".35">${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${i * 160 + 20}" y1="${fy + 70}" x2="${i * 160 + 110}" y2="${fy + 70}"/>`).join("")}</g>` : `<rect y="${fy}" width="800" height="5" fill="#000" opacity=".35"/>`}${items}<rect width="800" height="500" fill="url(#${g}l)"/><rect width="800" height="500" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="30"/></svg>`;
  }

  /* ---------------- 인물 초상 (200×240) ----------------
   * 미스터리 비주얼노벨풍: 잉크 선화 + 셀 명암 + 톤 다운된 회갈색 + 종이 질감, 창빛이 드는 서재 배경.
   * look: { skin 0~4, hair, hairColor, outfit, color, age, glasses, glassesShape, beard, earring, scarf, eye }
   */
  const SKIN = ["#efd3bc", "#e2bf9f", "#d1a785", "#b48663", "#8a5d41"];
  const INK = "#221a16";
  const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  /** f > 0 밝게(흰색 쪽), f < 0 어둡게 */
  function shade(h, f) {
    if (!/^#[0-9a-f]{6}$/i.test(h)) return h;
    return `#${hex2(h).map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)).toString(16).padStart(2, "0")).join("")}`;
  }
  const FEM_HAIR = new Set(["long", "bob", "bun", "pony", "wave"]);
  const HAIR = {
    short: { front: "M68 96 C64 62 82 46 101 45 C121 45 138 60 134 96 C131 82 124 72 113 67 C104 74 86 71 76 66 C71 75 69 85 68 96Z", strands: "M78 66 Q90 54 106 52 M92 64 Q104 52 122 56 M108 62 Q122 58 130 74 M74 80 Q78 68 86 62" },
    side: { front: "M66 102 C60 60 82 43 103 43 C126 43 142 62 136 102 C134 86 128 76 121 70 C104 78 86 72 76 64 C70 75 67 88 66 102Z", strands: "M76 64 Q94 50 121 54 M82 69 Q100 58 124 63 M118 55 Q131 63 135 86 M70 88 Q72 72 80 64" },
    slick: { front: "M67 92 C66 58 84 46 101 46 C120 46 136 58 135 92 C128 72 115 62 101 62 C87 62 74 71 67 92Z", strands: "M72 78 Q86 55 112 52 M78 71 Q96 55 124 58 M88 66 Q106 56 130 70 M98 63 Q114 58 132 78" },
    long: { front: "M65 106 C61 58 82 41 101 41 C122 41 142 58 137 106 C133 82 122 67 104 65 C97 73 84 73 76 71 C69 82 66 94 65 106Z", back: "M58 98 C56 54 79 36 101 36 C124 36 146 54 144 98 L150 186 C134 196 120 186 116 166 L84 166 C80 186 66 196 50 186Z", strands: "M72 86 Q79 63 100 52 M86 70 Q101 54 124 60 M127 70 Q138 88 139 112 M60 120 Q58 150 62 178 M140 120 Q144 150 140 178" },
    bob: { front: "M64 106 C59 60 82 41 101 41 C122 41 143 60 138 106 C134 85 124 70 106 67 C96 75 82 73 75 71 C67 82 65 94 64 106Z", back: "M56 102 C54 55 79 37 101 37 C124 37 148 55 146 102 L146 142 C136 147 127 142 125 134 L77 134 C74 142 65 147 55 142Z", strands: "M72 88 Q81 63 102 52 M89 65 Q106 54 128 64 M132 80 Q140 98 138 120 M62 110 Q60 126 62 138" },
    bun: { front: "M67 93 C66 58 84 46 101 46 C120 46 136 58 135 93 C128 73 115 63 101 63 C87 63 73 72 67 93Z", back: "M85 38 a17 16 0 1 1 33 0 a17 16 0 1 1 -33 0Z", strands: "M74 80 Q87 57 108 52 M82 71 Q100 55 125 62 M114 54 Q129 62 133 82 M92 30 Q101 24 110 30" },
    pony: { front: "M67 95 C64 58 84 44 101 44 C122 44 138 58 135 95 C128 73 113 63 99 63 C85 65 73 75 67 95Z", back: "M130 66 C158 76 160 134 146 158 C144 130 138 108 126 90Z", strands: "M74 82 Q87 57 108 52 M83 71 Q100 55 123 60 M138 84 Q150 110 146 140" },
    bald: { front: "M70 100 C67 90 68 82 72 76 L75 102Z M131 100 C134 90 133 82 129 76 L126 102Z", strands: "" },
    curly: { front: "", curls: [[73, 74], [86, 58], [101, 53], [116, 57], [129, 72], [68, 90], [134, 90], [93, 62], [109, 60]], strands: "" },
    wave: { front: "M64 102 C59 58 82 41 101 41 C124 41 143 58 138 102 C130 81 121 71 111 67 C103 76 88 76 79 69 C70 78 66 89 64 102Z", back: "M58 100 C54 56 79 37 101 37 C124 37 148 56 144 100 C152 132 150 164 136 184 C127 164 130 144 124 132 L77 132 C71 144 73 164 64 184 C51 164 49 132 58 100Z", strands: "M69 94 Q74 71 90 61 M87 67 Q102 57 120 63 M129 76 Q141 98 139 126 M62 124 Q58 152 66 176 M140 124 Q144 152 136 176" },
    cap: { front: "M63 88 C65 54 83 42 101 42 C120 42 137 54 139 88Z", brim: "M58 84 Q101 73 146 84 L148 94 Q101 85 56 94Z", strands: "M80 56 Q101 48 122 56" },
  };
  const OUTFIT = {
    suit: (c, d) => `<path d="M24 240 C26 196 50 180 76 174 L100 210 L124 174 C150 180 174 196 176 240Z" fill="${c}"/><path d="M85 176 L100 206 L115 176 L107 166 L93 166Z" fill="#ece7dd"/><path d="M96 180 L104 180 L107 216 L100 226 L93 216Z" fill="#5a2a30"/><path d="M96 180 L104 180 L102 188 L98 188Z" fill="#3e1c20"/><path d="M76 174 L91 204 L80 214 L93 240 M124 174 L109 204 L120 214 L107 240" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M80 214 L76 206 M120 214 L124 206" stroke="${INK}" stroke-width="1.2"/><path d="M40 206 Q47 222 44 240 M160 206 Q153 222 156 240 M60 192 Q64 200 62 208" stroke="${d}" stroke-width="1.6" fill="none"/>`,
    suitnt: (c, d) => `<path d="M24 240 C26 196 50 180 76 174 L100 214 L124 174 C150 180 174 196 176 240Z" fill="${c}"/><path d="M86 176 L100 212 L114 176 L106 166 L94 166Z" fill="#e6e0d5"/><path d="M76 174 L91 206 L82 216 L95 240 M124 174 L109 206 L118 216 L105 240" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M40 206 Q47 222 44 240 M160 206 Q153 222 156 240" stroke="${d}" stroke-width="1.6" fill="none"/>`,
    shirt: (c, d) => `<path d="M26 240 C28 198 52 182 80 176 L100 190 L120 176 C148 182 172 198 174 240Z" fill="${c}"/><path d="M80 176 L91 198 L100 190 L109 198 L120 176 L110 166 L90 166Z" fill="${shade("#e6e0d5", -0.05)}" stroke="${INK}" stroke-width="1.2"/><line x1="100" y1="192" x2="100" y2="240" stroke="${INK}" stroke-width="1.2"/><circle cx="103" cy="206" r="1.6" fill="${INK}"/><circle cx="103" cy="224" r="1.6" fill="${INK}"/><path d="M52 200 Q60 218 58 240 M148 200 Q140 218 142 240 M70 186 Q74 196 72 206" stroke="${d}" stroke-width="1.6" fill="none"/>`,
    blouse: (c, d) => `<path d="M26 240 C30 198 56 182 84 176 C91 190 109 190 116 176 C144 182 170 198 174 240Z" fill="${c}"/><path d="M84 176 C91 194 109 194 116 176" stroke="${INK}" stroke-width="1.4" fill="none"/><path d="M86 182 C93 200 107 200 114 182" stroke="${d}" stroke-width="1.2" fill="none"/><path d="M56 204 Q64 220 62 240 M144 204 Q136 220 138 240 M100 202 Q96 220 100 240" stroke="${d}" stroke-width="1.6" fill="none"/>`,
    turtle: (c, d) => `<path d="M26 240 C28 198 52 182 82 178 L118 178 C148 182 172 198 174 240Z" fill="${c}"/><rect x="82" y="156" width="36" height="26" rx="10" fill="${c}" stroke="${INK}" stroke-width="1.4"/>${[162, 168, 174].map((y) => `<path d="M84 ${y} Q100 ${y + 2} 116 ${y}" stroke="${d}" stroke-width="1.3" fill="none"/>`).join("")}<path d="M60 200 Q66 218 64 240 M140 200 Q134 218 136 240" stroke="${d}" stroke-width="1.6" fill="none"/>`,
    vest: (c, d) => `<path d="M26 240 C28 198 52 182 80 176 L100 190 L120 176 C148 182 172 198 174 240Z" fill="#e8e3d9"/><path d="M58 186 L84 176 L100 214 L100 240 L64 240Z M142 186 L116 176 L100 214 L100 240 L136 240Z" fill="${c}" stroke="${INK}" stroke-width="1.4"/><path d="M92 176 L108 176 L100 186Z" fill="${INK}"/><path d="M88 176 L100 190 L112 176" fill="none" stroke="${INK}" stroke-width="2.4"/><circle cx="96" cy="224" r="1.8" fill="#b8955a"/><circle cx="104" cy="224" r="1.8" fill="#b8955a"/>`,
    coat: (c, d) => `<path d="M22 240 C24 192 50 176 78 168 L100 216 L122 168 C150 176 176 192 178 240Z" fill="${c}"/><path d="M78 168 L64 196 L80 204 L92 232 M122 168 L136 196 L120 204 L108 232" stroke="${INK}" stroke-width="1.8" fill="none"/><path d="M64 196 L80 204 L78 190Z M136 196 L120 204 L122 190Z" fill="${d}" opacity=".7"/><path d="M90 172 L100 216 L110 172 L104 166 L96 166Z" fill="#e6e0d5"/><path d="M97 176 L103 176 L104 206 L100 212 L96 206Z" fill="#2a2e3a"/><circle cx="88" cy="234" r="2.6" fill="${INK}"/><circle cx="112" cy="234" r="2.6" fill="${INK}"/><path d="M36 204 Q44 222 40 240 M164 204 Q156 222 160 240 M52 186 Q58 198 56 212" stroke="${d}" stroke-width="1.8" fill="none"/>`,
    hoodie: (c, d) => `<path d="M24 240 C26 196 50 180 78 172 L122 172 C150 180 174 196 176 240Z" fill="${c}"/><path d="M72 172 C74 204 126 204 128 172 C120 186 80 186 72 172Z" fill="${d}" stroke="${INK}" stroke-width="1.4"/><line x1="92" y1="196" x2="89" y2="226" stroke="#d9d6cf" stroke-width="2"/><line x1="108" y1="196" x2="111" y2="226" stroke="#d9d6cf" stroke-width="2"/><path d="M72 226 H128 L124 240 H76Z" fill="${d}" opacity=".5" stroke="${INK}" stroke-width="1.2"/>`,
    apron: (c, d) => `<path d="M26 240 C28 198 52 182 80 176 L120 176 C148 182 172 198 174 240Z" fill="#e2dccf"/><path d="M68 188 L132 188 L138 240 L62 240Z" fill="${c}" stroke="${INK}" stroke-width="1.4"/><path d="M68 188 L82 172 M132 188 L118 172" stroke="${c}" stroke-width="5"/><rect x="84" y="210" width="32" height="18" rx="2" fill="${d}" opacity=".5" stroke="${INK}" stroke-width="1"/><path d="M54 202 Q60 220 58 240 M146 202 Q140 220 142 240" stroke="#000" stroke-opacity=".2" stroke-width="1.6" fill="none"/>`,
    uniform: (c, d) => `<path d="M24 240 C26 196 50 180 78 172 L100 204 L122 172 C150 180 174 196 176 240Z" fill="${c}"/><path d="M86 174 L100 204 L114 174Z" fill="#dfe3e8" stroke="${INK}" stroke-width="1.2"/><path d="M96 180 L104 180 L102 202 L98 202Z" fill="#1a2233"/><rect x="118" y="200" width="24" height="12" rx="2" fill="#b8955a" stroke="${INK}" stroke-width="1"/><circle cx="100" cy="218" r="2.2" fill="#b8955a"/><circle cx="100" cy="234" r="2.2" fill="#b8955a"/><path d="M40 180 L66 172 L64 182 L42 190Z M160 180 L134 172 L136 182 L158 190Z" fill="${d}" stroke="${INK}" stroke-width="1"/>`,
  };
  function portrait(lk = {}, mood = "calm") {
    const k = id("pt");
    const skin = SKIN[lk.skin == null ? 1 : lk.skin];
    const sk1 = shade(skin, 0.16);
    const sk2 = shade(skin, -0.14);
    const sk3 = shade(skin, -0.34);
    const hc = lk.hairColor || "#1d1714";
    const hl = shade(hc, 0.38);
    const hd = shade(hc, -0.45);
    const cl = lk.color || "#2f3a4f";
    const fem = FEM_HAIR.has(lk.hair) || !!lk.earring;
    const old = lk.age > 44;
    const H = HAIR[lk.hair] || HAIR.short;
    const outfit = `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">${(OUTFIT[lk.outfit] || OUTFIT.shirt)(`url(#${k}c)`, shade(cl, -0.45))}</g>`;
    const FACE = fem
      ? "M73 98 C71 69 85 52 100 52 C115 52 129 69 127 98 C127 114 125 128 121 140 C116 154 108 164 100 166 C92 164 84 154 79 140 C75 128 73 114 73 98Z"
      : "M72 98 C70 69 84 51 100 51 C116 51 130 69 128 98 C128 112 127 124 124 136 C120 152 111 165 100 168 C89 165 80 152 76 136 C73 124 72 112 72 98Z";
    const SHADOW = fem
      ? "M113 54 C124 62 129 80 127 98 C127 114 125 128 121 140 C116 154 108 164 100 166 C107 154 112 140 113 124 C114 110 110 100 116 88 C119 76 118 64 113 54Z"
      : "M114 53 C126 62 130 80 128 98 C128 112 127 124 124 136 C120 152 111 165 100 168 C108 156 113 140 114 124 C115 110 111 100 117 88 C120 76 119 64 114 53Z";
    // 눈 (가로로 길고 윗눈꺼풀이 또렷한 사실형)
    const lid = mood === "nervous" ? 4.2 : mood === "smile" ? 2.2 : mood === "angry" ? 2.4 : 3.2;
    const iris = lk.eye || "#4b3324";
    const eye = (cx, dir) => {
      const ox = cx + dir * 8;
      const ix = cx - dir * 7;
      const top = 112 - lid;
      const almond = `M${ix} 112.6 Q${cx - dir * 1} ${top - 1.4} ${ox} ${111 - (fem ? 1.2 : 0.4)} Q${cx} ${114.8} ${ix} 112.6Z`;
      const look = mood === "nervous" ? dir * 1.6 : 0;
      return `<path d="M${ix - dir * 1} 110 Q${cx} ${top - 6} ${ox + dir * 2} 108.5" fill="${sk3}" opacity=".12"/><clipPath id="${k}e${cx}"><path d="${almond}"/></clipPath><path d="${almond}" fill="#f2ede4"/><g clip-path="url(#${k}e${cx})"><circle cx="${cx + look}" cy="112.4" r="3.7" fill="url(#${k}i)"/><circle cx="${cx + look}" cy="112.4" r="1.6" fill="#0d0907"/><circle cx="${cx + look - 1.2}" cy="111" r=".95" fill="#fff"/><path d="M${cx - 10} ${top - 3} H${cx + 10} V${top + 2.2} Q${cx} ${top + 0.6} ${cx - 10} ${top + 2.2}Z" fill="#000" opacity=".28"/></g><path d="M${ix} 112.4 Q${cx - dir} ${top - 1.6} ${ox} ${111 - (fem ? 1.2 : 0.4)}" fill="none" stroke="${INK}" stroke-width="${fem ? 2 : 1.7}" stroke-linecap="round"/><path d="M${ix + dir * 1} ${top - 2.6} Q${cx} ${top - 5} ${ox - dir * 1} ${top - 2.8}" fill="none" stroke="${INK}" stroke-width=".8" opacity=".6"/>${fem ? `<path d="M${ox} ${110.6} l${dir * 2.6} -2 M${ox - dir * 2} ${top - 0.2} l${dir * 1.6} -2.2" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>` : ""}<path d="M${ix + dir * 1.5} 114.2 Q${cx} 116.4 ${ox - dir * 0.5} 112.8" fill="none" stroke="${sk3}" stroke-width=".9" opacity=".8"/>${old ? `<path d="M${ix + dir * 1} 117 Q${cx} 120 ${ox} 116" fill="none" stroke="${sk3}" stroke-width=".8" opacity=".7"/>` : ""}`;
    };
    // 눈썹 (붓 끝처럼 가늘어지는 모양)
    const by = mood === "angry" ? [103, 101] : mood === "nervous" ? [101, 104] : mood === "smile" ? [101.5, 101] : [102, 101];
    const brow = (cx, dir) => {
      const inner = cx - dir * 8;
      const outer = cx + dir * 10;
      const [yi, yo] = by;
      const yInner = mood === "angry" ? yi + 2 : mood === "nervous" ? yi - 2 : yi;
      const col = shade(hc, hc === "#8a8680" || hc === "#8a8682" || hc === "#6b6560" ? -0.3 : 0);
      const thick = fem ? 1.8 : 2.8;
      return `<path d="M${inner} ${yInner + thick} Q${cx} ${Math.min(yInner, yo) - 3.4} ${outer} ${yo + 0.6} Q${cx} ${Math.min(yInner, yo) - 3.4 + thick} ${inner} ${yInner + thick}Z" fill="${col}" stroke="${col}" stroke-width=".8" stroke-linejoin="round"/>`;
    };
    // 코: 콧대 빛 · 오른쪽 그늘 · 콧방울 선
    const nose = `<path d="M98 110 Q97 122 96 128" stroke="#fff" stroke-opacity=".18" stroke-width="2" fill="none"/><path d="M103 112 Q105 124 106.5 130 L101 133Z" fill="${sk3}" opacity=".35"/><path d="M94.5 132 Q97 135.5 100 134.6 Q103 135.5 105.5 132" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/><path d="M93 130 Q92 132.5 94.5 133.6 M107 130 Q108 132.5 105.5 133.6" fill="none" stroke="${INK}" stroke-width="1" opacity=".7"/>`;
    // 입
    const lip = fem ? "#a5585b" : shade(skin, -0.3);
    const mouth =
      mood === "smile"
        ? `<path d="M91 146 Q100 153 109 146 Q100 149 91 146Z" fill="#f1ece4"/><path d="M90 145.4 Q100 154 110 145.4" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/><path d="M94 151 Q100 153.4 106 151" fill="none" stroke="${lip}" stroke-width="1.6" opacity=".7"/><path d="M89 144 l-1.6 -1.6 M111 144 l1.6 -1.6" stroke="${INK}" stroke-width="1" opacity=".6"/>`
        : mood === "angry"
          ? `<path d="M91 148 Q100 144.4 109 148 Q100 146.4 91 148Z" fill="${lip}"/><path d="M90 148.4 Q100 143.6 110 148.4" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><path d="M94 151.6 Q100 153 106 151.6" fill="none" stroke="${sk3}" stroke-width="1.4" opacity=".6"/>`
          : mood === "nervous"
            ? `<path d="M92 147 Q96 145.4 100 146.6 Q104 145 108 147.6" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/><path d="M94 149.6 Q100 151.6 106 149.8" fill="none" stroke="${lip}" stroke-width="1.6" opacity=".7"/>`
            : `<path d="M91 146.6 Q95.5 144.6 100 145.8 Q104.5 144.6 109 146.6 Q100 147.4 91 146.6Z" fill="${shade(lip, -0.12)}"/><path d="M92 147 Q100 152 108 147 Q100 148.4 92 147Z" fill="${lip}" opacity=".85"/><path d="M90.5 146.6 Q100 148 109.5 146.6" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/><path d="M96 150 Q100 151 104 150" stroke="#fff" stroke-opacity=".25" stroke-width="1" fill="none"/>`;
    const chin = `<path d="M94 157 Q100 159.4 106 157" fill="none" stroke="${sk3}" stroke-width="1" opacity=".55"/>`;
    const age = old ? `<path d="M86 86 Q100 82.6 114 86 M88 91 Q100 88.4 112 91" stroke="${sk3}" stroke-width=".9" fill="none" opacity=".7"/><path d="M92 133 Q87 140 89 148 M108 133 Q113 140 111 148" stroke="${sk3}" stroke-width="1.3" fill="none" opacity=".7"/><path d="M79 112 l-3.4 -1 M79 115 l-3.6 1.2 M121 112 l3.4 -1 M121 115 l3.6 1.2" stroke="${sk3}" stroke-width=".9" opacity=".7"/>` : "";
    const beard =
      lk.beard === "full"
        ? `<path d="M72 118 C72 160 88 176 100 176 C112 176 128 160 128 118 C125 140 115 153 100 153 C85 153 75 140 72 118Z" fill="url(#${k}h)" stroke="${INK}" stroke-width="1.2"/><path d="M88 140 Q100 133 112 140 Q100 137.6 88 140Z" fill="${hc}" stroke="${INK}" stroke-width=".8"/><path d="M80 142 q4 12 9 19 M120 142 q-4 12 -9 19 M100 158 v12 M92 156 q2 8 3 14 M108 156 q-2 8 -3 14" stroke="${hl}" stroke-width=".9" opacity=".6"/>`
        : lk.beard === "stubble"
          ? `<path d="M74 124 C76 158 90 170 100 170 C110 170 124 158 126 124 C122 148 112 158 100 158 C88 158 78 148 74 124Z M90 139.6 Q100 136 110 139.6 L110 142 Q100 139 90 142Z" fill="url(#${k}st)"/>`
          : lk.beard === "mustache"
            ? `<path d="M88 141 Q94 136 100 139.6 Q106 136 112 141 Q106 140 100 141.6 Q94 140 88 141Z" fill="${hc}" stroke="${INK}" stroke-width=".8"/>`
            : "";
    const gc = lk.glasses === "gold" ? "#a8823f" : "#141419";
    const lens = (cx) => (lk.glassesShape === "round" ? `<circle cx="${cx}" cy="112.5" r="10.5"/>` : `<rect x="${cx - 12}" y="104.5" width="24" height="16" rx="4"/>`);
    const glasses = lk.glasses
      ? `<g fill="#c8d6e2" fill-opacity=".12" stroke="${gc}" stroke-width="2">${lens(88)}${lens(112)}</g><path d="M99 110.6 Q100 108.8 101 110.6" stroke="${gc}" stroke-width="2" fill="none"/><path d="M76 109 L71 107 M124 109 L129 107" stroke="${gc}" stroke-width="2"/><path d="M80 107 L86 103 M104 107 L110 103" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/>`
      : "";
    const ear = (x, flip) => `<path d="M${x} 104 C${x - flip * 9} 101 ${x - flip * 11} 124 ${x - flip * 2} 133 L${x} 128Z" fill="${flip > 0 ? skin : sk2}" stroke="${INK}" stroke-width="1.3"/><path d="M${x - flip * 2} 108 C${x - flip * 7} 110 ${x - flip * 7} 122 ${x - flip * 2.5} 127" stroke="${sk3}" stroke-width="1.2" fill="none"/>`;
    const earring = lk.earring ? `<circle cx="70" cy="135" r="2.6" fill="#c9a35a" stroke="${INK}" stroke-width=".8"/><circle cx="130" cy="135" r="2.6" fill="#a8823f" stroke="${INK}" stroke-width=".8"/>` : "";
    const scarf = lk.scarf
      ? `<g stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"><path d="M74 166 C88 182 112 182 126 166 L130 186 C112 200 88 200 70 186Z" fill="${lk.scarf}"/><path d="M104 184 L120 186 L118 234 L104 232Z" fill="${shade(lk.scarf, -0.15)}"/></g><path d="M78 176 C92 187 108 187 122 176 M106 198 H118 M106 210 H118 M106 222 H117" stroke="#000" stroke-opacity=".25" fill="none"/>`
      : "";
    const backHair = H.back ? `<path d="${H.back}" fill="url(#${k}h)" stroke="${INK}" stroke-width="1.6"/>` : "";
    let frontHair = "";
    if (lk.hair === "curly") {
      frontHair = `<g fill="url(#${k}h)" stroke="${INK}" stroke-width="1.3">${H.curls.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="12.5"/>`).join("")}</g><g fill="none" stroke="${hl}" stroke-width="1.2" opacity=".6">${H.curls.map(([x, y]) => `<path d="M${x - 6} ${y - 2} q6 -7 11 0"/>`).join("")}</g>`;
    } else if (H.front) {
      frontHair = `<clipPath id="${k}hc"><path d="${H.front}"/></clipPath><path d="${H.front}" fill="url(#${k}h)"/>${H.strands ? `<g clip-path="url(#${k}hc)" fill="none" stroke-linecap="round"><path d="${H.strands}" stroke="${hd}" stroke-width="1.6" opacity=".8"/><path d="${H.strands}" stroke="${hl}" stroke-width=".9" opacity=".5" transform="translate(1.6 1.2)"/><ellipse cx="90" cy="56" rx="16" ry="4.5" fill="#fff" opacity=".12" transform="rotate(-18 90 56)"/></g>` : ""}<path d="${H.front}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>${H.brim ? `<path d="${H.brim}" fill="${shade(hc, -0.2)}" stroke="${INK}" stroke-width="1.4"/>` : ""}`;
    }
    return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" class="cf-portrait" role="img" aria-hidden="true"><defs>
<linearGradient id="${k}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b5a5e"/><stop offset=".55" stop-color="#3a383c"/><stop offset="1" stop-color="#1f1d20"/></linearGradient>
<linearGradient id="${k}beam" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stop-color="#fff4dc" stop-opacity=".42"/><stop offset="1" stop-color="#fff4dc" stop-opacity="0"/></linearGradient>
<radialGradient id="${k}f" cx=".36" cy=".32" r=".8"><stop offset="0" stop-color="${sk1}"/><stop offset=".6" stop-color="${skin}"/><stop offset="1" stop-color="${sk2}"/></radialGradient>
<linearGradient id="${k}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sk3}"/><stop offset=".55" stop-color="${sk2}"/></linearGradient>
<linearGradient id="${k}h" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="${shade(hc, 0.16)}"/><stop offset=".5" stop-color="${hc}"/><stop offset="1" stop-color="${hd}"/></linearGradient>
<linearGradient id="${k}c" x1="0" y1="0" x2="1" y2=".25"><stop offset="0" stop-color="${shade(cl, 0.16)}"/><stop offset=".55" stop-color="${cl}"/><stop offset="1" stop-color="${shade(cl, -0.48)}"/></linearGradient>
<radialGradient id="${k}i" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="${shade(iris, 0.4)}"/><stop offset=".7" stop-color="${iris}"/><stop offset="1" stop-color="#140b06"/></radialGradient>
<pattern id="${k}st" width="2.6" height="2.6" patternUnits="userSpaceOnUse"><circle cx="1.3" cy="1.3" r=".6" fill="${hc}" opacity=".6"/></pattern>
<filter id="${k}tone" x="0" y="0" width="100%" height="100%"><feColorMatrix type="saturate" values=".62"/><feComponentTransfer><feFuncR type="linear" slope="1.02" intercept=".02"/><feFuncB type="linear" slope=".94"/></feComponentTransfer></filter>
<filter id="${k}grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${uid % 50}"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .4  0 0 0 .55 0"/></filter>
<radialGradient id="${k}vg" cx=".5" cy=".42" r=".78"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
</defs><g filter="url(#${k}tone)">
<rect width="200" height="240" fill="url(#${k}b)"/>
<g opacity=".55"><rect x="10" y="30" width="34" height="96" rx="17" fill="#8e8c86"/><path d="M27 30 V126 M10 70 H44" stroke="#3a383c" stroke-width="2.4"/><rect x="152" y="16" width="48" height="200" fill="#2c2a2c"/>${[40, 76, 112, 148, 184].map((y) => `<rect x="152" y="${y}" width="48" height="3" fill="#4a4648"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="${154 + i * 9}" y="${y - 30 + (i % 2) * 4}" width="7" height="${30 - (i % 2) * 4}" fill="${["#5a4a3e", "#3e4a52", "#56483c", "#463c44", "#4c4e44"][i]}"/>`).join("")}`).join("")}</g>
<polygon points="20,40 60,30 200,120 200,200" fill="url(#${k}beam)"/>
${backHair}${outfit}
<path d="M88 146 L112 146 L114 180 Q100 190 86 180Z" fill="url(#${k}n)" stroke="${INK}" stroke-width="1.4"/>${fem ? "" : `<path d="M98 168 Q100 172 102 168" stroke="${sk3}" stroke-width="1.2" fill="none"/>`}<path d="M90 162 L94 182 M110 162 L106 182" stroke="${sk3}" stroke-width="1" opacity=".6"/>
${scarf}${ear(72, 1)}${ear(128, -1)}
<path d="${FACE}" fill="url(#${k}f)"/><path d="${SHADOW}" fill="${sk3}" opacity=".42"/><path d="M76 100 C74 116 77 134 86 150" stroke="#fff" stroke-opacity=".16" stroke-width="2.4" fill="none"/>
<ellipse cx="82" cy="128" rx="7" ry="4" fill="#c9545f" opacity="${fem ? 0.14 : 0.05}"/><ellipse cx="118" cy="128" rx="7" ry="4" fill="#c9545f" opacity="${fem ? 0.1 : 0.04}"/>
${beard}${age}${chin}${brow(88, -1)}${brow(112, 1)}${eye(88, -1)}${eye(112, 1)}${nose}${mouth}
<path d="${FACE}" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
${glasses}${earring}${frontHair}
</g><rect width="200" height="240" filter="url(#${k}grain)" opacity=".16"/><rect width="200" height="240" fill="url(#${k}vg)"/></svg>`;
  }

  /* ---------------- 증거 문서 ---------------- */
  function wrapLines(text, n) {
    const out = [];
    let line = "";
    for (const ch of String(text)) {
      line += ch;
      if (line.length >= n && /\s/.test(ch)) {
        out.push(line.trim());
        line = "";
      }
    }
    if (line.trim()) out.push(line.trim());
    return out;
  }
  function doc(s = {}) {
    const k = id("dc");
    if (s.k === "cctv") {
      const fig = s.figure
        ? `<g transform="translate(${s.figure.x || 280} 120)"><circle cx="0" cy="0" r="16" fill="${s.figure.hair || "#1a1a1a"}"/>${s.figure.cap ? `<path d="M-18 -4 C-16 -20 16 -20 18 -4Z" fill="${s.figure.cap}"/>` : ""}<path d="M-26 22 C-24 6 24 6 26 22 L30 120 L-30 120Z" fill="${s.figure.coat || "#2a3240"}"/>${s.figure.scarf ? `<path d="M-14 14 Q0 22 14 14 L16 24 Q0 32 -16 24Z" fill="${s.figure.scarf}"/>` : ""}${s.figure.carry ? `<rect x="22" y="56" width="26" height="34" fill="${s.figure.carry}"/>` : ""}</g>`
        : "";
      return `<svg viewBox="0 0 480 300" xmlns="http://www.w3.org/2000/svg" class="cf-doc"><defs><pattern id="${k}s" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity=".25"/></pattern></defs><rect width="480" height="300" fill="#1e2a26"/><rect y="200" width="480" height="100" fill="#2a3530"/>${s.bg === "corridor" ? `<polygon points="120,0 360,0 300,200 180,200" fill="#26332e"/><rect x="40" y="40" width="40" height="160" fill="#33413b"/><rect x="400" y="40" width="40" height="160" fill="#33413b"/>` : s.bg === "platform" ? `<rect y="160" width="480" height="20" fill="#c9a35a" opacity=".5"/><rect x="300" y="60" width="180" height="100" fill="#46524d"/>` : s.bg === "parking" ? `<g stroke="#e8e8d0" stroke-width="3" opacity=".5"><line x1="60" y1="300" x2="120" y2="200"/><line x1="240" y1="300" x2="240" y2="200"/><line x1="420" y1="300" x2="360" y2="200"/></g><rect x="300" y="150" width="140" height="70" rx="12" fill="#3b4652"/>` : s.bg === "cafe" ? `<rect x="60" y="150" width="140" height="10" fill="#5a4a3a"/><rect x="300" y="150" width="140" height="10" fill="#5a4a3a"/><rect x="200" y="40" width="80" height="100" fill="#34423c"/>` : `<rect x="180" y="30" width="120" height="170" fill="#33413b"/>`}${fig}<rect width="480" height="300" fill="url(#${k}s)"/><rect width="480" height="300" fill="#7dffb0" opacity=".06"/><text x="16" y="28" fill="#e8ffe9" font-family="monospace" font-size="16">${esc(s.cam || "CAM")}</text><text x="464" y="28" fill="#e8ffe9" font-family="monospace" font-size="16" text-anchor="end">${esc(s.ts || "")}</text><circle cx="18" cy="284" r="6" fill="#ff3b3b"/><text x="30" y="290" fill="#e8ffe9" font-family="monospace" font-size="14">REC ${esc(s.note || "")}</text></svg>`;
    }
    if (s.k === "log") {
      const cols = s.cols || [];
      const rows = s.rows || [];
      const W = 480;
      const rowH = 30;
      const H = 86 + rows.length * rowH + (s.foot ? 30 : 0);
      const cw = W / cols.length;
      return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="cf-doc"><rect width="${W}" height="${H}" fill="${C.paper}"/><rect width="${W}" height="44" fill="${C.ink}"/><text x="16" y="29" fill="${C.paper}" font-size="17" font-weight="700">${esc(s.title || "")}</text>${s.sub ? `<text x="${W - 14}" y="29" fill="${C.gold2}" font-size="12" text-anchor="end">${esc(s.sub)}</text>` : ""}${cols.map((c, i) => `<text x="${12 + i * cw}" y="70" fill="#6b5f50" font-size="13" font-weight="700">${esc(c)}</text>`).join("")}<line x1="10" y1="78" x2="${W - 10}" y2="78" stroke="${C.ink}" stroke-opacity=".4"/>${rows.map((r, ri) => `${(s.hl || []).includes(ri) ? `<rect x="6" y="${82 + ri * rowH}" width="${W - 12}" height="${rowH - 4}" fill="${C.gold}" opacity=".32"/>` : ""}${r.map((c, ci) => `<text x="${12 + ci * cw}" y="${101 + ri * rowH}" fill="${C.ink}" font-size="14" font-family="${ci === 0 ? "monospace" : "inherit"}">${esc(c)}</text>`).join("")}`).join("")}${s.foot ? `<text x="12" y="${H - 12}" fill="#7a6a58" font-size="12">${esc(s.foot)}</text>` : ""}</svg>`;
    }
    if (s.k === "receipt") {
      const lines = s.lines || [];
      const H = 150 + lines.length * 26;
      return `<svg viewBox="0 0 300 ${H}" xmlns="http://www.w3.org/2000/svg" class="cf-doc cf-doc-narrow"><path d="M0 0 H300 V${H - 10} ${Array.from({ length: 15 }, (_, i) => `L${300 - i * 20 - 10} ${H} L${300 - i * 20 - 20} ${H - 10}`).join(" ")} Z" fill="#f7f4ec"/><text x="150" y="36" text-anchor="middle" font-size="18" font-weight="700" fill="${C.ink}">${esc(s.shop || "")}</text><text x="150" y="58" text-anchor="middle" font-size="12" fill="#7a6a58" font-family="monospace">${esc(s.ts || "")}</text><line x1="16" y1="72" x2="284" y2="72" stroke="${C.ink}" stroke-dasharray="4 4"/>${lines.map(([a, b], i) => `<text x="18" y="${98 + i * 26}" font-size="14" fill="${C.ink}">${esc(a)}</text><text x="282" y="${98 + i * 26}" font-size="14" fill="${C.ink}" text-anchor="end" font-family="monospace">${esc(b || "")}</text>`).join("")}<line x1="16" y1="${H - 50}" x2="284" y2="${H - 50}" stroke="${C.ink}" stroke-dasharray="4 4"/><text x="150" y="${H - 26}" text-anchor="middle" font-size="12" fill="#7a6a58">${esc(s.foot || "감사합니다")}</text></svg>`;
    }
    if (s.k === "chat") {
      const msgs = s.msgs || [];
      let y = 70;
      const parts = msgs.map((m) => {
        const mine = !!m.me;
        const lines = wrapLines(m.text, 17);
        const h = 20 + lines.length * 20;
        const x = mine ? 130 : 20;
        const out = `<rect x="${x}" y="${y}" width="230" height="${h}" rx="12" fill="${mine ? "#d9b15f" : "#2c3b52"}"/>${lines.map((l, i) => `<text x="${x + 12}" y="${y + 24 + i * 20}" font-size="14" fill="${mine ? C.ink : "#eef2f7"}">${esc(l)}</text>`).join("")}<text x="${mine ? x - 6 : x + 236}" y="${y + h - 4}" font-size="11" fill="#8fa1b8" text-anchor="${mine ? "end" : "start"}">${esc(m.t || "")}</text>`;
        y += h + 14;
        return out;
      });
      return `<svg viewBox="0 0 380 ${y + 16}" xmlns="http://www.w3.org/2000/svg" class="cf-doc cf-doc-narrow"><rect width="380" height="${y + 16}" rx="18" fill="#141c2b"/><rect width="380" height="50" rx="18" fill="#1c2638"/><text x="190" y="32" text-anchor="middle" font-size="16" fill="#eef2f7" font-weight="700">${esc(s.who || "")}</text>${parts.join("")}</svg>`;
    }
    if (s.k === "plan") {
      const sh = s.shapes || [];
      const body = sh.map((o) => {
        if (o.t === "rect") return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="${o.fill || "none"}" stroke="${C.ink}" stroke-width="${o.sw || 2}"${o.dash ? ' stroke-dasharray="6 5"' : ""}/>${o.label ? `<text x="${o.x + o.w / 2}" y="${o.y + o.h / 2 + 5}" text-anchor="middle" font-size="14" fill="${C.ink}">${esc(o.label)}</text>` : ""}`;
        if (o.t === "line") return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${o.c || C.ink}" stroke-width="${o.sw || 2}"${o.dash ? ' stroke-dasharray="6 5"' : ""}/>`;
        if (o.t === "cone") return `<polygon points="${o.points}" fill="${o.c || C.gold}" opacity=".35"/>`;
        if (o.t === "dot") return `<circle cx="${o.x}" cy="${o.y}" r="${o.r || 8}" fill="${o.c || C.red2}"/>${o.label ? `<text x="${o.x + (o.dx || 12)}" y="${o.y + 5}" font-size="13" fill="${C.ink}" font-weight="700">${esc(o.label)}</text>` : ""}`;
        if (o.t === "text") return `<text x="${o.x}" y="${o.y}" font-size="${o.size || 13}" fill="${o.c || C.ink}" text-anchor="${o.anchor || "start"}">${esc(o.text)}</text>`;
        return "";
      });
      return `<svg viewBox="0 0 480 ${s.h || 320}" xmlns="http://www.w3.org/2000/svg" class="cf-doc"><defs><pattern id="${k}g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0 H0 V20" fill="none" stroke="#b9c6d3" stroke-width=".6"/></pattern></defs><rect width="480" height="${s.h || 320}" fill="#eef1f2"/><rect width="480" height="${s.h || 320}" fill="url(#${k}g)"/><text x="16" y="26" font-size="15" font-weight="700" fill="${C.ink}">${esc(s.title || "약도")}</text>${body.join("")}</svg>`;
    }
    if (s.k === "photo") {
      return `<svg viewBox="0 0 320 360" xmlns="http://www.w3.org/2000/svg" class="cf-doc cf-doc-narrow"><rect x="10" y="10" width="300" height="340" fill="#f4f1e8" transform="rotate(-2 160 180)"/><g transform="rotate(-2 160 180)"><svg x="26" y="26" width="268" height="268" viewBox="0 0 100 100">${prop(s.p)}</svg><text x="160" y="328" text-anchor="middle" font-size="16" fill="${C.ink}" font-family="'Nanum Pen Script', cursive">${esc(s.caption || "")}</text></g></svg>`;
    }
    // paper / note
    const note = s.k === "note";
    const lines = [];
    (s.lines || []).forEach((l, li) => { for (const w of wrapLines(l, note ? 22 : 30)) lines.push({ text: w, hl: (s.hl || []).includes(li) }); });
    const H = 110 + lines.length * (note ? 30 : 26) + (s.stamp ? 40 : 0);
    const W = note ? 360 : 480;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="cf-doc${note ? " cf-doc-narrow" : ""}"><rect width="${W}" height="${H}" fill="${note ? "#f2df8a" : C.paper}"/>${note ? "" : `<rect x="0" y="0" width="${W}" height="6" fill="${C.red}"/>`}<text x="${note ? 22 : 28}" y="${note ? 46 : 50}" font-size="${note ? 24 : 19}" font-weight="700" fill="${C.ink}" font-family="${note ? "'Nanum Pen Script', cursive" : "'Noto Serif KR', serif"}">${esc(s.title || "")}</text>${s.sub ? `<text x="${W - 24}" y="50" font-size="12" fill="#7a6a58" text-anchor="end">${esc(s.sub)}</text>` : ""}<line x1="24" y1="${note ? 60 : 66}" x2="${W - 24}" y2="${note ? 60 : 66}" stroke="${C.ink}" stroke-opacity=".25"/>${lines.map((l, i) => `${l.hl ? `<rect x="20" y="${(note ? 74 : 78) + i * (note ? 30 : 26)}" width="${W - 40}" height="${note ? 26 : 22}" fill="${C.gold}" opacity=".35"/>` : ""}<text x="${note ? 24 : 30}" y="${(note ? 94 : 95) + i * (note ? 30 : 26)}" font-size="${note ? 22 : 15}" fill="${C.ink}" font-family="${note ? "'Nanum Pen Script', cursive" : "inherit"}">${esc(l.text)}</text>`).join("")}${s.stamp ? `<g transform="rotate(-10 ${W - 90} ${H - 40})"><rect x="${W - 150}" y="${H - 62}" width="120" height="40" rx="4" fill="none" stroke="${C.red2}" stroke-width="3"/><text x="${W - 90}" y="${H - 35}" text-anchor="middle" font-size="17" fill="${C.red2}" font-weight="700">${esc(s.stamp)}</text></g>` : ""}</svg>`;
  }

  window.CFArt = { scene, prop, portrait, doc, C, esc, PROPS: Object.keys(P) };
})();
