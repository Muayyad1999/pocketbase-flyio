# Al-Salam PocketBase deployment

This repository runs the official PocketBase **0.40.4** binary with checksum verification and Al-Salam's versioned JavaScript schema/hooks. Production uses the same backend code as the Flutter workspace's `pocketbase/` directory.

The retired custom Go entrypoints and modules have been removed. All application customization now lives in the synchronized JavaScript hooks and migrations. A Go toolchain is not required.

## Local run

```sh
docker compose up --build -d
```

In the Fly companion this listens at `http://127.0.0.1:8090` and persists data in the named `pb_data` volume. Use `.env.example` for optional initialization and server-only integration secrets. There are no default superuser credentials. Existing accounts are preserved unless `POCKETBASE_ADMIN_UPSERT=true` is explicitly set.

## Fly deployment

The Fly companion targets `al-salam-sys`, region `ams`, data volume `pb_data` mounted at `/pocketbase/data`. Deploy one writable database machine with `flyctl deploy --remote-only --ha=false`. Keep the existing settings encryption key. The generic Docker companion targets a separate optional `pocketbase-ams` app and mounts `/pb_data`.

## Canonical backend updates

From the parent Flutter workspace run `python scripts/sync_backend.py` after changing `pocketbase/pb_hooks` or `pocketbase/pb_migrations`, then commit the synchronized copies in this repository. Each repository's GitHub workflow only runs when that repository itself is updated.

## Workflows

- Container CI loads the built image, checks CLI commands, starts a fresh migrated database and probes the API.
- Manual Fly deployment requires successful container verification and `FLY_API_TOKEN`.
- Image publishing is manually triggered and produces pinned version and commit tags.
- The weekly upstream version check reports available releases for review; it never directly updates or deploys the database.
- The manual backup workflow uses PocketBase's consistent snapshot API with `PB_BACKUP_EMAIL` and `PB_BACKUP_PASSWORD`. Daily backup automation belongs to the application repository. Configure private S3 backup storage in PocketBase and periodically test restores. The latest 30 `scheduled_*` snapshots are retained; manual backups are preserved.

See the parent Flutter workspace's `docs/DEPLOYMENT.md` for complete signing, Firebase, secrets and restore instructions. Consult [PocketBase's production guide](https://pocketbase.io/docs/going-to-production/) and [Fly configuration reference](https://fly.io/docs/reference/configuration/).
# Production automation ownership

The application repository
[al_salam_accounting_flutter](https://github.com/Muayyad1999/al_salam_accounting_flutter)
owns automatic production deployment and daily verified backups. This companion
contains the same tested PocketBase source for standalone builds and manual
operations. Its deployment and backup workflows are manual only, preventing two
repositories from independently deploying the same database machine.
