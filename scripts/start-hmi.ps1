# Production Startup Script for INDUSIA HMI
# Starts restart-watcher as background job, then Next.js production server

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "==========================================="
Write-Host "  INDUSIA HMI - Production Startup"
Write-Host "==========================================="
Write-Host ""

# Start restart watcher in background
$watcherPath = Join-Path $PSScriptRoot "restart-watcher.ps1"
Write-Host "[startup] Starting restart watcher (background)..."
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$watcherPath`"" -WindowStyle Hidden
Write-Host "[startup] Restart watcher started"

# Start Next.js production server
Set-Location $projectRoot
Write-Host "[startup] Starting Next.js on port 3000..."
Write-Host "[startup] Press Ctrl+C to stop"
Write-Host ""
npm run start
