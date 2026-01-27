// Script to remove executeTest and launchBrowser from test-runs.ts and add import
const fs = require('fs');
const path = require('path');

const testRunsPath = path.join(__dirname, '../backend/src/routes/test-runs.ts');

// Read test-runs.ts
const content = fs.readFileSync(testRunsPath, 'utf8');
const lines = content.split('\n');

console.log('Original lines:', lines.length);

// Find the function boundaries
// executeTest: lines 512-5104 (1-indexed) = 511-5103 (0-indexed)
// launchBrowser: lines 5107-5117 (1-indexed) = 5106-5116 (0-indexed)
// We'll remove from line 510 (the comment "// Test execution function...") to line 5117

// Find exact boundaries by searching for markers
let executeTestStartLine = -1;
let launchBrowserEndLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Test execution function with trace capture')) {
    executeTestStartLine = i;
    console.log('Found executeTest comment at line:', i + 1);
  }
  if (lines[i].includes('async function launchBrowser(browserType: BrowserType)')) {
    // Find the closing brace of this function (it's a short function)
    for (let j = i; j < lines.length; j++) {
      if (lines[j] === '}' && j > i) {
        launchBrowserEndLine = j;
        console.log('Found launchBrowser end at line:', j + 1);
        break;
      }
    }
    break;
  }
}

if (executeTestStartLine === -1 || launchBrowserEndLine === -1) {
  console.error('Could not find function boundaries!');
  process.exit(1);
}

// Build new content
// Keep lines before executeTest (0 to executeTestStartLine-1)
// Add import statement and marker
// Keep lines after launchBrowser (launchBrowserEndLine+1 to end)

const beforeLines = lines.slice(0, executeTestStartLine);
const afterLines = lines.slice(launchBrowserEndLine + 1);

// Add import for the extracted module at the beginning of the file (after existing imports)
// Find a good place to add the import (after other test-runs/ imports)
let importInsertIndex = -1;
for (let i = beforeLines.length - 1; i >= 0; i--) {
  if (beforeLines[i].includes("from './test-runs/")) {
    importInsertIndex = i + 1;
    break;
  }
}

if (importInsertIndex === -1) {
  // Fallback: insert after the last import statement
  for (let i = beforeLines.length - 1; i >= 0; i--) {
    if (beforeLines[i].includes('import ') || beforeLines[i].includes("} from '")) {
      importInsertIndex = i + 1;
      break;
    }
  }
}

// Insert the import
const importStatement = `
// Feature #1356: Import test executor module (extracted ~4600 lines)
import {
  executeTest,
  launchBrowser as launchBrowserFromExecutor,
  setTestExecutorEmitter,
} from './test-runs/test-executor';
`;

// Insert marker where the functions were
const marker = [
  '',
  '// ============================================================================',
  '// NOTE: executeTest and launchBrowser functions EXTRACTED to ./test-runs/test-executor.ts',
  '// Feature #1356: Backend file size limit enforcement',
  '// Total extracted: ~4600 lines of test execution logic',
  '// ============================================================================',
  '',
];

// Build new content
const newBeforeLines = [
  ...beforeLines.slice(0, importInsertIndex),
  importStatement,
  ...beforeLines.slice(importInsertIndex),
];

const newContent = [...newBeforeLines, ...marker, ...afterLines].join('\n');

// Write the modified file
fs.writeFileSync(testRunsPath, newContent);

console.log('');
console.log('Successfully removed executeTest and launchBrowser from test-runs.ts');
console.log('New line count:', newContent.split('\n').length);
console.log('Lines removed:', lines.length - newContent.split('\n').length);
console.log('');
console.log('IMPORTANT: You need to update the code to:');
console.log('1. Call setTestExecutorEmitter(emitRunEvent) in setSocketIO()');
console.log('2. Remove local launchBrowser calls (use launchBrowserFromExecutor)');
