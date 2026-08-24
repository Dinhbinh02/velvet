/**
 * Unified Cloud Storage Service for Velvet
 * Currently configured to use: SUPABASE STORAGE (Default & Active)
 * 
 * When user base grows, switch activeProvider to 'r2' below.
 */
import { SupabaseStorageService } from './supabaseStorageService';
import { R2StorageService } from './r2StorageService';
import type { ICustomFont } from '../types/book';

export type StorageProvider = 'supabase' | 'r2';

// ⚙️ ACTIVE STORAGE PROVIDER: 'supabase' (current) or 'r2' (future scale)
export const ACTIVE_STORAGE_PROVIDER: StorageProvider = 'supabase';

export class StorageService {
  /**
   * Upload an EPUB book file to active cloud storage
   */
  public static async uploadBook(bookId: string, fileBlob?: File | Blob, fileHash?: string): Promise<string> {
    if (ACTIVE_STORAGE_PROVIDER === 'r2') {
      return R2StorageService.uploadBook(bookId, fileBlob, fileHash);
    }
    return SupabaseStorageService.uploadBook(bookId, fileBlob, fileHash);
  }

  /**
   * Download an EPUB book file from active cloud storage into local OPFS
   */
  public static async downloadBook(bookId: string, storageKey: string): Promise<boolean> {
    if (ACTIVE_STORAGE_PROVIDER === 'r2') {
      return R2StorageService.downloadBook(bookId, storageKey);
    }
    return SupabaseStorageService.downloadBook(bookId, storageKey);
  }

  /**
   * Delete an EPUB book from active cloud storage
   */
  public static async deleteBook(storageKey: string): Promise<void> {
    if (ACTIVE_STORAGE_PROVIDER === 'r2') {
      return R2StorageService.deleteBook(storageKey);
    }
    return SupabaseStorageService.deleteBook(storageKey);
  }

  /**
   * Upload a Custom Font to active cloud storage
   */
  public static async uploadFont(font: ICustomFont): Promise<string> {
    if (ACTIVE_STORAGE_PROVIDER === 'r2') {
      return R2StorageService.uploadFont(font);
    }
    return SupabaseStorageService.uploadFont(font);
  }

  /**
   * Download a Custom Font from active cloud storage as Base64 Data URL
   */
  public static async downloadFont(storageKey: string): Promise<string | null> {
    if (ACTIVE_STORAGE_PROVIDER === 'r2') {
      return null;
    }
    return SupabaseStorageService.downloadFont(storageKey);
  }

  /**
   * Delete a Custom Font from active cloud storage
   */
  public static async deleteFont(fontId: string): Promise<void> {
    if (ACTIVE_STORAGE_PROVIDER === 'r2') {
      return R2StorageService.deleteFont(fontId);
    }
    return SupabaseStorageService.deleteFont(fontId);
  }
}
