# PS Tools · Namirial Professional Services

Hub único con todas las herramientas del equipo de Professional Services.
Todo el código vive en este repo: el hub (React + Vite) y cada herramienta en su propia carpeta.

## Estructura

```
src/config/tools.js      ← secciones y herramientas (único lugar a editar para el menú y el inicio)
src/pages/               ← Inicio (lanzador) y página genérica de herramienta
src/components/          ← layout (menú, barra superior) y embed
src/styles/variables.css ← tokens de marca Namirial (Open Sans, paleta teal)

apps/<id>/               ← herramientas que se construyen con Vite (index.html + main.js)
apps/_lib/               ← lógica y estilos compartidos por esas herramientas
public/apps/<id>/        ← herramientas estáticas que se publican tal cual (HTML sin build)
```

Las dos carpetas de herramientas terminan publicadas en la misma URL: `/PShome/apps/<id>/`.

## Herramientas

| Herramienta | Sección | Dónde está el código |
|---|---|---|
| Ficha de formulario · Matriz interna | Signaframe | `public/apps/ficha-formulario/` (ex SingaframeFormBuilder) |
| Comparador JSON | Signaframe | `apps/comparador-json/` + `apps/_lib/json-mapper/` (ex FormConverterExcel, «Mapa JSON») |
| Cotizador | Planificación y seguimiento | `apps/cotizador/` + `apps/_lib/quoter/` (ex FormConverterExcel) |
| Multi Send, Generador CSV, Email Templates, Gantt | varias | pendientes de migrar: hoy cargan desde su repo anterior |

## Sumar o reordenar una herramienta

1. Poné el código en una de las dos carpetas:
   - **Estática** (HTML/JS sin build): `public/apps/<id>/index.html`.
   - **Con build** (usa paquetes de npm o módulos de `apps/_lib`): `apps/<id>/index.html` + `apps/<id>/main.js`. Vite la detecta sola.
2. Agregá una entrada en `TOOLS` dentro de `src/config/tools.js`:

```js
{
  id: 'mi-herramienta',
  section: 'signaframe',            // id de una sección de SECTIONS
  name: 'Mi herramienta',
  description: 'Qué hace, en una línea.',
  icon: 'FileJson',                 // ver lista en src/components/common/ToolIcon.jsx
  src: local('mi-herramienta'),     // → /PShome/apps/mi-herramienta/
},
```

El menú, el inicio y la ruta `/tools/mi-herramienta` se generan solos.
Para reordenar, mové la entrada dentro del array. Para cambiar el orden de las secciones, reordená `SECTIONS`.

## Desarrollo

```bash
npm ci
npm run dev      # http://localhost:5173/PShome/  (las apps: /PShome/apps/<id>/)
npm run lint
npm run build    # genera dist/
```

El deploy a GitHub Pages corre solo con cada push a `main` (`.github/workflows/deploy.yml`).

## Datos de clientes

No se commitean PDFs, Excel ni JSON de clientes: el `.gitignore` los bloquea. Las únicas excepciones son
los archivos de referencia sin datos reales (`public/apps/*/docs/plantilla_referencia_*`, `diccionario_*`, `catalogo_*`).
