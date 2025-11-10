#!/bin/bash
set -e

# Blueprint MCP Release Script
# Complete local release workflow with changelog generation

# Parse arguments
AUTO_YES=false
VERSION_TYPE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -y|--yes)
      AUTO_YES=true
      shift
      ;;
    patch|minor|major)
      VERSION_TYPE=$1
      shift
      ;;
    *)
      echo "❌ Error: Unknown argument '$1'"
      echo "   Usage: ./release.sh [patch|minor|major] [-y|--yes]"
      exit 1
      ;;
  esac
done

# Default to patch if not specified
VERSION_TYPE=${VERSION_TYPE:-patch}

echo "🚀 Blueprint MCP Release Script"
echo ""

# ============================================================================
# 1. PRE-FLIGHT CHECKS
# ============================================================================

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from project root directory"
  exit 1
fi

# Check we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "❌ Error: Must be on main branch (currently on $CURRENT_BRANCH)"
  echo "   Switch with: git checkout main"
  exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Error: Working directory has uncommitted changes"
  echo "   Commit or stash your changes first"
  git status --short
  exit 1
fi

# Pull latest from remote
echo "📥 Pulling latest from origin/main..."
git pull origin main -q

# Copy README to server directory for npm package
echo "📄 Copying README to server directory..."
cp README.md server/README.md
echo "  ✅ README copied"

# ============================================================================
# 2. VERSION BUMPING
# ============================================================================

echo "📦 Bumping version ($VERSION_TYPE)..."
echo ""

# Update server package.json
echo "  → Updating server/package.json..."
cd server
npm version $VERSION_TYPE --no-git-tag-version
cd ..

# Get new version from server
NEW_VERSION=$(node -p "require('./server/package.json').version")
echo "  ✅ New version: $NEW_VERSION"

# Update root package.json (monorepo)
echo "  → Updating root package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update Chrome extension
echo "  → Updating extensions/chrome/package.json..."
cd extensions/chrome
npm version $NEW_VERSION --no-git-tag-version --allow-same-version
cd ../..

# Update Chrome manifest.json
echo "  → Updating extensions/chrome/manifest.json..."
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('extensions/chrome/manifest.json', 'utf8'));
manifest.version = '$NEW_VERSION';
fs.writeFileSync('extensions/chrome/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
"

# Update Firefox manifest.json
echo "  → Updating extensions/firefox/manifest.json..."
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('extensions/firefox/manifest.json', 'utf8'));
manifest.version = '$NEW_VERSION';
fs.writeFileSync('extensions/firefox/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
"

# Update Opera manifest.json
echo "  → Updating extensions/opera/manifest.json..."
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('extensions/opera/manifest.json', 'utf8'));
manifest.version = '$NEW_VERSION';
fs.writeFileSync('extensions/opera/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
"

# Update Edge manifest.json
echo "  → Updating extensions/edge/manifest.json..."
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('extensions/edge/manifest.json', 'utf8'));
manifest.version = '$NEW_VERSION';
fs.writeFileSync('extensions/edge/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
"

echo "  ✅ All versions updated to $NEW_VERSION"
echo ""

# ============================================================================
# 3. CHANGELOG GENERATION
# ============================================================================

echo "📝 Generating CHANGELOG..."

# Get last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -z "$LAST_TAG" ]; then
  echo "  ℹ️  No previous tag found, generating changelog from all commits"
  COMMIT_RANGE="HEAD"
else
  echo "  ℹ️  Generating changelog since $LAST_TAG"
  COMMIT_RANGE="$LAST_TAG..HEAD"
fi

# Generate changelog entry
CHANGELOG_ENTRY="# v$NEW_VERSION ($(date +%Y-%m-%d))

## Changes

$(git log $COMMIT_RANGE --pretty=format:"- %s" --no-merges)

"

# Prepend to CHANGELOG.md or create it
if [ -f "CHANGELOG.md" ]; then
  echo "$CHANGELOG_ENTRY
$(cat CHANGELOG.md)" > CHANGELOG.md
else
  echo "$CHANGELOG_ENTRY" > CHANGELOG.md
fi

echo "  ✅ CHANGELOG.md updated"
echo ""

# ============================================================================
# 4. BUILD EXTENSIONS
# ============================================================================

echo "🔨 Building extensions..."
echo ""

# Build Chrome extension
echo "  → Building Chrome extension..."
cd extensions/chrome
npm ci -q
npm run build > /dev/null 2>&1
cd ../..
echo "  ✅ Chrome extension built"

# Build Firefox extension (needs shared modules copied)
echo "  → Building Firefox extension..."
cd extensions
node build-firefox.js > /dev/null 2>&1
cd ..
echo "  ✅ Firefox extension built"

# Build Opera extension (uses Chrome source)
echo "  → Building Opera extension..."
cd extensions
node build-opera.js > /dev/null 2>&1
cd ..
echo "  ✅ Opera extension built"

# Build Edge extension (uses Chrome source)
echo "  → Building Edge extension..."
cd extensions
node build-edge.js > /dev/null 2>&1
cd ..
echo "  ✅ Edge extension built"
echo ""

# ============================================================================
# 5. PACKAGE EXTENSIONS
# ============================================================================

echo "📦 Packaging extensions for store submission..."
echo ""

# Package Chrome extension
CHROME_ZIP="releases/chrome/blueprint-mcp-chrome-v$NEW_VERSION.zip"
echo "  → Creating $CHROME_ZIP..."
cd dist/chrome
zip -r ../../$CHROME_ZIP . -q
cd ../..
echo "  ✅ Chrome extension packaged: $CHROME_ZIP"

# Package Firefox extension
FIREFOX_ZIP="releases/firefox/blueprint-mcp-firefox-v$NEW_VERSION.zip"
echo "  → Creating $FIREFOX_ZIP..."
cd dist/firefox
zip -r ../../$FIREFOX_ZIP . -q \
  -x "*.git*" \
  -x "*node_modules*" \
  -x "*.DS_Store" \
  -x "build-info.json"
cd ../..
echo "  ✅ Firefox extension packaged: $FIREFOX_ZIP"

# Package Opera extension
OPERA_ZIP="releases/opera/blueprint-mcp-opera-v$NEW_VERSION.zip"
echo "  → Creating $OPERA_ZIP..."
cd dist/opera
zip -r ../../$OPERA_ZIP . -q \
  -x "*.DS_Store" \
  -x "*.env*" \
  -x "build-info.json"
cd ../..
echo "  ✅ Opera extension packaged: $OPERA_ZIP"

# Package Edge extension
EDGE_ZIP="releases/edge/blueprint-mcp-edge-v$NEW_VERSION.zip"
echo "  → Creating $EDGE_ZIP..."
cd dist/edge
zip -r ../../$EDGE_ZIP . -q \
  -x "*.DS_Store" \
  -x "*.env*" \
  -x "build-info.json"
cd ../..
echo "  ✅ Edge extension packaged: $EDGE_ZIP"
echo ""

# ============================================================================
# 6. COMMIT & TAG
# ============================================================================

echo "💾 Creating release commit..."

# Stage all changes
git add \
  package.json \
  server/package.json \
  server/package-lock.json \
  server/README.md \
  extensions/chrome/package.json \
  extensions/chrome/package-lock.json \
  extensions/chrome/manifest.json \
  extensions/firefox/manifest.json \
  extensions/opera/manifest.json \
  extensions/edge/manifest.json \
  releases/chrome/blueprint-mcp-chrome-v$NEW_VERSION.zip \
  releases/firefox/blueprint-mcp-firefox-v$NEW_VERSION.zip \
  releases/opera/blueprint-mcp-opera-v$NEW_VERSION.zip \
  releases/edge/blueprint-mcp-edge-v$NEW_VERSION.zip \
  CHANGELOG.md

# Commit
git commit -m "Release v$NEW_VERSION

- Bump version to $NEW_VERSION
- Update CHANGELOG
- Package Chrome, Firefox, Opera, and Edge extensions for store submission"

echo "  ✅ Changes committed"

# Create tag
echo "🏷️  Creating git tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
echo "  ✅ Tag created: v$NEW_VERSION"
echo ""

# ============================================================================
# 7. PUSH TO GITHUB
# ============================================================================

echo "📤 Pushing to GitHub..."
if [ "$AUTO_YES" = true ]; then
  REPLY="y"
else
  read -p "   Push commits and tags to origin/main? (y/n) " -n 1 -r
  echo
fi

if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push origin main -q
  git push origin "v$NEW_VERSION" -q
  echo "  ✅ Pushed to GitHub"
else
  echo "  ⏭️  Skipped GitHub push"
  echo "  ⚠️  Remember to push manually later:"
  echo "     git push origin main"
  echo "     git push origin v$NEW_VERSION"
fi
echo ""

# ============================================================================
# 8. PUBLISH TO NPM
# ============================================================================

echo "📦 Publishing to npm..."
if [ "$AUTO_YES" = true ]; then
  REPLY="y"
else
  read -p "   Publish @railsblueprint/blueprint-mcp@$NEW_VERSION to npm? (y/n) " -n 1 -r
  echo
fi

if [[ $REPLY =~ ^[Yy]$ ]]; then
  cd server
  npm publish --access public
  cd ..
  echo "  ✅ Published to npm"
  echo "  📍 https://www.npmjs.com/package/@railsblueprint/blueprint-mcp/v/$NEW_VERSION"
else
  echo "  ⏭️  Skipped npm publish"
  echo "  ⚠️  Remember to publish manually later:"
  echo "     cd server && npm publish --access public"
fi
echo ""

# ============================================================================
# 9. SUMMARY
# ============================================================================

echo "✨ Release v$NEW_VERSION complete!"
echo ""
echo "📋 Summary:"
echo "  • Version: $NEW_VERSION"
echo "  • Git tag: v$NEW_VERSION"
echo "  • Chrome zip: $CHROME_ZIP"
echo "  • Firefox zip: $FIREFOX_ZIP"
echo "  • Opera zip: $OPERA_ZIP"
echo "  • Edge zip: $EDGE_ZIP"
echo ""
echo "📝 Next steps:"
echo "  1. Upload Chrome extension to Chrome Web Store:"
echo "     → Open: https://chrome.google.com/webstore/devconsole"
echo "     → Upload: $CHROME_ZIP"
echo ""
echo "  2. Upload Firefox extension to Firefox Add-ons:"
echo "     → Open: https://addons.mozilla.org/developers"
echo "     → Upload: $FIREFOX_ZIP"
echo ""
echo "  3. Upload Opera extension to Opera Add-ons:"
echo "     → Open: https://addons.opera.com/developer"
echo "     → Upload: $OPERA_ZIP"
echo ""
echo "  4. Upload Edge extension to Microsoft Edge Add-ons:"
echo "     → Open: https://partner.microsoft.com/dashboard/microsoftedge/overview"
echo "     → Upload: $EDGE_ZIP"
echo ""
echo "  5. Update GitHub release notes:"
echo "     → Open: https://github.com/railsblueprint/blueprint-mcp/releases/tag/v$NEW_VERSION"
echo "     → Add release notes from CHANGELOG.md"
echo ""
