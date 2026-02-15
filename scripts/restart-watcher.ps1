# Restart Watcher for INDUSIA HMI
# Watches for .restart-trigger file in project root
# When detected: kill Node, wait, restart Next.js production server

$projectRoot = Split-Path -Parent $PSScriptRoot
$triggerFile = Join-Path $projectRoot ".restart-trigger"

Write-Host "[restart-watcher] Monitoring for restart trigger at: $triggerFile"
Write-Host "[restart-watcher] Press Ctrl+C to stop"

while ($true) {
    if (Test-Path $triggerFile) {
        Write-Host ""
        Write-Host "[restart-watcher] ========================================="
        Write-Host "[restart-watcher] Restart trigger detected!"
        Write-Host "[restart-watcher] ========================================="

        # Read trigger info
        try {
            $triggerContent = Get-Content $triggerFile -Raw | ConvertFrom-Json
            Write-Host "[restart-watcher] Version: $($triggerContent.version)"
            Write-Host "[restart-watcher] Triggered by: $($triggerContent.triggeredBy)"
        } catch {
            Write-Host "[restart-watcher] Could not parse trigger file"
        }

        # Remove trigger file
        Remove-Item $triggerFile -Force
        Write-Host "[restart-watcher] Trigger file removed"

        # Kill Node.js processes
        Write-Host "[restart-watcher] Stopping Node.js processes..."
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
        Write-Host "[restart-watcher] Node processes stopped"

        Start-Sleep -Seconds 3

        # Restart Next.js production
        Set-Location $projectRoot
        Write-Host "[restart-watcher] Starting Next.js production server..."
        Start-Process -FilePath "npm" -ArgumentList "run", "start" -WorkingDirectory $projectRoot -NoNewWindow
        Write-Host "[restart-watcher] Server restarted successfully"
        Write-Host "[restart-watcher] ========================================="
        Write-Host ""
    }
    Start-Sleep -Seconds 5
}
