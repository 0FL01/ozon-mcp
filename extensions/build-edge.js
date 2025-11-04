#!/usr/bin/env node

/**
 * Build script for Edge extension
 * Edge is Chromium-based, so we use the Chrome source code
 * with Edge-specific manifest
 *
 * Usage: node build-edge.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const edgeSrc = path.join(__dirname, 'edge');
const chromeSrc = path.join(__dirname, 'chrome');
const sharedSrc = path.join(__dirname, 'shared');
const distDir = path.join(__dirname, '..', 'dist', 'edge');

console.log('🔨 Building Edge extension...\n');

// Clean and create dist directory
console.log('🧹 Cleaning dist/edge...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });
console.log('✓ Created dist/edge\n');

// Copy Chrome extension files (excluding manifest.json - we'll use Edge's)
console.log('📦 Copying Chrome extension files...');
copyDirectory(chromeSrc, distDir, {
  exclude: [
    'node_modules',
    'dist',
    'src',  // We'll copy specific src files
    'tests',
    'public',  // Dev test files, not needed in production
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.ui.json',
    'vite.config.mts',
    'vite.content.config.mts',
    'vite.sw.config.mts',
    'eslint.config.mjs',
    '.gitignore',
    '.DS_Store',
    '.env.example',
    'README.md',
    'manifest.json'  // Exclude Chrome manifest - we'll use Edge's
  ]
});

// Create src directory in dist
const distSrcDir = path.join(distDir, 'src');
fs.mkdirSync(distSrcDir, { recursive: true });

// Copy vanilla JS source files from Chrome
fs.copyFileSync(
  path.join(chromeSrc, 'src', 'background-module.js'),
  path.join(distSrcDir, 'background-module.js')
);

fs.copyFileSync(
  path.join(chromeSrc, 'src', 'content-script.js'),
  path.join(distSrcDir, 'content-script.js')
);

console.log('✓ Chrome files copied\n');

// Copy Edge-specific manifest
console.log('📦 Copying Edge manifest...');
fs.copyFileSync(
  path.join(edgeSrc, 'manifest.json'),
  path.join(distDir, 'manifest.json')
);
console.log('✓ Edge manifest copied\n');

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

// Done!
console.log('✅ Build complete!\n');
console.log(`📍 Extension ready at: ${distDir}`);
console.log(`🕐 Build timestamp: ${buildTimestamp}`);
console.log('📝 Load in Edge: edge://extensions/ → Developer mode → Load unpacked → Select dist/edge');

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
