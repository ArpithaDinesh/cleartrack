"""
CLEARTRACK - OpenCV Image Preprocessor for OCR
Usage: python preprocess.py <input_image_path> <output_image_path>
Enhances receipt images before Tesseract OCR for better accuracy.
"""

import sys
import os
import cv2
import numpy as np

def preprocess_for_ocr(input_path, output_path):
    img = cv2.imread(input_path)
    if img is None:
        print(f"ERROR: Could not read image: {input_path}", file=sys.stderr)
        sys.exit(1)

    # 1. Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 2. Scale up if image is small (improves OCR on low-res receipts)
    h, w = gray.shape
    if w < 1000:
        scale = 1000 / w
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # 3. Denoise
    denoised = cv2.fastNlMeansDenoising(gray, h=15)

    # 4. Adaptive thresholding - handles uneven lighting in receipt photos
    thresh = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31, 10
    )

    # 5. Deskew if rotated slightly
    coords = np.column_stack(np.where(thresh < 200))
    if len(coords) > 0:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        if abs(angle) < 15:  # Only deskew small angles to avoid over-rotation
            (h2, w2) = thresh.shape[:2]
            center = (w2 // 2, h2 // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            thresh = cv2.warpAffine(thresh, M, (w2, h2),
                                    flags=cv2.INTER_CUBIC,
                                    borderMode=cv2.BORDER_REPLICATE)

    # 6. Sharpen for clearer text edges
    kernel = np.array([[0, -1, 0],
                       [-1, 5, -1],
                       [0, -1, 0]])
    sharpened = cv2.filter2D(thresh, -1, kernel)

    cv2.imwrite(output_path, sharpened)
    print(f"DONE: {output_path}")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python preprocess.py <input> <output>", file=sys.stderr)
        sys.exit(1)
    preprocess_for_ocr(sys.argv[1], sys.argv[2])
