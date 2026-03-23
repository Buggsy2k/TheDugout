#!/bin/sh
# restore.sh — Run on the Synology NAS after copying deploy files.
# Usage:
#   sudo -i
#   cd /volume1/docker/thedugout
#   sh restore.sh

set -e

echo "=== The Dugout — Restore ==="
echo ""

# Step 1: Restore database
if [ -f db_dump.sql ]; then
    echo "[1/2] Restoring database..."
    docker-compose exec -T db psql -U thedugout -d thedugout < db_dump.sql
    rm -f db_dump.sql
    echo "  Database restored."
else
    echo "[1/2] No db_dump.sql found, skipping database restore."
fi

# Step 2: Restore uploaded images (bind-mounted at ./uploads)
if [ -f uploads.tar.gz ]; then
    echo "[2/2] Restoring card images..."
    mkdir -p ./uploads
    tar -xzf uploads.tar.gz -C ./uploads
    rm -f uploads.tar.gz
    echo "  Images restored."
else
    echo "[2/2] No uploads.tar.gz found, skipping image restore."
fi

echo ""
echo "=== Restore complete! ==="
