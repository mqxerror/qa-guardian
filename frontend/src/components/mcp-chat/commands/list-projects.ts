// Feature #1698: /list-projects command definition
import { SlashCommand } from '../types';

export const listProjectsCommand: SlashCommand = {
  name: '/list-projects',
  description: 'List all projects',
  usage: '/list-projects',
  parameters: [],
  toolMapping: 'list_projects',
  category: 'management',
  generatePrompt: () => {
    return `Use list_projects to show all available projects with their IDs and names.`;
  },
};
