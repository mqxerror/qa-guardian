/**
 * Test Logger Utility for MCP Integration Tests
 * Feature #501
 *
 * Provides a simple wrapper around console for consistent test output formatting.
 * This is designed for integration test scripts that run standalone and need
 * readable terminal output (not structured logging like Pino).
 *
 * Usage:
 *   import { testLog, testPass, testFail, testSection, testResult } from './test-logger.js';
 *
 *   testSection('Authentication Tests');
 *   testLog('Testing API key validation...');
 *   testPass('API key validated successfully');
 *   testFail('Missing required header');
 *   testResult(passed, total);
 */

// ANSI color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
} as const;

// Check if colors should be disabled (CI environments, piped output)
const useColors = process.stdout.isTTY !== false && !process.env.NO_COLOR;

function colorize(color: keyof typeof COLORS, text: string): string {
  if (!useColors) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

/**
 * Log a general test message
 */
export function testLog(message: string, ...args: unknown[]): void {
  console.log(message, ...args);
}

/**
 * Log a success message with checkmark
 */
export function testPass(message: string): void {
  console.log(colorize('green', '✓'), message);
}

/**
 * Log a failure message with X mark
 */
export function testFail(message: string): void {
  console.log(colorize('red', '✗'), message);
}

/**
 * Log a warning message
 */
export function testWarn(message: string): void {
  console.log(colorize('yellow', '⚠'), message);
}

/**
 * Log a section header for organizing test output
 */
export function testSection(title: string): void {
  console.log('');
  console.log(colorize('cyan', `--- ${title} ---`));
}

/**
 * Log a step in a test sequence
 */
export function testStep(stepNum: number, description: string): void {
  console.log(colorize('dim', `Step ${stepNum}:`), description);
}

/**
 * Log test data/response (pretty-printed JSON)
 */
export function testData(label: string, data: unknown): void {
  console.log(colorize('dim', `  ${label}:`), JSON.stringify(data, null, 2));
}

/**
 * Log final test results summary
 */
export function testResult(passed: number, total: number): void {
  console.log('');
  console.log(colorize('bold', '--- Test Results ---'));
  const color = passed === total ? 'green' : passed > 0 ? 'yellow' : 'red';
  console.log(colorize(color, `Tests passed: ${passed}/${total}`));

  if (passed === total) {
    console.log('');
    console.log(colorize('green', '✓ All tests passed!'));
  } else {
    console.log('');
    console.log(colorize('red', `✗ ${total - passed} test(s) failed`));
  }
}

/**
 * Log an error with stack trace
 */
export function testError(message: string, error?: Error | unknown): void {
  console.error(colorize('red', '✗ ERROR:'), message);
  if (error instanceof Error) {
    console.error(colorize('dim', `  ${error.message}`));
    if (error.stack) {
      console.error(colorize('dim', error.stack.split('\n').slice(1).join('\n')));
    }
  } else if (error !== undefined) {
    console.error(colorize('dim', `  ${String(error)}`));
  }
}

/**
 * Create a test timer for measuring execution time
 */
export function testTimer(label: string): { stop: () => void } {
  const start = Date.now();
  return {
    stop: () => {
      const duration = Date.now() - start;
      console.log(colorize('dim', `  ${label}: ${duration}ms`));
    }
  };
}

/**
 * Log the start of a test file
 */
export function testStart(testName: string): void {
  console.log('');
  console.log(colorize('bold', `=== ${testName} ===`));
  console.log('');
}

/**
 * Exit with appropriate code based on test results
 */
export function testExit(passed: number, total: number): never {
  process.exit(passed === total ? 0 : 1);
}
