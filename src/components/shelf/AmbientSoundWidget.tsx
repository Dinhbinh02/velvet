import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Play, Square, Sparkles } from 'lucide-react';
import {
  AmbientSoundService,
  AMBIENT_SOUNDS,
  type AmbientSoundType,
} from '@/src/services/ambientSoundService';

export const AmbientSoundWidget: React.FC = () => {
  const [state, setState] = useState(() => AmbientSoundService.getState());

  useEffect(() => {
    return AmbientSoundService.subscribe(() => {
      setState(AmbientSoundService.getState());
    });
  }, []);

  const handleSelectSound = (sound: AmbientSoundType) => {
    AmbientSoundService.toggleSound(sound);
  };

  const handleStop = () => {
    AmbientSoundService.stop();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    AmbientSoundService.setVolume(parseFloat(e.target.value));
  };

  const currentSoundItem = AMBIENT_SOUNDS.find((s) => s.id === state.currentSound);

  return (
    <div className="w-full p-4 sm:p-5 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xs space-y-3.5 select-none">
      {/* Header: Title + Volume Control + Status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            state.isPlaying
              ? 'bg-[var(--accent-color)] text-white shadow-xs animate-pulse'
              : 'bg-[var(--accent-subtle)] text-[var(--accent-color)]'
          }`}>
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[var(--text-primary)]">Ambient Noise & Soundscapes</h3>
              {state.isPlaying && currentSoundItem && (
                <span className="text-[10px] font-bold text-[var(--accent-color)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded-md animate-in fade-in flex items-center gap-1">
                  <span>{currentSoundItem.emoji}</span>
                  <span>{currentSoundItem.label}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">Relaxing background sounds for deep reading focus</p>
          </div>
        </div>

        {/* Volume & Stop Control */}
        <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] px-2.5 py-1 rounded-xl shrink-0">
          <button
            onClick={() => AmbientSoundService.setVolume(state.volume === 0 ? 0.5 : 0)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            title={state.volume === 0 ? 'Unmute' : 'Mute'}
          >
            {state.volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state.volume}
            onChange={handleVolumeChange}
            className="w-16 sm:w-20 h-1 bg-[var(--border-color)] accent-[var(--accent-color)] rounded-lg cursor-pointer"
            title={`Volume: ${Math.round(state.volume * 100)}%`}
          />
          {state.isPlaying && (
            <button
              onClick={handleStop}
              className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 transition-all cursor-pointer ml-1"
              title="Stop sound"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          )}
        </div>
      </div>

      {/* Grid of Sound Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-5 gap-2">
        {AMBIENT_SOUNDS.map((sound) => {
          const isActive = state.isPlaying && state.currentSound === sound.id;
          return (
            <button
              key={sound.id}
              onClick={() => handleSelectSound(sound.id)}
              className={`p-2.5 rounded-2xl text-left transition-all border flex flex-col justify-between gap-1.5 cursor-pointer relative overflow-hidden group ${
                isActive
                  ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] text-[var(--accent-color)] shadow-xs scale-102 ring-1 ring-[var(--accent-color)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-surface)]'
              }`}
              title={sound.description}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-lg">{sound.emoji}</span>
                {isActive ? (
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-color)] animate-ping" />
                ) : (
                  <Play className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold block truncate">{sound.label}</span>
                <span className="text-[9px] text-[var(--text-muted)] block truncate">{sound.description}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
