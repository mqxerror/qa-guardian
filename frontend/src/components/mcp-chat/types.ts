// Feature #1698: Slash Command System Types
// Extensible type definitions for MCP Chat slash commands

/**
 * Parameter definition for slash commands
 */
export interface SlashCommandParameter {
  name: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'url' | 'enum';
  enumValues?: string[];
  defaultValue?: string;
}

/**
 * Slash command definition interface
 * Each command file exports an object implementing this interface
 */
export interface SlashCommand {
  /** Command name including slash (e.g., '/create-test') */
  name: string;
  /** Brief description shown in autocomplete */
  description: string;
  /** Usage example (e.g., '/create-test [name] [url]') */
  usage: string;
  /** Parameter definitions */
  parameters: SlashCommandParameter[];
  /** MCP tool this command maps to */
  toolMapping: string;
  /** Generate the prompt to send to AI based on parsed arguments */
  generatePrompt: (args: string[]) => string;
  /** Optional category for grouping in help */
  category?: 'testing' | 'execution' | 'analysis' | 'security' | 'management' | 'reporting';
}

/**
 * Parsed slash command result
 */
export interface ParsedSlashCommand {
  command: string;
  args: string[];
  formattedPrompt: string;
  isValid: boolean;
  validationError?: string;
}

/**
 * Suggestion item for autocomplete dropdown
 */
export interface SlashCommandSuggestion {
  command: string;
  description: string;
  usage: string;
  params: string[];
  category?: string;
}

/**
 * Registry state for managing commands
 */
export interface SlashCommandRegistryState {
  commands: Map<string, SlashCommand>;
  isLoaded: boolean;
}
