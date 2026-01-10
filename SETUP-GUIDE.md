# 🚀 Complete Setup Guide - Option B (Full Automation)

This guide will walk you through setting up your PocketBase deployment with **100% automation** in approximately 7 minutes.

## 📋 Prerequisites

- ✅ Fly.io account (sign up at https://fly.io if you don't have one)
- ✅ Fly.io CLI installed
- ✅ GitHub repository (already done - this repo!)

---

## ⚡ Step-by-Step Setup

### 🎯 PART 1: Deploy to Fly.io (5 minutes)

Open your terminal and run these commands:

#### 1. Login to Fly.io

```bash
fly auth login
```

This will open your browser for authentication.

#### 2. Create Persistent Volume

```bash
fly volumes create pb_data --region ams --size 1
```

**Output should look like:**
```
        ID: vol_xxxxxxxxxxxxx
      Name: pb_data
       App: al-salam-sys
    Region: ams
      Zone: xxxx
   Size GB: 1
 Encrypted: true
Created at: XX XXX XXXX XX:XX
```

✅ **Volume created!**

#### 3. Set Encryption Key (IMPORTANT!)

```bash
fly secrets set POCKETBASE_ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

**Output:**
```
Secrets are staged for the first deployment
```

✅ **Encryption key set!**

#### 4. Deploy Your App

```bash
fly deploy
```

This will:
- Build the Docker image
- Deploy to Fly.io
- Start your PocketBase instance

**Wait for:**
```
--> v0 deployed successfully
```

✅ **App deployed!**

#### 5. Open Your App

```bash
fly open
```

Your PocketBase admin panel should open in your browser at:
**https://al-salam-sys.fly.dev/_/**

🎉 **Your PocketBase is LIVE!**

---

### 🤖 PART 2: Enable Full Automation (2 minutes)

Now let's enable the automation so you never have to touch it again!

#### Step 1: Create Fly.io Deploy Token (1 min)

In your terminal, run:

```bash
fly tokens create deploy
```

**You'll see output like:**
```
FlyV1 fm2_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**⚠️ COPY THIS TOKEN NOW** - you'll need it in the next step!

#### Step 2: Add Token to GitHub (1 min)

1. **Go to your repository secrets page:**
   ```
   https://github.com/Muayyad1999/pocketbase-flyio/settings/secrets/actions
   ```

2. **Click the green "New repository secret" button**

3. **Enter the following:**
   - **Name:** `FLY_API_TOKEN`
   - **Value:** [Paste the token you copied above]

4. **Click "Add secret"**

✅ **Secret added!** You should see `FLY_API_TOKEN` in the list.

---

### 🔧 PART 3: Enable Auto-Merge (1 minute)

#### Step 1: Enable Auto-Merge in Repository Settings (30 sec)

1. **Go to repository settings:**
   ```
   https://github.com/Muayyad1999/pocketbase-flyio/settings
   ```

2. **Scroll down to "Pull Requests" section**

3. **Check these two boxes:**
   - ✅ **"Allow auto-merge"**
   - ✅ **"Automatically delete head branches"**

4. **Click "Save changes"** at the bottom

✅ **Auto-merge enabled!**

#### Step 2: Set Workflow Permissions (30 sec)

1. **Go to Actions settings:**
   ```
   https://github.com/Muayyad1999/pocketbase-flyio/settings/actions
   ```

2. **Scroll to "Workflow permissions" section**

3. **Select:**
   - ⚪ **"Read and write permissions"** (click the radio button)

4. **Check:**
   - ✅ **"Allow GitHub Actions to create and approve pull requests"**

5. **Click "Save"**

✅ **Workflow permissions set!**

---

## 🎉 CONGRATULATIONS! Setup Complete!

Your PocketBase deployment is now **100% automated**!

---

## 🔍 What Happens Now (Automatically)

### ⏰ Daily at 3 AM UTC
- 💾 Database backup is created
- 📦 Stored as GitHub artifact for 30 days
- 🗑️ Old backups auto-deleted

### ⏰ Daily at 8 AM UTC
- 🔍 Checks for new PocketBase releases
- 📝 Creates PR if update available
- 🧪 Runs tests automatically
- ✅ Auto-approves if tests pass
- 🔀 Auto-merges the PR
- 🚀 Auto-deploys to Fly.io

### 📨 On Every Push to Master
- 🚢 Automatically deploys to Fly.io
- 🏥 Runs health checks
- ✅ Verifies deployment success

---

## ✅ Verify Your Setup

### 1. Check Your App is Running

Visit: https://al-salam-sys.fly.dev/_/

You should see the PocketBase admin panel.

### 2. Check GitHub Actions

Visit: https://github.com/Muayyad1999/pocketbase-flyio/actions

You should see 5 workflows:
- ✅ Auto Update PocketBase Version
- ✅ Automated Database Backup
- ✅ Auto-Merge Updates
- ✅ Deploy to Fly.io
- ✅ Test Pull Request

### 3. Check Fly.io Status

```bash
fly status -a al-salam-sys
```

Should show:
```
App
  Name     = al-salam-sys
  Owner    = [your-org]
  Hostname = al-salam-sys.fly.dev

Instances
ID       PROCESS VERSION REGION  STATE   CHECKS  LAST UPDATED
xxxxxx   app     X       ams     running 1 total YYYY-MM-DD HH:MM
```

✅ **Everything is running!**

---

## 🎯 Next Steps

### Create Your Admin Account

1. Go to https://al-salam-sys.fly.dev/_/
2. Fill in the admin form:
   - **Email:** your-email@example.com
   - **Password:** [strong password]
3. Click "Create"

✅ **You're ready to build!**

### Explore Your PocketBase

- Create collections
- Set up authentication
- Build your API
- Add realtime subscriptions

### Monitor Your Automation

Check these occasionally:
- **GitHub Actions:** https://github.com/Muayyad1999/pocketbase-flyio/actions
- **Fly.io Dashboard:** https://fly.io/dashboard
- **App Logs:** `fly logs -a al-salam-sys`

---

## 📚 Helpful Resources

### Documentation
- [AUTOMATION.md](AUTOMATION.md) - Complete automation guide
- [DEPLOY.md](DEPLOY.md) - Detailed deployment docs
- [SECURITY.md](SECURITY.md) - Security best practices
- [PocketBase Docs](https://pocketbase.io/docs) - Official documentation

### Useful Commands

```bash
# View logs
fly logs -a al-salam-sys

# Check status
fly status -a al-salam-sys

# SSH into container
fly ssh console -a al-salam-sys

# Scale up
fly scale memory 2048 -a al-salam-sys

# Manual backup
./backup.sh

# Manual deployment
fly deploy

# View GitHub Actions runs
gh run list

# Trigger manual update check
gh workflow run update-version.yml
```

---

## 🆘 Troubleshooting

### App Not Responding?

```bash
# Check status
fly status -a al-salam-sys

# View logs
fly logs -a al-salam-sys

# Restart app
fly apps restart al-salam-sys
```

### Deployments Failing?

1. Check GitHub Actions logs
2. Verify FLY_API_TOKEN secret exists
3. Check Docker build locally: `docker build -t test .`

### Workflows Not Running?

1. Check Actions are enabled in repository settings
2. Verify workflow permissions are set correctly
3. Check FLY_API_TOKEN secret is valid

### Need More Help?

- Read [AUTOMATION.md](AUTOMATION.md) for detailed info
- Check GitHub Actions logs for error details
- Review [DEPLOY.md](DEPLOY.md) for troubleshooting

---

## 🎊 You're All Set!

Your PocketBase deployment is:
- ✅ **Live and running**
- ✅ **Fully automated**
- ✅ **Backed up daily**
- ✅ **Auto-updating**
- ✅ **Self-deploying**

**Now forget about infrastructure and build your app!** 🚀

---

## 📊 What You've Achieved

| Feature | Status | Manual Work |
|---------|--------|-------------|
| PocketBase Deployed | ✅ | None |
| Auto-Updates | ✅ | None |
| Daily Backups | ✅ | None |
| Auto-Deployment | ✅ | None |
| Health Monitoring | ✅ | None |
| Security | ✅ | None |

**Total Time Spent:** ~7 minutes
**Ongoing Maintenance Required:** 0 minutes/month

**You did it!** 🎉
