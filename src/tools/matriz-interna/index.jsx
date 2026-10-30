// Matriz interna — integrada desde el repo SingaframeFormBuilder (interno.html).
// La herramienta original corre tal cual (legacy/, generado con scripts/legacy/convert.mjs).
import '../_legacy/pdfLibs';
import LegacyTool from '../_legacy/LegacyTool';
import markup from './legacy/markup.html?raw';
import { mount } from './legacy/app.js';
import './legacy/styles.css';

export default function MatrizInterna() {
  return <LegacyTool id="matriz-interna" markup={markup} mount={mount} />;
}
