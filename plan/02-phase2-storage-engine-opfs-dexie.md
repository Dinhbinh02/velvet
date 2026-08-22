# 💾 Giai Đoạn 2: Storage Engine (OPFS & Dexie.js)

## 1. Mục Tiêu Giai Đoạn 2
* Xây dựng kiến trúc lưu trữ 2 tầng (2-Tier Storage Architecture) cho Velvet:
  * **Tầng 1 (Binary Storage - OPFS)**: Lưu trữ file nhị phân `.epub` lớn trực tiếp trên hệ thống tệp ảo của trình duyệt, stream dữ liệu mượt mà, không giới hạn bởi hạn ngạch IndexedDB.
  * **Tầng 2 (Relational Metadata - Dexie.js)**: Lưu thông tin sách, mục lục, tiến độ đọc (CFI), danh sách highlight, bookmark và cấu hình cá nhân hóa.
* Xây dựng module trích xuất tự động Metadata và Bìa sách (Cover Image) khi người dùng kéo thả file `.epub` vào extension.

---

## 2. Chi Tiết Triển Khai Kỹ Thuật

### 2.1 Dexie.js Database Schema (`src/db/schema.ts`)
```typescript
import Dexie, { type Table } from 'dexie';

export interface IBook {
  id: string;             // UUID v4
  title: string;
  author: string;
  description?: string;
  coverImage?: Blob;      // Ảnh bìa đã nén < 500KB lưu trực tiếp trong IndexedDB
  opfsPath: string;       // Đường dẫn trong OPFS: books/{id}.epub
  fileSize: number;       // Bytes
  format: 'epub';
  totalChapters?: number;
  wordCount?: number;
  addedAt: number;        // Timestamp
  lastReadAt: number;     // Timestamp để sắp xếp sách gần đây
  isFinished: boolean;
}

export interface IProgress {
  bookId: string;         // Khóa chính: 1:1 với IBook
  cfi: string;            // EPUB-CFI chính xác
  percentage: number;     // 0.0 -> 1.0 (0% - 100%)
  sectionIndex: number;   // Thứ tự file section trong spine
  chapterTitle?: string;
  updatedAt: number;
}

export interface IHighlight {
  id: string;             // UUID v4
  bookId: string;         // Khóa ngoại
  cfiRange: string;       // Chuỗi CFI Range biểu diễn khoảng bôi đen
  text: string;           // Văn bản được trích xuất
  color: 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'underline';
  note?: string;          // Ghi chú đính kèm
  chapterTitle?: string;
  createdAt: number;
  updatedAt: number;
}

export interface IBookmark {
  id: string;
  bookId: string;
  cfi: string;
  title: string;
  chapterTitle?: string;
  createdAt: number;
}

export interface IReaderSettings {
  id: string;             // 'global-settings'
  theme: 'light' | 'dark' | 'sepia' | 'amoled' | 'nord' | 'paper';
  fontFamily: string;
  fontSize: number;       // px (vd: 18)
  lineHeight: number;     // (vd: 1.6)
  paragraphSpacing: number; // rem (vd: 1.0)
  maxWidth: number;       // px hoặc % (vd: 800)
  textAlign: 'left' | 'justify';
  layoutMode: 'paginated-1col' | 'paginated-2col' | 'continuous';
}

export class VelvetDatabase extends Dexie {
  books!: Table<IBook, string>;
  progress!: Table<IProgress, string>;
  highlights!: Table<IHighlight, string>;
  bookmarks!: Table<IBookmark, string>;
  settings!: Table<IReaderSettings, string>;

  constructor() {
    super('VelvetEpubDB');
    this.version(1).stores({
      books: '&id, title, author, lastReadAt, addedAt, isFinished',
      progress: '&bookId, updatedAt',
      highlights: '&id, bookId, color, createdAt, [bookId+createdAt]',
      bookmarks: '&id, bookId, createdAt, [bookId+createdAt]',
      settings: '&id',
    });
  }
}

export const db = new VelvetDatabase();
```

---

### 2.2 Module Quản Lý File Nhị Phân OPFS (`src/services/opfsStorage.ts`)
```typescript
const BOOKS_DIR = 'books';

export class OPFSStorageService {
  private static async getBooksDir(): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(BOOKS_DIR, { create: true });
  }

  static async saveBook(bookId: string, fileData: Blob | ArrayBuffer): Promise<string> {
    const dir = await this.getBooksDir();
    const fileName = `${bookId}.epub`;
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    
    // Ghi stream trực tiếp xuống ổ đĩa ảo
    const writable = await fileHandle.createWritable();
    await writable.write(fileData);
    await writable.close();

    return `${BOOKS_DIR}/${fileName}`;
  }

  static async getBookFile(bookId: string): Promise<File> {
    const dir = await this.getBooksDir();
    const fileName = `${bookId}.epub`;
    const fileHandle = await dir.getFileHandle(fileName, { create: false });
    return await fileHandle.getFile();
  }

  static async deleteBook(bookId: string): Promise<void> {
    try {
      const dir = await this.getBooksDir();
      await dir.removeEntry(`${bookId}.epub`);
    } catch (e) {
      console.warn(`Lỗi khi xóa file OPFS: ${bookId}`, e);
    }
  }

  static async getStorageStats(): Promise<{ usedMB: number; quotaMB: number }> {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return {
        usedMB: Math.round((usage / (1024 * 1024)) * 100) / 100,
        quotaMB: Math.round((quota / (1024 * 1024)) * 100) / 100,
      };
    }
    return { usedMB: 0, quotaMB: 0 };
  }
}
```

---

### 2.3 EPUB Parser & Import Workflow (`src/services/bookService.ts`)
1. **Import Luồng**:
   * Nhận `File` từ input kéo thả.
   * Tạo `bookId = crypto.randomUUID()`.
   * Sử dụng parser của Foliate (`foliate-js/epub.js`) để đọc metadata (Tiêu đề, Tác giả, Bìa ảnh Cover Blob).
   * Lưu file vào OPFS (`OPFSStorageService.saveBook`).
   * Lưu thông tin vào Dexie `db.books` và tạo tiến độ mặc định ở `db.progress`.
2. **Delete Luồng**:
   * Xóa file OPFS.
   * Xóa toàn bộ bản ghi liên quan trong Dexie (`books`, `progress`, `highlights`, `bookmarks`) trong 1 `db.transaction`.

---

## 3. Tiêu Chuẩn Nghiệm Thu Giai Đoạn 2 (Acceptance Criteria)
* [ ] Nhập file EPUB 10MB - 100MB không bị nghẽn giao diện hoặc crash bộ nhớ RAM.
* [ ] Metadata (Tiêu đề, Tác giả) và ảnh bìa được trích xuất chính xác 100%.
* [ ] File được lưu vào OPFS và đọc lại thành công dưới dạng `File` object.
* [ ] Thao tác Xóa sách dọn sạch cả file trong OPFS lẫn các bảng dữ liệu trong Dexie.
