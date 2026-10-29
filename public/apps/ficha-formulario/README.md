# Ficha de formulario

Herramienta para armar formularios a partir de un PDF y del JSON del cliente.

**Abrir la herramienta:** desde PS Tools → Signaframe → Ficha de formulario (o Matriz interna).

Migrada desde el repo `SingaframeFormBuilder`. Vive en `public/apps/ficha-formulario/` del hub y se publica junto con él.

## Qué hace cada paso

0. **Nombres del PDF** — sube el PDF tal como viene, propone nombres para cada casillero (AcroForm) y baja el PDF renombrado. Si el PDF ya viene renombrado (nombres con sentido, no Text12 / Check Box3), los conserva.
1. **JSON del cliente** — sube o pega el JSON de ejemplo y lo aplana en una fila por dato.
2. **Matriz del INS** (opcional) — si el INS mandó su matriz (la ficha en Excel), se sube acá y se cruza con el PDF del paso 0 y el JSON del paso 1 (ver «Matriz del INS» más abajo). «Pasar al formulario» arma el paso 3 con esas preguntas. Si no la hay, «No la tengo» sigue al paso 3.
3. **Armar el formulario** — secciones y preguntas (con condiciones y ocultos), conectadas a sus casilleros del PDF y a su dato del JSON. Plantilla Excel de ida y vuelta para el cliente: *Bajar plantilla de preguntas*, editarla y volver a subirla.
4. **Probar** — el formulario funcionando, con el PDF llenándose en vivo y el JSON que sale. Desde acá se baja el PDF completado, el JSON y la ficha (.xlsx).

Trae un PDF y un JSON de ejemplo inventados para probarla sin datos reales.

## Plantilla de preguntas (Excel)

En el paso 2, «Bajar plantilla de preguntas» genera un Excel con el formato de `docs/plantilla_referencia_v12.xlsx`:

- **Preguntas** (la hoja de trabajo): una fila por pregunta (una fecha es una sola fila de tipo Fecha). Sección sale de una lista (se puede escribir una nueva) y Subsección es una lista que depende de la sección. **Ruta JSON** se elige de la lista del JSON cargado y «Valor en el JSON» muestra el dato de ejemplo (o «no está en el JSON»). Una ruta con `[i]` hace que la pregunta se repita. Cada sección tiene su color, aunque se agreguen filas al final. Tipo «Dato oculto» = no se le muestra a la persona; en Reglas / formato va el origen (Valor fijo / Viene del sistema / Se calcula). La columna **ID (no tocar)** conserva las conexiones al PDF y al JSON; las filas nuevas van sin ID.
- **JSON del cliente**: cada ruta del JSON cargado con su valor de ejemplo y si alguna pregunta ya la usa. Los arrays de varios elementos aparecen como `[i]`; los de uno solo, como `[0]`.
- **Cómo se completa**: ayuda fija, con la equivalencia con el machote del INS.
- **Listas** (oculta): secciones y subsecciones del machote más las del proyecto.

Al subirla, la herramienta agrupa siempre por Sección y Subsección (en el orden en que aparecen por primera vez; «Datos del sistema (oculto)» primero), así que una fila agregada al final de la hoja queda en su lugar. ¿Va? = No elimina la pregunta; una ruta que no está en el JSON da una advertencia; se muestra un resumen con actualizadas, nuevas, eliminadas y condiciones a revisar. También se pueden subir plantillas de los formatos anteriores.

Una pregunta Fecha conectada a 3 casilleros reparte día / mes / año (por el sufijo `_dia` / `_mes` / `_ano` o por orden, y se puede cambiar a mano en el editor). «En el PDF va partido en» (ej.: `código / número`) asigna cada casillero a una parte al conectarlos. El máximo de una pregunta repetible se define en el editor (por defecto, la cantidad de filas del PDF o 5).

## Diccionario General del INS

La herramienta trae adentro el Diccionario General INS–Namirial (`docs/diccionario_v10.xlsx`, hoja «Diccionario (Namirial)», 182 campos): para cada dato, su nombre en el formulario web, sinónimos y nombre en el PDF, su nombre AcroForm según la regla de nombres, Paso, Sección, ruta JSON y si es visible u oculto. También trae la «Lista de nombres PDF» (730 nombres AcroForm listos, cada uno con su ruta). Con eso:

- **Paso 1**: cada dato del JSON dice si coincide con el diccionario (✓), si coincide salvo lista / objeto (≠) o si no está, y arriba se ve «N datos encontrados · M coinciden con el Diccionario INS».
- **Paso 2**: al armar las preguntas desde el PDF y el JSON, lo que se reconoce en el diccionario (por su ruta en el JSON) va a su Paso / Sección, con el nombre web y la ruta; los campos que el diccionario marca como ocultos quedan como «Dato oculto». Cada pregunta muestra ✓ / ≠ Diccionario, y el editor tiene el bloque «Diccionario INS» con el botón «Usar la del diccionario». Al sugerir una ruta, primero se usa la del diccionario.
- **Ficha**: columnas «Ruta del diccionario» y «Estado vs. diccionario».

La plantilla de preguntas mantiene el formato v12 (las listas de Sección / Subsección suman los pasos y secciones del diccionario).

### Cuando el INS mande una versión nueva del diccionario

1. Guardala en `docs/` (por ejemplo `docs/diccionario_v11.xlsx`). Tiene que tener la hoja «Diccionario (Namirial)» (o «Diccionario General») con las mismas columnas.
2. Corré `node tools/build_dic.mjs docs/diccionario_v11.xlsx` (solo necesita Node; no instala nada). Reemplaza la constante `DIC` que está entre los marcadores `/*DIC:start*/` y `/*DIC:end*/` de `index.html`, `mapear.html` e `interno.html`, y dice cuántos campos leyó.
3. Abrí un PR con los archivos y mergealo.

## Matriz del INS (paso 2, opcional)

Cuando el INS manda su matriz (la ficha en Excel), el paso 2 la cruza con el PDF renombrado y el JSON del cliente y la contrasta con el Diccionario INS. Corre en `mapear.html` dentro de un marco (abrir `mapear.html` solo lleva a este paso). No cambia el PDF.

- **Solapas**: *Todo* (PDF, formulario web y JSON lado a lado), *PDF*, *Formulario web* (cómo se vería, paso por paso), *JSON*, *Revisar* y *Tablas* (las tablas técnicas).
- **Tocar un campo** en cualquier vista muestra las tres cosas del mismo campo: el casillero del PDF, la pregunta del formulario y la ruta del JSON (con su valor de ejemplo), y lo marca en las otras vistas.
- **Corregir**: desde el panel del campo, «Cambiar casillero», «Quitar», «Elegir pregunta o dato» o «Está bien» para un dudoso. Lo elegido a mano se recuerda para ese formulario en este navegador.
- **Revisar**: dudosos, casilleros del PDF sin dato, preguntas sin casillero, datos del JSON sin pregunta, rutas que no cierran, opciones que no cierran y preguntas que no van al PDF.
- **Pasar al formulario**: arma el paso 3 con las secciones y preguntas de la matriz, con sus casilleros, opciones y rutas. Cada pregunta dice en «Notas» de qué hoja y fila de la matriz sale. Desde ahí se edita, se prueba y se baja la ficha (.xlsx) como siempre.

## Matriz interna (`interno.html`, uso interno)

Página aparte, sin link desde el flujo del cliente. Junta la ficha cerrada (la que baja «Armar») con los campos que Signaframe necesita y baja un Excel con:

- **Formulario Signaframe**: una fila por paso, subsección y campo, agrupadas en niveles 0/1/2. Bloque azul = columnas de la ficha (solo lectura); bloque verde = columnas Signaframe (fuente del form-def). Listas desplegables en Tipo, Ancho y Sí/No. Al final, en rojo, las preguntas de la ficha que quedan fuera, con el motivo.
- **Opciones**: una fila por opción de cada lista (incluye provincia, cantón y distrito de `docs/catalogo_cr.json`).
- **Ficha · …**: copia de las hojas de la ficha, como referencia.

Entradas: ficha cerrada (obligatoria), main de Signaframe (para controlar que estén todos los casilleros del PDF) y Matriz del INS (opcional, para el texto legal). El orden de pasos y subsecciones sale del Diccionario V10. Las reglas que aplica: Sí/No → radios + helper booleano; listas con un casillero por opción → radios + helper; tipo de identificación → select + casillas ocultas que pintan el PDF; número + unidad que se concatenan; descripciones desde el select hermano; nombre completo concatenado; padecimientos (casilleros numerados) → repeater con `slotMappings`. El `sourceMeta` no va en la matriz: lo pone `matriz_io.py build` desde el main.

**No puede faltar** (lo agrega aunque no esté en la ficha, con Origen «Obligatorio por diccionario», y lo lista en la hoja «Agregados por diccionario»): los 14 datos del encabezado + `codigoTipo` / `descripcionTipo`, la Póliza Madre oculta, el Asesor prellenado y bloqueado, la firma (paso Firmas, oculto), el texto legal de Declaraciones + la casilla de aceptación, las descripciones de cada lista, el nombre completo concatenado y el helper booleano de cada Sí/No. La firma sale sin posición en el PDF (el main no la trae): hay que ubicarla en Signaframe.

## Privacidad

Los archivos se procesan en tu navegador, no se suben a ningún servidor. La página es estática (GitHub Pages) y solo descarga las librerías pdf.js, pdf-lib y ExcelJS desde CDN.

## Cómo actualizar

1. Crear una branch en el repo del hub y reemplazar los `.html` de `public/apps/ficha-formulario/`.
2. Para un diccionario nuevo, correr `node tools/build_dic.mjs docs/diccionario_vXX.xlsx` **desde esta carpeta**.
3. Abrir un PR a `main` y mergearlo: el deploy del hub la publica sola.

No commitear PDFs, JSON ni Excel de clientes: el `.gitignore` del hub los bloquea.

## Técnico

Es una sola página (`index.html`) sin build: HTML, CSS y JS vanilla. Usa pdf.js 3.11.174 y pdf-lib 1.17.1 (cdnjs) y ExcelJS 4.4.0 (jsdelivr). `.nojekyll` hace que Pages sirva los archivos tal cual.
