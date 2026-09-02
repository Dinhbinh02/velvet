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
    summaries: IHeaderSummary[],
    allowFallback = false
  ): number {
    if (!workingDoc || !workingDoc.body || !summaries || summaries.length === 0) {
      console.warn('[KeyInsights] Cannot inject: missing doc or empty summaries array.', { hasDoc: !!workingDoc, count: summaries?.length });
      return 0;
    }

    console.groupCollapsed(`[KeyInsights] 💉 Injecting ${summaries.length} summaries into DOM (${workingDoc.title || 'EPUB Chapter'}, fallback: ${allowFallback})`);

    // 1. Remove any existing summary cards first to prevent duplicates
    const removedCount = workingDoc.querySelectorAll('.velvet-chapter-summary-card, [class*="chapter-summary-card"], [data-velvet-ki="true"]').length;
    workingDoc.querySelectorAll('.velvet-chapter-summary-card, [class*="chapter-summary-card"], [data-velvet-ki="true"]').forEach((el) => el.remove());
    if (removedCount > 0) {
      console.log(`[KeyInsights] Cleared ${removedCount} previous summary cards.`);
    }

    // 2. Find all headings and candidate elements across all standard & custom EPUB tag styles
    const allHeadings = Array.from(
      workingDoc.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="title"], [class*="chapter"], [class*="subchapter"], [class*="header"], [class*="section"], [class*="subhead"]'
      )
    ).filter((el) => {
      if (el.closest('figure, figcaption, [class*="caption"], [class*="footnote"], .velvet-chapter-summary-card')) return false;
      const txt = (el.textContent || '').trim();
      return txt.length > 0 && txt.length < 200;
    }) as HTMLElement[];

    const candidateHeaders = (
      Array.from(
        workingDoc.querySelectorAll(
          'p > strong, p > b, p.center, div.title, .section-title, p[class*="bold"], div[class*="heading"], p[class*="head"]'
        )
      ) as HTMLElement[]
    ).filter((el) => !el.closest('figure, figcaption, [class*="caption"], [class*="footnote"], .velvet-chapter-summary-card'));

    const searchPool = [...allHeadings, ...candidateHeaders];
    console.log(`[KeyInsights] Search pool: ${searchPool.length} candidate heading elements.`, searchPool.map(el => `<${el.tagName.toLowerCase()} class="${el.className}">: "${el.textContent?.trim().slice(0, 40)}"`));

    let insertedCount = 0;

    summaries.forEach((s, idx) => {
      if (!s.header || !s.summary) {
        console.warn(`[KeyInsights] Summary #${idx + 1} skipped (empty header/summary).`, s);
        return;
      }

      const rawHeader = s.header.trim();
      const cleanHeader = rawHeader.toLowerCase();
      const normHeader = normalizeHeadingText(rawHeader);

      if (cleanHeader.length < 2) return;

      // Match Strategy 1: Exact or substring match in searchPool
      let targetEl = searchPool.find((h) => {
        const hText = (h.textContent || '').trim().toLowerCase();
        return (
          hText === cleanHeader ||
          (hText.length < 150 && (hText.startsWith(cleanHeader) || cleanHeader.startsWith(hText)))
        );
      });

      // Match Strategy 2: Normalized heading match in searchPool (handles numbering and punctuation differences)
      if (!targetEl && normHeader.length >= 3) {
        targetEl = searchPool.find((h) => {
          const hNorm = normalizeHeadingText(h.textContent || '');
          return (
            hNorm === normHeader ||
            (hNorm.length >= 3 && (hNorm.includes(normHeader) || normHeader.includes(hNorm)))
          );
        });
      }

      // Match Strategy 3: Loose search across all paragraphs/divs in the document body
      if (!targetEl && normHeader.length >= 3) {
        const allParagraphs = Array.from(workingDoc.body.querySelectorAll('p, div, span, b, strong, i, em')).filter(
          (el) => !el.closest('.velvet-chapter-summary-card, figure, figcaption, [class*="footnote"]') && (el.textContent || '').trim().length < 120
        ) as HTMLElement[];

        targetEl = allParagraphs.find((p) => {
          const pNorm = normalizeHeadingText(p.textContent || '');
          return pNorm === normHeader || (pNorm.length >= 3 && (pNorm.includes(normHeader) || normHeader.includes(pNorm)));
        });
      }

      // If targetEl is just a number/label (e.g. <h1>7</h1>, <p class="num">7</p>, "Chapter 7")
      // advance to next sibling element so Key Insights is positioned after the full title!
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

      // If target is inside a paragraph (e.g. <strong>Header</strong> inside <p>), insert after the parent <p>
      if (targetEl && targetEl.parentElement && targetEl.parentElement.tagName.toLowerCase() === 'p' && targetEl.tagName.toLowerCase() !== 'p') {
        targetEl = targetEl.parentElement;
      }

      if (targetEl && targetEl.parentNode) {
        console.log(`[KeyInsights] ✅ Matched header "${rawHeader}" to <${targetEl.tagName.toLowerCase()} class="${targetEl.className}">: "${targetEl.textContent?.trim().slice(0, 50)}"`);

        // Create velvet luxury summary card
        const card = workingDoc.createElement('div');
        card.className = 'velvet-chapter-summary-card';
        card.setAttribute('data-velvet-ki', 'true');
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
      } else {
        console.warn(`[KeyInsights] ❌ Could not find DOM element for header: "${rawHeader}" (norm: "${normHeader}")`);
      }
    });

    // Strategy 4 (Fallback): If NO subheadings matched and allowFallback is true, insert first card at start of chapter
    if (insertedCount === 0 && summaries.length > 0 && allowFallback) {
      console.warn('[KeyInsights] No specific subheadings matched. Applying Chapter-Top Fallback insertion...');
      let fallbackTarget =
        workingDoc.body.querySelector('h1, h2, h3, [class*="title"], [class*="chapter"]') ||
        workingDoc.body.firstElementChild;

      // If fallback target is just a number (e.g. <h1>5</h1>) or "Chapter 5", advance to full title!
      if (fallbackTarget && /^\s*(chapter\s*\d*|\d+|[ivxlcdm]+|ch\.\s*\d*)\s*$/i.test(fallbackTarget.textContent || '')) {
        let next = fallbackTarget.nextElementSibling as HTMLElement | null;
        while (next && (/^\s*$/i.test(next.textContent || '') || next.matches('br, hr'))) {
          next = next.nextElementSibling as HTMLElement | null;
        }
        if (
          next &&
          (next.matches('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="heading"], [class*="subchapter"], [class*="subtitle"], p, div') &&
            (next.textContent || '').trim().length > 0 &&
            (next.textContent || '').trim().length < 150)
        ) {
          fallbackTarget = next;
        }
      }

      if (fallbackTarget && fallbackTarget.parentNode) {
        const s = summaries[0];
        const card = workingDoc.createElement('div');
        card.className = 'velvet-chapter-summary-card';
        card.setAttribute('data-velvet-ki', 'true');
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

        fallbackTarget.parentNode.insertBefore(card, fallbackTarget.nextSibling);
        insertedCount++;
        console.log('[KeyInsights] ✅ Chapter-Top Fallback card inserted after:', fallbackTarget);
      }
    }

    console.log(`[KeyInsights] 🏁 Injection complete. Total cards inserted: ${insertedCount}`);
    console.groupEnd();

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
