import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image_base64, pythonUrl = 'http://127.0.0.1:8000' } = body;

    if (!image_base64) {
      return NextResponse.json({ error: 'image_base64 is required' }, { status: 400 });
    }

    // Try forwarding to Python FastAPI PaddleOCR engine
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout for heavy OCR
      const pyRes = await fetch(`${pythonUrl.replace(/\/$/, '')}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (pyRes.ok) {
        const data = await pyRes.json();
        return NextResponse.json({
          success: true,
          engine: 'paddleocr',
          text: data.text,
          confidence: data.confidence,
          lines: data.lines,
          words: data.words,
        });
      }
    } catch {
      // Python PaddleOCR server not running or timed out
    }

    // If Python PaddleOCR server is not running or timed out
    return NextResponse.json(
      {
        success: false,
        error: `Không thể kết nối tới PaddleOCR backend tại ${pythonUrl}. Vui lòng khởi động Python FastAPI service (lệnh: cd python_service && python3 main.py).`,
      },
      { status: 503 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
