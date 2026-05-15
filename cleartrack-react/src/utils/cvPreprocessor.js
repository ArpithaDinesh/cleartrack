/**
 * CLEARTRACK - OpenCV Preprocessor v1.2.0
 * Enhances image quality and rectifies perspective before OCR.
 */

export const preprocessImage = async (imageElement) => {
  return new Promise((resolve, reject) => {
    if (!window.cv) {
      console.warn('OpenCV.js not loaded, skipping preprocessing');
      return resolve(imageElement.src);
    }

    try {
      const cv = window.cv;
      let src = cv.imread(imageElement);
      let dst = new cv.Mat();

      // --- STAGE 1: Perspective Correction (ROI Detection) ---
      // We use a smaller version for contour detection to save memory/time
      let gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      
      let blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      
      let edged = new cv.Mat();
      cv.Canny(blurred, edged, 75, 200);

      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();
      cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      let largestContour = null;
      let maxArea = 0;

      for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        if (area > 5000) {
          let peri = cv.arcLength(cnt, true);
          let approx = new cv.Mat();
          cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
          if (approx.rows === 4 && area > maxArea) {
            largestContour = approx;
            maxArea = area;
          } else {
            approx.delete();
          }
        }
      }

      // If we found a 4-point contour, warp the perspective
      if (largestContour) {
        src = warpPerspective(cv, src, largestContour);
        largestContour.delete();
      }

      // Cleanup stage 1
      gray.delete(); blurred.delete(); edged.delete(); contours.delete(); hierarchy.delete();

      // --- STAGE 2: Quality Enhancement ---
      // 1. Grayscale
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);

      // 2. Intelligent Upscale (Target ~2500px for best OCR balance)
      const targetWidth = 2500;
      if (dst.cols < targetWidth) {
        const scale = targetWidth / dst.cols;
        const dsize = new cv.Size(targetWidth, Math.round(dst.rows * scale));
        cv.resize(dst, dst, dsize, 0, 0, cv.INTER_CUBIC);
      } else if (dst.cols > 3000) {
        // Downscale if ridiculously large to avoid Tesseract memory crashes
        const scale = 2500 / dst.cols;
        const dsize = new cv.Size(2500, Math.round(dst.rows * scale));
        cv.resize(dst, dst, dsize, 0, 0, cv.INTER_AREA);
      }

      // 3. Enhance Contrast (CLAHE)
      const clahe = new cv.CLAHE(3.5, new cv.Size(8, 8));
      clahe.apply(dst, dst);
      clahe.delete();

      // 4. Sharpening
      let kernel = cv.matFromArray(3, 3, cv.CV_32F, [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
      ]);
      cv.filter2D(dst, dst, cv.CV_8U, kernel);
      kernel.delete();

      // 5. Adaptive Thresholding
      cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 15);

      // Create a canvas to output
      const canvas = document.createElement('canvas');
      cv.imshow(canvas, dst);
      const processedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Final Cleanup
      src.delete();
      dst.delete();

      resolve(processedDataUrl);
    } catch (err) {
      console.error('OpenCV preprocessing failed:', err);
      resolve(imageElement.src);
    }
  });
};

/**
 * Warps a 4-point contour into a top-down rectangular view
 */
function warpPerspective(cv, src, contour) {
  // Sort points: top-left, top-right, bottom-right, bottom-left
  let points = [];
  for (let i = 0; i < 4; i++) {
    points.push({ x: contour.data32S[i * 2], y: contour.data32S[i * 2 + 1] });
  }

  points.sort((a, b) => a.y - b.y);
  let top = points.slice(0, 2).sort((a, b) => a.x - b.x);
  let bottom = points.slice(2, 4).sort((a, b) => a.x - b.x);

  let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
    top[0].x, top[0].y, 
    top[1].x, top[1].y, 
    bottom[1].x, bottom[1].y, 
    bottom[0].x, bottom[0].y
  ]);

  // Estimate dimensions
  const widthA = Math.hypot(bottom[1].x - bottom[0].x, bottom[1].y - bottom[0].y);
  const widthB = Math.hypot(top[1].x - top[0].x, top[1].y - top[0].y);
  const maxWidth = Math.max(widthA, widthB);

  const heightA = Math.hypot(top[1].x - bottom[1].x, top[1].y - bottom[1].y);
  const heightB = Math.hypot(top[0].x - bottom[0].x, top[0].y - bottom[0].y);
  const maxHeight = Math.max(heightA, heightB);

  let dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0, 
    maxWidth - 1, 0, 
    maxWidth - 1, maxHeight - 1, 
    0, maxHeight - 1
  ]);

  let M = cv.getPerspectiveTransform(srcCoords, dstCoords);
  let warped = new cv.Mat();
  cv.warpPerspective(src, warped, M, new cv.Size(maxWidth, maxHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

  // Cleanup
  M.delete(); srcCoords.delete(); dstCoords.delete(); src.delete();
  
  return warped;
}

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

