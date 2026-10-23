import { EngineConfig, EngineStatus } from '@/types/ocr';

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  pythonBackendUrl: 'http://127.0.0.1:8000',
  ollamaUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'qwen2.5:7b',
  enableOpenCv: true,
  enablePaddleOcr: true,
  enableOllama: true,
  autoFallback: true,
};

const STORAGE_KEY = 'invoice_ocr_engine_config_v2';

export function loadEngineConfig(): EngineConfig {
  if (typeof window === 'undefined') return DEFAULT_ENGINE_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ENGINE_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ENGINE_CONFIG, ...parsed };
  } catch {
    return DEFAULT_ENGINE_CONFIG;
  }
}

export function saveEngineConfig(cfg: EngineConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage quota
  }
}

export async function checkEngineHealth(config: EngineConfig): Promise<EngineStatus> {
  try {
    const query = new URLSearchParams({
      pythonUrl: config.pythonBackendUrl,
      ollamaUrl: config.ollamaUrl,
    });
    const res = await fetch(`/api/pipeline/status?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      return {
        pythonBackendOnline: Boolean(data.pythonBackendOnline),
        openCvReady: Boolean(data.openCvReady),
        paddleOcrReady: Boolean(data.paddleOcrReady),
        ollamaOnline: Boolean(data.ollamaOnline),
        ollamaModels: Array.isArray(data.ollamaModels) ? data.ollamaModels : [],
        activePipelineDescription: data.activePipelineDescription || 'Dự phòng Tự động',
        lastChecked: Date.now(),
      };
    }
  } catch {
    // network failure to local proxy
  }

  return {
    pythonBackendOnline: false,
    openCvReady: false,
    paddleOcrReady: false,
    ollamaOnline: false,
    ollamaModels: [],
    activePipelineDescription: 'Chờ kết nối: Python Backend (PaddleOCR cổng 8000)',
    lastChecked: Date.now(),
  };
}

export async function fetchOllamaModels(ollamaUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/ollama/tags?url=${encodeURIComponent(ollamaUrl)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        return data.models;
      }
    }
  } catch {
    // failed to fetch
  }
  return [];
}
