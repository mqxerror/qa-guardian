/**
 * Artifact Routes - Shared Helpers
 *
 * Common utilities and type imports used across artifact sub-route modules.
 * Feature #414: Type-safe server port extraction
 */

import { AddressInfo } from 'net';

// Feature #414: Type-safe server port extraction
interface FastifyServerWithAddress {
  server?: {
    address?: () => AddressInfo | string | null;
  };
}

export function getServerPort(server: unknown): number {
  const typedServer = server as FastifyServerWithAddress;
  const address = typedServer?.server?.address?.();
  if (address && typeof address === 'object' && 'port' in address) {
    return address.port;
  }
  return 3001; // Default port
}
