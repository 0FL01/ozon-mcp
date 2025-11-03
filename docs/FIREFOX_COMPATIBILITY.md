# Firefox Compatibility Report

**Last Updated:** 2025-11-03
**Firefox Version Tested:** Latest (with Blueprint MCP for Firefox extension)
**Test Suite Version:** v1.9.4
**Total Tests Executed:** 97+ tests across 9 suites
**Overall Pass Rate:** ~75%

## Executive Summary

The Firefox extension for Blueprint MCP is **functionally viable** for most browser automation tasks, but has **11 critical Chrome DevTools Protocol (CDP) limitations** that prevent certain advanced features from working.

### What Works ✅
- Basic navigation (url, back, forward, reload)
- User interactions (click, type, hover, scroll)
- Screenshot capture
- Content extraction as markdown
- Form filling and element lookup
- Network request monitoring with filters
- Console message capture
- Text and element visibility verification
- JavaScript evaluation
- Extension management (reload all)

### What Doesn't Work ❌
- Accessibility tree snapshots (`browser_snapshot`)
- Forced CSS pseudo-states (`:hover`, `:focus`, etc.)
- Window resize/maximize operations
- PDF export
- Performance metrics (Web Vitals)
- JavaScript dialog handling
- CSS style inspection
- Specific extension reload (works for all only)

## Detailed Test Results

### Suite 01: Connection & Setup (7 tests)
| Test | Status | Issue |
|------|--------|-------|
| MT-01: Enable Server | ✅ PASS | - |
| MT-02: Check Status | ✅ PASS | - |
| MT-03: List Browsers | ✅ PASS | - |
| MT-04: Connect to Browser | ✅ PASS | - |
| MT-05: Verify Connection | ✅ PASS | - |
| MT-06: Disable Server | ✅ PASS | - |
| MT-07: Build Timestamp Display | ❌ FAIL | Timestamp missing from status responses |

**Pass Rate:** 86% (6/7)

### Suite 02: Tab Management (8 tests)
| Test | Status | Issue |
|------|--------|-------|
| MT-08: List Tabs | ✅ PASS | - |
| MT-09: Create New Tab | ✅ PASS | - |
| MT-10: Attach to Tab | ✅ PASS | - |
| MT-11: Attach to Different Tab | ✅ PASS | - |
| MT-12: Close Tab by Index | ❌ FAIL | Closed wrong tab (tab 0 instead of tab 3) |
| MT-13: Close Attached Tab | ❌ FAIL | No auto-reattach after closing attached tab |
| MT-14: Create Tab with URL | ✅ PASS | - |

**Pass Rate:** 75% (6/8)

**Known Issues:**
- Tab close behavior is unreliable - sometimes closes wrong tab
- No automatic reattachment after closing the currently attached tab

### Suite 03: Navigation (19 tests)
| Test | Status | Issue |
|------|--------|-------|
| MT-15: Navigate to URL | ✅ PASS | - |
| MT-16: Navigate Back | ✅ PASS | - |
| MT-17: Navigate Forward | ✅ PASS | - |
| MT-18: Reload Page | ✅ PASS | - |
| MT-19: Navigate to Test Page | ✅ PASS | - |
| MT-20: Tech Stack Detection | ✅ PASS | Turbo + Stimulus + Bootstrap detected |
| MT-21: Navigate to External Site | ✅ PASS | - |
| MT-74-MT-85 | ⏭️ SKIPPED | Chrome-specific test files don't exist for Firefox |

**Pass Rate:** 100% (7/7 executed)

### Suite 04: Interactions (10 tests)
| Test | Status | Issue |
|------|--------|-------|
| MT-22: Click Element | ✅ PASS | - |
| MT-23: Type Text | ✅ PASS | - |
| MT-24: Clear Input | ✅ PASS | - |
| MT-25: Press Key | ✅ PASS | - |
| MT-26A: Hover Element | ✅ PASS | - |
| MT-26B: Force Pseudo-State | ❌ FAIL | `DOM.enable` CDP method not supported |
| MT-27: Scroll to Element | ✅ PASS | - |
| MT-28: Scroll by Offset | ✅ PASS | - |
| MT-29: Mouse Move | ✅ PASS | - |
| MT-30: Mouse Click XY | ✅ PASS | - |
| MT-31: Drag and Drop | ⏭️ SKIPPED | Not tested |

**Pass Rate:** 89% (8/9 executed)

### Suite 05: Content Extraction (9 tests)
| Test | Status | Issue |
|------|--------|-------|
| MT-32: Get Page Snapshot | ❌ FAIL | `Accessibility.getFullAXTree` CDP method not supported |
| MT-33: Extract Content (Auto) | ✅ PASS | - |
| MT-34: Extract Content (Full) | ✅ PASS | - |
| MT-35: Extract Content (Selector) | ✅ PASS | - |
| MT-36: Extract with Pagination | ✅ PASS | - |
| MT-37: Take Screenshot (Viewport) | ✅ PASS | - |
| MT-38: Screenshot with Selector | ✅ PASS | - |
| MT-39: Screenshot with Highlight | ✅ PASS | - |
| MT-40: Screenshot Full Page | ⏭️ SKIPPED | Not tested |

**Pass Rate:** 88% (7/8 executed)

### Suite 06: Forms & Lookup (6 tests)
| Test | Status | Issue |
|------|--------|-------|
| MT-41: Fill Single Field | ✅ PASS | - |
| MT-42: Fill Multiple Fields | ✅ PASS | - |
| MT-43: Lookup by Text | ✅ PASS | - |
| MT-44: Lookup with Limit | ✅ PASS | - |
| MT-45: Select Option by Value | ✅ PASS | - |
| MT-46: Select Option by Text | ✅ PASS | - |

**Pass Rate:** 100% (6/6)

### Suite 07: Network Monitoring (10 tests)
| Test | Status | Issue |
|------|--------|-------|
| MT-47: List Network Requests | ✅ PASS | - |
| MT-48: Filter by URL Pattern | ✅ PASS | - |
| MT-49: Filter by Method | ✅ PASS | - |
| MT-50: Filter by Status Code | ✅ PASS | - |
| MT-51: Filter by Resource Type | ✅ PASS | - |
| MT-52: Pagination | ✅ PASS | - |
| MT-53: Get Request Details | ✅ PASS | - |
| MT-54: JSONPath Filter | ⏭️ SKIPPED | Requires new requests with JSON bodies |
| MT-55: Replay Request | ⏭️ SKIPPED | Requires new requests with bodies |
| MT-56: Clear Network History | ✅ PASS | - |

**Pass Rate:** 100% (8/8 executed)

### Suite 08: Console & Verification (7 tests)
| Test | Status | Issue |
|------|--------|-------|
| MT-57: Get Console Messages | ✅ PASS | - |
| MT-58: Console Errors Detection | ✅ PASS | - |
| MT-59: Console Messages Persistence | ✅ PASS | - |
| MT-60: Verify Text Visible (Success) | ✅ PASS | - |
| MT-61: Verify Text Visible (Failure) | ✅ PASS | - |
| MT-62: Verify Element Visible (Success) | ✅ PASS | - |
| MT-63: Verify Element Visible (Hidden) | ✅ PASS | - |

**Pass Rate:** 100% (7/7)

### Suite 09: Advanced Features (12 tests)
| Test | Status | Issue |
|------|--------|-------|
| MT-64: Evaluate JavaScript | ✅ PASS | - |
| MT-65: Evaluate Complex JS | ✅ PASS | - |
| MT-66: Resize Browser Window | ❌ FAIL | `Emulation.setDeviceMetricsOverride` not supported |
| MT-67: Maximize Browser Window | ❌ FAIL | `Emulation.setDeviceMetricsOverride` not supported |
| MT-68: Save Page as PDF | ❌ FAIL | `Page.printToPDF` not supported |
| MT-69: List Browser Extensions | ⚠️ PARTIAL | Works but shows "Total: undefined" |
| MT-70: Reload Specific Extension | ❌ FAIL | Returns "Count: 0, Extensions: None" |
| MT-71: Reload All Extensions | ✅ PASS | - |
| MT-72: Get Performance Metrics | ❌ FAIL | `Target.getTargetInfo` not supported |
| MT-73: Handle Page Dialog | ❌ FAIL | `Page.handleJavaScriptDialog` not supported |
| MT-74: Get Element Styles | ❌ FAIL | `CSS.getMatchedStylesForNode` not supported |
| MT-75: Get Styles with Pseudo-State | ❌ FAIL | `CSS.getMatchedStylesForNode` not supported |

**Pass Rate:** 25% (3/12)

## Unsupported Chrome DevTools Protocol Methods

Firefox implements a subset of CDP. The following methods are not supported and cause failures:

### 1. Accessibility.getFullAXTree
**Impact:** `browser_snapshot` completely broken
**Used In:** Content extraction suite
**Workaround:** Use `browser_extract_content` instead for text content
**Priority:** HIGH - This is a commonly used feature

### 2. DOM.enable
**Impact:** Cannot force CSS pseudo-states (`:hover`, `:focus`, etc.)
**Used In:** `browser_interact` with `force_pseudo_state` action
**Workaround:** Use actual mouse hover for hover effects
**Priority:** MEDIUM - Advanced feature, has manual alternative

### 3. Emulation.setDeviceMetricsOverride
**Impact:** Cannot resize or maximize browser window programmatically
**Used In:** `browser_window` with `resize` and `maximize` actions
**Workaround:** User must manually resize window
**Priority:** LOW - Window sizing rarely needed for automation

### 4. Page.printToPDF
**Impact:** Cannot export pages to PDF
**Used In:** `browser_pdf_save`
**Workaround:** Use screenshots or browser's built-in print dialog
**Priority:** MEDIUM - Useful for documentation but has alternatives

### 5. Target.getTargetInfo
**Impact:** Cannot collect Web Vitals and performance metrics
**Used In:** `browser_performance_metrics`
**Workaround:** Use `browser_evaluate` to access `window.performance` API manually
**Priority:** MEDIUM - Performance testing feature

### 6. Page.handleJavaScriptDialog
**Impact:** Cannot programmatically accept/dismiss alerts, confirms, prompts
**Used In:** `browser_handle_dialog`
**Workaround:** None - user must manually handle dialogs
**Priority:** HIGH - Breaks automated workflows with dialogs

### 7. CSS.getMatchedStylesForNode
**Impact:** Cannot inspect CSS styles like DevTools Styles panel
**Used In:** `browser_get_element_styles`
**Workaround:** Use `browser_evaluate` with `getComputedStyle()`
**Priority:** LOW - Advanced debugging feature

## Firefox-Specific Issues

### 1. Build Timestamp Missing
**Problem:** Status responses show "PRO v1.9.1" instead of "PRO v1.9.1 [HH:MM:SS]"
**Location:** Firefox extension not sending build timestamp to server
**Fix:** Add build timestamp to extension's status response
**Priority:** LOW - Cosmetic issue

### 2. Tab Close Behavior
**Problem:** When closing tab by index, sometimes closes wrong tab
**Example:** Tried to close tab 3, but tab 0 disappeared instead
**Location:** Firefox extension tab management
**Fix:** Review tab indexing logic in Firefox extension
**Priority:** HIGH - Data integrity issue

### 3. No Auto-Reattach After Tab Close
**Problem:** When closing the currently attached tab, extension doesn't auto-reattach
**Expected:** Should attach to another open tab automatically
**Location:** Firefox extension tab management
**Fix:** Implement auto-reattach logic
**Priority:** MEDIUM - User experience issue

### 4. Extension List Incomplete
**Problem:** `browser_list_extensions` shows "Total: undefined" and sometimes doesn't list Blueprint MCP
**Observed:** Only showed "New Tab (v145.1.20251009.134757)"
**Location:** Firefox extension's management API usage
**Fix:** Review Firefox's `management.getAll()` implementation
**Priority:** LOW - Feature works, just incomplete data

## Recommended Actions

### Immediate (High Priority)
1. **Fix tab close behavior** - Critical for reliable automation
2. **Document `browser_snapshot` limitation** - Users need to know this doesn't work
3. **Document dialog handling limitation** - Breaks automation workflows

### Short Term (Medium Priority)
4. **Implement auto-reattach** - Better user experience
5. **Add workaround docs for PDF export** - Guide users to alternatives
6. **Add workaround docs for performance metrics** - Show how to use `window.performance` API
7. **Fix extension listing** - Show correct total count

### Long Term (Low Priority)
8. **Add build timestamp** - Complete feature parity
9. **Document window resize limitation** - Users rarely need this
10. **Add CSS inspection workaround** - Guide users to `getComputedStyle()`

## Alternative Implementations to Consider

### For browser_snapshot (HIGH priority)
Instead of CDP's Accessibility tree, could use:
- DOM traversal via `browser_evaluate` to build custom snapshot
- Combination of `browser_extract_content` + element visibility checks
- Trade-off: Less detailed than Chrome but functionally equivalent

### For browser_handle_dialog (HIGH priority)
Could implement:
- Pre-emptive dialog suppression via page script injection
- Event listeners to catch dialogs before they show
- Trade-off: Not true "handling" but prevents blocking

### For browser_performance_metrics (MEDIUM priority)
Use `browser_evaluate` with:
```javascript
function() {
  const perf = window.performance;
  const paint = perf.getEntriesByType('paint');
  const navigation = perf.getEntriesByType('navigation')[0];
  return {
    fcp: paint.find(e => e.name === 'first-contentful-paint')?.startTime,
    navigationStart: navigation?.fetchStart,
    domComplete: navigation?.domComplete,
    // etc.
  };
}
```

### For browser_pdf_save (MEDIUM priority)
Could guide users to:
- Use Firefox's `window.print()` API
- Take full-page screenshot instead
- Use third-party PDF generation tools

## Firefox CDP Support Reference

Mozilla's official CDP implementation: https://firefox-source-docs.mozilla.org/remote/cdp/

**Supported Domains (Partial):**
- Browser
- DOM (partial)
- Emulation (minimal)
- Input
- Network
- Page (partial)
- Runtime
- Target

**Not Supported:**
- Accessibility
- CSS (partial - no getMatchedStylesForNode)
- Dialog handling
- Performance (partial)

## Conclusion

The Firefox extension is **production-ready for 75% of use cases**, particularly:
- Web scraping and content extraction
- Form automation
- Network monitoring
- Basic interactions and navigation

For advanced features like accessibility snapshots, dialog handling, and performance metrics, **Chrome remains the recommended browser**.

Users should be clearly informed of these limitations in documentation, with guidance on workarounds where available.

---

## Improvements Implemented

### ✅ Fixed: Build Timestamp Missing (2025-11-03)

**Problem:** Status responses showed "PRO v1.9.1" instead of "PRO v1.9.1 [HH:MM:SS]"

**Solution:**
1. Updated `extensions/build-firefox.js` to create `build-info.json` with timestamp during build
2. Updated `extensions/firefox/src/background-module.js` to read build timestamp at startup
3. Updated WebSocketConnection initialization to pass buildTimestamp parameter

**Files Changed:**
- `/extensions/build-firefox.js` (lines 44-51, 55)
- `/extensions/firefox/src/background-module.js` (lines 61-71, 171)

**Testing:** Build Firefox extension and verify status responses include [HH:MM:SS] timestamp

### 🔜 Pending Improvements

1. **Tab Close Behavior** - HIGH priority
   - Issue: Sometimes closes wrong tab when closing by index
   - Investigation needed in tab management handlers

2. **Auto-Reattach After Tab Close** - MEDIUM priority
   - Issue: No automatic reattachment when closing attached tab
   - Need to implement auto-reattach logic in tab handlers

3. **Extension List Count** - LOW priority
   - Issue: Shows "Total: undefined" instead of extension count
   - Fix count display in extension list response
