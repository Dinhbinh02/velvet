/**
 * Kokoro Neural TTS Service (Client Bridge to Web Worker)
 * Communicates with the Web Worker to synthesize high-fidelity AI audio without blocking UI.
 */

export interface IKokoroVoice {
  id: string;
  name: string;
  gender: 'Female' | 'Male';
  accent: 'US' | 'UK';
  description: string;
}

export const KOKORO_VOICES: IKokoroVoice[] = [
  // 🇺🇸 American English Voices
  {
    id: 'af_heart',
    name: 'Heart (US Female - Warm & Emotional)',
    gender: 'Female',
    accent: 'US',
    description: 'Sweet, natural, highly expressive audiobook narrator',
  },
  {
    id: 'af_bella',
    name: 'Bella (US Female - Expressive)',
    gender: 'Female',
    accent: 'US',
    description: 'Dynamic, clear, articulate storytelling voice',
  },
  {
    id: 'af_sarah',
    name: 'Sarah (US Female - Soft)',
    gender: 'Female',
    accent: 'US',
    description: 'Gentle, soothing, ideal for bedtime reading',
  },
  {
    id: 'am_adam',
    name: 'Adam (US Male - Deep Narrator)',
    gender: 'Male',
    accent: 'US',
    description: 'Rich, authoritative, professional narrator tone',
  },
  {
    id: 'am_michael',
    name: 'Michael (US Male - Clear)',
    gender: 'Male',
    accent: 'US',
    description: 'Clean, modern, crisp pronunciation',
  },

  // 🇬🇧 British English Voices
  {
    id: 'bf_emma',
    name: 'Emma (UK Female - Elegant)',
    gender: 'Female',
    accent: 'UK',
    description: 'Sophisticated British accent with natural pauses',
  },
  {
    id: 'bf_isabella',
    name: 'Isabella (UK Female - Literary)',
    gender: 'Female',
    accent: 'UK',
    description: 'Classic BBC literary style narration',
  },
  {
    id: 'bm_george',
    name: 'George (UK Male - Warm Gentleman)',
    gender: 'Male',
    accent: 'UK',
    description: 'Deep, polite, classic British gentleman narrator',
  },
];

export class KokoroTTSService {
  private static worker: Worker | null = null;
  private static pendingRequests: Map<string, { resolve: (blob: Blob) => void; reject: (err: any) => void }> = new Map();
  private static isInitialized = false;
  private static modelStatus: 'idle' | 'downloading' | 'ready' | 'error' = 'idle';
  private static downloadProgress: number = 0;
  private static statusListeners: Set<(status: string, progress: number) => void> = new Set();

  /**
   * Lazy start the Web Worker
   */
  private static getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/kokoroWorker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent) => {
        const { type, id, audioBlob, error, status, progress } = e.data;

        if (type === 'STATUS') {
          this.modelStatus = status === 'ready' ? 'ready' : 'downloading';
          this.downloadProgress = progress || 0;
          this.notifyStatus();
        } else if (type === 'SYNTHESIS_RESULT' && id) {
          const req = this.pendingRequests.get(id);
          if (req) {
            req.resolve(audioBlob);
            this.pendingRequests.delete(id);
          }
        } else if (type === 'SYNTHESIS_ERROR' && id) {
          const req = this.pendingRequests.get(id);
          if (req) {
            req.reject(new Error(error || 'Synthesis error'));
            this.pendingRequests.delete(id);
          }
        } else if (type === 'ERROR') {
          this.modelStatus = 'error';
          this.notifyStatus();
        }
      };
    }
    return this.worker;
  }

  /**
   * Preload / Warmup the Kokoro model in worker
   */
  static preload() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    const worker = this.getWorker();
    worker.postMessage({ type: 'INIT' });
  }

  /**
   * Synthesize text to audio Blob in background thread
   */
  static async synthesize(text: string, voice: string = 'af_heart', rate: number = 1.0): Promise<Blob> {
    const worker = this.getWorker();
    const id = Math.random().toString(36).substring(2, 9);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      worker.postMessage({
        type: 'SYNTHESIZE',
        id,
        text,
        voice,
        rate,
      });

      // 25s timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Kokoro synthesis timed out.'));
        }
      }, 25000);
    });
  }

  static subscribeStatus(listener: (status: string, progress: number) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.modelStatus, this.downloadProgress);
    return () => this.statusListeners.delete(listener);
  }

  private static notifyStatus() {
    this.statusListeners.forEach((l) => l(this.modelStatus, this.downloadProgress));
  }
}
