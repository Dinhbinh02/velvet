import JSZip from 'jszip';

export interface EPUBMetadata {
  title: string;
  author: string;
  description?: string;
  coverImage?: Blob;
  totalChapters: number;
}

/**
 * Extract Metadata and Cover Image from EPUB file
 */
export class EPUBParserService {
  /**
   * Parse binary EPUB file
   */
  static async parseMetadata(file: File | Blob): Promise<EPUBMetadata> {
    const zip = await JSZip.loadAsync(file);

    // 1. Find OPF path in META-INF/container.xml
    const containerXmlStr = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXmlStr) {
      return this.fallbackMetadata(file);
    }

    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXmlStr, 'application/xml');
    const rootfileEl = containerDoc.querySelector('rootfile');
    const opfPath = rootfileEl?.getAttribute('full-path');

    if (!opfPath) {
      return this.fallbackMetadata(file);
    }

    // 2. Read OPF file
    const opfContent = await zip.file(opfPath)?.async('string');
    if (!opfContent) {
      return this.fallbackMetadata(file);
    }

    const opfDoc = parser.parseFromString(opfContent, 'application/xml');
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

    // 3. Extract Metadata
    const title =
      opfDoc.querySelector('metadata > title, metadata > dc\\:title')?.textContent?.trim() ||
      (file instanceof File ? file.name.replace(/\.epub$/i, '') : 'Untitled');

    const author =
      opfDoc.querySelector('metadata > creator, metadata > dc\\:creator')?.textContent?.trim() ||
      'Unknown Author';
    const description =
      opfDoc.querySelector('metadata > description, metadata > dc\\:description')?.textContent?.trim() ||
      undefined;

    // 4. Count chapters in spine
    const totalChapters = opfDoc.querySelectorAll('spine > itemref').length || 1;

    // 5. Extract Cover Image
    const coverImage = await this.extractCoverImage(zip, opfDoc, opfDir);

    return {
      title,
      author,
      description,
      coverImage,
      totalChapters,
    };
  }

  /**
   * Search and extract cover image from manifest
   */
  private static async extractCoverImage(
    zip: JSZip,
    opfDoc: Document,
    opfDir: string
  ): Promise<Blob | undefined> {
    try {
      let coverHref: string | null = null;

      // Method 1: EPUB 3 - item with properties="cover-image"
      const ep3CoverItem = opfDoc.querySelector('manifest > item[properties*="cover-image"]');
      if (ep3CoverItem) {
        coverHref = ep3CoverItem.getAttribute('href');
      }

      // Method 2: EPUB 2 - meta[name="cover"] linked to item id
      if (!coverHref) {
        const metaCover = opfDoc.querySelector('metadata > meta[name="cover"]');
        const coverId = metaCover?.getAttribute('content');
        if (coverId) {
          const coverItem = opfDoc.querySelector(
            `manifest > item#${CSS.escape(coverId)}, manifest > item[id="${coverId}"]`
          );
          coverHref = coverItem?.getAttribute('href') || null;
        }
      }

      // Method 3: Heuristic lookup for item containing "cover"
      if (!coverHref) {
        const heuristicItem = opfDoc.querySelector(
          'manifest > item[id*="cover" i][media-type^="image/"], manifest > item[href*="cover" i][media-type^="image/"]'
        );
        coverHref = heuristicItem?.getAttribute('href') || null;
      }

      if (!coverHref) return undefined;

      const fullCoverPath = this.resolvePath(opfDir, coverHref);
      const coverZipFile = zip.file(fullCoverPath) || zip.file(decodeURIComponent(fullCoverPath));

      if (coverZipFile) {
        const coverArrayBuffer = await coverZipFile.async('arraybuffer');
        const mediaType = this.getMediaType(coverHref);
        return new Blob([coverArrayBuffer], { type: mediaType });
      }
    } catch (e) {
      console.warn('Unable to extract cover image:', e);
    }
    return undefined;
  }

  private static resolvePath(base: string, relative: string): string {
    const stack = base.split('/').filter(Boolean);
    const parts = relative.split('/');
    for (const p of parts) {
      if (p === '..') {
        stack.pop();
      } else if (p !== '.') {
        stack.push(p);
      }
    }
    return stack.join('/');
  }

  private static getMediaType(href: string): string {
    const ext = href.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'svg':
        return 'image/svg+xml';
      default:
        return 'image/jpeg';
    }
  }

  private static fallbackMetadata(file: File | Blob): EPUBMetadata {
    return {
      title: file instanceof File ? file.name.replace(/\.epub$/i, '') : 'Untitled',
      author: 'Unknown Author',
      totalChapters: 1,
    };
  }
}
