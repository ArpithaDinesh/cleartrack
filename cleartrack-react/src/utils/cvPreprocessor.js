/**
 * CLEARTRACK - OpenCV Preprocessor v1.2.0
 * Enhances image quality and rectifies perspective before OCR.
 */

export const preprocessImage = async (imageElement) => {
  return new Promise((resolve) => {
    if (!window.cv) return resolve(imageElement.src);

    try {
      const cv = window.cv;
      let src = cv.imread(imageElement);
      let dst = new cv.Mat();

      // 1. Grayscale (Essential for OCR)
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);

      // 2. Standard Resize (Max 2500px for better OCR)
      const maxDim = 2500;
      if (dst.cols > maxDim || dst.rows > maxDim) {
        const scale = maxDim / Math.max(dst.cols, dst.rows);
        const dsize = new cv.Size(Math.round(dst.cols * scale), Math.round(dst.rows * scale));
        cv.resize(dst, dst, dsize, 0, 0, cv.INTER_CUBIC);
      }

      // 3. Contrast Boost (CLAHE)
      const clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
      clahe.apply(dst, dst);
      clahe.delete();

      const canvas = document.createElement('canvas');
      canvas.width = dst.cols;
      canvas.height = dst.rows;
      cv.imshow(canvas, dst);
      const processedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      src.delete(); dst.delete();
      resolve(processedDataUrl);
    } catch (err) {
      console.error('Preprocessing failed, using raw image:', err);
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

