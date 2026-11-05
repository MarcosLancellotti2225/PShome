// Signaframe Studio — ver y corregir un formulario de Signaframe con el mismo motor del front.
// Abre un «trabajo» que armó Claude con el MCP (mcp/server.mjs) o simula acá con form-def + payload.
// Todo corre en el navegador: la simulación usa src/lib/signaframe-engine.
import { useMemo, useState } from 'react';
import { Download, RotateCcw, Save } from 'lucide-react';
import { simulate } from '../../lib/signaframe-engine/index.js';
import { construirModelo } from '../../lib/json-mapper/revisor/modelo.js';
import { revisar } from '../../lib/json-mapper/revisor/reglas.js';
import { baseName, downloadBlob, jsonBlob, readJson } from '../../lib/files';
import { Alert, Badge, Button, DataTable, FileDrop, Panel, Stats, Tabs } from '../../components/ui';
import './studio.css';

const TRABAJO_TIPO = 'se-tools/signaframe-trabajo';
const LEVEL = { error: ['bad', 'Error'], warning: ['warn', 'Aviso'], info: ['neutral', 'Nota'] };
const REV = { error: ['bad', 'Error'], aviso: ['warn', 'Aviso'], nota: ['neutral', 'Nota'] };
const ISSUE_FILTERS = [['all', 'Todo'], ['error', 'Errores'], ['warning', 'Avisos'], ['info', 'Notas']];

const bare = (id) => (id.startsWith('field_') ? id.slice(6) : id);

function unwrapFormDef(j) {
  if (j?.sections) return j;
  for (const c of [j?.formDefinition, j?.definition, j?.data?.jsonDefinition, j?.jsonDefinition, j?.data?.formDefinition]) {
    if (c?.sections) return c;
  }
  throw new Error('El archivo no parece un form-def: no tiene «sections».');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// JSON coloreado; las líneas que cambiaron desde la simulación anterior quedan marcadas.
function jsonHtml(obj, prev) {
  const lines = JSON.stringify(obj, null, 2).split('\n');
  const before = prev ? new Set(JSON.stringify(prev, null, 2).split('\n')) : null;
  return lines
    .map((l) => {
      const h = escapeHtml(l).replace(/^(\s*)&quot;([^&]+?)&quot;:/, '$1"<span class="ss-key">$2</span>":');
      return before && !before.has(l) ? `<span class="ss-chg">${h}</span>` : h;
    })
    .join('\n');
}

function valueOf(data, f) {
  return data[f.id] ?? data[bare(f.id)] ?? data[`field_${bare(f.id)}`] ?? '';
}

function FieldInput({ field, value, onChange }) {
  const opts = (field.options || []).map((o) => (typeof o === 'string' ? { label: o } : o));
  if (field.type === 'select') {
    const known = opts.some((o) => o.label === value);
    return (
      <select className="ui-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" />
        {opts.map((o) => (
          <option key={o.label} value={o.label}>
            {o.label}{o.jsonValue != null && o.jsonValue !== o.label ? ` · ${o.jsonValue}` : ''}
          </option>
        ))}
        {value && !known && <option value={value}>{value} (no está en las opciones)</option>}
      </select>
    );
  }
  if (field.type === 'checkbox') {
    const on = value === 'true';
    return (
      <label className="ss-check">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? 'true' : '')} /> {on ? 'Marcada' : 'Sin marcar'}
      </label>
    );
  }
  if (['text', 'textarea', 'number', 'email', 'date', 'time'].includes(field.type)) {
    return <input className="ui-input" type={field.type === 'date' ? 'date' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return <div className="ss-ro">{value || '—'} <span className="ss-sub">({field.type})</span></div>;
}

export default function SignaframeStudio() {
  const [source, setSource] = useState('trabajo');
  const [files, setFiles] = useState({});
  const [work, setWork] = useState(null); // { nombre, formDefinition, payload, expectedJson }
  const [edits, setEdits] = useState({});
  const [prevJson, setPrevJson] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('json');
  const [issueFilter, setIssueFilter] = useState('all');
  const [pdfAll, setPdfAll] = useState(false);
  const [focus, setFocus] = useState(null);

  async function openTrabajo(file) {
    setFiles({ trabajo: file });
    setError('');
    if (!file) return;
    try {
      const t = await readJson(file, 'El trabajo');
      if (t?.tipo !== TRABAJO_TIPO) throw new Error('Este archivo no es un trabajo de Signaframe Studio. Para simular con un form-def, usá «Simular acá».');
      setWork({ nombre: t.nombre, ...t.entrada, formDefinition: unwrapFormDef(t.entrada.formDefinition) });
      setEdits(t.entrada.edits || {});
      setPrevJson(null);
    } catch (e) {
      setWork(null);
      setError(e.message);
    }
  }

  async function pickInput(kind, file) {
    const next = { ...files, [kind]: file };
    setFiles(next);
    setError('');
    if (!next.formDef) return;
    try {
      const formDefinition = unwrapFormDef(await readJson(next.formDef, 'El form-def'));
      const payload = next.payload ? await readJson(next.payload, 'El payload') : null;
      const expectedJson = next.expected ? await readJson(next.expected, 'El JSON esperado') : null;
      setWork({ nombre: baseName(next.formDef, 'formulario'), formDefinition, payload, expectedJson });
      setEdits({});
      setPrevJson(null);
    } catch (e) {
      setWork(null);
      setError(e.message);
    }
  }

  const { result, simError } = useMemo(() => {
    if (!work) return { result: null };
    try {
      return { result: simulate({ formDefinition: work.formDefinition, payload: work.payload, edits, expectedJson: work.expectedJson }) };
    } catch (e) {
      return { result: null, simError: e.message };
    }
  }, [work, edits]);

  const hallazgos = useMemo(() => {
    if (!work) return [];
    try { return revisar(construirModelo(work.formDefinition)); } catch { return []; }
  }, [work]);

  function edit(fieldId, value) {
    setPrevJson(result?.json ?? null);
    setEdits((e) => ({ ...e, [fieldId]: value }));
  }

  function resetEdits() {
    setPrevJson(result?.json ?? null);
    setEdits({});
  }

  function saveTrabajo() {
    downloadBlob(jsonBlob({
      tipo: TRABAJO_TIPO,
      version: 1,
      nombre: work.nombre,
      creado: new Date().toISOString(),
      entrada: { formDefinition: work.formDefinition, payload: work.payload, edits, expectedJson: work.expectedJson },
      resultado: result,
      revision: { hallazgos },
    }), `${work.nombre}_trabajo.json`);
  }

  const issuesByField = useMemo(() => {
    const m = {};
    for (const i of result?.issues ?? []) if (i.fieldId && i.level !== 'info') (m[i.fieldId] ||= []).push(i.message);
    return m;
  }, [result]);

  const shownError = error || simError;
  const count = (lvl) => (result?.issues ?? []).filter((i) => i.level === lvl).length;
  const editedCount = Object.keys(edits).length;

  return (
    <div className="ui-stack">
      <Panel
        title="Formulario a revisar"
        hint="Abrí el trabajo que armó Claude o cargá el form-def y el payload. Se simula con el mismo motor que el formulario real de Signaframe, sin crear ningún proceso."
        actions={<Tabs value={source} onChange={(v) => { setSource(v); setError(''); }} options={[{ value: 'trabajo', label: 'Abrir trabajo' }, { value: 'archivos', label: 'Simular acá' }]} />}
      >
        {source === 'trabajo' ? (
          <div className="ui-files">
            <FileDrop label="Trabajo" description="El .json que guarda Claude en la carpeta de trabajos" accept=".json" file={files.trabajo} onFile={openTrabajo} required />
          </div>
        ) : (
          <div className="ui-files">
            <FileDrop label="Form-def" description="JSON de la plantilla" accept=".json" file={files.formDef} onFile={(f) => pickInput('formDef', f)} required />
            <FileDrop label="Payload del cliente" description="Body del alta de proceso (encabezado + datosFormulario)" accept=".json" file={files.payload} onFile={(f) => pickInput('payload', f)} />
            <FileDrop label="JSON esperado (opcional)" description="Para comparar campo por campo" accept=".json" file={files.expected} onFile={(f) => pickInput('expected', f)} />
          </div>
        )}
        {shownError && <Alert tone="error">{shownError}</Alert>}
      </Panel>

      {result && (
        <>
          <Panel
            title={work.nombre}
            actions={(
              <>
                {editedCount > 0 && <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetEdits}>Deshacer cambios ({editedCount})</Button>}
                <Button size="sm" icon={Download} onClick={() => downloadBlob(jsonBlob(result.json), `${work.nombre}_salida.json`)}>Bajar JSON que sale</Button>
                <Button size="sm" variant="primary" icon={Save} onClick={saveTrabajo}>Guardar trabajo</Button>
              </>
            )}
          >
            <Stats items={[
              { label: 'Campos', value: result.stats.fields },
              { label: 'Precargados', value: result.stats.prefilled },
              { label: 'Ocultos por regla', value: result.stats.hiddenByRule },
              { label: 'AcroForms con valor', value: result.stats.pdfValues },
              { label: 'Valores en el JSON', value: result.stats.jsonLeaves },
              ...(result.diff ? [{ label: 'Contra el esperado', value: result.diff.length ? `${result.diff.length} dif.` : 'Idéntico', tone: result.diff.length ? 'bad' : 'good' }] : []),
              { label: 'Errores', value: count('error') + hallazgos.filter((h) => h.severidad === 'error').length, tone: count('error') ? 'bad' : 'good' },
              { label: 'Avisos', value: count('warning') + hallazgos.filter((h) => h.severidad === 'aviso').length, tone: count('warning') ? 'warn' : undefined },
            ]} />
          </Panel>

          <div className="ss-grid">
            <Panel title="Formulario" hint="Celeste: precargado del payload. Borde: cambiado por vos. Gris: oculto por una regla. Cada cambio vuelve a simular.">
              <div className="ss-form">
                {(work.formDefinition.sections || []).map((s) => {
                  const own = [...(s.fields || []), ...(s.subsections || []).flatMap((x) => x.fields || [])];
                  const visible = own.filter((f) => !f.hidden);
                  const system = own.filter((f) => f.hidden);
                  if (!visible.length && !system.length) return null;
                  const hiddenSet = new Set(result.hiddenByRule);
                  const off = s.hidden || (visible.length > 0 && visible.every((f) => hiddenSet.has(f.id)));
                  const renderField = (f) => {
                    const v = String(valueOf(result.formData, f) ?? '');
                    const isEdited = Object.prototype.hasOwnProperty.call(edits, f.id);
                    const cls = [
                      'ss-field',
                      hiddenSet.has(f.id) && 'is-off',
                      !isEdited && v.trim() && f.prefillKey && 'is-pre',
                      isEdited && 'is-edited',
                      focus === f.id && 'is-focus',
                    ].filter(Boolean).join(' ');
                    return (
                      <div key={f.id} id={`ss-${f.id}`} className={cls}>
                        <span className="ss-label" title={f.prefillKey || ''}>
                          {f.label || bare(f.id)}{f.required && <span className="ui-required"> *</span>}
                          {issuesByField[f.id] && <span className="ss-dot" title={issuesByField[f.id].join('\n')}>!</span>}
                        </span>
                        <FieldInput field={f} value={v} onChange={(val) => edit(f.id, val)} />
                        <span className="ss-sub ui-mono">{f.sourceMeta?.sourceName || f.id}</span>
                      </div>
                    );
                  };
                  return (
                    <div key={s.id} className={`ss-section ${off ? 'is-off' : ''}`}>
                      <div className="ss-section-head">
                        {s.title || s.id} <Badge>{visible.length}</Badge>
                        {off && <span className="ss-sub">oculta por regla</span>}
                      </div>
                      {visible.length > 0 && <div className="ss-fields">{visible.map(renderField)}</div>}
                      {system.length > 0 && (
                        <details className="ss-system" open={system.some((f) => f.id === focus)}>
                          <summary>{system.length} campos ocultos de sistema o helpers</summary>
                          <div className="ss-fields">{system.map(renderField)}</div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel
              title={(
                <Tabs value={tab} onChange={setTab} options={[
                  { value: 'json', label: 'JSON que sale' },
                  { value: 'pdf', label: 'PDF' },
                  { value: 'diag', label: `Diagnóstico (${result.issues.length})` },
                  { value: 'rev', label: `Revisor (${hallazgos.length})` },
                  { value: 'payload', label: 'Payload' },
                ]} />
              )}
            >
              {tab === 'json' && (
                <>
                  {result.diff?.length > 0 && (
                    <DataTable
                      maxHeight={240}
                      rows={result.diff.map((d, i) => ({ ...d, key: i }))}
                      columns={[
                        { key: 'path', label: 'Ruta', render: (d) => <span className="ui-mono">{d.path}</span> },
                        { key: 'expected', label: 'Esperado', render: (d) => <span className="ui-mono">{d.kind === 'sobrante' ? '—' : JSON.stringify(d.expected)}</span> },
                        { key: 'actual', label: 'Sale', render: (d) => <Badge tone="bad">{d.kind === 'faltante' ? 'falta' : JSON.stringify(d.actual)}</Badge> },
                      ]}
                    />
                  )}
                  <p className="ui-hint">Lo que Signaframe enviaría al cliente. Las líneas marcadas cambiaron con tu último cambio.</p>
                  <pre className="ss-code" dangerouslySetInnerHTML={{ __html: jsonHtml(result.json, prevJson) }} />
                </>
              )}
              {tab === 'pdf' && (
                <>
                  <label className="ss-check"><input type="checkbox" checked={pdfAll} onChange={(e) => setPdfAll(e.target.checked)} /> Mostrar también los vacíos</label>
                  <DataTable
                    maxHeight={560}
                    rows={Object.entries(result.pdf).filter(([, v]) => pdfAll || (v != null && String(v) !== '')).map(([k, v]) => ({ key: k, k, v }))}
                    columns={[
                      { key: 'k', label: 'AcroForm', render: (r) => <span className="ui-mono">{r.k}</span> },
                      { key: 'v', label: 'Valor', render: (r) => (typeof r.v === 'object' ? JSON.stringify(r.v) : String(r.v)) },
                    ]}
                  />
                </>
              )}
              {tab === 'diag' && (
                <>
                  <Tabs value={issueFilter} onChange={setIssueFilter} options={ISSUE_FILTERS.map(([value, label]) => ({ value, label }))} />
                  <DataTable
                    maxHeight={560}
                    empty="Nada que reportar."
                    rows={result.issues.filter((i) => issueFilter === 'all' || i.level === issueFilter).map((i, n) => ({ ...i, key: n }))}
                    columns={[
                      { key: 'level', label: '', render: (i) => <Badge tone={LEVEL[i.level][0]}>{LEVEL[i.level][1]}</Badge> },
                      { key: 'message', label: 'Qué pasa', render: (i) => (
                        <>
                          {i.message}
                          <div className="ss-sub ui-mono">{i.code} · {i.fieldId || i.path}</div>
                        </>
                      ) },
                      { key: 'go', label: '', render: (i) => i.fieldId && (
                        <Button size="sm" variant="ghost" onClick={() => { setFocus(i.fieldId); document.getElementById(`ss-${i.fieldId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }}>Ver</Button>
                      ) },
                    ]}
                  />
                </>
              )}
              {tab === 'rev' && (
                <DataTable
                  maxHeight={600}
                  empty="El Revisor no encontró nada."
                  rows={hallazgos.map((h, n) => ({ ...h, key: n }))}
                  columns={[
                    { key: 'sev', label: '', render: (h) => <Badge tone={REV[h.severidad]?.[0] || 'neutral'}>{REV[h.severidad]?.[1] || h.severidad}</Badge> },
                    { key: 'titulo', label: 'Regla', render: (h) => (
                      <>
                        <b>{h.regla}</b> {h.titulo}
                        <div className="ss-sub">{h.detalle}</div>
                        {h.campoIds?.length > 0 && <div className="ss-sub ui-mono">{h.campoIds.slice(0, 5).join(', ')}{h.campoIds.length > 5 ? ` +${h.campoIds.length - 5}` : ''}</div>}
                      </>
                    ) },
                  ]}
                />
              )}
              {tab === 'payload' && (
                work.payload
                  ? <pre className="ss-code" dangerouslySetInnerHTML={{ __html: jsonHtml(work.payload, null) }} />
                  : <p className="ui-hint">Este trabajo no tiene payload: el formulario arranca vacío.</p>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
