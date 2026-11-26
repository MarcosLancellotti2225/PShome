// Simular a mano: el formulario funcionando con el motor real de Signaframe. Cada cambio vuelve a
// simular, y lo que completes también llega a Probar JSON y Probar PDF.
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Badge, Button, DataTable, Panel, Tabs } from '../../components/ui';
import { bare, jsonHtml } from './util.js';

const LEVEL = { error: ['bad', 'Error'], warning: ['warn', 'Aviso'], info: ['neutral', 'Nota'] };
const ISSUE_FILTERS = [['all', 'Todo'], ['error', 'Errores'], ['warning', 'Avisos'], ['info', 'Notas']];

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

export default function Simular({ formDef, result, edits, onEdit, onReset, payload }) {
  const [prevJson, setPrevJson] = useState(null);
  const [tab, setTab] = useState('json');
  const [issueFilter, setIssueFilter] = useState('all');
  const [pdfAll, setPdfAll] = useState(false);
  const [focus, setFocus] = useState(null);

  const issuesByField = {};
  for (const i of result.issues) if (i.fieldId && i.level !== 'info') (issuesByField[i.fieldId] ||= []).push(i.message);
  const hiddenSet = new Set(result.hiddenByRule);
  const editedCount = Object.keys(edits).length;

  function edit(id, value) {
    setPrevJson(result.json);
    onEdit({ ...edits, [id]: value });
  }

  return (
    <div className="ss-grid">
      <Panel
        title="Formulario"
        hint="Celeste: precargado con los datos de prellenado. Borde: cambiado por vos. Gris: oculto por una regla. Cada cambio vuelve a simular."
        actions={editedCount > 0 && (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => { setPrevJson(result.json); onReset(); }}>Deshacer cambios ({editedCount})</Button>
        )}
      >
        <div className="ss-form">
          {(formDef.sections || []).map((s) => {
            const own = [...(s.fields || []), ...(s.subsections || []).flatMap((x) => x.fields || [])];
            const visible = own.filter((f) => !f.hidden);
            const system = own.filter((f) => f.hidden);
            if (!visible.length && !system.length) return null;
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
            { value: 'pdf', label: 'Casilleros del PDF' },
            { value: 'diag', label: `Diagnóstico (${result.issues.length})` },
            { value: 'payload', label: 'Datos de prellenado' },
          ]} />
        )}
      >
        {tab === 'json' && (
          <>
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
                { key: 'k', label: 'Campo', render: (r) => <span className="ui-mono">{r.k}</span> },
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
        {tab === 'payload' && (
          payload
            ? <pre className="ss-code" dangerouslySetInnerHTML={{ __html: jsonHtml(payload, null) }} />
            : <p className="ui-hint">No hay datos de prellenado: el formulario arranca vacío.</p>
        )}
      </Panel>
    </div>
  );
}
