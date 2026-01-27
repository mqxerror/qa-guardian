// Script to remove QAChatWidget and ChatMessage interface from App.tsx
const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, '../frontend/src/App.tsx');

// Read App.tsx
const content = fs.readFileSync(appTsxPath, 'utf8');
const lines = content.split('\n');

// ChatMessage interface (lines 629-657) and QAChatWidget function (659-1565)
// In 0-indexed: 628-656 (interface) and 658-1564 (function)
// We'll remove 628-1564 inclusive

const beforeLines = lines.slice(0, 628);
const afterLines = lines.slice(1565);

const marker = [
  '',
  '// QAChatWidget EXTRACTED to ./components/QAChatWidget.tsx (~936 lines)',
  '// Feature #1441: Split App.tsx into logical modules',
  ''
];

const newContent = [...beforeLines, ...marker, ...afterLines].join('\n');

// Write the modified file
fs.writeFileSync(appTsxPath, newContent);

console.log('Successfully removed QAChatWidget from App.tsx');
console.log('Lines before removal:', lines.length);
console.log('Lines after removal:', newContent.split('\n').length);
console.log('Lines removed:', lines.length - newContent.split('\n').length);
