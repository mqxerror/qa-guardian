// Script to automatically split tool-definitions.ts into ~1400 line chunks
const fs = require('fs');
const path = require('path');

const toolDefsPath = path.join(__dirname, '../backend/src/mcp/tool-definitions.ts');
const content = fs.readFileSync(toolDefsPath, 'utf8');
const lines = content.split('\n');

// Find where TOOLS_PART1 array starts and ends
let arrayStart = -1;
let arrayEnd = -1;
let bracketCount = 0;
let inArray = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.includes('const TOOLS_PART1: ToolDefinition[] = [')) {
    arrayStart = i;
    inArray = true;
    bracketCount = 1;
    continue;
  }

  if (inArray) {
    for (const char of line) {
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
    }

    if (bracketCount === 0) {
      arrayEnd = i;
      break;
    }
  }
}

console.log('Array starts at line:', arrayStart + 1);
console.log('Array ends at line:', arrayEnd + 1);
console.log('Array length:', arrayEnd - arrayStart + 1, 'lines');

// Find tool boundaries (each tool starts with '  {' at column 2)
const toolStarts = [];
for (let i = arrayStart + 1; i < arrayEnd; i++) {
  if (lines[i].trimStart().startsWith('{') && lines[i].startsWith('  {')) {
    toolStarts.push(i);
  }
}

console.log('Found', toolStarts.length, 'tools');

// We need to split ~2788 lines across parts
// Header/footer: ~30 lines
// Array content: ~2758 lines
// Split into 2 parts of ~1379 lines each = ~45-46 tools per file

const midPoint = Math.floor(toolStarts.length / 2);
const splitLine = toolStarts[midPoint];

console.log('Will split at tool', midPoint, '(line', splitLine + 1, ')');

// Extract header (imports, interfaces)
const header = lines.slice(0, 28); // Up to interface definitions

// Create part 1a (first half of tools)
const part1aTools = lines.slice(arrayStart, splitLine);
const part1aContent = `/**
 * QA Guardian MCP Tool Definitions - Part 1A (Projects, Suites, Tests, Runs)
 * Feature #1356: Split for code quality compliance
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

// Part 1A: First half of core tools
export const TOOLS_PART1A: ToolDefinition[] = [
${part1aTools.slice(1).join('\n')}
`;

// Find where the array closes for the first tool
let part1aEnd = '';
for (let i = splitLine - 1; i >= arrayStart; i--) {
  if (lines[i].trim() === '},') {
    // This is the end of a tool
    break;
  }
}

// Actually let's take a simpler approach - split at a clean boundary
// by finding where a tool definition ends (line with just '  },')

const cleanSplitPoint = [];
for (let i = arrayStart + 1; i < arrayEnd; i++) {
  if (lines[i].trim() === '},') {
    cleanSplitPoint.push(i);
  }
}

console.log('Found', cleanSplitPoint.length, 'clean split points');

// Split roughly in half
const halfwayTool = Math.floor(cleanSplitPoint.length / 2);
const splitAt = cleanSplitPoint[halfwayTool];

console.log('Clean split at line', splitAt + 1);
console.log('Part 1A will have', splitAt - arrayStart, 'lines');
console.log('Part 1B will have', arrayEnd - splitAt, 'lines');
