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
  extraCss: `.lg-matriz-interna { background: var(--color-bg); padding-block: 8px 48px; padding-inline: 0; }`,
  colors: {
    '#f5f6f8': '#f0f3f8', '#1b1f2a': '#0a1111', '#5d6475': '#4f5b5b', '#dde1e8': '#cddbdb', '#eceff4': '#e9ebf0',
    '#b4231d': '#ad4546', '#fbe6e4': '#ffe8e7',
    '#1e6b45': '#047c76', '#e2f3ea': '#defffb', '#1f4e79': '#2b5cd1', '#17784f': '#198446',
  },
};
