/**
 * RecentPagesSection - Renders the "Recent" pages block in the command palette.
 * Extracted from AICommandPalette.tsx for component decomposition (Agent 7).
 */

import type { CommandPaletteAction } from './types';

interface RecentPagesSectionProps {
  filteredCommands: CommandPaletteAction[];
  selectedIndex: number;
  onExecute: (cmd: CommandPaletteAction) => void;
}

export function RecentPagesSection({ filteredCommands, selectedIndex, onExecute }: RecentPagesSectionProps) {
  const recentCmds = filteredCommands.filter(c => c.category === 'recent');
  if (recentCmds.length === 0) return null;

  return (
    <div className="p-2">
      <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
        <span>🕐</span> Recent
      </p>
      {recentCmds.map((cmd) => {
        const globalIdx = filteredCommands.findIndex(c => c.id === cmd.id);
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
              <p className="font-medium">{cmd.label}</p>
              <p className="text-sm text-muted-foreground">{cmd.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
