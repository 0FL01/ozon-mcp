// Firefox extension background script
// Connects to MCP server and handles browser automation commands

// Logging utilities
let debugMode = false;

// Load debug mode setting on startup
browser.storage.local.get(['debugMode']).then(result => {
  debugMode = result.debugMode || false;
});

// Listen for debug mode changes
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.debugMode) {
    debugMode = changes.debugMode.newValue || false;
  }
});

function log(...args) {
  if (debugMode) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    console.log(`[Blueprint MCP for Firefox] ${time}`, ...args);
  }
}

function logAlways(...args) {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  console.log(`[Blueprint MCP for Firefox] ${time}`, ...args);
}

logAlways('[Background] Extension loaded');

let socket = null;
let isConnected = false;
let attachedTabId = null; // Currently attached tab ID
let attachedTabInfo = null; // Currently attached tab info {id, title, url}
let projectName = null; // MCP project name from client_id
let stealthMode = null; // Stealth mode status (true/false/null)
let pendingDialogResponse = null; // Stores response for next dialog (accept, text)
let consoleMessages = []; // Stores console messages from the page
let networkRequests = []; // Stores network requests for tracking
let requestIdCounter = 0; // Counter for request IDs
let techStackInfo = {}; // Stores detected tech stack per tab: { tabId: { frameworks, libraries, css, devTools, spa, autoReload } }

// JWT Decoding utility (without validation - only for extracting claims)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    log('[Background] Failed to decode JWT:', e.message);
    return null;
  }
}

// Get user info from stored JWT
async function getUserInfoFromStorage() {
  const result = await browser.storage.local.get(['accessToken']);
  if (!result.accessToken) return null;

  const payload = decodeJWT(result.accessToken);
  if (!payload) return null;

  return {
    email: payload.email || payload.sub || null,
    sub: payload.sub,
    connectionUrl: payload.connection_url || null, // PRO mode relay URL
  };
}

// Network request tracking using webRequest API
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const requestId = `${details.requestId}`;
    networkRequests.push({
      requestId: requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      tabId: details.tabId,
      timestamp: details.timeStamp,
      statusCode: null,
      statusText: null,
      requestHeaders: null,
      responseHeaders: null,
      requestBody: details.requestBody
    });

    // Keep only last 500 requests
    if (networkRequests.length > 500) {
      networkRequests.shift();
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

browser.webRequest.onCompleted.addListener(
  (details) => {
    const request = networkRequests.find(r => r.requestId === `${details.requestId}`);
    if (request) {
      request.statusCode = details.statusCode;
      request.statusText = details.statusLine;
      request.responseHeaders = details.responseHeaders;
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const request = networkRequests.find(r => r.requestId === `${details.requestId}`);
    if (request) {
      request.requestHeaders = details.requestHeaders;
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

browser.webRequest.onErrorOccurred.addListener(
  (details) => {
    const request = networkRequests.find(r => r.requestId === `${details.requestId}`);
    if (request) {
      request.statusCode = 0;
      request.statusText = details.error || 'Error';
    }
  },
  { urls: ["<all_urls>"] }
);

// Helper function to set up dialog overrides on a tab
// This auto-handles alert/confirm/prompt dialogs and logs what happened
async function setupDialogOverrides(tabId, accept = true, promptText = '') {
  const dialogResponse = { accept, promptText };

  try {
    await browser.tabs.executeScript(tabId, {
      code: `
        // Set up dialog response in window object
        window.__blueprintDialogResponse = ${JSON.stringify(dialogResponse)};

        // Initialize dialog event log if not exists
        if (!window.__blueprintDialogEvents) {
          window.__blueprintDialogEvents = [];
        }

        // Store originals only once
        if (!window.__originalAlert) {
          window.__originalAlert = window.alert;
          window.__originalConfirm = window.confirm;
          window.__originalPrompt = window.prompt;

          // Override with auto-response that checks for pending response
          window.alert = function(...args) {
            const message = args[0] || '';
            if (window.__blueprintDialogResponse) {
              console.log('[Blueprint MCP] Auto-handled alert:', message);
              window.__blueprintDialogEvents.push({
                type: 'alert',
                message: message,
                response: undefined,
                timestamp: Date.now()
              });
              // Don't delete - keep handling all dialogs
              return undefined;
            }
            return window.__originalAlert.apply(this, args);
          };

          window.confirm = function(...args) {
            const message = args[0] || '';
            if (window.__blueprintDialogResponse) {
              const response = window.__blueprintDialogResponse.accept;
              console.log('[Blueprint MCP] Auto-handled confirm:', message, '- returned:', response);
              window.__blueprintDialogEvents.push({
                type: 'confirm',
                message: message,
                response: response,
                timestamp: Date.now()
              });
              // Don't delete - keep handling all dialogs
              return response;
            }
            return window.__originalConfirm.apply(this, args);
          };

          window.prompt = function(...args) {
            const message = args[0] || '';
            const defaultValue = args[1] || '';
            if (window.__blueprintDialogResponse) {
              const response = window.__blueprintDialogResponse.accept
                ? window.__blueprintDialogResponse.promptText
                : null;
              console.log('[Blueprint MCP] Auto-handled prompt:', message, '- returned:', response);
              window.__blueprintDialogEvents.push({
                type: 'prompt',
                message: message,
                defaultValue: defaultValue,
                response: response,
                timestamp: Date.now()
              });
              // Don't delete - keep handling all dialogs
              return response;
            }
            return window.__originalPrompt.apply(this, args);
          };

          console.log('[Blueprint MCP] Dialog overrides installed (auto-accept)');
        } else {
          // Just update the response if already set up
          console.log('[Blueprint MCP] Dialog response updated');
        }
      `
    });
  } catch (error) {
    log('[Background] Could not inject dialog overrides:', error.message);
  }
}

// Auto-connect to MCP server on startup
async function autoConnect() {
  try {
    // Check if user has PRO account with connection URL from JWT
    const userInfo = await getUserInfoFromStorage();
    let url;
    let isPro = false;

    if (userInfo && userInfo.connectionUrl) {
      // PRO user: use connection URL from JWT token
      url = userInfo.connectionUrl;
      isPro = true;
      log(`[Background] PRO mode: Connecting to relay server ${url}...`);

      // Set isPro flag in storage for popup
      await browser.storage.local.set({ isPro: true });
    } else {
      // Free user: use local port
      const result = await browser.storage.local.get(['mcpPort']);
      const port = result.mcpPort || '5555';
      url = `ws://127.0.0.1:${port}/extension`;
      log(`[Background] Free mode: Connecting to ${url}...`);

      // Clear isPro flag in storage
      await browser.storage.local.set({ isPro: false });
    }

    socket = new WebSocket(url);

    socket.onopen = () => {
      log('[Background] Connected');
      isConnected = true;

      // In PRO mode (relay), don't send handshake - wait for authenticate request
      // In Free mode, send handshake
      if (!isPro) {
        socket.send(JSON.stringify({
          type: 'handshake',
          browser: 'firefox',
          version: browser.runtime.getManifest().version
        }));
      } else {
        log('[Background] PRO mode: Waiting for authenticate request from proxy...');
      }
    };

    socket.onmessage = async (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
        log('[Background] Received command:', message);

        // Handle error responses from server
        if (message.error) {
          logAlways('[Background] Server error response:', message.error);
          return;
        }

        // Handle notifications (no id, has method)
        if (!message.id && message.method) {
          if (message.method === 'authenticated' && message.params?.client_id) {
            projectName = message.params.client_id;
            log('[Background] Project name set:', projectName);
          }
          if (message.method === 'connection_status' && message.params) {
            // Store connection status for popup display
            const status = {
              max_connections: message.params.max_connections,
              connections_used: message.params.connections_used,
              connections_to_this_browser: message.params.connections_to_this_browser
            };
            await browser.storage.local.set({ connectionStatus: status });
            log('[Background] Connection status updated:', status);

            // Extract project_name from active_connections if available (matching Chrome)
            if (message.params.active_connections && message.params.active_connections.length > 0) {
              const firstConnection = message.params.active_connections[0];
              // Try different field names: project_name, mcp_client_id, client_id, clientID, name
              let extractedProjectName = firstConnection.project_name ||
                                         firstConnection.mcp_client_id ||
                                         firstConnection.client_id ||
                                         firstConnection.clientID ||
                                         firstConnection.name;

              // Strip "mcp-" prefix if present
              if (extractedProjectName && extractedProjectName.startsWith('mcp-')) {
                extractedProjectName = extractedProjectName.substring(4); // Remove "mcp-"
              }

              if (extractedProjectName) {
                log('[Background] Project name from connection_status:', extractedProjectName);
                projectName = extractedProjectName;
                // Broadcast status change to popup
                browser.runtime.sendMessage({ type: 'statusChanged' }).catch(() => {});
              } else {
                log('[Background] No project name found in connection. firstConnection:', firstConnection);
              }
            } else {
              log('[Background] No active_connections in params');
            }
          }
          return; // Don't send response for notifications
        }

        const response = await handleCommand(message);

        // Add current tab info to response (matches Chrome extension behavior)
        // Include techStack in every response so MCP server state stays in sync
        if (attachedTabId && attachedTabInfo) {
          response.currentTab = {
            id: attachedTabInfo.id,
            title: attachedTabInfo.title,
            url: attachedTabInfo.url,
            index: attachedTabInfo.index,
            techStack: attachedTabInfo.techStack || null
          };
          log('[Background] Added currentTab to response with techStack:', attachedTabInfo.techStack);
        }

        socket.send(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: response
        }));
      } catch (error) {
        logAlways('[Background] Command error:', error);
        // Send error response if we have a message id
        if (message && message.id) {
          socket.send(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              message: error.message,
              stack: error.stack
            }
          }));
        }
      }
    };

    socket.onerror = (error) => {
      logAlways('[Background] WebSocket error:', error);
      isConnected = false;
    };

    socket.onclose = () => {
      log('[Background] Disconnected from MCP server');
      isConnected = false;

      // Retry connection after 5 seconds
      setTimeout(autoConnect, 5000);
    };

  } catch (error) {
    logAlways('[Background] Connection error:', error);
    setTimeout(autoConnect, 5000);
  }
}

// Handle commands from MCP server
async function handleCommand(message) {
  const { method, params } = message;

  switch (method) {
    case 'authenticate':
      // PRO mode: Proxy is requesting authentication
      // Get stored tokens and browser name from browser.storage
      const result = await browser.storage.local.get(['accessToken', 'refreshToken', 'browserName', 'stableClientId']);

      if (!result.accessToken) {
        throw new Error('No authentication tokens found. Please login via MCP client first.');
      }

      const browserName = result.browserName || 'Firefox';

      // Get or generate stable client_id (matches Chrome's behavior)
      let clientId = result.stableClientId;
      if (!clientId) {
        // Generate stable ID based on browser install ID
        const info = await browser.runtime.getBrowserInfo();
        clientId = `firefox-${info.name}-${browser.runtime.id}`;
        await browser.storage.local.set({ stableClientId: clientId });
      }

      const authResponse = {
        name: browserName,
        access_token: result.accessToken,
        client_id: clientId
      };
      logAlways('[Background] Responding to authenticate request:', JSON.stringify(authResponse, null, 2));
      return authResponse;

    case 'getTabs':
      return await handleGetTabs();

    case 'createTab':
      return await handleCreateTab(params);

    case 'selectTab':
      return await handleSelectTab(params);

    case 'getNetworkRequests':
      return { requests: networkRequests };

    case 'clearTracking':
      networkRequests = [];
      return { success: true };

    case 'forwardCDPCommand':
      return await handleCDPCommand(params);

    case 'listExtensions':
      return await handleListExtensions();

    case 'reloadExtensions':
      return await handleReloadExtensions(params);

    case 'openTestPage':
      return await handleOpenTestPage();

    case 'closeTab':
      return await handleCloseTab();

    case 'getConsoleMessages':
      return await handleGetConsoleMessages();

    case 'clearConsoleMessages':
      consoleMessages = [];
      return { success: true };

    default:
      throw new Error(`Unknown command: ${method}`);
  }
}

// Handle getTabs command (matches Chrome extension)
async function handleGetTabs() {
  // Get all tabs from all windows
  const windows = await browser.windows.getAll({ populate: true });
  const tabs = [];
  let tabIndex = 0;

  windows.forEach(window => {
    window.tabs.forEach(tab => {
      // Check if tab is automatable (not about:, moz-extension:, etc.)
      const isAutomatable = tab.url && !['about:', 'moz-extension:'].some(scheme => tab.url.startsWith(scheme));

      tabs.push({
        id: tab.id,
        windowId: window.id,
        title: tab.title,
        url: tab.url,
        active: tab.active,
        index: tabIndex,
        automatable: isAutomatable
      });

      tabIndex++;
    });
  });

  return { tabs };
}

// Handle createTab command (matches Chrome extension)
async function handleCreateTab(params) {
  const url = params.url || 'about:blank';
  const activate = params.activate !== false;
  const stealth = params.stealth ?? false;

  // Create new tab
  const tab = await browser.tabs.create({
    url: url,
    active: activate
  });

  // Set stealth mode
  stealthMode = stealth;

  // Get all tabs to find the index of the newly created tab
  const allTabs = await browser.tabs.query({});
  const tabIndex = allTabs.findIndex(t => t.id === tab.id);

  // Auto-attach to the new tab
  attachedTabId = tab.id;
  attachedTabInfo = {
    id: tab.id,
    title: tab.title,
    url: tab.url,
    index: tabIndex >= 0 ? tabIndex : undefined,
    techStack: techStackInfo[tab.id] || null
  };

  // Update badge for the new tab (badge color reflects stealth mode)
  await updateBadgeForTab(tab.id);

  // Inject console capture and dialog overrides
  await injectConsoleCapture(tab.id);
  await setupDialogOverrides(tab.id);

  return { tab: { id: tab.id, title: tab.title, url: tab.url } };
}

// Handle selectTab command
async function handleSelectTab(params) {
  const tabIndex = params.tabIndex;
  const activate = params.activate !== false;
  const stealth = params.stealth ?? false;

  // Get all tabs
  const allTabs = await browser.tabs.query({});

  if (tabIndex < 0 || tabIndex >= allTabs.length) {
    throw new Error(`Tab index ${tabIndex} out of range (0-${allTabs.length - 1})`);
  }

  const selectedTab = allTabs[tabIndex];

  // Check if tab is automatable (not about:, moz-extension:, etc.)
  const isAutomatable = selectedTab.url && !['about:', 'moz-extension:'].some(scheme => selectedTab.url.startsWith(scheme));
  if (!isAutomatable) {
    throw new Error(`Cannot automate tab ${tabIndex}: "${selectedTab.title}" (${selectedTab.url || 'no url'}) - about: and moz-extension: pages cannot be automated`);
  }

  // Optionally switch to the tab
  if (activate) {
    await browser.tabs.update(selectedTab.id, { active: true });
    await browser.windows.update(selectedTab.windowId, { focused: true });
  }

  // Clear badge from old tab if there was one
  const oldTabId = attachedTabId;
  if (oldTabId && oldTabId !== selectedTab.id) {
    await clearBadge(oldTabId);
  }

  // Set stealth mode
  stealthMode = stealth;

  // Attach to this tab
  attachedTabId = selectedTab.id;
  attachedTabInfo = {
    id: selectedTab.id,
    title: selectedTab.title,
    url: selectedTab.url,
    index: tabIndex,  // Use the tabIndex parameter
    techStack: techStackInfo[selectedTab.id] || null
  };

  // Update badge for the new tab (badge color reflects stealth mode)
  await updateBadgeForTab(selectedTab.id);

  // Inject console capture and dialog overrides
  await injectConsoleCapture(selectedTab.id);
  await setupDialogOverrides(selectedTab.id);

  return { tab: { id: selectedTab.id, title: selectedTab.title, url: selectedTab.url } };
}

// Handle mouse events via JavaScript injection
async function handleMouseEvent(params) {
  const { type, x, y, button = 'left', clickCount = 1 } = params;

  // Map button names to mouse button numbers
  const buttonMap = { left: 0, middle: 1, right: 2 };
  const buttonNum = buttonMap[button] || 0;

  // Create the script to execute based on event type
  let script = '';

  if (type === 'mouseMoved') {
    script = `
      (() => {
        const element = document.elementFromPoint(${x}, ${y});
        if (element) {
          const event = new MouseEvent('mousemove', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: ${x},
            clientY: ${y}
          });
          element.dispatchEvent(event);
        }
      })();
    `;
  } else if (type === 'mousePressed') {
    script = `
      (() => {
        const element = document.elementFromPoint(${x}, ${y});
        if (element) {
          const event = new MouseEvent('mousedown', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: ${x},
            clientY: ${y},
            button: ${buttonNum},
            detail: ${clickCount}
          });
          element.dispatchEvent(event);
        }
      })();
    `;
  } else if (type === 'mouseReleased') {
    script = `
      (() => {
        const element = document.elementFromPoint(${x}, ${y});
        if (element) {
          // First dispatch mouseup
          const mouseupEvent = new MouseEvent('mouseup', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: ${x},
            clientY: ${y},
            button: ${buttonNum},
            detail: ${clickCount}
          });
          element.dispatchEvent(mouseupEvent);

          // Then dispatch click
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: ${x},
            clientY: ${y},
            button: ${buttonNum},
            detail: ${clickCount}
          });
          element.dispatchEvent(clickEvent);
        }
      })();
    `;
  }

  await browser.tabs.executeScript(attachedTabId, { code: script });
  return {};
}

// Handle keyboard events via JavaScript injection
async function handleKeyEvent(params) {
  const { type, key, code, text, windowsVirtualKeyCode, nativeVirtualKeyCode, unmodifiedText } = params;

  if (type === 'char') {
    // For character input, directly modify the focused element's value
    // Note: Firefox's executeScript doesn't auto-invoke IIFEs, so we use a simpler approach
    const script = `
      {
        const element = document.activeElement;
        if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
          try {
            const char = ${JSON.stringify(text)};
            const value = element.value || '';

            // Try to use selection if supported
            let start, end, supportsSelection = false;
            try {
              start = element.selectionStart;
              end = element.selectionEnd;
              if (typeof start === 'number' && typeof end === 'number') {
                supportsSelection = true;
              }
            } catch (e) {
              // Selection not supported (e.g., email/number inputs in Firefox)
            }

            if (supportsSelection) {
              // Insert at cursor position
              element.value = value.substring(0, start) + char + value.substring(end);
              element.selectionStart = element.selectionEnd = start + char.length;
            } else {
              // Just append to end if selection not supported
              element.value = value + char;
            }

            // Dispatch input event to trigger React/Vue listeners
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            element.dispatchEvent(inputEvent);
          } catch (error) {
            console.error('Key event error:', error);
          }
        }
      }
    `;

    await browser.tabs.executeScript(attachedTabId, { code: script });
  } else {
    // For keyDown/keyUp, dispatch keyboard events
    const eventType = type === 'keyDown' ? 'keydown' : 'keyup';

    const script = `
      {
        const element = document.activeElement || document.body;

        const event = new KeyboardEvent(${JSON.stringify(eventType)}, {
          key: ${JSON.stringify(key)},
          code: ${JSON.stringify(code)},
          bubbles: true,
          cancelable: true,
          keyCode: ${windowsVirtualKeyCode || 0},
          which: ${windowsVirtualKeyCode || 0}
        });

        element.dispatchEvent(event);
      }
    `;

    await browser.tabs.executeScript(attachedTabId, { code: script });
  }

  return {};
}

// Handle CDP commands (translate to Firefox equivalents)
async function handleCDPCommand(params) {
  const { method, params: cdpParams } = params;

  log('[Background] handleCDPCommand called:', method, 'tab:', attachedTabId);

  if (!attachedTabId) {
    throw new Error('No tab attached. Call selectTab or createTab first.');
  }

  switch (method) {
    case 'Page.navigate':
      // Navigate to URL using Firefox tabs.update
      const targetUrl = cdpParams.url;

      // Clear old tech stack data before navigation to avoid showing stale data
      if (techStackInfo[attachedTabId]) {
        logAlways('[Background] Clearing old tech stack before navigation');
        delete techStackInfo[attachedTabId];
      }

      await browser.tabs.update(attachedTabId, { url: targetUrl });

      // Wait for navigation to complete
      logAlways('[Background] Waiting for navigation to:', targetUrl);
      await new Promise((resolve) => {
        const listener = (details) => {
          logAlways('[Background] webNavigation.onCompleted:', details.tabId, details.url, details.frameId);
          if (details.tabId === attachedTabId && details.url === targetUrl && details.frameId === 0) {
            logAlways('[Background] Navigation completed to target URL');
            browser.webNavigation.onCompleted.removeListener(listener);
            resolve();
          }
        };
        browser.webNavigation.onCompleted.addListener(listener);

        // Timeout after 10 seconds
        setTimeout(() => {
          logAlways('[Background] Navigation timeout - proceeding anyway');
          browser.webNavigation.onCompleted.removeListener(listener);
          resolve();
        }, 10000);
      });

      // Wait for content script to detect tech stack (runs ~100ms after DOMContentLoaded)
      logAlways('[Background] Waiting for tech stack detection...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get updated tab info
      const navigatedTab = await browser.tabs.get(attachedTabId);

      // Update cached tab info - preserve existing index since navigation doesn't change tab position
      const previousIndex = attachedTabInfo?.index;
      const detectedStack = techStackInfo[navigatedTab.id] || null;

      attachedTabInfo = {
        id: navigatedTab.id,
        title: navigatedTab.title,
        url: navigatedTab.url,
        index: previousIndex,  // Preserve index from when tab was attached
        techStack: detectedStack
      };

      // Build detailed tech stack explanation
      let techStackMessage = '';
      if (detectedStack) {
        const parts = [];
        if (detectedStack.frameworks && detectedStack.frameworks.length > 0) {
          parts.push(`Frameworks: ${detectedStack.frameworks.join(', ')}`);
        }
        if (detectedStack.libraries && detectedStack.libraries.length > 0) {
          parts.push(`Libraries: ${detectedStack.libraries.join(', ')}`);
        }
        if (detectedStack.css && detectedStack.css.length > 0) {
          parts.push(`CSS: ${detectedStack.css.join(', ')}`);
        }
        if (detectedStack.devTools && detectedStack.devTools.length > 0) {
          parts.push(`Dev Tools: ${detectedStack.devTools.join(', ')}`);
        }

        if (parts.length > 0) {
          techStackMessage = '\n\n**Tech Stack Detected:**\n' + parts.map(p => `- ${p}`).join('\n');
          if (detectedStack.spa) {
            techStackMessage += '\n- Single Page Application (SPA) detected';
          }
        } else {
          techStackMessage = '\n\n**Tech Stack:** None detected (static HTML or unknown frameworks)';
        }
      } else {
        techStackMessage = '\n\n**Tech Stack:** Detection pending or page not yet loaded';
      }

      logAlways('[Background] Page.navigate completed with tech stack:', detectedStack);

      // Return detailed response
      return {
        message: `Navigated to: ${targetUrl}${techStackMessage}`
      };

    case 'Page.reload':
      // Reload page using Firefox tabs.reload
      await browser.tabs.reload(attachedTabId);
      return {};

    case 'Page.printToPDF':
      // Firefox WebExtensions don't support PDF generation
      // Users need to use browser's native print dialog
      throw new Error('PDF generation not supported in Firefox extension - use browser\'s native print (Ctrl/Cmd+P) instead');

    case 'Page.captureScreenshot':
      // Use Firefox tabs.captureTab API
      const dataUrl = await browser.tabs.captureTab(attachedTabId, {
        format: cdpParams.format === 'png' ? 'png' : 'jpeg',
        quality: cdpParams.quality || 80
      });

      // Convert data URL to base64 (remove "data:image/png;base64," prefix)
      const base64Data = dataUrl.split(',')[1];

      return { data: base64Data };

    case 'Runtime.evaluate':
      // Execute JavaScript in the tab's content
      try {
        log('[Background] Executing script in tab:', attachedTabId);
        log('[Background] Script:', cdpParams.expression.substring(0, 200));

        const results = await browser.tabs.executeScript(attachedTabId, {
          code: cdpParams.expression
        });

        log('[Background] Script result:', results);

        return {
          result: {
            type: 'object',
            value: results[0]
          }
        };
      } catch (error) {
        logAlways('[Background] Script execution failed:', error);
        throw error;
      }

    case 'Input.dispatchMouseEvent':
      // Simulate mouse events using JavaScript
      return await handleMouseEvent(cdpParams);

    case 'Input.dispatchKeyEvent':
      // Simulate keyboard events using JavaScript
      return await handleKeyEvent(cdpParams);

    case 'DOM.describeNode':
      // Firefox doesn't need this for file uploads, but return mock data for compatibility
      return {
        node: {
          backendNodeId: 1,
          nodeType: 1,
          nodeName: 'INPUT'
        }
      };

    case 'DOM.setFileInputFiles':
      // Firefox doesn't support programmatic file input for security reasons
      // This would require user interaction in a real scenario
      throw new Error('File upload not supported in Firefox extension - requires user interaction');

    case 'Emulation.setDeviceMetricsOverride':
      // Firefox uses actual window resizing instead of device metrics emulation
      // Get the current window
      const tab = await browser.tabs.get(attachedTabId);
      const window = await browser.windows.get(tab.windowId);

      // Resize the window
      await browser.windows.update(window.id, {
        width: cdpParams.width,
        height: cdpParams.height
      });

      return {};

    case 'Page.handleJavaScriptDialog':
      // Update dialog handler with new response settings
      const accept = cdpParams.accept !== false;
      const promptText = cdpParams.promptText || '';

      await setupDialogOverrides(attachedTabId, accept, promptText);

      return {};

    case 'Runtime.getDialogEvents':
      // Custom CDP command to retrieve dialog events from the page
      const dialogEventsResult = await browser.tabs.executeScript(attachedTabId, {
        code: `
          (function() {
            const events = window.__blueprintDialogEvents || [];
            // Clear events after retrieving them
            window.__blueprintDialogEvents = [];
            return events;
          })()
        `
      });

      return { events: dialogEventsResult[0] || [] };

    case 'Performance.getMetrics':
      // Firefox doesn't have Performance.getMetrics CDP command
      // Return empty metrics - the actual performance data comes from Runtime.evaluate
      // which is called separately by unifiedBackend.js
      return { metrics: [] };

    case 'Accessibility.getFullAXTree':
      // Firefox doesn't have accessibility tree API, so create a simplified DOM snapshot
      const snapshotResults = await browser.tabs.executeScript(attachedTabId, {
        code: `
          (() => {
            function getSnapshot(element, depth = 0, maxDepth = 8) {
              if (depth > maxDepth) return '';

              let output = '';
              const indent = '  '.repeat(depth);

              // Skip invisible elements
              const style = window.getComputedStyle(element);
              if (style.display === 'none' || style.visibility === 'hidden') {
                return '';
              }

              // Get element info
              const tag = element.tagName.toLowerCase();
              let selector = tag;
              if (element.id) selector += '#' + element.id;
              if (element.className && typeof element.className === 'string') {
                const classes = element.className.split(' ').filter(c => c.trim());
                if (classes.length > 0) selector += '.' + classes.slice(0, 2).join('.');
              }

              // Get direct text content only
              let text = '';
              for (let node of element.childNodes) {
                if (node.nodeType === 3) {
                  const trimmed = node.textContent.trim();
                  if (trimmed) text += trimmed + ' ';
                }
              }
              text = text.trim().substring(0, 80);

              // Important attributes only
              let attrs = [];
              if (element.hasAttribute('href')) attrs.push('href="' + element.getAttribute('href').substring(0, 50) + '"');
              if (element.hasAttribute('aria-label')) attrs.push('aria-label="' + element.getAttribute('aria-label') + '"');
              if (element.hasAttribute('role')) attrs.push('role="' + element.getAttribute('role') + '"');
              if (element.hasAttribute('type') && tag === 'input') attrs.push('type="' + element.getAttribute('type') + '"');

              const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
              const textStr = text ? ' "' + text + '"' : '';

              output += indent + selector + attrsStr + textStr + '\\n';

              // Process visible children only
              for (let child of element.children) {
                output += getSnapshot(child, depth + 1, maxDepth);
              }

              return output;
            }

            const snapshot = getSnapshot(document.body);
            return { snapshot: snapshot };
          })()
        `
      });

      // Return in a format compatible with Chrome's accessibility tree format
      return {
        formattedSnapshot: {
          preFormatted: true,
          text: snapshotResults[0].snapshot
        }
      };

    default:
      throw new Error(`CDP command not supported in Firefox: ${method}`);
  }
}

// Handle listExtensions command
async function handleListExtensions() {
  const extensions = await browser.management.getAll();

  // Filter to only show extensions (not themes or other types)
  const extensionList = extensions
    .filter(ext => ext.type === 'extension')
    .map(ext => ({
      id: ext.id,
      name: ext.name,
      version: ext.version,
      enabled: ext.enabled,
      description: ext.description
    }));

  return { extensions: extensionList };
}

// Handle openTestPage command
async function handleOpenTestPage() {
  const testPageUrl = 'https://blueprint-mcp.railsblueprint.com/test-page';
  const tab = await browser.tabs.create({ url: testPageUrl, active: true });

  // Test page always uses non-stealth mode
  stealthMode = false;

  // Auto-attach to the test page tab
  attachedTabId = tab.id;
  attachedTabInfo = {
    id: tab.id,
    title: 'Browser Interaction Test Page',
    url: testPageUrl,
    techStack: techStackInfo[tab.id] || null
  };

  // Update badge for the test page tab
  await updateBadgeForTab(tab.id);

  // Inject console capture and dialog overrides
  await injectConsoleCapture(tab.id);
  await setupDialogOverrides(tab.id);

  return { url: testPageUrl, tab: { id: tab.id } };
}

// Handle reloadExtensions command
async function handleReloadExtensions(params) {
  const extensionName = params.extensionName;

  if (!extensionName) {
    // Reload all extensions (just reload this one for now)
    const name = browser.runtime.getManifest().name;
    const response = {
      reloadedCount: 1,
      reloadedExtensions: [name],
      message: 'Extension will reload and reconnect automatically. Please wait a moment before making the next request.'
    };
    logAlways('[Background] Responding to reloadExtensions:', JSON.stringify(response, null, 2));
    // Schedule reload after response is sent
    setTimeout(() => browser.runtime.reload(), 100);
    return response;
  }

  // Get all extensions
  const extensions = await browser.management.getAll();

  // Find the extension by name
  const targetExtension = extensions.find(ext =>
    ext.name.toLowerCase() === extensionName.toLowerCase() && ext.type === 'extension'
  );

  if (!targetExtension) {
    throw new Error(`Extension "${extensionName}" not found`);
  }

  // Check if it's this extension
  if (targetExtension.id === browser.runtime.id) {
    const response = {
      reloadedCount: 1,
      reloadedExtensions: [targetExtension.name],
      message: 'Extension will reload and reconnect automatically. Please wait a moment before making the next request.'
    };
    logAlways('[Background] Responding to reloadExtensions:', JSON.stringify(response, null, 2));
    // Reload this extension after response is sent
    setTimeout(() => browser.runtime.reload(), 100);
    return response;
  } else {
    // Cannot reload other extensions in Firefox (security restriction)
    throw new Error(`Cannot reload other extensions in Firefox. Only "${browser.runtime.getManifest().name}" can be reloaded.`);
  }
}

// Handle closeTab command
async function handleCloseTab() {
  if (!attachedTabId) {
    throw new Error('No tab attached');
  }

  await browser.tabs.remove(attachedTabId);
  attachedTabId = null;
  attachedTabInfo = null;

  return { success: true };
}

// Handle getConsoleMessages command
async function handleGetConsoleMessages() {
  return {
    messages: consoleMessages.slice() // Return copy
  };
}

// Inject console capture script into tab
async function injectConsoleCapture(tabId) {
  try {
    await browser.tabs.executeScript(tabId, {
      code: `
        // Only inject once
        if (!window.__blueprintConsoleInjected) {
          window.__blueprintConsoleInjected = true;

          // Store original console methods
          const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug
          };

          // Override console methods to capture messages
          ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
            console[method] = function(...args) {
              // Call original
              originalConsole[method].apply(console, args);

              // Send to extension
              const message = {
                type: 'console',
                level: method,
                text: args.map(arg => {
                  try {
                    return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                  } catch (e) {
                    return String(arg);
                  }
                }).join(' '),
                timestamp: Date.now()
              };

              // Try to send via postMessage (extension will listen)
              window.postMessage({ __blueprintConsole: message }, '*');
            };
          });

          console.log('[Blueprint MCP] Console capture installed');
        }
      `
    });
  } catch (error) {
    logAlways('[Background] Failed to inject console capture:', error);
  }
}

// Badge update functions (matching Chrome implementation)
async function updateBadgeForTab(tabId) {
  // Firefox has 4-character limit for badge text, use simple checkmark
  // Note: Firefox may not render Unicode well in badges, might show as box
  const text = '✓';
  const color = stealthMode ? '#666666' : '#1c75bc'; // Gray for stealth, blue for normal
  const title = stealthMode ? 'Connected (Stealth Mode)' : 'Connected to MCP client';
  await updateBadge(tabId, { text, color, title });
}

async function updateBadge(tabId, { text, color, title }) {
  try {
    logAlways('[Background] Setting badge - tabId:', tabId, 'text:', text, 'color:', color, 'title:', title);

    // Firefox manifest v2 may not support per-tab badges reliably
    // Try setting globally first, then per-tab
    try {
      // Set globally (no tabId)
      await browser.browserAction.setBadgeText({ text });
      logAlways('[Background] setBadgeText (global) succeeded');
    } catch (e) {
      logAlways('[Background] setBadgeText (global) failed:', e.message);
    }

    // Try per-tab as well
    try {
      await browser.browserAction.setBadgeText({ tabId, text });
      logAlways('[Background] setBadgeText (per-tab) succeeded');
    } catch (e) {
      logAlways('[Background] setBadgeText (per-tab) failed:', e.message);
    }

    // Try setting title globally
    try {
      await browser.browserAction.setTitle({ title: title || '' });
      logAlways('[Background] setTitle (global) succeeded');
    } catch (e) {
      logAlways('[Background] setTitle (global) failed:', e.message);
    }

    // Try setting background color globally
    if (color) {
      try {
        await browser.browserAction.setBadgeBackgroundColor({ color });
        logAlways('[Background] setBadgeBackgroundColor (global) succeeded');
      } catch (e) {
        logAlways('[Background] setBadgeBackgroundColor (global) failed:', e.message);
      }
    }

    logAlways('[Background] Badge update complete');
  } catch (error) {
    // Log errors so we can debug
    logAlways('[Background] Badge update error:', error.message, error.stack);
  }
}

async function clearBadge(tabId) {
  await updateBadge(tabId, { text: '' });
}

// Listen for tab activation to update badge based on current tab
browser.tabs.onActivated.addListener(async (activeInfo) => {
  log('[Background] Tab activated:', activeInfo.tabId);

  // Check if the activated tab is the attached tab
  if (activeInfo.tabId === attachedTabId) {
    // Show badge for attached tab
    await updateBadgeForTab(activeInfo.tabId);
    log('[Background] Badge shown for attached tab');
  } else {
    // Clear badge for non-attached tabs
    await clearBadge(activeInfo.tabId);
    log('[Background] Badge cleared for non-attached tab');
  }
});

// Listen for tab close to clear badge if attached tab is closed
browser.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === attachedTabId) {
    log('[Background] Attached tab closed, clearing badge');
    await clearBadge(tabId);
    attachedTabId = null;
    attachedTabInfo = null;
  }
});

// Listen for tab navigation to re-inject dialog overrides on the attached tab
browser.webNavigation.onCompleted.addListener(async (details) => {
  // Only re-inject if this is the attached tab and it's the main frame
  if (details.tabId === attachedTabId && details.frameId === 0) {
    log('[Background] Page loaded, re-injecting dialog overrides and console capture');
    await injectConsoleCapture(details.tabId);
    await setupDialogOverrides(details.tabId);
  }
});

// Handle messages from popup and content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getStatus') {
    sendResponse({
      connected: isConnected,
      attachedTab: attachedTabInfo,
      projectName: projectName
    });
  } else if (message.type === 'getConnectionStatus') {
    sendResponse({
      connected: isConnected,
      connectedTabId: attachedTabId,
      stealthMode: stealthMode,
      projectName: projectName
    });
  } else if (message.type === 'loginSuccess') {
    // OAuth login completed - store tokens and set isPro flag
    browser.storage.local.set({
      accessToken: message.accessToken,
      refreshToken: message.refreshToken,
      isPro: true
    }, () => {
      sendResponse({ success: true });
    });
    return true; // Async response
  } else if (message.type === 'focusTab') {
    // Focus the tab that sent this message
    if (sender.tab && sender.tab.id) {
      browser.tabs.update(sender.tab.id, { active: true }).then(() => {
        sendResponse({ success: true });
      });
      return true; // Async response
    }
  } else if (message.type === 'console_message') {
    // Store console message from content script
    consoleMessages.push(message.data);
    // Keep only last 100 messages
    if (consoleMessages.length > 100) {
      consoleMessages.shift();
    }
  } else if (message.type === 'techStackDetected') {
    // Store tech stack info for the tab
    if (sender.tab && sender.tab.id) {
      techStackInfo[sender.tab.id] = message.stack;
      log('[Background] Tech stack detected for tab', sender.tab.id, ':', message.stack);

      // If this is the attached tab, update attachedTabInfo and notify MCP
      if (sender.tab.id === attachedTabId && attachedTabInfo && socket && isConnected) {
        attachedTabInfo.techStack = message.stack;
        log('[Background] Updated attached tab tech stack, notifying MCP server');

        // Send notification to MCP server with updated tab info
        socket.send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/tab_info_update',
          params: {
            currentTab: {
              id: attachedTabInfo.id,
              title: attachedTabInfo.title,
              url: attachedTabInfo.url,
              index: attachedTabInfo.index,
              techStack: message.stack
            }
          }
        }));
      }
    }
  }
});

// Track if we're currently reconnecting to prevent infinite loops
let isReconnecting = false;

// Listen for storage changes (login/logout)
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    // Only reconnect when user explicitly logs in/out (accessToken/refreshToken change)
    // Don't reconnect on isPro changes (those are set by autoConnect itself)
    if ((changes.accessToken || changes.refreshToken) && !isReconnecting) {
      log('[Background] User login/logout detected, reconnecting...');
      isReconnecting = true;

      // Close existing connection
      if (socket) {
        socket.close();
        socket = null;
        isConnected = false;
      }

      // Reconnect with new auth status
      setTimeout(() => {
        autoConnect().finally(() => {
          isReconnecting = false;
        });
      }, 1000);
    }
  }
});

// Start auto-connect
autoConnect();
