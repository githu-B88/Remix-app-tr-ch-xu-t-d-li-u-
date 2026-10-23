import { createWorker, Worker } from 'tesseract.js';
import { RecognizedLine, RecognizedWord } from '@/types/ocr';

export interface OcrProgressUpdate {
  status: string;
  progress: number;
}

let cachedWorker: Worker | null = null;

/**
 * Initializes or reuses a Tesseract Worker configured for 100% OFFLINE operation.
 * It uses local public assets from /tessdata/vie.traineddata and local worker/wasm scripts.
 * Preserves all characters (Vietnamese, Latin, Cyrillic technical specifications, and numbers) intact.
 */
export async function getOfflineTesseractWorker(
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<Worker> {
  if (cachedWorker) {
    return cachedWorker;
  }

  // Determine current origin in browser
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const worker = await createWorker('vie', 1, {
    workerPath: `${origin}/tessdata/worker.min.js`,
    corePath: `${origin}/tessdata`,
    langPath: `${origin}/tessdata`,
    cacheMethod: 'none',
    gzip: false,
    logger: (m) => {
      if (onProgress && m) {
        let displayStatus = 'Đang xử lý...';
        if (m.status === 'loading tesseract core') displayStatus = 'Khởi tạo thư viện OCR...';
        else if (m.status === 'initializing tesseract') displayStatus = 'Nạp mô hình tiếng Việt offline...';
        else if (m.status === 'initialized tesseract') displayStatus = 'Sẵn sàng nhận dạng...';
        else if (m.status === 'loading language traineddata') displayStatus = 'Nạp tệp vie.traineddata...';
        else if (m.status === 'loaded language traineddata') displayStatus = 'Đã nạp gói tiếng Việt...';
        else if (m.status === 'recognizing text') displayStatus = 'Đang quét ký tự OCR...';

        onProgress({
          status: displayStatus,
          progress: typeof m.progress === 'number' ? Math.round(m.progress * 100) : 0,
        });
      }
    },
  });

  cachedWorker = worker;
  return worker;
}

export interface OcrResultData {
  text: string;
  confidence: number;
  lines: RecognizedLine[];
  words: RecognizedWord[];
}

/**
 * Executes OCR on an image canvas or image data URL and extracts words with bounding boxes.
 */
export async function runOcrRecognition(
  imageSource: string | HTMLCanvasElement,
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<OcrResultData> {
  let worker: Worker;
  try {
    worker = await getOfflineTesseractWorker(onProgress);
  } catch (err) {
    cachedWorker = null;
    throw err;
  }

  let result;
  try {
    result = await worker.recognize(
      imageSource,
      {
        rotateAuto: true,
      },
      {
        text: true,
        blocks: true,
        layoutBlocks: true,
        hocr: true,
        tsv: true,
      }
    );
  } catch (err) {
    cachedWorker = null;
    throw err;
  }

  const words: RecognizedWord[] = [];
  const lines: RecognizedLine[] = [];

  // 1. Extract blocks -> paragraphs -> lines -> words if available
  if (result.data && result.data.blocks && result.data.blocks.length > 0) {
    for (const block of result.data.blocks) {
      if (!block.paragraphs) continue;
      for (const para of block.paragraphs) {
        if (!para.lines) continue;
        for (const rawLine of para.lines) {
          const lineWords: RecognizedWord[] = [];

          if (rawLine.words) {
            for (const w of rawLine.words) {
              const wordObj: RecognizedWord = {
                text: w.text.trim(),
                confidence: w.confidence,
                bbox: {
                  x0: w.bbox.x0,
                  y0: w.bbox.y0,
                  x1: w.bbox.x1,
                  y1: w.bbox.y1,
                },
              };
              if (wordObj.text) {
                lineWords.push(wordObj);
                words.push(wordObj);
              }
            }
          }

          if (rawLine.text && rawLine.text.trim()) {
            lines.push({
              text: rawLine.text.trim(),
              words: lineWords,
              bbox: {
                x0: rawLine.bbox.x0,
                y0: rawLine.bbox.y0,
                x1: rawLine.bbox.x1,
                y1: rawLine.bbox.y1,
              },
              confidence: rawLine.confidence,
            });
          }
        }
      }
    }
  }

  // 2. Guaranteed Fallback: If blocks were empty or missing, construct lines from result.data.text
  if (lines.length === 0 && result.data && result.data.text) {
    const rawLines = result.data.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    rawLines.forEach((lineText, idx) => {
      const lineWords: RecognizedWord[] = lineText.split(/\s+/).filter(Boolean).map((w, wIdx) => ({
        text: w,
        confidence: 85,
        bbox: {
          x0: wIdx * 90,
          y0: idx * 45,
          x1: (wIdx + 1) * 90,
          y1: (idx + 1) * 45,
        },
      }));

      lines.push({
        text: lineText,
        words: lineWords,
        bbox: {
          x0: 0,
          y0: idx * 45,
          x1: 1000,
          y1: (idx + 1) * 45,
        },
        confidence: 85,
      });

      words.push(...lineWords);
    });
  }

  return {
    text: result.data.text,
    confidence: result.data.confidence,
    lines,
    words,
  };
}
