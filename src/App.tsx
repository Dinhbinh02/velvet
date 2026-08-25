import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  User,
  Smartphone,
  ChevronLeft,
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
import type { IBook } from '@/src/types/book';

export const App: React.FC = () => {
  const { books } = useBooks();
  const { settings, updateSettings } = useReaderSettings();
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const activeBook = useBookDetails(activeBookId);
  const [viewMode, setViewMode] = useState<'shelf' | 'reader' | 'discover'>('shelf');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTargetSection, setSettingsTargetSection] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [ambientModalOpen, setAmbientModalOpen] = useState(false);
  const [ambientState, setAmbientState] = useState(() => AmbientSoundService.getState());
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [ttsOpen, setTtsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pwaModalOpen, setPwaModalOpen] = useState(false);
  const [isPwaStandalone, setIsPwaStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  });

  useEffect(() => {
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsPwaStandalone(Boolean(isStandalone));
    };

    checkStandalone();
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener?.('change', checkStandalone);
    return () => mq.removeEventListener?.('change', checkStandalone);
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
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
      className="w-full h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans select-none velvet-transition overflow-hidden relative"
    >
      {/* Clean macOS / Apple Books Top Bar */}
      <header className="header-safe px-2.5 sm:px-4 md:px-5 flex items-center justify-between gap-1 sm:gap-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 z-30 select-none">
        {/* Left: Brand / Back button & TOC Sidebar Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
          {viewMode === 'reader' ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Back to Library Button */}
              <button
                onClick={() => {
                  setViewMode('shelf');
                  // Push reading progress to cloud when leaving reader
                  SupabaseSyncService.pushToCloud();
                }}
                className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 shadow-xs"
                title="Back to Library"
              >
                <ChevronLeft className="w-4 h-4 text-[var(--accent-color)] shrink-0" />
                <span className="hidden xs:inline">Library</span>
              </button>

              {/* Sidebar TOC / Notes Button on Header */}
              <button
                data-sidebar-toggle="true"
                onClick={() => {
                  setSidebarOpen(!sidebarOpen);
                  if (searchOpen) setSearchOpen(false);
                  if (settingsOpen) setSettingsOpen(false);
                }}
                className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 relative shadow-xs ${
                  sidebarOpen ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] border-[var(--accent-color)]' : 'bg-[var(--bg-secondary)]'
                }`}
                title="Contents, Notes & Comments (Sidebar)"
              >
                <List className="w-4 h-4 text-[var(--accent-color)]" />
                <span className="hidden sm:inline text-xs font-semibold text-[var(--text-primary)]">TOC</span>
                {activeNotes.length + activeComments.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent-color)] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {activeNotes.length + activeComments.length}
                  </span>
                )}
              </button>
            </div>
          ) : viewMode === 'discover' ? (
            /* Back to Library Button from Discover view */
            <button
              onClick={() => setViewMode('shelf')}
              className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 shadow-xs"
              title="Back to Library"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--accent-color)] shrink-0" />
              <span className="hidden xs:inline">Library</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <img
                src="/icons/icon512.png"
                alt="Velvet"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg shadow-sm object-cover shrink-0"
              />
              <span className="font-bold tracking-tight text-sm text-[var(--text-primary)]">
                Velvet
              </span>
            </div>
          )}
        </div>

        {/* Center: Contextual Book & Chapter Title + Progress in Reader Mode */}
        {viewMode === 'reader' && activeBook && (
          <div className="flex flex-col items-center max-w-[120px] xs:max-w-[150px] sm:max-w-xs md:max-w-sm mx-1 truncate shrink min-w-0 text-center">
            <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate max-w-full leading-tight">
              {activeBook.title}
            </span>
            <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] text-[var(--text-muted)] font-normal truncate max-w-full mt-0.5">
              {currentLocation.chapterTitle && (
                <span className="truncate max-w-[70px] xs:max-w-[100px] sm:max-w-[150px]">{currentLocation.chapterTitle}</span>
              )}
              {currentLocation.chapterTitle && <span>•</span>}
              <span className="text-[var(--text-secondary)] font-normal shrink-0">
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
                data-search-toggle="true"
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  if (settingsOpen) setSettingsOpen(false);
                  if (sidebarOpen) setSidebarOpen(false);
                }}
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center shrink-0 ${
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
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  ttsOpen ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] border-[var(--accent-color)]' : ''
                }`}
                title="Listen to Book (Text-To-Speech)"
              >
                <Headphones className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </>
          )}

          {/* Ambient Soundscape Button & Modal Trigger */}
          <button
            type="button"
            onClick={() => setAmbientModalOpen(true)}
            className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center shrink-0 ${
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

          {/* Reading & App Settings (Themes, Typography, Layout, Gemini Key) */}
          <button
            data-settings-toggle="true"
            onClick={() => {
              setSettingsOpen(!settingsOpen);
              if (searchOpen) setSearchOpen(false);
              if (sidebarOpen) setSidebarOpen(false);
            }}
            className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center shrink-0 ${
              settingsOpen ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] border-[var(--accent-color)]' : ''
            }`}
            title="Settings (Themes, Typography & AI)"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Fullscreen Toggle (Hidden on mobile) */}
          <button
            onClick={toggleFullscreen}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer hidden sm:flex items-center justify-center shrink-0"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Mobile PWA Install Button (Hidden on desktop since desktop browsers detect PWA natively) */}
          {!isPwaStandalone && (
            <button
              onClick={() => setPwaModalOpen(true)}
              className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0 group md:hidden ${
                viewMode === 'reader' ? 'hidden' : 'flex'
              }`}
              title="Install Mobile App (PWA)"
            >
              <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent-color)] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">App</span>
            </button>
          )}

          {/* Supabase & Cloudflare R2 Auth / Sync Button (Hidden in Reader view on mobile) */}
          {(() => {
            const userAvatar = supabaseUser?.user_metadata?.avatar_url || supabaseUser?.user_metadata?.picture;
            const userName = supabaseUser?.user_metadata?.full_name || supabaseUser?.user_metadata?.name || supabaseUser?.email?.split('@')[0];

            return (
              <button
                onClick={() => setSyncOpen(true)}
                className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-sm group shrink-0 ${
                  viewMode === 'reader' ? 'hidden sm:flex' : 'flex'
                }`}
                title={supabaseUser ? `Connected as ${userName || supabaseUser.email}` : 'Sign in to sync your library'}
              >
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userName || 'User'}
                    className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full border border-[var(--border-color)] object-cover shrink-0"
                  />
                ) : (
                  <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-color)] flex items-center justify-center font-bold text-xs shrink-0">
                    {supabaseUser?.email?.[0]?.toUpperCase() || <User className="w-3 h-3" />}
                  </div>
                )}
                <span className="text-xs font-semibold tracking-tight hidden md:inline-block max-w-[120px] truncate">
                  {supabaseUser ? userName || supabaseUser.email : 'Sign In'}
                </span>
              </button>
            );
          })()}
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {viewMode === 'discover' ? (
          <DiscoveryView
            onOpenBook={handleOpenBook}
            onImportClick={() => fileInputRef.current?.click()}
          />
        ) : viewMode === 'shelf' ? (
          <main className="flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto px-2.5 xs:px-3.5 sm:pl-8 sm:pr-6 lg:pl-14 lg:pr-12 pt-4 sm:pt-8 pb-[max(3.5rem,calc(env(safe-area-inset-bottom,0px)+2.5rem))] space-y-6 sm:space-y-8">
            {/* Section 1: Hero Banner (Vibe Avatar + Monthly Streak Heatmap) */}
              <ShelfHeroBanner
                customAvatar={settings.customAvatar}
                onUpdateAvatar={(newAvatar) => updateSettings({ customAvatar: newAvatar })}
              />

              {/* Section 2: Reading Now */}
              {recentBook && (
                <section className="space-y-3.5">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Reading Now
                  </h3>
                  <ReadingNowCard book={recentBook} onOpen={handleOpenBook} />
                </section>
              )}

              {/* Section 3: Library Grid with Header Controls & Add Book Grid Card */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-[var(--text-muted)]">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-5">
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

              {/* Section 4: Discover Curated Books Preview on Homepage */}
              <ShelfDiscoverSection
                onExploreMore={() => setViewMode('discover')}
                onOpenBook={handleOpenBook}
              />
          </main>
        ) : (
          /* Reader Mode View */
          <div className="flex-1 flex overflow-hidden relative">
            {searchOpen && (
              <>
                <div
                  className="fixed inset-0 bg-black/25 z-40 backdrop-blur-xs animate-in fade-in duration-150"
                  onClick={() => setSearchOpen(false)}
                />
                <SearchDrawer
                  onNavigate={(target) => {
                    const viewEl = document.querySelector('foliate-view') as any;
                    viewEl?.goTo(target);
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
                />
              </>
            )}

            <div className="flex-1 flex flex-col items-center justify-center relative bg-[var(--reader-bg)] text-[var(--reader-text)] overflow-hidden">
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
