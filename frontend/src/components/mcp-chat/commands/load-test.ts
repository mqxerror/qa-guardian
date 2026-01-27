// Feature #1699: /load-test command definition
// Feature #1706: Enhanced URL parameter handling
import { SlashCommand } from '../types';

// Helper to ensure URL has protocol
function normalizeUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export const loadTestCommand: SlashCommand = {
  name: '/load-test',
  description: 'Run a load test',
  usage: '/load-test [url] [virtual_users]',
  parameters: [
    { name: 'url', description: 'Target URL for load testing', required: true, type: 'url' },
    { name: 'virtual_users', description: 'Number of virtual users', required: false, type: 'number', defaultValue: '10' },
  ],
  toolMapping: 'run_k6_test',
  category: 'testing',
  generatePrompt: (args) => {
    const rawUrl = args[0];
    const vus = args[1] || '10';

    if (!rawUrl) {
      return `Use create_k6_script and run_k6_test to run a load test with ${vus} virtual users.`;
    }

    const targetUrl = normalizeUrl(rawUrl);

    return `IMPORTANT: Run a load test on the URL "${targetUrl}" with ${vus} virtual users.

Use create_k6_script with target_url="${targetUrl}" to create a K6 script, then use run_k6_test to execute it.

CRITICAL: The load test MUST target "${targetUrl}" exactly as specified (not example.com or any placeholder).

Configure the test with:
- Target URL: ${targetUrl}
- Virtual Users: ${vus}
- Duration: 30 seconds`;
  },
};
