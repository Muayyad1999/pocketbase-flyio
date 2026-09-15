#!/bin/sh
set -eu
POCKETBASE_DATA_DIR=${POCKETBASE_DATA_DIR:-/pocketbase/data}
POCKETBASE_MIGRATION_DIR=${POCKETBASE_MIGRATION_DIR:-/opt/pocketbase/pb_migrations}
POCKETBASE_HOOK_DIR=${POCKETBASE_HOOK_DIR:-/opt/pocketbase/pb_hooks}
POCKETBASE_PUBLIC_DIR=${POCKETBASE_PUBLIC_DIR:-/pocketbase/public}
POCKETBASE_PORT_NUMBER=${POCKETBASE_PORT_NUMBER:-8090}
if [ -n "${POCKETBASE_ENCRYPTION_KEY_FILE:-}" ]; then
  POCKETBASE_ENCRYPTION_KEY=$(cat "$POCKETBASE_ENCRYPTION_KEY_FILE")
  export POCKETBASE_ENCRYPTION_KEY
fi
if [ -n "${POCKETBASE_ADMIN_PASSWORD_FILE:-}" ]; then
  POCKETBASE_ADMIN_PASSWORD=$(cat "$POCKETBASE_ADMIN_PASSWORD_FILE")
fi
if [ "${1:-}" = pocketbase ]; then shift; fi
case "${1:-}" in
  --help|-h|--version|-v) exec pocketbase "$@" ;;
esac
if [ "$#" -eq 0 ]; then set -- serve; fi
if [ "${1#-}" != "$1" ]; then set -- serve "$@"; fi
command=$1
shift
mkdir -p "$POCKETBASE_DATA_DIR"
if [ -n "${POCKETBASE_ENCRYPTION_KEY:-}" ]; then
  set -- --encryptionEnv=POCKETBASE_ENCRYPTION_KEY "$@"
fi
if [ "$command" = serve ]; then
  if [ -n "${POCKETBASE_ADMIN_EMAIL:-}" ] && [ -n "${POCKETBASE_ADMIN_PASSWORD:-}" ]; then
    if [ ! -f "$POCKETBASE_DATA_DIR/data.db" ] || [ "${POCKETBASE_ADMIN_UPSERT:-false}" = true ]; then
      if [ -n "${POCKETBASE_ENCRYPTION_KEY:-}" ]; then
        pocketbase superuser upsert "$POCKETBASE_ADMIN_EMAIL" "$POCKETBASE_ADMIN_PASSWORD" --dir="$POCKETBASE_DATA_DIR" --encryptionEnv=POCKETBASE_ENCRYPTION_KEY
      else
        pocketbase superuser upsert "$POCKETBASE_ADMIN_EMAIL" "$POCKETBASE_ADMIN_PASSWORD" --dir="$POCKETBASE_DATA_DIR"
      fi
    fi
  fi
  if [ "${POCKETBASE_DEBUG:-false}" = true ]; then set -- --dev "$@"; fi
  set -- --http="0.0.0.0:$POCKETBASE_PORT_NUMBER" --publicDir="$POCKETBASE_PUBLIC_DIR" --hooksDir="$POCKETBASE_HOOK_DIR" "$@"
fi
exec pocketbase "$command" --dir="$POCKETBASE_DATA_DIR" --migrationsDir="$POCKETBASE_MIGRATION_DIR" "$@"
