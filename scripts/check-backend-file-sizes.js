// Script to check backend file sizes
const fs = require('fs');
const path = require('path');

function walkDir(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, files);
    } else if (item.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      files.push({ path: fullPath.replace(path.join(__dirname, '../backend/src/'), ''), lines });
    }
  }
  return files;
}

const srcDir = path.join(__dirname, '../backend/src');
const files = walkDir(srcDir);
files.sort((a, b) => b.lines - a.lines);

console.log('=== Files over 1500 lines (NEED SPLITTING) ===');
const overLimit = files.filter(f => f.lines > 1500);
overLimit.forEach(f => console.log(f.lines + ' lines: ' + f.path));
console.log('Total files over limit:', overLimit.length);

console.log('\n=== Files 500-1500 lines (for reference) ===');
const mediumFiles = files.filter(f => f.lines > 500 && f.lines <= 1500);
mediumFiles.forEach(f => console.log(f.lines + ' lines: ' + f.path));
console.log('Total medium files:', mediumFiles.length);

console.log('\n=== Summary ===');
console.log('Total .ts files:', files.length);
console.log('Files over 1500 lines:', overLimit.length);
console.log('Files 500-1500 lines:', mediumFiles.length);
console.log('Files under 500 lines:', files.length - overLimit.length - mediumFiles.length);
