// Browser API adapter - works with both Chrome and Firefox
const browserAPI = typeof chrome !== 'undefined' ? chrome : browser;

// Get browser name from manifest - same logic as background script
function detectBrowserName() {
  const manifest = browserAPI.runtime.getManifest();
  const manifestName = manifest.name || '';

  // Extract browser name from "Blueprint MCP for X" pattern
  const match = manifestName.match(/Blueprint MCP for (\w+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Fallback to simple detection
  return typeof chrome !== 'undefined' && chrome.runtime ? 'Chrome' : 'Firefox';
}

const browserName = detectBrowserName();

// Logging utility - only logs if debug mode is enabled
function log(...args) {
  // Check if debug mode is enabled (async check, but log synchronously if already loaded)
  if (state && state.debugMode) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    console.log(`[Blueprint MCP for ${browserName}] ${time}`, ...args);
  }
}

// Always log (ignore debug setting) - for errors and critical info
function logAlways(...args) {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  console.log(`[Blueprint MCP for ${browserName}] ${time}`, ...args);
}

// Constants (matching Chrome's config.ts)
const API_HOST = 'https://mcp-for-chrome.railsblueprint.com';
const config = {
  loginUrl: (extensionId) => `${API_HOST}/extension/login?extension_id=${extensionId}`,
  upgradeUrl: (extensionId) => `${API_HOST}/pro?extension_id=${extensionId}`,
  docsUrl: `${API_HOST}/docs`,
  buyMeACoffeeUrl: 'https://www.buymeacoffee.com/mcp.for.chrome',
  defaultMcpPort: '5555',
};

// State
let state = {
  enabled: true,
  currentTabConnected: false,
  stealthMode: null,
  anyConnected: false,
  connecting: false,
  isPro: false,
  userEmail: null,
  browserName: 'Firefox',
  showSettings: false,
  port: '5555',
  connectionStatus: null,
  projectName: null,
  debugMode: false,
  version: '1.0.0',
  tokenInfo: null, // Token expiration info for debug display
  tokenRefreshInterval: null, // Interval for live token checking
};

// Utility: Decode JWT (without validation - only for display)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    return null;
  }
}

// Get user info from stored JWT
async function getUserInfoFromStorage() {
  const result = await browserAPI.storage.local.get(['accessToken']);
  if (!result.accessToken) return null;

  const payload = decodeJWT(result.accessToken);
  if (!payload) return null;

  return {
    email: payload.email || payload.sub || null,
    sub: payload.sub,
  };
}

// Get token expiration info for display
async function getTokenExpirationInfo() {
  const result = await browserAPI.storage.local.get(['accessToken', 'refreshToken']);

  if (!result.accessToken) {
    return null;
  }

  // Decode access token
  const accessPayload = decodeJWT(result.accessToken);
  if (!accessPayload || !accessPayload.exp) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const accessExpiresAt = accessPayload.exp;
  const accessTimeLeft = accessExpiresAt - now;
  const accessMinutesLeft = Math.floor(accessTimeLeft / 60);
  const accessSecondsLeft = accessTimeLeft % 60;

  // Try to decode refresh token (might be JWT or opaque)
  let refreshTokenInfo = null;
  if (result.refreshToken) {
    const refreshPayload = decodeJWT(result.refreshToken);
    if (refreshPayload && refreshPayload.exp) {
      const refreshExpiresAt = refreshPayload.exp;
      const refreshTimeLeft = refreshExpiresAt - now;
      const refreshMinutesLeft = Math.floor(refreshTimeLeft / 60);
      const refreshSecondsLeft = refreshTimeLeft % 60;

      refreshTokenInfo = {
        expiresAt: new Date(refreshExpiresAt * 1000),
        timeLeft: refreshTimeLeft,
        minutesLeft: refreshMinutesLeft,
        secondsLeft: refreshSecondsLeft,
        isExpired: refreshTimeLeft < 0
      };
    }
  }

  return {
    access: {
      expiresAt: new Date(accessExpiresAt * 1000),
      timeLeft: accessTimeLeft,
      minutesLeft: accessMinutesLeft,
      secondsLeft: accessSecondsLeft,
      isExpired: accessTimeLeft < 0
    },
    refresh: refreshTokenInfo,
    hasRefreshToken: !!result.refreshToken
  };
}

// Start live token expiration checker
// Re-reads token from storage and recalculates expiration every second
function startTokenExpirationChecker() {
  if (state.tokenRefreshInterval) {
    clearInterval(state.tokenRefreshInterval);
  }

  // Fetch fresh token from storage and recalculate expiration every second
  state.tokenRefreshInterval = setInterval(async () => {
    if (state.showSettings && state.debugMode && state.isPro) {
      // This reads from chrome.storage.local every second
      state.tokenInfo = await getTokenExpirationInfo();

      // Update just the token display without re-rendering entire page
      const tokenDisplay = document.getElementById('tokenInfoDisplay');
      if (tokenDisplay && state.tokenInfo) {
        // Update access token time left
        const accessTimeSpan = tokenDisplay.querySelector('[data-token="access-time"]');
        if (accessTimeSpan && state.tokenInfo.access) {
          const isExpired = state.tokenInfo.access.isExpired;
          const timeLeft = state.tokenInfo.access.timeLeft;
          const color = isExpired ? '#d32f2f' : (timeLeft < 120 ? '#f57c00' : '#388e3c');
          accessTimeSpan.style.color = color;
          accessTimeSpan.textContent = isExpired
            ? '❌ EXPIRED'
            : `${state.tokenInfo.access.minutesLeft}m ${state.tokenInfo.access.secondsLeft}s`;
        }

        // Update refresh token time left
        const refreshTimeSpan = tokenDisplay.querySelector('[data-token="refresh-time"]');
        if (refreshTimeSpan && state.tokenInfo.refresh) {
          const isExpired = state.tokenInfo.refresh.isExpired;
          const timeLeft = state.tokenInfo.refresh.timeLeft;
          const color = isExpired ? '#d32f2f' : (timeLeft < 300 ? '#f57c00' : '#388e3c');
          refreshTimeSpan.style.color = color;
          refreshTimeSpan.textContent = isExpired
            ? '❌ EXPIRED'
            : `${state.tokenInfo.refresh.minutesLeft}m ${state.tokenInfo.refresh.secondsLeft}s`;
        }
      }
    }
  }, 1000); // Every second
}

// Stop live token expiration checker
function stopTokenExpirationChecker() {
  if (state.tokenRefreshInterval) {
    clearInterval(state.tokenRefreshInterval);
    state.tokenRefreshInterval = null;
  }
}

// Get default browser name
function getDefaultBrowserName() {
  return browserName; // Uses the detected browser name from line 3
}

// Update status
async function updateStatus() {
  // Get current tab
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  // Get connection status from background
  const response = await browserAPI.runtime.sendMessage({ type: 'getConnectionStatus' });

  const connectedTabId = response?.connectedTabId;
  const isCurrentTabConnected = currentTab?.id === connectedTabId;

  state.anyConnected = response?.connected === true;
  state.currentTabConnected = isCurrentTabConnected;
  state.stealthMode = isCurrentTabConnected ? (response?.stealthMode ?? null) : null;
  state.projectName = response?.projectName || null;

  // Set connecting state: enabled but not connected
  const storage = await browserAPI.storage.local.get(['extensionEnabled']);
  const isEnabled = storage.extensionEnabled !== false;
  state.connecting = isEnabled && response?.connected !== true;

  render();
}

// Load state
async function loadState() {
  const storage = await browserAPI.storage.local.get([
    'extensionEnabled',
    'isPro',
    'browserName',
    'mcpPort',
    'connectionStatus',
    'debugMode'
  ]);

  state.enabled = storage.extensionEnabled !== false;
  state.isPro = storage.isPro === true;
  state.browserName = storage.browserName || getDefaultBrowserName();
  state.port = storage.mcpPort || '5555';
  state.connectionStatus = storage.connectionStatus || null;
  state.debugMode = storage.debugMode || false;

  // Load email from JWT token
  const userInfo = await getUserInfoFromStorage();
  if (userInfo) {
    state.userEmail = userInfo.email;
  }

  // Get version from manifest
  const manifest = browserAPI.runtime.getManifest();
  state.version = manifest.version;

  render();
}

// Toggle enabled
async function toggleEnabled() {
  state.enabled = !state.enabled;
  await browserAPI.storage.local.set({ extensionEnabled: state.enabled });
  render();
}

// Save settings
async function saveSettings() {
  // Stop token checker when leaving settings
  stopTokenExpirationChecker();

  // Always save debug mode
  await browserAPI.storage.local.set({ debugMode: state.debugMode });

  if (state.isPro) {
    // Save browser name for PRO users
    await browserAPI.storage.local.set({ browserName: state.browserName });
  } else {
    // Save port for free users
    await browserAPI.storage.local.set({ mcpPort: state.port });
    // Reload extension to apply new port
    browserAPI.runtime.reload();
  }
  state.showSettings = false;
  render();
}

// Cancel settings
async function cancelSettings() {
  // Stop token checker when leaving settings
  stopTokenExpirationChecker();

  // Reload original values
  const storage = await browserAPI.storage.local.get(['browserName', 'mcpPort', 'debugMode']);
  state.browserName = storage.browserName || getDefaultBrowserName();
  state.port = storage.mcpPort || '5555';
  state.debugMode = storage.debugMode || false;
  state.showSettings = false;
  render();
}

// Handle sign in
function handleSignIn() {
  const extensionId = browserAPI.runtime.id;
  browserAPI.tabs.create({ url: config.loginUrl(extensionId), active: false });
}

// Handle logout
async function handleLogout() {
  await browserAPI.storage.local.remove(['accessToken', 'refreshToken', 'isPro']);
  state.isPro = false;
  state.userEmail = null;
  render();
}

// Render function
function render() {
  try {
    const root = document.getElementById('root');

    if (!root) {
      log('[Popup] Root element not found!');
      return;
    }

    const html = state.showSettings ? renderSettings() : renderMain();
    log('[Popup] Rendering, HTML length:', html.length);
    root.innerHTML = html;
    log('[Popup] Root innerHTML set, checking content...');
    log('[Popup] Root children count:', root.children.length);
    log('[Popup] Root first child:', root.firstElementChild?.tagName);

    attachEventListeners();
    log('[Popup] Event listeners attached');
  } catch (error) {
    logAlways('[Popup] Render error:', error);
    throw error;
  }
}

// Render settings view
function renderSettings() {
  return `
    <div class="popup-container">
      <div class="popup-header">
        <img src="/icons/icon-32.png" alt="Blueprint MCP" class="header-icon" />
        <h1>Blueprint MCP<span class="version-label">v${state.version}</span></h1>
      </div>

      <div class="popup-content">
        <div class="settings-form">
          ${state.isPro ? `
            <label class="settings-label">
              Browser Name:
              <input
                type="text"
                class="settings-input"
                id="browserNameInput"
                value="${state.browserName}"
                placeholder="${browserName}"
              />
            </label>
          ` : `
            <label class="settings-label">
              MCP Server Port:
              <input
                type="number"
                class="settings-input"
                id="portInput"
                value="${state.port}"
                min="1"
                max="65535"
                placeholder="5555"
              />
            </label>
            <p class="settings-help">
              Default: 5555. Change this if your MCP server runs on a different port.
            </p>
          `}

          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e0e0e0">
            <label class="settings-label" style="display: flex; align-items: center; cursor: pointer; user-select: none">
              <input
                type="checkbox"
                id="debugModeCheckbox"
                ${state.debugMode ? 'checked' : ''}
                style="width: 18px; height: 18px; margin-right: 10px; cursor: pointer"
              />
              <span>Debug Mode</span>
            </label>
            <p class="settings-help" style="margin-top: 8px; margin-left: 28px">
              Enable detailed logging for troubleshooting
            </p>
          </div>

          ${state.debugMode && state.isPro && state.tokenInfo ? `
            <div id="tokenInfoDisplay" style="margin-top: 20px; padding: 12px; background: #f5f5f5; border-radius: 6px; font-size: 0.9em">
              <div style="font-weight: 600; margin-bottom: 8px; color: #333">🔑 Token Status</div>

              <!-- Access Token -->
              <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e0e0e0">
                <div style="font-weight: 600; color: #555; margin-bottom: 4px">Access Token:</div>
                <div><strong>Expires:</strong> ${state.tokenInfo.access.expiresAt.toLocaleString()}</div>
                <div style="margin-top: 4px">
                  <strong>Time left:</strong>
                  <span data-token="access-time" style="color: ${state.tokenInfo.access.isExpired ? '#d32f2f' : (state.tokenInfo.access.timeLeft < 120 ? '#f57c00' : '#388e3c')}">
                    ${state.tokenInfo.access.isExpired ? '❌ EXPIRED' : `${state.tokenInfo.access.minutesLeft}m ${state.tokenInfo.access.secondsLeft}s`}
                  </span>
                </div>
              </div>

              <!-- Refresh Token -->
              ${state.tokenInfo.refresh ? `
                <div>
                  <div style="font-weight: 600; color: #555; margin-bottom: 4px">Refresh Token:</div>
                  <div><strong>Expires:</strong> ${state.tokenInfo.refresh.expiresAt.toLocaleString()}</div>
                  <div style="margin-top: 4px">
                    <strong>Time left:</strong>
                    <span data-token="refresh-time" style="color: ${state.tokenInfo.refresh.isExpired ? '#d32f2f' : (state.tokenInfo.refresh.timeLeft < 300 ? '#f57c00' : '#388e3c')}">
                      ${state.tokenInfo.refresh.isExpired ? '❌ EXPIRED' : `${state.tokenInfo.refresh.minutesLeft}m ${state.tokenInfo.refresh.secondsLeft}s`}
                    </span>
                  </div>
                </div>
              ` : `
                <div style="color: #666">Refresh token not available or cannot be decoded</div>
              `}
            </div>
          ` : ''}
        </div>

        <div class="settings-actions">
          <button class="settings-button save" id="saveButton">
            Save
          </button>
          <button class="settings-button cancel" id="cancelButton">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;
}

// Render main view
function renderMain() {
  const statusClass = state.connecting ? 'connecting' : state.anyConnected ? 'connected' : 'disconnected';
  const statusText = state.connecting ? 'Connecting' : state.anyConnected ? 'Connected' : 'Disconnected';

  return `
    <div class="popup-container">
      <div class="popup-header">
        <img src="/icons/icon-32.png" alt="Blueprint MCP" class="header-icon" />
        <h1>Blueprint MCP<span class="version-label">v${state.version}</span></h1>
      </div>

      <div class="popup-content">
        <div class="status-row">
          <span class="status-label">Status:</span>
          <div class="status-indicator">
            <span class="status-dot ${statusClass}"></span>
            <span class="status-text">${statusText}</span>
          </div>
        </div>

        <div class="status-row">
          <span class="status-label">This tab:</span>
          <span class="status-text">${state.currentTabConnected ? '✓ Automated' : 'Not automated'}</span>
        </div>

        ${state.currentTabConnected && state.projectName ? `
          <div class="status-row">
            <span class="status-label"></span>
            <span class="status-text" style="font-size: 0.9em; color: #666">
              ${state.projectName}
            </span>
          </div>
        ` : ''}

        ${state.currentTabConnected ? `
          <div class="status-row">
            <span class="status-label">Stealth mode:</span>
            <span class="status-text">
              ${state.stealthMode === null ? 'N/A' : state.stealthMode ? '🕵️ On' : '👁️ Off'}
            </span>
          </div>
        ` : ''}

        <div class="toggle-row">
          <button
            class="toggle-button ${state.enabled ? 'enabled' : 'disabled'}"
            id="toggleButton"
          >
            ${state.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        ${!state.isPro ? `
          <div class="pro-section">
            <p class="pro-text">Unlock advanced features with PRO</p>
            <button class="pro-button" id="upgradeButton">
              Upgrade to PRO
            </button>
            <div class="signin-text">
              Already have PRO? <button class="signin-link" id="signInButton">Sign in</button>
            </div>
          </div>
        ` : `
          <div class="pro-section pro-active">
            <div>
              <p class="pro-text">✓ PRO Account Active</p>
              ${state.userEmail ? `<p class="pro-email">${state.userEmail}</p>` : ''}
              ${state.enabled && !state.connecting && state.connectionStatus ? `
                <div class="connection-status" style="display: flex; flex-direction: column; gap: 4px;">
                  <p class="connection-limit" style="font-weight: bold; margin-bottom: 4px; display: flex; justify-content: space-between;">
                    <span>Active Links:</span>
                    <span>${state.connectionStatus.connections_used}/${state.connectionStatus.max_connections}</span>
                  </p>
                  <p class="connection-detail" style="font-size: 0.85em; color: #666; margin: 0; display: flex; justify-content: space-between;">
                    <span>Links to this browser:</span>
                    <span>${state.connectionStatus.connections_to_this_browser}</span>
                  </p>
                  ${state.connectionStatus.total_browsers !== undefined ? `
                    <p class="connection-detail" style="font-size: 0.85em; color: #666; margin: 0; display: flex; justify-content: space-between;">
                      <span>Total browsers:</span>
                      <span>${state.connectionStatus.total_browsers}</span>
                    </p>
                  ` : ''}
                  ${state.connectionStatus.total_mcp_clients !== undefined ? `
                    <p class="connection-detail" style="font-size: 0.85em; color: #666; margin: 0; display: flex; justify-content: space-between;">
                      <span>Total MCP clients:</span>
                      <span>${state.connectionStatus.total_mcp_clients}</span>
                    </p>
                  ` : ''}
                </div>
              ` : ''}
            </div>
            <button class="logout-link" id="logoutButton">
              Logout
            </button>
          </div>
        `}

        <div class="links-section">
          <button class="settings-link" id="settingsButton">
            ⚙️ Settings
          </button>
          <a
            href="${config.docsUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="doc-link"
          >
            📖 Documentation
          </a>
          <button class="test-page-link" id="testPageButton">
            🧪 Test Page
          </button>
          ${!state.isPro ? `
            <a
              href="${config.buyMeACoffeeUrl}"
              target="_blank"
              rel="noopener noreferrer"
              class="beer-link"
            >
              🍺 Buy me a beer
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// Attach event listeners
function attachEventListeners() {
  if (state.showSettings) {
    // Settings view listeners
    const saveButton = document.getElementById('saveButton');
    const cancelButton = document.getElementById('cancelButton');
    const debugModeCheckbox = document.getElementById('debugModeCheckbox');

    if (saveButton) saveButton.addEventListener('click', saveSettings);
    if (cancelButton) cancelButton.addEventListener('click', cancelSettings);

    // Restart token checker if already showing token info (e.g., after storage change or render)
    if (state.debugMode && state.isPro && state.tokenInfo) {
      startTokenExpirationChecker();
    }

    if (state.isPro) {
      const browserNameInput = document.getElementById('browserNameInput');
      if (browserNameInput) {
        browserNameInput.addEventListener('input', (e) => {
          state.browserName = e.target.value;
        });
      }
    } else {
      const portInput = document.getElementById('portInput');
      if (portInput) {
        portInput.addEventListener('input', (e) => {
          state.port = e.target.value;
        });
      }
    }

    if (debugModeCheckbox) {
      debugModeCheckbox.addEventListener('change', async (e) => {
        state.debugMode = e.target.checked;

        // Load token info if enabling debug mode in PRO
        if (state.debugMode && state.isPro) {
          state.tokenInfo = await getTokenExpirationInfo();
        }

        // Re-render to show/hide token info
        render();

        // Start checker if debug mode is enabled and token info is available
        if (state.debugMode && state.isPro && state.tokenInfo) {
          startTokenExpirationChecker();
        } else {
          stopTokenExpirationChecker();
        }
      });
    }
  } else {
    // Main view listeners
    const toggleButton = document.getElementById('toggleButton');
    const settingsButton = document.getElementById('settingsButton');
    const testPageButton = document.getElementById('testPageButton');
    const upgradeButton = document.getElementById('upgradeButton');
    const signInButton = document.getElementById('signInButton');
    const logoutButton = document.getElementById('logoutButton');

    if (toggleButton) toggleButton.addEventListener('click', toggleEnabled);
    if (settingsButton) {
      settingsButton.addEventListener('click', async () => {
        // Load token info before showing settings
        if (state.isPro) {
          state.tokenInfo = await getTokenExpirationInfo();
        }
        state.showSettings = true;
        render();

        // Start token checker if debug mode is enabled and token info is available
        if (state.debugMode && state.isPro && state.tokenInfo) {
          startTokenExpirationChecker();
        }
      });
    }
    if (testPageButton) {
      testPageButton.addEventListener('click', () => {
        const testPageUrl = 'https://blueprint-mcp.railsblueprint.com/test-page';
        browserAPI.tabs.create({ url: testPageUrl, active: true });
      });
    }
    if (upgradeButton) {
      upgradeButton.addEventListener('click', () => {
        const extensionId = browserAPI.runtime.id;
        browserAPI.tabs.create({ url: config.upgradeUrl(extensionId), active: false });
      });
    }
    if (signInButton) signInButton.addEventListener('click', handleSignIn);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  try {
    log('[Popup] Initializing...');
    await loadState();
    log('[Popup] State loaded:', state);
    await updateStatus();
    log('[Popup] Status updated');

    // Listen for status change broadcasts from background script
    browserAPI.runtime.onMessage.addListener((message) => {
      if (message.type === 'statusChanged') {
        updateStatus();
      }
    });

    // Listen for tab changes
    browserAPI.tabs.onActivated.addListener(updateStatus);

    // Listen for storage changes
    browserAPI.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName === 'local') {
        // Update enabled state when it changes
        if (changes.extensionEnabled) {
          state.enabled = changes.extensionEnabled.newValue !== false;
          // Refresh connection status when enabled state changes
          await updateStatus();
        }
        if (changes.isPro) {
          state.isPro = changes.isPro.newValue === true;
          render();
        }
        if (changes.accessToken || changes.refreshToken) {
          const userInfo = await getUserInfoFromStorage();
          state.userEmail = userInfo?.email || null;

          // Update token info if showing settings with debug mode
          if (state.showSettings && state.debugMode && state.isPro) {
            state.tokenInfo = await getTokenExpirationInfo();
          }

          render();
        }
        if (changes.connectionStatus) {
          state.connectionStatus = changes.connectionStatus.newValue || null;
          render();
        }
      }
    });

    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        loadState();
      }
    });

    log('[Popup] Initialization complete');
  } catch (error) {
    logAlways('[Popup] Initialization error:', error);
    document.getElementById('root').innerHTML = `
      <div class="popup-container">
        <div class="popup-header">
          <h1>Error</h1>
        </div>
        <div class="popup-content">
          <p style="color: red">Failed to initialize popup: ${error.message}</p>
          <p style="font-size: 12px">${error.stack}</p>
        </div>
      </div>
    `;
  }
});
