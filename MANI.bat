@echo off
set ROOT=%~dp0
start "MANI-API" cmd /k "cd /d %ROOT%backend && .venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8100"
timeout /t 2 /nobreak >nul
start "MANI-WEB" cmd /k "cd /d %ROOT%frontend && npm run dev"
echo MANI API :8100  WEB :3100
echo Open http://localhost:3100
