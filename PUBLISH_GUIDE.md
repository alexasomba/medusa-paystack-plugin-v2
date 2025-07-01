# 🚀 Auto-Publish Guide

## Quick Release Process

### 1. Create and Push a Git Tag

```bash
# Example: Publishing version 1.3.4
git tag v1.3.4
git push origin v1.3.4
```

### 2. What Happens Automatically

1. **GitHub Actions Triggers**: The publish workflow starts automatically
2. **Testing**: Runs tests and builds on Node.js 18.x and 20.x
3. **Validation**: Verifies package.json version matches the git tag
4. **Build**: Creates the plugin build in `.medusa/server/`
5. **Publish**: Publishes to npm with the NPM_TOKEN
6. **Release**: Creates a GitHub release with auto-generated notes

### 3. Monitoring the Process

- Go to: https://github.com/alexasomba/medusa-paystack-plugin-v2/actions
- Watch the "Publish to NPM" workflow run
- Check for any errors in the workflow logs

## Manual Release Process (Alternative)

### Option A: Using npm version command

```bash
# Automatically updates package.json, creates git tag, and triggers publish
npm version patch  # 1.3.4 → 1.3.5
npm version minor  # 1.3.4 → 1.4.0  
npm version major  # 1.3.4 → 2.0.0

# Push the tag to trigger GitHub Actions
git push origin main --tags
```

### Option B: Manual version update

```bash
# 1. Update version in package.json
# 2. Commit the change
git add package.json
git commit -m "chore: bump version to 1.3.5"
git push origin main

# 3. Create and push tag
git tag v1.3.5
git push origin v1.3.5
```

## Troubleshooting

### ❌ Workflow Fails: "NPM_TOKEN not found"
- Verify NPM_TOKEN is added to GitHub repository secrets
- Check the token has correct permissions for your package

### ❌ Workflow Fails: "Version mismatch"
- Ensure package.json version matches the git tag
- Tag: `v1.3.4` should match package.json: `"version": "1.3.4"`

### ❌ Workflow Fails: "Build errors"
- Run `npm run build` locally to check for TypeScript errors
- Fix any compilation issues before tagging

### ❌ Workflow Fails: "Cannot publish over existing version"
- The version is already published to npm
- Update the version number and create a new tag

## Verification

After successful publish:

1. **Check npm**: https://www.npmjs.com/package/@alexasomba/medusa-paystack-plugin-v2
2. **Check GitHub Releases**: https://github.com/alexasomba/medusa-paystack-plugin-v2/releases
3. **Test Installation**: `npm install @alexasomba/medusa-paystack-plugin-v2@latest`

## Next Release Example

To publish version 1.3.5:

```bash
# Update package.json version to 1.3.5
npm version patch

# This creates the tag and commits automatically
git push origin main --tags
```

The GitHub Actions will handle the rest automatically! 🎉
