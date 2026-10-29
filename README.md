# PS Tools · Namirial Professional Services

Hub único con todas las herramientas del equipo de Professional Services.
Todo el código vive en este repo: el hub (React + Vite) y cada herramienta en su propia carpeta.

## Estructura

```
src/config/tools.js      ← secciones y herramientas (único lugar a editar)
src/pages/               ← Inicio (lanzador) y página genérica de herramienta
src/components/          ← layout (menú, barra superior) y embed
src/styles/variables.css ← tokens de marca Namirial (Open Sans, paleta teal)
public/tools/<id>/       ← código de cada herramienta migrada (index.html + assets)
```

## Sumar o reordenar una herramienta

1. Copiá la herramienta a `public/tools/<id>/` (con su `index.html`).
2. Agregá una entrada en `TOOLS` dentro de `src/config/tools.js`:

```js
{
  id: 'mi-herramienta',
  section: 'signaframe',            // id de una sección de SECTIONS
  name: 'Mi herramienta',
  description: 'Qué hace, en una línea.',
  icon: 'FileJson',                 // ver lista en src/components/common/ToolIcon.jsx
  src: local('mi-herramienta'),     // → public/tools/mi-herramienta/
},
```

El menú, el inicio y la ruta `/tools/mi-herramienta` se generan solos.
Para reordenar, mové la entrada dentro del array. Para cambiar el orden de las secciones, reordená `SECTIONS`.

Las herramientas que todavía tienen una URL `https://…` en `src` están pendientes de migrar desde su repo anterior.

## Desarrollo

```bash
npm ci
npm run dev      # http://localhost:5173/PShome/
npm run build    # genera dist/
```

El deploy a GitHub Pages corre solo con cada push a `main` (`.github/workflows/deploy.yml`).
