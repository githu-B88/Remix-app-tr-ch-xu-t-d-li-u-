import * as XLSX from 'xlsx';
import { InvoiceDocument } from '@/types/ocr';

/**
 * Exports the structured invoice data to a formatted Excel file (.xlsx)
 */
export function exportInvoiceToExcel(doc: InvoiceDocument, filename?: string): void {
  const isInvoice = doc.header.documentType.includes('hoa_don');
  const title = isInvoice
    ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG (BẢN KÊ CHI TIẾT)'
    : (doc.header.documentType === 'phieu_nhap_kho'
        ? 'BẢNG KÊ PHIẾU NHẬP KHO VẬT TƯ'
        : 'BẢNG KÊ PHIẾU XUẤT KHO VẬT TƯ, HÀNG HÓA');

  const rows: (string | number)[][] = [
    [title],
    [''],
    ['Đơn vị phát hành:', doc.header.sellerName || ''],
    ['Mã số thuế:', doc.header.sellerTaxCode || ''],
    ['Địa chỉ:', doc.header.sellerAddress || ''],
    ['Số chứng từ / Hóa đơn:', doc.header.invoiceNo || '', 'Ngày lập:', doc.header.invoiceDate || ''],
    ['Khách hàng / Người nhận:', doc.header.buyerName || ''],
    ['Mã số thuế khách hàng:', doc.header.buyerTaxCode || ''],
    ['Địa chỉ giao nhận:', doc.header.buyerAddress || ''],
  ];

  if (doc.header.customFields && doc.header.customFields.length > 0) {
    doc.header.customFields.forEach((cf) => {
      rows.push([`${cf.label}:`, cf.value]);
    });
  }

  rows.push(['']);
  // Table Header
  rows.push(['STT', 'Tên hàng hóa, quy cách vật tư', 'ĐVT', 'Số lượng', 'Đơn giá (VNĐ)', 'Thành tiền (VNĐ)']);

  // Table Data Rows
  doc.items.forEach((item, index) => {
    rows.push([
      item.stt || index + 1,
      item.itemName,
      item.unit,
      item.quantity,
      item.unitPrice,
      item.amount,
    ]);
  });

  // Summary Rows
  rows.push(['']);
  rows.push(['', '', '', '', 'Cộng tiền hàng:', doc.subTotal]);
  if (doc.vatRate > 0) {
    rows.push(['', '', '', '', `Thuế GTGT (${doc.vatRate}%):`, doc.vatAmount]);
  }
  rows.push(['', '', '', '', 'TỔNG CỘNG THANH TOÁN:', doc.totalAmount]);
  if (doc.totalInWords) {
    rows.push(['Số tiền viết bằng chữ:', doc.totalInWords]);
  }

  // Create Worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths for optimal reading
  ws['!cols'] = [
    { wch: 8 },  // STT
    { wch: 42 }, // Tên hàng hóa
    { wch: 12 }, // ĐVT
    { wch: 14 }, // Số lượng
    { wch: 18 }, // Đơn giá
    { wch: 22 }, // Thành tiền
  ];

  // Create Workbook & append sheet
  const wb = XLSX.utils.book_new();
  const sheetName = isInvoice ? 'HoaDon' : 'PhieuKho';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Trigger download
  const defaultName = `${doc.header.invoiceNo || 'Bang_ke'}_${sheetName}.xlsx`;
  XLSX.writeFile(wb, filename || defaultName);
}
