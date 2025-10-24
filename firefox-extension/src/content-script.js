// Content script to capture console messages and forward to background
// Listens for console messages from page and sends to extension

// Logging utility
function log(...args) {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  console.log(`[Blueprint MCP for Firefox] ${time} [Content Script]`, ...args);
}

window.addEventListener('message', (event) => {
  // Only accept messages from same origin
  if (event.source !== window) return;

  // Check if it's a console message
  if (event.data && event.data.__blueprintConsole) {
    // Forward to background script
    browser.runtime.sendMessage({
      type: 'console_message',
      data: event.data.__blueprintConsole
    }).catch(err => {
      // Ignore errors if background isn't listening
    });
  }
});

// Watch for OAuth login tokens on mcp-for-chrome.railsblueprint.com
// The login page puts tokens in DOM with class 'mcp-extension-tokens'
const observer = new MutationObserver(() => {
  // Check for focus request
  const focusElement = document.querySelector('.mcp-extension-focus-tab');
  if (focusElement) {
    log('Focus request detected, focusing tab...');
    browser.runtime.sendMessage({ type: 'focusTab' });
    // Don't disconnect - we still need to watch for tokens
  }

  // Check for tokens
  const tokenElement = document.querySelector('.mcp-extension-tokens');
  if (tokenElement) {
    const accessToken = tokenElement.getAttribute('data-access-token');
    const refreshToken = tokenElement.getAttribute('data-refresh-token');

    if (accessToken && refreshToken) {
      log('Found tokens in DOM, sending to background...');

      // Send to background script
      browser.runtime.sendMessage({
        type: 'loginSuccess',
        accessToken: accessToken,
        refreshToken: refreshToken
      }).then((response) => {
        log('Response from background:', response);

        // Close the window after successful token save
        setTimeout(() => {
          window.close();
        }, 500);
      });

      // Stop observing
      observer.disconnect();
    }
  }
});

// Start observing the document for changes
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

log('Ready to watch for login tokens');
