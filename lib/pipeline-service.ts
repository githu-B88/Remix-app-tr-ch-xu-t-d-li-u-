import {
  CropRect,
  DocumentPage,
  EngineConfig,
  InvoiceDocument,
  RecognizedLine,
  RecognizedWord,
} from '@/types/ocr';
import { loadImageElement, processImageOnCanvas } from '@/lib/image-processing';
import { parseInvoiceWithBoundingBoxes } from '@/lib/table-parser';

export interface PipelineProgressUpdate {
  status: string;
  progress: number;
  engineStage: 'opencv' | 'paddle' | 'ollama' | 'done';
}

export interface PipelinePageResult {
  doc: InvoiceDocument;
  pageNumber: number;
  previewUrl: string;
  words: RecognizedWord[];
  lines: RecognizedLine[];
  enginesUsed: {
    preprocess: 'opencv' | 'canvas';
    ocr: 'paddleocr';
    postprocess: 'ollama' | 'rule_based';
  };
}

/**
 * Executes the complete AI pipeline on a single document page:
 * Stage 1: OpenCV Preprocessing (Deskew, CLAHE, Shadow Removal, Bilateral Filter)
 * Stage 2: Pure PaddleOCR Recognition (Deep Learning Text Extraction with Bounding Boxes)
 * Stage 3: Ollama Post-Processing (Intelligent Typo Correction & Table Structuring)
 */
export async function executePagePipeline(
  page: DocumentPage,
  config: EngineConfig,
  onProgress?: (update: PipelineProgressUpdate) => void
): Promise<PipelinePageResult> {
  const enginesUsed: PipelinePageResult['enginesUsed'] = {
    preprocess: 'canvas',
    ocr: 'paddleocr',
    postprocess: 'rule_based',
  };

  // -------------------------------------------------------------
  // STAGE 1: Pre-processing with OpenCV
  // -------------------------------------------------------------
  onProgress?.({
    status: config.enableOpenCv
      ? `[OpenCV] Đang tiền xử lý ảnh Trang ${page.pageNumber} (Khử nghiêng, CLAHE, lọc bóng)...`
      : `Đang cắt cúp & căn chỉnh Trang ${page.pageNumber}...`,
    progress: 15,
    engineStage: 'opencv',
  });

  // Base canvas crop & rotation to prepare clean image
  const imgEl = await loadImageElement(page.dataUrl);
  const baseProcessed = await processImageOnCanvas(imgEl, page.filters, page.crop || undefined);
  let processedDataUrl = baseProcessed.dataUrl;

  if (config.enableOpenCv) {
    try {
      const resp = await fetch('/api/pipeline/preprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: baseProcessed.dataUrl,
          pythonUrl: config.pythonBackendUrl,
          rotate: 0,
          contrast: page.filters.contrast,
          brightness: page.filters.brightness,
          mode: page.filters.mode,
          deskew: true,
          shadow_removal: true,
          clahe_contrast: true,
          bilateral_denoise: true,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.dataUrl) {
          processedDataUrl = data.dataUrl;
          enginesUsed.preprocess = 'opencv';
          onProgress?.({
            status: `[OpenCV] Hoàn tất tiền xử lý (Độ nghiêng: ${data.skewAngle || 0}°)`,
            progress: 30,
            engineStage: 'opencv',
          });
        }
      }
    } catch {
      // Use canvas processed image as base
      enginesUsed.preprocess = 'canvas';
    }
  }

  // -------------------------------------------------------------
  // STAGE 2: OCR Recognition (Pure PaddleOCR Deep Learning)
  // -------------------------------------------------------------
  onProgress?.({
    status: `[PaddleOCR] Đang quét chữ tiếng Việt độ chính xác cao Trang ${page.pageNumber}...`,
    progress: 50,
    engineStage: 'paddle',
  });

  let ocrText = '';
  let ocrLines: RecognizedLine[] = [];
  let ocrWords: RecognizedWord[] = [];

  let paddleErrorDetail = '';
  try {
    const resp = await fetch('/api/pipeline/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: processedDataUrl,
        pythonUrl: config.pythonBackendUrl,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.lines) {
        ocrText = data.text || '';
        ocrLines = data.lines || [];
        ocrWords = data.words || [];
        onProgress?.({
          status: `[PaddleOCR] Đã trích xuất ${ocrLines.length} dòng văn bản (Độ tin cậy: ${data.confidence}%)`,
          progress: 75,
          engineStage: 'paddle',
        });
      } else {
        paddleErrorDetail = data.error || 'Dữ liệu trả về từ PaddleOCR không hợp lệ';
      }
    } else {
      const errJson = await resp.json().catch(() => ({}));
      paddleErrorDetail = errJson.error || `Mã phản hồi HTTP ${resp.status}`;
    }
  } catch (err) {
    paddleErrorDetail = err instanceof Error ? err.message : String(err);
  }

  // If PaddleOCR failed or was not reachable, strictly throw error
  if (!ocrLines || ocrLines.length === 0) {
    throw new Error(
      `Không thể quét bằng PaddleOCR: ${paddleErrorDetail || 'Chưa khởi động Python backend'}. Vui lòng kiểm tra Python service tại ${config.pythonBackendUrl} (Lệnh chạy: cd python_service && python3 main.py).`
    );
  }

  // -------------------------------------------------------------
  // STAGE 3: Post-processing (Ollama LLM or Rule-based Table Parser)
  // -------------------------------------------------------------
  onProgress?.({
    status: config.enableOllama
      ? `[Ollama] Đang cấu trúc hóa bảng hóa đơn & đối soát số liệu qua model ${config.ollamaModel}...`
      : `Đang phân tích cấu trúc bảng biểu hóa đơn...`,
    progress: 85,
    engineStage: 'ollama',
  });

  let parsedDoc: InvoiceDocument | null = null;

  if (config.enableOllama && ocrText.trim().length > 10) {
    try {
      const resp = await fetch('/api/pipeline/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ocrText,
          ollamaUrl: config.ollamaUrl,
          model: config.ollamaModel,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.document) {
          const docRes = data.document as InvoiceDocument;
          parsedDoc = docRes;
          enginesUsed.postprocess = 'ollama';
          onProgress?.({
            status: `[Ollama] Chuẩn hóa thành công ${docRes.items?.length || 0} dòng hàng hóa!`,
            progress: 95,
            engineStage: 'ollama',
          });
        }
      }
    } catch {
      // Ollama service not running or timeout
    }
  }

  // Rule-based table parser fallback for PaddleOCR lines
  if (!parsedDoc) {
    enginesUsed.postprocess = 'rule_based';
    parsedDoc = parseInvoiceWithBoundingBoxes(ocrLines, ocrWords, ocrText, page.pageNumber);
  }

  onProgress?.({
    status: `Hoàn tất xử lý Trang ${page.pageNumber}`,
    progress: 100,
    engineStage: 'done',
  });

  return {
    doc: parsedDoc,
    pageNumber: page.pageNumber,
    previewUrl: processedDataUrl,
    words: ocrWords,
    lines: ocrLines,
    enginesUsed,
  };
}
