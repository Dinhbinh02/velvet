# 🚀 Giai Đoạn 1: Scaffolding & Manifest V3 Architecture

## 1. Mục Tiêu Giai Đoạn 1
* Khởi tạo dự án `Velvet` với **WXT** (Vite + React 19 + TypeScript + Tailwind CSS).
* Cấu hình hoàn chỉnh `wxt.config.ts` để khai báo các permissions Manifest V3 cần thiết.
* Thiết lập 4 entrypoints độc lập hoạt động trơn tru:
  1. **Background Service Worker (`entrypoints/background.ts`)**.
  2. **Full Tab Reader (`entrypoints/reader/`)**.
  3. **Side Panel Reader (`entrypoints/sidepanel/`)**.
  4. **Popup Quick Shelf (`entrypoints/popup/`)**.
* Cài đặt bộ icon Velvet và thiết lập Design System Tokens cơ bản (Tailwind palette, Glassmorphism, CSS variables).

---

## 2. Chi Tiết Triển Khai Kỹ Thuật

### 2.1 Cấu Hình WXT (`wxt.config.ts`)
```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Velvet - Super EPUB Reader',
    description: 'Trình đọc sách EPUB mượt mà, cao cấp dành cho Chrome.',
    version: '1.0.0',
    permissions: [
      'storage',
      'unlimitedStorage',
      'sidePanel',
      'contextMenus',
      'declarativeNetRequest'
    ],
    side_panel: {
      default_path: 'sidepanel/index.html'
    },
    action: {
      default_title: 'Mở Velvet Shelf',
      default_popup: 'popup/index.html'
    },
    web_accessible_resources: [
      {
        resources: [
          'book-content.css',
          'fonts/*',
          'workers/*'
        ],
        matches: ['<all_urls>']
      }
    ]
  }
});
```

### 2.2 Background Service Worker Lifecycle (`entrypoints/background.ts`)
Service Worker đóng vai trò trung tâm điều hướng:
1. **Lắng nghe click Action Icon (nếu muốn mở Tab thay vì Popup)** hoặc mở từ Context Menu.
2. **Quản lý trạng thái Side Panel**: Cho phép mở Side Panel khi đang lướt web và muốn đọc tài liệu song song.
3. **Link Interception Setup**: Khởi tạo rules để bắt các link tải file `.epub`.

```typescript
export default defineBackground(() => {
  // 1. Khởi tạo Context Menu khi cài đặt extension
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'velvet-open-reader',
      title: 'Mở Velvet EPUB Reader',
      contexts: ['action']
    });

    chrome.contextMenus.create({
      id: 'velvet-open-sidepanel',
      title: 'Mở Velvet trên Side Panel',
      contexts: ['action']
    });
  });

  // 2. Xử lý click Context Menu
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'velvet-open-reader') {
      chrome.tabs.create({ url: chrome.runtime.getURL('reader/index.html') });
    } else if (info.menuItemId === 'velvet-open-sidepanel' && tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId });
    }
  });
});
```

### 2.3 Thiết Lập Entrypoints
* **`entrypoints/reader/index.html`**: Trang đọc toàn màn hình với viewport 100vw/100vh, tối ưu cho chế độ đọc dài.
* **`entrypoints/sidepanel/index.html`**: Giao diện co giãn đáp ứng linh hoạt từ 320px đến 600px width.
* **`entrypoints/popup/index.html`**: Kích thước 380px x 520px hiển thị nhanh bìa sách đang đọc dở và nút "Đọc tiếp".

---

## 3. Danh Sách Package Cần Cài Đặt
```bash
# Core framework & build tools
npm install -D wxt @wxt-dev/module-react typescript @types/react @types/react-dom

# UI & Styling
npm install react react-dom lucide-react clsx tailwind-merge tailwindcss @tailwindcss/vite

# Data & Storage
npm install dexie dexie-react-hooks

# Reader & Search Engine
npm install foliate-js minisearch
```

---

## 4. Tiêu Chuẩn Nghiệm Thu Giai Đoạn 1 (Acceptance Criteria)
* [ ] Lệnh `npm run dev` chạy không lỗi, HMR hoạt động trên Chrome.
* [ ] Mở được trang Full Tab Reader tại `chrome-extension://<id>/reader/index.html`.
* [ ] Mở được Side Panel của extension trên bất kỳ tab nào của trình duyệt.
* [ ] Popup hiển thị đúng kích thước, không giật vỡ layout.
* [ ] Cấu hình Tailwind CSS và font typography sẵn sàng.
