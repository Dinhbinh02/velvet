/**
 * TombstoneService (Deprecated)
 * No longer required in Cloud-First architecture where Cloud is the single source of truth.
 */
export class TombstoneService {
  static async recordTombstone(_id: string, _type: string): Promise<void> {}
  static async recordTombstones(_items: { id: string; type: string }[]): Promise<void> {}
  static async clearTombstone(_id: string): Promise<void> {}
  static async compactOldTombstones(): Promise<void> {}
  static async getActiveTombstones(): Promise<any[]> {
    return [];
  }
}
