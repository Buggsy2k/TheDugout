# build.ps1
# Builds Docker images locally and saves them as tar files for manual copy to the NAS.
#
# Usage:
#   .\build.ps1
#
# Output:
#   viewer\deploy\thedugout-backend.tar
#   viewer\deploy\thedugout-frontend.tar
#   viewer\deploy\docker-compose.yml
#
# After building, copy the deploy\ folder contents to the NAS and run:
#   docker load -i backend.tar
#   docker load -i frontend.tar
#   docker compose up -d

$ErrorActionPreference = "Stop"
$viewerRoot = $PSScriptRoot
$outputDir = Join-Path $viewerRoot "deploy"

Write-Host "=== The Dugout Viewer — Build ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build Docker images locally
Write-Host "[1/4] Building backend image..." -ForegroundColor Yellow
docker build -t thedugout-viewer-backend:latest "$viewerRoot\backend\TheDugoutViewer.Api"
Write-Host "  Backend image built." -ForegroundColor Green

Write-Host "[2/4] Building frontend image..." -ForegroundColor Yellow
docker build -t thedugout-viewer-frontend:latest "$viewerRoot\frontend"
Write-Host "  Frontend image built." -ForegroundColor Green

# Step 2: Save images to tar files
Write-Host "[3/4] Saving images to tar files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

docker save thedugout-viewer-backend:latest -o "$outputDir\thedugout-backend.tar"
docker save thedugout-viewer-frontend:latest -o "$outputDir\thedugout-frontend.tar"

$backendSize = [math]::Round((Get-Item "$outputDir\thedugout-backend.tar").Length / 1MB, 1)
$frontendSize = [math]::Round((Get-Item "$outputDir\thedugout-frontend.tar").Length / 1MB, 1)
Write-Host "  Backend: ${backendSize} MB, Frontend: ${frontendSize} MB" -ForegroundColor Green

# Step 3: Copy docker-compose.yml to deploy folder
Write-Host "[4/4] Copying docker-compose.yml..." -ForegroundColor Yellow
Copy-Item "$viewerRoot\docker-compose.yml" "$outputDir\docker-compose.yml" -Force
Write-Host "  Done." -ForegroundColor Green

Write-Host ""
Write-Host "=== Build complete! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output files in: $outputDir" -ForegroundColor Green
Write-Host "  - thedugout-backend.tar (${backendSize} MB)"
Write-Host "  - thedugout-frontend.tar (${frontendSize} MB)"
Write-Host "  - docker-compose.yml"
Write-Host ""
Write-Host "To deploy on the NAS:" -ForegroundColor DarkYellow
Write-Host "  1. Copy deploy\ folder contents to the NAS"
Write-Host "  2. docker load -i thedugout-backend.tar"
Write-Host "  3. docker load -i thedugout-frontend.tar"
Write-Host "  4. docker compose up -d"
