// Script to remove TestDetailPage function and its interfaces from App.tsx
const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, '../frontend/src/App.tsx');

// Read App.tsx
const content = fs.readFileSync(appTsxPath, 'utf8');
const lines = content.split('\n');

// Interfaces and TestDetailPage function are from line 2248 to 12155 (1-indexed)
// In 0-indexed: 2247 to 12154
// We'll keep lines 0-2246 (inclusive) and 12155-end

// Add a comment marker where the code was
const beforeLines = lines.slice(0, 2247);
const afterLines = lines.slice(12155);

const marker = [
  '',
  '// TestDetailPage EXTRACTED to ./pages/TestDetailPage.tsx (~9,907 lines)',
  '// Feature #1441: Split App.tsx into logical modules',
  '// Types also extracted: TestRunType, ConsoleLog, NetworkRequest, TestRunResult, StepResult',
  ''
];

const newContent = [...beforeLines, ...marker, ...afterLines].join('\n');

// Write the modified file
fs.writeFileSync(appTsxPath, newContent);

console.log('Successfully removed TestDetailPage function from App.tsx');
console.log('Lines before removal:', lines.length);
console.log('Lines after removal:', newContent.split('\n').length);
console.log('Lines removed:', lines.length - newContent.split('\n').length);
