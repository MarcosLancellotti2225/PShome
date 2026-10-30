# CLAUDE.md — PS Tools (app de Namirial Professional Services)

Una sola app React con todas las herramientas del equipo de PS. Antes de tocar nada, leé `README.md`.

## Cómo se trabaja

- Idioma: español rioplatense, informal en el chat. Textos de la interfaz: español claro, frases cortas, sin jerga técnica.
- Plan primero: proponer el plan y esperar confirmación antes de cambios grandes o que borren cosas.
- Commits en formato `vX.Y.Z Descripción` (ej. `v2.1.0 Multi Send integrado`).
- Trabajar en una branch y abrir PR a `main`. `main` publica a GitHub Pages solo.
- Después de cada cambio: `npm run lint` y `npm run build` tienen que pasar.

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

Más adelante: Editor PDF (unifica Detector de campos + Convertir PDF de `FormConverterExcel`).

## Marca

- Tokens del Namirial Design System en `src/styles/variables.css`. Fuente Open Sans.
- Paleta: accent teal (`--color-primary` `#047c76`, `--color-primary-strong` `#00a69d`, `--color-primary-deep` `#012825`), neutros gris verdoso, superficies `#f0f3f8` / `#ffffff`.
- No meter colores sueltos en los componentes: usar los tokens.

## Datos de clientes

- Nunca commitear PDFs, Excel ni JSON de clientes (el `.gitignore` los bloquea). Para pruebas, generar archivos sintéticos.
- Todo se procesa en el navegador; ninguna herramienta sube archivos a un servidor (salvo las llamadas a la API de Signaturit que el usuario dispara).

## Origen del código

- `src/lib/json-mapper`, `src/lib/quoter`, `src/lib/pdf-detect` ← `FormConverterExcel/src/` (CommonJS → ES modules, sin cambios de lógica).
- `src/tools/gantt` ← repo `GranttGenerator`.
- `legacy-src/multi-send` ← `bulksend`, `legacy-src/csv-generator` ← `toolsImport`, `legacy-src/email-templates` ← `HTMLgenerator`, `legacy-src/ficha-formulario` + `public/apps/ficha-formulario` ← `SingaframeFormBuilder`.
- El resto de `FormConverterExcel` **no** se migra salvo pedido explícito.
