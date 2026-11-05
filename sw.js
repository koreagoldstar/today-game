"use strict";

const CACHE_PREFIX = "today-game-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-v74`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v74`;
// 방문자 기기에 쌓아 두는 파일 수 상한 (넘으면 오래된 것부터 지움)
const RUNTIME_MAX = 150;
// 음악 · 영상은 크고 브라우저가 따로 잘 기억하니 여기 담지 않음
const NO_STORE = /\.(mp3|ogg|wav|m4a|mp4|webm)$/i;
// 홈 화면을 그리는 데 필요한 파일. 미리 받아 두어 느린 인터넷에서도 홈이 바로 뜨게 한다.
// index.html 의 ?v= 를 바꾸면 여기도 같이 바꾼다 (scripts/test-home-buttons.js 가 어긋나면 알려 준다).
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Jua&family=Noto+Sans+KR:wght@500;700;900&display=swap";
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/css/style.css?v=25",
  "/css/game-chrome.css?v=5",
  "/js/today-audio.js?v=2",
  "/js/game-chrome.js?v=5",
  "/js/bgm.js?v=6",
  "/js/scores.js?v=7",
  "/js/rankable.js?v=10",
  "/js/retention.js?v=2",
  "/js/edu-progress.js?v=5",
  "/js/edu-speech.js?v=11",
  "/js/game-rank.js?v=2",
  "/js/my-face.js?v=3",
  "/js/main.js?v=57",
  "/js/record-cards.js?v=1",
  "/js/pwa.js?v=2",
  "/assets/pwa-icon-192.png",
  "/assets/pwa-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      await saveFontCss(cache, FONT_CSS).catch(() => {}); // 글꼴은 못 받아도 설치는 계속한다
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

let trimming = false;
/** 담아 둔 파일이 상한을 넘으면 오래된 것부터 지움 (한 번에 하나만 돌림) */
async function trim() {
  if (trimming) return;
  trimming = true;
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - RUNTIME_MAX; i++) await cache.delete(keys[i]);
  } catch (_) {
    /* 저장 공간 오류는 무시 (다음 번에 다시) */
  }
  trimming = false;
}
function store(request, response) {
  // 온전한 응답(200)만 · 음악 · 영상 · 일부 응답(206)은 빼고
  if (response.status !== 200 || NO_STORE.test(new URL(request.url).pathname)) return Promise.resolve();
  const copy = response.clone();
  return caches
    .open(RUNTIME_CACHE)
    .then((cache) => cache.put(request, copy))
    .then(trim)
    .catch(() => {});
}

/**
 * 홈 화면: 저장본을 바로 주고 뒤에서 새로 받아 둔다.
 * 홈은 SHELL_CACHE 의 "/" 한 곳에만 둔다. caches.match 는 먼저 만든 저장소부터 찾으므로
 * 다른 저장소에 넣으면 새 화면을 받아도 계속 옛 화면이 나온다.
 */
async function serveHome(event) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match("/");
  const network = fetch(event.request).then(async (response) => {
    if (response.status === 200 && !response.redirected) await cache.put("/", response.clone());
    return response;
  });
  if (cached && !cached.redirected) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  try {
    return await network;
  } catch (_) {
    return (await caches.match("/offline.html")) || Response.error();
  }
}

/**
 * 구글 글꼴 CSS: 화면 그리기를 막는 파일이라 하루가 지나 다시 받을 때 느린 인터넷에서 홈이 늦게 뜬다.
 * 저장본을 바로 주고 뒤에서 새로 받아 둔다. 글꼴 파일 자체는 브라우저가 오래 기억하니 건드리지 않는다.
 * 저장본이 없을 때는 페이지의 원래 요청을 그대로 보낸다. 저장용 요청은 브라우저 저장본을 못 써서
 * 그것을 기다리면 화면이 오히려 늦어진다 (배포 직후 첫 방문이 왕복 1.5초 망에서 3.8초 걸렸다).
 */
function saveFontCss(cache, key) {
  return fetch(key, { mode: "cors", credentials: "omit" }).then((response) => {
    if (response.status === 200) return cache.put(key, response);
    return undefined;
  });
}
async function serveFontCss(event) {
  const cache = await caches.open(SHELL_CACHE);
  const key = event.request.url;
  const cached = await cache.match(key);
  event.waitUntil(saveFontCss(cache, key).catch(() => {}));
  return cached || fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin === "https://fonts.googleapis.com") {
    event.respondWith(serveFontCss(event));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  // 음악 · 영상(부분 요청)은 손대지 않고 브라우저에 맡김
  if (NO_STORE.test(url.pathname) || request.headers.has("range")) return;

  if (request.mode === "navigate") {
    // 홈으로 갈 때는 저장해 둔 화면을 바로 보여 주고 뒤에서 새로 받아 둔다.
    // 새로고침은 최신을 원하는 것이니 (request.cache) 아래의 원래 길로 보낸다.
    const toHome = (url.pathname === "/" || url.pathname === "/index.html") && !url.search;
    if (toHome && request.cache !== "reload" && request.cache !== "no-cache" && request.cache !== "no-store") {
      event.respondWith(serveHome(event));
      return;
    }
    event.respondWith(
      fetch(request)
        .then((response) => {
          store(request, response);
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match("/offline.html"))
    );
    return;
  }

  // 뒤에서 받아 저장하는 일은 페이지를 떠나도 끝까지 하게 한다 (끊기면 다음 방문도 느리다)
  const network = fetch(request);
  event.waitUntil(network.then((response) => store(request, response)).catch(() => {}));
  event.respondWith(caches.match(request).then((cached) => cached || network));
});
