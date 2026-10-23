import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  Packer,
} from 'docx';
import { InvoiceDocument } from '@/types/ocr';

export interface WordExportOptions {
  orientation?: 'portrait' | 'landscape';
  filename?: string;
}

/**
 * Generates an official Vietnamese accounting A4 document (.docx)
 * with National Motto, Header Info, Detailed Table Grid, and Signature blocks.
 */
export async function exportInvoiceToWord(
  doc: InvoiceDocument,
  options: WordExportOptions = {}
): Promise<void> {
  const orientation = options.orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT;
  const isInvoice = doc.header.documentType.includes('hoa_don');

  let docTitle = 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG';
  if (doc.header.documentType === 'phieu_xuat_kho') {
    docTitle = 'PHIẾU XUẤT KHO';
  } else if (doc.header.documentType === 'phieu_nhap_kho') {
    docTitle = 'PHIẾU NHẬP KHO';
  } else if (doc.header.documentType === 'hoa_don_ban_hang') {
    docTitle = 'HÓA ĐƠN BÁN HÀNG';
  }

  // 1. Table Header Row
  const tableHeaderRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    height: { value: 500, rule: HeightRule.ATLEAST },
    children: [
      createHeaderCell('STT', 8),
      createHeaderCell('Tên hàng hóa, quy cách vật tư', 38),
      createHeaderCell('ĐVT', 10),
      createHeaderCell('Số lượng', 12),
      createHeaderCell('Đơn giá (VNĐ)', 16),
      createHeaderCell('Thành tiền (VNĐ)', 16),
    ],
  });

  // 2. Data Rows
  const tableDataRows = doc.items.map((item, idx) => {
    return new TableRow({
      cantSplit: true,
      children: [
        createDataCell(String(item.stt || idx + 1), 8, AlignmentType.CENTER),
        createDataCell(item.itemName, 38, AlignmentType.LEFT),
        createDataCell(item.unit, 10, AlignmentType.CENTER),
        createDataCell(item.quantity.toLocaleString('vi-VN'), 12, AlignmentType.RIGHT),
        createDataCell(item.unitPrice.toLocaleString('vi-VN'), 16, AlignmentType.RIGHT),
        createDataCell(item.amount.toLocaleString('vi-VN'), 16, AlignmentType.RIGHT),
      ],
    });
  });

  // 3. Summary Row
  const summaryRows = [
    new TableRow({
      children: [
        createSummaryCell('Cộng tiền hàng:', 84),
        createDataCell(doc.subTotal.toLocaleString('vi-VN') + ' đ', 16, AlignmentType.RIGHT, true),
      ],
    }),
  ];

  if (doc.vatRate > 0) {
    summaryRows.push(
      new TableRow({
        children: [
          createSummaryCell(`Tiền thuế GTGT (${doc.vatRate}%):`, 84),
          createDataCell(doc.vatAmount.toLocaleString('vi-VN') + ' đ', 16, AlignmentType.RIGHT, true),
        ],
      })
    );
  }

  summaryRows.push(
    new TableRow({
      children: [
        createSummaryCell('TỔNG CỘNG THANH TOÁN:', 84, true),
        createDataCell(doc.totalAmount.toLocaleString('vi-VN') + ' đ', 16, AlignmentType.RIGHT, true),
      ],
    })
  );

  const mainTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...tableDataRows, ...summaryRows],
  });

  // Document Construction
  const wordDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation,
            },
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000,
            },
          },
        },
        children: [
          // National Header
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 22 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', bold: true, underline: {}, size: 20 }),
            ],
          }),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
            children: [
              new TextRun({ text: docTitle, bold: true, size: 28, color: '1A365D' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 250 },
            children: [
              new TextRun({
                text: `Ngày ${doc.header.invoiceDate || '...../...../202...'}   -   Số: ${doc.header.invoiceNo || '...........'}`,
                italics: true,
                size: 20,
              }),
            ],
          }),

          // Metadata block
          new Paragraph({
            spacing: { line: 280 },
            children: [
              new TextRun({ text: 'Đơn vị bán / xuất kho: ', bold: true, size: 20 }),
              new TextRun({ text: doc.header.sellerName || '................................................', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { line: 280 },
            children: [
              new TextRun({ text: 'Mã số thuế: ', bold: true, size: 20 }),
              new TextRun({ text: doc.header.sellerTaxCode || '................................................', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { line: 280 },
            children: [
              new TextRun({ text: 'Địa chỉ: ', bold: true, size: 20 }),
              new TextRun({ text: doc.header.sellerAddress || '................................................', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { line: 280 },
            children: [
              new TextRun({ text: 'Khách hàng / Người nhận: ', bold: true, size: 20 }),
              new TextRun({ text: doc.header.buyerName || '................................................', size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { line: 280, after: 200 },
            children: [
              new TextRun({ text: 'Mã số thuế khách hàng: ', bold: true, size: 20 }),
              new TextRun({ text: doc.header.buyerTaxCode || '................................................', size: 20 }),
            ],
          }),

          ...(doc.header.customFields || []).map(
            (cf) =>
              new Paragraph({
                spacing: { line: 280 },
                children: [
                  new TextRun({ text: `${cf.label}: `, bold: true, size: 20 }),
                  new TextRun({ text: cf.value || '................................................', size: 20 }),
                ],
              })
          ),

          // Detail Table
          mainTable,

          // Total in words
          new Paragraph({
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({ text: 'Số tiền viết bằng chữ: ', bold: true, italics: true, size: 20 }),
              new TextRun({ text: doc.totalInWords || '................................................', italics: true, size: 20 }),
            ],
          }),

          // Signatures table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  createSignatureCell('Người lập biểu', '(Ký, họ tên)'),
                  createSignatureCell('Người nhận hàng', '(Ký, họ tên)'),
                  createSignatureCell('Thủ kho', '(Ký, họ tên)'),
                  createSignatureCell('Thủ trưởng đơn vị', '(Ký, đóng dấu)'),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(wordDoc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const defName = `${doc.header.invoiceNo || 'Chung_tu'}_A4.docx`;
  a.download = options.filename || defName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function createHeaderCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: 'F1F5F9' },
    margins: { top: 120, bottom: 120, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 18 })],
      }),
    ],
  });
}

function createDataCell(
  text: string,
  widthPercent: number,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  bold = false
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, size: 18, bold })],
      }),
    ],
  });
}

function createSummaryCell(text: string, widthPercent: number, bold = false): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    columnSpan: 5,
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text, bold, size: 18 })],
      }),
    ],
  });
}

function createSignatureCell(title: string, sub: string): TableCell {
  return new TableCell({
    width: { size: 25, type: WidthType.PERCENTAGE },
    margins: { top: 150, bottom: 150 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: title, bold: true, size: 19 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: sub, italics: true, size: 16 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 800 },
        children: [new TextRun({ text: '', size: 18 })],
      }),
    ],
  });
}
