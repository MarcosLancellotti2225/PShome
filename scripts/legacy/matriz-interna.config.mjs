// Matriz interna ← repo SingaframeFormBuilder (interno.html)
export default {
  id: 'matriz-interna',
  source: 'legacy-src/ficha-formulario (ex repo SingaframeFormBuilder) (interno.html)',
  dir: 'legacy-src/ficha-formulario',
  html: 'interno.html',
  dropDarkMode: true,
  exposeOnly: [],
  jsReplace: [
    ['fetch("docs/catalogo_cr.json")', 'fetch(__PSTOOLS_BASE__+"apps/ficha-formulario/docs/catalogo_cr.json")'],
  ],
  extraCss: `.lg-matriz-interna { background: var(--color-bg); padding-block: 8px 48px; padding-inline: 0; }
/* El título ya lo pone la app arriba: no repetirlo. */
.lg-matriz-interna header .eyebrow, .lg-matriz-interna header h1 { display: none; }
.lg-matriz-interna header .lead { margin-top: 0; }
/* Carga de archivos con botón de la marca, en español (el input nativo queda oculto; el label lo abre). */
.lg-matriz-interna label.in input[type=file] { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.lg-matriz-interna label.in { cursor: pointer; position: relative; }
.lg-matriz-interna label.in .st { font: 400 13px var(--font-family, inherit); color: var(--color-text-secondary); display: flex; align-items: center; gap: 10px; overflow-wrap: anywhere; }
.lg-matriz-interna label.in .st::before { content: "Elegir archivo"; flex: none; font-weight: 500; font-size: 14px; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 7px 14px; }
.lg-matriz-interna label.in:hover .st::before { border-color: var(--color-primary); color: var(--color-primary); }
.lg-matriz-interna label.in .st.ok { color: var(--color-primary); font-weight: 600; }
.lg-matriz-interna label.in:has(input[type=text]) { cursor: default; }`,
  colors: {
    '#f5f6f8': '#f0f3f8', '#1b1f2a': '#0a1111', '#5d6475': '#4f5b5b', '#dde1e8': '#cddbdb', '#eceff4': '#e9ebf0',
    '#b4231d': '#ad4546', '#fbe6e4': '#ffe8e7',
    '#1e6b45': '#047c76', '#e2f3ea': '#defffb', '#1f4e79': '#2b5cd1', '#17784f': '#198446',
  },
};
