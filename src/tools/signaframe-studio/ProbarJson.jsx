// Probar JSON: ¿el JSON que generamos es igual al que mandó el cliente?
// Abajo, la estructura (si el form-def escribe todas las rutas del cliente) y el mapa del JSON
// (lo que antes era el Comparador JSON).
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { compareWithSample } from '../../lib/json-mapper/index.js';
import { JSON_STATUS } from '../../lib/signaframe-qa/index.js';
import { downloadBlob, jsonBlob } from '../../lib/files';
import { Alert, Badge, Button, DataTable, Field, Panel, Stats, Tabs } from '../../components/ui';
import { jsonHtml, more, short } from './util.js';

const TONE = { igual: 'good', distinto: 'bad', tipo: 'bad', falta: 'bad', sobra: 'warn' };
const FILTERS = [
  ['dif', 'Diferencias'],
  ['falta', 'Faltan'],
  ['sobra', 'Sobran'],
  ['distinto', 'Otro valor'],
  ['tipo', 'Otro tipo'],
  ['igual', 'Iguales'],
  ['all', 'Todo'],
];
const CMP_LABEL = { ok: 'coincide', falta: 'falta', forma: 'forma distinta', sobra: 'sobra' };
const CMP_TONE = { ok: 'good', falta: 'bad', forma: 'bad', sobra: 'warn' };

export default function ProbarJson({ nombre, ours, oursFrom, client, cmp, analysis, emptySim }) {
  const [filter, setFilter] = useState('dif');
  const [direction, setDirection] = useState('output');
  const [cmpFilter, setCmpFilter] = useState('problem');
  const [tree, setTree] = useState('output');
  const [pathFilter, setPathFilter] = useState('');

  const rows = useMemo(() => {
    if (!cmp) return [];
    return cmp.rows
      .filter((r) => filter === 'all' || (filter === 'dif' ? r.status !== 'igual' : r.status === filter))
      .map((r, i) => ({ ...r, key: i }));
  }, [cmp, filter]);

  const structure = useMemo(() => {
    if (!analysis || !client) return null;
    try { return compareWithSample(analysis, client, direction); } catch { return null; }
  }, [analysis, client, direction]);

  const structRows = useMemo(() => {
    if (!structure) return [];
    return structure.rows.filter((r) => cmpFilter === 'all' || (cmpFilter === 'problem' ? r.status !== 'ok' : r.status === cmpFilter));
  }, [structure, cmpFilter]);

  const pathRows = useMemo(() => {
    if (!analysis) return [];
    const q = pathFilter.toLowerCase().trim();
    const all = [
      ...analysis.output.paths.map((p) => ({ dir: 'out', p })),
      ...analysis.input.paths.map((p) => ({ dir: 'in', p })),
    ];
    if (!q) return all;
    return all.filter((r) => r.p.path.toLowerCase().includes(q)
      || r.p.fields.some((f) => String(f.id || '').toLowerCase().includes(q) || String(f.label || '').toLowerCase().includes(q)));
  }, [analysis, pathFilter]);

  const treeHtml = useMemo(() => (analysis ? jsonHtml(tree === 'output' ? analysis.output.tree : analysis.input.tree) : ''), [analysis, tree]);

  if (!ours && !analysis) {
    return <Alert tone="info">Cargá el JSON del formulario (o un JSON que ya generaste) y el JSON del cliente para compararlos.</Alert>;
  }

  const diffs = cmp ? cmp.rows.length - cmp.counts.igual : 0;

  return (
    <div className="ui-stack">
      <Panel
        title="¿Nuestro JSON es igual al del cliente?"
        hint={oursFrom}
        actions={(
          <>
            {ours && <Button size="sm" icon={Download} onClick={() => downloadBlob(jsonBlob(ours), `${nombre}_nuestro.json`)}>Bajar nuestro JSON</Button>}
            {cmp && (
              <Button size="sm" icon={Download} onClick={() => downloadBlob(jsonBlob({ resumen: cmp.counts, iguales: cmp.identical, filas: cmp.rows }), `${nombre}_comparacion.json`)}>
                Bajar comparación
              </Button>
            )}
          </>
        )}
      >
        {!client && <Alert tone="info">Cargá el JSON del cliente para compararlo valor por valor.</Alert>}
        {cmp && (
          <>
            {cmp.identical
              ? <Alert tone="success">Son iguales: los {cmp.counts.igual} valores coinciden.</Alert>
              : <Alert tone="warning">Hay {diffs} diferencia{diffs === 1 ? '' : 's'} entre nuestro JSON y el del cliente.</Alert>}
            {emptySim && !cmp.identical && (
              <Alert tone="info">
                Nuestro JSON sale de simular el formulario con los datos de prellenado, y sin datos sale casi vacío. Cargá los datos de prellenado,
                completá el formulario en «Simular a mano» o mirá abajo si la estructura coincide.
              </Alert>
            )}
            <Stats items={[
              { label: 'Iguales', value: cmp.counts.igual, tone: cmp.identical ? 'good' : undefined },
              { label: 'Faltan', value: cmp.counts.falta, tone: cmp.counts.falta ? 'bad' : undefined },
              { label: 'Sobran', value: cmp.counts.sobra, tone: cmp.counts.sobra ? 'warn' : undefined },
              { label: 'Otro valor', value: cmp.counts.distinto, tone: cmp.counts.distinto ? 'bad' : undefined },
              { label: 'Otro tipo', value: cmp.counts.tipo, tone: cmp.counts.tipo ? 'bad' : undefined },
            ]} />
            <Tabs value={filter} onChange={setFilter} options={FILTERS.map(([value, label]) => ({ value, label }))} />
            <DataTable
              maxHeight={460}
              empty="Nada en esta categoría."
              rows={rows.slice(0, 600)}
              columns={[
                { key: 'status', label: 'Estado', render: (r) => <Badge tone={TONE[r.status]}>{JSON_STATUS[r.status]}</Badge> },
                { key: 'path', label: 'Ruta', render: (r) => <span className="ui-mono">{r.path}</span> },
                { key: 'ours', label: 'Nuestro', render: (r) => <span className="ui-mono">{r.status === 'falta' ? '—' : short(r.ours)}</span> },
                { key: 'client', label: 'Cliente', render: (r) => <span className="ui-mono">{r.status === 'sobra' ? '—' : short(r.client)}</span> },
              ]}
            />
            {rows.length > 600 && <p className="ui-hint">Se muestran 600 de {rows.length}. Bajá la comparación para verlas todas.</p>}
          </>
        )}
      </Panel>

      {structure && (
        <Panel
          title="Estructura: ¿el formulario escribe todas las rutas del cliente?"
          hint="No mira los valores: compara las rutas que puede escribir el form-def con las que trae el JSON del cliente. Sirve aunque no haya datos de prellenado."
          actions={(
            <>
              <Field label="Comparar contra" inline>
                <select className="ui-input" value={direction} onChange={(e) => setDirection(e.target.value)}>
                  <option value="output">El JSON de salida</option>
                  <option value="input">El JSON de entrada (prellenado)</option>
                </select>
              </Field>
              <select className="ui-input" aria-label="Qué mostrar" value={cmpFilter} onChange={(e) => setCmpFilter(e.target.value)}>
                <option value="problem">Solo los problemas</option>
                <option value="falta">Faltan</option>
                <option value="forma">Forma distinta</option>
                <option value="sobra">Sobran</option>
                <option value="ok">Coinciden</option>
                <option value="all">Todo</option>
              </select>
            </>
          )}
        >
          <Stats items={[
            { label: 'Cobertura', value: `${structure.coverage}%`, tone: structure.coverage >= 90 ? 'good' : structure.coverage >= 60 ? 'warn' : 'bad' },
            { label: 'Coinciden', value: structure.counts.ok },
            { label: 'Faltan', value: structure.counts.falta, tone: structure.counts.falta ? 'bad' : undefined },
            { label: 'Forma distinta', value: structure.counts.forma, tone: structure.counts.forma ? 'bad' : undefined },
            { label: 'Sobran', value: structure.counts.sobra, tone: structure.counts.sobra ? 'warn' : undefined },
          ]} />
          <DataTable
            maxHeight={380}
            empty="Nada en esta categoría."
            rows={structRows.slice(0, 500).map((r, i) => ({ ...r, key: i }))}
            columns={[
              { key: 'status', label: 'Estado', render: (r) => <Badge tone={CMP_TONE[r.status]}>{CMP_LABEL[r.status]}</Badge> },
              { key: 'path', label: 'Ruta del cliente', render: (r) => (
                <div className="ui-mono">
                  {r.path}
                  {r.sample !== null && r.sample !== undefined && <div className="ss-sub">ej: {JSON.stringify(r.sample).slice(0, 60)}</div>}
                </div>
              ) },
              { key: 'detail', label: 'Qué pasa', render: (r) => (
                <>
                  {r.detail}
                  {r.suggestion && <div className="ss-suggest ui-mono">→ el formulario la escribe en: {r.suggestion}</div>}
                </>
              ) },
            ]}
          />
        </Panel>
      )}

      {analysis && (
        <details className="ss-details">
          <summary>Mapa del JSON del formulario: {analysis.stats.outputPaths} rutas de salida y {analysis.stats.inputPaths} de entrada</summary>
          <div className="ui-stack">
            <Panel
              title={<Tabs value={tree} onChange={setTree} options={[{ value: 'output', label: 'JSON de salida' }, { value: 'input', label: 'JSON de entrada (prellenado)' }]} />}
              actions={<Button size="sm" icon={Download} onClick={() => downloadBlob(jsonBlob(tree === 'output' ? analysis.output.tree : analysis.input.tree), `${nombre}_${tree === 'output' ? 'salida' : 'entrada'}.json`)}>Bajar</Button>}
            >
              <p className="ui-hint">
                {tree === 'output'
                  ? 'Lo que el formulario envía al completarse. Cada hoja muestra el tipo del campo o los valores posibles.'
                  : 'Lo que el formulario usa para prellenarse (prefillKey y prefillMappings).'}
              </p>
              <pre className="ss-code" dangerouslySetInnerHTML={{ __html: treeHtml }} />
            </Panel>
            <Panel
              title="Todas las rutas"
              actions={<input className="ui-input ss-filter" type="search" aria-label="Filtrar rutas" placeholder="Filtrar por ruta o campo…" value={pathFilter} onChange={(e) => setPathFilter(e.target.value)} />}
            >
              <DataTable
                maxHeight={420}
                rows={pathRows.slice(0, 400).map((r, i) => ({ ...r, key: i }))}
                empty="Ninguna ruta coincide con el filtro."
                columns={[
                  { key: 'dir', label: 'Dirección', render: (r) => <Badge tone={r.dir === 'out' ? 'primary' : 'neutral'}>{r.dir === 'out' ? 'salida' : 'entrada'}</Badge> },
                  { key: 'path', label: 'Ruta', render: (r) => <span className="ui-mono">{r.p.path}</span> },
                  { key: 'fields', label: 'Campos que la usan', render: (r) => {
                    const ids = r.p.fields.map((f) => f.id);
                    return <span className="ui-mono ss-sub">{ids.slice(0, 3).join(', ')}{more(ids, 3)}</span>;
                  } },
                ]}
              />
              {pathRows.length > 400 && <p className="ui-hint">Hay {pathRows.length - 400} rutas más. Filtrá para verlas.</p>}
            </Panel>
          </div>
        </details>
      )}
    </div>
  );
}
