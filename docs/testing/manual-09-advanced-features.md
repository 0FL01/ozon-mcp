# Manual Test: Advanced Features

**Test Count:** 10 tests
**Tools Covered:** `browser_evaluate`, `browser_window`, `browser_pdf_save`, `browser_list_extensions`, `browser_reload_extensions`, `browser_performance_metrics`, `browser_handle_dialog`
**Prerequisites:** Server enabled, connected

---

## MT-64: Evaluate JavaScript

**Description:** Execute custom JavaScript in page context

**Prerequisites:**
- Server connected
- Page loaded

**Steps:**
1. Issue command: `browser_evaluate` with params:
   ```json
   {
     "expression": "document.title"
   }
   ```

**Expected Results:**
- JavaScript executes in page context
- Page title returned
- Result serialized correctly
- No errors

**Pass Criteria:**
- [ ] Expression evaluates
- [ ] Result returned
- [ ] Correct value
- [ ] No console errors

---

## MT-65: Evaluate Complex JavaScript

**Description:** Execute function with return value

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_evaluate` with params:
   ```json
   {
     "function": "function() { return Array.from(document.querySelectorAll('a')).length; }"
   }
   ```

**Expected Results:**
- Function executes
- Returns count of links on page
- Number returned correctly
- Function has page context access

**Pass Criteria:**
- [ ] Function runs
- [ ] Count returned
- [ ] Accurate result
- [ ] Access to DOM

---

## MT-66: Resize Browser Window

**Description:** Change browser window dimensions

**Prerequisites:**
- Server connected
- Note current window size

**Steps:**
1. Issue command: `browser_window` with params:
   ```json
   {
     "action": "resize",
     "width": 1024,
     "height": 768
   }
   ```
2. Observe browser window

**Expected Results:**
- Window resizes to 1024x768
- Resize is immediate
- Content reflows for new size
- No window close

**Pass Criteria:**
- [ ] Window resizes
- [ ] Correct dimensions
- [ ] No errors
- [ ] Content visible

---

## MT-67: Maximize Browser Window

**Description:** Maximize browser window

**Prerequisites:**
- Server connected
- Window not maximized

**Steps:**
1. Issue command: `browser_window` with params:
   ```json
   {
     "action": "maximize"
   }
   ```

**Expected Results:**
- Window maximizes to full screen
- Takes up entire screen space
- Taskbar/dock visible (not fullscreen)
- Window state changes

**Pass Criteria:**
- [ ] Window maximized
- [ ] Full screen coverage
- [ ] Still windowed (not fullscreen)

---

## MT-68: Save Page as PDF

**Description:** Export current page to PDF file

**Prerequisites:**
- Server connected
- Page loaded
- Write permission in temp directory

**Steps:**
1. Issue command: `browser_pdf_save` with params:
   ```json
   {
     "path": "/tmp/test-page.pdf"
   }
   ```
2. Check that file exists

**Expected Results:**
- PDF file created
- File exists at specified path
- PDF contains page content
- File is valid PDF format

**Pass Criteria:**
- [ ] PDF file created
- [ ] File exists
- [ ] Can open PDF
- [ ] Content matches page

---

## MT-69: List Browser Extensions

**Description:** List installed Chrome extensions

**Prerequisites:**
- Server connected
- Browser has extensions installed

**Steps:**
1. Issue command: `browser_list_extensions` with params `{}`

**Expected Results:**
- List of extensions returned
- Shows extension names
- Shows extension IDs
- Blueprint MCP extension visible
- All user extensions listed

**Pass Criteria:**
- [ ] Extensions listed
- [ ] Names and IDs shown
- [ ] Blueprint MCP found
- [ ] Complete list

---

## MT-70: Reload Specific Extension

**Description:** Reload a browser extension

**Prerequisites:**
- Server connected
- Know extension name to reload

**Steps:**
1. Issue command: `browser_reload_extensions` with params:
   ```json
   {
     "extensionName": "Blueprint MCP"
   }
   ```

**Expected Results:**
- Extension reloads
- May cause brief disconnection
- Auto-reconnect happens
- Extension functional after reload

**Pass Criteria:**
- [ ] Extension reloads
- [ ] Reconnection works
- [ ] Can continue testing

---

## MT-71: Reload All Extensions

**Description:** Reload all browser extensions

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_reload_extensions` with params `{}`

**Expected Results:**
- All extensions reload
- Brief disconnection expected
- Auto-reconnect occurs
- All extensions functional

**Pass Criteria:**
- [ ] All extensions reload
- [ ] Reconnection successful
- [ ] No extensions broken

---

## MT-72: Get Performance Metrics

**Description:** Collect page performance data

**Prerequisites:**
- Server connected
- Page fully loaded

**Steps:**
1. Navigate to a page
2. Wait for full load
3. Issue command: `browser_performance_metrics` with params `{}`

**Expected Results:**
- Performance metrics returned
- Includes: FCP, LCP, CLS, TTFB
- Web Vitals data shown
- Timing information present

**Pass Criteria:**
- [ ] Metrics returned
- [ ] Web Vitals included
- [ ] Values reasonable
- [ ] Complete data set

---

## MT-73: Handle Page Dialog

**Description:** Accept/dismiss alert/confirm dialogs

**Prerequisites:**
- Server connected
- Page that shows dialogs

**Steps:**
1. Navigate to test page with alert button
2. Click button to show alert (use browser_interact)
3. Issue command: `browser_handle_dialog` with params:
   ```json
   {
     "accept": true
   }
   ```

**Expected Results:**
- Dialog accepted
- Alert closes
- Page continues execution
- No dialog remains open

**Pass Criteria:**
- [ ] Dialog handled
- [ ] Closes correctly
- [ ] Page functional after

---

## Notes

- browser_evaluate has full page context access
- PDF save quality depends on page rendering
- Extension reload causes brief disconnection
- Performance metrics require full page load
- Dialog handling must happen while dialog is open
- Window resize affects responsive layouts
- Evaluate can modify page state (be careful)
