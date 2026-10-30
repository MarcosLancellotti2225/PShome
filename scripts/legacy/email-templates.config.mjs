// Email Templates ← repo HTMLgenerator
// OJO: solo se recolorea la interfaz (styles.css). El HTML de las plantillas de email
// (en markup y app.js) conserva sus colores: es lo que reciben los clientes.
export default {
  id: 'email-templates',
  source: 'legacy-src/email-templates (ex repo HTMLgenerator) (index.html, styles.css, app.js)',
  dir: 'legacy-src/email-templates',
  html: 'index.html',
  css: ['styles.css'],
  js: ['app.js'],
  recolorMarkup: false,
  extraCss: `.lg-email-templates { min-height: 0; border-radius: 12px; overflow: hidden; border: 1px solid var(--color-border); }
.lg-email-templates .view, .lg-email-templates .login-wrapper { min-height: 640px; }
.lg-email-templates .controls, .lg-email-templates .preview { max-height: calc(100vh - 80px); }`,
  colors: {
    '#2563eb': '#047c76', '#1d4ed8': '#006660', '#1a1a2e': '#012825', '#16213e': '#013c38', '#0f3460': '#01504c',
    '#374151': '#2a3535', '#e1e4e8': '#cddbdb', '#e5e7eb': '#cddbdb', '#d1d5db': '#b7c4c4', '#9ca3af': '#8b9898',
    '#f3f4f6': '#e9ebf0', '#6b7280': '#636f6f', '#f9fafb': '#f0f3f8', '#dc2626': '#ad4546', '#16a34a': '#198446',
    '#f0f2f5': '#f0f3f8', '#eff6ff': '#defffb', '#dcfce7': '#dfffe6', '#92400e': '#745102', '#8b5cf6': '#00a69d',
    '#7c3aed': '#03948c', '#6c757d': '#636f6f', '#166534': '#006d36', '#15803d': '#006d36', '#fffbeb': '#ffecce',
    '#fef3c7': '#ffecce', '#fef2f2': '#ffe8e7', '#fecaca': '#ffc8c5', '#fde68a': '#fcd086', '#fca5a5': '#f58683',
    '#fafbfc': '#f0f3f8', '#f8faff': '#f0f3f8', '#f8f9fa': '#f0f3f8', '#f1c7c7': '#ffc8c5', '#ef4444': '#c15757',
    '#eef0f3': '#e9ebf0', '#991b1b': '#952f33', '#93b4f5': '#73f0e5', '#555e6b': '#4f5b5b',
  },
};
