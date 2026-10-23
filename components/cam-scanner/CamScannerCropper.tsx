'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CropRect,
  ImageFilterOptions,
} from '@/types/ocr';
import { processImageOnCanvas, loadImageElement } from '@/lib/image-processing';
import {
  RotateCw,
  Crop as CropIcon,
  Sliders,
  Sparkles,
  Zap,
  CheckCircle2,
  RefreshCw,
  Eye,
  Layers,
  Files,
} from 'lucide-react';

interface CamScannerCropperProps {
  imageSource: string; // Data URL or object URL
  initialFilters?: ImageFilterOptions;
  initialCrop?: CropRect | null;
  onStateChange?: (filters: ImageFilterOptions, crop: CropRect | null) => void;
  onProceedToOcr?: (processedCanvas: HTMLCanvasElement, processedDataUrl: string) => void;
  onBatchOcr?: () => void;
  isProcessing: boolean;
  ocrProgress: { status: string; progress: number };
  pageNumber?: number;
  totalPages?: number;
}

export function CamScannerCropper({
  imageSource,
  initialFilters,
  initialCrop,
  onStateChange,
  onProceedToOcr,
  onBatchOcr,
  isProcessing,
  ocrProgress,
  pageNumber = 1,
  totalPages = 1,
}: CamScannerCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  // Filters state (initialized from prop if provided)
  const [filters, setFilters] = useState<ImageFilterOptions>(() => {
    return initialFilters || {
      rotate: 0,
      contrast: 15,
      brightness: 0,
      mode: 'magic',
    };
  });

  // Crop state (initialized from prop if provided)
  const [crop, setCrop] = useState<CropRect | null>(() => initialCrop || null);
  const cropRef = useRef<CropRect | null>(crop);

  useEffect(() => {
    cropRef.current = crop;
  }, [crop]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [initialCropAtDrag, setInitialCropAtDrag] = useState<CropRect | null>(null);

  // Dimensions of canvas stored in state to avoid reading ref in render body
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 1000,
    height: 1400,
  });

  // Scale of canvas inside display container
  const [displayScale, setDisplayScale] = useState(1);
  const [showSliders, setShowSliders] = useState(false);

  // Notify parent of filter & crop changes safely outside active render
  const notifyParent = useCallback(
    (newFilters: ImageFilterOptions, newCrop: CropRect | null) => {
      if (onStateChange) {
        requestAnimationFrame(() => {
          onStateChange(newFilters, newCrop);
        });
      }
    },
    [onStateChange]
  );

  // Load the image into HTMLImageElement
  useEffect(() => {
    let active = true;
    loadImageElement(imageSource)
      .then((img) => {
        if (!active) return;
        setLoadedImage(img);

        // If no initial crop exists, create visual default inset inside cropper
        if (!initialCrop) {
          const insetX = Math.round(img.width * 0.03);
          const insetY = Math.round(img.height * 0.03);
          const defaultCrop = {
            x: insetX,
            y: insetY,
            width: img.width - insetX * 2,
            height: img.height - insetY * 2,
          };
          setCrop(defaultCrop);
        }
      })
      .catch((err) => {
        console.error('Lỗi khi tải ảnh vào cropper:', err);
      });
    return () => {
      active = false;
    };
  }, [imageSource, initialCrop]);

  // Render processed image onto Canvas
  useEffect(() => {
    let isCancelled = false;
    const run = async () => {
      if (!loadedImage || !canvasRef.current) return;

      try {
        const res = await processImageOnCanvas(loadedImage, filters);
        if (isCancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        canvas.width = res.canvas.width;
        canvas.height = res.canvas.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(res.canvas, 0, 0);
        }

        requestAnimationFrame(() => {
          if (!isCancelled) {
            setCanvasDimensions({ width: res.canvas.width, height: res.canvas.height });
            if (containerRef.current) {
              const containerWidth = containerRef.current.clientWidth;
              setDisplayScale(containerWidth / canvas.width);
            }
          }
        });
      } catch (e) {
        console.error('Lỗi render canvas:', e);
      }
    };

    run();
    return () => {
      isCancelled = true;
    };
  }, [loadedImage, filters]);

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    setFilters((prev) => {
      const nextRotate = ((prev.rotate + 90) % 360) as 0 | 90 | 180 | 270;
      let nextCrop = crop;
      if (crop && loadedImage) {
        const isQuarter = nextRotate === 90 || nextRotate === 270;
        const curW = isQuarter ? loadedImage.height : loadedImage.width;
        const curH = isQuarter ? loadedImage.width : loadedImage.height;
        nextCrop = {
          x: Math.round(curW * 0.03),
          y: Math.round(curH * 0.03),
          width: Math.round(curW * 0.94),
          height: Math.round(curH * 0.94),
        };
        setCrop(nextCrop);
      }
      const updatedFilters: ImageFilterOptions = { ...prev, rotate: nextRotate };
      notifyParent(updatedFilters, nextCrop);
      return updatedFilters;
    });
  };

  const handleModeChange = (mode: ImageFilterOptions['mode'], contrast: number) => {
    setFilters((prev) => {
      const updated: ImageFilterOptions = { ...prev, mode, contrast };
      notifyParent(updated, crop);
      return updated;
    });
  };

  const handleResetCrop = () => {
    if (!canvasRef.current) return;
    const fullCrop = {
      x: 0,
      y: 0,
      width: canvasRef.current.width,
      height: canvasRef.current.height,
    };
    setCrop(fullCrop);
    notifyParent(filters, fullCrop);
  };

  // Dragging logic for crop frame
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialCropAtDrag(crop ? { ...crop } : null);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStart || !initialCropAtDrag || !canvasRef.current) return;

      const deltaScreenX = e.clientX - dragStart.x;
      const deltaScreenY = e.clientY - dragStart.y;

      const deltaX = deltaScreenX / (displayScale || 1);
      const deltaY = deltaScreenY / (displayScale || 1);

      const canvasW = canvasRef.current.width;
      const canvasH = canvasRef.current.height;

      let { x, y, width, height } = initialCropAtDrag;

      if (dragHandle === 'move') {
        x = Math.max(0, Math.min(x + deltaX, canvasW - width));
        y = Math.max(0, Math.min(y + deltaY, canvasH - height));
      } else if (dragHandle === 'nw') {
        const newX = Math.max(0, Math.min(x + deltaX, x + width - 30));
        const newY = Math.max(0, Math.min(y + deltaY, y + height - 30));
        width += x - newX;
        height += y - newY;
        x = newX;
        y = newY;
      } else if (dragHandle === 'ne') {
        const newY = Math.max(0, Math.min(y + deltaY, y + height - 30));
        height += y - newY;
        y = newY;
        width = Math.max(30, Math.min(width + deltaX, canvasW - x));
      } else if (dragHandle === 'se') {
        width = Math.max(30, Math.min(width + deltaX, canvasW - x));
        height = Math.max(30, Math.min(height + deltaY, canvasH - y));
      } else if (dragHandle === 'sw') {
        const newX = Math.max(0, Math.min(x + deltaX, x + width - 30));
        width += x - newX;
        x = newX;
        height = Math.max(30, Math.min(height + deltaY, canvasH - y));
      } else if (dragHandle === 'n') {
        const newY = Math.max(0, Math.min(y + deltaY, y + height - 30));
        height += y - newY;
        y = newY;
      } else if (dragHandle === 's') {
        height = Math.max(30, Math.min(height + deltaY, canvasH - y));
      } else if (dragHandle === 'w') {
        const newX = Math.max(0, Math.min(x + deltaX, x + width - 30));
        width += x - newX;
        x = newX;
      } else if (dragHandle === 'e') {
        width = Math.max(30, Math.min(width + deltaX, canvasW - x));
      }

      const updatedCrop = {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      };

      setCrop(updatedCrop);
    },
    [isDragging, dragStart, initialCropAtDrag, dragHandle, displayScale]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragHandle(null);
    setDragStart(null);
    if (cropRef.current) {
      notifyParent(filters, cropRef.current);
    }
  }, [filters, notifyParent]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Execute single-page OCR
  const handleTriggerSingleOcr = async () => {
    if (!loadedImage || !onProceedToOcr) return;

    try {
      const { canvas, dataUrl } = await processImageOnCanvas(loadedImage, filters, crop || undefined);
      onProceedToOcr(canvas, dataUrl);
    } catch (e) {
      console.error('Lỗi cắt ảnh OCR:', e);
    }
  };

  const canvasWidth = canvasDimensions.width || 1000;
  const canvasHeight = canvasDimensions.height || 1400;

  const cropBoxStyle = crop
    ? {
        left: `${(crop.x / canvasWidth) * 100}%`,
        top: `${(crop.y / canvasHeight) * 100}%`,
        width: `${(crop.width / canvasWidth) * 100}%`,
        height: `${(crop.height / canvasHeight) * 100}%`,
      }
    : { left: '3%', top: '3%', width: '94%', height: '94%' };

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* CamScanner Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-slate-50/70">
        {/* Filter Modes */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg">
          <button
            onClick={() => handleModeChange('original', 0)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              filters.mode === 'original'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ảnh gốc
          </button>
          <button
            onClick={() => handleModeChange('magic', 25)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              filters.mode === 'magic'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            CamScanner Magic
          </button>
          <button
            onClick={() => handleModeChange('bw', 30)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              filters.mode === 'bw'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trắng đen B&W
          </button>
          <button
            onClick={() => handleModeChange('high_contrast', 45)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              filters.mode === 'high_contrast'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tương phản cao
          </button>
        </div>

        {/* Action Tools */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            Đang chỉnh: Trang {pageNumber} / {totalPages}
          </span>

          <button
            onClick={handleRotate}
            className="p-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Xoay 90 độ"
          >
            <RotateCw className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Xoay 90°</span>
          </button>

          <button
            onClick={handleResetCrop}
            className="p-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Khôi phục toàn bộ vùng quét trang này"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Trọn trang</span>
          </button>

          <button
            onClick={() => setShowSliders(!showSliders)}
            className={`p-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              showSliders
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span className="hidden sm:inline">Hiệu chỉnh tay</span>
          </button>
        </div>
      </div>

      {/* Manual Fine-Tuning Slider Drawer */}
      {showSliders && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-3 bg-slate-100/70 border-b border-slate-200 text-xs">
          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Độ tương phản (Contrast) - Trang {pageNumber}</span>
              <span className="font-mono tabular-nums">{filters.contrast}</span>
            </div>
            <input
              type="range"
              min="-50"
              max="100"
              value={filters.contrast}
              onChange={(e) => {
                const updated: ImageFilterOptions = { ...filters, contrast: parseInt(e.target.value) };
                setFilters(updated);
                notifyParent(updated, crop);
              }}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Độ sáng (Brightness) - Trang {pageNumber}</span>
              <span className="font-mono tabular-nums">{filters.brightness}</span>
            </div>
            <input
              type="range"
              min="-80"
              max="80"
              value={filters.brightness}
              onChange={(e) => {
                const updated: ImageFilterOptions = { ...filters, brightness: parseInt(e.target.value) };
                setFilters(updated);
                notifyParent(updated, crop);
              }}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Cropper Viewport & Interactive Canvas */}
      <div
        ref={containerRef}
        className="relative bg-slate-900 flex items-center justify-center p-3 select-none overflow-hidden min-h-[460px] max-h-[640px]"
      >
        <div className="relative inline-block max-w-full max-h-full">
          <canvas
            ref={canvasRef}
            className="max-h-[600px] w-auto object-contain block shadow-2xl rounded-xs"
          />

          {crop && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'rgba(0, 0, 0, 0.45)',
                clipPath: `polygon(
                  0% 0%, 0% 100%, 
                  ${(crop.x / canvasWidth) * 100}% 100%, 
                  ${(crop.x / canvasWidth) * 100}% ${(crop.y / canvasHeight) * 100}%, 
                  ${((crop.x + crop.width) / canvasWidth) * 100}% ${(crop.y / canvasHeight) * 100}%, 
                  ${((crop.x + crop.width) / canvasWidth) * 100}% ${((crop.y + crop.height) / canvasHeight) * 100}%, 
                  ${(crop.x / canvasWidth) * 100}% ${((crop.y + crop.height) / canvasHeight) * 100}%, 
                  ${(crop.x / canvasWidth) * 100}% 100%, 
                  100% 100%, 100% 0%
                )`,
              }}
            />
          )}

          <div
            style={cropBoxStyle}
            className="absolute border-2 border-emerald-400 cursor-move transition-shadow shadow-[0_0_0_1px_rgba(255,255,255,0.7)]"
            onMouseDown={(e) => handleMouseDown(e, 'move')}
          >
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
              <div className="border-r border-b border-emerald-300"></div>
              <div className="border-r border-b border-emerald-300"></div>
              <div className="border-b border-emerald-300"></div>
              <div className="border-r border-b border-emerald-300"></div>
              <div className="border-r border-b border-emerald-300"></div>
              <div className="border-b border-emerald-300"></div>
              <div className="border-r border-b border-emerald-300"></div>
              <div className="border-r border-b border-emerald-300"></div>
              <div></div>
            </div>

            <div
              onMouseDown={(e) => handleMouseDown(e, 'nw')}
              className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'ne')}
              className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'se')}
              className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'sw')}
              className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
            />

            <div
              onMouseDown={(e) => handleMouseDown(e, 'n')}
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-emerald-600 rounded-xs cursor-ns-resize shadow-xs"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 's')}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-emerald-600 rounded-xs cursor-ns-resize shadow-xs"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'w')}
              className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-8 bg-white border-2 border-emerald-600 rounded-xs cursor-ew-resize shadow-xs"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'e')}
              className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 bg-white border-2 border-emerald-600 rounded-xs cursor-ew-resize shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Footer with Progress Bar & Multi-page Trigger */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white border-t border-slate-200">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Khung crop & bộ lọc được lưu độc lập cho từng trang</span>
          </div>
        </div>

        {/* OCR Trigger CTA */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isProcessing ? (
            <div className="flex flex-col items-end w-full sm:w-72">
              <div className="flex justify-between w-full text-xs font-semibold text-emerald-800 mb-1">
                <span>{ocrProgress.status}</span>
                <span className="font-mono tabular-nums">{ocrProgress.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div
                  className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, ocrProgress.progress)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {totalPages > 1 && onProceedToOcr && (
                <button
                  onClick={handleTriggerSingleOcr}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
                  title="Chỉ quét riêng trang đang xem"
                >
                  Quét riêng Trang {pageNumber}
                </button>
              )}

              {onBatchOcr ? (
                <button
                  onClick={onBatchOcr}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Files className="w-4 h-4 text-emerald-200" />
                  <span>
                    {totalPages > 1
                      ? `Phân tích OCR Toàn Bộ ${totalPages} Trang (1 Lần Bấm)`
                      : 'Phân tích OCR Ngay'}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleTriggerSingleOcr}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Zap className="w-4 h-4 text-emerald-200 fill-current" />
                  <span>Phân tích OCR Ngay</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
