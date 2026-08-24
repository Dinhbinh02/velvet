/**
 * Supabase High-Performance Database & Realtime Synchronization Service for Velvet
 * Full Offline-First architecture: Instant local Dexie writes + Instant Cloud PostgreSQL UPSERTs + Realtime WebSocket.
 */
import { SupabaseService } from './supabaseClient';
import { StorageService } from './storageService';
import { db } from '../db/schema';
import { OPFSStorageService } from './opfsStorage';
import type { RealtimeChannel } from '@supabase/supabase-js';

export class SupabaseSyncService {
  private static realtimeChannel: RealtimeChannel | null = null;
  private static isSyncing = false;
  private static autoSyncTimer: any = null;

  /**
   * Debounced automatic synchronization
   */
  public static triggerAutoSync(delayMs = 15000): void {
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
    }
    this.autoSyncTimer = setTimeout(() => {
      this.syncAll().catch((err) => console.warn('Auto sync error:', err));
    }, delayMs);
  }

  /**
   * Initialize Realtime WebSocket subscriptions to listen for live multi-device updates
   */
  public static async initRealtimeSubscription(): Promise<void> {
    const supabase = await SupabaseService.getClient();
    const user = await SupabaseService.getCurrentUser();
    if (!supabase || !user) return;

    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
    }

    this.realtimeChannel = supabase
      .channel(`user-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'progress', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row: any = payload.new;
            const existing = await db.progress.get(row.book_id);
            if (!existing || (row.updated_at && row.updated_at > (existing.updatedAt || 0))) {
              await db.progress.put({
                bookId: row.book_id,
                cfi: row.cfi,
                percentage: row.percentage,
                sectionIndex: row.section_index,
                chapterTitle: row.chapter_title,
                sectionCfiMap: row.section_cfi_map || {},
                updatedAt: row.updated_at,
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'highlights', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row: any = payload.new;
            await db.highlights.put({
              id: row.id,
              bookId: row.book_id,
              text: row.text,
              color: row.color,
              createdAt: row.created_at,
            });
          } else if (payload.eventType === 'DELETE') {
            const row: any = payload.old;
            if (row?.id) await db.highlights.delete(row.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row: any = payload.new;
            await db.notes.put({
              id: row.id,
              bookId: row.book_id,
              content: row.content || row.note || '',
              chapterTitle: row.chapter_title,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            });
          } else if (payload.eventType === 'DELETE') {
            const row: any = payload.old;
            if (row?.id) await db.notes.delete(row.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row: any = payload.new;
            await db.comments.put({
              id: row.id,
              bookId: row.book_id,
              selectedText: row.selected_text,
              comment: row.comment,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            });
          } else if (payload.eventType === 'DELETE') {
            const row: any = payload.old;
            if (row?.id) await db.comments.delete(row.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chapter_summaries', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row: any = payload.new;
            await db.chapterSummaries.put({
              id: row.id,
              bookId: row.book_id,
              href: row.href,
              chapterTitle: row.chapter_title,
              summaries: row.summaries,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            });
            // Auto inject locally
            try {
              const { EPUBSummaryInjectorService } = await import('./epubSummaryInjectorService');
              await EPUBSummaryInjectorService.injectSummariesIntoEPUB(row.book_id, row.href, row.summaries);
            } catch {}
          } else if (payload.eventType === 'DELETE') {
            const row: any = payload.old;
            if (row?.id) await db.chapterSummaries.delete(row.id);
          }
        }
      )
      .subscribe();
  }

  /**
   * Perform high-speed bidirectional synchronization with Supabase PostgreSQL
   */
  public static async syncAll(): Promise<{ success: boolean; message: string }> {
    if (this.isSyncing) return { success: true, message: 'Sync in progress' };

    const supabase = await SupabaseService.getClient();
    const user = await SupabaseService.getCurrentUser();
    if (!supabase || !user) {
      return { success: false, message: 'User not signed in.' };
    }

    this.isSyncing = true;
    try {
      // 1. Pull latest Cloud Database state in parallel
      const [
        { data: cloudBooks },
        { data: cloudProgress },
        { data: cloudHighlights },
        { data: cloudNotes },
        { data: cloudComments },
        { data: cloudSummaries },
        { data: cloudFonts },
        { data: cloudProfile },
      ] = await Promise.all([
        supabase.from('books').select('*').eq('user_id', user.id),
        supabase.from('progress').select('*').eq('user_id', user.id),
        supabase.from('highlights').select('*').eq('user_id', user.id),
        supabase.from('notes').select('*').eq('user_id', user.id),
        supabase.from('comments').select('*').eq('user_id', user.id),
        supabase.from('chapter_summaries').select('*').eq('user_id', user.id),
        supabase.from('custom_fonts').select('*').eq('user_id', user.id),
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      ]);

      // 2. Fetch local data from Dexie
      const [localBooks, localProgress, localHighlights, localNotes, localComments, localSummaries, localFonts, localSettings, localTombstones] =
        await Promise.all([
          db.books.toArray(),
          db.progress.toArray(),
          db.highlights.toArray(),
          db.notes.toArray(),
          db.comments.toArray(),
          db.chapterSummaries.toArray(),
          db.customFonts.toArray(),
          db.settings.get('global-settings'),
          db.tombstones.toArray(),
        ]);

      const tombstoneIds = new Set(localTombstones.map((t) => t.id));

      // 3. Reconcile Cloud -> Local (Dexie)
      if (cloudBooks?.length) {
        for (const b of cloudBooks) {
          // If book was deleted locally, delete from cloud and do not restore
          if (tombstoneIds.has(b.id)) {
            supabase.from('books').delete().eq('id', b.id).then(() => {});
            continue;
          }

          const exists = await db.books.get(b.id);
          let coverBlob: Blob | string | undefined = exists?.coverImage;

          if (!coverBlob && b.cover_url) {
            if (b.cover_url.startsWith('data:')) {
              coverBlob = b.cover_url;
            } else {
              try {
                const res = await fetch(b.cover_url);
                if (res.ok) {
                  coverBlob = await res.blob();
                }
              } catch {}
            }
          }

          if (!exists) {
            await db.books.put({
              id: b.id,
              title: b.title,
              author: b.author,
              coverImage: (coverBlob as Blob) || undefined,
              opfsPath: `books/${b.id}.epub`,
              fileSize: b.file_size,
              format: b.format,
              totalChapters: b.total_chapters,
              addedAt: b.added_at,
              lastReadAt: b.last_read_at,
              isFinished: b.is_finished,
            });

            // Download EPUB binary from R2/Storage if not present in OPFS and extract cover
            try {
              const file = await OPFSStorageService.getBookFile(b.id);
              if (!coverBlob) {
                const { EPUBParserService } = await import('./epubParser');
                const meta = await EPUBParserService.parseMetadata(file);
                if (meta.coverImage) {
                  await db.books.update(b.id, { coverImage: meta.coverImage });
                }
              }
            } catch {
              const storageKey = b.r2_key || `books/${b.id}.epub`;
              const downloaded = await StorageService.downloadBook(b.id, storageKey);
              if (downloaded) {
                try {
                  const file = await OPFSStorageService.getBookFile(b.id);
                  if (!coverBlob) {
                    const { EPUBParserService } = await import('./epubParser');
                    const meta = await EPUBParserService.parseMetadata(file);
                    if (meta.coverImage) {
                      await db.books.update(b.id, { coverImage: meta.coverImage });
                    }
                  }
                } catch {}
              }
            }
          } else if (!exists.coverImage && (coverBlob || b.cover_url)) {
            await db.books.update(b.id, { coverImage: (coverBlob as Blob) || b.cover_url });
          }
        }
      }

      if (cloudProgress?.length) {
        for (const p of cloudProgress) {
          if (tombstoneIds.has(p.book_id)) continue;
          const existing = await db.progress.get(p.book_id);
          if (!existing || (p.updated_at && p.updated_at > (existing.updatedAt || 0))) {
            await db.progress.put({
              bookId: p.book_id,
              cfi: p.cfi,
              percentage: p.percentage,
              sectionIndex: p.section_index,
              chapterTitle: p.chapter_title,
              sectionCfiMap: p.section_cfi_map || {},
              updatedAt: p.updated_at,
            });
          }
        }
      }

      if (cloudHighlights?.length) {
        const validHighlights = cloudHighlights.filter((h) => !tombstoneIds.has(h.id) && !tombstoneIds.has(h.book_id));
        await db.highlights.bulkPut(
          validHighlights.map((h) => ({
            id: h.id,
            bookId: h.book_id,
            text: h.text,
            color: h.color,
            createdAt: h.created_at,
          }))
        );
      }

      if (cloudNotes?.length) {
        const validNotes = cloudNotes.filter((n) => !tombstoneIds.has(n.id) && !tombstoneIds.has(n.book_id));
        await db.notes.bulkPut(
          validNotes.map((n) => ({
            id: n.id,
            bookId: n.book_id,
            content: n.content || n.note || '',
            chapterTitle: n.chapter_title,
            createdAt: n.created_at,
            updatedAt: n.updated_at,
          }))
        );
      }

      if (cloudComments?.length) {
        const validComments = cloudComments.filter((c) => !tombstoneIds.has(c.id) && !tombstoneIds.has(c.book_id));
        await db.comments.bulkPut(
          validComments.map((c) => ({
            id: c.id,
            bookId: c.book_id,
            selectedText: c.selected_text,
            comment: c.comment,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }))
        );
      }

      if (cloudSummaries?.length) {
        const validSummaries = cloudSummaries.filter((s) => !tombstoneIds.has(s.id) && !tombstoneIds.has(s.book_id));
        await db.chapterSummaries.bulkPut(
          validSummaries.map((s) => ({
            id: s.id,
            bookId: s.book_id,
            href: s.href,
            chapterTitle: s.chapter_title,
            summaries: s.summaries,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
          }))
        );
      }

      if (cloudFonts?.length) {
        for (const f of cloudFonts) {
          if (tombstoneIds.has(f.id)) {
            supabase.from('custom_fonts').delete().eq('id', f.id).then(() => {});
            continue;
          }
          const exists = await db.customFonts.get(f.id);
          if (!exists || !exists.fontData) {
            // Download font binary from cloud storage as Data URL
            const storageKey = f.r2_key || `fonts/${f.id}.${f.format || 'ttf'}`;
            const fontData = await StorageService.downloadFont(storageKey);
            await db.customFonts.put({
              id: f.id,
              name: f.name,
              fileName: f.file_name,
              format: f.format,
              fontData: fontData || exists?.fontData || '',
              createdAt: f.created_at,
            });
          }
        }
      }

      // Merge Cloud Profile Settings
      if (cloudProfile?.settings) {
        await db.settings.put({
          ...localSettings,
          ...cloudProfile.settings,
        });
      }

      // 4. Push Local -> Cloud (Postgres UPSERT)
      const booksToUpsert = await Promise.all(
        localBooks.map(async (b) => {
          let coverUrl = '';
          if (b.coverImage) {
            try {
              coverUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string) || '');
                reader.onerror = () => resolve('');
                reader.readAsDataURL(b.coverImage as Blob);
              });
            } catch {}
          }

          return {
            id: b.id,
            user_id: user.id,
            title: b.title,
            author: b.author || '',
            file_size: b.fileSize || 0,
            format: b.format || 'epub',
            total_chapters: b.totalChapters || 0,
            r2_key: b.fileHash ? `books/${b.fileHash}.epub` : `books/${b.id}.epub`,
            cover_url: coverUrl || undefined,
            added_at: b.addedAt || Date.now(),
            last_read_at: b.lastReadAt || Date.now(),
            is_finished: b.isFinished || false,
          };
        })
      );
      if (booksToUpsert.length) {
        await supabase.from('books').upsert(booksToUpsert);
        // Upload local book files to Cloud Storage in background
        localBooks.forEach((b) => {
          StorageService.uploadBook(b.id, undefined, b.fileHash).catch(() => {});
        });
      }

      const progressToUpsert = localProgress.map((p) => ({
        user_id: user.id,
        book_id: p.bookId,
        cfi: p.cfi,
        percentage: p.percentage,
        section_index: p.sectionIndex,
        chapter_title: p.chapterTitle || '',
        section_cfi_map: p.sectionCfiMap || {},
        updated_at: p.updatedAt || Date.now(),
      }));
      if (progressToUpsert.length) await supabase.from('progress').upsert(progressToUpsert);

      try {
        const highlightsToUpsert = localHighlights.map((h) => ({
          id: h.id,
          user_id: user.id,
          book_id: h.bookId,
          text: h.text,
          color: h.color,
          created_at: h.createdAt,
        }));
        if (highlightsToUpsert.length) await supabase.from('highlights').upsert(highlightsToUpsert);
      } catch (hErr) {
        console.warn('[Sync] Highlights upsert skipped:', hErr);
      }

      try {
        const notesToUpsert = localNotes.map((n) => ({
          id: n.id,
          user_id: user.id,
          book_id: n.bookId,
          content: n.content,
          chapter_title: n.chapterTitle || '',
          selected_text: n.chapterTitle || '',
          note: n.content,
          created_at: n.createdAt,
          updated_at: n.updatedAt,
        }));
        if (notesToUpsert.length) await supabase.from('notes').upsert(notesToUpsert);
      } catch (nErr) {
        console.warn('[Sync] Notes upsert skipped:', nErr);
      }

      try {
        const commentsToUpsert = localComments.map((c) => ({
          id: c.id,
          user_id: user.id,
          book_id: c.bookId,
          selected_text: c.selectedText,
          comment: c.comment,
          created_at: c.createdAt,
          updated_at: c.updatedAt,
        }));
        if (commentsToUpsert.length) await supabase.from('comments').upsert(commentsToUpsert);
      } catch (cErr) {
        console.warn('[Sync] Comments upsert skipped:', cErr);
      }

      try {
        const summariesToUpsert = localSummaries.map((s) => ({
          id: s.id,
          user_id: user.id,
          book_id: s.bookId,
          href: s.href,
          chapter_title: s.chapterTitle,
          summaries: s.summaries,
          created_at: s.createdAt,
          updated_at: s.updatedAt,
        }));
        if (summariesToUpsert.length) await supabase.from('chapter_summaries').upsert(summariesToUpsert);
      } catch (sErr) {
        console.warn('[Sync] Summaries upsert skipped:', sErr);
      }

      try {
        const fontsToUpsert = localFonts.map((f) => ({
          id: f.id,
          user_id: user.id,
          name: f.name,
          file_name: f.fileName,
          format: f.format,
          r2_key: `fonts/${f.id}.${f.format || 'ttf'}`,
          created_at: f.createdAt,
        }));
        if (fontsToUpsert.length) {
          await supabase.from('custom_fonts').upsert(fontsToUpsert);
          localFonts.forEach((f) => {
            if (f.fontData) {
              StorageService.uploadFont(f).catch(() => {});
            }
          });
        }
      } catch (fErr) {
        console.warn('[Sync] Fonts upsert skipped:', fErr);
      }

      // Upsert profile settings
      if (localSettings) {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          settings: localSettings,
          updated_at: new Date().toISOString(),
        });
      }

      // Initialize Realtime listener
      await this.initRealtimeSubscription();

      return { success: true, message: 'All library data synchronized with Supabase & Cloudflare R2.' };
    } catch (err: any) {
      console.error('Supabase sync error:', err);
      return { success: false, message: err?.message || 'Sync failed.' };
    } finally {
      this.isSyncing = false;
    }
  }
}
