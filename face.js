// ============================================
// Facial Recognition Module (face-api.js)
// ============================================

const FACE_MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model';
const FACE_MATCH_THRESHOLD = 0.5; // lower = stricter (0.4–0.6 typical)

let faceModelsLoaded = false;
let faceModelsLoading = null;

/**
 * Load face-api models once (tiny detector + landmarks + recognition)
 */
async function loadFaceModels() {
  if (faceModelsLoaded) return true;
  if (faceModelsLoading) return faceModelsLoading;

  faceModelsLoading = (async () => {
    try {
      if (typeof faceapi === 'undefined') {
        throw new Error('face-api.js not loaded. Check script tag.');
      }
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL)
      ]);
      faceModelsLoaded = true;
      console.log('[Face] Models loaded');
      return true;
    } catch (err) {
      console.error('[Face] Model load failed:', err);
      faceModelsLoading = null;
      throw err;
    }
  })();

  return faceModelsLoading;
}

/**
 * Detect a single face and return 128-d descriptor
 * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement} input
 * @returns {Float32Array|null}
 */
async function getFaceDescriptor(input) {
  await loadFaceModels();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const detection = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return detection.descriptor;
}

/**
 * Detect face and draw box on overlay canvas (for live preview)
 */
async function detectAndDraw(video, canvas) {
  if (!faceModelsLoaded) return null;
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
  const result = await faceapi.detectSingleFace(video, options).withFaceLandmarks();

  const ctx = canvas.getContext('2d');
  const displaySize = { width: video.videoWidth || video.clientWidth, height: video.videoHeight || video.clientHeight };
  faceapi.matchDimensions(canvas, displaySize);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (result) {
    const resized = faceapi.resizeResults(result, displaySize);
    faceapi.draw.drawDetections(canvas, resized);
    faceapi.draw.drawFaceLandmarks(canvas, resized);
  }
  return result;
}

/**
 * Compare a query descriptor against a list of staff with stored descriptors
 * @param {Float32Array} queryDescriptor
 * @param {Array} staffList - staff objects that may have .faceDescriptor (number[])
 * @returns {{ staff, distance } | null}
 */
function matchFace(queryDescriptor, staffList) {
  if (!queryDescriptor || !staffList?.length) return null;

  let best = null;
  let bestDistance = Infinity;

  for (const s of staffList) {
    if (!s.faceDescriptor || !Array.isArray(s.faceDescriptor) || s.faceDescriptor.length < 100) continue;
    const stored = new Float32Array(s.faceDescriptor);
    const distance = faceapi.euclideanDistance(queryDescriptor, stored);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = s;
    }
  }

  if (best && bestDistance <= FACE_MATCH_THRESHOLD) {
    return { staff: best, distance: bestDistance, confidence: Math.max(0, (1 - bestDistance) * 100) };
  }
  return null;
}

/**
 * Convert Float32Array descriptor to plain array for localStorage
 */
function descriptorToArray(descriptor) {
  if (!descriptor) return null;
  return Array.from(descriptor);
}

/**
 * Start webcam stream into a video element
 */
async function startCamera(videoEl, facingMode = 'user') {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

/**
 * Stop all tracks on a video element's stream
 */
function stopCamera(videoEl) {
  if (videoEl?.srcObject) {
    videoEl.srcObject.getTracks().forEach(t => t.stop());
    videoEl.srcObject = null;
  }
}

/**
 * Capture current video frame to a canvas (optional snapshot)
 */
function captureFrame(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext('2d').drawImage(videoEl, 0, 0);
  return canvas;
}
