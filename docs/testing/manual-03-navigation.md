# Manual Test: Navigation

**Test Count:** 19 tests (7 navigation + 12 side effects)
**Tools Covered:** `browser_navigate`, `browser_interact` (side effects)
**Prerequisites:** Server enabled, browser connected, tab attached

---

## MT-15: Navigate to URL

**Description:** Navigate current tab to a specific URL

**Prerequisites:**
- Server connected
- Tab attached

**Steps:**
1. Issue command: `browser_navigate` with params:
   ```json
   {
     "action": "url",
     "url": "https://example.com"
   }
   ```
2. Wait for page to load
3. Issue command: `status` with params `{}`

**Expected Results:**
- Page navigates to example.com
- Navigation completes successfully
- Status shows example.com in current tab URL
- Page content loads correctly

**Pass Criteria:**
- [ ] Navigation succeeds
- [ ] Page loads in browser
- [ ] Status reflects new URL
- [ ] No navigation errors

---

## MT-16: Navigate Without URL

**Description:** Verify error when URL is missing

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_navigate` with params:
   ```json
   {
     "action": "url"
   }
   ```

**Expected Results:**
- Error returned
- Error message mentions URL is required
- Page remains on current URL

**Pass Criteria:**
- [ ] Error returned
- [ ] Message mentions "url"
- [ ] Current page unchanged

---

## MT-17: Navigate Back

**Description:** Navigate back in browser history

**Prerequisites:**
- Server connected
- Tab has navigation history (visited at least 2 pages)

**Steps:**
1. Navigate to https://example.com (MT-15)
2. Navigate to https://example.org
3. Issue command: `browser_navigate` with params:
   ```json
   {
     "action": "back"
   }
   ```
4. Check current URL

**Expected Results:**
- Browser goes back to example.com
- Navigation completes successfully
- URL changes to previous page

**Pass Criteria:**
- [ ] Back navigation works
- [ ] URL changes to previous
- [ ] Page content loads

---

## MT-18: Navigate Forward

**Description:** Navigate forward in browser history

**Prerequisites:**
- Server connected
- Tab has forward history (completed MT-17 back navigation)

**Steps:**
1. Issue command: `browser_navigate` with params:
   ```json
   {
     "action": "forward"
   }
   ```
2. Check current URL

**Expected Results:**
- Browser goes forward to example.org
- Navigation completes successfully
- URL changes to next page in history

**Pass Criteria:**
- [ ] Forward navigation works
- [ ] URL advances in history
- [ ] Page content loads

---

## MT-19: Reload Page

**Description:** Reload current page

**Prerequisites:**
- Server connected
- Tab showing a page

**Steps:**
1. Navigate to a page with dynamic content (e.g., current time)
2. Note a detail on the page
3. Issue command: `browser_navigate` with params:
   ```json
   {
     "action": "reload"
   }
   ```
4. Wait for page to reload

**Expected Results:**
- Page reloads successfully
- Fresh content fetched from server
- URL remains the same
- Dynamic content may change (timestamps, etc.)

**Pass Criteria:**
- [ ] Page reloads
- [ ] No navigation errors
- [ ] URL unchanged
- [ ] Network request made

---

## MT-20: Open Test Page

**Description:** Navigate to built-in test page

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_navigate` with params:
   ```json
   {
     "action": "test_page"
   }
   ```
2. Wait for page to load
3. Observe page content

**Expected Results:**
- Navigates to hosted test page
- URL should be a railsblueprint.com test page
- Page contains test elements (buttons, forms, etc.)
- Test page designed for Blueprint MCP testing

**Pass Criteria:**
- [ ] Test page loads
- [ ] URL is railsblueprint test page
- [ ] Page shows test elements
- [ ] Page is interactive

---

## MT-21: Navigate to Invalid URL

**Description:** Verify error handling for invalid URLs

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_navigate` with params:
   ```json
   {
     "action": "url",
     "url": "not-a-valid-url"
   }
   ```

**Expected Results:**
- Navigation should handle gracefully
- May show browser error page or return error
- No crash or hang

**Pass Criteria:**
- [ ] Command completes (error or browser error page)
- [ ] No server crash
- [ ] Can continue issuing commands

---

---

## MT-74: Click-Triggered Navigation (Link)

**Description:** Verify navigation detection when triggered by clicking a link (Issue #12 fix)

**Prerequisites:**
- Server connected
- Tab attached

**Steps:**
1. Navigate to side effects test page:
   ```json
   {
     "action": "url",
     "url": "chrome-extension://[your-extension-id]/test-side-effects.html"
   }
   ```
2. Click navigation link:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#nav-link"
         }
       ]
     }
   }
   ```
3. Check `status` tool output

**Expected Results:**
- Click executes successfully
- Response includes section: `**Navigation triggered:**`
- Shows `From:` and `To:` URLs
- Status line shows new URL (form-result.html)
- Tech stack shown if detected

**Pass Criteria:**
- [ ] Navigation side effect detected
- [ ] Status line updated with new URL
- [ ] Response shows from/to URLs
- [ ] Page loads correctly

---

## MT-75: Click-Triggered Navigation (Button)

**Description:** Verify navigation detection for JavaScript-triggered navigation

**Prerequisites:**
- Server connected
- Side effects test page loaded

**Steps:**
1. Click button that triggers navigation:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#nav-button"
         }
       ]
     }
   }
   ```
2. Wait for navigation to complete
3. Check status

**Expected Results:**
- Navigation detected even though triggered by JavaScript
- Side effect section in response
- Status line reflects new URL
- Navigation waits up to 5 seconds to complete

**Pass Criteria:**
- [ ] JavaScript navigation detected
- [ ] Status line updated
- [ ] No timeout errors
- [ ] Page loads successfully

---

## MT-76: External Navigation Detection

**Description:** Verify detection of navigation to external domain

**Prerequisites:**
- Server connected
- Side effects test page loaded

**Steps:**
1. Click external link:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#external-link"
         }
       ]
     }
   }
   ```
2. Wait for navigation
3. Verify status

**Expected Results:**
- Navigation to example.org detected
- Shows domain change in from/to URLs
- Status line shows example.org
- Waits for navigation completion

**Pass Criteria:**
- [ ] External navigation detected
- [ ] Domain change shown
- [ ] Status line correct
- [ ] Tech stack detection attempted

---

## MT-77: Alert Dialog Detection

**Description:** Verify alert dialog is detected and auto-handled

**Prerequisites:**
- Server connected
- Side effects test page loaded

**Steps:**
1. Click alert button:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#alert-button"
         }
       ]
     }
   }
   ```
2. Observe response

**Expected Results:**
- Alert automatically handled (no user action needed)
- Response includes: `**Dialogs shown:**`
- Shows: `1. alert("This is a test alert!")`
- No alert visible to user

**Pass Criteria:**
- [ ] Alert detected in side effects
- [ ] Alert message shown in response
- [ ] No alert dialog visible
- [ ] Click completes successfully

---

## MT-78: Confirm Dialog Detection

**Description:** Verify confirm dialog detection with response value

**Prerequisites:**
- Server connected
- Side effects test page loaded

**Steps:**
1. Click confirm button:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#confirm-button"
         }
       ]
     }
   }
   ```

**Expected Results:**
- Confirm automatically accepted
- Response shows: `confirm("Do you want to continue?") → true`
- Response value (true) included
- No dialog visible

**Pass Criteria:**
- [ ] Confirm detected
- [ ] Response value shown (true)
- [ ] Formatted correctly
- [ ] Auto-accepted

---

## MT-79: Prompt Dialog Detection

**Description:** Verify prompt dialog with filled value

**Prerequisites:**
- Server connected
- Side effects test page loaded

**Steps:**
1. Click prompt button:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#prompt-button"
         }
       ]
     }
   }
   ```

**Expected Results:**
- Prompt automatically filled
- Shows: `prompt("Enter your name:") → Claude`
- Filled value displayed
- No dialog visible

**Pass Criteria:**
- [ ] Prompt detected
- [ ] Fill value shown
- [ ] Message and response in output
- [ ] Auto-filled

---

## MT-80: Multiple Dialogs Detection

**Description:** Verify multiple dialogs all detected in sequence

**Prerequisites:**
- Server connected
- Side effects test page loaded

**Steps:**
1. Click multiple dialogs button:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#multi-dialog-button"
         }
       ]
     }
   }
   ```

**Expected Results:**
- All three dialogs detected:
  ```
  **Dialogs shown:**
  1. alert("First alert")
  2. confirm("Then a confirm") → true
  3. prompt("Finally a prompt") → test
  ```
- All handled automatically
- Shown in order

**Pass Criteria:**
- [ ] All 3 dialogs detected
- [ ] Shown in correct order
- [ ] Response values for confirm/prompt
- [ ] No dialogs visible

---

## MT-81: Blocked Popup Detection

**Description:** Verify popup blocked by browser is detected

**Prerequisites:**
- Server connected
- Side effects test page loaded
- Browser popup blocker enabled (default)

**Steps:**
1. Click popup button:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#popup-button"
         }
       ]
     }
   }
   ```

**Expected Results:**
- Popup attempt detected
- Shows: `**New tabs/windows:**`
- Status: `🚫 Blocked: https://example.com`
- No popup window opens

**Pass Criteria:**
- [ ] Blocked popup detected
- [ ] Status shows blocked (🚫)
- [ ] URL shown
- [ ] No window opened

---

## MT-82: New Tab Detection (target=_blank)

**Description:** Verify new tab opening is detected

**Prerequisites:**
- Server connected
- Side effects test page loaded

**Steps:**
1. Click new tab link:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#new-tab-link"
         }
       ]
     }
   }
   ```
2. Observe new tab opens

**Expected Results:**
- New tab detected
- Shows: `✅ Opened: https://example.com`
- Tab ID and URL displayed
- Tab actually opens

**Pass Criteria:**
- [ ] New tab detected
- [ ] Status shows opened (✅)
- [ ] URL shown
- [ ] Tab visible in browser

---

## MT-83: Multiple Popups Detection

**Description:** Verify multiple popup attempts all detected

**Prerequisites:**
- Server connected
- Side effects test page loaded

**Steps:**
1. Click multiple popups button:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#multi-popup-button"
         }
       ]
     }
   }
   ```

**Expected Results:**
- All popup attempts listed
- Each shows status (opened/blocked)
- Multiple entries in newTabs section
- Format:
  ```
  **New tabs/windows:**
  1. ✅ Opened: https://example.com
  2. 🚫 Blocked: https://example.org
  3. 🚫 Blocked: about:blank
  ```

**Pass Criteria:**
- [ ] All attempts detected
- [ ] Status shown for each
- [ ] URLs listed
- [ ] Correct count

---

## MT-84: Combined Side Effects (Navigation + Dialog)

**Description:** Verify multiple side effect types detected in one click

**Prerequisites:**
- Server connected
- Side effects test page loaded

**Steps:**
1. Click combo button:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#dialog-nav-button"
         }
       ]
     }
   }
   ```

**Expected Results:**
- Both side effects detected:
  ```
  **Navigation triggered:**
  - From: test-side-effects.html
  - To: form-result.html

  **Dialogs shown:**
  1. confirm("Navigate to form result page?") → true
  ```
- Status line updated
- Page navigates

**Pass Criteria:**
- [ ] Both side effects detected
- [ ] Navigation section present
- [ ] Dialog section present
- [ ] Status line correct

---

## MT-85: No Side Effects (Control Test)

**Description:** Verify no false positives for clicks without side effects

**Prerequisites:**
- Server connected
- Side effects test page loaded

**Steps:**
1. Click no-op button:
   ```json
   {
     "tool": "browser_interact",
     "arguments": {
       "actions": [
         {
           "type": "click",
           "selector": "#no-op-button"
         }
       ]
     }
   }
   ```

**Expected Results:**
- Click succeeds
- NO side effect sections in response
- Simple click confirmation only
- Status line unchanged
- URL same as before

**Pass Criteria:**
- [ ] Click succeeds
- [ ] No "Navigation triggered" section
- [ ] No "Dialogs shown" section
- [ ] No "New tabs/windows" section
- [ ] Status line unchanged

---

## Notes

- Navigation actions may take time depending on network
- Back/forward only work if history exists
- Test page is useful for testing interaction commands
- Some navigation may trigger popups or redirects

**Side Effects Testing (MT-74 to MT-85):**
- Tests Issue #12 fix (status line updates on click navigation)
- Side effects detected: navigation, dialogs, popups
- 200ms detection delay is normal
- Navigation waits up to 5 seconds to complete
- All dialogs auto-handled (no user interaction)
- Popup blocker settings affect MT-81/MT-82
- Control test (MT-85) verifies no false positives
