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
  - `src/lib/` — lógica pura, sin React ni DOM (lectura de archivos, json-mapper, quoter, pdf-detect). Se puede testear con Node.
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

Pendientes de integrar: Multi Send (`bulksend`), Generador CSV (`toolsImport`), Email Templates (`HTMLgenerator`), Ficha de formulario y Matriz interna (`public/apps/ficha-formulario`, ex `SingaframeFormBuilder`). Más adelante: Editor PDF (unifica Detector de campos + Convertir PDF de `FormConverterExcel`).

Notas para las que faltan:
- Multi Send y Email Templates usan la API de Signaturit a través de un proxy (Edge Function). Tienen que compartir un mismo cliente en `src/lib/signaturit/` y la misma conexión (entorno + token) entre las dos. La palabra «Supabase» no puede aparecer en la interfaz. El token nunca se guarda en el repo.
- Email Templates trae plantillas de email con sus propios colores: esos HTML no se recolorean con la marca.

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
- `public/apps/ficha-formulario/` ← repo `SingaframeFormBuilder` (copia tal cual, mientras no se integre).
- El resto de `FormConverterExcel` **no** se migra salvo pedido explícito.
