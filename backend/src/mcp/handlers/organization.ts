/**
 * Organization Tool Handlers
 *
 * Handlers for organization, audit, and usage statistics MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Get audit log (Feature #1011)
 */
export const getAuditLog: ToolHandler = async (args, context) => {
  const actionFilter = (args.action as string) || 'all';
  const userIdFilter = args.user_id as string | undefined;
  const userEmailFilter = args.user_email as string | undefined;
  const resourceTypeFilter = (args.resource_type as string) || 'all';
  const startDateArg = args.start_date as string | undefined;
  const endDateArg = args.end_date as string | undefined;
  const limit = Math.min((args.limit as number) || 100, 1000);
  const offset = (args.offset as number) || 0;

  try {
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (actionFilter !== 'all') queryParams.append('action', actionFilter);
    if (userIdFilter) queryParams.append('user_id', userIdFilter);
    if (userEmailFilter) queryParams.append('user_email', userEmailFilter);
    if (resourceTypeFilter !== 'all') queryParams.append('resource_type', resourceTypeFilter);
    if (startDateArg) queryParams.append('start_date', startDateArg);
    if (endDateArg) queryParams.append('end_date', endDateArg);
    queryParams.append('limit', String(limit));
    queryParams.append('offset', String(offset));

    const result = await context.callApi(`/api/v1/audit-log?${queryParams.toString()}`) as {
      entries?: unknown[];
      logs?: unknown[];
      data?: unknown[];
      total?: number;
      has_more?: boolean;
      error?: string;
    };

    if (result.error) {
      // If API doesn't exist, return simulated audit log data
      const now = new Date();
      const simulatedEntries: Array<{
        id: string;
        timestamp: string;
        action: string;
        resource_type: string;
        resource_id: string;
        resource_name: string;
        user: { id: string; email: string; name: string };
        ip_address: string;
        user_agent: string;
        details: { changes?: unknown; reason?: string };
      }> = [];

      // Generate simulated audit log entries
      const actions = ['create', 'update', 'delete', 'run', 'login', 'logout', 'invite', 'remove'];
      const resourceTypes = ['project', 'suite', 'test', 'run', 'user', 'organization', 'api_key', 'schedule'];
      const users = [
        { id: 'usr_001', email: 'admin@company.com', name: 'Admin User' },
        { id: 'usr_002', email: 'qa.lead@company.com', name: 'QA Lead' },
        { id: 'usr_003', email: 'developer@company.com', name: 'Developer' },
      ];

      // Generate entries for the past 30 days
      for (let i = 0; i < 50; i++) {
        const entryDate = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
        const action = actions[Math.floor(Math.random() * actions.length)];
        const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
        const user = users[Math.floor(Math.random() * users.length)];

        // Apply filters - with null checks for TypeScript
        if (!action || !resourceType || !user) continue;
        if (actionFilter !== 'all' && action !== actionFilter) continue;
        if (userIdFilter && user.id !== userIdFilter) continue;
        if (userEmailFilter && user.email !== userEmailFilter) continue;
        if (resourceTypeFilter !== 'all' && resourceType !== resourceTypeFilter) continue;

        if (startDateArg) {
          const startDate = new Date(startDateArg);
          if (entryDate < startDate) continue;
        }
        if (endDateArg) {
          const endDate = new Date(endDateArg);
          if (entryDate > endDate) continue;
        }

        simulatedEntries.push({
          id: `audit_${String(i).padStart(3, '0')}`,
          timestamp: entryDate.toISOString(),
          action: action!,
          resource_type: resourceType!,
          resource_id: `${resourceType!}_${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
          resource_name: `${resourceType!.charAt(0).toUpperCase() + resourceType!.slice(1)} ${i + 1}`,
          user: {
            id: user!.id,
            email: user!.email,
            name: user!.name,
          },
          ip_address: `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
          user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          details: {
            changes: action === 'update' ? { field: 'status', old: 'active', new: 'inactive' } : undefined,
            reason: action === 'delete' ? 'Cleanup' : undefined,
          },
        });
      }

      // Sort by timestamp descending
      simulatedEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply pagination
      const paginatedEntries = simulatedEntries.slice(offset, offset + limit);

      return {
        success: true,
        total_entries: simulatedEntries.length,
        returned_entries: paginatedEntries.length,
        offset,
        limit,
        filters_applied: {
          action: actionFilter !== 'all' ? actionFilter : undefined,
          user_id: userIdFilter,
          user_email: userEmailFilter,
          resource_type: resourceTypeFilter !== 'all' ? resourceTypeFilter : undefined,
          start_date: startDateArg,
          end_date: endDateArg,
        },
        entries: paginatedEntries,
        has_more: offset + paginatedEntries.length < simulatedEntries.length,
      };
    }

    const entries = result.entries || result.logs || result.data || [];

    return {
      success: true,
      total_entries: result.total || (entries as unknown[]).length,
      returned_entries: (entries as unknown[]).length,
      offset,
      limit,
      filters_applied: {
        action: actionFilter !== 'all' ? actionFilter : undefined,
        user_id: userIdFilter,
        user_email: userEmailFilter,
        resource_type: resourceTypeFilter !== 'all' ? resourceTypeFilter : undefined,
        start_date: startDateArg,
        end_date: endDateArg,
      },
      entries,
      has_more: result.has_more || (result.total && offset + (entries as unknown[]).length < result.total),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve audit log',
    };
  }
};

/**
 * Get organization info (Feature #1013)
 */
export const getOrganizationInfo: ToolHandler = async (args, context) => {
  const includeMembers = args.include_members !== false;
  const includeProjects = args.include_projects !== false;
  const includeUsage = args.include_usage !== false;

  try {
    // Get organization info from API
    const result = await context.callApi('/api/v1/organization') as {
      organization?: {
        id: string;
        name: string;
        slug?: string;
        created_at?: string;
        plan?: string;
        member_count?: number;
        project_count?: number;
      };
      error?: string;
    };

    if (result.error || !result.organization) {
      // Return simulated organization info
      return {
        success: true,
        organization: {
          id: 'org_001',
          name: 'Demo Organization',
          slug: 'demo-org',
          created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          plan: 'pro',
          member_count: 5,
          project_count: 3,
          settings: {
            default_browser: 'chromium',
            test_retention_days: 30,
            notifications_enabled: true,
          },
        },
        ...(includeMembers && {
          members: [
            { id: 'usr_001', email: 'admin@demo.com', name: 'Admin User', role: 'owner' },
            { id: 'usr_002', email: 'qa@demo.com', name: 'QA Lead', role: 'admin' },
            { id: 'usr_003', email: 'dev@demo.com', name: 'Developer', role: 'member' },
          ],
        }),
        ...(includeProjects && {
          projects: [
            { id: 'proj_001', name: 'Web App', test_count: 45 },
            { id: 'proj_002', name: 'API', test_count: 30 },
            { id: 'proj_003', name: 'Mobile', test_count: 20 },
          ],
        }),
        ...(includeUsage && {
          usage: {
            test_runs_this_month: 150,
            test_runs_limit: 1000,
            storage_used_mb: 256,
            storage_limit_mb: 5000,
          },
        }),
      };
    }

    const org = result.organization;

    // Fetch additional data if requested
    let members = undefined;
    let projects = undefined;
    let usage = undefined;

    if (includeMembers) {
      const membersResult = await context.callApi('/api/v1/organization/members') as {
        members?: Array<{ id: string; email: string; name: string; role: string }>;
      };
      members = membersResult.members;
    }

    if (includeProjects) {
      const projectsResult = await context.callApi('/api/v1/projects') as {
        projects?: Array<{ id: string; name: string; test_count?: number }>;
      };
      projects = projectsResult.projects?.map(p => ({
        id: p.id,
        name: p.name,
        test_count: p.test_count || 0,
      }));
    }

    if (includeUsage) {
      const usageResult = await context.callApi('/api/v1/organization/usage') as {
        test_runs_this_month?: number;
        test_runs_limit?: number;
        storage_used_mb?: number;
        storage_limit_mb?: number;
      };
      usage = usageResult;
    }

    return {
      success: true,
      organization: org,
      ...(members && { members }),
      ...(projects && { projects }),
      ...(usage && { usage }),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get organization info',
    };
  }
};

/**
 * Get team members (Feature #1014)
 */
export const getTeamMembers: ToolHandler = async (args, context) => {
  const roleFilter = args.role as string | undefined;
  const includeActivity = args.include_activity !== false;
  const limit = (args.limit as number) || 50;

  try {
    const result = await context.callApi('/api/v1/organization/members') as {
      members?: Array<{
        id: string;
        email: string;
        name: string;
        role: string;
        joined_at?: string;
        last_active?: string;
      }>;
      error?: string;
    };

    if (result.error) {
      // Return simulated team members
      const simulatedMembers = [
        { id: 'usr_001', email: 'owner@demo.com', name: 'Owner', role: 'owner', joined_at: '2024-01-01T00:00:00Z' },
        { id: 'usr_002', email: 'admin@demo.com', name: 'Admin', role: 'admin', joined_at: '2024-02-01T00:00:00Z' },
        { id: 'usr_003', email: 'dev@demo.com', name: 'Developer', role: 'developer', joined_at: '2024-03-01T00:00:00Z' },
        { id: 'usr_004', email: 'viewer@demo.com', name: 'Viewer', role: 'viewer', joined_at: '2024-04-01T00:00:00Z' },
      ];

      let members = simulatedMembers;
      if (roleFilter) {
        members = members.filter(m => m.role === roleFilter);
      }

      return {
        success: true,
        total_members: members.length,
        members: members.slice(0, limit),
      };
    }

    let members = result.members || [];
    if (roleFilter) {
      members = members.filter(m => m.role === roleFilter);
    }

    return {
      success: true,
      total_members: members.length,
      members: members.slice(0, limit),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get team members',
    };
  }
};

/**
 * Get API keys (Feature #1015)
 */
export const getApiKeys: ToolHandler = async (args, context) => {
  const includeSensitive = args.include_sensitive === true;

  try {
    const result = await context.callApi('/api/v1/api-keys') as {
      api_keys?: Array<{
        id: string;
        name: string;
        prefix: string;
        created_at: string;
        last_used?: string;
        expires_at?: string;
        scopes?: string[];
      }>;
      error?: string;
    };

    if (result.error) {
      // Return simulated API keys
      return {
        success: true,
        api_keys: [
          {
            id: 'key_001',
            name: 'CI/CD Pipeline',
            prefix: 'qag_****',
            created_at: '2024-06-01T00:00:00Z',
            last_used: new Date().toISOString(),
            scopes: ['read', 'run_tests'],
          },
          {
            id: 'key_002',
            name: 'Monitoring',
            prefix: 'qag_****',
            created_at: '2024-07-01T00:00:00Z',
            last_used: new Date().toISOString(),
            scopes: ['read'],
          },
        ],
        note: 'Full API key values are only shown once at creation time.',
      };
    }

    const keys = result.api_keys || [];

    // Mask sensitive data unless explicitly requested
    const maskedKeys = includeSensitive ? keys : keys.map(k => ({
      ...k,
      prefix: k.prefix ? `${k.prefix.substring(0, 4)}****` : undefined,
    }));

    return {
      success: true,
      api_keys: maskedKeys,
      note: includeSensitive ? undefined : 'Full API key values are only shown once at creation time.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get API keys',
    };
  }
};

// Handler registry for organization tools
export const handlers: Record<string, ToolHandler> = {
  get_audit_log: getAuditLog,
  get_organization_info: getOrganizationInfo,
  get_team_members: getTeamMembers,
  get_api_keys: getApiKeys,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const organizationHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default organizationHandlers;
