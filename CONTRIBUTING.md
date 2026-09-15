# Contributing

This companion packages the official PocketBase binary with the accounting hooks and migrations maintained in the parent Flutter workspace. Read [README.md](README.md), the parent `pocketbase/README.md`, and `docs/DEPLOYMENT.md` before changing deployment behavior.

## Backend changes

Change `pocketbase/pb_hooks/` or `pocketbase/pb_migrations/` in the Flutter workspace, run the isolated backend verification, then run `python scripts/sync_backend.py`. Commit the synchronized JavaScript copies with the corresponding deployment changes. Do not reintroduce custom Go entrypoints; the official binary registers the JavaScript runtime and migrations.

## Container changes

Docker with Compose, Git, and a POSIX shell are sufficient; Go is not required.

```sh
make build-local
docker run --rm al-salam-pocketbase:0.40.4 --version
docker run --rm al-salam-pocketbase:0.40.4 superuser --help
make run-detach
curl --fail http://127.0.0.1:8090/api/health
curl --fail http://127.0.0.1:8090/api/accounting/status
make logs
make down
```

`make down` preserves the `pb_data` volume. Use an isolated instance for schema tests. Keep database files, backups, environment files, credentials and the settings encryption key out of commits.

## Review and deployment

Pull requests should explain the resulting behavior, data migration impact, and validation. Container CI builds the image and checks startup, migrations, CLI commands and API access. The upstream release check runs weekly and reports available versions for review. Production deployments require successful container verification and configured repository secrets; version checks do not deploy upgrades.

Create and download a consistent PocketBase snapshot before a deployed database upgrade. Preserve the settings encryption key and follow the parent deployment guide for recovery. Test against a separate Fly app when validating deployment-specific changes.
