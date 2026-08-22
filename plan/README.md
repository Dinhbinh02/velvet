# 📖 Velvet - Master Engineering Plan

Kế hoạch kỹ thuật chi tiết theo từng giai đoạn cho **Velvet - Super EPUB Reader Chrome Extension (Manifest V3)**.

---

## 🗺️ Bản Đồ Các Giai Đoạn Phát Triển

| Phase | Tài liệu chi tiết | Trọng tâm kỹ thuật | Trạng thái |
| :--- | :--- | :--- | :--- |
| **Phase 1** | [`01-phase1-scaffolding-architecture.md`](01-phase1-scaffolding-architecture.md) | WXT, React 19, TS, Tailwind CSS v4, Multi-Entrypoints (Tab, SidePanel, Popup, BG) | ✅ Hoàn thành |
| **Phase 2** | [`02-phase2-storage-engine-opfs-dexie.md`](02-phase2-storage-engine-opfs-dexie.md) | 2-Tier Storage (OPFS binary stream + Dexie.js metadata DB), EPUB Parser | ✅ Hoàn thành |
| **Phase 3** | [`03-phase3-reader-core-overlayer.md`](03-phase3-reader-core-overlayer.md) | Foliate-js Core Engine, EPUB-CFI Persistence, Overlayer Highlights, Floating Toolbar | ✅ Hoàn thành |
| **Phase 4** | [`04-phase4-ui-shell-themes-typography.md`](04-phase4-ui-shell-themes-typography.md) | Apple Books UI Shell, 6 Theme Solid Colors, Typography Sliders, TOC/Bookmarks Hub | ✅ Hoàn thành |
| **Phase 5** | [`05-phase5-search-worker-extension-superpowers.md`](05-phase5-search-worker-extension-superpowers.md) | In-Book Full-Text Search, Markdown/Obsidian Export, Web-to-EPUB Context Menu | ✅ Hoàn thành |
| **Phase 6** | [`06-phase6-online-book-discovery-opds.md`](06-phase6-online-book-discovery-opds.md) | Kho sách trực tuyến Standard Ebooks, Project Gutenberg, Open Library + OPDS Feeds | 🚀 Sẵn sàng |
| **Phase 7** | [`07-phase7-text-to-speech-ai-voice.md`](07-phase7-text-to-speech-ai-voice.md) | Trợ lý đọc sách TTS rảnh tay, Smart Word Sync Highlight, Sleep Timer | 🚀 Sẵn sàng |
| **Phase 8** | [`08-phase8-ai-reading-assistant.md`](08-phase8-ai-reading-assistant.md) | AI Reading Co-Pilot (Chrome Local AI / Cloud API), Tóm tắt chương, Dịch ngữ cảnh | 🚀 Sẵn sàng |
| **Phase 9** | [`09-phase9-cloud-sync-backup.md`](09-phase9-cloud-sync-backup.md) | Cloud Sync (Google Drive, WebDAV), Notion Webhook Bridge, 1-Click Backup | 🚀 Sẵn sàng |

---

## 📐 Nguyên Tắc Phát Triển
1. **Kiến Trúc Chuẩn MV3:** Tuân thủ 100% Manifest V3, tối ưu Service Worker, lưu trữ dữ liệu an toàn trong Origin Private File System (OPFS).
2. **Thẩm Mỹ Apple Books:** Thiết kế sang trọng, tối giản, màu sắc solid trung tính, không sử dụng gradient sặc sỡ.
3. **Mượt Mà & Phản Ứng Tức Thì:** 60/120fps lật trang, debounce lưu tiến độ, tìm kiếm và tải sách theo luồng stream.
