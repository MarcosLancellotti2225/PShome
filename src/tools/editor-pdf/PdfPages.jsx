// Páginas del PDF con los campos encima: seleccionar, mover, cambiar tamaño y dibujar campos nuevos.
import { useEffect, useRef, useState } from 'react';

function PageCanvas({ doc, pageNumber, scale, size }) {
  const ref = useRef(null);
  useEffect(() => {
    let task;
    let cancelled = false;
    doc.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * ratio });
      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
      task.promise.catch(() => { /* render cancelado */ });
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, pageNumber, scale]);
  return <canvas ref={ref} className="ep-canvas" style={{ width: size.width * scale, height: size.height * scale }} />;
}

export default function PdfPages({
  doc, pageSizes, fields, selected, problems, scale, mode, showNames, focusKey,
  onSelect, onClearSelection, onRects, onDragEnd, onDraw,
}) {
  const dragRef = useRef(null);
  const dragSeq = useRef(0);
  const [ghost, setGhost] = useState(null); // rectángulo mientras se dibuja { page, left, top, width, height }
  const rootRef = useRef(null);

  useEffect(() => {
    if (!focusKey || !rootRef.current) return;
    const el = rootRef.current.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
    el?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  }, [focusKey]);

  const byPage = new Map();
  for (const f of fields) {
    if (!byPage.has(f.page)) byPage.set(f.page, []);
    byPage.get(f.page).push(f);
  }

  // ── Mover / cambiar tamaño ────────────────────────────────────────────────
  function startDrag(e, f, kind) {
    if (mode !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    let keys;
    if (kind === 'resize') keys = [f.key];
    else if (selected.has(f.key) && !additive) keys = fields.filter((x) => selected.has(x.key) && x.page === f.page).map((x) => x.key);
    else { onSelect(f.key, additive); keys = additive ? [] : [f.key]; }
    if (!keys.length || f.deleted) return;
    const originals = new Map(fields.filter((x) => keys.includes(x.key)).map((x) => [x.key, { x: x.x, y: x.y, width: x.width, height: x.height }]));
    dragRef.current = { kind, startX: e.clientX, startY: e.clientY, originals, id: `drag-${(dragSeq.current += 1)}`, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale; // hacia abajo en pantalla = y menor en el PDF
    if (!d.moved && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    d.moved = true;
    const rects = new Map();
    for (const [key, o] of d.originals) {
      if (d.kind === 'resize') {
        const width = Math.max(4, Math.round(o.width + dx));
        const height = Math.max(4, Math.round(o.height + dy));
        rects.set(key, { width, height, y: Math.round(o.y + o.height - height) });
      } else {
        rects.set(key, { x: Math.round(o.x + dx), y: Math.round(o.y - dy) });
      }
    }
    onRects(rects, d.id);
  }

  function onPointerUp() {
    if (dragRef.current?.moved) onDragEnd();
    dragRef.current = null;
  }

  // ── Dibujar campo nuevo ───────────────────────────────────────────────────
  function startDraw(e, pageNumber) {
    if (e.button !== 0) return;
    if (mode !== 'draw') { if (e.target === e.currentTarget) onClearSelection(); return; }
    const box = e.currentTarget.getBoundingClientRect();
    const x0 = e.clientX - box.left;
    const y0 = e.clientY - box.top;
    dragRef.current = { kind: 'draw', box, x0, y0, page: pageNumber };
    setGhost({ page: pageNumber, left: x0, top: y0, width: 0, height: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onDrawMove(e) {
    const d = dragRef.current;
    if (d?.kind !== 'draw') { onPointerMove(e); return; }
    const x1 = e.clientX - d.box.left;
    const y1 = e.clientY - d.box.top;
    setGhost({ page: d.page, left: Math.min(d.x0, x1), top: Math.min(d.y0, y1), width: Math.abs(x1 - d.x0), height: Math.abs(y1 - d.y0) });
  }

  function onDrawUp(pageNumber) {
    const d = dragRef.current;
    if (d?.kind !== 'draw') { onPointerUp(); return; }
    dragRef.current = null;
    const g = ghost;
    setGhost(null);
    if (!g || g.width / scale < 6 || g.height / scale < 6) return;
    const h = pageSizes[pageNumber - 1].height;
    onDraw(pageNumber, {
      x: Math.round(g.left / scale),
      y: Math.round(h - (g.top + g.height) / scale),
      width: Math.round(g.width / scale),
      height: Math.round(g.height / scale),
    });
  }

  return (
    <div ref={rootRef} className={`ep-pages ${mode === 'draw' ? 'is-drawing' : ''}`}>
      {pageSizes.map((size, i) => {
        const pageNumber = i + 1;
        return (
          <div key={pageNumber} className="ep-page-wrap">
            <div className="ep-page-label">Página {pageNumber} de {pageSizes.length}</div>
            <div
              className="ep-page"
              style={{ width: size.width * scale, height: size.height * scale }}
              onPointerDown={(e) => startDraw(e, pageNumber)}
              onPointerMove={onDrawMove}
              onPointerUp={() => onDrawUp(pageNumber)}
            >
              <PageCanvas doc={doc} pageNumber={pageNumber} scale={scale} size={size} />
              {(byPage.get(pageNumber) || []).map((f) => {
                const isSel = selected.has(f.key);
                const cls = [
                  'ep-box',
                  isSel && 'is-selected',
                  f.deleted && 'is-deleted',
                  f.isNew && 'is-new',
                  !f.isNew && !f.deleted && f.name !== f.orig.name && 'is-renamed',
                  problems.has(f.key) && 'is-problem',
                ].filter(Boolean).join(' ');
                return (
                  <div
                    key={f.key}
                    data-key={f.key}
                    className={cls}
                    title={f.name}
                    style={{
                      left: f.x * scale,
                      top: (size.height - f.y - f.height) * scale,
                      width: Math.max(2, f.width * scale),
                      height: Math.max(2, f.height * scale),
                    }}
                    onPointerDown={(e) => startDrag(e, f, 'move')}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  >
                    {(showNames || isSel) && <span className="ep-box-name">{f.name || '(sin nombre)'}</span>}
                    {isSel && selected.size === 1 && !f.deleted && (
                      <span
                        className="ep-handle"
                        aria-label="Cambiar tamaño"
                        onPointerDown={(e) => startDrag(e, f, 'resize')}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                      />
                    )}
                  </div>
                );
              })}
              {ghost?.page === pageNumber && (
                <div className="ep-ghost" style={{ left: ghost.left, top: ghost.top, width: ghost.width, height: ghost.height }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
