/**
 * PDF conversion utility using pdfjs-dist running offline in the browser.
 */

export interface PdfPagePreview {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export async function renderPdfToImages(file: File): Promise<PdfPagePreview[]> {
  const arrayBuffer = await file.arrayBuffer();

  // Dynamically import pdfjs-dist to avoid SSR bundling conflicts
  const pdfjsLib = await import('pdfjs-dist');

  // Point worker to local public path for 100% offline support
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: undefined,
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages: PdfPagePreview[] = [];

  // Render first up to 5 pages (for multi-page invoices or receipts)
  const maxPages = Math.min(numPages, 10);

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    // Use scale 2.0 for crisp high-resolution OCR
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await (page.render as any)({
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    pages.push({
      pageNumber: pageNum,
      dataUrl: canvas.toDataURL('image/png'),
      width: viewport.width,
      height: viewport.height,
    });
  }

  return pages;
}
