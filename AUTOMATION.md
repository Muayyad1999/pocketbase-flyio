# 🤖 Complete Automation Guide

This repository is designed for **100% hands-off operation**. Deploy once, forget about it!

## 🎯 What Runs Automatically

### 1. 🔄 Daily PocketBase Updates
**Workflow:** `.github/workflows/update-version.yml`

- ✅ Checks for new PocketBase releases every day at 8 AM UTC
- ✅ Creates a PR with version updates automatically
- ✅ Updates CHANGELOG.md with release notes
- ✅ Can be manually triggered anytime

**How it works:**
1. GitHub Actions checks PocketBase releases daily
2. If new version found, creates update PR
3. PR includes changelog and version bumps
4. Tests run automatically on PR

### 2. ✅ Auto-Merge Updates
**Workflow:** `.github/workflows/auto-merge.yml`

- ✅ Automatically approves update PRs from github-actions bot
- ✅ Waits for all tests to pass
- ✅ Auto-merges the PR
- ✅ Triggers deployment workflow

**How it works:**
1. Update PR is created by the update workflow
2. Tests run on the PR
3. Once tests pass, PR is auto-approved
4. PR is automatically merged
5. Deployment workflow triggers

### 3. 🚀 Auto-Deploy to Fly.io
**Workflow:** `.github/workflows/deploy-flyio.yml`

- ✅ Deploys automatically on push to `master`
- ✅ Runs after PRs are merged
- ✅ Performs health checks
- ✅ Can be manually triggered

**How it works:**
1. PR gets merged to master
2. Deployment workflow triggers
3. Builds and deploys to Fly.io
4. Runs health checks
5. Reports deployment status

### 4. 💾 Daily Automated Backups
**Workflow:** `.github/workflows/automated-backup.yml`

- ✅ Creates database backup daily at 3 AM UTC
- ✅ Stores as GitHub artifact (30 days retention)
- ✅ Can be manually triggered anytime
- ✅ Automatic cleanup of old backups

**How it works:**
1. Connects to Fly.io app via SSH
2. Creates compressed database backup
3. Downloads backup
4. Stores as GitHub artifact
5. Cleans up remote files

### 5. 🧪 Automatic PR Testing
**Workflow:** `.github/workflows/test-pr.yml`

- ✅ Tests all PRs automatically
- ✅ Validates Docker builds
- ✅ Runs ShellCheck on scripts
- ✅ Comments test results on PR

**How it works:**
1. PR is opened
2. Docker build test runs
3. Shell scripts are linted
4. Results posted as PR comment

---

## 🚀 One-Time Setup (Then Forget It!)

### Step 1: Deploy to Fly.io (5 minutes)

```bash
# Login
fly auth login

# Create volume
fly volumes create pb_data --region ams --size 1

# Set encryption key
fly secrets set POCKETBASE_ENCRYPTION_KEY="$(openssl rand -base64 32)"

# Deploy
fly deploy

# Done! ✅
```

### Step 2: Enable Auto-Everything (2 minutes)

```bash
# Create deploy token
fly tokens create deploy

# Copy the token, then add to GitHub:
# 1. Go to: https://github.com/Muayyad1999/pocketbase-flyio/settings/secrets/actions
# 2. Click "New repository secret"
# 3. Name: FLY_API_TOKEN
# 4. Value: [paste your token]
# 5. Click "Add secret"
```

### Step 3: Enable Auto-Merge (Optional but Recommended)

```bash
# Go to repository settings:
# 1. https://github.com/Muayyad1999/pocketbase-flyio/settings
# 2. Scroll to "Pull Requests"
# 3. Check "Allow auto-merge"
# 4. Check "Automatically delete head branches"
# 5. Save changes
```

**That's it!** 🎉 Everything now runs automatically!

---

## 📅 Automation Schedule

| Task | Frequency | Time (UTC) | Workflow |
|------|-----------|------------|----------|
| Check for Updates | Daily | 8:00 AM | `update-version.yml` |
| Backup Database | Daily | 3:00 AM | `automated-backup.yml` |
| Deploy Changes | On push | Immediate | `deploy-flyio.yml` |
| Test PRs | On PR | Immediate | `test-pr.yml` |
| Auto-Merge | On PR | After tests | `auto-merge.yml` |

---

## 🔍 Monitoring Your Automation

### View Workflow Runs

```bash
# Via GitHub CLI
gh run list

# Via web
# https://github.com/Muayyad1999/pocketbase-flyio/actions
```

### Check Backup Status

```bash
# Via GitHub CLI
gh run list --workflow=automated-backup.yml

# Download latest backup
gh run download [run-id]
```

### View Deployment Status

```bash
# Check Fly.io status
fly status -a al-salam-sys

# View logs
fly logs -a al-salam-sys

# Via GitHub
# https://github.com/Muayyad1999/pocketbase-flyio/actions/workflows/deploy-flyio.yml
```

---

## 🎛️ Manual Triggers (When You Need Them)

All workflows can be manually triggered:

### Trigger Update Check
```bash
gh workflow run update-version.yml
```

### Trigger Backup
```bash
gh workflow run automated-backup.yml
```

### Trigger Deployment
```bash
gh workflow run deploy-flyio.yml
```

### Via GitHub Web UI
1. Go to Actions tab
2. Select workflow
3. Click "Run workflow"
4. Choose branch (master)
5. Click "Run workflow"

---

## 📊 What Happens Daily

### 3:00 AM UTC - Database Backup
1. Automated backup workflow runs
2. Creates compressed database backup
3. Stores as GitHub artifact
4. Old artifacts deleted after 30 days
5. **You:** Sleep peacefully 😴

### 8:00 AM UTC - Update Check
1. Checks for new PocketBase release
2. If found, creates update PR
3. Runs tests on PR
4. Auto-approves if tests pass
5. Auto-merges PR
6. Triggers deployment
7. Your app updates automatically
8. **You:** Still sleeping or having breakfast ☕

---

## 🔒 Security & Secrets

### Required Secrets

| Secret | Purpose | How to Get |
|--------|---------|------------|
| `FLY_API_TOKEN` | Deploy to Fly.io | `fly tokens create deploy` |

### Optional Secrets

| Secret | Purpose | How to Set |
|--------|---------|------------|
| `POCKETBASE_ENCRYPTION_KEY` | Encrypt settings | `fly secrets set POCKETBASE_ENCRYPTION_KEY="..."` |
| `POCKETBASE_ADMIN_EMAIL` | Admin account | `fly secrets set POCKETBASE_ADMIN_EMAIL="..."` |
| `POCKETBASE_ADMIN_PASSWORD` | Admin password | `fly secrets set POCKETBASE_ADMIN_PASSWORD="..."` |

---

## 🚫 What You DON'T Need to Do

- ❌ Manually check for updates
- ❌ Manually merge update PRs
- ❌ Manually deploy to Fly.io
- ❌ Manually backup database
- ❌ Manually run tests
- ❌ Manually monitor releases

Everything. Is. Automated. 🤖

---

## 🎯 Customization Options

### Change Backup Schedule

Edit `.github/workflows/automated-backup.yml`:
```yaml
schedule:
  # Change to run every 6 hours
  - cron: '0 */6 * * *'
```

### Change Update Check Schedule

Edit `.github/workflows/update-version.yml`:
```yaml
schedule:
  # Change to run twice daily
  - cron: '0 8,20 * * *'
```

### Disable Auto-Merge

Simply delete `.github/workflows/auto-merge.yml` if you want to manually review all PRs.

### Keep Backups in Git

Edit `.github/workflows/automated-backup.yml` line 57:
```yaml
if: true  # Change from false to true
```

---

## 📈 Scaling Automation

### Add Slack Notifications

Add to your workflows:
```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Add Email Alerts

Use GitHub's built-in notifications:
1. Go to repository settings
2. Watch → Custom
3. Check "Actions"

### Add Status Badge

Add to README:
```markdown
![Deploy Status](https://github.com/Muayyad1999/pocketbase-flyio/actions/workflows/deploy-flyio.yml/badge.svg)
```

---

## 🎉 Success Metrics

After setup, you should see:

- ✅ Daily backup artifacts in Actions
- ✅ Automatic update PRs when new versions release
- ✅ Auto-merged PRs after tests pass
- ✅ Automatic deployments to Fly.io
- ✅ Zero manual intervention needed

---

## 🆘 Troubleshooting Automation

### Workflows Not Running

1. Check GitHub Actions are enabled:
   - Settings → Actions → Allow all actions
2. Verify FLY_API_TOKEN secret exists
3. Check workflow permissions:
   - Settings → Actions → General → Workflow permissions
   - Select "Read and write permissions"

### Auto-Merge Not Working

1. Enable auto-merge in repository settings
2. Verify workflow has proper permissions
3. Check tests are passing on PR

### Backups Failing

1. Verify FLY_API_TOKEN is valid:
   ```bash
   fly auth token
   ```
2. Check app is running:
   ```bash
   fly status -a al-salam-sys
   ```
3. View workflow logs for details

### Deployments Failing

1. Check fly.toml is valid
2. Verify volume exists:
   ```bash
   fly volumes list -a al-salam-sys
   ```
3. Check Docker build succeeds locally:
   ```bash
   docker build -t test .
   ```

---

## 🏆 Automation Best Practices

1. **Monitor occasionally** - Check Actions tab weekly
2. **Review update PRs** - Even auto-merged, glance at changes
3. **Test backups** - Download and test restore quarterly
4. **Keep secrets secure** - Rotate tokens annually
5. **Update workflows** - Review automation yearly

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Fly.io CI/CD Guide](https://fly.io/docs/app-guides/continuous-deployment-with-github-actions/)
- [PocketBase Release Notes](https://github.com/pocketbase/pocketbase/releases)

---

**Remember:** The goal is **zero manual work**. If you find yourself doing something manually more than once, automate it! 🚀
