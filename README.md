# 🚀 PocketBase Docker for Fly.io

PocketBase&trade; is an open source backend consisting of embedded database (SQLite) with realtime subscriptions, built-in auth management, convenient dashboard UI and simple REST-ish API.

This repository provides a production-ready Docker setup for deploying PocketBase to [Fly.io](https://fly.io) with automated updates and CI/CD.

## ✨ Features

- 🐳 **Optimized Docker Image** - Multi-stage build with Alpine Linux
- ☁️ **Fly.io Ready** - Pre-configured `fly.toml` for instant deployment
- 🤖 **Auto-Updates** - GitHub Actions workflow checks for new PocketBase releases daily
- 🚢 **CI/CD Pipeline** - Automated deployment to Fly.io on push
- 🔒 **Security First** - Settings encryption, HTTPS enforcement, non-root user option
- 📦 **Persistent Storage** - Volume mounting for SQLite database
- 📊 **Health Checks** - Automatic monitoring and recovery
- 🔄 **Auto-Scaling** - Scale to zero for cost optimization

## 🚀 Quick Start

### Deploy to Fly.io (5 minutes)

```bash
# 1. Clone this repository
git clone https://github.com/Muayyad1999/pocketbase-flyio.git
cd pocketbase-flyio

# 2. Login to Fly.io
fly auth login

# 3. Create persistent volume
fly volumes create pb_data --region ams --size 1

# 4. Set encryption key (recommended)
fly secrets set POCKETBASE_ENCRYPTION_KEY="$(openssl rand -base64 32)"

# 5. Deploy!
fly deploy

# 6. Open your app
fly open
```

**📖 For detailed deployment instructions, see [DEPLOY.md](DEPLOY.md)**

## 📚 Documentation

- [PocketBase Official Docs](https://pocketbase.io/docs)
- [Deployment Guide](DEPLOY.md) - Complete fly.io deployment walkthrough
- [Changelog](CHANGELOG.md) - Version history and updates


## 🤖 Automated Updates

This repository includes a GitHub Actions workflow that:

- ✅ Checks for new PocketBase releases **daily**
- ✅ Automatically creates a Pull Request with version updates
- ✅ Updates the CHANGELOG.md
- ✅ Can be triggered manually via GitHub Actions

**Current Version:** PocketBase v0.35.1 on Alpine Linux 3.22.2

### Enable Auto-Deployment (Optional)

To enable automatic deployment to Fly.io when PRs are merged:

1. Generate a Fly.io deploy token:
   ```bash
   fly tokens create deploy
   ```

2. Add it as a GitHub Secret:
   - Go to: Repository → Settings → Secrets → Actions
   - Name: `FLY_API_TOKEN`
   - Value: [your token]

Now every push to `master` will automatically deploy to Fly.io! 🎉

## 🐳 Docker Usage

### Build Locally

```bash
docker build -t pocketbase:local .
```

### Run with Docker Compose

```bash
docker compose up -d
```

Access at: `http://localhost:8090`


## Configuration

### Environment variables

When you start the PocketBase&trade; image, you can adjust the configuration of the instance by passing one or more environment variables either on the docker-compose file or on the `docker run` command line. If you want to add a new environment variable:

- For docker-compose add the variable name and value under the application section in the [`docker-compose.yml`](https://github.com/adrianmusante/docker-pocketbase/blob/main/docker-compose.example.yml) file present in this repository:

    ```yaml
    pocketbase:
      ...
      environment:
        - USER_DEFINED_KEY=custom_value
      ...
    ```

- For manual execution add a `--env` option with each variable and value:

    ```console
    $ docker run -d --name pocketbase -p 80:8090 \
      --env USER_DEFINED_KEY=custom_value \
      --network pocketbase_network \
      --volume /path/to/pocketbase-persistence:/pocketbase \
      adrianmusante/pocketbase:latest
    ```

Available environment variables:

##### General configuration

- `POCKETBASE_DEBUG`: Verbose mode. Default: **false**
- `POCKETBASE_PORT_NUMBER`: PocketBase&trade; server port number. Default: **8090**
- `POCKETBASE_OPTS`: Additional options for bootstrap server. No defaults.
- `POCKETBASE_ADMIN_EMAIL`: Admin user email. No defaults.
- `POCKETBASE_ADMIN_PASSWORD`: Admin user password. It is possible to use Docker secrets to define the value or set the `POCKETBASE_ADMIN_PASSWORD_FILE` variable which will contain the path where the value is stored. No defaults.
- `POCKETBASE_ADMIN_UPSERT`: If set to `true`, the admin user always is set from environment variables before the server starts. Otherwise, set to `false` for only create in the first startup. Default: **true**

##### Encryption

- `POCKETBASE_ENCRYPTION_KEY`: The variable is used to encrypt the applications settings in PocketBase's database. By default, these settings are stored as plain JSON text, which may not be suitable for production environments where security is a concern. When you set this variable to a value, PocketBase will use it to encrypt the settings before storing them in the database. This provides an additional layer of protection against unauthorized access to your application's sensitive data, such as OAuth2 client secrets and SMTP passwords. (ref.: [pocketbase.io](https://pocketbase.io/docs/going-to-production/#enable-settings-encryption))
- `POCKETBASE_ENCRYPTION_KEY_FILE`: Alternative to `POCKETBASE_ENCRYPTION_KEY` environment variable. If Docker manages the secret, this variable is used to reference the name with which the secret was created. An absolute path can also be specified if the secret was mounted as a file using a volume. Default: **POCKETBASE_ENCRYPTION_KEY**

##### Directories

- `POCKETBASE_WORKDIR` Persistence base directory. Default: **/pocketbase**
- `POCKETBASE_DATA_DIR` PocketBase data directory. Default: **${POCKETBASE_WORKDIR}/data**
- `POCKETBASE_MIGRATION_DIR` The directory with the user defined migrations. Default: **${POCKETBASE_WORKDIR}/migrations**
- `POCKETBASE_PUBLIC_DIR` The directory to serve static files. Default: **${POCKETBASE_WORKDIR}/public**
- `POCKETBASE_HOOK_DIR` The directory with the JS app hooks. Default: **${POCKETBASE_WORKDIR}/hooks**
