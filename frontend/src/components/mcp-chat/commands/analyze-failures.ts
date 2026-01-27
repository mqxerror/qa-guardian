// Feature #1699: /analyze-failures command definition
import { SlashCommand } from '../types';

export const analyzeFailuresCommand: SlashCommand = {
  name: '/analyze-failures',
  description: 'Analyze recent test failures',
  usage: '/analyze-failures',
  parameters: [],
  toolMapping: 'get_failing_tests',
  category: 'analysis',
  generatePrompt: () => {
    return `Use get_failing_tests to list recent failures, then use analyze_failure on any failures found. Provide insights on common patterns.`;
  },
};
