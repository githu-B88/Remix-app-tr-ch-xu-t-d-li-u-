import { CropRect, ImageFilterOptions } from '@/types/ocr';

/**
 * Apply filters (rotation, contrast, brightness, CamScanner mode) and crop
 * directly on a HTML5 Canvas, returning both an image data URL and ImageData.
 */
export async function processImageOnCanvas(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  filters: ImageFilterOptions,
  crop?: CropRect
): Promise<{ dataUrl: string; canvas: HTMLCanvasElement }> {
  // First, create a working canvas for rotation and base orientation
  const rotCanvas = document.createElement('canvas');
  const rotCtx = rotCanvas.getContext('2d', { willReadFrequently: true });
  if (!rotCtx) throw new Error('Không thể khởi tạo Canvas 2D Context');

  const rad = (filters.rotate * Math.PI) / 180;
  const isRotatedQuarter = filters.rotate === 90 || filters.rotate === 270;

  const srcWidth = sourceImage.width;
  const srcHeight = sourceImage.height;

  rotCanvas.width = isRotatedQuarter ? srcHeight : srcWidth;
  rotCanvas.height = isRotatedQuarter ? srcWidth : srcHeight;

  rotCtx.save();
  rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
  rotCtx.rotate(rad);
  rotCtx.drawImage(sourceImage, -srcWidth / 2, -srcHeight / 2);
  rotCtx.restore();

  // If crop is specified, extract cropped area; otherwise use whole canvas
  let finalCanvas = document.createElement('canvas');
  let finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });
  if (!finalCtx) throw new Error('Không thể khởi tạo Final Canvas Context');

  if (crop && crop.width > 10 && crop.height > 10) {
    // Clamp crop within rotCanvas bounds
    const clX = Math.max(0, Math.min(crop.x, rotCanvas.width - 10));
    const clY = Math.max(0, Math.min(crop.y, rotCanvas.height - 10));
    const clW = Math.min(crop.width, rotCanvas.width - clX);
    const clH = Math.min(crop.height, rotCanvas.height - clY);

    finalCanvas.width = clW;
    finalCanvas.height = clH;
    finalCtx.drawImage(rotCanvas, clX, clY, clW, clH, 0, 0, clW, clH);
  } else {
    finalCanvas.width = rotCanvas.width;
    finalCanvas.height = rotCanvas.height;
    finalCtx.drawImage(rotCanvas, 0, 0);
  }

  // Apply Pixel Filters (Brightness, Contrast, Magic Scanner, B&W)
  const imgData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
  const data = imgData.data;
  const contrastFactor = (259 * (filters.contrast + 255)) / (255 * (259 - filters.contrast));
  const brightness = filters.brightness;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Brightness
    if (brightness !== 0) {
      r += brightness;
      g += brightness;
      b += brightness;
    }

    // 2. Contrast
    if (filters.contrast !== 0) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    // 3. Modes
    if (filters.mode === 'bw') {
      // Binarization (Otsu-like threshold)
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const v = gray > 138 ? 255 : 0;
      r = v;
      g = v;
      b = v;
    } else if (filters.mode === 'magic') {
      // CamScanner Magic color: increase contrast, boost blacks for text, wash out yellowish background
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      if (gray > 180) {
        // Light background -> push to pure crisp white
        r = Math.min(255, r * 1.15 + 15);
        g = Math.min(255, g * 1.15 + 15);
        b = Math.min(255, b * 1.15 + 15);
      } else if (gray < 110) {
        // Dark text -> deepen contrast
        r = Math.max(0, r * 0.85);
        g = Math.max(0, g * 0.85);
        b = Math.max(0, b * 0.85);
      } else {
        // Midtones: high pass
        r = (r - 110) * 1.4 + 110;
        g = (g - 110) * 1.4 + 110;
        b = (b - 110) * 1.4 + 110;
      }
    } else if (filters.mode === 'high_contrast') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const stretched = ((gray - 50) / 160) * 255;
      const v = Math.min(255, Math.max(0, stretched));
      r = v;
      g = v;
      b = v;
    }

    // Clamp values
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  finalCtx.putImageData(imgData, 0, 0);

  return {
    dataUrl: finalCanvas.toDataURL('image/png'),
    canvas: finalCanvas,
  };
}

/**
 * Loads an image from a URL or File into an HTMLImageElement
 */
export function loadImageElement(source: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Không thể tải hình ảnh: ' + e));

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        } else {
          reject(new Error('Đọc tệp hình ảnh thất bại'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    }
  });
}
