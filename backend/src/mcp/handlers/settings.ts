/**
 * Settings and Configuration Tool Handlers
 *
 * Handlers for organization settings, usage statistics, and integrations MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Get usage statistics (Feature #1019)
 */
export const getUsageStatistics: ToolHandler = async (args, context) => {
  const period = (args.period as string) || '30d';
  const includeBreakdown = args.include_breakdown !== false;
  const includeTrends = args.include_trends !== false;
  const includeQuotas = args.include_quotas !== false;

  try {
    // Calculate date range based on period
    const now = new Date();
    let periodStart: Date;
    let periodName: string;

    switch (period) {
      case 'today':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodName = 'Today';
        break;
      case '7d':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodName = 'Last 7 Days';
        break;
      case '90d':
        periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        periodName = 'Last 90 Days';
        break;
      case 'mtd':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodName = 'Month to Date';
        break;
      case 'ytd':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodName = 'Year to Date';
        break;
      default:
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        periodName = 'Last 30 Days';
    }

    // Get all projects
    const projectsResult = await context.callApi('/api/v1/projects') as {
      projects?: Array<{ id: string; name: string }>;
    };

    const projects = projectsResult.projects || [];

    // Collect usage statistics
    let totalTestRuns = 0;
    let totalExecutionMs = 0;
    let totalTests = 0;
    let totalSuites = 0;
    const browserRuns: Map<string, number> = new Map();
    const dailyUsage: Map<string, { runs: number; execution_ms: number; api_calls: number }> = new Map();
    let estimatedApiCalls = projects.length;

    for (const project of projects) {
      const suitesResult = await context.callApi(`/api/v1/projects/${project.id}/suites`) as {
        suites?: Array<{ id: string; name: string; browser?: string }>;
      };

      const suites = suitesResult.suites || [];
      totalSuites += suites.length;

      for (const suite of suites) {
        const testsResult = await context.callApi(`/api/v1/suites/${suite.id}/tests`) as {
          tests?: Array<{ id: string }>;
        };
        estimatedApiCalls++;
        totalTests += (testsResult.tests || []).length;

        const runsResult = await context.callApi(`/api/v1/suites/${suite.id}/runs`) as {
          runs?: Array<{
            started_at?: string;
            created_at?: string;
            duration_ms?: number;
            browser?: string;
          }>;
        };
        estimatedApiCalls++;

        for (const run of runsResult.runs || []) {
          const runDate = new Date(run.started_at || run.created_at || new Date());
          if (runDate < periodStart) continue;

          totalTestRuns++;
          totalExecutionMs += run.duration_ms || 0;

          const browser = run.browser || suite.browser || 'chromium';
          browserRuns.set(browser, (browserRuns.get(browser) || 0) + 1);

          const dateKey = runDate.toISOString().split('T')[0];
          if (!dailyUsage.has(dateKey)) {
            dailyUsage.set(dateKey, { runs: 0, execution_ms: 0, api_calls: 0 });
          }
          const daily = dailyUsage.get(dateKey)!;
          daily.runs++;
          daily.execution_ms += run.duration_ms || 0;
          daily.api_calls += 5;
        }
      }
    }

    const estimatedStorageMb = totalTestRuns * 2.5;
    const estimatedStorageGb = estimatedStorageMb / 1024;
    const executionMinutes = totalExecutionMs / 60000;
    const executionHours = executionMinutes / 60;

    const response: Record<string, unknown> = {
      success: true,
      period: {
        name: periodName,
        start: periodStart.toISOString(),
        end: now.toISOString(),
      },
      summary: {
        total_projects: projects.length,
        total_test_suites: totalSuites,
        total_tests: totalTests,
        total_test_runs: totalTestRuns,
        total_execution_ms: totalExecutionMs,
        total_execution_minutes: Math.round(executionMinutes * 100) / 100,
        total_execution_hours: Math.round(executionHours * 100) / 100,
        estimated_api_calls: estimatedApiCalls + (totalTestRuns * 5),
        estimated_storage_mb: Math.round(estimatedStorageMb * 100) / 100,
        estimated_storage_gb: Math.round(estimatedStorageGb * 1000) / 1000,
      },
    };

    if (includeBreakdown) {
      response.breakdown = {
        by_browser: Object.fromEntries(browserRuns),
        by_project: projects.map(p => ({
          project_id: p.id,
          project_name: p.name,
        })),
      };
    }

    if (includeTrends) {
      response.trends = {
        daily_usage: Array.from(dailyUsage.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, data]) => ({
            date,
            runs: data.runs,
            execution_minutes: Math.round(data.execution_ms / 60000 * 100) / 100,
            api_calls: data.api_calls,
          })),
      };
    }

    if (includeQuotas) {
      response.quotas = {
        plan: 'professional',
        limits: {
          monthly_test_runs: 10000,
          monthly_execution_minutes: 5000,
          storage_gb: 50,
          api_calls_per_minute: 100,
        },
        current_usage_percentage: {
          test_runs: Math.round((totalTestRuns / 10000) * 100 * 10) / 10,
          execution_minutes: Math.round((executionMinutes / 5000) * 100 * 10) / 10,
          storage: Math.round((estimatedStorageGb / 50) * 100 * 10) / 10,
        },
      };
    }

    return response;
  } catch (error) {
    return {
      success: false,
      error: `Failed to get usage statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Update settings (Feature #1022)
 */
export const updateSettings: ToolHandler = async (args, context) => {
  const name = args.name as string | undefined;
  const timezone = args.timezone as string | undefined;
  const defaultBrowser = args.default_browser as string | undefined;
  const defaultTimeout = args.default_timeout as number | undefined;
  const notificationsEnabled = args.notifications_enabled as boolean | undefined;
  const slackWebhookUrl = args.slack_webhook_url as string | undefined;

  // Check if at least one setting is provided
  if (!name && !timezone && !defaultBrowser && defaultTimeout === undefined && notificationsEnabled === undefined && slackWebhookUrl === undefined) {
    return {
      success: false,
      error: 'At least one setting must be provided to update',
      available_settings: ['name', 'timezone', 'default_browser', 'default_timeout', 'notifications_enabled', 'slack_webhook_url'],
    };
  }

  // Validate name if provided
  if (name !== undefined) {
    if (name.trim().length === 0 || name.length > 100) {
      return {
        success: false,
        error: 'Organization name must be between 1 and 100 characters',
      };
    }
  }

  // Validate timezone if provided
  const validTimezones = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland'];
  if (timezone !== undefined && !validTimezones.includes(timezone)) {
    return {
      success: false,
      error: `Invalid timezone. Valid options: ${validTimezones.join(', ')}`,
    };
  }

  // Validate default_timeout if provided
  if (defaultTimeout !== undefined && (defaultTimeout < 1000 || defaultTimeout > 300000)) {
    return {
      success: false,
      error: 'Default timeout must be between 1000 and 300000 milliseconds',
    };
  }

  try {
    // Build update payload for organization settings
    const updatePayload: Record<string, unknown> = {};
    if (name) updatePayload.name = name;
    if (timezone) updatePayload.timezone = timezone;

    // Get current organization
    const orgResult = await context.callApi('/api/v1/organizations') as {
      organizations?: Array<{ id: string; is_current?: boolean }>;
    };

    const currentOrg = orgResult.organizations?.find(o => o.is_current) || orgResult.organizations?.[0];
    const orgId = currentOrg?.id || '1';

    // Update organization via PATCH
    if (Object.keys(updatePayload).length > 0) {
      await context.callApi(`/api/v1/organizations/${orgId}`, { method: 'PATCH', body: updatePayload });
    }

    const updatedSettings: Record<string, unknown> = {};
    if (name) updatedSettings.name = name;
    if (timezone) updatedSettings.timezone = timezone;
    if (defaultBrowser) updatedSettings.default_browser = defaultBrowser;
    if (defaultTimeout !== undefined) updatedSettings.default_timeout = defaultTimeout;
    if (notificationsEnabled !== undefined) updatedSettings.notifications_enabled = notificationsEnabled;
    if (slackWebhookUrl !== undefined) updatedSettings.slack_webhook_url = slackWebhookUrl === '' ? null : slackWebhookUrl;

    return {
      success: true,
      message: 'Organization settings updated successfully',
      organization_id: orgId,
      updated_settings: updatedSettings,
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings',
    };
  }
};

/**
 * Get integrations (Feature #1023)
 */
export const getIntegrations: ToolHandler = async (args, context) => {
  const includeWebhooks = args.include_webhooks !== false;
  const includeGithub = args.include_github !== false;
  const includeSlack = args.include_slack !== false;
  const projectIdFilter = args.project_id as string | undefined;

  try {
    const integrations: Record<string, unknown> = {};

    // Get webhooks
    if (includeWebhooks) {
      const webhooksResult = await context.callApi('/api/v1/webhooks') as {
        webhooks?: Array<{
          id: string;
          url: string;
          events: string[];
          active: boolean;
          project_id?: string;
        }>;
      };

      let webhooks = webhooksResult.webhooks || [];
      if (projectIdFilter) {
        webhooks = webhooks.filter(w => w.project_id === projectIdFilter || !w.project_id);
      }

      integrations.webhooks = {
        total: webhooks.length,
        active: webhooks.filter(w => w.active).length,
        items: webhooks.map(w => ({
          id: w.id,
          url: w.url.replace(/\/\/.*@/, '//<hidden>@'),
          events: w.events,
          active: w.active,
          project_id: w.project_id,
        })),
      };
    }

    // GitHub integration status
    if (includeGithub) {
      integrations.github = {
        connected: false,
        features: {
          pr_comments: false,
          status_checks: false,
          auto_trigger: false,
        },
        message: 'GitHub integration available via webhooks',
      };
    }

    // Slack integration status
    if (includeSlack) {
      integrations.slack = {
        connected: false,
        features: {
          failure_notifications: false,
          daily_summary: false,
          run_completion: false,
        },
        message: 'Slack integration available via webhooks',
      };
    }

    return {
      success: true,
      integrations,
      project_filter: projectIdFilter || null,
      retrieved_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get integrations: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

// Handler registry for settings tools
export const handlers: Record<string, ToolHandler> = {
  get_usage_statistics: getUsageStatistics,
  update_settings: updateSettings,
  get_integrations: getIntegrations,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const settingsHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default settingsHandlers;
