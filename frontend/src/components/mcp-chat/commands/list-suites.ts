// Feature #1699: /list-suites command definition
import { SlashCommand } from '../types';

export const listSuitesCommand: SlashCommand = {
  name: '/list-suites',
  description: 'List test suites in a project',
  usage: '/list-suites [project_name_or_id]',
  parameters: [
    { name: 'project_name_or_id', description: 'Project name or ID', required: false, type: 'string' },
  ],
  toolMapping: 'list_test_suites',
  category: 'management',
  generatePrompt: (args) => {
    const project = args[0];
    if (project) {
      return `Use list_projects to find "${project}", then use list_test_suites to list all test suites in that project.`;
    }
    return `Use list_test_suites to list all test suites. You may need to call list_projects first to get project IDs.`;
  },
};
