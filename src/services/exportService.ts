import type { IBook, INote, IComment, IHighlight } from '@/src/types/book';

export class ExportService {
  /**
   * Export all Notes, Comments, and Highlights to Markdown / Obsidian format
   */
  static generateMarkdown(
    book: IBook,
    notes: INote[],
    comments: IComment[] = [],
    highlights: IHighlight[] = []
  ): string {
    const lines: string[] = [];

    // Frontmatter Obsidian YAML
    lines.push('---');
    lines.push(`title: "${book.title.replace(/"/g, '\\"')}"`);
    lines.push(`author: "${book.author.replace(/"/g, '\\"')}"`);
    lines.push(`total_notes: ${notes.length}`);
    lines.push(`total_comments: ${comments.length}`);
    lines.push(`total_highlights: ${highlights.length}`);
    lines.push(`exported_at: "${new Date().toISOString()}"`);
    lines.push('tags:');
    lines.push('  - velvet-reader');
    lines.push('  - book-notes');
    lines.push('---');
    lines.push('');

    // Heading
    lines.push(`# 📖 ${book.title}`);
    lines.push(`**Author:** ${book.author}`);
    lines.push(`**Export Date:** ${new Date().toLocaleDateString('en-US')}`);
    lines.push('');

    // Notes Section
    lines.push('## 📝 Notes');
    lines.push('');

    if (notes.length === 0) {
      lines.push('*No notes recorded for this book.*');
      lines.push('');
    } else {
      notes.forEach((n, index) => {
        lines.push(`### Note #${index + 1}${n.chapterTitle ? ` — *${n.chapterTitle}*` : ''}`);
        lines.push(n.content);
        lines.push('');
        lines.push(`*Created: ${new Date(n.createdAt).toLocaleString('en-US')}*`);
        lines.push('');
      });
    }

    // Comments Section
    if (comments.length > 0) {
      lines.push('## 💬 Comments & Annotations');
      lines.push('');
      comments.forEach((c, index) => {
        lines.push(`### Comment #${index + 1}${c.chapterTitle ? ` — *${c.chapterTitle}*` : ''}`);
        lines.push(`> "${c.selectedText}"`);
        lines.push('');
        lines.push(c.comment);
        lines.push('');
        lines.push(`*Date: ${new Date(c.createdAt).toLocaleString('en-US')}*`);
        lines.push('');
      });
    }

    // Highlights Section
    if (highlights.length > 0) {
      lines.push('## 🖍️ Highlights');
      lines.push('');
      highlights.forEach((h) => {
        lines.push(`- "${h.text}"`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Triggers a browser download of the generated Markdown file
   */
  static downloadMarkdownFile(
    book: IBook,
    notes: INote[],
    comments: IComment[] = [],
    highlights: IHighlight[] = []
  ): void {
    const mdContent = this.generateMarkdown(book, notes, comments, highlights);
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const safeTitle = book.title
      .replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    const fileName = `${safeTitle || 'book'}-notes.md`;

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
