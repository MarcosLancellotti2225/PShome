// Generador CSV — integrado desde el repo toolsImport.
// La herramienta original corre tal cual (legacy/, generado con scripts/legacy/convert.mjs),
// montada como pantalla nativa.
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import LegacyTool from '../_legacy/LegacyTool';
import markup from './legacy/markup.html?raw';
import { mount } from './legacy/app.js';
import './legacy/styles.css';

// Las librerías que antes venían de un CDN ahora salen de npm.
window.XLSX = XLSX;
window.Papa = Papa;

export default function CsvGenerator() {
  return <LegacyTool id="csv-generator" markup={markup} mount={mount} />;
}
