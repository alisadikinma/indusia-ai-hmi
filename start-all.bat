@echo off
title INDUSIA - Launcher
echo Starting INDUSIA AI HMI Stack...
echo.

:: Terminal 1 - PostgREST (must start first)
echo [1/3] Starting PostgREST on port 3001...
start "PostgREST" cmd /k "cd /d D:\Projects\Tools\postgrest && postgrest.exe postgrest.conf"

:: Wait for PostgREST to be ready
timeout /t 2 /nobreak >nul

:: Terminal 2 - Auto Inspect Edge
echo [2/3] Starting Auto Inspect Edge on port 8002...
start "Auto Inspect Edge" cmd /k "cd /d D:\Projects\indusia-ai-backend && python start_ai_edge.py"

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

:: Terminal 3 - Next.js HMI (must start last)
echo [3/3] Starting Next.js HMI on port 3000...
start "Next.js HMI" cmd /k "cd /d D:\Projects\indusia-ai-hmi && npm run dev"

echo.
echo All services launched!
echo   PostgREST:          http://localhost:3001
echo   Auto Inspect Edge:  http://localhost:8002
echo   Next.js HMI:        http://localhost:3000
echo.
pause
