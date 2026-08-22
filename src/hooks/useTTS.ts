import { useState, useEffect, useCallback } from 'react';
import { TTSService, ITTSState } from '../services/ttsService';
import type { ITTSSettings } from '../types/book';

export function useTTS(initialSettings?: ITTSSettings) {
  const [ttsState, setTtsState] = useState<ITTSState>(TTSService.getState());

  useEffect(() => {
    if (initialSettings) {
      TTSService.updateSettings(initialSettings);
    }
  }, [initialSettings?.voice, initialSettings?.rate, initialSettings?.provider, initialSettings?.autoScroll]);

  useEffect(() => {
    const unsubscribe = TTSService.subscribe((state) => {
      setTtsState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const play = useCallback((startIndex?: number) => {
    TTSService.play(startIndex);
  }, []);

  const pause = useCallback(() => {
    TTSService.pause();
  }, []);

  const stop = useCallback(() => {
    TTSService.stop();
  }, []);

  const prevSentence = useCallback(() => {
    TTSService.prevSentence();
  }, []);

  const nextSentence = useCallback(() => {
    TTSService.nextSentence();
  }, []);

  const seekSentence = useCallback((index: number) => {
    TTSService.seekSentence(index);
  }, []);

  const updateSettings = useCallback((settings: Partial<ITTSSettings>) => {
    TTSService.updateSettings(settings);
  }, []);

  return {
    ...ttsState,
    isPlaying: ttsState.state === 'playing',
    isBuffering: ttsState.state === 'buffering',
    isPaused: ttsState.state === 'paused',
    isIdle: ttsState.state === 'idle',
    play,
    pause,
    stop,
    prevSentence,
    nextSentence,
    seekSentence,
    updateSettings,
  };
}
