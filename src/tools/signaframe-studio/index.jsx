// Signaframe Studio · Probar — el control de calidad del formulario.
// Usa los archivos del trabajo (trabajo.js): lo que se cargó en otra pestaña ya está acá.
//   Probar JSON:  nuestro JSON contra el del cliente (valor por valor, estructura y mapa).
//   Probar PDF:   el PDF lleno con lo que manda el formulario; qué no pinta o no entra.
//   Revisar:      reglas del Revisor y problemas de rutas del JSON.
//   Simular:      el formulario funcionando con el motor real; lo que completes llega a las otras pruebas.
// Todo corre en el navegador con src/lib (signaframe-engine, signaframe-qa, json-mapper).
import { useEffect, useMemo, useState } from 'react';
import { simulate } from '../../lib/signaframe-engine/index.js';
import { analyzeFormDef } from '../../lib/json-mapper/index.js';
import { construirModelo } from '../../lib/json-mapper/revisor/modelo.js';
import { revisar } from '../../lib/json-mapper/revisor/reglas.js';
import { compareJson } from '../../lib/signaframe-qa/json.js';
import { Alert, FileDrop, Panel, Stats, Tabs } from '../../components/ui';
import { ARCHIVOS, cargarArchivo, quitarArchivo, setEdits, useTrabajo } from './trabajo.js';
import { revisorItems, unwrapFormDef } from './util.js';
import ProbarJson from './ProbarJson.jsx';
import ProbarPdf from './ProbarPdf.jsx';
import Revisor from './Revisor.jsx';
import Simular from './Simular.jsx';
import './studio.css';

const INPUTS = ['formDef', 'clienteJson', 'payload', 'pdf', 'jsonGenerado'];

function useSafe(fn, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => { try { return { value: fn() }; } catch (e) { return { error: e.message }; } }, deps);
}

export default function Probar() {
  const t = useTrabajo();
  const a = t.archivos;
  const nombre = t.nombre || 'formulario';
  const [test, setTest] = useState('json');
  const [loadError, setLoadError] = useState('');
  const [dummy, setDummy] = useState(false);
  const [pdfState, setPdfState] = useState({ for: null, res: null, error: '' });

  const fd = useSafe(() => (a.formDef ? unwrapFormDef(a.formDef.data) : null), [a.formDef]);
  const formDef = fd.value || null;
  const payload = a.payload?.data ?? null;

  const sim = useSafe(() => (formDef ? simulate({ formDefinition: formDef, payload, edits: t.edits }) : null), [formDef, payload, t.edits]);
  const result = sim.value || null;
  const analysis = useSafe(() => (formDef ? analyzeFormDef(formDef) : null), [formDef]).value || null;
  const items = useMemo(() => {
    if (!formDef) return null;
    let hallazgos = [];
    try { hallazgos = revisar(construirModelo(formDef)); } catch { /* sin Revisor */ }
    return revisorItems(hallazgos, analysis);
  }, [formDef, analysis]);

  const ours = a.jsonGenerado?.data ?? result?.json ?? null;
  const client = a.clienteJson?.data ?? null;
  const cmp = useMemo(() => (ours && client ? compareJson(ours, client) : null), [ours, client]);
  const oursFrom = a.jsonGenerado
    ? `Nuestro JSON: ${a.jsonGenerado.name}.`
    : formDef ? 'Nuestro JSON: lo que sale de simular el formulario con el motor de Signaframe, con los datos de prellenado y lo que completes en «Simular a mano».' : '';
  const emptySim = !a.jsonGenerado && !payload && !Object.keys(t.edits).length;

  // Probar PDF: se vuelve a llenar cuando cambian el PDF, el formulario, los datos o «datos de prueba».
  // Mientras se llena, se sigue viendo el resultado anterior.
  const pdfBytes = a.pdf?.data;
  const simPdf = result?.pdf;
  const pdfInputs = useMemo(
    () => (pdfBytes && formDef && simPdf ? { pdfBytes, formDef, simPdf, dummy } : null),
    [pdfBytes, formDef, simPdf, dummy],
  );
  useEffect(() => {
    if (!pdfInputs) return undefined;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const { pdfValuesFor, fillFormPdf } = await import('../../lib/signaframe-qa/pdf.js');
        const { values, referenced, sinCasillero } = pdfValuesFor(pdfInputs.formDef, pdfInputs.simPdf);
        const r = await fillFormPdf(pdfInputs.pdfBytes, values, { referenced, dummy: pdfInputs.dummy });
        if (alive) setPdfState({ for: pdfInputs, res: { ...r, sinCasillero }, error: '' });
      } catch (e) {
        if (alive) setPdfState({ for: pdfInputs, res: null, error: `No se pudo llenar el PDF: ${e.message}` });
      }
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [pdfInputs]);
  const pdfBusy = !!pdfInputs && pdfState.for !== pdfInputs;

  async function pick(tipo, file) {
    setLoadError('');
    if (!file) return;
    try { await cargarArchivo(tipo, file); } catch (e) { setLoadError(e.message); }
  }

  const pdfRes = pdfInputs ? pdfState.res : null;
  const pdfProblems = pdfRes ? pdfRes.noEntran.length + pdfRes.fallos.length + pdfRes.noEsta.length : null;
  const revErrors = items ? items.filter((i) => i.severidad === 'error').length : null;
  const simErrors = result ? result.issues.filter((i) => i.level === 'error').length : null;
  const shownError = loadError || fd.error || sim.error;

  return (
    <div className="ui-stack">
      <Panel
        title="Qué vas a probar"
        hint="Lo que cargues queda en el trabajo y lo usan las demás pestañas. Lo que ya cargaste en otra pestaña aparece acá."
      >
        <div className="ui-files">
          {INPUTS.map((k) => (
            <FileDrop
              key={k}
              label={ARCHIVOS[k].label}
              description={ARCHIVOS[k].desc}
              accept={ARCHIVOS[k].accept}
              file={a[k] ? { name: a[k].name, size: a[k].size } : null}
              onFile={(f) => pick(k, f)}
              onClear={() => quitarArchivo(k)}
              required={k === 'formDef' && !a.jsonGenerado}
            />
          ))}
        </div>
        {shownError && <Alert tone="error">{shownError}</Alert>}
      </Panel>

      <Panel title="Resultado">
        <Stats items={[
          { label: 'Probar JSON', value: cmp ? (cmp.identical ? 'Iguales' : `${cmp.rows.length - cmp.counts.igual} dif.`) : '—', tone: cmp ? (cmp.identical ? 'good' : 'bad') : undefined },
          { label: 'Probar PDF', value: pdfRes ? (pdfProblems ? `${pdfProblems} problemas` : 'Bien') : '—', tone: pdfRes ? (pdfProblems ? 'bad' : 'good') : undefined },
          { label: 'Revisor', value: items ? (revErrors ? `${revErrors} errores` : 'Sin errores') : '—', tone: items ? (revErrors ? 'bad' : 'good') : undefined },
          { label: 'Simulación', value: result ? (simErrors ? `${simErrors} errores` : 'Sin errores') : '—', tone: result ? (simErrors ? 'bad' : 'good') : undefined },
        ]} />
      </Panel>

      <Tabs
        value={test}
        onChange={setTest}
        options={[
          { value: 'json', label: 'Probar JSON' },
          { value: 'pdf', label: 'Probar PDF' },
          { value: 'rev', label: 'Revisar form-def' },
          { value: 'sim', label: 'Simular a mano' },
        ]}
      />

      {test === 'json' && <ProbarJson nombre={nombre} ours={ours} oursFrom={oursFrom} client={client} cmp={cmp} analysis={analysis} emptySim={emptySim} />}
      {test === 'pdf' && (
        <ProbarPdf
          nombre={nombre}
          hasPdf={!!a.pdf}
          hasFormDef={!!formDef}
          res={pdfRes}
          busy={pdfBusy}
          error={pdfInputs && !pdfBusy ? pdfState.error : ''}
          dummy={dummy}
          onDummy={setDummy}
        />
      )}
      {test === 'rev' && <Revisor items={items} />}
      {test === 'sim' && (result
        ? <Simular formDef={formDef} result={result} edits={t.edits} onEdit={setEdits} onReset={() => setEdits({})} payload={payload} />
        : <Alert tone="info">Cargá el JSON del formulario para simularlo.</Alert>)}
    </div>
  );
}
