// Feature #1698: Slash Command Help Component
// Displays available slash commands in a formatted view

import React from 'react';
import { slashCommandRegistry } from './SlashCommandRegistry';

interface SlashCommandHelpProps {
  className?: string;
}

/**
 * Component to display all available slash commands
 * Can be used in help dialogs or command palette
 */
export function SlashCommandHelp({ className = '' }: SlashCommandHelpProps) {
  const commands = slashCommandRegistry.getAll().filter(cmd => cmd.name !== '/help');

  // Group commands by category
  const groupedCommands = commands.reduce((acc, cmd) => {
    const category = cmd.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(cmd);
    return acc;
  }, {} as Record<string, typeof commands>);

  const categoryLabels: Record<string, string> = {
    testing: 'Testing',
    execution: 'Execution',
    analysis: 'Analysis',
    security: 'Security',
    management: 'Management',
    reporting: 'Reporting',
    other: 'Other',
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold">Available Slash Commands</h3>

      {Object.entries(groupedCommands).map(([category, cmds]) => (
        <div key={category} className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            {categoryLabels[category] || category}
          </h4>
          <div className="space-y-1">
            {cmds.map(cmd => (
              <div
                key={cmd.name}
                className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <code className="px-2 py-1 rounded bg-primary/10 text-primary font-mono text-sm">
                    {cmd.name}
                  </code>
                  {cmd.parameters.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {cmd.parameters.map(p => `[${p.name}${p.required ? '' : '?'}]`).join(' ')}
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">{cmd.description}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-medium mb-2">Tips</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>Type <code className="px-1 rounded bg-muted">/</code> to see all commands</li>
          <li>Use Tab or Enter to autocomplete a command</li>
          <li>Parameters in brackets are required, ? means optional</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Get help text as a string (for chat messages)
 */
export function getSlashCommandHelpText(): string {
  return slashCommandRegistry.getHelpText();
}
