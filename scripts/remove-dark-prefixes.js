#!/usr/bin/env node
/**
 * Script to remove all dead dark: prefix declarations from frontend code.
 * The dark theme is handled by :root CSS variables, making dark: prefixes dead code.
 *
 * Usage: node scripts/remove-dark-prefixes.js
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '..', 'frontend', 'src');

// Stats
let filesProcessed = 0;
let filesModified = 0;
let totalRemoved = 0;

/**
 * Remove dark: prefixed classes from a string.
 * Handles patterns like:
 * - dark:bg-gray-800
 * - dark:text-gray-300
 * - dark:hover:bg-gray-700
 * - dark:border-gray-700
 * - dark:bg-red-900/30
 */
function removeDarkPrefixes(content) {
  let modified = content;
  let removed = 0;

  // Pattern to match dark: prefixed Tailwind classes
  // Matches: dark:word-word-word/number or dark:word-word-word
  // Also handles dark:hover:*, dark:focus:*, etc.
  const darkPrefixPattern = /\s*dark:(?:[a-z]+:)*[a-z]+-[a-z0-9/_.-]+/g;

  // Find all matches first for counting
  const matches = modified.match(darkPrefixPattern);
  if (matches) {
    removed = matches.length;
  }

  // Remove dark: prefixed classes
  modified = modified.replace(darkPrefixPattern, '');

  // Clean up extra spaces that might result from removal
  // Replace multiple spaces with single space (but preserve newlines)
  modified = modified.replace(/([^\S\n]+)/g, (match, spaces) => {
    // If it's just spaces (no newlines), collapse to single space
    return spaces.includes('\n') ? spaces : ' ';
  });

  // Clean up empty className strings like className=""
  // But be careful not to remove intentionally empty ones

  return { modified, removed };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { modified, removed } = removeDarkPrefixes(content);

  filesProcessed++;

  if (removed > 0) {
    fs.writeFileSync(filePath, modified, 'utf8');
    filesModified++;
    totalRemoved += removed;
    console.log(`✓ ${path.relative(FRONTEND_SRC, filePath)}: removed ${removed} dark: prefixes`);
  }
}

/**
 * Recursively find all .tsx and .ts files
 */
function findFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      files.push(fullPath);
    }
  }

  return files;
}

// Main execution
console.log('Removing dead dark: prefix declarations from frontend/src/...\n');

const files = findFiles(FRONTEND_SRC);
console.log(`Found ${files.length} TypeScript files to process.\n`);

for (const file of files) {
  processFile(file);
}

console.log('\n========================================');
console.log(`Files processed: ${filesProcessed}`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total dark: prefixes removed: ${totalRemoved}`);
console.log('========================================');
