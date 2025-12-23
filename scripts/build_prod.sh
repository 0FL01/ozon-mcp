#!/bin/bash
set -e

# Define directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$ROOT_DIR/server"
DIST_DIR="$ROOT_DIR/dist"

echo "Building Ozon MCP production binary..."

# Clean dist
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Install dependencies if needed (assuming server modules are present, but good to ensure)
cd "$SERVER_DIR"
# npm install # Skip to save time if already installed

# Build with pkg
echo "Running pkg..."
npx pkg . --out-path "$DIST_DIR" --compress GZip

echo "Build complete!"
echo "Binary location: $DIST_DIR/ozon-mcp"
ls -lh "$DIST_DIR/ozon-mcp"
