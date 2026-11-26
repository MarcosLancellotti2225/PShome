// Paso 4 · JSON del formulario: con el main de Signaframe arma la matriz interna y el JSON del formulario.
// Es lo que antes hacía la pestaña «Plantilla y JSON» (Matriz interna), con la misma lógica (src/lib/signaframe-matriz
// y src/lib/signaframe-formdef), pero toma la ficha, la matriz del INS y el main del trabajo.
import { useState } from 'react';
import { Download, Wand2 } from 'lucide-react';
import { matrizInterna } from '../../lib/signaframe-matriz/index.js';
import { formDefFromMatrixXlsx } from '../../lib/signaframe-formdef/index.js';
import { construirModelo } from '../../lib/json-mapper/revisor/modelo.js';
import { revisar } from '../../lib/json-mapper/revisor/reglas.js';
import { downloadBlob, jsonBlob } from '../../lib/files';
import { Alert, Button, Field, FileDrop, Panel, Stats } from '../../components/ui';
import { ARCHIVOS, guardarArchivo, quitarArchivo } from '../signaframe-studio/trabajo.js';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function loadExcelJS() {
  const ns = await import('exceljs/dist/exceljs.min.js');
  return ns?.Workbook ? ns : ns?.default;
}
let catalogo;
async function loadCatalogo() {
  if (catalogo !== undefined) return catalogo;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}apps/ficha-formulario/docs/catalogo_cr.json`);
    catalogo = r.ok ? await r.json() : null;
  } catch { catalogo = null; }
  return catalogo;
}

function Lista({ title, items, tone = 'info' }) {
  if (!items.length) return null;
  return (
    <Alert tone={tone}>
      <b>{title}</b>
      <ul className="cf-list">
        {items.slice(0, 40).map((x, i) => <li key={i}>{x}</li>)}
        {items.length > 40 && <li>…y {items.length - 40} más.</li>}
      </ul>
    </Alert>
  );
}

export default function PasoJson({ nombre, archivos, onProbar }) {
  const a = archivos;
  const [version, setVersion] = useState('v1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [res, setRes] = useState(null); // { M?, report, hallazgos }

  async function pick(tipo, f) {
    setError('');
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (ARCHIVOS[tipo].kind === 'json') {
      try { guardarArchivo(tipo, f.name, JSON.parse(new TextDecoder().decode(bytes))); } catch { setError(`${f.name} no es un JSON válido.`); }
    } else guardarArchivo(tipo, f.name, bytes);
  }

  function armarJson(matBuf, main) {
    const { formDef, report } = formDefFromMatrixXlsx(new Uint8Array(matBuf), main, { version: version.trim() || 'v1' });
    let hallazgos = [];
    try { hallazgos = revisar(construirModelo(formDef)); } catch { /* sin Revisor */ }
    guardarArchivo('formDef', `${nombre}_form-def_${version.trim() || 'v1'}.json`, formDef);
    return { report, hallazgos };
  }

  async function armarTodo() {
    setBusy(true); setError('');
    try {
      const ExcelJS = await loadExcelJS();
      const main = a.main?.data ?? null;
      const { M, buf } = await matrizInterna({ ExcelJS, fichaBuf: a.ficha.data, main, insBuf: a.matrizIns?.data ?? null, cat: await loadCatalogo() });
      const bytes = new Uint8Array(buf);
      guardarArchivo('matriz', `${nombre}_matriz_interna.xlsx`, bytes);
      setRes({ M, ...armarJson(bytes, main) });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function desdeMatriz() {
    setBusy(true); setError('');
    try { setRes({ M: null, ...armarJson(a.matriz.data, a.main?.data ?? null) }); } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const R = res?.report;
  const errores = res ? res.hallazgos.filter((h) => h.severidad === 'error') : [];
  const avisos = res ? res.hallazgos.filter((h) => h.severidad === 'aviso') : [];
  const k = res?.M?.chk;

  return (
    <div className="ui-stack">
      <Panel
        title="1 · Subí el PDF renombrado a Signaframe"
        hint="Signaframe lee los casilleros del PDF y arma un JSON con todos ellos (el «main»). Bajalo de Signaframe y cargalo abajo: de ahí salen la página y la posición de cada casillero."
        actions={a.pdf && (
          <Button size="sm" icon={Download} onClick={() => downloadBlob(new Blob([a.pdf.data], { type: 'application/pdf' }), a.pdf.name)}>Bajar PDF renombrado</Button>
        )}
      >
        <div className="ui-files">
          <FileDrop
            label={ARCHIVOS.main.label}
            description={ARCHIVOS.main.desc}
            accept=".json"
            file={a.main ? { name: a.main.name, size: a.main.size } : null}
            onFile={(f) => pick('main', f)}
            onClear={() => quitarArchivo('main')}
          />
        </div>
        {!a.main && <p className="ui-hint">Sin el main igual se arma, pero los casilleros quedan sin página ni posición.</p>}
      </Panel>

      <Panel
        title="2 · Armá la matriz y el JSON del formulario"
        hint="Junta la ficha (lo que armaste en Preguntas) con el main. Sale la matriz interna (Excel) y el JSON del formulario, listo para subir a Signaframe."
        actions={(
          <>
            <Field label="Versión" inline>
              <input className="ui-input cf-ver" value={version} onChange={(e) => setVersion(e.target.value)} aria-label="Versión del JSON" />
            </Field>
            <Button variant="primary" icon={Wand2} disabled={!a.ficha || busy} onClick={armarTodo}>{busy ? 'Armando…' : 'Armar'}</Button>
          </>
        )}
      >
        {!a.ficha && <Alert tone="info">Falta la ficha: se arma al terminar el paso «Preguntas».</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        {res && (
          <>
            <Stats items={[
              ...(k?.total ? [{ label: 'Casilleros del PDF', value: `${k.ok}/${k.total}`, tone: k.ok === k.total ? 'good' : 'bad' }] : []),
              { label: 'Campos', value: R.campos },
              { label: 'Pasos', value: R.pasos },
              { label: 'Errores del Revisor', value: errores.length, tone: errores.length ? 'bad' : 'good' },
              { label: 'Avisos del Revisor', value: avisos.length, tone: avisos.length ? 'warn' : undefined },
            ]} />
            {!a.main && <Alert tone="warning">Sin el main de Signaframe: los campos del PDF llevan solo el nombre del casillero, sin página ni posición.</Alert>}
            <Lista tone="warning" title="Casilleros que no están en el main (no van a pintar el PDF)" items={R.sinCasillero.map((x) => `${x.id} → ${x.casillero}`)} />
            <Lista tone="warning" title="Firmas sin ubicar: tienen una posición provisoria, acomodalas en Signaframe" items={R.firmasSinUbicar} />
            <Lista tone="warning" title="Ids repetidos" items={R.repetidos} />
            <Lista tone="warning" title="Errores del Revisor" items={errores.map((x) => `${x.titulo}${x.detalle ? ` — ${String(x.detalle).slice(0, 220)}` : ''}`)} />
            {k?.total > 0 && <Lista tone="warning" title="Casilleros del main sin campo" items={k.missing} />}
            {k && <Lista tone="warning" title="Casilleros en la matriz que no están en el main" items={k.extra} />}
            {res.M && <Lista tone="warning" title="Repeaters: los casilleros de las filas no siempre pintan el PDF; probalo en Signaframe" items={res.M.R.repeaters.map((r) => `${r.id}: ${r.items} ítems, ${r.slots} casilleros · ${r.pattern}`)} />}
            <details className="cf-details">
              <summary>Más detalle: lo que se corrigió o agregó solo</summary>
              <div className="ui-stack">
            <Lista title="Ids corregidos por los del main (el id del campo del PDF no se toca)" items={R.idCorregido.map((x) => `${x.de} → ${x.a}`)} />
            <Lista title="Casilleros del PDF que la matriz no usa (van ocultos en «Campos del PDF sin usar»)" items={R.sinUsar} />
            {res.M && <Lista title="Agregado por el diccionario (no estaba en la ficha)" items={res.M.R.added.map((x) => `${x.id} ${x.que} — ${x.por}`)} />}
            {res.M && <Lista title="Preguntas fuera del formulario" items={res.M.fuera.map((q) => `${q.id} ${q.label} — ${q.fuera}`)} />}
            {res.M && <Lista title="Opciones que no entran" items={res.M.R.dropped} />}
            <Lista title="Avisos del Revisor" items={avisos.map((x) => `${x.titulo}${x.detalle ? ` — ${String(x.detalle).slice(0, 220)}` : ''}`)} />
            <Lista title="Avisos de la matriz" items={[...(res.M?.R.warn || []), ...R.warn]} />
              </div>
            </details>
          </>
        )}
        <div className="ui-row">
          {a.matriz && <Button size="sm" icon={Download} onClick={() => downloadBlob(new Blob([a.matriz.data], { type: XLSX_TYPE }), a.matriz.name)}>Bajar matriz interna</Button>}
          {a.formDef && <Button size="sm" icon={Download} onClick={() => downloadBlob(jsonBlob(a.formDef.data), a.formDef.name)}>Bajar JSON del formulario</Button>}
          {a.ficha && <Button size="sm" variant="ghost" icon={Download} onClick={() => downloadBlob(new Blob([a.ficha.data], { type: XLSX_TYPE }), a.ficha.name)}>Bajar ficha</Button>}
        </div>
      </Panel>

      <details className="cf-details">
        <summary>¿Corregiste la matriz a mano en Excel?</summary>
        <Panel hint="Subí la matriz interna corregida y se vuelve a armar el JSON del formulario desde esa versión, con el main de arriba.">
          <div className="ui-files">
            <FileDrop
              label={ARCHIVOS.matriz.label}
              description="La que bajaste con «Bajar matriz interna», corregida"
              accept=".xlsx"
              file={a.matriz ? { name: a.matriz.name, size: a.matriz.size } : null}
              onFile={(f) => pick('matriz', f)}
              onClear={() => quitarArchivo('matriz')}
            />
          </div>
          <div className="ui-row">
            <Button disabled={!a.matriz || busy} onClick={desdeMatriz}>Armar el JSON desde esta matriz</Button>
          </div>
        </Panel>
      </details>

      {a.formDef && res && (
        <Alert tone={errores.length ? 'warning' : 'success'}>
          {errores.length ? 'El JSON del formulario quedó armado, pero el Revisor encontró errores. ' : 'Listo: el JSON del formulario quedó armado. '}
          Probalo antes de subirlo: <Button size="sm" variant="primary" onClick={onProbar}>Ir a Probar</Button>
        </Alert>
      )}
    </div>
  );
}
