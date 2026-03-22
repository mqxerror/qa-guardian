/**
 * CommandSection - Renders a group of commands in the palette organized by category
 * Extracted from AICommandPalette.tsx to deduplicate repeated category rendering (Agent 7)
 */

import React from 'react';
import type { CommandPaletteAction } from './types';

interface CommandSectionProps {
  /** Section heading label */
  title: string;
  /** Category key to filter commands */
  category: CommandPaletteAction['category'];
  /** All filtered commands (used to find global index) */
  filteredCommands: CommandPaletteAction[];
  /** Currently selected index (for keyboard navigation highlight) */
  selectedIndex: number;
  /** Active search query (used to decide whether to show highlights) */
  query: string;
  /** Map of command id -> matched character indices for highlighting */
  matchHighlights: Map<string, { labelIndices: number[]; descIndices: number[] }>;
  /** Callback to execute a command */
  onExecute: (cmd: CommandPaletteAction) => void;
  /** Render highlighted text with matched indices */
  renderHighlightedText: (text: string, indices: number[], className?: string) => React.ReactNode;
  /** Optional: show a border-top separator */
  borderTop?: boolean;
}

export function CommandSection({
  title,
  category,
  filteredCommands,
  selectedIndex,
  query,
  matchHighlights,
  onExecute,
  renderHighlightedText,
  borderTop = false,
}: CommandSectionProps) {
  const categoryCommands = filteredCommands.filter(c => c.category === category);
  if (categoryCommands.length === 0) return null;

  return (
    <div className={`p-2 ${borderTop ? 'border-t border-border' : ''}`}>
      <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">{title}</p>
      {categoryCommands.map((cmd) => {
        const globalIdx = filteredCommands.findIndex(c => c.id === cmd.id);
        const highlights = matchHighlights.get(cmd.id);
        return (
          <button
            key={cmd.id}
            onClick={() => onExecute(cmd)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              selectedIndex === globalIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
            }`}
          >
            <span className="text-lg">{cmd.icon}</span>
            <div className="flex-1">
              <p className="font-medium">
                {query && highlights ? renderHighlightedText(cmd.label, highlights.labelIndices) : cmd.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {query && highlights ? renderHighlightedText(cmd.description, highlights.descIndices, 'bg-primary/10 text-primary/80') : cmd.description}
              </p>
            </div>
            {cmd.shortcut && (
              <kbd className="px-2 py-1 text-xs bg-muted rounded">{cmd.shortcut}</kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}
