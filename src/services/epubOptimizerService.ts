import JSZip from 'jszip';

export interface IOptimizeResult {
  blob: Blob;
  originalSize: number;
  optimizedSize: number;
  fileHash: string;
  savedPercent: number;
}

export class EpubOptimizerService {
  /**
   * Compute SHA-256 Hash of an ArrayBuffer or Blob
   */
  public static async computeHash(data: ArrayBuffer | Blob): Promise<string> {
    const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Resize and compress an image blob/buffer using Canvas
   */
  private static async compressImage(
    data: Uint8Array,
    mimeType: string,
    maxWidth = 1200,
    maxHeight = 1600,
    quality = 0.75
  ): Promise<Uint8Array> {
    try {
      const blob = new Blob([data as any], { type: mimeType });
      // Use createImageBitmap for fast off-thread decoding
      const imgBitmap = await createImageBitmap(blob);
      let { width, height } = imgBitmap;

      // Only resize if larger than bounds
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      } else if (data.byteLength < 100 * 1024) {
        // If image is already small (<100KB) and not oversized, keep original
        return data;
      }

      // Create canvas (supports OffscreenCanvas or standard document canvas)
      let compressedBlob: Blob | null = null;

      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imgBitmap, 0, 0, width, height);
          compressedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
        }
      } else if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imgBitmap, 0, 0, width, height);
          compressedBlob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', quality)
          );
        }
      }

      imgBitmap.close();

      if (compressedBlob && compressedBlob.size < data.byteLength) {
        const arrayBuf = await compressedBlob.arrayBuffer();
        return new Uint8Array(arrayBuf);
      }
    } catch (err) {
      console.warn('Image compression skipped for file:', err);
    }
    return data;
  }

  /**
   * Optimize EPUB file by compressing heavy images and re-compressing with ZIP Deflate
   */
  public static async optimizeEpub(
    file: File | Blob,
    onProgress?: (percent: number) => void
  ): Promise<IOptimizeResult> {
    const originalSize = file.size;

    try {
      const zip = await JSZip.loadAsync(file);
      const newZip = new JSZip();

      const fileEntries = Object.entries(zip.files);
      const totalEntries = fileEntries.length;
      let processed = 0;

      for (const [relativePath, zipEntry] of fileEntries) {
        if (zipEntry.dir) {
          newZip.folder(relativePath);
          continue;
        }

        const uint8Data = await zipEntry.async('uint8array');
        const lowerName = relativePath.toLowerCase();

        if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
          const compressed = await this.compressImage(uint8Data, 'image/jpeg');
          newZip.file(relativePath, compressed);
        } else if (lowerName.endsWith('.png')) {
          // Compress PNG if large
          const compressed = await this.compressImage(uint8Data, 'image/png');
          newZip.file(relativePath, compressed);
        } else {
          // Keep all text, html, opf, ncx, fonts untouched for 100% compatibility
          newZip.file(relativePath, uint8Data);
        }

        processed++;
        if (onProgress && totalEntries > 0) {
          onProgress(Math.round((processed / totalEntries) * 100));
        }
      }

      // Generate optimized zip
      const optimizedBlob = await newZip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
        mimeType: 'application/epub+zip',
      });

      const fileHash = await this.computeHash(optimizedBlob);
      const optimizedSize = optimizedBlob.size;
      const savedPercent = Math.max(
        0,
        Math.round(((originalSize - optimizedSize) / originalSize) * 100)
      );

      return {
        blob: optimizedSize < originalSize ? optimizedBlob : file,
        originalSize,
        optimizedSize: Math.min(originalSize, optimizedSize),
        fileHash,
        savedPercent,
      };
    } catch (err) {
      console.warn('EPUB optimization skipped, using original:', err);
      const fileHash = await this.computeHash(file);
      return {
        blob: file,
        originalSize,
        optimizedSize: originalSize,
        fileHash,
        savedPercent: 0,
      };
    }
  }
}
