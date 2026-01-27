/**
 * QA Guardian MCP Validation Utilities
 *
 * Feature #1356: Extracted from server.ts to reduce file size.
 * Contains pure utility functions for parameter type validation,
 * JSON type detection, example generation, and K6 script validation.
 */

/**
 * Get the JSON type of a value
 * Returns 'null', 'array', or typeof for other values
 */
export function getJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Check if a value matches the expected JSON Schema type
 */
export function isTypeMatch(value: unknown, expectedType: string): boolean {
  const actualType = getJsonType(value);

  switch (expectedType) {
    case 'string':
      return actualType === 'string';
    case 'number':
      return actualType === 'number';
    case 'boolean':
      return actualType === 'boolean';
    case 'object':
      return actualType === 'object' && !Array.isArray(value) && value !== null;
    case 'array':
      return Array.isArray(value);
    case 'integer':
      return actualType === 'number' && Number.isInteger(value);
    default:
      return true; // Unknown type - be permissive
  }
}

/**
 * Get a valid example value for a parameter based on its type and name
 */
export function getValidExample(paramName: string, expectedType: string, enumValues?: unknown[]): string {
  // If there are enum values, use the first one
  if (enumValues && enumValues.length > 0) {
    const example = enumValues[0];
    return typeof example === 'string' ? `"${example}"` : String(example);
  }

  // Generate example based on type and parameter name
  switch (expectedType) {
    case 'string':
      if (paramName.includes('id') || paramName.endsWith('_id')) {
        return `"abc123"`;
      }
      if (paramName.includes('name')) {
        return `"my-${paramName.replace(/_/g, '-')}"`;
      }
      if (paramName.includes('url')) {
        return `"https://example.com"`;
      }
      return `"example_value"`;
    case 'number':
    case 'integer':
      if (paramName.includes('limit')) return '50';
      if (paramName.includes('offset')) return '0';
      if (paramName.includes('timeout')) return '30000';
      if (paramName.includes('retries')) return '3';
      return '42';
    case 'boolean':
      return 'true';
    case 'array':
      return '[]';
    case 'object':
      return '{}';
    default:
      return 'null';
  }
}

/**
 * K6 script validation result
 */
export interface K6ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate K6 script syntax
 * Checks for required imports, default export, and basic syntax issues
 */
export function validateK6Script(script: string): K6ValidationResult {
  const errors: string[] = [];

  // Check for required K6 imports
  if (!script.includes("import") || (!script.includes("k6/http") && !script.includes("k6"))) {
    errors.push("Script must import from 'k6' or 'k6/http'");
  }

  // Check for default export function
  if (!script.includes("export default function")) {
    errors.push("Script must have a default exported function: export default function()");
  }

  // Check for basic syntax issues
  const openBraces = (script.match(/\{/g) || []).length;
  const closeBraces = (script.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Mismatched braces: ${openBraces} opening, ${closeBraces} closing`);
  }

  const openParens = (script.match(/\(/g) || []).length;
  const closeParens = (script.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Mismatched parentheses: ${openParens} opening, ${closeParens} closing`);
  }

  // Check for common K6 patterns
  if (!script.includes("http.") && !script.includes("browser.") && !script.includes("ws.")) {
    errors.push("Script should include HTTP calls (http.get, http.post, etc.) or browser/websocket operations");
  }

  // Check for options export (recommended but not required)
  // if (!script.includes("export const options") && !script.includes("export let options")) {
  //   // This is a warning, not an error - could add to a warnings array
  // }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parameter type error information
 */
export interface ParameterTypeError {
  parameter: string;
  expectedType: string;
  actualType: string;
  validExample: string;
}

/**
 * Validate parameter types against a tool schema
 */
export function validateParameterTypes(
  toolArgs: Record<string, unknown>,
  properties: Record<string, { type?: string; enum?: unknown[]; description?: string }>
): ParameterTypeError[] {
  const typeErrors: ParameterTypeError[] = [];

  for (const [paramName, paramValue] of Object.entries(toolArgs)) {
    if (paramValue === undefined || paramValue === null) {
      continue; // Missing params handled separately
    }

    const paramSchema = properties[paramName];
    if (!paramSchema || !paramSchema.type) {
      continue; // Unknown param or no type specified - be permissive
    }

    const actualType = getJsonType(paramValue);
    const expectedType = paramSchema.type;

    // Check if type matches
    if (!isTypeMatch(paramValue, expectedType)) {
      const validExample = getValidExample(paramName, expectedType, paramSchema.enum);

      typeErrors.push({
        parameter: paramName,
        expectedType,
        actualType,
        validExample,
      });
    }
  }

  return typeErrors;
}

/**
 * Missing parameter information
 */
export interface MissingParameter {
  name: string;
  description?: string;
}

/**
 * Find missing required parameters
 */
export function findMissingRequiredParams(
  toolArgs: Record<string, unknown>,
  requiredParams: string[],
  properties?: Record<string, { description?: string }>
): MissingParameter[] {
  const missingParams: MissingParameter[] = [];

  for (const paramName of requiredParams) {
    if (toolArgs[paramName] === undefined || toolArgs[paramName] === null) {
      const paramSchema = properties?.[paramName];
      missingParams.push({
        name: paramName,
        description: paramSchema?.description,
      });
    }
  }

  return missingParams;
}
