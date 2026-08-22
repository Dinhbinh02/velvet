import React, { useState } from 'react';
import { X, Volume2, Loader2, Bot } from 'lucide-react';
import type { IWordExplanation } from '@/src/services/geminiAIService';
import { TTSService } from '@/src/services/ttsService';

interface WordDefinitionModalProps {
  data: IWordExplanation | null;
  isLoading: boolean;
  error: string | null;
  fontFamily?: string;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const WordDefinitionModal: React.FC<WordDefinitionModalProps> = ({
  data,
  isLoading,
  error,
  fontFamily,
  onClose,
  onOpenSettings,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

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

  // Measure iframe body / text element right offset dynamically to match exact text edge
  const [rightOffset, setRightOffset] = useState<number | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      try {
        const foliateView = document.querySelector('foliate-view') as any;
        const shadowRoot = foliateView?.shadowRoot;
        const iframe = shadowRoot ? shadowRoot.querySelector('iframe') : document.querySelector('iframe');

        if (iframe) {
          const iframeRect = iframe.getBoundingClientRect();
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          const textEl = doc?.querySelector('p, h1, h2, h3, body') as HTMLElement | null;

          if (textEl) {
            const textRect = textEl.getBoundingClientRect();
            // Calculate distance from right edge of window to right edge of text inside iframe
            const textRightAbsolute = iframeRect.left + textRect.right;
            const distFromWindowRight = window.innerWidth - textRightAbsolute;
            if (distFromWindowRight >= 0 && distFromWindowRight < window.innerWidth) {
              setRightOffset(Math.max(16, distFromWindowRight));
              return;
            }
          }

          // Fallback to iframe right edge
          const distFromWindowRight = window.innerWidth - iframeRect.right;
          setRightOffset(Math.max(16, distFromWindowRight + 20));
        }
      } catch {}
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [data, isLoading]);

  return (
    <div
      style={{
        right: rightOffset !== null ? `${rightOffset}px` : '40px',
        ...(fontFamily ? { fontFamily } : {}),
      }}
      className="absolute bottom-6 z-50 w-96 sm:w-[420px] max-w-[calc(100vw-3rem)] animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto"
    >
      <div className="w-full bg-[var(--bg-surface)]/95 border border-[var(--border-color)] shadow-2xl rounded-2xl p-4.5 overflow-hidden backdrop-blur-2xl flex flex-col space-y-3">
        {/* Close Button Top Right */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[var(--accent-color)]">
            <Bot className="w-4 h-4" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 -mr-1 -mt-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-4 flex items-center justify-center space-x-2 text-[var(--text-secondary)]">
            <Loader2 className="w-4 h-4 text-[var(--accent-color)] animate-spin" />
            <p className="text-xs font-medium">Explaining with AI...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs space-y-2">
            <p className="font-semibold">Lookup Failed</p>
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
          <div className="space-y-2.5">
            {/* Word Header, IPA & Audio */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[18px] font-bold text-[var(--text-primary)] capitalize leading-tight">
                    {data.word}
                  </h3>
                  {data.partOfSpeech && (
                    <span className="text-[11px] font-semibold italic text-[var(--text-muted)] px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                      {data.partOfSpeech}
                    </span>
                  )}
                </div>
                {data.ipa && (
                  <p className="text-xs font-mono text-[var(--text-secondary)] leading-tight">
                    {data.ipa}
                  </p>
                )}
              </div>

              {/* Speaker Audio Button */}
              <button
                type="button"
                onClick={handlePlayVoice}
                disabled={isPlayingAudio}
                className="p-2 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white transition-all cursor-pointer shrink-0 disabled:opacity-50"
                title="Pronounce"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* Simple Definition (16px / text-base) */}
            <div className="p-3 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-color)]/70 space-y-1.5">
              <p className="text-[16px] leading-relaxed text-[var(--text-primary)] font-medium">
                {data.simpleDefinition}
              </p>

              {data.contextExplanation && (
                <p className="text-[13px] text-[var(--text-secondary)] italic border-t border-[var(--border-color)]/50 pt-1.5 mt-1.5 leading-snug">
                  💡 {data.contextExplanation}
                </p>
              )}
            </div>

            {/* Synonyms Pills */}
            {data.synonyms && data.synonyms.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0">
                  Synonyms:
                </span>
                {data.synonyms.slice(0, 4).map((syn, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[12px] font-medium text-[var(--text-secondary)]"
                  >
                    {syn}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
