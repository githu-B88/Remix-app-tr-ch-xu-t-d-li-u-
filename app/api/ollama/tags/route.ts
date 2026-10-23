import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const ollamaUrl = searchParams.get('url') || 'http://127.0.0.1:11434';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return NextResponse.json(
        { error: `Ollama trả về mã lỗi HTTP ${resp.status}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    const models = Array.isArray(data.models)
      ? data.models.map((m: { name?: string; model?: string }) => m.name || m.model || '')
      : [];

    return NextResponse.json({
      success: true,
      models,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, models: [] }, { status: 502 });
  }
}
