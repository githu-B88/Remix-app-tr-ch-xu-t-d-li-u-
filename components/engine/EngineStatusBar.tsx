'use client';

import React from 'react';
import { EngineConfig, EngineStatus } from '@/types/ocr';
import { Sliders, Cpu, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Terminal } from 'lucide-react';

interface EngineStatusBarProps {
  config: EngineConfig;
  status: EngineStatus;
  isChecking: boolean;
  onRefreshStatus: () => void;
  onOpenSettings: () => void;
}

export function EngineStatusBar({
  config,
  status,
  isChecking,
  onRefreshStatus,
  onOpenSettings,
}: EngineStatusBarProps) {
  const isPythonOk = status.pythonBackendOnline;
  const isOllamaOk = status.ollamaOnline;

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-200 px-4 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Engine Architecture Status */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Pipeline:</span>
          </div>

          {/* OpenCV Status */}
          <div className="flex items-center gap-1 text-slate-400">
            <span className={isPythonOk ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
              OpenCV {isPythonOk ? '(Sẵn sàng)' : '(Chờ backend)'}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
          </div>

          {/* PaddleOCR Status */}
          <div className="flex items-center gap-1 text-slate-400">
            <span className={isPythonOk && status.paddleOcrReady ? 'text-emerald-400 font-medium' : isPythonOk ? 'text-amber-400 font-medium' : 'text-rose-400 font-medium'}>
              PaddleOCR {isPythonOk && status.paddleOcrReady ? '(Sẵn sàng)' : isPythonOk ? '(Đang nạp model)' : '(Chưa kết nối)'}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
          </div>

          {/* Ollama Status */}
          <div className="flex items-center gap-1 text-slate-400">
            <span className={isOllamaOk ? 'text-indigo-400 font-medium' : 'text-slate-400'}>
              Ollama {isOllamaOk ? `(${config.ollamaModel})` : '(Chưa bật)'}
            </span>
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshStatus}
            disabled={isChecking}
            title="Kiểm tra lại trạng thái kết nối"
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Kiểm tra</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors cursor-pointer shadow-sm"
          >
            <Sliders className="w-3 h-3" />
            <span>Cấu hình AI Engine</span>
          </button>
        </div>
      </div>
    </div>
  );
}
