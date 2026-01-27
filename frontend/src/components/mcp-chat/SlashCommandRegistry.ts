// Feature #1698: Slash Command Registry
// Centralized registry for all slash commands with lookup and parsing functions

import { SlashCommand, ParsedSlashCommand, SlashCommandSuggestion } from './types';
import { allCommands } from './commands';

/**
 * Slash Command Registry
 * Manages command registration, lookup, parsing, and suggestions
 */
class SlashCommandRegistry {
  private commands: Map<string, SlashCommand> = new Map();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize registry with all commands
   */
  private initialize(): void {
    if (this.isInitialized) return;

    for (const command of allCommands) {
      this.register(command);
    }
    this.isInitialized = true;
  }

  /**
   * Register a single command
   */
  register(command: SlashCommand): void {
    this.commands.set(command.name.toLowerCase(), command);
  }

  /**
   * Get a command by name
   */
  get(name: string): SlashCommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  /**
   * Get all registered commands
   */
  getAll(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Parse a user input message and extract slash command if present
   */
  parse(message: string): ParsedSlashCommand | null {
    const trimmed = message.trim();
    if (!trimmed.startsWith('/')) return null;

    const parts = trimmed.split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const command = this.get(commandName);
    if (!command) {
      return {
        command: commandName,
        args,
        formattedPrompt: '',
        isValid: false,
        validationError: `Unknown command: ${commandName}. Type /help to see available commands.`,
      };
    }

    // Validate required parameters
    const requiredParams = command.parameters.filter(p => p.required);
    if (args.length < requiredParams.length) {
      return {
        command: commandName,
        args,
        formattedPrompt: '',
        isValid: false,
        validationError: `Missing required parameter: ${requiredParams[args.length].name}. Usage: ${command.usage}`,
      };
    }

    return {
      command: commandName,
      args,
      formattedPrompt: command.generatePrompt(args),
      isValid: true,
    };
  }

  /**
   * Get suggestions based on partial input
   * Used for autocomplete dropdown
   */
  getSuggestions(input: string): SlashCommandSuggestion[] {
    if (!input.startsWith('/')) return [];

    const searchTerm = input.toLowerCase();
    const suggestions: SlashCommandSuggestion[] = [];

    for (const command of this.commands.values()) {
      if (command.name.toLowerCase().startsWith(searchTerm)) {
        suggestions.push({
          command: command.name,
          description: command.description,
          usage: command.usage,
          params: command.parameters.map(p => p.name),
          category: command.category,
        });
      }
    }

    // Sort by command name
    return suggestions.sort((a, b) => a.command.localeCompare(b.command));
  }

  /**
   * Generate help text for all commands
   */
  getHelpText(): string {
    const commandsByCategory = new Map<string, SlashCommand[]>();

    for (const command of this.commands.values()) {
      if (command.name === '/help') continue;
      const category = command.category || 'other';
      if (!commandsByCategory.has(category)) {
        commandsByCategory.set(category, []);
      }
      commandsByCategory.get(category)!.push(command);
    }

    let helpText = '**Available Slash Commands:**\n\n';

    for (const [category, cmds] of commandsByCategory) {
      helpText += cmds.map(cmd => `**${cmd.usage}** - ${cmd.description}`).join('\n') + '\n';
    }

    helpText += '\n**Examples:**\n';
    helpText += '- `/create-test Login Test https://example.com`\n';
    helpText += '- `/security-scan https://mercan.pa`\n';
    helpText += '- `/list-projects`';

    return helpText;
  }

  /**
   * Check if a command is handled locally (no AI call needed)
   */
  isLocalCommand(commandName: string): boolean {
    const command = this.get(commandName);
    return command?.toolMapping === '';
  }
}

// Export singleton instance
export const slashCommandRegistry = new SlashCommandRegistry();
