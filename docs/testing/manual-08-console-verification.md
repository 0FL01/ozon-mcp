# Manual Test: Console and Verification

**Test Count:** 7 tests
**Tools Covered:** `browser_console_messages`, `browser_verify_text_visible`, `browser_verify_element_visible`
**Prerequisites:** Server enabled, connected

---

## MT-57: Get Console Messages

**Description:** View console logs, warnings, and errors

**Prerequisites:**
- Server connected
- Navigate to page with console output

**Steps:**
1. Navigate to page that logs to console (test page recommended)
2. Issue command: `browser_console_messages` with params `{}`

**Expected Results:**
- List of console messages returned
- Shows: type (log/warn/error), message text, timestamp
- Includes logs from page load
- Multiple message types visible

**Pass Criteria:**
- [ ] Messages retrieved
- [ ] Types identified correctly
- [ ] Message text readable
- [ ] Timestamps present

---

## MT-58: Console Errors Detection

**Description:** Find JavaScript errors in console

**Prerequisites:**
- Server connected
- Navigate to page with JS errors (or open console and run `throw new Error("test")`)

**Steps:**
1. Trigger JavaScript error on page
2. Issue command: `browser_console_messages` with params `{}`
3. Look for error type messages

**Expected Results:**
- Error messages visible
- Error type clearly marked
- Stack trace may be included
- Error details readable

**Pass Criteria:**
- [ ] Errors found in list
- [ ] Type shows "error"
- [ ] Error message clear

---

## MT-59: Console Messages Persistence

**Description:** Verify messages persist across commands

**Prerequisites:**
- Server connected
- Page with console logs

**Steps:**
1. Navigate to page (generates console logs)
2. Issue command: `browser_console_messages`
3. Navigate to another page
4. Issue command: `browser_console_messages` again

**Expected Results:**
- First call shows initial page logs
- Second call shows new page logs
- Messages captured continuously
- History may be limited to recent messages

**Pass Criteria:**
- [ ] Messages from both pages visible
- [ ] Continuous monitoring works
- [ ] No messages lost

---

## MT-60: Verify Text Visible - Success

**Description:** Verify expected text appears on page

**Prerequisites:**
- Server connected
- Navigate to page with known content

**Steps:**
1. Navigate to https://example.com
2. Issue command: `browser_verify_text_visible` with params:
   ```json
   {
     "text": "Example Domain"
   }
   ```

**Expected Results:**
- Verification succeeds
- Response indicates text was found
- No error returned
- Success message clear

**Pass Criteria:**
- [ ] Verification passes
- [ ] Success indicated
- [ ] Text confirmed visible

---

## MT-61: Verify Text Visible - Failure

**Description:** Verify error when text not found

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_verify_text_visible` with params:
   ```json
   {
     "text": "zzzzz-nonexistent-text-zzzzz"
   }
   ```

**Expected Results:**
- Verification fails (returns false or error-like response)
- Response indicates text not found
- Clear failure message
- No server crash

**Pass Criteria:**
- [ ] Verification fails appropriately
- [ ] Failure clearly indicated
- [ ] Helpful message returned

---

## MT-62: Verify Element Visible - Success

**Description:** Verify element exists and is visible

**Prerequisites:**
- Server connected
- Page with known elements

**Steps:**
1. Navigate to test page
2. Issue command: `browser_verify_element_visible` with params:
   ```json
   {
     "selector": "#test-button"
   }
   ```

**Expected Results:**
- Verification succeeds
- Element found and visible
- Success clearly indicated
- Selector matched

**Pass Criteria:**
- [ ] Verification passes
- [ ] Element confirmed visible
- [ ] No errors

---

## MT-63: Verify Element Visible - Hidden Element

**Description:** Verify detection of hidden elements

**Prerequisites:**
- Server connected
- Page with hidden element (display:none or visibility:hidden)

**Steps:**
1. Navigate to page with hidden element
2. Issue command: `browser_verify_element_visible` with params:
   ```json
   {
     "selector": "#hidden-element"
   }
   ```

**Expected Results:**
- Verification fails
- Indicates element exists but is hidden
- Helpful message about visibility
- Different from "element not found"

**Pass Criteria:**
- [ ] Verification fails
- [ ] Hidden status detected
- [ ] Clear failure reason

---

## Notes

- Console messages captured continuously
- Verification tools return success/failure (not errors)
- Verify tools useful for test assertions
- Text verification is case-sensitive
- Element verification checks actual visibility (CSS computed)
- Hidden elements (display:none, visibility:hidden, opacity:0) fail verification
