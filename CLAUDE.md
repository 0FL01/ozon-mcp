# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Blueprint MCP for Chrome is an MCP (Model Context Protocol) server + browser extensions that allow AI applications to automate the user's existing browser session. Unlike typical browser automation tools, this project uses the user's real browser profile to maintain logged-in sessions and avoid bot detection.

**Current Version:** 1.5.5
**Total Features:** 200+
**Total Commits:** 599+

**Supported Browsers:**
- ✅ Chrome - TypeScript extension (4,000 lines + build step)
- ✅ Firefox - Vanilla JS extension (2,000 lines, no build)
- 🚧 Safari - Planned (will share vanilla JS code with Chrome rewrite)

**Key Features:**
- Fast local automation without network latency
- Private - browser activity stays on device (Free tier)
- Cloud relay with OAuth2 (PRO tier)
- Uses existing browser profile and logged-in sessions
- Stealth mode - uses real browser fingerprint to avoid bot detection
- Tech stack detection - Auto-detects 40+ frameworks/libraries
- Auto-reconnection - Survives browser/extension reloads

**Credits:** Originally inspired by Microsoft's Playwright MCP, but completely rewritten for Chrome extension-based automation

## Development Commands

### Server Development
```bash
cd server

# Run MCP server in debug mode
node cli.js --debug

# Run with custom log file and port
node cli.js --debug --log-file ../logs/custom.log --port 5556

# Test the server
npm test

# Version bump and release (from root)
cd ..
./release.sh
```

### Chrome Extension Development (TypeScript + Vite)
```bash
cd extensions/chrome

# Install dependencies
npm install

# Build extension
npm run build

# Watch mode for development
npm run dev

# Load unpacked extension from extensions/chrome/dist/
```

### Temporary Files & Logs

**IMPORTANT:** When creating temporary test files or debugging artifacts:

- **Use `tmp/` folder** - For all temporary test files, debug outputs, and experimental code
- **Use `logs/` folder** - Server logs are written here by default (mcp-debug.log)
- Both folders are gitignored (except .keep files)
- These folders are at the project root, not in server/

```bash
# Example: Create a test file
echo "test data" > tmp/my-test.json

# Example: Create a debug output
node -e "console.log('test')" > tmp/debug-output.txt

# Logs are automatically written to logs/ in debug mode
ls logs/mcp-debug.log
```

### Firefox Extension Development (Vanilla JS)
```bash
cd extensions/firefox

# No build step needed - pure vanilla JS
# Load unpacked from extensions/firefox/ directly
# about:debugging -> Load Temporary Add-on
```

## Architecture Overview

### Technology Stack
- **Server Runtime:** Node.js 18+
- **Server Language:** JavaScript (ES6+)
- **Chrome Extension:** TypeScript (will migrate to vanilla JS)
- **Firefox Extension:** Vanilla JS (no build step)
- **MCP SDK:** @modelcontextprotocol/sdk v1.17+
- **Communication:** WebSocket (ws v8.18+)
- **CLI:** Commander v14.0+
- **Chrome Extension Build:** Vite (to be removed in vanilla JS rewrite)

### Project Structure

```
blueprint-mcp/
├── cli.js                      # MCP server entry point
├── src/
│   ├── statefulBackend.js      # Connection state management (passive/active/connected)
│   ├── unifiedBackend.js       # MCP tool implementations (20 browser tools)
│   ├── extensionServer.js      # WebSocket server for extension (port 5555)
│   ├── mcpConnection.js        # Proxy/relay connection handling
│   ├── transport.js            # DirectTransport / ProxyTransport abstraction
│   ├── oauth.js                # OAuth2 client for PRO features
│   └── fileLogger.js           # Debug logging
├── extension/                  # Chrome Extension (TypeScript + Vite)
│   └── src/
│       ├── background.ts       # Extension service worker
│       ├── relayConnection.ts  # WebSocket client to MCP server
│       ├── content-script.ts   # Page content injection + tech stack detection
│       └── utils/
│           ├── jwt.ts          # JWT decoding (not validation - client only)
│           ├── clientId.ts     # Client ID generation
│           ├── logger.ts       # Extension logging
│           └── snapshotFormatter.ts  # DOM snapshot formatting
├── firefox-extension/          # Firefox Extension (Vanilla JS)
│   └── src/
│       ├── background.js       # Service worker (matches Chrome features)
│       └── content-script.js   # Page injection (matches Chrome features)
├── docs/                       # Documentation
│   ├── testing/
│   │   └── TESTING_GUIDE.md   # Comprehensive test procedures
│   ├── architecture/
│   │   └── PROXY_PROTOCOL.md  # JSON-RPC 2.0 protocol spec
│   └── KNOWN_ISSUES.md        # Known limitations (iCloud Passwords)
├── tests/                      # Playwright-based test suites
├── FEATURES.md                 # Complete feature list (200+)
└── README.md                   # User documentation
```

### Key Architectural Patterns

**Stateful Backend Pattern:**
The project uses a stateful connection model with 13 state variables (needs refactoring):
1. **Passive state:** Server started, no connections active
2. **Active state:** WebSocket server running (port 5555) or proxy connected
3. **Connected state:** Extension connected, tools available
4. **Authenticated waiting:** Multiple browsers found, awaiting selection (PRO)

Transitions:
- `enable` tool → passive → active (starts WebSocket server or connects to proxy)
- Extension connects → active → connected (tools become available)
- `disable` tool → connected → passive (closes everything)
- Multiple browsers → authenticated_waiting → user selects → connected

**Two Connection Modes:**

**Free Mode (Direct):**
- ExtensionServer creates WebSocket server on localhost:5555
- Extension connects directly to local server
- DirectTransport handles communication
- No authentication required
- Single browser instance

**PRO Mode (Proxy):**
- OAuth2Client handles authentication via browser flow
- MCPConnection connects to cloud relay server (wss://)
- ProxyTransport forwards commands through relay
- Supports multiple browsers and remote access
- Auto-reconnection with browser/tab memory
- JWT token refresh (5 min before expiry)

**Tool Architecture:**
- UnifiedBackend implements all 20 browser_ tools
- Tools use Transport abstraction (works with both Direct and Proxy modes)
- State management in StatefulBackend tracks connection, browser, and tab state
- Status header shows current state in all tool responses:
  - Mode (Free/PRO)
  - Browser name
  - Attached tab (index + URL)
  - Tech stack detected
  - Stealth mode indicator

### Tool Implementation Pattern

**20 Browser Tools** implemented in UnifiedBackend:
- Connection: enable, disable, status, browser_connect, auth
- Tab Management: browser_tabs (list/new/attach/close)
- Navigation: browser_navigate (url/back/forward/reload/test_page)
- Content: browser_snapshot, browser_extract_content, browser_take_screenshot
- Console: browser_console_messages
- Network: browser_network_requests (list/details/replay/clear with filters)
- Interactions: browser_interact (unified multi-action tool)
- Forms: browser_fill_form, browser_lookup
- Advanced: browser_evaluate, browser_handle_dialog, browser_window, browser_pdf_save
- Performance: browser_performance_metrics
- Verification: browser_verify_text_visible, browser_verify_element_visible
- Extensions: browser_list_extensions, browser_reload_extensions
- Mouse: browser_drag

Tools pattern:
```javascript
// In unifiedBackend.js
async callTool(name, args) {
  // Auto-reconnect if browser disconnected (PRO mode)
  await this._autoReconnectIfNeeded();

  // Send command through transport (Direct or Proxy)
  const result = await this._transport.sendCommand(method, params);

  // Add status header to response
  return this._addStatusHeader({
    content: [{
      type: "text",
      text: resultText
    }],
    isError: false
  });
}
```

**Transport Abstraction:**
```javascript
// DirectTransport - uses ExtensionServer (Free mode)
class DirectTransport {
  async sendCommand(method, params) {
    return await this._extensionServer.sendCommand(method, params);
  }
}

// ProxyTransport - uses MCPConnection (PRO mode)
class ProxyTransport {
  async sendCommand(method, params) {
    return await this._mcpConnection.sendRequest(method, params);
  }
}
```

### Key Dependencies

**Server:**
- `@modelcontextprotocol/sdk` v1.17+ - MCP protocol implementation
- `ws` v8.18+ - WebSocket server (Free mode)
- `commander` v14.0+ - CLI argument parsing
- `playwright` 1.57.0-alpha - Used for some browser utilities (minimal usage)
- `sharp` - Screenshot processing
- `image-size` - Screenshot dimension validation
- `jsonpath-plus` - JSONPath filtering for network requests
- `proper-lockfile` - File locking
- `env-paths` - Cross-platform paths

**Chrome Extension (Current - TypeScript):**
- Chrome Extensions API - Browser control
- Vite - Build system (to be removed)
- TypeScript - Type safety (to be removed)
- React - Popup UI (may keep or replace with vanilla)

**Firefox Extension (Vanilla JS):**
- WebExtensions API - Cross-browser compatible
- No dependencies - Pure vanilla JS
- No build step required

**Dev Dependencies:**
- `@playwright/test` - Test runner
- `jest` - Unit testing
- `zod-to-json-schema` - Schema generation

## Connection Flow

### Free Mode (Direct Connection)
1. MCP client starts `blueprint-mcp` server → **passive state**
2. User calls `enable` tool → Server starts WebSocket on port 5555 → **active state**
3. Extension auto-connects to localhost:5555 → **connected state**
4. Tools like `browser_tabs`, `browser_navigate` become available
5. Extension executes commands and returns results

### PRO Mode (Proxy Connection)
1. User calls `auth action='login'` → Browser opens, user logs in
2. OAuth tokens stored locally
3. User calls `enable` tool → Server connects to cloud relay
4. If multiple browsers available → user picks with `browser_connect`
5. Extension connects to relay → **connected state**
6. Same tool flow as Free mode, but through relay

If tools called before `enable`: Error message tells user to call `enable` first

## Key Features (See FEATURES.md for complete list)

### Major Capabilities
1. **Tech Stack Detection** - Auto-detects 40+ frameworks/libraries
   - Frontend: React, Vue, Angular, Svelte, Next.js, etc.
   - Libraries: jQuery, Lodash, D3.js, Alpine.js, HTMX, etc.
   - CSS: Bootstrap, Tailwind, Bulma, Material UI, etc.
   - Displays in status header on every response

2. **Network Monitoring** - Comprehensive request tracking
   - List mode with filtering (URL, method, status, type)
   - Details mode with full headers/bodies
   - JSONPath filtering for large JSON responses
   - Replay mode (re-execute captured requests)
   - Clear mode (memory management)

3. **Stealth Mode** - Bot detection avoidance
   - Uses real browser profile + fingerprint
   - No Playwright detection signatures
   - Visual indicator in status header

4. **Auto-Reconnection** - Robust connection handling
   - Survives extension reloads
   - Survives browser restarts
   - Remembers last browser + tab
   - Chrome alarms API for persistence
   - Infinite retry with backoff

5. **Selector Intelligence**
   - `:has-text()` pseudo-selector (case-insensitive)
   - `browser_lookup` - Search by text content
   - Intelligent suggestions ("Did you mean?")
   - Visibility warnings
   - Multi-element warnings

### Exit Handling

The server implements graceful shutdown:
- Listens for SIGINT and SIGTERM signals
- Closes active connections (extension or proxy)
- Stops WebSocket server if running
- Allows 5 seconds for cleanup before force-exit
- Debug mode: Hot reload with exit code 42

## Important Implementation Details

**Language Strategy:**
- **Server:** JavaScript (no plans to change - works well)
- **Chrome Extension:** TypeScript → **WILL MIGRATE to Vanilla JS**
  - Current: 4,000 lines TS + Vite build
  - Target: ~2,000 lines vanilla JS (50% reduction)
  - Reason: Code reuse with Firefox, no build step, smaller bundle
- **Firefox Extension:** Vanilla JS (already done, 2,000 lines)
- **Safari Extension:** Planned - will share Chrome's vanilla JS code
- **Shared utilities:** Will be extracted to `shared/` folder

**State Management (Known Issue):**
StatefulBackend has **13 state variables** - needs refactoring:
- Connection states (passive/active/connected/authenticated_waiting)
- Browser info (name, connection status, disconnected flag)
- Tab attachment (current tab, last tab, stealth mode)
- Authentication (isAuthenticated, userInfo, clientId)
- Available browsers cache
- Last connected browser/tab (for auto-reconnect)

**Recommended refactor:** Group related state into objects:
```javascript
this._connection = { state, mode, backend, server };
this._browser = { name, id, disconnected, available };
this._tab = { current, last, stealth };
this._auth = { isAuthenticated, userInfo, clientId };
```

**Error Handling:**
- Tools return markdown-formatted error messages (user-facing)
- Infinite retry loops with 1-second intervals (aggressive reconnection)
- Chrome alarms API for persistence (survives service worker suspension)
- No JWT validation (client only - relay server validates)
