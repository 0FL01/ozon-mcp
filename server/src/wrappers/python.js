/**
 * Python Client Library Template
 */

const template = `#!/usr/bin/env python3
"""
Blueprint MCP Client Library for Python

Auto-generated client library for Blueprint MCP script mode.
Methods match tool names exactly for easy code generation.

Usage:
    from blueprint_mcp import BlueprintMCP

    bp = BlueprintMCP()
    bp.enable(client_id='my-script')
    tabs = bp.browser_tabs(action='list')
    bp.close()

PRO Mode with multiple browsers:
    bp = BlueprintMCP()
    # Auto-connect to first available browser
    bp.enable(client_id='my-script', auto_connect=True)

    # Or auto-connect to a specific browser by name
    bp.enable(client_id='my-script', auto_connect='Chrome')
"""

import subprocess
import json
import sys
from typing import Optional, Union


class BlueprintMCP:
    """Blueprint MCP client for Python scripts."""

    def __init__(self, debug: bool = False):
        """
        Initialize Blueprint MCP client.

        Args:
            debug: Enable debug output to stderr
        """
        self._debug = debug
        self._id = 0
        self._proc = subprocess.Popen(
            ['npx', '@railsblueprint/blueprint-mcp', '--script-mode'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=None if debug else subprocess.DEVNULL,
            text=True,
            bufsize=1
        )

    def _call(self, method: str, **params) -> dict:
        """Send a JSON-RPC request and return the result."""
        self._id += 1
        request = {
            'jsonrpc': '2.0',
            'id': self._id,
            'method': method,
            'params': params
        }

        if self._debug:
            print(f'[BlueprintMCP] -> {json.dumps(request)}', file=sys.stderr)

        self._proc.stdin.write(json.dumps(request) + '\\n')
        self._proc.stdin.flush()

        response_line = self._proc.stdout.readline()
        if not response_line:
            raise RuntimeError('No response from server')

        if self._debug:
            print(f'[BlueprintMCP] <- {response_line.strip()}', file=sys.stderr)

        response = json.loads(response_line)

        if 'error' in response:
            raise RuntimeError(response['error'].get('message', 'Unknown error'))

        return response.get('result')

    def enable(self, client_id: str, auto_connect: Union[bool, str] = False, force_free: bool = False) -> dict:
        """
        Enable browser automation and connect to the browser.

        In PRO mode with multiple browsers, use auto_connect to automatically
        select a browser without needing to call browser_connect() separately.

        Args:
            client_id: Human-readable identifier for this client (e.g., 'my-script')
            auto_connect: Auto-connect behavior for PRO mode with multiple browsers:
                - False (default): Return browser list, require manual browser_connect()
                - True: Automatically connect to the first available browser
                - str: Automatically connect to browser matching this name (case-insensitive)
            force_free: Force free mode (local standalone) even if PRO authenticated

        Returns:
            dict with connection status:
                - success: bool
                - state: 'connected' | 'active' | etc.
                - mode: 'pro' | 'free'
                - browser: str (connected browser name)
                - multiple_browsers: bool (True if PRO mode with multiple browsers)
                - browsers: list (available browsers when multiple_browsers=True)

        Example:
            # Simple usage (free mode or PRO with single browser)
            result = bp.enable(client_id='my-script')

            # PRO mode - auto-connect to first browser
            result = bp.enable(client_id='my-script', auto_connect=True)

            # PRO mode - auto-connect to specific browser
            result = bp.enable(client_id='my-script', auto_connect='Chrome')
        """
        result = self._call('enable', client_id=client_id, force_free=force_free)

        # Handle auto-connect for PRO mode with multiple browsers
        if auto_connect and result.get('multiple_browsers'):
            browsers = result.get('browsers', [])
            if browsers:
                target_id = browsers[0]['id']  # Default to first browser

                # If auto_connect is a string, find browser by name
                if isinstance(auto_connect, str):
                    auto_connect_lower = auto_connect.lower()
                    for browser in browsers:
                        browser_name = browser.get('name', '').lower()
                        if auto_connect_lower in browser_name:
                            target_id = browser['id']
                            break

                # Connect to the selected browser
                connect_result = self._call('browser_connect', browser_id=target_id)
                # Merge the connect result into the enable result
                result.update(connect_result)
                result['auto_connected'] = True
                result['auto_connected_browser_id'] = target_id

        return result

    def disable(self) -> dict:
        """
        Disable browser automation and return to passive mode.

        Closes browser extension connection. After this, browser_ tools
        will not work until you call enable() again.

        Returns:
            dict with:
                - success: bool
                - state: 'passive'
        """
        return self._call('disable')

    def status(self) -> dict:
        """
        Check current connection status.

        Returns:
            dict with:
                - state: 'passive' | 'active' | 'connected' | 'authenticated_waiting'
                - mode: 'pro' | 'free'
                - browser: str (connected browser name, if any)
                - attached_tab: dict (current tab info, if attached)
        """
        return self._call('status')

    def browser_list(self) -> dict:
        """
        List all available browsers connected to the relay (PRO mode only).

        Use this to see what browsers are available before calling
        browser_connect() to switch.

        Returns:
            dict with:
                - browsers: list of {id, name, version}
        """
        return self._call('browser_list')

    def browser_connect(self, browser_id: str) -> dict:
        """
        Connect to a specific browser (PRO mode only).

        Called after enable() returns a list of browsers to choose from.

        Args:
            browser_id: Browser extension ID from the list returned by enable()

        Returns:
            dict with connection status
        """
        return self._call('browser_connect', browser_id=browser_id)

    def browser_tabs(self, action: str, url: Optional[str] = None, index: Optional[int] = None,
                     activate: Optional[bool] = None, stealth: Optional[bool] = None) -> dict:
        """
        Manage browser tabs.

        Args:
            action: 'list' | 'new' | 'attach' | 'close'
            url: URL to navigate to (for 'new' action)
            index: Tab index (for 'attach'/'close' actions)
            activate: Bring tab to foreground (default: True for 'new', False for 'attach')
            stealth: Enable stealth mode to avoid bot detection

        Returns:
            dict with:
                - tabs: list (for 'list' action)
                - success: bool
                - index: int (for 'new'/'attach' actions)

        Example:
            # List all tabs
            tabs = bp.browser_tabs(action='list')

            # Create new tab
            bp.browser_tabs(action='new', url='https://example.com')

            # Attach to existing tab
            bp.browser_tabs(action='attach', index=0)
        """
        params = {'action': action}
        if url is not None:
            params['url'] = url
        if index is not None:
            params['index'] = index
        if activate is not None:
            params['activate'] = activate
        if stealth is not None:
            params['stealth'] = stealth
        return self._call('browser_tabs', **params)

    def browser_navigate(self, action: str, url: Optional[str] = None) -> dict:
        """
        Navigate in the browser.

        Args:
            action: 'url' | 'back' | 'forward' | 'reload' | 'test_page'
            url: URL to navigate to (required when action='url')

        Returns:
            dict with:
                - success: bool
                - url: str (current URL after navigation)

        Example:
            bp.browser_navigate(action='url', url='https://example.com')
            bp.browser_navigate(action='back')
        """
        params = {'action': action}
        if url is not None:
            params['url'] = url
        return self._call('browser_navigate', **params)

    def browser_interact(self, actions: list, on_error: str = 'stop') -> dict:
        """
        Perform browser interactions in sequence.

        Args:
            actions: List of action dicts, each with:
                - type: 'click' | 'type' | 'clear' | 'press_key' | 'hover' |
                        'wait' | 'mouse_move' | 'mouse_click' | 'scroll_to' |
                        'scroll_by' | 'scroll_into_view' | 'select_option' |
                        'file_upload' | 'force_pseudo_state'
                - selector: CSS selector (for most actions)
                - text: Text to type (for 'type' action)
                - key: Key to press (for 'press_key' action)
                - value: Option value/text (for 'select_option' action)
                - x, y: Coordinates (for mouse/scroll actions)
                - timeout: Timeout in ms (for 'wait' action)
            on_error: 'stop' (default) or 'ignore'

        Returns:
            dict with:
                - success: bool
                - results: list of action results

        Example:
            bp.browser_interact(actions=[
                {'type': 'click', 'selector': '#login-btn'},
                {'type': 'type', 'selector': '#username', 'text': 'user@example.com'},
                {'type': 'press_key', 'key': 'Enter'}
            ])
        """
        return self._call('browser_interact', actions=actions, onError=on_error)

    def browser_snapshot(self) -> dict:
        """
        Get accessible DOM snapshot of the page.

        Returns:
            dict with:
                - snapshot: str (formatted DOM tree)
        """
        return self._call('browser_snapshot')

    def browser_lookup(self, text: str, limit: int = 10) -> dict:
        """
        Search for elements by text content.

        Useful for finding the right selector before clicking.

        Args:
            text: Text to search for in elements
            limit: Maximum number of results (default: 10)

        Returns:
            dict with:
                - elements: list of {selector, text, tag, visible}

        Example:
            result = bp.browser_lookup(text='Submit')
            selector = result['elements'][0]['selector']
            bp.browser_interact(actions=[{'type': 'click', 'selector': selector}])
        """
        return self._call('browser_lookup', text=text, limit=limit)

    def browser_take_screenshot(self, **params) -> dict:
        """
        Capture screenshot of the page.

        Args:
            type: 'png' | 'jpeg' (default: 'jpeg')
            fullPage: Capture full page (default: False)
            quality: JPEG quality 0-100 (default: 80)
            path: File path to save screenshot (optional)
            selector: CSS selector to screenshot (partial)
            padding: Padding around selector (default: 0)
            deviceScale: Scale factor (1 for 1:1, 0 for native resolution)

        Returns:
            dict with:
                - success: bool
                - data: str (base64 encoded image, if no path)
                - path: str (saved file path, if path provided)
                - width, height: int (image dimensions)
        """
        return self._call('browser_take_screenshot', **params)

    def browser_evaluate(self, expression: str = None, function: str = None) -> dict:
        """
        Execute JavaScript in page context.

        Args:
            expression: JavaScript expression to evaluate
            function: JavaScript function to execute (will be wrapped and called)

        Returns:
            dict with:
                - success: bool
                - value: Any (result of evaluation)

        Note:
            Complex objects are serialized. For best results with objects,
            use JSON.stringify() wrapper:

        Example:
            # Simple value
            result = bp.browser_evaluate(expression='document.title')
            title = result['value']

            # Object extraction
            result = bp.browser_evaluate(
                expression='JSON.stringify({title: document.title, url: location.href})'
            )
            data = json.loads(result['value'])
        """
        params = {}
        if expression is not None:
            params['expression'] = expression
        if function is not None:
            params['function'] = function
        return self._call('browser_evaluate', **params)

    def browser_console_messages(self, level: str = None, text: str = None,
                                  url: str = None, limit: int = 50, offset: int = 0) -> dict:
        """
        Get console messages from the page.

        Args:
            level: Filter by level ('log', 'warn', 'error', 'info', 'debug')
            text: Filter messages containing this text
            url: Filter messages from URLs containing this text
            limit: Maximum messages to return (default: 50)
            offset: Number of messages to skip (default: 0)

        Returns:
            dict with:
                - messages: list of {level, text, url, timestamp}
                - total: int
        """
        params = {'limit': limit, 'offset': offset}
        if level is not None:
            params['level'] = level
        if text is not None:
            params['text'] = text
        if url is not None:
            params['url'] = url
        return self._call('browser_console_messages', **params)

    def browser_network_requests(self, action: str = 'list', **params) -> dict:
        """
        Monitor and replay network requests.

        Args:
            action: 'list' | 'details' | 'replay' | 'clear'
            urlPattern: Filter by URL substring (for 'list')
            method: Filter by HTTP method (for 'list')
            status: Filter by status code (for 'list')
            resourceType: Filter by type (for 'list')
            requestId: Request ID (for 'details'/'replay')
            jsonPath: JSONPath filter for large responses (for 'details')
            limit: Max requests to return (default: 20)
            offset: Pagination offset (default: 0)

        Returns:
            dict with request data based on action
        """
        params['action'] = action
        return self._call('browser_network_requests', **params)

    def browser_fill_form(self, fields: list) -> dict:
        """
        Fill multiple form fields at once.

        Args:
            fields: List of {selector: str, value: str}

        Returns:
            dict with:
                - success: bool

        Example:
            bp.browser_fill_form(fields=[
                {'selector': '#email', 'value': 'user@example.com'},
                {'selector': '#password', 'value': 'secret123'}
            ])
        """
        return self._call('browser_fill_form', fields=fields)

    def browser_drag(self, from_selector: str, to_selector: str) -> dict:
        """
        Drag element to another element.

        Args:
            from_selector: Source element CSS selector
            to_selector: Target element CSS selector

        Returns:
            dict with:
                - success: bool
        """
        return self._call('browser_drag', fromSelector=from_selector, toSelector=to_selector)

    def browser_window(self, action: str, width: int = None, height: int = None) -> dict:
        """
        Manage browser window.

        Args:
            action: 'resize' | 'close' | 'minimize' | 'maximize'
            width: Window width (required for 'resize')
            height: Window height (required for 'resize')

        Returns:
            dict with:
                - success: bool
        """
        params = {'action': action}
        if width is not None:
            params['width'] = width
        if height is not None:
            params['height'] = height
        return self._call('browser_window', **params)

    def browser_verify_text_visible(self, text: str) -> dict:
        """
        Verify text is visible on page.

        Args:
            text: Text to find

        Returns:
            dict with:
                - visible: bool
                - selector: str (if found)
        """
        return self._call('browser_verify_text_visible', text=text)

    def browser_verify_element_visible(self, selector: str) -> dict:
        """
        Verify element is visible on page.

        Args:
            selector: CSS selector

        Returns:
            dict with:
                - visible: bool
        """
        return self._call('browser_verify_element_visible', selector=selector)

    def browser_get_element_styles(self, selector: str, property: str = None,
                                    pseudo_state: list = None) -> dict:
        """
        Get CSS styles for an element.

        Args:
            selector: CSS selector for the element
            property: Filter to specific CSS property (optional)
            pseudo_state: Force pseudo-states like ['hover', 'focus'] (optional)

        Returns:
            dict with CSS style information
        """
        params = {'selector': selector}
        if property is not None:
            params['property'] = property
        if pseudo_state is not None:
            params['pseudoState'] = pseudo_state
        return self._call('browser_get_element_styles', **params)

    def browser_extract_content(self, mode: str = 'auto', selector: str = None,
                                 max_lines: int = 500, offset: int = 0) -> dict:
        """
        Extract page content as clean markdown.

        Args:
            mode: 'auto' | 'full' | 'selector' (default: 'auto')
            selector: CSS selector (required when mode='selector')
            max_lines: Maximum lines to extract (default: 500)
            offset: Line number to start from (default: 0)

        Returns:
            dict with:
                - content: str (markdown content)
        """
        params = {'mode': mode, 'max_lines': max_lines, 'offset': offset}
        if selector is not None:
            params['selector'] = selector
        return self._call('browser_extract_content', **params)

    def browser_pdf_save(self, path: str) -> dict:
        """
        Save page as PDF.

        Args:
            path: File path to save PDF

        Returns:
            dict with:
                - success: bool
                - path: str
        """
        return self._call('browser_pdf_save', path=path)

    def browser_handle_dialog(self, accept: bool, text: str = None) -> dict:
        """
        Handle alert/confirm/prompt dialog.

        Args:
            accept: Accept (True) or dismiss (False) the dialog
            text: Text to enter for prompt dialogs

        Returns:
            dict with:
                - success: bool
        """
        params = {'accept': accept}
        if text is not None:
            params['text'] = text
        return self._call('browser_handle_dialog', **params)

    def browser_list_extensions(self) -> dict:
        """
        List installed browser extensions.

        Returns:
            dict with:
                - extensions: list of extension info
        """
        return self._call('browser_list_extensions')

    def browser_reload_extensions(self, extension_name: str = None) -> dict:
        """
        Reload unpacked/development browser extensions.

        Args:
            extension_name: Specific extension to reload (optional)

        Returns:
            dict with:
                - success: bool
        """
        params = {}
        if extension_name is not None:
            params['extensionName'] = extension_name
        return self._call('browser_reload_extensions', **params)

    def browser_performance_metrics(self) -> dict:
        """
        Get performance metrics for current page.

        Returns Web Vitals: FCP, LCP, CLS, TTFB, and other metrics.

        Returns:
            dict with performance metrics
        """
        return self._call('browser_performance_metrics')

    def auth(self, action: str) -> dict:
        """
        Manage Blueprint MCP PRO authentication.

        Args:
            action: 'login' | 'logout' | 'status'

        Returns:
            dict with authentication status
        """
        return self._call('auth', action=action)

    def close(self):
        """Close the connection and terminate the server."""
        if self._proc:
            try:
                self._proc.stdin.close()
                self._proc.terminate()
                self._proc.wait(timeout=5)
            except Exception:
                self._proc.kill()
            self._proc = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
        return False
`;

/**
 * Generate a Python method for a tool (fallback for unknown tools)
 * @param {string} toolName - Tool name (e.g., 'browser_tabs')
 * @returns {string} Python method code
 */
function generateMethod(toolName) {
  // These methods are already defined with full docstrings in the template
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
  return `    def ${toolName}(self, **params):
        """Call ${toolName} tool."""
        return self._call('${toolName}', **params)
`;
}

module.exports = {
  template,
  generateMethod
};
