/**
 * Feature #BMAD: Tests for SSRF validation including DNS rebinding prevention
 *
 * Verifies that validateWebhookURLWithDNS correctly:
 * - Blocks private IPs resolved via DNS (DNS rebinding prevention)
 * - Blocks CGNAT range (100.64.0.0/10)
 * - Allows valid public URLs
 * - Passes through sync validation failures (malformed URLs, private IPs)
 * - Handles DNS resolution errors gracefully
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validateURLForSSRF,
  validateWebhookURLWithDNS,
  isPrivateIP,
} from '../utils/index.js';

// Mock dns/promises at top level — vitest hoists vi.mock() calls automatically.
// Default: resolve to a safe public IP. Tests override per-case.
// IMPORTANT: Must provide `default` key because production code uses default import:
//   import dns from 'node:dns/promises'   →  dns.resolve()
// Without `default`, the default import is undefined and dns.resolve() throws.
import * as dns from 'node:dns/promises';
vi.mock('node:dns/promises', () => {
  const mod = {
    resolve: vi.fn().mockResolvedValue(['93.184.216.34']),
    resolve6: vi.fn().mockRejectedValue(new Error('no AAAA')),
  };
  return { ...mod, default: mod };
});

// ============================================================
// DNS Rebinding Tests (mocked DNS resolution)
// ============================================================

describe('validateWebhookURLWithDNS - DNS rebinding prevention', () => {
  afterEach(() => {
    vi.mocked(dns.resolve).mockResolvedValue(['93.184.216.34']);
    vi.mocked(dns.resolve6).mockRejectedValue(new Error('no AAAA'));
  });

  it('blocks hostname resolving to 127.0.0.1 (loopback rebinding)', async () => {
    vi.mocked(dns.resolve).mockResolvedValue(['127.0.0.1']);

    const result = await validateWebhookURLWithDNS('https://evil.example.com/webhook', {
      allowLocalhost: false,
      isProduction: true,
    });
    expect(result.safe).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('blocks hostname resolving to 10.x.x.x (private network rebinding)', async () => {
    vi.mocked(dns.resolve).mockResolvedValue(['10.0.0.1']);

    const result = await validateWebhookURLWithDNS('https://attacker.com/api', {
      allowLocalhost: false,
      isProduction: true,
    });
    expect(result.safe).toBe(false);
  });

  it('blocks hostname resolving to 169.254.169.254 (cloud metadata)', async () => {
    vi.mocked(dns.resolve).mockResolvedValue(['169.254.169.254']);

    const result = await validateWebhookURLWithDNS('https://metadata-stealer.com/steal', {
      allowLocalhost: false,
      isProduction: true,
    });
    expect(result.safe).toBe(false);
  });

  it('blocks hostname resolving to 192.168.x.x (home network rebinding)', async () => {
    vi.mocked(dns.resolve).mockResolvedValue(['192.168.1.1']);

    const result = await validateWebhookURLWithDNS('https://rebind.example.com/', {
      allowLocalhost: false,
      isProduction: true,
    });
    expect(result.safe).toBe(false);
  });

  it('blocks hostname resolving to CGNAT range 100.64.x.x', async () => {
    vi.mocked(dns.resolve).mockResolvedValue(['100.64.0.1']);

    const result = await validateWebhookURLWithDNS('https://cgnat-target.com/internal', {
      allowLocalhost: false,
      isProduction: true,
    });
    expect(result.safe).toBe(false);
  });

  it('allows hostname resolving to public IP', async () => {
    vi.mocked(dns.resolve).mockResolvedValue(['93.184.216.34']);

    const result = await validateWebhookURLWithDNS('https://safe-site.com/webhook', {
      allowLocalhost: false,
      isProduction: true,
    });
    expect(result.safe).toBe(true);
  });

  it('blocks when any resolved IP is private (multiple A records)', async () => {
    vi.mocked(dns.resolve).mockResolvedValue(['93.184.216.34', '10.0.0.1']);

    const result = await validateWebhookURLWithDNS('https://mixed-dns.example.com/', {
      allowLocalhost: false,
      isProduction: true,
    });
    expect(result.safe).toBe(false);
  });

  it('blocks DNS resolution failure in production mode', async () => {
    vi.mocked(dns.resolve).mockRejectedValue(new Error('ENOTFOUND'));
    vi.mocked(dns.resolve6).mockRejectedValue(new Error('ENOTFOUND'));

    const result = await validateWebhookURLWithDNS('https://nonexistent.example.com/', {
      allowLocalhost: false,
      isProduction: true,
    });
    expect(result.safe).toBe(false);
  });
});

// ============================================================
// Direct URL validation (literal IPs bypass DNS, mock irrelevant)
// ============================================================

describe('validateWebhookURLWithDNS (direct URLs)', () => {
  it('allows valid public URLs', async () => {
    const result = await validateWebhookURLWithDNS('https://example.com/webhook', {
      allowLocalhost: false,
    });
    expect(result.safe).toBe(true);
  });

  it('blocks private IP addresses in URL', async () => {
    const result = await validateWebhookURLWithDNS('http://192.168.1.1/admin', {
      allowLocalhost: false,
    });
    expect(result.safe).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('blocks localhost when allowLocalhost is false', async () => {
    const result = await validateWebhookURLWithDNS('http://localhost:3000/hook', {
      allowLocalhost: false,
    });
    expect(result.safe).toBe(false);
  });

  it('allows localhost when allowLocalhost is true', async () => {
    const result = await validateWebhookURLWithDNS('http://localhost:3000/hook', {
      allowLocalhost: true,
    });
    expect(result.safe).toBe(true);
  });

  it('blocks 10.x.x.x private range', async () => {
    const result = await validateWebhookURLWithDNS('http://10.0.0.1:8080/api', {
      allowLocalhost: false,
    });
    expect(result.safe).toBe(false);
  });

  it('blocks 172.16.x.x private range', async () => {
    const result = await validateWebhookURLWithDNS('http://172.16.0.1/internal', {
      allowLocalhost: false,
    });
    expect(result.safe).toBe(false);
  });

  it('blocks 127.0.0.1 loopback', async () => {
    const result = await validateWebhookURLWithDNS('http://127.0.0.1:9090', {
      allowLocalhost: false,
    });
    expect(result.safe).toBe(false);
  });

  it('rejects malformed URLs', async () => {
    const result = await validateWebhookURLWithDNS('not-a-url', {
      allowLocalhost: false,
    });
    expect(result.safe).toBe(false);
  });

  it('rejects URLs without protocol', async () => {
    const result = await validateWebhookURLWithDNS('example.com/webhook', {
      allowLocalhost: false,
    });
    expect(result.safe).toBe(false);
  });
});

// ============================================================
// isPrivateIP tests (including CGNAT range)
// ============================================================

describe('isPrivateIP', () => {
  it('identifies 10.x.x.x as private', () => {
    expect(isPrivateIP('10.0.0.1').isPrivate).toBe(true);
    expect(isPrivateIP('10.255.255.255').isPrivate).toBe(true);
  });

  it('identifies 172.16-31.x.x as private', () => {
    expect(isPrivateIP('172.16.0.1').isPrivate).toBe(true);
    expect(isPrivateIP('172.31.255.255').isPrivate).toBe(true);
  });

  it('identifies 192.168.x.x as private', () => {
    expect(isPrivateIP('192.168.0.1').isPrivate).toBe(true);
    expect(isPrivateIP('192.168.255.255').isPrivate).toBe(true);
  });

  it('identifies 127.x.x.x as loopback', () => {
    expect(isPrivateIP('127.0.0.1').isPrivate).toBe(true);
  });

  it('identifies 0.0.0.0 as private', () => {
    expect(isPrivateIP('0.0.0.0').isPrivate).toBe(true);
  });

  it('identifies 169.254.x.x as link-local', () => {
    expect(isPrivateIP('169.254.169.254').isPrivate).toBe(true);
    expect(isPrivateIP('169.254.0.1').isPrivate).toBe(true);
  });

  it('identifies CGNAT range 100.64.x.x as private', () => {
    expect(isPrivateIP('100.64.0.1').isPrivate).toBe(true);
    expect(isPrivateIP('100.127.255.255').isPrivate).toBe(true);
  });

  it('allows IPs outside CGNAT range', () => {
    expect(isPrivateIP('100.63.255.255').isPrivate).toBe(false);
    expect(isPrivateIP('100.128.0.0').isPrivate).toBe(false);
  });

  it('allows public IPs', () => {
    expect(isPrivateIP('8.8.8.8').isPrivate).toBe(false);
    expect(isPrivateIP('93.184.216.34').isPrivate).toBe(false);
    expect(isPrivateIP('1.1.1.1').isPrivate).toBe(false);
  });

  it('allows 172.32+ (outside private range)', () => {
    expect(isPrivateIP('172.32.0.1').isPrivate).toBe(false);
  });
});

// ============================================================
// Sync SSRF validation
// ============================================================

describe('validateURLForSSRF (sync)', () => {
  it('blocks private IPs without DNS resolution', () => {
    const result = validateURLForSSRF('http://192.168.1.1/admin', {
      allowLocalhost: false,
      requireHttps: false,
    });
    expect(result.safe).toBe(false);
  });

  it('allows public URLs', () => {
    const result = validateURLForSSRF('https://example.com', {
      allowLocalhost: false,
      requireHttps: false,
    });
    expect(result.safe).toBe(true);
  });

  it('blocks non-HTTP protocols', () => {
    const result = validateURLForSSRF('ftp://example.com/file', {
      allowLocalhost: false,
      requireHttps: false,
    });
    expect(result.safe).toBe(false);
  });

  it('blocks CGNAT range in direct IP URLs', () => {
    const result = validateURLForSSRF('http://100.64.0.1/admin', {
      allowLocalhost: false,
      requireHttps: false,
    });
    expect(result.safe).toBe(false);
  });
});
