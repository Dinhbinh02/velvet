import React from 'react';
import { BookOpen, ExternalLink, Library } from 'lucide-react';
import { useBooks } from '@/src/hooks/useBooks';
import { useReaderSettings } from '@/src/hooks/useReaderSettings';
import type { IBook } from '@/src/types/book';

export const PopupApp: React.FC = () => {
  const { books, count } = useBooks();
  const { settings, setTheme } = useReaderSettings();

  const handleOpenFullReader = (bookId?: string) => {
    const url = bookId ? `reader.html?bookId=${bookId}` : 'reader.html';
    chrome.tabs.create({ url: chrome.runtime.getURL(url) });
    window.close();
  };

  return (
    <div
      data-theme={settings.theme}
      className="w-full h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans select-none velvet-transition"
    >
      {/* Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0">
        <div className="flex items-center gap-2">
          <img src="/icons/icon512.png" alt="Velvet" className="w-6 h-6 rounded-md shadow-sm object-cover" />
          <span className="font-bold text-xs text-[var(--text-primary)]">Velvet Books</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)]">
            {count}
          </span>
        </div>

        {/* Theme dots */}
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
        </div>
      </header>

      {/* Book List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {books.length > 0 ? (
          books.map((book: IBook) => (
            <div
              key={book.id}
              onClick={() => handleOpenFullReader(book.id)}
              className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-all flex items-center gap-3 cursor-pointer group"
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
            <p>Library is empty</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <footer className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-surface)] flex gap-2">
        <button
          onClick={() => handleOpenFullReader()}
          className="flex-1 py-2 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open Full Reader</span>
        </button>
      </footer>
    </div>
  );
};
