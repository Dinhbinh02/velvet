# ⚡ Giai Đoạn 5: Search Worker & Extension Superpowers

## 1. Mục Tiêu Giai Đoạn 5
* Xây dựng công cụ tìm kiếm toàn văn trong sách (**In-Book Full-Text Search**) chạy hoàn toàn trên **Web Worker** với thư viện **MiniSearch** (không bao giờ gây đơ UI).
* Tận dụng các đặc quyền của Chrome Extension Manifest V3:
  * **Link Interceptor**: Tự động phát hiện khi người dùng click vào link tải file `.epub` trên web, hiển thị tùy chọn *"Mở ngay trong Velvet"* thay vì tải về máy.
  * **Web-to-EPUB Context Menu**: Chuột phải vào trang web bất kỳ → *"Lưu bài viết vào Velvet"* (dùng Readability tạo sách EPUB ảo).
* **Export Hub**: Xuất dữ liệu highlight & ghi chú ra định dạng Markdown chuẩn Obsidian / Notion.
* **AI Copilot & Smart TTS Roadmap**: Chuẩn bị giao diện và module kết nối AI tóm tắt / hỏi đáp theo ngữ cảnh chương sách.

---

## 2. Chi Tiết Triển Khai Kỹ Thuật

### 2.1 MiniSearch In-Book Search Web Worker (`src/workers/search.worker.ts`)
```typescript
import MiniSearch from 'minisearch';

interface SearchDoc {
  id: string;          // Section index + Paragraph index
  cfi: string;
  chapterTitle: string;
  text: string;
}

let miniSearch: MiniSearch<SearchDoc> | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INDEX_BOOK') {
    const { sections } = payload;
    miniSearch = new MiniSearch<SearchDoc>({
      fields: ['text'],
      storeFields: ['cfi', 'chapterTitle', 'text'],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
      },
    });

    const docs: SearchDoc[] = [];
    for (const sec of sections) {
      // Tách từng đoạn văn bản và gán CFI tương ứng
      docs.push(...sec.paragraphs);
    }

    miniSearch.addAll(docs);
    self.postMessage({ type: 'INDEX_COMPLETE', count: docs.length });
  }

  if (type === 'SEARCH_QUERY') {
    const { query } = payload;
    if (!miniSearch) {
      self.postMessage({ type: 'SEARCH_RESULTS', results: [] });
      return;
    }

    const rawResults = miniSearch.search(query);
    // Trích xuất đoạn snippet ngữ cảnh chứa từ khóa
    const results = rawResults.slice(0, 50).map((r) => ({
      cfi: r.cfi,
      chapterTitle: r.chapterTitle,
      snippet: extractSnippet(r.text, query),
      score: r.score,
    }));

    self.postMessage({ type: 'SEARCH_RESULTS', results });
  }
};

function extractSnippet(text: string, query: string, maxLength = 120): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text.slice(0, maxLength) + '...';
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + query.length + 60);
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
}
```

---

### 2.2 Link Interceptor (Tự Động Bắt Link .epub)
Sử dụng `chrome.declarativeNetRequest` hoặc bắt sự kiện click link trong Content Script:
1. Khi phát hiện URL kết thúc bằng `.epub` hoặc Content-Type `application/epub+zip`:
2. Hiển thị Toast thông báo hoặc mở Tab Velvet Reader:
   ```typescript
   // Tải file ngầm dưới dạng Blob và import thẳng vào OPFS
   const response = await fetch(downloadUrl);
   const blob = await response.blob();
   const file = new File([blob], fileName, { type: 'application/epub+zip' });
   const bookId = await importNewBook(file, { title: fileName });
   chrome.tabs.create({ url: chrome.runtime.getURL(`reader/index.html?bookId=${bookId}`) });
   ```

---

### 2.3 Web-to-EPUB Context Menu
1. Khi người dùng click chuột phải chọn *"Lưu trang này vào Velvet"*:
2. Content script lấy HTML của trang hiện tại, sử dụng `@mozilla/readability` để lọc bỏ quảng cáo, giữ lại bài viết chính.
3. Đóng gói bài viết thành tệp EPUB ảo 1 chương, tạo ảnh bìa thumbnail từ Favicon/Meta image và lưu vào Velvet Library.

---

### 2.4 Markdown / Obsidian Export Hub
Hỗ trợ xuất toàn bộ trích dẫn của cuốn sách theo template Markdown cao cấp:

```markdown
# 📚 Ghi Chú Đọc Sách: {{book.title}}
**Tác giả:** {{book.author}}
**Ngày xuất:** {{exportDate}}
**Tổng số highlight:** {{highlights.length}}

---

## 📑 Mục Lục Ghi Chú

{% for h in highlights %}
### 📍 {{h.chapterTitle}}
> {{h.text}}

*Màu:* `{{h.color}}` | *CFI:* `{{h.cfiRange}}`
{% if h.note %}
> [!NOTE] Ghi chú của tôi
> {{h.note}}
{% endif %}

---
{% endfor %}
```

---

## 3. Tiêu Chuẩn Nghiệm Thu Giai Đoạn 5 (Acceptance Criteria)
* [ ] Tìm kiếm full-text trong cuốn sách 500 trang trả về kết quả dưới 50ms, không làm đơ thanh cuộn sách.
* [ ] Click vào kết quả tìm kiếm tự động nhảy đến đúng trang và nhấp nháy từ khóa.
* [ ] Xuất file `.md` mở trong Obsidian hiển thị đầy đủ callouts và trích dẫn chuẩn xác.
* [ ] Web-to-EPUB trích xuất bài báo sạch sẽ và lưu vào thư viện đọc ngay lập tức.
