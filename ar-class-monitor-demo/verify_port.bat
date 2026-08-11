@echo off
tasklist | findstr /i python
powershell -NoProfile -Command "$c = New-Object Net.Sockets.TcpClient; try { $c.Connect('localhost', 8099); Write-Output 'PORT_8099_OPEN' } catch { Write-Output 'PORT_8099_CLOSED' }"
