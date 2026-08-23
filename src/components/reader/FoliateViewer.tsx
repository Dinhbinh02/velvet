import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BookService } from '@/src/services/bookService';
import { db } from '@/src/db/schema';
import type { IReaderSettings } from '@/src/types/book';
import { DEFAULT_SETTINGS } from '@/src/hooks/useReaderSettings';
import { Loader2, Bot, Highlighter, Trash2, Edit2, MessageSquare, Check, X, Volume2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { TTSService } from '@/src/services/ttsService';
import { SupabaseSyncService } from '@/src/services/supabaseSyncService';

// Import foliate-view web component
import 'foliate-js/view.js';

// Comprehensive Theme Palette Map (Single Source of Truth - E-Ink Standard)
const THEME_PALETTES: Record<string, { text: string; bg: string }> = {
  light: { text: '#000000', bg: '#FFFFFF' },
  dark: { text: '#FFFFFF', bg: '#000000' },
  sepia: { text: '#1A1A1A', bg: '#F4ECD8' },
  amoled: { text: '#FFFFFF', bg: '#000000' },
  nord: { text: '#ECEFF4', bg: '#2E3440' },
  paper: { text: '#000000', bg: '#F2F2F2' },
};

interface FoliateViewerProps {
  bookId: string;
  theme: string;
  settings?: Partial<IReaderSettings>;
  isTTSActive?: boolean;
  onLocationChange?: (info: {
    cfi: string;
    percentage: number;
    chapterTitle?: string;
    sectionIndex: number;
    sectionHref?: string;
  }) => void;
  onTOCLoaded?: (toc: any[]) => void;
  onWordClick?: (word: string, contextSection: string) => void;
  onOpenSettings?: () => void;
}

export interface FoliateViewerRef {
  next: () => void;
  prev: () => void;
  goTo: (target: string) => void;
}

export const FoliateViewer: React.FC<FoliateViewerProps & { ref?: React.Ref<FoliateViewerRef> }> = ({
  bookId,
  theme,
  settings,
  isTTSActive = false,
  onLocationChange,
  onTOCLoaded,
  onWordClick,
  onOpenSettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flat TOC items list ref for precise chapter navigation
  const flatTOCListRef = useRef<Array<{ label: string; href: string; cfi?: string }>>([]);
  const currentTOCIndexRef = useRef<number>(0);
  
  // Floating Selection Action Tooltip State
  const [floatingTooltip, setFloatingTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    modalY?: number;
    placement?: 'top' | 'bottom';
    range?: Range | null;
    text: string;
    contextText: string;
    isHighlighted?: boolean;
    highlightEl?: HTMLElement | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    modalY: 0,
    placement: 'top',
    range: null,
    text: '',
    contextText: '',
    isHighlighted: false,
    highlightEl: null,
  });

  // Inline / Floating Comment Input Modal State
  const [commentModal, setCommentModal] = useState<{
    visible: boolean;
    x: number;
    y: number;
    placement?: 'top' | 'bottom';
    targetRange?: Range | null;
    selectedText: string;
    commentText: string;
    saved?: boolean;
  }>({
    visible: false,
    x: 0,
    y: 0,
    placement: 'top',
    targetRange: null,
    selectedText: '',
    commentText: '',
  });

  const floatingTooltipDomRef = useRef<HTMLDivElement>(null);
  const floatingTooltipRef = useRef(floatingTooltip);
  useEffect(() => {
    floatingTooltipRef.current = floatingTooltip;
  }, [floatingTooltip]);

  const commentModalRef = useRef(commentModal);
  useEffect(() => {
    commentModalRef.current = commentModal;
  }, [commentModal]);

  // Google Docs style Comment Hover Card State
  const [hoveredComment, setHoveredComment] = useState<{
    visible: boolean;
    x: number;
    y: number;
    placement?: 'top' | 'bottom';
    selectedText: string;
    comment: string;
    createdAt: number;
    id: string;
    isEditing?: boolean;
    editCommentText?: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    placement: 'top',
    selectedText: '',
    comment: '',
    createdAt: 0,
    id: '',
    isEditing: false,
    editCommentText: '',
  });

  const commentModalDomRef = useRef<HTMLDivElement>(null);
  const hoveredCommentDomRef = useRef<HTMLDivElement>(null);
  const hoverCommentTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Map of comment ID -> { range: Range, comment: IComment } for Chrome CSS Custom Highlight API
  const commentRangesMapRef = useRef<Map<string, { range: Range; comment: any }>>(new Map());

  // Global click-outside listener to automatically dismiss comment modal
  useEffect(() => {
    const handleGlobalPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!commentModalRef.current.visible) return;
      const target = e.target as Node | null;
      if (commentModalDomRef.current && target && !commentModalDomRef.current.contains(target)) {
        setCommentModal((prev) => ({ ...prev, visible: false }));
      }
    };

    window.addEventListener('mousedown', handleGlobalPointerDown);
    return () => {
      window.removeEventListener('mousedown', handleGlobalPointerDown);
    };
  }, []);

  // Live query custom fonts from IndexedDB
  const customFonts = useLiveQuery(() => db.customFonts.toArray(), []) || [];

  // Debounce helper for saving progress
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track current sectionIndex in ref for chapter navigation
  const currentSectionIndexRef = useRef<number>(0);

  // Track active loaded iframe document
  const currentDocRef = useRef<Document | null>(null);

  // Track TTS active state in ref to avoid stale closure in doc click listener
  const isTTSActiveRef = useRef(isTTSActive);
  isTTSActiveRef.current = isTTSActive;

  // Track onWordClick in ref to avoid stale closure
  const onWordClickRef = useRef(onWordClick);
  onWordClickRef.current = onWordClick;

  const onOpenSettingsRef = useRef(onOpenSettings);
  onOpenSettingsRef.current = onOpenSettings;

  // Track recent highlight operations for Undo (Cmd+Z / Ctrl+Z)
  const highlightHistoryRef = useRef<Array<{ span?: HTMLElement; range?: Range; noteId: string }>>([]);

  const undoLastHighlight = useCallback(async () => {
    const lastItem = highlightHistoryRef.current.pop();
    if (!lastItem) return;

    try {
      const { span, range, noteId } = lastItem;
      // 1. Remove span from DOM if still present (DOM fallback mode)
      if (span && span.parentNode) {
        const parent = span.parentNode;
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
        parent.normalize();
      }

      // 2. Remove range from Chrome CSS Custom Highlight registry if present
      const doc = currentDocRef.current;
      const docWin = doc?.defaultView || window;
      const hlRegistry = (docWin as any).CSS?.highlights || (window as any).CSS?.highlights;
      if (hlRegistry && range) {
        try {
          const existingHl = hlRegistry.get('velvet-highlight');
          if (existingHl) {
            existingHl.delete(range);
          }
        } catch {}
      }

      // 3. Delete corresponding highlight from Dexie & record tombstone
      if (noteId) {
        const { TombstoneService } = await import('@/src/services/tombstoneService');
        await TombstoneService.recordTombstone(noteId, 'highlight');
        await db.highlights.delete(noteId);
        SupabaseSyncService.triggerAutoSync(15000);
      }

      // Dismiss floating tooltip if visible
      setFloatingTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    } catch (err) {
      console.warn('Undo highlight failed:', err);
    }
  }, []);

  // Always-fresh ref to getInjectedStyles — avoids stale closures in load event listener
  const getInjectedStylesRef = useRef<(() => string) | null>(null);

  // Theme & layout CSS injector
  const getInjectedStyles = useCallback(() => {
    const {
      fontFamily = DEFAULT_SETTINGS.fontFamily,
      fontSize = DEFAULT_SETTINGS.fontSize,
      lineHeight = DEFAULT_SETTINGS.lineHeight,
      textAlign = DEFAULT_SETTINGS.textAlign,
    } = settings || {};

    // Generate @font-face rules for all imported custom fonts with accurate weights and styles
    const customFontFaceRules = (customFonts || [])
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

    const palette = THEME_PALETTES[theme] || THEME_PALETTES.paper;
    const textColor = palette.text;
    const bgColor = palette.bg;

    const localFontsCssUrl = '/fonts/fonts.css';

    return `
      @import url('${localFontsCssUrl}');

      ${customFontFaceRules}

      html {
        font-family: ${fontFamily} !important;
        font-size: ${fontSize}px !important;
        line-height: ${lineHeight} !important;
        color: ${textColor} !important;
        background-color: ${bgColor} !important;
        box-sizing: border-box !important;
        padding: 0 !important;
        margin: 0 !important;
        scroll-padding-top: 1.5rem !important;
        text-rendering: optimizeLegibility !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
      }
      body {
        font-family: inherit !important;
        font-size: inherit !important;
        line-height: inherit !important;
        text-align: ${textAlign} !important;
        color: inherit !important;
        background-color: transparent !important;
        box-sizing: border-box !important;
        max-width: 720px !important;
        margin: 0 auto !important;
        padding: 0 !important;
        letter-spacing: 0.01em;
        word-spacing: 0.02em;
      }
      /* Ensure CFI targets and elements scroll with 1.5rem top breathing room */
      *, h1, h2, h3, h4, h5, h6, p, div, span, section, article {
        scroll-margin-top: 1.5rem !important;
      }
      /* Main Reading Paragraphs & Text: Enforce user selected alignment across all elements */
      body, body *, p, p *, div, div *, section, section *, article, article *, li, li *, blockquote, blockquote * {
        text-align: ${textAlign} !important;
      }
      p, li, blockquote {
        font-family: ${fontFamily} !important;
        font-size: ${fontSize}px !important;
        line-height: ${lineHeight} !important;
        color: ${textColor} !important;
        letter-spacing: inherit;
        word-spacing: inherit;
      }
      p {
        margin-top: 0 !important;
        margin-bottom: 1.2rem !important;
        text-indent: 1.5em;
      }
      span, a, em, strong {
        color: inherit;
        font-family: inherit;
      }
      /* Small Caps, .small, <small> and Acronyms (e.g. AD, BC) Optical Weight & Size Balance */
      small, .small, [class*="small-caps"], [class*="smallcaps"], [class*="small"], abbr, acronym {
        font-weight: 500 !important;
        font-size: 0.9em !important;
        letter-spacing: 0.02em;
        opacity: 0.95;
      }
      /* Footnotes, Superscript & Subscript styling preservation */
      sup, [class*="footnote"], [class*="noteref"], a[href*="note"], a[href*="fn"] {
        font-size: 0.72em !important;
        line-height: 0 !important;
        position: relative !important;
        vertical-align: baseline !important;
        top: -0.45em !important;
      }
      sub {
        font-size: 0.72em !important;
        line-height: 0 !important;
        position: relative !important;
        vertical-align: baseline !important;
        bottom: -0.25em !important;
      }
      /* Do not override font-size on inline elements unless direct child of body/p */
      body > span, p span, li span, blockquote span, body > div, p div {
        font-size: inherit;
      }
      /* Keep sup and footnote links from expanding */
      p sup, li sup, blockquote sup, p a[href*="note"], p [class*="footnote"] {
        font-size: 0.72em !important;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
        margin: 1rem auto !important;
        display: block;
      }
      /* Headings & Subheadings Proportional Sizing (Both paginated & continuous) */
      h1, h2, h3, h4, h5, h6,
      h1 *, h2 *, h3 *, h4 *, h5 *, h6 *,
      .chapter, .chapter *, .subchapter, .subchapter * {
        font-family: ${fontFamily} !important;
        font-weight: 700 !important;
        color: ${textColor} !important;
        text-align: center !important;
        text-indent: 0 !important;
      }
      h1, .chapter, h1.chapter, h1.chapter * {
        font-size: ${Math.round(fontSize * 2.1)}px !important;
        line-height: 1.2 !important;
        margin-top: 2.5rem !important;
        margin-bottom: 1rem !important;
      }
      h1.subchapter, .subchapter, h1.subchapter *, .subchapter * {
        font-size: ${Math.round(fontSize * 1.75)}px !important;
        line-height: 1.25 !important;
        margin-top: 0.8rem !important;
        margin-bottom: 2rem !important;
      }
      h2, h2 * {
        font-size: ${Math.round(fontSize * 1.55)}px !important;
        line-height: 1.25 !important;
        margin-top: 2rem !important;
        margin-bottom: 0.9rem !important;
      }
      h3, h3 * {
        font-size: ${Math.round(fontSize * 1.35)}px !important;
        line-height: 1.3 !important;
        margin-top: 1.6rem !important;
        margin-bottom: 0.7rem !important;
      }
      /* Aggressive Figure & Caption Size Reduction */
      figure, figcaption,
      figure p, figure span, figure div,
      figcaption p, figcaption span,
      .caption, .caption p, .caption span,
      .figcaption, .figure-caption, .image-caption,
      [class*="caption"], [class*="caption"] p, [class*="caption"] span,
      [class*="fig"], [class*="fig"] p, [class*="fig"] span {
        font-size: ${Math.max(11, Math.round(fontSize * 0.72))}px !important;
        line-height: 1.4 !important;
        opacity: 0.85 !important;
        text-align: center !important;
        text-indent: 0 !important;
        font-weight: 600 !important;
      }
      figure {
        margin: 1.5rem auto !important;
        text-align: center !important;
      }
      ::-webkit-scrollbar {
        width: 3px !important;
        height: 3px !important;
      }
      ::-webkit-scrollbar-track {
        background: transparent !important;
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(130, 120, 110, 0.3) !important;
        border-radius: 9999px !important;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(130, 120, 110, 0.6) !important;
      }
      * {
        scrollbar-width: thin !important;
        scrollbar-color: rgba(130, 120, 110, 0.3) transparent !important;
      }
      /* Velvet Chapter AI Summary Card exact settings font size */
      .velvet-chapter-summary-card {
        font-family: ${fontFamily} !important;
        font-size: ${fontSize}px !important;
        line-height: ${lineHeight} !important;
        color: ${textColor} !important;
        box-sizing: border-box !important;
      }
      .velvet-chapter-summary-card div,
      .velvet-chapter-summary-card p,
      .velvet-chapter-summary-card li {
        font-family: ${fontFamily} !important;
        font-size: ${fontSize}px !important;
        line-height: ${lineHeight} !important;
        color: ${textColor} !important;
      }
      .velvet-chapter-summary-card .velvet-summary-badge {
        font-size: ${Math.max(12, Math.round(fontSize * 0.85))}px !important;
        line-height: 1.3 !important;
        font-weight: 700 !important;
        letter-spacing: 0.05em !important;
        text-transform: uppercase !important;
        opacity: 0.85 !important;
        margin-bottom: 8px !important;
      }
      /* Native Chrome CSS Custom Highlight API (::highlight) & DOM fallback */
      ::highlight(velvet-highlight) {
        background-color: ${settings?.highlightColor || '#fef08a'} !important;
        color: #1c1917 !important;
      }
      ::highlight(velvet-comment) {
        background-color: rgba(254, 240, 138, 0.4) !important;
        color: inherit !important;
        text-decoration: underline dashed rgba(202, 138, 4, 0.75) !important;
        text-underline-offset: 3px !important;
        text-decoration-thickness: 1px !important;
      }
      .velvet-user-highlight {
        background-color: ${settings?.highlightColor || '#fef08a'};
        color: #1c1917;
        border-radius: 3px;
        padding: 1px 2px;
        cursor: pointer;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
      }
      /* Google Docs style Comment & Annotation highlights (DOM fallback) */
      .velvet-user-comment {
        background-color: rgba(234, 179, 8, 0.22) !important;
        border-bottom: 2px dashed rgba(202, 138, 4, 0.8) !important;
        border-radius: 2px;
        padding: 3px 2px !important;
        cursor: pointer !important;
        transition: background-color 0.15s ease;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
      }
      .velvet-user-comment:hover {
        background-color: rgba(234, 179, 8, 0.42) !important;
        border-bottom: 2px solid rgba(202, 138, 4, 1) !important;
      }
      /* TTS Live Highlight Styles */
      .velvet-tts-sentence {
        transition: background-color 0.15s ease;
        border-radius: 4px;
        ${isTTSActive ? 'cursor: pointer;' : ''}
      }
      ${
        isTTSActive
          ? `
      .velvet-tts-sentence:hover {
        background-color: rgba(234, 88, 12, 0.08) !important;
      }
      `
          : ''
      }
      .velvet-tts-active-sentence {
        background-color: rgba(234, 88, 12, 0.28) !important;
        border-radius: 4px;
        box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.15);
      }
    `;
  }, [theme, settings, customFonts, isTTSActive]);

  // Keep the ref always pointing to the latest version (never stale inside event listeners)
  useEffect(() => {
    getInjectedStylesRef.current = getInjectedStyles;
  });

  // Apply styles & layout whenever theme, settings, or customFonts change
  const applySettingsToRenderer = useCallback(() => {
    const view = viewRef.current;
    if (!view?.renderer) return;

    const renderer = view.renderer;

    // 1. Inject custom typography & theme styles (including custom @font-face)
    const css = getInjectedStyles();
    if (renderer.setStyles) {
      renderer.setStyles(css);
    }

    // Direct update: update foliate-view and paginator background attribute/styles
    const palette = THEME_PALETTES[theme] || THEME_PALETTES.paper;
    const bgColor = palette.bg;

    try {
      if (renderer.shadowRoot) {
        const bgEl = renderer.shadowRoot.getElementById('background');
        if (bgEl) {
          bgEl.style.backgroundColor = bgColor;
        }
      }
    } catch {}

    // Direct update: if we have the current loaded doc ref, update its style immediately
    try {
      if (currentDocRef.current) {
        const idoc = currentDocRef.current;
        if (idoc.body) {
          idoc.body.style.backgroundColor = bgColor;
        }
        if (idoc.documentElement) {
          idoc.documentElement.style.backgroundColor = bgColor;
        }
        let docStyle = idoc.getElementById('velvet-injected-doc-style') as HTMLStyleElement | null;
        if (!docStyle) {
          docStyle = idoc.createElement('style');
          docStyle.id = 'velvet-injected-doc-style';
          (idoc.head || idoc.documentElement).appendChild(docStyle);
        }
        if (docStyle) {
          docStyle.textContent = css;
        }
      }
    } catch (e) {
      console.warn('Could not update currentDocRef styles:', e);
    }

    // 2. Set flow mode (paginated vs continuous scroll)
    const isContinuous = settings?.layoutMode === 'continuous';
    renderer.setAttribute('flow', isContinuous ? 'scrolled' : 'paginated');

    // 3. Margin & Gap
    renderer.setAttribute('margin', isContinuous ? '24px 0px' : '44px');
    renderer.setAttribute('gap', '6%');

    // 4. Set column count (1 col vs 2 col)
    if (!isContinuous) {
      const isOneCol = settings?.layoutMode === 'paginated-1col';
      renderer.setAttribute('max-column-count', isOneCol ? '1' : '2');
    }

    // 5. Max Inline Size (setting this triggers Paginator render)
    const maxInlineSize = settings?.maxWidth ? `${settings.maxWidth}px` : `${DEFAULT_SETTINGS.maxWidth}px`;
    renderer.setAttribute('max-inline-size', maxInlineSize);

    // Explicitly request renderer layout recalculation
    if (typeof renderer.render === 'function') {
      try {
        renderer.render();
      } catch {}
    }
  }, [getInjectedStyles, settings?.layoutMode, settings?.maxWidth, settings?.textAlign, theme]);

  // Update styles whenever settings, theme, or custom fonts are loaded/changed
  useEffect(() => {
    applySettingsToRenderer();
  }, [applySettingsToRenderer, customFonts]);

  // 2. Load Book and Initialize Foliate View
  useEffect(() => {
    let isMounted = true;
    const container = containerRef.current;
    if (!container) return;

    // Clear previous view
    container.innerHTML = '';
    setIsLoading(true);

    const view = document.createElement('foliate-view') as any;
    view.style.width = '100%';
    view.style.height = '100%';
    view.style.display = 'block';
    container.appendChild(view);
    viewRef.current = view;

    async function init() {
      try {
        const file = await BookService.getBookFile(bookId);
        if (!isMounted) return;

        // Apply initial renderer attributes before or immediately after opening
        applySettingsToRenderer();

        await view.open(file);
        if (!isMounted) return;

        // Re-apply styles and layout to ensure renderer layout is properly initialized
        applySettingsToRenderer();

        // Emit TOC and build flattened TOC array for exact Prev/Next chapter navigation
        if (view.book?.toc) {
          const flatten = (items: any[]): Array<{ label: string; href: string; cfi?: string }> => {
            let res: Array<{ label: string; href: string; cfi?: string }> = [];
            for (const it of items) {
              if (it.href || it.cfi) {
                res.push({
                  label: it.label || it.title || '',
                  href: it.href || '',
                  cfi: it.cfi,
                });
              }
              if (Array.isArray(it.subitems) && it.subitems.length > 0) {
                res = res.concat(flatten(it.subitems));
              }
            }
            return res;
          };
          flatTOCListRef.current = flatten(view.book.toc);
          onTOCLoaded?.(view.book.toc);
        }

        // Get saved progress from Dexie
        const progress = await db.progress.get(bookId);
        let navigated = false;

        if (progress?.cfi && progress.cfi.trim().length > 0) {
          try {
            await view.goTo(progress.cfi);
            navigated = true;
          } catch (e) {
            console.warn('Could not navigate to saved CFI, attempting fallback:', progress.cfi, e);
          }
        }

        // Fallback 1: if CFI navigation failed or no CFI, try sectionIndex
        if (!navigated && typeof progress?.sectionIndex === 'number' && progress.sectionIndex >= 0) {
          try {
            await view.goTo(progress.sectionIndex);
            navigated = true;
          } catch (e) {
            console.warn('Could not navigate to saved sectionIndex:', progress.sectionIndex, e);
          }
        }

        // Fallback 2: initialize view or go to start
        if (!navigated) {
          try {
            if (typeof view.init === 'function') {
              await view.init();
            } else {
              await view.goTo(0);
            }
          } catch (e) {
            console.warn('Initial view navigation fallback:', e);
            try {
              await view.goTo(0);
            } catch {}
          }
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('Error opening EPUB in Foliate:', err);
        if (isMounted) {
          setError('Book file not found in storage. Please re-import.');
          setIsLoading(false);
        }
      }
    }

    view.addEventListener('relocate', ({ detail }: any) => {
      const cfi = detail.cfi;
      const percentage = detail.fraction || 0;
      const sectionIndex = detail.index || 0;
      const chapterTitle = detail.tocItem?.label?.trim() || undefined;
      const sectionHref = detail.tocItem?.href || undefined;

      currentSectionIndexRef.current = sectionIndex;

      // Find current TOC index from flat list
      if (flatTOCListRef.current.length > 0) {
        const tocIdx = flatTOCListRef.current.findIndex((it) => {
          if (sectionHref && it.href) {
            const cleanA = sectionHref.split('#')[0];
            const cleanB = it.href.split('#')[0];
            if (cleanA === cleanB || sectionHref === it.href) return true;
          }
          if (chapterTitle && it.label) {
            const cleanA = chapterTitle.trim().toLowerCase();
            const cleanB = it.label.trim().toLowerCase();
            if (cleanA === cleanB) return true;
          }
          return false;
        });
        if (tocIdx !== -1) {
          currentTOCIndexRef.current = tocIdx;
        }
      }

      // Update continuous layout navigation footer with exact previous and next chapter titles
      if (settings?.layoutMode === 'continuous' && currentDocRef.current) {
        const doc = currentDocRef.current;
        const flatTOC = flatTOCListRef.current;
        const currentIdx = currentTOCIndexRef.current;

        const prevItem = flatTOC.length > 0 && currentIdx > 0 ? flatTOC[currentIdx - 1] : null;
        const nextItem = flatTOC.length > 0 && currentIdx < flatTOC.length - 1 ? flatTOC[currentIdx + 1] : null;

        const prevLabelEl = doc.querySelector('.velvet-chapter-nav-prev-label') as HTMLElement | null;
        const nextLabelEl = doc.querySelector('.velvet-chapter-nav-next-label') as HTMLElement | null;
        const prevBtn = doc.querySelector('.velvet-chapter-nav-prev-btn') as HTMLElement | null;
        const nextBtn = doc.querySelector('.velvet-chapter-nav-next-btn') as HTMLElement | null;

        if (prevLabelEl && prevBtn) {
          const prevLabel = prevItem?.label ? prevItem.label.trim() : 'Previous';
          prevLabelEl.textContent = prevLabel;
          prevBtn.title = prevLabel;
        }
        if (nextLabelEl && nextBtn) {
          const nextLabel = nextItem?.label ? nextItem.label.trim() : 'Next';
          nextLabelEl.textContent = nextLabel;
          nextBtn.title = nextLabel;
        }
      }

      onLocationChange?.({ cfi, percentage, chapterTitle, sectionIndex, sectionHref });

      // Debounce saving progress to Dexie
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        BookService.updateProgress(bookId, {
          cfi,
          percentage,
          sectionIndex,
          chapterTitle,
          sectionHref,
        });
      }, 300);
    });

    view.addEventListener('load', ({ detail }: any) => {
      const doc = detail?.doc;
      if (!doc) return;
      currentDocRef.current = doc;

      // Re-apply latest typography styles & layout to newly rendered document
      applySettingsToRenderer();

      // Restore saved highlights from Dexie for this book (using Chrome CSS Custom Highlight API + DOM span fallback)
      const restoreHighlights = async () => {
        try {
          const highlights = await db.highlights.where('bookId').equals(bookId).toArray();

          if (highlights.length === 0) return;

          const docWin = doc.defaultView || window;
          const supportsCssHighlight = typeof (docWin as any).CSS?.highlights !== 'undefined' || typeof (window as any).CSS?.highlights !== 'undefined';
          const highlightRanges: Range[] = [];

          highlights.forEach((h) => {
            const highlightText = h.text?.trim();
            const highlightColor = h.color || settings?.highlightColor || '#fef08a';

            if (!highlightText || highlightText.length < 2) return;

            // Search document text nodes and register occurrences
            const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
            let node: Node | null;
            while ((node = walker.nextNode())) {
              const nodeText = node.nodeValue || '';
              const matchIdx = nodeText.indexOf(highlightText);
              if (matchIdx !== -1) {
                try {
                  const range = doc.createRange();
                  range.setStart(node, matchIdx);
                  range.setEnd(node, matchIdx + highlightText.length);

                  if (supportsCssHighlight) {
                    highlightRanges.push(range);
                  } else if (node.parentElement && !node.parentElement.closest('.velvet-user-highlight')) {
                    const span = doc.createElement('span');
                    span.className = 'velvet-user-highlight';
                    span.style.backgroundColor = highlightColor;
                    span.style.color = '#1c1917';
                    span.style.borderRadius = '3px';
                    span.style.padding = '1px 2px';
                    span.style.cursor = 'pointer';
                    span.style.boxDecorationBreak = 'clone';
                    (span.style as any).webkitBoxDecorationBreak = 'clone';
                    span.setAttribute('data-note-id', h.id);

                    range.surroundContents(span);
                  }
                  break;
                } catch {}
              }
            }
          });

          // Register ranges into Chrome CSS Custom Highlight API
          if (supportsCssHighlight && highlightRanges.length > 0) {
            try {
              const HighlightConstructor = (docWin as any).Highlight || (window as any).Highlight;
              if (HighlightConstructor) {
                const customHl = new HighlightConstructor(...highlightRanges);
                const hlRegistry = (docWin as any).CSS?.highlights || (window as any).CSS?.highlights;
                hlRegistry?.set('velvet-highlight', customHl);
              }
            } catch (err) {
              console.warn('Chrome CSS.highlights registration failed:', err);
            }
          }
        } catch (e) {
          console.warn('Could not restore highlights:', e);
        }
      };
      restoreHighlights();

      // Restore saved comments from Dexie for this book (using Chrome CSS Custom Highlight API + DOM span fallback)
      const restoreComments = async () => {
        try {
          const comments = await db.comments.where('bookId').equals(bookId).toArray();
          if (comments.length === 0) return;

          const docWin = doc.defaultView || window;
          const supportsCssHighlight = typeof (docWin as any).CSS?.highlights !== 'undefined' || typeof (window as any).CSS?.highlights !== 'undefined';
          const commentRanges: Range[] = [];
          commentRangesMapRef.current.clear();

          comments.forEach((c) => {
            const commentText = c.selectedText?.trim();
            if (!commentText || commentText.length < 2) return;

            const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
            let node: Node | null;
            while ((node = walker.nextNode())) {
              const nodeText = node.nodeValue || '';
              const matchIdx = nodeText.indexOf(commentText);
              if (matchIdx !== -1) {
                try {
                  const range = doc.createRange();
                  range.setStart(node, matchIdx);
                  range.setEnd(node, matchIdx + commentText.length);

                  if (supportsCssHighlight) {
                    commentRanges.push(range);
                    commentRangesMapRef.current.set(c.id, { range, comment: c });
                  } else if (node.parentElement && !node.parentElement.closest('.velvet-user-comment')) {
                    const span = doc.createElement('span');
                    span.className = 'velvet-user-comment';
                    span.setAttribute('data-comment-id', c.id);
                    span.setAttribute('data-comment-text', c.comment);
                    span.setAttribute('data-comment-date', String(c.createdAt || Date.now()));

                    range.surroundContents(span);
                  }
                  break;
                } catch {}
              }
            }
          });

          // Register comment ranges into Chrome CSS Custom Highlight API (velvet-comment)
          if (supportsCssHighlight && commentRanges.length > 0) {
            try {
              const HighlightConstructor = (docWin as any).Highlight || (window as any).Highlight;
              if (HighlightConstructor) {
                const commentHl = new HighlightConstructor(...commentRanges);
                const hlRegistry = (docWin as any).CSS?.highlights || (window as any).CSS?.highlights;
                hlRegistry?.set('velvet-comment', commentHl);
              }
            } catch (err) {
              console.warn('Chrome CSS.highlights comment registration failed:', err);
            }
          }
        } catch (e) {
          console.warn('Could not restore comments:', e);
        }
      };
      restoreComments();

      // Extract readable sentences for TTS playback and attach click listener
      try {
        TTSService.extractSentencesFromDoc(doc);

        // Function to compute dynamic viewport-relative coordinates:
        // - Clamped at TOP so it never goes under the top header.
        // - Clamped at BOTTOM so it never clips or goes under the bottom edge/status bar.
        const computeCoordinates = (range: Range) => {
          const rect = range.getBoundingClientRect();
          const iframeEl = doc.defaultView?.frameElement as HTMLElement | null;
          const iframeRect = iframeEl?.getBoundingClientRect() || { top: 0, left: 0 };
          const containerRect = containerRef.current?.getBoundingClientRect() || { top: 0, left: 0, height: window.innerHeight };
          const containerHeight = containerRect.height || window.innerHeight;

          const absX = iframeRect.left + rect.left + rect.width / 2 - containerRect.left;
          // Actual top of the selected text block
          const rawTopY = iframeRect.top + rect.top - containerRect.top - 8;

          // Tooltip height is ~36px with -translate-y-full:
          // Top limit: min 42px (so top edge is >= 6px below header)
          // Bottom limit: max containerHeight - 12px (so tooltip stays visible above bottom edge)
          const tooltipY = Math.max(42, Math.min(containerHeight - 12, rawTopY));

          // Modal height is ~175px with -translate-y-full:
          // Top limit: min 185px (so top edge of modal is >= 10px below header)
          // Bottom limit: max containerHeight - 16px (so bottom edge stays above bottom bar)
          const modalY = Math.max(185, Math.min(containerHeight - 16, rawTopY));

          return {
            x: Math.max(165, Math.min(window.innerWidth - 165, absX)),
            y: tooltipY,
            modalY,
            placement: 'top' as const,
          };
        };

        // Extract context before and after the selected range (up to 4000 characters total)
        const extractSurroundingContext = (range: Range): string => {
          try {
            const maxCharsBefore = 2000;
            const maxCharsAfter = 2000;

            // 1. Text before selection
            let beforeText = '';
            try {
              const beforeRange = doc.createRange();
              beforeRange.setStart(doc.body || doc.documentElement, 0);
              beforeRange.setEnd(range.startContainer, range.startOffset);
              const fullBefore = beforeRange.toString();
              beforeText = fullBefore.slice(Math.max(0, fullBefore.length - maxCharsBefore));
            } catch {}

            // 2. Selected text
            const middleText = range.toString();

            // 3. Text after selection
            let afterText = '';
            try {
              const afterRange = doc.createRange();
              afterRange.setStart(range.endContainer, range.endOffset);
              const endNode = doc.body || doc.documentElement;
              afterRange.setEnd(endNode, endNode.childNodes.length);
              const fullAfter = afterRange.toString();
              afterText = fullAfter.slice(0, maxCharsAfter);
            } catch {}

            const combined = (beforeText + middleText + afterText).trim();
            if (combined) return combined;
          } catch {}

          // Fallback to body snippet
          return (doc.body?.innerText || doc.body?.textContent || '').slice(0, 4000).trim();
        };

        // Handle text selection in iframe -> show floating search tooltip button
        const handleSelectionCheck = () => {
          const selection = doc.getSelection();
          const selectedText = selection?.toString()?.trim() || '';

          if (selectedText && selectedText.length >= 1) {
            try {
              const range = selection?.getRangeAt(0);
              const rect = range?.getBoundingClientRect();

              if (rect && rect.width > 0) {
                // Check if selection is already inside an existing highlight
                const startContainer = range.startContainer;
                const highlightEl = (startContainer.nodeType === Node.TEXT_NODE
                  ? startContainer.parentElement?.closest('.velvet-user-highlight')
                  : (startContainer as HTMLElement)?.closest('.velvet-user-highlight')) as HTMLElement | null;

                const { x, y, modalY, placement } = computeCoordinates(range);
                const contextText = extractSurroundingContext(range);

                setFloatingTooltip({
                  visible: true,
                  x,
                  y,
                  modalY,
                  placement,
                  range,
                  text: selectedText,
                  contextText,
                  isHighlighted: !!highlightEl,
                  highlightEl,
                });
                return;
              }
            } catch {}
          }

          // If no selection or clicking elsewhere, dismiss tooltip
          setFloatingTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        };

        // Zero-lag scroll updater: updates both DOM directly in requestAnimationFrame for instant 60fps response, plus React state
        let scrollRafId: number | null = null;
        const handleDocScroll = () => {
          if (scrollRafId) cancelAnimationFrame(scrollRafId);
          scrollRafId = requestAnimationFrame(() => {
            // 1. Instant update for selection tooltip
            const activeRange = floatingTooltipRef.current.range || (doc.getSelection()?.rangeCount ? doc.getSelection()?.getRangeAt(0) : null);
            if (floatingTooltipRef.current.visible && activeRange) {
              try {
                const { x, y, modalY } = computeCoordinates(activeRange);
                if (floatingTooltipDomRef.current) {
                  floatingTooltipDomRef.current.style.left = `${x}px`;
                  floatingTooltipDomRef.current.style.top = `${y}px`;
                }
                setFloatingTooltip((prev) => (prev.visible ? { ...prev, x, y, modalY } : prev));
              } catch {}
            }

            // 2. Instant update for comment modal
            if (commentModalRef.current.visible && commentModalRef.current.targetRange) {
              try {
                const { x, modalY, placement } = computeCoordinates(commentModalRef.current.targetRange);
                if (commentModalDomRef.current) {
                  commentModalDomRef.current.style.left = `${Math.max(160, Math.min(window.innerWidth - 160, x))}px`;
                  commentModalDomRef.current.style.top = `${modalY}px`;
                }
                setCommentModal((prev) => ({
                  ...prev,
                  x,
                  y: modalY,
                  placement,
                }));
              } catch {}
            }
          });
        };

        // Attach scroll listeners everywhere inside and outside iframe/shadowRoot/window
        doc.addEventListener('scroll', handleDocScroll, { passive: true, capture: true });
        doc.defaultView?.addEventListener('scroll', handleDocScroll, { passive: true, capture: true });
        view.addEventListener('scroll', handleDocScroll, { passive: true, capture: true });
        window.addEventListener('scroll', handleDocScroll, { passive: true, capture: true });
        if (view.renderer) {
          view.renderer.addEventListener?.('scroll', handleDocScroll, { passive: true, capture: true });
          if (view.renderer.shadowRoot) {
            view.renderer.shadowRoot.addEventListener?.('scroll', handleDocScroll, { passive: true, capture: true });
            const scrollContainers = view.renderer.shadowRoot.querySelectorAll('*');
            scrollContainers.forEach((el: HTMLElement) => {
              el.addEventListener?.('scroll', handleDocScroll, { passive: true, capture: true });
            });
          }
        }

        // Dismiss comment modal if user clicks inside the book document
        doc.addEventListener('mousedown', () => {
          if (commentModalRef.current.visible) {
            setCommentModal((prev) => ({ ...prev, visible: false }));
          }
        });

        doc.addEventListener('mouseup', handleSelectionCheck);
        doc.addEventListener('selectionchange', () => {
          const sel = doc.getSelection()?.toString()?.trim();
          if (!sel) {
            setFloatingTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
          }
        });

        // Hover Card Listener for Google Docs style Comment Annotations
        doc.addEventListener('mousemove', (e: MouseEvent) => {
          const target = e.target as HTMLElement | null;

          // 1. Check DOM span (fallback)
          const commentSpan = target?.closest('.velvet-user-comment') as HTMLElement | null;
          if (commentSpan) {
            if (hoverCommentTimeoutRef.current) {
              clearTimeout(hoverCommentTimeoutRef.current);
              hoverCommentTimeoutRef.current = null;
            }

            const commentId = commentSpan.getAttribute('data-comment-id') || '';
            const commentText = commentSpan.getAttribute('data-comment-text') || '';
            const commentDateStr = commentSpan.getAttribute('data-comment-date') || '0';
            const commentDate = parseInt(commentDateStr, 10) || Date.now();
            const selectedText = (commentSpan.textContent || '').trim();

            const range = doc.createRange();
            range.selectNodeContents(commentSpan);
            const { x, modalY, placement } = computeCoordinates(range);

            if (hoveredCommentDomRef.current) {
              hoveredCommentDomRef.current.style.left = `${Math.max(160, Math.min(window.innerWidth - 160, x))}px`;
              hoveredCommentDomRef.current.style.top = `${modalY}px`;
            }

            setHoveredComment({
              visible: true,
              x,
              y: modalY,
              placement,
              selectedText,
              comment: commentText,
              createdAt: commentDate,
              id: commentId,
            });
            return;
          }

          // 2. Check Native Chrome CSS.highlights (velvet-comment)
          const docWin = doc.defaultView || window;
          const hlRegistry = (docWin as any).CSS?.highlights || (window as any).CSS?.highlights;
          const customCommentHl = hlRegistry?.get?.('velvet-comment');
          if (customCommentHl && customCommentHl.size > 0 && commentRangesMapRef.current.size > 0) {
            let pointRange: Range | null = null;
            if (typeof (doc as any).caretPositionFromPoint === 'function') {
              const pos = (doc as any).caretPositionFromPoint(e.clientX, e.clientY);
              if (pos?.offsetNode) {
                const r = doc.createRange();
                r.setStart(pos.offsetNode, pos.offset);
                r.setEnd(pos.offsetNode, pos.offset);
                pointRange = r;
              }
            } else if (typeof (doc as any).caretRangeFromPoint === 'function') {
              pointRange = (doc as any).caretRangeFromPoint(e.clientX, e.clientY);
            }

            if (pointRange) {
              for (const [cId, { range: savedRange, comment: cData }] of commentRangesMapRef.current.entries()) {
                try {
                  const cmpStart = savedRange.comparePoint(pointRange.startContainer, pointRange.startOffset);
                  const cmpEnd = savedRange.comparePoint(pointRange.endContainer, pointRange.endOffset);
                  if (cmpStart === 0 || cmpEnd === 0) {
                    if (hoverCommentTimeoutRef.current) {
                      clearTimeout(hoverCommentTimeoutRef.current);
                      hoverCommentTimeoutRef.current = null;
                    }

                    const { x, modalY, placement } = computeCoordinates(savedRange);
                    if (hoveredCommentDomRef.current) {
                      hoveredCommentDomRef.current.style.left = `${Math.max(160, Math.min(window.innerWidth - 160, x))}px`;
                      hoveredCommentDomRef.current.style.top = `${modalY}px`;
                    }

                    setHoveredComment({
                      visible: true,
                      x,
                      y: modalY,
                      placement,
                      selectedText: cData.selectedText || (savedRange.toString() || '').trim(),
                      comment: cData.comment,
                      createdAt: cData.createdAt,
                      id: cId,
                    });
                    return;
                  }
                } catch {}
              }
            }
          }

          // If not hovering any comment and card is visible, hide immediately (0ms)
          if (hoveredCommentDomRef.current) {
            setHoveredComment((prev) => (prev.visible ? { ...prev, visible: false } : prev));
          }
        });

        doc.addEventListener('click', (e: MouseEvent) => {
          const target = e.target as HTMLElement | null;

          // 0. If clicked directly on an existing DOM Comment span
          const clickedComment = target?.closest('.velvet-user-comment') as HTMLElement | null;
          if (clickedComment) {
            const commentId = clickedComment.getAttribute('data-comment-id') || '';
            const commentText = clickedComment.getAttribute('data-comment-text') || '';
            const commentDateStr = clickedComment.getAttribute('data-comment-date') || '0';
            const commentDate = parseInt(commentDateStr, 10) || Date.now();
            const selectedText = (clickedComment.textContent || '').trim();

            const range = doc.createRange();
            range.selectNodeContents(clickedComment);
            const { x, modalY, placement } = computeCoordinates(range);

            setHoveredComment({
              visible: true,
              x,
              y: modalY,
              placement,
              selectedText,
              comment: commentText,
              createdAt: commentDate,
              id: commentId,
            });
            return;
          }

          // 0.1 If clicked on a Native Chrome CSS.highlights comment (velvet-comment)
          const docWin = doc.defaultView || window;
          const hlRegistry = (docWin as any).CSS?.highlights || (window as any).CSS?.highlights;
          const customCommentHl = hlRegistry?.get?.('velvet-comment');
          if (customCommentHl && customCommentHl.size > 0 && commentRangesMapRef.current.size > 0) {
            let pointRange: Range | null = null;
            if (typeof (doc as any).caretPositionFromPoint === 'function') {
              const pos = (doc as any).caretPositionFromPoint(e.clientX, e.clientY);
              if (pos?.offsetNode) {
                const r = doc.createRange();
                r.setStart(pos.offsetNode, pos.offset);
                r.setEnd(pos.offsetNode, pos.offset);
                pointRange = r;
              }
            } else if (typeof (doc as any).caretRangeFromPoint === 'function') {
              pointRange = (doc as any).caretRangeFromPoint(e.clientX, e.clientY);
            }

            if (pointRange) {
              for (const [cId, { range: savedRange, comment: cData }] of commentRangesMapRef.current.entries()) {
                try {
                  const cmpStart = savedRange.comparePoint(pointRange.startContainer, pointRange.startOffset);
                  const cmpEnd = savedRange.comparePoint(pointRange.endContainer, pointRange.endOffset);
                  if (cmpStart === 0 || cmpEnd === 0) {
                    const { x, modalY, placement } = computeCoordinates(savedRange);
                    setHoveredComment({
                      visible: true,
                      x,
                      y: modalY,
                      placement,
                      selectedText: cData.selectedText || (savedRange.toString() || '').trim(),
                      comment: cData.comment,
                      createdAt: cData.createdAt,
                      id: cId,
                    });
                    return;
                  }
                } catch {}
              }
            }
          }

          // 1. If clicked directly on an existing DOM highlight span
          const clickedHighlight = target?.closest('.velvet-user-highlight') as HTMLElement | null;
          if (clickedHighlight) {
            const range = doc.createRange();
            range.selectNodeContents(clickedHighlight);
            const { x, y, placement } = computeCoordinates(range);
            const text = (clickedHighlight.textContent || '').trim();
            const contextText = extractSurroundingContext(range);

            setFloatingTooltip({
              visible: true,
              x,
              y,
              placement,
              range,
              text,
              contextText,
              isHighlighted: true,
              highlightEl: clickedHighlight,
            });
            return;
          }

          // 2. If clicked on a Native CSS.highlights range (Chrome / Chromium)
          const customHl = hlRegistry?.get?.('velvet-highlight');
          if (customHl && customHl.size > 0) {
            let clickRange: Range | null = null;
            if (typeof (doc as any).caretPositionFromPoint === 'function') {
              const pos = (doc as any).caretPositionFromPoint(e.clientX, e.clientY);
              if (pos?.offsetNode) {
                const r = doc.createRange();
                r.setStart(pos.offsetNode, pos.offset);
                r.setEnd(pos.offsetNode, pos.offset);
                clickRange = r;
              }
            } else if (typeof (doc as any).caretRangeFromPoint === 'function') {
              clickRange = (doc as any).caretRangeFromPoint(e.clientX, e.clientY);
            }

            if (clickRange) {
              for (const savedRange of customHl) {
                try {
                  const cmpStart = savedRange.comparePoint(clickRange.startContainer, clickRange.startOffset);
                  const cmpEnd = savedRange.comparePoint(clickRange.endContainer, clickRange.endOffset);
                  // If click point falls within the saved range
                  if (cmpStart === 0 || cmpEnd === 0) {
                    const { x, y, placement } = computeCoordinates(savedRange);
                    const text = (savedRange.toString() || '').trim();
                    const contextText = extractSurroundingContext(savedRange);

                    setFloatingTooltip({
                      visible: true,
                      x,
                      y,
                      placement,
                      range: savedRange,
                      text,
                      contextText,
                      isHighlighted: true,
                      highlightEl: null,
                    });
                    return;
                  }
                } catch {}
              }
            }
          }

          // If TTS is active, prioritize playing the clicked sentence
          if (isTTSActiveRef.current) {
            const sentenceSpan = target?.closest('.velvet-tts-sentence') as HTMLElement | null;
            if (sentenceSpan) {
              const idAttr = sentenceSpan.getAttribute('data-tts-id');
              if (idAttr !== null) {
                const sentenceIdx = parseInt(idAttr, 10);
                if (!isNaN(sentenceIdx)) {
                  TTSService.play(sentenceIdx);
                  return;
                }
              }
            }
          }
        });

        // In continuous layout mode, inject elegant Previous / Next Chapter navigation footer at the bottom of the chapter
        if (settings?.layoutMode === 'continuous') {
          doc.querySelectorAll('.velvet-chapter-nav-footer').forEach((el: Element) => el.remove());

          const flatTOC = flatTOCListRef.current;
          const currentIdx = currentTOCIndexRef.current;

          const prevItem = flatTOC.length > 0 && currentIdx > 0 ? flatTOC[currentIdx - 1] : null;
          const nextItem = flatTOC.length > 0 && currentIdx < flatTOC.length - 1 ? flatTOC[currentIdx + 1] : null;

          const navFooter = doc.createElement('div');
          navFooter.className = 'velvet-chapter-nav-footer';
          navFooter.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            max-width: 560px;
            margin: 1.5rem auto 0.75rem auto;
            padding: 0;
            border: none;
            user-select: none;
            box-sizing: border-box;
          `;

          const prevBtn = doc.createElement('button');
          prevBtn.type = 'button';
          prevBtn.className = 'velvet-chapter-nav-prev-btn';
          prevBtn.style.cssText = `
            flex: 1;
            padding: 8px 12px;
            border-radius: 12px;
            background: var(--bg-surface, #ffffff);
            border: 1px solid var(--border-color, #e5e5e5);
            color: var(--text-primary, #000000);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.15s ease;
            box-shadow: none;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `;
          const prevLabel = prevItem?.label ? prevItem.label.trim() : 'Previous';
          prevBtn.innerHTML = `<span style="font-weight: 700; flex-shrink: 0; font-size: 13px;">‹</span> <span class="velvet-chapter-nav-prev-label" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${prevLabel}</span>`;
          prevBtn.title = prevLabel;
          prevBtn.addEventListener('mouseenter', () => {
            prevBtn.style.background = 'var(--bg-secondary, #f5f5f5)';
          });
          prevBtn.addEventListener('mouseleave', () => {
            prevBtn.style.background = 'var(--bg-surface, #ffffff)';
          });
          prevBtn.addEventListener('click', async (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (!viewRef.current) return;

            const toc = flatTOCListRef.current;
            if (toc.length > 0) {
              const curIdx = currentTOCIndexRef.current;
              const targetIdx = Math.max(0, curIdx - 1);
              const targetItem = toc[targetIdx];
              if (targetItem) {
                try {
                  const progress = await db.progress.get(bookId);
                  const cfiMap = progress?.sectionCfiMap || {};
                  const savedCfi =
                    cfiMap[`href_${targetItem.href}`] ||
                    cfiMap[`href_${targetItem.href.split('#')[0]}`] ||
                    targetItem.cfi;

                  if (savedCfi) {
                    await viewRef.current.goTo(savedCfi);
                  } else {
                    await viewRef.current.goTo(targetItem.href);
                  }
                  currentTOCIndexRef.current = targetIdx;
                  return;
                } catch {
                  viewRef.current.goTo(targetItem.href);
                  return;
                }
              }
            }

            // Fallback to sectionIndex if TOC not available
            const curSec = currentSectionIndexRef.current;
            const prevSec = Math.max(0, curSec - 1);
            viewRef.current.goTo(prevSec);
          });

          const nextBtn = doc.createElement('button');
          nextBtn.type = 'button';
          nextBtn.className = 'velvet-chapter-nav-next-btn';
          nextBtn.style.cssText = `
            flex: 1;
            padding: 8px 12px;
            border-radius: 12px;
            background: var(--bg-surface, #ffffff);
            border: 1px solid var(--border-color, #e5e5e5);
            color: var(--text-primary, #000000);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.15s ease;
            box-shadow: none;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `;
          const nextLabel = nextItem?.label ? nextItem.label.trim() : 'Next';
          nextBtn.innerHTML = `<span class="velvet-chapter-nav-next-label" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nextLabel}</span> <span style="font-weight: 700; flex-shrink: 0; font-size: 13px;">›</span>`;
          nextBtn.title = nextLabel;
          nextBtn.addEventListener('mouseenter', () => {
            nextBtn.style.background = 'var(--bg-secondary, #f5f5f5)';
          });
          nextBtn.addEventListener('mouseleave', () => {
            nextBtn.style.background = 'var(--bg-surface, #ffffff)';
          });
          nextBtn.addEventListener('click', async (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (!viewRef.current) return;

            const toc = flatTOCListRef.current;
            if (toc.length > 0) {
              const curIdx = currentTOCIndexRef.current;
              const targetIdx = Math.min(toc.length - 1, curIdx + 1);
              const targetItem = toc[targetIdx];
              if (targetItem) {
                try {
                  const progress = await db.progress.get(bookId);
                  const cfiMap = progress?.sectionCfiMap || {};
                  const savedCfi =
                    cfiMap[`href_${targetItem.href}`] ||
                    cfiMap[`href_${targetItem.href.split('#')[0]}`] ||
                    targetItem.cfi;

                  if (savedCfi) {
                    await viewRef.current.goTo(savedCfi);
                  } else {
                    await viewRef.current.goTo(targetItem.href);
                  }
                  currentTOCIndexRef.current = targetIdx;
                  return;
                } catch {
                  viewRef.current.goTo(targetItem.href);
                  return;
                }
              }
            }

            // Fallback to sectionIndex if TOC not available
            const curSec = currentSectionIndexRef.current;
            const nextSec = curSec + 1;
            viewRef.current.goTo(nextSec);
          });

          navFooter.appendChild(prevBtn);
          navFooter.appendChild(nextBtn);
          doc.body.appendChild(navFooter);
        }

        // Attach keydown listener inside the iframe document so shortcut works when iframe has focus
        doc.addEventListener('keydown', (e: KeyboardEvent) => {
          handleShortcutTrigger(e);
        });
      } catch (err) {
        console.warn('Could not attach listeners to iframe doc:', err);
      }

      // Use the always-fresh ref to avoid stale closure capturing old customFonts
      const latestStyles = getInjectedStylesRef.current?.() ?? '';
      try {
        if (doc && (doc.head || doc.documentElement)) {
          let docStyle = doc.getElementById('velvet-injected-doc-style') as HTMLStyleElement | null;
          if (!docStyle) {
            const newStyle = doc.createElement('style');
            newStyle.id = 'velvet-injected-doc-style';
            const target = doc.head || doc.documentElement;
            target.appendChild(newStyle);
            docStyle = newStyle;
          }
          if (docStyle) {
            docStyle.textContent = latestStyles;
          }
        }
      } catch (e) {
        console.warn('Could not inject docStyle directly:', e);
      }
    });

    init();

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [bookId]);

  // Keep quickReadShortcut fresh in ref to avoid stale closures in event listeners
  const quickShortcutRef = useRef<string>(settings?.ttsSettings?.quickReadShortcut || 'Shift');
  useEffect(() => {
    quickShortcutRef.current = settings?.ttsSettings?.quickReadShortcut || 'Shift';
  }, [settings?.ttsSettings?.quickReadShortcut]);

  // Helper to extract selected text from any source (window, active iframe, foliate-view shadow root)
  const getAnySelectedText = useCallback(() => {
    // 1. Check window selection
    let text = window.getSelection()?.toString()?.trim() || '';
    if (text) return text;

    // 2. Check currentDocRef
    if (currentDocRef.current) {
      const doc = currentDocRef.current;
      const iframeWin = doc.defaultView || (doc as any).parentWindow;
      text = iframeWin?.getSelection()?.toString()?.trim() || doc.getSelection?.()?.toString()?.trim() || '';
      if (text) return text;
    }

    // 3. Search all iframes inside foliate-view container / shadow root
    if (containerRef.current) {
      const foliateView = containerRef.current.querySelector('foliate-view') as any;
      const shadowRoot = foliateView?.shadowRoot;
      const iframes = shadowRoot
        ? shadowRoot.querySelectorAll('iframe')
        : containerRef.current.querySelectorAll('iframe');

      for (const iframe of iframes) {
        try {
          const idoc = iframe.contentDocument || iframe.contentWindow?.document;
          const iwin = iframe.contentWindow;
          const s = iwin?.getSelection()?.toString()?.trim() || idoc?.getSelection?.()?.toString()?.trim() || '';
          if (s) return s;
        } catch {}
      }
    }

    return '';
  }, []);

  // Highlight current text selection helper (supports Chrome CSS Custom Highlight API + DOM span fallback)
  const triggerHighlight = useCallback(async () => {
    try {
      const activeColor = settings?.highlightColor || '#fef08a';
      const doc = currentDocRef.current;
      const selection = doc?.getSelection() || window.getSelection();

      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0).cloneRange();
        const selectedText = selection.toString().trim();

        if (selectedText) {
          const newHlId = crypto.randomUUID();
          const targetDoc = (range.startContainer.ownerDocument || doc || document);
          const docWin = targetDoc.defaultView || window;
          const supportsCssHighlight = typeof (docWin as any).CSS?.highlights !== 'undefined' || typeof (window as any).CSS?.highlights !== 'undefined';

          let span: HTMLElement | undefined;

          if (supportsCssHighlight) {
            try {
              const HighlightConstructor = (docWin as any).Highlight || (window as any).Highlight;
              const hlRegistry = (docWin as any).CSS?.highlights || (window as any).CSS?.highlights;
              if (HighlightConstructor && hlRegistry) {
                let existingHl = hlRegistry.get('velvet-highlight');
                if (!existingHl) {
                  existingHl = new HighlightConstructor();
                  hlRegistry.set('velvet-highlight', existingHl);
                }
                existingHl.add(range);
              }
            } catch (err) {
              console.warn('Chrome CSS.highlights add failed:', err);
            }
          } else {
            // Fallback for non-supporting contexts
            span = targetDoc.createElement('span');
            span.className = 'velvet-user-highlight';
            span.style.backgroundColor = activeColor;
            span.style.color = '#1c1917';
            span.style.borderRadius = '3px';
            span.style.padding = '1px 2px';
            span.style.cursor = 'pointer';
            span.style.boxDecorationBreak = 'clone';
            (span.style as any).webkitBoxDecorationBreak = 'clone';
            span.setAttribute('data-note-id', newHlId);

            try {
              range.surroundContents(span);
            } catch {
              const fragment = range.extractContents();
              span.appendChild(fragment);
              range.insertNode(span);
            }
          }

          // Save exclusively to db.highlights (NOT db.notes)
          await db.highlights.add({
            id: newHlId,
            bookId,
            text: selectedText,
            color: activeColor,
            createdAt: Date.now(),
          });

          // Trigger silent background sync
          SupabaseSyncService.triggerAutoSync(20000);

          // Track for Undo (Cmd+Z)
          highlightHistoryRef.current.push({ span: span as any, range, noteId: newHlId });

          selection.removeAllRanges();
          setFloatingTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        }
      }
    } catch (err) {
      console.warn('Quick highlight failed:', err);
    }
  }, [bookId, settings?.highlightColor]);

  // Robust key combo matching helper
  const checkKeyMatch = useCallback((e: KeyboardEvent, shortcutStr?: string): boolean => {
    if (!shortcutStr || !shortcutStr.trim()) return false;
    const sc = shortcutStr.trim();

    if (sc.toLowerCase() === 'shift') {
      return e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight';
    }
    if (sc.toLowerCase() === 'space') {
      return (e.key === ' ' || e.code === 'Space') && !e.altKey && !e.ctrlKey && !e.metaKey;
    }
    if (sc.toLowerCase() === 'arrowleft') {
      return e.key === 'ArrowLeft' || e.code === 'ArrowLeft';
    }
    if (sc.toLowerCase() === 'arrowright') {
      return e.key === 'ArrowRight' || e.code === 'ArrowRight';
    }
    if (sc.toLowerCase() === 'arrowup') {
      return e.key === 'ArrowUp' || e.code === 'ArrowUp';
    }
    if (sc.toLowerCase() === 'arrowdown') {
      return e.key === 'ArrowDown' || e.code === 'ArrowDown';
    }

    const parts = sc.split('+').map((p) => p.trim());
    const mainKey = parts[parts.length - 1].toUpperCase();

    const requiresCtrl = parts.includes('Ctrl');
    const requiresAlt = parts.includes('Alt');
    const requiresShift = parts.includes('Shift');
    const requiresCmd = parts.includes('Cmd') || parts.includes('Meta');

    const ctrlMatch = requiresCtrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey;
    const altMatch = requiresAlt ? e.altKey : !e.altKey;
    const shiftMatch = requiresShift ? e.shiftKey : !e.shiftKey;
    const cmdMatch = requiresCmd ? (e.metaKey || e.ctrlKey) : true;

    const keyMatch =
      e.key.toUpperCase() === mainKey ||
      e.code.toUpperCase() === `KEY${mainKey}` ||
      e.code.toUpperCase() === mainKey;

    return ctrlMatch && altMatch && shiftMatch && cmdMatch && keyMatch;
  }, []);

  const handleShortcutTrigger = useCallback((e: KeyboardEvent) => {
    // 1. Undo Highlight (Cmd+Z on Mac or Ctrl+Z on Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) {
      if (highlightHistoryRef.current.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        undoLastHighlight();
        return true;
      }
    }

    // 2. Quick Highlight Shortcut
    const hlSc = (settings?.highlightShortcut || 'H').trim();
    if (checkKeyMatch(e, hlSc)) {
      const selectedText = getAnySelectedText();
      if (selectedText) {
        e.preventDefault();
        e.stopPropagation();
        triggerHighlight();
        return true;
      }
    }

    // 3. Quick Read Shortcut
    const quickShortcut = quickShortcutRef.current || 'Shift';
    if (checkKeyMatch(e, quickShortcut)) {
      e.preventDefault();
      e.stopPropagation();

      const selectedText = getAnySelectedText();
      if (selectedText) {
        TTSService.playQuickSelection(selectedText);
      } else {
        TTSService.stop();
      }
      return true;
    }

    // 4. Page Turn Navigation Shortcuts (Works with configured keys or default ArrowLeft / ArrowRight)
    if (viewRef.current) {
      const prevSc = settings?.prevPageShortcut || 'ArrowLeft';
      const nextSc = settings?.nextPageShortcut || 'ArrowRight';

      if (
        checkKeyMatch(e, nextSc) ||
        (nextSc === 'ArrowRight' && (e.key === 'ArrowRight' || e.key === 'PageDown'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        viewRef.current.next();
        return true;
      }

      if (
        checkKeyMatch(e, prevSc) ||
        (prevSc === 'ArrowLeft' && (e.key === 'ArrowLeft' || e.key === 'PageUp'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        viewRef.current.prev();
        return true;
      }
    }

    return false;
  }, [getAnySelectedText, undoLastHighlight, triggerHighlight, settings?.highlightShortcut, settings?.prevPageShortcut, settings?.nextPageShortcut, checkKeyMatch]);

  // Window-level keydown listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('input, textarea, [contenteditable="true"]'))
      ) {
        return;
      }

      handleShortcutTrigger(e);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleShortcutTrigger]);

  const isPaginatedMode = settings?.layoutMode === 'paginated-1col' || settings?.layoutMode === 'paginated-2col';

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col items-center justify-center">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--reader-bg)] z-10 space-y-3">
          <Loader2 className="w-8 h-8 text-[var(--accent-color)] animate-spin" />
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Loading book...</p>
        </div>
      )}

      {error && (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium text-center max-w-md">
          {error}
        </div>
      )}

      {/* Foliate Viewer Mount Node */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-default select-text"
      />

      {/* 2 Bottom Navigation Bars (Previous / Next Page) in Paginated 1/2 Column Modes */}
      {isPaginatedMode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 max-w-md w-full px-4 pointer-events-none select-none">
          {/* Previous Page Bar Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              viewRef.current?.prev();
            }}
            className="flex-1 py-2 px-3 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold transition-all pointer-events-auto cursor-pointer flex items-center justify-center gap-1.5"
            title={`Previous Page (${settings?.prevPageShortcut || '←'})`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {/* Next Page Bar Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              viewRef.current?.next();
            }}
            className="flex-1 py-2 px-3 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold transition-all pointer-events-auto cursor-pointer flex items-center justify-center gap-1.5"
            title={`Next Page (${settings?.nextPageShortcut || '→'})`}
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Selection Action Buttons (Highlight & Explain with Gemini AI) */}
      {floatingTooltip.visible && (
        <div
          ref={floatingTooltipDomRef}
          className="absolute z-40 -translate-x-1/2 -translate-y-full pointer-events-auto flex items-center p-1 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xl backdrop-blur-xl"
          style={{
            left: `${floatingTooltip.x}px`,
            top: `${floatingTooltip.y}px`,
          }}
        >
          {/* Highlight / Remove Highlight Button */}
          {floatingTooltip.isHighlighted ? (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();

                try {
                  const el = floatingTooltip.highlightEl;
                  const highlightId = el?.getAttribute('data-note-id');
                  const { TombstoneService } = await import('@/src/services/tombstoneService');
                  if (highlightId) {
                    await TombstoneService.recordTombstone(highlightId, 'highlight');
                    await db.highlights.delete(highlightId);
                  } else {
                    // Fallback delete by text match
                    const text = floatingTooltip.text;
                    const matchingHl = await db.highlights.where('bookId').equals(bookId).toArray();
                    const target = matchingHl.find((h) => h.text === text);
                    if (target) {
                      await TombstoneService.recordTombstone(target.id, 'highlight');
                      await db.highlights.delete(target.id);
                    }
                  }
                  SupabaseSyncService.triggerAutoSync(15000);

                  // Remove from DOM if span exists
                  if (el && el.parentNode) {
                    const parent = el.parentNode;
                    while (el.firstChild) {
                      parent.insertBefore(el.firstChild, el);
                    }
                    parent.removeChild(el);
                    parent.normalize();
                  }

                  // Remove from Chrome CSS Custom Highlight registry if applicable
                  const doc = currentDocRef.current;
                  const docWin = doc?.defaultView || window;
                  const hlRegistry = (docWin as any).CSS?.highlights || (window as any).CSS?.highlights;
                  if (hlRegistry && floatingTooltip.range) {
                    try {
                      const existingHl = hlRegistry.get('velvet-highlight');
                      if (existingHl) {
                        existingHl.delete(floatingTooltip.range);
                      }
                    } catch {}
                  }
                } catch (err) {
                  console.warn('Remove highlight failed:', err);
                }

                setFloatingTooltip((prev) => ({ ...prev, visible: false }));
              }}
              className="p-1.5 rounded-xl hover:bg-rose-500/15 text-rose-500 hover:text-rose-600 transition-all cursor-pointer flex items-center justify-center"
              title="Remove Highlight"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();

                try {
                  const activeColor = settings?.highlightColor || '#fef08a';
                  const doc = currentDocRef.current;
                  const selection = doc?.getSelection();

                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0).cloneRange();
                    const selectedText = selection.toString().trim();

                    if (selectedText) {
                      const newHlId = crypto.randomUUID();
                      const docWin = doc?.defaultView || window;
                      const supportsCssHighlight = typeof (docWin as any).CSS?.highlights !== 'undefined' || typeof (window as any).CSS?.highlights !== 'undefined';

                      let span: HTMLElement | undefined;

                      if (supportsCssHighlight) {
                        try {
                          const HighlightConstructor = (docWin as any).Highlight || (window as any).Highlight;
                          const hlRegistry = (docWin as any).CSS?.highlights || (window as any).CSS?.highlights;
                          if (HighlightConstructor && hlRegistry) {
                            let existingHl = hlRegistry.get('velvet-highlight');
                            if (!existingHl) {
                              existingHl = new HighlightConstructor();
                              hlRegistry.set('velvet-highlight', existingHl);
                            }
                            existingHl.add(range);
                          }
                        } catch (err) {
                          console.warn('Chrome CSS.highlights add failed:', err);
                        }
                      } else {
                        // Create highlight span in document as fallback
                        span = doc!.createElement('span');
                        span.className = 'velvet-user-highlight';
                        span.style.backgroundColor = activeColor;
                        span.style.color = '#1c1917';
                        span.style.borderRadius = '3px';
                        span.style.padding = '1px 2px';
                        span.style.cursor = 'pointer';
                        span.style.boxDecorationBreak = 'clone';
                        (span.style as any).webkitBoxDecorationBreak = 'clone';
                        span.setAttribute('data-note-id', newHlId);

                        try {
                          range.surroundContents(span);
                        } catch {
                          const fragment = range.extractContents();
                          span.appendChild(fragment);
                          range.insertNode(span);
                        }
                      }

                      // Save exclusively to db.highlights (NOT db.notes)
                      await db.highlights.add({
                        id: newHlId,
                        bookId,
                        text: selectedText,
                        color: activeColor,
                        createdAt: Date.now(),
                      });

                      // Trigger silent background sync
                      SupabaseSyncService.triggerAutoSync(20000);

                      // Track for Undo (Cmd+Z / Ctrl+Z)
                      highlightHistoryRef.current.push({ span: span as any, range, noteId: newHlId });

                      selection.removeAllRanges();
                    }
                  }
                } catch (err) {
                  console.warn('Highlight failed:', err);
                }

                setFloatingTooltip((prev) => ({ ...prev, visible: false }));
              }}
              className="p-1.5 rounded-xl hover:bg-[var(--accent-color)] hover:text-white text-[var(--text-secondary)] transition-all cursor-pointer flex items-center justify-center group"
              title="Highlight Selection"
            >
              <Highlighter className="w-4 h-4 text-[var(--text-primary)] group-hover:text-white transition-colors" />
            </button>
          )}

          {/* 2. Comment Button (in the middle: Highlight -> Comment -> Bot) */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const selected = floatingTooltip.text;
              const range = floatingTooltip.range;
              const x = floatingTooltip.x;
              const modalY = floatingTooltip.modalY || floatingTooltip.y;
              const placement = floatingTooltip.placement || 'top';

              setCommentModal({
                visible: true,
                x,
                y: modalY,
                placement,
                targetRange: range || null,
                selectedText: selected,
                commentText: '',
              });
              setFloatingTooltip((prev) => ({ ...prev, visible: false }));
            }}
            className="p-1.5 rounded-xl hover:bg-[var(--accent-color)] hover:text-white text-[var(--text-secondary)] transition-all cursor-pointer flex items-center justify-center group"
            title="Add Comment"
          >
            <MessageSquare className="w-4 h-4 text-[var(--text-primary)] group-hover:text-white transition-colors" />
          </button>

          {/* 3. Text-to-Speech (Pronounce / Quick Read Selection) */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const textToSpeak = floatingTooltip.text;
              if (textToSpeak) {
                try {
                  await TTSService.playQuickSelection(textToSpeak);
                } catch (err) {
                  console.warn('Quick TTS failed:', err);
                }
              }
              setFloatingTooltip((prev) => ({ ...prev, visible: false }));
            }}
            className="p-1.5 rounded-xl hover:bg-[var(--accent-color)] hover:text-white text-[var(--text-secondary)] transition-all cursor-pointer flex items-center justify-center group"
            title="Pronounce / Read Aloud Selection"
          >
            <Volume2 className="w-4 h-4 text-[var(--text-primary)] group-hover:text-white transition-colors" />
          </button>

          {/* 4. AI Helper Button */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!settings?.geminiApiKey?.trim()) {
                if (onOpenSettingsRef.current) {
                  onOpenSettingsRef.current();
                }
              } else if (onWordClickRef.current && floatingTooltip.text) {
                onWordClickRef.current(floatingTooltip.text, floatingTooltip.contextText);
              }
              setFloatingTooltip((prev) => ({ ...prev, visible: false }));
            }}
            className="p-1.5 rounded-xl hover:bg-[var(--accent-color)] hover:text-white text-[var(--text-secondary)] transition-all cursor-pointer flex items-center justify-center group"
            title="Explain with AI"
          >
            <Bot className="w-4 h-4 text-[var(--accent-color)] group-hover:text-white transition-colors" />
          </button>
        </div>
      )}

      {/* Floating Comment Input Modal / Card */}
      {commentModal.visible && (
        <div
          ref={commentModalDomRef}
          className="absolute z-50 -translate-x-1/2 -translate-y-full pointer-events-auto w-72 sm:w-80 p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl backdrop-blur-xl flex flex-col space-y-2.5"
          style={{
            left: `${Math.max(160, Math.min(window.innerWidth - 160, commentModal.x))}px`,
            top: `${commentModal.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--accent-color)] flex items-center gap-1.5 uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5" />
              Add Comment
            </span>
            <button
              type="button"
              onClick={() => setCommentModal((prev) => ({ ...prev, visible: false }))}
              className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Textarea */}
          <textarea
            autoFocus
            rows={4}
            value={commentModal.commentText}
            onChange={(e) => setCommentModal((prev) => ({ ...prev, commentText: e.target.value }))}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!commentModal.commentText.trim()) return;

                const newCommentId = crypto.randomUUID();
                const newCommentData = {
                  id: newCommentId,
                  bookId,
                  selectedText: commentModal.selectedText,
                  comment: commentModal.commentText.trim(),
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                await db.comments.add(newCommentData);
                SupabaseSyncService.triggerAutoSync(20000);

                if (commentModal.targetRange) {
                  const doc = currentDocRef.current || document;
                  const docWin = doc.defaultView || window;
                  const supportsCssHighlight = typeof (docWin as any).CSS?.highlights !== 'undefined' || typeof (window as any).CSS?.highlights !== 'undefined';

                  if (supportsCssHighlight) {
                    try {
                      const HighlightConstructor = (docWin as any).Highlight || (window as any).Highlight;
                      const hlRegistry = (docWin as any).CSS?.highlights || (window as any).CSS?.highlights;
                      if (HighlightConstructor && hlRegistry) {
                        let commentHl = hlRegistry.get('velvet-comment');
                        if (!commentHl) {
                          commentHl = new HighlightConstructor();
                          hlRegistry.set('velvet-comment', commentHl);
                        }
                        commentHl.add(commentModal.targetRange);
                        commentRangesMapRef.current.set(newCommentId, {
                          range: commentModal.targetRange,
                          comment: newCommentData,
                        });
                      }
                    } catch (err) {
                      console.warn('Chrome CSS.highlights comment add failed:', err);
                    }
                  } else {
                    try {
                      const span = doc.createElement('span');
                      span.className = 'velvet-user-comment';
                      span.setAttribute('data-comment-id', newCommentId);
                      span.setAttribute('data-comment-text', commentModal.commentText.trim());
                      span.setAttribute('data-comment-date', String(Date.now()));
                      commentModal.targetRange.surroundContents(span);
                    } catch {}
                  }
                }

                setCommentModal((prev) => ({ ...prev, visible: false }));
              }
            }}
            placeholder="Write your note or thoughts... (Enter to save, Shift+Enter for new line)"
            className="w-full text-xs p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:outline-none text-[var(--text-primary)] resize-none font-sans"
          />

          {/* Action Row */}
          <div className="flex items-center justify-end gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setCommentModal((prev) => ({ ...prev, visible: false }))}
                className="px-2.5 py-1 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!commentModal.commentText.trim()}
                onClick={async () => {
                  if (!commentModal.commentText.trim()) return;

                  const newCommentId = crypto.randomUUID();
                  const newCommentData = {
                    id: newCommentId,
                    bookId,
                    selectedText: commentModal.selectedText,
                    comment: commentModal.commentText.trim(),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  };
                  await db.comments.add(newCommentData);
                  SupabaseSyncService.triggerAutoSync(20000);

                  if (commentModal.targetRange) {
                    const doc = currentDocRef.current || document;
                    const docWin = doc.defaultView || window;
                    const supportsCssHighlight = typeof (docWin as any).CSS?.highlights !== 'undefined' || typeof (window as any).CSS?.highlights !== 'undefined';

                    if (supportsCssHighlight) {
                      try {
                        const HighlightConstructor = (docWin as any).Highlight || (window as any).Highlight;
                        const hlRegistry = (docWin as any).CSS?.highlights || (window as any).CSS?.highlights;
                        if (HighlightConstructor && hlRegistry) {
                          let commentHl = hlRegistry.get('velvet-comment');
                          if (!commentHl) {
                            commentHl = new HighlightConstructor();
                            hlRegistry.set('velvet-comment', commentHl);
                          }
                          commentHl.add(commentModal.targetRange);
                          commentRangesMapRef.current.set(newCommentId, {
                            range: commentModal.targetRange,
                            comment: newCommentData,
                          });
                        }
                      } catch (err) {
                        console.warn('Chrome CSS.highlights comment add failed:', err);
                      }
                    } else {
                      try {
                        const span = doc.createElement('span');
                        span.className = 'velvet-user-comment';
                        span.setAttribute('data-comment-id', newCommentId);
                        span.setAttribute('data-comment-text', commentModal.commentText.trim());
                        span.setAttribute('data-comment-date', String(Date.now()));
                        commentModal.targetRange.surroundContents(span);
                      } catch {}
                    }
                  }

                  setCommentModal((prev) => ({ ...prev, visible: false }));
                }}
                className="px-3 py-1 rounded-xl bg-[var(--accent-color)] text-white text-xs font-semibold hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
        </div>
      )}

      {/* Google Docs style Comment Hover Popover Card */}
      {hoveredComment.visible && (
        <div
          ref={hoveredCommentDomRef}
          onMouseEnter={() => setHoveredComment((prev) => ({ ...prev, visible: true }))}
          onMouseLeave={() => setHoveredComment((prev) => ({ ...prev, visible: false }))}
          style={{
            left: `${Math.max(160, Math.min(window.innerWidth - 160, hoveredComment.x))}px`,
            top: `${hoveredComment.y}px`,
          }}
          className="fixed z-50 -translate-x-1/2 w-72 p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 space-y-2 pointer-events-auto select-text text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[var(--accent-color)] font-semibold text-[11px]">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comment</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-muted)]">
                {new Date(hoveredComment.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {!hoveredComment.isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setHoveredComment((prev) => ({
                      ...prev,
                      isEditing: true,
                      editCommentText: prev.comment,
                    }));
                  }}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 transition-all cursor-pointer"
                  title="Edit comment"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (hoveredComment.id) {
                      const { TombstoneService } = await import('@/src/services/tombstoneService');
                      await TombstoneService.recordTombstone(hoveredComment.id, 'comment');
                      await db.comments.delete(hoveredComment.id);
                      SupabaseSyncService.triggerAutoSync(20000);

                      const doc = currentDocRef.current;
                      if (doc) {
                        // 1. Remove from Native Chrome CSS.highlights
                        const docWin = doc.defaultView || window;
                        const hlRegistry = (docWin as any).CSS?.highlights || (window as any).CSS?.highlights;
                        const commentHl = hlRegistry?.get?.('velvet-comment');
                        const mapped = commentRangesMapRef.current.get(hoveredComment.id);
                        if (commentHl && mapped?.range) {
                          commentHl.delete(mapped.range);
                        }
                        commentRangesMapRef.current.delete(hoveredComment.id);

                        // 2. Remove DOM fallback span if present
                        const span = doc.querySelector(`[data-comment-id="${hoveredComment.id}"]`);
                        if (span && span.parentNode) {
                          const parent = span.parentNode;
                          while (span.firstChild) parent.insertBefore(span.firstChild, span);
                          parent.removeChild(span);
                          parent.normalize();
                        }
                      }
                    }
                  } catch (err) {
                    console.warn('Delete comment failed:', err);
                  }
                  setHoveredComment((prev) => ({ ...prev, visible: false }));
                }}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                title="Delete comment"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <blockquote className="text-[11px] text-[var(--text-secondary)] italic border-l-2 border-[var(--accent-color)] pl-2 line-clamp-2">
            &ldquo;{hoveredComment.selectedText}&rdquo;
          </blockquote>

          {hoveredComment.isEditing ? (
            <div className="space-y-2 pt-1">
              <textarea
                autoFocus
                rows={3}
                value={hoveredComment.editCommentText || ''}
                onChange={(e) => setHoveredComment((prev) => ({ ...prev, editCommentText: e.target.value }))}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const newText = (hoveredComment.editCommentText || '').trim();
                    if (!newText || !hoveredComment.id) return;

                    await db.comments.update(hoveredComment.id, { comment: newText, updatedAt: Date.now() });
                    SupabaseSyncService.triggerAutoSync(20000);

                    // Update DOM span data-comment-text attribute
                    const doc = currentDocRef.current;
                    if (doc) {
                      const span = doc.querySelector(`[data-comment-id="${hoveredComment.id}"]`);
                      if (span) span.setAttribute('data-comment-text', newText);
                    }

                    setHoveredComment((prev) => ({
                      ...prev,
                      comment: newText,
                      isEditing: false,
                    }));
                  }
                }}
                className="w-full text-xs p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:outline-none text-[var(--text-primary)] resize-none"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setHoveredComment((prev) => ({ ...prev, isEditing: false }))}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!(hoveredComment.editCommentText || '').trim()}
                  onClick={async () => {
                    const newText = (hoveredComment.editCommentText || '').trim();
                    if (!newText || !hoveredComment.id) return;

                    await db.comments.update(hoveredComment.id, { comment: newText, updatedAt: Date.now() });
                    SupabaseSyncService.triggerAutoSync(20000);

                    const doc = currentDocRef.current;
                    if (doc) {
                      const span = doc.querySelector(`[data-comment-id="${hoveredComment.id}"]`);
                      if (span) span.setAttribute('data-comment-text', newText);
                    }

                    setHoveredComment((prev) => ({
                      ...prev,
                      comment: newText,
                      isEditing: false,
                    }));
                  }}
                  className="px-3 py-1 rounded-lg bg-[var(--accent-color)] text-white text-xs font-semibold hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p
              onClick={() => {
                setHoveredComment((prev) => ({
                  ...prev,
                  isEditing: true,
                  editCommentText: prev.comment,
                }));
              }}
              className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap cursor-text hover:bg-[var(--bg-secondary)]/50 p-1 rounded-lg transition-colors"
            >
              {hoveredComment.comment}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
