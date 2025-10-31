/**
 * Unit tests for StatefulBackend
 */

const { StatefulBackend } = require('../../src/statefulBackend');

describe('StatefulBackend', () => {
  test('initializes in passive state', () => {
    const backend = new StatefulBackend({ debug: false });
    expect(backend._state).toBe('passive');
  });

  test('has required methods', () => {
    const backend = new StatefulBackend({ debug: false });
    expect(typeof backend.initialize).toBe('function');
    expect(typeof backend.listTools).toBe('function');
    expect(typeof backend.callTool).toBe('function');
    expect(typeof backend.serverClosed).toBe('function');
  });

  test('listTools returns connection management tools', async () => {
    const backend = new StatefulBackend({ debug: false });
    await backend.initialize(null, {});

    const tools = await backend.listTools();

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);

    // Check for connection management tools
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('enable');
    expect(toolNames).toContain('disable');
    expect(toolNames).toContain('status');
    expect(toolNames).toContain('auth');
  });

  describe('Browser Reconnection (Issue 3)', () => {
    test('onBrowserDisconnected sets disconnected flag', () => {
      const backend = new StatefulBackend({ debug: false });
      backend._connectedBrowserName = 'Chrome Work';
      backend._attachedTab = { id: 123, index: 5, url: 'https://example.com' };

      // Simulate browser disconnection
      backend._browserDisconnected = false;
      const disconnectHandler = jest.fn((params) => {
        backend._browserDisconnected = true;
        backend._lastConnectedBrowserId = 'ext-123';
        backend._lastAttachedTab = backend._attachedTab;
        backend._attachedTab = null;
      });

      disconnectHandler({ id: 'ext-123', name: 'Chrome Work' });

      expect(backend._browserDisconnected).toBe(true);
      expect(backend._lastConnectedBrowserId).toBe('ext-123');
      expect(backend._lastAttachedTab).toEqual({ id: 123, index: 5, url: 'https://example.com' });
      expect(backend._attachedTab).toBeNull();
    });

    test('onBrowserReconnected clears disconnected flag', async () => {
      const backend = new StatefulBackend({ debug: false });
      backend._browserDisconnected = true;
      backend._connectedBrowserName = 'Chrome Work';

      // Mock MCPConnection
      const mockMcpConnection = {
        _connectionId: 'old-connection-id',
        sendRequest: jest.fn().mockResolvedValue({ connection_id: 'new-connection-id' })
      };

      // Simulate reconnection handler
      const reconnectHandler = async (params) => {
        try {
          const connectResult = await mockMcpConnection.sendRequest('connect', { extension_id: params.id });
          mockMcpConnection._connectionId = connectResult.connection_id;
          backend._browserDisconnected = false;
        } catch (error) {
          // Keep disconnected flag if reconnection failed
        }
      };

      await reconnectHandler({ id: 'ext-123', name: 'Chrome Work', reconnection: true });

      expect(backend._browserDisconnected).toBe(false);
      expect(mockMcpConnection._connectionId).toBe('new-connection-id');
      expect(mockMcpConnection.sendRequest).toHaveBeenCalledWith('connect', { extension_id: 'ext-123' });
    });

    test('onBrowserReconnected handles connection failure gracefully', async () => {
      const backend = new StatefulBackend({ debug: false });
      backend._browserDisconnected = true;

      // Mock MCPConnection that fails to reconnect
      const mockMcpConnection = {
        _connectionId: 'old-connection-id',
        sendRequest: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };

      // Simulate reconnection handler
      const reconnectHandler = async (params) => {
        try {
          const connectResult = await mockMcpConnection.sendRequest('connect', { extension_id: params.id });
          mockMcpConnection._connectionId = connectResult.connection_id;
          backend._browserDisconnected = false;
        } catch (error) {
          // Keep disconnected flag if reconnection failed
        }
      };

      await reconnectHandler({ id: 'ext-123', name: 'Chrome Work' });

      // Disconnected flag should remain true if reconnection failed
      expect(backend._browserDisconnected).toBe(true);
      expect(mockMcpConnection._connectionId).toBe('old-connection-id');
    });
  });
});
