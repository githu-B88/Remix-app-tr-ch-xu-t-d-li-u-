import {
  CropRect,
  DocumentPage,
  EngineConfig,
  InvoiceDocument,
  RecognizedLine,
  RecognizedWord,
} from '@/types/ocr';
import { loadImageElement, processImageOnCanvas } from '@/lib/image-processing';
import { runOcrRecognition } from '@/lib/ocr-service';
import { parseInvoiceWithBoundingBoxes } from '@/lib/table-parser';

export interface PipelineProgressUpdate {
  status: string;
  progress: number;
  engineStage: 'opencv' | 'paddle' | 'ollama' | 'fallback' | 'done';
}

export interface PipelinePageResult {
  doc: InvoiceDocument;
  pageNumber: number;
  previewUrl: string;
  words: RecognizedWord[];
  lines: RecognizedLine[];
  enginesUsed: {
    preprocess: 'opencv' | 'canvas';
    ocr: 'paddleocr' | 'tesseract';
    postprocess: 'ollama' | 'rule_based';
  };
}

/**
 * Executes the complete 3-stage pipeline on a single document page:
 * Stage 1: OpenCV Preprocessing (Deskew, CLAHE, Shadow Removal, Bilateral Filter)
 * Stage 2: PaddleOCR Recognition (Deep Learning Text Extraction with Bounding Boxes)
 * Stage 3: Ollama Post-Processing (Intelligent Typo Correction & Table Structuring)
 * With automatic, seamless fallback if any service is offline.
 */
export async function executePagePipeline(
  page: DocumentPage,
  config: EngineConfig,
  onProgress?: (update: PipelineProgressUpdate) => void
): Promise<PipelinePageResult> {
  const enginesUsed: PipelinePageResult['enginesUsed'] = {
    preprocess: 'canvas',
    ocr: 'tesseract',
    postprocess: 'rule_based',
  };

  // -------------------------------------------------------------
  // STAGE 1: Pre-processing (OpenCV vs Canvas Fallback)
  // -------------------------------------------------------------
  onProgress?.({
    status: config.enableOpenCv
      ? `[OpenCV] Đang tiền xử lý ảnh Trang ${page.pageNumber} (Khử nghiêng, CLAHE, lọc bóng)...`
      : `Đang cắt cúp & căn chỉnh Trang ${page.pageNumber}...`,
    progress: 15,
    engineStage: config.enableOpenCv ? 'opencv' : 'fallback',
  });

  // Base canvas crop & rotation to prepare clean base64 image
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
          rotate: 0, // already applied in base crop
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
            status: `[OpenCV] Hoàn tất tiền xử lý (Độ nghiêng nắn: ${data.skewAngle || 0}°)`,
            progress: 30,
            engineStage: 'opencv',
          });
        }
      }
    } catch {
      // Python OpenCV service offline -> use baseProcessed
      enginesUsed.preprocess = 'canvas';
    }
  }

  // -------------------------------------------------------------
  // STAGE 2: OCR Recognition (PaddleOCR vs Tesseract Fallback)
  // -------------------------------------------------------------
  onProgress?.({
    status: config.enablePaddleOcr
      ? `[PaddleOCR] Đang nhận dạng chữ tiếng Việt Trang ${page.pageNumber}...`
      : `Đang quét OCR Trang ${page.pageNumber}...`,
    progress: 40,
    engineStage: config.enablePaddleOcr ? 'paddle' : 'fallback',
  });

  let ocrText = '';
  let ocrLines: RecognizedLine[] = [];
  let ocrWords: RecognizedWord[] = [];

  let paddleSuccess = false;
  if (config.enablePaddleOcr) {
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
        if (data.success && data.lines && data.lines.length > 0) {
          ocrText = data.text;
          ocrLines = data.lines;
          ocrWords = data.words || [];
          enginesUsed.ocr = 'paddleocr';
          paddleSuccess = true;
          onProgress?.({
            status: `[PaddleOCR] Đã trích xuất ${ocrLines.length} dòng văn bản (Độ tin cậy: ${data.confidence}%)`,
            progress: 70,
            engineStage: 'paddle',
          });
        }
      }
    } catch {
      // PaddleOCR offline
    }
  }

  // Fallback to local Tesseract if PaddleOCR failed or was disabled
  if (!paddleSuccess) {
    enginesUsed.ocr = 'tesseract';
    onProgress?.({
      status: `[Tesseract OCR] Đang quét ký tự tiếng Việt Trang ${page.pageNumber}...`,
      progress: 50,
      engineStage: 'fallback',
    });

    const tessResult = await runOcrRecognition(processedDataUrl, (sub) => {
      onProgress?.({
        status: `[Tesseract OCR] Trang ${page.pageNumber}: ${sub.status}`,
        progress: 45 + Math.round((sub.progress / 100) * 30),
        engineStage: 'fallback',
      });
    });

    ocrText = tessResult.text;
    ocrLines = tessResult.lines;
    ocrWords = tessResult.words;
  }

  // -------------------------------------------------------------
  // STAGE 3: Post-processing (Ollama LLM vs Rule-based Parser Fallback)
  // -------------------------------------------------------------
  onProgress?.({
    status: config.enableOllama
      ? `[Ollama] Đang cấu trúc hóa bảng hóa đơn & sửa lỗi qua model ${config.ollamaModel}...`
      : `Đang phân tích bảng biểu & tính toán số liệu...`,
    progress: 80,
    engineStage: config.enableOllama ? 'ollama' : 'fallback',
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
      // Ollama offline
    }
  }

  // Fallback to Rule-based table parser if Ollama was disabled or offline
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
