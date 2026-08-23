import Dexie, { type Table } from 'dexie';
import type { IBook, IProgress, INote, IComment, IHighlight, IChapterSummary, IReaderSettings, IReadingSession, ICustomFont, ITombstone } from '../types/book';

export class VelvetDatabase extends Dexie {
  books!: Table<IBook, string>;
  progress!: Table<IProgress, string>;
  notes!: Table<INote, string>;
  highlights!: Table<IHighlight, string>;
  comments!: Table<IComment, string>;
  chapterSummaries!: Table<IChapterSummary, string>;
  settings!: Table<IReaderSettings, string>;
  sessions!: Table<IReadingSession, string>;
  customFonts!: Table<ICustomFont, string>;
  tombstones!: Table<ITombstone, string>;

  constructor() {
    super('VelvetEpubDB');
    this.version(1).stores({
      books: '&id, title, author, lastReadAt, addedAt, isFinished',
      progress: '&bookId, updatedAt',
      notes: '&id, bookId, createdAt, updatedAt, [bookId+createdAt]',
      settings: '&id',
      sessions: '&id, bookId, startTime, [bookId+startTime]',
    });

    this.version(2).stores({
      customFonts: '&id, name, createdAt',
    });

    this.version(3).stores({
      highlights: '&id, bookId, createdAt, [bookId+createdAt]',
    });

    this.version(4).stores({
      comments: '&id, bookId, createdAt, [bookId+createdAt]',
    });

    this.version(5).stores({
      chapterSummaries: '&id, bookId, href, createdAt, [bookId+href]',
    });

    this.version(6).stores({
      tombstones: '&id, type, deletedAt',
    });
  }
}

export const db = new VelvetDatabase();
