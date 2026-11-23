@echo off
title Backend API Server
echo ========================================================
echo Starting Backend API Server on http://127.0.0.1:8000 ...
echo Docs available at: http://127.0.0.1:8000/api/docs
echo ========================================================
cd /d "%~dp0"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
pause
