/**
 * Supabase Storage Service for Velvet
 * Dedicated object storage provider using Supabase Storage ('books' bucket with 'fonts/' subfolder)
 */
import { SupabaseService } from './supabaseClient';
import { OPFSStorageService } from './opfsStorage';
import { EpubOptimizerService } from './epubOptimizerService';
import type { ICustomFont } from '../types/book';

export class SupabaseStorageService {
  private static uploadedHashes = new Set<string>();

  /**
   * Upload an EPUB book file to Supabase Storage bucket 'books'
   */
  public static async uploadBook(bookId: string, fileBlob?: File | Blob, fileHash?: string): Promise<string> {
    const user = await SupabaseService.getCurrentUser();
    if (!user) return '';

    try {
      const file = fileBlob || (await OPFSStorageService.getBookFile(bookId));
      if (!file) return '';

      const hash = fileHash || (await EpubOptimizerService.computeHash(file));
      const storageKey = `${hash}.epub`;

      if (this.uploadedHashes.has(hash)) {
        return storageKey;
      }

      const supabase = await SupabaseService.getClient();
      if (!supabase) return '';

      const { error } = await supabase.storage.from('books').upload(storageKey, file, {
        upsert: true,
        contentType: 'application/epub+zip',
      });

      if (error) {
        console.warn('[Supabase Storage] Book upload failed:', error.message);
        return '';
      }

      this.uploadedHashes.add(hash);
      console.log(`[Supabase Storage] Book ${storageKey} uploaded successfully!`);
      return storageKey;
    } catch (err: any) {
      if (err?.name !== 'NotFoundError') {
        console.warn(`[Supabase Storage] Failed to upload book ${bookId}:`, err);
      }
      return '';
    }
  }

  /**
   * Download an EPUB book file from Supabase Storage bucket 'books' into OPFS
   */
  public static async downloadBook(bookId: string, storageKey: string): Promise<boolean> {
    try {
      const supabase = await SupabaseService.getClient();
      if (!supabase) return false;

      const cleanKey = storageKey.replace(/^books\//, '');
      const keysToTry = [cleanKey, `books/${cleanKey}`, `${bookId}.epub`];
      let fileBlob: Blob | null = null;

      for (const key of keysToTry) {
        if (fileBlob) break;

        // 1. Try public URL fetch (fastest via CDN)
        try {
          const { data: pubData } = supabase.storage.from('books').getPublicUrl(key);
          if (pubData?.publicUrl) {
            const res = await fetch(pubData.publicUrl);
            if (res.ok && res.status === 200) {
              const b = await res.blob();
              if (b && b.size > 500) {
                fileBlob = b;
                break;
              }
            }
          }
        } catch {}

        // 2. Try authenticated download method
        if (!fileBlob) {
          try {
            const { data, error } = await supabase.storage.from('books').download(key);
            if (!error && data && data.size > 500) {
              fileBlob = data;
              break;
            }
          } catch {}
        }
      }

      if (fileBlob) {
        await OPFSStorageService.saveBook(bookId, fileBlob);
        console.log(`[Supabase Storage] Book ${bookId} downloaded & cached in OPFS!`);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`[Supabase Storage] Failed to download book ${bookId}:`, err);
      return false;
    }
  }

  /**
   * Delete an EPUB book file from Supabase Storage bucket 'books'
   */
  public static async deleteBook(storageKey: string): Promise<void> {
    try {
      const supabase = await SupabaseService.getClient();
      if (!supabase) return;
      const cleanKey = storageKey.replace(/^books\//, '');
      await supabase.storage.from('books').remove([cleanKey, `books/${cleanKey}`]);
    } catch (err) {
      console.warn(`[Supabase Storage] Failed to delete book ${storageKey}:`, err);
    }
  }

  /**
   * Upload a Custom Font file to Supabase Storage (tries 'fonts' bucket first, falls back to 'books' bucket under 'fonts/' folder)
   */
  public static async uploadFont(font: ICustomFont): Promise<string> {
    const user = await SupabaseService.getCurrentUser();
    if (!user || !font.fontData) return '';

    try {
      const fileName = `${font.id}.${font.format || 'ttf'}`;
      const res = await fetch(font.fontData);
      const fontBlob = await res.blob();
      const contentType = font.format === 'woff2' ? 'font/woff2' : font.format === 'woff' ? 'font/woff' : 'font/ttf';

      const supabase = await SupabaseService.getClient();
      if (!supabase) return '';

      // 1. Try dedicated 'fonts' bucket first
      try {
        const { error: fontsErr } = await supabase.storage.from('fonts').upload(fileName, fontBlob, {
          upsert: true,
          contentType,
        });
        if (!fontsErr) {
          console.log(`[Supabase Storage] Font ${font.name} (${fileName}) uploaded to 'fonts' bucket!`);
          return fileName;
        }
      } catch {}

      // 2. Fallback to 'books' bucket under 'fonts/' subfolder
      const storageKey = `fonts/${fileName}`;
      const { error } = await supabase.storage.from('books').upload(storageKey, fontBlob, {
        upsert: true,
        contentType,
      });
      if (error) {
        console.warn('[Supabase Storage] Font upload error:', error.message);
        return '';
      }
      console.log(`[Supabase Storage] Font ${font.name} (${storageKey}) uploaded to 'books' bucket!`);
      return storageKey;
    } catch (err) {
      console.warn('[Supabase Storage] Failed to upload font:', err);
    }
    return '';
  }

  /**
   * Download a Custom Font file from Supabase Storage and return as Base64 DataURL
   */
  public static async downloadFont(storageKey: string): Promise<string | null> {
    try {
      const supabase = await SupabaseService.getClient();
      if (!supabase) return null;

      const cleanKey = storageKey.replace(/^books\//, '');
      const rawName = cleanKey.replace(/^fonts\//, '');
      let fontBlob: Blob | null = null;

      // 1. Try dedicated 'fonts' bucket
      for (const key of [rawName, cleanKey]) {
        if (fontBlob) break;
        try {
          const { data: pubData } = supabase.storage.from('fonts').getPublicUrl(key);
          if (pubData?.publicUrl) {
            const res = await fetch(pubData.publicUrl);
            if (res.ok && res.status === 200) {
              const b = await res.blob();
              if (b && b.size > 100) {
                fontBlob = b;
                break;
              }
            }
          }
        } catch {}

        if (!fontBlob) {
          try {
            const { data, error } = await supabase.storage.from('fonts').download(key);
            if (!error && data && data.size > 100) {
              fontBlob = data;
              break;
            }
          } catch {}
        }
      }

      // 2. Try 'books' bucket fallback
      if (!fontBlob) {
        const keysToTry = [`fonts/${rawName}`, cleanKey, rawName];
        for (const key of keysToTry) {
          if (fontBlob) break;

          try {
            const { data: pubData } = supabase.storage.from('books').getPublicUrl(key);
            if (pubData?.publicUrl) {
              const res = await fetch(pubData.publicUrl);
              if (res.ok && res.status === 200) {
                const b = await res.blob();
                if (b && b.size > 100) {
                  fontBlob = b;
                  break;
                }
              }
            }
          } catch {}

          if (!fontBlob) {
            try {
              const { data, error } = await supabase.storage.from('books').download(key);
              if (!error && data && data.size > 100) {
                fontBlob = data;
                break;
              }
            } catch {}
          }
        }
      }

      if (fontBlob) {
        // Convert Blob to Data URL
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fontBlob!);
        });
      }
      return null;
    } catch (err) {
      console.warn(`[Supabase Storage] Failed to download font ${storageKey}:`, err);
      return null;
    }
  }

  /**
   * Delete a Custom Font file from Supabase Storage
   */
  public static async deleteFont(fontId: string): Promise<void> {
    try {
      const supabase = await SupabaseService.getClient();
      if (!supabase) return;

      const fileVariants = [
        `${fontId}.ttf`,
        `${fontId}.woff2`,
        `${fontId}.woff`,
        `${fontId}.otf`,
        `fonts/${fontId}.ttf`,
        `fonts/${fontId}.woff2`,
        `fonts/${fontId}.woff`,
        `fonts/${fontId}.otf`,
      ];

      // Try deleting from both 'fonts' and 'books' buckets
      await Promise.allSettled([
        supabase.storage.from('fonts').remove(fileVariants),
        supabase.storage.from('books').remove(fileVariants),
      ]);
    } catch (err) {
      console.warn('[Supabase Storage] Failed to delete font:', err);
    }
  }
}
