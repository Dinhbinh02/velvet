/**
 * Velvet Sync Debugger
 * Detailed local vs cloud synchronization diagnostics for Velvet Web App.
 *
 * Inspired by Lumina's sync debugger, customized for Velvet's architecture:
 * Dexie.js + OPFS (Local) vs Supabase Database + Supabase Storage / R2 (Cloud).
 */

import { db } from '../db/schema';
import { SupabaseService } from './supabaseClient';
import { SupabaseSyncService } from './supabaseSyncService';
import { OPFSStorageService } from './opfsStorage';

export interface ILocalBookDebugInfo {
  id: string;
  title: string;
  author: string;
  fileSize: number;
  hasCover: boolean;
  addedAt: string;
  lastReadAt: string;
  opfsExists: boolean;
  opfsSize: number;
}

export interface ICloudBookDebugInfo {
  id: string;
  title: string;
  author: string;
  file_size: number;
  r2_key?: string;
  hasCoverUrl: boolean;
  added_at: string;
  last_read_at: string;
  storageExists?: boolean;
}

export interface ILocalStats {
  storage: Record<string, { size: number; preview: string }>;
  opfs: { usedMB: number; quotaMB: number; percentage: number };
  books: { count: number; items: ILocalBookDebugInfo[] };
  progress: { count: number; items: any[] };
  highlights: { count: number; items: any[] };
  notes: { count: number; items: any[] };
  comments: { count: number; items: any[] };
  chapterSummaries: { count: number; items: any[] };
  customFonts: { count: number; items: any[] };
  sessions: { count: number };
  settings: any;
  error?: string;
}

export interface ICloudStats {
  user: { id: string; email: string } | null;
  books: { count: number; items: ICloudBookDebugInfo[] };
  progress: { count: number; items: any[] };
  highlights: { count: number; items: any[] };
  notes: { count: number; items: any[] };
  comments: { count: number; items: any[] };
  chapterSummaries: { count: number; items: any[] };
  customFonts: { count: number; items: any[] };
  storageFiles: {
    booksBucket: Array<{ name: string; size: number; updatedAt?: string | null }>;
    fontsBucket: Array<{ name: string; size: number; updatedAt?: string | null }>;
  };
  profile: any;
  error?: string;
}

export interface IDiffStats {
  books: {
    onlyLocal: ILocalBookDebugInfo[];
    onlyCloud: ICloudBookDebugInfo[];
    inBoth: Array<{ id: string; title: string; localSize: number; cloudSize: number }>;
    missingLocalBinary: ILocalBookDebugInfo[];
    missingCloudBinary: ICloudBookDebugInfo[];
    orphanedCloudFiles: string[];
  };
  progress: {
    onlyLocal: any[];
    onlyCloud: any[];
    mismatched: Array<{ bookId: string; localPct: number; cloudPct: number; diffHours: number }>;
  };
  highlights: { onlyLocal: any[]; onlyCloud: any[]; countDiff: number };
  notes: { onlyLocal: any[]; onlyCloud: any[]; countDiff: number };
  comments: { onlyLocal: any[]; onlyCloud: any[]; countDiff: number };
  chapterSummaries: { onlyLocal: any[]; onlyCloud: any[]; countDiff: number };
  customFonts: { onlyLocal: any[]; onlyCloud: any[]; countDiff: number };
}

/**
 * Gathers all local storage, Dexie DB records, and physical OPFS files.
 */
export async function gatherLocalStats(): Promise<ILocalStats> {
  const stats: ILocalStats = {
    storage: {},
    opfs: { usedMB: 0, quotaMB: 0, percentage: 0 },
    books: { count: 0, items: [] },
    progress: { count: 0, items: [] },
    highlights: { count: 0, items: [] },
    notes: { count: 0, items: [] },
    comments: { count: 0, items: [] },
    chapterSummaries: { count: 0, items: [] },
    customFonts: { count: 0, items: [] },
    sessions: { count: 0 },
    settings: null,
  };

  // 1. LocalStorage info
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('velvet_') || key.includes('supabase') || key.includes('r2'))) {
        const val = localStorage.getItem(key) || '';
        stats.storage[key] = {
          size: val.length,
          preview: val.length > 80 ? val.slice(0, 80) + '...' : val,
        };
      }
    }
  } catch (e: any) {
    stats.error = `LocalStorage read error: ${e.message}`;
  }

  // 2. OPFS Stats
  try {
    stats.opfs = await OPFSStorageService.getStorageStats();
  } catch (e: any) {
    console.warn('[SyncDebug] Could not read OPFS estimate:', e.message);
  }

  // 3. Dexie Books + OPFS File Check
  try {
    const rawBooks = await db.books.toArray();
    stats.books.count = rawBooks.length;

    stats.books.items = await Promise.all(
      rawBooks.map(async (b) => {
        let opfsExists = false;
        let opfsSize = 0;
        try {
          const file = await OPFSStorageService.getBookFile(b.id);
          if (file && file.size > 0) {
            opfsExists = true;
            opfsSize = file.size;
          }
        } catch {}

        return {
          id: b.id,
          title: b.title || '(Untitled)',
          author: b.author || '(Unknown Author)',
          fileSize: b.fileSize || 0,
          hasCover: Boolean(b.coverImage),
          addedAt: b.addedAt ? new Date(b.addedAt).toLocaleString() : '?',
          lastReadAt: b.lastReadAt ? new Date(b.lastReadAt).toLocaleString() : 'Never',
          opfsExists,
          opfsSize,
        };
      })
    );
  } catch (e: any) {
    stats.books.items = [];
    console.error('[SyncDebug] Error gathering local books:', e);
  }

  // 4. Dexie Progress
  try {
    const progressList = await db.progress.toArray();
    stats.progress.count = progressList.length;
    stats.progress.items = progressList.map((p) => ({
      bookId: p.bookId,
      percentage: Number(((p.percentage || 0) * 100).toFixed(1)),
      chapterTitle: p.chapterTitle || '?',
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '?',
    }));
  } catch (e: any) {
    console.error('[SyncDebug] Error gathering local progress:', e);
  }

  // 5. Highlights, Notes, Comments, Summaries, Fonts, Sessions, Settings
  try {
    const [highlights, notes, comments, summaries, fonts, sessions, settings] = await Promise.all([
      db.highlights.toArray().catch(() => []),
      db.notes.toArray().catch(() => []),
      db.comments.toArray().catch(() => []),
      db.chapterSummaries.toArray().catch(() => []),
      db.customFonts.toArray().catch(() => []),
      db.sessions.toArray().catch(() => []),
      db.settings.get('global-settings').catch(() => null),
    ]);

    stats.highlights = {
      count: highlights.length,
      items: highlights.map((h) => ({ id: h.id, bookId: h.bookId, text: h.text?.slice(0, 40) })),
    };
    stats.notes = {
      count: notes.length,
      items: notes.map((n) => ({ id: n.id, bookId: n.bookId, content: n.content?.slice(0, 40) })),
    };
    stats.comments = {
      count: comments.length,
      items: comments.map((c) => ({ id: c.id, bookId: c.bookId, comment: c.comment?.slice(0, 40) })),
    };
    stats.chapterSummaries = {
      count: summaries.length,
      items: summaries.map((s) => ({ id: s.id, bookId: s.bookId, chapter: s.chapterTitle })),
    };
    stats.customFonts = {
      count: fonts.length,
      items: fonts.map((f) => ({ id: f.id, name: f.name, format: f.format, hasData: Boolean(f.fontData) })),
    };
    stats.sessions = { count: sessions.length };
    stats.settings = settings;
  } catch (e: any) {
    console.error('[SyncDebug] Error gathering miscellaneous local stats:', e);
  }

  return stats;
}

/**
 * Gathers all cloud database records and storage bucket files for the authenticated user.
 */
export async function gatherCloudStats(): Promise<ICloudStats> {
  const stats: ICloudStats = {
    user: null,
    books: { count: 0, items: [] },
    progress: { count: 0, items: [] },
    highlights: { count: 0, items: [] },
    notes: { count: 0, items: [] },
    comments: { count: 0, items: [] },
    chapterSummaries: { count: 0, items: [] },
    customFonts: { count: 0, items: [] },
    storageFiles: { booksBucket: [], fontsBucket: [] },
    profile: null,
  };

  const supabase = await SupabaseService.getClient();
  const user = await SupabaseService.getCurrentUser();

  if (!supabase || !user) {
    stats.error = 'Supabase client not configured or user not signed in.';
    return stats;
  }

  stats.user = { id: user.id, email: user.email || '(no email)' };

  // 1. Fetch Cloud Database Tables
  try {
    const [
      { data: cloudBooks, error: booksErr },
      { data: cloudProgress, error: progErr },
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

    if (booksErr) console.warn('[SyncDebug] Cloud books error:', booksErr.message);
    if (progErr) console.warn('[SyncDebug] Cloud progress error:', progErr.message);

    stats.books = {
      count: cloudBooks?.length || 0,
      items: (cloudBooks || []).map((b: any) => ({
        id: b.id,
        title: b.title || '(Untitled)',
        author: b.author || '(Unknown Author)',
        file_size: b.file_size || 0,
        r2_key: b.r2_key,
        hasCoverUrl: Boolean(b.cover_url),
        added_at: b.added_at ? new Date(b.added_at).toLocaleString() : '?',
        last_read_at: b.last_read_at ? new Date(b.last_read_at).toLocaleString() : 'Never',
      })),
    };

    stats.progress = {
      count: cloudProgress?.length || 0,
      items: (cloudProgress || []).map((p: any) => ({
        bookId: p.book_id,
        percentage: Number(((p.percentage || 0) * 100).toFixed(1)),
        chapterTitle: p.chapter_title || '?',
        updatedAt: p.updated_at ? new Date(p.updated_at).toLocaleString() : '?',
        rawUpdatedAt: p.updated_at || 0,
        rawPercentage: p.percentage || 0,
      })),
    };

    stats.highlights = { count: cloudHighlights?.length || 0, items: cloudHighlights || [] };
    stats.notes = { count: cloudNotes?.length || 0, items: cloudNotes || [] };
    stats.comments = { count: cloudComments?.length || 0, items: cloudComments || [] };
    stats.chapterSummaries = { count: cloudSummaries?.length || 0, items: cloudSummaries || [] };
    stats.customFonts = { count: cloudFonts?.length || 0, items: cloudFonts || [] };
    stats.profile = cloudProfile;
  } catch (e: any) {
    stats.error = `Error fetching cloud database records: ${e.message}`;
    console.error('[SyncDebug]', e);
  }

  // 2. Fetch Storage Bucket contents ('books' and 'fonts')
  try {
    const { data: booksStorage, error: bStoreErr } = await supabase.storage.from('books').list('', { limit: 1000 });
    if (!bStoreErr && booksStorage) {
      stats.storageFiles.booksBucket = booksStorage.map((f) => ({
        name: f.name,
        size: (f.metadata as any)?.size || (f as any).size || 0,
        updatedAt: f.updated_at,
      }));
    }
  } catch (e: any) {
    console.warn('[SyncDebug] Failed to list books storage bucket:', e.message);
  }

  try {
    const { data: fontsStorage, error: fStoreErr } = await supabase.storage.from('fonts').list('', { limit: 1000 });
    if (!fStoreErr && fontsStorage) {
      stats.storageFiles.fontsBucket = fontsStorage.map((f) => ({
        name: f.name,
        size: (f.metadata as any)?.size || (f as any).size || 0,
        updatedAt: f.updated_at,
      }));
    }
  } catch (e: any) {
    console.warn('[SyncDebug] Failed to list fonts storage bucket:', e.message);
  }

  return stats;
}

/**
 * Computes deep diff between local Dexie/OPFS data and cloud database/storage.
 */
export function compareStats(local: ILocalStats, cloud: ICloudStats): IDiffStats {
  const localBookMap = new Map(local.books.items.map((b) => [b.id, b]));
  const cloudBookMap = new Map(cloud.books.items.map((b) => [b.id, b]));

  const storageFileNames = new Set(cloud.storageFiles.booksBucket.map((f) => f.name));

  const onlyLocalBooks = local.books.items.filter((b) => !cloudBookMap.has(b.id));
  const onlyCloudBooks = cloud.books.items.filter((b) => !localBookMap.has(b.id));
  const inBothBooks: Array<{ id: string; title: string; localSize: number; cloudSize: number }> = [];

  const missingLocalBinary: ILocalBookDebugInfo[] = [];
  const missingCloudBinary: ICloudBookDebugInfo[] = [];

  for (const lb of local.books.items) {
    if (!lb.opfsExists || lb.opfsSize === 0) {
      missingLocalBinary.push(lb);
    }
    const cb = cloudBookMap.get(lb.id);
    if (cb) {
      inBothBooks.push({
        id: lb.id,
        title: lb.title,
        localSize: lb.fileSize || lb.opfsSize,
        cloudSize: cb.file_size,
      });
    }
  }

  // Check which cloud books don't have binary file in cloud storage
  for (const cb of cloud.books.items) {
    const directName = `${cb.id}.epub`;
    const r2CleanName = cb.r2_key ? cb.r2_key.replace(/^books\//, '') : '';
    const existsInStorage = storageFileNames.has(directName) || (r2CleanName ? storageFileNames.has(r2CleanName) : false);
    cb.storageExists = existsInStorage;
    if (!existsInStorage && cloud.storageFiles.booksBucket.length > 0) {
      missingCloudBinary.push(cb);
    }
  }

  // Find orphaned cloud storage files
  const activeCloudKeys = new Set<string>();
  cloud.books.items.forEach((b) => {
    activeCloudKeys.add(`${b.id}.epub`);
    if (b.r2_key) activeCloudKeys.add(b.r2_key.replace(/^books\//, ''));
  });

  const orphanedCloudFiles = cloud.storageFiles.booksBucket
    .filter((f) => !activeCloudKeys.has(f.name) && !f.name.startsWith('.'))
    .map((f) => f.name);

  // Progress diff
  const localProgMap = new Map(local.progress.items.map((p) => [p.bookId, p]));
  const cloudProgMap = new Map(cloud.progress.items.map((p) => [p.bookId, p]));

  const onlyLocalProg = local.progress.items.filter((p) => !cloudProgMap.has(p.bookId));
  const onlyCloudProg = cloud.progress.items.filter((p) => !localProgMap.has(p.bookId));
  const mismatchedProg: Array<{ bookId: string; localPct: number; cloudPct: number; diffHours: number }> = [];

  for (const [bookId, lp] of localProgMap.entries()) {
    const cp = cloudProgMap.get(bookId);
    if (cp && Math.abs(lp.percentage - cp.percentage) > 0.5) {
      mismatchedProg.push({
        bookId,
        localPct: lp.percentage,
        cloudPct: cp.percentage,
        diffHours: 0,
      });
    }
  }

  return {
    books: {
      onlyLocal: onlyLocalBooks,
      onlyCloud: onlyCloudBooks,
      inBoth: inBothBooks,
      missingLocalBinary,
      missingCloudBinary,
      orphanedCloudFiles,
    },
    progress: {
      onlyLocal: onlyLocalProg,
      onlyCloud: onlyCloudProg,
      mismatched: mismatchedProg,
    },
    highlights: {
      onlyLocal: [],
      onlyCloud: [],
      countDiff: local.highlights.count - cloud.highlights.count,
    },
    notes: {
      onlyLocal: [],
      onlyCloud: [],
      countDiff: local.notes.count - cloud.notes.count,
    },
    comments: {
      onlyLocal: [],
      onlyCloud: [],
      countDiff: local.comments.count - cloud.comments.count,
    },
    chapterSummaries: {
      onlyLocal: [],
      onlyCloud: [],
      countDiff: local.chapterSummaries.count - cloud.chapterSummaries.count,
    },
    customFonts: {
      onlyLocal: [],
      onlyCloud: [],
      countDiff: local.customFonts.count - cloud.customFonts.count,
    },
  };
}

function printSection(title: string, data: any) {
  console.groupCollapsed(`%c${title}`, 'color: #38bdf8; font-weight: bold; font-size: 13px;');
  if (Array.isArray(data) && data.length > 0) {
    console.table(data);
  } else {
    console.log(data);
  }
  console.groupEnd();
}

/**
 * Main Debugger Entrypoint.
 * Formats and prints complete diagnostic tables into the browser console.
 */
export async function debugSync(): Promise<{
  local: ILocalStats;
  cloud: ICloudStats | null;
  diff: IDiffStats | null;
  syncHealthy: boolean;
}> {
  console.group('%c💎 VELVET SYNC & STORAGE DEBUGGER', 'color: #f43f5e; font-weight: bold; font-size: 16px;');
  console.log('%cGathering local Dexie + OPFS data...', 'color: #a78bfa');

  let localStats: ILocalStats;
  try {
    localStats = await gatherLocalStats();
  } catch (e: any) {
    console.error('[SyncDebug] Failed to gather local stats:', e);
    console.groupEnd();
    return { local: {} as any, cloud: null, diff: null, syncHealthy: false };
  }

  // Check Supabase Auth
  const user = await SupabaseService.getCurrentUser();
  const config = await SupabaseService.getConfig();

  console.log('%c🔧 CONFIGURATION & AUTH', 'color: #fbbf24; font-weight: bold; font-size: 14px;');
  console.table({
    'Supabase URL Configured': config?.url ? `✅ Yes (${config.url.slice(0, 25)}...)` : '❌ Missing',
    'User Authenticated': user ? `✅ Yes (${user.email || user.id})` : '❌ Not signed in',
    'OPFS Disk Usage': `${localStats.opfs.usedMB} MB / ${localStats.opfs.quotaMB} MB (${localStats.opfs.percentage}%)`,
    'LocalStorage Keys': Object.keys(localStats.storage).length,
  });

  console.log('%c📱 LOCAL DATA (Dexie & OPFS)', 'color: #34d399; font-weight: bold; font-size: 14px;');
  console.table({
    'Books in DB': localStats.books.count,
    'Reading Progress Records': localStats.progress.count,
    'Highlights': localStats.highlights.count,
    'Notes': localStats.notes.count,
    'Comments': localStats.comments.count,
    'Chapter Summaries': localStats.chapterSummaries.count,
    'Custom Fonts': localStats.customFonts.count,
    'Reading Sessions': localStats.sessions.count,
  });

  if (localStats.books.items.length > 0) {
    printSection('📚 Local Books Detail', localStats.books.items);
  }

  if (!user) {
    console.warn('%c⚠️ Not signed into Supabase. Sign in or configure credentials to inspect cloud data.', 'color: #f87171');
    console.groupEnd();
    return { local: localStats, cloud: null, diff: null, syncHealthy: false };
  }

  console.log('%cFetching Cloud Data & Storage Buckets...', 'color: #a78bfa');
  let cloudStats: ICloudStats;
  try {
    cloudStats = await gatherCloudStats();
  } catch (e: any) {
    console.error('[SyncDebug] Failed to fetch cloud stats:', e);
    console.groupEnd();
    return { local: localStats, cloud: null, diff: null, syncHealthy: false };
  }

  console.log('%c☁️ CLOUD DATA (Supabase DB & Buckets)', 'color: #60a5fa; font-weight: bold; font-size: 14px;');
  console.table({
    'Books in Cloud DB': cloudStats.books.count,
    'Files in "books" Bucket': cloudStats.storageFiles.booksBucket.length,
    'Progress Records': cloudStats.progress.count,
    'Highlights': cloudStats.highlights.count,
    'Notes': cloudStats.notes.count,
    'Comments': cloudStats.comments.count,
    'Chapter Summaries': cloudStats.chapterSummaries.count,
    'Custom Fonts in DB': cloudStats.customFonts.count,
    'Files in "fonts" Bucket': cloudStats.storageFiles.fontsBucket.length,
  });

  if (cloudStats.books.items.length > 0) {
    printSection('☁️ Cloud Books Detail', cloudStats.books.items);
  }

  if (cloudStats.storageFiles.booksBucket.length > 0) {
    printSection('📦 "books" Bucket File List', cloudStats.storageFiles.booksBucket);
  }

  // Diff Computation
  console.log('%c🔀 DIFF & SYNCHRONIZATION HEALTH', 'color: #f472b6; font-weight: bold; font-size: 14px;');
  const diff = compareStats(localStats, cloudStats);

  console.table({
    'Books (Local vs Cloud)': `${localStats.books.count} vs ${cloudStats.books.count}`,
    'Books ONLY Local (un-pushed)': diff.books.onlyLocal.length,
    'Books ONLY Cloud (un-pulled)': diff.books.onlyCloud.length,
    'Books missing OPFS binary on disk': diff.books.missingLocalBinary.length,
    'Books missing Cloud storage file': diff.books.missingCloudBinary.length,
    'Orphaned Storage files in Bucket': diff.books.orphanedCloudFiles.length,
    'Progress records count diff': localStats.progress.count - cloudStats.progress.count,
    'Highlights count diff': diff.highlights.countDiff,
    'Notes count diff': diff.notes.countDiff,
    'Comments count diff': diff.comments.countDiff,
    'Custom Fonts count diff': diff.customFonts.countDiff,
  });

  // Diagnostics alerts
  if (diff.books.onlyLocal.length > 0) {
    console.warn('%c⚠️ Books ONLY on Local (Run VelvetSync.pushToCloud() to upload):', 'color: #fbbf24; font-weight: bold');
    console.table(diff.books.onlyLocal);
  }

  if (diff.books.onlyCloud.length > 0) {
    console.warn('%c⚠️ Books ONLY on Cloud (Run VelvetSync.pullFromCloud() to download):', 'color: #fbbf24; font-weight: bold');
    console.table(diff.books.onlyCloud);
  }

  if (diff.books.missingLocalBinary.length > 0) {
    console.error('%c❌ Books in Local DB but MISSING physical EPUB file in OPFS:', 'color: #f87171; font-weight: bold');
    console.table(diff.books.missingLocalBinary);
  }

  if (diff.books.missingCloudBinary.length > 0) {
    console.error('%c❌ Books in Cloud DB but MISSING binary in Supabase "books" Bucket:', 'color: #f87171; font-weight: bold');
    console.table(diff.books.missingCloudBinary);
  }

  if (diff.books.orphanedCloudFiles.length > 0) {
    console.warn('%c🧹 Orphaned files in Supabase "books" Bucket (Run cleanSync() or cleanDuplicates() to purge):', 'color: #f59e0b; font-weight: bold');
    console.log(diff.books.orphanedCloudFiles);
  }

  const isHealthy =
    diff.books.onlyLocal.length === 0 &&
    diff.books.onlyCloud.length === 0 &&
    diff.books.missingLocalBinary.length === 0 &&
    diff.books.missingCloudBinary.length === 0 &&
    Math.abs(diff.highlights.countDiff) === 0 &&
    Math.abs(diff.notes.countDiff) === 0;

  if (isHealthy) {
    console.log('%c✨ EVERYTHING IS IN PERFECT SYNC! 🎉', 'color: #34d399; font-weight: bold; font-size: 15px;');
  } else {
    console.log('%c👉 Suggested Fixes:', 'color: #38bdf8; font-weight: bold');
    console.log('• Call %cpull()%c or %cVelvetSync.pullFromCloud()%c to pull authoritative cloud data.', 'color: #f43f5e; font-weight: bold', '', 'color: #f43f5e; font-weight: bold', '');
    console.log('• Call %cpush()%c or %cVelvetSync.pushToCloud()%c to upload all local changes to cloud.', 'color: #f43f5e; font-weight: bold', '', 'color: #f43f5e; font-weight: bold', '');
    console.log('• Call %ccleanSync()%c or %cVelvetSync.cleanDuplicates()%c to remove duplicate records and orphaned files.', 'color: #f43f5e; font-weight: bold', '', 'color: #f43f5e; font-weight: bold', '');
  }

  console.groupEnd();

  return {
    local: localStats,
    cloud: cloudStats,
    diff,
    syncHealthy: isHealthy,
  };
}

/**
 * Diagnostic helper to pull and report
 */
export async function pullDebug(): Promise<any> {
  console.log('%c[SyncDebug] Running pullFromCloud()...', 'color: #38bdf8; font-weight: bold');
  const res = await SupabaseSyncService.pullFromCloud();
  console.log('[SyncDebug] Pull result:', res);
  return await debugSync();
}

/**
 * Diagnostic helper to push and report
 */
export async function pushDebug(): Promise<any> {
  console.log('%c[SyncDebug] Running pushToCloud()...', 'color: #38bdf8; font-weight: bold');
  const res = await SupabaseSyncService.pushToCloud();
  console.log('[SyncDebug] Push result:', res);
  return await debugSync();
}

/**
 * Diagnostic helper to clean duplicates and orphaned files
 */
export async function cleanSync(): Promise<any> {
  console.log('%c[SyncDebug] Running cleanDuplicates()...', 'color: #f59e0b; font-weight: bold');
  const res = await SupabaseSyncService.cleanDuplicates();
  console.log('[SyncDebug] Clean result:', res);
  return await debugSync();
}

/**
 * Deep check on OPFS and Cloud files
 */
export async function checkFiles(): Promise<void> {
  console.group('%c📁 VELVET FILE INTEGRITY CHECK', 'color: #a855f7; font-weight: bold; font-size: 15px;');
  const local = await gatherLocalStats();
  const cloud = await gatherCloudStats();
  const diff = compareStats(local, cloud);

  console.log('%cLocal OPFS Books File Check:', 'color: #34d399; font-weight: bold');
  console.table(
    local.books.items.map((b) => ({
      Title: b.title,
      'DB ID': b.id,
      'OPFS File Exists': b.opfsExists ? '✅ Yes' : '❌ MISSING',
      'OPFS File Size': b.opfsSize > 0 ? `${(b.opfsSize / 1024).toFixed(1)} KB` : '0 KB',
      'DB Record Size': b.fileSize > 0 ? `${(b.fileSize / 1024).toFixed(1)} KB` : '0 KB',
    }))
  );

  console.log('%cCloud Storage Books Bucket Check:', 'color: #60a5fa; font-weight: bold');
  console.table(
    cloud.books.items.map((b) => ({
      Title: b.title,
      'DB ID': b.id,
      'Cloud Storage Exists': b.storageExists ? '✅ Yes' : '❌ MISSING',
      'R2 / Storage Key': b.r2_key || `${b.id}.epub`,
      'Size in DB': `${(b.file_size / 1024).toFixed(1)} KB`,
    }))
  );

  if (diff.books.orphanedCloudFiles.length > 0) {
    console.warn('%cOrphaned Files in Cloud Bucket (Not attached to any active book):', 'color: #fbbf24; font-weight: bold');
    console.table(diff.books.orphanedCloudFiles.map((name) => ({ 'File Name': name })));
  }

  console.groupEnd();
}

export const VelvetSyncDebug = {
  debugSync,
  gatherLocalStats,
  gatherCloudStats,
  compareStats,
  pullDebug,
  pushDebug,
  cleanSync,
  checkFiles,
};

// Expose on global window object for immediate console debugging
if (typeof window !== 'undefined') {
  (window as any).debugSync = debugSync;
  (window as any).syncDebug = debugSync;
  (window as any).pullDebug = pullDebug;
  (window as any).pushDebug = pushDebug;
  (window as any).cleanSync = cleanSync;
  (window as any).checkFiles = checkFiles;
  (window as any).pull = () => SupabaseSyncService.pullFromCloud();
  (window as any).push = () => SupabaseSyncService.pushToCloud();
  (window as any).sync = () => SupabaseSyncService.syncAll();
  (window as any).VelvetSyncDebug = VelvetSyncDebug;
}
