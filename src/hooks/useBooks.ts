import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';

/**
 * Hook to retrieve all books in library, ordered by last read timestamp
 */
export function useBooks() {
  const books = useLiveQuery(
    async () => {
      return await db.books.orderBy('lastReadAt').reverse().toArray();
    },
    []
  );

  return {
    books: books || [],
    isLoading: books === undefined,
    count: books ? books.length : 0,
  };
}

/**
 * Hook to retrieve details of a specific book by ID
 */
export function useBookDetails(bookId: string | null) {
  const book = useLiveQuery(
    async () => {
      if (!bookId) return null;
      return await db.books.get(bookId);
    },
    [bookId]
  );

  return book;
}

/**
 * Hook to retrieve reading progress of a book
 */
export function useBookProgress(bookId: string | null) {
  const progress = useLiveQuery(
    async () => {
      if (!bookId) return null;
      return await db.progress.get(bookId);
    },
    [bookId]
  );

  return progress;
}

/**
 * Hook to retrieve all notes of a book
 */
export function useBookNotes(bookId: string | null) {
  const notes = useLiveQuery(
    async () => {
      if (!bookId) return [];
      return await db.notes
        .where('bookId')
        .equals(bookId)
        .reverse()
        .sortBy('createdAt');
    },
    [bookId]
  );

  return notes || [];
}
