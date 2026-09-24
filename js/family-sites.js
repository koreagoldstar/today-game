/* 관련 사이트 — 오늘의 게임 ↔ 오늘의 홈페이지를 오른쪽 아래에서 바로 오간다.
   바닥글(.foot)이 있으면 그 안에 붙고, 없으면 오른쪽 아래에 떠 있다. 게임 화면에는 넣지 않는다. */
(function () {
  var SITES = [
    { name: "오늘의 게임", desc: "귀여운 미니게임 모음", url: "https://www.todaygame.co.kr/", host: "todaygame.co.kr", icon: "🎮" },
    { name: "오늘의 홈페이지", desc: "AI가 만들어 주는 가게 홈페이지", url: "https://today-homepage.com/", host: "today-homepage.com", icon: "🏠" }
  ];
  var here = location.hostname.replace(/^www\./, "");
  var others = SITES.filter(function (s) { return s.host !== here; });
  if (!others.length || document.querySelector(".fam")) return;

  var css =
    ".fam{position:relative;display:inline-block;font:600 12px/1.2 Pretendard,system-ui,sans-serif;z-index:60}" +
    ".fam.float{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom))}" +
    ".fam summary{list-style:none;cursor:pointer;padding:6px 11px;border-radius:999px;background:rgba(255,255,255,.8);" +
    "backdrop-filter:blur(8px);box-shadow:0 2px 10px rgba(0,0,0,.1);color:#333;white-space:nowrap}" +
    ".fam summary::-webkit-details-marker{display:none}" +
    ".fam summary::after{content:' ▴';opacity:.6}" +
    ".fam[open] summary::after{content:' ▾'}" +
    ".fam .fam-list{position:absolute;right:0;bottom:calc(100% + 8px);min-width:210px;background:#fff;border-radius:14px;" +
    "box-shadow:0 10px 30px rgba(0,0,0,.18);padding:6px;text-align:left}" +
    ".fam a{display:flex;gap:10px;align-items:center;padding:10px;border-radius:10px;text-decoration:none;color:#222}" +
    ".fam a:hover{background:#f3f4f7}" +
    ".fam a b{display:block;font-size:14px}.fam a small{display:block;color:#888;font-weight:500;margin-top:2px}" +
    ".fam .ic{font-size:20px}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var box = document.createElement("details");
  box.className = "fam";
  box.innerHTML =
    "<summary>관련 사이트</summary><div class=\"fam-list\">" +
    others.map(function (s) {
      return '<a href="' + s.url + '" target="_blank" rel="noopener"><span class="ic" aria-hidden="true">' + s.icon +
        "</span><span><b>" + s.name + "</b><small>" + s.desc + "</small></span></a>";
    }).join("") + "</div>";

  var foot = document.querySelector(".foot");
  if (foot) {
    box.style.marginTop = "4px";
    foot.appendChild(box);
  } else {
    box.classList.add("float");
    document.body.appendChild(box);
  }
  document.addEventListener("click", function (e) {
    if (box.open && !box.contains(e.target)) box.open = false;
  });
})();
