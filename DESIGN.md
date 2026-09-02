---
name: Velvet EPUB - Modern Sidebar Edition
colors:
  primary: "#0071E3"
  primary-hover: "#0077ED"
  secondary: "#86868B"
  accent: "#FF9500"
  neutral-bg-dark: "#141416"
  neutral-bg-amoled: "#000000"
  neutral-bg-sepia: "#FBF0D9"
  neutral-bg-light: "#F6F6F8"
  neutral-text-dark: "#F5F5F7"
  neutral-text-sepia: "#3B2F1D"
  neutral-text-light: "#1D1D1F"
  surface-dark: "#1C1C1E"
  surface-light: "#FFFFFF"
  sidebar-dark: "#18181A"
  sidebar-light: "#FFFFFF"
  border-dark: "#2C2C2E"
  border-light: "#E5E5EA"
  highlight-yellow: "#FFD60A"
  highlight-green: "#30D158"
  highlight-blue: "#0A84FF"
  highlight-purple: "#BF5AF2"
  highlight-pink: "#FF375F"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif"
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1.2
  headline-md:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
  body-book:
    fontFamily: "Bookerly, Georgia, 'New York', serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.65
  label-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  sidebar-item:
    rounded: "{rounded.md}"
    padding: 8px 12px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 8px 16px
---

# Velvet - Modern Sidebar-First Design Specification

## 1. Overview & Philosophy
Loại bỏ hoàn toàn Top Header cố định để tối ưu không gian đọc và quản lý thư viện. Thay thế bằng **Sidebar điều hướng hiện đại (Modern Sidebar Navigation)** theo phong cách Linear / Apple Books macOS:
- **Solid Colors**: Tuyệt đối không dùng gradient sặc sỡ, chỉ sử dụng màu solid tinh tế, các mảng khối rõ ràng.
- **Tối giản & Hiện đại (Minimal & Clean)**: Đường viền 1px chuẩn xác, typography sắc nét, viền bo tròn tự nhiên (`rounded-xl` / `rounded-2xl`).
- **Sidebar thông minh**:
  - Tích hợp điều hướng thư viện (Library, Reading Now, Discover).
  - Tích hợp nhanh công cụ đọc sách khi ở chế độ Reader (TOC, Key Insights, Search, TTS, Ambient Sounds, Typography).
  - Khả năng thu gọn (Collapse) hoặc mở rộng linh hoạt.

## 2. Color System (Solid Only - No Gradients)
- **Light Theme**:
  - App Background: `#F6F6F8`
  - Sidebar: `#FFFFFF`
  - Cards & Modals: `#FFFFFF`
  - Border: `#E5E5EA`
  - Primary Text: `#1D1D1F`
  - Secondary Text: `#86868B`
  - Accent / Primary: `#0071E3`
- **Dark Theme**:
  - App Background: `#141416`
  - Sidebar: `#18181A`
  - Cards & Modals: `#1C1C1E`
  - Border: `#2C2C2E`
  - Primary Text: `#F5F5F7`
  - Secondary Text: `#8E8E93`
  - Accent / Primary: `#0A84FF`
- **Sepia Theme**:
  - App Background: `#F5ECD6`
  - Sidebar: `#FBF0D9`
  - Text: `#3B2F1D`
  - Border: `#E5D5BA`
- **AMOLED Theme**:
  - App Background: `#000000`
  - Sidebar: `#0D0D0E`
  - Text: `#FFFFFF`
  - Border: `#1F1F1F`

## 3. Layout Architecture
- **Sidebar (Trái, 240px desktop / Drawer mobile)**:
  - Header: Logo Velvet + Tên ứng dụng + Nút thu gọn.
  - Section 1 (Khám phá & Thư viện): Thư viện sách, Đang đọc dở, Khám phá sách hay.
  - Section 2 (Công cụ Reader - khi mở sách): Mục lục & Ghi chú, Key Insights AI, Tìm kiếm, Đọc sách bằng giọng nói (TTS), Âm thanh môi trường (Ambient).
  - Section 3 (Dưới cùng): Cài đặt phông chữ/giao diện, Đồng bộ Cloud Sync, Hồ sơ tài khoản, Cài PWA.
- **Main Canvas (Phải)**:
  - Tràn viền 100%, không bị thanh header che chắn.
  - Chế độ Thư viện (Shelf): Toolbar tìm kiếm/bộ lọc nhúng liền mạch trên đầu trang.
  - Chế độ Đọc sách (Reader): Không gian đọc sách toàn màn hình, nút mở sidebar nổi tinh tế khi cần.
