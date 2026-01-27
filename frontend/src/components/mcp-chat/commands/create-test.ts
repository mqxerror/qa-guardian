// Feature #1698: /create-test command definition
// Feature #1706: Fixed to properly extract URL parameters
import { SlashCommand } from '../types';

// Helper to detect if a string looks like a URL/domain
function looksLikeUrl(str: string): boolean {
  // Check for common URL patterns: contains dot and looks like a domain
  // Examples: mercan.pa, example.com, https://example.com
  if (!str) return false;
  return /^(https?:\/\/)?[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z]{2,})+/.test(str) ||
         /\.(com|org|net|io|dev|app|co|pa|ai|me|us|uk|de|fr|es|it|nl|ru|cn|jp|br|au|ca|mx|in|gov|edu)$/i.test(str);
}

// Helper to ensure URL has protocol
function normalizeUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export const createTestCommand: SlashCommand = {
  name: '/create-test',
  description: 'Create a new test case',
  usage: '/create-test [url_or_name] [url]',
  parameters: [
    { name: 'url_or_name', description: 'URL to test or test name', required: true, type: 'string' },
    { name: 'url', description: 'Target URL (if first arg is name)', required: false, type: 'url' },
  ],
  toolMapping: 'create_test',
  category: 'testing',
  generatePrompt: (args) => {
    // Smart parameter handling:
    // - If first arg looks like URL, use it as URL and generate a name
    // - If first arg is a name and second is URL, use both
    // - If only name provided, create test without specific URL

    const firstArg = args[0] || '';
    const secondArg = args[1] || '';

    let testName: string;
    let targetUrl: string | null = null;

    if (looksLikeUrl(firstArg)) {
      // First arg is a URL - generate a name from the domain
      targetUrl = normalizeUrl(firstArg);
      const domain = firstArg.replace(/^https?:\/\//, '').split('/')[0];
      testName = `${domain} Test`;
    } else if (secondArg && looksLikeUrl(secondArg)) {
      // First arg is name, second is URL
      testName = firstArg;
      targetUrl = normalizeUrl(secondArg);
    } else {
      // Just a name, no URL
      testName = firstArg || 'New Test';
    }

    // Build a clear, explicit prompt for the AI
    if (targetUrl) {
      return `IMPORTANT: Create a test for the URL "${targetUrl}".

Use the create_test tool to create a test called "${testName}".

CRITICAL: The test MUST target the URL "${targetUrl}" (not example.com or any other placeholder).

Steps to include:
1. Navigate to ${targetUrl}
2. Verify the page loads correctly
3. Check for key elements on the page
4. Perform appropriate user interactions

Create this as an E2E test with proper Playwright steps targeting ${targetUrl}.`;
    } else {
      return `Use the create_test tool to create a test called "${testName}". Create the test with appropriate steps for an E2E test.`;
    }
  },
};
