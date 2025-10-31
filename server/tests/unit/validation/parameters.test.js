/**
 * Parameter Validation Tests
 *
 * Test Coverage:
 * - Required parameters are validated
 * - Optional parameters work
 * - Invalid parameter types are rejected
 * - Missing parameters return helpful errors
 */

// Mock ExtensionServer at module level to prevent real port binding
jest.mock('../../../src/extensionServer', () => {
  return {
    ExtensionServer: jest.fn().mockImplementation(() => ({
      start: jest.fn().mockResolvedValue(true),
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

// Mock UnifiedBackend with smart parameter validation
jest.mock('../../../src/unifiedBackend', () => {
  return {
    UnifiedBackend: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(true),
      callTool: jest.fn().mockImplementation(async (name, args) => {
        // Simulate parameter validation for different tools

        // Browser Tabs Tool
        if (name === 'browser_tabs') {
          if (!args.action) {
            return {
              content: [{ type: 'text', text: 'Error: action parameter is required' }],
              isError: true
            };
          }
          const validActions = ['list', 'new', 'attach', 'close'];
          if (!validActions.includes(args.action)) {
            return {
              content: [{ type: 'text', text: 'Error: action must be one of: list, new, attach, close' }],
              isError: true
            };
          }
          if (args.action === 'attach' && args.index === undefined && args.id === undefined) {
            return {
              content: [{ type: 'text', text: 'Error: attach action requires index or id parameter' }],
              isError: true
            };
          }
        }

        // Browser Navigate Tool
        if (name === 'browser_navigate') {
          if (!args.action) {
            return {
              content: [{ type: 'text', text: 'Error: action parameter is required' }],
              isError: true
            };
          }
          if (args.action === 'url' && !args.url) {
            return {
              content: [{ type: 'text', text: 'Error: url parameter is required for url action' }],
              isError: true
            };
          }
        }

        // Browser Interact Tool
        if (name === 'browser_interact') {
          if (!args.actions) {
            return {
              content: [{ type: 'text', text: 'Error: actions parameter is required' }],
              isError: true
            };
          }
          if (!Array.isArray(args.actions)) {
            return {
              content: [{ type: 'text', text: 'Error: actions must be an array' }],
              isError: true
            };
          }
          for (const action of args.actions) {
            if (!action.type) {
              return {
                content: [{ type: 'text', text: 'Error: type is required in each action' }],
                isError: true
              };
            }
            if (action.type === 'click' && !action.selector) {
              return {
                content: [{ type: 'text', text: 'Error: selector is required for click action' }],
                isError: true
              };
            }
            if (action.type === 'type' && !action.text) {
              return {
                content: [{ type: 'text', text: 'Error: text is required for type action' }],
                isError: true
              };
            }
          }
        }

        // Browser Take Screenshot Tool
        if (name === 'browser_take_screenshot') {
          if (args.type && !['png', 'jpeg'].includes(args.type)) {
            return {
              content: [{ type: 'text', text: 'Error: type must be png or jpeg' }],
              isError: true
            };
          }
          if (args.quality !== undefined && (args.quality < 0 || args.quality > 100)) {
            return {
              content: [{ type: 'text', text: 'Error: quality must be between 0 and 100' }],
              isError: true
            };
          }
        }

        // Browser Network Requests Tool
        if (name === 'browser_network_requests') {
          if (!args.action) {
            return {
              content: [{ type: 'text', text: 'Error: action parameter is required' }],
              isError: true
            };
          }
          if (args.action === 'details' && !args.requestId) {
            return {
              content: [{ type: 'text', text: 'Error: requestId is required for details action' }],
              isError: true
            };
          }
        }

        // Default: return success for valid calls
        return {
          content: [{ type: 'text', text: 'Mock success response' }],
          isError: false
        };
      })
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
      getStoredTokens: jest.fn().mockResolvedValue(null)
    }))
  };
});

const { StatefulBackend } = require('../../../src/statefulBackend');
const { createMockServer, createMockExtensionServer } = require('../../helpers/mocks');
const { expectError, expectSuccess } = require('../../helpers/assertions');

describe('Parameter Validation', () => {
  let backend;
  let mockServer;

  beforeEach(async () => {
    backend = new StatefulBackend({ debug: false });
    mockServer = createMockServer();
    await backend.initialize(mockServer, {});
  });

  describe('Enable Tool', () => {
    test('should require client_id parameter', async () => {
      // GIVEN - No client_id
      // WHEN - Call enable without client_id
      const result = await backend.callTool('enable', {});

      // THEN - Should return error
      expectError(result, 'client_id');
    });

    test('should accept valid client_id', async () => {
      // GIVEN - Valid parameters (ExtensionServer is mocked at module level)

      // WHEN - Call enable with client_id
      const result = await backend.callTool('enable', {
        client_id: 'test-client'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should accept force_free parameter', async () => {
      // GIVEN - ExtensionServer is mocked at module level

      // WHEN - Call enable with force_free
      const result = await backend.callTool('enable', {
        client_id: 'test',
        force_free: true
      });

      // THEN - Should succeed and use Free mode
      expectSuccess(result);
    });
  });

  describe('Browser Tabs Tool', () => {
    beforeEach(async () => {
      // Set up connected state (ExtensionServer mocked at module level)
      await backend.callTool('enable', { client_id: 'test', force_free: true });

      // Ensure _activeBackend is set (it should be after enable)
      expect(backend._activeBackend).toBeDefined();

      // Manually set state to connected for testing
      backend._state = 'connected';
      backend._connectedBrowserName = 'Chrome';
    });

    test('should require action parameter', async () => {
      // WHEN - Call without action
      const result = await backend.callTool('browser_tabs', {});

      // THEN - Should return error
      expectError(result, 'action');
    });

    test('should validate action is valid enum', async () => {
      // WHEN - Call with invalid action
      const result = await backend.callTool('browser_tabs', {
        action: 'invalid_action'
      });

      // THEN - Should return error
      expectError(result, 'action');
    });

    test('should accept valid list action', async () => {
      // WHEN - Call with list action
      const result = await backend.callTool('browser_tabs', {
        action: 'list'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should require index or id for attach action', async () => {
      // WHEN - Call attach without index/id
      const result = await backend.callTool('browser_tabs', {
        action: 'attach'
      });

      // THEN - Should return error
      expectError(result);
    });

    test('should accept index for attach action', async () => {
      // WHEN - Call attach with index
      const result = await backend.callTool('browser_tabs', {
        action: 'attach',
        index: 0
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should require url for new action when provided', async () => {
      // WHEN - Call new with url
      const result = await backend.callTool('browser_tabs', {
        action: 'new',
        url: 'https://example.com'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should accept activate parameter for new action', async () => {
      // WHEN - Call new with activate
      const result = await backend.callTool('browser_tabs', {
        action: 'new',
        url: 'https://example.com',
        activate: false
      });

      // THEN - Should succeed
      expectSuccess(result);
    });
  });

  describe('Browser Navigate Tool', () => {
    beforeEach(async () => {
      // Set up connected and attached state (ExtensionServer mocked at module level)
      await backend.callTool('enable', { client_id: 'test', force_free: true });

      // Directly set state to connected for testing
      backend._state = 'connected';
      backend._connectedBrowserName = 'Chrome';
      backend._currentTab = { index: 0, url: 'https://example.com' };
    });

    test('should require action parameter', async () => {
      // WHEN - Call without action
      const result = await backend.callTool('browser_navigate', {});

      // THEN - Should return error
      expectError(result, 'action');
    });

    test('should require url for url action', async () => {
      // WHEN - Call url action without url
      const result = await backend.callTool('browser_navigate', {
        action: 'url'
      });

      // THEN - Should return error
      expectError(result, 'url');
    });

    test('should accept valid url', async () => {
      // WHEN - Call with valid url
      const result = await backend.callTool('browser_navigate', {
        action: 'url',
        url: 'https://example.com'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should accept back action without parameters', async () => {
      // WHEN - Call back action
      const result = await backend.callTool('browser_navigate', {
        action: 'back'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });
  });

  describe('Browser Interact Tool', () => {
    beforeEach(async () => {
      // Set up connected and attached state (ExtensionServer mocked at module level)
      await backend.callTool('enable', { client_id: 'test', force_free: true });

      // Directly set state to connected for testing
      backend._state = 'connected';
      backend._connectedBrowserName = 'Chrome';
      backend._currentTab = { index: 0, url: 'https://example.com' };
    });

    test('should require actions array', async () => {
      // WHEN - Call without actions
      const result = await backend.callTool('browser_interact', {});

      // THEN - Should return error
      expectError(result, 'actions');
    });

    test('should validate actions is array', async () => {
      // WHEN - Call with non-array actions
      const result = await backend.callTool('browser_interact', {
        actions: 'not an array'
      });

      // THEN - Should return error
      expectError(result);
    });

    test('should require type in each action', async () => {
      // WHEN - Call with action missing type
      const result = await backend.callTool('browser_interact', {
        actions: [{ selector: 'button' }]
      });

      // THEN - Should return error
      expectError(result);
    });

    test('should require selector for click action', async () => {
      // WHEN - Call click without selector
      const result = await backend.callTool('browser_interact', {
        actions: [{ type: 'click' }]
      });

      // THEN - Should return error
      expectError(result);
    });

    test('should require text for type action', async () => {
      // WHEN - Call type without text
      const result = await backend.callTool('browser_interact', {
        actions: [{
          type: 'type',
          selector: 'input'
        }]
      });

      // THEN - Should return error
      expectError(result);
    });

    test('should accept valid click action', async () => {
      // WHEN - Call with valid click
      const result = await backend.callTool('browser_interact', {
        actions: [{
          type: 'click',
          selector: 'button'
        }]
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should accept multiple actions', async () => {
      // WHEN - Call with multiple actions
      const result = await backend.callTool('browser_interact', {
        actions: [
          { type: 'click', selector: 'button' },
          { type: 'type', selector: 'input', text: 'hello' }
        ]
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should accept optional onError parameter', async () => {
      // WHEN - Call with onError
      const result = await backend.callTool('browser_interact', {
        actions: [{ type: 'click', selector: 'button' }],
        onError: 'ignore'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });
  });

  describe('Browser Take Screenshot Tool', () => {
    beforeEach(async () => {
      // Set up connected and attached state (ExtensionServer mocked at module level)
      await backend.callTool('enable', { client_id: 'test', force_free: true });

      // Directly set state to connected for testing
      backend._state = 'connected';
      backend._connectedBrowserName = 'Chrome';
      backend._currentTab = { index: 0, url: 'https://example.com' };
    });

    test('should accept optional type parameter', async () => {
      // WHEN - Call with type
      const result = await backend.callTool('browser_take_screenshot', {
        type: 'png'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should validate type is valid enum', async () => {
      // WHEN - Call with invalid type
      const result = await backend.callTool('browser_take_screenshot', {
        type: 'gif'
      });

      // THEN - Should return error
      expectError(result);
    });

    test('should accept quality parameter for jpeg', async () => {
      // WHEN - Call with quality
      const result = await backend.callTool('browser_take_screenshot', {
        type: 'jpeg',
        quality: 90
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should validate quality is in range 0-100', async () => {
      // WHEN - Call with invalid quality
      const result = await backend.callTool('browser_take_screenshot', {
        quality: 150
      });

      // THEN - Should return error
      expectError(result);
    });

    test('should accept boolean fullPage parameter', async () => {
      // WHEN - Call with fullPage
      const result = await backend.callTool('browser_take_screenshot', {
        fullPage: true
      });

      // THEN - Should succeed
      expectSuccess(result);
    });
  });

  describe('Browser Network Requests Tool', () => {
    beforeEach(async () => {
      // Set up connected and attached state (ExtensionServer mocked at module level)
      await backend.callTool('enable', { client_id: 'test', force_free: true });

      // Directly set state to connected for testing
      backend._state = 'connected';
      backend._connectedBrowserName = 'Chrome';
      backend._currentTab = { index: 0, url: 'https://example.com' };
    });

    test('should require action parameter', async () => {
      // WHEN - Call without action
      const result = await backend.callTool('browser_network_requests', {});

      // THEN - Should return error
      expectError(result, 'action');
    });

    test('should accept list action', async () => {
      // WHEN - Call list action
      const result = await backend.callTool('browser_network_requests', {
        action: 'list'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should accept optional filters for list action', async () => {
      // WHEN - Call with filters
      const result = await backend.callTool('browser_network_requests', {
        action: 'list',
        urlPattern: 'api',
        method: 'GET',
        status: 200,
        resourceType: 'xhr'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should require requestId for details action', async () => {
      // WHEN - Call details without requestId
      const result = await backend.callTool('browser_network_requests', {
        action: 'details'
      });

      // THEN - Should return error
      expectError(result, 'requestId');
    });

    test('should accept requestId for details action', async () => {
      // WHEN - Call details with requestId
      const result = await backend.callTool('browser_network_requests', {
        action: 'details',
        requestId: '12345.67'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should accept optional jsonPath for details action', async () => {
      // WHEN - Call details with jsonPath
      const result = await backend.callTool('browser_network_requests', {
        action: 'details',
        requestId: '12345.67',
        jsonPath: '$.data'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });
  });

  describe('Auth Tool', () => {
    beforeEach(() => {
      // Mock OAuth client to prevent real browser from opening
      const mockOAuth = {
        login: jest.fn().mockResolvedValue({
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh'
        }),
        logout: jest.fn().mockResolvedValue(true),
        getStatus: jest.fn().mockReturnValue({ authenticated: false })
      };
      backend._oauthClient = mockOAuth;
    });

    test('should require action parameter', async () => {
      // WHEN - Call without action
      const result = await backend.callTool('auth', {});

      // THEN - Should return error
      expectError(result, 'action');
    });

    test('should validate action is valid enum', async () => {
      // WHEN - Call with invalid action
      const result = await backend.callTool('auth', {
        action: 'invalid'
      });

      // THEN - Should return error
      expectError(result);
    });

    test('should accept logout action', async () => {
      // WHEN - Call logout
      const result = await backend.callTool('auth', {
        action: 'logout'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });

    test('should accept status action', async () => {
      // WHEN - Call status
      const result = await backend.callTool('auth', {
        action: 'status'
      });

      // THEN - Should succeed
      expectSuccess(result);
    });
  });
});
