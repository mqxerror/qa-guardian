const fs = require('fs');
const filePath = '/Users/mqxerrormac16/Documents/QA-Dam3oun/backend/src/routes/test-runs.ts';

let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find start line (first occurrence of "// Serve trace files")
let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Serve trace files')) {
    startIndex = i;
    break;
  }
}

if (startIndex === -1) {
  console.log('Could not find start marker');
  process.exit(1);
}

// Find the end - look for "// Feature #910: Search across all test results"
for (let i = startIndex; i < lines.length; i++) {
  if (lines[i].includes('// Feature #910: Search across all test results')) {
    endIndex = i;
    break;
  }
}

if (endIndex === -1) {
  console.log('Could not find end marker');
  process.exit(1);
}

console.log('Found artifact routes at lines ' + (startIndex + 1) + ' to ' + endIndex + ' (1-indexed)');
console.log('Removing ' + (endIndex - startIndex) + ' lines');

// Create new content
const beforeLines = lines.slice(0, startIndex);
const afterLines = lines.slice(endIndex);

// Add a comment indicating routes were extracted
const newContent = [
  ...beforeLines,
  '',
  '  // Feature #1356: Artifact routes extracted to ./test-runs/artifact-routes.ts',
  '  // Routes registered via artifactRoutes(app) at the end of testRunRoutes()',
  '',
  ...afterLines
].join('\n');

fs.writeFileSync(filePath, newContent);
console.log('Successfully removed inline artifact routes');
