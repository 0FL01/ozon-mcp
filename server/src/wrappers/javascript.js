/**
 * JavaScript Client Library Template
 */

const template = `/**
 * Blueprint MCP Client Library for JavaScript
 *
 * Auto-generated client library for Blueprint MCP script mode.
 * Methods match tool names exactly for easy code generation.
 *
 * Usage:
 *   import { BlueprintMCP } from './blueprint_mcp.mjs';
 *
 *   const bp = new BlueprintMCP();
 *   await bp.enable({ client_id: 'my-script' });
 *   const tabs = await bp.browser_tabs({ action: 'list' });
 *   bp.close();
 *
 * PRO Mode with multiple browsers:
 *   const bp = new BlueprintMCP();
 *   // Auto-connect to first available browser
 *   await bp.enable({ client_id: 'my-script', auto_connect: true });
 *
 *   // Or auto-connect to a specific browser by name
 *   await bp.enable({ client_id: 'my-script', auto_connect: 'Chrome' });
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

export class BlueprintMCP {
  #proc = null;
  #rl = null;
  #id = 0;
  #debug = false;
  #pending = new Map();

  /**
   * Initialize Blueprint MCP client.
   * @param {Object} options
   * @param {boolean} options.debug - Enable debug output
   */
  constructor(options = {}) {
    this.#debug = options.debug || false;

    this.#proc = spawn('npx', ['@railsblueprint/blueprint-mcp', '--script-mode'], {
      stdio: ['pipe', 'pipe', this.#debug ? 'inherit' : 'ignore']
    });

    this.#rl = createInterface({
      input: this.#proc.stdout,
      terminal: false
    });

    this.#rl.on('line', (line) => {
      if (this.#debug) console.error('[BlueprintMCP] <-', line);

      try {
        const response = JSON.parse(line);
        if (response.id && this.#pending.has(response.id)) {
          const { resolve, reject } = this.#pending.get(response.id);
          this.#pending.delete(response.id);

          if (response.error) {
            reject(new Error(response.error.message || 'Unknown error'));
          } else {
            resolve(response.result);
          }
        }
      } catch (e) {
        console.error('[BlueprintMCP] Parse error:', e);
      }
    });
  }

  async _call(method, params = {}) {
    const id = ++this.#id;
    const request = { jsonrpc: '2.0', id, method, params };

    if (this.#debug) console.error('[BlueprintMCP] ->', JSON.stringify(request));

    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#proc.stdin.write(JSON.stringify(request) + '\\n');
    });
  }

  /**
   * Enable browser automation and connect to the browser.
   *
   * In PRO mode with multiple browsers, use auto_connect to automatically
   * select a browser without needing to call browser_connect() separately.
   *
   * @param {Object} params
   * @param {string} params.client_id - Human-readable identifier for this client
   * @param {boolean|string} params.auto_connect - Auto-connect behavior:
   *   - false (default): Return browser list, require manual browser_connect()
   *   - true: Automatically connect to the first available browser
   *   - string: Automatically connect to browser matching this name (case-insensitive)
   * @param {boolean} params.force_free - Force free mode even if PRO authenticated
   * @returns {Promise<Object>} Connection status with success, state, mode, browser fields
   *
   * @example
   * // Simple usage (free mode or PRO with single browser)
   * await bp.enable({ client_id: 'my-script' });
   *
   * // PRO mode - auto-connect to first browser
   * await bp.enable({ client_id: 'my-script', auto_connect: true });
   *
   * // PRO mode - auto-connect to specific browser
   * await bp.enable({ client_id: 'my-script', auto_connect: 'Chrome' });
   */
  async enable(params = {}) {
    const { auto_connect, ...enableParams } = params;
    let result = await this._call('enable', enableParams);

    // Handle auto-connect for PRO mode with multiple browsers
    if (auto_connect && result.multiple_browsers) {
      const browsers = result.browsers || [];
      if (browsers.length > 0) {
        let targetId = browsers[0].id; // Default to first browser

        // If auto_connect is a string, find browser by name
        if (typeof auto_connect === 'string') {
          const autoConnectLower = auto_connect.toLowerCase();
          for (const browser of browsers) {
            const browserName = (browser.name || '').toLowerCase();
            if (browserName.includes(autoConnectLower)) {
              targetId = browser.id;
              break;
            }
          }
        }

        // Connect to the selected browser
        const connectResult = await this._call('browser_connect', { browser_id: targetId });
        // Merge the connect result into the enable result
        result = { ...result, ...connectResult, auto_connected: true, auto_connected_browser_id: targetId };
      }
    }

    return result;
  }

  /**
   * Disable browser automation and return to passive mode.
   * @returns {Promise<Object>} { success: boolean, state: 'passive' }
   */
  async disable() {
    return this._call('disable');
  }

  /**
   * Check current connection status.
   * @returns {Promise<Object>} { state, mode, browser, attached_tab }
   */
  async status() {
    return this._call('status');
  }

  /**
   * List all available browsers connected to the relay (PRO mode only).
   * @returns {Promise<Object>} { browsers: Array<{id, name, version}> }
   */
  async browser_list() {
    return this._call('browser_list');
  }

  /**
   * Connect to a specific browser (PRO mode only).
   * @param {Object} params
   * @param {string} params.browser_id - Browser extension ID from enable() result
   * @returns {Promise<Object>} Connection status
   */
  async browser_connect(params) {
    return this._call('browser_connect', params);
  }

  /**
   * Manage browser tabs.
   * @param {Object} params
   * @param {string} params.action - 'list' | 'new' | 'attach' | 'close'
   * @param {string} [params.url] - URL to navigate to (for 'new' action)
   * @param {number} [params.index] - Tab index (for 'attach'/'close' actions)
   * @param {boolean} [params.activate] - Bring tab to foreground
   * @param {boolean} [params.stealth] - Enable stealth mode
   * @returns {Promise<Object>} { tabs, success, index }
   *
   * @example
   * // List all tabs
   * const { tabs } = await bp.browser_tabs({ action: 'list' });
   *
   * // Create new tab
   * await bp.browser_tabs({ action: 'new', url: 'https://example.com' });
   *
   * // Attach to existing tab
   * await bp.browser_tabs({ action: 'attach', index: 0 });
   */
  async browser_tabs(params) {
    return this._call('browser_tabs', params);
  }

  /**
   * Navigate in the browser.
   * @param {Object} params
   * @param {string} params.action - 'url' | 'back' | 'forward' | 'reload' | 'test_page'
   * @param {string} [params.url] - URL to navigate to (required when action='url')
   * @returns {Promise<Object>} { success, url }
   *
   * @example
   * await bp.browser_navigate({ action: 'url', url: 'https://example.com' });
   * await bp.browser_navigate({ action: 'back' });
   */
  async browser_navigate(params) {
    return this._call('browser_navigate', params);
  }

  /**
   * Perform browser interactions in sequence.
   * @param {Object} params
   * @param {Array<Object>} params.actions - Array of action objects with type, selector, text, etc.
   * @param {string} [params.onError='stop'] - 'stop' or 'ignore'
   * @returns {Promise<Object>} { success, results }
   *
   * @example
   * await bp.browser_interact({
   *   actions: [
   *     { type: 'click', selector: '#login-btn' },
   *     { type: 'type', selector: '#username', text: 'user@example.com' },
   *     { type: 'press_key', key: 'Enter' }
   *   ]
   * });
   */
  async browser_interact(params) {
    return this._call('browser_interact', params);
  }

  /**
   * Get accessible DOM snapshot of the page.
   * @returns {Promise<Object>} { snapshot }
   */
  async browser_snapshot() {
    return this._call('browser_snapshot');
  }

  /**
   * Search for elements by text content.
   * @param {Object} params
   * @param {string} params.text - Text to search for
   * @param {number} [params.limit=10] - Maximum results
   * @returns {Promise<Object>} { elements: Array<{selector, text, tag, visible}> }
   *
   * @example
   * const { elements } = await bp.browser_lookup({ text: 'Submit' });
   * await bp.browser_interact({ actions: [{ type: 'click', selector: elements[0].selector }] });
   */
  async browser_lookup(params) {
    return this._call('browser_lookup', params);
  }

  /**
   * Capture screenshot of the page.
   * @param {Object} [params]
   * @param {string} [params.type='jpeg'] - 'png' or 'jpeg'
   * @param {boolean} [params.fullPage=false] - Capture full page
   * @param {number} [params.quality=80] - JPEG quality 0-100
   * @param {string} [params.path] - File path to save screenshot
   * @param {string} [params.selector] - CSS selector for partial screenshot
   * @param {number} [params.padding=0] - Padding around selector
   * @param {number} [params.deviceScale] - Scale factor
   * @returns {Promise<Object>} { success, data, path, width, height }
   */
  async browser_take_screenshot(params = {}) {
    return this._call('browser_take_screenshot', params);
  }

  /**
   * Execute JavaScript in page context.
   * @param {Object} params
   * @param {string} [params.expression] - JavaScript expression to evaluate
   * @param {string} [params.function] - JavaScript function to execute
   * @returns {Promise<Object>} { success, value }
   *
   * @example
   * // Simple value
   * const { value: title } = await bp.browser_evaluate({ expression: 'document.title' });
   *
   * // Object extraction (use JSON.stringify for complex objects)
   * const { value } = await bp.browser_evaluate({
   *   expression: 'JSON.stringify({title: document.title, url: location.href})'
   * });
   * const data = JSON.parse(value);
   */
  async browser_evaluate(params) {
    return this._call('browser_evaluate', params);
  }

  /**
   * Get console messages from the page.
   * @param {Object} [params]
   * @param {string} [params.level] - Filter by level: 'log', 'warn', 'error', 'info', 'debug'
   * @param {string} [params.text] - Filter messages containing this text
   * @param {string} [params.url] - Filter by URL
   * @param {number} [params.limit=50] - Maximum messages
   * @param {number} [params.offset=0] - Skip messages
   * @returns {Promise<Object>} { messages, total }
   */
  async browser_console_messages(params = {}) {
    return this._call('browser_console_messages', params);
  }

  /**
   * Monitor and replay network requests.
   * @param {Object} [params]
   * @param {string} [params.action='list'] - 'list', 'details', 'replay', or 'clear'
   * @param {string} [params.urlPattern] - Filter by URL substring
   * @param {string} [params.method] - Filter by HTTP method
   * @param {number} [params.status] - Filter by status code
   * @param {string} [params.requestId] - Request ID for details/replay
   * @param {string} [params.jsonPath] - JSONPath filter for large responses
   * @param {number} [params.limit=20] - Max requests
   * @param {number} [params.offset=0] - Pagination offset
   * @returns {Promise<Object>} Request data based on action
   */
  async browser_network_requests(params = {}) {
    return this._call('browser_network_requests', params);
  }

  /**
   * Fill multiple form fields at once.
   * @param {Object} params
   * @param {Array<{selector: string, value: string}>} params.fields - Fields to fill
   * @returns {Promise<Object>} { success }
   *
   * @example
   * await bp.browser_fill_form({
   *   fields: [
   *     { selector: '#email', value: 'user@example.com' },
   *     { selector: '#password', value: 'secret123' }
   *   ]
   * });
   */
  async browser_fill_form(params) {
    return this._call('browser_fill_form', params);
  }

  /**
   * Drag element to another element.
   * @param {Object} params
   * @param {string} params.fromSelector - Source element CSS selector
   * @param {string} params.toSelector - Target element CSS selector
   * @returns {Promise<Object>} { success }
   */
  async browser_drag(params) {
    return this._call('browser_drag', params);
  }

  /**
   * Manage browser window.
   * @param {Object} params
   * @param {string} params.action - 'resize', 'close', 'minimize', or 'maximize'
   * @param {number} [params.width] - Window width (for resize)
   * @param {number} [params.height] - Window height (for resize)
   * @returns {Promise<Object>} { success }
   */
  async browser_window(params) {
    return this._call('browser_window', params);
  }

  /**
   * Verify text is visible on page.
   * @param {Object} params
   * @param {string} params.text - Text to find
   * @returns {Promise<Object>} { visible, selector }
   */
  async browser_verify_text_visible(params) {
    return this._call('browser_verify_text_visible', params);
  }

  /**
   * Verify element is visible on page.
   * @param {Object} params
   * @param {string} params.selector - CSS selector
   * @returns {Promise<Object>} { visible }
   */
  async browser_verify_element_visible(params) {
    return this._call('browser_verify_element_visible', params);
  }

  /**
   * Get CSS styles for an element.
   * @param {Object} params
   * @param {string} params.selector - CSS selector
   * @param {string} [params.property] - Filter to specific CSS property
   * @param {Array<string>} [params.pseudoState] - Force pseudo-states like ['hover', 'focus']
   * @returns {Promise<Object>} CSS style information
   */
  async browser_get_element_styles(params) {
    return this._call('browser_get_element_styles', params);
  }

  /**
   * Extract page content as clean markdown.
   * @param {Object} [params]
   * @param {string} [params.mode='auto'] - 'auto', 'full', or 'selector'
   * @param {string} [params.selector] - CSS selector (when mode='selector')
   * @param {number} [params.max_lines=500] - Maximum lines
   * @param {number} [params.offset=0] - Start line
   * @returns {Promise<Object>} { content }
   */
  async browser_extract_content(params = {}) {
    return this._call('browser_extract_content', params);
  }

  /**
   * Save page as PDF.
   * @param {Object} params
   * @param {string} params.path - File path to save PDF
   * @returns {Promise<Object>} { success, path }
   */
  async browser_pdf_save(params) {
    return this._call('browser_pdf_save', params);
  }

  /**
   * Handle alert/confirm/prompt dialog.
   * @param {Object} params
   * @param {boolean} params.accept - Accept or dismiss the dialog
   * @param {string} [params.text] - Text for prompt dialogs
   * @returns {Promise<Object>} { success }
   */
  async browser_handle_dialog(params) {
    return this._call('browser_handle_dialog', params);
  }

  /**
   * List installed browser extensions.
   * @returns {Promise<Object>} { extensions }
   */
  async browser_list_extensions() {
    return this._call('browser_list_extensions');
  }

  /**
   * Reload unpacked/development browser extensions.
   * @param {Object} [params]
   * @param {string} [params.extensionName] - Specific extension to reload
   * @returns {Promise<Object>} { success }
   */
  async browser_reload_extensions(params = {}) {
    return this._call('browser_reload_extensions', params);
  }

  /**
   * Get performance metrics for current page (Web Vitals).
   * @returns {Promise<Object>} Performance metrics
   */
  async browser_performance_metrics() {
    return this._call('browser_performance_metrics');
  }

  /**
   * Manage Blueprint MCP PRO authentication.
   * @param {Object} params
   * @param {string} params.action - 'login', 'logout', or 'status'
   * @returns {Promise<Object>} Authentication status
   */
  async auth(params) {
    return this._call('auth', params);
  }

  close() {
    if (this.#proc) {
      try {
        this.#proc.stdin.end();
        this.#proc.kill();
      } catch (e) {
        // Ignore
      }
      this.#proc = null;
    }
  }
}
`;

/**
 * Generate a JavaScript method for a tool (fallback for unknown tools)
 * @param {string} toolName - Tool name (e.g., 'browser_tabs')
 * @returns {string} JavaScript method code
 */
function generateMethod(toolName) {
  // These methods are already defined with full JSDoc in the template
  const definedMethods = [
    'enable', 'disable', 'status', 'browser_list', 'browser_connect',
    'browser_tabs', 'browser_navigate', 'browser_interact', 'browser_snapshot',
    'browser_lookup', 'browser_take_screenshot', 'browser_evaluate',
    'browser_console_messages', 'browser_network_requests', 'browser_fill_form',
    'browser_drag', 'browser_window', 'browser_verify_text_visible',
    'browser_verify_element_visible', 'browser_get_element_styles',
    'browser_extract_content', 'browser_pdf_save', 'browser_handle_dialog',
    'browser_list_extensions', 'browser_reload_extensions',
    'browser_performance_metrics', 'auth'
  ];

  // Skip methods that are already defined in the template
  if (definedMethods.includes(toolName)) {
    return '';
  }

  // Generate fallback method for any new tools
  return `  /**
   * Call ${toolName} tool.
   * @param {Object} [params] - Tool parameters
   * @returns {Promise<Object>}
   */
  async ${toolName}(params = {}) {
    return this._call('${toolName}', params);
  }
`;
}

module.exports = {
  template,
  generateMethod
};
