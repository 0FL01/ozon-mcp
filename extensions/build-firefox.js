#!/usr/bin/env node

/**
 * Lightweight build script for Firefox extension
 *
 * No npm dependencies - uses only Node.js built-ins
 * Copies extension files and shared modules to dist/firefox
 */

const fs = require('fs');
const path = require('path');

// Paths
const rootDir = __dirname;
const firefoxSrc = path.join(rootDir, 'firefox');
const sharedSrc = path.join(rootDir, 'shared');
const distDir = path.join(rootDir, '..', 'dist', 'firefox');

console.log('🔨 Building Firefox extension...\n');

// Clean dist directory
if (fs.existsSync(distDir)) {
  console.log('🧹 Cleaning dist/firefox...');
  fs.rmSync(distDir, { recursive: true, force: true });
}

// Create dist directory
fs.mkdirSync(distDir, { recursive: true });
console.log('✓ Created dist/firefox\n');

// Copy firefox extension files
console.log('📦 Copying Firefox extension files...');
copyDirectory(firefoxSrc, distDir, {
  exclude: ['shared', 'node_modules', 'public', 'package.json', 'package-lock.json', '.env.example', '.gitignore', 'PRO_MODE.md'],
  fileFilter: (filename) => {
    // Exclude logo source files (1.5MB total, not used in runtime)
    return !filename.includes('logo-source');
  }
});
console.log('✓ Firefox files copied\n');

// Copy shared modules
console.log('📦 Copying shared modules...');
const sharedDest = path.join(distDir, 'shared');
copyDirectory(sharedSrc, sharedDest);
console.log('✓ Shared modules copied\n');

// Write build timestamp
const buildTimestamp = new Date().toISOString();
const buildInfoPath = path.join(distDir, 'build-info.json');
fs.writeFileSync(buildInfoPath, JSON.stringify({
  timestamp: buildTimestamp,
  timestampUnix: Date.now()
}, null, 2));
console.log('✓ Build timestamp written\n');

console.log('✅ Build complete!\n');
console.log('📍 Extension ready at: dist/firefox');
console.log(`🕐 Build timestamp: ${buildTimestamp}`);
console.log('📝 Load in Firefox: about:debugging#/runtime/this-firefox\n');

/**
 * Recursively copy directory
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
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip excluded items
    if (exclude.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively copy directory
      copyDirectory(srcPath, destPath, options);
    } else if (entry.isFile()) {
      // Check fileFilter if provided
      if (options.fileFilter && !options.fileFilter(entry.name)) {
        continue;
      }
      // Copy file
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
