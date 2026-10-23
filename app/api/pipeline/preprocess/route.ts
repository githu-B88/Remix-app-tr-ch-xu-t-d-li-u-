import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      image_base64,
      pythonUrl = 'http://127.0.0.1:8000',
      rotate = 0,
      contrast = 15,
      brightness = 0,
      mode = 'magic',
      deskew = true,
      shadow_removal = true,
      clahe_contrast = true,
      bilateral_denoise = true,
    } = body;

    if (!image_base64) {
      return NextResponse.json({ error: 'image_base64 is required' }, { status: 400 });
    }

    // Try forwarding to Python FastAPI OpenCV preprocessor
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const pyRes = await fetch(`${pythonUrl.replace(/\/$/, '')}/preprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64,
          rotate,
          contrast,
          brightness,
          mode,
          deskew,
          shadow_removal,
          clahe_contrast,
          bilateral_denoise,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (pyRes.ok) {
        const data = await pyRes.json();
        return NextResponse.json({
          success: true,
          engine: 'opencv',
          dataUrl: data.dataUrl,
          width: data.width,
          height: data.height,
          skewAngle: data.skew_angle,
        });
      }
    } catch {
      // Python backend unreachable
    }

    // Return fallback signal so client seamlessly uses Canvas processing
    return NextResponse.json({
      fallback: true,
      message: 'Python backend chưa mở, tự động dùng Canvas preprocessing',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, fallback: true }, { status: 500 });
  }
}
