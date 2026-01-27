// DAST Scanner Simulation Functions

import {
  DASTScanResult,
  DASTConfig,
  OpenAPISpec,
  OpenAPIEndpoint,
} from './types';
import {
  dastScans,
  dastConfigs,
  dastFalsePositives,
  openApiSpecs,
} from './stores';
import {
  generateId,
  getDASTConfig,
  isUrlInScope,
} from './utils';
import { generateSimulatedAlerts } from './alerts';

// Get OpenAPI spec for a project
export function getOpenAPISpec(projectId: string): OpenAPISpec | undefined {
  for (const [, spec] of openApiSpecs) {
    if (spec.projectId === projectId) {
      return spec;
    }
  }
  return undefined;
}

// Parse OpenAPI specification
export function parseOpenAPISpec(content: string): { info: any; endpoints: OpenAPIEndpoint[] } {
  const spec = JSON.parse(content);

  if (!spec.openapi && !spec.swagger) {
    throw new Error('Invalid OpenAPI specification format');
  }

  const endpoints: OpenAPIEndpoint[] = [];
  const paths = spec.paths || {};
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    const pathItemObj = pathItem as Record<string, any>;

    for (const method of methods) {
      const operation: any = pathItemObj[method];
      if (!operation) continue;

      const endpoint: OpenAPIEndpoint = {
        path,
        method: method.toUpperCase(),
        operationId: operation.operationId,
        summary: operation.summary || operation.description,
        parameters: [],
        responses: {},
      };

      // Extract parameters
      const allParams = [...(operation.parameters || []), ...(pathItemObj.parameters || [])];
      endpoint.parameters = allParams.map((p: any) => ({
        name: p.name,
        in: p.in,
        required: p.required || false,
        type: p.schema?.type || p.type || 'string',
      }));

      // Extract request body info
      if (operation.requestBody) {
        const contentTypes: string[] = Object.keys(operation.requestBody.content || {});
        const firstContentType = contentTypes[0] || 'application/json';
        endpoint.requestBody = {
          contentType: firstContentType,
          schema: operation.requestBody.content?.[firstContentType]?.schema,
        };
      }

      // Extract responses
      if (operation.responses) {
        endpoint.responses = {};
        for (const [code, response] of Object.entries(operation.responses)) {
          endpoint.responses[code] = {
            description: (response as any).description || '',
          };
        }
      }

      endpoints.push(endpoint);
    }
  }

  if (endpoints.length === 0) {
    throw new Error('No API endpoints found in the specification');
  }

  return {
    info: spec.info,
    endpoints,
  };
}

// Simulate OWASP ZAP scan
export async function simulateZAPScan(
  projectId: string,
  targetUrl: string,
  scanProfile: 'baseline' | 'full' | 'api',
  authConfig?: DASTConfig['authConfig'],
  contextConfig?: DASTConfig['contextConfig']
): Promise<DASTScanResult> {
  const scanId = generateId();

  // Determine scan duration based on profile (simulated time, not real time)
  const totalDuration = scanProfile === 'baseline' ? 120 : scanProfile === 'api' ? 480 : 3600;
  const targetUrls = scanProfile === 'baseline' ? Math.floor(Math.random() * 30) + 10
                   : scanProfile === 'api' ? Math.floor(Math.random() * 20) + 15
                   : Math.floor(Math.random() * 200) + 150;
  const targetRequests = scanProfile === 'baseline' ? Math.floor(Math.random() * 300) + 100
                       : scanProfile === 'api' ? Math.floor(Math.random() * 400) + 300
                       : Math.floor(Math.random() * 5000) + 3000;

  // Create initial scan result with progress
  const scan: DASTScanResult = {
    id: scanId,
    projectId,
    targetUrl,
    scanProfile,
    status: 'running',
    startedAt: new Date().toISOString(),
    alerts: [],
    summary: {
      total: 0,
      byRisk: { high: 0, medium: 0, low: 0, informational: 0 },
      byConfidence: { high: 0, medium: 0, low: 0 },
    },
    statistics: {
      urlsScanned: 0,
      requestsSent: 0,
      duration: 0,
    },
    progress: {
      phase: 'spider',
      phaseDescription: 'Discovering URLs...',
      percentage: 0,
      urlsDiscovered: 0,
      urlsScanned: 0,
      alertsFound: 0,
      estimatedTimeRemaining: totalDuration,
      currentUrl: targetUrl,
    },
  };

  // Store scan
  if (!dastScans.has(projectId)) {
    dastScans.set(projectId, []);
  }
  dastScans.get(projectId)!.push(scan);

  // Generate all alerts upfront (to add incrementally)
  const allAlerts = generateSimulatedAlerts(targetUrl, scanProfile, authConfig);
  const filteredAlerts = allAlerts.filter(alert =>
    isUrlInScope(alert.url, contextConfig?.includeUrls, contextConfig?.excludeUrls)
  );

  // Simulate real-time progress updates (faster for demo: 500ms intervals over 5 seconds)
  const totalSteps = 10;  // 10 progress updates
  const stepInterval = 500;  // 500ms between updates
  let currentStep = 0;

  const progressInterval = setInterval(() => {
    currentStep++;
    const progressPercent = (currentStep / totalSteps) * 100;

    // Determine current phase
    let phase: 'spider' | 'active_scan' | 'passive_scan' | 'analyzing' | 'complete';
    let phaseDescription: string;

    if (progressPercent < 20) {
      phase = 'spider';
      phaseDescription = 'Discovering URLs and site structure...';
    } else if (progressPercent < 50) {
      phase = 'passive_scan';
      phaseDescription = 'Performing passive security checks...';
    } else if (progressPercent < 85) {
      phase = 'active_scan';
      phaseDescription = 'Running active vulnerability tests...';
    } else {
      phase = 'analyzing';
      phaseDescription = 'Analyzing results and generating report...';
    }

    // Calculate incremental values
    const urlsDiscovered = Math.floor((progressPercent / 100) * targetUrls * 1.2);
    const urlsScanned = Math.floor((progressPercent / 100) * targetUrls);
    const requestsSent = Math.floor((progressPercent / 100) * targetRequests);
    const alertsToShow = Math.floor((progressPercent / 100) * filteredAlerts.length);
    const elapsedSimulated = Math.floor((progressPercent / 100) * totalDuration);
    const remainingSimulated = totalDuration - elapsedSimulated;

    // Update progress
    scan.progress = {
      phase,
      phaseDescription,
      percentage: Math.round(progressPercent),
      urlsDiscovered,
      urlsScanned,
      alertsFound: alertsToShow,
      estimatedTimeRemaining: remainingSimulated,
      currentUrl: filteredAlerts[alertsToShow - 1]?.url || targetUrl,
    };

    // Update statistics
    scan.statistics = {
      urlsScanned,
      requestsSent,
      duration: elapsedSimulated,
    };

    // Add alerts incrementally
    scan.alerts = filteredAlerts.slice(0, alertsToShow);

    // Update summary based on current alerts
    const currentAlerts = scan.alerts.filter(a => !a.isFalsePositive);
    scan.summary = {
      total: currentAlerts.length,
      byRisk: {
        high: currentAlerts.filter(a => a.risk === 'High').length,
        medium: currentAlerts.filter(a => a.risk === 'Medium').length,
        low: currentAlerts.filter(a => a.risk === 'Low').length,
        informational: currentAlerts.filter(a => a.risk === 'Informational').length,
      },
      byConfidence: {
        high: currentAlerts.filter(a => a.confidence === 'High').length,
        medium: currentAlerts.filter(a => a.confidence === 'Medium').length,
        low: currentAlerts.filter(a => a.confidence === 'Low').length,
      },
    };

    // Check if complete
    if (currentStep >= totalSteps) {
      clearInterval(progressInterval);
      completeScan(scan, projectId, filteredAlerts, allAlerts, contextConfig, targetUrls, targetRequests, totalDuration, scanProfile);
    }
  }, stepInterval);

  return scan;
}

// Complete the scan with final results
function completeScan(
  scan: DASTScanResult,
  projectId: string,
  filteredAlerts: any[],
  allAlerts: any[],
  contextConfig: DASTConfig['contextConfig'] | undefined,
  targetUrls: number,
  targetRequests: number,
  totalDuration: number,
  scanProfile: 'baseline' | 'full' | 'api'
): void {
  const urlsFilteredOut = allAlerts.length - filteredAlerts.length;

  // Store scope config used for this scan
  if (contextConfig?.includeUrls?.length || contextConfig?.excludeUrls?.length) {
    scan.scopeConfig = {
      includeUrls: contextConfig.includeUrls,
      excludeUrls: contextConfig.excludeUrls,
      urlsFilteredOut,
    };
  }

  // Get false positives for this project
  const fps = dastFalsePositives.get(projectId) || [];

  // Mark known false positives
  filteredAlerts.forEach(alert => {
    const isFP = fps.some(fp =>
      fp.pluginId === alert.pluginId &&
      fp.url === alert.url &&
      (!fp.param || fp.param === alert.param)
    );
    if (isFP) {
      alert.isFalsePositive = true;
    }
  });

  // Update scan result to completed
  scan.status = 'completed';
  scan.completedAt = new Date().toISOString();
  scan.alerts = filteredAlerts;
  scan.summary = {
    total: filteredAlerts.filter(a => !a.isFalsePositive).length,
    byRisk: {
      high: filteredAlerts.filter(a => !a.isFalsePositive && a.risk === 'High').length,
      medium: filteredAlerts.filter(a => !a.isFalsePositive && a.risk === 'Medium').length,
      low: filteredAlerts.filter(a => !a.isFalsePositive && a.risk === 'Low').length,
      informational: filteredAlerts.filter(a => !a.isFalsePositive && a.risk === 'Informational').length,
    },
    byConfidence: {
      high: filteredAlerts.filter(a => !a.isFalsePositive && a.confidence === 'High').length,
      medium: filteredAlerts.filter(a => !a.isFalsePositive && a.confidence === 'Medium').length,
      low: filteredAlerts.filter(a => !a.isFalsePositive && a.confidence === 'Low').length,
    },
  };

  // Final statistics
  scan.statistics = {
    urlsScanned: targetUrls,
    requestsSent: targetRequests,
    duration: totalDuration,
  };

  // Update progress to complete
  scan.progress = {
    phase: 'complete',
    phaseDescription: 'Scan completed',
    percentage: 100,
    urlsDiscovered: Math.floor(targetUrls * 1.2),
    urlsScanned: targetUrls,
    alertsFound: filteredAlerts.length,
    estimatedTimeRemaining: 0,
  };

  // For API scans, add endpoint testing information
  if (scanProfile === 'api') {
    const spec = getOpenAPISpec(projectId);
    if (spec && spec.endpoints.length > 0) {
      scan.endpointsTested = {
        total: spec.endpoints.length,
        tested: spec.endpoints.length,
        endpoints: spec.endpoints.map((ep) => {
          const endpointAlerts = filteredAlerts.filter(a =>
            a.url.includes(ep.path.replace(/\{[^}]+\}/g, '')) ||
            a.method === ep.method
          );
          return {
            path: ep.path,
            method: ep.method,
            status: 'tested' as const,
            alertCount: Math.min(endpointAlerts.length, 2),
          };
        }),
      };
    } else {
      const simulatedEndpoints = [
        { path: '/api/v1/users', method: 'GET' },
        { path: '/api/v1/users', method: 'POST' },
        { path: '/api/v1/users/{id}', method: 'GET' },
        { path: '/api/v1/users/{id}', method: 'PUT' },
        { path: '/api/v1/users/{id}', method: 'DELETE' },
        { path: '/api/v1/auth/login', method: 'POST' },
        { path: '/api/v1/auth/logout', method: 'POST' },
        { path: '/api/v1/orders', method: 'GET' },
        { path: '/api/v1/orders', method: 'POST' },
        { path: '/api/v1/products', method: 'GET' },
      ];
      scan.endpointsTested = {
        total: simulatedEndpoints.length,
        tested: simulatedEndpoints.length,
        endpoints: simulatedEndpoints.map((ep, idx) => ({
          path: ep.path,
          method: ep.method,
          status: 'tested' as const,
          alertCount: idx < filteredAlerts.length ? 1 : 0,
        })),
      };
    }
  }

  // Update config with last scan info
  const config = getDASTConfig(projectId);
  config.lastScanAt = scan.completedAt;
  config.lastScanStatus = 'completed';
  dastConfigs.set(projectId, config);
}
