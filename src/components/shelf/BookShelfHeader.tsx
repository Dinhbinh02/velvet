import React from 'react';
import { Search, ArrowDownUp, Plus } from 'lucide-react';

export type BookStatusFilter = 'all' | 'reading' | 'finished' | 'unread';
export type BookSortOption = 'lastRead' | 'addedAt' | 'title' | 'author';

interface BookShelfHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: BookStatusFilter;
  onStatusChange: (status: BookStatusFilter) => void;
  sortOption: BookSortOption;
  onSortChange: (sort: BookSortOption) => void;
  totalBooks: number;
  onAddBookClick?: () => void;
}

export const BookShelfHeader: React.FC<BookShelfHeaderProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortOption,
  onSortChange,
  onAddBookClick,
}) => {
  const filterOptions: { id: BookStatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'reading', label: 'Reading' },
    { id: 'finished', label: 'Finished' },
    { id: 'unread', label: 'Unread' },
  ];

  return (
    <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 select-none">
      {/* Status Segmented Control */}
      <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] p-0.5 rounded-xl text-xs font-medium self-start">
        {filterOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onStatusChange(opt.id)}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === opt.id
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-semibold border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Search Bar, Sort Dropdown & Add Book Button */}
      <div className="flex items-center gap-2 flex-1 max-w-lg self-end sm:self-auto w-full sm:w-auto">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search in library..."
            className="w-full h-8 pl-8 pr-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
          />
        </div>

        {/* Sort Select */}
        <div className="relative shrink-0">
          <div className="h-8 flex items-center gap-1.5 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] font-medium">
            <ArrowDownUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <select
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value as BookSortOption)}
              className="bg-transparent border-none outline-none text-xs text-[var(--text-primary)] font-medium cursor-pointer pr-1"
            >
              <option value="lastRead">Recent</option>
              <option value="addedAt">Date Added</option>
              <option value="title">Title (A-Z)</option>
              <option value="author">Author (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Quick Add Book Toolbar Button */}
        {onAddBookClick && (
          <button
            onClick={onAddBookClick}
            className="h-8 px-3 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
            title="Add Book (.epub)"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden md:inline">Add Book</span>
          </button>
        )}
      </div>
    </div>
  );
};
