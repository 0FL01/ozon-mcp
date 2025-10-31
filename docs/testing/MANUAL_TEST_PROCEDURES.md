# Manual Test Procedures

This document provides step-by-step procedures for manually testing features that require real browser interaction.

## Pre-requisites

- Blueprint MCP server installed
- Chrome extension installed and enabled
- Firefox extension installed and enabled (for cross-browser testing)
- Test websites available
- Claude Code or other MCP client for running commands

---

## Test Environment Setup

### 1. Start Server in Debug Mode

```bash
cd server
node cli.js --debug
```

**Expected output:**
```
[Wrapper] Starting in wrapper mode with auto-reload enabled
[Wrapper] Press Ctrl+C to exit
[Wrapper] Starting MCP server...
[FileLogger] Logging enabled - writing to: ~/Library/Logs/blueprint-mcp/mcp-debug.log
[cli.js] Starting MCP server in PASSIVE mode (no connections)
[cli.js] Version: 1.7.2
[cli.js] Use connect tool to activate
[cli.js] Debug mode: ENABLED
[cli.js] MCP server ready (passive mode)
```

### 2. Verify Extension Installed

**Chrome:**
1. Navigate to `chrome://extensions`
2. Find "Blueprint MCP for Chrome"
3. Verify version matches release
4. Click extension icon - should show "Not Connected"

**Firefox:**
1. Navigate to `about:addons`
2. Find "Blueprint MCP for Firefox"
3. Verify version matches release
4. Click extension icon - should show "Not Connected"

---

## Test Suite 1: Connection & Setup

### Test 1.1: Free Mode Connection

**Objective:** Verify Free mode connection works

**Steps:**
1. Open MCP client (Claude Code)
2. Run: `enable` with `client_id: "test-free"`
3. Observe extension icon changes to "Connected"
4. Run: `status`

**Expected Results:**
- ✅ Enable returns "Waiting for extension connection"
- ✅ Extension icon shows "Connected" with green indicator
- ✅ Status shows:
  ```
  ✅ Free v1.7.2 | 🌐 Chrome [Your Computer Name]
  ```

**Pass/Fail:** ___

**Notes:** ___

---

### Test 1.2: PRO Mode Login

**Objective:** Verify OAuth login flow works

**Steps:**
1. Run: `auth` with `action: "login"`
2. Browser opens to login page
3. Login with test credentials
4. Wait for "Login successful" message
5. Run: `auth` with `action: "status"`

**Expected Results:**
- ✅ Browser opens automatically
- ✅ Login page loads
- ✅ After login, tokens captured and window closes
- ✅ Status shows authenticated email

**Pass/Fail:** ___

**Notes:** ___

---

### Test 1.3: PRO Mode Connection (Single Browser)

**Objective:** Verify PRO auto-connects to single browser

**Steps:**
1. Ensure only ONE browser has extension connected to relay
2. Run: `enable` with `client_id: "test-pro"`
3. Wait for connection
4. Run: `status`

**Expected Results:**
- ✅ Enable completes successfully
- ✅ Auto-connects to browser
- ✅ Auto-attaches to last tab
- ✅ Status shows:
  ```
  ✅ PRO v1.7.2 | 🌐 Chrome [Browser Name] | 📄 Tab #X: [URL]
  ```

**Pass/Fail:** ___

**Notes:** ___

---

### Test 1.4: PRO Mode Connection (Multiple Browsers)

**Objective:** Verify browser selection works with multiple browsers

**Steps:**
1. Have 2+ browsers with extension connected (e.g., Chrome + Firefox)
2. Run: `enable` with `client_id: "test-multi"`
3. Observe list of browsers shown
4. Run: `browser_connect` with browser_id from list
5. Run: `status`

**Expected Results:**
- ✅ Enable returns list of browsers
- ✅ List shows browser names and IDs
- ✅ Browser_connect succeeds
- ✅ Status shows connected to selected browser

**Pass/Fail:** ___

**Notes:** ___

---

## Test Suite 2: Tab Management

### Test 2.1: List Tabs

**Objective:** Verify tab listing works

**Setup:**
- Open 3-5 tabs in browser with different URLs

**Steps:**
1. Ensure connected
2. Run: `browser_tabs` with `action: "list"`

**Expected Results:**
- ✅ Returns array of tabs
- ✅ Each tab has: index, id, url, title, active
- ✅ One tab marked as active=true
- ✅ Count matches actual tab count

**Pass/Fail:** ___

**Notes:** ___

---

### Test 2.2: Create New Tab

**Objective:** Verify tab creation works

**Steps:**
1. Note current tab count
2. Run: `browser_tabs` with:
   ```json
   {
     "action": "new",
     "url": "https://example.com",
     "activate": true
   }
   ```
3. Observe browser

**Expected Results:**
- ✅ New tab created
- ✅ Tab navigates to example.com
- ✅ Tab comes to foreground
- ✅ Auto-attached to new tab
- ✅ Status shows new tab URL

**Pass/Fail:** ___

**Notes:** ___

---

### Test 2.3: Attach to Tab

**Objective:** Verify attaching to different tab works

**Steps:**
1. List tabs
2. Note current attached tab index
3. Run: `browser_tabs` with `action: "attach", index: [different index]`
4. Run: `status`

**Expected Results:**
- ✅ Attach succeeds
- ✅ Status shows new tab URL
- ✅ CDP debugger connected (may see indicator in tab)

**Pass/Fail:** ___

**Notes:** ___

---

### Test 2.4: Close Tab

**Objective:** Verify tab closing works

**Steps:**
1. Create a new tab: `browser_tabs` with `action: "new"`
2. Note tab index
3. Run: `browser_tabs` with `action: "close", index: [tab index]`
4. Observe browser

**Expected Results:**
- ✅ Close succeeds
- ✅ Tab disappears from browser
- ✅ If was attached tab, detaches automatically

**Pass/Fail:** ___

**Notes:** ___

---

## Test Suite 3: Navigation

### Test 3.1: Navigate to URL

**Objective:** Verify URL navigation works

**Test Pages:**
- https://example.com
- https://github.com
- https://google.com

**Steps:**
1. For each test URL:
   - Run: `browser_navigate` with `action: "url", url: [test URL]`
   - Wait for navigation
   - Run: `status`

**Expected Results:**
- ✅ Navigation completes
- ✅ Page loads correctly
- ✅ Status shows final URL (after redirects)
- ✅ Tech stack detected (if applicable)

**Pass/Fail:** ___

**Notes:** ___

---

### Test 3.2: Navigation History

**Objective:** Verify back/forward/reload work

**Steps:**
1. Navigate to `https://example.com`
2. Navigate to `https://github.com`
3. Run: `browser_navigate` with `action: "back"`
4. Verify returned to example.com
5. Run: `browser_navigate` with `action: "forward"`
6. Verify returned to github.com
7. Run: `browser_navigate` with `action: "reload"`
8. Verify page reloaded

**Expected Results:**
- ✅ Back navigates to previous page
- ✅ Forward navigates to next page
- ✅ Reload refreshes current page
- ✅ Each returns correct URL

**Pass/Fail:** ___

**Notes:** ___

---

### Test 3.3: Test Page

**Objective:** Verify test page loads and contains expected elements

**Steps:**
1. Run: `browser_navigate` with `action: "test_page"`
2. Wait for load
3. Run: `browser_snapshot`
4. Review snapshot for expected elements

**Expected Results:**
- ✅ Navigates to test page
- ✅ Page loads successfully
- ✅ Snapshot contains:
  - Buttons
  - Input fields
  - Forms
  - Links
  - Dialogs triggers

**Pass/Fail:** ___

**Notes:** ___

---

## Test Suite 4: Element Interaction

**Setup for all tests:** Navigate to test page first

### Test 4.1: Click Button

**Steps:**
1. Run: `browser_interact` with:
   ```json
   {
     "actions": [{
       "type": "click",
       "selector": "button:has-text('Click Me')"
     }]
   }
   ```
2. Observe page

**Expected Results:**
- ✅ Button clicks successfully
- ✅ Expected action occurs (alert, text change, etc.)

**Pass/Fail:** ___

---

### Test 4.2: Type into Input

**Steps:**
1. Run: `browser_interact` with:
   ```json
   {
     "actions": [{
       "type": "type",
       "selector": "input[name='username']",
       "text": "testuser123"
     }]
   }
   ```
2. Observe input field

**Expected Results:**
- ✅ Text appears in input
- ✅ Text matches exactly: "testuser123"

**Pass/Fail:** ___

---

### Test 4.3: Fill Form

**Steps:**
1. Run: `browser_fill_form` with:
   ```json
   {
     "fields": [
       { "selector": "input[name='username']", "value": "admin" },
       { "selector": "input[name='password']", "value": "secret" },
       { "selector": "input[name='email']", "value": "test@example.com" }
     ]
   }
   ```
2. Observe form fields

**Expected Results:**
- ✅ All fields filled correctly
- ✅ Values match input

**Pass/Fail:** ___

---

### Test 4.4: Multiple Actions Sequence

**Steps:**
1. Run: `browser_interact` with:
   ```json
   {
     "actions": [
       { "type": "click", "selector": "input[name='username']" },
       { "type": "type", "selector": "input[name='username']", "text": "admin" },
       { "type": "click", "selector": "input[name='password']" },
       { "type": "type", "selector": "input[name='password']", "text": "secret" },
       { "type": "click", "selector": "button[type='submit']" }
     ]
   }
   ```
2. Observe form submission

**Expected Results:**
- ✅ Each action executes in order
- ✅ Form submits successfully
- ✅ Page responds appropriately

**Pass/Fail:** ___

---

### Test 4.5: Selector with Special Characters

**Steps:**
1. Run: `browser_interact` with:
   ```json
   {
     "actions": [{
       "type": "click",
       "selector": "button:has-text('Все отзывы')"
     }]
   }
   ```

**Expected Results:**
- ✅ Finds element with Cyrillic text
- ✅ Clicks successfully
- ✅ No JavaScript errors

**Pass/Fail:** ___

---

## Test Suite 5: Content Extraction

### Test 5.1: DOM Snapshot

**Steps:**
1. Navigate to https://example.com
2. Run: `browser_snapshot`
3. Review snapshot output

**Expected Results:**
- ✅ Returns accessibility tree
- ✅ Contains headings, links, text
- ✅ Shows clickable elements
- ✅ Omits non-interactive elements

**Pass/Fail:** ___

---

### Test 5.2: Screenshot (Viewport)

**Steps:**
1. Navigate to https://example.com
2. Run: `browser_take_screenshot` with default params
3. View returned image

**Expected Results:**
- ✅ Returns base64 image data
- ✅ Image shows viewport area
- ✅ Quality acceptable (default: 80)

**Pass/Fail:** ___

---

### Test 5.3: Screenshot (Full Page)

**Steps:**
1. Navigate to long page (e.g., https://github.com)
2. Run: `browser_take_screenshot` with `fullPage: true`
3. View returned image

**Expected Results:**
- ✅ Captures entire page (scroll height)
- ✅ No missing sections
- ✅ Fixed elements in correct position

**Pass/Fail:** ___

---

### Test 5.4: Screenshot with Highlights

**Steps:**
1. Navigate to test page
2. Run: `browser_take_screenshot` with `highlightClickables: true`
3. View returned image

**Expected Results:**
- ✅ Clickable elements have green border/background
- ✅ Easy to identify interactive elements

**Pass/Fail:** ___

---

### Test 5.5: Extract Content (Auto Mode)

**Steps:**
1. Navigate to article page (e.g., Wikipedia article)
2. Run: `browser_extract_content` with `mode: "auto"`
3. Review markdown output

**Expected Results:**
- ✅ Extracts main article content
- ✅ Omits navigation, sidebar, ads
- ✅ Preserves headings, lists, links
- ✅ Clean markdown format

**Pass/Fail:** ___

---

### Test 5.6: Element Lookup

**Steps:**
1. Navigate to test page
2. Run: `browser_lookup` with `text: "Submit"`
3. Review results

**Expected Results:**
- ✅ Returns array of matching elements
- ✅ Each has selector, text, tagName, visible
- ✅ All matches contain "Submit" (case-insensitive)

**Pass/Fail:** ___

---

## Test Suite 6: Network Monitoring

### Test 6.1: List Network Requests

**Steps:**
1. Navigate to page with API calls (e.g., GitHub)
2. Wait for page load
3. Run: `browser_network_requests` with `action: "list"`

**Expected Results:**
- ✅ Returns array of requests
- ✅ Each has: requestId, url, method, status, resourceType
- ✅ Includes document, script, xhr, fetch types

**Pass/Fail:** ___

---

### Test 6.2: Filter Network Requests

**Steps:**
1. Navigate to GitHub
2. Run: `browser_network_requests` with:
   ```json
   {
     "action": "list",
     "resourceType": "xhr",
     "status": 200
   }
   ```

**Expected Results:**
- ✅ Returns only XHR requests
- ✅ All have status 200
- ✅ Excludes document, script, etc.

**Pass/Fail:** ___

---

### Test 6.3: Request Details

**Steps:**
1. List requests
2. Copy requestId from an API call
3. Run: `browser_network_requests` with:
   ```json
   {
     "action": "details",
     "requestId": "[copied ID]"
   }
   ```

**Expected Results:**
- ✅ Returns full request/response
- ✅ Includes headers
- ✅ Includes body (if available)
- ✅ Includes timing info

**Pass/Fail:** ___

---

### Test 6.4: JSONPath Filtering

**Steps:**
1. Find request with large JSON response
2. Run: `browser_network_requests` with:
   ```json
   {
     "action": "details",
     "requestId": "[ID]",
     "jsonPath": "$.items[0]"
   }
   ```

**Expected Results:**
- ✅ Returns only filtered portion
- ✅ JSONPath correctly applied
- ✅ Result is valid JSON

**Pass/Fail:** ___

---

### Test 6.5: Replay Request

**Steps:**
1. Find GET request
2. Run: `browser_network_requests` with:
   ```json
   {
     "action": "replay",
     "requestId": "[ID]"
   }
   ```

**Expected Results:**
- ✅ Re-executes request
- ✅ Returns new response
- ✅ Same URL and headers used

**Pass/Fail:** ___

---

## Test Suite 7: Advanced Features

### Test 7.1: JavaScript Evaluation

**Steps:**
1. Navigate to any page
2. Run: `browser_evaluate` with:
   ```json
   {
     "expression": "document.querySelectorAll('a').length"
   }
   ```

**Expected Results:**
- ✅ Returns number of links
- ✅ Result is numeric
- ✅ Matches actual link count

**Pass/Fail:** ___

---

### Test 7.2: Dialog Handling (Alert)

**Steps:**
1. Navigate to test page
2. Run: `browser_handle_dialog` with `accept: true`
3. Click button that triggers alert
4. Observe alert handled automatically

**Expected Results:**
- ✅ Alert auto-dismissed
- ✅ No blocking dialog
- ✅ Page continues

**Pass/Fail:** ___

---

### Test 7.3: Dialog Handling (Confirm)

**Steps:**
1. Set up dialog handler with `accept: true`
2. Click button that triggers confirm()
3. Observe result

**Expected Results:**
- ✅ Confirm auto-accepted
- ✅ Returns true to page
- ✅ "Yes" action executes

**Pass/Fail:** ___

---

### Test 7.4: Dialog Handling (Prompt)

**Steps:**
1. Run: `browser_handle_dialog` with:
   ```json
   {
     "accept": true,
     "text": "My Answer"
   }
   ```
2. Click button that triggers prompt()
3. Observe result

**Expected Results:**
- ✅ Prompt auto-answered
- ✅ Returns "My Answer" to page
- ✅ Answer used by page

**Pass/Fail:** ___

---

### Test 7.5: Performance Metrics

**Steps:**
1. Navigate to any page
2. Wait for full load
3. Run: `browser_performance_metrics`

**Expected Results:**
- ✅ Returns metrics object
- ✅ Contains FCP, LCP, TTFB
- ✅ All values > 0

**Pass/Fail:** ___

---

### Test 7.6: PDF Export

**Steps:**
1. Navigate to page
2. Run: `browser_pdf_save` with `path: "/tmp/test.pdf"`
3. Check file exists

**Expected Results:**
- ✅ PDF created successfully
- ✅ File size > 0
- ✅ PDF opens and shows page content

**Pass/Fail:** ___

---

## Test Suite 8: Tech Stack Detection

### Test 8.1: React Detection

**Steps:**
1. Navigate to React site (e.g., https://react.dev)
2. Run: `status`

**Expected Results:**
- ✅ Status shows "React" in tech stack

**Pass/Fail:** ___

---

### Test 8.2: Multiple Framework Detection

**Steps:**
1. Navigate to page with React + Tailwind
2. Run: `status`

**Expected Results:**
- ✅ Shows both "React" and "Tailwind"
- ✅ Other relevant tools detected

**Pass/Fail:** ___

---

### Test 8.3: Stealth Mode (No Detection)

**Steps:**
1. Attach to tab with `stealth: true`
2. Navigate to site
3. Run: `status`

**Expected Results:**
- ✅ Status shows "🥷 Stealth"
- ✅ No tech stack shown

**Pass/Fail:** ___

---

## Test Suite 9: Browser-Specific Tests

### Test 9.1: Chrome-Specific

**Test in Chrome only:**
- List extensions
- Reload extension
- Window management

**Pass/Fail:** ___

---

### Test 9.2: Firefox-Specific

**Test in Firefox only:**
- Same features as Chrome
- Verify parity

**Pass/Fail:** ___

---

### Test 9.3: Cross-Browser Parity

**Test same workflow in both:**
1. Enable → attach → navigate → click → screenshot

**Expected Results:**
- ✅ Same commands work in both browsers
- ✅ Same results (within browser differences)

**Pass/Fail:** ___

---

## Test Suite 10: Error Handling

### Test 10.1: Invalid Selector

**Steps:**
1. Run: `browser_interact` with invalid selector
2. Observe error

**Expected Results:**
- ✅ Returns error (not crash)
- ✅ Error message helpful
- ✅ Suggests checking selector

**Pass/Fail:** ___

---

### Test 10.2: Element Not Found

**Steps:**
1. Run: `browser_interact` with non-existent selector
2. Observe error

**Expected Results:**
- ✅ Returns "Selector not found"
- ✅ Shows attempted selector
- ✅ Suggests using lookup tool

**Pass/Fail:** ___

---

### Test 10.3: Extension Disconnect During Command

**Steps:**
1. Start command (e.g., navigate)
2. Quickly stop extension
3. Observe behavior

**Expected Results:**
- ✅ Returns error (not hang)
- ✅ Error indicates disconnect
- ✅ Server recovers (doesn't crash)

**Pass/Fail:** ___

---

## Test Report Template

```markdown
# Manual Test Report

**Date:** [Date]
**Tester:** [Name]
**Version:** [MCP Version]
**Browser:** [Chrome/Firefox Version]
**OS:** [macOS/Windows/Linux Version]

## Summary

- **Total Tests:** X
- **Passed:** Y
- **Failed:** Z
- **Skipped:** W

## Failed Tests

| Test ID | Description | Issue | Severity |
|---------|-------------|-------|----------|
| 4.3 | Fill Form | Fields not filled | High |

## Notes

[Any observations, blockers, or issues]

## Conclusion

[Pass/Fail overall, readiness for release]
```

---

## Regression Testing

**Before Each Release:**

Run these critical workflows end-to-end:

1. **Free Mode Workflow**
   - Enable → Attach → Navigate → Click → Screenshot

2. **PRO Mode Workflow**
   - Login → Enable → Attach → Navigate → Click → Screenshot

3. **Form Automation**
   - Navigate → Fill form → Submit → Verify result

4. **Network Monitoring**
   - Navigate → List requests → Get details → Replay

Each workflow should complete successfully without errors.

---

## Performance Testing

### Load Testing

1. Open 50+ tabs
2. List tabs
3. Measure response time (should be < 2s)

### Long-Running Test

1. Run automation for 1 hour
2. Monitor memory usage
3. Verify no memory leaks

### Stress Test

1. Send 100 rapid commands
2. Verify all succeed
3. No crashes or hangs

---

## Summary

This manual test suite covers:
- ✅ All 20+ browser tools
- ✅ Connection modes (Free + PRO)
- ✅ Error scenarios
- ✅ Browser-specific behavior
- ✅ Tech stack detection
- ✅ Performance

**Estimated time:** 2-3 hours for full suite

**Recommended frequency:**
- Full suite: Before major releases
- Critical workflows: Before every release
- Regression tests: After bug fixes
