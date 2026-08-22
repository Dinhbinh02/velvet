# 🏛️ Velvet - Master Architecture Document

## 1. Mục Tiêu Dự Án
**Velvet** là một Chrome Extension cao cấp (Manifest V3) chuyên phục vụ việc đọc sách điện tử định dạng EPUB 2/3 với trải nghiệm mượt mà 60/120fps, typography tinh xảo, quản lý dữ liệu offline bảo mật và tích hợp sâu vào hệ sinh thái trình duyệt Chrome.

---

## 2. Kiến Trúc Tổng Thể Hệ Thống (System Architecture)

```mermaid
graph TB
    subgraph "Chrome Extension Environment (Manifest V3)"
        SW[Background Service Worker<br/>entrypoints/background.ts]
        CM[Context Menu & Link Interceptor]
        SP[Chrome Side Panel UI<br/>entrypoints/sidepanel/]
        TR[Full Tab Reader UI<br/>entrypoints/reader/]
        PO[Quick Shelf Popup<br/>entrypoints/popup/]
    end

    subgraph "Velvet UI Shell (React 19 + Tailwind CSS + Lucide)"
        Shelf[Thư Viện Sách 3D]
        ReaderShell[Khung Điều Khiển Trình Đọc]
        Sidebar[TOC & Ghi Chú Drawer]
        TypePanel[Typography & Theme Panel]
        SelectMenu[Floating Selection Toolbar]
    end

    subgraph "Core Reader Engine"
        Foliate[Foliate-js View / Renderer]
        Overlayer[Overlayer.js Multi-color Highlight Engine]
        CFIResolver[EPUB-CFI Generator & Parser]
    end

    subgraph "Background Processing (Web Worker Thread)"
        Worker[MiniSearch / Parsing Web Worker]
        Index[(Full-Text In-memory Search Index)]
    end

    subgraph "Storage Subsystem (Sandboxed)"
        OPFS[(OPFS - Origin Private File System<br/>books/{id}.epub)]
        DexieDB[(Dexie.js IndexedDB<br/>books, progress, highlights, bookmarks, settings)]
    end

    SW -->|Mở Tab Đọc Sách| TR
    SW -->|Mở Side Panel| SP
    CM -->|Gửi link EPUB / Web Article| SW

    TR --> ReaderShell
    SP --> ReaderShell
    PO --> Shelf

    ReaderShell --> Foliate
    Foliate --> Overlayer
    Foliate --> CFIResolver

    ReaderShell <--> DexieDB
    Foliate <--> OPFS
    Overlayer <--> DexieDB

    ReaderShell --> Worker
    Worker --> Index
```

---

## 3. Tech Stack Tuyển Chọn Chuẩn Production

| Thành phần | Công nghệ lựa chọn | Lý do tuyển chọn |
| :--- | :--- | :--- |
| **Extension Framework** | **WXT (Next-gen Web Extension)** | Tối ưu Manifest V3, HMR cực nhanh với Vite, tự động sinh entrypoints, type-safe messaging. |
| **UI Framework** | **React 19 + TypeScript** | Hệ sinh thái linh hoạt, hiệu năng Virtual DOM cao, tái sử dụng component tối đa giữa Tab Reader và Side Panel. |
| **Styling & Icons** | **Tailwind CSS + Lucide React** | Class-based CSS tối ưu bundle, thiết kế giao diện sang trọng Velvet Dark/Sepia/AMOLED, icon sắc nét. |
| **Reader Engine** | **Foliate-js Core (foliate-js)** | Engine đọc EPUB mượt mà nhất hiện nay, phân trang không giật, hỗ trợ đầy đủ EPUB 2/3, MathML, SVG, overlayer.js. |
| **File Storage** | **OPFS (Origin Private File System)** | Đọc/ghi stream file nhị phân trực tiếp không làm tràn RAM, vượt trội hơn nhiều so với lưu Base64 vào IndexedDB. |
| **Relational Data** | **Dexie.js (IndexedDB)** | Schema migration an toàn, truy vấn chỉ mục nhanh, hỗ trợ transaction và Reactive live queries. |
| **Full-Text Search** | **MiniSearch (Web Worker)** | Index siêu nhanh, hỗ trợ fuzzy search, tìm kiếm tiền tố và phân trang kết quả mà không làm đơ main UI. |
| **Typography & Fonts** | **Local Fonts + Google Webfonts** | Bookerly, Literata, Merriweather, Inter, Atkinson Hyperlegible. |

---

## 4. Manifest V3 Permissions & Security Model

```json
{
  "manifest_version": 3,
  "name": "Velvet - Super EPUB Reader",
  "permissions": [
    "storage",
    "unlimitedStorage",
    "sidePanel",
    "contextMenus",
    "declarativeNetRequest"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
```

---

## 5. Quy Chuẩn Cấu Trúc Thư Mục Toàn Dự Án

```
Velvet/
├── plan/                              # Kế hoạch chi tiết từng giai đoạn
├── entrypoints/                       # Các điểm vào của Chrome Extension
│   ├── background.ts                  # Service Worker chính
│   ├── popup/                         # Giao diện icon popup thanh công cụ
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── PopupApp.tsx
│   ├── reader/                        # Trình đọc toàn màn hình (Full Tab View)
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── ReaderApp.tsx
│   └── sidepanel/                     # Trình đọc trên thanh bên (Side Panel View)
│       ├── index.html
│       ├── main.tsx
│       └── SidePanelApp.tsx
├── src/
│   ├── components/                    # React UI Components
│   │   ├── common/                    # Button, Slider, Modal, Tooltip, Switch
│   │   ├── shelf/                     # Thư viện sách, BookCard, Filter, ImportZone
│   │   ├── reader/                    # Viewer shell, Navigation, Progress bar
│   │   ├── selection/                 # Floating Selection Toolbar, Quick Color Picker
│   │   ├── sidebar/                   # TOC Tree, Annotations List, Bookmarks
│   │   └── settings/                  # Typography Drawer, Theme Customizer
│   ├── core/                          # Foliate-js Reader Engine & Overlayer
│   │   ├── foliate-view.ts            # Wrapper kết nối DOM và foliate-js
│   │   ├── overlayer.ts               # Bộ vẽ Highlight dải màu
│   │   └── cfi.ts                     # Parser và Converter EPUB-CFI
│   ├── db/                            # Dexie.js Schema và Repositories
│   │   ├── schema.ts                  # Định nghĩa bảng và index
│   │   └── database.ts                # Instance và helper methods
│   ├── services/                      # Nghiệp vụ
│   │   ├── opfsStorage.ts             # Quản lý đọc ghi file nhị phân OPFS
│   │   ├── epubParser.ts              # Trích xuất Metadata, Cover Blob, Spines
│   │   ├── highlightService.ts        # CRUD highlight và notes
│   │   ├── searchClient.ts            # Giao tiếp với Search Web Worker
│   │   └── exportService.ts           # Xuất ghi chú ra Markdown / Obsidian
│   ├── workers/                       # Web Workers
│   │   └── search.worker.ts           # MiniSearch indexing & querying
│   ├── styles/                        # CSS toàn cục & Theme tokens
│   │   ├── tailwind.css               # Base Tailwind styles
│   │   ├── themes.css                 # Biến CSS (Light, Dark, Sepia, AMOLED...)
│   │   └── book-content.css           # CSS tiêm vào iframe sách
│   ├── hooks/                         # Custom React Hooks
│   │   ├── useBooks.ts
│   │   ├── useReadingProgress.ts
│   │   ├── useHighlights.ts
│   │   └── useReaderSettings.ts
│   └── types/                         # TypeScript Type Definitions
│       ├── book.ts
│       ├── reader.ts
│       ├── highlight.ts
│       └── settings.ts
├── wxt.config.ts                      # Cấu hình WXT & Manifest
├── package.json
├── tsconfig.json
└── tailwind.config.js
```
