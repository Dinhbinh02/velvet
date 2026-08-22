---
name: Velvet EPUB - Apple Books Edition
colors:
  primary: "#0071E3"
  primary-hover: "#0077ED"
  secondary: "#86868B"
  accent: "#FF9500"
  neutral-bg-dark: "#161618"
  neutral-bg-amoled: "#000000"
  neutral-bg-sepia: "#FBF0D9"
  neutral-bg-light: "#F5F5F7"
  neutral-text-dark: "#F5F5F7"
  neutral-text-sepia: "#3B2F1D"
  neutral-text-light: "#1D1D1F"
  surface-dark: "#1C1C1E"
  surface-light: "#FFFFFF"
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
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
  headline-md:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif"
    fontSize: 17px
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
  lg: 18px
  xl: 24px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
    padding: 8px 18px
  book-card:
    backgroundColor: "{colors.surface-dark}"
    rounded: "{rounded.md}"
    padding: 0px
---

# Velvet - Apple Books Design Specification

## Overview
Thiết kế lại theo ngôn ngữ thiết kế **Apple Books (macOS & iPadOS)**: Đề cao tính tối giản, thanh lịch, sang trọng và tôn vinh nội dung sách. Loại bỏ hoàn toàn tất cả các dải màu gradient sặc sỡ, thay thế bằng màu solid trung tính, đường viền 1px tinh tế, đổ bóng chân thực và bố cục "Reading Now" / "Library" chuẩn Apple.

## Color System (No Gradients)
- Không sử dụng gradient màu mè, bóng đổ phát sáng RGB hay viền màu tím.
- Sử dụng màu solid chuẩn Apple:
  - **Light Mode:** Nền `#F5F5F7`, thẻ bề mặt `#FFFFFF`, viền `#E5E5EA`, chữ `#1D1D1F`.
  - **Dark Mode:** Nền `#161618`, thẻ bề mặt `#1C1C1E`, viền `#2C2C2E`, chữ `#F5F5F7`.
  - **Sepia:** Nền `#FBF0D9`, chữ `#3B2F1D`, viền `#EADBC4`.
  - **AMOLED:** Nền `#000000`, thẻ bề mặt `#121212`, viền `#1F1F1F`.

## Typography & Hierarchy
- Tiêu đề & UI: `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif`.
- Nội dung sách: `Bookerly, "New York", Georgia, serif`.

## Layout & Responsive
- Thư viện chia thành 2 phần:
  1. **Reading Now (Đang đọc):** Thẻ sách nổi bật kèm thanh % tiến độ tinh tế, bìa sách 3D tỷ lệ 2:3 với bóng đổ chiều sâu.
  2. **Library (Thư viện sách):** Lưới bìa sách với tiêu đề và tác giả thanh lịch, thanh lọc trạng thái phân đoạn (Segmented Control).
