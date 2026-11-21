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

  /* ---------------- 인물 초상 (200×240) ---------------- */
  const SKIN = ["#f1d1b5", "#e4bc98", "#d3a47c", "#b9845e", "#8f5e3f"];
  function hair(style, col, front) {
    const h = {
      short: front ? `<path d="M62 92 C60 60 80 46 100 46 C122 46 140 60 138 92 C130 74 116 66 100 66 C84 66 70 74 62 92Z"/>` : "",
      side: front ? `<path d="M60 96 C56 58 80 44 102 44 C126 44 144 62 140 96 C136 80 128 72 120 68 C104 76 84 70 72 64 C66 72 62 82 60 96Z"/>` : "",
      slick: front ? `<path d="M62 88 C62 58 82 46 100 46 C120 46 138 58 138 88 C128 70 112 62 100 62 C86 62 72 70 62 88Z"/><path d="M78 56 C92 50 110 50 124 58" stroke="#ffffff" stroke-opacity=".15" stroke-width="3" fill="none"/>` : "",
      long: front ? `<path d="M60 100 C58 58 80 42 100 42 C122 42 142 58 140 100 C134 76 120 64 100 64 C80 64 66 76 60 100Z"/>` : `<path d="M56 96 C54 56 78 38 100 38 C124 38 146 56 144 96 L150 178 C134 186 120 176 116 160 L84 160 C80 176 66 186 50 178Z"/>`,
      bob: front ? `<path d="M60 102 C56 60 80 42 100 42 C122 42 144 60 140 102 C136 84 126 70 100 68 C76 70 64 84 60 102Z"/>` : `<path d="M54 100 C52 56 78 38 100 38 C124 38 148 56 146 100 L146 138 C136 142 128 138 126 130 L74 130 C72 138 64 142 54 138Z"/>`,
      bun: front ? `<path d="M62 90 C62 58 82 46 100 46 C120 46 138 58 138 90 C130 72 116 64 100 64 C84 64 70 72 62 90Z"/>` : `<circle cx="100" cy="36" r="18"/>`,
      pony: front ? `<path d="M62 92 C60 58 82 44 100 44 C122 44 140 58 138 92 C130 72 114 64 98 64 C84 66 70 74 62 92Z"/>` : `<path d="M134 70 C156 80 158 130 146 150 C144 124 138 104 130 90Z"/>`,
      bald: front ? `<path d="M64 96 C62 86 64 78 68 74 L70 98Z M136 96 C138 86 136 78 132 74 L130 98Z"/>` : "",
      curly: front ? `<g>${[[70, 70], [84, 56], [100, 52], [116, 56], [130, 70], [64, 86], [136, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13"/>`).join("")}</g>` : "",
      wave: front ? `<path d="M60 98 C56 58 80 42 100 42 C124 42 144 58 140 98 C132 80 122 70 112 66 C104 74 88 74 78 68 C68 76 62 86 60 98Z"/>` : `<path d="M56 98 C52 58 78 38 100 38 C124 38 148 58 144 98 C152 130 150 160 138 176 C130 160 132 140 126 128 L74 128 C68 140 70 160 62 176 C50 160 48 130 56 98Z"/>`,
      cap: front ? `<path d="M60 84 C62 54 82 42 100 42 C120 42 138 54 140 84Z"/><rect x="58" y="80" width="88" height="8" rx="3"/>` : "",
    }[style] || "";
    return h ? `<g fill="${col}">${h}</g>` : "";
  }
  const OUTFIT = {
    suit: (c) => `<path d="M30 240 C32 196 54 180 76 174 L100 206 L124 174 C146 180 168 196 170 240Z" fill="${c}"/><path d="M84 176 L100 206 L116 176 L108 170 L92 170Z" fill="#f2efe8"/><path d="M96 180 L104 180 L106 214 L100 222 L94 214Z" fill="#8e1f2a"/><path d="M76 174 L92 206 L86 240 M124 174 L108 206 L114 240" stroke="#000" stroke-opacity=".25" stroke-width="3" fill="none"/>`,
    suitnt: (c) => `<path d="M30 240 C32 196 54 180 76 174 L100 210 L124 174 C146 180 168 196 170 240Z" fill="${c}"/><path d="M86 176 L100 210 L114 176 L106 170 L94 170Z" fill="#e9e4da"/>`,
    shirt: (c) => `<path d="M30 240 C32 198 56 182 80 176 L100 192 L120 176 C144 182 168 198 170 240Z" fill="${c}"/><path d="M80 176 L92 196 L100 192 L108 196 L120 176 L110 170 L90 170Z" fill="#000" fill-opacity=".15"/><line x1="100" y1="194" x2="100" y2="240" stroke="#000" stroke-opacity=".2" stroke-width="2"/>`,
    blouse: (c) => `<path d="M30 240 C34 198 58 182 82 176 C90 190 110 190 118 176 C142 182 166 198 170 240Z" fill="${c}"/><path d="M82 176 C90 194 110 194 118 176" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none"/>`,
    turtle: (c) => `<path d="M30 240 C32 198 56 182 82 178 L118 178 C144 182 168 198 170 240Z" fill="${c}"/><rect x="82" y="160" width="36" height="22" rx="8" fill="${c}"/><path d="M84 168 H116 M84 174 H116" stroke="#000" stroke-opacity=".2" stroke-width="2"/>`,
    vest: (c) => `<path d="M30 240 C32 198 56 182 80 176 L100 192 L120 176 C144 182 168 198 170 240Z" fill="#f2efe8"/><path d="M60 186 L84 178 L100 214 L100 240 L66 240Z M140 186 L116 178 L100 214 L100 240 L134 240Z" fill="${c}"/><path d="M94 178 L106 178 L100 188Z" fill="#111"/>`,
    coat: (c) => `<path d="M28 240 C30 194 54 178 78 172 L100 214 L122 172 C146 178 170 194 172 240Z" fill="${c}"/><path d="M78 172 L70 196 L92 226 M122 172 L130 196 L108 226" stroke="#000" stroke-opacity=".3" stroke-width="4" fill="none"/><path d="M90 176 L100 214 L110 176Z" fill="#2a2a2e"/>`,
    hoodie: (c) => `<path d="M28 240 C30 196 54 180 78 174 L122 174 C146 180 170 196 172 240Z" fill="${c}"/><path d="M76 174 C80 200 120 200 124 174" fill="#000" fill-opacity=".18"/><line x1="92" y1="196" x2="90" y2="222" stroke="#eee" stroke-width="2"/><line x1="108" y1="196" x2="110" y2="222" stroke="#eee" stroke-width="2"/>`,
    apron: (c) => `<path d="M30 240 C32 198 56 182 80 176 L120 176 C144 182 168 198 170 240Z" fill="#e8e2d6"/><path d="M70 190 L130 190 L136 240 L64 240Z" fill="${c}"/><path d="M70 190 L82 176 M130 190 L118 176" stroke="${c}" stroke-width="4"/>`,
    uniform: (c) => `<path d="M30 240 C32 196 54 180 78 174 L100 200 L122 174 C146 180 168 196 170 240Z" fill="${c}"/><path d="M86 176 L100 200 L114 176Z" fill="#dfe6ee"/><rect x="118" y="200" width="22" height="12" rx="2" fill="#c9a35a"/><circle cx="100" cy="214" r="2.2" fill="#c9a35a"/><circle cx="100" cy="228" r="2.2" fill="#c9a35a"/>`,
  };
  function portrait(lk = {}, mood = "calm") {
    const k = id("pt");
    const skin = SKIN[lk.skin == null ? 1 : lk.skin];
    const hc = lk.hairColor || "#1d1714";
    const outfit = (OUTFIT[lk.outfit] || OUTFIT.shirt)(lk.color || "#2f3a4f");
    const brow = mood === "angry" ? `<path d="M76 98 L94 104 M124 98 L106 104" stroke="${hc}" stroke-width="4" stroke-linecap="round"/>` : mood === "nervous" ? `<path d="M76 102 L94 98 M124 102 L106 98" stroke="${hc}" stroke-width="4" stroke-linecap="round"/>` : `<path d="M76 100 Q85 96 94 100 M106 100 Q115 96 124 100" stroke="${hc}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    const eyes = `<ellipse cx="86" cy="112" rx="5" ry="${mood === "nervous" ? 4.5 : 3.6}" fill="#1a1412"/><ellipse cx="114" cy="112" rx="5" ry="${mood === "nervous" ? 4.5 : 3.6}" fill="#1a1412"/><circle cx="87.5" cy="111" r="1.2" fill="#fff" opacity=".8"/><circle cx="115.5" cy="111" r="1.2" fill="#fff" opacity=".8"/>`;
    const mouth = mood === "smile" ? `<path d="M88 140 Q100 150 112 140" stroke="#6b2a26" stroke-width="3.4" fill="none" stroke-linecap="round"/>` : mood === "angry" || mood === "nervous" ? `<path d="M88 144 Q100 136 112 144" stroke="#6b2a26" stroke-width="3.4" fill="none" stroke-linecap="round"/>` : `<path d="M89 142 H111" stroke="#6b2a26" stroke-width="3.4" stroke-linecap="round"/>`;
    const age = lk.age > 45 ? `<path d="M74 122 q4 4 8 4 M126 122 q-4 4 -8 4 M88 92 h24" stroke="#000" stroke-opacity=".18" stroke-width="2" fill="none"/>` : "";
    const glasses = lk.glasses ? `<g fill="none" stroke="${lk.glasses === "gold" ? C.gold : "#15151a"}" stroke-width="3"><${lk.glassesShape === "round" ? 'circle cx="86" cy="112" r="11"' : 'rect x="74" y="103" width="24" height="18" rx="4"'}/><${lk.glassesShape === "round" ? 'circle cx="114" cy="112" r="11"' : 'rect x="102" y="103" width="24" height="18" rx="4"'}/><line x1="97" y1="110" x2="103" y2="110"/></g>` : "";
    const beard = lk.beard === "full" ? `<path d="M66 118 C68 160 86 172 100 172 C114 172 132 160 134 118 C128 140 118 150 100 150 C82 150 72 140 66 118Z" fill="${hc}"/>` : lk.beard === "stubble" ? `<path d="M70 124 C72 156 88 168 100 168 C112 168 128 156 130 124 C126 146 114 158 100 158 C86 158 74 146 70 124Z" fill="${hc}" opacity=".35"/>` : lk.beard === "mustache" ? `<path d="M86 134 Q100 126 114 134 Q100 132 86 134Z" fill="${hc}"/>` : "";
    const ear = lk.earring ? `<circle cx="64" cy="128" r="3" fill="${C.gold2}"/><circle cx="136" cy="128" r="3" fill="${C.gold2}"/>` : "";
    const scarf = lk.scarf ? `<path d="M74 168 C90 182 110 182 126 168 L130 186 C112 198 88 198 70 186Z" fill="${lk.scarf}"/><rect x="104" y="184" width="14" height="40" rx="4" fill="${lk.scarf}"/>` : "";
    return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" class="cf-portrait" role="img" aria-hidden="true"><defs><radialGradient id="${k}b" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#4a3a28"/><stop offset=".6" stop-color="#1b1d24"/><stop offset="1" stop-color="#0d0e12"/></radialGradient><linearGradient id="${k}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd892" stop-opacity=".22"/><stop offset=".45" stop-color="#ffd892" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs><rect width="200" height="240" fill="url(#${k}b)"/>${hair(lk.hair, hc, false)}${outfit}<rect x="88" y="150" width="24" height="30" fill="${skin}"/><path d="M88 168 Q100 176 112 168 L112 160 L88 160Z" fill="#000" opacity=".15"/>${scarf}<ellipse cx="66" cy="118" rx="7" ry="11" fill="${skin}"/><ellipse cx="134" cy="118" rx="7" ry="11" fill="${skin}"/><path d="M64 96 C64 66 82 54 100 54 C118 54 136 66 136 96 L134 128 C130 156 116 168 100 168 C84 168 70 156 66 128Z" fill="${skin}"/>${beard}${age}${brow}${eyes}<path d="M100 114 L96 130 L104 130" stroke="#000" stroke-opacity=".25" stroke-width="2.4" fill="none" stroke-linecap="round"/>${mouth}${glasses}${ear}${hair(lk.hair, hc, true)}<rect width="200" height="240" fill="url(#${k}r)"/></svg>`;
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
