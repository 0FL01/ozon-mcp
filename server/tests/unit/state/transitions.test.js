/**
 * State Transition Tests
 *
 * Test Coverage:
 * - Initial state is passive
 * - State transitions follow valid paths
 * - Invalid transitions are rejected
 * - State is maintained correctly
 */

// Mock ExtensionServer at module level to prevent real port binding
jest.mock('../../../src/extensionServer', () => {
  return {
    ExtensionServer: jest.fn().mockImplementation(() => ({
      start: jest.fn().mockResolvedValue(true),
      stop: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(true),
      sendCommand: jest.fn().mockResolvedValue({ success: true }),
      setClientId: jest.fn(),
      getBuildTimestamp: jest.fn().mockReturnValue('2025-10-31T12:00:00.000Z'),
      onReconnect: null,
      onTabInfoUpdate: null,
      port: 5555,
      _isRunning: false
    }))
  };
});

// Mock UnifiedBackend to prevent real initialization
jest.mock('../../../src/unifiedBackend', () => {
  return {
    UnifiedBackend: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(true),
      callTool: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock response' }],
        isError: false
      }),
      serverClosed: jest.fn() // Called during disable
    }))
  };
});

// Mock Transport classes
jest.mock('../../../src/transport', () => {
  return {
    DirectTransport: jest.fn().mockImplementation(() => ({
      sendCommand: jest.fn().mockResolvedValue({ success: true }),
      close: jest.fn().mockResolvedValue(true)
    })),
    ProxyTransport: jest.fn().mockImplementation(() => ({
      sendCommand: jest.fn().mockResolvedValue({ success: true }),
      close: jest.fn().mockResolvedValue(true)
    }))
  };
});

// Mock OAuth2Client to prevent real authentication
jest.mock('../../../src/oauth', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      isAuthenticated: jest.fn().mockResolvedValue(false),
      getUserInfo: jest.fn().mockReturnValue(null),
      login: jest.fn().mockResolvedValue({ accessToken: 'mock', refreshToken: 'mock' }),
      logout: jest.fn().mockResolvedValue(true),
      getStoredTokens: jest.fn().mockResolvedValue({ accessToken: 'mock-token', refreshToken: 'mock-refresh' })
    }))
  };
});

// Mock MCPConnection for PRO mode tests
jest.mock('../../../src/mcpConnection', () => {
  return {
    MCPConnection: jest.fn().mockImplementation((config) => ({
      connect: jest.fn().mockResolvedValue(true),
      _connectWebSocket: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(true),
      sendRequest: jest.fn().mockResolvedValue({ extensions: [] }),
      onClose: null,
      onTabInfoUpdate: null,
      _connectionId: null,
      _authenticated: false,
      _connected: false
    }))
  };
});

const { StatefulBackend } = require('../../../src/statefulBackend');
const { createMockServer, createMockExtensionServer, createMockMCPConnection } = require('../../helpers/mocks');
const { expectState } = require('../../helpers/assertions');

describe('State Transitions', () => {
  describe('Initial State', () => {
    test('should start in passive state', () => {
      // GIVEN - New backend
      const backend = new StatefulBackend({ debug: false });

      // THEN - Should be in passive state
      expectState(backend, 'passive');
    });

    test('should remain passive after initialization', async () => {
      // GIVEN
      const backend = new StatefulBackend({ debug: false });
      const mockServer = createMockServer();

      // WHEN - Initialize
      await backend.initialize(mockServer, {});

      // THEN - Still passive
      expectState(backend, 'passive');
    });
  });

  describe('Passive → Active (Enable)', () => {
    test('should transition to active when enabling Free mode', async () => {
      // GIVEN
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});
      // ExtensionServer is mocked at module level

      // WHEN - Enable in Free mode
      const result = await backend.callTool('enable', {
        client_id: 'test',
        force_free: true
      });

      // Debug: Check if enable returned an error
      if (result.isError) {
        console.log('Enable failed with error:', result.content[0].text);
      }

      // THEN - Should be active
      expect(result.isError).not.toBe(true);
      expectState(backend, 'active');
    });

    test('should transition to active when enabling PRO mode', async () => {
      // GIVEN - Authenticated backend
      const backend = new StatefulBackend({ debug: false });
      backend._isAuthenticated = true;
      await backend.initialize(createMockServer(), {});

      // Mock MCP connection
      const mockMCPConn = createMockMCPConnection();
      mockMCPConn.listBrowsers = jest.fn().mockResolvedValue([]);
      backend._createMCPConnection = jest.fn().mockReturnValue(mockMCPConn);

      // WHEN - Enable in PRO mode
      await backend.callTool('enable', {
        client_id: 'test'
      });

      // THEN - Should be active (no browsers available)
      expectState(backend, 'active');
    });
  });

  describe('Active → Connected (Manual State Change for Testing)', () => {
    test('should be able to transition to connected state', async () => {
      // GIVEN - Active state (ExtensionServer mocked at module level)
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});

      await backend.callTool('enable', {
        client_id: 'test',
        force_free: true
      });
      expectState(backend, 'active');

      // WHEN - Manually set to connected (simulating extension connection)
      backend._state = 'connected';
      backend._connectedBrowserName = 'Chrome Test';

      // THEN - Should be connected
      expectState(backend, 'connected');
      expect(backend._connectedBrowserName).toBe('Chrome Test');
    });
  });

  describe('Active → Authenticated Waiting (Multiple Browsers)', () => {
    test('should transition to authenticated_waiting with multiple browsers', async () => {
      // GIVEN - Configure OAuth mock to return authenticated state BEFORE initialize
      const { OAuth2Client } = require('../../../src/oauth');
      const userInfo = {
        email: 'test@example.com',
        isPro: true,
        connectionUrl: 'wss://mock.example.com'
      };
      OAuth2Client.mockImplementation(() => ({
        isAuthenticated: jest.fn().mockResolvedValue(true),
        getUserInfo: jest.fn().mockReturnValue(userInfo),
        getStoredTokens: jest.fn().mockResolvedValue({ accessToken: 'mock-token', refreshToken: 'mock-refresh' }),
        login: jest.fn(),
        logout: jest.fn()
      }));

      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});

      // Configure MCPConnection mock to return multiple browsers
      const { MCPConnection } = require('../../../src/mcpConnection');
      MCPConnection.mockImplementation((config) => ({
        connect: jest.fn().mockResolvedValue(true),
        _connectWebSocket: jest.fn().mockResolvedValue(true),
        close: jest.fn().mockResolvedValue(true),
        sendRequest: jest.fn().mockResolvedValue({
          extensions: [
            { id: 'browser1', name: 'Chrome 1' },
            { id: 'browser2', name: 'Chrome 2' }
          ]
        }),
        onClose: null,
        onTabInfoUpdate: null,
        _connectionId: null,
        _authenticated: false,
        _connected: false
      }));

      // WHEN - Enable
      await backend.callTool('enable', { client_id: 'test' });

      // THEN - Should be in authenticated_waiting state
      expectState(backend, 'authenticated_waiting');
    });
  });

  describe('Authenticated Waiting → Connected (Browser Selected)', () => {
    test('should transition to connected when browser selected', async () => {
      // GIVEN - Configure OAuth mock BEFORE initialize
      const { OAuth2Client } = require('../../../src/oauth');
      const userInfo = {
        email: 'test@example.com',
        isPro: true,
        connectionUrl: 'wss://mock.example.com'
      };
      OAuth2Client.mockImplementation(() => ({
        isAuthenticated: jest.fn().mockResolvedValue(true),
        getUserInfo: jest.fn().mockReturnValue(userInfo),
        getStoredTokens: jest.fn().mockResolvedValue({ accessToken: 'mock-token', refreshToken: 'mock-refresh' }),
        login: jest.fn(),
        logout: jest.fn()
      }));

      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});

      const browsers = [
        { id: 'browser1', name: 'Chrome 1' },
        { id: 'browser2', name: 'Chrome 2' }
      ];

      // Configure MCPConnection mock to return multiple browsers first, then handle connect
      const { MCPConnection } = require('../../../src/mcpConnection');
      MCPConnection.mockImplementation((config) => ({
        connect: jest.fn().mockResolvedValue(true),
        _connectWebSocket: jest.fn().mockResolvedValue(true),
        close: jest.fn().mockResolvedValue(true),
        sendRequest: jest.fn().mockImplementation((method, params) => {
          if (method === 'list_extensions') {
            return Promise.resolve({ extensions: browsers });
          }
          if (method === 'connect') {
            return Promise.resolve({
              success: true,
              connection_id: 'mock-connection-id'
            });
          }
          return Promise.resolve({ success: true });
        }),
        onClose: null,
        onTabInfoUpdate: null,
        _connectionId: null,
        _authenticated: false,
        _connected: false
      }));

      await backend.callTool('enable', { client_id: 'test' });
      expectState(backend, 'authenticated_waiting');

      // WHEN - Select browser
      await backend.callTool('browser_connect', {
        browser_id: 'browser1'
      });

      // THEN - Should be connected
      expectState(backend, 'connected');
    });
  });

  describe('Connected/Active → Passive (Disable)', () => {
    test('should transition to passive when disabling from connected state', async () => {
      // GIVEN - Connected state (ExtensionServer mocked at module level)
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});

      await backend.callTool('enable', {
        client_id: 'test',
        force_free: true
      });
      // Manually set connected state
      backend._state = 'connected';
      backend._connectedBrowserName = 'Chrome';
      expectState(backend, 'connected');

      // WHEN - Disable
      await backend.callTool('disable', {});

      // THEN - Should be passive
      expectState(backend, 'passive');
    });

    test('should transition to passive when disabling from active state', async () => {
      // GIVEN - Active state (ExtensionServer mocked at module level)
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});

      await backend.callTool('enable', {
        client_id: 'test',
        force_free: true
      });
      expectState(backend, 'active');

      // WHEN - Disable
      await backend.callTool('disable', {});

      // THEN - Should be passive
      expectState(backend, 'passive');
    });
  });

  describe('Invalid Transitions', () => {
    test('should return informational message when already enabled', async () => {
      // GIVEN - Already in active state (ExtensionServer mocked at module level)
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});

      await backend.callTool('enable', {
        client_id: 'test',
        force_free: true
      });
      expectState(backend, 'active');

      // WHEN - Try to enable again
      const result = await backend.callTool('enable', {
        client_id: 'test',
        force_free: true
      });

      // THEN - Should return informational success message and stay in active state
      expect(result.isError).toBeFalsy(); // Production code doesn't set isError for "already enabled"
      expect(result.content[0].text).toContain('Already Enabled');
      expectState(backend, 'active');
    });

    test('should allow disable when already passive', async () => {
      // GIVEN - Passive state
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});
      expectState(backend, 'passive');

      // WHEN - Disable (even though already passive)
      const result = await backend.callTool('disable', {});

      // THEN - Should succeed silently (isError not set = success)
      expect(result.isError).toBeFalsy();
      expectState(backend, 'passive');
    });

    test('should reject browser_connect when not in authenticated_waiting state', async () => {
      // GIVEN - Passive state
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});
      expectState(backend, 'passive');

      // WHEN - Try to connect to browser
      const result = await backend.callTool('browser_connect', {
        browser_id: 'browser1'
      });

      // THEN - Should return error
      expect(result.isError).toBe(true);
      expectState(backend, 'passive');
    });
  });

  describe('State Persistence', () => {
    test('should maintain state across tool calls', async () => {
      // GIVEN - Connected state (ExtensionServer mocked at module level)
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});

      await backend.callTool('enable', {
        client_id: 'test',
        force_free: true
      });
      // Manually set connected state
      backend._state = 'connected';
      backend._connectedBrowserName = 'Chrome';
      expectState(backend, 'connected');

      // WHEN - Call status multiple times
      await backend.callTool('status', {});
      await backend.callTool('status', {});
      await backend.callTool('status', {});

      // THEN - Should still be connected
      expectState(backend, 'connected');
    });
  });
});
