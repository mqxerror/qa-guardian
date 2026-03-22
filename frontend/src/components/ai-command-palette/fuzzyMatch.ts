/**
 * Fuzzy matching utilities for the AI Command Palette
 * Extracted from AICommandPalette.tsx (Agent 7)
 * Feature #1507: Enhanced fuzzy matching with scoring and character highlighting
 */

import type { FuzzyMatchResult, CommandPaletteAction } from './types';

/** Calculate Levenshtein edit distance between two strings for typo tolerance */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Enhanced fuzzy matching with scoring.
 * Returns a match result with a score indicating match quality and
 * the indices of characters in the text that matched the query.
 */
export function fuzzyMatchWithScore(text: string, query: string): FuzzyMatchResult {
  if (!query) return { matches: true, score: 0, matchedIndices: [] };

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase().trim();
  const matchedIndices: number[] = [];

  // Exact match (highest priority)
  if (textLower === queryLower) {
    return { matches: true, score: 1000, matchedIndices: Array.from({ length: text.length }, (_, i) => i) };
  }

  // Starts with query (high priority)
  if (textLower.startsWith(queryLower)) {
    for (let i = 0; i < queryLower.length; i++) {
      matchedIndices.push(i);
    }
    return { matches: true, score: 500 + (queryLower.length / textLower.length) * 100, matchedIndices };
  }

  // Contains query as substring (medium-high priority)
  const containsIndex = textLower.indexOf(queryLower);
  if (containsIndex !== -1) {
    for (let i = 0; i < queryLower.length; i++) {
      matchedIndices.push(containsIndex + i);
    }
    // Penalize if not at word boundary
    const atWordBoundary = containsIndex === 0 || /\s/.test(text[containsIndex - 1]);
    return { matches: true, score: atWordBoundary ? 400 : 300, matchedIndices };
  }

  // Word-by-word matching (medium priority)
  const searchTerms = queryLower.split(/\s+/).filter(Boolean);
  if (searchTerms.length > 1) {
    const allTermsMatch = searchTerms.every(term => textLower.includes(term));
    if (allTermsMatch) {
      searchTerms.forEach(term => {
        const idx = textLower.indexOf(term);
        if (idx !== -1) {
          for (let i = 0; i < term.length; i++) {
            if (!matchedIndices.includes(idx + i)) {
              matchedIndices.push(idx + i);
            }
          }
        }
      });
      matchedIndices.sort((a, b) => a - b);
      return { matches: true, score: 200 + (matchedIndices.length / textLower.length) * 50, matchedIndices };
    }
  }

  // Fuzzy character matching (lower priority) - characters appear in order
  let queryIdx = 0;
  for (let i = 0; i < textLower.length && queryIdx < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIdx]) {
      matchedIndices.push(i);
      queryIdx++;
    }
  }
  if (queryIdx === queryLower.length) {
    // Calculate score based on match compactness
    const compactness = matchedIndices.length > 1
      ? 1 - (matchedIndices[matchedIndices.length - 1] - matchedIndices[0]) / textLower.length
      : 1;
    return { matches: true, score: 100 + compactness * 50, matchedIndices };
  }

  // Typo tolerance using Levenshtein distance (lowest priority but still matches)
  const words = textLower.split(/\s+/);
  for (const word of words) {
    const distance = levenshteinDistance(queryLower, word);
    const maxAllowedDistance = Math.max(1, Math.floor(queryLower.length / 3));
    if (distance <= maxAllowedDistance) {
      // Find approximate match location
      const wordIndex = textLower.indexOf(word);
      for (let i = 0; i < word.length; i++) {
        matchedIndices.push(wordIndex + i);
      }
      return { matches: true, score: 50 - distance * 10, matchedIndices };
    }
  }

  return { matches: false, score: 0, matchedIndices: [] };
}

/** Get combined score for a command based on label and description matches */
export function getCommandScore(
  cmd: CommandPaletteAction,
  query: string
): { score: number; labelIndices: number[]; descIndices: number[] } {
  const labelResult = fuzzyMatchWithScore(cmd.label, query);
  const descResult = fuzzyMatchWithScore(cmd.description, query);
  // Label matches are weighted higher than description matches
  const score = Math.max(labelResult.score * 1.5, descResult.score);
  return {
    score,
    labelIndices: labelResult.matches ? labelResult.matchedIndices : [],
    descIndices: descResult.matches ? descResult.matchedIndices : [],
  };
}
