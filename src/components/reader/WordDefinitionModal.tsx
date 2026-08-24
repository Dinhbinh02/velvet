import React, { useState } from 'react';
import { X, Volume2, Loader2 } from 'lucide-react';
import type { IWordExplanation } from '@/src/services/geminiAIService';
import { TTSService } from '@/src/services/ttsService';

interface WordDefinitionModalProps {
  data: IWordExplanation | null;
  isLoading: boolean;
  error: string | null;
  fontFamily?: string;
  fontSize?: number;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const WordDefinitionModal: React.FC<WordDefinitionModalProps> = React.memo(({
  data,
  isLoading,
  error,
  fontFamily,
  fontSize = 18,
  onClose,
  onOpenSettings,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const baseFontSize = fontSize || 18;

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
      }}
      className="fixed bottom-5 right-5 sm:right-8 z-50 w-[calc(100vw-2.5rem)] max-w-sm sm:max-w-md md:max-w-lg sm:w-[460px] md:w-[480px] pointer-events-auto transform-gpu"
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
            {/* Unified Header: Word, Part of Speech, IPA + Controls */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3
                  style={{ fontSize: `${Math.round(baseFontSize * 1.25)}px` }}
                  className="font-bold text-[var(--text-primary)] capitalize leading-tight"
                >
                  {data.word}
                </h3>
                {data.partOfSpeech && (
                  <span
                    style={{ fontSize: `${Math.max(11, Math.round(baseFontSize * 0.72))}px` }}
                    className="font-semibold italic text-[var(--text-muted)] px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)]"
                  >
                    {data.partOfSpeech}
                  </span>
                )}
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
              <p
                style={{ fontSize: `${baseFontSize}px`, lineHeight: 1.5 }}
                className="text-[var(--text-primary)] font-medium"
              >
                {data.simpleDefinition}
              </p>

              {data.contextExplanation && (
                <p
                  style={{ fontSize: `${Math.max(12, Math.round(baseFontSize * 0.9))}px`, lineHeight: 1.5 }}
                  className="text-[var(--text-secondary)] italic border-t border-[var(--border-color)]/60 pt-2 mt-2"
                >
                  {data.contextExplanation}
                </p>
              )}
            </div>

            {/* Synonyms Pills */}
            {data.synonyms && data.synonyms.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span
                  style={{ fontSize: `${Math.max(10, Math.round(baseFontSize * 0.7))}px` }}
                  className="font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0"
                >
                  Synonyms:
                </span>
                {data.synonyms.slice(0, 4).map((syn, idx) => (
                  <span
                    key={idx}
                    style={{ fontSize: `${Math.max(11, Math.round(baseFontSize * 0.8))}px` }}
                    className="px-2 py-0.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] font-medium text-[var(--text-secondary)]"
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
});
