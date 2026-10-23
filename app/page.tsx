'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { EngineStatusBar } from '@/components/engine/EngineStatusBar';
import { EngineSettingsModal } from '@/components/engine/EngineSettingsModal';
import { DocumentUploader, LoadedPageItem } from '@/components/upload/DocumentUploader';
import { SampleDocumentSelector } from '@/components/samples/SampleDocumentSelector';
import { CamScannerCropper } from '@/components/cam-scanner/CamScannerCropper';
import { EditableReviewTable } from '@/components/review/EditableReviewTable';
import { SAMPLE_DOCUMENTS, SampleDocPreset } from '@/lib/sample-documents';
import { mergeMultiPageDocuments } from '@/lib/table-parser';
import {
  DEFAULT_ENGINE_CONFIG,
  loadEngineConfig,
  saveEngineConfig,
  checkEngineHealth,
} from '@/lib/engine-config';
import { executePagePipeline, PipelineProgressUpdate } from '@/lib/pipeline-service';
import {
  CropRect,
  DocumentPage,
  EngineConfig,
  EngineStatus,
  ImageFilterOptions,
  InvoiceDocument,
  RecognizedWord,
} from '@/types/ocr';
import {
  FileCheck,
  ShieldCheck,
  Table as TableIcon,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  ArrowRight,
  ScanText,
  Layers,
  Check,
  Files,
  Plus,
  Cpu,
  AlertCircle,
} from 'lucide-react';

export default function HomePage() {
  // Multi-page document state
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [selectedSampleId, setSelectedSampleId] = useState<string>('');

  // Engine configuration and status
  const [engineConfig, setEngineConfig] = useState<EngineConfig>(DEFAULT_ENGINE_CONFIG);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({
    pythonBackendOnline: false,
    openCvReady: false,
    paddleOcrReady: false,
    ollamaOnline: false,
    ollamaModels: [],
    activePipelineDescription: 'Đang khởi tạo...',
  });
  const [isCheckingEngine, setIsCheckingEngine] = useState<boolean>(false);
  const [isEngineSettingsOpen, setIsEngineSettingsOpen] = useState<boolean>(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<{
    status: string;
    progress: number;
    stage?: string;
  }>({
    status: 'Sẵn sàng',
    progress: 0,
    stage: '',
  });

  // Processed results
  const [processedPreview, setProcessedPreview] = useState<string>('');
  const [recognizedWords, setRecognizedWords] = useState<RecognizedWord[]>([]);
  const [documentData, setDocumentData] = useState<InvoiceDocument | null>(null);

  // Sample modal open/close
  const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);
  const [ocrErrorMessage, setOcrErrorMessage] = useState<string | null>(null);

  // Active step in workflow
  const [activeStep, setActiveStep] = useState<'upload_and_crop' | 'review'>('upload_and_crop');

  // Load stored engine config asynchronously after initial client mount to avoid hydration mismatch
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const saved = loadEngineConfig();
      if (saved) {
        setEngineConfig(saved);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Check engine health
  const refreshEngineHealth = useCallback(async (cfg?: EngineConfig) => {
    setIsCheckingEngine(true);
    try {
      const status = await checkEngineHealth(cfg || engineConfig);
      setEngineStatus(status);
    } finally {
      setIsCheckingEngine(false);
    }
  }, [engineConfig]);

  useEffect(() => {
    let isMounted = true;
    checkEngineHealth(engineConfig).then((status) => {
      if (isMounted) {
        setEngineStatus(status);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [engineConfig]);

  // Handle saving new engine config
  const handleSaveEngineConfig = (newCfg: EngineConfig) => {
    setEngineConfig(newCfg);
    saveEngineConfig(newCfg);
    refreshEngineHealth(newCfg);
  };

  // Handle selecting a sample document preset
  const handleSelectSample = (preset: SampleDocPreset) => {
    const generated = preset.generatePages();
    const docPages: DocumentPage[] = generated.map((p, idx) => ({
      id: `sample-page-${idx + 1}-${Date.now()}`,
      pageNumber: p.pageNumber,
      name: `${preset.name} - Trang ${p.pageNumber}`,
      dataUrl: p.dataUrl,
      width: 1200,
      height: 1600,
      filters: { rotate: 0, contrast: 15, brightness: 0, mode: 'magic' },
      crop: null,
      isIncluded: true,
    }));

    setPages(docPages);
    setActivePageIndex(0);
    setCurrentFileName(preset.name);
    setSelectedSampleId(preset.id);
    setDocumentData(null);
    setProcessedPreview('');
    setRecognizedWords([]);
    setActiveStep('upload_and_crop');
    setIsSampleModalOpen(false);
  };

  // Load first sample document automatically on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const firstSample = SAMPLE_DOCUMENTS[0];
      if (firstSample) {
        handleSelectSample(firstSample);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle uploaded pages from PDF or multiple images
  const handlePagesLoaded = (loaded: LoadedPageItem[]) => {
    const docPages: DocumentPage[] = loaded.map((p, idx) => ({
      id: `upload-page-${idx + 1}-${Date.now()}`,
      pageNumber: p.pageNumber,
      name: p.name,
      dataUrl: p.dataUrl,
      width: 1200,
      height: 1600,
      filters: { rotate: 0, contrast: 15, brightness: 0, mode: 'magic' },
      crop: null,
      isIncluded: true,
    }));

    setPages(docPages);
    setActivePageIndex(0);
    setCurrentFileName(loaded[0]?.name || 'Tài liệu tải lên');
    setSelectedSampleId('');
    setDocumentData(null);
    setProcessedPreview('');
    setRecognizedWords([]);
    setActiveStep('upload_and_crop');
  };

  // Save per-page custom filters and crop box
  const handlePageConfigChange = useCallback((filters: ImageFilterOptions, crop: CropRect | null) => {
    setPages((prev) => {
      if (!prev[activePageIndex]) return prev;
      const copy = [...prev];
      copy[activePageIndex] = {
        ...copy[activePageIndex],
        filters,
        crop,
      };
      return copy;
    });
  }, [activePageIndex]);

  // 1-Click BATCH OCR for ALL Pages with OpenCV + PaddleOCR + Ollama pipeline
  const handleBatchOcr = async () => {
    if (pages.length === 0) return;

    try {
      setIsProcessing(true);
      const total = pages.length;
      const pageResults: { doc: InvoiceDocument; pageNumber: number; previewUrl: string }[] = [];
      const allWords: RecognizedWord[] = [];

      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const pageBaseProgress = Math.round((i / total) * 100);
        const pageSpan = Math.round(100 / total);

        const pageRes = await executePagePipeline(p, engineConfig, (update: PipelineProgressUpdate) => {
          const currentProgress = pageBaseProgress + Math.round((update.progress / 100) * pageSpan);
          setOcrProgress({
            status: `Trang ${p.pageNumber}/${total}: ${update.status}`,
            progress: Math.min(99, currentProgress),
            stage: update.engineStage,
          });
        });

        allWords.push(...pageRes.words);
        pageResults.push({
          doc: pageRes.doc,
          pageNumber: pageRes.pageNumber,
          previewUrl: pageRes.previewUrl,
        });
      }

      setOcrProgress({
        status: 'Đang hợp nhất bảng dữ liệu các trang và chuẩn hóa kế toán...',
        progress: 98,
        stage: 'done',
      });

      // Merge multi-page document: Page 1 Header used once, all items aggregated & reindexed
      const merged = mergeMultiPageDocuments(pageResults);

      setDocumentData(merged);
      setRecognizedWords(allWords);
      setProcessedPreview(pageResults[0]?.previewUrl || '');
      setActiveStep('review');
    } catch (err) {
      console.error('Lỗi khi phân tích OCR:', err);
      setOcrErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Single-page OCR for current active page
  const handleProceedSinglePageOcr = async (
    _processedCanvas: HTMLCanvasElement,
    _processedDataUrl: string
  ) => {
    const pageToProcess = pages[activePageIndex] || pages[0];
    if (!pageToProcess) return;

    try {
      setIsProcessing(true);
      setOcrProgress({ status: 'Bắt đầu xử lý pipeline...', progress: 10, stage: 'start' });

      const pageRes = await executePagePipeline(pageToProcess, engineConfig, (update) => {
        setOcrProgress({
          status: update.status,
          progress: update.progress,
          stage: update.engineStage,
        });
      });

      setRecognizedWords(pageRes.words);
      setProcessedPreview(pageRes.previewUrl);

      setDocumentData({
        ...pageRes.doc,
        pagesPreview: [pageRes.previewUrl],
      });
      setActiveStep('review');
    } catch (err) {
      console.error('Lỗi OCR đơn trang:', err);
      setOcrErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetToUpload = () => {
    setActiveStep('upload_and_crop');
    setDocumentData(null);
    setProcessedPreview('');
    setRecognizedWords([]);
  };

  const activePage = pages[activePageIndex] || pages[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 3-Zone Header Contract */}
      <Header
        onReset={() => {
          setActiveStep('upload_and_crop');
          setDocumentData(null);
        }}
        onOpenSampleModal={() => setIsSampleModalOpen(true)}
        onOpenEngineSettings={() => setIsEngineSettingsOpen(true)}
      />

      {/* AI Pipeline Architecture Status Bar */}
      <EngineStatusBar
        config={engineConfig}
        status={engineStatus}
        isChecking={isCheckingEngine}
        onRefreshStatus={() => refreshEngineHealth()}
        onOpenSettings={() => setIsEngineSettingsOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">Pipeline Công Nghệ:</span>
            <span>OpenCV (Tiền xử lý)</span>
            <span aria-hidden="true">·</span>
            <span>PaddleOCR (Nhận dạng tiếng Việt)</span>
            <span aria-hidden="true">·</span>
            <span>Ollama LLM (Hậu kỳ & Chuẩn hóa)</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Số Hóa Hóa Đơn & Phiếu Kho Chuyên Nghiệp
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 max-w-3xl leading-relaxed">
                Tự do căn chỉnh khung cắt cúp CamScanner cho từng trang riêng biệt.
                Hệ thống tự động khử nghiêng bằng OpenCV, trích xuất chữ bằng PaddleOCR và dùng Ollama chuẩn hóa số liệu kế toán thành một bảng chung.
              </p>
            </div>

            {/* Quick Engine Status Action */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsEngineSettingsOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs hover:bg-slate-50 transition-colors text-left cursor-pointer flex items-center gap-2"
              >
                <Cpu className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="flex flex-col">
                  <span className="block font-bold text-slate-900">Mô hình AI: {engineConfig.ollamaModel}</span>
                  <span className="text-[11px] text-slate-500">Bấm để đổi endpoint / model</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Step Indicator Tabs */}
        <div className="flex items-center border-b border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveStep('upload_and_crop')}
            className={`pb-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeStep === 'upload_and_crop'
                ? 'border-indigo-600 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold">
              1
            </span>
            <span>Căn chỉnh trang & Cắt ảnh ({pages.length} trang)</span>
          </button>

          <button
            onClick={() => {
              if (documentData) setActiveStep('review');
            }}
            disabled={!documentData}
            className={`pb-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeStep === 'review'
                ? 'border-indigo-600 text-indigo-900 font-bold'
                : documentData
                ? 'border-transparent text-slate-500 hover:text-slate-800 cursor-pointer'
                : 'border-transparent text-slate-300 cursor-not-allowed'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold">
              2
            </span>
            <span>Bảng số hóa & Xuất file ({documentData ? `${documentData.items.length} mục` : 'Chưa quét'})</span>
          </button>
        </div>

        {/* WORKSPACE VIEW 1: Multi-Page CamScanner Studio */}
        {activeStep === 'upload_and_crop' && (
          <div className="space-y-6">
            {/* Top row: Sample Document Presets */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Kho Tài Liệu Mẫu Kế Toán Việt Nam (Thử Nghiệm Tức Thì)
                  </h3>
                </div>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Hóa đơn GTGT, Phiếu xuất kho 1 trang & 3 trang liên tiếp
                </span>
              </div>
              <SampleDocumentSelector
                onSelectSample={handleSelectSample}
                selectedId={selectedSampleId}
              />
            </div>

            {/* Document Uploader */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
              <DocumentUploader
                onPagesLoaded={handlePagesLoaded}
                isProcessing={isProcessing}
              />
            </div>

            {/* Multi-Page Management Strip & Batch Action */}
            {pages.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                      <Files className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Danh Sách Trang Tài Liệu ({pages.length} trang)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Bấm vào từng trang bên dưới để căn chỉnh góc cúp riêng trước khi bấm quét.
                      </p>
                    </div>
                  </div>

                  {/* Batch OCR Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBatchOcr}
                      disabled={isProcessing}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang Chạy Pipeline...</span>
                        </>
                      ) : (
                        <>
                          <ScanText className="w-4 h-4" />
                          <span>Quét Toàn Bộ {pages.length} Trang (OpenCV · PaddleOCR · Ollama)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Horizontal thumbnail selector for pages */}
                <div className="flex items-center gap-3 overflow-x-auto py-2">
                  {pages.map((p, idx) => {
                    const isActive = idx === activePageIndex;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setActivePageIndex(idx)}
                        className={`group relative flex-shrink-0 w-24 sm:w-28 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          isActive
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <span className="aspect-[3/4] w-full rounded bg-white overflow-hidden border border-slate-200 relative mb-1.5 flex items-center justify-center block">
                          {/* Thumbnail preview */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.dataUrl}
                            alt={p.name}
                            className="object-cover w-full h-full"
                          />
                          <span className="absolute top-1 left-1 bg-slate-900/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            Trang {p.pageNumber}
                          </span>
                        </span>
                        <span className="text-[11px] font-medium text-slate-700 truncate block">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {p.crop ? 'Đã cắt cúp' : 'Toàn trang'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Page Cropper & Filter Adjuster */}
            {activePage && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Đang biên tập:
                    </span>
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {activePage.name} (Trang {activePage.pageNumber}/{pages.length})
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Kéo 8 điểm neo để chọn vùng bảng biểu và loại bỏ nền thừa
                  </span>
                </div>

                <CamScannerCropper
                  key={activePage.id}
                  imageSource={activePage.dataUrl}
                  initialFilters={activePage.filters}
                  initialCrop={activePage.crop}
                  onStateChange={handlePageConfigChange}
                  onProceedToOcr={handleProceedSinglePageOcr}
                  onBatchOcr={handleBatchOcr}
                  isProcessing={isProcessing}
                  ocrProgress={ocrProgress}
                  pageNumber={activePage.pageNumber}
                  totalPages={pages.length}
                />
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE VIEW 2: Data Review & Export */}
        {activeStep === 'review' && documentData && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Bảng Đối Soát Hóa Đơn / Phiếu Kho Hoàn Chỉnh
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tổng hợp từ {pages.length} trang · Chỉnh sửa trực tiếp trên bảng · Xuất Excel / Word
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetToUpload}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Quay lại cắt cúp trang
                </button>
                <button
                  onClick={handleBatchOcr}
                  disabled={isProcessing}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                  Quét lại toàn bộ
                </button>
              </div>
            </div>

            <EditableReviewTable
              documentData={documentData}
              onDocumentChange={(updated) => setDocumentData(updated)}
              processedImagePreview={processedPreview}
              recognizedWords={recognizedWords}
            />
          </div>
        )}

        {/* Processing Progress Overlay */}
        {isProcessing && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Đang Trích Xuất AI Pipeline
                  </h3>
                  <p className="text-xs text-slate-500">
                    OpenCV · PaddleOCR · Ollama Post-Processing
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span className="truncate pr-2 font-mono text-[11px]">{ocrProgress.status}</span>
                  <span className="font-mono tabular-nums">{ocrProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${ocrProgress.progress}%` }}
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Tiền xử lý ảnh:</span>
                  <span className="font-medium text-slate-700">OpenCV (Deskew + CLAHE + Denoise)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Đọc ký tự:</span>
                  <span className="font-medium text-slate-700">PaddleOCR Tiếng Việt (Deep Learning)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Hậu kỳ cấu trúc:</span>
                  <span className="font-medium text-indigo-600 font-mono">{engineConfig.ollamaModel}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature Highlights Bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 mb-2.5">
              <Cpu className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm mb-1">
              1. OpenCV Tiền Xử Lý Ảnh
            </h4>
            <p className="text-slate-600 text-xs leading-relaxed">
              Tự động nắn góc nghiêng (deskew), xóa bóng mờ cục bộ và cân bằng độ tương phản CLAHE giúp tài liệu mờ nhòe trở nên sắc nét.
            </p>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 mb-2.5">
              <ScanText className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm mb-1">
              2. PaddleOCR Nhận Dạng Tiếng Việt
            </h4>
            <p className="text-slate-600 text-xs leading-relaxed">
              Mô hình Deep Learning phát hiện vị trí từng dòng và ký tự với độ chính xác cao, bóc tách bảng kê nhiều trang mượt mà.
            </p>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 mb-2.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm mb-1">
              3. Ollama LLM Xử Lý Hậu Kỳ
            </h4>
            <p className="text-slate-600 text-xs leading-relaxed">
              Sửa lỗi chính tả OCR, chuẩn hóa bảng danh sách hàng hóa và đối soát số học (Số lượng × Đơn giá = Thành tiền) chuẩn xác.
            </p>
          </div>
        </div>
      </main>

      {/* Engine Settings Modal */}
      <EngineSettingsModal
        isOpen={isEngineSettingsOpen}
        onClose={() => setIsEngineSettingsOpen(false)}
        config={engineConfig}
        status={engineStatus}
        onSave={handleSaveEngineConfig}
        onRefreshStatus={() => refreshEngineHealth()}
      />

      {/* Modal Quick Pick Samples if clicked from Header */}
      {isSampleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Chọn Tài Liệu Kế Toán Mẫu Để Thử Nghiệm
              </h3>
              <button
                onClick={() => setIsSampleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <SampleDocumentSelector
              onSelectSample={handleSelectSample}
              selectedId={selectedSampleId}
            />

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsSampleModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PaddleOCR Backend Connection / Error Modal */}
      {ocrErrorMessage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Chưa Kết Nối PaddleOCR Backend
                </h3>
                <p className="text-xs text-slate-500">
                  Hệ thống sử dụng thuần túy mô hình Deep Learning PaddleOCR
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed font-mono">
              {ocrErrorMessage}
            </div>

            <div className="bg-slate-900 text-slate-200 rounded-lg p-3 text-xs font-mono space-y-1.5">
              <span className="text-[11px] text-slate-400 block font-sans">
                Khởi động backend trên máy của bạn với lệnh sau:
              </span>
              <code>cd python_service && pip install -r requirements.txt && python3 main.py</code>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setOcrErrorMessage(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setOcrErrorMessage(null);
                  setIsEngineSettingsOpen(true);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                Cấu hình Endpoint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <span>VietOCR ScanDoc Pro · Pipeline OpenCV, PaddleOCR & Ollama Hậu kỳ thông minh</span>
      </footer>
    </div>
  );
}
