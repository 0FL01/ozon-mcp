/**
 * Content script that reads tokens from login page DOM
 */

// Watch for a div with class 'mcp-extension-tokens' containing data attributes
const observer = new MutationObserver(() => {
  // Check for focus request
  const focusElement = document.querySelector('.mcp-extension-focus-tab');
  if (focusElement) {
    console.log('[Content Script] Focus request detected, focusing tab...');
    chrome.runtime.sendMessage({ type: 'focusTab' });
    // Don't disconnect - we still need to watch for tokens
  }

  // Check for tokens
  const tokenElement = document.querySelector('.mcp-extension-tokens');
  if (tokenElement) {
    const accessToken = tokenElement.getAttribute('data-access-token');
    const refreshToken = tokenElement.getAttribute('data-refresh-token');

    if (accessToken && refreshToken) {
      console.log('[Content Script] Found tokens in DOM, sending to background...');

      // Send to background script
      chrome.runtime.sendMessage({
        type: 'loginSuccess',
        accessToken: accessToken,
        refreshToken: refreshToken
      }, (response) => {
        console.log('[Content Script] Response from background:', response);

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

console.log('[Content Script] Ready to watch for login tokens');

// Tech stack detection
interface TechStack {
  frameworks: string[];
  libraries: string[];
  css: string[];
  devTools: string[];
  spa: boolean;
  autoReload: boolean;
  obfuscatedCSS: boolean;
}

function detectTechStack(): TechStack {
  const stack: TechStack = {
    frameworks: [],
    libraries: [],
    css: [],
    devTools: [],
    spa: false,
    autoReload: false,
    obfuscatedCSS: false
  };

  try {
    // JS Frameworks
    // React - check global object, dev tools hook, or mount point patterns
    if ((window as any).React ||
        (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
        document.getElementById('root') ||
        document.getElementById('react-root') ||
        document.querySelector('[id^="mount_"]')) {
      stack.frameworks.push('React');
      stack.spa = true;
    }
    if ((window as any).Vue || (window as any).__VUE__ || (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__) {
      stack.frameworks.push('Vue');
      stack.spa = true;
    }
    if ((window as any).ng || typeof (window as any).getAllAngularRootElements === 'function') {
      stack.frameworks.push('Angular');
      stack.spa = true;
    }
    // Turbo/Hotwire - check multiple sources
    if ((window as any).Turbo ||
        document.querySelector('turbo-frame') ||
        document.querySelector('meta[name="turbo-cache-control"]') ||
        (() => {
          try {
            const importmap = document.querySelector('script[type="importmap"]');
            return importmap?.textContent && (importmap.textContent.includes('@hotwired/turbo') || importmap.textContent.includes('turbo'));
          } catch(e) { return false; }
        })()) {
      stack.frameworks.push('Turbo');
      stack.spa = true;
    }
    if ((window as any).__NEXT_DATA__) {
      stack.frameworks.push('Next.js');
      stack.spa = true;
    }
    if (document.querySelector('[data-svelte]') || (window as any).__SVELTE__) {
      stack.frameworks.push('Svelte');
      stack.spa = true;
    }
    if ((window as any).Ember) {
      stack.frameworks.push('Ember');
      stack.spa = true;
    }
    // Google Wiz - Google's internal web components framework
    if (document.querySelector('c-wiz') || document.querySelector('c-data')) {
      stack.frameworks.push('Google Wiz');
      stack.spa = true;
    }
    // Polymer - Google's web components library (used on YouTube, etc.)
    if ((window as any).Polymer ||
        document.querySelector('iron-iconset-svg') ||
        document.querySelector('ytd-app') ||
        document.querySelector('[is^="iron-"], [is^="paper-"], [is^="ytd-"]')) {
      stack.frameworks.push('Polymer');
      stack.spa = true;
    }

    // JS Libraries
    if ((window as any).jQuery || (window as any).$) {
      stack.libraries.push('jQuery');
    }
    if ((window as any).htmx) {
      stack.libraries.push('htmx');
    }
    if ((window as any).Stimulus || document.querySelector('[data-controller]')) {
      stack.libraries.push('Stimulus');
    }
    if ((window as any).Alpine || document.querySelector('[x-data]')) {
      stack.libraries.push('Alpine.js');
    }
    if ((window as any)._ && (window as any)._.VERSION) {
      stack.libraries.push('Lodash');
    }
    if ((window as any).moment) {
      stack.libraries.push('Moment.js');
    }

    // CSS Frameworks - check DOM elements and attributes
    if (document.querySelector('.container') &&
        (document.querySelector('[class*="col-"]') || document.querySelector('[data-bs-]'))) {
      stack.css.push('Bootstrap');
    }
    // Tailwind - check for distinctive patterns (avoid Bootstrap false positives)
    // Tailwind has color utilities with numbers like text-blue-500, bg-red-600
    // and standalone flex/grid (not Bootstrap's d-flex/d-grid)
    const hasTailwindColors = document.querySelector('[class*="text-"][class*="-500"], [class*="bg-"][class*="-600"], [class*="text-"][class*="-400"], [class*="bg-"][class*="-700"]');
    const hasTailwindUtilities = document.querySelector('[class*="w-full"], [class*="h-screen"], [class*="space-x-"], [class*="divide-"]');
    const bodyClasses = document.body.className;
    const hasStandaloneFlex = bodyClasses && bodyClasses.split(/\s+/).some(cls => cls === 'flex' || cls === 'grid' || cls === 'hidden' || cls === 'block');

    if (hasTailwindColors || hasTailwindUtilities || hasStandaloneFlex) {
      stack.css.push('Tailwind');
    }
    if (document.querySelector('[class*="Mui"]') || (window as any).MaterialUI) {
      stack.css.push('Material-UI');
    }
    if (document.querySelector('.button.is-primary') || document.querySelector('.card.is-fullwidth')) {
      stack.css.push('Bulma');
    }
    // Ant Design - check for actual component classes (avoid false positives like "assistant")
    if (document.querySelector('[class^="ant-"], [class*=" ant-"]')) {
      stack.css.push('Ant Design');
    }

    // Dev Tools / Auto-reload
    // Hotwire Spark - check multiple sources
    if ((window as any).Spark ||
        document.querySelector('script[src*="hotwire_spark"]') ||
        document.querySelector('script[src*="hotwire-spark"]') ||
        (() => {
          try {
            const importmap = document.querySelector('script[type="importmap"]');
            return importmap?.textContent && (importmap.textContent.includes('@hotwired/spark') || importmap.textContent.includes('hotwire_spark'));
          } catch(e) { return false; }
        })()) {
      stack.devTools.push('Hotwire Spark');
      stack.autoReload = true;
    }
    if ((window as any).__vite__ || ((window as any).import && (window as any).import.meta && (window as any).import.meta.hot)) {
      stack.devTools.push('Vite HMR');
      stack.autoReload = true;
    }
    if ((window as any).webpackHotUpdate || ((window as any).module && (window as any).module.hot)) {
      stack.devTools.push('Webpack HMR');
      stack.autoReload = true;
    }
    if ((window as any).parcelHotUpdate) {
      stack.devTools.push('Parcel HMR');
      stack.autoReload = true;
    }
    if ((window as any).LiveReload) {
      stack.devTools.push('LiveReload');
      stack.autoReload = true;
    }

    // Check for obfuscated CSS (helps AI know not to guess class names)
    // Common patterns: _x1a2b, __xyz123, single underscore + random chars
    // Reuse bodyClasses from Tailwind detection above
    if (bodyClasses && bodyClasses.match(/\b_[a-z0-9]{4,}\b/)) {
      stack.obfuscatedCSS = true;
    }

  } catch (error) {
    console.error('[Content Script] Error detecting tech stack:', error);
  }

  return stack;
}

// Run detection on load
function sendTechStackDetection() {
  const stack = detectTechStack();
  console.log('[Content Script] Detected tech stack:', stack);

  chrome.runtime.sendMessage({
    type: 'techStackDetected',
    stack: stack,
    url: window.location.href
  }).catch(() => {
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
    console.log('[Content Script] URL changed, re-detecting tech stack');
    setTimeout(sendTechStackDetection, 200); // Give SPA time to render
  }
}).observe(document, { subtree: true, childList: true });

// Also listen for navigation events
window.addEventListener('popstate', () => {
  console.log('[Content Script] Popstate event, re-detecting tech stack');
  setTimeout(sendTechStackDetection, 200);
});

// Listen for Turbo navigation
if ((window as any).Turbo) {
  document.addEventListener('turbo:load', () => {
    console.log('[Content Script] Turbo load event, re-detecting tech stack');
    setTimeout(sendTechStackDetection, 100);
  });
}
