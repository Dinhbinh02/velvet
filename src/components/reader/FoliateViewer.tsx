import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BookService } from '@/src/services/bookService';
import { db } from '@/src/db/schema';
import type { IReaderSettings } from '@/src/types/book';
import { DEFAULT_SETTINGS } from '@/src/hooks/useReaderSettings';
import { Loader2, Bot, Highlighter, Trash2, MessageSquare, Check, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { TTSService } from '@/src/services/ttsService';
import { GoogleDriveSyncService } from '@/src/services/googleDriveSyncService';

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
  onLocationChange?: (info: { cfi: string; percentage: number; chapterTitle?: string; sectionIndex: number }) => void;
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

  const commentModalDomRef = useRef<HTMLDivElement>(null);

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
  const highlightHistoryRef = useRef<Array<{ span: HTMLElement; noteId: string }>>([]);

  const undoLastHighlight = useCallback(async () => {
    const lastItem = highlightHistoryRef.current.pop();
    if (!lastItem) return;

    try {
      const { span, noteId } = lastItem;
      // 1. Remove span from DOM if still present
      if (span && span.parentNode) {
        const parent = span.parentNode;
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
        parent.normalize();
      }

      // 2. Delete corresponding highlight from Dexie
      if (noteId) {
        await db.highlights.delete(noteId);
      }
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

    return `
      @import url('https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,400..700;1,400..700&family=Inter:wght@300..700&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap');

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
      /* Main Reading Paragraphs & Text */
      p, li, blockquote {
        font-family: ${fontFamily} !important;
        font-size: ${fontSize}px !important;
        line-height: ${lineHeight} !important;
        text-align: ${textAlign} !important;
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

    // 3. Margin & Max Width
    const maxInlineSize = settings?.maxWidth ? `${settings.maxWidth}px` : `${DEFAULT_SETTINGS.maxWidth}px`;
    // For continuous scroll, 1.5rem (24px) top/bottom margin ensures text never hits the viewport edge
    renderer.setAttribute('margin', isContinuous ? '24px 0px' : '44px');
    renderer.setAttribute('gap', '6%');
    renderer.setAttribute('max-inline-size', maxInlineSize);

    // 4. Set column count (1 col vs 2 col)
    if (!isContinuous) {
      const isOneCol = settings?.layoutMode === 'paginated-1col';
      renderer.setAttribute('max-column-count', isOneCol ? '1' : '2');
    }
  }, [getInjectedStyles, settings?.layoutMode, settings?.maxWidth, theme]);

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

        // Emit TOC
        if (view.book?.toc) {
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

      onLocationChange?.({ cfi, percentage, chapterTitle, sectionIndex });

      // Debounce saving progress to Dexie
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        BookService.updateProgress(bookId, {
          cfi,
          percentage,
          sectionIndex,
          chapterTitle,
        });
      }, 300);
    });

    view.addEventListener('load', ({ detail }: any) => {
      const doc = detail?.doc;
      if (!doc) return;
      currentDocRef.current = doc;

      // Re-apply latest typography styles & layout to newly rendered document
      applySettingsToRenderer();

      // Restore saved highlights from Dexie for this book
      const restoreHighlights = async () => {
        try {
          const highlights = await db.highlights.where('bookId').equals(bookId).toArray();

          if (highlights.length === 0) return;

          highlights.forEach((h) => {
            const highlightText = h.text?.trim();
            const highlightColor = h.color || settings?.highlightColor || '#fef08a';

            if (!highlightText || highlightText.length < 2) return;

            // Search document text nodes and wrap occurrences
            const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
            let node: Node | null;
            while ((node = walker.nextNode())) {
              const nodeText = node.nodeValue || '';
              const matchIdx = nodeText.indexOf(highlightText);
              if (matchIdx !== -1 && node.parentElement && !node.parentElement.closest('.velvet-user-highlight')) {
                try {
                  const range = doc.createRange();
                  range.setStart(node, matchIdx);
                  range.setEnd(node, matchIdx + highlightText.length);

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
                  break;
                } catch {}
              }
            }
          });
        } catch (e) {
          console.warn('Could not restore highlights:', e);
        }
      };
      restoreHighlights();

      // Restore saved AI chapter header summaries from Dexie
      const restoreChapterSummaries = async () => {
        try {
          const summaries = await db.chapterSummaries.where('bookId').equals(bookId).toArray();
          if (summaries.length === 0) return;

          // Remove any existing summary blocks first to avoid duplicate insertions
          doc.querySelectorAll('.velvet-chapter-summary-card').forEach((el: Element) => el.remove());

          // Search for matching headings in the document (h1, h2, h3, h4, h5, h6, or bold titles)
          const allHeadings = Array.from(
            doc.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="title"], [class*="chapter"], [class*="header"], p > strong, p > b')
          ) as HTMLElement[];

          let insertedCount = 0;
          summaries.forEach((chSummary) => {
            if (!Array.isArray(chSummary.summaries)) return;

            chSummary.summaries.forEach((s) => {
              if (!s.header || !s.summary) return;

              const cleanHeader = s.header.trim().toLowerCase();

              // 1. Find matching heading element
              let targetEl = allHeadings.find((h) => {
                const hText = (h.textContent || '').trim().toLowerCase();
                return (
                  hText === cleanHeader ||
                  hText.includes(cleanHeader) ||
                  cleanHeader.includes(hText)
                );
              });

              // 2. If not found in allHeadings, search all elements for matching text
              if (!targetEl) {
                const allElements = Array.from(doc.querySelectorAll('p, div, section, span')) as HTMLElement[];
                targetEl = allElements.find((el) => {
                  const text = (el.textContent || '').trim().toLowerCase();
                  return text === cleanHeader || (text.length <= cleanHeader.length + 10 && text.includes(cleanHeader));
                });
              }

              if (targetEl && targetEl.parentNode) {
                // Check if summary card already placed right next to it
                const nextSibling = targetEl.nextElementSibling as HTMLElement | null;
                if (nextSibling?.classList?.contains('velvet-chapter-summary-card')) {
                  return;
                }

                // Create and insert elegant, theme-harmonious summary card
                const card = doc.createElement('div');
                card.className = 'velvet-chapter-summary-card';
                card.style.margin = '18px 0 24px 0';
                card.style.padding = '16px 18px';
                card.style.borderRadius = '8px';
                card.style.borderLeft = '3px solid currentColor';
                card.style.borderTop = '1px solid currentColor';
                card.style.borderRight = '1px solid currentColor';
                card.style.borderBottom = '1px solid currentColor';
                card.style.borderColor = 'color-mix(in srgb, currentColor 18%, transparent)';
                card.style.backgroundColor = 'color-mix(in srgb, currentColor 4%, transparent)';
                card.style.color = 'inherit';
                card.style.boxSizing = 'border-box';

                const keyPointsHtml = Array.isArray(s.keyPoints) && s.keyPoints.length > 0
                  ? `<ul style="margin: 12px 0 0 0; padding-left: 20px; list-style-type: disc; opacity: 0.92;">
                      ${s.keyPoints.map((kp) => `<li style="margin-bottom: 6px;">${kp}</li>`).join('')}
                    </ul>`
                  : '';

                card.innerHTML = `
                  <div class="velvet-summary-badge">
                    Key Insights
                  </div>
                  <div style="opacity: 0.95;">
                    ${s.summary}
                  </div>
                  ${keyPointsHtml}
                `;

                targetEl.parentNode.insertBefore(card, targetEl.nextSibling);
                insertedCount++;
              }
            });
          });

          // If cards were inserted into the document upon initial load, re-align viewer to the exact saved CFI
          if (insertedCount > 0) {
            const progress = await db.progress.get(bookId);
            if (progress?.cfi) {
              try {
                await view.goTo(progress.cfi);
              } catch {}
            }
          }
        } catch (e) {
          console.warn('Could not restore chapter summaries:', e);
        }
      };

      restoreChapterSummaries();

      // Listen for custom chapter summaries update event on view element
      view.addEventListener('velvet:chapter-summaries-updated', () => {
        restoreChapterSummaries();
      });

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

        doc.addEventListener('click', (e: MouseEvent) => {
          const target = e.target as HTMLElement | null;

          // 1. If clicked directly on an existing highlight span, show action bar with Delete Highlight option
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
          // 2. If TTS is active, prioritize playing the clicked sentence
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

          // 3. Margin click detection: only when clicking empty background outside any text/paragraph element
          const isBackgroundClick = target === doc.body || target === doc.documentElement;

          if (isBackgroundClick && viewRef.current) {
            const winWidth = doc.documentElement.clientWidth || doc.body.clientWidth || window.innerWidth;
            const clickX = e.clientX;

            // Left 15% margin click -> Prev page
            if (clickX < winWidth * 0.15) {
              e.preventDefault();
              viewRef.current.prev();
              return;
            }
            // Right 15% margin click -> Next page
            else if (clickX > winWidth * 0.85) {
              e.preventDefault();
              viewRef.current.next();
              return;
            }
          }
        });

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

  // Highlight current text selection helper
  const triggerHighlight = useCallback(async () => {
    try {
      const activeColor = settings?.highlightColor || '#fef08a';
      const doc = currentDocRef.current;
      const selection = doc?.getSelection() || window.getSelection();

      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = selection.toString().trim();

        if (selectedText) {
          const newHlId = crypto.randomUUID();
          const targetDoc = (range.startContainer.ownerDocument || doc || document);

          // Create highlight span in document
          const span = targetDoc.createElement('span');
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

          // Save exclusively to db.highlights (NOT db.notes)
          await db.highlights.add({
            id: newHlId,
            bookId,
            text: selectedText,
            color: activeColor,
            createdAt: Date.now(),
          });

          // Track for Undo (Cmd+Z)
          highlightHistoryRef.current.push({ span, noteId: newHlId });

          selection.removeAllRanges();
          setFloatingTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        }
      }
    } catch (err) {
      console.warn('Quick highlight failed:', err);
    }
  }, [bookId, settings?.highlightColor]);

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

    // 2. Quick Highlight Shortcut (Supports single key, modifiers, combos)
    const hlSc = (settings?.highlightShortcut || 'H').trim();
    let isHighlightMatch = false;

    if (hlSc.toLowerCase() === 'shift') {
      isHighlightMatch = e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight';
    } else if (hlSc.toLowerCase() === 'space') {
      isHighlightMatch = (e.key === ' ' || e.code === 'Space') && !e.altKey && !e.ctrlKey && !e.metaKey;
    } else {
      const isAltKey = hlSc.includes('Alt') ? e.altKey : !e.altKey;
      const isMetaKey = (hlSc.includes('Meta') || hlSc.includes('Cmd') || hlSc.includes('Ctrl'))
        ? (e.metaKey || e.ctrlKey)
        : (!e.metaKey && !e.ctrlKey);
      const isShiftKey = hlSc.includes('Shift') ? e.shiftKey : !e.shiftKey;
      const keyLetter = hlSc.split('+').pop()?.toUpperCase() || 'H';
      const isKeyMatch = e.key?.toUpperCase() === keyLetter || e.code?.toUpperCase() === `KEY${keyLetter}`;
      isHighlightMatch = isAltKey && isMetaKey && isShiftKey && isKeyMatch;
    }

    if (isHighlightMatch) {
      const selectedText = getAnySelectedText();
      if (selectedText) {
        e.preventDefault();
        e.stopPropagation();
        triggerHighlight();
        return true;
      }
    }

    const quickShortcut = quickShortcutRef.current || 'Shift';

    let isMatch = false;
    if (quickShortcut.toLowerCase() === 'shift') {
      isMatch = e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight';
    } else if (quickShortcut.toLowerCase() === 'space') {
      isMatch = (e.key === ' ' || e.code === 'Space') && !e.altKey && !e.ctrlKey && !e.metaKey;
    } else {
      const isAltKey = quickShortcut.includes('Alt') ? e.altKey : !e.altKey;
      const isMetaKey = (quickShortcut.includes('Meta') || quickShortcut.includes('Cmd') || quickShortcut.includes('Ctrl'))
        ? (e.metaKey || e.ctrlKey)
        : (!e.metaKey && !e.ctrlKey);
      const isShiftKey = quickShortcut.includes('Shift') ? e.shiftKey : true;
      const keyLetter = quickShortcut.split('+').pop()?.toUpperCase();
      const isKeyMatch = e.key?.toUpperCase() === keyLetter || e.code?.toUpperCase() === `KEY${keyLetter}`;
      isMatch = isAltKey && isMetaKey && isShiftKey && isKeyMatch;
    }

    if (isMatch) {
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
    return false;
  }, [getAnySelectedText, undoLastHighlight, triggerHighlight, settings?.highlightShortcut]);

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

      // Check quick shortcut
      if (handleShortcutTrigger(e)) return;

      // Keyboard arrow / custom page turn navigation
      if (!viewRef.current) return;

      const prevSc = (settings?.prevPageShortcut || 'ArrowLeft').toLowerCase();
      const nextSc = (settings?.nextPageShortcut || 'ArrowRight').toLowerCase();
      const currentKey = e.key.toLowerCase();

      if (currentKey === nextSc || e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        viewRef.current.next();
      } else if (currentKey === prevSc || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        viewRef.current.prev();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleShortcutTrigger, settings?.prevPageShortcut, settings?.nextPageShortcut]);

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
                  if (highlightId) {
                    await db.highlights.delete(highlightId);
                  } else {
                    // Fallback delete by text match
                    const text = floatingTooltip.text;
                    const matchingHl = await db.highlights.where('bookId').equals(bookId).toArray();
                    const target = matchingHl.find((h) => h.text === text);
                    if (target) await db.highlights.delete(target.id);
                  }

                  if (el && el.parentNode) {
                    // Replace span with its inner text nodes
                    const parent = el.parentNode;
                    while (el.firstChild) {
                      parent.insertBefore(el.firstChild, el);
                    }
                    parent.removeChild(el);
                    parent.normalize();
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
                    const range = selection.getRangeAt(0);
                    const selectedText = selection.toString().trim();

                    if (selectedText) {
                      const newHlId = crypto.randomUUID();

                      // Create highlight span in document
                      const span = doc!.createElement('span');
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
                        // Fallback for multi-element selections
                        const fragment = range.extractContents();
                        span.appendChild(fragment);
                        range.insertNode(span);
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
                      GoogleDriveSyncService.triggerAutoSync(20000);

                      // Track for Undo (Cmd+Z / Ctrl+Z)
                      highlightHistoryRef.current.push({ span, noteId: newHlId });

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

          {/* 3. AI Helper Button */}
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
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (!commentModal.commentText.trim()) return;

                await db.comments.add({
                  id: crypto.randomUUID(),
                  bookId,
                  selectedText: commentModal.selectedText,
                  comment: commentModal.commentText.trim(),
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                });
                GoogleDriveSyncService.triggerAutoSync(20000);
                setCommentModal((prev) => ({ ...prev, visible: false }));
              }
            }}
            placeholder="Write your note or thoughts... (Cmd+Enter to save)"
            className="w-full text-xs p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:outline-none text-[var(--text-primary)] resize-none"
          />

          {/* Action Row */}
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              Cmd + Enter
            </span>
            <div className="flex items-center gap-1.5">
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

                  await db.comments.add({
                    id: crypto.randomUUID(),
                    bookId,
                    selectedText: commentModal.selectedText,
                    comment: commentModal.commentText.trim(),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  });
                  GoogleDriveSyncService.triggerAutoSync(20000);
                  setCommentModal((prev) => ({ ...prev, visible: false }));
                }}
                className="px-3 py-1 rounded-xl bg-[var(--accent-color)] text-white text-xs font-semibold hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
