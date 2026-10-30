// Editor PDF — operaciones sobre el archivo (sin interfaz).
// Abrir: detecta los campos y lee sus fuentes. Guardar: aplica todos los cambios con el mismo
// motor de Convertir PDF (rewriter.js) y, si hay campos nuevos, los agrega.
import { detectFields } from '../pdf-detect/index.js';
import { rewritePdf, addFieldToPdf } from './rewriter.js';
import { readPdfFieldFontSizes, capPdfFieldFontSize, fillPdfWithDummy, generateLabeledPdf } from './pdf-tools.js';
import { buildEdits, fromDetected } from './model.js';

export async function openPdf(bytes) {
  const [{ fields }, fonts] = await Promise.all([
    detectFields(bytes.slice()),
    readPdfFieldFontSizes(bytes.slice()).catch(() => ({ bySourceName: {} })),
  ]);
  return fromDetected(fields, fonts.bySourceName);
}

// Devuelve { pdfBytes, report } con todos los cambios aplicados.
// opts.capFont: número → limita la fuente de los campos de texto a ese tamaño (los en Auto quedan fijos).
export async function applyEdits(bytes, fields, opts = {}) {
  const e = buildEdits(fields);
  const report = { renamed: 0, deleted: 0, added: 0, moved: e.moveMap.length, props: e.propChanges.length, combCleared: 0, warnings: [] };
  let out = bytes.slice();

  const hasRewrite = e.renameMap.length || e.deleteNames.length || e.moveMap.length || e.typeChanges.length || e.propChanges.length;
  if (hasRewrite) {
    const r = await rewritePdf(out, e.renameMap, e.deleteNames, e.moveMap, e.typeChanges, e.propChanges);
    out = new Uint8Array(r.pdfBytes);
    report.renamed = r.renamedCount || 0;
    report.deleted = r.deletedCount || 0;
    report.combCleared = r.combCleared || 0;
    report.warnings.push(...(r.warnings || []));
  }

  if (e.newFields.length) {
    const r = await addFieldToPdf(out, e.newFields);
    out = new Uint8Array(r.pdfBytes);
    report.added = e.newFields.length;
    // Los campos nuevos se crean con fuente 10: si se eligió otra cosa, se aplica por nombre.
    const props = e.newFields
      .filter((f) => (f.fontSize !== null && f.fontSize !== 10) || f.multiline)
      .map((f) => ({ fieldName: f.name, fontSize: f.fontSize, multiline: f.multiline || undefined }));
    if (props.length) {
      const r2 = await rewritePdf(out, [], [], [], [], props);
      out = new Uint8Array(r2.pdfBytes);
    }
  }

  if (opts.capFont) {
    const r = await capPdfFieldFontSize(out, opts.capFont);
    out = new Uint8Array(r.pdfBytes);
    report.capped = r.changed;
  }
  return { pdfBytes: out, report };
}

export async function withDummyData(bytes, opts) {
  const r = await fillPdfWithDummy(bytes, opts);
  return { ...r, pdfBytes: new Uint8Array(r.pdfBytes) };
}

export async function withLabels(bytes) {
  return generateLabeledPdf(bytes);
}

export * from './model.js';
export * from './excel.js';
