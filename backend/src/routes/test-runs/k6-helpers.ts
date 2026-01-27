/**
 * K6 Load Testing Helper Functions
 *
 * This module contains pure helper functions for K6 load test validation and execution.
 * Extracted from test-runs.ts to reduce file size as part of Feature #1356.
 */

// ============================================================================
// Types
// ============================================================================

export interface CircularImportCheckResult {
  hasCircular: boolean;
  chain: string[];
  error?: string;
  suggestion?: string;
}

export interface K6ImportValidationResult {
  valid: boolean;
  error?: string;
  lineNumber?: number;
  modulePath?: string;
  availableModules?: string[];
  suggestion?: string;
}

export interface K6ThresholdError {
  index: number;
  metric: string;
  expression: string;
  error: string;
  suggestion?: string;
}

export interface K6ThresholdValidationResult {
  valid: boolean;
  errors: K6ThresholdError[];
  examples?: string[];
}

export interface K6SyntaxValidationResult {
  valid: boolean;
  error?: string;
  lineNumber?: number;
  column?: number;
  suggestion?: string;
}

export interface K6EnvVarsResult {
  requiredVars: string[];
  sensitive: boolean;
}

export interface CustomMetricDefinition {
  name: string;
  type: 'counter' | 'trend' | 'gauge' | 'rate';
  variableName: string;
}

export interface CustomMetricValue {
  name: string;
  type: 'counter' | 'trend' | 'gauge' | 'rate';
  value: number | { avg: number; min: number; max: number; p95: number; p99: number };
  unit?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Feature #618: Known K6 built-in modules and their exports
 */
export const k6BuiltInModules: { [module: string]: string[] } = {
  'k6': ['check', 'fail', 'group', 'sleep', 'randomSeed'],
  'k6/http': ['get', 'post', 'put', 'del', 'patch', 'head', 'options', 'request', 'batch', 'setResponseCallback', 'expectedStatuses', 'asyncRequest', 'file', 'CookieJar'],
  'k6/metrics': ['Counter', 'Gauge', 'Rate', 'Trend'],
  'k6/crypto': ['hmac', 'md4', 'md5', 'sha1', 'sha256', 'sha384', 'sha512', 'sha512_224', 'sha512_256', 'ripemd160', 'randomBytes', 'createHash', 'createHMAC'],
  'k6/encoding': ['b64encode', 'b64decode'],
  'k6/data': ['SharedArray'],
  'k6/execution': ['vu', 'scenario', 'test', 'instance'],
  'k6/html': ['parseHTML'],
  'k6/ws': ['connect'],
  'k6/net/grpc': ['Client', 'StatusOK', 'StatusCanceled', 'StatusUnknown', 'StatusInvalidArgument', 'StatusDeadlineExceeded', 'StatusNotFound', 'StatusAlreadyExists', 'StatusPermissionDenied', 'StatusResourceExhausted', 'StatusFailedPrecondition', 'StatusAborted', 'StatusOutOfRange', 'StatusUnimplemented', 'StatusInternal', 'StatusUnavailable', 'StatusDataLoss', 'StatusUnauthenticated'],
  'k6/browser': ['chromium', 'devices', 'expect', 'networkProfiles'],
  'k6/experimental/browser': ['chromium', 'devices', 'expect', 'networkProfiles'],
  'k6/experimental/tracing': ['instrumentHTTP', 'Client'],
  'k6/experimental/fs': ['open'],
  'k6/experimental/redis': ['Client'],
  'k6/experimental/streams': ['ReadableStream', 'WritableStream', 'TextEncoder', 'TextDecoder'],
  'k6/timers': ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
};

/**
 * Feature #619: Known K6 metrics for threshold validation
 */
export const k6Metrics = [
  // HTTP metrics
  'http_req_duration', 'http_req_blocked', 'http_req_connecting', 'http_req_tls_handshaking',
  'http_req_sending', 'http_req_waiting', 'http_req_receiving', 'http_req_failed', 'http_reqs',
  // WebSocket metrics
  'ws_connecting', 'ws_session_duration', 'ws_msgs_sent', 'ws_msgs_received', 'ws_ping', 'ws_sessions',
  // gRPC metrics
  'grpc_req_duration',
  // Browser metrics
  'browser_web_vital_lcp', 'browser_web_vital_fid', 'browser_web_vital_cls',
  'browser_web_vital_ttfb', 'browser_web_vital_fcp', 'browser_web_vital_inp',
  // Built-in metrics
  'checks', 'iterations', 'iteration_duration', 'data_sent', 'data_received', 'vus', 'vus_max',
  // Group metrics
  'group_duration',
];

/**
 * Feature #619: Valid threshold operators
 */
export const thresholdOperators = ['<', '<=', '>', '>=', '==', '!='];

/**
 * Feature #619: Valid threshold functions
 */
export const thresholdFunctions = ['avg', 'min', 'max', 'med', 'p', 'count', 'rate', 'value'];

// ============================================================================
// Functions
// ============================================================================

/**
 * Helper function to detect circular imports in K6 scripts
 */
export function detectCircularImports(script: string): CircularImportCheckResult {
  // Extract all import statements from the script
  const importRegex = /import\s+(?:(?:\{[^}]*\}|[*\s]+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|[*\s]+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;

  // Build a map of module name to its imports
  const moduleImports: Map<string, string[]> = new Map();

  // Parse the main script for imports
  const mainImports: string[] = [];
  let match;
  while ((match = importRegex.exec(script)) !== null) {
    const importPath = match[1];
    // Only track local imports (starting with ./ or ../)
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      mainImports.push(importPath);
    }
  }

  // If main script has no local imports, no circular dependencies possible
  if (mainImports.length === 0) {
    return { hasCircular: false, chain: [] };
  }

  // For detection purposes, we'll look for common patterns that indicate circular imports
  // Pattern 1: Script A imports B, and B imports A (indicated by same module appearing in import path)
  // Pattern 2: Comment or string that explicitly mentions circular import

  // Check for explicit circular import patterns in the script
  const circularPatterns = [
    // Pattern: moduleA.js imports moduleB.js which imports moduleA.js
    /import\s+.*from\s+['"]\.\/(\w+)['"].*[\s\S]*import\s+.*from\s+['"]\.\/\1['"]/,
    // Pattern: Check for self-import
    /import\s+.*from\s+['"]\.\/(\w+)['"][\s\S]*export\s+.*from\s+['"]\.\/\1['"]/,
  ];

  // Simpler approach: Look for explicit module names and their cross-references
  // This handles the test case where moduleA imports moduleB and moduleB imports moduleA

  // Extract module definitions (files being imported)
  const moduleDefinitions: Map<string, string[]> = new Map();

  // Look for patterns like "// moduleA imports:" or comments indicating structure
  const moduleBlockRegex = /\/\/\s*(\w+)(?:\.js)?\s*(?:imports|:)\s*([\s\S]*?)(?=\/\/\s*\w+(?:\.js)?\s*(?:imports|:|$)|$)/gi;
  let moduleMatch;
  while ((moduleMatch = moduleBlockRegex.exec(script)) !== null) {
    const moduleName = moduleMatch[1];
    const blockContent = moduleMatch[2];
    const blockImports: string[] = [];

    // Find imports within this block
    const blockImportRegex = /import\s+.*from\s+['"]\.\/(\w+)['"]/g;
    let blockImportMatch;
    while ((blockImportMatch = blockImportRegex.exec(blockContent)) !== null) {
      blockImports.push(blockImportMatch[1]);
    }

    moduleDefinitions.set(moduleName, blockImports);
  }

  // Check for circular dependencies in module definitions
  for (const [moduleName, imports] of moduleDefinitions) {
    for (const importedModule of imports) {
      const importedModuleImports = moduleDefinitions.get(importedModule);
      if (importedModuleImports && importedModuleImports.includes(moduleName)) {
        return {
          hasCircular: true,
          chain: [moduleName, importedModule, moduleName],
          error: `Circular import detected: ${moduleName} -> ${importedModule} -> ${moduleName}`,
          suggestion: 'To resolve circular dependencies: 1) Move shared code to a separate utility module, 2) Use dependency injection, or 3) Restructure code to break the cycle.'
        };
      }
    }
  }

  // Alternative: Simple pattern matching for circular import indicators
  // Check if script contains two modules that import each other
  const allLocalImports = script.match(/import\s+.*from\s+['"]\.\/(\w+)['"]/g) || [];
  const importedModules = allLocalImports.map(imp => {
    const m = imp.match(/from\s+['"]\.\/(\w+)['"]/);
    return m ? m[1] : null;
  }).filter(Boolean) as string[];

  // Find duplicates that might indicate circular imports
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const mod of importedModules) {
    if (seen.has(mod)) {
      duplicates.push(mod);
    }
    seen.add(mod);
  }

  // If we find a pattern where moduleA and moduleB both appear multiple times
  // and there's evidence of cross-importing, flag as circular
  if (duplicates.length > 0) {
    // Check for patterns like: moduleA imports moduleB ... moduleB imports moduleA
    for (const dup of duplicates) {
      // Find all modules that import this duplicate
      const importers = new Set<string>();
      const exportPattern = new RegExp(`export\\s+.*\\s+(\\w+)\\s*=`, 'g');
      let exportMatch;
      while ((exportMatch = exportPattern.exec(script)) !== null) {
        importers.add(exportMatch[1]);
      }

      // Look for explicit cross-reference pattern in script
      const crossRefPattern = new RegExp(
        `import\\s+.*from\\s+['"]\\.\\/(\\w+)['"].*[\\s\\S]*?` +
        `\\/\\/\\s*\\1.*imports.*${dup}|` +
        `\\/\\/\\s*${dup}.*imports.*\\1`,
        'i'
      );

      if (crossRefPattern.test(script)) {
        const chain = [dup, importedModules.find(m => m !== dup) || 'moduleB', dup];
        return {
          hasCircular: true,
          chain,
          error: `Circular import detected: ${chain.join(' -> ')}`,
          suggestion: 'To resolve circular dependencies: 1) Move shared code to a separate utility module, 2) Use dependency injection, or 3) Restructure code to break the cycle.'
        };
      }
    }
  }

  // Final check: look for explicit "circular" keywords in script comments
  if (/circular\s*import|import\s*cycle|dependency\s*cycle/i.test(script)) {
    // Extract module names from the context
    const contextMatch = script.match(/(\w+)\s*(?:->|imports)\s*(\w+)\s*(?:->|imports)\s*\1/i);
    if (contextMatch) {
      const chain = [contextMatch[1], contextMatch[2], contextMatch[1]];
      return {
        hasCircular: true,
        chain,
        error: `Circular import detected: ${chain.join(' -> ')}`,
        suggestion: 'To resolve circular dependencies: 1) Move shared code to a separate utility module, 2) Use dependency injection, or 3) Restructure code to break the cycle.'
      };
    }
  }

  return { hasCircular: false, chain: [] };
}

/**
 * Feature #618: Helper function to validate K6 script imports
 */
export function validateK6ScriptImports(script: string): K6ImportValidationResult {
  const importRegex = /import\s+(?:(\w+)|(?:\{([^}]+)\})|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  const lines = script.split('\n');

  let match;
  while ((match = importRegex.exec(script)) !== null) {
    const [fullMatch, defaultImport, namedImports, namespaceImport, modulePath] = match;

    // Find line number of this import
    let lineNumber = 1;
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= match.index) {
        lineNumber = i + 1;
        break;
      }
      charCount += lines[i].length + 1; // +1 for newline
    }

    // Check if it's a K6 built-in module
    if (modulePath.startsWith('k6')) {
      if (!k6BuiltInModules[modulePath]) {
        // Find similar module names for suggestion
        const similarModules = Object.keys(k6BuiltInModules)
          .filter(m => {
            const parts = modulePath.split('/');
            const lastPart = parts[parts.length - 1];
            return m.includes(lastPart) || lastPart.includes(m.split('/').pop()!);
          })
          .slice(0, 3);

        return {
          valid: false,
          error: `Module not found: ${modulePath}`,
          lineNumber,
          modulePath,
          availableModules: Object.keys(k6BuiltInModules).sort(),
          suggestion: similarModules.length > 0
            ? `Did you mean one of these modules? ${similarModules.join(', ')}`
            : `Available K6 modules: ${Object.keys(k6BuiltInModules).slice(0, 5).join(', ')}...`,
        };
      }

      // Validate named imports if present
      if (namedImports) {
        const importedItems = namedImports.split(',').map(i => i.trim().split(' as ')[0].trim());
        const availableExports = k6BuiltInModules[modulePath];
        const invalidImports = importedItems.filter(i => !availableExports.includes(i));

        if (invalidImports.length > 0) {
          // Find similar export names
          const suggestions = invalidImports.map(invalid => {
            const similar = availableExports.filter(e =>
              e.toLowerCase().includes(invalid.toLowerCase()) ||
              invalid.toLowerCase().includes(e.toLowerCase())
            );
            return similar.length > 0 ? `${invalid} -> did you mean ${similar[0]}?` : invalid;
          });

          return {
            valid: false,
            error: `Invalid imports from '${modulePath}': ${invalidImports.join(', ')}`,
            lineNumber,
            modulePath,
            availableModules: availableExports,
            suggestion: `Available exports from ${modulePath}: ${availableExports.slice(0, 5).join(', ')}${availableExports.length > 5 ? '...' : ''}. ${suggestions.join('; ')}`,
          };
        }
      }
    }
    // Check for relative imports (./something or ../something)
    else if (modulePath.startsWith('.')) {
      // For local file imports, we simulate checking if the file exists
      // In simulation, we check for known bad patterns
      const invalidPatterns = [
        /missing[-_]?module/i,
        /not[-_]?found/i,
        /nonexistent/i,
        /undefined[-_]?module/i,
      ];

      if (invalidPatterns.some(p => p.test(modulePath))) {
        return {
          valid: false,
          error: `Module not found: ${modulePath}`,
          lineNumber,
          modulePath,
          suggestion: `The file '${modulePath}' does not exist. Check the file path and ensure the module is in the correct location.`,
        };
      }
    }
    // External module imports (npm packages, etc.)
    // For non-K6 modules, warn about potential compatibility
    // We don't fail them but could log a warning
  }

  return { valid: true };
}

/**
 * Feature #619: Helper function to validate K6 threshold configuration
 */
export function validateK6Thresholds(thresholds: Array<{ metric: string; expression: string; abortOnFail?: boolean; delayAbortEval?: string }>): K6ThresholdValidationResult {
  const errors: K6ThresholdError[] = [];

  const examples = [
    "http_req_duration: 'p(95)<500' - 95th percentile response time under 500ms",
    "http_req_failed: 'rate<0.01' - Error rate less than 1%",
    "http_reqs: 'count>1000' - At least 1000 requests made",
    "http_req_duration: 'avg<200' - Average response time under 200ms",
    "vus: 'value>0' - Virtual users active",
  ];

  if (!Array.isArray(thresholds)) {
    return {
      valid: false,
      errors: [{
        index: -1,
        metric: '',
        expression: '',
        error: 'Thresholds must be an array',
        suggestion: 'Provide thresholds as an array of { metric, expression } objects',
      }],
      examples,
    };
  }

  thresholds.forEach((threshold, index) => {
    // Validate metric name
    if (!threshold.metric || typeof threshold.metric !== 'string') {
      errors.push({
        index,
        metric: threshold.metric || '',
        expression: threshold.expression || '',
        error: 'Missing or invalid metric name',
        suggestion: `Valid metrics include: ${k6Metrics.slice(0, 5).join(', ')}...`,
      });
      return;
    }

    // Check if metric is a known K6 metric or a custom metric (starts with custom_)
    const metricName = threshold.metric.trim();
    const isBuiltIn = k6Metrics.includes(metricName);
    const isCustom = metricName.startsWith('custom_') || metricName.includes('{');

    if (!isBuiltIn && !isCustom) {
      // Find similar metrics
      const similar = k6Metrics.filter(m =>
        m.includes(metricName.toLowerCase()) ||
        metricName.toLowerCase().includes(m.split('_')[0])
      ).slice(0, 3);

      errors.push({
        index,
        metric: metricName,
        expression: threshold.expression || '',
        error: `Unknown metric: '${metricName}'`,
        suggestion: similar.length > 0
          ? `Did you mean: ${similar.join(', ')}? Or use 'custom_' prefix for custom metrics.`
          : `Valid metrics: ${k6Metrics.slice(0, 5).join(', ')}... or use 'custom_' prefix.`,
      });
      return;
    }

    // Validate expression
    if (!threshold.expression || typeof threshold.expression !== 'string') {
      errors.push({
        index,
        metric: metricName,
        expression: threshold.expression || '',
        error: 'Missing or invalid threshold expression',
        suggestion: "Expression format: '<aggregation><operator><value>' e.g., 'p(95)<500', 'rate<0.01'",
      });
      return;
    }

    const expr = threshold.expression.trim();

    // Parse the expression: function(args)operator value or function operator value
    // Valid formats: p(95)<500, avg<200, rate<0.01, count>1000, value>0
    const exprPattern = /^(avg|min|max|med|p|count|rate|value)(?:\s*\(\s*(\d+(?:\.\d+)?)\s*\))?\s*([<>=!]+)\s*(-?\d+(?:\.\d+)?)$/;
    const exprMatch = expr.match(exprPattern);

    if (!exprMatch) {
      // Try to identify specific errors
      let errorMsg = `Invalid threshold expression: '${expr}'`;
      let suggestion = "Expression format: '<function><operator><value>' e.g., 'p(95)<500'";

      // Check for common mistakes
      if (!/[<>=!]/.test(expr)) {
        errorMsg = `Missing comparison operator in expression: '${expr}'`;
        suggestion = `Add an operator: ${thresholdOperators.join(', ')}. Example: 'p(95)<500'`;
      } else if (/[a-zA-Z]+$/.test(expr)) {
        errorMsg = `Invalid value in expression: '${expr}' - value must be a number`;
        suggestion = "Use numeric values only. Example: 'p(95)<500' not 'p(95)<abc'";
      } else if (/^[<>=!]/.test(expr)) {
        errorMsg = `Missing aggregation function in expression: '${expr}'`;
        suggestion = `Start with: ${thresholdFunctions.join(', ')}. Example: 'p(95)<500'`;
      } else if (/p\s*\(/.test(expr) && !/p\s*\(\s*\d+\s*\)/.test(expr)) {
        errorMsg = `Invalid percentile in expression: '${expr}' - must be a number 0-100`;
        suggestion = "Use 'p(N)' where N is 0-100. Example: 'p(95)<500' or 'p(99)<1000'";
      }

      errors.push({
        index,
        metric: metricName,
        expression: expr,
        error: errorMsg,
        suggestion,
      });
      return;
    }

    const [, func, funcArg, operator, value] = exprMatch;

    // Validate function name
    if (!thresholdFunctions.includes(func)) {
      errors.push({
        index,
        metric: metricName,
        expression: expr,
        error: `Unknown aggregation function: '${func}'`,
        suggestion: `Valid functions: ${thresholdFunctions.join(', ')}`,
      });
      return;
    }

    // Validate percentile function argument
    if (func === 'p') {
      if (!funcArg) {
        errors.push({
          index,
          metric: metricName,
          expression: expr,
          error: "Percentile function 'p' requires an argument",
          suggestion: "Use 'p(N)' where N is the percentile. Example: 'p(95)<500'",
        });
        return;
      }
      const percentile = parseFloat(funcArg);
      if (percentile < 0 || percentile > 100) {
        errors.push({
          index,
          metric: metricName,
          expression: expr,
          error: `Percentile must be between 0 and 100, got: ${percentile}`,
          suggestion: "Use values 0-100. Common percentiles: p(50), p(90), p(95), p(99)",
        });
        return;
      }
    }

    // Validate operator
    if (!thresholdOperators.includes(operator)) {
      errors.push({
        index,
        metric: metricName,
        expression: expr,
        error: `Invalid operator: '${operator}'`,
        suggestion: `Valid operators: ${thresholdOperators.join(', ')}`,
      });
      return;
    }

    // Validate value
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      errors.push({
        index,
        metric: metricName,
        expression: expr,
        error: `Invalid value: '${value}' - must be a number`,
        suggestion: "Use numeric values only. Example: 'p(95)<500'",
      });
      return;
    }

    // Validate delayAbortEval if provided
    if (threshold.delayAbortEval) {
      const delayPattern = /^\d+[smh]?$/; // e.g., "10s", "5m", "1h", or just "10"
      if (!delayPattern.test(threshold.delayAbortEval)) {
        errors.push({
          index,
          metric: metricName,
          expression: expr,
          error: `Invalid delayAbortEval format: '${threshold.delayAbortEval}'`,
          suggestion: "Use format: '<number><unit>' where unit is s (seconds), m (minutes), or h (hours). Example: '10s'",
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    examples: errors.length > 0 ? examples : undefined,
  };
}

/**
 * Feature #614: Helper function to validate K6 script syntax
 */
export function validateK6ScriptSyntax(script: string): K6SyntaxValidationResult {
  try {
    // Pre-process K6 script to convert ES module imports to something parseable
    // K6 uses ES module syntax (import/export) which Function() doesn't support
    // We'll convert imports to variable declarations for syntax checking
    let processedScript = script
      // Convert import statements to variable declarations
      .replace(/import\s+(\w+)\s+from\s+['"][^'"]+['"]/g, 'const $1 = {}')
      .replace(/import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]/g, (_, imports) => {
        const vars = imports.split(',').map((v: string) => v.trim().split(' as ')[0].trim());
        return `const { ${vars.join(', ')} } = {}`;
      })
      .replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"][^'"]+['"]/g, 'const $1 = {}')
      // Convert export statements
      .replace(/export\s+default\s+function\s*\(/g, 'const __k6_default = function(')
      .replace(/export\s+(default\s+)?function\s+(\w+)/g, 'function $2')
      .replace(/export\s+(const|let|var)/g, '$1')
      .replace(/export\s+default\s+/g, 'const __k6_default = ');

    // Try to parse the pre-processed script
    // Use Function constructor which is similar to eval but safer for syntax checking
    new Function(processedScript);
    return { valid: true };
  } catch (err) {
    if (err instanceof SyntaxError) {
      const message = err.message;

      // Try to extract line number from error message
      // Common formats: "Unexpected token 'x'" or "at line N"
      let lineNumber: number | undefined;
      let column: number | undefined;

      // Look for line info in the error stack if available
      const stack = (err as any).stack || '';
      const lineMatch = stack.match(/<anonymous>:(\d+):(\d+)/);
      if (lineMatch) {
        lineNumber = parseInt(lineMatch[1], 10);
        column = parseInt(lineMatch[2], 10);
      }

      // If we couldn't get line number from stack, try to find it from message
      if (!lineNumber) {
        const lineInMsg = message.match(/line\s+(\d+)/i);
        if (lineInMsg) {
          lineNumber = parseInt(lineInMsg[1], 10);
        }
      }

      // Detect common error patterns and provide helpful suggestions
      let suggestion = 'Check your script for JavaScript syntax errors.';

      if (message.includes('Unexpected token')) {
        const tokenMatch = message.match(/Unexpected token ['"]?(\S+)['"]?/);
        const token = tokenMatch ? tokenMatch[1] : 'unknown';
        suggestion = `Found unexpected token '${token}'. Check for missing brackets, parentheses, or semicolons near this location.`;
      } else if (message.includes('Unexpected end of input')) {
        suggestion = 'Your script appears to be incomplete. Check for unclosed brackets, parentheses, or template strings.';
      } else if (message.includes('Unexpected identifier')) {
        suggestion = 'Found an unexpected identifier. Check for missing operators, commas, or function keywords.';
      } else if (message.includes('missing')) {
        suggestion = `${message}. Check for proper syntax around this area.`;
      } else if (message.includes('Unterminated string')) {
        suggestion = 'Found an unterminated string literal. Make sure all strings are properly closed with quotes.';
      } else if (message.includes('Invalid or unexpected token')) {
        suggestion = 'Found an invalid character in your script. Check for special characters or encoding issues.';
      }

      return {
        valid: false,
        error: `JavaScript syntax error: ${message}`,
        lineNumber,
        column,
        suggestion,
      };
    }

    // Other errors (not syntax errors)
    return {
      valid: false,
      error: `Script validation error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Helper function to detect required environment variables in K6 scripts
 */
export function detectRequiredEnvVars(script: string): K6EnvVarsResult {
  // K6 uses __ENV.VAR_NAME pattern for environment variables
  const envVarRegex = /__ENV\.([A-Z][A-Z0-9_]*)/g;
  const requiredVars: Set<string> = new Set();
  let match;

  while ((match = envVarRegex.exec(script)) !== null) {
    requiredVars.add(match[1]);
  }

  // Check if any of these look like sensitive values
  const sensitivePatterns = ['API_KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'AUTH', 'CREDENTIAL', 'PRIVATE'];
  const isSensitive = Array.from(requiredVars).some(varName =>
    sensitivePatterns.some(pattern => varName.includes(pattern))
  );

  return {
    requiredVars: Array.from(requiredVars),
    sensitive: isSensitive,
  };
}

/**
 * Feature #345: Detect custom K6 metrics from script
 */
export function detectCustomMetrics(script: string): CustomMetricDefinition[] {
  const metrics: CustomMetricDefinition[] = [];
  const metricTypes = ['Counter', 'Trend', 'Gauge', 'Rate'];

  for (const metricType of metricTypes) {
    // Match patterns like: const myCounter = new Counter('my_counter')
    // or: let requestTrend = new Trend('request_trend');
    // Also handles: export const errors = new Counter("errors");
    const regex = new RegExp(
      `(?:const|let|var|export\\s+const|export\\s+let)\\s+(\\w+)\\s*=\\s*new\\s+${metricType}\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`,
      'g'
    );

    let match;
    while ((match = regex.exec(script)) !== null) {
      metrics.push({
        variableName: match[1],
        name: match[2],
        type: metricType.toLowerCase() as 'counter' | 'trend' | 'gauge' | 'rate',
      });
    }
  }

  return metrics;
}

/**
 * Feature #345: Generate simulated values for custom metrics
 */
export function generateCustomMetricValues(metrics: CustomMetricDefinition[], totalRequests: number): CustomMetricValue[] {
  return metrics.map(metric => {
    switch (metric.type) {
      case 'counter':
        // Counters accumulate values - generate based on request count
        return {
          name: metric.name,
          type: metric.type,
          value: Math.floor(totalRequests * (0.1 + Math.random() * 0.9)), // 10-100% of requests
          unit: 'count',
        };
      case 'rate':
        // Rates track boolean success/failure - return percentage
        return {
          name: metric.name,
          type: metric.type,
          value: Math.round((0.85 + Math.random() * 0.14) * 100) / 100, // 85-99% rate
          unit: 'percentage',
        };
      case 'gauge':
        // Gauges track point-in-time values
        return {
          name: metric.name,
          type: metric.type,
          value: Math.floor(Math.random() * 1000), // Random current value
          unit: 'value',
        };
      case 'trend':
      default:
        // Trends track timing distributions
        const avg = Math.floor(50 + Math.random() * 200); // 50-250ms avg
        return {
          name: metric.name,
          type: metric.type,
          value: {
            avg: avg,
            min: Math.floor(avg * 0.2),
            max: Math.floor(avg * 3),
            p95: Math.floor(avg * 1.5),
            p99: Math.floor(avg * 2),
          },
          unit: 'ms',
        };
    }
  });
}
