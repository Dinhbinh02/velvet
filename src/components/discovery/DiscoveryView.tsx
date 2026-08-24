import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  BookOpen,
  Download,
  Loader2,
  UploadCloud,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  User,
  Calendar,
  Globe,
  Tag,
} from 'lucide-react';
import { DiscoveryService, type IDiscoveryBook } from '@/src/services/discoveryService';
import { CURATED_COLLECTIONS, type ICuratedCollection } from '@/src/data/curatedCollections';
import { BookPreviewModal } from '@/src/components/discovery/BookPreviewModal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/schema';

interface DiscoveryViewProps {
  onOpenBook: (bookId: string) => void;
  onImportClick: () => void;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({ onOpenBook, onImportClick }) => {
  const [searchInputValue, setSearchInputValue] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<IDiscoveryBook[] | null>(null);

  const [selectedCollection, setSelectedCollection] = useState<ICuratedCollection | null>(null);
  const [downloadingBookId, setDownloadingBookId] = useState<string | number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string>('');

  // Number of books rendered in each carousel (progressive disclosure for 60fps performance)
  const [visibleCountMap, setVisibleCountMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const c of CURATED_COLLECTIONS) {
      initial[c.id] = 16;
    }
    return initial;
  });

  // Preview Modal state
  const [previewBook, setPreviewBook] = useState<IDiscoveryBook | null>(null);

  // AbortController ref to cancel pending search requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check which books are already in user's local library
  const localBooks = useLiveQuery(() => db.books.toArray(), []) || [];
  const localBookTitles = useMemo(() => {
    return new Set(localBooks.map((b) => b.title.toLowerCase().trim()));
  }, [localBooks]);

  // Flatten all 800 curated books for instantaneous 0ms search
  const allCuratedBooks = useMemo(() => {
    const list: IDiscoveryBook[] = [];
    const seen = new Set<string | number>();
    for (const col of CURATED_COLLECTIONS) {
      for (const b of col.books) {
        if (!seen.has(b.id)) {
          seen.add(b.id);
          list.push(b);
        }
      }
    }
    return list;
  }, []);

  // Spotlight Book (Hero of the day)
  const heroBook = allCuratedBooks[0] || null;

  // Reveal next batch of books when scrolling horizontally
  const handleRevealMore = useCallback((colId: string) => {
    setVisibleCountMap((prev) => {
      const current = prev[colId] || 16;
      if (current >= 100) return prev;
      return { ...prev, [colId]: Math.min(100, current + 16) };
    });
  }, []);

  // Execute search ONLY when user presses Enter (or submits form)
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchInputValue.trim();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!query) {
      setSubmittedQuery('');
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setSubmittedQuery(query);
    setIsSearching(true);

    // 1. Instant local search across all 800 curated books (0ms response)
    const q = query.toLowerCase();
    const localMatches = allCuratedBooks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.subjects.some((s) => s.toLowerCase().includes(q))
    );

    if (localMatches.length > 0) {
      setSearchResults(localMatches);
    } else {
      setSearchResults(null);
    }

    // 2. Query Open Library in background for broader external catalog
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const results = await DiscoveryService.searchBooks(query, controller.signal);
      const seenIds = new Set(localMatches.map((b) => b.id));
      setSearchResults([...localMatches, ...results.filter((b) => !seenIds.has(b.id))]);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Search failed:', err);
        setSearchResults(localMatches);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSearchInputValue('');
    setSubmittedQuery('');
    setSearchResults(null);
    setIsSearching(false);
  };

  // 1-Click Get / Read Handler
  const handleGetBook = async (book: IDiscoveryBook, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const existing = localBooks.find(
      (b) => b.title.toLowerCase().trim() === book.title.toLowerCase().trim()
    );
    if (existing) {
      onOpenBook(existing.id);
      return;
    }

    if (!book.epubUrl || !book.isPublicDomain) {
      setPreviewBook(book);
      return;
    }

    try {
      setDownloadingBookId(book.id);
      const importedBookId = await DiscoveryService.downloadAndImportBook(book, (msg) => {
        setDownloadStatus(msg);
      });
      setDownloadingBookId(null);
      setDownloadStatus('');
      onOpenBook(importedBookId);
    } catch (err: any) {
      setDownloadingBookId(null);
      setDownloadStatus('');
      alert(err.message || 'Failed to download book. Please try importing your local EPUB.');
    }
  };

  // Scroll horizontal container helper
  const scrollContainer = (containerId: string, direction: 'left' | 'right', colId?: string) => {
    const el = document.getElementById(containerId);
    if (el) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      if (direction === 'right' && colId) {
        handleRevealMore(colId);
      }
    }
  };

  return (
    <main className="flex-1 overflow-y-auto w-full bg-[var(--bg-primary)] select-none">
      <div className="w-full max-w-[1600px] mx-auto px-2.5 xs:px-3.5 sm:px-8 lg:px-14 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Top Header Area (Apple Books Style) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-[var(--accent-color)] uppercase tracking-wider mb-1 block">
              The Great Library
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Discover Books
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-xl leading-relaxed">
              Explore timeless stories, profound philosophies, and ideas that shaped civilizations.
            </p>
          </div>

          {/* Search Box Form */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80 md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search titles, authors, or literary themes..."
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] shadow-xs focus:outline-none focus:border-[var(--accent-color)] transition-all"
            />
            {isSearching ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-3.5 h-3.5 text-[var(--accent-color)] animate-spin" />
              </div>
            ) : searchInputValue ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </form>
        </div>

        {/* Collection Filter Breadcrumb (if "See All" is active) */}
        {selectedCollection && !submittedQuery && (
          <div className="flex items-center justify-between p-2 sm:p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                onClick={() => setSelectedCollection(null)}
                className="h-8 px-2.5 sm:px-3 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                <span className="hidden xs:inline">All Collections</span>
                <span className="xs:hidden">All</span>
              </button>
              <div className="w-px h-4 bg-[var(--border-color)] shrink-0" />
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                  {selectedCollection.title}
                </span>
                <span className="text-[10px] sm:text-xs text-[var(--text-muted)] font-normal shrink-0 whitespace-nowrap">
                  ({selectedCollection.books.length} books)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 1: SEARCH RESULTS */}
        {submittedQuery ? (
          <div className="space-y-6 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Search results for "{submittedQuery}" ({searchResults?.length || 0} books)
              </h3>
              <button
                onClick={clearSearch}
                className="text-xs font-semibold text-[var(--accent-color)] hover:underline cursor-pointer"
              >
                Back to Curated Collections
              </button>
            </div>

            {isSearching && (!searchResults || searchResults.length === 0) ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 sm:gap-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-3 animate-pulse">
                    <div className="w-full aspect-[2/3] rounded-2xl bg-[var(--bg-secondary)]" />
                    <div className="h-4 bg-[var(--bg-secondary)] rounded-md w-3/4" />
                    <div className="h-3 bg-[var(--bg-secondary)] rounded-md w-1/2" />
                  </div>
                ))}
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 sm:gap-6">
                {searchResults.map((book) => renderBookCard(book))}
              </div>
            ) : (
              <div className="w-full py-16 sm:py-24 flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] flex items-center justify-center shadow-md mb-4">
                  <Search className="w-8 h-8 opacity-40" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                  No books found
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mt-1 mb-6">
                  We couldn't find "{submittedQuery}". You can import your own EPUB file to read right now.
                </p>
                <button
                  onClick={onImportClick}
                  className="px-6 py-3 rounded-2xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs sm:text-sm font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02]"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Import EPUB from Device</span>
                </button>
              </div>
            )}
          </div>
        ) : selectedCollection ? (
          /* VIEW 2: SEE ALL 100 BOOKS IN A SINGLE COLLECTION */
          <div className="space-y-6 pt-2">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                {selectedCollection.title}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                {selectedCollection.description} • Complete 100 Titles Collection
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 sm:gap-6">
              {selectedCollection.books.map((book) => renderBookCard(book))}
            </div>
          </div>
        ) : (
          /* VIEW 3: HOMEPAGE OF CURATED COLLECTIONS (APPLE BOOKS STYLE) */
          <>
            {/* Spotlight Hero Banner */}
            {heroBook && (
              <div
                onClick={() => setPreviewBook(heroBook)}
                className="group relative w-full rounded-3xl overflow-hidden bg-gradient-to-r from-[var(--bg-surface)] to-[var(--bg-secondary)] border border-[var(--border-color)] p-6 sm:p-8 md:p-10 shadow-lg flex flex-col md:flex-row items-center gap-6 sm:gap-8 cursor-pointer hover:border-[var(--accent-color)] transition-all duration-300"
              >
                <div className="relative w-32 sm:w-40 md:w-48 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-[var(--border-color)] bg-[var(--bg-secondary)] group-hover:scale-105 transition-transform duration-500">
                  <img
                    src={heroBook.coverUrl}
                    alt={heroBook.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-amber-300 text-[10px] font-bold tracking-wider uppercase shadow-xs">
                      Spotlight
                    </span>
                  </div>
                </div>

                <div className="flex flex-col flex-1 text-center md:text-left min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-color)] mb-1">
                    Featured Masterpiece
                  </span>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight">
                    {heroBook.title}
                  </h2>

                  {/* Spotlight Author, Published Date & Source Metadata */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-center md:justify-start gap-2 sm:gap-4 text-xs text-[var(--text-secondary)] mt-2">
                    <div className="flex items-center justify-center md:justify-start gap-1.5 font-medium">
                      <User className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                      <span>{heroBook.author}</span>
                    </div>

                    {heroBook.publishYear && (
                      <div className="flex items-center justify-center md:justify-start gap-1.5 text-[var(--text-muted)]">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>First published: {heroBook.publishYear > 0 ? heroBook.publishYear : `${Math.abs(heroBook.publishYear)} BC`}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-center md:justify-start gap-1.5 text-[var(--text-muted)]">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Source: {heroBook.source}</span>
                    </div>
                  </div>

                  {/* Subject Pills */}
                  {heroBook.subjects && heroBook.subjects.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-3">
                      {heroBook.subjects.slice(0, 4).map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-xl bg-[var(--bg-surface)] text-[var(--text-secondary)] text-[11px] font-medium border border-[var(--border-color)] flex items-center gap-1 shadow-xs"
                        >
                          <Tag className="w-2.5 h-2.5 opacity-60" />
                          <span>{s}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-3 mt-3 leading-relaxed max-w-2xl">
                    {heroBook.description || 'A timeless literary classic available for instant reading.'}
                  </p>

                  <div className="flex items-center justify-center md:justify-start gap-3 mt-6">
                    <button
                      onClick={(e) => handleGetBook(heroBook, e)}
                      className="px-6 py-2.5 rounded-2xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02]"
                    >
                      <Download className="w-4 h-4" />
                      <span>Get & Read Now</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Render Each Curated Collection Carousel */}
            {CURATED_COLLECTIONS.map((col) => {
              const carouselId = `carousel-${col.id}`;
              const visibleLimit = visibleCountMap[col.id] || 16;
              const displayedBooks = col.books.slice(0, visibleLimit);

              return (
                <section key={col.id} className="space-y-4">
                  {/* Collection Header (Exact Matching Button Heights) */}
                  <div className="flex items-start sm:items-end justify-between gap-2">
                    <div className="min-w-0 flex-1 pr-1">
                      <h3 className="text-lg sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] leading-tight">
                        {col.title}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1 sm:line-clamp-none">
                        {col.subtitle}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {/* Left / Right Chevron scroll controls */}
                      <button
                        onClick={() => scrollContainer(carouselId, 'left')}
                        className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer hidden sm:flex items-center justify-center shadow-xs shrink-0"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => scrollContainer(carouselId, 'right', col.id)}
                        className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer hidden sm:flex items-center justify-center shadow-xs shrink-0"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* See All Button matching exact h-8 height */}
                      <button
                        onClick={() => setSelectedCollection(col)}
                        className="h-8 px-2.5 sm:px-3 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center gap-1 shadow-xs shrink-0 whitespace-nowrap"
                      >
                        <span>See All</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scrolling Carousel with Progressive Reveal on Scroll */}
                  <div
                    id={carouselId}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 350) {
                        handleRevealMore(col.id);
                      }
                    }}
                    className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 scroll-smooth snap-x no-scrollbar"
                  >
                    {displayedBooks.map((book) => (
                      <div
                        key={book.id}
                        className="w-40 sm:w-48 shrink-0 snap-start flex flex-col"
                      >
                        {renderBookCard(book)}
                      </div>
                    ))}

                    {/* Reveal More Card Indicator at end of carousel */}
                    {visibleLimit < col.books.length && (
                      <div
                        onClick={() => handleRevealMore(col.id)}
                        className="w-36 sm:w-40 shrink-0 snap-start flex flex-col items-center justify-center bg-[var(--bg-surface)] border border-dashed border-[var(--border-color)] hover:border-[var(--accent-color)] rounded-3xl p-4 text-center cursor-pointer transition-all hover:scale-[1.02]"
                      >
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Scroll for More
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] mt-1">
                          {col.books.length - visibleLimit} more books
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </>
        )}

        {/* Footer: Legal & Source Attribution Disclaimer */}
        <div className="pt-4 border-t border-[var(--border-color)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <div className="space-y-1">
            <p className="font-semibold text-[var(--text-secondary)]">
              Public Domain & Open Catalog Attribution
            </p>
            <p className="max-w-2xl leading-relaxed text-[11px]">
              Ebook files and literary texts are distributed under open public domain terms courtesy of <strong>Project Gutenberg</strong>, <strong>Internet Archive</strong>, and <strong>Standard Ebooks</strong>. Metadata, synopsis, and cover catalogs are indexed via <strong>Open Library</strong>. Velvet Reader is an independent open reading client and does not claim ownership or host copyrighted content.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-[11px]">
            <a
              href="https://www.gutenberg.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent-color)] underline transition-colors"
            >
              Project Gutenberg
            </a>
            <span>•</span>
            <a
              href="https://openlibrary.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent-color)] underline transition-colors"
            >
              Open Library
            </a>
            <span>•</span>
            <a
              href="https://archive.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent-color)] underline transition-colors"
            >
              Internet Archive
            </a>
          </div>
        </div>
      </div>

      {/* Book Preview Details Modal */}
      {previewBook && (
        <BookPreviewModal
          book={previewBook}
          isOpen={Boolean(previewBook)}
          onClose={() => setPreviewBook(null)}
          onOpenBook={onOpenBook}
          onImportClick={onImportClick}
          isAlreadyInLibrary={localBookTitles.has(previewBook.title.toLowerCase().trim())}
        />
      )}
    </main>
  );

  // Book Card Render Helper
  function renderBookCard(book: IDiscoveryBook) {
    const isAlreadyInLibrary = localBookTitles.has(book.title.toLowerCase().trim());
    const isDownloadingThis = downloadingBookId === book.id;
    const canDirectDownload = book.isPublicDomain && Boolean(book.epubUrl);

    return (
      <div
        key={book.id}
        onClick={() => setPreviewBook(book)}
        className="group flex flex-col justify-between bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--accent-color)] rounded-3xl p-3 sm:p-3.5 shadow-xs hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer h-full"
      >
        {/* Cover Container */}
        <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden bg-[var(--bg-secondary)] shadow-inner mb-3">
          <img
            src={book.coverUrl}
            alt={book.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400';
            }}
          />

          {canDirectDownload && (
            <div className="absolute top-2 left-2 pointer-events-none">
              <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-emerald-300 text-[10px] font-bold flex items-center gap-1 shadow-xs">
                <span>Free</span>
              </span>
            </div>
          )}
        </div>

        {/* Book Info */}
        <div className="flex flex-col flex-1 min-w-0 mb-3">
          <h4
            className="font-bold text-xs sm:text-sm text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--accent-color)] transition-colors"
            title={book.title}
          >
            {book.title}
          </h4>
          <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] truncate mt-1">
            {book.author}
          </p>

          {book.publishYear && (
            <span className="text-[10px] text-[var(--text-muted)] truncate mt-1">
              {book.publishYear > 0 ? book.publishYear : `${Math.abs(book.publishYear)} BC`}
            </span>
          )}
        </div>

        {/* Action Button: Get vs Read vs Details */}
        <button
          onClick={(e) => handleGetBook(book, e)}
          disabled={isDownloadingThis}
          className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
            isAlreadyInLibrary
              ? 'bg-[var(--bg-secondary)] hover:bg-[var(--accent-subtle)] text-[var(--accent-color)] border border-[var(--border-color)]'
              : canDirectDownload
              ? 'bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white'
              : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
          } disabled:opacity-50`}
        >
          {isDownloadingThis ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="truncate">{downloadStatus || 'Downloading...'}</span>
            </>
          ) : isAlreadyInLibrary ? (
            <>
              <BookOpen className="w-3.5 h-3.5" />
              <span>Read</span>
            </>
          ) : canDirectDownload ? (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Get</span>
            </>
          ) : (
            <span>Details</span>
          )}
        </button>
      </div>
    );
  }
};
