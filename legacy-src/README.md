# legacy-src — código original de las herramientas clásicas

Acá está, sin cambios, el código de las herramientas que venían de otros repos. La app **no** lo usa directamente:
`npm run legacy` lo convierte en pantallas montables (`src/tools/<id>/legacy/`) con `scripts/legacy/convert.mjs`.

| Carpeta | Repo de origen | Pantalla |
|---|---|---|
| `multi-send/` | bulksend | `src/tools/multi-send` |
| `csv-generator/` | toolsImport | `src/tools/csv-generator` |
| `email-templates/` | HTMLgenerator | `src/tools/email-templates` |
| `ficha-formulario/` (index.html, interno.html) | SingaframeFormBuilder | `src/tools/ficha-formulario`, `src/tools/matriz-interna` |

`mapear.html` (paso «Matriz del INS» de la Ficha) y `docs/` siguen en `public/apps/ficha-formulario/` porque se sirven tal cual.
El proxy de la API de Signaturit está en `supabase/functions/signaturit-proxy/`.

## Cómo cambiar una herramienta clásica

1. Editá el original en esta carpeta.
2. Corré `npm run legacy` (regenera `src/tools/*/legacy/`; el script falla si un botón llama a una función que no existe).
3. `npm run lint && npm run build`, probalo y abrí el PR.

## Diccionario INS nuevo (Ficha de formulario)

```bash
node legacy-src/ficha-formulario/tools/build_dic.mjs public/apps/ficha-formulario/docs/diccionario_vXX.xlsx \
  legacy-src/ficha-formulario/index.html legacy-src/ficha-formulario/interno.html public/apps/ficha-formulario/mapear.html
npm run legacy
```

## Hacia adelante

La meta es que cada una pase a ser una pantalla de React con los componentes de `src/components/ui`
(como el Gantt, el Comparador JSON o el Cotizador). Cuando eso pase, su carpeta de acá se borra.
