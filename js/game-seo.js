/**
 * Game intro copy stays on the title/start overlay only.
 * During play it must not sit beside the stage and shrink the canvas.
 */
(() => {
  "use strict";

  const about = document.querySelector(".seo-about");
  if (!about) return;

  const title = document.getElementById("title");
  if (!title) return;

  title.appendChild(about);
})();
