'use client';

import React, { useState } from 'react';
import {
  InvoiceDocument,
  InvoiceHeader,
  InvoiceItemRow,
  RecognizedWord,
  HeaderCustomField,
} from '@/types/ocr';
import { numberToVietnameseWords } from '@/lib/table-parser';
import { ExportButtons } from './ExportButtons';
import {
  Plus,
  Trash2,
  Edit3,
  Building,
  Calendar,
  Receipt,
  User,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ScanEye,
  Check,
  AlertCircle,
  Layers,
} from 'lucide-react';

interface EditableReviewTableProps {
  documentData: InvoiceDocument;
  onDocumentChange: (updated: InvoiceDocument) => void;
  processedImagePreview: string;
  recognizedWords?: RecognizedWord[];
}

export function EditableReviewTable({
  documentData,
  onDocumentChange,
  processedImagePreview,
  recognizedWords = [],
}: EditableReviewTableProps) {
  const [showWordsOverlay, setShowWordsOverlay] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeTab, setActiveTab] = useState<'table' | 'header'>('table');
  const [activePreviewPageIndex, setActivePreviewPageIndex] = useState(0);

  const availablePreviews =
    documentData.pagesPreview && documentData.pagesPreview.length > 0
      ? documentData.pagesPreview
      : [processedImagePreview];

  const currentPreviewUrl =
    availablePreviews[activePreviewPageIndex] || processedImagePreview;

  // Helper to trigger state update with recalculated totals
  const updateDocument = (
    headerUpdate?: Partial<InvoiceHeader>,
    itemsUpdate?: InvoiceItemRow[],
    vatRateUpdate?: number
  ) => {
    const nextHeader = headerUpdate
      ? { ...documentData.header, ...headerUpdate }
      : documentData.header;
    const nextItems = itemsUpdate || documentData.items;
    const nextVatRate = vatRateUpdate !== undefined ? vatRateUpdate : documentData.vatRate;

    const subTotal = nextItems.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
    const vatAmount = Math.round((subTotal * nextVatRate) / 100);
    const totalAmount = subTotal + vatAmount;

    onDocumentChange({
      ...documentData,
      header: nextHeader,
      items: nextItems,
      vatRate: nextVatRate,
      subTotal,
      vatAmount,
      totalAmount,
      totalInWords: numberToVietnameseWords(totalAmount),
    });
  };

  // Row operations
  const handleItemCellChange = (
    index: number,
    field: keyof InvoiceItemRow,
    value: string | number
  ) => {
    const updated = [...documentData.items];
    const currentRow = { ...updated[index] };

    if (field === 'quantity' || field === 'unitPrice') {
      const numVal = Math.max(0, Number(value) || 0);
      (currentRow[field] as number) = numVal;
      currentRow.amount = Math.round(currentRow.quantity * currentRow.unitPrice);
    } else if (field === 'amount') {
      const numVal = Math.max(0, Number(value) || 0);
      currentRow.amount = numVal;
      if (currentRow.quantity > 0) {
        currentRow.unitPrice = Math.round(numVal / currentRow.quantity);
      }
    } else {
      (currentRow[field] as any) = value;
    }

    updated[index] = currentRow;
    updateDocument(undefined, updated);
  };

  const handleAddRow = () => {
    const newRow: InvoiceItemRow = {
      id: `item-${Date.now()}`,
      stt: documentData.items.length + 1,
      itemName: 'Hàng hóa / Vật tư mới',
      unit: 'Cái',
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      sourcePage: documentData.pageCount || 1,
    };
    updateDocument(undefined, [...documentData.items, newRow]);
  };

  const handleInsertRowBelow = (index: number) => {
    const currentRow = documentData.items[index];
    const newRow: InvoiceItemRow = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      stt: index + 2,
      itemName: '',
      unit: currentRow?.unit || 'Cái',
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      sourcePage: currentRow?.sourcePage || 1,
    };
    const updated = [
      ...documentData.items.slice(0, index + 1),
      newRow,
      ...documentData.items.slice(index + 1),
    ];
    const reindexed = updated.map((r, i) => ({ ...r, stt: i + 1 }));
    updateDocument(undefined, reindexed);
  };

  const handleDeleteRow = (index: number) => {
    const updated = documentData.items.filter((_, i) => i !== index);
    const reindexed = updated.map((r, i) => ({ ...r, stt: i + 1 }));
    updateDocument(undefined, reindexed);
  };

  const handleCustomFieldChange = (index: number, field: 'label' | 'value', text: string) => {
    const current = documentData.header.customFields ? [...documentData.header.customFields] : [];
    if (current[index]) {
      current[index] = { ...current[index], [field]: text };
      updateDocument({ customFields: current });
    }
  };

  const handleAddCustomField = () => {
    const current = documentData.header.customFields ? [...documentData.header.customFields] : [];
    current.push({ label: 'Thông tin bổ sung', value: '' });
    updateDocument({ customFields: current });
  };

  const handleDeleteCustomField = (index: number) => {
    const current = documentData.header.customFields ? [...documentData.header.customFields] : [];
    const updated = current.filter((_, i) => i !== index);
    updateDocument({ customFields: updated });
  };

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Top Banner & Mode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ScanEye className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight">
                Bảng Số Hóa & Đối Chiếu Dữ Liệu
              </h2>
              {documentData.pageCount && documentData.pageCount > 1 && (
                <span className="text-[10px] font-bold bg-emerald-700/80 text-emerald-100 px-2 py-0.5 rounded-full">
                  Đã hợp nhất từ {documentData.pageCount} trang
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Thông tin chung xuất hiện 1 lần · Toàn bộ {documentData.items.length} mặt hàng gộp chung vào 1 bảng
            </p>
          </div>
        </div>

        {/* Header vs Table Tabs */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('table')}
            className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'table'
                ? 'bg-white text-slate-900 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Bảng Hàng Hóa ({documentData.items.length} dòng)
          </button>
          <button
            onClick={() => setActiveTab('header')}
            className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'header'
                ? 'bg-white text-slate-900 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Thông Tin Chung (Header)
          </button>
        </div>
      </div>

      {/* Main Grid: Left Side Document Preview, Right Side Editable Form/Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* Left Column: Document Image Verification Viewer (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950 p-4 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-300">Ảnh đối chiếu</span>
              {availablePreviews.length > 1 && (
                <div className="flex items-center bg-slate-800 rounded p-0.5 text-[10px]">
                  {availablePreviews.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePreviewPageIndex(idx)}
                      className={`px-2 py-0.5 rounded ${
                        activePreviewPageIndex === idx
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Trang {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.2))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono tabular-nums text-[11px] w-10 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Phóng to"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Đặt lại kích thước chuẩn"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 bg-slate-900 rounded-lg overflow-auto border border-slate-800 flex items-center justify-center p-2 min-h-[360px] max-h-[540px]">
            <div
              className="relative transition-transform duration-150 origin-top"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentPreviewUrl}
                alt="Document Preview"
                className="max-w-full h-auto rounded shadow-lg select-none"
              />

              {showWordsOverlay &&
                recognizedWords.map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      left: `${w.bbox.x0}px`,
                      top: `${w.bbox.y0}px`,
                      width: `${w.bbox.x1 - w.bbox.x0}px`,
                      height: `${w.bbox.y1 - w.bbox.y0}px`,
                    }}
                    className="absolute border border-emerald-400 bg-emerald-400/20 pointer-events-none text-[8px] text-emerald-300 flex items-center overflow-hidden"
                  >
                    {w.confidence > 75 ? '✓' : ''}
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {availablePreviews.length > 1
                ? `Đang xem ảnh Trang ${activePreviewPageIndex + 1} / ${availablePreviews.length}`
                : 'Cuộn chuột hoặc dùng nút zoom để soi chi tiết từng số'}
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={showWordsOverlay}
                onChange={(e) => setShowWordsOverlay(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              <span>Hiển thị Bounding Box</span>
            </label>
          </div>
        </div>

        {/* Right Column: Editable Data Grid & Header (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-white overflow-hidden">
          {activeTab === 'header' ? (
            /* Header Information Form with full fields */
            <div className="p-6 space-y-4 overflow-y-auto max-h-[520px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Loại chứng từ
                  </label>
                  <select
                    value={documentData.header.documentType}
                    onChange={(e) =>
                      updateDocument({
                        documentType: e.target.value as InvoiceHeader['documentType'],
                      })
                    }
                    className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="hoa_don_gtgt">Hóa đơn Giá Trị Gia Tăng (GTGT)</option>
                    <option value="phieu_xuat_kho">Phiếu Xuất Kho</option>
                    <option value="phieu_nhap_kho">Phiếu Nhập Kho</option>
                    <option value="hoa_don_ban_hang">Hóa đơn Bán Hàng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số hóa đơn / Số phiếu
                  </label>
                  <input
                    type="text"
                    value={documentData.header.invoiceNo}
                    onChange={(e) => updateDocument({ invoiceNo: e.target.value })}
                    className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 font-mono tabular-nums focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                    placeholder="VD: 0048912 hoặc XK-2024-001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày tháng năm
                  </label>
                  <input
                    type="text"
                    value={documentData.header.invoiceDate}
                    onChange={(e) => updateDocument({ invoiceDate: e.target.value })}
                    className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 font-mono tabular-nums focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                    placeholder="VD: 18/10/2024"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã số thuế bên bán / phát hành
                  </label>
                  <input
                    type="text"
                    value={documentData.header.sellerTaxCode}
                    onChange={(e) => updateDocument({ sellerTaxCode: e.target.value })}
                    className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 font-mono tabular-nums focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                    placeholder="0108923456"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đơn vị bán / Đơn vị xuất kho
                </label>
                <input
                  type="text"
                  value={documentData.header.sellerName}
                  onChange={(e) => updateDocument({ sellerName: e.target.value })}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  placeholder="Tên công ty phát hành"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Địa chỉ đơn vị bán / xuất
                </label>
                <input
                  type="text"
                  value={documentData.header.sellerAddress}
                  onChange={(e) => updateDocument({ sellerAddress: e.target.value })}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  placeholder="Địa chỉ trụ sở hoặc kho bãi"
                />
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Họ tên người mua / Đơn vị nhận hàng
                    </label>
                    <input
                      type="text"
                      value={documentData.header.buyerName}
                      onChange={(e) => updateDocument({ buyerName: e.target.value })}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="Người mua hoặc đơn vị nhận"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mã số thuế bên mua / nhận
                    </label>
                    <input
                      type="text"
                      value={documentData.header.buyerTaxCode}
                      onChange={(e) => updateDocument({ buyerTaxCode: e.target.value })}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 font-mono tabular-nums focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="MST bên mua (nếu có)"
                    />
                  </div>
                </div>
              </div>

              {/* Extra extracted fields with ':' */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Trường Thông Tin Bóc Tách Bổ Sung (Dấu &quot;:&quot;)
                  </span>
                  <button
                    onClick={handleAddCustomField}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Thêm trường
                  </button>
                </div>

                <div className="space-y-2">
                  {documentData.header.customFields && documentData.header.customFields.length > 0 ? (
                    documentData.header.customFields.map((cf, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={cf.label}
                          onChange={(e) => handleCustomFieldChange(idx, 'label', e.target.value)}
                          className="w-1/3 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg p-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          placeholder="Tên trường (VD: Hình thức TT)"
                        />
                        <span className="text-slate-400 font-bold">:</span>
                        <input
                          type="text"
                          value={cf.value}
                          onChange={(e) => handleCustomFieldChange(idx, 'value', e.target.value)}
                          className="flex-1 text-xs font-medium border border-slate-200 rounded-lg p-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          placeholder="Nội dung"
                        />
                        <button
                          onClick={() => handleDeleteCustomField(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Xóa trường này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      Không có trường tùy biến nào. Bấm &quot;Thêm trường&quot; để bổ sung nếu cần.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Interactive Data Table with Merged Items across All Pages */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="overflow-x-auto flex-1 max-h-[380px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-10">STT</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Tên hàng hóa / Quy cách vật tư</th>
                      <th className="py-2.5 px-2 text-center w-16">ĐVT</th>
                      <th className="py-2.5 px-2 text-right w-20">Số lượng</th>
                      <th className="py-2.5 px-3 text-right w-28">Đơn giá (VNĐ)</th>
                      <th className="py-2.5 px-3 text-right w-32">Thành tiền (VNĐ)</th>
                      <th className="py-2.5 px-2 text-center w-14">Trang</th>
                      <th className="py-2.5 px-2 text-center w-16">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {documentData.items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                          Bảng hàng hóa đang trống. Bấm &quot;Thêm dòng hàng hóa mới&quot; phía dưới để thêm.
                        </td>
                      </tr>
                    ) : (
                      documentData.items.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50/80 transition-colors group">
                        {/* STT */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="text"
                            value={row.stt}
                            onChange={(e) => handleItemCellChange(idx, 'stt', e.target.value)}
                            className="w-full text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden font-mono tabular-nums text-xs"
                          />
                        </td>

                        {/* Item Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.itemName}
                            onChange={(e) => handleItemCellChange(idx, 'itemName', e.target.value)}
                            placeholder="Tên hàng hóa / quy cách..."
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden font-medium text-slate-900 text-xs"
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => handleItemCellChange(idx, 'unit', e.target.value)}
                            className="w-full text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden text-xs"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            value={row.quantity}
                            onChange={(e) => handleItemCellChange(idx, 'quantity', e.target.value)}
                            className="w-full text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden font-mono tabular-nums text-xs"
                          />
                        </td>

                        {/* Unit Price */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            value={row.unitPrice}
                            onChange={(e) => handleItemCellChange(idx, 'unitPrice', e.target.value)}
                            className="w-full text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden font-mono tabular-nums text-xs"
                          />
                        </td>

                        {/* Amount */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            value={row.amount}
                            onChange={(e) => handleItemCellChange(idx, 'amount', e.target.value)}
                            className="w-full text-right font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden font-mono tabular-nums text-xs"
                          />
                        </td>

                        {/* Source Page Badge */}
                        <td className="py-2 px-2 text-center">
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            T.{row.sourcePage || 1}
                          </span>
                        </td>

                        {/* Row Actions: Insert row below (+) & Delete row (trash) */}
                        <td className="py-1 px-1 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleInsertRowBelow(idx)}
                              className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Chèn dòng mới phía dưới dòng này (+)"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(idx)}
                              className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Xóa dòng này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                  </tbody>
                </table>
              </div>

              {/* Add Row Button */}
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <button
                  onClick={handleAddRow}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm dòng hàng hóa mới</span>
                </button>
                <span className="text-[11px] text-slate-500">
                  Tổng {documentData.items.length} mặt hàng
                </span>
              </div>

              {/* Accounting Calculations Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs">
                <div className="flex flex-col gap-1.5 max-w-sm ml-auto font-medium">
                  <div className="flex justify-between text-slate-600">
                    <span>Cộng tiền hàng:</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {documentData.subTotal.toLocaleString('vi-VN')} đ
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <div className="flex items-center gap-2">
                      <span>Thuế suất GTGT:</span>
                      <select
                        value={documentData.vatRate}
                        onChange={(e) => updateDocument(undefined, undefined, Number(e.target.value))}
                        className="p-1 text-xs border border-slate-200 rounded bg-white font-mono"
                      >
                        <option value={0}>0% (Miễn thuế / Phiếu kho)</option>
                        <option value={5}>5%</option>
                        <option value={8}>8% (Nghị quyết kích cầu)</option>
                        <option value={10}>10% (Thuế chuẩn)</option>
                      </select>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {documentData.vatAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>

                  <div className="flex justify-between text-sm font-bold text-emerald-800 pt-1.5 border-t border-slate-200">
                    <span>Tổng cộng thanh toán:</span>
                    <span className="font-mono tabular-nums">
                      {documentData.totalAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                {documentData.totalInWords && (
                  <div className="mt-2 text-[11px] text-slate-500 italic text-right">
                    Số tiền bằng chữ: {documentData.totalInWords}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export suite */}
          <ExportButtons documentData={documentData} />
        </div>
      </div>
    </div>
  );
}
