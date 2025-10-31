# Manual Test: Authentication and Token Refresh

**Test Count:** 1 test
**Tools Covered:** `enable`, `status`, `auth`
**Prerequisites:** PRO mode authentication, long-running session
**Issue:** Extension switches to FREE mode when tokens expire (MCP server refreshes correctly)

---

## MT-74: Token Refresh - Extension Should Stay in PRO Mode

**Description:** Verify extension remains in PRO mode after server refreshes expired tokens

**Prerequisites:**
- PRO mode active (authenticated)
- Server enabled and connected
- Access tokens nearing expiration (or manually set to expire soon)

**Background:**
- MCP server automatically refreshes OAuth tokens before expiration
- Tokens typically expire after 1 hour
- Server refreshes tokens 5 minutes before expiry
- **BUG:** Extension switches to FREE mode when tokens expire, even though server has refreshed tokens

**Steps:**

### Option A: Wait for Natural Token Expiry (Takes ~1 hour)
1. Enable in PRO mode: `enable client_id='token-refresh-test'`
2. Verify PRO mode active: `status` should show `✅ PRO v1.7.2`
3. Note the current time
4. Keep session active for 55+ minutes
5. At ~55 minutes, server should auto-refresh tokens (check logs)
6. After refresh, call `status` again
7. Verify still showing `✅ PRO v1.7.2` (not `✅ FREE v1.7.2`)

### Option B: Manual Token Expiry Test (Faster, requires code modification)
1. Temporarily modify token expiry time in oauth.js to 5 minutes:
   ```javascript
   // In oauth.js, change REFRESH_BEFORE_EXPIRY_MS
   const REFRESH_BEFORE_EXPIRY_MS = 4 * 60 * 1000; // 4 minutes (refresh at 1 min remaining)
   ```
2. Restart server
3. Enable in PRO mode: `enable client_id='token-refresh-test'`
4. Verify PRO mode: `status` should show `✅ PRO v1.7.2`
5. Wait 4-5 minutes for token refresh
6. Check server logs for "Refreshing access token"
7. After refresh, call `status` immediately
8. Verify still showing `✅ PRO v1.7.2` (not FREE)
9. Also check extension console logs for any errors

### Option C: Expired Token Simulation (Manual injection)
1. Enable in PRO mode
2. Use browser DevTools to clear extension's stored tokens
3. Force extension to reconnect
4. Verify server provides fresh tokens
5. Check that extension shows PRO mode (not FREE)

**Expected Results:**
- Server successfully refreshes tokens before expiration (logged in server console)
- Extension continues showing PRO mode after token refresh
- No switch to FREE mode
- All browser_ tools remain available
- Status header shows: `✅ PRO v1.7.2` (not `✅ FREE v1.7.2`)
- Extension console shows no authentication errors

**Pass Criteria:**
- [ ] Server logs show successful token refresh
- [ ] Extension remains in PRO mode after refresh
- [ ] Status command shows PRO (not FREE) after refresh
- [ ] No "Token expired" or "Authentication failed" errors in extension console
- [ ] Browser tools continue working after refresh

**Failure Symptoms (Current Bug):**
- Status shows `✅ FREE v1.7.2` after tokens expire
- Extension loses PRO features
- May show "Authentication failed" in extension console
- Server logs show successful refresh, but extension doesn't update

**Root Cause Investigation:**
If test fails, check:
1. **Extension not receiving token updates:** Does server push new tokens to extension?
2. **Extension not checking server for fresh tokens:** Does extension periodically query server auth status?
3. **Extension caching old auth state:** Is extension using stale authentication information?
4. **Relay connection not propagating auth changes:** Does relay server forward auth updates?

**Expected Code Flow:**
```
Server (oauth.js):
1. Detects token expiring in 5 minutes
2. Calls /oauth/refresh endpoint
3. Gets new access_token and refresh_token
4. Saves to ~/.blueprint-mcp/tokens.json
5. [MISSING?] Notifies connected clients/extensions

Extension:
1. [MISSING?] Receives token refresh notification
2. [MISSING?] Updates internal auth state
3. [MISSING?] Continues showing PRO mode
```

**Debugging Commands:**
```bash
# Check server tokens (should show recent timestamp after refresh)
cat ~/.blueprint-mcp/tokens.json

# Check server logs for token refresh
tail -f logs/mcp-debug.log | grep -i token

# Check extension console in browser
# Look for "Authentication" or "Token" messages
```

---

## Notes

- Token refresh is critical for long-running PRO sessions
- Users may leave automation running for hours
- Silent token refresh should be transparent to users
- Extension should never drop to FREE mode if server has valid tokens
- This is a PRO-only test (FREE mode has no tokens to refresh)
- Test may take up to 1 hour to complete naturally
- Consider adding token_refresh_notification event from server to extension
