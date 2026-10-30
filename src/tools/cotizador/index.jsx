// Cotizador — integrado desde FormConverterExcel (modo «Cotizador»).
// La lógica es la misma (src/lib/quoter); acá solo cambia la interfaz.
import { useState } from 'react';
import { Calculator, Download, Eye, FileText, Printer } from 'lucide-react';
import { analyzeZip, calibrateThresholds, DEFAULT_CONFIG, scoreProject } from '../../lib/quoter/index.js';
import { buildCommercialReport } from '../../lib/quoter/report.js';
import { buildDocxReport } from '../../lib/quoter/docx.js';
import { baseName, downloadBlob, jsonBlob, readBytes } from '../../lib/files';
import { Alert, Badge, Button, DataTable, Field, FileDrop, Panel, Stats } from '../../components/ui';
import './cotizador.css';

const CFG_KEY = 'formtools.quoter.config'; // misma clave que la versión anterior: se conservan los umbrales calibrados

function mergedConfig(cfg) {
  return {
    weights: { ...DEFAULT_CONFIG.weights, ...(cfg?.weights || {}) },
    thresholds: { ...DEFAULT_CONFIG.thresholds, ...(cfg?.thresholds || {}) },
    hoursPerPoint: cfg?.hoursPerPoint || DEFAULT_CONFIG.hoursPerPoint,
    // != null: 0 es un valor válido (lo repetido no cuesta nada).
    reuseFactor: cfg?.reuseFactor != null ? cfg.reuseFactor : DEFAULT_CONFIG.reuseFactor,
  };
}

function loadConfig() {
  const cfg = { baja: 900, media: 1800, hoursPerPoint: 0.035, reuseFactor: 0.15 };
  try {
    const saved = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (saved?.thresholds) {
      // Se acepta el nombrado viejo (facil/medio) de configs guardadas.
      cfg.baja = saved.thresholds.baja ?? saved.thresholds.facil ?? cfg.baja;
      cfg.media = saved.thresholds.media ?? saved.thresholds.medio ?? cfg.media;
    }
    if (saved?.hoursPerPoint) cfg.hoursPerPoint = saved.hoursPerPoint;
    if (saved?.reuseFactor != null) cfg.reuseFactor = saved.reuseFactor;
  } catch { /* config inválida o sin guardado local: valores por defecto */ }
  return cfg;
}

const toQuoteConfig = (c) => ({
  thresholds: { baja: Number(c.baja) || 900, media: Number(c.media) || 1800 },
  hoursPerPoint: Number(c.hoursPerPoint) || 0.035,
  reuseFactor: Number.isNaN(Number(c.reuseFactor)) ? 0.15 : Number(c.reuseFactor),
});

function saveConfig(qc) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(qc)); } catch { /* sin guardado local */ }
}

const LEVEL_TONE = { baja: 'good', media: 'warn', alta: 'bad' };
const weeksLabel = (w) => (w === 1 ? '1 semana' : `${w} semanas`);
const today = () => new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

export default function Cotizador() {
  const [zip, setZip] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null); // { tone, text }
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState(loadConfig);
  const [target, setTarget] = useState('Media');

  const name = baseName(zip, 'formulario');

  async function run() {
    setBusy(true);
    setStatus({ tone: 'info', text: 'Abriendo el ZIP y analizando su contenido…' });
    try {
      const t0 = performance.now();
      const res = await analyzeZip(await readBytes(zip), toQuoteConfig(cfg));
      setResult(res);
      setStatus({
        tone: res.errors.length ? 'warning' : 'success',
        text: `${res.totals.files} archivos analizados en ${Math.round(performance.now() - t0)} ms${res.errors.length ? ` · ${res.errors.length} con error` : ''}.`,
      });
    } catch (e) {
      setStatus({ tone: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  function requote() {
    const qc = toQuoteConfig(cfg);
    saveConfig(qc);
    setResult((r) => ({ ...r, score: scoreProject(r.totals, mergedConfig(qc)) }));
    setStatus({ tone: 'success', text: 'Recalculado con los umbrales nuevos (guardados).' });
  }

  // Calibra los umbrales con un caso real ("este es Medio") y los deja guardados.
  function calibrate() {
    const base = mergedConfig(toQuoteConfig(cfg));
    const current = scoreProject(result.totals, base);
    base.thresholds = calibrateThresholds(current.points, target, base.thresholds);
    const score = scoreProject(result.totals, base);
    const next = { ...cfg, baja: base.thresholds.baja, media: base.thresholds.media };
    setCfg(next);
    saveConfig(toQuoteConfig(next));
    setResult((r) => ({ ...r, score }));
    setStatus({ tone: 'success', text: `Calibrado con este caso: Baja ≤ ${base.thresholds.baja}, Media ≤ ${base.thresholds.media} (guardado).` });
  }

  // Reporte de una página para comercial: sin puntajes ni pesos.
  function commercialReport(mode) {
    const html = buildCommercialReport(result, { archivo: zip?.name ?? null, fecha: today() });
    if (mode === 'download') {
      downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${name}_estimacion.html`);
      return;
    }
    const w = window.open('', '_blank');
    if (!w) {
      setStatus({ tone: 'error', text: 'El navegador bloqueó la pestaña nueva. Usá «Descargar HTML».' });
      return;
    }
    w.document.write(html);
    w.document.close();
    if (mode === 'pdf') {
      // Diálogo de impresión del navegador: «Guardar como PDF».
      setTimeout(() => { try { w.focus(); w.print(); } catch { /* ya impreso */ } }, 400);
    }
  }

  async function exportDocx() {
    setStatus({ tone: 'info', text: 'Generando el documento de Word…' });
    try {
      const bytes = await buildDocxReport(result, { archivo: zip?.name ?? null, fecha: today() });
      downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `${name}_estimacion.docx`);
      setStatus({ tone: 'success', text: 'Word descargado.' });
    } catch (e) {
      setStatus({ tone: 'error', text: e.message });
    }
  }

  function downloadTechnical() {
    const r = result;
    downloadBlob(jsonBlob({
      archivo: zip?.name ?? null,
      veredicto: { complejidad: r.score.level, puntos: r.score.points, horasEstimadas: r.score.estimatedHours, umbrales: r.score.thresholds },
      reutilizacion: {
        porcentajeYaResuelto: r.reuse.percent,
        camposRepetidos: r.score.repeatedFields,
        reglasRepetidas: r.score.repeatedRules,
        puntosAhorrados: r.score.savedPoints,
        costoDeLoRepetido: r.score.reuseFactor,
        gruposRepetidosInternos: r.reuse.pdf.internalSaved,
        comparaciones: [...(r.reuse.pdf.pairs || []), ...(r.reuse.excel.pairs || [])],
      },
      totales: r.totals,
      clasificacionPorArchivo: r.byFile,
      desglosePuntos: r.score.breakdown,
      inventario: r.inventory,
      pdfs: r.pdfs,
      excels: r.excels,
      jsons: r.jsons,
      errores: r.errors,
    }), `${name}_cotizacion.json`);
  }

  return (
    <div className="ui-stack">
      <Panel title="1. Cargar el ZIP" hint="El ZIP puede traer PDFs, Excels de reglas de negocio (con todas sus pestañas) y JSONs de definición. Se analiza todo, sin importar las carpetas.">
        <div className="ui-files">
          <FileDrop label="ZIP del formulario" description="PDFs + Excels + JSONs" accept=".zip" file={zip} onFile={(f) => { setZip(f); setResult(null); setStatus(null); }} required />
        </div>
        <div className="ui-row">
          <Button variant="primary" icon={Calculator} onClick={run} disabled={!zip || busy}>{busy ? 'Analizando…' : 'Analizar y cotizar'}</Button>
          {result && (
            <>
              <Button icon={Eye} onClick={() => commercialReport('view')}>Ver reporte</Button>
              <Button icon={Printer} onClick={() => commercialReport('pdf')}>Exportar PDF</Button>
              <Button icon={FileText} onClick={exportDocx}>Exportar Word</Button>
              <Button size="sm" variant="ghost" icon={Download} onClick={() => commercialReport('download')}>Descargar HTML</Button>
              <Button size="sm" variant="ghost" icon={Download} onClick={downloadTechnical}>Informe técnico (JSON)</Button>
            </>
          )}
        </div>
        {status && <Alert tone={status.tone}>{status.text}</Alert>}
      </Panel>

      {result && <Results result={result} cfg={cfg} setCfg={setCfg} target={target} setTarget={setTarget} onRequote={requote} onCalibrate={calibrate} />}
    </div>
  );
}

function Results({ result: res, cfg, setCfg, target, setTarget, onRequote, onCalibrate }) {
  const { score, totals: t } = res;
  const docs = res.documents || [];
  const byFile = res.byFile || [];
  const reusePairs = [...(res.reuse.pdf.pairs || []), ...(res.reuse.excel.pairs || [])];
  const hasReuse = reusePairs.length > 0 || res.reuse.pdf.internalSaved > 0;

  const pdfRows = res.pdfs.map((p) => {
    let text = 0; let check = 0; let other = 0;
    Object.entries(p.byType).forEach(([k, n]) => {
      if (/text/i.test(k)) text += n;
      else if (/check|radio|button/i.test(k)) check += n;
      else other += n;
    });
    return { key: p.file, file: p.file, pages: p.pages, fields: p.fieldCount, text, check, other, groups: p.repeaterGroups || 0 };
  });
  if (pdfRows.length > 1) {
    const sum = (k) => pdfRows.reduce((a, r) => a + r[k], 0);
    pdfRows.push({ key: '__total', className: 'is-total', file: `TOTAL (${pdfRows.length} PDFs)`, pages: sum('pages'), fields: sum('fields'), text: sum('text'), check: sum('check'), other: sum('other'), groups: sum('groups') });
  }

  const sheetRows = [];
  res.excels.forEach((x) => {
    sheetRows.push({ key: x.file, className: 'is-sub', name: <strong>{x.file} <span className="cz-dim">({x.sheetCount} pestañas)</span></strong>, rows: '', fields: x.fieldRows || 0, rules: <strong>{x.businessRules || 0}</strong>, cond: x.conditionalRules || 0, cats: (x.catalogs || 0) + (x.catalogRefs || 0), type: '' });
    x.sheets.forEach((s) => sheetRows.push({
      key: `${x.file}/${s.name}`,
      name: <span className="cz-indent">{s.name}</span>,
      rows: s.rows || 0, fields: s.fieldRows || 0, rules: s.businessRules || 0, cond: s.conditionalRules || 0, cats: s.catalogRefs || 0,
      type: s.ignored ? <span className="cz-dim">ignorada (output/índice)</span>
        : s.isCatalog ? <Badge tone="warn">catálogo {s.catalogItems}</Badge>
        : s.empty ? <span className="cz-dim">vacía</span> : 'reglas',
    }));
  });

  return (
    <>
      <Panel>
        <div className="cz-verdict">
          <div className={`cz-level cz-level-${score.levelKey}`}>{score.level}</div>
          <div>
            <div className="cz-points"><strong>{score.points}</strong> puntos de complejidad</div>
            <div className="ui-hint">Plazo estimado: {weeksLabel(score.weeks)} · Baja ≤ {score.thresholds.baja} · Media ≤ {score.thresholds.media}</div>
          </div>
        </div>
        <Stats items={[
          { label: 'Campos del PDF', value: t.pdfFields },
          { label: 'Reglas de negocio', value: t.businessRules },
          { label: 'Condicionales', value: t.conditionalRules },
          { label: 'Bloques repetidos', value: t.repeaters },
          { label: 'Catálogos', value: t.catalogs },
          { label: 'Páginas', value: t.pages },
          { label: 'Reutilización', value: `${t.reuse ? t.reuse.percent : 0}%` },
          { label: 'Pestañas Excel', value: t.excelSheets },
        ]} />
        <h3 className="cz-h3">De dónde salen los puntos</h3>
        <DataTable
          rows={score.breakdown.map((b) => ({ ...b, key: b.label, className: b.count ? '' : 'is-muted' }))}
          columns={[
            { key: 'label', label: 'Concepto' },
            { key: 'count', label: 'Cantidad', num: true },
            { key: 'weight', label: 'Peso', num: true, render: (b) => `×${b.weight}` },
            { key: 'points', label: 'Puntos', num: true, render: (b) => <strong>{b.points}</strong> },
          ]}
        />
        <div className="cz-config">
          <Field label="Baja hasta" inline><input type="number" min="1" step="50" value={cfg.baja} onChange={(e) => setCfg({ ...cfg, baja: e.target.value })} /></Field>
          <Field label="Media hasta" inline><input type="number" min="1" step="50" value={cfg.media} onChange={(e) => setCfg({ ...cfg, media: e.target.value })} /></Field>
          <Field label="Costo de lo repetido" inline><input type="number" min="0" max="1" step="0.05" value={cfg.reuseFactor} onChange={(e) => setCfg({ ...cfg, reuseFactor: e.target.value })} /></Field>
          <Button size="sm" onClick={onRequote}>Recalcular</Button>
        </div>
        <div className="cz-config cz-calibrate">
          <span className="ui-hint">¿No coincide con tu criterio? La complejidad real es:</span>
          <select className="ui-input" aria-label="Complejidad real" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option>Baja</option><option>Media</option><option>Alta</option>
          </select>
          <Button size="sm" onClick={onCalibrate}>Calibrar umbrales</Button>
        </div>
      </Panel>

      {hasReuse && (
        <Panel title="Reutilización: lo que no se paga dos veces" hint="Campos y reglas que ya están resueltos: repetidos dentro del formulario (bloques [n]) o compartidos con otra variante del ZIP (por ejemplo, el abreviado contra el completo).">
          <Stats items={[
            { label: '% ya resuelto', value: `${res.reuse.percent}%`, tone: 'good' },
            { label: 'Campos repetidos', value: score.repeatedFields },
            { label: 'Reglas repetidas', value: score.repeatedRules },
            { label: 'Puntos ahorrados', value: score.savedPoints },
            { label: 'Grupos [n] (interno)', value: res.reuse.pdf.internalSaved },
            { label: 'Campos nuevos', value: res.reuse.pdf.unique },
          ]} />
          <DataTable
            maxHeight={280}
            empty="Un solo formulario: el ahorro viene de los bloques repetidos internos."
            rows={reusePairs.map((p, i) => ({ ...p, key: i }))}
            columns={[
              { key: 'file', label: 'Archivo' },
              { key: 'against', label: 'Comparado con', render: (p) => <span className="cz-dim">{p.against}</span> },
              { key: 'shared', label: 'Compartido', num: true, render: (p) => <strong className="cz-good">{p.shared}</strong> },
              { key: 'own', label: 'Propio', num: true },
              { key: 'percentShared', label: '% ya resuelto', num: true, render: (p) => `${p.percentShared}%` },
            ]}
          />
        </Panel>
      )}

      {docs.length > 0 && (
        <Panel title="Complejidad por formulario" hint="Cada PDF con las reglas de negocio que le corresponden: el PDF solo no alcanza, las reglas viven en el Excel. Si hay una ficha por formulario se empareja por nombre; si es una sola para todos, se reparte según el tamaño de cada uno.">
          <DataTable
            maxHeight={320}
            rows={docs.map((d) => ({ ...d, key: d.file }))}
            columns={[
              { key: 'file', label: 'Formulario' },
              { key: 'fields', label: 'Espacios', num: true },
              { key: 'pages', label: 'Págs', num: true },
              { key: 'businessRules', label: 'Reglas', num: true },
              { key: 'points', label: 'Puntos', num: true, render: (d) => <span className="cz-dim">{d.points}</span> },
              { key: 'level', label: 'Complejidad', render: (d) => <Badge tone={LEVEL_TONE[d.levelKey]}>{d.level}</Badge> },
              { key: 'weeks', label: 'Plazo', num: true, render: (d) => <strong>{weeksLabel(d.weeks)}</strong> },
            ]}
          />
          {docs.length > 1 && (
            <Alert tone="warning">
              Por separado suman {docs.reduce((a, d) => a + d.weeks, 0)} semanas. Como entrega única el conjunto se cotiza {score.level} ({weeksLabel(score.weeks)}).
            </Alert>
          )}
        </Panel>
      )}

      {byFile.length > 0 && (
        <Panel title="Clasificación por archivo" hint="Cuánto aporta cada archivo al total y qué complejidad tiene por sí solo. Sirve para ver de dónde viene el peso del proyecto.">
          <DataTable
            maxHeight={360}
            rows={byFile.map((f) => ({ ...f, key: f.file }))}
            columns={[
              { key: 'file', label: 'Archivo', render: (f) => <><Badge>{f.kind}</Badge> {f.file}</> },
              { key: 'role', label: 'Rol', render: (f) => <span className="cz-dim">{f.role}</span> },
              { key: 'detail', label: 'Contenido', render: (f) => <span className="cz-dim cz-small">{f.detail}</span> },
              { key: 'points', label: 'Aporte', num: true, render: (f) => <strong>{f.points}</strong> },
              { key: 'share', label: '% del total', num: true, render: (f) => (
                <>
                  {f.share}%
                  {f.share ? <div className="cz-bar" style={{ width: `${Math.max(4, Math.min(100, f.share))}%` }} /> : null}
                </>
              ) },
              { key: 'level', label: 'Complejidad', render: (f) => (f.levelKey === 'info' ? <span className="cz-dim">—</span> : <Badge tone={LEVEL_TONE[f.levelKey]}>{f.level}</Badge>) },
            ]}
          />
        </Panel>
      )}

      {res.pdfs.length > 0 && (
        <Panel title="Espacios por PDF" hint="Cada PDF del ZIP con la cantidad de espacios a llenar (campos AcroForm), abiertos por tipo.">
          <DataTable
            maxHeight={340}
            rows={pdfRows}
            columns={[
              { key: 'file', label: 'PDF' },
              { key: 'pages', label: 'Págs', num: true },
              { key: 'fields', label: 'Espacios', num: true, render: (r) => <strong className="cz-accent">{r.fields}</strong> },
              { key: 'text', label: 'Texto', num: true },
              { key: 'check', label: 'Casillas', num: true },
              { key: 'other', label: 'Otros', num: true },
              { key: 'groups', label: 'Grupos [n]', num: true },
            ]}
          />
        </Panel>
      )}

      {res.excels.length > 0 && (
        <Panel title="Reglas de negocio por matriz" hint="Cada Excel con sus pestañas. Las hojas de catálogo y las de output/índice se listan pero no cuentan como reglas.">
          <DataTable
            maxHeight={420}
            rows={sheetRows}
            columns={[
              { key: 'name', label: 'Excel / Pestaña' },
              { key: 'rows', label: 'Filas', num: true },
              { key: 'fields', label: 'Campos', num: true },
              { key: 'rules', label: 'Reglas', num: true },
              { key: 'cond', label: 'Condicionales', num: true },
              { key: 'cats', label: 'Catálogos', num: true },
              { key: 'type', label: 'Tipo' },
            ]}
          />
        </Panel>
      )}

      <Panel title="Contenido del ZIP">
        <DataTable
          maxHeight={300}
          rows={res.inventory.map((f) => ({ ...f, key: f.path }))}
          columns={[
            { key: 'path', label: 'Archivo' },
            { key: 'kind', label: 'Tipo', render: (f) => <Badge>{f.kind}</Badge> },
            { key: 'sizeLabel', label: 'Tamaño', num: true, render: (f) => <span className="cz-dim">{f.sizeLabel || ''}</span> },
            { key: 'detail', label: 'Detalle', render: (f) => f.detail || f.error || '' },
          ]}
        />
        <h3 className="cz-h3">JSONs</h3>
        <DataTable
          maxHeight={240}
          empty="Sin JSONs en el ZIP."
          rows={res.jsons.map((j) => ({ ...j, key: j.file }))}
          columns={[
            { key: 'file', label: 'Archivo' },
            { key: 'kind', label: 'Tipo', render: () => <Badge tone="primary">JSON</Badge> },
            { key: 'detail', label: 'Detalle', render: (j) => (j.kind === 'form-def'
              ? `${j.fields} campos · ${j.sections} secciones · ${j.repeaters} repeaters · ${j.lookups} lookups · ${j.conditionals} condicionales`
              : `JSON de datos · ${j.topLevelKeys || 0} claves`) },
          ]}
        />
      </Panel>
    </>
  );
}
