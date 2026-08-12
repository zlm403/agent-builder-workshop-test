# 一键启动所有服务（服务器 + 学习水位分析 + 顷悟对话桥）
# 用法: powershell -ExecutionPolicy Bypass -File start_all.ps1 [server]
#   server: 顷悟对话桥转发目标（默认本机 http://localhost:8099）

param(
  [string]$server = 'http://localhost:8099'
)

$py = 'C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==== 启动 AR 教学监控全部服务 ===="

# 1. 数据服务器
Write-Host "[1/3] 数据服务器 (8099)..."
Start-Process -FilePath $py -ArgumentList @('server.py','8099') -WindowStyle Hidden -WorkingDirectory $dir
Start-Sleep -Seconds 2

# 2. 学习水位分析服务（DeepSeek AI）
Write-Host "[2/3] 学习水位分析 (water-analyzer)..."
Start-Process -FilePath $py -ArgumentList @('water-analyzer.py','--sleep','60') -WindowStyle Hidden -WorkingDirectory $dir
Start-Sleep -Seconds 1

# 3. 顷悟对话桥（读顷悟对话文件 → 转发到监控服务器）
Write-Host "[3/3] 顷悟对话桥 (qingwu-dialog-bridge) -> $server ..."
Start-Process -FilePath $py -ArgumentList @('qingwu-dialog-bridge.py','--server',$server) -WindowStyle Hidden -WorkingDirectory $dir

Start-Sleep -Seconds 2
Write-Host ""
Write-Host "==== 全部已启动 ===="
Write-Host "  服务器:  http://localhost:8099"
Write-Host "  教师端:  http://localhost:8099/monitor/"
Write-Host "  学生端:  http://localhost:8099/student/"
Write-Host "  大屏:    http://localhost:8099/bigscreen/"
Write-Host ""
Write-Host "验证进程: Get-CimInstance Win32_Process -Filter \"Name='python.exe'\""
