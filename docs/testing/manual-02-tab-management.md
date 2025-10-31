# Manual Test: Tab Management

**Test Count:** 8 tests
**Tools Covered:** `browser_tabs`
**Prerequisites:** Server enabled and connected (complete 01-connection-setup.md first)

---

## MT-07: List All Tabs

**Description:** List all open browser tabs

**Prerequisites:**
- Server connected
- At least 2 tabs open in browser

**Steps:**
1. Open 2-3 different websites in separate tabs
2. Issue command: `browser_tabs` with params:
   ```json
   {
     "action": "list"
   }
   ```

**Expected Results:**
- List of all tabs returned
- Each tab shows: index, title, URL, active status
- Tab indices start at 0
- One tab marked as active

**Pass Criteria:**
- [ ] All open tabs listed
- [ ] Indices are sequential starting from 0
- [ ] Titles and URLs are correct
- [ ] One tab marked as active

---

## MT-08: Create New Tab

**Description:** Open a new tab with specific URL

**Prerequisites:**
- Server connected
- Note current number of tabs

**Steps:**
1. Issue command: `browser_tabs` with params:
   ```json
   {
     "action": "new",
     "url": "https://example.com"
   }
   ```
2. Issue command: `browser_tabs` with params `{"action": "list"}`

**Expected Results:**
- New tab created successfully
- Tab count increased by 1
- New tab shows example.com URL
- Response includes new tab index

**Pass Criteria:**
- [ ] New tab appears in browser
- [ ] Tab navigates to example.com
- [ ] List shows increased tab count
- [ ] New tab index returned

---

## MT-09: Create New Tab Without URL

**Description:** Create blank new tab

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_tabs` with params:
   ```json
   {
     "action": "new"
   }
   ```

**Expected Results:**
- New blank tab created
- Tab shows "chrome://newtab/" or blank page

**Pass Criteria:**
- [ ] New tab created
- [ ] Tab is blank or shows new tab page

---

## MT-10: Attach to Tab by Index

**Description:** Switch MCP control to different tab

**Prerequisites:**
- Server connected
- Multiple tabs open
- Note which tab is currently attached

**Steps:**
1. Issue command: `browser_tabs` with params `{"action": "list"}`
2. Choose a tab index different from current
3. Issue command: `browser_tabs` with params:
   ```json
   {
     "action": "attach",
     "index": 1
   }
   ```
4. Issue command: `status` with params `{}`

**Expected Results:**
- Attach completes successfully
- Status shows new tab index
- Status shows URL of newly attached tab
- Tab becomes active in browser (brought to front)

**Pass Criteria:**
- [ ] Attach succeeds
- [ ] Status shows correct new tab index
- [ ] Status shows correct URL
- [ ] Tab activated in browser

---

## MT-11: Attach to Invalid Tab Index

**Description:** Verify error when attaching to non-existent tab

**Prerequisites:**
- Server connected
- Know the maximum tab index (e.g., if 3 tabs, max index is 2)

**Steps:**
1. Issue command: `browser_tabs` with params:
   ```json
   {
     "action": "attach",
     "index": 999
   }
   ```

**Expected Results:**
- Error returned
- Error message indicates invalid tab index
- Previously attached tab remains attached

**Pass Criteria:**
- [ ] Error returned
- [ ] Message mentions invalid index
- [ ] Attachment unchanged

---

## MT-12: Close Tab by Index

**Description:** Close a specific tab

**Prerequisites:**
- Server connected
- At least 3 tabs open (so closing one doesn't close browser)

**Steps:**
1. Issue command: `browser_tabs` with params `{"action": "list"}`
2. Note tab count and choose a tab to close (not currently attached)
3. Issue command: `browser_tabs` with params:
   ```json
   {
     "action": "close",
     "index": 2
   }
   ```
4. Issue command: `browser_tabs` with params `{"action": "list"}`

**Expected Results:**
- Tab closes successfully
- Tab count decreases by 1
- Closed tab removed from list
- Other tabs remain open

**Pass Criteria:**
- [ ] Specified tab closes
- [ ] Tab count decreases
- [ ] Browser remains open
- [ ] Attached tab unchanged (if different tab closed)

---

## MT-13: Close Currently Attached Tab

**Description:** Close the tab MCP is currently attached to

**Prerequisites:**
- Server connected
- At least 2 tabs open
- MCP attached to a specific tab

**Steps:**
1. Issue command: `status` to see current tab
2. Issue command: `browser_tabs` with params:
   ```json
   {
     "action": "close",
     "index": <current_tab_index>
   }
   ```
3. Issue command: `status` with params `{}`

**Expected Results:**
- Tab closes
- MCP automatically attaches to another available tab
- Status shows new attached tab

**Pass Criteria:**
- [ ] Tab closes successfully
- [ ] No error about losing connection
- [ ] Status shows valid tab attachment
- [ ] Can continue issuing commands

---

## MT-14: New Tab with Activate Parameter

**Description:** Create new tab and control whether it becomes active

**Prerequisites:**
- Server connected

**Steps:**
1. Note current active tab
2. Issue command: `browser_tabs` with params:
   ```json
   {
     "action": "new",
     "url": "https://google.com",
     "activate": false
   }
   ```
3. Check which tab is active in browser

**Expected Results:**
- New tab created in background
- Previously active tab remains in foreground
- New tab loads google.com

**Pass Criteria:**
- [ ] New tab created
- [ ] Original tab remains active
- [ ] New tab loads URL in background

---

## Notes

- Tab indices may shift after closing tabs
- Always re-list tabs after close operations
- Cannot close last tab (will close browser)
- Stealth mode indicator may appear in status
