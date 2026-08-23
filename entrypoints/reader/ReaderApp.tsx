import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  List,
  Search,
  Maximize2,
  Minimize2,
  Headphones,
  Settings,
  UploadCloud,
  BookPlus,
  Waves,
} from 'lucide-react';
import { useBooks, useBookDetails } from '@/src/hooks/useBooks';
import { useReaderSettings } from '@/src/hooks/useReaderSettings';
import { BookCard } from '@/src/components/shelf/BookCard';
import { AddBookCard } from '@/src/components/shelf/AddBookCard';
import { ReadingNowCard } from '@/src/components/shelf/ReadingNowCard';
import { ShelfHeroBanner } from '@/src/components/shelf/ShelfHeroBanner';
import { BookShelfHeader, type BookStatusFilter, type BookSortOption } from '@/src/components/shelf/BookShelfHeader';
import { AmbientSoundModal } from '@/src/components/shelf/AmbientSoundModal';
import { AmbientSoundService } from '@/src/services/ambientSoundService';
import { FoliateViewer } from '@/src/components/reader/FoliateViewer';
import { TypographyDrawer } from '@/src/components/settings/TypographyDrawer';
import { NavigationDrawer } from '@/src/components/sidebar/NavigationDrawer';
import { SearchDrawer } from '@/src/components/search/SearchDrawer';
import { TTSPlayerBar } from '@/src/components/tts/TTSPlayerBar';
import { WordDefinitionModal } from '@/src/components/reader/WordDefinitionModal';
import { GeminiAIService, type IWordExplanation } from '@/src/services/geminiAIService';
import { TTSService } from '@/src/services/ttsService';
import { BookService } from '@/src/services/bookService';
import { ExportService } from '@/src/services/exportService';
import { CloudSyncModal } from '@/src/components/sync/CloudSyncModal';
import { GoogleAuthService, type IGoogleUserInfo } from '@/src/services/googleAuthService';
import { GoogleDriveSyncService } from '@/src/services/googleDriveSyncService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/schema';
import type { IBook } from '@/src/types/book';

export const ReaderApp: React.FC = () => {
  const { books, count } = useBooks();
  const { settings, updateSettings } = useReaderSettings();
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const activeBook = useBookDetails(activeBookId);
  const [viewMode, setViewMode] = useState<'shelf' | 'reader'>('shelf');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTargetSection, setSettingsTargetSection] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [ambientModalOpen, setAmbientModalOpen] = useState(false);
  const [ambientState, setAmbientState] = useState(() => AmbientSoundService.getState());
  const [googleUser, setGoogleUser] = useState<IGoogleUserInfo | null>(null);
  const [ttsOpen, setTtsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    return AmbientSoundService.subscribe(() => {
      setAmbientState(AmbientSoundService.getState());
    });
  }, []);

  // Shelf Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookStatusFilter>('all');
  const [sortOption, setSortOption] = useState<BookSortOption>('lastRead');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Global Full-Screen Drag & Drop State
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounter = React.useRef(0);

  const processImportFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.epub')) {
      alert('Please provide a valid .epub book file.');
      return;
    }
    try {
      const bookId = await BookService.importBook(file);
      handleOpenBook(bookId);
    } catch (err: any) {
      console.error('Failed to import EPUB:', err);
      alert(err.message || 'Failed to import EPUB.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImportFile(file);
    }
  };

  const handleGlobalDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsGlobalDragging(true);
    }
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsGlobalDragging(false);
    }
  };

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsGlobalDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImportFile(e.dataTransfer.files[0]);
    }
  };

  const [currentLocation, setCurrentLocation] = useState<{
    cfi: string;
    percentage: number;
    chapterTitle?: string;
    sectionIndex: number;
  }>({
    cfi: '',
    percentage: 0,
    sectionIndex: 0,
  });
  const [tocList, setTocList] = useState<any[]>([]);
  
  // Gemini AI Word Lookup State
  const [wordExplanation, setWordExplanation] = useState<IWordExplanation | null>(null);
  const [isLookingUpWord, setIsLookingUpWord] = useState(false);
  const [wordLookupError, setWordLookupError] = useState<string | null>(null);

  const handleWordClick = async (word: string, contextSection: string) => {
    setIsLookingUpWord(true);
    setWordLookupError(null);
    setWordExplanation(null);

    try {
      const result = await GeminiAIService.explainWord(
        word,
        contextSection,
        activeBook?.title || '',
        settings.geminiApiKey
      );
      setWordExplanation(result);
    } catch (err: any) {
      console.warn('Gemini word lookup failed:', err);
      setWordLookupError(err?.message || 'Failed to explain word.');
    } finally {
      setIsLookingUpWord(false);
    }
  };

  const handleCloseWordModal = React.useCallback(() => {
    setWordExplanation(null);
    setWordLookupError(null);
  }, []);

  const handleOpenGeminiSettings = React.useCallback(() => {
    setSettingsTargetSection('gemini');
    setSettingsOpen(true);
  }, []);

  // Query notes for active book
  const activeNotes = useLiveQuery(
    () => (activeBookId ? db.notes.where('bookId').equals(activeBookId).reverse().sortBy('createdAt') : []),
    [activeBookId]
  ) || [];

  // Query comments for active book
  const activeComments = useLiveQuery(
    () => (activeBookId ? db.comments.where('bookId').equals(activeBookId).reverse().sortBy('createdAt') : []),
    [activeBookId]
  ) || [];

  // Query highlights for active book
  const activeHighlights = useLiveQuery(
    () => (activeBookId ? db.highlights.where('bookId').equals(activeBookId).reverse().sortBy('createdAt') : []),
    [activeBookId]
  ) || [];

  // Query custom fonts and inject global @font-face style into document head
  const customFonts = useLiveQuery(() => db.customFonts.toArray(), []) || [];
  useEffect(() => {
    let styleTag = document.getElementById('velvet-custom-fonts-style') as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'velvet-custom-fonts-style';
      document.head.appendChild(styleTag);
    }

    if (customFonts.length > 0) {
      styleTag.textContent = customFonts
        .map((f) => {
          const formatStr = f.format === 'ttf' ? 'truetype' : f.format === 'otf' ? 'opentype' : f.format;
          const lower = f.fileName.toLowerCase();
          const isItalic = lower.includes('italic');
          const isBold = lower.includes('bold');
          const isLight = lower.includes('light');
          const weight = isBold ? '700' : isLight ? '300' : '400';
          const style = isItalic ? 'italic' : 'normal';

          return `
            @font-face {
              font-family: '${f.name}';
              src: url('${f.fontData}') format('${formatStr}');
              font-weight: ${weight};
              font-style: ${style};
              font-display: swap;
            }
          `;
        })
        .join('\n');
    } else {
      styleTag.textContent = '';
    }
  }, [customFonts]);

  // Load cached Google user and trigger initial silent auto-sync on mount
  useEffect(() => {
    GoogleAuthService.getCurrentUser().then((u) => {
      setGoogleUser(u);
      if (u) {
        // Trigger silent initial sync (pull/backup) when tab is opened
        GoogleDriveSyncService.runSilentAutoSync();
      }
    });

    // Periodic 10-minute auto-sync while this Velvet tab is active/open
    const syncInterval = setInterval(() => {
      GoogleDriveSyncService.runSilentAutoSync();
    }, 10 * 60 * 1000);

    return () => clearInterval(syncInterval);
  }, []);

  // Auto-restore sidebar when screen width expands back to desktop view (>= 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check URL params for bookId & listen to popstate
  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search);
      const bookIdParam = params.get('bookId');
      if (bookIdParam) {
        setActiveBookId(bookIdParam);
        setViewMode('reader');
        setSidebarOpen(true);
      } else {
        setActiveBookId(null);
        setViewMode('shelf');
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const handleOpenBook = (bookId: string) => {
    setActiveBookId(bookId);
    setViewMode('reader');
    setSidebarOpen(true);
    // Update browser URL to include ?bookId=...
    const url = new URL(window.location.href);
    url.searchParams.set('bookId', bookId);
    window.history.pushState({}, '', url.toString());
  };

  const handleBackToShelf = () => {
    setActiveBookId(null);
    setViewMode('shelf');
    // Remove ?bookId from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('bookId');
    window.history.pushState({}, '', url.toString());
    // Trigger auto sync when finishing a reading session
    GoogleDriveSyncService.triggerAutoSync(2000);
  };

  const handleDeleteBook = async (bookId: string) => {
    await BookService.deleteBookCompletely(bookId);
    if (activeBookId === bookId) {
      handleBackToShelf();
    }
  };

  const handleExportMarkdown = () => {
    if (!activeBook) return;
    ExportService.downloadMarkdownFile(activeBook, activeNotes, activeComments, activeHighlights);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Find most recently read book for "Reading Now" (only if actually read)
  const recentBook = books.find((b: IBook) => b.lastReadAt > b.addedAt && !b.isFinished) || null;

  // Filter and Sort Books
  const filteredAndSortedBooks = books
    .filter((b: IBook) => {
      const matchesSearch =
        !searchQuery ||
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.author.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesStatus = true;
      if (statusFilter === 'finished') matchesStatus = b.isFinished;
      else if (statusFilter === 'reading') matchesStatus = !b.isFinished && b.lastReadAt > b.addedAt;
      else if (statusFilter === 'unread') matchesStatus = !b.isFinished && b.lastReadAt <= b.addedAt;

      return matchesSearch && matchesStatus;
    })
    .sort((a: IBook, b: IBook) => {
      if (sortOption === 'lastRead') return b.lastReadAt - a.lastReadAt;
      if (sortOption === 'addedAt') return b.addedAt - a.addedAt;
      if (sortOption === 'title') return a.title.localeCompare(b.title);
      if (sortOption === 'author') return a.author.localeCompare(b.author);
      return 0;
    });

  return (
    <div
      data-theme={settings.theme}
      onDragEnter={handleGlobalDragEnter}
      onDragLeave={handleGlobalDragLeave}
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
      className="w-full h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans select-none velvet-transition overflow-hidden relative"
    >
      {/* Clean macOS / Apple Books Top Bar */}
      <header className="h-14 px-2 sm:px-4 flex items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 z-30 select-none overflow-hidden">
        {/* Left: Brand Logo & Title (Click to return home) */}
        <button
          type="button"
          onClick={handleBackToShelf}
          className="flex items-center gap-2 cursor-pointer p-1 -ml-1 rounded-xl hover:bg-[var(--bg-secondary)] transition-all group shrink-0"
          title="Velvet Home"
        >
          <img
            src="/icons/icon512.png"
            alt="Velvet"
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg shadow-sm object-cover shrink-0 group-hover:scale-105 transition-transform"
          />
          <span className="font-bold tracking-tight text-sm text-[var(--text-primary)]">
            Velvet
          </span>
        </button>

        {/* Center: Contextual Book & Chapter Title + Progress (Only in Reader Mode on wide screens) */}
        {viewMode === 'reader' && activeBook && (
          <div className="hidden md:flex flex-col items-center max-w-xs lg:max-w-sm xl:max-w-md mx-2 truncate shrink min-w-0">
            <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-full">
              {activeBook.title}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] font-medium truncate max-w-full">
              {currentLocation.chapterTitle && (
                <span className="truncate max-w-[160px] lg:max-w-[200px]">{currentLocation.chapterTitle}</span>
              )}
              {currentLocation.chapterTitle && <span>•</span>}
              <span className="text-[var(--accent-color)] font-bold shrink-0">
                {Math.round(currentLocation.percentage * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Right: Reading Tools + User Profile / Auth Slot */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {viewMode === 'reader' && (
            <>
              {/* In-Book Search */}
              <button
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  if (settingsOpen) setSettingsOpen(false);
                }}
                className={`p-1.5 sm:p-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer ${
                  searchOpen ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] border-[var(--accent-color)]' : ''
                }`}
                title="Search in Book"
              >
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* Text-To-Speech (AI Voice Reader) */}
              <button
                onClick={() => {
                  if (ttsOpen) {
                    TTSService.stop();
                    setTtsOpen(false);
                  } else {
                    setTtsOpen(true);
                  }
                }}
                className={`p-1.5 sm:p-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer ${
                  ttsOpen ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] border-[var(--accent-color)]' : ''
                }`}
                title="Listen to Book (Text-To-Speech)"
              >
                <Headphones className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* Reading Settings (Themes, Typography, Layout) */}
              <button
                onClick={() => {
                  setSettingsOpen(!settingsOpen);
                  if (searchOpen) setSearchOpen(false);
                }}
                className={`p-1.5 sm:p-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center ${
                  settingsOpen ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] border-[var(--accent-color)]' : ''
                }`}
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </>
          )}

          {/* Ambient Soundscape Button & Modal Trigger */}
          <button
            type="button"
            onClick={() => setAmbientModalOpen(true)}
            className={`p-1.5 sm:p-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center ${
              ambientState.isPlaying
                ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] text-[var(--accent-color)] shadow-xs'
                : ''
            }`}
            title={
              ambientState.isPlaying
                ? `Playing: ${ambientState.currentSound || 'Audio'} (Click to manage)`
                : 'Ambient Noise & Soundscapes'
            }
          >
            <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer hidden sm:flex items-center justify-center"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <div className="w-px h-5 bg-[var(--border-color)] mx-0.5 sm:mx-1 hidden sm:block" />

          {/* Google Profile / Cloud Sync Button */}
          <button
            onClick={() => setSyncOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-sm group shrink-0"
            title={googleUser ? `Connected as ${googleUser.name} (Cloud Sync)` : 'Google Account & Cloud Backup'}
          >
            {/* Google Avatar or G Icon */}
            {googleUser?.picture ? (
              <img src={googleUser.picture} alt={googleUser.name} className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full border border-[var(--border-color)] object-cover shrink-0" />
            ) : (
              <div className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center overflow-hidden shrink-0">
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
            )}
            <span className="text-xs font-semibold tracking-tight hidden md:inline-block max-w-[120px] truncate">
              {googleUser ? googleUser.name : 'Sign in'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {viewMode === 'shelf' ? (
          /* Full-width scrolling container with scrollbar at browser edge */
          <main className="flex-1 overflow-y-auto w-full">
            <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 py-8 space-y-8">
              {/* Section 1: Hero Banner (Vibe Avatar + Monthly Streak Heatmap) */}
              <ShelfHeroBanner
                customAvatar={settings.customAvatar}
                onUpdateAvatar={(newAvatar) => updateSettings({ customAvatar: newAvatar })}
              />

              {/* Section 2: Reading Now (if active book) */}
              {recentBook && (
                <section className="flex flex-col space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Reading Now
                  </h3>
                  <ReadingNowCard book={recentBook} onOpen={handleOpenBook} />
                </section>
              )}

              {/* Section 3: Library Grid with Header Controls & Add Book Grid Card */}
              <section className="space-y-5 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Library ({count})
                  </h3>
                </div>

                {/* Hidden file input for toolbar button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".epub,application/epub+zip"
                  onChange={handleImportFile}
                  className="hidden"
                />

                <BookShelfHeader
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  sortOption={sortOption}
                  onSortChange={setSortOption}
                  totalBooks={books.length}
                  onAddBookClick={() => fileInputRef.current?.click()}
                />

                {/* Grid */}
                {filteredAndSortedBooks.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-5">
                    {filteredAndSortedBooks.map((b) => (
                      <BookCard
                        key={b.id}
                        book={b}
                        onOpen={handleOpenBook}
                        onDelete={handleDeleteBook}
                      />
                    ))}

                    {/* Add Book Card placed at the end of the grid */}
                    <AddBookCard onBookImported={handleOpenBook} />
                  </div>
                ) : (
                  /* Context-aware empty state when search or filter returns 0 books */
                  <div className="min-h-[220px] p-8 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex flex-col items-center justify-center text-center text-xs text-[var(--text-muted)] space-y-1.5">
                    {searchQuery ? (
                      <>
                        <p className="font-medium text-[var(--text-secondary)]">
                          No results found for "{searchQuery}"
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Try searching for a different title, author, or clear the search query.
                        </p>
                      </>
                    ) : statusFilter === 'finished' ? (
                      <>
                        <p className="font-medium text-[var(--text-secondary)]">
                          No finished books yet
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Books you mark as finished or read to 100% will appear here.
                        </p>
                      </>
                    ) : statusFilter === 'reading' ? (
                      <>
                        <p className="font-medium text-[var(--text-secondary)]">
                          No books currently in progress
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Open any book in your library to start reading.
                        </p>
                      </>
                    ) : statusFilter === 'unread' ? (
                      <>
                        <p className="font-medium text-[var(--text-secondary)]">
                          No unread books
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          All books in your library have been started or finished.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-[var(--text-secondary)]">
                          No books in your library yet
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Drag & drop an .epub file here or click Add Book to start reading.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </section>
            </div>
          </main>
        ) : (
          /* Reader Mode View */
          <div className="flex-1 flex overflow-hidden relative">
            {/* Search Drawer */}
            {searchOpen && (
              <SearchDrawer
                onNavigate={(target) => {
                  const viewEl = document.querySelector('foliate-view') as any;
                  viewEl?.goTo(target);
                }}
                onClose={() => setSearchOpen(false)}
              />
            )}

            {/* Navigation Drawer (TOC, Notes, Comments Hub) */}
            {sidebarOpen && (
              <>
                {/* Backdrop on small/narrow screens (overlay mode) */}
                <div
                  className="fixed inset-0 bg-black/40 z-20 lg:hidden backdrop-blur-xs animate-in fade-in duration-150"
                  onClick={() => setSidebarOpen(false)}
                />
                <div className="fixed lg:static inset-y-0 left-0 z-30 flex">
                  <NavigationDrawer
                    bookId={activeBookId || ''}
                    currentCfi={currentLocation.cfi}
                    currentChapterTitle={currentLocation.chapterTitle}
                    tocList={tocList}
                    notes={activeNotes}
                    comments={activeComments}
                    settings={settings}
                    onExportNotes={handleExportMarkdown}
                    onNavigate={(target) => {
                      const viewEl = document.querySelector('foliate-view') as any;
                      viewEl?.goTo(target);
                      // On mobile/narrow screens, auto-close sidebar after navigation
                      if (window.innerWidth < 1024) {
                        setSidebarOpen(false);
                      }
                    }}
                    onClose={() => setSidebarOpen(false)}
                    onOpenSettings={() => {
                      setSettingsTargetSection('gemini');
                      setSettingsOpen(true);
                    }}
                  />
                </div>
              </>
            )}

            {/* Central Book Reader Container */}
            <div className="flex-1 flex flex-col items-center justify-center relative bg-[var(--reader-bg)] text-[var(--reader-text)] overflow-hidden">
              {/* Left Floating Sidebar Toggle (Icon-only) */}
              {activeBookId && !sidebarOpen && (
                <button
                  onClick={() => {
                    setSidebarOpen(true);
                    if (searchOpen) setSearchOpen(false);
                    if (settingsOpen) setSettingsOpen(false);
                  }}
                  className="absolute left-4 top-3.5 z-20 p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]/85 hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-sm backdrop-blur-xl transition-all cursor-pointer group flex items-center justify-center"
                  title="Contents, Notes & Comments (Sidebar)"
                >
                  <List className="w-4 h-4 text-[var(--accent-color)] group-hover:scale-110 transition-transform" />
                  {activeNotes.length + activeComments.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent-color)] text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                      {activeNotes.length + activeComments.length}
                    </span>
                  )}
                </button>
              )}

              {activeBookId ? (
                <FoliateViewer
                  bookId={activeBookId}
                  theme={settings.theme}
                  settings={settings}
                  isTTSActive={ttsOpen}
                  onLocationChange={(loc) => setCurrentLocation(loc)}
                  onTOCLoaded={(toc) => setTocList(toc)}
                  onWordClick={handleWordClick}
                  onOpenSettings={() => {
                    setSettingsTargetSection('gemini');
                    setSettingsOpen(true);
                  }}
                />
              ) : (
                <div className="max-w-md w-full text-center space-y-4">
                  <BookOpen className="w-12 h-12 text-[var(--accent-color)] mx-auto opacity-70" />
                  <h3 className="text-xl font-bold">No book selected</h3>
                  <button
                    onClick={() => setViewMode('shelf')}
                    className="px-5 py-2 rounded-full bg-[var(--accent-color)] text-white text-xs font-semibold shadow-sm hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
                  >
                    Open Library
                  </button>
                </div>
              )}

              {/* Floating Word Definition Modal (Bottom Right Overlay) */}
              <WordDefinitionModal
                data={wordExplanation}
                isLoading={isLookingUpWord}
                error={wordLookupError}
                fontFamily={settings.fontFamily}
                onClose={handleCloseWordModal}
                onOpenSettings={handleOpenGeminiSettings}
              />

              {/* Floating TTS Media Player Bar */}
              {activeBookId && ttsOpen && (
                <TTSPlayerBar
                  ttsSettings={settings.ttsSettings}
                  onUpdateSettings={(ttsUpdates) => {
                    const currentTTS = settings.ttsSettings || {
                      provider: 'google',
                      voice: 'vi',
                      rate: 1.0,
                      pitch: 1.0,
                      autoScroll: true,
                    };
                    updateSettings({
                      ttsSettings: { ...currentTTS, ...ttsUpdates },
                    });
                  }}
                  onClose={() => {
                    TTSService.stop();
                    setTtsOpen(false);
                  }}
                />
              )}

              {/* Subtle 2px Bottom Reading Progress Line (Never overlaps text) */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--border-color)]/30 z-10">
                <div
                  className="h-full bg-[var(--accent-color)]/60 transition-all duration-300"
                  style={{ width: `${Math.round(currentLocation.percentage * 100)}%` }}
                />
              </div>
            </div>

            {/* Typography & Layout Settings Drawer */}
            {settingsOpen && (
              <TypographyDrawer
                settings={settings}
                targetSection={settingsTargetSection}
                onUpdate={updateSettings}
                onClose={() => {
                  setSettingsOpen(false);
                  setSettingsTargetSection(null);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Google Drive Cloud Backup & Restore Modal */}
      <CloudSyncModal
        isOpen={syncOpen}
        onClose={() => {
          setSyncOpen(false);
          // Refresh user state
          GoogleAuthService.getCurrentUser().then(setUser => setGoogleUser(setUser));
        }}
      />

      {/* Ambient Noise & Focus Soundscapes Modal */}
      <AmbientSoundModal
        isOpen={ambientModalOpen}
        onClose={() => setAmbientModalOpen(false)}
      />

      {/* Global Full-Screen Drag & Drop Overlay */}
      {isGlobalDragging && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md flex flex-col items-center justify-center p-6 border-4 border-dashed border-[var(--accent-color)] animate-in fade-in zoom-in-95 duration-150 pointer-events-none select-none">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="w-20 h-20 rounded-3xl bg-[var(--accent-subtle)] border border-[var(--accent-color)]/40 flex items-center justify-center text-[var(--accent-color)] shadow-xl animate-bounce">
              <UploadCloud className="w-10 h-10 stroke-[2]" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                Drop EPUB Book Here
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Release your mouse to automatically import and open this book in your library
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[11px] text-[var(--text-muted)] font-medium">
              <BookPlus className="w-3.5 h-3.5 text-[var(--accent-color)]" />
              <span>Supports standard .epub format</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
