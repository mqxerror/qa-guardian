// Script to split tool-definitions-part2.ts into two parts
const fs = require('fs');
const path = require('path');

const toolDefsPath = path.join(__dirname, '../backend/src/mcp/tool-definitions-part2.ts');
const part2aPath = path.join(__dirname, '../backend/src/mcp/tool-definitions-part2a.ts');
const content = fs.readFileSync(toolDefsPath, 'utf8');
const lines = content.split('\n');

console.log('tool-definitions-part2.ts has', lines.length, 'lines');

// Find array boundaries
let arrayStart = -1;
let arrayEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export const TOOLS_PART2')) {
    arrayStart = i;
  }
  if (arrayStart > 0 && lines[i] === '];') {
    arrayEnd = i;
    break;
  }
}

console.log('Array starts at line:', arrayStart + 1);
console.log('Array ends at line:', arrayEnd + 1);

// Find clean split point (line ending with '},')
const toolEndPattern = /^  \},$/;
const targetLine = Math.floor((arrayEnd + arrayStart) / 2);
let actualSplitLine = targetLine;

// Find the closest tool end before target
for (let i = targetLine; i > arrayStart; i--) {
  if (toolEndPattern.test(lines[i])) {
    actualSplitLine = i;
    break;
  }
}

console.log('Splitting at line:', actualSplitLine + 1);

// Build Part 2A file
const part2aHeader = `/**
 * QA Guardian MCP Tool Definitions - Part 2A
 * Feature #1356: Split for code quality compliance
 * Contains: K6 Load Testing, Accessibility, Analytics
 */

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

// Part 2A: K6 Load Testing, Accessibility, Analytics
export const TOOLS_PART2A: ToolDefinition[] = [
`;

const part2aTools = lines.slice(arrayStart + 1, actualSplitLine + 1);
const part2aContent = part2aHeader + part2aTools.join('\n') + '\n];\n';

fs.writeFileSync(part2aPath, part2aContent);
console.log('Created:', part2aPath);
console.log('Part 2A lines:', part2aContent.split('\n').length);

// Update tool-definitions-part2.ts to import Part 2A and only contain Part 2B
const part2bTools = lines.slice(actualSplitLine + 1, arrayEnd);

const newContent = `/**
 * QA Guardian MCP Tool Definitions - Part 2
 * Feature #1356: Split for code quality compliance
 * Contains: Settings, Incidents, AI Healing, Root Cause, AI Tools (Part 2B)
 *
 * Combined with Part 2A for full TOOLS_PART2 export
 */

import { TOOLS_PART2A } from './tool-definitions-part2a';

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

// Part 2B: Settings, Incidents, AI Healing, Root Cause, AI Tools
const TOOLS_PART2B: ToolDefinition[] = [
${part2bTools.join('\n')}
];

// Combine Part 2A and 2B for export
export const TOOLS_PART2: ToolDefinition[] = [
  ...TOOLS_PART2A,
  ...TOOLS_PART2B,
];
`;

fs.writeFileSync(toolDefsPath, newContent);
console.log('Updated:', toolDefsPath);
console.log('New tool-definitions-part2.ts lines:', newContent.split('\n').length);
