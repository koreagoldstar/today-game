# 컴퓨터를 켤 때(로그온) · 6시간마다 작업 스케줄러가 부른다 (pc/install-task.ps1 로 등록).
#   1) 이 녹화 전용 사본을 origin/master 로 맞춘다 — 녹화본은 운영과 같은 게임 파일에서 나와야(게임 지문) Actions 가 쓴다.
#   2) 설치물이 바뀌었으면 npm ci
#   3) node marketing/pc/record-stock.js — 아직 안 올린 게임만 GPU 로 녹화해 재고로 올린다.
# 안전: 녹화 전용 사본(맨 위 폴더의 .stock-recorder 표시 파일)에서만 돈다. 작업 중인 폴더를 강제로 덮어쓰지 않게.
# 기록: marketing/out/stock-log.txt
$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$mk = Join-Path $root "marketing"
$log = Join-Path $mk "out\stock-log.txt"
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
function Log([string]$m) { Add-Content -Encoding UTF8 -Path $log -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m" }

if (-not (Test-Path (Join-Path $root ".stock-recorder"))) { Log "녹화 전용 사본이 아니라 멈춤: $root"; exit 1 }
try {
  Log "시작"
  & git -C $root fetch -q origin master
  if ($LASTEXITCODE -ne 0) { throw "git fetch 실패 (인터넷 연결 확인)" }
  & git -C $root checkout -q --detach --force origin/master
  if ($LASTEXITCODE -ne 0) { throw "git checkout 실패" }
  Log "master $(& git -C $root rev-parse --short HEAD)"

  $lock = Join-Path $mk "package-lock.json"
  $stamp = Join-Path $mk "out\.lock-hash"
  $hash = (Get-FileHash $lock).Hash
  $have = if (Test-Path $stamp) { (Get-Content $stamp -Raw).Trim() } else { "" }
  if (-not (Test-Path (Join-Path $mk "node_modules")) -or $have -ne $hash) {
    Log "npm ci"
    $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1"
    & cmd /c "cd /d `"$mk`" && npm ci --no-audit --no-fund >> `"$log`" 2>&1"
    if ($LASTEXITCODE -ne 0) { throw "npm ci 실패" }
    Set-Content -Path $stamp -Value $hash
  }

  & cmd /c "node `"$mk\pc\record-stock.js`" >> `"$log`" 2>&1"
  $code = $LASTEXITCODE
  Log "끝 (코드 $code)"
  exit $code
} catch {
  Log "실패: $($_.Exception.Message)"
  exit 1
}
