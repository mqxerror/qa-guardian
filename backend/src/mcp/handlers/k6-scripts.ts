/**
 * K6 Script Tool Handlers
 *
 * Handlers for K6 script creation and management MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Create K6 script (Feature #983)
 */
export const createK6Script: ToolHandler = async (args, context) => {
  const targetUrl = args.target_url as string;
  const testType = args.test_type as string;

  if (!targetUrl) {
    return { error: 'target_url is required' };
  }
  if (!testType) {
    return { error: 'test_type is required' };
  }

  const validTestTypes = ['simple', 'stress', 'spike', 'soak', 'breakpoint'];
  if (!validTestTypes.includes(testType)) {
    return { error: `Invalid test_type. Must be one of: ${validTestTypes.join(', ')}` };
  }

  // Validate URL format
  try {
    new URL(targetUrl);
  } catch {
    return { error: 'Invalid target_url format. Must be a valid URL.' };
  }

  const method = (args.method as string) || 'GET';
  const headers = args.headers as Record<string, string> | undefined;
  const body = args.body as string | undefined;
  const virtualUsers = (args.virtual_users as number) || 10;
  const durationSeconds = (args.duration_seconds as number) || 30;
  const rampUpSeconds = (args.ramp_up_seconds as number) || 0;
  const thresholds = args.thresholds as Record<string, string[]> | undefined;
  const checks = args.checks as Array<{ name: string; condition: string }> | undefined;
  const includeThinkTime = args.include_think_time !== false;
  const saveToProject = args.save_to_project as string | undefined;

  try {
    // Generate the K6 script based on test type
    const scriptParts: string[] = [];

    // Imports
    scriptParts.push(`import http from 'k6/http';`);
    scriptParts.push(`import { check, sleep } from 'k6';`);
    if (testType === 'stress' || testType === 'spike' || testType === 'soak' || testType === 'breakpoint') {
      scriptParts.push(`import { Rate, Trend } from 'k6/metrics';`);
    }
    scriptParts.push('');

    // Custom metrics
    if (testType !== 'simple') {
      scriptParts.push(`// Custom metrics`);
      scriptParts.push(`const errorRate = new Rate('errors');`);
      scriptParts.push(`const requestDuration = new Trend('request_duration');`);
      scriptParts.push('');
    }

    // Options based on test type
    scriptParts.push(`export const options = {`);

    // Thresholds
    const defaultThresholds: Record<string, string[]> = {
      'http_req_duration': ['p(95)<500', 'p(99)<1000'],
      'http_req_failed': ['rate<0.05'],
    };
    const effectiveThresholds = thresholds || defaultThresholds;
    scriptParts.push(`  thresholds: {`);
    Object.entries(effectiveThresholds).forEach(([metric, conditions]) => {
      scriptParts.push(`    '${metric}': [${conditions.map(c => `'${c}'`).join(', ')}],`);
    });
    scriptParts.push(`  },`);

    // Stages based on test type
    switch (testType) {
      case 'simple':
        scriptParts.push(`  vus: ${virtualUsers},`);
        scriptParts.push(`  duration: '${durationSeconds}s',`);
        break;

      case 'stress':
        scriptParts.push(`  stages: [`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.2)}s', target: ${Math.round(virtualUsers * 0.5)} }, // Ramp up to 50%`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.3)}s', target: ${virtualUsers} }, // Ramp up to 100%`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.3)}s', target: ${virtualUsers} }, // Stay at 100%`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.2)}s', target: 0 }, // Ramp down`);
        scriptParts.push(`  ],`);
        break;

      case 'spike':
        scriptParts.push(`  stages: [`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.1)}s', target: ${Math.round(virtualUsers * 0.1)} }, // Normal load`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.05)}s', target: ${virtualUsers} }, // Spike!`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.2)}s', target: ${virtualUsers} }, // Stay at spike`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.05)}s', target: ${Math.round(virtualUsers * 0.1)} }, // Scale down`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.6)}s', target: ${Math.round(virtualUsers * 0.1)} }, // Recovery`);
        scriptParts.push(`  ],`);
        break;

      case 'soak':
        scriptParts.push(`  stages: [`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.05)}s', target: ${virtualUsers} }, // Ramp up`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.9)}s', target: ${virtualUsers} }, // Sustained load`);
        scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.05)}s', target: 0 }, // Ramp down`);
        scriptParts.push(`  ],`);
        break;

      case 'breakpoint':
        scriptParts.push(`  stages: [`);
        for (let i = 1; i <= 10; i++) {
          const stageVUs = Math.round(virtualUsers * (i / 10) * 2); // Go up to 2x target
          scriptParts.push(`    { duration: '${Math.round(durationSeconds * 0.1)}s', target: ${stageVUs} },`);
        }
        scriptParts.push(`  ],`);
        break;
    }

    scriptParts.push(`};`);
    scriptParts.push('');

    // Setup function (optional)
    scriptParts.push(`// Test setup (runs once at start)`);
    scriptParts.push(`export function setup() {`);
    scriptParts.push(`  console.log('Starting ${testType} test against ${targetUrl}');`);
    scriptParts.push(`  return { startTime: new Date().toISOString() };`);
    scriptParts.push(`}`);
    scriptParts.push('');

    // Main function
    scriptParts.push(`// Main test function (executed by each VU)`);
    scriptParts.push(`export default function(data) {`);

    // Build request options
    const requestOptions: string[] = [];
    if (headers && Object.keys(headers).length > 0) {
      requestOptions.push(`    headers: ${JSON.stringify(headers)},`);
    }
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      requestOptions.push(`    headers: { 'Content-Type': 'application/json', ...${headers ? JSON.stringify(headers) : '{}'} },`);
    }

    // Build the HTTP call
    if (method === 'GET') {
      if (requestOptions.length > 0) {
        scriptParts.push(`  const res = http.get('${targetUrl}', {`);
        scriptParts.push(requestOptions.join('\n'));
        scriptParts.push(`  });`);
      } else {
        scriptParts.push(`  const res = http.get('${targetUrl}');`);
      }
    } else {
      const bodyArg = body ? body : '{}';
      scriptParts.push(`  const res = http.${method.toLowerCase()}('${targetUrl}', ${JSON.stringify(bodyArg)}, {`);
      if (headers && Object.keys(headers).length > 0) {
        scriptParts.push(`    headers: ${JSON.stringify({ 'Content-Type': 'application/json', ...headers })},`);
      } else {
        scriptParts.push(`    headers: { 'Content-Type': 'application/json' },`);
      }
      scriptParts.push(`  });`);
    }

    scriptParts.push('');

    // Add checks
    const defaultChecks = [
      { name: 'status is 200', condition: 'res.status === 200' },
      { name: 'response time < 500ms', condition: 'res.timings.duration < 500' },
    ];
    const effectiveChecks = checks && checks.length > 0 ? checks : defaultChecks;

    scriptParts.push(`  // Verify response`);
    scriptParts.push(`  const success = check(res, {`);
    effectiveChecks.forEach(c => {
      scriptParts.push(`    '${c.name}': (r) => ${c.condition.replace(/res\./g, 'r.')},`);
    });
    scriptParts.push(`  });`);
    scriptParts.push('');

    // Record custom metrics for non-simple tests
    if (testType !== 'simple') {
      scriptParts.push(`  // Record metrics`);
      scriptParts.push(`  errorRate.add(!success);`);
      scriptParts.push(`  requestDuration.add(res.timings.duration);`);
      scriptParts.push('');
    }

    // Think time
    if (includeThinkTime) {
      scriptParts.push(`  // Think time (realistic delay between requests)`);
      scriptParts.push(`  sleep(Math.random() * 2 + 1); // 1-3 seconds`);
    }

    scriptParts.push(`}`);
    scriptParts.push('');

    // Teardown function
    scriptParts.push(`// Test teardown (runs once at end)`);
    scriptParts.push(`export function teardown(data) {`);
    scriptParts.push(`  console.log('Test completed. Started at:', data.startTime);`);
    scriptParts.push(`}`);

    const script = scriptParts.join('\n');

    // Optionally save to project
    let savedTestId: string | undefined;
    if (saveToProject) {
      // Create a test with the script
      const testResult = await context.callApi(`/api/v1/projects/${saveToProject}/tests`, {
        method: 'POST',
        body: {
          name: `K6 ${testType} test - ${new URL(targetUrl).hostname}`,
          test_type: 'load',
          target_url: targetUrl,
          k6_script: script,
          virtual_users: virtualUsers,
          duration: durationSeconds,
          ramp_up_time: rampUpSeconds,
        },
      }) as {
        test?: { id: string };
        error?: string;
      };

      if (testResult.test?.id) {
        savedTestId = testResult.test.id;
      }
    }

    return {
      success: true,
      script,
      test_type: testType,
      target_url: targetUrl,
      method,
      configuration: {
        virtual_users: virtualUsers,
        duration_seconds: durationSeconds,
        ramp_up_seconds: rampUpSeconds,
        include_think_time: includeThinkTime,
      },
      thresholds: effectiveThresholds,
      checks: effectiveChecks,
      saved_to_project: saveToProject,
      saved_test_id: savedTestId,
      description: {
        simple: 'Basic load test with constant VUs',
        stress: 'Gradually increasing load to test system limits',
        spike: 'Sudden surge in traffic to test burst handling',
        soak: 'Long-duration test to identify memory leaks and performance degradation',
        breakpoint: 'Incrementally increasing load to find system breaking point',
      }[testType],
      usage_hint: savedTestId
        ? `Script saved as test ${savedTestId}. Use run_k6_test with test_id="${savedTestId}" to execute.`
        : 'Copy this script to a .js file or use the save_to_project parameter to save it.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create K6 script',
    };
  }
};

// Handler registry for K6 script tools
export const handlers: Record<string, ToolHandler> = {
  create_k6_script: createK6Script,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const k6ScriptsHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default k6ScriptsHandlers;
