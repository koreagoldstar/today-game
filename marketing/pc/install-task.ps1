# 이 PC 의 Windows 작업 스케줄러에 "홍보용 게임 녹화 재고 채우기" 를 등록한다
#   로그온할 때(컴퓨터를 켜고 들어올 때) + 6시간마다 → marketing/pc/stock-run.ps1 (master 로 맞추고 → record-stock.js)
#   녹화 전용 사본에서 실행할 것 (작업 중인 폴더 X). 처음 한 번 만들기:
#     git worktree add --detach D:\프로젝트\todaygame-stock origin/master
#     copy <작업 폴더>\marketing\.env.local D:\프로젝트\todaygame-stock\marketing\.env.local
#     New-Item D:\프로젝트\todaygame-stock\.stock-recorder
#     powershell -ExecutionPolicy Bypass -File D:\프로젝트\todaygame-stock\marketing\pc\install-task.ps1
#   지우기: Unregister-ScheduledTask -TaskName "TodayGame-Promo-Clips" -Confirm:$false
param(
  [string]$RepoPath = (Resolve-Path "$PSScriptRoot\..\..").Path,
  [string]$TaskName = "TodayGame-Promo-Clips"
)
$runner = Join-Path $RepoPath "marketing\pc\stock-run.ps1"
if (-not (Test-Path $runner)) { throw "스크립트가 없습니다: $runner" }
if (-not (Test-Path (Join-Path $RepoPath ".stock-recorder"))) { throw "녹화 전용 사본이 아닙니다 (.stock-recorder 없음): $RepoPath" }
if (-not (Test-Path (Join-Path $RepoPath "marketing\.env.local"))) { throw "marketing\.env.local (Upstash · Blob 열쇠) 이 없습니다." }

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`"" -WorkingDirectory $RepoPath
$logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddHours(9) -RepetitionInterval (New-TimeSpan -Hours 6)
$logon.Delay = "PT3M" # 켜자마자 말고 3분 뒤 (부팅 직후 바쁠 때 피하기)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($logon, $repeat) -Settings $settings -Description "오늘의 게임 홍보: 아직 안 올린 게임을 GPU 로 녹화해 재고로 올림 (master 기준)" -Force | Out-Null
Write-Output "등록됨: $TaskName ($RepoPath)"
