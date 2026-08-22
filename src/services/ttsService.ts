import { GoogleTTSService } from './googleTTSService';
import type { ITTSSettings } from '../types/book';

export interface ITTSSentence {
  id: number;
  text: string;
  element?: HTMLElement | Node;
  charOffsetStart: number;
  charOffsetEnd: number;
}

export type TTSPlaybackState = 'idle' | 'buffering' | 'playing' | 'paused';

export interface ITTSState {
  state: TTSPlaybackState;
  currentSentenceIndex: number;
  totalSentences: number;
  currentWord?: string;
  currentSentenceText?: string;
  progressPercent: number; // 0 -> 100
}

export class TTSService {
  private static audio: HTMLAudioElement | null = null;
  private static sentences: ITTSSentence[] = [];
  private static currentIndex: number = 0;
  private static settings: ITTSSettings = {
    provider: 'google',
    voice: 'vi',
    rate: 1.0,
    pitch: 1.0,
    autoScroll: true,
  };

  private static playbackState: TTSPlaybackState = 'idle';
  private static stateListeners: Set<(state: ITTSState) => void> = new Set();
  private static playSessionId: number = 0;

  /**
   * Extract readable sentences from a Foliate EPUB document/section
   * Wraps each sentence in an inline span with data-tts-id for precise single-sentence highlight and click-to-read
   */
  static extractSentencesFromDoc(doc: Document): ITTSSentence[] {
    const list: ITTSSentence[] = [];
    if (!doc || !doc.body) return list;

    const blockNodes = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
    let sentenceId = 0;

    blockNodes.forEach((block) => {
      // If already processed, skip re-wrapping
      if (block.querySelector('[data-tts-id]')) return;

      const rawText = (block.textContent || '').trim();
      if (!rawText || rawText.length < 2) return;

      // Clean multiple whitespaces
      const cleanText = rawText.replace(/\s+/g, ' ');

      // Split into sentences using regex boundary (. ! ? ; : only if followed by space+uppercase or end)
      // Avoids splitting decimal numbers (2.5), abbreviations (U.S.), etc.
      const sentenceRegex = /[^.!?;]+(?:[.!?;]+(?!\d|[a-z]|\s*[a-z]))+|[^.!?;]+[.!?;]*$/g;
      const matches = cleanText.match(sentenceRegex);

      if (matches && matches.length > 0) {
        // Clear block and replace with wrapped sentence spans
        block.innerHTML = '';
        matches.forEach((sentencePart) => {
          const s = sentencePart.trim();
          if (s.length > 0) {
            const span = doc.createElement('span');
            span.setAttribute('data-tts-id', sentenceId.toString());
            span.className = 'velvet-tts-sentence';
            span.textContent = s;
            block.appendChild(span);
            // Append whitespace outside the highlighted span so it does not get highlighted
            block.appendChild(doc.createTextNode(' '));

            list.push({
              id: sentenceId,
              text: s,
              element: span,
              charOffsetStart: 0,
              charOffsetEnd: s.length,
            });

            sentenceId++;
          }
        });
      } else {
        const span = doc.createElement('span');
        span.setAttribute('data-tts-id', sentenceId.toString());
        span.className = 'velvet-tts-sentence';
        span.textContent = cleanText;
        block.innerHTML = '';
        block.appendChild(span);

        list.push({
          id: sentenceId,
          text: cleanText,
          element: span,
          charOffsetStart: 0,
          charOffsetEnd: cleanText.length,
        });

        sentenceId++;
      }
    });

    this.sentences = list;
    this.notifyState();
    return list;
  }

  /**
   * Start playback from a specific sentence index, or resume
   */
  static async play(startIndex?: number) {
    if (typeof startIndex === 'number') {
      this.currentIndex = Math.max(0, Math.min(startIndex, this.sentences.length - 1));
      this.playbackState = 'playing';
      await this.playCurrentSentence();
      return;
    }

    if (this.sentences.length === 0) return;

    // If currently paused and we have an active audio instance, resume it
    if (this.playbackState === 'paused' && this.audio && !this.audio.ended && this.audio.paused) {
      try {
        this.playbackState = 'playing';
        this.notifyState();
        await this.audio.play();
        return;
      } catch (e) {
        console.warn('Could not resume audio, restarting sentence:', e);
      }
    }

    this.playbackState = 'playing';
    await this.playCurrentSentence();
  }

  /**
   * Play the current sentence based on selected provider
   */
  private static async playCurrentSentence() {
    this.stopAudio();

    if (this.currentIndex >= this.sentences.length) {
      this.playbackState = 'idle';
      this.notifyState();
      return;
    }

    const sessionId = ++this.playSessionId;
    const currentSentence = this.sentences[this.currentIndex];
    
    // Highlight and Auto-scroll active sentence in Foliate EPUB document immediately
    this.highlightSentence(currentSentence);
    
    // Ensure state is playing / buffering
    this.playbackState = 'playing';
    this.notifyState();

    try {
      const audioBlob = await GoogleTTSService.synthesize(
        currentSentence.text,
        this.settings.voice || 'vi',
        this.settings.rate
      );

      // Stale check: If session changed or user paused/stopped while downloading
      if (sessionId !== this.playSessionId || this.playbackState !== 'playing') {
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      this.audio = audio;
      audio.playbackRate = this.settings.rate || 1.0;

      // Smart Prefetch: Preload next sentence in background while listening to current sentence
      if (this.currentIndex + 1 < this.sentences.length) {
        const nextSentence = this.sentences[this.currentIndex + 1];
        GoogleTTSService.prefetch(nextSentence.text, this.settings.voice || 'vi', this.settings.rate);
      }

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.clearSentenceHighlight(currentSentence);
        if (this.playbackState === 'playing' && sessionId === this.playSessionId) {
          this.currentIndex++;
          if (this.currentIndex < this.sentences.length) {
            this.playCurrentSentence();
          } else {
            this.playbackState = 'idle';
            this.notifyState();
          }
        }
      };

      audio.onerror = (e) => {
        console.warn('Audio element error:', e);
        this.clearSentenceHighlight(currentSentence);
        if (this.playbackState === 'playing' && sessionId === this.playSessionId) {
          // Try skip to next sentence instead of crashing to idle
          this.currentIndex++;
          if (this.currentIndex < this.sentences.length) {
            this.playCurrentSentence();
          } else {
            this.playbackState = 'idle';
            this.notifyState();
          }
        }
      };

      await audio.play();
    } catch (err) {
      if (sessionId === this.playSessionId) {
        console.warn('Google TTS failed:', err);
        this.clearSentenceHighlight(currentSentence);
        this.playbackState = 'idle';
        this.notifyState();
      }
    }
  }

  /**
   * Highlight active sentence in DOM and scroll into view
   */
  private static highlightSentence(sentence: ITTSSentence) {
    if (!sentence || !sentence.element) return;
    const el = sentence.element as HTMLElement;

    try {
      // Remove any previously active highlights
      const doc = el.ownerDocument || document;
      doc.querySelectorAll('.velvet-tts-active-sentence').forEach((node) => {
        node.classList.remove('velvet-tts-active-sentence');
      });

      // Add highlight class
      el.classList.add('velvet-tts-active-sentence');

      // Auto-scroll into view if enabled
      if (this.settings.autoScroll !== false && el.scrollIntoView) {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
    } catch (err) {
      console.warn('Could not highlight sentence element:', err);
    }
  }

  private static clearSentenceHighlight(sentence?: ITTSSentence) {
    try {
      if (sentence?.element) {
        const el = sentence.element as HTMLElement;
        const doc = el.ownerDocument || document;
        doc.querySelectorAll('.velvet-tts-active-sentence').forEach((node) => {
          node.classList.remove('velvet-tts-active-sentence');
        });
      }
    } catch {}
  }

  /**
   * Pause current playback
   */
  static pause() {
    this.playSessionId++; // Invalidate any pending async fetches immediately
    if (this.audio) {
      this.audio.pause();
    }
    this.playbackState = 'paused';
    this.notifyState();
  }

  /**
   * Stop playback completely
   */
  static stop() {
    this.playSessionId++;
    this.stopAudio();
    this.playbackState = 'idle';
    this.notifyState();
  }

  /**
   * Previous Sentence
   */
  static prevSentence() {
    this.currentIndex = Math.max(0, this.currentIndex - 1);
    if (this.playbackState === 'playing' || this.playbackState === 'buffering') {
      this.playCurrentSentence();
    } else {
      this.notifyState();
    }
  }

  /**
   * Next Sentence
   */
  static nextSentence() {
    this.currentIndex = Math.min(this.sentences.length - 1, this.currentIndex + 1);
    if (this.playbackState === 'playing' || this.playbackState === 'buffering') {
      this.playCurrentSentence();
    } else {
      this.notifyState();
    }
  }

  /**
   * Seek sentence by index
   */
  static seekSentence(index: number) {
    this.currentIndex = Math.max(0, Math.min(index, this.sentences.length - 1));
    if (this.playbackState === 'playing') {
      this.playCurrentSentence();
    } else {
      this.notifyState();
    }
  }

  /**
   * Update TTS Settings
   */
  static updateSettings(newSettings: Partial<ITTSSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    
    // Apply speed change immediately to the currently playing audio without reloading
    if (this.audio && typeof newSettings.rate === 'number') {
      this.audio.playbackRate = newSettings.rate;
    }
  }

  /**
   * Fetch Oxford Dictionary UK (GB) native pronunciation audio stream from Google Dictionary CDN.
   * Format: https://ssl.gstatic.com/dictionary/static/sounds/oxford/{word}--_gb_1.mp3
   * If plural/inflected word (e.g. "rafts", "islands"), tries stem word (e.g. "raft", "island").
   */
  private static async getOxfordAudioUrl(word: string): Promise<string | null> {
    try {
      const cleanWord = word.toLowerCase().replace(/[^a-z'-]/g, '');
      if (!cleanWord || cleanWord.length > 40) return null;

      // 1. Try exact word
      const primaryUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(cleanWord)}--_gb_1.mp3`;
      try {
        const res = await fetch(primaryUrl);
        if (res.ok && res.status === 200) {
          return primaryUrl;
        }
      } catch {}

      // 2. If plural/inflected form (e.g. "rafts" -> "raft", "islands" -> "island", "babies" -> "baby")
      const candidateStems: string[] = [];
      if (cleanWord.endsWith('ies') && cleanWord.length > 4) {
        candidateStems.push(cleanWord.slice(0, -3) + 'y');
      }
      if (cleanWord.endsWith('es') && cleanWord.length > 3) {
        candidateStems.push(cleanWord.slice(0, -2));
      }
      if (cleanWord.endsWith('s') && !cleanWord.endsWith('ss') && cleanWord.length > 2) {
        candidateStems.push(cleanWord.slice(0, -1));
      }
      if (cleanWord.endsWith('ed') && cleanWord.length > 3) {
        candidateStems.push(cleanWord.slice(0, -2));
        candidateStems.push(cleanWord.slice(0, -1)); // e.g. "reached" -> "reach"
      }
      if (cleanWord.endsWith('ing') && cleanWord.length > 4) {
        candidateStems.push(cleanWord.slice(0, -3) + 'e'); // e.g. "expunging" -> "expunge", "making" -> "make"
        candidateStems.push(cleanWord.slice(0, -3));       // e.g. "reading" -> "read"
      }

      for (const stem of candidateStems) {
        const stemUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(stem)}--_gb_1.mp3`;
        try {
          const res = await fetch(stemUrl);
          if (res.ok && res.status === 200) {
            return stemUrl;
          }
        } catch {}
      }
    } catch {
      // Ignore lookup errors
    }
    return null;
  }

  /**
   * Play standalone text selection directly (Quick Shortcut)
   * If single word: tries Oxford GB native audio first, then falls back to Google TTS.
   * If sentence / phrase: uses Google TTS.
   * Stops any ongoing speech and immediately plays the selected text.
   * If re-called while same or new text is selected, immediately stops previous and replays.
   */
  static async playQuickSelection(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      this.stop();
      return;
    }

    // Stop current session completely
    this.stop();
    const sessionId = ++this.playSessionId;
    this.playbackState = 'playing';
    this.notifyState();

    try {
      let audioUrl: string | null = null;
      let isBlob = false;

      // Check if it is a single word (no internal spaces, letters and hyphens only)
      const words = trimmed.split(/\s+/);
      const isSingleWord = words.length === 1 && /^[a-zA-Z'-]+[.,!?]?$/.test(trimmed);

      if (isSingleWord) {
        // Try Oxford / UK Dictionary native voice first
        audioUrl = await this.getOxfordAudioUrl(trimmed);
      }

      // If not single word or Oxford audio wasn't found, fallback to Google TTS
      // Auto-detect language, but use en-GB for English text
      const detectedLang = GoogleTTSService.detectLanguage(trimmed);
      const resolvedLang = detectedLang === 'en' ? 'en-GB' : detectedLang;
      const audioBlob = await GoogleTTSService.synthesize(
        trimmed,
        resolvedLang,
        this.settings.rate || 1.0
      );
      if (sessionId !== this.playSessionId) return;
      audioUrl = URL.createObjectURL(audioBlob);
      isBlob = true;

      if (sessionId !== this.playSessionId || !audioUrl) return;

      const audio = new Audio(audioUrl);
      this.audio = audio;
      audio.playbackRate = this.settings.rate || 1.0;

      audio.onended = () => {
        if (isBlob && audioUrl) URL.revokeObjectURL(audioUrl);
        if (sessionId === this.playSessionId) {
          this.playbackState = 'idle';
          this.notifyState();
        }
      };

      audio.onerror = async () => {
        if (isBlob && audioUrl) URL.revokeObjectURL(audioUrl);

        // If Oxford audio failed to load in audio element, perform fallback to Google TTS with Auto language
        if (!isBlob && sessionId === this.playSessionId) {
          try {
            const fallbackBlob = await GoogleTTSService.synthesize(
              trimmed,
              'auto',
              this.settings.rate || 1.0
            );
            if (sessionId !== this.playSessionId) return;
            const fbUrl = URL.createObjectURL(fallbackBlob);
            const fbAudio = new Audio(fbUrl);
            this.audio = fbAudio;
            fbAudio.playbackRate = this.settings.rate || 1.0;
            fbAudio.onended = () => {
              URL.revokeObjectURL(fbUrl);
              if (sessionId === this.playSessionId) {
                this.playbackState = 'idle';
                this.notifyState();
              }
            };
            await fbAudio.play();
            return;
          } catch {}
        }

        if (sessionId === this.playSessionId) {
          this.playbackState = 'idle';
          this.notifyState();
        }
      };

      await audio.play();
    } catch (err) {
      if (sessionId === this.playSessionId) {
        console.warn('Quick selection TTS error:', err);
        this.playbackState = 'idle';
        this.notifyState();
      }
    }
  }

  /**
   * Helper to stop both audio and synthesis
   */
  private static stopAudio() {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.src = '';
      } catch {}
      this.audio = null;
    }
    const current = this.sentences[this.currentIndex];
    this.clearSentenceHighlight(current);
  }

  /**
   * Subscribe to TTS state changes
   */
  static subscribe(listener: (state: ITTSState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private static notifyState(currentWord?: string) {
    const state = this.getState(currentWord);
    this.stateListeners.forEach((l) => l(state));
  }

  static getState(currentWord?: string): ITTSState {
    const currentSentence = this.sentences[this.currentIndex];
    const total = this.sentences.length;
    const progress = total > 0 ? Math.round((this.currentIndex / total) * 100) : 0;

    return {
      state: this.playbackState,
      currentSentenceIndex: this.currentIndex,
      totalSentences: total,
      currentWord: currentWord,
      currentSentenceText: currentSentence?.text || '',
      progressPercent: progress,
    };
  }

  static getCurrentSentence(): ITTSSentence | undefined {
    return this.sentences[this.currentIndex];
  }
}
