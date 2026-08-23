import JSZip from 'jszip';
import { OPFSStorageService } from './opfsStorage';
import type { IHeaderSummary } from '@/src/types/book';

export class EPUBSummaryInjectorService {
  /**
   * Inject or overwrite AI chapter header summaries directly into the EPUB's XHTML/HTML section file
   * @param bookId Book identifier
   * @param targetHref Chapter href inside EPUB (e.g., 'text/chapter1.xhtml' or 'ch01.xhtml#title')
   * @param summaries Array of header-summary objects
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

      // Look for exact match or path ending with cleanHref
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

      // 5. Parse DOM using DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'application/xhtml+xml');

      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      let workingDoc = doc;
      if (parserError) {
        // Fallback to text/html parsing if xhtml fails
        workingDoc = parser.parseFromString(htmlContent, 'text/html');
      }

      // 6. Remove any existing summary cards first (Handles Regenerate seamlessly!)
      workingDoc.querySelectorAll('.velvet-chapter-summary-card, [class*="chapter-summary-card"]').forEach((el) => el.remove());

      // 7. Find all headings in workingDoc
      const allHeadings = Array.from(
        workingDoc.querySelectorAll(
          'h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="title"], [class*="chapter-title"], [class*="subchapter"]'
        )
      ).filter((el) => {
        if (el.closest('figure, figcaption, [class*="caption"], [class*="footnote"]')) return false;
        const txt = (el.textContent || '').trim();
        return txt.length > 0 && txt.length < 150;
      }) as HTMLElement[];

      let insertedCount = 0;

      summaries.forEach((s) => {
        if (!s.header || !s.summary) return;

        const cleanHeader = s.header.trim().toLowerCase();
        if (cleanHeader.length < 3) return;

        // Find exact or high-confidence matching heading
        let targetEl = allHeadings.find((h) => {
          const hText = (h.textContent || '').trim().toLowerCase();
          return (
            hText === cleanHeader ||
            (hText.length < 100 && (hText.startsWith(cleanHeader) || cleanHeader.startsWith(hText)))
          );
        });

        // Fallback search
        if (!targetEl) {
          const candidateHeaders = (
            Array.from(
              workingDoc.querySelectorAll('p > strong:only-child, p > b:only-child, p.center, div.title, .section-title')
            ) as HTMLElement[]
          ).filter((el) => !el.closest('figure, figcaption, [class*="caption"], [class*="footnote"]'));

          targetEl = candidateHeaders.find((el) => {
            const text = (el.textContent || '').trim().toLowerCase();
            return text === cleanHeader;
          });
        }

        if (targetEl && targetEl.parentNode) {
          const card = workingDoc.createElement('div');
          card.className = 'velvet-chapter-summary-card';
          card.setAttribute(
            'style',
            'margin: 18px 0 24px 0; padding: 16px 18px; border-radius: 8px; border-left: 3px solid currentColor; border-top: 1px solid currentColor; border-right: 1px solid currentColor; border-bottom: 1px solid currentColor; border-color: color-mix(in srgb, currentColor 18%, transparent); background-color: color-mix(in srgb, currentColor 4%, transparent); font-family: inherit; font-size: 0.95em; line-height: 1.6; color: inherit; box-sizing: border-box;'
          );

          const keyPointsHtml =
            Array.isArray(s.keyPoints) && s.keyPoints.length > 0
              ? `<ul style="margin: 12px 0 0 0; padding-left: 20px; list-style-type: disc; opacity: 0.92; line-height: 1.55;">
                  ${s.keyPoints.map((kp: string) => `<li style="margin-bottom: 6px;">${kp}</li>`).join('')}
                </ul>`
              : '';

          card.innerHTML = `
            <div style="font-weight: 700; font-size: 0.9em; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.75; margin-bottom: 8px;">
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

      if (insertedCount === 0) {
        console.warn('No matching headings found in chapter file to insert summaries.');
        return false;
      }

      // 8. Serialize doc back to XML/HTML string
      const serializer = new XMLSerializer();
      const newContent = serializer.serializeToString(workingDoc);

      // 9. Update file in zip
      zip.file(matchedPath, newContent);

      // 10. Re-pack EPUB binary Blob with STORE compression for mimetype (EPUB spec) and DEFLATE for content
      const modifiedBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/epub+zip',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // 11. Save back to OPFS storage
      await OPFSStorageService.saveBook(bookId, modifiedBlob);

      return true;
    } catch (err) {
      console.error('Error injecting summaries into EPUB:', err);
      return false;
    }
  }
}
