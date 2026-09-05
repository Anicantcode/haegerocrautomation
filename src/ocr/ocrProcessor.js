import Tesseract from 'tesseract.js';

const { createWorker } = Tesseract;

let workerInstance = null;
let initPromise    = null;

export async function initOCR(onProgress) {
  if (workerInstance) return workerInstance;
  if (initPromise)    return initPromise;

  initPromise = (async () => {
    const logger = onProgress
      ? (m) => {
          if (
            m.status === 'loading tesseract core' ||
            m.status === 'loading language traineddata' ||
            m.status === 'initializing tesseract'
          ) onProgress(m);
        }
      : undefined;

    const worker = await createWorker('eng', 1, { logger });

    await worker.setParameters({
      /**
       * PSM 11 = Sparse text. Finds as much text as possible in no
       * particular order — ideal for documents where the target number
       * could be anywhere on the page.
       *
       * We deliberately do NOT set tessedit_char_whitelist because a
       * whitelist forces Tesseract to map every pixel to a whitelisted
       * character, which causes it to mis-read characters that fall just
       * outside the set (e.g., reading a bracket as "1", a comma as "7").
       * Better to let it read freely and validate/correct in JS afterwards.
       */
      tessedit_pageseg_mode: '11',
    });

    workerInstance = worker;
    return worker;
  })();

  return initPromise;
}

/**
 * Run OCR and return the full Tesseract data object (text + words array).
 * The words array includes per-word confidence scores and bounding boxes,
 * which the extractors can use for more accurate field location.
 */
export async function recognizeImage(imageSource, onProgress) {
  const worker = await initOCR(onProgress);
  const { data } = await worker.recognize(imageSource);
  return data;  // { text, words, lines, ... }
}

export async function terminateOCR() {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
    initPromise    = null;
  }
}