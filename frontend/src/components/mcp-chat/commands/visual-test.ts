// Feature #1699: /visual-test command definition
// Feature #1706: Enhanced URL parameter handling
import { SlashCommand } from '../types';

// Helper to ensure URL has protocol
function normalizeUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export const visualTestCommand: SlashCommand = {
  name: '/visual-test',
  description: 'Create a visual regression test',
  usage: '/visual-test [url]',
  parameters: [
    { name: 'url', description: 'Target URL for visual testing', required: true, type: 'url' },
  ],
  toolMapping: 'create_test',
  category: 'testing',
  generatePrompt: (args) => {
    const rawUrl = args[0];
    if (!rawUrl) {
      return `Use create_test to create a visual regression test. Set test_type to visual_regression and add steps for full-page screenshot capture.`;
    }

    const targetUrl = normalizeUrl(rawUrl);
    const domain = rawUrl.replace(/^https?:\/\//, '').split('/')[0];

    return `IMPORTANT: Create a visual regression test for the URL "${targetUrl}".

Use create_test to create a visual regression test called "${domain} Visual Test".

CRITICAL: The test MUST target "${targetUrl}" exactly as specified (not example.com or any placeholder).

Configure the test with:
- test_type: visual_regression
- target_url: ${targetUrl}
- name: "${domain} Visual Test"

Steps to include:
1. Navigate to ${targetUrl}
2. Wait for page to fully load
3. Capture full-page screenshot for baseline comparison`;
  },
};
