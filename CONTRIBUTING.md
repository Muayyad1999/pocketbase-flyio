# Contributing to PocketBase Fly.io

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## 🤝 How to Contribute

### Reporting Issues

1. **Search existing issues** first to avoid duplicates
2. **Use issue templates** when available
3. **Provide details:**
   - PocketBase version
   - Fly.io configuration
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs or screenshots

### Suggesting Features

1. Open an issue with the "enhancement" label
2. Describe the feature and use case
3. Explain why it would benefit the project
4. Provide examples if applicable

### Submitting Pull Requests

1. **Fork the repository**
2. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes:**
   - Follow existing code style
   - Test your changes locally
   - Update documentation if needed
   - Add/update tests if applicable

4. **Commit your changes:**
   ```bash
   git commit -m "feat: add amazing feature

   - Detailed description of changes
   - Why this change is needed
   - Any breaking changes

   Co-Authored-By: Your Name <your@email.com>"
   ```

5. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request:**
   - Provide clear description
   - Reference related issues
   - Wait for review

## 📋 Development Setup

### Prerequisites

- Docker & Docker Compose
- Fly.io CLI (for deployment testing)
- Git
- Basic shell scripting knowledge

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Muayyad1999/pocketbase-flyio.git
   cd pocketbase-flyio
   ```

2. **Build locally:**
   ```bash
   docker build -t pocketbase:dev .
   ```

3. **Run with Docker Compose:**
   ```bash
   docker compose up
   ```

4. **Access PocketBase:**
   - Open http://localhost:8090/_/
   - Create admin account

### Testing Changes

1. **Test Docker build:**
   ```bash
   docker build -t pocketbase:test .
   docker run --rm pocketbase:test pocketbase --version
   ```

2. **Test scripts:**
   ```bash
   # Validate shell scripts
   shellcheck scripts/*.sh

   # Test entrypoint
   docker run --rm pocketbase:test /opt/pocketbase/scripts/entrypoint.sh --help
   ```

3. **Test on Fly.io (if you have access):**
   ```bash
   # Deploy to test app
   fly deploy --app your-test-app
   ```

## 📝 Coding Guidelines

### Shell Scripts

- Use `#!/bin/bash` or `#!/bin/sh` shebang
- Follow [ShellCheck](https://www.shellcheck.net/) recommendations
- Add comments for complex logic
- Use meaningful variable names
- Handle errors with `set -e`

### Docker

- Multi-stage builds for smaller images
- Use specific versions, not `latest`
- Minimize layers
- Clean up in the same layer
- Use `.dockerignore` effectively

### Documentation

- Update README.md for user-facing changes
- Update DEPLOY.md for deployment changes
- Update CHANGELOG.md for notable changes
- Use clear, concise language
- Include code examples

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `chore:` Maintenance tasks
- `refactor:` Code refactoring
- `test:` Test updates
- `ci:` CI/CD changes

**Example:**
```
feat: add automated backup script

- Implements daily backup via cron
- Stores backups in configurable location
- Includes retention policy

Closes #123
```

## 🔄 Workflow

### Automated Updates

The repository includes GitHub Actions for:
- **Daily PocketBase version checks** - Creates PRs automatically
- **PR testing** - Validates Docker builds and scripts
- **Auto-deployment** - Deploys to Fly.io on merge

### Review Process

1. PRs require at least one approval
2. All CI checks must pass
3. Code should be tested locally
4. Documentation should be updated
5. Breaking changes need clear communication

## 🏗️ Project Structure

```
.
├── .github/
│   └── workflows/          # GitHub Actions workflows
│       ├── update-version.yml    # Auto-update PocketBase
│       ├── deploy-flyio.yml      # Auto-deploy to Fly.io
│       └── test-pr.yml           # PR validation
├── scripts/
│   ├── entrypoint.sh       # Container entrypoint
│   ├── libutil.sh          # Utility functions
│   └── pocketbase-env.sh   # Environment setup
├── .dockerignore           # Docker build exclusions
├── .env.example            # Environment template
├── .gitignore              # Git exclusions
├── backup.sh               # Backup utility script
├── CHANGELOG.md            # Version history
├── CONTRIBUTING.md         # This file
├── DEPLOY.md               # Deployment guide
├── Dockerfile              # Docker image definition
├── docker-compose.yml      # Local development
├── fly.toml                # Fly.io configuration
├── LICENSE                 # MIT License
├── Makefile                # Development commands
├── README.md               # Main documentation
└── SECURITY.md             # Security guidelines
```

## 🧪 Testing Checklist

Before submitting a PR, ensure:

- [ ] Docker image builds successfully
- [ ] Container starts without errors
- [ ] PocketBase version is correct
- [ ] Scripts pass ShellCheck
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated (for notable changes)
- [ ] Commits follow conventional commits format
- [ ] No secrets or sensitive data in commits
- [ ] Changes work on Fly.io (if applicable)

## 📚 Resources

- [PocketBase Documentation](https://pocketbase.io/docs/)
- [Fly.io Documentation](https://fly.io/docs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)

## 💬 Communication

- **GitHub Issues** - Bug reports, feature requests
- **Pull Requests** - Code contributions
- **Discussions** - General questions, ideas

## 🙏 Recognition

Contributors will be:
- Listed in release notes
- Credited in CHANGELOG.md
- Mentioned in commit co-authors

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
