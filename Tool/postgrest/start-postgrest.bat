@echo off
REM ============================================================================
REM Start PostgREST Server
REM ============================================================================

echo Starting PostgREST for INDUSIA...
echo.
cd /d D:\Projects\indusia-ai-backend\Tools\postgrest
postgrest.exe postgrest.conf
