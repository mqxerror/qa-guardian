/**
 * Types for the AI Command Palette
 * Extracted from AICommandPalette.tsx (Agent 7)
 */

/** A command that can be executed from the palette */
export interface CommandPaletteAction {
  id: string;
  icon: string;
  label: string;
  description: string;
  category: 'ai-insights' | 'navigation' | 'actions' | 'recent';
  shortcut?: string;
  action: () => void;
}

/** Result of AI command processing */
export interface AICommandResult {
  type: 'explanation' | 'analysis' | 'suggestion' | 'action';
  title: string;
  content: string;
  details?: string[];
  confidence?: number;
}

/** Result of fuzzy matching a query against text */
export interface FuzzyMatchResult {
  matches: boolean;
  score: number;
  matchedIndices: number[];
}
