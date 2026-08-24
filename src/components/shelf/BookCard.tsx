import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, Trash2, BookOpen, CheckCircle, Clock, Cloud, Loader2 } from 'lucide-react';
import type { IBook } from '@/src/types/book';
import { useBookProgress } from '@/src/hooks/useBooks';

interface BookCardProps {
  book: IBook;
  onOpen: (bookId: string) => void;
  onDelete: (bookId: string) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onOpen, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const progress = useBookProgress(book.id);
  const percentage = progress ? Math.round(progress.percentage * 100) : 0;

  // Check if book EPUB file is already stored in local browser OPFS
  useEffect(() => {
    let active = true;
    const checkFile = async () => {
      try {
        const { OPFSStorageService } = await import('@/src/services/opfsStorage');
        await OPFSStorageService.getBookFile(book.id);
        if (active) setIsDownloaded(true);
      } catch {
        if (active) setIsDownloaded(false);
      }
    };
    checkFile();
    return () => {
      active = false;
    };
  }, [book.id]);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showMenu && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Menu height is ~85px, flip upward if less than 110px available below
      setOpenUpward(spaceBelow < 110);
    }
    setShowMenu(!showMenu);
  };

  const handleOpenClick = async () => {
    if (isDownloading) return;

    if (!isDownloaded) {
      setIsDownloading(true);
      try {
        const { BookService } = await import('@/src/services/bookService');
        const file = await BookService.getBookFile(book.id);
        if (file) {
          setIsDownloaded(true);
          onOpen(book.id);
        }
      } catch (err) {
        console.warn('Could not download book:', err);
        alert('Downloading book from Cloud Storage... Please check your internet connection.');
      } finally {
        setIsDownloading(false);
      }
      return;
    }

    onOpen(book.id);
  };

  const [extractedCoverUrl, setExtractedCoverUrl] = useState<string | null>(null);

  // Directly load cover from book.coverImage Blob OR extract on-demand from local OPFS EPUB file
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    const rawCover: any = book.coverImage;
    if (typeof rawCover === 'string' && (rawCover.startsWith('data:') || rawCover.startsWith('http') || rawCover.startsWith('blob:'))) {
      setExtractedCoverUrl(rawCover);
      return;
    }

    if (book.coverImage && book.coverImage instanceof Blob) {
      try {
        createdUrl = URL.createObjectURL(book.coverImage);
        setExtractedCoverUrl(createdUrl);
      } catch {
        setExtractedCoverUrl(null);
      }
      return () => {
        if (createdUrl) URL.revokeObjectURL(createdUrl);
      };
    }

    // If coverImage is not in IndexedDB, extract directly from OPFS file
    const loadFromOPFS = async () => {
      try {
        const { OPFSStorageService } = await import('@/src/services/opfsStorage');
        const { EPUBParserService } = await import('@/src/services/epubParser');
        const file = await OPFSStorageService.getBookFile(book.id);
        const meta = await EPUBParserService.parseMetadata(file);
        if (active && meta.coverImage) {
          createdUrl = URL.createObjectURL(meta.coverImage);
          setExtractedCoverUrl(createdUrl);
          // Also persist back to Dexie for fast future renders
          import('@/src/db/schema').then(({ db }) => {
            db.books.update(book.id, { coverImage: meta.coverImage });
          });
        }
      } catch {
        if (active) setExtractedCoverUrl(null);
      }
    };

    loadFromOPFS();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [book.id, book.coverImage]);

  const coverUrl = extractedCoverUrl;

  return (
    <div className="flex flex-col space-y-2.5 group relative select-none">
      {/* Book Cover */}
      <div
        onClick={handleOpenClick}
        className="relative aspect-[2/3] w-full rounded-xl overflow-hidden cursor-pointer bg-[var(--bg-secondary)] border border-[var(--border-color)] group-hover:border-[var(--border-hover)] shadow-sm group-hover:shadow-md transition-all duration-200 group-hover:-translate-y-1"
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={book.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full p-4 flex flex-col justify-between bg-zinc-800 text-zinc-100">
            <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">EPUB</span>
            <p className="text-xs font-bold leading-snug line-clamp-4 text-zinc-100">
              {book.title}
            </p>
            <p className="text-[10px] text-zinc-400 truncate">{book.author}</p>
          </div>
        )}

        {/* Cloud Sync Status Badge */}
        {!isDownloaded && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-semibold text-amber-300 flex items-center gap-1 shadow-xs border border-amber-400/20">
            {isDownloading ? (
              <>
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Cloud className="w-2.5 h-2.5" />
                <span>Cloud</span>
              </>
            )}
          </div>
        )}

        {/* Progress Overlay Tag */}
        {percentage > 0 && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white">
            {percentage}%
          </div>
        )}

        {/* Hover Read Action Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
          <span className="px-4 py-1.5 rounded-full bg-[var(--accent-color)] text-white text-xs font-semibold shadow-md flex items-center gap-1.5">
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <BookOpen className="w-3.5 h-3.5" />
                <span>{!isDownloaded ? 'Download & Read' : 'Read'}</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Book Metadata Below Cover */}
      <div className="space-y-0.5">
        <div className="flex items-start justify-between gap-1">
          <h4
            onClick={handleOpenClick}
            className="text-xs font-bold text-[var(--text-primary)] line-clamp-1 leading-snug cursor-pointer group-hover:text-[var(--accent-color)] transition-colors"
            title={book.title}
          >
            {book.title}
          </h4>

          {/* Context Menu Button */}
          <div className="relative">
            <button
              ref={menuBtnRef}
              onClick={handleToggleMenu}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div
                  className={`absolute right-0 w-36 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs ${
                    openUpward ? 'bottom-full mb-1.5' : 'top-6'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onOpen(book.id);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                    <span>Open Book</span>
                  </button>
                  <div className="my-1 border-t border-[var(--border-color)]" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      if (confirm(`Remove "${book.title}" from library?`)) {
                        onDelete(book.id);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-red-500/10 text-red-500 flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-[11px] text-[var(--text-secondary)] truncate">
          {book.author}
        </p>

        {/* Status / Last Read */}
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] pt-0.5">
          {book.isFinished ? (
            <span className="flex items-center gap-1 text-emerald-500 font-medium">
              <CheckCircle className="w-3 h-3" />
              <span>Finished</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{new Date(book.lastReadAt).toLocaleDateString('en-US')}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
