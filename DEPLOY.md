# 🚀 Deployment Guide for Fly.io

This guide will walk you through deploying your PocketBase application to Fly.io.

## Prerequisites

- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) installed
- Fly.io account (sign up at [fly.io](https://fly.io))
- Git repository set up (✅ already done!)

## Quick Start

### 1. Install Fly.io CLI

```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### 2. Login to Fly.io

```bash
fly auth login
```

### 3. Create Your App (if not already created)

```bash
# The app name is already configured in fly.toml: al-salam-sys
fly apps create al-salam-sys
```

### 4. Create Persistent Volume

PocketBase needs persistent storage for the SQLite database:

```bash
fly volumes create pb_data --region ams --size 1
```

**Important:** Volume size cannot be decreased, only increased. Start with 1GB and scale up as needed.

### 5. Set Environment Variables (Optional but Recommended)

```bash
# Set encryption key for settings (HIGHLY RECOMMENDED for production)
fly secrets set POCKETBASE_ENCRYPTION_KEY="$(openssl rand -base64 32)"

# Set admin credentials (optional - can be created via UI)
fly secrets set POCKETBASE_ADMIN_EMAIL="admin@example.com"
fly secrets set POCKETBASE_ADMIN_PASSWORD="your-secure-password-here"

# Enable debug mode (optional - for development only)
fly secrets set POCKETBASE_DEBUG="false"
```

### 6. Deploy!

```bash
fly deploy
```

### 7. Verify Deployment

```bash
# Check app status
fly status

# View logs
fly logs

# Open in browser
fly open
```

Your PocketBase instance will be available at: `https://al-salam-sys.fly.dev`

## 🔒 Security Best Practices

### 1. Enable Settings Encryption

Always set `POCKETBASE_ENCRYPTION_KEY` in production:

```bash
fly secrets set POCKETBASE_ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

This encrypts sensitive settings like OAuth2 client secrets and SMTP passwords.

### 2. Use Strong Admin Password

If setting via environment variables, use a strong password:

```bash
fly secrets set POCKETBASE_ADMIN_PASSWORD="$(openssl rand -base64 24)"
```

Or create the admin user manually via the PocketBase UI after first deployment.

### 3. Review Fly.toml Configuration

The [fly.toml](fly.toml:1) is pre-configured with:
- ✅ HTTPS enforcement
- ✅ Health checks
- ✅ Auto-scaling (min 0 machines for cost savings)
- ✅ Amsterdam region (ams)

## 🔄 Automated Deployments

This repository includes GitHub Actions workflows for automation:

### Auto-Update Workflow

**File:** [.github/workflows/update-version.yml](.github/workflows/update-version.yml:1)

- ✅ Runs daily at 8 AM UTC
- ✅ Checks for new PocketBase releases
- ✅ Creates pull request with version bump
- ✅ Updates CHANGELOG.md automatically

**Manual trigger:**
```bash
# Via GitHub UI: Actions → Auto Update PocketBase Version → Run workflow
```

### Auto-Deploy Workflow

**File:** [.github/workflows/deploy-flyio.yml](.github/workflows/deploy-flyio.yml:1)

- ✅ Deploys automatically on push to `master` branch
- ✅ Runs health checks after deployment
- ✅ Can be triggered manually

**Setup required:**
1. Generate Fly.io API token: `fly tokens create deploy`
2. Add to GitHub Secrets as `FLY_API_TOKEN`

**Add GitHub Secret:**
```bash
# Get your deploy token
fly tokens create deploy

# Then add it to GitHub:
# Go to: Repository → Settings → Secrets and variables → Actions → New repository secret
# Name: FLY_API_TOKEN
# Value: [paste your token]
```

## 📊 Monitoring & Management

### View Logs

```bash
# Real-time logs
fly logs

# Last 100 lines
fly logs --lines 100
```

### SSH into Container

```bash
fly ssh console
```

### Scale Resources

```bash
# Increase memory
fly scale memory 2048

# Increase CPUs
fly scale cpu 2

# Set min/max machines
fly scale count 1 --max-per-region 2
```

### Increase Volume Size

```bash
# List volumes
fly volumes list

# Extend volume (cannot be reduced!)
fly volumes extend <volume-id> --size 5
```

## 🗄️ Database Backups

### Manual Backup

```bash
# SSH into the container
fly ssh console

# Create backup
cd /pocketbase/data
tar -czf backup-$(date +%Y%m%d).tar.gz data.db

# Exit and download
exit
fly ssh sftp get /pocketbase/data/backup-*.tar.gz
```

### Automated Backup Script

Create a backup script in your repository:

```bash
#!/bin/bash
# backup.sh

APP_NAME="al-salam-sys"
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

echo "Creating backup..."
fly ssh console -C "cd /pocketbase/data && tar -czf /tmp/backup.tar.gz data.db"
fly ssh sftp get /tmp/backup.tar.gz $BACKUP_DIR/pocketbase-backup-$DATE.tar.gz
fly ssh console -C "rm /tmp/backup.tar.gz"

echo "✅ Backup saved to: $BACKUP_DIR/pocketbase-backup-$DATE.tar.gz"
```

## 🐛 Troubleshooting

### App Won't Start

Check logs:
```bash
fly logs
```

Common issues:
- Volume not mounted correctly
- Insufficient permissions
- Port conflicts

### Database Locked

If you see "database is locked" errors:
```bash
# Restart the app
fly apps restart al-salam-sys
```

### Health Check Failing

Verify the health endpoint:
```bash
curl https://al-salam-sys.fly.dev/_/
```

Should return `200 OK`.

### Volume Issues

List and inspect volumes:
```bash
fly volumes list
fly volumes show <volume-id>
```

## 🔄 Updating PocketBase

### Option 1: Automatic (Recommended)

The GitHub Actions workflow checks daily and creates PRs automatically. Just review and merge!

### Option 2: Manual Update

1. Update version in [Dockerfile](Dockerfile:1):
   ```dockerfile
   ARG POCKETBASE_VERSION=0.36.0
   ```

2. Commit and push:
   ```bash
   git add Dockerfile
   git commit -m "Update PocketBase to v0.36.0"
   git push
   ```

3. Deploy:
   ```bash
   fly deploy
   ```

## 💡 Tips & Best Practices

1. **Start small:** Begin with 1GB volume and 1GB RAM, scale as needed
2. **Monitor costs:** Use `fly scale count 0` to scale to zero when not in use (auto-start enabled)
3. **Test locally first:** Use `docker compose up` to test changes before deploying
4. **Enable auto-backups:** Schedule regular database backups
5. **Use secrets:** Never commit sensitive data - use `fly secrets set`
6. **Keep updated:** Merge auto-update PRs promptly for security patches

## 📚 Additional Resources

- [Fly.io Documentation](https://fly.io/docs/)
- [PocketBase Documentation](https://pocketbase.io/docs/)
- [PocketBase GitHub](https://github.com/pocketbase/pocketbase)
- [Fly.io Pricing](https://fly.io/docs/about/pricing/)

## 🆘 Support

- **Fly.io Issues:** [community.fly.io](https://community.fly.io)
- **PocketBase Issues:** [GitHub Issues](https://github.com/pocketbase/pocketbase/issues)
- **This Project:** [GitHub Issues](https://github.com/Muayyad1999/pocketbase-flyio/issues)

---

Happy deploying! 🎉
