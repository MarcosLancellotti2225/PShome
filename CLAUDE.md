# CLAUDE.md — SE Tools (app de herramientas de Namirial)

Una sola app React con todas las herramientas del equipo. Antes se llamaba «PS Tools»: las claves internas de guardado (`pstools`) no cambian para no perder el trabajo guardado. Antes de tocar nada, leé `README.md`.

## Cómo se trabaja

- Idioma: español rioplatense, informal en el chat. Textos de la interfaz: español claro, frases cortas, sin jerga técnica.
- Plan primero: proponer el plan y esperar confirmación antes de cambios grandes o que borren cosas.
- Commits en formato `vX.Y.Z Descripción` (ej. `v2.1.0 Multi Send integrado`).
- Trabajar en una branch y abrir PR a `main`. `main` publica a GitHub Pages solo.
- Después de cada cambio: `npm run lint`, `npm test` y `npm run build` tienen que pasar.

## Arquitectura (no cambiar sin hablarlo)

- **Una sola app, sin iframes.** Cada herramienta es una pantalla de React en `src/tools/<id>/index.jsx` (export default), que se descarga recién cuando se abre (`React.lazy`).
- `src/config/tools.js` es el **único** lugar donde se declaran secciones y herramientas. Cada herramienta tiene `load: () => import('../tools/<id>/index.jsx')` (integrada) o `href` (todavía no integrada: se abre en pestaña nueva). Menú, inicio y rutas salen de ahí.
- Tres capas:
  - `src/lib/` — lógica pura, sin React ni DOM (lectura de archivos, json-mapper, quoter, pdf-detect, conexión Signaturit). Se puede testear con Node.
  - `src/components/ui/` — componentes comunes con la marca: `Button`, `Panel`, `FileDrop`, `Alert`, `Stats`, `Field`, `Tabs`, `Badge`, `DataTable`, `ConfirmButton`. Usalos siempre; no armes botones, cargas de archivo ni tablas a mano.
  - `src/tools/<id>/` — la pantalla de cada herramienta y su CSS propio (prefijo de clases corto y único, ej. `cz-` para el cotizador).
- Librerías (xlsx, pdf-lib, jszip, html2canvas…) se instalan con npm y se importan; nunca desde un CDN. Las pesadas, con `import()` dinámico.
- `ToolPage` envuelve cada herramienta en un ErrorBoundary: si una falla, el resto sigue andando.
- Nada de `alert()`/`confirm()`: usar `Alert` y `ConfirmButton`.

## Cómo integrar una herramienta vieja

1. Separar la lógica (parsers, cálculos, llamadas a API) en `src/lib/<algo>/` como ES modules, sin cambiar lo que hace.
2. Rehacer la interfaz en `src/tools/<id>/index.jsx` con los componentes de `src/components/ui`.
3. Cambiar `href` por `load` en `src/config/tools.js`.
4. Comparar contra la versión vieja con los mismos archivos de entrada: los resultados tienen que ser idénticos.
5. Recién entonces se puede archivar el repo viejo.

## Herramientas clásicas (montadas con el adaptador)

Multi Send, Generador CSV, Email Templates, Ficha de formulario y Matriz interna corren con su código original:
- El original vive en `legacy-src/<id>/` (ver `legacy-src/README.md`).
- `npm run legacy` lo convierte con `scripts/legacy/convert.mjs` en `src/tools/<id>/legacy/` (markup, CSS encapsulado bajo `.lg-<id>` con la paleta Namirial, y el JS dentro de `mount()`). **No edites `legacy/` a mano**: editá `legacy-src/` o la config `scripts/legacy/<id>.config.mjs` y regenerá.
- `src/tools/_legacy/LegacyTool.jsx` la monta una vez por sesión y la mantiene viva al cambiar de pantalla.
- Sus librerías (xlsx, papaparse, mammoth, pdf.js 3.11, pdf-lib, ExcelJS) salen de npm (`src/tools/_legacy/pdfLibs.js` y cada `index.jsx`).
- Siguen usando `alert()`/`confirm()` propios: se reemplazan cuando cada una pase a React.
- La meta es pasarlas de a una a React con `src/components/ui` (como Gantt, Comparador y Cotizador) y borrar su carpeta de `legacy-src/`.

Reglas:
- Multi Send y Email Templates comparten la conexión de Signaturit (entorno + token) con `src/lib/signaturit/session.js`, solo en memoria. El token nunca se guarda en el navegador ni en el repo. La palabra «Supabase» no puede aparecer en la interfaz. El proxy está en `supabase/functions/signaturit-proxy/`.
- Email Templates trae plantillas de email con sus propios colores: esos HTML no se recolorean (su config solo recolorea `styles.css`).
- La Ficha abre el paso opcional «Matriz del INS» (`public/apps/ficha-formulario/mapear.html`) en un panel interno: es lo único que falta unificar.

## JSON del formulario (`src/lib/signaframe-formdef`)

Reemplaza a `matriz_io.py build`: arma el form-def de Signaframe desde la matriz interna.
- `buildFormDef(matrix, main)`: pasos/subsecciones/campos + main → form-def. El `sourceMeta` (y el id) de cada campo con «Casillero PDF» sale del main tal cual (regla de oro); si la matriz trae otro id, usa el del main y corrige las referencias. Deriva `order`, `childrenOrder`, `salidaJSON` y `prefillMode: "optional"`. Lo que el main tiene y la matriz no usa va oculto en «Campos del PDF sin usar». Firmas sin ubicar: posición provisoria y aviso.
- `readMatrixXlsx` / `formDefFromMatrixXlsx`: lee el Excel de la matriz interna (hojas «Formulario Signaframe» y «Opciones»).
- Las herramientas clásicas lo usan con `window.SeFormDef` (`src/tools/_legacy/formDef.js`), con el Revisor de Studio.
- `npm test` corre `test/signaframe-formdef.test.mjs`; con la ruta a un form-def real hace la ida y vuelta form-def → matriz → form-def y compara también con el motor de Signaframe (mismo JSON y mismo PDF).

## Editor PDF (`src/tools/editor-pdf`)

Une el Detector de campos y Convertir PDF de `FormConverterExcel`.
- Lógica en `src/lib/pdf-editor/`: `rewriter.js` es el motor de Convertir PDF portado (único cambio marcado «SE Tools»: mover/regenerar apariencia cuando el recuadro es un único hijo del campo); `pdf-tools.js` (fuentes, datos de prueba, etiquetas); `model.js` (claves de campo, validación, cambios → parámetros del motor, cruce con Excel); `excel.js` (importar/exportar «AcroForm Actual / Propuesto»).
- La clave de cada campo es la misma que usa el motor: `nombre#widget` en grupos, `nombre#n` en repetidos, `nombre` en el resto.
- `npm test` corre `test/pdf-editor.test.mjs`; con la ruta a FormConverterExcel como argumento compara contra el motor original.
- Deshacer/rehacer en `state.js`; el trabajo se guarda en IndexedDB (`storage.js`) para retomarlo.

## Cotizador (`src/tools/cotizador`)

- Arriba, «Cotización según contrato»: `src/lib/quoter/contract.js` lee la ficha (columna «Nombre del campo en formulario») y cotiza cada formulario con el Rubro 2 de la propuesta INS–Namirial del 21/10/2025.
- Campos = editables de la ficha (también los prellenados que se pueden cambiar); no cuentan los bloqueados («Disabled»), los informativos ni los que van solo al JSON. Varias filas del mismo campo (opciones de un combo) cuentan una vez.
- Reglas = todos los textos distintos de «Regla» y «Observaciones» de cada campo (validaciones, condicionales, cálculos, otras), salvo «No aplica…», «Referencia…» y «Aplica para…».
- Nivel = el mayor entre el que piden los campos y el que piden las reglas. 15 campos es Baja. Arriba de 50 campos: grupos de 5 (un grupo empezado cuenta entero). Reglas arriba de 30: horas a estimar a USD 99.
- Una ficha = un formulario web (es lo que cobra el contrato). Los códigos de PDF salen solo de «Formulario a visualizar» y de «No aplica Formulario X» (también numéricos, ej. 1008172). Cada ficha se empareja con su PDF por el nombre.
- Grupo (`quoteItems`): con varios formularios se puede cotizar en grupo. El principal (por defecto el más grande) se cobra completo; los demás solo por los campos y reglas que no estaban en los anteriores (mínimo Baja).
- Explicación para el cliente (`explainQuote`): se arma con los números del ZIP; sale en la pantalla, en «Copiar resumen» y en los reportes.
- Los precios están en `CONTRACT_PRICING` y se pueden editar en la pantalla (se guardan en el navegador).
- Abajo, plegado, el análisis por puntos de antes (solo de referencia interna).
- Los reportes (HTML, PDF y Word) salen de `reportModel` en `contract.js`, con los precios y las horas de la pantalla: dicen lo mismo que la cotización.
- `npm test` corre también `test/quoter.test.mjs` (ficha sintética).

## Marca

- Tokens del Namirial Design System en `src/styles/variables.css`. Fuente Open Sans.
- Paleta: accent teal (`--color-primary` `#047c76`, `--color-primary-strong` `#00a69d`, `--color-primary-deep` `#012825`), neutros gris verdoso, superficies `#f0f3f8` / `#ffffff`.
- No meter colores sueltos en los componentes: usar los tokens.

## Datos de clientes

- Nunca commitear PDFs, Excel ni JSON de clientes (el `.gitignore` los bloquea). Para pruebas, generar archivos sintéticos.
- Todo se procesa en el navegador; ninguna herramienta sube archivos a un servidor (salvo las llamadas a la API de Signaturit que el usuario dispara).

## Origen del código

- `src/lib/json-mapper`, `src/lib/quoter`, `src/lib/pdf-detect` ← `FormConverterExcel/src/` (CommonJS → ES modules). `pdf-detect` lee también campos cuyo recuadro es un único hijo.
- `src/lib/pdf-editor` ← `FormConverterExcel` (pdf-rewriter.js + funciones de fuente, datos de prueba y etiquetas de browser.js).
- `src/tools/gantt` ← repo `GranttGenerator`.
- `legacy-src/multi-send` ← `bulksend`, `legacy-src/csv-generator` ← `toolsImport`, `legacy-src/email-templates` ← `HTMLgenerator`, `legacy-src/ficha-formulario` + `public/apps/ficha-formulario` ← `SingaframeFormBuilder`.
- El resto de `FormConverterExcel` **no** se migra salvo pedido explícito.
- `src/lib/signaframe-engine` ← front de Signaframe (commit `d270aa3`), convertido con `tsc`. `services/` y `lib/` van tal cual; ver su README antes de tocarlo.

## Signaframe Studio y MCP

- `src/tools/signaframe-studio`: simula un formulario con `signaframe-engine` (el motor real del front), muestra el JSON que sale, los AcroForms, diagnósticos y el Revisor; cada cambio en el formulario vuelve a simular. Abre «trabajos» (.json, `tipo: se-tools/signaframe-trabajo`).
- `mcp/server.mjs`: MCP local (Node, stdio) que le da a Claude la lógica de `src/lib` (simular, revisar, comparar JSON, detectar campos del PDF). Guarda los trabajos en `SE_TOOLS_TRABAJOS`. Ver `mcp/README.md`.
- Matriz: `leer_matriz` y `editar_matriz` (`src/lib/signaframe-formdef/matrix-edit.js`, ExcelJS: conserva el formato y guarda una versión nueva).
- Signaframe: tools `signaframe_*` con `src/lib/signaframe-api` (cliente de la API, swagger en `https://signaframe.namirial.com/api/swagger`). Credenciales por env (`SIGNAFRAME_URL`, `SIGNAFRAME_EMAIL`/`SIGNAFRAME_PASSWORD` o `SIGNAFRAME_TOKEN`). Todo lo que cambia algo (subir form-def, publicar, crear proceso) pide un código de confirmación; subir guarda copia y frena si `diffFormDefs` marca la regla de oro o el Revisor da errores. Los procesos de prueba nunca mandan el mail. No hay tools para borrar, usuarios ni settings.
- Regla: el MCP **no tiene lógica propia**. Todo lo que hace tiene que vivir en `src/lib` para que la app y Claude den lo mismo.
