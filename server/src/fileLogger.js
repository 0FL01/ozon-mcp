/**
 * File Logger - Logs debug messages to a file when debug mode is enabled
 * Uses stderr for console.error() style logging to avoid interfering with stdio MCP transport
 */

const fs = require('fs');
const path = require('path');

class FileLogger {
  constructor(logFilePath) {
    this.logFilePath = logFilePath;
    this.enabled = false;

    // Clear log file on initialization
    if (fs.existsSync(this.logFilePath)) {
      fs.truncateSync(this.logFilePath, 0);
    }
  }

  enable() {
    this.enabled = true;
    this.log('[FileLogger] Logging enabled - writing to:', this.logFilePath);
  }

  disable() {
    this.enabled = false;
  }

  log(...args) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const logLine = `[${timestamp}] ${message}\n`;

    // Write to file
    fs.appendFileSync(this.logFilePath, logLine, 'utf8');

    // Also write to stderr so it appears in wrapper logs
    console.error(message);
  }
}

// Singleton instance
let instance = null;

function getLogger(customLogPath = null) {
  if (!instance) {
    const logPath = customLogPath || path.join(__dirname, '..', '..', 'logs', 'mcp-debug.log');
    instance = new FileLogger(logPath);
  }
  return instance;
}

module.exports = { getLogger, FileLogger };
