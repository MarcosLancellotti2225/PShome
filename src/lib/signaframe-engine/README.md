# Motor de Signaframe (copia del front)

El mismo código que usa el formulario real de Signaframe para armar lo que se
manda al INS. Con esto, SE Tools y el MCP simulan un formulario **sin crear un
proceso** y el resultado es el que emitiría Signaframe.

## Origen

- Front de Signaframe (`front/src`), último commit `d270aa3` «Corrigió autoFillConcat vacío».
- Convertido de TypeScript a JS con `tsc` (no a mano), como el Revisor.
- `services/`, `lib/`: copiados tal cual. Único cambio: imports `@/…` → rutas relativas con `.js`.
- `components/FormDefinitionEditor.js`: **shim**. Sólo `parseVisibilityConfig`, copiado del componente
  original, sin React (es lo único que el motor usaba de ese archivo).
- Propio de SE Tools: `simulate.js`, `index.js`.

Lint: `services/`, `lib/` y `components/` tienen apagadas dos reglas de estilo en `eslint.config.js`
para no tocar el original.

## API

```js
import { simulate } from './signaframe-engine/index.js';

const r = simulate({
  formDefinition,          // form-def (objeto con sections)
  payload,                 // body del POST /api/processes
  edits: { field_x: 'v' }, // opcional: lo que cargaría la persona
  expectedJson,            // opcional: JSON que debería salir
});
// r.json  → lo que recibe el INS     r.pdf → valor de cada AcroForm
// r.issues, r.diff, r.hiddenByRule, r.validationErrors, r.stats
```

Pasos (igual que `FlowFormPage` → autoguardado → `FlowReviewPage` → submit):
prefill y defaults → edits → `applyAutoFillConcat` → ocultos por regla vacíos →
cierre de grupos radio → `transformFormDataForApi`.

Diagnósticos propios: `PREFILL_SIN_OPCION`, `PREFILL_AUSENTE`, `PAYLOAD_SIN_USO`,
`VALIDACION`, `OBLIGATORIO_OCULTO`, `JSON_FALTANTE/SOBRANTE/DISTINTO`.

## Si el front cambia

Volver a copiar los archivos del front, convertir con `tsc`, y correr `npm test`
(incluye los tests originales del front).
