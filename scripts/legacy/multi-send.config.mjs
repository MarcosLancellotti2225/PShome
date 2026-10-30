// Multi Send ← repo bulksend
export default {
  id: 'multi-send',
  source: 'legacy-src/multi-send (ex repo bulksend) (index.html, styles.css, app.js)',
  dir: 'legacy-src/multi-send',
  html: 'index.html',
  css: ['styles.css'],
  js: ['app.js'],
  recolorMarkup: true,
  // El selector inicial ocupa la pantalla de la herramienta, no toda la app.
  extraCss: `.lg-multi-send { position: relative; min-height: 700px; border-radius: 12px; overflow: hidden; }
.lg-multi-send .launcher-overlay { position: absolute; }`,
  colors: {
    '#00B4B6': '#047c76', '#009A9C': '#006660', '#E0F7F7': '#defffb', '#0D1F3C': '#012825', '#1A3155': '#01504c',
    '#2D7FF9': '#00a69d', '#FF6B35': '#a16000', '#e55a2a': '#8c6410',
    '#F5F7FA': '#f0f3f8', '#F0F2F5': '#e9ebf0', '#E8EBF0': '#e4f2f2', '#D8DCE3': '#cddbdb', '#B0B8C4': '#a1aeae',
    '#1A2332': '#0a1111', '#6B7B8D': '#4f5b5b', '#9AA5B4': '#778383', '#0b1120': '#0a1111',
    '#00B67A': '#198446', '#009A65': '#006d36', '#E6F9F1': '#dfffe6', '#F5A623': '#a1782c', '#FFF8EC': '#ffecce',
    '#E53E3E': '#ad4546', '#FFF0F0': '#ffe8e7', '#60D3D4': '#59d8ce', '#7CB3FF': '#83cbf7', '#4ADE80': '#80e09d', '#F87171': '#f58683',
  },
};
