# Deployment guide

The maintained instructions are in [README.md](README.md) and the parent Flutter workspace's `docs/DEPLOYMENT.md`. These replace the earlier automatic-update, default-password and live-SQLite-copy procedures.
# Automatic production jobs

Automatic deployment and daily verified backups run in
[the application repository](https://github.com/Muayyad1999/al_salam_accounting_flutter/actions).
The companion's deploy and backup workflows require a manual trigger. Its weekly
PocketBase release check is read only and never pushes or deploys an update.
