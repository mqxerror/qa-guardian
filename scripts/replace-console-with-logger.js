/**
 * Script to replace console.log/warn/error with structured logger
 * Feature #439: Replace console.log calls with structured Pino logger
 *
 * This script will:
 * 1. In route files: replace console.* with request.log.*
 * 2. In service files: import logger and replace console.* with logger.*
 * 3. Skip test files and CLI scripts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Files/patterns to skip
const SKIP_PATTERNS = [
  /test-/,           // Test files
  /\.test\./,        // Test files
  /scripts\//,       // CLI scripts
  /logger\.ts$/,     // The logger itself
  /index\.ts$/,      // Main entry points (startup logs are OK)
  /worker\.ts$/,     // Worker entry (startup logs are OK)
];

// Check if a file should be skipped
function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

// Check if file is a route handler
function isRouteFile(filePath) {
  return filePath.includes('/routes/');
}

// Check if file is a service
function isServiceFile(filePath) {
  return filePath.includes('/services/') ||
         filePath.includes('/mcp/') ||
         filePath.includes('/utils/') ||
         filePath.includes('/middleware/') ||
         filePath.includes('/jobs/');
}

// Get all TypeScript files with console.* calls
function getFilesWithConsoleCalls() {
  const cmd = `grep -rln 'console\\.\\(log\\|warn\\|error\\|info\\|debug\\)' backend/src --include="*.ts"`;
  const output = execSync(cmd, { cwd: process.cwd(), encoding: 'utf8' });
  return output.trim().split('\n').filter(f => f);
}

// Transform console.* calls in a route file
function transformRouteFile(content, filePath) {
  let modified = content;
  let changes = [];

  // Replace console.log -> request.log.info
  const logMatches = content.match(/console\.log\(/g);
  if (logMatches) {
    modified = modified.replace(/console\.log\(/g, 'request.log.info(');
    changes.push(`console.log -> request.log.info (${logMatches.length})`);
  }

  // Replace console.warn -> request.log.warn
  const warnMatches = content.match(/console\.warn\(/g);
  if (warnMatches) {
    modified = modified.replace(/console\.warn\(/g, 'request.log.warn(');
    changes.push(`console.warn -> request.log.warn (${warnMatches.length})`);
  }

  // Replace console.error -> request.log.error
  const errorMatches = content.match(/console\.error\(/g);
  if (errorMatches) {
    modified = modified.replace(/console\.error\(/g, 'request.log.error(');
    changes.push(`console.error -> request.log.error (${errorMatches.length})`);
  }

  // Replace console.info -> request.log.info
  const infoMatches = content.match(/console\.info\(/g);
  if (infoMatches) {
    modified = modified.replace(/console\.info\(/g, 'request.log.info(');
    changes.push(`console.info -> request.log.info (${infoMatches.length})`);
  }

  // Replace console.debug -> request.log.debug
  const debugMatches = content.match(/console\.debug\(/g);
  if (debugMatches) {
    modified = modified.replace(/console\.debug\(/g, 'request.log.debug(');
    changes.push(`console.debug -> request.log.debug (${debugMatches.length})`);
  }

  return { modified, changes };
}

// Transform console.* calls in a service file
function transformServiceFile(content, filePath) {
  let modified = content;
  let changes = [];
  let needsImport = false;

  // Check if logger is already imported
  const hasLoggerImport = /import.*logger.*from.*['"].*logger/.test(content) ||
                          /import.*\{.*logger.*\}.*from.*['"].*logger/.test(content);

  // Replace console.log -> logger.info
  const logMatches = content.match(/console\.log\(/g);
  if (logMatches) {
    modified = modified.replace(/console\.log\(/g, 'logger.info(');
    changes.push(`console.log -> logger.info (${logMatches.length})`);
    needsImport = true;
  }

  // Replace console.warn -> logger.warn
  const warnMatches = content.match(/console\.warn\(/g);
  if (warnMatches) {
    modified = modified.replace(/console\.warn\(/g, 'logger.warn(');
    changes.push(`console.warn -> logger.warn (${warnMatches.length})`);
    needsImport = true;
  }

  // Replace console.error -> logger.error
  const errorMatches = content.match(/console\.error\(/g);
  if (errorMatches) {
    modified = modified.replace(/console\.error\(/g, 'logger.error(');
    changes.push(`console.error -> logger.error (${errorMatches.length})`);
    needsImport = true;
  }

  // Replace console.info -> logger.info
  const infoMatches = content.match(/console\.info\(/g);
  if (infoMatches) {
    modified = modified.replace(/console\.info\(/g, 'logger.info(');
    changes.push(`console.info -> logger.info (${infoMatches.length})`);
    needsImport = true;
  }

  // Replace console.debug -> logger.debug
  const debugMatches = content.match(/console\.debug\(/g);
  if (debugMatches) {
    modified = modified.replace(/console\.debug\(/g, 'logger.debug(');
    changes.push(`console.debug -> logger.debug (${debugMatches.length})`);
    needsImport = true;
  }

  // Add logger import if needed and not already present
  if (needsImport && !hasLoggerImport) {
    // Calculate relative path from this file to logger.ts
    const fileDir = path.dirname(filePath);
    const loggerPath = 'backend/src/services/logger.ts';
    let relativePath = path.relative(fileDir, 'backend/src/services');
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }
    relativePath = relativePath.replace(/\\/g, '/') + '/logger.js';

    // Add import at the top of the file (after existing imports)
    const importStatement = `import { logger } from '${relativePath}';\n`;

    // Find the last import statement and add after it
    const importRegex = /^import .+;?\s*$/gm;
    let lastImportIndex = 0;
    let match;
    while ((match = importRegex.exec(modified)) !== null) {
      lastImportIndex = match.index + match[0].length;
    }

    if (lastImportIndex > 0) {
      modified = modified.slice(0, lastImportIndex) + '\n' + importStatement + modified.slice(lastImportIndex);
    } else {
      // No imports found, add at the beginning
      modified = importStatement + modified;
    }
    changes.push(`Added logger import`);
  }

  return { modified, changes };
}

// Main function
async function main() {
  console.log('========================================');
  console.log('  Replace console.* with structured logger');
  console.log('  Feature #439');
  console.log('========================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`);
  console.log('');

  // Change to project root
  process.chdir(path.join(import.meta.dirname, '..'));

  const files = getFilesWithConsoleCalls();
  console.log(`Found ${files.length} files with console.* calls`);

  let totalFiles = 0;
  let totalChanges = 0;
  let skippedFiles = 0;
  let routeFiles = 0;
  let serviceFiles = 0;

  for (const file of files) {
    if (shouldSkip(file)) {
      if (VERBOSE) console.log(`  SKIP: ${file}`);
      skippedFiles++;
      continue;
    }

    const content = readFileSync(file, 'utf8');
    let result;
    let fileType;

    if (isRouteFile(file)) {
      result = transformRouteFile(content, file);
      fileType = 'route';
      routeFiles++;
    } else if (isServiceFile(file)) {
      result = transformServiceFile(content, file);
      fileType = 'service';
      serviceFiles++;
    } else {
      // Unknown file type - treat as service
      result = transformServiceFile(content, file);
      fileType = 'other';
    }

    if (result.changes.length > 0) {
      totalFiles++;
      totalChanges += result.changes.length;

      console.log(`\n[${fileType}] ${file}`);
      result.changes.forEach(c => console.log(`  - ${c}`));

      if (!DRY_RUN) {
        writeFileSync(file, result.modified);
      }
    }
  }

  console.log('\n========================================');
  console.log('  Summary');
  console.log('========================================');
  console.log(`  Files modified: ${totalFiles}`);
  console.log(`  Total changes: ${totalChanges}`);
  console.log(`  Route files: ${routeFiles}`);
  console.log(`  Service files: ${serviceFiles}`);
  console.log(`  Skipped files: ${skippedFiles}`);
  console.log('');

  if (DRY_RUN) {
    console.log('Run without --dry-run to apply changes.');
  }
}

main().catch(console.error);
