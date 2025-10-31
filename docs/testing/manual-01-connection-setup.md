# Manual Test: Connection and Setup

**Test Count:** 7 tests
**Tools Covered:** `enable`, `disable`, `status`, `auth`, `browser_reload_extensions`
**Prerequisites:** MCP server installed, Chrome with extension installed

---

## MT-01: Initial Status Check

**Description:** Verify server starts in passive state

**Prerequisites:**
- MCP server started but not enabled
- No browser connected

**Steps:**
1. Issue command: `status` with params `{}`

**Expected Results:**
- Response contains "Disabled" or "Passive"
- No browser name shown
- No tab information shown
- State should be "passive"

**Pass Criteria:**
- [ ] Response indicates passive/disabled state
- [ ] No error returned

---

## MT-02: Enable in Free Mode

**Description:** Enable server and establish local connection

**Prerequisites:**
- Server in passive state
- Chrome browser running
- Extension installed and active

**Steps:**
1. Issue command: `enable` with params:
   ```json
   {
     "client_id": "manual-test",
     "force_free": true
   }
   ```
2. Wait for extension to connect (should be automatic)
3. Issue command: `status` with params `{}`

**Expected Results:**
- Enable response should indicate success
- Should mention "WebSocket server started on port 5555"
- Status should show "Free Mode"
- Browser name should appear (e.g., "Chrome")
- Connection should be established

**Pass Criteria:**
- [ ] Enable completes without error
- [ ] Status shows "Free Mode"
- [ ] Browser name is displayed
- [ ] Port 5555 is mentioned

---

## MT-03: Enable Without Client ID

**Description:** Verify error when client_id is missing

**Prerequisites:**
- Server in passive state

**Steps:**
1. Issue command: `enable` with params `{}`

**Expected Results:**
- Error response returned
- Error message mentions "client_id" is required

**Pass Criteria:**
- [ ] Error returned
- [ ] Message mentions "client_id"

---

## MT-04: Enable When Already Enabled

**Description:** Verify informational message when already enabled

**Prerequisites:**
- Server already enabled (completed MT-02)

**Steps:**
1. Issue command: `enable` with params:
   ```json
   {
     "client_id": "manual-test",
     "force_free": true
   }
   ```

**Expected Results:**
- Response should indicate "Already Enabled"
- Should not be treated as error
- Should remain in active/connected state

**Pass Criteria:**
- [ ] Response mentions "Already Enabled"
- [ ] No error (isError should be false/undefined)
- [ ] State remains active

---

## MT-05: Disable Connection

**Description:** Disable server and disconnect browser

**Prerequisites:**
- Server enabled and connected (completed MT-02)

**Steps:**
1. Issue command: `disable` with params `{}`
2. Issue command: `status` with params `{}`

**Expected Results:**
- Disable should complete successfully
- WebSocket server should stop
- Status should show "Disabled" or "Passive"
- Browser connection should be closed

**Pass Criteria:**
- [ ] Disable completes without error
- [ ] Status returns to passive state
- [ ] No browser connection shown

---

## MT-06: Disable When Already Passive

**Description:** Verify disable works even when already passive

**Prerequisites:**
- Server in passive state (completed MT-05)

**Steps:**
1. Issue command: `disable` with params `{}`

**Expected Results:**
- Should complete silently without error
- Should remain in passive state

**Pass Criteria:**
- [ ] No error returned
- [ ] State remains passive

---

## MT-07: Build Timestamp Display and Auto-Update

**Description:** Verify build timestamp appears in status and updates on extension reload

**Prerequisites:**
- Server enabled in PRO mode (or Free mode)
- Browser connected
- Extension built and loaded

**Steps:**
1. Issue command: `status` with params `{}`
2. Note the build timestamp in format `[HH:MM:SS]` in the status header
3. Rebuild extension:
   ```bash
   cd extensions/chrome && npm run build
   ```
4. Note the new build timestamp from build output
5. Issue command: `browser_reload_extensions` with params `{}`
6. Wait 2-3 seconds for extension to reconnect
7. Issue command: `status` with params `{}`
8. Verify timestamp has updated to match the new build time

**Expected Results:**
- Initial status shows build timestamp in `[HH:MM:SS]` format
- After extension rebuild and reload, timestamp updates automatically
- No need to disable/enable server to see new timestamp
- Timestamp appears in all tool responses in status header

**Pass Criteria:**
- [ ] Build timestamp visible in status header format: `v1.x.x [HH:MM:SS]`
- [ ] Timestamp matches extension build time
- [ ] After reload, timestamp updates to new build time
- [ ] No manual disable/enable required for timestamp update

**Related Issues:**
- Issue 9: Fixed - Build timestamp now shows in PRO mode
- Issue 10: Fixed - Timestamp auto-updates on extension reload

---

## Notes

- All tests should be run in sequence
- Each test builds on previous state
- Browser should remain open throughout testing
- Extension should auto-reconnect if browser restarted
