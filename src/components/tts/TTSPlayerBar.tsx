import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Sparkles,
  ChevronDown,
  X,
  Check,
} from 'lucide-react';
import { useTTS } from '../../hooks/useTTS';
import { GOOGLE_VOICES, IGoogleVoice } from '../../services/googleTTSService';
import type { ITTSSettings } from '../../types/book';

interface TTSPlayerBarProps {
  ttsSettings?: ITTSSettings;
  onUpdateSettings?: (settings: Partial<ITTSSettings>) => void;
  onClose?: () => void;
}

export const TTSPlayerBar: React.FC<TTSPlayerBarProps> = ({
  ttsSettings,
  onUpdateSettings,
  onClose,
}) => {
  const {
    isPlaying,
    isBuffering,
    currentSentenceIndex,
    totalSentences,
    progressPercent,
    play,
    pause,
    stop,
    prevSentence,
    nextSentence,
    updateSettings,
  } = useTTS(ttsSettings);

  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showSpeedModal, setShowSpeedModal] = useState(false);

  const currentVoiceId = ttsSettings?.voice || 'vi';
  const currentRate = ttsSettings?.rate || 1.0;

  // Find active voice display name
  const activeGoogleVoice = GOOGLE_VOICES.find((v) => v.id === currentVoiceId);
  const currentVoiceLabel = activeGoogleVoice?.name || 'Google Tiếng Việt';

  const handleRateChange = (rate: number) => {
    updateSettings({ rate });
    onUpdateSettings?.({ rate });
    setShowSpeedModal(false);
  };

  const handleVoiceSelect = (voiceId: string) => {
    updateSettings({ voice: voiceId, provider: 'google' });
    onUpdateSettings?.({ voice: voiceId, provider: 'google' });
    setShowVoiceModal(false);
  };

  return (
    <>
      {/* Ultra-Compact, Minimalist Floating Pill Audio Player */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--bg-surface)]/90 backdrop-blur-2xl border border-[var(--border-color)]/80 shadow-2xl rounded-full p-2 px-3 sm:px-4 flex items-center gap-2 sm:gap-3.5 animate-in slide-in-from-bottom-4 duration-200 select-none max-w-[95vw]">
        {/* Voice Selector Pill */}
        <button
          type="button"
          onClick={() => setShowVoiceModal(true)}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--border-color)]/60 text-xs font-medium text-[var(--text-primary)] transition-all cursor-pointer truncate max-w-[130px] sm:max-w-[170px]"
          title="Change Voice"
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
          <span className="truncate">{currentVoiceLabel}</span>
          <ChevronDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
        </button>

        {/* Vertical Divider */}
        <div className="w-px h-5 bg-[var(--border-color)]/60" />

        {/* Center Playback Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevSentence}
            className="p-1.5 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Previous Sentence"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isPlaying || isBuffering) pause();
              else play();
            }}
            className="p-2.5 rounded-full bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center relative group"
            title={isPlaying || isBuffering ? 'Pause' : 'Play'}
          >
            {isPlaying || isBuffering ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={nextSentence}
            className="p-1.5 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Next Sentence"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Micro Timeline Slider */}
        <div
          onClick={(e) => {
            if (totalSentences <= 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            const targetIdx = Math.floor(pos * totalSentences);
            play(targetIdx);
          }}
          className="w-16 sm:w-24 h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden cursor-pointer relative group hidden sm:block"
          title={`Sentence ${currentSentenceIndex + 1}/${totalSentences} (${progressPercent}%)`}
        >
          <div
            className="h-full bg-[var(--accent-color)] transition-all duration-150 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Vertical Divider */}
        <div className="w-px h-5 bg-[var(--border-color)]/60" />

        {/* Speed Controls */}
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSpeedModal(!showSpeedModal)}
              className="py-1 px-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--border-color)]/60 text-[11px] font-mono font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Playback Speed"
            >
              {currentRate}x
            </button>

            {showSpeedModal && (
              <div className="absolute right-0 bottom-full mb-3 p-1.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xl flex flex-col gap-1 z-50 min-w-[85px] animate-in fade-in zoom-in-95 duration-150">
                {[0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleRateChange(rate)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-mono text-left transition-colors flex items-center justify-between cursor-pointer ${
                      currentRate === rate
                        ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] font-bold'
                        : 'hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{rate}x</span>
                    {currentRate === rate && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                stop();
                onClose();
              }}
              className="p-1.5 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Close Player"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Voice Selection Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-surface)]">
              <div>
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Google Translate Voice</h3>
                <p className="text-xs text-[var(--text-muted)]">Instant &bull; Free &bull; High Reliability</p>
              </div>
              <button
                type="button"
                onClick={() => setShowVoiceModal(false)}
                className="p-1.5 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Voice List Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              <div className="space-y-1.5">
                {GOOGLE_VOICES.map((v: IGoogleVoice) => {
                  const isSelected = currentVoiceId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => handleVoiceSelect(v.id)}
                      className={`w-full p-3 rounded-2xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer group ${
                        isSelected
                          ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] text-[var(--accent-color)] font-semibold shadow-xs'
                          : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="text-lg shrink-0">{v.flag}</span>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{v.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">{v.accent}</p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 shrink-0 font-bold" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
