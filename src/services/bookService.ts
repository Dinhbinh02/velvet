import { db } from '../db/schema';
import type { IBook, IProgress } from '../types/book';
import { OPFSStorageService } from './opfsStorage';
import { EPUBParserService } from './epubParser';
import { GoogleDriveSyncService } from './googleDriveSyncService';

export class BookService {
  /**
   * Import a new book into the 2-tier storage system (OPFS + Dexie)
   */
  static async importBook(file: File): Promise<string> {
    const bookId = crypto.randomUUID();

    // 1. Extract metadata and cover
    const metadata = await EPUBParserService.parseMetadata(file);

    // 2. Save binary to OPFS
    const opfsPath = await OPFSStorageService.saveBook(bookId, file);

    // 3. Create book record
    const now = Date.now();
    const newBook: IBook = {
      id: bookId,
      title: metadata.title,
      author: metadata.author,
      description: metadata.description,
      coverImage: metadata.coverImage,
      opfsPath,
      fileSize: file.size,
      format: 'epub',
      totalChapters: metadata.totalChapters,
      addedAt: now,
      lastReadAt: now,
      isFinished: false,
    };

    // 4. Initialize progress record
    const initialProgress: IProgress = {
      bookId,
      cfi: '',
      percentage: 0,
      sectionIndex: 0,
      updatedAt: now,
    };

    // 5. Store in Dexie within a transaction
    await db.transaction('rw', [db.books, db.progress], async () => {
      await db.books.add(newBook);
      await db.progress.add(initialProgress);
    });

    // 6. Upload book file to Google Drive in background if user is logged in
    GoogleDriveSyncService.uploadBookFile(bookId).catch(() => {});
    GoogleDriveSyncService.triggerAutoSync(3000);

    return bookId;
  }

  /**
   * Completely delete book from both OPFS and Dexie
   */
  static async deleteBookCompletely(bookId: string): Promise<void> {
    // Delete file in OPFS
    await OPFSStorageService.deleteBook(bookId);

    // Delete related records in Dexie
    await db.transaction('rw', [db.books, db.progress, db.notes, db.highlights, db.comments, db.sessions], async () => {
      await Promise.all([
        db.books.delete(bookId),
        db.progress.delete(bookId),
        db.notes.where('bookId').equals(bookId).delete(),
        db.highlights.where('bookId').equals(bookId).delete(),
        db.comments.where('bookId').equals(bookId).delete(),
        db.sessions.where('bookId').equals(bookId).delete(),
      ]);
    });

    // Delete book file from Google Drive if logged in
    GoogleDriveSyncService.deleteBookFile(bookId).catch(() => {});
    GoogleDriveSyncService.triggerAutoSync(3000);
  }

  /**
   * Update reading progress
   */
  static async updateProgress(
    bookId: string,
    progress: { cfi: string; percentage: number; sectionIndex: number; chapterTitle?: string }
  ): Promise<void> {
    const now = Date.now();
    await db.transaction('rw', [db.books, db.progress], async () => {
      await db.progress.put({
        bookId,
        cfi: progress.cfi,
        percentage: Math.min(1, Math.max(0, progress.percentage)),
        sectionIndex: progress.sectionIndex,
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
   * Get File object from OPFS to load into Reader
   */
  static async getBookFile(bookId: string): Promise<File> {
    return await OPFSStorageService.getBookFile(bookId);
  }
}
