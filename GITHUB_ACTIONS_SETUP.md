# GitHub Actions Auto-Publish Setup Guide

This guide explains how to set up automated npm publishing for the Medusa Paystack Plugin v2.

## 📋 Prerequisites

1. **NPM Account**: You need an npm account with publishing rights
2. **GitHub Repository**: The plugin code should be in a GitHub repository
3. **NPM Access Token**: Required for GitHub Actions to publish to npm

## 🔑 Step 1: Create NPM Access Token

1. Go to [npmjs.com](https://www.npmjs.com) and log in
2. Click your avatar → "Access Tokens"
3. Click "Generate New Token" → "Granular Access Token"
4. Configure the token:
   - **Name**: `GitHub Actions - medusa-paystack-plugin-v2`
   - **Expiration**: Choose based on your security preferences
   - **Packages and scopes**: Select your package `@alexasomba/medusa-paystack-plugin-v2`
   - **Permissions**: `Read and write`
5. Click "Generate Token" and copy the token (starts with `npm_`)

## 🔐 Step 2: Add NPM Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add the secret:
   - **Name**: `NPM_TOKEN`
   - **Secret**: Paste your npm token from Step 1
5. Click **"Add secret"**

## 📦 Step 3: Verify Package Configuration

Ensure your `package.json` has the correct configuration:

```json
{
  "name": "@alexasomba/medusa-paystack-plugin-v2",
  "version": "1.3.3",
  "publishConfig": {
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/alexasomba/medusa-paystack-plugin-v2.git"
  },
  "files": [
    ".medusa/server",
    "README.md",
    "package.json"
  ],
  "scripts": {
    "build": "medusa plugin:build",
    "prepublishOnly": "medusa plugin:build"
  }
}
```

## 🚀 Step 4: Publishing Workflow

### Automatic Publishing (Recommended)

The GitHub Actions are configured to publish automatically when you create a release tag:

```bash
# 1. Update version in package.json
npm version patch  # or minor/major

# 2. Push the tag to GitHub
git push origin --tags

# 3. GitHub Actions will automatically:
#    - Run tests
#    - Build the plugin
#    - Publish to npm
#    - Create a GitHub release
```

### Manual Publishing

You can also trigger publishing manually:

```bash
# Build and publish locally
npm run build
npm publish
```

## 📋 Step 5: Workflow Features

Our GitHub Actions provide:

### ✅ **CI Workflow** (`.github/workflows/ci.yml`)
- Runs on every push and PR
- Tests on Node.js 18.x and 20.x
- Validates package configuration
- Builds the plugin
- Dry-run publish test

### ✅ **Publish Workflow** (`.github/workflows/publish.yml`)
- Triggers on version tags (`v*.*.*`)
- Runs comprehensive tests
- Validates version consistency
- Publishes to npm
- Creates GitHub releases

## 🔄 Step 6: Release Process

### For Bug Fixes (Patch Release)
```bash
npm version patch    # 1.3.3 → 1.3.4
git push origin --tags
```

### For New Features (Minor Release)
```bash
npm version minor    # 1.3.3 → 1.4.0
git push origin --tags
```

### For Breaking Changes (Major Release)
```bash
npm version major    # 1.3.3 → 2.0.0
git push origin --tags
```

## 🛠️ Step 7: Troubleshooting

### Common Issues

**❌ "npm ERR! 403 Forbidden"**
- Check if NPM_TOKEN secret is correctly set
- Verify token has write permissions for your package
- Ensure token hasn't expired

**❌ "Version already exists"**
- Update version in package.json before tagging
- Use `npm version` commands to handle this automatically

**❌ "Build failed"**
- Check that all dependencies are in package.json
- Verify build script works locally: `npm run build`

**❌ "Tag doesn't trigger workflow"**
- Ensure tag follows `v*.*.*` format (e.g., `v1.3.4`)
- Check GitHub Actions tab for workflow status

### Debug Steps

1. **Check workflow logs** in GitHub Actions tab
2. **Verify secrets** are set correctly in repository settings
3. **Test locally** with `npm run build && npm publish --dry-run`
4. **Check npm token** permissions and expiration

## 📊 Step 8: Monitoring

### GitHub Actions
- Monitor workflows in the **Actions** tab
- Check for failed builds or publishing errors
- Review logs for debugging information

### NPM Package
- Verify published versions at: https://www.npmjs.com/package/@alexasomba/medusa-paystack-plugin-v2
- Check download statistics and usage

### GitHub Releases
- Automated release notes are created
- Tags and releases are visible in the **Releases** section

## 🎯 Best Practices

1. **Version Consistently**: Use semantic versioning (semver)
2. **Test Before Release**: Ensure CI passes before tagging
3. **Update Documentation**: Keep README.md current with examples
4. **Monitor Dependencies**: Keep Medusa and other deps updated
5. **Security**: Regularly rotate npm tokens
6. **Backup**: Keep local backups of important releases

## 📝 Example Release Checklist

- [ ] Update version in package.json
- [ ] Update CHANGELOG.md (if you have one)
- [ ] Test locally: `npm run build`
- [ ] Commit changes: `git commit -m "chore: bump version to 1.3.4"`
- [ ] Create tag: `npm version patch`
- [ ] Push tag: `git push origin --tags`
- [ ] Monitor GitHub Actions for successful publish
- [ ] Verify package on npmjs.com
- [ ] Test installation: `npm install @alexasomba/medusa-paystack-plugin-v2@latest`

---

🎉 **You're all set!** Your plugin will now automatically publish to npm when you create version tags.
