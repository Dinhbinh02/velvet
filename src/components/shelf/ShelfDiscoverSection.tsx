import React from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { CURATED_COLLECTIONS } from '@/src/data/curatedCollections';
import type { IDiscoveryBook } from '@/src/services/discoveryService';

interface ShelfDiscoverSectionProps {
  onExploreMore: () => void;
  onOpenBook?: (bookId: string) => void;
}

export const ShelfDiscoverSection: React.FC<ShelfDiscoverSectionProps> = ({ onExploreMore }) => {
  // Take featured books across collections
  const featuredCollections = CURATED_COLLECTIONS.slice(0, 3);
  const featuredBooks: Array<{ book: IDiscoveryBook; collectionTitle: string }> = [];

  const seen = new Set<string | number>();
  for (const col of featuredCollections) {
    for (const b of col.books.slice(0, 4)) {
      if (!seen.has(b.id)) {
        seen.add(b.id);
        featuredBooks.push({ book: b, collectionTitle: col.title });
      }
    }
  }

  return (
    <section className="space-y-3.5 select-none">
      {/* Section Header (Clean uppercase title matching Reading Now & Library) */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Discover Books
        </h3>

        <button
          onClick={onExploreMore}
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-color)] transition-all cursor-pointer shadow-xs shrink-0"
        >
          <span>Explore more</span>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-color)] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Featured Book Cards Carousel / Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
        {featuredBooks.slice(0, 6).map(({ book, collectionTitle }) => (
          <div
            key={book.id}
            onClick={onExploreMore}
            className="group flex flex-col space-y-2 cursor-pointer transition-all duration-200"
          >
            {/* 2:3 Aspect ratio cover */}
            <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-color)] group-hover:border-[var(--accent-color)] shadow-sm group-hover:shadow-md transition-all duration-200 group-hover:-translate-y-1">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                  <BookOpen className="w-7 h-7 opacity-30 mb-1" />
                  <span className="text-[10px] font-bold line-clamp-3 text-[var(--text-primary)]">
                    {book.title}
                  </span>
                </div>
              )}

              {/* Category Pill Overlay */}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-semibold text-white/90 shadow-xs">
                {collectionTitle.split(' ')[0]}
              </div>
            </div>

            {/* Title & Author */}
            <div className="space-y-0.5 px-0.5">
              <h4 className="font-bold text-xs leading-snug line-clamp-1 text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors">
                {book.title}
              </h4>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {book.author}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
