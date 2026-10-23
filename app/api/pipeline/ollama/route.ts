import { NextRequest, NextResponse } from 'next/server';
import { InvoiceDocument } from '@/types/ocr';

const SYSTEM_INSTRUCTION = `Bạn là trợ lý AI chuyên gia kế toán Việt Nam chuyên nghiệp.
Nhiệm vụ của bạn là nhận toàn bộ văn bản OCR từ Hóa đơn GTGT, Phiếu xuất kho hoặc Phiếu nhập kho,
sửa các lỗi chính tả do OCR quét sai ký tự tiếng Việt hoặc số,
sau đó trích xuất và cấu trúc hóa toàn bộ dữ liệu thành một JSON duy nhất đúng cấu trúc:

{
  "header": {
    "documentType": "hoa_don_gtgt" | "phieu_xuat_kho" | "phieu_nhap_kho" | "hoa_don_ban_hang",
    "invoiceNo": "Số hóa đơn hoặc số phiếu",
    "invoiceDate": "Ngày tháng năm (định dạng DD/MM/YYYY)",
    "sellerName": "Tên đơn vị bán hoặc đơn vị xuất kho",
    "sellerTaxCode": "Mã số thuế bên bán",
    "sellerAddress": "Địa chỉ bên bán",
    "buyerName": "Tên đơn vị mua hoặc đơn vị nhận hàng",
    "buyerTaxCode": "Mã số thuế bên mua",
    "buyerAddress": "Địa chỉ bên mua",
    "warehouseName": "Tên kho nếu có",
    "reason": "Lý do xuất nhập kho nếu có"
  },
  "items": [
    {
      "stt": 1,
      "itemName": "Tên hàng hóa, dịch vụ, quy cách",
      "unit": "Đơn vị tính (cái, chiếc, bộ, kg, mét, thùng...)",
      "quantity": 10,
      "unitPrice": 150000,
      "amount": 1500000
    }
  ],
  "vatRate": 10,
  "subTotal": 1500000,
  "vatAmount": 150000,
  "totalAmount": 1650000,
  "totalInWords": "Số tiền viết bằng chữ"
}

QUY TẮC BẮT BUỘC:
1. Chỉ trả về chuỗi JSON thuần túy, tuyệt đối không viết thêm lời dẫn, không bọc markdown.
2. quantity, unitPrice, amount, vatRate, subTotal, vatAmount, totalAmount bắt buộc là dạng số (number), không có dấu phân cách hàng nghìn.
3. Nếu không có hoặc không tìm thấy trường nào thì gán "" (chuỗi rỗng) hoặc 0 (số không).
4. Kiểm tra logic số học: amount = quantity * unitPrice; totalAmount = subTotal + vatAmount.
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      text,
      ollamaUrl = 'http://127.0.0.1:11434',
      model = 'qwen2.5:7b',
    } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const cleanUrl = ollamaUrl.replace(/\/$/, '');
    const generateUrl = `${cleanUrl}/api/generate`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000); // 45s for local LLM inference

      const prompt = `${SYSTEM_INSTRUCTION}\n\n=== VĂN BẢN OCR CẦN CẤU TRÚC HÓA ===\n${text}\n`;

      const ollamaResp = await fetch(generateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.1,
            top_p: 0.9,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (ollamaResp.ok) {
        const data = await ollamaResp.json();
        let rawJson = data.response || '{}';
        rawJson = rawJson.trim();
        if (rawJson.startsWith('```json')) rawJson = rawJson.slice(7);
        if (rawJson.startsWith('```')) rawJson = rawJson.slice(3);
        if (rawJson.endsWith('```')) rawJson = rawJson.slice(0, -3);
        rawJson = rawJson.trim();

        const parsed = JSON.parse(rawJson);

        // Sanitize and ensure format conforms to InvoiceDocument
        const header = parsed.header || {};
        const items = Array.isArray(parsed.items)
          ? parsed.items.map((it: Record<string, unknown>, idx: number) => ({
              id: `ollama-row-${idx + 1}-${Date.now()}`,
              stt: it.stt || idx + 1,
              itemName: String(it.itemName || it.name || '').trim(),
              unit: String(it.unit || it.dvt || '').trim(),
              quantity: Number(it.quantity || it.qty || 0),
              unitPrice: Number(it.unitPrice || it.price || 0),
              amount: Number(it.amount || it.total || 0),
              confidence: 95,
            }))
          : [];

        // Validate subtotals and totals
        const subTotal = Number(parsed.subTotal) || items.reduce((sum: number, r: { amount: number }) => sum + (r.amount || 0), 0);
        const vatRate = Number(parsed.vatRate) || 0;
        const vatAmount = Number(parsed.vatAmount) || Math.round((subTotal * vatRate) / 100);
        const totalAmount = Number(parsed.totalAmount) || subTotal + vatAmount;

        const doc: InvoiceDocument = {
          header: {
            documentType: header.documentType || 'hoa_don_gtgt',
            invoiceNo: String(header.invoiceNo || '').trim(),
            invoiceDate: String(header.invoiceDate || '').trim(),
            sellerName: String(header.sellerName || '').trim(),
            sellerTaxCode: String(header.sellerTaxCode || '').trim(),
            sellerAddress: String(header.sellerAddress || '').trim(),
            buyerName: String(header.buyerName || '').trim(),
            buyerTaxCode: String(header.buyerTaxCode || '').trim(),
            buyerAddress: String(header.buyerAddress || '').trim(),
            warehouseName: String(header.warehouseName || '').trim(),
            reason: String(header.reason || '').trim(),
          },
          items,
          vatRate,
          subTotal,
          vatAmount,
          totalAmount,
          totalInWords: String(parsed.totalInWords || '').trim(),
          rawText: text,
        };

        return NextResponse.json({
          success: true,
          engine: 'ollama',
          model,
          document: doc,
        });
      }
    } catch {
      // Ollama service unreachable or error
    }

    return NextResponse.json({
      fallback: true,
      message: 'Ollama service chưa phản hồi hoặc chưa bật, tự động dùng Parser quy tắc',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, fallback: true }, { status: 500 });
  }
}
