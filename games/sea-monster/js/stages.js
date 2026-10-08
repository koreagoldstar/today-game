/*
 * 바다괴물 탐험대 · 12개 지역
 *  world   세계 크기 (화면 너비 540 · 높이 960~1180)
 *  pal     water: [깊이, 색] 물빛 단계 (위 → 아래로 진해진다)
 *  light   rays 빛줄기 수 · reach 빛이 닿는 깊이 · dark 기본 어둠 · darkFrom 이 깊이부터 점점 어둡게
 *  hunt    count 잡아야 할 괴물 수 · pool 나올 수 있는 괴물
 *  oxygen  기본 탐험 시간(초) · par 3별 목표 시간(초)
 *  build(b) 지형 · 숨는 곳 · 장식 (world.js Builder)
 */

export const STAGES = [
  {
    id: "s01",
    no: 1,
    name: "산호초 입구",
    en: "CORAL GATE",
    tip: "레이더 점이 많을수록 가까워요! 꼼지락거리는 곳을 찾아보세요",
    seed: 101,
    world: { w: 1080, h: 2100 },
    pal: {
      surface: "#c9f6ff",
      water: [
        [0, "#8fe8f2"],
        [450, "#45c8e4"],
        [1100, "#2299d2"],
        [1700, "#1677bb"],
        [2100, "#0f5d9e"],
      ],
      snow: "235,255,255",
    },
    light: { rays: 6, reach: 1700, rayA: 0.5, dark: 0, darkFrom: 1500, deepDark: 0.6 },
    hunt: { count: 5, pool: ["coralOcto", "puffer", "rockCrab", "clam", "reefEel"], fixed: true },
    oxygen: 150,
    par: 65,
    music: { bpm: 96, root: 62, scale: "major", prog: "calm", lead: "marimba", drums: "soft", pad: true, seed: 21, density: 0.5 },
    start: { x: 540, y: 150 },
    build(b) {
      const W = b.w;
      // 먼 배경 (0.35 좌표): 먼 산호 능선 · 바위 아치 · 큰 생물 그림자
      b.farRidge(-40, 520, 760, 220, 0.16);
      b.farArch(220, 380, 360, 230, 0.2);
      b.farRidge(-60, 700, 820, 260, 0.24);
      b.shadow("manta", 300, 0.9, 22, 0.35, 0.5);
      b.shadow("whale", 560, 0.75, -14, 0.35, 0.45);
      // 중간 (0.65 좌표): 바위 언덕 + 산호 실루엣 능선 두 겹
      b.midRidge(-80, 820, 900, 420, 0.1);
      b.midRidge(-120, 1180, 960, 420, 0.12);
      b.midRidge(-60, 1420, 940, 360, 0.16);

      // 지형
      b.walls({ left: 105, right: 105, amp: 36, color: "#7389a3" });
      b.bed({ depth: 160, amp: 26, color: "#f3d9a4" });
      const L1 = b.ledge(-1, 820, 330, 96, "#7d8fa6");
      const R1 = b.ledge(1, 1260, 360, 104, "#7a8ea8");
      const L2 = b.ledge(-1, 1580, 280, 84, "#78899f");
      // 바닥에서 올라오는 기포
      b.vent(420, b.onBed(420), 380, 0.42);
      b.vent(880, b.onBed(880), 300, 0.5);

      // 숨는 곳 (괴물마다 숨을 수 있는 곳이 다르다)
      b.spot("coral", L1.x + 30, L1.topAt(L1.x + 30) + 8);
      b.spot("coral", R1.x - 40, R1.topAt(R1.x - 40) + 8, { colors: ["#ff9b6a", "#ffd166", "#ff7aa2"] });
      b.spot("coral", 330, b.onBed(330), { colors: ["#b066ff", "#ff7aa2", "#5fd3a8"] });
      b.spot("coral", 760, b.onBed(760), { colors: ["#ff7aa2", "#ffb347", "#3fd3ff"] });
      b.spot("rock", 560, b.onBed(560), {});
      b.spot("rock", L2.x + 10, L2.topAt(L2.x + 10) + 10, { color: "#7a8ea8" });
      b.spot("hole", b.world.wallL(1140) + 4, 1140, { side: -1, color: "#7389a3" });
      b.spot("hole", b.world.wallR(640) - 4, 640, { side: 1, color: "#7389a3" });
      b.spot("sand", 200, b.onBed(200, 2));
      b.spot("sand", 650, b.onBed(650, 2));
      b.spot("sand", 950, b.onBed(950, 2));
      b.spot("rockbed", 460, b.onBed(460, 4));
      b.spot("rockbed", 880, b.onBed(880, 4));
      b.spot("rockbed", R1.x - 120, R1.topAt(R1.x - 120) + 12);

      // 장식: 턱 위 · 바닥 산호 정원
      b.coral("table", L1.x - 70, L1.topAt(L1.x - 70) + 10, 0.8, "#5fd3a8");
      b.coral("tube", L1.x + 120, L1.topAt(L1.x + 120) + 12, 0.8, "#ffd23f");
      b.anemone(L1.x - 10, L1.topAt(L1.x - 10) + 12, 0.9, "#ff6f91");
      b.coral("fan", R1.x + 60, R1.topAt(R1.x + 60) + 10, 0.9, "#b066ff");
      b.coral("brain", R1.x + 130, R1.topAt(R1.x + 130) + 14, 0.8, "#ffb347");
      b.anemone(R1.x + 10, R1.topAt(R1.x + 10) + 14, 0.8, "#ff9b6a", "#fff3c4");
      b.coral("branch", L2.x - 60, L2.topAt(L2.x - 60) + 10, 0.8, "#ff8fb3");
      b.coral("tube", L2.x + 90, L2.topAt(L2.x + 90) + 10, 0.7, "#ff9b6a");
      for (const [k, x, s, c] of [
        ["branch", 110, 0.9, "#ff7aa2"],
        ["brain", 250, 0.9, "#ffb347"],
        ["fan", 410, 1.0, "#b066ff"],
        ["table", 520, 0.75, "#5fd3a8"],
        ["tube", 700, 0.85, "#ffd23f"],
        ["branch", 840, 1.0, "#ff9b6a"],
        ["fan", 1000, 0.9, "#ff7aa2"],
      ])
        b.coral(k, x, b.onBed(x, 8), s, c);
      for (const x of [160, 300, 600, 820, 990]) b.anemone(x, b.onBed(x, 6), 0.8 + (x % 3) * 0.1, x % 2 ? "#ff6f91" : "#b066ff");
      for (const x of [140, 380, 520, 720, 940]) b.weed(x, b.onBed(x, 8), 110 + (x % 5) * 20, x % 2 ? "#3fbf6a" : "#2fa86a", 8);
      for (const x of [230, 610, 900]) b.starfish(x, b.onBed(x, 2), 1);
      for (const x of [180, 480, 680, 860]) b.shell(x, b.onBed(x, 2), 0.9);
      b.kelp(130, b.onBed(130, 8), 420, "#2f9e5a", 7, "back");
      b.kelp(980, b.onBed(980, 8), 380, "#2f9e5a", 7, "back");
      b.kelp(L1.x + 150, L1.topAt(L1.x + 150) + 14, 220, "#3aa860", 6, "back");

      // 물고기 떼 (가까이 가면 흩어진다)
      b.school(520, 420, 9, "#ffd23f", 1);
      b.school(760, 980, 8, "#3fd3ff", 1.1);
      b.school(360, 1500, 10, "#ff9b6a", 0.9);
      b.school(640, 1820, 7, "#b8f1ff", 1);

      // 앞쪽 다시마 덤불 (화면 가장자리 아래에서 올라온다 · 1.3 좌표)
      b.fgKelp(-40, 1420, 0.9);
      b.fgKelp(1180, 1700, 1.0);
      b.fgKelp(260, 2460, 0.85);
      b.fgKelp(1040, 2560, 0.9);
      b.fgKelp(-20, 2700, 1.0);
      b.done();
    },
  },
  // ---- 이후 지역 (PHASE 2~5 에서 채운다) ----
  {
    id: "s02",
    no: 2,
    name: "해초 숲",
    en: "KELP FOREST",
    tip: "해초가 앞을 가려요! 덤불 옆으로 삐죽 나온 꼬리, 물결과 반대로 흔들리는 미역을 찾아요",
    seed: 202,
    world: { w: 1200, h: 2300 },
    pal: {
      surface: "#c9f6e8",
      canopy: true,
      water: [
        [0, "#9ff0d4"],
        [450, "#4fcaa8"],
        [1100, "#26a08a"],
        [1800, "#18786e"],
        [2300, "#0f5656"],
      ],
      snow: "230,255,235",
    },
    light: { rays: 9, reach: 1600, rayA: 0.42, dark: 0, darkFrom: 1400, deepDark: 0.7 },
    hunt: { count: 6, pool: ["kelpShark", "kelpShark", "weedMonster", "urchin", "seahorse", "puffer"], fixed: true },
    oxygen: 170,
    par: 80,
    music: { bpm: 90, root: 60, scale: "dorian", prog: "calm", lead: "flute", drums: "soft", pad: true, seed: 33, density: 0.45 },
    start: { x: 600, y: 160 },
    build(b) {
      const W = b.w;
      b.farRidge(-60, 560, 820, 240, 0.18);
      b.farRidge(-80, 760, 860, 260, 0.26);
      b.shadow("whale", 420, 0.8, 12, 0.35, 0.4);
      b.midRidge(-80, 860, 960, 420, 0.1, "#3fa060");
      b.midRidge(-120, 1220, 1000, 420, 0.14, "#2f8a50");
      b.walls({ left: 100, right: 100, amp: 34, color: "#6a8a84" });
      b.bed({ depth: 160, amp: 30, color: "#d9c48a" });
      const L1 = b.ledge(-1, 760, 300, 90, "#6f8a86");
      const R1 = b.ledge(1, 1240, 340, 100, "#6c8884");
      const L2 = b.ledge(-1, 1720, 280, 86, "#6a8682");
      // 뒤쪽 숲: 바닥에서 수면 근처까지 자란 큰 다시마
      for (const x of [160, 330, 490, 690, 800, 950, 1070]) b.kelp(x, b.onBed(x, 8), 1350 + (x % 7) * 90, x % 2 ? "#6f9a3a" : "#5f8a34", 8, "back");
      for (const x of [240, 580, 880]) b.kelp(x, b.onBed(x, 8), 950, "#7aa640", 7, "back");
      // 숨는 곳
      b.spot("kelp", 300, b.onBed(300));
      b.spot("kelp", 820, b.onBed(820));
      b.spot("kelp", L1.x + 20, L1.topAt(L1.x + 20) + 6);
      b.spot("kelp", R1.x - 30, R1.topAt(R1.x - 30) + 6);
      b.spot("kelp", L2.x + 10, L2.topAt(L2.x + 10) + 6);
      b.spot("kelp", 600, b.onBed(600));
      b.spot("weed", 160, b.onBed(160, 4));
      b.spot("weed", 1020, b.onBed(1020, 4));
      b.spot("weed", R1.x + 70, R1.topAt(R1.x + 70) + 6);
      b.spot("sand", 440, b.onBed(440, 2));
      b.spot("sand", 700, b.onBed(700, 2));
      b.spot("sand", 950, b.onBed(950, 2));
      b.spot("sand", L2.x - 60, L2.topAt(L2.x - 60) + 4);
      b.spot("kelpTall", 520, b.onBed(520, 4), { h: 820 });
      b.spot("kelpTall", 900, b.onBed(900, 4), { h: 1250 });
      b.spot("kelpTall", 240, b.onBed(240, 4), { h: 1450 });
      b.spot("kelpTall", L1.x + 120, L1.topAt(L1.x + 120) + 4, { h: 380 });
      b.spot("rock", 1000, b.onBed(1000), { color: "#7a8c88" });
      b.spot("rock", L1.x - 60, L1.topAt(L1.x - 60) + 10, { color: "#7a8c88" });
      // 장식
      for (const x of [120, 380, 680, 760, 1100]) b.weed(x, b.onBed(x, 8), 120 + (x % 4) * 30, x % 2 ? "#3fbf6a" : "#2fa86a", 8);
      for (const x of [260, 520, 880]) b.anemone(x, b.onBed(x, 6), 0.8, "#ff9b6a", "#fff3c4");
      b.coral("brain", 360, b.onBed(360, 8), 0.8, "#c9b45a");
      b.coral("tube", 1080, b.onBed(1080, 8), 0.8, "#ff9b6a");
      b.coral("fan", R1.x + 130, R1.topAt(R1.x + 130) + 10, 0.8, "#ff7aa2");
      for (const x of [200, 620, 980]) b.starfish(x, b.onBed(x, 2), 1);
      for (const x of [330, 760]) b.shell(x, b.onBed(x, 2), 0.9);
      b.vent(560, b.onBed(560), 340, 0.45);
      // 앞을 가리는 큰 다시마 (시야를 가린다)
      for (const [x, h] of [
        [120, 900],
        [420, 1300],
        [700, 700],
        [960, 1500],
        [1120, 1000],
      ])
        b.kelpFront(x, b.onBed(x, 10), h);
      b.school(600, 500, 10, "#c9f06a", 1);
      b.school(380, 1150, 8, "#ffd23f", 1.1);
      b.school(820, 1900, 9, "#9be0ff", 1);
      b.fgKelp(-40, 1500, 1.0, "#0b3a2c");
      b.fgKelp(1300, 1800, 1.1, "#0b3a2c");
      b.fgKelp(300, 2600, 0.9, "#0a3528");
      b.fgKelp(1200, 2800, 1.0, "#0b3a2c");
      b.done();
    },
  },
  {
    id: "s03",
    no: 3,
    name: "침몰한 보물선",
    en: "SUNKEN TREASURE",
    boss: "sharkKing",
    tip: "배 안은 어두워요! 둥근 창의 눈 · 혀를 날름거리는 상자 · 닻 밑 눈자루를 찾아요",
    seed: 303,
    world: { w: 1500, h: 2000 },
    pal: {
      surface: "#bfe6f2",
      water: [
        [0, "#7fd6e6"],
        [450, "#3aaed0"],
        [1000, "#1f80b4"],
        [1600, "#165e94"],
        [2000, "#0f4678"],
      ],
      snow: "225,245,255",
    },
    light: { rays: 6, reach: 1500, rayA: 0.42, dark: 0, darkFrom: 1200, deepDark: 0.8 },
    hunt: { count: 6, pool: ["chestMimic", "porthole", "anchorCrab", "anchorCrab", "clam", "rockCrab"], fixed: true },
    oxygen: 190,
    par: 95,
    music: { bpm: 100, root: 57, scale: "minor", prog: "minor", lead: "steel", drums: "island", pad: true, seed: 44, density: 0.5 },
    start: { x: 750, y: 170 },
    bossSpawn: { x: 760, y: 1060 },
    build(b) {
      const W = b.w;
      b.farRidge(-60, 520, 900, 240, 0.18);
      b.farRidge(-80, 720, 960, 260, 0.26);
      b.shadow("whale", 360, 0.85, 10, 0.35, 0.4);
      b.midRidge(-80, 820, 1040, 420, 0.12);
      b.midRidge(-100, 1150, 1080, 400, 0.16);
      b.walls({ left: 90, right: 90, amp: 30, color: "#6f7c90" });
      b.bed({ depth: 130, amp: 14, color: "#d8c79a" });
      const L1 = b.ledge(-1, 700, 260, 86, "#76869c");
      const R1 = b.ledge(1, 880, 280, 90, "#74849a");
      const S = b.ship(760, b.onBed(760, 24));
      // 배 안: 보물상자 (진짜 하나 + 가짜들) · 닻
      b.spot("chest", S.left + 70, S.floor, { patrol: [S.left + 40, S.x - 40] });
      b.spot("chest", S.x + 60, S.floor, { patrol: [S.x + 10, S.right - 40] });
      b.spot("chest", S.left + 90, S.mid - 8, { patrol: [S.left + 40, S.gapMid[0] - 30] });
      b.spot("chest", S.right - 70, S.mid - 8, { patrol: [S.gapMid[1] + 30, S.right - 40] });
      b.spot("anchor", S.x - 120, S.mid - 8, { patrol: [S.left + 40, S.gapMid[0] - 30] });
      b.spot("anchor", S.right - 150, S.floor, { patrol: [S.x + 20, S.right - 40] });
      b.spot("anchor", S.left - 140, S.sternTop - 2, { patrol: [S.left - 230, S.left - 30] });
      b.spot("anchor", S.right + 110, S.bowTop - 2, { patrol: [S.right + 40, S.right + 170] });
      // 바깥: 배 양옆 모래 · 바위 턱
      b.spot("sand", 175, b.onBed(175, 2));
      b.spot("sand", 1360, b.onBed(1360, 2));
      b.spot("sand", L1.x + 30, L1.topAt(L1.x + 30) + 4);
      b.spot("rockbed", L1.x - 70, L1.topAt(L1.x - 70) + 10);
      b.spot("rockbed", R1.x - 60, R1.topAt(R1.x - 60) + 10);
      b.spot("rockbed", R1.x + 70, R1.topAt(R1.x + 70) + 10);
      // 장식
      for (const x of [140, 420, 1100, 1420]) b.weed(x, b.onBed(x, 8), 100 + (x % 4) * 20, "#3fbf6a", 8);
      for (const x of [220, 1280]) b.coral("branch", x, b.onBed(x, 8), 0.8, "#ff9b6a");
      b.coral("fan", L1.x - 60, L1.topAt(L1.x - 60) + 10, 0.8, "#b066ff");
      b.coral("brain", R1.x + 60, R1.topAt(R1.x + 60) + 12, 0.8, "#ffb347");
      b.anemone(1180, b.onBed(1180, 6), 0.8, "#ff6f91");
      for (const x of [300, 1200]) b.shell(x, b.onBed(x, 2), 1);
      b.starfish(1400, b.onBed(1400, 2), 1);
      b.vent(1140, b.onBed(1140), 300, 0.45);
      b.school(750, 520, 10, "#ffd23f", 1);
      b.school(400, 1000, 8, "#b8f1ff", 1);
      b.fgKelp(-40, 1400, 0.9, "#0c3a4a");
      b.fgKelp(1700, 1600, 1.0, "#0c3a4a");
      b.fgKelp(1000, 2400, 0.85, "#0b3444");
      b.done();
    },
  },
  {
    id: "s04",
    no: 4,
    name: "해저 동굴",
    en: "UNDERSEA CAVE",
    tip: "동굴은 깜깜해요! 헤드램프로 비춰 보세요. 빛나는 두 눈 · 벽의 얼굴 무늬를 조심!",
    seed: 404,
    world: { w: 1100, h: 2600 },
    pal: {
      surface: "#a8e2ee",
      water: [
        [0, "#6fcfe0"],
        [380, "#2c8cb8"],
        [900, "#1a5a8a"],
        [1600, "#10385e"],
        [2600, "#081e3a"],
      ],
      snow: "200,235,255",
      darkColor: "1,6,18",
    },
    light: { rays: 4, reach: 900, rayA: 0.38, dark: 0.08, darkFrom: 260, deepDark: 2.1, caustics: false },
    hunt: { count: 6, pool: ["caveFish", "caveFish", "shadeRay", "stoneFace", "reefEel", "urchin"], fixed: true },
    oxygen: 210,
    par: 115,
    music: { bpm: 80, root: 55, scale: "minorPenta", prog: "minor", lead: "bell", drums: "none", pad: true, seed: 55, density: 0.35 },
    start: { x: 560, y: 170 },
    build(b) {
      b.farRidge(-60, 520, 820, 240, 0.25);
      b.farRidge(-80, 700, 860, 260, 0.35);
      b.midRidge(-80, 760, 900, 420, 0.25);
      b.walls({ left: 110, right: 110, amp: 50, color: "#5a6278" });
      b.bed({ depth: 140, amp: 30, color: "#8a8270" });
      // 지그재그 동굴 턱 (좁은 길)
      const L1 = b.ledge(-1, 600, 560, 110, "#5f667c");
      const R1 = b.ledge(1, 980, 560, 110, "#5c6378");
      const L2 = b.ledge(-1, 1360, 540, 110, "#5a6176");
      const R2 = b.ledge(1, 1740, 560, 110, "#585f74");
      const L3 = b.ledge(-1, 2100, 500, 100, "#565d72");
      for (const Lg of [L1, R1, L2, R2, L3]) {
        const cx = (Lg.wall + Lg.tip) / 2;
        b.stalac(cx, Lg.y + 40, Math.abs(Lg.tip - Lg.wall) * 0.8);
      }
      // 숨는 곳
      const wl = (y) => b.world.wallL(y);
      const wr = (y) => b.world.wallR(y);
      b.spot("nook", wl(820) + 10, 820);
      b.spot("nook", wr(1200) - 10, 1200);
      b.spot("nook", wl(1580) + 10, 1580);
      b.spot("nook", wr(1960) - 10, 1960);
      b.spot("nook", L2.tip - 60, L2.topAt(L2.tip - 60) - 26);
      b.spot("dark", 720, 800);
      b.spot("dark", 380, 1160);
      b.spot("dark", 760, 1540);
      b.spot("dark", 360, 1920);
      b.spot("wallface", wl(1040) + 40, 1040);
      b.spot("wallface", wr(1400) - 40, 1400);
      b.spot("wallface", wl(2290) + 40, 2290);
      b.spot("hole", wr(700) - 4, 700, { side: 1, color: "#5a6278" });
      b.spot("hole", wl(1800) + 4, 1800, { side: -1, color: "#5a6278" });
      b.spot("sand", 420, b.onBed(420, 2));
      b.spot("sand", 760, b.onBed(760, 2));
      b.spot("sand", R2.x + 40, R2.topAt(R2.x + 40) + 4);
      // 빛: 수정 · 빛버섯
      b.glow("crystal", L1.x + 80, L1.topAt(L1.x + 80) + 8, 0.9);
      b.glow("shroom", R1.x - 40, R1.topAt(R1.x - 40) + 8, 1);
      b.glow("crystal", L2.x - 40, L2.topAt(L2.x - 40) + 8, 1, "#b58bff");
      b.glow("shroom", R2.x + 100, R2.topAt(R2.x + 100) + 8, 1, "#ffd23f");
      b.glow("crystal", L3.x + 60, L3.topAt(L3.x + 60) + 8, 1);
      b.glow("crystal", 560, b.onBed(560, 6), 1.1, "#5ff0ff");
      b.glow("shroom", 900, b.onBed(900, 6), 1, "#7dff9a");
      b.glow("shroom", 240, b.onBed(240, 6), 0.9, "#ff8ad0");
      // 장식
      for (const x of [300, 640, 980]) b.weed(x, b.onBed(x, 8), 80, "#3a8a6a", 7);
      b.coral("tube", 820, b.onBed(820, 8), 0.7, "#8a7aaa");
      b.school(560, 400, 8, "#b8f1ff", 0.9);
      b.fgKelp(-40, 1500, 0.9, "#06202a");
      b.fgKelp(1300, 2000, 1.0, "#06202a");
      b.done();
    },
  },
  {
    id: "s05",
    no: 5,
    name: "해파리 계곡",
    en: "JELLY VALLEY",
    boss: "giantJelly",
    tip: "빛나는 해파리 중에 혼자 박자가 다른 녀석이 있어요! 노랗게 빛나는 말미잘은 찌릿해요",
    seed: 505,
    world: { w: 1300, h: 2500 },
    pal: {
      surface: "#c8e6ff",
      water: [
        [0, "#8fd2f0"],
        [420, "#5c9ae0"],
        [1000, "#4a5ec0"],
        [1700, "#33318e"],
        [2500, "#1c1452"],
      ],
      snow: "230,215,255",
      darkColor: "8,4,26",
    },
    light: { rays: 5, reach: 1100, rayA: 0.36, dark: 0.1, darkFrom: 420, deepDark: 1.7, caustics: false },
    hunt: { count: 5, pool: ["jellyMonster", "jellyMonster", "zapEel", "zapEel", "jellyTwins"], fixed: true },
    oxygen: 220,
    par: 120,
    bossSpawn: { x: 650, y: 1500 },
    music: { bpm: 84, root: 58, scale: "dorian", prog: "calm", lead: "bell", drums: "soft", pad: true, seed: 77, density: 0.42 },
    start: { x: 640, y: 170 },
    build(b) {
      const W = b.w;
      // 먼 배경: 보랏빛 계곡 능선 · 거대한 생물 그림자
      b.farRidge(-60, 560, 900, 260, 0.2);
      b.farArch(300, 420, 420, 260, 0.26);
      b.farRidge(-80, 760, 980, 300, 0.3);
      b.shadow("manta", 360, 1.0, 16, 0.35, 0.45);
      b.shadow("whale", 640, 0.8, -12, 0.35, 0.4);
      b.midRidge(-80, 900, 1000, 460, 0.18);
      b.midRidge(-120, 1300, 1060, 460, 0.22);
      b.midRidge(-60, 1700, 1040, 420, 0.26);

      // 계곡 벽 (깊을수록 좁아 보이게 굴곡 크게)
      b.walls({ left: 130, right: 130, amp: 64, color: "#6a5a9a" });
      b.bed({ depth: 150, amp: 34, color: "#b9a6dc" });
      const L1 = b.ledge(-1, 700, 400, 100, "#71609e");
      const R1 = b.ledge(1, 1040, 420, 104, "#6e5e9c");
      const L2 = b.ledge(-1, 1420, 380, 96, "#6a5a98");
      const R2 = b.ledge(1, 1800, 400, 100, "#675794");
      const L3 = b.ledge(-1, 2100, 300, 90, "#645490");

      // 전기 말미잘 (지역 기믹): 턱 위 · 바닥
      b.hazard("zap", L1.x + 40, L1.topAt(L1.x + 40) + 10, { r: 120, period: 2.8 });
      b.hazard("zap", R1.x - 30, R1.topAt(R1.x - 30) + 10, { r: 120, period: 3.2 });
      b.hazard("zap", L2.x + 60, L2.topAt(L2.x + 60) + 10, { r: 120, period: 2.6 });
      b.hazard("zap", R2.x - 50, R2.topAt(R2.x - 50) + 10, { r: 120, period: 3.0 });
      b.hazard("zap", 420, b.onBed(420, 8), { r: 130, period: 2.6 });
      b.hazard("zap", 900, b.onBed(900, 8), { r: 130, period: 3.4 });

      // 숨는 곳: 해파리 무리 (물 한가운데) · 바위 틈
      b.spot("jellies", 480, 520);
      b.spot("jellies", 860, 860);
      b.spot("jellies", 420, 1200);
      b.spot("jellies", 820, 1560);
      b.spot("jellies", 560, 1960);
      const wl = (y) => b.world.wallL(y);
      const wr = (y) => b.world.wallR(y);
      b.spot("crevice", wl(560) + 6, 560, { side: -1, color: "#6a5a9a" });
      b.spot("crevice", wr(760) - 6, 760, { side: 1, color: "#6a5a9a" });
      b.spot("crevice", wl(1200) + 6, 1200, { side: -1, color: "#6a5a9a" });
      b.spot("crevice", wr(1560) - 6, 1560, { side: 1, color: "#6a5a9a" });
      b.spot("crevice", wl(1880) + 6, 1880, { side: -1, color: "#6a5a9a" });

      // 떠다니는 해파리 (장식 · 길을 밝힌다)
      for (const [x, y, s, c] of [
        [700, 380, 0.8, null],
        [320, 760, 1.1, null],
        [1000, 1180, 0.9, "#b8c8ff"],
        [700, 1330, 1.2, null],
        [300, 1640, 0.9, "#ffc8e8"],
        [980, 1960, 1.0, null],
        [820, 2200, 1.3, "#b8c8ff"],
        [380, 2300, 0.9, null],
      ])
        b.jelly(x, y, s, c || undefined);

      // 빛: 수정 · 빛버섯
      b.glow("crystal", L1.x - 80, L1.topAt(L1.x - 80) + 8, 0.9, "#c58bff");
      b.glow("shroom", R1.x + 70, R1.topAt(R1.x + 70) + 8, 1, "#ff8ad0");
      b.glow("crystal", L3.x + 30, L3.topAt(L3.x + 30) + 8, 1, "#7ff0ff");
      b.glow("shroom", 650, b.onBed(650, 6), 1.1, "#c58bff");
      b.glow("crystal", 1080, b.onBed(1080, 6), 1, "#ff8ad0");

      // 장식
      for (const x of [220, 560, 760, 1120]) b.weed(x, b.onBed(x, 8), 100 + (x % 3) * 20, "#7a5ab8", 7);
      b.anemone(300, b.onBed(300, 6), 0.8, "#c58bff", "#fff3c4");
      b.anemone(R2.x + 60, R2.topAt(R2.x + 60) + 10, 0.8, "#ff8ad0");
      b.coral("fan", L2.x - 40, L2.topAt(L2.x - 40) + 10, 0.9, "#b066ff");
      b.coral("tube", 1000, b.onBed(1000, 8), 0.8, "#8a7aff");
      b.coral("branch", 160, b.onBed(160, 8), 0.7, "#ff8ad0");
      for (const x of [520, 980]) b.starfish(x, b.onBed(x, 2), 1);
      b.school(650, 600, 9, "#ffd0f2", 0.9);
      b.school(500, 1500, 8, "#c8e6ff", 1);
      b.fgKelp(-40, 1500, 0.9, "#120a30");
      b.fgKelp(1500, 1900, 1.0, "#120a30");
      b.fgKelp(600, 2700, 0.9, "#0e0828");
      b.done();
    },
  },
  {
    id: "s06",
    no: 6,
    name: "화산 해저",
    en: "VOLCANIC FLOOR",
    boss: "volcanoBeast",
    tip: "빨갛게 빛나는 분수구는 곧 뿜어요! 뜨거운 용암게는 물로 식힌 뒤에 맞혀요",
    seed: 606,
    world: { w: 1400, h: 2200 },
    pal: {
      surface: "#d8e6e2",
      water: [
        [0, "#9ccfd2"],
        [380, "#5a8f9c"],
        [900, "#3e5a68"],
        [1500, "#3a3240"],
        [2200, "#2a1a1c"],
      ],
      snow: "255,190,140",
      darkColor: "20,6,4",
    },
    light: { rays: 4, reach: 1000, rayA: 0.34, dark: 0.03, darkFrom: 750, deepDark: 1.15, caustics: false },
    hunt: { count: 5, pool: ["lavaCrab", "lavaCrab", "ventWorm", "ventWorm", "magmaTurtle"], fixed: true },
    oxygen: 240,
    par: 130,
    bossSpawn: { x: 700, y: 1250 },
    music: { bpm: 92, root: 50, scale: "minor", prog: "minor", lead: "pluck", drums: "storm", pad: true, seed: 88, density: 0.45 },
    start: { x: 700, y: 170 },
    build(b) {
      // 먼 배경: 연기 나는 해저 화산 능선
      b.farRidge(-60, 560, 980, 300, 0.3);
      b.farArch(760, 440, 420, 240, 0.34);
      b.farRidge(-80, 760, 1060, 320, 0.38);
      b.shadow("whale", 520, 0.8, -12, 0.35, 0.35);
      b.midRidge(-80, 900, 1100, 460, 0.3, "#5a3a34");
      b.midRidge(-120, 1300, 1160, 460, 0.34, "#4a302c");
      b.midRidge(-60, 1680, 1140, 420, 0.38, "#3a2624");
      // 지형: 검은 현무암 벽 · 바닥
      b.walls({ left: 110, right: 110, amp: 46, color: "#4a3e40" });
      b.bed({ depth: 170, amp: 46, color: "#5e4c48" });
      const L1 = b.ledge(-1, 640, 440, 104, "#4e4244");
      const R1 = b.ledge(1, 980, 460, 108, "#4a3e40");
      const L2 = b.ledge(-1, 1340, 420, 100, "#483c3e");
      const R2 = b.ledge(1, 1660, 380, 96, "#463a3c");

      // 용암 분수구 (지역 기믹)
      b.hazard("geyser", L1.x + 30, L1.topAt(L1.x + 30) + 6, { h: 340, period: 3.0 });
      b.hazard("geyser", R1.x + 130, R1.topAt(R1.x + 130) + 6, { h: 340, period: 3.4 });
      b.hazard("geyser", L2.x + 60, L2.topAt(L2.x + 60) + 6, { h: 320, period: 2.8 });
      b.hazard("geyser", 480, b.onBed(480, 6), { h: 420, period: 3.2 });
      b.hazard("geyser", 1000, b.onBed(1000, 6), { h: 420, period: 2.9 });

      // 숨는 곳: 열수 굴뚝 · 용암 바위 · 큰 바위(거북)
      b.spot("chimney", 250, b.onBed(250, 6), { h: 170 });
      b.spot("chimney", 760, b.onBed(760, 6), { h: 200 });
      b.spot("chimney", 1180, b.onBed(1180, 6), { h: 160 });
      b.spot("chimney", R1.x + 60, R1.topAt(R1.x + 60) + 10, { h: 120 });
      b.spot("lavarock", L1.x - 80, L1.topAt(L1.x - 80) + 6);
      b.spot("lavarock", R1.x - 150, R1.topAt(R1.x - 150) + 6);
      b.spot("lavarock", L2.x - 40, L2.topAt(L2.x - 40) + 6);
      b.spot("lavarock", R2.x + 20, R2.topAt(R2.x + 20) + 6);
      b.spot("lavarock", 600, b.onBed(600, 4));
      b.spot("lavarock", 1300, b.onBed(1300, 4));
      b.spot("boulder", R1.x - 40, R1.topAt(R1.x - 40) + 6);
      b.spot("boulder", 900, b.onBed(900, 4));
      b.spot("boulder", L2.x + 150, L2.topAt(L2.x + 150) + 6);

      // 빛: 용암 웅덩이 빛 · 붉은 수정
      b.glow("crystal", L1.x + 140, L1.topAt(L1.x + 140) + 8, 0.9, "#ff7a3a");
      b.glow("shroom", R2.x - 90, R2.topAt(R2.x - 90) + 8, 1, "#ffb03a");
      b.glow("crystal", 1100, b.onBed(1100, 6), 1, "#ff5a3a");
      b.glow("shroom", 420, b.onBed(420, 6), 0.9, "#ff9a3a");
      // 장식: 검은 관해면 · 마른 해초 · 바위
      for (const x of [240, 680, 1240]) b.coral("tube", x, b.onBed(x, 8), 0.7, "#6a4a4a");
      for (const x of [380, 840, 1120]) b.weed(x, b.onBed(x, 8), 70, "#6a5a3a", 6);
      b.rock(1060, b.onBed(1060, 10), 0.9, "#4a3e40");
      b.rock(R1.x + 140, R1.topAt(R1.x + 140) + 14, 0.7, "#4a3e40");
      b.school(700, 520, 8, "#ffd0a0", 0.9);
      b.fgKelp(-40, 1400, 0.9, "#1a0e0c");
      b.fgKelp(1600, 1800, 1.0, "#1a0e0c");
      b.done();
    },
  },
  {
    id: "s07",
    no: 7,
    name: "얼음 바다",
    en: "ICE SEA",
    tip: "고드름 밑을 지날 땐 조심! 얼음 구멍에서 수염이 씰룩, 얼음 판 속에 무언가 비쳐요",
    seed: 707,
    world: { w: 1200, h: 2300 },
    pal: {
      surface: "#eaf8ff",
      water: [
        [0, "#cff2ff"],
        [400, "#92d8f2"],
        [1000, "#58ade0"],
        [1700, "#3080c4"],
        [2300, "#1d5c9e"],
      ],
      snow: "255,255,255",
    },
    light: { rays: 7, reach: 1800, rayA: 0.55, dark: 0, darkFrom: 1700, deepDark: 0.5 },
    hunt: { count: 5, pool: ["frostSquid", "frostSquid", "glassCrab", "glassCrab", "snowSeal"], fixed: true },
    oxygen: 200,
    par: 95,
    music: { bpm: 100, root: 64, scale: "penta", prog: "bright", lead: "bell", drums: "soft", pad: true, seed: 99, density: 0.45 },
    start: { x: 600, y: 170 },
    build(b) {
      // 먼 배경: 빙산 능선 · 고래 그림자
      b.farRidge(-60, 520, 860, 300, 0.08);
      b.farArch(200, 400, 380, 260, 0.1);
      b.farRidge(-80, 720, 920, 320, 0.14);
      b.shadow("whale", 380, 1.0, 14, 0.35, 0.45);
      b.shadow("manta", 700, 0.8, -18, 0.35, 0.4);
      b.midRidge(-80, 860, 960, 420, 0.06, "#cfe8f6");
      b.midRidge(-120, 1240, 1000, 440, 0.1, "#b8dcf0");
      b.midRidge(-60, 1640, 980, 400, 0.14, "#a0cce8");
      // 지형: 얼음 벽 · 눈 바닥
      b.walls({ left: 115, right: 115, amp: 40, color: "#9cc4de" });
      b.bed({ depth: 150, amp: 28, color: "#eaf4f8" });
      const L1 = b.ledge(-1, 660, 420, 100, "#a8cce4");
      const R1 = b.ledge(1, 1000, 440, 104, "#a4c8e2");
      const L2 = b.ledge(-1, 1380, 400, 98, "#a0c4de");
      const R2 = b.ledge(1, 1760, 380, 96, "#9cc0da");

      // 고드름 (지역 기믹): 얼음 턱 아래
      for (const [Lg, ks] of [
        [L1, [0.35, 0.75]],
        [R1, [0.4, 0.8]],
        [L2, [0.3, 0.7]],
        [R2, [0.45, 0.85]],
      ]) {
        for (const k of ks) {
          const x = Lg.wall + (Lg.tip - Lg.wall) * k;
          b.hazard("icicle", x, Lg.bottomAt(x) - 8, { len: 64 + k * 20 });
        }
      }
      // 차가운 물살 (지혁을 오른쪽으로 민다)
      b.hazard("current", 0, 0, { x0: 140, x1: 1060, y0: 1140, y1: 1290, fx: 260, fy: 0, pulse: true });

      // 숨는 곳
      const wl = (y) => b.world.wallL(y);
      const wr = (y) => b.world.wallR(y);
      b.spot("iceblock", 320, b.onBed(320, 4));
      b.spot("iceblock", 860, b.onBed(860, 4), { w: 190, h: 130 });
      b.spot("iceblock", R1.x - 60, R1.topAt(R1.x - 60) + 8, { w: 150, h: 100 });
      b.spot("iceblock", L2.x + 30, L2.topAt(L2.x + 30) + 8, { w: 150, h: 100 });
      b.spot("iceslab", wl(840) + 40, 840, { side: -1 });
      b.spot("iceslab", wr(1180) - 40, 1180, { side: 1 });
      b.spot("iceslab", wl(1580) + 40, 1580, { side: -1 });
      b.spot("iceslab", wr(1960) - 40, 1960, { side: 1 });
      b.spot("icehole", wr(560) - 6, 560, { side: 1 });
      b.spot("icehole", wl(1060) + 6, 1060, { side: -1 });
      b.spot("icehole", wr(1420) - 6, 1420, { side: 1 });
      b.spot("icehole", wl(1860) + 6, 1860, { side: -1 });
      b.spot("icehole", wr(2080) - 6, 2080, { side: 1 });

      // 빛 · 장식
      b.glow("crystal", L1.x - 60, L1.topAt(L1.x - 60) + 8, 1, "#bff4ff");
      b.glow("crystal", R2.x + 40, R2.topAt(R2.x + 40) + 8, 0.9, "#d8f8ff");
      b.glow("crystal", 600, b.onBed(600, 6), 1.1, "#bff4ff");
      for (const x of [200, 520, 1000]) b.weed(x, b.onBed(x, 8), 80, "#6ab89a", 7);
      for (const x of [420, 980]) b.starfish(x, b.onBed(x, 2), 1);
      for (const x of [700, 1080]) b.shell(x, b.onBed(x, 2), 1);
      b.anemone(R1.x + 120, R1.topAt(R1.x + 120) + 10, 0.7, "#ffffff", "#ff9ac8");
      b.school(600, 500, 12, "#ffffff", 0.9);
      b.school(500, 1500, 9, "#d8f0ff", 1);
      b.fgKelp(-40, 1500, 0.9, "#2a5a7a", 0.7);
      b.fgKelp(1400, 1900, 1.0, "#2a5a7a", 0.7);
      b.done();
    },
  },
  {
    id: "s08",
    no: 8,
    name: "심해 협곡",
    en: "DEEP CANYON",
    boss: "kraken",
    tip: "깜깜한 협곡! 떠 있는 빛 중 하나는 아귀의 유인등이에요. 헤드램프로 비춰 보세요",
    seed: 808,
    world: { w: 1100, h: 2800 },
    pal: {
      surface: "#b8e0ee",
      water: [
        [0, "#5aaed0"],
        [320, "#2a6898"],
        [800, "#143a68"],
        [1500, "#0a1e46"],
        [2800, "#030a1e"],
      ],
      snow: "190,220,255",
      darkColor: "1,3,12",
    },
    light: { rays: 3, reach: 650, rayA: 0.3, dark: 0.3, darkFrom: 260, deepDark: 1.6, caustics: false },
    hunt: { count: 5, pool: ["angler", "angler", "gulper", "isopod", "isopod"], fixed: true },
    oxygen: 240,
    par: 135,
    bossSpawn: { x: 550, y: 1900 },
    music: { bpm: 72, root: 45, scale: "minor", prog: "minor", lead: "flute", drums: "none", pad: true, seed: 111, density: 0.35 },
    start: { x: 560, y: 170 },
    build(b) {
      // 먼 배경: 끝없이 깊은 협곡 벽 · 아주 큰 그림자
      b.farRidge(-60, 560, 820, 320, 0.4);
      b.farRidge(-80, 820, 880, 340, 0.5);
      b.shadow("whale", 700, 1.2, 10, 0.35, 0.3);
      b.midRidge(-80, 1000, 940, 480, 0.4, "#20304a");
      b.midRidge(-120, 1500, 980, 480, 0.45, "#18243c");
      b.midRidge(-60, 2000, 960, 460, 0.5, "#101a30");
      // 지형: 좁고 들쭉날쭉한 협곡
      b.walls({ left: 120, right: 120, amp: 62, color: "#3a4458" });
      b.bed({ depth: 160, amp: 36, color: "#4c4a5c" });
      const R1 = b.ledge(1, 720, 380, 100, "#3e475c");
      const L1 = b.ledge(-1, 1080, 400, 104, "#3c4559");
      const R2 = b.ledge(1, 1460, 380, 100, "#3a4356");
      const L2 = b.ledge(-1, 1840, 360, 96, "#384154");
      // 아래로 끌어당기는 물살 (협곡 한가운데)
      b.hazard("current", 0, 0, { x0: 330, x1: 770, y0: 1180, y1: 1400, fx: 0, fy: 170, pulse: true, color: "rgba(160,200,255,0.18)" });
      // 가짜 빛 (유인등 닮은 빛)
      for (const [x, y, c] of [
        [300, 560, "#bfffe0"],
        [820, 960, "#c8d8ff"],
        [420, 1300, "#bfffe0"],
        [760, 1720, "#ffd8f0"],
        [320, 2160, "#bfffe0"],
      ])
        b.hazard("lure", x, y, { color: c, ph: x * 0.01 });
      // 숨는 곳
      const wl = (y) => b.world.wallL(y);
      const wr = (y) => b.world.wallR(y);
      b.spot("abyss", 560, 520);
      b.spot("abyss", 700, 900);
      b.spot("abyss", 380, 1500);
      b.spot("abyss", 620, 2050);
      b.spot("abyss", 820, 2350);
      b.spot("deepnook", wl(780) + 110, 780, { side: -1 });
      b.spot("deepnook", wr(1220) - 110, 1220, { side: 1 });
      b.spot("deepnook", wl(1640) + 110, 1640, { side: -1 });
      b.spot("deepnook", wr(2160) - 110, 2160, { side: 1 });
      b.spot("bones", 330, b.onBed(330, 6), { w: 260 });
      b.spot("bones", 760, b.onBed(760, 6), { w: 220 });
      b.spot("bones", R2.x + 30, R2.topAt(R2.x + 30) + 8, { w: 160 });
      // 빛: 심해 버섯 · 수정
      b.glow("shroom", R1.x + 60, R1.topAt(R1.x + 60) + 8, 1, "#7ff0ff");
      b.glow("crystal", L1.x - 50, L1.topAt(L1.x - 50) + 8, 0.9, "#b58bff");
      b.glow("shroom", L2.x + 40, L2.topAt(L2.x + 40) + 8, 1, "#7dff9a");
      b.glow("crystal", 560, b.onBed(560, 6), 1.1, "#7ff0ff");
      // 장식
      for (const x of [200, 900]) b.coral("tube", x, b.onBed(x, 8), 0.7, "#5a5a8a");
      b.anemone(R1.x - 80, R1.topAt(R1.x - 80) + 10, 0.7, "#c8c8ff", "#7ff0ff");
      b.school(560, 420, 8, "#b8f1ff", 0.8);
      b.fgKelp(-40, 1600, 0.9, "#02060e", 0.92);
      b.fgKelp(1300, 2100, 1.0, "#02060e", 0.92);
      b.done();
    },
  },
  {
    id: "s09",
    no: 9,
    name: "잃어버린 도시",
    en: "LOST CITY",
    boss: "seaSerpent",
    tip: "석상의 눈이 빛나면 진짜예요! 벽의 돌 물고기는 화살을 쏴요. 거울물고기는 그림자로 찾아요",
    seed: 909,
    world: { w: 1500, h: 2300 },
    pal: {
      surface: "#d0f4ee",
      water: [
        [0, "#a0e8e0"],
        [400, "#4ab8c4"],
        [1000, "#2a7c9c"],
        [1600, "#1a4c74"],
        [2300, "#0e2c50"],
      ],
      snow: "220,255,245",
    },
    light: { rays: 6, reach: 1500, rayA: 0.45, dark: 0.04, darkFrom: 1000, deepDark: 1.0 },
    hunt: { count: 5, pool: ["statueGuard", "statueGuard", "nautilus", "nautilus", "mirrorFish"], fixed: true },
    oxygen: 250,
    par: 140,
    bossSpawn: { x: 750, y: 1350 },
    music: { bpm: 90, root: 57, scale: "dorian", prog: "minor", lead: "flute", drums: "island", pad: true, seed: 123, density: 0.45 },
    start: { x: 750, y: 170 },
    build(b) {
      // 먼 배경: 가라앉은 탑 · 돔 실루엣 (능선 · 아치)
      b.farRidge(-60, 560, 1060, 260, 0.2);
      b.farArch(200, 420, 360, 280, 0.24);
      b.farArch(900, 460, 420, 300, 0.26);
      b.farRidge(-80, 780, 1120, 300, 0.3);
      b.shadow("whale", 500, 1.0, 12, 0.35, 0.4);
      b.midRidge(-80, 960, 1240, 440, 0.15, "#5a8a8c");
      b.midRidge(-120, 1400, 1280, 440, 0.2, "#4a7a80");
      // 지형: 유적 벽 · 돌바닥 · 계단 같은 턱
      b.walls({ left: 110, right: 110, amp: 30, color: "#7a8c8e" });
      b.bed({ depth: 150, amp: 16, color: "#c8c0a0" });
      const L1 = b.ledge(-1, 700, 480, 100, "#8a9a9a");
      const R1 = b.ledge(1, 1040, 500, 104, "#869696");
      const L2 = b.ledge(-1, 1420, 460, 100, "#829292");
      const R2 = b.ledge(1, 1780, 440, 96, "#7e8e8e");
      // 뒤쪽 큰 아치 · 기둥 줄
      b.arch(750, 820, 260, 340);
      b.arch(420, b.onBed(420, 4), 220, 280);
      b.column(L1.x + 80, L1.topAt(L1.x + 80) + 8, 200);
      b.column(R1.x - 160, R1.topAt(R1.x - 160) + 8, 180, true);
      b.column(1180, b.onBed(1180, 6), 280);
      b.column(980, b.onBed(980, 6), 220, true);
      b.rubble(300, b.onBed(300, 8), 1);
      b.rubble(R2.x - 60, R2.topAt(R2.x - 60) + 8, 0.8);
      // 고대 함정: 벽의 돌 물고기
      b.hazard("dart", b.world.wallL(880) + 26, 880, { dir: 1, period: 2.8 });
      b.hazard("dart", b.world.wallR(1250) - 26, 1250, { dir: -1, period: 3.0 });
      b.hazard("dart", b.world.wallL(1620) + 26, 1620, { dir: 1, period: 2.6 });
      b.hazard("dart", b.world.wallR(2000) - 26, 2000, { dir: -1, period: 3.2 });
      // 숨는 곳
      b.spot("statue", L1.x - 60, L1.topAt(L1.x - 60) + 6);
      b.spot("statue", R1.x + 20, R1.topAt(R1.x + 20) + 6);
      b.spot("statue", L2.x - 20, L2.topAt(L2.x - 20) + 6);
      b.spot("statue", 640, b.onBed(640, 4));
      b.spot("statue", 1320, b.onBed(1320, 4));
      b.spot("pillar", L2.x + 140, L2.topAt(L2.x + 140) + 8, { h: 220 });
      b.spot("pillar", R2.x - 140, R2.topAt(R2.x - 140) + 8, { h: 200, broken: true });
      b.spot("pillar", 220, b.onBed(220, 6), { h: 300 });
      b.spot("pillar", 860, b.onBed(860, 6), { h: 260, broken: true });
      b.spot("arch", R2.x + 40, R2.topAt(R2.x + 40) + 8, { w: 180, h: 230 });
      b.spot("arch", 1080, 640, { w: 200, h: 240 });
      b.spot("arch", 520, 1300, { w: 200, h: 240 });
      // 빛: 청록 수정 · 등불
      b.glow("crystal", L1.x + 160, L1.topAt(L1.x + 160) + 8, 0.9, "#5ff0d0");
      b.glow("crystal", R2.x + 130, R2.topAt(R2.x + 130) + 8, 1, "#5ff0d0");
      b.glow("crystal", 1040, b.onBed(1040, 6), 1, "#9ff8ff");
      // 장식
      for (const x of [140, 560, 1100, 1400]) b.weed(x, b.onBed(x, 8), 110, "#3a9a7a", 8);
      b.coral("fan", 760, b.onBed(760, 8), 0.8, "#ff9ab0");
      b.coral("brain", R1.x + 140, R1.topAt(R1.x + 140) + 10, 0.7, "#c9b45a");
      b.anemone(1240, b.onBed(1240, 6), 0.8, "#5ff0d0");
      b.school(750, 520, 12, "#ffd23f", 1);
      b.school(600, 1700, 9, "#b8f1ff", 1);
      b.fgKelp(-40, 1500, 0.9, "#0a3a3a");
      b.fgKelp(1700, 1900, 1.0, "#0a3a3a");
      b.done();
    },
  },
  {
    id: "s10",
    no: 10,
    name: "괴물의 둥지",
    en: "MONSTER NEST",
    boss: "octoKing",
    tip: "둥지의 알 하나가 흔들흔들! 하나가 깨면 근처 알도 줄줄이 깨어나요. 여러 바다의 괴물이 다 모였어요",
    seed: 1010,
    world: { w: 1300, h: 2200 },
    pal: {
      surface: "#d8eef8",
      water: [
        [0, "#c0e4f4"],
        [400, "#86b0e0"],
        [900, "#6a74c0"],
        [1500, "#503c8c"],
        [2200, "#2c1a5a"],
      ],
      snow: "255,220,240",
    },
    light: { rays: 5, reach: 1300, rayA: 0.42, dark: 0.05, darkFrom: 1000, deepDark: 1.0 },
    hunt: { count: 7, must: ["eggling", "eggling", "eggling"], pool: ["eggling", "eggling", "eggling", "coralOcto", "puffer", "kelpShark", "seahorse", "jellyMonster", "urchin", "jellyTwins"] },
    oxygen: 270,
    par: 150,
    bossSpawn: { x: 650, y: 1850 },
    music: { bpm: 108, root: 55, scale: "minor", prog: "island", lead: "marimba", drums: "island", pad: true, seed: 131, density: 0.5 },
    start: { x: 650, y: 170 },
    build(b) {
      b.farRidge(-60, 540, 960, 260, 0.2);
      b.farArch(680, 420, 400, 280, 0.24);
      b.farRidge(-80, 760, 1020, 300, 0.28);
      b.shadow("manta", 420, 1.1, 18, 0.35, 0.45);
      b.shadow("whale", 700, 0.9, -12, 0.35, 0.4);
      b.midRidge(-80, 900, 1100, 440, 0.15, "#8a5a9a");
      b.midRidge(-120, 1320, 1160, 440, 0.2, "#7a4a8a");
      b.midRidge(-60, 1700, 1140, 400, 0.25, "#6a3a7a");
      b.walls({ left: 115, right: 115, amp: 44, color: "#7a4a7a" });
      b.bed({ depth: 160, amp: 22, color: "#dcb4cc" });
      const L1 = b.ledge(-1, 640, 440, 100, "#83558a");
      const R1 = b.ledge(1, 980, 460, 104, "#7e5086");
      const L2 = b.ledge(-1, 1340, 420, 100, "#7a4c82");
      const R2 = b.ledge(1, 1660, 400, 96, "#764880");
      // 알 둥지 (턱 위 · 바닥)
      b.spot("egg", L1.x - 40, L1.topAt(L1.x - 40) + 6);
      b.spot("egg", L1.x + 120, L1.topAt(L1.x + 120) + 6);
      b.spot("egg", R1.x + 40, R1.topAt(R1.x + 40) + 6);
      b.spot("egg", L2.x + 20, L2.topAt(L2.x + 20) + 6);
      b.spot("egg", R2.x - 30, R2.topAt(R2.x - 30) + 6);
      b.spot("egg", 420, b.onBed(420, 4));
      b.spot("egg", 900, b.onBed(900, 4));
      // 여러 바다의 숨는 곳
      b.spot("coral", R1.x - 130, R1.topAt(R1.x - 130) + 8, { colors: ["#ff7aa2", "#ffd166", "#b066ff"] });
      b.spot("coral", 220, b.onBed(220), { colors: ["#ff9b6a", "#b066ff", "#5fd3a8"] });
      b.spot("coral", 1120, b.onBed(1120), { colors: ["#ff7aa2", "#3fd3ff", "#ffb347"] });
      b.spot("kelp", 640, b.onBed(640, 6));
      b.spot("kelp", L2.x - 90, L2.topAt(L2.x - 90) + 6);
      b.spot("kelpTall", R2.x + 80, R2.topAt(R2.x + 80) + 8, { h: 240 });
      b.spot("kelpTall", 330, b.onBed(330, 8), { h: 300 });
      b.spot("jellies", 760, 760);
      b.spot("jellies", 520, 1480);
      b.spot("sand", 760, b.onBed(760, 2));
      b.spot("sand", 1000, b.onBed(1000, 2));
      b.spot("sand", L1.x + 30, L1.topAt(L1.x + 30) + 4);
      // 빛 · 장식
      b.glow("shroom", R1.x + 120, R1.topAt(R1.x + 120) + 8, 1, "#ff8ad0");
      b.glow("crystal", L2.x + 150, L2.topAt(L2.x + 150) + 8, 0.9, "#c58bff");
      b.glow("shroom", 560, b.onBed(560, 6), 1, "#7dff9a");
      for (const x of [140, 480, 1200]) b.weed(x, b.onBed(x, 8), 100, "#5aa86a", 8);
      b.anemone(1000, b.onBed(1000, 6) - 2, 0.8, "#ff6f91");
      b.coral("fan", L1.x - 140, L1.topAt(L1.x - 140) + 10, 0.8, "#b066ff");
      b.jelly(1000, 1200, 1.1, "#ffc8e8");
      b.jelly(300, 1050, 0.9);
      b.school(650, 520, 10, "#ffd0f2", 1);
      b.fgKelp(-40, 1500, 0.9, "#2a0a3a");
      b.fgKelp(1500, 1900, 1.0, "#2a0a3a");
      b.done();
    },
  },
  {
    id: "s11",
    no: 11,
    name: "심해 폭풍",
    en: "DEEP STORM",
    tip: "물살이 거세요! 소용돌이에 휘말리지 않게 조심하고, 등 뒤를 자주 돌아보세요",
    seed: 1111,
    world: { w: 1300, h: 2400 },
    pal: {
      surface: "#c8dcd8",
      water: [
        [0, "#a8d4c8"],
        [400, "#6aa49c"],
        [1000, "#3a7082"],
        [1700, "#264862"],
        [2400, "#162a46"],
      ],
      snow: "235,225,195",
    },
    light: { rays: 4, reach: 1100, rayA: 0.32, dark: 0.07, darkFrom: 800, deepDark: 1.2, caustics: false },
    hunt: { count: 5, pool: ["whirlFish", "whirlFish", "stormRay", "kelpShark", "urchin"], fixed: true },
    oxygen: 240,
    par: 120,
    music: { bpm: 116, root: 52, scale: "minor", prog: "minor", lead: "steel", drums: "storm", pad: true, seed: 141, density: 0.55 },
    start: { x: 650, y: 170 },
    build(b) {
      b.farRidge(-60, 560, 960, 280, 0.25);
      b.farRidge(-80, 780, 1020, 300, 0.32);
      b.shadow("manta", 500, 1.2, 40, 0.35, 0.4);
      b.shadow("whale", 760, 0.9, -30, 0.35, 0.35);
      b.midRidge(-80, 960, 1100, 440, 0.22, "#4a7a7a");
      b.midRidge(-120, 1400, 1160, 440, 0.28, "#3a6a6a");
      b.midRidge(-60, 1800, 1140, 420, 0.32, "#2a5a5a");
      b.walls({ left: 110, right: 110, amp: 52, color: "#5a7270" });
      b.bed({ depth: 170, amp: 40, color: "#c8b890" });
      const L1 = b.ledge(-1, 700, 400, 100, "#607a78");
      const R1 = b.ledge(1, 1100, 420, 104, "#5c7674");
      const L2 = b.ledge(-1, 1500, 400, 100, "#587270");
      const R2 = b.ledge(1, 1880, 380, 96, "#546e6c");
      // 거센 물살 (번갈아 반대로) · 소용돌이
      b.hazard("current", 0, 0, { x0: 120, x1: 1180, y0: 860, y1: 980, fx: 380, fy: 0, pulse: true });
      b.hazard("current", 0, 0, { x0: 120, x1: 1180, y0: 1260, y1: 1380, fx: -380, fy: 0, pulse: true });
      b.hazard("current", 0, 0, { x0: 120, x1: 1180, y0: 1640, y1: 1760, fx: 340, fy: 60, pulse: true });
      b.hazard("whirl", 820, 560, { r: 170, dir: 1 });
      b.hazard("whirl", 420, 1180, { r: 160, dir: -1 });
      b.hazard("whirl", 900, 1560, { r: 180, dir: 1 });
      b.hazard("whirl", 520, 2060, { r: 170, dir: -1 });
      // 숨는 곳
      b.spot("eddy", 560, 760);
      b.spot("eddy", 980, 1200);
      b.spot("eddy", 360, 1420);
      b.spot("eddy", 760, 1980);
      b.spot("sandbed", 420, b.onBed(420, 2));
      b.spot("sandbed", 880, b.onBed(880, 2));
      b.spot("kelp", L1.x - 30, L1.topAt(L1.x - 30) + 6);
      b.spot("kelp", R2.x + 40, R2.topAt(R2.x + 40) + 6);
      b.spot("kelp", 1120, b.onBed(1120, 6));
      b.spot("sand", 220, b.onBed(220, 2));
      b.spot("sand", 660, b.onBed(660, 2));
      b.spot("sand", R1.x - 60, R1.topAt(R1.x - 60) + 4);
      // 장식: 휘어진 해초 · 바위
      for (const x of [160, 520, 760, 1000]) b.weed(x, b.onBed(x, 8), 120, "#5a9a6a", 8);
      b.rock(980, b.onBed(980, 10), 1, "#5a7270");
      b.rock(L2.x + 120, L2.topAt(L2.x + 120) + 14, 0.8, "#587270");
      b.coral("fan", R1.x + 130, R1.topAt(R1.x + 130) + 10, 0.8, "#c9b45a");
      b.glow("crystal", L2.x - 60, L2.topAt(L2.x - 60) + 8, 0.9, "#9ff8ff");
      b.school(650, 500, 12, "#e8f0d0", 1.1);
      b.school(500, 1600, 10, "#b8f1ff", 1);
      b.fgKelp(-40, 1500, 1.0, "#0a2a2a");
      b.fgKelp(1500, 1900, 1.1, "#0a2a2a");
      b.fgKelp(500, 2700, 1.0, "#0a2a2a");
      b.done();
    },
  },
  {
    id: "s12",
    no: 12,
    name: "어비스",
    en: "THE ABYSS",
    boss: "abyssal",
    tip: "가장 깊은 바다! 떠 있는 빛을 조심하고, 헤드램프로 어둠을 비춰요. 바닥 깊은 곳에 무언가 잠들어 있어요…",
    seed: 1212,
    world: { w: 1200, h: 2900 },
    pal: {
      surface: "#a8d0e8",
      water: [
        [0, "#4a98c8"],
        [300, "#1e5488"],
        [800, "#0e2a58"],
        [1500, "#070f30"],
        [2900, "#020410"],
      ],
      snow: "170,200,255",
      darkColor: "0,1,6",
    },
    light: { rays: 3, reach: 500, rayA: 0.28, dark: 0.38, darkFrom: 150, deepDark: 1.7, caustics: false },
    hunt: { count: 6, pool: ["abyssLantern", "abyssLantern", "angler", "caveFish", "shadeRay", "isopod"], fixed: true },
    oxygen: 300,
    par: 180,
    bossSpawn: { x: 600, y: 2500 },
    music: { bpm: 66, root: 43, scale: "minor", prog: "minor", lead: "flute", drums: "none", pad: true, seed: 151, density: 0.3 },
    start: { x: 600, y: 170 },
    build(b) {
      b.farRidge(-60, 600, 860, 340, 0.5);
      b.farRidge(-80, 880, 920, 360, 0.6);
      b.shadow("whale", 800, 1.6, 8, 0.35, 0.25);
      b.midRidge(-80, 1100, 1040, 480, 0.5, "#141a34");
      b.midRidge(-120, 1600, 1080, 480, 0.55, "#0e1428");
      b.midRidge(-60, 2100, 1060, 460, 0.6, "#0a0e1e");
      b.walls({ left: 120, right: 120, amp: 58, color: "#262a44" });
      b.bed({ depth: 170, amp: 30, color: "#34324a" });
      const R1 = b.ledge(1, 760, 380, 100, "#2c3048");
      const L1 = b.ledge(-1, 1140, 400, 104, "#2a2e46");
      const R2 = b.ledge(1, 1540, 380, 100, "#282c44");
      const L2 = b.ledge(-1, 1920, 360, 96, "#262a42");
      // 가짜 빛 (따뜻한 등불 닮은 빛) — 진짜 심연등불은 빛 속 눈이 깜빡인다
      for (const [x, y] of [
        [320, 520],
        [840, 1000],
        [420, 1420],
        [800, 1800],
        [360, 2240],
        [880, 2380],
      ])
        b.hazard("lure", x, y, { color: "#ffd88a", ph: x * 0.013 });
      // 숨는 곳
      const wl = (y) => b.world.wallL(y);
      const wr = (y) => b.world.wallR(y);
      b.spot("lantern", 640, 700);
      b.spot("lantern", 300, 1180);
      b.spot("lantern", 880, 1560);
      b.spot("lantern", 520, 1980);
      b.spot("lantern", 760, 2240);
      b.spot("abyss", 560, 900);
      b.spot("abyss", 700, 1700);
      b.spot("abyss", 420, 2100);
      b.spot("nook", wr(980) - 10, 980);
      b.spot("nook", wl(1360) + 10, 1360);
      b.spot("nook", wr(1760) - 10, 1760);
      b.spot("dark", 380, 1600);
      b.spot("dark", 820, 2050);
      b.spot("bones", 400, b.onBed(400, 6), { w: 280 });
      b.spot("bones", R2.x + 30, R2.topAt(R2.x + 30) + 8, { w: 160 });
      // 빛: 심해 버섯 · 수정 (아주 드물게)
      b.glow("shroom", R1.x + 60, R1.topAt(R1.x + 60) + 8, 1, "#7ff0ff");
      b.glow("crystal", L1.x - 50, L1.topAt(L1.x - 50) + 8, 0.9, "#c58bff");
      b.glow("shroom", L2.x + 40, L2.topAt(L2.x + 40) + 8, 1, "#7dff9a");
      b.glow("crystal", 820, b.onBed(820, 6), 1.2, "#5ff0ff");
      b.glow("shroom", 220, b.onBed(220, 6), 1, "#c58bff");
      b.coral("tube", 1000, b.onBed(1000, 8), 0.7, "#3a3a6a");
      b.school(600, 420, 8, "#b8f1ff", 0.8);
      b.fgKelp(-40, 1700, 0.9, "#010208", 0.95);
      b.fgKelp(1400, 2200, 1.0, "#010208", 0.95);
      b.done();
    },
  },
];
