import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'OCR Hóa Đơn & Phiếu Kho Offline (CamScanner Style)',
  description: 'Trích xuất thông minh hóa đơn GTGT và phiếu xuất/nhập kho chạy offline phong cách CamScanner, chỉnh sửa bảng biểu và xuất file Excel (.xlsx) cùng Word (.docx).',
  openGraph: {
    title: 'OCR Hóa Đơn & Phiếu Kho Offline (CamScanner Style)',
    description: 'Trích xuất thông minh hóa đơn GTGT và phiếu xuất/nhập kho chạy offline phong cách CamScanner, chỉnh sửa bảng biểu và xuất file Excel (.xlsx) cùng Word (.docx).',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OCR Hóa Đơn & Phiếu Kho Offline (CamScanner Style)',
    description: 'Trích xuất thông minh hóa đơn GTGT và phiếu xuất/nhập kho chạy offline phong cách CamScanner, chỉnh sửa bảng biểu và xuất file Excel (.xlsx) cùng Word (.docx).',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var _f = window.fetch ? window.fetch.bind(window) : undefined;
                  Object.defineProperty(window, 'fetch', {
                    get: function() { return _f; },
                    set: function(v) { _f = v; },
                    configurable: true,
                    enumerable: true
                  });
                  if (typeof Window !== 'undefined' && Window.prototype) {
                    try {
                      Object.defineProperty(Window.prototype, 'fetch', {
                        get: function() { return _f; },
                        set: function(v) { _f = v; },
                        configurable: true,
                        enumerable: true
                      });
                    } catch(e2) {}
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
