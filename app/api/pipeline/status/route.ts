import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const pythonUrl = searchParams.get('pythonUrl') || 'http://127.0.0.1:8000';
  const ollamaUrl = searchParams.get('ollamaUrl') || 'http://127.0.0.1:11434';

  let pythonBackendOnline = false;
  let openCvReady = false;
  let paddleOcrReady = false;
  let ollamaOnline = false;
  let ollamaModels: string[] = [];

  // 1. Probe Python FastAPI Backend
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const pyRes = await fetch(`${pythonUrl.replace(/\/$/, '')}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (pyRes.ok) {
      const data = await pyRes.json();
      pythonBackendOnline = true;
      openCvReady = true;
      paddleOcrReady = Boolean(data.paddle_ocr_ready);
    }
  } catch {
    pythonBackendOnline = false;
  }

  // 2. Probe Ollama API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const olRes = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (olRes.ok) {
      const data = await olRes.json();
      ollamaOnline = true;
      if (Array.isArray(data.models)) {
        ollamaModels = data.models.map((m: { name?: string; model?: string }) => m.name || m.model || '');
      }
    }
  } catch {
    ollamaOnline = false;
  }

  let activePipelineDescription = 'Dự phòng Tự động: Canvas + Tesseract.js (Offline 100%)';
  if (pythonBackendOnline && ollamaOnline) {
    activePipelineDescription = 'Toàn diện: OpenCV + PaddleOCR + Ollama LLM';
  } else if (pythonBackendOnline) {
    activePipelineDescription = 'Nâng cao: OpenCV + PaddleOCR (Đang chờ Ollama)';
  } else if (ollamaOnline) {
    activePipelineDescription = 'Lai ghép: Canvas + Tesseract.js + Ollama LLM Hậu kỳ';
  }

  return NextResponse.json({
    pythonBackendOnline,
    openCvReady,
    paddleOcrReady,
    ollamaOnline,
    ollamaModels,
    activePipelineDescription,
    lastChecked: Date.now(),
  });
}
