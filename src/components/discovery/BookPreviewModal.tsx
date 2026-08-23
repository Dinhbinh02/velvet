import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Download,
  UploadCloud,
  Loader2,
  Sparkles,
  Calendar,
  User,
  Tag,
  Globe,
} from 'lucide-react';
import { DiscoveryService, type IDiscoveryBook } from '@/src/services/discoveryService';

interface BookPreviewModalProps {
  book: IDiscoveryBook | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenBook: (bookId: string) => void;
  onImportClick: () => void;
  isAlreadyInLibrary: boolean;
}

export const BookPreviewModal: React.FC<BookPreviewModalProps> = ({
  book,
  isOpen,
  onClose,
  onOpenBook,
  onImportClick,
  isAlreadyInLibrary,
}) => {
  const [description, setDescription] = useState<string>('');
  const [isLoadingDesc, setIsLoadingDesc] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    if (isOpen && book) {
      setIsLoadingDesc(true);
      setDescription('');
      setIsDownloading(false);
      setDownloadStatus('');

      DiscoveryService.getBookDescription(book).then((desc) => {
        if (isMounted) {
          setDescription(desc);
          setIsLoadingDesc(false);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, book]);

  if (!isOpen || !book) return null;

  const canDirectDownload = book.isPublicDomain && Boolean(book.epubUrl);

  const handleAction = async () => {
    if (isAlreadyInLibrary) {
      onClose();
      onOpenBook(String(book.id));
      return;
    }

    if (!canDirectDownload) {
      onClose();
      onImportClick();
      return;
    }

    try {
      setIsDownloading(true);
      const importedBookId = await DiscoveryService.downloadAndImportBook(book, (msg) => {
        setDownloadStatus(msg);
      });
      setIsDownloading(false);
      onClose();
      onOpenBook(importedBookId);
    } catch (err: any) {
      setIsDownloading(false);
      setDownloadStatus('');
      alert(err.message || 'Failed to download book. Please import your local EPUB.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Modal Container */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[var(--bg-primary)]/80 hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-all cursor-pointer shadow-xs"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6 flex-1">
          {/* Top Section: Cover & Key Info */}
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            {/* Book Cover with 3D shadow */}
            <div className="relative w-36 sm:w-44 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-color)] shrink-0 bg-[var(--bg-secondary)]">
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400';
                }}
              />
              {canDirectDownload && (
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-emerald-300 text-[10px] font-bold flex items-center gap-1 shadow-xs">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-300" />
                    <span>Free EPUB</span>
                  </span>
                </div>
              )}
            </div>

            {/* Book Meta & Attributes */}
            <div className="flex flex-col flex-1 text-center sm:text-left min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-color)] mb-1">
                {book.category === 'fiction' ? 'Fiction & Literature' : 'Non-Fiction & Thought'}
              </span>

              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] leading-snug">
                {book.title}
              </h2>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-[var(--text-secondary)] font-medium mt-1.5">
                <User className="w-3.5 h-3.5" />
                <span>{book.author}</span>
              </div>

              {book.publishYear && (
                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-[var(--text-muted)] mt-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>First published: {book.publishYear}</span>
                </div>
              )}

              {/* Source Badge */}
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-[var(--text-muted)] mt-2">
                <Globe className="w-3.5 h-3.5" />
                <span>Source: {book.source}</span>
              </div>

              {/* Subjects / Genre Pills */}
              {book.subjects && book.subjects.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-3.5">
                  {book.subjects.slice(0, 4).map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[11px] font-medium border border-[var(--border-color)] flex items-center gap-1"
                    >
                      <Tag className="w-2.5 h-2.5 opacity-60" />
                      <span>{s}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <hr className="border-[var(--border-color)]" />

          {/* Synopsis / Description Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
              About this book
            </h3>

            {isLoadingDesc ? (
              <div className="space-y-2 py-2 animate-pulse">
                <div className="h-4 bg-[var(--bg-secondary)] rounded-md w-full" />
                <div className="h-4 bg-[var(--bg-secondary)] rounded-md w-5/6" />
                <div className="h-4 bg-[var(--bg-secondary)] rounded-md w-4/6" />
              </div>
            ) : description ? (
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                {description}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-muted)] italic">
                {canDirectDownload
                  ? 'A classic public domain literary work available for instant download and reading in Velvet Reader.'
                  : 'A copyrighted published work. You can import your local EPUB file to read and sync it across all your devices.'}
              </p>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 sm:p-5 bg-[var(--bg-secondary)]/50 border-t border-[var(--border-color)] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl border border-[var(--border-color)] hover:bg-[var(--bg-surface)] text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleAction}
            disabled={isDownloading}
            className={`px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] ${
              isAlreadyInLibrary
                ? 'bg-[var(--accent-color)] text-white'
                : canDirectDownload
                ? 'bg-[var(--accent-color)] text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]'
            } disabled:opacity-50`}
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{downloadStatus || 'Downloading...'}</span>
              </>
            ) : isAlreadyInLibrary ? (
              <>
                <BookOpen className="w-4 h-4" />
                <span>Open in Reader</span>
              </>
            ) : canDirectDownload ? (
              <>
                <Download className="w-4 h-4" />
                <span>Get & Read Free EPUB</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Import EPUB from Device</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
