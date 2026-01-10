#!/bin/bash

# ========================================
# PocketBase Fly.io Backup Script
# ========================================
#
# This script creates a backup of your PocketBase database
# from your Fly.io deployment.
#
# Usage:
#   ./backup.sh [app-name]
#
# Example:
#   ./backup.sh al-salam-sys
#
# ========================================

set -e

# Configuration
APP_NAME="${1:-al-salam-sys}"
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="pocketbase-backup-${DATE}.tar.gz"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    error "flyctl is not installed. Please install it first:"
    echo "  https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
fi

# Check if logged in
if ! flyctl auth whoami &> /dev/null; then
    error "Not logged in to Fly.io. Please run: fly auth login"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo ""
info "Creating backup for app: $APP_NAME"
echo ""

# Create backup on the server
info "Step 1/4: Creating backup on server..."
flyctl ssh console -a "$APP_NAME" -C "cd /pocketbase/data && tar -czf /tmp/backup.tar.gz data.db data.db-shm data.db-wal 2>/dev/null || tar -czf /tmp/backup.tar.gz data.db"

success "Backup created on server"

# Download backup
info "Step 2/4: Downloading backup..."
flyctl ssh sftp get -a "$APP_NAME" /tmp/backup.tar.gz "$BACKUP_DIR/$BACKUP_FILE"

success "Backup downloaded to: $BACKUP_DIR/$BACKUP_FILE"

# Cleanup remote backup
info "Step 3/4: Cleaning up remote backup..."
flyctl ssh console -a "$APP_NAME" -C "rm /tmp/backup.tar.gz"

success "Remote cleanup complete"

# Display backup info
info "Step 4/4: Verifying backup..."
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)

echo ""
success "Backup completed successfully!"
echo ""
echo "  📦 Backup file: $BACKUP_DIR/$BACKUP_FILE"
echo "  📊 Size: $BACKUP_SIZE"
echo "  📅 Date: $(date)"
echo ""

# Instructions for restore
info "To restore this backup:"
echo "  1. Extract: tar -xzf $BACKUP_DIR/$BACKUP_FILE"
echo "  2. Upload to Fly.io and replace /pocketbase/data/data.db"
echo "  3. Restart: fly apps restart $APP_NAME"
echo ""

warning "Remember to:"
echo "  • Test backups regularly"
echo "  • Store backups securely off-site"
echo "  • Keep multiple backup versions"
echo ""

exit 0
