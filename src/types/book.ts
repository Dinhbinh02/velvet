export interface IBook {
  id: string;             // UUID v4
  title: string;
  author: string;
  description?: string;
  coverImage?: Blob;      // Compressed cover image < 500KB stored in IndexedDB
  opfsPath: string;       // Path in OPFS: books/{id}.epub
  fileSize: number;       // Bytes
  fileHash?: string;      // SHA-256 Content Hash for Global Cloud Deduplication
  format: 'epub';
  totalChapters?: number;
  wordCount?: number;
  addedAt: number;        // Timestamp
  lastReadAt: number;     // Timestamp for sorting recently read books
  isFinished: boolean;
}

export interface IProgress {
  bookId: string;         // Primary key: 1:1 with IBook
  cfi: string;            // EPUB-CFI location string
  percentage: number;     // 0.0 -> 1.0 (0% - 100%)
  sectionIndex: number;   // Section index in spine
  sectionFraction?: number; // 0.0 -> 1.0 fraction within the current section (fallback when CFI is stale)
  textAnchor?: string;    // First 50-80 chars of text currently at top of viewport (exact sentence positioning)
  chapterTitle?: string;
  updatedAt: number;
}

export interface INote {
  id: string;             // UUID v4
  bookId: string;         // Foreign key
  content: string;        // Markdown content
  chapterTitle?: string;  // Chapter context
  createdAt: number;
  updatedAt: number;
}

export interface IHighlight {
  id: string;             // UUID v4
  bookId: string;         // Foreign key
  text: string;           // Highlighted text
  color: string;          // Color hex
  comment?: string;       // Attached user comment/annotation
  chapterTitle?: string;  // Chapter context
  cfi?: string;
  createdAt: number;
}

export interface IHeaderSummary {
  header: string;
  summary: string;
  keyPoints: string[];
}

export interface IChapterSummary {
  id: string;             // bookId + '_' + targetHref (or unique ID)
  bookId: string;         // Foreign key
  href: string;           // Target section href or cfi
  chapterTitle: string;   // Chapter label/title
  summaries: IHeaderSummary[];
  createdAt: number;
  updatedAt: number;
}

export interface IComment {
  id: string;             // UUID v4
  bookId: string;         // Foreign key
  highlightId?: string;   // Optional reference to highlight
  selectedText: string;   // Quoted/annotated text
  comment: string;        // User note/thought
  chapterTitle?: string;  // Chapter context
  createdAt: number;
  updatedAt: number;
}

export interface ITTSSettings {
  provider: 'google';
  voice: string;          // e.g. 'vi', 'en', 'en-uk', 'ja'
  rate: number;           // 0.75 -> 2.0 (default 1.0)
  pitch: number;          // 0.8 -> 1.2 (default 1.0)
  autoScroll: boolean;
  quickReadShortcut?: string; // e.g. 'Alt+S' or 'Meta+Shift+S' or 'KeyS' (default 'Alt+S')
}

export interface IReaderSettings {
  id: string;             // 'global-settings'
  theme: 'light' | 'dark' | 'sepia' | 'amoled' | 'nord' | 'paper';
  fontFamily: string;
  fontSize: number;       // px (e.g. 18)
  lineHeight: number;     // (e.g. 1.6)
  paragraphSpacing: number; // rem (e.g. 1.0)
  maxWidth: number;       // px or % (e.g. 760)
  textAlign: 'left' | 'justify';
  layoutMode: 'paginated-1col' | 'paginated-2col' | 'continuous';
  prevPageShortcut?: string; // default 'ArrowLeft'
  nextPageShortcut?: string; // default 'ArrowRight'
  geminiApiKey?: string;     // Comma-separated Gemini API keys
  highlightColor?: string;   // Highlight hex/rgb or preset name (default '#fef08a' yellow)
  highlightShortcut?: string; // default 'h' or 'KeyH'
  ttsSettings?: ITTSSettings;
  customAvatar?: string;      // URL or base64 of hero avatar (GIF/image)
  updatedAt?: number;         // Epoch timestamp of last update
}

export interface IReadingSession {
  id: string;
  bookId: string;
  startTime: number;
  durationSeconds: number;
}

export interface ICustomFont {
  id: string;             // UUID or sanitized font name
  name: string;           // Display name (e.g. 'Literata', 'Lexend')
  fileName: string;       // Original file name
  fontData?: string;      // Base64 data URL (e.g. 'data:font/woff2;base64,...')
  format: 'woff2' | 'woff' | 'ttf' | 'otf';
  createdAt: number;
}
