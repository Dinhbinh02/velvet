import React, { useState, useEffect } from 'react';
import {
  Waves,
  Volume2,
  VolumeX,
  Square,
  Play,
  Check,
  X,
  Loader2,
  Radio,
} from 'lucide-react';
import {
  AmbientSoundService,
  AMBIENT_SOUNDS,
  type AmbientSoundType,
} from '@/src/services/ambientSoundService';

interface AmbientSoundModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AmbientSoundModal: React.FC<AmbientSoundModalProps> = ({ isOpen, onClose }) => {
  const [ambientState, setAmbientState] = useState(() => AmbientSoundService.getState());
  const [filterCategory, setFilterCategory] = useState<'all' | 'radio' | 'rain' | 'water' | 'nature' | 'focus'>('all');

  useEffect(() => {
    return AmbientSoundService.subscribe(() => {
      setAmbientState(AmbientSoundService.getState());
    });
  }, []);

  if (!isOpen) return null;

  const handleSelectAmbient = (sound: AmbientSoundType) => {
    AmbientSoundService.toggleSound(sound);
  };

  const handleStopAll = () => {
    AmbientSoundService.stop();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    AmbientSoundService.setVolume(parseFloat(e.target.value));
  };

  const filteredAmbientSounds = AMBIENT_SOUNDS.filter((sound) => {
    if (filterCategory === 'all') return true;
    return sound.category === filterCategory;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[580px] max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-color)] flex items-center justify-center shadow-xs">
              <Waves className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Ambient & Live Radios</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Live Radios, Nature Soundscapes & Focus Noise
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filter Bar & Volume Controls */}
        <div className="px-5 pt-3 pb-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--border-color)]/50">
          <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] p-0.5 rounded-xl text-xs font-semibold overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden h-9">
            <button
              onClick={() => setFilterCategory('all')}
              className={`h-full px-3 rounded-lg transition-all cursor-pointer shrink-0 flex items-center ${
                filterCategory === 'all'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterCategory('radio')}
              className={`h-full px-3 rounded-lg transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                filterCategory === 'radio'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-color)] shadow-sm font-bold border border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Radio className="w-3 h-3 text-emerald-500" />
              <span>Live Radios</span>
            </button>
            <button
              onClick={() => setFilterCategory('rain')}
              className={`h-full px-3 rounded-lg transition-all cursor-pointer shrink-0 flex items-center ${
                filterCategory === 'rain'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Rain & Storm
            </button>
            <button
              onClick={() => setFilterCategory('water')}
              className={`h-full px-3 rounded-lg transition-all cursor-pointer shrink-0 flex items-center ${
                filterCategory === 'water'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              River & Ocean
            </button>
            <button
              onClick={() => setFilterCategory('nature')}
              className={`h-full px-3 rounded-lg transition-all cursor-pointer shrink-0 flex items-center ${
                filterCategory === 'nature'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Wind & Forest
            </button>
            <button
              onClick={() => setFilterCategory('focus')}
              className={`h-full px-3 rounded-lg transition-all cursor-pointer shrink-0 flex items-center ${
                filterCategory === 'focus'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Focus Noise
            </button>
          </div>

          {/* Volume Control & Stop Button */}
          <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] px-3 rounded-xl shrink-0 h-9">
            <button
              onClick={() => AmbientSoundService.setVolume(ambientState.volume === 0 ? 0.5 : 0)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              title={ambientState.volume === 0 ? 'Unmute' : 'Mute'}
            >
              {ambientState.volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={ambientState.volume}
              onChange={handleVolumeChange}
              className="w-20 sm:w-28 h-1 bg-[var(--border-color)] accent-[var(--accent-color)] rounded-lg cursor-pointer"
            />
            <span className="text-[10px] font-mono text-[var(--text-muted)] w-7 text-right">
              {Math.round(ambientState.volume * 100)}%
            </span>
            {ambientState.isPlaying && (
              <button
                onClick={handleStopAll}
                className="ml-1 px-2 py-0.5 rounded-lg bg-[var(--accent-subtle)] hover:opacity-85 text-[var(--accent-color)] border border-[var(--accent-color)]/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Stop playback"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            )}
          </div>
        </div>

        {/* Minimalist Cards Grid (Hidden native scrollbar) */}
        <div className="flex-1 overflow-y-auto p-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredAmbientSounds.map((sound) => {
              const isActive = ambientState.isPlaying && ambientState.currentSound === sound.id;

              return (
                <div
                  key={sound.id}
                  onClick={() => handleSelectAmbient(sound.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[76px] relative select-none ${
                    isActive
                      ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] text-[var(--accent-color)] shadow-xs ring-1 ring-[var(--accent-color)]/30'
                      : 'border-[var(--border-color)] bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {sound.isLiveRadio && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                        )}
                        <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {sound.label}
                        </h4>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1">
                        {sound.description}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-md bg-[var(--accent-color)] text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                          {ambientState.isLoading ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Check className="w-2.5 h-2.5" />
                          )}
                          <span>{ambientState.isLoading ? 'Connecting' : (sound.isLiveRadio ? 'Live' : 'Playing')}</span>
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] flex items-center justify-center hover:text-[var(--text-primary)] transition-colors">
                          <Play className="w-2.5 h-2.5 fill-current" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
