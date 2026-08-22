import React, { useState } from 'react';
import { X, Search, Loader2, ArrowRight } from 'lucide-react';

interface SearchResult {
  cfi: string;
  excerpt: string;
  sectionIndex: number;
}

interface SearchDrawerProps {
  onNavigate: (cfi: string) => void;
  onClose: () => void;
}

export const SearchDrawer: React.FC<SearchDrawerProps> = ({ onNavigate, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setIsSearching(true);
    setHasSearched(true);
    setResults([]);

    try {
      const viewEl = document.querySelector('foliate-view') as any;
      if (viewEl && viewEl.search) {
        const matches: SearchResult[] = [];
        for await (const result of viewEl.search(q)) {
          matches.push({
            cfi: result.cfi,
            excerpt: result.excerpt || q,
            sectionIndex: result.sectionIndex || 0,
          });
          setResults([...matches]);
        }
      }
    } catch (err) {
      console.error('In-book search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-84 bg-[var(--bg-surface)]/95 backdrop-blur-2xl border-l border-[var(--border-color)] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-[var(--accent-color)]" />
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Search in Book</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="p-3 border-b border-[var(--border-color)]">
        <form onSubmit={handleSearch} className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type word or phrase..."
            autoFocus
            className="w-full pl-8 pr-16 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[var(--accent-color)] text-white text-[11px] font-semibold hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Find'}
          </button>
        </form>
      </div>

      {/* Search Results List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isSearching && results.length === 0 ? (
          <div className="p-8 text-center space-y-2 text-xs text-[var(--text-muted)]">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--accent-color)]" />
            <p>Searching book content...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] px-1">
              Found {results.length} matches
            </p>
            {results.map((res, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onNavigate(res.cfi);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] text-xs transition-all space-y-1 group cursor-pointer"
              >
                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                  <span>Match #{idx + 1}</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--accent-color)]" />
                </div>
                <p className="text-xs text-[var(--text-primary)] line-clamp-3 leading-relaxed">
                  ...{res.excerpt}...
                </p>
              </button>
            ))}
          </div>
        ) : hasSearched ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            No matches found for "{query}".
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            Enter a search term to find occurrences across chapters.
          </div>
        )}
      </div>
    </div>
  );
};
