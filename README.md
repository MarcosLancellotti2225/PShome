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
legacy-src/              ← código original de las herramientas clásicas (npm run legacy las convierte)
scripts/legacy/          ← conversor y configuración de cada herramienta clásica
public/apps/             ← archivos que se sirven tal cual (paso «Matriz del INS» y docs de la Ficha)
supabase/functions/      ← proxy de la API de Signaturit (Edge Function)
```

## Estado de las herramientas

| Herramienta | Sección | Estado |
|---|---|---|
| Gantt Generator | Planificación y seguimiento | ✅ integrada (`src/tools/gantt`) |
| Cotizador | Planificación y seguimiento | ✅ integrada (`src/tools/cotizador`) |
| Comparador JSON | Signaframe | ✅ integrada (`src/tools/comparador-json`) |
| Ficha de formulario · Matriz interna | Signaframe | ✅ integrada con su código original (`legacy-src/ficha-formulario`) |
| Multi Send | Firma y envíos | ✅ integrada con su código original (`legacy-src/multi-send`) |
| Generador CSV | Alta de clientes | ✅ integrada con su código original (`legacy-src/csv-generator`) |
| Email Templates | Comunicación | ✅ integrada con su código original (`legacy-src/email-templates`) |

Las que dicen «código original» corren tal cual eran, montadas como pantallas de la app (ver `legacy-src/README.md`). Se van pasando a React de a una.

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
npm run legacy   # regenera las herramientas clásicas desde legacy-src/
```

El deploy a GitHub Pages corre solo con cada push a `main` (`.github/workflows/deploy.yml`).

## Datos de clientes

No se commitean PDFs, Excel ni JSON de clientes: el `.gitignore` los bloquea. Todo se procesa en el navegador.
