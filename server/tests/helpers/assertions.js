/**
 * Custom assertion helpers for testing
 * Provides readable assertions for common test scenarios
 */

/**
 * Assert that result is an error with specific message
 */
function expectError(result, messageContains) {
  expect(result.isError).toBe(true);
  expect(result.content).toBeDefined();
  expect(result.content[0]).toBeDefined();
  expect(result.content[0].type).toBe('text');

  if (messageContains) {
    expect(result.content[0].text).toContain(messageContains);
  }
}

/**
 * Assert that result is successful
 */
function expectSuccess(result, messageContains = null) {
  // Successful results don't have isError property, or it's explicitly false
  expect(result.isError).not.toBe(true);
  expect(result.content).toBeDefined();
  expect(result.content[0]).toBeDefined();
  expect(result.content[0].type).toBe('text');

  if (messageContains) {
    expect(result.content[0].text).toContain(messageContains);
  }
}

/**
 * Assert backend state
 */
function expectState(backend, expectedState) {
  expect(backend._state).toBe(expectedState);
}

/**
 * Assert that result contains status header
 */
function expectStatusHeader(result) {
  expect(result.content[0].text).toMatch(/✅|🔴|🟡|⏳/); // Has status emoji
}

/**
 * Assert that result contains specific tool count
 */
function expectToolCount(result, count) {
  expect(result.tools).toBeDefined();
  expect(result.tools).toHaveLength(count);
}

/**
 * Assert that mock was called with specific parameters
 */
function expectCalledWith(mockFn, ...args) {
  expect(mockFn).toHaveBeenCalledWith(...args);
}

/**
 * Assert that mock was not called
 */
function expectNotCalled(mockFn) {
  expect(mockFn).not.toHaveBeenCalled();
}

/**
 * Assert that result contains valid JSON
 */
function expectValidJSON(result) {
  expect(() => {
    JSON.parse(result.content[0].text);
  }).not.toThrow();
}

module.exports = {
  expectError,
  expectSuccess,
  expectState,
  expectStatusHeader,
  expectToolCount,
  expectCalledWith,
  expectNotCalled,
  expectValidJSON
};
