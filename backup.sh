#!/bin/sh
# Uses PocketBase snapshot API; configure PB_BACKUP_EMAIL and PB_BACKUP_PASSWORD.
set -eu
exec python3 "$(dirname "$0")/scripts/backup.py"
