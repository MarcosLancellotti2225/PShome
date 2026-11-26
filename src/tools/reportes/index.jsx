// Reportes — integrado desde el repo Presentations («Report Builder»).
// Solo la parte de comparar hojas y armar reportes (los gráficos y el portal no se migran).
// Lógica en src/lib/report-builder; acá solo la interfaz.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Download, Eye, FileSpreadsheet, Printer, Sparkles, Undo2, X } from 'lucide-react';
import { Alert, Badge, Button, DataTable, Field, FileDrop, Panel, Stats, Tabs } from '../../components/ui';
import { downloadBlob } from '../../lib/files';
import {
  accountDetail, buildCsv, buildJson, buildReportHtml, buildTsv, buildXlsx, crossSheets, detectDateCol, emptyStats,
  fillDown, filterByDate, guessCol, GUESS, MATCH_COLS, parsePasted, pctTone, readSheetsFromFile,
  searchRows, sortRows, summarize,
} from '../../lib/report-builder';
import { ColSelect, ColumnsAction, CrossAction, FillAction, FilterAction } from './actions';
import './reportes.css';

const MAX_ROWS = 500;
const MAX_HISTORY = 20;
const today = () => new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
const newId = () => `rb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const fileSafe = (s) => String(s || 'reporte').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_-]+/g, '_').slice(0, 40);
const labelOf = (sheet) => (c) => sheet?.renames[c] || c;
const visibleCols = (sheet) => sheet.headers.filter((h) => !sheet.hidden[h]);

function makeSheet(name, headers, rows) {
  return { id: newId(), name, headers: [...headers], rows, hidden: {}, renames: {}, history: [] };
}

function guessSummary(sheet) {
  const h = visibleCols(sheet);
  return {
    groupBy: guessCol(h, GUESS.csm, h[0]),
    countCol: guessCol(h, GUESS.countCol, h[1] || h[0]),
    contactCol: h.includes(MATCH_COLS.count) ? MATCH_COLS.count : guessCol(h, GUESS.contact),
    threshold: 1,
    sumCol: guessCol(h, GUESS.sum),
  };
}

const ACTIONS = [
  { value: 'cols', label: 'Columnas' },
  { value: 'fill', label: 'Rellenar vacíos' },
  { value: 'cross', label: 'Cruzar hojas' },
  { value: 'filter', label: 'Filtrar filas' },
];

export default function Reportes() {
  const [sheets, setSheets] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [status, setStatus] = useState(null); // { tone, text }
  const [paste, setPaste] = useState(null); // { text, name } mientras se pega
  const [action, setAction] = useState(null);
  const [view, setView] = useState({ search: '', dateCol: null, from: '', to: '', sort: '', asc: true });
  const [summary, setSummary] = useState(null); // { sheetId, cfg, result, stamp }

  const sheet = sheets.find((s) => s.id === activeId) || null;
  const label = labelOf(sheet);

  // ── Hojas ──
  function addSheets(list) {
    const created = list.map((r) => makeSheet(r.name, r.headers, r.data));
    if (!created.length) return;
    setSheets((prev) => [...prev, ...created]);
    setActiveId(created[created.length - 1].id);
    setStatus({ tone: 'success', text: created.map((s) => `${s.name}: ${s.rows.length} filas, ${s.headers.length} columnas`).join(' · ') });
  }

  async function onFile(file) {
    if (!file) return;
    try { addSheets(await readSheetsFromFile(file)); } catch (e) { setStatus({ tone: 'error', text: `No se pudo leer ${file.name}: ${e.message}` }); }
  }

  function onPaste() {
    try {
      const r = parsePasted(paste.text);
      if (!r.data.length) throw new Error('No hay filas debajo de los encabezados.');
      addSheets([{ name: paste.name.trim() || 'Datos pegados', ...r }]);
      setPaste(null);
    } catch (e) { setStatus({ tone: 'error', text: e.message }); }
  }

  function removeSheet(id) {
    const rest = sheets.filter((s) => s.id !== id);
    setSheets(rest);
    if (activeId === id) setActiveId(rest[rest.length - 1]?.id ?? null);
    if (summary?.sheetId === id) setSummary(null);
  }

  function switchSheet(id) {
    setActiveId(id);
    setAction(null);
    setView({ search: '', dateCol: null, from: '', to: '', sort: '', asc: true });
  }

  // Cambio de la hoja activa con deshacer.
  const applyTo = useCallback((id, next, msg) => {
    setSheets((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const snap = { rows: s.rows, headers: s.headers, hidden: s.hidden, renames: s.renames };
      return { ...next, history: [...s.history, snap].slice(-MAX_HISTORY) };
    }));
    if (msg) setStatus({ tone: 'success', text: msg });
  }, []);
  const apply = (next, msg) => applyTo(sheet.id, next, msg);

  const undo = useCallback(() => {
    setSheets((prev) => prev.map((s) => {
      if (s.id !== activeId || !s.history.length) return s;
      const snap = s.history[s.history.length - 1];
      return { ...s, ...snap, history: s.history.slice(0, -1) };
    }));
    setStatus({ tone: 'info', text: 'Cambio deshecho.' });
  }, [activeId]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  // ── Vista: fechas, búsqueda y orden ──
  const dateCol = sheet ? (view.dateCol ?? detectDateCol(sheet.headers, sheet.rows)) : '';
  const viewRows = useMemo(() => {
    if (!sheet) return [];
    let rows = filterByDate(sheet.rows, dateCol, view.from, view.to);
    rows = searchRows(rows, visibleCols(sheet), view.search);
    if (view.sort) rows = sortRows(rows, view.sort, view.asc);
    return rows;
  }, [sheet, dateCol, view]);
  const filtered = sheet && viewRows.length !== sheet.rows.length;

  // ── Resumen ──
  function generate(cfg, rows = viewRows, target = sheet) {
    try {
      const result = summarize(rows, { ...cfg, label: labelOf(target) });
      setSummary({ sheetId: target.id, cfg, result, stamp: Date.now(), visible: null });
      setStatus({ tone: 'success', text: `Resumen listo: ${result.groups.length} grupos.` });
      setTimeout(() => document.getElementById('rb-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) { setStatus({ tone: 'error', text: e.message }); }
  }

  const tableCols = sheet ? [
    { key: '__n', label: '#', render: (r) => r.__n },
    ...visibleCols(sheet).map((h) => ({ key: h, label: label(h), render: (r) => String(r[h] ?? '') })),
  ] : [];

  return (
    <div className="ui-stack rb">
      <Panel title="1 · Cargar hojas" hint="Excel, CSV, TSV o JSON. Reconoce los reportes de Salesforce (saltea los filtros de arriba). Cada pestaña del Excel es una hoja.">
        <div className="rb-load">
          <FileDrop label="Agregar archivo" description="Hacé clic o arrastrá un archivo acá (podés sumar varios, de a uno)" accept=".xlsx,.xls,.csv,.tsv,.txt,.json" file={null} onFile={onFile} />
          <Button onClick={() => setPaste(paste ? null : { text: '', name: 'Datos pegados' })}>{paste ? 'Cerrar' : 'Pegar datos'}</Button>
        </div>
        {paste && (
          <div className="ui-stack rb-box">
            <Field label="Pegá datos desde Excel, Sheets o un CSV (la primera fila son los encabezados)">
              <textarea className="ui-input rb-paste" rows={8} value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} />
            </Field>
            <div className="ui-row">
              <Field label="Nombre de la hoja" inline><input value={paste.name} onChange={(e) => setPaste({ ...paste, name: e.target.value })} /></Field>
              <Button variant="primary" disabled={!paste.text.trim()} onClick={onPaste}>Cargar</Button>
            </div>
          </div>
        )}
        {sheets.length > 0 && (
          <div className="rb-sheets" role="tablist">
            {sheets.map((s) => (
              <span key={s.id} className={`rb-sheet ${s.id === activeId ? 'is-active' : ''}`}>
                <button type="button" role="tab" aria-selected={s.id === activeId} onClick={() => switchSheet(s.id)}>
                  {s.name} <small>({s.rows.length})</small>
                </button>
                <button type="button" className="rb-sheet-x" aria-label={`Quitar ${s.name}`} title="Quitar" onClick={() => removeSheet(s.id)}><X size={14} /></button>
              </span>
            ))}
          </div>
        )}
      </Panel>

      {status && <Alert tone={status.tone}>{status.text}</Alert>}

      {sheets.length >= 2 && (
        <ContactsWizard key={sheets.map((s) => s.id).join('|')} sheets={sheets} applyTo={applyTo} onReady={(target, rows, cfg) => { switchSheet(target.id); generate(cfg, rows, target); }} />
      )}

      {sheet && (
        <Panel
          title={`2 · Hoja: ${sheet.name}`}
          hint="Prepará la hoja: rellená vacíos, cruzala con otra, filtrá filas. Todo se puede deshacer (Ctrl+Z)."
          actions={sheet.history.length > 0 && <Button size="sm" icon={Undo2} onClick={undo}>Deshacer ({sheet.history.length})</Button>}
        >
          <Stats items={[
            { label: filtered ? 'filas (filtradas)' : 'filas', value: filtered ? `${viewRows.length} / ${sheet.rows.length}` : sheet.rows.length },
            { label: 'columnas visibles', value: `${visibleCols(sheet).length} / ${sheet.headers.length}` },
            ...(dateCol ? [{ label: 'columna de fecha', value: label(dateCol) }] : []),
          ]} />
          <div className="ui-row rb-actions">
            <Tabs value={action} onChange={(v) => setAction(action === v ? null : v)} options={ACTIONS} />
          </div>
          {action && (
            <div className="rb-action">
              {action === 'cols' && <ColumnsAction key={sheet.id} sheet={sheet} onApply={apply} />}
              {action === 'fill' && <FillAction key={sheet.id} sheet={sheet} onApply={apply} />}
              {action === 'cross' && <CrossAction key={sheet.id} sheet={sheet} sheets={sheets} onApply={apply} />}
              {action === 'filter' && <FilterAction key={sheet.id} sheet={sheet} onApply={apply} />}
            </div>
          )}
          <div className="rb-grid rb-view">
            <Field label="Buscar"><input type="search" value={view.search} placeholder="Texto en cualquier columna" onChange={(e) => setView({ ...view, search: e.target.value })} /></Field>
            <ColSelect label="Columna de fecha" value={dateCol} onChange={(v) => setView({ ...view, dateCol: v })} cols={sheet.headers} none="— Sin fecha —" labelOf={label} />
            <Field label="Desde"><input type="date" value={view.from} disabled={!dateCol} onChange={(e) => setView({ ...view, from: e.target.value })} /></Field>
            <Field label="Hasta"><input type="date" value={view.to} disabled={!dateCol} onChange={(e) => setView({ ...view, to: e.target.value })} /></Field>
            <ColSelect label="Ordenar por" value={view.sort} onChange={(v) => setView({ ...view, sort: v })} cols={visibleCols(sheet)} none="— Como vino —" labelOf={label} />
            <Field label="Sentido">
              <select value={view.asc ? 'asc' : 'desc'} disabled={!view.sort} onChange={(e) => setView({ ...view, asc: e.target.value === 'asc' })}>
                <option value="asc">A → Z / menor a mayor</option>
                <option value="desc">Z → A / mayor a menor</option>
              </select>
            </Field>
          </div>
          <DataTable
            maxHeight={480}
            columns={tableCols}
            rows={viewRows.slice(0, MAX_ROWS).map((r, i) => ({ ...r, __n: i + 1, key: i }))}
            empty="No hay filas con estos filtros."
          />
          {viewRows.length > MAX_ROWS && <p className="ui-hint">Se muestran las primeras {MAX_ROWS} filas de {viewRows.length}. El resumen y la exportación usan todas.</p>}
          <SummaryConfig
            key={`${sheet.id}-${summary?.sheetId === sheet.id ? summary.stamp : 0}`}
            sheet={sheet}
            initial={summary?.sheetId === sheet.id ? summary.cfg : guessSummary(sheet)}
            onGenerate={(cfg) => generate(cfg)}
            rowsCount={viewRows.length}
          />
        </Panel>
      )}

      {summary && sheets.some((s) => s.id === summary.sheetId) && (
        <SummaryOutput
          key={summary.stamp}
          summary={summary}
          sheet={sheets.find((s) => s.id === summary.sheetId)}
          viewRows={summary.sheetId === activeId ? viewRows : null}
          period={summary.sheetId === activeId && dateCol && (view.from || view.to) ? `${view.from || '…'} a ${view.to || '…'}` : ''}
          setStatus={setStatus}
        />
      )}

      {!sheets.length && (
        <Alert tone="info">
          Para el reporte de contactos por cuenta: cargá el reporte de cuentas (con el CSM y el MRR) y el de actividades o emails. Aparece un asistente que los cruza y arma el reporte.
        </Alert>
      )}
    </div>
  );
}

// ── Asistente: reporte de contactos por cuenta ──────────────────────────────
function ContactsWizard({ sheets, applyTo, onReady }) {
  const byHeaders = (re) => sheets.find((s) => s.headers.some((h) => re.test(h)));
  const initialAcc = byHeaders(GUESS.sum) || sheets[0];
  const initialAct = sheets.find((s) => s.id !== initialAcc.id && detectDateCol(s.headers, s.rows)) || sheets.find((s) => s.id !== initialAcc.id);
  const [open, setOpen] = useState(true);
  const [accId, setAccId] = useState(initialAcc.id);
  const [actId, setActId] = useState(initialAct.id);
  const acc = sheets.find((s) => s.id === accId) || sheets[0];
  const act = sheets.find((s) => s.id === actId && s.id !== acc.id) || sheets.find((s) => s.id !== acc.id);

  const colsFor = useCallback((a, b) => {
    const csmB = guessCol(b.headers, GUESS.csmFull);
    const ownerB = guessCol(b.headers, GUESS.owner);
    return {
      csm: guessCol(a.headers, GUESS.csm, a.headers[0]),
      account: guessCol(a.headers, /parent/i, guessCol(a.headers, GUESS.account, a.headers[0])),
      keyA: guessCol(a.headers, GUESS.account, a.headers[0]),
      mrr: guessCol(a.headers, GUESS.sum),
      keyB: guessCol(b.headers, GUESS.account, b.headers[0]),
      sameA: csmB && ownerB ? csmB : '',
      sameB: csmB && ownerB ? ownerB : '',
      dateCol: detectDateCol(b.headers, b.rows),
      from: '', to: '', fill: true,
    };
  }, []);
  const [c, setC] = useState(() => colsFor(acc, act));
  const set = (k) => (v) => setC({ ...c, [k]: v });
  function choose(nextAccId, nextActId) {
    const a = sheets.find((s) => s.id === nextAccId);
    const b = sheets.find((s) => s.id === nextActId && s.id !== a.id) || sheets.find((s) => s.id !== a.id);
    setAccId(a.id);
    setActId(b.id);
    setC(colsFor(a, b));
  }

  function run() {
    let rows = acc.rows;
    const steps = [];
    if (c.fill) {
      const rec = emptyStats(rows, acc.headers).filter((s) => s.recommended && [c.csm, c.account, c.keyA].includes(s.col)).map((s) => s.col);
      if (rec.length) {
        const f = fillDown(rows, rec);
        rows = f.rows;
        steps.push(`rellené ${f.changes.length} vacíos (${rec.join(', ')})`);
      }
    }
    const cross = crossSheets(rows, act.rows, { keyA: c.keyA, keyB: c.keyB, sameA: c.sameA, sameB: c.sameB, dateCol: c.dateCol, from: c.from, to: c.to, count: true, last: Boolean(c.dateCol) });
    rows = cross.rows;
    steps.push(`crucé con «${act.name}»: ${cross.matched} de ${rows.length} filas con contactos`);
    const headers = [...acc.headers, ...cross.newCols.filter((h) => !acc.headers.includes(h))];
    applyTo(acc.id, { ...acc, rows, headers }, `Asistente: ${steps.join('; ')}. Podés deshacer.`);
    onReady({ ...acc, headers }, rows, { groupBy: c.csm, countCol: c.account, contactCol: MATCH_COLS.count, threshold: 1, sumCol: c.mrr });
  }

  return (
    <Panel
      title="Asistente: contactos por cuenta"
      hint="Cruza las cuentas de cada CSM con las actividades y arma el reporte: cuántas cuentas tiene, cuántas contactó y cuáles faltan."
      actions={<Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>{open ? 'Ocultar' : 'Mostrar'}</Button>}
    >
      {open && (
        <div className="ui-stack">
          <div className="rb-grid">
            <Field label="Hoja de cuentas">
              <select value={acc.id} onChange={(e) => choose(e.target.value, act.id)}>
                {sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Hoja de actividades / emails">
              <select value={act.id} onChange={(e) => choose(acc.id, e.target.value)}>
                {sheets.filter((s) => s.id !== acc.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="rb-grid">
            <ColSelect label="CSM (agrupar por)" value={c.csm} onChange={set('csm')} cols={acc.headers} />
            <ColSelect label="Cuenta (contar)" value={c.account} onChange={set('account')} cols={acc.headers} />
            <ColSelect label="MRR (sumar)" value={c.mrr} onChange={set('mrr')} cols={acc.headers} none="— Ninguno —" />
            <ColSelect label="Cuenta para cruzar (cuentas)" value={c.keyA} onChange={set('keyA')} cols={acc.headers} />
            <ColSelect label="Cuenta para cruzar (actividades)" value={c.keyB} onChange={set('keyB')} cols={act.headers} />
            <ColSelect label="Fecha de la actividad" value={c.dateCol} onChange={set('dateCol')} cols={act.headers} none="— Sin fecha —" />
            <Field label="Contactos desde"><input type="date" value={c.from} disabled={!c.dateCol} onChange={(e) => set('from')(e.target.value)} /></Field>
            <Field label="Hasta"><input type="date" value={c.to} disabled={!c.dateCol} onChange={(e) => set('to')(e.target.value)} /></Field>
          </div>
          <div className="rb-grid">
            <ColSelect label="Contar solo si esta columna…" value={c.sameA} onChange={set('sameA')} cols={act.headers} none="— Contar todas —" />
            <ColSelect label="…es igual a esta (ej. CSM = Owner)" value={c.sameB} onChange={set('sameB')} cols={act.headers} none="— Contar todas —" />
          </div>
          <label className="rb-check">
            <input type="checkbox" checked={c.fill} onChange={(e) => set('fill')(e.target.checked)} />
            <span>Rellenar los vacíos de CSM y cuenta (reportes agrupados de Salesforce)</span>
          </label>
          <div><Button variant="primary" icon={Sparkles} onClick={run}>Armar reporte</Button></div>
        </div>
      )}
    </Panel>
  );
}

// ── Configuración del resumen ───────────────────────────────────────────────
function SummaryConfig({ sheet, initial, onGenerate, rowsCount }) {
  const [cfg, setCfg] = useState(initial);
  const set = (k) => (v) => setCfg({ ...cfg, [k]: v });
  const cols = visibleCols(sheet);
  const label = labelOf(sheet);
  return (
    <div className="rb-summary-cfg">
      <h3 className="rb-h3">3 · Reporte resumen</h3>
      <p className="ui-hint">Agrupá y contá. Ej.: por CSM, cuántas cuentas, cuántas contactadas y el %. Usa las {rowsCount} filas que se ven arriba (con los filtros de fecha y búsqueda).</p>
      <div className="rb-grid">
        <ColSelect label="Agrupar por" value={cfg.groupBy} onChange={set('groupBy')} cols={cols} labelOf={label} />
        <ColSelect label="Contar distintos de" value={cfg.countCol} onChange={set('countCol')} cols={cols} labelOf={label} />
        <ColSelect label="Columna de contactos (número)" value={cfg.contactCol} onChange={set('contactCol')} cols={cols} none="— Ninguna —" labelOf={label} />
        <Field label="Contactada desde (cantidad)"><input type="number" min="0" value={cfg.threshold} disabled={!cfg.contactCol} onChange={(e) => set('threshold')(e.target.value)} /></Field>
        <ColSelect label="Sumar (ej. MRR)" value={cfg.sumCol} onChange={set('sumCol')} cols={cols} none="— Ninguna —" labelOf={label} />
      </div>
      <div><Button variant="primary" onClick={() => onGenerate(cfg)}>Generar resumen</Button></div>
    </div>
  );
}

// ── Resultado: resumen, reporte y exportar ──────────────────────────────────
function SummaryOutput({ summary, sheet, viewRows, period, setStatus }) {
  const { result } = summary;
  const contact = Boolean(result.opts.contactCol);
  const hasSum = Boolean(result.opts.sumCol);
  const label = labelOf(sheet);
  const [visible, setVisible] = useState(result.columns);
  const [what, setWhat] = useState('summary');
  const [rep, setRep] = useState(() => ({
    title: contact ? 'Reporte de contactos por cuenta' : 'Reporte resumen',
    subtitle: '',
    period,
    groupLabel: /customer success|csm/i.test(result.opts.groupBy) ? 'CSM' : label(result.opts.groupBy),
    countLabel: /account|parent|cuenta/i.test(result.opts.countCol) ? 'Cuentas' : label(result.opts.countCol),
    sumLabel: hasSum ? (/mrr/i.test(result.opts.sumCol) ? 'MRR' : label(result.opts.sumCol)) : '',
    showDetail: true,
  }));
  const setR = (k) => (v) => setRep({ ...rep, [k]: v });
  const lastCol = sheet.headers.includes(MATCH_COLS.last) ? MATCH_COLS.last : '';
  const detail = useMemo(() => accountDetail(result, { lastCol }), [result, lastCol]);
  const t = result.totals;

  const sumCols = result.columns.filter((c) => visible.includes(c));
  const pctCol = result.cols.pct;
  const columns = sumCols.map((c, i) => ({
    key: c, label: c, num: i > 0,
    render: (r) => (c === pctCol && contact ? <Badge tone={pctTone(parseFloat(r[c]))}>{r[c]}</Badge> : r[c]),
  }));
  const rows = result.table.map((r, i) => ({ ...r, key: i, className: i === result.table.length - 1 ? 'is-total' : '' }));

  function exportData() {
    const vis = visibleCols(sheet);
    const src = viewRows || sheet.rows;
    const out = { data: null, summary: null, dataHeaders: [], sumHeaders: [] };
    if (what === 'data' || what === 'both') {
      out.dataHeaders = vis.map(label);
      out.data = src.map((r) => Object.fromEntries(vis.map((h) => [label(h), r[h] ?? ''])));
    }
    if (what === 'summary' || what === 'both') {
      out.sumHeaders = sumCols;
      out.summary = result.table.map((r) => Object.fromEntries(sumCols.map((c) => [c, r[c]])));
    }
    return out;
  }
  const base = `reporte-${fileSafe(sheet.name)}`;

  async function doExport(fmt) {
    const exp = exportData();
    try {
      if (fmt === 'xlsx') {
        const mod = await import('exceljs/dist/exceljs.min.js');
        const ExcelJS = mod?.Workbook ? mod : mod.default;
        const buf = await buildXlsx(ExcelJS, exp);
        downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`);
      } else if (fmt === 'csv') {
        downloadBlob(new Blob(['\uFEFF', buildCsv(exp)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`);
      } else if (fmt === 'json') {
        downloadBlob(new Blob([buildJson(exp)], { type: 'application/json;charset=utf-8' }), `${base}.json`);
      } else if (fmt === 'copy') {
        await navigator.clipboard.writeText(buildTsv(exp));
        setStatus({ tone: 'success', text: 'Copiado. Pegalo en Excel o Sheets con Ctrl+V.' });
        return;
      }
      setStatus({ tone: 'success', text: `Exportado: ${fmt.toUpperCase()}.` });
    } catch (e) { setStatus({ tone: 'error', text: `No se pudo exportar: ${e.message}` }); }
  }

  const reportHtml = () => buildReportHtml(result, detail, { ...rep, source: sheet.name, fecha: today() });
  function openReport(mode) {
    const html = reportHtml();
    if (mode === 'download') {
      downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${base}.html`);
      return;
    }
    const w = window.open('', '_blank');
    if (!w) { setStatus({ tone: 'error', text: 'El navegador bloqueó la pestaña nueva. Usá «Descargar HTML».' }); return; }
    w.document.write(html);
    w.document.close();
    if (mode === 'pdf') setTimeout(() => { try { w.focus(); w.print(); } catch { /* ya impreso */ } }, 400);
  }

  return (
    <div id="rb-summary">
      <Panel title="Reporte" hint={`Hoja «${sheet.name}» · agrupado por ${label(result.opts.groupBy)} · contando ${label(result.opts.countCol)}`}>
        <Stats items={[
          { label: label(result.opts.countCol), value: t.total },
          ...(contact ? [
            { label: 'contactadas', value: t.contacted, tone: 'good' },
            { label: 'sin contactar', value: t.pending, tone: t.pending ? 'bad' : 'good' },
            { label: 'cobertura', value: `${t.pct}%`, tone: pctTone(t.pct) },
          ] : []),
          ...(hasSum ? [{ label: `suma ${label(result.opts.sumCol)}`, value: t.sum.toLocaleString('es-AR') }] : []),
          { label: 'grupos', value: result.groups.length },
        ]} />

        {contact && (
          <div className="rb-bars" aria-label="Cobertura por grupo">
            {[...result.groups].sort((a, b) => b.pct - a.pct).map((g) => (
              <div key={g.key} className="rb-bar-row">
                <span className="rb-bar-name" title={g.key}>{g.key}</span>
                <span className="rb-bar"><span className={`rb-bar-fill rb-${pctTone(g.pct)}`} style={{ width: `${Math.min(100, g.pct)}%` }} /></span>
                <span className="rb-bar-val">{g.pct}% <small>({g.contacted}/{g.total})</small></span>
              </div>
            ))}
          </div>
        )}

        <DataTable columns={columns} rows={rows} maxHeight={420} />
        <details className="rb-details">
          <summary>Columnas del resumen</summary>
          <div className="ui-row">
            {result.columns.map((c) => (
              <label key={c} className="rb-check">
                <input type="checkbox" checked={visible.includes(c)} disabled={visible.length === 1 && visible.includes(c)} onChange={(e) => setVisible(e.target.checked ? result.columns.filter((x) => x === c || visible.includes(x)) : visible.filter((x) => x !== c))} />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </details>
      </Panel>

      <Panel title="Reporte para compartir" hint="Sale con la marca Namirial: cifras, cobertura por grupo, tabla resumen y el detalle de cada uno (primero las cuentas sin contactar, de mayor a menor MRR). El PDF se guarda desde el diálogo de impresión.">
        <div className="rb-grid">
          <Field label="Título"><input value={rep.title} onChange={(e) => setR('title')(e.target.value)} /></Field>
          <Field label="Subtítulo (opcional)"><input value={rep.subtitle} placeholder="Ej.: Equipo de Customer Success · Q4" onChange={(e) => setR('subtitle')(e.target.value)} /></Field>
          <Field label="Período (opcional)"><input value={rep.period} placeholder="Ej.: Noviembre 2026" onChange={(e) => setR('period')(e.target.value)} /></Field>
          <Field label="Cómo llamar a los grupos"><input value={rep.groupLabel} onChange={(e) => setR('groupLabel')(e.target.value)} /></Field>
          <Field label="Cómo llamar a lo contado"><input value={rep.countLabel} onChange={(e) => setR('countLabel')(e.target.value)} /></Field>
          {hasSum && <Field label="Cómo llamar a la suma"><input value={rep.sumLabel} onChange={(e) => setR('sumLabel')(e.target.value)} /></Field>}
        </div>
        <label className="rb-check">
          <input type="checkbox" checked={rep.showDetail} onChange={(e) => setR('showDetail')(e.target.checked)} />
          <span>Incluir el detalle por {rep.groupLabel || 'grupo'} (una tabla con sus cuentas)</span>
        </label>
        <div className="ui-row">
          <Button variant="primary" icon={Eye} onClick={() => openReport('view')}>Ver reporte</Button>
          <Button icon={Printer} onClick={() => openReport('pdf')}>Exportar PDF</Button>
          <Button icon={Download} onClick={() => openReport('download')}>Descargar HTML</Button>
        </div>
      </Panel>

      <Panel title="Exportar los datos">
        <div className="ui-row">
          <span className="ui-field-label">Qué exportar:</span>
          <Tabs value={what} onChange={setWhat} options={[
            { value: 'summary', label: 'Solo el resumen' },
            { value: 'data', label: `Los datos (${(viewRows || sheet.rows).length} filas)` },
            { value: 'both', label: 'Datos + resumen' },
          ]} />
        </div>
        <div className="ui-row">
          <Button variant="primary" icon={FileSpreadsheet} onClick={() => doExport('xlsx')}>Excel con formato</Button>
          <Button icon={Download} onClick={() => doExport('csv')}>CSV</Button>
          <Button icon={Download} onClick={() => doExport('json')}>JSON</Button>
          <Button icon={ClipboardCopy} onClick={() => doExport('copy')}>Copiar para pegar en Excel</Button>
        </div>
      </Panel>
    </div>
  );
}
