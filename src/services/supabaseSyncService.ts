/**
 * Supabase Cloud-First Synchronization Service for Velvet
 *
 * Inspired by Lumina's Cloud-First architecture:
 * - Cloud is the single authoritative source of truth.
 * - pullFromCloud(): Wipes and replaces local Dexie & OPFS with cloud state (Cloud wins).
 * - pushToCloud(): Synchronizes local records and binaries up to Cloud.
 * - cleanDuplicates(): Purges duplicate books/notes/highlights and orphan storage files.
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
   * Debounced push to cloud after local user actions (import book, save progress, etc.)
   */
  public static triggerAutoSync(delayMs = 3000): void {
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
    }
    this.autoSyncTimer = setTimeout(() => {
      this.pushToCloud().catch((err) => console.warn('[Sync] Auto push error:', err));
    }, delayMs);
  }

  /**
   * Initialize Realtime WebSocket subscriptions to receive live multi-device updates.
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
        { event: '*', schema: 'public', table: 'books', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const row: any = payload.old;
            if (row?.id) {
              await Promise.allSettled([
                db.books.delete(row.id),
                db.progress.delete(row.id),
                db.notes.where('bookId').equals(row.id).delete(),
                db.highlights.where('bookId').equals(row.id).delete(),
                db.comments.where('bookId').equals(row.id).delete(),
                db.chapterSummaries.where('bookId').equals(row.id).delete(),
                db.sessions.where('bookId').equals(row.id).delete(),
                OPFSStorageService.deleteBook(row.id),
              ]);
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const b: any = payload.new;
            if (!b?.id) return;
            const fileHash = b.r2_key ? b.r2_key.replace(/^books\//, '').replace(/\.epub$/i, '') : undefined;
            const exists = await db.books.get(b.id);
            if (!exists) {
              await db.books.put({
                id: b.id,
                title: b.title,
                author: b.author,
                opfsPath: `books/${b.id}.epub`,
                fileSize: b.file_size,
                fileHash,
                format: b.format || 'epub',
                totalChapters: b.total_chapters,
                addedAt: b.added_at,
                lastReadAt: b.last_read_at,
                isFinished: b.is_finished,
              });
              // Download binary in background
              StorageService.downloadBook(b.id, b.r2_key).catch(() => {});
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'custom_fonts', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const row: any = payload.old;
            if (row?.id) {
              await db.customFonts.delete(row.id);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'progress', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row: any = payload.new;
            await db.progress.put({
              bookId: row.book_id,
              cfi: row.cfi,
              percentage: row.percentage,
              sectionIndex: row.section_index,
              chapterTitle: row.chapter_title,
              textAnchor: row.text_anchor || '',
              updatedAt: row.updated_at,
            });
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
            window.dispatchEvent(new CustomEvent('velvet:summaries-updated'));
          } else if (payload.eventType === 'DELETE') {
            const row: any = payload.old;
            if (row?.id) await db.chapterSummaries.delete(row.id);
            window.dispatchEvent(new CustomEvent('velvet:summaries-updated'));
          }
        }
      )
      .subscribe();
  }

  /**
   * PULL FROM CLOUD — Cloud is authoritative.
   * Fetches all cloud data and replaces local Dexie data entirely.
   */
  public static async pullFromCloud(): Promise<{ success: boolean; message: string }> {
    if (this.isSyncing) return { success: true, message: 'Sync already in progress.' };

    const supabase = await SupabaseService.getClient();
    const user = await SupabaseService.getCurrentUser();
    if (!supabase || !user) {
      return { success: false, message: 'User not signed in.' };
    }

    this.isSyncing = true;
    try {
      // 1. Fetch all cloud data in parallel
      const [
        { data: rawCloudBooks },
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

      // 1b. Automatic Deduplication & Self-Healing (Seamless background cleanup)
      let cloudBooks = rawCloudBooks || [];
      if (cloudBooks.length > 1) {
        const titleAuthorMap = new Map<string, any[]>();
        for (const b of cloudBooks) {
          const key = `${(b.title || '').trim().toLowerCase()}:::${(b.author || '').trim().toLowerCase()}`;
          if (!titleAuthorMap.has(key)) titleAuthorMap.set(key, []);
          titleAuthorMap.get(key)!.push(b);
        }

        const hasDuplicates = Array.from(titleAuthorMap.values()).some((grp) => grp.length > 1);
        if (hasDuplicates) {
          // Trigger cleanDuplicates silently in background to heal cloud DB & storage
          this.cleanDuplicates().catch(() => {});
          // Deduplicate the list in memory for immediate clean UI
          const filtered: any[] = [];
          for (const grp of titleAuthorMap.values()) {
            grp.sort((a, b) => (b.last_read_at || b.added_at || 0) - (a.last_read_at || a.added_at || 0));
            filtered.push(grp[0]);
          }
          cloudBooks = filtered;
        }
      }

      // 2. Replace local books with cloud books
      const cloudBookIds = new Set((cloudBooks || []).map((b: any) => b.id));

      // Remove local books that no longer exist in cloud
      const localBooks = await db.books.toArray();
      for (const lb of localBooks) {
        if (!cloudBookIds.has(lb.id)) {
          await Promise.allSettled([
            db.books.delete(lb.id),
            db.progress.delete(lb.id),
            db.notes.where('bookId').equals(lb.id).delete(),
            db.highlights.where('bookId').equals(lb.id).delete(),
            db.comments.where('bookId').equals(lb.id).delete(),
            db.chapterSummaries.where('bookId').equals(lb.id).delete(),
            db.sessions.where('bookId').equals(lb.id).delete(),
            OPFSStorageService.deleteBook(lb.id),
          ]);
        }
      }

      // Upsert cloud books into local Dexie and download EPUB binaries if missing
      if (cloudBooks?.length) {
        for (const b of cloudBooks) {
          const existing = await db.books.get(b.id);
          let coverBlob: Blob | string | undefined = existing?.coverImage;

          if (!coverBlob && b.cover_url) {
            if (b.cover_url.startsWith('data:')) {
              coverBlob = b.cover_url;
            } else {
              try {
                const res = await fetch(b.cover_url);
                if (res.ok) coverBlob = await res.blob();
              } catch {}
            }
          }

          const fileHash = b.r2_key
            ? b.r2_key.replace(/^books\//, '').replace(/\.epub$/i, '')
            : existing?.fileHash;

          await db.books.put({
            id: b.id,
            title: b.title,
            author: b.author,
            coverImage: (coverBlob as Blob) || existing?.coverImage || undefined,
            opfsPath: `books/${b.id}.epub`,
            fileSize: b.file_size,
            fileHash,
            format: b.format || 'epub',
            totalChapters: b.total_chapters,
            addedAt: b.added_at,
            lastReadAt: b.last_read_at,
            isFinished: b.is_finished,
          });

          // Check if physical file exists in OPFS; if not, download it
          try {
            const file = await OPFSStorageService.getBookFile(b.id);
            if (!file || file.size === 0) throw new Error('File missing');
          } catch {
            const storageKey = b.r2_key || (fileHash ? `books/${fileHash}.epub` : `books/${b.id}.epub`);
            StorageService.downloadBook(b.id, storageKey).then(async (downloaded) => {
              if (downloaded && !coverBlob) {
                try {
                  const file = await OPFSStorageService.getBookFile(b.id);
                  const { EPUBParserService } = await import('./epubParser');
                  const meta = await EPUBParserService.parseMetadata(file);
                  if (meta.coverImage) {
                    await db.books.update(b.id, { coverImage: meta.coverImage });
                  }
                } catch {}
              }
            }).catch(() => {});
          }
        }
      }

      // 3. Replace local progress with cloud progress
      await db.progress.clear();
      if (cloudProgress?.length) {
        await db.progress.bulkPut(
          cloudProgress.map((p) => ({
            bookId: p.book_id,
            cfi: p.cfi,
            percentage: p.percentage,
            sectionIndex: p.section_index,
            chapterTitle: p.chapter_title,
            textAnchor: p.text_anchor || '',
            updatedAt: p.updated_at,
          }))
        );
      }

      // 4. Replace local highlights with cloud highlights
      await db.highlights.clear();
      if (cloudHighlights?.length) {
        await db.highlights.bulkPut(
          cloudHighlights.map((h) => ({
            id: h.id,
            bookId: h.book_id,
            text: h.text,
            color: h.color,
            createdAt: h.created_at,
          }))
        );
      }

      // 5. Replace local notes with cloud notes
      await db.notes.clear();
      if (cloudNotes?.length) {
        await db.notes.bulkPut(
          cloudNotes.map((n) => ({
            id: n.id,
            bookId: n.book_id,
            content: n.content || n.note || '',
            chapterTitle: n.chapter_title,
            createdAt: n.created_at,
            updatedAt: n.updated_at,
          }))
        );
      }

      // 6. Replace local comments with cloud comments
      await db.comments.clear();
      if (cloudComments?.length) {
        await db.comments.bulkPut(
          cloudComments.map((c) => ({
            id: c.id,
            bookId: c.book_id,
            selectedText: c.selected_text,
            comment: c.comment,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }))
        );
      }

      // 7. Replace local chapter summaries with cloud summaries
      await db.chapterSummaries.clear();
      if (cloudSummaries?.length) {
        await db.chapterSummaries.bulkPut(
          cloudSummaries.map((s) => ({
            id: s.id,
            bookId: s.book_id,
            href: s.href,
            chapterTitle: s.chapter_title,
            summaries: s.summaries,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
          }))
        );
        window.dispatchEvent(new CustomEvent('velvet:summaries-updated'));
      }

      // 8. Replace local fonts with cloud fonts
      if (cloudFonts?.length) {
        const cloudFontIds = new Set(cloudFonts.map((f: any) => f.id));
        const localFonts = await db.customFonts.toArray();
        for (const lf of localFonts) {
          if (!cloudFontIds.has(lf.id)) await db.customFonts.delete(lf.id);
        }
        for (const f of cloudFonts) {
          const existing = await db.customFonts.get(f.id);
          if (!existing?.fontData) {
            const storageKey = f.r2_key || `fonts/${f.id}.${f.format || 'ttf'}`;
            const fontData = await StorageService.downloadFont(storageKey);
            await db.customFonts.put({
              id: f.id,
              name: f.name,
              fileName: f.file_name,
              format: f.format,
              fontData: fontData || existing?.fontData || '',
              createdAt: f.created_at,
            });
          }
        }
      }

      // 9. Apply cloud settings
      if (cloudProfile?.settings) {
        const cloudSettings = cloudProfile.settings as any;
        const localSettings = await db.settings.get('global-settings');
        const localUpdatedAt = (localSettings as any)?.updatedAt || 0;
        const cloudUpdatedAt =
          cloudSettings.updatedAt ||
          (cloudProfile.updated_at ? new Date(cloudProfile.updated_at).getTime() : 0);

        if (cloudUpdatedAt >= localUpdatedAt) {
          const merged = { ...localSettings, ...cloudSettings };
          await db.settings.put(merged);
          try {
            localStorage.setItem('velvet_settings_cache', JSON.stringify(merged));
          } catch {}
        }
      }

      // 10. Start Realtime listener
      await this.initRealtimeSubscription();

      return { success: true, message: 'Library synced from cloud.' };
    } catch (err: any) {
      console.error('[Sync] pullFromCloud error:', err);
      return { success: false, message: err?.message || 'Sync failed.' };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * PUSH TO CLOUD — Upload local data to Supabase.
   */
  public static async pushToCloud(): Promise<{ success: boolean; message: string }> {
    const supabase = await SupabaseService.getClient();
    const user = await SupabaseService.getCurrentUser();
    if (!supabase || !user) return { success: false, message: 'User not signed in.' };

    try {
      const [localBooks, localProgress, localHighlights, localNotes, localComments, localSummaries, localFonts] =
        await Promise.all([
          db.books.toArray(),
          db.progress.toArray(),
          db.highlights.toArray(),
          db.notes.toArray(),
          db.comments.toArray(),
          db.chapterSummaries.toArray(),
          db.customFonts.toArray(),
        ]);

      // Push books and upload missing binaries
      if (localBooks.length) {
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

            const storageKey = b.fileHash ? `${b.fileHash}.epub` : `${b.id}.epub`;

            return {
              id: b.id,
              user_id: user.id,
              title: b.title,
              author: b.author || '',
              file_size: b.fileSize || 0,
              format: b.format || 'epub',
              total_chapters: b.totalChapters || 0,
              r2_key: `books/${storageKey}`,
              cover_url: coverUrl || undefined,
              added_at: b.addedAt || Date.now(),
              last_read_at: b.lastReadAt || Date.now(),
              is_finished: b.isFinished || false,
            };
          })
        );

        await supabase.from('books').upsert(booksToUpsert);

        // Upload any book binaries that are in OPFS
        for (const b of localBooks) {
          StorageService.uploadBook(b.id, undefined, b.fileHash).catch(() => {});
        }
      }

      // Push progress
      if (localProgress.length) {
        await supabase.from('progress').upsert(
          localProgress.map((p) => ({
            user_id: user.id,
            book_id: p.bookId,
            cfi: p.cfi,
            percentage: p.percentage,
            section_index: p.sectionIndex,
            chapter_title: p.chapterTitle || '',
            text_anchor: p.textAnchor || '',
            updated_at: p.updatedAt || Date.now(),
          }))
        );
      }

      // Push highlights
      if (localHighlights.length) {
        try {
          await supabase.from('highlights').upsert(
            localHighlights.map((h) => ({
              id: h.id,
              user_id: user.id,
              book_id: h.bookId,
              text: h.text,
              color: h.color,
              created_at: h.createdAt,
            }))
          );
        } catch (err) {
          console.warn('[Sync] Highlights push skipped:', err);
        }
      }

      // Push notes
      if (localNotes.length) {
        try {
          await supabase.from('notes').upsert(
            localNotes.map((n) => ({
              id: n.id,
              user_id: user.id,
              book_id: n.bookId,
              content: n.content,
              chapter_title: n.chapterTitle || '',
              selected_text: n.chapterTitle || '',
              note: n.content,
              created_at: n.createdAt,
              updated_at: n.updatedAt,
            }))
          );
        } catch (err) {
          console.warn('[Sync] Notes push skipped:', err);
        }
      }

      // Push comments
      if (localComments.length) {
        try {
          await supabase.from('comments').upsert(
            localComments.map((c) => ({
              id: c.id,
              user_id: user.id,
              book_id: c.bookId,
              selected_text: c.selectedText,
              comment: c.comment,
              created_at: c.createdAt,
              updated_at: c.updatedAt,
            }))
          );
        } catch (err) {
          console.warn('[Sync] Comments push skipped:', err);
        }
      }

      // Push chapter summaries
      if (localSummaries.length) {
        try {
          await supabase.from('chapter_summaries').upsert(
            localSummaries.map((s) => ({
              id: s.id,
              user_id: user.id,
              book_id: s.bookId,
              href: s.href,
              chapter_title: s.chapterTitle,
              summaries: s.summaries,
              created_at: s.createdAt,
              updated_at: s.updatedAt,
            }))
          );
        } catch (err) {
          console.warn('[Sync] Summaries push skipped:', err);
        }
      }

      // Push fonts
      if (localFonts.length) {
        try {
          await supabase.from('custom_fonts').upsert(
            localFonts.map((f) => ({
              id: f.id,
              user_id: user.id,
              name: f.name,
              file_name: f.fileName,
              format: f.format,
              r2_key: `fonts/${f.id}.${f.format || 'ttf'}`,
              created_at: f.createdAt,
            }))
          );
          localFonts.forEach((f) => {
            if (f.fontData) StorageService.uploadFont(f).catch(() => {});
          });
        } catch (err) {
          console.warn('[Sync] Fonts push skipped:', err);
        }
      }

      // Push profile settings
      const latestSettings = (await db.settings.get('global-settings')) || {};
      if (latestSettings) {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          settings: latestSettings,
          updated_at: new Date((latestSettings as any).updatedAt || Date.now()).toISOString(),
        });
      }

      return { success: true, message: 'Local data pushed to cloud.' };
    } catch (err: any) {
      console.error('[Sync] pushToCloud error:', err);
      return { success: false, message: err?.message || 'Push failed.' };
    }
  }

  /**
   * Cleans duplicate database records, links orphan storage files, and heals missing OPFS binaries.
   */
  public static async cleanDuplicates(): Promise<{
    success: boolean;
    deletedCount: number;
    details: Record<string, number>;
  }> {
    const supabase = await SupabaseService.getClient();
    const user = await SupabaseService.getCurrentUser();
    if (!supabase || !user) return { success: false, deletedCount: 0, details: {} };

    console.log('[Sync] Scanning Supabase database and storage for duplicates...');
    let totalDeleted = 0;
    const details: Record<string, number> = {
      books: 0,
      highlights: 0,
      notes: 0,
      comments: 0,
      summaries: 0,
      fonts: 0,
      storageBooks: 0,
      storageFonts: 0,
    };

    try {
      // 1. Fetch current Storage files in 'books' bucket
      const { data: storageBookFiles } = await supabase.storage.from('books').list('', { limit: 1000 });
      const availableBucketFiles = (storageBookFiles || []).filter((f) => f.name.endsWith('.epub'));

      // 2. Deduplicate Books (same title & author)
      const { data: books } = await supabase.from('books').select('*').eq('user_id', user.id);
      if (books && books.length > 0) {
        const bookMap = new Map<string, any[]>();
        for (const b of books) {
          const key = `${(b.title || '').trim().toLowerCase()}:::${(b.author || '').trim().toLowerCase()}`;
          if (!bookMap.has(key)) bookMap.set(key, []);
          bookMap.get(key)!.push(b);
        }

        for (const [_, group] of bookMap.entries()) {
          // Sort to keep the most recent book
          group.sort((a, b) => (b.last_read_at || b.added_at || 0) - (a.last_read_at || a.added_at || 0));
          const survivingBook = group[0];

          // If there is an existing file in bucket (e.g. 2eeb5b10b...epub) match it with surviving book
          if (availableBucketFiles.length > 0) {
            let matchedStorageFile = availableBucketFiles.find(
              (f) => f.name === `${survivingBook.id}.epub` || (survivingBook.r2_key && f.name === survivingBook.r2_key.replace(/^books\//, ''))
            );
            if (!matchedStorageFile && availableBucketFiles.length === 1) {
              matchedStorageFile = availableBucketFiles[0];
            }
            if (matchedStorageFile) {
              const properR2Key = `books/${matchedStorageFile.name}`;
              const properHash = matchedStorageFile.name.replace(/\.epub$/i, '');
              await supabase.from('books').update({ r2_key: properR2Key }).eq('id', survivingBook.id);
              await db.books.update(survivingBook.id, { fileHash: properHash });
              // Download to local OPFS if not present
              await StorageService.downloadBook(survivingBook.id, properR2Key);
            }
          }

          // Delete duplicates
          if (group.length > 1) {
            const toDelete = group.slice(1);
            for (const b of toDelete) {
              console.log(`[Sync] Deleting duplicate book in Supabase: "${b.title}" (id: ${b.id})`);
              await Promise.allSettled([
                supabase.from('books').delete().eq('id', b.id),
                supabase.from('progress').delete().eq('book_id', b.id),
                supabase.from('notes').delete().eq('book_id', b.id),
                supabase.from('highlights').delete().eq('book_id', b.id),
                supabase.from('comments').delete().eq('book_id', b.id),
                supabase.from('chapter_summaries').delete().eq('book_id', b.id),
                db.books.delete(b.id),
                db.progress.delete(b.id),
                db.notes.where('bookId').equals(b.id).delete(),
                db.highlights.where('bookId').equals(b.id).delete(),
                db.comments.where('bookId').equals(b.id).delete(),
                db.chapterSummaries.where('bookId').equals(b.id).delete(),
                OPFSStorageService.deleteBook(b.id),
              ]);
              details.books++;
              totalDeleted++;
            }
          }
        }
      }

      // 3. Deduplicate Highlights (same book_id, text, color)
      const { data: highlights } = await supabase.from('highlights').select('*').eq('user_id', user.id);
      if (highlights && highlights.length > 1) {
        const hMap = new Map<string, any[]>();
        for (const h of highlights) {
          const key = `${h.book_id}:::${(h.text || '').trim()}:::${h.color || ''}`;
          if (!hMap.has(key)) hMap.set(key, []);
          hMap.get(key)!.push(h);
        }
        for (const [_, group] of hMap.entries()) {
          if (group.length > 1) {
            group.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
            const toDelete = group.slice(1);
            for (const h of toDelete) {
              await supabase.from('highlights').delete().eq('id', h.id);
              await db.highlights.delete(h.id);
              details.highlights++;
              totalDeleted++;
            }
          }
        }
      }

      // 4. Deduplicate Notes (same book_id, content)
      const { data: notes } = await supabase.from('notes').select('*').eq('user_id', user.id);
      if (notes && notes.length > 1) {
        const nMap = new Map<string, any[]>();
        for (const n of notes) {
          const key = `${n.book_id}:::${(n.content || n.note || '').trim()}`;
          if (!nMap.has(key)) nMap.set(key, []);
          nMap.get(key)!.push(n);
        }
        for (const [_, group] of nMap.entries()) {
          if (group.length > 1) {
            group.sort((a, b) => (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0));
            const toDelete = group.slice(1);
            for (const n of toDelete) {
              await supabase.from('notes').delete().eq('id', n.id);
              await db.notes.delete(n.id);
              details.notes++;
              totalDeleted++;
            }
          }
        }
      }

      // 5. Deduplicate Comments (same book_id, selected_text, comment)
      const { data: comments } = await supabase.from('comments').select('*').eq('user_id', user.id);
      if (comments && comments.length > 1) {
        const cMap = new Map<string, any[]>();
        for (const c of comments) {
          const key = `${c.book_id}:::${(c.selected_text || '').trim()}:::${(c.comment || '').trim()}`;
          if (!cMap.has(key)) cMap.set(key, []);
          cMap.get(key)!.push(c);
        }
        for (const [_, group] of cMap.entries()) {
          if (group.length > 1) {
            group.sort((a, b) => (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0));
            const toDelete = group.slice(1);
            for (const c of toDelete) {
              await supabase.from('comments').delete().eq('id', c.id);
              await db.comments.delete(c.id);
              details.comments++;
              totalDeleted++;
            }
          }
        }
      }

      // 6. Deduplicate Custom Fonts (same font name)
      const { data: fonts } = await supabase.from('custom_fonts').select('*').eq('user_id', user.id);
      if (fonts && fonts.length > 1) {
        const fMap = new Map<string, any[]>();
        for (const f of fonts) {
          const key = (f.name || '').trim().toLowerCase();
          if (!fMap.has(key)) fMap.set(key, []);
          fMap.get(key)!.push(f);
        }
        for (const [_, group] of fMap.entries()) {
          if (group.length > 1) {
            group.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
            const toDelete = group.slice(1);
            for (const f of toDelete) {
              await supabase.from('custom_fonts').delete().eq('id', f.id);
              await db.customFonts.delete(f.id);
              details.fonts++;
              totalDeleted++;
            }
          }
        }
      }

      // 7. Clean truly orphaned Storage Buckets files
      try {
        const { data: remainingBooks } = await supabase.from('books').select('id, r2_key').eq('user_id', user.id);
        const activeBookKeys = new Set<string>();
        (remainingBooks || []).forEach((b) => {
          activeBookKeys.add(`${b.id}.epub`);
          if (b.r2_key) {
            activeBookKeys.add(b.r2_key.replace(/^books\//, ''));
          }
        });

        if (storageBookFiles && storageBookFiles.length > 0) {
          const toRemove: string[] = [];
          for (const file of storageBookFiles) {
            if (!activeBookKeys.has(file.name) && !file.name.startsWith('.')) {
              toRemove.push(file.name);
            }
          }
          if (toRemove.length > 0) {
            console.log(`[Sync] Cleaning ${toRemove.length} orphaned files from 'books' bucket:`, toRemove);
            await supabase.storage.from('books').remove(toRemove);
            details.storageBooks = toRemove.length;
            totalDeleted += toRemove.length;
          }
        }
      } catch (err) {
        console.warn('[Sync] Storage books bucket cleanup skipped:', err);
      }

      console.log(`[Sync] Cleanup complete! Total removed: ${totalDeleted}`, details);
      return { success: true, deletedCount: totalDeleted, details };
    } catch (err: any) {
      console.error('[Sync] cleanDuplicates error:', err);
      return { success: false, deletedCount: totalDeleted, details };
    }
  }

  /**
   * SYNC ALL — Cloud-First authoritative pull.
   */
  public static async syncAll(): Promise<{ success: boolean; message: string }> {
    return await this.pullFromCloud();
  }
}

if (typeof window !== 'undefined') {
  (window as any).VelvetSync = SupabaseSyncService;
}
