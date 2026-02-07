/**
 * OpenAPI/Swagger to Playwright Test Generator
 * Feature #324: Parse OpenAPI specs and generate Playwright API tests
 *
 * Supports:
 * - OpenAPI 3.0.x and 3.1.x
 * - Swagger 2.0
 * - JSON and YAML formats
 */

// Note: We parse YAML manually using basic parsing since js-yaml isn't installed
// For production, consider adding js-yaml dependency

// ============================================================================
// Types
// ============================================================================

export interface OpenAPISpec {
  openapi?: string; // 3.0.x or 3.1.x
  swagger?: string; // 2.0
  info: {
    title: string;
    version: string;
    description?: string;
  };
  host?: string; // Swagger 2.0
  basePath?: string; // Swagger 2.0
  servers?: Array<{ url: string; description?: string }>; // OpenAPI 3.x
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, unknown>;
  };
  definitions?: Record<string, SchemaObject>; // Swagger 2.0
  tags?: Array<{ name: string; description?: string }>;
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  parameters?: ParameterObject[];
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

export interface ParameterObject {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie' | 'body' | 'formData';
  description?: string;
  required?: boolean;
  schema?: SchemaObject;
  type?: string; // Swagger 2.0
  example?: unknown;
  default?: unknown;
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema: SchemaObject;
  example?: unknown;
  examples?: Record<string, { value: unknown }>;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
  schema?: SchemaObject; // Swagger 2.0
  headers?: Record<string, unknown>;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: unknown[];
  example?: unknown;
  default?: unknown;
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  description?: string;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface GeneratedTest {
  path: string;
  method: string;
  operationId: string;
  summary: string;
  tags: string[];
  testCode: string;
  testName: string;
}

export interface OpenAPIParseResult {
  success: boolean;
  spec?: OpenAPISpec;
  version?: string;
  title?: string;
  baseUrl?: string;
  endpoints?: number;
  error?: string;
}

export interface TestGenerationResult {
  success: boolean;
  tests: GeneratedTest[];
  summary: {
    total: number;
    byMethod: Record<string, number>;
    byTag: Record<string, number>;
  };
  baseUrl: string;
  apiTitle: string;
  error?: string;
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Simple YAML parser for basic OpenAPI specs
 * Note: For complex YAML, consider adding js-yaml dependency
 */
function parseSimpleYAML(yamlStr: string): unknown {
  try {
    // Try JSON first (YAML is a superset of JSON)
    return JSON.parse(yamlStr);
  } catch {
    // Basic YAML parsing - handles most OpenAPI specs
    const lines = yamlStr.split('\n');
    const result: Record<string, unknown> = {};
    const stack: Array<{ indent: number; obj: Record<string, unknown>; key?: string }> = [{ indent: -1, obj: result }];

    for (const line of lines) {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) continue;

      const indent = line.search(/\S/);
      const content = line.trim();

      // Skip if only whitespace
      if (indent === -1) continue;

      // Pop stack until we find the right level
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;

      // Check if it's a list item
      if (content.startsWith('- ')) {
        const key = stack[stack.length - 1].key;
        if (key && Array.isArray(parent[key])) {
          const value = content.slice(2).trim();
          if (value.includes(':')) {
            const obj: Record<string, unknown> = {};
            const [k, v] = value.split(':').map(s => s.trim());
            obj[k] = parseValue(v);
            (parent[key] as unknown[]).push(obj);
          } else {
            (parent[key] as unknown[]).push(parseValue(value));
          }
        }
        continue;
      }

      // Key-value pair
      const colonIndex = content.indexOf(':');
      if (colonIndex !== -1) {
        const key = content.slice(0, colonIndex).trim();
        let value = content.slice(colonIndex + 1).trim();

        if (!value) {
          // Nested object or array
          const nextLine = lines[lines.indexOf(line) + 1];
          if (nextLine && nextLine.trim().startsWith('- ')) {
            parent[key] = [];
            stack.push({ indent, obj: parent, key });
          } else {
            parent[key] = {};
            stack.push({ indent, obj: parent[key] as Record<string, unknown> });
          }
        } else {
          parent[key] = parseValue(value);
        }
      }
    }

    return result;
  }
}

function parseValue(value: string): unknown {
  if (!value) return '';

  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Null
  if (value === 'null' || value === '~') return null;

  // Number
  const num = Number(value);
  if (!isNaN(num)) return num;

  return value;
}

/**
 * Parse an OpenAPI/Swagger specification
 */
export function parseOpenAPISpec(content: string): OpenAPIParseResult {
  try {
    let spec: OpenAPISpec;

    // Try JSON first, then YAML
    try {
      spec = JSON.parse(content);
    } catch {
      spec = parseSimpleYAML(content) as OpenAPISpec;
    }

    // Validate it's a valid OpenAPI/Swagger spec
    if (!spec.openapi && !spec.swagger) {
      return {
        success: false,
        error: 'Invalid specification: missing "openapi" or "swagger" version field',
      };
    }

    if (!spec.info || !spec.info.title) {
      return {
        success: false,
        error: 'Invalid specification: missing "info.title" field',
      };
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      return {
        success: false,
        error: 'Invalid specification: no paths defined',
      };
    }

    // Determine version
    const version = spec.openapi || spec.swagger;

    // Determine base URL
    let baseUrl = '';
    if (spec.servers && spec.servers.length > 0) {
      baseUrl = spec.servers[0].url;
    } else if (spec.host) {
      const scheme = 'https';
      baseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
    }

    // Count endpoints
    let endpoints = 0;
    for (const path of Object.values(spec.paths)) {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;
      for (const method of methods) {
        if (path[method]) endpoints++;
      }
    }

    return {
      success: true,
      spec,
      version,
      title: spec.info.title,
      baseUrl,
      endpoints,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse specification: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// ============================================================================
// Test Generation Functions
// ============================================================================

/**
 * Generate an example value for a schema
 */
function generateExampleValue(schema: SchemaObject, specs: OpenAPISpec, depth = 0): unknown {
  if (depth > 5) return null; // Prevent infinite recursion

  // Handle $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/components/schemas/', '').replace('#/definitions/', '');
    const refSchema = specs.components?.schemas?.[refPath] || specs.definitions?.[refPath];
    if (refSchema) {
      return generateExampleValue(refSchema, specs, depth + 1);
    }
    return {};
  }

  // Use explicit example if provided
  if (schema.example !== undefined) {
    return schema.example;
  }

  // Use default if provided
  if (schema.default !== undefined) {
    return schema.default;
  }

  // Handle enums
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  // Generate based on type
  switch (schema.type) {
    case 'string':
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'date') return '2024-01-15';
      if (schema.format === 'date-time') return '2024-01-15T10:30:00Z';
      if (schema.format === 'uuid') return '550e8400-e29b-41d4-a716-446655440000';
      if (schema.format === 'uri') return 'https://example.com';
      return 'string';

    case 'integer':
    case 'number':
      if (schema.minimum !== undefined) return schema.minimum;
      if (schema.maximum !== undefined) return Math.min(100, schema.maximum);
      return schema.type === 'integer' ? 1 : 1.0;

    case 'boolean':
      return true;

    case 'array':
      if (schema.items) {
        return [generateExampleValue(schema.items, specs, depth + 1)];
      }
      return [];

    case 'object':
      if (schema.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          obj[key] = generateExampleValue(propSchema, specs, depth + 1);
        }
        return obj;
      }
      return {};

    default:
      return null;
  }
}

/**
 * Generate Playwright test code for an endpoint
 */
function generatePlaywrightTest(
  path: string,
  method: string,
  operation: OperationObject,
  spec: OpenAPISpec,
  baseUrl: string
): string {
  const operationId = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const summary = operation.summary || `${method.toUpperCase()} ${path}`;

  // Collect path parameters
  const pathParams: ParameterObject[] = (operation.parameters || []).filter(p => p.in === 'path');
  const queryParams: ParameterObject[] = (operation.parameters || []).filter(p => p.in === 'query');
  const headerParams: ParameterObject[] = (operation.parameters || []).filter(p => p.in === 'header');

  // Build the test URL with path parameters replaced
  let testPath = path;
  const pathParamValues: Record<string, unknown> = {};
  for (const param of pathParams) {
    const exampleValue = param.example || param.default ||
      (param.schema ? generateExampleValue(param.schema, spec) : '1');
    pathParamValues[param.name] = exampleValue;
    testPath = testPath.replace(`{${param.name}}`, String(exampleValue));
  }

  // Build query string
  const queryParamValues: Record<string, unknown> = {};
  for (const param of queryParams) {
    if (param.required || param.example || param.default) {
      const value = param.example || param.default ||
        (param.schema ? generateExampleValue(param.schema, spec) : 'value');
      queryParamValues[param.name] = value;
    }
  }

  // Build request body
  let requestBody: unknown = undefined;
  let contentType = 'application/json';
  if (operation.requestBody?.content) {
    const jsonContent = operation.requestBody.content['application/json'];
    if (jsonContent) {
      if (jsonContent.example) {
        requestBody = jsonContent.example;
      } else if (jsonContent.examples) {
        const firstExample = Object.values(jsonContent.examples)[0];
        if (firstExample?.value) {
          requestBody = firstExample.value;
        }
      } else if (jsonContent.schema) {
        requestBody = generateExampleValue(jsonContent.schema, spec);
      }
    }
  }

  // Get expected response
  const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['204'];
  let expectedStatus = 200;
  if (operation.responses['201']) expectedStatus = 201;
  if (operation.responses['204']) expectedStatus = 204;

  // Build response assertions
  let responseAssertions = '';
  if (successResponse?.content?.['application/json']?.schema) {
    const schema = successResponse.content['application/json'].schema;
    responseAssertions = generateSchemaAssertions(schema, spec);
  }

  // Generate the test code
  let code = `import { test, expect } from '@playwright/test';

test.describe('${operationId}', () => {
  const BASE_URL = '${baseUrl || 'http://localhost:3000'}';

  test('${summary}', async ({ request }) => {
`;

  // Add query params if any
  if (Object.keys(queryParamValues).length > 0) {
    code += `    const queryParams = ${JSON.stringify(queryParamValues, null, 6).replace(/^/gm, '    ').trim()};\n`;
    code += `    const queryString = new URLSearchParams(queryParams).toString();\n`;
    code += `    const url = \`\${BASE_URL}${testPath}?\${queryString}\`;\n\n`;
  } else {
    code += `    const url = \`\${BASE_URL}${testPath}\`;\n\n`;
  }

  // Build the request
  code += `    const response = await request.${method}(url`;

  // Add request options
  const hasOptions = requestBody || headerParams.length > 0;
  if (hasOptions) {
    code += `, {\n`;

    // Add headers
    if (headerParams.length > 0 || requestBody) {
      code += `      headers: {\n`;
      if (requestBody) {
        code += `        'Content-Type': '${contentType}',\n`;
      }
      for (const param of headerParams) {
        const value = param.example || param.default || 'header-value';
        code += `        '${param.name}': '${value}',\n`;
      }
      code += `      },\n`;
    }

    // Add body
    if (requestBody) {
      code += `      data: ${JSON.stringify(requestBody, null, 8).replace(/^/gm, '      ').trim()},\n`;
    }

    code += `    }`;
  }
  code += `);\n\n`;

  // Add assertions
  code += `    // Assert response status\n`;
  code += `    expect(response.status()).toBe(${expectedStatus});\n\n`;

  if (expectedStatus !== 204) {
    code += `    // Parse response body\n`;
    code += `    const body = await response.json();\n\n`;

    if (responseAssertions) {
      code += `    // Assert response structure\n`;
      code += responseAssertions;
    }
  }

  code += `  });\n`;
  code += `});\n`;

  return code;
}

/**
 * Generate assertions for response schema validation
 */
function generateSchemaAssertions(schema: SchemaObject, spec: OpenAPISpec, varName = 'body', indent = 4): string {
  let assertions = '';
  const spaces = ' '.repeat(indent);

  // Handle $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/components/schemas/', '').replace('#/definitions/', '');
    const refSchema = spec.components?.schemas?.[refPath] || spec.definitions?.[refPath];
    if (refSchema) {
      return generateSchemaAssertions(refSchema, spec, varName, indent);
    }
  }

  switch (schema.type) {
    case 'object':
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const isRequired = schema.required?.includes(key);
          if (isRequired) {
            assertions += `${spaces}expect(${varName}).toHaveProperty('${key}');\n`;
          }
          // Add type check for required properties
          if (propSchema.type && isRequired) {
            switch (propSchema.type) {
              case 'string':
                assertions += `${spaces}expect(typeof ${varName}.${key}).toBe('string');\n`;
                break;
              case 'number':
              case 'integer':
                assertions += `${spaces}expect(typeof ${varName}.${key}).toBe('number');\n`;
                break;
              case 'boolean':
                assertions += `${spaces}expect(typeof ${varName}.${key}).toBe('boolean');\n`;
                break;
              case 'array':
                assertions += `${spaces}expect(Array.isArray(${varName}.${key})).toBe(true);\n`;
                break;
            }
          }
        }
      }
      break;

    case 'array':
      assertions += `${spaces}expect(Array.isArray(${varName})).toBe(true);\n`;
      break;
  }

  return assertions;
}

/**
 * Generate Playwright tests for all endpoints in an OpenAPI spec
 */
export function generateTestsFromSpec(spec: OpenAPISpec, baseUrl: string): TestGenerationResult {
  const tests: GeneratedTest[] = [];
  const byMethod: Record<string, number> = {};
  const byTag: Record<string, number> = {};

  const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      // Skip deprecated endpoints
      if (operation.deprecated) continue;

      const operationId = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const testCode = generatePlaywrightTest(path, method, operation, spec, baseUrl);
      const tags = operation.tags || ['default'];

      tests.push({
        path,
        method: method.toUpperCase(),
        operationId,
        summary: operation.summary || `${method.toUpperCase()} ${path}`,
        tags,
        testCode,
        testName: `${operationId}.spec.ts`,
      });

      // Count by method
      byMethod[method.toUpperCase()] = (byMethod[method.toUpperCase()] || 0) + 1;

      // Count by tag
      for (const tag of tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }
  }

  return {
    success: true,
    tests,
    summary: {
      total: tests.length,
      byMethod,
      byTag,
    },
    baseUrl,
    apiTitle: spec.info.title,
  };
}

/**
 * Parse spec and generate tests in one operation
 */
export function parseAndGenerateTests(content: string, customBaseUrl?: string): TestGenerationResult {
  const parseResult = parseOpenAPISpec(content);

  if (!parseResult.success || !parseResult.spec) {
    return {
      success: false,
      tests: [],
      summary: { total: 0, byMethod: {}, byTag: {} },
      baseUrl: '',
      apiTitle: '',
      error: parseResult.error,
    };
  }

  const baseUrl = customBaseUrl || parseResult.baseUrl || 'http://localhost:3000';
  return generateTestsFromSpec(parseResult.spec, baseUrl);
}
