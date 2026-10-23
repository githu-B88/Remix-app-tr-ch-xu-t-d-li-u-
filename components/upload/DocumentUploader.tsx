'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, Image as ImageIcon, Layers, Plus } from 'lucide-react';
import { renderPdfToImages } from '@/lib/pdf-service';

export interface LoadedPageItem {
  pageNumber: number;
  dataUrl: string;
  name: string;
}

interface DocumentUploaderProps {
  onPagesLoaded: (pages: LoadedPageItem[]) => void;
  onAppendPages?: (pages: LoadedPageItem[]) => void;
  isProcessing: boolean;
}

export function DocumentUploader({
  onPagesLoaded,
  onAppendPages,
  isProcessing,
}: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFileList = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // 1. Check if first file is PDF
    const firstPdf = fileArray.find((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'));

    if (firstPdf) {
      try {
        setLoadingPdf(true);
        const rendered = await renderPdfToImages(firstPdf);
        if (rendered.length > 0) {
          const loadedPages: LoadedPageItem[] = rendered.map((r) => ({
            pageNumber: r.pageNumber,
            dataUrl: r.dataUrl,
            name: `${firstPdf.name} - Trang ${r.pageNumber}`,
          }));
          onPagesLoaded(loadedPages);
        }
      } catch (err) {
        console.error('Lỗi đọc file PDF:', err);
        alert('Không thể đọc file PDF này: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoadingPdf(false);
      }
      return;
    }

    // 2. Otherwise process image files (support uploading multiple images together)
    const imageFiles = fileArray.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      const pagePromises = imageFiles.map((file, idx) => {
        return new Promise<LoadedPageItem>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              resolve({
                pageNumber: idx + 1,
                dataUrl: e.target.result as string,
                name: file.name,
              });
            } else {
              reject(new Error('Lỗi đọc file ảnh ' + file.name));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      try {
        const loadedPages = await Promise.all(pagePromises);
        onPagesLoaded(loadedPages);
      } catch (err) {
        console.error('Lỗi đọc file ảnh:', err);
        alert('Không thể đọc các file ảnh đã chọn.');
      }
    } else {
      alert('Vui lòng chọn tệp PDF hoặc ảnh PNG/JPG.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFileList(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-full space-y-3">
      {/* Drag & Drop Card */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 sm:p-7 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50/70'
            : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processFileList(e.target.files);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center max-w-md mx-auto">
          <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 mb-2.5 shadow-xs">
            <Upload className="w-5 h-5" />
          </div>

          <h3 className="text-sm font-bold text-slate-800 mb-1">
            Chọn hoặc kéo thả hóa đơn, phiếu kho (Hỗ trợ nhiều trang)
          </h3>
          <p className="text-xs text-slate-500 mb-2.5">
            Hỗ trợ file PDF nhiều trang hoặc chọn cùng lúc nhiều ảnh trang 1, trang 2...
          </p>

          <div className="flex items-center gap-2.5 text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" /> PDF đa trang tự động tách
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" /> Tùy chỉnh Crop từng trang
            </span>
            <span>·</span>
            <span className="text-emerald-700 font-semibold">1 Lần bấm OCR gộp bảng</span>
          </div>
        </div>
      </div>

      {loadingPdf && (
        <div className="text-xs text-emerald-700 font-semibold animate-pulse text-center p-2 bg-emerald-50 rounded-lg border border-emerald-200">
          Đang kết xuất các trang PDF với độ phân giải cao 2x DPI...
        </div>
      )}
    </div>
  );
}
