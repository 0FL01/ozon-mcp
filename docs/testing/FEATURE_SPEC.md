# Feature Specification

This document defines how Blueprint MCP should behave. Each feature includes expected behavior, edge cases, and error conditions.

## 1. Connection Management

### 1.1 Enable Tool

**Purpose:** Activate browser automation by starting WebSocket server (Free mode) or connecting to proxy (PRO mode)

**Expected Behavior:**
- **Free Mode:**
  - Starts WebSocket server on port 5555 (or custom port)
  - Returns "Waiting for extension connection" message
  - Server listens on 127.0.0.1 (localhost only)
  - State changes: passive → active

- **PRO Mode (authenticated):**
  - Connects to relay server at wss://mcp-for-chrome.railsblueprint.com/relay/mcp
  - Uses stored OAuth tokens
  - Fetches list of available browsers
  - If 1 browser: auto-connects and attaches to last tab
  - If multiple browsers: enters "authenticated_waiting" state
  - State changes: passive → active → connected (or authenticated_waiting)

**Required Parameters:**
- `client_id` (string) - Unique identifier for this MCP client

**Optional Parameters:**
- `force_free` (boolean) - Force Free mode even if authenticated

**Edge Cases:**
- Already enabled: Should return error "Already enabled"
- Missing client_id: Should return error "client_id is required"
- Port already in use (Free mode): Returns concise error with link to PRO mode
  - Error message: "Port 5555 already in use. Disable MCP in other project or switch to PRO mode: https://blueprint-mcp.railsblueprint.com/pro"
- Network error (PRO mode): Should retry with backoff, eventually timeout

**Error Conditions:**
- No client_id provided
- Server already running
- Network unreachable (PRO mode)
- Invalid authentication tokens (PRO mode)

---

### 1.2 Disable Tool

**Purpose:** Deactivate browser automation and cleanup resources

**Expected Behavior:**
- Closes WebSocket server (Free mode)
- Disconnects from proxy (PRO mode)
- Clears extension connection
- Resets state to passive
- State changes: active/connected → passive

**Parameters:** None

**Edge Cases:**
- Already disabled: Should succeed silently
- Extension connected during disable: Should disconnect gracefully
- Active command in progress: Should cancel or wait for completion

**Error Conditions:**
- None (disable should always succeed)

---

### 1.3 Status Tool

**Purpose:** Report current connection state and browser info

**Expected Behavior:**

**Passive State:**
```
🔴 Disabled
---

Use the 'enable' tool to start browser automation.
```

**Active State (waiting for extension):**
```
🟡 Waiting for Extension Connection
---

Free mode: Listening on localhost:5555
Extension not connected yet.
```

**Connected State:**
```
✅ Free v1.7.2 | 🌐 Chrome Macbook Pro | 📄 Tab #2: https://example.com | 🔍 React, Tailwind
---

Status: Connected
Tools available: 20 tools ready
```

**Authenticated Waiting State:**
```
⏳ Waiting for browser selection
---

Use browser_connect to select a browser.
```

**Parameters:** None

**Edge Cases:**
- No browser attached but connected: Shows "⚠️ No tab attached"
- Browser disconnected: Shows "⚠️ Browser Disconnected"
- Stealth mode enabled: Shows "🥷 Stealth" indicator

**Error Conditions:**
- None (status always returns current state)

---

### 1.4 Auth Tool

**Purpose:** Manage PRO authentication (login/logout/status)

**Expected Behavior:**

**Login:**
1. Opens browser to OAuth login page
2. User logs in via browser
3. Extension captures tokens from DOM
4. Tokens stored in system keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
5. Returns success message with user email

**Logout:**
1. Clears stored tokens from keyring
2. Disconnects from proxy if connected
3. Returns success message

**Status:**
1. Checks if tokens exist and are valid
2. Returns user info (email, expiry) or "Not authenticated"

**Required Parameters:**
- `action` (enum: "login", "logout", "status")

**Edge Cases:**
- Login when already authenticated: Should re-authenticate
- Logout when not authenticated: Should succeed silently
- Expired tokens: Should trigger refresh or re-login
- Keyring unavailable: Should fall back to file storage with warning

**Error Conditions:**
- Invalid action parameter
- Login cancelled by user
- Network error during OAuth flow
- Invalid OAuth response

---

### 1.5 Browser Connect Tool

**Purpose:** Select which browser to use when multiple browsers are available (PRO mode only)

**Expected Behavior:**
1. Receives browser_id from available browsers list
2. Connects to selected browser
3. Attaches to last known tab or first available tab
4. Returns success with browser info
5. State changes: authenticated_waiting → connected

**Required Parameters:**
- `browser_id` (string) - Browser extension ID from enable response

**Edge Cases:**
- Browser disconnected after list shown: Should return error
- Invalid browser_id: Should return error with available browsers
- Only one browser available: enable should auto-connect (shouldn't need this tool)

**Error Conditions:**
- Not in authenticated_waiting state
- Invalid browser_id
- Browser no longer available
- Network error

---

## 2. Tab Management

### 2.1 Browser Tabs - List

**Purpose:** List all available tabs in current browser

**Expected Behavior:**
- Returns array of tabs with:
  - `index` - Tab position (0-based)
  - `id` - Browser tab ID
  - `url` - Current URL
  - `title` - Page title
  - `active` - Is currently active tab
  - `attached` - Is attached for automation

**Parameters:**
```json
{ "action": "list" }
```

**Edge Cases:**
- No tabs open: Returns empty array
- Hundreds of tabs: Should return all (may be slow)
- Tab info unavailable: Returns partial info

**Error Conditions:**
- Not connected to browser
- Extension disconnected

---

### 2.2 Browser Tabs - New

**Purpose:** Create a new tab and optionally navigate to URL

**Expected Behavior:**
- Creates new tab
- If URL provided, navigates to URL
- If activate=true, brings tab to foreground
- Attaches to the new tab automatically
- Returns tab info

**Parameters:**
```json
{
  "action": "new",
  "url": "https://example.com",  // optional
  "activate": true                // optional, default: true
}
```

**Edge Cases:**
- No URL: Creates blank tab (about:blank)
- Invalid URL: Returns error
- URL navigation fails: Tab created but shows error page
- activate=false: Tab created in background

**Error Conditions:**
- Not connected to browser
- Invalid URL format
- Too many tabs (browser limit)

---

### 2.3 Browser Tabs - Attach

**Purpose:** Attach to a specific tab for automation

**Expected Behavior:**
- Attaches Chrome DevTools Protocol (CDP) to tab
- Enables all required CDP domains (Page, Runtime, Network, etc.)
- Injects console capture script
- Injects dialog override script
- Returns success with tab info
- Remembers this tab as "current tab"

**Parameters:**
```json
{
  "action": "attach",
  "index": 2  // or "id": "123456"
}
```

**Edge Cases:**
- Tab closed after list shown: Returns error
- Already attached to another tab: Detaches from old tab first
- Tab is system page (chrome://, about:): May have limited functionality
- Stealth mode: Skips some injections to avoid detection

**Error Conditions:**
- Not connected to browser
- Invalid tab index/id
- Tab no longer exists
- CDP attachment failed

---

### 2.4 Browser Tabs - Close

**Purpose:** Close a specific tab

**Expected Behavior:**
- Closes the specified tab
- If closing attached tab, detaches first
- Returns success message

**Parameters:**
```json
{
  "action": "close",
  "index": 2  // or "id": "123456"
}
```

**Edge Cases:**
- Closing last tab: May close browser window (depends on browser settings)
- Closing attached tab: Automatically detaches
- Closing active tab: Browser activates another tab

**Error Conditions:**
- Not connected to browser
- Invalid tab index/id
- Tab already closed
- Cannot close (e.g., system tab)

---

## 3. Navigation

### 3.1 Browser Navigate - URL

**Purpose:** Navigate attached tab to a URL

**Expected Behavior:**
- Navigates to specified URL
- Waits for page load (DOMContentLoaded)
- Returns success with final URL (after redirects)
- Tech stack detection runs automatically after load

**Parameters:**
```json
{
  "action": "url",
  "url": "https://example.com"
}
```

**Edge Cases:**
- URL redirects: Returns final URL
- Page with slow resources: Returns after DOM ready (doesn't wait for all resources)
- Navigation fails (404, 500): Returns error with status code
- URL requires authentication: May show login page

**Error Conditions:**
- Not attached to tab
- Invalid URL
- Network error
- Timeout (default: 30s)
- Browser refuses navigation (mixed content, etc.)

---

### 3.2 Browser Navigate - History

**Purpose:** Navigate through browser history (back/forward/reload)

**Expected Behavior:**

**Back:**
- Goes back one page in history
- Returns previous URL
- Waits for page load

**Forward:**
- Goes forward one page in history
- Returns next URL
- Waits for page load

**Reload:**
- Reloads current page
- Returns current URL
- Waits for page load

**Parameters:**
```json
{ "action": "back" }
{ "action": "forward" }
{ "action": "reload" }
```

**Edge Cases:**
- Back with no history: Returns error "No previous page"
- Forward with no forward history: Returns error "No next page"
- Reload on error page: Retries failed navigation
- SPA navigation: May not trigger full page reload

**Error Conditions:**
- Not attached to tab
- No history available (back/forward)
- Navigation failed
- Timeout

---

### 3.3 Browser Navigate - Test Page

**Purpose:** Navigate to built-in test page with interactive elements

**Expected Behavior:**
- Navigates to hosted test page at https://mcp-for-chrome.railsblueprint.com/test-page
- Test page contains:
  - Buttons (click test)
  - Input fields (type test)
  - Checkboxes/radios
  - Select dropdowns
  - Links
  - Forms
  - Dialogs (alert/confirm/prompt)
  - iframes
  - Dynamic content (AJAX)

**Parameters:**
```json
{ "action": "test_page" }
```

**Edge Cases:**
- Test page unavailable: Returns network error
- Test page updated: May have different elements

**Error Conditions:**
- Not attached to tab
- Network error
- Timeout

---

## 4. Interaction

### 4.1 Browser Interact - Click

**Purpose:** Click on an element

**Expected Behavior:**
- Finds element by selector
- Scrolls element into view if needed
- Waits for element to be visible and clickable
- Clicks element (left/right/middle button)
- Supports multiple clicks (double-click, triple-click)
- Returns success

**Parameters:**
```json
{
  "actions": [
    {
      "type": "click",
      "selector": "button.submit",
      "button": "left",      // optional: left/right/middle
      "clickCount": 1        // optional: 1/2/3
    }
  ]
}
```

**Selector Features:**
- Standard CSS selectors: `div.class`, `#id`, `[data-attr="value"]`
- `:has-text()` pseudo-selector: `button:has-text('Submit')`
- Case-insensitive text matching
- Partial text matching

**Edge Cases:**
- Multiple elements match: Clicks first visible one, warns user
- Element hidden: Returns error "Element not visible"
- Element disabled: Clicks anyway (simulates real user)
- Element covered by another element: Returns error "Element not clickable"
- Click triggers navigation: Waits for navigation to complete
- Click triggers dialog: Dialog auto-handled if dialog overrides set

**Error Conditions:**
- Not attached to tab
- Selector not found
- Element not visible
- Element not clickable
- Timeout (default: 30s)

---

### 4.2 Browser Interact - Type

**Purpose:** Type text into an input element

**Expected Behavior:**
- Finds element by selector
- Clears existing text (optional)
- Types text character by character
- Triggers appropriate events (keydown, keypress, keyup, input, change)
- Returns success

**Parameters:**
```json
{
  "actions": [
    {
      "type": "type",
      "selector": "input[name='email']",
      "text": "user@example.com"
    }
  ]
}
```

**Edge Cases:**
- Empty text: Clears input
- Text with special characters: Types correctly (quotes, newlines, etc.)
- Read-only input: Types anyway (simulates real user)
- contenteditable element: Types into editable div
- React/Vue controlled input: Triggers proper events for framework detection

**Error Conditions:**
- Not attached to tab
- Selector not found
- Element not visible
- Not an input element
- Timeout

---

### 4.3 Browser Interact - Clear

**Purpose:** Clear text from an input element

**Expected Behavior:**
- Finds element by selector
- Selects all text
- Deletes selected text
- Triggers change event
- Returns success

**Parameters:**
```json
{
  "actions": [
    {
      "type": "clear",
      "selector": "input[name='search']"
    }
  ]
}
```

**Edge Cases:**
- Already empty: Succeeds silently
- Read-only: Clears anyway
- contenteditable: Clears all content

**Error Conditions:**
- Not attached to tab
- Selector not found
- Element not visible
- Not an input element

---

### 4.4 Browser Interact - Press Key

**Purpose:** Press a keyboard key

**Expected Behavior:**
- Simulates keyboard key press
- Supports special keys (Enter, Tab, Escape, etc.)
- Supports modifiers (Ctrl, Alt, Shift, Meta)
- Triggers appropriate events
- Returns success

**Parameters:**
```json
{
  "actions": [
    {
      "type": "press_key",
      "key": "Enter"
    }
  ]
}
```

**Supported Keys:**
- Alphanumeric: a-z, A-Z, 0-9
- Special: Enter, Tab, Escape, Backspace, Delete, Space
- Navigation: ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, PageUp, PageDown
- Modifiers: Control, Alt, Shift, Meta

**Edge Cases:**
- Key press triggers form submit: Waits for navigation
- Key press opens dialog: Dialog auto-handled
- Key press in input vs body: Focuses correct element

**Error Conditions:**
- Not attached to tab
- Invalid key name

---

### 4.5 Browser Interact - Multiple Actions

**Purpose:** Execute multiple interactions in sequence

**Expected Behavior:**
- Executes actions in order
- Waits for each action to complete before next
- If action fails, stops execution (default) or continues (if onError: "ignore")
- Returns results for all actions

**Parameters:**
```json
{
  "actions": [
    { "type": "click", "selector": "#username" },
    { "type": "type", "selector": "#username", "text": "admin" },
    { "type": "click", "selector": "#password" },
    { "type": "type", "selector": "#password", "text": "secret" },
    { "type": "click", "selector": "button[type='submit']" }
  ],
  "onError": "stop"  // or "ignore"
}
```

**Edge Cases:**
- One action fails with onError="stop": Returns error, shows which action failed
- One action fails with onError="ignore": Continues, returns partial success
- Actions trigger navigation: Waits between actions
- Long action sequence: May timeout (increase timeout)

**Error Conditions:**
- Not attached to tab
- Any action fails (if onError="stop")
- Timeout

---

## 5. Content Extraction

### 5.1 Browser Snapshot

**Purpose:** Get accessibility tree snapshot of page

**Expected Behavior:**
- Returns simplified DOM tree with:
  - Semantic HTML structure
  - Accessible text content
  - Clickable elements
  - Form inputs
  - ARIA labels
  - Roles
- Filters out non-interactive/invisible elements
- Returns in easy-to-parse format

**Parameters:** None

**Use Cases:**
- AI understanding page structure
- Finding elements by semantic meaning
- Accessibility testing

**Edge Cases:**
- Very large page: May truncate or take long time
- Shadow DOM: Attempts to access (may be limited)
- iframes: Includes accessible content

**Error Conditions:**
- Not attached to tab
- Page not loaded
- Timeout

---

### 5.2 Browser Take Screenshot

**Purpose:** Capture visual screenshot of page

**Expected Behavior:**
- Captures screenshot as image
- Default: viewport only, JPEG quality 80
- Optional: full page scroll screenshot
- Optional: highlight clickable elements
- Returns base64 image data or saves to file

**Parameters:**
```json
{
  "type": "jpeg",           // or "png"
  "quality": 80,            // 0-100 (JPEG only)
  "fullPage": false,        // capture entire page
  "highlightClickables": false,
  "path": "/path/to/save.jpg"  // optional
}
```

**Edge Cases:**
- Very tall page with fullPage: May be large file
- Scrolling triggers lazy-load: Screenshots include newly loaded content
- Fixed position elements: Appear in correct position
- Hidden elements: Not visible in screenshot

**Error Conditions:**
- Not attached to tab
- Invalid parameters
- File write error (if path specified)
- Timeout

---

### 5.3 Browser Extract Content

**Purpose:** Extract main content as clean markdown

**Expected Behavior:**
- Detects main content area (article, main, etc.)
- Converts to markdown format
- Removes navigation, ads, sidebars
- Preserves headings, lists, links, code blocks
- Returns paginated content (500 lines default)

**Parameters:**
```json
{
  "mode": "auto",        // auto/full/selector
  "selector": ".article",  // if mode=selector
  "max_lines": 500,
  "offset": 0           // for pagination
}
```

**Modes:**
- `auto`: Smart detection of main content
- `full`: Entire page
- `selector`: Specific element

**Edge Cases:**
- No main content detected: Falls back to body
- Large article: Pagination with offset
- Tables: Converted to markdown tables
- Images: Includes alt text and URLs
- Code blocks: Preserved with syntax highlighting markers

**Error Conditions:**
- Not attached to tab
- Selector not found (if mode=selector)
- Page not loaded

---

### 5.4 Browser Lookup

**Purpose:** Search for elements by text content

**Expected Behavior:**
- Searches page for elements containing text
- Returns array of matches with:
  - `selector` - CSS selector to element
  - `text` - Matched text content
  - `tagName` - Element type
  - `visible` - Is element visible
- Case-insensitive search
- Partial text matching

**Parameters:**
```json
{
  "text": "Submit",
  "limit": 10  // max results
}
```

**Use Cases:**
- Finding elements when CSS selector unknown
- "Did you mean?" suggestions when selector fails
- Debugging interaction issues

**Edge Cases:**
- No matches: Returns empty array
- Many matches: Returns top N (limit)
- Text in hidden element: Includes in results with visible=false

**Error Conditions:**
- Not attached to tab
- Empty text parameter

---

## 6. Network Monitoring

### 6.1 Browser Network Requests - List

**Purpose:** List captured network requests with filtering

**Expected Behavior:**
- Returns array of requests with:
  - `requestId` - Unique ID for details/replay
  - `url` - Request URL
  - `method` - HTTP method
  - `status` - Response status code
  - `resourceType` - Type (document, xhr, fetch, script, image, etc.)
  - `timestamp` - When request occurred
- Supports filtering and pagination
- Lightweight overview (not full details)

**Parameters:**
```json
{
  "action": "list",
  "urlPattern": "api/users",      // optional filter
  "method": "GET",                 // optional filter
  "status": 200,                   // optional filter
  "resourceType": "xhr",           // optional filter
  "limit": 20,                     // default: 20
  "offset": 0                      // for pagination
}
```

**Edge Cases:**
- No requests captured: Returns empty array
- Thousands of requests: Pagination required
- Request in progress: Shows partial info
- Failed request: Shows error status

**Error Conditions:**
- Not attached to tab

---

### 6.2 Browser Network Requests - Details

**Purpose:** Get full details of a specific request

**Expected Behavior:**
- Returns complete request/response:
  - Request headers
  - Request body (if available)
  - Response headers
  - Response body (if available)
  - Timing information
  - Size information
- Supports JSONPath filtering for large JSON responses

**Parameters:**
```json
{
  "action": "details",
  "requestId": "12345.67",
  "jsonPath": "$.data.items[0]"  // optional, filters JSON response
}
```

**Edge Cases:**
- Request body is binary: Returns base64
- Response is huge JSON: Use jsonPath to filter
- Response is image: Returns metadata only
- Request still in progress: Returns partial data

**Error Conditions:**
- Not attached to tab
- Invalid requestId
- Request not found (cleared or old)
- Invalid JSONPath syntax

---

### 6.3 Browser Network Requests - Replay

**Purpose:** Re-execute a captured request

**Expected Behavior:**
- Takes captured request
- Re-executes it with same:
  - Method
  - URL
  - Headers
  - Body
- Returns new response
- Useful for testing APIs

**Parameters:**
```json
{
  "action": "replay",
  "requestId": "12345.67"
}
```

**Edge Cases:**
- Authentication required: May fail if tokens expired
- Request has side effects: Executes again (creates duplicate, etc.)
- Request URL is relative: Resolves relative to page

**Error Conditions:**
- Not attached to tab
- Invalid requestId
- Network error
- CORS restrictions

---

### 6.4 Browser Network Requests - Clear

**Purpose:** Clear captured request history

**Expected Behavior:**
- Clears all captured requests
- Frees memory
- Returns success

**Parameters:**
```json
{ "action": "clear" }
```

**Edge Cases:**
- Already empty: Succeeds silently

**Error Conditions:**
- Not attached to tab

---

## 7. Advanced Features

### 7.1 Browser Evaluate

**Purpose:** Execute JavaScript in page context

**Expected Behavior:**
- Executes JavaScript code
- Returns result
- Has access to page DOM and variables
- Runs in MAIN world (page context, not isolated)

**Parameters:**
```json
{
  "expression": "document.title"
}
```

or

```json
{
  "function": "() => { return document.querySelectorAll('button').length; }"
}
```

**Edge Cases:**
- Code throws error: Returns error with stack trace
- Code returns undefined: Returns null
- Code returns complex object: Serializes to JSON
- Code with syntax error: Returns parse error

**Error Conditions:**
- Not attached to tab
- Invalid JavaScript
- Execution timeout
- Security error (CSP restrictions)

**Security Notes:**
- Only use with trusted code
- Can modify page state
- Can access sensitive data

---

### 7.2 Browser Handle Dialog

**Purpose:** Set up auto-response for dialogs (alert/confirm/prompt)

**Expected Behavior:**
- Overrides window.alert, window.confirm, window.prompt
- Auto-responds to dialogs instead of blocking
- Logs dialog events for later inspection
- Dialog responses:
  - `alert`: Closes immediately (no return value)
  - `confirm`: Returns accept value (true/false)
  - `prompt`: Returns promptText (if accept) or null (if dismiss)

**Parameters:**
```json
{
  "accept": true,
  "text": "My response"  // for prompt() only
}
```

**Use Cases:**
- Automated testing without manual intervention
- Handling confirmation dialogs
- Filling prompt dialogs

**Edge Cases:**
- Dialog already showing: Cannot intercept (must be set up before)
- Multiple dialogs: All handled with same response
- Page reloads: Must re-inject dialog handlers

**Error Conditions:**
- Not attached to tab
- Cannot inject (CSP restrictions)

---

### 7.3 Browser Window

**Purpose:** Manage browser window (resize, minimize, maximize, close)

**Expected Behavior:**

**Resize:**
- Changes window size to specified dimensions
- Returns new window size

**Minimize:**
- Minimizes browser window
- Returns success

**Maximize:**
- Maximizes browser window
- Returns success

**Close:**
- Closes browser window
- All tabs in window close
- Returns success

**Parameters:**
```json
{ "action": "resize", "width": 1024, "height": 768 }
{ "action": "minimize" }
{ "action": "maximize" }
{ "action": "close" }
```

**Edge Cases:**
- Resize below minimum: Browser enforces minimum size
- Resize above screen: Browser limits to screen size
- Close with unsaved data: Browser may show confirmation

**Error Conditions:**
- Not connected to browser
- Invalid dimensions (negative, zero)

---

### 7.4 Browser Performance Metrics

**Purpose:** Collect Web Vitals and performance metrics

**Expected Behavior:**
- Returns performance metrics:
  - FCP (First Contentful Paint)
  - LCP (Largest Contentful Paint)
  - CLS (Cumulative Layout Shift)
  - TTFB (Time to First Byte)
  - FID (First Input Delay)
  - Navigation timing
  - Resource timing

**Parameters:** None

**Edge Cases:**
- Metrics not available yet: Returns null for missing metrics
- SPA: Metrics for initial page load only
- Very fast page: Some metrics may be 0

**Error Conditions:**
- Not attached to tab
- Page not loaded
- Performance API not available

---

### 7.5 Browser PDF Save

**Purpose:** Save current page as PDF

**Expected Behavior:**
- Generates PDF of current page
- Saves to specified file path
- Returns success with file path

**Parameters:**
```json
{
  "path": "/path/to/save.pdf"
}
```

**Edge Cases:**
- Page with print styles: Uses print CSS
- Page too tall: May split across pages
- Images/fonts may not embed: PDF may look different

**Error Conditions:**
- Not attached to tab
- Invalid file path
- Write permission denied
- Generation failed

---

### 7.6 Browser List Extensions

**Purpose:** List installed browser extensions

**Expected Behavior:**
- Returns array of extensions with:
  - `id` - Extension ID
  - `name` - Extension name
  - `version` - Extension version
  - `enabled` - Is enabled

**Parameters:** None

**Edge Cases:**
- No extensions: Returns empty array
- Extension info unavailable: Returns partial info

**Error Conditions:**
- Not connected to browser

---

### 7.7 Browser Reload Extensions

**Purpose:** Reload browser extensions

**Expected Behavior:**
- Reloads all extensions
- Or reloads specific extension by name
- Returns success

**Parameters:**
```json
{
  "extensionName": "Blueprint MCP for Chrome"  // optional
}
```

**Use Cases:**
- Development: Reload extension after code changes
- Fix stuck extension

**Edge Cases:**
- Extension not found: Returns error
- Extension can't reload: Returns error

**Error Conditions:**
- Not connected to browser
- Invalid extension name

---

## 8. Error Handling

### General Error Format

All tools return errors in consistent format:

```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "Error message with details"
  }]
}
```

### Common Error Types

1. **State Errors**
   - "Not enabled - use enable tool first"
   - "Not connected to browser"
   - "Not attached to tab"

2. **Parameter Errors**
   - "Missing required parameter: {param}"
   - "Invalid parameter value: {param}"

3. **Element Errors**
   - "Selector not found: {selector}"
   - "Element not visible: {selector}"
   - "Element not clickable: {selector}"
   - "Multiple elements found: {count} (showing first, use more specific selector)"

4. **Network Errors**
   - "Network error: {details}"
   - "Timeout after {seconds}s"

5. **Browser Errors**
   - "Browser disconnected"
   - "Tab closed"
   - "Navigation failed: {reason}"

### Error Recovery

- **Auto-reconnect:** If browser disconnects, automatically attempts to reconnect (PRO mode)
- **Retry logic:** Network errors retry with exponential backoff
- **Graceful degradation:** If feature unavailable, fallback to alternative or clear error

---

## 9. Tech Stack Detection

### Purpose

Automatically detect frameworks, libraries, and tools used on current page

### Detected Technologies

**JS Frameworks:**
- React (+ Next.js)
- Vue
- Angular
- Svelte
- Ember
- Turbo/Hotwire
- Google Wiz
- Polymer

**JS Libraries:**
- jQuery
- htmx
- Stimulus
- Alpine.js
- Lodash
- Moment.js

**CSS Frameworks:**
- Bootstrap
- Tailwind
- Material-UI
- Bulma
- Ant Design

**Dev Tools:**
- Hotwire Spark (auto-reload)
- Vite HMR
- Webpack HMR
- Parcel HMR
- LiveReload

### Detection Methods

- Global object detection (window.React, window.Vue, etc.)
- DevTools hooks (__REACT_DEVTOOLS_GLOBAL_HOOK__)
- DOM patterns (mount points, custom elements)
- Import maps
- Meta tags
- Class name patterns

### Behavior

- Runs automatically after navigation
- Runs on SPA route changes
- Skipped in stealth mode (to avoid detection)
- Results shown in status header

---

## 10. Stealth Mode

### Purpose

Avoid bot detection by minimizing automation footprint

### Features

- Uses real browser profile (logged-in sessions)
- No Playwright signatures
- Real browser fingerprint
- Optional: Skip injections (console capture, tech stack detection)

### How to Enable

```json
{
  "action": "attach",
  "index": 0,
  "stealth": true  // extension passes this to server
}
```

### What Changes

- Console capture: Disabled
- Tech stack detection: Disabled
- Dialog overrides: Still enabled (necessary for automation)
- CDP commands: Minimal set

### Indicators

Status header shows: `🥷 Stealth` when active

---

## Summary

This specification covers:
- ✅ 20+ browser automation tools
- ✅ Expected behavior for each
- ✅ All parameters (required/optional)
- ✅ Edge cases
- ✅ Error conditions
- ✅ Examples

Next steps:
1. Create automated tests based on this spec
2. Create manual test procedures for visual/integration testing
3. Set up CI/CD to run tests automatically
