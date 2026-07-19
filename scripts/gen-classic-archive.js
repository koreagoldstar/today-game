const fs = require("fs");
const path = require("path");

const games = [
  {
    id: "prince",
    title: "프린스 오브 페르시아",
    tagline: "60분 안에 공주를 구하라",
    desc: "이 사이트에서는 게임을 직접 제공하지 않습니다.<br />Internet Archive(보존용)로 이동해서 플레이하세요.",
    bgm: "prince",
    thumb: "/assets/thumbs/prince.png",
    links: [
      { label: "프린스 오브 페르시아 플레이", href: "https://archive.org/details/PERSIA_VGA" },
      {
        label: "프린스 오브 페르시아 2",
        href: "https://archive.org/details/msdos_Prince_of_Persia_2_-_The_Shadow__The_Flame_1993",
        secondary: true,
      },
    ],
    help: [
      ["← →", "이동"],
      ["↑", "점프 / 올라가기"],
      ["↓", "조심히 내려가기"],
      ["Shift", "검 꺼내기 / 방어"],
    ],
  },
  {
    id: "lemmings",
    title: "레밍즈",
    tagline: "한 마리도 포기하지 마",
    desc: "이 사이트에서는 게임을 직접 제공하지 않습니다.<br />Internet Archive(보존용)로 이동해서 플레이하세요.",
    bgm: "lemmings",
    thumb: "/assets/thumbs/lemmings.png",
    links: [
      { label: "레밍즈 플레이", href: "https://archive.org/details/msdos_Lemmings_1991" },
      {
        label: "Oh No! More Lemmings",
        href: "https://archive.org/details/msdos_Oh_No_More_Lemmings_1992",
        secondary: true,
      },
    ],
    help: [
      ["마우스", "레밍 지정"],
      ["1~8", "기술 선택"],
      ["스페이스", "일시정지"],
      ["F1", "핵폭발(리셋)"],
    ],
  },
  {
    id: "bubble-bobble",
    title: "보글보글",
    tagline: "거품으로 잡아 터뜨려요",
    desc: "이 사이트에서는 게임을 직접 제공하지 않습니다.<br />Internet Archive Internet Arcade로 이동해서 플레이하세요.",
    bgm: "bubble-bobble",
    thumb: "/assets/thumbs/bubble-bobble.png",
    links: [
      { label: "보글보글 플레이", href: "https://archive.org/details/bublbobl" },
    ],
    help: [
      ["← →", "이동"],
      ["점프", "점프"],
      ["공격", "거품 발사"],
      ["2인", "동시 플레이 가능(원작)"],
    ],
  },
  {
    id: "pacman-classic",
    title: "팩맨",
    tagline: "알을 먹고 유령을 피해요",
    desc: "이 사이트에서는 게임을 직접 제공하지 않습니다.<br />Internet Archive Internet Arcade로 이동해서 플레이하세요.",
    bgm: "pacman-classic",
    thumb: "/assets/thumbs/pacman-classic.png",
    links: [
      { label: "팩맨 플레이", href: "https://archive.org/details/pacmanbla" },
      { label: "미즈 팩맨", href: "https://archive.org/details/mspacman_nes_3", secondary: true },
    ],
    help: [
      ["← → ↑ ↓", "이동"],
      ["파워알", "유령 역관광"],
      ["과일", "보너스 점수"],
    ],
  },
  {
    id: "galaga",
    title: "갤러그",
    tagline: "편대 공격에 맞서는 슈팅",
    desc: "이 사이트에서는 게임을 직접 제공하지 않습니다.<br />Internet Archive Internet Arcade로 이동해서 플레이하세요.",
    bgm: "galaga",
    thumb: "/assets/thumbs/galaga.png",
    links: [
      { label: "갤러그 플레이", href: "https://archive.org/details/galaga_nes_2" },
      { label: "갤럭시안", href: "https://archive.org/details/galaxian_mame", secondary: true },
    ],
    help: [
      ["← →", "이동"],
      ["발사", "미사일"],
      ["듀얼파이터", "납치 기체 구출 시"],
    ],
  },
  {
    id: "lode-runner",
    title: "로드러너",
    tagline: "금을 모으고 함정을 파요",
    desc: "이 사이트에서는 게임을 직접 제공하지 않습니다.<br />Internet Archive(보존용)로 이동해서 플레이하세요.",
    bgm: "lode-runner",
    thumb: "/assets/thumbs/lode-runner.png",
    links: [
      { label: "로드러너 플레이", href: "https://archive.org/details/msdos_Lode_Runner_1983" },
      {
        label: "Legend Returns",
        href: "https://archive.org/details/msdos_Lode_Runner_-_The_Legend_Returns_1994",
        secondary: true,
      },
    ],
    help: [
      ["← →", "이동"],
      ["↑ ↓", "사다리"],
      ["Z / X", "왼쪽·오른쪽 땅 파기"],
      ["금 전부", "탈출구 등장"],
    ],
  },
  {
    id: "donkey-kong",
    title: "동키콩",
    tagline: "통을 피하며 꼭대기로",
    desc: "이 사이트에서는 게임을 직접 제공하지 않습니다.<br />Internet Archive(보존용)로 이동해서 플레이하세요.",
    bgm: "donkey-kong",
    thumb: "/assets/thumbs/donkey-kong.png",
    links: [
      { label: "동키콩 플레이", href: "https://archive.org/details/a8b_Donkey_Kong_1983_Atari_US_a_k_file" },
      { label: "C64 판", href: "https://archive.org/details/Donkey_Kong_1986_Ocean", secondary: true },
    ],
    help: [
      ["1", "Archive 페이지에서 검은 게임 화면을 클릭"],
      ["2", "로딩이 끝나면 키보드로 조작"],
      ["← →", "이동 · ↑ ↓ 사다리"],
      ["스페이스 / Ctrl", "점프 (기종에 따라 다름)"],
    ],
  },
];

function page(g) {
  const links = g.links
    .map(
      (l) =>
        `          <a class="btn${l.secondary ? " btn-secondary" : ""}" href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label}</a>`
    )
    .join("\n");
  const helps = g.help.map(([k, v]) => `            <li><b>${k}</b> ${v}</li>`).join("\n");
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#14101c" />
    <title>${g.title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Jua&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/css/classic-archive.css" />
  </head>
  <body data-bgm="${g.bgm}">
    <div class="shell">
      <header class="top">
        <a class="back" href="/">← 오늘의 게임</a>
        <div class="titles">
          <h1>${g.title}</h1>
          <p>${g.tagline}</p>
        </div>
      </header>
      <section class="card">
        <img class="hero" src="${g.thumb}" alt="" width="200" height="200" />
        <p class="desc">${g.desc}</p>
        <div class="actions">
${links}
        </div>
        <div class="help">
          <h2>조작 (원작)</h2>
          <ul>
${helps}
          </ul>
          <p class="note">Archive.org 페이지에서 화면을 클릭한 뒤 키보드로 조작하세요. 모바일은 화면 아래 가상 키가 뜰 수 있어요.</p>
        </div>
      </section>
    </div>
    <script src="/js/bgm.js"></script>
  </body>
</html>
`;
}

for (const g of games) {
  const dir = path.join("games", g.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page(g));
  console.log("wrote", g.id);
}
