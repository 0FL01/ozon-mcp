/**
 * Stealth Injection Script
 * 
 * This script is injected into the page to hide automation indicators
 * and make the browser appear as a regular user browser.
 * 
 * Injected via Page.addScriptToEvaluateOnNewDocument in background-module.js
 */

(function () {
    'use strict';

    // 1. Hide navigator.webdriver
    // This is the most common detection method
    try {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true
        });
    } catch (e) {
        // Already defined or protected
    }

    // 2. Mock plugins if empty (headless detection)
    if (navigator.plugins.length === 0) {
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                {
                    0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format" },
                    description: "Portable Document Format",
                    filename: "internal-pdf-viewer",
                    length: 1,
                    name: "Chrome PDF Plugin"
                },
                {
                    0: { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format" },
                    description: "Portable Document Format",
                    filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                    length: 1,
                    name: "Chrome PDF Viewer"
                },
                {
                    0: { type: "application/x-nacl", suffixes: "", description: "Native Client Executable" },
                    1: { type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable" },
                    description: "",
                    filename: "internal-nacl-plugin",
                    length: 2,
                    name: "Native Client"
                }
            ]
        });
    }

    // 3. Mock languages if suspicious
    if (navigator.languages.length === 0) {
        Object.defineProperty(navigator, 'languages', {
            get: () => ['ru-RU', 'ru', 'en-US', 'en']
        });
    }

    // 4. Override permissions query to avoid headless detection
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
    );

    // 5. Mock chrome runtime (some sites check for extension)
    // But we need to be careful not to break our own extension communication
    if (!window.chrome || !window.chrome.runtime) {
        window.chrome = window.chrome || {};
        window.chrome.runtime = window.chrome.runtime || {};
    }

    // 6. Add realistic screen properties
    // Some bots have unusual screen dimensions
    if (screen.width === 0 || screen.height === 0) {
        Object.defineProperty(screen, 'width', { get: () => 1920 });
        Object.defineProperty(screen, 'height', { get: () => 1080 });
        Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
    }

    // 7. Mock battery API (headless browsers often don't have it)
    if (!navigator.getBattery) {
        navigator.getBattery = () => Promise.resolve({
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 1,
            addEventListener: () => { },
            removeEventListener: () => { },
            dispatchEvent: () => true
        });
    }

    // 8. Override toString methods to hide modifications
    const toStringOverride = (obj, name) => {
        const handler = {
            apply: function (target, ctx, args) {
                return name;
            }
        };
        obj.toString = new Proxy(obj.toString, handler);
    };

    // Apply toString overrides
    if (navigator.webdriver !== undefined) {
        toStringOverride(Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver').get, 'function get webdriver() { [native code] }');
    }

    // 9. Hide Automation Extension
    // Some detection scripts look for automation-related extensions
    const originalGetExtensions = chrome?.runtime?.getManifest;
    if (originalGetExtensions) {
        chrome.runtime.getManifest = function () {
            const manifest = originalGetExtensions.apply(this, arguments);
            // Don't expose automation-related keys
            if (manifest && manifest.name && manifest.name.includes('Automation')) {
                manifest.name = 'Chrome Extension';
            }
            return manifest;
        };
    }

    console.log('[Stealth] Anti-detection measures applied');
})();
