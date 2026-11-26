// Acciones sobre la hoja activa: columnas, rellenar vacíos, cruzar hojas y filtrar filas.
// Cada una recibe la hoja y devuelve los cambios con onApply(next, mensaje) (se pueden deshacer).
import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Alert, Button, DataTable, Field } from '../../components/ui';
import {
  crossSheets, detectDateCol, emptyStats, fillDown, filterRowsByMatch, guessCol, GUESS, mapColumn,
} from '../../lib/report-builder';

export function ColSelect({ label, value, onChange, cols, none, labelOf = (c) => c }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {none && <option value="">{none}</option>}
        {cols.map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}
      </select>
    </Field>
  );
}

function Check({ checked, onChange, children, disabled }) {
  return (
    <label className="rb-check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function Radio({ name, value, current, onChange, children }) {
  return (
    <label className="rb-check">
      <input type="radio" name={name} checked={current === value} onChange={() => onChange(value)} />
      <span>{children}</span>
    </label>
  );
}

// ── Columnas ────────────────────────────────────────────────────────────────
export function ColumnsAction({ sheet, onApply }) {
  const sample = (h) => sheet.rows.slice(0, 3).map((r) => String(r[h] ?? '').slice(0, 25)).join(', ');
  const setHidden = (h, hide) => onApply({ ...sheet, hidden: { ...sheet.hidden, [h]: hide } }, hide ? `Columna «${h}» oculta.` : `Columna «${h}» visible.`);
  const rename = (h, name) => {
    const renames = { ...sheet.renames };
    if (name.trim() && name.trim() !== h) renames[h] = name.trim(); else delete renames[h];
    onApply({ ...sheet, renames }, `Columna renombrada.`);
  };
  const remove = (h) => onApply({
    ...sheet,
    headers: sheet.headers.filter((x) => x !== h),
    rows: sheet.rows.map((r) => { const { [h]: _drop, ...rest } = r; return rest; }),
  }, `Columna «${h}» eliminada.`);
  const anyHidden = Object.values(sheet.hidden).some(Boolean);

  return (
    <div className="ui-stack">
      <p className="ui-hint">Ocultá, mostrá, renombrá o eliminá columnas. Los nombres nuevos se usan en el resumen y al exportar.</p>
      <div className="rb-cols">
        {sheet.headers.map((h) => (
          <div key={h} className="rb-col-row">
            <input type="checkbox" aria-label={`Mostrar ${h}`} checked={!sheet.hidden[h]} onChange={(e) => setHidden(h, !e.target.checked)} />
            <input key={sheet.renames[h] || h} className="ui-input" defaultValue={sheet.renames[h] || h} onBlur={(e) => { if (e.target.value !== (sheet.renames[h] || h)) rename(h, e.target.value); }} />
            <span className="rb-sample" title={sample(h)}>{sample(h)}</span>
            <Button size="sm" variant="ghost" icon={Trash2} title="Eliminar columna" aria-label={`Eliminar ${h}`} onClick={() => remove(h)} />
          </div>
        ))}
      </div>
      {anyHidden && <div><Button size="sm" onClick={() => onApply({ ...sheet, hidden: {} }, 'Todas las columnas visibles.')}>Mostrar todas</Button></div>}
    </div>
  );
}

// ── Rellenar vacíos ─────────────────────────────────────────────────────────
export function FillAction({ sheet, onApply }) {
  const stats = useMemo(() => emptyStats(sheet.rows, sheet.headers), [sheet]);
  const [cols, setCols] = useState(() => stats.filter((s) => s.recommended).map((s) => s.col));
  const [result, setResult] = useState(null);
  const withEmpty = stats.filter((s) => s.pctEmpty > 0);
  const [target, setTarget] = useState(withEmpty[0]?.col || '');
  const [source, setSource] = useState(guessCol(sheet.headers, GUESS.account, sheet.headers[0]));
  const [mode, setMode] = useState('same-row');
  const [error, setError] = useState(null);

  function runFill() {
    const res = fillDown(sheet.rows, cols);
    onApply({ ...sheet, rows: res.rows }, `${res.changes.length} celdas rellenadas en ${cols.length} columna(s).`);
    setResult({ kind: 'fill', ...res });
  }
  function runMap() {
    setError(null);
    try {
      const res = mapColumn(sheet.rows, target, source, mode);
      onApply({ ...sheet, rows: res.rows }, `${res.changes.length} celdas completadas: ${source} → ${target}.`);
      setResult({ kind: 'map', ...res });
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="ui-stack">
      <p className="ui-hint">Cuando Salesforce exporta datos agrupados, el valor del grupo aparece solo en la primera fila. Esto copia el último valor hacia abajo.</p>
      <div className="rb-cols">
        {stats.map((s) => (
          <div key={s.col} className="rb-col-row">
            <Check disabled={s.pctEmpty === 0} checked={cols.includes(s.col)} onChange={(on) => setCols(on ? [...cols, s.col] : cols.filter((c) => c !== s.col))}>
              <strong>{s.col}</strong> {s.recommended && <span className="ui-badge ui-badge-warn">Recomendado</span>}
            </Check>
            <span className="rb-sample">{s.pctEmpty === 0 ? 'sin vacíos' : `${s.empty} vacíos (${s.pctEmpty}%)`}</span>
          </div>
        ))}
      </div>
      <div><Button variant="primary" disabled={!cols.length} onClick={runFill}>Rellenar {cols.length ? `${cols.length} columna(s)` : ''}</Button></div>

      <h3 className="rb-h3">Completar una columna con otra</h3>
      <p className="ui-hint">Si una columna está vacía, copiar el valor de otra. Ej.: si «Parent Account» está vacío, usar «Account Name».</p>
      {withEmpty.length ? (
        <>
          <div className="rb-grid">
            <ColSelect label="Si esta columna está vacía" value={target} onChange={setTarget} cols={withEmpty.map((s) => s.col)} labelOf={(c) => `${c} (${stats.find((s) => s.col === c).pctEmpty}% vacío)`} />
            <ColSelect label="Copiar el valor de" value={source} onChange={setSource} cols={sheet.headers} />
          </div>
          <div className="ui-row">
            <Radio name="rb-map" value="same-row" current={mode} onChange={setMode}>De la misma fila</Radio>
            <Radio name="rb-map" value="lookup" current={mode} onChange={setMode}>Buscarlo en otras filas</Radio>
          </div>
          <div><Button onClick={runMap}>Completar</Button></div>
        </>
      ) : <Alert tone="success">Ninguna columna tiene vacíos.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {result && (
        <div className="ui-stack">
          <Alert tone={result.changes.length ? 'success' : 'info'}>
            {result.changes.length} celdas completadas.
            {result.kind === 'map' && (result.remaining ? ` Quedan ${result.remaining} filas sin completar: ${result.unmapped.slice(0, 15).map((u) => `${u.value} (${u.count})`).join(', ')}${result.unmapped.length > 15 ? '…' : ''}` : ' No queda ninguna fila vacía.')}
          </Alert>
          {result.changes.length > 0 && (
            <DataTable
              maxHeight={220}
              columns={result.kind === 'fill'
                ? [{ key: 'row', label: 'Fila' }, { key: 'col', label: 'Columna' }, { key: 'to', label: 'Valor nuevo' }]
                : [{ key: 'row', label: 'Fila' }, { key: 'source', label: source }, { key: 'value', label: `${target} (nuevo)` }]}
              rows={result.changes.slice(0, 30).map((c) => ({ ...c, row: c.row + 1 }))}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Cruzar hojas ────────────────────────────────────────────────────────────
function defaultsFor(o) {
  if (!o) return { keyB: '', sameA: '', sameB: '', dateCol: '', from: '', to: '' };
  const csm = guessCol(o.headers, GUESS.csmFull);
  const owner = guessCol(o.headers, GUESS.owner);
  return {
    keyB: guessCol(o.headers, GUESS.account, o.headers[0]),
    sameA: csm && owner ? csm : '', sameB: csm && owner ? owner : '',
    dateCol: detectDateCol(o.headers, o.rows), from: '', to: '',
  };
}

export function CrossAction({ sheet, sheets, onApply }) {
  const others = sheets.filter((s) => s.id !== sheet.id);
  const [otherId, setOtherId] = useState(others[0]?.id || '');
  const other = others.find((s) => s.id === otherId) || others[0];
  const [keyA, setKeyA] = useState(guessCol(sheet.headers, GUESS.account, sheet.headers[0]));
  const [cfg, setCfg] = useState(() => defaultsFor(other));
  const [opts, setOpts] = useState({ count: true, last: true, first: false });
  const [error, setError] = useState(null);

  const set = (k) => (v) => setCfg({ ...cfg, [k]: v });

  if (!other) return <Alert tone="info">Cargá al menos dos hojas para cruzarlas (ej.: las cuentas y las actividades).</Alert>;

  function run() {
    setError(null);
    try {
      const res = crossSheets(sheet.rows, other.rows, { keyA, ...cfg, ...opts });
      const headers = [...sheet.headers, ...res.newCols.filter((c) => !sheet.headers.includes(c))];
      onApply({ ...sheet, rows: res.rows, headers }, `${res.matched} de ${sheet.rows.length} filas tienen coincidencias en «${other.name}». Columnas: ${res.newCols.join(', ')}.`);
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="ui-stack">
      <p className="ui-hint">Trae datos de otra hoja. Ej.: para cada cuenta, cuántos contactos tiene en el reporte de actividades y cuándo fue el último.</p>
      <div className="rb-grid">
        <ColSelect label={`Columna clave de «${sheet.name}»`} value={keyA} onChange={setKeyA} cols={sheet.headers} />
        <Field label="Hoja a cruzar">
          <select value={other.id} onChange={(e) => { setOtherId(e.target.value); setCfg(defaultsFor(others.find((s) => s.id === e.target.value))); }}>
            {others.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.rows.length} filas)</option>)}
          </select>
        </Field>
        <ColSelect label="Columna clave de la hoja a cruzar" value={cfg.keyB} onChange={set('keyB')} cols={other.headers} />
      </div>
      <div className="rb-box">
        <span className="ui-field-label">Contar solo cuando estas dos columnas coincidan (opcional)</span>
        <p className="ui-hint">Ej.: «Customer Success Manager: Full Name» = «Owner Name», para contar solo los contactos que hizo el CSM.</p>
        <div className="rb-grid">
          <ColSelect label="Columna" value={cfg.sameA} onChange={set('sameA')} cols={other.headers} none="— Ninguna —" />
          <ColSelect label="igual a" value={cfg.sameB} onChange={set('sameB')} cols={other.headers} none="— Ninguna —" />
        </div>
      </div>
      <div className="rb-grid">
        <ColSelect label="Columna de fecha de la hoja a cruzar" value={cfg.dateCol} onChange={set('dateCol')} cols={other.headers} none="— Sin fecha —" />
        <Field label="Contar desde"><input type="date" value={cfg.from} disabled={!cfg.dateCol} onChange={(e) => set('from')(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" value={cfg.to} disabled={!cfg.dateCol} onChange={(e) => set('to')(e.target.value)} /></Field>
      </div>
      <div className="ui-row">
        <span className="ui-field-label">Agregar:</span>
        <Check checked={opts.count} onChange={(v) => setOpts({ ...opts, count: v })}>Cantidad de coincidencias</Check>
        <Check checked={opts.last} disabled={!cfg.dateCol} onChange={(v) => setOpts({ ...opts, last: v })}>Última fecha</Check>
        <Check checked={opts.first} disabled={!cfg.dateCol} onChange={(v) => setOpts({ ...opts, first: v })}>Primera fecha</Check>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <div><Button variant="primary" onClick={run}>Cruzar</Button></div>
    </div>
  );
}

// ── Filtrar filas por coincidencia ──────────────────────────────────────────
export function FilterAction({ sheet, onApply }) {
  const [p, setP] = useState(() => ({
    colA: guessCol(sheet.headers, /customer success/i, sheet.headers[0]),
    colB: guessCol(sheet.headers, GUESS.owner, sheet.headers[1] || sheet.headers[0]),
    mode: 'neq', ignoreCase: true, ignoreEmpty: false,
  }));
  const set = (k) => (v) => setP({ ...p, [k]: v });
  const preview = useMemo(() => {
    try { return filterRowsByMatch(sheet.rows, p); } catch (e) { return { error: e.message }; }
  }, [sheet.rows, p]);

  return (
    <div className="ui-stack">
      <p className="ui-hint">Borra las filas donde dos columnas no coinciden (o coinciden). Ej.: quedarse solo con las actividades donde «Customer Success Manager» = «Owner Name».</p>
      <div className="rb-grid">
        <ColSelect label="Columna A" value={p.colA} onChange={set('colA')} cols={sheet.headers} />
        <ColSelect label="Columna B" value={p.colB} onChange={set('colB')} cols={sheet.headers} />
      </div>
      <div className="ui-stack rb-tight">
        <Radio name="rb-rf" value="neq" current={p.mode} onChange={set('mode')}>Borrar donde A ≠ B (quedan las que coinciden)</Radio>
        <Radio name="rb-rf" value="eq" current={p.mode} onChange={set('mode')}>Borrar donde A = B (quedan las distintas)</Radio>
      </div>
      <div className="ui-row">
        <Check checked={p.ignoreCase} onChange={set('ignoreCase')}>Ignorar mayúsculas</Check>
        <Check checked={p.ignoreEmpty} onChange={set('ignoreEmpty')}>No borrar si alguna está vacía</Check>
      </div>
      {preview.error ? <Alert tone="warning">{preview.error}</Alert> : (
        <>
          <Alert tone={preview.removed ? 'warning' : 'info'}>{preview.removed} filas se van a borrar · quedan {preview.rows.length}.</Alert>
          {preview.examples.length > 0 && (
            <DataTable maxHeight={180} columns={[{ key: 'row', label: 'Fila' }, { key: 'a', label: p.colA }, { key: 'b', label: p.colB }]} rows={preview.examples} />
          )}
          <div>
            <Button variant="danger" disabled={!preview.removed} onClick={() => onApply({ ...sheet, rows: preview.rows }, `${preview.removed} filas borradas. Quedan ${preview.rows.length}. Podés deshacer.`)}>
              Borrar {preview.removed} filas
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
