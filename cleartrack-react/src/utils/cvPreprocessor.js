/**
 * CLEARTRACK - OpenCV Preprocessor
 * Enhances image quality before OCR processing.
 */

export const preprocessImage = async (imageElement) => {
  return new Promise((resolve, reject) => {
    if (!window.cv) {
      console.warn('OpenCV.js not loaded, skipping preprocessing');
      return resolve(imageElement.src);
    }

    try {
      const cv = window.cv;
      const src = cv.imread(imageElement);
      const dst = new cv.Mat();

      // 1. Grayscale
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);

      // 2. Resize if too large (improves OCR speed and keeps upload under 4.5MB Vercel limit)
      const maxDim = 1600;
      if (src.cols > maxDim || src.rows > maxDim) {
        const scale = maxDim / Math.max(src.cols, src.rows);
        const dsize = new cv.Size(Math.round(src.cols * scale), Math.round(src.rows * scale));
        cv.resize(dst, dst, dsize, 0, 0, cv.INTER_AREA);
      }

      // 3. Denoising / Gaussian Blur
      const ksize = new cv.Size(3, 3);
      cv.GaussianBlur(dst, dst, ksize, 0, 0, cv.BORDER_DEFAULT);

      // 4. Adaptive Thresholding (Handles uneven lighting/shadows)
      cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

      // 4. Sharpening (Optional, but can help)
      // We can use a kernel for this if needed

      // Create a canvas to output the processed image
      const canvas = document.createElement('canvas');
      cv.imshow(canvas, dst);
      
      // Use JPEG with quality 0.8 to keep file size small
      const processedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

      // Cleanup
      src.delete();
      dst.delete();

      resolve(processedDataUrl);
    } catch (err) {
      console.error('OpenCV preprocessing failed:', err);
      resolve(imageElement.src); // Fallback to original
    }
  });
};

export const waitForCV = async () => {
  return new Promise((resolve) => {
    if (window.cv && window.cv.onRuntimeInitialized) {
      resolve();
    } else {
      const check = setInterval(() => {
        if (window.cv && window.cv.imread) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    }
  });
};
