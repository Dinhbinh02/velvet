/**
 * Google Drive Cloud Sync Service for Velvet
 * Handles backup & restore of reading progress, highlights, notes, comments, and chapter summaries to Google Drive AppData folder.
 */
import { GoogleAuthService } from './googleAuthService';
import { db } from '../db/schema';
import { OPFSStorageService } from './opfsStorage';

const BACKUP_FILENAME = 'velvet_library_backup.json';
const BACKUP_MIME_TYPE = 'application/json';

export interface ISyncMetadata {
  lastSyncAt: number;
  booksCount: number;
  notesCount: number;
  highlightsCount: number;
  commentsCount: number;
  chapterSummariesCount: number;
}

export interface ICloudBackupPayload {
  version: number;
  timestamp: number;
  books: any[];
  progress: any[];
  notes: any[];
  highlights: any[];
  comments: any[];
  chapterSummaries: any[];
  customFonts: any[];
}

export class GoogleDriveSyncService {
  /**
   * Search for a file in Google Drive's appDataFolder by name
   */
  private static async findDriveFile(token: string, name: string): Promise<string | null> {
    const query = encodeURIComponent(`name = '${name}' and 'appDataFolder' in parents and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to search Drive file: ${errText}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  }

  /**
   * Upload an individual EPUB file to Google Drive AppData folder
   * Only called when a book is added or synced for the first time
   */
  public static async uploadBookFile(bookId: string): Promise<string> {
    const token = await GoogleAuthService.getAccessToken(true);
    const fileName = `book_${bookId}.epub`;
    const existingId = await this.findDriveFile(token, fileName);
    if (existingId) return existingId; // Already uploaded

    const file = await OPFSStorageService.getBookFile(bookId);
    const metadata = {
      name: fileName,
      parents: ['appDataFolder'],
      mimeType: 'application/epub+zip',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    if (!res.ok) {
      throw new Error(`Failed to upload book to Drive: ${await res.text()}`);
    }
    const data = await res.json();
    return data.id;
  }

  /**
   * Delete an individual EPUB file from Google Drive AppData folder when user deletes a book
   */
  public static async deleteBookFile(bookId: string): Promise<void> {
    try {
      const token = await GoogleAuthService.getAccessToken(false);
      if (!token) return;
      const fileName = `book_${bookId}.epub`;
      const fileId = await this.findDriveFile(token, fileName);
      if (fileId) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      console.warn('Failed to delete book file from Drive:', e);
    }
  }

  /**
   * Download an individual EPUB file from Google Drive into local OPFS
   */
  public static async downloadBookFile(bookId: string): Promise<boolean> {
    try {
      const token = await GoogleAuthService.getAccessToken(true);
      const fileName = `book_${bookId}.epub`;
      const fileId = await this.findDriveFile(token, fileName);
      if (!fileId) return false;

      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;

      const blob = await res.blob();
      await OPFSStorageService.saveBook(bookId, blob);
      return true;
    } catch (e) {
      console.warn(`Failed to download book ${bookId} from Drive:`, e);
      return false;
    }
  }

  /**
   * Upload / Update lightweight Velvet metadata database to Google Drive appDataFolder
   * (Does NOT include bulky covers or EPUB binaries - super fast <100ms)
   */
  public static async backupNow(): Promise<{ success: boolean; timestamp: number; fileId: string }> {
    const token = await GoogleAuthService.getAccessToken(true);

    // 1. Gather all data from IndexedDB
    const [rawBooks, progress, notes, highlights, comments, chapterSummaries, customFonts] = await Promise.all([
      db.books.toArray(),
      db.progress.toArray(),
      db.notes.toArray(),
      db.highlights.toArray(),
      db.comments.toArray(),
      db.chapterSummaries.toArray(),
      db.customFonts.toArray(),
    ]);

    // 2. Strip coverImage blobs completely from JSON metadata payload (covers auto-extract from EPUB binary)
    const cleanBooks = rawBooks.map((b) => {
      const { coverImage, ...rest } = b;
      return rest;
    });

    const payload: ICloudBackupPayload = {
      version: 6,
      timestamp: Date.now(),
      books: cleanBooks,
      progress,
      notes,
      highlights,
      comments,
      chapterSummaries,
      customFonts,
    };

    const existingFileId = await this.findDriveFile(token, BACKUP_FILENAME);
    const blob = new Blob([JSON.stringify(payload)], { type: BACKUP_MIME_TYPE });

    let fileId: string;
    if (existingFileId) {
      // Update existing file content
      const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': BACKUP_MIME_TYPE,
        },
        body: blob,
      });

      if (!uploadRes.ok) {
        throw new Error(`Failed to update Drive backup file: ${await uploadRes.text()}`);
      }
      const data = await uploadRes.json();
      fileId = data.id || existingFileId;
    } else {
      // Create new file with multipart upload (metadata + file body)
      const metadata = {
        name: BACKUP_FILENAME,
        parents: ['appDataFolder'],
        mimeType: BACKUP_MIME_TYPE,
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create Drive backup file: ${await createRes.text()}`);
      }
      const data = await createRes.json();
      fileId = data.id;
    }

    // 3. Ensure all current local EPUB files are uploaded to Drive individually (without re-uploading existing ones)
    Promise.all(rawBooks.map(b => this.uploadBookFile(b.id).catch(() => {})));

    // Save sync info to chrome.storage
    const syncMeta: ISyncMetadata = {
      lastSyncAt: payload.timestamp,
      booksCount: rawBooks.length,
      notesCount: notes.length,
      highlightsCount: highlights.length,
      commentsCount: comments.length,
      chapterSummariesCount: chapterSummaries.length,
    };
    await chrome.storage.local.set({ velvet_last_sync_meta: syncMeta });

    return {
      success: true,
      timestamp: payload.timestamp,
      fileId,
    };
  }

  /**
   * Restore database from Google Drive appDataFolder and download missing EPUB binaries
   */
  public static async restoreNow(): Promise<{ success: boolean; restoredCount: number }> {
    const token = await GoogleAuthService.getAccessToken(true);
    const existingFileId = await this.findDriveFile(token, BACKUP_FILENAME);

    if (!existingFileId) {
      throw new Error('No backup file found on Google Drive.');
    }

    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!downloadRes.ok) {
      throw new Error(`Failed to download backup file: ${await downloadRes.text()}`);
    }

    const payload: ICloudBackupPayload = await downloadRes.json();

    if (!payload || !Array.isArray(payload.books)) {
      throw new Error('Invalid backup file format');
    }

    // Clean books from payload
    const sanitizedBooks = payload.books.map((b: any) => {
      const { coverImage, coverImageBase64, ...rest } = b;
      return rest;
    });

    // Merge into Dexie Database (bulkPut overwrites/updates records without duplicates)
    await db.transaction('rw', [db.books, db.progress, db.notes, db.highlights, db.comments, db.chapterSummaries, db.customFonts], async () => {
      if (sanitizedBooks.length) {
        await db.books.bulkPut(sanitizedBooks);
      }
      if (payload.progress?.length) await db.progress.bulkPut(payload.progress);
      if (payload.notes?.length) await db.notes.bulkPut(payload.notes);
      if (payload.highlights?.length) await db.highlights.bulkPut(payload.highlights);
      if (payload.comments?.length) await db.comments.bulkPut(payload.comments);
      if (payload.chapterSummaries?.length) await db.chapterSummaries.bulkPut(payload.chapterSummaries);
      if (payload.customFonts?.length) await db.customFonts.bulkPut(payload.customFonts);
    });

    // Download any missing EPUB files from Drive into OPFS and extract their covers
    for (const b of sanitizedBooks) {
      try {
        await OPFSStorageService.getBookFile(b.id);
      } catch {
        // File not present in OPFS on this machine -> download from Drive
        await this.downloadBookFile(b.id);
      }
    }

    const totalRestored =
      (payload.books?.length || 0) +
      (payload.notes?.length || 0) +
      (payload.highlights?.length || 0) +
      (payload.comments?.length || 0);

    return {
      success: true,
      restoredCount: totalRestored,
    };
  }

  private static syncDebounceTimer: any = null;
  private static isSyncingInProgress = false;

  /**
   * Schedule a debounced auto-sync (e.g. after adding highlight, note, or progress change).
   * Runs only if a Google user session is active and avoids overlapping syncs.
   */
  public static triggerAutoSync(delayMs: number = 30000) {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(async () => {
      await this.runSilentAutoSync();
    }, delayMs);
  }

  /**
   * Run silent background sync without popping up interactive prompts
   */
  public static async runSilentAutoSync(): Promise<boolean> {
    if (this.isSyncingInProgress) return false;

    try {
      const user = await GoogleAuthService.getCurrentUser();
      if (!user) return false;

      // Try acquiring token non-interactively
      const token = await GoogleAuthService.getAccessToken(false);
      if (!token) return false;

      this.isSyncingInProgress = true;
      await this.backupNow();
      console.log('Velvet Auto-Sync completed successfully.');
      return true;
    } catch (e) {
      console.warn('Velvet silent auto-sync skipped/failed:', e);
      return false;
    } finally {
      this.isSyncingInProgress = false;
    }
  }

  /**
   * Get last sync metadata from storage
   */
  public static async getLastSyncInfo(): Promise<ISyncMetadata | null> {
    const data = await chrome.storage.local.get('velvet_last_sync_meta');
    return data.velvet_last_sync_meta || null;
  }
}
