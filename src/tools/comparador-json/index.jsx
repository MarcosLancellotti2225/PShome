// Comparador JSON — integrado desde FormConverterExcel (modo «Mapa JSON»).
// La lógica es la misma (src/lib/json-mapper); acá solo cambia la interfaz.
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { analyzeFormDef, compareWithSample } from '../../lib/json-mapper/index.js';
import { baseName, downloadBlob, jsonBlob, readJson } from '../../lib/files';
import { Alert, Badge, Button, DataTable, Field, FileDrop, Panel, Stats, Tabs } from '../../components/ui';
import './comparador.css';

const SEV_TONE = { critical: 'bad', error: 'bad', warning: 'warn' };
const CMP_LABEL = { ok: 'coincide', falta: 'falta', forma: 'forma distinta', sobra: 'sobra' };
const CMP_TONE = { ok: 'good', falta: 'bad', forma: 'bad', sobra: 'warn' };
const CMP_FILTERS = [
  ['problem', 'Solo los problemas'],
  ['falta', 'Faltan (el cliente los espera)'],
  ['forma', 'Forma distinta'],
  ['sobra', 'Sobran (no están en el ejemplo)'],
  ['ok', 'Coinciden'],
  ['all', 'Todo'],
];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Colorea el JSON dibujado: claves y placeholders <tipo>. El texto se escapa antes.
function highlightJson(text) {
  return escapeHtml(text)
    .replace(/&quot;(&lt;[^&]*?&gt;)&quot;/g, '"<span class="cj-ph">$1</span>"')
    .replace(/^(\s*)&quot;([^&]+?)&quot;:/gm, '$1"<span class="cj-key">$2</span>":');
}

const more = (list, n) => (list.length > n ? ` +${list.length - n}` : '');

export default function ComparadorJson() {
  const [formDefFile, setFormDefFile] = useState(null);
  const [sampleFile, setSampleFile] = useState(null);
  const [formDefJson, setFormDefJson] = useState(null);
  const [sampleJson, setSampleJson] = useState(null);
  const [direction, setDirection] = useState('output');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('output');
  const [cmpFilter, setCmpFilter] = useState('problem');
  const [pathFilter, setPathFilter] = useState('');

  // Lee el archivo elegido; el análisis y la comparación se recalculan solos.
  async function pickFile(file, setFile, setJson, what) {
    setFile(file);
    setJson(null);
    setError('');
    if (!file) return;
    try {
      setJson(await readJson(file, what));
    } catch (e) {
      setError(e.message);
    }
  }

  const { analysis, analysisError } = useMemo(() => {
    if (!formDefJson) return { analysis: null };
    try { return { analysis: analyzeFormDef(formDefJson) }; } catch (e) { return { analysis: null, analysisError: e.message }; }
  }, [formDefJson]);

  const comparison = useMemo(() => {
    if (!analysis || !sampleJson) return null;
    try { return compareWithSample(analysis, sampleJson, direction); } catch { return null; }
  }, [analysis, sampleJson, direction]);

  const shownError = error || analysisError;

  const base = baseName(formDefFile, 'formdef');

  const cmpRows = useMemo(() => {
    if (!comparison) return [];
    return comparison.rows.filter((r) => cmpFilter === 'all' || (cmpFilter === 'problem' ? r.status !== 'ok' : r.status === cmpFilter));
  }, [comparison, cmpFilter]);

  const pathRows = useMemo(() => {
    if (!analysis) return [];
    const q = pathFilter.toLowerCase().trim();
    const rows = [
      ...analysis.output.paths.map((p) => ({ dir: 'out', p })),
      ...analysis.input.paths.map((p) => ({ dir: 'in', p })),
    ];
    if (!q) return rows;
    return rows.filter((r) => r.p.path.toLowerCase().includes(q)
      || r.p.fields.some((f) => String(f.id || '').toLowerCase().includes(q) || String(f.label || '').toLowerCase().includes(q)));
  }, [analysis, pathFilter]);

  const tree = analysis ? (tab === 'output' ? analysis.output.tree : analysis.input.tree) : null;
  const treeHtml = useMemo(() => (tree ? highlightJson(JSON.stringify(tree, null, 2)) : ''), [tree]);

  function downloadComparison() {
    downloadBlob(jsonBlob({
      formDefinition: formDefFile?.name ?? null,
      ejemploCliente: sampleFile?.name ?? null,
      comparadoContra: comparison.direction,
      cobertura: comparison.coverage,
      resumen: comparison.counts,
      filas: comparison.rows,
    }), `${base}_comparacion.json`);
  }

  function downloadReport() {
    const r = analysis;
    downloadBlob(jsonBlob({
      archivo: formDefFile?.name ?? null,
      meta: r.meta,
      estadisticas: r.stats,
      jsonDeSalida: r.output.tree,
      jsonDeEntrada: r.input.tree,
      rutasDeSalida: r.output.paths.map((p) => ({ ruta: p.path, campos: p.fields.map((f) => f.id), valores: p.values })),
      rutasDeEntrada: r.input.paths.map((p) => ({ ruta: p.path, campos: p.fields.map((f) => f.id), condiciones: p.conditions })),
      repeaters: r.repeaters,
      problemas: r.issues,
    }), `${base}_mapa.json`);
  }

  return (
    <div className="ui-stack">
      <Panel title="1. Archivos" hint="El form-definition se recorre entero (secciones, subsecciones y repeaters) para reconstruir el JSON que envía y el que consume. Con el JSON real del cliente, además, se comparan.">
        <div className="ui-files">
          <FileDrop label="Form-definition" description="JSON del formulario (salidaJSON · prefillKey · repeaterConfig)" accept=".json" file={formDefFile} onFile={(f) => pickFile(f, setFormDefFile, setFormDefJson, 'El form-definition')} required />
          <FileDrop label="JSON del cliente (opcional)" description="El JSON real, para comparar y ver los errores" accept=".json" file={sampleFile} onFile={(f) => pickFile(f, setSampleFile, setSampleJson, 'El JSON del cliente')} />
        </div>
        {sampleFile && (
          <Field label="Comparar el JSON del cliente contra" inline>
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="output">El JSON de salida</option>
              <option value="input">El JSON de entrada (prefill)</option>
            </select>
          </Field>
        )}
        {shownError && <Alert tone="error">{shownError}</Alert>}
        {analysis && !shownError && (
          <Alert tone={analysis.stats.critical ? 'warning' : 'success'}>
            {analysis.meta.fields} campos · {analysis.stats.outputPaths} rutas de salida · {analysis.stats.inputPaths} de entrada
            {analysis.stats.critical ? ` · ${analysis.stats.critical} problema(s) crítico(s)` : ''}
          </Alert>
        )}
      </Panel>

      {comparison && (
        <Panel
          title="Comparación con el JSON del cliente"
          actions={(
            <>
              <select className="ui-input" aria-label="Qué mostrar" value={cmpFilter} onChange={(e) => setCmpFilter(e.target.value)}>
                {CMP_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Button size="sm" icon={Download} onClick={downloadComparison}>Descargar comparación</Button>
            </>
          )}
        >
          <Stats items={[
            { label: 'Cobertura', value: `${comparison.coverage}%`, tone: comparison.coverage >= 90 ? 'good' : comparison.coverage >= 60 ? 'warn' : 'bad' },
            { label: 'Coinciden', value: comparison.counts.ok },
            { label: 'Faltan', value: comparison.counts.falta, tone: comparison.counts.falta ? 'bad' : undefined },
            { label: 'Forma distinta', value: comparison.counts.forma, tone: comparison.counts.forma ? 'bad' : undefined },
            { label: 'Sobran', value: comparison.counts.sobra, tone: comparison.counts.sobra ? 'warn' : undefined },
            { label: 'Rutas del cliente', value: comparison.clientPaths },
          ]} />
          <DataTable
            maxHeight={460}
            empty="Nada en esta categoría."
            rows={cmpRows.slice(0, 500)}
            columns={[
              { key: 'status', label: 'Estado', render: (r) => <Badge tone={CMP_TONE[r.status]}>{CMP_LABEL[r.status]}</Badge> },
              { key: 'path', label: 'Ruta del cliente', render: (r) => (
                <div className="ui-mono">
                  {r.path}
                  {r.sample !== null && r.sample !== undefined && <div className="cj-sub">ej: {JSON.stringify(r.sample).slice(0, 60)}</div>}
                </div>
              ) },
              { key: 'detail', label: 'Qué pasa', render: (r) => (
                <>
                  {r.detail}
                  {r.suggestion && <div className="cj-suggest ui-mono">→ el formulario la escribe en: {r.suggestion}</div>}
                </>
              ) },
            ]}
          />
        </Panel>
      )}

      {analysis && (
        <>
          <Panel title="Resumen del form-definition">
            <Stats items={[
              { label: 'Campos', value: analysis.meta.fields },
              { label: 'Secciones', value: analysis.meta.sections },
              { label: 'Rutas de salida', value: analysis.stats.outputPaths },
              { label: 'Rutas de entrada', value: analysis.stats.inputPaths },
              { label: 'Repeaters', value: analysis.stats.repeaters },
              { label: 'Excluidos del JSON', value: analysis.stats.excluded },
              { label: 'Sin ruta', value: analysis.stats.withoutOutput },
              { label: 'Críticos', value: analysis.stats.critical, tone: analysis.stats.critical ? 'bad' : 'good' },
              { label: 'Reglas de plataforma', value: analysis.stats.reglasPlataforma || 0 },
            ]} />
          </Panel>

          <Panel
            actions={(
              <>
                <Button size="sm" icon={Download} onClick={() => downloadBlob(jsonBlob(tree), `${base}${tab === 'output' ? '_salida' : '_entrada'}.json`)}>Descargar el que estoy viendo</Button>
                <Button size="sm" icon={Download} onClick={downloadReport}>Descargar informe completo</Button>
              </>
            )}
            title={<Tabs value={tab} onChange={setTab} options={[{ value: 'output', label: 'JSON de salida' }, { value: 'input', label: 'JSON de entrada (prefill)' }]} />}
          >
            <p className="ui-hint">
              {tab === 'output'
                ? `Lo que el formulario envía al completarse: ${analysis.stats.outputPaths} rutas. Cada hoja muestra el tipo del campo o los valores posibles.`
                : `Lo que el formulario usa para prellenarse: ${analysis.stats.inputPaths} rutas (prefillKey + prefillMappings).`}
            </p>
            <pre className="cj-code" dangerouslySetInnerHTML={{ __html: treeHtml }} />
          </Panel>

          {analysis.issues.length > 0 && (
            <Panel title="Problemas del contrato" hint="Rutas que se pisan entre sí o campos que no llegan al JSON.">
              <DataTable
                maxHeight={320}
                rows={analysis.issues}
                columns={[
                  { key: 'severity', label: 'Severidad', render: (i) => <Badge tone={SEV_TONE[i.severity] || 'neutral'}>{i.severity}</Badge> },
                  { key: 'path', label: 'Ruta', render: (i) => (
                    <span className="ui-mono">
                      {/^R\d+$/.test(i.type) && <Badge tone="primary">{i.type}</Badge>} {i.path || '—'}
                      {i.ref && <span className="cj-sub"> {i.ref}</span>}
                    </span>
                  ) },
                  { key: 'detail', label: 'Detalle' },
                  { key: 'fields', label: 'Campos', render: (i) => <span className="ui-mono cj-sub">{(i.fields || []).slice(0, 4).join(', ')}{more(i.fields || [], 4)}</span> },
                ]}
              />
            </Panel>
          )}

          <Panel
            title="Todas las rutas"
            actions={<input className="ui-input cj-filter" type="search" aria-label="Filtrar rutas" placeholder="Filtrar por ruta o campo…" value={pathFilter} onChange={(e) => setPathFilter(e.target.value)} />}
          >
            <DataTable
              maxHeight={420}
              rows={pathRows.slice(0, 400)}
              empty="Ninguna ruta coincide con el filtro."
              columns={[
                { key: 'dir', label: 'Dirección', render: (r) => <Badge tone={r.dir === 'out' ? 'primary' : 'neutral'}>{r.dir === 'out' ? 'salida' : 'entrada'}</Badge> },
                { key: 'path', label: 'Ruta', render: (r) => <span className="ui-mono">{r.p.path}</span> },
                { key: 'fields', label: 'Campos que la escriben', render: (r) => {
                  const ids = r.p.fields.map((f) => f.id);
                  return <span className="ui-mono cj-sub">{ids.slice(0, 3).join(', ')}{more(ids, 3)}</span>;
                } },
              ]}
            />
            {pathRows.length > 400 && <p className="ui-hint">Hay {pathRows.length - 400} rutas más. Filtrá para verlas.</p>}
          </Panel>
        </>
      )}
    </div>
  );
}
