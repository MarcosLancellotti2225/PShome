# PS Tools · Namirial Professional Services

Una sola app con todas las herramientas del equipo de Professional Services. Sin iframes: cada herramienta es una pantalla de la app y se descarga recién cuando la abrís.

## Estructura

```
src/config/tools.js      ← secciones y herramientas (único lugar a editar para el menú y el inicio)
src/tools/<id>/          ← la pantalla de cada herramienta integrada
src/lib/                 ← lógica compartida, sin interfaz (archivos, json-mapper, quoter, pdf-detect)
src/components/ui/       ← componentes comunes con la marca (botones, carga de archivos, tablas…)
src/components/layout/   ← menú lateral y barra superior
src/styles/variables.css ← tokens de marca Namirial (Open Sans, paleta teal)
public/apps/             ← herramientas viejas que todavía no están integradas (se abren en pestaña nueva)
```

## Estado de las herramientas

| Herramienta | Sección | Estado |
|---|---|---|
| Gantt Generator | Planificación y seguimiento | ✅ integrada (`src/tools/gantt`) |
| Cotizador | Planificación y seguimiento | ✅ integrada (`src/tools/cotizador`) |
| Comparador JSON | Signaframe | ✅ integrada (`src/tools/comparador-json`) |
| Ficha de formulario · Matriz interna | Signaframe | ⏳ versión anterior (`public/apps/ficha-formulario`) |
| Multi Send | Firma y envíos | ⏳ versión anterior (repo `bulksend`) |
| Generador CSV | Alta de clientes | ⏳ versión anterior (repo `toolsImport`) |
| Email Templates | Comunicación | ⏳ versión anterior (repo `HTMLgenerator`) |

## Sumar o reordenar una herramienta

1. Creá la pantalla en `src/tools/<id>/index.jsx` (export default) usando los componentes de `src/components/ui`.
2. Agregá la entrada en `TOOLS` dentro de `src/config/tools.js`:

```js
{
  id: 'mi-herramienta',
  section: 'signaframe',            // id de una sección de SECTIONS
  name: 'Mi herramienta',
  description: 'Qué hace, en una línea.',
  icon: 'FileJson',                 // ver lista en src/components/common/ToolIcon.jsx
  load: () => import('../tools/mi-herramienta/index.jsx'),
},
```

El menú, el inicio y la ruta `/tools/mi-herramienta` se generan solos.
Para reordenar, mové la entrada dentro del array. Para cambiar el orden de las secciones, reordená `SECTIONS`.

## Desarrollo

```bash
npm ci
npm run dev      # http://localhost:5173/PShome/
npm run lint
npm run build    # genera dist/
```

El deploy a GitHub Pages corre solo con cada push a `main` (`.github/workflows/deploy.yml`).

## Datos de clientes

No se commitean PDFs, Excel ni JSON de clientes: el `.gitignore` los bloquea. Todo se procesa en el navegador.
