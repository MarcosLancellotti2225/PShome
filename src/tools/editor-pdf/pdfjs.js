// pdf.js para dibujar las páginas (misma versión que usaban las herramientas viejas).
import * as pdfjsNs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

const pdfjs = pdfjsNs.getDocument ? pdfjsNs : pdfjsNs.default;
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function loadDocument(bytes) {
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
}
