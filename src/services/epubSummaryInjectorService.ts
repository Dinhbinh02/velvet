import JSZip from 'jszip';
import { OPFSStorageService } from './opfsStorage';
import type { IHeaderSummary } from '@/src/types/book';

/**
 * Normalizes heading text for robust matching across EPUB markup variations
 * Removes "Chapter X:", leading Roman/Arabic numbers, and extra punctuation/spaces
 */
function normalizeHeadingText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/^(chapter|ch\.|part|phần|chương)\s*(\d+|[ivxlcdm]+)[:.\s-]*/i, '')
    .replace(/^(\d+|[ivxlcdm]+)[\s.:-]+/i, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class EPUBSummaryInjectorService {
  /**
   * Inject or overwrite AI chapter header summaries directly into a live DOM document
   * @param workingDoc DOM Document (from Foliate iframe or DOMParser)
   * @param summaries Array of header-summary objects
   * @returns number of summaries successfully inserted
   */
  static injectSummariesIntoDOM(
    workingDoc: Document,
    summaries: IHeaderSummary[]
  ): number {
    if (!workingDoc || !workingDoc.body || !summaries || summaries.length === 0) return 0;

    // 1. Remove any existing summary cards first to prevent duplicates
    workingDoc.querySelectorAll('.velvet-chapter-summary-card, [class*="chapter-summary-card"]').forEach((el) => el.remove());

    // 2. Find all headings and title candidate elements in workingDoc
    const allHeadings = Array.from(
      workingDoc.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="title"], [class*="chapter-title"], [class*="subchapter"], [class*="header"]'
      )
    ).filter((el) => {
      if (el.closest('figure, figcaption, [class*="caption"], [class*="footnote"]')) return false;
      const txt = (el.textContent || '').trim();
      return txt.length > 0 && txt.length < 200;
    }) as HTMLElement[];

    const candidateHeaders = (
      Array.from(
        workingDoc.querySelectorAll('p > strong:only-child, p > b:only-child, p.center, div.title, .section-title')
      ) as HTMLElement[]
    ).filter((el) => !el.closest('figure, figcaption, [class*="caption"], [class*="footnote"]'));

    const searchPool = [...allHeadings, ...candidateHeaders];

    let insertedCount = 0;

    summaries.forEach((s) => {
      if (!s.header || !s.summary) return;

      const rawHeader = s.header.trim();
      const cleanHeader = rawHeader.toLowerCase();
      const normHeader = normalizeHeadingText(rawHeader);

      if (cleanHeader.length < 2) return;

      // Match Strategy 1: Exact or substring match on raw text
      let targetEl = searchPool.find((h) => {
        const hText = (h.textContent || '').trim().toLowerCase();
        return (
          hText === cleanHeader ||
          (hText.length < 150 && (hText.startsWith(cleanHeader) || cleanHeader.startsWith(hText)))
        );
      });

      // Match Strategy 2: Normalized heading match (handles "6 Building Pyramids" vs "Building Pyramids")
      if (!targetEl && normHeader.length >= 3) {
        targetEl = searchPool.find((h) => {
          const hNorm = normalizeHeadingText(h.textContent || '');
          return (
            hNorm === normHeader ||
            (hNorm.length >= 3 && (hNorm.includes(normHeader) || normHeader.includes(hNorm)))
          );
        });
      }

      // If targetEl is just a number/label (e.g. <h1>7</h1>, <p class="num">7</p>, "Chapter 7")
      // advance to the next sibling element (e.g. <h2>Memory Overload</h2>) so Key Insights is positioned after the full title!
      if (targetEl && /^\s*(chapter\s*\d*|\d+|[ivxlcdm]+|ch\.\s*\d*)\s*$/i.test(targetEl.textContent || '')) {
        let next = targetEl.nextElementSibling as HTMLElement | null;
        while (next && (/^\s*$/i.test(next.textContent || '') || next.matches('br, hr'))) {
          next = next.nextElementSibling as HTMLElement | null;
        }
        if (
          next &&
          (next.matches('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="heading"], [class*="subtitle"], p, div') &&
            (next.textContent || '').trim().length > 0 &&
            (next.textContent || '').trim().length < 150)
        ) {
          targetEl = next;
        }
      }

      if (targetEl && targetEl.parentNode) {
        // Create velvet luxury summary card
        const card = workingDoc.createElement('div');
        card.className = 'velvet-chapter-summary-card';
        card.setAttribute('data-velvet-ki', 'true'); // Marker for reliable removal
        card.setAttribute(
          'style',
          'margin: 18px 0 24px 0; padding: 16px 18px; border-radius: 12px; border-left: 3px solid currentColor; border-top: 1px solid currentColor; border-right: 1px solid currentColor; border-bottom: 1px solid currentColor; border-color: color-mix(in srgb, currentColor 18%, transparent); background-color: color-mix(in srgb, currentColor 4%, transparent); font-family: inherit; font-size: 0.95em; line-height: 1.6; color: inherit; box-sizing: border-box;'
        );

        const keyPointsHtml =
          Array.isArray(s.keyPoints) && s.keyPoints.length > 0
            ? `<ul style="margin: 12px 0 0 0; padding-left: 20px; list-style-type: disc; opacity: 0.92; line-height: 1.55;">
                ${s.keyPoints.map((kp: string) => `<li style="margin-bottom: 6px;">${kp}</li>`).join('')}
              </ul>`
            : '';

        card.innerHTML = `
          <div style="font-weight: 700; font-size: 0.85em; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.75; margin-bottom: 8px;">
            Key Insights
          </div>
          <div style="opacity: 0.95; font-size: 1em; line-height: 1.6;">
            ${s.summary}
          </div>
          ${keyPointsHtml}
        `;

        targetEl.parentNode.insertBefore(card, targetEl.nextSibling);
        insertedCount++;
      }
    });

    return insertedCount;
  }

  /**
   * Remove all injected Key Insights cards from a specific chapter in the EPUB file in OPFS.
   * Call this when a user deletes Key Insights for a chapter.
   */
  static async removeSummariesFromEPUB(bookId: string, targetHref: string): Promise<boolean> {
    try {
      const bookFile = await OPFSStorageService.getBookFile(bookId);
      const arrayBuffer = await bookFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      const cleanHref = targetHref.split('#')[0].replace(/^\.\//, '');
      let matchedPath: string | null = null;
      for (const relativePath of Object.keys(zip.files)) {
        if (relativePath === cleanHref || relativePath.endsWith('/' + cleanHref) || relativePath.endsWith(cleanHref)) {
          matchedPath = relativePath;
          break;
        }
      }

      if (!matchedPath) return false;

      const fileEntry = zip.file(matchedPath);
      if (!fileEntry) return false;
      const htmlContent = await fileEntry.async('string');

      const parser = new DOMParser();
      let workingDoc = parser.parseFromString(htmlContent, 'application/xhtml+xml');
      if (workingDoc.querySelector('parsererror')) {
        workingDoc = parser.parseFromString(htmlContent, 'text/html');
      }

      // Remove all injected Velvet Key Insights cards
      const cards = workingDoc.querySelectorAll('[data-velvet-ki="true"], .velvet-chapter-summary-card');
      if (cards.length === 0) return false; // Nothing to remove

      cards.forEach((el) => el.remove());

      const serializer = new XMLSerializer();
      const newContent = serializer.serializeToString(workingDoc);
      zip.file(matchedPath, newContent);

      const modifiedBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/epub+zip',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      await OPFSStorageService.saveBook(bookId, modifiedBlob);
      return true;
    } catch (err) {
      console.error('Error removing summaries from EPUB:', err);
      return false;
    }
  }

  /**
   * Inject AI summaries directly into the EPUB zip binary in OPFS (Optional / Persistence)
   */

  static async injectSummariesIntoEPUB(
    bookId: string,
    targetHref: string,
    summaries: IHeaderSummary[]
  ): Promise<boolean> {
    if (!summaries || summaries.length === 0) return false;

    try {
      // 1. Get original EPUB file from OPFS
      const bookFile = await OPFSStorageService.getBookFile(bookId);
      const arrayBuffer = await bookFile.arrayBuffer();

      // 2. Load zip
      const zip = await JSZip.loadAsync(arrayBuffer);

      // 3. Find the target XHTML file in the zip
      const cleanHref = targetHref.split('#')[0].replace(/^\.\//, '');
      let matchedPath: string | null = null;

      for (const relativePath of Object.keys(zip.files)) {
        if (
          relativePath === cleanHref ||
          relativePath.endsWith('/' + cleanHref) ||
          relativePath.endsWith(cleanHref)
        ) {
          matchedPath = relativePath;
          break;
        }
      }

      if (!matchedPath) {
        console.warn('Could not find file in EPUB zip matching href:', cleanHref);
        return false;
      }

      // 4. Read file content
      const fileEntry = zip.file(matchedPath);
      if (!fileEntry) return false;
      const htmlContent = await fileEntry.async('string');

      // 5. Parse DOM
      const parser = new DOMParser();
      let workingDoc = parser.parseFromString(htmlContent, 'application/xhtml+xml');
      if (workingDoc.querySelector('parsererror')) {
        workingDoc = parser.parseFromString(htmlContent, 'text/html');
      }

      // 6. Inject using smart DOM injector
      const insertedCount = this.injectSummariesIntoDOM(workingDoc, summaries);
      if (insertedCount === 0) return false;

      // 7. Serialize back
      const serializer = new XMLSerializer();
      const newContent = serializer.serializeToString(workingDoc);
      zip.file(matchedPath, newContent);

      // 8. Re-pack EPUB binary Blob
      const modifiedBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/epub+zip',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // 9. Save back to OPFS storage
      await OPFSStorageService.saveBook(bookId, modifiedBlob);

      return true;
    } catch (err) {
      console.error('Error injecting summaries into EPUB:', err);
      return false;
    }
  }
}
