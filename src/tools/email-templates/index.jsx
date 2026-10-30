// Email Templates — integrado desde el repo HTMLgenerator.
// La herramienta original corre tal cual (legacy/, generado con scripts/legacy/convert.mjs),
// montada como pantalla nativa y con la conexión de Signaturit compartida con Multi Send.
import LegacyTool from '../_legacy/LegacyTool';
import { bindConnectionFields } from '../../lib/signaturit/session';
import markup from './legacy/markup.html?raw';
import { mount } from './legacy/app.js';
import './legacy/styles.css';

function start() {
  const reactivate = mount();
  const refill = bindConnectionFields({
    envEl: document.getElementById('apiEnvironment'),
    tokenEl: document.getElementById('apiToken'),
    toFieldValue: (env) => env,
  });
  // Al volver a la pantalla: sus funciones al frente y la conexión de Signaturit al día.
  return () => { reactivate(); refill(); };
}

export default function EmailTemplates() {
  return <LegacyTool id="email-templates" markup={markup} mount={start} />;
}
