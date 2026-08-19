@echo off
chcp 65001 >nul
title Douyin Video Tool
cd /d "%~dp0"
start "" /min cmd /c "node server.js"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8120"