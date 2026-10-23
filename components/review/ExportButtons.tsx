'use client';

import React, { useState } from 'react';
import { InvoiceDocument } from '@/types/ocr';
import { exportInvoiceToExcel } from '@/lib/export-excel';
import { exportInvoiceToWord } from '@/lib/export-word';
import { FileSpreadsheet, FileText, Check, Download, AlignHorizontalDistributeCenter } from 'lucide-react';

interface ExportButtonsProps {
  documentData: InvoiceDocument;
}

export function ExportButtons({ documentData }: ExportButtonsProps) {
  const [wordOrientation, setWordOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [excelExporting, setExcelExporting] = useState(false);
  const [wordExporting, setWordExporting] = useState(false);
  const [successExport, setSuccessExport] = useState<string | null>(null);

  const handleExportExcel = () => {
    try {
      setExcelExporting(true);
      exportInvoiceToExcel(documentData);
      setSuccessExport('excel');
      setTimeout(() => setSuccessExport(null), 3000);
    } catch (err) {
      console.error('Lỗi xuất Excel:', err);
      alert('Không thể xuất Excel: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExcelExporting(false);
    }
  };

  const handleExportWord = async () => {
    try {
      setWordExporting(true);
      await exportInvoiceToWord(documentData, { orientation: wordOrientation });
      setSuccessExport('word');
      setTimeout(() => setSuccessExport(null), 3000);
    } catch (err) {
      console.error('Lỗi xuất Word:', err);
      alert('Không thể xuất Word: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setWordExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 border-t border-slate-200 rounded-b-xl">
      {/* Orientation Selector for Word */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">Khổ Word:</span>
        <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium">
          <button
            onClick={() => setWordOrientation('portrait')}
            className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              wordOrientation === 'portrait'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Khổ dọc Portrait (Mặc định)
          </button>
          <button
            onClick={() => setWordOrientation('landscape')}
            className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              wordOrientation === 'landscape'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Khổ ngang Landscape
          </button>
        </div>
      </div>

      {/* Main Export Action CTAs */}
      <div className="flex items-center gap-3">
        {/* Excel Button */}
        <button
          onClick={handleExportExcel}
          disabled={excelExporting}
          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg shadow-sm transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          {successExport === 'excel' ? (
            <Check className="w-4 h-4 text-emerald-200" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
          )}
          <span>{excelExporting ? 'Đang tạo Excel...' : 'Xuất Excel (.xlsx)'}</span>
        </button>

        {/* Word Button */}
        <button
          onClick={handleExportWord}
          disabled={wordExporting}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg shadow-sm transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          {successExport === 'word' ? (
            <Check className="w-4 h-4 text-blue-200" />
          ) : (
            <FileText className="w-4 h-4 text-blue-200" />
          )}
          <span>{wordExporting ? 'Đang tạo Word...' : 'Xuất Word (.docx)'}</span>
        </button>
      </div>
    </div>
  );
}
