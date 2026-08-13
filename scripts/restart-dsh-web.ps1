# Restart the dsh web app so it picks up:
#   1) the newest @abap-adt/dsh-plugin build (TLS / search resilience fixes)
#   2) the ADT_DEV_PASSWORD user environment variable (set via setx)
# Sessions persist across the restart; refresh http://127.0.0.1:3080 afterwards.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/restart-dsh-web.ps1

$ErrorActionPreference = 'Stop'
$workspace = 'C:\Users\xiaofeng\Documents\Dev\WorkDev\adt'
$log = Join-Path $workspace 'dsh-web.log'

Write-Host 'Stopping running dsh web processes...'
$targets = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'deepseek-ai[\\/]dsh|dsh[\\/]lib[\\/]bin\.js' }
foreach ($t in $targets) {
    Write-Host ("  killing PID {0}" -f $t.ProcessId)
    Stop-Process -Id $t.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3

Write-Host 'Relaunching dsh web from workspace...'
Set-Location $workspace
# Carry the persisted env var into the child process.
$env:ADT_DEV_PASSWORD = [Environment]::GetEnvironmentVariable('ADT_DEV_PASSWORD', 'User')
$env:ADT_PASSWORD = [Environment]::GetEnvironmentVariable('ADT_PASSWORD', 'User')

Start-Process -FilePath 'cmd.exe' -ArgumentList '/d','/s','/c',"npx @deepseek-ai/dsh web > `"$log`" 2>&1" `
    -WorkingDirectory $workspace -WindowStyle Hidden

Start-Sleep -Seconds 8
Write-Host ''
Write-Host 'dsh web restarted. Refresh http://127.0.0.1:3080 in your browser.'
Write-Host 'Log: ' $log
