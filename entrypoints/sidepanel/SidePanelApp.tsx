import React, { useState } from 'react';
import { BookOpen, ExternalLink, Library, Search } from 'lucide-react';
import { useBooks } from '@/src/hooks/useBooks';
import { useReaderSettings } from '@/src/hooks/useReaderSettings';
import { FoliateViewer } from '@/src/components/reader/FoliateViewer';
import type { IBook } from '@/src/types/book';

export const SidePanelApp: React.FC = () => {
  const { books } = useBooks();
  const { settings, setTheme } = useReaderSettings();
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenFullTab = () => {
    const url = activeBookId ? `reader.html?bookId=${activeBookId}` : 'reader.html';
    chrome.tabs.create({ url: chrome.runtime.getURL(url) });
  };

  const filteredBooks = books.filter(
    (b: IBook) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      data-theme={settings.theme}
      className="w-full h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans select-none velvet-transition"
    >
      {/* Top Header */}
      <header className="h-12 px-3 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0">
        <div className="flex items-center gap-2">
          {activeBookId ? (
            <button
              onClick={() => setActiveBookId(null)}
              className="text-xs font-semibold text-[var(--accent-color)] hover:underline cursor-pointer"
            >
              ← Library
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <img src="/icons/icon512.png" alt="Velvet" className="w-5 h-5 rounded shadow-sm object-cover" />
              <span className="font-bold text-xs text-[var(--text-primary)]">Side Panel</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {(['light', 'sepia', 'dark', 'amoled'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`w-3.5 h-3.5 rounded-full border border-[var(--border-color)] cursor-pointer ${
                settings.theme === t ? 'ring-2 ring-[var(--accent-color)]' : ''
              }`}
              style={{
                backgroundColor:
                  t === 'light'
                    ? '#FBFBFD'
                    : t === 'sepia'
                    ? '#F7EFE1'
                    : t === 'dark'
                    ? '#1C1C1E'
                    : '#000000',
              }}
              title={t}
            />
          ))}

          <button
            onClick={handleOpenFullTab}
            className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all ml-1 cursor-pointer"
            title="Open in Full Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      {activeBookId ? (
        <div className="flex-1 flex flex-col relative bg-[var(--reader-bg)] text-[var(--reader-text)] overflow-hidden">
          <FoliateViewer bookId={activeBookId} theme={settings.theme} settings={settings} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search books..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
            />
          </div>

          {/* Book Shelf List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredBooks.length > 0 ? (
              filteredBooks.map((book: IBook) => (
                <div
                  key={book.id}
                  onClick={() => setActiveBookId(book.id)}
                  className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-all flex items-center gap-3 cursor-pointer group"
                >
                  <div className="w-10 aspect-[2/3] rounded bg-zinc-800 shrink-0 overflow-hidden flex items-center justify-center text-zinc-400 font-bold text-[9px]">
                    EPUB
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-color)] transition-colors">
                      {book.title}
                    </h4>
                    <p className="text-[10px] text-[var(--text-secondary)] truncate">{book.author}</p>
                  </div>
                  <BookOpen className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                </div>
              ))
            ) : (
              <div className="p-8 text-center space-y-2 text-xs text-[var(--text-muted)]">
                <Library className="w-8 h-8 mx-auto opacity-40 text-[var(--text-muted)]" />
                <p>No books in library</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
