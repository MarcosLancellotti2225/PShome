// Generador CSV ← repo toolsImport
export default {
  id: 'csv-generator',
  source: 'legacy-src/csv-generator (ex repo toolsImport) (index.html, styles.css, formatLoaders.js, transformations.js, app.js)',
  dir: 'legacy-src/csv-generator',
  html: 'index.html',
  css: ['styles.css'],
  js: ['formatLoaders.js', 'transformations.js', 'app.js'],
  recolorMarkup: true,
  // Dentro de la app no hace falta el fondo de pantalla completa del original.
  extraCss: `.lg-csv-generator { background: none; padding: 0; min-height: 0; }
.lg-csv-generator .container { max-width: none; box-shadow: none; border: 1px solid var(--color-border); }`,
  colors: {
    '#667eea': '#047c76', '#764ba2': '#012825', '#f8f9ff': '#f0f3f8', '#eef0ff': '#defffb', '#e0e0e0': '#cddbdb',
    '#28a745': '#198446', '#6c757d': '#4f5b5b', '#495057': '#3a4646', '#333': '#0a1111', '#666': '#4f5b5b',
    '#999': '#778383', '#ddd': '#cddbdb', '#f0f0f0': '#e9ebf0', '#2d3748': '#1a2424', '#718096': '#636f6f',
    '#dc3545': '#ad4546', '#3b82f6': '#2b5cd1', '#4caf50': '#36995a', '#2e7d32': '#006d36', '#e8f5e9': '#dfffe6',
    '#d4edda': '#dfffe6', '#fff3cd': '#ffecce', '#ffc107': '#cca157', '#f59e0b': '#a1782c', '#84cc16': '#54b574',
  },
};
