'use client';

import React from 'react';
import { SAMPLE_DOCUMENTS, SampleDocPreset } from '@/lib/sample-documents';
import { Sparkles, FileText, CheckCircle2, ArrowRight } from 'lucide-react';

interface SampleDocumentSelectorProps {
  onSelectSample: (preset: SampleDocPreset) => void;
  selectedId?: string;
}

export function SampleDocumentSelector({
  onSelectSample,
  selectedId,
}: SampleDocumentSelectorProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Tài Liệu Mẫu Chuẩn Kế Toán (Thử Nghiệm Nhanh)
          </h3>
        </div>
        <span className="text-xs text-slate-500">
          Chọn 1 mẫu để kiểm tra tính năng trích xuất tức thì
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SAMPLE_DOCUMENTS.map((doc) => {
          const isSelected = selectedId === doc.id;
          return (
            <div
              key={doc.id}
              onClick={() => onSelectSample(doc)}
              className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-500 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                    {doc.badge}
                  </span>
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                  )}
                </div>
                <h4 className="text-xs font-bold text-slate-900 leading-snug">
                  {doc.name}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                  {doc.subtitle}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-medium">
                <span>Nạp tài liệu mẫu</span>
                <span>→</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
