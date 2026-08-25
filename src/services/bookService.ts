import { db } from '../db/schema';
import type { IBook, IProgress } from '../types/book';
import { OPFSStorageService } from './opfsStorage';
import { EPUBParserService } from './epubParser';
import { SupabaseSyncService } from './supabaseSyncService';
import { StorageService } from './storageService';
import { EpubOptimizerService } from './epubOptimizerService';

export class BookService {
  /**
   * Import a new book into the 2-tier storage system with Smart Compression & Deduplication
   */
  static async importBook(
    file: File,
    onProgress?: (step: 'optimizing' | 'parsing' | 'saving' | 'finalizing' | 'ready', percent: number) => void
  ): Promise<string> {
    const bookId = crypto.randomUUID();

    // 1. Smart Compression: Optimize large images & compute SHA-256 hash
    onProgress?.('optimizing', 10);
    const optimized = await EpubOptimizerService.optimizeEpub(file, (p) => {
      onProgress?.('optimizing', Math.round(10 + p * 0.45));
    });
    const finalBlob = optimized.blob;

    // 2. Extract metadata and cover from optimized blob
    onProgress?.('parsing', 65);
    const metadata = await EPUBParserService.parseMetadata(finalBlob);

    // 3. Save optimized binary to local OPFS
    onProgress?.('saving', 80);
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

    // 6. Store in Dexie within a transaction
    onProgress?.('finalizing', 92);
    await db.transaction('rw', [db.books, db.progress], async () => {
      await db.books.add(newBook);
      await db.progress.add(initialProgress);
    });

    // 7. Cloud backup (Supabase Storage) & auto sync
    StorageService.uploadBook(bookId, finalBlob, optimized.fileHash).catch(() => {});
    SupabaseSyncService.triggerAutoSync(3000);

    onProgress?.('ready', 100);
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
    // 1. Delete OPFS binary file
    await OPFSStorageService.deleteBook(bookId).catch(() => {});

    // 2. Delete related records in Dexie
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

    // 3. Delete directly from Supabase Database tables
    try {
      const { SupabaseService } = await import('./supabaseClient');
      const supabase = await SupabaseService.getClient();
      if (supabase) {
        await Promise.allSettled([
          supabase.from('books').delete().eq('id', bookId),
          supabase.from('progress').delete().eq('book_id', bookId),
          supabase.from('highlights').delete().eq('book_id', bookId),
          supabase.from('notes').delete().eq('book_id', bookId),
          supabase.from('comments').delete().eq('book_id', bookId),
          supabase.from('chapter_summaries').delete().eq('book_id', bookId),
        ]);
      }
    } catch {}

    // 4. Delete book file from Cloud Storage
    StorageService.deleteBook(bookId).catch(() => {});

    // 5. Trigger sync
    try {
      SupabaseSyncService.triggerAutoSync(500);
    } catch {}
  }

  /**
   * Update reading progress
   */
  static async updateProgress(
    bookId: string,
    progress: {
      cfi: string;
      percentage: number;
      sectionIndex: number;
      sectionFraction?: number;
      chapterTitle?: string;
      sectionHref?: string;
      textAnchor?: string;
    }
  ): Promise<void> {
    const now = Date.now();
    await db.transaction('rw', [db.books, db.progress], async () => {
      const existing = await db.progress.get(bookId);

      await db.progress.put({
        bookId,
        cfi: progress.cfi,
        percentage: Math.min(1, Math.max(0, progress.percentage)),
        sectionIndex: progress.sectionIndex,
        sectionFraction: progress.sectionFraction,
        textAnchor: progress.textAnchor || existing?.textAnchor || '',
        chapterTitle: progress.chapterTitle,
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
      const book = await db.books.get(bookId);
      const storageKey = book?.fileHash ? `${book.fileHash}.epub` : `${bookId}.epub`;
      const downloaded = await StorageService.downloadBook(bookId, storageKey);
      if (downloaded) {
        const file = await OPFSStorageService.getBookFile(bookId);
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
