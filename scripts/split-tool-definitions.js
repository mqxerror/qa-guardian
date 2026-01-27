// Script to split tool-definitions.ts into smaller files
const fs = require('fs');
const path = require('path');

const toolDefsPath = path.join(__dirname, '../backend/src/mcp/tool-definitions.ts');
const content = fs.readFileSync(toolDefsPath, 'utf8');
const lines = content.split('\n');

console.log('tool-definitions.ts has', lines.length, 'lines');

// Count how many tools there are by counting name: 'tool_name' patterns
let toolCount = 0;
lines.forEach((line, i) => {
  if (line.trim().startsWith("name: '")) {
    toolCount++;
  }
});

console.log('Contains approximately', toolCount, 'tool definitions');

// The file needs to be split into ~3 parts to get each under 1500 lines
// Target: ~933 lines each (2800 / 3)
// We'll aim for ~1400 lines per file to be safe

console.log('\nRecommended approach:');
console.log('1. Create tool-definitions-projects.ts with project-related tools');
console.log('2. Create tool-definitions-testing.ts with test suite/test/run tools');
console.log('3. Create tool-definitions-monitoring.ts with monitoring/visual/performance tools');
console.log('4. Update tool-definitions.ts to import and combine all');
