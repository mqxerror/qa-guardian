// DAST Scanner - Real OWASP ZAP Integration

import http from 'http';
import {
  DASTScanResult,
  DASTAlert,
  DASTConfig,
  OpenAPISpec,
  OpenAPIEndpoint,
} from './types.js';
import {
  createDastScan,
  updateDastScan,
  getDastFalsePositives,
  getOpenApiSpecsByProject,
  saveDastConfig,
} from './stores.js';
import {
  generateId,
  getDASTConfig,
  isUrlInScope,
} from './utils.js';

/** Base URL for the ZAP daemon API. Defaults to the Docker service name. */
const ZAP_BASE_URL = process.env.ZAP_API_URL || 'http://zap:8080';

/** Feature #209: ZAP API key for authenticated requests. */
const ZAP_API_KEY = process.env.ZAP_API_KEY || '';

/** Maximum time to wait for the spider phase (seconds). */
const SPIDER_TIMEOUT_SECONDS = 120;

/** Maximum time to wait for the active scan phase (seconds). */
const ACTIVE_SCAN_TIMEOUT_SECONDS = 300;

/** Polling interval for spider status (ms). */
const SPIDER_POLL_INTERVAL_MS = 2000;

/** Polling interval for active scan status (ms). */
const ACTIVE_SCAN_POLL_INTERVAL_MS = 5000;

/** Passive scan settle time for baseline scans (ms). */
const PASSIVE_SCAN_SETTLE_MS = 5000;

// ---------------------------------------------------------------------------
// ZAP REST API helper
// ---------------------------------------------------------------------------

/**
 * Send a GET request to the ZAP REST API and parse the JSON response.
 * Throws a descriptive error if ZAP is unreachable or returns invalid data.
 * Feature #209: Includes API key in all requests for authentication.
 */
async function zapGet(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // Append API key to the request URL
    const separator = path.includes('?') ? '&' : '?';
    const urlWithKey = ZAP_API_KEY
      ? `${ZAP_BASE_URL}${path}${separator}apikey=${encodeURIComponent(ZAP_API_KEY)}`
      : `${ZAP_BASE_URL}${path}`;
    const displayUrl = `${ZAP_BASE_URL}${path}`; // Don't log the API key
    const req = http.get(urlWithKey, { timeout: 10_000 }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON response from ZAP at ${displayUrl}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (err: Error) => {
      reject(new Error(
        `Failed to connect to ZAP at ${ZAP_BASE_URL}. ` +
        `Ensure the ZAP Docker service is running and reachable. ` +
        `Original error: ${err.message}`
      ));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ZAP timed out: ${displayUrl}`));
    });
  });
}

// ---------------------------------------------------------------------------
// OpenAPI helpers (unchanged)
// ---------------------------------------------------------------------------

/** Retrieve the first OpenAPI spec associated with a project. */
export async function getOpenAPISpec(projectId: string): Promise<OpenAPISpec | undefined> {
  const specs = await getOpenApiSpecsByProject(projectId);
  return specs.length > 0 ? specs[0] : undefined;
}

/** Parse an OpenAPI JSON document and extract endpoint definitions. */
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
          // Feature #414: OpenAPI response object has optional description property
          const responseObj = response as { description?: string };
          endpoint.responses[code] = {
            description: responseObj.description || '',
          };
        }
      }

      endpoints.push(endpoint);
    }
  }

  if (endpoints.length === 0) {
    throw new Error('No API endpoints found in the specification');
  }

  return { info: spec.info, endpoints };
}

// ---------------------------------------------------------------------------
// Real ZAP scan orchestration
// ---------------------------------------------------------------------------

/**
 * Run a real OWASP ZAP scan against the target URL.
 *
 * Phases:
 *   1. Spider the target to discover URLs.
 *   2. For non-baseline profiles, run an active scan.
 *      For baseline profiles, wait briefly for passive rules.
 *   3. Fetch real alerts from ZAP.
 *
 * The function creates the scan record in the database, then kicks off the
 * scan asynchronously (so the HTTP handler can return 202 immediately).
 * Progress is persisted via updateDastScan so polling endpoints see updates.
 */
export async function runZAPScan(
  projectId: string,
  targetUrl: string,
  scanProfile: 'baseline' | 'full' | 'api',
  authConfig?: DASTConfig['authConfig'],
  contextConfig?: DASTConfig['contextConfig'],
): Promise<DASTScanResult> {
  const scanId = generateId();

  // Verify ZAP connectivity before creating the scan record
  try {
    await zapGet('/JSON/core/view/version/');
  } catch (err: unknown) {
    throw new Error(
      `ZAP is not reachable at ${ZAP_BASE_URL}. ` +
      `Cannot start DAST scan. ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Create the initial scan record
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
      phaseDescription: 'Connecting to ZAP and starting spider...',
      percentage: 0,
      urlsDiscovered: 0,
      urlsScanned: 0,
      alertsFound: 0,
      estimatedTimeRemaining: scanProfile === 'baseline' ? 30 : 120,
      currentUrl: targetUrl,
    },
  };

  await createDastScan(scan);

  // Run the actual scan asynchronously so the caller gets the initial record
  // immediately (HTTP 202). Errors are captured on the scan record.
  executeZAPScan(scan, projectId, targetUrl, scanProfile, authConfig, contextConfig)
    .catch((err) => {
      console.error(`[DAST] Scan ${scanId} failed:`, err);
      scan.status = 'failed';
      scan.error = err.message || 'Unknown error during ZAP scan';
      scan.completedAt = new Date().toISOString();
      updateDastScan(scan.id, scan).catch((e) =>
        console.error(`[DAST] Failed to persist error state for scan ${scanId}:`, e)
      );
    });

  return scan;
}

/**
 * Core scan execution logic. This runs asynchronously after the scan record
 * has been persisted so the HTTP handler can respond immediately.
 */
async function executeZAPScan(
  scan: DASTScanResult,
  projectId: string,
  targetUrl: string,
  scanProfile: 'baseline' | 'full' | 'api',
  authConfig?: DASTConfig['authConfig'],
  contextConfig?: DASTConfig['contextConfig'],
): Promise<void> {
  const startTime = Date.now();

  // ------------------------------------------------------------------
  // Phase 1: Spider
  // ------------------------------------------------------------------
  scan.progress = {
    phase: 'spider',
    phaseDescription: 'Spidering target to discover URLs...',
    percentage: 5,
    urlsDiscovered: 0,
    urlsScanned: 0,
    alertsFound: 0,
    currentUrl: targetUrl,
  };
  await updateDastScan(scan.id, scan);

  const maxChildren = scanProfile === 'baseline' ? 5 : 10;
  const spiderResult = await zapGet(
    `/JSON/spider/action/scan/?url=${encodeURIComponent(targetUrl)}&maxChildren=${maxChildren}&recurse=true`
  );
  const spiderId = spiderResult.scan;

  // Poll spider progress
  const spiderMaxIterations = Math.ceil(SPIDER_TIMEOUT_SECONDS / (SPIDER_POLL_INTERVAL_MS / 1000));
  for (let i = 0; i < spiderMaxIterations; i++) {
    const status = await zapGet(`/JSON/spider/view/status/?scanId=${spiderId}`);
    const spiderProgress = parseInt(status.status, 10) || 0;

    // Scale spider progress to 0-25% of total
    const overallPercent = Math.round((spiderProgress / 100) * 25);
    scan.progress = {
      phase: 'spider',
      phaseDescription: `Spidering target... ${spiderProgress}% complete`,
      percentage: overallPercent,
      urlsDiscovered: 0, // ZAP doesn't expose this during spider easily
      urlsScanned: 0,
      alertsFound: 0,
      currentUrl: targetUrl,
    };
    await updateDastScan(scan.id, scan);

    if (spiderProgress >= 100) break;
    await delay(SPIDER_POLL_INTERVAL_MS);
  }

  // ------------------------------------------------------------------
  // Phase 2: Active scan or passive settle
  // ------------------------------------------------------------------
  if (scanProfile !== 'baseline') {
    // Active scan for 'full' and 'api' profiles
    scan.progress = {
      phase: 'active_scan',
      phaseDescription: 'Starting active vulnerability scan...',
      percentage: 30,
      urlsDiscovered: 0,
      urlsScanned: 0,
      alertsFound: 0,
      currentUrl: targetUrl,
    };
    await updateDastScan(scan.id, scan);

    const activeScanResult = await zapGet(
      `/JSON/ascan/action/scan/?url=${encodeURIComponent(targetUrl)}&recurse=true`
    );
    const activeScanId = activeScanResult.scan;

    // Poll active scan progress
    const activeMaxIterations = Math.ceil(
      ACTIVE_SCAN_TIMEOUT_SECONDS / (ACTIVE_SCAN_POLL_INTERVAL_MS / 1000)
    );
    for (let i = 0; i < activeMaxIterations; i++) {
      const status = await zapGet(`/JSON/ascan/view/status/?scanId=${activeScanId}`);
      const activeProgress = parseInt(status.status, 10) || 0;

      // Scale active scan progress to 30-85% of total
      const overallPercent = 30 + Math.round((activeProgress / 100) * 55);
      scan.progress = {
        phase: 'active_scan',
        phaseDescription: `Active scan in progress... ${activeProgress}% complete`,
        percentage: overallPercent,
        urlsDiscovered: 0,
        urlsScanned: 0,
        alertsFound: 0,
        currentUrl: targetUrl,
      };
      await updateDastScan(scan.id, scan);

      if (activeProgress >= 100) break;
      await delay(ACTIVE_SCAN_POLL_INTERVAL_MS);
    }
  } else {
    // Baseline: rely on passive scan rules; give ZAP a moment to process
    scan.progress = {
      phase: 'passive_scan',
      phaseDescription: 'Waiting for passive scan rules to complete...',
      percentage: 50,
      urlsDiscovered: 0,
      urlsScanned: 0,
      alertsFound: 0,
      currentUrl: targetUrl,
    };
    await updateDastScan(scan.id, scan);
    await delay(PASSIVE_SCAN_SETTLE_MS);
  }

  // ------------------------------------------------------------------
  // Phase 3: Retrieve alerts
  // ------------------------------------------------------------------
  scan.progress = {
    phase: 'analyzing',
    phaseDescription: 'Retrieving scan results from ZAP...',
    percentage: 90,
    urlsDiscovered: 0,
    urlsScanned: 0,
    alertsFound: 0,
    currentUrl: targetUrl,
  };
  await updateDastScan(scan.id, scan);

  const alertsResult = await zapGet(
    `/JSON/alert/view/alerts/?baseurl=${encodeURIComponent(targetUrl)}&start=0&count=500`
  );

  const rawAlerts: DASTAlert[] = (alertsResult.alerts || []).map((a: any) => ({
    id: a.id || generateId(),
    pluginId: a.pluginid || '',
    name: a.alert || a.name || 'Unknown Alert',
    risk: mapZAPRisk(a.risk),
    confidence: mapZAPConfidence(a.confidence),
    description: a.description || '',
    url: a.url || targetUrl,
    method: a.method || 'GET',
    param: a.param || undefined,
    attack: a.attack || undefined,
    evidence: a.evidence || undefined,
    solution: a.solution || '',
    reference: a.reference || undefined,
    cweId: a.cweid ? parseInt(a.cweid, 10) : undefined,
    wascId: a.wascid ? parseInt(a.wascid, 10) : undefined,
  }));

  // Apply scope filtering if configured
  const filteredAlerts = rawAlerts.filter((alert) =>
    isUrlInScope(alert.url, contextConfig?.includeUrls, contextConfig?.excludeUrls)
  );
  const urlsFilteredOut = rawAlerts.length - filteredAlerts.length;

  // Store scope config if filtering was applied
  if (contextConfig?.includeUrls?.length || contextConfig?.excludeUrls?.length) {
    scan.scopeConfig = {
      includeUrls: contextConfig.includeUrls,
      excludeUrls: contextConfig.excludeUrls,
      urlsFilteredOut,
    };
  }

  // Mark known false positives
  const fps = await getDastFalsePositives(projectId);
  filteredAlerts.forEach((alert) => {
    const isFP = fps.some(
      (fp) =>
        fp.pluginId === alert.pluginId &&
        fp.url === alert.url &&
        (!fp.param || fp.param === alert.param)
    );
    if (isFP) {
      alert.isFalsePositive = true;
    }
  });

  // ------------------------------------------------------------------
  // Phase 4: Finalize scan record
  // ------------------------------------------------------------------
  const nonFP = filteredAlerts.filter((a) => !a.isFalsePositive);
  const durationSeconds = Math.round((Date.now() - startTime) / 1000);

  // Get spider results count for statistics
  let urlsScannedCount = 0;
  try {
    const spiderResults = await zapGet(`/JSON/spider/view/results/?scanId=${spiderId}`);
    urlsScannedCount = Array.isArray(spiderResults.results) ? spiderResults.results.length : 0;
  } catch {
    // Non-critical; default to 0
  }

  scan.status = 'completed';
  scan.completedAt = new Date().toISOString();
  scan.alerts = filteredAlerts;
  scan.summary = {
    total: nonFP.length,
    byRisk: {
      high: nonFP.filter((a) => a.risk === 'High').length,
      medium: nonFP.filter((a) => a.risk === 'Medium').length,
      low: nonFP.filter((a) => a.risk === 'Low').length,
      informational: nonFP.filter((a) => a.risk === 'Informational').length,
    },
    byConfidence: {
      high: nonFP.filter((a) => a.confidence === 'High').length,
      medium: nonFP.filter((a) => a.confidence === 'Medium').length,
      low: nonFP.filter((a) => a.confidence === 'Low').length,
    },
  };
  scan.statistics = {
    urlsScanned: urlsScannedCount,
    requestsSent: 0, // ZAP does not expose a simple request count via API
    duration: durationSeconds,
  };
  scan.progress = {
    phase: 'complete',
    phaseDescription: 'Scan completed',
    percentage: 100,
    urlsDiscovered: urlsScannedCount,
    urlsScanned: urlsScannedCount,
    alertsFound: filteredAlerts.length,
    estimatedTimeRemaining: 0,
  };

  // For API scans, attach endpoint testing information
  if (scanProfile === 'api') {
    const spec = await getOpenAPISpec(projectId);
    if (spec && spec.endpoints.length > 0) {
      scan.endpointsTested = {
        total: spec.endpoints.length,
        tested: spec.endpoints.length,
        endpoints: spec.endpoints.map((ep) => {
          const endpointAlerts = filteredAlerts.filter(
            (a) =>
              a.url.includes(ep.path.replace(/\{[^}]+\}/g, '')) ||
              a.method === ep.method
          );
          return {
            path: ep.path,
            method: ep.method,
            status: 'tested' as const,
            alertCount: endpointAlerts.length,
          };
        }),
      };
    }
  }

  // Persist completed scan
  await updateDastScan(scan.id, scan);

  // Update config with last scan info
  const config = await getDASTConfig(projectId);
  config.lastScanAt = scan.completedAt;
  config.lastScanStatus = 'completed';
  await saveDastConfig(projectId, config);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map ZAP risk string (e.g. "High", "3") to the DASTRisk union type. */
function mapZAPRisk(risk: string): 'High' | 'Medium' | 'Low' | 'Informational' {
  const normalized = (risk || '').toLowerCase();
  if (normalized === 'high' || normalized === '3') return 'High';
  if (normalized === 'medium' || normalized === '2') return 'Medium';
  if (normalized === 'low' || normalized === '1') return 'Low';
  return 'Informational';
}

/** Map ZAP confidence string to the DASTConfidence union type. */
function mapZAPConfidence(confidence: string): 'High' | 'Medium' | 'Low' {
  const normalized = (confidence || '').toLowerCase();
  if (normalized === 'high' || normalized === '3') return 'High';
  if (normalized === 'medium' || normalized === '2') return 'Medium';
  return 'Low';
}

/** Promise-based delay. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
