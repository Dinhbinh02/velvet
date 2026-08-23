import React, { useState, useEffect } from 'react';
import { BookOpen, ArrowRight } from 'lucide-react';
import type { IBook } from '@/src/types/book';
import { useBookProgress } from '@/src/hooks/useBooks';

interface ReadingNowCardProps {
  book: IBook;
  onOpen: (bookId: string) => void;
}

export const ReadingNowCard: React.FC<ReadingNowCardProps> = ({ book, onOpen }) => {
  const progress = useBookProgress(book.id);
  const percentage = progress ? Math.round(progress.percentage * 100) : 0;

  const [extractedCoverUrl, setExtractedCoverUrl] = useState<string | null>(null);

  // Directly load cover from book.coverImage Blob OR extract on-demand from local OPFS EPUB file
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

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
          // Also persist back to Dexie
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
    <div className="h-full p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex flex-row items-center gap-3.5 sm:gap-6 shadow-sm hover:border-[var(--border-hover)] transition-all">
      {/* Book 3D Cover */}
      <div
        onClick={() => onOpen(book.id)}
        className="w-20 sm:w-36 aspect-[2/3] rounded-lg overflow-hidden shrink-0 shadow-md cursor-pointer relative bg-[var(--bg-surface)] border border-[var(--border-color)] hover:scale-105 transition-transform"
      >
        {coverUrl ? (
          <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full p-2 sm:p-3 flex flex-col justify-between bg-zinc-800 text-zinc-100">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-400">EPUB</span>
            <p className="text-[11px] sm:text-xs font-bold line-clamp-3 leading-snug">{book.title}</p>
            <p className="text-[9px] sm:text-[10px] text-zinc-400 truncate">{book.author}</p>
          </div>
        )}
      </div>

      {/* Info & Action */}
      <div className="flex-1 w-full flex flex-col justify-between h-full space-y-2.5 sm:space-y-4 min-w-0">
        <div className="space-y-1 text-left">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-color)] text-[10px] sm:text-[11px] font-semibold">
            <BookOpen className="w-3 h-3" />
            <span>Recently Read</span>
          </div>
          <h2 className="text-sm sm:text-xl font-bold tracking-tight text-[var(--text-primary)] line-clamp-1 sm:line-clamp-2 leading-tight">
            {book.title}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium truncate">
            {book.author}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1 sm:space-y-1.5 w-full">
          <div className="flex justify-between text-[11px] sm:text-xs font-semibold text-[var(--text-secondary)]">
            <span className="truncate max-w-[140px] sm:max-w-[240px] text-[var(--text-muted)]">
              {progress?.chapterTitle || 'Reading Progress'}
            </span>
            <span className="text-[var(--accent-color)] font-mono">{percentage}%</span>
          </div>
          <div className="w-full h-1.5 sm:h-2 rounded-full bg-[var(--border-color)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent-color)] rounded-full transition-all duration-300"
              style={{ width: `${Math.max(percentage, 3)}%` }}
            />
          </div>
        </div>

        {/* Continue Button */}
        <div className="pt-0.5">
          <button
            onClick={() => onOpen(book.id)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-[var(--accent-color)] text-[var(--bg-primary)] text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            <span>Continue Reading</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
