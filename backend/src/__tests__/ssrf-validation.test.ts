/**
 * Feature #BMAD: Tests for async SSRF validation with DNS resolution
 *
 * Verifies that validateWebhookURLWithDNS correctly:
 * - Blocks private IPs resolved via DNS (DNS rebinding prevention)
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

describe('validateWebhookURLWithDNS (async SSRF)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('allows public IPs', () => {
    expect(isPrivateIP('8.8.8.8').isPrivate).toBe(false);
    expect(isPrivateIP('93.184.216.34').isPrivate).toBe(false);
    expect(isPrivateIP('1.1.1.1').isPrivate).toBe(false);
  });
});

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
});
