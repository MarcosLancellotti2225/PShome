// Crear formulario — 4 pasos con una barra fija abajo:
//   1 Archivos (React) · 2 Casilleros del PDF (Ficha clásica, paso 0) · 3 Preguntas (Ficha clásica: matriz del INS
//   y armado) · 4 JSON del formulario (React, lo que antes era la pestaña «Plantilla y JSON»).
// Los archivos viven en el trabajo (signaframe-studio/trabajo.js). La Ficha clásica queda montada siempre y se
// maneja con window.SeFicha (legacy-src/ficha-formulario/index.html); sus botones de navegación están ocultos.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Download, Loader2 } from 'lucide-react';
import { downloadBlob } from '../../lib/files';
import { ActionBar, Alert, Button, Steps } from '../../components/ui';
import { guardarArchivo, setUi, useTrabajo, useTrabajoListo } from '../signaframe-studio/trabajo.js';
import FichaLegacy from './FichaLegacy.jsx';
import PasoArchivos from './PasoArchivos.jsx';
import PasoJson from './PasoJson.jsx';
import './crear.css';

const ORDER = ['archivos', 'casilleros', 'preguntas', 'json'];
const INTRO = {
  archivos: 'Juntá lo que mandó el cliente. Solo el PDF es obligatorio.',
  casilleros: 'Cada casillero del PDF necesita un nombre claro. Se propone uno leyendo el texto impreso al lado: revisalo y aceptalo.',
  preguntas: 'Armá las preguntas del formulario web y uní cada una con sus casilleros del PDF y su dato del JSON del cliente.',
  json: 'Con el main de Signaframe se arman la matriz interna y el JSON del formulario.',
};

// Espera a que la Ficha clásica esté montada.
async function ficha() {
  for (let i = 0; i < 100 && !window.SeFicha; i++) await new Promise((r) => setTimeout(r, 50));
  if (!window.SeFicha) throw new Error('No se pudo abrir el editor. Recargá la página.');
  return window.SeFicha;
}

// Carga un archivo en un <input type=file> de la herramienta clásica, como si lo hubiera elegido la persona.
function setInputFile(input, name, bytes) {
  const dt = new DataTransfer();
  dt.items.add(new File([bytes], name));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// Qué versión de cada archivo ya tiene adentro la Ficha (para no recargar y perder lo hecho).
const fed = {};

export default function CrearFormulario() {
  const t = useTrabajo();
  const listo = useTrabajoListo();
  const a = t.archivos;
  const nombre = t.nombre || 'formulario';
  const navigate = useNavigate();
  const paso = ORDER.includes(t.ui?.crearPaso) ? t.ui.crearPaso : 'archivos';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [estado, setEstado] = useState(null); // lo que informa la Ficha clásica
  const [sub, setSub] = useState(null); // en Preguntas: 'm' (matriz del INS) o 2 (armado)
  const syncing = useRef(false);

  const go = useCallback((p) => { setError(''); setUi({ crearPaso: p }); }, []);

  // Al entrar a un paso de la Ficha clásica, le pasa los archivos del trabajo que cambiaron.
  useEffect(() => {
    if (!listo || (paso !== 'casilleros' && paso !== 'preguntas') || syncing.current) return undefined;
    let alive = true;
    syncing.current = true;
    (async () => {
      try {
        const F = await ficha();
        if (a.pdfOriginal && fed.pdf !== a.pdfOriginal.at) {
          await F.cargarPdf(a.pdfOriginal.data.slice(), a.pdfOriginal.name);
          fed.pdf = a.pdfOriginal.at;
        }
        if (paso === 'casilleros') { F.paso(0); return; }
        const jsonAt = a.clienteJson?.at ?? 'ninguno';
        if (fed.json !== jsonAt) { F.cargarJson(a.clienteJson?.data ?? null); fed.json = jsonAt; }
        // Con matriz del INS se arranca por el cruce; sin ella, directo al armado. Si ya estaba en uno, sigue ahí.
        let cur = F.pasoActual();
        if (cur !== 'm' && cur !== 2) cur = a.matrizIns ? 'm' : 2;
        if (cur === 'm' && !a.matrizIns) cur = 2;
        F.paso(cur);
        if (F.pasoActual() === 'm' && a.matrizIns && fed.ins !== a.matrizIns.at) {
          let input = null;
          for (let i = 0; i < 60 && !(input = document.querySelector('#mp-xlsx')); i++) await new Promise((r) => setTimeout(r, 50));
          if (input) { setInputFile(input, a.matrizIns.name, a.matrizIns.data.slice()); fed.ins = a.matrizIns.at; }
        }
        if (alive) setSub(F.pasoActual());
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        syncing.current = false;
      }
    })();
    return () => { alive = false; };
  }, [listo, paso, a.pdfOriginal, a.clienteJson, a.matrizIns]);

  // Mientras se trabaja en la Ficha clásica, la barra de abajo muestra cómo va.
  useEffect(() => {
    if (paso !== 'casilleros' && paso !== 'preguntas') return undefined;
    const id = setInterval(() => {
      const F = window.SeFicha;
      if (!F) return;
      setEstado(F.estado());
      setSub(F.pasoActual());
    }, 700);
    return () => clearInterval(id);
  }, [paso]);

  async function cargarEjemplo() {
    try {
      const F = await ficha();
      const e = F.ejemplo();
      guardarArchivo('pdfOriginal', e.pdfName, e.pdf);
      guardarArchivo('clienteJson', 'ejemplo_cliente.json', e.json);
    } catch (err) { setError(err.message); }
  }

  async function siguiente() {
    setError('');
    setBusy(true);
    try {
      const F = paso === 'casilleros' || paso === 'preguntas' ? await ficha() : null;
      if (paso === 'archivos') go('casilleros');
      else if (paso === 'casilleros') { await F.pdfRenombrado(); go('preguntas'); }
      else if (paso === 'preguntas' && F.pasoActual() === 'm') {
        const btn = document.querySelector('#gm-go');
        if (btn?.disabled) throw new Error('Primero procesá la matriz del INS (arriba).');
        btn?.click();
        setSub(2);
      } else if (paso === 'preguntas') {
        const r = await F.ficha();
        if (!r) throw new Error('No se pudo armar la ficha. Revisá el mensaje del editor.');
        go('json');
      }
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const steps = [
    { id: 'archivos', label: 'Archivos', done: !!a.pdfOriginal },
    { id: 'casilleros', label: 'Casilleros del PDF', done: !!a.pdf, disabled: !a.pdfOriginal, hint: a.pdfOriginal ? undefined : 'Primero cargá el PDF del cliente' },
    { id: 'preguntas', label: 'Preguntas', done: !!a.ficha, disabled: !a.pdf, hint: a.pdf ? undefined : 'Primero terminá los casilleros' },
    { id: 'json', label: 'JSON del formulario', done: !!a.formDef, disabled: !a.ficha, hint: a.ficha ? undefined : 'Primero terminá las preguntas' },
  ];
  const idx = ORDER.indexOf(paso);

  // Lo que dice la barra de abajo y su botón principal.
  let mid = '';
  let nextLabel = 'Siguiente';
  let nextDisabled = false;
  if (paso === 'archivos') {
    mid = a.pdfOriginal ? `PDF: ${a.pdfOriginal.name}${a.clienteJson ? ' · con JSON del cliente' : ' · sin JSON del cliente'}${a.matrizIns ? ' · con matriz del INS' : ''}` : 'Falta el PDF del cliente.';
    nextLabel = 'Siguiente: casilleros';
    nextDisabled = !a.pdfOriginal;
  } else if (paso === 'casilleros') {
    if (estado) mid = estado.errores ? `${estado.errores} nombres con error: corregilos para seguir.` : `${estado.aceptados} de ${estado.casilleros} nombres aceptados.`;
    nextLabel = 'Siguiente: preguntas';
  } else if (paso === 'preguntas') {
    if (sub === 'm') { mid = 'Revisá el cruce con la matriz del INS y pasalo a las preguntas.'; nextLabel = 'Pasar a las preguntas'; } else {
      if (estado) mid = `${estado.preguntas} preguntas${estado.sinCasillero ? ` · ${estado.sinCasillero} sin casillero` : ''}.`;
      nextLabel = 'Siguiente: JSON del formulario';
    }
  }

  if (!listo) return <div className="tool-loading"><Loader2 className="spin" size={18} /> Cargando…</div>;

  return (
    <div className="ui-stack cf">
      <Steps steps={steps} current={paso} onChange={go} />
      <p className="cf-intro">{INTRO[paso]}</p>
      {error && <Alert tone="error">{error}</Alert>}

      {paso === 'archivos' && <PasoArchivos archivos={a} onEjemplo={cargarEjemplo} />}
      {paso === 'casilleros' && a.pdf && (
        <p className="ui-hint">
          Ya hay un PDF renombrado en el trabajo ({a.pdf.name}).{' '}
          <Button size="sm" variant="ghost" icon={Download} onClick={() => downloadBlob(new Blob([a.pdf.data], { type: 'application/pdf' }), a.pdf.name)}>Bajarlo</Button>
        </p>
      )}
      <div className="cf-legacy" hidden={paso !== 'casilleros' && paso !== 'preguntas'}>
        <FichaLegacy />
      </div>
      {paso === 'json' && <PasoJson nombre={nombre} archivos={a} onProbar={() => navigate('/tools/signaframe-studio/probar')} />}

      <ActionBar
        left={idx > 0 && <Button icon={ArrowLeft} onClick={() => go(ORDER[idx - 1])}>Volver</Button>}
        right={paso !== 'json'
          ? <Button variant="primary" disabled={nextDisabled || busy} onClick={siguiente}>{busy ? 'Un momento…' : nextLabel} {!busy && <ArrowRight size={16} />}</Button>
          : <Button variant="primary" disabled={!a.formDef} onClick={() => navigate('/tools/signaframe-studio/probar')}>Probarlo <ArrowRight size={16} /></Button>}
      >
        {mid}
      </ActionBar>
    </div>
  );
}
