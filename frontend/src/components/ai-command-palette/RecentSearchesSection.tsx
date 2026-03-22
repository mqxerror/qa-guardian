/**
 * RecentSearchesSection - Renders the "Recent Searches" block in the command palette.
 * Extracted from AICommandPalette.tsx for component decomposition (Agent 7).
 */

interface RecentSearchesSectionProps {
  recentSearches: string[];
  /** Whether a border-top separator should be shown */
  borderTop: boolean;
  /** Clear all recent search history */
  onClearHistory: () => void;
  /** Re-run a previous search */
  onRerunSearch: (query: string) => void;
}

export function RecentSearchesSection({
  recentSearches,
  borderTop,
  onClearHistory,
  onRerunSearch,
}: RecentSearchesSectionProps) {
  if (recentSearches.length === 0) return null;

  return (
    <div className={`p-2 ${borderTop ? 'border-t border-border' : ''}`}>
      <div className="flex items-center justify-between px-3 py-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
          <span>🔍</span> Recent Searches
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClearHistory();
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Clear search history"
        >
          Clear
        </button>
      </div>
      {recentSearches.map((search, idx) => (
        <button
          key={`search-${idx}`}
          onClick={() => onRerunSearch(search)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-muted text-foreground"
        >
          <span className="text-muted-foreground">↻</span>
          <div className="flex-1">
            <p className="font-medium">{search}</p>
            <p className="text-sm text-muted-foreground">Click to search again</p>
          </div>
        </button>
      ))}
    </div>
  );
}
