# CLAUDE.md — PS Tools (hub de Namirial Professional Services)

Hub único con las herramientas internas del equipo de PS. Antes de tocar nada, leé `README.md`.

## Cómo se trabaja

- Idioma: español rioplatense, informal en el chat. Textos de la interfaz: español claro, frases cortas, sin jerga técnica.
- Plan primero: proponer el plan y esperar confirmación antes de cambios grandes o que borren cosas.
- Commits en formato `vX.Y.Z Descripción` (ej. `v1.2.0 Editor PDF: deshacer y rehacer`).
- Trabajar en una branch y abrir PR a `main`. `main` publica a GitHub Pages solo.
- Después de cada cambio: `npm run lint` y `npm run build` tienen que pasar.

## Arquitectura (no cambiar sin hablarlo)

- `src/config/tools.js` es el **único** lugar donde se declaran secciones y herramientas. Menú, inicio y rutas salen de ahí. No crear páginas sueltas por herramienta.
- El hub muestra cada herramienta en un iframe (`ToolEmbed`) por la ruta `/tools/:id`.
- El código de las herramientas vive en `apps/<id>/` (con build de Vite) o `public/apps/<id>/` (estático). Las dos se publican en `/PShome/apps/<id>/`. **Nunca** usar `public/tools/`: choca con las rutas `/tools/:id` del hub.
- `vite.config.js` detecta solo cada `apps/<id>/index.html`. Las carpetas que empiezan con `_` (`apps/_lib`) son código compartido.
- Lógica en módulos puros (`apps/_lib/...`), interfaz en `apps/<id>/main.js`. Los módulos de `_lib` son ES modules sin dependencias del DOM.
- Una herramienta embebida en el hub oculta su propia cabecera (`apps/_lib/ui.js` agrega `html.embedded`).

## Marca

- Tokens del Namirial Design System: hub en `src/styles/variables.css`, herramientas en `apps/_lib/form-tools.css` (`:root`).
- Fuente Open Sans. Paleta: accent teal (`#047c76` principal, `#00a69d` fuerte, `#012825` fondo oscuro), neutros gris verdoso, superficies `#f0f3f8` / `#ffffff`.
- No meter colores sueltos en los componentes: usar los tokens.

## Datos de clientes

- Nunca commitear PDFs, Excel ni JSON de clientes (el `.gitignore` los bloquea). Para pruebas, generar archivos sintéticos.
- Todo se procesa en el navegador; ninguna herramienta sube archivos a un servidor.

## Origen del código migrado

- `public/apps/ficha-formulario/` ← repo `SingaframeFormBuilder` (copiado tal cual).
- `apps/_lib/json-mapper`, `apps/_lib/quoter`, `apps/_lib/pdf-detect` ← `FormConverterExcel/src/` (convertidos de CommonJS a ES modules, sin cambios de lógica).
- El resto de `FormConverterExcel` **no** se migra salvo pedido explícito.
