// MCP Tool tracking and analytics functions

import crypto from 'crypto';
import { McpToolCall } from './types';
import {
  dbGetMcpConnection,
  dbCreateMcpToolCall,
  dbGetMcpToolCallsByOrg,
  dbGetApiKeyById,
} from './stores';

// Track a tool call (async)
export async function trackMcpToolCall(
  connectionId: string,
  toolName: string,
  durationMs?: number,
  success: boolean = true,
  error?: string
): Promise<void> {
  const connection = await dbGetMcpConnection(connectionId);
  if (!connection) {
    console.warn(`[MCP Analytics] Cannot track tool call - connection ${connectionId} not found`);
    return;
  }

  const toolCall: McpToolCall = {
    id: `tool_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    connection_id: connectionId,
    organization_id: connection.organization_id,
    api_key_id: connection.api_key_id,
    tool_name: toolName,
    timestamp: new Date(),
    duration_ms: durationMs,
    success,
    error,
  };

  await dbCreateMcpToolCall(toolCall);

  console.log(`[MCP Analytics] Tracked tool call: ${toolName} for connection ${connectionId}`);
}

// Feature #848: Enhanced MCP analytics for dashboard (async)
export async function getMcpAnalytics(orgId: string, since?: Date): Promise<{
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  by_tool: Record<string, { count: number; avg_duration_ms?: number; success_rate: number }>;
  by_api_key: Record<string, { name: string; count: number }>;
  by_day: Array<{ date: string; total: number; success: number; failed: number }>;
  avg_response_time_ms: number;
  recent_calls: McpToolCall[];
}> {
  const filteredCalls = await dbGetMcpToolCallsByOrg(orgId, since);

  const totalCalls = filteredCalls.length;
  const successfulCalls = filteredCalls.filter(c => c.success).length;
  const failedCalls = totalCalls - successfulCalls;

  // Group by tool name
  const byTool: Record<string, { count: number; total_duration: number; success_count: number }> = {};
  for (const call of filteredCalls) {
    if (!byTool[call.tool_name]) {
      byTool[call.tool_name] = { count: 0, total_duration: 0, success_count: 0 };
    }
    byTool[call.tool_name].count++;
    if (call.duration_ms) {
      byTool[call.tool_name].total_duration += call.duration_ms;
    }
    if (call.success) {
      byTool[call.tool_name].success_count++;
    }
  }

  // Transform to output format
  const byToolOutput: Record<string, { count: number; avg_duration_ms?: number; success_rate: number }> = {};
  for (const [toolName, stats] of Object.entries(byTool)) {
    byToolOutput[toolName] = {
      count: stats.count,
      avg_duration_ms: stats.total_duration > 0 ? Math.round(stats.total_duration / stats.count) : undefined,
      success_rate: Math.round((stats.success_count / stats.count) * 100) / 100,
    };
  }

  // Group by API key
  const byApiKey: Record<string, { name: string; count: number }> = {};
  for (const call of filteredCalls) {
    if (!byApiKey[call.api_key_id]) {
      // Look up API key name via async DB
      const apiKey = await dbGetApiKeyById(call.api_key_id);
      byApiKey[call.api_key_id] = {
        name: apiKey?.name || 'Unknown',
        count: 0,
      };
    }
    byApiKey[call.api_key_id].count++;
  }

  // Get recent calls (last 20)
  const recentCalls = filteredCalls.slice(-20).reverse();

  // Feature #848: Calculate daily breakdown
  const byDayMap: Record<string, { total: number; success: number; failed: number }> = {};
  for (const call of filteredCalls) {
    const dateKey = call.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!byDayMap[dateKey!]) {
      byDayMap[dateKey!] = { total: 0, success: 0, failed: 0 };
    }
    byDayMap[dateKey!]!.total++;
    if (call.success) {
      byDayMap[dateKey!]!.success++;
    } else {
      byDayMap[dateKey!]!.failed++;
    }
  }

  // Sort by date and convert to array
  const byDay = Object.entries(byDayMap)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate average response time
  let totalDuration = 0;
  let callsWithDuration = 0;
  for (const call of filteredCalls) {
    if (call.duration_ms) {
      totalDuration += call.duration_ms;
      callsWithDuration++;
    }
  }
  const avgResponseTimeMs = callsWithDuration > 0 ? Math.round(totalDuration / callsWithDuration) : 0;

  return {
    total_calls: totalCalls,
    successful_calls: successfulCalls,
    failed_calls: failedCalls,
    by_tool: byToolOutput,
    by_api_key: byApiKey,
    by_day: byDay,
    avg_response_time_ms: avgResponseTimeMs,
    recent_calls: recentCalls,
  };
}
