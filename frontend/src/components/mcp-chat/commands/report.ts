// Feature #1699: /report command definition
import { SlashCommand } from '../types';

export const reportCommand: SlashCommand = {
  name: '/report',
  description: 'Generate a test report',
  usage: '/report [period]',
  parameters: [
    { name: 'period', description: 'Time period (daily, weekly, monthly)', required: false, type: 'enum', enumValues: ['daily', 'weekly', 'monthly'], defaultValue: 'daily' },
  ],
  toolMapping: 'get_dashboard_summary',
  category: 'reporting',
  generatePrompt: (args) => {
    const periodMap: Record<string, string> = { weekly: '7d', monthly: '30d', daily: '24h' };
    const period = periodMap[args[0]?.toLowerCase()] || '24h';
    return `Use get_dashboard_summary with period "${period}" and list_recent_runs to generate a comprehensive test report.`;
  },
};
