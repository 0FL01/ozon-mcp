/**
 * Ruby Client Library Template
 */

const template = `#!/usr/bin/env ruby
# frozen_string_literal: true

#
# Blueprint MCP Client Library for Ruby
#
# Auto-generated client library for Blueprint MCP script mode.
# Methods match tool names exactly for easy code generation.
#
# Usage:
#   require_relative 'blueprint_mcp'
#
#   bp = BlueprintMCP.new
#   bp.enable(client_id: 'my-script')
#   tabs = bp.browser_tabs(action: 'list')
#   bp.close
#
# PRO Mode with multiple browsers:
#   bp = BlueprintMCP.new
#   # Auto-connect to first available browser
#   bp.enable(client_id: 'my-script', auto_connect: true)
#
#   # Or auto-connect to a specific browser by name
#   bp.enable(client_id: 'my-script', auto_connect: 'Chrome')
#

require 'json'
require 'open3'

class BlueprintMCP
  # Initialize Blueprint MCP client.
  #
  # @param debug [Boolean] Enable debug output to stderr
  def initialize(debug: false)
    @debug = debug
    @id = 0
    @stdin, @stdout, @stderr, @wait_thr = Open3.popen3(
      'npx', '@railsblueprint/blueprint-mcp', '--script-mode'
    )
  end

  # Send a JSON-RPC request and return the result.
  # @api private
  def _call(method, **params)
    @id += 1
    request = {
      jsonrpc: '2.0',
      id: @id,
      method: method,
      params: params
    }

    warn "[BlueprintMCP] -> #{request.to_json}" if @debug

    @stdin.puts(request.to_json)
    @stdin.flush

    response_line = @stdout.gets
    raise 'No response from server' unless response_line

    warn "[BlueprintMCP] <- #{response_line.strip}" if @debug

    response = JSON.parse(response_line, symbolize_names: true)

    raise response[:error][:message] || 'Unknown error' if response[:error]

    response[:result]
  end

  # Enable browser automation and connect to the browser.
  #
  # In PRO mode with multiple browsers, use auto_connect to automatically
  # select a browser without needing to call browser_connect() separately.
  #
  # @param client_id [String] Human-readable identifier for this client
  # @param auto_connect [Boolean, String] Auto-connect behavior:
  #   - false (default): Return browser list, require manual browser_connect()
  #   - true: Automatically connect to the first available browser
  #   - String: Automatically connect to browser matching this name (case-insensitive)
  # @param force_free [Boolean] Force free mode even if PRO authenticated
  # @return [Hash] Connection status with :success, :state, :mode, :browser keys
  #
  # @example Simple usage (free mode or PRO with single browser)
  #   bp.enable(client_id: 'my-script')
  #
  # @example PRO mode - auto-connect to first browser
  #   bp.enable(client_id: 'my-script', auto_connect: true)
  #
  # @example PRO mode - auto-connect to specific browser
  #   bp.enable(client_id: 'my-script', auto_connect: 'Chrome')
  def enable(client_id:, auto_connect: false, force_free: false)
    result = _call('enable', client_id: client_id, force_free: force_free)

    # Handle auto-connect for PRO mode with multiple browsers
    if auto_connect && result[:multiple_browsers]
      browsers = result[:browsers] || []
      unless browsers.empty?
        target_id = browsers[0][:id] # Default to first browser

        # If auto_connect is a string, find browser by name
        if auto_connect.is_a?(String)
          auto_connect_lower = auto_connect.downcase
          browsers.each do |browser|
            browser_name = (browser[:name] || '').downcase
            if browser_name.include?(auto_connect_lower)
              target_id = browser[:id]
              break
            end
          end
        end

        # Connect to the selected browser
        connect_result = _call('browser_connect', browser_id: target_id)
        # Merge the connect result into the enable result
        result = result.merge(connect_result)
        result[:auto_connected] = true
        result[:auto_connected_browser_id] = target_id
      end
    end

    result
  end

  # Disable browser automation and return to passive mode.
  #
  # @return [Hash] { success: Boolean, state: 'passive' }
  def disable
    _call('disable')
  end

  # Check current connection status.
  #
  # @return [Hash] { state:, mode:, browser:, attached_tab: }
  def status
    _call('status')
  end

  # List all available browsers connected to the relay (PRO mode only).
  #
  # @return [Hash] { browsers: Array<{id:, name:, version:}> }
  def browser_list
    _call('browser_list')
  end

  # Connect to a specific browser (PRO mode only).
  #
  # @param browser_id [String] Browser extension ID from enable() result
  # @return [Hash] Connection status
  def browser_connect(browser_id:)
    _call('browser_connect', browser_id: browser_id)
  end

  # Manage browser tabs.
  #
  # @param action [String] 'list', 'new', 'attach', or 'close'
  # @param url [String, nil] URL to navigate to (for 'new' action)
  # @param index [Integer, nil] Tab index (for 'attach'/'close' actions)
  # @param activate [Boolean, nil] Bring tab to foreground
  # @param stealth [Boolean, nil] Enable stealth mode
  # @return [Hash] { tabs:, success:, index: }
  #
  # @example List all tabs
  #   tabs = bp.browser_tabs(action: 'list')
  #
  # @example Create new tab
  #   bp.browser_tabs(action: 'new', url: 'https://example.com')
  #
  # @example Attach to existing tab
  #   bp.browser_tabs(action: 'attach', index: 0)
  def browser_tabs(action:, url: nil, index: nil, activate: nil, stealth: nil)
    params = { action: action }
    params[:url] = url unless url.nil?
    params[:index] = index unless index.nil?
    params[:activate] = activate unless activate.nil?
    params[:stealth] = stealth unless stealth.nil?
    _call('browser_tabs', **params)
  end

  # Navigate in the browser.
  #
  # @param action [String] 'url', 'back', 'forward', 'reload', or 'test_page'
  # @param url [String, nil] URL to navigate to (required when action='url')
  # @return [Hash] { success:, url: }
  #
  # @example
  #   bp.browser_navigate(action: 'url', url: 'https://example.com')
  #   bp.browser_navigate(action: 'back')
  def browser_navigate(action:, url: nil)
    params = { action: action }
    params[:url] = url unless url.nil?
    _call('browser_navigate', **params)
  end

  # Perform browser interactions in sequence.
  #
  # @param actions [Array<Hash>] Array of action hashes with :type, :selector, :text, etc.
  # @param on_error [String] 'stop' (default) or 'ignore'
  # @return [Hash] { success:, results: }
  #
  # @example
  #   bp.browser_interact(actions: [
  #     { type: 'click', selector: '#login-btn' },
  #     { type: 'type', selector: '#username', text: 'user@example.com' },
  #     { type: 'press_key', key: 'Enter' }
  #   ])
  def browser_interact(actions:, on_error: 'stop')
    _call('browser_interact', actions: actions, onError: on_error)
  end

  # Get accessible DOM snapshot of the page.
  #
  # @return [Hash] { snapshot: }
  def browser_snapshot
    _call('browser_snapshot')
  end

  # Search for elements by text content.
  #
  # @param text [String] Text to search for
  # @param limit [Integer] Maximum results (default: 10)
  # @return [Hash] { elements: Array<{selector:, text:, tag:, visible:}> }
  #
  # @example
  #   result = bp.browser_lookup(text: 'Submit')
  #   selector = result[:elements][0][:selector]
  def browser_lookup(text:, limit: 10)
    _call('browser_lookup', text: text, limit: limit)
  end

  # Capture screenshot of the page.
  #
  # @param type [String] 'png' or 'jpeg' (default: 'jpeg')
  # @param full_page [Boolean] Capture full page (default: false)
  # @param quality [Integer] JPEG quality 0-100 (default: 80)
  # @param path [String, nil] File path to save screenshot
  # @param selector [String, nil] CSS selector for partial screenshot
  # @param padding [Integer] Padding around selector (default: 0)
  # @param device_scale [Integer, nil] Scale factor
  # @return [Hash] { success:, data:, path:, width:, height: }
  def browser_take_screenshot(**params)
    _call('browser_take_screenshot', **params)
  end

  # Execute JavaScript in page context.
  #
  # @param expression [String, nil] JavaScript expression to evaluate
  # @param function [String, nil] JavaScript function to execute
  # @return [Hash] { success:, value: }
  #
  # @note Complex objects should use JSON.stringify() wrapper
  #
  # @example Simple value
  #   result = bp.browser_evaluate(expression: 'document.title')
  #   title = result[:value]
  #
  # @example Object extraction
  #   result = bp.browser_evaluate(
  #     expression: 'JSON.stringify({title: document.title, url: location.href})'
  #   )
  #   data = JSON.parse(result[:value])
  def browser_evaluate(expression: nil, function: nil)
    params = {}
    params[:expression] = expression unless expression.nil?
    params[:function] = function unless function.nil?
    _call('browser_evaluate', **params)
  end

  # Get console messages from the page.
  #
  # @param level [String, nil] Filter by level: 'log', 'warn', 'error', 'info', 'debug'
  # @param text [String, nil] Filter messages containing this text
  # @param url [String, nil] Filter by URL
  # @param limit [Integer] Maximum messages (default: 50)
  # @param offset [Integer] Skip messages (default: 0)
  # @return [Hash] { messages:, total: }
  def browser_console_messages(level: nil, text: nil, url: nil, limit: 50, offset: 0)
    params = { limit: limit, offset: offset }
    params[:level] = level unless level.nil?
    params[:text] = text unless text.nil?
    params[:url] = url unless url.nil?
    _call('browser_console_messages', **params)
  end

  # Monitor and replay network requests.
  #
  # @param action [String] 'list', 'details', 'replay', or 'clear' (default: 'list')
  # @param url_pattern [String, nil] Filter by URL substring
  # @param method [String, nil] Filter by HTTP method
  # @param status [Integer, nil] Filter by status code
  # @param request_id [String, nil] Request ID for details/replay
  # @param json_path [String, nil] JSONPath filter for large responses
  # @param limit [Integer] Max requests (default: 20)
  # @param offset [Integer] Pagination offset (default: 0)
  # @return [Hash] Request data based on action
  def browser_network_requests(action: 'list', **params)
    params[:action] = action
    _call('browser_network_requests', **params)
  end

  # Fill multiple form fields at once.
  #
  # @param fields [Array<Hash>] Array of { selector:, value: }
  # @return [Hash] { success: }
  #
  # @example
  #   bp.browser_fill_form(fields: [
  #     { selector: '#email', value: 'user@example.com' },
  #     { selector: '#password', value: 'secret123' }
  #   ])
  def browser_fill_form(fields:)
    _call('browser_fill_form', fields: fields)
  end

  # Drag element to another element.
  #
  # @param from_selector [String] Source element CSS selector
  # @param to_selector [String] Target element CSS selector
  # @return [Hash] { success: }
  def browser_drag(from_selector:, to_selector:)
    _call('browser_drag', fromSelector: from_selector, toSelector: to_selector)
  end

  # Manage browser window.
  #
  # @param action [String] 'resize', 'close', 'minimize', or 'maximize'
  # @param width [Integer, nil] Window width (for resize)
  # @param height [Integer, nil] Window height (for resize)
  # @return [Hash] { success: }
  def browser_window(action:, width: nil, height: nil)
    params = { action: action }
    params[:width] = width unless width.nil?
    params[:height] = height unless height.nil?
    _call('browser_window', **params)
  end

  # Verify text is visible on page.
  #
  # @param text [String] Text to find
  # @return [Hash] { visible:, selector: }
  def browser_verify_text_visible(text:)
    _call('browser_verify_text_visible', text: text)
  end

  # Verify element is visible on page.
  #
  # @param selector [String] CSS selector
  # @return [Hash] { visible: }
  def browser_verify_element_visible(selector:)
    _call('browser_verify_element_visible', selector: selector)
  end

  # Get CSS styles for an element.
  #
  # @param selector [String] CSS selector
  # @param property [String, nil] Filter to specific CSS property
  # @param pseudo_state [Array<String>, nil] Force pseudo-states like ['hover', 'focus']
  # @return [Hash] CSS style information
  def browser_get_element_styles(selector:, property: nil, pseudo_state: nil)
    params = { selector: selector }
    params[:property] = property unless property.nil?
    params[:pseudoState] = pseudo_state unless pseudo_state.nil?
    _call('browser_get_element_styles', **params)
  end

  # Extract page content as clean markdown.
  #
  # @param mode [String] 'auto', 'full', or 'selector' (default: 'auto')
  # @param selector [String, nil] CSS selector (when mode='selector')
  # @param max_lines [Integer] Maximum lines (default: 500)
  # @param offset [Integer] Start line (default: 0)
  # @return [Hash] { content: }
  def browser_extract_content(mode: 'auto', selector: nil, max_lines: 500, offset: 0)
    params = { mode: mode, max_lines: max_lines, offset: offset }
    params[:selector] = selector unless selector.nil?
    _call('browser_extract_content', **params)
  end

  # Save page as PDF.
  #
  # @param path [String] File path to save PDF
  # @return [Hash] { success:, path: }
  def browser_pdf_save(path:)
    _call('browser_pdf_save', path: path)
  end

  # Handle alert/confirm/prompt dialog.
  #
  # @param accept [Boolean] Accept or dismiss the dialog
  # @param text [String, nil] Text for prompt dialogs
  # @return [Hash] { success: }
  def browser_handle_dialog(accept:, text: nil)
    params = { accept: accept }
    params[:text] = text unless text.nil?
    _call('browser_handle_dialog', **params)
  end

  # List installed browser extensions.
  #
  # @return [Hash] { extensions: }
  def browser_list_extensions
    _call('browser_list_extensions')
  end

  # Reload unpacked/development browser extensions.
  #
  # @param extension_name [String, nil] Specific extension to reload
  # @return [Hash] { success: }
  def browser_reload_extensions(extension_name: nil)
    params = {}
    params[:extensionName] = extension_name unless extension_name.nil?
    _call('browser_reload_extensions', **params)
  end

  # Get performance metrics for current page (Web Vitals).
  #
  # @return [Hash] Performance metrics
  def browser_performance_metrics
    _call('browser_performance_metrics')
  end

  # Manage Blueprint MCP PRO authentication.
  #
  # @param action [String] 'login', 'logout', or 'status'
  # @return [Hash] Authentication status
  def auth(action:)
    _call('auth', action: action)
  end

  # Close the connection and terminate the server.
  def close
    return unless @stdin

    begin
      @stdin.close
      @stdout.close
      @stderr.close
      Process.kill('TERM', @wait_thr.pid)
    rescue StandardError
      # Ignore cleanup errors
    end

    @stdin = nil
  end
end
`;

/**
 * Generate a Ruby method for a tool (fallback for unknown tools)
 * @param {string} toolName - Tool name (e.g., 'browser_tabs')
 * @returns {string} Ruby method code
 */
function generateMethod(toolName) {
  // These methods are already defined with full YARD docs in the template
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
  return `  # Call ${toolName} tool.
  # @param params [Hash] Tool parameters
  # @return [Hash]
  def ${toolName}(**params)
    _call('${toolName}', **params)
  end
`;
}

module.exports = {
  template,
  generateMethod
};
