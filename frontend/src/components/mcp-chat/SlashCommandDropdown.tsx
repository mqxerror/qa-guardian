// Feature #1700: Slash Command Dropdown Component
// Reusable autocomplete dropdown for slash commands

import React from 'react';
import { SlashCommandSuggestion } from './types';

interface SlashCommandDropdownProps {
  /** Array of filtered command suggestions to display */
  suggestions: SlashCommandSuggestion[];
  /** Currently selected index for keyboard navigation */
  selectedIndex: number;
  /** Callback when a command is selected */
  onSelect: (suggestion: SlashCommandSuggestion) => void;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * Dropdown component for displaying slash command suggestions
 * Renders above the input field with command name, usage, and description
 */
export function SlashCommandDropdown({
  suggestions,
  selectedIndex,
  onSelect,
  className = '',
}: SlashCommandDropdownProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className={`absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-10 ${className}`}
      role="listbox"
      aria-label="Slash command suggestions"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground">Slash Commands</span>
        <span className="text-xs text-muted-foreground ml-2">
          (Tab to select)
        </span>
      </div>

      {/* Command List */}
      <div className="max-h-64 overflow-y-auto">
        {suggestions.map((suggestion, idx) => (
          <button
            key={suggestion.command}
            role="option"
            aria-selected={idx === selectedIndex}
            onClick={() => onSelect(suggestion)}
            className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-muted/50 transition-colors ${
              idx === selectedIndex ? 'bg-muted' : ''
            }`}
          >
            {/* Command and Parameters */}
            <div className="flex items-center gap-3">
              <code className="px-2 py-1 rounded bg-primary/10 text-primary font-mono text-sm">
                {suggestion.command}
              </code>
              {suggestion.usage !== suggestion.command && (
                <span className="text-xs text-muted-foreground">
                  {suggestion.usage.replace(suggestion.command, '').trim()}
                </span>
              )}
            </div>

            {/* Description */}
            <span className="text-sm text-muted-foreground">
              {suggestion.description}
            </span>
          </button>
        ))}
      </div>

      {/* Footer with navigation hint */}
      <div className="px-3 py-1.5 border-t border-border bg-muted/20">
        <span className="text-[10px] text-muted-foreground">
          Tab / Enter to select
        </span>
        <span className="text-[10px] text-muted-foreground/50 mx-2">|</span>
        <span className="text-[10px] text-muted-foreground">
          Esc to close
        </span>
      </div>
    </div>
  );
}
