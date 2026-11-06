// Armador del JSON del formulario (src/lib/signaframe-formdef) para las herramientas clásicas.
// Lo expone en window.SeFormDef, igual que pdfLibs con las librerías de PDF.
import { buildFormDef, formDefFromMatrixXlsx } from '../../lib/signaframe-formdef/index.js';
import { revisar } from '../../lib/json-mapper/revisor/reglas.js';
import { construirModelo } from '../../lib/json-mapper/revisor/modelo.js';

if (typeof window !== 'undefined') {
  window.SeFormDef = {
    buildFormDef,
    formDefFromMatrixXlsx,
    /** Hallazgos del Revisor de Signaframe Studio sobre un form-def. */
    revisar: (fd) => { try { return revisar(construirModelo(fd)); } catch { return []; } },
  };
}
