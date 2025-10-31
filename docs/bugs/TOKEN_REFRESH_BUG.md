# Token Refresh Bug - Extension Falls Back to FREE Mode

**Status:** ✅ FIXED
**Severity:** High - Affects all PRO users after ~1 hour
**Discovered:** October 31, 2025 (during Suite 01 manual testing)
**Fixed:** October 31, 2025

---

## Summary

When OAuth access tokens expire (~1 hour), the MCP server correctly refreshes them and saves new tokens to disk. However, the extension continues using old expired tokens from its local storage, causing it to fall back to FREE mode even though the user has valid PRO credentials.

---

## Root Cause

### Token Storage Locations

1. **Server:** `~/.blueprint-mcp/tokens.json`
   - Server reads/writes tokens here
   - Server automatically refreshes tokens 5 minutes before expiry
   - ✅ Server refresh works correctly

2. **Extension:** `chrome.storage.local`
   - Extension stores `accessToken`, `refreshToken`, `isPro`
   - Extension reads tokens to determine PRO vs FREE mode
   - ❌ Extension never receives updated tokens from server

### The Flow (What Happens)

1. **Initial Authentication (Working)**
   - User authenticates via browser OAuth flow
   - Extension receives tokens via message from popup
   - Extension saves to `chrome.storage.local`: `{accessToken, refreshToken, isPro: true}`
   - Extension decodes JWT to get `connection_url` (relay server URL)
   - Extension connects to relay in PRO mode ✅

2. **~55 Minutes Later: Server Refreshes Tokens (Working)**
   - Server detects token expires in 5 minutes
   - Server calls `/api/v1/auth/login` with `grant_type: refresh_token`
   - Server receives new `access_token` and `refresh_token`
   - Server saves new tokens to `~/.blueprint-mcp/tokens.json` ✅
   - Server schedules next refresh ✅
   - **❌ Server does NOT notify extension of new tokens**

3. **Extension Reconnects or Checks Mode (BROKEN)**
   - Extension needs to determine connection URL
   - Calls `getConnectionUrl()` in `websocket.js:63`
   - Calls `getUserInfoFromStorage()` which reads from `chrome.storage.local`
   - Decodes OLD expired JWT token from storage
   - JWT decode either fails or returns expired token with no valid `connection_url`
   - Falls back to FREE mode: `this.isPro = false` ❌
   - Extension connects to `ws://127.0.0.1:5555` instead of relay

---

## Code References

### Extension: `extensions/shared/connection/websocket.js`

**Lines 63-96:** Where extension determines PRO vs FREE mode

```javascript
async getConnectionUrl() {
  // Check if user has PRO account with connection URL from JWT
  const userInfo = await getUserInfoFromStorage(this.browser);

  this.logger.log('[WebSocket] User info from JWT:', userInfo);

  if (userInfo && userInfo.connectionUrl) {
    // PRO user: use connection URL from JWT token
    this.isPro = true;
    this.logger.log(`[WebSocket] PRO mode: Connecting to relay server ${userInfo.connectionUrl}`);

    await this.browser.storage.local.set({ isPro: true });

    return userInfo.connectionUrl;
  } else {
    // Free user: use local port
    const result = await this.browser.storage.local.get(['mcpPort']);
    const port = result.mcpPort || '5555';
    const url = `ws://127.0.0.1:${port}/extension`;

    this.isPro = false;  // ❌ BUG: Sets to false when JWT is expired
    this.logger.log(`[WebSocket] Free mode: Connecting to ${url}`);

    // Clear isPro flag in storage
    await this.browser.storage.local.set({ isPro: false });  // ❌ Overwrites PRO status

    return url;
  }
}
```

### Extension: `extensions/shared/utils/jwt.js`

**Lines 35-53:** Reads expired token from storage

```javascript
export async function getUserInfoFromStorage(browserAPI) {
  const result = await browserAPI.storage.local.get(['accessToken']);

  if (!result.accessToken) {
    return null;
  }

  const payload = decodeJWT(result.accessToken);  // ❌ Decodes EXPIRED token

  if (!payload) {
    return null;
  }

  return {
    email: payload.email || payload.sub || null,
    sub: payload.sub,
    connectionUrl: payload.connection_url || null,  // Returns null for expired token
  };
}
```

### Server: `server/src/oauth.js`

**Lines 243-354:** Server refresh logic (WORKS CORRECTLY)

```javascript
async refreshTokens(retryCount = 0) {
  debugLog('[TokenRefresh] Starting token refresh...');

  // ... acquires lock, calls API, gets new tokens ...

  // Store new tokens
  await this._storeTokens({
    accessToken: newTokens.access_token,
    refreshToken: newTokens.refresh_token
  });

  debugLog('[TokenRefresh] Tokens refreshed and saved successfully');

  // ❌ MISSING: No notification sent to extension with new tokens

  // Schedule next refresh
  await this.scheduleTokenRefresh();
}
```

---

## Solution

The server needs to push updated tokens to the extension when it refreshes them. There are two approaches:

### Option A: Server Push (Recommended)

When server refreshes tokens, send them to the extension:

**In `server/src/oauth.js` after line 351:**
```javascript
// After successful refresh, notify extension
if (this._notifyExtensionOfTokenRefresh) {
  await this._notifyExtensionOfTokenRefresh({
    accessToken: newTokens.access_token,
    refreshToken: newTokens.refresh_token
  });
}
```

**In `server/src/statefulBackend.js`:**
Add method to notify extension via proxy connection or WebSocket:
```javascript
async _notifyExtensionOfTokenRefresh(tokens) {
  if (this._activeBackend && this._proxyConnection) {
    // PRO mode: Send via relay
    await this._proxyConnection.sendNotification('tokens_refreshed', tokens);
  } else if (this._activeBackend && this._extensionServer) {
    // FREE mode: Send via local WebSocket
    await this._extensionServer.broadcastNotification('tokens_refreshed', tokens);
  }
}
```

**In extension: `extensions/shared/connection/websocket.js`:**
```javascript
// Handle tokens_refreshed notification
this.registerNotificationHandler('tokens_refreshed', async (tokens) => {
  this.logger.log('[WebSocket] Received refreshed tokens from server');

  await this.browser.storage.local.set({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    isPro: true
  });

  this.logger.log('[WebSocket] Updated tokens in storage, staying in PRO mode');
});
```

### Option B: Extension Periodic Check (Less Reliable)

Extension could periodically check if its token is expired and request new ones:

```javascript
// In extension, check every 5 minutes
setInterval(async () => {
  const result = await this.browser.storage.local.get(['accessToken']);
  if (result.accessToken && isTokenExpired(result.accessToken)) {
    // Request fresh tokens from server
    const newTokens = await this.sendCommand('get_fresh_tokens', {});
    await this.browser.storage.local.set(newTokens);
  }
}, 5 * 60 * 1000);
```

**Problem with Option B:** Extension might be suspended, timer might not fire reliably.

---

## Testing

After implementing fix, test with:

1. **Manual Test (MT-74):** Follow `docs/testing/manual-10-authentication-tokens.md`

2. **Accelerated Test:**
   - Modify server to refresh tokens every 5 minutes instead of 55
   - Verify extension stays in PRO mode after refresh
   - Check extension console for "Received refreshed tokens" log
   - Check storage shows updated tokens

3. **Verification:**
   - Status header should always show `✅ PRO v1.7.2` (never `FREE`)
   - Extension storage should have fresh non-expired tokens
   - Connection URL should remain relay URL (not localhost:5555)

---

## Impact

**Affected Users:** All PRO users running automation for >1 hour
**Workaround:** Restart automation session every hour
**Frequency:** Happens every hour when tokens expire

**User Experience:**
- Long-running automations silently switch to FREE mode
- May cause connection errors if server port 5555 not available
- Confusing behavior - user paid for PRO but sees FREE
- No error messages explaining the issue

---

## Related Files

- `server/src/oauth.js` - Token refresh logic (lines 243-354)
- `server/src/statefulBackend.js` - State management
- `extensions/shared/connection/websocket.js` - Connection mode detection (lines 63-96)
- `extensions/shared/utils/jwt.js` - JWT decoding (lines 35-53)
- `extensions/chrome/src/background-module.js` - Token storage (line 278-282)

---

## Status

- [x] Bug identified
- [x] Root cause found
- [x] Solution designed
- [x] Fix implemented
- [ ] Tests passing (requires 1 hour wait or accelerated testing)
- [x] Committed

---

## Fix Implemented

**Date:** October 31, 2025

**Solution:** Extension now refreshes tokens independently (correct approach!)

**File Changed:** `extensions/shared/utils/jwt.js`

**What was fixed:**
Modified `getUserInfoFromStorage()` function to:
1. Check if `accessToken` is expired using `isTokenExpired()`
2. If expired, use stored `refreshToken` to call OAuth API directly
3. Get new token pair from `/api/v1/auth/login` endpoint
4. Save new tokens to `chrome.storage.local`
5. Decode and return fresh token with valid `connection_url`
6. Stay in PRO mode! ✅

**Code changes:**
- Added token expiry check before decoding
- Added automatic refresh using existing `refreshAccessToken()` function
- Added storage update with new tokens
- Added error handling to clear invalid tokens

**Why this is correct:**
- Extension has everything it needs (`refreshToken` in storage)
- No server coordination needed - extension handles it independently
- Same OAuth flow as server uses
- Extension stays in PRO mode after token refresh

**Testing:**
- Build completed successfully
- Extension rebuilt with fix
- Ready for MT-74 testing (requires waiting ~1 hour or accelerated test)

---

## Test Case

See: `docs/testing/manual-10-authentication-tokens.md` (MT-74)
