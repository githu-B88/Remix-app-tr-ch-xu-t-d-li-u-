# Hệ Thống Trích Xuất OCR Hóa Đơn & Phiếu Xuất/Nhập Kho Offline

Giải pháp phần mềm trích xuất thông minh hóa đơn giá trị gia tăng (GTGT) và phiếu xuất/nhập kho chạy hoàn toàn offline trên trình duyệt theo phong cách CamScanner, tự động bóc tách cấu trúc bảng biểu và xuất file Excel (.xlsx) cùng Word (.docx) chuẩn biểu mẫu A4.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Các quyết định đã thống nhất qua khảo sát:**
> - **Biểu mẫu & Dữ liệu mẫu**: Hỗ trợ toàn diện cả Hóa đơn GTGT và Phiếu xuất/nhập kho, kèm sẵn bộ dữ liệu mẫu thử nghiệm 1-click để kiểm thử tức thì.
> - **Khổ giấy xuất Word (.docx)**: Mặc định chuẩn khổ dọc Portrait A4 theo biểu mẫu kế toán truyền thống, đồng thời tích hợp nút chuyển đổi nhanh sang Khổ ngang Landscape khi bảng nhiều cột.
> - **Xử lý ảnh CamScanner**: Tích hợp thanh công cụ xử lý trước OCR bao gồm cắt cúp (Crop), xoay ảnh (Rotate), tăng độ tương phản (Contrast Boost) và nhị phân hóa đen trắng (Binarization) giúp tối ưu độ chính xác nhận dạng ký tự tiếng Việt.
> - **Nguyên tắc Offline 100%**: Sử dụng `tesseract.js` và `pdfjs-dist` với tệp ngôn ngữ `vie.traineddata` và worker cục bộ trong thư mục `public/`, tuyệt đối không gọi CDN mạng bên ngoài.

---

### 1. Overview & Core Concept

- **Mục tiêu**: Giúp nhân viên kế toán, thủ kho và quản lý vật tư số hóa nhanh chứng từ giấy hoặc file PDF hóa đơn, phiếu xuất/nhập kho thành bảng dữ liệu số hóa có thể kiểm tra, chỉnh sửa và xuất file định dạng văn phòng chỉ trong vài giây.
- **Đối tượng sử dụng**: Kế toán doanh nghiệp, nhân viên kho bãi, nhân viên mua hàng, chủ hộ kinh doanh xử lý lượng lớn chứng từ tiếng Việt.
- **Giá trị cốt lõi**:
  - Không lo rò rỉ dữ liệu tài chính (xử lý nội bộ 100% trong trình duyệt, bảo mật dữ liệu tuyệt đối).
  - Tối ưu nhận dạng tiếng Việt có dấu và các con số tài chính đặc thù (dấu chấm, dấu phẩy phân tách hàng nghìn).
  - Trải nghiệm thị giác trực quan CamScanner: từ việc căn chỉnh ảnh, cắt cúp đến rà soát số liệu trực quan trên bảng tương tác.

---

### 2. User Experience & Visual Design

#### A. Key User Flows
1. **Tiếp nhận tài liệu (Input Zone)**:
   - Kéo thả hoặc chọn tệp PDF / Ảnh (PNG, JPG, WebP) hoặc bấm nút chọn nhanh "Tài liệu mẫu" (Hóa đơn GTGT điện tử, Phiếu xuất kho bán hàng, Phiếu nhập kho vật tư).
   - Nếu là tệp PDF đa trang: hiển thị thanh chọn trang cần phân tích và tự động kết xuất canvas nét cao (2x DPI) qua `pdfjs-dist`.
2. **Căn chỉnh & Xử lý ảnh CamScanner (Preview & Enhance)**:
   - Khung xem trước trực quan với công cụ Crop kéo thả các điểm neo linh hoạt.
   - Thanh công cụ hiệu chỉnh: Xoay 90°, Đảo ngược màu, Tăng độ tương phản, Bộ lọc Quét tài liệu đen trắng (Binarization/High Contrast threshold).
   - Nút "Phân tích OCR" kích hoạt tiến trình nhận diện với thanh tiến trình % trực quan.
3. **Phân tích Bounding Boxes & Nhận dạng cấu trúc**:
   - Tách biệt phần **Thông tin chung (Header Metadata)**: Tên đơn vị bán/xuất, Mã số thuế, Số hóa đơn/phiếu, Ngày tháng năm, Đơn vị mua/nhập.
   - Nhận dạng tự động **Bảng chi tiết hàng hóa (Detail Grid)** theo tọa độ: STT, Tên hàng hóa/vật tư, Đơn vị tính, Số lượng, Đơn giá, Thành tiền.
4. **Kiểm tra & Hiệu chỉnh tương tác (Review & Edit Table)**:
   - Bảng dữ liệu tương tác cho phép sửa đổi trực tiếp từng ô (in-place editable cells).
   - Thêm dòng mới, xóa dòng, tự động tính tổng tiền hàng, thuế suất VAT và tổng thanh toán.
   - Khung xem song song (Side-by-side) hoặc chia đôi màn hình giữa ảnh gốc đã crop và dữ liệu bảng để dễ dàng đối chiếu.
5. **Xuất bản chứng từ (Export Suite)**:
   - **Xuất Excel (.xlsx)**: Tạo tệp bảng tính với tiêu đề trang trọng, định dạng cột chuẩn số tiền, công thức tổng và kẻ viền bảng chuyên nghiệp qua thư viện `xlsx`.
   - **Xuất Word (.docx)**: Tạo tệp văn bản A4 hoàn chỉnh với Quốc hiệu, tiêu đề phiếu/hóa đơn, thông tin các bên, bảng bảng biểu chuẩn mực có viền nét đơn, dòng tổng cộng bằng số và chữ, cùng các vị trí ký tên (Người lập biểu, Kế toán trưởng, Thủ kho, Thủ trưởng đơn vị) qua thư viện `docx`.

#### B. Visual Identity & Theme
- **Phong cách**: Modern Business Utility & SaaS Tool (chuyên nghiệp, tinh tế, sạch sẽ, chuẩn xác).
- **Bảng màu**:
  - Nền chính: Xám nhạt công sở (`bg-slate-50 / bg-slate-900/40`), bề mặt thẻ trắng tinh khiết (`bg-white dark:bg-slate-800`).
  - Điểm nhấn hành động: Xanh lục bảo tài chính (`emerald-600 / teal-600`) cho nút phân tích và xuất dữ liệu, phối hợp cùng Xanh dương navy (`indigo-600`) cho nhận diện thương hiệu.
  - Đường viền: Tinh giản mảnh 1px (`border-slate-200 dark:border-slate-700`).
- **Typography**: Hiển thị rõ ràng, font số chuẩn tabular (`tabular-nums`) cho mọi số tiền, số lượng và mã số thuế.
- **Tuân thủ quy chuẩn anti-slop**: Không dùng hiệu ứng gradient tím lòe loẹt, không gắn nhãn capsule pill dư thừa, các nút bấm nhãn tự nhiên rõ nghĩa ("Phân tích OCR", "Xuất Excel", "Xuất Word", "Thêm dòng").

---

### 3. Key Product Decisions & Trade-Offs

- **Quyết định 1: Kiến trúc OCR Offline hoàn toàn với Tesseract.js**:
  - *Phương án chọn*: Đóng gói tệp dữ liệu huấn luyện tiếng Việt `vie.traineddata` cùng các file worker `worker.min.js` và `tesseract-core.wasm` cục bộ trong thư mục `public/ocr/`. Tesseract được khởi tạo với `workerPath`, `corePath`, và `langPath` trỏ trực tiếp đến `origin` của applet.
  - *Lý do*: Đảm bảo hoạt động trơn tru 100% trong môi trường sandbox nội bộ không phụ thuộc internet/CDN, tốc độ ổn định và bảo mật tuyệt đối chứng từ.
  - *Phương án dự phòng*: Thuật toán tiền xử lý hình ảnh (grayscale, thresholding, contrast stretching) trên HTML5 Canvas giúp nâng chất lượng ảnh quét trước khi đưa vào worker.
- **Quyết định 2: Thuật toán Bounding Box Line Clustering & Column Projection**:
  - *Phương án chọn*: Thu thập danh sách `words` kèm tọa độ `bbox` từ Tesseract kết quả. Nhóm các từ theo dải tung độ $Y$ để tạo thành từng dòng văn bản (line clustering). Nhận diện dòng tiêu đề bảng bằng từ khóa đối sánh mờ (`STT`, `Tên hàng`, `Mặt hàng`, `ĐVT`, `Số lượng`, `Đơn giá`, `Thành tiền`). Chiếu tọa độ hoành độ $X$ của tiêu đề để phân bố các từ vào đúng cột tương ứng.
  - *Lý do*: Giải quyết triệt để vấn đề hóa đơn thực tế có thể bị lệch cột hoặc có tên hàng hóa xuống dòng nhiều hàng.
- **Quyết định 3: Thư viện xuất tài liệu chuyên dụng**:
  - *Excel*: Sử dụng thư viện `xlsx` (SheetJS) thuần client-side tạo workbook `.xlsx` chuẩn với column auto-fit width.
  - *Word*: Sử dụng thư viện `docx` tạo document hoàn chỉnh với cấu trúc Section, Header, Paragraph căn lề chuẩn, Table kèm TableRow/TableCell borders, định dạng khổ giấy A4 Portrait/Landscape tùy chọn.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                   GIAO DIỆN NGƯỜI DÙNG (NEXT.JS 15)                    │
│                                                                        │
│  ┌───────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ 1. NHẬP LIỆU & CROP   │  │ 2. XỬ LÝ & BỘ LỌC HÌNH ẢNH           │  │
│  │  - Kéo thả PDF/PNG/JPG│  │  - Crop điểm neo (CamScanner Style)  │  │
│  │  - PDF to Image Canvas│  │  - Xoay, Tương phản, Binarization     │  │
│  │  - Chọn tài liệu mẫu  │  │  - Nút "Phân tích OCR"               │  │
│  └───────────┬───────────┘  └──────────────────┬───────────────────┘  │
│              │                                 │                      │
│              ▼                                 ▼                      │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ 3. ĐỘNG CƠ OCR OFFLINE (Tesseract.js & Worker WASM Cục Bộ)      │  │
│  │  - vie.traineddata nội bộ (không gọi CDN bên ngoài)             │  │
│  │  - Lấy Word Bounding Boxes & Confidence                         │  │
│  └───────────────────────────────┬─────────────────────────────────┘  │
│                                  │                                    │
│                                  ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ 4. THUẬT TOÁN PHÂN TÍCH TỌA ĐỘ BẢNG & TRÍCH XUẤT HEADER         │  │
│  │  - Phân vùng Header (Số HĐ, Ngày lập, Đơn vị bán/mua, MST)     │  │
│  │  - Line Clustering & X-Projection trích xuất 6 cột bảng         │  │
│  └───────────────────────────────┬─────────────────────────────────┘  │
│                                  │                                    │
│                                  ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ 5. BẢNG XEM LẠI & CHỈNH SỬA TƯƠNG TÁC (EDITABLE DATA GRID)      │  │
│  │  - Sửa trực tiếp từng ô, Thêm / Xóa dòng, Tự động tính tổng tiền│  │
│  │  - Đối chiếu side-by-side trực quan với ảnh đã cắt cúp          │  │
│  └───────────┬─────────────────────────────────────────┬───────────┘  │
│              │                                         │              │
│              ▼                                         ▼              │
│  ┌───────────────────────┐             ┌───────────────────────────┐  │
│  │ 6. XUẤT EXCEL (.xlsx) │             │ 7. XUẤT WORD (.docx)      │  │
│  │  - xlsx (SheetJS)     │             │  - docx library           │  │
│  │  - Cột, viền, tổng số │             │  - Mẫu A4 Portrait chuẩn  │  │
│  └───────────────────────┘             └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Cấu trúc dữ liệu chính (TypeScript Models):
- `InvoiceHeader`: `{ invoiceNo, invoiceDate, sellerName, sellerTaxCode, buyerName, buyerTaxCode, warehouseType }`
- `InvoiceItemRow`: `{ id, stt, itemName, unit, quantity, unitPrice, amount }`
- `InvoiceDocument`: `{ header: InvoiceHeader, items: InvoiceItemRow[], vatRate: number, subTotal: number, vatAmount: number, totalAmount: number }`

---

### 5. Kế hoạch từng bước triển khai (Implementation Milestones)

1. **Khởi tạo phụ thuộc & Tài nguyên Offline**:
   - Cài đặt `tesseract.js`, `pdfjs-dist`, `xlsx`, `docx`.
   - Thiết lập các tệp ngôn ngữ và worker trong `/public/ocr/` để Tesseract và pdfjs-dist hoạt động trơn tru không phụ thuộc mạng.
   - Chuẩn bị 3 bộ mẫu chứng từ thực tế (Hóa đơn GTGT, Phiếu xuất kho, Phiếu nhập kho).
2. **Xây dựng module CamScanner Image Preprocessor & Cropper**:
   - Component xem trước và cắt ảnh tương tác với canvas độ phân giải cao.
   - Bộ lọc xử lý ảnh (độ tương phản, bộ lọc nhị phân trắng đen tăng nét chữ).
   - Module chuyển đổi trang PDF sang hình ảnh bằng PDF.js.
3. **Phát triển thuật toán OCR & Table Parser**:
   - Khởi tạo Worker Tesseract với cấu hình offline tiếng Việt.
   - Bộ phân tích tọa độ bounding box để tự động nhận dạng bảng và bóc tách thông tin header.
4. **Phát triển Bảng duyệt & Chỉnh sửa tương tác (Editable Review Table)**:
   - Giao diện hai cột: Bên trái là ảnh tài liệu đã crop với highlight vùng nhận diện, bên phải là bảng chỉnh sửa dữ liệu và thông tin chung.
   - Các thao tác: Sửa ô, thêm dòng, xóa dòng, tính toán tự động số tiền.
5. **Triển khai module Xuất file Excel (.xlsx) & Word (.docx)**:
   - Module xuất Excel: Tạo file với tiêu đề, bảng kẻ ô, định dạng số, tổng cộng.
   - Module xuất Word: Tạo file `.docx` mẫu A4 hoàn chỉnh có quốc hiệu, thông tin chứng từ, bảng chi tiết, phần ký duyệt.
6. **Kiểm thử, Xác thực & Tinh chỉnh thẩm mỹ**:
   - Kiểm tra toàn bộ luồng hoạt động từ tải file/chọn mẫu -> crop -> OCR -> chỉnh sửa -> xuất cả 2 định dạng file.
   - Chạy `compile_applet` và kiểm tra không còn lỗi.
