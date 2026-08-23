import { db } from '../db/schema';
import type { IBook, IProgress } from '../types/book';
import { OPFSStorageService } from './opfsStorage';
import { EPUBParserService } from './epubParser';
import { SupabaseSyncService } from './supabaseSyncService';
import { R2StorageService } from './r2StorageService';
import { EpubOptimizerService } from './epubOptimizerService';

export class BookService {
  /**
   * Import a new book into the 2-tier storage system with Smart Compression & Deduplication
   */
  static async importBook(file: File): Promise<string> {
    const bookId = crypto.randomUUID();

    // 1. Smart Compression: Optimize large images & compute SHA-256 hash
    const optimized = await EpubOptimizerService.optimizeEpub(file);
    const finalBlob = optimized.blob;

    // 2. Extract metadata and cover from optimized blob
    const metadata = await EPUBParserService.parseMetadata(finalBlob);

    // 3. Save optimized binary to local OPFS
    const opfsPath = await OPFSStorageService.saveBook(bookId, finalBlob);

    // 4. Create book record
    const now = Date.now();
    const newBook: IBook = {
      id: bookId,
      title: metadata.title,
      author: metadata.author,
      description: metadata.description,
      coverImage: metadata.coverImage,
      opfsPath,
      fileSize: optimized.optimizedSize,
      fileHash: optimized.fileHash,
      format: 'epub',
      totalChapters: metadata.totalChapters,
      addedAt: now,
      lastReadAt: now,
      isFinished: false,
    };

    // 5. Initialize progress record
    const initialProgress: IProgress = {
      bookId,
      cfi: '',
      percentage: 0,
      sectionIndex: 0,
      updatedAt: now,
    };

    // 6. Store in Dexie within a transaction and clear tombstone
    await db.transaction('rw', [db.books, db.progress, db.tombstones], async () => {
      await db.books.add(newBook);
      await db.progress.add(initialProgress);
      await db.tombstones.delete(bookId);
    });

    // 7. Instant cloud deduplication check & background R2 backup
    R2StorageService.uploadBook(bookId, finalBlob, optimized.fileHash).catch(() => {});
    SupabaseSyncService.triggerAutoSync(3000);

    return bookId;
  }

  /**
   * Get all books in the library
   */
  static async getBooks(): Promise<IBook[]> {
    return await db.books.toArray();
  }

  /**
   * Get book details with its reading progress
   */
  static async getBookDetails(bookId: string): Promise<IBook | undefined> {
    return await db.books.get(bookId);
  }

  /**
   * Permanently delete a book, all its associated user data, and its OPFS binary
   */
  static async deleteBookCompletely(bookId: string): Promise<void> {
    // 4. Delete related records in Dexie
    await db.transaction('rw', [db.books, db.progress, db.notes, db.highlights, db.comments, db.chapterSummaries, db.sessions], async () => {
      await Promise.all([
        db.books.delete(bookId),
        db.progress.delete(bookId),
        db.notes.where('bookId').equals(bookId).delete(),
        db.highlights.where('bookId').equals(bookId).delete(),
        db.comments.where('bookId').equals(bookId).delete(),
        db.chapterSummaries.where('bookId').equals(bookId).delete(),
        db.sessions.where('bookId').equals(bookId).delete(),
      ]);
    });

    // 5. Delete book file from Cloudflare R2 and sync with Supabase
    R2StorageService.deleteBook(bookId).catch(() => {});
    SupabaseSyncService.triggerAutoSync(3000);
  }

  /**
   * Update reading progress
   */
  static async updateProgress(
    bookId: string,
    progress: { cfi: string; percentage: number; sectionIndex: number; chapterTitle?: string; sectionHref?: string }
  ): Promise<void> {
    const now = Date.now();
    await db.transaction('rw', [db.books, db.progress], async () => {
      const existing = await db.progress.get(bookId);
      const sectionCfiMap = { ...(existing?.sectionCfiMap || {}) };

      // Save CFI under sectionIndex, chapterTitle, and sectionHref
      if (progress.cfi) {
        sectionCfiMap[`sec_${progress.sectionIndex}`] = progress.cfi;
        if (progress.chapterTitle) {
          sectionCfiMap[`title_${progress.chapterTitle.trim().toLowerCase()}`] = progress.cfi;
        }
        if (progress.sectionHref) {
          sectionCfiMap[`href_${progress.sectionHref}`] = progress.cfi;
        }
      }

      await db.progress.put({
        bookId,
        cfi: progress.cfi,
        percentage: Math.min(1, Math.max(0, progress.percentage)),
        sectionIndex: progress.sectionIndex,
        chapterTitle: progress.chapterTitle,
        sectionCfiMap,
        updatedAt: now,
      });

      await db.books.update(bookId, {
        lastReadAt: now,
        isFinished: progress.percentage >= 0.99,
      });
    });
  }

  /**
   * Get File object from OPFS to load into Reader (with automatic Cloud Storage fallback & cover extraction)
   */
  static async getBookFile(bookId: string): Promise<File> {
    try {
      return await OPFSStorageService.getBookFile(bookId);
    } catch (err) {
      // If missing in local browser OPFS, attempt download from Cloud Storage (R2 / Supabase Storage)
      const book = await db.books.get(bookId);
      const r2Key = book?.fileHash ? `books/${book.fileHash}.epub` : `books/${bookId}.epub`;
      const downloaded = await R2StorageService.downloadBook(bookId, r2Key);
      if (downloaded) {
        const file = await OPFSStorageService.getBookFile(bookId);
        // Extract and restore cover image if missing
        try {
          const meta = await EPUBParserService.parseMetadata(file);
          if (meta.coverImage) {
            await db.books.update(bookId, { coverImage: meta.coverImage });
          }
        } catch {}
        return file;
      }
      throw err;
    }
  }
}
