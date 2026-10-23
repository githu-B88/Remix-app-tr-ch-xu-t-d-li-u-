'use client';

import React, { useState, useEffect } from 'react';
import { EngineConfig, EngineStatus } from '@/types/ocr';
import { fetchOllamaModels } from '@/lib/engine-config';
import {
  X,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
  Cpu,
  Sparkles,
  Layers,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';

interface EngineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: EngineConfig;
  status: EngineStatus;
  onSave: (newConfig: EngineConfig) => void;
  onRefreshStatus: () => void;
}

export function EngineSettingsModal({
  isOpen,
  onClose,
  config,
  status,
  onSave,
  onRefreshStatus,
}: EngineSettingsModalProps) {
  const [draftConfig, setDraftConfig] = useState<EngineConfig>(config);
  const [testingPython, setTestingPython] = useState(false);
  const [pythonTestResult, setPythonTestResult] = useState<string | null>(null);

  const [testingOllama, setTestingOllama] = useState(false);
  const [ollamaTestResult, setOllamaTestResult] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>(status.ollamaModels || []);

  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  // Test Python Backend Connection
  const handleTestPython = async () => {
    setTestingPython(true);
    setPythonTestResult(null);
    try {
      const resp = await fetch(`/api/pipeline/status?pythonUrl=${encodeURIComponent(draftConfig.pythonBackendUrl)}&ollamaUrl=${encodeURIComponent(draftConfig.ollamaUrl)}`);
      const data = await resp.json();
      if (data.pythonBackendOnline) {
        setPythonTestResult('Kết nối thành công! OpenCV đã sẵn sàng, PaddleOCR: ' + (data.paddleOcrReady ? 'Sẵn sàng' : 'Chờ nạp'));
      } else {
        setPythonTestResult('Không thể kết nối tới ' + draftConfig.pythonBackendUrl + '. Vui lòng kiểm tra lệnh chạy Python backend.');
      }
    } catch {
      setPythonTestResult('Lỗi mạng khi kiểm tra Python Backend.');
    } finally {
      setTestingPython(false);
    }
  };

  // Test Ollama Connection & Fetch Models
  const handleTestOllama = async () => {
    setTestingOllama(true);
    setOllamaTestResult(null);
    try {
      const models = await fetchOllamaModels(draftConfig.ollamaUrl);
      if (models.length > 0) {
        setAvailableModels(models);
        setOllamaTestResult(`Kết nối thành công! Tìm thấy ${models.length} model: ${models.slice(0, 3).join(', ')}${models.length > 3 ? '...' : ''}`);
        if (!models.includes(draftConfig.ollamaModel)) {
          setDraftConfig((prev) => ({ ...prev, ollamaModel: models[0] }));
        }
      } else {
        setOllamaTestResult(`Kết nối tới ${draftConfig.ollamaUrl} nhưng chưa thấy model nào được nạp.`);
      }
    } catch {
      setOllamaTestResult(`Không thể kết nối tới Ollama tại ${draftConfig.ollamaUrl}.`);
    } finally {
      setTestingOllama(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleSave = () => {
    onSave(draftConfig);
    onRefreshStatus();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Cấu hình AI Pipeline: OpenCV · PaddleOCR · Ollama
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300">
          {/* Quick Notice */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg p-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Ứng dụng sử dụng <strong>PaddleOCR Deep Learning tiếng Việt</strong> và <strong>Ollama LLM</strong> để trích xuất và cấu trúc hóa bảng hóa đơn / phiếu kho. Vui lòng khởi động Python FastAPI backend trên cổng 8000 trước khi thực hiện quét tài liệu.
          </div>

          {/* 1. OpenCV & PaddleOCR Backend Config */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-500" />
                <span>1. Python FastAPI Backend (OpenCV & PaddleOCR)</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftConfig.enableOpenCv}
                    onChange={(e) => setDraftConfig((p) => ({ ...p, enableOpenCv: e.target.checked }))}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Bật OpenCV</span>
                </label>
                <label className="text-xs text-slate-500 flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftConfig.enablePaddleOcr}
                    onChange={(e) => setDraftConfig((p) => ({ ...p, enablePaddleOcr: e.target.checked }))}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Bật PaddleOCR</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={draftConfig.pythonBackendUrl}
                onChange={(e) => setDraftConfig((p) => ({ ...p, pythonBackendUrl: e.target.value }))}
                placeholder="http://127.0.0.1:8000"
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleTestPython}
                disabled={testingPython}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {testingPython && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Kiểm tra kết nối</span>
              </button>
            </div>

            {pythonTestResult && (
              <p className={`text-xs ${pythonTestResult.includes('thành công') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {pythonTestResult}
              </p>
            )}

            {/* Launch command helper */}
            <div className="bg-slate-900 text-slate-200 rounded-lg p-3 text-xs font-mono relative">
              <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                <span>Lệnh khởi động Python Backend cục bộ:</span>
                <button
                  type="button"
                  onClick={() => handleCopy('cd python_service && pip install -r requirements.txt && python3 main.py', 'py-cmd')}
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  {copiedCmd === 'py-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd === 'py-cmd' ? 'Đã copy' : 'Copy'}</span>
                </button>
              </div>
              <code>cd python_service && pip install -r requirements.txt && python3 main.py</code>
            </div>
          </div>

          {/* 2. Ollama Post-processing LLM Config */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>2. Dịch vụ Ollama LLM (Xử lý hậu kỳ & Chuẩn hóa bảng)</span>
              </label>
              <label className="text-xs text-slate-500 flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftConfig.enableOllama}
                  onChange={(e) => setDraftConfig((p) => ({ ...p, enableOllama: e.target.checked }))}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Bật Ollama</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Ollama URL:</label>
                <input
                  type="text"
                  value={draftConfig.ollamaUrl}
                  onChange={(e) => setDraftConfig((p) => ({ ...p, ollamaUrl: e.target.value }))}
                  placeholder="http://127.0.0.1:11434"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1 block">Tên Model LLM:</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={draftConfig.ollamaModel}
                    onChange={(e) => setDraftConfig((p) => ({ ...p, ollamaModel: e.target.value }))}
                    placeholder="qwen2.5:7b hoặc llama3.2"
                    list="ollama-models-list"
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id="ollama-models-list">
                    {availableModels.map((m) => (
                      <option key={m} value={m} />
                    ))}
                    <option value="qwen2.5:7b" />
                    <option value="llama3.2" />
                    <option value="deepseek-r1:8b" />
                    <option value="gemma2" />
                  </datalist>
                  <button
                    type="button"
                    onClick={handleTestOllama}
                    disabled={testingOllama}
                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    title="Nạp danh sách model từ Ollama"
                  >
                    {testingOllama ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {ollamaTestResult && (
              <p className={`text-xs ${ollamaTestResult.includes('thành công') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {ollamaTestResult}
              </p>
            )}

            {/* Ollama terminal command */}
            <div className="bg-slate-900 text-slate-200 rounded-lg p-3 text-xs font-mono relative">
              <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                <span>Lệnh chạy model trên máy của bạn (nếu dùng Ollama):</span>
                <button
                  type="button"
                  onClick={() => handleCopy(`ollama run ${draftConfig.ollamaModel || 'qwen2.5:7b'}`, 'ollama-cmd')}
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  {copiedCmd === 'ollama-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd === 'ollama-cmd' ? 'Đã copy' : 'Copy'}</span>
                </button>
              </div>
              <code>ollama run {draftConfig.ollamaModel || 'qwen2.5:7b'}</code>
            </div>
          </div>

          {/* 3. Fallback strategy */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-xs text-slate-900 dark:text-white">Tự động chuyển sang Engine dự phòng</p>
              <p className="text-[11px] text-slate-500">Giữ ứng dụng luôn hoạt động mượt mà 100% kể cả khi chưa bật server.</p>
            </div>
            <input
              type="checkbox"
              checked={draftConfig.autoFallback}
              onChange={(e) => setDraftConfig((p) => ({ ...p, autoFallback: e.target.checked }))}
              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            Lưu & Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
}
