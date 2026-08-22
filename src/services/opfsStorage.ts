/**
 * Service to manage binary EPUB storage in Origin Private File System (OPFS)
 */
export class OPFSStorageService {
  private static readonly BOOKS_DIR = 'books';

  /**
   * Get root directory handle of OPFS
   */
  private static async getRoot(): Promise<FileSystemDirectoryHandle> {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      throw new Error('OPFS is not supported in this browser.');
    }
    return await navigator.storage.getDirectory();
  }

  /**
   * Get or create books directory
   */
  private static async getBooksDirectory(): Promise<FileSystemDirectoryHandle> {
    const root = await this.getRoot();
    return await root.getDirectoryHandle(this.BOOKS_DIR, { create: true });
  }

  /**
   * Save book stream into OPFS
   * @param bookId Unique identifier of book
   * @param file File or Blob of EPUB
   * @returns Relative path: books/{bookId}.epub
   */
  static async saveBook(bookId: string, file: File | Blob): Promise<string> {
    const booksDir = await this.getBooksDirectory();
    const fileName = `${bookId}.epub`;
    const fileHandle = await booksDir.getFileHandle(fileName, { create: true });

    // Use createWritable stream for high performance
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    return `${this.BOOKS_DIR}/${fileName}`;
  }

  /**
   * Get File object from OPFS
   */
  static async getBookFile(bookId: string): Promise<File> {
    const booksDir = await this.getBooksDirectory();
    const fileName = `${bookId}.epub`;
    const fileHandle = await booksDir.getFileHandle(fileName);
    return await fileHandle.getFile();
  }

  /**
   * Delete book file in OPFS
   */
  static async deleteBook(bookId: string): Promise<void> {
    try {
      const booksDir = await this.getBooksDirectory();
      const fileName = `${bookId}.epub`;
      await booksDir.removeEntry(fileName);
    } catch (err) {
      console.warn(`Could not delete file for book ${bookId} in OPFS:`, err);
    }
  }

  /**
   * Get OPFS storage statistics
   */
  static async getStorageStats(): Promise<{ usedMB: number; quotaMB: number; percentage: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 1;
      const usedMB = Number((usage / (1024 * 1024)).toFixed(2));
      const quotaMB = Number((quota / (1024 * 1024)).toFixed(2));
      const percentage = Number(((usage / quota) * 100).toFixed(2));

      return { usedMB, quotaMB, percentage };
    }
    return { usedMB: 0, quotaMB: 0, percentage: 0 };
  }
}
