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

// Constants
const config = {
  defaultMcpPort: '5555',
};

// State
let state = {
  enabled: true,
  currentTabConnected: false,
  stealthMode: null,
  anyConnected: false,
  connecting: false,
  browserName: 'Firefox',
  showSettings: false,
  port: '5555',
  connectionStatus: null,
  projectName: null,
  debugMode: false,
  version: '1.0.0',
};

// Get default browser name
function getDefaultBrowserName() {
  return browserName; // Uses the detected browser name
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
    'browserName',
    'mcpPort',
    'connectionStatus',
    'debugMode'
  ]);

  state.enabled = storage.extensionEnabled !== false;
  state.browserName = storage.browserName || getDefaultBrowserName();
  state.port = storage.mcpPort || '5555';
  state.connectionStatus = storage.connectionStatus || null;
  state.debugMode = storage.debugMode || false;

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
  // Always save debug mode
  await browserAPI.storage.local.set({ debugMode: state.debugMode });

  // Save port
  await browserAPI.storage.local.set({ mcpPort: state.port });
  // Reload extension to apply new port
  browserAPI.runtime.reload();

  state.showSettings = false;
  render();
}

// Cancel settings
async function cancelSettings() {
  // Reload original values
  const storage = await browserAPI.storage.local.get(['browserName', 'mcpPort', 'debugMode']);
  state.browserName = storage.browserName || getDefaultBrowserName();
  state.port = storage.mcpPort || '5555';
  state.debugMode = storage.debugMode || false;
  state.showSettings = false;
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
        <img src="/icons/icon-32.png" alt="Ozon MCP" class="header-icon" />
        <h1>Ozon MCP<span class="version-label">v${state.version}</span></h1>
      </div>

      <div class="popup-content">
        <div class="settings-form">
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
        <img src="/icons/icon-32.png" alt="Ozon MCP" class="header-icon" />
        <h1>Ozon MCP<span class="version-label">v${state.version}</span></h1>
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

        <div class="links-section">
          <button class="settings-link" id="settingsButton">
            ⚙️ Settings
          </button>
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

    const portInput = document.getElementById('portInput');
    if (portInput) {
      portInput.addEventListener('input', (e) => {
        state.port = e.target.value;
      });
    }

    if (debugModeCheckbox) {
      debugModeCheckbox.addEventListener('change', async (e) => {
        state.debugMode = e.target.checked;
        render();
      });
    }
  } else {
    // Main view listeners
    const toggleButton = document.getElementById('toggleButton');
    const settingsButton = document.getElementById('settingsButton');

    if (toggleButton) toggleButton.addEventListener('click', toggleEnabled);
    if (settingsButton) {
      settingsButton.addEventListener('click', async () => {
        state.showSettings = true;
        render();
      });
    }
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
