// Feature #1698/#1699: Command exports
// Feature #1745: Added /full-test command
// All slash command definitions for MCP Chat

// Export individual commands
export { createTestCommand } from './create-test';
export { runSuiteCommand } from './run-suite';
export { securityScanCommand } from './security-scan';
export { visualTestCommand } from './visual-test';
export { loadTestCommand } from './load-test';
export { accessibilityScanCommand } from './accessibility-scan';
export { analyzeFailuresCommand } from './analyze-failures';
export { listProjectsCommand } from './list-projects';
export { listSuitesCommand } from './list-suites';
export { reportCommand } from './report';
export { helpCommand } from './help';
export { fullTestCommand } from './full-test';

// Import all commands for the registry
import { createTestCommand } from './create-test';
import { runSuiteCommand } from './run-suite';
import { securityScanCommand } from './security-scan';
import { visualTestCommand } from './visual-test';
import { loadTestCommand } from './load-test';
import { accessibilityScanCommand } from './accessibility-scan';
import { analyzeFailuresCommand } from './analyze-failures';
import { listProjectsCommand } from './list-projects';
import { listSuitesCommand } from './list-suites';
import { reportCommand } from './report';
import { helpCommand } from './help';
import { fullTestCommand } from './full-test';
import { SlashCommand } from '../types';

/**
 * All registered slash commands
 * Commands are auto-registered by the SlashCommandRegistry
 *
 * To add a new command:
 * 1. Create a new file in this folder (e.g., my-command.ts)
 * 2. Export the command definition
 * 3. Import and add to allCommands array
 */
export const allCommands: SlashCommand[] = [
  // Testing commands
  createTestCommand,
  visualTestCommand,
  loadTestCommand,
  accessibilityScanCommand,
  fullTestCommand, // Feature #1745: Comprehensive site testing

  // Execution commands
  runSuiteCommand,

  // Security commands
  securityScanCommand,

  // Analysis commands
  analyzeFailuresCommand,

  // Management commands
  listProjectsCommand,
  listSuitesCommand,

  // Reporting commands
  reportCommand,

  // Help
  helpCommand,
];
