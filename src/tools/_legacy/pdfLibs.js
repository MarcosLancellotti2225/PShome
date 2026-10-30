// Librerías de PDF y Excel que las herramientas clásicas esperaban como globales (antes, desde un CDN).
// Mismas versiones que usaban: pdf.js 3.11.174, pdf-lib 1.17.1, ExcelJS 4.4.0.
import * as pdfjsNs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import * as PDFLib from 'pdf-lib';
import ExcelJSNs from 'exceljs/dist/exceljs.min.js';

const pdfjsLib = pdfjsNs.getDocument ? pdfjsNs : pdfjsNs.default;
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

window.pdfjsLib = pdfjsLib;
window.PDFLib = PDFLib;
window.ExcelJS = ExcelJSNs?.Workbook ? ExcelJSNs : ExcelJSNs?.default;
