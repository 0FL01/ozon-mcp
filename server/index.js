#!/usr/bin/env node
/**
 * Ozon MCP Server
 * 
 * Minimal MCP server for Ozon marketplace automation using Chrome DevTools Protocol.
 * Based on blueprint-mcp, stripped of SaaS/OAuth/cloud relay functionality.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { ExtensionServer } = require('./src/extensionServer');
const { UnifiedBackend } = require('./src/unifiedBackend');
const { DirectTransport } = require('./src/transport');
const { getLogger } = require('./src/fileLogger');

const packageJSON = require('./package.json');

// Enable stealth mode patches by default
process.env.STEALTH_MODE = 'true';

// Debug mode from environment
const DEBUG_MODE = process.env.DEBUG === 'true' || process.argv.includes('--debug');
global.DEBUG_MODE = DEBUG_MODE;

function debugLog(...args) {
    if (DEBUG_MODE) {
        console.error('[ozon-mcp]', ...args);
    }
}

async function main() {
    const PORT = parseInt(process.env.MCP_PORT || '5555');
    const HOST = process.env.MCP_HOST || '127.0.0.1';

    debugLog('Starting Ozon MCP Server...');
    debugLog('Version:', packageJSON.version);
    debugLog('Port:', PORT);

    // Enable file logging in debug mode
    const logger = getLogger();
    if (DEBUG_MODE) {
        logger.enable();
        logger.log('[ozon-mcp] Debug mode enabled');
    }

    // 1. Start WebSocket server for Chrome extension
    const extensionServer = new ExtensionServer(PORT, HOST);
    await extensionServer.start();
    debugLog('Extension server listening on', `${HOST}:${PORT}`);

    // 2. Create direct transport (no proxy mode)
    const transport = new DirectTransport(extensionServer);

    // 2.1 Load selectors configuration
    const fs = require('fs');
    const path = require('path');
    let ozonSelectors = {};

    try {
        const selectorsPath = path.resolve(__dirname, '../selectors/ozon-selectors.json');
        if (fs.existsSync(selectorsPath)) {
            const fileContent = fs.readFileSync(selectorsPath, 'utf8');
            ozonSelectors = JSON.parse(fileContent);
            debugLog('Loaded Ozon selectors configuration');
        } else {
            console.warn('[ozon-mcp] Warning: ozon-selectors.json not found at', selectorsPath);
        }
    } catch (error) {
        console.error('[ozon-mcp] Error loading selectors:', error.message);
    }

    // 3. Initialize backend with CDP command implementations
    const config = {
        debug: DEBUG_MODE,
        server: {
            name: 'ozon-mcp',
            version: packageJSON.version
        },
        ozonSelectors: ozonSelectors
    };
    const backend = new UnifiedBackend(config, transport);

    // 4. Create MCP server for Claude/LLM communication
    const server = new Server(
        {
            name: config.server.name,
            version: config.server.version
        },
        {
            capabilities: {
                tools: {}
            }
        }
    );

    debugLog('Registering MCP handlers...');

    // 5. Register tool handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools = await backend.listTools();
        debugLog('Listing tools:', tools.length, 'available');
        return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        debugLog('Calling tool:', name);
        return await backend.callTool(name, args);
    });

    // Initialize backend (connects transport to backend)
    await backend.initialize(server, {});

    // 6. Start stdio transport for MCP protocol
    debugLog('Starting stdio transport...');
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);

    debugLog('Ozon MCP server ready');
    debugLog('Waiting for Chrome extension connection on port', PORT);

    // Handle shutdown gracefully
    const cleanup = async () => {
        debugLog('Shutting down...');
        await backend.serverClosed();
        await extensionServer.stop();
        await server.close();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Handle stdin close (MCP client disconnected)
    process.stdin.on('close', cleanup);
}

main().catch((error) => {
    console.error('[ozon-mcp] Fatal error:', error);
    process.exit(1);
});
