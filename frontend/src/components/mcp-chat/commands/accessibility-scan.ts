// Feature #1699: /accessibility-scan command definition
// Feature #1706: Enhanced URL parameter handling
import { SlashCommand } from '../types';

// Helper to ensure URL has protocol
function normalizeUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export const accessibilityScanCommand: SlashCommand = {
  name: '/accessibility-scan',
  description: 'Run an accessibility scan',
  usage: '/accessibility-scan [url]',
  parameters: [
    { name: 'url', description: 'Target URL to scan', required: true, type: 'url' },
  ],
  toolMapping: 'run_accessibility_scan',
  category: 'testing',
  generatePrompt: (args) => {
    const rawUrl = args[0];
    if (!rawUrl) {
      return `Use run_accessibility_scan to check for WCAG accessibility violations. Report any issues found.`;
    }

    const targetUrl = normalizeUrl(rawUrl);

    return `IMPORTANT: Run an accessibility scan on the URL "${targetUrl}".

Use run_accessibility_scan with url="${targetUrl}" to check this specific website for WCAG accessibility violations.

CRITICAL: The scan MUST target "${targetUrl}" exactly as specified (not example.com or any placeholder).

Report any accessibility issues found including:
- Missing alt text
- Color contrast issues
- Keyboard navigation problems
- ARIA attribute issues`;
  },
};
