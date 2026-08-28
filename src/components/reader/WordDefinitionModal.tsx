import React, { useState, useEffect } from 'react';
import { X, Volume2, Loader2 } from 'lucide-react';
import type { IWordExplanation } from '@/src/services/geminiAIService';
import { TTSService } from '@/src/services/ttsService';

interface WordDefinitionModalProps {
  data: IWordExplanation | null;
  isLoading: boolean;
  error: string | null;
  fontFamily?: string;
  fontSize?: number;
  maxWidth?: number;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const WordDefinitionModal: React.FC<WordDefinitionModalProps> = React.memo(({
  data,
  isLoading,
  error,
  fontFamily,
  fontSize = 18,
  maxWidth = 760,
  onClose,
  onOpenSettings,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [contentBounds, setContentBounds] = useState<{
    left: number;
    width: number;
  } | null>(null);

  const baseFontSize = fontSize || 18;
  const effectiveMaxWidth = maxWidth || 760;

  useEffect(() => {
    if (!data && !isLoading && !error) return;

    const measureBookContent = () => {
      try {
        const foliateContainer =
          document.getElementById('foliate-container') ||
          document.querySelector('foliate-view') ||
          document.querySelector('main');
        const containerRect = foliateContainer?.getBoundingClientRect() || { left: 0, width: window.innerWidth };

        const foliateView = document.querySelector('foliate-view') as any;
        const iframe =
          foliateView?.renderer?.shadowRoot?.querySelector('iframe') ||
          foliateView?.shadowRoot?.querySelector('iframe') ||
          document.querySelector('foliate-view iframe') ||
          document.querySelector('iframe');

        if (iframe) {
          const iframeRect = iframe.getBoundingClientRect();
          const doc = iframe.contentDocument || iframe.contentWindow?.document;

          if (doc) {
            // 1. Direct measurement of doc.body (strictly defines the book's column width & horizontal margins)
            if (doc.body) {
              const bodyRect = doc.body.getBoundingClientRect();
              if (bodyRect.width > 50) {
                setContentBounds({
                  left: Math.round(iframeRect.left + bodyRect.left),
                  width: Math.round(bodyRect.width),
                });
                return;
              }
            }

            // 2. Direct measurement from top-level body paragraphs (excluding nested cards/elements with inner padding)
            const textNodes = doc.querySelectorAll('body > p, body > h1, body > h2, body > h3, body > div > p');
            for (let i = 0; i < textNodes.length; i++) {
              const node = textNodes[i] as HTMLElement;
              if (
                node.textContent &&
                node.textContent.trim().length > 0 &&
                !node.closest('.velvet-chapter-summary-card')
              ) {
                const r = node.getBoundingClientRect();
                if (r.width > 120 && r.height > 0) {
                  setContentBounds({
                    left: Math.round(iframeRect.left + r.left),
                    width: Math.round(r.width),
                  });
                  return;
                }
              }
            }
          }
        }

        // 3. Fallback: calculate centered alignment within reader container using effectiveMaxWidth
        const targetWidth = Math.min(effectiveMaxWidth, Math.max(280, containerRect.width - 32));
        const targetLeft = Math.round(containerRect.left + (containerRect.width - targetWidth) / 2);

        setContentBounds({
          left: Math.max(16, targetLeft),
          width: targetWidth,
        });
      } catch (err) {
        console.warn('Could not measure book content bounds:', err);
      }
    };

    measureBookContent();
    const rafId = requestAnimationFrame(measureBookContent);
    const timer1 = setTimeout(measureBookContent, 60);
    const timer2 = setTimeout(measureBookContent, 180);

    window.addEventListener('resize', measureBookContent);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', measureBookContent);
    };
  }, [data, isLoading, error, effectiveMaxWidth]);

  if (!isLoading && !data && !error) return null;

  const handlePlayVoice = async () => {
    if (!data?.word) return;
    setIsPlayingAudio(true);
    try {
      await TTSService.playQuickSelection(data.word);
    } catch (e) {
      console.warn('Audio play failed:', e);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  return (
    <div
      style={{
        ...(fontFamily ? { fontFamily } : {}),
        ...(contentBounds
          ? {
              left: `${contentBounds.left}px`,
              width: `${contentBounds.width}px`,
              maxWidth: `${contentBounds.width}px`,
              right: 'auto',
            }
          : {}),
      }}
      className={`fixed bottom-5 z-30 pointer-events-auto transform-gpu transition-all duration-150 ${
        !contentBounds ? 'right-5 sm:right-8 w-[calc(100vw-2.5rem)] max-w-sm sm:max-w-md md:max-w-lg sm:w-[460px] md:w-[480px]' : ''
      }`}
    >
      <div className="w-full bg-[var(--bg-surface)]/95 border border-[var(--border-color)] shadow-2xl rounded-2xl p-3.5 sm:p-4 overflow-hidden backdrop-blur-2xl flex flex-col space-y-2.5">
        {/* Loading State */}
        {isLoading && (
          <div className="py-2.5 flex items-center justify-between text-[var(--text-secondary)]">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-3.5 h-3.5 text-[var(--accent-color)] animate-spin" />
              <p className="text-xs font-medium">Looking up with AI...</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Lookup Failed</p>
              <button
                type="button"
                onClick={onClose}
                className="p-0.5 rounded hover:bg-rose-500/20 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed">
              {error === 'MISSING_API_KEY'
                ? 'Please enter your Gemini API Key in Settings (AA) to activate AI explanations.'
                : error}
            </p>
            {error === 'MISSING_API_KEY' && onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="w-full py-1.5 rounded-lg bg-[var(--accent-color)] text-white text-[11px] font-semibold cursor-pointer shadow-sm hover:bg-[var(--accent-hover)] transition-all text-center"
              >
                Open Settings
              </button>
            )}
          </div>
        )}

        {/* Data Content */}
        {data && !isLoading && !error && (
          <div className="space-y-2">
            {data.isSentence || !data.word ? (
              /* Case 1: Long Sentence / Paragraph Explanation */
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-[var(--accent-color)] bg-[var(--accent-subtle)] px-2.5 py-1 rounded-md border border-[var(--accent-color)]/20">
                      Sentence Meaning
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center active:scale-95"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-color)]">
                  <p
                    style={{ fontSize: `${baseFontSize}px`, lineHeight: 1.6 }}
                    className="text-[var(--text-primary)] font-normal"
                  >
                    {data.contextExplanation || data.simpleDefinition}
                  </p>
                </div>
              </>
            ) : (
              /* Case 2: Single Word / Short Term Dictionary Lookup */
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <h3
                      style={{ fontSize: `${Math.round(baseFontSize * 1.25)}px` }}
                      className="font-bold text-[var(--text-primary)] capitalize leading-tight"
                    >
                      {data.word}
                    </h3>
                    {data.ipa && (
                      <span
                        style={{
                          fontFamily: 'Arial, Helvetica, sans-serif',
                          fontSize: `${Math.max(12, Math.round(baseFontSize * 0.85))}px`,
                        }}
                        className="text-[var(--text-secondary)] font-normal tracking-wide"
                      >
                        {data.ipa}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons: Pronounce & Close */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handlePlayVoice}
                      disabled={isPlayingAudio}
                      className="p-2 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center active:scale-95"
                      title="Pronounce"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center active:scale-95"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Definition & Context Body */}
                <div className="p-3 sm:p-3.5 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-color)] space-y-2">
                  {data.simpleDefinition && (
                    <p
                      style={{ fontSize: `${baseFontSize}px`, lineHeight: 1.5 }}
                      className="text-[var(--text-primary)] font-medium"
                    >
                      {data.simpleDefinition}
                    </p>
                  )}

                  {data.contextExplanation && (
                    <p
                      style={{ fontSize: `${baseFontSize}px`, lineHeight: 1.5 }}
                      className={`text-[var(--text-secondary)] italic ${
                        data.simpleDefinition ? 'border-t border-[var(--border-color)]/60 pt-2 mt-2' : ''
                      }`}
                    >
                      {data.contextExplanation}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
