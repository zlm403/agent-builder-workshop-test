# AR 教学监控 · 一键启动数据服务（独立后台进程，不随终端关闭）
# 用法: powershell -ExecutionPolicy Bypass -File start_server.ps1 [port]
$py = 'C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $dir 'server.py'
$port = if ($args.Count -gt 0) { $args[0] } else { '8099' }

# 如果端口已有服务，先提示
$listening = netstat -ano | Select-String ":${port}\s" | Select-String "LISTENING"
if ($listening) {
    Write-Host "Port ${port} already in use. Existing process:"
    $listening | ForEach-Object { Write-Host "  $_" }
    Write-Host "Stop it first (e.g. taskkill /PID <pid> /F) then rerun."
    exit 1
}

Start-Process -FilePath $py -ArgumentList @($server, $port) -WindowStyle Hidden -WorkingDirectory $dir
Write-Host "AR Monitor Data Service starting on http://0.0.0.0:${port} (PID started)."
Write-Host "Data file: $(Join-Path $dir 'agent-live\events.jsonl')"
