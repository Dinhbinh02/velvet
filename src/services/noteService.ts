import { db } from '../db/schema';
import type { INote } from '../types/book';
import { SupabaseSyncService } from './supabaseSyncService';

export class NoteService {
  /**
   * Add a new note to a book
   */
  static async addNote(bookId: string, content: string, chapterTitle?: string): Promise<INote> {
    const now = Date.now();
    const note: INote = {
      id: crypto.randomUUID(),
      bookId,
      content,
      chapterTitle,
      createdAt: now,
      updatedAt: now,
    };

    await db.notes.add(note);
    SupabaseSyncService.triggerAutoSync(15000);
    return note;
  }

  /**
   * Update existing note content
   */
  static async updateNote(noteId: string, content: string): Promise<void> {
    await db.notes.update(noteId, {
      content,
      updatedAt: Date.now(),
    });
    SupabaseSyncService.triggerAutoSync(15000);
  }

  /**
   * Delete a note
   */
  static async deleteNote(noteId: string): Promise<void> {
    await db.notes.delete(noteId);

    // Delete directly from Supabase
    try {
      const { SupabaseService } = await import('./supabaseClient');
      const supabase = await SupabaseService.getClient();
      if (supabase) {
        await supabase.from('notes').delete().eq('id', noteId);
      }
    } catch {}

    SupabaseSyncService.triggerAutoSync(1000);
  }

  /**
   * Get all notes for a specific book
   */
  static async getNotes(bookId: string): Promise<INote[]> {
    return await db.notes.where('bookId').equals(bookId).reverse().sortBy('createdAt');
  }
}
