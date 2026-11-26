// Reconoce qué archivo de un formulario es cada uno (para soltar todos juntos en «Crear formulario»).
// Sin React ni DOM. Devuelve el tipo del trabajo (ver src/tools/signaframe-studio/trabajo.js) o null.
import * as XLSX from 'xlsx';

const slug = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');

function formDefOf(j) {
  if (j?.sections) return j;
  for (const c of [j?.formDefinition, j?.definition, j?.data?.jsonDefinition, j?.jsonDefinition, j?.data?.formDefinition]) if (c?.sections) return c;
  return null;
}

/** JSON → 'trabajo' | 'main' | 'formDef' | 'clienteJson'. */
export function detectJson(j) {
  if (j?.tipo === 'se-tools/signaframe-trabajo') return 'trabajo';
  const fd = formDefOf(j);
  if (fd) {
    const fields = [];
    const walk = (list) => (list || []).forEach((f) => { fields.push(f); walk(f.fields); });
    fd.sections.forEach((s) => { walk(s.fields); (s.subsections || []).forEach((x) => walk(x.fields)); });
    // El main es lo que exporta Signaframe al importar el PDF: casilleros sin rutas del JSON.
    const conRuta = fields.filter((f) => f.jsonOutputPath || f.prefillKey).length;
    return conRuta === 0 && fields.some((f) => f.sourceMeta) ? 'main' : 'formDef';
  }
  return 'clienteJson';
}

/** Excel → 'matriz' (matriz interna) | 'ficha' (la de Crear formulario) | 'matrizIns' (la del INS) | null. */
export function detectXlsx(bytes) {
  const wb = XLSX.read(bytes, { type: 'array', sheetRows: 25 });
  const names = wb.SheetNames.map(slug);
  if (names.includes('formulario_signaframe')) return 'matriz';
  if (names.includes('formulario') && (names.includes('json_del_cliente') || names.includes('opciones'))) return 'ficha';
  for (const n of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
    if (rows.some((r) => r.some((c) => slug(c) === 'pasos_formulario'))) return 'matrizIns';
  }
  return null;
}

/** Un archivo (nombre + bytes) → { tipo, data } o { tipo: null, motivo }. data: objeto (JSON) o los bytes. */
export function detectFile(name, bytes) {
  const ext = String(name).toLowerCase().split('.').pop();
  if (ext === 'pdf') return { tipo: 'pdfOriginal', data: bytes };
  if (ext === 'json') {
    let j;
    try { j = JSON.parse(new TextDecoder().decode(bytes)); } catch { return { tipo: null, motivo: 'no es un JSON válido' }; }
    return { tipo: detectJson(j), data: j };
  }
  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const tipo = detectXlsx(bytes);
      return tipo ? { tipo, data: bytes } : { tipo: null, motivo: 'no parece la matriz del INS, la ficha ni la matriz interna' };
    } catch { return { tipo: null, motivo: 'no se pudo leer el Excel' }; }
  }
  return { tipo: null, motivo: 'tipo de archivo que no se usa acá' };
}
