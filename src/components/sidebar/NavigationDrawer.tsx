import React, { useState, useEffect, useRef } from 'react';
import {
  List,
  StickyNote,
  MessageSquare,
  Trash2,
  Edit2,
  Plus,
  Bold,
  Italic,
  List as ListIcon,
  ListOrdered,
  Download,
  ChevronDown,
  ChevronRight,
  Bot,
  Check,
  Loader2,
} from 'lucide-react';
import type { INote, IComment, IReaderSettings } from '@/src/types/book';
import { NoteService } from '@/src/services/noteService';
import { GeminiAIService } from '@/src/services/geminiAIService';
import { SupabaseSyncService } from '@/src/services/supabaseSyncService';
import { db } from '@/src/db/schema';

interface TOCItemNodeProps {
  item: any;
  bookId?: string;
  depth?: number;
  currentChapterTitle?: string;
  currentSectionHref?: string;
  currentCfi?: string;
  settings?: Partial<IReaderSettings>;
  onNavigate: (cfiOrHref: string) => void;
  onClose: () => void;
  onOpenSettings?: () => void;
}

const TOCItemNode: React.FC<TOCItemNodeProps> = ({
  item,
  bookId,
  depth = 0,
  currentChapterTitle,
  currentSectionHref,
  currentCfi,
  settings,
  onNavigate,
  onClose,
  onOpenSettings,
}) => {
  const hasSubitems = Array.isArray(item.subitems) && item.subitems.length > 0;
  const [isOpen, setIsOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const itemTitle = (item.label || item.title || '').trim().toLowerCase();
  const activeTitle = (currentChapterTitle || '').trim().toLowerCase();

  // Strict exact matching: prioritize exact section href match if available, otherwise strict exact label match
  const isActive = Boolean(
    (currentSectionHref && item.href && currentSectionHref === item.href) ||
    (activeTitle && itemTitle && activeTitle === itemTitle)
  );

  const nodeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active TOC item to the center of the sidebar on mount/chapter change
  useEffect(() => {
    if (isActive && nodeRef.current) {
      const timer = setTimeout(() => {
        nodeRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleGenerateSummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGenerating) return;

    if (!settings?.geminiApiKey?.trim()) {
      if (onOpenSettings) {
        onOpenSettings();
      }
      return;
    }

    setIsGenerating(true);
    try {
      const viewEl = document.querySelector('foliate-view') as any;
      let sectionText = '';
      const chapterLabel = item.label || item.title || 'Chapter';

      let bookTitle = '';
      let bookAuthor = '';

      // 1. Get accurate metadata from Dexie DB or Foliate
      if (bookId) {
        try {
          const dbBook = await db.books.get(bookId);
          if (dbBook) {
            bookTitle = dbBook.title || '';
            bookAuthor = dbBook.author || '';
          }
        } catch {}
      }

      const targetHref = item.href || item.cfi || '';

      if (viewEl?.book) {
        const book = viewEl.book;
        const metadata = book.metadata || {};

        if (!bookTitle) {
          bookTitle = typeof metadata.title === 'string' ? metadata.title : metadata.title?.name || '';
        }
        if (!bookAuthor) {
          const rawAuthor = metadata.author || metadata.creator;
          if (typeof rawAuthor === 'string') {
            bookAuthor = rawAuthor;
          } else if (Array.isArray(rawAuthor)) {
            bookAuthor = rawAuthor.map((a) => (typeof a === 'string' ? a : a?.name || '')).filter(Boolean).join(', ');
          } else if (typeof rawAuthor === 'object' && rawAuthor !== null) {
            bookAuthor = rawAuthor.name || rawAuthor.value || '';
          }
        }

        // 2. Extract section text directly from Foliate book parser
        if (targetHref && typeof book.resolveHref === 'function' && Array.isArray(book.sections)) {
          const resolved = book.resolveHref(targetHref);
          const targetIndex = resolved?.index ?? (typeof resolved === 'number' ? resolved : undefined);

          let targetSection: any = null;
          if (typeof targetIndex === 'number' && book.sections[targetIndex]) {
            targetSection = book.sections[targetIndex];
          } else if (resolved?.id) {
            targetSection = book.sections.find((s: any) => s.id === resolved.id || s.href === targetHref || targetHref.includes(s.id));
          } else {
            const cleanHref = targetHref.split('#')[0];
            targetSection = book.sections.find((s: any) => s.href === cleanHref || s.href === targetHref || s.id === cleanHref);
          }

          if (targetSection) {
            try {
              if (typeof targetSection.createDocument === 'function') {
                const doc = await targetSection.createDocument();
                sectionText = (doc?.body?.innerText || doc?.body?.textContent || '').trim();
              } else if (typeof targetSection.load === 'function') {
                const doc = await targetSection.load();
                sectionText = (doc?.body?.innerText || doc?.body?.textContent || '').trim();
              } else if (typeof targetSection.getText === 'function') {
                sectionText = await targetSection.getText();
              }
            } catch (secErr) {
              console.warn('Error loading target section document:', secErr);
            }
          }
        }

        // 3. Fallback to active document innerText in renderer shadowRoot if not loaded directly
        if (!sectionText) {
          const activeIframe = viewEl?.renderer?.shadowRoot?.querySelector('iframe') || viewEl?.shadowRoot?.querySelector('iframe') || document.querySelector('foliate-view')?.shadowRoot?.querySelector('iframe');
          const activeDoc = activeIframe?.contentDocument;
          if (activeDoc?.body) {
            sectionText = (activeDoc.body.innerText || activeDoc.body.textContent || '').trim();
          }
        }
      }

      if (!sectionText) {
        alert('Could not extract chapter text. Please navigate to this chapter first.');
        setIsGenerating(false);
        return;
      }

      // Clean out previous "KEY INSIGHTS" blocks from extracted text if regenerating
      const cleanSectionText = sectionText
        .replace(/KEY INSIGHTS[\s\S]*?(?=(?:Chapter|\n\s*\n[A-Z]|$))/gi, '')
        .trim() || sectionText;

      // Generate structured summaries by headers with Gemini AI
      const summaries = await GeminiAIService.summarizeChapterByHeaders(
        chapterLabel,
        cleanSectionText,
        bookTitle,
        settings?.geminiApiKey
      );

      if (summaries.length === 0) {
        throw new Error('No summaries generated.');
      }

      // 1. Save to Dexie database for fast retrieval & synchronization
      const summaryRecordId = `${bookId || 'unknown'}_${targetHref || chapterLabel}`;
      await db.chapterSummaries.put({
        id: summaryRecordId,
        bookId: bookId || '',
        href: targetHref || '',
        chapterTitle: chapterLabel,
        summaries,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // 2. Inject summaries directly into the EPUB file in OPFS (permanent, CFI-safe)
      let epubInjected = false;
      if (bookId && targetHref) {
        try {
          const { EPUBSummaryInjectorService } = await import('@/src/services/epubSummaryInjectorService');
          epubInjected = await EPUBSummaryInjectorService.injectSummariesIntoEPUB(bookId, targetHref, summaries);
        } catch (epubErr) {
          console.warn('EPUB file injection warning (will fall back to DOM):', epubErr);
        }
      }

      // 3. Reload the book if EPUB was modified (so CFIs are recalculated from the new DOM)
      //    Otherwise fall back to live DOM injection for the current session
      if (epubInjected) {
        // Full remount of FoliateViewer with the updated EPUB — CFI will be valid from the start
        window.dispatchEvent(new CustomEvent('velvet:reload-book'));
      } else {
        // Fallback: live DOM injection for this session only (no OPFS write)
        try {
          const activeIframe = viewEl?.renderer?.shadowRoot?.querySelector('iframe') || viewEl?.shadowRoot?.querySelector('iframe') || document.querySelector('foliate-view')?.shadowRoot?.querySelector('iframe');
          const activeDoc = activeIframe?.contentDocument;
          if (activeDoc) {
            const { EPUBSummaryInjectorService } = await import('@/src/services/epubSummaryInjectorService');
            EPUBSummaryInjectorService.injectSummariesIntoDOM(activeDoc, summaries);
          }
        } catch (domErr) {
          console.warn('Direct DOM injection fallback warning:', domErr);
        }
        window.dispatchEvent(new CustomEvent('velvet:summaries-updated', { detail: { bookId, href: targetHref } }));
      }

      // 4. Trigger cloud sync
      if (bookId) {
        SupabaseSyncService.triggerAutoSync(3000);
      }

      setHasGenerated(true);
      setTimeout(() => setHasGenerated(false), 3000);
    } catch (err: any) {
      console.error('Failed to generate AI Chapter Summary:', err);
      alert(err.message || 'Failed to generate chapter summary. Please check your Gemini API key in settings.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div ref={nodeRef} className="flex flex-col">
      <div
        onClick={() => {
          if (item.href || item.cfi) {
            onNavigate(item.href || item.cfi);
          } else if (hasSubitems) {
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors group cursor-pointer ${
          isActive
            ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] font-medium border border-[var(--accent-color)]/30'
            : 'hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-transparent'
        }`}
        style={{ paddingLeft: `${Math.max(8, depth * 12 + 8)}px` }}
      >
        <div className="flex-1 flex items-center gap-1.5 min-w-0 pr-1 pointer-events-none">
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] shrink-0" />
          )}
          <span
            className={`truncate ${
              depth === 0
                ? 'font-medium text-[13px]'
                : 'font-medium text-[12px]'
            } ${
              isActive
                ? 'text-[var(--accent-color)] font-semibold'
                : depth === 0
                ? 'text-[var(--text-primary)] group-hover:text-[var(--accent-color)]'
                : 'text-[var(--text-primary)]/85 group-hover:text-[var(--accent-color)]'
            }`}
          >
            {item.label || item.title || 'Untitled Chapter'}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {/* AI Generate Summary Button */}
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerateSummary}
            className={`w-7 h-7 sm:w-6 sm:h-6 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 ${
              isGenerating
                ? 'opacity-100 text-[var(--accent-color)] bg-[var(--accent-subtle)] animate-pulse'
                : hasGenerated
                ? 'bg-emerald-500/15 text-emerald-500 opacity-100'
                : 'opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-color)] text-[var(--text-muted)] hover:opacity-100 active:scale-95'
            }`}
            title={
              isGenerating
                ? 'Generating summaries for headers...'
                : hasGenerated
                ? 'Summaries generated & inserted!'
                : 'Generate summaries for each section header'
            }
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-color)]" />
            ) : hasGenerated ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in-50" />
            ) : (
              <Bot className="w-3.5 h-3.5" />
            )}
          </button>

          {hasSubitems && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
              className="w-7 h-7 sm:w-6 sm:h-6 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shrink-0 cursor-pointer flex items-center justify-center active:scale-95"
              title={isOpen ? 'Collapse' : 'Expand'}
            >
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {hasSubitems && isOpen && (
        <div className="space-y-0.5 border-l border-[var(--border-color)]/60 ml-3.5 pl-1">
          {item.subitems.map((sub: any, subIdx: number) => (
            <TOCItemNode
              key={subIdx}
              item={sub}
              bookId={bookId}
              depth={depth + 1}
              currentChapterTitle={currentChapterTitle}
              currentSectionHref={currentSectionHref}
              currentCfi={currentCfi}
              settings={settings}
              onNavigate={onNavigate}
              onClose={onClose}
              onOpenSettings={onOpenSettings}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface NavigationDrawerProps {
  bookId: string;
  currentCfi?: string;
  currentChapterTitle?: string;
  currentSectionHref?: string;
  tocList: any[];
  notes: INote[];
  comments: IComment[];
  settings?: Partial<IReaderSettings>;
  onNavigate: (cfiOrHref: string) => void;
  onExportNotes?: () => void;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  bookId,
  currentCfi,
  currentChapterTitle,
  currentSectionHref,
  tocList,
  notes,
  comments,
  settings,
  onNavigate,
  onExportNotes,
  onClose,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'toc' | 'notes' | 'comments'>('toc');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Close when clicking outside of the drawer
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('[data-sidebar-toggle]')) return;
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    // Also attach to reader iframe if active
    const iframe = document.querySelector('foliate-view')?.shadowRoot?.querySelector('iframe');
    const iframeDoc = iframe?.contentDocument;
    if (iframeDoc) {
      iframeDoc.addEventListener('mousedown', handleOutsideClick);
      iframeDoc.addEventListener('touchstart', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      if (iframeDoc) {
        iframeDoc.removeEventListener('mousedown', handleOutsideClick);
        iframeDoc.removeEventListener('touchstart', handleOutsideClick);
      }
    };
  }, [onClose]);

  // Helper to insert formatting markdown
  const insertFormatting = (
    prefix: string,
    suffix: string = '',
    defaultText: string = '',
    textarea: HTMLTextAreaElement | null
  ) => {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.substring(start, end) || defaultText;

    const replacement = `${prefix}${selected}${suffix}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    // Update state depending on create vs edit
    if (editingNoteId) {
      handleUpdateNote(editingNoteId, newValue);
    } else {
      setNewNoteContent(newValue);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  // Smart bullet and numbered list handler on KeyDown
  const handleEditorKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    content: string,
    setContent: (val: string) => void,
    noteId?: string
  ) => {
    const textarea = e.currentTarget;
    const cursor = textarea.selectionStart;

    if (e.key === 'Enter') {
      const lineStart = content.lastIndexOf('\n', cursor - 1) + 1;
      const currentLine = content.substring(lineStart, cursor);

      // Check for bullet list '- ' or '• '
      const bulletMatch = currentLine.match(/^(\s*[-•]\s+)/);
      if (bulletMatch) {
        e.preventDefault();
        const prefix = bulletMatch[1];
        // If line only contains the bullet, clear it (exit list)
        if (currentLine.trim() === '-' || currentLine.trim() === '•') {
          const updated = content.substring(0, lineStart) + content.substring(cursor);
          setContent(updated);
          if (noteId) handleUpdateNote(noteId, updated);
        } else {
          const updated = content.substring(0, cursor) + '\n' + prefix + content.substring(cursor);
          setContent(updated);
          if (noteId) handleUpdateNote(noteId, updated);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = cursor + 1 + prefix.length;
          }, 0);
        }
        return;
      }

      // Check for numbered list '1. '
      const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+/);
      if (numberMatch) {
        e.preventDefault();
        const indent = numberMatch[1];
        const currentNum = parseInt(numberMatch[2], 10);
        // If empty numbered line, exit list
        if (currentLine.trim() === `${currentNum}.`) {
          const updated = content.substring(0, lineStart) + content.substring(cursor);
          setContent(updated);
          if (noteId) handleUpdateNote(noteId, updated);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
          return;
        }
        const nextPrefix = `${indent}${currentNum + 1}. `;
        const updated = content.substring(0, cursor) + '\n' + nextPrefix + content.substring(cursor);
        setContent(updated);
        if (noteId) handleUpdateNote(noteId, updated);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = cursor + 1 + nextPrefix.length;
        }, 0);
        return;
      }
    }
  };

  // Smart typing text change (converts "- " to bullet if typed at line start)
  const handleContentChange = (
    val: string,
    setContent: (v: string) => void,
    noteId?: string
  ) => {
    setContent(val);
    if (noteId) {
      handleUpdateNote(noteId, val);
    }
  };

  const handleSaveNewNote = async () => {
    if (!newNoteContent.trim()) {
      setIsCreatingNew(false);
      return;
    }
    await NoteService.addNote(bookId, newNoteContent.trim(), currentChapterTitle);
    setNewNoteContent('');
    setIsCreatingNew(false);
  };

  const handleUpdateNote = async (id: string, content: string) => {
    await NoteService.updateNote(id, content);
  };

  const handleDeleteNote = async (id: string) => {
    await NoteService.deleteNote(id);
    if (editingNoteId === id) setEditingNoteId(null);
  };

  const handleUpdateComment = async (id: string, newText: string) => {
    if (!newText.trim()) return;
    await db.comments.update(id, { comment: newText.trim(), updatedAt: Date.now() });
    SupabaseSyncService.triggerAutoSync(20000);
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleDeleteComment = async (id: string) => {
    const { TombstoneService } = await import('@/src/services/tombstoneService');
    await TombstoneService.recordTombstone(id, 'comment');
    await db.comments.delete(id);
    SupabaseSyncService.triggerAutoSync(15000);
    if (editingCommentId === id) setEditingCommentId(null);
  };

  return (
    <aside
      ref={drawerRef}
      className="fixed left-0 top-0 bottom-0 w-84 bg-[var(--bg-surface)]/95 backdrop-blur-2xl border-r border-[var(--border-color)] shadow-2xl z-50 flex flex-col animate-in slide-in-from-left duration-200 select-none"
    >
      {/* Unified Compact Sidebar Header (Matching h-14 Height with Main Topbar) */}
      <div className="header-safe px-2.5 sm:px-3 flex items-center justify-between gap-1 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0">
        {/* Segmented 3-in-1 Tabs Switcher */}
        <div className="flex-1 flex items-center bg-[var(--bg-secondary)] p-0.5 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('toc')}
            className={`flex-1 py-1.5 px-1.5 sm:px-2 rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'toc'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Table of Contents"
          >
            <List className="w-3.5 h-3.5 shrink-0" />
            <span>TOC</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-1.5 px-1.5 sm:px-2 rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'notes'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Notes"
          >
            <StickyNote className="w-3.5 h-3.5 shrink-0" />
            <span>Notes</span>
            <span className="text-[10px] opacity-70">({notes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`flex-1 py-1.5 px-1.5 sm:px-2 rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'comments'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Comments & Annotations"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline sm:inline">Comments</span>
            <span className="xs:hidden sm:hidden">Comm</span>
            <span className="text-[10px] opacity-70">({comments.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* 1. Table of Contents (Hierarchical Tree View) */}
        {activeTab === 'toc' && (
          <div className="space-y-0.5">
            {tocList && tocList.length > 0 ? (
              tocList.map((item, idx) => (
                <TOCItemNode
                  key={idx}
                  item={item}
                  bookId={bookId}
                  depth={0}
                  currentChapterTitle={currentChapterTitle}
                  currentSectionHref={currentSectionHref}
                  currentCfi={currentCfi}
                  settings={settings}
                  onNavigate={onNavigate}
                  onClose={onClose}
                  onOpenSettings={onOpenSettings}
                />
              ))
            ) : (
              <p className="text-xs text-[var(--text-muted)] text-center py-8">
                Table of contents is empty
              </p>
            )}
          </div>
        )}

        {/* 2. Rich In-Panel Notes */}
        {activeTab === 'notes' && (
          <div className="space-y-3">
            {/* Action Bar: Add Note & Export */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsCreatingNew(true);
                  setEditingNoteId(null);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-[var(--accent-color)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Note</span>
              </button>

              {notes.length > 0 && onExportNotes && (
                <button
                  onClick={onExportNotes}
                  className="p-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                  title="Export Notes to Markdown"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Note Creation Editor */}
            {isCreatingNew && (
              <div className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--accent-color)] shadow-md space-y-2 animate-in fade-in duration-150">
                {/* Mini Formatting Toolbar */}
                <div className="flex items-center gap-1 pb-1 border-b border-[var(--border-color)] text-[var(--text-secondary)]">
                  <button
                    type="button"
                    onClick={() => insertFormatting('**', '**', 'bold text', textareaRef.current)}
                    className="p-1 rounded hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-all"
                    title="Bold (**text**)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('*', '*', 'italic text', textareaRef.current)}
                    className="p-1 rounded hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-all"
                    title="Italic (*text*)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('- ', '', '', textareaRef.current)}
                    className="p-1 rounded hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-all"
                    title="Bullet List (- item)"
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting('1. ', '', '', textareaRef.current)}
                    className="p-1 rounded hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-all"
                    title="Numbered List (1. item)"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                  </button>
                  {currentChapterTitle && (
                    <span className="ml-auto text-[10px] text-[var(--accent-color)] font-medium truncate max-w-[120px]">
                      {currentChapterTitle}
                    </span>
                  )}
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={newNoteContent}
                  onChange={(e) => handleContentChange(e.target.value, setNewNoteContent)}
                  onKeyDown={(e) => handleEditorKeyDown(e, newNoteContent, setNewNoteContent)}
                  placeholder="Write your note here... (- for bullet, 1. for number, **bold**, *italic*)"
                  className="w-full h-28 bg-transparent text-xs text-[var(--text-primary)] resize-none focus:outline-none placeholder:text-[var(--text-muted)] font-sans leading-relaxed"
                />

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border-color)]">
                  <button
                    onClick={() => {
                      setIsCreatingNew(false);
                      setNewNoteContent('');
                    }}
                    className="px-3 py-1 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNewNote}
                    className="px-3.5 py-1 rounded-lg bg-[var(--accent-color)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Notes List */}
            {notes.length > 0 ? (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/50 transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[var(--accent-color)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded-full truncate max-w-[180px]">
                      {n.chapterTitle || 'General Note'}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(n.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <button
                        onClick={() => handleDeleteNote(n.id)}
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-500 transition-all p-1 cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Note Editor / Display */}
                  {editingNoteId === n.id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 pb-1 border-b border-[var(--border-color)] text-[var(--text-secondary)]">
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`edit-note-${n.id}`) as HTMLTextAreaElement;
                            insertFormatting('**', '**', 'bold', el);
                          }}
                          className="p-1 rounded hover:bg-[var(--bg-surface)]"
                          title="Bold"
                        >
                          <Bold className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`edit-note-${n.id}`) as HTMLTextAreaElement;
                            insertFormatting('*', '*', 'italic', el);
                          }}
                          className="p-1 rounded hover:bg-[var(--bg-surface)]"
                          title="Italic"
                        >
                          <Italic className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`edit-note-${n.id}`) as HTMLTextAreaElement;
                            insertFormatting('- ', '', '', el);
                          }}
                          className="p-1 rounded hover:bg-[var(--bg-surface)]"
                          title="Bullet"
                        >
                          <ListIcon className="w-3 h-3" />
                        </button>
                      </div>
                      <textarea
                        id={`edit-note-${n.id}`}
                        autoFocus
                        defaultValue={n.content}
                        onChange={(e) => handleContentChange(e.target.value, () => {}, n.id)}
                        onKeyDown={(e) => {
                          const currentVal = (e.target as HTMLTextAreaElement).value;
                          handleEditorKeyDown(e, currentVal, (updated) => {
                            (e.target as HTMLTextAreaElement).value = updated;
                          }, n.id);
                        }}
                        className="w-full h-24 bg-transparent text-xs text-[var(--text-primary)] resize-none focus:outline-none font-sans leading-relaxed"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="px-2.5 py-0.5 rounded bg-[var(--accent-color)] text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingNoteId(n.id)}
                      className="text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed cursor-text hover:bg-[var(--bg-surface)]/50 p-1.5 rounded-lg transition-colors font-sans"
                    >
                      {n.content}
                    </div>
                  )}
                </div>
              ))
            ) : (
              !isCreatingNew && (
                <div className="text-center py-8 space-y-2">
                  <StickyNote className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-40" />
                  <p className="text-xs text-[var(--text-muted)]">No notes recorded yet.</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Click &quot;New Note&quot; to write your thoughts directly!
                  </p>
                </div>
              )
            )}
          </div>
        )}

        {/* 3. Comments & Annotations */}
        {activeTab === 'comments' && (
          <div className="space-y-2">
            {comments.length > 0 ? (
              comments.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/50 transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[var(--accent-color)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded-full truncate max-w-[170px]">
                      {c.chapterTitle || 'Comment'}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(c.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {editingCommentId !== c.id && (
                        <button
                          onClick={() => {
                            setEditingCommentId(c.id);
                            setEditingCommentText(c.comment);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-color)] transition-all p-1 cursor-pointer"
                          title="Edit comment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-500 transition-all p-1 cursor-pointer"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quoted Selected Text */}
                  <blockquote className="text-[11px] text-[var(--text-secondary)] italic border-l-2 border-[var(--accent-color)] pl-2 line-clamp-2">
                    &ldquo;{c.selectedText}&rdquo;
                  </blockquote>

                  {/* Comment Body / Editor */}
                  {editingCommentId === c.id ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        autoFocus
                        rows={3}
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleUpdateComment(c.id, editingCommentText);
                          }
                        }}
                        className="w-full text-xs p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:outline-none text-[var(--text-primary)] resize-none font-sans"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditingCommentText('');
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdateComment(c.id, editingCommentText)}
                          disabled={!editingCommentText.trim()}
                          className="px-3 py-1 rounded-lg bg-[var(--accent-color)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] transition-all cursor-pointer disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setEditingCommentId(c.id);
                        setEditingCommentText(c.comment);
                      }}
                      className="text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed cursor-text hover:bg-[var(--bg-surface)]/50 p-1.5 rounded-lg transition-colors"
                    >
                      {c.comment}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 space-y-2">
                <MessageSquare className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-40" />
                <p className="text-xs text-[var(--text-muted)]">No comments recorded yet.</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Select text & click the comment icon to attach notes to passages!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
