(() => {
  "use strict";

  const installButton = document.getElementById("pwa-install");
  const installHint = document.getElementById("pwa-install-hint");
  let deferredPrompt = null;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  function hideInstall() {
    if (installButton) installButton.hidden = true;
    if (installHint) installHint.hidden = true;
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* The website remains fully usable without offline support. */
      });
    });
  }

  if (!installButton || isStandalone) {
    hideInstall();
    return;
  }

  installButton.hidden = false;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice.outcome === "accepted") hideInstall();
      return;
    }

    if (!installHint) return;
    installHint.hidden = false;
    installHint.textContent = isIos
      ? "Safari의 공유 버튼(□↑)을 누른 뒤 ‘홈 화면에 추가’를 선택하세요."
      : "브라우저 메뉴(⋮)에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.";
  });

  window.addEventListener("appinstalled", hideInstall);
})();
