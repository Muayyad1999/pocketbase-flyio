# 🔒 Security Guide

This document outlines security best practices for deploying and managing PocketBase on Fly.io.

## 🚨 Critical Security Checklist

Before going to production, ensure you've completed these steps:

- [ ] Set `POCKETBASE_ENCRYPTION_KEY` secret
- [ ] Use a strong admin password (20+ characters)
- [ ] Set `POCKETBASE_DEBUG=false` in production
- [ ] Enable HTTPS (automatically enforced in fly.toml)
- [ ] Set up regular database backups
- [ ] Review and restrict CORS settings in PocketBase admin
- [ ] Configure proper authentication rules for collections
- [ ] Keep PocketBase updated (auto-updates are configured)
- [ ] Monitor application logs regularly
- [ ] Use Fly.io secrets instead of environment variables

## 🔐 Encryption

### Settings Encryption

PocketBase stores application settings (OAuth2 secrets, SMTP passwords, etc.) in the database. By default, these are stored as plain JSON.

**Always enable encryption in production:**

```bash
# Generate a secure 32-character encryption key
fly secrets set POCKETBASE_ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

**Important:**
- Save this key securely - you'll need it for migrations
- Never commit this key to version control
- If lost, you'll need to reconfigure all encrypted settings

### Database Encryption

SQLite database files are not encrypted by default. For additional security:

1. **Use Fly.io's private networking** (already configured in fly.toml)
2. **Encrypt backups** when storing off-site
3. **Consider application-level encryption** for sensitive data

## 🔑 Authentication & Access Control

### Admin Account

**Initial Setup:**

```bash
# Option 1: Set via secrets (before first deployment)
fly secrets set POCKETBASE_ADMIN_EMAIL="admin@yourdomain.com"
fly secrets set POCKETBASE_ADMIN_PASSWORD="$(openssl rand -base64 24)"
```

**Option 2:** Create manually via the Admin UI after deployment (recommended)

**Security Tips:**
- Use a unique, strong password (password manager recommended)
- Enable 2FA when available in future PocketBase versions
- Limit admin panel access to trusted IPs if possible
- Use a dedicated admin email, not your personal email

### Collection Rules

Configure proper API rules for each collection in the PocketBase admin:

```javascript
// Example: Only authenticated users can read
@request.auth.id != ""

// Example: Users can only edit their own records
@request.auth.id = id

// Example: Only admins can create
@request.auth.role = "admin"
```

## 🌐 Network Security

### HTTPS

HTTPS is automatically enforced via [fly.toml](fly.toml:10):

```toml
[http_service]
force_https = true
```

### CORS

Configure CORS in PocketBase Admin Settings:

1. Navigate to Settings → Application
2. Set allowed origins explicitly:
   ```
   https://yourdomain.com
   https://app.yourdomain.com
   ```
3. Avoid using `*` in production

### Rate Limiting

Consider implementing rate limiting:

1. **Fly.io level:** Use Fly.io's edge rate limiting
2. **Application level:** Configure in PocketBase settings
3. **Middleware:** Add custom rate limiting middleware if needed

## 🗄️ Database Security

### Backups

**Automated Backup Strategy:**

1. **Use the included backup script:**
   ```bash
   ./backup.sh
   ```

2. **Schedule regular backups:**
   ```bash
   # Add to cron (daily at 2 AM)
   0 2 * * * /path/to/backup.sh >> /var/log/pocketbase-backup.log 2>&1
   ```

3. **Store backups securely:**
   - Encrypt backup files before uploading to cloud storage
   - Keep multiple versions (7 daily, 4 weekly, 12 monthly)
   - Test restore procedure regularly

### Volume Security

Fly.io volumes are:
- ✅ Encrypted at rest
- ✅ Only accessible by your app
- ✅ Isolated per region

**Additional protection:**
```bash
# Limit volume access in fly.toml
[[mounts]]
destination = "/pocketbase/data"
source = "pb_data"
# Volume is only accessible by the app
```

## 📊 Monitoring & Logging

### Log Monitoring

**View logs:**
```bash
fly logs -a al-salam-sys
```

**Watch for suspicious activity:**
- Failed authentication attempts
- Unusual API patterns
- Database errors
- Rate limit violations

**Set up alerts** (via Fly.io or external service):
- High error rates
- Unusual traffic patterns
- Failed deployments
- Volume near capacity

### Health Checks

Health checks are configured in [fly.toml](fly.toml:20-25):

```toml
[[http_service.checks]]
grace_period = "10s"
interval = "30s"
method = "GET"
path = "/_/"
timeout = "5s"
```

**Monitor health check failures:**
```bash
fly checks list -a al-salam-sys
```

## 🔄 Updates & Patches

### Automated Updates

This repository includes automated PocketBase version checking:

1. GitHub Actions checks daily for updates
2. Automatically creates PRs with new versions
3. Review changelog before merging
4. Deploy updates promptly for security patches

**Manual check:**
```bash
# Check current version
fly ssh console -a al-salam-sys -C "pocketbase --version"

# Check latest version
curl -s https://api.github.com/repos/pocketbase/pocketbase/releases/latest | jq -r .tag_name
```

### Security Advisories

Subscribe to:
- [PocketBase GitHub Releases](https://github.com/pocketbase/pocketbase/releases)
- [Fly.io Status](https://status.flyio.net/)
- This repository's GitHub notifications

## 🚫 Common Security Mistakes

### ❌ DON'T:
- Commit secrets or API keys to version control
- Use default/weak admin passwords
- Disable HTTPS
- Expose admin panel without authentication
- Use `*` for CORS in production
- Skip backups
- Ignore security updates
- Store sensitive data unencrypted
- Use `POCKETBASE_DEBUG=true` in production

### ✅ DO:
- Use Fly.io secrets for sensitive data
- Generate strong, unique passwords
- Enable encryption for settings
- Configure strict collection rules
- Regularly backup database
- Monitor logs for suspicious activity
- Keep PocketBase updated
- Use HTTPS everywhere
- Implement rate limiting
- Test disaster recovery procedures

## 🆘 Incident Response

### If You Suspect a Security Breach:

1. **Immediately:**
   - Rotate all secrets: `fly secrets set POCKETBASE_ENCRYPTION_KEY="$(openssl rand -base64 32)"`
   - Change admin password
   - Review recent logs: `fly logs -a al-salam-sys | grep -i auth`

2. **Investigate:**
   - Check database for unauthorized access
   - Review API access logs
   - Identify compromised accounts

3. **Remediate:**
   - Invalidate all sessions
   - Force password reset for affected users
   - Apply security patches
   - Restore from backup if necessary

4. **Prevent:**
   - Update security rules
   - Implement additional monitoring
   - Document lessons learned

### Data Breach Notification

If personal data is compromised:
1. Follow local data protection laws (GDPR, CCPA, etc.)
2. Notify affected users promptly
3. Document incident response
4. Review and improve security measures

## 📚 Security Resources

- [PocketBase Security Docs](https://pocketbase.io/docs/going-to-production/)
- [Fly.io Security](https://fly.io/docs/about/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [SQLite Security](https://www.sqlite.org/security.html)

## 📧 Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email: [Create a private security advisory on GitHub](https://github.com/Muayyad1999/pocketbase-flyio/security/advisories/new)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## 🏆 Security Best Practices Summary

1. **Encrypt everything:** Settings, backups, transport
2. **Authenticate properly:** Strong passwords, proper collection rules
3. **Monitor constantly:** Logs, health checks, alerts
4. **Update regularly:** PocketBase, dependencies, OS
5. **Backup religiously:** Automated, tested, encrypted
6. **Limit access:** Principle of least privilege
7. **Document everything:** Security policies, incident response
8. **Test thoroughly:** Security audits, penetration testing

---

**Remember:** Security is an ongoing process, not a one-time setup. Review and update your security measures regularly!
