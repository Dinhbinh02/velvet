/**
 * Edge Neural TTS Service
 * Connects directly to Microsoft Edge Neural TTS API (using the same protocol as Edge Read Aloud).
 * High quality, zero-cost, natural sounding voices with word boundaries.
 */

export interface IEdgeVoice {
  id: string;
  name: string;
  lang: string;
  gender: 'Female' | 'Male';
  locale: string;
  flag: string;
}

export const POPULAR_EDGE_VOICES: IEdgeVoice[] = [
  // 🇻🇳 Vietnamese Voices
  {
    id: 'vi-VN-HoaiMyNeural',
    name: 'Hoài My (Nữ - Truyền cảm)',
    lang: 'vi-VN',
    gender: 'Female',
    locale: 'Tiếng Việt',
    flag: '🇻🇳',
  },
  {
    id: 'vi-VN-NamMinhNeural',
    name: 'Nam Minh (Nam - Ấm áp)',
    lang: 'vi-VN',
    gender: 'Male',
    locale: 'Tiếng Việt',
    flag: '🇻🇳',
  },

  // 🇺🇸 English (US) Voices
  {
    id: 'en-US-JennyNeural',
    name: 'Jenny (US Female - Natural)',
    lang: 'en-US',
    gender: 'Female',
    locale: 'English (US)',
    flag: '🇺🇸',
  },
  {
    id: 'en-US-GuyNeural',
    name: 'Guy (US Male - Clear)',
    lang: 'en-US',
    gender: 'Male',
    locale: 'English (US)',
    flag: '🇺🇸',
  },
  {
    id: 'en-US-AriaNeural',
    name: 'Aria (US Female - Expressive)',
    lang: 'en-US',
    gender: 'Female',
    locale: 'English (US)',
    flag: '🇺🇸',
  },
  {
    id: 'en-US-ChristopherNeural',
    name: 'Christopher (US Male - Storyteller)',
    lang: 'en-US',
    gender: 'Male',
    locale: 'English (US)',
    flag: '🇺🇸',
  },

  // 🇬🇧 English (UK) Voices
  {
    id: 'en-GB-SoniaNeural',
    name: 'Sonia (UK Female)',
    lang: 'en-GB',
    gender: 'Female',
    locale: 'English (UK)',
    flag: '🇬🇧',
  },
  {
    id: 'en-GB-RyanNeural',
    name: 'Ryan (UK Male)',
    lang: 'en-GB',
    gender: 'Male',
    locale: 'English (UK)',
    flag: '🇬🇧',
  },

  // 🇫🇷 French Voices
  {
    id: 'fr-FR-DeniseNeural',
    name: 'Denise (French)',
    lang: 'fr-FR',
    gender: 'Female',
    locale: 'Français',
    flag: '🇫🇷',
  },

  // 🇯🇵 Japanese Voices
  {
    id: 'ja-JP-NanamiNeural',
    name: 'Nanami (Japanese)',
    lang: 'ja-JP',
    gender: 'Female',
    locale: '日本語',
    flag: '🇯🇵',
  },

  // 🇨🇳 Chinese Voices
  {
    id: 'zh-CN-XiaoxiaoNeural',
    name: 'Xiaoxiao (Chinese)',
    lang: 'zh-CN',
    gender: 'Female',
    locale: '中文',
    flag: '🇨🇳',
  },
];

export interface IWordBoundary {
  audioOffset: number; // in milliseconds
  duration: number;    // in milliseconds
  text: string;
  charOffset: number;
}

export class EdgeTTSService {
  private static TRUSTED_CLIENT_TOKEN = '6A5AA1D4EA654070B0E23906F8FE9C35';

  /**
   * Synthesize text to audio via Microsoft Edge Speech synthesis
   */
  static async synthesize(
    text: string,
    voice: string = 'vi-VN-HoaiMyNeural',
    rate: number = 1.0,
    pitch: number = 1.0
  ): Promise<{ audioBlob: Blob; wordBoundaries: IWordBoundary[] }> {
    const ratePercent = Math.round((rate - 1.0) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

    const pitchPercent = Math.round((pitch - 1.0) * 50);
    const pitchStr = pitchPercent >= 0 ? `+${pitchPercent}%` : `${pitchPercent}%`;

    const lang = voice.startsWith('vi-') ? 'vi-VN' : voice.startsWith('en-') ? 'en-US' : 'en-US';
    const safeText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'><voice name='${voice}'><prosody pitch='${pitchStr}' rate='${rateStr}'>${safeText}</prosody></voice></speak>`;

    return await this.synthesizeViaWebSocket(ssml);
  }

  private static synthesizeViaWebSocket(
    ssml: string
  ): Promise<{ audioBlob: Blob; wordBoundaries: IWordBoundary[] }> {
    return new Promise((resolve, reject) => {
      const connectionId = this.generateUuid().replace(/-/g, '');
      const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${this.TRUSTED_CLIENT_TOKEN}&ConnectionId=${connectionId}`;
      const socket = new WebSocket(url);
      socket.binaryType = 'arraybuffer';

      const audioChunks: Uint8Array[] = [];
      const wordBoundaries: IWordBoundary[] = [];

      const timeout = setTimeout(() => {
        try {
          socket.close();
        } catch {}
        reject(new Error('Edge TTS request timed out.'));
      }, 10000);

      socket.onopen = () => {
        const timestamp = new Date().toISOString();

        // 1. Send speech.config message
        const speechConfig = JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: 'false',
                  wordBoundaryEnabled: 'true',
                },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
              },
            },
          },
        });

        const configMsg = `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${speechConfig}`;
        socket.send(configMsg);

        // 2. Send SSML message
        const ssmlMsg = `X-RequestId:${connectionId}\r\nX-Timestamp:${timestamp}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
        socket.send(ssmlMsg);
      };

      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const textData = event.data;

          if (textData.includes('Path:audio.metadata')) {
            try {
              const bodyIndex = textData.indexOf('\r\n\r\n');
              if (bodyIndex !== -1) {
                const jsonStr = textData.substring(bodyIndex + 4);
                const metadata = JSON.parse(jsonStr);
                if (metadata.Metadata) {
                  for (const item of metadata.Metadata) {
                    if (item.Type === 'WordBoundary') {
                      wordBoundaries.push({
                        audioOffset: (item.Data?.Offset || 0) / 10000,
                        duration: (item.Data?.Duration || 0) / 10000,
                        text: item.Data?.text?.Text || '',
                        charOffset: item.Data?.text?.Offset || 0,
                      });
                    }
                  }
                }
              }
            } catch {}
          }

          if (textData.includes('Path:turn.end')) {
            clearTimeout(timeout);
            socket.close();

            if (audioChunks.length > 0) {
              const combinedAudio = new Blob(audioChunks as any, { type: 'audio/mp3' });
              resolve({ audioBlob: combinedAudio, wordBoundaries });
            } else {
              reject(new Error('No audio returned from Edge TTS'));
            }
          }
        } else if (event.data instanceof ArrayBuffer) {
          const buffer = event.data;
          const view = new DataView(buffer);
          const headerLength = view.getUint16(0);

          if (buffer.byteLength > headerLength + 2) {
            const audioData = buffer.slice(headerLength + 2);
            audioChunks.push(new Uint8Array(audioData));
          }
        }
      };

      socket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Edge TTS WebSocket connection failed.'));
      };

      socket.onclose = () => {
        clearTimeout(timeout);
        if (audioChunks.length > 0) {
          const combinedAudio = new Blob(audioChunks as any, { type: 'audio/mp3' });
          resolve({ audioBlob: combinedAudio, wordBoundaries });
        }
      };
    });
  }

  private static generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
