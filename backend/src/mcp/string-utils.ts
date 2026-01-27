/**
 * QA Guardian MCP String Utilities
 *
 * Utility functions for string matching and similarity calculations.
 * Extracted from server.ts for better organization (Feature #1356).
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param s1 First string
 * @param s2 Second string
 * @returns Edit distance (number of single-character edits needed)
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  // Create distance matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill in the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Find similar strings using Levenshtein distance and partial matching
 * @param requested The string to find matches for
 * @param available List of available strings to search
 * @param threshold Maximum edit distance to consider (default: 3)
 * @param maxSuggestions Maximum number of suggestions to return (default: 3)
 * @returns Array of similar strings, sorted by relevance
 */
export function findSimilarStrings(
  requested: string,
  available: string[],
  threshold = 3,
  maxSuggestions = 3
): string[] {
  const suggestions: { value: string; distance: number }[] = [];

  for (const item of available) {
    const distance = levenshteinDistance(
      requested.toLowerCase(),
      item.toLowerCase()
    );
    if (distance <= threshold) {
      suggestions.push({ value: item, distance });
    }
  }

  // Also check for partial matches (substring)
  for (const item of available) {
    const lowerRequested = requested.toLowerCase();
    const lowerItem = item.toLowerCase();

    if (
      lowerItem.includes(lowerRequested) ||
      lowerRequested.includes(lowerItem) ||
      lowerItem.replace(/_/g, '').includes(lowerRequested.replace(/_/g, '')) ||
      lowerRequested.replace(/_/g, '').includes(lowerItem.replace(/_/g, ''))
    ) {
      // Check if already added
      if (!suggestions.find(s => s.value === item)) {
        suggestions.push({ value: item, distance: 1 }); // Give partial matches a low distance
      }
    }
  }

  // Sort by distance and return top suggestions
  return suggestions
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxSuggestions)
    .map(s => s.value);
}

/**
 * Find similar tool names (convenience wrapper)
 * @param requestedTool The tool name to find matches for
 * @param availableTools List of available tool names
 * @returns Array of similar tool names
 */
export function findSimilarTools(requestedTool: string, availableTools: string[]): string[] {
  return findSimilarStrings(requestedTool, availableTools);
}
