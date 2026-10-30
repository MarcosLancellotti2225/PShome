// Multi Send — integrado desde el repo bulksend.
// La herramienta original corre tal cual (legacy/, generado con scripts/legacy/convert.mjs),
// montada como pantalla nativa y con la conexión de Signaturit compartida.
import * as XLSX from 'xlsx';
import mammoth from 'mammoth/mammoth.browser.min.js';
import LegacyTool from '../_legacy/LegacyTool';
import { bindConnectionFields } from '../../lib/signaturit/session';
import markup from './legacy/markup.html?raw';
import { mount } from './legacy/app.js';
import './legacy/styles.css';

// Las librerías que antes venían de un CDN ahora salen de npm.
window.XLSX = XLSX;
window.mammoth = mammoth;

function start() {
  const reactivate = mount();
  const refill = bindConnectionFields({
    envEl: document.getElementById('cfg-env'),
    tokenEl: document.getElementById('cfg-token'),
    toFieldValue: (env) => (env === 'sandbox' ? 'https://api.sandbox.signaturit.com' : 'https://api.signaturit.com'),
  });
  // Al volver a la pantalla: sus funciones al frente y la conexión de Signaturit al día.
  return () => { reactivate(); refill(); };
}

export default function MultiSend() {
  return <LegacyTool id="multi-send" markup={markup} mount={start} />;
}
