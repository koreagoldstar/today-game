"use strict";

const CACHE_PREFIX = "today-game-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-v59`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v59`;
// 방문자 기기에 쌓아 두는 파일 수 상한 (넘으면 오래된 것부터 지움)
const RUNTIME_MAX = 150;
// 음악 · 영상은 크고 브라우저가 따로 잘 기억하니 여기 담지 않음
const NO_STORE = /\.(mp3|ogg|wav|m4a|mp4|webm)$/i;
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/css/style.css?v=22",
  "/js/main.js?v=42",
  "/js/pwa.js?v=2",
  "/assets/pwa-icon-192.png",
  "/assets/pwa-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
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
  if (response.status !== 200 || NO_STORE.test(new URL(request.url).pathname)) return;
  const copy = response.clone();
  caches
    .open(RUNTIME_CACHE)
    .then((cache) => cache.put(request, copy))
    .then(trim)
    .catch(() => {});
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  // 음악 · 영상(부분 요청)은 손대지 않고 브라우저에 맡김
  if (NO_STORE.test(url.pathname) || request.headers.has("range")) return;

  if (request.mode === "navigate") {
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

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          store(request, response);
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
