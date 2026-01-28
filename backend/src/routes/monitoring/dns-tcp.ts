/**
 * DNS and TCP Monitoring Routes
 *
 * Handles DNS record monitoring and TCP port availability checks.
 * Extracted from monitoring.ts for better code organization.
 *
 * DNS Endpoints:
 * - GET /api/v1/monitoring/dns - List all DNS checks
 * - POST /api/v1/monitoring/dns - Create a DNS check
 * - POST /api/v1/monitoring/dns/:checkId/run - Run DNS check manually
 * - GET /api/v1/monitoring/dns/:checkId - Get DNS check details
 * - PUT /api/v1/monitoring/dns/:checkId - Update DNS check
 * - DELETE /api/v1/monitoring/dns/:checkId - Delete DNS check
 * - POST /api/v1/monitoring/dns/:checkId/toggle - Toggle DNS check enabled/disabled
 *
 * TCP Endpoints:
 * - GET /api/v1/monitoring/tcp - List all TCP checks
 * - POST /api/v1/monitoring/tcp - Create a TCP check
 * - POST /api/v1/monitoring/tcp/:checkId/run - Run TCP check manually
 * - GET /api/v1/monitoring/tcp/:checkId - Get TCP check details
 * - DELETE /api/v1/monitoring/tcp/:checkId - Delete TCP check
 * - POST /api/v1/monitoring/tcp/:checkId/toggle - Toggle TCP check enabled/disabled
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';

import {
  DnsCheck,
  DnsCheckResult,
  TcpCheck,
  TcpCheckResult,
} from './types';

import {
  createDnsCheck,
  getDnsCheck,
  updateDnsCheck,
  deleteDnsCheck as dbDeleteDnsCheck,
  listDnsChecks,
  addDnsResult,
  getDnsResults,
  createTcpCheck,
  getTcpCheck,
  updateTcpCheck,
  deleteTcpCheck as dbDeleteTcpCheck,
  listTcpChecks,
  addTcpResult,
  getTcpResults,
} from './stores';

/**
 * Register DNS and TCP monitoring routes
 */
export async function dnsTcpRoutes(app: FastifyInstance): Promise<void> {
  // ==================== DNS MONITORING ENDPOINTS ====================

  // Get all DNS checks
  app.get(
    '/api/v1/monitoring/dns',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const allDnsChecks = await listDnsChecks(orgId);
      const checks = await Promise.all(allDnsChecks.map(async (check) => {
          const results = await getDnsResults(check.id);
          const latestResult = results[0];

          return {
            ...check,
            created_at: check.created_at.toISOString(),
            updated_at: check.updated_at.toISOString(),
            latest_status: latestResult?.status || 'unknown',
            latest_response_time: latestResult?.response_time,
            latest_checked_at: latestResult?.checked_at.toISOString(),
            latest_resolved_values: latestResult?.resolved_values || [],
          };
        }));

      return { checks, total: checks.length };
    }
  );

  // Create a DNS check
  app.post<{
    Body: {
      name: string;
      domain: string;
      record_type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';
      expected_values?: string[];
      nameservers?: string[];
      interval?: number;
      timeout?: number;
    };
  }>(
    '/api/v1/monitoring/dns',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { name, domain, record_type, expected_values, nameservers, interval = 60, timeout = 5000 } = request.body;
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload;

      if (!name || name.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Name is required',
        });
      }

      if (!domain || domain.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Domain is required',
        });
      }

      if (!record_type) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Record type is required (A, AAAA, CNAME, MX, TXT, or NS)',
        });
      }

      const validRecordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];
      if (!validRecordTypes.includes(record_type)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid record type. Must be one of: ${validRecordTypes.join(', ')}`,
        });
      }

      if (interval < 30 || interval > 3600) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Interval must be between 30 and 3600 seconds',
        });
      }

      const checkId = `dns-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const check: DnsCheck = {
        id: checkId,
        organization_id: orgId,
        name: name.trim(),
        domain: domain.trim().toLowerCase(),
        record_type,
        expected_values: expected_values || [],
        nameservers: nameservers || [],
        interval,
        timeout,
        enabled: true,
        created_by: user.id,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await createDnsCheck(check);

      logAuditEntry(
        request,
        'monitoring.dns.created',
        'dns_check',
        checkId,
        check.name,
        { domain, record_type, expected_values }
      );

      return reply.status(201).send({
        message: 'DNS check created successfully',
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
        },
      });
    }
  );

  // Run DNS check manually
  app.post<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/dns/:checkId/run',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = await getDnsCheck(checkId);
      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'DNS check not found',
        });
      }

      // Simulate DNS resolution
      const startTime = Date.now();

      // Simulate DNS resolution based on domain and record type
      let resolvedValues: string[] = [];
      let error: string | undefined;
      let ttl = 300;
      let nameserverUsed = check.nameservers?.[0] || '8.8.8.8';

      // Simulate DNS resolution with realistic values
      const simulateDnsResolution = (domain: string, recordType: string): string[] => {
        // For testing purposes, return different values based on domain
        const domainHash = domain.split('').reduce((a, b) => a + b.charCodeAt(0), 0);

        switch (recordType) {
          case 'A':
            // Return IPv4 addresses
            return [`${(domainHash % 200) + 1}.${(domainHash % 100) + 50}.${(domainHash % 50) + 1}.${(domainHash % 254) + 1}`];
          case 'AAAA':
            // Return IPv6 addresses
            return [`2001:4860:4860::${(domainHash % 9000 + 1000).toString(16)}`];
          case 'CNAME':
            return [`cdn.${domain}`];
          case 'MX':
            return [`mail.${domain}`, `mail2.${domain}`];
          case 'TXT':
            return [`v=spf1 include:_spf.${domain} ~all`];
          case 'NS':
            return [`ns1.${domain}`, `ns2.${domain}`];
          default:
            return [];
        }
      };

      try {
        // Simulate network delay
        const responseTime = Math.random() * 50 + 10; // 10-60ms

        // Check if domain looks invalid
        if (!check.domain.includes('.') || check.domain.length < 4) {
          throw new Error('NXDOMAIN: Domain does not exist');
        }

        resolvedValues = simulateDnsResolution(check.domain, check.record_type);

        // Simulate occasional failures
        if (Math.random() < 0.02) { // 2% failure rate
          throw new Error('DNS query timeout');
        }

      } catch (e) {
        error = (e as Error).message;
      }

      const responseTime = Date.now() - startTime + Math.random() * 30;

      // Calculate status based on expected values
      let status: 'up' | 'down' | 'degraded' = 'up';
      let allExpectedFound = true;
      let unexpectedValues: string[] = [];

      if (error) {
        status = 'down';
        allExpectedFound = false;
      } else if (check.expected_values && check.expected_values.length > 0) {
        // Check if all expected values are found
        const expectedSet = new Set(check.expected_values.map(v => v.toLowerCase()));
        const resolvedSet = new Set(resolvedValues.map(v => v.toLowerCase()));

        allExpectedFound = check.expected_values.every(v =>
          resolvedValues.some(r => r.toLowerCase() === v.toLowerCase())
        );

        unexpectedValues = resolvedValues.filter(v =>
          !check.expected_values!.some(e => e.toLowerCase() === v.toLowerCase())
        );

        if (!allExpectedFound) {
          status = 'degraded';
        }
      }

      const result: DnsCheckResult = {
        id: `dns-result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        check_id: checkId,
        status,
        resolved_values: resolvedValues,
        expected_values: check.expected_values || [],
        response_time: Math.round(responseTime),
        nameserver_used: nameserverUsed,
        error,
        ttl,
        all_expected_found: allExpectedFound,
        unexpected_values: unexpectedValues,
        checked_at: new Date(),
      };

      // Store result
      await addDnsResult(result);

      return {
        message: 'DNS check executed',
        result: {
          ...result,
          checked_at: result.checked_at.toISOString(),
        },
      };
    }
  );

  // Get DNS check details with results
  app.get<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/dns/:checkId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = await getDnsCheck(checkId);
      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'DNS check not found',
        });
      }

      const results = await getDnsResults(checkId);

      return {
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
        },
        results: results.slice(0, 20).map(r => ({
          ...r,
          checked_at: r.checked_at.toISOString(),
        })),
      };
    }
  );

  // Update DNS check
  app.put<{
    Params: { checkId: string };
    Body: {
      name?: string;
      domain?: string;
      record_type?: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';
      expected_values?: string[];
      nameservers?: string[];
      interval?: number;
      timeout?: number;
      enabled?: boolean;
    };
  }>(
    '/api/v1/monitoring/dns/:checkId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);
      const updates = request.body;

      const check = await getDnsCheck(checkId);
      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'DNS check not found',
        });
      }

      // Apply updates
      if (updates.name !== undefined) check.name = updates.name.trim();
      if (updates.domain !== undefined) check.domain = updates.domain.trim().toLowerCase();
      if (updates.record_type !== undefined) check.record_type = updates.record_type;
      if (updates.expected_values !== undefined) check.expected_values = updates.expected_values;
      if (updates.nameservers !== undefined) check.nameservers = updates.nameservers;
      if (updates.interval !== undefined) check.interval = updates.interval;
      if (updates.timeout !== undefined) check.timeout = updates.timeout;
      if (updates.enabled !== undefined) check.enabled = updates.enabled;
      check.updated_at = new Date();

      await updateDnsCheck(checkId, check);

      logAuditEntry(
        request,
        'monitoring.dns.updated',
        'dns_check',
        checkId,
        check.name,
        updates
      );

      return {
        message: 'DNS check updated successfully',
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
        },
      };
    }
  );

  // Delete DNS check
  app.delete<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/dns/:checkId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = await getDnsCheck(checkId);
      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'DNS check not found',
        });
      }

      await dbDeleteDnsCheck(checkId);

      logAuditEntry(
        request,
        'monitoring.dns.deleted',
        'dns_check',
        checkId,
        check.name,
        {}
      );

      return {
        message: 'DNS check deleted successfully',
      };
    }
  );

  // Toggle DNS check enabled/disabled
  app.post<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/dns/:checkId/toggle',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = await getDnsCheck(checkId);
      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'DNS check not found',
        });
      }

      check.enabled = !check.enabled;
      check.updated_at = new Date();
      await updateDnsCheck(checkId, check);

      logAuditEntry(
        request,
        check.enabled ? 'monitoring.dns.enabled' : 'monitoring.dns.disabled',
        'dns_check',
        checkId,
        check.name,
        {}
      );

      return {
        message: `DNS check ${check.enabled ? 'enabled' : 'disabled'} successfully`,
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
        },
      };
    }
  );

  // ==================== TCP PORT MONITORING ENDPOINTS ====================

  // Get all TCP checks
  app.get(
    '/api/v1/monitoring/tcp',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const allTcpChecks = await listTcpChecks(orgId);
      const checks = await Promise.all(allTcpChecks.map(async (check) => {
          const results = await getTcpResults(check.id);
          const latestResult = results[0];

          return {
            ...check,
            created_at: check.created_at.toISOString(),
            updated_at: check.updated_at.toISOString(),
            latest_status: latestResult?.status || 'unknown',
            latest_port_open: latestResult?.port_open,
            latest_response_time: latestResult?.response_time,
            latest_checked_at: latestResult?.checked_at.toISOString(),
          };
        }));

      return { checks, total: checks.length };
    }
  );

  // Create a TCP check
  app.post<{
    Body: {
      name: string;
      host: string;
      port: number;
      timeout?: number;
      interval?: number;
    };
  }>(
    '/api/v1/monitoring/tcp',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { name, host, port, timeout = 5000, interval = 60 } = request.body;
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload;

      if (!name || name.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Name is required',
        });
      }

      if (!host || host.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Host is required',
        });
      }

      if (!port || port < 1 || port > 65535) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Port must be between 1 and 65535',
        });
      }

      if (interval < 30 || interval > 3600) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Interval must be between 30 and 3600 seconds',
        });
      }

      const checkId = `tcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const check: TcpCheck = {
        id: checkId,
        organization_id: orgId,
        name: name.trim(),
        host: host.trim().toLowerCase(),
        port,
        timeout,
        interval,
        enabled: true,
        created_by: user.id,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await createTcpCheck(check);

      logAuditEntry(
        request,
        'monitoring.tcp.created',
        'tcp_check',
        checkId,
        check.name,
        { host, port }
      );

      return reply.status(201).send({
        message: 'TCP check created successfully',
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
        },
      });
    }
  );

  // Run TCP check manually
  app.post<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/tcp/:checkId/run',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = await getTcpCheck(checkId);
      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'TCP check not found',
        });
      }

      // Simulate TCP port check
      const startTime = Date.now();
      let portOpen = false;
      let error: string | undefined;

      // Simulate TCP connection based on well-known ports
      const simulateTcpConnection = (host: string, port: number): boolean => {
        // Common open ports for simulation
        const commonOpenPorts = [22, 80, 443, 3000, 3001, 5173, 8080, 8443, 3306, 5432, 6379, 27017];

        // Localhost ports are always "open" in development
        if (host === 'localhost' || host === '127.0.0.1') {
          return commonOpenPorts.includes(port) || port > 1024;
        }

        // For other hosts, simulate based on port
        if (commonOpenPorts.includes(port)) {
          // 90% chance of being open for common ports
          return Math.random() < 0.9;
        }

        // 30% chance for random ports
        return Math.random() < 0.3;
      };

      try {
        // Check if host looks invalid
        if (check.host.length < 1) {
          throw new Error('Connection refused: Invalid host');
        }

        portOpen = simulateTcpConnection(check.host, check.port);

        if (!portOpen) {
          error = `Connection refused: Port ${check.port} is closed`;
        }

        // Simulate occasional timeouts
        if (Math.random() < 0.02) { // 2% timeout rate
          throw new Error('Connection timeout');
        }

      } catch (e) {
        error = (e as Error).message;
        portOpen = false;
      }

      const responseTime = Date.now() - startTime + Math.random() * 20;

      const result: TcpCheckResult = {
        id: `tcp-result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        check_id: checkId,
        status: portOpen ? 'up' : 'down',
        port_open: portOpen,
        response_time: Math.round(responseTime),
        error,
        checked_at: new Date(),
      };

      // Store result
      await addTcpResult(result);

      return {
        message: 'TCP check executed',
        result: {
          ...result,
          checked_at: result.checked_at.toISOString(),
        },
      };
    }
  );

  // Get TCP check details with results
  app.get<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/tcp/:checkId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = await getTcpCheck(checkId);
      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'TCP check not found',
        });
      }

      const results = await getTcpResults(checkId);

      return {
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
        },
        results: results.slice(0, 20).map(r => ({
          ...r,
          checked_at: r.checked_at.toISOString(),
        })),
      };
    }
  );

  // Delete TCP check
  app.delete<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/tcp/:checkId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = await getTcpCheck(checkId);
      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'TCP check not found',
        });
      }

      await dbDeleteTcpCheck(checkId);

      logAuditEntry(
        request,
        'monitoring.tcp.deleted',
        'tcp_check',
        checkId,
        check.name,
        {}
      );

      return {
        message: 'TCP check deleted successfully',
      };
    }
  );

  // Toggle TCP check enabled/disabled
  app.post<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/tcp/:checkId/toggle',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = await getTcpCheck(checkId);
      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'TCP check not found',
        });
      }

      check.enabled = !check.enabled;
      check.updated_at = new Date();
      await updateTcpCheck(checkId, check);

      logAuditEntry(
        request,
        check.enabled ? 'monitoring.tcp.enabled' : 'monitoring.tcp.disabled',
        'tcp_check',
        checkId,
        check.name,
        {}
      );

      return {
        message: `TCP check ${check.enabled ? 'enabled' : 'disabled'} successfully`,
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
        },
      };
    }
  );
}
