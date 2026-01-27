// Feature #1698: /security-scan command definition
// Feature #1706: Enhanced URL parameter handling
import { SlashCommand } from '../types';

// Helper to ensure URL has protocol
function normalizeUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export const securityScanCommand: SlashCommand = {
  name: '/security-scan',
  description: 'Run a security scan on a URL',
  usage: '/security-scan [url]',
  parameters: [
    { name: 'url', description: 'Target URL to scan', required: true, type: 'url' },
  ],
  toolMapping: 'run_dast_scan',
  category: 'security',
  generatePrompt: (args) => {
    const rawUrl = args[0];
    if (!rawUrl) {
      return `Use run_security_scan or run_dast_scan to run a security scan. Report any vulnerabilities found.`;
    }

    const targetUrl = normalizeUrl(rawUrl);

    return `IMPORTANT: Run a security scan on the URL "${targetUrl}".

Use run_dast_scan with target_url="${targetUrl}" to scan this specific website.

CRITICAL: The scan MUST target "${targetUrl}" exactly as specified (not example.com or any placeholder).

Report any vulnerabilities found including:
- SQL injection risks
- XSS vulnerabilities
- Missing security headers
- Other DAST findings`;
  },
};
