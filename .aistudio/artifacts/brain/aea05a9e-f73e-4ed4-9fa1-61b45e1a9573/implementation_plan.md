# Kế Hoạch Loại Bỏ Triệt Để Tesseract OCR & Chuyển Sang Thuần Túy PaddleOCR + Ollama

Giải thích nguyên nhân Tesseract vẫn xuất hiện trước đó, loại bỏ hoàn toàn 100% các tệp, gói thư viện, logic fallback và nhãn liên quan đến Tesseract OCR trong `/lib`, `/components`, `/app`, và `/public`, chuyển đổi sang kiến trúc thuần túy **PaddleOCR (Deep Learning tiếng Việt)** và **Ollama LLM (Hậu kỳ)**.

---

### Giải Thích Hiện Tượng & Trả Lời Câu Hỏi Của Bạn

> **Tại sao trong khi quét OCR vẫn thấy xuất hiện Tesseract?**
>
> Trong phiên bản trước, hệ thống có thiết kế một cơ chế *fallback tự động (dự phòng)*: Khi trình duyệt quét tài liệu mà Python FastAPI backend (chạy PaddleOCR trên port 8000) chưa được bật hoặc chưa kết nối, pipeline đã tự động chuyển hướng sang chạy worker `Tesseract.js` kèm dữ liệu `vie.traineddata` để tránh ứng dụng bị dừng đột ngột. Do đó, thanh tiến trình đã hiển thị `[Tesseract OCR] Đang quét ký tự tiếng Việt...`.
>
> Theo yêu cầu mới của bạn, chúng ta sẽ **loại bỏ hoàn toàn Tesseract OCR**, gỡ bỏ gói `tesseract.js`, xóa thư mục dữ liệu `/public/tessdata`, và thiết lập luồng xử lý: **chỉ sử dụng PaddleOCR**. Nếu backend PaddleOCR chưa bật, hệ thống sẽ dừng tiến trình và hiển thị hộp thoại hướng dẫn kết nối rõ ràng thay vì fallback sang Tesseract.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Toàn bộ các quyết định từ câu trả lời của bạn đã được tích hợp đầy đủ vào thiết kế:

- **Quyết định 1 (Xử lý khi PaddleOCR ngắt kết nối)**: Không fallback sang bất kỳ engine OCR cũ nào. Báo lỗi thân thiện, chi tiết ngay trên UI kèm nút kiểm tra kết nối lại và modal lệnh khởi động Python FastAPI backend (`cd python_service && pip install -r requirements.txt && python3 main.py`).
- **Quyết định 2 (Dọn dẹp triệt để thư viện & dữ liệu cũ)**: Gỡ bỏ `tesseract.js` khỏi `package.json`, xóa hoàn toàn thư mục `/public/tessdata` (các file WASM và `vie.traineddata`), xóa tệp `/lib/ocr-service.ts`.
- **Quyết định 3 (Giao diện tiến trình thuần túy PaddleOCR)**: Thanh tiến trình chỉ hiển thị các bước:
  - `[OpenCV] Tiền xử lý ảnh (Khử nghiêng, lọc bóng, tăng tương phản CLAHE)`
  - `[PaddleOCR] Đang quét chữ tiếng Việt độ chính xác cao (Deep Learning DBNet + CRNN/SVTR)`
  - `[Ollama] Đang cấu trúc hóa bảng hóa đơn & đối soát số liệu qua mô hình AI`

---

### 1. Overview & Core Concept

- **Mục tiêu**: Làm sạch hoàn toàn codebase, đảm bảo tính nhất quán 100% về mặt kiến trúc AI: chỉ sử dụng **OpenCV** cho tiền xử lý, **PaddleOCR** cho nhận dạng ký tự quang học tiếng Việt, và **Ollama** cho cấu trúc hóa bảng biểu hóa đơn/phiếu kho.
- **Đối tượng**: Kế toán, kiểm toán, thủ kho muốn tận dụng sức mạnh vượt trội của mô hình nhận diện học sâu tiếng Việt (PaddleOCR) không bị nhiễu bởi engine Tesseract cũ.
- **Cam kết kỹ thuật**: Không còn bất kỳ import `tesseract.js`, không còn file `ocr-service.ts`, không còn fallback ngầm nào.

---

### 2. User Experience & Visual Design

- **Header & Thanh trạng thái (EngineStatusBar)**:
  - Xóa mọi nhãn `(Dự phòng Tesseract)`.
  - Hiển thị trực tiếp: `PaddleOCR (Cổng 8000)` kèm trạng thái `Sẵn sàng` (xanh) hoặc `Chưa kết nối` (cam/đỏ).
  - Khi chưa kết nối PaddleOCR, nút quét hiển thị trạng thái cảnh báo và bấm vào sẽ mở ngay modal hướng dẫn khởi động backend.
- **Tiến trình OCR thời gian thực**:
  - Giai đoạn 1: `[OpenCV] Tiền xử lý ảnh (Khử nghiêng, CLAHE, cân bằng sáng)`
  - Giai đoạn 2: `[PaddleOCR] Quét nhận dạng văn bản tiếng Việt Deep Learning`
  - Giai đoạn 3: `[Ollama] Chuẩn hóa bảng hàng hóa & đối soát số học`
- **Modal Cảnh báo Kết nối Backend**:
  - Khi người dùng bấm quét mà Python backend chưa chạy, hiển thị hộp thoại thông báo chuyên nghiệp:
    - Trạng thái: "PaddleOCR Backend chưa sẵn sàng".
    - Lệnh 1-click copy: `cd python_service && pip install -r requirements.txt && python3 main.py`.
    - Nút "Thử lại kết nối" (Test Connection).

---

### 3. Key Product Decisions & Trade-Offs

- **Loại bỏ Tesseract.js và thư mục `/public/tessdata`**:
  - *Lợi ích*: Giảm dung lượng build, xóa bỏ hoàn toàn tệp WASM và traineddata nặng nề (~30MB), mã nguồn sạch sẽ, không gây hiểu lầm cho người dùng.
  - *Xử lý rủi ro khi backend chưa chạy*: Cung cấp modal thông báo trực quan, thân thiện, hướng dẫn người dùng chạy server nhanh chóng.
- **Trực tiếp hóa luồng gọi PaddleOCR**:
  - `/api/pipeline/ocr` sẽ gửi ảnh tới Python backend (`/ocr`). Nếu backend trả về lỗi hoặc timeout, API sẽ trả về thông báo lỗi chi tiết, không kích hoạt fallback Tesseract.

---

### 4. Technical Architecture & Plan Execution

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend (React 19)                    │
│  - DocumentUploader (PDF / Multi-page Image)                           │
│  - CamScannerCropper & OpenCV Preprocessor                             │
│  - PaddleOCR Status & Settings Modal                                   │
│  - EditableReviewTable (Live Editing, Totals, Validation)              │
│  - ExportService (Excel .xlsx, Word .docx)                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         HTTP / REST API Proxy
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Next.js API Gateway / Proxy Routes                   │
│  - /api/pipeline/status    --> Kiểm tra kết nối Python & Ollama        │
│  - /api/pipeline/preprocess--> OpenCV Preprocessing                    │
│  - /api/pipeline/ocr       --> Thuần túy PaddleOCR (Không fallback)    │
│  - /api/pipeline/ollama    --> Ollama LLM Cấu trúc hóa bảng            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Python FastAPI Backend (:8000)                       │
│  - OpenCV Engine: Deskew, CLAHE, Shadow Removal, Bilateral Filter      │
│  - PaddleOCR Engine: Vietnamese OCR model ('lang=vi')                  │
│  - Ollama Client: Kết nối Ollama Daemon (:11434)                       │
└────────────────────────────────────────────────────────────────────────┘
```

#### Các Bước Thực Hiện Cụ Thể Sau Khi Phê Duyệt:
1. **Dọn dẹp Tesseract**:
   - Xóa tệp `/lib/ocr-service.ts`.
   - Xóa toàn bộ thư mục `/public/tessdata` (bao gồm các file WASM, worker và traineddata).
   - Gỡ bỏ gói `tesseract.js` khỏi `package.json`.
2. **Cập nhật `/lib/pipeline-service.ts`**:
   - Loại bỏ mọi logic import `runOcrRecognition` và fallback Tesseract.
   - Khi gọi PaddleOCR thất bại, ném thông báo lỗi rõ ràng: *"Không thể kết nối tới PaddleOCR backend trên cổng 8000. Vui lòng khởi động Python service."*
3. **Cập nhật `/app/api/pipeline/ocr/route.ts` & `/app/api/pipeline/status/route.ts`**:
   - Bỏ thuộc tính `fallback: true` liên quan tới Tesseract; trả về lỗi HTTP 503 cùng hướng dẫn chi tiết khi backend chưa bật.
4. **Cập nhật UI Components**:
   - `components/engine/EngineStatusBar.tsx`: Hiển thị nhãn thuần túy `PaddleOCR (Cổng 8000)` và `Ollama`.
   - `components/engine/EngineSettingsModal.tsx`: Tối ưu hóa hướng dẫn khởi động PaddleOCR và Ollama.
   - `app/page.tsx`: Cập nhật xử lý lỗi hiển thị modal hướng dẫn khi quét mà PaddleOCR chưa kết nối.
5. **Kiểm tra biên dịch & lint**:
   - Chạy `lint_applet` và `compile_applet` đảm bảo ứng dụng sạch sẽ, hoạt động hoàn hảo.
