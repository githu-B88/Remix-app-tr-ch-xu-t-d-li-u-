"""
FastAPI Server for Invoice & Warehouse Receipt OCR Pipeline:
1) OpenCV: Preprocessing (Deskew, CLAHE, Shadow Removal, Bilateral Denoising)
2) PaddleOCR: High-accuracy Vietnamese Text Detection & Recognition
3) Ollama: Intelligent Post-processing, Typo Correction & Table Normalization
"""

import os
import re
import cv2
import json
import base64
import math
import requests
import numpy as np
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Invoice OCR Pipeline (OpenCV + PaddleOCR + Ollama)",
    description="High-accuracy Vietnamese Invoice and Warehouse Receipt OCR Backend",
    version="1.0.0"
)

# Enable CORS for Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy loaded PaddleOCR instance
_paddle_ocr_engine = None

def get_paddle_ocr():
    global _paddle_ocr_engine
    if _paddle_ocr_engine is None:
        try:
            from paddleocr import PaddleOCR
            # lang='vi' for Vietnamese, use_angle_cls=True for automatic orientation correction
            _paddle_ocr_engine = PaddleOCR(use_angle_cls=True, lang='vi', show_log=False)
        except Exception as e:
            print(f"[PaddleOCR Load Warning] Could not initialize PaddleOCR: {e}")
            _paddle_ocr_engine = None
    return _paddle_ocr_engine

# Helper: Base64 to OpenCV image (BGR)
def base64_to_cv2_img(b64_str: str) -> np.ndarray:
    if "," in b64_str:
        b64_str = b64_str.split(",")[1]
    img_data = base64.b64decode(b64_str)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Cannot decode base64 into valid image")
    return img

# Helper: OpenCV image to Base64
def cv2_img_to_base64(img: np.ndarray, ext: str = ".png") -> str:
    success, buffer = cv2.imencode(ext, img)
    if not success:
        raise ValueError("Cannot encode image to base64")
    b64_str = base64.b64encode(buffer).decode("utf-8")
    mime = "image/png" if ext.lower() == ".png" else "image/jpeg"
    return f"data:{mime};base64,{b64_str}"

# Models
class PreprocessOptions(BaseModel):
    image_base64: str
    deskew: bool = True
    shadow_removal: bool = True
    clahe_contrast: bool = True
    bilateral_denoise: bool = True
    mode: str = "magic"  # 'magic', 'bw', 'high_contrast', 'original'
    rotate: int = 0      # 0, 90, 180, 270
    contrast: int = 15   # -100 to 100
    brightness: int = 0  # -100 to 100

class OcrRequest(BaseModel):
    image_base64: str

class OllamaPostprocessRequest(BaseModel):
    text: str
    lines: List[Dict[str, Any]] = []
    ollama_url: str = "http://127.0.0.1:11434"
    model: str = "qwen2.5:7b"
    document_type_hint: Optional[str] = None

# 1. OpenCV Preprocessing Algorithm
def opencv_preprocess_pipeline(img: np.ndarray, opts: PreprocessOptions) -> Dict[str, Any]:
    # A. Rotation if user specified
    if opts.rotate == 90:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    elif opts.rotate == 180:
        img = cv2.rotate(img, cv2.ROTATE_180)
    elif opts.rotate == 270:
        img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)

    h, w = img.shape[:2]
    detected_angle = 0.0

    # B. Auto-deskew using Hough transform on edge image
    if opts.deskew:
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 100, minLineLength=w // 8, maxLineGap=20)
            if lines is not None and len(lines) > 0:
                angles = []
                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
                    # Only take near-horizontal lines (-35 to +35 degrees)
                    if -35 < angle < 35:
                        angles.append(angle)
                if len(angles) >= 3:
                    median_angle = float(np.median(angles))
                    if abs(median_angle) > 0.4:
                        detected_angle = median_angle
                        center = (w // 2, h // 2)
                        rot_mat = cv2.getRotationMatrix2D(center, detected_angle, 1.0)
                        img = cv2.warpAffine(img, rot_mat, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        except Exception as e:
            print(f"[Deskew Warning] {e}")

    # C. Bilateral Denoising (preserves sharp printed text while smoothing paper grain)
    if opts.bilateral_denoise:
        try:
            img = cv2.bilateralFilter(img, d=5, sigmaColor=50, sigmaSpace=50)
        except Exception:
            pass

    # D. Shadow removal via morphological background estimation
    if opts.shadow_removal:
        try:
            rgb_planes = cv2.split(img)
            result_norm_planes = []
            for plane in rgb_planes:
                dilated_img = cv2.dilate(plane, np.ones((7, 7), np.uint8))
                bg_img = cv2.medianBlur(dilated_img, 21)
                diff_img = 255 - cv2.absdiff(plane, bg_img)
                norm_img = cv2.normalize(diff_img, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)
                result_norm_planes.append(norm_img)
            img = cv2.merge(result_norm_planes)
        except Exception as e:
            print(f"[Shadow Removal Warning] {e}")

    # E. CamScanner Mode / CLAHE enhancement
    if opts.mode == "magic":
        # Magic color: Boost contrast on L channel in LAB color space
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        img = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        # Deepen text blacks and clean near-white background
        img = np.clip(1.2 * img - 15, 0, 255).astype(np.uint8)

    elif opts.mode == "bw":
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Adaptive Gaussian thresholding for crisp black-and-white
        bw = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10)
        img = cv2.cvtColor(bw, cv2.COLOR_GRAY2BGR)

    elif opts.mode == "high_contrast":
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        img = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

    # F. Brightness and Contrast adjustments
    if opts.contrast != 0 or opts.brightness != 0:
        alpha = 1.0 + (opts.contrast / 100.0)
        beta = opts.brightness
        img = cv2.convertScaleAbs(img, alpha=alpha, beta=beta)

    processed_base64 = cv2_img_to_base64(img)
    return {
        "dataUrl": processed_base64,
        "width": img.shape[1],
        "height": img.shape[0],
        "skew_angle": round(detected_angle, 2),
    }

# 2. PaddleOCR Runner
def run_paddle_ocr_engine(img: np.ndarray) -> Dict[str, Any]:
    ocr = get_paddle_ocr()
    if ocr is None:
        raise HTTPException(
            status_code=503,
            detail="PaddleOCR chưa được khởi tạo. Hãy kiểm tra cài đặt paddleocr & paddlepaddle."
        )

    # PaddleOCR expects RGB image array
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = ocr.ocr(img_rgb, cls=True)

    lines = []
    words = []
    all_text_lines = []

    if results and len(results) > 0 and results[0]:
        for item in results[0]:
            box, (text, conf) = item
            # box is 4 points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
            xs = [pt[0] for pt in box]
            ys = [pt[1] for pt in box]
            x0, y0, x1, y1 = float(min(xs)), float(min(ys)), float(max(xs)), float(max(ys))

            cleaned_text = str(text).strip()
            if not cleaned_text:
                continue

            all_text_lines.append(cleaned_text)
            conf_val = round(float(conf) * 100, 1)

            # Split line into words for bounding box precision
            raw_words = cleaned_text.split()
            word_count = len(raw_words)
            line_words = []
            if word_count > 0:
                word_w = (x1 - x0) / word_count
                for idx, w_str in enumerate(raw_words):
                    w_obj = {
                        "text": w_str,
                        "confidence": conf_val,
                        "bbox": {
                            "x0": round(x0 + idx * word_w, 1),
                            "y0": round(y0, 1),
                            "x1": round(x0 + (idx + 1) * word_w, 1),
                            "y1": round(y1, 1),
                        }
                    }
                    line_words.append(w_obj)
                    words.append(w_obj)

            lines.append({
                "text": cleaned_text,
                "confidence": conf_val,
                "bbox": {"x0": round(x0, 1), "y0": round(y0, 1), "x1": round(x1, 1), "y1": round(y1, 1)},
                "words": line_words,
            })

    full_text = "\n".join(all_text_lines)
    avg_confidence = round(float(np.mean([l["confidence"] for l in lines])), 1) if lines else 0.0

    return {
        "text": full_text,
        "confidence": avg_confidence,
        "lines": lines,
        "words": words,
        "engine": "paddleocr"
    }

# 3. Ollama Post-processing LLM Prompt
def call_ollama_postprocess(req: OllamaPostprocessRequest) -> Dict[str, Any]:
    url = f"{req.ollama_url.rstrip('/')}/api/generate"

    system_prompt = """Bạn là trợ lý AI chuyên gia kế toán Việt Nam.
Nhiệm vụ của bạn là nhận văn bản trích xuất từ OCR của Hóa đơn GTGT hoặc Phiếu xuất kho / nhập kho,
sửa các lỗi chính tả do OCR đọc sai (tiếng Việt có dấu, ký hiệu số, đơn vị tính),
sau đó cấu trúc hóa toàn bộ thông tin thành một JSON duy nhất đúng chuẩn sau:

{
  "header": {
    "documentType": "hoa_don_gtgt" | "phieu_xuat_kho" | "phieu_nhap_kho" | "hoa_don_ban_hang",
    "invoiceNo": "Số hóa đơn hoặc số phiếu",
    "invoiceDate": "Ngày tháng năm lập (DD/MM/YYYY)",
    "sellerName": "Tên đơn vị bán hoặc xuất kho",
    "sellerTaxCode": "Mã số thuế bên bán",
    "sellerAddress": "Địa chỉ bên bán",
    "buyerName": "Tên đơn vị mua hoặc nhận kho",
    "buyerTaxCode": "Mã số thuế bên mua",
    "buyerAddress": "Địa chỉ bên mua",
    "warehouseName": "Tên kho xuất/nhập nếu có",
    "reason": "Lý do xuất nhập kho nếu có"
  },
  "items": [
    {
      "stt": 1,
      "itemName": "Tên hàng hóa, quy cách",
      "unit": "Đơn vị tính (cái, bộ, kg, mét...)",
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

QUY TẮC CẦN TUÂN THỦ:
1. Chỉ trả về duy nhất chuỗi JSON hợp lệ, không giải thích thêm, không markdown wrapper codeblock.
2. quantity, unitPrice, amount, vatRate, subTotal, vatAmount, totalAmount phải là số (number), không có dấu phẩy ngăn cách hàng nghìn.
3. Nếu không tìm thấy trường nào thì để chuỗi rỗng "" hoặc số 0.
4. Đảm bảo tính toán hợp lệ: amount = quantity * unitPrice.
"""

    user_content = f"VĂN BẢN OCR CẦN XỬ LÝ:\n\n{req.text}\n"

    payload = {
        "model": req.model,
        "prompt": f"{system_prompt}\n\n{user_content}",
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.1,
            "top_p": 0.9,
        }
    }

    try:
        resp = requests.post(url, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        raw_response = data.get("response", "{}")

        # Extract JSON
        clean_json = raw_response.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        if clean_json.startswith("```"):
            clean_json = clean_json[3:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]
        clean_json = clean_json.strip()

        parsed = json.loads(clean_json)
        return {
            "status": "success",
            "model": req.model,
            "data": parsed,
        }
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Lỗi kết nối hoặc xử lý qua Ollama ({req.model} tại {req.ollama_url}): {str(e)}"
        )

# API Endpoints
@app.get("/health")
def health():
    paddle_loaded = _paddle_ocr_engine is not None
    return {
        "status": "ok",
        "opencv_version": cv2.__version__,
        "paddle_ocr_ready": paddle_loaded,
        "message": "Python OCR backend is running"
    }

@app.post("/preprocess")
def preprocess_image(opts: PreprocessOptions):
    try:
        img = base64_to_cv2_img(opts.image_base64)
        result = opencv_preprocess_pipeline(img, opts)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OpenCV Preprocessing Error: {str(e)}")

@app.post("/ocr")
def ocr_image(req: OcrRequest):
    try:
        img = base64_to_cv2_img(req.image_base64)
        result = run_paddle_ocr_engine(img)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PaddleOCR Recognition Error: {str(e)}")

@app.post("/postprocess")
def postprocess_ollama(req: OllamaPostprocessRequest):
    return call_ollama_postprocess(req)

@app.get("/ollama/tags")
def get_ollama_tags(url: str = "http://127.0.0.1:11434"):
    try:
        resp = requests.get(f"{url.rstrip('/')}/api/tags", timeout=5)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Không thể kết nối tới Ollama tại {url}: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    print("Khởi động Invoice OCR Pipeline Server trên cổng 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
