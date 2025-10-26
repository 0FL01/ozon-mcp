/**
 * Copyright (c) 2024 Rails Blueprint
 * Originally inspired by Microsoft's Playwright MCP
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { RelayConnection, debugLog } from './relayConnection';
import { getUserInfoFromStorage, getDefaultBrowserName, getMillisecondsUntilRefresh, decodeJWT, refreshAccessToken } from './utils/jwt';
import * as logger from './utils/logger';

type PageMessage = {
  type: 'connectToMCPRelay';
  mcpRelayUrl: string;
} | {
  type: 'getTabs';
} | {
  type: 'connectToTab';
  tabId?: number;  // Optional: if not provided, lazy tab attachment mode
  windowId?: number;
  mcpRelayUrl: string;
} | {
  type: 'getConnectionStatus';
} | {
  type: 'disconnect';
} | {
  type: 'loginSuccess';
  accessToken: string;
  refreshToken: string;
} | {
  type: 'focusTab';
} | {
  type: 'techStackDetected';
  stack: {
    frameworks: string[];
    libraries: string[];
    css: string[];
    devTools: string[];
    spa: boolean;
    autoReload: boolean;
  };
  url: string;
};

class TabShareExtension {
  private _activeConnection: RelayConnection | undefined;
  private _connectedTabId: number | null = null;
  private _stealthMode: boolean | null = null; // null = N/A, true = On, false = Off
  private _projectName: string | null = null; // Connected project name
  private _pendingTabSelection = new Map<number, { connection: RelayConnection, timerId?: number }>();
  private _autoConnecting: boolean = false;
  private _autoConnectAttempts: number = 0;
  private _maxAutoConnectAttempts: number = 3; // Stop auto-retrying after 3 failed attempts
  private _logs: Array<{ timestamp: number; message: string }> = [];
  private _maxLogs = 100;
  private _tokenRefreshTimer: number | null = null;
  private _techStackInfo: Record<number, any> = {}; // Stores detected tech stack per tab

  constructor() {
    logger.debug('Service worker starting, registering listeners...');

    chrome.tabs.onRemoved.addListener(this._onTabRemoved.bind(this));
    chrome.tabs.onUpdated.addListener(this._onTabUpdated.bind(this));
    chrome.tabs.onActivated.addListener(this._onTabActivated.bind(this));
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
    chrome.storage.onChanged.addListener(this._onStorageChanged.bind(this));

    // Handle reconnect and keepalive alarms (survives service worker suspension)
    if (chrome.alarms) {
      logger.debug('Registering chrome.alarms.onAlarm listener...');
      chrome.alarms.onAlarm.addListener((alarm) => {
        logger.debug('Alarm fired:', alarm.name);
        if (alarm.name === 'reconnect') {
          logger.log('Reconnect alarm fired - attempting to reconnect...');
          this._autoConnect();
        } else if (alarm.name === 'keepalive') {
          // Keepalive alarm to prevent service worker suspension
          // Just logging keeps the service worker active
          logger.debug('Keepalive alarm fired - service worker kept alive');
        }
      });
    } else {
      logger.error('chrome.alarms API not available in constructor!');
    }

    // Initialize extension as enabled by default
    chrome.storage.local.get(['extensionEnabled'], (result) => {
      if (result.extensionEnabled === undefined) {
        chrome.storage.local.set({ extensionEnabled: true });
      }
    });

    // Set initial gray icon
    this._updateGlobalIcon(false);

    // Start token refresh monitoring
    this._scheduleTokenRefresh();

    // Auto-connect to MCP server on startup (will set icon based on connection result)
    this._autoConnect();
  }

  private async _autoConnect(): Promise<void> {
    if (this._autoConnecting) {
      logger.debug('Auto-connect already in progress, skipping');
      return;
    }

    // Check if extension is enabled before attempting to connect
    const isEnabled = await new Promise<boolean>((resolve) => {
      chrome.storage.local.get(['extensionEnabled'], (result) => {
        resolve(result.extensionEnabled !== false);
      });
    });

    if (!isEnabled) {
      logger.debug('Extension is disabled, skipping auto-connect');
      return;
    }

    this._autoConnecting = true;
    this._autoConnectAttempts++;

    // List all alarms for debugging
    if (chrome.alarms) {
      chrome.alarms.getAll((alarms) => {
        logger.debug('Current alarms:', alarms.map(a => a.name));
      });
    }

    // Check if user has PRO account with connection URL
    const userInfo = await getUserInfoFromStorage();
    let mcpRelayUrl: string;

    if (userInfo && userInfo.connectionUrl) {
      // PRO user: use connection URL from JWT token
      mcpRelayUrl = userInfo.connectionUrl;
    } else {
      // Free user: use local port
      const port = await new Promise<string>((resolve) => {
        chrome.storage.local.get(['mcpPort'], (result) => {
          resolve(result.mcpPort || '5555');
        });
      });
      mcpRelayUrl = `ws://127.0.0.1:${port}/extension`;
    }

    logger.debug(`Auto-connect attempt #${this._autoConnectAttempts} to ${mcpRelayUrl}`);

    try {
      await this._connectToRelay(0, mcpRelayUrl);
      // Connect in lazy mode (no specific tab, tab will be selected on first command)
      await this._connectTab(0, undefined, undefined, mcpRelayUrl);
      this._autoConnecting = false;
      this._autoConnectAttempts = 0; // Reset counter on success
      await this._updateGlobalIcon(true);
      this._broadcastStatusChange();

      // Start keepalive alarm to prevent service worker suspension (every 20 seconds)
      if (chrome.alarms) {
        chrome.alarms.create('keepalive', { periodInMinutes: 20 / 60 });
        logger.debug('Keepalive alarm started');
      }

      logger.log('Auto-connect SUCCESSFUL');
    } catch (error: any) {
      this._autoConnecting = false;
      await this._updateGlobalIcon(false);
      logger.log(`Auto-connect FAILED (attempt #${this._autoConnectAttempts}): ${error.message}`);

      // Keep retrying forever every 1 second using chrome.alarms (survives service worker suspension)
      if (chrome.alarms) {
        logger.debug('Creating reconnect alarm after auto-connect failure...');
        chrome.alarms.create('reconnect', { delayInMinutes: 1 / 60 }, () => {
          chrome.alarms.get('reconnect', (alarm) => {
            if (alarm) {
              logger.debug('Reconnect alarm created successfully:', alarm);
            } else {
              logger.error('Reconnect alarm was NOT created!');
            }
          });
        });
      } else {
        logger.error('chrome.alarms API not available!');
      }
    }
  }

  private async _isExtensionEnabled(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['extensionEnabled'], (result) => {
        resolve(result.extensionEnabled !== false); // Default to true
      });
    });
  }

  // Promise-based message handling is not supported in Chrome: https://issues.chromium.org/issues/40753031
  private _onMessage(message: PageMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    switch (message.type) {
      case 'connectToMCPRelay':
        // Use tab ID if called from tab, or 0 if called from popup
        const sourceId = sender.tab?.id ?? 0;
        this._connectToRelay(sourceId, message.mcpRelayUrl).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'getTabs':
        this._getTabs().then(
            tabs => sendResponse({ success: true, tabs, currentTabId: sender.tab?.id }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'connectToTab':
        // If no tabId specified, connect in lazy mode (tab will be created/selected on first command)
        const tabId = message.tabId;
        const windowId = message.windowId;
        this._connectTab(sender.tab!.id!, tabId, windowId, message.mcpRelayUrl!).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true; // Return true to indicate that the response will be sent asynchronously
      case 'getConnectionStatus':
        sendResponse({
          connectedTabId: this._connectedTabId,
          connected: this._activeConnection !== undefined,
          stealthMode: this._stealthMode,
          projectName: this._projectName
        });
        return false;
      case 'disconnect':
        this._disconnect().then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'loginSuccess':
        chrome.storage.local.set({
          accessToken: message.accessToken,
          refreshToken: message.refreshToken,
          isPro: true
        }, () => {
          sendResponse({ success: true });
        });
        return true;
      case 'focusTab':
        if (sender.tab?.id) {
          chrome.tabs.update(sender.tab.id, { active: true }, () => {
            sendResponse({ success: true });
          });
        } else {
          sendResponse({ success: false, error: 'No tab ID' });
        }
        return true;
      case 'techStackDetected':
        if (sender.tab?.id) {
          this._techStackInfo[sender.tab.id] = message.stack;
          logger.debug('[Background] Tech stack detected for tab', sender.tab.id, ':', message.stack);

          // If this is the connected tab, notify RelayConnection
          if (sender.tab.id === this._connectedTabId && this._activeConnection) {
            this._activeConnection.updateTechStack(message.stack);
          }
        }
        return false;
    }
    return false;
  }

  private async _connectToRelay(selectorTabId: number, mcpRelayUrl: string): Promise<void> {
    try {
      // Show connecting badge (yellow)
      await this._updateConnectingBadge();

      const enabled = await this._isExtensionEnabled();
      if (!enabled) {
        throw new Error('Extension is disabled. Please enable it from the extension popup.');
      }

      // Get browser name, access token, and refresh token from storage
      let { browserName, accessToken, refreshToken } = await new Promise<{browserName: string; accessToken?: string; refreshToken?: string}>((resolve) => {
        chrome.storage.local.get(['browserName', 'accessToken', 'refreshToken'], (result) => {
          resolve({
            browserName: result.browserName || getDefaultBrowserName(),
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
          });
        });
      });

      // Check if token is expired
      if (accessToken) {
        const payload = decodeJWT(accessToken);
        const now = Math.floor(Date.now() / 1000);
        const isExpired = payload && payload.exp && payload.exp < now;

        console.log('[Background] Token check - Expired:', isExpired, 'Expires:', payload?.exp, 'Now:', now);

        // If token is expired, try to refresh it
        if (isExpired && refreshToken) {
          console.log('[Background] Access token expired, refreshing...');
          try {
            const newTokens = await refreshAccessToken(refreshToken);
            // Store new tokens
            await new Promise<void>((resolve) => {
              chrome.storage.local.set({
                accessToken: newTokens.access_token,
                refreshToken: newTokens.refresh_token
              }, () => resolve());
            });
            console.log('[Background] Token refreshed successfully');
            // Use the new token
            accessToken = newTokens.access_token;
          } catch (error: any) {
            console.error('[Background] Token refresh failed:', error.message);
            // Clear invalid tokens
            await new Promise<void>((resolve) => {
              chrome.storage.local.remove(['accessToken', 'refreshToken', 'isPro'], () => resolve());
            });
            throw new Error('Authentication failed: Token expired and refresh failed. Please login again.');
          }
        } else if (isExpired) {
          console.log('[Background] Token expired and no refresh token available');
          await new Promise<void>((resolve) => {
            chrome.storage.local.remove(['accessToken', 'refreshToken', 'isPro'], () => resolve());
          });
          throw new Error('Authentication failed: Token expired. Please login again.');
        }
      }

      const socket = new WebSocket(mcpRelayUrl);
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error('WebSocket error'));
        socket.onclose = (event) => {
          // Server rejected the connection (e.g., "Another extension connection already established")
          reject(new Error(`WebSocket closed: ${event.reason || 'Unknown reason'}`));
        };
        // Reduced timeout from 5s to 2s for faster retries
        setTimeout(() => reject(new Error('Connection timeout')), 2000);
      });

      const connection = new RelayConnection(socket, browserName, accessToken);
      connection.onclose = () => {
        this._pendingTabSelection.delete(selectorTabId);
        // Reset to normal icon when disconnected
        this._setGlobalIcon('normal', 'Disconnected from MCP server');
      };
      connection.onStealthModeSet = (stealth: boolean) => {
        this._stealthMode = stealth;
        this._broadcastStatusChange();
        // Update icon based on stealth mode
        if (this._activeConnection) {
          this._updateIconForAttachedTab();
        }
      };
      connection.onProjectConnected = (projectName: string) => {
        this._projectName = projectName;
        this._broadcastStatusChange();
      };
      connection.onConnectionStatus = (status: { max_connections: number; connections_used: number; connections_to_this_browser: number }) => {
        this._handleConnectionStatus(status);
      };
      this._pendingTabSelection.set(selectorTabId, { connection });

      // Update icon to show connected (will be replaced when tab is attached)
      await this._setGlobalIcon('connected', 'Connected to MCP server');
    } catch (error: any) {
      // Reset to normal icon on error
      await this._setGlobalIcon('normal', 'Connection failed');
      throw new Error(`Failed to connect to MCP relay: ${error.message}`);
    }
  }

  private async _connectTab(selectorTabId: number, tabId: number | undefined, windowId: number | undefined, mcpRelayUrl: string): Promise<void> {
    try {
      try {
        this._activeConnection?.close('Another connection is requested');
      } catch (error: any) {
        // Ignore errors when closing previous connection
      }
      await this._setConnectedTabId(null);

      this._activeConnection = this._pendingTabSelection.get(selectorTabId)?.connection;
      if (!this._activeConnection)
        throw new Error('No active MCP relay connection');
      this._pendingTabSelection.delete(selectorTabId);

      // Set up stealth mode callback for active connection
      this._activeConnection.onStealthModeSet = (stealth: boolean) => {
        this._stealthMode = stealth;
        // Update badge to reflect stealth mode
        if (this._connectedTabId) {
          void this._updateBadgeForTab(this._connectedTabId);
        }
        this._broadcastStatusChange();
      };

      // Set up project connection callback
      this._activeConnection.onProjectConnected = (projectName: string) => {
        this._projectName = projectName;
        this._broadcastStatusChange();
      };

      // Set up connection status callback
      this._activeConnection.onConnectionStatus = (status: { max_connections: number; connections_used: number; connections_to_this_browser: number }) => {
        this._handleConnectionStatus(status);
      };

      // Set up tab connection callback
      this._activeConnection.onTabConnected = (tabId: number) => {
        void this._setConnectedTabId(tabId);
        void this._updateGlobalIcon(true);
        this._broadcastStatusChange();

        // If we have tech stack info for this tab, pass it to the connection
        if (this._techStackInfo[tabId]) {
          this._activeConnection?.updateTechStack(this._techStackInfo[tabId]);
        }
      };

      // Lazy connection mode: resolve the tab promise without setting tabId
      // The tab will be created when first command arrives
      if (tabId) {
        this._activeConnection.setTabId(tabId);
        await Promise.all([
          this._setConnectedTabId(tabId),
          chrome.tabs.update(tabId, { active: true }),
          chrome.windows.update(windowId!, { focused: true }),
        ]);
      } else {
        // Lazy mode: signal that we're ready, tab will be created on first command
        this._activeConnection.setTabId(undefined as any);
      }

      this._activeConnection.onclose = () => {
        logger.log('Connection closed - auto-reconnecting in 1 second');
        this._activeConnection = undefined;
        this._stealthMode = null;
        this._projectName = null;
        void this._setConnectedTabId(null);
        void this._updateGlobalIcon(false);
        this._broadcastStatusChange();
        // Auto-reconnect after connection loss using chrome.alarms (survives service worker suspension)
        if (chrome.alarms) {
          logger.debug('Creating reconnect alarm...');
          chrome.alarms.create('reconnect', { delayInMinutes: 1 / 60 }, () => {
            // Verify alarm was created
            chrome.alarms.get('reconnect', (alarm) => {
              if (alarm) {
                logger.debug('Reconnect alarm created successfully:', alarm);
              } else {
                logger.error('Reconnect alarm was NOT created!');
              }
            });
          });
        } else {
          logger.error('chrome.alarms API not available!');
        }
      };
    } catch (error: any) {
      await this._setConnectedTabId(null);
      throw error;
    }
  }

  private async _setConnectedTabId(tabId: number | null): Promise<void> {
    const oldTabId = this._connectedTabId;
    this._connectedTabId = tabId;
    if (oldTabId && oldTabId !== tabId)
      await this._updateBadge(oldTabId, { text: '' });
    if (tabId)
      await this._updateBadgeForTab(tabId);
  }

  private async _updateBadgeForTab(tabId: number): Promise<void> {
    await this._updateIconForAttachedTab();
  }

  private async _updateIconForAttachedTab(): Promise<void> {
    const state = this._stealthMode ? 'attached-stealth' : 'attached';
    const title = this._stealthMode ? 'Tab automated (Stealth Mode)' : 'Tab automated';
    await this._setGlobalIcon(state, title);
  }

  private async _updateBadge(tabId: number, { text, color, title }: { text: string; color?: string, title?: string }): Promise<void> {
    try {
      await chrome.action.setBadgeText({ tabId, text });
      await chrome.action.setTitle({ tabId, title: title || '' });
      if (color)
        await chrome.action.setBadgeBackgroundColor({ tabId, color });
    } catch (error: any) {
      // Ignore errors as the tab may be closed already.
    }
  }

  private async _updateGlobalBadge({ text, color, title }: { text: string; color?: string, title?: string }): Promise<void> {
    try {
      await chrome.action.setBadgeText({ text });
      if (color)
        await chrome.action.setBadgeBackgroundColor({ color });
      if (title)
        await chrome.action.setTitle({ title });
      console.log('[Background] Global badge updated:', text, color, title);
    } catch (error: any) {
      console.error('[Background] Failed to update global badge:', error);
    }
  }

  private async _updateConnectingBadge(): Promise<void> {
    await this._setGlobalIcon('connecting', 'Connecting to MCP server...');
  }

  private async _setGlobalIcon(state: string, title?: string): Promise<void> {
    try {
      const iconPaths = state === 'connecting'
        ? {
            '16': '/icons/icon-16-connecting.png',
            '32': '/icons/icon-32-connecting.png',
            '48': '/icons/icon-48-connecting.png',
            '128': '/icons/icon-128-connecting.png'
          }
        : state === 'connected'
        ? {
            '16': '/icons/icon-16-connected.png',
            '32': '/icons/icon-32-connected.png',
            '48': '/icons/icon-48-connected.png',
            '128': '/icons/icon-128-connected.png'
          }
        : state === 'attached'
        ? {
            '16': '/icons/icon-16-attached.png',
            '32': '/icons/icon-32-attached.png',
            '48': '/icons/icon-48-attached.png',
            '128': '/icons/icon-128-attached.png'
          }
        : state === 'attached-stealth'
        ? {
            '16': '/icons/icon-16-attached-stealth.png',
            '32': '/icons/icon-32-attached-stealth.png',
            '48': '/icons/icon-48-attached-stealth.png',
            '128': '/icons/icon-128-attached-stealth.png'
          }
        : {
            '16': '/icons/icon-16.png',
            '32': '/icons/icon-32.png',
            '48': '/icons/icon-48.png',
            '128': '/icons/icon-128.png'
          };

      await chrome.action.setIcon({ path: iconPaths });
      if (title) {
        await chrome.action.setTitle({ title });
      }
      console.log('[Background] Icon updated:', state);
    } catch (error: any) {
      console.error('[Background] Failed to update icon:', error);
    }
  }

  private async _updateGlobalIcon(connected: boolean): Promise<void> {
    try {
      const iconPath = connected ? {
        "16": "/icons/icon-16.png",
        "32": "/icons/icon-32.png",
        "48": "/icons/icon-48.png",
        "128": "/icons/icon-128.png"
      } : {
        "16": "/icons/icon-16-gray.png",
        "32": "/icons/icon-32-gray.png",
        "48": "/icons/icon-48-gray.png",
        "128": "/icons/icon-128-gray.png"
      };
      await chrome.action.setIcon({ path: iconPath });
    } catch (error: any) {
      // Silently ignore icon update errors
    }
  }

  private async _onTabRemoved(tabId: number): Promise<void> {
    const pendingConnection = this._pendingTabSelection.get(tabId)?.connection;
    if (pendingConnection) {
      this._pendingTabSelection.delete(tabId);
      // Detach from tab but keep connection alive for tab management commands
      await pendingConnection.detachTab();
      return;
    }
    if (this._connectedTabId !== tabId)
      return;

    // Tab was closed - detach from it but keep connection alive
    console.log(`[Background] Tab ${tabId} was closed, detaching but keeping connection alive`);
    await this._activeConnection?.detachTab();
    this._connectedTabId = null;
    // Don't set _activeConnection to undefined - keep it alive for tab management
  }

  private _onTabActivated(activeInfo: chrome.tabs.TabActiveInfo) {
    for (const [tabId, pending] of this._pendingTabSelection) {
      if (tabId === activeInfo.tabId) {
        if (pending.timerId) {
          clearTimeout(pending.timerId);
          pending.timerId = undefined;
        }
        continue;
      }
      if (!pending.timerId) {
        pending.timerId = setTimeout(() => {
          const existed = this._pendingTabSelection.delete(tabId);
          if (existed) {
            pending.connection.close('Tab has been inactive for 5 seconds');
            chrome.tabs.sendMessage(tabId, { type: 'connectionTimeout' });
          }
        }, 5000);
        return;
      }
    }
  }

  private _onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
    if (this._connectedTabId === tabId)
      void this._setConnectedTabId(tabId);
  }

  private async _getTabs(): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({});
    return tabs.filter(tab => tab.url && !['chrome:', 'edge:', 'devtools:'].some(scheme => tab.url!.startsWith(scheme)));
  }

  private async _disconnect(): Promise<void> {
    this._activeConnection?.close('User disconnected');
    this._activeConnection = undefined;
    this._stealthMode = null; // Reset to N/A when disconnecting
    this._projectName = null; // Reset project name
    await this._setConnectedTabId(null);
    await this._updateGlobalIcon(false);
    this._broadcastStatusChange();

    // Stop keepalive alarm when disconnected
    if (chrome.alarms) {
      chrome.alarms.clear('keepalive', (wasCleared) => {
        if (wasCleared) {
          logger.debug('Keepalive alarm stopped');
        }
      });
    }
  }

  private _handleConnectionStatus(status: { max_connections: number; connections_used: number; connections_to_this_browser: number }): void {
    debugLog('Connection status update:', status);

    // Store connection status in chrome.storage for popup to access
    chrome.storage.local.set({
      connectionStatus: status
    }).catch((error) => {
      debugLog('Error storing connection status:', error);
    });

    // Broadcast status change to notify popup
    this._broadcastStatusChange();
  }

  private _broadcastStatusChange(): void {
    // Broadcast status change to all extension pages (popup, etc.)
    chrome.runtime.sendMessage({
      type: 'statusChanged',
      connectedTabId: this._connectedTabId,
      connected: this._activeConnection !== undefined,
      stealthMode: this._stealthMode,
      projectName: this._projectName
    }).catch(() => {
      // Ignore errors if no listeners (popup might be closed)
    });
  }

  private _onStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void {
    if (areaName !== 'local') return;

    // Handle extension enabled/disabled
    if (changes.extensionEnabled) {
      const isEnabled = changes.extensionEnabled.newValue !== false;
      // Update icon based on enabled state AND connection state
      const isConnected = this._activeConnection !== undefined;
      void this._updateGlobalIcon(isEnabled && isConnected);

      // If disabled, disconnect and cancel reconnect alarms
      if (!isEnabled) {
        if (this._activeConnection) {
          void this._disconnect();
        }
        // Cancel any pending reconnect alarms
        if (chrome.alarms) {
          chrome.alarms.clear('reconnect', (wasCleared) => {
            if (wasCleared) {
              logger.debug('Reconnect alarm cancelled due to extension being disabled');
            }
          });
        }
      }
    }

    // Handle authentication status changes (login/logout)
    if (changes.accessToken || changes.refreshToken || changes.isPro) {
      // Disconnect current connection if any
      if (this._activeConnection) {
        this._activeConnection.close('Authentication status changed');
        this._activeConnection = undefined;
        this._stealthMode = null;
        this._projectName = null;
        void this._setConnectedTabId(null);
        void this._updateGlobalIcon(false);
      }
      // Reconnect with new authentication status
      setTimeout(() => {
        void this._autoConnect();
      }, 500); // Small delay to ensure storage is fully updated

      // Reschedule token refresh with new tokens
      this._scheduleTokenRefresh();
    }
  }

  /**
   * Schedule token refresh based on access token expiry
   * Refreshes 5 minutes before expiration
   */
  private _scheduleTokenRefresh(): void {
    // Clear existing timer
    if (this._tokenRefreshTimer !== null) {
      clearTimeout(this._tokenRefreshTimer);
      this._tokenRefreshTimer = null;
    }

    // Get access token from storage
    chrome.storage.local.get(['accessToken'], (result) => {
      if (!result.accessToken) {
        debugLog('[TokenRefresh] No access token found, skipping refresh schedule');
        return;
      }

      const msUntilRefresh = getMillisecondsUntilRefresh(result.accessToken, 5);

      if (msUntilRefresh === 0) {
        debugLog('[TokenRefresh] Token already expired or expires soon, refreshing immediately');
        void this._refreshAccessToken();
      } else {
        debugLog(`[TokenRefresh] Scheduling refresh in ${Math.round(msUntilRefresh / 1000 / 60)} minutes`);
        this._tokenRefreshTimer = setTimeout(() => {
          debugLog('[TokenRefresh] Timer fired, refreshing token');
          void this._refreshAccessToken();
        }, msUntilRefresh) as unknown as number;
      }
    });
  }

  /**
   * Refresh access token using refresh token
   * Calls the auth server API and updates stored tokens
   */
  private async _refreshAccessToken(): Promise<void> {
    debugLog('[TokenRefresh] Starting token refresh...');

    try {
      // Get refresh token from storage
      const { refreshToken } = await new Promise<{ refreshToken?: string }>((resolve) => {
        chrome.storage.local.get(['refreshToken'], (result: { refreshToken?: string }) => {
          resolve(result);
        });
      });

      if (!refreshToken) {
        debugLog('[TokenRefresh] No refresh token found, cannot refresh');
        return;
      }

      // Call auth API to refresh tokens
      const response = await fetch('https://mcp-for-chrome.railsblueprint.com/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        debugLog('[TokenRefresh] Failed to refresh token:', response.status, errorText);
        // Clear tokens if refresh fails (user needs to login again)
        await chrome.storage.local.remove(['accessToken', 'refreshToken', 'isPro']);
        return;
      }

      // Parse JSON:API response
      const data = await response.json();
      const newAccessToken = data.data.attributes.access_token;
      const newRefreshToken = data.data.attributes.refresh_token;

      if (!newAccessToken || !newRefreshToken) {
        debugLog('[TokenRefresh] Invalid response format:', data);
        return;
      }

      // Decode new access token to check if user is PRO
      const claims = decodeJWT(newAccessToken);
      const isPro = !!claims?.connection_url;

      // Update storage with new tokens
      await chrome.storage.local.set({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        isPro: isPro
      });

      debugLog('[TokenRefresh] Token refreshed successfully');

      // Schedule next refresh
      this._scheduleTokenRefresh();

    } catch (error) {
      debugLog('[TokenRefresh] Error refreshing token:', error);
    }
  }
}

new TabShareExtension();
