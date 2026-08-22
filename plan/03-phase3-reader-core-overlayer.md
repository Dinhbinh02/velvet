# 📖 Giai Đoạn 3: Reader Core Engine & Overlayer Highlight

## 1. Mục Tiêu Giai Đoạn 3
* Tích hợp **Foliate-js** vào Velvet để tạo trình đọc EPUB chuẩn xác, ổn định và mượt mà 60/120fps.
* Triển khai hệ thống **EPUB-CFI (Canonical Fragment Identifier)**: Đảm bảo vị trí đọc luôn chuẩn xác đến từng ký tự khi thay đổi kích thước cửa sổ hoặc đổi font.
* Hiện thực hóa cơ chế **Overlayer.js**: Vẽ các dải highlight màu và gạch chân đè lên chữ mà không làm thay đổi hay làm hỏng cấu trúc DOM gốc của sách.
* Xây dựng **Floating Selection Toolbar**: Menu nổi bật lên ngay khi bôi đen đoạn văn bản để thực hiện các thao tác: Tô màu highlight (5 màu), Thêm ghi chú, Tra từ điển, Copy trích dẫn Markdown.

---

## 2. Chi Tiết Triển Khai Kỹ Thuật

### 2.1 Tích Hợp Foliate View Wrapper (`src/core/foliateViewer.ts`)
```typescript
import 'foliate-js/view.js';

export interface ViewerEvents {
  onRelocate?: (location: { cfi: string; percentage: number; sectionIndex: number; tocItem?: any }) => void;
  onSectionLoad?: (doc: Document, sectionIndex: number) => void;
  onSelection?: (selection: Selection, range: Range, cfiRange: string) => void;
}

export class FoliateViewerController {
  private viewElement: any;
  private container: HTMLElement;

  constructor(container: HTMLElement, events: ViewerEvents) {
    this.container = container;
    this.viewElement = document.createElement('foliate-view');
    this.container.appendChild(this.viewElement);

    // Lắng nghe sự kiện di chuyển trang / đổi vị trí
    this.viewElement.addEventListener('relocate', ({ detail }: any) => {
      events.onRelocate?.({
        cfi: detail.cfi,
        percentage: detail.fraction,
        sectionIndex: detail.index,
        tocItem: detail.tocItem,
      });
    });

    // Lắng nghe sự kiện nạp tài liệu chương mới
    this.viewElement.addEventListener('load', ({ detail }: any) => {
      events.onSectionLoad?.(detail.doc, detail.index);
    });
  }

  async openBook(file: File, initialCfi?: string) {
    await this.viewElement.open(file);
    if (initialCfi) {
      this.viewElement.goTo(initialCfi);
    }
  }

  nextPage() { this.viewElement.next(); }
  prevPage() { this.viewElement.prev(); }
  goToCFI(cfi: string) { this.viewElement.goTo(cfi); }
  
  getCfiFromRange(range: Range): string {
    return this.viewElement.getCFI(range);
  }

  async resolveCfiToRange(cfi: string): Promise<Range | null> {
    return await this.viewElement.resolveCFI(cfi);
  }
}
```

---

### 2.2 Kiến Trúc Highlight Overlayer (`src/services/highlightManager.ts`)
Sử dụng `Overlayer` của Foliate để vẽ các khối `div` màu trong một layer đồ họa riêng biệt:

```typescript
import { db, type IHighlight } from '../db/schema';
import { Overlayer } from 'foliate-js/overlayer.js';

export class HighlightManager {
  private bookId: string;
  private viewer: FoliateViewerController;
  private activeOverlayer: any = null;
  private onHighlightClick?: (highlight: IHighlight, event: MouseEvent) => void;

  constructor(bookId: string, viewer: FoliateViewerController, onHighlightClick?: (h: IHighlight, e: MouseEvent) => void) {
    this.bookId = bookId;
    this.viewer = viewer;
    this.onHighlightClick = onHighlightClick;
  }

  /**
   * Render toàn bộ highlight trong chapter hiện tại
   */
  async renderHighlights(doc: Document, sectionIndex: number): Promise<void> {
    const highlights = await db.highlights.where('bookId').equals(this.bookId).toArray();
    if (!highlights.length || !doc) return;

    if (this.activeOverlayer) {
      this.activeOverlayer.remove();
    }

    this.activeOverlayer = new Overlayer();
    doc.body.appendChild(this.activeOverlayer.element);

    for (const item of highlights) {
      try {
        const range = await this.viewer.resolveCfiToRange(item.cfiRange);
        if (!range || range.commonAncestorContainer.ownerDocument !== doc) continue;

        const drawRect = (rect: DOMRect) => {
          const el = doc.createElement('div');
          el.className = `velvet-highlight velvet-highlight-${item.color}`;
          el.dataset.highlightId = item.id;
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onHighlightClick?.(item, e);
          });
          return el;
        };

        this.activeOverlayer.add(item.id, range, drawRect);
      } catch (err) {
        // CFI thuộc section khác, bỏ qua an toàn
      }
    }
  }

  /**
   * Tạo highlight mới khi người dùng click chọn màu trên floating toolbar
   */
  async addHighlight(
    range: Range,
    color: IHighlight['color'],
    note?: string,
    chapterTitle?: string
  ): Promise<IHighlight> {
    const cfiRange = this.viewer.getCfiFromRange(range);
    const text = range.toString().trim();

    const record: IHighlight = {
      id: crypto.randomUUID(),
      bookId: this.bookId,
      cfiRange,
      text,
      color,
      note,
      chapterTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.highlights.add(record);
    
    // Re-render ngay lập tức
    const doc = range.commonAncestorContainer.ownerDocument || document;
    await this.renderHighlights(doc, 0);

    return record;
  }

  async deleteHighlight(id: string, doc: Document) {
    await db.highlights.delete(id);
    if (this.activeOverlayer) {
      this.activeOverlayer.remove(id);
    }
  }
}
```

---

### 2.3 Floating Selection Toolbar & Styling
Khi `mouseup` trong iframe sách và có `selection`:
1. Tính toán vị trí Popup:
   ```typescript
   const rect = range.getBoundingClientRect();
   const toolbarX = rect.left + rect.width / 2;
   const toolbarY = rect.top - 10; // Đặt cách phía trên 10px
   ```
2. Giao diện Toolbar gồm:
   * **5 nút tròn chọn màu**: Yellow (`#FEF08A`), Green (`#BBF7D0`), Blue (`#BFDBFE`), Purple (`#E9D5FF`), Pink (`#FBCFE8`).
   * **Nút Gạch chân (Underline)**.
   * **Nút Note**: Mở modal nhập markdown comment.
   * **Nút Tra từ / Dịch**: Popup từ điển nhanh.
   * **Nút Copy Trích Dẫn**: `> [Text] \n\n— *[Book Title]*, [Author]`.

---

## 3. Tiêu Chuẩn Nghiệm Thu Giai Đoạn 3 (Acceptance Criteria)
* [ ] Lật trang mượt mà bằng phím mũi tên `←` / `→` hoặc click chuột hai bên lề.
* [ ] Vị trí đọc được lưu vào `db.progress` bằng debounce 300ms, mở lại sách nhảy đúng vị trí cũ 100%.
* [ ] Tô highlight không làm đơ trang, hỗ trợ cả đoạn văn trải dài qua nhiều phần tử HTML.
* [ ] Khi thay đổi kích thước cửa sổ trình duyệt (Resize), các dải highlight tự động vẽ lại đúng vị trí của từ ngữ.
