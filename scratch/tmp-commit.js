const { execSync } = require("child_process");
execSync("git commit -m " + JSON.stringify("퀴즈·운세 게임을 추가하고 상식퀴즈 문항을 1700개 넘게 늘려 매일 중복이 잘 안 나오게 했습니다."), {
  stdio: "inherit",
  encoding: "utf8",
});
