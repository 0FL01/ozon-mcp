#!/usr/bin/env node

/**
 * Lightweight build script for Safari extension
 * Zero npm dependencies - just file copying using Node.js built-ins
 *
 * Safari extensions are Xcode projects with web extension resources bundled inside.
 * This script:
 * 1. Builds web extension files (based on Chrome)
 * 2. Applies Safari-specific modifications
 * 3. Copies to Safari extension Resources directory
 *
 * Usage: node build-safari.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const chromeSrc = path.join(__dirname, 'chrome');
const sharedSrc = path.join(__dirname, 'shared');
const safariResources = path.join(__dirname, 'safari', 'Blueprint MCP Extension', 'Resources');

console.log('🔨 Building Safari extension...\n');

// Check if Safari extension exists
if (!fs.existsSync(safariResources)) {
  console.error('❌ Safari extension not found at:', safariResources);
  console.error('Run: xcrun safari-web-extension-converter to create Safari extension first');
  process.exit(1);
}

// Clean Safari resources (except Xcode-managed files)
console.log('🧹 Cleaning Safari resources...');
const entries = fs.readdirSync(safariResources);
for (const entry of entries) {
  // Keep Xcode-managed files
  if (entry === '_locales' || entry === 'images') {
    continue;
  }

  const fullPath = path.join(safariResources, entry);
  const stat = fs.statSync(fullPath);

  if (stat.isDirectory()) {
    fs.rmSync(fullPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(fullPath);
  }
}
console.log('✓ Cleaned Safari resources\n');

// Copy Chrome extension files (excluding build artifacts)
console.log('📦 Copying web extension files...');
copyDirectory(chromeSrc, safariResources, {
  exclude: [
    'node_modules',
    'dist',
    'src',  // We'll copy specific src files
    'tests',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.ui.json',
    'vite.config.mts',
    'vite.content.config.mts',
    'vite.sw.config.mts',
    '.gitignore',
    'README.md'
  ]
});

// Create src directory
const safariSrcDir = path.join(safariResources, 'src');
if (!fs.existsSync(safariSrcDir)) {
  fs.mkdirSync(safariSrcDir, { recursive: true });
}

// Copy vanilla JS source files
fs.copyFileSync(
  path.join(chromeSrc, 'src', 'background-module.js'),
  path.join(safariSrcDir, 'background-module.js')
);

fs.copyFileSync(
  path.join(chromeSrc, 'src', 'content-script.js'),
  path.join(safariSrcDir, 'content-script.js')
);

console.log('✓ Web extension files copied\n');

// Copy shared modules
console.log('📦 Copying shared modules...');
const safariSharedDir = path.join(safariResources, 'shared');
copyDirectory(sharedSrc, safariSharedDir);
console.log('✓ Shared modules copied\n');

// Apply Safari-specific modifications to manifest.json
console.log('🔧 Applying Safari-specific modifications...');
const manifestPath = path.join(safariResources, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Update name and title
manifest.name = 'Blueprint MCP for Safari';
manifest.action.default_title = 'Blueprint MCP for Safari';

// Remove unsupported permissions
manifest.permissions = manifest.permissions.filter(
  p => p !== 'debugger' && p !== 'management'
);

// Write modified manifest
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('✓ Safari-specific modifications applied\n');

// Update BrowserAdapter to detect Safari
console.log('🔧 Updating BrowserAdapter for Safari...');
const adapterPath = path.join(safariSharedDir, 'adapters', 'browser.js');
let adapterContent = fs.readFileSync(adapterPath, 'utf8');

// Add Safari detection if not already present
if (!adapterContent.includes('safari')) {
  adapterContent = adapterContent.replace(
    /export function detectBrowser\(\) \{\s+if \(typeof browser !== 'undefined' && browser\.runtime\) \{\s+return 'firefox';/,
    `export function detectBrowser() {
  if (typeof browser !== 'undefined' && browser.runtime) {
    // Safari also uses 'browser' API, check user agent to differentiate
    if (typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
      return 'safari';
    }
    return 'firefox';`
  );

  fs.writeFileSync(adapterPath, adapterContent);
  console.log('✓ BrowserAdapter updated\n');
} else {
  console.log('✓ BrowserAdapter already supports Safari\n');
}

// Done!
console.log('✅ Build complete!\n');
console.log(`📍 Extension ready at: ${safariResources}`);
console.log('📝 To build and run:');
console.log('   1. Open safari/Blueprint MCP.xcodeproj in Xcode');
console.log('   2. Build and run (Cmd+R)');
console.log('   3. Enable extension in Safari preferences\n');

/**
 * Copy a directory recursively
 */
function copyDirectory(src, dest, options = {}) {
  const exclude = options.exclude || [];

  // Create destination directory
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    // Skip excluded items
    if (exclude.includes(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy directory
      copyDirectory(srcPath, destPath, options);
    } else {
      // Copy file
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
