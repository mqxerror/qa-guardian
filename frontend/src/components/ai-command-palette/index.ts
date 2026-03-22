/**
 * AI Command Palette Components Index
 * Agent 7: Extracted from AICommandPalette.tsx for component decomposition
 */

// Types
export type { CommandPaletteAction, AICommandResult, FuzzyMatchResult } from './types';

// Fuzzy matching utilities
export { levenshteinDistance, fuzzyMatchWithScore, getCommandScore } from './fuzzyMatch';

// Custom hooks
export { useCommandPaletteCommands } from './useCommandPaletteCommands';

// Sub-components
export { CommandSection } from './CommandSection';
export { AIResultDisplay } from './AIResultDisplay';
export { RecentPagesSection } from './RecentPagesSection';
export { RecentSearchesSection } from './RecentSearchesSection';
