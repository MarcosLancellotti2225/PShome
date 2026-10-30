// Lista de campos: buscador, filtros y selección sincronizada con el PDF.
import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { typeLabel, isRenamed, isChanged } from '../../lib/pdf-editor/model.js';

const FILTERS = [
  ['all', 'Todos'],
  ['pending', 'Sin renombrar'],
  ['renamed', 'Renombrados'],
  ['changed', 'Con cambios'],
  ['problem', 'Con problemas'],
  ['new', 'Nuevos'],
  ['deleted', 'Borrados'],
];

export default function FieldList({ fields, selected, problems, matches, query, setQuery, filter, setFilter, page, setPage, pageCount, onSelect }) {
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fields.filter((f) => {
      if (page && f.page !== page) return false;
      if (q && !`${f.name} ${f.orig.name || ''}`.toLowerCase().includes(q)) return false;
      switch (filter) {
        case 'pending': return !f.isNew && !f.deleted && !isRenamed(f);
        case 'renamed': return isRenamed(f) && !f.deleted;
        case 'changed': return isChanged(f);
        case 'problem': return problems.has(f.key);
        case 'new': return f.isNew && !f.deleted;
        case 'deleted': return f.deleted;
        default: return true;
      }
    });
  }, [fields, query, filter, page, problems]);

  return (
    <div className="ep-list">
      <div className="ep-list-filters">
        <input className="ui-input" type="search" placeholder="Buscar campo…" aria-label="Buscar campo" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="ep-list-row">
          <select className="ui-input" aria-label="Mostrar" value={filter} onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="ui-input" aria-label="Página" value={page} onChange={(e) => setPage(Number(e.target.value))}>
            <option value={0}>Todas las págs.</option>
            {Array.from({ length: pageCount }, (_, i) => <option key={i} value={i + 1}>Pág. {i + 1}</option>)}
          </select>
        </div>
        <div className="ep-list-count">{visible.length} de {fields.length} campos</div>
      </div>
      <ul className="ep-list-items" role="listbox" aria-multiselectable="true" aria-label="Campos">
        {visible.map((f) => {
          const m = matches.get(f.key);
          const prob = problems.get(f.key);
          return (
            <li
              key={f.key}
              role="option"
              aria-selected={selected.has(f.key)}
              tabIndex={0}
              className={`ep-item ${selected.has(f.key) ? 'is-selected' : ''} ${f.deleted ? 'is-deleted' : ''}`}
              onClick={(e) => onSelect(f.key, e.shiftKey || e.metaKey || e.ctrlKey, true)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(f.key, e.shiftKey, true); } }}
            >
              <div className="ep-item-main">
                <span className="ep-item-name">{f.name || '(sin nombre)'}</span>
                {prob && <span className="ep-item-warn" title={prob.join(' · ')}><AlertTriangle size={13} aria-hidden="true" /></span>}
              </div>
              <div className="ep-item-meta">
                {f.isNew ? <span className="ep-tag ep-tag-new">nuevo</span>
                  : f.deleted ? <span className="ep-tag ep-tag-del">borrado</span>
                  : isRenamed(f) ? <span className="ep-item-old">antes: {f.orig.name}</span>
                  : null}
                {m && isRenamed(f) && <span className={`ep-tag ep-tag-${m.matchType}`}>{m.matchType}{m.matchType === 'parecido' ? ` ${Math.round(m.score * 100)}%` : ''}</span>}
                <span className="ep-item-type">{typeLabel(f.type)} · p{f.page}</span>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && <li className="ep-empty">Ningún campo coincide.</li>}
      </ul>
    </div>
  );
}
