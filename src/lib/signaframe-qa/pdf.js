// Probar PDF: llena el PDF con lo que el formulario manda a cada casillero (el `pdf` de la simulación)
// y dice qué pintó, qué no y qué no entra. Sin React ni DOM.
import {
  PDFDocument, StandardFonts, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList,
} from 'pdf-lib';
import { dummyPara, findOverflows } from '../pdf-editor/pdf-tools.js';

const bare = (id) => (String(id).startsWith('field_') ? String(id).slice(6) : String(id));

function allFields(formDef) {
  const out = [];
  const walk = (list) => (list || []).forEach((f) => {
    out.push(f);
    walk(f.fields);
    walk(f.repeaterConfig?.fields);
  });
  for (const s of formDef?.sections || []) {
    walk(s.fields);
    for (const sub of s.subsections || []) walk(sub.fields);
  }
  return out;
}

const casilleros = (f) => [f.sourceMeta?.sourceName, ...(f.sourceMeta?.sourceNames || [])].filter(Boolean);

/**
 * Pasa los valores de la simulación (clave = id del campo) a los casilleros del PDF (sourceMeta).
 * Devuelve { values: { casillero: valor }, referenced: Set de casilleros que usa el form-def,
 *            sinCasillero: ids con valor pero sin casillero del PDF }.
 */
export function pdfValuesFor(formDef, simPdf) {
  const byId = new Map();
  const referenced = new Set();
  for (const f of allFields(formDef)) {
    if (!f?.id) continue;
    byId.set(bare(f.id), f);
    casilleros(f).forEach((n) => referenced.add(n));
  }
  const values = {};
  const sinCasillero = [];
  for (const [id, v] of Object.entries(simPdf || {})) {
    if (v == null || String(v) === '') continue;
    const f = byId.get(bare(id));
    const names = f ? casilleros(f) : [];
    if (!names.length) { sinCasillero.push(id); continue; }
    names.forEach((n) => { values[n] = typeof v === 'object' ? JSON.stringify(v) : String(v); });
  }
  return { values, referenced, sinCasillero };
}

const isOn = (v) => !/^(|false|off|no|0)$/i.test(String(v).trim());

/**
 * Llena el PDF. opts.referenced: casilleros que usa el form-def (para listar los del PDF sin usar).
 * opts.dummy: completa con datos de prueba los casilleros del form-def que quedaron vacíos.
 * Devuelve { pdfBytes, pintados, noEsta, sinUsar, noEntran, fallos, widgets }.
 *   widgets: [{ name, page, x, y, width, height }] en puntos del PDF (origen abajo a la izquierda).
 */
export async function fillFormPdf(bytes, values, opts = {}) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const referenced = opts.referenced || new Set(Object.keys(values));
  const pages = doc.getPages();
  const pageOf = new Map(pages.map((p, i) => [p.ref.toString(), i + 1]));

  const pintados = [];
  const fallos = [];
  const sinUsar = [];
  const widgets = [];
  const inPdf = new Set();

  for (const f of form.getFields()) {
    const name = f.getName();
    inPdf.add(name);
    try {
      for (const w of f.acroField.getWidgets()) {
        const r = w.getRectangle();
        const pRef = w.P();
        widgets.push({ name, page: (pRef && pageOf.get(pRef.toString())) || 1, x: r.x, y: r.y, width: r.width, height: r.height });
      }
    } catch { /* sin recuadro */ }

    let v = values[name];
    const used = referenced.has(name);
    if (!used && v == null) { sinUsar.push(name); continue; }
    if ((v == null || v === '') && opts.dummy && used) v = f instanceof PDFTextField ? dummyPara(name) : 'X';
    if (v == null || v === '') continue;
    try {
      if (f instanceof PDFTextField) {
        let text = String(v);
        const max = f.getMaxLength?.();
        if (max && text.length > max) {
          fallos.push({ field: name, reason: `Tiene máximo ${max} caracteres y el valor trae ${text.length}: se corta.` });
          text = text.slice(0, max);
        }
        f.setText(text);
      } else if (f instanceof PDFCheckBox) {
        if (isOn(v)) f.check(); else f.uncheck();
      } else if (f instanceof PDFRadioGroup || f instanceof PDFDropdown || f instanceof PDFOptionList) {
        const ops = f.getOptions();
        const hit = ops.find((o) => o === String(v)) ?? (f instanceof PDFRadioGroup && isOn(v) && ops.length === 1 ? ops[0] : null);
        if (hit == null) { fallos.push({ field: name, reason: `El valor «${v}» no es una opción del casillero (${ops.join(', ') || 'sin opciones'}).` }); continue; }
        f.select(hit);
      } else {
        fallos.push({ field: name, reason: 'Tipo de casillero que no se puede llenar (botón o firma).' });
        continue;
      }
      pintados.push(name);
    } catch (e) {
      fallos.push({ field: name, reason: e.message });
    }
  }

  try { form.updateFieldAppearances(font); } catch (e) { fallos.push({ field: '(apariencias)', reason: e.message }); }
  const noEntran = findOverflows(form, font);
  const noEsta = [...referenced].filter((n) => !inPdf.has(n)).sort();
  return { pdfBytes: new Uint8Array(await doc.save()), pintados, noEsta, sinUsar, noEntran, fallos, widgets };
}
