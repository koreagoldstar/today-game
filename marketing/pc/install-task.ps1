# 이 PC 의 Windows 작업 스케줄러에 "3D 녹화본 재고 채우기" 를 등록한다 (관리자 승인 후에만 실행)
#   로그온할 때 + 6시간마다 → marketing/pc/record-stock.js
#   지우기: Unregister-ScheduledTask -TaskName "TodayGame-3D-Clips" -Confirm:$false
param(
  [string]$RepoPath = (Resolve-Path "$PSScriptRoot\..\..").Path,
  [string]$TaskName = "TodayGame-3D-Clips"
)
$node = (Get-Command node -ErrorAction Stop).Source
$script = Join-Path $RepoPath "marketing\pc\record-stock.js"
if (-not (Test-Path $script)) { throw "스크립트가 없습니다: $script" }
if (-not (Test-Path (Join-Path $RepoPath "marketing\.env.local"))) { throw "marketing\.env.local (Upstash · Blob 열쇠) 이 없습니다." }

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $RepoPath
$logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddHours(9) -RepetitionInterval (New-TimeSpan -Hours 6)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($logon, $repeat) -Settings $settings -Description "오늘의 게임 홍보: 3D 게임 녹화본을 GPU 로 만들어 재고로 올림" | Out-Null
Write-Output "등록됨: $TaskName ($RepoPath)"
