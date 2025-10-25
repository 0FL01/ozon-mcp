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

// Tech stack detection
function detectTechStack() {
  const stack = {
    frameworks: [],
    libraries: [],
    css: [],
    devTools: [],
    spa: false,
    autoReload: false
  };

  try {
    // JS Frameworks
    if (window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      stack.frameworks.push('React');
      stack.spa = true;
    }
    if (window.Vue || window.__VUE__ || window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
      stack.frameworks.push('Vue');
      stack.spa = true;
    }
    if (window.ng || (typeof window.getAllAngularRootElements === 'function')) {
      stack.frameworks.push('Angular');
      stack.spa = true;
    }
    if (window.Turbo) {
      stack.frameworks.push('Turbo');
      stack.spa = true;
    }
    if (window.__NEXT_DATA__) {
      stack.frameworks.push('Next.js');
      stack.spa = true;
    }
    if (document.querySelector('[data-svelte]') || window.__SVELTE__) {
      stack.frameworks.push('Svelte');
      stack.spa = true;
    }
    if (window.Ember) {
      stack.frameworks.push('Ember');
      stack.spa = true;
    }

    // JS Libraries
    if (window.jQuery || window.$) {
      stack.libraries.push('jQuery');
    }
    if (window.htmx) {
      stack.libraries.push('htmx');
    }
    if (window.Stimulus || document.querySelector('[data-controller]')) {
      stack.libraries.push('Stimulus');
    }
    if (window.Alpine || document.querySelector('[x-data]')) {
      stack.libraries.push('Alpine.js');
    }
    if (window._ && window._.VERSION) {
      stack.libraries.push('Lodash');
    }
    if (window.moment) {
      stack.libraries.push('Moment.js');
    }

    // CSS Frameworks - check DOM elements and attributes
    if (document.querySelector('.container') &&
        (document.querySelector('[class*="col-"]') || document.querySelector('[data-bs-]'))) {
      stack.css.push('Bootstrap');
    }
    // Tailwind - check for common utility classes
    const bodyClasses = document.body.className;
    if (bodyClasses && (
        bodyClasses.match(/\b(flex|grid|p-\d+|m-\d+|text-\w+-\d+|bg-\w+-\d+)\b/) ||
        document.querySelector('[class*="flex "]') ||
        document.querySelector('[class*="grid "]')
      )) {
      // More specific check for Tailwind patterns
      const allElements = document.querySelectorAll('[class*="p-"], [class*="m-"], [class*="text-"], [class*="bg-"]');
      if (allElements.length > 5) {
        stack.css.push('Tailwind');
      }
    }
    if (document.querySelector('[class*="Mui"]') || window.MaterialUI) {
      stack.css.push('Material-UI');
    }
    if (document.querySelector('.button.is-primary') || document.querySelector('.card.is-fullwidth')) {
      stack.css.push('Bulma');
    }
    if (document.querySelector('[class*="ant-"]')) {
      stack.css.push('Ant Design');
    }

    // Dev Tools / Auto-reload
    if (window.Spark) {
      stack.devTools.push('Hotwire Spark');
      stack.autoReload = true;
    }
    if (window.__vite__ || (window.import && window.import.meta && window.import.meta.hot)) {
      stack.devTools.push('Vite HMR');
      stack.autoReload = true;
    }
    if (window.webpackHotUpdate || (window.module && window.module.hot)) {
      stack.devTools.push('Webpack HMR');
      stack.autoReload = true;
    }
    if (window.parcelHotUpdate) {
      stack.devTools.push('Parcel HMR');
      stack.autoReload = true;
    }
    if (window.LiveReload) {
      stack.devTools.push('LiveReload');
      stack.autoReload = true;
    }

  } catch (error) {
    log('Error detecting tech stack:', error);
  }

  return stack;
}

// Run detection on load
function sendTechStackDetection() {
  const stack = detectTechStack();
  log('Detected tech stack:', stack);

  browser.runtime.sendMessage({
    type: 'techStackDetected',
    stack: stack,
    url: window.location.href
  }).catch(err => {
    // Ignore errors if background isn't listening
  });
}

// Initial detection after page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(sendTechStackDetection, 100);
  });
} else {
  // Already loaded
  setTimeout(sendTechStackDetection, 100);
}

// Watch for URL changes (SPA navigation)
let lastUrl = window.location.href;
new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    log('URL changed, re-detecting tech stack');
    setTimeout(sendTechStackDetection, 200); // Give SPA time to render
  }
}).observe(document, { subtree: true, childList: true });

// Also listen for navigation events
window.addEventListener('popstate', () => {
  log('Popstate event, re-detecting tech stack');
  setTimeout(sendTechStackDetection, 200);
});

// Listen for Turbo navigation
if (window.Turbo) {
  document.addEventListener('turbo:load', () => {
    log('Turbo load event, re-detecting tech stack');
    setTimeout(sendTechStackDetection, 100);
  });
}
