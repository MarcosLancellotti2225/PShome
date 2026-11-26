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
.lg-ficha-formulario header .eyebrow, .lg-ficha-formulario header h1 { display: none; }
/* Adentro de «Crear formulario» (src/tools/ficha-formulario): los pasos, los archivos y la navegación los maneja
   la pantalla nueva. Acá queda solo el trabajo de cada paso. */
.lg-ficha-formulario header, .lg-ficha-formulario nav.steps, .lg-ficha-formulario #st0 > .lead, .lg-ficha-formulario #stm > .lead,
.lg-ficha-formulario #st2 > .lead, .lg-ficha-formulario .rn-file, .lg-ficha-formulario #rn-sample, .lg-ficha-formulario #gm-skip,
.lg-ficha-formulario #go1, .lg-ficha-formulario #back0, .lg-ficha-formulario #go2b, .lg-ficha-formulario #go2,
.lg-ficha-formulario #back1m, .lg-ficha-formulario #gm-go, .lg-ficha-formulario #back1, .lg-ficha-formulario #go3,
.lg-ficha-formulario #back2 { display: none !important; }`,
  colors: {
    ...COMMON,
    '#3346c8': '#047c76', '#e9ecfb': '#defffb', '#a35a00': '#a16000', '#fbefdc': '#ffe9c2',
    '#17784f': '#2b5cd1', '#e2f3ea': '#d5def6', '#7b3fe4': '#440f8f',
  },
};
