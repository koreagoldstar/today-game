"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIRS = [
  path.join(ROOT, "assets", "edu"),
  path.join(ROOT, "edu-svg-assets", "edu-svg"),
];

const FILES = {
  "edu_tree.svg": `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="88" y="120" width="24" height="50" rx="8" fill="#C98A3E" stroke="#4A3728" stroke-width="4"/>
  <circle cx="70" cy="90" r="34" fill="#8FD68A" stroke="#4A3728" stroke-width="4"/>
  <circle cx="115" cy="75" r="38" fill="#A8E6A1" stroke="#4A3728" stroke-width="4"/>
  <circle cx="140" cy="105" r="30" fill="#8FD68A" stroke="#4A3728" stroke-width="4"/>
  <circle cx="95" cy="70" r="5" fill="#FF8FA3" opacity="0.7"/>
  <circle cx="125" cy="60" r="5" fill="#FF8FA3" opacity="0.7"/>
  <circle cx="140" cy="95" r="5" fill="#FF8FA3" opacity="0.7"/>
</svg>
`,
  "edu_shoes.svg": `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <path d="M25 130 Q25 105 50 100 L80 100 Q95 100 100 115 L100 140 Q100 150 90 150 L35 150 Q25 150 25 140 Z" fill="#A8D8F0" stroke="#4A3728" stroke-width="4" stroke-linejoin="round"/>
  <path d="M50 100 Q55 90 65 92 L82 98" fill="none" stroke="#4A3728" stroke-width="3"/>
  <circle cx="60" cy="120" r="3" fill="#4A3728"/>
  <circle cx="72" cy="120" r="3" fill="#4A3728"/>
  <path d="M100 130 Q100 105 125 100 L155 100 Q170 100 175 115 L175 140 Q175 150 165 150 L110 150 Q100 150 100 140 Z" fill="#FFB6C1" stroke="#4A3728" stroke-width="4" stroke-linejoin="round"/>
  <path d="M125 100 Q130 90 140 92 L157 98" fill="none" stroke="#4A3728" stroke-width="3"/>
  <circle cx="135" cy="120" r="3" fill="#4A3728"/>
  <circle cx="147" cy="120" r="3" fill="#4A3728"/>
</svg>
`,
  "edu_backpack.svg": `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <path d="M55 90 Q55 55 100 55 Q145 55 145 90 L145 150 Q145 165 130 165 L70 165 Q55 165 55 150 Z" fill="#FFB870" stroke="#4A3728" stroke-width="4" stroke-linejoin="round"/>
  <path d="M75 55 Q75 35 100 35 Q125 35 125 55" fill="none" stroke="#4A3728" stroke-width="6"/>
  <rect x="80" y="95" width="40" height="35" rx="8" fill="#FFDBA8" stroke="#4A3728" stroke-width="3.5"/>
  <circle cx="100" cy="112" r="4" fill="#C98A3E"/>
  <rect x="65" y="90" width="14" height="45" rx="6" fill="#FF9F45" stroke="#4A3728" stroke-width="3"/>
</svg>
`,
  "edu_pencil.svg": `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="85" y="55" width="30" height="110" fill="#FFD966" stroke="#4A3728" stroke-width="4"/>
  <path d="M85 55 L100 25 L115 55 Z" fill="#F0C08A" stroke="#4A3728" stroke-width="4" stroke-linejoin="round"/>
  <path d="M92 55 L100 38 L108 55 Z" fill="#4A3728"/>
  <rect x="85" y="150" width="30" height="15" fill="#FF9EBB" stroke="#4A3728" stroke-width="3"/>
  <rect x="85" y="165" width="30" height="10" fill="#C6C6C6" stroke="#4A3728" stroke-width="3"/>
  <line x1="85" y1="80" x2="115" y2="80" stroke="#E8B84A" stroke-width="2"/>
</svg>
`,
  "edu_clock.svg": `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="105" r="55" fill="#FFF6E8" stroke="#4A3728" stroke-width="5"/>
  <circle cx="100" cy="60" r="4" fill="#4A3728"/>
  <circle cx="100" cy="150" r="4" fill="#4A3728"/>
  <circle cx="55" cy="105" r="4" fill="#4A3728"/>
  <circle cx="145" cy="105" r="4" fill="#4A3728"/>
  <line x1="100" y1="105" x2="100" y2="75" stroke="#4A3728" stroke-width="5" stroke-linecap="round"/>
  <line x1="100" y1="105" x2="122" y2="115" stroke="#4A3728" stroke-width="5" stroke-linecap="round"/>
  <circle cx="100" cy="105" r="6" fill="#FF8FA3" stroke="#4A3728" stroke-width="2"/>
  <rect x="90" y="38" width="20" height="12" rx="4" fill="#FFB870" stroke="#4A3728" stroke-width="3"/>
</svg>
`,
  "edu_door.svg": `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="60" y="40" width="80" height="130" rx="10" fill="#C9B6E4" stroke="#4A3728" stroke-width="4"/>
  <rect x="72" y="52" width="56" height="106" rx="6" fill="#D9C6EC" stroke="#4A3728" stroke-width="3"/>
  <circle cx="115" cy="105" r="5" fill="#FFD966" stroke="#4A3728" stroke-width="2.5"/>
  <circle cx="100" cy="170" r="6" fill="#4A3728" opacity="0.15"/>
</svg>
`,
  "edu_house.svg": `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="100" width="100" height="70" fill="#FFE9C6" stroke="#4A3728" stroke-width="4"/>
  <path d="M35 105 L100 50 L165 105 Z" fill="#FF8FA3" stroke="#4A3728" stroke-width="4" stroke-linejoin="round"/>
  <rect x="85" y="130" width="30" height="40" fill="#C98A3E" stroke="#4A3728" stroke-width="3.5"/>
  <circle cx="105" cy="150" r="3" fill="#FFD966"/>
  <rect x="60" y="115" width="22" height="22" rx="4" fill="#A8D8F0" stroke="#4A3728" stroke-width="3"/>
  <rect x="118" y="115" width="22" height="22" rx="4" fill="#A8D8F0" stroke="#4A3728" stroke-width="3"/>
  <rect x="95" y="65" width="12" height="20" fill="#E8B87E" stroke="#4A3728" stroke-width="2.5"/>
</svg>
`,
};

for (const dir of DIRS) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(FILES)) {
    fs.writeFileSync(path.join(dir, name), body);
  }
}

console.log(`Wrote ${Object.keys(FILES).length} SVGs to ${DIRS.length} folders`);
