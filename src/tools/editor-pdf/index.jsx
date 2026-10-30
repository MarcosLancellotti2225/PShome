// Editor PDF — une el Detector de campos y Convertir PDF (FormConverterExcel) en una sola pantalla.
// La lógica vive en src/lib/pdf-editor (mismo motor que Convertir PDF); acá, la interfaz.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Copy, Download, FileSpreadsheet, FileText, Image as ImageIcon, ListChecks, MousePointer2, Redo2,
  SquarePlus, Tag, Undo2, Upload, Wand2, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import { Alert, Badge, Button, ConfirmButton, Field, FileDrop, Panel } from '../../components/ui';
import { baseName, downloadBlob, downloadDataUrl, readBytes } from '../../lib/files';
import {
  applyEdits, entriesFromColumns, fieldsToExcel, matchExcelToFields, newField, openPdf, parseBulkText,
  readNamesExcel, summarize, toBulkText, validate, withDummyData, withLabels, isTextField,
} from '../../lib/pdf-editor/index.js';
import { initialState, patchKeys, reducer } from './state';
import { clearWork, loadWork, saveWork } from './storage';
import { loadDocument } from './pdfjs';
import PdfPages from './PdfPages';
import FieldList from './FieldList';
import Inspector from './Inspector';
import './editor.css';

const pdfBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' });
const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
};

export default function EditorPdf() {
  const [file, setFile] = useState(null);           // { name, bytes }
  const [doc, setDoc] = useState(null);             // documento de pdf.js
  const [pageSizes, setPageSizes] = useState([]);
  const [state, dispatch] = useReducer(reducer, initialState);
  const { fields } = state;
  const [selected, setSelected] = useState(new Set());
  const [focusKey, setFocusKey] = useState(null);
  const [mode, setMode] = useState('select');
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(0);
  const [showNames, setShowNames] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [pageFilter, setPageFilter] = useState(0);
  const [matches, setMatches] = useState(new Map());
  const [panel, setPanel] = useState(null);         // 'import' | 'bulk' | 'export'
  const [status, setStatus] = useState(null);       // { tone, text, list? }
  const [busy, setBusy] = useState('');
  const [saved, setSaved] = useState(null);         // trabajo guardado para retomar
  const [importCols, setImportCols] = useState(null);
  const [bulkText, setBulkText] = useState('');
  const [capFont, setCapFont] = useState({ on: false, size: 10 });
  const [longText, setLongText] = useState(false);
  const viewerRef = useRef(null);

  const problems = useMemo(() => validate(fields), [fields]);
  const stats = useMemo(() => summarize(fields), [fields]);
  const change = useCallback((apply, coalesce) => dispatch({ type: 'change', apply, coalesce }), []);

  // ── Abrir ─────────────────────────────────────────────────────────────────
  useEffect(() => { loadWork().then((w) => { if (w?.bytes) setSaved(w); }); }, []);

  async function openBytes(name, bytes, restoredFields) {
    setBusy('Leyendo el PDF…');
    setStatus(null);
    try {
      const [pdf, detected] = await Promise.all([loadDocument(bytes), restoredFields ? null : openPdf(bytes)]);
      const sizes = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const vp = (await pdf.getPage(i)).getViewport({ scale: 1 });
        sizes.push({ width: vp.width, height: vp.height });
      }
      setFile({ name, bytes });
      setDoc(pdf);
      setPageSizes(sizes);
      dispatch({ type: 'load', fields: restoredFields || detected });
      setSelected(new Set());
      setMatches(new Map());
      setPanel(null);
      setSaved(null);
      const n = (restoredFields || detected).length;
      setStatus(n ? null : { tone: 'warning', text: 'Este PDF no tiene campos de formulario. Podés dibujarlos con «Dibujar campo».' });
    } catch (e) {
      setStatus({ tone: 'error', text: `No se pudo abrir el PDF: ${e.message}` });
    } finally {
      setBusy('');
    }
  }

  async function onPickPdf(f) {
    if (!f) return;
    openBytes(f.name, await readBytes(f));
  }

  function closeFile() {
    setFile(null); setDoc(null); setPageSizes([]); dispatch({ type: 'load', fields: [] });
    setSelected(new Set()); setStatus(null); clearWork();
  }

  // ── Autoguardado (en este navegador) ──────────────────────────────────────
  useEffect(() => {
    if (!file) return undefined;
    const t = setTimeout(() => saveWork({ name: file.name, bytes: file.bytes, fields }), 800);
    return () => clearTimeout(t);
  }, [file, fields]);

  // ── Zoom: «ajustar al ancho» ──────────────────────────────────────────────
  useEffect(() => {
    if (!viewerRef.current || !pageSizes.length) return undefined;
    const el = viewerRef.current;
    const measure = () => setFitWidth(Math.max(0.3, (el.clientWidth - 40) / Math.max(...pageSizes.map((s) => s.width))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageSizes]);
  const scale = (fitWidth || 1) * zoom;

  // ── Selección y cambios ───────────────────────────────────────────────────
  const select = useCallback((key, additive, fromList) => {
    setSelected((prev) => {
      if (!additive) return new Set([key]);
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    if (fromList) setFocusKey(`${key}`);
  }, []);

  const updateKeys = (keys, patch, coalesce) => change(patchKeys(keys, patch), coalesce);
  const deleteKeys = (keys) => change((fs) => fs
    .filter((f) => !(keys.includes(f.key) && f.isNew))
    .map((f) => (keys.includes(f.key) ? { ...f, deleted: true } : f)));
  const restoreKeys = (keys) => updateKeys(keys, { deleted: false });
  const renameKeys = (keys, fn) => updateKeys(keys, (f) => ({ name: fn(f) }));

  const onRects = useCallback((rects, id) => change((fs) => fs.map((f) => (rects.has(f.key) ? { ...f, ...rects.get(f.key) } : f)), id), [change]);
  const onDragEnd = useCallback(() => dispatch({ type: 'endCoalesce' }), []);
  const onDraw = useCallback((page, rect) => {
    let created;
    change((fs) => {
      created = newField({ page, ...rect, existingNames: new Set(fs.map((f) => f.name)) });
      return [...fs, created];
    });
    setMode('select');
    setTimeout(() => { if (created) { setSelected(new Set([created.key])); document.getElementById('ep-name')?.select(); } }, 0);
  }, [change]);

  // ── Teclado ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!file) return undefined;
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); dispatch({ type: e.shiftKey ? 'redo' : 'undo' }); return; }
      if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); dispatch({ type: 'redo' }); return; }
      if (typing) return;
      if (e.key === 'Escape') { setMode('select'); setSelected(new Set()); return; }
      if (!selected.size) return;
      const keys = [...selected];
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteKeys(keys); return; }
      const step = e.shiftKey ? 10 : 1;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (moves) {
        e.preventDefault();
        change(patchKeys(keys, (f) => (f.deleted ? {} : { x: f.x + moves[0], y: f.y + moves[1] })), `nudge-${keys.join()}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Importar nombres desde Excel ──────────────────────────────────────────
  function applyEntries(entries) {
    const found = matchExcelToFields(entries, fields);
    if (!found.size) { setStatus({ tone: 'warning', text: 'Ningún nombre del Excel coincide con los campos del PDF.' }); return; }
    change((fs) => fs.map((f) => (found.has(f.key) && !f.deleted ? { ...f, name: found.get(f.key).newName } : f)));
    setMatches(found);
    const count = (t) => [...found.values()].filter((m) => m.matchType === t).length;
    const fuzzy = count('parecido');
    setStatus({
      tone: fuzzy ? 'warning' : 'success',
      text: `Se renombraron ${found.size} campos: ${count('exacto')} exactos, ${count('normalizado')} por nombre parecido sin espacios ni tildes${fuzzy ? `, ${fuzzy} por parecido (revisalos: filtrá «Renombrados»)` : ''}.`,
    });
    setPanel(null);
    setImportCols(null);
  }

  async function onPickExcel(f) {
    if (!f) return;
    try {
      const r = readNamesExcel(await readBytes(f));
      if (r.format === 'matriz') applyEntries(r.entries);
      else setImportCols({ ...r, colOld: 0, colNew: Math.min(1, r.headers.length - 1), fileName: f.name });
    } catch (e) {
      setStatus({ tone: 'error', text: `No se pudo leer el Excel: ${e.message}` });
    }
  }

  // ── Edición en bloque ─────────────────────────────────────────────────────
  function openBulk() { setBulkText(toBulkText(fields)); setPanel('bulk'); }
  function applyBulk() {
    const map = new Map(parseBulkText(bulkText).map((e) => [e.oldName, e.newName]));
    let n = 0;
    change((fs) => fs.map((f) => {
      if (f.isNew || f.deleted || !map.has(f.orig.name)) return f;
      const name = map.get(f.orig.name) || f.orig.name;
      if (name === f.name) return f;
      n += 1;
      return { ...f, name };
    }));
    setTimeout(() => setStatus({ tone: 'success', text: `Edición en bloque aplicada: ${n} nombres cambiados.` }), 0);
    setPanel(null);
  }

  // ── Descargas ─────────────────────────────────────────────────────────────
  const base = file ? baseName({ name: file.name }) : 'formulario';

  async function run(label, fn) {
    setBusy(label);
    try { await fn(); } catch (e) { setStatus({ tone: 'error', text: `${label.replace('…', '')}: ${e.message}` }); } finally { setBusy(''); }
  }

  const downloadEdited = () => run('Generando el PDF…', async () => {
    const { pdfBytes, report } = await applyEdits(file.bytes, fields, { capFont: capFont.on ? capFont.size : 0 });
    downloadBlob(pdfBlob(pdfBytes), `${base}_editado.pdf`);
    const parts = [
      report.renamed && `${report.renamed} renombrados`, report.deleted && `${report.deleted} borrados`, report.added && `${report.added} nuevos`,
      report.moved && `${report.moved} movidos`, report.props && `${report.props} con fuente o multilínea`, report.capped && `${report.capped} con fuente limitada`,
    ].filter(Boolean);
    setStatus({ tone: 'success', text: `PDF descargado${parts.length ? `: ${parts.join(', ')}` : ' (sin cambios)'}.${report.combCleared ? ` A ${report.combCleared} campos se les quitó el «peine» para que respeten la fuente.` : ''}` });
  });

  const downloadDummy = () => run('Llenando con datos de prueba…', async () => {
    const { pdfBytes } = await applyEdits(file.bytes, fields, { capFont: capFont.on ? capFont.size : 0 });
    const r = await withDummyData(pdfBytes, { textoLargo: longText });
    downloadBlob(pdfBlob(r.pdfBytes), `${base}_prueba.pdf`);
    setStatus({
      tone: r.noEntran.length || r.comb ? 'warning' : 'success',
      text: `PDF de prueba descargado: ${r.total} campos llenos.${r.comb ? ` ${r.comb} campos tienen «peine»: en este preview no se ven como en Acrobat.` : ''}${r.noEntran.length ? ` ${r.noEntran.length} no entran en su caja:` : ''}`,
      list: r.noEntran.map((n) => `${n.field}: necesita ${n.necesita} pt y tiene ${n.disponible} pt (fuente ${n.size})`),
    });
  });

  const downloadLabels = () => run('Generando el PDF con etiquetas…', async () => {
    const { pdfBytes } = await applyEdits(file.bytes, fields);
    downloadBlob(pdfBlob(await withLabels(pdfBytes)), `${base}_etiquetas.pdf`);
    setStatus({ tone: 'success', text: 'PDF con los nombres de los campos descargado.' });
  });

  const downloadExcel = () => {
    downloadBlob(new Blob([fieldsToExcel(fields)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}_campos.xlsx`);
    setStatus({ tone: 'success', text: 'Excel de campos descargado. Si lo editás (columna «AcroForm Propuesto»), lo podés volver a importar.' });
  };

  const downloadImage = () => run('Generando la imagen…', async () => {
    const pageNumber = pageFilter || (fields.find((f) => selected.has(f.key))?.page) || 1;
    const page = await doc.getPage(pageNumber);
    const s = 2;
    const vp = page.getViewport({ scale: s });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const h = pageSizes[pageNumber - 1].height;
    ctx.font = '600 13px "Open Sans", sans-serif';
    for (const f of fields.filter((x) => x.page === pageNumber && !x.deleted)) {
      const x = f.x * s; const y = (h - f.y - f.height) * s;
      ctx.strokeStyle = '#047c76'; ctx.lineWidth = 2; ctx.strokeRect(x, y, f.width * s, f.height * s);
      const w = ctx.measureText(f.name).width + 8;
      ctx.fillStyle = 'rgba(4,124,118,0.9)'; ctx.fillRect(x, y - 18, w, 17);
      ctx.fillStyle = '#fff'; ctx.fillText(f.name, x + 4, y - 5);
    }
    downloadDataUrl(canvas.toDataURL('image/png'), `${base}_pagina${pageNumber}.png`);
    setStatus({ tone: 'success', text: `Imagen de la página ${pageNumber} descargada.` });
  });

  const copyNames = async () => {
    const text = fields.filter((f) => !f.deleted).map((f) => f.name).join('\n');
    try { await navigator.clipboard.writeText(text); setStatus({ tone: 'success', text: 'Lista de nombres copiada.' }); } catch { setStatus({ tone: 'error', text: 'El navegador no dejó copiar. Usá «Excel de campos».' }); }
  };

  // ── Sin PDF abierto ───────────────────────────────────────────────────────
  if (!file) {
    return (
      <div className="ui-stack">
        <Panel title="Abrí un PDF" hint="Se detectan todos los campos del formulario (nombre, tipo, página y posición). Después podés renombrarlos, moverlos, cambiarles el tamaño o la fuente, borrarlos o dibujar campos nuevos.">
          <div className="ui-files">
            <FileDrop label="PDF con campos de formulario" description="Hacé clic o arrastrá el PDF acá" accept=".pdf" file={null} onFile={onPickPdf} required />
          </div>
          {saved && (
            <Alert tone="info">
              Tenés un PDF sin terminar: <strong>{saved.name}</strong> ({ago(saved.savedAt)}).{' '}
              <span className="ep-inline-actions">
                <Button size="sm" variant="primary" onClick={() => openBytes(saved.name, saved.bytes, saved.fields)}>Retomarlo</Button>
                <Button size="sm" variant="ghost" onClick={() => { clearWork(); setSaved(null); }}>Descartar</Button>
              </span>
            </Alert>
          )}
          {busy && <Alert tone="info">{busy}</Alert>}
          {status && <Alert tone={status.tone}>{status.text}</Alert>}
        </Panel>
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  const problemCount = problems.size;
  return (
    <div className="ep">
      <div className="ep-toolbar">
        <div className="ep-file">
          <FileText size={16} aria-hidden="true" />
          <span className="ep-file-name" title={file.name}>{file.name}</span>
          <Badge tone="neutral">{stats.total} campos</Badge>
          {stats.renamed > 0 && <Badge tone="primary">{stats.renamed} renombrados</Badge>}
          {stats.added > 0 && <Badge tone="good">{stats.added} nuevos</Badge>}
          {stats.deleted > 0 && <Badge tone="bad">{stats.deleted} borrados</Badge>}
          {problemCount > 0 && <button type="button" className="ep-badge-btn" onClick={() => setFilter('problem')}><Badge tone="warn">{problemCount} con problemas</Badge></button>}
        </div>
        <div className="ep-tools">
          <div className="ep-group" role="group" aria-label="Herramienta">
            <Button size="sm" variant={mode === 'select' ? 'primary' : 'secondary'} icon={MousePointer2} onClick={() => setMode('select')}>Elegir y mover</Button>
            <Button size="sm" variant={mode === 'draw' ? 'primary' : 'secondary'} icon={SquarePlus} onClick={() => setMode(mode === 'draw' ? 'select' : 'draw')}>Dibujar campo</Button>
          </div>
          <div className="ep-group" role="group" aria-label="Historial">
            <Button size="sm" icon={Undo2} disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })} title="Deshacer (Ctrl+Z)">Deshacer</Button>
            <Button size="sm" icon={Redo2} disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })} title="Rehacer (Ctrl+Y)">Rehacer</Button>
          </div>
          <div className="ep-group" role="group" aria-label="Nombres">
            <Button size="sm" icon={Upload} variant={panel === 'import' ? 'primary' : 'secondary'} onClick={() => setPanel(panel === 'import' ? null : 'import')}>Importar nombres</Button>
            <Button size="sm" icon={ListChecks} variant={panel === 'bulk' ? 'primary' : 'secondary'} onClick={() => (panel === 'bulk' ? setPanel(null) : openBulk())}>Edición en bloque</Button>
            <Button size="sm" icon={Wand2} onClick={() => { const keys = fields.filter((f) => !f.deleted && isTextField(f) && (!pageFilter || f.page === pageFilter)).map((f) => f.key); updateKeys(keys, { fontSize: 0 }); setStatus({ tone: 'success', text: `${keys.length} campos de texto quedaron con fuente Auto.` }); }} title="Pone en Auto la fuente de los campos de texto (de la página filtrada, o de todas)">Todo en Auto</Button>
          </div>
          <div className="ep-group" role="group" aria-label="Vista">
            <Button size="sm" icon={ZoomOut} onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))} aria-label="Alejar" />
            <button type="button" className="ep-zoom" onClick={() => setZoom(1)} title="Ajustar al ancho">{Math.round(zoom * 100)}%</button>
            <Button size="sm" icon={ZoomIn} onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))} aria-label="Acercar" />
            <Button size="sm" icon={Tag} variant={showNames ? 'primary' : 'secondary'} onClick={() => setShowNames(!showNames)}>Nombres</Button>
          </div>
          <div className="ep-group ep-group-end">
            <Button size="sm" variant="primary" icon={Download} onClick={() => setPanel(panel === 'export' ? null : 'export')}>Descargar</Button>
            <ConfirmButton size="sm" variant="ghost" icon={X} confirmLabel="Sí, cerrar" onConfirm={closeFile}>Cerrar PDF</ConfirmButton>
          </div>
        </div>
      </div>

      {panel === 'import' && (
        <Panel title="Importar nombres desde Excel" hint="Si el Excel tiene las columnas «AcroForm Actual» y «AcroForm Propuesto» (la matriz de 22 columnas o el Excel de campos de este editor), se aplica solo. Si no, elegís las columnas. Cada campo del PDF se busca por nombre exacto, sin espacios ni tildes, o parecido.">
          {!importCols && <FileDrop label="Excel con los nombres" accept=".xlsx,.xls" file={null} onFile={onPickExcel} />}
          {importCols && (
            <>
              <p className="ui-hint">«{importCols.fileName}», hoja «{importCols.sheetName}»: elegí qué columna tiene el nombre actual y cuál el nuevo.</p>
              <div className="ui-row">
                <Field label="Nombre actual (en el PDF)">
                  <select id="ep-col-old" value={importCols.colOld} onChange={(e) => setImportCols({ ...importCols, colOld: Number(e.target.value) })}>
                    {importCols.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </Field>
                <Field label="Nombre nuevo">
                  <select id="ep-col-new" value={importCols.colNew} onChange={(e) => setImportCols({ ...importCols, colNew: Number(e.target.value) })}>
                    {importCols.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </Field>
                <Button variant="primary" onClick={() => applyEntries(entriesFromColumns(importCols.rows, importCols.colOld, importCols.colNew))}>Aplicar</Button>
                <Button variant="ghost" onClick={() => setImportCols(null)}>Elegir otro Excel</Button>
              </div>
            </>
          )}
        </Panel>
      )}

      {panel === 'bulk' && (
        <Panel
          title="Edición en bloque"
          hint="Una línea por campo: nombre actual, TAB, nombre nuevo. Copialo a Excel, editalo y pegalo de vuelta."
          actions={(
            <>
              <Button size="sm" icon={Copy} onClick={async () => { try { await navigator.clipboard.writeText(bulkText); } catch { /* el usuario puede copiar a mano */ } }}>Copiar todo</Button>
              <Button size="sm" variant="primary" onClick={applyBulk}>Aplicar</Button>
            </>
          )}
        >
          <textarea id="ep-bulk" className="ep-bulk" spellCheck={false} value={bulkText} onChange={(e) => setBulkText(e.target.value)} aria-label="Nombres en bloque" />
        </Panel>
      )}

      {panel === 'export' && (
        <Panel title="Descargar">
          {problemCount > 0 && <Alert tone="warning">Hay {problemCount} campos con problemas (nombres repetidos, vacíos o con caracteres raros). Podés descargar igual, pero conviene revisarlos.</Alert>}
          <div className="ep-export">
            <div className="ep-export-item">
              <Button variant="primary" icon={FileText} onClick={downloadEdited}>PDF editado</Button>
              <label className="ep-check">
                <input id="ep-cap" type="checkbox" checked={capFont.on} onChange={(e) => setCapFont({ ...capFont, on: e.target.checked })} />
                Limitar la fuente a
                <input id="ep-cap-size" type="number" min="4" max="48" value={capFont.size} onChange={(e) => setCapFont({ ...capFont, size: Number(e.target.value) || 10 })} className="ep-num" /> pt
              </label>
            </div>
            <div className="ep-export-item">
              <Button icon={FileText} onClick={downloadDummy}>Con datos de prueba</Button>
              <label className="ep-check"><input id="ep-long" type="checkbox" checked={longText} onChange={(e) => setLongText(e.target.checked)} /> texto largo</label>
            </div>
            <div className="ep-export-item"><Button icon={Tag} onClick={downloadLabels}>Con los nombres visibles</Button></div>
            <div className="ep-export-item"><Button icon={ImageIcon} onClick={downloadImage}>Imagen de la página</Button></div>
            <div className="ep-export-item"><Button icon={FileSpreadsheet} onClick={downloadExcel}>Excel de campos</Button></div>
            <div className="ep-export-item"><Button icon={Copy} onClick={copyNames}>Copiar nombres</Button></div>
          </div>
        </Panel>
      )}

      {busy && <Alert tone="info">{busy}</Alert>}
      {status && (
        <Alert tone={status.tone}>
          {status.text}
          {status.list?.length > 0 && <ul className="ep-status-list">{status.list.slice(0, 30).map((l) => <li key={l}>{l}</li>)}</ul>}
        </Alert>
      )}

      <div className="ep-workspace">
        <FieldList
          fields={fields} selected={selected} problems={problems} matches={matches}
          query={query} setQuery={setQuery} filter={filter} setFilter={setFilter}
          page={pageFilter} setPage={setPageFilter} pageCount={pageSizes.length}
          onSelect={select}
        />
        <div className="ep-viewer" ref={viewerRef}>
          {doc && (
            <PdfPages
              doc={doc} pageSizes={pageSizes} fields={fields} selected={selected} problems={problems}
              scale={scale} mode={mode} showNames={showNames} focusKey={focusKey}
              onSelect={select} onClearSelection={() => setSelected(new Set())}
              onRects={onRects} onDragEnd={onDragEnd} onDraw={onDraw}
            />
          )}
        </div>
        <Inspector
          fields={fields} selected={selected} problems={problems}
          onChange={updateKeys} onRename={renameKeys} onDelete={deleteKeys} onRestore={restoreKeys}
        />
      </div>
    </div>
  );
}
