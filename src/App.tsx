import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  BookOpen,
  Settings,
  UploadCloud,
  BookPlus,
  Sparkles,
  PanelLeft,
  Plus,
} from 'lucide-react';
import { useBooks, useBookDetails } from '@/src/hooks/useBooks';
import { useReaderSettings } from '@/src/hooks/useReaderSettings';
import { BookCard } from '@/src/components/shelf/BookCard';
import { AddBookCard } from '@/src/components/shelf/AddBookCard';
import { BookImportOverlay, type BookImportState } from '@/src/components/shelf/BookImportOverlay';
import { ReadingNowCard } from '@/src/components/shelf/ReadingNowCard';
import { ShelfHeroBanner } from '@/src/components/shelf/ShelfHeroBanner';
import { ShelfDiscoverSection } from '@/src/components/shelf/ShelfDiscoverSection';
import { BookShelfHeader, type BookStatusFilter, type BookSortOption } from '@/src/components/shelf/BookShelfHeader';
import { AmbientSoundModal } from '@/src/components/shelf/AmbientSoundModal';
import { AmbientSoundService } from '@/src/services/ambientSoundService';
import { FoliateViewer } from '@/src/components/reader/FoliateViewer';
import { ChapterKeyInsightsModal } from '@/src/components/reader/ChapterKeyInsightsModal';
import { AppSidebar } from '@/src/components/navigation/AppSidebar';
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
import { DiscoveryView } from '@/src/components/discovery/DiscoveryView';
import { InstallPwaModal } from '@/src/components/pwa/InstallPwaModal';
import { SupabaseService } from '@/src/services/supabaseClient';
import { SupabaseSyncService } from '@/src/services/supabaseSyncService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/schema';
import type { IBook, IHeaderSummary } from '@/src/types/book';

export const App: React.FC = () => {
  const { books } = useBooks();
  const { settings, updateSettings } = useReaderSettings();
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const activeBook = useBookDetails(activeBookId);
  const [viewMode, setViewMode] = useState<'shelf' | 'reader' | 'discover'>('shelf');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTargetSection, setSettingsTargetSection] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [ambientModalOpen, setAmbientModalOpen] = useState(false);
  const [ambientState, setAmbientState] = useState(() => AmbientSoundService.getState());
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [ttsOpen, setTtsOpen] = useState(false);
  const [pwaModalOpen, setPwaModalOpen] = useState(false);

  // Global keyboard shortcut: Cmd+B / Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarExpanded((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    return AmbientSoundService.subscribe(() => {
      setAmbientState(AmbientSoundService.getState());
    });
  }, []);

  // Shelf Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookStatusFilter>('all');
  const [sortOption, setSortOption] = useState<BookSortOption>('lastRead');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global Full-Screen Drag & Drop State
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounter = useRef(0);

  // Book Import Loading & Feedback State
  const [importState, setImportState] = useState<BookImportState | null>(null);

  const processImportFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.epub')) {
      setImportState({
        isImporting: true,
        fileName: file.name,
        fileSize: file.size,
        step: 'error',
        progressPercent: 0,
        errorMessage: 'Please select a valid .epub book file.',
      });
      return;
    }

    setImportState({
      isImporting: true,
      fileName: file.name,
      fileSize: file.size,
      step: 'optimizing',
      progressPercent: 10,
      errorMessage: null,
    });

    try {
      const bookId = await BookService.importBook(file, (step, percent) => {
        setImportState((prev) =>
          prev
            ? {
                ...prev,
                step: step as any,
                progressPercent: percent,
              }
            : null
        );
      });

      // Show ready state with short delay for smooth visual transition
      setImportState((prev) =>
        prev
          ? {
              ...prev,
              step: 'ready',
              progressPercent: 100,
            }
          : null
      );

      setTimeout(() => {
        setImportState(null);
        handleOpenBook(bookId);
      }, 550);
    } catch (err: any) {
      console.error('Failed to import EPUB:', err);
      setImportState({
        isImporting: true,
        fileName: file.name,
        fileSize: file.size,
        step: 'error',
        progressPercent: 0,
        errorMessage: err?.message || 'Failed to process this EPUB book.',
      });
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
    sectionHref?: string;
  }>({
    cfi: '',
    percentage: 0,
    sectionIndex: 0,
  });
  const [tocList, setTocList] = useState<any[]>([]);
  const [bookVersion, setBookVersion] = useState<number>(Date.now());

  useEffect(() => {
    const handleReloadBook = () => {
      setBookVersion(Date.now());
    };
    window.addEventListener('velvet:reload-book', handleReloadBook);
    return () => window.removeEventListener('velvet:reload-book', handleReloadBook);
  }, []);

  // Dynamic Safari iOS status bar & bottom bar theme-color synchronization
  useEffect(() => {
    const theme = settings.theme || 'paper';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);

    const themeColors: Record<string, { bg: string; surface: string }> = {
      light: { bg: '#FFFFFF', surface: '#FFFFFF' },
      paper: { bg: '#F2F2F2', surface: '#EBEBEB' },
      sepia: { bg: '#F4ECD8', surface: '#FAF6EE' },
      dark: { bg: '#000000', surface: '#181818' },
      amoled: { bg: '#000000', surface: '#161616' },
      oled: { bg: '#000000', surface: '#161616' },
      nord: { bg: '#2E3440', surface: '#3B4252' },
    };
    const tConfig = themeColors[theme] || themeColors.paper;

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    // Match the exact header surface background color for seamless status bar blending on Safari
    metaThemeColor.setAttribute('content', tConfig.surface);
    document.documentElement.style.backgroundColor = tConfig.bg;
    document.body.style.backgroundColor = tConfig.bg;
  }, [settings.theme]);

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

  const handleCloseWordModal = useCallback(() => {
    setWordExplanation(null);
    setWordLookupError(null);
  }, []);

  const handleOpenGeminiSettings = useCallback(() => {
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
      import('@/src/services/fontService').then(({ FontService }) => {
        if (styleTag) {
          styleTag.textContent = FontService.generateFontFaceRules(customFonts);
        }
      });
    } else {
      styleTag.textContent = '';
    }
  }, [customFonts]);

  // Load Supabase user and pull cloud data on startup (cloud is authoritative)
  useEffect(() => {
    SupabaseService.getCurrentUser().then((u) => {
      setSupabaseUser(u);
      if (u) {
        // Pull cloud → replace local entirely, then start Realtime listener
        SupabaseSyncService.pullFromCloud();
      }
    });

    // Periodic pull every 10 minutes to stay in sync with cloud
    const syncInterval = setInterval(() => {
      SupabaseSyncService.pullFromCloud();
    }, 10 * 60 * 1000);

    return () => clearInterval(syncInterval);
  }, []);

  // Check URL params for bookId
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookIdParam = params.get('bookId');
    if (bookIdParam) {
      setActiveBookId(bookIdParam);
      setViewMode('reader');
      setSidebarOpen(false);
    }
  }, []);

  const handleOpenBook = (bookId: string) => {
    setActiveBookId(bookId);
    setViewMode('reader');
    setSidebarOpen(false);
  };

  const handleDeleteBook = async (bookId: string) => {
    await BookService.deleteBookCompletely(bookId);
    if (activeBookId === bookId) {
      setActiveBookId(null);
      setViewMode('shelf');
    }
  };

  const handleExportMarkdown = () => {
    if (!activeBook) return;
    ExportService.downloadMarkdownFile(activeBook, activeNotes, activeComments, activeHighlights);
  };

  // Chapter Key Insights State
  const [keyInsightsState, setKeyInsightsState] = useState<{
    isOpen: boolean;
    chapterTitle: string;
    bookTitle?: string;
    summaries: IHeaderSummary[];
    targetHref?: string;
  } | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const handleOpenKeyInsights = (chapterTitle: string, summaries: IHeaderSummary[], targetHref?: string) => {
    setKeyInsightsState({
      isOpen: true,
      chapterTitle: chapterTitle || currentLocation.chapterTitle || 'Chapter Insights',
      bookTitle: activeBook?.title,
      summaries,
      targetHref,
    });
  };

  const handleHeaderKeyInsightsClick = async () => {
    if (!activeBookId) return;
    const activeHref = (currentLocation.sectionHref || '').split('#')[0].replace(/^\.\//, '');
    const activeTitle = currentLocation.chapterTitle || '';

    try {
      const all = await db.chapterSummaries.where('bookId').equals(activeBookId).toArray();
      const found = all.find((s) => {
        if (activeHref && s.href) {
          const cleanS = s.href.split('#')[0].replace(/^\.\//, '');
          if (cleanS === activeHref) return true;
        }
        if (activeTitle && s.chapterTitle) {
          if (s.chapterTitle.trim().toLowerCase() === activeTitle.trim().toLowerCase()) return true;
        }
        return false;
      });

      if (found && Array.isArray(found.summaries) && found.summaries.length > 0) {
        handleOpenKeyInsights(found.chapterTitle || activeTitle, found.summaries, found.href);
      } else {
        handleOpenKeyInsights(activeTitle || 'Chapter Insights', [], activeHref);
      }
    } catch {
      handleOpenKeyInsights(activeTitle || 'Chapter Insights', [], activeHref);
    }
  };

  const handleRegenerateInsights = async () => {
    if (!activeBookId || isGeneratingInsights) return;
    if (!settings?.geminiApiKey?.trim()) {
      setSettingsTargetSection('gemini');
      setSettingsOpen(true);
      return;
    }

    setIsGeneratingInsights(true);
    try {
      const viewEl = document.querySelector('foliate-view') as any;
      const activeIframe =
        viewEl?.renderer?.shadowRoot?.querySelector('iframe') ||
        viewEl?.shadowRoot?.querySelector('iframe') ||
        document.querySelector('foliate-view')?.shadowRoot?.querySelector('iframe');
      const activeDoc = activeIframe?.contentDocument;
      const sectionText = activeDoc?.body?.innerText || activeDoc?.body?.textContent || '';

      if (!sectionText || sectionText.length < 50) {
        throw new Error('Could not extract chapter text.');
      }

      const chapterLabel = keyInsightsState?.chapterTitle || currentLocation.chapterTitle || 'Chapter';
      const targetHref = keyInsightsState?.targetHref || currentLocation.sectionHref || '';

      const summaries = await GeminiAIService.summarizeChapterByHeaders(
        chapterLabel,
        sectionText,
        activeBook?.title || '',
        settings.geminiApiKey
      );

      const summaryRecordId = `${activeBookId}_${targetHref || chapterLabel}`;
      await db.chapterSummaries.put({
        id: summaryRecordId,
        bookId: activeBookId,
        href: targetHref,
        chapterTitle: chapterLabel,
        summaries,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      setKeyInsightsState((prev) => (prev ? { ...prev, summaries } : null));
    } catch (err: any) {
      alert(err.message || 'Failed to generate key insights.');
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  // Find most recently read book for "Reading Now"
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
      className="w-full h-full flex bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans select-none overflow-hidden relative"
    >
      {/* 1. Modern Solid Sidebar Navigation */}
      <AppSidebar
        viewMode={viewMode}
        onSelectViewMode={(mode) => setViewMode(mode)}
        isOpen={sidebarExpanded}
        onToggleOpen={() => setSidebarExpanded(!sidebarExpanded)}
        isMobileDrawerOpen={mobileSidebarOpen}
        onCloseMobileDrawer={() => setMobileSidebarOpen(false)}
        booksCount={books.length}
        activeBook={activeBook || null}
        currentChapterTitle={currentLocation.chapterTitle}
        currentPercentage={currentLocation.percentage}
        onOpenSidebarTOC={() => {
          setSidebarOpen(!sidebarOpen);
          if (searchOpen) setSearchOpen(false);
          if (settingsOpen) setSettingsOpen(false);
        }}
        onOpenKeyInsights={handleHeaderKeyInsightsClick}
        onOpenInBookSearch={() => {
          setSearchOpen(!searchOpen);
          if (settingsOpen) setSettingsOpen(false);
          if (sidebarOpen) setSidebarOpen(false);
        }}
        onToggleTTS={() => {
          if (ttsOpen) {
            TTSService.stop();
            setTtsOpen(false);
          } else {
            setTtsOpen(true);
          }
        }}
        isTTSActive={ttsOpen}
        onOpenAmbient={() => setAmbientModalOpen(true)}
        isAmbientPlaying={ambientState.isPlaying}
        onOpenSettings={(sec) => {
          if (sec) setSettingsTargetSection(sec);
          setSettingsOpen(true);
        }}
        onOpenSync={() => setSyncOpen(true)}
        onOpenPwa={() => setPwaModalOpen(true)}
        onBackToLibrary={() => {
          setViewMode('shelf');
          SupabaseSyncService.pushToCloud();
        }}
        onAddBookClick={() => fileInputRef.current?.click()}
        supabaseUser={supabaseUser}
      />

      {/* 2. Main Canvas Viewport Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Mobile Header Bar (Only on small screens) */}
        <div className="md:hidden h-12 px-3 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 z-20">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
            aria-label="Open Navigation"
          >
            <PanelLeft className="w-5 h-5" />
          </button>

          <span className="font-bold text-xs truncate max-w-[180px]">
            {viewMode === 'reader' && activeBook ? activeBook.title : 'Velvet'}
          </span>

          <div className="flex items-center gap-1">
            {viewMode === 'reader' && (
              <button
                type="button"
                onClick={handleHeaderKeyInsightsClick}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-amber-500 hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
                title="Key Insights"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Switching */}
        {viewMode === 'discover' ? (
          <DiscoveryView
            onOpenBook={handleOpenBook}
            onImportClick={() => fileInputRef.current?.click()}
          />
        ) : viewMode === 'shelf' ? (
          <main className="flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto px-3 sm:px-8 lg:px-12 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-24">
            {/* Section 1: Hero Banner (Vibe Avatar + Monthly Streak Heatmap) */}
            <ShelfHeroBanner
              customAvatar={settings.customAvatar}
              onUpdateAvatar={(newAvatar) => updateSettings({ customAvatar: newAvatar })}
            />

            {/* Section 2: Reading Now */}
            {recentBook && (
              <section className="space-y-3.5">
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Reading Now
                </h3>
                <ReadingNowCard book={recentBook} onOpen={handleOpenBook} />
              </section>
            )}

            {/* Section 3: Library Grid with Clean Header Controls */}
            <section className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Library
                </h3>
              </div>

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

              {filteredAndSortedBooks.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-5">
                  {filteredAndSortedBooks.map((b) => (
                    <BookCard
                      key={b.id}
                      book={b}
                      onOpen={handleOpenBook}
                      onDelete={handleDeleteBook}
                    />
                  ))}

                  <AddBookCard onBookImported={handleOpenBook} onImportFile={processImportFile} />
                </div>
              ) : (
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
                  ) : (
                    <>
                      <BookOpen className="w-10 h-10 mb-2 opacity-30" />
                      <p className="font-semibold text-sm text-[var(--text-primary)]">Your Library is Empty</p>
                      <p className="text-xs max-w-sm text-[var(--text-muted)]">
                        Import your favorite .epub books by dragging and dropping them anywhere, or click Add Book.
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 px-4 py-2 rounded-xl bg-[var(--accent-color)] text-white text-xs font-semibold shadow-xs hover:bg-[var(--accent-hover)] transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Book</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* Section 4: Discover Curated Free Masterpieces */}
            <ShelfDiscoverSection
              onExploreMore={() => setViewMode('discover')}
              onOpenBook={handleOpenBook}
            />
          </main>
        ) : (
          /* Reader Viewport */
          <div className="flex-1 flex overflow-hidden relative">
            {searchOpen && (
              <>
                <div
                  className="fixed inset-0 bg-black/25 z-40 backdrop-blur-xs animate-in fade-in duration-150"
                  onClick={() => setSearchOpen(false)}
                />
                <SearchDrawer
                  onNavigate={(cfi) => {
                    const viewEl = document.querySelector('foliate-view') as any;
                    if (viewEl && cfi) viewEl.goTo(cfi);
                    setSearchOpen(false);
                  }}
                  onClose={() => setSearchOpen(false)}
                />
              </>
            )}

            {sidebarOpen && (
              <>
                <div
                  className="fixed inset-0 bg-black/25 z-40 backdrop-blur-xs animate-in fade-in duration-150"
                  onClick={() => setSidebarOpen(false)}
                />
                <NavigationDrawer
                  bookId={activeBookId || ''}
                  currentCfi={currentLocation.cfi}
                  currentChapterTitle={currentLocation.chapterTitle}
                  currentSectionHref={currentLocation.sectionHref}
                  tocList={tocList}
                  notes={activeNotes}
                  comments={activeComments}
                  settings={settings}
                  onExportNotes={handleExportMarkdown}
                  onNavigate={async (target) => {
                    const viewEl = document.querySelector('foliate-view') as any;
                    if (!viewEl) return;

                    try {
                      await viewEl.goTo(target);
                    } catch (err) {
                      console.warn('Direct navigation failed, attempting clean fallback:', err);
                      try {
                        const cleanTarget = typeof target === 'string' ? target.split('#')[0] : target;
                        await viewEl.goTo(cleanTarget);
                      } catch (fallbackErr) {
                        console.error('Chapter navigation failed:', fallbackErr);
                      }
                    }

                    setSidebarOpen(false);
                  }}
                  onClose={() => setSidebarOpen(false)}
                  onOpenSettings={() => {
                    setSettingsTargetSection('gemini');
                    setSettingsOpen(true);
                  }}
                  onOpenKeyInsights={handleOpenKeyInsights}
                />
              </>
            )}

            <div className="flex-1 flex flex-col items-center justify-center relative bg-[var(--reader-bg)] text-[var(--reader-text)] overflow-hidden">
              {/* Minimal Sleek Reading Status Pill (Book & Progress Only) */}
              {activeBook && (
                <div className="absolute top-3.5 inset-x-0 mx-auto z-20 w-fit max-w-[85vw] flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[var(--bg-surface)]/80 backdrop-blur-md text-[var(--text-primary)] border border-[var(--border-color)]/40 shadow-xs select-none pointer-events-none transition-all">
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[160px] sm:max-w-[260px]">
                    {activeBook.title}
                  </span>
                  {currentLocation.chapterTitle && (
                    <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[140px] sm:max-w-[220px]">
                      • {currentLocation.chapterTitle}
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-[var(--accent-color)] font-medium shrink-0 ml-1">
                    {Math.round(currentLocation.percentage * 100)}%
                  </span>
                </div>
              )}

              {activeBookId ? (
                <FoliateViewer
                  key={`${activeBookId}_${settings.layoutMode}_${bookVersion}`}
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

              <WordDefinitionModal
                data={wordExplanation}
                isLoading={isLookingUpWord}
                error={wordLookupError}
                fontFamily={settings.fontFamily}
                fontSize={settings.fontSize}
                maxWidth={settings.maxWidth}
                onClose={handleCloseWordModal}
                onOpenSettings={handleOpenGeminiSettings}
              />

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
            </div>
          </div>
        )}
      </div>

      {/* Global Reading & App Settings Drawer */}
      {settingsOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/25 z-40 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => {
              setSettingsOpen(false);
              setSettingsTargetSection(null);
            }}
          />
          <TypographyDrawer
            settings={settings}
            targetSection={settingsTargetSection}
            onUpdate={updateSettings}
            onClose={() => {
              setSettingsOpen(false);
              setSettingsTargetSection(null);
            }}
          />
        </>
      )}

      {/* Supabase & Cloudflare R2 Cloud Hub Modal */}
      <CloudSyncModal
        isOpen={syncOpen}
        onClose={() => {
          setSyncOpen(false);
          SupabaseService.getCurrentUser().then((u) => setSupabaseUser(u));
        }}
      />

      {/* Ambient Noise & Focus Soundscapes Modal */}
      <AmbientSoundModal
        isOpen={ambientModalOpen}
        onClose={() => setAmbientModalOpen(false)}
      />

      {/* Mobile PWA Installation & Step-by-Step Guidance Modal */}
      <InstallPwaModal
        isOpen={pwaModalOpen}
        onClose={() => setPwaModalOpen(false)}
      />

      {/* Chapter Key Insights Modal Popup */}
      <ChapterKeyInsightsModal
        isOpen={Boolean(keyInsightsState?.isOpen)}
        onClose={() => setKeyInsightsState(null)}
        chapterTitle={keyInsightsState?.chapterTitle || ''}
        bookTitle={keyInsightsState?.bookTitle || activeBook?.title}
        summaries={keyInsightsState?.summaries || []}
        onRegenerate={handleRegenerateInsights}
        isGenerating={isGeneratingInsights}
      />

      {/* Book Import Loading & Feedback Overlay */}
      <BookImportOverlay
        state={importState}
        onClose={() => setImportState(null)}
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
