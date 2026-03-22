# sync-data.ps1
# Syncs database and card images from the local dev environment to the Synology viewer.
#
# Prerequisites:
#   - Local PostgreSQL running (docker-compose up in the main project root)
#   - SSH access to the Synology NAS configured (ssh keys recommended)
#   - Docker Compose running on the Synology for the viewer
#
# Usage:
#   .\sync-data.ps1 -SynologyHost "your-synology-ip-or-hostname"
#                    -SynologyUser "your-ssh-user"
#                    -RemotePath "/volume1/docker/thedugout-viewer"

param(
    [string]$SynologyHost = "thedugout.once-a-knight.com",
    [string]$SynologyUser = "brian",
    [string]$RemotePath = "/volume1/docker/thedugout-viewer",
    [string]$LocalUploadsPath = "..\backend\TheDugout.Api\uploads",
    [string]$LocalDbHost = "localhost",
    [int]$LocalDbPort = 5432,
    [string]$DbName = "thedugout",
    [string]$DbUser = "thedugout"
)

$ErrorActionPreference = "Stop"
$tempDump = Join-Path $env:TEMP "thedugout_dump.sql"

Write-Host "=== The Dugout Data Sync ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Dump local database
Write-Host "[1/4] Dumping local database..." -ForegroundColor Yellow
$env:PGPASSWORD = "DugoutDev2024!"
pg_dump -h $LocalDbHost -p $LocalDbPort -U $DbUser -d $DbName --clean --if-exists --no-owner --no-acl -f $tempDump

if (-not (Test-Path $tempDump)) {
    Write-Host "ERROR: Database dump failed." -ForegroundColor Red
    exit 1
}

$dumpSize = (Get-Item $tempDump).Length / 1MB
Write-Host "  Dump created: $([math]::Round($dumpSize, 2)) MB" -ForegroundColor Green

# Step 2: Upload dump to Synology
Write-Host "[2/4] Uploading database dump to Synology..." -ForegroundColor Yellow
scp $tempDump "${SynologyUser}@${SynologyHost}:${RemotePath}/db_dump.sql"
Write-Host "  Upload complete." -ForegroundColor Green

# Step 3: Restore dump on Synology's Docker PostgreSQL
Write-Host "[3/4] Restoring database on Synology..." -ForegroundColor Yellow
ssh "${SynologyUser}@${SynologyHost}" @"
cd $RemotePath
docker compose exec -T db psql -U $DbUser -d $DbName < db_dump.sql
rm -f db_dump.sql
"@
Write-Host "  Database restored." -ForegroundColor Green

# Step 4: Sync uploaded images via rsync
Write-Host "[4/4] Syncing card images..." -ForegroundColor Yellow
$resolvedUploads = (Resolve-Path $LocalUploadsPath).Path

# Use rsync if available (WSL or native), otherwise fall back to scp
if (Get-Command rsync -ErrorAction SilentlyContinue) {
    rsync -avz --delete "${resolvedUploads}/" "${SynologyUser}@${SynologyHost}:${RemotePath}/uploads/"
} else {
    Write-Host "  rsync not found, using scp (this may be slower)..." -ForegroundColor DarkYellow
    scp -r "${resolvedUploads}\*" "${SynologyUser}@${SynologyHost}:${RemotePath}/uploads/"
}
Write-Host "  Images synced." -ForegroundColor Green

# Cleanup
Remove-Item $tempDump -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Sync complete! ===" -ForegroundColor Cyan
Write-Host "Viewer should be live at: http://thedugout.once-a-knight.com"
