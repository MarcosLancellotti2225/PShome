// Ficha de formulario — integrada desde el repo SingaframeFormBuilder (index.html).
// La herramienta original corre tal cual (legacy/, generado con scripts/legacy/convert.mjs).
// El paso «2 · Matriz del INS» (mapear.html) se monta adentro de la Ficha, sin marco:
// legacy-src/ficha-formulario/mapear.html → src/tools/ficha-mapear/legacy/ (config ficha-mapear).
import '../_legacy/pdfLibs';
import LegacyTool from '../_legacy/LegacyTool';
import markup from './legacy/markup.html?raw';
import { mount } from './legacy/app.js';
import './legacy/styles.css';
import mapearMarkup from '../ficha-mapear/legacy/markup.html?raw';
import { mount as mountMapear } from '../ficha-mapear/legacy/app.js';
import '../ficha-mapear/legacy/styles.css';

// La Ficha lo llama la primera vez que se entra al paso 2 (gmEnter). Se monta una sola vez:
// queda dentro del contenedor de la Ficha, que LegacyTool mantiene vivo entre pantallas.
window.SeMapear = {
  mount(host) {
    if (!host || host.querySelector('.lg-ficha-mapear')) return;
    const c = document.createElement('div');
    c.className = 'lg-root lg-ficha-mapear';
    c.innerHTML = mapearMarkup;
    host.appendChild(c);
    mountMapear();
  },
};

export default function FichaFormulario() {
  return <LegacyTool id="ficha-formulario" markup={markup} mount={mount} />;
}
