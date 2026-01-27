// Feature #1698: /help command definition
import { SlashCommand } from '../types';

export const helpCommand: SlashCommand = {
  name: '/help',
  description: 'Show available slash commands',
  usage: '/help',
  parameters: [],
  toolMapping: '', // Handled locally, no MCP tool needed
  category: 'management',
  generatePrompt: () => '', // Empty - handled locally
};
