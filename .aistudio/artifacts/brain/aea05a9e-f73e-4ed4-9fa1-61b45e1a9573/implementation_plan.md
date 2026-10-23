# Nâng Cấp Hệ Thống OCR: OpenCV, PaddleOCR & Hậu Kỳ Ollama Thông Minh

Chuyển đổi toàn diện pipeline trích xuất hóa đơn GTGT và phiếu xuất/nhập kho từ OCR truyền thống sang giải pháp hiện đại gồm **OpenCV (Python)** cho tiền xử lý nâng cao, **PaddleOCR** cho nhận dạng ký tự tiếng Việt với độ chính xác cao, và **Ollama LLM** cho bước hậu kỳ chuẩn hóa bảng và sửa lỗi chính tả kế toán, kết hợp cơ chế fallback mượt mà.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Toàn bộ các quyết định kỹ thuật từ vòng khảo sát tương tác (Phase 1) đã được chốt và đưa vào thiết kế hệ thống bên dưới:

- **Quyết định 1 (Kiến trúc Backend)**: Tích hợp Python FastAPI backend (`/server/main.py`) chạy song song với Next.js, cung cấp các API chuyên dụng `/api/py/preprocess` (OpenCV), `/api/py/ocr` (PaddleOCR), `/api/py/postprocess` (Ollama), và `/api/py/health`.
- **Quyết định 2 (Cấu hình Ollama)**: Cung cấp modal & thanh công cụ cấu hình linh hoạt trên UI (Endpoint mặc định `http://127.0.0.1:11434`, kiểm tra kết nối Test Connection, lựa chọn model như `qwen2.5:7b`, `llama3.2`, `deepseek-r1` hoặc tự nhập model).
- **Quyết định 3 (Cơ chế Dự phòng Fallback)**: Thiết kế pipeline thông minh 2 tầng: Tự động phát hiện trạng thái backend Python / Ollama. Nếu một trong các dịch vụ chưa khởi động hoặc gặp lỗi kết nối, ứng dụng hiển thị thông báo tình trạng rõ ràng và tự động chuyển sang engine cục bộ (Canvas processing + Tesseract OCR tiếng Việt + Rule-based Table Parser), đảm bảo trải nghiệm người dùng luôn liên tục 100%, không bị đơ giật hay crash.

---

### 1. Overview & Core Concept

- **Mục tiêu**: Nâng cao độ chính xác nhận dạng các mẫu hóa đơn in kim, chữ mờ, hóa đơn điện tử scan nghiêng, bóng mờ hoặc phiếu xuất kho nhiều trang bằng pipeline AI chuyên nghiệp.
- **Đối tượng sử dụng**: Kế toán viên, thủ kho, kiểm toán viên, nhân viên nhập liệu cần trích xuất bảng kê hàng hóa, số hóa đơn, ngày tháng, thông tin bên bán/mua và xuất ra Excel (.xlsx) / Word (.docx).
- **Giá trị cốt lõi**:
  - Tiền xử lý OpenCV: Tự động nắn góc nghiêng (deskew), xóa viền nhiễu, cân bằng sáng cục bộ (CLAHE), lọc bóng và khử nhiễu song phương (bilateral filter).
  - Nhận diện PaddleOCR: Mô hình Deep Learning phát hiện vùng văn bản (DBNet) và nhận diện ký tự tiếng Việt (CRNN/SVTR) vượt trội so với OCR truyền thống.
  - Hậu kỳ Ollama: LLM tự động chuẩn hóa các dòng hóa đơn phức tạp, kiểm tra tính hợp lý của số học (Số lượng × Đơn giá = Thành tiền), sửa sai sót ký tự tiếng Việt và định dạng cấu trúc JSON chính xác.

---

### 2. User Experience & Visual Design

Theo tiêu chuẩn thiết kế SaaS & Dashboard công nghiệp (`frontend-design` & `references/3_saas_dashboard.md`):

- **Header & Thanh trạng thái Engine (Top Bar Contract)**:
  - Giữ vững cấu trúc 3 vùng: Logo/Tên ứng dụng bên trái, điều hướng ở giữa, và nút chức năng chính bên phải.
  - Tích hợp **Engine Status Bar** tinh tế: hiển thị trạng thái kết nối `OpenCV / PaddleOCR` và `Ollama Engine` với nhãn văn bản chuẩn mực, nút mở bảng "Cấu hình AI Engine" trực quan.
- **Modal Cấu hình Engine Thông minh**:
  - Giao diện cấu hình địa chỉ Ollama Host, lựa chọn Model LLM (`qwen2.5:7b`, `llama3.2:3b`, `vietnamese-llama`, v.v.), tham số nhiệt độ (Temperature).
  - Nút kiểm tra kết nối "Test Connection" kèm phản hồi kết quả tức thì.
  - Tùy chọn bật/tắt chế độ nâng cao OpenCV và Ollama post-processing.
- **Tiến trình OCR theo thời gian thực (Multi-stage Stepper)**:
  - Hiển thị trực quan từng giai đoạn xử lý:
    1. *Giai đoạn 1: Tiền xử lý ảnh OpenCV* (Khử nghiêng, lọc sáng, tăng độ tương phản).
    2. *Giai đoạn 2: Trích xuất PaddleOCR* (Quét bounding box và nhận diện văn bản tiếng Việt).
    3. *Giai đoạn 3: Hậu kỳ Ollama* (Phân tích cấu trúc bảng biểu, đối soát số liệu).
- **Bảng dữ liệu & Khung so sánh (Tabular Discipline)**:
  - Bảng dữ liệu tương tác 2 cột: Ảnh tài liệu sau tiền xử lý (bên trái) và Bảng trích xuất có thể chỉnh sửa trực tiếp (bên phải).
  - Số liệu tài chính định dạng chuẩn monospace tabular (`font-mono tabular-nums`).
  - Nút xuất file Excel và Word giữ nguyên định dạng chuyên nghiệp.

---

### 3. Key Product Decisions & Trade-Offs

- **Kiến trúc Hybrid (FastAPI + Next.js Proxy + Fallback)**:
  - *Phương án chọn*: Viết FastAPI backend Python phục vụ các module OpenCV & PaddleOCR, Next.js đóng vai trò API Gateway chuyển tiếp yêu cầu và quản lý phiên.
  - *Lý do*: Đảm bảo tận dụng tối đa sức mạnh của OpenCV C++ / Python và PaddleOCR pre-trained weights, đồng thời tích hợp Ollama qua REST API `/api/generate`.
  - *Giải pháp thay thế đã cân nhắc*: Chạy thuần WebAssembly trong trình duyệt. Tuy nhiên PaddleOCR chưa có bản WebAssembly hoàn chỉnh tối ưu tiếng Việt, và Ollama chỉ chạy dưới dạng server daemon.
- **Cơ chế Fallback thông minh không gián đoạn**:
  - Khi hệ thống không kết nối được tới Python FastAPI hoặc Ollama trên máy tính cục bộ, ứng dụng chủ động chuyển sang engine Tesseract + Rule-based parser kèm thông báo hướng dẫn cài đặt một cách chuyên nghiệp.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend (React 19)                    │
│  - DocumentUploader (PDF / Multi-page Image)                           │
│  - CamScannerCropper & Filter Controls                                 │
│  - EngineConfigModal (Ollama & PaddleOCR Settings)                     │
│  - EditableReviewTable (Live Editing, Totals, Validation)              │
│  - ExportService (Excel .xlsx, Word .docx)                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         HTTP / REST API Proxy
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Next.js API Gateway / Proxy Routes                   │
│  - /api/engine/status    --> Healthcheck & capability negotiation      │
│  - /api/engine/process   --> Orchestration: Preprocess -> OCR -> LLM   │
│  - /api/ollama/models    --> Query local Ollama available models       │
└──────────────┬──────────────────────────────────────────┬──────────────┘
               │ (Primary Python Pipeline)                │ (Local Fallback)
               ▼                                          ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       Python FastAPI Backend         │  │     Client Fallback Engine   │
│  - OpenCV Preprocessor:              │  │  - HTML5 Canvas Filters      │
│    * Deskew via Hough / MinAreaRect  │  │  - Tesseract.js Offline      │
│    * CLAHE Contrast Enhancement      │  │  - Rule-based Table Parser   │
│    * Morphological Shadow Removal    │  └──────────────────────────────┘
│  - PaddleOCR Engine:                 │
│    * Vietnamese text detection       │
│    * Bounding box generation         │
│  - Ollama LLM Client:                │
│    * Prompt template for Invoices    │
│    * JSON schema structured output   │
└──────────────────────────────────────┘
```

#### Quy trình xử lý dữ liệu chi tiết (Processing Flow):

1. **Upload & Crop**: Người dùng tải tài liệu (ảnh hoặc PDF nhiều trang), chọn trang và căn chỉnh góc cúp CamScanner.
2. **Pre-processing (OpenCV)**:
   - Chuyển đổi ảnh sang Grayscale.
   - Phát hiện góc nghiêng bằng Radon/Hough Transform và xoay lại đúng trục (Deskew).
   - Áp dụng CLAHE (Contrast Limited Adaptive Histogram Equalization) để xử lý vùng sáng tối không đồng đều.
   - Khử bóng nền (shadow removal) bằng phép toán hình thái học (morphological closing + division).
3. **Recognition (PaddleOCR)**:
   - Mô hình PaddleOCR phát hiện tọa độ polygon của từng dòng chữ và nhận dạng văn bản tiếng Việt.
   - Trả về danh sách `lines` và `words` kèm tọa độ bounding box (`bbox: {x0, y0, x1, y1}`) và độ tin cậy `confidence`.
4. **Post-processing (Ollama)**:
   - Gửi văn bản thô cùng tọa độ cấu trúc tới Ollama với System Prompt chuyên biệt cho Hóa đơn / Phiếu kho Việt Nam.
   - Nhận kết quả JSON chuẩn chứa: `header` (Số hóa đơn, Ngày, Tên người bán/mua, Mã số thuế) và `items` (STT, Tên hàng, ĐVT, Số lượng, Đơn giá, Thành tiền).
   - Kiểm tra đối soát tự động: Tổng tiền trước thuế, Thuế suất GTGT, Tiền thuế, Tổng tiền thanh toán.
5. **Review & Export**: Người dùng kiểm tra trực tiếp trên bảng, sửa ô sai nếu cần, và bấm xuất file Excel hoặc Word hoàn chỉnh.

---

### Kế hoạch Triển khai Tiếp theo
Sau khi bạn duyệt kế hoạch này, tôi sẽ tiến hành:
1. Xây dựng dịch vụ Python FastAPI với OpenCV, PaddleOCR và kết nối Ollama API.
2. Cập nhật Next.js API Routes để điều phối giữa Python Backend và Ollama.
3. Thêm giao diện quản lý cấu hình Engine & Ollama trên giao diện người dùng.
4. Hoàn thiện cơ chế tự động Fallback sang Canvas + Tesseract để đảm bảo tính ổn định tối đa.
5. Kiểm tra build và biên dịch toàn diện ứng dụng.
