// Ficha de formulario — integrada desde el repo SingaframeFormBuilder (index.html).
// La herramienta original corre tal cual (legacy/, generado con scripts/legacy/convert.mjs).
// El paso opcional «Matriz del INS» sigue usando mapear.html (public/apps/ficha-formulario) en un panel interno.
import '../_legacy/pdfLibs';
import LegacyTool from '../_legacy/LegacyTool';
import markup from './legacy/markup.html?raw';
import { mount } from './legacy/app.js';
import './legacy/styles.css';

export default function FichaFormulario() {
  return <LegacyTool id="ficha-formulario" markup={markup} mount={mount} />;
}
