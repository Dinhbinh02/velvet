/**
 * Cloudflare R2 Object Storage Service for Velvet
 * Standalone Provider for Cloudflare R2 (to be activated when scaling)
 */
import { SupabaseService } from './supabaseClient';
import { OPFSStorageService } from './opfsStorage';
import { EpubOptimizerService } from './epubOptimizerService';
import type { ICustomFont } from '../types/book';

export class R2StorageService {
  private static uploadedHashes = new Set<string>();

  /**
   * Upload an EPUB book file to Cloudflare R2
   */
  public static async uploadBook(bookId: string, fileBlob?: File | Blob, fileHash?: string): Promise<string> {
    const user = await SupabaseService.getCurrentUser();
    if (!user) return '';

    try {
      const file = fileBlob || (await OPFSStorageService.getBookFile(bookId));
      if (!file) return '';

      const hash = fileHash || (await EpubOptimizerService.computeHash(file));
      const r2Key = `books/${hash}.epub`;

      if (this.uploadedHashes.has(hash)) {
        return r2Key;
      }

      // 1. Direct Cloudflare Pages R2 endpoint (/api/r2/...)
      try {
        const directRes = await fetch(`/api/r2/${r2Key}`, {
          method: 'PUT',
          body: file,
        });
        if (directRes.ok) {
          this.uploadedHashes.add(hash);
          console.log(`[R2] Uploaded ${r2Key} successfully!`);
          return r2Key;
        }
      } catch {}

      // 2. Cloudflare Worker URL with Presigned URL
      const r2Config = await SupabaseService.getR2Config();
      if (r2Config?.workerUrl) {
        const presignRes = await fetch(`${r2Config.workerUrl}/presign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: r2Key,
            contentType: 'application/epub+zip',
            userId: user.id,
            fileHash: hash,
          }),
        });

        if (presignRes.ok) {
          const data = await presignRes.json();
          if (data.exists) {
            this.uploadedHashes.add(hash);
            return r2Key;
          }
          if (data.uploadUrl) {
            const uploadRes = await fetch(data.uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/epub+zip' },
              body: file,
            });
            if (uploadRes.ok) {
              this.uploadedHashes.add(hash);
              return r2Key;
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`[R2] Failed to upload book ${bookId}:`, err);
    }
    return '';
  }

  /**
   * Download an EPUB book file from Cloudflare R2 into OPFS
   */
  public static async downloadBook(bookId: string, r2Key: string): Promise<boolean> {
    try {
      const cleanKey = r2Key.replace(/^books\//, '');
      let fileBlob: Blob | null = null;

      // 1. Native Cloudflare Pages R2 endpoint
      try {
        const directRes = await fetch(`/api/r2/books/${cleanKey}`);
        if (directRes.ok && directRes.status === 200) {
          fileBlob = await directRes.blob();
        }
      } catch {}

      // 2. Public Domain or Worker
      if (!fileBlob) {
        const r2Config = await SupabaseService.getR2Config();
        if (r2Config?.publicDomain) {
          const publicUrl = `${r2Config.publicDomain.replace(/\/$/, '')}/${cleanKey}`;
          const res = await fetch(publicUrl);
          if (res.ok && res.status === 200) {
            fileBlob = await res.blob();
          }
        }
      }

      if (fileBlob) {
        await OPFSStorageService.saveBook(bookId, fileBlob);
        console.log(`[R2] Book ${bookId} downloaded & cached in OPFS!`);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`[R2] Failed to download book ${bookId}:`, err);
      return false;
    }
  }

  /**
   * Delete an EPUB book file reference from R2
   */
  public static async deleteBook(_bookIdOrKey: string): Promise<void> {
    // For Content-Addressable Storage (CAS), deleting user metadata leaves shared master file intact.
  }

  /**
   * Upload a Custom Font to Cloudflare R2
   */
  public static async uploadFont(font: ICustomFont): Promise<string> {
    const user = await SupabaseService.getCurrentUser();
    if (!user || !font.fontData) return '';

    try {
      const r2Key = `users/${user.id}/fonts/${font.id}.${font.format || 'ttf'}`;
      const res = await fetch(font.fontData);
      const fontBlob = await res.blob();

      const directRes = await fetch(`/api/r2/${r2Key}`, {
        method: 'PUT',
        body: fontBlob,
      });
      if (directRes.ok) return r2Key;
    } catch (err) {
      console.warn('[R2] Failed to upload font:', err);
    }
    return '';
  }

  /**
   * Delete a Custom Font from Cloudflare R2
   */
  public static async deleteFont(_fontId: string): Promise<void> {
    // R2 font deletion endpoint if needed
  }
}
