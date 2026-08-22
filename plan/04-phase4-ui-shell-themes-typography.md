# 🎨 Giai Đoạn 4: Velvet Aesthetic UI, Themes & Typography

## 1. Mục Tiêu Giai Đoạn 4
* Hiện thực hóa ngôn ngữ thiết kế **Velvet Aesthetic**: Sang trọng, tối giản, tôn vinh trải nghiệm đọc sách thuần khiết.
* Xây dựng hệ thống **Shelf View (Thư viện sách 3D)** với hiệu ứng đổ bóng bìa sách, quản lý trạng thái đọc và thông số tiến độ.
* Xây dựng **Navigation Sidebar (Drawer)**:
  * **Table of Contents (TOC)**: Cây mục lục đa cấp lồng nhau, có hiển thị tiến độ % từng chương.
  * **Bookmarks**: Quản lý danh sách trang đã lưu.
  * **Annotations Hub**: Tổng hợp toàn bộ highlight và ghi chú, tìm kiếm và lọc theo màu sắc.
* Triển khai bộ điều khiển **Typography & Theme Engine** chuyên sâu (Zero-layout shift theming).

---

## 2. Chi Tiết Triển Khai Kỹ Thuật

### 2.1 Hệ Thống Theme Cao Cấp (Color Palette Matrix)

| Theme ID | Tên Theme | Background | Text Color | Điểm nhấn (Accent) | Cảm giác trải nghiệm |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `light` | **Velvet Pure** | `#FFFFFF` | `#1E293B` | `#0284C7` | Sáng sủa, tương phản tiêu chuẩn |
| `dark` | **Velvet Midnight** | `#0F172A` | `#E2E8F0` | `#38BDF8` | Dịu mắt ban đêm, sang trọng |
| `sepia` | **Classic Sepia** | `#FBF0D9` | `#433422` | `#B45309` | Giảm ánh sáng xanh, êm ái |
| `amoled` | **Pitch Black** | `#000000` | `#D4D4D8` | `#A1A1AA` | Tiết kiệm pin tối đa trên màn hình OLED |
| `nord` | **Nordic Frost** | `#2E3440` | `#ECEFF4` | `#88C0D0` | Tông xám xanh bắc âu hiện đại |
| `paper` | **E-Ink Warm Paper**| `#F5F2EB` | `#2D2B28` | `#78716C` | Giả lập bề mặt trang sách in thật |

```css
/* src/styles/themes.css */
[data-theme="sepia"] {
  --bg-reader: #FBF0D9;
  --text-reader: #433422;
  --ui-surface: rgba(251, 240, 217, 0.85);
  --ui-border: rgba(67, 52, 34, 0.12);
}

[data-theme="amoled"] {
  --bg-reader: #000000;
  --text-reader: #E4E4E7;
  --ui-surface: rgba(24, 24, 27, 0.85);
  --ui-border: rgba(255, 255, 255, 0.1);
}
```

---

### 2.2 Typography Engine & Local Font Loader
Người dùng có thể tinh chỉnh:
1. **Font Tuyển Chọn**:
   * *Serif*: Bookerly, Literata, Merriweather, Lora.
   * *Sans-serif*: Inter, Atkinson Hyperlegible (hỗ trợ người khó đọc chữ), Roboto.
   * *Local Fonts*: Tự động đọc danh sách font cài trong máy tính qua `queryLocalFonts()` API (nếu được hỗ trợ).
2. **Thanh Trượt Điều Chỉnh (Sliders)**:
   * Cỡ chữ (Font Size): `14px` → `32px` (mặc định `18px`).
   * Chiều cao dòng (Line Height): `1.2` → `2.4` (mặc định `1.65`).
   * Khoảng cách đoạn (Paragraph Spacing): `0.5rem` → `2.5rem`.
   * Chiều rộng lề trang (Max Content Width): `500px` → `1200px`.
   * Căn lề: Căn trái (`text-align: left`) hoặc Căn đều hai bên (`text-align: justify; hyphens: auto;`).
3. **Chế Độ Bố Cục (Layout Mode)**:
   * **Paginated 1-Column**: Phù hợp cửa sổ hẹp hoặc Side Panel.
   * **Paginated 2-Column**: Trải nghiệm mở sách đôi như sách giấy trên màn hình lớn.
   * **Continuous Scroll**: Cuộn dọc liên tục mượt mà.

---

### 2.3 Shelf View (Thư Viện Sách 3D)
* **Book Card 3D Effect**: Bìa sách có hiệu ứng gáy sách (Spine shadow), hover hiệu ứng nghiêng nhẹ (Tilt 3D).
* **Tiến Độ Đọc**: Thanh tiến độ tinh tế ở chân bìa sách, nhãn "Đang đọc (45%)", "Chưa đọc", "Đã đọc xong".
* **Thanh Công Cụ Shelf**:
  * Tìm kiếm sách theo tên/tác giả.
  * Bộ lọc & Sắp xếp: Mới thêm, Đọc gần đây, Tên A-Z, Tác giả.
  * Khu vực Kéo thả (Drag & Drop Zone) để import sách tức thì.

---

### 2.4 Navigation Drawer (TOC & Annotations Hub)
* **TOC Tree View**: Hỗ trợ cây thư mục lồng nhiều tầng (Nested subchapters), click vào chương để nhảy tới vị trí CFI tương ứng.
* **Annotation Manager**:
  * Danh sách highlight hiển thị màu sắc tương ứng, đoạn text trích dẫn, ghi chú cá nhân và thời gian tạo.
  * Hỗ trợ tìm kiếm theo từ khóa trong ghi chú.
  * Nút "Xóa" hoặc "Nhảy đến đoạn văn" trong sách.

---

## 3. Tiêu Chuẩn Nghiệm Thu Giai Đoạn 4 (Acceptance Criteria)
* [ ] Chuyển đổi theme diễn ra tức thì (< 16ms), áp dụng đồng bộ cho cả giao diện Extension lẫn nội dung bên trong sách.
* [ ] Các thanh trượt typography phản hồi mượt mà trong thời gian thực.
* [ ] Shelf View hiển thị đẹp mắt, quản lý sách và ảnh bìa mượt mà.
* [ ] TOC và Annotation Hub hoạt động chính xác trên cả giao diện Tab lớn và Side Panel hẹp.
