// Probar PDF: el PDF lleno con lo que el formulario manda a cada casillero, y lo que no pinta o no entra.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { downloadBlob } from '../../lib/files';
import { loadDocument } from '../editor-pdf/pdfjs.js';
import { Alert, Badge, Button, DataTable, Panel, Stats, Tabs } from '../../components/ui';

function PageView({ doc, n, width, marks, focus }) {
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  useEffect(() => {
    let task;
    let cancelled = false;
    doc.getPage(n).then((page) => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const scale = width / base.width;
      setSize({ w: base.width, h: base.height, scale });
      const ratio = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale: scale * ratio });
      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
      task.promise.catch(() => { /* render cancelado */ });
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, n, width]);

  return (
    <div className="ss-page" style={size ? { width: size.w * size.scale, height: size.h * size.scale } : { width }}>
      <canvas ref={ref} style={size ? { width: size.w * size.scale, height: size.h * size.scale } : undefined} />
      {size && marks.map((m, i) => (
        <span
          key={i}
          data-mark={m.name}
          className={`ss-mark is-${m.kind} ${focus === m.name ? 'is-focus' : ''}`}
          title={`${m.name}: ${m.text}`}
          style={{
            left: m.x * size.scale,
            top: (size.h - m.y - m.height) * size.scale,
            width: m.width * size.scale,
            height: m.height * size.scale,
          }}
        />
      ))}
    </div>
  );
}

const LISTS = [
  ['noEntran', 'No entran'],
  ['fallos', 'No se pudieron llenar'],
  ['noEsta', 'No están en el PDF'],
  ['sinCasillero', 'Sin casillero'],
  ['sinUsar', 'Del PDF sin usar'],
];

export default function ProbarPdf({ nombre, hasPdf, hasFormDef, res, busy, error, dummy, onDummy }) {
  const [loaded, setLoaded] = useState({ res: null, doc: null });
  const doc = res && loaded.res === res ? loaded.doc : null;
  const [width, setWidth] = useState(640);
  const [showMarks, setShowMarks] = useState(true);
  const [list, setList] = useState('noEntran');
  const [focus, setFocus] = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!res?.pdfBytes) return undefined;
    let alive = true;
    loadDocument(res.pdfBytes).then((d) => { if (alive) setLoaded({ res, doc: d }); }).catch(() => {});
    return () => { alive = false; };
  }, [res]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.floor(e.contentRect.width) - 4)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  const marksByPage = useMemo(() => {
    const m = new Map();
    if (!res || !showMarks) return m;
    const kindOf = new Map();
    res.sinUsar.forEach((n) => kindOf.set(n, ['unused', 'el form-def no lo usa']));
    res.fallos.forEach((f) => kindOf.set(f.field, ['warn', f.reason]));
    res.noEntran.forEach((f) => kindOf.set(f.field, ['bad', `necesita ${f.necesita} pt y hay ${f.disponible}`]));
    for (const w of res.widgets) {
      const k = kindOf.get(w.name);
      if (!k) continue;
      if (!m.has(w.page)) m.set(w.page, []);
      m.get(w.page).push({ ...w, kind: k[0], text: k[1] });
    }
    return m;
  }, [res, showMarks]);

  function goTo(name) {
    setFocus(name);
    setShowMarks(true);
    setTimeout(() => boxRef.current?.querySelector(`[data-mark="${CSS.escape(name)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  }

  if (!hasPdf || !hasFormDef) {
    return <Alert tone="info">Para probar el PDF hacen falta el PDF del formulario y el JSON del formulario. El PDF se llena con lo que el formulario manda a cada casillero.</Alert>;
  }
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!res) return <p className="ui-hint">{busy ? 'Llenando el PDF…' : ''}</p>;

  const rows = {
    noEntran: res.noEntran.map((f) => ({ key: f.field, name: f.field, text: `Necesita ${f.necesita} pt y la caja tiene ${f.disponible} (letra ${f.size}).` })),
    fallos: res.fallos.map((f, i) => ({ key: `${f.field}-${i}`, name: f.field, text: f.reason })),
    noEsta: res.noEsta.map((n) => ({ key: n, name: n, text: 'El form-def lo usa pero el PDF no tiene ese casillero: no pinta.' })),
    sinCasillero: res.sinCasillero.map((n) => ({ key: n, name: n, text: 'El campo tiene valor pero no está unido a ningún casillero del PDF.' })),
    sinUsar: res.sinUsar.map((n) => ({ key: n, name: n, text: 'Ningún campo del form-def lo usa: queda siempre vacío.' })),
  };
  const problems = res.noEntran.length + res.fallos.length + res.noEsta.length;

  return (
    <div className="ui-stack">
      <Panel
        title="El PDF lleno"
        hint="Se llena con lo que el formulario manda a cada casillero (los datos de prellenado y lo que completes en «Simular a mano»), igual que Signaframe."
        actions={(
          <>
            <label className="ss-check"><input type="checkbox" checked={dummy} onChange={(e) => onDummy(e.target.checked)} /> Completar los vacíos con datos de prueba</label>
            <label className="ss-check"><input type="checkbox" checked={showMarks} onChange={(e) => setShowMarks(e.target.checked)} /> Marcar problemas</label>
            <Button size="sm" icon={Download} onClick={() => downloadBlob(new Blob([res.pdfBytes], { type: 'application/pdf' }), `${nombre}_prueba.pdf`)}>Bajar PDF lleno</Button>
          </>
        )}
      >
        {problems === 0
          ? <Alert tone="success">Todo lo que el formulario manda al PDF se pintó y entra en su casillero.</Alert>
          : <Alert tone="warning">Hay {problems} casillero{problems === 1 ? '' : 's'} con problemas: no pintan, no entran o no se pudieron llenar.</Alert>}
        <Stats items={[
          { label: 'Casilleros pintados', value: res.pintados.length },
          { label: 'No entran', value: res.noEntran.length, tone: res.noEntran.length ? 'bad' : 'good' },
          { label: 'No se pudieron llenar', value: res.fallos.length, tone: res.fallos.length ? 'warn' : undefined },
          { label: 'No están en el PDF', value: res.noEsta.length, tone: res.noEsta.length ? 'bad' : undefined },
          { label: 'Del PDF sin usar', value: res.sinUsar.length },
        ]} />
      </Panel>

      <div className="ss-grid">
        <Panel title="Vista previa" hint={showMarks ? 'Rojo: no entra. Amarillo: no se pudo llenar. Gris: el form-def no lo usa.' : undefined}>
          <div className="ss-pages" ref={boxRef}>
            {busy && <p className="ui-hint">Actualizando…</p>}
            {doc && Array.from({ length: doc.numPages }, (_, i) => (
              <PageView key={i} doc={doc} n={i + 1} width={width} marks={marksByPage.get(i + 1) || []} focus={focus} />
            ))}
          </div>
        </Panel>
        <Panel title={<Tabs value={list} onChange={setList} options={LISTS.map(([value, label]) => ({ value, label: `${label} (${rows[value].length})` }))} />}>
          <DataTable
            maxHeight={620}
            empty="Nada en esta lista."
            rows={rows[list]}
            columns={[
              { key: 'name', label: 'Casillero', render: (r) => <span className="ui-mono">{r.name}</span> },
              { key: 'text', label: 'Qué pasa' },
              { key: 'go', label: '', render: (r) => res.widgets.some((w) => w.name === r.name) && list !== 'noEsta' && list !== 'sinCasillero' && (
                <Button size="sm" variant="ghost" onClick={() => goTo(r.name)}>Ver</Button>
              ) },
            ]}
          />
          {list === 'sinUsar' && rows.sinUsar.length > 0 && <p className="ui-hint"><Badge>Nota</Badge> Si alguno debería llenarse, falta unirlo en la matriz.</p>}
        </Panel>
      </div>
    </div>
  );
}
