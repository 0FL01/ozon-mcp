/**
 * Transport Layer for Ozon MCP
 *
 * Direct transport for WebSocket connection to Chrome extension.
 */

/**
 * Base Transport interface
 */
class Transport {
  /**
   * Send a command to the extension
   * @param {string} method - Extension method (e.g., 'getTabs', 'forwardCDPCommand')
   * @param {object} params - Method parameters
   * @returns {Promise<any>} - Result from extension
   */
  async sendCommand(method, params) {
    throw new Error('sendCommand must be implemented by subclass');
  }

  /**
   * Close the transport
   */
  async close() {
    throw new Error('close must be implemented by subclass');
  }
}

/**
 * DirectTransport - local mode
 * Uses ExtensionServer for direct WebSocket connection to extension
 */
class DirectTransport extends Transport {
  constructor(extensionServer) {
    super();
    this._server = extensionServer;
  }

  async sendCommand(method, params) {
    return await this._server.sendCommand(method, params);
  }

  async close() {
    // Server cleanup handled separately
  }
}

module.exports = { Transport, DirectTransport };
