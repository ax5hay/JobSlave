import Tesseract from 'tesseract.js';
// Use legacy build for Node.js compatibility (no browser DOM APIs)
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// ESM compatibility for require.resolve
const require = createRequire(import.meta.url);
const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'));

export interface OCRProgress {
  stage: 'loading' | 'converting' | 'ocr' | 'complete';
  progress: number; // 0-100
  currentPage?: number;
  totalPages?: number;
  message: string;
}

export type ProgressCallback = (progress: OCRProgress) => void;

export class OCRService {
  private scheduler: Tesseract.Scheduler | null = null;
  private workerCount: number;

  constructor(workerCount = 2) {
    this.workerCount = workerCount;
  }

  async initialize(): Promise<void> {
    if (this.scheduler) return;

    this.scheduler = Tesseract.createScheduler();

    // Create workers
    for (let i = 0; i < this.workerCount; i++) {
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: () => {}, // Suppress default logging
      });
      this.scheduler.addWorker(worker);
    }
  }

  async terminate(): Promise<void> {
    if (this.scheduler) {
      await this.scheduler.terminate();
      this.scheduler = null;
    }
  }

  async extractTextFromPDF(
    filePath: string,
    onProgress?: ProgressCallback
  ): Promise<string> {
    const report = (progress: OCRProgress) => {
      if (onProgress) onProgress(progress);
    };

    report({ stage: 'loading', progress: 0, message: 'Loading PDF...' });

    // Read PDF file
    const data = new Uint8Array(fs.readFileSync(filePath));

    // Load PDF document
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      standardFontDataUrl: path.join(pdfjsDistPath, 'standard_fonts/'),
    });

    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;

    report({
      stage: 'loading',
      progress: 10,
      totalPages,
      message: `PDF loaded. ${totalPages} page(s) found.`
    });

    // First, try to extract text directly from PDF (for non-scanned PDFs)
    let directText = '';
    let hasDirectText = false;

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      if (pageText.trim().length > 50) {
        hasDirectText = true;
      }
      directText += pageText + '\n';
    }

    // If we got substantial text directly, return it
    if (hasDirectText && directText.trim().length > 200) {
      report({
        stage: 'complete',
        progress: 100,
        totalPages,
        message: 'Text extracted directly from PDF (no OCR needed).'
      });
      return directText;
    }

    // Otherwise, fall back to OCR
    report({
      stage: 'converting',
      progress: 20,
      totalPages,
      message: 'PDF appears to be scanned. Starting OCR...'
    });

    await this.initialize();

    const allText: string[] = [];
    const scale = 2.0; // Higher scale = better OCR accuracy

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      report({
        stage: 'converting',
        progress: 20 + (pageNum / totalPages) * 20,
        currentPage: pageNum,
        totalPages,
        message: `Rendering page ${pageNum}/${totalPages}...`
      });

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Create canvas and render PDF page
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context as any,
        viewport,
        canvas: canvas as any,
      }).promise;

      report({
        stage: 'ocr',
        progress: 40 + (pageNum / totalPages) * 50,
        currentPage: pageNum,
        totalPages,
        message: `Running OCR on page ${pageNum}/${totalPages}...`
      });

      // Convert canvas to buffer for Tesseract
      const imageBuffer = canvas.toBuffer('image/png');

      // Run OCR
      const { data: { text } } = await this.scheduler!.addJob('recognize', imageBuffer);
      allText.push(text);
    }

    report({
      stage: 'complete',
      progress: 100,
      totalPages,
      message: `OCR complete. Processed ${totalPages} page(s).`
    });

    return allText.join('\n\n--- Page Break ---\n\n');
  }

  async extractTextFromImage(
    filePath: string,
    onProgress?: ProgressCallback
  ): Promise<string> {
    const report = (progress: OCRProgress) => {
      if (onProgress) onProgress(progress);
    };

    report({ stage: 'loading', progress: 0, message: 'Loading image...' });

    await this.initialize();

    report({ stage: 'ocr', progress: 20, message: 'Running OCR on image...' });

    const imageBuffer = fs.readFileSync(filePath);
    const { data: { text } } = await this.scheduler!.addJob('recognize', imageBuffer);

    report({ stage: 'complete', progress: 100, message: 'OCR complete.' });

    return text;
  }

  async extractText(
    filePath: string,
    onProgress?: ProgressCallback
  ): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
      return this.extractTextFromPDF(filePath, onProgress);
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'].includes(ext)) {
      return this.extractTextFromImage(filePath, onProgress);
    } else if (['.doc', '.docx'].includes(ext)) {
      // For DOC/DOCX, we'll return raw text (basic support)
      // In production, you'd use mammoth or similar
      const report = (progress: OCRProgress) => {
        if (onProgress) onProgress(progress);
      };
      report({ stage: 'loading', progress: 0, message: 'Loading document...' });
      const text = fs.readFileSync(filePath, 'utf-8');
      report({ stage: 'complete', progress: 100, message: 'Document loaded.' });
      return text;
    }

    throw new Error(`Unsupported file type: ${ext}`);
  }
}

// Singleton instance
let ocrServiceInstance: OCRService | null = null;

export function getOCRService(): OCRService {
  if (!ocrServiceInstance) {
    ocrServiceInstance = new OCRService();
  }
  return ocrServiceInstance;
}
