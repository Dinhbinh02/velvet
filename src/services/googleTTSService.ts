/**
 * Google Translate TTS Service
 * Free, lightweight, instant speech synthesis using Google Translate audio engine.
 * Supports Vietnamese (vi), English (en), and auto language detection with chunking for long sentences.
 */

export interface IGoogleVoice {
  id: string;
  name: string;
  lang: string;
  flag: string;
  accent: string;
}

export const GOOGLE_VOICES: IGoogleVoice[] = [
  {
    id: 'vi',
    name: 'Google Tiếng Việt (Chị Google)',
    lang: 'vi',
    flag: '🇻🇳',
    accent: 'Việt Nam',
  },
  {
    id: 'en',
    name: 'Google English (US)',
    lang: 'en',
    flag: '🇺🇸',
    accent: 'United States',
  },
  {
    id: 'en-uk',
    name: 'Google English (UK)',
    lang: 'en-GB',
    flag: '🇬🇧',
    accent: 'British',
  },
  {
    id: 'fr',
    name: 'Google Français',
    lang: 'fr',
    flag: '🇫🇷',
    accent: 'French',
  },
  {
    id: 'ja',
    name: 'Google 日本語',
    lang: 'ja',
    flag: '🇯🇵',
    accent: 'Japanese',
  },
  {
    id: 'zh',
    name: 'Google 中文 (Mandarin)',
    lang: 'zh-CN',
    flag: '🇨🇳',
    accent: 'Chinese',
  },
];

/**
 * Velvet IndexedDB Persistent Audio Cache (Auto-expires after 24h)
 * Modeled after LuminaAudioCacheDB for high performance & offline resilience.
 */
class VelvetAudioCacheDB {
  private static DB_NAME = 'VelvetAudioCacheDB';
  private static DB_VERSION = 1;
  private static STORE_NAME = 'audio_entries';
  private static db: IDBDatabase | null = null;

  private static init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve(this.db);
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
      request.onsuccess = (e: any) => {
        this.db = e.target.result;
        resolve(this.db!);
      };
      request.onerror = (e: any) => reject(e.target.error);
    });
  }

  static async put(key: string, blob: Blob): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.put({ blob, timestamp: Date.now() }, key);
        req.onsuccess = () => resolve();
        req.onerror = (e: any) => reject(e.target.error);
      });
    } catch {}
  }

  static async get(key: string): Promise<Blob | null> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          const res = req.result;
          if (res) {
            // 1 hour TTL expiration check (1 * 60 * 60 * 1000)
            if (Date.now() - res.timestamp > 1 * 60 * 60 * 1000) {
              this.delete(key).catch(() => {});
              resolve(null);
            } else {
              resolve(res.blob);
            }
          } else {
            resolve(null);
          }
        };
        req.onerror = (e: any) => reject(e.target.error);
      });
    } catch {
      return null;
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = (e: any) => reject(e.target.error);
      });
    } catch {}
  }
}

export class GoogleTTSService {
  // In-memory audio cache for zero-latency repeats
  private static memoryCache: Map<string, Blob> = new Map();
  private static activePrefetches: Map<string, Promise<Blob>> = new Map();
  private static audioCtx: AudioContext | null = null;

  /**
   * Trims leading and trailing silence from AudioBuffer
   * Replicates Lumina offscreen silence-trimming algorithm.
   */
  private static trimAudioBufferSilence(audioBuffer: AudioBuffer, threshold = 0.002): AudioBuffer {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    let firstSoundIndex = audioBuffer.length;
    let lastSoundIndex = 0;

    for (let c = 0; c < numChannels; c++) {
      const channelData = audioBuffer.getChannelData(c);
      for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) > threshold) {
          if (i < firstSoundIndex) firstSoundIndex = i;
          break;
        }
      }
      for (let i = channelData.length - 1; i >= 0; i--) {
        if (Math.abs(channelData[i]) > threshold) {
          if (i > lastSoundIndex) lastSoundIndex = i;
          break;
        }
      }
    }

    if (firstSoundIndex >= audioBuffer.length || (firstSoundIndex === 0 && lastSoundIndex >= audioBuffer.length - 1)) {
      return audioBuffer;
    }

    const trimmedLength = Math.max(1, lastSoundIndex - firstSoundIndex + 1);
    const ctx = this.getAudioContext();
    const trimmedBuffer = ctx.createBuffer(numChannels, trimmedLength, sampleRate);

    for (let c = 0; c < numChannels; c++) {
      const channelData = audioBuffer.getChannelData(c);
      const trimmedChannelData = trimmedBuffer.getChannelData(c);
      for (let i = 0; i < trimmedLength; i++) {
        trimmedChannelData[i] = channelData[firstSoundIndex + i];
      }
    }
    return trimmedBuffer;
  }

  private static getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Convert decoded AudioBuffer into a clean WAV Blob
   */
  private static bufferToWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));

    // RIFF identifier
    out.setUint32(0, 0x52494646, false); // "RIFF"
    out.setUint32(4, length - 8, true);
    out.setUint32(8, 0x57415645, false); // "WAVE"

    // format chunk identifier
    out.setUint32(12, 0x666d7420, false); // "fmt "
    out.setUint32(16, 16, true);
    out.setUint16(20, 1, true); // PCM
    out.setUint16(22, numChannels, true);
    out.setUint32(24, sampleRate, true);
    out.setUint32(28, sampleRate * numChannels * 2, true);
    out.setUint16(32, numChannels * 2, true);
    out.setUint16(34, 16, true);

    // data chunk identifier
    out.setUint32(36, 0x64617461, false); // "data"
    out.setUint32(40, length - 44, true);

    // Write interleaved 16-bit PCM samples
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        let sample = buffer.getChannelData(channel)[i];
        sample = Math.max(-1, Math.min(1, sample));
        out.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  }

  /**
   * Fast client-side & script-based language detector.
   */
  static detectLanguage(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return 'en';

    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(trimmed)) {
      if (/[\u3040-\u309f\u30a0-\u30ff]/.test(trimmed)) return 'ja';
      return 'zh-CN';
    }
    if (/[\uac00-\ud7af\u1100-\u11ff]/.test(trimmed)) return 'ko';
    if (/[\u0400-\u04ff]/.test(trimmed)) return 'ru';
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/.test(trimmed)) {
      return 'vi';
    }
    if (/[éèêëàâîïôûùç]/.test(trimmed) && !/[ăâđêôơư]/.test(trimmed)) {
      return 'fr';
    }
    return 'en';
  }

  /**
   * Synthesize text to audio Blob with 2-Tier Cache (Memory + IndexedDB) and Silence Trimming
   */
  static async synthesize(text: string, lang: string = 'auto', rate: number = 1.0): Promise<Blob> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Text is empty');

    const resolvedLang = (!lang || lang === 'auto') ? this.detectLanguage(trimmed) : lang;
    const cacheKey = `${resolvedLang}_${rate}_${trimmed}`;

    // 1. Tier 1: Memory Cache
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    // 2. Tier 2: Persistent IndexedDB Cache
    const dbCached = await VelvetAudioCacheDB.get(cacheKey);
    if (dbCached) {
      this.memoryCache.set(cacheKey, dbCached);
      return dbCached;
    }

    // 3. Ongoing prefetch check
    if (this.activePrefetches.has(cacheKey)) {
      return await this.activePrefetches.get(cacheKey)!;
    }

    // 4. Fetch, Decode, Trim Silence, and Store in 2-Tier Cache
    const fetchPromise = (async () => {
      const chunks = this.splitIntoChunks(trimmed, 150);
      const audioBlobs: Blob[] = [];

      for (const chunk of chunks) {
        const blob = await this.fetchAndTrimAudioChunk(chunk, resolvedLang, rate);
        audioBlobs.push(blob);
      }

      const resultBlob = audioBlobs.length === 1 ? audioBlobs[0] : new Blob(audioBlobs, { type: 'audio/wav' });

      // Save to Memory & Persistent DB
      if (this.memoryCache.size > 150) {
        const firstKey = this.memoryCache.keys().next().value;
        if (firstKey) this.memoryCache.delete(firstKey);
      }
      this.memoryCache.set(cacheKey, resultBlob);
      VelvetAudioCacheDB.put(cacheKey, resultBlob).catch(() => {});
      this.activePrefetches.delete(cacheKey);

      return resultBlob;
    })();

    this.activePrefetches.set(cacheKey, fetchPromise);
    return await fetchPromise;
  }

  /**
   * Prefetch upcoming sentences in background to prevent stutter
   */
  static prefetch(text: string, lang: string = 'auto', rate: number = 1.0) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const resolvedLang = (!lang || lang === 'auto') ? this.detectLanguage(trimmed) : lang;
    const cacheKey = `${resolvedLang}_${rate}_${trimmed}`;
    if (this.memoryCache.has(cacheKey) || this.activePrefetches.has(cacheKey)) return;

    this.synthesize(trimmed, resolvedLang, rate).catch(() => {});
  }

  /**
   * Fetch audio chunk from Google Translate TTS & trim leading/trailing silence
   */
  private static async fetchAndTrimAudioChunk(chunkText: string, lang: string, rate: number): Promise<Blob> {
    const encodedText = encodeURIComponent(chunkText);
    const speedParam = rate < 0.9 ? 0.24 : 1;
    const targetLang = lang === 'en-uk' ? 'en-GB' : (lang === 'auto' ? this.detectLanguage(chunkText) : lang);

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${targetLang}&client=tw-ob&q=${encodedText}&ttsspeed=${speedParam}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google TTS request failed with status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    try {
      const ctx = this.getAudioContext();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const trimmedBuffer = this.trimAudioBufferSilence(decodedBuffer);
      return this.bufferToWavBlob(trimmedBuffer);
    } catch {
      // If Web Audio API decode fails, fallback to raw response Blob
      return new Blob([arrayBuffer], { type: 'audio/mp3' });
    }
  }

  /**
   * Helper to chunk long text into natural phrases
   */
  private static splitIntoChunks(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    const words = text.split(/\s+/);
    let current = '';

    for (const word of words) {
      if ((current + ' ' + word).trim().length <= maxLength) {
        current = (current + ' ' + word).trim();
      } else {
        if (current) chunks.push(current);
        current = word;
      }
    }
    if (current) chunks.push(current);

    return chunks;
  }
}
