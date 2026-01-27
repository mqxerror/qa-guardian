// Script to split tool-definitions.ts into two parts
const fs = require('fs');
const path = require('path');

const toolDefsPath = path.join(__dirname, '../backend/src/mcp/tool-definitions.ts');
const part1aPath = path.join(__dirname, '../backend/src/mcp/tool-definitions-part1a.ts');
const content = fs.readFileSync(toolDefsPath, 'utf8');
const lines = content.split('\n');

// Find array boundaries
let arrayStart = 28; // const TOOLS_PART1 line
let arrayEnd = 2777; // closing bracket

// Find clean split point around line 1387
const splitLine = 1386; // Line 1387 is index 1386

// Extract lines for Part 1A
const headerLines = [
  '/**',
  ' * QA Guardian MCP Tool Definitions - Part 1A',
  ' * Feature #1356: Split for code quality compliance',
  ' * Contains first half of core tools (Projects through Security)',
  ' */',
  '',
  '// Tool input schema type',
  'interface ToolInputSchema {',
  "  type: 'object';",
  '  properties: Record<string, unknown>;',
  '  required?: string[];',
  '}',
  '',
  '// Tool definition type',
  'interface ToolDefinition {',
  '  name: string;',
  '  description: string;',
  '  inputSchema: ToolInputSchema;',
  '}',
  '',
  '// Part 1A: First half of core tools',
  'export const TOOLS_PART1A: ToolDefinition[] = [',
];

// Get tool definitions from line 29 to split point
// Need to find the last complete tool before splitLine
const toolEndPattern = /^  \},$/;
let actualSplitLine = splitLine;

// Find the closest tool end before splitLine
for (let i = splitLine; i > arrayStart; i--) {
  if (toolEndPattern.test(lines[i])) {
    actualSplitLine = i;
    break;
  }
}

console.log('Splitting at line:', actualSplitLine + 1);

// Extract part 1a content (tools from array start+1 to actualSplitLine)
const part1aTools = lines.slice(arrayStart + 1, actualSplitLine + 1);
const part1aContent = headerLines.join('\n') + '\n' + part1aTools.join('\n') + '\n];\n';

// Write Part 1A
fs.writeFileSync(part1aPath, part1aContent);
console.log('Created:', part1aPath);
console.log('Part 1A lines:', part1aContent.split('\n').length);

// Now update the original file to import Part 1A and only contain Part 1B
const part1bToolsStart = actualSplitLine + 1;
const part1bTools = lines.slice(part1bToolsStart, arrayEnd);

// Build new tool-definitions.ts content
const newContent = `/**
 * QA Guardian MCP Tool Definitions
 *
 * This file combines all MCP tool definitions for the QA Guardian platform.
 * Split into multiple parts for code quality compliance (Feature #1356).
 *
 * Parts:
 * - tool-definitions-part1a.ts: Projects, Suites, Tests, Execution, Results, Security
 * - tool-definitions.ts (this file): Monitoring, Visual, Performance (Part 1B)
 * - tool-definitions-part2.ts: K6, Accessibility, Analytics, Settings, AI tools
 */

import { TOOLS_PART1A } from './tool-definitions-part1a';
import { TOOLS_PART2 } from './tool-definitions-part2';

// Tool input schema type
interface ToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

// Tool definition type
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

// Part 1B: Second half of core tools (Monitoring, Visual, Performance)
const TOOLS_PART1B: ToolDefinition[] = [
${part1bTools.join('\n')}
];

// Combine all tool definitions
export const TOOLS: ToolDefinition[] = [
  ...TOOLS_PART1A,
  ...TOOLS_PART1B,
  ...TOOLS_PART2,
];
`;

fs.writeFileSync(toolDefsPath, newContent);
console.log('Updated:', toolDefsPath);
console.log('New tool-definitions.ts lines:', newContent.split('\n').length);
