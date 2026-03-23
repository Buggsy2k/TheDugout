# sync-data.ps1
# Prepares database dump and uploads archive for manual copy to the Synology NAS.
#
# This script:
#   1. Dumps the local PostgreSQL database from Docker
#   2. Creates a tar.gz of uploaded card images
#   3. Outputs everything to viewer\deploy\ for manual copy
#
# After running this script, copy the deploy\ folder to the NAS and run:
#   sudo -i
#   cd /volume1/docker/thedugout
#   sh restore.sh
#
# Usage:
#   .\sync-data.ps1

param(
    [string]$LocalUploadsPath = "..\backend\TheDugout.Api\uploads",
    [string]$LocalDbContainer = "thedugout-db",
    [string]$DbName = "thedugout",
    [string]$DbUser = "thedugout"
)

$ErrorActionPreference = "Stop"
$viewerRoot = $PSScriptRoot
$outputDir = Join-Path $viewerRoot "deploy"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$dumpFile = Join-Path $outputDir "db_dump.sql"
$tarFile = Join-Path $outputDir "uploads.tar.gz"

Write-Host "=== The Dugout Data Sync — Prepare ===" -ForegroundColor Cyan
Write-Host ""

# Copy restore.sh into deploy folder
$restoreScript = Join-Path $viewerRoot "restore.sh"
if (Test-Path $restoreScript) {
    Copy-Item $restoreScript $outputDir -Force
}

# Step 1: Dump local database
Write-Host "[1/2] Dumping local database..." -ForegroundColor Yellow
docker exec $LocalDbContainer pg_dump -U $DbUser -d $DbName --clean --if-exists --no-owner --no-acl > $dumpFile

if (-not (Test-Path $dumpFile) -or (Get-Item $dumpFile).Length -eq 0) {
    Write-Host "ERROR: Database dump failed." -ForegroundColor Red
    exit 1
}

$dumpSize = [math]::Round((Get-Item $dumpFile).Length / 1MB, 2)
Write-Host "  Dump created: $dumpSize MB" -ForegroundColor Green

# Step 2: Create uploads archive
Write-Host "[2/2] Archiving card images..." -ForegroundColor Yellow
$resolvedUploads = (Resolve-Path $LocalUploadsPath).Path
tar -czf $tarFile -C $resolvedUploads .

$tarSize = [math]::Round((Get-Item $tarFile).Length / 1MB, 2)
Write-Host "  Uploads archive: $tarSize MB" -ForegroundColor Green

Write-Host ""
Write-Host "=== Sync files ready! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output in: $outputDir" -ForegroundColor Green
Write-Host "  - db_dump.sql ($dumpSize MB)"
Write-Host "  - uploads.tar.gz ($tarSize MB)"
Write-Host "  - restore.sh (run this on the NAS)"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor DarkYellow
Write-Host "  1. Copy deploy\ contents to NAS at /volume1/docker/thedugout"
Write-Host "  2. SSH into the NAS:  ssh -p 2222 buggsy@192.168.1.18"
Write-Host "  3. sudo -i"
Write-Host "  4. cd /volume1/docker/thedugout"
Write-Host "  5. sh restore.sh"
