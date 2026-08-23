import { db } from '../db/schema';
import type { ITombstone, TombstoneType } from '../types/book';

// Tombstones are kept for 60 days before compaction
const TOMBSTONE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

export class TombstoneService {
  /**
   * Record a single tombstone when an item is deleted locally
   */
  static async recordTombstone(id: string, type: TombstoneType): Promise<void> {
    try {
      await db.tombstones.put({
        id,
        type,
        deletedAt: Date.now(),
      });
    } catch (err) {
      console.warn(`Failed to record tombstone for ${type} ${id}:`, err);
    }
  }

  /**
   * Record multiple tombstones in bulk (e.g. when deleting a book with its highlights and notes)
   */
  static async recordTombstones(items: { id: string; type: TombstoneType }[]): Promise<void> {
    if (!items.length) return;
    try {
      const now = Date.now();
      await db.tombstones.bulkPut(
        items.map((item) => ({
          id: item.id,
          type: item.type,
          deletedAt: now,
        }))
      );
    } catch (err) {
      console.warn('Failed to record bulk tombstones:', err);
    }
  }

  /**
   * Clear a tombstone if an entity with the same ID is explicitly re-created
   */
  static async clearTombstone(id: string): Promise<void> {
    try {
      await db.tombstones.delete(id);
    } catch (err) {
      console.warn(`Failed to clear tombstone ${id}:`, err);
    }
  }

  /**
   * Clean up tombstones older than 60 days to prevent unbounded growth
   */
  static async compactOldTombstones(): Promise<void> {
    try {
      const cutoff = Date.now() - TOMBSTONE_MAX_AGE_MS;
      await db.tombstones.where('deletedAt').below(cutoff).delete();
    } catch (err) {
      console.warn('Failed to compact old tombstones:', err);
    }
  }

  /**
   * Get all active tombstones as an array
   */
  static async getActiveTombstones(): Promise<ITombstone[]> {
    try {
      await this.compactOldTombstones();
      return await db.tombstones.toArray();
    } catch (err) {
      console.warn('Failed to fetch active tombstones:', err);
      return [];
    }
  }
}
