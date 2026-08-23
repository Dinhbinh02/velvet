import { BookService } from './bookService';

export interface IDiscoveryBook {
  id: string | number;
  workKey?: string;
  title: string;
  author: string;
  coverUrl: string;
  epubUrl?: string;
  subjects: string[];
  downloads?: number;
  category: 'fiction' | 'nonfiction';
  description?: string;
  source: 'Open Library' | 'Internet Archive' | 'Standard Ebooks' | 'Project Gutenberg';
  isPublicDomain?: boolean;
  publishYear?: number;
  ebookAccess?: 'public' | 'borrowable' | 'printdisabled' | 'no_ebook';
}

const COLLECTION_SUBJECT_MAP: Record<string, string> = {
  'detective-mystery': 'detective_and_mystery_stories',
  'scifi-journeys': 'science_fiction',
  'timeless-classics': 'classic_literature',
  'stoicism-philosophy': 'philosophy',
  'strategy-power': 'politics_and_government',
  'great-minds-science': 'science',
  'legends-myths-drama': 'mythology',
  'mindset-potential': 'self-help',
};

// In-memory Cache for instant response
const collectionCache = new Map<string, IDiscoveryBook[]>();
const searchCache = new Map<string, IDiscoveryBook[]>();
const descriptionCache = new Map<string, string>();

export class DiscoveryService {
  /**
   * Fetch additional books for a specific curated collection (up to 100+ books with lazy loading)
   */
  public static async fetchMoreCollectionBooks(
    collectionId: string,
    offset = 0,
    limit = 25
  ): Promise<IDiscoveryBook[]> {
    const subject = COLLECTION_SUBJECT_MAP[collectionId] || 'classic_literature';
    const cacheKey = `${collectionId}-${offset}-${limit}`;

    if (collectionCache.has(cacheKey)) {
      return collectionCache.get(cacheKey)!;
    }

    try {
      const res = await fetch(
        `https://openlibrary.org/subjects/${subject}.json?limit=${limit}&offset=${offset}`
      );

      if (res.ok) {
        const data = await res.json();
        const category = ['detective-mystery', 'scifi-journeys', 'timeless-classics', 'legends-myths-drama'].includes(collectionId)
          ? 'fiction'
          : 'nonfiction';

        const books = this.mapSubjectWorks(data.works || [], category);
        collectionCache.set(cacheKey, books);
        return books;
      }
    } catch (err) {
      console.warn(`Failed to lazy load collection ${collectionId}:`, err);
    }

    return [];
  }

  /**
   * Search books across Open Library with sub-second response
   */
  public static async searchBooks(query: string, signal?: AbortSignal): Promise<IDiscoveryBook[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    if (searchCache.has(q)) {
      return searchCache.get(q)!;
    }

    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=30`,
        { signal }
      );

      if (res.ok) {
        const data = await res.json();
        const results: IDiscoveryBook[] = (data.docs || []).map((doc: any) => {
          const authorName = doc.author_name?.join(', ') || 'Unknown Author';
          const coverId = doc.cover_i;
          const coverUrl = coverId
            ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
            : `https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400`;

          const iaId = Array.isArray(doc.ia) ? doc.ia[0] : doc.ia;
          const isPublic = doc.ebook_access === 'public' || doc.public_scan_b === true;
          const epubUrl = isPublic && iaId ? `https://archive.org/download/${iaId}/${iaId}.epub` : undefined;

          const isFiction = doc.subject?.some((s: string) =>
            /fiction|novel|literature|stories|tales|drama/i.test(s)
          );

          const workKey = doc.key ? doc.key.replace('/works/', '') : undefined;

          return {
            id: `ol-${workKey || doc.cover_edition_key || Math.random().toString(36).slice(2)}`,
            workKey,
            title: doc.title,
            author: authorName,
            coverUrl,
            epubUrl,
            subjects: doc.subject?.slice(0, 3) || [],
            publishYear: doc.first_publish_year,
            category: (isFiction ? 'fiction' : 'nonfiction') as 'fiction' | 'nonfiction',
            source: 'Open Library' as const,
            isPublicDomain: isPublic,
            ebookAccess: doc.ebook_access,
          };
        });

        searchCache.set(q, results);
        if (searchCache.size > 100) {
          const firstKey = searchCache.keys().next().value;
          if (firstKey) searchCache.delete(firstKey);
        }

        return results;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Open Library search failed:', err);
      }
    }

    return [];
  }

  /**
   * Fetch full description/synopsis for a book from Open Library Works API
   */
  public static async getBookDescription(book: IDiscoveryBook): Promise<string> {
    const key = book.workKey || String(book.id).replace('ol-', '').replace('/works/', '');
    if (descriptionCache.has(key)) {
      return descriptionCache.get(key)!;
    }

    try {
      const res = await fetch(`https://openlibrary.org/works/${key}.json`);
      if (res.ok) {
        const data = await res.json();
        const desc = data.description;
        let descText = '';
        if (typeof desc === 'string') descText = desc;
        else if (typeof desc === 'object' && desc?.value) descText = desc.value;

        descText = descText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
        if (descText) {
          descriptionCache.set(key, descText);
          return descText;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch book description:', err);
    }

    return '';
  }

  /**
   * Helper to map subject works into IDiscoveryBook
   */
  private static mapSubjectWorks(works: any[], category: 'fiction' | 'nonfiction'): IDiscoveryBook[] {
    return works.map((w) => {
      const authorName = w.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author';
      const coverId = w.cover_id;
      const coverUrl = coverId
        ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
        : `https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400`;

      const iaId = w.ia;
      const isPublic = Boolean(
        iaId &&
        w.availability?.status === 'open' &&
        w.availability?.is_lendable !== true &&
        w.availability?.is_printdisabled !== true
      );
      const epubUrl = isPublic && iaId ? `https://archive.org/download/${iaId}/${iaId}.epub` : undefined;
      const workKey = w.key ? w.key.replace('/works/', '') : undefined;

      return {
        id: `ol-${workKey || Math.random().toString(36).slice(2)}`,
        workKey,
        title: w.title,
        author: authorName,
        coverUrl,
        epubUrl,
        subjects: w.subject?.slice(0, 3) || [],
        category,
        source: 'Open Library' as const,
        isPublicDomain: isPublic,
      };
    });
  }

  /**
   * 1-Click Download and Import directly into Velvet Library
   */
  public static async downloadAndImportBook(
    book: IDiscoveryBook,
    onProgress?: (msg: string) => void
  ): Promise<string> {
    if (!book.epubUrl || !book.isPublicDomain) {
      throw new Error(
        `"${book.title}" is restricted by commercial copyright. Please import your own EPUB file.`
      );
    }

    if (onProgress) onProgress('Downloading EPUB...');

    let res: Response | null = null;
    const urlsToTry: string[] = [];

    if (String(book.id).startsWith('gutenberg-')) {
      const gId = String(book.id).replace('gutenberg-', '');
      urlsToTry.push(
        `https://www.gutenberg.org/cache/epub/${gId}/pg${gId}-images-3.epub`,
        `https://www.gutenberg.org/cache/epub/${gId}/pg${gId}-images.epub`,
        `https://www.gutenberg.org/cache/epub/${gId}/pg${gId}.epub.images`,
        `https://www.gutenberg.org/cache/epub/${gId}/pg${gId}.epub.noimages`,
        `https://www.gutenberg.org/ebooks/${gId}.epub3.images`,
        `https://www.gutenberg.org/ebooks/${gId}.epub.images`,
        `https://www.gutenberg.org/ebooks/${gId}.epub.noimages`
      );
    } else if (book.epubUrl) {
      urlsToTry.push(book.epubUrl);
    }

    // Helper to fetch with timeout and CORS fallbacks
    const fetchWithFallbacks = async (targetUrl: string): Promise<Response | null> => {
      // 1. Local Dev Server Proxy (Bypasses all CORS and Gutenberg bot restrictions with 0 latency)
      try {
        const localProxyRes = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`);
        if (localProxyRes.ok && localProxyRes.status === 200) return localProxyRes;
      } catch {}

      // 2. Direct fetch (works in environments without strict CORS or with mirror support)
      try {
        const directRes = await fetch(targetUrl);
        if (directRes.ok && directRes.status === 200) return directRes;
      } catch {}

      // 3. CORS Proxy 1: corsproxy.io
      try {
        const proxy1 = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
        if (proxy1.ok && proxy1.status === 200) return proxy1;
      } catch {}

      // 4. CORS Proxy 2: codetabs proxy
      try {
        const proxy2 = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);
        if (proxy2.ok && proxy2.status === 200) return proxy2;
      } catch {}

      // 5. CORS Proxy 3: allorigins raw
      try {
        const proxy3 = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);
        if (proxy3.ok && proxy3.status === 200) return proxy3;
      } catch {}

      return null;
    };

    for (const u of urlsToTry) {
      res = await fetchWithFallbacks(u);
      if (res && res.ok) break;
    }

    if (!res || !res.ok) {
      throw new Error(
        `Unable to download EPUB for "${book.title}". You can import your local EPUB file instead.`
      );
    }

    if (onProgress) onProgress('Optimizing & Adding to Library...');
    const blob = await res.blob();
    const cleanFileName = `${book.title.replace(/[^a-zA-Z0-9\s_-]/g, '')}.epub`;
    const file = new File([blob], cleanFileName, { type: 'application/epub+zip' });

    const bookId = await BookService.importBook(file);
    return bookId;
  }
}
