import JSZip from 'jszip';
import { BookService } from './bookService';

export class WebToEpubService {
  /**
   * Đóng gói bài viết trên web thành tệp EPUB 3 ảo và lưu thẳng vào Velvet Library
   */
  static async convertAndSaveArticle(
    title: string,
    author: string,
    contentHtml: string,
    sourceUrl?: string
  ): Promise<string> {
    const zip = new JSZip();

    // 1. mimetype (không nén)
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // 2. META-INF/container.xml
    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    zip.file('META-INF/container.xml', containerXml);

    // 3. EPUB/chapter1.xhtml
    const safeTitle = title || 'Saved Article';
    const safeAuthor = author || 'Web Author';
    const chapterHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi">
<head>
  <meta charset="utf-8"/>
  <title>${safeTitle}</title>
  <style>
    body { font-family: sans-serif; line-height: 1.6; padding: 1rem; }
    h1 { font-size: 1.6rem; margin-bottom: 0.5rem; }
    .source-meta { font-size: 0.85rem; color: #666; margin-bottom: 1.5rem; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="source-meta">
    <p><strong>Tác giả / Nguồn:</strong> ${author || 'Web'}</p>
    ${sourceUrl ? `<p><strong>Link gốc:</strong> <a href="${sourceUrl}">${sourceUrl}</a></p>` : ''}
  </div>
  <article>
    ${contentHtml}
  </article>
</body>
</html>`;
    zip.file('EPUB/chapter1.xhtml', chapterHtml);

    // 4. EPUB/toc.xhtml (Nav doc)
    const tocHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Mục lục</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h2>Mục Lục</h2>
    <ol>
      <li><a href="chapter1.xhtml">${safeTitle}</a></li>
    </ol>
  </nav>
</body>
</html>`;
    zip.file('EPUB/toc.xhtml', tocHtml);

    // 5. EPUB/package.opf
    const nowIso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const opfContent = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:${crypto.randomUUID()}</dc:identifier>
    <dc:title>${safeTitle}</dc:title>
    <dc:creator>${safeAuthor}</dc:creator>
    <dc:language>vi</dc:language>
    <meta property="dcterms:modified">${nowIso}</meta>
  </metadata>
  <manifest>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`;
    zip.file('EPUB/package.opf', opfContent);

    // Generate EPUB Blob
    const epubBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
    const epubFile = new File([epubBlob], `${safeTitle}.epub`, { type: 'application/epub+zip' });

    // Import into Velvet 2-Tier Storage (OPFS + Dexie)
    return await BookService.importBook(epubFile);
  }
}
