// Script to remove TestSuitePage function from App.tsx
const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, '../frontend/src/App.tsx');

// Read App.tsx
const content = fs.readFileSync(appTsxPath, 'utf8');
const lines = content.split('\n');

// TestSuitePage function is from line 2243 to 9762 (1-indexed)
// In 0-indexed: 2242 to 9761
// We'll keep lines 0-2241 (inclusive) and 9762-end

// Add a comment marker where the function was
const beforeLines = lines.slice(0, 2242);
const afterLines = lines.slice(9762);

const marker = [
  '',
  '// TestSuitePage EXTRACTED to ./pages/TestSuitePage.tsx (~7,520 lines)',
  '// Feature #1441: Split App.tsx into logical modules',
  ''
];

const newContent = [...beforeLines, ...marker, ...afterLines].join('\n');

// Write the modified file
fs.writeFileSync(appTsxPath, newContent);

console.log('Successfully removed TestSuitePage function from App.tsx');
console.log('Lines before removal:', lines.length);
console.log('Lines after removal:', newContent.split('\n').length);
console.log('Lines removed:', lines.length - newContent.split('\n').length);
