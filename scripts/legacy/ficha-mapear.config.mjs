// Paso «2 · Matriz del INS» de la Ficha ← repo SingaframeFormBuilder (mapear.html).
// Antes se abría en un marco (iframe); ahora se monta adentro de la Ficha (ver src/tools/ficha-formulario/index.jsx).
// Habla con la Ficha como antes: la Ficha llama a window.mpFromFlow / window.mpExport y este paso avisa con window.gmReady.
export default {
  id: 'ficha-mapear',
  source: 'legacy-src/ficha-formulario (ex repo SingaframeFormBuilder) (mapear.html)',
  dir: 'legacy-src/ficha-formulario',
  html: 'mapear.html',
  dropDarkMode: true,
  exposeOnly: [],
  // Siempre en modo «embebido» (el que usaba dentro del marco).
  markupReplace: [
    ['<main class="wrap" id="mp-main">', '<div class="embed"><main class="wrap" id="mp-main">'],
    ['</main>', '</main></div>'],
    // SE Tools: el paso 2 es solo para cargar la matriz. El cruce completo queda plegado.
    ['<details class="wbox" id="mp-warns-box">', '<label class="msg se-ver"><input type="checkbox" id="se-ver-cruce"> Ver el cruce completo (casilleros, preguntas y rutas)</label>\n  <details class="wbox" id="mp-warns-box">'],
  ],
  jsReplace: [
    ['const MP_EMBED=/[?&]embed=1\\b/.test(location.search)&&window.parent!==window;', 'const MP_EMBED=true; /* SE Tools: siempre adentro de la Ficha */'],
    ['if(!MP_EMBED&&window.parent===window&&!/[?&]sola=1\\b/.test(location.search))location.replace("./#matriz");', '/* SE Tools: ya no se abre sola */'],
    ['pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";', '/* SE Tools: el worker de pdf.js sale de npm (pdfLibs.js) */'],
    ['document.documentElement.classList.add("embed");', '/* SE Tools: el contenedor ya tiene la clase embed */'],
  ],
  extraCss: `.lg-ficha-mapear { padding: 0; background: transparent; margin-top: 10px; }
.lg-ficha-mapear #mp-out:not(:has(#se-ver-cruce:checked)) > :not(.bar):not(.se-ver) { display: none; }
.lg-ficha-mapear #mp-dl { display: none; }
.lg-ficha-mapear .se-ver { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; cursor: pointer; }`,
  colors: {},
};
