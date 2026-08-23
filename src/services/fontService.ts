import JSZip from 'jszip';
import { db } from '../db/schema';
import type { ICustomFont } from '../types/book';

export class FontService {
  /**
   * Get all uploaded custom fonts
   */
  static async getCustomFonts(): Promise<ICustomFont[]> {
    return await db.customFonts.reverse().sortBy('createdAt');
  }

  /**
   * Import a font file (.woff2, .woff, .ttf, .otf) or a .zip archive containing fonts into IndexedDB.
   * Returns an array of imported fonts.
   */
  static async importFont(file: File): Promise<ICustomFont[]> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    // 1. If it is a ZIP archive, extract all font files recursively
    if (ext === 'zip' || file.type.includes('zip')) {
      return await this.importFontsFromZip(file);
    }

    // 2. Single font file
    if (!['woff2', 'woff', 'ttf', 'otf'].includes(ext || '')) {
      throw new Error('Unsupported format. Please upload .zip, .woff2, .woff, .ttf, or .otf');
    }

    const font = await this.saveSingleFont(file.name, file, ext as 'woff2' | 'woff' | 'ttf' | 'otf');
    return [font];
  }

  /**
   * Extract all font files from a .zip file and save them into IndexedDB
   */
  private static async importFontsFromZip(zipFile: File): Promise<ICustomFont[]> {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    const validExtensions = ['woff2', 'woff', 'ttf', 'otf'];
    const importedFonts: ICustomFont[] = [];

    const fileEntries: { name: string; zipEntry: JSZip.JSZipObject }[] = [];

    contents.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;
      // Skip hidden files like __MACOSX, .DS_Store
      if (relativePath.includes('__MACOSX') || relativePath.startsWith('.') || relativePath.includes('/.')) return;

      const fileExt = relativePath.split('.').pop()?.toLowerCase();
      if (fileExt && validExtensions.includes(fileExt)) {
        // Extract base filename (ignoring internal folder structure)
        const baseName = relativePath.split('/').pop() || relativePath;
        fileEntries.push({ name: baseName, zipEntry });
      }
    });

    if (fileEntries.length === 0) {
      throw new Error('No valid font files (.ttf, .otf, .woff2, .woff) found inside the zip file.');
    }

    for (const entry of fileEntries) {
      const ext = entry.name.split('.').pop()?.toLowerCase() as 'woff2' | 'woff' | 'ttf' | 'otf';
      const blob = await entry.zipEntry.async('blob');
      const font = await this.saveSingleFont(entry.name, blob, ext);
      importedFonts.push(font);
    }

    return importedFonts;
  }

  /**
   * Helper to normalize font metadata and save into Dexie IndexedDB
   */
  private static async saveSingleFont(fileName: string, blob: Blob, format: 'woff2' | 'woff' | 'ttf' | 'otf'): Promise<ICustomFont> {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const lowerName = fileName.toLowerCase();
    const isItalic = lowerName.includes('italic');
    const isBlack = lowerName.includes('black') || lowerName.includes('heavy');
    const isBold = lowerName.includes('bold') || isBlack;
    const isMedium = lowerName.includes('medium') || lowerName.includes('semibold');
    const isThin = lowerName.includes('thin') || lowerName.includes('extralight');
    const isLight = lowerName.includes('light') || isThin;

    // Accurate CSS font-weight mapping: Thin (100/200), Light (300), Regular (400), Medium (500), Bold (700), Black (900)
    const fontWeight = isThin ? '100' : isLight ? '300' : isBlack ? '900' : isBold ? '700' : isMedium ? '500' : '400';
    const fontStyle = isItalic ? 'italic' : 'normal';

    // Normalize family name:
    // e.g. "Ganh Type - Thin.otf", "Ganh Type - Regular.otf" -> "Ganh Type"
    // e.g. "Bookerly Bold Italic.ttf" -> "Bookerly"
    const rawName = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_\s]*(display|lcd|regular|medium|bold|italic|semibold|black|heavy|light|thin|extralight)/gi, '')
      .replace(/[-_]+$/, '')
      .trim();
    const fontName = rawName || 'Custom Font';
    const id = `font-${fontName.toLowerCase()}-${fontWeight}-${fontStyle}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const customFont: ICustomFont = {
      id,
      name: fontName,
      fileName,
      fontData: base64Data,
      format,
      createdAt: Date.now(),
    };

    await db.transaction('rw', [db.customFonts, db.tombstones], async () => {
      await db.customFonts.put(customFont);
      await db.tombstones.delete(id);
    });

    const { R2StorageService } = await import('./r2StorageService');
    const { SupabaseSyncService } = await import('./supabaseSyncService');
    R2StorageService.uploadFont(customFont).catch(() => {});
    SupabaseSyncService.triggerAutoSync(15000);

    return customFont;
  }

  /**
   * Delete a custom font
   */
  static async deleteFont(id: string): Promise<void> {
    const { TombstoneService } = await import('./tombstoneService');
    await TombstoneService.recordTombstone(id, 'font');
    await db.customFonts.delete(id);
    const { R2StorageService } = await import('./r2StorageService');
    const { SupabaseSyncService } = await import('./supabaseSyncService');
    R2StorageService.deleteFont(id).catch(() => {});
    SupabaseSyncService.triggerAutoSync(15000);
  }

  /**
   * Generate @font-face CSS block for all stored custom fonts
   */
  static async generateFontFaceCSS(): Promise<string> {
    const fonts = await db.customFonts.toArray();
    if (!fonts.length) return '';

    return fonts
      .map((f) => {
        const formatStr = f.format === 'ttf' ? 'truetype' : f.format === 'otf' ? 'opentype' : f.format;
        const lower = f.fileName.toLowerCase();
        const isItalic = lower.includes('italic');
        const isBlack = lower.includes('black') || lower.includes('heavy');
        const isBold = lower.includes('bold') || isBlack;
        const isMedium = lower.includes('medium') || lower.includes('semibold');
        const isThin = lower.includes('thin') || lower.includes('extralight');
        const isLight = lower.includes('light') || isThin;

        const weight = isThin ? '100' : isLight ? '300' : isBlack ? '900' : isBold ? '700' : isMedium ? '500' : '400';
        const style = isItalic ? 'italic' : 'normal';

        return `
          @font-face {
            font-family: '${f.name}';
            src: url('${f.fontData}') format('${formatStr}');
            font-weight: ${weight};
            font-style: ${style};
            font-display: swap;
          }
        `;
      })
      .join('\n');
  }
}
