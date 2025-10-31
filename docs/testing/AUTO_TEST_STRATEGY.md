# Automated Test Strategy

This document defines what can be tested automatically and what requires manual testing.

## Test Pyramid

```
        /\
       /E2E\          E2E (optional) - Real browser, full workflows
      /------\
     /  Integ \       Integration - Components working together
    /----------\
   /    Unit    \     Unit - Individual components (MOST TESTS HERE)
  /--------------\
```

## What Can Be Auto-Tested

### ✅ Unit Tests (Most Coverage)

**Target: 80%+ code coverage**

1. **State Management** - Can mock everything
   - Initial state (passive)
   - State transitions (passive → active → connected)
   - State validation
   - Error states

2. **Tool Parameter Validation** - No browser needed
   - Required parameters present
   - Parameter types correct
   - Invalid values rejected
   - Edge cases (empty, null, undefined)

3. **Error Messages** - Deterministic
   - Correct error format
   - Helpful error messages
   - Error codes consistent

4. **Transport Layer** - Can mock WebSocket/HTTP
   - DirectTransport sends commands
   - ProxyTransport sends commands
   - Connection handling
   - Retry logic

5. **OAuth Flow** - Can mock HTTP requests
   - Token storage/retrieval
   - Token refresh
   - Login/logout state
   - Error handling

6. **Selector Escaping** - Pure logic (already exists!)
   - Special characters handled
   - Unicode preserved
   - Valid JavaScript generated

7. **Data Formatting** - Pure logic
   - Snapshot formatting
   - Network request filtering
   - JSONPath queries
   - Markdown conversion

### ⚠️ Integration Tests (Medium Coverage)

**Target: Key workflows**

Can be tested with mocked extension responses:

1. **Enable → Connect → Attach Flow**
   - Mock extension connection
   - Mock browser list
   - Mock tab list
   - Verify state changes

2. **Command → Response Flow**
   - Send command through transport
   - Receive mock response
   - Parse response
   - Return formatted result

3. **Auto-Reconnect Logic**
   - Mock disconnect event
   - Verify reconnect attempt
   - Verify state restoration

4. **Multi-Browser Selection (PRO)**
   - Mock multiple browsers
   - Verify selection flow
   - Verify correct browser attached

### ❌ Cannot Auto-Test (Requires Manual)

**These need real browser + extension:**

1. **Actual Browser Interactions**
   - Real clicks
   - Real typing
   - Real navigation
   - Real screenshots

2. **Visual Verification**
   - Screenshot correctness
   - Element visibility
   - Layout issues

3. **Browser-Specific Behavior**
   - Chrome vs Firefox differences
   - Extension API quirks
   - CDP edge cases

4. **Network Capture**
   - Real HTTP requests
   - Real responses
   - Replay accuracy

5. **Tech Stack Detection**
   - Real frameworks on real pages
   - Detection accuracy

---

## Automated Test Structure

### Directory Organization

```
server/tests/
├── unit/                           # Fast, isolated, no I/O
│   ├── state/
│   │   ├── transitions.test.js    # State machine logic
│   │   └── validation.test.js     # State validation
│   │
│   ├── tools/
│   │   ├── enable.test.js         # enable tool logic
│   │   ├── disable.test.js        # disable tool logic
│   │   ├── status.test.js         # status formatting
│   │   ├── auth.test.js           # auth flow (mocked)
│   │   └── browser-connect.test.js
│   │
│   ├── validation/
│   │   ├── parameters.test.js     # All parameter validation
│   │   └── selectors.test.js      # Selector escaping (exists)
│   │
│   ├── formatting/
│   │   ├── snapshot.test.js       # Snapshot formatting
│   │   ├── network.test.js        # Network request formatting
│   │   └── errors.test.js         # Error message formatting
│   │
│   └── transport/
│       ├── direct.test.js         # DirectTransport logic
│       └── proxy.test.js          # ProxyTransport logic
│
├── integration/                    # Mock extension, test workflows
│   ├── connection-flow.test.js    # Enable → connect → attach
│   ├── tab-management.test.js     # List → attach → close
│   ├── auto-reconnect.test.js     # Disconnect → reconnect
│   └── multi-browser.test.js      # PRO: browser selection
│
└── e2e/                           # Optional: Real browser
    ├── chrome/
    │   └── basic-workflow.test.js # Real Chrome automation
    └── firefox/
        └── basic-workflow.test.js # Real Firefox automation
```

---

## Test Utilities

### Mock Factories

Create reusable mocks for common objects:

```javascript
// tests/helpers/mocks.js

export function createMockServer() {
  return {
    sendToolListChanged: jest.fn()
  };
}

export function createMockTransport() {
  return {
    sendCommand: jest.fn().mockResolvedValue({ success: true }),
    close: jest.fn()
  };
}

export function createMockExtensionResponse(type, data) {
  return {
    id: '123',
    result: {
      type,
      data
    }
  };
}

export function createMockBrowserList(count = 1) {
  return Array.from({ length: count }, (_, i) => ({
    browser_id: `ext-chrome-${i}`,
    name: `Chrome ${i}`,
    connected: true
  }));
}

export function createMockTabList(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    id: `${100 + i}`,
    url: `https://example.com/page${i}`,
    title: `Page ${i}`,
    active: i === 0
  }));
}
```

### Assertion Helpers

```javascript
// tests/helpers/assertions.js

export function expectError(result, messageContains) {
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain(messageContains);
}

export function expectSuccess(result, messageContains = null) {
  expect(result.isError).toBe(false);
  if (messageContains) {
    expect(result.content[0].text).toContain(messageContains);
  }
}

export function expectState(backend, expectedState) {
  expect(backend._state).toBe(expectedState);
}
```

---

## Test Examples

### Unit Test Example

```javascript
// tests/unit/tools/enable.test.js

import { StatefulBackend } from '../../../src/statefulBackend';
import { createMockServer, createMockTransport } from '../../helpers/mocks';
import { expectError, expectSuccess, expectState } from '../../helpers/assertions';

describe('Enable Tool', () => {
  describe('Parameter Validation', () => {
    test('should require client_id parameter', async () => {
      // GIVEN - Backend initialized without client_id
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});

      // WHEN - Call enable without client_id
      const result = await backend.callTool('enable', {});

      // THEN - Should return error
      expectError(result, 'client_id');
      expectState(backend, 'passive');
    });

    test('should accept valid client_id', async () => {
      // GIVEN
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});

      // Mock transport to avoid real server
      backend._createTransport = jest.fn().mockResolvedValue(createMockTransport());

      // WHEN
      const result = await backend.callTool('enable', {
        client_id: 'test-client'
      });

      // THEN
      expectSuccess(result);
      expectState(backend, 'active');
    });
  });

  describe('Free Mode', () => {
    test('should start WebSocket server on default port', async () => {
      // GIVEN
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});

      const mockServer = {
        start: jest.fn().mockResolvedValue(true),
        port: 5555
      };
      backend._createExtensionServer = jest.fn().mockReturnValue(mockServer);

      // WHEN
      const result = await backend.callTool('enable', {
        client_id: 'test',
        force_free: true
      });

      // THEN
      expect(mockServer.start).toHaveBeenCalled();
      expectSuccess(result, '5555');
    });

    test('should use custom port if specified', async () => {
      // GIVEN
      const backend = new StatefulBackend({ debug: false, port: 6666 });
      await backend.initialize(createMockServer(), {});

      const mockServer = {
        start: jest.fn().mockResolvedValue(true),
        port: 6666
      };
      backend._createExtensionServer = jest.fn().mockReturnValue(mockServer);

      // WHEN
      const result = await backend.callTool('enable', {
        client_id: 'test',
        force_free: true
      });

      // THEN
      expect(mockServer.start).toHaveBeenCalled();
      expectSuccess(result, '6666');
    });
  });

  describe('Error Handling', () => {
    test('should return error if already enabled', async () => {
      // GIVEN - Already enabled
      const backend = new StatefulBackend({ debug: false });
      await backend.initialize(createMockServer(), {});
      backend._state = 'active';

      // WHEN - Try to enable again
      const result = await backend.callTool('enable', {
        client_id: 'test'
      });

      // THEN
      expectError(result, 'already enabled');
    });
  });
});
```

### Integration Test Example

```javascript
// tests/integration/connection-flow.test.js

import { StatefulBackend } from '../../src/statefulBackend';
import { createMockServer, createMockBrowserList, createMockTabList } from '../helpers/mocks';

describe('Connection Flow Integration', () => {
  test('Free Mode: enable → extension connects → attach tab', async () => {
    // GIVEN - Fresh backend
    const backend = new StatefulBackend({ debug: false });
    const mockServer = createMockServer();
    await backend.initialize(mockServer, {});

    // Mock extension server
    const mockExtensionServer = {
      start: jest.fn().mockResolvedValue(true),
      port: 5555,
      sendCommand: jest.fn().mockImplementation(async (method, params) => {
        if (method === 'browser.tabs.list') {
          return { tabs: createMockTabList() };
        }
        if (method === 'browser.tabs.attach') {
          return { success: true };
        }
        return { success: true };
      })
    };
    backend._createExtensionServer = jest.fn().mockReturnValue(mockExtensionServer);

    // WHEN - Enable
    const enableResult = await backend.callTool('enable', {
      client_id: 'test',
      force_free: true
    });

    // THEN - Should be active
    expect(enableResult.isError).toBe(false);
    expect(backend._state).toBe('active');

    // WHEN - Extension connects (simulate)
    backend._onExtensionConnected({ browserName: 'Chrome Test' });

    // THEN - Should be connected
    expect(backend._state).toBe('connected');
    expect(backend._connectedBrowserName).toBe('Chrome Test');

    // WHEN - Attach to tab
    const attachResult = await backend.callTool('browser_tabs', {
      action: 'attach',
      index: 0
    });

    // THEN - Should attach successfully
    expect(attachResult.isError).toBe(false);
    expect(mockExtensionServer.sendCommand).toHaveBeenCalledWith(
      'browser.tabs.attach',
      expect.objectContaining({ index: 0 })
    );
  });

  test('PRO Mode: enable → auto-connect to single browser → attach tab', async () => {
    // GIVEN - Authenticated backend
    const backend = new StatefulBackend({ debug: false });
    backend._isAuthenticated = true;
    backend._userInfo = { email: 'test@example.com' };

    const mockServer = createMockServer();
    await backend.initialize(mockServer, {});

    // Mock proxy connection
    const mockMCPConnection = {
      connect: jest.fn().mockResolvedValue(true),
      listBrowsers: jest.fn().mockResolvedValue(createMockBrowserList(1)),
      sendRequest: jest.fn().mockImplementation(async (method, params) => {
        if (method === 'browser.tabs.list') {
          return { tabs: createMockTabList() };
        }
        if (method === 'browser.tabs.attach') {
          return { success: true, tabInfo: { index: 0, url: 'https://example.com' } };
        }
        return { success: true };
      })
    };
    backend._createMCPConnection = jest.fn().mockReturnValue(mockMCPConnection);

    // WHEN - Enable
    const enableResult = await backend.callTool('enable', {
      client_id: 'test'
    });

    // THEN - Should auto-connect to single browser and attach to last tab
    expect(enableResult.isError).toBe(false);
    expect(backend._state).toBe('connected');
    expect(mockMCPConnection.connect).toHaveBeenCalled();
    expect(mockMCPConnection.listBrowsers).toHaveBeenCalled();
  });

  test('PRO Mode: enable → multiple browsers → user selects browser', async () => {
    // GIVEN - Authenticated backend
    const backend = new StatefulBackend({ debug: false });
    backend._isAuthenticated = true;
    backend._userInfo = { email: 'test@example.com' };

    const mockServer = createMockServer();
    await backend.initialize(mockServer, {});

    // Mock proxy with 2 browsers
    const browsers = createMockBrowserList(2);
    const mockMCPConnection = {
      connect: jest.fn().mockResolvedValue(true),
      listBrowsers: jest.fn().mockResolvedValue(browsers),
      sendRequest: jest.fn().mockResolvedValue({ success: true })
    };
    backend._createMCPConnection = jest.fn().mockReturnValue(mockMCPConnection);

    // WHEN - Enable
    const enableResult = await backend.callTool('enable', {
      client_id: 'test'
    });

    // THEN - Should be in authenticated_waiting state
    expect(enableResult.isError).toBe(false);
    expect(backend._state).toBe('authenticated_waiting');
    expect(enableResult.content[0].text).toContain('Multiple browsers found');

    // WHEN - User selects browser
    const connectResult = await backend.callTool('browser_connect', {
      browser_id: browsers[0].browser_id
    });

    // THEN - Should connect to selected browser
    expect(connectResult.isError).toBe(false);
    expect(backend._state).toBe('connected');
    expect(backend._connectedBrowserName).toContain('Chrome');
  });
});
```

---

## Running Tests

### Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm test -- tests/unit

# Run integration tests only
npm test -- tests/integration

# Run specific test file
npm test -- tests/unit/tools/enable.test.js

# Run with coverage
npm test -- --coverage

# Watch mode (re-run on file change)
npm test -- --watch

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Coverage Goals

- **Unit tests:** 80%+ coverage
- **Integration tests:** Key workflows covered
- **E2E tests:** Optional (manual testing preferred for now)

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd server && npm install
      - run: cd server && npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./server/coverage/lcov.info
```

---

## Test-Driven Development (TDD)

For new features, follow TDD:

1. **Write test first** (it will fail)
2. **Implement feature** (make test pass)
3. **Refactor** (improve code, tests still pass)

Example:

```javascript
// 1. Write failing test
test('should support :has-text() selector with Unicode', async () => {
  const result = await backend.callTool('browser_interact', {
    actions: [{
      type: 'click',
      selector: 'button:has-text("Кнопка")'
    }]
  });

  expectSuccess(result);
});

// 2. Implement feature (make it pass)
// ... implementation in unifiedBackend.js ...

// 3. Refactor (if needed)
```

---

## What's Next

1. ✅ Feature spec created
2. ⏭️ **Create manual test procedures** (next)
3. Implement unit tests following this structure
4. Set up CI/CD
5. Add coverage reporting
6. Write integration tests
7. (Optional) Add E2E tests with Playwright

---

## Summary

**Auto-testable:**
- ✅ State management
- ✅ Parameter validation
- ✅ Error formatting
- ✅ Selector escaping
- ✅ Data formatting
- ✅ Transport layer (mocked)
- ✅ Connection workflows (mocked)

**Manual testing required:**
- ❌ Real browser interactions
- ❌ Visual verification
- ❌ Network capture accuracy
- ❌ Tech stack detection
- ❌ Browser-specific behavior

This gives us **80%+ coverage** with automated tests, with manual testing for the remaining visual/browser-specific features.
