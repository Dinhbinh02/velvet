/**
 * Supabase Storage Service for Velvet
 * Dedicated object storage provider using Supabase Storage ('books' and 'fonts' buckets)
 * Cloud-First architecture with robust fallback and key resolution.
 */
import { SupabaseService } from './supabaseClient';
import { OPFSStorageService } from './opfsStorage';
import { EpubOptimizerService } from './epubOptimizerService';
import { db } from '../db/schema';
import type { ICustomFont } from '../types/book';

export class SupabaseStorageService {
  private static getUploadedHashes(): Set<string> {
    try {
      const stored = localStorage.getItem('velvet_uploaded_book_hashes');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  }

  private static addUploadedHash(hash: string): void {
    try {
      const hashes = this.getUploadedHashes();
      hashes.add(hash);
      localStorage.setItem('velvet_uploaded_book_hashes', JSON.stringify(Array.from(hashes)));
    } catch {}
  }

  private static getUploadedFontIds(): Set<string> {
    try {
      const stored = localStorage.getItem('velvet_uploaded_font_ids');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  }

  private static addUploadedFontId(fontId: string): void {
    try {
      const fontIds = this.getUploadedFontIds();
      fontIds.add(fontId);
      localStorage.setItem('velvet_uploaded_font_ids', JSON.stringify(Array.from(fontIds)));
    } catch {}
  }

  /**
   * Upload an EPUB book file to Supabase Storage bucket 'books'
   */
  public static async uploadBook(bookId: string, fileBlob?: File | Blob, fileHash?: string): Promise<string> {
    const user = await SupabaseService.getCurrentUser();
    if (!user) return '';

    try {
      let file = fileBlob;
      if (!file) {
        try {
          file = await OPFSStorageService.getBookFile(bookId);
        } catch {
          return '';
        }
      }
      if (!file) return '';

      const hash = fileHash || (await EpubOptimizerService.computeHash(file));
      const storageKey = `${hash}.epub`;

      // Update fileHash in local Dexie DB
      try {
        await db.books.update(bookId, { fileHash: hash });
      } catch {}

      const supabase = await SupabaseService.getClient();
      if (!supabase) return storageKey;

      if (!this.getUploadedHashes().has(hash)) {
        const { error } = await supabase.storage.from('books').upload(storageKey, file, {
          upsert: true,
          contentType: 'application/epub+zip',
        });

        if (error) {
          console.warn('[Supabase Storage] Book upload failed:', error.message);
          return '';
        }

        this.addUploadedHash(hash);
        console.log(`[Supabase Storage] Book ${storageKey} uploaded successfully!`);
      }

      // Ensure Cloud DB row has the matching r2_key
      try {
        await supabase
          .from('books')
          .update({ r2_key: `books/${storageKey}` })
          .eq('id', bookId)
          .eq('user_id', user.id);
      } catch {}

      return storageKey;
    } catch (err: any) {
      if (err?.name !== 'NotFoundError') {
        console.warn(`[Supabase Storage] Failed to upload book ${bookId}:`, err);
      }
      return '';
    }
  }

  /**
   * Download an EPUB book file from Supabase Storage bucket 'books' into local OPFS
   */
  public static async downloadBook(bookId: string, storageKey?: string): Promise<boolean> {
    try {
      const supabase = await SupabaseService.getClient();
      if (!supabase) return false;

      const keysToTry = new Set<string>();

      if (storageKey) {
        const cleanKey = storageKey.replace(/^books\//, '').trim();
        if (cleanKey) keysToTry.add(cleanKey);
      }

      keysToTry.add(`${bookId}.epub`);

      // Check local Dexie if there is a known fileHash
      try {
        const localBook = await db.books.get(bookId);
        if (localBook?.fileHash) {
          keysToTry.add(`${localBook.fileHash}.epub`);
        }
      } catch {}

      let fileBlob: Blob | null = null;

      // 1. Try each key candidate via Public URL then download API
      for (const key of keysToTry) {
        if (fileBlob) break;

        // Try public URL fetch (fastest via CDN)
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

        // Try download method
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

      // 2. Fallback: If still not found, list bucket files and search for any matching file
      if (!fileBlob) {
        try {
          const { data: bucketFiles } = await supabase.storage.from('books').list('', { limit: 100 });
          if (bucketFiles && bucketFiles.length > 0) {
            // Find file that contains bookId or matches single EPUB
            let matchedFile = bucketFiles.find((f) => f.name.includes(bookId));
            if (!matchedFile && bucketFiles.length === 1 && bucketFiles[0].name.endsWith('.epub')) {
              matchedFile = bucketFiles[0];
            }
            if (matchedFile) {
              const { data, error } = await supabase.storage.from('books').download(matchedFile.name);
              if (!error && data && data.size > 500) {
                fileBlob = data;
                // Update local book fileHash
                const cleanHash = matchedFile.name.replace(/\.epub$/i, '');
                await db.books.update(bookId, { fileHash: cleanHash });
              }
            }
          }
        } catch {}
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
      const cleanKey = storageKey.replace(/^books\//, '').trim();
      if (cleanKey) {
        await supabase.storage.from('books').remove([cleanKey]);
      }
    } catch (err) {
      console.warn(`[Supabase Storage] Failed to delete book ${storageKey}:`, err);
    }
  }

  /**
   * Upload a Custom Font file directly to Supabase Storage bucket 'fonts'
   */
  public static async uploadFont(font: ICustomFont): Promise<string> {
    const user = await SupabaseService.getCurrentUser();
    if (!user || !font.fontData) return '';

    try {
      const fileName = `${font.id}.${font.format || 'ttf'}`;
      if (this.getUploadedFontIds().has(font.id)) {
        return fileName;
      }

      const res = await fetch(font.fontData);
      const fontBlob = await res.blob();
      const contentType =
        font.format === 'woff2' ? 'font/woff2' : font.format === 'woff' ? 'font/woff' : 'font/ttf';

      const supabase = await SupabaseService.getClient();
      if (!supabase) return '';

      const { error } = await supabase.storage.from('fonts').upload(fileName, fontBlob, {
        upsert: true,
        contentType,
      });

      if (error) {
        console.warn('[Supabase Storage] Font upload error:', error.message);
        return '';
      }

      this.addUploadedFontId(font.id);
      console.log(`[Supabase Storage] Font ${font.name} (${fileName}) uploaded to 'fonts' bucket!`);
      return fileName;
    } catch (err) {
      console.warn('[Supabase Storage] Failed to upload font:', err);
    }
    return '';
  }

  /**
   * Download a Custom Font file from Supabase Storage bucket 'fonts' and return as Base64 DataURL
   */
  public static async downloadFont(storageKey: string): Promise<string | null> {
    try {
      const supabase = await SupabaseService.getClient();
      if (!supabase) return null;

      const cleanKey = storageKey.replace(/^fonts\//, '').trim();
      let fontBlob: Blob | null = null;

      // 1. Try public URL from 'fonts' bucket
      try {
        const { data: pubData } = supabase.storage.from('fonts').getPublicUrl(cleanKey);
        if (pubData?.publicUrl) {
          const res = await fetch(pubData.publicUrl);
          if (res.ok && res.status === 200) {
            const b = await res.blob();
            if (b && b.size > 100) {
              fontBlob = b;
            }
          }
        }
      } catch {}

      // 2. Try download method
      if (!fontBlob) {
        try {
          const { data, error } = await supabase.storage.from('fonts').download(cleanKey);
          if (!error && data && data.size > 100) {
            fontBlob = data;
          }
        } catch {}
      }

      if (fontBlob) {
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
   * Delete a Custom Font file from Supabase Storage bucket 'fonts'
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
      ];

      await supabase.storage.from('fonts').remove(fileVariants);
    } catch (err) {
      console.warn('[Supabase Storage] Failed to delete font:', err);
    }
  }
}
