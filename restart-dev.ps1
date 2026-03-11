<#
.SYNOPSIS
    Stops and restarts the frontend (Vite) and backend (dotnet) development processes.
.DESCRIPTION
    Run from the project root: .\restart-dev.ps1
#>

$ErrorActionPreference = 'Continue'
$projectRoot = $PSScriptRoot
$backendDir  = Join-Path $projectRoot "backend\TheDugout.Api"
$frontendDir = Join-Path $projectRoot "frontend"

# ── Stop processes ──────────────────────────────────────────────────────────────
Write-Host "`n=== Stopping development processes ===" -ForegroundColor Cyan

# Stop frontend (node/vite)
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcs) {
    Write-Host "Stopping frontend (node) processes..." -ForegroundColor Yellow
    foreach ($p in $nodeProcs) {
        try {
            Stop-Process -Id $p.Id -Force -ErrorAction Stop
            Write-Host "  Stopped node PID $($p.Id)" -ForegroundColor Green
        }
        catch {
            Write-Host "  ERROR stopping node PID $($p.Id): $_" -ForegroundColor Red
        }
    }
}
else {
    Write-Host "No running node processes found." -ForegroundColor Gray
}

# Stop backend (dotnet)
$dotnetProcs = Get-Process -Name "dotnet" -ErrorAction SilentlyContinue
if ($dotnetProcs) {
    Write-Host "Stopping backend (dotnet) processes..." -ForegroundColor Yellow
    foreach ($p in $dotnetProcs) {
        try {
            Stop-Process -Id $p.Id -Force -ErrorAction Stop
            Write-Host "  Stopped dotnet PID $($p.Id)" -ForegroundColor Green
        }
        catch {
            Write-Host "  ERROR stopping dotnet PID $($p.Id): $_" -ForegroundColor Red
        }
    }
}
else {
    Write-Host "No running dotnet processes found." -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# ── Build ───────────────────────────────────────────────────────────────────────
Write-Host "`n=== Building projects ===" -ForegroundColor Cyan

# Build backend
Write-Host "Building backend (dotnet build)..." -ForegroundColor Yellow
Push-Location $backendDir
dotnet build --verbosity quiet 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Backend build failed (exit code $LASTEXITCODE). Aborting." -ForegroundColor Red
    Pop-Location
    return
}
Write-Host "  Backend build succeeded" -ForegroundColor Green
Pop-Location

# Build frontend
Write-Host "Building frontend (npm run build)..." -ForegroundColor Yellow
Push-Location $frontendDir
npm run build 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Frontend build failed (exit code $LASTEXITCODE). Aborting." -ForegroundColor Red
    Pop-Location
    return
}
Write-Host "  Frontend build succeeded" -ForegroundColor Green
Pop-Location

# ── Start processes ─────────────────────────────────────────────────────────────
Write-Host "`n=== Starting development processes ===" -ForegroundColor Cyan

# Start backend in a new window that stays open (-NoExit)
Write-Host "Starting backend (dotnet run)..." -ForegroundColor Yellow
try {
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", `
        "Set-Location '$backendDir'; Write-Host 'Starting backend...' -ForegroundColor Cyan; dotnet run" `
        -ErrorAction Stop
    Write-Host "  Backend window launched" -ForegroundColor Green
}
catch {
    Write-Host "  ERROR starting backend: $_" -ForegroundColor Red
}

# Start frontend in a new window that stays open (-NoExit)
Write-Host "Starting frontend (npm run dev)..." -ForegroundColor Yellow
try {
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", `
        "Set-Location '$frontendDir'; Write-Host 'Starting frontend...' -ForegroundColor Cyan; npm run dev" `
        -ErrorAction Stop
    Write-Host "  Frontend window launched" -ForegroundColor Green
}
catch {
    Write-Host "  ERROR starting frontend: $_" -ForegroundColor Red
}

Write-Host "`n=== Dev environment restart complete ===" -ForegroundColor Cyan
Write-Host "Backend : http://localhost:5137  (Swagger: http://localhost:5137/swagger)"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Each server is running in its own terminal window." -ForegroundColor Gray
Write-Host ""
