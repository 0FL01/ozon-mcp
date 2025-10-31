# Manual Testing Documentation

This directory contains comprehensive manual testing procedures for Blueprint MCP server. Each file covers a specific feature area with detailed test cases that can be executed against a real MCP server and browser.

## Overview

**Total Test Count:** 85 manual tests (73 original + 12 side effects tests)
**Test Files:** 9 files
**Coverage:** All 20+ browser automation tools

## Test Files

### 01-connection-setup.md
**Tests:** 6 tests
**Tools:** `enable`, `disable`, `status`, `auth`
**Description:** Connection lifecycle, server states, enable/disable flow
**Prerequisites:** MCP server, Chrome with extension

### 02-tab-management.md
**Tests:** 8 tests
**Tools:** `browser_tabs`
**Description:** Tab operations - list, create, attach, close, activate
**Prerequisites:** Server enabled and connected

### 03-navigation.md
**Tests:** 19 tests (7 navigation + 12 side effects)
**Tools:** `browser_navigate`, `browser_interact` (side effects detection)
**Description:** Page navigation - URL, back, forward, reload, test page, click-triggered navigation with side effects detection (Issue #12 fix)
**Prerequisites:** Server connected, tab attached

### 04-interactions.md
**Tests:** 10 tests
**Tools:** `browser_interact`
**Description:** Page interactions - click, type, clear, hover, scroll, keys
**Prerequisites:** Test page loaded

### 05-content-extraction.md
**Tests:** 9 tests
**Tools:** `browser_snapshot`, `browser_extract_content`, `browser_take_screenshot`
**Description:** Content retrieval - DOM snapshot, markdown extraction, screenshots
**Prerequisites:** Page loaded

### 06-forms-lookup.md
**Tests:** 6 tests
**Tools:** `browser_fill_form`, `browser_lookup`
**Description:** Form filling, element search by text
**Prerequisites:** Form page loaded

### 07-network-monitoring.md
**Tests:** 10 tests
**Tools:** `browser_network_requests`
**Description:** Network monitoring - list, filter, details, JSONPath, replay, clear
**Prerequisites:** Server connected

### 08-console-verification.md
**Tests:** 7 tests
**Tools:** `browser_console_messages`, `browser_verify_text_visible`, `browser_verify_element_visible`
**Description:** Console logs, text/element verification
**Prerequisites:** Server connected

### 09-advanced-features.md
**Tests:** 10 tests
**Tools:** `browser_evaluate`, `browser_window`, `browser_pdf_save`, `browser_list_extensions`, `browser_reload_extensions`, `browser_performance_metrics`, `browser_handle_dialog`
**Description:** JavaScript evaluation, window control, PDF export, extensions, performance, dialogs
**Prerequisites:** Server connected

## How to Use These Tests

### Test Execution Order

1. **Start with 01-connection-setup.md** - Establishes connection
2. **Follow numbered order** - Tests build on previous state
3. **Can jump between files** - After initial setup complete

### Test Format

Each test includes:
- **Test ID** (MT-XX) for reference
- **Description** - What is being tested
- **Prerequisites** - Required state/setup
- **Steps** - Exact commands to issue
- **Expected Results** - What should happen
- **Pass Criteria** - Checklist for verification

### Prerequisites

**System Requirements:**
- Node.js 18+
- Blueprint MCP server installed
- Chrome browser
- Blueprint MCP Chrome extension installed

**Initial Setup:**
```bash
# Start MCP server in debug mode
cd server
node cli.js --debug

# Or with custom log file
node cli.js --debug --log-file ../logs/manual-test.log
```

**Extension Setup:**
- Install Blueprint MCP extension in Chrome
- Extension should auto-connect when server enabled
- Green icon indicates connection

### Command Format

All test commands use standard MCP tool format:
```json
{
  "tool": "browser_navigate",
  "arguments": {
    "action": "url",
    "url": "https://example.com"
  }
}
```

### Test Execution Tips

1. **Enable Debug Mode** - Easier to troubleshoot issues
2. **Use Test Page** - Many tests reference test page (use `browser_navigate` action `test_page`)
3. **Check Status Often** - Use `status` tool to verify current state
4. **Note State Changes** - Some tests change browser/tab state
5. **Reset if Needed** - Can `disable` and `enable` to reset

### Tracking Results

Create a tracking sheet with columns:
- Test ID (MT-XX)
- Pass/Fail
- Notes
- Date Tested
- Tester Name

## Test Coverage Matrix

| Feature Area | Test Count | Tools Covered |
|--------------|-----------|---------------|
| Connection & Setup | 6 | 4 tools |
| Tab Management | 8 | 1 tool |
| Navigation | 19 (7 + 12 side effects) | 2 tools |
| Interactions | 10 | 1 tool |
| Content Extraction | 9 | 3 tools |
| Forms & Lookup | 6 | 2 tools |
| Network Monitoring | 10 | 1 tool |
| Console & Verification | 7 | 3 tools |
| Advanced Features | 10 | 7 tools |
| **TOTAL** | **85** | **24 tools** |

## Test Page

Many tests reference the "test page" which can be loaded using:
```json
{
  "tool": "browser_navigate",
  "arguments": {
    "action": "test_page"
  }
}
```

The test page provides:
- Form inputs (text, select, checkbox, radio)
- Buttons with IDs
- Elements for interaction testing
- Console logging examples
- Network request triggers
- Predictable DOM structure

## Common Issues

### Extension Not Connecting
- Check extension is installed and enabled
- Verify server is running
- Check port 5555 is not in use
- Try reloading extension

### Tests Failing After MT-05 (Disable)
- Need to re-enable server
- Run MT-02 again to reconnect

### Tab Closed Unexpectedly
- Cannot close last tab (closes browser)
- Keep at least 2 tabs open
- Re-attach to different tab if current closed

### Network Requests Not Showing
- Network monitoring starts when extension connects
- Navigate to page after enable
- Refresh page to generate requests

## Reporting Issues

When filing bug reports, include:
1. Test ID that failed (MT-XX)
2. Expected result from documentation
3. Actual result observed
4. Server logs (from debug mode)
5. Browser console errors (if any)
6. Steps to reproduce

## Contributing

To add new manual tests:
1. Follow existing test format
2. Include all sections (Description, Prerequisites, Steps, etc.)
3. Assign next available MT-XX ID
4. Update this README with test count
5. Add to appropriate file or create new file for new feature area

## Automated vs Manual

These are **manual tests** executed by human testers. For automated tests, see:
- `tests/unit/` - Jest unit tests
- `tests/integration/` - Integration tests
- `tests/smoke.test.js` - Quick sanity checks

Manual tests complement automated tests by:
- Testing with real browser
- Verifying UI/UX behavior
- Catching visual issues
- Testing end-to-end workflows
- Validating actual user experience

## Version Compatibility

These tests are written for:
- Blueprint MCP Server v1.7.2+
- Chrome Extension (TypeScript version)
- MCP SDK v1.17+

When testing different versions:
- Note version numbers
- Document any deviations from expected results
- Report version-specific issues separately
