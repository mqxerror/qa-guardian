#!/usr/bin/env node
/**
 * Script to add .js extensions to all relative imports in TypeScript files
 * Required for Node.js ESM with moduleResolution: NodeNext
 *
 * For directory imports with index.ts, converts:
 *   from './routes/api-keys' -> from './routes/api-keys/index.js'
 *
 * For file imports, converts:
 *   from './utils/cache' -> from './utils/cache.js'
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, dirname, resolve } from 'path';

const srcDir = '/Users/mqxerrormac16/Documents/QA-Dam3oun/backend/src';
const dryRun = process.argv.includes('--dry-run');

// Regex to match relative imports (from './' or from '../')
const importRegex = /from\s+['"](\.[^'"]+)['"]/g;
const exportRegex = /export\s+(?:\*|{[^}]*})\s+from\s+['"](\.[^'"]+)['"]/g;

function getAllTsFiles(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '__tests__') {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function resolveImportPath(importPath, fromFile) {
  const fromDir = dirname(fromFile);
  const targetPath = resolve(fromDir, importPath);

  // Check if it's already has an extension
  if (importPath.endsWith('.js') || importPath.endsWith('.json') || importPath.endsWith('.mjs')) {
    return importPath; // Already has extension
  }

  // IMPORTANT: Check for FILE first, then directory
  // Node ESM resolution prioritizes files over directories

  // Check if target.ts exists (it's a file import)
  if (existsSync(targetPath + '.ts') || existsSync(targetPath + '.tsx')) {
    return importPath + '.js';
  }

  // Check if target.js already exists (for JS files)
  if (existsSync(targetPath + '.js')) {
    return importPath + '.js';
  }

  // Check if target is a directory with index.ts (barrel file)
  if (existsSync(targetPath) && statSync(targetPath).isDirectory()) {
    const indexPath = join(targetPath, 'index.ts');
    if (existsSync(indexPath)) {
      return importPath + '/index.js';
    }
  }

  // If we can't determine, add .js extension as default
  console.warn(`  Warning: Could not determine type for import "${importPath}" in ${fromFile}`);
  return importPath + '.js';
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  let changes = [];

  // Process imports
  content = content.replace(importRegex, (match, importPath) => {
    if (importPath.startsWith('.')) {
      const newPath = resolveImportPath(importPath, filePath);
      if (newPath !== importPath) {
        changes.push(`  ${importPath} -> ${newPath}`);
        modified = true;
        return `from '${newPath}'`;
      }
    }
    return match;
  });

  // Process re-exports
  content = content.replace(exportRegex, (match, importPath) => {
    if (importPath.startsWith('.')) {
      const newPath = resolveImportPath(importPath, filePath);
      if (newPath !== importPath) {
        const exportPart = match.substring(0, match.lastIndexOf('from'));
        changes.push(`  export ${importPath} -> ${newPath}`);
        modified = true;
        return `${exportPart}from '${newPath}'`;
      }
    }
    return match;
  });

  if (modified) {
    const relativePath = filePath.replace(srcDir + '/', '');
    console.log(`\nModifying: ${relativePath}`);
    changes.forEach(c => console.log(c));

    if (!dryRun) {
      writeFileSync(filePath, content, 'utf-8');
    }
  }

  return modified;
}

// Main
console.log('Adding .js extensions to relative imports...');
console.log(`Source directory: ${srcDir}`);
console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (modifying files)'}`);
console.log('');

const files = getAllTsFiles(srcDir);
console.log(`Found ${files.length} TypeScript files to process`);

let modifiedCount = 0;
for (const file of files) {
  if (processFile(file)) {
    modifiedCount++;
  }
}

console.log(`\n========================================`);
console.log(`Processed: ${files.length} files`);
console.log(`Modified: ${modifiedCount} files`);
if (dryRun) {
  console.log(`\nRun without --dry-run to apply changes`);
}
