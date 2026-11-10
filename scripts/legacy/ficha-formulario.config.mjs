// Ficha de formulario ← repo SingaframeFormBuilder (index.html).
// El paso «2 · Matriz del INS» (mapear.html) va aparte: config ficha-mapear, montado adentro de la Ficha.
const COMMON = {
  '#f5f6f8': '#f0f3f8', '#1b1f2a': '#0a1111', '#5d6475': '#4f5b5b', '#dde1e8': '#cddbdb', '#eceff4': '#e9ebf0',
  '#b4231d': '#ad4546', '#fbe6e4': '#ffe8e7',
};
export default {
  id: 'ficha-formulario',
  source: 'legacy-src/ficha-formulario (ex repo SingaframeFormBuilder) (index.html)',
  dir: 'legacy-src/ficha-formulario',
  html: 'index.html',
  dropDarkMode: true,
  exposeOnly: [], // gmReady y gmHeight ya se asignan a window en el original
  jsReplace: [],
  extraCss: `.lg-ficha-formulario { --ok: #198446; background: var(--color-bg); padding-block: 8px 48px; padding-inline: 0; }
/* El título ya lo pone la app arriba: no repetirlo. */
.lg-ficha-formulario header .eyebrow, .lg-ficha-formulario header h1 { display: none; }`,
  colors: {
    ...COMMON,
    '#3346c8': '#047c76', '#e9ecfb': '#defffb', '#a35a00': '#a16000', '#fbefdc': '#ffe9c2',
    '#17784f': '#2b5cd1', '#e2f3ea': '#d5def6', '#7b3fe4': '#440f8f',
  },
};
