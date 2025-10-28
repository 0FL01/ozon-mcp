/**
 * Chrome extension background script (vanilla JS modular version)
 * Connects to MCP server and handles browser automation commands
 *
 * Uses shared ES6 modules from extensions/shared/
 * Minimal build step - just file copying
 */

// Import shared modules
import { Logger } from '../../shared/utils/logger.js';
import { IconManager } from '../../shared/utils/icons.js';
import { WebSocketConnection } from '../../shared/connection/websocket.js';
import { TabHandlers } from '../../shared/handlers/tabs.js';
import { NetworkTracker } from '../../shared/handlers/network.js';
import { DialogHandler } from '../../shared/handlers/dialogs.js';
import { ConsoleHandler } from '../../shared/handlers/console.js';
import { createBrowserAdapter } from '../../shared/adapters/browser.js';
import { wrapWithUnwrap, shouldUnwrap } from '../../shared/utils/unwrap.js';

// Main initialization
(async () => {

// Initialize browser adapter
const browserAdapter = createBrowserAdapter();
const chrome = browserAdapter.getRawAPI();

// Note: Use browserAdapter.executeScript instead of defining a local executeScript
// The browserAdapter version properly handles both 'func' and 'code' parameters
// and avoids CSP issues by not using eval() when possible

// Initialize logger
const logger = new Logger('Blueprint MCP for Chrome');
await logger.init(chrome);
const manifest = chrome.runtime.getManifest();
logger.logAlways(`Blueprint MCP v${manifest.version}`);

// Initialize all managers and handlers
const iconManager = new IconManager(chrome, logger);
const tabHandlers = new TabHandlers(chrome, logger, iconManager);
const networkTracker = new NetworkTracker(chrome, logger);
const dialogHandler = new DialogHandler(browserAdapter, logger);
const consoleHandler = new ConsoleHandler(browserAdapter, logger);

// Wire up injectors to tab handlers
tabHandlers.setConsoleInjector((tabId) => consoleHandler.injectConsoleCapture(tabId));
tabHandlers.setDialogInjector((tabId) => dialogHandler.setupDialogOverrides(tabId));

// Set up console message listener (receives messages from content script)
consoleHandler.setupMessageListener();

// Initialize icon manager
iconManager.init();

// Initialize network tracker
networkTracker.init();

// State variables
let techStackInfo = {}; // Stores detected tech stack per tab
// let pendingDialogResponse = null; // Stores response for next dialog (unused - removed)
let debuggerAttached = false; // Track if debugger is attached to current tab
let currentDebuggerTabId = null; // Track which tab has debugger attached

// Set up keepalive alarm (Chrome-specific - prevents service worker suspension)
if (chrome.alarms) {
  chrome.alarms.create('keepalive', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepalive') {
      logger.log('[Background] Keepalive alarm - service worker active');
    }
  });
}

// Set up console message listener from content script
// Use sendResponse callback pattern for Chrome Manifest V3 compatibility
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Wrap in async IIFE to allow await
  (async () => {
    try {
      // Note: Console messages are handled by ConsoleHandler.setupMessageListener()
      // Do NOT handle them here to avoid duplication

      // Handle tech stack detection from content script
      if (message.type === 'techStackDetected' && sender.tab) {
        logger.log('[Background] Received tech stack:', message.stack);
        techStackInfo[sender.tab.id] = message.stack;

        // Update tab handler's tech stack info
        tabHandlers.setTechStackInfo(sender.tab.id, message.stack);
        return; // No response needed
      }

      // Handle stealth mode check from content script
      if (message.type === 'isStealthMode' && sender.tab) {
        const tabId = sender.tab.id;
        const isStealthMode = tabHandlers.tabStealthModes[tabId] === true;
        sendResponse({ isStealthMode });
        return;
      }

      // Handle OAuth login success from content script
      if (message.type === 'loginSuccess') {
        logger.logAlways('[Background] Login success - saving tokens');
        await chrome.storage.local.set({
          accessToken: message.accessToken,
          refreshToken: message.refreshToken,
          isPro: true
        });
        logger.logAlways('[Background] Tokens saved to storage');

        // Reconnect with new PRO mode credentials
        wsConnection.disconnect();
        await wsConnection.connect();

        sendResponse({ success: true });
        return;
      }

      // Handle connection status request from popup
      if (message.type === 'getConnectionStatus') {
        const status = {
          connected: wsConnection.isConnected,
          connectedTabId: tabHandlers.getAttachedTabId(),
          stealthMode: tabHandlers.stealthMode,
          projectName: wsConnection.projectName
        };
        sendResponse(status);
        return;
      }

      // Unknown message type
      logger.log('[Background] Unknown message type:', message.type);
    } catch (error) {
      logger.logAlways('[Background] Message handler error:', error);
      sendResponse({ error: error.message });
    }
  })();

  // Return true to indicate we'll send a response asynchronously
  return true;
});

// Initialize WebSocket connection
const wsConnection = new WebSocketConnection(chrome, logger, iconManager);

// Helper function to ensure debugger is attached to current tab
async function ensureDebuggerAttached() {
  const attachedTabId = tabHandlers.getAttachedTabId();

  if (!attachedTabId) {
    throw new Error('No tab attached');
  }

  // If debugger is already attached to this tab, we're good
  if (debuggerAttached && currentDebuggerTabId === attachedTabId) {
    return;
  }

  // Detach from previous tab if needed
  if (debuggerAttached && currentDebuggerTabId) {
    try {
      await chrome.debugger.detach({ tabId: currentDebuggerTabId });
      logger.log(`[Background] Detached debugger from tab ${currentDebuggerTabId}`);
    } catch (e) {
      logger.log(`[Background] Failed to detach debugger: ${e.message}`);
    }
  }

  // Attach to new tab
  try {
    await chrome.debugger.attach({ tabId: attachedTabId }, '1.3');
    debuggerAttached = true;
    currentDebuggerTabId = attachedTabId;
    logger.log(`[Background] Attached debugger to tab ${attachedTabId}`);
  } catch (error) {
    debuggerAttached = false;
    currentDebuggerTabId = null;
    throw new Error(`Failed to attach debugger: ${error.message}`);
  }
}

// Handle CDP commands from MCP server
async function handleCDPCommand(cdpMethod, cdpParams) {
  const attachedTabId = tabHandlers.getAttachedTabId();

  logger.log(`[Background] handleCDPCommand called: ${cdpMethod} tab: ${attachedTabId}`);

  if (!attachedTabId && cdpMethod !== 'Target.getTargets') {
    throw new Error('No tab attached. Call selectTab or createTab first.');
  }

  switch (cdpMethod) {
    case 'Target.getTargets':
      return await tabHandlers.getTabs();

    case 'Target.attachToTarget': {
      const tabId = cdpParams.targetId;
      return await tabHandlers.selectTab(parseInt(tabId));
    }

    case 'Target.createTarget': {
      const url = cdpParams.url || 'about:blank';
      return await tabHandlers.createTab(url);
    }

    case 'Target.closeTarget': {
      const tabId = cdpParams.targetId;
      return await tabHandlers.closeTab(parseInt(tabId));
    }

    case 'Page.navigate': {
      const url = cdpParams.url;

      // Navigate the tab
      await chrome.tabs.update(attachedTabId, { url });

      // Wait for navigation to complete
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === attachedTabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(resolve, 5000); // Timeout after 5 seconds
      });

      // Get the updated tab
      const navigatedTab = await chrome.tabs.get(attachedTabId);

      // Get tech stack if available
      const detectedStack = techStackInfo[attachedTabId] || null;
      const techStackMessage = detectedStack ? `\n\nDetected tech stack: ${JSON.stringify(detectedStack)}` : '';

      logger.logAlways('[Background] Page.navigate completed with tech stack:', detectedStack);

      return {
        url: navigatedTab.url,
        title: navigatedTab.title,
        techStack: detectedStack,
        message: `Navigated to ${navigatedTab.url}${techStackMessage}`
      };
    }

    case 'Page.reload':
      await chrome.tabs.reload(attachedTabId);
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };

    case 'Runtime.evaluate': {
      let expression = cdpParams.expression;

      try {
        // Wrap expression with method unwrapping if needed (ONLY in stealth mode)
        // This temporarily restores native DOM methods before execution
        // to bypass bot detection wrappers, then restores them after
        // Only enabled in stealth mode to avoid potential side effects
        if (tabHandlers.stealthMode && shouldUnwrap(expression)) {
          expression = wrapWithUnwrap(expression);
          logger.log('[Evaluate] Wrapped expression with unwrap logic (stealth mode)');
        }

        // Use Chrome Debugger Protocol for evaluation (like old TypeScript extension)
        // This provides better isolation and passes mainWorldExecution bot detection test
        await ensureDebuggerAttached();

        const result = await chrome.debugger.sendCommand(
          { tabId: attachedTabId },
          'Runtime.evaluate',
          {
            expression: expression,
            returnByValue: true
          }
        );

        return {
          result: {
            type: result.result?.type || 'undefined',
            value: result.result?.value
          }
        };
      } catch (error) {
        return {
          exceptionDetails: {
            exception: {
              type: 'object',
              subtype: 'error',
              description: error.message
            },
            text: error.message
          }
        };
      }
    }

    case 'Input.dispatchMouseEvent':
      return await handleMouseEvent(cdpParams);

    case 'Input.dispatchKeyEvent':
      return await handleKeyEvent(cdpParams);

    case 'DOM.querySelector': {
      const selector = cdpParams.selector;

      try {
        const results = await browserAdapter.executeScript(attachedTabId, {
          func: (selector) => {
            const el = document.querySelector(selector);
            if (!el) return null;

            const rect = el.getBoundingClientRect();
            return {
              nodeId: 1,
              backendNodeId: 1,
              exists: true,
              visible: rect.width > 0 && rect.height > 0,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            };
          },
          args: [selector]
        });

        return { nodeId: results[0]?.nodeId || null, info: results[0] };
      } catch (error) {
        return { nodeId: null, error: error.message };
      }
    }

    case 'Page.captureScreenshot': {
      const format = cdpParams.format || 'jpeg';
      const quality = cdpParams.quality !== undefined ? cdpParams.quality : 80;
      // fullPage parameter not currently used - Chrome doesn't support full page screenshots via captureVisibleTab

      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
          format: format === 'jpeg' ? 'jpeg' : 'png',
          quality: format === 'jpeg' ? quality : undefined
        });

        // Remove data URL prefix
        const base64Data = dataUrl.split(',')[1];

        return { data: base64Data };
      } catch (error) {
        throw new Error(`Screenshot failed: ${error.message}`);
      }
    }

    case 'Accessibility.getFullAXTree': {
      // Use DOM-based snapshot with SLIM-style compact notation
      // Includes smart grouping and collapsing optimizations
      try {
        const results = await browserAdapter.executeScript(attachedTabId, {
          world: 'MAIN',  // Use MAIN world for DOM access
          func: function() {
            const maxLines = 200;
            let lineCount = 0;

            // Never group these important navigation/structure elements
            const noGroupTags = new Set(['nav', 'ul', 'ol', 'header', 'footer', 'form', 'table']);

            function getElementSignature(node) {
              // Get a short signature for skip messages
              let sig = node.nodeName.toLowerCase();
              if (node.id) sig += `#${node.id}`;
              else if (node.className && typeof node.className === 'string') {
                const firstClass = node.className.split(' ').filter(c => c)[0];
                if (firstClass) sig += `.${firstClass}`;
              }

              // Add text hint if it's a heading or has short text
              const text = node.textContent?.trim().substring(0, 30);
              if (text && (node.nodeName.match(/^H[1-6]$/) || text.length < 25)) {
                sig += ` "${text}"`;
              }

              return sig;
            }

            function formatChildren(children, depth, parentTag) {
              if (lineCount >= maxLines || depth > 10) return '';
              if (!children || children.length === 0) return '';

              const indent = '  '.repeat(depth);
              let output = '';

              // Check if we should group this level
              const shouldGroup = !noGroupTags.has(parentTag);

              if (!shouldGroup) {
                // Don't group - show all children
                for (let child of children) {
                  if (child.nodeType !== 1) continue;
                  if (lineCount >= maxLines) break;
                  output += formatNode(child, depth);
                }
                return output;
              }

              // Group consecutive children by tag name
              const groups = [];
              let currentGroup = null;

              for (let child of children) {
                if (child.nodeType !== 1) continue;

                const tagName = child.nodeName.toLowerCase();

                if (!currentGroup || currentGroup.tagName !== tagName) {
                  if (currentGroup) groups.push(currentGroup);
                  currentGroup = { tagName, nodes: [child] };
                } else {
                  currentGroup.nodes.push(child);
                }
              }
              if (currentGroup) groups.push(currentGroup);

              // Format groups with deduplication
              for (let group of groups) {
                if (lineCount >= maxLines) break;

                // Show all if 5 or fewer (less aggressive)
                if (group.nodes.length <= 5) {
                  for (let node of group.nodes) {
                    if (lineCount >= maxLines) break;
                    output += formatNode(node, depth);
                  }
                } else {
                  // Repetitive pattern: show first 2, skip middle, show last 1
                  const first = group.nodes.slice(0, 2);
                  const middle = group.nodes.slice(2, -1);
                  const last = group.nodes.slice(-1);

                  for (let node of first) {
                    if (lineCount >= maxLines) break;
                    output += formatNode(node, depth);
                  }

                  // Show what's being skipped
                  if (lineCount < maxLines && middle.length > 0) {
                    const signatures = middle.slice(0, 3).map(n => getElementSignature(n)).join(', ');
                    const more = middle.length > 3 ? `, ...${middle.length - 3} more` : '';
                    output += `${indent}... ${middle.length} more: ${signatures}${more}\n`;
                    lineCount++;
                  }

                  for (let node of last) {
                    if (lineCount >= maxLines) break;
                    output += formatNode(node, depth);
                  }
                }
              }

              return output;
            }

            function formatNode(node, depth) {
              if (lineCount >= maxLines || depth > 10 || !node || node.nodeType !== 1) return '';

              const indent = '  '.repeat(depth);
              const tagName = node.nodeName.toLowerCase();

              // Build SLIM-style selector
              let selector = tagName;
              if (node.id) {
                selector += `#${node.id}`;
              } else if (node.className && typeof node.className === 'string') {
                const classes = node.className.split(' ').filter(c => c).slice(0, 2);
                if (classes.length > 0) {
                  selector += `.${classes.join('.')}`;
                }
              }

              // Get important attributes based on element type
              const attrs = [];
              if (tagName === 'a' && node.href) {
                attrs.push(`href="${node.getAttribute('href')}"`);
              } else if (tagName === 'img' && node.src) {
                attrs.push(`src="${node.getAttribute('src')}"`);
              } else if (tagName === 'link' && node.href) {
                attrs.push(`href="${node.getAttribute('href')}"`);
              } else if (tagName === 'script' && node.src) {
                attrs.push(`src="${node.getAttribute('src')}"`);
              } else if (tagName === 'input') {
                const type = node.getAttribute('type');
                if (type) attrs.push(`type="${type}"`);
                const name = node.getAttribute('name');
                if (name) attrs.push(`name="${name}"`);
                const placeholder = node.getAttribute('placeholder');
                if (placeholder) attrs.push(`placeholder="${placeholder}"`);
              } else if (tagName === 'button' || tagName === 'form') {
                const type = node.getAttribute('type');
                if (type) attrs.push(`type="${type}"`);
                if (tagName === 'form') {
                  const action = node.getAttribute('action');
                  if (action) attrs.push(`action="${action}"`);
                  const method = node.getAttribute('method');
                  if (method) attrs.push(`method="${method}"`);
                }
              } else if (tagName === 'iframe') {
                const src = node.getAttribute('src');
                if (src) attrs.push(`src="${src}"`);
              }

              const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

              // Get text content for leaf nodes only
              let text = '';
              if (node.children.length === 0 && node.textContent) {
                text = node.textContent.trim().substring(0, 50);
                if (text) {
                  text = ` "${text}"`;
                }
              }

              // Skip useless container divs/spans with no id/class and single child
              const isUselessContainer = (tagName === 'div' || tagName === 'span') &&
                                        selector === tagName &&
                                        !attrStr &&
                                        !text &&
                                        node.children.length === 1;

              if (isUselessContainer) {
                return formatNode(node.children[0], depth);
              }

              // Format the node line
              let output = `${indent}${selector}${attrStr}${text}\n`;
              lineCount++;

              // Process children
              if (lineCount < maxLines && node.children.length > 0) {
                output += formatChildren(node.children, depth + 1, tagName);
              }

              return output;
            }

            let snapshot = formatNode(document.body, 0);

            if (lineCount >= maxLines) {
              snapshot += `\n--- Snapshot truncated at ${maxLines} lines ---\n`;
            }

            return {
              formattedSnapshot: {
                preFormatted: true,
                text: snapshot
              }
            };
          }
        });

        return results[0] || { formattedSnapshot: { preFormatted: true, text: '' } };
      } catch (error) {
        throw new Error(`DOM snapshot failed: ${error.message}`);
      }
    }

    case 'Page.handleJavaScriptDialog': {
      const accept = cdpParams.accept !== false;
      const promptText = cdpParams.promptText || '';

      // Set up dialog overrides for this tab
      await dialogHandler.setupDialogOverrides(attachedTabId, accept, promptText);

      return { success: true };
    }

    case 'Runtime.getConsoleMessages':
      return { messages: consoleHandler.getMessages() };

    case 'Network.getRequestLog': {
      const limit = cdpParams.limit || 20;
      const offset = cdpParams.offset || 0;
      const urlPattern = cdpParams.urlPattern;
      const method = cdpParams.method;
      const status = cdpParams.status;
      const resourceType = cdpParams.resourceType;

      return networkTracker.getRequests({
        limit,
        offset,
        urlPattern,
        method,
        status,
        resourceType
      });
    }

    case 'Network.getRequestDetails': {
      const requestId = cdpParams.requestId;
      const jsonPath = cdpParams.jsonPath;

      return networkTracker.getRequestDetails(requestId, jsonPath);
    }

    case 'Network.clearRequestLog':
      networkTracker.clear();
      return { success: true };

    case 'Browser.getVersion':
      return {
        product: 'Chrome',
        userAgent: navigator.userAgent
      };

    case 'Emulation.setDeviceMetricsOverride': {
      const { width, height } = cdpParams;

      try {
        // Get the window containing the attached tab
        const tab = await chrome.tabs.get(attachedTabId);
        await chrome.windows.update(tab.windowId, {
          width: Math.round(width),
          height: Math.round(height)
        });

        return { success: true };
      } catch (error) {
        throw new Error(`Window resize failed: ${error.message}`);
      }
    }

    case 'Page.printToPDF': {
      try {
        await ensureDebuggerAttached();
        const result = await chrome.debugger.sendCommand(
          { tabId: attachedTabId },
          'Page.printToPDF',
          {}
        );
        return result;
      } catch (error) {
        throw new Error(`PDF print failed: ${error.message}`);
      }
    }

    case 'Target.getTargetInfo': {
      try {
        // Get tab info
        const tab = await chrome.tabs.get(attachedTabId);

        // Get performance metrics using executeScript
        const results = await browserAdapter.executeScript(attachedTabId, {
          code: `
            (function() {
              const perfData = window.performance.getEntriesByType('navigation')[0];
              const paintData = window.performance.getEntriesByType('paint');

              const fcp = paintData.find(p => p.name === 'first-contentful-paint');
              const result = {
                loadEventEnd: perfData ? Math.round(perfData.loadEventEnd) : 0,
                domContentLoadedEventEnd: perfData ? Math.round(perfData.domContentLoadedEventEnd) : 0,
                firstContentfulPaint: fcp ? Math.round(fcp.startTime) : 0,
                url: window.location.href,
                title: document.title
              };

              return result;
            })()
          `
        });

        return {
          targetInfo: {
            targetId: String(attachedTabId),
            type: 'page',
            title: tab.title,
            url: tab.url,
            attached: true
          },
          performance: results[0] || {}
        };
      } catch (error) {
        throw new Error(`Get target info failed: ${error.message}`);
      }
    }

    case 'Performance.getMetrics': {
      try {
        await ensureDebuggerAttached();
        const result = await chrome.debugger.sendCommand(
          { tabId: attachedTabId },
          'Performance.getMetrics',
          {}
        );
        return result;
      } catch (error) {
        throw new Error(`Performance.getMetrics failed: ${error.message}`);
      }
    }

    case 'Runtime.getDialogEvents': {
      const attachedTabId = tabHandlers.getAttachedTabId();
      if (!attachedTabId) {
        throw new Error('No tab attached');
      }
      const events = await dialogHandler.getDialogEvents(attachedTabId);
      return { events };
    }

    default:
      throw new Error(`Unsupported CDP method: ${cdpMethod}`);
  }
}

// Mouse event handler
// Track last mousedown for click synthesis
let lastMouseDown = null;

async function handleMouseEvent(params) {
  const attachedTabId = tabHandlers.getAttachedTabId();
  const { type, x, y, button = 'left' } = params;
  // clickCount parameter not currently used

  // Convert CDP event types to DOM event types
  const eventTypeMap = {
    'mousePressed': 'mousedown',
    'mouseReleased': 'mouseup',
    'mouseMoved': 'mousemove'
  };
  const domEventType = eventTypeMap[type] || type;

  // Track mousedown for click synthesis
  if (type === 'mousePressed') {
    lastMouseDown = { x, y, button, timestamp: Date.now() };
  }

  const results = await browserAdapter.executeScript(attachedTabId, {
    world: 'MAIN',  // Must use MAIN world for events to trigger handlers properly
    func: (eventType, x, y, buttonIndex, buttons, shouldSynthesizeClick) => {
      const el = document.elementFromPoint(x, y);
      if (!el) {
        return { success: false, error: 'No element at coordinates' };
      }

      // Dispatch the mouse event
      const event = new MouseEvent(eventType, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: buttonIndex,
        buttons: buttons
      });

      el.dispatchEvent(event);

      // If this is mouseup and we should synthesize a click, dispatch click event
      if (shouldSynthesizeClick && eventType === 'mouseup') {
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          button: buttonIndex,
          buttons: 0  // No buttons pressed during click event
        });
        el.dispatchEvent(clickEvent);
      }

      return { success: true, element: el.tagName, eventType: eventType };
    },
    args: [
      domEventType,
      x,
      y,
      button === 'left' ? 0 : button === 'right' ? 2 : 1,
      button === 'left' ? 1 : button === 'right' ? 2 : 4,
      // Synthesize click if this is mouseup and follows a recent mousedown at same position
      type === 'mouseReleased' && lastMouseDown &&
        lastMouseDown.x === x && lastMouseDown.y === y &&
        lastMouseDown.button === button &&
        (Date.now() - lastMouseDown.timestamp) < 1000  // Within 1 second
    ]
  });

  // Clear mousedown tracking after mouseup
  if (type === 'mouseReleased') {
    lastMouseDown = null;
  }

  return results[0] || { success: false };
}

// Key event handler
async function handleKeyEvent(params) {
  const attachedTabId = tabHandlers.getAttachedTabId();
  const { type, key, code: keyCode, text } = params;

  // For 'char' type events, use text parameter as the key
  // This is sent by browser_interact type action
  const actualKey = type === 'char' && text ? text : key;

  // Map CDP event types to DOM event types
  const eventTypeMap = {
    keyDown: 'keydown',
    keyUp: 'keyup',
    char: 'keypress'
  };

  const domEventType = eventTypeMap[type] || type;

  // IMPORTANT: Must use MAIN world for key events to access the actual focused element
  // ISOLATED world has its own DOM where activeElement is always body
  // All args must be JSON-serializable (no undefined values)
  /* eslint-disable no-undef */
  const results = await chrome.scripting.executeScript({
    target: { tabId: attachedTabId },
    world: 'MAIN',  // Run in main world to access real document.activeElement
    func: (domEventType, actualKey, keyCode, text) => {
      const activeElement = document.activeElement || document.body;

      const event = new KeyboardEvent(domEventType, {
        key: actualKey || '',
        code: keyCode || '',
        bubbles: true,
        cancelable: true
      });

      activeElement.dispatchEvent(event);

      // For text input, also update the value directly
      // Just dispatching KeyboardEvent doesn't insert text in modern browsers
      if (text && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        activeElement.value += text;
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      }

      return { success: true };
    },
    args: [domEventType, actualKey || '', keyCode || '', text || '']
  });
  /* eslint-enable no-undef */

  return results[0]?.result || { success: false };
}

// Register command handlers with WebSocket connection
wsConnection.registerCommandHandler('getTabs', async () => {
  return await tabHandlers.getTabs();
});

wsConnection.registerCommandHandler('selectTab', async (params) => {
  return await tabHandlers.selectTab(params);
});

wsConnection.registerCommandHandler('createTab', async (params) => {
  return await tabHandlers.createTab(params);
});

wsConnection.registerCommandHandler('closeTab', async () => {
  return await tabHandlers.closeTab();
});

wsConnection.registerCommandHandler('openTestPage', async () => {
  // Open test page in new window
  const testPageUrl = 'https://blueprint-mcp.railsblueprint.com/test-page';
  const window = await chrome.windows.create({
    url: testPageUrl,
    type: 'normal',
    width: 1200,
    height: 900
  });

  return {
    success: true,
    url: testPageUrl,
    windowId: window.id,
    tabId: window.tabs[0].id
  };
});

wsConnection.registerCommandHandler('forwardCDPCommand', async (params) => {
  return await handleCDPCommand(params.method, params.params);
});

wsConnection.registerCommandHandler('reloadExtensions', async (params) => {
  const extensionName = params?.extensionName;
  const currentExtensionId = chrome.runtime.id;

  // Get all extensions
  const extensions = await chrome.management.getAll();
  const reloadedNames = [];

  for (const ext of extensions) {
    if (ext.type === 'extension' && ext.enabled) {
      // If specific extension requested, only reload that one
      if (extensionName && ext.name !== extensionName) {
        continue;
      }

      try {
        // Special handling for reloading ourselves
        if (ext.id === currentExtensionId) {
          logger.log(`Reloading self using runtime.reload()...`);
          // Use runtime.reload() for self-reload
          // This triggers a reload without disabling the extension
          chrome.runtime.reload();
          reloadedNames.push(ext.name);
        } else {
          // For other extensions, use management API
          await chrome.management.setEnabled(ext.id, false);
          await chrome.management.setEnabled(ext.id, true);
          reloadedNames.push(ext.name);
        }
      } catch (e) {
        logger.log(`Could not reload ${ext.name}:`, e.message);
      }
    }
  }

  return {
    reloaded: reloadedNames,
    extensions: extensions.filter(e => e.type === 'extension').map(e => e.name)
  };
});

wsConnection.registerCommandHandler('getNetworkRequests', async () => {
  return { requests: networkTracker.getRequests() };
});

wsConnection.registerCommandHandler('clearTracking', async () => {
  networkTracker.clearRequests();
  return { success: true };
});

wsConnection.registerCommandHandler('getConsoleMessages', async () => {
  // Only return messages from the currently attached tab
  const attachedTabId = tabHandlers.getAttachedTabId();
  const messages = attachedTabId ? consoleHandler.getMessages(attachedTabId) : [];
  return { messages };
});

wsConnection.registerCommandHandler('clearConsoleMessages', async () => {
  consoleHandler.clearMessages();
  return { success: true };
});

wsConnection.registerCommandHandler('listExtensions', async () => {
  try {
    const extensions = await chrome.management.getAll();

    // Filter to only include extensions (not apps or themes)
    const extensionsList = extensions
      .filter(ext => ext.type === 'extension')
      .map(ext => ({
        id: ext.id,
        name: ext.name,
        version: ext.version,
        enabled: ext.enabled,
        description: ext.description || ''
      }));

    return { extensions: extensionsList };
  } catch (error) {
    throw new Error(`List extensions failed: ${error.message}`);
  }
});

// Listen for page navigation to re-inject console capture and dialog overrides
chrome.webNavigation.onCompleted.addListener(async (details) => {
  const attachedTabId = tabHandlers.getAttachedTabId();
  if (details.tabId === attachedTabId && details.frameId === 0) {
    logger.log('[Background] Page loaded, re-injecting console capture and dialog overrides');
    await consoleHandler.injectConsoleCapture(details.tabId);
    await dialogHandler.setupDialogOverrides(details.tabId);
  }
});

// Listen for storage changes (enable/disable from popup)
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.extensionEnabled) {
    const isEnabled = changes.extensionEnabled.newValue !== false;
    logger.logAlways('[Background] Extension enabled state changed:', isEnabled);

    if (isEnabled) {
      // Connect
      logger.logAlways('[Background] Connecting to MCP server...');
      await wsConnection.connect();
    } else {
      // Disconnect
      logger.logAlways('[Background] Disconnecting from MCP server...');
      wsConnection.disconnect();
    }
  }
});

// Check if extension is enabled before connecting on startup
const storage = await chrome.storage.local.get(['extensionEnabled']);
const isEnabled = storage.extensionEnabled !== false; // default to true if not set

if (isEnabled) {
  // Connect to MCP server on startup
  await wsConnection.connect();
} else {
  logger.log('[Background] Extension is disabled, not connecting');
}

// End of main initialization
})();
