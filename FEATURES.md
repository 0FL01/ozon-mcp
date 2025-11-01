# Blueprint MCP for Chrome - Complete Feature List

**Current Version:** 1.8.1
**Total Commits:** 600+
**Development Period:** Oct 2025 - Present

This document catalogs all features based on git history, code analysis, and documentation.

---

## 📦 Core Architecture

### MCP Server (Node.js)
- **Model Context Protocol (MCP) v1.17+** - Official SDK integration
- **Dual Transport Mode**
  - Free Tier: Local WebSocket (port 5555)
  - PRO Tier: Cloud relay with OAuth2 authentication
- **Stateful Backend** - Connection state management (passive/active/connected)
- **Unified Tool Backend** - Abstracted transport layer (DirectTransport/ProxyTransport)
- **JSON-RPC 2.0 Protocol** - Full compliance with spec
- **Auto-reconnection** - Chrome alarms-based retry with 1s intervals
- **Debug Mode** - Verbose logging with `--debug` flag
- **Exit Watchdog** - Graceful shutdown handling (SIGINT/SIGTERM)
- **Hot Reload** - Exit code 42 triggers wrapper restart (debug mode)

### Browser Extensions

#### Chrome Extension (TypeScript + Vite)
- **Service Worker** - Background automation engine
- **Content Script** - Page-level DOM access
- **DevTools Protocol** - Direct CDP integration
- **WebSocket Client** - Connects to MCP server or cloud relay
- **React UI** - Extension popup with connection management
- **Auto-reconnect** - Survives extension/browser reloads
- **Stealth Mode** - Bot detection bypass
- **Icon Overlays** - Visual connection state (gray/blue/green/stealth)

#### Firefox Extension (Vanilla JS)
- **Full Parity** - All Chrome features replicated
- **WebExtensions API** - Cross-browser compatible
- **Vanilla JS Implementation** - No build step required
- **Matching UI** - Identical UX to Chrome extension
- **PRO Mode Support** - OAuth authentication
- **Auto-dialog Handling** - Built-in for alert/confirm/prompt

---

## 🔧 Connection & Authentication

### Connection Management
- ✅ `enable` - Activate browser automation (with client_id)
- ✅ `disable` - Deactivate and cleanup
- ✅ `status` - Real-time connection status
- ✅ `browser_connect` - Select from multiple browsers (PRO)
- ✅ Auto-detection - Free vs PRO mode based on stored tokens
- ✅ Browser selection - Multi-browser support in PRO
- ✅ Lazy tab attachment - Tab created on first command
- ✅ Tab reattachment - Remember and reattach after disconnect

### Authentication (PRO)
- ✅ `auth action='login'` - OAuth2 flow (opens browser)
- ✅ `auth action='logout'` - Clear tokens
- ✅ `auth action='status'` - Check authentication state
- ✅ JWT token storage - Local encrypted storage
- ✅ Proactive token refresh - Automatic refresh 5 minutes before expiry
- ✅ Invalid token detection - Clear and re-prompt
- ✅ Cloud relay connection - WebSocket to remote server
- ✅ Multi-client support - Share browser across AI clients
- ✅ Connection status tracking - Max connections, current usage

---

## 🗂️ Tab Management

### Tab Operations
- ✅ `browser_tabs action='list'` - List all tabs with metadata
- ✅ `browser_tabs action='new'` - Create new tab with URL
- ✅ `browser_tabs action='attach'` - Attach to existing tab by index
- ✅ `browser_tabs action='close'` - Close tab by index
- ✅ Tab activation - Bring tab to foreground (optional)
- ✅ Tab switching - Re-attach to previously used tabs
- ✅ Tab metadata preservation - Title, URL, index
- ✅ Tab state tracking - Current attached tab in status header
- ✅ Chrome/Edge tab filtering - Exclude internal tabs

### Tab Monitoring
- ✅ Tab close detection - Auto-detach when tab closes
- ✅ Tab update tracking - Monitor navigation changes
- ✅ Tab activation tracking - Detect active tab changes
- ✅ Tech stack detection - Automatic framework detection per tab
- ✅ Stale state prevention - Clear on navigation

---

## 🧭 Navigation

### Core Navigation
- ✅ `browser_navigate action='url'` - Navigate to URL
- ✅ `browser_navigate action='back'` - History back
- ✅ `browser_navigate action='forward'` - History forward
- ✅ `browser_navigate action='reload'` - Refresh page
- ✅ `browser_navigate action='test_page'` - Open test page
- ✅ Download link handling - Don't error on downloads
- ✅ Navigation timeout - Configurable wait time

---

## 📄 Content & Inspection

### Page Content
- ✅ `browser_snapshot` - Accessible DOM tree (YAML format)
- ✅ `browser_extract_content` - Markdown conversion
  - Auto mode - Smart main content detection
  - Full mode - Entire page
  - Selector mode - Specific element
  - Pagination - Offset + max_lines (default: 250)
- ✅ Iframe stitching - Merge iframes into single tree
- ✅ Dynamic iframe monitoring - MutationObserver tracking
- ✅ Snapshot filtering - Exclude non-interactive elements
- ✅ Playwright selector support - Preprocessing layer
- ✅ Context hijacking fix - Prevent iframe interference

### Screenshots
- ✅ `browser_take_screenshot` - Capture page visually
  - JPEG/PNG formats
  - Quality control (0-100)
  - Viewport or full page
  - Element-specific screenshots
  - Clickable highlighting - Green borders
  - Device scale control - 1:1 or native
  - Auto-downscaling - 2000px max (prevents API errors)
  - Dimension checking - Pre-validation
  - Coordinate system info - Viewport dimensions
- ✅ Visual click effects - Show where clicks happen

### Console & Debugging
- ✅ `browser_console_messages` - Get console logs
- ✅ Per-tab storage - Isolate logs by tab
- ✅ Page error inclusion - Include console.error
- ✅ Recent log inclusion - Last N entries
- ✅ Console access buttons - Popup UI shortcuts (Chrome + Firefox)
- ✅ Content script access - Message passing

### Network Monitoring
- ✅ `browser_network_requests` - Comprehensive network tool
  - **List mode** - Overview with filtering
    - URL pattern filter (substring)
    - HTTP method filter (GET/POST/etc)
    - Status code filter (200/404/500)
    - Resource type filter (xhr/fetch/script/image)
    - Pagination (limit + offset, default: 20)
  - **Details mode** - Full request/response
    - Headers (request + response)
    - Request body
    - Response body
    - JSONPath filtering - Query large JSON responses
    - Timing information
  - **Replay mode** - Re-execute requests
  - **Clear mode** - Free memory
- ✅ Per-tab storage - Isolated network logs
- ✅ CDP integration (Chrome) - Chrome DevTools Protocol
- ✅ WebRequest API (Firefox) - Firefox equivalent
- ✅ Last 500 requests - Memory management

---

## 🎯 Interactions

### Core Interactions
- ✅ `browser_interact` - Unified multi-action tool
  - Click (with button + count options)
  - Type text
  - Clear input
  - Press key
  - Hover
  - Wait (timeout)
  - Mouse move (x, y coordinates)
  - Mouse click at coordinates
  - Scroll to position
  - Scroll by delta
  - Scroll into view
  - Select option (dropdown)
  - File upload
- ✅ Error handling - Stop or ignore on error
- ✅ Visual feedback - Click effects

### Selectors & Element Detection
- ✅ `:has-text()` pseudo-selector - Case-insensitive text matching
- ✅ Button selector expansion - Auto-expand to clickable parent
- ✅ Compound selector support - Complex CSS selectors
- ✅ Selector validation - Pre-check before interaction
- ✅ Visibility detection - Warn on hidden elements
- ✅ Multi-element warnings - Warn if selector matches multiple
- ✅ `browser_lookup` - Search elements by text
  - Find elements containing text
  - Return selectors + details
  - Limit results (default: 10)
- ✅ Intelligent selector suggestions - "Did you mean?" hints
- ✅ Element detection - Verify before actions

### Forms
- ✅ `browser_fill_form` - Fill multiple fields at once
- ✅ `browser_select_option` - Smart dropdown selection
  - Match by value (exact)
  - Match by text (case-insensitive)
  - Auto-detect select elements
  - Return all options on click
- ✅ `browser_file_upload` - File input handling
- ✅ Form field validation - Verify values after fill
- ✅ Selector hints - Helpful error messages

### Mouse Operations
- ✅ `browser_drag` - Drag from element to element
- ✅ Coordinate-based clicks - x, y positioning
- ✅ Click coordinate reporting - Show where clicked
- ✅ MouseMoved events - Better React compatibility
- ✅ Button types - Left, right, middle click
- ✅ Click count - Single, double, triple

### Keyboard
- ✅ `browser_press_key` - Key codes + modifiers
- ✅ Type slowly option - One character at a time

### Dialogs
- ✅ `browser_handle_dialog` - Alert/confirm/prompt
  - Accept or dismiss
  - Text input for prompts
- ✅ Auto-dialog handling (Firefox) - Installed on attach
- ✅ Dialog persistence - Don't delete after first use
- ✅ Dialog event reporting - Notify when dialogs appear
- ✅ Race condition fixes - Proper handling

### Scrolling
- ✅ Scroll improvements - Smooth scrolling
- ✅ Scrollable area detection - Find all scrollable elements
- ✅ Scroll success/failure reporting
- ✅ Element-specific scrolling - Scroll container, not window

---

## 🔍 Verification & Testing

### Verification Tools
- ✅ `browser_verify_text_visible` - Assert text present
- ✅ `browser_verify_element_visible` - Assert element exists
- ✅ Test page infrastructure - Shared test page
  - Dialog testing section
  - Interaction tests
  - Form tests
  - Network tests

---

## ⚡ Advanced Features

### JavaScript Execution
- ✅ `browser_evaluate` - Execute JS in page context
  - Function execution
  - Expression evaluation
  - Return values
  - Error handling

### Window Management
- ✅ `browser_window` - Window operations
  - Resize (width + height)
  - Minimize
  - Maximize
  - Close

### PDF Export
- ✅ `browser_pdf_save` - Save page as PDF
- ✅ File path specification
- ✅ Error handling (Firefox limitations)

### Performance
- ✅ `browser_performance_metrics` - Web Vitals
  - FCP (First Contentful Paint)
  - LCP (Largest Contentful Paint)
  - CLS (Cumulative Layout Shift)
  - TTFB (Time to First Byte)
  - Other metrics

### Extension Management (Chrome)
- ✅ `browser_list_extensions` - List installed extensions
- ✅ `browser_reload_extensions` - Reload specific extension
  - By name or all extensions
  - Development workflow support
  - Response before reload

---

## 🎨 Tech Stack Detection

**Automatic framework/library detection** (recent feature):

### Frontend Frameworks
- ✅ React - Mount point detection
- ✅ Vue.js
- ✅ Angular
- ✅ Svelte
- ✅ Next.js
- ✅ Nuxt
- ✅ Polymer
- ✅ Google Wiz framework

### JavaScript Libraries
- ✅ jQuery
- ✅ Lodash
- ✅ Moment.js
- ✅ Chart.js
- ✅ D3.js
- ✅ Three.js
- ✅ Alpine.js
- ✅ HTMX
- ✅ Hotwire Turbo - ES module detection
- ✅ Spark (Laravel) - ES module detection

### CSS Frameworks
- ✅ Bootstrap - Prevent Tailwind misdetection
- ✅ Tailwind CSS
- ✅ Bulma
- ✅ Foundation
- ✅ Materialize
- ✅ Semantic UI
- ✅ Ant Design
- ✅ Material UI
- ✅ Chakra UI

### Detection Features
- ✅ Obfuscated CSS warnings - Flag minified class names
- ✅ SPA detection - Single-page app identification
- ✅ Auto-reload detection - Hot module replacement
- ✅ Status header display - Show tech stack in responses
- ✅ Per-tab tracking - Tech stack per browser tab
- ✅ Stale data prevention - Clear on navigation
- ✅ Propagation - Firefox → MCP server → responses

---

## 🛡️ Stability & Error Handling

### Connection Resilience
- ✅ Automatic reconnection - 1-second retry intervals
- ✅ Chrome alarms API - Survives service worker suspension
- ✅ Keepalive alarms - 20-second pings
- ✅ Extension reload detection - Reconnect after reload
- ✅ Browser reconnection - Remember last browser/tab
- ✅ Tab reattachment - Auto-reattach after disconnect
- ✅ Infinite retry loops - Never give up
- ✅ Retry delays - 2s, 3s, 4s, 5s progression
- ✅ Stale extension list - Retry logic (max 5 attempts)
- ✅ Connection timeout - 2-second WebSocket timeout
- ✅ Graceful degradation - Fallback behaviors

### Error Messages
- ✅ Extension blocking detection - iCloud Passwords
  - Extension name + ID
  - Clear instructions
  - Original error included
- ✅ Markdown-formatted errors - Structured messages
- ✅ Status headers - Connection state in all responses
- ✅ Version mismatch detection - Warn on old extension
- ✅ Port in use detection - Helpful troubleshooting
- ✅ Invalid token detection - Auto-clear and re-prompt
- ✅ Server crash prevention - Try/catch everywhere
- ✅ Context desync fixes - State management fixes
- ✅ Misleading selector hints - Improved error messages

### State Management
- ✅ Status header system - Real-time connection info
  - Mode (Free/PRO)
  - Browser name
  - Tab info (index, URL)
  - Tech stack
  - Stealth mode indicator
  - Disconnected warnings
- ✅ Browser disconnection tracking - Separate from proxy
- ✅ Last connected browser/tab - Auto-reconnect memory
- ✅ Tab info updates - Real-time sync
- ✅ Tab ID changes - Accept updates

---

## 🎭 Stealth & Bot Detection

### Stealth Mode
- ✅ Stealth mode toggle - Avoid bot detection
- ✅ Real browser fingerprint - Use existing profile
- ✅ Chrome extension approach - Bypass Playwright detection
- ✅ Generic naming - No "Playwright" mentions
- ✅ STEALTH_MODE env var - Default enabled
- ✅ Stealth icon overlay - Visual indicator

---

## 📦 Deployment & DevOps

### Packaging
- ✅ NPM package - `@railsblueprint/blueprint-mcp`
- ✅ Semantic versioning - 1.5.5 current
- ✅ Release script - Automated version bumps
  - Update package.json
  - Update manifest.json
  - Update extension/package.json
  - Git tag
  - Build extension
- ✅ Chrome Web Store - Promotional materials complete
  - Description (9,147 chars)
  - Permissions justifications (9 sections)
  - Promo tiles (440x280 and 1400x560)
  - Screenshots (free and PRO tiers)
  - Logo assets
- ✅ Extension manifest - v3 format

### Configuration
- ✅ Environment variables - AUTH_BASE_URL, MCP_PORT
- ✅ .env support - Local development
- ✅ Command line options - `--debug`
- ✅ Config file support - Future enhancement
- ✅ No dotenv in production - Clean protocol output

### Testing
- ✅ Comprehensive test suite - Jest-based
- ✅ Unit tests - State transitions, parameter validation
- ✅ Integration tests - Side effects testing
- ✅ Test fixtures - Shared client/server setup
- ✅ Test page - Interaction testing (test-side-effects.html)
- ✅ 100% test pass rate - 17 tests (as of Oct 24)
- ✅ Coverage tracking - SimpleCov equivalent
- ✅ Manual test procedures - Comprehensive 10-part guide
- ✅ Feature specification - Complete feature documentation
- ✅ Test progress tracking - Real-time test status

---

## 📚 Documentation

### User Documentation
- ✅ README.md - Comprehensive guide
- ✅ CONTRIBUTING.md - Contribution guidelines
- ✅ docs/testing/MANUAL_TEST_PROCEDURES.md - Comprehensive 10-part manual test guide
- ✅ docs/testing/FEATURE_SPEC.md - Complete feature specification
- ✅ docs/testing/TEST_PROGRESS.md - Test coverage tracking
- ✅ docs/testing/AUTO_TEST_STRATEGY.md - Automated testing strategy
- ✅ docs/testing/SIDE_EFFECTS_TESTING.md - Side effects testing guide
- ✅ docs/architecture/PROXY_PROTOCOL.md - Protocol spec
- ✅ docs/KNOWN_ISSUES.md - Known limitations
- ✅ docs/stores/chrome/ - Chrome Web Store submission materials
- ✅ Inline tool descriptions - MCP annotations
- ✅ Tool schemas - JSON Schema validation
- ✅ Installation instructions - Multiple MCP clients
  - Claude Desktop
  - VS Code / Cursor
  - Cline
- ✅ Troubleshooting guide - Common issues
- ✅ Security documentation - Best practices

### Developer Documentation
- ✅ Architecture overview - System diagram
- ✅ Project structure - File organization
- ✅ Development setup - Step-by-step
- ✅ Build instructions - Extension compilation
- ✅ Protocol specification - JSON-RPC 2.0
- ✅ Transport abstraction - Direct vs Proxy
- ✅ State machine - Connection states

---

## 🌍 Browser Support

### Implemented
- ✅ Chrome - Full support (TypeScript extension)
- ✅ Firefox - Full parity (Vanilla JS extension)
- ✅ Edge - Chrome extension works

### Planned
- 🚧 Safari - Will reuse Chrome vanilla JS code
- 🚧 Brave - Chrome extension compatible
- 🚧 Opera - Chrome extension compatible

---

## 🎯 UI/UX Features

### Extension Popup
- ✅ Connection status display - Visual indicators
- ✅ Enable/Disable toggle - One-click control
- ✅ Browser name display - Show current browser
- ✅ Project name display - Connected MCP client
- ✅ Stealth mode indicator - Visual badge
- ✅ PRO upgrade section - Marketing CTA
- ✅ OAuth login flow - Browser-based auth
- ✅ Live token expiration display - Real-time countdown to token expiry
- ✅ Connection limits - Usage tracking
- ✅ Console access buttons - Quick links
- ✅ Popup sync fixes - State consistency
- ✅ Render logging - Debug visibility
- ✅ React UI (Chrome) - Component-based
- ✅ Vanilla UI (Firefox) - Matching UX
- ✅ Icon overlays - State visualization
  - Gray - Disconnected
  - Blue - Connected
  - Green - Tab attached
  - Green + badge - Stealth mode
- ✅ Badge text - Connection status

### Status Feedback
- ✅ Next steps recommendations - After attach/create
- ✅ Helpful error messages - Actionable guidance
- ✅ Version display - Server + extension versions
- ✅ Connection timeout messages - User-friendly
- ✅ Loading states - "Connecting..." feedback

---

## 🔐 Security Features

### Authentication
- ✅ OAuth2 flow - Standard protocol
- ✅ JWT tokens - Signed access tokens
- ✅ Token refresh - Automatic renewal
- ✅ Secure storage - Chrome storage API
- ✅ Token validation - Expiry checking
- ✅ No cleartext passwords - OAuth only

### Network Security
- ✅ Localhost-only (Free) - No external access
- ✅ WSS encryption (PRO) - Secure WebSocket
- ✅ CORS handling - Origin validation
- ✅ Extension permissions - Minimal scope

### Privacy
- ✅ Local-first - Data stays on device (Free)
- ✅ No telemetry - No tracking
- ✅ User profile preservation - No data collection

---

## 📊 Metrics & Monitoring

### Connection Tracking
- ✅ Max connections - Quota limits (PRO)
- ✅ Connections used - Current count
- ✅ Connections to browser - Per-browser count
- ✅ Project name tracking - Client identification
- ✅ Client ID system - Stable identifiers

### Logging
- ✅ Debug mode - Verbose logging
- ✅ File logging - mcp-debug.log
- ✅ Extension logging - Console output
- ✅ Server logging - stderr output
- ✅ Error logging - Stack traces

---

## 🎁 Quality of Life

### Developer Experience
- ✅ Hot reload - Extension wrapper restart
- ✅ Debug mode - `--debug` flag
- ✅ Test page - Built-in interaction testing
- ✅ Console access - Quick debugging
- ✅ Helpful errors - Actionable messages
- ✅ Auto-update tools - README sync
- ✅ Linting - Code quality
- ✅ TypeScript (Chrome) - Type safety
- ✅ Watch mode - Extension rebuild on save

### User Experience
- ✅ Zero-config - Works out of box
- ✅ Auto-connect - Extension startup
- ✅ Visual feedback - Icons + badges
- ✅ Status headers - Always informed
- ✅ Next steps - Guidance after actions
- ✅ Smart defaults - Sensible configuration

---

## 📈 Evolution Timeline

### v0.1.x - Foundation (Playwright Fork)
- Forked from Microsoft Playwright MCP
- Initial Chrome extension support
- Basic navigation + interactions

### v0.2.x - Chrome Extension Pivot
- Removed Playwright dependency
- Pure Chrome extension architecture
- WebSocket communication

### v0.3.x - OAuth & PRO Mode
- JWT authentication
- Cloud relay support
- Multi-browser connections

### v1.0.0 - Open Source Release
- Public npm package
- Clean codebase
- Production-ready

### v1.1.x - Network & Content
- Network request monitoring
- Content extraction
- Screenshot enhancements

### v1.2.x - Performance & Polish
- Performance metrics
- Screenshot auto-downscaling
- Filtering + pagination

### v1.3.x - Stability Improvements
- Auto-reconnection
- Chrome alarms
- Per-tab storage
- Context desync fixes

### v1.4.x - Selectors & Lookup
- Intelligent suggestions
- `browser_lookup` tool
- Element detection

### v1.5.x - Firefox & Tech Stack
- Full Firefox extension
- Tech stack detection
- Tab close action
- Compound selector fixes

### v1.6.x - Monorepo & Vanilla JS
- Monorepo structure
- Complete Playwright removal
- Chrome extension vanilla JS refactor
- Firefox Manifest V3 refactor
- Shared modules across extensions

### v1.7.x - Testing & Reliability
- Comprehensive testing suite
- Unit tests for state transitions
- Integration tests for side effects
- Manual test procedures (10-part guide)
- Feature specification documentation
- Log directory creation fix
- User data path improvements

### v1.8.x - Token Management & Store Prep (Current)
- Proactive token refresh (5 min before expiry)
- Live token expiration display in popup
- Chrome Web Store promotional materials
- Store description and permissions justifications
- Promo tiles and screenshots

---

## 🚀 Feature Count Summary

**Total Features:** 200+

### By Category:
- Connection & Auth: 20+
- Tab Management: 15+
- Navigation: 7
- Content & Inspection: 40+
- Interactions: 35+
- Verification: 5+
- Advanced: 20+
- Tech Stack Detection: 40+
- Stability: 30+
- UI/UX: 25+
- Documentation: 15+

### Browser Tools: 20
- Core tools in MCP server
- All implemented in both Chrome and Firefox

---

## 🎯 Next Steps (Based on Git History Patterns)

### Short-term (Likely Next Commits)
1. Safari extension (vanilla JS rewrite)
2. Chrome extension vanilla JS conversion
3. Shared utilities folder
4. Code consolidation

### Medium-term (Inferred from PRO features)
1. Multiple simultaneous connections
2. Connection pooling
3. Load balancing
4. Enhanced relay features

### Long-term (From CLAUDE.md hints)
1. Additional browser support
2. Mobile browser automation
3. Advanced AI features
4. Enterprise features

---

**Last Updated:** 2025-11-01
**Based on:** Git history (599 commits), code analysis, documentation
**Compiled by:** Claude Code
