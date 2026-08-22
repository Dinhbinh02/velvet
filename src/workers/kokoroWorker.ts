/**
 * Kokoro TTS Web Worker
 * Runs AI neural audio synthesis on a dedicated background thread (WebGPU / WASM)
 * Completely offloads computation from the UI thread to guarantee 60fps silky smooth reading.
 */

import { KokoroTTS } from 'kokoro-js';

let ttsInstance: any = null;
let isLoading = false;

// Audio buffer to wav converter helper
function bufferToWav(buffer: Float32Array, sampleRate: number = 24000): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = buffer.length * 2;
  const chunkSize = 36 + dataSize;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, chunkSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true);  // AudioFormat (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM audio data
  let offset = 44;
  for (let i = 0; i < buffer.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

self.addEventListener('message', async (e: MessageEvent) => {
  const { type, id, text, voice, rate } = e.data;

  if (type === 'INIT') {
    if (ttsInstance || isLoading) return;
    try {
      isLoading = true;
      self.postMessage({ type: 'STATUS', status: 'loading', progress: 10 });

      // Determine device (WebGPU if available, fallback to WASM)
      const device = (navigator as any).gpu ? 'webgpu' : 'wasm';
      
      ttsInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: device,
        progress_callback: (progressInfo: any) => {
          if (progressInfo.status === 'progress') {
            self.postMessage({
              type: 'STATUS',
              status: 'downloading',
              progress: Math.round(progressInfo.progress || 50),
            });
          }
        },
      });

      isLoading = false;
      self.postMessage({ type: 'STATUS', status: 'ready' });
    } catch (err: any) {
      isLoading = false;
      self.postMessage({ type: 'ERROR', error: err?.message || 'Failed to load Kokoro AI model.' });
    }
    return;
  }

  if (type === 'SYNTHESIZE') {
    try {
      if (!ttsInstance) {
        const device = (navigator as any).gpu ? 'webgpu' : 'wasm';
        ttsInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
          dtype: 'q8',
          device: device,
        });
      }

      // Generate raw audio
      const chosenVoice = voice || 'af_heart';
      const output = await ttsInstance.generate(text, {
        voice: chosenVoice,
        speed: rate || 1.0,
      });

      // Convert audio array to wav Blob
      const audioBlob = bufferToWav(output.audio, output.sampling_rate || 24000);

      self.postMessage({
        type: 'SYNTHESIS_RESULT',
        id,
        audioBlob,
      });
    } catch (err: any) {
      self.postMessage({
        type: 'SYNTHESIS_ERROR',
        id,
        error: err?.message || 'Synthesis failed.',
      });
    }
  }
});
