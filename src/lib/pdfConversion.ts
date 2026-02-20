/**
 * PDF to Image Conversion Utility
 * Converts PDF files/URLs to high-quality PNG images using PDF.js
 */

export interface PdfConversionOptions {
  scale?: number;
  pageNumber?: number;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface PdfConversionResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

async function initPdfJs() {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  return pdfjsLib;
}

export async function convertPdfFileToImage(
  file: File,
  options: PdfConversionOptions = {}
): Promise<PdfConversionResult> {
  const { scale = 2.0, pageNumber = 1, format = 'png', quality = 1.0 } = options;
  const pdfjsLib = await initPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return renderPdfPageToImage(pdf, { scale, pageNumber, format, quality });
}

export async function convertPdfUrlToImage(
  url: string,
  options: PdfConversionOptions = {}
): Promise<PdfConversionResult> {
  const { scale = 2.0, pageNumber = 1, format = 'png', quality = 1.0 } = options;
  const pdfjsLib = await initPdfJs();
  const pdf = await pdfjsLib.getDocument(url).promise;
  return renderPdfPageToImage(pdf, { scale, pageNumber, format, quality });
}

async function renderPdfPageToImage(
  pdf: any,
  options: Required<PdfConversionOptions>
): Promise<PdfConversionResult> {
  const { scale, pageNumber, format, quality } = options;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({ canvasContext: context, viewport }).promise;
  
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Failed to convert canvas to blob')),
      mimeType,
      quality
    );
  });
  
  const dataUrl = canvas.toDataURL(mimeType, quality);
  
  return { blob, dataUrl, width: viewport.width, height: viewport.height };
}
