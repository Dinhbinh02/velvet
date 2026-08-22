import React, { useState, useEffect } from 'react';
import { BookOpen, ArrowRight, Clock } from 'lucide-react';
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
    <div className="h-full p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex flex-col sm:flex-row items-center gap-6 shadow-sm hover:border-[var(--border-hover)] transition-all">
      {/* Book 3D Cover */}
      <div
        onClick={() => onOpen(book.id)}
        className="w-28 sm:w-36 aspect-[2/3] rounded-lg overflow-hidden shrink-0 shadow-md cursor-pointer relative bg-[var(--bg-surface)] border border-[var(--border-color)] hover:scale-105 transition-transform"
      >
        {coverUrl ? (
          <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full p-3 flex flex-col justify-between bg-zinc-800 text-zinc-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">EPUB</span>
            <p className="text-xs font-bold line-clamp-3 leading-snug">{book.title}</p>
            <p className="text-[10px] text-zinc-400 truncate">{book.author}</p>
          </div>
        )}
      </div>

      {/* Info & Action */}
      <div className="flex-1 w-full flex flex-col justify-between h-full space-y-4">
        <div className="space-y-1.5 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-color)] text-[11px] font-semibold">
            <BookOpen className="w-3 h-3" />
            <span>Recently Read</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] line-clamp-2">
            {book.title}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            {book.author}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5 w-full">
          <div className="flex justify-between text-xs font-semibold text-[var(--text-secondary)]">
            <span className="truncate max-w-[240px] text-[var(--text-muted)]">
              {progress?.chapterTitle || 'Reading Progress'}
            </span>
            <span className="text-[var(--accent-color)] font-mono">{percentage}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--border-color)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent-color)] rounded-full transition-all duration-300"
              style={{ width: `${Math.max(percentage, 3)}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <Clock className="w-3.5 h-3.5" />
            <span>{new Date(book.lastReadAt).toLocaleDateString('en-US')}</span>
          </div>

          <button
            onClick={() => onOpen(book.id)}
            className="px-5 py-2 rounded-full bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>Continue Reading</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
