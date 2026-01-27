// Feature #1699: /run-suite command definition
import { SlashCommand } from '../types';

export const runSuiteCommand: SlashCommand = {
  name: '/run-suite',
  description: 'Run a test suite',
  usage: '/run-suite [suite_name_or_id]',
  parameters: [
    { name: 'suite_name_or_id', description: 'Suite name or ID', required: true, type: 'string' },
  ],
  toolMapping: 'run_test_suite',
  category: 'execution',
  generatePrompt: (args) => {
    return `Use the run_test_suite tool to run the test suite "${args[0]}". First list_test_suites to find the suite ID if needed.`;
  },
};
