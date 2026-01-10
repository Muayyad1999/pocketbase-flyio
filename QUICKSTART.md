# ⚡ Quick Start Guide

Get your PocketBase instance running on Fly.io in 5 minutes!

## 🚀 Deploy Now

```bash
# 1. Login to Fly.io
fly auth login

# 2. Create volume for database persistence
fly volumes create pb_data --region ams --size 1

# 3. Set encryption key (IMPORTANT for production!)
fly secrets set POCKETBASE_ENCRYPTION_KEY="$(openssl rand -base64 32)"

# 4. Deploy to Fly.io
fly deploy

# 5. Open your app
fly open
```

**Your PocketBase is now live at:** `https://al-salam-sys.fly.dev` 🎉

## 🔐 Set Admin Credentials (Optional)

```bash
# Set admin email and password via secrets
fly secrets set POCKETBASE_ADMIN_EMAIL="admin@example.com"
fly secrets set POCKETBASE_ADMIN_PASSWORD="your-secure-password-here"

# Restart to apply
fly apps restart
```

## 📊 Useful Commands

```bash
# View logs
fly logs

# Check app status
fly status

# SSH into container
fly ssh console

# Scale resources
fly scale memory 2048

# Create backup
./backup.sh
```

## 🤖 Enable Auto-Deployment

Make deployments automatic when you merge PRs:

```bash
# 1. Create deploy token
fly tokens create deploy

# 2. Add to GitHub Secrets
# Go to: Settings → Secrets → Actions → New repository secret
# Name: FLY_API_TOKEN
# Value: [paste token]
```

Now every push to `master` auto-deploys! 🚢

## 📚 Next Steps

- [📖 Full Deployment Guide](DEPLOY.md) - Detailed instructions
- [🔒 Security Guide](SECURITY.md) - Security best practices
- [🤝 Contributing Guide](CONTRIBUTING.md) - Contribute to the project

## 🆘 Need Help?

- **PocketBase Docs:** https://pocketbase.io/docs/
- **Fly.io Docs:** https://fly.io/docs/
- **Issues:** https://github.com/Muayyad1999/pocketbase-flyio/issues

---

**Happy building!** 🎯
